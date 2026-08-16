/**
 * DNP3 (IEEE 1815) — SCADA/telecontrol katmanlı protokolü. Girdi HAM DNP3 link
 * katmanı çerçevesidir (seri hat ya da DNP3-over-TCP'nin taşıdığı aynı bayt
 * dizisi): `0x05 0x64` start baytlarıyla başlayan, 16'şar baytlık bloklara
 * bölünmüş ve her bloğun kendi CRC'si olan tek bir link-katmanı çerçevesi.
 *
 * ── KAYNAK UYARISI (Karar 2, brief-faz10-dalga5.md) ─────────────────────────
 * IEEE 1815'in resmi metni ÜCRETLİdir ve bu depoda YOK. Aşağıdaki alan
 * düzenleri, bit yerleşimleri ve dar kod kümeleri İKİ bağımsız kamuya açık
 * ikincil kaynaktan ÇAPRAZ TEYİTLE alındı: **opendnp3** (Automatak, Apache-2.0
 * — yalnız dokümantasyonu/alan tabloları referans alındı, KOD KOPYALANMADI) ve
 * **Wireshark'ın `packet-dnp3.c` dissector'ının alenen yayımlanan alan/kod
 * tablosu**. İki kaynağın da aynı numarayı aynı adla verdiği alanlar
 * adlandırıldı; teyit edilemeyen ya da tek kaynakta geçen alanlar HAM
 * (yalnız sayı) bırakıldı — uydurma yasağı (CLAUDE.md, Karar 2).
 *
 * ── KAPSAM ÇİZGİSİ (Karar 6) ─────────────────────────────────────────────────
 * Application katmanı yalnız OBJECT HEADER'a kadar çözülür: Group, Variation,
 * Qualifier (prefix code + range specifier), Range/Count alanı. Object
 * HEADER'DAN SONRAKİ veri (asıl point değerleri) HER ZAMAN ham "Object Data"
 * blok olarak gösterilir — variation'a göre veri düzeni çözümü spec'in kendi
 * "ilk aşama" çizgisinin (39048-39060) ötesi, sonraki faz işi. Group numarası
 * ÇİFT kaynak teyidi varsa adlandırılır (küçük, yaygın grup kümesi); Variation
 * numarası HİÇBİR ZAMAN adlandırılmaz — o zaten "variation'a göre çözüm"ün
 * kendisi olurdu.
 *
 * ── TRANSPORT SEGMENTASYONU: BİRLEŞTİRME YOK (isotp.ts emsali) ─────────────
 * Transport baytı (FIN/FIR/SEQ) her zaman alan alan gösterilir. FIR=1 VE FIN=1
 * değilse (çok-segmentli bir application mesajının parçası), bu motor
 * segmentleri BİRLEŞTİRMEZ — dalga 1 kararı, `isotp.ts`nin First/Consecutive
 * Frame'i birleştirmeme kararıyla aynı sınır. Segment verisi ham gösterilir,
 * `WARN_MULTI_SEGMENT_SESSION` ile işaretlenir.
 *
 * ── ŞİFRELİ/AUTH İÇERİK (Karar 8) ────────────────────────────────────────────
 * DNP3 Secure Authentication (Object Group 120) fonksiyon kodları ve
 * challenge/response verisi bu motorda ADLANDIRILMAZ — dar function-code
 * kümesinin dışında bırakıldı, görülürse ham + "bilinmeyen function code"
 * uyarısıyla geçer. Anahtar girişi/şifre çözme HİÇBİR yerde yapılmaz.
 *
 * ── BLOK CRC YÜRÜYÜŞÜ VE OFSET TUZAĞI (bkz. dosya içi `UserDataBlock`) ──────
 * Link başlığından sonra kullanıcı verisi ("user data" — transport + application
 * katmanları) 16'şar baytlık BLOKLAR hâlinde gelir, her bloğun sonunda kendi
 * 2 baytlık CRC'si vardır (son blok 16'dan kısa olabilir, yine CRC'lidir).
 * `ParsedField.offset` HER ZAMAN HAM (CRC'li) tampondaki konumdur — bayt-viewer
 * ham baytları gösterir, CRC'si soyulmuş "mantıksal" akıştaki konumu DEĞİL.
 * Bu yüzden transport/application alanları `UserDataBlock[]` üzerinden mantıksal
 * konumdan ham konuma haritalanarak üretilir (`readCursorSpan`). Bir alan iki
 * blok arasındaki CRC sınırını AŞARSA (yalnız çok büyük application
 * mesajlarında, tek blok 16 baytı aştığında olası), o alan tek parça hâlinde
 * gösterilemez — motor o noktada teslim olur, kalanı tek bir ham blok olarak
 * basar (`WARN_HEADER_SPANS_BLOCK_BOUNDARY`); yanlış/kaydırılmış bir alan
 * göstermek yerine dürüstçe pes eder.
 *
 * ── CRC16_DNP ────────────────────────────────────────────────────────────────
 * `crcCatalogue.ts`teki `CRC16_DNP` (poly 0x3D65, reflected, xorout 0xFFFF)
 * kullanılır — yeniden yazılmadı. Telde LSB-first (küçük uçlu) yerleşir; bu da
 * iki kaynaktan teyitli: opendnp3'ün CRC serileştirmesi düşük bayt önce yazar,
 * Wireshark dissector'ı iki CRC baytını little-endian okur. Modbus RTU'nun aynı
 * "veri big-endian, CRC little-endian" tuzağı burada da geçerli.
 */

import {
  computeChecksum,
  readStoredChecksum,
} from '@/protocol-core/checksums/algorithmCatalogue';
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

const PROTOCOL_ID = 'dnp3';
/** Protokol adı veridir, çeviriye girmez (CLAUDE.md). */
const PROTOCOL_DISPLAY_NAME = 'DNP3';

const START_BYTE_1 = 0x05;
const START_BYTE_2 = 0x64;

/** Link başlığı: Start(2)+Length(1)+Control(1)+Dest(2)+Source(2)+CRC(2) = 10 bayt. */
const LINK_HEADER_LENGTH = 10;
/** Length CRC'leri kapsamaz; Control+Dest+Source = 5 bayt asgari (user data yok). */
const MIN_LENGTH_FIELD = 5;
/** Gövde bloğunun azami ham veri uzunluğu; son blok bundan kısa olabilir. */
const BODY_BLOCK_MAX_RAW = 16;
const BLOCK_CRC_LENGTH = 2;
const HEADER_CRC_LENGTH = 2;

const HEX_RADIX = 16;

const ERROR_FRAME_TOO_SHORT = 'protocol.dnp3.error.frameTooShort';
const ERROR_FRAME_TOO_LONG = 'protocol.dnp3.error.frameTooLong';
const ERROR_ABORTED = 'protocol.dnp3.error.aborted';
const ERROR_START_BYTES_INVALID = 'protocol.dnp3.error.startBytesInvalid';
const ERROR_LENGTH_TOO_SMALL = 'protocol.dnp3.error.lengthTooSmall';
const ERROR_HEADER_CRC_MISMATCH = 'protocol.dnp3.error.headerCrcMismatch';
const ERROR_BLOCK_CRC_MISMATCH = 'protocol.dnp3.error.blockCrcMismatch';
const ERROR_BODY_TRUNCATED = 'protocol.dnp3.error.bodyTruncated';
const ERROR_APPLICATION_TRUNCATED = 'protocol.dnp3.error.applicationTruncated';

const WARN_UNKNOWN_LINK_FUNCTION_CODE = 'protocol.dnp3.warning.unknownLinkFunctionCode';
const WARN_UNKNOWN_APPLICATION_FUNCTION_CODE =
  'protocol.dnp3.warning.unknownApplicationFunctionCode';
const WARN_MULTI_SEGMENT_SESSION = 'protocol.dnp3.warning.multiSegmentSession';
const WARN_UNKNOWN_QUALIFIER = 'protocol.dnp3.warning.unknownQualifier';
const WARN_OBJECT_DATA_NEEDS_VARIATION_DECODE =
  'protocol.dnp3.warning.objectDataNeedsVariationDecode';
const WARN_HEADER_SPANS_BLOCK_BOUNDARY = 'protocol.dnp3.warning.headerSpansBlockBoundary';
const WARN_TRAILING_BYTES = 'protocol.dnp3.warning.trailingBytes';

const SUMMARY_LINK_ONLY = 'protocol.dnp3.summary.linkOnly';
const SUMMARY_MULTI_SEGMENT = 'protocol.dnp3.summary.multiSegment';
const SUMMARY_APPLICATION = 'protocol.dnp3.summary.application';

/**
 * Link katmanı function code'ları — PRM'ye göre İKİ AYRI küme (opendnp3
 * `LinkFunction`, Wireshark control alanı tablosu — iki kaynak da aynı beşli/
 * dörtlü kümeyi verir).
 */
const LINK_PRIMARY_FUNCTION_NAMES: ReadonlyMap<number, string> = new Map([
  [0x00, 'Reset Link States'],
  [0x02, 'Test Link States'],
  [0x03, 'Confirmed User Data'],
  [0x04, 'Unconfirmed User Data'],
  [0x09, 'Request Link Status'],
]);

const LINK_SECONDARY_FUNCTION_NAMES: ReadonlyMap<number, string> = new Map([
  [0x00, 'ACK'],
  [0x01, 'NACK'],
  [0x0b, 'Link Status'],
  [0x0f, 'Not Supported'],
]);

/**
 * Application katmanı function code'ları — TEK küme (link katmanının aksine
 * PRM'den bağımsız). Dar liste: iki kaynağın da NET adlandırdığı, Secure
 * Authentication (Karar 8) dışındaki kodlar.
 */
const APP_FUNCTION_CODE_NAMES: ReadonlyMap<number, string> = new Map([
  [0x00, 'Confirm'],
  [0x01, 'Read'],
  [0x02, 'Write'],
  [0x03, 'Select'],
  [0x04, 'Operate'],
  [0x05, 'Direct Operate'],
  [0x06, 'Direct Operate No Ack'],
  [0x07, 'Immediate Freeze'],
  [0x08, 'Immediate Freeze No Ack'],
  [0x09, 'Freeze And Clear'],
  [0x0a, 'Freeze And Clear No Ack'],
  [0x0d, 'Cold Restart'],
  [0x0e, 'Warm Restart'],
  [0x14, 'Enable Unsolicited Responses'],
  [0x15, 'Disable Unsolicited Responses'],
  [0x16, 'Assign Classes'],
  [0x17, 'Delay Measurement'],
  [0x81, 'Response'],
  [0x82, 'Unsolicited Response'],
]);

const APP_FUNCTION_RESPONSE = 0x81;
const APP_FUNCTION_UNSOLICITED_RESPONSE = 0x82;

/**
 * Yaygın Object Group'lar — YALNIZ Group adlandırılır (Karar 6). Variation
 * hiçbir zaman adlandırılmaz (o "variation'a göre çözüm"ün kendisi olurdu).
 */
const OBJECT_GROUP_NAMES: ReadonlyMap<number, string> = new Map([
  [1, 'Binary Input'],
  [2, 'Binary Input Event'],
  [10, 'Binary Output'],
  [12, 'Binary Output Command (CROB)'],
  [20, 'Counter'],
  [21, 'Frozen Counter'],
  [22, 'Counter Event'],
  [23, 'Frozen Counter Event'],
  [30, 'Analog Input'],
  [32, 'Analog Input Event'],
  [40, 'Analog Output Status'],
  [41, 'Analog Output Command'],
  [50, 'Time and Date'],
  [60, 'Class Objects'],
  [80, 'Internal Indications'],
  [110, 'Octet String'],
  [111, 'Octet String Event'],
]);

/** Qualifier'ın üst nibble'ı (Object Prefix Code) — opendnp3 `PrefixCode`. */
const PREFIX_CODE_NAMES: ReadonlyMap<number, string> = new Map([
  [0x0, 'No Prefix'],
  [0x1, '1-Octet Index'],
  [0x2, '2-Octet Index'],
  [0x3, '4-Octet Index'],
  [0x4, '1-Octet Object Size'],
  [0x5, '2-Octet Object Size'],
  [0x6, '4-Octet Object Size'],
]);

type RangeKind = 'start-stop' | 'count' | 'none' | 'free-format';

interface RangeSpecifierDefinition {
  readonly name: string;
  readonly kind: RangeKind;
  /** start/stop ya da count alanının KENDİ genişliği (bayt); 'none' için 0. */
  readonly fieldWidth: number;
}

/**
 * Qualifier'ın alt nibble'ı (Range Specifier) — opendnp3 `QualifierCode` ve
 * Wireshark'ın range specifier tablosunun KESİŞİMİ. Burada olmayan kodlar
 * (ör. 0x03/0x04/0x05 "absolute address" varyantları, 0x0A) iki kaynakta aynı
 * netlikte doğrulanamadı — UNKNOWN olarak bırakıldı (uydurma yasak).
 */
const RANGE_SPECIFIER_DEFINITIONS: ReadonlyMap<number, RangeSpecifierDefinition> = new Map([
  [0x00, { name: '8-bit Start/Stop Indices', kind: 'start-stop', fieldWidth: 1 }],
  [0x01, { name: '16-bit Start/Stop Indices', kind: 'start-stop', fieldWidth: 2 }],
  [0x02, { name: '32-bit Start/Stop Indices', kind: 'start-stop', fieldWidth: 4 }],
  [0x06, { name: 'No Range Field (All Objects)', kind: 'none', fieldWidth: 0 }],
  [0x07, { name: '8-bit Count', kind: 'count', fieldWidth: 1 }],
  [0x08, { name: '16-bit Count', kind: 'count', fieldWidth: 2 }],
  [0x09, { name: '32-bit Count', kind: 'count', fieldWidth: 4 }],
  [0x0b, { name: 'Free-format Qualifier', kind: 'free-format', fieldWidth: 0 }],
]);

interface IinBitDefinition {
  readonly bit: number;
  readonly id: string;
  readonly name: string;
}

/** IIN1 — cihaz durumu bayrakları (opendnp3 `IINField`, Wireshark IIN tablosu). */
const IIN1_BITS: readonly IinBitDefinition[] = [
  { bit: 0, id: 'iin1-broadcast', name: 'Broadcast' },
  { bit: 1, id: 'iin1-class1-events', name: 'Class 1 Events' },
  { bit: 2, id: 'iin1-class2-events', name: 'Class 2 Events' },
  { bit: 3, id: 'iin1-class3-events', name: 'Class 3 Events' },
  { bit: 4, id: 'iin1-need-time', name: 'Need Time' },
  { bit: 5, id: 'iin1-local-control', name: 'Local Control' },
  { bit: 6, id: 'iin1-device-trouble', name: 'Device Trouble' },
  { bit: 7, id: 'iin1-device-restart', name: 'Device Restart' },
];

/** IIN2 — istisna/hata bayrakları; bit 6-7 iki kaynakta da "Reserved". */
const IIN2_BITS: readonly IinBitDefinition[] = [
  { bit: 0, id: 'iin2-no-func-code-support', name: 'No Func Code Support' },
  { bit: 1, id: 'iin2-object-unknown', name: 'Object Unknown' },
  { bit: 2, id: 'iin2-parameter-error', name: 'Parameter Error' },
  { bit: 3, id: 'iin2-event-buffer-overflow', name: 'Event Buffer Overflow' },
  { bit: 4, id: 'iin2-already-executing', name: 'Already Executing' },
  { bit: 5, id: 'iin2-config-corrupt', name: 'Config Corrupt' },
  { bit: 6, id: 'iin2-reserved-6', name: 'Reserved' },
  { bit: 7, id: 'iin2-reserved-7', name: 'Reserved' },
];

function toProtocolWarning(key: string): ProtocolWarning {
  return { code: key, message: key };
}

/** noUncheckedIndexedAccess: bayt dizisi erişimi her yerde bu guard'dan geçer. */
function byteAt(data: Uint8Array, offset: number): number {
  return data[offset] ?? 0;
}

function readUint16Le(data: Uint8Array, offset: number): number {
  return byteAt(data, offset) | (byteAt(data, offset + 1) << 8);
}

/** `width` bayt küçük-uçlu okuma — çarpımla biriktirir (32-bit sola kaydırma tuzağı yok). */
function readUintLe(data: Uint8Array, offset: number, width: number): number {
  let value = 0;
  for (let index = width - 1; index >= 0; index -= 1) {
    value = value * 256 + byteAt(data, offset + index);
  }
  return value;
}

function formatHexByte(value: number): string {
  return `0x${value.toString(HEX_RADIX).toUpperCase().padStart(2, '0')}`;
}

/**
 * Bir CRC16_DNP hesaplar. `computeChecksum` yalnız `'none'` için `undefined`
 * döner; sabit algoritma verildiği için bu dal ölüdür ama tip guard'ı olmadan
 * derlenmez (modbusRtu.ts'teki aynı desen).
 */
function crc16Dnp(bytes: Uint8Array): number {
  return Number(computeChecksum(bytes, 'CRC16_DNP') ?? 0n);
}

/** Telde CRC LSB-first (dosya başı kaynak uyarısı) — `readStoredChecksum` little-endian okur. */
function readStoredCrc(bytes: Uint8Array): number {
  return Number(readStoredChecksum(bytes, 'little'));
}

/**
 * Bir gövde bloğunun ham tampondaki yeri + o bloğun mantıksal (CRC'siz) akış
 * içindeki konumu. `readCursorSpan` mantıksal konumdan ham konuma bunun
 * üzerinden haritalar (dosya başı ofset tuzağı notu).
 */
interface UserDataBlock {
  readonly logicalStart: number;
  readonly length: number;
  readonly rawStart: number;
}

interface AppCursor {
  readonly data: Uint8Array;
  readonly blocks: readonly UserDataBlock[];
  /** Başarıyla okunmuş bloklardan toplanan mantıksal bayt sayısı — DEKLARE edilen
   * Length değil, GERÇEKTEN elde olan (gövde yürüyüşü yarıda kesilmiş olabilir). */
  readonly logicalTotal: number;
  pos: number;
}

function cursorRemaining(cursor: AppCursor): number {
  return cursor.logicalTotal - cursor.pos;
}

function blockContaining(
  blocks: readonly UserDataBlock[],
  logicalPos: number,
): UserDataBlock | undefined {
  return blocks.find(
    (block) => logicalPos >= block.logicalStart && logicalPos < block.logicalStart + block.length,
  );
}

/** Bir mantıksal konumun ham tampondaki karşılığı — yalnız BAŞLANGIÇ noktası için. */
function rawOffsetOf(blocks: readonly UserDataBlock[], logicalPos: number): number | undefined {
  const block = blockContaining(blocks, logicalPos);
  if (block === undefined) return undefined;
  return block.rawStart + (logicalPos - block.logicalStart);
}

/**
 * `logicalEndExclusive`e kadarki verinin ham tampondaki BİTİŞ noktası — son
 * mantıksal baytı barındıran bloğun KENDİ verisinin sonu (`rawStart+length`),
 * o bloğun ardından gelen 2 baytlık CRC HARİÇ.
 *
 * TUZAK: burada `frameContentEnd` (tüm gövde bloklarının sonu) KULLANILAMAZ —
 * kalan mantıksal veri TEK bir blok içinde bitiyorsa (yaygın durum, ör. tek
 * bloklu küçük bir application mesajı), `frameContentEnd` o bloğun kendi
 * CRC'sini de alana dahil ederdi. Doğru bitiş her zaman "son mantıksal baytı
 * taşıyan bloğun veri sonu"dur; yalnız veri GERÇEKTEN bir sonraki bloğa
 * taşıyorsa araya o bloğun CRC'si (bilinçli olarak, dosya başı notu) girer.
 */
function rawEndOfLogicalRange(
  blocks: readonly UserDataBlock[],
  logicalEndExclusive: number,
): number | undefined {
  if (logicalEndExclusive <= 0) return undefined;
  const lastBlock = blockContaining(blocks, logicalEndExclusive - 1);
  if (lastBlock === undefined) return undefined;
  return lastBlock.rawStart + (logicalEndExclusive - lastBlock.logicalStart);
}

type CursorSpanResult =
  | { readonly kind: 'ok'; readonly rawOffset: number; readonly bytes: Uint8Array }
  | { readonly kind: 'exhausted' }
  | { readonly kind: 'boundary' };

/**
 * `count` baytlık bir alanı imleçten okur. Blok sınırını AŞARSA (`'boundary'`)
 * ya da mantıksal veri biterse (`'exhausted'`) imleç İLERLEMEZ — çağıran karar
 * verir (dosya başı ofset tuzağı notu).
 */
function readCursorSpan(cursor: AppCursor, count: number): CursorSpanResult {
  if (cursorRemaining(cursor) < count) return { kind: 'exhausted' };
  const block = blockContaining(cursor.blocks, cursor.pos);
  if (block === undefined) return { kind: 'exhausted' };
  if (cursor.pos + count > block.logicalStart + block.length) return { kind: 'boundary' };
  const rawOffset = block.rawStart + (cursor.pos - block.logicalStart);
  const bytes = cursor.data.slice(rawOffset, rawOffset + count);
  cursor.pos += count;
  return { kind: 'ok', rawOffset, bytes };
}

/**
 * Kalan mantıksal veriyi TEK bir ham alan olarak basar — çok-segment fragmanı,
 * object header sonrası veri ya da blok-sınırı-aşan alan için ortak yol.
 * Aralık `rawEndOfLogicalRange`in bulduğu (son mantıksal baytı taşıyan bloğun
 * veri sonu) noktaya kadar HAM tampondan alınır: araya giren blok CRC'leri
 * varsa (birden çok bloğa yayılan veri) bunlar da dahil olur — bilinçli: bu
 * alan zaten opak/çözülmemiş, CRC gürültüsünü saklamak yanlış bir hassasiyet
 * iddiası olurdu (dosya başı ofset tuzağı notu). Kalan veri TEK blok içinde
 * bitiyorsa (yaygın durum) o bloğun kendi CRC'si asla dahil EDİLMEZ.
 */
function pushRawRemainder(
  cursor: AppCursor,
  fields: ParsedField[],
  warnings: ProtocolWarning[],
  fieldId: string,
  fieldName: string,
  warnKey: string,
): void {
  const rawStart = rawOffsetOf(cursor.blocks, cursor.pos);
  const rawEnd = rawEndOfLogicalRange(cursor.blocks, cursor.logicalTotal);
  if (rawStart === undefined || rawEnd === undefined || rawEnd <= rawStart) return;
  fields.push({
    id: fieldId,
    name: fieldName,
    offset: rawStart,
    length: rawEnd - rawStart,
    rawBytes: cursor.data.slice(rawStart, rawEnd),
    unit: 'B',
    valid: true,
    warnings: [warnKey],
  });
  warnings.push(toProtocolWarning(warnKey));
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

interface ApplicationOutcome {
  functionCode: number | undefined;
  functionCodeName: string | undefined;
}

/**
 * Object header'ı çözer: Group/Variation/Qualifier/Range — Karar 6 çizgisi.
 * Range'den sonrası HER ZAMAN ham "Object Data" (variation-based çözüm YOK).
 */
function decodeObjectHeader(
  cursor: AppCursor,
  fields: ParsedField[],
  warnings: ProtocolWarning[],
  errors: ProtocolError[],
): void {
  const groupSpan = readCursorSpan(cursor, 1);
  if (groupSpan.kind === 'exhausted') return;
  if (groupSpan.kind === 'boundary') {
    pushRawRemainder(
      cursor,
      fields,
      warnings,
      'unparsed-application-data',
      'Unparsed Application Data',
      WARN_HEADER_SPANS_BLOCK_BOUNDARY,
    );
    return;
  }
  const group = byteAt(groupSpan.bytes, 0);
  const groupName = OBJECT_GROUP_NAMES.get(group);
  const groupField: ParsedField = {
    id: 'object-group',
    name: 'Object Group',
    offset: groupSpan.rawOffset,
    length: 1,
    rawBytes: groupSpan.bytes,
    rawValue: group,
    valid: true,
    warnings: [],
  };
  if (groupName !== undefined) groupField.physicalValue = groupName;
  fields.push(groupField);

  const variationSpan = readCursorSpan(cursor, 1);
  if (variationSpan.kind === 'exhausted') {
    errors.push({
      code: 'truncated-frame',
      message: ERROR_APPLICATION_TRUNCATED,
      offset: groupSpan.rawOffset + 1,
      length: 0,
    });
    return;
  }
  if (variationSpan.kind === 'boundary') {
    pushRawRemainder(
      cursor,
      fields,
      warnings,
      'unparsed-application-data',
      'Unparsed Application Data',
      WARN_HEADER_SPANS_BLOCK_BOUNDARY,
    );
    return;
  }
  // Variation NUMARASI hiçbir zaman adlandırılmaz (dosya başı, Karar 6).
  fields.push({
    id: 'object-variation',
    name: 'Object Variation',
    offset: variationSpan.rawOffset,
    length: 1,
    rawBytes: variationSpan.bytes,
    rawValue: byteAt(variationSpan.bytes, 0),
    valid: true,
    warnings: [],
  });

  const qualifierSpan = readCursorSpan(cursor, 1);
  if (qualifierSpan.kind === 'exhausted') {
    errors.push({
      code: 'truncated-frame',
      message: ERROR_APPLICATION_TRUNCATED,
      offset: variationSpan.rawOffset + 1,
      length: 0,
    });
    return;
  }
  if (qualifierSpan.kind === 'boundary') {
    pushRawRemainder(
      cursor,
      fields,
      warnings,
      'unparsed-application-data',
      'Unparsed Application Data',
      WARN_HEADER_SPANS_BLOCK_BOUNDARY,
    );
    return;
  }
  const qualifierByte = byteAt(qualifierSpan.bytes, 0);
  const prefixCode = (qualifierByte >>> 4) & 0x0f;
  const rangeCode = qualifierByte & 0x0f;
  const rangeDef = RANGE_SPECIFIER_DEFINITIONS.get(rangeCode);

  const qualifierField: ParsedField = {
    id: 'object-qualifier',
    name: 'Qualifier',
    offset: qualifierSpan.rawOffset,
    length: 1,
    rawBytes: qualifierSpan.bytes,
    rawValue: qualifierByte,
    valid: rangeDef !== undefined,
    warnings: [],
  };
  if (rangeDef !== undefined) {
    qualifierField.physicalValue = rangeDef.name;
  } else {
    qualifierField.warnings.push(WARN_UNKNOWN_QUALIFIER);
    warnings.push(toProtocolWarning(WARN_UNKNOWN_QUALIFIER));
  }
  fields.push(qualifierField);

  const prefixName = PREFIX_CODE_NAMES.get(prefixCode);
  const prefixField: ParsedField = {
    id: 'object-prefix-code',
    name: 'Object Prefix Code',
    offset: qualifierSpan.rawOffset,
    length: 1,
    rawBytes: qualifierSpan.bytes,
    rawValue: prefixCode,
    valid: prefixName !== undefined,
    warnings: [],
  };
  if (prefixName !== undefined) prefixField.physicalValue = prefixName;
  fields.push(prefixField);

  if (rangeDef === undefined) {
    // Range uzunluğu bilinmiyor: bundan sonrası çözülemez, tek ham blok.
    pushRawRemainder(
      cursor,
      fields,
      warnings,
      'object-data',
      'Object Data',
      WARN_UNKNOWN_QUALIFIER,
    );
    return;
  }

  if (rangeDef.kind === 'start-stop') {
    const startSpan = readCursorSpan(cursor, rangeDef.fieldWidth);
    if (startSpan.kind === 'exhausted') {
      errors.push({
        code: 'truncated-frame',
        message: ERROR_APPLICATION_TRUNCATED,
        offset: qualifierSpan.rawOffset + 1,
        length: 0,
      });
      return;
    }
    if (startSpan.kind === 'boundary') {
      pushRawRemainder(
        cursor,
        fields,
        warnings,
        'unparsed-application-data',
        'Unparsed Application Data',
        WARN_HEADER_SPANS_BLOCK_BOUNDARY,
      );
      return;
    }
    fields.push({
      id: 'range-start',
      name: 'Range Start',
      offset: startSpan.rawOffset,
      length: rangeDef.fieldWidth,
      rawBytes: startSpan.bytes,
      rawValue: readUintLe(startSpan.bytes, 0, rangeDef.fieldWidth),
      valid: true,
      warnings: [],
    });

    const stopSpan = readCursorSpan(cursor, rangeDef.fieldWidth);
    if (stopSpan.kind === 'exhausted') {
      errors.push({
        code: 'truncated-frame',
        message: ERROR_APPLICATION_TRUNCATED,
        offset: startSpan.rawOffset + rangeDef.fieldWidth,
        length: 0,
      });
      return;
    }
    if (stopSpan.kind === 'boundary') {
      pushRawRemainder(
        cursor,
        fields,
        warnings,
        'unparsed-application-data',
        'Unparsed Application Data',
        WARN_HEADER_SPANS_BLOCK_BOUNDARY,
      );
      return;
    }
    fields.push({
      id: 'range-stop',
      name: 'Range Stop',
      offset: stopSpan.rawOffset,
      length: rangeDef.fieldWidth,
      rawBytes: stopSpan.bytes,
      rawValue: readUintLe(stopSpan.bytes, 0, rangeDef.fieldWidth),
      valid: true,
      warnings: [],
    });
  } else if (rangeDef.kind === 'count') {
    const countSpan = readCursorSpan(cursor, rangeDef.fieldWidth);
    if (countSpan.kind === 'exhausted') {
      errors.push({
        code: 'truncated-frame',
        message: ERROR_APPLICATION_TRUNCATED,
        offset: qualifierSpan.rawOffset + 1,
        length: 0,
      });
      return;
    }
    if (countSpan.kind === 'boundary') {
      pushRawRemainder(
        cursor,
        fields,
        warnings,
        'unparsed-application-data',
        'Unparsed Application Data',
        WARN_HEADER_SPANS_BLOCK_BOUNDARY,
      );
      return;
    }
    fields.push({
      id: 'object-count',
      name: 'Object Count',
      offset: countSpan.rawOffset,
      length: rangeDef.fieldWidth,
      rawBytes: countSpan.bytes,
      rawValue: readUintLe(countSpan.bytes, 0, rangeDef.fieldWidth),
      valid: true,
      warnings: [],
    });
  }
  // 'none' → range alanı yok. 'free-format' → range/count düzeni çok karmaşık
  // (nesne başına index/boyut prefiksleri), Karar 6 sınırının zaten dışında —
  // ikisi de doğrudan aşağıdaki "Object Data" ham bloğuna düşer.

  if (cursorRemaining(cursor) > 0) {
    pushRawRemainder(
      cursor,
      fields,
      warnings,
      'object-data',
      'Object Data',
      WARN_OBJECT_DATA_NEEDS_VARIATION_DECODE,
    );
  }
}

/** Application Control + Function Code + (yanıtsa) IIN + tek object header. */
function decodeApplicationLayer(
  cursor: AppCursor,
  fields: ParsedField[],
  warnings: ProtocolWarning[],
  errors: ProtocolError[],
): ApplicationOutcome {
  const controlSpan = readCursorSpan(cursor, 1);
  if (controlSpan.kind !== 'ok') {
    if (controlSpan.kind === 'boundary') {
      pushRawRemainder(
        cursor,
        fields,
        warnings,
        'unparsed-application-data',
        'Unparsed Application Data',
        WARN_HEADER_SPANS_BLOCK_BOUNDARY,
      );
    }
    return { functionCode: undefined, functionCodeName: undefined };
  }
  const controlByte = byteAt(controlSpan.bytes, 0);
  const fin = (controlByte & 0x80) !== 0;
  const fir = (controlByte & 0x40) !== 0;
  const con = (controlByte & 0x20) !== 0;
  const uns = (controlByte & 0x10) !== 0;
  const seq = controlByte & 0x0f;
  pushBitField(fields, 'application-control-fin', 'FIN', controlSpan.rawOffset, controlSpan.bytes, fin ? 1 : 0);
  pushBitField(fields, 'application-control-fir', 'FIR', controlSpan.rawOffset, controlSpan.bytes, fir ? 1 : 0);
  pushBitField(fields, 'application-control-con', 'CON', controlSpan.rawOffset, controlSpan.bytes, con ? 1 : 0);
  pushBitField(fields, 'application-control-uns', 'UNS', controlSpan.rawOffset, controlSpan.bytes, uns ? 1 : 0);
  fields.push({
    id: 'application-control-sequence',
    name: 'Application SEQ',
    offset: controlSpan.rawOffset,
    length: 1,
    rawBytes: controlSpan.bytes,
    rawValue: seq,
    valid: true,
    warnings: [],
  });

  const functionSpan = readCursorSpan(cursor, 1);
  if (functionSpan.kind !== 'ok') {
    if (functionSpan.kind === 'exhausted') {
      errors.push({
        code: 'truncated-frame',
        message: ERROR_APPLICATION_TRUNCATED,
        offset: controlSpan.rawOffset + 1,
        length: 0,
      });
    } else {
      pushRawRemainder(
        cursor,
        fields,
        warnings,
        'unparsed-application-data',
        'Unparsed Application Data',
        WARN_HEADER_SPANS_BLOCK_BOUNDARY,
      );
    }
    return { functionCode: undefined, functionCodeName: undefined };
  }
  const functionCode = byteAt(functionSpan.bytes, 0);
  const functionCodeName = APP_FUNCTION_CODE_NAMES.get(functionCode);
  const functionField: ParsedField = {
    id: 'application-function-code',
    name: 'Function Code',
    offset: functionSpan.rawOffset,
    length: 1,
    rawBytes: functionSpan.bytes,
    rawValue: functionCode,
    valid: functionCodeName !== undefined,
    warnings: [],
  };
  if (functionCodeName !== undefined) {
    functionField.physicalValue = functionCodeName;
  } else {
    functionField.warnings.push(WARN_UNKNOWN_APPLICATION_FUNCTION_CODE);
    warnings.push(toProtocolWarning(WARN_UNKNOWN_APPLICATION_FUNCTION_CODE));
  }
  fields.push(functionField);

  const isResponse =
    functionCode === APP_FUNCTION_RESPONSE || functionCode === APP_FUNCTION_UNSOLICITED_RESPONSE;

  if (isResponse) {
    const iinSpan = readCursorSpan(cursor, 2);
    if (iinSpan.kind !== 'ok') {
      if (iinSpan.kind === 'exhausted') {
        errors.push({
          code: 'truncated-frame',
          message: ERROR_APPLICATION_TRUNCATED,
          offset: functionSpan.rawOffset + 1,
          length: 0,
        });
      } else {
        pushRawRemainder(
          cursor,
          fields,
          warnings,
          'unparsed-application-data',
          'Unparsed Application Data',
          WARN_HEADER_SPANS_BLOCK_BOUNDARY,
        );
      }
      return { functionCode, functionCodeName };
    }
    const iin1Byte = byteAt(iinSpan.bytes, 0);
    const iin1Bytes = iinSpan.bytes.slice(0, 1);
    for (const bitDef of IIN1_BITS) {
      pushBitField(fields, bitDef.id, bitDef.name, iinSpan.rawOffset, iin1Bytes, (iin1Byte >> bitDef.bit) & 1);
    }
    const iin2Byte = byteAt(iinSpan.bytes, 1);
    const iin2Bytes = iinSpan.bytes.slice(1, 2);
    for (const bitDef of IIN2_BITS) {
      pushBitField(
        fields,
        bitDef.id,
        bitDef.name,
        iinSpan.rawOffset + 1,
        iin2Bytes,
        (iin2Byte >> bitDef.bit) & 1,
      );
    }
  }

  if (cursorRemaining(cursor) > 0) {
    decodeObjectHeader(cursor, fields, warnings, errors);
  }

  return { functionCode, functionCodeName };
}

export type Dnp3FrameMetadata = {
  linkFunctionCode: number;
  linkFunctionName: string | undefined;
  applicationFunctionCode: number | undefined;
  applicationFunctionName: string | undefined;
  summaryKey: string;
  summaryParams: Record<string, string>;
};

interface Dnp3ParseOptions {
  timestamp?: number;
  direction?: FrameDirection;
  channel?: string;
  maxFrameLength?: number;
  signal?: AbortSignal;
}

function parseDnp3Frame(data: Uint8Array, options: Dnp3ParseOptions): ParseResult {
  if (options.signal?.aborted === true) {
    return {
      success: false,
      error: { code: 'parser-timeout', message: ERROR_ABORTED },
      consumedBytes: 0,
      recoverable: false,
    };
  }

  if (data.length < LINK_HEADER_LENGTH) {
    return {
      success: false,
      error: {
        code: 'truncated-frame',
        message: ERROR_FRAME_TOO_SHORT,
        offset: 0,
        length: data.length,
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

  // --- Link katmanı: start bytes ---
  const start1 = byteAt(data, 0);
  const start2 = byteAt(data, 1);
  const startValid = start1 === START_BYTE_1 && start2 === START_BYTE_2;
  fields.push({
    id: 'start-bytes',
    name: 'Start Bytes',
    offset: 0,
    length: 2,
    rawBytes: data.slice(0, 2),
    rawValue: `${formatHexByte(start1)} ${formatHexByte(start2)}`,
    valid: startValid,
    warnings: startValid ? [] : [ERROR_START_BYTES_INVALID],
  });
  if (!startValid) {
    errors.push({
      code: 'start-delimiter-not-found',
      message: ERROR_START_BYTES_INVALID,
      offset: 0,
      length: 2,
    });
  }

  // --- Length ---
  const length = byteAt(data, 2);
  const lengthValid = length >= MIN_LENGTH_FIELD;
  fields.push({
    id: 'length',
    name: 'Length',
    offset: 2,
    length: 1,
    rawBytes: data.slice(2, 3),
    rawValue: length,
    unit: 'B',
    valid: lengthValid,
    warnings: lengthValid ? [] : [ERROR_LENGTH_TOO_SMALL],
  });
  if (!lengthValid) {
    errors.push({
      code: 'value-out-of-range',
      message: ERROR_LENGTH_TOO_SMALL,
      offset: 2,
      length: 1,
      details: { length, minimum: MIN_LENGTH_FIELD },
    });
  }

  // --- Control ---
  const controlByte = byteAt(data, 3);
  const controlBytes = data.slice(3, 4);
  const dir = (controlByte & 0x80) !== 0;
  const prm = (controlByte & 0x40) !== 0;
  const bit5 = (controlByte & 0x20) !== 0;
  const bit4 = (controlByte & 0x10) !== 0;
  const linkFunctionCode = controlByte & 0x0f;

  pushBitField(fields, 'link-direction', 'DIR', 3, controlBytes, dir ? 1 : 0);
  pushBitField(fields, 'link-primary', 'PRM', 3, controlBytes, prm ? 1 : 0);
  pushBitField(fields, 'link-control-bit5', prm ? 'FCB' : 'Reserved', 3, controlBytes, bit5 ? 1 : 0);
  pushBitField(fields, 'link-control-bit4', prm ? 'FCV' : 'DFC', 3, controlBytes, bit4 ? 1 : 0);

  const linkFunctionNames = prm ? LINK_PRIMARY_FUNCTION_NAMES : LINK_SECONDARY_FUNCTION_NAMES;
  const linkFunctionName = linkFunctionNames.get(linkFunctionCode);
  const linkFunctionField: ParsedField = {
    id: 'link-function-code',
    name: 'Link Function Code',
    offset: 3,
    length: 1,
    rawBytes: controlBytes,
    rawValue: linkFunctionCode,
    valid: linkFunctionName !== undefined,
    warnings: [],
  };
  if (linkFunctionName !== undefined) {
    linkFunctionField.physicalValue = linkFunctionName;
  } else {
    linkFunctionField.warnings.push(WARN_UNKNOWN_LINK_FUNCTION_CODE);
    warnings.push(toProtocolWarning(WARN_UNKNOWN_LINK_FUNCTION_CODE));
  }
  fields.push(linkFunctionField);

  // --- Destination / Source (16-bit LE) ---
  const destination = readUint16Le(data, 4);
  fields.push({
    id: 'destination',
    name: 'Destination',
    offset: 4,
    length: 2,
    rawBytes: data.slice(4, 6),
    rawValue: destination,
    valid: true,
    warnings: [],
  });

  const source = readUint16Le(data, 6);
  fields.push({
    id: 'source',
    name: 'Source',
    offset: 6,
    length: 2,
    rawBytes: data.slice(6, 8),
    rawValue: source,
    valid: true,
    warnings: [],
  });

  // --- Header CRC (offset 0-7'yi kapsar) ---
  const headerCovered = data.slice(0, LINK_HEADER_LENGTH - HEADER_CRC_LENGTH);
  const headerCrcCalculated = crc16Dnp(headerCovered);
  const headerCrcBytes = data.slice(LINK_HEADER_LENGTH - HEADER_CRC_LENGTH, LINK_HEADER_LENGTH);
  const headerCrcReceived = readStoredCrc(headerCrcBytes);
  const headerCrcValid = headerCrcReceived === headerCrcCalculated;
  fields.push({
    id: 'header-crc',
    name: 'Header CRC',
    offset: LINK_HEADER_LENGTH - HEADER_CRC_LENGTH,
    length: HEADER_CRC_LENGTH,
    rawBytes: headerCrcBytes,
    rawValue: headerCrcReceived,
    physicalValue: headerCrcCalculated,
    valid: headerCrcValid,
    warnings: [],
  });
  if (!headerCrcValid) {
    errors.push({
      code: 'crc-mismatch',
      message: ERROR_HEADER_CRC_MISMATCH,
      offset: LINK_HEADER_LENGTH - HEADER_CRC_LENGTH,
      length: HEADER_CRC_LENGTH,
      details: { received: headerCrcReceived, calculated: headerCrcCalculated },
    });
  }

  // --- Gövde blokları (Length'e göre; CRC'ler HARİÇ) ---
  const blocks: UserDataBlock[] = [];
  let remainingUserData = lengthValid ? length - MIN_LENGTH_FIELD : 0;
  let rawCursor = LINK_HEADER_LENGTH;
  let logicalTotal = 0;
  let blockIndex = 0;

  while (remainingUserData > 0) {
    const blockRawLength = Math.min(BODY_BLOCK_MAX_RAW, remainingUserData);
    const neededPhysical = blockRawLength + BLOCK_CRC_LENGTH;
    if (data.length - rawCursor < neededPhysical) {
      errors.push({
        code: 'truncated-frame',
        message: ERROR_BODY_TRUNCATED,
        offset: rawCursor,
        length: data.length - rawCursor,
        details: { blockIndex },
      });
      break;
    }

    const blockDataRawStart = rawCursor;
    const blockData = data.slice(blockDataRawStart, blockDataRawStart + blockRawLength);
    const blockCrcOffset = blockDataRawStart + blockRawLength;
    const blockCrcBytes = data.slice(blockCrcOffset, blockCrcOffset + BLOCK_CRC_LENGTH);
    const blockCrcCalculated = crc16Dnp(blockData);
    const blockCrcReceived = readStoredCrc(blockCrcBytes);
    const blockCrcValid = blockCrcReceived === blockCrcCalculated;

    fields.push({
      id: `block-crc-${String(blockIndex)}`,
      name: `Block CRC (${String(blockIndex + 1)})`,
      offset: blockCrcOffset,
      length: BLOCK_CRC_LENGTH,
      rawBytes: blockCrcBytes,
      rawValue: blockCrcReceived,
      physicalValue: blockCrcCalculated,
      valid: blockCrcValid,
      warnings: blockCrcValid ? [] : [ERROR_BLOCK_CRC_MISMATCH],
    });
    if (!blockCrcValid) {
      // Tutmayan blok CRC'si HATA'dır ama yürüyüş DEVAM EDER (dosya başı, brief
      // tuzağı): sonraki bloklar ve transport/application çözümü yine denenir.
      errors.push({
        code: 'crc-mismatch',
        message: ERROR_BLOCK_CRC_MISMATCH,
        offset: blockCrcOffset,
        length: BLOCK_CRC_LENGTH,
        details: { blockIndex, received: blockCrcReceived, calculated: blockCrcCalculated },
      });
    }

    blocks.push({ logicalStart: logicalTotal, length: blockRawLength, rawStart: blockDataRawStart });
    logicalTotal += blockRawLength;
    rawCursor += neededPhysical;
    remainingUserData -= blockRawLength;
    blockIndex += 1;
  }

  const frameContentEnd = rawCursor;

  // --- Transport + Application katmanları ---
  let applicationFunctionCode: number | undefined;
  let applicationFunctionName: string | undefined;
  let summaryKey = SUMMARY_LINK_ONLY;
  const summaryParams: Record<string, string> = {
    linkFunction: linkFunctionName ?? formatHexByte(linkFunctionCode),
  };

  if (logicalTotal > 0) {
    const cursor: AppCursor = { data, blocks, logicalTotal, pos: 0 };
    const transportSpan = readCursorSpan(cursor, 1);
    if (transportSpan.kind === 'ok') {
      const transportByte = byteAt(transportSpan.bytes, 0);
      const fin = (transportByte & 0x80) !== 0;
      const fir = (transportByte & 0x40) !== 0;
      const sequence = transportByte & 0x3f;
      pushBitField(fields, 'transport-fin', 'FIN', transportSpan.rawOffset, transportSpan.bytes, fin ? 1 : 0);
      pushBitField(fields, 'transport-fir', 'FIR', transportSpan.rawOffset, transportSpan.bytes, fir ? 1 : 0);
      fields.push({
        id: 'transport-sequence',
        name: 'Transport SEQ',
        offset: transportSpan.rawOffset,
        length: 1,
        rawBytes: transportSpan.bytes,
        rawValue: sequence,
        valid: true,
        warnings: [],
      });

      if (fir && fin) {
        const outcome = decodeApplicationLayer(cursor, fields, warnings, errors);
        applicationFunctionCode = outcome.functionCode;
        applicationFunctionName = outcome.functionCodeName;
        summaryKey = SUMMARY_APPLICATION;
        summaryParams['applicationFunction'] =
          applicationFunctionName ??
          (applicationFunctionCode === undefined ? '' : formatHexByte(applicationFunctionCode));
      } else {
        summaryKey = SUMMARY_MULTI_SEGMENT;
        summaryParams['sequence'] = String(sequence);
        pushRawRemainder(
          cursor,
          fields,
          warnings,
          'segment-data',
          'Segment Data',
          WARN_MULTI_SEGMENT_SESSION,
        );
      }
    }
  }

  // --- Trailing ---
  if (data.length > frameContentEnd) {
    const trailing = data.slice(frameContentEnd);
    fields.push({
      id: 'trailing-data',
      name: 'Trailing Data',
      offset: frameContentEnd,
      length: trailing.length,
      rawBytes: trailing,
      valid: false,
      warnings: [WARN_TRAILING_BYTES],
    });
    warnings.push(toProtocolWarning(WARN_TRAILING_BYTES));
  }

  const metadata: Dnp3FrameMetadata = {
    linkFunctionCode,
    linkFunctionName,
    applicationFunctionCode,
    applicationFunctionName,
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
    warnings,
  };

  return { success: true, frame, consumedBytes: data.length };
}

export function parseDnp3(data: Uint8Array): ParseResult {
  return parseDnp3Frame(data, {});
}

export const dnp3Parser: ProtocolParser = {
  protocolId: PROTOCOL_ID,
  displayName: PROTOCOL_DISPLAY_NAME,

  /** Ucuz ön eleme: asgari uzunluk + start baytları. CRC burada DOĞRULANMAZ. */
  canParse(data: Uint8Array): boolean {
    if (data.length < LINK_HEADER_LENGTH) return false;
    return byteAt(data, 0) === START_BYTE_1 && byteAt(data, 1) === START_BYTE_2;
  },

  parse(data: Uint8Array, context?: ParseContext): ParseResult {
    const options: Dnp3ParseOptions = {};
    if (context?.timestamp !== undefined) options.timestamp = context.timestamp;
    if (context?.direction !== undefined) options.direction = context.direction;
    if (context?.channel !== undefined) options.channel = context.channel;
    if (context?.maxFrameLength !== undefined) options.maxFrameLength = context.maxFrameLength;
    if (context?.signal !== undefined) options.signal = context.signal;
    return parseDnp3Frame(data, options);
  },
};

/**
 * Örnek çerçeveler — hepsi ELLE inşa edildi, blok/header CRC'leri `dnp3.test.ts`
 * içinde motorun HESAPLADIĞI değerle bağımsız ayrıca doğrulanıyor (LIN/UBX
 * emsali, dosya başı fixture uydurma yasağı notu).
 */
const EXAMPLE_FRAMES: ExampleFrame[] = [
  {
    id: 'link-only-request-link-status',
    name: 'protocol.dnp3.example.linkOnlyRequestLinkStatus.name',
    // Yalnız link katmanı: Length=5 (user data yok), master(1)→outstation(4),
    // primary function 0x09 Request Link Status.
    bytes: Uint8Array.from([0x05, 0x64, 0x05, 0xc9, 0x04, 0x00, 0x01, 0x00, 0x53, 0x3b]),
    description: 'protocol.dnp3.example.linkOnlyRequestLinkStatus.description',
    expectedValid: true,
  },
  {
    id: 'single-segment-read-class0',
    name: 'protocol.dnp3.example.singleSegmentReadClass0.name',
    // Tek segment: transport FIR=FIN=1, application Read (0x01), Group 60
    // Var 1 Qualifier 0x06 (Class 0 poll, range/data yok).
    bytes: Uint8Array.from([
      0x05, 0x64, 0x0b, 0xc4, 0x04, 0x00, 0x01, 0x00, 0x01, 0x30, 0xc0, 0xc0, 0x01, 0x3c, 0x01, 0x06,
      0xff, 0x50,
    ]),
    description: 'protocol.dnp3.example.singleSegmentReadClass0.description',
    expectedValid: true,
  },
  {
    id: 'response-with-iin',
    name: 'protocol.dnp3.example.responseWithIin.name',
    // outstation(4)→master(1), Response (0x81), IIN1=0x10 (Need Time), Group 1
    // (Binary Input) Var 2, Qualifier 0x00 (8-bit start/stop), index 0, 1 bayt
    // ham object data.
    bytes: Uint8Array.from([
      0x05, 0x64, 0x10, 0x44, 0x01, 0x00, 0x04, 0x00, 0x7f, 0xa2, 0xc0, 0xc0, 0x81, 0x10, 0x00, 0x01,
      0x02, 0x00, 0x00, 0x00, 0x81, 0x80, 0x3f,
    ]),
    description: 'protocol.dnp3.example.responseWithIin.description',
    expectedValid: true,
  },
  {
    id: 'multi-segment-first-segment',
    name: 'protocol.dnp3.example.multiSegmentFirstSegment.name',
    // Transport FIR=1, FIN=0: çok-segmentli bir mesajın İLK parçası —
    // application katmanı BİRLEŞTİRİLMEDEN ham "Segment Data" gösterilir.
    bytes: Uint8Array.from([
      0x05, 0x64, 0x0b, 0x44, 0x01, 0x00, 0x04, 0x00, 0x32, 0xd3, 0x40, 0x01, 0x02, 0x03, 0x04, 0x05,
      0x09, 0x48,
    ]),
    description: 'protocol.dnp3.example.multiSegmentFirstSegment.description',
    expectedValid: true,
  },
  {
    id: 'header-crc-mismatch',
    name: 'protocol.dnp3.example.headerCrcMismatch.name',
    // link-only-request-link-status ile AYNI header, CRC baytları kasten 00 00.
    bytes: Uint8Array.from([0x05, 0x64, 0x05, 0xc9, 0x04, 0x00, 0x01, 0x00, 0x00, 0x00]),
    description: 'protocol.dnp3.example.headerCrcMismatch.description',
    expectedValid: false,
  },
  {
    id: 'block-crc-mismatch',
    name: 'protocol.dnp3.example.blockCrcMismatch.name',
    // single-segment-read-class0 ile AYNI header (header CRC doğru), gövde
    // bloğunun CRC'si kasten 00 00.
    bytes: Uint8Array.from([
      0x05, 0x64, 0x0b, 0xc4, 0x04, 0x00, 0x01, 0x00, 0x01, 0x30, 0xc0, 0xc0, 0x01, 0x3c, 0x01, 0x06,
      0x00, 0x00,
    ]),
    description: 'protocol.dnp3.example.blockCrcMismatch.description',
    expectedValid: false,
  },
];

export const dnp3Plugin: ProtocolPlugin = {
  id: PROTOCOL_ID,
  name: PROTOCOL_DISPLAY_NAME,
  category: 'industrial-automation',
  parser: dnp3Parser,
  documentation: {
    summary: 'protocol.dnp3.documentation.summary',
    layer: 'multi-layer',
    references: [
      {
        title: 'opendnp3 documentation (Automatak, Apache-2.0)',
        url: 'https://github.com/automatak/dnp3',
      },
      {
        title: "Wireshark DNP3 dissector (packet-dnp3.c) field reference",
        url: 'https://www.wireshark.org/docs/dfref/d/dnp3.html',
      },
    ],
  },
  exampleFrames: EXAMPLE_FRAMES,
};
