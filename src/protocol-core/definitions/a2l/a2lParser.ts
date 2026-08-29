/**
 * A2L ayrıştırıcısı — belirteç (token) tabanlı, blok farkındalıklı.
 *
 * ── NEDEN SATIR SATIR DEĞİL ─────────────────────────────────────────────────
 * DBC ve EDS satır tabanlıdır; A2L DEĞİLDİR. Bir `MEASUREMENT` bloğu tek satıra
 * da sığar, on satıra da yayılır; parametreler yalnız BOŞLUKLA ayrılır ve uzun
 * açıklama tırnak içindedir. Satır bölerek okuyan bir ayrıştırıcı, aynı
 * dosyanın iki farklı biçimlendirmesinde iki farklı sonuç verirdi.
 *
 * Bu yüzden metin önce belirteçlere ayrılır (tırnaklı dizge tek belirteç,
 * `/begin`+`/end` blok sınırı, `/* … *\/` ve `//` yorum), sonra bloklar
 * SIRAYLA okunur — ASAM MCD-2 MC'de parametre sırası sabittir.
 *
 * ── AYRIŞTIRICI ÖLMEZ ───────────────────────────────────────────────────────
 * A2L dosyaları üretici araçlarından çıkar ve kapsam dışı blok (RECORD_LAYOUT,
 * IF_DATA, A2ML, FUNCTION…) dosyanın ÇOĞUDUR. Tanınmayan blok sessizce
 * atlanır — hata değildir. Bozuk bir blok ise sorun listesine yazılır ve
 * ayrıştırma devam eder (`edsParser`/`vendorMapParser` ile aynı sözleşme).
 */

import type {
  A2lByteOrder,
  A2lCharacteristic,
  A2lCompuMethod,
  A2lConversionType,
  A2lDataType,
  A2lDatabase,
  A2lMeasurement,
  A2lParseIssue,
  A2lParseResult,
  A2lVerbalTable,
} from './a2lTypes';

const HEX_RADIX = 16;

const DATA_TYPES: ReadonlySet<string> = new Set<A2lDataType>([
  'UBYTE',
  'SBYTE',
  'UWORD',
  'SWORD',
  'ULONG',
  'SLONG',
  'A_UINT64',
  'A_INT64',
  'FLOAT16_IEEE',
  'FLOAT32_IEEE',
  'FLOAT64_IEEE',
]);

const CONVERSION_TYPES: ReadonlySet<string> = new Set<A2lConversionType>([
  'IDENTICAL',
  'LINEAR',
  'RAT_FUNC',
  'TAB_VERB',
  'TAB_INTP',
  'TAB_NOINTP',
  'FORM',
]);

interface Token {
  readonly text: string;
  /** 1-tabanlı satır — sorun mesajları kullanıcıyı dosyada bulabilmeli. */
  readonly line: number;
  /** Tırnaklı dizge miydi: `"UBYTE"` bir ad, `UBYTE` bir anahtar kelimedir. */
  readonly quoted: boolean;
}

/**
 * Belirteçleyici. Tırnak içindeki her şey (boşluk, `/begin`, `*\/`) VERİDİR;
 * yorum başlangıcı da tırnak içinde yorum değildir.
 */
export function tokenizeA2l(text: string): Token[] {
  const tokens: Token[] = [];
  let line = 1;
  let index = 0;

  while (index < text.length) {
    const char = text[index] ?? '';

    if (char === '\n') {
      line++;
      index++;
      continue;
    }
    if (/\s/.test(char)) {
      index++;
      continue;
    }
    if (char === '/' && text[index + 1] === '*') {
      const end = text.indexOf('*/', index + 2);
      const stop = end === -1 ? text.length : end + 2;
      line += (text.slice(index, stop).match(/\n/g) ?? []).length;
      index = stop;
      continue;
    }
    if (char === '/' && text[index + 1] === '/') {
      const end = text.indexOf('\n', index);
      index = end === -1 ? text.length : end;
      continue;
    }
    if (char === '"') {
      let value = '';
      index++;
      while (index < text.length && text[index] !== '"') {
        if (text[index] === '\n') line++;
        value += text[index] ?? '';
        index++;
      }
      index++; // kapanış tırnağı
      tokens.push({ text: value, line, quoted: true });
      continue;
    }

    let value = '';
    while (index < text.length && !/[\s"]/.test(text[index] ?? '')) {
      value += text[index] ?? '';
      index++;
    }
    tokens.push({ text: value, line, quoted: false });
  }

  return tokens;
}

/** `0x1A`, `0X1A`, `26` — A2L üçünü de kullanıyor. */
function parseNumber(text: string | undefined): number | undefined {
  if (text === undefined) return undefined;
  const hex = /^0x([0-9a-f]+)$/i.exec(text);
  if (hex?.[1] !== undefined) return Number.parseInt(hex[1], HEX_RADIX);
  const value = Number(text);
  return Number.isFinite(value) ? value : undefined;
}

class TokenCursor {
  private position = 0;

  constructor(private readonly tokens: readonly Token[]) {}

  get done(): boolean {
    return this.position >= this.tokens.length;
  }

  peek(): Token | undefined {
    return this.tokens[this.position];
  }

  next(): Token | undefined {
    const token = this.tokens[this.position];
    this.position++;
    return token;
  }

  /** Bloğun kalanını (kendi iç bloklarıyla birlikte) atlar. */
  skipBlock(keyword: string): void {
    let depth = 1;
    while (!this.done && depth > 0) {
      const token = this.next();
      if (token === undefined) return;
      if (token.quoted) continue;
      if (token.text === '/begin') depth++;
      else if (token.text === '/end') {
        depth--;
        // `/end X` — anahtar kelime tüketilir, yoksa dış döngü onu blok
        // başlığı sanıp bir sonraki bloğu kaçırırdı.
        if (depth === 0 && this.peek()?.text === keyword) this.next();
      }
    }
  }
}

/** Blok gövdesini `/end <keyword>`e kadar toplar; iç bloklar korunur. */
function collectBlock(cursor: TokenCursor, keyword: string): Token[] {
  const body: Token[] = [];
  let depth = 1;

  while (!cursor.done) {
    const token = cursor.next();
    if (token === undefined) break;
    if (!token.quoted && token.text === '/begin') {
      depth++;
      body.push(token);
      continue;
    }
    if (!token.quoted && token.text === '/end') {
      depth--;
      if (depth === 0) {
        if (cursor.peek()?.text === keyword) cursor.next();
        break;
      }
      body.push(token);
      continue;
    }
    body.push(token);
  }

  return body;
}

function parseMeasurement(body: readonly Token[], issues: A2lParseIssue[]): A2lMeasurement | null {
  // ASAM sırası: Name LongIdentifier Datatype Conversion Resolution Accuracy
  // LowerLimit UpperLimit — sonrası isteğe bağlı anahtar kelimeler.
  const [name, longId, dataType, conversion, , , lower, upper] = body;
  if (name === undefined || dataType === undefined || !DATA_TYPES.has(dataType.text)) {
    issues.push({
      line: name?.line ?? 0,
      messageKey: 'definition.a2l.issue.badMeasurement',
      ...(name === undefined ? {} : { text: name.text }),
    });
    return null;
  }

  const optional = readOptionalKeywords(body);
  const conversionName = conversion?.text ?? '';

  return {
    name: name.text,
    longIdentifier: longId?.quoted === true ? longId.text : '',
    dataType: dataType.text as A2lDataType,
    // `NO_COMPU_METHOD` "dönüşüm yok" demektir; adı taşımak, olmayan bir
    // COMPU_METHOD'a başvuru gibi görünürdü.
    conversion: conversionName === 'NO_COMPU_METHOD' ? '' : conversionName,
    lowerLimit: parseNumber(lower?.text) ?? 0,
    upperLimit: parseNumber(upper?.text) ?? 0,
    ...optional,
  };
}

/** `ECU_ADDRESS`, `BYTE_ORDER`, `BIT_MASK`, `PHYS_UNIT` — sırasız gelebilirler. */
function readOptionalKeywords(body: readonly Token[]): Partial<A2lMeasurement> {
  const out: {
    ecuAddress?: number;
    byteOrder?: A2lByteOrder;
    bitMask?: number;
    unit?: string;
  } = {};

  for (const [index, token] of body.entries()) {
    if (token.quoted) continue;
    const value = body[index + 1];
    if (token.text === 'ECU_ADDRESS') {
      const address = parseNumber(value?.text);
      if (address !== undefined) out.ecuAddress = address;
    } else if (token.text === 'BYTE_ORDER') {
      if (value?.text === 'MSB_FIRST' || value?.text === 'MSB_LAST') out.byteOrder = value.text;
    } else if (token.text === 'BIT_MASK') {
      const mask = parseNumber(value?.text);
      if (mask !== undefined) out.bitMask = mask;
    } else if (token.text === 'PHYS_UNIT') {
      if (value?.quoted === true) out.unit = value.text;
    }
  }

  return out;
}

function parseCharacteristic(body: readonly Token[], issues: A2lParseIssue[]): A2lCharacteristic | null {
  // ASAM sırası: Name LongIdentifier Type Address Deposit MaxDiff Conversion
  // LowerLimit UpperLimit
  const [name, longId, type, address, , , conversion, lower, upper] = body;
  const parsedAddress = parseNumber(address?.text);
  if (name === undefined || type === undefined || parsedAddress === undefined) {
    issues.push({
      line: name?.line ?? 0,
      messageKey: 'definition.a2l.issue.badCharacteristic',
      ...(name === undefined ? {} : { text: name.text }),
    });
    return null;
  }

  return {
    name: name.text,
    longIdentifier: longId?.quoted === true ? longId.text : '',
    type: type.text,
    address: parsedAddress,
    conversion: conversion?.text === 'NO_COMPU_METHOD' ? '' : (conversion?.text ?? ''),
    lowerLimit: parseNumber(lower?.text) ?? 0,
    upperLimit: parseNumber(upper?.text) ?? 0,
  };
}

function parseCompuMethod(body: readonly Token[], issues: A2lParseIssue[]): A2lCompuMethod | null {
  // ASAM sırası: Name LongIdentifier ConversionType Format Unit
  const [name, longId, conversionType, , unit] = body;
  if (name === undefined || conversionType === undefined) {
    issues.push({ line: name?.line ?? 0, messageKey: 'definition.a2l.issue.badCompuMethod' });
    return null;
  }

  const type: A2lConversionType = CONVERSION_TYPES.has(conversionType.text)
    ? (conversionType.text as A2lConversionType)
    : 'UNKNOWN';
  if (type === 'UNKNOWN') {
    issues.push({
      line: conversionType.line,
      messageKey: 'definition.a2l.issue.unknownConversion',
      text: conversionType.text,
    });
  }

  let coeffs: A2lCompuMethod['coeffs'];
  let coeffsLinear: A2lCompuMethod['coeffsLinear'];
  let compuTabRef: string | undefined;

  for (const [index, token] of body.entries()) {
    if (token.quoted) continue;
    if (token.text === 'COEFFS') {
      // Altı katsayı tek tek çözülür: `every` ile daraltma dizi ELEMANINA
      // işlemiyor (`noUncheckedIndexedAccess`), o yüzden ayrıştırma sonrası
      // adlandırılmış değişkenlerle kontrol edilir.
      const [a, b, c, d, e, f] = body.slice(index + 1, index + 7).map((item) => parseNumber(item.text));
      if (
        a !== undefined &&
        b !== undefined &&
        c !== undefined &&
        d !== undefined &&
        e !== undefined &&
        f !== undefined
      ) {
        coeffs = [a, b, c, d, e, f] as const;
      }
    } else if (token.text === 'COEFFS_LINEAR') {
      const a = parseNumber(body[index + 1]?.text);
      const b = parseNumber(body[index + 2]?.text);
      if (a !== undefined && b !== undefined) coeffsLinear = [a, b] as const;
    } else if (token.text === 'COMPU_TAB_REF') {
      compuTabRef = body[index + 1]?.text;
    }
  }

  return {
    name: name.text,
    longIdentifier: longId?.quoted === true ? longId.text : '',
    conversionType: type,
    unit: unit?.quoted === true ? unit.text : '',
    ...(coeffs === undefined ? {} : { coeffs }),
    ...(coeffsLinear === undefined ? {} : { coeffsLinear }),
    ...(compuTabRef === undefined ? {} : { compuTabRef }),
  };
}

function parseVerbalTable(body: readonly Token[]): A2lVerbalTable | null {
  // ASAM sırası: Name LongIdentifier TAB_VERB NumberValuePairs (InVal "text")*
  const [name, longId, , count] = body;
  if (name === undefined) return null;

  const pairs = body.slice(4);
  const values: Record<string, string> = {};
  const expected = parseNumber(count?.text) ?? pairs.length / 2;

  for (let index = 0; index + 1 < pairs.length && Object.keys(values).length < expected; index += 2) {
    const key = parseNumber(pairs[index]?.text);
    const label = pairs[index + 1];
    if (key === undefined || label?.quoted !== true) continue;
    values[String(key)] = label.text;
  }

  return {
    name: name.text,
    longIdentifier: longId?.quoted === true ? longId.text : '',
    values,
  };
}

export function parseA2l(text: string): A2lParseResult {
  const issues: A2lParseIssue[] = [];
  const cursor = new TokenCursor(tokenizeA2l(text));

  const measurements: A2lMeasurement[] = [];
  const characteristics: A2lCharacteristic[] = [];
  const compuMethods: A2lCompuMethod[] = [];
  const verbalTables: A2lVerbalTable[] = [];

  let project = '';
  let module = '';
  let moduleDescription = '';
  // ASAM varsayılanı MSB_LAST (little-endian); `MOD_COMMON` yazarsa o kazanır.
  let defaultByteOrder: A2lByteOrder = 'MSB_LAST';

  while (!cursor.done) {
    const token = cursor.next();
    if (token === undefined) break;
    if (token.quoted || token.text !== '/begin') continue;

    const keyword = cursor.next();
    if (keyword === undefined) break;

    switch (keyword.text) {
      case 'PROJECT': {
        // PROJECT ve MODULE İÇ İÇEDİR: gövdesi atlanmaz, adı okunup akış
        // içeriden devam eder — yoksa bütün ölçümler atlanmış olurdu.
        project = cursor.peek()?.text ?? '';
        cursor.next();
        break;
      }
      case 'MODULE': {
        module = cursor.next()?.text ?? '';
        const description = cursor.peek();
        if (description?.quoted === true) {
          moduleDescription = description.text;
          cursor.next();
        }
        break;
      }
      case 'MOD_COMMON': {
        const body = collectBlock(cursor, 'MOD_COMMON');
        const orderIndex = body.findIndex((item) => !item.quoted && item.text === 'BYTE_ORDER');
        const value = orderIndex === -1 ? undefined : body[orderIndex + 1]?.text;
        if (value === 'MSB_FIRST' || value === 'MSB_LAST') defaultByteOrder = value;
        break;
      }
      case 'MEASUREMENT': {
        const measurement = parseMeasurement(collectBlock(cursor, 'MEASUREMENT'), issues);
        if (measurement !== null) measurements.push(measurement);
        break;
      }
      case 'CHARACTERISTIC': {
        const characteristic = parseCharacteristic(collectBlock(cursor, 'CHARACTERISTIC'), issues);
        if (characteristic !== null) characteristics.push(characteristic);
        break;
      }
      case 'COMPU_METHOD': {
        const method = parseCompuMethod(collectBlock(cursor, 'COMPU_METHOD'), issues);
        if (method !== null) compuMethods.push(method);
        break;
      }
      case 'COMPU_VTAB': {
        const table = parseVerbalTable(collectBlock(cursor, 'COMPU_VTAB'));
        if (table !== null) verbalTables.push(table);
        break;
      }
      default:
        // Kapsam dışı blok (RECORD_LAYOUT, IF_DATA, FUNCTION…): sessizce
        // atlanır. Sorun listesine yazmak, normal bir dosyayı yüzlerce
        // "uyarı" ile doldurup gerçek sorunları görünmez kılardı.
        cursor.skipBlock(keyword.text);
        break;
    }
  }

  if (measurements.length === 0 && characteristics.length === 0) {
    issues.push({ line: 0, messageKey: 'definition.a2l.issue.noObjects' });
    return { success: false, issues };
  }

  return {
    success: true,
    database: {
      project,
      module,
      moduleDescription,
      defaultByteOrder,
      measurements,
      characteristics,
      compuMethods,
      verbalTables,
    },
    issues,
  };
}

/** Ölçümün dönüşümünü veritabanından çözer; `NO_COMPU_METHOD` durumunda `null`. */
export function findCompuMethod(
  database: A2lDatabase,
  conversion: string,
): A2lCompuMethod | null {
  if (conversion === '') return null;
  return database.compuMethods.find((method) => method.name === conversion) ?? null;
}

export function findVerbalTable(database: A2lDatabase, name: string | undefined): A2lVerbalTable | null {
  if (name === undefined) return null;
  return database.verbalTables.find((table) => table.name === name) ?? null;
}
