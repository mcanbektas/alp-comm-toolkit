/**
 * MAVLink v1/v2 — İHA/robotik telemetri çerçevesi: magic baytına göre dallanan
 * TEK parser, TEK kayıt (brief-faz10-dalga3.md, 3d — CAN 2.0A/2.0B'nin
 * "iki-plugin-tek-parser" deseni (`canClassic.ts`) BİLEREK KULLANILMADI: v1/v2
 * tel biçimi CAN 2.0A/B'den farklı olarak GERÇEKTEN ayrışıyor — header uzunluğu
 * (6 vs 10 bayt), MSGID genişliği (8 vs 24 bit), flags/signature v2'ye özgü.
 * Buna rağmen registry'ye TEK protokol kimliğiyle (`mavlink`) kaydedilir.
 *
 * GİRDİ UART/UDP/TCP taşıyıcısından gelen HAM MAVLink çerçeve baytıdır: v1
 * `0xFE` ile, v2 `0xFD` ile başlar (spec 17217/17353-17368). Fiziksel taşıyıcı
 * bir bayt akışı değildir, parser'a hiç girmez (DoIP'in TCP/UDP ayrımını
 * bağlantı katmanına bırakmasıyla aynı sınır).
 *
 * ── `status: 'partial'`, `ready` DEĞİL (karar turu, dalga başında onaylandı) ──
 * Header çerçeve düzeyinde TAM çözülür (STX/LEN/SEQ/SYSID/COMPID/MSGID, v2'de
 * ayrıca Incompat/Compat Flags + 24-bit MSGID + opsiyonel imza) ama bütünlük
 * DOĞRULANAMAZ: CRC-16/MCRF4XX'in parametreleri (poly/init/refin/refout/xorout)
 * spec'te YOK — yalnız algoritma ADI var (spec ~17408) — üstelik hesaba
 * mesaj-özel `CRC_EXTRA` girer ve bu değer dialect tanımına (message
 * definition) bağlıdır (spec ~17410-17465). Dialect yüklenmeden checksum
 * matematiksel olarak hesaplanamaz. `ready` etiketi burada YANILTICI olurdu:
 * OBD-II'nin `status: 'partial'` kararıyla aynı gerekçe (bkz. `obd.ts` dosya
 * başı) — eksik doğrulama yeteneği "hazır" etiketiyle örtülmez.
 *
 * ── KAYNAK UYARISI ────────────────────────────────────────────────────────────
 * Header alan düzeni, magic baytları, flag biti ve imza uzunluğu spec'ten
 * BİREBİR:
 *  • v1 offset tablosu (spec 17217-17250): STX/LEN/SEQ/SYSID/COMPID/MSGID/
 *    PAYLOAD/CRC LOW/CRC HIGH — spec'in kendi örnek renklendirmesi
 *    (`FE 09 2A 01 01 00 PAYLOAD... CRC`) mutlu-yol örneğinde birebir kullanıldı.
 *  • v2 wire frame (spec 17353-17379): STX/LEN/INCOMPAT_FLAGS/COMPAT_FLAGS/
 *    SEQ/SYSID/COMPID/MSGID[24bit]/PAYLOAD/CHECKSUM/OPTIONAL SIGNATURE.
 *  • Signing (spec ~17517-17525): imzalı frame'de incompat flag'in "ilgili
 *    biti" set edilir, imza 13 bayt (link id + timestamp + truncated
 *    cryptographic signature). Spec bit NUMARASINI vermiyor — burada
 *    kullanılan `0x01`, MAVLink'in resmi `MAVLINK_IFLAG_SIGNED` sabitidir
 *    (yaygın, kamuya açık MAVLink C kütüphanesi tanımı; DoIP'in üç-kaynaklı
 *    dış kaynak disiplini kadar ağır değil çünkü tek bit, tek olası konum).
 *  • CRC-16/MCRF4XX parametreleri ve CRC_EXTRA değerleri BİLİNÇLİ olarak
 *    uygulanmadı (spec 17408-17465, 17593: "hard-coded field offset kullanmak
 *    yerine official dialect definition yüklenmeli").
 *
 * ── MESSAGE ID ADLANDIRILMAZ ─────────────────────────────────────────────────
 * HEARTBEAT/ATTITUDE/GPS_RAW_INT gibi mesaj adları spec'te GEÇİYOR (spec
 * ~17570-17593) ama sayısal MSGID karşılıkları spec'te YOK — bunlar MAVLink
 * `common.xml` dialect'inin parçası, buraya taşımak "spec'in vermediğini
 * vermek" olurdu (RTCM'in mesaj adı tablosuna dokunmama kararıyla aynı
 * disiplin, bkz. `rtcm.ts` dosya başı). MSGID alanı bu yüzden SAYISAL kalır;
 * örnek çerçevelerin yorumlarında geçen "HEARTBEAT/GPS_RAW_INT/COMMAND_LONG"
 * gibi isimler yalnız YORUM metni — parser bunları HİÇ bilmez, çözmez.
 *
 * ── PAYLOAD HAM + `payloadNeedsDialect` ──────────────────────────────────────
 * Wire alan sırası XML declaration sırasıyla AYNI DEĞİLDİR — generator alanları
 * native tip boyutuna göre yeniden sıralar (reorder), MAVLink 2 extension
 * alanları wire'da base alanlardan SONRA gelir (spec ~17467-17480). Bu yüzden
 * payload'a sabit offset'le alan adı YAKIŞTIRILMAZ; ham bayt + uyarı.
 *
 * ── SEQ-LOSS HESABI PARSER'A GİRMEZ ──────────────────────────────────────────
 * Δ = (Current − Previous) mod 256 formülü spec'te var (spec ~17266-17285) ama
 * ÇERÇEVELER ARASI durum ister (önceki seq'i bilmek lazım) — bu analyzer
 * katmanının işi (spec §41 "parser SAF olmalı" ilkesi, DoIP'in bağlantı
 * durumunu parser'da TUTMAMA kararıyla aynı sınır). `seq` alanı ve
 * `metadata.seq` yalnız DEĞERİ taşır, kayıp burada HESAPLANMAZ.
 *
 * ── `checksum-mismatch` HİÇ BASILMAZ ─────────────────────────────────────────
 * Doğrulayamadığın bir şeyi "yanlış" ilan etmek yanlış pozitiftir — bu motorda
 * checksum alanı HER ZAMAN `valid: true` (varlığı doğrulanır, doğruluğu değil)
 * ve `crcNeedsDialect` uyarısıyla ham gösterilir. Diğer motorlardaki (DoIP/
 * KWP2000/ISO 9141/UBX/RTCM) `checksum-mismatch` kullanımından FARKLI: onlarda
 * algoritma biliniyordu, burada bilinmiyor.
 *
 * ── KAPSAM DIŞI (bilinçli) ──────────────────────────────────────────────────
 * • İmza doğrulaması: gizli anahtar olmadan mümkün değil, anahtar sunucuya
 *   asla gönderilmez (CLAUDE.md "kullanıcı verisi yerelde kalır"); imza
 *   VARLIĞI gösterilir, `signatureNeedsKey` uyarısıyla (spec ~17520-17525'in
 *   "anahtar verilmediyse Verification unavailable" yönergesiyle aynı ton).
 * • MAVLink 2 trailing-zero payload truncation (spec ~17493-17511): hangi
 *   payload'ın "eksik trailing sıfır" sayılacağını bilmek mesajın TANIMLI
 *   boyutunu (dialect) gerektirir — burada karşılaştırılacak bir tanım yok,
 *   bu yüzden `LEN` alanının bildirdiği bayt sayısı olduğu gibi okunur.
 */

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

const PROTOCOL_ID = 'mavlink';
/** Protokol adı veridir, çeviriye girmez (CLAUDE.md). */
const PROTOCOL_DISPLAY_NAME = 'MAVLink';

const MAGIC_V1 = 0xfe;
const MAGIC_V2 = 0xfd;

/** STX+LEN+SEQ+SYSID+COMPID+MSGID (spec 17217-17245). */
const V1_HEADER_LENGTH = 6;
const V1_CHECKSUM_LENGTH = 2;
/** Boş payload'lı en kısa geçerli v1 çerçeve: header + checksum. */
const V1_MIN_FRAME_LENGTH = V1_HEADER_LENGTH + V1_CHECKSUM_LENGTH;

/** STX+LEN+INCOMPAT+COMPAT+SEQ+SYSID+COMPID+MSGID[24bit] (spec 17353-17368). */
const V2_HEADER_LENGTH = 10;
const V2_CHECKSUM_LENGTH = 2;
/** İmza: link id + timestamp + truncated signature (spec ~17517-17525). */
const V2_SIGNATURE_LENGTH = 13;
const V2_MIN_FRAME_LENGTH = V2_HEADER_LENGTH + V2_CHECKSUM_LENGTH;
/** MAVLink resmi `MAVLINK_IFLAG_SIGNED` biti — spec "ilgili bit" der, numara vermez (dosya başı). */
const INCOMPAT_FLAG_SIGNED = 0x01;

const V1_LEN_OFFSET = 1;
const V1_SEQ_OFFSET = 2;
const V1_SYSID_OFFSET = 3;
const V1_COMPID_OFFSET = 4;
const V1_MSGID_OFFSET = 5;
const V1_MSGID_LENGTH = 1;
const V1_PAYLOAD_OFFSET = V1_HEADER_LENGTH;

const V2_LEN_OFFSET = 1;
const V2_INCOMPAT_OFFSET = 2;
const V2_COMPAT_OFFSET = 3;
const V2_SEQ_OFFSET = 4;
const V2_SYSID_OFFSET = 5;
const V2_COMPID_OFFSET = 6;
/** 24-bit MSGID; flags/seq/sysid/compid'in HEMEN ardından — bayt-viewer
 * çakışmaması için offset/length burada AYRI sabitlerle tutulur (tuzak notu,
 * brief-faz10-dalga3.md). */
const V2_MSGID_OFFSET = 7;
const V2_MSGID_LENGTH = 3;
const V2_PAYLOAD_OFFSET = V2_HEADER_LENGTH;

const HEX_RADIX = 16;
const HEX_DIGITS_BYTE = 2;

const ERROR_V1_HEADER_TRUNCATED = 'protocol.mavlink.error.v1HeaderTruncated';
const ERROR_V2_HEADER_TRUNCATED = 'protocol.mavlink.error.v2HeaderTruncated';
const ERROR_BODY_TRUNCATED = 'protocol.mavlink.error.bodyTruncated';
const ERROR_FRAME_TOO_LONG = 'protocol.mavlink.error.frameTooLong';
const ERROR_ABORTED = 'protocol.mavlink.error.aborted';
const ERROR_UNKNOWN_MAGIC = 'protocol.mavlink.error.unknownMagic';

const WARN_PAYLOAD_NEEDS_DIALECT = 'protocol.mavlink.warning.payloadNeedsDialect';
const WARN_CRC_NEEDS_DIALECT = 'protocol.mavlink.warning.crcNeedsDialect';
const WARN_SIGNATURE_NEEDS_KEY = 'protocol.mavlink.warning.signatureNeedsKey';
const WARN_TRAILING_BYTES = 'protocol.mavlink.warning.trailingBytes';

const SUMMARY_FRAME = 'protocol.mavlink.summary.frame';

export type MavlinkVersion = 'v1' | 'v2';

export type MavlinkFrameMetadata = {
  version: MavlinkVersion;
  messageId: number;
  systemId: number;
  componentId: number;
  /** Yalnız DEĞER taşınır — kayıp hesabı analyzer katmanının işi (dosya başı). */
  seq: number;
  signed: boolean;
  summaryKey: string;
  summaryParams: Record<string, string>;
};

function toProtocolWarning(key: string): ProtocolWarning {
  return { code: key, message: key };
}

function byteAt(data: Uint8Array, offset: number): number {
  return data[offset] ?? 0;
}

function formatHexByte(value: number): string {
  return `0x${value.toString(HEX_RADIX).toUpperCase().padStart(HEX_DIGITS_BYTE, '0')}`;
}

/** 2 bayt küçük-uçlu (LE) okuma — MAVLink'in çok baytlı alanlarının TAMAMI
 * LE'dir (spec "Payload Serialization", dosya başı). */
function readUint16Le(data: Uint8Array, offset: number): number {
  return byteAt(data, offset) | (byteAt(data, offset + 1) << 8);
}

/** 3 bayt küçük-uçlu okuma. Azami değer 0xFFFFFF (24 bit) 31. bite hiç
 * yaklaşmaz — RTCM'in 24-bit CRC birleştirmesinde olduğu gibi işaret taşması
 * OLUŞMAZ, `>>> 0` gerekmez (bkz. rtcm.ts aynı gerekçe). */
function readUint24Le(data: Uint8Array, offset: number): number {
  return (
    byteAt(data, offset) | (byteAt(data, offset + 1) << 8) | (byteAt(data, offset + 2) << 16)
  );
}

function pushTrailingField(
  data: Uint8Array,
  offset: number,
  fields: ParsedField[],
  warnings: ProtocolWarning[],
): void {
  const trailing = data.slice(offset);
  fields.push({
    id: 'trailing-data',
    name: 'Trailing Data',
    offset,
    length: trailing.length,
    rawBytes: trailing,
    valid: false,
    warnings: [WARN_TRAILING_BYTES],
  });
  warnings.push(toProtocolWarning(WARN_TRAILING_BYTES));
}

interface MavlinkParseOptions {
  timestamp?: number;
  direction?: FrameDirection;
  channel?: string;
  maxFrameLength?: number;
  signal?: AbortSignal;
}

interface FinishInput {
  version: MavlinkVersion;
  messageId: number;
  systemId: number;
  componentId: number;
  seq: number;
  signed: boolean;
}

function finishFrame(
  data: Uint8Array,
  fields: ParsedField[],
  warnings: ProtocolWarning[],
  errors: ProtocolError[],
  options: MavlinkParseOptions,
  info: FinishInput,
): ParseResult {
  const summaryParams: Record<string, string> = {
    version: info.version === 'v1' ? 'MAVLink 1' : 'MAVLink 2',
    messageId: String(info.messageId),
    systemId: String(info.systemId),
    componentId: String(info.componentId),
  };

  const metadata: MavlinkFrameMetadata = {
    version: info.version,
    messageId: info.messageId,
    systemId: info.systemId,
    componentId: info.componentId,
    seq: info.seq,
    signed: info.signed,
    summaryKey: SUMMARY_FRAME,
    summaryParams,
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

function parseMavlinkV1(data: Uint8Array, options: MavlinkParseOptions): ParseResult {
  if (data.length < V1_HEADER_LENGTH) {
    return {
      success: false,
      error: {
        code: 'truncated-frame',
        message: ERROR_V1_HEADER_TRUNCATED,
        offset: 0,
        length: data.length,
      },
      consumedBytes: 0,
      recoverable: true,
    };
  }

  const fields: ParsedField[] = [];
  const warnings: ProtocolWarning[] = [];
  const errors: ProtocolError[] = [];

  fields.push({
    id: 'magic',
    name: 'Magic (STX)',
    offset: 0,
    length: 1,
    rawBytes: data.slice(0, 1),
    rawValue: MAGIC_V1,
    physicalValue: 'MAVLink 1',
    valid: true,
    warnings: [],
  });

  const declaredLength = byteAt(data, V1_LEN_OFFSET);
  fields.push({
    id: 'payload-length',
    name: 'Payload Length',
    offset: V1_LEN_OFFSET,
    length: 1,
    rawBytes: data.slice(V1_LEN_OFFSET, V1_LEN_OFFSET + 1),
    rawValue: declaredLength,
    unit: 'B',
    valid: true,
    warnings: [],
  });

  const seq = byteAt(data, V1_SEQ_OFFSET);
  fields.push({
    id: 'seq',
    name: 'Packet Sequence',
    offset: V1_SEQ_OFFSET,
    length: 1,
    rawBytes: data.slice(V1_SEQ_OFFSET, V1_SEQ_OFFSET + 1),
    rawValue: seq,
    valid: true,
    warnings: [],
  });

  const systemId = byteAt(data, V1_SYSID_OFFSET);
  fields.push({
    id: 'system-id',
    name: 'System ID',
    offset: V1_SYSID_OFFSET,
    length: 1,
    rawBytes: data.slice(V1_SYSID_OFFSET, V1_SYSID_OFFSET + 1),
    rawValue: systemId,
    valid: true,
    warnings: [],
  });

  const componentId = byteAt(data, V1_COMPID_OFFSET);
  fields.push({
    id: 'component-id',
    name: 'Component ID',
    offset: V1_COMPID_OFFSET,
    length: 1,
    rawBytes: data.slice(V1_COMPID_OFFSET, V1_COMPID_OFFSET + 1),
    rawValue: componentId,
    valid: true,
    warnings: [],
  });

  const messageId = byteAt(data, V1_MSGID_OFFSET);
  fields.push({
    id: 'message-id',
    name: 'Message ID',
    offset: V1_MSGID_OFFSET,
    length: V1_MSGID_LENGTH,
    rawBytes: data.slice(V1_MSGID_OFFSET, V1_MSGID_OFFSET + V1_MSGID_LENGTH),
    rawValue: messageId,
    valid: true,
    warnings: [],
  });

  const finishInfo: FinishInput = { version: 'v1', messageId, systemId, componentId, seq, signed: false };

  const totalFrameLength = V1_PAYLOAD_OFFSET + declaredLength + V1_CHECKSUM_LENGTH;
  if (data.length < totalFrameLength) {
    // DoIP/RTCM'in "kısmi çözüm" deseni: header yine gösterilir, payload/
    // checksum için yer yoksa yalnız hata eklenip durulur.
    errors.push({
      code: 'truncated-frame',
      message: ERROR_BODY_TRUNCATED,
      offset: V1_PAYLOAD_OFFSET,
      length: totalFrameLength - data.length,
      details: { declaredLength, availableAfterHeader: data.length - V1_PAYLOAD_OFFSET },
    });
    return finishFrame(data, fields, warnings, errors, options, finishInfo);
  }

  if (declaredLength > 0) {
    const payload = data.slice(V1_PAYLOAD_OFFSET, V1_PAYLOAD_OFFSET + declaredLength);
    fields.push({
      id: 'payload',
      name: 'Payload',
      offset: V1_PAYLOAD_OFFSET,
      length: declaredLength,
      rawBytes: payload,
      unit: 'B',
      valid: true,
      warnings: [WARN_PAYLOAD_NEEDS_DIALECT],
    });
    warnings.push(toProtocolWarning(WARN_PAYLOAD_NEEDS_DIALECT));
  }

  const checksumOffset = V1_PAYLOAD_OFFSET + declaredLength;
  const checksumValue = readUint16Le(data, checksumOffset);
  fields.push({
    id: 'checksum',
    name: 'Checksum (CRC-16/MCRF4XX)',
    offset: checksumOffset,
    length: V1_CHECKSUM_LENGTH,
    rawBytes: data.slice(checksumOffset, checksumOffset + V1_CHECKSUM_LENGTH),
    rawValue: checksumValue,
    // Doğrulanamayan bir şey "yanlış" ilan edilmez: varlığı doğrulanır,
    // doğruluğu değil — checksum-mismatch bu motorda HİÇ basılmaz (dosya başı).
    valid: true,
    warnings: [WARN_CRC_NEEDS_DIALECT],
  });
  warnings.push(toProtocolWarning(WARN_CRC_NEEDS_DIALECT));

  const afterChecksum = checksumOffset + V1_CHECKSUM_LENGTH;
  if (data.length > afterChecksum) {
    pushTrailingField(data, afterChecksum, fields, warnings);
  }

  return finishFrame(data, fields, warnings, errors, options, finishInfo);
}

function parseMavlinkV2(data: Uint8Array, options: MavlinkParseOptions): ParseResult {
  if (data.length < V2_HEADER_LENGTH) {
    return {
      success: false,
      error: {
        code: 'truncated-frame',
        message: ERROR_V2_HEADER_TRUNCATED,
        offset: 0,
        length: data.length,
      },
      consumedBytes: 0,
      recoverable: true,
    };
  }

  const fields: ParsedField[] = [];
  const warnings: ProtocolWarning[] = [];
  const errors: ProtocolError[] = [];

  fields.push({
    id: 'magic',
    name: 'Magic (STX)',
    offset: 0,
    length: 1,
    rawBytes: data.slice(0, 1),
    rawValue: MAGIC_V2,
    physicalValue: 'MAVLink 2',
    valid: true,
    warnings: [],
  });

  const declaredLength = byteAt(data, V2_LEN_OFFSET);
  fields.push({
    id: 'payload-length',
    name: 'Payload Length',
    offset: V2_LEN_OFFSET,
    length: 1,
    rawBytes: data.slice(V2_LEN_OFFSET, V2_LEN_OFFSET + 1),
    rawValue: declaredLength,
    unit: 'B',
    valid: true,
    warnings: [],
  });

  const incompatFlags = byteAt(data, V2_INCOMPAT_OFFSET);
  const signed = (incompatFlags & INCOMPAT_FLAG_SIGNED) !== 0;
  const incompatField: ParsedField = {
    id: 'incompat-flags',
    name: 'Incompat Flags',
    offset: V2_INCOMPAT_OFFSET,
    length: 1,
    rawBytes: data.slice(V2_INCOMPAT_OFFSET, V2_INCOMPAT_OFFSET + 1),
    rawValue: incompatFlags,
    valid: true,
    warnings: [],
  };
  // Yalnız bit 0x01 (signing) spec'te tanımlı; diğer bitlerin anlamı
  // bilinmiyor, bu yüzden yalnız signed durumunda physicalValue yazılır.
  if (signed) {
    incompatField.physicalValue = 'Signed';
  }
  fields.push(incompatField);

  const compatFlags = byteAt(data, V2_COMPAT_OFFSET);
  fields.push({
    id: 'compat-flags',
    name: 'Compat Flags',
    offset: V2_COMPAT_OFFSET,
    length: 1,
    rawBytes: data.slice(V2_COMPAT_OFFSET, V2_COMPAT_OFFSET + 1),
    rawValue: compatFlags,
    valid: true,
    warnings: [],
  });

  const seq = byteAt(data, V2_SEQ_OFFSET);
  fields.push({
    id: 'seq',
    name: 'Packet Sequence',
    offset: V2_SEQ_OFFSET,
    length: 1,
    rawBytes: data.slice(V2_SEQ_OFFSET, V2_SEQ_OFFSET + 1),
    rawValue: seq,
    valid: true,
    warnings: [],
  });

  const systemId = byteAt(data, V2_SYSID_OFFSET);
  fields.push({
    id: 'system-id',
    name: 'System ID',
    offset: V2_SYSID_OFFSET,
    length: 1,
    rawBytes: data.slice(V2_SYSID_OFFSET, V2_SYSID_OFFSET + 1),
    rawValue: systemId,
    valid: true,
    warnings: [],
  });

  const componentId = byteAt(data, V2_COMPID_OFFSET);
  fields.push({
    id: 'component-id',
    name: 'Component ID',
    offset: V2_COMPID_OFFSET,
    length: 1,
    rawBytes: data.slice(V2_COMPID_OFFSET, V2_COMPID_OFFSET + 1),
    rawValue: componentId,
    valid: true,
    warnings: [],
  });

  const messageId = readUint24Le(data, V2_MSGID_OFFSET);
  fields.push({
    id: 'message-id',
    name: 'Message ID',
    offset: V2_MSGID_OFFSET,
    length: V2_MSGID_LENGTH,
    rawBytes: data.slice(V2_MSGID_OFFSET, V2_MSGID_OFFSET + V2_MSGID_LENGTH),
    rawValue: messageId,
    valid: true,
    warnings: [],
  });

  const finishInfo: FinishInput = { version: 'v2', messageId, systemId, componentId, seq, signed };

  const totalFrameLength =
    V2_PAYLOAD_OFFSET + declaredLength + V2_CHECKSUM_LENGTH + (signed ? V2_SIGNATURE_LENGTH : 0);
  if (data.length < totalFrameLength) {
    errors.push({
      code: 'truncated-frame',
      message: ERROR_BODY_TRUNCATED,
      offset: V2_PAYLOAD_OFFSET,
      length: totalFrameLength - data.length,
      details: { declaredLength, signed, availableAfterHeader: data.length - V2_PAYLOAD_OFFSET },
    });
    return finishFrame(data, fields, warnings, errors, options, finishInfo);
  }

  if (declaredLength > 0) {
    const payload = data.slice(V2_PAYLOAD_OFFSET, V2_PAYLOAD_OFFSET + declaredLength);
    fields.push({
      id: 'payload',
      name: 'Payload',
      offset: V2_PAYLOAD_OFFSET,
      length: declaredLength,
      rawBytes: payload,
      unit: 'B',
      valid: true,
      warnings: [WARN_PAYLOAD_NEEDS_DIALECT],
    });
    warnings.push(toProtocolWarning(WARN_PAYLOAD_NEEDS_DIALECT));
  }

  const checksumOffset = V2_PAYLOAD_OFFSET + declaredLength;
  const checksumValue = readUint16Le(data, checksumOffset);
  fields.push({
    id: 'checksum',
    name: 'Checksum (CRC-16/MCRF4XX)',
    offset: checksumOffset,
    length: V2_CHECKSUM_LENGTH,
    rawBytes: data.slice(checksumOffset, checksumOffset + V2_CHECKSUM_LENGTH),
    rawValue: checksumValue,
    valid: true,
    warnings: [WARN_CRC_NEEDS_DIALECT],
  });
  warnings.push(toProtocolWarning(WARN_CRC_NEEDS_DIALECT));

  let afterBody = checksumOffset + V2_CHECKSUM_LENGTH;
  if (signed) {
    const signature = data.slice(afterBody, afterBody + V2_SIGNATURE_LENGTH);
    fields.push({
      id: 'signature',
      name: 'Signature',
      offset: afterBody,
      length: V2_SIGNATURE_LENGTH,
      rawBytes: signature,
      // Var olduğu doğrulanır, geçerliliği değil — gizli anahtar olmadan
      // MAVLink 2 signing doğrulaması matematiksel olarak yapılamaz (dosya başı).
      valid: true,
      warnings: [WARN_SIGNATURE_NEEDS_KEY],
    });
    warnings.push(toProtocolWarning(WARN_SIGNATURE_NEEDS_KEY));
    afterBody += V2_SIGNATURE_LENGTH;
  }

  if (data.length > afterBody) {
    pushTrailingField(data, afterBody, fields, warnings);
  }

  return finishFrame(data, fields, warnings, errors, options, finishInfo);
}

function parseMavlinkFrame(data: Uint8Array, options: MavlinkParseOptions): ParseResult {
  if (options.signal?.aborted === true) {
    return {
      success: false,
      error: { code: 'parser-timeout', message: ERROR_ABORTED },
      consumedBytes: 0,
      recoverable: false,
    };
  }

  if (options.maxFrameLength !== undefined && data.length > options.maxFrameLength) {
    return {
      success: false,
      error: {
        code: 'frame-too-long',
        message: ERROR_FRAME_TOO_LONG,
        offset: options.maxFrameLength,
        length: data.length - options.maxFrameLength,
        details: { maxFrameLength: options.maxFrameLength, frameLength: data.length },
      },
      consumedBytes: 0,
      recoverable: false,
    };
  }

  const magic = byteAt(data, 0);
  if (magic === MAGIC_V1) return parseMavlinkV1(data, options);
  if (magic === MAGIC_V2) return parseMavlinkV2(data, options);

  // v1 (0xFE) / v2 (0xFD) DIŞINDA bir magic — hangi header uzunluğunun (6 mı
  // 10 mu) denenmesi gerektiği bilinemez, bu yüzden alan alan kısmi gösterim
  // YOK, doğrudan HATA (rtcm.ts'in geçersiz preamble savunma katmanıyla aynı desen).
  return {
    success: false,
    error: {
      code: 'start-delimiter-not-found',
      message: ERROR_UNKNOWN_MAGIC,
      offset: 0,
      length: Math.min(data.length, 1),
      details: { magic: formatHexByte(magic) },
    },
    consumedBytes: 0,
    recoverable: true,
  };
}

export function parseMavlink(data: Uint8Array): ParseResult {
  return parseMavlinkFrame(data, {});
}

export const mavlinkParser: ProtocolParser = {
  protocolId: PROTOCOL_ID,
  displayName: PROTOCOL_DISPLAY_NAME,

  /** Ucuz ön eleme: yalnız magic baytı + versiyona göre asgari uzunluk. */
  canParse(data: Uint8Array): boolean {
    if (data.length < 1) return false;
    const magic = byteAt(data, 0);
    if (magic === MAGIC_V1) return data.length >= V1_MIN_FRAME_LENGTH;
    if (magic === MAGIC_V2) return data.length >= V2_MIN_FRAME_LENGTH;
    return false;
  },

  parse(data: Uint8Array, context?: ParseContext): ParseResult {
    const options: MavlinkParseOptions = {};
    if (context?.timestamp !== undefined) options.timestamp = context.timestamp;
    if (context?.direction !== undefined) options.direction = context.direction;
    if (context?.channel !== undefined) options.channel = context.channel;
    if (context?.maxFrameLength !== undefined) options.maxFrameLength = context.maxFrameLength;
    if (context?.signal !== undefined) options.signal = context.signal;
    return parseMavlinkFrame(data, options);
  },
};

/**
 * Örnek çerçeveler. `v1-heartbeat` spec'in KENDİ örnek renklendirmesinden
 * (`FE 09 2A 01 01 00 PAYLOAD... CRC`, spec ~17253) birebir alındı; kalanı bu
 * düzene göre elle inşa edildi. Payload/checksum içerikleri ANLAMSIZDIR
 * (dialect olmadan yorumlanamaz) — yalnız alan sınırlarını göstermeye yeter.
 * Yorumlardaki "HEARTBEAT/GPS_RAW_INT/COMMAND_LONG" gibi isimler MAVLink
 * `common.xml`in yaygın bilinen msgid numaralarına gönderme yapan YORUM
 * metnidir; parser bu isimleri hiç bilmez (dosya başı).
 */
const EXAMPLE_FRAMES: ExampleFrame[] = [
  {
    id: 'v1-heartbeat',
    name: 'protocol.mavlink.example.v1Heartbeat.name',
    // FE|LEN 09|SEQ 2A|SYS 01|CMP 01|MSG 00(HEARTBEAT)|9 bayt payload|2 bayt checksum.
    bytes: new Uint8Array([
      0xfe, 0x09, 0x2a, 0x01, 0x01, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0xab,
      0xcd,
    ]),
    description: 'protocol.mavlink.example.v1Heartbeat.description',
    expectedValid: true,
  },
  {
    id: 'v2-gps-raw-int',
    name: 'protocol.mavlink.example.v2GpsRawInt.name',
    // FD|LEN 08|IF 00|CF 00|SEQ 10|SYS 01|CMP 01|MSG 000018(GPS_RAW_INT)|8 bayt payload|checksum.
    bytes: new Uint8Array([
      0xfd, 0x08, 0x00, 0x00, 0x10, 0x01, 0x01, 0x18, 0x00, 0x00, 0x11, 0x22, 0x33, 0x44, 0x55, 0x66,
      0x77, 0x88, 0x9a, 0xbc,
    ]),
    description: 'protocol.mavlink.example.v2GpsRawInt.description',
    expectedValid: true,
  },
  {
    id: 'v2-signed',
    name: 'protocol.mavlink.example.v2Signed.name',
    // FD|LEN 04|IF 01(Signed)|CF 00|SEQ 20|SYS 02|CMP 01|MSG 00004C(COMMAND_LONG)|
    // 4 bayt payload|checksum|13 baytlık imza (ham, doğrulanmaz).
    bytes: new Uint8Array([
      0xfd, 0x04, 0x01, 0x00, 0x20, 0x02, 0x01, 0x4c, 0x00, 0x00, 0xde, 0xad, 0xbe, 0xef, 0x12, 0x34,
      0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0x0c, 0x0d,
    ]),
    description: 'protocol.mavlink.example.v2Signed.description',
    expectedValid: true,
  },
  {
    id: 'v2-large-message-id',
    name: 'protocol.mavlink.example.v2LargeMessageId.name',
    // FD|LEN 02|IF 00|CF 00|SEQ FF|SYS EE|CMP DD|MSG FFFFFF (24-bit üst sınır)|
    // 2 bayt payload|checksum — flags/seq/sysid/compid ile MSGID'in üst üste
    // BİNMEDİĞİNİ kanıtlar (dosya başı tuzak notu).
    bytes: new Uint8Array([0xfd, 0x02, 0x00, 0x00, 0xff, 0xee, 0xdd, 0xff, 0xff, 0xff, 0xaa, 0xbb, 0x55, 0x66]),
    description: 'protocol.mavlink.example.v2LargeMessageId.description',
    expectedValid: true,
  },
  {
    id: 'v1-truncated',
    name: 'protocol.mavlink.example.v1Truncated.name',
    // Header LEN 04 diyor (4 baytlık payload + 2 baytlık checksum = 6 bayt daha
    // gerekir) ama header'dan sonra yalnız 2 bayt var — truncated-frame basar.
    bytes: new Uint8Array([0xfe, 0x04, 0x01, 0x01, 0x01, 0x00, 0xaa, 0xbb]),
    description: 'protocol.mavlink.example.v1Truncated.description',
    expectedValid: false,
  },
];

export const mavlinkPlugin: ProtocolPlugin = {
  id: PROTOCOL_ID,
  name: PROTOCOL_DISPLAY_NAME,
  category: 'aerospace-uav',
  parser: mavlinkParser,
  documentation: {
    summary: 'protocol.mavlink.documentation.summary',
    layer: 'application',
  },
  exampleFrames: EXAMPLE_FRAMES,
};
