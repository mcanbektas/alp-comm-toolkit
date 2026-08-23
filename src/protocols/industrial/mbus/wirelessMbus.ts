/**
 * Wireless M-Bus (EN 13757-4, Frame Format A) — kablosuz utility metering.
 *
 * Girdi HAM bir Format A telgrafıdır: L-field ile başlayan, Block 1 (L+C+M+A+
 * CRC, sabit 12 bayt) ve ardından 16 baytlık (+2 bayt CRC) veri bloklarına
 * bölünmüş bir bayt dizisi (brief-faz10-dalga13.md'nin "SDR decoded log/HEX
 * telegram/PCAP" girdi tanımı — fiziksel katman/Manchester çözümü ÇOKTAN
 * yapılmış, burası yalnız link-layer'dan başlar).
 *
 * ── PAYLAŞILAN MOTOR (brief madde 3, KANITLANDI) ────────────────────────────
 * CI=0x72 (TPL Long Header) yolu, `mbusVariableData.ts`teki `decodeVariableData()`
 * fonksiyonuna devredilir — wired M-Bus'ın (`mbus.ts`) KULLANDIĞI AYNI motor.
 * Bu paylaşım baytlar seviyesinde doğrulandı: wmbusmeters'ın (açık kaynak)
 * `parseLongTPL()`+`parseShortTPL()` zinciri CI=0x72'den sonra TAM 12 bayt
 * (Ident 4 + Manufacturer 2 + Version 1 + Medium 1 + AccessNo 1 + Status 1 +
 * Configuration Field 2) okuyup ardından DIF/VIF zincirine geçiyor —
 * `mbusVariableData.ts`teki `FIXED_HEADER_LENGTH=12` ile BİREBİR aynı yapı.
 * `decodeVariableData()`'nın imzası HİÇ DEĞİŞTİRİLMEDİ (`data, baseOffset,
 * fields, warnings, errors`) — fonksiyon zaten `data`yı çağıranın verdiği
 * kadarıyla işliyor, bu da şifreli payload'ı (aşağıya bakınız) yalnız 12
 * baytlık header'ı vererek "kapat" tekniğini MÜMKÜN KILDI: hiçbir opsiyonel
 * parametre eklemeye gerek kalmadı. `decodeManufacturerCode`, `decodeBcd`,
 * `MEDIUM_NAMES`, `FIXED_HEADER_LENGTH` de aynı dosyadan EXPORT edilerek DLL
 * A-field'ı için paylaşıldı (EN 13757 ailesi bu alanları kablolu/kablosuz
 * ayrımı yapmadan aynı kodlar/aynı formülle tanımlıyor).
 *
 * ── KAYNAK UYARISI — link-layer wire format (brief-faz10-dalga13.md) ───────
 * EN 13757-4'ün resmi metni ÜCRETLİdir ve bu depoda YOK. Aşağıdaki alanlar
 * ÜÇ bağımsız kamuya açık kaynaktan ÇAPRAZ TEYİTLE alındı:
 *   1. **rtl_433** (açık kaynak, MIT/GPL — `src/devices/m_bus.c`, GitHub'dan
 *      indirilip okundu): Block 1 bayt yerleşimi (L/C/M/A, 10 bayt + 2 bayt
 *      CRC = 12 bayt `BLOCK1A_SIZE`), CRC kapsamı (`m_bus_crc_valid(decoder,
 *      in->data, 10)` — CRC bytes[0..9]'u kapsar, L-field DAHİL), veri
 *      bloklarının 16+2 bayt yapısı (`n*18` adımlama), CI-field tablosu
 *      (`mbusCiField()`).
 *   2. **wmbusmeters** (açık kaynak, GPLv3 — `src/wmbus.cc`/`wmbus.h`,
 *      GitHub'dan indirilip okundu): C-field bit yapısı (`cType()` — bit7
 *      relay, bit6 DIR, alt nibble fonksiyon kodu), CI-field tablosu
 *      (`ciType()`/`mbusCiField()` — 0x72/0x73/0x78/0x79/0x7A/0x7B/0x8C-0x8F/
 *      0x90), TPL Configuration Field bit yerleşimi (`parseTPLConfig()`:
 *      `tpl_cfg = cfg2<<8|cfg1`, Security Mode = `(tpl_cfg>>8)&0x1f`).
 *   3. **reveng.sourceforge.io "Catalogue of parametrised CRC algorithms"**
 *      (CRC-16/EN-13757: `poly=0x3d65 init=0x0000 refin=false refout=false
 *      xorout=0xffff check=0xc2b7`) + **Kamstrup `meter-system`** dokümantasyonu
 *      (`utils/crc16_wmbus`) — CRC parametreleri, ÜÇ kaynakta da birebir aynı
 *      (bkz. `protocol-core/checksums/crcCatalogue.ts`teki `CRC16_EN13757` notu).
 * Configuration Field'ın Security Mode bit yerleşimi (bit 8-12) AYRICA resmi
 * **OMS-Group "Open Metering System Specification Vol.2 – Primary
 * Communication" (Issue 5.0.1/2023-12, oms-group.org'dan halka açık PDF)**
 * Table 18/19 ile DOĞRULANDI — wmbusmeters'ın kod-seviyesi yorumuyla BİREBİR
 * örtüşüyor (`(tpl_cfg>>8)&0x1f` = OMS'un "Mode bit0..bit4" bit 8-12 tanımı).
 * C-field'ın FONKSİYON KODU tablosu (SND_NR/SND_UD2/…) yalnız TEK kaynakta
 * (wmbusmeters) bulundu — mbusVariableData.ts'nin "iki kaynak çakışmazsa
 * adlandır" ölçütünü TUTTURAMADI, bu yüzden BİLEREK ADLANDIRILMADI (yalnız
 * DIR biti — wired M-Bus'ın 0x40 DIR biti kararıyla YAPISAL olarak aynı,
 * iki kaynaklı — adlandırıldı).
 *
 * ── KAPSAM (brief madde "eğer güvenilir kaynak bulunamazsa daralt") ────────
 * - Yalnız **Format A** çözülür. Format B (farklı L-field semantiği, tek
 *   CRC/parça) fiziksel katmanda AYRI bir preamble/sync ile ayrışır ve girdi
 *   baytlarından güvenle ayırt edilemez — bu dalgada ÇÖZÜLMEZ.
 * - CI-field'ların yalnız **0x72** (TPL Long Header) yolu DIF/VIF zincirine
 *   kadar çözülür — wired M-Bus'ın kendi CI=0x72-only kararıyla AYNI çizgi
 *   (`mbus.ts` dosya başı). 0x73/0x78/0x79/0x7A/0x7B (compact/short/no-header
 *   TPL varyantları) ve 0x8C-0x8F (ELL)/0x90 (AFL) ADLANDIRILIR ama HAM
 *   bırakılır — Fixed Header'ı `decodeVariableData()`nın beklediği 12 baytlık
 *   yapıdan FARKLI (0x7A/0x78 kısa/yok header taşır, ELL ayrı bir katman
 *   ekler) ve bu varyantlar için wire-format TEYİDİ bu turda yapılmadı.
 * - **Şifre çözme (AES) UYGULANMAZ.** Configuration Field'dan Security Mode
 *   (0/5/7/10/13, OMS Table 18/19) ÇIKARILIR ve "Encrypted Payload" olarak
 *   gösterilir (SNMP'nin şifreli ScopedPDU kararıyla AYNI desen, `snmp.ts`).
 *   Anahtar girdisi (decodeOptions) SUNULMAZ: (1) `ProtocolParser.parse()`
 *   SAF ve SENKRON olmalı (protocol-core/types.ts), WebCrypto'nun
 *   `SubtleCrypto.decrypt`i ise TARAYICIDA yalnız ASENKRON — senkron sözleşmeyi
 *   kırmadan gerçek AES-128-CBC bağlanamaz; (2) senkron çalışan elle yazılmış
 *   bir AES çekirdeği NIST KAT vektörleriyle ayrı doğrulanması gereken, bu
 *   "kolay" alt dalganın kapsamını fazlasıyla aşan yeni bir kriptografi
 *   yüzeyi olurdu. Bu KASITLI bir kapsam kararıdır, unutkanlık değil.
 * - **Çoklu-blok offset yaklaşıklığı:** Block 2 payload'ı (CI+data) 16 baytı
 *   aşarsa, aradaki 2 baytlık CRC'ler ÇIKARILIP (de-chunk) tek tampon hâline
 *   getirilir ve bu tampon `decodeVariableData()`ya TEK `baseOffset` ile
 *   verilir. İlk 16 bayt (chunk 0) için offset'ler TAM DOĞRUDUR (fiziksel
 *   konumla birebir örtüşür); 16. bayttan sonrası için `decodeVariableData()`
 *   içindeki alanların `offset`i her aşılan blok sınırında 2 bayt AZ gösterir
 *   (çıkarılan CRC baytları hesaba katılmaz — `decodeVariableData()`nın flat
 *   `baseOffset` sözleşmesi chunk sınırı bilmiyor). Bu durumda
 *   `WARN_MULTI_BLOCK_OFFSET_APPROXIMATE` uyarısı basılır; DEĞER'ler (byte
 *   içerikleri, DIF/VIF çözümü) YİNE DOĞRUDUR, yalnız byte-viewer vurgusu
 *   ilk 16 bayt sonrasında kaymış olabilir.
 * - **Radio metadata** (Timestamp/Frequency/Mode/RSSI/LQI-SNR): bu alanlar
 *   TELGRAF BAYTLARININ İÇİNDE DEĞİLDİR (fiziksel katman/alıcı donanımı
 *   bilgisi) — DecodePanel'in tek girdisi hex bayt + `decodeOptions` olduğu
 *   için bunlar `decodeOptions` üzerinden opsiyonel bağlam olarak sunulur
 *   (offset:0/length:0 sentetik alan, microwire.ts'in "Profile" alanı
 *   deseninin aynısı). Timestamp AYRICA sunulmaz: `ParsedFrame.timestamp`
 *   zaten bu amaç için var (`ParseContext.timestamp`). Device ID/Manufacturer/
 *   Direction/Encryption Status ise brief'in "Radio metadata" listesinde
 *   olsa da GERÇEKTEN bayt akışından çözülebiliyor (A-field/M-field/C-field/
 *   Configuration Field) — bu yüzden decodeOptions'a DUPLICATE edilmedi,
 *   yapısal alan adlarıyla (a-field-*, m-field, c-field-direction,
 *   security-mode) sunulur.
 */

import { computeNamedCrc } from '@/protocol-core/checksums/crcCatalogue';
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

import { decodeBcd, decodeManufacturerCode, decodeVariableData, FIXED_HEADER_LENGTH, MEDIUM_NAMES } from './mbusVariableData';

const PROTOCOL_ID = 'wireless-m-bus';
/** Protokol adı veridir, çeviriye girmez (CLAUDE.md). */
const PROTOCOL_DISPLAY_NAME = 'Wireless M-Bus';

const HEX_RADIX = 16;

/** L + C + M(2) + A(6) = Block 1 CRC'sinin kapsadığı bayt sayısı (rtl_433: `m_bus_crc_valid(decoder, in->data, 10)`). */
const BLOCK1_CRC_COVERAGE_LENGTH = 10;
/** Block 1 CRC'siyle birlikte toplam uzunluk (rtl_433: `BLOCK1A_SIZE`) — bir Format A telgrafının mutlak asgari uzunluğu. */
const BLOCK1_TOTAL_LENGTH = 12;
/** L-field'ın SAYMADIĞI sabit kısım: C(1)+M(2)+A(6) = 9 bayt (rtl_433: `block1->L-9`). */
const BLOCK1_HEADER_LENGTH = 9;
/** Block 2+ veri bloklarının CRC'siz azami yükü (rtl_433: her blok `n*18` adımlar — 16 veri + 2 CRC). */
const DATA_BLOCK_MAX_PAYLOAD = 16;

const CI_LONG_HEADER = 0x72;

const SECURITY_MODE_NONE = 0;

const ERROR_EMPTY_FRAME = 'protocol.wirelessMbus.error.emptyFrame';
const ERROR_BLOCK1_TRUNCATED = 'protocol.wirelessMbus.error.block1Truncated';
const ERROR_BLOCK1_CRC_MISMATCH = 'protocol.wirelessMbus.error.block1CrcMismatch';
const ERROR_INVALID_LENGTH_FIELD = 'protocol.wirelessMbus.error.invalidLengthField';
const ERROR_DATA_BLOCK_TRUNCATED = 'protocol.wirelessMbus.error.dataBlockTruncated';
const ERROR_DATA_BLOCK_CRC_MISMATCH = 'protocol.wirelessMbus.error.dataBlockCrcMismatch';

const WARN_INVALID_BCD = 'protocol.wirelessMbus.warning.invalidBcd';
const WARN_UNKNOWN_CI = 'protocol.wirelessMbus.warning.unknownCi';
const WARN_CI_NOT_DECODED = 'protocol.wirelessMbus.warning.ciNotDecoded';
const WARN_UNKNOWN_DEVICE_TYPE = 'protocol.wirelessMbus.warning.unknownDeviceType';
const WARN_ENCRYPTED_PAYLOAD = 'protocol.wirelessMbus.warning.encryptedPayload';
const WARN_MULTI_BLOCK_OFFSET_APPROXIMATE = 'protocol.wirelessMbus.warning.multiBlockOffsetApproximate';
const WARN_UNNAMED_SECURITY_MODE = 'protocol.wirelessMbus.warning.unnamedSecurityMode';
const WARN_TRAILING_BYTES = 'protocol.wirelessMbus.warning.trailingBytes';

/**
 * CI-Field tablosu — yalnız wmbusmeters kaynaklı (TEK kaynak, dosya başı
 * notu). Yalnız 0x72 DIF/VIF zincirine devredilir; diğerleri ADLANDIRILIR
 * ama HAM bırakılır (kapsam notu).
 */
const CI_FIELD_NAMES: ReadonlyMap<number, string> = new Map([
  [CI_LONG_HEADER, 'TPL: Long Header APL Follows'],
  [0x73, 'TPL: Long Header Compact APL Follows'],
  [0x78, 'TPL: No Header APL Follows'],
  [0x79, 'TPL: Compact APL Follows (No Header)'],
  [0x7a, 'TPL: Short Header APL Follows'],
  [0x7b, 'TPL: Short Header Compact APL Follows'],
  [0x8c, 'ELL: Extended Link Layer I (2 Byte)'],
  [0x8d, 'ELL: Extended Link Layer II (8 Byte)'],
  [0x8e, 'ELL: Extended Link Layer III (10 Byte)'],
  [0x8f, 'ELL: Extended Link Layer IV (16 Byte)'],
  [0x90, 'AFL: Authentication and Fragmentation Layer'],
]);

/**
 * TPL Security Mode — OMS-Group Vol.2 Table 18/19 (resmi, halka açık PDF) ile
 * DOĞRULANMIŞ beş mod (dosya başı notu). Diğer sayılar (1-4/6/9/11/12/…)
 * wmbusmeters'ın genişletilmiş numaralandırmasında var ama OMS'un "yalnız
 * bunlar geçerli" listesinde YOK — ADLANDIRILMAZ.
 */
const SECURITY_MODE_NAMES: ReadonlyMap<number, string> = new Map([
  [SECURITY_MODE_NONE, 'Not Encrypted'],
  [5, 'Encrypted — AES-128-CBC, Persistent Key (Mode 5)'],
  [7, 'Encrypted — AES-128-CBC, Ephemeral Key (Mode 7)'],
  [10, 'Encrypted — AES-128, Authenticated (Mode 10)'],
  [13, 'Encrypted — Asymmetric / TLS (Mode 13)'],
]);

const OPTION_RADIO_MODE = 'radioMode';
const OPTION_FREQUENCY_MHZ = 'frequencyMhz';
const OPTION_RSSI_DBM = 'rssiDbm';
const OPTION_LINK_QUALITY = 'linkQuality';

const RADIO_MODE_UNKNOWN = 'unknown';

function toProtocolWarning(key: string): ProtocolWarning {
  return { code: key, message: key };
}

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

function readUintLe(data: Uint8Array, offset: number, width: number): number {
  let value = 0;
  for (let index = width - 1; index >= 0; index -= 1) {
    value = value * 256 + byteAt(data, offset + index);
  }
  return value;
}

function concatUint8Arrays(chunks: readonly Uint8Array[]): Uint8Array {
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const out = new Uint8Array(totalLength);
  let cursor = 0;
  for (const chunk of chunks) {
    out.set(chunk, cursor);
    cursor += chunk.length;
  }
  return out;
}

function clampNumberOption(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  if (value < min || value > max) return fallback;
  return value;
}

function readSelectOption(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

interface WirelessMbusParseOptions {
  timestamp?: number;
  direction?: FrameDirection;
  channel?: string;
  signal?: AbortSignal;
  radioMode: string;
  frequencyMhz: number;
  rssiDbm: number;
  linkQuality: number;
}

/**
 * Radyo bağlamı — telgraf baytlarından ÇIKARILAMAZ, `decodeOptions`tan gelir
 * (dosya başı "Radio metadata" notu). Her zaman basılır: kullanıcı formu
 * dokunmasa bile varsayılan değerler görünür (microwire.ts'in "Profile"
 * alanı deseninin aynısı) — bu yüzden alan adı net biçimde "kullanıcı
 * bağlamı" olduğunu söyler, "çözülen değer" izlenimi vermez.
 */
function pushRadioContextFields(fields: ParsedField[], options: WirelessMbusParseOptions): void {
  const emptyBytes = new Uint8Array();
  fields.push({
    id: 'radio-mode',
    name: 'Radio Mode (declared)',
    offset: 0,
    length: 0,
    rawBytes: emptyBytes,
    rawValue: options.radioMode,
    valid: true,
    warnings: [],
  });
  fields.push({
    id: 'radio-frequency',
    name: 'Frequency (declared)',
    offset: 0,
    length: 0,
    rawBytes: emptyBytes,
    rawValue: options.frequencyMhz,
    unit: 'MHz',
    valid: true,
    warnings: [],
  });
  fields.push({
    id: 'radio-rssi',
    name: 'RSSI (declared)',
    offset: 0,
    length: 0,
    rawBytes: emptyBytes,
    rawValue: options.rssiDbm,
    unit: 'dBm',
    valid: true,
    warnings: [],
  });
  fields.push({
    id: 'radio-link-quality',
    name: 'LQI / SNR (declared)',
    offset: 0,
    length: 0,
    rawBytes: emptyBytes,
    rawValue: options.linkQuality,
    valid: true,
    warnings: [],
  });
}

interface Block1Result {
  readonly lField: number;
}

function pushBlock1Fields(
  data: Uint8Array,
  fields: ParsedField[],
  warnings: ProtocolWarning[],
  errors: ProtocolError[],
): Block1Result {
  const lField = byteAt(data, 0);
  fields.push({
    id: 'l-field',
    name: 'Length (L-Field)',
    offset: 0,
    length: 1,
    rawBytes: data.slice(0, 1),
    rawValue: lField,
    unit: 'B',
    valid: true,
    warnings: [],
  });

  const cByte = byteAt(data, 1);
  const direction = (cByte & 0x40) !== 0;
  fields.push({
    id: 'c-field',
    name: 'C Field',
    offset: 1,
    length: 1,
    rawBytes: data.slice(1, 2),
    rawValue: formatHexByte(cByte),
    valid: true,
    warnings: [],
  });
  fields.push({
    id: 'c-field-direction',
    name: 'Direction',
    offset: 1,
    length: 1,
    rawBytes: data.slice(1, 2),
    rawValue: direction ? 1 : 0,
    physicalValue: direction ? 'From Meter' : 'To Meter',
    valid: true,
    warnings: [],
  });

  const manufacturerRaw = readUintLe(data, 2, 2);
  fields.push({
    id: 'm-field',
    name: 'Manufacturer',
    offset: 2,
    length: 2,
    rawBytes: data.slice(2, 4),
    rawValue: manufacturerRaw,
    physicalValue: decodeManufacturerCode(manufacturerRaw),
    valid: true,
    warnings: [],
  });

  const identBytes = data.slice(4, 8);
  const identBcd = decodeBcd(identBytes);
  const identField: ParsedField = {
    id: 'a-field-identification',
    name: 'Identification Number',
    offset: 4,
    length: 4,
    rawBytes: identBytes,
    valid: identBcd.valid,
    warnings: identBcd.valid ? [] : [WARN_INVALID_BCD],
  };
  if (identBcd.valid) identField.rawValue = identBcd.digits;
  else pushWarningOnce(warnings, WARN_INVALID_BCD);
  fields.push(identField);

  fields.push({
    id: 'a-field-version',
    name: 'Version',
    offset: 8,
    length: 1,
    rawBytes: data.slice(8, 9),
    rawValue: byteAt(data, 8),
    valid: true,
    warnings: [],
  });

  const deviceTypeByte = byteAt(data, 9);
  const deviceTypeName = MEDIUM_NAMES.get(deviceTypeByte);
  const deviceTypeField: ParsedField = {
    id: 'a-field-device-type',
    name: 'Device Type',
    offset: 9,
    length: 1,
    rawBytes: data.slice(9, 10),
    rawValue: deviceTypeByte,
    valid: deviceTypeName !== undefined,
    warnings: deviceTypeName !== undefined ? [] : [WARN_UNKNOWN_DEVICE_TYPE],
  };
  if (deviceTypeName !== undefined) deviceTypeField.physicalValue = deviceTypeName;
  else pushWarningOnce(warnings, WARN_UNKNOWN_DEVICE_TYPE);
  fields.push(deviceTypeField);

  if (data.length >= BLOCK1_TOTAL_LENGTH) {
    const covered = data.slice(0, BLOCK1_CRC_COVERAGE_LENGTH);
    const calculated = Number(computeNamedCrc(covered, 'CRC16_EN13757'));
    const received = readCrc16Be(data, BLOCK1_CRC_COVERAGE_LENGTH);
    const valid = received === calculated;
    fields.push({
      id: 'block1-crc',
      name: 'Block 1 CRC',
      offset: BLOCK1_CRC_COVERAGE_LENGTH,
      length: 2,
      rawBytes: data.slice(BLOCK1_CRC_COVERAGE_LENGTH, BLOCK1_TOTAL_LENGTH),
      rawValue: received,
      physicalValue: calculated,
      valid,
      warnings: valid ? [] : [ERROR_BLOCK1_CRC_MISMATCH],
    });
    if (!valid) {
      errors.push({
        code: 'crc-mismatch',
        message: ERROR_BLOCK1_CRC_MISMATCH,
        offset: BLOCK1_CRC_COVERAGE_LENGTH,
        length: 2,
        details: { received, calculated },
      });
    }
  } else {
    errors.push({
      code: 'truncated-frame',
      message: ERROR_BLOCK1_TRUNCATED,
      offset: BLOCK1_CRC_COVERAGE_LENGTH,
      length: data.length - BLOCK1_CRC_COVERAGE_LENGTH,
      details: { availableBytes: data.length, requiredBytes: BLOCK1_TOTAL_LENGTH },
    });
  }

  return { lField };
}

/**
 * Belirli bir fiziksel ofsette büyük-uçlu (MSB-first) 16-bit CRC baytı okur —
 * hem Block 1 CRC'si hem veri bloğu CRC'leri için (rtl_433: `bytes[crc_offset]
 * <<8 | bytes[crc_offset+1]`).
 */
function readCrc16Be(data: Uint8Array, offset: number): number {
  return (byteAt(data, offset) << 8) | byteAt(data, offset + 1);
}

interface DataBlocksResult {
  readonly concatenated: Uint8Array;
  readonly numChunks: number;
}

/**
 * Block 2+ veri bloklarını (16 bayt veri + 2 bayt CRC, son blok kısa olabilir)
 * okuyup CRC'leri ÇIKARARAK (de-chunk) tek bir mantıksal tampona birleştirir.
 * Her blok için ayrı bir CRC alanı basılır (Block 1'in aynı şeffaflığı).
 * Fiziksel ofset = `BLOCK1_TOTAL_LENGTH + mantıksal_ofset + 2*floor(mantıksal_ofset/16)`
 * formülüyle KESİN hesaplanabilir (dosya başı "çoklu-blok offset" notu) —
 * bu fonksiyon yalnız KENDİ bastığı CRC alanları için bu formülü kullanır;
 * `decodeVariableData()`ya devredilen mantıksal tamponun İÇİNDEKİ alanlar
 * flat `baseOffset` sözleşmesi yüzünden bu kesinliği MİRAS ALAMAZ.
 */
function readDataBlocks(
  data: Uint8Array,
  block2PayloadLength: number,
  fields: ParsedField[],
  errors: ProtocolError[],
): DataBlocksResult {
  const chunks: Uint8Array[] = [];
  let physicalOffset = BLOCK1_TOTAL_LENGTH;
  let remaining = block2PayloadLength;
  let chunkIndex = 0;

  while (remaining > 0) {
    const chunkPayloadLength = Math.min(DATA_BLOCK_MAX_PAYLOAD, remaining);
    const chunkTotalLength = chunkPayloadLength + 2;
    const availableBytes = Math.max(0, data.length - physicalOffset);
    if (availableBytes < chunkTotalLength) {
      errors.push({
        code: 'truncated-frame',
        message: ERROR_DATA_BLOCK_TRUNCATED,
        offset: physicalOffset,
        length: availableBytes,
        details: { blockIndex: chunkIndex, requiredBytes: chunkTotalLength, availableBytes },
      });
      break;
    }

    const chunkPayload = data.slice(physicalOffset, physicalOffset + chunkPayloadLength);
    const crcReceived = readCrc16Be(data, physicalOffset + chunkPayloadLength);
    const crcCalculated = Number(computeNamedCrc(chunkPayload, 'CRC16_EN13757'));
    const crcValid = crcReceived === crcCalculated;
    fields.push({
      id: `data-block-${String(chunkIndex)}-crc`,
      name: `Data Block ${String(chunkIndex + 1)} CRC`,
      offset: physicalOffset + chunkPayloadLength,
      length: 2,
      rawBytes: data.slice(physicalOffset + chunkPayloadLength, physicalOffset + chunkTotalLength),
      rawValue: crcReceived,
      physicalValue: crcCalculated,
      valid: crcValid,
      warnings: crcValid ? [] : [ERROR_DATA_BLOCK_CRC_MISMATCH],
    });
    if (!crcValid) {
      errors.push({
        code: 'crc-mismatch',
        message: ERROR_DATA_BLOCK_CRC_MISMATCH,
        offset: physicalOffset + chunkPayloadLength,
        length: 2,
        details: { blockIndex: chunkIndex, received: crcReceived, calculated: crcCalculated },
      });
    }

    chunks.push(chunkPayload);
    physicalOffset += chunkTotalLength;
    remaining -= chunkPayloadLength;
    chunkIndex += 1;
  }

  return { concatenated: concatUint8Arrays(chunks), numChunks: chunkIndex };
}

function pushSecurityModeField(fields: ParsedField[], securityMode: number, configOffset: number, configBytes: Uint8Array): void {
  const name = SECURITY_MODE_NAMES.get(securityMode);
  fields.push({
    id: 'security-mode',
    name: 'Security Mode',
    offset: configOffset,
    length: 2,
    rawBytes: configBytes,
    rawValue: securityMode,
    physicalValue: name ?? `Unknown/Reserved Mode ${String(securityMode)}`,
    valid: name !== undefined,
    warnings: name !== undefined ? [] : [WARN_UNNAMED_SECURITY_MODE],
  });
}

function parseWirelessMbusFrame(data: Uint8Array, options: WirelessMbusParseOptions): ParseResult {
  if (options.signal?.aborted === true) {
    return {
      success: false,
      error: { code: 'parser-timeout', message: 'protocol.wirelessMbus.error.aborted' },
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

  if (data.length < BLOCK1_TOTAL_LENGTH) {
    return {
      success: false,
      error: {
        code: 'truncated-frame',
        message: ERROR_BLOCK1_TRUNCATED,
        offset: 0,
        length: data.length,
        details: { availableBytes: data.length, requiredBytes: BLOCK1_TOTAL_LENGTH },
      },
      consumedBytes: 0,
      recoverable: true,
    };
  }

  const fields: ParsedField[] = [];
  const warnings: ProtocolWarning[] = [];
  const errors: ProtocolError[] = [];

  pushRadioContextFields(fields, options);
  const { lField } = pushBlock1Fields(data, fields, warnings, errors);

  let block2PayloadLength = 0;
  if (lField < BLOCK1_HEADER_LENGTH) {
    errors.push({
      code: 'value-out-of-range',
      message: ERROR_INVALID_LENGTH_FIELD,
      offset: 0,
      length: 1,
      details: { lField, minimum: BLOCK1_HEADER_LENGTH },
    });
  } else {
    block2PayloadLength = lField - BLOCK1_HEADER_LENGTH;
  }

  let numChunks = 0;
  if (block2PayloadLength > 0) {
    const dataBlocks = readDataBlocks(data, block2PayloadLength, fields, errors);
    numChunks = dataBlocks.numChunks;
    const concatenated = dataBlocks.concatenated;

    if (concatenated.length > 0) {
      const ciByte = byteAt(concatenated, 0);
      const ciOffset = BLOCK1_TOTAL_LENGTH;
      const ciName = CI_FIELD_NAMES.get(ciByte);
      fields.push({
        id: 'ci-field',
        name: 'CI Field',
        offset: ciOffset,
        length: 1,
        rawBytes: concatenated.slice(0, 1),
        rawValue: formatHexByte(ciByte),
        physicalValue: ciName,
        valid: ciName !== undefined,
        warnings: ciName !== undefined ? [] : [WARN_UNKNOWN_CI],
      });
      if (ciName === undefined) pushWarningOnce(warnings, WARN_UNKNOWN_CI);

      const remainder = concatenated.slice(1);
      const remainderBaseOffset = ciOffset + 1;

      if (ciByte === CI_LONG_HEADER) {
        if (numChunks > 1) pushWarningOnce(warnings, WARN_MULTI_BLOCK_OFFSET_APPROXIMATE);

        let securityMode: number | undefined;
        if (remainder.length >= FIXED_HEADER_LENGTH) {
          const configBytes = remainder.slice(FIXED_HEADER_LENGTH - 2, FIXED_HEADER_LENGTH);
          const cfg2 = byteAt(configBytes, 1);
          securityMode = cfg2 & 0x1f;
          pushSecurityModeField(fields, securityMode, remainderBaseOffset + FIXED_HEADER_LENGTH - 2, configBytes);
          if (SECURITY_MODE_NAMES.get(securityMode) === undefined) {
            pushWarningOnce(warnings, WARN_UNNAMED_SECURITY_MODE);
          }
        }

        if (securityMode === undefined || securityMode === SECURITY_MODE_NONE) {
          decodeVariableData(remainder, remainderBaseOffset, fields, warnings, errors);
        } else {
          decodeVariableData(remainder.slice(0, FIXED_HEADER_LENGTH), remainderBaseOffset, fields, warnings, errors);
          const encryptedPayload = remainder.slice(FIXED_HEADER_LENGTH);
          if (encryptedPayload.length > 0) {
            fields.push({
              id: 'encrypted-payload',
              name: 'Encrypted Payload',
              offset: remainderBaseOffset + FIXED_HEADER_LENGTH,
              length: encryptedPayload.length,
              rawBytes: encryptedPayload,
              physicalValue: 'Encrypted',
              valid: true,
              warnings: [WARN_ENCRYPTED_PAYLOAD],
            });
            pushWarningOnce(warnings, WARN_ENCRYPTED_PAYLOAD);
          }
        }
      } else {
        fields.push({
          id: 'apl-payload',
          name: 'APL Payload',
          offset: remainderBaseOffset,
          length: remainder.length,
          rawBytes: remainder,
          unit: 'B',
          valid: true,
          warnings: ciName !== undefined ? [WARN_CI_NOT_DECODED] : [],
        });
        if (ciName !== undefined) pushWarningOnce(warnings, WARN_CI_NOT_DECODED);
      }
    }
  }

  const numChunkBytes = numChunks * 2 + Math.max(0, block2PayloadLength);
  const totalFrameLength = BLOCK1_TOTAL_LENGTH + numChunkBytes;
  if (data.length > totalFrameLength) {
    const trailing = data.slice(totalFrameLength);
    fields.push({
      id: 'trailing-data',
      name: 'Trailing Data',
      offset: totalFrameLength,
      length: trailing.length,
      rawBytes: trailing,
      unit: 'B',
      valid: false,
      warnings: [WARN_TRAILING_BYTES],
    });
    pushWarningOnce(warnings, WARN_TRAILING_BYTES);
  }

  const rawFrame = createRawFrame(data, {
    ...(options.timestamp === undefined ? {} : { timestamp: options.timestamp }),
    ...(options.direction === undefined ? {} : { direction: options.direction }),
    ...(options.channel === undefined ? {} : { channel: options.channel }),
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

function resolveParseOptions(context: ParseContext | undefined): WirelessMbusParseOptions {
  const options = context?.options;
  return {
    ...(context?.timestamp === undefined ? {} : { timestamp: context.timestamp }),
    ...(context?.direction === undefined ? {} : { direction: context.direction }),
    ...(context?.channel === undefined ? {} : { channel: context.channel }),
    ...(context?.signal === undefined ? {} : { signal: context.signal }),
    radioMode: readSelectOption(options?.[OPTION_RADIO_MODE], RADIO_MODE_UNKNOWN),
    frequencyMhz: clampNumberOption(options?.[OPTION_FREQUENCY_MHZ], 100, 900, 868.95),
    rssiDbm: clampNumberOption(options?.[OPTION_RSSI_DBM], -140, 0, 0),
    linkQuality: clampNumberOption(options?.[OPTION_LINK_QUALITY], 0, 255, 0),
  };
}

export function parseWirelessMbus(data: Uint8Array): ParseResult {
  return parseWirelessMbusFrame(data, resolveParseOptions(undefined));
}

export const wirelessMbusParser: ProtocolParser = {
  protocolId: PROTOCOL_ID,
  displayName: PROTOCOL_DISPLAY_NAME,

  /** Ucuz ön eleme: yalnız asgari uzunluk + L-field'ın yapısal alt sınırı kontrol edilir. CRC burada DOĞRULANMAZ. */
  canParse(data: Uint8Array): boolean {
    if (data.length < BLOCK1_TOTAL_LENGTH) return false;
    return byteAt(data, 0) >= BLOCK1_HEADER_LENGTH;
  },

  parse(data: Uint8Array, context?: ParseContext): ParseResult {
    return parseWirelessMbusFrame(data, resolveParseOptions(context));
  },
};

const DECODE_OPTIONS: readonly DecodeOption[] = [
  {
    id: OPTION_RADIO_MODE,
    label: 'protocol.wirelessMbus.option.radioMode',
    kind: 'select',
    defaultValue: RADIO_MODE_UNKNOWN,
    description: 'protocol.wirelessMbus.option.radioMode.description',
    choices: [
      { value: RADIO_MODE_UNKNOWN, label: 'protocol.wirelessMbus.option.radioMode.unknown' },
      { value: 'T1', label: 'T1' },
      { value: 'T2', label: 'T2' },
      { value: 'S1', label: 'S1' },
      { value: 'S2', label: 'S2' },
      { value: 'C1', label: 'C1' },
      { value: 'C2', label: 'C2' },
    ],
  },
  {
    id: OPTION_FREQUENCY_MHZ,
    label: 'protocol.wirelessMbus.option.frequency',
    kind: 'number',
    defaultValue: 868.95,
    min: 100,
    max: 900,
    description: 'protocol.wirelessMbus.option.frequency.description',
  },
  {
    id: OPTION_RSSI_DBM,
    label: 'protocol.wirelessMbus.option.rssi',
    kind: 'number',
    defaultValue: 0,
    min: -140,
    max: 0,
    description: 'protocol.wirelessMbus.option.rssi.description',
  },
  {
    id: OPTION_LINK_QUALITY,
    label: 'protocol.wirelessMbus.option.linkQuality',
    kind: 'number',
    defaultValue: 0,
    min: 0,
    max: 255,
    description: 'protocol.wirelessMbus.option.linkQuality.description',
  },
];

/**
 * Örnek çerçeveler — hepsi ELLE inşa edildi ve bir Node script'iyle
 * (`CRC16_EN13757`nin bu depodaki motorla AYNI parametreleri: poly 0x3D65,
 * init 0, refin/refout false, xorout 0xFFFF) bağımsızca hesaplanan CRC
 * baytlarıyla dolduruldu — `wirelessMbus.test.ts` bu hesaplamaları
 * `computeNamedCrc('CRC16_EN13757')`nin KENDİSİYLE ayrıca doğrular (mbus.ts'nin
 * `sum8Checksum`ı bağımsız doğrulama deseninin aynısı). Fixed Header/DIF/VIF
 * baytları `mbus.ts`teki `long-frame-rsp-ud-variable-data` örneğiyle AYNI
 * Ident/Manufacturer/Version/Medium değerlerini taşır (inceleme kolaylığı).
 */
const EXAMPLE_FRAMES: ExampleFrame[] = [
  {
    id: 'simple-unencrypted',
    name: 'protocol.wirelessMbus.example.simpleUnencrypted.name',
    // L=25 → block2 payload 16 bayt (tek veri bloğu): CI=0x72 + FixedHeader(12,
    // mode0/şifresiz) + tek kayıt (DIF=0x01 8bit int, VIF=0x03 Energy Wh exp0,
    // DATA=0x2A=42 → Energy=42 Wh).
    bytes: Uint8Array.from([
      0x19, 0x44, 0x2d, 0x2c, 0x78, 0x56, 0x34, 0x12, 0x01, 0x04, 0x08, 0x00, 0x72, 0x78, 0x56, 0x34,
      0x12, 0x2d, 0x2c, 0x01, 0x04, 0x2a, 0x00, 0x00, 0x00, 0x01, 0x03, 0x2a, 0x86, 0x2e,
    ]),
    description: 'protocol.wirelessMbus.example.simpleUnencrypted.description',
    expectedValid: true,
  },
  {
    id: 'multi-block-three-records',
    name: 'protocol.wirelessMbus.example.multiBlockThreeRecords.name',
    // L=37 → block2 payload 28 bayt (2 veri bloğu: 16+12), 3 kayıt: Energy
    // 123456 Wh, Volume 12.565 m³, Flow Temperature 23.5°C — mbus.ts'nin wired
    // örneğiyle AYNI DIF/VIF/DATA baytları (yalnız DLL/TPL sarmalayıcı farklı).
    // Blok sınırı aşıldığı için `WARN_MULTI_BLOCK_OFFSET_APPROXIMATE` beklenir.
    bytes: Uint8Array.from([
      0x25, 0x44, 0x2d, 0x2c, 0x78, 0x56, 0x34, 0x12, 0x01, 0x04, 0x39, 0x75, 0x72, 0x78, 0x56, 0x34,
      0x12, 0x2d, 0x2c, 0x01, 0x04, 0x2a, 0x00, 0x00, 0x00, 0x04, 0x03, 0x40, 0x3d, 0xa9, 0xe2, 0x01,
      0x00, 0x03, 0x13, 0x15, 0x31, 0x00, 0x02, 0x5a, 0xeb, 0x00, 0x50, 0x3e,
    ]),
    description: 'protocol.wirelessMbus.example.multiBlockThreeRecords.description',
    expectedValid: true,
  },
  {
    id: 'encrypted-mode-5',
    name: 'protocol.wirelessMbus.example.encryptedMode5.name',
    // L=38 → block2 payload 29 bayt: CI=0x72 + FixedHeader(12, Configuration
    // Field=0x10,0x05 → N=1 şifreli blok, Security Mode=5) + 16 baytlık YER
    // TUTUCU şifreli blok (GERÇEK AES çıktısı DEĞİL — bu dalga şifre çözmüyor,
    // yalnız "Encrypted Payload" olarak gösterildiğini kanıtlamak için).
    bytes: Uint8Array.from([
      0x26, 0x44, 0x2d, 0x2c, 0x78, 0x56, 0x34, 0x12, 0x01, 0x04, 0x75, 0xc0, 0x72, 0x78, 0x56, 0x34,
      0x12, 0x2d, 0x2c, 0x01, 0x04, 0x2a, 0x00, 0x10, 0x05, 0xa0, 0xa1, 0xa2, 0x65, 0xed, 0xa3, 0xa4,
      0xa5, 0xa6, 0xa7, 0xa8, 0xa9, 0xaa, 0xab, 0xac, 0xad, 0xae, 0xaf, 0x2c, 0x64,
    ]),
    description: 'protocol.wirelessMbus.example.encryptedMode5.description',
    expectedValid: true,
  },
  {
    id: 'block1-crc-mismatch',
    name: 'protocol.wirelessMbus.example.block1CrcMismatch.name',
    // simple-unencrypted ile AYNI gövde, Block 1 CRC baytları kasten 0x00 0x00.
    bytes: Uint8Array.from([
      0x19, 0x44, 0x2d, 0x2c, 0x78, 0x56, 0x34, 0x12, 0x01, 0x04, 0x00, 0x00, 0x72, 0x78, 0x56, 0x34,
      0x12, 0x2d, 0x2c, 0x01, 0x04, 0x2a, 0x00, 0x00, 0x00, 0x01, 0x03, 0x2a, 0x86, 0x2e,
    ]),
    description: 'protocol.wirelessMbus.example.block1CrcMismatch.description',
    expectedValid: false,
  },
  {
    id: 'unsupported-ci',
    name: 'protocol.wirelessMbus.example.unsupportedCi.name',
    // L=14 → block2 payload 5 bayt: CI=0x78 ("No Header APL Follows") + 4 ham
    // bayt. Bu dalgada yalnız CI=0x72 DIF/VIF zincirine devredilir; 0x78
    // ADLANDIRILIR ama HAM + uyarı basılır.
    bytes: Uint8Array.from([
      0x0e, 0x44, 0x2d, 0x2c, 0x78, 0x56, 0x34, 0x12, 0x01, 0x04, 0x54, 0x66, 0x78, 0xaa, 0xbb, 0xcc,
      0xdd, 0x55, 0x33,
    ]),
    description: 'protocol.wirelessMbus.example.unsupportedCi.description',
    expectedValid: true,
  },
];

export const wirelessMbusPlugin: ProtocolPlugin = {
  id: PROTOCOL_ID,
  name: PROTOCOL_DISPLAY_NAME,
  category: 'industrial-automation',
  parser: wirelessMbusParser,
  documentation: {
    summary: 'protocol.wirelessMbus.documentation.summary',
    layer: 'multi-layer',
    references: [
      {
        title: 'rtl_433 m_bus.c (open source, DLL/CRC reference)',
        url: 'https://github.com/merbanan/rtl_433/blob/master/src/devices/m_bus.c',
      },
      {
        title: 'wmbusmeters wmbus.cc/.h (open source, TPL/CI-field/Configuration Field reference)',
        url: 'https://github.com/wmbusmeters/wmbusmeters',
      },
      {
        title: 'OMS-Group Open Metering System Specification Vol.2 — Primary Communication (public PDF)',
        url: 'https://oms-group.org/en/specification/',
      },
      {
        title: 'reveng.sourceforge.io Catalogue of parametrised CRC algorithms (CRC-16/EN-13757)',
        url: 'https://reveng.sourceforge.io/crc-catalogue/16.htm',
      },
    ],
  },
  exampleFrames: EXAMPLE_FRAMES,
  decodeOptions: DECODE_OPTIONS,
};
