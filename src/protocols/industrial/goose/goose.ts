/**
 * IEC 61850 GOOSE (Generic Object Oriented Substation Event) — trafo
 * merkezlerinde koruma/trip olaylarını taşıyan çok-alıcılı (multicast) yayın.
 * Girdi TAM BİR ETHERNET ÇERÇEVESİdir: DST MAC + SRC MAC (+ opsiyonel VLAN
 * tag'leri) + EtherType 0x88B8 + 8 baytlık GOOSE başlığı + BER/TLV kodlu
 * goosePdu (+ Ethernet dolgusu).
 *
 * ── GİRDİ MODELİ (Karar 5, brief-faz10-dalga5.md) ───────────────────────────
 * EtherCAT (5d) ile birebir aynı gerekçe: GOOSE, Ethernet'in ÜSTÜNDE taşınan
 * bir üst katman değildir — IP/UDP kapsüllemesi yoktur, EtherType doğrudan
 * GOOSE'u işaret eder; spec de "doğrudan Ethernet seviyesinde incelenmeli" der.
 * Bu yüzden Ethernet başlığı da bu motorun alanıdır ve çözümü dalga 4a'nın DIŞA
 * AÇILAN yardımcılarıyla yapılır (`formatMac`, `classifyDestinationMac`,
 * `walkTypeLengthChain`); ikinci bir MAC formatlayıcı ya da ikinci bir VLAN
 * döngüsü yazılmadı. `ethernet-ii` sayfası 0x88B8'i yalnız ADLANDIRIR ve buraya
 * yönlendirir (`ETHER_TYPE_NAMES`, dalga 5e'de eklendi) — zincir KURULMAZ.
 *
 * VLAN'lı GOOSE yaygındır: 61850 kurulumlarında yayın çoğu zaman
 * priority-tagged (802.1Q, PCP=4) gönderilir ve VID 0 olabilir. `walkTypeLengthChain`
 * bunu zaten yürüdüğü için tüm ofsetler VLAN varlığına göre KENDİLİĞİNDEN kayar;
 * `ParsedField.offset` değerleri her durumda HAM çerçeveye göre mutlaktır.
 *
 * ── KAYNAK UYARISI (Karar 2) ────────────────────────────────────────────────
 * IEC 61850-8-1'in resmi metni ücretlidir ve bu depoda YOKTUR. Alan ağacı ve
 * etiket numaraları İKİ BAĞIMSIZ, kamuya açık ikincil kaynaktan ÇAPRAZ TEYİTLE
 * alındı (ikisine de bu oturumda gerçekten erişildi; KOD KOPYALANMADI, yalnız
 * format bilgisi doğrulandı):
 *   1. **Wireshark GOOSE dissector'ı** — `epan/dissectors/asn1/goose/goose.asn`
 *      standardın ASN.1 modülünü olduğu gibi taşır: `goosePdu [APPLICATION 1]`,
 *      `IECGoosePdu` alanlarının [0]-[11] context etiketleri ve `Data` CHOICE'unun
 *      tip etiketleri oradan okundu. `packet-goose.c` link katmanını verir:
 *      APPID/Length/Reserved1/Reserved2 sırası, Reserved1'in bit 15'i
 *      (`F_RESERVE1_S_BIT 0x8000`) ve `dissect_goose_UtcTime` (4 bayt saniye +
 *      3 bayt kesir, "yalnız 3 bayt önerilir") ile `FLOAT_ENC_LENGTH 5` /
 *      `SINGLE_FLOAT_EXP_BITS 8`.
 *      https://gitlab.com/wireshark/wireshark/-/tree/master/epan/dissectors
 *   2. **libIEC61850** (Michael Zillgith, GPLv3 — yalnız dokümante edilmiş
 *      biçim bilgisi referans alındı, kod alınmadı): `goose_publisher.c`
 *      çerçeveyi `… 88 B8 | APPID(2) | Length(2) | Reserved1(2) | Reserved2(2)`
 *      diye kurar, `BerEncoder_encodeTL(0x61, …)` ile PDU'yu açar ve alanları
 *      0x80…0x8A + allData 0xAB sırasıyla yazar; `goose_receiver.c`
 *      `apduLength = length - 8` diyerek Length'in APPID'DEN İTİBAREN saydığını
 *      doğrular ve `Data` tip etiketlerini (0xa1/0xa2/0x83/0x84/0x85/0x86/0x87/
 *      0x89/0x8a/0x8c/0x91) switch'ler. `mms_value.h` UtcTime'ın 8. baytındaki
 *      TimeQuality bit anlamlarını yazar (bit 7 leapSecondsKnown, bit 6
 *      clockFailure, bit 5 clockNotSynchronized, bit 0-4 alt-saniye doğruluk);
 *      aynı bit maskeleri Wireshark'ın `packet-mms.c` dosyasında da 0x80/0x40/
 *      0x20/0x1F olarak geçer — yani zaman damgasının kodlaması ÇİFT TEYİTLİDİR.
 *      https://github.com/mz-automation/libiec61850
 *
 * TEYİT EDİLEMEYEN ADLANDIRILMADI (spec 7259'un emri, EtherCAT 0xFF emsali):
 *   • `Data` CHOICE'unun yalnız goose.asn'de görünen üyeleri — real [8], bcd
 *     [13], booleanArray [14], objId [15], mMSString [16] — libIEC61850'nin
 *     tanıdığı kümede YOK; ham bırakılır ve `unknownDataType` ile işaretlenir.
 *   • Reserved1'in bit 15'i ("Simulated") yalnız TEK kaynakta (Wireshark)
 *     geçiyor; libIEC61850 bu baytları her zaman sıfır yazar ve simülasyon
 *     bilgisini yalnız PDU'nun `simulation [7]` alanında taşır. Bu yüzden
 *     Reserved1 BİR BÜTÜN olarak HAM gösterilir: sıfırdan farklıysa uyarı
 *     basılır ve "bit 15 tek kaynakta Simulated" notu verilir, ama alan
 *     ADLANDIRILMAZ. Simülasyon/test durumu için güvenilen tek yer çift teyitli
 *     `simulation` alanıdır.
 *
 * ── ŞİFRELİ İÇERİK (Karar 8) ────────────────────────────────────────────────
 * ASN.1 modülü PDU'nun sonunda `security [12] ANY OPTIONAL — reserved for
 * digital signature` alanını tarif eder. Bu motor imza/şifre ÇÖZMEZ: alan
 * görülürse ham bırakılır ve `securityNotDecoded` ile işaretlenir. Anahtar
 * girişi hiçbir dalgada yoktur.
 *
 * ── STATUS: 'partial' — GEREKÇE (Karar 4) ───────────────────────────────────
 * Katalogdaki `iec-61850` kaydı MMS + GOOSE + SCL vaat eder; bu motor yalnız
 * GOOSE'u çözer. MMS tam bir ASN.1/ISO oturum yığınıdır (presentation/session/
 * ACSE), SCL ise XML tanım içe aktarımıdır — ikisi de bu dalganın dışında.
 * Emsal KWP2000/MAVLink: kaydın vaat ettiğinin bir kısmı BİLİNÇLİ eksik olduğu
 * için rozet 'ready' değil 'partial'dır ve sekme metni neyin çözülüp neyin
 * çözülmediğini açıkça yazar (boş kart yasağı ihlal edilmez, CLAUDE.md).
 * GOOSE'un KENDİ içinde eksik bırakılan bir doğrulama yoktur: GOOSE'un çerçeve
 * checksum'ı yoktur (o iş Ethernet FCS'inindir), her PDU alanı adlandırılır ve
 * çözülür.
 *
 * ── ANALYZER SINIRI ─────────────────────────────────────────────────────────
 * stNum/sqNum zaman çizelgesi, retransmission eğrisi ve TTL süresi dolma takibi
 * bu motorun DIŞINDADIR (spec 9809-9899 bunları analyzer'a verir) — hepsi ÇOK
 * ÇERÇEVE ister. Motor tek çerçevenin alanlarını verir; stNum ile sqNum
 * arasındaki ilişki yalnız örnek AÇIKLAMALARINDA anlatılır, kod ilişki KURMAZ.
 * Dataset değerlerinin SEMANTİĞİ (hangi eleman hangi Data Attribute) SCL'den
 * gelir; tek çerçeveden çıkarılamaz, bu yüzden tipler adlandırılır, anlamlar
 * adlandırılmaz.
 *
 * ── ENDIANNESS ──────────────────────────────────────────────────────────────
 * EtherCAT'in AKSİNE burada her şey NETWORK ORDER'dır (big-endian): Ethernet
 * başlığı, APPID/Length/Reserved sözcükleri ve BER'in kendi tamsayı kodlaması.
 * Tek okuma yardımcısı bu yüzden yeterli.
 */

import {
  decodeBerBoolean,
  decodeBerInteger,
  decodeBerVisibleString,
  readBerTlv,
} from '@/protocol-core/decoding/berReader';
import type { BerErrorCode, BerTlv } from '@/protocol-core/decoding/berReader';
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

/**
 * Katalogdaki kayıt id'siyle birebir aynı olmalı (`industrial-automation/
 * scada-utility/iec-61850`); katalogda ayrı bir `goose` kaydı YOKTUR.
 * Çeviri anahtarı segmenti ise `goose`dur — anahtar segmentinde tire olamaz
 * (canopen `SUMMARY_KEY_SUFFIXES` emsali) ve motorun çözdüğü şey GOOSE'tur.
 */
const PROTOCOL_ID = 'iec-61850';
/** Protokol adı veridir, çeviriye girmez (CLAUDE.md); kapsam adın içinde. */
const PROTOCOL_DISPLAY_NAME = 'IEC 61850 GOOSE';

/** GOOSE'un tel üstündeki tek kimliği (iki kaynakta da 0x88B8). */
const GOOSE_ETHER_TYPE = 0x88b8;

/** APPID(2) + Length(2) + Reserved1(2) + Reserved2(2) — libIEC61850 `length - 8`. */
const GOOSE_HEADER_LENGTH = 8;
const APPID_OFFSET_IN_HEADER = 0;
const LENGTH_OFFSET_IN_HEADER = 2;
const RESERVED1_OFFSET_IN_HEADER = 4;
const RESERVED2_OFFSET_IN_HEADER = 6;
const WORD_LENGTH = 2;

/** `goosePdu [APPLICATION 1] IMPLICIT` → 0b01_1_00001 (goose.asn + libIEC61850). */
const GOOSE_PDU_TAG = 0x61;
/** `gseMngtPdu [APPLICATION 0]` — aynı EtherType'ta taşınır ama BAŞKA bir PDU'dur. */
const GSE_MNGT_PDU_TAG = 0x60;

/** `allData [11] IMPLICIT SEQUENCE OF Data` → context + constructed + 11. */
const ALL_DATA_TAG = 0xab;
/** `security [12] ANY OPTIONAL` — dijital imza için ayrılmış (Karar 8). */
const SECURITY_TAG_NUMBER = 12;

/** UtcTime: 4 bayt saniye + 3 bayt kesir + 1 bayt TimeQuality (çift teyitli). */
const UTC_TIME_LENGTH = 8;
const UTC_SECONDS_LENGTH = 4;
const UTC_FRACTION_LENGTH = 3;
const UTC_FRACTION_SCALE = 2 ** 24;
const UTC_QUALITY_LEAP_SECONDS_KNOWN = 0x80;
const UTC_QUALITY_CLOCK_FAILURE = 0x40;
const UTC_QUALITY_CLOCK_NOT_SYNCHRONIZED = 0x20;
const UTC_QUALITY_ACCURACY_MASK = 0x1f;

/** FloatingPoint: 1 bayt üs genişliği + IEEE-754 (Wireshark 5/8, libIEC61850 32/8). */
const FLOAT_ENCODED_LENGTH = 5;
const SINGLE_FLOAT_EXPONENT_BITS = 8;

/** IEC/TC57'nin OUI'si 00-0C-CD; multicast biçimi 01-0C-CD, GOOSE alt bloğu 01. */
const GOOSE_MULTICAST_PREFIX = [0x01, 0x0c, 0xcd, 0x01] as const;

/** Reserved1'in bit 15'i tek kaynakta "Simulated" — adlandırılmıyor (dosya başı). */
const RESERVED1_SINGLE_SOURCE_BIT = 0x8000;

/**
 * Sonsuz döngü ve patolojik iç içe geçme koruması (IPv6 ext-header emsali).
 * Bir TLV en az 2 bayt tükettiği için ilerleme garantilidir; bu sayılar yine de
 * bozuk/çelişkili girdide yürüyüşü sınırlar. Gerçek bir dataset'te eleman sayısı
 * onlarla, derinlik 2-3 ile ölçülür.
 */
const MAX_DATA_ELEMENTS = 256;
const MAX_DATA_DEPTH = 4;
/** goosePdu içinde beklenen alan sayısı 13'tür; bozuk girdide yürüyüş burada durur. */
const MAX_PDU_FIELDS = 64;

const HEX_RADIX = 16;
/** VLAN'lı varyantta tip alanı bir tag kadar ilerideki ofsettedir. */
const VLAN_TAG_LENGTH = 4;

export const ERROR_FRAME_TOO_SHORT = 'protocol.goose.error.frameTooShort';
export const ERROR_FRAME_TOO_LONG = 'protocol.goose.error.frameTooLong';
export const ERROR_ABORTED = 'protocol.goose.error.aborted';
export const ERROR_ETHER_TYPE_NOT_GOOSE = 'protocol.goose.error.etherTypeNotGoose';
export const ERROR_HEADER_TRUNCATED = 'protocol.goose.error.headerTruncated';
export const ERROR_LENGTH_BELOW_HEADER = 'protocol.goose.error.lengthBelowHeader';
export const ERROR_APDU_TRUNCATED = 'protocol.goose.error.apduTruncated';
export const ERROR_PDU_TAG_NOT_GOOSE = 'protocol.goose.error.pduTagNotGoose';

/** BER çözücüsünün kapalı hata kümesinin karşılıkları — biri bile yutulmaz. */
export const ERROR_BER_TRUNCATED = 'protocol.goose.error.berTruncated';
export const ERROR_BER_LONG_FORM_TAG = 'protocol.goose.error.berLongFormTag';
export const ERROR_BER_INDEFINITE_LENGTH = 'protocol.goose.error.berIndefiniteLength';
export const ERROR_BER_RESERVED_LENGTH_OCTET = 'protocol.goose.error.berReservedLengthOctet';
export const ERROR_BER_LENGTH_OCTETS_UNSUPPORTED =
  'protocol.goose.error.berLengthOctetsUnsupported';
export const ERROR_BER_VALUE_OVERFLOW = 'protocol.goose.error.berValueOverflow';
export const ERROR_BER_UNEXPECTED_VALUE_LENGTH = 'protocol.goose.error.berUnexpectedValueLength';

export const WARN_DESTINATION_NOT_GOOSE_RANGE = 'protocol.goose.warning.destinationNotGooseRange';
export const WARN_RESERVED_NOT_ZERO = 'protocol.goose.warning.reservedNotZero';
export const WARN_GSE_MANAGEMENT_PDU = 'protocol.goose.warning.gseManagementPdu';
export const WARN_UNKNOWN_PDU_FIELD = 'protocol.goose.warning.unknownPduField';
export const WARN_MISSING_MANDATORY_FIELD = 'protocol.goose.warning.missingMandatoryField';
export const WARN_VALUE_NOT_DECODABLE = 'protocol.goose.warning.valueNotDecodable';
export const WARN_NON_PRINTABLE_STRING = 'protocol.goose.warning.nonPrintableString';
export const WARN_TIMESTAMP_LENGTH_UNEXPECTED = 'protocol.goose.warning.timestampLengthUnexpected';
export const WARN_CLOCK_NOT_TRUSTWORTHY = 'protocol.goose.warning.clockNotTrustworthy';
export const WARN_UNKNOWN_DATA_TYPE = 'protocol.goose.warning.unknownDataType';
export const WARN_DATA_SEMANTICS_NEED_SCL = 'protocol.goose.warning.dataSemanticsNeedScl';
export const WARN_DATA_SET_COUNT_MISMATCH = 'protocol.goose.warning.dataSetCountMismatch';
export const WARN_DATA_DEPTH_LIMIT = 'protocol.goose.warning.dataDepthLimit';
export const WARN_DATA_ELEMENT_LIMIT = 'protocol.goose.warning.dataElementLimit';
export const WARN_SIMULATION_ACTIVE = 'protocol.goose.warning.simulationActive';
export const WARN_NEEDS_COMMISSIONING = 'protocol.goose.warning.needsCommissioning';
export const WARN_SECURITY_NOT_DECODED = 'protocol.goose.warning.securityNotDecoded';
export const WARN_PADDING_NOT_ZERO = 'protocol.goose.warning.paddingNotZero';
export const WARN_TRAILING_BYTES = 'protocol.goose.warning.trailingBytes';

const SUMMARY_PUBLICATION = 'protocol.goose.summary.publication';
const SUMMARY_MANAGEMENT = 'protocol.goose.summary.management';
const SUMMARY_NOT_GOOSE = 'protocol.goose.summary.notGoose';
const SUMMARY_PDU_UNREADABLE = 'protocol.goose.summary.pduUnreadable';

/**
 * BER hata kodu → çerçeve hata kodu + mesaj anahtarı. `ProtocolErrorCode` KAPALI
 * bir union'dır (types.ts); BER'in yedi ayrımı oraya bire bir taşınmaz — ayrım
 * mesaj anahtarında yaşar, davranış (rozet/kurtarma) merkezî kodda.
 *
 * Üç kova var ve ayrımları kullanıcıya farklı şey söyler:
 *   • `truncated-frame`      → bayt yetmedi (veri kesik)
 *   • `length-mismatch`      → uzunluk alanı gerçekle çelişiyor (veri tutarsız)
 *   • `unsupported-encoding` → biçim bu çözücünün kümesinde değil (ARAÇ sınırı)
 * Üçüncüsü 5e'de `ProtocolErrorCode`a eklendi: "belirsiz uzunluk" bir değer
 * taşma hatası DEĞİLDİR ve `value-out-of-range` rozetiyle göstermek kullanıcıya
 * veriyi suçlardı.
 */
interface BerErrorMapping {
  readonly code: ProtocolErrorCode;
  readonly message: string;
}

const BER_ERROR_MAP: Readonly<Record<BerErrorCode, BerErrorMapping>> = {
  truncated: { code: 'truncated-frame', message: ERROR_BER_TRUNCATED },
  'long-form-tag': { code: 'unsupported-encoding', message: ERROR_BER_LONG_FORM_TAG },
  'indefinite-length': { code: 'unsupported-encoding', message: ERROR_BER_INDEFINITE_LENGTH },
  'reserved-length-octet': {
    code: 'unsupported-encoding',
    message: ERROR_BER_RESERVED_LENGTH_OCTET,
  },
  'length-octets-unsupported': {
    code: 'unsupported-encoding',
    message: ERROR_BER_LENGTH_OCTETS_UNSUPPORTED,
  },
  'value-overflow': { code: 'length-mismatch', message: ERROR_BER_VALUE_OVERFLOW },
  'unexpected-value-length': {
    code: 'length-mismatch',
    message: ERROR_BER_UNEXPECTED_VALUE_LENGTH,
  },
};

/** goosePdu alanının nasıl çözüleceği — etiket numarası değil, ETİKET BAYTI anahtar. */
type PduFieldKind = 'visible-string' | 'integer' | 'boolean' | 'utc-time' | 'all-data';

interface PduFieldDefinition {
  readonly id: string;
  /** ASN.1'deki adı — protokol adı veridir, çevrilmez. */
  readonly name: string;
  readonly kind: PduFieldKind;
  readonly unit?: string;
  /** ASN.1'de OPTIONAL olmayan alanlar; eksikse uyarı basılır. */
  readonly mandatory: boolean;
}

/**
 * `IECGoosePdu` alanları — goose.asn'in [0]-[11] context etiketleri ve
 * libIEC61850'nin yazdığı 0x80…0x8A + 0xAB baytları BİREBİR aynı (dosya başı).
 */
const PDU_FIELDS: ReadonlyMap<number, PduFieldDefinition> = new Map<number, PduFieldDefinition>([
  [0x80, { id: 'gocb-ref', name: 'gocbRef', kind: 'visible-string', mandatory: true }],
  [
    0x81,
    {
      id: 'time-allowed-to-live',
      name: 'timeAllowedtoLive',
      kind: 'integer',
      unit: 'ms',
      mandatory: true,
    },
  ],
  [0x82, { id: 'dat-set', name: 'datSet', kind: 'visible-string', mandatory: true }],
  // goID ASN.1'de OPTIONAL; yokluğu uyarı DEĞİLDİR.
  [0x83, { id: 'go-id', name: 'goID', kind: 'visible-string', mandatory: false }],
  [0x84, { id: 'timestamp', name: 't', kind: 'utc-time', mandatory: true }],
  [0x85, { id: 'st-num', name: 'stNum', kind: 'integer', mandatory: true }],
  [0x86, { id: 'sq-num', name: 'sqNum', kind: 'integer', mandatory: true }],
  // simulation/ndsCom DEFAULT FALSE taşır: yoklukları FALSE demektir, uyarı değil.
  [0x87, { id: 'simulation', name: 'simulation', kind: 'boolean', mandatory: false }],
  [0x88, { id: 'conf-rev', name: 'confRev', kind: 'integer', mandatory: true }],
  [0x89, { id: 'nds-com', name: 'ndsCom', kind: 'boolean', mandatory: false }],
  [
    0x8a,
    { id: 'num-dat-set-entries', name: 'numDatSetEntries', kind: 'integer', mandatory: true },
  ],
  [ALL_DATA_TAG, { id: 'all-data', name: 'allData', kind: 'all-data', mandatory: true }],
]);

/** Dataset elemanının değerinin nasıl gösterileceği. */
type DataValueKind =
  | 'nested'
  | 'boolean'
  | 'integer'
  | 'bit-string'
  | 'float'
  | 'visible-string'
  | 'utc-time'
  | 'raw';

interface DataTypeDefinition {
  readonly name: string;
  readonly kind: DataValueKind;
}

/**
 * `Data` CHOICE'unun ÇİFT TEYİTLİ üyeleri: hem goose.asn'de hem libIEC61850'nin
 * `parseAllData` switch'inde geçenler. Yalnız goose.asn'de görünenler (real [8],
 * bcd [13], booleanArray [14], objId [15], mMSString [16]) BURAYA GİRMEZ —
 * adlandırılmaz, ham kalır (dosya başı, EtherCAT 0xFF emsali).
 */
const DATA_TYPES: ReadonlyMap<number, DataTypeDefinition> = new Map<number, DataTypeDefinition>([
  [0x80, { name: 'reserved (AccessResult)', kind: 'raw' }],
  [0xa1, { name: 'array', kind: 'nested' }],
  [0xa2, { name: 'structure', kind: 'nested' }],
  [0x83, { name: 'boolean', kind: 'boolean' }],
  [0x84, { name: 'bit-string', kind: 'bit-string' }],
  [0x85, { name: 'integer', kind: 'integer' }],
  [0x86, { name: 'unsigned', kind: 'integer' }],
  [0x87, { name: 'floating-point', kind: 'float' }],
  [0x89, { name: 'octet-string', kind: 'raw' }],
  [0x8a, { name: 'visible-string', kind: 'visible-string' }],
  [0x8c, { name: 'binary-time', kind: 'raw' }],
  [0x91, { name: 'utc-time', kind: 'utc-time' }],
]);

function toProtocolWarning(key: string): ProtocolWarning {
  return { code: key, message: key };
}

/** noUncheckedIndexedAccess: bayt dizisi erişimi her yerde bu guard'dan geçer. */
function byteAt(data: Uint8Array, offset: number): number {
  return data[offset] ?? 0;
}

/** GOOSE'ta HER sözcük network order'dır (dosya başı endianness notu). */
function readUint16BE(data: Uint8Array, offset: number): number {
  return (byteAt(data, offset) << 8) | byteAt(data, offset + 1);
}

/** `>>> 0`: SecondSinceEpoch'un en üst biti işaretli sayıya kaymasın. */
function readUint32BE(data: Uint8Array, offset: number): number {
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

export type GooseFrameMetadata = {
  /** EtherType yanlışsa ya da başlık kesikse `undefined`. */
  appId: number | undefined;
  /** `bigint` metadata'da taşınmaz (serileştirilemez) — metin olarak verilir. */
  stNum: string | undefined;
  sqNum: string | undefined;
  dataSetEntryCount: number;
  summaryKey: string;
  summaryParams: Record<string, string>;
};

interface GooseParseOptions {
  timestamp?: number;
  direction?: FrameDirection;
  channel?: string;
  maxFrameLength?: number;
  signal?: AbortSignal;
}

/**
 * Frame düzeyindeki uyarıları TEKRARSIZ biriktirir: "değerin anlamı SCL ister"
 * notu her dataset elemanında alan düzeyinde basılır ama frame rozetinde bir kez
 * görünmelidir (EtherCAT `WarningSink` emsali).
 */
class WarningSink {
  private readonly seen = new Set<string>();
  readonly warnings: ProtocolWarning[] = [];

  push(key: string): void {
    if (this.seen.has(key)) return;
    this.seen.add(key);
    this.warnings.push(toProtocolWarning(key));
  }
}

/** Çözüm boyunca taşınan mutable defter — `doip.ts`in `decode*` out-param deseni. */
interface GooseDecodeState {
  readonly data: Uint8Array;
  readonly fields: ParsedField[];
  readonly warnings: WarningSink;
  readonly errors: ProtocolError[];
  /** Tüm dataset ağacı için ortak eleman bütçesi (derinlikten bağımsız). */
  elementBudget: number;
}

function pushBerError(
  state: GooseDecodeState,
  berError: BerErrorCode,
  offset: number,
  details?: Record<string, unknown>,
): void {
  const mapping = BER_ERROR_MAP[berError];
  const error: ProtocolError = { code: mapping.code, message: mapping.message, offset };
  error.details = { berError, ...(details ?? {}) };
  state.errors.push(error);
}

/** Ham bayt alanı — değeri çözülemeyen her yerde aynı biçim kullanılır. */
function rawField(
  state: GooseDecodeState,
  id: string,
  name: string,
  offset: number,
  length: number,
  warnings: readonly string[],
): ParsedField {
  return {
    id,
    name,
    offset,
    length,
    rawBytes: state.data.slice(offset, offset + length),
    unit: 'B',
    valid: true,
    warnings: [...warnings],
  };
}

/**
 * UtcTime (8 bayt): SecondSinceEpoch(4, BE) + FractionOfSecond(3) +
 * TimeQuality(1). Üç parça da AYRI ParsedField olur — kesir ve saat kalitesi
 * koruma mühendisinin ilk baktığı yerdir, tek satırda gizlenmemeli.
 * `label` ana alanın adıdır (`t` ya da `allData[…]`), `idPrefix` alan id'si.
 */
function decodeUtcTime(
  state: GooseDecodeState,
  idPrefix: string,
  label: string,
  valueOffset: number,
  valueLength: number,
  parent: ParsedField,
): void {
  if (valueLength !== UTC_TIME_LENGTH) {
    // Uzunluk beklenmedikse HİÇBİR parça çözülmez: 8 bayttan kısa bir değerde
    // "saniye" diye bir sayı basmak uydurma olurdu.
    parent.warnings.push(WARN_TIMESTAMP_LENGTH_UNEXPECTED);
    state.warnings.push(WARN_TIMESTAMP_LENGTH_UNEXPECTED);
    return;
  }

  const seconds = readUint32BE(state.data, valueOffset);
  const fractionOffset = valueOffset + UTC_SECONDS_LENGTH;
  const fraction =
    (byteAt(state.data, fractionOffset) << 16) |
    (byteAt(state.data, fractionOffset + 1) << 8) |
    byteAt(state.data, fractionOffset + 2);
  const qualityOffset = fractionOffset + UTC_FRACTION_LENGTH;
  const quality = byteAt(state.data, qualityOffset);

  const milliseconds = Math.round((fraction / UTC_FRACTION_SCALE) * 1000);
  parent.physicalValue = new Date(seconds * 1000 + milliseconds).toISOString();

  state.fields.push({
    id: `${idPrefix}-seconds`,
    name: `${label} — SecondSinceEpoch`,
    offset: valueOffset,
    length: UTC_SECONDS_LENGTH,
    rawBytes: state.data.slice(valueOffset, valueOffset + UTC_SECONDS_LENGTH),
    rawValue: seconds,
    physicalValue: new Date(seconds * 1000).toISOString(),
    unit: 's',
    valid: true,
    warnings: [],
  });
  state.fields.push({
    id: `${idPrefix}-fraction`,
    name: `${label} — FractionOfSecond`,
    offset: fractionOffset,
    length: UTC_FRACTION_LENGTH,
    rawBytes: state.data.slice(fractionOffset, fractionOffset + UTC_FRACTION_LENGTH),
    rawValue: fraction,
    // Kesir 2⁻²⁴ birimlidir; milisaniye karşılığı okunabilir olan.
    physicalValue: `${String(milliseconds)} ms`,
    valid: true,
    warnings: [],
  });

  const leapSecondsKnown = (quality & UTC_QUALITY_LEAP_SECONDS_KNOWN) !== 0;
  const clockFailure = (quality & UTC_QUALITY_CLOCK_FAILURE) !== 0;
  const clockNotSynchronized = (quality & UTC_QUALITY_CLOCK_NOT_SYNCHRONIZED) !== 0;
  const accuracy = quality & UTC_QUALITY_ACCURACY_MASK;
  const qualityField: ParsedField = {
    id: `${idPrefix}-quality`,
    name: `${label} — TimeQuality`,
    offset: qualityOffset,
    length: 1,
    rawBytes: state.data.slice(qualityOffset, qualityOffset + 1),
    rawValue: quality,
    physicalValue: [
      `leapSecondsKnown=${leapSecondsKnown ? '1' : '0'}`,
      `clockFailure=${clockFailure ? '1' : '0'}`,
      `clockNotSynchronized=${clockNotSynchronized ? '1' : '0'}`,
      `accuracy=${String(accuracy)}`,
    ].join(', '),
    valid: true,
    warnings: [],
  };
  if (clockFailure || clockNotSynchronized) {
    // Zaman damgası taşınıyor ama yayıncı kendi saatine güvenmediğini söylüyor.
    qualityField.warnings.push(WARN_CLOCK_NOT_TRUSTWORTHY);
    state.warnings.push(WARN_CLOCK_NOT_TRUSTWORTHY);
  }
  state.fields.push(qualityField);
}

/** BIT STRING: ilk oktet KULLANILMAYAN bit sayısıdır (X.690 §8.6). */
function describeBitString(state: GooseDecodeState, valueOffset: number, valueLength: number): string {
  if (valueLength < 1) return '0 bits';
  const unusedBits = byteAt(state.data, valueOffset);
  const significantBits = Math.max(0, (valueLength - 1) * 8 - unusedBits);
  return `${String(significantBits)} bits (unused ${String(unusedBits)})`;
}

/**
 * FloatingPoint: 5 bayt = 1 bayt üs genişliği (8) + IEEE-754 single, BE.
 * Başka bir biçim (ör. 64-bit) çift teyitli DEĞİL → ham + uyarı.
 */
function decodeFloat(
  state: GooseDecodeState,
  valueOffset: number,
  valueLength: number,
): number | undefined {
  if (valueLength !== FLOAT_ENCODED_LENGTH) return undefined;
  if (byteAt(state.data, valueOffset) !== SINGLE_FLOAT_EXPONENT_BITS) return undefined;
  const view = new DataView(new ArrayBuffer(4));
  for (let index = 0; index < 4; index += 1) {
    view.setUint8(index, byteAt(state.data, valueOffset + 1 + index));
  }
  return view.getFloat32(0, false);
}

interface DataElementOutcome {
  /** Bu seviyede sayılan eleman adedi — numDatSetEntries ile karşılaştırılır. */
  readonly count: number;
  /** Yürüyüş BER hatasıyla mı bitti (üst seviye zinciri durdurur). */
  readonly failed: boolean;
}

/**
 * `allData` (ya da bir array/structure) içindeki Data elemanlarını yürür.
 * `end` üst TLV'nin sınırıdır; hiçbir çocuk onu aşamaz (`readBerTlv`in `limit`i).
 * Derinlik ve eleman bütçesi bozuk girdiye karşıdır — sağlam bir yayında asla
 * tetiklenmez.
 */
function decodeDataElements(
  state: GooseDecodeState,
  start: number,
  end: number,
  depth: number,
  idPrefix: string,
  label: string,
): DataElementOutcome {
  let cursor = start;
  let count = 0;

  while (cursor < end) {
    if (state.elementBudget <= 0) {
      state.warnings.push(WARN_DATA_ELEMENT_LIMIT);
      return { count, failed: false };
    }

    const tlv = readBerTlv(state.data, cursor, end);
    if (!tlv.ok) {
      pushBerError(state, tlv.error, tlv.offset, { region: label });
      return { count, failed: true };
    }

    state.elementBudget -= 1;
    const elementId = `${idPrefix}-${String(count)}`;
    const elementLabel = `${label}[${String(count)}]`;
    decodeDataElement(state, tlv, depth, elementId, elementLabel);
    count += 1;
    cursor = tlv.end;
  }

  return { count, failed: false };
}

/** TEK bir Data elemanı: tipini adlandırır, çözebiliyorsa değerini basar. */
function decodeDataElement(
  state: GooseDecodeState,
  tlv: BerTlv,
  depth: number,
  elementId: string,
  elementLabel: string,
): void {
  const definition = DATA_TYPES.get(tlv.tag.byte);
  const field: ParsedField = {
    id: elementId,
    name: definition === undefined ? elementLabel : `${elementLabel} — ${definition.name}`,
    offset: tlv.offset,
    length: tlv.end - tlv.offset,
    rawBytes: state.data.slice(tlv.offset, tlv.end),
    valid: definition !== undefined,
    warnings: [],
  };

  if (definition === undefined) {
    // Çift teyitli kümede olmayan tip ADLANDIRILMAZ (dosya başı).
    field.warnings.push(WARN_UNKNOWN_DATA_TYPE);
    state.warnings.push(WARN_UNKNOWN_DATA_TYPE);
    state.fields.push(field);
    return;
  }

  // Hangi eleman hangi Data Attribute'a karşılık geliyor — SCL'den gelir.
  field.warnings.push(WARN_DATA_SEMANTICS_NEED_SCL);
  state.warnings.push(WARN_DATA_SEMANTICS_NEED_SCL);
  state.fields.push(field);

  switch (definition.kind) {
    case 'nested': {
      if (depth + 1 >= MAX_DATA_DEPTH) {
        field.warnings.push(WARN_DATA_DEPTH_LIMIT);
        state.warnings.push(WARN_DATA_DEPTH_LIMIT);
        return;
      }
      decodeDataElements(state, tlv.valueOffset, tlv.end, depth + 1, elementId, elementLabel);
      return;
    }
    case 'boolean': {
      const decoded = decodeBerBoolean(state.data, tlv.valueOffset, tlv.length);
      if (!decoded.ok) {
        field.warnings.push(WARN_VALUE_NOT_DECODABLE);
        state.warnings.push(WARN_VALUE_NOT_DECODABLE);
        return;
      }
      field.rawValue = decoded.value ? 1 : 0;
      field.physicalValue = decoded.value ? 'TRUE' : 'FALSE';
      return;
    }
    case 'integer': {
      const decoded = decodeBerInteger(state.data, tlv.valueOffset, tlv.length);
      if (!decoded.ok) {
        field.warnings.push(WARN_VALUE_NOT_DECODABLE);
        state.warnings.push(WARN_VALUE_NOT_DECODABLE);
        return;
      }
      field.rawValue = decoded.value;
      return;
    }
    case 'bit-string': {
      field.physicalValue = describeBitString(state, tlv.valueOffset, tlv.length);
      return;
    }
    case 'float': {
      const value = decodeFloat(state, tlv.valueOffset, tlv.length);
      if (value === undefined) {
        field.warnings.push(WARN_VALUE_NOT_DECODABLE);
        state.warnings.push(WARN_VALUE_NOT_DECODABLE);
        return;
      }
      field.physicalValue = value;
      return;
    }
    case 'visible-string': {
      const decoded = decodeBerVisibleString(state.data, tlv.valueOffset, tlv.length);
      if (!decoded.ok) {
        field.warnings.push(WARN_VALUE_NOT_DECODABLE);
        state.warnings.push(WARN_VALUE_NOT_DECODABLE);
        return;
      }
      if (!decoded.printable) {
        field.warnings.push(WARN_NON_PRINTABLE_STRING);
        state.warnings.push(WARN_NON_PRINTABLE_STRING);
        return;
      }
      field.physicalValue = decoded.text;
      return;
    }
    case 'utc-time': {
      decodeUtcTime(state, elementId, elementLabel, tlv.valueOffset, tlv.length, field);
      return;
    }
    case 'raw':
    default: {
      // Tip ADLANDIRILDI ama değeri bu dalgada çözülmüyor — ham kalır.
      field.unit = 'B';
      return;
    }
  }
}

interface PduOutcome {
  readonly stNum: bigint | undefined;
  readonly sqNum: bigint | undefined;
  readonly goId: string | undefined;
  readonly dataSetEntryCount: number;
}

/**
 * `goosePdu` gövdesini yürür. Alanlar TEL SIRASIYLA okunur ve ETİKETE göre
 * adlandırılır — konuma göre değil: `goID`/`simulation`/`ndsCom` ASN.1'de
 * opsiyoneldir, konum saymak ilk eksik alandan sonra her şeyi kaydırırdı.
 */
function decodePduBody(state: GooseDecodeState, start: number, end: number): PduOutcome {
  let cursor = start;
  let fieldCount = 0;
  let stNum: bigint | undefined;
  let sqNum: bigint | undefined;
  let goId: string | undefined;
  let declaredEntries: bigint | undefined;
  let dataSetEntryCount = 0;
  let allDataSeen = false;
  const seenTags = new Set<number>();

  while (cursor < end && fieldCount < MAX_PDU_FIELDS) {
    const tlv = readBerTlv(state.data, cursor, end);
    if (!tlv.ok) {
      pushBerError(state, tlv.error, tlv.offset, { region: 'goosePdu' });
      break;
    }
    fieldCount += 1;
    seenTags.add(tlv.tag.byte);

    const definition = PDU_FIELDS.get(tlv.tag.byte);
    if (definition === undefined) {
      const isSecurity =
        tlv.tag.tagClass === 'context-specific' && tlv.tag.number === SECURITY_TAG_NUMBER;
      // Karar 8: imzalı/şifreli içerik ÇÖZÜLMEZ — ham + işaret.
      const warningKey = isSecurity ? WARN_SECURITY_NOT_DECODED : WARN_UNKNOWN_PDU_FIELD;
      state.fields.push(
        rawField(
          state,
          isSecurity ? 'security' : `pdu-field-${formatHex(tlv.tag.byte, 2)}`,
          isSecurity ? 'security' : `Unknown field ${formatHex(tlv.tag.byte, 2)}`,
          tlv.offset,
          tlv.end - tlv.offset,
          [warningKey],
        ),
      );
      state.warnings.push(warningKey);
      cursor = tlv.end;
      continue;
    }

    const field: ParsedField = {
      id: definition.id,
      name: definition.name,
      offset: tlv.offset,
      length: tlv.end - tlv.offset,
      rawBytes: state.data.slice(tlv.offset, tlv.end),
      valid: true,
      warnings: [],
    };
    if (definition.unit !== undefined) field.unit = definition.unit;
    state.fields.push(field);

    switch (definition.kind) {
      case 'visible-string': {
        const decoded = decodeBerVisibleString(state.data, tlv.valueOffset, tlv.length);
        if (!decoded.ok) {
          field.warnings.push(WARN_VALUE_NOT_DECODABLE);
          state.warnings.push(WARN_VALUE_NOT_DECODABLE);
          break;
        }
        if (!decoded.printable) {
          field.warnings.push(WARN_NON_PRINTABLE_STRING);
          state.warnings.push(WARN_NON_PRINTABLE_STRING);
          break;
        }
        field.rawValue = decoded.text;
        if (definition.id === 'go-id') goId = decoded.text;
        break;
      }
      case 'integer': {
        const decoded = decodeBerInteger(state.data, tlv.valueOffset, tlv.length);
        if (!decoded.ok) {
          field.warnings.push(WARN_VALUE_NOT_DECODABLE);
          state.warnings.push(WARN_VALUE_NOT_DECODABLE);
          break;
        }
        field.rawValue = decoded.value;
        if (definition.id === 'st-num') stNum = decoded.value;
        if (definition.id === 'sq-num') sqNum = decoded.value;
        if (definition.id === 'num-dat-set-entries') declaredEntries = decoded.value;
        break;
      }
      case 'boolean': {
        const decoded = decodeBerBoolean(state.data, tlv.valueOffset, tlv.length);
        if (!decoded.ok) {
          field.warnings.push(WARN_VALUE_NOT_DECODABLE);
          state.warnings.push(WARN_VALUE_NOT_DECODABLE);
          break;
        }
        field.rawValue = decoded.value ? 1 : 0;
        field.physicalValue = decoded.value ? 'TRUE' : 'FALSE';
        if (decoded.value && definition.id === 'simulation') {
          // Test/simülasyon yayını: koruma cihazları bunu gerçek olay saymaz.
          field.warnings.push(WARN_SIMULATION_ACTIVE);
          state.warnings.push(WARN_SIMULATION_ACTIVE);
        }
        if (decoded.value && definition.id === 'nds-com') {
          field.warnings.push(WARN_NEEDS_COMMISSIONING);
          state.warnings.push(WARN_NEEDS_COMMISSIONING);
        }
        break;
      }
      case 'utc-time': {
        decodeUtcTime(state, definition.id, definition.name, tlv.valueOffset, tlv.length, field);
        break;
      }
      case 'all-data': {
        allDataSeen = true;
        const outcome = decodeDataElements(
          state,
          tlv.valueOffset,
          tlv.end,
          0,
          'data',
          definition.name,
        );
        dataSetEntryCount = outcome.count;
        field.rawValue = outcome.count;
        break;
      }
    }

    cursor = tlv.end;
  }

  if (fieldCount >= MAX_PDU_FIELDS) {
    state.warnings.push(WARN_UNKNOWN_PDU_FIELD);
  }

  for (const [tagByte, definition] of PDU_FIELDS) {
    if (definition.mandatory && !seenTags.has(tagByte)) {
      state.warnings.push(WARN_MISSING_MANDATORY_FIELD);
      break;
    }
  }

  // numDatSetEntries dataset'te KAÇ eleman olması gerektiğini söyler; sayı
  // tutmuyorsa yayıncı ile abonenin konfigürasyonu ayrışmış demektir.
  if (allDataSeen && declaredEntries !== undefined && declaredEntries !== BigInt(dataSetEntryCount)) {
    state.warnings.push(WARN_DATA_SET_COUNT_MISMATCH);
  }

  return { stNum, sqNum, goId, dataSetEntryCount };
}

function parseGooseFrame(data: Uint8Array, options: GooseParseOptions): ParseResult {
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

  if (data.length < MIN_HEADER_LENGTH + GOOSE_HEADER_LENGTH) {
    return fail({
      code: 'truncated-frame',
      message: ERROR_FRAME_TOO_SHORT,
      recoverable: true,
      offset: 0,
      length: data.length,
      details: {
        availableBytes: data.length,
        requiredBytes: MIN_HEADER_LENGTH + GOOSE_HEADER_LENGTH,
      },
    });
  }

  const state: GooseDecodeState = {
    data,
    fields: [],
    warnings: new WarningSink(),
    errors: [],
    elementBudget: MAX_DATA_ELEMENTS,
  };
  const summaryParams: Record<string, string> = {};

  const destinationBytes = data.slice(0, MAC_LENGTH);
  const destinationMac = formatMac(destinationBytes);
  const inGooseRange = GOOSE_MULTICAST_PREFIX.every(
    (octet, index) => byteAt(destinationBytes, index) === octet,
  );
  const destinationField: ParsedField = {
    id: 'destination-mac',
    name: 'Destination MAC',
    offset: 0,
    length: MAC_LENGTH,
    rawBytes: destinationBytes,
    rawValue: destinationMac,
    // Aralık dışı olmak GEÇERSİZ değildir (yönlendirilmiş/tekil kurulumlar var);
    // yalnız bilgi notu basılır — uyarı değil hata hiç değil.
    physicalValue: inGooseRange
      ? `${classifyDestinationMac(destinationBytes)} — IEC/TC57 GOOSE range (01:0C:CD:01:xx:xx)`
      : classifyDestinationMac(destinationBytes),
    valid: true,
    warnings: [],
  };
  if (!inGooseRange) {
    destinationField.warnings.push(WARN_DESTINATION_NOT_GOOSE_RANGE);
    state.warnings.push(WARN_DESTINATION_NOT_GOOSE_RANGE);
  }
  state.fields.push(destinationField);

  const sourceBytes = data.slice(MAC_LENGTH, MAC_LENGTH * 2);
  const sourceMac = formatMac(sourceBytes);
  state.fields.push({
    id: 'source-mac',
    name: 'Source MAC',
    offset: MAC_LENGTH,
    length: MAC_LENGTH,
    rawBytes: sourceBytes,
    rawValue: sourceMac,
    valid: true,
    warnings: [],
  });
  summaryParams['destinationMac'] = destinationMac;

  // VLAN'lı varyant dalga 4a'nın TPID/TCI yürüyüşüyle çözülür (karar 5).
  const chainWarnings: string[] = [];
  const chain = walkTypeLengthChain(data, MAC_LENGTH * 2, state.fields, chainWarnings, state.errors);
  for (const key of chainWarnings) state.warnings.push(key);

  const etherType = chain.finalValue;
  if (etherType === undefined) {
    // walkTypeLengthChain zaten hatayı bastı (kesik tip alanı / kesik VLAN tag).
    return buildResult(state, options, {
      appId: undefined,
      stNum: undefined,
      sqNum: undefined,
      dataSetEntryCount: 0,
      summaryKey: SUMMARY_NOT_GOOSE,
      summaryParams,
    });
  }

  const etherTypeOffset = chain.cursor - TYPE_LENGTH_FIELD_LENGTH;
  const etherTypeMatches = etherType === GOOSE_ETHER_TYPE;
  state.fields.push({
    id: 'ethertype',
    name: 'EtherType',
    offset: etherTypeOffset,
    length: TYPE_LENGTH_FIELD_LENGTH,
    rawBytes: data.slice(etherTypeOffset, chain.cursor),
    rawValue: etherType,
    physicalValue: etherTypeMatches ? 'GOOSE' : formatHex(etherType, 4),
    valid: etherTypeMatches,
    warnings: etherTypeMatches ? [] : [ERROR_ETHER_TYPE_NOT_GOOSE],
  });

  if (!etherTypeMatches) {
    // Bu çerçeve GOOSE DEĞİL. Ethernet alanları çözüldü, gövdeye DOKUNULMAZ —
    // yanlış EtherType'ta BER yürümek sessiz-yanlış çözümlemenin ta kendisi
    // olurdu (EtherCAT 5d ile aynı davranış).
    state.errors.push({
      code: 'start-delimiter-not-found',
      message: ERROR_ETHER_TYPE_NOT_GOOSE,
      offset: etherTypeOffset,
      length: TYPE_LENGTH_FIELD_LENGTH,
      details: { etherType: formatHex(etherType, 4), expected: formatHex(GOOSE_ETHER_TYPE, 4) },
    });
    const payload = data.slice(chain.cursor);
    if (payload.length > 0) {
      state.fields.push(
        rawField(state, 'payload', 'Payload', chain.cursor, payload.length, [
          ERROR_ETHER_TYPE_NOT_GOOSE,
        ]),
      );
    }
    summaryParams['etherType'] = formatHex(etherType, 4);
    return buildResult(state, options, {
      appId: undefined,
      stNum: undefined,
      sqNum: undefined,
      dataSetEntryCount: 0,
      summaryKey: SUMMARY_NOT_GOOSE,
      summaryParams,
    });
  }

  const headerOffset = chain.cursor;
  if (data.length - headerOffset < GOOSE_HEADER_LENGTH) {
    state.errors.push({
      code: 'truncated-frame',
      message: ERROR_HEADER_TRUNCATED,
      offset: headerOffset,
      length: data.length - headerOffset,
    });
    return buildResult(state, options, {
      appId: undefined,
      stNum: undefined,
      sqNum: undefined,
      dataSetEntryCount: 0,
      summaryKey: SUMMARY_PDU_UNREADABLE,
      summaryParams,
    });
  }

  const appIdOffset = headerOffset + APPID_OFFSET_IN_HEADER;
  const appId = readUint16BE(data, appIdOffset);
  state.fields.push({
    id: 'appid',
    name: 'APPID',
    offset: appIdOffset,
    length: WORD_LENGTH,
    rawBytes: data.slice(appIdOffset, appIdOffset + WORD_LENGTH),
    rawValue: appId,
    physicalValue: formatHex(appId, 4),
    valid: true,
    warnings: [],
  });
  summaryParams['appId'] = formatHex(appId, 4);

  // TUZAK: Length Ethernet başlığını SAYMAZ; APPID'den itibaren 8 + APDU'dur
  // (libIEC61850 `apduLength = length - 8`).
  const lengthOffset = headerOffset + LENGTH_OFFSET_IN_HEADER;
  const declaredLength = readUint16BE(data, lengthOffset);
  const availableFromAppId = data.length - appIdOffset;
  const lengthField: ParsedField = {
    id: 'goose-length',
    name: 'Length',
    offset: lengthOffset,
    length: WORD_LENGTH,
    rawBytes: data.slice(lengthOffset, lengthOffset + WORD_LENGTH),
    rawValue: declaredLength,
    // Ne saydığını alanın kendisi söylesin — off-by-one'ı ekranda görünür kılar.
    physicalValue: `header 8 + APDU ${String(declaredLength - GOOSE_HEADER_LENGTH)}`,
    unit: 'B',
    valid: true,
    warnings: [],
  };
  state.fields.push(lengthField);

  const reserved1Offset = headerOffset + RESERVED1_OFFSET_IN_HEADER;
  const reserved1 = readUint16BE(data, reserved1Offset);
  const reserved1Field: ParsedField = {
    id: 'reserved1',
    name: 'Reserved 1',
    offset: reserved1Offset,
    length: WORD_LENGTH,
    rawBytes: data.slice(reserved1Offset, reserved1Offset + WORD_LENGTH),
    rawValue: reserved1,
    physicalValue: formatHex(reserved1, 4),
    valid: true,
    warnings: [],
  };
  if (reserved1 !== 0) {
    // Bit 15 tek kaynakta "Simulated" — ADLANDIRILMIYOR (dosya başı, karar 2).
    reserved1Field.warnings.push(WARN_RESERVED_NOT_ZERO);
    state.warnings.push(WARN_RESERVED_NOT_ZERO);
  }
  state.fields.push(reserved1Field);

  const reserved2Offset = headerOffset + RESERVED2_OFFSET_IN_HEADER;
  const reserved2 = readUint16BE(data, reserved2Offset);
  const reserved2Field: ParsedField = {
    id: 'reserved2',
    name: 'Reserved 2',
    offset: reserved2Offset,
    length: WORD_LENGTH,
    rawBytes: data.slice(reserved2Offset, reserved2Offset + WORD_LENGTH),
    rawValue: reserved2,
    physicalValue: formatHex(reserved2, 4),
    valid: true,
    warnings: [],
  };
  if (reserved2 !== 0) {
    reserved2Field.warnings.push(WARN_RESERVED_NOT_ZERO);
    state.warnings.push(WARN_RESERVED_NOT_ZERO);
  }
  state.fields.push(reserved2Field);

  const apduOffset = headerOffset + GOOSE_HEADER_LENGTH;
  if (declaredLength < GOOSE_HEADER_LENGTH) {
    lengthField.valid = false;
    state.errors.push({
      code: 'length-mismatch',
      message: ERROR_LENGTH_BELOW_HEADER,
      offset: lengthOffset,
      length: WORD_LENGTH,
      details: { declaredLength, minimum: GOOSE_HEADER_LENGTH },
    });
    return buildResult(state, options, {
      appId,
      stNum: undefined,
      sqNum: undefined,
      dataSetEntryCount: 0,
      summaryKey: SUMMARY_PDU_UNREADABLE,
      summaryParams,
    });
  }

  if (declaredLength > availableFromAppId) {
    state.errors.push({
      code: 'truncated-frame',
      message: ERROR_APDU_TRUNCATED,
      offset: apduOffset,
      length: Math.max(0, data.length - apduOffset),
      details: { declaredLength, availableBytes: availableFromAppId },
    });
  }
  // Sınır DAİMA telde gerçekten olanla kesişir: uzunluk alanı yalan söylese de
  // arabelleğin dışına taşan bir BER yürüyüşü başlatılmaz.
  const apduEnd = appIdOffset + Math.min(declaredLength, availableFromAppId);

  if (apduEnd <= apduOffset) {
    state.errors.push({
      code: 'truncated-frame',
      message: ERROR_APDU_TRUNCATED,
      offset: apduOffset,
      length: 0,
      details: { declaredLength, availableBytes: availableFromAppId },
    });
    return buildResult(state, options, {
      appId,
      stNum: undefined,
      sqNum: undefined,
      dataSetEntryCount: 0,
      summaryKey: SUMMARY_PDU_UNREADABLE,
      summaryParams,
    });
  }

  const pduTlv = readBerTlv(data, apduOffset, apduEnd);
  if (!pduTlv.ok) {
    pushBerError(state, pduTlv.error, pduTlv.offset, { region: 'APDU' });
    state.fields.push(
      rawField(state, 'apdu', 'APDU', apduOffset, apduEnd - apduOffset, [
        BER_ERROR_MAP[pduTlv.error].message,
      ]),
    );
    return buildResult(state, options, {
      appId,
      stNum: undefined,
      sqNum: undefined,
      dataSetEntryCount: 0,
      summaryKey: SUMMARY_PDU_UNREADABLE,
      summaryParams,
    });
  }

  const isGoosePdu = pduTlv.tag.byte === GOOSE_PDU_TAG;
  const isManagementPdu = pduTlv.tag.byte === GSE_MNGT_PDU_TAG;
  const pduField: ParsedField = {
    id: 'goose-pdu',
    name: 'goosePdu',
    offset: pduTlv.offset,
    length: pduTlv.headerLength,
    rawBytes: data.slice(pduTlv.offset, pduTlv.valueOffset),
    rawValue: pduTlv.tag.byte,
    physicalValue: isGoosePdu
      ? 'APPLICATION 1 (goosePdu)'
      : isManagementPdu
        ? 'APPLICATION 0 (gseMngtPdu)'
        : formatHex(pduTlv.tag.byte, 2),
    valid: isGoosePdu,
    warnings: [],
  };
  state.fields.push(pduField);

  if (!isGoosePdu) {
    // gseMngtPdu aynı EtherType'ı paylaşır ama BAŞKA bir yapıdır; bu motor onu
    // çözmez (spec'in GOOSE alan ağacı dışında). Ham + uyarı.
    const warningKey = isManagementPdu ? WARN_GSE_MANAGEMENT_PDU : ERROR_PDU_TAG_NOT_GOOSE;
    pduField.warnings.push(warningKey);
    state.warnings.push(warningKey);
    if (!isManagementPdu) {
      state.errors.push({
        code: 'start-delimiter-not-found',
        message: ERROR_PDU_TAG_NOT_GOOSE,
        offset: pduTlv.offset,
        length: 1,
        details: { tag: formatHex(pduTlv.tag.byte, 2), expected: formatHex(GOOSE_PDU_TAG, 2) },
      });
    }
    state.fields.push(
      rawField(state, 'pdu-body', 'PDU Body', pduTlv.valueOffset, pduTlv.length, [warningKey]),
    );
    appendTrailing(state, pduTlv.end, apduEnd);
    return buildResult(state, options, {
      appId,
      stNum: undefined,
      sqNum: undefined,
      dataSetEntryCount: 0,
      summaryKey: isManagementPdu ? SUMMARY_MANAGEMENT : SUMMARY_PDU_UNREADABLE,
      summaryParams,
    });
  }

  const outcome = decodePduBody(state, pduTlv.valueOffset, pduTlv.end);
  appendTrailing(state, pduTlv.end, apduEnd);
  appendPadding(state, apduEnd);

  summaryParams['goId'] = outcome.goId ?? formatHex(appId, 4);
  summaryParams['stNum'] = outcome.stNum === undefined ? '?' : outcome.stNum.toString();
  summaryParams['sqNum'] = outcome.sqNum === undefined ? '?' : outcome.sqNum.toString();
  summaryParams['entryCount'] = String(outcome.dataSetEntryCount);

  return buildResult(state, options, {
    appId,
    stNum: outcome.stNum?.toString(),
    sqNum: outcome.sqNum?.toString(),
    dataSetEntryCount: outcome.dataSetEntryCount,
    summaryKey: SUMMARY_PUBLICATION,
    summaryParams,
  });
}

/** APDU bölgesi içinde PDU'dan sonra kalan baytlar — Length fazla söylemiş. */
function appendTrailing(state: GooseDecodeState, offset: number, apduEnd: number): void {
  if (offset >= apduEnd) return;
  state.fields.push(
    rawField(state, 'apdu-trailing', 'APDU Trailing Bytes', offset, apduEnd - offset, [
      WARN_TRAILING_BYTES,
    ]),
  );
  state.warnings.push(WARN_TRAILING_BYTES);
}

/**
 * APDU'dan sonra kalan baytlar Ethernet'in 60 baytlık asgari çerçeve boyu için
 * eklenen DOLGUdur. Sıfırdan farklıysa uyarı: dolgu olmayan bir şeyi dolgu diye
 * göstermemek için (EtherCAT emsali).
 */
function appendPadding(state: GooseDecodeState, offset: number): void {
  if (offset >= state.data.length) return;
  const padding = state.data.slice(offset);
  const field = rawField(state, 'padding', 'Padding', offset, padding.length, []);
  if (padding.some((byte) => byte !== 0)) {
    field.warnings.push(WARN_PADDING_NOT_ZERO);
    state.warnings.push(WARN_PADDING_NOT_ZERO);
  }
  state.fields.push(field);
}

function buildResult(
  state: GooseDecodeState,
  options: GooseParseOptions,
  metadata: GooseFrameMetadata,
): ParseResult {
  const rawFrame = createRawFrame(state.data, {
    ...(options.timestamp === undefined ? {} : { timestamp: options.timestamp }),
    ...(options.direction === undefined ? {} : { direction: options.direction }),
    ...(options.channel === undefined ? {} : { channel: options.channel }),
    metadata,
  });

  const frame: ParsedFrame = {
    protocol: PROTOCOL_ID,
    timestamp: rawFrame.timestamp,
    rawFrame,
    fields: state.fields,
    valid: state.errors.length === 0,
    errors: state.errors,
    warnings: state.warnings.warnings,
  };

  // Girdi TAM bir Ethernet çerçevesidir: tampon bölünmez, hepsi tüketilir.
  return { success: true, frame, consumedBytes: state.data.length };
}

export function parseGoose(data: Uint8Array): ParseResult {
  return parseGooseFrame(data, {});
}

export const gooseParser: ProtocolParser = {
  protocolId: PROTOCOL_ID,
  displayName: PROTOCOL_DISPLAY_NAME,

  /**
   * Ucuz ön eleme: asgari uzunluk + EtherType 0x88B8. VLAN'lı varyantta tip
   * alanı bir tag kadar (4 bayt) ileridedir; tek tag'e kadar bakılır, ötesi tam
   * çözüme bırakılır (`canParse` O(1) kalmalı, spec §7).
   */
  canParse(data: Uint8Array): boolean {
    if (data.length < MIN_HEADER_LENGTH + GOOSE_HEADER_LENGTH) return false;
    const first = readUint16BE(data, MAC_LENGTH * 2);
    if (first === GOOSE_ETHER_TYPE) return true;
    if (first !== VLAN_TPID) return false;
    if (data.length < MIN_HEADER_LENGTH + VLAN_TAG_LENGTH + GOOSE_HEADER_LENGTH) return false;
    return readUint16BE(data, MAC_LENGTH * 2 + VLAN_TAG_LENGTH) === GOOSE_ETHER_TYPE;
  },

  parse(data: Uint8Array, context?: ParseContext): ParseResult {
    const options: GooseParseOptions = {};
    if (context?.timestamp !== undefined) options.timestamp = context.timestamp;
    if (context?.direction !== undefined) options.direction = context.direction;
    if (context?.channel !== undefined) options.channel = context.channel;
    if (context?.maxFrameLength !== undefined) options.maxFrameLength = context.maxFrameLength;
    if (context?.signal !== undefined) options.signal = context.signal;
    return parseGooseFrame(data, options);
  },
};

// ── Örnek çerçeveler ────────────────────────────────────────────────────────
// Çerçeveler ELLE değil YAPIYA göre kurulur; kodlayıcı yardımcıları YALNIZ
// örnekler içindir (bu motor decode-only'dir, Packet Builder ayrı yoldur).
// Testler bu baytların hex'ini BAĞIMSIZ elle hesaplanmış vektörle karşılaştırır
// (UBX 3c emsali) — yani örnekler motorun kendi çözücüsüyle doğrulanmış olmaz.

/** Sentetik ama yapısal olarak gerçekçi: IEC/TC57 GOOSE multicast aralığı. */
const DESTINATION_MAC = [0x01, 0x0c, 0xcd, 0x01, 0x00, 0x01];
const SOURCE_MAC = [0x00, 0x21, 0xc1, 0x25, 0x1f, 0x64];
const ETHER_TYPE_BYTES = [0x88, 0xb8];

/** Kısa form 127 bayta kadar; üstünde tek oktetlik uzun form (0x81 LL). */
function tlv(tagByte: number, value: readonly number[]): number[] {
  if (value.length < 0x80) return [tagByte, value.length, ...value];
  return [tagByte, 0x81, value.length, ...value];
}

function visibleString(text: string): number[] {
  return Array.from(text, (character) => character.charCodeAt(0));
}

/**
 * BER INTEGER, negatif olmayan değer: minimal oktet + gerekirse 0x00 işaret
 * öneki (`00 FF` = 255, -1 değil — decodeBerInteger'ın tuzak notu).
 */
function integerValue(value: number): number[] {
  const octets: number[] = [];
  let remaining = value;
  do {
    octets.unshift(remaining & 0xff);
    remaining = Math.floor(remaining / 0x100);
  } while (remaining > 0);
  if (((octets[0] ?? 0) & 0x80) !== 0) octets.unshift(0x00);
  return octets;
}

function booleanValue(value: boolean): number[] {
  return [value ? 0xff : 0x00];
}

/** 8 bayt: SecondSinceEpoch(4, BE) + FractionOfSecond(3) + TimeQuality(1). */
function utcTimeValue(secondsSinceEpoch: number, fraction: number, quality: number): number[] {
  return [
    (secondsSinceEpoch >>> 24) & 0xff,
    (secondsSinceEpoch >>> 16) & 0xff,
    (secondsSinceEpoch >>> 8) & 0xff,
    secondsSinceEpoch & 0xff,
    (fraction >>> 16) & 0xff,
    (fraction >>> 8) & 0xff,
    fraction & 0xff,
    quality,
  ];
}

/** IEEE-754 single, üs genişliği öneki ile (5 bayt). */
function floatValue(value: number): number[] {
  const view = new DataView(new ArrayBuffer(4));
  view.setFloat32(0, value, false);
  return [SINGLE_FLOAT_EXPONENT_BITS, ...Array.from(new Uint8Array(view.buffer))];
}

/** BIT STRING: ilk oktet kullanılmayan bit sayısı (13 bitlik Quality → 3). */
function bitStringValue(unusedBits: number, octets: readonly number[]): number[] {
  return [unusedBits, ...octets];
}

interface GooseExampleInit {
  readonly pdu: readonly number[];
  readonly appId?: number;
  readonly reserved1?: number;
  readonly destinationMac?: readonly number[];
  readonly vlanTci?: number;
  readonly etherType?: readonly number[];
  readonly padTo?: number;
}

function buildExampleFrame(init: GooseExampleInit): Uint8Array {
  const bytes: number[] = [...(init.destinationMac ?? DESTINATION_MAC), ...SOURCE_MAC];
  if (init.vlanTci !== undefined) {
    bytes.push(0x81, 0x00, (init.vlanTci >>> 8) & 0xff, init.vlanTci & 0xff);
  }
  bytes.push(...(init.etherType ?? ETHER_TYPE_BYTES));

  const appId = init.appId ?? 0x0001;
  const reserved1 = init.reserved1 ?? 0x0000;
  const gooseLength = GOOSE_HEADER_LENGTH + init.pdu.length;
  bytes.push((appId >>> 8) & 0xff, appId & 0xff);
  bytes.push((gooseLength >>> 8) & 0xff, gooseLength & 0xff);
  bytes.push((reserved1 >>> 8) & 0xff, reserved1 & 0xff);
  bytes.push(0x00, 0x00);
  bytes.push(...init.pdu);

  if (init.padTo !== undefined) {
    while (bytes.length < init.padTo) bytes.push(0x00);
  }
  return Uint8Array.from(bytes);
}

/**
 * Referanslar gerçek kurulumlardaki kadar uzun tutuldu (IED adı + mantıksal
 * düğüm + kontrol bloğu). Yan etkisi kasıtlı: goosePdu'nun gövdesi 127 baytı
 * aşar ve UZUN FORM BER uzunluğu (0x81 LL) örneklerde gerçekten koşar.
 */
const GOCB_REF = 'ALP_SubstationIED/LLN0$GO$gcbProtectionEvents';
const DAT_SET = 'ALP_SubstationIED/LLN0$ProtectionEvents';
const GO_ID = 'ALP_ProtectionEvents';
/** 2026-02-16T12:00:00Z — örneklerde sabit, böylece hex'i testte tekrar kurulabilir. */
const EXAMPLE_SECONDS = 1771243200;
/** 2²³ = tam yarım saniye (kesir 2⁻²⁴ birimlidir). */
const EXAMPLE_FRACTION = 0x800000;
/** leapSecondsKnown=1, doğruluk 10 bit (libIEC61850'nin varsayılanı 0x0A). */
const EXAMPLE_QUALITY = 0x8a;

/** Ortak PDU gövdesi — yalnız durum sayaçları ve dataset değişir. */
function publicationPdu(init: {
  readonly stNum: number;
  readonly sqNum: number;
  readonly entriesDeclared: number;
  readonly allData: readonly number[];
  readonly simulation?: boolean;
}): number[] {
  return tlv(GOOSE_PDU_TAG, [
    ...tlv(0x80, visibleString(GOCB_REF)),
    ...tlv(0x81, integerValue(2000)),
    ...tlv(0x82, visibleString(DAT_SET)),
    ...tlv(0x83, visibleString(GO_ID)),
    ...tlv(0x84, utcTimeValue(EXAMPLE_SECONDS, EXAMPLE_FRACTION, EXAMPLE_QUALITY)),
    ...tlv(0x85, integerValue(init.stNum)),
    ...tlv(0x86, integerValue(init.sqNum)),
    ...tlv(0x87, booleanValue(init.simulation ?? false)),
    ...tlv(0x88, integerValue(1)),
    ...tlv(0x89, booleanValue(false)),
    ...tlv(0x8a, integerValue(init.entriesDeclared)),
    ...tlv(ALL_DATA_TAG, init.allData),
  ]);
}

/** Dört elemanlı tipik trip dataset'i: durum + kalite + sayaç + ikinci durum. */
const STEADY_DATA = [
  ...tlv(0x83, booleanValue(false)),
  ...tlv(0x84, bitStringValue(3, [0x00, 0x00])),
  ...tlv(0x85, integerValue(42)),
  ...tlv(0x83, booleanValue(false)),
];
/** Aynı dataset, ilk durum TRUE — stNum'ı artıran olay budur. */
const TRIPPED_DATA = [
  ...tlv(0x83, booleanValue(true)),
  ...tlv(0x84, bitStringValue(3, [0x00, 0x00])),
  ...tlv(0x85, integerValue(43)),
  ...tlv(0x83, booleanValue(false)),
];
/** İç içe structure + ölçüm: float ve utc-time aynı ağaçta. */
const STRUCTURED_DATA = [
  ...tlv(0xa2, [...tlv(0x87, floatValue(230.5)), ...tlv(0x84, bitStringValue(3, [0x00, 0x00]))]),
  ...tlv(0x91, utcTimeValue(EXAMPLE_SECONDS, EXAMPLE_FRACTION, EXAMPLE_QUALITY)),
];

const EXAMPLE_FRAMES: ExampleFrame[] = [
  {
    id: 'steady-state-publication',
    name: 'protocol.goose.example.steadyStatePublication.name',
    bytes: buildExampleFrame({
      appId: 0x0001,
      pdu: publicationPdu({ stNum: 1, sqNum: 12, entriesDeclared: 4, allData: STEADY_DATA }),
    }),
    description: 'protocol.goose.example.steadyStatePublication.description',
    expectedValid: true,
  },
  {
    id: 'vlan-tagged-publication',
    name: 'protocol.goose.example.vlanTaggedPublication.name',
    bytes: buildExampleFrame({
      appId: 0x1001,
      // PCP=4 (61850 yayınlarının alışılmış önceliği), VID=0 → priority-tagged.
      vlanTci: 0x8000,
      pdu: publicationPdu({ stNum: 1, sqNum: 13, entriesDeclared: 4, allData: STEADY_DATA }),
    }),
    description: 'protocol.goose.example.vlanTaggedPublication.description',
    expectedValid: true,
  },
  {
    id: 'state-change-publication',
    name: 'protocol.goose.example.stateChangePublication.name',
    bytes: buildExampleFrame({
      appId: 0x0001,
      pdu: publicationPdu({ stNum: 2, sqNum: 0, entriesDeclared: 4, allData: TRIPPED_DATA }),
    }),
    description: 'protocol.goose.example.stateChangePublication.description',
    expectedValid: true,
  },
  {
    id: 'structured-dataset',
    name: 'protocol.goose.example.structuredDataset.name',
    bytes: buildExampleFrame({
      appId: 0x0002,
      pdu: publicationPdu({ stNum: 5, sqNum: 1, entriesDeclared: 2, allData: STRUCTURED_DATA }),
    }),
    description: 'protocol.goose.example.structuredDataset.description',
    expectedValid: true,
  },
  {
    id: 'simulated-publication',
    name: 'protocol.goose.example.simulatedPublication.name',
    bytes: buildExampleFrame({
      appId: 0x0001,
      // Reserved1 sıfır değil: bit 15 tek kaynakta "Simulated" — ham + uyarı.
      reserved1: RESERVED1_SINGLE_SOURCE_BIT,
      pdu: publicationPdu({
        stNum: 3,
        sqNum: 0,
        entriesDeclared: 4,
        allData: TRIPPED_DATA,
        simulation: true,
      }),
    }),
    description: 'protocol.goose.example.simulatedPublication.description',
    expectedValid: true,
  },
  {
    id: 'dataset-count-mismatch',
    name: 'protocol.goose.example.dataSetCountMismatch.name',
    bytes: buildExampleFrame({
      appId: 0x0001,
      // numDatSetEntries 4 diyor ama dataset'te 2 eleman var → uyarı yolu.
      pdu: publicationPdu({
        stNum: 1,
        sqNum: 14,
        entriesDeclared: 4,
        allData: [...tlv(0x83, booleanValue(true)), ...tlv(0x85, integerValue(7))],
      }),
    }),
    description: 'protocol.goose.example.dataSetCountMismatch.description',
    expectedValid: true,
  },
  {
    id: 'indefinite-length-ber',
    name: 'protocol.goose.example.indefiniteLengthBer.name',
    bytes: buildExampleFrame({
      appId: 0x0001,
      // Dataset'in ilk elemanı 0x80 uzunluk okteti taşıyor: BER'de "belirsiz
      // uzunluk", GOOSE/DER'de YASAK → net hata, sessiz yanlış okuma değil.
      pdu: publicationPdu({
        stNum: 1,
        sqNum: 15,
        entriesDeclared: 1,
        allData: [0x83, 0x80, 0xff, 0x00, 0x00],
      }),
    }),
    description: 'protocol.goose.example.indefiniteLengthBer.description',
    expectedValid: false,
  },
  {
    id: 'ethertype-not-goose',
    name: 'protocol.goose.example.etherTypeNotGoose.name',
    bytes: buildExampleFrame({
      appId: 0x0001,
      etherType: [0x08, 0x00],
      pdu: publicationPdu({ stNum: 1, sqNum: 12, entriesDeclared: 4, allData: STEADY_DATA }),
    }),
    description: 'protocol.goose.example.etherTypeNotGoose.description',
    expectedValid: false,
  },
  {
    id: 'frame-too-short',
    name: 'protocol.goose.example.frameTooShort.name',
    // 16 bayt: Ethernet başlığı var ama 8 baytlık GOOSE başlığı tamamlanmıyor.
    bytes: Uint8Array.from([...DESTINATION_MAC, ...SOURCE_MAC, ...ETHER_TYPE_BYTES, 0x00, 0x01]),
    description: 'protocol.goose.example.frameTooShort.description',
    expectedValid: false,
  },
];

export const goosePlugin: ProtocolPlugin = {
  id: PROTOCOL_ID,
  name: PROTOCOL_DISPLAY_NAME,
  category: 'industrial-automation',
  parser: gooseParser,
  documentation: {
    summary: 'protocol.goose.documentation.summary',
    layer: 'multi-layer',
    references: [
      {
        title:
          'Wireshark GOOSE dissector — asn1/goose/goose.asn (IEC 61850 ASN.1 module) and packet-goose.c',
        url: 'https://gitlab.com/wireshark/wireshark/-/tree/master/epan/dissectors/asn1/goose',
      },
      {
        title:
          'libIEC61850 (GPLv3 — documented wire format referenced only): goose_publisher.c, goose_receiver.c, mms_value.h',
        url: 'https://github.com/mz-automation/libiec61850',
      },
    ],
  },
  exampleFrames: EXAMPLE_FRAMES,
};
