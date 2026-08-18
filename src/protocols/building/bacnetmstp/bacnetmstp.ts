/**
 * BACnet MS/TP (Master-Slave/Token-Passing) — RS-485 üzerinde BACnet
 * NPDU/APDU'yu taşıyan veri bağı çerçevesi. `src/protocols/building/` içinde
 * lisanslı standarda geçen ÜÇÜNCÜ motor (dali.ts/knx.ts ile AYNI disiplin:
 * resmi ANSI/ASHRAE 135 metni satın alınmaz, bağımsız kamuya açık
 * kaynaklardan ÇAPRAZ TEYİTLE alınır, kod kopyalanmaz — yalnız format/sabit
 * bilgisi). NPDU/APDU çözümü BU dosyada DEĞİL, `../bacnet/npdu.ts` ve
 * `../bacnet/apdu.ts`de PAYLAŞILAN bir çekirdektedir — dalga 6g (BACnet/IP)
 * BVLL'den sonra AYNI çekirdeği import edip kullanacak (iec104.ts'nin
 * iec104Asdu.ts'yi ayırmasının BİREBİR AYNISI, brief-faz10-dalga6.md Karar 4).
 *
 * ── KATMAN AYRIMI (ozet07: "karıştırılmamalı") ──────────────────────────────
 * BACnet Objects/Services → NPDU/APDU → MS/TP → RS-485 dört AYRI katmandır.
 * Bu motor yalnız MS/TP çerçevesini + (Data taşıyorsa) NPDU/APDU BAŞLIĞINI
 * çözer; RS-485'in kendisi elektriksel katmandır, bayt üretmez. Object/
 * Service içerikleri (Present_Value, Priority Array vb.) tag'li servis
 * parametrelerinin İÇİNDEDİR — Karar 3 gereği HAM kalır (bkz. apdu.ts).
 *
 * ── KAYNAK UYARISI (Karar 2, brief-faz10-dalga6.md) ─────────────────────────
 * ANSI/ASHRAE 135'in resmi metni ÜCRETLİdir ve bu depoda YOK. Aşağıdaki MS/TP
 * çerçeve alan sırası, Frame Type adları ve İKİ CRC algoritmasının parametreleri
 * İKİ bağımsız kamuya açık kaynaktan ÇAPRAZ TEYİTLE alındı (2026-08-18
 * taranarak), KOD KOPYALANMADI:
 *   1. bacnet-stack (github.com/bacnet-stack/bacnet-stack, MIT): `src/mstp.c`
 *      (`MSTP_Create_Frame`: Preamble 0x55/0xFF, alan sırası, Length BIG-ENDIAN
 *      + Data CRC'yi KAPSAMAZ, Data CRC LSB-first iletilir, Length=0 iken Data
 *      CRC HİÇ yazılmaz), `src/bacnet/datalink/mstpdef.h` (Frame Type sabitleri
 *      0-7 + "8-127 ASHRAE için ayrılmış, 128-255 vendor-proprietary" yorumu),
 *      `src/crc.c` (Header CRC-8 ve Data CRC-16 aritmetiği — bkz.
 *      crcCatalogue.ts'teki `CRC8_BACNET_MSTP` girdisinin dosya başı notu ve
 *      mevcut `CRC16_X25` girdisi).
 *   2. Wireshark BACnet MS/TP dissector (github.com/wireshark/wireshark,
 *      epan/dissectors/packet-mstp.c) — AYNI Frame Type tablosunu ve AYNI iki
 *      CRC algoritmasını bağımsızca gömer, Length alanını `ENC_BIG_ENDIAN` ile
 *      okur ve "does not include the crc16 checksum" yorumunu taşır.
 * Üçüncü destekleyici kaynak (kod içermez): Steve Karg, "Understanding BACnet
 * MSTP Encoding" — çerçeve alan sırasını VE Data CRC'nin Length=0'da hiç
 * olmadığını düzyazıyla bağımsızca doğruluyor.
 *
 * ── TUZAK: MAC ADRESİ ≠ DEVICE INSTANCE (ozet07 satır 31-38) ────────────────
 * `destinationMac`/`sourceMac` bu çerçevenin 1 baytlık MS/TP MAC adresleridir
 * — BACnet Device Instance (Object Identifier'ın bir parçası, servis
 * parametrelerinin İÇİNDE, bu dalgada HAM) ile AYNI ŞEY DEĞİLDİR. İki kavram
 * kasıtlı olarak AYRI alan adları taşır, hiçbir yerde birleştirilmez.
 *
 * ── TUZAK: DATA CRC KOŞULLUDUR ──────────────────────────────────────────────
 * `Length === 0` olan çerçevelerde (Token, Poll For Master, Reply To Poll For
 * Master, Reply Postponed tipik örnekler) Data CRC alanı hiç YOKTUR — çerçeve
 * Header CRC'de biter. Sabit uzunluk VARSAYILMAZ; toplam çerçeve uzunluğu
 * `Length`e göre KOŞULLU hesaplanır (bkz. `computeTotalFrameLength`).
 *
 * ── TUZAK: LENGTH, DATA'NIN UZUNLUĞUDUR, ÇERÇEVENİN DEĞİL ───────────────────
 * `Length` alanı yalnız Data baytlarını sayar (Preamble/Frame Type/MAC/Length/
 * Header CRC/Data CRC hariç) — off-by-one klasiği (MBAP/APCI Length'lerinin
 * aynı ailesi). Toplam çerçeve = 8 (başlık) + Length + (Length>0 ? 2 : 0).
 *
 * ── Data → NPDU/APDU YALNIZ İKİ FRAME TYPE'TA ───────────────────────────────
 * Yalnız "BACnet Data Expecting Reply" (5) ve "BACnet Data Not Expecting
 * Reply" (6) Data alanında NPDU/APDU taşır. Test_Request/Test_Response (3/4)
 * keyfi test yüküdür, rezerve (8-127) ve vendor-proprietary (128-255)
 * aralıkları BACnet dışıdır — bu tiplerde Data HAM tek blok gösterilir,
 * `decodeNpdu`ya HİÇ geçirilmez (yanlış yorumlanmış "TLV benzeri" veri en
 * kötü moddur, berReader.ts dosya başı gerekçesiyle aynı disiplin).
 *
 * ── KAPSAM DIŞI (analyzer işi, ozet07 "BACnet MS/TP Error Analyzer") ────────
 * Token dolaşımı (Token Holder, T_rotation, Duplicate Token) bu motora
 * GİRMEZ — çok çerçeve/oturum ister, parser tek çerçeve çözer.
 */

import { computeNamedCrc } from '@/protocol-core/checksums/crcCatalogue';
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
import { decodeApdu } from '../bacnet/apdu';
import { decodeNpdu } from '../bacnet/npdu';

/** Katalogdaki kayıt id'siyle birebir aynı olmalı (`src/app/catalog`, plugin bağı budur). */
const PROTOCOL_ID = 'bacnet-mstp';
/** Protokol adı veridir, çeviriye girmez (CLAUDE.md). */
const PROTOCOL_DISPLAY_NAME = 'BACnet MS/TP';

const HEX_RADIX = 16;

const PREAMBLE_BYTE_1 = 0x55;
const PREAMBLE_BYTE_2 = 0xff;
const FRAME_TYPE_OFFSET = 2;
const DESTINATION_OFFSET = 3;
const SOURCE_OFFSET = 4;
const LENGTH_OFFSET = 5;
const HEADER_CRC_OFFSET = 7;
/** Header CRC'nin kapsadığı alan: Frame Type + Destination + Source + Length (5 bayt) — Preamble ve kendisi HARİÇ. */
const HEADER_CRC_COVERAGE_START = FRAME_TYPE_OFFSET;
const HEADER_CRC_COVERAGE_LENGTH = 5;
const DATA_OFFSET = 8;
const DATA_CRC_LENGTH = 2;
/** Preamble(2)+FrameType(1)+Dest(1)+Src(1)+Length(2)+HeaderCRC(1) — Length=0 çerçevesinin TAMAMI. */
const MIN_FRAME_LENGTH = 8;

const FRAME_TYPE_TOKEN = 0;
const FRAME_TYPE_DATA_EXPECTING_REPLY = 5;
const FRAME_TYPE_DATA_NOT_EXPECTING_REPLY = 6;

/** Frame Type — dar, İKİ kaynak teyitli küme (dosya başı kaynak uyarısı). */
const FRAME_TYPE_NAMES: ReadonlyMap<number, string> = new Map([
  [FRAME_TYPE_TOKEN, 'Token'],
  [1, 'Poll For Master'],
  [2, 'Reply To Poll For Master'],
  [3, 'Test_Request'],
  [4, 'Test_Response'],
  [FRAME_TYPE_DATA_EXPECTING_REPLY, 'BACnet Data Expecting Reply'],
  [FRAME_TYPE_DATA_NOT_EXPECTING_REPLY, 'BACnet Data Not Expecting Reply'],
  [7, 'Reply Postponed'],
]);

const ERROR_FRAME_TOO_SHORT = 'protocol.bacnetMstp.error.frameTooShort';
const ERROR_FRAME_TOO_LONG = 'protocol.bacnetMstp.error.frameTooLong';
const ERROR_ABORTED = 'protocol.bacnetMstp.error.aborted';
const ERROR_LENGTH_MISMATCH = 'protocol.bacnetMstp.error.lengthMismatch';
const ERROR_PREAMBLE_INVALID = 'protocol.bacnetMstp.error.preambleInvalid';
const ERROR_HEADER_CRC_MISMATCH = 'protocol.bacnetMstp.error.headerCrcMismatch';
const ERROR_DATA_CRC_MISMATCH = 'protocol.bacnetMstp.error.dataCrcMismatch';

const WARN_UNKNOWN_FRAME_TYPE = 'protocol.bacnetMstp.warning.unknownFrameType';
const WARN_DATA_NOT_NPDU = 'protocol.bacnetMstp.warning.dataNotNpdu';

const SUMMARY_NO_DATA = 'protocol.bacnetMstp.summary.noData';
const SUMMARY_APDU = 'protocol.bacnetMstp.summary.apdu';
const SUMMARY_NETWORK_LAYER_MESSAGE = 'protocol.bacnetMstp.summary.networkLayerMessage';
const SUMMARY_RAW_DATA = 'protocol.bacnetMstp.summary.rawData';

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

function readUint16BE(data: Uint8Array, offset: number): number {
  return (byteAt(data, offset) << 8) | byteAt(data, offset + 1);
}

function formatHexByte(value: number): string {
  return `0x${value.toString(HEX_RADIX).toUpperCase().padStart(2, '0')}`;
}

function formatHexWord(value: number): string {
  return `0x${value.toString(HEX_RADIX).toUpperCase().padStart(4, '0')}`;
}

/** Toplam çerçeve uzunluğu: 8 baytlık başlık + Data + (Data varsa 2 baytlık Data CRC) — dosya başı Length tuzağı. */
function computeTotalFrameLength(declaredDataLength: number): number {
  return DATA_OFFSET + declaredDataLength + (declaredDataLength > 0 ? DATA_CRC_LENGTH : 0);
}

export type BacnetMstpFrameMetadata = {
  frameType: number;
  frameTypeLabel: string | undefined;
  summaryKey: string;
  summaryParams: Record<string, string>;
};

interface BacnetMstpParseOptions {
  timestamp?: number;
  direction?: FrameDirection;
  channel?: string;
  maxFrameLength?: number;
  signal?: AbortSignal;
}

function parseBacnetMstpFrame(data: Uint8Array, options: BacnetMstpParseOptions): ParseResult {
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
      error: {
        code: 'truncated-frame',
        message: ERROR_FRAME_TOO_SHORT,
        offset: 0,
        length: data.length,
        details: { availableBytes: data.length, requiredBytes: MIN_FRAME_LENGTH },
      },
      consumedBytes: 0,
      recoverable: true,
    };
  }

  const declaredLength = readUint16BE(data, LENGTH_OFFSET);
  const totalRequired = computeTotalFrameLength(declaredLength);

  if (options.maxFrameLength !== undefined && totalRequired > options.maxFrameLength) {
    return {
      success: false,
      error: {
        code: 'frame-too-long',
        message: ERROR_FRAME_TOO_LONG,
        offset: options.maxFrameLength,
        length: totalRequired - options.maxFrameLength,
        details: { maxFrameLength: options.maxFrameLength, frameLength: totalRequired },
      },
      consumedBytes: 0,
      recoverable: false,
    };
  }

  if (data.length < totalRequired) {
    return {
      success: false,
      error: {
        code: 'length-mismatch',
        message: ERROR_LENGTH_MISMATCH,
        offset: LENGTH_OFFSET,
        length: 2,
        details: { declaredLength, expectedFrameLength: totalRequired, availableBytes: data.length },
      },
      consumedBytes: 0,
      recoverable: true,
    };
  }

  // Fazlası sonraki çerçeveye aittir: tampon değil, YALNIZ bu çerçeve dilimlenir (iec104.ts/knx.ts emsali).
  const frameBytes = data.slice(0, totalRequired);
  const fields: ParsedField[] = [];
  const warnings: ProtocolWarning[] = [];
  const errors: ProtocolError[] = [];

  const preambleValid = byteAt(frameBytes, 0) === PREAMBLE_BYTE_1 && byteAt(frameBytes, 1) === PREAMBLE_BYTE_2;
  fields.push({
    id: 'preamble',
    name: 'Preamble',
    offset: 0,
    length: 2,
    rawBytes: frameBytes.slice(0, 2),
    valid: preambleValid,
    warnings: preambleValid ? [] : [ERROR_PREAMBLE_INVALID],
  });
  if (!preambleValid) {
    // iec104.ts'nin start-byte emsali: preamble yanlış olsa da geri kalan alanlar
    // hâlâ SABİT ofsetlerdedir — motor teslim olmaz, yapısal çözümü yine gösterir.
    errors.push({ code: 'start-delimiter-not-found', message: ERROR_PREAMBLE_INVALID, offset: 0, length: 2 });
  }

  const frameType = byteAt(frameBytes, FRAME_TYPE_OFFSET);
  const frameTypeLabel = FRAME_TYPE_NAMES.get(frameType);
  const frameTypeField: ParsedField = {
    id: 'frameType',
    name: 'Frame Type',
    offset: FRAME_TYPE_OFFSET,
    length: 1,
    rawBytes: frameBytes.slice(FRAME_TYPE_OFFSET, FRAME_TYPE_OFFSET + 1),
    rawValue: frameType,
    valid: frameTypeLabel !== undefined,
    warnings: [],
  };
  if (frameTypeLabel !== undefined) {
    frameTypeField.physicalValue = frameTypeLabel;
  } else {
    frameTypeField.warnings.push(WARN_UNKNOWN_FRAME_TYPE);
    warnings.push(toProtocolWarning(WARN_UNKNOWN_FRAME_TYPE, FRAME_TYPE_OFFSET, 1));
  }
  fields.push(frameTypeField);

  // MAC adresleri — Device Instance İLE KARIŞTIRILMAZ (dosya başı tuzak notu, ayrı alan adları).
  fields.push({
    id: 'destinationMac',
    name: 'Destination MAC Address',
    offset: DESTINATION_OFFSET,
    length: 1,
    rawBytes: frameBytes.slice(DESTINATION_OFFSET, DESTINATION_OFFSET + 1),
    rawValue: byteAt(frameBytes, DESTINATION_OFFSET),
    valid: true,
    warnings: [],
  });
  fields.push({
    id: 'sourceMac',
    name: 'Source MAC Address',
    offset: SOURCE_OFFSET,
    length: 1,
    rawBytes: frameBytes.slice(SOURCE_OFFSET, SOURCE_OFFSET + 1),
    rawValue: byteAt(frameBytes, SOURCE_OFFSET),
    valid: true,
    warnings: [],
  });

  fields.push({
    id: 'length',
    name: 'Length',
    offset: LENGTH_OFFSET,
    length: 2,
    rawBytes: frameBytes.slice(LENGTH_OFFSET, LENGTH_OFFSET + 2),
    rawValue: declaredLength,
    unit: 'B',
    valid: true,
    warnings: [],
  });

  const receivedHeaderCrc = byteAt(frameBytes, HEADER_CRC_OFFSET);
  const calculatedHeaderCrc = Number(
    computeNamedCrc(
      frameBytes.slice(HEADER_CRC_COVERAGE_START, HEADER_CRC_COVERAGE_START + HEADER_CRC_COVERAGE_LENGTH),
      'CRC8_BACNET_MSTP',
    ),
  );
  const headerCrcValid = receivedHeaderCrc === calculatedHeaderCrc;
  fields.push({
    id: 'headerCrc',
    name: 'Header CRC',
    offset: HEADER_CRC_OFFSET,
    length: 1,
    rawBytes: frameBytes.slice(HEADER_CRC_OFFSET, HEADER_CRC_OFFSET + 1),
    rawValue: receivedHeaderCrc,
    physicalValue: formatHexByte(calculatedHeaderCrc),
    valid: headerCrcValid,
    warnings: [],
  });
  if (!headerCrcValid) {
    // Header CRC yanlış olsa da yapısal çözüm (Length dahil) yine gösterilir — KNX
    // checksum-mismatch emsali: alan valid:false + frame-level hata, ParseFailure DEĞİL.
    errors.push({
      code: 'crc-mismatch',
      message: ERROR_HEADER_CRC_MISMATCH,
      offset: HEADER_CRC_OFFSET,
      length: 1,
      details: { received: receivedHeaderCrc, calculated: calculatedHeaderCrc },
    });
  }

  let summaryKey: string;
  const summaryParams: Record<string, string> = {};
  const frameTypeParam = frameTypeLabel ?? formatHexByte(frameType);

  if (declaredLength > 0) {
    const dataBytes = frameBytes.slice(DATA_OFFSET, DATA_OFFSET + declaredLength);
    const dataCrcOffset = DATA_OFFSET + declaredLength;
    // Data CRC LSB-first iletilir (dosya başı kaynak uyarısı) — düşük bayt önce.
    const receivedDataCrc = byteAt(frameBytes, dataCrcOffset) | (byteAt(frameBytes, dataCrcOffset + 1) << 8);
    const calculatedDataCrc = Number(computeNamedCrc(dataBytes, 'CRC16_X25'));
    const dataCrcValid = receivedDataCrc === calculatedDataCrc;

    if (frameType === FRAME_TYPE_DATA_EXPECTING_REPLY || frameType === FRAME_TYPE_DATA_NOT_EXPECTING_REPLY) {
      const errorCountBeforeNpdu = errors.length;
      const npduSummary = decodeNpdu(dataBytes, DATA_OFFSET, fields, warnings, errors);
      const npduFailed = errors.length > errorCountBeforeNpdu;

      if (npduSummary.isNetworkLayerMessage) {
        summaryKey = SUMMARY_NETWORK_LAYER_MESSAGE;
        summaryParams['frameType'] = frameTypeParam;
        summaryParams['messageType'] = npduSummary.networkMessageTypeLabel ?? formatHexByte(npduSummary.networkMessageType ?? 0);
      } else if (!npduFailed) {
        const apduBytes = dataBytes.slice(npduSummary.consumed);
        const apduSummary = decodeApdu(apduBytes, DATA_OFFSET + npduSummary.consumed, fields, warnings, errors);
        summaryKey = SUMMARY_APDU;
        summaryParams['frameType'] = frameTypeParam;
        summaryParams['pduType'] = apduSummary.pduTypeLabel ?? 'unknown';
        summaryParams['serviceChoice'] = apduSummary.serviceChoiceLabel ?? '—';
      } else {
        // NPDU kendi içinde (ör. asgari 2 bayt yok) yapısal olarak başarısız oldu —
        // APDU'yu ÇAĞIRMA: aynı bozuk baytları ikinci kez yanlış yorumlamak yerine
        // NPDU'nun zaten pushladığı truncated-frame hatasıyla yetinilir.
        summaryKey = SUMMARY_RAW_DATA;
        summaryParams['frameType'] = frameTypeParam;
      }
    } else {
      // Test_Request/Response, rezerve, vendor-proprietary — NPDU/APDU DEĞİL, ham blok
      // (dosya başı: yanlış yorumlanmış veri en kötü mod, decodeNpdu'ya hiç geçirilmez).
      const dataField: ParsedField = {
        id: 'data',
        name: 'Data',
        offset: DATA_OFFSET,
        length: declaredLength,
        rawBytes: dataBytes,
        unit: 'B',
        valid: true,
        warnings: [],
      };
      if (frameTypeLabel !== undefined) {
        dataField.warnings.push(WARN_DATA_NOT_NPDU);
        warnings.push(toProtocolWarning(WARN_DATA_NOT_NPDU, DATA_OFFSET, declaredLength));
      }
      fields.push(dataField);
      summaryKey = SUMMARY_RAW_DATA;
      summaryParams['frameType'] = frameTypeParam;
    }

    fields.push({
      id: 'dataCrc',
      name: 'Data CRC',
      offset: dataCrcOffset,
      length: DATA_CRC_LENGTH,
      rawBytes: frameBytes.slice(dataCrcOffset, dataCrcOffset + DATA_CRC_LENGTH),
      rawValue: receivedDataCrc,
      physicalValue: formatHexWord(calculatedDataCrc),
      valid: dataCrcValid,
      warnings: [],
    });
    if (!dataCrcValid) {
      errors.push({
        code: 'crc-mismatch',
        message: ERROR_DATA_CRC_MISMATCH,
        offset: dataCrcOffset,
        length: DATA_CRC_LENGTH,
        details: { received: receivedDataCrc, calculated: calculatedDataCrc },
      });
    }
  } else {
    // Length===0: Data YOK, Data CRC de YOK (dosya başı koşullu-CRC tuzağı) — çerçeve Header CRC'de biter.
    summaryKey = SUMMARY_NO_DATA;
    summaryParams['frameType'] = frameTypeParam;
  }

  const metadata: BacnetMstpFrameMetadata = { frameType, frameTypeLabel, summaryKey, summaryParams };

  const rawFrame = createRawFrame(frameBytes, {
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

  return { success: true, frame, consumedBytes: totalRequired };
}

export function parseBacnetMstp(data: Uint8Array): ParseResult {
  return parseBacnetMstpFrame(data, {});
}

export const bacnetMstpParser: ProtocolParser = {
  protocolId: PROTOCOL_ID,
  displayName: PROTOCOL_DISPLAY_NAME,

  /** Ucuz ön eleme: asgari çerçeve uzunluğu + Preamble. Tam doğrulama (CRC) burada yapılmaz. */
  canParse(data: Uint8Array): boolean {
    if (data.length < MIN_FRAME_LENGTH) return false;
    return byteAt(data, 0) === PREAMBLE_BYTE_1 && byteAt(data, 1) === PREAMBLE_BYTE_2;
  },

  parse(data: Uint8Array, context?: ParseContext): ParseResult {
    const options: BacnetMstpParseOptions = {};
    if (context?.timestamp !== undefined) options.timestamp = context.timestamp;
    if (context?.direction !== undefined) options.direction = context.direction;
    if (context?.channel !== undefined) options.channel = context.channel;
    if (context?.maxFrameLength !== undefined) options.maxFrameLength = context.maxFrameLength;
    if (context?.signal !== undefined) options.signal = context.signal;
    return parseBacnetMstpFrame(data, options);
  },
};

/**
 * Örnek çerçeveler — hepsi ELLE inşa edildi (§43'te bu dalga için fixture
 * YOK, dosya başı disiplin notu). Header CRC-8 ve Data CRC-16 baytları
 * motordan BAĞIMSIZ ikinci bir hesapla `bacnetmstp.test.ts`te kanıtlanır
 * (UBX 3c emsali). Servis parametresi blokları (`AA BB CC ...`) TEMSİLİDİR —
 * Karar 3 gereği bu motor tarafından hiç çözülmez, gerçek bir ReadProperty/
 * I-Am kodlaması OLMA iddiası taşımaz.
 */
const EXAMPLE_FRAMES: ExampleFrame[] = [
  {
    id: 'token',
    name: 'protocol.bacnetMstp.example.token.name',
    // Length=0 → Data CRC YOK, çerçeve Header CRC'de biter (dosya başı tuzak notu).
    bytes: Uint8Array.from([0x55, 0xff, 0x00, 0x01, 0x05, 0x00, 0x00, 0x8d]),
    description: 'protocol.bacnetMstp.example.token.description',
    expectedValid: true,
  },
  {
    id: 'poll-for-master',
    name: 'protocol.bacnetMstp.example.pollForMaster.name',
    // Length=0'ın Token'dan FARKLI bir Frame Type ile de doğru işlediğini gösterir.
    bytes: Uint8Array.from([0x55, 0xff, 0x01, 0x05, 0x01, 0x00, 0x00, 0x4f]),
    description: 'protocol.bacnetMstp.example.pollForMaster.description',
    expectedValid: true,
  },
  {
    id: 'data-expecting-reply-read-property',
    name: 'protocol.bacnetMstp.example.dataExpectingReplyReadProperty.name',
    // FrameType=5; Data = NPDU(Version=1,Control=0x04 expecting-reply) +
    // APDU Confirmed-Request(seg=0,max-segs=2,max-apdu=5,InvokeID=1,
    // ServiceChoice=12 ReadProperty) + temsili 3 baytlık servis parametresi.
    bytes: Uint8Array.from([
      0x55, 0xff, 0x05, 0x0a, 0x01, 0x00, 0x09, 0xa8, 0x01, 0x04, 0x00, 0x25, 0x01, 0x0c, 0xaa, 0xbb, 0xcc, 0x58,
      0x49,
    ]),
    description: 'protocol.bacnetMstp.example.dataExpectingReplyReadProperty.description',
    expectedValid: true,
  },
  {
    id: 'data-not-expecting-reply-i-am',
    name: 'protocol.bacnetMstp.example.dataNotExpectingReplyIAm.name',
    // FrameType=6, broadcast MAC (0xFF); Data = NPDU(Version=1,Control=0x00) +
    // APDU Unconfirmed-Request(ServiceChoice=0 I-Am) + temsili 4 baytlık parametre.
    bytes: Uint8Array.from([
      0x55, 0xff, 0x06, 0xff, 0x0a, 0x00, 0x08, 0xe2, 0x01, 0x00, 0x10, 0x00, 0xaa, 0xbb, 0xcc, 0xdd, 0x69, 0xf3,
    ]),
    description: 'protocol.bacnetMstp.example.dataNotExpectingReplyIAm.description',
    expectedValid: true,
  },
  {
    id: 'bad-header-crc',
    name: 'protocol.bacnetMstp.example.badHeaderCrc.name',
    // "token" örneğiyle AYNI gövde, yalnız Header CRC bilerek bozuldu (0x8D → 0x72) — hata yolu.
    bytes: Uint8Array.from([0x55, 0xff, 0x00, 0x01, 0x05, 0x00, 0x00, 0x72]),
    description: 'protocol.bacnetMstp.example.badHeaderCrc.description',
    expectedValid: false,
  },
  {
    id: 'bad-data-crc',
    name: 'protocol.bacnetMstp.example.badDataCrc.name',
    // "data-not-expecting-reply-i-am" ile AYNI gövde, Header CRC DOĞRU ama Data
    // CRC'nin son baytı bozuldu (0xF3 → 0x0C) — NPDU/APDU yine de yapısal olarak
    // çözülür, yalnız Data CRC alanı valid:false olur.
    bytes: Uint8Array.from([
      0x55, 0xff, 0x06, 0xff, 0x0a, 0x00, 0x08, 0xe2, 0x01, 0x00, 0x10, 0x00, 0xaa, 0xbb, 0xcc, 0xdd, 0x69, 0x0c,
    ]),
    description: 'protocol.bacnetMstp.example.badDataCrc.description',
    expectedValid: false,
  },
  {
    id: 'unrecognized-frame-type',
    name: 'protocol.bacnetMstp.example.unrecognizedFrameType.name',
    // FrameType=0xC8 (200, vendor-proprietary aralığı) — dar kümede YOK, uyarı
    // yolu; CRC'lerin ikisi de DOĞRU (yalnız Frame Type tanınmıyor, hata değil).
    bytes: Uint8Array.from([0x55, 0xff, 0xc8, 0x01, 0x02, 0x00, 0x03, 0x5b, 0x11, 0x22, 0x33, 0x1e, 0x0a]),
    description: 'protocol.bacnetMstp.example.unrecognizedFrameType.description',
    expectedValid: true,
  },
];

export const bacnetMstpPlugin: ProtocolPlugin = {
  id: PROTOCOL_ID,
  name: PROTOCOL_DISPLAY_NAME,
  category: 'building-automation',
  parser: bacnetMstpParser,
  documentation: {
    summary: 'protocol.bacnetMstp.documentation.summary',
    layer: 'data-link',
    references: [
      {
        title: 'bacnet-stack (github.com/bacnet-stack/bacnet-stack, MIT — yalnız sabitler/format referansı, kod kopyalanmadı)',
        url: 'https://github.com/bacnet-stack/bacnet-stack',
      },
      {
        title: 'bacpypes (github.com/JoelBender/bacpypes, MIT — yalnız sabitler/format referansı, kod kopyalanmadı)',
        url: 'https://github.com/JoelBender/bacpypes',
      },
      {
        title: 'Wireshark BACnet MS/TP + BACnet APDU dissector (packet-mstp.c, packet-bacapp.c)',
        url: 'https://github.com/wireshark/wireshark',
      },
      {
        title: 'Steve Karg, "Understanding BACnet MS/TP Encoding"',
        url: 'https://bacnetexperts.com/papers/Understanding%20BACnet%20MSTP%20Encoding.pdf',
      },
    ],
  },
  exampleFrames: EXAMPLE_FRAMES,
};
