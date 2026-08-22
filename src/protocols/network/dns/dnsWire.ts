/**
 * DNS tel biçimi (RFC 1035) — `dns.ts` VE `mdns.ts` bunu PAYLAŞIR. mDNS
 * "DNS message structure ile UDP multicast üzerinden çalışır" (spec
 * 08-ag-ethernet.md:715) — bu, LLDP/DHCP'nin TLV başlıklarının bit
 * düzeyinde FARKLI olduğu 12b'deki durumun TAM TERSİ: burada iki protokol
 * gerçekten AYNI teli okur, paylaşılan motor doğru soyutlama.
 *
 * ── İSİM SIKIŞTIRMASI, DÖNGÜ KORUMALI ────────────────────────────────────
 * Bir pointer (`0xC0` üst iki bit) hedef offset'i ziyaret edilenler kümesine
 * eklenir; aynı offset ikinci kez hedeflenirse `looped:true` döner ve
 * çözümleme DURUR — spec'in açık uyarısı ("A→B→A parser'ı kilitlememeli",
 * spec:306). Etiket sayısı da `MAX_LABELS` ile sınırlanır (ipv6.ts'teki
 * `MAX_EXTENSION_HEADERS` emsali).
 *
 * ── mDNS'E ÖZGÜ TEK FARK: CLASS ALANININ ÜST BİTİ (RFC 6762) ────────────────
 * Soru bölümünde üst bit "unicast-response tercihi" (§5.4), kayıt
 * bölümlerinde "cache flush" (§10.2) anlamına gelir — DNS'te bu bit
 * ANLAMSIZDIR, ham CLASS değerinin parçasıdır. `variant:'mdns'` bu tek
 * farkı devreye sokar, geri kalan HER ŞEY birebir aynı kod yolundan geçer.
 *
 * ── DESTEKLENEN RR TİPLERİ DAR TUTULDU (spec:301) ────────────────────────
 * A, AAAA, CNAME, PTR, MX, TXT, SRV, NS, SOA — spec'in "Desteklenen tipler"
 * listesiyle birebir. Kümenin dışındaki bir TYPE adlandırılmaz, RDATA ham
 * bırakılır (ipv4.ts'teki "tanınmayan protokol" deseninin aynısı).
 */

import { createRawFrame } from '@/protocol-core/types';
import type {
  FrameDirection,
  ParseContext,
  ParseResult,
  ParsedField,
  ParsedFrame,
  ProtocolError,
  ProtocolWarning,
} from '@/protocol-core/types';

const HEADER_LENGTH = 12;

const ID_OFFSET = 0;
const FLAGS_OFFSET = 2;
const QDCOUNT_OFFSET = 4;
const ANCOUNT_OFFSET = 6;
const NSCOUNT_OFFSET = 8;
const ARCOUNT_OFFSET = 10;

const WORD_LENGTH = 2;
const DOUBLE_WORD_LENGTH = 4;

const CLASS_TOP_BIT = 0x8000;
const CLASS_VALUE_MASK = 0x7fff;

const MAX_LABELS = 128;
/** Gerçekçi DNS/mDNS mesajları onlarca kaydı geçmez; bu bir üst güvenlik
 * tavanı (ipv6.ts'teki MAX_EXTENSION_HEADERS emsali), gerçek trafiği sınırlamaz. */
const MAX_RECORDS_PER_SECTION = 64;

const RR_TYPE_A = 1;
const RR_TYPE_NS = 2;
const RR_TYPE_CNAME = 5;
const RR_TYPE_SOA = 6;
const RR_TYPE_PTR = 12;
const RR_TYPE_MX = 15;
const RR_TYPE_TXT = 16;
const RR_TYPE_AAAA = 28;
const RR_TYPE_SRV = 33;

/** Spec'in dar tuttuğu dokuz RR tipi (dosya başı). */
const TYPE_NAMES: ReadonlyMap<number, string> = new Map([
  [RR_TYPE_A, 'A'],
  [RR_TYPE_NS, 'NS'],
  [RR_TYPE_CNAME, 'CNAME'],
  [RR_TYPE_SOA, 'SOA'],
  [RR_TYPE_PTR, 'PTR'],
  [RR_TYPE_MX, 'MX'],
  [RR_TYPE_TXT, 'TXT'],
  [RR_TYPE_AAAA, 'AAAA'],
  [RR_TYPE_SRV, 'SRV'],
]);

const CLASS_NAMES: ReadonlyMap<number, string> = new Map([[1, 'IN']]);

/** RFC 1035 §4.1.1 — dar tutulan Opcode kümesi. */
const OPCODE_NAMES: ReadonlyMap<number, string> = new Map([
  [0, 'QUERY'],
  [1, 'IQUERY'],
  [2, 'STATUS'],
]);

/** Spec'in dar tuttuğu RCODE kümesi (spec:309). */
const RCODE_NAMES: ReadonlyMap<number, string> = new Map([
  [0, 'NOERROR'],
  [1, 'FORMERR'],
  [2, 'SERVFAIL'],
  [3, 'NXDOMAIN'],
  [4, 'NOTIMP'],
  [5, 'REFUSED'],
]);

export const ERROR_FRAME_TOO_SHORT = 'protocol.dnsWire.error.frameTooShort';
export const ERROR_FRAME_TOO_LONG = 'protocol.dnsWire.error.frameTooLong';
export const ERROR_ABORTED = 'protocol.dnsWire.error.aborted';
export const ERROR_NAME_TRUNCATED = 'protocol.dnsWire.error.nameTruncated';
export const ERROR_NAME_LOOP = 'protocol.dnsWire.error.nameLoop';
export const ERROR_RECORD_TRUNCATED = 'protocol.dnsWire.error.recordTruncated';

export const WARN_UNKNOWN_TYPE = 'protocol.dnsWire.warning.unknownType';
export const WARN_UNKNOWN_CLASS = 'protocol.dnsWire.warning.unknownClass';
export const WARN_TOO_MANY_RECORDS = 'protocol.dnsWire.warning.tooManyRecords';

function toProtocolWarning(key: string): ProtocolWarning {
  return { code: key, message: key };
}

/** noUncheckedIndexedAccess: bayt dizisi erişimi her yerde bu guard'dan geçer. */
function byteAt(data: Uint8Array, offset: number): number {
  return data[offset] ?? 0;
}

function readUint16BE(data: Uint8Array, offset: number): number {
  return (byteAt(data, offset) << 8) | byteAt(data, offset + 1);
}

function readUint32BE(data: Uint8Array, offset: number): number {
  return (
    byteAt(data, offset) * 0x1000000 +
    (byteAt(data, offset + 1) << 16) +
    (byteAt(data, offset + 2) << 8) +
    byteAt(data, offset + 3)
  );
}

function formatIpv4Address(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => String(byte)).join('.');
}

function formatIpv6Address(bytes: Uint8Array): string {
  const groups: string[] = [];
  for (let offset = 0; offset < bytes.length; offset += 2) {
    groups.push(((byteAt(bytes, offset) << 8) | byteAt(bytes, offset + 1)).toString(16));
  }
  return groups.join(':');
}

const UTF8_DECODER = new TextDecoder('utf-8');

interface DomainNameResult {
  readonly name: string;
  /** Bu isim tel üzerinde nerede biter — pointer'a sıçrandıysa sıçramadan
   * HEMEN SONRASI (dosya başı), aksi hâlde sonlandırıcı sıfır bayttan sonrası. */
  readonly nextOffset: number;
  readonly truncated: boolean;
  readonly looped: boolean;
}

/**
 * RFC 1035 §4.1.4 — etiket dizisi + pointer sıkıştırması. `message` HER ZAMAN
 * mesajın TAMAMIdır (pointer offset'leri mesaj başına göredir), `offset` ise
 * bu ismin başladığı konum.
 */
function readDomainName(message: Uint8Array, offset: number): DomainNameResult {
  const labels: string[] = [];
  const visitedPointers = new Set<number>();
  let cursor = offset;
  let firstJumpConsumedEnd: number | undefined;
  let truncated = false;
  let looped = false;

  while (true) {
    if (labels.length > MAX_LABELS) {
      truncated = true;
      break;
    }
    if (cursor >= message.length) {
      truncated = true;
      break;
    }
    const lengthByte = byteAt(message, cursor);
    if (lengthByte === 0) {
      cursor += 1;
      break;
    }
    if ((lengthByte & 0xc0) === 0xc0) {
      if (cursor + 1 >= message.length) {
        truncated = true;
        break;
      }
      const pointerOffset = ((lengthByte & 0x3f) << 8) | byteAt(message, cursor + 1);
      firstJumpConsumedEnd ??= cursor + 2;
      if (visitedPointers.has(pointerOffset)) {
        looped = true;
        break;
      }
      visitedPointers.add(pointerOffset);
      cursor = pointerOffset;
      continue;
    }
    // Sıradan etiket: uzunluk(1B) + o kadar bayt metin (üst iki bit 00 — pointer değil).
    if (cursor + 1 + lengthByte > message.length) {
      truncated = true;
      break;
    }
    labels.push(UTF8_DECODER.decode(message.slice(cursor + 1, cursor + 1 + lengthByte)));
    cursor += 1 + lengthByte;
  }

  return {
    name: labels.length === 0 ? '.' : labels.join('.'),
    nextOffset: firstJumpConsumedEnd ?? cursor,
    truncated,
    looped,
  };
}

/** RDATA'nın kendi içindeki bir domain adı (MX/SRV/SOA alt alanları) — pointer
 * hedefleri yine MESAJ BAŞINA göredir, RDATA'nın kendisine göre DEĞİL. */
function readNameField(
  fields: ParsedField[],
  message: Uint8Array,
  offset: number,
  id: string,
  name: string,
): { nextOffset: number; ok: boolean; looped: boolean } {
  const result = readDomainName(message, offset);
  fields.push({
    id,
    name,
    offset,
    length: result.nextOffset - offset,
    rawBytes: message.slice(offset, result.nextOffset),
    ...(result.truncated || result.looped ? {} : { rawValue: result.name }),
    valid: !result.truncated && !result.looped,
    warnings: [],
  });
  return { nextOffset: result.nextOffset, ok: !result.truncated && !result.looped, looped: result.looped };
}

interface DnsWireOptions {
  protocolId: string;
  variant: 'dns' | 'mdns';
  timestamp?: number;
  direction?: FrameDirection;
  channel?: string;
  maxFrameLength?: number;
  signal?: AbortSignal;
}

function pushClassField(
  fields: ParsedField[],
  warnings: ProtocolWarning[],
  message: Uint8Array,
  offset: number,
  id: string,
  name: string,
  variant: 'dns' | 'mdns',
  topBitFieldId: string,
  topBitFieldName: string,
): void {
  const rawClass = readUint16BE(message, offset);
  const classValue = variant === 'mdns' ? rawClass & CLASS_VALUE_MASK : rawClass;
  const className = CLASS_NAMES.get(classValue);
  fields.push({
    id,
    name,
    offset,
    length: WORD_LENGTH,
    rawBytes: message.slice(offset, offset + WORD_LENGTH),
    rawValue: classValue,
    valid: className !== undefined,
    warnings: className === undefined ? [WARN_UNKNOWN_CLASS] : [],
    ...(className === undefined ? {} : { physicalValue: className }),
  });
  if (className === undefined) warnings.push(toProtocolWarning(WARN_UNKNOWN_CLASS));
  if (variant === 'mdns') {
    fields.push({
      id: topBitFieldId,
      name: topBitFieldName,
      offset,
      length: WORD_LENGTH,
      rawBytes: message.slice(offset, offset + WORD_LENGTH),
      rawValue: (rawClass & CLASS_TOP_BIT) === 0 ? 0 : 1,
      valid: true,
      warnings: [],
    });
  }
}

function pushTypeField(
  fields: ParsedField[],
  warnings: ProtocolWarning[],
  message: Uint8Array,
  offset: number,
  id: string,
  name: string,
): number {
  const typeValue = readUint16BE(message, offset);
  const typeName = TYPE_NAMES.get(typeValue);
  fields.push({
    id,
    name,
    offset,
    length: WORD_LENGTH,
    rawBytes: message.slice(offset, offset + WORD_LENGTH),
    rawValue: typeValue,
    valid: typeName !== undefined,
    warnings: typeName === undefined ? [WARN_UNKNOWN_TYPE] : [],
    ...(typeName === undefined ? {} : { physicalValue: typeName }),
  });
  if (typeName === undefined) warnings.push(toProtocolWarning(WARN_UNKNOWN_TYPE));
  return typeValue;
}

/** RDATA'yı TYPE'a göre alt alanlara ayırır; dar kümenin dışındaki tipler ham bırakılır. */
function pushRdataFields(
  fields: ParsedField[],
  message: Uint8Array,
  typeValue: number,
  rdataOffset: number,
  rdata: Uint8Array,
  idPrefix: string,
): void {
  if (typeValue === RR_TYPE_A && rdata.length === 4) {
    fields.push({
      id: `${idPrefix}-rdata`,
      name: 'RDATA (Address)',
      offset: rdataOffset,
      length: 4,
      rawBytes: rdata,
      rawValue: formatIpv4Address(rdata),
      valid: true,
      warnings: [],
    });
  } else if (typeValue === RR_TYPE_AAAA && rdata.length === 16) {
    fields.push({
      id: `${idPrefix}-rdata`,
      name: 'RDATA (Address)',
      offset: rdataOffset,
      length: 16,
      rawBytes: rdata,
      rawValue: formatIpv6Address(rdata),
      valid: true,
      warnings: [],
    });
  } else if (
    typeValue === RR_TYPE_CNAME ||
    typeValue === RR_TYPE_PTR ||
    typeValue === RR_TYPE_NS
  ) {
    readNameField(fields, message, rdataOffset, `${idPrefix}-rdata`, 'RDATA (Name)');
  } else if (typeValue === RR_TYPE_TXT) {
    const strings: string[] = [];
    let cursor = 0;
    while (cursor < rdata.length) {
      const length = byteAt(rdata, cursor);
      strings.push(UTF8_DECODER.decode(rdata.slice(cursor + 1, cursor + 1 + length)));
      cursor += 1 + length;
    }
    fields.push({
      id: `${idPrefix}-rdata`,
      name: 'RDATA (TXT)',
      offset: rdataOffset,
      length: rdata.length,
      rawBytes: rdata,
      rawValue: strings.join(' | '),
      valid: true,
      warnings: [],
    });
  } else if (typeValue === RR_TYPE_MX && rdata.length >= 2) {
    fields.push({
      id: `${idPrefix}-rdata-preference`,
      name: 'RDATA Preference',
      offset: rdataOffset,
      length: WORD_LENGTH,
      rawBytes: rdata.slice(0, 2),
      rawValue: readUint16BE(rdata, 0),
      valid: true,
      warnings: [],
    });
    readNameField(fields, message, rdataOffset + 2, `${idPrefix}-rdata-exchange`, 'RDATA Exchange');
  } else if (typeValue === RR_TYPE_SRV && rdata.length >= 6) {
    fields.push({
      id: `${idPrefix}-rdata-priority`,
      name: 'RDATA Priority',
      offset: rdataOffset,
      length: WORD_LENGTH,
      rawBytes: rdata.slice(0, 2),
      rawValue: readUint16BE(rdata, 0),
      valid: true,
      warnings: [],
    });
    fields.push({
      id: `${idPrefix}-rdata-weight`,
      name: 'RDATA Weight',
      offset: rdataOffset + 2,
      length: WORD_LENGTH,
      rawBytes: rdata.slice(2, 4),
      rawValue: readUint16BE(rdata, 2),
      valid: true,
      warnings: [],
    });
    fields.push({
      id: `${idPrefix}-rdata-port`,
      name: 'RDATA Port',
      offset: rdataOffset + 4,
      length: WORD_LENGTH,
      rawBytes: rdata.slice(4, 6),
      rawValue: readUint16BE(rdata, 4),
      valid: true,
      warnings: [],
    });
    readNameField(fields, message, rdataOffset + 6, `${idPrefix}-rdata-target`, 'RDATA Target');
  } else if (typeValue === RR_TYPE_SOA) {
    const mnameResult = readNameField(fields, message, rdataOffset, `${idPrefix}-rdata-mname`, 'RDATA MNAME');
    if (mnameResult.ok) {
      const rnameResult = readNameField(
        fields,
        message,
        mnameResult.nextOffset,
        `${idPrefix}-rdata-rname`,
        'RDATA RNAME',
      );
      if (rnameResult.ok) {
        const numbers: readonly [string, string][] = [
          ['serial', 'RDATA Serial'],
          ['refresh', 'RDATA Refresh'],
          ['retry', 'RDATA Retry'],
          ['expire', 'RDATA Expire'],
          ['minimum', 'RDATA Minimum'],
        ];
        let cursor = rnameResult.nextOffset;
        for (const [key, label] of numbers) {
          fields.push({
            id: `${idPrefix}-rdata-${key}`,
            name: label,
            offset: cursor,
            length: DOUBLE_WORD_LENGTH,
            rawBytes: message.slice(cursor, cursor + DOUBLE_WORD_LENGTH),
            rawValue: readUint32BE(message, cursor),
            ...(key === 'refresh' || key === 'retry' || key === 'expire' || key === 'minimum'
              ? { unit: 's' }
              : {}),
            valid: true,
            warnings: [],
          });
          cursor += DOUBLE_WORD_LENGTH;
        }
      }
    }
  } else if (rdata.length > 0) {
    fields.push({
      id: `${idPrefix}-rdata`,
      name: 'RDATA',
      offset: rdataOffset,
      length: rdata.length,
      rawBytes: rdata,
      unit: 'B',
      valid: true,
      warnings: [],
    });
  }
}

/** Question bölümünün tek girdisi: QNAME+QTYPE+QCLASS. `undefined` döner ise
 * çağıran döngüyü kesmelidir (isim/tampon kesikliği). */
function pushQuestion(
  fields: ParsedField[],
  errors: ProtocolError[],
  warnings: ProtocolWarning[],
  message: Uint8Array,
  offset: number,
  index: number,
  variant: 'dns' | 'mdns',
): number | undefined {
  const idPrefix = `question-${String(index)}`;
  const nameResult = readNameField(fields, message, offset, `${idPrefix}-name`, 'QNAME');
  if (!nameResult.ok) {
    errors.push({
      code: 'truncated-frame',
      message: nameResult.looped ? ERROR_NAME_LOOP : ERROR_NAME_TRUNCATED,
      offset,
      length: message.length - offset,
      details: { section: 'question', index },
    });
    return undefined;
  }
  let cursor = nameResult.nextOffset;
  if (cursor + 2 * WORD_LENGTH > message.length) {
    errors.push({
      code: 'truncated-frame',
      message: ERROR_RECORD_TRUNCATED,
      offset: cursor,
      length: message.length - cursor,
      details: { section: 'question', index, reason: 'qtype-qclass' },
    });
    return undefined;
  }
  pushTypeField(fields, warnings, message, cursor, `${idPrefix}-type`, 'QTYPE');
  cursor += WORD_LENGTH;
  pushClassField(
    fields,
    warnings,
    message,
    cursor,
    `${idPrefix}-class`,
    'QCLASS',
    variant,
    `${idPrefix}-unicast-response`,
    'Unicast Response Requested',
  );
  cursor += WORD_LENGTH;
  return cursor;
}

/** Answer/Authority/Additional bölümlerinin ortak kayıt biçimi. */
function pushResourceRecord(
  fields: ParsedField[],
  errors: ProtocolError[],
  warnings: ProtocolWarning[],
  message: Uint8Array,
  offset: number,
  section: 'answer' | 'authority' | 'additional',
  index: number,
  variant: 'dns' | 'mdns',
): number | undefined {
  const idPrefix = `${section}-${String(index)}`;
  const nameResult = readNameField(fields, message, offset, `${idPrefix}-name`, 'NAME');
  if (!nameResult.ok) {
    errors.push({
      code: 'truncated-frame',
      message: nameResult.looped ? ERROR_NAME_LOOP : ERROR_NAME_TRUNCATED,
      offset,
      length: message.length - offset,
      details: { section, index },
    });
    return undefined;
  }
  let cursor = nameResult.nextOffset;
  const fixedTail = WORD_LENGTH * 2 + DOUBLE_WORD_LENGTH + WORD_LENGTH; // TYPE+CLASS+TTL+RDLENGTH
  if (cursor + fixedTail > message.length) {
    errors.push({
      code: 'truncated-frame',
      message: ERROR_RECORD_TRUNCATED,
      offset: cursor,
      length: message.length - cursor,
      details: { section, index, reason: 'fixed-tail' },
    });
    return undefined;
  }

  const typeValue = pushTypeField(fields, warnings, message, cursor, `${idPrefix}-type`, 'TYPE');
  cursor += WORD_LENGTH;
  pushClassField(
    fields,
    warnings,
    message,
    cursor,
    `${idPrefix}-class`,
    'CLASS',
    variant,
    `${idPrefix}-cache-flush`,
    'Cache Flush',
  );
  cursor += WORD_LENGTH;

  fields.push({
    id: `${idPrefix}-ttl`,
    name: 'TTL',
    offset: cursor,
    length: DOUBLE_WORD_LENGTH,
    rawBytes: message.slice(cursor, cursor + DOUBLE_WORD_LENGTH),
    rawValue: readUint32BE(message, cursor),
    unit: 's',
    valid: true,
    warnings: [],
  });
  cursor += DOUBLE_WORD_LENGTH;

  const rdLength = readUint16BE(message, cursor);
  fields.push({
    id: `${idPrefix}-rdlength`,
    name: 'RDLENGTH',
    offset: cursor,
    length: WORD_LENGTH,
    rawBytes: message.slice(cursor, cursor + WORD_LENGTH),
    rawValue: rdLength,
    unit: 'B',
    valid: true,
    warnings: [],
  });
  cursor += WORD_LENGTH;

  if (cursor + rdLength > message.length) {
    errors.push({
      code: 'truncated-frame',
      message: ERROR_RECORD_TRUNCATED,
      offset: cursor,
      length: cursor + rdLength - message.length,
      details: { section, index, reason: 'rdata' },
    });
    return undefined;
  }
  const rdata = message.slice(cursor, cursor + rdLength);
  pushRdataFields(fields, message, typeValue, cursor, rdata, idPrefix);
  cursor += rdLength;

  return cursor;
}

export function parseDnsMessage(data: Uint8Array, options: DnsWireOptions): ParseResult {
  if (options.signal?.aborted === true) {
    // İptal beklenen bir sonuçtur, hata değil (spec §41).
    return {
      success: false,
      error: { code: 'parser-timeout', message: ERROR_ABORTED },
      consumedBytes: 0,
      recoverable: false,
    };
  }

  if (data.length < HEADER_LENGTH) {
    return {
      success: false,
      error: {
        code: 'truncated-frame',
        message: ERROR_FRAME_TOO_SHORT,
        offset: 0,
        length: data.length,
      },
      consumedBytes: 0,
      recoverable: true,
    };
  }

  const maxFrameLength = options.maxFrameLength;
  if (maxFrameLength !== undefined && data.length > maxFrameLength) {
    return {
      success: false,
      error: {
        code: 'frame-too-long',
        message: ERROR_FRAME_TOO_LONG,
        offset: maxFrameLength,
        length: data.length - maxFrameLength,
        details: { maxFrameLength, frameLength: data.length },
      },
      consumedBytes: 0,
      recoverable: false,
    };
  }

  const fields: ParsedField[] = [];
  const warnings: ProtocolWarning[] = [];
  const errors: ProtocolError[] = [];

  fields.push({
    id: 'id',
    name: 'ID',
    offset: ID_OFFSET,
    length: WORD_LENGTH,
    rawBytes: data.slice(ID_OFFSET, ID_OFFSET + WORD_LENGTH),
    rawValue: readUint16BE(data, ID_OFFSET),
    valid: true,
    warnings: [],
  });

  const flags = readUint16BE(data, FLAGS_OFFSET);
  const qr = (flags >>> 15) & 0x1;
  const opcode = (flags >>> 11) & 0xf;
  const aa = (flags >>> 10) & 0x1;
  const tc = (flags >>> 9) & 0x1;
  const rd = (flags >>> 8) & 0x1;
  const ra = (flags >>> 7) & 0x1;
  const z = (flags >>> 4) & 0x7;
  const rcode = flags & 0xf;
  const opcodeName = OPCODE_NAMES.get(opcode);
  const rcodeName = RCODE_NAMES.get(rcode);
  const flagsBytes = data.slice(FLAGS_OFFSET, FLAGS_OFFSET + WORD_LENGTH);
  fields.push({
    id: 'flags-qr',
    name: 'QR',
    offset: FLAGS_OFFSET,
    length: WORD_LENGTH,
    rawBytes: flagsBytes,
    rawValue: qr,
    physicalValue: qr === 1 ? 'Response' : 'Query',
    valid: true,
    warnings: [],
  });
  fields.push({
    id: 'flags-opcode',
    name: 'Opcode',
    offset: FLAGS_OFFSET,
    length: WORD_LENGTH,
    rawBytes: flagsBytes,
    rawValue: opcode,
    valid: true,
    warnings: [],
    ...(opcodeName === undefined ? {} : { physicalValue: opcodeName }),
  });
  fields.push({
    id: 'flags-aa',
    name: 'AA',
    offset: FLAGS_OFFSET,
    length: WORD_LENGTH,
    rawBytes: flagsBytes,
    rawValue: aa,
    valid: true,
    warnings: [],
  });
  fields.push({
    id: 'flags-tc',
    name: 'TC',
    offset: FLAGS_OFFSET,
    length: WORD_LENGTH,
    rawBytes: flagsBytes,
    rawValue: tc,
    valid: true,
    warnings: [],
  });
  fields.push({
    id: 'flags-rd',
    name: 'RD',
    offset: FLAGS_OFFSET,
    length: WORD_LENGTH,
    rawBytes: flagsBytes,
    rawValue: rd,
    valid: true,
    warnings: [],
  });
  fields.push({
    id: 'flags-ra',
    name: 'RA',
    offset: FLAGS_OFFSET,
    length: WORD_LENGTH,
    rawBytes: flagsBytes,
    rawValue: ra,
    valid: true,
    warnings: [],
  });
  fields.push({
    id: 'flags-z',
    name: 'Z (Reserved)',
    offset: FLAGS_OFFSET,
    length: WORD_LENGTH,
    rawBytes: flagsBytes,
    rawValue: z,
    valid: true,
    warnings: [],
  });
  fields.push({
    id: 'flags-rcode',
    name: 'RCODE',
    offset: FLAGS_OFFSET,
    length: WORD_LENGTH,
    rawBytes: flagsBytes,
    rawValue: rcode,
    valid: true,
    warnings: [],
    ...(rcodeName === undefined ? {} : { physicalValue: rcodeName }),
  });

  const questionCount = readUint16BE(data, QDCOUNT_OFFSET);
  const answerCount = readUint16BE(data, ANCOUNT_OFFSET);
  const authorityCount = readUint16BE(data, NSCOUNT_OFFSET);
  const additionalCount = readUint16BE(data, ARCOUNT_OFFSET);
  fields.push({
    id: 'question-count',
    name: 'QDCOUNT',
    offset: QDCOUNT_OFFSET,
    length: WORD_LENGTH,
    rawBytes: data.slice(QDCOUNT_OFFSET, QDCOUNT_OFFSET + WORD_LENGTH),
    rawValue: questionCount,
    valid: true,
    warnings: [],
  });
  fields.push({
    id: 'answer-count',
    name: 'ANCOUNT',
    offset: ANCOUNT_OFFSET,
    length: WORD_LENGTH,
    rawBytes: data.slice(ANCOUNT_OFFSET, ANCOUNT_OFFSET + WORD_LENGTH),
    rawValue: answerCount,
    valid: true,
    warnings: [],
  });
  fields.push({
    id: 'authority-count',
    name: 'NSCOUNT',
    offset: NSCOUNT_OFFSET,
    length: WORD_LENGTH,
    rawBytes: data.slice(NSCOUNT_OFFSET, NSCOUNT_OFFSET + WORD_LENGTH),
    rawValue: authorityCount,
    valid: true,
    warnings: [],
  });
  fields.push({
    id: 'additional-count',
    name: 'ARCOUNT',
    offset: ARCOUNT_OFFSET,
    length: WORD_LENGTH,
    rawBytes: data.slice(ARCOUNT_OFFSET, ARCOUNT_OFFSET + WORD_LENGTH),
    rawValue: additionalCount,
    valid: true,
    warnings: [],
  });

  let cursor = HEADER_LENGTH;
  let stopped = false;

  const cappedQuestionCount = Math.min(questionCount, MAX_RECORDS_PER_SECTION);
  if (questionCount > MAX_RECORDS_PER_SECTION) warnings.push(toProtocolWarning(WARN_TOO_MANY_RECORDS));
  for (let index = 1; !stopped && index <= cappedQuestionCount; index += 1) {
    const next = pushQuestion(fields, errors, warnings, data, cursor, index, options.variant);
    if (next === undefined) {
      stopped = true;
      break;
    }
    cursor = next;
  }

  const sections: readonly ['answer' | 'authority' | 'additional', number][] = [
    ['answer', answerCount],
    ['authority', authorityCount],
    ['additional', additionalCount],
  ];
  for (const [section, count] of sections) {
    if (stopped) break;
    const capped = Math.min(count, MAX_RECORDS_PER_SECTION);
    if (count > MAX_RECORDS_PER_SECTION) warnings.push(toProtocolWarning(WARN_TOO_MANY_RECORDS));
    for (let index = 1; !stopped && index <= capped; index += 1) {
      const next = pushResourceRecord(fields, errors, warnings, data, cursor, section, index, options.variant);
      if (next === undefined) {
        stopped = true;
        break;
      }
      cursor = next;
    }
  }

  const rawFrame = createRawFrame(data, {
    ...(options.timestamp === undefined ? {} : { timestamp: options.timestamp }),
    ...(options.direction === undefined ? {} : { direction: options.direction }),
    ...(options.channel === undefined ? {} : { channel: options.channel }),
  });

  const frame: ParsedFrame = {
    protocol: options.protocolId,
    timestamp: rawFrame.timestamp,
    rawFrame,
    fields,
    valid: errors.length === 0,
    errors,
    warnings,
  };

  return { success: true, frame, consumedBytes: data.length };
}

export function readDnsWireContextOptions(
  protocolId: string,
  variant: 'dns' | 'mdns',
  context: ParseContext | undefined,
): DnsWireOptions {
  const options: DnsWireOptions = { protocolId, variant };
  if (context?.timestamp !== undefined) options.timestamp = context.timestamp;
  if (context?.direction !== undefined) options.direction = context.direction;
  if (context?.channel !== undefined) options.channel = context.channel;
  if (context?.maxFrameLength !== undefined) options.maxFrameLength = context.maxFrameLength;
  if (context?.signal !== undefined) options.signal = context.signal;
  return options;
}

/**
 * Örnek/test çerçeveleri için tel biçimi kurucusu. `dns.ts`, `mdns.ts` ve
 * bu ikisinin test dosyaları PAYLAŞIR — el ile bayt dizisi kurmak isim
 * sıkıştırmasında (offset aritmetiği) hataya çok açık.
 */
export type DnsNameSpec = { readonly labels: readonly string[] } | { readonly pointerTo: number };

export interface DnsQuestionSpec {
  readonly name: DnsNameSpec;
  readonly type: number;
  readonly class: number;
}

export interface DnsRecordSpec {
  readonly name: DnsNameSpec;
  readonly type: number;
  readonly class: number;
  readonly ttl: number;
  readonly rdata: readonly number[];
}

export interface DnsMessageSpec {
  readonly id: number;
  readonly flags: number;
  readonly questions?: readonly DnsQuestionSpec[];
  readonly answers?: readonly DnsRecordSpec[];
  readonly authority?: readonly DnsRecordSpec[];
  readonly additional?: readonly DnsRecordSpec[];
}

export function encodeDomainName(labels: readonly string[]): number[] {
  const bytes: number[] = [];
  for (const label of labels) {
    const encoded = Array.from(new TextEncoder().encode(label));
    bytes.push(encoded.length, ...encoded);
  }
  bytes.push(0);
  return bytes;
}

function encodeNameSpec(spec: DnsNameSpec): number[] {
  if ('pointerTo' in spec) {
    return [0xc0 | ((spec.pointerTo >>> 8) & 0x3f), spec.pointerTo & 0xff];
  }
  return encodeDomainName(spec.labels);
}

export function buildDnsMessage(spec: DnsMessageSpec): Uint8Array {
  const questions = spec.questions ?? [];
  const answers = spec.answers ?? [];
  const authority = spec.authority ?? [];
  const additional = spec.additional ?? [];

  const bytes: number[] = [
    (spec.id >>> 8) & 0xff,
    spec.id & 0xff,
    (spec.flags >>> 8) & 0xff,
    spec.flags & 0xff,
    (questions.length >>> 8) & 0xff,
    questions.length & 0xff,
    (answers.length >>> 8) & 0xff,
    answers.length & 0xff,
    (authority.length >>> 8) & 0xff,
    authority.length & 0xff,
    (additional.length >>> 8) & 0xff,
    additional.length & 0xff,
  ];

  for (const question of questions) {
    bytes.push(
      ...encodeNameSpec(question.name),
      (question.type >>> 8) & 0xff,
      question.type & 0xff,
      (question.class >>> 8) & 0xff,
      question.class & 0xff,
    );
  }

  for (const section of [answers, authority, additional]) {
    for (const record of section) {
      bytes.push(
        ...encodeNameSpec(record.name),
        (record.type >>> 8) & 0xff,
        record.type & 0xff,
        (record.class >>> 8) & 0xff,
        record.class & 0xff,
        (record.ttl >>> 24) & 0xff,
        (record.ttl >>> 16) & 0xff,
        (record.ttl >>> 8) & 0xff,
        record.ttl & 0xff,
        (record.rdata.length >>> 8) & 0xff,
        record.rdata.length & 0xff,
        ...record.rdata,
      );
    }
  }

  return Uint8Array.from(bytes);
}
