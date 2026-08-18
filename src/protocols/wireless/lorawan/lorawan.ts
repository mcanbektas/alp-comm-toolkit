/**
 * LoRaWAN (LoRa Alliance, TS001-1.0.4 "LoRaWAN® L2 1.0.4 Specification", 2020,
 * lora-alliance.org — resmi PDF, kamu/ücretsiz) — PHYPayload = MHDR(1B) +
 * MACPayload + MIC(4B, HER ZAMAN son 4 bayt). Data frame: MACPayload =
 * FHDR(DevAddr+FCtrl+FCnt+FOpts) + FPort(opsiyonel) + FRMPayload(opsiyonel).
 * Join-Request MHDR sonrası AÇIK metin; Join-Accept MHDR sonrası uçtan uca
 * şifreli (MIC dahil) → tek ham blok (§6.2.5, §6.2.3).
 *
 * ── SÜRÜM ÇIPASI: L2 1.0.4 (dalga 7 karar 6) ────────────────────────────────
 * FType 110, TS001-1.0.4 Table 4'te RFU'dur (Rejoin Request 1.1'e özgüdür) —
 * DAR adlandırılır (isim verilir, gövde şeması bu dalgada çözülmez, ham).
 * FOpts içindeki MAC komutlarının çözümü analyzer işi, bu dalgaya GİRMEZ.
 *
 * ── ŞİFRELİ İÇERİK POLİTİKASI (dalga 5 karar 8, devralınır) ─────────────────
 * FRMPayload ve Join-Accept gövdesi: anahtar girişi/şifre çözme HİÇBİR alt
 * dalgada yok — ham + "encrypted" işareti. MIC: mavlink `crcNeedsDialect`
 * emsali — "MIC present / Cannot verify without session keys", PASS/FAIL
 * ASLA basılmaz (spec 34089-34109 metni birebir; TS001 §4/§6.2.5 CMAC formülü
 * `aes128_cmac(key, …)` anahtar ister).
 *
 * ── BİT SIRASI: MSB-FIRST (BLE'nin TERSİ) ───────────────────────────────────
 * MHDR (TS001 Table 3): FType[7:5] + RFU[4:2] + Major[1:0]. FCtrl YÖNE GÖRE
 * FARKLI biçimlenir (TS001 Table 7 downlink: ADR/RFU/ACK/FPending/FOptsLen;
 * Table 8 uplink: ADR/ADRACKReq/ACK/ClassB/FOptsLen) — yön FType'tan çıkarılır
 * (Data Up → uplink tablosu, Data Down → downlink tablosu). bitCursor
 * `msb-first`.
 *
 * ── ÇOK BAYTLI ALANLAR: LITTLE-ENDIAN, GÖSTERİM AYRIMI ─────────────────────
 * DevAddr/FCnt/JoinEUI/DevEUI/DevNonce hepsi wire'da LE (dalga 7 tuzak notu).
 * JoinEUI/DevEUI KALICI EUI64 kimlikleridir → ekranda TERS/ayraçlı (BLE AdvA
 * emsali). DevAddr GEÇİCİ oturum adresidir → tek 32-bit hex sayı (endüstri
 * pratiği: ChirpStack/TTN "26011A2B" gibi tek blok gösterir, ayraçlı değil) —
 * bu ayrım burada bilinçli sabitlenir, testte doğrulanır.
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

const PROTOCOL_ID = 'lorawan';
/** Protokol adı veridir, çeviriye girmez (CLAUDE.md). */
const PROTOCOL_DISPLAY_NAME = 'LoRaWAN';
const TRANSLATION_KEY_PREFIX = 'protocol.lorawan';

const MHDR_LENGTH = 1;
const MIC_LENGTH = 4;
const DEV_ADDR_LENGTH = 4;
const FCTRL_LENGTH = 1;
const FCNT_LENGTH = 2;
const FPORT_LENGTH = 1;
const JOIN_EUI_LENGTH = 8;
const DEV_EUI_LENGTH = 8;
const DEV_NONCE_LENGTH = 2;
const MIN_FRAME_LENGTH = MHDR_LENGTH + MIC_LENGTH;
const FHDR_MIN_LENGTH = DEV_ADDR_LENGTH + FCTRL_LENGTH + FCNT_LENGTH;
const EXPECTED_JOIN_REQUEST_LENGTH = MHDR_LENGTH + JOIN_EUI_LENGTH + DEV_EUI_LENGTH + DEV_NONCE_LENGTH + MIC_LENGTH;

const FTYPE_BIT_POSITION = 0;
const FTYPE_BIT_LENGTH = 3;
const MHDR_RFU_BIT_POSITION = 3;
const MHDR_RFU_BIT_LENGTH = 3;
const MAJOR_BIT_POSITION = 6;
const MAJOR_BIT_LENGTH = 2;
const MAJOR_R1 = 0;

const FCTRL_FIRST_BIT_POSITION = 0; // ADR (her iki yönde de aynı)
const FCTRL_SECOND_BIT_POSITION = 1; // RFU(downlink) / ADRACKReq(uplink)
const FCTRL_ACK_BIT_POSITION = 2; // ACK (her iki yönde de aynı)
const FCTRL_FOURTH_BIT_POSITION = 3; // FPending(downlink) / ClassB(uplink)
const FCTRL_FOPTSLEN_BIT_POSITION = 4;
const FCTRL_FOPTSLEN_BIT_LENGTH = 4;

const FTYPE_JOIN_REQUEST = 0b000;
const FTYPE_JOIN_ACCEPT = 0b001;
const FTYPE_UNCONFIRMED_UP = 0b010;
const FTYPE_UNCONFIRMED_DOWN = 0b011;
const FTYPE_CONFIRMED_UP = 0b100;
const FTYPE_CONFIRMED_DOWN = 0b101;
const FTYPE_RFU_REJOIN = 0b110;
const FTYPE_PROPRIETARY = 0b111;

/** TS001-1.0.4 Table 4 (MAC frame types) — kodlar resmi spec'ten birebir. */
const FTYPE_NAMES: ReadonlyMap<number, string> = new Map([
  [FTYPE_JOIN_REQUEST, 'Join-Request'],
  [FTYPE_JOIN_ACCEPT, 'Join-Accept'],
  [FTYPE_UNCONFIRMED_UP, 'Unconfirmed Data Up'],
  [FTYPE_UNCONFIRMED_DOWN, 'Unconfirmed Data Down'],
  [FTYPE_CONFIRMED_UP, 'Confirmed Data Up'],
  [FTYPE_CONFIRMED_DOWN, 'Confirmed Data Down'],
  [FTYPE_RFU_REJOIN, 'RFU (Rejoin Request in 1.1)'],
  [FTYPE_PROPRIETARY, 'Proprietary'],
]);

type FrameKind = 'join-request' | 'join-accept' | 'data-uplink' | 'data-downlink' | 'unsupported';

function classifyFrame(fType: number): FrameKind {
  switch (fType) {
    case FTYPE_JOIN_REQUEST:
      return 'join-request';
    case FTYPE_JOIN_ACCEPT:
      return 'join-accept';
    case FTYPE_UNCONFIRMED_UP:
    case FTYPE_CONFIRMED_UP:
      return 'data-uplink';
    case FTYPE_UNCONFIRMED_DOWN:
    case FTYPE_CONFIRMED_DOWN:
      return 'data-downlink';
    default:
      return 'unsupported';
  }
}

const ERROR_FRAME_TOO_SHORT = `${TRANSLATION_KEY_PREFIX}.error.frameTooShort`;
const ERROR_FRAME_TOO_LONG = `${TRANSLATION_KEY_PREFIX}.error.frameTooLong`;
const ERROR_ABORTED = `${TRANSLATION_KEY_PREFIX}.error.aborted`;
const ERROR_JOIN_REQUEST_LENGTH = `${TRANSLATION_KEY_PREFIX}.error.joinRequestLength`;
const ERROR_FHDR_TRUNCATED = `${TRANSLATION_KEY_PREFIX}.error.fhdrTruncated`;
const ERROR_FOPTS_TRUNCATED = `${TRANSLATION_KEY_PREFIX}.error.foptsTruncated`;

const WARN_MAJOR_NOT_R1 = `${TRANSLATION_KEY_PREFIX}.warning.majorNotR1`;
const WARN_FRAME_KIND_NOT_DECODED = `${TRANSLATION_KEY_PREFIX}.warning.frameKindNotDecoded`;
const WARN_JOIN_ACCEPT_ENCRYPTED = `${TRANSLATION_KEY_PREFIX}.warning.joinAcceptEncrypted`;
const WARN_FOPTS_NOT_DECODED = `${TRANSLATION_KEY_PREFIX}.warning.foptsNotDecoded`;
const WARN_FRM_PAYLOAD_ENCRYPTED = `${TRANSLATION_KEY_PREFIX}.warning.frmPayloadEncrypted`;
const WARN_MIC_NEEDS_SESSION_KEYS = `${TRANSLATION_KEY_PREFIX}.warning.micNeedsSessionKeys`;

function toProtocolWarning(key: string): ProtocolWarning {
  return { code: key, message: key };
}

/** noUncheckedIndexedAccess: bayt dizisi erişimi her yerde bu guard'dan geçer. */
function byteAt(data: Uint8Array, offset: number): number {
  return data[offset] ?? 0;
}

function toHex(value: number, byteWidth: number): string {
  return `0x${value.toString(16).padStart(byteWidth * 2, '0').toUpperCase()}`;
}

function readUint16Le(bytes: Uint8Array, offset: number): number {
  return byteAt(bytes, offset) | (byteAt(bytes, offset + 1) << 8);
}

function readUint32Le(bytes: Uint8Array, offset: number): number {
  return (
    (byteAt(bytes, offset) |
      (byteAt(bytes, offset + 1) << 8) |
      (byteAt(bytes, offset + 2) << 16) |
      (byteAt(bytes, offset + 3) << 24)) >>>
    0
  );
}

/** Wire LE; ekranda geleneksel EUI64 gösterimiyle TERS/ayraçlı (dosya başı gösterim ayrımı). */
function formatEui(bytes: Uint8Array): string {
  return Array.from(bytes)
    .reverse()
    .map((byte) => byte.toString(16).padStart(2, '0').toUpperCase())
    .join(':');
}

function micField(offset: number, bytes: Uint8Array): ParsedField {
  return {
    id: 'mic',
    name: 'MIC',
    offset,
    length: MIC_LENGTH,
    rawBytes: bytes,
    rawValue: toHex(readUint32Le(bytes, 0), 4),
    valid: true,
    warnings: [WARN_MIC_NEEDS_SESSION_KEYS],
  };
}

interface LoRaWANParseOptions {
  timestamp?: number;
  direction?: FrameDirection;
  channel?: string;
  maxFrameLength?: number;
  signal?: AbortSignal;
}

function parseLoRaWANFrame(data: Uint8Array, options: LoRaWANParseOptions): ParseResult {
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

  const fType = readBitsAsNumber(data, FTYPE_BIT_POSITION, FTYPE_BIT_LENGTH, 'msb-first');
  fields.push({
    id: 'ftype',
    name: 'FType (MHDR message type)',
    offset: 0,
    length: FTYPE_BIT_LENGTH,
    rawBytes: data.slice(0, 1),
    rawValue: fType,
    physicalValue: FTYPE_NAMES.get(fType),
    valid: true,
    warnings: [],
  });

  const mhdrRfu = readBitsAsNumber(data, MHDR_RFU_BIT_POSITION, MHDR_RFU_BIT_LENGTH, 'msb-first');
  fields.push({
    id: 'mhdr-rfu',
    name: 'RFU',
    offset: 0,
    length: MHDR_RFU_BIT_LENGTH,
    rawBytes: data.slice(0, 1),
    rawValue: mhdrRfu,
    valid: true,
    warnings: [],
  });

  const major = readBitsAsNumber(data, MAJOR_BIT_POSITION, MAJOR_BIT_LENGTH, 'msb-first');
  const majorField: ParsedField = {
    id: 'major',
    name: 'Major',
    offset: 0,
    length: MAJOR_BIT_LENGTH,
    rawBytes: data.slice(0, 1),
    rawValue: major,
    valid: true,
    warnings: [],
  };
  if (major === MAJOR_R1) {
    majorField.physicalValue = 'LoRaWAN R1';
  } else {
    majorField.warnings = [WARN_MAJOR_NOT_R1];
    warnings.push(toProtocolWarning(WARN_MAJOR_NOT_R1));
  }
  fields.push(majorField);

  const kind = classifyFrame(fType);

  if (kind === 'join-request') {
    if (data.length !== EXPECTED_JOIN_REQUEST_LENGTH) {
      errors.push({
        code: 'length-mismatch',
        message: ERROR_JOIN_REQUEST_LENGTH,
        offset: MHDR_LENGTH,
        length: data.length - MHDR_LENGTH,
        details: { expected: EXPECTED_JOIN_REQUEST_LENGTH, actual: data.length },
      });
    } else {
      let cursor = MHDR_LENGTH;
      const joinEuiBytes = data.slice(cursor, cursor + JOIN_EUI_LENGTH);
      fields.push({
        id: 'join-eui',
        name: 'JoinEUI',
        offset: cursor,
        length: JOIN_EUI_LENGTH,
        rawBytes: joinEuiBytes,
        rawValue: formatEui(joinEuiBytes),
        valid: true,
        warnings: [],
      });
      cursor += JOIN_EUI_LENGTH;

      const devEuiBytes = data.slice(cursor, cursor + DEV_EUI_LENGTH);
      fields.push({
        id: 'dev-eui',
        name: 'DevEUI',
        offset: cursor,
        length: DEV_EUI_LENGTH,
        rawBytes: devEuiBytes,
        rawValue: formatEui(devEuiBytes),
        valid: true,
        warnings: [],
      });
      cursor += DEV_EUI_LENGTH;

      const devNonceBytes = data.slice(cursor, cursor + DEV_NONCE_LENGTH);
      fields.push({
        id: 'dev-nonce',
        name: 'DevNonce',
        offset: cursor,
        length: DEV_NONCE_LENGTH,
        rawBytes: devNonceBytes,
        rawValue: readUint16Le(data, cursor),
        valid: true,
        warnings: [],
      });
      cursor += DEV_NONCE_LENGTH;

      fields.push(micField(cursor, data.slice(cursor, cursor + MIC_LENGTH)));
      warnings.push(toProtocolWarning(WARN_MIC_NEEDS_SESSION_KEYS));
    }
  } else if (kind === 'join-accept') {
    // MHDR sonrası TAMAMI (MIC dahil) şifreli — §6.2.3, ayrıştırılmaz (dosya başı).
    const encrypted = data.slice(MHDR_LENGTH);
    fields.push({
      id: 'join-accept-payload',
      name: 'Join-Accept Payload (encrypted, incl. MIC)',
      offset: MHDR_LENGTH,
      length: encrypted.length,
      rawBytes: encrypted,
      unit: 'B',
      valid: true,
      warnings: [WARN_JOIN_ACCEPT_ENCRYPTED],
    });
    warnings.push(toProtocolWarning(WARN_JOIN_ACCEPT_ENCRYPTED));
  } else if (kind === 'data-uplink' || kind === 'data-downlink') {
    const isUplink = kind === 'data-uplink';
    const macPayloadLength = data.length - MHDR_LENGTH - MIC_LENGTH;

    if (macPayloadLength < FHDR_MIN_LENGTH) {
      errors.push({
        code: 'truncated-frame',
        message: ERROR_FHDR_TRUNCATED,
        offset: MHDR_LENGTH,
        length: macPayloadLength,
        details: { required: FHDR_MIN_LENGTH },
      });
    } else {
      let cursor = MHDR_LENGTH;

      const devAddrBytes = data.slice(cursor, cursor + DEV_ADDR_LENGTH);
      fields.push({
        id: 'dev-addr',
        name: 'DevAddr',
        offset: cursor,
        length: DEV_ADDR_LENGTH,
        rawBytes: devAddrBytes,
        rawValue: toHex(readUint32Le(data, cursor), 4),
        valid: true,
        warnings: [],
      });
      cursor += DEV_ADDR_LENGTH;

      const fctrlOffset = cursor;
      const fctrlBitBase = fctrlOffset * 8;
      const fctrlBytes = data.slice(fctrlOffset, fctrlOffset + 1);
      const adr = readBitsAsNumber(data, fctrlBitBase + FCTRL_FIRST_BIT_POSITION, 1, 'msb-first');
      const secondBit = readBitsAsNumber(data, fctrlBitBase + FCTRL_SECOND_BIT_POSITION, 1, 'msb-first');
      const ack = readBitsAsNumber(data, fctrlBitBase + FCTRL_ACK_BIT_POSITION, 1, 'msb-first');
      const fourthBit = readBitsAsNumber(data, fctrlBitBase + FCTRL_FOURTH_BIT_POSITION, 1, 'msb-first');
      const foptsLen = readBitsAsNumber(
        data,
        fctrlBitBase + FCTRL_FOPTSLEN_BIT_POSITION,
        FCTRL_FOPTSLEN_BIT_LENGTH,
        'msb-first',
      );

      fields.push({
        id: 'adr',
        name: 'ADR',
        offset: fctrlOffset,
        length: 1,
        rawBytes: fctrlBytes,
        rawValue: adr,
        valid: true,
        warnings: [],
      });
      // TS001 Table 7/8: aynı bit downlink'te RFU, uplink'te ADRACKReq (dosya başı).
      fields.push({
        id: isUplink ? 'adr-ack-req' : 'fctrl-rfu',
        name: isUplink ? 'ADRACKReq' : 'RFU',
        offset: fctrlOffset,
        length: 1,
        rawBytes: fctrlBytes,
        rawValue: secondBit,
        valid: true,
        warnings: [],
      });
      fields.push({
        id: 'ack',
        name: 'ACK',
        offset: fctrlOffset,
        length: 1,
        rawBytes: fctrlBytes,
        rawValue: ack,
        valid: true,
        warnings: [],
      });
      // TS001 Table 7/8: downlink'te FPending, uplink'te ClassB (dosya başı).
      fields.push({
        id: isUplink ? 'class-b' : 'f-pending',
        name: isUplink ? 'ClassB' : 'FPending',
        offset: fctrlOffset,
        length: 1,
        rawBytes: fctrlBytes,
        rawValue: fourthBit,
        valid: true,
        warnings: [],
      });
      fields.push({
        id: 'fopts-len',
        name: 'FOptsLen',
        offset: fctrlOffset,
        length: FCTRL_FOPTSLEN_BIT_LENGTH,
        rawBytes: fctrlBytes,
        rawValue: foptsLen,
        valid: true,
        warnings: [],
      });
      cursor += FCTRL_LENGTH;

      const fCntBytes = data.slice(cursor, cursor + FCNT_LENGTH);
      fields.push({
        id: 'fcnt',
        name: 'FCnt',
        offset: cursor,
        length: FCNT_LENGTH,
        rawBytes: fCntBytes,
        rawValue: readUint16Le(data, cursor),
        valid: true,
        warnings: [],
      });
      cursor += FCNT_LENGTH;

      if (macPayloadLength < FHDR_MIN_LENGTH + foptsLen) {
        errors.push({
          code: 'truncated-frame',
          message: ERROR_FOPTS_TRUNCATED,
          offset: cursor,
          length: macPayloadLength - FHDR_MIN_LENGTH,
          details: { declaredFOptsLen: foptsLen },
        });
      } else {
        if (foptsLen > 0) {
          const foptsBytes = data.slice(cursor, cursor + foptsLen);
          fields.push({
            id: 'fopts',
            name: 'FOpts (MAC commands)',
            offset: cursor,
            length: foptsLen,
            rawBytes: foptsBytes,
            unit: 'B',
            valid: true,
            warnings: [WARN_FOPTS_NOT_DECODED],
          });
          warnings.push(toProtocolWarning(WARN_FOPTS_NOT_DECODED));
          cursor += foptsLen;
        }

        const micOffset = data.length - MIC_LENGTH;
        if (cursor < micOffset) {
          const fPort = byteAt(data, cursor);
          fields.push({
            id: 'f-port',
            name: 'FPort',
            offset: cursor,
            length: FPORT_LENGTH,
            rawBytes: data.slice(cursor, cursor + 1),
            rawValue: fPort,
            physicalValue: fPort === 0 ? 'MAC commands only (no application data)' : undefined,
            valid: true,
            warnings: [],
          });
          cursor += FPORT_LENGTH;

          if (cursor < micOffset) {
            const frmPayload = data.slice(cursor, micOffset);
            fields.push({
              id: 'frm-payload',
              name: 'FRMPayload (encrypted)',
              offset: cursor,
              length: frmPayload.length,
              rawBytes: frmPayload,
              unit: 'B',
              valid: true,
              warnings: [WARN_FRM_PAYLOAD_ENCRYPTED],
            });
            warnings.push(toProtocolWarning(WARN_FRM_PAYLOAD_ENCRYPTED));
          }
        }

        fields.push(micField(micOffset, data.slice(micOffset, micOffset + MIC_LENGTH)));
        warnings.push(toProtocolWarning(WARN_MIC_NEEDS_SESSION_KEYS));
      }
    }
  } else {
    // Proprietary / RFU(1.1 Rejoin) — gövde şeması bu dalgada çözülmez (dosya başı).
    const rest = data.slice(MHDR_LENGTH);
    fields.push({
      id: 'payload',
      name: 'Payload',
      offset: MHDR_LENGTH,
      length: rest.length,
      rawBytes: rest,
      unit: 'B',
      valid: true,
      warnings: [WARN_FRAME_KIND_NOT_DECODED],
    });
    warnings.push(toProtocolWarning(WARN_FRAME_KIND_NOT_DECODED));
  }

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

export function parseLoRaWAN(data: Uint8Array): ParseResult {
  return parseLoRaWANFrame(data, {});
}

function readContextOptions(context: ParseContext | undefined): LoRaWANParseOptions {
  const options: LoRaWANParseOptions = {};
  if (context?.timestamp !== undefined) options.timestamp = context.timestamp;
  if (context?.direction !== undefined) options.direction = context.direction;
  if (context?.channel !== undefined) options.channel = context.channel;
  if (context?.maxFrameLength !== undefined) options.maxFrameLength = context.maxFrameLength;
  if (context?.signal !== undefined) options.signal = context.signal;
  return options;
}

export const lorawanParser: ProtocolParser = {
  protocolId: PROTOCOL_ID,
  displayName: PROTOCOL_DISPLAY_NAME,

  /** Ucuz ön eleme: yeterli uzunluk + Major RFU değil (spec'te gerçek trafikte hep 00). */
  canParse(data: Uint8Array): boolean {
    if (data.length < MIN_FRAME_LENGTH) return false;
    return readBitsAsNumber(data, MAJOR_BIT_POSITION, MAJOR_BIT_LENGTH, 'msb-first') === MAJOR_R1;
  },

  parse(data: Uint8Array, context?: ParseContext): ParseResult {
    return parseLoRaWANFrame(data, readContextOptions(context));
  },
};

function mhdr(fType: number): number {
  return (fType & 0b111) << 5;
}

/**
 * Örnek çerçeveler. MIC değerleri her örnekte 4 SABİT bayt (`DE AD BE EF`) —
 * anahtar olmadan CMAC hesaplanamaz (dosya başı); motor zaten MIC'i hiçbir
 * koşulda doğrulamaz, bu yüzden içeriğin kendisi fixture'ın kanıtladığı şeyi
 * etkilemez (yalnız "4 bayt var, ham + uyarı" kanıtlanır — CRC/checksum
 * fixture'larının aksine burada "doğru değer" diye bir iddia YOKTUR).
 */
const MIC_PLACEHOLDER = [0xde, 0xad, 0xbe, 0xef];

const EXAMPLE_FRAMES: ExampleFrame[] = [
  {
    id: 'join-request',
    name: 'protocol.lorawan.example.joinRequest.name',
    // JoinEUI/DevEUI örnek/test değeri (§6.2.5 Table 53 alan sırası: JoinEUI|DevEUI|DevNonce).
    bytes: Uint8Array.from([
      mhdr(FTYPE_JOIN_REQUEST),
      ...[0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08], // JoinEUI (LE)
      ...[0x11, 0x12, 0x13, 0x14, 0x15, 0x16, 0x17, 0x18], // DevEUI (LE)
      0x2a, 0x00, // DevNonce = 42 (LE)
      ...MIC_PLACEHOLDER,
    ]),
    description: 'protocol.lorawan.example.joinRequest.description',
    expectedValid: true,
  },
  {
    id: 'join-accept',
    name: 'protocol.lorawan.example.joinAccept.name',
    bytes: Uint8Array.from([mhdr(FTYPE_JOIN_ACCEPT), 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a]),
    description: 'protocol.lorawan.example.joinAccept.description',
    expectedValid: true,
  },
  {
    id: 'unconfirmed-data-up',
    name: 'protocol.lorawan.example.unconfirmedDataUp.name',
    // FCtrl=0x00 (ADR/ADRACKReq/ACK/ClassB/FOptsLen hepsi 0), FCnt=5, FPort=10, FRMPayload 3 bayt.
    bytes: Uint8Array.from([
      mhdr(FTYPE_UNCONFIRMED_UP),
      0x26, 0x01, 0x1a, 0x2b, // DevAddr (LE)
      0x00, // FCtrl
      0x05, 0x00, // FCnt (LE)
      10, // FPort
      0xaa, 0xbb, 0xcc, // FRMPayload (encrypted)
      ...MIC_PLACEHOLDER,
    ]),
    description: 'protocol.lorawan.example.unconfirmedDataUp.description',
    expectedValid: true,
  },
  {
    id: 'confirmed-data-down-with-fopts',
    name: 'protocol.lorawan.example.confirmedDataDownWithFopts.name',
    // Downlink FCtrl yorumu (RFU/FPending) + FOptsLen=2 (MAC komutları ham).
    bytes: Uint8Array.from([
      mhdr(FTYPE_CONFIRMED_DOWN),
      0x26, 0x01, 0x1a, 0x2b, // DevAddr (LE)
      0b0001_0010, // FCtrl: ADR=0,RFU=0,ACK=0,FPending=1,FOptsLen=2
      0x07, 0x00, // FCnt (LE)
      0x02, 0x03, // FOpts (MAC command, ham)
      1, // FPort
      0x99, // FRMPayload (encrypted)
      ...MIC_PLACEHOLDER,
    ]),
    description: 'protocol.lorawan.example.confirmedDataDownWithFopts.description',
    expectedValid: true,
  },
  {
    id: 'mac-command-only',
    name: 'protocol.lorawan.example.macCommandOnly.name',
    // FPort=0 → "MAC commands only", uygulama verisi DEĞİL (brief tuzak notu).
    bytes: Uint8Array.from([
      mhdr(FTYPE_UNCONFIRMED_UP),
      0x26, 0x01, 0x1a, 0x2b,
      0x00,
      0x08, 0x00,
      0, // FPort = 0
      0x02, 0x03, // FRMPayload (encrypted MAC command)
      ...MIC_PLACEHOLDER,
    ]),
    description: 'protocol.lorawan.example.macCommandOnly.description',
    expectedValid: true,
  },
  {
    id: 'no-application-payload',
    name: 'protocol.lorawan.example.noApplicationPayload.name',
    // "Bir FHDR + FOpts=0 + FPort/FRMPayload yok" da geçerli çerçevedir (TS001 §4.3).
    bytes: Uint8Array.from([mhdr(FTYPE_UNCONFIRMED_UP), 0x26, 0x01, 0x1a, 0x2b, 0x00, 0x09, 0x00, ...MIC_PLACEHOLDER]),
    description: 'protocol.lorawan.example.noApplicationPayload.description',
    expectedValid: true,
  },
  {
    id: 'proprietary',
    name: 'protocol.lorawan.example.proprietary.name',
    bytes: Uint8Array.from([mhdr(FTYPE_PROPRIETARY), 0x01, 0x02, 0x03, ...MIC_PLACEHOLDER]),
    description: 'protocol.lorawan.example.proprietary.description',
    expectedValid: true,
  },
  {
    id: 'truncated-fhdr',
    name: 'protocol.lorawan.example.truncatedFhdr.name',
    // MHDR + 6 bayt (FHDR en az 7 bayt ister) + MIC — truncated-frame.
    bytes: Uint8Array.from([mhdr(FTYPE_UNCONFIRMED_UP), 0x26, 0x01, 0x1a, 0x2b, 0x00, 0x05, ...MIC_PLACEHOLDER]),
    description: 'protocol.lorawan.example.truncatedFhdr.description',
    expectedValid: false,
  },
];

export const lorawanPlugin: ProtocolPlugin = {
  id: PROTOCOL_ID,
  name: PROTOCOL_DISPLAY_NAME,
  category: 'wireless-iot',
  parser: lorawanParser,
  documentation: {
    summary: 'protocol.lorawan.documentation.summary',
    layer: 'multi-layer',
  },
  exampleFrames: EXAMPLE_FRAMES,
};
