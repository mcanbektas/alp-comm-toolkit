/**
 * Hayes komut ailesinin ORİJİNAL TEMEL sözdizimi — ITU-T V.250 §5.3/§5.3.1,
 * `at-commands`in (Faz 10 dalga 9b, `serial/atcommands/atCommands.ts`)
 * ÜSTÜNDE oturur (brief 9b madde 7 mimari kararı: içeriden çağır +
 * zenginleştir, CAN 2.0A/2.0B'nin iki-plugin-tek-parser emsali DEĞİL).
 *
 * ── BİLEŞİM, KOPYALAMA DEĞİL ─────────────────────────────────────────────
 * `hayesCommandSetParser.parse()` önce `atCommandsParser.parse()`i ÇAĞIRIR
 * (satır sınıflandırması, final result code, echo — hepsi ORADA çözülür),
 * sonra yalnız `kind: 'command'` VE gövdesi hâlâ HAM olan (genişletilmiş
 * sözdizimine uymayan — `command-name` alanı YOK) çerçeveleri ZENGİNLEŞTİRİR.
 * `lte-modem-at`in `enrichFrame`iyle AYNI desen, yalnız gate `kind: 'information'`
 * değil `kind: 'command'` (dosya başı ayrımı: at-commands GENİŞLETİLMİŞ
 * sözdizimini adlandırır, temel sözdizimi burada).
 *
 * ── NUMERİK RESULT CODE BU DOSYADA DEĞİL, at-commands'TA ────────────────
 * Spec araştırmasının açık bıraktığı küçük yerleşim sorusu ÇÖZÜLDÜ: ATV0
 * (numeric mode) V.250'nin TEMEL bir özelliği — yalnız Hayes'e değil TÜM AT
 * lehçelerine (lte-modem-at dahil) fayda sağlar, bu yüzden `atCommands.ts`a
 * eklendi (`NUMERIC_RESULT_CODES`). Bu sayfanın "Result Code Mapper" vaadi
 * BİLEŞİM yoluyla karşılanır — hayes hiçbir ek kod yazmadan miras alır,
 * `lte-modem-at`in URC/final-result akışını aynen devretmesiyle AYNI ilke.
 *
 * ── D VE S GRAMERİ BOZAR, A SATIRIN KALANINI YUTAR ───────────────────────
 * V.250 zincirlemeyi (`ATZE0V1` → Z, E0, V1) standart sayar; TEK istisna A
 * (§5.3.1'in kendi örneği, parametresiz, satırın kalanını yutar). D KENDİ
 * sözdizimine sahiptir (`D<dial-string>[;]`) ama YUTMAZ — `;` görülürse
 * komut moduna dönülür ve zincirleme DEVAM EDER (`ATD123;H` gibi gerçek
 * kullanım kalıpları bunu gerektirir). Dial-string'in T/P öneki (ton/puls)
 * endüstri-evrensel bilgi ama BİRİNCİL kaynaktan bu turda doğrulanamadı —
 * bu yüzden ayrıştırılmaz, opak metin olarak taşınır (uydurmaktan iyi).
 *
 * ── DOĞRULANAN vs DOĞRULANMAYAN TEMEL KOMUTLAR ───────────────────────────
 * Yalnız A (answer), H0 (hang up) ve Z (reset, parametresi VENDOR-SPECIFIC —
 * V.250'nin KENDİ ifadesi) `physicalValue` alır. H1 ("off-hook") HİÇBİR
 * kaynakta doğrulanamadı — YAZILMAZ, `WARN_HOOK_PARAMETER_UNDOCUMENTED` ile
 * işaretlenir. Diğer tüm temel komutlar (E, V, Q, X, M, L, O, N, &C/&D/&F/
 * &K/&W …) yalnız YAPISAL taşınır — CME/CMS kod anlamının uydurulmadığı
 * disiplinin aynısı.
 *
 * ── S-REGISTER: SEKİZ DOĞRULANMIŞ + İKİ SATICI-ÖZEL, S5 BİLEREK YOK ──────
 * V.250 Ek I Tablo I.2'nin gerçekten tanımladığı S0/S3/S4/S6/S7/S8/S10 +
 * yalnız u-blox'un belgelediği S2 (kaçış karakteri) ve S12 (guard time, 1
 * birim = 20ms) `KNOWN_S_REGISTERS`te. **S5 V.250'de sayılır ama bu turun
 * spec araştırması anlamını/aralığını doğrulamadı — tabloya BİLEREK
 * eklenmedi**, herhangi bir Sn gibi yalnız yapısal (numara+işlem+değer)
 * kalır. Sn? yanıtı (üç haneli sıfır dolgulu, `"013"`) OTURUM BAĞLAMI
 * olmadan tek satırdan kesin tanınamaz — `lte-modem-at`in CIMI/CGSN çıplak
 * sayı belirsizliğiyle AYNI disiplin: `text` kind'inde aday işaretlenir,
 * kesin denmez.
 *
 * ── "+++" GUARD-TIME: SATICI-TANIMLI, TOPLU (BATCH) ANALİZ ──────────────
 * V.250'de YOK (§3.1.2/§5.8.1 madde 11 online moda dönüşü "manufacturer-
 * defined means"e bırakıyor) — dört satıcı (Quectel/SIMCom/u-blox/Telit)
 * neredeyse birebir aynı ÜÇ eşiği tanımlıyor: ilk `+`ten önce guard time
 * KADAR sessizlik, üç `+` arası guard time'DAN AZ, üçüncü `+`ten sonra guard
 * time KADAR sessizlik. `detectEscapeSequence` bunu CANLI bir modem
 * sürücüsü gibi değil, KAYITLI bir bayt akışını (capture) geriye dönük
 * tarayan saf bir fonksiyon olarak uygular — bu depo bir analiz/çözümleme
 * SPA'sı, modem sürücüsü değil. Varsayılan guard time (1000ms = 50 birim ×
 * 20ms) YALNIZ u-blox'tan doğrulandı; Quectel bunu sabit "1 saniye" diye
 * düzyazıyla yazıp register'ı hiç açığa çıkarmıyor.
 */

import { atCommandsParser } from './atCommands';
import type {
  ExampleFrame,
  ParseContext,
  ParseResult,
  ParsedField,
  ParsedFrame,
  ProtocolParser,
  ProtocolPlugin,
  ProtocolWarning,
} from '@/protocol-core/types';

const PROTOCOL_ID = 'hayes-command-set';
/** Protokol adı veridir, çeviriye girmez (CLAUDE.md). */
const PROTOCOL_DISPLAY_NAME = 'Hayes Command Set';

const TRANSLATION_KEY_PREFIX = 'protocol.hayesCommandSet';

const WARN_HOOK_PARAMETER_UNDOCUMENTED = `${TRANSLATION_KEY_PREFIX}.warning.hookParameterUndocumented`;
const WARN_RESET_PARAMETER_VENDOR_SPECIFIC = `${TRANSLATION_KEY_PREFIX}.warning.resetParameterVendorSpecific`;
const WARN_DIAL_STRING_UNKNOWN_CHAR = `${TRANSLATION_KEY_PREFIX}.warning.dialStringUnknownChar`;
const WARN_S_REGISTER_VENDOR_ONLY = `${TRANSLATION_KEY_PREFIX}.warning.sRegisterVendorOnly`;
const WARN_S_REGISTER_VALUE_OUT_OF_RANGE = `${TRANSLATION_KEY_PREFIX}.warning.sRegisterValueOutOfRange`;
const WARN_UNPARSED_BASIC_SYNTAX = `${TRANSLATION_KEY_PREFIX}.warning.unparsedBasicSyntax`;
const WARN_S_REGISTER_RESPONSE_AMBIGUOUS = `${TRANSLATION_KEY_PREFIX}.warning.sRegisterResponseAmbiguous`;

function toProtocolWarning(code: string): ProtocolWarning {
  return { code, message: code };
}

// ── Temel sözdizimi tokenizer'ı ───────────────────────────────────────────

const DIAL_COMMAND_PATTERN = /^[Dd]/;
/** Register numarası + `?` (oku) ya da `=<değer?>` (yaz) — V.250 §5.3.2. */
const S_REGISTER_PATTERN = /^[Ss](\d+)(\?|=(\d*))/;
const AMPERSAND_COMMAND_PATTERN = /^&[A-Za-z]\d*/;
const PLAIN_COMMAND_PATTERN = /^([A-Za-z])(\d*)/;
/** V.250 §6.3.1.8 çapraz referansı — D'den sonraki dial-string'te geçerli karakterler. */
const DIAL_STRING_CHAR_PATTERN = /^[0-9A-D#*+,"TPW@!]*$/i;

interface KnownSRegister {
  /** Kısa, physicalValue'ya doğrudan taşınan İngilizce açıklama. */
  name: string;
  /** V.250/satıcı doğrulamalı [min, max] — doğrulanmadıysa (S5 gibi) yok. */
  range?: readonly [number, number];
  /** V.250'de YOK, yalnız u-blox belgeliyor (S2/S12). */
  vendorOnly?: true;
  unit?: string;
  /** Ham register değerini fiziksel birime çevirir (ör. S12: birim×20ms). */
  toPhysical?: (raw: number) => number;
}

/**
 * V.250 Ek I Tablo I.2'nin gerçekten tanımladığı yedi register (S0/S3/S4/S6/
 * S7/S8/S10) + yalnız u-blox'un belgelediği S2/S12. **S5 BİLEREK YOK** —
 * V.250 onu da sayıyor ama bu turda anlamı/aralığı doğrulanmadı.
 */
const KNOWN_S_REGISTERS: Readonly<Record<number, KnownSRegister>> = {
  0: { name: 'auto-answer ring count', range: [0, 255] },
  3: { name: 'line termination character (ASCII)', range: [0, 127] },
  4: { name: 'response formatting character (ASCII)', range: [0, 127] },
  6: { name: 'pause before blind dialing', range: [2, 10], unit: 's' },
  7: { name: 'connection completion timeout (V.250 defines no default)', range: [1, 255], unit: 's' },
  8: { name: 'comma dial pause duration', range: [0, 255], unit: 's' },
  10: {
    name: 'automatic disconnect delay (V.250 defines no default)',
    range: [1, 254],
    unit: 's',
    // Register birimi 0.1 sn (V.250'nin kendi tanımı).
    toPhysical: (raw) => raw / 10,
  },
  2: { name: 'escape character (u-blox only, not in V.250)', range: [1, 255], vendorOnly: true },
  12: {
    name: 'escape guard time (u-blox only, not in V.250)',
    range: [0, 255],
    unit: 'ms',
    vendorOnly: true,
    // u-blox: 1 birim = 20ms (§10.19/§15.19).
    toPhysical: (raw) => raw * 20,
  },
};

function decodeDialAtom(
  data: Uint8Array,
  bodyText: string,
  bodyOffset: number,
  cursor: number,
  atomIndex: number,
): { fields: ParsedField[]; consumed: number; chainContinues: boolean } {
  const dOffset = bodyOffset + cursor;
  // `bodyText`ten kesilir (zaten CR/LF arındırılmış) — ham `data`dan kesmek
  // satır sonunu da dial-string'e katardı (satırın en son baytları \r\n).
  const afterD = bodyText.slice(cursor + 1);
  const semicolonIndex = afterD.indexOf(';');
  const dialString = semicolonIndex === -1 ? afterD : afterD.slice(0, semicolonIndex);
  const hasReturn = semicolonIndex !== -1;
  const dialOffset = dOffset + 1;

  const fields: ParsedField[] = [
    {
      id: `dial-${atomIndex}-string`,
      name: 'Dial String',
      offset: dialOffset,
      length: dialString.length,
      rawBytes: data.slice(dialOffset, dialOffset + dialString.length),
      rawValue: dialString,
      valid: true,
      warnings: DIAL_STRING_CHAR_PATTERN.test(dialString) ? [] : [WARN_DIAL_STRING_UNKNOWN_CHAR],
    },
  ];

  if (hasReturn) {
    const returnOffset = dialOffset + dialString.length;
    fields.push({
      id: `dial-${atomIndex}-return-to-command-mode`,
      name: 'Return to Command Mode (;)',
      offset: returnOffset,
      length: 1,
      rawBytes: data.slice(returnOffset, returnOffset + 1),
      rawValue: ';',
      valid: true,
      warnings: [],
    });
    // '1' D'nin kendisi, +dialString.length, +1 noktalı virgül.
    return { fields, consumed: 1 + dialString.length + 1, chainContinues: true };
  }

  // ';' yok — dial-string satırın SONUNA kadar sürer, zincir burada biter.
  return { fields, consumed: afterD.length + 1, chainContinues: false };
}

function decodeSRegisterAtom(
  data: Uint8Array,
  bodyOffset: number,
  cursor: number,
  atomIndex: number,
  match: RegExpExecArray,
): { fields: ParsedField[]; consumed: number } {
  const registerText = match[1] ?? '';
  const registerNumber = Number(registerText);
  const isRead = match[2] === '?';
  const valueText = match[3];
  const knownRegister = KNOWN_S_REGISTERS[registerNumber];

  const numberOffset = bodyOffset + cursor + 1; // 'S'/'s'ten sonra
  const fields: ParsedField[] = [
    {
      id: `s-register-${atomIndex}-number`,
      name: 'S-Register Number',
      offset: numberOffset,
      length: registerText.length,
      rawBytes: data.slice(numberOffset, numberOffset + registerText.length),
      rawValue: registerNumber,
      ...(knownRegister === undefined ? {} : { physicalValue: knownRegister.name }),
      valid: true,
      warnings: knownRegister?.vendorOnly === true ? [WARN_S_REGISTER_VENDOR_ONLY] : [],
    },
  ];

  const operationOffset = numberOffset + registerText.length;
  fields.push({
    id: `s-register-${atomIndex}-operation`,
    name: 'S-Register Operation',
    offset: operationOffset,
    length: 1,
    rawBytes: data.slice(operationOffset, operationOffset + 1),
    rawValue: isRead ? 'read' : 'write',
    valid: true,
    warnings: [],
  });

  if (!isRead) {
    const valueOffset = operationOffset + 1; // '='den sonrası
    const valueLength = valueText?.length ?? 0;
    const value = valueText !== undefined && valueText.length > 0 ? Number(valueText) : undefined;
    const outOfRange =
      value !== undefined &&
      knownRegister?.range !== undefined &&
      (value < knownRegister.range[0] || value > knownRegister.range[1]);
    const physicalValue =
      value !== undefined && knownRegister?.unit !== undefined
        ? (knownRegister.toPhysical === undefined ? value : knownRegister.toPhysical(value))
        : undefined;

    fields.push({
      id: `s-register-${atomIndex}-value`,
      name: 'S-Register Value',
      offset: valueOffset,
      length: valueLength,
      rawBytes: data.slice(valueOffset, valueOffset + valueLength),
      rawValue: value ?? (valueText ?? ''),
      ...(physicalValue === undefined ? {} : { physicalValue, unit: knownRegister?.unit }),
      valid: true,
      warnings: outOfRange === true ? [WARN_S_REGISTER_VALUE_OUT_OF_RANGE] : [],
    });
  }

  return { fields, consumed: match[0].length };
}

function decodeBasicSyntax(data: Uint8Array, bodyText: string, bodyOffset: number): ParsedField[] {
  const fields: ParsedField[] = [];
  let cursor = 0;
  let atomIndex = 0;

  while (cursor < bodyText.length) {
    const remaining = bodyText.slice(cursor);

    if (DIAL_COMMAND_PATTERN.test(remaining)) {
      const dial = decodeDialAtom(data, bodyText, bodyOffset, cursor, atomIndex);
      fields.push(...dial.fields);
      cursor += dial.consumed;
      atomIndex += 1;
      if (!dial.chainContinues) break;
      continue;
    }

    const sMatch = S_REGISTER_PATTERN.exec(remaining);
    if (sMatch !== null) {
      const sRegister = decodeSRegisterAtom(data, bodyOffset, cursor, atomIndex, sMatch);
      fields.push(...sRegister.fields);
      cursor += sRegister.consumed;
      atomIndex += 1;
      continue;
    }

    const ampMatch = AMPERSAND_COMMAND_PATTERN.exec(remaining);
    if (ampMatch !== null) {
      const matchedText = ampMatch[0];
      const offset = bodyOffset + cursor;
      fields.push({
        id: `basic-command-${atomIndex}`,
        name: 'Basic Command',
        offset,
        length: matchedText.length,
        rawBytes: data.slice(offset, offset + matchedText.length),
        rawValue: matchedText,
        valid: true,
        warnings: [],
      });
      cursor += matchedText.length;
      atomIndex += 1;
      continue;
    }

    const plainMatch = PLAIN_COMMAND_PATTERN.exec(remaining);
    if (plainMatch !== null) {
      const matchedText = plainMatch[0];
      const digits = plainMatch[2] ?? '';
      const letterUpper = (plainMatch[1] ?? '').toUpperCase();
      const offset = bodyOffset + cursor;

      if (letterUpper === 'A') {
        // V.250'nin KENDİ örneği (§5.3.1): A parametresiz, satırın KALANINI
        // yutar — zincirlemenin TEK istisnası.
        fields.push({
          id: `basic-command-${atomIndex}`,
          name: 'Basic Command',
          offset,
          length: 1,
          rawBytes: data.slice(offset, offset + 1),
          rawValue: bodyText.slice(cursor, cursor + 1),
          physicalValue: 'answer',
          valid: true,
          warnings: [],
        });
        // Yalnız 'A' tüketildi — kalan (varsa) döngü sonrası unparsed-tail'e
        // düşer, burada YUTULMAZ (aksi halde sessizce kaybolurdu).
        cursor += 1;
        atomIndex += 1;
        break;
      }

      if (letterUpper === 'H') {
        const param = digits.length > 0 ? Number(digits) : undefined;
        const isDocumentedHangUp = param === undefined || param === 0;
        fields.push({
          id: `basic-command-${atomIndex}`,
          name: 'Basic Command',
          offset,
          length: matchedText.length,
          rawBytes: data.slice(offset, offset + matchedText.length),
          rawValue: matchedText,
          ...(isDocumentedHangUp ? { physicalValue: 'hang up' } : {}),
          valid: true,
          warnings: isDocumentedHangUp ? [] : [WARN_HOOK_PARAMETER_UNDOCUMENTED],
        });
        cursor += matchedText.length;
        atomIndex += 1;
        continue;
      }

      if (letterUpper === 'Z') {
        fields.push({
          id: `basic-command-${atomIndex}`,
          name: 'Basic Command',
          offset,
          length: matchedText.length,
          rawBytes: data.slice(offset, offset + matchedText.length),
          rawValue: matchedText,
          physicalValue: 'reset',
          valid: true,
          warnings: [WARN_RESET_PARAMETER_VENDOR_SPECIFIC],
        });
        cursor += matchedText.length;
        atomIndex += 1;
        continue;
      }

      // Doğrulanmamış diğer temel komutlar (E, V, Q, X, M, L, O, N …): yapı
      // taşınır, anlam UYDURULMAZ — CME/CMS kod anlamıyla aynı disiplin.
      fields.push({
        id: `basic-command-${atomIndex}`,
        name: 'Basic Command',
        offset,
        length: matchedText.length,
        rawBytes: data.slice(offset, offset + matchedText.length),
        rawValue: matchedText,
        valid: true,
        warnings: [],
      });
      cursor += matchedText.length;
      atomIndex += 1;
      continue;
    }

    // Hiçbir kalıba uymayan artık karakter — döngü güvenle durur, kalan
    // gövde ayrıştırılmamış (ham) bırakılır, uydurulmaz.
    break;
  }

  if (cursor < bodyText.length) {
    const tailOffset = bodyOffset + cursor;
    const tailText = bodyText.slice(cursor);
    fields.push({
      id: 'unparsed-tail',
      name: 'Unparsed Tail',
      offset: tailOffset,
      length: tailText.length,
      rawBytes: data.slice(tailOffset, tailOffset + tailText.length),
      rawValue: tailText,
      valid: true,
      warnings: [WARN_UNPARSED_BASIC_SYNTAX],
    });
  }

  return fields;
}

// ── S-register okuma yanıtı — oturumsuz belirsizlik (CIMI/CGSN emsali) ────

/** V.250 §5.3.2: Sn? yanıtı her zaman üç haneli sıfır dolgulu ondalık. */
const S_REGISTER_RESPONSE_PATTERN = /^\d{3}$/;

function decodeTextForSRegisterResponse(frame: ParsedFrame, data: Uint8Array): ParsedField[] {
  const textValue = frame.fields.find((field) => field.id === 'text')?.rawValue;
  const text = typeof textValue === 'string' ? textValue : '';
  if (!S_REGISTER_RESPONSE_PATTERN.test(text)) return [];
  return [
    {
      id: 's-register-response-candidate',
      name: 'S-Register Response (candidate)',
      offset: 0,
      length: data.length,
      rawBytes: data,
      rawValue: Number(text),
      valid: true,
      warnings: [WARN_S_REGISTER_RESPONSE_AMBIGUOUS],
    },
  ];
}

// ── Bileşim ────────────────────────────────────────────────────────────

function enrichFrame(frame: ParsedFrame, data: Uint8Array): ParsedFrame {
  const kind = frame.fields.find((field) => field.id === 'kind')?.rawValue;
  let extraFields: ParsedField[] = [];

  if (kind === 'command') {
    const bodyField = frame.fields.find((field) => field.id === 'body');
    const bodyText = typeof bodyField?.rawValue === 'string' ? bodyField.rawValue : '';
    // at-commands zaten genişletilmiş sözdizimini (`+NAME`) çözdüyse
    // (`command-name` alanı VARSA) bu temel sözdizimi DEĞİLDİR, hayes
    // burada TEKRAR ayrıştırmaz.
    const alreadyExtended = frame.fields.some((field) => field.id === 'command-name');
    if (bodyField !== undefined && !alreadyExtended && bodyText.length > 0) {
      extraFields = decodeBasicSyntax(data, bodyText, bodyField.offset);
    }
  } else if (kind === 'text') {
    extraFields = decodeTextForSRegisterResponse(frame, data);
  }

  if (extraFields.length === 0) {
    return { ...frame, protocol: PROTOCOL_ID };
  }

  const derivedWarnings = extraFields.flatMap((field) => field.warnings.map(toProtocolWarning));
  return {
    ...frame,
    protocol: PROTOCOL_ID,
    fields: [...frame.fields, ...extraFields],
    warnings: [...frame.warnings, ...derivedWarnings],
  };
}

export const hayesCommandSetParser: ProtocolParser = {
  protocolId: PROTOCOL_ID,
  displayName: PROTOCOL_DISPLAY_NAME,

  canParse(data: Uint8Array): boolean {
    return atCommandsParser.canParse(data);
  },

  parse(data: Uint8Array, context?: ParseContext): ParseResult {
    const base = atCommandsParser.parse(data, context);
    if (!base.success) return base;
    return { ...base, frame: enrichFrame(base.frame, data) };
  },
};

// ── "+++" Escape Sequence Guard-Time Analyzer ─────────────────────────────

/** u-blox S12 varsayılanı: 50 birim × 20ms/birim = 1000ms (yalnız u-blox belgeliyor). */
export const DEFAULT_ESCAPE_GUARD_TIME_MS = 1000;

export interface TimedByte {
  readonly byte: number;
  readonly timestamp: number;
}

export interface EscapeSequenceDetection {
  readonly detected: boolean;
  /** Üç `+` baytının ilkinin `bytes` içindeki indeksi — yalnız detected=true iken dolu. */
  readonly plusStartIndex?: number;
}

const PLUS_BYTE = 0x2b;

/**
 * `+++` guard-time mekanizması — üç eşiği BAĞIMSIZ sınar (dosya başı):
 * ilk `+`ten önce guard time kadar sessizlik, iki ara boşluk guard time'dan
 * az, üçüncü `+`ten sonra guard time kadar sessizlik. KAYITLI bir bayt
 * akışını (capture) geriye dönük tarar — akış üçüncü `+`ten hemen sonra
 * bitiyorsa (sonraki bayt yok) sonrası sessizlik YETERLİ sayılır.
 */
export function detectEscapeSequence(
  bytes: readonly TimedByte[],
  guardTimeMs: number = DEFAULT_ESCAPE_GUARD_TIME_MS,
): EscapeSequenceDetection {
  for (let i = 0; i + 2 < bytes.length; i += 1) {
    const first = bytes[i];
    const second = bytes[i + 1];
    const third = bytes[i + 2];
    if (first === undefined || second === undefined || third === undefined) continue;
    if (first.byte !== PLUS_BYTE || second.byte !== PLUS_BYTE || third.byte !== PLUS_BYTE) continue;

    const previous = bytes[i - 1];
    const silenceBefore = previous === undefined ? Infinity : first.timestamp - previous.timestamp;
    if (silenceBefore < guardTimeMs) continue;

    const gapOneTwo = second.timestamp - first.timestamp;
    const gapTwoThree = third.timestamp - second.timestamp;
    if (gapOneTwo >= guardTimeMs || gapTwoThree >= guardTimeMs) continue;

    const next = bytes[i + 3];
    const silenceAfter = next === undefined ? Infinity : next.timestamp - third.timestamp;
    if (silenceAfter < guardTimeMs) continue;

    return { detected: true, plusStartIndex: i };
  }
  return { detected: false };
}

// ── Command / Data Mode State View ────────────────────────────────────────

export type HayesSessionMode = 'command' | 'data';

export interface HayesModeTracker {
  readonly mode: HayesSessionMode;
  /** CONNECT final result code (sözel ya da sayısal) data moduna geçirir. */
  ingestFrame(frame: ParsedFrame): void;
  /** Ham bayt penceresi — yalnız data modundayken +++ kaçışını arar. */
  ingestByteWindow(bytes: readonly TimedByte[], guardTimeMs?: number): void;
  reset(): void;
}

function isConnectResult(frame: ParsedFrame): boolean {
  const kind = frame.fields.find((field) => field.id === 'kind')?.rawValue;
  if (kind !== 'final-result-code') return false;
  const resultCode = frame.fields.find((field) => field.id === 'result-code')?.rawValue;
  return resultCode === 'CONNECT' || resultCode === 1;
}

function isDocumentedHangUp(frame: ParsedFrame): boolean {
  const kind = frame.fields.find((field) => field.id === 'kind')?.rawValue;
  if (kind !== 'command') return false;
  return frame.fields.some((field) => field.id.startsWith('basic-command-') && field.physicalValue === 'hang up');
}

/**
 * Command/data mode durumu — `createAtCommandSession`in (at-commands.ts)
 * transaction dizileyicisiyle AYNI desen: parser saf kalır, durum burada
 * DIŞARIDA tutulur. CONNECT → data; guard-time onaylı `+++` ya da belgeli
 * hang-up (H0) → command. `ATO` (online moda dön) bu turda YOK — madde 7
 * kapsamında araştırılmadı, uydurulmadı.
 */
export function createHayesModeTracker(): HayesModeTracker {
  let mode: HayesSessionMode = 'command';

  return {
    get mode() {
      return mode;
    },
    ingestFrame(frame: ParsedFrame): void {
      if (isConnectResult(frame)) {
        mode = 'data';
      } else if (isDocumentedHangUp(frame)) {
        mode = 'command';
      }
    },
    ingestByteWindow(bytes: readonly TimedByte[], guardTimeMs: number = DEFAULT_ESCAPE_GUARD_TIME_MS): void {
      if (mode !== 'data') return;
      if (detectEscapeSequence(bytes, guardTimeMs).detected) {
        mode = 'command';
      }
    },
    reset(): void {
      mode = 'command';
    },
  };
}

// ── Örnekler ───────────────────────────────────────────────────────────

function asciiBytes(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

const EXAMPLE_FRAMES: ExampleFrame[] = [
  {
    id: 'chained-reset-echo-verbose',
    name: `${TRANSLATION_KEY_PREFIX}.example.chainedResetEchoVerbose.name`,
    bytes: asciiBytes('ATZE0V1\r\n'),
    description: `${TRANSLATION_KEY_PREFIX}.example.chainedResetEchoVerbose.description`,
    expectedValid: true,
  },
  {
    id: 'dial-with-return',
    name: `${TRANSLATION_KEY_PREFIX}.example.dialWithReturn.name`,
    bytes: asciiBytes('ATD5551234567;H0\r\n'),
    description: `${TRANSLATION_KEY_PREFIX}.example.dialWithReturn.description`,
    expectedValid: true,
  },
  {
    id: 'dial-tone-prefix-no-return',
    name: `${TRANSLATION_KEY_PREFIX}.example.dialTonePrefixNoReturn.name`,
    bytes: asciiBytes('ATDT5551234567\r\n'),
    description: `${TRANSLATION_KEY_PREFIX}.example.dialTonePrefixNoReturn.description`,
    expectedValid: true,
  },
  {
    id: 'answer',
    name: `${TRANSLATION_KEY_PREFIX}.example.answer.name`,
    bytes: asciiBytes('ATA\r\n'),
    description: `${TRANSLATION_KEY_PREFIX}.example.answer.description`,
    expectedValid: true,
  },
  {
    id: 'hook-hang-up',
    name: `${TRANSLATION_KEY_PREFIX}.example.hookHangUp.name`,
    bytes: asciiBytes('ATH0\r\n'),
    description: `${TRANSLATION_KEY_PREFIX}.example.hookHangUp.description`,
    expectedValid: true,
  },
  {
    id: 'hook-undocumented-param',
    name: `${TRANSLATION_KEY_PREFIX}.example.hookUndocumentedParam.name`,
    bytes: asciiBytes('ATH1\r\n'),
    description: `${TRANSLATION_KEY_PREFIX}.example.hookUndocumentedParam.description`,
    expectedValid: true,
  },
  {
    id: 's-register-write-known',
    name: `${TRANSLATION_KEY_PREFIX}.example.sRegisterWriteKnown.name`,
    bytes: asciiBytes('ATS0=2\r\n'),
    description: `${TRANSLATION_KEY_PREFIX}.example.sRegisterWriteKnown.description`,
    expectedValid: true,
  },
  {
    id: 's-register-read-known',
    name: `${TRANSLATION_KEY_PREFIX}.example.sRegisterReadKnown.name`,
    bytes: asciiBytes('ATS3?\r\n'),
    description: `${TRANSLATION_KEY_PREFIX}.example.sRegisterReadKnown.description`,
    expectedValid: true,
  },
  {
    id: 's-register-write-vendor-only',
    name: `${TRANSLATION_KEY_PREFIX}.example.sRegisterWriteVendorOnly.name`,
    bytes: asciiBytes('ATS12=50\r\n'),
    description: `${TRANSLATION_KEY_PREFIX}.example.sRegisterWriteVendorOnly.description`,
    expectedValid: true,
  },
  {
    id: 's-register-write-out-of-range',
    name: `${TRANSLATION_KEY_PREFIX}.example.sRegisterWriteOutOfRange.name`,
    bytes: asciiBytes('ATS0=300\r\n'),
    description: `${TRANSLATION_KEY_PREFIX}.example.sRegisterWriteOutOfRange.description`,
    expectedValid: true,
  },
  {
    id: 's-register-write-unverified',
    name: `${TRANSLATION_KEY_PREFIX}.example.sRegisterWriteUnverified.name`,
    bytes: asciiBytes('ATS5=8\r\n'),
    description: `${TRANSLATION_KEY_PREFIX}.example.sRegisterWriteUnverified.description`,
    expectedValid: true,
  },
  {
    id: 's-register-response-candidate',
    name: `${TRANSLATION_KEY_PREFIX}.example.sRegisterResponseCandidate.name`,
    bytes: asciiBytes('013\r\n'),
    description: `${TRANSLATION_KEY_PREFIX}.example.sRegisterResponseCandidate.description`,
    expectedValid: true,
  },
  {
    id: 'numeric-result-code',
    name: `${TRANSLATION_KEY_PREFIX}.example.numericResultCode.name`,
    bytes: asciiBytes('0\r\n'),
    description: `${TRANSLATION_KEY_PREFIX}.example.numericResultCode.description`,
    expectedValid: true,
  },
];

export const hayesCommandSetPlugin: ProtocolPlugin = {
  id: PROTOCOL_ID,
  name: PROTOCOL_DISPLAY_NAME,
  category: 'interfaces-framing',
  parser: hayesCommandSetParser,
  documentation: {
    summary: `${TRANSLATION_KEY_PREFIX}.documentation.summary`,
    layer: 'application',
    references: [{ title: 'ITU-T Recommendation V.250', url: 'https://www.itu.int/rec/T-REC-V.250' }],
  },
  exampleFrames: EXAMPLE_FRAMES,
};
