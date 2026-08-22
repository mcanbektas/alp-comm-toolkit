/**
 * RTCP (RTP Control Protocol, RFC 3550 §6) — RTP oturumunun delivery-quality
 * ve participant-info kanalı. Girdi bir COMPOUND RTCP paketidir: RFC 3550 §6.1
 * en az iki alt paketin (ilki SR ya da RR) art arda geldiği tek bir UDP
 * datagramı ister — bu yüzden `udp.ts`/`coap.ts`nin aksine burada "tek mesaj"
 * değil "art arda dizili mesajlar" okunur.
 *
 * ── DÜZ ALAN LİSTESİ, AĞAÇ DEĞİL ─────────────────────────────────────────────
 * Spec "Compound RTCP paketindeki her alt paket ayrı tree node olmalı" der
 * (`08-ag-ethernet.md:571`) ama `ParsedField` DÜZ bir dizidir, `children`
 * taşımaz (`protocol-core/types.ts:38-54` — dalga 10/11'in mimari kararı,
 * bu dalgada YENİDEN AÇILMADI). Ağaç görünümü yerine her alt paketin alanı
 * kendi `offset`iyle ayrışır ve alan adı hangi alt pakete ait olduğunu taşır
 * (ör. "SR SSRC", "RR Report Block 0 Fraction Lost").
 *
 * ── ÇERÇEVELEME `length` ALANINA GÜVENİR, RC/SC'YE DEĞİL ─────────────────────
 * Her alt paketin kendi `length` alanı (32-bit kelime cinsinden, kendisi hariç)
 * bir sonraki alt paketin nerede başladığını KESİN olarak verir — bu yüzden
 * döngü İÇERİK doğru çözülemese bile `length` kadar ilerler ve sıradaki alt
 * pakete geçer (gerçek bir yakalama aracının yapacağı gibi). Yalnız `length`in
 * KENDİSİ tamponun dışına taşarsa (bir sonraki paketin nerede başladığı
 * BİLİNEMEZ hâle gelirse) döngü durur — bu FATAL, içerik hatası DEĞİL.
 *
 * ── SR/RR RAPOR BLOKLARINDA NTP KISAYOLU GERÇEK ─────────────────────────────
 * SR'nin NTP Timestamp alanı `ntp.ts`teki BİREBİR aynı 64-bit tel biçimidir
 * (RFC 3550 §6.4.1: "same format as NTP timestamps") — `ntpTimestamp.ts`
 * BURADA YENİDEN AÇILAN bir öngörü değil, GERÇEK paylaşım (dalga 12c'nin
 * `dnsWire.ts` durumunun aynı cinsi, 12b/12d'nin YANLIŞ ÇIKAN öngörülerinin
 * TERSİ). DLSR de aynı tel biçiminin "short format" hâli (`readNtpShortMilliseconds`,
 * RFC 3550: "units of 1/65536 seconds" = NTP short format'ın ta kendisi).
 * LSR ise (NTP damgasının ORTA 32 biti) BİLİNÇLİ OLARAK ham bırakılır: tek
 * başına anlamlı değildir, ilgili SR'nin TAM NTP damgasıyla korelasyon ister
 * (spec §35'in "kısmi çözüm" ilkesiyle aynı temkin — icmpv6'nın pseudo-header
 * kısayolu almaması gibi, burada da sahte bir mutlak zaman UYDURULMAZ).
 *
 * ── PADDING YALNIZ SON ALT PAKETTE GEÇERLİDİR (UYARI, HATA DEĞİL) ────────────
 * RFC 3550 §6.1 dolgunun yalnız compound paketin SON alt paketinde geçerli
 * olduğunu söyler; ihlali PARSER'I durdurmaz (yapı yine okunur), yalnız
 * `WARN_PADDING_NOT_LAST` ile bildirilir.
 */

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
import { readNtpShortMilliseconds, readNtpTimestamp } from '@/protocols/network/time/ntpTimestamp';

const PROTOCOL_ID = 'rtcp';
/** Protokol adı veridir, çeviriye girmez (CLAUDE.md). */
const PROTOCOL_DISPLAY_NAME = 'RTCP';

const COMMON_HEADER_LENGTH = 4;
const REPORT_BLOCK_LENGTH = 24;
const SR_FIXED_BODY_LENGTH = 24;
const RR_FIXED_BODY_LENGTH = 4;

const VERSION_BIT_LENGTH = 2;
const PADDING_BIT_POSITION_IN_BYTE = 2;
const PADDING_BIT_LENGTH = 1;
const COUNT_BIT_POSITION_IN_BYTE = 3;
const COUNT_BIT_LENGTH = 5;

const EXPECTED_VERSION = 2;

const PT_SR = 200;
const PT_RR = 201;
const PT_SDES = 202;
const PT_BYE = 203;
const PT_APP = 204;

const PACKET_TYPE_NAMES: ReadonlyMap<number, string> = new Map([
  [PT_SR, 'SR (Sender Report)'],
  [PT_RR, 'RR (Receiver Report)'],
  [PT_SDES, 'SDES (Source Description)'],
  [PT_BYE, 'BYE (Goodbye)'],
  [PT_APP, 'APP (Application-Defined)'],
]);

const SDES_ITEM_END = 0;
const SDES_ITEM_PRIV = 8;
const SDES_ITEM_NAMES: ReadonlyMap<number, string> = new Map([
  [1, 'CNAME'],
  [2, 'NAME'],
  [3, 'EMAIL'],
  [4, 'PHONE'],
  [5, 'LOC'],
  [6, 'TOOL'],
  [7, 'NOTE'],
  [SDES_ITEM_PRIV, 'PRIV'],
]);
const SDES_CHUNK_ALIGNMENT = 4;

const ERROR_HEADER_TRUNCATED = 'protocol.rtcp.error.headerTruncated';
const ERROR_LENGTH_TRUNCATED = 'protocol.rtcp.error.lengthTruncated';
const ERROR_BODY_TRUNCATED = 'protocol.rtcp.error.bodyTruncated';
const ERROR_PADDING_INVALID = 'protocol.rtcp.error.paddingInvalid';
const ERROR_FRAME_TOO_LONG = 'protocol.rtcp.error.frameTooLong';
const ERROR_ABORTED = 'protocol.rtcp.error.aborted';

const WARN_VERSION_UNEXPECTED = 'protocol.rtcp.warning.versionUnexpected';
const WARN_UNKNOWN_PACKET_TYPE = 'protocol.rtcp.warning.unknownPacketType';
const WARN_COMPOUND_MUST_START_WITH_REPORT = 'protocol.rtcp.warning.compoundMustStartWithReport';
const WARN_PADDING_NOT_LAST = 'protocol.rtcp.warning.paddingNotLast';

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
    ((byteAt(data, offset) << 24) |
      (byteAt(data, offset + 1) << 16) |
      (byteAt(data, offset + 2) << 8) |
      byteAt(data, offset + 3)) >>>
    0
  );
}

/** Cumulative Number of Packets Lost — İŞARETLİ 24 bit (RFC 3550 §6.4.1). */
function readInt24BE(data: Uint8Array, offset: number): number {
  const unsigned = (byteAt(data, offset) << 16) | (byteAt(data, offset + 1) << 8) | byteAt(data, offset + 2);
  const SIGN_BIT = 0x800000;
  const TWO_COMPLEMENT_RANGE = 0x1000000;
  return unsigned >= SIGN_BIT ? unsigned - TWO_COMPLEMENT_RANGE : unsigned;
}

const textDecoder = new TextDecoder('utf-8', { fatal: false });

function decodeText(data: Uint8Array, offset: number, length: number): string {
  return textDecoder.decode(data.slice(offset, offset + length));
}

interface RtcpParseOptions {
  timestamp?: number;
  direction?: FrameDirection;
  channel?: string;
  maxFrameLength?: number;
  signal?: AbortSignal;
}

function finishFrame(
  data: Uint8Array,
  fields: ParsedField[],
  warnings: ProtocolWarning[],
  errors: ProtocolError[],
  options: RtcpParseOptions,
): ParseResult {
  const rawFrame = createRawFrame(data, {
    ...(options.timestamp === undefined ? {} : { timestamp: options.timestamp }),
    ...(options.direction === undefined ? {} : { direction: options.direction }),
    ...(options.channel === undefined ? {} : { channel: options.channel }),
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

/**
 * SR/RR'nin ortak rapor bloğu (24 bayt, RFC 3550 §6.4.1). `labelPrefix`
 * alan adlarına hangi alt pakete ait olduğunu taşır (düz liste, dosya başı).
 */
function pushReportBlock(data: Uint8Array, offset: number, labelPrefix: string, blockIndex: number, fields: ParsedField[]): void {
  const label = `${labelPrefix} Report Block ${String(blockIndex)}`;

  fields.push({
    id: `report-block-ssrc-${String(offset)}`,
    name: `${label} SSRC`,
    offset,
    length: 4,
    rawBytes: data.slice(offset, offset + 4),
    rawValue: readUint32BE(data, offset),
    valid: true,
    warnings: [],
  });

  const fractionLost = byteAt(data, offset + 4);
  fields.push({
    id: `report-block-fraction-lost-${String(offset)}`,
    name: `${label} Fraction Lost`,
    offset: offset + 4,
    length: 1,
    rawBytes: data.slice(offset + 4, offset + 5),
    rawValue: fractionLost,
    physicalValue: (fractionLost / 256) * 100,
    unit: '%',
    valid: true,
    warnings: [],
  });

  fields.push({
    id: `report-block-cumulative-lost-${String(offset)}`,
    name: `${label} Cumulative Lost`,
    offset: offset + 5,
    length: 3,
    rawBytes: data.slice(offset + 5, offset + 8),
    rawValue: readInt24BE(data, offset + 5),
    valid: true,
    warnings: [],
  });

  fields.push({
    id: `report-block-extended-seq-${String(offset)}`,
    name: `${label} Extended Highest Sequence Number Received`,
    offset: offset + 8,
    length: 4,
    rawBytes: data.slice(offset + 8, offset + 12),
    rawValue: readUint32BE(data, offset + 8),
    valid: true,
    warnings: [],
  });

  fields.push({
    id: `report-block-jitter-${String(offset)}`,
    name: `${label} Interarrival Jitter`,
    offset: offset + 12,
    length: 4,
    rawBytes: data.slice(offset + 12, offset + 16),
    rawValue: readUint32BE(data, offset + 12),
    valid: true,
    warnings: [],
  });

  // LSR tek başına yorumlanmaz (dosya başı) — ham bırakılır.
  fields.push({
    id: `report-block-lsr-${String(offset)}`,
    name: `${label} Last SR Timestamp (LSR)`,
    offset: offset + 16,
    length: 4,
    rawBytes: data.slice(offset + 16, offset + 20),
    rawValue: readUint32BE(data, offset + 16),
    valid: true,
    warnings: [],
  });

  fields.push({
    id: `report-block-dlsr-${String(offset)}`,
    name: `${label} Delay Since Last SR (DLSR)`,
    offset: offset + 20,
    length: 4,
    rawBytes: data.slice(offset + 20, offset + 24),
    rawValue: readUint32BE(data, offset + 20),
    physicalValue: readNtpShortMilliseconds(data, offset + 20),
    unit: 'ms',
    valid: true,
    warnings: [],
  });
}

/**
 * SR/RR gövdesi: sabit alanlar + `reportCount` rapor bloğu. `bodyEnd` dolgu
 * çıkarılmış sınırdır — rapor blokları buna sığmıyorsa `truncated-frame`
 * basılır ama döngü çağıran tarafından `length` alanıyla devam ettirilir
 * (dosya başı, "çerçeveleme `length`e güvenir" kararı).
 */
function pushSenderOrReceiverReport(
  data: Uint8Array,
  bodyStart: number,
  bodyEnd: number,
  reportCount: number,
  isSenderReport: boolean,
  fields: ParsedField[],
  errors: ProtocolError[],
): void {
  const label = isSenderReport ? 'SR' : 'RR';

  fields.push({
    id: `report-ssrc-${String(bodyStart)}`,
    name: `${label} SSRC`,
    offset: bodyStart,
    length: 4,
    rawBytes: data.slice(bodyStart, bodyStart + 4),
    rawValue: readUint32BE(data, bodyStart),
    valid: true,
    warnings: [],
  });

  let reportBlocksStart = bodyStart + RR_FIXED_BODY_LENGTH;

  if (isSenderReport) {
    const ntp = readNtpTimestamp(data, bodyStart + 4);
    fields.push({
      id: `report-ntp-timestamp-${String(bodyStart + 4)}`,
      name: `${label} NTP Timestamp`,
      offset: bodyStart + 4,
      length: 8,
      rawBytes: data.slice(bodyStart + 4, bodyStart + 12),
      rawValue: ntp.raw,
      ...(ntp.iso === undefined ? {} : { physicalValue: ntp.iso }),
      valid: true,
      warnings: [],
    });

    fields.push({
      id: `report-rtp-timestamp-${String(bodyStart + 12)}`,
      name: `${label} RTP Timestamp`,
      offset: bodyStart + 12,
      length: 4,
      rawBytes: data.slice(bodyStart + 12, bodyStart + 16),
      rawValue: readUint32BE(data, bodyStart + 12),
      valid: true,
      warnings: [],
    });

    fields.push({
      id: `report-sender-packet-count-${String(bodyStart + 16)}`,
      name: `${label} Sender Packet Count`,
      offset: bodyStart + 16,
      length: 4,
      rawBytes: data.slice(bodyStart + 16, bodyStart + 20),
      rawValue: readUint32BE(data, bodyStart + 16),
      valid: true,
      warnings: [],
    });

    fields.push({
      id: `report-sender-octet-count-${String(bodyStart + 20)}`,
      name: `${label} Sender Octet Count`,
      offset: bodyStart + 20,
      length: 4,
      rawBytes: data.slice(bodyStart + 20, bodyStart + 24),
      rawValue: readUint32BE(data, bodyStart + 20),
      unit: 'B',
      valid: true,
      warnings: [],
    });

    reportBlocksStart = bodyStart + SR_FIXED_BODY_LENGTH;
  }

  for (let i = 0; i < reportCount; i += 1) {
    const blockOffset = reportBlocksStart + i * REPORT_BLOCK_LENGTH;
    if (blockOffset + REPORT_BLOCK_LENGTH > bodyEnd) {
      errors.push({
        code: 'truncated-frame',
        message: ERROR_BODY_TRUNCATED,
        offset: blockOffset,
        length: Math.max(0, bodyEnd - blockOffset),
        details: { reportCount, missingFromBlockIndex: i },
      });
      return;
    }
    pushReportBlock(data, blockOffset, label, i, fields);
  }
}

/**
 * SDES gövdesi: `chunkCount` chunk, her biri SSRC/CSRC + item listesi + END
 * (0x00) + 32-bit hizalamaya dolgu (RFC 3550 §6.5).
 */
function pushSourceDescription(
  data: Uint8Array,
  bodyStart: number,
  bodyEnd: number,
  chunkCount: number,
  fields: ParsedField[],
  errors: ProtocolError[],
): void {
  let pos = bodyStart;

  for (let chunkIndex = 0; chunkIndex < chunkCount; chunkIndex += 1) {
    if (pos + 4 > bodyEnd) {
      errors.push({
        code: 'truncated-frame',
        message: ERROR_BODY_TRUNCATED,
        offset: pos,
        length: Math.max(0, bodyEnd - pos),
        details: { chunkCount, missingFromChunkIndex: chunkIndex },
      });
      return;
    }
    const chunkStart = pos;
    fields.push({
      id: `sdes-chunk-ssrc-${String(chunkStart)}`,
      name: `SDES Chunk ${String(chunkIndex)} SSRC`,
      offset: chunkStart,
      length: 4,
      rawBytes: data.slice(chunkStart, chunkStart + 4),
      rawValue: readUint32BE(data, chunkStart),
      valid: true,
      warnings: [],
    });
    pos = chunkStart + 4;

    for (;;) {
      if (pos >= bodyEnd) {
        errors.push({
          code: 'truncated-frame',
          message: ERROR_BODY_TRUNCATED,
          offset: pos,
          length: 0,
          details: { chunkIndex },
        });
        return;
      }
      const itemType = byteAt(data, pos);
      if (itemType === SDES_ITEM_END) {
        pos += 1;
        break;
      }
      if (pos + 2 > bodyEnd) {
        errors.push({
          code: 'truncated-frame',
          message: ERROR_BODY_TRUNCATED,
          offset: pos,
          length: Math.max(0, bodyEnd - pos),
          details: { chunkIndex },
        });
        return;
      }
      const itemLength = byteAt(data, pos + 1);
      const itemValueOffset = pos + 2;
      const itemValueEnd = itemValueOffset + itemLength;
      if (itemValueEnd > bodyEnd) {
        errors.push({
          code: 'truncated-frame',
          message: ERROR_BODY_TRUNCATED,
          offset: pos,
          length: Math.max(0, bodyEnd - pos),
          details: { chunkIndex, itemType, itemLength },
        });
        return;
      }
      const itemName = SDES_ITEM_NAMES.get(itemType) ?? `Unknown(${String(itemType)})`;
      if (itemType === SDES_ITEM_PRIV && itemLength >= 1) {
        const prefixLength = byteAt(data, itemValueOffset);
        const prefixEnd = itemValueOffset + 1 + prefixLength;
        if (prefixEnd <= itemValueEnd) {
          fields.push({
            id: `sdes-item-${String(pos)}`,
            name: `SDES Chunk ${String(chunkIndex)} PRIV`,
            offset: pos,
            length: itemValueEnd - pos,
            rawBytes: data.slice(pos, itemValueEnd),
            physicalValue: `${decodeText(data, itemValueOffset + 1, prefixLength)}=${decodeText(data, prefixEnd, itemValueEnd - prefixEnd)}`,
            valid: true,
            warnings: [],
          });
        } else {
          fields.push({
            id: `sdes-item-${String(pos)}`,
            name: `SDES Chunk ${String(chunkIndex)} PRIV`,
            offset: pos,
            length: itemValueEnd - pos,
            rawBytes: data.slice(pos, itemValueEnd),
            valid: false,
            warnings: [ERROR_BODY_TRUNCATED],
          });
        }
      } else {
        fields.push({
          id: `sdes-item-${String(pos)}`,
          name: `SDES Chunk ${String(chunkIndex)} ${itemName}`,
          offset: pos,
          length: itemValueEnd - pos,
          rawBytes: data.slice(pos, itemValueEnd),
          physicalValue: decodeText(data, itemValueOffset, itemLength),
          valid: true,
          warnings: [],
        });
      }
      pos = itemValueEnd;
    }

    const chunkLength = pos - chunkStart;
    const alignedLength = Math.ceil(chunkLength / SDES_CHUNK_ALIGNMENT) * SDES_CHUNK_ALIGNMENT;
    pos = chunkStart + alignedLength;
  }
}

/** BYE gövdesi: `sourceCount` SSRC/CSRC + opsiyonel sebep metni (RFC 3550 §6.6). */
function pushGoodbye(
  data: Uint8Array,
  bodyStart: number,
  bodyEnd: number,
  sourceCount: number,
  fields: ParsedField[],
  errors: ProtocolError[],
): void {
  let pos = bodyStart;
  for (let i = 0; i < sourceCount; i += 1) {
    if (pos + 4 > bodyEnd) {
      errors.push({
        code: 'truncated-frame',
        message: ERROR_BODY_TRUNCATED,
        offset: pos,
        length: Math.max(0, bodyEnd - pos),
        details: { sourceCount, missingFromIndex: i },
      });
      return;
    }
    fields.push({
      id: `bye-source-${String(pos)}`,
      name: `BYE Source[${String(i)}]`,
      offset: pos,
      length: 4,
      rawBytes: data.slice(pos, pos + 4),
      rawValue: readUint32BE(data, pos),
      valid: true,
      warnings: [],
    });
    pos += 4;
  }

  if (pos < bodyEnd) {
    const reasonLength = byteAt(data, pos);
    const reasonStart = pos + 1;
    const reasonEnd = reasonStart + reasonLength;
    if (reasonEnd > bodyEnd) {
      errors.push({
        code: 'truncated-frame',
        message: ERROR_BODY_TRUNCATED,
        offset: pos,
        length: bodyEnd - pos,
      });
      return;
    }
    fields.push({
      id: `bye-reason-${String(pos)}`,
      name: 'BYE Reason for Leaving',
      offset: pos,
      length: reasonEnd - pos,
      rawBytes: data.slice(pos, reasonEnd),
      physicalValue: decodeText(data, reasonStart, reasonLength),
      valid: true,
      warnings: [],
    });
  }
}

/** APP gövdesi: SSRC/CSRC + 4 karakterlik isim + uygulamaya özgü ham veri (RFC 3550 §6.7). */
function pushApplicationDefined(
  data: Uint8Array,
  bodyStart: number,
  bodyEnd: number,
  fields: ParsedField[],
  errors: ProtocolError[],
): void {
  if (bodyStart + 8 > bodyEnd) {
    errors.push({
      code: 'truncated-frame',
      message: ERROR_BODY_TRUNCATED,
      offset: bodyStart,
      length: Math.max(0, bodyEnd - bodyStart),
    });
    return;
  }
  fields.push({
    id: `app-ssrc-${String(bodyStart)}`,
    name: 'APP SSRC',
    offset: bodyStart,
    length: 4,
    rawBytes: data.slice(bodyStart, bodyStart + 4),
    rawValue: readUint32BE(data, bodyStart),
    valid: true,
    warnings: [],
  });
  fields.push({
    id: `app-name-${String(bodyStart + 4)}`,
    name: 'APP Name',
    offset: bodyStart + 4,
    length: 4,
    rawBytes: data.slice(bodyStart + 4, bodyStart + 8),
    physicalValue: decodeText(data, bodyStart + 4, 4),
    valid: true,
    warnings: [],
  });
  if (bodyEnd > bodyStart + 8) {
    fields.push({
      id: `app-data-${String(bodyStart + 8)}`,
      name: 'APP Data',
      offset: bodyStart + 8,
      length: bodyEnd - (bodyStart + 8),
      rawBytes: data.slice(bodyStart + 8, bodyEnd),
      unit: 'B',
      valid: true,
      warnings: [],
    });
  }
}

/** Bir compound RTCP paketindeki tek alt paketi çözer; bir sonrakinin nerede başladığını döner. */
function parseSubPacket(
  data: Uint8Array,
  pktStart: number,
  subPacketIndex: number,
  fields: ParsedField[],
  warnings: ProtocolWarning[],
  errors: ProtocolError[],
): { nextOffset: number; packetType: number; paddingSet: boolean } | undefined {
  if (pktStart + COMMON_HEADER_LENGTH > data.length) {
    errors.push({
      code: 'truncated-frame',
      message: ERROR_HEADER_TRUNCATED,
      offset: pktStart,
      length: data.length - pktStart,
    });
    return undefined;
  }

  const version = readBitsAsNumber(data, pktStart * 8, VERSION_BIT_LENGTH);
  const versionValid = version === EXPECTED_VERSION;
  const versionField: ParsedField = {
    id: `common-version-${String(pktStart)}`,
    name: `RTCP Packet ${String(subPacketIndex)} Version`,
    offset: pktStart,
    length: 1,
    rawBytes: data.slice(pktStart, pktStart + 1),
    rawValue: version,
    valid: versionValid,
    warnings: [],
  };
  if (!versionValid) {
    versionField.warnings.push(WARN_VERSION_UNEXPECTED);
    warnings.push(toProtocolWarning(WARN_VERSION_UNEXPECTED));
  }
  fields.push(versionField);

  const padding = readBitsAsNumber(data, pktStart * 8 + PADDING_BIT_POSITION_IN_BYTE, PADDING_BIT_LENGTH);
  fields.push({
    id: `common-padding-${String(pktStart)}`,
    name: `RTCP Packet ${String(subPacketIndex)} Padding`,
    offset: pktStart,
    length: 1,
    rawBytes: data.slice(pktStart, pktStart + 1),
    rawValue: padding,
    physicalValue: padding === 1 ? 'Present' : 'Absent',
    valid: true,
    warnings: [],
  });

  const count = readBitsAsNumber(data, pktStart * 8 + COUNT_BIT_POSITION_IN_BYTE, COUNT_BIT_LENGTH);
  const packetType = byteAt(data, pktStart + 1);
  const countLabel =
    packetType === PT_SR || packetType === PT_RR
      ? 'Reception Report Count'
      : packetType === PT_SDES || packetType === PT_BYE
        ? 'Source Count'
        : 'Subtype';
  fields.push({
    id: `common-count-${String(pktStart)}`,
    name: `RTCP Packet ${String(subPacketIndex)} ${countLabel}`,
    offset: pktStart,
    length: 1,
    rawBytes: data.slice(pktStart, pktStart + 1),
    rawValue: count,
    valid: true,
    warnings: [],
  });

  const packetTypeName = PACKET_TYPE_NAMES.get(packetType);
  const packetTypeField: ParsedField = {
    id: `common-packet-type-${String(pktStart + 1)}`,
    name: `RTCP Packet ${String(subPacketIndex)} Packet Type`,
    offset: pktStart + 1,
    length: 1,
    rawBytes: data.slice(pktStart + 1, pktStart + 2),
    rawValue: packetType,
    valid: true,
    warnings: [],
  };
  if (packetTypeName !== undefined) {
    packetTypeField.physicalValue = packetTypeName;
  } else {
    packetTypeField.warnings.push(WARN_UNKNOWN_PACKET_TYPE);
    warnings.push(toProtocolWarning(WARN_UNKNOWN_PACKET_TYPE));
  }
  fields.push(packetTypeField);

  const lengthWords = readUint16BE(data, pktStart + 2);
  const subPacketByteLength = (lengthWords + 1) * 4;
  fields.push({
    id: `common-length-${String(pktStart + 2)}`,
    name: `RTCP Packet ${String(subPacketIndex)} Length`,
    offset: pktStart + 2,
    length: 2,
    rawBytes: data.slice(pktStart + 2, pktStart + 4),
    rawValue: lengthWords,
    physicalValue: subPacketByteLength,
    unit: 'B',
    valid: true,
    warnings: [],
  });

  const subPacketEnd = pktStart + subPacketByteLength;
  if (subPacketEnd > data.length) {
    // FATAL: bir sonraki alt paketin nerede başladığı bilinemez (dosya başı).
    errors.push({
      code: 'truncated-frame',
      message: ERROR_LENGTH_TRUNCATED,
      offset: pktStart,
      length: data.length - pktStart,
      details: { declaredByteLength: subPacketByteLength, available: data.length - pktStart },
    });
    return undefined;
  }

  let bodyEnd = subPacketEnd;
  const bodyStart = pktStart + COMMON_HEADER_LENGTH;
  if (padding === 1) {
    if (bodyStart >= subPacketEnd) {
      errors.push({
        code: 'value-out-of-range',
        message: ERROR_PADDING_INVALID,
        offset: bodyStart,
        length: 0,
      });
    } else {
      const padCount = byteAt(data, subPacketEnd - 1);
      const available = subPacketEnd - bodyStart;
      if (padCount === 0 || padCount > available) {
        errors.push({
          code: 'value-out-of-range',
          message: ERROR_PADDING_INVALID,
          offset: subPacketEnd - 1,
          length: 1,
          details: { padCount, available },
        });
      } else {
        bodyEnd = subPacketEnd - padCount;
        fields.push({
          id: `padding-bytes-${String(pktStart)}`,
          name: `RTCP Packet ${String(subPacketIndex)} Padding Bytes`,
          offset: bodyEnd,
          length: padCount,
          rawBytes: data.slice(bodyEnd, subPacketEnd),
          rawValue: padCount,
          unit: 'B',
          valid: true,
          warnings: [],
        });
      }
    }
  }

  switch (packetType) {
    case PT_SR:
      pushSenderOrReceiverReport(data, bodyStart, bodyEnd, count, true, fields, errors);
      break;
    case PT_RR:
      pushSenderOrReceiverReport(data, bodyStart, bodyEnd, count, false, fields, errors);
      break;
    case PT_SDES:
      pushSourceDescription(data, bodyStart, bodyEnd, count, fields, errors);
      break;
    case PT_BYE:
      pushGoodbye(data, bodyStart, bodyEnd, count, fields, errors);
      break;
    case PT_APP:
      pushApplicationDefined(data, bodyStart, bodyEnd, fields, errors);
      break;
    default:
      if (bodyEnd > bodyStart) {
        fields.push({
          id: `unknown-body-${String(bodyStart)}`,
          name: `RTCP Packet ${String(subPacketIndex)} Unknown Body`,
          offset: bodyStart,
          length: bodyEnd - bodyStart,
          rawBytes: data.slice(bodyStart, bodyEnd),
          unit: 'B',
          valid: true,
          warnings: [],
        });
      }
      break;
  }

  return { nextOffset: subPacketEnd, packetType, paddingSet: padding === 1 };
}

function parseRtcpFrame(data: Uint8Array, options: RtcpParseOptions): ParseResult {
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

  if (data.length < COMMON_HEADER_LENGTH) {
    return {
      success: false,
      error: {
        code: 'truncated-frame',
        message: ERROR_HEADER_TRUNCATED,
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

  let pos = 0;
  let subPacketIndex = 0;
  let firstPacketType: number | undefined;

  while (pos < data.length) {
    const result = parseSubPacket(data, pos, subPacketIndex, fields, warnings, errors);
    if (result === undefined) break;
    if (firstPacketType === undefined) firstPacketType = result.packetType;
    // "Son alt paket mi" ancak BİR SONRAKİ paketin var olup olmadığına
    // bakılarak bilinir (RFC 3550 §6.1) — bu yüzden uyarı burada, döngünün
    // kendisinde, `nextOffset === data.length` kontrolüyle basılır; `parseSubPacket`
    // içinde basılsaydı tek-paketlik (ve dolayısıyla hep "son") her akış
    // yanlışlıkla uyarı alırdı.
    if (result.paddingSet && result.nextOffset < data.length) {
      warnings.push(toProtocolWarning(WARN_PADDING_NOT_LAST));
    }
    pos = result.nextOffset;
    subPacketIndex += 1;
  }

  if (firstPacketType !== undefined && firstPacketType !== PT_SR && firstPacketType !== PT_RR) {
    warnings.push(toProtocolWarning(WARN_COMPOUND_MUST_START_WITH_REPORT));
  }

  return finishFrame(data, fields, warnings, errors, options);
}

export function parseRtcp(data: Uint8Array): ParseResult {
  return parseRtcpFrame(data, {});
}

function readContextOptions(context: ParseContext | undefined): RtcpParseOptions {
  const options: RtcpParseOptions = {};
  if (context?.timestamp !== undefined) options.timestamp = context.timestamp;
  if (context?.direction !== undefined) options.direction = context.direction;
  if (context?.channel !== undefined) options.channel = context.channel;
  if (context?.maxFrameLength !== undefined) options.maxFrameLength = context.maxFrameLength;
  if (context?.signal !== undefined) options.signal = context.signal;
  return options;
}

export const rtcpParser: ProtocolParser = {
  protocolId: PROTOCOL_ID,
  displayName: PROTOCOL_DISPLAY_NAME,

  /** Ucuz ön eleme: asgari ortak başlık + versiyon 2 + tanınan bir Packet Type. */
  canParse(data: Uint8Array): boolean {
    if (data.length < COMMON_HEADER_LENGTH) return false;
    if (readBitsAsNumber(data, 0, VERSION_BIT_LENGTH) !== EXPECTED_VERSION) return false;
    return PACKET_TYPE_NAMES.has(byteAt(data, 1));
  },

  parse(data: Uint8Array, context?: ParseContext): ParseResult {
    return parseRtcpFrame(data, readContextOptions(context));
  },
};

const EXAMPLE_FRAMES: ExampleFrame[] = [
  {
    id: 'sr-with-one-report-block',
    name: 'protocol.rtcp.example.srWithOneReportBlock.name',
    // V2 P0 RC1 PT200(SR) Length=12 words (52 bayt) — SSRC + NTP + RTP TS +
    // paket/oktet sayacı + tek rapor bloğu.
    bytes: Uint8Array.from([
      0x81, 0xc8, 0x00, 0x0c, 0x12, 0x34, 0x56, 0x78, 0xe4, 0x35, 0x9c, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x23, 0x28, 0x00, 0x00, 0x64, 0x00, 0x00, 0x00, 0x0c, 0x80, 0xaa, 0xbb, 0xcc, 0xdd,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00,
    ]),
    description: 'protocol.rtcp.example.srWithOneReportBlock.description',
    expectedValid: true,
  },
  {
    id: 'compound-rr-sdes',
    name: 'protocol.rtcp.example.compoundRrSdes.name',
    // RR (RC0, Length=1 word → 8 bayt) + SDES (SC1, tek CNAME chunk'ı, 4'e
    // hizalı) — gerçek bir compound RTCP paketi (RFC 3550 §6.1 minimumu).
    bytes: Uint8Array.from([
      // RR: V2 P0 RC0 PT201 Length=1 (8 bayt) + SSRC.
      0x80, 0xc9, 0x00, 0x01, 0x12, 0x34, 0x56, 0x78,
      // SDES: V2 P0 SC1 PT202 Length=3 (16 bayt) + chunk(SSRC + CNAME "a@b" + END + 2 dolgu).
      0x81, 0xca, 0x00, 0x03, 0x12, 0x34, 0x56, 0x78, 0x01, 0x03, 0x61, 0x40, 0x62, 0x00, 0x00, 0x00,
    ]),
    description: 'protocol.rtcp.example.compoundRrSdes.description',
    expectedValid: true,
  },
  {
    id: 'bye-with-reason',
    name: 'protocol.rtcp.example.byeWithReason.name',
    // BYE: V2 P0 SC1 PT203 Length=2 (12 bayt) — SSRC + "bye" sebep metni + dolgu.
    bytes: Uint8Array.from([0x81, 0xcb, 0x00, 0x02, 0x12, 0x34, 0x56, 0x78, 0x03, 0x62, 0x79, 0x65]),
    description: 'protocol.rtcp.example.byeWithReason.description',
    expectedValid: true,
  },
  {
    id: 'unknown-packet-type',
    name: 'protocol.rtcp.example.unknownPacketType.name',
    // PT=210 — RFC 3550'nin beş temel türünde YOK, ham gövde + uyarı yoluna düşer.
    bytes: Uint8Array.from([0x80, 0xd2, 0x00, 0x01, 0xde, 0xad, 0xbe, 0xef]),
    description: 'protocol.rtcp.example.unknownPacketType.description',
    expectedValid: true,
  },
  {
    id: 'length-exceeds-buffer',
    name: 'protocol.rtcp.example.lengthExceedsBuffer.name',
    // RR Length=5 word (24 bayt) iddia ediyor ama tamponda yalnız 8 bayt var —
    // FATAL: bir sonraki alt paketin başlangıcı bilinemez.
    bytes: Uint8Array.from([0x80, 0xc9, 0x00, 0x05, 0x12, 0x34, 0x56, 0x78]),
    description: 'protocol.rtcp.example.lengthExceedsBuffer.description',
    expectedValid: false,
  },
];

export const rtcpPlugin: ProtocolPlugin = {
  id: PROTOCOL_ID,
  name: PROTOCOL_DISPLAY_NAME,
  category: 'network-ethernet',
  parser: rtcpParser,
  documentation: {
    summary: 'protocol.rtcp.documentation.summary',
    layer: 'application',
  },
  exampleFrames: EXAMPLE_FRAMES,
};
