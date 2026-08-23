/**
 * IEC 60870-5-101 — geniş coğrafi telecontrol için SERİ hat companion
 * standard'ı. 104'ün ("101 modelini ağa taşır") aksine burada TCP/APCI YOK;
 * link katmanı IEC 60870-5-1'in **FT1.2** çerçevelemesidir (Tek Karakter
 * Onayı / Sabit Uzunluklu / Değişken Uzunluklu çerçeve). ASDU (Type
 * Identification, Cause of Transmission, Common Address, Information Object
 * Address + eleman) ise 104 ile ORTAK çekirdek — `iec104Asdu.ts`teki
 * `decodeAsdu()`ya OLDUĞU GİBİ devredilir (brief-faz10-dalga13.md'nin "kod
 * seviyesinde zaten kanıtlı" paylaşımı, dalga 5'in `AsduWidths`
 * parametrizasyonu tam bu anı öngörmüştü).
 *
 * ── KAYNAK UYARISI (dalga 13b) ──────────────────────────────────────────────
 * IEC 60870-5-101'in resmi metni ÜCRETLİdir ve bu depoda YOK. Aşağıdaki link
 * katmanı (FT1.2) alan düzenleri YEDİ bağımsız kamuya açık kaynaktan
 * ÇAPRAZ TEYİTLE alındı:
 *   W  = Wireshark `packet-iec104.c` (101/104/ASDU dissector'larının HEPSİ
 *        bu TEK dosyada — ayrı `packet-iec60870_101.c` YOK, aranıp
 *        doğrulandı) —
 *        https://github.com/wireshark/wireshark/blob/master/epan/dissectors/packet-iec104.c
 *   L1 = lib60870-C `link_layer.c` (mz-automation, GPLv3 — yalnız alenen
 *        yayımlanan sabitler/switch-case'ler referans alındı, KOD
 *        KOPYALANMADI) —
 *        https://github.com/mz-automation/lib60870/blob/master/lib60870-C/src/iec60870/link_layer/link_layer.c
 *   L2 = lib60870-C `iec60870_common.h` (`CS101_AppLayerParameters`) —
 *        https://github.com/mz-automation/lib60870/blob/master/lib60870-C/src/inc/api/iec60870_common.h
 *   L3 = lib60870-C `link_layer_parameters.h` —
 *        https://github.com/mz-automation/lib60870/blob/master/lib60870-C/src/inc/api/link_layer_parameters.h
 *   L4 = lib60870-C `cs101_master.h` (`CS101_Master_setDIR`, balanced mode) —
 *        https://github.com/mz-automation/lib60870/blob/master/lib60870-C/src/inc/api/cs101_master.h
 *   S3 = scadaprotocols.com "IEC 101 Frame Formats Explained" (vendor/tertiary) —
 *        https://scadaprotocols.com/iec-101-frame-formats-explained/
 *   WK = Wikipedia "IEC 60870-5" (tertiary, genel doğrulama) —
 *        https://en.wikipedia.org/wiki/IEC_60870-5
 *
 * **Üç çerçeve sınıfı** (W+L1+S3, 3 kaynak örtüşüyor):
 *   - Tek Karakter Onayı: tek bayt `0xE5` (W `IEC101_SINGLE_CHAR`, L1
 *     `singleCharAck[]`). L1'e göre bu bayt yalnız pozitif ACK DEĞİL,
 *     bağlama göre "istenen sınıf verisi yok" yanıtı da olabilir
 *     (`useSingleCharACK`, FC=0 ya da FC=9 yerine) — bu nüans TEK kaynaklı
 *     (L1), bu yüzden motor tek bir sabit anlam İDDİA ETMEZ, alanı nötr
 *     ("Single Character Confirmation") gösterir.
 *   - Sabit Uzunluklu: `0x10` Start, Control(1), Address(0/1/2 bayt,
 *     yapılandırılabilir), Checksum(1), `0x16` End. Adres genişliği 0 iken
 *     toplam 4 bayt olduğu W'nin kendi kod yolunda DOĞRUDAN doğrulandı
 *     (`len = link_addr_len + 4`).
 *   - Değişken Uzunluklu: `0x68` Start, L, L (aynı L İKİ KEZ), `0x68` Start
 *     (tekrar), Control(1), Address(0/1/2), ASDU, Checksum(1), `0x16` End.
 *     `L` yalnız Control+Address+ASDU'yu sayar (start/length/checksum/end
 *     HARİÇ) — W'nin `data_len -= 1 + link_addr_len` kod yolu bunu
 *     doğruluyor.
 *
 * **Checksum — FT1.2 aritmetik toplam, mod 256, CRC DEĞİL** (L1 kod +
 * S3 metni: "Sum of previous bytes modulo 256"). Bu depoda ZATEN
 * `protocol-core/checksums/simpleChecksums.ts`teki `sum8Checksum` — GENEL
 * bir yardımcı, `mbus.ts` (wired M-Bus) da KENDİ FT1.2-türevi link
 * katmanında AYNI hesabı kullanıyor (EN 13757-2 M-Bus link katmanı IEC
 * 60870-5-1 FT1.2'yi DOĞRUDAN miras alır — `mbus.ts` dosya başındaki
 * `MBUS_FRAME_ACK_START=0xE5`/`_SHORT_START=0x10`/`_LONG_START=0x68`/
 * `_STOP=0x16` sabitleri bu motorunkiyle BİREBİR aynı). Gerçekten aynı
 * hesap olduğu için `sum8Checksum` PAYLAŞILDI, ayrı bir 101-özel checksum
 * fonksiyonu YAZILMADI.
 *
 * ── CONTROL FIELD BİT YERLEŞİMİ (dosya başı kaynak uyarısının en riskli kısmı) ─
 * 8 bit, MSB→LSB: RES/DIR(bit8) + PRM(bit7) + FCB/ACD(bit6) + FCV/DFC(bit5)
 * + fonksiyon nibble'ı(bit4-1). Aynı bit PRM'ye göre FARKLI okunur (primary→
 * secondary'de FCB/FCV, secondary→primary'de ACD/DFC) — brief'in vurguladığı
 * klasik tuzak, `mbus.ts`teki `decodeCField`in (dalga 5c, bağımsız çift
 * kaynaklı) AYNI ayrımı zaten uyguladığı yapı.
 *   - PRM (`0x40`): W (`hf_..._ctrl_prm` mask 0x40) + L1 — 2 kaynak, İSİM
 *     ÇAKIŞMIYOR.
 *   - FCB/ACD (`0x20`): FCB İKİ kaynakta (W+L1) teyitli. ACD'nin AYNI bit
 *     konumunda olduğu yalnız L1'de VE bu depodaki `mbus.ts`in (bağımsız,
 *     çift kaynaklı) C Field yapısında görülüyor — Wireshark'ın 101
 *     dissector'ı ACD alanı hiç ÜRETMİYOR (eksiklik, çelişki değil). Yerel
 *     emsal + L1 ile birlikte adlandırıldı.
 *   - FCV/DFC (`0x10`): W (`fcv=dfc=0x10`) + L1 — 2 kaynak, BİREBİR aynı.
 *   - Fonksiyon nibble'ı (`0x0F`): 2 kaynak, aşağıdaki fonksiyon kodu notuna
 *     bakınız.
 *   - RES/DIR (`0x80`): HİÇBİR kaynakta Wireshark alanı olarak YOK — diğer
 *     4 alan (0x40/0x20/0x10/0x0F = 0x7F) teyitli olduğu için YAPISAL ELEME
 *     ile (kalan tek bit budur) konumlandırıldı; DIR kavramının varlığı L1/L4
 *     ile ayrıca doğrulandı (`CS101_Master_setDIR`, yalnız balanced mode'da
 *     anlamlı). RES mi DIR mi olduğu (dengesiz/dengeli iletim) ÇERÇEVEDEN
 *     ÇIKARILAMAZ — bu bir sistem yapılandırmasıdır ve hangi yorumun geçerli
 *     olduğu downstream HİÇBİR çözümü etkilemiyor (fonksiyon kodu seçimi
 *     yalnız PRM'ye bakar) — dalga 12f'nin WebSocket MASK-biti dersiyle aynı
 *     disiplinle bunun için AYRI bir `decodeOptions` kanalı AÇILMADI, bit ham
 *     değeriyle nötr ("RES / DIR") gösterilir.
 *
 * ── FONKSİYON KODU TABLOLARI (dar küme — yalnız İKİ kaynakta da AYNI kod
 * numarasında UYUMLU adla geçenler adlandırıldı, iec104Asdu.ts'nin
 * `ELEMENT_WIDTH_TABLE`/`TYPE_ID_NAMES` disiplini) ────────────────────────
 * PRM=1 (primary→secondary): 0/1/3/4/9/10/11 W+L1'de ÖRTÜŞÜYOR, adlandırıldı.
 * Kod 2 ÇAKIŞTI (W "Reserved for Balanced Mode", L1 gerçek bir handler'la
 * `TEST_FUNCTION_FOR_LINK` tanımlıyor) — HAM bırakıldı. Kod 7 ÇAKIŞTI (W
 * "Reserved", L1 gerçek bir handler'la `RESET_FCB` tanımlıyor) — HAM
 * bırakıldı. Kod 8 TEK kaynaklı (yalnız W, kendi notunda "standart dışı
 * görünüyor" diyor) — HAM bırakıldı. 5/6/12-15 hiçbir kaynakta adlandırılmadı.
 * PRM=0 (secondary→primary): 0/1/8/9/11/14/15 W+L1'de YEDİSİ DE ÇAKIŞMADAN
 * örtüşüyor (bu yönde tek bir çakışma YOK) — hepsi adlandırıldı. 2-7/10/12/13
 * hiçbir kaynakta adlandırılmadı.
 *
 * ── LİNK ADRESİ ──────────────────────────────────────────────────────────────
 * Genişlik (0/1/2 bayt) sistem parametresidir, çerçeveden ÇIKARILAMAZ — W'nin
 * kod-içi varsayılanı 1 bayt (`global_iec60870_link_addr_len=1`), bu yüzden
 * `decodeOptions`teki varsayılan da 1. Broadcast adres değerleri (1 baytta
 * 255, 2 baytta 65535) TEK kaynaklı (yalnız L1) — bu yüzden ADLANDIRILMADI,
 * yalnız ham sayı gösterilir (kaynak ölçütü: "tek kaynaksa ham bırak").
 *
 * ── ASDU GENİŞLİKLERİ VE `AsduWidths` GENİŞLETMESİ (KANITLANDI) ─────────────
 * Wireshark'ın `asdu_parms{cot_len; asdu_addr_len; ioa_len}` İLE lib60870'in
 * `CS101_AppLayerParameters{sizeOfCOT; sizeOfCA; sizeOfIOA}`ı AYNI ÜÇ alanı
 * parametrize ediyor (2 bağımsız kaynak, tam örtüşme) — bu yüzden
 * `iec104Asdu.ts`teki `AsduWidths`e `causeOfTransmissionLength` EKLENDİ
 * (bkz. o dosyanın kendi "101 GENİŞLİĞİ" notu); `commonAddressLength`/
 * `informationObjectAddressLength` zaten vardı, DEĞİŞTİRİLMEDİ. `decodeAsdu()`
 * İMZASI DEĞİŞMEDİ, bu motor onu OLDUĞU GİBİ tüketiyor. Varsayılan genişlik
 * seçiminde İKİ kaynak ÇAKIŞIYOR: Wireshark'ın 101 için önerdiği "tipik"
 * değer (`cot=1,ca=1,ioa=2`) İLE lib60870'in kütüphane-geneli varsayılanı
 * (`cot=2,ca=2,ioa=3`, 104'le birebir aynı) FARKLI senaryolar temsil ediyor —
 * hiçbiri koda GÖMÜLMEDİ, dördü de (link adresi dahil) `decodeOptions` ile
 * kullanıcıdan sorulur; UI varsayılanı 104/lib60870 profiliyle aynı tutuldu
 * (tutarlılık + gerçek bir kütüphanenin çalışma-zamanı varsayılanı, Wireshark
 * GUI'sinin kendi seçtiği örnek değerden daha az keyfi).
 *
 * ── KAPSAM DIŞI ──────────────────────────────────────────────────────────────
 * Dengeli/dengesiz iletim modu SEÇİMİ ayrı bir decodeOption olarak SUNULMADI
 * (yukarıdaki RES/DIR notu). Broadcast link adresi anlamı ADLANDIRILMADI (tek
 * kaynak). Tek Karakter Onayı'nın "ACK mi yoksa 'veri yok' mu" ayrımı
 * MODELLENMEDİ (tek kaynak, oturum bağlamı ister — analyzer işi).
 */

import { decodeAsdu, type AsduWidths } from '../iec104/iec104Asdu';
import { sum8Checksum } from '@/protocol-core/checksums/simpleChecksums';
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
  ProtocolParser,
  ProtocolPlugin,
  ProtocolWarning,
} from '@/protocol-core/types';

/** Katalogdaki kayıt id'siyle birebir aynı olmalı (`src/app/catalog`, plugin bağı budur). */
const PROTOCOL_ID = 'iec-60870-5-101';
/** Protokol adı veridir, çeviriye girmez (CLAUDE.md). */
const PROTOCOL_DISPLAY_NAME = 'IEC 60870-5-101';

const HEX_RADIX = 16;

const SINGLE_CHARACTER_CONFIRM = 0xe5;
const FIXED_LENGTH_START = 0x10;
const VARIABLE_LENGTH_START = 0x68;
const FRAME_END = 0x16;

/** Sabit uzunluklu çerçevenin adressiz asgari uzunluğu: Start+Control+Checksum+End. */
const FIXED_LENGTH_BASE = 4;
/** Değişken uzunluklu çerçevenin başlığı: Start+L+L+Start, L henüz okunmadan. */
const VARIABLE_LENGTH_HEADER = 4;
/** Başlıktan SONRA Checksum+End için gereken asgari bayt. */
const VARIABLE_LENGTH_TAIL = 2;

/** Control field bit maskeleri (dosya başı KAYNAK UYARISI). */
const CONTROL_BIT_RES_DIR = 0x80;
const CONTROL_BIT_PRM = 0x40;
const CONTROL_BIT_FCB_ACD = 0x20;
const CONTROL_BIT_FCV_DFC = 0x10;
const CONTROL_MASK_FUNCTION = 0x0f;

/**
 * PRM=1 (primary→secondary) fonksiyon kodları — dar küme, dosya başı
 * "FONKSİYON KODU TABLOLARI" notu (kod 2/7/8 kasten HAM bırakıldı).
 */
const FUNCTION_NAMES_PRIMARY: ReadonlyMap<number, string> = new Map([
  [0, 'Reset of remote link'],
  [1, 'Reset of user process'],
  [3, 'Send/confirm — user data'],
  [4, 'Send/no reply — user data'],
  [9, 'Request status of link'],
  [10, 'Request user data class 1'],
  [11, 'Request user data class 2'],
]);

/** PRM=0 (secondary→primary) fonksiyon kodları — dosya başı notu, çakışma yok. */
const FUNCTION_NAMES_SECONDARY: ReadonlyMap<number, string> = new Map([
  [0, 'ACK — positive acknowledgement'],
  [1, 'NACK — message not accepted / link busy'],
  [8, 'Respond — user data'],
  [9, 'Respond — no data available (NACK)'],
  [11, 'Status of link / access demand'],
  [14, 'Link service not functioning'],
  [15, 'Link service not implemented'],
]);

const ERROR_EMPTY_FRAME = 'protocol.iec101.error.emptyFrame';
const ERROR_UNRECOGNIZED_FRAME_CLASS = 'protocol.iec101.error.unrecognizedFrameClass';
const ERROR_FRAME_TOO_LONG = 'protocol.iec101.error.frameTooLong';
const ERROR_ABORTED = 'protocol.iec101.error.aborted';
const ERROR_FIXED_LENGTH_TRUNCATED = 'protocol.iec101.error.fixedLengthTruncated';
const ERROR_VARIABLE_LENGTH_HEADER_TRUNCATED = 'protocol.iec101.error.variableLengthHeaderTruncated';
const ERROR_LENGTH_COPIES_MISMATCH = 'protocol.iec101.error.lengthCopiesMismatch';
const ERROR_SECOND_START_INVALID = 'protocol.iec101.error.secondStartInvalid';
const ERROR_STOP_BYTE_INVALID = 'protocol.iec101.error.stopByteInvalid';
const ERROR_CHECKSUM_MISMATCH = 'protocol.iec101.error.checksumMismatch';
const ERROR_BODY_TRUNCATED = 'protocol.iec101.error.bodyTruncated';

const WARN_UNKNOWN_FUNCTION_CODE = 'protocol.iec101.warning.unknownFunctionCode';
const WARN_TRAILING_BYTES = 'protocol.iec101.warning.trailingBytes';

const SUMMARY_SINGLE_CHARACTER = 'protocol.iec101.summary.singleCharacter';
const SUMMARY_FIXED_LENGTH = 'protocol.iec101.summary.fixedLength';
const SUMMARY_VARIABLE_LENGTH = 'protocol.iec101.summary.variableLength';

const OPTION_LINK_ADDRESS_WIDTH = 'linkAddressWidth';
const OPTION_COMMON_ADDRESS_WIDTH = 'commonAddressWidth';
const OPTION_IOA_WIDTH = 'informationObjectAddressWidth';
const OPTION_COT_WIDTH = 'causeOfTransmissionWidth';

const ALLOWED_LINK_ADDRESS_WIDTHS: readonly number[] = [0, 1, 2];
const ALLOWED_COMMON_ADDRESS_WIDTHS: readonly number[] = [1, 2];
const ALLOWED_IOA_WIDTHS: readonly number[] = [1, 2, 3];
const ALLOWED_COT_WIDTHS: readonly number[] = [1, 2];

type FrameClass = 'single-character' | 'fixed-length' | 'variable-length';

export type Iec101FrameMetadata = {
  frameClass: FrameClass;
  summaryKey: string;
  summaryParams: Record<string, string>;
};

function toProtocolWarning(key: string): ProtocolWarning {
  return { code: key, message: key };
}

/** Aynı uyarı bir çerçevede birden çok kez tetiklenebilir — tekilleştir. */
function pushWarningOnce(warnings: ProtocolWarning[], key: string): void {
  if (warnings.some((warning) => warning.code === key)) return;
  warnings.push(toProtocolWarning(key));
}

/** noUncheckedIndexedAccess: bayt dizisi erişimi her yerde bu guard'dan geçer. */
function byteAt(data: Uint8Array, offset: number): number {
  return data[offset] ?? 0;
}

function formatHexByte(value: number): string {
  return `0x${value.toString(HEX_RADIX).toUpperCase().padStart(2, '0')}`;
}

/** `width` bayt küçük-uçlu okuma (iec104Asdu.ts `readUintLe` ile aynı desen). */
function readUintLe(data: Uint8Array, offset: number, width: number): number {
  let value = 0;
  for (let index = width - 1; index >= 0; index -= 1) {
    value = value * 256 + byteAt(data, offset + index);
  }
  return value;
}

function pushBitField(
  fields: ParsedField[],
  id: string,
  name: string,
  offset: number,
  rawBytes: Uint8Array,
  value: number,
): void {
  fields.push({ id, name, offset, length: 1, rawBytes, rawValue: value, valid: true, warnings: [] });
}

interface ControlFieldResult {
  readonly prm: boolean;
  readonly functionCode: number;
  readonly functionName: string | undefined;
}

/**
 * Control field'ı bit bit çözer — RES/DIR + PRM + FCB/ACD + FCV/DFC +
 * fonksiyon nibble'ı (dosya başı KAYNAK UYARISI). Fonksiyon adı PRM'ye göre
 * İKİ AYRI tablodan seçilir; aynı sayının iki yönde farklı anlamı olması
 * bilerek burada tek yerde çözülüyor (mbus.ts'in `decodeCField` deseni).
 */
function decodeControlField(
  byte: number,
  offset: number,
  fields: ParsedField[],
  warnings: ProtocolWarning[],
): ControlFieldResult {
  const rawBytes = Uint8Array.from([byte]);
  const prm = (byte & CONTROL_BIT_PRM) !== 0;
  const bit6 = (byte & CONTROL_BIT_FCB_ACD) !== 0;
  const bit5 = (byte & CONTROL_BIT_FCV_DFC) !== 0;
  const functionCode = byte & CONTROL_MASK_FUNCTION;

  // RES/DIR: hangisi olduğu çerçeveden çıkarılamaz, nötr gösterilir (dosya başı notu).
  pushBitField(fields, 'res-dir', 'RES / DIR', offset, rawBytes, (byte & CONTROL_BIT_RES_DIR) !== 0 ? 1 : 0);
  pushBitField(fields, 'prm', 'PRM', offset, rawBytes, prm ? 1 : 0);
  pushBitField(fields, 'fcb-acd', prm ? 'FCB' : 'ACD', offset, rawBytes, bit6 ? 1 : 0);
  pushBitField(fields, 'fcv-dfc', prm ? 'FCV' : 'DFC', offset, rawBytes, bit5 ? 1 : 0);

  const functionNames = prm ? FUNCTION_NAMES_PRIMARY : FUNCTION_NAMES_SECONDARY;
  const functionName = functionNames.get(functionCode);
  const functionField: ParsedField = {
    id: 'function-code',
    name: 'Function Code',
    offset,
    length: 1,
    rawBytes,
    rawValue: functionCode,
    valid: functionName !== undefined,
    warnings: [],
  };
  if (functionName !== undefined) {
    functionField.physicalValue = functionName;
  } else {
    functionField.warnings.push(WARN_UNKNOWN_FUNCTION_CODE);
    pushWarningOnce(warnings, WARN_UNKNOWN_FUNCTION_CODE);
  }
  fields.push(functionField);

  return { prm, functionCode, functionName };
}

/** Link Address alanı — genişlik 0 ise (yapılandırılabilir) alan hiç basılmaz. */
function pushLinkAddressField(data: Uint8Array, offset: number, width: number, fields: ParsedField[]): void {
  if (width === 0) return;
  const rawBytes = data.slice(offset, offset + width);
  fields.push({
    id: 'link-address',
    name: 'Link Address',
    offset,
    length: width,
    rawBytes,
    rawValue: readUintLe(rawBytes, 0, width),
    valid: true,
    warnings: [],
  });
}

interface Iec101ParseOptions {
  timestamp?: number;
  direction?: FrameDirection;
  channel?: string;
  maxFrameLength?: number;
  signal?: AbortSignal;
  linkAddressWidth: number;
  asduWidths: AsduWidths;
}

function readWidthChoice(value: unknown, allowed: readonly number[], fallback: number): number {
  if (typeof value !== 'string') return fallback;
  const parsed = Number(value);
  return allowed.includes(parsed) ? parsed : fallback;
}

/**
 * `decodeOptions`ten dört genişlik kanalını okur (dosya başı "ASDU
 * GENİŞLİKLERİ" notu) — hiçbiri çerçeveden çıkarılamayan sistem parametresi.
 */
function resolveParseOptions(context: ParseContext | undefined): Iec101ParseOptions {
  const options = context?.options;
  const linkAddressWidth = readWidthChoice(options?.[OPTION_LINK_ADDRESS_WIDTH], ALLOWED_LINK_ADDRESS_WIDTHS, 1);
  const commonAddressLength = readWidthChoice(options?.[OPTION_COMMON_ADDRESS_WIDTH], ALLOWED_COMMON_ADDRESS_WIDTHS, 2);
  const informationObjectAddressLength = readWidthChoice(options?.[OPTION_IOA_WIDTH], ALLOWED_IOA_WIDTHS, 3);
  const causeOfTransmissionLength = readWidthChoice(options?.[OPTION_COT_WIDTH], ALLOWED_COT_WIDTHS, 2);

  return {
    ...(context?.timestamp === undefined ? {} : { timestamp: context.timestamp }),
    ...(context?.direction === undefined ? {} : { direction: context.direction }),
    ...(context?.channel === undefined ? {} : { channel: context.channel }),
    ...(context?.maxFrameLength === undefined ? {} : { maxFrameLength: context.maxFrameLength }),
    ...(context?.signal === undefined ? {} : { signal: context.signal }),
    linkAddressWidth,
    asduWidths: { commonAddressLength, informationObjectAddressLength, causeOfTransmissionLength },
  };
}

function detectFrameClass(data: Uint8Array): FrameClass | undefined {
  const first = byteAt(data, 0);
  if (first === SINGLE_CHARACTER_CONFIRM) return 'single-character';
  if (first === FIXED_LENGTH_START) return 'fixed-length';
  if (first === VARIABLE_LENGTH_START) return 'variable-length';
  return undefined;
}

function buildRawFrame(bytes: Uint8Array, options: Iec101ParseOptions, metadata: Iec101FrameMetadata) {
  return createRawFrame(bytes, {
    ...(options.timestamp === undefined ? {} : { timestamp: options.timestamp }),
    ...(options.direction === undefined ? {} : { direction: options.direction }),
    ...(options.channel === undefined ? {} : { channel: options.channel }),
    metadata,
  });
}

/**
 * Tek Karakter Onayı — tek bayt `0xE5`, alan yok. Fazlası "Trailing Data"
 * olarak işaretlenir ve TÜM tampon tüketilmiş sayılır (mbus.ts'in
 * `parseSingleCharacter` deseniyle aynı — DecodePanel'e verilen girdi TEK
 * bir bildirilen çerçeve, sürekli akış değil).
 */
function parseSingleCharacter(data: Uint8Array, options: Iec101ParseOptions): ParseResult {
  const fields: ParsedField[] = [
    {
      id: 'confirmation',
      name: 'Single Character Confirmation',
      offset: 0,
      length: 1,
      rawBytes: data.slice(0, 1),
      rawValue: formatHexByte(SINGLE_CHARACTER_CONFIRM),
      physicalValue: 'Confirmation',
      valid: true,
      warnings: [],
    },
  ];
  const warnings: ProtocolWarning[] = [];
  const errors: ProtocolError[] = [];

  if (data.length > 1) {
    const trailing = data.slice(1);
    fields.push({
      id: 'trailing-data',
      name: 'Trailing Data',
      offset: 1,
      length: trailing.length,
      rawBytes: trailing,
      unit: 'B',
      valid: false,
      warnings: [WARN_TRAILING_BYTES],
    });
    pushWarningOnce(warnings, WARN_TRAILING_BYTES);
  }

  const metadata: Iec101FrameMetadata = {
    frameClass: 'single-character',
    summaryKey: SUMMARY_SINGLE_CHARACTER,
    summaryParams: {},
  };
  const rawFrame = buildRawFrame(data, options, metadata);
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

/** Sabit Uzunluklu çerçeve: Start+Control+[Address]+Checksum+End (dosya başı notu). */
function parseFixedLength(data: Uint8Array, options: Iec101ParseOptions): ParseResult {
  const totalLength = FIXED_LENGTH_BASE + options.linkAddressWidth;
  if (data.length < totalLength) {
    return {
      success: false,
      error: {
        code: 'truncated-frame',
        message: ERROR_FIXED_LENGTH_TRUNCATED,
        offset: 0,
        length: data.length,
        details: { availableBytes: data.length, requiredBytes: totalLength },
      },
      consumedBytes: 0,
      recoverable: true,
    };
  }

  const adu = data.slice(0, totalLength);
  const fields: ParsedField[] = [];
  const warnings: ProtocolWarning[] = [];
  const errors: ProtocolError[] = [];

  fields.push({
    id: 'start-byte',
    name: 'Start Byte',
    offset: 0,
    length: 1,
    rawBytes: adu.slice(0, 1),
    rawValue: formatHexByte(byteAt(adu, 0)),
    valid: true,
    warnings: [],
  });

  const controlOffset = 1;
  const control = decodeControlField(byteAt(adu, controlOffset), controlOffset, fields, warnings);

  const addressOffset = controlOffset + 1;
  pushLinkAddressField(adu, addressOffset, options.linkAddressWidth, fields);

  const checksumOffset = addressOffset + options.linkAddressWidth;
  const checksumCovered = adu.slice(controlOffset, checksumOffset); // Control + Address
  const checksumCalculated = sum8Checksum(checksumCovered);
  const checksumReceived = byteAt(adu, checksumOffset);
  const checksumValid = checksumReceived === checksumCalculated;
  fields.push({
    id: 'checksum',
    name: 'Checksum',
    offset: checksumOffset,
    length: 1,
    rawBytes: adu.slice(checksumOffset, checksumOffset + 1),
    rawValue: checksumReceived,
    physicalValue: checksumCalculated,
    valid: checksumValid,
    warnings: checksumValid ? [] : [ERROR_CHECKSUM_MISMATCH],
  });
  if (!checksumValid) {
    errors.push({
      code: 'checksum-mismatch',
      message: ERROR_CHECKSUM_MISMATCH,
      offset: checksumOffset,
      length: 1,
      details: { received: checksumReceived, calculated: checksumCalculated },
    });
  }

  const endOffset = checksumOffset + 1;
  const endByte = byteAt(adu, endOffset);
  const endValid = endByte === FRAME_END;
  fields.push({
    id: 'end-byte',
    name: 'End Byte',
    offset: endOffset,
    length: 1,
    rawBytes: adu.slice(endOffset, endOffset + 1),
    rawValue: formatHexByte(endByte),
    valid: endValid,
    warnings: endValid ? [] : [ERROR_STOP_BYTE_INVALID],
  });
  if (!endValid) {
    errors.push({
      code: 'value-out-of-range',
      message: ERROR_STOP_BYTE_INVALID,
      offset: endOffset,
      length: 1,
      details: { received: endByte, expected: FRAME_END },
    });
  }

  const metadata: Iec101FrameMetadata = {
    frameClass: 'fixed-length',
    summaryKey: SUMMARY_FIXED_LENGTH,
    summaryParams: { function: control.functionName ?? formatHexByte(control.functionCode) },
  };
  const rawFrame = buildRawFrame(adu, options, metadata);
  const frame: ParsedFrame = {
    protocol: PROTOCOL_ID,
    timestamp: rawFrame.timestamp,
    rawFrame,
    fields,
    valid: errors.length === 0,
    errors,
    warnings,
  };
  return { success: true, frame, consumedBytes: totalLength };
}

/**
 * Değişken Uzunluklu çerçeve: Start+L+L+Start+Control+[Address]+ASDU+
 * Checksum+End (dosya başı notu). ASDU çözümü `decodeAsdu()`ya devredilir.
 */
function parseVariableLength(data: Uint8Array, options: Iec101ParseOptions): ParseResult {
  if (data.length < VARIABLE_LENGTH_HEADER) {
    return {
      success: false,
      error: {
        code: 'truncated-frame',
        message: ERROR_VARIABLE_LENGTH_HEADER_TRUNCATED,
        offset: 0,
        length: data.length,
        details: { availableBytes: data.length, requiredBytes: VARIABLE_LENGTH_HEADER },
      },
      consumedBytes: 0,
      recoverable: true,
    };
  }

  const length1 = byteAt(data, 1);
  const length2 = byteAt(data, 2);
  // İki kopya uyuşmazsa ilk kopya baz alınarak yine de çözülür (mbus.ts'in aynı deseni).
  const length = length1;

  const totalLength = VARIABLE_LENGTH_HEADER + length + VARIABLE_LENGTH_TAIL;

  if (options.maxFrameLength !== undefined && totalLength > options.maxFrameLength) {
    return {
      success: false,
      error: {
        code: 'frame-too-long',
        message: ERROR_FRAME_TOO_LONG,
        offset: options.maxFrameLength,
        length: totalLength - options.maxFrameLength,
        details: { maxFrameLength: options.maxFrameLength, frameLength: totalLength },
      },
      consumedBytes: 0,
      recoverable: false,
    };
  }

  if (data.length < totalLength) {
    return {
      success: false,
      error: {
        code: 'length-mismatch',
        message: ERROR_BODY_TRUNCATED,
        offset: 1,
        length: 1,
        details: { length, expectedFrameLength: totalLength, availableBytes: data.length },
      },
      consumedBytes: 0,
      recoverable: true,
    };
  }

  const adu = data.slice(0, totalLength);
  const fields: ParsedField[] = [];
  const warnings: ProtocolWarning[] = [];
  const errors: ProtocolError[] = [];

  fields.push({
    id: 'start-byte',
    name: 'Start Byte',
    offset: 0,
    length: 1,
    rawBytes: adu.slice(0, 1),
    rawValue: formatHexByte(byteAt(adu, 0)),
    valid: true,
    warnings: [],
  });
  fields.push({
    id: 'length',
    name: 'Length',
    offset: 1,
    length: 1,
    rawBytes: adu.slice(1, 2),
    rawValue: length1,
    physicalValue: totalLength,
    unit: 'B',
    valid: true,
    warnings: [],
  });
  const lengthCopyValid = length1 === length2;
  fields.push({
    id: 'length-copy',
    name: 'Length (copy)',
    offset: 2,
    length: 1,
    rawBytes: adu.slice(2, 3),
    rawValue: length2,
    valid: lengthCopyValid,
    warnings: lengthCopyValid ? [] : [ERROR_LENGTH_COPIES_MISMATCH],
  });
  if (!lengthCopyValid) {
    errors.push({
      code: 'length-mismatch',
      message: ERROR_LENGTH_COPIES_MISMATCH,
      offset: 1,
      length: 2,
      details: { firstCopy: length1, secondCopy: length2 },
    });
  }

  const secondStartByte = byteAt(adu, 3);
  const secondStartValid = secondStartByte === VARIABLE_LENGTH_START;
  fields.push({
    id: 'second-start-byte',
    name: 'Start Byte (repeated)',
    offset: 3,
    length: 1,
    rawBytes: adu.slice(3, 4),
    rawValue: formatHexByte(secondStartByte),
    valid: secondStartValid,
    warnings: secondStartValid ? [] : [ERROR_SECOND_START_INVALID],
  });
  if (!secondStartValid) {
    errors.push({
      code: 'start-delimiter-not-found',
      message: ERROR_SECOND_START_INVALID,
      offset: 3,
      length: 1,
    });
  }

  const controlOffset = 4;
  // Dönüş değeri burada kullanılmıyor — özet ASDU'dan kurulur (aşağıda); fonksiyon
  // adı yine de alan olarak zaten basıldı (decodeControlField içinde, fixed-length'in tersine).
  decodeControlField(byteAt(adu, controlOffset), controlOffset, fields, warnings);

  const addressOffset = controlOffset + 1;
  pushLinkAddressField(adu, addressOffset, options.linkAddressWidth, fields);

  const asduOffset = addressOffset + options.linkAddressWidth;
  const checksumOffset = controlOffset + length; // = 4 + length
  const asduBytes = adu.slice(asduOffset, checksumOffset);
  const asduSummary = decodeAsdu(asduBytes, asduOffset, fields, warnings, errors, options.asduWidths);

  const checksumCovered = adu.slice(controlOffset, checksumOffset); // Control+Address+ASDU, tam `length` bayt
  const checksumCalculated = sum8Checksum(checksumCovered);
  const checksumReceived = byteAt(adu, checksumOffset);
  const checksumValid = checksumReceived === checksumCalculated;
  fields.push({
    id: 'checksum',
    name: 'Checksum',
    offset: checksumOffset,
    length: 1,
    rawBytes: adu.slice(checksumOffset, checksumOffset + 1),
    rawValue: checksumReceived,
    physicalValue: checksumCalculated,
    valid: checksumValid,
    warnings: checksumValid ? [] : [ERROR_CHECKSUM_MISMATCH],
  });
  if (!checksumValid) {
    errors.push({
      code: 'checksum-mismatch',
      message: ERROR_CHECKSUM_MISMATCH,
      offset: checksumOffset,
      length: 1,
      details: { received: checksumReceived, calculated: checksumCalculated },
    });
  }

  const endOffset = checksumOffset + 1;
  const endByte = byteAt(adu, endOffset);
  const endValid = endByte === FRAME_END;
  fields.push({
    id: 'end-byte',
    name: 'End Byte',
    offset: endOffset,
    length: 1,
    rawBytes: adu.slice(endOffset, endOffset + 1),
    rawValue: formatHexByte(endByte),
    valid: endValid,
    warnings: endValid ? [] : [ERROR_STOP_BYTE_INVALID],
  });
  if (!endValid) {
    errors.push({
      code: 'value-out-of-range',
      message: ERROR_STOP_BYTE_INVALID,
      offset: endOffset,
      length: 1,
      details: { received: endByte, expected: FRAME_END },
    });
  }

  const metadata: Iec101FrameMetadata = {
    frameClass: 'variable-length',
    summaryKey: SUMMARY_VARIABLE_LENGTH,
    summaryParams: {
      typeId:
        asduSummary.typeIdLabel ?? (asduSummary.typeId === undefined ? '' : formatHexByte(asduSummary.typeId)),
      cause:
        asduSummary.causeOfTransmissionLabel ??
        (asduSummary.causeOfTransmission === undefined ? '' : String(asduSummary.causeOfTransmission)),
    },
  };
  const rawFrame = buildRawFrame(adu, options, metadata);
  const frame: ParsedFrame = {
    protocol: PROTOCOL_ID,
    timestamp: rawFrame.timestamp,
    rawFrame,
    fields,
    valid: errors.length === 0,
    errors,
    warnings,
  };
  return { success: true, frame, consumedBytes: totalLength };
}

function parseIec101Frame(data: Uint8Array, options: Iec101ParseOptions): ParseResult {
  if (options.signal?.aborted === true) {
    return {
      success: false,
      error: { code: 'parser-timeout', message: ERROR_ABORTED },
      consumedBytes: 0,
      recoverable: false,
    };
  }
  if (data.length === 0) {
    return {
      success: false,
      error: { code: 'truncated-frame', message: ERROR_EMPTY_FRAME, offset: 0, length: 0 },
      consumedBytes: 0,
      recoverable: true,
    };
  }

  const frameClass = detectFrameClass(data);
  if (frameClass === undefined) {
    return {
      success: false,
      error: {
        code: 'start-delimiter-not-found',
        message: ERROR_UNRECOGNIZED_FRAME_CLASS,
        offset: 0,
        length: 1,
        details: { firstByte: byteAt(data, 0) },
      },
      consumedBytes: 0,
      recoverable: true,
    };
  }

  if (frameClass === 'single-character') return parseSingleCharacter(data, options);
  if (frameClass === 'fixed-length') return parseFixedLength(data, options);
  return parseVariableLength(data, options);
}

export function parseIec101(data: Uint8Array): ParseResult {
  return parseIec101Frame(data, resolveParseOptions(undefined));
}

export const iec101Parser: ProtocolParser = {
  protocolId: PROTOCOL_ID,
  displayName: PROTOCOL_DISPLAY_NAME,

  /** Ucuz ön eleme: yalnız ilk bayt üç çerçeve sınıfından birine uyuyor mu. Checksum burada DOĞRULANMAZ. */
  canParse(data: Uint8Array): boolean {
    if (data.length === 0) return false;
    return detectFrameClass(data) !== undefined;
  },

  parse(data: Uint8Array, context?: ParseContext): ParseResult {
    return parseIec101Frame(data, resolveParseOptions(context));
  },
};

const WIDTH_CHOICES_2 = [
  { value: '1', label: 'protocol.iec101.option.width.oneByte' },
  { value: '2', label: 'protocol.iec101.option.width.twoBytes' },
] as const;

const DECODE_OPTIONS: readonly DecodeOption[] = [
  {
    id: OPTION_LINK_ADDRESS_WIDTH,
    label: 'protocol.iec101.option.linkAddressWidth',
    kind: 'select',
    defaultValue: '1',
    description: 'protocol.iec101.option.linkAddressWidth.description',
    choices: [
      { value: '0', label: 'protocol.iec101.option.width.zeroBytes' },
      { value: '1', label: 'protocol.iec101.option.width.oneByte' },
      { value: '2', label: 'protocol.iec101.option.width.twoBytes' },
    ],
  },
  {
    id: OPTION_COMMON_ADDRESS_WIDTH,
    label: 'protocol.iec101.option.commonAddressWidth',
    kind: 'select',
    defaultValue: '2',
    description: 'protocol.iec101.option.commonAddressWidth.description',
    choices: WIDTH_CHOICES_2,
  },
  {
    id: OPTION_IOA_WIDTH,
    label: 'protocol.iec101.option.informationObjectAddressWidth',
    kind: 'select',
    defaultValue: '3',
    description: 'protocol.iec101.option.informationObjectAddressWidth.description',
    choices: [
      { value: '1', label: 'protocol.iec101.option.width.oneByte' },
      { value: '2', label: 'protocol.iec101.option.width.twoBytes' },
      { value: '3', label: 'protocol.iec101.option.width.threeBytes' },
    ],
  },
  {
    id: OPTION_COT_WIDTH,
    label: 'protocol.iec101.option.causeOfTransmissionWidth',
    kind: 'select',
    defaultValue: '2',
    description: 'protocol.iec101.option.causeOfTransmissionWidth.description',
    choices: WIDTH_CHOICES_2,
  },
];

/**
 * Örnek çerçeveler — hepsi ELLE inşa edildi, checksum'ları `sum8Checksum`ın
 * KENDİSİYLE bağımsız bir Node script'inde önceden hesaplanıp
 * `iec101.test.ts` içinde AYRICA bağımsız bir toplama döngüsüyle doğrulanıyor
 * (DNP3/UBX/wirelessMbus emsali, fixture uydurma yasağı notu). ASDU gövdesi
 * `iec104.ts`in `i-format-single-object-spontaneous` örneğiyle AYNI M_SP_NA_1/
 * Common Address=1/IOA=1/SIQ=SPI-on baytlarını taşır (varsayılan genişlikler
 * 104 ile aynı olduğu için birebir karşılaştırılabilir).
 */
const EXAMPLE_FRAMES: ExampleFrame[] = [
  {
    id: 'single-character-confirmation',
    name: 'protocol.iec101.example.singleCharacterConfirmation.name',
    bytes: Uint8Array.from([0xe5]),
    description: 'protocol.iec101.example.singleCharacterConfirmation.description',
    expectedValid: true,
  },
  {
    id: 'fixed-length-reset-remote-link',
    name: 'protocol.iec101.example.fixedLengthResetRemoteLink.name',
    // Control=0x40 (PRM=1,FCB=0,FCV=0,func=0 Reset of remote link), Address=1.
    bytes: Uint8Array.from([0x10, 0x40, 0x01, 0x41, 0x16]),
    description: 'protocol.iec101.example.fixedLengthResetRemoteLink.description',
    expectedValid: true,
  },
  {
    id: 'fixed-length-ack',
    name: 'protocol.iec101.example.fixedLengthAck.name',
    // Control=0x00 (PRM=0,ACD=0,DFC=0,func=0 ACK), Address=1.
    bytes: Uint8Array.from([0x10, 0x00, 0x01, 0x01, 0x16]),
    description: 'protocol.iec101.example.fixedLengthAck.description',
    expectedValid: true,
  },
  {
    id: 'fixed-length-balanced-dir-bit',
    name: 'protocol.iec101.example.fixedLengthBalancedDirBit.name',
    // reset-remote-link ile AYNI gövde, RES/DIR biti kasten 1 (0xC0 = 0x80|0x40).
    bytes: Uint8Array.from([0x10, 0xc0, 0x01, 0xc1, 0x16]),
    description: 'protocol.iec101.example.fixedLengthBalancedDirBit.description',
    expectedValid: true,
  },
  {
    id: 'fixed-length-unknown-function',
    name: 'protocol.iec101.example.fixedLengthUnknownFunction.name',
    // Control=0x45 (PRM=1,func=5, dar kümede yok) — uyarı yolu, çerçeve yine geçerli.
    bytes: Uint8Array.from([0x10, 0x45, 0x01, 0x46, 0x16]),
    description: 'protocol.iec101.example.fixedLengthUnknownFunction.description',
    expectedValid: true,
  },
  {
    id: 'fixed-length-checksum-mismatch',
    name: 'protocol.iec101.example.fixedLengthChecksumMismatch.name',
    // reset-remote-link ile AYNI gövde, checksum kasten 0x00.
    bytes: Uint8Array.from([0x10, 0x40, 0x01, 0x00, 0x16]),
    description: 'protocol.iec101.example.fixedLengthChecksumMismatch.description',
    expectedValid: false,
  },
  {
    id: 'fixed-length-stop-byte-invalid',
    name: 'protocol.iec101.example.fixedLengthStopByteInvalid.name',
    // reset-remote-link ile AYNI gövde, end baytı kasten 0x00.
    bytes: Uint8Array.from([0x10, 0x40, 0x01, 0x41, 0x00]),
    description: 'protocol.iec101.example.fixedLengthStopByteInvalid.description',
    expectedValid: false,
  },
  {
    id: 'variable-length-user-data',
    name: 'protocol.iec101.example.variableLengthUserData.name',
    // Control=0x53 (PRM=1,FCV=1,func=3 Send/confirm), Address=1, ASDU: M_SP_NA_1
    // SQ=0/count=1, COT=Spontaneous(3), CA=1, IOA=1, SIQ=SPI-on (104'ün kendi
    // örneğiyle aynı baytlar — varsayılan genişlikler 104 ile aynı, L=12).
    bytes: Uint8Array.from([
      0x68, 0x0c, 0x0c, 0x68, 0x53, 0x01, 0x01, 0x01, 0x03, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0x01, 0x5c,
      0x16,
    ]),
    description: 'protocol.iec101.example.variableLengthUserData.description',
    expectedValid: true,
  },
  {
    id: 'variable-length-secondary-response',
    name: 'protocol.iec101.example.variableLengthSecondaryResponse.name',
    // Control=0x08 (PRM=0,func=8 Respond user data), AYNI ASDU — karşı yönün
    // fonksiyon tablosunu ve aynı decodeAsdu() yolunu tek örnekte kanıtlar.
    bytes: Uint8Array.from([
      0x68, 0x0c, 0x0c, 0x68, 0x08, 0x01, 0x01, 0x01, 0x03, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0x01, 0x11,
      0x16,
    ]),
    description: 'protocol.iec101.example.variableLengthSecondaryResponse.description',
    expectedValid: true,
  },
  {
    id: 'variable-length-checksum-mismatch',
    name: 'protocol.iec101.example.variableLengthChecksumMismatch.name',
    // variable-length-user-data ile AYNI gövde, checksum kasten 0x00.
    bytes: Uint8Array.from([
      0x68, 0x0c, 0x0c, 0x68, 0x53, 0x01, 0x01, 0x01, 0x03, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0x01, 0x00,
      0x16,
    ]),
    description: 'protocol.iec101.example.variableLengthChecksumMismatch.description',
    expectedValid: false,
  },
  {
    id: 'variable-length-copies-mismatch',
    name: 'protocol.iec101.example.variableLengthCopiesMismatch.name',
    // variable-length-user-data ile AYNI gövde, ikinci L kopyası kasten 0x0D
    // (ilk kopya 0x0C baz alınarak yine de tam çözülür — mbus.ts emsali).
    bytes: Uint8Array.from([
      0x68, 0x0c, 0x0d, 0x68, 0x53, 0x01, 0x01, 0x01, 0x03, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0x01, 0x5c,
      0x16,
    ]),
    description: 'protocol.iec101.example.variableLengthCopiesMismatch.description',
    expectedValid: false,
  },
  {
    id: 'variable-length-truncated',
    name: 'protocol.iec101.example.variableLengthTruncated.name',
    // L=0x14 (20) → 26 baytlık bir çerçeve vaat eder, tampon yalnız 6 bayt — ParseFailure.
    bytes: Uint8Array.from([0x68, 0x14, 0x14, 0x68, 0x53, 0x01]),
    description: 'protocol.iec101.example.variableLengthTruncated.description',
    expectedValid: false,
  },
];

export const iec101Plugin: ProtocolPlugin = {
  id: PROTOCOL_ID,
  name: PROTOCOL_DISPLAY_NAME,
  category: 'industrial-automation',
  parser: iec101Parser,
  documentation: {
    summary: 'protocol.iec101.documentation.summary',
    layer: 'multi-layer',
    references: [
      {
        title: 'Wireshark IEC 60870-5-101/104/ASDU dissector (packet-iec104.c) field reference',
        url: 'https://github.com/wireshark/wireshark/blob/master/epan/dissectors/packet-iec104.c',
      },
      {
        title: 'lib60870-C link_layer.c / iec60870_common.h (mz-automation, GPLv3 — documentation reference only)',
        url: 'https://github.com/mz-automation/lib60870/blob/master/lib60870-C/src/iec60870/link_layer/link_layer.c',
      },
      {
        title: 'scadaprotocols.com — IEC 101 Frame Formats Explained',
        url: 'https://scadaprotocols.com/iec-101-frame-formats-explained/',
      },
    ],
  },
  exampleFrames: EXAMPLE_FRAMES,
  decodeOptions: DECODE_OPTIONS,
};
