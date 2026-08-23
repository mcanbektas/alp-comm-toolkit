/**
 * IO-Link (IEC 61131-9, IO-Link Consortium) — bir master portu ile TEK bir
 * akıllı sensör/aktüatör arasında noktadan noktaya SDCI (Single-Drop Digital
 * Communication Interface) haberleşmesi. Master, "M-sequence" adlı istek/
 * yanıt çiftleriyle Process Data (döngüsel), On-request Data (ISDU — asiklik
 * parametre erişimi) ve Event/Diagnosis verisini taşır.
 *
 * Faz 10, dalga 13h. `sensors-device-integration` ailesinin TEK kaydı; bu
 * kayıtla aile KAPANIR.
 *
 * ── KAYNAK: RESMİ, ÜCRETSİZ SPEC — DOĞRUDAN İNDİRİLDİ ────────────────────────
 * Bu dalganın ÖNCEKİ kayıtlarının çoğu (PROFIBUS, AS-i, FOUNDATION Fieldbus,
 * HART) resmi spec ücretli olduğu için açık kaynak KOD'a çapraz teyit ile
 * dayandı. IO-Link FARKLI: **IO-Link Interface and System Specification
 * V1.1.4 (Haziran 2024)**, io-link.com'da HERKESE AÇIK ve ücretsiz yayımlanıyor
 * (bu oturumda gerçekten indirildi, 314 sayfa, `pdftotext` ile metne çevrildi).
 * Aşağıdaki HER alan/formül bu resmi belgenin Annex A'sından (Codings, timing
 * constraints and errors) birebir alınmıştır — ikinci bir kaynakla çapraz
 * teyide gerek kalmadı, çünkü bu zaten BİRİNCİL kaynaktır (13g'nin GSD/spec
 * arama sıkıntısının BURADA hiç yaşanmadığı istisnai durum).
 * https://io-link.com/fileadmin/user_upload/Downloads/Package_2024/IOL-Interface-Spec_10002_V114_Jun24.pdf
 *
 * ── ÇERÇEVE: M-SEQUENCE, İKİ AYRI YÖN — AYNI BAYTLARDA DEĞİL ─────────────────
 * Spec §7.3.3.2 / Figure 38: bir M-sequence'in Master mesajı `MC, CKT, [PD
 * ve/veya OD]` ile başlar; Device mesajı `[PD ve/veya OD], CKS` ile biter.
 * Bunlar AYRI UART patlamalarıdır (yarı çift yönlü C/Q hattı) — TEK bir
 * `Uint8Array` girdi asla ikisini birden içermez. Bu motor girdiyi HER
 * SEFERİNDE TEK YÖNDE (ya master mesajı ya device mesajı) çözer.
 *
 * ── decodeOptions: `messageSide` AÇILDI — GERÇEKTEN ÇERÇEVE DIŞI ────────────
 * Hangi yönün gönderildiği baytların İÇİNDE YAZMAZ: iki yön birbirinden
 * FİZİKSEL olarak (kim o an hatta konuşuyor) ayrılır, tel üzerinde ayrı bir
 * bayrak yoktur. Kısa girdilerde bu gerçek bir çakışmadır — örn. 2 baytlık
 * girdi hem "TYPE_0 okuma isteği" (`MC,CKT`) hem "TYPE_0 okuma yanıtı" (`OD,
 * CKS`) olabilir; PROFIBUS/HART'ın "sınırlayıcı bunu zaten söylüyor" durumunun
 * TERSİ. Bu yüzden `messageSide` (`'master'`/`'device'`, varsayılan `'master'`)
 * bir `decodeOptions` kanalı olarak AÇILDI. Emsalsiz değil: `ccLink.ts`in
 * `direction` seçeneği ve `iec101.ts`in genişlik seçenekleri de alan
 * YERLEŞİMİNİ (yalnız etiketi değil) değiştiriyor — `DecodeOption`ın kendi
 * tip yorumundaki Microwire örneği de "clock edge/command length/address
 * length" gibi YAPISAL parametreleri kanal olarak öngörüyor.
 *
 * ── CHECKSUM: RESMİ FORMÜL, 8 BİTTEN 6 BİTE SIKIŞTIRMA ───────────────────────
 * Annex A.1.6 + Figure A.4 + denklem (A.1), harfi harfine: 0x52 tohum değeri
 * MESAJIN İLK BAYTIYLA (master için MC, device için ilk PD/OD baytı — yoksa
 * doğrudan CKS) XOR'lanır, ardından mesajdaki TÜM baytlar (CKT/CKS DAHİL, ama
 * checksum bitleri 0 SAYILARAK) sırayla XOR'lanır; 8 bitlik sonuç şu
 * denklemlerle 6 bite sıkıştırılır (D7..D0 8-bit sonucun bitleri, D5..D0 6-bit
 * checksum'ın bitleri):
 *   D5 = D7⊕D5⊕D3⊕D1 · D4 = D6⊕D4⊕D2⊕D0 · D3 = D7⊕D6 · D2 = D5⊕D4 ·
 *   D1 = D3⊕D2 · D0 = D1⊕D0
 * Aynı fonksiyon HER İKİ yönde de kullanılır (spec: "aynı prosedür Device'tan
 * Master'a mesajı korumak için de geçerlidir") — `verifyMSequenceChecksum`
 * PAYLAŞILIR, iki ayrı checksum fonksiyonu yazılmadı.
 *
 * ── MC / CKT / CKS BİT ALANLARI (Annex A.1.2, A.1.3, A.1.5) ──────────────────
 * MC: bit 7 R/W (0=write,1=read) · bit 6-5 Communication channel (0=Process,
 * 1=Page, 2=Diagnosis, 3=ISDU) · bit 4-0 Address (ISDU kanalında bu alan
 * FlowCTRL — Table 52 — sayılır, segmentli aktarımın sıra numarasıdır).
 * CKT: bit 7-6 M-sequence type (0=Type 0, 1=Type 1, 2=Type 2, 3=reserved) ·
 * bit 5-0 6-bit checksum. CKS (yalnız Device mesajında): bit 7 Event flag ·
 * bit 6 PD status (0=valid,1=invalid) · bit 5-0 6-bit checksum.
 *
 * ── PD/OD AYRIMI: TYPE 1'DE GERÇEKTEN ÇIKAR, TYPE 2'DE ÇIKMAZ ────────────────
 * TYPE_0 her zaman 1 oktet On-request Data'dır (A.2.2, kanaldan bağımsız).
 * TYPE_1_x'te MC'nin Communication channel alanı GERÇEKTEN ayırt eder: Process
 * kanalıysa Process Data (TYPE_1_1), değilse On-request Data (TYPE_1_2/1_V) —
 * A.2.3'ün kendi ifadesi "Address belongs to the process communication
 * channel". TYPE_2_x'te ise Address alanı SADECE on-request kanala aittir,
 * Process Data'nın kendi adresi "0'dan başlıyor" diye ÖRTÜK kabul edilir
 * (A.2.4) — yani PD/OD sınırı bu TEK çerçeveden çıkmaz, hangi TYPE_2 alt tipi
 * (2_1..2_5, 2_V) olduğu MC/CKT'de YAZMAZ, önceden anlaşılmış bir parametredir.
 * Bu yüzden TYPE_2 gövdesi TEK PARÇA ham basılır (`WARN_TYPE2_PAYLOAD_SPLIT_
 * UNKNOWN`), alt tip UYDURULMAZ — `profinet.ts`in GSDML'siz I/O verisi emsali.
 *
 * ── ISDU: FIRSATÇI ÇÖZÜLÜR, SEGMENTLİYSE HAM BIRAKILIR ───────────────────────
 * ISDU yapısı (I-Service/Length octet + opsiyonel ExtLength + Index[+Subindex]
 * + Data + CHKPDU) Annex A.5'te (Figure 50, Table A.12/A.13/A.14/A.15) TAM
 * tanımlı ve bu motor bunu çözer — ANCAK ISDU aktarımı 7.3.6.2'ye göre
 * SEGMENTLİDİR (FlowCTRL ile birden çok M-sequence'e yayılabilir). Bu motor
 * yalnız TEK bir M-sequence'in OD baytlarına baktığı için, ISDU'nun bildirdiği
 * toplam uzunluk bu çerçevenin OD'sine SIĞMIYORSA (fragman) ya da I-Service
 * tanınmıyorsa ham bırakılır (`WARN_ON_REQUEST_DATA_NOT_DECODED`) — çok
 * çerçeveli birleştirme `ethercat.ts`in "analyzer sınırı" emsali, bu motorun
 * işi değil. SIĞDIĞINDA ise CHKPDU da (ISDU'ya özel, İKİNCİ ve BAĞIMSIZ bir
 * XOR checksum, A.5.6) GERÇEKTEN doğrulanır.
 *
 * ── DEVICE MESAJI: PD/OD AYRIMI BU ÇERÇEVEDE YOK ─────────────────────────────
 * Device mesajının kendisinde MC/CKT taşınmaz — yalnız [PD/OD] + CKS. Yani bu
 * baytların Process mi On-request mi olduğu, hangi kanaldan geldiği, TEK
 * başına bu çerçeveden ASLA çıkarılamaz: bilgi eşleşen Master mesajındadır.
 * Device gövdesi bu yüzden HER ZAMAN tek parça ham basılır
 * (`WARN_DEVICE_PAYLOAD_KIND_UNKNOWN`) — `asInterface.ts`in "yanıtın anlamı
 * önceki çerçeveden gelir" kararının (`WARN_RESPONSE_MEANING_NEEDS_REQUEST`)
 * aynı sınıfı.
 *
 * ── STATUS: 'ready' — GEREKÇE (`profibusDp.ts`/`hart.ts` ölçütü) ────────────
 * Zarfın HER ALANI (MC'nin üç alt alanı, CKT'nin tipi, CKS'nin iki bayrağı,
 * checksum) adlandırılıp çözülür ve protokolün kendi tanımladığı doğrulama
 * (6-bit XOR checksum, ISDU'da AYRICA CHKPDU) GERÇEKTEN yapılır. Ham kalan
 * bölgeler (Process Data içeriği, segmentli/tanınmayan OD, Type 2'nin PD/OD
 * sınırı, Device mesajının gövde türü) YAPISAL eksik değil, ya IODD'ye ya
 * eşleşen karşı çerçeveye ya da önceden anlaşılmış bir parametreye bağımlı
 * içeriktir — `profibusDp.ts`in DU'su bu rozeti engellemedi, burada da
 * engellemez.
 *
 * ── KAPSAM DIŞI (dosya başında AÇIKÇA) ───────────────────────────────────────
 *  • **IODD ayrıştırıcısı**: katalog kaydının `definitions: ['iodd']` sekmesi
 *    ayrı bir iştir (CLAUDE.md: gsd/gsdml/iodd/scl panelsiz, "planlandı").
 *  • **Process Data'nın anlamı**: uzunluğu/kırılımı IODD'den gelir.
 *  • **Çok M-sequence'li ISDU birleştirme, Event alt yapısı, standart
 *    parametre Index/Subindex anlamları (Annex B)**: `ethercat.ts`in
 *    "analyzer sınırı" emsali + `profibusDp.ts`in DU kararı.
 *  • **Fiziksel katman (C/Q hattı sinyal seviyeleri, COM1/2/3 baud)**: bu
 *    motorun girdisi zaten çözülmüş bayt dizisidir.
 */

import { createRawFrame } from '@/protocol-core/types';
import type {
  DecodeOption,
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
const PROTOCOL_ID = 'io-link';
/** Protokol adı veridir, çeviriye girmez (CLAUDE.md). */
const PROTOCOL_DISPLAY_NAME = 'IO-Link';

const HEX_RADIX = 16;
const MAX_REASONABLE_LENGTH = 70;

/** MC — M-sequence Control (Annex A.1.2, Figure A.1). */
const MC_READ_FLAG = 0x80;
const MC_CHANNEL_SHIFT = 5;
const MC_CHANNEL_MASK = 0x03;
const MC_ADDRESS_MASK = 0x1f;

const CHANNEL_PROCESS = 0;
const CHANNEL_PAGE = 1;
const CHANNEL_DIAGNOSIS = 2;
const CHANNEL_ISDU = 3;

const CHANNEL_NAMES: ReadonlyMap<number, string> = new Map([
  [CHANNEL_PROCESS, 'Process'],
  [CHANNEL_PAGE, 'Page'],
  [CHANNEL_DIAGNOSIS, 'Diagnosis'],
  [CHANNEL_ISDU, 'ISDU'],
]);

/** Table 52 — FlowCTRL, yalnız ISDU kanalında MC'nin Address alanının anlamı. */
const FLOWCTRL_COUNT_MAX = 0x0f;
const FLOWCTRL_START = 0x10;
const FLOWCTRL_IDLE_1 = 0x11;
const FLOWCTRL_IDLE_2 = 0x12;
const FLOWCTRL_ABORT = 0x1f;

function describeFlowCtrl(value: number): string {
  if (value <= FLOWCTRL_COUNT_MAX) return `COUNT ${value}`;
  if (value === FLOWCTRL_START) return 'START';
  if (value === FLOWCTRL_IDLE_1) return 'IDLE 1';
  if (value === FLOWCTRL_IDLE_2) return 'IDLE 2 (reserved)';
  if (value === FLOWCTRL_ABORT) return 'ABORT';
  return 'Reserved';
}

/** CKT — Checksum/Type (Annex A.1.3, Figure A.2). */
const TYPE_FAMILY_SHIFT = 6;
const TYPE_FAMILY_MASK = 0x03;
const TYPE_FAMILY_0 = 0;
const TYPE_FAMILY_1 = 1;
const TYPE_FAMILY_2 = 2;
const TYPE_FAMILY_RESERVED = 3;

const TYPE_FAMILY_NAMES: ReadonlyMap<number, string> = new Map([
  [TYPE_FAMILY_0, 'Type 0'],
  [TYPE_FAMILY_1, 'Type 1'],
  [TYPE_FAMILY_2, 'Type 2'],
  [TYPE_FAMILY_RESERVED, 'Reserved'],
]);

/** CKS — Checksum/Status, yalnız Device mesajında (Annex A.1.5, Figure A.3). */
const CKS_EVENT_FLAG = 0x80;
const CKS_PD_STATUS_FLAG = 0x40;

/** Checksum: üst 2 bit (tip ya da event/pd-status) korunur, alt 6 bit (checksum) hesapta 0 sayılır. */
const CHECKSUM_PRESERVE_MASK = 0xc0;
const CHECKSUM_VALUE_MASK = 0x3f;
const CHECKSUM_SEED = 0x52;

export const ERROR_EMPTY_INPUT = 'protocol.ioLink.error.emptyInput';
export const ERROR_FRAME_TOO_LONG = 'protocol.ioLink.error.frameTooLong';
export const ERROR_ABORTED = 'protocol.ioLink.error.aborted';
export const ERROR_MASTER_MESSAGE_TOO_SHORT = 'protocol.ioLink.error.masterMessageTooShort';
export const ERROR_CHECKSUM_MISMATCH = 'protocol.ioLink.error.checksumMismatch';
export const ERROR_ISDU_CHECKSUM_MISMATCH = 'protocol.ioLink.error.isduChecksumMismatch';

export const WARN_PROCESS_DATA_NEEDS_IODD = 'protocol.ioLink.warning.processDataNeedsIodd';
export const WARN_ON_REQUEST_DATA_NOT_DECODED = 'protocol.ioLink.warning.onRequestDataNotDecoded';
export const WARN_TYPE2_PAYLOAD_SPLIT_UNKNOWN = 'protocol.ioLink.warning.type2PayloadSplitUnknown';
export const WARN_MSEQUENCE_TYPE_RESERVED = 'protocol.ioLink.warning.mSequenceTypeReserved';
export const WARN_DEVICE_PAYLOAD_KIND_UNKNOWN = 'protocol.ioLink.warning.devicePayloadKindUnknown';
export const WARN_ISDU_SERVICE_NOT_NAMED = 'protocol.ioLink.warning.isduServiceNotNamed';
export const WARN_ISDU_TRAILING_BYTES = 'protocol.ioLink.warning.isduTrailingBytes';

const SUMMARY_MASTER = 'protocol.ioLink.summary.master';
const SUMMARY_DEVICE = 'protocol.ioLink.summary.device';

const OPTION_MESSAGE_SIDE = 'messageSide';
const MESSAGE_SIDE_MASTER = 'master';
const MESSAGE_SIDE_DEVICE = 'device';

const DECODE_OPTIONS: readonly DecodeOption[] = [
  {
    id: OPTION_MESSAGE_SIDE,
    label: 'protocol.ioLink.option.messageSide',
    kind: 'select',
    defaultValue: MESSAGE_SIDE_MASTER,
    description: 'protocol.ioLink.option.messageSide.description',
    choices: [
      { value: MESSAGE_SIDE_MASTER, label: 'protocol.ioLink.option.messageSide.master' },
      { value: MESSAGE_SIDE_DEVICE, label: 'protocol.ioLink.option.messageSide.device' },
    ],
  },
];

function readMessageSide(options: Record<string, unknown> | undefined): 'master' | 'device' {
  return options?.[OPTION_MESSAGE_SIDE] === MESSAGE_SIDE_DEVICE ? MESSAGE_SIDE_DEVICE : MESSAGE_SIDE_MASTER;
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

export type IoLinkFrameMetadata = {
  messageSide: 'master' | 'device';
  typeFamily: number | undefined;
  channel: number | undefined;
  summaryKey: string;
  summaryParams: Record<string, string>;
};

interface IoLinkParseOptions {
  timestamp?: number;
  direction?: FrameDirection;
  channel?: string;
  maxFrameLength?: number;
  signal?: AbortSignal;
  options?: Record<string, unknown>;
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

/** A.1.6 denklem (A.1): 8 bitlik XOR sonucunu 6 bite sıkıştırır. */
function compress8to6(value8: number): number {
  const bit = (n: number): number => (value8 >>> n) & 1;
  const d5 = bit(7) ^ bit(5) ^ bit(3) ^ bit(1);
  const d4 = bit(6) ^ bit(4) ^ bit(2) ^ bit(0);
  const d3 = bit(7) ^ bit(6);
  const d2 = bit(5) ^ bit(4);
  const d1 = bit(3) ^ bit(2);
  const d0 = bit(1) ^ bit(0);
  return (d5 << 5) | (d4 << 4) | (d3 << 3) | (d2 << 2) | (d1 << 1) | d0;
}

interface ChecksumOutcome {
  readonly expected6: number;
  readonly actual6: number;
  readonly matches: boolean;
}

/**
 * A.1.6: 0x52 tohum + mesajın TÜM baytları XOR'lanır (checkOctetOffset'teki
 * bayt yalnız üst 2 biti — tip ya da event/pd-status — ile katılır, alt 6 bit
 * hesapta 0 sayılır), 8 bit sonuç `compress8to6` ile 6 bite indirilir. Master
 * VE Device yönü AYNI fonksiyonu kullanır (spec: "aynı prosedür").
 */
function verifyMSequenceChecksum(data: Uint8Array, checkOctetOffset: number): ChecksumOutcome {
  let accumulator = CHECKSUM_SEED;
  for (let index = 0; index < data.length; index += 1) {
    const raw = byteAt(data, index);
    accumulator ^= index === checkOctetOffset ? raw & CHECKSUM_PRESERVE_MASK : raw;
  }
  const expected6 = compress8to6(accumulator & 0xff);
  const actual6 = byteAt(data, checkOctetOffset) & CHECKSUM_VALUE_MASK;
  return { expected6, actual6, matches: expected6 === actual6 };
}

function pushChecksumField(
  fields: ParsedField[],
  data: Uint8Array,
  offset: number,
  outcome: ChecksumOutcome,
  errors: ProtocolError[],
): void {
  pushField(fields, data, {
    id: 'checksum',
    name: 'Checksum (6-bit, XOR + compress)',
    offset,
    length: 1,
    rawValue: outcome.actual6,
    physicalValue: outcome.matches
      ? 'Checksum OK'
      : `Expected 0b${outcome.expected6.toString(2).padStart(6, '0')}`,
    valid: outcome.matches,
    warnings: outcome.matches ? [] : [ERROR_CHECKSUM_MISMATCH],
  });
  if (!outcome.matches) {
    errors.push({
      code: 'checksum-mismatch',
      message: ERROR_CHECKSUM_MISMATCH,
      offset,
      length: 1,
      details: { expected: outcome.expected6, actual: outcome.actual6 },
    });
  }
}

// ── ISDU (Annex A.5, Figure 50, Table A.12/A.13/A.14/A.15) ─────────────────

type IsduIndexFormat = 'none' | '8-bit' | '8-bit-sub' | '16-bit-sub';

interface IServiceInfo {
  readonly label: string;
  readonly indexFormat: IsduIndexFormat;
}

/** Table A.12 — yalnız Master→Device (Write/Read Request) ve Device→Master (Response) yönünde ANLAMLI olan değerler. */
const I_SERVICE_TABLE: ReadonlyMap<number, IServiceInfo> = new Map([
  [0x1, { label: 'Write Request (8-bit index)', indexFormat: '8-bit' }],
  [0x2, { label: 'Write Request (8-bit index + subindex)', indexFormat: '8-bit-sub' }],
  [0x3, { label: 'Write Request (16-bit index + subindex)', indexFormat: '16-bit-sub' }],
  [0x4, { label: 'Write Response (negative)', indexFormat: 'none' }],
  [0x5, { label: 'Write Response (positive)', indexFormat: 'none' }],
  [0x9, { label: 'Read Request (8-bit index)', indexFormat: '8-bit' }],
  [0xa, { label: 'Read Request (8-bit index + subindex)', indexFormat: '8-bit-sub' }],
  [0xb, { label: 'Read Request (16-bit index + subindex)', indexFormat: '16-bit-sub' }],
  [0xc, { label: 'Read Response (negative)', indexFormat: 'none' }],
  [0xd, { label: 'Read Response (positive)', indexFormat: 'none' }],
]);

const ISDU_ISERVICE_SHIFT = 4;
const ISDU_LENGTH_MASK = 0x0f;
const ISDU_ISERVICE_NO_SERVICE = 0x0;
const ISDU_LENGTH_EXTENDED_MARKER = 0x1;
const ISDU_EXT_LENGTH_MIN = 17;
const ISDU_EXT_LENGTH_MAX = 238;

/** Table A.14: bu M-sequence'in OD'sinde kaç oktetlik bir ISDU olduğunu (varsa) çözer. */
function resolveIsduTotalLength(
  iService: number,
  lengthNibble: number,
  extLengthByte: number | undefined,
): number | undefined {
  if (iService === ISDU_ISERVICE_NO_SERVICE) {
    return lengthNibble === 0 || lengthNibble === 1 ? 1 : undefined;
  }
  if (lengthNibble === 0) return undefined;
  if (lengthNibble === ISDU_LENGTH_EXTENDED_MARKER) {
    if (extLengthByte === undefined) return undefined;
    return extLengthByte >= ISDU_EXT_LENGTH_MIN && extLengthByte <= ISDU_EXT_LENGTH_MAX
      ? extLengthByte
      : undefined;
  }
  return lengthNibble;
}

function indexByteCount(format: IsduIndexFormat): number {
  switch (format) {
    case 'none':
      return 0;
    case '8-bit':
      return 1;
    case '8-bit-sub':
      return 2;
    case '16-bit-sub':
      return 3;
  }
}

/**
 * OD baytlarının TEK bir, bu çerçeveye SIĞAN ISDU olup olmadığını dener.
 * Sığmıyorsa (segmentli fragman) ya da I-Service tanınmıyorsa `false` döner —
 * çağıran ham bırakma yoluna düşer, alan UYDURULMAZ.
 */
function pushIsdu(
  fields: ParsedField[],
  data: Uint8Array,
  warnings: WarningSink,
  errors: ProtocolError[],
  start: number,
  length: number,
): boolean {
  if (length < 1) return false;
  const headerByte = byteAt(data, start);
  const iService = (headerByte >>> ISDU_ISERVICE_SHIFT) & 0x0f;
  const lengthNibble = headerByte & ISDU_LENGTH_MASK;

  if (iService === ISDU_ISERVICE_NO_SERVICE) {
    if (lengthNibble > 1 || length !== 1) return false;
    pushField(fields, data, {
      id: 'isdu-i-service',
      name: 'ISDU — I-Service / Length',
      offset: start,
      length: 1,
      rawValue: headerByte,
      physicalValue: lengthNibble === 0 ? 'No Service' : 'Device busy',
    });
    return true;
  }

  let cursor = start + 1;
  let extLengthByte: number | undefined;
  const hasExtLength = lengthNibble === ISDU_LENGTH_EXTENDED_MARKER;
  if (hasExtLength) {
    if (cursor >= start + length) return false;
    extLengthByte = byteAt(data, cursor);
  }
  const totalLength = resolveIsduTotalLength(iService, lengthNibble, extLengthByte);
  if (totalLength === undefined || totalLength > length) return false;

  const info = I_SERVICE_TABLE.get(iService);
  const indexBytes = indexByteCount(info?.indexFormat ?? 'none');
  const headerLength = 1 + (hasExtLength ? 1 : 0);
  const structuralMinimum = headerLength + indexBytes + 1; // header(+ext) + index/sub + CHKPDU
  if (totalLength < structuralMinimum) return false;

  if (info === undefined) warnings.push(WARN_ISDU_SERVICE_NOT_NAMED);
  pushField(fields, data, {
    id: 'isdu-i-service',
    name: 'ISDU — I-Service / Length',
    offset: start,
    length: 1,
    rawValue: headerByte,
    physicalValue: info?.label ?? formatHex(iService, 1),
    valid: info !== undefined,
    warnings: info === undefined ? [WARN_ISDU_SERVICE_NOT_NAMED] : [],
  });

  if (hasExtLength) {
    pushField(fields, data, {
      id: 'isdu-ext-length',
      name: 'ISDU — Extended Length',
      offset: cursor,
      length: 1,
      rawValue: extLengthByte,
      physicalValue: `${extLengthByte}`,
    });
    cursor += 1;
  }

  const format = info?.indexFormat ?? 'none';
  if (format === '8-bit' || format === '8-bit-sub' || format === '16-bit-sub') {
    const is16Bit = format === '16-bit-sub';
    const indexValue = is16Bit
      ? (byteAt(data, cursor) << 8) | byteAt(data, cursor + 1)
      : byteAt(data, cursor);
    pushField(fields, data, {
      id: 'isdu-index',
      name: 'ISDU — Index',
      offset: cursor,
      length: is16Bit ? 2 : 1,
      rawValue: indexValue,
      physicalValue: `${indexValue}`,
    });
    cursor += is16Bit ? 2 : 1;
  }
  if (format === '8-bit-sub' || format === '16-bit-sub') {
    const subindex = byteAt(data, cursor);
    pushField(fields, data, {
      id: 'isdu-subindex',
      name: 'ISDU — Subindex',
      offset: cursor,
      length: 1,
      rawValue: subindex,
      physicalValue: `${subindex}`,
    });
    cursor += 1;
  }

  const chkpduOffset = start + totalLength - 1;
  const dataLength = chkpduOffset - cursor;
  if (dataLength > 0) {
    pushField(fields, data, {
      id: 'isdu-data',
      name: 'ISDU — Data',
      offset: cursor,
      length: dataLength,
      unit: 'B',
    });
  }

  let chkpduAccumulator = 0;
  for (let index = start; index <= chkpduOffset; index += 1) chkpduAccumulator ^= byteAt(data, index);
  const chkpduMatches = chkpduAccumulator === 0;
  pushField(fields, data, {
    id: 'isdu-chkpdu',
    name: 'ISDU — CHKPDU (independent XOR checksum)',
    offset: chkpduOffset,
    length: 1,
    rawValue: byteAt(data, chkpduOffset),
    physicalValue: chkpduMatches ? 'CHKPDU OK' : 'CHKPDU mismatch',
    valid: chkpduMatches,
    warnings: chkpduMatches ? [] : [ERROR_ISDU_CHECKSUM_MISMATCH],
  });
  if (!chkpduMatches) {
    errors.push({
      code: 'checksum-mismatch',
      message: ERROR_ISDU_CHECKSUM_MISMATCH,
      offset: chkpduOffset,
      length: 1,
    });
  }

  if (totalLength < length) {
    warnings.push(WARN_ISDU_TRAILING_BYTES);
    pushField(fields, data, {
      id: 'isdu-trailing',
      name: 'Trailing Bytes (after the ISDU)',
      offset: start + totalLength,
      length: length - totalLength,
      unit: 'B',
      warnings: [WARN_ISDU_TRAILING_BYTES],
    });
  }

  return true;
}

// ── Master/Device gövde çözümü ──────────────────────────────────────────────

function decodeMasterPayload(
  fields: ParsedField[],
  data: Uint8Array,
  warnings: WarningSink,
  errors: ProtocolError[],
  payloadStart: number,
  payloadLength: number,
  typeFamily: number,
  channel: number,
): void {
  if (payloadLength <= 0) return;

  if (typeFamily === TYPE_FAMILY_RESERVED) {
    warnings.push(WARN_MSEQUENCE_TYPE_RESERVED);
    pushField(fields, data, {
      id: 'combined-data',
      name: 'User Data (reserved M-sequence type)',
      offset: payloadStart,
      length: payloadLength,
      unit: 'B',
      warnings: [WARN_MSEQUENCE_TYPE_RESERVED],
    });
    return;
  }

  if (typeFamily === TYPE_FAMILY_2) {
    // A.2.4: PD/OD sınırı önceden anlaşılmış M-sequence alt tipine (2_1..2_5/2_V)
    // bağlıdır ve BU çerçeveden çıkmaz — bölünmez, tek parça ham basılır.
    warnings.push(WARN_TYPE2_PAYLOAD_SPLIT_UNKNOWN);
    pushField(fields, data, {
      id: 'combined-data',
      name: 'Process Data + On-request Data (Type 2, combined)',
      offset: payloadStart,
      length: payloadLength,
      unit: 'B',
      warnings: [WARN_TYPE2_PAYLOAD_SPLIT_UNKNOWN],
    });
    return;
  }

  // TYPE_0: her zaman On-request Data (A.2.2). TYPE_1: Process kanalıysa Process
  // Data (TYPE_1_1), değilse On-request Data (TYPE_1_2/1_V) — A.2.3.
  const isProcessData = typeFamily === TYPE_FAMILY_1 && channel === CHANNEL_PROCESS;
  if (isProcessData) {
    warnings.push(WARN_PROCESS_DATA_NEEDS_IODD);
    pushField(fields, data, {
      id: 'process-data',
      name: 'Process Data',
      offset: payloadStart,
      length: payloadLength,
      unit: 'B',
      warnings: [WARN_PROCESS_DATA_NEEDS_IODD],
    });
    return;
  }

  if (channel === CHANNEL_ISDU && pushIsdu(fields, data, warnings, errors, payloadStart, payloadLength)) {
    return;
  }

  warnings.push(WARN_ON_REQUEST_DATA_NOT_DECODED);
  pushField(fields, data, {
    id: 'on-request-data',
    name: `On-request Data (${CHANNEL_NAMES.get(channel) ?? formatHex(channel, 1)} channel)`,
    offset: payloadStart,
    length: payloadLength,
    unit: 'B',
    warnings: [WARN_ON_REQUEST_DATA_NOT_DECODED],
  });
}

function parseIoLinkFrame(data: Uint8Array, options: IoLinkParseOptions): ParseResult {
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

  const messageSide = readMessageSide(options.options);
  const fields: ParsedField[] = [];
  const warnings = new WarningSink();
  const errors: ProtocolError[] = [];
  const summaryParams: Record<string, string> = {};

  let metadata: IoLinkFrameMetadata;

  if (messageSide === MESSAGE_SIDE_DEVICE) {
    const cksOffset = data.length - 1;
    if (cksOffset > 0) {
      warnings.push(WARN_DEVICE_PAYLOAD_KIND_UNKNOWN);
      pushField(fields, data, {
        id: 'payload',
        name: 'Process/On-request Data (side unknown without the paired master message)',
        offset: 0,
        length: cksOffset,
        unit: 'B',
        warnings: [WARN_DEVICE_PAYLOAD_KIND_UNKNOWN],
      });
    }

    const cksRaw = byteAt(data, cksOffset);
    const eventPending = (cksRaw & CKS_EVENT_FLAG) !== 0;
    const pdInvalid = (cksRaw & CKS_PD_STATUS_FLAG) !== 0;
    pushField(fields, data, {
      id: 'cks-event',
      name: 'CKS — Event flag (bit 7)',
      offset: cksOffset,
      length: 1,
      rawValue: eventPending ? 1 : 0,
      physicalValue: eventPending ? 'Event pending' : 'No event',
    });
    pushField(fields, data, {
      id: 'cks-pd-status',
      name: 'CKS — PD status (bit 6)',
      offset: cksOffset,
      length: 1,
      rawValue: pdInvalid ? 1 : 0,
      physicalValue: pdInvalid ? 'Process Data invalid' : 'Process Data valid',
    });

    const checksum = verifyMSequenceChecksum(data, cksOffset);
    pushChecksumField(fields, data, cksOffset, checksum, errors);

    summaryParams['event'] = eventPending ? 'yes' : 'no';
    summaryParams['pdStatus'] = pdInvalid ? 'invalid' : 'valid';
    metadata = {
      messageSide: 'device',
      typeFamily: undefined,
      channel: undefined,
      summaryKey: SUMMARY_DEVICE,
      summaryParams,
    };
  } else {
    if (data.length < 2) {
      return fail({
        code: 'truncated-frame',
        message: ERROR_MASTER_MESSAGE_TOO_SHORT,
        recoverable: true,
        offset: 0,
        length: data.length,
        details: { availableBytes: data.length, requiredBytes: 2 },
      });
    }

    const mcRaw = byteAt(data, 0);
    const isRead = (mcRaw & MC_READ_FLAG) !== 0;
    const channel = (mcRaw >>> MC_CHANNEL_SHIFT) & MC_CHANNEL_MASK;
    const address = mcRaw & MC_ADDRESS_MASK;

    pushField(fields, data, {
      id: 'mc-rw',
      name: 'MC — R/W (bit 7)',
      offset: 0,
      length: 1,
      rawValue: isRead ? 1 : 0,
      physicalValue: isRead ? 'Read access' : 'Write access',
    });
    pushField(fields, data, {
      id: 'mc-channel',
      name: 'MC — Communication channel (bits 6-5)',
      offset: 0,
      length: 1,
      rawValue: channel,
      physicalValue: CHANNEL_NAMES.get(channel) ?? formatHex(channel, 1),
    });
    pushField(fields, data, {
      id: 'mc-address',
      name: channel === CHANNEL_ISDU ? 'MC — Address / FlowCTRL (bits 4-0)' : 'MC — Address (bits 4-0)',
      offset: 0,
      length: 1,
      rawValue: address,
      physicalValue: channel === CHANNEL_ISDU ? describeFlowCtrl(address) : `${address}`,
    });

    const cktOffset = 1;
    const cktRaw = byteAt(data, cktOffset);
    const typeFamily = (cktRaw >>> TYPE_FAMILY_SHIFT) & TYPE_FAMILY_MASK;
    pushField(fields, data, {
      id: 'ckt-type',
      name: 'CKT — M-sequence type (bits 7-6)',
      offset: cktOffset,
      length: 1,
      rawValue: typeFamily,
      physicalValue: TYPE_FAMILY_NAMES.get(typeFamily) ?? formatHex(typeFamily, 1),
      valid: typeFamily !== TYPE_FAMILY_RESERVED,
      warnings: typeFamily === TYPE_FAMILY_RESERVED ? [WARN_MSEQUENCE_TYPE_RESERVED] : [],
    });

    const payloadStart = 2;
    const payloadLength = data.length - 2;
    decodeMasterPayload(fields, data, warnings, errors, payloadStart, payloadLength, typeFamily, channel);

    const checksum = verifyMSequenceChecksum(data, cktOffset);
    pushChecksumField(fields, data, cktOffset, checksum, errors);

    summaryParams['rw'] = isRead ? 'read' : 'write';
    summaryParams['channel'] = CHANNEL_NAMES.get(channel) ?? formatHex(channel, 1);
    summaryParams['address'] = `${address}`;
    metadata = {
      messageSide: 'master',
      typeFamily,
      channel,
      summaryKey: SUMMARY_MASTER,
      summaryParams,
    };
  }

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

export function parseIoLink(data: Uint8Array): ParseResult {
  return parseIoLinkFrame(data, {});
}

export const ioLinkParser: ProtocolParser = {
  protocolId: PROTOCOL_ID,
  displayName: PROTOCOL_DISPLAY_NAME,

  /**
   * Ucuz ön eleme: M-sequence'lerin sabit bir sınırlayıcı baytı YOKTUR (dosya
   * başı), o yüzden bundan fazlası uydurma olurdu — yalnız makul uzunluk aralığı.
   */
  canParse(data: Uint8Array): boolean {
    return data.length >= 1 && data.length <= MAX_REASONABLE_LENGTH;
  },

  parse(data: Uint8Array, context?: ParseContext): ParseResult {
    const options: IoLinkParseOptions = {};
    if (context?.timestamp !== undefined) options.timestamp = context.timestamp;
    if (context?.direction !== undefined) options.direction = context.direction;
    if (context?.channel !== undefined) options.channel = context.channel;
    if (context?.maxFrameLength !== undefined) options.maxFrameLength = context.maxFrameLength;
    if (context?.signal !== undefined) options.signal = context.signal;
    if (context?.options !== undefined) options.options = context.options;
    return parseIoLinkFrame(data, options);
  },
};

// ── Örnek çerçeveler ────────────────────────────────────────────────────────
// Checksum (6-bit) ve CHKPDU (ISDU) HESAPLANIR, elle yazılmaz: bir alan
// değişirse örnek de doğru kalır. `messageSide: 'device'` örnekleri panelde
// DOĞRU görünmesi için `decodeOptions`ta "Device" seçilmesini gerektirir —
// bu, birim testte doğrudan `{ options: { messageSide: 'device' } }` ile,
// e2e'de panelin kendi seçim kutusuyla sınanır.

interface MasterMessageInit {
  readonly read: boolean;
  readonly channel: number;
  readonly address: number;
  readonly typeFamily: number;
  readonly payload?: readonly number[];
  readonly breakChecksum?: boolean;
}

function buildMasterMessage(init: MasterMessageInit): Uint8Array {
  const mc = (init.read ? MC_READ_FLAG : 0) | ((init.channel & MC_CHANNEL_MASK) << MC_CHANNEL_SHIFT) | (init.address & MC_ADDRESS_MASK);
  const cktTypeBits = (init.typeFamily & TYPE_FAMILY_MASK) << TYPE_FAMILY_SHIFT;
  const payload = init.payload ?? [];
  const draft = Uint8Array.from([mc, cktTypeBits, ...payload]);
  let checksum6 = verifyMSequenceChecksum(draft, 1).expected6;
  if (init.breakChecksum === true) checksum6 = (checksum6 + 1) & CHECKSUM_VALUE_MASK;
  return Uint8Array.from([mc, cktTypeBits | checksum6, ...payload]);
}

interface DeviceMessageInit {
  readonly event?: boolean;
  readonly pdInvalid?: boolean;
  readonly payload?: readonly number[];
  readonly breakChecksum?: boolean;
}

function buildDeviceMessage(init: DeviceMessageInit): Uint8Array {
  const payload = init.payload ?? [];
  const cksTypeBits = (init.event === true ? CKS_EVENT_FLAG : 0) | (init.pdInvalid === true ? CKS_PD_STATUS_FLAG : 0);
  const draft = Uint8Array.from([...payload, cksTypeBits]);
  let checksum6 = verifyMSequenceChecksum(draft, draft.length - 1).expected6;
  if (init.breakChecksum === true) checksum6 = (checksum6 + 1) & CHECKSUM_VALUE_MASK;
  return Uint8Array.from([...payload, cksTypeBits | checksum6]);
}

interface IsduInit {
  readonly iService: number;
  readonly index?: number;
  readonly indexBits?: 8 | 16;
  readonly subindex?: number;
  readonly data?: readonly number[];
  readonly breakChkpdu?: boolean;
}

/** Table A.13/A.14 sözleşmesine göre TEK bir, doğrudan-uzunluklu (2-15 oktet) ISDU kurar. */
function buildIsdu(init: IsduInit): number[] {
  const dataBytes = init.data ?? [];
  const indexBytes: number[] =
    init.index === undefined
      ? []
      : init.indexBits === 16
        ? [(init.index >>> 8) & 0xff, init.index & 0xff]
        : [init.index & 0xff];
  const subBytes = init.subindex === undefined ? [] : [init.subindex & 0xff];
  const body = [...indexBytes, ...subBytes, ...dataBytes];
  const total = 1 + body.length + 1;
  const header = ((init.iService & 0x0f) << ISDU_ISERVICE_SHIFT) | (total & ISDU_LENGTH_MASK);
  let chkpdu = 0;
  for (const value of [header, ...body]) chkpdu ^= value;
  if (init.breakChkpdu === true) chkpdu = (chkpdu + 1) & 0xff;
  return [header, ...body, chkpdu];
}

const EXAMPLE_FRAMES: ExampleFrame[] = [
  {
    id: 'master-type0-isdu-start',
    name: 'protocol.ioLink.example.masterType0IsduStart.name',
    // TYPE_0, ISDU kanalı, FlowCTRL=START(0x10): ISDU aktarımının ilk M-sequence'i.
    bytes: buildMasterMessage({ read: false, channel: CHANNEL_ISDU, address: FLOWCTRL_START, typeFamily: TYPE_FAMILY_0, payload: [0x9a] }),
    description: 'protocol.ioLink.example.masterType0IsduStart.description',
    expectedValid: true,
  },
  {
    id: 'master-type1-process-data-write',
    name: 'protocol.ioLink.example.masterType1ProcessDataWrite.name',
    // TYPE_1_1: kanal Process → Process Data (ham, IODD gerekir).
    bytes: buildMasterMessage({ read: false, channel: CHANNEL_PROCESS, address: 0, typeFamily: TYPE_FAMILY_1, payload: [0x9c, 0x04] }),
    description: 'protocol.ioLink.example.masterType1ProcessDataWrite.description',
    expectedValid: true,
  },
  {
    id: 'master-type1-isdu-write-response-positive',
    name: 'protocol.ioLink.example.masterType1IsduWriteResponsePositive.name',
    // TYPE_1_2: kanal ISDU, OD tam olarak Write Response(+) — TEK M-sequence'e SIĞAR, CHKPDU doğrulanır.
    bytes: buildMasterMessage({
      read: true,
      channel: CHANNEL_ISDU,
      address: 3,
      typeFamily: TYPE_FAMILY_1,
      payload: buildIsdu({ iService: 0x5 }),
    }),
    description: 'protocol.ioLink.example.masterType1IsduWriteResponsePositive.description',
    expectedValid: true,
  },
  {
    id: 'master-type1-isdu-read-request-8bit',
    name: 'protocol.ioLink.example.masterType1IsduReadRequest8Bit.name',
    // Read Request, 8-bit Index (16 — VendorName) — üç oktetlik tam ISDU.
    bytes: buildMasterMessage({
      read: false,
      channel: CHANNEL_ISDU,
      address: 4,
      typeFamily: TYPE_FAMILY_1,
      payload: buildIsdu({ iService: 0x9, index: 16 }),
    }),
    description: 'protocol.ioLink.example.masterType1IsduReadRequest8Bit.description',
    expectedValid: true,
  },
  {
    id: 'master-type1-isdu-read-response-16bit',
    name: 'protocol.ioLink.example.masterType1IsduReadResponse16Bit.name',
    // Read Response(+), 16-bit index+subindex İSTENMİŞ olsa da yanıtın Index/Subindex TAŞIMADIĞINA (Table A.13) dikkat: yalnız Data.
    bytes: buildMasterMessage({
      read: true,
      channel: CHANNEL_ISDU,
      address: 5,
      typeFamily: TYPE_FAMILY_1,
      payload: buildIsdu({ iService: 0xd, data: [0x17, 0x2a, 0x00, 0x64] }),
    }),
    description: 'protocol.ioLink.example.masterType1IsduReadResponse16Bit.description',
    expectedValid: true,
  },
  {
    id: 'master-type0-isdu-fragment',
    name: 'protocol.ioLink.example.masterType0IsduFragment.name',
    // TYPE_0'ın tek OD baytı 0x93 — bir Read Request(8-bit index) başlığı (bkz.
    // 'master-type1-isdu-read-request-8bit') ama Index+CHKPDU baytları YOK:
    // gerçek bir ISDU'nun ilk baytı bile SIĞMAZ — segmentli fragman, ham bırakılır.
    bytes: buildMasterMessage({ read: true, channel: CHANNEL_ISDU, address: 1, typeFamily: TYPE_FAMILY_0, payload: [0x93] }),
    description: 'protocol.ioLink.example.masterType0IsduFragment.description',
    expectedValid: true,
  },
  {
    id: 'master-type2-combined',
    name: 'protocol.ioLink.example.masterType2Combined.name',
    // TYPE_2_x: PD/OD sınırı bu çerçeveden çıkmaz, tek parça ham.
    bytes: buildMasterMessage({ read: false, channel: CHANNEL_ISDU, address: 2, typeFamily: TYPE_FAMILY_2, payload: [0x11, 0x22] }),
    description: 'protocol.ioLink.example.masterType2Combined.description',
    expectedValid: true,
  },
  {
    id: 'master-type-reserved',
    name: 'protocol.ioLink.example.masterTypeReserved.name',
    bytes: buildMasterMessage({ read: true, channel: CHANNEL_DIAGNOSIS, address: 0, typeFamily: TYPE_FAMILY_RESERVED, payload: [0x00] }),
    description: 'protocol.ioLink.example.masterTypeReserved.description',
    expectedValid: true,
  },
  {
    id: 'master-diagnosis-channel',
    name: 'protocol.ioLink.example.masterDiagnosisChannel.name',
    // ISDU olmayan OD kanalı (Diagnosis/Event): ham bırakılır, ISDU denenmez.
    bytes: buildMasterMessage({ read: true, channel: CHANNEL_DIAGNOSIS, address: 0, typeFamily: TYPE_FAMILY_1, payload: [0x00, 0x00] }),
    description: 'protocol.ioLink.example.masterDiagnosisChannel.description',
    expectedValid: true,
  },
  {
    id: 'master-checksum-mismatch',
    name: 'protocol.ioLink.example.masterChecksumMismatch.name',
    bytes: buildMasterMessage({ read: true, channel: CHANNEL_PROCESS, address: 0, typeFamily: TYPE_FAMILY_1, payload: [0x00, 0x00], breakChecksum: true }),
    description: 'protocol.ioLink.example.masterChecksumMismatch.description',
    expectedValid: false,
  },
  {
    id: 'master-isdu-chkpdu-mismatch',
    name: 'protocol.ioLink.example.masterIsduChkpduMismatch.name',
    bytes: buildMasterMessage({
      read: true,
      channel: CHANNEL_ISDU,
      address: 3,
      typeFamily: TYPE_FAMILY_1,
      payload: buildIsdu({ iService: 0x5, breakChkpdu: true }),
    }),
    description: 'protocol.ioLink.example.masterIsduChkpduMismatch.description',
    expectedValid: false,
  },
  {
    id: 'master-message-too-short',
    name: 'protocol.ioLink.example.masterMessageTooShort.name',
    bytes: Uint8Array.from([0x92]),
    description: 'protocol.ioLink.example.masterMessageTooShort.description',
    expectedValid: false,
  },
  {
    id: 'device-write-ack',
    name: 'protocol.ioLink.example.deviceWriteAck.name',
    // Yalnız CKS: bir yazma isteğinin onayı, PD/OD yok.
    bytes: buildDeviceMessage({}),
    description: 'protocol.ioLink.example.deviceWriteAck.description',
    expectedValid: true,
  },
  {
    id: 'device-reply-with-payload-and-event',
    name: 'protocol.ioLink.example.deviceReplyWithPayloadAndEvent.name',
    bytes: buildDeviceMessage({ event: true, pdInvalid: true, payload: [0x09, 0xc4] }),
    description: 'protocol.ioLink.example.deviceReplyWithPayloadAndEvent.description',
    expectedValid: true,
  },
  {
    id: 'device-checksum-mismatch',
    name: 'protocol.ioLink.example.deviceChecksumMismatch.name',
    bytes: buildDeviceMessage({ payload: [0x01, 0x02], breakChecksum: true }),
    description: 'protocol.ioLink.example.deviceChecksumMismatch.description',
    expectedValid: false,
  },
];

export const ioLinkPlugin: ProtocolPlugin = {
  id: PROTOCOL_ID,
  name: PROTOCOL_DISPLAY_NAME,
  category: 'industrial-automation',
  parser: ioLinkParser,
  documentation: {
    summary: 'protocol.ioLink.documentation.summary',
    layer: 'multi-layer',
    references: [
      {
        title: 'IO-Link Interface and System Specification V1.1.4 (June 2024), Annex A — Codings, timing constraints and errors',
        url: 'https://io-link.com/fileadmin/user_upload/Downloads/Package_2024/IOL-Interface-Spec_10002_V114_Jun24.pdf',
      },
    ],
  },
  exampleFrames: EXAMPLE_FRAMES,
  decodeOptions: DECODE_OPTIONS,
};
