/**
 * SNMP'nin BER etiket kümesi ve adlandırma tabloları (RFC 1157 · RFC 2578 ·
 * RFC 3416). `snmp.ts`ten ayrı duruyor çünkü burası SAF VERİdir: tablo
 * büyüdükçe parser gövdesi okunamaz hâle gelirdi ve tabloların kendisi ayrı
 * test edilebilir.
 *
 * ── UYGULAMA TİPLERİ İŞARETSİZDİR ───────────────────────────────────────────
 * `Counter32`/`Gauge32`/`TimeTicks`/`Counter64` (RFC 2578 §7.1) işaretsiz tam
 * sayılardır. X.690'ın INTEGER'ı ise iki tümleyendir — aynı baytları
 * `decodeBerInteger`la okumak 3 000 000 000'lık bir sayacı −1 294 967 296
 * gösterir. `decodeBerUnsignedInteger` bu yüzden ayrı yazıldı
 * (`protocol-core/decoding/berReader.ts`).
 */

/** X.690 evrensel etiketleri — VarBind değerinde görülenler. */
export const TAG_INTEGER = 0x02;
export const TAG_OCTET_STRING = 0x04;
export const TAG_NULL = 0x05;
export const TAG_OBJECT_IDENTIFIER = 0x06;
export const TAG_SEQUENCE = 0x30;

/**
 * `[APPLICATION n]` etiketleri (RFC 2578). Hepsi PRIMITIVE'dir, yani üst iki bit
 * `01` ve constructed biti kapalı: `0x40 + n`.
 */
export const TAG_IP_ADDRESS = 0x40;
export const TAG_COUNTER32 = 0x41;
export const TAG_GAUGE32 = 0x42;
export const TAG_TIME_TICKS = 0x43;
export const TAG_OPAQUE = 0x44;
export const TAG_COUNTER64 = 0x46;

/**
 * v2c'nin VarBind istisnaları (RFC 3416 §3): `[CONTEXT n] IMPLICIT NULL`, yani
 * uzunlukları SIFIRDIR. Değer taşımazlar; "değeri boş" ile "böyle bir nesne
 * yok" farkını taşıyan tek işaret etiketin kendisidir.
 */
export const TAG_NO_SUCH_OBJECT = 0x80;
export const TAG_NO_SUCH_INSTANCE = 0x81;
export const TAG_END_OF_MIB_VIEW = 0x82;

/** PDU etiketleri: `[CONTEXT n] CONSTRUCTED` → `0xA0 + n`. */
export const PDU_GET_REQUEST = 0xa0;
export const PDU_GET_NEXT_REQUEST = 0xa1;
export const PDU_RESPONSE = 0xa2;
export const PDU_SET_REQUEST = 0xa3;
/** YALNIZ v1 — gövdesi diğerlerinden TAMAMEN farklıdır (`snmp.ts` dosya başı). */
export const PDU_TRAP_V1 = 0xa4;
/** v2c+ — ikinci/üçüncü alanları error-status/index DEĞİL (`snmp.ts` dosya başı). */
export const PDU_GET_BULK_REQUEST = 0xa5;
export const PDU_INFORM_REQUEST = 0xa6;
export const PDU_TRAP_V2 = 0xa7;
export const PDU_REPORT = 0xa8;

export const PDU_TYPE_NAMES: ReadonlyMap<number, string> = new Map([
  [PDU_GET_REQUEST, 'GetRequest'],
  [PDU_GET_NEXT_REQUEST, 'GetNextRequest'],
  [PDU_RESPONSE, 'Response'],
  [PDU_SET_REQUEST, 'SetRequest'],
  [PDU_TRAP_V1, 'Trap (v1)'],
  [PDU_GET_BULK_REQUEST, 'GetBulkRequest'],
  [PDU_INFORM_REQUEST, 'InformRequest'],
  [PDU_TRAP_V2, 'SNMPv2-Trap'],
  [PDU_REPORT, 'Report'],
]);

/**
 * Sürüm alanı SIFIR TABANLIDIR ve **2 diye bir değer yoktur**: 0 → v1,
 * 1 → v2c, 3 → v3. Ham sayıyı "sürüm" diye basmak v2c'yi "SNMPv1" gösterir.
 */
export const VERSION_V1 = 0;
export const VERSION_V2C = 1;
export const VERSION_V3 = 3;

export const VERSION_NAMES: ReadonlyMap<number, string> = new Map([
  [VERSION_V1, 'SNMPv1'],
  [VERSION_V2C, 'SNMPv2c'],
  [VERSION_V3, 'SNMPv3'],
]);

/** RFC 1157 §4.1 (0-5) + RFC 3416 §3 (6-18). */
export const ERROR_STATUS_NAMES: ReadonlyMap<number, string> = new Map([
  [0, 'noError'],
  [1, 'tooBig'],
  [2, 'noSuchName'],
  [3, 'badValue'],
  [4, 'readOnly'],
  [5, 'genErr'],
  [6, 'noAccess'],
  [7, 'wrongType'],
  [8, 'wrongLength'],
  [9, 'wrongEncoding'],
  [10, 'wrongValue'],
  [11, 'noCreation'],
  [12, 'inconsistentValue'],
  [13, 'resourceUnavailable'],
  [14, 'commitFailed'],
  [15, 'undoFailed'],
  [16, 'authorizationError'],
  [17, 'notWritable'],
  [18, 'inconsistentName'],
]);

/** RFC 1157 §4.1.6 — yalnız v1 Trap-PDU'da bulunur. */
export const GENERIC_TRAP_NAMES: ReadonlyMap<number, string> = new Map([
  [0, 'coldStart'],
  [1, 'warmStart'],
  [2, 'linkDown'],
  [3, 'linkUp'],
  [4, 'authenticationFailure'],
  [5, 'egpNeighborLoss'],
  [6, 'enterpriseSpecific'],
]);

/** RFC 3411 §5 — v3 zarfındaki `msgSecurityModel`. */
export const SECURITY_MODEL_NAMES: ReadonlyMap<number, string> = new Map([
  [1, 'SNMPv1'],
  [2, 'SNMPv2c'],
  [3, 'USM'],
]);

/** RFC 3412 §6.4 — `msgFlags`ın tek baytındaki üç bit. */
export const MSG_FLAG_AUTH = 0x01;
export const MSG_FLAG_PRIV = 0x02;
export const MSG_FLAG_REPORTABLE = 0x04;

/**
 * MIB veritabanı YOK: katalog `definitions: ['custom-schema']` kanalını
 * işaretliyor ama kanal henüz boş (spec `:369` "MIB import"). Bu tablo o kanalın
 * yerini TUTMAZ — yalnız spec'in örneklerinde geçen ve MIB'siz de tanınması
 * beklenen system/interface grubunu adlandırır. Tablonun dışı ham OID kalır.
 */
export const WELL_KNOWN_OIDS: ReadonlyMap<string, string> = new Map([
  ['1.3.6.1.2.1.1.1', 'sysDescr'],
  ['1.3.6.1.2.1.1.2', 'sysObjectID'],
  ['1.3.6.1.2.1.1.3', 'sysUpTime'],
  ['1.3.6.1.2.1.1.4', 'sysContact'],
  ['1.3.6.1.2.1.1.5', 'sysName'],
  ['1.3.6.1.2.1.1.6', 'sysLocation'],
  ['1.3.6.1.2.1.1.7', 'sysServices'],
  ['1.3.6.1.2.1.2.2.1.1', 'ifIndex'],
  ['1.3.6.1.2.1.2.2.1.2', 'ifDescr'],
  ['1.3.6.1.2.1.2.2.1.7', 'ifAdminStatus'],
  ['1.3.6.1.2.1.2.2.1.8', 'ifOperStatus'],
  ['1.3.6.1.6.3.1.1.4.1', 'snmpTrapOID'],
  ['1.3.6.1.6.3.1.1.5.1', 'coldStart'],
  ['1.3.6.1.6.3.1.1.5.3', 'linkDown'],
  ['1.3.6.1.6.3.1.1.5.4', 'linkUp'],
]);

/**
 * OID'i adlandırır. Tam eşleşme yoksa SON ARC atılıp bir daha denenir: MIB'de
 * nesne `1.3.6.1.2.1.1.3` iken telde daima instance ekli hâli
 * (`1.3.6.1.2.1.1.3.0`) gelir. Tek adımlık geri çekilme yeter — daha derin
 * arama (tablo index'leri) MIB metadata'sı olmadan uydurma olurdu.
 */
export function resolveOidName(oid: string): string | undefined {
  const exact = WELL_KNOWN_OIDS.get(oid);
  if (exact !== undefined) return exact;

  const lastDot = oid.lastIndexOf('.');
  if (lastDot < 0) return undefined;

  const parentName = WELL_KNOWN_OIDS.get(oid.slice(0, lastDot));
  if (parentName === undefined) return undefined;
  return `${parentName}.${oid.slice(lastDot + 1)}`;
}

const TICKS_PER_SECOND = 100n;
const SECONDS_PER_MINUTE = 60n;
const SECONDS_PER_HOUR = 3600n;
const SECONDS_PER_DAY = 86_400n;

/**
 * `TimeTicks` SANİYE DEĞİL, saniyenin YÜZDE BİRİDİR (RFC 2578 §7.1.8).
 * Ham sayıyı saniye sanmak `sysUpTime`ı 100 kat büyük gösterir — sahada
 * "cihaz 3 yıldır ayakta" diye okunan klasik hata.
 */
export function formatTimeTicks(ticks: bigint): string {
  const totalSeconds = ticks / TICKS_PER_SECOND;
  const hundredths = ticks % TICKS_PER_SECOND;

  const days = totalSeconds / SECONDS_PER_DAY;
  const hours = (totalSeconds % SECONDS_PER_DAY) / SECONDS_PER_HOUR;
  const minutes = (totalSeconds % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE;
  const seconds = totalSeconds % SECONDS_PER_MINUTE;

  const pad = (value: bigint): string => value.toString().padStart(2, '0');
  return `${days}d ${pad(hours)}:${pad(minutes)}:${pad(seconds)}.${pad(hundredths)}`;
}
