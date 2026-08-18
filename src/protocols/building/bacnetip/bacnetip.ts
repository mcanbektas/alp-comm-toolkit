/**
 * BACnet/IP (BVLL — BACnet Virtual Link Layer, ANSI/ASHRAE 135 Annex J) —
 * BACnet NPDU/APDU'yu UDP/IP üzerinden taşıyan sarmalayıcı başlık.
 * `src/protocols/building/bacnet/` altındaki PAYLAŞILAN NPDU/APDU çekirdeğini
 * (`npdu.ts`/`apdu.ts`, dalga 6f'de yazıldı) BİREBİR AYNI zincirleme deseniyle
 * kullanan İKİNCİ motor — `bacnetmstp.ts`nin BVLL/BVLC eşdeğeri (iec104.ts'nin
 * iec104Asdu.ts'yi paylaşmasının AYNISI, brief-faz10-dalga6.md Karar 4).
 * Çekirdek burada YENİDEN YAZILMAZ, yalnız BVLC başlığından sonraki baytlarla
 * çağrılır.
 *
 * ── GİRDİ: TEK UDP PAYLOAD'I (coap.ts girdi emsali) ─────────────────────────
 * UDP datagramı mesaj sınırını zaten verir — stream birleştirme YOK. `data`
 * uzunluğu BVLL mesajının TAMAMIDIR; bu motorda "artakalan veri" kavramı YOK
 * (dosya başı coap.ts ile AYNI disiplin, brief Karar 7 — udp.ts'ye dokunulmaz).
 *
 * ── KAYNAK UYARISI (Karar 2, brief-faz10-dalga6.md) ─────────────────────────
 * ANSI/ASHRAE 135 Annex J'nin resmi metni ÜCRETLİdir. Aşağıdaki BVLC Type
 * sabiti, 12 BVLC Function kodu/adı, Length alanının KENDİSİNİ DE SAYAN toplam
 * uzunluk semantiği ve Forwarded-NPDU'nun 6 baytlık B/IP adresi (4 IP + 2 port)
 * yerleşimi İKİ bağımsız kamuya açık kaynaktan GERÇEKTEN ERİŞİLEREK ÇAPRAZ
 * TEYİTLE alındı (2026-08-18 taranarak, KOD KOPYALANMADI — yalnız format/sabit
 * bilgisi):
 *   1. bacnet-stack (github.com/bacnet-stack/bacnet-stack, MIT):
 *      `src/bacnet/datalink/bvlc.h` — `BVLL_TYPE_BACNET_IP=0x81`,
 *      `BVLC_RESULT=0x00` … `BVLC_ORIGINAL_BROADCAST_NPDU=0x0B` sabitleri;
 *      `src/bacnet/datalink/bvlc.c` — `bvlc_encode_header()`in kendi yorumu:
 *      "The 2-octet BVLC Length field is the length, in octets, of the entire
 *      BVLL message, including the two octets of the length field itself" (bu
 *      motorun "Length kendini de sayar" tuzak notunun BİREBİR kaynağı); aynı
 *      dosyada `bvlc_encode_forwarded_npdu()` B/IP adresini offset 4'te
 *      `BIP_ADDRESS_MAX=6` bayt olarak yazıp NPDU'yu hemen ardından ekliyor.
 *   2. Wireshark BVLC dissector (github.com/wireshark/wireshark,
 *      epan/dissectors/packet-bvlc.c) — `bvlc_function_names` value_string
 *      tablosu AYNI 12 kodu (0x00-0x0B) AYNI adlarla bağımsızca taşıyor;
 *      `BACNET_IP_ANNEX_J=0x81`; Length yorumu "constant header length of
 *      BVLC of 4 in every BVLC-packet forewarding an NPDU" ile bacnet-stack'in
 *      yorumunu bağımsızca doğruluyor.
 * İki kaynak da AYNI 12 fonksiyon kodunda AYNI adı ve AYNI Length semantiğini
 * veriyor; hiçbir alan tek kaynaktan gelmedi. Dar kümenin DIŞINDA kalan bir kod
 * da iki kaynakta bağımsızca örtüşüyor (0x0C "Secured-BVLL" / `BVLC_SECURE_
 * BVLL`) — BİLEREK dar kümeye ALINMADI (BACnet/SC'ye ait, daha yeni bir
 * uzantı; apdu.ts'nin "dar küme felsefesi" ile aynı disiplin).
 *
 * ── KAPSAM ÇİZGİSİ (Karar 3/4, brief-faz10-dalga6.md) ────────────────────────
 * BVLC başlığı (Type/Function/Length) + Function'a göre dallanma BU motorun
 * işi. Yalnız Original-Unicast-NPDU, Original-Broadcast-NPDU ve Forwarded-NPDU
 * paylaşılan `decodeNpdu`/`decodeApdu` çekirdeğine girer — geri kalan dokuz
 * fonksiyon (BVLC-Result, Write/Read-BDT(+Ack), Register-Foreign-Device,
 * Read-FDT(+Ack), Delete-Foreign-Device-Table-Entry, Distribute-Broadcast-To-
 * Network) yalnız AD + HAM gövde olarak gösterilir. **BBMD/Foreign Device
 * tablo TAKİBİ YAPILMAZ** (spec 22274+ analyzer işi, brief net söylüyor) —
 * fonksiyon adının çözülmesi yeterlidir.
 *
 * ── TUZAK: BVLC LENGTH KENDİSİNİ DE SAYAR (MBAP'ın TERSİNE) ──────────────────
 * Modbus TCP'nin MBAP Length'i kendisinden SONRAKİ baytları sayar; BVLC Length
 * ise 4 baytlık BAŞLIĞI DA DAHİL toplam mesaj uzunluğudur (dosya başı kaynak
 * uyarısı). Bu motor UDP-payload disiplini gereği `data.length`i TEK doğru
 * kaynak sayar (coap.ts emsali) — Length yalnız ÇAPRAZ TUTARLILIK için
 * karşılaştırılır; tutarsızlıkta doip/modbus-tcp tonunda UYARI verir, çerçeveyi
 * REDDETMEZ (Length yanlış olsa da gerçek buffer zaten mesajın tamamıdır).
 *
 * ── TUZAK: FORWARDED-NPDU'DA NPDU, B/IP ADRESİNDEN SONRA BAŞLAR ──────────────
 * Forwarded-NPDU'da (Function 0x04) 4 baytlık BVLC başlığından hemen sonra 6
 * baytlık "Originating Device B/IP Address" (4 bayt IP + 2 bayt port, BE)
 * gelir — NPDU ancak offset 10'da başlar. Original-Unicast/Broadcast-NPDU'da
 * bu adres YOKTUR, NPDU doğrudan offset 4'te başlar. Sabit bir "NPDU her zaman
 * offset 4'te başlar" varsayımı Forwarded-NPDU'da yanlış hizalanmış bayt
 * okur (dosya başı kaynak uyarısı, `bvlc_encode_forwarded_npdu()`).
 *
 * ── TUZAK: TYPE ≠ 0x81 HATA, LENGTH TUTARSIZLIĞI UYARI ───────────────────────
 * İkisi FARKLI ciddiyettedir. Type baytı 0x81 değilse bu bir BACnet/IP mesajı
 * bile değildir (bacnetmstp.ts'nin Preamble kontrolüyle AYNI disiplin: hata
 * `errors`e düşer, çerçeve yine de sabit ofsetlerden yapısal olarak kurulur —
 * iec104.ts start-byte emsali). Length tutarsızlığı ise yalnız kendini
 * tanımlayan bir alanın kendi buffer'ıyla ÇELİŞMESİDİR — `warnings`e düşer,
 * `frame.valid`i TEK BAŞINA düşürmez.
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
import { decodeApdu } from '../bacnet/apdu';
import { decodeNpdu } from '../bacnet/npdu';

/** Katalogdaki kayıt id'siyle birebir aynı olmalı (`src/app/catalog`, plugin bağı budur). */
const PROTOCOL_ID = 'bacnet-ip';
/** Protokol adı veridir, çeviriye girmez (CLAUDE.md). */
const PROTOCOL_DISPLAY_NAME = 'BACnet/IP';

const HEX_RADIX = 16;

const BVLC_TYPE_OFFSET = 0;
const BVLC_FUNCTION_OFFSET = 1;
const BVLC_LENGTH_OFFSET = 2;
const BVLC_LENGTH_FIELD_WIDTH = 2;
/** Type(1) + Function(1) + Length(2) — dosya başı kaynak uyarısı. */
const BVLC_HEADER_LENGTH = 4;

/** `BVLL_TYPE_BACNET_IP` / `BACNET_IP_ANNEX_J` — dosya başı kaynak uyarısı. */
const BVLC_TYPE_BACNET_IP = 0x81;

/** `BIP_ADDRESS_MAX` (bacnet-stack) — 4 baytlık IPv4 + 2 baytlık UDP port. */
const BIP_ADDRESS_LENGTH = 6;
const BIP_ADDRESS_IP_LENGTH = 4;

const FUNCTION_RESULT = 0x00;
const FUNCTION_WRITE_BDT = 0x01;
const FUNCTION_READ_BDT = 0x02;
const FUNCTION_READ_BDT_ACK = 0x03;
const FUNCTION_FORWARDED_NPDU = 0x04;
const FUNCTION_REGISTER_FOREIGN_DEVICE = 0x05;
const FUNCTION_READ_FDT = 0x06;
const FUNCTION_READ_FDT_ACK = 0x07;
const FUNCTION_DELETE_FDT_ENTRY = 0x08;
const FUNCTION_DISTRIBUTE_BROADCAST_TO_NETWORK = 0x09;
const FUNCTION_ORIGINAL_UNICAST_NPDU = 0x0a;
const FUNCTION_ORIGINAL_BROADCAST_NPDU = 0x0b;

/** BVLC Function — dar, İKİ kaynak teyitli küme (dosya başı kaynak uyarısı). */
const BVLC_FUNCTION_NAMES: ReadonlyMap<number, string> = new Map([
  [FUNCTION_RESULT, 'BVLC-Result'],
  [FUNCTION_WRITE_BDT, 'Write-Broadcast-Distribution-Table'],
  [FUNCTION_READ_BDT, 'Read-Broadcast-Distribution-Table'],
  [FUNCTION_READ_BDT_ACK, 'Read-Broadcast-Distribution-Table-Ack'],
  [FUNCTION_FORWARDED_NPDU, 'Forwarded-NPDU'],
  [FUNCTION_REGISTER_FOREIGN_DEVICE, 'Register-Foreign-Device'],
  [FUNCTION_READ_FDT, 'Read-Foreign-Device-Table'],
  [FUNCTION_READ_FDT_ACK, 'Read-Foreign-Device-Table-Ack'],
  [FUNCTION_DELETE_FDT_ENTRY, 'Delete-Foreign-Device-Table-Entry'],
  [FUNCTION_DISTRIBUTE_BROADCAST_TO_NETWORK, 'Distribute-Broadcast-To-Network'],
  [FUNCTION_ORIGINAL_UNICAST_NPDU, 'Original-Unicast-NPDU'],
  [FUNCTION_ORIGINAL_BROADCAST_NPDU, 'Original-Broadcast-NPDU'],
]);

const ERROR_HEADER_TRUNCATED = 'protocol.bacnetIp.error.headerTruncated';
const ERROR_FRAME_TOO_LONG = 'protocol.bacnetIp.error.frameTooLong';
const ERROR_ABORTED = 'protocol.bacnetIp.error.aborted';
const ERROR_TYPE_INVALID = 'protocol.bacnetIp.error.typeInvalid';
const ERROR_BIP_ADDRESS_TRUNCATED = 'protocol.bacnetIp.error.bipAddressTruncated';

const WARN_LENGTH_MISMATCH = 'protocol.bacnetIp.warning.lengthMismatch';
const WARN_UNKNOWN_FUNCTION = 'protocol.bacnetIp.warning.unknownFunction';
const WARN_FUNCTION_BODY_NOT_DECODED = 'protocol.bacnetIp.warning.functionBodyNotDecoded';

const SUMMARY_NO_BODY = 'protocol.bacnetIp.summary.noBody';
const SUMMARY_APDU = 'protocol.bacnetIp.summary.apdu';
const SUMMARY_NETWORK_LAYER_MESSAGE = 'protocol.bacnetIp.summary.networkLayerMessage';
const SUMMARY_RAW_DATA = 'protocol.bacnetIp.summary.rawData';

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

/** artnet.ts'nin `formatIPv4` deseninin AYNISI (dosya başı — dotted-decimal gösterim). */
function formatIPv4(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => String(byte)).join('.');
}

export type BacnetIpFrameMetadata = {
  bvlcFunction: number;
  bvlcFunctionLabel: string | undefined;
  summaryKey: string;
  summaryParams: Record<string, string>;
};

interface BacnetIpParseOptions {
  timestamp?: number;
  direction?: FrameDirection;
  channel?: string;
  maxFrameLength?: number;
  signal?: AbortSignal;
}

interface DispatchResult {
  readonly summaryKey: string;
  readonly summaryParams: Record<string, string>;
}

/**
 * Original-Unicast-NPDU / Original-Broadcast-NPDU / Forwarded-NPDU ÜÇÜNÜN de
 * paylaştığı zincirleme: `bodyOffset`ten itibaren paylaşılan NPDU/APDU
 * çekirdeğini çağırır (bacnetmstp.ts'nin AYNI zincirleme mantığı, Karar 4).
 */
function decodeNpduChain(
  data: Uint8Array,
  bodyOffset: number,
  functionLabel: string,
  fields: ParsedField[],
  warnings: ProtocolWarning[],
  errors: ProtocolError[],
): DispatchResult {
  const errorCountBeforeNpdu = errors.length;
  const npduSummary = decodeNpdu(data.slice(bodyOffset), bodyOffset, fields, warnings, errors);
  const npduFailed = errors.length > errorCountBeforeNpdu;

  if (npduSummary.isNetworkLayerMessage) {
    return {
      summaryKey: SUMMARY_NETWORK_LAYER_MESSAGE,
      summaryParams: {
        function: functionLabel,
        messageType: npduSummary.networkMessageTypeLabel ?? formatHexByte(npduSummary.networkMessageType ?? 0),
      },
    };
  }

  if (npduFailed) {
    // NPDU kendi içinde yapısal olarak başarısız oldu — APDU'yu ÇAĞIRMA, aynı
    // bozuk baytları ikinci kez yanlış yorumlamak yerine NPDU'nun zaten
    // pushladığı truncated-frame hatasıyla yetinilir (bacnetmstp.ts emsali).
    return { summaryKey: SUMMARY_RAW_DATA, summaryParams: { function: functionLabel } };
  }

  const apduBytes = data.slice(bodyOffset + npduSummary.consumed);
  const apduSummary = decodeApdu(apduBytes, bodyOffset + npduSummary.consumed, fields, warnings, errors);
  return {
    summaryKey: SUMMARY_APDU,
    summaryParams: {
      function: functionLabel,
      pduType: apduSummary.pduTypeLabel ?? 'unknown',
      serviceChoice: apduSummary.serviceChoiceLabel ?? '—',
    },
  };
}

/**
 * Kapsam dışı bırakılan dokuz BVLC fonksiyonu (BVLC-Result, BDT/FDT
 * read/write, Register-Foreign-Device vb.): gövde varsa TEK ham blok + uyarı,
 * yoksa yalnız fonksiyon adı (dosya başı kapsam çizgisi — BBMD/FDT tablo
 * takibi YAPILMAZ).
 */
function pushRawFunctionBody(
  data: Uint8Array,
  bodyOffset: number,
  functionLabel: string,
  fields: ParsedField[],
  warnings: ProtocolWarning[],
): DispatchResult {
  if (bodyOffset >= data.length) {
    return { summaryKey: SUMMARY_NO_BODY, summaryParams: { function: functionLabel } };
  }
  const remainder = data.slice(bodyOffset);
  fields.push({
    id: 'bvlc-function-body',
    name: 'Function-Specific Data',
    offset: bodyOffset,
    length: remainder.length,
    rawBytes: remainder,
    unit: 'B',
    valid: true,
    warnings: [WARN_FUNCTION_BODY_NOT_DECODED],
  });
  warnings.push(toProtocolWarning(WARN_FUNCTION_BODY_NOT_DECODED, bodyOffset, remainder.length));
  return { summaryKey: SUMMARY_RAW_DATA, summaryParams: { function: functionLabel } };
}

function parseBacnetIpFrame(data: Uint8Array, options: BacnetIpParseOptions): ParseResult {
  if (options.signal?.aborted === true) {
    return {
      success: false,
      error: { code: 'parser-timeout', message: ERROR_ABORTED },
      consumedBytes: 0,
      recoverable: false,
    };
  }

  if (data.length < BVLC_HEADER_LENGTH) {
    return {
      success: false,
      error: {
        code: 'truncated-frame',
        message: ERROR_HEADER_TRUNCATED,
        offset: 0,
        length: data.length,
        details: { availableBytes: data.length, requiredBytes: BVLC_HEADER_LENGTH },
      },
      consumedBytes: 0,
      recoverable: true,
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

  const fields: ParsedField[] = [];
  const warnings: ProtocolWarning[] = [];
  const errors: ProtocolError[] = [];

  const type = byteAt(data, BVLC_TYPE_OFFSET);
  const typeValid = type === BVLC_TYPE_BACNET_IP;
  const typeField: ParsedField = {
    id: 'bvlc-type',
    name: 'BVLC Type',
    offset: BVLC_TYPE_OFFSET,
    length: 1,
    rawBytes: data.slice(BVLC_TYPE_OFFSET, BVLC_TYPE_OFFSET + 1),
    rawValue: type,
    valid: typeValid,
    warnings: [],
  };
  if (typeValid) {
    typeField.physicalValue = 'BACnet/IP (Annex J)';
  } else {
    typeField.warnings.push(ERROR_TYPE_INVALID);
  }
  fields.push(typeField);
  if (!typeValid) {
    // bacnetmstp.ts'nin Preamble kontrolüyle AYNI disiplin (iec104.ts start-byte
    // emsali): Type yanlış olsa da geri kalan alanlar hâlâ SABİT ofsetlerdedir —
    // motor teslim olmaz, yapısal çözümü yine gösterir.
    errors.push({
      code: 'start-delimiter-not-found',
      message: ERROR_TYPE_INVALID,
      offset: BVLC_TYPE_OFFSET,
      length: 1,
    });
  }

  const bvlcFunction = byteAt(data, BVLC_FUNCTION_OFFSET);
  const bvlcFunctionLabel = BVLC_FUNCTION_NAMES.get(bvlcFunction);
  const functionField: ParsedField = {
    id: 'bvlc-function',
    name: 'BVLC Function',
    offset: BVLC_FUNCTION_OFFSET,
    length: 1,
    rawBytes: data.slice(BVLC_FUNCTION_OFFSET, BVLC_FUNCTION_OFFSET + 1),
    rawValue: bvlcFunction,
    valid: bvlcFunctionLabel !== undefined,
    warnings: [],
  };
  if (bvlcFunctionLabel !== undefined) {
    functionField.physicalValue = bvlcFunctionLabel;
  } else {
    functionField.warnings.push(WARN_UNKNOWN_FUNCTION);
    warnings.push(toProtocolWarning(WARN_UNKNOWN_FUNCTION, BVLC_FUNCTION_OFFSET, 1));
  }
  fields.push(functionField);

  const declaredLength = readUint16BE(data, BVLC_LENGTH_OFFSET);
  // Dosya başı tuzak notu: Length KENDİSİNİ DE SAYAR, MBAP'ın tersine — bu
  // yüzden `data.length`in DOĞRUDAN karşılığı beklenir.
  const lengthMatches = declaredLength === data.length;
  const lengthField: ParsedField = {
    id: 'bvlc-length',
    name: 'Length',
    offset: BVLC_LENGTH_OFFSET,
    length: BVLC_LENGTH_FIELD_WIDTH,
    rawBytes: data.slice(BVLC_LENGTH_OFFSET, BVLC_LENGTH_OFFSET + BVLC_LENGTH_FIELD_WIDTH),
    rawValue: declaredLength,
    unit: 'B',
    valid: lengthMatches,
    warnings: [],
  };
  if (!lengthMatches) {
    lengthField.warnings.push(WARN_LENGTH_MISMATCH);
    warnings.push(toProtocolWarning(WARN_LENGTH_MISMATCH, BVLC_LENGTH_OFFSET, BVLC_LENGTH_FIELD_WIDTH));
  }
  fields.push(lengthField);

  const functionLabel = bvlcFunctionLabel ?? formatHexByte(bvlcFunction);
  let dispatch: DispatchResult;

  if (bvlcFunction === FUNCTION_ORIGINAL_UNICAST_NPDU || bvlcFunction === FUNCTION_ORIGINAL_BROADCAST_NPDU) {
    dispatch = decodeNpduChain(data, BVLC_HEADER_LENGTH, functionLabel, fields, warnings, errors);
  } else if (bvlcFunction === FUNCTION_FORWARDED_NPDU) {
    if (data.length < BVLC_HEADER_LENGTH + BIP_ADDRESS_LENGTH) {
      errors.push({
        code: 'truncated-frame',
        message: ERROR_BIP_ADDRESS_TRUNCATED,
        offset: BVLC_HEADER_LENGTH,
        length: data.length - BVLC_HEADER_LENGTH,
        details: { availableBytes: data.length - BVLC_HEADER_LENGTH, requiredBytes: BIP_ADDRESS_LENGTH },
      });
      dispatch = { summaryKey: SUMMARY_RAW_DATA, summaryParams: { function: functionLabel } };
    } else {
      const ipBytes = data.slice(BVLC_HEADER_LENGTH, BVLC_HEADER_LENGTH + BIP_ADDRESS_IP_LENGTH);
      const port = readUint16BE(data, BVLC_HEADER_LENGTH + BIP_ADDRESS_IP_LENGTH);
      fields.push({
        id: 'bvlc-originating-address',
        name: 'Originating Device B/IP Address',
        offset: BVLC_HEADER_LENGTH,
        length: BIP_ADDRESS_LENGTH,
        rawBytes: data.slice(BVLC_HEADER_LENGTH, BVLC_HEADER_LENGTH + BIP_ADDRESS_LENGTH),
        physicalValue: `${formatIPv4(ipBytes)}:${String(port)}`,
        valid: true,
        warnings: [],
      });
      dispatch = decodeNpduChain(
        data,
        BVLC_HEADER_LENGTH + BIP_ADDRESS_LENGTH,
        functionLabel,
        fields,
        warnings,
        errors,
      );
    }
  } else {
    dispatch = pushRawFunctionBody(data, BVLC_HEADER_LENGTH, functionLabel, fields, warnings);
  }

  const metadata: BacnetIpFrameMetadata = {
    bvlcFunction,
    bvlcFunctionLabel,
    summaryKey: dispatch.summaryKey,
    summaryParams: dispatch.summaryParams,
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

export function parseBacnetIp(data: Uint8Array): ParseResult {
  return parseBacnetIpFrame(data, {});
}

export const bacnetIpParser: ProtocolParser = {
  protocolId: PROTOCOL_ID,
  displayName: PROTOCOL_DISPLAY_NAME,

  /** Ucuz ön eleme: asgari uzunluk + BVLC Type. Length/Function tutarlılığı burada denetlenmez. */
  canParse(data: Uint8Array): boolean {
    if (data.length < BVLC_HEADER_LENGTH) return false;
    return byteAt(data, BVLC_TYPE_OFFSET) === BVLC_TYPE_BACNET_IP;
  },

  parse(data: Uint8Array, context?: ParseContext): ParseResult {
    const options: BacnetIpParseOptions = {};
    if (context?.timestamp !== undefined) options.timestamp = context.timestamp;
    if (context?.direction !== undefined) options.direction = context.direction;
    if (context?.channel !== undefined) options.channel = context.channel;
    if (context?.maxFrameLength !== undefined) options.maxFrameLength = context.maxFrameLength;
    if (context?.signal !== undefined) options.signal = context.signal;
    return parseBacnetIpFrame(data, options);
  },
};

/**
 * Örnek çerçeveler. NPDU+APDU baytları (`01 04 00 25 01 0c aa bb cc` ve
 * `01 00 10 00 aa bb cc dd`) `bacnetmstp.ts`nin ZATEN test edilmiş Data
 * gövdeleriyle BİREBİR AYNIDIR — paylaşılan çekirdeğin BVLL bağlamında da aynı
 * şekilde çalıştığını kanıtlamak için BİLİNÇLİ olarak yeniden kullanıldı (yeni
 * bir NPDU/APDU baytı icat etmek yerine zaten doğrulanmış bir baytı ödünç
 * almak hata payını azaltır). B/IP adresindeki port 0xBAC0 = 47808 ondalık —
 * BACnet/IP'nin iyi bilinen varsayılan UDP portu (yalnız betimleyici örnek
 * değeri, motor tarafından ayrıştırılmaz/doğrulanmaz — Karar 7, udp.ts'ye
 * port adlandırması eklenmedi).
 */
const EXAMPLE_FRAMES: ExampleFrame[] = [
  {
    id: 'original-unicast-npdu-read-property',
    name: 'protocol.bacnetIp.example.originalUnicastNpduReadProperty.name',
    // Type=0x81, Function=0x0A, Length=13 (4 başlık + 9 NPDU/APDU). NPDU
    // Version=1/Control=0x04 (expecting-reply) + APDU Confirmed-Request
    // (Invoke ID 1, Service Choice 12 ReadProperty) — bacnetmstp.ts'nin
    // "data-expecting-reply-read-property" örneğiyle AYNI Data gövdesi.
    bytes: Uint8Array.from([0x81, 0x0a, 0x00, 0x0d, 0x01, 0x04, 0x00, 0x25, 0x01, 0x0c, 0xaa, 0xbb, 0xcc]),
    description: 'protocol.bacnetIp.example.originalUnicastNpduReadProperty.description',
    expectedValid: true,
  },
  {
    id: 'original-broadcast-npdu-i-am',
    name: 'protocol.bacnetIp.example.originalBroadcastNpduIAm.name',
    // Type=0x81, Function=0x0B, Length=12 (4 başlık + 8 NPDU/APDU). NPDU
    // Version=1/Control=0x00 + APDU Unconfirmed-Request (Service Choice 0
    // I-Am), Invoke ID YOK — bacnetmstp.ts'nin "data-not-expecting-reply-i-am"
    // örneğiyle AYNI Data gövdesi.
    bytes: Uint8Array.from([0x81, 0x0b, 0x00, 0x0c, 0x01, 0x00, 0x10, 0x00, 0xaa, 0xbb, 0xcc, 0xdd]),
    description: 'protocol.bacnetIp.example.originalBroadcastNpduIAm.description',
    expectedValid: true,
  },
  {
    id: 'forwarded-npdu',
    name: 'protocol.bacnetIp.example.forwardedNpdu.name',
    // Type=0x81, Function=0x04, Length=18 (4 başlık + 6 B/IP adresi + 8
    // NPDU/APDU). B/IP adresi 192.168.1.50:47808 — NPDU ancak offset 10'da
    // başlar (dosya başı offset-kayması tuzak notu); NPDU/APDU gövdesi
    // "original-broadcast-npdu-i-am" ile AYNI (I-Am).
    bytes: Uint8Array.from([
      0x81, 0x04, 0x00, 0x12, 0xc0, 0xa8, 0x01, 0x32, 0xba, 0xc0, 0x01, 0x00, 0x10, 0x00, 0xaa, 0xbb, 0xcc, 0xdd,
    ]),
    description: 'protocol.bacnetIp.example.forwardedNpdu.description',
    expectedValid: true,
  },
  {
    id: 'register-foreign-device',
    name: 'protocol.bacnetIp.example.registerForeignDevice.name',
    // Type=0x81, Function=0x05, Length=6 (4 başlık + 2 bayt TTL=300s). BBMD/FDT
    // tablo takibi YAPILMAZ (dosya başı kapsam çizgisi) — yalnız fonksiyon adı
    // + ham gövde + uyarı.
    bytes: Uint8Array.from([0x81, 0x05, 0x00, 0x06, 0x01, 0x2c]),
    description: 'protocol.bacnetIp.example.registerForeignDevice.description',
    expectedValid: true,
  },
  {
    id: 'bvlc-result',
    name: 'protocol.bacnetIp.example.bvlcResult.name',
    // Type=0x81, Function=0x00, Length=6 (4 başlık + 2 bayt Result Code ham).
    bytes: Uint8Array.from([0x81, 0x00, 0x00, 0x06, 0x00, 0x00]),
    description: 'protocol.bacnetIp.example.bvlcResult.description',
    expectedValid: true,
  },
  {
    id: 'length-mismatch',
    name: 'protocol.bacnetIp.example.lengthMismatch.name',
    // "original-unicast-npdu-read-property" ile AYNI 13 baytlık gövde, yalnız
    // Length alanı bilerek 99 (0x63) yazıldı — gerçek buffer (13 bayt) yine de
    // TEK doğru kaynak sayılır (dosya başı Length tuzak notu), yalnız UYARI
    // üretir, çerçeve yapısal olarak yine valid:true kalır.
    bytes: Uint8Array.from([0x81, 0x0a, 0x00, 0x63, 0x01, 0x04, 0x00, 0x25, 0x01, 0x0c, 0xaa, 0xbb, 0xcc]),
    description: 'protocol.bacnetIp.example.lengthMismatch.description',
    expectedValid: true,
  },
  {
    id: 'invalid-type',
    name: 'protocol.bacnetIp.example.invalidType.name',
    // "original-unicast-npdu-read-property" ile AYNI gövde, yalnız Type baytı
    // 0x81 yerine 0x01 — bu bir BACnet/IP mesajı bile değildir (hata yolu),
    // ama geri kalan alanlar yine SABİT ofsetlerden yapısal olarak kurulur.
    bytes: Uint8Array.from([0x01, 0x0a, 0x00, 0x0d, 0x01, 0x04, 0x00, 0x25, 0x01, 0x0c, 0xaa, 0xbb, 0xcc]),
    description: 'protocol.bacnetIp.example.invalidType.description',
    expectedValid: false,
  },
];

export const bacnetIpPlugin: ProtocolPlugin = {
  id: PROTOCOL_ID,
  name: PROTOCOL_DISPLAY_NAME,
  category: 'building-automation',
  parser: bacnetIpParser,
  documentation: {
    summary: 'protocol.bacnetIp.documentation.summary',
    layer: 'multi-layer',
    references: [
      {
        title:
          'bacnet-stack (github.com/bacnet-stack/bacnet-stack, MIT — yalnız sabitler/format referansı, kod kopyalanmadı)',
        url: 'https://github.com/bacnet-stack/bacnet-stack',
      },
      {
        title: 'Wireshark BVLC dissector (epan/dissectors/packet-bvlc.c)',
        url: 'https://github.com/wireshark/wireshark',
      },
    ],
  },
  exampleFrames: EXAMPLE_FRAMES,
};
