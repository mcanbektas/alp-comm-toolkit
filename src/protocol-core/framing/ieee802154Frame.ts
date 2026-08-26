/**
 * IEEE 802.15.4 MAC çerçeve **KONTEYNERİ** — PAYLAŞILAN ÇEKİRDEK
 * (Faz 10, dalga 18d, `[KARAR 18-1]`).
 *
 * Bu modül `zigbee.ts`in içinden ÇIKARILDI. Dalga 7'de yazılan 802.15.4 MAC
 * okuyucusu Zigbee'nin NWK/APS/ZCL zincirine gömülüydü ve `thread` aynı teli
 * paylaştığı için ikinci bir kopya yazılacaktı. `hdlcCore.ts` (üç tüketici),
 * `xcpPacket.ts` (iki tüketici) ve `pulseLog.ts` (dalga 14g) disiplininin
 * dördüncü örneği.
 *
 * ── NE TAŞINDI, NE TAŞINMADI (`[KARAR 18-1]`: YALNIZ KONTEYNER) ───────────
 * TAŞINAN: FCF bit alanları, sıra numarası, adresleme planı, adres biçimleme
 * (EUI-64 ters/ayraçlı gösterim dahil), **başlık uzunluğu hesabı**, FCS
 * doğrulaması (`CRC16_KERMIT`).
 *
 * TAŞINMAYAN — ve bu bir eksiklik DEĞİL, kapsam çizgisidir:
 *   · Zigbee'ye özel her şey (NWK / APS / ZCL) — `zigbee.ts`te KALDI.
 *   · **Auxiliary Security Header** — `Security Enabled = 1` olduğunda
 *     çerçevede VARDIR ama çözümü protokole özeldir: Zigbee MAC katmanında
 *     güvenlik kullanmaz ve bugüne kadar hiç ayrıştırmadı, Thread ise onu
 *     TAM çözer. Bu çekirdek yalnız **VARLIĞINI** bildirir
 *     (`frameControl.securityEnabled` + `payloadStart`); baytlarını
 *     `thread/auxSecurityHeader.ts` okur.
 *     Emsal `pulseLog.ts:6-30`: *"yalnız KONTEYNERİN KENDİSİ taşındı;
 *     türetme protokole özeldir ve TAŞINMADI."*
 *
 * ── GİRDİ SÖZLEŞMESİ ──────────────────────────────────────────────────────
 * Girdi = **TAM 802.15.4 MAC çerçevesi, 2 baytlık FCS DAHİL**
 * (`LINKTYPE_IEEE802_15_4_WITHFCS` = 195). FCS'siz varyant (230), TAP sözde
 * başlığı (283), Linux SLL (191), NONASK PHY (215) ve ZEP kapsüllemesi
 * GİRDİ DEĞİLDİR — libpcap'in kendi link-type ayrımı kapsam çizgisini çiziyor
 * (`dot11Frame.ts`in radiotap ayrımıyla aynı gerekçe).
 *
 * ── KAPSAM: YALNIZ Frame Version 2003/2006 ────────────────────────────────
 * 2015+ (`0b10`) adresleme kuralları (Table 7-6) PAN ID varlığını dest/src
 * kipi × sürüm × sıkıştırma bitinin ÜÇLÜ çarpımından türetir ve ne Zigbee ne
 * Thread onu kullanır. Desteklenmeyen sürümde `supported: false` döner,
 * adresleme alanları HİÇ basılmaz ve yük başlığın hemen ardından başlar —
 * uydurulmuş bir ofset basmaktansa çözmemek doğrudur.
 *
 * ── FCS: `CRC16_KERMIT`, ve DÖRT SAHTE DOSTU ─────────────────────────────
 * Son 2 bayt, **little-endian**, kapsam = FCS hariç TÜM çerçeve. Katalogda
 * poly `0x1021` taşıyan BEŞ girdi var (`CCITT_FALSE`, `GENIBUS`, `XMODEM`,
 * `X25`, `KERMIT`) ve **yalnız KERMIT** 802.15.4 FCS'idir (init 0,
 * refin/refout true, xorout 0). Ötekiler hata VERMEDEN yanlış PASS/FAIL
 * basar (CLAUDE.md dalga 16a/17 dersi). Doğrulama: resmi spec §7.2.1.9'un
 * KENDİ worked example'ı (3 bayt → 0x79E4) — `ieee802154Frame.test.ts`.
 *
 * ── ALAN KABI: `ParsedField[]`, `FieldSink` DEĞİL ─────────────────────────
 * `dot11Frame.ts` bir `FieldSink` (fields + usedIds) taşır çünkü 18b'nin
 * element yürüyücüsü AYNI id'yi tekrar tekrar üretebiliyor. 802.15.4 MAC
 * başlığında her alan EN FAZLA BİR KEZ görünür; id çakışması yapısal olarak
 * imkânsız. Üstelik `FieldSink` `protocols/` altında yaşıyor ve `protocol-core`
 * oradan import EDEMEZ (katman yönü). Bu yüzden çekirdek düz `ParsedField[]`
 * alır — `zigbee.ts`in bugünkü kabının AYNISI, yani taşıma sırasında tek bir
 * bayt bile kaymaz.
 *
 * ── ÇEVİRİ ANAHTARLARI TÜKETİCİDEN GELİR ──────────────────────────────────
 * Alan ADLARI ("MAC Frame Type", "FCS") VERİDİR ve burada yaşar. Hata/uyarı
 * MESAJLARI ise çeviri anahtarıdır ve her tüketicinin kendi ön eki vardır
 * (`protocol.zigbee.…` / `protocol.thread.…`); çekirdek onları
 * `Ieee802154Messages` ile DIŞARIDAN alır. Ortak bir `protocol.ieee802154.…`
 * ön eki uydurmak sözlüğü üçüncü bir kökle ikizlerdi.
 *
 * ── KAYNAKLAR ─────────────────────────────────────────────────────────────
 * IEEE Std 802.15.4-2006 §7.2.1 (resmi) + Wireshark `packet-ieee802154.c/.h`
 * + OpenThread `mac_frame.hpp` — üçü bit bit örtüşüyor (dalga 7 kaynak turu).
 */

import { computeNamedCrc } from '@/protocol-core/checksums/crcCatalogue';
import { readBitsAsNumber } from '@/protocol-core/decoding/bitCursor';
import type { ParsedField, ProtocolError, ProtocolWarning } from '@/protocol-core/types';

// ── Uzunluk sabitleri ─────────────────────────────────────────────────────

export const IEEE802154_FCF_LENGTH = 2;
export const IEEE802154_SEQ_LENGTH = 1;
export const IEEE802154_PAN_ID_LENGTH = 2;
export const IEEE802154_SHORT_ADDR_LENGTH = 2;
export const IEEE802154_EXT_ADDR_LENGTH = 8;
export const IEEE802154_FCS_LENGTH = 2;

/** FCF + Sequence Number + FCS — bir çerçevenin var olabileceği en kısa hâl. */
export const IEEE802154_MIN_LENGTH =
  IEEE802154_FCF_LENGTH + IEEE802154_SEQ_LENGTH + IEEE802154_FCS_LENGTH;

// ── FCF bit yerleşimi (§7.2.1.1, LSB-first) ───────────────────────────────

export const IEEE802154_FRAME_TYPE_BIT_POSITION = 0;
export const IEEE802154_FRAME_TYPE_BIT_LENGTH = 3;
export const IEEE802154_SECURITY_BIT_POSITION = 3;
export const IEEE802154_FRAME_PENDING_BIT_POSITION = 4;
export const IEEE802154_ACK_REQUEST_BIT_POSITION = 5;
export const IEEE802154_PAN_ID_COMPRESSION_BIT_POSITION = 6;
export const IEEE802154_DEST_ADDR_MODE_BIT_POSITION = 10;
export const IEEE802154_ADDR_MODE_BIT_LENGTH = 2;
export const IEEE802154_FRAME_VERSION_BIT_POSITION = 12;
export const IEEE802154_FRAME_VERSION_BIT_LENGTH = 2;
export const IEEE802154_SRC_ADDR_MODE_BIT_POSITION = 14;

// ── Enum'lar — adlar VERİDİR, çeviriye girmez (CLAUDE.md) ─────────────────

export const IEEE802154_FRAME_TYPE_BEACON = 0b000;
export const IEEE802154_FRAME_TYPE_DATA = 0b001;
export const IEEE802154_FRAME_TYPE_ACK = 0b010;
export const IEEE802154_FRAME_TYPE_MAC_COMMAND = 0b011;

/** §7.2.1.1.1 Table 79 — 0/1/2/3 resmi metinden; 4-7 spec'te topluca "Reserved". */
export const IEEE802154_FRAME_TYPE_NAMES: ReadonlyMap<number, string> = new Map([
  [IEEE802154_FRAME_TYPE_BEACON, 'Beacon'],
  [IEEE802154_FRAME_TYPE_DATA, 'Data'],
  [IEEE802154_FRAME_TYPE_ACK, 'Acknowledgment'],
  [IEEE802154_FRAME_TYPE_MAC_COMMAND, 'MAC Command'],
]);

export const IEEE802154_ADDR_MODE_NONE = 0b00;
export const IEEE802154_ADDR_MODE_SHORT = 0b10;
export const IEEE802154_ADDR_MODE_EXT = 0b11;

/** §7.2.1.1.6/.8 Table 80 — resmi metin, dest/src ortak. */
export const IEEE802154_ADDR_MODE_NAMES: ReadonlyMap<number, string> = new Map([
  [IEEE802154_ADDR_MODE_NONE, 'Not present'],
  [0b01, 'Reserved'],
  [IEEE802154_ADDR_MODE_SHORT, '16-bit short address'],
  [IEEE802154_ADDR_MODE_EXT, '64-bit extended address'],
]);

export const IEEE802154_FRAME_VERSION_2003 = 0b00;
export const IEEE802154_FRAME_VERSION_2006 = 0b01;

/** §7.2.1.1.7 — resmi metin. 2015+ (Table 7-6) desteklenmiyor (dosya başı). */
export const IEEE802154_FRAME_VERSION_NAMES: ReadonlyMap<number, string> = new Map([
  [IEEE802154_FRAME_VERSION_2003, 'IEEE 802.15.4-2003'],
  [IEEE802154_FRAME_VERSION_2006, 'IEEE 802.15.4-2006'],
]);

// ── Temel okuyucular ──────────────────────────────────────────────────────

/** noUncheckedIndexedAccess: bayt dizisi erişimi her yerde bu guard'dan geçer. */
function byteAt(data: Uint8Array, offset: number): number {
  return data[offset] ?? 0;
}

function toHex(value: number, byteWidth: number): string {
  return `0x${value.toString(16).padStart(byteWidth * 2, '0').toUpperCase()}`;
}

function readUint16Le(bytes: Uint8Array, offset: number): number {
  return byteAt(bytes, offset) | (byteAt(bytes, offset + 1) << 8);
}

/**
 * Telde LE; ekranda geleneksel EUI-64 gösterimiyle TERS/ayraçlı. Bu bir
 * BİÇİMLEME kararıdır, bir bayt sırası düzeltmesi değil: aynı sekiz bayt
 * `zigbee`de NWK IEEE adresi, `thread`te Extended Address olarak aynı şekilde
 * yazılır (BLE AdvA / LoRaWAN EUI emsali).
 */
export function formatEui64(bytes: Uint8Array): string {
  return Array.from(bytes)
    .reverse()
    .map((byte) => byte.toString(16).padStart(2, '0').toUpperCase())
    .join(':');
}

export function ieee802154AddressLength(mode: number): number {
  if (mode === IEEE802154_ADDR_MODE_SHORT) return IEEE802154_SHORT_ADDR_LENGTH;
  if (mode === IEEE802154_ADDR_MODE_EXT) return IEEE802154_EXT_ADDR_LENGTH;
  return 0;
}

export const IEEE802154_ADDRESS_DISPLAY_EUI64 = 'eui64';
export const IEEE802154_ADDRESS_DISPLAY_RAW = 'raw';

/**
 * `display` varsayılanı `eui64`: `zigbee` bu parametreyi HİÇ vermez ve dalga
 * 7'den beri bastığı metin bayt bayt aynı kalır. `thread` `addressDisplay`
 * kanalını buraya bağlar — telde LE duran baytları ekranda ters çevirmek bir
 * BİÇİMLEME kararıdır ve kullanıcı ham tel sırasını görmek isteyebilir.
 */
export function formatIeee802154Address(
  mode: number,
  bytes: Uint8Array,
  display: string = IEEE802154_ADDRESS_DISPLAY_EUI64,
): string {
  if (display === IEEE802154_ADDRESS_DISPLAY_RAW) {
    return Array.from(bytes)
      .map((byte) => byte.toString(16).padStart(2, '0').toUpperCase())
      .join(' ');
  }
  if (mode === IEEE802154_ADDR_MODE_EXT) return formatEui64(bytes);
  return toHex(readUint16Le(bytes, 0), 2);
}

export interface Ieee802154DecodeOptions {
  /** `eui64` (varsayılan) ya da `raw` — bkz. `formatIeee802154Address`. */
  readonly addressDisplay?: string;
  /**
   * Son 2 baytın FCS olup olmadığı. Varsayılan `true` — girdi sözleşmesi
   * `LINKTYPE_IEEE802_15_4_WITHFCS` (195). `false` ⇒ yakalama FCS'siz
   * (`LINKTYPE_IEEE802_15_4_NOFCS` = 230) ve o iki bayt YÜKÜN PARÇASIDIR;
   * `payloadEnd` çerçevenin sonuna kayar.
   *
   * Kanal `thread`in `fcsPresent` seçeneğidir ve çekirdeğe İNMEK ZORUNDADIR:
   * `payloadEnd` yalnız yükün nerede bittiğini değil, adresleme alanlarının
   * TAŞIP TAŞMADIĞINI da belirliyor — tüketici tarafında düzeltilseydi
   * FCS'siz kısa bir çerçevede sahte `truncated-frame` basılırdı.
   * `zigbee` bu seçeneği HİÇ VERMEZ (sözleşmesi 195'tir) ve varsayılan
   * `true` sayesinde dalga 7'den beri bastığı çıktı bayt bayt aynı kalır.
   */
  readonly fcsPresent?: boolean;
}

// ── Frame Control Field ───────────────────────────────────────────────────

export interface Ieee802154FrameControl {
  readonly frameType: number;
  /** `1` ⇒ Auxiliary Security Header VARDIR; baytlarını tüketici okur. */
  readonly securityEnabled: number;
  readonly framePending: number;
  readonly ackRequest: number;
  readonly panIdCompression: number;
  readonly destAddrMode: number;
  readonly frameVersion: number;
  readonly srcAddrMode: number;
}

export function readIeee802154FrameControl(data: Uint8Array): Ieee802154FrameControl {
  return {
    frameType: readBitsAsNumber(
      data,
      IEEE802154_FRAME_TYPE_BIT_POSITION,
      IEEE802154_FRAME_TYPE_BIT_LENGTH,
      'lsb-first',
    ),
    securityEnabled: readBitsAsNumber(data, IEEE802154_SECURITY_BIT_POSITION, 1, 'lsb-first'),
    framePending: readBitsAsNumber(data, IEEE802154_FRAME_PENDING_BIT_POSITION, 1, 'lsb-first'),
    ackRequest: readBitsAsNumber(data, IEEE802154_ACK_REQUEST_BIT_POSITION, 1, 'lsb-first'),
    panIdCompression: readBitsAsNumber(
      data,
      IEEE802154_PAN_ID_COMPRESSION_BIT_POSITION,
      1,
      'lsb-first',
    ),
    destAddrMode: readBitsAsNumber(
      data,
      IEEE802154_DEST_ADDR_MODE_BIT_POSITION,
      IEEE802154_ADDR_MODE_BIT_LENGTH,
      'lsb-first',
    ),
    frameVersion: readBitsAsNumber(
      data,
      IEEE802154_FRAME_VERSION_BIT_POSITION,
      IEEE802154_FRAME_VERSION_BIT_LENGTH,
      'lsb-first',
    ),
    srcAddrMode: readBitsAsNumber(
      data,
      IEEE802154_SRC_ADDR_MODE_BIT_POSITION,
      IEEE802154_ADDR_MODE_BIT_LENGTH,
      'lsb-first',
    ),
  };
}

// ── Adresleme planı ───────────────────────────────────────────────────────

export interface Ieee802154AddressingPlan {
  readonly destPanPresent: boolean;
  readonly srcPanPresent: boolean;
  /** `false` ⇒ Frame Version desteklenmiyor; adresleme alanları BASILMAZ. */
  readonly supported: boolean;
}

/** §7.2.1.1.5/.6 (resmi metin, birebir) — yalnız 2003/2006 (dosya başı). */
export function planIeee802154Addressing(
  destMode: number,
  srcMode: number,
  panIdCompression: number,
  frameVersion: number,
): Ieee802154AddressingPlan {
  if (
    frameVersion !== IEEE802154_FRAME_VERSION_2003 &&
    frameVersion !== IEEE802154_FRAME_VERSION_2006
  ) {
    return { destPanPresent: false, srcPanPresent: false, supported: false };
  }
  const destPresent = destMode !== IEEE802154_ADDR_MODE_NONE;
  const srcPresent = srcMode !== IEEE802154_ADDR_MODE_NONE;
  if (destPresent && srcPresent) {
    return { destPanPresent: true, srcPanPresent: panIdCompression === 0, supported: true };
  }
  if (destPresent) return { destPanPresent: true, srcPanPresent: false, supported: true };
  if (srcPresent) return { destPanPresent: false, srcPanPresent: true, supported: true };
  return { destPanPresent: false, srcPanPresent: false, supported: true };
}

/**
 * MAC başlığının (FCF + Seq + adresleme) BAYT uzunluğu — **Auxiliary Security
 * Header HARİÇ.** `undefined` ⇒ Frame Version desteklenmiyor ya da adres kipi
 * ayrılmış (`0b01`); ofset UYDURULMAZ.
 *
 * `canParse` imzalarının orta ayağıdır: MAC yükünün ilk baytına (Zigbee'de NWK
 * Frame Control, Thread'de 6LoWPAN dispatch) bakabilmenin TEK yolu budur.
 * **Saf** — hiçbir alan basmaz.
 */
export function ieee802154HeaderLength(data: Uint8Array): number | undefined {
  const fc = readIeee802154FrameControl(data);
  const plan = planIeee802154Addressing(
    fc.destAddrMode,
    fc.srcAddrMode,
    fc.panIdCompression,
    fc.frameVersion,
  );
  if (!plan.supported) return undefined;
  if (fc.destAddrMode === 0b01 || fc.srcAddrMode === 0b01) return undefined;
  let length = IEEE802154_FCF_LENGTH + IEEE802154_SEQ_LENGTH;
  if (plan.destPanPresent) length += IEEE802154_PAN_ID_LENGTH;
  length += ieee802154AddressLength(fc.destAddrMode);
  if (plan.srcPanPresent) length += IEEE802154_PAN_ID_LENGTH;
  length += ieee802154AddressLength(fc.srcAddrMode);
  return length;
}

// ── FCS ───────────────────────────────────────────────────────────────────

export interface Ieee802154FcsCheck {
  readonly offset: number;
  readonly received: number;
  readonly calculated: number;
  readonly valid: boolean;
}

/**
 * Son 2 baytı FCS kabul edip `CRC16_KERMIT` ile doğrular. **Saf.**
 * FCS anahtarsız sade bir CRC'dir; MIC/checksum'ın "anahtar gerektirdiği için
 * PASS/FAIL basılmaz" kuralı (dalga 13 dersi 3) buraya UYGULANMAZ — gerçek
 * PASS/FAIL üretilir.
 */
export function checkIeee802154Fcs(data: Uint8Array): Ieee802154FcsCheck | undefined {
  if (data.length < IEEE802154_FCS_LENGTH) return undefined;
  const offset = data.length - IEEE802154_FCS_LENGTH;
  const received = readUint16Le(data, offset);
  const calculated = Number(computeNamedCrc(data.slice(0, offset), 'CRC16_KERMIT'));
  return { offset, received, calculated, valid: received === calculated };
}

// ── Tüketiciden gelen mesaj anahtarları ───────────────────────────────────

export interface Ieee802154Messages {
  /** Frame Version 2015+/ayrılmış — alan uyarısı + `ProtocolWarning`. */
  readonly frameVersionUnsupported: string;
  /** Adresleme alanları FCS'ten önce bitmiyor — `truncated-frame`. */
  readonly addressingTruncated: string;
  /** FCS tutmuyor — `crc-mismatch`. */
  readonly fcsMismatch: string;
}

function toProtocolWarning(key: string): ProtocolWarning {
  return { code: key, message: key };
}

// ── Özet — tüketicilerin TÜKETTİĞİ yüzey ──────────────────────────────────

export interface Ieee802154HeaderSummary {
  readonly frameControl: Ieee802154FrameControl;
  /** `undefined` ⇒ ayrılmış Frame Type (4-7); adlandırılmaz. */
  readonly frameTypeName: string | undefined;
  readonly sequenceNumber: number;
  readonly addressing: Ieee802154AddressingPlan;
  readonly destPanId: number | undefined;
  readonly destAddress: string | undefined;
  readonly srcPanId: number | undefined;
  readonly srcAddress: string | undefined;
  /**
   * Adreslerin HAM tel baytları (LE). `thread` bunları RFC 6282 §3.2.2'nin
   * IID türetiminde kullanır — biçimlenmiş metinden geri okumak baytı
   * yeniden UYDURMAK olurdu.
   */
  readonly destAddressBytes: Uint8Array | undefined;
  readonly srcAddressBytes: Uint8Array | undefined;
  /**
   * MAC yükünün MUTLAK başlangıcı. **Auxiliary Security Header'dan ÖNCE** —
   * `frameControl.securityEnabled === 1` ise tüketici önce onu okur.
   */
  readonly payloadStart: number;
  /** MAC yükünün MUTLAK sonu = FCS'in ofseti. */
  readonly payloadEnd: number;
  /** Adresleme alanları FCS'e taşmış; yük GÜVENİLİR DEĞİL. */
  readonly truncated: boolean;
}

/**
 * 802.15.4 MAC başlığını çözer ve alanlarını `fields`e basar.
 *
 * Hiçbir bayt TÜKETMEZ; dönen özet yükün NEREDE başladığını söyler. `zigbee`
 * oradan NWK'ya, `thread` oradan (varsa Aux Security Header'ı geçip)
 * 6LoWPAN'a girer.
 *
 * `baseOffset` YOKTUR ve bilerek yoktur: 802.15.4 çerçevesi her zaman girdinin
 * BAŞINDADIR (girdi sözleşmesi). Bir gün kapsülleyen bir taşıyıcı gelirse
 * çağıran `subarray` verir (`dot11Frame.ts` ile aynı gerekçe).
 *
 * **FCS'i BASMAZ** — `pushIeee802154Fcs` ayrı bir çağrıdır, çünkü tüketiciler
 * onu farklı SIRADA basar: `zigbee` FCS'i NWK/APS/ZCL alanlarından ÖNCE
 * basıyor (dalga 7'den beri) ve o sıra değişirse `data-field-id` seçicileri
 * kayar.
 */
export function decodeIeee802154Header(
  data: Uint8Array,
  fields: ParsedField[],
  warnings: ProtocolWarning[],
  errors: ProtocolError[],
  messages: Ieee802154Messages,
  options: Ieee802154DecodeOptions = {},
): Ieee802154HeaderSummary {
  const addressDisplay = options.addressDisplay ?? IEEE802154_ADDRESS_DISPLAY_EUI64;
  const fc = readIeee802154FrameControl(data);

  const frameTypeField: ParsedField = {
    id: 'mac-frame-type',
    name: 'MAC Frame Type',
    offset: 0,
    length: IEEE802154_FRAME_TYPE_BIT_LENGTH,
    rawBytes: data.slice(0, 1),
    rawValue: fc.frameType,
    valid: IEEE802154_FRAME_TYPE_NAMES.has(fc.frameType),
    warnings: [],
  };
  const frameTypeName = IEEE802154_FRAME_TYPE_NAMES.get(fc.frameType);
  if (frameTypeName !== undefined) frameTypeField.physicalValue = frameTypeName;
  fields.push(frameTypeField);

  fields.push({
    id: 'mac-security',
    name: 'Security Enabled',
    offset: 0,
    length: 1,
    rawBytes: data.slice(0, 1),
    rawValue: fc.securityEnabled,
    valid: true,
    warnings: [],
  });

  fields.push({
    id: 'mac-frame-pending',
    name: 'Frame Pending',
    offset: 0,
    length: 1,
    rawBytes: data.slice(0, 1),
    rawValue: fc.framePending,
    valid: true,
    warnings: [],
  });

  fields.push({
    id: 'mac-ack-request',
    name: 'Ack Request',
    offset: 0,
    length: 1,
    rawBytes: data.slice(0, 1),
    rawValue: fc.ackRequest,
    valid: true,
    warnings: [],
  });

  fields.push({
    id: 'mac-pan-id-compression',
    name: 'PAN ID Compression',
    offset: 0,
    length: 1,
    rawBytes: data.slice(0, 1),
    rawValue: fc.panIdCompression,
    valid: true,
    warnings: [],
  });

  fields.push({
    id: 'mac-dest-addr-mode',
    name: 'Destination Addressing Mode',
    offset: 1,
    length: IEEE802154_ADDR_MODE_BIT_LENGTH,
    rawBytes: data.slice(1, 2),
    rawValue: fc.destAddrMode,
    physicalValue: IEEE802154_ADDR_MODE_NAMES.get(fc.destAddrMode),
    valid: true,
    warnings: [],
  });

  const frameVersionField: ParsedField = {
    id: 'mac-frame-version',
    name: 'Frame Version',
    offset: 1,
    length: IEEE802154_FRAME_VERSION_BIT_LENGTH,
    rawBytes: data.slice(1, 2),
    rawValue: fc.frameVersion,
    valid: true,
    warnings: [],
  };
  const frameVersionName = IEEE802154_FRAME_VERSION_NAMES.get(fc.frameVersion);
  if (frameVersionName !== undefined) {
    frameVersionField.physicalValue = frameVersionName;
  } else {
    frameVersionField.warnings = [messages.frameVersionUnsupported];
    warnings.push(toProtocolWarning(messages.frameVersionUnsupported));
  }
  fields.push(frameVersionField);

  fields.push({
    id: 'mac-src-addr-mode',
    name: 'Source Addressing Mode',
    offset: 1,
    length: IEEE802154_ADDR_MODE_BIT_LENGTH,
    rawBytes: data.slice(1, 2),
    rawValue: fc.srcAddrMode,
    physicalValue: IEEE802154_ADDR_MODE_NAMES.get(fc.srcAddrMode),
    valid: true,
    warnings: [],
  });

  fields.push({
    id: 'mac-seq',
    name: 'Sequence Number',
    offset: IEEE802154_FCF_LENGTH,
    length: IEEE802154_SEQ_LENGTH,
    rawBytes: data.slice(IEEE802154_FCF_LENGTH, IEEE802154_FCF_LENGTH + IEEE802154_SEQ_LENGTH),
    rawValue: byteAt(data, IEEE802154_FCF_LENGTH),
    valid: true,
    warnings: [],
  });

  let cursor = IEEE802154_FCF_LENGTH + IEEE802154_SEQ_LENGTH;
  const payloadEnd =
    options.fcsPresent === false ? data.length : data.length - IEEE802154_FCS_LENGTH;
  let payloadStart = cursor;
  let truncated = false;
  let destPanId: number | undefined;
  let destAddress: string | undefined;
  let destAddressBytes: Uint8Array | undefined;
  let srcPanId: number | undefined;
  let srcAddress: string | undefined;
  let srcAddressBytes: Uint8Array | undefined;

  const addressing = planIeee802154Addressing(
    fc.destAddrMode,
    fc.srcAddrMode,
    fc.panIdCompression,
    fc.frameVersion,
  );

  if (addressing.supported) {
    if (addressing.destPanPresent) {
      if (cursor + IEEE802154_PAN_ID_LENGTH > payloadEnd) truncated = true;
      else {
        destPanId = readUint16Le(data, cursor);
        fields.push({
          id: 'mac-dest-pan',
          name: 'Destination PAN ID',
          offset: cursor,
          length: IEEE802154_PAN_ID_LENGTH,
          rawBytes: data.slice(cursor, cursor + IEEE802154_PAN_ID_LENGTH),
          rawValue: toHex(destPanId, 2),
          valid: true,
          warnings: [],
        });
        cursor += IEEE802154_PAN_ID_LENGTH;
      }
    }
    if (!truncated && fc.destAddrMode !== IEEE802154_ADDR_MODE_NONE) {
      const length = ieee802154AddressLength(fc.destAddrMode);
      if (length === 0 || cursor + length > payloadEnd) truncated = true;
      else {
        destAddressBytes = data.slice(cursor, cursor + length);
        destAddress = formatIeee802154Address(fc.destAddrMode, destAddressBytes, addressDisplay);
        fields.push({
          id: 'mac-dest-addr',
          name: 'Destination Address',
          offset: cursor,
          length,
          rawBytes: data.slice(cursor, cursor + length),
          rawValue: destAddress,
          valid: true,
          warnings: [],
        });
        cursor += length;
      }
    }
    if (!truncated && addressing.srcPanPresent) {
      if (cursor + IEEE802154_PAN_ID_LENGTH > payloadEnd) truncated = true;
      else {
        srcPanId = readUint16Le(data, cursor);
        fields.push({
          id: 'mac-src-pan',
          name: 'Source PAN ID',
          offset: cursor,
          length: IEEE802154_PAN_ID_LENGTH,
          rawBytes: data.slice(cursor, cursor + IEEE802154_PAN_ID_LENGTH),
          rawValue: toHex(srcPanId, 2),
          valid: true,
          warnings: [],
        });
        cursor += IEEE802154_PAN_ID_LENGTH;
      }
    }
    if (!truncated && fc.srcAddrMode !== IEEE802154_ADDR_MODE_NONE) {
      const length = ieee802154AddressLength(fc.srcAddrMode);
      if (length === 0 || cursor + length > payloadEnd) truncated = true;
      else {
        srcAddressBytes = data.slice(cursor, cursor + length);
        srcAddress = formatIeee802154Address(fc.srcAddrMode, srcAddressBytes, addressDisplay);
        fields.push({
          id: 'mac-src-addr',
          name: 'Source Address',
          offset: cursor,
          length,
          rawBytes: data.slice(cursor, cursor + length),
          rawValue: srcAddress,
          valid: true,
          warnings: [],
        });
        cursor += length;
      }
    }
    if (truncated) {
      errors.push({
        code: 'truncated-frame',
        message: messages.addressingTruncated,
        offset: cursor,
        length: payloadEnd - cursor,
      });
    }
  }
  payloadStart = cursor;

  return {
    frameControl: fc,
    frameTypeName,
    sequenceNumber: byteAt(data, IEEE802154_FCF_LENGTH),
    addressing,
    destPanId,
    destAddress,
    destAddressBytes,
    srcPanId,
    srcAddress,
    srcAddressBytes,
    payloadStart,
    payloadEnd,
    truncated,
  };
}

/**
 * FCS alanını basar ve tutmuyorsa `crc-mismatch` hatası ekler. Ayrı bir çağrı
 * olmasının gerekçesi `decodeIeee802154Header`in yorumunda.
 */
export function pushIeee802154Fcs(
  data: Uint8Array,
  fields: ParsedField[],
  errors: ProtocolError[],
  messages: Ieee802154Messages,
): Ieee802154FcsCheck | undefined {
  const check = checkIeee802154Fcs(data);
  if (check === undefined) return undefined;
  fields.push({
    id: 'mac-fcs',
    name: 'FCS',
    offset: check.offset,
    length: IEEE802154_FCS_LENGTH,
    rawBytes: data.slice(check.offset, check.offset + IEEE802154_FCS_LENGTH),
    rawValue: toHex(check.received, 2),
    physicalValue: check.valid ? 'PASS' : 'FAIL',
    valid: check.valid,
    warnings: [],
  });
  if (!check.valid) {
    errors.push({
      code: 'crc-mismatch',
      message: messages.fcsMismatch,
      offset: check.offset,
      length: IEEE802154_FCS_LENGTH,
      details: {
        received: check.received.toString(16),
        calculated: check.calculated.toString(16),
      },
    });
  }
  return check;
}
