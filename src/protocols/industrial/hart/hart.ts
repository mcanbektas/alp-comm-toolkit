/**
 * HART (Highway Addressable Remote Transducer, FieldComm Group) — 4-20 mA analog
 * akım ilmiğinin üstüne bindirilmiş FSK dijital haberleşme. Bir DCS/PLC, HART
 * modemi üzerinden loop'taki transmitter/actuator ile Universal/Common Practice/
 * Device-Specific komutlarla konuşur; analog süreç değeri ile dijital HART PV
 * ayrı gösterilir (spec özeti).
 *
 * Faz 10, dalga 13h. `process-instrumentation` ailesinin TEK kaydı; bu kayıtla
 * aile KAPANIR.
 *
 * ── GİRDİ: SERİ HART ÇERÇEVESİ, HART-IP DEĞİL ────────────────────────────────
 * Girdi, RS-485/loop üzerinden okunmuş TEK bir seri HART mesajıdır (Preamble +
 * Start Delimiter + Address + Command + Byte Count + [Status] + Data +
 * Checksum). **HART-IP (TCP/UDP port 5094, Wireshark `packet-hartip.c`) FARKLI
 * BİR TAŞIYICIDIR** — kendi TCP/UDP zarfı vardır, preamble/start-delimiter
 * taşımaz ve bu motorun girdisi DEĞİLDİR (brief'in açık uyarısı). Bu dosya
 * yalnız seri fiziksel katmandaki mesajı çözer.
 *
 * PROFIBUS/AS-i'nin aksine HART'ın preamble'ı UART'ın GÖRÜNMEZ start/parity/
 * stop bitleri DEĞİLDİR: 0xFF baytları tekrarı tel üzerinde GERÇEKTEN VAR OLAN,
 * bayt-seviyesinde yakalanabilir baytlardır (iki bağımsız açık kaynak
 * uygulaması da preamble'ı AYNI bayt dizisinin içinde sayıp atlıyor, ayrı bir
 * bit-seviyesi girdi istemiyor). Bu yüzden `dali.ts`/`profibusDp.ts`in "fiziksel
 * katman decoder'a sızmaz" kuralı BURADA TERSİNE döner: preamble kasıtlı olarak
 * bir ALAN olarak çözülüp gösterilir.
 *
 * ── KAYNAK: İKİ BAĞIMSIZ, ÇALIŞAN AÇIK KAYNAK UYGULAMASI — ÇAPRAZ TEYİTLİ ────
 * FieldComm Group'un resmi Data Link Layer spec'i ücretlidir ve bu depoda
 * YOKTUR. Alan yerleşimi ve ÖZELLİKLE checksum kapsamı İKİ BAĞIMSIZ, GERÇEKTEN
 * ÇALIŞAN (testli) açık kaynak uygulamasından ÇAPRAZ TEYİTLİ (ikisine de bu
 * oturumda gerçekten erişildi, KOD KOPYALANMADI — yalnız davranış cross-check
 * edildi):
 *   Y = **yaq-project/hart-protocol** (Python, sans-I/O, MIT) —
 *       `hart_protocol/tools.py` `pack_command()`: checksum
 *       `calculate_checksum(command[5:])` — yani PREAMBLE'IN 5 baytı ATLANIR,
 *       start karakterinden (0x82 …) itibaren her şey XOR'lanır.
 *       `hart_protocol/_unpacker.py`in `Unpacker.__next__`ı yanıt yönünde de
 *       aynısını yapar: `calculate_checksum(self.buf[2:response_length-1])` —
 *       buf[2] tam start karakteridir (iki preamble baytı zaten atlanmış),
 *       dilim checksum baytının kendisini KAPSAMAZ.
 *       https://github.com/yaq-project/hart-protocol
 *   J = **jszumigaj/hart** (Go, bağımsız yazar, MIT) — `frame.go`:
 *       `crc := calcCrc(buffer[frame.preambles:index])` (index tam checksum
 *       baytının konumu, dahil değil) ve `calcCrc` düz `crc ^= b` XOR'udur.
 *       Paketin KENDİ birim testleri (`frame_test.go`) dört GERÇEK, elle
 *       DOĞRULANMIŞ vektör veriyor (bu dosyanın `EXAMPLE_FRAMES`'i bunlardan
 *       üçünü BİREBİR kullanır): kısa istek (delim 0x02, adres 0, komut 0,
 *       veri yok) → CRC 0x02; kısa yanıt (delim 0x06, adres 0, komut 0, status
 *       `00 40`, 12 baytlık veri) → CRC 0xA3; uzun istek (delim 0x82, adres
 *       `3C 7B 12 31 E1`, komut 0) → CRC 0x07. Üçü de bu dosyada elle XOR'la
 *       yeniden hesaplanıp DOĞRULANDI, kör kör alınmadı.
 *       https://github.com/jszumigaj/hart
 * **SONUÇ — brief'in 2. açık sorusu ÇÖZÜLDÜ:** `protocol-core/checksums/lrc.ts`
 * SAHTE DOSTTUR (`twosComplementChecksum`a delege eder — Modbus ASCII'nin iki'nin
 * tümleyeni LRC'si, HART'la ilgisi YOK). Doğru checksum
 * **`protocol-core/checksums/simpleChecksums.ts`teki `xor8Checksum`**tır ve
 * PAYLAŞILDI (ayrı bir XOR fonksiyonu yazılmadı — 13b'nin `sum8Checksum`,
 * 13g'nin FCS paylaşımı deseni). Kapsadığı baytlar: **Start Delimiter'DAN
 * (dahil) son veri baytına (dahil) kadar** — Preamble HARİÇ, checksum baytının
 * KENDİSİ HARİÇ. Address/Command/Byte Count/Status hepsi kapsam İÇİNDEDİR.
 *
 * ── BİR KAYNAK İDDİASI REDDEDİLDİ — "0 uzun / 8 kısa" ─────────────────────────
 * Birkaç ikincil web kaynağı (ayrıştırılamayan/kopyala-yapıştır SEO metni)
 * "delimiter 0 ile başlıyorsa uzun adresleme, 8 ile başlıyorsa kısa" diyor.
 * Bu, AYNI kaynakların KENDİ tablosuyla ÇELİŞİYOR ve İKİ bağımsız çalışan
 * uygulamayla (Y, J) da TERS: `MasterToSlaveLongFrame = 0x82` (üst bit 1),
 * `MasterToSlaveShortFrame = 0x02` (üst bit 0) — yani üst bit SET ise UZUN,
 * clear ise KISA — J'nin dört testinin checksum'ı da yalnız bu atamayla
 * doğru çıkıyor (elle doğrulandı). O cümle REDDEDİLDİ; kod ve tabloya güvenildi.
 *
 * ── ADRES BİÇİMİ: START DELIMITER'DAN ÇIKAR, decodeOptions AÇILMADI ──────────
 * Kısa/uzun adres seçimi delimiter baytının üst bitinde (0x80) yazılıdır —
 * `iec-60870-5-104`ün "kanal frameden çıkarılabiliyorsa AÇMA" ölçütü (brief'in
 * kendi hatırlatması: "HART'ta adres biçimi start delimiter'dan çıkıyorsa kanal
 * AÇMA"). Her iki biçimde de adres baytının/baytlarının EN ÜST biti (bit 7)
 * primary/secondary master bayrağıdır (J'nin `IsPrimaryMaster()`ı KISA ve UZUN
 * biçimde AYNI bit maskesini kullanıyor — kanıt).
 *
 * ── KISA ADRESİN ALT 7 BİTİ: SAYISAL DEĞER, ALT-BİT İDDİASI YOK ──────────────
 * Bazı ikincil kaynaklar kısa adresin alt bitlerini "bit 6 burst bayrağı + bit
 * 3-0 poll adresi (16 adres, HART 5)" diye bölüyor; ama İKİ bağımsız çalışan
 * uygulama da (Y, J) burst'ü ADRES baytından DEĞİL, DELIMITER baytından
 * (0x01/0x81) okuyor — adres baytında ayrı bir burst biti YOK. Bu ayrıca
 * HART revizyonuna göre değişebilen bir alan (brief'in kendi notu). Bu yüzden
 * kısa adresin alt 7 biti TEK bir "Polling address" sayısal alanı olarak
 * gösterilir; alt-bit kırılımı UYDURULMAZ.
 *
 * ── BURST ÇERÇEVESİ: YAPISI YANIT'la AYNI VARSAYILIYOR, İNCE KAYNAKLI ────────
 * Delimiter tablosu burst'ü (0x01/0x81) request/response'un YANINDA üçüncü bir
 * değer olarak listeliyor (aynı kısa/uzun eşleşmesi, yalnız istemsiz gönderim).
 * İKİ kod kaynağı da (Y, J) burst çerçevesini AYRIŞTIRMIYOR (J'nin switch'i
 * `default: return nil, false` ile reddediyor). Bu motor burst'ü yapısal olarak
 * yanıtla AYNI (2 status baytı + data) VARSAYAR — delimiter eşleşme deseninden
 * ve genel HART bilgisinden çıkarılan, ama İKİ koddan BAĞIMSIZ doğrulanmamış
 * bir çıkarım — her burst çözümünde `WARN_BURST_STATUS_LAYOUT_INFERRED` basılır.
 *
 * ── KOMUT SINIFLARI DOĞRULANDI ─────────────────────────────────────────────
 * Universal 0-30, Common Practice 32-126, Device-Specific 128-253 (31/127/
 * 254/255 ayrılmış/tanımsız) — FieldComm Group'a atıfla genel arama sonuçları
 * bu üç aralıkta hemfikir. Tek tek komut adları Y'nin `_parsing.py`/`common.py`
 * dosyalarındaki isim tablosundan (0,1,2,3,6,11-19 Universal; 37,38,42,48,50,
 * 59,66-68,123 Common Practice) alındı — sınıfı bilinen ama isim tablosunda
 * olmayan komutlar SINIF adıyla gösterilir, UYDURULMAZ.
 *
 * ── DATA HAM BIRAKILIR — SAHTE ALAN KIRILIMI YOK ─────────────────────────────
 * Data alanının yapısı KOMUTA göre değişir (~200 farklı komut, her biri kendi
 * response şemasına sahip — Command 0 kimlik alanları, Command 1/2/3 IEEE-754
 * float'lar, Command 12/13 metin, vb.). Tek bir yakalamadan hangi komutun
 * gövdesi olduğu bilinse bile ~200 şemayı elle kodlamak bu motorun kapsamı
 * dışıdır (profibusDp.ts'in DU'su ve foundationFieldbus.ts'in gövdesiyle AYNI
 * karar). Data TEK PARÇA ham basılır, `WARN_DATA_IS_COMMAND_SPECIFIC` ile
 * nedeni söylenir.
 *
 * ── STATUS: 'ready' — GEREKÇE (`profibusDp.ts` ölçütü) ───────────────────────
 * Çerçevenin HER ZARF ALANI adlandırılıp çözülür: Preamble, Start Delimiter
 * (6 tanınan değer), Address (kısa/uzun, master tipi bayrağı dahil), Command
 * (sınıf + isim), Byte Count, Response Code (iletişim hatası bayrakları ile
 * komuta özel durum ayrımı dahil), Device Status (8 bayrak), Checksum.
 * Protokolün kendi tanımladığı doğrulama (checksum) GERÇEKTEN YAPILIR ve
 * uyuşmazlıkta hata basılır. Ham kalan TEK bölge Data'dır ve bu YAPISAL bir
 * eksik değil, KOMUTA-BAĞIMLI içeriktir (yukarı bak) — `profibusDp.ts`in DU'su
 * `ready` rozetini engellemedi, burada da engellemez.
 *
 * ── decodeOptions: AÇILMADI, GEREKÇESİ ───────────────────────────────────────
 *  1. "Kısa mı uzun mu adres" → delimiter baytından çıkar (yukarı).
 *  2. "İstek mi yanıt mı mı burst mü" → delimiter baytından çıkar.
 *  3. "Data nasıl kırılsın" → komuta göre ~200 farklı şema; bir `select` alanına
 *     SIĞMAZ (foundationFieldbus.ts'in servis gövdesi kararının aynısı).
 *
 * ── KAPSAM DIŞI (dosya başında AÇIKÇA) ───────────────────────────────────────
 *  • **HART-IP**: farklı taşıyıcı, ayrı motor gerektirir (yukarı).
 *  • **Komuta özel Data yorumlama**: yukarı.
 *  • **Analog 4-20 mA döngü değerinin kendisi**: bu motorun girdisi dijital
 *    HART baytlarıdır; loop akımı ayrı bir donanım/ölçüm katmanı (spec özeti
 *    "Analog Process Value ile Digital HART ayrı gösterilir" zaten ayrıştırıyor).
 *  • **Çok mesajlı analiz**: burst periyodikliği, retry sayımı, master/slave
 *    token — `ethercat.ts`in "analyzer sınırı" emsali.
 */

import { xor8Checksum } from '@/protocol-core/checksums/simpleChecksums';
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
const PROTOCOL_ID = 'hart';
/** Protokol adı veridir, çeviriye girmez (CLAUDE.md). */
const PROTOCOL_DISPLAY_NAME = 'HART';

const PREAMBLE_BYTE = 0xff;
const HEX_RADIX = 16;

/** Adres baytı: bit 7 primary/secondary master bayrağı, bit 6-0 değer (Y, J). */
const ADDRESS_MASTER_TYPE_FLAG = 0x80;
const ADDRESS_VALUE_MASK = 0x7f;
const SHORT_ADDRESS_LENGTH = 1;
const LONG_ADDRESS_LENGTH = 5;

const STATUS_BYTES_LENGTH = 2;
/** Response Code baytı: bit 7 set ise iletişim hatası bayrakları, clear ise komuta özel durum. */
const RESPONSE_CODE_COMM_ERROR_FLAG = 0x80;
const RESPONSE_CODE_FLAGS_MASK = 0x7f;

const UNIVERSAL_COMMAND_MAX = 30;
const COMMON_PRACTICE_COMMAND_MIN = 32;
const COMMON_PRACTICE_COMMAND_MAX = 126;
const DEVICE_SPECIFIC_COMMAND_MIN = 128;
const DEVICE_SPECIFIC_COMMAND_MAX = 253;

export const ERROR_EMPTY_INPUT = 'protocol.hart.error.emptyInput';
export const ERROR_FRAME_TOO_LONG = 'protocol.hart.error.frameTooLong';
export const ERROR_ABORTED = 'protocol.hart.error.aborted';
export const ERROR_NO_DELIMITER_FOUND = 'protocol.hart.error.noDelimiterFound';
export const ERROR_DELIMITER_UNKNOWN = 'protocol.hart.error.delimiterUnknown';
export const ERROR_FRAME_TRUNCATED = 'protocol.hart.error.frameTruncated';
export const ERROR_CHECKSUM_MISMATCH = 'protocol.hart.error.checksumMismatch';

export const WARN_COMMAND_NOT_NAMED = 'protocol.hart.warning.commandNotNamed';
export const WARN_COMMAND_RANGE_RESERVED = 'protocol.hart.warning.commandRangeReserved';
export const WARN_RESPONSE_CODE_NOT_NAMED = 'protocol.hart.warning.responseCodeNotNamed';
export const WARN_DATA_IS_COMMAND_SPECIFIC = 'protocol.hart.warning.dataIsCommandSpecific';
export const WARN_BURST_STATUS_LAYOUT_INFERRED = 'protocol.hart.warning.burstStatusLayoutInferred';
export const WARN_TRAILING_BYTES = 'protocol.hart.warning.trailingBytes';

const SUMMARY_REQUEST = 'protocol.hart.summary.request';
const SUMMARY_RESPONSE = 'protocol.hart.summary.response';
const SUMMARY_BURST = 'protocol.hart.summary.burst';

/** Sınırlayıcı tablosu — Y `hart_protocol/_unpacker.py` ve J `frame.go` BİREBİR aynı 6 değer. */
interface DelimiterInfo {
  readonly long: boolean;
  readonly kind: 'request' | 'response' | 'burst';
}

const DELIMITER_INFO: ReadonlyMap<number, DelimiterInfo> = new Map([
  [0x02, { long: false, kind: 'request' }],
  [0x82, { long: true, kind: 'request' }],
  [0x06, { long: false, kind: 'response' }],
  [0x86, { long: true, kind: 'response' }],
  [0x01, { long: false, kind: 'burst' }],
  [0x81, { long: true, kind: 'burst' }],
]);

type CommandClass = 'universal' | 'common-practice' | 'device-specific';

const COMMAND_CLASS_LABELS: Record<CommandClass, string> = {
  universal: 'Universal',
  'common-practice': 'Common Practice',
  'device-specific': 'Device-Specific',
};

function classifyCommand(code: number): CommandClass | undefined {
  if (code <= UNIVERSAL_COMMAND_MAX) return 'universal';
  if (code >= COMMON_PRACTICE_COMMAND_MIN && code <= COMMON_PRACTICE_COMMAND_MAX) return 'common-practice';
  if (code >= DEVICE_SPECIFIC_COMMAND_MIN && code <= DEVICE_SPECIFIC_COMMAND_MAX) return 'device-specific';
  return undefined;
}

/** Y `_parsing.py`/`common.py`teki isim tablosundan — yalnız isimlendirilmiş komutlar. */
const UNIVERSAL_COMMAND_NAMES: ReadonlyMap<number, string> = new Map([
  [0, 'Read Unique Identifier'],
  [1, 'Read Primary Variable'],
  [2, 'Read Loop Current and Percent of Range'],
  [3, 'Read Dynamic Variables and Loop Current'],
  [6, 'Write Polling Address'],
  [11, 'Read Unique Identifier Associated with Tag'],
  [12, 'Read Message'],
  [13, 'Read Tag, Descriptor, Date'],
  [14, 'Read Primary Variable Sensor Information'],
  [15, 'Read Output Information'],
  [16, 'Read Final Assembly Number'],
  [17, 'Write Message'],
  [18, 'Write Tag, Descriptor, Date'],
  [19, 'Write Final Assembly Number'],
]);

const COMMON_PRACTICE_COMMAND_NAMES: ReadonlyMap<number, string> = new Map([
  [37, 'Set Primary Variable Lower Range Value'],
  [38, 'Reset Configuration Changed Flag'],
  [42, 'Perform Master Reset'],
  [48, 'Read Additional Transmitter Status'],
  [50, 'Read Dynamic Variable Assignments'],
  [59, 'Write Number of Response Preambles'],
  [66, 'Toggle Analog Output Mode'],
  [67, 'Trim Analog Output Zero'],
  [68, 'Trim Analog Output Span'],
  [123, 'Select Baud Rate'],
]);

function lookupCommandName(commandClass: CommandClass | undefined, command: number): string | undefined {
  if (commandClass === 'universal') return UNIVERSAL_COMMAND_NAMES.get(command);
  if (commandClass === 'common-practice') return COMMON_PRACTICE_COMMAND_NAMES.get(command);
  return undefined;
}

/** Device Status baytı — 8 bayrak, iki bağımsız kaynakta (Y'nin blog denklemi, J'nin `fieldDeviceStatus.go`) bit-bit aynı. */
const DEVICE_STATUS_FLAGS: ReadonlyArray<{ readonly mask: number; readonly label: string }> = [
  { mask: 0x80, label: 'Device malfunction' },
  { mask: 0x40, label: 'Configuration changed' },
  { mask: 0x20, label: 'Cold start' },
  { mask: 0x10, label: 'More status available' },
  { mask: 0x08, label: 'Primary variable analog output fixed' },
  { mask: 0x04, label: 'Primary variable analog output saturated' },
  { mask: 0x02, label: 'Non-primary variable out of limits' },
  { mask: 0x01, label: 'Primary variable out of limits' },
];

/** Response Code, bit 7 SET iken alt 7 bit — J'nin `communicationsErrorSummaryFlags.go`. */
const COMMUNICATION_ERROR_FLAGS: ReadonlyArray<{ readonly mask: number; readonly label: string }> = [
  { mask: 0x40, label: 'Vertical parity error' },
  { mask: 0x20, label: 'Overrun error' },
  { mask: 0x10, label: 'Framing error' },
  { mask: 0x08, label: 'Longitudinal parity error' },
  { mask: 0x04, label: 'Reserved' },
  { mask: 0x02, label: 'Buffer overflow' },
  { mask: 0x01, label: 'Undefined' },
];

/** Response Code, bit 7 CLEAR iken tüm bayt — J'nin `commandSpecificStatus.go`. */
const COMMAND_SPECIFIC_STATUS_NAMES: ReadonlyMap<number, string> = new Map([
  [0, 'No command-specific errors'],
  [2, 'Invalid selection'],
  [3, 'Passed parameter too large'],
  [4, 'Passed parameter too small'],
  [5, 'Too few data bytes received'],
  [6, 'Device-specific command error'],
  [7, 'In write-protect mode'],
  [8, 'Update failure (warning)'],
  [16, 'Access restricted'],
  [32, 'Busy'],
  [64, 'Command not implemented'],
]);

function describeFlags(
  value: number,
  table: ReadonlyArray<{ readonly mask: number; readonly label: string }>,
  allClearLabel: string,
): string {
  const active = table.filter((entry) => (value & entry.mask) !== 0).map((entry) => entry.label);
  return active.length === 0 ? allClearLabel : active.join(', ');
}

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

export type HartFrameMetadata = {
  messageKind: 'request' | 'response' | 'burst';
  addressForm: 'short' | 'long';
  command: number;
  commandName: string | undefined;
  summaryKey: string;
  summaryParams: Record<string, string>;
};

interface HartParseOptions {
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

/** İstek/yanıt/burst ve kısa/uzun kombinasyonunun okunur etiketi. */
function describeDelimiter(info: DelimiterInfo): string {
  const direction = info.kind === 'request' ? 'Master → Slave' : 'Slave → Master';
  const frameForm = info.long ? 'Long frame (unique address)' : 'Short frame (polling address)';
  const kindSuffix = info.kind === 'burst' ? ' · Burst (unsolicited)' : info.kind === 'response' ? ' · Response' : '';
  return `${direction} · ${frameForm}${kindSuffix}`;
}

/** Kısa adres: bit 7 master tipi, bit 6-0 poll adresi (sayısal, alt-bit iddiası yok — dosya başı). */
function pushShortAddress(fields: ParsedField[], data: Uint8Array, offset: number): string {
  const raw = byteAt(data, offset);
  const primary = (raw & ADDRESS_MASTER_TYPE_FLAG) !== 0;
  pushField(fields, data, {
    id: 'address-master-type',
    name: 'Address — Master type (bit 7)',
    offset,
    length: 1,
    rawValue: primary ? 1 : 0,
    physicalValue: primary ? 'Primary master' : 'Secondary master',
  });
  const pollingAddress = raw & ADDRESS_VALUE_MASK;
  pushField(fields, data, {
    id: 'address',
    name: 'Address — Polling address (bits 6-0)',
    offset,
    length: 1,
    rawValue: pollingAddress,
    physicalValue: `${pollingAddress}`,
  });
  return `${pollingAddress}`;
}

/** Uzun adres: master tipi + Manufacturer ID(7 bit) + Device Type + 24 bit Device ID (Y'nin blog örneği). */
function pushLongAddress(fields: ParsedField[], data: Uint8Array, offset: number): string {
  const raw0 = byteAt(data, offset);
  const primary = (raw0 & ADDRESS_MASTER_TYPE_FLAG) !== 0;
  pushField(fields, data, {
    id: 'address-master-type',
    name: 'Address — Master type (bit 7)',
    offset,
    length: 1,
    rawValue: primary ? 1 : 0,
    physicalValue: primary ? 'Primary master' : 'Secondary master',
  });
  const manufacturerId = raw0 & ADDRESS_VALUE_MASK;
  pushField(fields, data, {
    id: 'address-manufacturer-id',
    name: 'Address — Manufacturer ID (bits 6-0)',
    offset,
    length: 1,
    rawValue: manufacturerId,
    physicalValue: `${manufacturerId}`,
  });
  const deviceType = byteAt(data, offset + 1);
  pushField(fields, data, {
    id: 'address-device-type',
    name: 'Address — Manufacturer Device Type',
    offset: offset + 1,
    length: 1,
    rawValue: deviceType,
    physicalValue: `${deviceType}`,
  });
  const deviceId =
    (byteAt(data, offset + 2) << 16) | (byteAt(data, offset + 3) << 8) | byteAt(data, offset + 4);
  pushField(fields, data, {
    id: 'address-device-id',
    name: 'Address — Device ID',
    offset: offset + 2,
    length: 3,
    rawValue: deviceId,
    physicalValue: `${deviceId}`,
  });
  return `${manufacturerId}:${deviceType}:${deviceId}`;
}

function pushResponseCode(fields: ParsedField[], data: Uint8Array, offset: number, warnings: WarningSink): void {
  const raw = byteAt(data, offset);
  const isCommError = (raw & RESPONSE_CODE_COMM_ERROR_FLAG) !== 0;
  if (isCommError) {
    const flagsValue = raw & RESPONSE_CODE_FLAGS_MASK;
    pushField(fields, data, {
      id: 'response-code',
      name: 'Response Code — Communication error flags (bit 7 set)',
      offset,
      length: 1,
      rawValue: flagsValue,
      physicalValue: describeFlags(flagsValue, COMMUNICATION_ERROR_FLAGS, 'No communication error flags set'),
    });
    return;
  }
  const name = COMMAND_SPECIFIC_STATUS_NAMES.get(raw);
  if (name === undefined) warnings.push(WARN_RESPONSE_CODE_NOT_NAMED);
  pushField(fields, data, {
    id: 'response-code',
    name: 'Response Code — Command-specific status (bit 7 clear)',
    offset,
    length: 1,
    rawValue: raw,
    physicalValue: name ?? formatHex(raw, 2),
    valid: name !== undefined,
    warnings: name === undefined ? [WARN_RESPONSE_CODE_NOT_NAMED] : [],
  });
}

function pushDeviceStatus(fields: ParsedField[], data: Uint8Array, offset: number): void {
  const raw = byteAt(data, offset);
  pushField(fields, data, {
    id: 'device-status',
    name: 'Device Status',
    offset,
    length: 1,
    rawValue: raw,
    physicalValue: describeFlags(raw, DEVICE_STATUS_FLAGS, 'OK'),
  });
}

/** Checksum: Y `pack_command`/`Unpacker` ve J `calcCrc` ile ÜÇ vektörde elle doğrulanan kapsam — SD'den (dahil) son veri baytına (dahil). */
function pushChecksum(
  data: Uint8Array,
  coveredStart: number,
  coveredEnd: number,
  offset: number,
  fields: ParsedField[],
  errors: ProtocolError[],
): void {
  const expected = xor8Checksum(data.slice(coveredStart, coveredEnd));
  const actual = byteAt(data, offset);
  const matches = expected === actual;
  pushField(fields, data, {
    id: 'checksum',
    name: 'Checksum — XOR (start delimiter through data)',
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

function pushTrailing(data: Uint8Array, start: number, fields: ParsedField[], warnings: WarningSink): void {
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

function parseHartFrame(data: Uint8Array, options: HartParseOptions): ParseResult {
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
    return fail({ code: 'truncated-frame', message: ERROR_EMPTY_INPUT, recoverable: true, offset: 0, length: 0 });
  }

  let cursor = 0;
  while (cursor < data.length && byteAt(data, cursor) === PREAMBLE_BYTE) cursor += 1;
  const preambleCount = cursor;

  if (cursor >= data.length) {
    return fail({
      code: 'truncated-frame',
      message: ERROR_NO_DELIMITER_FOUND,
      recoverable: true,
      offset: 0,
      length: data.length,
      details: { preambleCount },
    });
  }

  const delimiterOffset = cursor;
  const delimiterValue = byteAt(data, delimiterOffset);
  const info = DELIMITER_INFO.get(delimiterValue);
  if (info === undefined) {
    return fail({
      code: 'start-delimiter-not-found',
      message: ERROR_DELIMITER_UNKNOWN,
      recoverable: true,
      offset: delimiterOffset,
      length: 1,
      details: { delimiter: formatHex(delimiterValue, 2) },
    });
  }

  const addressLength = info.long ? LONG_ADDRESS_LENGTH : SHORT_ADDRESS_LENGTH;
  const addressOffset = delimiterOffset + 1;
  const commandOffset = addressOffset + addressLength;
  const byteCountOffset = commandOffset + 1;

  if (data.length <= byteCountOffset) {
    return fail({
      code: 'truncated-frame',
      message: ERROR_FRAME_TRUNCATED,
      recoverable: true,
      offset: 0,
      length: data.length,
      details: { availableBytes: data.length, requiredBytes: byteCountOffset + 1 },
    });
  }

  const fields: ParsedField[] = [];
  const warnings = new WarningSink();
  const errors: ProtocolError[] = [];
  const summaryParams: Record<string, string> = {};

  if (preambleCount > 0) {
    pushField(fields, data, {
      id: 'preamble',
      name: 'Preamble',
      offset: 0,
      length: preambleCount,
      rawValue: preambleCount,
      physicalValue: `${preambleCount} × 0xFF`,
      unit: 'B',
    });
  }

  pushField(fields, data, {
    id: 'start-delimiter',
    name: 'Start Delimiter',
    offset: delimiterOffset,
    length: 1,
    rawValue: delimiterValue,
    physicalValue: describeDelimiter(info),
  });

  const addressDisplay = info.long
    ? pushLongAddress(fields, data, addressOffset)
    : pushShortAddress(fields, data, addressOffset);
  summaryParams['address'] = addressDisplay;

  const command = byteAt(data, commandOffset);
  const commandClass = classifyCommand(command);
  const commandName = lookupCommandName(commandClass, command);

  pushField(fields, data, {
    id: 'command-class',
    name: 'Command class',
    offset: commandOffset,
    length: 1,
    physicalValue: commandClass === undefined ? 'Reserved / undefined range' : COMMAND_CLASS_LABELS[commandClass],
    valid: commandClass !== undefined,
    warnings: commandClass === undefined ? [WARN_COMMAND_RANGE_RESERVED] : [],
  });
  if (commandClass === undefined) warnings.push(WARN_COMMAND_RANGE_RESERVED);
  else if (commandName === undefined) warnings.push(WARN_COMMAND_NOT_NAMED);

  pushField(fields, data, {
    id: 'command',
    name: 'Command',
    offset: commandOffset,
    length: 1,
    rawValue: command,
    physicalValue: commandName ?? formatHex(command, 2),
    valid: commandName !== undefined,
    warnings: commandClass !== undefined && commandName === undefined ? [WARN_COMMAND_NOT_NAMED] : [],
  });
  summaryParams['command'] = commandName ?? formatHex(command, 2);

  const byteCount = byteAt(data, byteCountOffset);
  pushField(fields, data, {
    id: 'byte-count',
    name: 'Byte Count',
    offset: byteCountOffset,
    length: 1,
    rawValue: byteCount,
    physicalValue: `${byteCount}`,
    unit: 'B',
  });

  const hasStatus = info.kind !== 'request';
  const statusLength = hasStatus ? STATUS_BYTES_LENGTH : 0;
  const dataOffset = byteCountOffset + 1 + statusLength;
  const dataLength = Math.max(byteCount - statusLength, 0);
  const dataEnd = dataOffset + dataLength;
  const requiredTotal = dataEnd + 1;

  if (data.length < requiredTotal) {
    // Bildirilen Byte Count güvenilmez: kalan baytlar ham gösterilir, alan UYDURULMAZ
    // (profibusDp.ts SD2 "uzunluk tekrarı tutmuyor" yolunun aynı deseni).
    if (data.length > byteCountOffset + 1) {
      pushField(fields, data, {
        id: 'unparsed',
        name: 'Unparsed Bytes',
        offset: byteCountOffset + 1,
        length: data.length - (byteCountOffset + 1),
        unit: 'B',
        warnings: [ERROR_FRAME_TRUNCATED],
      });
    }
    errors.push({
      code: 'truncated-frame',
      message: ERROR_FRAME_TRUNCATED,
      offset: data.length,
      length: requiredTotal - data.length,
      details: { availableBytes: data.length, requiredBytes: requiredTotal },
    });
  } else {
    if (hasStatus) {
      pushResponseCode(fields, data, byteCountOffset + 1, warnings);
      pushDeviceStatus(fields, data, byteCountOffset + 2);
      if (info.kind === 'burst') warnings.push(WARN_BURST_STATUS_LAYOUT_INFERRED);
    }
    if (dataLength > 0) {
      warnings.push(WARN_DATA_IS_COMMAND_SPECIFIC);
      pushField(fields, data, {
        id: 'data',
        name: 'Data',
        offset: dataOffset,
        length: dataLength,
        unit: 'B',
        warnings: [WARN_DATA_IS_COMMAND_SPECIFIC],
      });
    }
    pushChecksum(data, delimiterOffset, dataEnd, dataEnd, fields, errors);
    pushTrailing(data, dataEnd + 1, fields, warnings);
  }

  const summaryKey = info.kind === 'request' ? SUMMARY_REQUEST : info.kind === 'burst' ? SUMMARY_BURST : SUMMARY_RESPONSE;
  const metadata: HartFrameMetadata = {
    messageKind: info.kind,
    addressForm: info.long ? 'long' : 'short',
    command,
    commandName,
    summaryKey,
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

export function parseHart(data: Uint8Array): ParseResult {
  return parseHartFrame(data, {});
}

export const hartParser: ProtocolParser = {
  protocolId: PROTOCOL_ID,
  displayName: PROTOCOL_DISPLAY_NAME,

  /** Ucuz ön eleme: preamble'ı atla, tanınan bir sınırlayıcı + asgari zarf boyu ara. */
  canParse(data: Uint8Array): boolean {
    if (data.length === 0) return false;
    let index = 0;
    while (index < data.length && byteAt(data, index) === PREAMBLE_BYTE) index += 1;
    if (index >= data.length) return false;
    const info = DELIMITER_INFO.get(byteAt(data, index));
    if (info === undefined) return false;
    const minimumLength = index + 1 + (info.long ? LONG_ADDRESS_LENGTH : SHORT_ADDRESS_LENGTH) + 2;
    return data.length >= minimumLength;
  },

  parse(data: Uint8Array, context?: ParseContext): ParseResult {
    const options: HartParseOptions = {};
    if (context?.timestamp !== undefined) options.timestamp = context.timestamp;
    if (context?.direction !== undefined) options.direction = context.direction;
    if (context?.channel !== undefined) options.channel = context.channel;
    if (context?.maxFrameLength !== undefined) options.maxFrameLength = context.maxFrameLength;
    if (context?.signal !== undefined) options.signal = context.signal;
    return parseHartFrame(data, options);
  },
};

// ── Örnek çerçeveler ────────────────────────────────────────────────────────
// Checksum `xor8Checksum`ın KENDİSİYLE hesaplanır, elle yazılmaz: bir alan
// değişirse örnek de doğru kalır. İlk üç örnek J'nin `frame_test.go`sundaki
// GERÇEK, elle doğrulanmış vektörlerdir (bkz. dosya başı) — bağımsız bir
// kütüphanenin birim testinden alınmış, bu depoda yeniden üretilmemiş değerler.

const DEFAULT_PREAMBLE_COUNT = 5;

interface HartFrameInit {
  readonly preambleCount?: number;
  readonly delimiter: number;
  readonly address: readonly number[];
  readonly command: number;
  readonly status?: readonly [number, number];
  readonly data?: readonly number[];
  readonly breakChecksum?: boolean;
}

function buildHartFrame(init: HartFrameInit): Uint8Array {
  const data = init.data ?? [];
  const status = init.status ?? [];
  const byteCount = status.length + data.length;
  const body = [init.delimiter, ...init.address, init.command, byteCount, ...status, ...data];
  let checksum = xor8Checksum(Uint8Array.from(body));
  if (init.breakChecksum === true) checksum = (checksum + 1) & 0xff;
  const preamble = new Array<number>(init.preambleCount ?? DEFAULT_PREAMBLE_COUNT).fill(PREAMBLE_BYTE);
  return Uint8Array.from([...preamble, ...body, checksum]);
}

const EXAMPLE_FRAMES: ExampleFrame[] = [
  {
    id: 'short-request-read-unique-identifier',
    name: 'protocol.hart.example.shortRequestReadUniqueIdentifier.name',
    // J `frame_test.go` TestShortHartFrame: delim 0x02, addr 0, cmd 0, veri yok → CRC 0x02 (elle doğrulandı).
    bytes: buildHartFrame({ delimiter: 0x02, address: [0x00], command: 0 }),
    description: 'protocol.hart.example.shortRequestReadUniqueIdentifier.description',
    expectedValid: true,
  },
  {
    id: 'short-response-read-unique-identifier',
    name: 'protocol.hart.example.shortResponseReadUniqueIdentifier.name',
    // J `TestShortReplyHartFrame`: delim 0x06, addr 0, cmd 0, status 00 40, 12 bayt veri → CRC 0xA3 (elle doğrulandı).
    bytes: buildHartFrame({
      delimiter: 0x06,
      address: [0x00],
      command: 0,
      status: [0x00, 0x40],
      data: [0xfe, 0xbc, 0x7b, 0x05, 0x05, 0x03, 0x02, 0x10, 0x01, 0x12, 0x31, 0xe1],
    }),
    description: 'protocol.hart.example.shortResponseReadUniqueIdentifier.description',
    expectedValid: true,
  },
  {
    id: 'long-request-secondary-master',
    name: 'protocol.hart.example.longRequestSecondaryMaster.name',
    // J `TestLongHartFrame`: delim 0x82, addr 3C 7B 12 31 E1 (bit7=0), cmd 0 → CRC 0x07 (elle doğrulandı).
    bytes: buildHartFrame({ delimiter: 0x82, address: [0x3c, 0x7b, 0x12, 0x31, 0xe1], command: 0 }),
    description: 'protocol.hart.example.longRequestSecondaryMaster.description',
    expectedValid: true,
  },
  {
    id: 'long-request-primary-master-write-polling-address',
    name: 'protocol.hart.example.longRequestPrimaryMasterWritePollingAddress.name',
    // Aynı adres ama bit7=1 (primary master) — Command 6, yeni poll adresi 5.
    bytes: buildHartFrame({ delimiter: 0x82, address: [0xbc, 0x7b, 0x12, 0x31, 0xe1], command: 6, data: [0x05] }),
    description: 'protocol.hart.example.longRequestPrimaryMasterWritePollingAddress.description',
    expectedValid: true,
  },
  {
    id: 'long-response-loop-current',
    name: 'protocol.hart.example.longResponseLoopCurrent.name',
    // Command 2 (Read Loop Current and % of Range) — Data ham kalır, komuta özel.
    bytes: buildHartFrame({
      delimiter: 0x86,
      address: [0x3c, 0x7b, 0x12, 0x31, 0xe1],
      command: 2,
      status: [0x00, 0x00],
      data: [0x41, 0x40, 0x00, 0x00, 0x42, 0x48, 0x00, 0x00],
    }),
    description: 'protocol.hart.example.longResponseLoopCurrent.description',
    expectedValid: true,
  },
  {
    id: 'device-malfunction-status',
    name: 'protocol.hart.example.deviceMalfunctionStatus.name',
    // Device Status bit 0x80 (Device malfunction) + 0x01 (PV out of limits).
    bytes: buildHartFrame({
      delimiter: 0x06,
      address: [0x01],
      command: 0,
      status: [0x00, 0x81],
    }),
    description: 'protocol.hart.example.deviceMalfunctionStatus.description',
    expectedValid: true,
  },
  {
    id: 'communications-error-response',
    name: 'protocol.hart.example.communicationsErrorResponse.name',
    // J `TestCommunicationsErrorStatus`: response code 0x88 → bit7 set + Longitudinal Parity Error (0x08).
    bytes: buildHartFrame({ delimiter: 0x06, address: [0x00], command: 0, status: [0x88, 0x00] }),
    description: 'protocol.hart.example.communicationsErrorResponse.description',
    expectedValid: true,
  },
  {
    id: 'command-not-implemented-response',
    name: 'protocol.hart.example.commandNotImplementedResponse.name',
    // J `TestCommandStatusConfCh`: response code 0x40 → Command Not Implemented (bit7 clear).
    bytes: buildHartFrame({ delimiter: 0x06, address: [0x00], command: 99, status: [0x40, 0x00] }),
    description: 'protocol.hart.example.commandNotImplementedResponse.description',
    expectedValid: true,
  },
  {
    id: 'burst-frame',
    name: 'protocol.hart.example.burstFrame.name',
    // Delimiter 0x81: uzun, istemsiz gönderim — yapı yanıtla aynı VARSAYILIR (dosya başı).
    bytes: buildHartFrame({
      delimiter: 0x81,
      address: [0x3c, 0x7b, 0x12, 0x31, 0xe1],
      command: 1,
      status: [0x00, 0x00],
      data: [0x00, 0x41, 0x40, 0x00, 0x00],
    }),
    description: 'protocol.hart.example.burstFrame.description',
    expectedValid: true,
  },
  {
    id: 'common-practice-command',
    name: 'protocol.hart.example.commonPracticeCommand.name',
    // Command 38 — Common Practice sınıfında isimli.
    bytes: buildHartFrame({ delimiter: 0x02, address: [0x02], command: 38 }),
    description: 'protocol.hart.example.commonPracticeCommand.description',
    expectedValid: true,
  },
  {
    id: 'device-specific-command',
    name: 'protocol.hart.example.deviceSpecificCommand.name',
    // Command 200 — sınıfı biliniyor (Device-Specific) ama isim tablosunda YOK, UYDURULMAZ.
    bytes: buildHartFrame({ delimiter: 0x02, address: [0x02], command: 200 }),
    description: 'protocol.hart.example.deviceSpecificCommand.description',
    expectedValid: true,
  },
  {
    id: 'reserved-command-range',
    name: 'protocol.hart.example.reservedCommandRange.name',
    // Command 31 — 30 (Universal) ile 32 (Common Practice) arasındaki boşluk, ayrılmış.
    bytes: buildHartFrame({ delimiter: 0x02, address: [0x02], command: 31 }),
    description: 'protocol.hart.example.reservedCommandRange.description',
    expectedValid: true,
  },
  {
    id: 'checksum-mismatch',
    name: 'protocol.hart.example.checksumMismatch.name',
    bytes: buildHartFrame({ delimiter: 0x02, address: [0x02], command: 0, breakChecksum: true }),
    description: 'protocol.hart.example.checksumMismatch.description',
    expectedValid: false,
  },
  {
    id: 'unknown-start-delimiter',
    name: 'protocol.hart.example.unknownStartDelimiter.name',
    bytes: Uint8Array.from([0xff, 0xff, 0xff, 0xff, 0xff, 0x55, 0x00, 0x00, 0x00]),
    description: 'protocol.hart.example.unknownStartDelimiter.description',
    expectedValid: false,
  },
  {
    id: 'no-delimiter-found',
    name: 'protocol.hart.example.noDelimiterFound.name',
    bytes: Uint8Array.from([0xff, 0xff, 0xff]),
    description: 'protocol.hart.example.noDelimiterFound.description',
    expectedValid: false,
  },
  {
    id: 'frame-truncated',
    name: 'protocol.hart.example.frameTruncated.name',
    // Byte Count 12 vaat ediyor ama yalnız 2 bayt veri var: ham gösterilir, alan UYDURULMAZ.
    bytes: Uint8Array.from([0xff, 0xff, 0xff, 0xff, 0xff, 0x06, 0x00, 0x00, 0x0c, 0x00, 0x00, 0x01, 0x02]),
    description: 'protocol.hart.example.frameTruncated.description',
    expectedValid: false,
  },
  {
    id: 'trailing-bytes',
    name: 'protocol.hart.example.trailingBytes.name',
    bytes: (() => {
      const frame = buildHartFrame({ delimiter: 0x02, address: [0x02], command: 0 });
      return Uint8Array.from([...frame, 0xaa, 0xbb]);
    })(),
    description: 'protocol.hart.example.trailingBytes.description',
    expectedValid: true,
  },
];

export const hartPlugin: ProtocolPlugin = {
  id: PROTOCOL_ID,
  name: PROTOCOL_DISPLAY_NAME,
  category: 'industrial-automation',
  parser: hartParser,
  documentation: {
    summary: 'protocol.hart.documentation.summary',
    layer: 'multi-layer',
    references: [
      {
        title: 'yaq-project/hart-protocol (MIT) — sans-I/O HART implementation, tools.py calculate_checksum / pack_command',
        url: 'https://github.com/yaq-project/hart-protocol',
      },
      {
        title: 'jszumigaj/hart (MIT) — independent Go HART implementation, frame.go Parse/calcCrc + frame_test.go verified vectors',
        url: 'https://github.com/jszumigaj/hart',
      },
    ],
  },
  exampleFrames: EXAMPLE_FRAMES,
};
