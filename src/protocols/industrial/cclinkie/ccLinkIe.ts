/**
 * CC-Link IE (CLPA — CC-Link Partner Association) — Ethernet tabanlı CC-Link
 * ailesi. Girdi TAM BİR ETHERNET ÇERÇEVESİdir: DST MAC + SRC MAC (+ opsiyonel
 * VLAN tag'leri) + EtherType 0x890F + 14 baytlık (TSN'de tipe göre 2/6/10/14)
 * CC-Link IE başlığı + gövde.
 *
 * Faz 10, dalga 13g. `industrial-ethernet` ailesinin BEŞİNCİ ve son kaydı;
 * bu kayıtla aile KAPANIR (13f'de bilerek atlanmıştı).
 *
 * ── GİRDİ MODELİ — AİLE İÇİ TUTARLILIK ──────────────────────────────────────
 * `ethercat.ts` (5d), `profinet.ts` (13e), `powerlink.ts` ve `sercosIii.ts`
 * (13f) TAM Ethernet çerçevesi alır ve `network/ethernet/ethernetFrame.ts`in
 * yardımcılarını PAYLAŞIR. CC-Link IE de AYNI ÇİZGİDE: EtherType 0x890F
 * doğrudan bu çerçeveyi işaret eder. İkinci bir MAC biçimleyici ya da ikinci
 * bir VLAN yürüyüşü YAZILMADI; 0x890F `ETHER_TYPE_NAMES`e de eklendi.
 *
 * ── KAYNAK UYARISI — CLPA SPEC'İ ÜYELİK ARKASINDA ───────────────────────────
 * CLPA'nın tel biçimi spec'leri (BAP-C2010ENG-002/004, CC-Link IE Field/
 * Control protocol) üyelik arkasındadır ve BU DEPODA YOKTUR. Alan yerleşimleri
 * İKİ bağımsız, kamuya açık kaynaktan ÇAPRAZ TEYİTLE alındı (ikisine de bu
 * oturumda gerçekten erişildi; KOD KOPYALANMADI):
 *   L = **CLPA'nın KENDİ yayımladığı Wireshark Lua dissector'ı**
 *       `CCLinkIE_TSN_Rev03.lua` — dosyanın telif satırı birebir
 *       "Copyright(C) CC-Link Partner Association All Rights Reserved".
 *       Protokolü tanımlayan konsorsiyumun kendi alan tanımı; TSN çerçeve
 *       tiplerinin (0xC0-0xC5) başlık boylarını ve `protocolVerType`
 *       nibble'larını verir.
 *       https://github.com/Masamuneee/mitsubishi-wireshark-plugin
 *   N = **NTT Communications'ın Zeek/Spicy ayrıştırıcısı**
 *       `zeek-parser-CCLinkIENoIP` (BSD-2-Clause), `analyzer/cc_link_noip.spicy`
 *       — CC-Link IE Field ve Control çerçeve tiplerinin (0x00-0x8F) tam alan
 *       kırılımı. Bir DISSECTOR değil bir IDS ayrıştırıcısı; bağımsız ekip.
 *       https://github.com/nttcom/zeek-parser-CCLinkIENoIP
 * ÜÇÜNCÜ, BAĞIMSIZ TEYİT: **IEEE EtherType kayıt defteri** 0x890F'i
 * "MITSUBISHI ELECTRIC CORPORATION NAGOYA WORKS — This protocol is especially
 * suitable for industrial networks" olarak listeler.
 * https://standards-oui.ieee.org/ethertype/eth.txt
 * DÖRDÜNCÜ TEYİT (yalnız doğrulama için, depoya girmedi): N'in
 * `testing/Traces/*.pcap` yakalamalarındaki 860 çerçevenin HEPSİ EtherType
 * 0x890F taşıyor ve bayt 14'ten itibaren yukarıdaki yerleşime uyuyor.
 *
 * ── İKİ KAYNAĞIN KESİŞTİĞİ YER: 14 BAYTLIK ORTAK BAŞLIK ─────────────────────
 * L'nin TestData/TestDataAck (0x11/0x12) kırılımı ile N'in aynı tipler için
 * verdiği kırılım BİREBİR aynı ofsetleri veriyor:
 *   +0 frameType · +1 dataType · +2..4 persPriority · +5 nodeType ·
 *   +6..7 srcNodeNumber · +8 protocolVerType · +9 reserved · +10..13 HEC
 * Bu, N'in bütün Field/Control tiplerine uyguladığı iskeletin ta kendisidir
 * (yalnız +2..+5 arası tipe göre değişir). Dolayısıyla başlık boyu (14),
 * `srcNodeNumber` konumu, `protocolVerType` ve HEC İKİ KAYNAKTA TEYİTLİDİR.
 *
 * ── +2..+5 ARASI: TEK KAYNAKLI OLANLAR ADLANDIRILIR AMA UYARI TAŞIR ────────
 * Ortadaki dört baytın tipe göre kırılımını (nodeId / persPriority /
 * connectionInfo / syncFlag / nodeType / scanNumber) yalnız N veriyor;
 * L bu tipleri kapsamıyor. `sercosIii.ts`in `WARN_CYCLE_COUNT_SINGLE_SOURCE`
 * emsali izlendi: alan ADLANDIRILIR ve ÇÖZÜLÜR, ama tek kaynaklı olduğu
 * `WARN_MIDDLE_FIELDS_SINGLE_SOURCE` ile SÖYLENİR. TestData/TestDataAck'te
 * uyarı basılmaz — orada iki kaynak var.
 *
 * ── HEC GÖSTERİLİR, DOĞRULANMAZ — GEREKÇE ──────────────────────────────────
 * 4 baytlık HEC (Header Error Check) alanının ALGORİTMASI hiçbir kamuya açık
 * kaynakta yok: L alanı yalnız GÖSTERİR, N ham 4 bayt olarak okur, hesaplayan
 * yok. Bu motor da alanı adlandırıp basar ama **MISMATCH ASLA BASMAZ** —
 * `sercosIii.ts`in CRC32 ve `ethercat.ts`in Working Counter kararının aynısı.
 * Yanlış parametreyle hesaplanmış bir "HEC hatalı" rozeti, hiç doğrulamamaktan
 * çok daha kötüdür.
 *
 * ── GÖVDE HAM BIRAKILIR — SAHTE ALAN KIRILIMI YOK ──────────────────────────
 * Cyclic çerçevelerin (RX/RY/RWr/RWw, cyclicM/S) gövdesi bir bayt dizisidir;
 * hangi baytın hangi istasyonun hangi link cihazına düştüğü ÇERÇEVEDE YAZMAZ,
 * ağ parametresinden (CSP+ / GX Works ağ ayarı) gelir. Bu, bir kapsam kısıtı
 * değil protokolün doğasıdır ve HER İKİ REFERANS AYRIŞTIRICI DA AYNI YERDE
 * DURUR (N: `except_Header: bytes &eod`; L: cyclic gövdeyi tek blok basar).
 * Bu motor da bölgeyi TEK PARÇA ham basar ve nedenini
 * `WARN_CYCLIC_LAYOUT_FROM_NETWORK_PARAMETERS` ile söyler (`profinet.ts`in
 * GSDML'siz I/O verisi ve `sercosIii.ts`in CP3/CP4 gövdesi emsali).
 *
 * ── STATUS: 'partial' — GEREKÇE (iec-61850 GOOSE-only emsali) ──────────────
 * Kaydın vaadi DÖRT ağ tipidir (Controller / Field / Field Basic / TSN).
 * Bu motor bunlardan ÜÇÜNÜ (Controller, Field, TSN) çözer — hepsi 0x890F
 * altında aynı telde gelir ve `protocolType` nibble'ı hangisi olduğunu söyler.
 * **CC-Link IE Field Basic (CCIEFB) BİLİNÇLİ OLARAK KAPSAM DIŞIDIR** ve
 * sebebi teknik: CCIEFB 0x890F ALTINDA GELMEZ — standart IPv4/UDP üstünde
 * SLMP'dir (master 61450, cihaz 61451). Yani bu motorun girdi sözleşmesiyle
 * (tam Ethernet çerçevesi + 0x890F) hiç kesişmez, ayrı bir taşıyıcı yığını
 * ister. Ayrıca cyclic gövde kırılımı ağ parametresine bağlı olduğu için ham
 * kalır. Rozet bu yüzden `ready` değil `partial`, ve katalog özeti neyin
 * çözülüp neyin çözülmediğini AÇIKÇA yazar.
 *
 * ── decodeOptions: AÇILMADI, GEREKÇESİ ──────────────────────────────────────
 *  1. "Hangi ağ tipi" → ÇERÇEVEDE YAZAR (`protocolVerType`in alt nibble'ı ve
 *     çerçeve tipi kümesi). Kanal gereksiz olurdu (12f'nin WebSocket MASK-biti
 *     dersi).
 *  2. "Cyclic gövde haritası" → bir `select`/`number` alanına SIĞMAZ; istasyon
 *     başına RX/RY/RWr/RWw nokta sayısı + istasyon sırası + işgal edilen
 *     istasyon sayısını içeren tam bir ağ parametresi ister. Yarım bir kanal
 *     yanlış kırılıma davet olurdu (`profinet.ts`in IOPS/IOCS gerekçesi).
 *
 * ── KAPSAM DIŞI (dosya başında AÇIKÇA) ──────────────────────────────────────
 *  • **CC-Link IE Field Basic (CCIEFB)**: yukarıdaki gerekçe. Zarfı bu
 *    dosyada yine de tanınıyor: TSN acyclicData (0xC3) gövdesindeki SLMP 3E
 *    zarfı çözülüyor ve CCIEFB de AYNI zarfı kullanıyor.
 *  • **Klasik CC-Link** (RS-485): ayrı kayıt, ayrı tel biçimi.
 *  • **CC-Link IE Safety**: IE Control/Field/TSN üstünde ayrı bir güvenlik
 *    katmanı; kendi spec'i var, bu motorun kapsamında değil.
 *  • **SLMP komut/cevap gövdesi**: zarf (subheader → subcommand) çözülür,
 *    komuta özel istek/cevap verisi HAM bırakılır — komut kataloğu ayrı iş.
 *  • **Çok çerçeveli analiz**: link scan timing, token dolaşımı, istasyon
 *    tablosu, transient oturumunun yeniden birleştirilmesi — `ethercat.ts`in
 *    "analyzer sınırı" emsali.
 */

import {
  MAC_LENGTH,
  MIN_HEADER_LENGTH,
  TYPE_LENGTH_FIELD_LENGTH,
  VLAN_TPID,
  classifyDestinationMac,
  formatMac,
  walkTypeLengthChain,
} from '@/protocols/network/ethernet/ethernetFrame';
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
const PROTOCOL_ID = 'cc-link-ie';
/** Protokol adı veridir, çeviriye girmez (CLAUDE.md). */
const PROTOCOL_DISPLAY_NAME = 'CC-Link IE';

/** IEEE kayıt defteri: Mitsubishi Electric Nagoya Works. N'in yakalamalarında da bu. */
const CC_LINK_IE_ETHER_TYPE = 0x890f;

/** Field/Control ortak başlığı: L ve N'de BİREBİR 14 bayt. */
const FIELD_HEADER_LENGTH = 14;
/** TSN cyclicM/cyclicS başlığı (L `CCIETSN_HEADER_SZ`). */
const TSN_CYCLIC_HEADER_LENGTH = 10;
/** TSN acyclicPriority başlığı (L `CCIETSN_HEADER_PRIO_SZ`). */
const TSN_PRIORITY_HEADER_LENGTH = 14;
/** TSN acyclicDetection/Ack başlığı (L `CCIETSN_HEADER_DETECT_SZ`). */
const TSN_DETECTION_HEADER_LENGTH = 2;
/** TSN acyclicData başlığı (L `CCIETSN_HEADER_DATA_SZ`). */
const TSN_DATA_HEADER_LENGTH = 6;

const HEC_LENGTH = 4;
const HEX_RADIX = 16;
/** VLAN'lı varyantta tip alanı bir tag kadar ilerideki ofsettedir. */
const VLAN_TAG_LENGTH = 4;

/** SLMP 3E istek zarfı (Mitsubishi SH(NA)-080956ENG §4.1) — 15 bayt. */
const SLMP_REQUEST_HEADER_LENGTH = 15;
/** SLMP 3E cevap zarfı (aynı belge §4.2) — 11 bayt. */
const SLMP_RESPONSE_HEADER_LENGTH = 11;
const SLMP_REQUEST_SUBHEADER = 0x5000;
const SLMP_RESPONSE_SUBHEADER = 0xd000;

/** `protocolVerType` baytının nibble'ları (L `pro_Version` / `pro_Type`). */
const PROTOCOL_VERSION_MASK = 0xf0;
const PROTOCOL_VERSION_SHIFT = 4;
const PROTOCOL_TYPE_MASK = 0x0f;

/** TSN cyclicNo baytı (L): bit 7 kontrol bayrağı, bit 0-6 döngü numarası. */
const TSN_CYCLIC_NO_MASK = 0x7f;
const TSN_CYCLIC_NO_CHECK_FLAG_MASK = 0x80;

export const ERROR_FRAME_TOO_SHORT = 'protocol.ccLinkIe.error.frameTooShort';
export const ERROR_FRAME_TOO_LONG = 'protocol.ccLinkIe.error.frameTooLong';
export const ERROR_ABORTED = 'protocol.ccLinkIe.error.aborted';
export const ERROR_ETHER_TYPE_NOT_CC_LINK_IE = 'protocol.ccLinkIe.error.etherTypeNotCcLinkIe';
export const ERROR_HEADER_TRUNCATED = 'protocol.ccLinkIe.error.headerTruncated';

export const WARN_HEC_NOT_VERIFIED = 'protocol.ccLinkIe.warning.hecNotVerified';
export const WARN_MIDDLE_FIELDS_SINGLE_SOURCE = 'protocol.ccLinkIe.warning.middleFieldsSingleSource';
export const WARN_FRAME_TYPE_NOT_NAMED = 'protocol.ccLinkIe.warning.frameTypeNotNamed';
export const WARN_CYCLIC_LAYOUT_FROM_NETWORK_PARAMETERS =
  'protocol.ccLinkIe.warning.cyclicLayoutFromNetworkParameters';
export const WARN_TRANSIENT_PAYLOAD_RAW = 'protocol.ccLinkIe.warning.transientPayloadRaw';
export const WARN_PROTOCOL_TYPE_RESERVED = 'protocol.ccLinkIe.warning.protocolTypeReserved';
export const WARN_FIELD_BASIC_NOT_ON_THIS_WIRE =
  'protocol.ccLinkIe.warning.fieldBasicNotOnThisWire';
export const WARN_SLMP_ENVELOPE_ONLY = 'protocol.ccLinkIe.warning.slmpEnvelopeOnly';
export const WARN_SLMP_SUBHEADER_UNKNOWN = 'protocol.ccLinkIe.warning.slmpSubheaderUnknown';
export const WARN_TSN_DETECTION_BODY_RAW = 'protocol.ccLinkIe.warning.tsnDetectionBodyRaw';
export const WARN_PADDING_NOT_ZERO = 'protocol.ccLinkIe.warning.paddingNotZero';

const SUMMARY_FRAME = 'protocol.ccLinkIe.summary.frame';
const SUMMARY_NOT_CC_LINK_IE = 'protocol.ccLinkIe.summary.notCcLinkIe';

/**
 * Ortadaki dört baytın (rel 2..5) kırılım biçimi. Tümü N'den; TestData ve
 * TestDataAck'te L de aynısını veriyor (`bothSources`).
 */
type MiddleLayout =
  | 'node-id-reserved'
  | 'node-id-sync-node-type'
  | 'node-id-connection-info'
  | 'priority-node-type'
  | 'reserved'
  | 'scan-number';

/** Çerçeve tipinin ait olduğu gövde/başlık ailesi. */
type FrameFamily = 'field' | 'control' | 'tsn';

interface FrameTypeDescriptor {
  readonly name: string;
  readonly family: FrameFamily;
  readonly middle: MiddleLayout;
  /** Gövde döngüsel mi (link cihazı verisi) yoksa transient mı? */
  readonly body: 'cyclic' | 'transient' | 'control';
  /** L ve N ikisi birden bu tipin kırılımını veriyorsa `true`. */
  readonly bothSources: boolean;
}

/**
 * N'in `RrFType` sıralaması + L'nin `L_arNFType` tablosu. `field` ailesi
 * CC-Link IE Field, `control` ailesi CC-Link IE Control çerçeveleridir;
 * `tsn` ailesi ayrı başlık boylarına sahiptir ve aşağıda ayrı ele alınır.
 */
const FRAME_TYPES: ReadonlyMap<number, FrameTypeDescriptor> = new Map([
  // ── CC-Link IE Control — iletim kontrol çerçeveleri ──
  [0x00, cf('Connect')],
  [0x01, cf('ConnectAck')],
  [0x02, cf('Scan')],
  [0x03, cf('Collect')],
  [0x04, cf('Select')],
  [0x05, cf('Launch')],
  [0x06, cf('Token')],
  [0x24, cf('Dummy')],
  [0x2f, cf('NTNTest')],
  // ── CC-Link IE Control — döngüsel iletim çerçeveleri ──
  [0x80, cf('CyclicDataW', 'cyclic')],
  [0x81, cf('CyclicDataB', 'cyclic')],
  [0x8c, cf('CyclicDataOut1', 'cyclic')],
  [0x8d, cf('CyclicDataOut2', 'cyclic')],
  [0x8e, cf('CyclicDataIn1', 'cyclic')],
  [0x8f, cf('CyclicDataIn2', 'cyclic')],
  // ── CC-Link IE Field — iletim kontrol çerçeveleri ──
  [0x15, ff('TokenM', 'node-id-reserved', 'control')],
  [0x10, ff('Persuasion', 'priority-node-type', 'control')],
  // TestData/TestDataAck: L'nin de kırılımını verdiği İKİ tip.
  [0x11, ff('TestData', 'priority-node-type', 'control', true)],
  [0x12, ff('TestDataAck', 'priority-node-type', 'control', true)],
  [0x13, ff('Setup', 'node-id-reserved', 'control')],
  [0x14, ff('SetupAck', 'reserved', 'control')],
  [0x20, ff('MyStatus', 'node-id-sync-node-type', 'control')],
  [0x1c, ff('Timer', 'reserved', 'control')],
  // ── CC-Link IE Field — senkronizasyon çerçeveleri ──
  [0x40, ff('Measure', 'node-id-reserved', 'control')],
  [0x41, ff('MeasureAck', 'node-id-reserved', 'control')],
  [0x42, ff('Offset', 'node-id-reserved', 'control')],
  [0x43, ff('Update', 'node-id-reserved', 'control')],
  // ── CC-Link IE Field — döngüsel iletim çerçeveleri ──
  [0x82, ff('CyclicDataRWw', 'node-id-reserved', 'cyclic')],
  [0x83, ff('CyclicDataRY', 'node-id-reserved', 'cyclic')],
  [0x84, ff('CyclicDataRWr', 'node-id-reserved', 'cyclic')],
  [0x85, ff('CyclicDataRX', 'node-id-reserved', 'cyclic')],
  // ── CC-Link IE Field — transient iletim çerçeveleri ──
  [0x22, ff('Transient1', 'node-id-connection-info', 'transient')],
  [0x23, ff('TransientAck', 'node-id-connection-info', 'transient')],
  [0x25, ff('Transient2', 'node-id-connection-info', 'transient')],
  [0x28, ff('ParamCheck', 'node-id-connection-info', 'transient')],
  [0x29, ff('Parameter', 'node-id-connection-info', 'transient')],
  [0x26, ff('IpTransient', 'node-id-connection-info', 'transient')],
]);

function ff(
  name: string,
  middle: MiddleLayout,
  body: 'cyclic' | 'transient' | 'control',
  bothSources = false,
): FrameTypeDescriptor {
  return { name, family: 'field', middle, body, bothSources };
}

function cf(name: string, body: 'cyclic' | 'control' = 'control'): FrameTypeDescriptor {
  return { name, family: 'control', middle: 'scan-number', body, bothSources: false };
}

/** TSN çerçeve tipleri (L `L_arNFType`) — başlık boyları tipe göre değişir. */
interface TsnDescriptor {
  readonly name: string;
  readonly headerLength: number;
}

const TSN_FRAME_TYPES: ReadonlyMap<number, TsnDescriptor> = new Map([
  [0xc0, { name: 'Priority', headerLength: TSN_PRIORITY_HEADER_LENGTH }],
  [0xc1, { name: 'Detection', headerLength: TSN_DETECTION_HEADER_LENGTH }],
  [0xc2, { name: 'DetectionAck', headerLength: TSN_DETECTION_HEADER_LENGTH }],
  [0xc3, { name: 'AcyclicData', headerLength: TSN_DATA_HEADER_LENGTH }],
  [0xc4, { name: 'Cyclic M / Ms', headerLength: TSN_CYCLIC_HEADER_LENGTH }],
  [0xc5, { name: 'Cyclic S / Ss', headerLength: TSN_CYCLIC_HEADER_LENGTH }],
]);

/** L `L_pro_Version` — `protocolVerType`in ÜST nibble'ı. */
const PROTOCOL_VERSION_NAMES: ReadonlyMap<number, string> = new Map([
  [0x00, 'CC-Link IE Field & Control, single master'],
  [0x01, 'CC-Link IE Field & Control, multi master'],
  [0x02, 'CC-Link IE TSN'],
  [0x03, 'CC-Link IE TSN & Field, single master'],
]);

/** L `L_pro_Type` — `protocolVerType`in ALT nibble'ı; ağ tipini SÖYLEYEN alan. */
const PROTOCOL_TYPE_NAMES: ReadonlyMap<number, string> = new Map([
  [0x00, 'CC-Link IE Control'],
  [0x01, 'CC-Link IE Field'],
  [0x03, 'CC-Link IE TSN'],
]);

function byteAt(data: Uint8Array, offset: number): number {
  return data[offset] ?? 0;
}

/** CC-Link IE başlığı BIG-ENDIAN okunur (N `uint16`, L `ProtoField.uint16`). */
function readUint16Be(data: Uint8Array, offset: number): number {
  return (byteAt(data, offset) << 8) | byteAt(data, offset + 1);
}

function readUint24Be(data: Uint8Array, offset: number): number {
  return (byteAt(data, offset) << 16) | (byteAt(data, offset + 1) << 8) | byteAt(data, offset + 2);
}

function readUint32Be(data: Uint8Array, offset: number): number {
  return (
    ((byteAt(data, offset) << 24) |
      (byteAt(data, offset + 1) << 16) |
      (byteAt(data, offset + 2) << 8) |
      byteAt(data, offset + 3)) >>>
    0
  );
}

/** SLMP zarfı LITTLE-ENDIAN'dır (SH-080956ENG: "binary code, lower byte first"). */
function readUint16Le(data: Uint8Array, offset: number): number {
  return byteAt(data, offset) | (byteAt(data, offset + 1) << 8);
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
  readonly buffer: string[] = [];

  push(key: string): void {
    if (this.seen.has(key)) return;
    this.seen.add(key);
    this.warnings.push(toProtocolWarning(key));
  }

  drain(): void {
    for (const key of this.buffer) this.push(key);
    this.buffer.length = 0;
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

export type CcLinkIeFrameMetadata = {
  /** EtherType yanlışsa `undefined`. */
  frameType: number | undefined;
  frameTypeName: string | undefined;
  networkKind: FrameFamily | undefined;
  summaryKey: string;
  summaryParams: Record<string, string>;
};

interface CcLinkIeParseOptions {
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

function pushRawBlock(
  fields: ParsedField[],
  data: Uint8Array,
  init: {
    readonly id: string;
    readonly name: string;
    readonly offset: number;
    readonly length: number;
    readonly warnings?: readonly string[];
  },
): void {
  if (init.length <= 0) return;
  pushField(fields, data, {
    id: init.id,
    name: init.name,
    offset: init.offset,
    length: init.length,
    unit: 'B',
    ...(init.warnings === undefined ? {} : { warnings: init.warnings }),
  });
}

/**
 * Bildirilen bölgeden sonra kalan baytlar Ethernet dolgusudur; sıfırdan
 * farklıysa uyarı (`sercosIii.ts`/`profinet.ts` emsali).
 */
function appendPadding(
  data: Uint8Array,
  offset: number,
  fields: ParsedField[],
  warnings: WarningSink,
): void {
  if (offset >= data.length) return;
  const padding = data.slice(offset);
  const paddingField: ParsedField = {
    id: 'padding',
    name: 'Padding',
    offset,
    length: padding.length,
    rawBytes: padding,
    unit: 'B',
    valid: true,
    warnings: [],
  };
  if (padding.some((byte) => byte !== 0)) {
    paddingField.warnings.push(WARN_PADDING_NOT_ZERO);
    warnings.push(WARN_PADDING_NOT_ZERO);
  }
  fields.push(paddingField);
}

/**
 * `protocolVerType` baytı: ağ tipini SÖYLEYEN alan. Spec özeti "analyzer önce
 * network type belirlemeli (wire behavior farklı)" diyor — bu iki nibble o
 * sorunun çerçevedeki cevabıdır, `decodeOptions` kanalı bu yüzden açılmadı.
 */
function decodeProtocolVerType(
  data: Uint8Array,
  offset: number,
  fields: ParsedField[],
  warnings: WarningSink,
): void {
  const value = byteAt(data, offset);
  const version = (value & PROTOCOL_VERSION_MASK) >>> PROTOCOL_VERSION_SHIFT;
  const kind = value & PROTOCOL_TYPE_MASK;
  const versionName = PROTOCOL_VERSION_NAMES.get(version);
  const kindName = PROTOCOL_TYPE_NAMES.get(kind);

  pushField(fields, data, {
    id: `protocol-version-${offset}`,
    name: 'protocolVer (bits 4-7)',
    offset,
    length: 1,
    rawValue: version,
    physicalValue: versionName ?? formatHex(version, 1),
  });

  const kindWarnings = kindName === undefined ? [WARN_PROTOCOL_TYPE_RESERVED] : [];
  if (kindName === undefined) warnings.push(WARN_PROTOCOL_TYPE_RESERVED);
  pushField(fields, data, {
    id: `protocol-type-${offset}`,
    name: 'protocolType (bits 0-3)',
    offset,
    length: 1,
    rawValue: kind,
    physicalValue: kindName ?? formatHex(kind, 1),
    warnings: kindWarnings,
  });
}

/** HEC: adlandırılır, basılır, ASLA doğrulanmaz (dosya başı). */
function pushHec(
  data: Uint8Array,
  offset: number,
  fields: ParsedField[],
  warnings: WarningSink,
): void {
  warnings.push(WARN_HEC_NOT_VERIFIED);
  pushField(fields, data, {
    id: `hec-${offset}`,
    name: 'HEC (Header Error Check)',
    offset,
    length: HEC_LENGTH,
    rawValue: readUint32Be(data, offset),
    physicalValue: formatHex(readUint32Be(data, offset), 8),
    warnings: [WARN_HEC_NOT_VERIFIED],
  });
}

/**
 * Field/Control ailesinin 14 baytlık ortak başlığı. +0/+1/+6..+13 iki kaynakta
 * teyitli; +2..+5 arası tipe göre değişir ve TestData/TestDataAck dışında tek
 * kaynaklıdır (uyarı taşır).
 */
function decodeFieldControlHeader(
  data: Uint8Array,
  start: number,
  descriptor: FrameTypeDescriptor,
  fields: ParsedField[],
  warnings: WarningSink,
): void {
  const singleSource = descriptor.bothSources ? [] : [WARN_MIDDLE_FIELDS_SINGLE_SOURCE];
  if (!descriptor.bothSources) warnings.push(WARN_MIDDLE_FIELDS_SINGLE_SOURCE);

  const secondByteName = descriptor.family === 'control' ? 'priority' : 'dataType';
  pushField(fields, data, {
    id: `data-type-${start + 1}`,
    name: secondByteName,
    offset: start + 1,
    length: 1,
    rawValue: byteAt(data, start + 1),
    physicalValue: formatHex(byteAt(data, start + 1), 2),
    warnings: singleSource,
  });

  switch (descriptor.middle) {
    case 'node-id-reserved': {
      pushField(fields, data, {
        id: `node-id-${start + 2}`,
        name: 'nodeId',
        offset: start + 2,
        length: 2,
        rawValue: readUint16Be(data, start + 2),
        physicalValue: formatHex(readUint16Be(data, start + 2), 4),
        warnings: singleSource,
      });
      pushRawBlock(fields, data, {
        id: `reserved-${start + 4}`,
        name: 'Reserved',
        offset: start + 4,
        length: 2,
        warnings: singleSource,
      });
      break;
    }
    case 'node-id-sync-node-type': {
      pushField(fields, data, {
        id: `node-id-${start + 2}`,
        name: 'nodeId',
        offset: start + 2,
        length: 2,
        rawValue: readUint16Be(data, start + 2),
        physicalValue: formatHex(readUint16Be(data, start + 2), 4),
        warnings: singleSource,
      });
      pushField(fields, data, {
        id: `sync-flag-${start + 4}`,
        name: 'syncFlag',
        offset: start + 4,
        length: 1,
        rawValue: byteAt(data, start + 4),
        physicalValue: formatHex(byteAt(data, start + 4), 2),
        warnings: singleSource,
      });
      pushField(fields, data, {
        id: `node-type-${start + 5}`,
        name: 'nodeType',
        offset: start + 5,
        length: 1,
        rawValue: byteAt(data, start + 5),
        physicalValue: formatHex(byteAt(data, start + 5), 2),
        warnings: singleSource,
      });
      break;
    }
    case 'node-id-connection-info': {
      pushField(fields, data, {
        id: `node-id-${start + 2}`,
        name: 'nodeId',
        offset: start + 2,
        length: 2,
        rawValue: readUint16Be(data, start + 2),
        physicalValue: formatHex(readUint16Be(data, start + 2), 4),
        warnings: singleSource,
      });
      pushField(fields, data, {
        id: `connection-info-${start + 4}`,
        name: 'connectionInfo',
        offset: start + 4,
        length: 1,
        rawValue: byteAt(data, start + 4),
        physicalValue: formatHex(byteAt(data, start + 4), 2),
        warnings: singleSource,
      });
      pushRawBlock(fields, data, {
        id: `reserved-${start + 5}`,
        name: 'Reserved',
        offset: start + 5,
        length: 1,
        warnings: singleSource,
      });
      break;
    }
    case 'priority-node-type': {
      // TestData/TestDataAck'te L de aynı kırılımı veriyor → uyarı yok.
      pushField(fields, data, {
        id: `pers-priority-${start + 2}`,
        name: 'persPriority',
        offset: start + 2,
        length: 3,
        rawValue: readUint24Be(data, start + 2),
        physicalValue: formatHex(readUint24Be(data, start + 2), 6),
        warnings: singleSource,
      });
      pushField(fields, data, {
        id: `node-type-${start + 5}`,
        name: 'nodeType',
        offset: start + 5,
        length: 1,
        rawValue: byteAt(data, start + 5),
        physicalValue: formatHex(byteAt(data, start + 5), 2),
        warnings: singleSource,
      });
      break;
    }
    case 'scan-number': {
      pushField(fields, data, {
        id: `scan-number-${start + 2}`,
        name: 'scanNumber',
        offset: start + 2,
        length: 3,
        rawValue: readUint24Be(data, start + 2),
        physicalValue: formatHex(readUint24Be(data, start + 2), 6),
        warnings: singleSource,
      });
      pushRawBlock(fields, data, {
        id: `reserved-${start + 5}`,
        name: 'Reserved',
        offset: start + 5,
        length: 1,
        warnings: singleSource,
      });
      break;
    }
    case 'reserved': {
      pushRawBlock(fields, data, {
        id: `reserved-${start + 2}`,
        name: 'Reserved',
        offset: start + 2,
        length: 4,
        warnings: singleSource,
      });
      break;
    }
  }

  pushField(fields, data, {
    id: `src-node-number-${start + 6}`,
    name: 'srcNodeNumber',
    offset: start + 6,
    length: 2,
    rawValue: readUint16Be(data, start + 6),
    physicalValue: formatHex(readUint16Be(data, start + 6), 4),
  });

  if (descriptor.family === 'field') {
    pushField(fields, data, {
      id: `protocol-ver-type-${start + 8}`,
      name: 'protocolVerType',
      offset: start + 8,
      length: 1,
      rawValue: byteAt(data, start + 8),
      physicalValue: formatHex(byteAt(data, start + 8), 2),
    });
    decodeProtocolVerType(data, start + 8, fields, warnings);
    pushRawBlock(fields, data, {
      id: `reserved-${start + 9}`,
      name: 'Reserved',
      offset: start + 9,
      length: 1,
    });
  } else {
    // Control çerçevesinde bu iki bayt `protocolVerType` DEĞİL, ayrılmıştır (N).
    pushRawBlock(fields, data, {
      id: `reserved-${start + 8}`,
      name: 'Reserved',
      offset: start + 8,
      length: 2,
      warnings: singleSource,
    });
  }

  pushHec(data, start + 10, fields, warnings);
}

/**
 * SLMP 3E zarfı (Mitsubishi SH(NA)-080956ENG §4.1/§4.2 + CLPA'nın SLMP Lua
 * dissector'ı + rt-labs `c-link`in `cl_cciefb_req_header_t` yapısı — ÜÇ
 * bağımsız kaynak, üçü de aynı 15/11 baytlık zarfı veriyor). Yalnız ZARF
 * çözülür; komuta özel istek/cevap verisi HAM kalır.
 */
function decodeSlmpEnvelope(
  data: Uint8Array,
  start: number,
  fields: ParsedField[],
  warnings: WarningSink,
): number {
  const subheader = readUint16Be(data, start);
  const isRequest = subheader === SLMP_REQUEST_SUBHEADER;
  const isResponse = subheader === SLMP_RESPONSE_SUBHEADER;

  if (!isRequest && !isResponse) {
    warnings.push(WARN_SLMP_SUBHEADER_UNKNOWN);
    pushRawBlock(fields, data, {
      id: `slmp-payload-${start}`,
      name: 'Transient Payload',
      offset: start,
      length: data.length - start,
      warnings: [WARN_SLMP_SUBHEADER_UNKNOWN],
    });
    return data.length;
  }

  const needed = isRequest ? SLMP_REQUEST_HEADER_LENGTH : SLMP_RESPONSE_HEADER_LENGTH;
  if (data.length - start < needed) {
    pushRawBlock(fields, data, {
      id: `slmp-payload-${start}`,
      name: 'Transient Payload',
      offset: start,
      length: data.length - start,
      warnings: [WARN_SLMP_SUBHEADER_UNKNOWN],
    });
    warnings.push(WARN_SLMP_SUBHEADER_UNKNOWN);
    return data.length;
  }

  warnings.push(WARN_SLMP_ENVELOPE_ONLY);

  pushField(fields, data, {
    id: `slmp-subheader-${start}`,
    name: 'SLMP Subheader',
    offset: start,
    length: 2,
    rawValue: subheader,
    physicalValue: isRequest ? 'Request (3E frame)' : 'Response (3E frame)',
  });
  pushField(fields, data, {
    id: `slmp-network-number-${start + 2}`,
    name: 'Request Destination Network No.',
    offset: start + 2,
    length: 1,
    rawValue: byteAt(data, start + 2),
    physicalValue: byteAt(data, start + 2) === 0 ? 'Own network' : formatHex(byteAt(data, start + 2), 2),
  });
  pushField(fields, data, {
    id: `slmp-station-number-${start + 3}`,
    name: 'Request Destination Station No.',
    offset: start + 3,
    length: 1,
    rawValue: byteAt(data, start + 3),
    physicalValue:
      byteAt(data, start + 3) === 0xff ? 'Own station' : formatHex(byteAt(data, start + 3), 2),
  });
  pushField(fields, data, {
    id: `slmp-module-io-${start + 4}`,
    name: 'Request Destination Module I/O No.',
    offset: start + 4,
    length: 2,
    rawValue: readUint16Le(data, start + 4),
    physicalValue: formatHex(readUint16Le(data, start + 4), 4),
  });
  pushField(fields, data, {
    id: `slmp-multidrop-${start + 6}`,
    name: 'Request Destination Multidrop Station No.',
    offset: start + 6,
    length: 1,
    rawValue: byteAt(data, start + 6),
    physicalValue: formatHex(byteAt(data, start + 6), 2),
  });
  const dataLength = readUint16Le(data, start + 7);
  pushField(fields, data, {
    id: `slmp-data-length-${start + 7}`,
    name: isRequest ? 'Request Data Length' : 'Response Data Length',
    offset: start + 7,
    length: 2,
    rawValue: dataLength,
    physicalValue: `${dataLength}`,
    unit: 'B',
  });

  let cursor = start + 9;
  if (isRequest) {
    const timer = readUint16Le(data, cursor);
    pushField(fields, data, {
      id: `slmp-monitoring-timer-${cursor}`,
      name: 'Monitoring Timer',
      offset: cursor,
      length: 2,
      rawValue: timer,
      // Birim 250 ms'lik adımdır (SH-080956ENG); 0 = sonsuz bekleme.
      physicalValue: timer === 0 ? 'Wait forever' : `${timer * 250} ms`,
    });
    cursor += 2;
    pushField(fields, data, {
      id: `slmp-command-${cursor}`,
      name: 'Command',
      offset: cursor,
      length: 2,
      rawValue: readUint16Le(data, cursor),
      physicalValue: formatHex(readUint16Le(data, cursor), 4),
    });
    cursor += 2;
    pushField(fields, data, {
      id: `slmp-subcommand-${cursor}`,
      name: 'Subcommand',
      offset: cursor,
      length: 2,
      rawValue: readUint16Le(data, cursor),
      physicalValue: formatHex(readUint16Le(data, cursor), 4),
    });
    cursor += 2;
  } else {
    const endCode = readUint16Le(data, cursor);
    pushField(fields, data, {
      id: `slmp-end-code-${cursor}`,
      name: 'End Code',
      offset: cursor,
      length: 2,
      rawValue: endCode,
      physicalValue: endCode === 0 ? 'Normal completion' : formatHex(endCode, 4),
      valid: endCode === 0,
    });
    cursor += 2;
  }

  // Uzunluk alanı zarfın İÇİNDEKİ veriyi sınırlar (istekte izleme zamanlayıcısı
  // + komut + alt komut da sayılır, cevapta end code sayılır) — bu yüzden
  // çerçeve sonuna kadar yutmuyoruz: kalanı Ethernet dolgusudur.
  const consumedByEnvelope = isRequest ? 6 : 2;
  const declaredDataBytes = Math.max(0, dataLength - consumedByEnvelope);
  const availableDataBytes = Math.max(0, data.length - cursor);
  const dataBytes = Math.min(declaredDataBytes, availableDataBytes);
  pushRawBlock(fields, data, {
    id: `slmp-data-${cursor}`,
    name: isRequest ? 'Request Data' : 'Response Data',
    offset: cursor,
    length: dataBytes,
    warnings: [WARN_SLMP_ENVELOPE_ONLY],
  });
  return cursor + dataBytes;
}

/** TSN çerçeveleri: başlık boyu tipe göre değişir (L). */
function decodeTsnFrame(
  data: Uint8Array,
  start: number,
  frameType: number,
  descriptor: TsnDescriptor,
  fields: ParsedField[],
  warnings: WarningSink,
): number {
  if (frameType === 0xc4 || frameType === 0xc5) {
    const cyclicByte = byteAt(data, start + 1);
    pushField(fields, data, {
      id: `tsn-cyclic-no-${start + 1}`,
      name: 'cyclicNo (bits 0-6)',
      offset: start + 1,
      length: 1,
      rawValue: cyclicByte & TSN_CYCLIC_NO_MASK,
      physicalValue: `${cyclicByte & TSN_CYCLIC_NO_MASK}`,
    });
    const checkDisabled = (cyclicByte & TSN_CYCLIC_NO_CHECK_FLAG_MASK) !== 0;
    pushField(fields, data, {
      id: `tsn-cyclic-no-check-flag-${start + 1}`,
      name: 'cyclicNoCheckFlag (bit 7)',
      offset: start + 1,
      length: 1,
      rawValue: checkDisabled ? 1 : 0,
      physicalValue: checkDisabled ? 'disable' : 'enable',
    });
    // 0xC4 master→slave (sa), 0xC5 slave→master (da) — L'nin ayrımı.
    pushField(fields, data, {
      id: frameType === 0xc4 ? `tsn-sa-${start + 2}` : `tsn-da-${start + 2}`,
      name: frameType === 0xc4 ? 'sa (source station)' : 'da (destination station)',
      offset: start + 2,
      length: 2,
      rawValue: readUint16Be(data, start + 2),
      physicalValue: formatHex(readUint16Be(data, start + 2), 4),
    });
    pushRawBlock(fields, data, {
      id: `reserved-${start + 4}`,
      name: 'Reserved',
      offset: start + 4,
      length: 2,
    });
    pushHec(data, start + 6, fields, warnings);
  } else if (frameType === 0xc0) {
    pushRawBlock(fields, data, {
      id: `reserved-${start + 1}`,
      name: 'Reserved',
      offset: start + 1,
      length: 9,
    });
    pushHec(data, start + 10, fields, warnings);
  } else if (frameType === 0xc1 || frameType === 0xc2) {
    pushRawBlock(fields, data, {
      id: `reserved-${start + 1}`,
      name: 'Reserved',
      offset: start + 1,
      length: 1,
    });
  } else {
    // 0xC3 AcyclicData: başlık 6 bayt, ardından SLMP zarfı gelir.
    pushRawBlock(fields, data, {
      id: `reserved-${start + 1}`,
      name: 'Reserved',
      offset: start + 1,
      length: 1,
    });
    pushField(fields, data, {
      id: `tsn-da-${start + 2}`,
      name: 'da (destination station)',
      offset: start + 2,
      length: 2,
      rawValue: readUint16Be(data, start + 2),
      physicalValue: formatHex(readUint16Be(data, start + 2), 4),
    });
    pushRawBlock(fields, data, {
      id: `reserved-${start + 4}`,
      name: 'Reserved',
      offset: start + 4,
      length: 2,
    });
  }

  const bodyStart = start + descriptor.headerLength;
  if (bodyStart >= data.length) return data.length;

  if (frameType === 0xc3) {
    return decodeSlmpEnvelope(data, bodyStart, fields, warnings);
  }

  if (frameType === 0xc1 || frameType === 0xc2) {
    warnings.push(WARN_TSN_DETECTION_BODY_RAW);
    pushRawBlock(fields, data, {
      id: `tsn-detection-body-${bodyStart}`,
      name: 'Detection Body',
      offset: bodyStart,
      length: data.length - bodyStart,
      warnings: [WARN_TSN_DETECTION_BODY_RAW],
    });
    return data.length;
  }

  warnings.push(WARN_CYCLIC_LAYOUT_FROM_NETWORK_PARAMETERS);
  pushRawBlock(fields, data, {
    id: `cyclic-data-${bodyStart}`,
    name: 'Cyclic Data',
    offset: bodyStart,
    length: data.length - bodyStart,
    warnings: [WARN_CYCLIC_LAYOUT_FROM_NETWORK_PARAMETERS],
  });
  return data.length;
}

function buildResult(
  data: Uint8Array,
  fields: ParsedField[],
  warnings: WarningSink,
  errors: ProtocolError[],
  metadata: CcLinkIeFrameMetadata,
  options: CcLinkIeParseOptions,
): ParseResult {
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

function parseCcLinkIeFrame(data: Uint8Array, options: CcLinkIeParseOptions): ParseResult {
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

  // Asgari: Ethernet başlığı + çerçeve tipi baytı + TSN detection başlığı.
  if (data.length < MIN_HEADER_LENGTH + TSN_DETECTION_HEADER_LENGTH) {
    return fail({
      code: 'truncated-frame',
      message: ERROR_FRAME_TOO_SHORT,
      recoverable: true,
      offset: 0,
      length: data.length,
      details: {
        availableBytes: data.length,
        requiredBytes: MIN_HEADER_LENGTH + TSN_DETECTION_HEADER_LENGTH,
      },
    });
  }

  const fields: ParsedField[] = [];
  const warnings = new WarningSink();
  const errors: ProtocolError[] = [];
  const summaryParams: Record<string, string> = {};

  const destinationBytes = data.slice(0, MAC_LENGTH);
  const destinationMac = formatMac(destinationBytes);
  pushField(fields, data, {
    id: 'destination-mac',
    name: 'Destination MAC',
    offset: 0,
    length: MAC_LENGTH,
    rawValue: destinationMac,
    physicalValue: classifyDestinationMac(destinationBytes),
  });

  const sourceMac = formatMac(data.slice(MAC_LENGTH, MAC_LENGTH * 2));
  pushField(fields, data, {
    id: 'source-mac',
    name: 'Source MAC',
    offset: MAC_LENGTH,
    length: MAC_LENGTH,
    rawValue: sourceMac,
  });
  summaryParams['destinationMac'] = destinationMac;
  summaryParams['sourceMac'] = sourceMac;

  const chain = walkTypeLengthChain(data, MAC_LENGTH * 2, fields, warnings.buffer, errors);
  warnings.drain();

  const unknownMetadata: CcLinkIeFrameMetadata = {
    frameType: undefined,
    frameTypeName: undefined,
    networkKind: undefined,
    summaryKey: SUMMARY_NOT_CC_LINK_IE,
    summaryParams,
  };

  const etherType = chain.finalValue;
  if (etherType === undefined) {
    return buildResult(data, fields, warnings, errors, unknownMetadata, options);
  }

  const etherTypeOffset = chain.cursor - TYPE_LENGTH_FIELD_LENGTH;
  const etherTypeMatches = etherType === CC_LINK_IE_ETHER_TYPE;
  pushField(fields, data, {
    id: 'ethertype',
    name: 'EtherType',
    offset: etherTypeOffset,
    length: TYPE_LENGTH_FIELD_LENGTH,
    rawValue: etherType,
    physicalValue: etherTypeMatches ? 'CC-Link IE' : formatHex(etherType, 4),
    valid: etherTypeMatches,
    warnings: etherTypeMatches ? [] : [ERROR_ETHER_TYPE_NOT_CC_LINK_IE],
  });

  if (!etherTypeMatches) {
    errors.push({
      code: 'start-delimiter-not-found',
      message: ERROR_ETHER_TYPE_NOT_CC_LINK_IE,
      offset: etherTypeOffset,
      length: TYPE_LENGTH_FIELD_LENGTH,
      details: {
        etherType: formatHex(etherType, 4),
        expected: formatHex(CC_LINK_IE_ETHER_TYPE, 4),
      },
    });
    // IPv4 ise büyük olasılıkla CC-Link IE Field Basic'tir — sessiz kalma, söyle.
    if (etherType === 0x0800) warnings.push(WARN_FIELD_BASIC_NOT_ON_THIS_WIRE);
    pushRawBlock(fields, data, {
      id: `payload-${chain.cursor}`,
      name: 'Payload',
      offset: chain.cursor,
      length: data.length - chain.cursor,
      warnings: [ERROR_ETHER_TYPE_NOT_CC_LINK_IE],
    });
    summaryParams['etherType'] = formatHex(etherType, 4);
    return buildResult(data, fields, warnings, errors, unknownMetadata, options);
  }

  const headerStart = chain.cursor;
  const frameType = byteAt(data, headerStart);
  const tsnDescriptor = TSN_FRAME_TYPES.get(frameType);
  const fieldDescriptor = FRAME_TYPES.get(frameType);
  const headerLength =
    tsnDescriptor !== undefined
      ? tsnDescriptor.headerLength
      : fieldDescriptor !== undefined
        ? FIELD_HEADER_LENGTH
        : 1;

  if (data.length - headerStart < headerLength) {
    errors.push({
      code: 'truncated-frame',
      message: ERROR_HEADER_TRUNCATED,
      offset: headerStart,
      length: data.length - headerStart,
      details: { availableBytes: data.length - headerStart, requiredBytes: headerLength },
    });
    return buildResult(data, fields, warnings, errors, unknownMetadata, options);
  }

  const frameTypeName = tsnDescriptor?.name ?? fieldDescriptor?.name;
  pushField(fields, data, {
    id: `frame-type-${headerStart}`,
    name: 'frameType (arFType)',
    offset: headerStart,
    length: 1,
    rawValue: frameType,
    physicalValue: frameTypeName ?? formatHex(frameType, 2),
    valid: frameTypeName !== undefined,
    warnings: frameTypeName === undefined ? [WARN_FRAME_TYPE_NOT_NAMED] : [],
  });
  summaryParams['frameType'] = frameTypeName ?? formatHex(frameType, 2);

  if (frameTypeName === undefined) {
    warnings.push(WARN_FRAME_TYPE_NOT_NAMED);
    pushRawBlock(fields, data, {
      id: `payload-${headerStart + 1}`,
      name: 'CC-Link IE Payload',
      offset: headerStart + 1,
      length: data.length - headerStart - 1,
      warnings: [WARN_FRAME_TYPE_NOT_NAMED],
    });
    return buildResult(
      data,
      fields,
      warnings,
      errors,
      {
        frameType,
        frameTypeName: undefined,
        networkKind: undefined,
        summaryKey: SUMMARY_FRAME,
        summaryParams,
      },
      options,
    );
  }

  let consumedEnd: number;
  let networkKind: FrameFamily;
  if (tsnDescriptor !== undefined) {
    networkKind = 'tsn';
    consumedEnd = decodeTsnFrame(data, headerStart, frameType, tsnDescriptor, fields, warnings);
  } else if (fieldDescriptor !== undefined) {
    networkKind = fieldDescriptor.family;
    decodeFieldControlHeader(data, headerStart, fieldDescriptor, fields, warnings);
    const bodyStart = headerStart + FIELD_HEADER_LENGTH;
    if (bodyStart >= data.length) {
      consumedEnd = data.length;
    } else if (fieldDescriptor.body === 'cyclic') {
      warnings.push(WARN_CYCLIC_LAYOUT_FROM_NETWORK_PARAMETERS);
      pushRawBlock(fields, data, {
        id: `cyclic-data-${bodyStart}`,
        name: 'Cyclic Data',
        offset: bodyStart,
        length: data.length - bodyStart,
        warnings: [WARN_CYCLIC_LAYOUT_FROM_NETWORK_PARAMETERS],
      });
      consumedEnd = data.length;
    } else if (fieldDescriptor.body === 'transient') {
      warnings.push(WARN_TRANSIENT_PAYLOAD_RAW);
      pushRawBlock(fields, data, {
        id: `transient-data-${bodyStart}`,
        name: 'Transient Data',
        offset: bodyStart,
        length: data.length - bodyStart,
        warnings: [WARN_TRANSIENT_PAYLOAD_RAW],
      });
      consumedEnd = data.length;
    } else {
      consumedEnd = bodyStart;
    }
  } else {
    networkKind = 'field';
    consumedEnd = data.length;
  }

  appendPadding(data, consumedEnd, fields, warnings);

  return buildResult(
    data,
    fields,
    warnings,
    errors,
    {
      frameType,
      frameTypeName,
      networkKind,
      summaryKey: SUMMARY_FRAME,
      summaryParams,
    },
    options,
  );
}

export function parseCcLinkIe(data: Uint8Array): ParseResult {
  return parseCcLinkIeFrame(data, {});
}

export const ccLinkIeParser: ProtocolParser = {
  protocolId: PROTOCOL_ID,
  displayName: PROTOCOL_DISPLAY_NAME,

  /** Ucuz ön eleme: asgari uzunluk + EtherType 0x890F (tek VLAN tag'e kadar). */
  canParse(data: Uint8Array): boolean {
    if (data.length < MIN_HEADER_LENGTH + TSN_DETECTION_HEADER_LENGTH) return false;
    const first = (byteAt(data, MAC_LENGTH * 2) << 8) | byteAt(data, MAC_LENGTH * 2 + 1);
    if (first === CC_LINK_IE_ETHER_TYPE) return true;
    if (first !== VLAN_TPID) return false;
    if (data.length < MIN_HEADER_LENGTH + VLAN_TAG_LENGTH + TSN_DETECTION_HEADER_LENGTH) {
      return false;
    }
    const tagged =
      (byteAt(data, MAC_LENGTH * 2 + VLAN_TAG_LENGTH) << 8) |
      byteAt(data, MAC_LENGTH * 2 + VLAN_TAG_LENGTH + 1);
    return tagged === CC_LINK_IE_ETHER_TYPE;
  },

  parse(data: Uint8Array, context?: ParseContext): ParseResult {
    const options: CcLinkIeParseOptions = {};
    if (context?.timestamp !== undefined) options.timestamp = context.timestamp;
    if (context?.direction !== undefined) options.direction = context.direction;
    if (context?.channel !== undefined) options.channel = context.channel;
    if (context?.maxFrameLength !== undefined) options.maxFrameLength = context.maxFrameLength;
    if (context?.signal !== undefined) options.signal = context.signal;
    return parseCcLinkIeFrame(data, options);
  },
};

// ── Örnek çerçeveler ────────────────────────────────────────────────────────
// Baytlar YAPIYA göre kurulur; DEĞERLER SENTETİKtir. Yapı, N'in BSD-2-Clause
// yakalamalarındaki gerçek 0x890F çerçevelerine karşı DOĞRULANDI (o dosyalar
// bu depoya KOPYALANMADI — yalnız yerleşim teyidi için okundu). HEC alanı da
// sentetiktir ve zaten DOĞRULANMAZ (dosya başı).

const MASTER_MAC = [0x00, 0x11, 0x11, 0x11, 0x11, 0x11];
const SLAVE_MAC = [0x00, 0x00, 0x00, 0x00, 0x00, 0x01];
const BROADCAST_MAC = [0xff, 0xff, 0xff, 0xff, 0xff, 0xff];

function uint16Be(value: number): number[] {
  return [(value >>> 8) & 0xff, value & 0xff];
}

function uint16Le(value: number): number[] {
  return [value & 0xff, (value >>> 8) & 0xff];
}

function buildFrame(
  destination: readonly number[],
  source: readonly number[],
  body: readonly number[],
  padTo = 60,
): Uint8Array {
  const bytes = [...destination, ...source, 0x89, 0x0f, ...body];
  while (bytes.length < padTo) bytes.push(0x00);
  return Uint8Array.from(bytes);
}

/** 14 baytlık Field/Control başlığı; `middle` tam 4 bayt olmalıdır. */
function fieldHeader(
  frameType: number,
  secondByte: number,
  middle: readonly number[],
  srcNodeNumber: number,
  protocolVerType: number,
  hec: number,
): number[] {
  return [
    frameType,
    secondByte,
    ...middle,
    ...uint16Be(srcNodeNumber),
    protocolVerType,
    0x00,
    (hec >>> 24) & 0xff,
    (hec >>> 16) & 0xff,
    (hec >>> 8) & 0xff,
    hec & 0xff,
  ];
}

/** SLMP 3E istek zarfı: subheader → subcommand (15 bayt). */
function slmpRequest(command: number, subcommand: number, payload: readonly number[]): number[] {
  return [
    0x50,
    0x00,
    0x00, // network no: kendi ağı
    0xff, // station no: kendi istasyonu
    ...uint16Le(0x03ff), // module I/O no
    0x00, // multidrop
    ...uint16Le(payload.length + 6), // monitoring timer + command + subcommand + data
    ...uint16Le(0x0010), // monitoring timer: 16 × 250 ms
    ...uint16Le(command),
    ...uint16Le(subcommand),
    ...payload,
  ];
}

const EXAMPLE_FRAMES: ExampleFrame[] = [
  {
    id: 'field-token-m',
    name: 'protocol.ccLinkIe.example.fieldTokenM.name',
    // protocolVerType 0x01 → protocolVer 0 (single master), protocolType 1 (Field).
    bytes: buildFrame(
      SLAVE_MAC,
      MASTER_MAC,
      fieldHeader(0x15, 0x01, [0x00, 0x02, 0x00, 0x00], 0x0001, 0x01, 0x12345678),
    ),
    description: 'protocol.ccLinkIe.example.fieldTokenM.description',
    expectedValid: true,
  },
  {
    id: 'field-my-status',
    name: 'protocol.ccLinkIe.example.fieldMyStatus.name',
    bytes: buildFrame(
      SLAVE_MAC,
      MASTER_MAC,
      fieldHeader(0x20, 0x02, [0x00, 0x03, 0x13, 0x01], 0x0001, 0x11, 0x00abcdef),
    ),
    description: 'protocol.ccLinkIe.example.fieldMyStatus.description',
    expectedValid: true,
  },
  {
    id: 'field-cyclic-data-rwr',
    name: 'protocol.ccLinkIe.example.fieldCyclicDataRwr.name',
    bytes: buildFrame(SLAVE_MAC, MASTER_MAC, [
      ...fieldHeader(0x84, 0x00, [0x00, 0x04, 0x00, 0x00], 0x0002, 0x01, 0x0f0f0f0f),
      // Döngüsel gövde: link cihazı haritası ağ parametresinden gelir → HAM.
      ...new Array<number>(32).fill(0).map((_, index) => (index * 7) & 0xff),
    ]),
    description: 'protocol.ccLinkIe.example.fieldCyclicDataRwr.description',
    expectedValid: true,
  },
  {
    id: 'field-transient1',
    name: 'protocol.ccLinkIe.example.fieldTransient1.name',
    bytes: buildFrame(SLAVE_MAC, MASTER_MAC, [
      ...fieldHeader(0x22, 0x05, [0x00, 0x00, 0x13, 0x01], 0x0000, 0x01, 0x11223344),
      ...new Array<number>(24).fill(0x5a),
    ]),
    description: 'protocol.ccLinkIe.example.fieldTransient1.description',
    expectedValid: true,
  },
  {
    id: 'field-test-data',
    name: 'protocol.ccLinkIe.example.fieldTestData.name',
    // TestData: İKİ kaynağın da kırılımını verdiği tip → tek kaynak uyarısı YOK.
    bytes: buildFrame(
      BROADCAST_MAC,
      MASTER_MAC,
      fieldHeader(0x11, 0x01, [0x00, 0x00, 0x30, 0x01], 0x0101, 0x01, 0x0a0b0c0d),
    ),
    description: 'protocol.ccLinkIe.example.fieldTestData.description',
    expectedValid: true,
  },
  {
    id: 'control-token',
    name: 'protocol.ccLinkIe.example.controlToken.name',
    // Control ailesi: ikinci bayt `priority`, orta alan `scanNumber`,
    // rel 8-9 `protocolVerType` DEĞİL ayrılmış alandır.
    bytes: buildFrame(
      SLAVE_MAC,
      MASTER_MAC,
      fieldHeader(0x06, 0x02, [0x00, 0x00, 0x2a, 0x00], 0x0003, 0x00, 0x00c0ffee),
    ),
    description: 'protocol.ccLinkIe.example.controlToken.description',
    expectedValid: true,
  },
  {
    id: 'tsn-cyclic-ms',
    name: 'protocol.ccLinkIe.example.tsnCyclicMs.name',
    bytes: buildFrame(BROADCAST_MAC, MASTER_MAC, [
      0xc4,
      0x05, // cyclicNo 5, kontrol bayrağı etkin
      ...uint16Be(0x0102), // sa
      0x00,
      0x00,
      0xde,
      0xad,
      0xbe,
      0xef, // HEC
      ...new Array<number>(24).fill(0x33),
    ]),
    description: 'protocol.ccLinkIe.example.tsnCyclicMs.description',
    expectedValid: true,
  },
  {
    id: 'tsn-cyclic-ss-check-disabled',
    name: 'protocol.ccLinkIe.example.tsnCyclicSsCheckDisabled.name',
    bytes: buildFrame(MASTER_MAC, SLAVE_MAC, [
      0xc5,
      0x87, // bit 7 set → cyclicNoCheckFlag = disable, cyclicNo = 7
      ...uint16Be(0x0201), // da
      0x00,
      0x00,
      0x01,
      0x02,
      0x03,
      0x04,
      ...new Array<number>(24).fill(0x44),
    ]),
    description: 'protocol.ccLinkIe.example.tsnCyclicSsCheckDisabled.description',
    expectedValid: true,
  },
  {
    id: 'tsn-acyclic-data-slmp',
    name: 'protocol.ccLinkIe.example.tsnAcyclicDataSlmp.name',
    // 6 baytlık TSN acyclicData başlığı + SLMP 3E istek zarfı.
    bytes: buildFrame(SLAVE_MAC, MASTER_MAC, [
      0xc3,
      0x00,
      ...uint16Be(0x0102), // da
      0x00,
      0x00,
      ...slmpRequest(0x0401, 0x0000, [0x64, 0x00, 0x00, 0xa8, 0x01, 0x00]),
    ]),
    description: 'protocol.ccLinkIe.example.tsnAcyclicDataSlmp.description',
    expectedValid: true,
  },
  {
    id: 'tsn-acyclic-detection',
    name: 'protocol.ccLinkIe.example.tsnAcyclicDetection.name',
    bytes: buildFrame(BROADCAST_MAC, MASTER_MAC, [
      0xc1,
      0x00,
      ...new Array<number>(30).fill(0x00).map((_, index) => (index === 2 ? 0x01 : 0x00)),
    ]),
    description: 'protocol.ccLinkIe.example.tsnAcyclicDetection.description',
    expectedValid: true,
  },
  {
    id: 'unknown-frame-type',
    name: 'protocol.ccLinkIe.example.unknownFrameType.name',
    // 0x77 iki kaynakta da adlandırılmamış → gövdeye DOKUNULMAZ.
    bytes: buildFrame(SLAVE_MAC, MASTER_MAC, [0x77, ...new Array<number>(30).fill(0x11)]),
    description: 'protocol.ccLinkIe.example.unknownFrameType.description',
    expectedValid: true,
  },
  {
    id: 'ethertype-ipv4-field-basic',
    name: 'protocol.ccLinkIe.example.etherTypeIpv4FieldBasic.name',
    // EtherType 0x0800 → CC-Link IE Field Basic bu telde GELMEZ; hata + uyarı.
    bytes: Uint8Array.from([
      ...BROADCAST_MAC,
      ...MASTER_MAC,
      0x08,
      0x00,
      ...new Array<number>(46).fill(0x00),
    ]),
    description: 'protocol.ccLinkIe.example.etherTypeIpv4FieldBasic.description',
    expectedValid: false,
  },
  {
    id: 'frame-too-short',
    name: 'protocol.ccLinkIe.example.frameTooShort.name',
    // 20 bayt: EtherType ve TokenM tipi var ama 14 baytlık Field başlığı için
    // yalnız 6 bayt kaldı — çerçeve düzeyinde "kesik başlık" hatası.
    bytes: Uint8Array.from([
      ...SLAVE_MAC,
      ...MASTER_MAC,
      0x89,
      0x0f,
      0x15,
      0x01,
      0x00,
      0x02,
      0x00,
      0x00,
    ]),
    description: 'protocol.ccLinkIe.example.frameTooShort.description',
    expectedValid: false,
  },
];

export const ccLinkIePlugin: ProtocolPlugin = {
  id: PROTOCOL_ID,
  name: PROTOCOL_DISPLAY_NAME,
  category: 'industrial-automation',
  parser: ccLinkIeParser,
  documentation: {
    summary: 'protocol.ccLinkIe.documentation.summary',
    layer: 'multi-layer',
    references: [
      {
        title:
          'CC-Link Partner Association — CC-Link IE TSN Wireshark dissector (CCLinkIE_TSN_Rev03.lua, "Copyright(C) CC-Link Partner Association")',
        url: 'https://github.com/Masamuneee/mitsubishi-wireshark-plugin',
      },
      {
        title:
          'NTT Communications — zeek-parser-CCLinkIENoIP (BSD-2-Clause), CC-Link IE Field/Control frame layout',
        url: 'https://github.com/nttcom/zeek-parser-CCLinkIENoIP',
      },
      {
        title: 'IEEE EtherType registry — 0x890F, Mitsubishi Electric Corporation Nagoya Works',
        url: 'https://standards-oui.ieee.org/ethertype/eth.txt',
      },
      {
        title: 'Mitsubishi Electric — SLMP Reference Manual SH(NA)-080956ENG, 3E frame envelope',
        url: 'https://dl.mitsubishielectric.com/dl/fa/document/manual/plc/sh080956eng/sh080956engl.pdf',
      },
    ],
  },
  exampleFrames: EXAMPLE_FRAMES,
};
