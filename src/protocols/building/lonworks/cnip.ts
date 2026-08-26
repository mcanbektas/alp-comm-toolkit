/**
 * CN/IP — ISO/IEC 14908-4 (ANSI/CEA-852) tünel başlığı (Faz 10, dalga 17).
 *
 * ── NEDEN AYRI MODÜL ──────────────────────────────────────────────────────
 * `lonTalk.ts`i BİLMEZ ve onu hiç çağırmaz; tersi de doğrudur. Gerekçe
 * 16c'nin `lweTagBlock.ts` ↔ `iec61162.ts` ayrımının aynısı, üstelik burada
 * kaynaklar da öyle: Wireshark iki AYRI dissector kullanıyor
 * (`packet-cnip.c` ve `packet-lon.c`), ikincisi birincisine
 * `dissector_add_uint("cnip.protocol", 0, lon_handle)` ile takılıyor. CN/IP
 * `pcode != 0` ile BAŞKA yükler de taşıyabilir; o gün LonTalk'ı bilmeyen bir
 * zarf çözücüsü gerekecek. Domain içi emsal `bacnet/npdu.ts` ↔ `bacnetip.ts`.
 *
 * Desen: **out-parameter accumulator** (`npdu.ts`in `decodeNpdu`si) — alanlar,
 * uyarılar ve hatalar çağıranın dizilerine yazılır, dönüş değeri yalnız
 * çağıranın ihtiyacı olan özettir.
 *
 * ── KAYNAKLAR ve BİR SAPMA ────────────────────────────────────────────────
 * Alan yerleşimi ÜÇ bağımsız kaynakta ve 12.028 gerçek datagramda örtüşüyor:
 * Wireshark `packet-cnip.c` · Echelon'un kendi yığını (`izot/lon-stack-ex`,
 * `LtIpPackets.h`in `LtIpPktHeader`ı, MIT) · `cespedes/go-lon`.
 *
 * **SAPMA — bayt 2'nin bölünmesi.** Wireshark tüm baytı sürüm sayıyor
 * (`hf_cnip_ver` maskesi `0`). Echelon `LtIpPktHeader::parse` içinde AÇIKÇA
 * bölüyor: `versionBits = version & 0xE0; version = version & 0x1F;` ve
 * `build` bunu geri birleştiriyor. **HAKEM Echelon** — CN/IP'nin yazarı ve
 * okuma bir maske değeriyle değil KODLA kanıtlı. Struct yorumu bitlerin
 * anlamını da veriyor: *"bits 5-7 of version - bits 5-6 MBZ - bit 7 => vendor
 * private packet follows"*. Gerçek yakalamada bayt DAİMA `0x01` olduğu için
 * iki okuma aynı sonucu verir; ayrımı görmek isteyen `versionByteSplit`
 * kanalını `whole-byte`a çevirir.
 *
 * ── 🚨 `extndHdrSize` BAYT DEĞİL, 32-BİT SÖZCÜK SAYAR ─────────────────────
 * `LtIpPackets.h:264`ün yorumu *"size of header - 20"* diyor ve bayt gibi
 * okunuyor. **Aynı dosyanın `.cpp`si aksini söylüyor** ve kendi yorumuyla
 * yazıyor: *"extndHdrSize is a count of 4-byte values"*, `p += (extndHdrSize*4)`.
 * Wireshark da `offset += 4 * exth_len` yapıyor. **KOD kazanır, yorum değil.**
 * Motor `4 × exth` atlar. (`go-lon` alanı okuyup hiç kullanmıyor — bu bir
 * sapma değil, go-lon'un eksiği.)
 *
 * ── 🚨 `packetSize` KENDİNİ DE SAYAR ──────────────────────────────────────
 * BVLC gibi, MBAP'ın TERSİNE. `bacnetip.ts`in aynı tuzak notu AYNI domain'de
 * duruyor; ikisini karıştırmak `length-mismatch`i tam 20 bayt kaydırırdı.
 * Bu alan aynı zamanda `canParse`ın çapasıdır: 886 örnek üzerinde ölçülen
 * SIFIR yanlış pozitifin sebebi, uzunluk alanının KENDİSİNİ doğrulamasıdır.
 *
 * ── ⚠ ÖNCELİK BURADA BASILMAZ ─────────────────────────────────────────────
 * `packet-cnip.c:87` önceliği `destport == 1629` diye yazıyor (IANA:
 * `lontalk-norm` 1628/udp, `lontalk-urgnt` 1629/udp — Wireshark'ın
 * *"Not IANA registered"* yorumu YANLIŞ). **Port bu motorun girdisinde
 * YOKTUR** (`bacnetip.ts` ile aynı: IP/UDP başlığı parser'a girmez), o yüzden
 * CN/IP düzeyinde öncelik alanı HİÇ BASILMAZ. `mode-s`in AP kararıyla (15h)
 * aynı sınıf: olmayan bir ölçümü varmış gibi göstermemek.
 *
 * ── ⚠ TIME STAMP: BİRİM BİLİNİYOR, EPOCH BİLİNMİYOR ───────────────────────
 * `LtIpPackets.h:272` *"milliseconds in wall clock time"* — birim ms, kaynaklı.
 * Ama EPOCH çerçevede yok ve aynı dosya `getTd1970()` (*"time delta from 1900
 * to 1970"*) yardımcısını taşıyor: iki taban da dolaşımda. Varsayılanda ham ms
 * basılır, TARİHE ÇEVRİLMEZ; kullanıcı `timestampEpoch` ile bildirebilir.
 */

import type { ParsedField, ProtocolError, ProtocolWarning } from '@/protocol-core/types';

/**
 * Alan biriktiricisi. `usedIds` YAPISAL benzersizlik garantisidir: bu motor
 * düz bir tabloya iki katmanlık (CN/IP + LonTalk) alan basıyor ve
 * `ParsedField.id` çakışması `ftp.ts`/`rtcp.ts`/15h/16c'de gerçekten yaşandı.
 *
 * Tip `lonTalk.ts`te de AYNI şekilde bildirilir ve iki modül birbirini import
 * ETMEZ — TypeScript yapısal tipleme ikisini uyumlu sayar, bağımsızlık korunur.
 */
export interface FieldSink {
  readonly fields: ParsedField[];
  readonly usedIds: Set<string>;
}

export function uniqueFieldId(sink: FieldSink, base: string): string {
  if (!sink.usedIds.has(base)) {
    sink.usedIds.add(base);
    return base;
  }
  let suffix = 2;
  while (sink.usedIds.has(`${base}-${String(suffix)}`)) suffix += 1;
  const id = `${base}-${String(suffix)}`;
  sink.usedIds.add(id);
  return id;
}

export function pushField(sink: FieldSink, field: ParsedField): void {
  sink.fields.push({ ...field, id: uniqueFieldId(sink, field.id) });
}

export function toProtocolWarning(
  code: string,
  message: string,
  offset?: number,
  length?: number,
): ProtocolWarning {
  return {
    code,
    message,
    ...(offset === undefined ? {} : { offset }),
    ...(length === undefined ? {} : { length }),
  };
}

const TRANSLATION_KEY_PREFIX = 'protocol.lonworks';

export const ERROR_CNIP_TRUNCATED = `${TRANSLATION_KEY_PREFIX}.error.cnipTruncated`;
export const ERROR_LENGTH_MISMATCH = `${TRANSLATION_KEY_PREFIX}.error.lengthMismatch`;
export const ERROR_EXTENDED_HEADER_TRUNCATED = `${TRANSLATION_KEY_PREFIX}.error.extendedHeaderTruncated`;
export const ERROR_PROTOCOL_CODE_OUT_OF_SCOPE = `${TRANSLATION_KEY_PREFIX}.error.protocolCodeOutOfScope`;
export const ERROR_PACKET_TYPE_REJECTED = `${TRANSLATION_KEY_PREFIX}.error.packetTypeRejected`;

export const WARN_LENGTH_MISMATCH_LENIENT = `${TRANSLATION_KEY_PREFIX}.warning.lengthMismatchLenient`;
export const WARN_VENDOR_PRIVATE_PACKET = `${TRANSLATION_KEY_PREFIX}.warning.vendorPrivatePacketFollows`;
export const WARN_RESERVED_BITS_NOT_ZERO = `${TRANSLATION_KEY_PREFIX}.warning.reservedBitsNotZero`;
export const WARN_UNEXPECTED_CNIP_VERSION = `${TRANSLATION_KEY_PREFIX}.warning.unexpectedCnipVersion`;
export const WARN_NON_DATA_PACKET = `${TRANSLATION_KEY_PREFIX}.warning.nonDataPacketNotDecoded`;
export const WARN_UNKNOWN_PACKET_TYPE = `${TRANSLATION_KEY_PREFIX}.warning.unknownPacketType`;
export const WARN_SECURITY_BIT_SET = `${TRANSLATION_KEY_PREFIX}.warning.securityBitSet`;
export const WARN_EXTENDED_HEADER_UNVERIFIED = `${TRANSLATION_KEY_PREFIX}.warning.extendedHeaderUnverified`;
export const WARN_TIMESTAMP_EPOCH_UNKNOWN = `${TRANSLATION_KEY_PREFIX}.warning.timestampEpochUnknown`;

const FIELD_WARN_PATH_NOT_VERIFIED = `${TRANSLATION_KEY_PREFIX}.field.pathNotVerifiedInCapture`;
const FIELD_WARN_TIMESTAMP_EPOCH_UNKNOWN = `${TRANSLATION_KEY_PREFIX}.field.timestampEpochUnknown`;
const FIELD_WARN_SECURITY_NOT_DECODED = `${TRANSLATION_KEY_PREFIX}.field.securityNotDecoded`;
const FIELD_WARN_BODY_NOT_DECODED = `${TRANSLATION_KEY_PREFIX}.field.bodyNotDecoded`;

/** Sabit başlık: 5 × 32-bit sözcük (`LtIpPackets.h`: `STD_HDR_SIZE = (4*5)`). */
export const CNIP_HEADER_LENGTH = 20;
/** Echelon uzantısı: 3 × 32-bit sözcük (`EXT_HDR_ADD_SIZE = (4*3)`). */
export const CNIP_ECHELON_EXTENSION_WORDS = 3;
/** `packet-cnip.c:16` `#define DATA_PACKET 0x01` — LonTalk yüküne dallanan TEK tip. */
export const CNIP_PACKET_TYPE_DATA = 0x01;
/** `protocolFlags` alt beş biti; `0` = EIA-709 (LonTalk). */
export const CNIP_PROTOCOL_CODE_LONTALK = 0;
const CNIP_SECURITY_FLAG_MASK = 0x20;
const CNIP_PROTOCOL_CODE_MASK = 0x1f;
const CNIP_VERSION_MASK = 0x1f;
const CNIP_VERSION_BITS_SHIFT = 5;
const CNIP_VERSION_VENDOR_PRIVATE_BIT = 0x04;
const CNIP_VERSION_MBZ_BITS = 0x03;
/** Yakalamadaki tek değer (12028/12028) ve `LtIpPackets.h`in ürettiği sürüm. */
const CNIP_EXPECTED_VERSION = 1;

/** `packet-cnip.c:22-38`. Adlar PROTOKOL VERİSİDİR, çeviriye girmez. */
const CNIP_PACKET_TYPE_NAMES: ReadonlyMap<number, string> = new Map([
  [0x01, 'Data Packet'],
  [0x03, 'Device Registration'],
  [0x04, 'Channel Membership'],
  [0x06, 'Send List'],
  [0x07, 'Acknowledge'],
  [0x08, 'Channel Routing'],
  [0x60, 'Status/Health/Statistics Request'],
  [0x63, 'Device Configuration Request'],
  [0x64, 'Channel Membership Request'],
  [0x66, 'Send List Request'],
  [0x68, 'Channel Routing Request'],
  [0x70, 'Status/Health/Statistics Response'],
  [0x71, 'Device Configuration'],
  [0x7f, 'Segment'],
]);

export function cnipPacketTypeName(packetType: number): string | undefined {
  return CNIP_PACKET_TYPE_NAMES.get(packetType);
}

/** `canParse` imzasının (R4) kabul ettiği tip kümesi. */
export function isKnownCnipPacketType(packetType: number): boolean {
  return CNIP_PACKET_TYPE_NAMES.has(packetType);
}

export const TIMESTAMP_EPOCH_RAW = 'raw-milliseconds';
export const TIMESTAMP_EPOCH_1900 = 'epoch-1900';
export const TIMESTAMP_EPOCH_1970 = 'epoch-1970';

export const PACKET_TYPE_HANDLING_NAME_AND_RAW = 'name-and-raw';
export const PACKET_TYPE_HANDLING_REJECT = 'reject';

export const VERSION_SPLIT_ECHELON = 'echelon-5bit';
export const VERSION_SPLIT_WHOLE_BYTE = 'whole-byte';

export const LENGTH_STRICT = 'strict';
export const LENGTH_LENIENT = 'lenient';

export interface CnipDecodeOptions {
  readonly versionByteSplit: string;
  readonly strictLength: string;
  readonly unknownPacketTypeHandling: string;
  readonly timestampEpoch: string;
}

export interface CnipHeaderSummary {
  /** Başlık yapısal olarak okunabildi mi; `false` ise LonTalk'a geçilmez. */
  readonly readable: boolean;
  readonly packetSize: number;
  readonly packetType: number;
  readonly protocolCode: number;
  readonly extendedHeaderWords: number;
  /** LonTalk PDU'sunun mutlak ofseti = `20 + 4 × exth`. */
  readonly payloadOffset: number;
  /** `true` ise yük LonTalk PDU'sudur ve çözülür. */
  readonly carriesLonTalk: boolean;
}

function byteAt(data: Uint8Array, offset: number): number {
  return data[offset] ?? 0;
}

function readUint16BE(data: Uint8Array, offset: number): number {
  return (byteAt(data, offset) << 8) | byteAt(data, offset + 1);
}

/** `>>> 0` şart: `<< 24` işaretli 32-bit üretir, `0x6B8B4567` negatife dönerdi. */
function readUint32BE(data: Uint8Array, offset: number): number {
  return (
    ((byteAt(data, offset) << 24) |
      (byteAt(data, offset + 1) << 16) |
      (byteAt(data, offset + 2) << 8) |
      byteAt(data, offset + 3)) >>>
    0
  );
}

function hex(value: number, digits: number): string {
  return `0x${value.toString(16).toUpperCase().padStart(digits, '0')}`;
}

/** 1900 → 1970 arasındaki saniye farkı (`LtIpPackets`in `getTd1970()`si). */
const SECONDS_1900_TO_1970 = 2_208_988_800;

function describeTimestamp(milliseconds: number, epoch: string): string | undefined {
  if (epoch === TIMESTAMP_EPOCH_RAW) return undefined;
  const base = epoch === TIMESTAMP_EPOCH_1900 ? -SECONDS_1900_TO_1970 * 1000 : 0;
  const date = new Date(base + milliseconds);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

/**
 * CN/IP başlığını çözer ve LonTalk yükünün nerede başladığını döndürür.
 * Hiçbir bayt TÜKETMEZ, hiçbir şey döndürmez dışında bir yan etkisi yoktur:
 * alanlar `sink`e, uyarılar/hatalar verilen dizilere yazılır.
 */
export function decodeCnipHeader(
  data: Uint8Array,
  sink: FieldSink,
  warnings: ProtocolWarning[],
  errors: ProtocolError[],
  options: CnipDecodeOptions,
): CnipHeaderSummary {
  const unreadable: CnipHeaderSummary = {
    readable: false,
    packetSize: 0,
    packetType: 0,
    protocolCode: 0,
    extendedHeaderWords: 0,
    payloadOffset: data.length,
    carriesLonTalk: false,
  };

  if (data.length < CNIP_HEADER_LENGTH) {
    errors.push({
      code: 'truncated-frame',
      message: ERROR_CNIP_TRUNCATED,
      offset: 0,
      length: data.length,
    });
    return unreadable;
  }

  // ── 0: Packet size — KENDİSİNİ DE SAYAR ─────────────────────────────────
  const packetSize = readUint16BE(data, 0);
  const lengthMatches = packetSize === data.length;
  pushField(sink, {
    id: 'cnip-packet-size',
    name: 'CN/IP · Packet Size',
    offset: 0,
    length: 2,
    rawBytes: data.slice(0, 2),
    rawValue: packetSize,
    physicalValue: lengthMatches
      ? `${String(packetSize)} B (header included)`
      : `${String(packetSize)} B declared, ${String(data.length)} B received`,
    valid: lengthMatches,
    warnings: [],
  });
  if (!lengthMatches) {
    if (options.strictLength === LENGTH_LENIENT) {
      warnings.push(toProtocolWarning('lengthMismatchLenient', WARN_LENGTH_MISMATCH_LENIENT, 0, 2));
    } else {
      errors.push({
        code: 'length-mismatch',
        message: ERROR_LENGTH_MISMATCH,
        offset: 0,
        length: 2,
        details: { declared: packetSize, received: data.length },
      });
    }
  }

  // ── 2: Version + version bits (SAPMA 1) ─────────────────────────────────
  const versionByte = byteAt(data, 2);
  const wholeByte = options.versionByteSplit === VERSION_SPLIT_WHOLE_BYTE;
  const version = wholeByte ? versionByte : versionByte & CNIP_VERSION_MASK;
  const versionBits = wholeByte ? 0 : versionByte >> CNIP_VERSION_BITS_SHIFT;
  pushField(sink, {
    id: 'cnip-version',
    name: wholeByte ? 'CN/IP · Version (whole byte)' : 'CN/IP · Version (bits 4:0)',
    offset: 2,
    length: 1,
    rawBytes: data.slice(2, 3),
    rawValue: versionByte,
    physicalValue: String(version),
    valid: true,
    warnings: [],
  });
  if (version !== CNIP_EXPECTED_VERSION) {
    warnings.push(
      toProtocolWarning('unexpectedCnipVersion', WARN_UNEXPECTED_CNIP_VERSION, 2, 1),
    );
  }
  if (!wholeByte) {
    const vendorPrivate = (versionBits & CNIP_VERSION_VENDOR_PRIVATE_BIT) !== 0;
    const reservedSet = (versionBits & CNIP_VERSION_MBZ_BITS) !== 0;
    pushField(sink, {
      id: 'cnip-version-bits',
      name: 'CN/IP · Version Bits (7:5)',
      offset: 2,
      length: 1,
      rawBytes: data.slice(2, 3),
      rawValue: versionBits,
      physicalValue: vendorPrivate
        ? 'bit 7 set — vendor private packet follows'
        : 'bit 7 clear — no vendor private packet',
      valid: !reservedSet,
      warnings: reservedSet ? [FIELD_WARN_PATH_NOT_VERIFIED] : [],
    });
    if (vendorPrivate) {
      warnings.push(
        toProtocolWarning('vendorPrivatePacketFollows', WARN_VENDOR_PRIVATE_PACKET, 2, 1),
      );
    }
    if (reservedSet) {
      warnings.push(toProtocolWarning('reservedBitsNotZero', WARN_RESERVED_BITS_NOT_ZERO, 2, 1));
    }
  }

  // ── 3: Packet type ──────────────────────────────────────────────────────
  const packetType = byteAt(data, 3);
  const packetTypeName = cnipPacketTypeName(packetType);
  pushField(sink, {
    id: 'cnip-packet-type',
    name: 'CN/IP · Packet Type',
    offset: 3,
    length: 1,
    rawBytes: data.slice(3, 4),
    rawValue: hex(packetType, 2),
    physicalValue: packetTypeName ?? 'unknown packet type',
    valid: packetTypeName !== undefined,
    warnings: packetTypeName === undefined ? [FIELD_WARN_PATH_NOT_VERIFIED] : [],
  });
  if (packetTypeName === undefined) {
    warnings.push(toProtocolWarning('unknownPacketType', WARN_UNKNOWN_PACKET_TYPE, 3, 1));
  }

  // ── 4: Extended header size — 32-BİT SÖZCÜK sayar ───────────────────────
  const extendedHeaderWords = byteAt(data, 4);
  const extendedHeaderBytes = extendedHeaderWords * 4;
  const payloadOffset = CNIP_HEADER_LENGTH + extendedHeaderBytes;
  pushField(sink, {
    id: 'cnip-ext-header-size',
    name: 'CN/IP · Extended Header Size',
    offset: 4,
    length: 1,
    rawBytes: data.slice(4, 5),
    rawValue: extendedHeaderWords,
    physicalValue: `${String(extendedHeaderWords)} × 32-bit word = ${String(extendedHeaderBytes)} B`,
    valid: payloadOffset <= data.length,
    warnings: extendedHeaderWords > 0 ? [FIELD_WARN_PATH_NOT_VERIFIED] : [],
  });
  if (payloadOffset > data.length) {
    errors.push({
      code: 'truncated-frame',
      message: ERROR_EXTENDED_HEADER_TRUNCATED,
      offset: CNIP_HEADER_LENGTH,
      length: Math.max(0, data.length - CNIP_HEADER_LENGTH),
    });
    return { ...unreadable, packetSize, packetType, extendedHeaderWords };
  }

  // ── 5: Protocol flags ───────────────────────────────────────────────────
  const protocolFlags = byteAt(data, 5);
  const protocolCode = protocolFlags & CNIP_PROTOCOL_CODE_MASK;
  const securityBit = (protocolFlags & CNIP_SECURITY_FLAG_MASK) !== 0;
  pushField(sink, {
    id: 'cnip-protocol-flags',
    name: 'CN/IP · Protocol Flags',
    offset: 5,
    length: 1,
    rawBytes: data.slice(5, 6),
    rawValue: hex(protocolFlags, 2),
    physicalValue:
      protocolCode === CNIP_PROTOCOL_CODE_LONTALK
        ? `protocol code 0 (EIA-709 / LonTalk)${securityBit ? ', security bit set' : ''}`
        : `protocol code ${String(protocolCode)} (not EIA-709)`,
    valid: protocolCode === CNIP_PROTOCOL_CODE_LONTALK,
    warnings: securityBit ? [FIELD_WARN_SECURITY_NOT_DECODED] : [],
  });
  if (securityBit) {
    warnings.push(toProtocolWarning('securityBitSet', WARN_SECURITY_BIT_SET, 5, 1));
  }

  // ── 6..19: Vendor / session / sequence / timestamp ──────────────────────
  const vendorCode = readUint16BE(data, 6);
  pushField(sink, {
    id: 'cnip-vendor-code',
    name: 'CN/IP · Vendor Code',
    offset: 6,
    length: 2,
    rawBytes: data.slice(6, 8),
    rawValue: vendorCode,
    physicalValue: hex(vendorCode, 4),
    valid: true,
    warnings: [],
  });

  const sessionId = readUint32BE(data, 8);
  pushField(sink, {
    id: 'cnip-session-id',
    name: 'CN/IP · Session ID',
    offset: 8,
    length: 4,
    rawBytes: data.slice(8, 12),
    rawValue: sessionId,
    physicalValue: hex(sessionId, 8),
    valid: true,
    warnings: [],
  });

  const sequenceNumber = readUint32BE(data, 12);
  pushField(sink, {
    id: 'cnip-sequence',
    name: 'CN/IP · Sequence Number',
    offset: 12,
    length: 4,
    rawBytes: data.slice(12, 16),
    rawValue: sequenceNumber,
    physicalValue: String(sequenceNumber),
    valid: true,
    warnings: [],
  });

  const timestamp = readUint32BE(data, 16);
  const timestampText = describeTimestamp(timestamp, options.timestampEpoch);
  const epochUnknown = options.timestampEpoch === TIMESTAMP_EPOCH_RAW;
  pushField(sink, {
    id: 'cnip-timestamp',
    name: 'CN/IP · Time Stamp',
    offset: 16,
    length: 4,
    rawBytes: data.slice(16, 20),
    rawValue: timestamp,
    // Birim ms KAYNAKLIDIR; tarihe çevirmek YALNIZ kullanıcı epoch bildirdiğinde.
    physicalValue: timestampText === undefined ? timestamp : `${timestampText} (epoch set by user)`,
    // `unit` yalnız ham milisaniye basılırken anlamlı; tarih metninde birim yoktur.
    ...(timestampText === undefined ? { unit: 'ms' } : {}),
    valid: true,
    warnings: epochUnknown ? [FIELD_WARN_TIMESTAMP_EPOCH_UNKNOWN] : [],
  });
  if (epochUnknown) {
    warnings.push(
      toProtocolWarning('timestampEpochUnknown', WARN_TIMESTAMP_EPOCH_UNKNOWN, 16, 4),
    );
  }

  // ── 20..: Genişletilmiş başlık ──────────────────────────────────────────
  if (extendedHeaderWords > 0) {
    pushField(sink, {
      id: 'cnip-extended-header',
      name: 'CN/IP · Extended Header',
      offset: CNIP_HEADER_LENGTH,
      length: extendedHeaderBytes,
      rawBytes: data.slice(CNIP_HEADER_LENGTH, payloadOffset),
      physicalValue:
        extendedHeaderWords === CNIP_ECHELON_EXTENSION_WORDS
          ? 'matches the Echelon 12-byte extension shape (local IP, NAT IP, port)'
          : 'contents not decoded',
      valid: true,
      warnings: [FIELD_WARN_PATH_NOT_VERIFIED],
    });
    warnings.push(
      toProtocolWarning(
        'extendedHeaderUnverified',
        WARN_EXTENDED_HEADER_UNVERIFIED,
        CNIP_HEADER_LENGTH,
        extendedHeaderBytes,
      ),
    );
  }

  // ── Kapsam: yalnız `pcode == 0` LonTalk'tır ─────────────────────────────
  if (protocolCode !== CNIP_PROTOCOL_CODE_LONTALK) {
    // TANINIR ama ÇÖZÜLMEZ — sessizce "geçersiz" DENMEZ (16c'nin `R?UdP` biçimi).
    errors.push({
      code: 'unsupported-encoding',
      message: ERROR_PROTOCOL_CODE_OUT_OF_SCOPE,
      offset: 5,
      length: 1,
      details: { protocolCode },
    });
    pushRawBody(data, sink, payloadOffset);
    return {
      readable: true,
      packetSize,
      packetType,
      protocolCode,
      extendedHeaderWords,
      payloadOffset,
      carriesLonTalk: false,
    };
  }

  // ── Data Packet dışındaki 13 tip: ADI BASILIR, gövde HAM kalır ─────────
  if (packetType !== CNIP_PACKET_TYPE_DATA) {
    if (options.unknownPacketTypeHandling === PACKET_TYPE_HANDLING_REJECT) {
      errors.push({
        code: 'unsupported-encoding',
        message: ERROR_PACKET_TYPE_REJECTED,
        offset: 3,
        length: 1,
        details: { packetType },
      });
    } else {
      warnings.push(toProtocolWarning('nonDataPacketNotDecoded', WARN_NON_DATA_PACKET, 3, 1));
    }
    pushRawBody(data, sink, payloadOffset);
    return {
      readable: true,
      packetSize,
      packetType,
      protocolCode,
      extendedHeaderWords,
      payloadOffset,
      carriesLonTalk: false,
    };
  }

  return {
    readable: true,
    packetSize,
    packetType,
    protocolCode,
    extendedHeaderWords,
    payloadOffset,
    carriesLonTalk: true,
  };
}

/** Çözülmeyen gövde HAM basılır — boş kart yasağı (CLAUDE.md). */
function pushRawBody(data: Uint8Array, sink: FieldSink, payloadOffset: number): void {
  if (payloadOffset >= data.length) return;
  pushField(sink, {
    id: 'cnip-body',
    name: 'CN/IP · Body (not decoded)',
    offset: payloadOffset,
    length: data.length - payloadOffset,
    rawBytes: data.slice(payloadOffset),
    valid: true,
    warnings: [FIELD_WARN_BODY_NOT_DECODED],
  });
}
