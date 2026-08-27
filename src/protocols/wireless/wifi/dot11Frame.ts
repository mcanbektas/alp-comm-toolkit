/**
 * IEEE 802.11 MAC başlığı çözücüsü — **PAYLAŞILAN ÇEKİRDEK** (Faz 10, dalga 18a).
 *
 * Bu modül `wifi` kaydının içinde yaşar ama ONA AİT DEĞİLDİR: `hdlcCore.ts`
 * (üç tüketicili) ve `xcpPacket.ts` (iki tüketicili) disiplininin üçüncü
 * örneğidir. **İki tüketicisi vardır ve ikisi de bugünden bellidir:**
 *   · **18b** — yönetim gövdeleri + IE yürüyücüsü: `bodyOffset`/`bodyLength`,
 *     `frameClass`, `subtype` ve `fcsPresent` üzerinden gövdeye girer;
 *   · **18c** — `esp-now`: ESP-NOW bir 802.11 **vendor-specific action
 *     frame**'idir ve Espressif'in KENDİ şeması ilk 24 baytı 802.11 MAC
 *     başlığı, son 4 baytı 802.11 FCS diye tanımlar (`[KARAR 18-4]`).
 * Bu yüzden adres rol matrisi ve sınıf başına değişken başlık uzunluğu
 * `wifi.ts`in İÇİNE GÖMÜLMEZ, burada yaşar ve `export` edilir.
 * (`zigbee.ts`in yaptığı hata — `planMacAddressing`/`macAddressLength`in
 * hiçbirinin `export` edilmemesi — burada TEKRARLANMAZ.)
 *
 * ── GİRDİ SÖZLEŞMESİ `[KARAR 18-2]` ───────────────────────────────────────
 * Girdi = **ÇIPLAK IEEE 802.11 MAC çerçevesi, 4 baytlık FCS DAHİL**
 * (`LINKTYPE_IEEE802_11` = 105 gövdesi).
 *
 * **Radiotap (127), PPI (192), Prism (119), AVS (163) başlıkları ve pcap
 * zarfı GİRDİ DEĞİLDİR.** Bu ayrım bu deponun icadı değil, **libpcap'in kendi
 * mimarisidir**: beş ayrı link-type numarası var ve dördü "metadata + 802.11"
 * demek. Wireshark da ikiye bölüyor (`packet-ieee80211.c` ve ayrı bir dosya
 * olan `packet-ieee80211-radiotap.c`). Kapsam çizgisini birinci sınıf
 * kaynağın KENDİ mimarisi çiziyor.
 *
 * ── KAPSAM DIŞI — açıkça ──────────────────────────────────────────────────
 *   · Radiotap/PPI/Prism/AVS başlıkları ve pcap zarfı (ayrı link-type)
 *   · HT/VHT/HE/EHT **PHY** parametreleri (MCS, spatial stream, GI, RSSI,
 *     kanal, bant genişliği) — yakalama adaptörü metadata'sı
 *   · WPA/WPA2/WPA3 el sıkışması (EAPOL), PMKID, SAE
 *   · Şifre çözme (WEP/TKIP/CCMP/GCMP) — CLAUDE.md'nin anahtar kuralı:
 *     `Protected = 1` ise gövde ŞİFRELİ damgasıyla HAM kalır, öteye İNİLMEZ
 *   · A-MSDU / A-MPDU ayrıştırma ve defragmentation — çerçeveler arası durum
 *   · Connection Timeline, Airtime & Channel Occupancy, Coexistence Analyzer
 *     — hepsi çok-çerçeveli
 *   · Type 3 (Extension / DMG Beacon) — ayrı bir başlık düzeni
 *
 * ── 🚨 ADRES ROL MATRİSİ — "Address1 = Dest" VARSAYILMAZ ──────────────────
 * Deponun kendi spec'i bunu ayrıca uyarıyor (`docs/spec/ozet/09-kablosuz-iot.md:147`).
 * Adreslerin anlamı `ToDS × FromDS`e göre değişir; matris `resolveAddressRoles`
 * içinde TEK YERDE yaşar ve gerçek yakalamayla doğrulandı: korumalı Data
 * çerçevesi `08 42 …` (ToDS=0, FromDS=1) → Addr1 = `01:80:C2:00:00:00`
 * (STP çoklu yayın = DA), Addr2 = BSSID, Addr3 = SA. Matris tutuyor.
 *
 * ── 🚨 +HTC/Order TUZAĞI ──────────────────────────────────────────────────
 * FC bit 15 VERİ çerçevelerinde "Order" (strictly ordered), **QoS Data ve
 * Yönetim** çerçevelerinde "+HTC" anlamına gelir. HT Control alanı yalnız
 * ikincisinde VARDIR; QoS-olmayan bir Data çerçevesinde aynı bit 1 olsa bile
 * HT Control YOKTUR. Bu ayrımı kaçırmak gövdeyi 4 bayt kaydırır, HATA
 * VERMEDEN.
 *
 * > **Ana brifin sözde-kodu (`docs/brief-faz10-dalga18a.md:141`) bu ayrımı
 * > ATLIYOR** (`if (FC.order) → n += 4` diyor, tür kapısı yok) ama AYNI
 * > brifin hemen altındaki TUZAK notu doğruyu yazıyor. **Kod tuzağı
 * > uyguluyor, sözde-kodu değil** — dalga 17'nin "yorum ile kod ayrışırsa
 * > KOD kazanır" dersinin bir brif üzerindeki karşılığı.
 *
 * ── FCS: `CRC32`, ve SAHTE DOSTU `CRC32C` ─────────────────────────────────
 * Son 4 bayt, **little-endian**, CRC-32/ISO-HDLC (`crcCatalogue.ts` `CRC32`),
 * kapsam = FCS hariç TÜM çerçeve. Katalog eklemesi YOK — algoritma zaten
 * vardı ve gerçek yakalamayla ÖLÇÜLDÜ (`wpa-Induction.pcap`, 1093 çerçevenin
 * 1080'i PASS; kalan 13 gerçekten bozuk).
 *
 * 🚨 `CRC32C` (Castagnoli) katalogda hemen yanında: **aynı genişlik, aynı
 * init, aynı yansıma, aynı xorout — YALNIZ polinom farklı** (`0x1EDC6F41` ↔
 * `0x04C11DB7`). Hata VERMEDEN yanlış PASS/FAIL basar. `dot11Frame.test.ts`
 * ikisinin ayrıldığını gerçek bir çerçevede ASSERT eder.
 */

import { computeNamedCrc } from '@/protocol-core/checksums';
import type { ParsedField, ProtocolError, ProtocolWarning } from '@/protocol-core/types';

// ── Alan biriktirici — 18b ve 18c de bunu kullanır ────────────────────────

/**
 * Alanların ve kullanılmış id'lerin ortak kabı. Ayrı bir tip olmasının sebebi
 * `cnip.ts`teki ile aynı: id çakışması `ParsedField.id`yi sessizce ikizler ve
 * `data-field-id` seçicileri iki satır döndürür.
 */
export interface FieldSink {
  readonly fields: ParsedField[];
  readonly usedIds: Set<string>;
}

export function createFieldSink(): FieldSink {
  return { fields: [], usedIds: new Set<string>() };
}

export function uniqueFieldId(sink: FieldSink, base: string): string {
  if (!sink.usedIds.has(base)) {
    sink.usedIds.add(base);
    return base;
  }
  let suffix = 2;
  while (sink.usedIds.has(`${base}-${String(suffix)}`)) suffix += 1;
  const id = `${base}-${String(suffix)}`;
  sink.usedIds.add(id);
  return id;
}

export function pushField(sink: FieldSink, field: ParsedField): void {
  sink.fields.push({ ...field, id: uniqueFieldId(sink, field.id) });
}

export function toProtocolWarning(
  code: string,
  message: string,
  offset?: number,
  length?: number,
): ProtocolWarning {
  return {
    code,
    message,
    ...(offset === undefined ? {} : { offset }),
    ...(length === undefined ? {} : { length }),
  };
}

// ── Çeviri anahtarları ────────────────────────────────────────────────────
// `esp-now` (18c) kendi ön ekini kullanacak; buradaki anahtarlar MAC
// katmanına aittir ve `wifi` ön ekinde yaşar — çekirdek paylaşılıyor diye
// üçüncü bir ön ek uydurmak sözlüğü ikizlerdi.

const TRANSLATION_KEY_PREFIX = 'protocol.wifi';

export const ERROR_TOO_SHORT_FOR_HEADER = `${TRANSLATION_KEY_PREFIX}.error.tooShortForHeader`;
export const ERROR_TOO_SHORT_FOR_FCS = `${TRANSLATION_KEY_PREFIX}.error.tooShortForFcs`;
export const ERROR_EXTENSION_TYPE_OUT_OF_SCOPE = `${TRANSLATION_KEY_PREFIX}.error.extensionTypeOutOfScope`;
export const ERROR_FCS_MISMATCH = `${TRANSLATION_KEY_PREFIX}.error.fcsMismatch`;

export const WARN_PROTOCOL_VERSION_NOT_ZERO = `${TRANSLATION_KEY_PREFIX}.warning.protocolVersionNotZero`;
export const WARN_UNKNOWN_SUBTYPE = `${TRANSLATION_KEY_PREFIX}.warning.unknownSubtype`;
export const WARN_CONTROL_GEOMETRY_UNKNOWN = `${TRANSLATION_KEY_PREFIX}.warning.controlGeometryUnknown`;
export const WARN_FCS_MISMATCH = `${TRANSLATION_KEY_PREFIX}.warning.fcsMismatch`;
export const WARN_FCS_ABSENT = `${TRANSLATION_KEY_PREFIX}.warning.fcsAbsent`;
export const WARN_HT_CONTROL_FORCED = `${TRANSLATION_KEY_PREFIX}.warning.htControlForced`;
export const WARN_QOS_CONTROL_FORCED = `${TRANSLATION_KEY_PREFIX}.warning.qosControlForced`;
export const WARN_ORDER_BIT_WITHOUT_HT_CONTROL = `${TRANSLATION_KEY_PREFIX}.warning.orderBitWithoutHtControl`;
export const WARN_MANAGEMENT_DS_BITS_SET = `${TRANSLATION_KEY_PREFIX}.warning.managementDsBitsSet`;

const FIELD_WARN_FCS_MISMATCH = `${TRANSLATION_KEY_PREFIX}.field.fcsMismatch`;
const FIELD_WARN_UNKNOWN_SUBTYPE = `${TRANSLATION_KEY_PREFIX}.field.unknownSubtype`;
const FIELD_WARN_PROTOCOL_VERSION_NOT_ZERO = `${TRANSLATION_KEY_PREFIX}.field.protocolVersionNotZero`;
const FIELD_WARN_DS_BITS_UNEXPECTED = `${TRANSLATION_KEY_PREFIX}.field.dsBitsUnexpected`;

// ── Sabitler ve bit maskeleri — `export`, çünkü 18b/18c de okuyacak ───────

/** FCS 4 bayttır ve LITTLE-ENDIAN saklanır. */
export const DOT11_FCS_LENGTH = 4;
/** Frame Control iki bayttır ve her 802.11 çerçevesinde vardır. */
export const FRAME_CONTROL_LENGTH = 2;
/** FC(2) + Duration(2) + Address1(6): her çerçevede VAR olan en kısa gövde. */
export const DOT11_MINIMUM_HEADER_LENGTH = 10;
/** Yönetim ve QoS-olmayan Data çerçevesinin klasik başlığı. */
export const DOT11_BASE_HEADER_LENGTH = 24;
export const DOT11_ADDRESS_LENGTH = 6;
export const DOT11_SEQUENCE_CONTROL_LENGTH = 2;
export const DOT11_QOS_CONTROL_LENGTH = 2;
export const DOT11_HT_CONTROL_LENGTH = 4;

export const DOT11_TYPE_MANAGEMENT = 0;
export const DOT11_TYPE_CONTROL = 1;
export const DOT11_TYPE_DATA = 2;
export const DOT11_TYPE_EXTENSION = 3;

/** Bayt 0 maskeleri. */
export const FC_PROTOCOL_VERSION_MASK = 0x03;
export const FC_TYPE_SHIFT = 2;
export const FC_TYPE_MASK = 0x03;
export const FC_SUBTYPE_SHIFT = 4;
export const FC_SUBTYPE_MASK = 0x0f;

/** Bayt 1 maskeleri (bit 0 = To DS … bit 7 = +HTC/Order). */
export const FC_TO_DS_MASK = 0x01;
export const FC_FROM_DS_MASK = 0x02;
export const FC_MORE_FRAGMENTS_MASK = 0x04;
export const FC_RETRY_MASK = 0x08;
export const FC_POWER_MANAGEMENT_MASK = 0x10;
export const FC_MORE_DATA_MASK = 0x20;
export const FC_PROTECTED_MASK = 0x40;
export const FC_ORDER_HTC_MASK = 0x80;

/** Sequence Control: bit 0-3 Fragment Number, bit 4-15 Sequence Number. */
export const SEQUENCE_FRAGMENT_MASK = 0x000f;
export const SEQUENCE_NUMBER_SHIFT = 4;

/** Duration/ID bayrakları (IEEE 802.11 §9.2.4.2). */
const DURATION_IS_NOT_DURATION_MASK = 0x8000;
const DURATION_AID_MASK = 0x3fff;

/** Adresin ilk baytındaki I/G (bit 0) ve U/L (bit 1) bitleri. */
export const ADDRESS_GROUP_BIT_MASK = 0x01;
export const ADDRESS_LOCAL_BIT_MASK = 0x02;

/** Kontrol alt tipleri: ikisinde A2 de SeqCtl de YOKTUR (en kısa çerçeve). */
export const CONTROL_SUBTYPE_CTS = 12;
export const CONTROL_SUBTYPE_ACK = 13;
export const CONTROL_SUBTYPE_PS_POLL = 10;

/** Data alt tipi bit 3: 1 ⇒ QoS ailesi ⇒ QoS Control alanı VAR. */
export const DATA_SUBTYPE_QOS_MASK = 0x08;
/** Data alt tipi bit 2: 1 ⇒ "no data" (Null) varyantı. */
const DATA_SUBTYPE_NO_DATA_MASK = 0x04;
const DATA_SUBTYPE_CF_ACK_MASK = 0x01;
const DATA_SUBTYPE_CF_POLL_MASK = 0x02;

// ── Alt tip adları — VERİDİR, çeviriye girmez (CLAUDE.md) ─────────────────

export const MANAGEMENT_SUBTYPE_NAMES: ReadonlyMap<number, string> = new Map([
  [0, 'Association Request'],
  [1, 'Association Response'],
  [2, 'Reassociation Request'],
  [3, 'Reassociation Response'],
  [4, 'Probe Request'],
  [5, 'Probe Response'],
  [6, 'Timing Advertisement'],
  [8, 'Beacon'],
  [9, 'ATIM'],
  [10, 'Disassociation'],
  [11, 'Authentication'],
  [12, 'Deauthentication'],
  [13, 'Action'],
  [14, 'Action No Ack'],
]);

/**
 * Yalnız 8-15 ADLANDIRILIR. 0-7 aralığı (Beamforming Report Poll, NDP
 * Announcement, Control Frame Extension, Control Wrapper …) 802.11n/ac/ax
 * revizyonlarıyla geldi ve **başlık geometrileri birbirinden farklı**;
 * adlandırmak geometriyi biliyormuş gibi göstermek olurdu. Bilinmeyen alt tip
 * HATA DEĞİLDİR — `valid` `true` kalır, `physicalValue` boş.
 */
export const CONTROL_SUBTYPE_NAMES: ReadonlyMap<number, string> = new Map([
  [8, 'Block Ack Request'],
  [9, 'Block Ack'],
  [10, 'PS-Poll'],
  [11, 'RTS'],
  [12, 'CTS'],
  [13, 'ACK'],
  [14, 'CF-End'],
  [15, 'CF-End + CF-Ack'],
]);

/**
 * Data alt tip adı EZBERLENMEZ, alt tip bitlerinden **TÜRETİLİR**: bit 3 QoS,
 * bit 2 "no data" (Null), bit 1 CF-Poll, bit 0 CF-Ack. Bu, IEEE 802.11'in
 * kendi tablosunun kuruluş kuralıdır ve brifin saydığı dördü (0 Data,
 * 4 Null, 8 QoS Data, 12 QoS Null) tam olarak buradan çıkar.
 *
 * TEK istisna: alt tip 13 türetimi "QoS Null + CF-Ack" verir ama standartta
 * **REZERVE**dir — türetme oraya uygulanmaz.
 */
export function dataSubtypeName(subtype: number): string | undefined {
  if (subtype === 13) return undefined;
  const qos = (subtype & DATA_SUBTYPE_QOS_MASK) !== 0;
  const noData = (subtype & DATA_SUBTYPE_NO_DATA_MASK) !== 0;
  const parts: string[] = [];
  if (qos) parts.push('QoS');
  parts.push(noData ? 'Null' : 'Data');
  const suffixes: string[] = [];
  if ((subtype & DATA_SUBTYPE_CF_ACK_MASK) !== 0) suffixes.push('CF-Ack');
  if ((subtype & DATA_SUBTYPE_CF_POLL_MASK) !== 0) suffixes.push('CF-Poll');
  const base = parts.join(' ');
  return suffixes.length === 0 ? base : `${base} + ${suffixes.join(' + ')}`;
}

export function dot11SubtypeName(type: number, subtype: number): string | undefined {
  if (type === DOT11_TYPE_MANAGEMENT) return MANAGEMENT_SUBTYPE_NAMES.get(subtype);
  if (type === DOT11_TYPE_CONTROL) return CONTROL_SUBTYPE_NAMES.get(subtype);
  if (type === DOT11_TYPE_DATA) return dataSubtypeName(subtype);
  return undefined;
}

// ── OUI etiketleri — DAR ve KAYNAĞI BELLİ ─────────────────────────────────
/**
 * Deponun bir OUI veritabanı YOK ve bu dalga bir tane getirmiyor: 40 bin
 * satırlık IEEE kaydı bir protokol motorunun işi değil. Buradaki beş girdi
 * **IEEE'nin kendi MA-L kaydından tek tek doğrulandı**
 * (`https://standards-oui.ieee.org/oui/oui.csv`, çekildi 2026-08-26) ve
 * yalnız bu dalganın gerçek yakalamasında + 18c'nin çerçevesinde geçen
 * ön ekleri kapsıyor. Liste dar olduğu için `vendorAddressLabels` kanalıyla
 * KAPATILABİLİR olmak zorunda — kullanıcı "bu sözlük tam" sanmamalı.
 */
const OUI_LABELS: ReadonlyMap<string, string> = new Map([
  ['000C41', 'Cisco-Linksys, LLC'],
  ['000D93', 'Apple, Inc.'],
  ['000FAC', 'IEEE 802.11'],
  ['0050F2', 'Microsoft Corp.'],
  ['18FE34', 'Espressif Inc.'],
]);

/**
 * Ayrılmış GRUP adresleri — üretici değil, protokol sabitleri. Ayrı tutuluyor
 * çünkü `vendorAddressLabels` kapatıldığında bunlar KAYBOLMAMALI: "broadcast"
 * bir üretici adı değil, adresin anlamıdır.
 */
const GROUP_ADDRESS_LABELS: ReadonlyMap<string, string> = new Map([
  ['FFFFFFFFFFFF', 'broadcast'],
  ['0180C2000000', 'IEEE 802.1D Spanning Tree'],
]);

// ── Temel okuyucular ──────────────────────────────────────────────────────

function byteAt(data: Uint8Array, offset: number): number {
  return data[offset] ?? 0;
}

function readUint16Le(data: Uint8Array, offset: number): number {
  return byteAt(data, offset) | (byteAt(data, offset + 1) << 8);
}

function readUint32Le(data: Uint8Array, offset: number): number {
  return (
    (byteAt(data, offset) |
      (byteAt(data, offset + 1) << 8) |
      (byteAt(data, offset + 2) << 16) |
      (byteAt(data, offset + 3) << 24)) >>>
    0
  );
}

function hex(value: number, digits: number): string {
  return `0x${value.toString(16).toUpperCase().padStart(digits, '0')}`;
}

export function formatMacAddress(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).toUpperCase().padStart(2, '0')).join(':');
}

function ouiKey(bytes: Uint8Array): string {
  return Array.from(bytes.subarray(0, 3), (byte) =>
    byte.toString(16).toUpperCase().padStart(2, '0'),
  ).join('');
}

function addressKey(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).toUpperCase().padStart(2, '0')).join('');
}

// ── Frame Control ─────────────────────────────────────────────────────────

export type Dot11FrameClass = 'management' | 'control' | 'data' | 'extension';

export interface Dot11FrameControl {
  readonly protocolVersion: number;
  readonly type: number;
  readonly subtype: number;
  readonly toDs: boolean;
  readonly fromDs: boolean;
  readonly moreFragments: boolean;
  readonly retry: boolean;
  readonly powerManagement: boolean;
  readonly moreData: boolean;
  readonly protectedFrame: boolean;
  /** FC bit 15. Anlamı TÜRE BAĞLIDIR — dosya başındaki tuzak. */
  readonly orderOrHtc: boolean;
}

/**
 * İki baytlık Frame Control'ü çözer. **Saf**: hiçbir alan basmaz, hiçbir
 * uyarı üretmez. `canParse` da bunu kullanır, o yüzden ucuz olmak zorunda.
 */
export function readFrameControl(data: Uint8Array): Dot11FrameControl {
  const b0 = byteAt(data, 0);
  const b1 = byteAt(data, 1);
  return {
    protocolVersion: b0 & FC_PROTOCOL_VERSION_MASK,
    type: (b0 >> FC_TYPE_SHIFT) & FC_TYPE_MASK,
    subtype: (b0 >> FC_SUBTYPE_SHIFT) & FC_SUBTYPE_MASK,
    toDs: (b1 & FC_TO_DS_MASK) !== 0,
    fromDs: (b1 & FC_FROM_DS_MASK) !== 0,
    moreFragments: (b1 & FC_MORE_FRAGMENTS_MASK) !== 0,
    retry: (b1 & FC_RETRY_MASK) !== 0,
    powerManagement: (b1 & FC_POWER_MANAGEMENT_MASK) !== 0,
    moreData: (b1 & FC_MORE_DATA_MASK) !== 0,
    protectedFrame: (b1 & FC_PROTECTED_MASK) !== 0,
    orderOrHtc: (b1 & FC_ORDER_HTC_MASK) !== 0,
  };
}

export function classifyFrame(type: number): Dot11FrameClass {
  if (type === DOT11_TYPE_MANAGEMENT) return 'management';
  if (type === DOT11_TYPE_CONTROL) return 'control';
  if (type === DOT11_TYPE_DATA) return 'data';
  return 'extension';
}

/** Data ailesinin QoS varyantı mı — QoS Control alanının TEK koşulu. */
export function isQosDataSubtype(fc: Dot11FrameControl): boolean {
  return fc.type === DOT11_TYPE_DATA && (fc.subtype & DATA_SUBTYPE_QOS_MASK) !== 0;
}

/**
 * HT Control alanının VAR OLABİLECEĞİ çerçeveler. Dosya başındaki tuzak:
 * `+HTC` yalnız **QoS Data ve Yönetim** çerçevelerinde bu anlama gelir;
 * QoS-olmayan Data'da aynı bit "Order"dır ve alan YOKTUR.
 */
export function htControlIsMeaningful(fc: Dot11FrameControl): boolean {
  return fc.type === DOT11_TYPE_MANAGEMENT || isQosDataSubtype(fc);
}

// ── Adres rol matrisi ─────────────────────────────────────────────────────

/** Telin kendi rolü: Addr1 daima RA, Addr2 (varsa) daima TA. */
export type Dot11WireRole = 'RA' | 'TA';
/** `ToDS × FromDS` matrisinden çözülen anlam. */
export type Dot11ResolvedRole = 'DA' | 'SA' | 'BSSID';

/**
 * 🚨 802.11'in adres rol matrisi. **TEK YERDE yaşar** — 18b ve 18c bunu
 * yeniden yazmaz. Dönen dizi Addr1..Addr4 sırasındadır; `undefined` "bu
 * çerçevede o adresin bağlamsal rolü tanımlı değil" demektir (kontrol
 * çerçevelerinde Addr1/Addr2 yalnız RA/TA'dır, DA/SA/BSSID ayrımı yoktur).
 *
 * | ToDS | FromDS | Addr1 | Addr2 | Addr3 | Addr4 |
 * |---|---|---|---|---|---|
 * | 0 | 0 | DA | SA | BSSID | — |
 * | 0 | 1 | DA | BSSID | SA | — |
 * | 1 | 0 | BSSID | SA | DA | — |
 * | 1 | 1 | — | — | DA | SA |  (WDS/mesh: Addr1/Addr2 yalnız RA/TA)
 */
export function resolveAddressRoles(
  fc: Dot11FrameControl,
): readonly (Dot11ResolvedRole | undefined)[] {
  if (fc.type === DOT11_TYPE_CONTROL) {
    // Kontrol çerçevelerinde bağlamsal rol YOKTUR; PS-Poll'da Addr1 BSSID'dir
    // ve bu tek istisna standardın kendi tanımıdır (§9.3.1.5).
    if (fc.subtype === CONTROL_SUBTYPE_PS_POLL) return ['BSSID', undefined, undefined, undefined];
    return [undefined, undefined, undefined, undefined];
  }
  if (!fc.toDs && !fc.fromDs) return ['DA', 'SA', 'BSSID', undefined];
  if (!fc.toDs && fc.fromDs) return ['DA', 'BSSID', 'SA', undefined];
  if (fc.toDs && !fc.fromDs) return ['BSSID', 'SA', 'DA', undefined];
  // ToDS = FromDS = 1 (WDS / mesh): Addr1 ve Addr2 SADECE RA/TA'dır.
  return [undefined, undefined, 'DA', 'SA'];
}

export interface Dot11Address {
  /** 1..4 */
  readonly index: number;
  readonly offset: number;
  readonly bytes: Uint8Array;
  /** `00:0C:41:82:B2:55` */
  readonly text: string;
  readonly wireRole: Dot11WireRole | undefined;
  readonly resolvedRole: Dot11ResolvedRole | undefined;
  /** I/G biti — 1 ⇒ grup (çoklu yayın / yayın). */
  readonly groupAddressed: boolean;
  /** U/L biti — 1 ⇒ yerel yönetimli. */
  readonly locallyAdministered: boolean;
  readonly broadcast: boolean;
  /** IEEE OUI kaydından gelen üretici adı; bilinmiyorsa `undefined`. */
  readonly vendor: string | undefined;
  /** Ayrılmış grup adresinin anlamı (broadcast, STP …). */
  readonly groupLabel: string | undefined;
}

function readAddress(data: Uint8Array, offset: number, index: number): Dot11Address {
  const bytes = data.slice(offset, offset + DOT11_ADDRESS_LENGTH);
  const first = byteAt(data, offset);
  const key = addressKey(bytes);
  return {
    index,
    offset,
    bytes,
    text: formatMacAddress(bytes),
    wireRole: index === 1 ? 'RA' : index === 2 ? 'TA' : undefined,
    resolvedRole: undefined,
    groupAddressed: (first & ADDRESS_GROUP_BIT_MASK) !== 0,
    locallyAdministered: (first & ADDRESS_LOCAL_BIT_MASK) !== 0,
    broadcast: key === 'FFFFFFFFFFFF',
    vendor: OUI_LABELS.get(ouiKey(bytes)),
    groupLabel: GROUP_ADDRESS_LABELS.get(key),
  };
}

// ── Ofset zinciri ─────────────────────────────────────────────────────────

export interface Dot11GeometryOverrides {
  /** `undefined` ⇒ alt tipten türet (varsayılan). */
  readonly qosControlPresent?: boolean | undefined;
  /** `undefined` ⇒ `+HTC` bitinden VE tür kapısından türet (varsayılan). */
  readonly htControlPresent?: boolean | undefined;
}

export interface Dot11HeaderLayout {
  readonly durationOffset: number;
  /** Yalnız VAR OLAN adreslerin mutlak ofsetleri, Addr1'den başlayarak. */
  readonly addressOffsets: readonly number[];
  readonly sequenceControlOffset: number | undefined;
  readonly qosControlOffset: number | undefined;
  readonly htControlOffset: number | undefined;
  readonly headerLength: number;
  /**
   * Kontrol çerçevesinin alt tipi ADLANDIRILMIŞ kümede değilse `true`:
   * geometri BİLİNMİYOR, yalnız FC + Duration + Addr1 basılır ve kalanı ham
   * kalır. 0-7 aralığındaki kontrol alt tiplerinin başlıkları birbirinden
   * farklıdır; birini varsaymak Addr2'yi UYDURMAK olurdu.
   */
  readonly controlGeometryUnknown: boolean;
}

/**
 * Sınıfa ve bayraklara göre başlık düzenini kurar. **Saf.** 18b ve 18c bunu
 * doğrudan çağırabilir (`decodeDot11Header`in yan etkilerine ihtiyaç
 * duymadan).
 */
export function planDot11Header(
  fc: Dot11FrameControl,
  overrides: Dot11GeometryOverrides = {},
): Dot11HeaderLayout {
  const addressOffsets: number[] = [4];
  let cursor = DOT11_MINIMUM_HEADER_LENGTH;
  let sequenceControlOffset: number | undefined;
  let qosControlOffset: number | undefined;
  let htControlOffset: number | undefined;
  let controlGeometryUnknown = false;

  if (fc.type === DOT11_TYPE_CONTROL) {
    if (fc.subtype === CONTROL_SUBTYPE_CTS || fc.subtype === CONTROL_SUBTYPE_ACK) {
      // A2 YOK, SeqCtl YOK — 14 baytlık ACK ofset zincirinin en sert sınavı.
    } else if (CONTROL_SUBTYPE_NAMES.has(fc.subtype)) {
      addressOffsets.push(cursor);
      cursor += DOT11_ADDRESS_LENGTH;
    } else {
      controlGeometryUnknown = true;
    }
  } else {
    addressOffsets.push(cursor);
    cursor += DOT11_ADDRESS_LENGTH;
    addressOffsets.push(cursor);
    cursor += DOT11_ADDRESS_LENGTH;
    sequenceControlOffset = cursor;
    cursor += DOT11_SEQUENCE_CONTROL_LENGTH;
    if (fc.toDs && fc.fromDs) {
      addressOffsets.push(cursor);
      cursor += DOT11_ADDRESS_LENGTH;
    }
    const qos = overrides.qosControlPresent ?? isQosDataSubtype(fc);
    if (qos) {
      qosControlOffset = cursor;
      cursor += DOT11_QOS_CONTROL_LENGTH;
    }
    // 🚨 Tür kapısı ŞART (dosya başı): QoS-olmayan Data'da bit "Order"dır.
    const ht = overrides.htControlPresent ?? (fc.orderOrHtc && htControlIsMeaningful(fc));
    if (ht) {
      htControlOffset = cursor;
      cursor += DOT11_HT_CONTROL_LENGTH;
    }
  }

  return {
    durationOffset: 2,
    addressOffsets,
    sequenceControlOffset,
    qosControlOffset,
    htControlOffset,
    headerLength: cursor,
    controlGeometryUnknown,
  };
}

// ── FCS ───────────────────────────────────────────────────────────────────

export interface Dot11FcsCheck {
  readonly offset: number;
  readonly received: number;
  readonly calculated: number;
  readonly valid: boolean;
}

/**
 * Son 4 baytı FCS kabul edip CRC-32/ISO-HDLC ile doğrular. Kapsam = FCS
 * hariç TÜM çerçeve, saklama LITTLE-ENDIAN.
 *
 * `CRC32C` DEĞİL: aynı genişlik, aynı init, aynı yansıma, aynı xorout ama
 * BAŞKA polinom — hata vermeden yanlış PASS/FAIL basardı (dosya başı).
 */
export function checkDot11Fcs(data: Uint8Array): Dot11FcsCheck | undefined {
  if (data.length < DOT11_FCS_LENGTH + 1) return undefined;
  const offset = data.length - DOT11_FCS_LENGTH;
  const calculated = Number(computeNamedCrc(data.subarray(0, offset), 'CRC32'));
  const received = readUint32Le(data, offset);
  return { offset, received, calculated, valid: received === calculated };
}

// ── `canParse` imzaları ───────────────────────────────────────────────────

/**
 * Sınıf başına ASGARİ çerçeve uzunluğu (FCS DAHİL). `canParse`ın orta
 * ayağıdır ve W12'nin ölçülmüş biçimidir:
 * Mgmt/Data 28 · Ctrl ACK/CTS 14 · öteki Ctrl 20.
 */
export function minimumFrameLength(fc: Dot11FrameControl): number {
  if (fc.type === DOT11_TYPE_CONTROL) {
    return fc.subtype === CONTROL_SUBTYPE_CTS || fc.subtype === CONTROL_SUBTYPE_ACK
      ? DOT11_MINIMUM_HEADER_LENGTH + DOT11_FCS_LENGTH
      : DOT11_MINIMUM_HEADER_LENGTH + DOT11_ADDRESS_LENGTH + DOT11_FCS_LENGTH;
  }
  return DOT11_BASE_HEADER_LENGTH + DOT11_FCS_LENGTH;
}

/**
 * **İmza W12** — ana brifin ölçtüğü ve SEÇTİĞİ imza: protokol sürümü 0 +
 * sınıf-farkındalıklı asgari uzunluk + FCS CRC-32 GEÇERLİ.
 * Ölçüm: deponun 899 örneğinde **0 yanlış pozitif**, `wpa-Induction.pcap`ın
 * 1093 çerçevesinde **1080 doğru pozitif**.
 *
 * ⚠️ Dört koşulun HİÇBİRİ dejenere girdide `true` dönmez: uzunluk kapısı
 * en başta, CRC gerçekten hesaplanıyor. (`schemaParser.ts`in boş `startBytes`
 * üzerinde `[].every(...)` ile HER girdiye `true` demesi devralınan bir
 * mayındı; **2026-08-27'de kapatıldı** — aynı sınıf hata burada zaten
 * TEKRARLANMAMIŞTI.)
 */
export function hasDot11Signature(data: Uint8Array): boolean {
  if (data.length < DOT11_MINIMUM_HEADER_LENGTH + DOT11_FCS_LENGTH) return false;
  const fc = readFrameControl(data);
  if (fc.protocolVersion !== 0) return false;
  if (fc.type === DOT11_TYPE_EXTENSION) return false;
  if (data.length < minimumFrameLength(fc)) return false;
  const fcs = checkDot11Fcs(data);
  return fcs !== undefined && fcs.valid;
}

/**
 * **İmza W13** — FCS'SİZ karşı-olgusal imza. **MOTORDA KULLANILMAZ**; yalnız
 * bekçi testinin *"yazılsaydı kaç çerçeve çalardı"* ölçümünü kodda
 * tekrarlayabilmesi için dışa verilir.
 *
 * Ana brif ölçümü **216 / 899 (%24)** ve bu tur onu BİREBİR yeniden üretti —
 * ama brifin tablo etiketi (*"sınıf-farkındalıklı, FCS'siz"*) İMZAYI YANLIŞ
 * TARİF EDİYOR: 216, sınıf başına asgari uzunluk kapısı OLMADAN (yalnız
 * mutlak 10 bayt) çıkıyor. Sınıf kapısı da eklenirse sayı **110**'a düşer
 * (`hasStrictFcslessDot11Signature`). **Karar iki sayıda da AYNI:** 0'a karşı
 * 110 da 216 da kabul edilemez. Bekçi ikisini de ölçer, böylece brifin
 * etiketinden değil ÖLÇÜMDEN beslenir.
 */
export function hasFcslessDot11Signature(data: Uint8Array): boolean {
  if (data.length < DOT11_MINIMUM_HEADER_LENGTH) return false;
  const fc = readFrameControl(data);
  if (fc.protocolVersion !== 0) return false;
  return fc.type !== DOT11_TYPE_EXTENSION;
}

/**
 * W13'ün EN DAR biçimi: sınıf başına asgari uzunluk kapısı VAR, FCS yok.
 * "FCS'siz yazılabilecek en iyi imza" budur ve yine **110 / 899** çakışıyor.
 * Yalnız bekçi ölçümü için; motorda KULLANILMAZ.
 */
export function hasStrictFcslessDot11Signature(data: Uint8Array): boolean {
  if (!hasFcslessDot11Signature(data)) return false;
  const fc = readFrameControl(data);
  return data.length >= minimumFrameLength(fc) - DOT11_FCS_LENGTH;
}

// ── Gösterim kanalları ────────────────────────────────────────────────────

export const FCS_PRESENT_AUTO = 'auto';
export const FCS_PRESENT_YES = 'yes';
export const FCS_PRESENT_NO = 'no';

export const ADDRESS_ROLE_RESOLVED = 'resolved';
export const ADDRESS_ROLE_RAW = 'raw';
export const ADDRESS_ROLE_BOTH = 'both';

export const PRESENCE_AUTO = 'auto';
export const PRESENCE_YES = 'yes';
export const PRESENCE_NO = 'no';

export const VENDOR_LABELS_SHOW = 'show';
export const VENDOR_LABELS_HIDE = 'hide';

export interface Dot11DecodeOptions {
  readonly fcsPresent: string;
  readonly addressRoleDisplay: string;
  readonly qosControlPresent: string;
  readonly htControlPresent: string;
  readonly vendorAddressLabels: string;
}

export const DOT11_DEFAULT_OPTIONS: Dot11DecodeOptions = {
  fcsPresent: FCS_PRESENT_AUTO,
  addressRoleDisplay: ADDRESS_ROLE_RESOLVED,
  qosControlPresent: PRESENCE_AUTO,
  htControlPresent: PRESENCE_AUTO,
  vendorAddressLabels: VENDOR_LABELS_SHOW,
};

function presenceOverride(value: string): boolean | undefined {
  if (value === PRESENCE_YES) return true;
  if (value === PRESENCE_NO) return false;
  return undefined;
}

// ── Özet — 18b ve 18c'nin TÜKETTİĞİ yüzey ────────────────────────────────

export interface Dot11HeaderSummary {
  /** `false` ise başlık okunamadı; tüketici gövdeye GİRMEZ. */
  readonly readable: boolean;
  readonly frameControl: Dot11FrameControl;
  readonly frameClass: Dot11FrameClass;
  readonly subtypeName: string | undefined;
  readonly layout: Dot11HeaderLayout;
  readonly headerLength: number;
  readonly addresses: readonly Dot11Address[];
  readonly durationId: number;
  readonly sequenceNumber: number | undefined;
  readonly fragmentNumber: number | undefined;
  readonly qosControl: number | undefined;
  readonly htControl: number | undefined;
  readonly fcs: Dot11FcsCheck | undefined;
  /** FCS gerçekten çerçevenin parçası sayıldı mı (kanal + uzunluk kararı). */
  readonly fcsPresent: boolean;
  /** Gövdenin MUTLAK başlangıcı (= `headerLength`). */
  readonly bodyOffset: number;
  /** `n - headerLength - (fcsPresent ? 4 : 0)`; negatifse 0. */
  readonly bodyLength: number;
  /** Kısayol: `frameControl.protectedFrame`. Gövde ŞİFRELİ, öteye İNİLMEZ. */
  readonly protectedFrame: boolean;
}

function unreadableSummary(data: Uint8Array, fc: Dot11FrameControl): Dot11HeaderSummary {
  return {
    readable: false,
    frameControl: fc,
    frameClass: classifyFrame(fc.type),
    subtypeName: undefined,
    layout: {
      durationOffset: 2,
      addressOffsets: [],
      sequenceControlOffset: undefined,
      qosControlOffset: undefined,
      htControlOffset: undefined,
      headerLength: data.length,
      controlGeometryUnknown: false,
    },
    headerLength: data.length,
    addresses: [],
    durationId: 0,
    sequenceNumber: undefined,
    fragmentNumber: undefined,
    qosControl: undefined,
    htControl: undefined,
    fcs: undefined,
    fcsPresent: false,
    bodyOffset: data.length,
    bodyLength: 0,
    protectedFrame: fc.protectedFrame,
  };
}

function describeAddress(address: Dot11Address, showVendor: boolean): string {
  const notes: string[] = [];
  if (address.groupLabel !== undefined) notes.push(address.groupLabel);
  else notes.push(address.groupAddressed ? 'group' : 'individual');
  if (address.locallyAdministered) notes.push('locally administered');
  if (showVendor && address.vendor !== undefined) notes.push(address.vendor);
  return `${address.text} (${notes.join(', ')})`;
}

function addressFieldName(address: Dot11Address, display: string): string {
  const base = `802.11 · Address ${String(address.index)}`;
  const wire = address.wireRole;
  const resolved = address.resolvedRole;
  if (display === ADDRESS_ROLE_RAW) return base;
  if (display === ADDRESS_ROLE_BOTH) {
    const parts = [wire, resolved].filter(
      (part): part is Dot11WireRole | Dot11ResolvedRole => part !== undefined,
    );
    return parts.length === 0 ? base : `${base} · ${parts.join(' / ')}`;
  }
  // `resolved`: bağlamsal rol varsa O basılır, yoksa telin rolüne düşülür.
  const role = resolved ?? wire;
  return role === undefined ? base : `${base} · ${role}`;
}

/**
 * 802.11 MAC başlığını çözer.
 *
 * Hiçbir bayt TÜKETMEZ ve `sink`/`warnings`/`errors` dışında yan etkisi
 * yoktur; dönen `Dot11HeaderSummary` gövdenin NEREDE başladığını söyler.
 * 18b gövdeyi oradan açar, 18c Action gövdesini oradan okur.
 *
 * `baseOffset` YOKTUR ve bilerek yoktur: 802.11 çerçevesi her zaman
 * girdinin BAŞINDADIR (girdi sözleşmesi, `[KARAR 18-2]`). Bir gün
 * kapsülleyen bir taşıyıcı gelirse çağıran `subarray` verir; ofsetleri
 * kaydırmak için ayrı bir parametre taşımak bugünden olmayan bir esneklik
 * uydurmak olurdu.
 */
export function decodeDot11Header(
  data: Uint8Array,
  sink: FieldSink,
  warnings: ProtocolWarning[],
  errors: ProtocolError[],
  options: Dot11DecodeOptions = DOT11_DEFAULT_OPTIONS,
): Dot11HeaderSummary {
  const fc = readFrameControl(data);

  // İki bayttan kısa girdide Frame Control bile UYDURULUR (`byteAt` eksik
  // baytı 0 okur) — o yüzden burada durulur, alan BASILMAZ.
  if (data.length < FRAME_CONTROL_LENGTH) {
    errors.push({
      code: 'truncated-frame',
      message: ERROR_TOO_SHORT_FOR_HEADER,
      offset: 0,
      length: data.length,
    });
    return unreadableSummary(data, fc);
  }

  const frameClass = classifyFrame(fc.type);
  const byte0 = data.slice(0, 1);
  const byte1 = data.slice(1, 2);

  // ── Frame Control: 11 alt alan ────────────────────────────────────────
  const versionValid = fc.protocolVersion === 0;
  pushField(sink, {
    id: 'fc-protocol-version',
    name: '802.11 · FC · Protocol Version',
    offset: 0,
    length: 1,
    rawBytes: byte0,
    rawValue: fc.protocolVersion,
    physicalValue: versionValid ? '0 (IEEE 802.11)' : `${String(fc.protocolVersion)} (invalid)`,
    valid: versionValid,
    warnings: versionValid ? [] : [FIELD_WARN_PROTOCOL_VERSION_NOT_ZERO],
  });
  if (!versionValid) {
    warnings.push(toProtocolWarning('protocolVersionNotZero', WARN_PROTOCOL_VERSION_NOT_ZERO, 0, 1));
  }

  pushField(sink, {
    id: 'fc-type',
    name: '802.11 · FC · Type',
    offset: 0,
    length: 1,
    rawBytes: byte0,
    rawValue: fc.type,
    physicalValue: frameClass,
    valid: fc.type !== DOT11_TYPE_EXTENSION,
    warnings: [],
  });

  const subtypeName = dot11SubtypeName(fc.type, fc.subtype);
  const subtypeField: ParsedField = {
    id: 'fc-subtype',
    name: '802.11 · FC · Subtype',
    offset: 0,
    length: 1,
    rawBytes: byte0,
    rawValue: fc.subtype,
    // Bilinmeyen alt tip HATA DEĞİLDİR: alt tip uzayı 802.11 revizyonlarıyla
    // büyüyor (`bleAdvertisement.ts`in bilinmeyen Company ID emsali).
    valid: true,
    warnings: subtypeName === undefined ? [FIELD_WARN_UNKNOWN_SUBTYPE] : [],
  };
  if (subtypeName !== undefined) subtypeField.physicalValue = subtypeName;
  pushField(sink, subtypeField);
  if (subtypeName === undefined && fc.type !== DOT11_TYPE_EXTENSION) {
    warnings.push(toProtocolWarning('unknownSubtype', WARN_UNKNOWN_SUBTYPE, 0, 1));
  }

  const flagFields: readonly (readonly [string, string, boolean, string, string])[] = [
    ['fc-to-ds', 'To DS', fc.toDs, 'to DS', 'not to DS'],
    ['fc-from-ds', 'From DS', fc.fromDs, 'from DS', 'not from DS'],
    ['fc-more-fragments', 'More Fragments', fc.moreFragments, 'more fragments follow', 'last fragment'],
    ['fc-retry', 'Retry', fc.retry, 'retransmission', 'first transmission'],
    ['fc-power-management', 'Power Management', fc.powerManagement, 'power save', 'active'],
    ['fc-more-data', 'More Data', fc.moreData, 'more data buffered', 'no buffered data'],
  ];
  for (const [id, label, value, onText, offText] of flagFields) {
    pushField(sink, {
      id,
      name: `802.11 · FC · ${label}`,
      offset: 1,
      length: 1,
      rawBytes: byte1,
      rawValue: value ? 1 : 0,
      physicalValue: value ? onText : offText,
      valid: true,
      warnings: [],
    });
  }

  pushField(sink, {
    id: 'fc-protected',
    name: '802.11 · FC · Protected Frame',
    offset: 1,
    length: 1,
    rawBytes: byte1,
    rawValue: fc.protectedFrame ? 1 : 0,
    physicalValue: fc.protectedFrame ? 'encrypted body' : 'plaintext body',
    valid: true,
    warnings: [],
  });

  // Bit 15'in ADI türe bağlıdır — alan adı bu ayrımı EKRANDA taşır.
  const htMeaningful = htControlIsMeaningful(fc);
  pushField(sink, {
    id: 'fc-order-htc',
    name: `802.11 · FC · ${htMeaningful ? '+HTC' : 'Order'}`,
    offset: 1,
    length: 1,
    rawBytes: byte1,
    rawValue: fc.orderOrHtc ? 1 : 0,
    physicalValue: fc.orderOrHtc
      ? htMeaningful
        ? 'HT Control present'
        : 'strictly ordered (no HT Control in this frame class)'
      : htMeaningful
        ? 'no HT Control'
        : 'not strictly ordered',
    valid: true,
    warnings: [],
  });
  if (fc.orderOrHtc && !htMeaningful && fc.type !== DOT11_TYPE_EXTENSION) {
    // Sessiz 4 baytlık kaymanın tam olarak ÖNLENDİĞİ yer.
    warnings.push(
      toProtocolWarning('orderBitWithoutHtControl', WARN_ORDER_BIT_WITHOUT_HT_CONTROL, 1, 1),
    );
  }

  // Asgari başlık kapısı Frame Control BASILDIKTAN SONRA: kesik bir çerçevede
  // bile okunabilen alanlar gösterilir (deponun "boş kart basmak yasak"
  // kuralı; `lonworks`ın kesik broadcast örneğiyle aynı davranış).
  if (data.length < DOT11_MINIMUM_HEADER_LENGTH) {
    errors.push({
      code: 'truncated-frame',
      message: ERROR_TOO_SHORT_FOR_HEADER,
      offset: 0,
      length: data.length,
    });
    return { ...unreadableSummary(data, fc), frameControl: fc, frameClass };
  }

  if (fc.type === DOT11_TYPE_EXTENSION) {
    errors.push({
      code: 'unsupported-encoding',
      message: ERROR_EXTENSION_TYPE_OUT_OF_SCOPE,
      offset: 0,
      length: 2,
      details: { type: fc.type, subtype: fc.subtype },
    });
    return {
      ...unreadableSummary(data, fc),
      frameControl: fc,
      frameClass,
    };
  }

  // Yönetim çerçevelerinde ToDS = FromDS = 0 ZORUNLUDUR.
  if (fc.type === DOT11_TYPE_MANAGEMENT && (fc.toDs || fc.fromDs)) {
    warnings.push(
      toProtocolWarning('managementDsBitsSet', WARN_MANAGEMENT_DS_BITS_SET, 1, 1),
    );
    const dsField = sink.fields.find((field) => field.id === 'fc-to-ds');
    if (dsField !== undefined) dsField.warnings.push(FIELD_WARN_DS_BITS_UNEXPECTED);
  }

  // ── Geometri ──────────────────────────────────────────────────────────
  const qosOverride = presenceOverride(options.qosControlPresent);
  const htOverride = presenceOverride(options.htControlPresent);
  const layout = planDot11Header(fc, {
    qosControlPresent: qosOverride,
    htControlPresent: htOverride,
  });
  if (qosOverride !== undefined && qosOverride !== isQosDataSubtype(fc)) {
    warnings.push(toProtocolWarning('qosControlForced', WARN_QOS_CONTROL_FORCED));
  }
  if (htOverride !== undefined && htOverride !== (fc.orderOrHtc && htMeaningful)) {
    warnings.push(toProtocolWarning('htControlForced', WARN_HT_CONTROL_FORCED));
  }
  if (layout.controlGeometryUnknown) {
    warnings.push(
      toProtocolWarning('controlGeometryUnknown', WARN_CONTROL_GEOMETRY_UNKNOWN, 0, 1),
    );
  }

  if (data.length < layout.headerLength) {
    errors.push({
      code: 'truncated-frame',
      message: ERROR_TOO_SHORT_FOR_HEADER,
      offset: data.length,
      length: layout.headerLength - data.length,
      details: { expectedHeaderLength: layout.headerLength, frameLength: data.length },
    });
    return { ...unreadableSummary(data, fc), frameControl: fc, frameClass, layout };
  }

  // ── Duration / ID ─────────────────────────────────────────────────────
  const durationId = readUint16Le(data, layout.durationOffset);
  const durationBytes = data.slice(layout.durationOffset, layout.durationOffset + 2);
  const durationField: ParsedField = {
    id: 'duration-id',
    name: '802.11 · Duration / ID',
    offset: layout.durationOffset,
    length: 2,
    rawBytes: durationBytes,
    rawValue: durationId,
    valid: true,
    warnings: [],
  };
  if (fc.type === DOT11_TYPE_CONTROL && fc.subtype === CONTROL_SUBTYPE_PS_POLL) {
    // PS-Poll'da alan bir SÜRE DEĞİL, Association ID'dir → `unit` YOK.
    durationField.physicalValue = `AID ${String(durationId & DURATION_AID_MASK)}`;
  } else if ((durationId & DURATION_IS_NOT_DURATION_MASK) === 0) {
    // Yalnız BURADA gerçek bir fiziksel değer var: mikrosaniye.
    durationField.physicalValue = String(durationId);
    durationField.unit = 'µs';
  } else {
    durationField.physicalValue = `${hex(durationId, 4)} (not a duration)`;
  }
  pushField(sink, durationField);

  // ── Adresler ──────────────────────────────────────────────────────────
  // Alanlar TEL SIRASINDA basılır: Address 4 ofset olarak Sequence
  // Control'den SONRA gelir, o yüzden döngü üçte durur ve dördüncü adres
  // Sequence Control'ün ardından basılır.
  const roles = resolveAddressRoles(fc);
  const showVendor = options.vendorAddressLabels !== VENDOR_LABELS_HIDE;
  const addresses: Dot11Address[] = [];
  const emitAddress = (index: number): void => {
    const offset = layout.addressOffsets[index];
    if (offset === undefined) return;
    const base = readAddress(data, offset, index + 1);
    const address: Dot11Address = { ...base, resolvedRole: roles[index] };
    addresses.push(address);
    pushField(sink, {
      id: `address-${String(address.index)}`,
      name: addressFieldName(address, options.addressRoleDisplay),
      offset,
      length: DOT11_ADDRESS_LENGTH,
      rawBytes: address.bytes,
      rawValue: address.text,
      physicalValue: describeAddress(address, showVendor),
      valid: true,
      warnings: [],
    });
  };
  for (let index = 0; index < Math.min(3, layout.addressOffsets.length); index += 1) {
    emitAddress(index);
  }

  // ── Sequence Control ──────────────────────────────────────────────────
  let sequenceNumber: number | undefined;
  let fragmentNumber: number | undefined;
  if (layout.sequenceControlOffset !== undefined) {
    const raw = readUint16Le(data, layout.sequenceControlOffset);
    const bytes = data.slice(layout.sequenceControlOffset, layout.sequenceControlOffset + 2);
    fragmentNumber = raw & SEQUENCE_FRAGMENT_MASK;
    sequenceNumber = raw >> SEQUENCE_NUMBER_SHIFT;
    pushField(sink, {
      id: 'sequence-number',
      name: '802.11 · Sequence Control · Sequence Number',
      offset: layout.sequenceControlOffset,
      length: DOT11_SEQUENCE_CONTROL_LENGTH,
      rawBytes: bytes,
      rawValue: sequenceNumber,
      physicalValue: String(sequenceNumber),
      valid: true,
      warnings: [],
    });
    pushField(sink, {
      id: 'fragment-number',
      name: '802.11 · Sequence Control · Fragment Number',
      offset: layout.sequenceControlOffset,
      length: DOT11_SEQUENCE_CONTROL_LENGTH,
      rawBytes: bytes,
      rawValue: fragmentNumber,
      physicalValue: String(fragmentNumber),
      valid: true,
      warnings: [],
    });
  }

  // Address 4 (yalnız ToDS = FromDS = 1): telde Sequence Control'ün ardından.
  emitAddress(3);

  // ── QoS Control ───────────────────────────────────────────────────────
  let qosControl: number | undefined;
  if (layout.qosControlOffset !== undefined) {
    qosControl = readUint16Le(data, layout.qosControlOffset);
    const bytes = data.slice(layout.qosControlOffset, layout.qosControlOffset + 2);
    pushField(sink, {
      id: 'qos-control',
      name: '802.11 · QoS Control',
      offset: layout.qosControlOffset,
      length: DOT11_QOS_CONTROL_LENGTH,
      rawBytes: bytes,
      rawValue: qosControl,
      physicalValue: hex(qosControl, 4),
      valid: true,
      warnings: [],
    });
    // TID alt alanı QoS Control'ün bit 0-3'üdür; ÜST alanların anlamı
    // yön/tür bağımlıdır (18b/18c kapsamı değil, `tools` listesinin işi).
    pushField(sink, {
      id: 'qos-tid',
      name: '802.11 · QoS Control · TID',
      offset: layout.qosControlOffset,
      length: DOT11_QOS_CONTROL_LENGTH,
      rawBytes: bytes,
      rawValue: qosControl & 0x0f,
      physicalValue: String(qosControl & 0x0f),
      valid: true,
      warnings: [],
    });
  }

  // ── HT Control ────────────────────────────────────────────────────────
  let htControl: number | undefined;
  if (layout.htControlOffset !== undefined) {
    htControl = readUint32Le(data, layout.htControlOffset);
    pushField(sink, {
      id: 'ht-control',
      name: '802.11 · HT Control',
      offset: layout.htControlOffset,
      length: DOT11_HT_CONTROL_LENGTH,
      rawBytes: data.slice(layout.htControlOffset, layout.htControlOffset + DOT11_HT_CONTROL_LENGTH),
      rawValue: htControl,
      // İç bölünmesi HT/VHT/HE varyantına göre değişir; PHY parametreleri
      // KAPSAM DIŞI olduğu için alan HAM basılır, yorumlanmaz.
      physicalValue: hex(htControl, 8),
      valid: true,
      warnings: [],
    });
  }

  // ── FCS varlığı kararı ────────────────────────────────────────────────
  // `auto` = VAR SAY. Girdi sözleşmesi (`[KARAR 18-2]`) FCS'i çerçevenin
  // parçası ilan ediyor; "CRC tutmuyorsa yok say" deseydik BOZUK bir
  // çerçeve sessizce "FCS'siz" sayılır ve **FAIL hiç basılmazdı**. Belirsizlik
  // tutmayan CRC'de sözleşme lehine çözülür, kullanıcıya `fcsPresent = no`
  // alternatifi bir UYARIYLA söylenir.
  //
  // > Ana brif `auto`yu *"son 4 bayt CRC-32 tutuyorsa var say"* diye yazıyor
  // > ama AYNI brifin tamamlanma ölçütü *"bozuk-FCS örneği FAIL basıyor"*
  // > diyor; ikisi aynı anda doğru olamaz. Kararı ölçüt kazandı — bir FAIL'i
  // > gizlemek, bir belirsizliği yanlış tarafa çözmekten daha ağır bir hata.
  //
  // ⚠️ FCS **ALANI BURADA BASILMAZ**: telde bir KUYRUKTUR ve gövdeden sonra
  // gelir. Çağıran gövdeyi bastıktan SONRA `pushDot11Fcs`u çağırır — 18b ve
  // 18c için de sıra budur.
  const roomForFcs = data.length >= layout.headerLength + DOT11_FCS_LENGTH;
  let fcsPresent: boolean;
  if (options.fcsPresent === FCS_PRESENT_NO) {
    fcsPresent = false;
  } else if (options.fcsPresent === FCS_PRESENT_YES) {
    fcsPresent = true;
    if (!roomForFcs) {
      errors.push({
        code: 'truncated-frame',
        message: ERROR_TOO_SHORT_FOR_FCS,
        offset: layout.headerLength,
        length: Math.max(0, data.length - layout.headerLength),
      });
    }
  } else {
    fcsPresent = roomForFcs;
    if (!roomForFcs) warnings.push(toProtocolWarning('fcsAbsent', WARN_FCS_ABSENT));
  }

  const fcs = fcsPresent && roomForFcs ? checkDot11Fcs(data) : undefined;
  const trailerLength = fcsPresent && roomForFcs ? DOT11_FCS_LENGTH : 0;
  const bodyLength = Math.max(0, data.length - layout.headerLength - trailerLength);

  return {
    readable: true,
    frameControl: fc,
    frameClass,
    subtypeName,
    layout,
    headerLength: layout.headerLength,
    addresses,
    durationId,
    sequenceNumber,
    fragmentNumber,
    qosControl,
    htControl,
    fcs,
    fcsPresent: fcsPresent && roomForFcs,
    bodyOffset: layout.headerLength,
    bodyLength,
    protectedFrame: fc.protectedFrame,
  };
}

/**
 * FCS alanını basar ve tutmuyorsa `crc-mismatch` hatasını düşürür.
 *
 * **`decodeDot11Header`den AYRI olmasının sebebi tel sırasıdır**: FCS bir
 * KUYRUKTUR, gövdeden sonra gelir. Çağıran önce başlığı çözer, sonra gövdeyi
 * basar, EN SON bunu çağırır — böylece alan listesi ofset sırasını korur.
 * 18b (yönetim gövdesi) ve 18c (`esp-now` action gövdesi) için de sıra budur.
 *
 * `summary.fcs` `undefined` ise (FCS yok sayıldı) HİÇBİR ŞEY yapmaz: olmayan
 * bir doğrulamayı varmış gibi göstermek dalga 13 dersi 3'ün ihlali olurdu.
 */
export function pushDot11Fcs(
  data: Uint8Array,
  sink: FieldSink,
  warnings: ProtocolWarning[],
  errors: ProtocolError[],
  summary: Dot11HeaderSummary,
  options: Dot11DecodeOptions = DOT11_DEFAULT_OPTIONS,
): void {
  const fcs = summary.fcs;
  if (fcs === undefined) return;

  pushField(sink, {
    id: 'fcs',
    name: '802.11 · FCS (CRC-32/ISO-HDLC, little-endian)',
    offset: fcs.offset,
    length: DOT11_FCS_LENGTH,
    rawBytes: data.slice(fcs.offset, fcs.offset + DOT11_FCS_LENGTH),
    rawValue: hex(fcs.received, 8),
    physicalValue: fcs.valid
      ? `PASS (covers ${String(fcs.offset)} B)`
      : `FAIL (calculated ${hex(fcs.calculated, 8)} over ${String(fcs.offset)} B)`,
    valid: fcs.valid,
    warnings: fcs.valid ? [] : [FIELD_WARN_FCS_MISMATCH],
  });

  if (fcs.valid) return;
  errors.push({
    code: 'crc-mismatch',
    message: ERROR_FCS_MISMATCH,
    offset: fcs.offset,
    length: DOT11_FCS_LENGTH,
    details: { received: fcs.received, calculated: fcs.calculated },
  });
  if (options.fcsPresent === FCS_PRESENT_AUTO) {
    warnings.push(toProtocolWarning('fcsMismatch', WARN_FCS_MISMATCH, fcs.offset, DOT11_FCS_LENGTH));
  }
}
