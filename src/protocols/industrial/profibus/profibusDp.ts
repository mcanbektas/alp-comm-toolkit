/**
 * PROFIBUS DP (PI — PROFIBUS & PROFINET International, IEC 61158/61784
 * Type 3) — RS-485 üstünde merkezî olmayan çevre birimi (decentralized
 * peripheral) I/O veri yolu. Bir DP master, adreslenmiş slave istasyonlarla
 * önce parametreleme/konfigürasyon, sonra döngüsel veri alışverişi yapar.
 *
 * Faz 10, dalga 13g. `classic-fieldbus` ailesinin BİRİNCİ kaydı ve bu ailenin
 * en derin çözülebilen protokolü.
 *
 * ── KAYNAK: ÜÇ BAĞIMSIZ, KAMUYA AÇIK KAYNAK — ÇAPRAZ TEYİTLİ ──────────────
 * PI'nin FDL spec metni ücretlidir ve bu depoda YOKTUR. Wireshark'ta PROFIBUS
 * dissector'ı da YOKTUR (1826 dissector bu oturumda tarandı). Alan yerleşimi
 * İKİ BAĞIMSIZ AÇIK KAYNAK YIĞINDAN çapraz teyitle alındı (ikisine de bu
 * oturumda gerçekten erişildi; KOD KOPYALANMADI):
 *   P = **pyprofibus** (Michael Buesch, GPL-2.0) — saf Python PROFIBUS-DP
 *       yığını. `pyprofibus/fdl.py`in `FdlTelegram` sınıfı sınırlayıcıları,
 *       adres uzantısı bitlerini, FC bit haritasını ve FCS kapsamını verir;
 *       `pyprofibus/dp.py` DSAP/SSAP numaralarını verir.
 *       https://github.com/mbuesch/pyprofibus
 *   R = **profirust** (Rahix, Apache-2.0) — Rust'ta yazılmış BAĞIMSIZ bir
 *       PROFIBUS-DP yığını. `src/consts.rs` sınırlayıcıları, `src/fdl/
 *       telegram.rs` FC çözümünü (`RequestType`/`ResponseState`/
 *       `ResponseStatus`) ve SAP numaralarını verir.
 *       https://github.com/Rahix/profirust
 * İki yığın SD1/SD2/SD3/SD4/SC/ED değerlerinde, FC bit maskelerinde, FCS
 * kapsamında ve SAP tablosunda BİREBİR aynıdır. R'nin birim testindeki gerçek
 * telgraf `10 22 02 49 6D 16` FCS'i de bağımsız olarak doğruluyor:
 * 0x22+0x02+0x49 = 0x6D. ÜÇÜNCÜ TEYİT: felser.ch'in kamuya açık "PROFIBUS
 * Manual — Telegram formats" sayfası aynı sınırlayıcıları ve alan sırasını
 * listeliyor. https://felser.ch/profibus-manual/telegrammformate.html
 *
 * ── FT1.2 AKRABALIĞI SINANDI: CHECKSUM PAYLAŞILDI, ÇERÇEVELEME AYRI ───────
 * Brief FT1.2 akrabalığını sınamamı istedi (`iec101.ts`, dalga 13b). Sonuç
 * BÖLÜNMÜŞ ve gerekçesi bit düzeyinde:
 *   ✔ **PAYLAŞILDI — `sum8Checksum`**: FCS'in hesabı FT1.2'nin checksum'ıyla
 *     BİREBİR aynıdır (kapsanan baytların 256 modunda aritmetik toplamı).
 *     P `calcFCS` ve R'nin toplamı da aynı. `protocol-core/checksums/
 *     simpleChecksums.ts`teki `sum8Checksum` DEĞİŞTİRİLMEDEN kullanıldı —
 *     ikinci bir toplam fonksiyonu yazılmadı (12g'nin `ntpTimestamp.ts`
 *     deseni).
 *   ✘ **PAYLAŞILMADI — çerçeveleme**: `iec101.ts`in ayrıştırıcısı BU
 *     telgrafları çözemez, çünkü alan SIRASI ve KÜMESİ farklıdır:
 *       1. FT1.2 sabit çerçevesi `10 C A CS 16` — Control ADRESTEN ÖNCE.
 *          PROFIBUS SD1 `10 DA SA FC CS 16` — İKİ adres, ikisi de FC'den
 *          ÖNCE. Aynı 0x10 baytıyla başlayan iki farklı gövde.
 *       2. FT1.2'de adres genişliği YAPILANDIRILABİLİR (0/1/2 bayt);
 *          PROFIBUS'ta her zaman İKİ ADRES ve her biri TEK bayttır, üstelik
 *          bit 7 adres uzantısı (DAE/SAE) bayrağıdır — FT1.2'de böyle bir
 *          bayrak yoktur.
 *       3. PROFIBUS'un SD3 (`0xA2`, 8 bayt sabit veri) ve SD4 (`0xDC`, token)
 *          sınırlayıcıları FT1.2'de HİÇ YOKTUR.
 *       4. Değişken çerçevede FT1.2'nin L'si Control+Address+ASDU'yu sayar;
 *          PROFIBUS'un LE'si DA+SA+FC+DU'yu sayar ve 3-249 ile sınırlıdır.
 *     Dalga 12'nin iki yönlü dersi: akraba görünen tel biçimi farklı çıkarsa
 *     ayrı yazılır ve NEDEN ayrı olduğu yazılır. Bu dosya budur.
 *
 * ── GİRDİ: TEK BİR FDL TELGRAFI ──────────────────────────────────────────
 * Girdi, RS-485 hattından okunmuş TEK bir FDL telgrafıdır. UART çerçeveleme
 * (11 bitlik karakter: start + 8 veri + even parity + stop) decoder'a
 * SIZMAZ — `dali.ts`in Manchester gerekçesinin aynısı; girdi çözülmüş bayt
 * dizisidir. Telgraflar arası SYN boşluğu (33 bit idle) da girdinin parçası
 * değildir.
 *
 * ── STATUS: 'ready' — GEREKÇE (`ethercat.ts` ölçütü) ─────────────────────
 * Beş telgraf sınıfının (SC/SD1/SD2/SD3/SD4) HER ALANI adlandırılıp çözülür:
 * sınırlayıcılar, uzunluk alanı ve tekrarı, hedef/kaynak adresi ve adres
 * uzantısı bayrağı, çerçeve kontrol baytının istek (FCB/FCV + fonksiyon kodu)
 * ve yanıt (istasyon tipi + durum) kırılımı, adres uzantısı baytlarından
 * DSAP/SSAP ve segment adresi, bitiş sınırlayıcısı. Protokolün kendi
 * tanımladığı doğrulama (FCS) YAPILIR ve uyuşmazlıkta hata basılır. Ham kalan
 * tek bölge kullanıcı verisidir (DU) ve bu YAPISAL bir eksik değil,
 * TANIM-BAĞIMLI içeriktir: aşağı bak.
 *
 * ── DU HAM BIRAKILIR — SAHTE ALAN KIRILIMI YOK ───────────────────────────
 * Data Exchange telgrafının DU'su, GSD dosyasında bildirilmiş modül/I/O
 * yapısına göre yorumlanır; çerçevede kaç bayt girişin kaç bayt çıkışa
 * karşılık geldiği YAZMAZ. Servis telgraflarının (Set_Prm, Chk_Cfg,
 * Slave_Diag …) gövdeleri ise DP profiline bağlıdır ve tek bir yakalamadan
 * güvenle kırılamaz. Bu motor DU'yu TEK PARÇA ham basar ve nedenini
 * `WARN_USER_DATA_NEEDS_GSD` ile söyler (`profinet.ts`in GSDML'siz I/O
 * verisi ve `sercosIii.ts`in CP3/CP4 gövdesi emsali).
 *
 * ── decodeOptions: AÇILMADI, GEREKÇESİ ───────────────────────────────────
 *  1. "Telgraf tipi" → SINIRLAYICIDAN çıkar (12f'nin WebSocket MASK-biti
 *     dersi).
 *  2. "İstek mi yanıt mı" → FC'nin bit 6'sından çıkar.
 *  3. "DU nasıl kırılsın" → bir `select`/`number` alanına SIĞMAZ; modül
 *     listesi + giriş/çıkış uzunlukları içeren tam bir GSD ister.
 *
 * ── KAPSAM DIŞI (dosya başında AÇIKÇA) ───────────────────────────────────
 *  • **GSD dosyası içe aktarma**: katalog kaydının `definitions: ['gsd']`
 *    sekmesi ayrı bir iştir; bu motor tanım dosyası okumaz.
 *  • **DPV1 asiklik servisler (MS1/MS2) gövdeleri**: SAP'ları adlandırılır
 *    ama servis gövdeleri çözülmez — ayrı spec bölümü, tek kaynaklı.
 *  • **PROFIBUS PA / MBP fiziksel katmanı**: aynı DP protokolü farklı fizik
 *    üstünde; bu motorun girdisi değişmez ama zamanlama/fizik kapsam dışı.
 *  • **Çok telgraflı analiz**: token dolaşımı, çevrim süresi, retry sayımı,
 *    istasyon tablosu — `ethercat.ts`in "analyzer sınırı" emsali.
 */

import { sum8Checksum } from '@/protocol-core/checksums/simpleChecksums';
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
const PROTOCOL_ID = 'profibus-dp';
/** Protokol adı veridir, çeviriye girmez (CLAUDE.md). */
const PROTOCOL_DISPLAY_NAME = 'PROFIBUS DP';

/** Sınırlayıcılar — P `FdlTelegram` ve R `consts.rs` BİREBİR aynı. */
const SD1 = 0x10;
const SD2 = 0x68;
const SD3 = 0xa2;
const SD4 = 0xdc;
const SHORT_ACK = 0xe5;
const END_DELIMITER = 0x16;

const SD1_LENGTH = 6;
const SD3_LENGTH = 14;
const SD4_LENGTH = 3;
const SD3_DATA_LENGTH = 8;
/** SD2'nin LE alanı DA+SA+FC+DU'yu sayar; asgari 3 (DU boş), azami 249. */
const SD2_MIN_LE = 3;
const SD2_MAX_LE = 249;
/** SD2 toplam boyu = LE + 6 (SD2, LE, LEr, SD2, FCS, ED). */
const SD2_OVERHEAD = 6;

/** Adres baytı: bit 7 uzantı bayrağı, bit 0-6 istasyon adresi. */
const ADDRESS_MASK = 0x7f;
const ADDRESS_EXTENSION_FLAG = 0x80;
const BROADCAST_ADDRESS = 127;

/** Adres uzantısı baytı: bit 7 devam, bit 6 segment, bit 0-5 SAP/segment no. */
const AE_MORE_FLAG = 0x80;
const AE_SEGMENT_FLAG = 0x40;
const AE_VALUE_MASK = 0x3f;
/** Bozuk bir zincirde sonsuz döngü olmasın: uzantı zinciri ÜST SINIRI. */
const MAX_ADDRESS_EXTENSION_BYTES = 4;

/** FC bit haritası — P ve R BİREBİR aynı. */
const FC_REQUEST_FLAG = 0x40;
const FC_FCB_FLAG = 0x20;
const FC_FCV_FLAG = 0x10;
const FC_FUNCTION_MASK = 0x0f;
const FC_CLOCK_VALUE_FLAG = 0x80;
const FC_STATION_TYPE_MASK = 0x30;
const FC_STATION_TYPE_SHIFT = 4;

const HEX_RADIX = 16;

export const ERROR_EMPTY_INPUT = 'protocol.profibusDp.error.emptyInput';
export const ERROR_FRAME_TOO_LONG = 'protocol.profibusDp.error.frameTooLong';
export const ERROR_ABORTED = 'protocol.profibusDp.error.aborted';
export const ERROR_START_DELIMITER_UNKNOWN = 'protocol.profibusDp.error.startDelimiterUnknown';
export const ERROR_TELEGRAM_TRUNCATED = 'protocol.profibusDp.error.telegramTruncated';
export const ERROR_LENGTH_REPEAT_MISMATCH = 'protocol.profibusDp.error.lengthRepeatMismatch';
export const ERROR_LENGTH_OUT_OF_RANGE = 'protocol.profibusDp.error.lengthOutOfRange';
export const ERROR_SECOND_START_MISMATCH = 'protocol.profibusDp.error.secondStartMismatch';
export const ERROR_END_DELIMITER_INVALID = 'protocol.profibusDp.error.endDelimiterInvalid';
export const ERROR_CHECKSUM_MISMATCH = 'protocol.profibusDp.error.checksumMismatch';

export const WARN_USER_DATA_NEEDS_GSD = 'protocol.profibusDp.warning.userDataNeedsGsd';
export const WARN_FUNCTION_CODE_NOT_NAMED = 'protocol.profibusDp.warning.functionCodeNotNamed';
export const WARN_SAP_NOT_NAMED = 'protocol.profibusDp.warning.sapNotNamed';
export const WARN_ADDRESS_EXTENSION_TRUNCATED =
  'protocol.profibusDp.warning.addressExtensionTruncated';
export const WARN_TRAILING_BYTES = 'protocol.profibusDp.warning.trailingBytes';
export const WARN_FCV_WITHOUT_FCB_MEANING = 'protocol.profibusDp.warning.fcvWithoutFcbMeaning';

const SUMMARY_TELEGRAM = 'protocol.profibusDp.summary.telegram';
const SUMMARY_SHORT_ACK = 'protocol.profibusDp.summary.shortAck';
const SUMMARY_TOKEN = 'protocol.profibusDp.summary.token';

/** İstek fonksiyon kodları — P `FC_*` ve R `RequestType` BİREBİR aynı. */
const REQUEST_FUNCTION_NAMES: ReadonlyMap<number, string> = new Map([
  [0x00, 'Time Event'],
  [0x03, 'SDA low priority (send data acknowledged)'],
  [0x04, 'SDN low priority (send data not acknowledged)'],
  [0x05, 'SDA high priority'],
  [0x06, 'SDN high priority'],
  [0x07, 'SRD with multicast reply'],
  [0x09, 'Request FDL status'],
  [0x0a, 'Actual time event'],
  [0x0b, 'Actual counter event'],
  [0x0c, 'SRD low priority (send and request data)'],
  [0x0d, 'SRD high priority'],
  [0x0e, 'Request ident with reply'],
  [0x0f, 'Request LSAP status with reply'],
]);

/** Yanıt durum kodları — P `FC_OK…FC_RDH` ve R `ResponseStatus` aynı. */
const RESPONSE_STATUS_NAMES: ReadonlyMap<number, string> = new Map([
  [0x00, 'OK (positive acknowledgement)'],
  [0x01, 'UE — user error'],
  [0x02, 'RR — no resources'],
  [0x03, 'RS — SAP not enabled'],
  [0x08, 'DL — response data low'],
  [0x09, 'NR — no response data ready'],
  [0x0a, 'DH — response data high'],
  [0x0c, 'RDL — data not received, response data low'],
  [0x0d, 'RDH — data not received, response data high'],
]);

/** Yanıt istasyon tipi — P `FC_SLAVE…FC_MTR`, R `ResponseState`. */
const STATION_TYPE_NAMES: ReadonlyMap<number, string> = new Map([
  [0, 'Slave station'],
  [1, 'Master, not ready to enter token ring'],
  [2, 'Master, ready to enter token ring'],
  [3, 'Master, in token ring'],
]);

/**
 * DP servis erişim noktaları — P `dp.py` ve R `consts.rs` aynı numaraları
 * veriyor. 62 numarası İKİ ANLAMLIDIR (slave tarafında Chk_Cfg, master
 * tarafında MS0) ve etiket bunu SAKLAMAZ.
 */
const SAP_NAMES: ReadonlyMap<number, string> = new Map([
  [49, 'Resource Manager'],
  [50, 'Alarm / DP master MS2 (acyclic class 2)'],
  [51, 'Server / DP master MS1 (acyclic class 1)'],
  [53, 'Extended user parameters'],
  [54, 'Master-to-master'],
  [55, 'Set Slave Address'],
  [56, 'Read Inputs'],
  [57, 'Read Outputs'],
  [58, 'Global Control'],
  [59, 'Get Configuration'],
  [60, 'Slave Diagnosis'],
  [61, 'Set Parameters'],
  [62, 'Check Configuration (slave) / DP master MS0'],
]);

function byteAt(data: Uint8Array, offset: number): number {
  return data[offset] ?? 0;
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

export type ProfibusDpFrameMetadata = {
  telegramKind: 'short-ack' | 'sd1' | 'sd2' | 'sd3' | 'token';
  destinationAddress: number | undefined;
  sourceAddress: number | undefined;
  functionName: string | undefined;
  summaryKey: string;
  summaryParams: Record<string, string>;
};

interface ProfibusDpParseOptions {
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

/** Hedef ya da kaynak adresi: uzantı bayrağı ayrı bir alan olarak basılır. */
function pushAddress(
  fields: ParsedField[],
  data: Uint8Array,
  init: { readonly id: string; readonly name: string; readonly offset: number },
): boolean {
  const raw = byteAt(data, init.offset);
  const address = raw & ADDRESS_MASK;
  const extended = (raw & ADDRESS_EXTENSION_FLAG) !== 0;
  pushField(fields, data, {
    id: init.id,
    name: init.name,
    offset: init.offset,
    length: 1,
    rawValue: address,
    physicalValue: address === BROADCAST_ADDRESS ? `${address} (broadcast)` : `${address}`,
  });
  pushField(fields, data, {
    id: `${init.id}-extension-flag`,
    name: `${init.name} — extension flag (bit 7)`,
    offset: init.offset,
    length: 1,
    rawValue: extended ? 1 : 0,
    physicalValue: extended ? 'DAE/SAE present in data unit' : 'No address extension',
  });
  return extended;
}

/** Çerçeve kontrol baytı: istek ve yanıt kırılımları TAMAMEN farklıdır. */
function pushFunctionCode(
  fields: ParsedField[],
  data: Uint8Array,
  offset: number,
  warnings: WarningSink,
): string | undefined {
  const value = byteAt(data, offset);
  const isRequest = (value & FC_REQUEST_FLAG) !== 0;

  pushField(fields, data, {
    id: `frame-control-${offset}`,
    name: 'FC — Frame Control',
    offset,
    length: 1,
    rawValue: value,
    physicalValue: isRequest ? 'Request / send frame' : 'Acknowledgement / response frame',
  });

  if (isRequest) {
    const fcb = (value & FC_FCB_FLAG) !== 0;
    const fcv = (value & FC_FCV_FLAG) !== 0;
    pushField(fields, data, {
      id: `fc-fcb-${offset}`,
      name: 'FC — FCB (frame count bit, bit 5)',
      offset,
      length: 1,
      rawValue: fcb ? 1 : 0,
      physicalValue: fcb ? '1' : '0',
    });
    pushField(fields, data, {
      id: `fc-fcv-${offset}`,
      name: 'FC — FCV (frame count bit valid, bit 4)',
      offset,
      length: 1,
      rawValue: fcv ? 1 : 0,
      physicalValue: fcv ? 'FCB is valid' : 'FCB is not evaluated',
    });
    if (fcb && !fcv) warnings.push(WARN_FCV_WITHOUT_FCB_MEANING);

    // Clock Value (0x80) fonksiyon kodu 0 ile AYNI alt dörtlüyü kullanır;
    // ayrımı bit 7 yapar (R `RequestType::ClockValue = 0 | 1 << 7`).
    const functionCode = value & FC_FUNCTION_MASK;
    const isClockValue = (value & FC_CLOCK_VALUE_FLAG) !== 0 && functionCode === 0;
    const name = isClockValue ? 'Clock Value' : REQUEST_FUNCTION_NAMES.get(functionCode);
    if (name === undefined) warnings.push(WARN_FUNCTION_CODE_NOT_NAMED);
    pushField(fields, data, {
      id: `fc-function-${offset}`,
      name: 'FC — Request function code (bits 0-3)',
      offset,
      length: 1,
      rawValue: functionCode,
      physicalValue: name ?? formatHex(functionCode, 1),
      valid: name !== undefined,
      warnings: name === undefined ? [WARN_FUNCTION_CODE_NOT_NAMED] : [],
    });
    return name;
  }

  const stationType = (value & FC_STATION_TYPE_MASK) >>> FC_STATION_TYPE_SHIFT;
  const stationName = STATION_TYPE_NAMES.get(stationType);
  pushField(fields, data, {
    id: `fc-station-type-${offset}`,
    name: 'FC — Station type / FDL status (bits 4-5)',
    offset,
    length: 1,
    rawValue: stationType,
    physicalValue: stationName ?? formatHex(stationType, 1),
    valid: stationName !== undefined,
  });

  const status = value & FC_FUNCTION_MASK;
  const statusName = RESPONSE_STATUS_NAMES.get(status);
  if (statusName === undefined) warnings.push(WARN_FUNCTION_CODE_NOT_NAMED);
  pushField(fields, data, {
    id: `fc-function-${offset}`,
    name: 'FC — Response function code (bits 0-3)',
    offset,
    length: 1,
    rawValue: status,
    physicalValue: statusName ?? formatHex(status, 1),
    valid: statusName !== undefined,
    warnings: statusName === undefined ? [WARN_FUNCTION_CODE_NOT_NAMED] : [],
  });
  return statusName;
}

/**
 * Adres uzantısı zinciri (DAE ya da SAE). Her bayt: bit 7 "devam eden uzantı",
 * bit 6 "segment adresi", bit 0-5 değer. SAP taşıyan bayt segment biti SIFIR
 * olandır (P `extractSAP`).
 */
function decodeAddressExtension(
  data: Uint8Array,
  start: number,
  label: string,
  fields: ParsedField[],
  warnings: WarningSink,
): { readonly next: number; readonly sap: number | undefined } {
  let cursor = start;
  let sap: number | undefined;
  for (let index = 0; index < MAX_ADDRESS_EXTENSION_BYTES; index += 1) {
    if (cursor >= data.length) {
      warnings.push(WARN_ADDRESS_EXTENSION_TRUNCATED);
      return { next: cursor, sap };
    }
    const raw = byteAt(data, cursor);
    const value = raw & AE_VALUE_MASK;
    const isSegment = (raw & AE_SEGMENT_FLAG) !== 0;
    const more = (raw & AE_MORE_FLAG) !== 0;
    if (!isSegment && sap === undefined) sap = value;
    const sapName = isSegment ? undefined : SAP_NAMES.get(value);
    if (!isSegment && sapName === undefined) warnings.push(WARN_SAP_NOT_NAMED);
    pushField(fields, data, {
      id: `${label}-${cursor}`,
      name: isSegment ? `${label} — segment address` : `${label} — service access point`,
      offset: cursor,
      length: 1,
      rawValue: value,
      physicalValue: isSegment ? `Segment ${value}` : (sapName ?? `SAP ${value}`),
      valid: isSegment || sapName !== undefined,
      warnings: !isSegment && sapName === undefined ? [WARN_SAP_NOT_NAMED] : [],
    });
    cursor += 1;
    if (!more) break;
  }
  return { next: cursor, sap };
}

/** FCS: kapsanan baytların 256 modunda toplamı — FT1.2 ile PAYLAŞILAN hesap. */
function pushChecksum(
  data: Uint8Array,
  coveredStart: number,
  coveredEnd: number,
  offset: number,
  fields: ParsedField[],
  errors: ProtocolError[],
): void {
  const expected = sum8Checksum(data.slice(coveredStart, coveredEnd));
  const actual = byteAt(data, offset);
  const matches = expected === actual;
  pushField(fields, data, {
    id: `fcs-${offset}`,
    name: 'FCS — Frame Check Sequence',
    offset,
    length: 1,
    rawValue: actual,
    physicalValue: matches ? 'Checksum OK' : `Expected ${formatHex(expected, 2)}`,
    valid: matches,
    warnings: matches ? [] : [ERROR_CHECKSUM_MISMATCH],
  });
  if (!matches) {
    errors.push({
      code: 'checksum-mismatch',
      message: ERROR_CHECKSUM_MISMATCH,
      offset,
      length: 1,
      details: { expected: formatHex(expected, 2), actual: formatHex(actual, 2) },
    });
  }
}

function pushEndDelimiter(
  data: Uint8Array,
  offset: number,
  fields: ParsedField[],
  errors: ProtocolError[],
): void {
  const value = byteAt(data, offset);
  const matches = value === END_DELIMITER;
  pushField(fields, data, {
    id: `end-delimiter-${offset}`,
    name: 'ED — End Delimiter',
    offset,
    length: 1,
    rawValue: value,
    physicalValue: matches ? formatHex(END_DELIMITER, 2) : formatHex(value, 2),
    valid: matches,
    warnings: matches ? [] : [ERROR_END_DELIMITER_INVALID],
  });
  if (!matches) {
    errors.push({
      code: 'start-delimiter-not-found',
      message: ERROR_END_DELIMITER_INVALID,
      offset,
      length: 1,
      details: { expected: formatHex(END_DELIMITER, 2), actual: formatHex(value, 2) },
    });
  }
}

function pushStartDelimiter(
  data: Uint8Array,
  offset: number,
  label: string,
  fields: ParsedField[],
): void {
  pushField(fields, data, {
    id: `start-delimiter-${offset}`,
    name: 'SD — Start Delimiter',
    offset,
    length: 1,
    rawValue: byteAt(data, offset),
    physicalValue: label,
  });
}

function pushUserData(
  data: Uint8Array,
  start: number,
  end: number,
  fields: ParsedField[],
  warnings: WarningSink,
): void {
  if (end <= start) return;
  warnings.push(WARN_USER_DATA_NEEDS_GSD);
  pushField(fields, data, {
    id: `data-unit-${start}`,
    name: 'DU — Data Unit',
    offset: start,
    length: end - start,
    unit: 'B',
    warnings: [WARN_USER_DATA_NEEDS_GSD],
  });
}

function pushTrailing(
  data: Uint8Array,
  start: number,
  fields: ParsedField[],
  warnings: WarningSink,
): void {
  if (start >= data.length) return;
  warnings.push(WARN_TRAILING_BYTES);
  pushField(fields, data, {
    id: `trailing-${start}`,
    name: 'Trailing Bytes',
    offset: start,
    length: data.length - start,
    unit: 'B',
    warnings: [WARN_TRAILING_BYTES],
  });
}

interface TelegramOutcome {
  readonly kind: ProfibusDpFrameMetadata['telegramKind'];
  readonly destinationAddress: number | undefined;
  readonly sourceAddress: number | undefined;
  readonly functionName: string | undefined;
  readonly summaryKey: string;
}

function parseProfibusDpFrame(data: Uint8Array, options: ProfibusDpParseOptions): ParseResult {
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

  if (data.length === 0) {
    return fail({
      code: 'truncated-frame',
      message: ERROR_EMPTY_INPUT,
      recoverable: true,
      offset: 0,
      length: 0,
    });
  }

  const startDelimiter = byteAt(data, 0);
  if (
    startDelimiter !== SHORT_ACK &&
    startDelimiter !== SD1 &&
    startDelimiter !== SD2 &&
    startDelimiter !== SD3 &&
    startDelimiter !== SD4
  ) {
    return fail({
      code: 'start-delimiter-not-found',
      message: ERROR_START_DELIMITER_UNKNOWN,
      recoverable: true,
      offset: 0,
      length: 1,
      details: { startDelimiter: formatHex(startDelimiter, 2) },
    });
  }

  const fields: ParsedField[] = [];
  const warnings = new WarningSink();
  const errors: ProtocolError[] = [];
  const summaryParams: Record<string, string> = {};

  let outcome: TelegramOutcome;

  if (startDelimiter === SHORT_ACK) {
    pushStartDelimiter(data, 0, 'SC — short acknowledgement', fields);
    pushTrailing(data, 1, fields, warnings);
    outcome = {
      kind: 'short-ack',
      destinationAddress: undefined,
      sourceAddress: undefined,
      functionName: undefined,
      summaryKey: SUMMARY_SHORT_ACK,
    };
  } else if (startDelimiter === SD4) {
    if (data.length < SD4_LENGTH) {
      return fail({
        code: 'truncated-frame',
        message: ERROR_TELEGRAM_TRUNCATED,
        recoverable: true,
        offset: 0,
        length: data.length,
        details: { availableBytes: data.length, requiredBytes: SD4_LENGTH },
      });
    }
    pushStartDelimiter(data, 0, 'SD4 — token telegram', fields);
    pushAddress(fields, data, { id: 'destination-address', name: 'DA — Destination Address', offset: 1 });
    pushAddress(fields, data, { id: 'source-address', name: 'SA — Source Address', offset: 2 });
    pushTrailing(data, SD4_LENGTH, fields, warnings);
    summaryParams['destination'] = `${byteAt(data, 1) & ADDRESS_MASK}`;
    summaryParams['source'] = `${byteAt(data, 2) & ADDRESS_MASK}`;
    outcome = {
      kind: 'token',
      destinationAddress: byteAt(data, 1) & ADDRESS_MASK,
      sourceAddress: byteAt(data, 2) & ADDRESS_MASK,
      functionName: undefined,
      summaryKey: SUMMARY_TOKEN,
    };
  } else if (startDelimiter === SD1 || startDelimiter === SD3) {
    const total = startDelimiter === SD1 ? SD1_LENGTH : SD3_LENGTH;
    if (data.length < total) {
      return fail({
        code: 'truncated-frame',
        message: ERROR_TELEGRAM_TRUNCATED,
        recoverable: true,
        offset: 0,
        length: data.length,
        details: { availableBytes: data.length, requiredBytes: total },
      });
    }
    pushStartDelimiter(
      data,
      0,
      startDelimiter === SD1 ? 'SD1 — no data unit' : 'SD3 — fixed 8-byte data unit',
      fields,
    );
    const daExtended = pushAddress(fields, data, {
      id: 'destination-address',
      name: 'DA — Destination Address',
      offset: 1,
    });
    const saExtended = pushAddress(fields, data, {
      id: 'source-address',
      name: 'SA — Source Address',
      offset: 2,
    });
    const functionName = pushFunctionCode(fields, data, 3, warnings);

    let cursor = 4;
    const dataEnd = startDelimiter === SD1 ? 4 : 4 + SD3_DATA_LENGTH;
    if (startDelimiter === SD3) {
      if (daExtended) cursor = decodeAddressExtension(data, cursor, 'DAE', fields, warnings).next;
      if (saExtended) cursor = decodeAddressExtension(data, cursor, 'SAE', fields, warnings).next;
      pushUserData(data, cursor, dataEnd, fields, warnings);
    }

    pushChecksum(data, 1, dataEnd, dataEnd, fields, errors);
    pushEndDelimiter(data, dataEnd + 1, fields, errors);
    pushTrailing(data, total, fields, warnings);
    summaryParams['destination'] = `${byteAt(data, 1) & ADDRESS_MASK}`;
    summaryParams['source'] = `${byteAt(data, 2) & ADDRESS_MASK}`;
    summaryParams['function'] = functionName ?? formatHex(byteAt(data, 3), 2);
    outcome = {
      kind: startDelimiter === SD1 ? 'sd1' : 'sd3',
      destinationAddress: byteAt(data, 1) & ADDRESS_MASK,
      sourceAddress: byteAt(data, 2) & ADDRESS_MASK,
      functionName,
      summaryKey: SUMMARY_TELEGRAM,
    };
  } else {
    // SD2 — değişken uzunluk.
    if (data.length < SD2_OVERHEAD) {
      return fail({
        code: 'truncated-frame',
        message: ERROR_TELEGRAM_TRUNCATED,
        recoverable: true,
        offset: 0,
        length: data.length,
        details: { availableBytes: data.length, requiredBytes: SD2_OVERHEAD },
      });
    }
    const lengthField = byteAt(data, 1);
    const lengthRepeat = byteAt(data, 2);
    const total = lengthField + SD2_OVERHEAD;

    pushStartDelimiter(data, 0, 'SD2 — variable data unit', fields);
    const lengthInRange = lengthField >= SD2_MIN_LE && lengthField <= SD2_MAX_LE;
    pushField(fields, data, {
      id: 'length',
      name: 'LE — Length (DA + SA + FC + DU)',
      offset: 1,
      length: 1,
      rawValue: lengthField,
      physicalValue: `${lengthField}`,
      unit: 'B',
      valid: lengthInRange,
      warnings: lengthInRange ? [] : [ERROR_LENGTH_OUT_OF_RANGE],
    });
    if (!lengthInRange) {
      errors.push({
        code: 'value-out-of-range',
        message: ERROR_LENGTH_OUT_OF_RANGE,
        offset: 1,
        length: 1,
        details: { length: lengthField, min: SD2_MIN_LE, max: SD2_MAX_LE },
      });
    }
    const repeatMatches = lengthField === lengthRepeat;
    pushField(fields, data, {
      id: 'length-repeat',
      name: 'LEr — Length repeated',
      offset: 2,
      length: 1,
      rawValue: lengthRepeat,
      physicalValue: repeatMatches ? 'Matches LE' : `Differs from LE (${lengthField})`,
      valid: repeatMatches,
      warnings: repeatMatches ? [] : [ERROR_LENGTH_REPEAT_MISMATCH],
    });
    if (!repeatMatches) {
      errors.push({
        code: 'length-mismatch',
        message: ERROR_LENGTH_REPEAT_MISMATCH,
        offset: 2,
        length: 1,
        details: { length: lengthField, repeated: lengthRepeat },
      });
    }
    const secondStart = byteAt(data, 3);
    const secondMatches = secondStart === SD2;
    pushField(fields, data, {
      id: 'second-start-delimiter',
      name: 'SD2 — Start Delimiter repeated',
      offset: 3,
      length: 1,
      rawValue: secondStart,
      physicalValue: secondMatches ? formatHex(SD2, 2) : formatHex(secondStart, 2),
      valid: secondMatches,
      warnings: secondMatches ? [] : [ERROR_SECOND_START_MISMATCH],
    });
    if (!secondMatches) {
      errors.push({
        code: 'start-delimiter-not-found',
        message: ERROR_SECOND_START_MISMATCH,
        offset: 3,
        length: 1,
        details: { expected: formatHex(SD2, 2), actual: formatHex(secondStart, 2) },
      });
    }

    if (data.length < total || !lengthInRange || !repeatMatches) {
      // Uzunluk güvenilmez: kalan baytlar ham gösterilir, alan UYDURULMAZ.
      if (data.length > 4) {
        pushField(fields, data, {
          id: `unparsed-${4}`,
          name: 'Unparsed Bytes',
          offset: 4,
          length: data.length - 4,
          unit: 'B',
          warnings: [ERROR_TELEGRAM_TRUNCATED],
        });
      }
      if (data.length < total && lengthInRange && repeatMatches) {
        errors.push({
          code: 'truncated-frame',
          message: ERROR_TELEGRAM_TRUNCATED,
          offset: data.length,
          length: total - data.length,
          details: { availableBytes: data.length, requiredBytes: total },
        });
      }
      summaryParams['destination'] = formatHex(byteAt(data, 4), 2);
      summaryParams['source'] = formatHex(byteAt(data, 5), 2);
      summaryParams['function'] = formatHex(byteAt(data, 6), 2);
      outcome = {
        kind: 'sd2',
        destinationAddress: undefined,
        sourceAddress: undefined,
        functionName: undefined,
        summaryKey: SUMMARY_TELEGRAM,
      };
    } else {
      const daExtended = pushAddress(fields, data, {
        id: 'destination-address',
        name: 'DA — Destination Address',
        offset: 4,
      });
      const saExtended = pushAddress(fields, data, {
        id: 'source-address',
        name: 'SA — Source Address',
        offset: 5,
      });
      const functionName = pushFunctionCode(fields, data, 6, warnings);

      let cursor = 7;
      const dataEnd = 4 + lengthField;
      if (daExtended) cursor = decodeAddressExtension(data, cursor, 'DAE', fields, warnings).next;
      if (saExtended) cursor = decodeAddressExtension(data, cursor, 'SAE', fields, warnings).next;
      pushUserData(data, cursor, dataEnd, fields, warnings);

      pushChecksum(data, 4, dataEnd, dataEnd, fields, errors);
      pushEndDelimiter(data, dataEnd + 1, fields, errors);
      pushTrailing(data, total, fields, warnings);
      summaryParams['destination'] = `${byteAt(data, 4) & ADDRESS_MASK}`;
      summaryParams['source'] = `${byteAt(data, 5) & ADDRESS_MASK}`;
      summaryParams['function'] = functionName ?? formatHex(byteAt(data, 6), 2);
      outcome = {
        kind: 'sd2',
        destinationAddress: byteAt(data, 4) & ADDRESS_MASK,
        sourceAddress: byteAt(data, 5) & ADDRESS_MASK,
        functionName,
        summaryKey: SUMMARY_TELEGRAM,
      };
    }
  }

  const metadata: ProfibusDpFrameMetadata = {
    telegramKind: outcome.kind,
    destinationAddress: outcome.destinationAddress,
    sourceAddress: outcome.sourceAddress,
    functionName: outcome.functionName,
    summaryKey: outcome.summaryKey,
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

export function parseProfibusDp(data: Uint8Array): ParseResult {
  return parseProfibusDpFrame(data, {});
}

export const profibusDpParser: ProtocolParser = {
  protocolId: PROTOCOL_ID,
  displayName: PROTOCOL_DISPLAY_NAME,

  /** Ucuz ön eleme: tanınan bir başlangıç sınırlayıcısı + asgari boy. */
  canParse(data: Uint8Array): boolean {
    if (data.length === 0) return false;
    switch (byteAt(data, 0)) {
      case SHORT_ACK:
        return data.length === 1;
      case SD4:
        return data.length >= SD4_LENGTH;
      case SD1:
        return data.length >= SD1_LENGTH;
      case SD3:
        return data.length >= SD3_LENGTH;
      case SD2:
        return data.length >= SD2_OVERHEAD;
      default:
        return false;
    }
  },

  parse(data: Uint8Array, context?: ParseContext): ParseResult {
    const options: ProfibusDpParseOptions = {};
    if (context?.timestamp !== undefined) options.timestamp = context.timestamp;
    if (context?.direction !== undefined) options.direction = context.direction;
    if (context?.channel !== undefined) options.channel = context.channel;
    if (context?.maxFrameLength !== undefined) options.maxFrameLength = context.maxFrameLength;
    if (context?.signal !== undefined) options.signal = context.signal;
    return parseProfibusDpFrame(data, options);
  },
};

// ── Örnek çerçeveler ────────────────────────────────────────────────────────
// FCS `sum8Checksum`ın KENDİSİYLE hesaplanır, elle yazılmaz: bir alan
// değişirse örnek de doğru kalır. Bir örnek FCS'i BİLEREK bozar.
// `sd1-fdl-status-request` R'nin birim testindeki GERÇEK telgrafın aynısıdır
// (`10 22 02 49 6D 16`) — bağımsız bir yığının doğrulanmış vektörü.

function sd1(destination: number, source: number, functionCode: number): Uint8Array {
  const body = [destination, source, functionCode];
  return Uint8Array.from([SD1, ...body, sum8Checksum(Uint8Array.from(body)), END_DELIMITER]);
}

function sd2(
  destination: number,
  source: number,
  functionCode: number,
  dataUnit: readonly number[],
  options?: { readonly breakChecksum?: boolean; readonly lengthOverride?: number },
): Uint8Array {
  const body = [destination, source, functionCode, ...dataUnit];
  const length = options?.lengthOverride ?? body.length;
  let fcs = sum8Checksum(Uint8Array.from(body));
  if (options?.breakChecksum === true) fcs = (fcs + 1) & 0xff;
  return Uint8Array.from([SD2, length, length, SD2, ...body, fcs, END_DELIMITER]);
}

function sd3(
  destination: number,
  source: number,
  functionCode: number,
  dataUnit: readonly number[],
): Uint8Array {
  const body = [destination, source, functionCode, ...dataUnit];
  return Uint8Array.from([SD3, ...body, sum8Checksum(Uint8Array.from(body)), END_DELIMITER]);
}

const EXAMPLE_FRAMES: ExampleFrame[] = [
  {
    id: 'sd1-fdl-status-request',
    name: 'protocol.profibusDp.example.sd1FdlStatusRequest.name',
    // profirust'ın birim testindeki gerçek telgraf: 10 22 02 49 6D 16.
    bytes: sd1(0x22, 0x02, 0x49),
    description: 'protocol.profibusDp.example.sd1FdlStatusRequest.description',
    expectedValid: true,
  },
  {
    id: 'sd1-fdl-status-response',
    name: 'protocol.profibusDp.example.sd1FdlStatusResponse.name',
    // FC 0x20: istek biti sıfır, istasyon tipi 2 (token halkasına hazır master).
    bytes: sd1(0x02, 0x22, 0x20),
    description: 'protocol.profibusDp.example.sd1FdlStatusResponse.description',
    expectedValid: true,
  },
  {
    id: 'sd2-set-parameters',
    name: 'protocol.profibusDp.example.sd2SetParameters.name',
    // DA/SA'nın bit 7'si set → DAE (SAP 61 Set_Prm) ve SAE (SAP 62 master MS0).
    bytes: sd2(0x83, 0x82, 0x5d, [61, 62, 0xb8, 0x00, 0x64, 0x00, 0x0a, 0x37, 0x05]),
    description: 'protocol.profibusDp.example.sd2SetParameters.description',
    expectedValid: true,
  },
  {
    id: 'sd2-slave-diagnosis-request',
    name: 'protocol.profibusDp.example.sd2SlaveDiagnosisRequest.name',
    bytes: sd2(0x83, 0x82, 0x6d, [60, 62]),
    description: 'protocol.profibusDp.example.sd2SlaveDiagnosisRequest.description',
    expectedValid: true,
  },
  {
    id: 'sd2-data-exchange',
    name: 'protocol.profibusDp.example.sd2DataExchange.name',
    // Adres uzantısı YOK: Data Exchange varsayılan SAP'siz servistir.
    bytes: sd2(0x03, 0x02, 0x7d, [0x05, 0x00, 0x00, 0x00]),
    description: 'protocol.profibusDp.example.sd2DataExchange.description',
    expectedValid: true,
  },
  {
    id: 'sd2-response-data-low',
    name: 'protocol.profibusDp.example.sd2ResponseDataLow.name',
    // FC 0x08: yanıt, istasyon tipi 0 (slave), durum 8 (DL — data low).
    bytes: sd2(0x02, 0x03, 0x08, [0x01, 0x02]),
    description: 'protocol.profibusDp.example.sd2ResponseDataLow.description',
    expectedValid: true,
  },
  {
    id: 'sd3-fixed-data',
    name: 'protocol.profibusDp.example.sd3FixedData.name',
    bytes: sd3(0x03, 0x02, 0x7d, [0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77, 0x88]),
    description: 'protocol.profibusDp.example.sd3FixedData.description',
    expectedValid: true,
  },
  {
    id: 'sd4-token',
    name: 'protocol.profibusDp.example.sd4Token.name',
    bytes: Uint8Array.from([SD4, 0x03, 0x02]),
    description: 'protocol.profibusDp.example.sd4Token.description',
    expectedValid: true,
  },
  {
    id: 'short-acknowledgement',
    name: 'protocol.profibusDp.example.shortAcknowledgement.name',
    bytes: Uint8Array.from([SHORT_ACK]),
    description: 'protocol.profibusDp.example.shortAcknowledgement.description',
    expectedValid: true,
  },
  {
    id: 'sd2-global-control',
    name: 'protocol.profibusDp.example.sd2GlobalControl.name',
    // Yayın: DA 127 + uzantı biti; DAE SAP 58 (Global Control).
    bytes: sd2(0xff, 0x82, 0x5d, [58, 62, 0x04, 0x00]),
    description: 'protocol.profibusDp.example.sd2GlobalControl.description',
    expectedValid: true,
  },
  {
    id: 'checksum-mismatch',
    name: 'protocol.profibusDp.example.checksumMismatch.name',
    bytes: sd2(0x03, 0x02, 0x7d, [0x05, 0x00, 0x00, 0x00], { breakChecksum: true }),
    description: 'protocol.profibusDp.example.checksumMismatch.description',
    expectedValid: false,
  },
  {
    id: 'length-repeat-mismatch',
    name: 'protocol.profibusDp.example.lengthRepeatMismatch.name',
    // LEr KASTEN farklı: uzunluk güvenilmez, alanlar UYDURULMAZ.
    bytes: Uint8Array.from([SD2, 0x07, 0x08, SD2, 0x03, 0x02, 0x7d, 0x05, 0x00, 0x00, 0x00, 0x87, END_DELIMITER]),
    description: 'protocol.profibusDp.example.lengthRepeatMismatch.description',
    expectedValid: false,
  },
  {
    id: 'end-delimiter-invalid',
    name: 'protocol.profibusDp.example.endDelimiterInvalid.name',
    bytes: Uint8Array.from([SD1, 0x22, 0x02, 0x49, 0x6d, 0x00]),
    description: 'protocol.profibusDp.example.endDelimiterInvalid.description',
    expectedValid: false,
  },
  {
    id: 'unknown-start-delimiter',
    name: 'protocol.profibusDp.example.unknownStartDelimiter.name',
    bytes: Uint8Array.from([0x55, 0x22, 0x02, 0x49, 0x6d, 0x16]),
    description: 'protocol.profibusDp.example.unknownStartDelimiter.description',
    expectedValid: false,
  },
];

export const profibusDpPlugin: ProtocolPlugin = {
  id: PROTOCOL_ID,
  name: PROTOCOL_DISPLAY_NAME,
  category: 'industrial-automation',
  parser: profibusDpParser,
  documentation: {
    summary: 'protocol.profibusDp.documentation.summary',
    layer: 'multi-layer',
    references: [
      {
        title: 'pyprofibus (GPL-2.0) — PROFIBUS-DP stack, pyprofibus/fdl.py FdlTelegram',
        url: 'https://github.com/mbuesch/pyprofibus',
      },
      {
        title: 'profirust (Apache-2.0) — PROFIBUS-DP stack in Rust, src/fdl/telegram.rs',
        url: 'https://github.com/Rahix/profirust',
      },
      {
        title: 'felser.ch PROFIBUS Manual — Telegram formats',
        url: 'https://felser.ch/profibus-manual/telegrammformate.html',
      },
    ],
  },
  exampleFrames: EXAMPLE_FRAMES,
};
