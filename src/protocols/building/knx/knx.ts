/**
 * KNX (KNX Standard / ISO 22510 ailesi) — TP1 (Twisted Pair 1) STANDART L_Data
 * telegramı çözümü. `src/protocols/building/` ailesinin lisanslı standarda
 * geçen İKİNCİ motoru (brief-faz10-dalga6.md, 6e; 6d/dali.ts ile AYNI disiplin:
 * resmi metin satın alınmaz, bağımsız kamuya açık kaynaklardan ÇAPRAZ TEYİTLE
 * alınır, kod kopyalanmaz — yalnız format/sabit bilgisi).
 *
 * ── KAYNAK UYARISI (Karar 2, brief-faz10-dalga6.md) ─────────────────────────
 * KNX Standard'ın (KNX Association) ve ISO 22510'un resmi metni KAYIT ŞARTLI/
 * ÜCRETLİdir ve bu depoda YOK. Aşağıdaki bit alanları, adres bölünmeleri, APCI
 * değerleri ve checksum formülü DÖRT bağımsız kamuya açık kaynaktan ÇAPRAZ
 * TEYİTLE alındı (2026-08-18 taranarak); dördü de AYNI bit konumlarında AYNI
 * formülde birleşiyor — hiçbir alan tek kaynaktan gelmedi:
 *
 *   1. Calimero (calimero-project/calimero-core, GPLv2+linking-exception —
 *      yalnız format/sabit bilgisi referans alındı, KOD KOPYALANMADI; dali.ts'in
 *      python-dali/LGPL emsaliyle AYNI disiplin):
 *      - `src/io/calimero/link/medium/RawFrameBase.java` (`init()`): Control
 *        Field doğrulama deseni `(ctrl & 0x53) != 0x10`; Frame Type
 *        `ext = (ctrl & 0x80) == 0`; Repeat `repetition = (ctrl & 0x20) == 0`;
 *        Priority `Priority.get((ctrl >> 2) & 0x3)`; NPCI'de AT/HopCount/Length
 *        `(npci & 0x80)` / `(npci & 0x70) >> 4` / `(npci & 0x0f)`.
 *      - `src/io/calimero/link/medium/TP1LData.java`: `tpdu = new byte[len+1]`
 *        — NPCI Length alanının OFF-BY-ONE'ı (gerçek TPCI/APCI+data bayt sayısı
 *        = Length + 1); checksum tek bayt, tpdu'dan SONRA okunur.
 *      - `src/io/calimero/DataUnitBuilder.java` (`getAPDUService`, `decodeTPCI`):
 *        TPCI/APCI'nin 2 bayta bölünme deseni — 4-bit APCI kodu
 *        `(apdu[0]&0x03)<<2 | (apdu[1]&0xC0)>>6`; TPCI'nin `(ctrl&0xFC)==0`
 *        iken group/individual/broadcast ayrımı yapmadığı (T-veri hepsi 0).
 *      - `src/io/calimero/Priority.java`: 2 bitlik öncelik değerlerinin (0-3)
 *        sırası — isimler farklı ama BİT DEĞERİ sırası XKNX/franckmarini ile
 *        birebir örtüşüyor.
 *      https://github.com/calimero-project/calimero-core
 *
 *   2. XKNX (XKNX/xknx, MIT — yalnız format/sabit bilgisi):
 *      - `xknx/telegram/address.py`: Individual Address `(raw>>12)&MAX_AREA`
 *        (MAX_AREA=15) + orta 4 bit (<<8, MAX_MAIN=15) + alt 8 bit
 *        (MAX_LINE=255) = 4+4+8; Group Address (3-level)
 *        `(main<<11)+(middle<<8)+sub` (MAX_MAIN=31/5bit, MAX_MIDDLE=7/3bit,
 *        MAX_SUB_LONG=255/8bit) = 5+3+8.
 *      - `xknx/telegram/apci.py`: `APCIService.GROUP_READ=0x0000`,
 *        `GROUP_RESPONSE=0x0040`, `GROUP_WRITE=0x0080`; `encode_cmd_and_payload`
 *        bit paketleme formülü (1. bayt = TPCI|cmd>>8, 2. bayt =
 *        cmd&0xFF | 6-bit inline veri).
 *      - `xknx/telegram/tpci.py`: `TDataGroup`/`TDataIndividual` ikisi de
 *        `control=False, numbered=False` → TPCI baytı 0x00 (AT'ten bağımsız,
 *        yani hedef individual de olsa group da olsa normal veri iletiminde
 *        TPCI aynı kalır).
 *      https://github.com/XKNX/xknx
 *
 *   3. franckmarini/KnxDevice (Arduino, açık kaynak — üçüncü bağımsız çapraz
 *      teyit): `KnxTelegram.h` — Control Field
 *      (`CONTROL_FIELD_STANDARD_FRAME_FORMAT=B10000000`,
 *      `CONTROL_FIELD_REPEATED_MASK=B00100000`,
 *      `CONTROL_FIELD_PRIORITY_MASK=B00001100`) ve Routing/NPCI
 *      (`ROUTING_FIELD_TARGET_ADDRESS_TYPE_MASK=B10000000`,
 *      `ROUTING_FIELD_COUNTER_MASK=B01110000`,
 *      `ROUTING_FIELD_PAYLOAD_LENGTH_MASK=B00001111`) maskeleri Calimero'yla
 *      BİT BİT örtüşüyor. `KNX_TELEGRAM_MIN_SIZE=9` / `KNX_TELEGRAM_MAX_SIZE=23`
 *      bu dosyadaki sabitlerle (6+2..16+1) birebir eşleşiyor — dosyadaki örnek
 *      çerçevelerin kontrol/routing baytları bu kütüphanenin kendi
 *      `CONTROL_FIELD_DEFAULT_VALUE=0xBC` ve `ROUTING_FIELD_DEFAULT_VALUE=0xE1`
 *      sabitleriyle bağımsızca örtüşerek doğrulandı (bkz. knx.test.ts).
 *      https://github.com/franckmarini/KnxDevice/blob/master/KnxTelegram.h
 *
 *   4. KNX Association'ın kamuya açık destek makaleleri (support.knx.org —
 *      "Checksum", "Address Type, Hop Count and Length", "Individual
 *      Addresses", "Group Address & Ranges", "Telegram types"): checksumun
 *      "NOT XOR, diğer adıyla horizontal parity check" olduğunu VE NPCI Length
 *      alanının Payload'daki "extra octets" (yani +1) sayısını verdiğini
 *      doğruluyor — Calimero/franckmarini'nin kod seviyesi teyidiyle birebir
 *      örtüşüyor.
 *
 * ── GİRDİ: TP1 STANDART L_Data, ham bayt dizisi ─────────────────────────────
 * (lin.ts/dali.ts'in "fiziksel katman kodlaması decoder'a girmez" emsali.) TP1
 * fiziksel katmanda bit-genişliği kodlamalı, iki telli bir bus sinyalidir; bu
 * kodlama HİÇBİR TP1 alıcısında uygulamaya "bayt" olarak sızmaz — decoder
 * bunu hiç görmez, girdi doğrudan çözülmüş bayt dizisidir.
 *
 * ── KAPSAM (Karar 5) ─────────────────────────────────────────────────────────
 * YALNIZ TP1 STANDART L_Data telegramı. KNXnet/IP HİÇ YAPILMAZ (spec'te hiç
 * geçmiyor — ozet07 satır 130 — katalogda kaydı yok, bu dalganın işi değil).
 * Extended frame (Control Field bit7=0): TANI konur (Control Field yine
 * çözülür — Repeat/Priority bit konumu Standard'la AYNI; Calimero'nun
 * `init()`inde bu üç satır ext/standard dallanmasından ÖNCE koşar) ama gövde
 * çözülmez, ham blok + uyarı — hata değil, bilinçli kapsam sınırı. ETS import/
 * definitions sekmesi bu dalgada YOK (katalogda zaten `custom-schema` planned,
 * dokunulmadı).
 *
 * ── DPT UYDURMA YASAK (katalog `building-automation/knx/knx` üstündeki yorum,
 * building-automation.ts:106-108 + ozet07:132) ────────────────────────────────
 * Payload DPT (Datapoint Type) bilinmeden HAM kalır: `00 64` için doğru çıktı
 * "raw uint16: 100, DPT unknown" — asla tahmini bir mühendislik değeri (örn.
 * "23.4°C") değil. ETS group-address projesi/DPT ataması bu motora hiç
 * girmiyor (definitions sekmesi planned kalır).
 *
 * ── AT BİTİ HEDEF ADRES GÖSTERİMİNİ DEĞİŞTİRİR (tuzak) ──────────────────────
 * Destination Address'in AT=0 (Individual, `X.Y.Z`) / AT=1 (Group, `X/Y/Z`)
 * bit'i Control Field'da DEĞİL NPCI baytındadır (Calimero `RawFrameBase.init()`:
 * `setDestination(addr, (npci & 0x80) != 0)`). İki adres sınıfı AYRI formatter
 * fonksiyonuyla (`formatIndividualAddress`/`formatGroupAddress`) basılır; tek
 * ortak formatter YAZILMAZ.
 *
 * ── ÇEKSUM: TERSLENMİŞ (INVERTED/ODD-PARITY) XOR ────────────────────────────
 * KNX Association'ın "Checksum" makalesi + Calimero/franckmarini'nin kod
 * yapısı: checksum, Control Field'dan son TPCI/APCI+data baytına kadar TÜM
 * baytların XOR'unun BİT BİT TERSİDİR ("NOT XOR", horizontal parity check).
 * `xor8Checksum` SONUCU DOĞRUDAN karşılaştırılamaz — tersle
 * (`(~xor8Checksum(bytes)) & 0xFF`); motordan bağımsız ikinci hesap
 * knx.test.ts'te kanıtlanır (UBX 3c emsali).
 */

import { xor8Checksum } from '@/protocol-core/checksums/simpleChecksums';
import { readBitsAsNumber } from '@/protocol-core/decoding/bitCursor';
import { createRawFrame } from '@/protocol-core/types';
import type {
  ExampleFrame,
  FrameDirection,
  ParseContext,
  ParseResult,
  ParsedField,
  ParsedFrame,
  ProtocolError,
  ProtocolParser,
  ProtocolPlugin,
  ProtocolWarning,
} from '@/protocol-core/types';

const PROTOCOL_ID = 'knx';
/** Protokol adı veridir, çeviriye girmez (CLAUDE.md). */
const PROTOCOL_DISPLAY_NAME = 'KNX';

const HEX_RADIX = 16;

/** Control(1) + Source(2) + Destination(2) + NPCI(1) — Standard L_Data başlığı. */
const HEADER_SIZE = 6;
const NPCI_BYTE_OFFSET = 5;
const APDU_OFFSET = HEADER_SIZE;
const CHECKSUM_LENGTH = 1;
/** Yalnız Control Field okunabilsin diye — asıl uzunluk denetimi frame türüne göre ilerler. */
const MIN_FRAME_LENGTH = 1;
/** TPCI/APCI HER ZAMAN en az 2 bayttır (dosya başı, Calimero+XKNX teyitli). */
const MIN_APDU_LENGTH = 2;
/** NPCI Length alanı 4 bit → azami APDU 15+1=16 bayt (franckmarini KNX_TELEGRAM_PAYLOAD_MAX_SIZE). */
const MAX_APDU_LENGTH = 16;
/** 6 (header) + 16 (azami APDU) + 1 (checksum) — franckmarini KNX_TELEGRAM_MAX_SIZE=23 ile birebir. */
const DEFAULT_MAX_FRAME_LENGTH = HEADER_SIZE + MAX_APDU_LENGTH + CHECKSUM_LENGTH;

/** Control Field mutlak bit konumları (msb-first — bitCursor varsayılanı, bit0=bayt0'ın MSB'i). */
const CTRL_FRAME_TYPE_BIT = 0; // bit7: Standard=1 / Extended=0 (Calimero: ext=(ctrl&0x80)==0)
const CTRL_REPEAT_BIT = 2; // bit5: Calimero repetition=(ctrl&0x20)==0 → 0=repeated,1=not-repeated
const CTRL_PRIORITY_BIT = 4; // bits3-2, 2 bit (Calimero: (ctrl>>2)&0x3)

/**
 * Control Field'ın sabit/reserved bitleri — Calimero `RawFrameBase.init()`:
 * `(ctrl & 0x53) != 0x10` geçersiz sayar (bit6=0, bit4=1, bit1=0, bit0=0
 * beklenir; bit7 kasten maskenin DIŞINDA, Standard/Extended ikisinde de aynı
 * sabit desen geçerli). Uymazsa hata değil UYARI — çerçeve yine çözülür.
 */
const RESERVED_PATTERN_MASK = 0x53;
const RESERVED_PATTERN_VALUE = 0x10;

const ERROR_FRAME_TOO_SHORT = 'protocol.knx.error.frameTooShort';
const ERROR_FRAME_TOO_LONG = 'protocol.knx.error.frameTooLong';
const ERROR_ABORTED = 'protocol.knx.error.aborted';
const ERROR_CHECKSUM_MISMATCH = 'protocol.knx.error.checksumMismatch';

const WARN_EXTENDED_FRAME_OUT_OF_SCOPE = 'protocol.knx.warning.extendedFrameOutOfScope';
const WARN_UNRECOGNIZED_APCI = 'protocol.knx.warning.unrecognizedApci';
const WARN_UNEXPECTED_RESERVED_BITS = 'protocol.knx.warning.unexpectedReservedBits';

const SUMMARY_NAMED_SERVICE = 'protocol.knx.summary.namedService';
const SUMMARY_UNRECOGNIZED_APCI = 'protocol.knx.summary.unrecognizedApci';
const SUMMARY_EXTENDED_FRAME = 'protocol.knx.summary.extendedFrame';

type KnxFrameKind = 'standard' | 'extended';

export type KnxFrameMetadata = {
  frameKind: KnxFrameKind;
  summaryKey: string;
  summaryParams: Record<string, string>;
};

function toProtocolWarning(key: string, offset?: number, length?: number): ProtocolWarning {
  const warning: ProtocolWarning = { code: key, message: key };
  if (offset !== undefined) warning.offset = offset;
  if (length !== undefined) warning.length = length;
  return warning;
}

/** noUncheckedIndexedAccess: bayt dizisi erişimi her yerde bu guard'dan geçer. */
function byteAt(data: Uint8Array, offset: number): number {
  return data[offset] ?? 0;
}

function formatHexByte(value: number): string {
  return `0x${value.toString(HEX_RADIX).toUpperCase().padStart(2, '0')}`;
}

function readUint16BE(data: Uint8Array, offset: number): number {
  // KNX telegramları big-endian'dır (dosya başı — franckmarini yorumu: "High byte placed before Low Byte").
  return (byteAt(data, offset) << 8) | byteAt(data, offset + 1);
}

const INDIVIDUAL_AREA_SHIFT = 12;
const INDIVIDUAL_AREA_MASK = 0xf;
const INDIVIDUAL_LINE_SHIFT = 8;
const INDIVIDUAL_LINE_MASK = 0xf;
const INDIVIDUAL_DEVICE_MASK = 0xff;

/** Individual Address: Area(4bit).Line(4bit).Device(8bit) — dosya başı XKNX/Calimero teyidi. */
function formatIndividualAddress(raw: number): string {
  const area = (raw >>> INDIVIDUAL_AREA_SHIFT) & INDIVIDUAL_AREA_MASK;
  const line = (raw >>> INDIVIDUAL_LINE_SHIFT) & INDIVIDUAL_LINE_MASK;
  const device = raw & INDIVIDUAL_DEVICE_MASK;
  return `${String(area)}.${String(line)}.${String(device)}`;
}

const GROUP_MAIN_SHIFT = 11;
const GROUP_MAIN_MASK = 0x1f;
const GROUP_MIDDLE_SHIFT = 8;
const GROUP_MIDDLE_MASK = 0x7;
const GROUP_SUB_MASK = 0xff;
/** ozet07: "Group Address 16 bit genişliğindedir; 0 değeri system broadcast için ayrılmıştır." */
const SYSTEM_BROADCAST_RAW = 0;

/** Group Address (3-level): Main(5bit)/Middle(3bit)/Sub(8bit) — dosya başı XKNX teyidi. */
function formatGroupAddress(raw: number): string {
  const main = (raw >>> GROUP_MAIN_SHIFT) & GROUP_MAIN_MASK;
  const middle = (raw >>> GROUP_MIDDLE_SHIFT) & GROUP_MIDDLE_MASK;
  const sub = raw & GROUP_SUB_MASK;
  const label = `${String(main)}/${String(middle)}/${String(sub)}`;
  return raw === SYSTEM_BROADCAST_RAW ? `${label} (System Broadcast)` : label;
}

/**
 * AT bitine göre iki AYRI formatter — dosya başı tuzak notu: tek ortak
 * formatter yazılmaz, Group `a/b/c` ile Individual `a.b.c` karışmaz.
 */
function formatDestinationAddress(raw: number, addressTypeBit: number): string {
  return addressTypeBit === 1 ? formatGroupAddress(raw) : formatIndividualAddress(raw);
}

/** KNX Association "NOT XOR" / Calimero-franckmarini kod yapısı — dosya başı checksum notu. */
const CHECKSUM_BYTE_MASK = 0xff;
function computeKnxChecksum(bytes: Uint8Array): number {
  // `xor8Checksum` üstüne ince bir tersleme katmanı — fonksiyonun kendisi değiştirilmez.
  return (~xor8Checksum(bytes)) & CHECKSUM_BYTE_MASK;
}

/** Dar ad kümesi (brief madde 6, spec 22636-22660 vurgusu): SADECE bu üç APCI adlandırılır. */
function apciServiceName(code4bit: number): string | undefined {
  switch (code4bit) {
    case 0:
      return 'GroupValueRead';
    case 1:
      return 'GroupValueResponse';
    case 2:
      return 'GroupValueWrite';
    default:
      return undefined;
  }
}

function widthLabel(byteLength: number): string {
  switch (byteLength) {
    case 1:
      return 'uint8';
    case 2:
      return 'uint16';
    case 3:
      return 'uint24';
    case 4:
      return 'uint32';
    default:
      return `${String(byteLength)}-byte`;
  }
}

/** Katalog yorumunun (building-automation.ts:106-108) tonu birebir: DPT yok → anlam UYDURULMAZ. */
function formatUnknownDptLabel(widthText: string, value: number | bigint): string {
  return `raw ${widthText}: ${String(value)} (DPT unknown, engineering meaning not resolved)`;
}

function readUnsignedBigEndianBigInt(bytes: Uint8Array): bigint {
  let value = 0n;
  for (const byte of bytes) {
    value = (value << 8n) | BigInt(byte);
  }
  return value;
}

/**
 * Payload alanı — DPT bilinmeden HAM. İki biçimi var: kısa değer (<=6 bit)
 * APCI'nin 2. baytının alt 6 bitinde İNLİNE taşınır (ayrı bayt YOK); uzun
 * değer APCI'den SONRA ayrı baytlarda (appended) gelir. İkisi de aynı
 * "DPT unknown" dürüstlük tonuyla gösterilir.
 */
function buildPayloadField(data: Uint8Array, apduLength: number, inlineValue: number): ParsedField {
  if (apduLength <= MIN_APDU_LENGTH) {
    const offset = APDU_OFFSET + 1;
    return {
      id: 'payload',
      name: 'Payload',
      offset,
      length: 1,
      rawBytes: data.slice(offset, offset + 1),
      rawValue: inlineValue,
      physicalValue: formatUnknownDptLabel('6-bit', inlineValue),
      valid: true,
      warnings: [],
    };
  }
  const offset = APDU_OFFSET + MIN_APDU_LENGTH;
  const length = apduLength - MIN_APDU_LENGTH;
  const payloadBytes = data.slice(offset, offset + length);
  const value = readUnsignedBigEndianBigInt(payloadBytes);
  return {
    id: 'payload',
    name: 'Payload',
    offset,
    length,
    rawBytes: payloadBytes,
    rawValue: value,
    physicalValue: formatUnknownDptLabel(widthLabel(length), value),
    valid: true,
    warnings: [],
  };
}

interface KnxParseOptions {
  timestamp?: number;
  direction?: FrameDirection;
  channel?: string;
  maxFrameLength?: number;
  signal?: AbortSignal;
}

function parseKnxFrame(data: Uint8Array, options: KnxParseOptions): ParseResult {
  if (options.signal?.aborted === true) {
    return {
      success: false,
      error: { code: 'parser-timeout', message: ERROR_ABORTED },
      consumedBytes: 0,
      recoverable: false,
    };
  }

  if (data.length < MIN_FRAME_LENGTH) {
    return {
      success: false,
      error: { code: 'truncated-frame', message: ERROR_FRAME_TOO_SHORT, offset: 0, length: data.length },
      consumedBytes: 0,
      recoverable: true,
    };
  }

  const maxFrameLength = options.maxFrameLength ?? DEFAULT_MAX_FRAME_LENGTH;
  if (data.length > maxFrameLength) {
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

  const controlByte = byteAt(data, 0);
  const frameTypeBit = readBitsAsNumber(data, CTRL_FRAME_TYPE_BIT, 1);
  const isStandard = frameTypeBit === 1;
  const repeatBit = readBitsAsNumber(data, CTRL_REPEAT_BIT, 1);
  const priorityBits = readBitsAsNumber(data, CTRL_PRIORITY_BIT, 2);

  fields.push({
    id: 'frameType',
    name: 'Frame Type',
    offset: 0,
    length: 1,
    rawBytes: data.slice(0, 1),
    rawValue: frameTypeBit,
    physicalValue: isStandard ? 'Standard' : 'Extended',
    valid: true,
    warnings: [],
  });
  fields.push({
    id: 'repeat',
    name: 'Repeat',
    offset: 0,
    length: 1,
    rawBytes: data.slice(0, 1),
    rawValue: repeatBit,
    physicalValue: repeatBit === 1 ? 'Not Repeated' : 'Repeated',
    valid: true,
    warnings: [],
  });
  fields.push({
    id: 'priority',
    name: 'Priority',
    offset: 0,
    length: 1,
    rawBytes: data.slice(0, 1),
    rawValue: priorityBits,
    physicalValue: priorityName(priorityBits),
    valid: true,
    warnings: [],
  });

  if ((controlByte & RESERVED_PATTERN_MASK) !== RESERVED_PATTERN_VALUE) {
    warnings.push(toProtocolWarning(WARN_UNEXPECTED_RESERVED_BITS, 0, 1));
  }

  if (!isStandard) {
    // Karar 5: Extended frame kapsam dışı — Control Field yine çözüldü (yukarıda),
    // gövde ÇÖZÜLMEZ, ham blok + uyarı. Hata değil, bilinçli kapsam sınırı.
    const body = data.slice(1);
    fields.push({
      id: 'extendedBody',
      name: 'Extended Frame Body',
      offset: 1,
      length: body.length,
      rawBytes: body,
      valid: true,
      warnings: [WARN_EXTENDED_FRAME_OUT_OF_SCOPE],
    });
    warnings.push(toProtocolWarning(WARN_EXTENDED_FRAME_OUT_OF_SCOPE, 1, body.length));

    const metadata: KnxFrameMetadata = {
      frameKind: 'extended',
      summaryKey: SUMMARY_EXTENDED_FRAME,
      summaryParams: {},
    };
    const rawFrame = createRawFrame(data, {
      ...(options.timestamp === undefined ? {} : { timestamp: options.timestamp }),
      ...(options.direction === undefined ? {} : { direction: options.direction }),
      ...(options.channel === undefined ? {} : { channel: options.channel }),
      metadata,
    });
    const frame: ParsedFrame = {
      protocol: PROTOCOL_ID,
      timestamp: rawFrame.timestamp,
      rawFrame,
      fields,
      valid: errors.length === 0,
      errors,
      warnings,
    };
    return { success: true, frame, consumedBytes: data.length };
  }

  // ── Standard L_Data — tam çözüm ────────────────────────────────────────
  if (data.length < HEADER_SIZE) {
    return {
      success: false,
      error: { code: 'truncated-frame', message: ERROR_FRAME_TOO_SHORT, offset: 0, length: data.length },
      consumedBytes: 0,
      recoverable: true,
    };
  }

  const sourceRaw = readUint16BE(data, 1);
  const destinationRaw = readUint16BE(data, 3);

  const addressTypeBit = readBitsAsNumber(data, NPCI_BYTE_OFFSET * 8, 1);
  const hopCount = readBitsAsNumber(data, NPCI_BYTE_OFFSET * 8 + 1, 3);
  const npciLength = readBitsAsNumber(data, NPCI_BYTE_OFFSET * 8 + 4, 4);
  // OFF-BY-ONE (dosya başı): gerçek TPCI/APCI+data bayt sayısı = NPCI.Length + 1.
  const apduLength = npciLength + 1;

  const requiredLength = HEADER_SIZE + apduLength + CHECKSUM_LENGTH;
  if (data.length < requiredLength) {
    return {
      success: false,
      error: {
        code: 'truncated-frame',
        message: ERROR_FRAME_TOO_SHORT,
        offset: HEADER_SIZE,
        length: data.length - HEADER_SIZE,
        details: { declaredApduLength: apduLength, requiredLength },
      },
      consumedBytes: 0,
      recoverable: true,
    };
  }

  const destinationLabel = formatDestinationAddress(destinationRaw, addressTypeBit);

  fields.push({
    id: 'sourceAddress',
    name: 'Source Address',
    offset: 1,
    length: 2,
    rawBytes: data.slice(1, 3),
    rawValue: sourceRaw,
    // Source her zaman Individual'dır (KNX değişmezi) — dosya başı adres notu.
    physicalValue: formatIndividualAddress(sourceRaw),
    valid: true,
    warnings: [],
  });
  fields.push({
    id: 'destinationAddress',
    name: 'Destination Address',
    offset: 3,
    length: 2,
    rawBytes: data.slice(3, 5),
    rawValue: destinationRaw,
    physicalValue: destinationLabel,
    valid: true,
    warnings: [],
  });
  fields.push({
    id: 'addressType',
    name: 'Address Type (AT)',
    offset: NPCI_BYTE_OFFSET,
    length: 1,
    rawBytes: data.slice(NPCI_BYTE_OFFSET, NPCI_BYTE_OFFSET + 1),
    rawValue: addressTypeBit,
    physicalValue: addressTypeBit === 1 ? 'Group' : 'Individual',
    valid: true,
    warnings: [],
  });
  fields.push({
    id: 'hopCount',
    name: 'Hop Count',
    offset: NPCI_BYTE_OFFSET,
    length: 1,
    rawBytes: data.slice(NPCI_BYTE_OFFSET, NPCI_BYTE_OFFSET + 1),
    rawValue: hopCount,
    valid: true,
    warnings: [],
  });
  fields.push({
    id: 'length',
    name: 'Length',
    offset: NPCI_BYTE_OFFSET,
    length: 1,
    rawBytes: data.slice(NPCI_BYTE_OFFSET, NPCI_BYTE_OFFSET + 1),
    rawValue: npciLength,
    physicalValue: `${String(apduLength)} bytes (TPCI/APCI + data)`,
    valid: true,
    warnings: [],
  });

  let apciName: string | undefined;

  if (apduLength < MIN_APDU_LENGTH) {
    // Yapısal asgarinin (TPCI/APCI her zaman >=2 bayt) altında bir Length —
    // bozuk/sentetik girdi. APCI/Payload çözülmez, ham + uyarı (hata değil).
    const apduBytes = data.slice(APDU_OFFSET, APDU_OFFSET + apduLength);
    fields.push({
      id: 'apciService',
      name: 'APCI Service',
      offset: APDU_OFFSET,
      length: apduLength,
      rawBytes: apduBytes,
      valid: false,
      warnings: [WARN_UNRECOGNIZED_APCI],
    });
    warnings.push(toProtocolWarning(WARN_UNRECOGNIZED_APCI, APDU_OFFSET, apduLength));
  } else {
    const tpciBits = readBitsAsNumber(data, APDU_OFFSET * 8, 2);
    const apciHighBits = readBitsAsNumber(data, APDU_OFFSET * 8 + 6, 2);
    const apciLowBits = readBitsAsNumber(data, APDU_OFFSET * 8 + 8, 2);
    const inlineData = readBitsAsNumber(data, APDU_OFFSET * 8 + 10, 6);
    const apci4bit = (apciHighBits << 2) | apciLowBits;
    // TPCI, group-value iletiminde her zaman 0'dır (dosya başı — XKNX
    // TDataGroup/TDataIndividual ikisi de control=false,numbered=false).
    // Sıfır değilse (bağlantı-yönelimli T_Connect/T_Ack/... servisi) bu
    // dalganın dar kümesi dışıdır — ham + uyarı.
    apciName = tpciBits === 0 ? apciServiceName(apci4bit) : undefined;

    const apciField: ParsedField = {
      id: 'apciService',
      name: 'APCI Service',
      offset: APDU_OFFSET,
      length: 2,
      rawBytes: data.slice(APDU_OFFSET, APDU_OFFSET + 2),
      rawValue: apci4bit,
      valid: apciName !== undefined,
      warnings: [],
    };
    if (apciName !== undefined) {
      apciField.physicalValue = apciName;
    } else {
      apciField.warnings.push(WARN_UNRECOGNIZED_APCI);
      warnings.push(toProtocolWarning(WARN_UNRECOGNIZED_APCI, APDU_OFFSET, 2));
    }
    fields.push(apciField);
    fields.push(buildPayloadField(data, apduLength, inlineData));
  }

  const checksumOffset = HEADER_SIZE + apduLength;
  const receivedChecksum = byteAt(data, checksumOffset);
  const calculatedChecksum = computeKnxChecksum(data.slice(0, checksumOffset));
  const checksumValid = receivedChecksum === calculatedChecksum;
  fields.push({
    id: 'checksum',
    name: 'Checksum',
    offset: checksumOffset,
    length: CHECKSUM_LENGTH,
    rawBytes: data.slice(checksumOffset, checksumOffset + CHECKSUM_LENGTH),
    rawValue: receivedChecksum,
    // Spec'in checksum görünümü alınan ve hesaplanan değeri YAN YANA ister (nmea0183.ts emsali).
    physicalValue: formatHexByte(calculatedChecksum),
    valid: checksumValid,
    warnings: [],
  });
  if (!checksumValid) {
    errors.push({
      code: 'checksum-mismatch',
      message: ERROR_CHECKSUM_MISMATCH,
      offset: checksumOffset,
      length: CHECKSUM_LENGTH,
      details: { received: receivedChecksum, calculated: calculatedChecksum },
    });
  }

  const summaryParams: Record<string, string> = { destination: destinationLabel };
  const metadata: KnxFrameMetadata =
    apciName !== undefined
      ? {
          frameKind: 'standard',
          summaryKey: SUMMARY_NAMED_SERVICE,
          summaryParams: { ...summaryParams, apci: apciName },
        }
      : { frameKind: 'standard', summaryKey: SUMMARY_UNRECOGNIZED_APCI, summaryParams };

  const rawFrame = createRawFrame(data, {
    ...(options.timestamp === undefined ? {} : { timestamp: options.timestamp }),
    ...(options.direction === undefined ? {} : { direction: options.direction }),
    ...(options.channel === undefined ? {} : { channel: options.channel }),
    metadata,
  });

  const frame: ParsedFrame = {
    protocol: PROTOCOL_ID,
    timestamp: rawFrame.timestamp,
    rawFrame,
    fields,
    valid: errors.length === 0,
    errors,
    warnings,
  };

  return { success: true, frame, consumedBytes: requiredLength };
}

/** Dar ad kümesi (brief madde 12): System/Alarm/High/Low — dosya başı Calimero+franckmarini teyidi. */
function priorityName(bits: number): string {
  switch (bits) {
    case 0:
      return 'System';
    case 1:
      return 'High';
    case 2:
      return 'Alarm';
    default:
      return 'Low';
  }
}

export function parseKnx(data: Uint8Array): ParseResult {
  return parseKnxFrame(data, {});
}

export const knxParser: ProtocolParser = {
  protocolId: PROTOCOL_ID,
  displayName: PROTOCOL_DISPLAY_NAME,

  /**
   * Ucuz ön eleme — yalnız uzunluk penceresi (dali.ts'in aynı gerekçesi: KNX'in
   * güvenilir bir magic baytı yok, Control Field'ın sabit-bit deseni tek
   * başına auto-detection'a bahse değecek kadar güçlü değil).
   */
  canParse(data: Uint8Array): boolean {
    return data.length >= MIN_FRAME_LENGTH && data.length <= DEFAULT_MAX_FRAME_LENGTH;
  },

  parse(data: Uint8Array, context?: ParseContext): ParseResult {
    const options: KnxParseOptions = {};
    if (context?.timestamp !== undefined) options.timestamp = context.timestamp;
    if (context?.direction !== undefined) options.direction = context.direction;
    if (context?.channel !== undefined) options.channel = context.channel;
    if (context?.maxFrameLength !== undefined) options.maxFrameLength = context.maxFrameLength;
    if (context?.signal !== undefined) options.signal = context.signal;
    return parseKnxFrame(data, options);
  },
};

/**
 * Örnek çerçeveler. §43'te KNX için fixture YOK (lisanslı standart, dosya
 * başı); baytlar gerçek motorla (adres/APCI/checksum formülleriyle)
 * hesaplandı, uydurulmadı — checksum'lar `xor8Checksum` + tersleme ile
 * bağımsızca hesaplanıp knx.test.ts'te motordan bağımsız ikinci kez
 * kanıtlanıyor (UBX 3c emsali). Brief madde 14 altı senaryoyu (+ bir bonus
 * "unrecognized APCI" örneği) kapsar; Priority dört değeri örnekler arasında
 * DAĞITILARAK (System/High/Alarm/Low) her birine ayrı örnek harcanmadan
 * gösterilir.
 */
const EXAMPLE_FRAMES: ExampleFrame[] = [
  {
    id: 'group-value-write',
    name: 'protocol.knx.example.groupValueWrite.name',
    // Src 1.1.10, Dst 2/1/5 (ozet07'nin KENDİ örneğiyle aynı adresler — ama
    // DPT bilinmediği için "Light ON" semantiği UYDURULMAZ, yalnız raw bit=1
    // gösterilir). Priority=Low. Ctrl=0xBC (franckmarini CONTROL_FIELD_DEFAULT
    // ile bağımsızca örtüşüyor), NPCI=0xE1 (franckmarini ROUTING_FIELD_DEFAULT
    // ile bağımsızca örtüşüyor), checksum=0x2C (bağımsız ikinci hesapla
    // knx.test.ts'te kanıtlanır).
    bytes: Uint8Array.from([0xbc, 0x11, 0x0a, 0x11, 0x05, 0xe1, 0x00, 0x81, 0x2c]),
    description: 'protocol.knx.example.groupValueWrite.description',
    expectedValid: true,
  },
  {
    id: 'group-value-read',
    name: 'protocol.knx.example.groupValueRead.name',
    // Src 1.1.10, Dst 2/1/6, Priority=Alarm. GroupValueRead'in payload'u yok
    // (inline 6 bit = 0).
    bytes: Uint8Array.from([0xb8, 0x11, 0x0a, 0x11, 0x06, 0xe1, 0x00, 0x00, 0xaa]),
    description: 'protocol.knx.example.groupValueRead.description',
    expectedValid: true,
  },
  {
    id: 'group-value-response',
    name: 'protocol.knx.example.groupValueResponse.name',
    // Src 1.1.10, Dst 3/2/10, Priority=High. Payload APPENDED 2 bayt `00 64`
    // (=100) — katalog yorumunun (building-automation.ts:106-108) KENDİ
    // "raw uint16: 100" örneğiyle birebir aynı bayt çifti.
    bytes: Uint8Array.from([0xb4, 0x11, 0x0a, 0x1a, 0x0a, 0xe3, 0x00, 0x40, 0x00, 0x64, 0x87]),
    description: 'protocol.knx.example.groupValueResponse.description',
    expectedValid: true,
  },
  {
    id: 'individual-address-destination',
    name: 'protocol.knx.example.individualAddressDestination.name',
    // Src 1.1.10, Dst 4.2.100 (AT=0, Individual — `formatIndividualAddress`
    // yoluna girer, `2/1/5` gibi Group gösterimiyle KARIŞMAZ). Priority=System.
    bytes: Uint8Array.from([0xb0, 0x11, 0x0a, 0x42, 0x64, 0x61, 0x00, 0x80, 0x93]),
    description: 'protocol.knx.example.individualAddressDestination.description',
    expectedValid: true,
  },
  {
    id: 'extended-frame',
    name: 'protocol.knx.example.extendedFrame.name',
    // Control Field bit7=0 (Extended) — Karar 5 kapsam dışı: Control Field
    // yine çözülür (Repeat=Not Repeated, Priority=Low), gövde ham + uyarı.
    bytes: Uint8Array.from([0x3c, 0x11, 0x0a, 0x11, 0x05, 0xe1, 0x00, 0x81, 0x2c]),
    description: 'protocol.knx.example.extendedFrame.description',
    expectedValid: true,
  },
  {
    id: 'unrecognized-apci',
    name: 'protocol.knx.example.unrecognizedApci.name',
    // Src 1.1.10, Dst 4/3/20, Priority=High. APCI kodu 3 (0xC0 — tam APCI
    // tablosunda IndividualAddress_Write ama BU dalganın dar kümesinde YOK) —
    // ham + kategori-siz uyarı, ad UYDURULMAZ.
    bytes: Uint8Array.from([0xb4, 0x11, 0x0a, 0x23, 0x14, 0xe1, 0x00, 0xc0, 0x46]),
    description: 'protocol.knx.example.unrecognizedApci.description',
    expectedValid: true,
  },
  {
    id: 'checksum-mismatch',
    name: 'protocol.knx.example.checksumMismatch.name',
    // group-value-write ile AYNI çerçeve, yalnız son bayt (checksum) bilerek
    // bozuldu (0x2C → 0x00) — hata yolu.
    bytes: Uint8Array.from([0xbc, 0x11, 0x0a, 0x11, 0x05, 0xe1, 0x00, 0x81, 0x00]),
    description: 'protocol.knx.example.checksumMismatch.description',
    expectedValid: false,
  },
];

export const knxPlugin: ProtocolPlugin = {
  id: PROTOCOL_ID,
  name: PROTOCOL_DISPLAY_NAME,
  category: 'building-automation',
  parser: knxParser,
  documentation: {
    summary: 'protocol.knx.documentation.summary',
    layer: 'multi-layer',
    references: [
      {
        title:
          'Calimero (calimero-project/calimero-core, GPLv2+linking-exception — yalnız sabitler/format referansı, kod kopyalanmadı)',
        url: 'https://github.com/calimero-project/calimero-core',
      },
      {
        title: 'XKNX (XKNX/xknx, MIT — yalnız sabitler/format referansı)',
        url: 'https://github.com/XKNX/xknx',
      },
      {
        title: 'franckmarini/KnxDevice (Arduino, açık kaynak — üçüncü bağımsız çapraz teyit)',
        url: 'https://github.com/franckmarini/KnxDevice',
      },
    ],
  },
  exampleFrames: EXAMPLE_FRAMES,
};
