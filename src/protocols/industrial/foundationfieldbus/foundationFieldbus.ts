/**
 * FOUNDATION Fieldbus (FieldComm Group) — proses otomasyonu dijital veri yolu.
 * İki AYRI katmanı vardır: **H1** (31.25 kbit/s, publisher/subscriber, segment
 * başına ≤32 cihaz, ≤1900 m) ve **HSE** (High Speed Ethernet, 100 Mbit/s
 * kontrol omurgası, standart TCP/UDP/IP üstünde).
 *
 * Faz 10, dalga 13g. `classic-fieldbus` ailesinin dördüncü ve son kaydı;
 * bu kayıtla aile KAPANIR.
 *
 * ── ÇÖZÜLEN KATMAN: **HSE**, H1 DEĞİL ─────────────────────────────────────
 * Kaynak araştırmasının sonucu bu kapsamı DAYATTI:
 *   • **HSE** için kamuya açık, spec bölüm numarası veren bir alan tablosu
 *     VAR (aşağıda) — çözülebilir.
 *   • **H1** için YOK. H1'in veri bağı çerçevesi (preamble + başlangıç
 *     sınırlayıcı + DLPDU + FCS + bitiş sınırlayıcı) IEC 61158-2/FF-816'da
 *     tanımlıdır ve ikisi de ücretlidir. Dahası H1'in başlangıç/bitiş
 *     sınırlayıcıları **N+/N− veri-olmayan sembollerdir**: Manchester kodlama
 *     kuralını bilerek ihlal eden fiziksel katman işaretleridir ve BAYT OLARAK
 *     TEMSİL EDİLEMEZLER. Yani H1 bu panelin bayt girdisiyle sınırlayıcıları
 *     dâhil çözülemez; kaynak bulunsa bile ayrı bir sinyal-seviyesi girdi
 *     ister. Bu, `iec-61850`in "yalnız GOOSE" kararının aynı sınıfı: kapsam
 *     BİLİNÇLİ daraltıldı ve katalog özetinde açıkça yazıldı.
 *
 * ── KAYNAK — TEK BİR KAMUYA AÇIK KAYNAK, DÜRÜSTÇE SÖYLENİYOR ─────────────
 * W = **Wireshark FF-HSE dissector'ı** `epan/dissectors/packet-ff.c`
 *     (GPL-2.0-or-later). Dosyanın kendi başlığı hem katkıyı hem SPEC BÖLÜMÜNÜ
 *     veriyor: *"Routines for FF-HSE packet disassembly — FF-588-1.3: HSE
 *     Field Device Access Agent, 6. Field Device Access Agent Interface"*,
 *     "(c) Copyright 2008, Yukiyo Akisada <Yukiyo.Akisada@jp.yokogawa.com>" —
 *     yani protokolü uygulayan bir FF üyesi firmanın (Yokogawa) mühendisi.
 *     `dissect_ff_msg_hdr()` §6.3 "Message Header"ı 12 bayt olarak açar.
 *     https://github.com/wireshark/wireshark/blob/master/epan/dissectors/packet-ff.c
 *
 * **İKİNCİ BİR BAĞIMSIZ KAYNAK BULUNAMADI** ve bu SAKLANMIYOR: her çözümde
 * `WARN_LAYOUT_SINGLE_SOURCE` basılır. Aranan ve REDDEDİLEN adaylar:
 *   ✗ `carbon-evolution/ot-nmap-blue-team` içindeki `ff-hse-discover-improved.nse`
 *     ve `ffhse_mock_server.py` — "Byte 0: protocol version, Byte 1: service
 *     code, tüm çok baytlı alanlar LITTLE-endian" diyor; W'nin 12 baytlık
 *     BIG-endian FDA başlığıyla ÇELİŞİYOR ve hiçbir spec'e dayanmıyor
 *     (yapay üretilmiş bir "honeypot" biçimi). KULLANILMADI.
 *   ✗ `erikwang2013/industrial-protocols-foundationfieldbus` — aynı yazarın
 *     CC-Link paketindeki çerçeve yapısı kanıtlanabilir biçimde uydurmaydı
 *     (bkz. `ccLink.ts` dosya başı); bu paket de incelenmedi/kullanılmadı.
 * KISMİ, BAĞIMSIZ TEYİT: **IANA service-names/port-numbers kayıt defteri**
 * `ff-annunc 1089`, `ff-fms 1090`, `ff-sm 1091`, `ff-lr-port 3622` girdilerini
 * "Fieldbus_Foundation" tarafından atanmış olarak listeliyor. Bu, protokol
 * kimliği alanının adlandırdığı DÖRT alt protokolü (FDA / SM / FMS / LAN
 * Redundancy) bağımsız olarak doğruluyor — bayt ofsetlerini değil.
 * https://www.iana.org/assignments/service-names-port-numbers/service-names-port-numbers.csv
 *
 * ── GİRDİ: FDA MESAJI, TCP/UDP TAŞIYICISI DEĞİL ───────────────────────────
 * Girdi, TCP ya da UDP yükünün İÇİNDEKİ tek bir FDA mesajıdır (1089/1090/1091
 * portlarından biri). Ethernet/IP/TCP başlıkları BU MOTORUN GİRDİSİ DEĞİLDİR —
 * `ethercat.ts` ailesinin "tam Ethernet çerçevesi" sözleşmesi buraya UYMAZ,
 * çünkü FF-HSE ham Ethernet değil normal bir TCP/UDP uygulamasıdır (kendi
 * EtherType'ı yoktur). Bu ayrım `opcua.ts`in girdi sözleşmesiyle aynı sınıf.
 *
 * ── GÖVDE HAM BIRAKILIR — SAHTE ALAN KIRILIMI YOK ─────────────────────────
 * FDA başlığından sonraki "Service-Specific Parameters + User Data" bölgesi
 * servise göre onlarca farklı yapı alır (W'de tek başına ~10 000 satır) ve
 * hepsi TEK kaynaklıdır. Bu motor bölgeyi TEK PARÇA ham basar ve nedenini
 * `WARN_BODY_RAW` ile söyler. Başlık + fragman (trailer) çözülür; gövde
 * çözülmez — `profinet.ts`in GSDML'siz I/O verisi emsali.
 *
 * ── STATUS: 'partial' — GEREKÇE (iec-61850 GOOSE-only emsali) ────────────
 * Kayıt İKİ katman vaat ediyor (araç listesinde ayrı ayrı "H1" ve "HSE"
 * maddeleri var). Bu motor HSE'nin FDA zarfını çözer, H1'i hiç çözmez ve
 * HSE'nin servis gövdesini ham bırakır. Üstelik alan yerleşimi TEK kaynaklı.
 * Rozet bu yüzden `ready` değil `partial`, ve katalog özeti neyin çözülüp
 * neyin ÇÖZÜLMEDİĞİNİ açıkça yazar.
 *
 * ── decodeOptions: AÇILMADI, GEREKÇESİ ───────────────────────────────────
 *  1. "Hangi alt protokol / servis" → ÇERÇEVEDE YAZAR (bayt 2 ve 3).
 *  2. "Hangi porttan geldi" → servis ayrımını zaten protokol kimliği veriyor;
 *     port bir kanal açmayı hak edecek kadar bilgi eklemiyor.
 *  3. "Gövde nasıl kırılsın" → bir `select` alanına SIĞMAZ; servise özel
 *     onlarca yapı ister ve hepsi tek kaynaklı (yukarı).
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
  ProtocolErrorCode,
  ProtocolParser,
  ProtocolPlugin,
  ProtocolWarning,
} from '@/protocol-core/types';

/** Katalogdaki kayıt id'siyle birebir aynı olmalı — plugin bağı budur. */
const PROTOCOL_ID = 'foundation-fieldbus';
/** Protokol adı veridir, çeviriye girmez (CLAUDE.md). */
const PROTOCOL_DISPLAY_NAME = 'FOUNDATION Fieldbus';

/** W `FDA_MSG_HDR_LENGTH` — §6.3 Message Header. */
const FDA_HEADER_LENGTH = 12;
const HEX_RADIX = 16;

/** W `ff.h` seçenek bayrakları (bayt 1). */
const OPTION_MESSAGE_NUMBER_MASK = 0x80;
const OPTION_INVOKE_ID_MASK = 0x40;
const OPTION_TIME_STAMP_MASK = 0x20;
const OPTION_RESERVED_MASK = 0x10;
const OPTION_EXTENDED_CONTROL_MASK = 0x08;
const OPTION_PAD_LENGTH_MASK = 0x07;

const TRAILER_MESSAGE_NUMBER_LENGTH = 4;
const TRAILER_INVOKE_ID_LENGTH = 4;
const TRAILER_TIME_STAMP_LENGTH = 8;
const TRAILER_EXTENDED_CONTROL_LENGTH = 4;

/** W `ff.h`: bayt 2 = protokol kimliği (üst 6 bit) + mesaj tipi (alt 2 bit). */
const PROTOCOL_ID_MASK = 0xfc;
const PROTOCOL_ID_SHIFT = 2;
const MESSAGE_TYPE_MASK = 0x03;

/** W `ff.h`: bayt 3 = onaylı bayrağı (bit 7) + servis kimliği (bit 0-6). */
const SERVICE_CONFIRMED_FLAG_MASK = 0x80;
const SERVICE_ID_MASK = 0x7f;

export const ERROR_FRAME_TOO_SHORT = 'protocol.foundationFieldbus.error.frameTooShort';
export const ERROR_FRAME_TOO_LONG = 'protocol.foundationFieldbus.error.frameTooLong';
export const ERROR_ABORTED = 'protocol.foundationFieldbus.error.aborted';
export const ERROR_MESSAGE_LENGTH_MISMATCH =
  'protocol.foundationFieldbus.error.messageLengthMismatch';

export const WARN_LAYOUT_SINGLE_SOURCE = 'protocol.foundationFieldbus.warning.layoutSingleSource';
export const WARN_H1_NOT_DECODED = 'protocol.foundationFieldbus.warning.h1NotDecoded';
export const WARN_BODY_RAW = 'protocol.foundationFieldbus.warning.bodyRaw';
export const WARN_PROTOCOL_ID_NOT_NAMED = 'protocol.foundationFieldbus.warning.protocolIdNotNamed';
export const WARN_SERVICE_NOT_NAMED = 'protocol.foundationFieldbus.warning.serviceNotNamed';
export const WARN_RESERVED_OPTION_SET = 'protocol.foundationFieldbus.warning.reservedOptionSet';
export const WARN_TRAILER_TRUNCATED = 'protocol.foundationFieldbus.warning.trailerTruncated';
export const WARN_TRAILING_BYTES = 'protocol.foundationFieldbus.warning.trailingBytes';

const SUMMARY_MESSAGE = 'protocol.foundationFieldbus.summary.message';

/** W `names_proto` — değer, bayt 2'nin üst 6 biti SAĞA KAYDIRILMIŞ hâlidir. */
const PROTOCOL_NAMES: ReadonlyMap<number, string> = new Map([
  [0x00, 'Unused'],
  [0x01, 'FDA Session Management'],
  [0x02, 'SM (System Management)'],
  [0x03, 'FMS (Fieldbus Message Specification)'],
  [0x04, 'LAN Redundancy'],
]);

/** W `names_type` — bayt 2'nin alt iki biti. */
const MESSAGE_TYPE_NAMES: ReadonlyMap<number, string> = new Map([
  [0x00, 'Request Message'],
  [0x01, 'Response Message'],
  [0x02, 'Error Message'],
]);

/** W `names_pad_len` — seçenek baytının alt üç biti. */
const PAD_LENGTH_NAMES: ReadonlyMap<number, string> = new Map([
  [0x00, 'No padding'],
  [0x03, 'Pad to 4 byte boundary'],
  [0x07, 'Pad to 8 byte boundary'],
]);

/** W `names_fda_confirmed`. */
const FDA_CONFIRMED_SERVICES: ReadonlyMap<number, string> = new Map([
  [1, 'FDA Open Session'],
  [3, 'FDA Idle'],
]);

/** W `names_sm_unconfirmed` / `names_sm_confirmed`. */
const SM_UNCONFIRMED_SERVICES: ReadonlyMap<number, string> = new Map([
  [1, 'SM Find Tag Query'],
  [2, 'SM Find Tag Reply'],
  [16, 'SM Device Annunciation'],
]);

const SM_CONFIRMED_SERVICES: ReadonlyMap<number, string> = new Map([
  [3, 'SM Identify'],
  [12, 'SM Clear Address'],
  [14, 'SM Set Assignment Info'],
  [15, 'SM Clear Assignment Info'],
]);

/** W `names_fms_unconfirmed` / `names_fms_confirmed`. */
const FMS_UNCONFIRMED_SERVICES: ReadonlyMap<number, string> = new Map([
  [0, 'FMS Information Report'],
  [1, 'FMS Unsolicited Status'],
  [2, 'FMS Event Notification'],
  [16, 'FMS Information Report with Subindex'],
  [17, 'FMS Information Report On Change'],
  [18, 'FMS Information Report On Change with Subindex'],
  [112, 'FMS Abort'],
]);

const FMS_CONFIRMED_SERVICES: ReadonlyMap<number, string> = new Map([
  [0, 'FMS Status'],
  [1, 'FMS Identify'],
  [2, 'FMS Read'],
  [3, 'FMS Write'],
  [4, 'FMS Get OD'],
  [7, 'FMS Define Variable List'],
  [8, 'FMS Delete Variable List'],
  [9, 'FMS Initiate Download Sequence'],
  [10, 'FMS Download Segment'],
  [11, 'FMS Terminate Download Sequence'],
  [12, 'FMS Initiate Upload Sequence'],
  [13, 'FMS Upload Segment'],
  [14, 'FMS Terminate Upload Sequence'],
  [15, 'FMS Request Domain Download'],
  [16, 'FMS Request Domain Upload'],
  [17, 'FMS Create Program Invocation'],
  [18, 'FMS Delete Program Invocation'],
  [19, 'FMS Start'],
  [20, 'FMS Stop'],
  [21, 'FMS Resume'],
  [22, 'FMS Reset'],
  [23, 'FMS Kill'],
  [24, 'FMS Alter Event Condition Monitoring'],
  [25, 'FMS Acknowledge Event Notification'],
  [28, 'FMS Initiate Put OD'],
  [29, 'FMS Put OD'],
  [30, 'FMS Terminate Put OD'],
  [31, 'FMS Generic Initiate Download Sequence'],
  [32, 'FMS Generic Download Segment'],
  [33, 'FMS Generic Terminate Download Sequence'],
  [82, 'FMS Read with Subindex'],
  [83, 'FMS Write with Subindex'],
  [96, 'FMS Initiate'],
]);

/** W `names_lan_unconfirmed` / `names_lan_confirmed`. */
const LAN_UNCONFIRMED_SERVICES: ReadonlyMap<number, string> = new Map([[1, 'Diagnostic Message']]);

const LAN_CONFIRMED_SERVICES: ReadonlyMap<number, string> = new Map([
  [1, 'LAN Redundancy Get Information'],
  [2, 'LAN Redundancy Put Information'],
  [3, 'LAN Redundancy Get Statistics'],
]);

function lookupService(
  protocolId: number,
  confirmed: boolean,
  serviceId: number,
): string | undefined {
  switch (protocolId) {
    case 0x01:
      return confirmed ? FDA_CONFIRMED_SERVICES.get(serviceId) : undefined;
    case 0x02:
      return confirmed
        ? SM_CONFIRMED_SERVICES.get(serviceId)
        : SM_UNCONFIRMED_SERVICES.get(serviceId);
    case 0x03:
      return confirmed
        ? FMS_CONFIRMED_SERVICES.get(serviceId)
        : FMS_UNCONFIRMED_SERVICES.get(serviceId);
    case 0x04:
      return confirmed
        ? LAN_CONFIRMED_SERVICES.get(serviceId)
        : LAN_UNCONFIRMED_SERVICES.get(serviceId);
    default:
      return undefined;
  }
}

function byteAt(data: Uint8Array, offset: number): number {
  return data[offset] ?? 0;
}

/** FDA başlığı BIG-ENDIAN'dır (W'nin bütün alanları `ENC_BIG_ENDIAN`). */
function readUint32Be(data: Uint8Array, offset: number): number {
  return (
    ((byteAt(data, offset) << 24) |
      (byteAt(data, offset + 1) << 16) |
      (byteAt(data, offset + 2) << 8) |
      byteAt(data, offset + 3)) >>>
    0
  );
}

function formatHex(value: number, digits: number): string {
  return `0x${value.toString(HEX_RADIX).toUpperCase().padStart(digits, '0')}`;
}

function toProtocolWarning(key: string): ProtocolWarning {
  return { code: key, message: key };
}

class WarningSink {
  private readonly seen = new Set<string>();
  readonly warnings: ProtocolWarning[] = [];

  push(key: string): void {
    if (this.seen.has(key)) return;
    this.seen.add(key);
    this.warnings.push(toProtocolWarning(key));
  }
}

interface FailureInit {
  readonly code: ProtocolErrorCode;
  readonly message: string;
  readonly recoverable: boolean;
  readonly offset?: number;
  readonly length?: number;
  readonly details?: Record<string, unknown>;
}

function fail(init: FailureInit): ParseResult {
  const error: ProtocolError = { code: init.code, message: init.message };
  if (init.offset !== undefined) error.offset = init.offset;
  if (init.length !== undefined) error.length = init.length;
  if (init.details !== undefined) error.details = init.details;
  return { success: false, error, consumedBytes: 0, recoverable: init.recoverable };
}

export type FoundationFieldbusFrameMetadata = {
  protocolName: string | undefined;
  serviceName: string | undefined;
  messageLength: number;
  summaryKey: string;
  summaryParams: Record<string, string>;
};

interface FoundationFieldbusParseOptions {
  timestamp?: number;
  direction?: FrameDirection;
  channel?: string;
  maxFrameLength?: number;
  signal?: AbortSignal;
}

interface FieldInit {
  readonly id: string;
  readonly name: string;
  readonly offset: number;
  readonly length: number;
  readonly rawValue?: number | string;
  readonly physicalValue?: string;
  readonly unit?: string;
  readonly valid?: boolean;
  readonly warnings?: readonly string[];
}

function pushField(fields: ParsedField[], data: Uint8Array, init: FieldInit): void {
  const field: ParsedField = {
    id: init.id,
    name: init.name,
    offset: init.offset,
    length: init.length,
    rawBytes: data.slice(init.offset, init.offset + init.length),
    valid: init.valid ?? true,
    warnings: init.warnings === undefined ? [] : [...init.warnings],
  };
  if (init.rawValue !== undefined) field.rawValue = init.rawValue;
  if (init.physicalValue !== undefined) field.physicalValue = init.physicalValue;
  if (init.unit !== undefined) field.unit = init.unit;
  fields.push(field);
}

function pushFlag(
  fields: ParsedField[],
  data: Uint8Array,
  init: {
    readonly id: string;
    readonly name: string;
    readonly offset: number;
    readonly value: number;
    readonly mask: number;
    readonly onLabel: string;
    readonly offLabel: string;
  },
): boolean {
  const set = (init.value & init.mask) !== 0;
  pushField(fields, data, {
    id: init.id,
    name: init.name,
    offset: init.offset,
    length: 1,
    rawValue: set ? 1 : 0,
    physicalValue: set ? init.onLabel : init.offLabel,
  });
  return set;
}

function parseFoundationFieldbusFrame(
  data: Uint8Array,
  options: FoundationFieldbusParseOptions,
): ParseResult {
  if (options.signal?.aborted === true) {
    return fail({ code: 'parser-timeout', message: ERROR_ABORTED, recoverable: false });
  }

  if (options.maxFrameLength !== undefined && data.length > options.maxFrameLength) {
    return fail({
      code: 'frame-too-long',
      message: ERROR_FRAME_TOO_LONG,
      recoverable: false,
      offset: options.maxFrameLength,
      length: data.length - options.maxFrameLength,
      details: { maxFrameLength: options.maxFrameLength, frameLength: data.length },
    });
  }

  if (data.length < FDA_HEADER_LENGTH) {
    return fail({
      code: 'truncated-frame',
      message: ERROR_FRAME_TOO_SHORT,
      recoverable: true,
      offset: 0,
      length: data.length,
      details: { availableBytes: data.length, requiredBytes: FDA_HEADER_LENGTH },
    });
  }

  const fields: ParsedField[] = [];
  const warnings = new WarningSink();
  const errors: ProtocolError[] = [];
  const summaryParams: Record<string, string> = {};

  // Bu iki uyarı HER çözümde basılır: kullanıcı neyi görmediğini bilmelidir.
  warnings.push(WARN_LAYOUT_SINGLE_SOURCE);
  warnings.push(WARN_H1_NOT_DECODED);

  const version = byteAt(data, 0);
  pushField(fields, data, {
    id: 'fda-version',
    name: 'FDA Message Version',
    offset: 0,
    length: 1,
    rawValue: version,
    physicalValue: `${version}`,
  });

  const optionByte = byteAt(data, 1);
  pushField(fields, data, {
    id: 'options',
    name: 'Options',
    offset: 1,
    length: 1,
    rawValue: optionByte,
    physicalValue: formatHex(optionByte, 2),
  });
  const hasMessageNumber = pushFlag(fields, data, {
    id: 'option-message-number',
    name: 'Options — Message Number present (bit 7)',
    offset: 1,
    value: optionByte,
    mask: OPTION_MESSAGE_NUMBER_MASK,
    onLabel: 'Present',
    offLabel: 'Absent',
  });
  const hasInvokeId = pushFlag(fields, data, {
    id: 'option-invoke-id',
    name: 'Options — Invoke ID present (bit 6)',
    offset: 1,
    value: optionByte,
    mask: OPTION_INVOKE_ID_MASK,
    onLabel: 'Present',
    offLabel: 'Absent',
  });
  const hasTimeStamp = pushFlag(fields, data, {
    id: 'option-time-stamp',
    name: 'Options — Time Stamp present (bit 5)',
    offset: 1,
    value: optionByte,
    mask: OPTION_TIME_STAMP_MASK,
    onLabel: 'Present',
    offLabel: 'Absent',
  });
  const reservedSet = (optionByte & OPTION_RESERVED_MASK) !== 0;
  if (reservedSet) warnings.push(WARN_RESERVED_OPTION_SET);
  pushField(fields, data, {
    id: 'option-reserved',
    name: 'Options — Reserved (bit 4)',
    offset: 1,
    length: 1,
    rawValue: reservedSet ? 1 : 0,
    physicalValue: reservedSet ? 'Set' : 'Clear',
    valid: !reservedSet,
    warnings: reservedSet ? [WARN_RESERVED_OPTION_SET] : [],
  });
  const hasExtendedControl = pushFlag(fields, data, {
    id: 'option-extended-control',
    name: 'Options — Extended Control Field present (bit 3)',
    offset: 1,
    value: optionByte,
    mask: OPTION_EXTENDED_CONTROL_MASK,
    onLabel: 'Present',
    offLabel: 'Absent',
  });
  const padLength = optionByte & OPTION_PAD_LENGTH_MASK;
  pushField(fields, data, {
    id: 'option-pad-length',
    name: 'Options — Pad Length (bits 0-2)',
    offset: 1,
    length: 1,
    rawValue: padLength,
    physicalValue: PAD_LENGTH_NAMES.get(padLength) ?? formatHex(padLength, 1),
  });

  const protocolByte = byteAt(data, 2);
  const protocolId = (protocolByte & PROTOCOL_ID_MASK) >>> PROTOCOL_ID_SHIFT;
  const messageType = protocolByte & MESSAGE_TYPE_MASK;
  const protocolName = PROTOCOL_NAMES.get(protocolId);
  if (protocolName === undefined) warnings.push(WARN_PROTOCOL_ID_NOT_NAMED);
  pushField(fields, data, {
    id: 'protocol-id',
    name: 'Protocol Id (bits 2-7)',
    offset: 2,
    length: 1,
    rawValue: protocolId,
    physicalValue: protocolName ?? formatHex(protocolId, 2),
    valid: protocolName !== undefined,
    warnings: protocolName === undefined ? [WARN_PROTOCOL_ID_NOT_NAMED] : [],
  });
  const messageTypeName = MESSAGE_TYPE_NAMES.get(messageType);
  pushField(fields, data, {
    id: 'message-type',
    name: 'Confirmed Message Type (bits 0-1)',
    offset: 2,
    length: 1,
    rawValue: messageType,
    physicalValue: messageTypeName ?? formatHex(messageType, 1),
    valid: messageTypeName !== undefined,
  });
  summaryParams['protocol'] = protocolName ?? formatHex(protocolId, 2);

  const serviceByte = byteAt(data, 3);
  const confirmed = (serviceByte & SERVICE_CONFIRMED_FLAG_MASK) !== 0;
  const serviceId = serviceByte & SERVICE_ID_MASK;
  pushField(fields, data, {
    id: 'service-confirmed-flag',
    name: 'Service — Confirmed flag (bit 7)',
    offset: 3,
    length: 1,
    rawValue: confirmed ? 1 : 0,
    physicalValue: confirmed ? 'Confirmed service' : 'Unconfirmed service',
  });
  const serviceName = lookupService(protocolId, confirmed, serviceId);
  if (serviceName === undefined) warnings.push(WARN_SERVICE_NOT_NAMED);
  pushField(fields, data, {
    id: 'service-id',
    name: 'Service — Service Id (bits 0-6)',
    offset: 3,
    length: 1,
    rawValue: serviceId,
    physicalValue: serviceName ?? formatHex(serviceId, 2),
    valid: serviceName !== undefined,
    warnings: serviceName === undefined ? [WARN_SERVICE_NOT_NAMED] : [],
  });
  summaryParams['service'] = serviceName ?? formatHex(serviceId, 2);

  const fdaAddress = readUint32Be(data, 4);
  pushField(fields, data, {
    id: 'fda-address',
    name: 'FDA Address',
    offset: 4,
    length: 4,
    rawValue: fdaAddress,
    physicalValue: formatHex(fdaAddress, 8),
  });

  const messageLength = readUint32Be(data, 8);
  const lengthMatches = messageLength === data.length;
  pushField(fields, data, {
    id: 'message-length',
    name: 'Message Length',
    offset: 8,
    length: 4,
    rawValue: messageLength,
    physicalValue: `${messageLength}`,
    unit: 'B',
    valid: lengthMatches,
    warnings: lengthMatches ? [] : [ERROR_MESSAGE_LENGTH_MISMATCH],
  });
  if (!lengthMatches) {
    errors.push({
      code: 'length-mismatch',
      message: ERROR_MESSAGE_LENGTH_MISMATCH,
      offset: 8,
      length: 4,
      details: { declaredLength: messageLength, availableBytes: data.length },
    });
  }

  // Trailer, mesajın SONUNDADIR ve boyu seçenek bayrağından çıkar (W).
  let trailerLength = 0;
  if (hasMessageNumber) trailerLength += TRAILER_MESSAGE_NUMBER_LENGTH;
  if (hasInvokeId) trailerLength += TRAILER_INVOKE_ID_LENGTH;
  if (hasTimeStamp) trailerLength += TRAILER_TIME_STAMP_LENGTH;
  if (hasExtendedControl) trailerLength += TRAILER_EXTENDED_CONTROL_LENGTH;

  // Bildirilen uzunluk girdiden KISAysa fazlalık `trailing` olarak gösterilir;
  // UZUNSA (kesik mesaj) girdinin sonu esas alınır — hata zaten basıldı.
  const declaredEnd =
    messageLength >= FDA_HEADER_LENGTH && messageLength <= data.length
      ? messageLength
      : data.length;
  const bodyStart = FDA_HEADER_LENGTH;
  let trailerStart = declaredEnd - trailerLength;
  if (trailerStart < bodyStart) {
    warnings.push(WARN_TRAILER_TRUNCATED);
    trailerStart = declaredEnd;
    trailerLength = 0;
  }

  if (trailerStart > bodyStart) {
    warnings.push(WARN_BODY_RAW);
    pushField(fields, data, {
      id: `body-${bodyStart}`,
      name: 'Service-Specific Parameters + User Data',
      offset: bodyStart,
      length: trailerStart - bodyStart,
      unit: 'B',
      warnings: [WARN_BODY_RAW],
    });
  }

  let cursor = trailerStart;
  if (hasMessageNumber && cursor + TRAILER_MESSAGE_NUMBER_LENGTH <= data.length) {
    pushField(fields, data, {
      id: `trailer-message-number-${cursor}`,
      name: 'Trailer — Message Number',
      offset: cursor,
      length: TRAILER_MESSAGE_NUMBER_LENGTH,
      rawValue: readUint32Be(data, cursor),
      physicalValue: `${readUint32Be(data, cursor)}`,
    });
    cursor += TRAILER_MESSAGE_NUMBER_LENGTH;
  }
  if (hasInvokeId && cursor + TRAILER_INVOKE_ID_LENGTH <= data.length) {
    pushField(fields, data, {
      id: `trailer-invoke-id-${cursor}`,
      name: 'Trailer — Invoke ID',
      offset: cursor,
      length: TRAILER_INVOKE_ID_LENGTH,
      rawValue: readUint32Be(data, cursor),
      physicalValue: `${readUint32Be(data, cursor)}`,
    });
    cursor += TRAILER_INVOKE_ID_LENGTH;
  }
  if (hasTimeStamp && cursor + TRAILER_TIME_STAMP_LENGTH <= data.length) {
    // 8 bayt; W ham gösterir, saniye/fraksiyon ayrımı ikinci kaynakta yok.
    pushField(fields, data, {
      id: `trailer-time-stamp-${cursor}`,
      name: 'Trailer — Time Stamp',
      offset: cursor,
      length: TRAILER_TIME_STAMP_LENGTH,
      unit: 'B',
      warnings: [WARN_LAYOUT_SINGLE_SOURCE],
    });
    cursor += TRAILER_TIME_STAMP_LENGTH;
  }
  if (hasExtendedControl && cursor + TRAILER_EXTENDED_CONTROL_LENGTH <= data.length) {
    pushField(fields, data, {
      id: `trailer-extended-control-${cursor}`,
      name: 'Trailer — Extended Control Field',
      offset: cursor,
      length: TRAILER_EXTENDED_CONTROL_LENGTH,
      rawValue: readUint32Be(data, cursor),
      physicalValue: formatHex(readUint32Be(data, cursor), 8),
    });
    cursor += TRAILER_EXTENDED_CONTROL_LENGTH;
  }

  if (cursor < data.length) {
    warnings.push(WARN_TRAILING_BYTES);
    pushField(fields, data, {
      id: `trailing-${cursor}`,
      name: 'Trailing Bytes',
      offset: cursor,
      length: data.length - cursor,
      unit: 'B',
      warnings: [WARN_TRAILING_BYTES],
    });
  }

  const metadata: FoundationFieldbusFrameMetadata = {
    protocolName,
    serviceName,
    messageLength,
    summaryKey: SUMMARY_MESSAGE,
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
    warnings: warnings.warnings,
  };

  return { success: true, frame, consumedBytes: data.length };
}

export function parseFoundationFieldbus(data: Uint8Array): ParseResult {
  return parseFoundationFieldbusFrame(data, {});
}

export const foundationFieldbusParser: ProtocolParser = {
  protocolId: PROTOCOL_ID,
  displayName: PROTOCOL_DISPLAY_NAME,

  /**
   * Ucuz ön eleme: asgari başlık boyu + bildirilen mesaj uzunluğunun girdiye
   * uyması. Sihirli bayt yoktur; bundan fazlası uydurma olurdu.
   */
  canParse(data: Uint8Array): boolean {
    if (data.length < FDA_HEADER_LENGTH) return false;
    return readUint32Be(data, 8) === data.length;
  },

  parse(data: Uint8Array, context?: ParseContext): ParseResult {
    const options: FoundationFieldbusParseOptions = {};
    if (context?.timestamp !== undefined) options.timestamp = context.timestamp;
    if (context?.direction !== undefined) options.direction = context.direction;
    if (context?.channel !== undefined) options.channel = context.channel;
    if (context?.maxFrameLength !== undefined) options.maxFrameLength = context.maxFrameLength;
    if (context?.signal !== undefined) options.signal = context.signal;
    return parseFoundationFieldbusFrame(data, options);
  },
};

// ── Örnek çerçeveler ────────────────────────────────────────────────────────
// Mesaj uzunluğu HESAPLANIR, elle yazılmaz: bir gövde büyürse örnek de doğru
// kalır. DEĞERLER SENTETİKtir; YAPI tek kaynaktan (W) alınmıştır ve bu her
// çözümde uyarıyla söylenir.

function uint32Be(value: number): number[] {
  return [(value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff];
}

interface MessageInit {
  readonly version?: number;
  readonly options: number;
  readonly protocolId: number;
  readonly messageType: number;
  readonly confirmed: boolean;
  readonly serviceId: number;
  readonly fdaAddress: number;
  readonly body: readonly number[];
  readonly trailer: readonly number[];
  /** Bildirilen uzunluğu KASTEN bozmak için. */
  readonly lengthOverride?: number;
}

function buildMessage(init: MessageInit): Uint8Array {
  const protocolByte = ((init.protocolId << PROTOCOL_ID_SHIFT) & 0xfc) | (init.messageType & 0x03);
  const serviceByte = (init.confirmed ? 0x80 : 0x00) | (init.serviceId & 0x7f);
  const total = FDA_HEADER_LENGTH + init.body.length + init.trailer.length;
  return Uint8Array.from([
    init.version ?? 1,
    init.options,
    protocolByte,
    serviceByte,
    ...uint32Be(init.fdaAddress),
    ...uint32Be(init.lengthOverride ?? total),
    ...init.body,
    ...init.trailer,
  ]);
}

const EXAMPLE_FRAMES: ExampleFrame[] = [
  {
    id: 'fda-open-session-request',
    name: 'protocol.foundationFieldbus.example.fdaOpenSessionRequest.name',
    bytes: buildMessage({
      options: 0x00,
      protocolId: 0x01,
      messageType: 0x00,
      confirmed: true,
      serviceId: 1,
      fdaAddress: 0x00000001,
      body: [0x00, 0x00, 0x04, 0x41, 0x00, 0x00, 0x04, 0x41],
      trailer: [],
    }),
    description: 'protocol.foundationFieldbus.example.fdaOpenSessionRequest.description',
    expectedValid: true,
  },
  {
    id: 'sm-identify-response',
    name: 'protocol.foundationFieldbus.example.smIdentifyResponse.name',
    bytes: buildMessage({
      options: 0xc0, // Message Number + Invoke ID
      protocolId: 0x02,
      messageType: 0x01,
      confirmed: true,
      serviceId: 3,
      fdaAddress: 0x0000002a,
      body: [0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08],
      trailer: [...uint32Be(7), ...uint32Be(1234)],
    }),
    description: 'protocol.foundationFieldbus.example.smIdentifyResponse.description',
    expectedValid: true,
  },
  {
    id: 'sm-device-annunciation',
    name: 'protocol.foundationFieldbus.example.smDeviceAnnunciation.name',
    bytes: buildMessage({
      options: 0x00,
      protocolId: 0x02,
      messageType: 0x00,
      confirmed: false,
      serviceId: 16,
      fdaAddress: 0x00000000,
      body: [0x46, 0x49, 0x43, 0x2d, 0x31, 0x30, 0x31, 0x00],
      trailer: [],
    }),
    description: 'protocol.foundationFieldbus.example.smDeviceAnnunciation.description',
    expectedValid: true,
  },
  {
    id: 'fms-read-request',
    name: 'protocol.foundationFieldbus.example.fmsReadRequest.name',
    bytes: buildMessage({
      options: 0x40, // yalnız Invoke ID
      protocolId: 0x03,
      messageType: 0x00,
      confirmed: true,
      serviceId: 2,
      fdaAddress: 0x0000010a,
      body: [0x00, 0x00, 0x00, 0x2a],
      trailer: [...uint32Be(99)],
    }),
    description: 'protocol.foundationFieldbus.example.fmsReadRequest.description',
    expectedValid: true,
  },
  {
    id: 'fms-information-report',
    name: 'protocol.foundationFieldbus.example.fmsInformationReport.name',
    bytes: buildMessage({
      options: 0x20, // yalnız Time Stamp
      protocolId: 0x03,
      messageType: 0x00,
      confirmed: false,
      serviceId: 0,
      fdaAddress: 0x0000010b,
      body: [0x42, 0x48, 0x00, 0x00],
      trailer: [0x66, 0x22, 0x11, 0x00, 0x00, 0x00, 0x00, 0x00],
    }),
    description: 'protocol.foundationFieldbus.example.fmsInformationReport.description',
    expectedValid: true,
  },
  {
    id: 'lan-redundancy-diagnostic',
    name: 'protocol.foundationFieldbus.example.lanRedundancyDiagnostic.name',
    bytes: buildMessage({
      options: 0x08, // Extended Control Field
      protocolId: 0x04,
      messageType: 0x00,
      confirmed: false,
      serviceId: 1,
      fdaAddress: 0x00000e2e,
      body: [0x00, 0x01, 0x00, 0x00],
      trailer: [...uint32Be(0x0000abcd)],
    }),
    description: 'protocol.foundationFieldbus.example.lanRedundancyDiagnostic.description',
    expectedValid: true,
  },
  {
    id: 'unnamed-service',
    name: 'protocol.foundationFieldbus.example.unnamedService.name',
    bytes: buildMessage({
      options: 0x00,
      protocolId: 0x03,
      messageType: 0x00,
      confirmed: true,
      serviceId: 0x7e,
      fdaAddress: 0x00000001,
      body: [0xaa, 0xbb, 0xcc, 0xdd],
      trailer: [],
    }),
    description: 'protocol.foundationFieldbus.example.unnamedService.description',
    expectedValid: true,
  },
  {
    id: 'reserved-option-set',
    name: 'protocol.foundationFieldbus.example.reservedOptionSet.name',
    bytes: buildMessage({
      options: 0x10,
      protocolId: 0x02,
      messageType: 0x00,
      confirmed: true,
      serviceId: 3,
      fdaAddress: 0x00000002,
      body: [0x00, 0x00, 0x00, 0x00],
      trailer: [],
    }),
    description: 'protocol.foundationFieldbus.example.reservedOptionSet.description',
    expectedValid: true,
  },
  {
    id: 'message-length-mismatch',
    name: 'protocol.foundationFieldbus.example.messageLengthMismatch.name',
    bytes: buildMessage({
      options: 0x00,
      protocolId: 0x02,
      messageType: 0x00,
      confirmed: true,
      serviceId: 3,
      fdaAddress: 0x00000002,
      body: [0x00, 0x00, 0x00, 0x00],
      trailer: [],
      lengthOverride: 64,
    }),
    description: 'protocol.foundationFieldbus.example.messageLengthMismatch.description',
    expectedValid: false,
  },
  {
    id: 'header-only',
    name: 'protocol.foundationFieldbus.example.headerOnly.name',
    bytes: buildMessage({
      options: 0x00,
      protocolId: 0x01,
      messageType: 0x01,
      confirmed: true,
      serviceId: 3,
      fdaAddress: 0x00000001,
      body: [],
      trailer: [],
    }),
    description: 'protocol.foundationFieldbus.example.headerOnly.description',
    expectedValid: true,
  },
  {
    id: 'frame-too-short',
    name: 'protocol.foundationFieldbus.example.frameTooShort.name',
    bytes: Uint8Array.from([0x01, 0x00, 0x08, 0x83, 0x00, 0x00, 0x00, 0x01]),
    description: 'protocol.foundationFieldbus.example.frameTooShort.description',
    expectedValid: false,
  },
];

export const foundationFieldbusPlugin: ProtocolPlugin = {
  id: PROTOCOL_ID,
  name: PROTOCOL_DISPLAY_NAME,
  category: 'industrial-automation',
  parser: foundationFieldbusParser,
  documentation: {
    summary: 'protocol.foundationFieldbus.documentation.summary',
    layer: 'multi-layer',
    references: [
      {
        title:
          'Wireshark FF-HSE dissector (packet-ff.c) — FF-588-1.3 HSE Field Device Access Agent, section 6, contributed by Yokogawa',
        url: 'https://github.com/wireshark/wireshark/blob/master/epan/dissectors/packet-ff.c',
      },
      {
        title:
          'IANA Service Name and Transport Protocol Port Number Registry — ff-annunc 1089, ff-fms 1090, ff-sm 1091, ff-lr-port 3622 (Fieldbus Foundation)',
        url: 'https://www.iana.org/assignments/service-names-port-numbers/service-names-port-numbers.csv',
      },
      {
        title: 'FieldComm Group — FOUNDATION Fieldbus technology overview (H1 and HSE layers)',
        url: 'https://www.fieldcommgroup.org/technologies/foundation-fieldbus',
      },
    ],
  },
  exampleFrames: EXAMPLE_FRAMES,
};
