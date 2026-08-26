/**
 * IEEE 802.11 Information Element (TLV) yürüyücüsü — **PAYLAŞILAN ÇEKİRDEK**
 * (Faz 10, dalga 18b).
 *
 * `dot11Frame.ts` (18a) MAC başlığını çözer ve gövdenin NEREDE başladığını
 * söyler; bu modül o gövdenin **element zincirini** okur. `dot11Frame.ts` gibi
 * `wifi` kaydının içinde yaşar ama ONA AİT DEĞİLDİR:
 *   · **18b** — `dot11Management.ts` sabit alanlardan sonra bunu çağırır;
 *   · **18c** — `esp-now` AYNI TLV biçimini kullanır (vendor-specific element:
 *     ID 221 · Length · OUI · type · …), bu yüzden yürüyücü ESP-NOW'a özel
 *     HİÇBİR ŞEY bilmez ve bilmemelidir.
 *
 * ── BİÇİM ─────────────────────────────────────────────────────────────────
 * `Element ID (1) · Length (1) · Data (Length)`, ardışık. Çok baytlı sayısal
 * alanlar **little-endian**.
 *
 * **Bilinmeyen ID HATA DEĞİLDİR.** Element ID uzayı her 802.11 revizyonuyla
 * büyüyor (255 = Element ID Extension'ın var olma sebebi tam da bu); bilinmeyen
 * element ham hex olarak basılır ve **ad UYDURULMAZ** (`zigbee.ts:52-58`
 * emsali, `seatalk`in tek-kaynak kuralının ikizi).
 *
 * ── 🚨 RSN IE (48) — İÇ İÇE SAYAÇ ZİNCİRİ, BU DALGANIN TEK İNCELİKLİ YERİ ──
 * ```
 * Version                (2, LE)
 * Group Data Cipher Suite(4)      OUI(3) + Suite Type(1)
 * Pairwise Cipher Count  (2, LE)  → N
 * Pairwise Cipher Suites (4×N)
 * AKM Suite Count        (2, LE)  → M
 * AKM Suites             (4×M)
 * RSN Capabilities       (2, LE)                        — opsiyonel
 * PMKID Count(2) + PMKID(16×K) + Group Management(4)    — opsiyonel
 * ```
 * **Her sayaç bir sonraki bloğun uzunluğunu belirler ve biri yanlış okunursa
 * geri kalan HER ŞEY SESSİZCE KAYAR.** Bu yüzden burada tek bir kural var:
 * her sayaçtan sonra `count × birim ≤ kalan bayt` KONTROL EDİLİR; tutmuyorsa
 * **UYDURULMAZ** — `length-mismatch` hatası + uyarı basılır, kalan ham
 * bırakılır ve zincir DURDURULUR. Sonda tüketilen bayt `IE.Length` ile
 * karşılaştırılır; sapma varsa ayrı bir uyarı çıkar.
 *
 * ── 🚨 SÜİT SEÇİCİLERİ: AYNI NUMARA, FARKLI OUI, FARKLI TABLO ─────────────
 * RSN (48) `00-0F-AC`, vendor WPA IE (221 · `00-50-F2` · type 1) `00-50-F2`
 * kullanır. Numaralar KISMEN çakışır (2 = TKIP, 4 = CCMP/AES-CCM ikisinde de)
 * ama tablolar AYNI DEĞİLDİR ve WPA tablosu 7'de biter. Tek bir "süit adı"
 * tablosu yazıp OUI'yi yok saymak HATA VERMEDEN yanlış ad basardı — dalga
 * 16a'nın "aynı polinom aynı algoritma değildir" dersinin OUI düzeyindeki eşi.
 *
 * `[KANIT]` Wireshark'ın kendisi de İKİ AYRI tablo taşıyor:
 * `ieee80211_rsn_cipher_vals` / `ieee80211_rsn_keymgmt_vals` (`00-0F-AC`)
 * ↔ `ieee80211_wfa_ie_wpa_cipher_vals` / `ieee80211_wfa_ie_wpa_keymgmt_vals`
 * (`00-50-F2`), `epan/dissectors/packet-ieee80211.c:19487` ve `:19722`.
 * **Farklı OUI ⇒ tescilli süit**: ham OUI + tip basılır, ad UYDURULMAZ.
 *
 * ── ELEMENT ID 47 — brifin `[BEKLENTİ]`si DOĞRULANDI ─────────────────────
 * `[KANIT]` `packet-ieee80211.h:408` → `#define TAG_ERP_INFO_OLD 47
 * /* IEEE Std 802.11g/D4.0 *​/` ve `packet-ieee80211.c:63843` bu ID'yi
 * **42 ile AYNI** `ieee80211_tag_erp_info` çözücüsüne bağlıyor. Yani 47
 * "Reserved" değil, 802.11g taslağından kalma ERP Information'dır ve gerçek
 * Beacon'daki `2f 01 02` 42'nin taşıdığı değerin AYNISINI taşıyor. Bilinmeyen
 * ID dalına DÜŞMEZ.
 */

import type { ProtocolError, ProtocolWarning } from '@/protocol-core/types';

import { pushField, toProtocolWarning } from './dot11Frame';
import type { FieldSink } from './dot11Frame';

// ── Çeviri anahtarları ────────────────────────────────────────────────────
// 18a'nın gerekçesi burada da geçerli: çekirdek paylaşılıyor diye üçüncü bir
// ön ek uydurmak sözlüğü ikizlerdi. Element adları, süit adları ve OUI
// etiketleri VERİDİR — çeviriye GİRMEZ.

const TRANSLATION_KEY_PREFIX = 'protocol.wifi';

export const WARN_ELEMENT_CHAIN_TRUNCATED = `${TRANSLATION_KEY_PREFIX}.warning.elementChainTruncated`;
export const WARN_UNKNOWN_ELEMENT = `${TRANSLATION_KEY_PREFIX}.warning.unknownElement`;
export const WARN_ELEMENT_LENGTH_UNEXPECTED = `${TRANSLATION_KEY_PREFIX}.warning.elementLengthUnexpected`;
export const WARN_HIDDEN_ELEMENTS = `${TRANSLATION_KEY_PREFIX}.warning.hiddenElements`;
export const WARN_RSN_VERSION_UNSUPPORTED = `${TRANSLATION_KEY_PREFIX}.warning.rsnVersionUnsupported`;
export const WARN_RSN_COUNTER_OVERRUN = `${TRANSLATION_KEY_PREFIX}.warning.rsnCounterOverrun`;
export const WARN_RSN_TRAILING_BYTES = `${TRANSLATION_KEY_PREFIX}.warning.rsnTrailingBytes`;
export const WARN_RSN_TRUNCATED = `${TRANSLATION_KEY_PREFIX}.warning.rsnTruncated`;
export const WARN_VENDOR_ELEMENT_RAW = `${TRANSLATION_KEY_PREFIX}.warning.vendorElementRaw`;

export const ERROR_RSN_COUNTER_OVERRUN = `${TRANSLATION_KEY_PREFIX}.error.rsnCounterOverrun`;

const FIELD_WARN_UNKNOWN_ELEMENT = `${TRANSLATION_KEY_PREFIX}.field.unknownElement`;
const FIELD_WARN_ELEMENT_LENGTH_UNEXPECTED = `${TRANSLATION_KEY_PREFIX}.field.elementLengthUnexpected`;
const FIELD_WARN_NOT_DECODED = `${TRANSLATION_KEY_PREFIX}.field.elementNotDecoded`;
const FIELD_WARN_RSN_COUNTER_OVERRUN = `${TRANSLATION_KEY_PREFIX}.field.rsnCounterOverrun`;
const FIELD_WARN_HIDDEN_SSID = `${TRANSLATION_KEY_PREFIX}.field.hiddenSsid`;

// ── `decodeOptions` değerleri ─────────────────────────────────────────────

export const IE_NAME_SET_NAMED = 'named';
export const IE_NAME_SET_NONE = 'none';

export const VENDOR_IE_DECODE = 'decode';
export const VENDOR_IE_LABEL_ONLY = 'label-only';
export const VENDOR_IE_RAW = 'raw';

export const RSN_SUITE_LABELS_SHOW = 'show';
export const RSN_SUITE_LABELS_HIDE = 'hide';

export const UNKNOWN_IE_HEX = 'hex';
export const UNKNOWN_IE_HIDDEN = 'hidden';

export interface Dot11ElementOptions {
  readonly ieNameSet: string;
  readonly vendorIeProfile: string;
  readonly rsnSuiteLabels: string;
  readonly unknownIeDisplay: string;
}

export const DOT11_ELEMENT_DEFAULT_OPTIONS: Dot11ElementOptions = {
  ieNameSet: IE_NAME_SET_NAMED,
  vendorIeProfile: VENDOR_IE_DECODE,
  rsnSuiteLabels: RSN_SUITE_LABELS_SHOW,
  unknownIeDisplay: UNKNOWN_IE_HEX,
};

// ── Element kimlikleri ────────────────────────────────────────────────────

export const ELEMENT_SSID = 0;
export const ELEMENT_SUPPORTED_RATES = 1;
export const ELEMENT_DS_PARAMETER_SET = 3;
export const ELEMENT_TIM = 5;
export const ELEMENT_COUNTRY = 7;
export const ELEMENT_POWER_CONSTRAINT = 32;
export const ELEMENT_ERP_INFORMATION = 42;
export const ELEMENT_HT_CAPABILITIES = 45;
export const ELEMENT_ERP_INFORMATION_OLD = 47;
export const ELEMENT_RSN = 48;
export const ELEMENT_EXTENDED_SUPPORTED_RATES = 50;
export const ELEMENT_HT_OPERATION = 61;
export const ELEMENT_EXTENDED_CAPABILITIES = 127;
export const ELEMENT_VHT_CAPABILITIES = 191;
export const ELEMENT_VHT_OPERATION = 192;
export const ELEMENT_VENDOR_SPECIFIC = 221;
export const ELEMENT_ID_EXTENSION = 255;

/**
 * DAR küme — bilerek dar. `[KANIT]` adlar `packet-ieee80211.h`in `TAG_*`
 * sabitlerinden birebir alındı; 47'nin `TAG_ERP_INFO_OLD` olduğu ve 42 ile
 * aynı çözücüye bağlandığı orada yazıyor.
 */
export const ELEMENT_NAMES: ReadonlyMap<number, string> = new Map([
  [ELEMENT_SSID, 'SSID'],
  [ELEMENT_SUPPORTED_RATES, 'Supported Rates'],
  [ELEMENT_DS_PARAMETER_SET, 'DS Parameter Set'],
  [ELEMENT_TIM, 'TIM'],
  [ELEMENT_COUNTRY, 'Country'],
  [ELEMENT_POWER_CONSTRAINT, 'Power Constraint'],
  [ELEMENT_ERP_INFORMATION, 'ERP Information'],
  [ELEMENT_HT_CAPABILITIES, 'HT Capabilities'],
  [ELEMENT_ERP_INFORMATION_OLD, 'ERP Information (802.11g/D4.0)'],
  [ELEMENT_RSN, 'RSN'],
  [ELEMENT_EXTENDED_SUPPORTED_RATES, 'Extended Supported Rates'],
  [ELEMENT_HT_OPERATION, 'HT Operation'],
  [ELEMENT_EXTENDED_CAPABILITIES, 'Extended Capabilities'],
  [ELEMENT_VHT_CAPABILITIES, 'VHT Capabilities'],
  [ELEMENT_VHT_OPERATION, 'VHT Operation'],
  [ELEMENT_VENDOR_SPECIFIC, 'Vendor Specific'],
  [ELEMENT_ID_EXTENSION, 'Element ID Extension'],
]);

/**
 * 255'in İÇİNDEKİ uzantı kimliği. `[KANIT]` `packet-ieee80211.c:707-708`.
 * Uzantının GÖVDESİ çözülmez — HE PHY parametreleri `[KARAR 18-2]` kapsam
 * dışıdır; yalnız uzantı KİMLİĞİ adlandırılır.
 */
const ELEMENT_EXTENSION_NAMES: ReadonlyMap<number, string> = new Map([
  [35, 'HE Capabilities'],
  [36, 'HE Operation'],
]);

/**
 * Beklenen sabit uzunluklar — SAPMA HATA DEĞİL, UYARIDIR. Element yine ham
 * basılır; "26 bayt olmalıydı" demek ile "bu element yok sayıldı" demek
 * farklı şeylerdir.
 */
const ELEMENT_EXPECTED_LENGTH: ReadonlyMap<number, number> = new Map([
  [ELEMENT_DS_PARAMETER_SET, 1],
  [ELEMENT_POWER_CONSTRAINT, 1],
  [ELEMENT_ERP_INFORMATION, 1],
  [ELEMENT_ERP_INFORMATION_OLD, 1],
  [ELEMENT_HT_CAPABILITIES, 26],
  [ELEMENT_VHT_CAPABILITIES, 12],
  [ELEMENT_VHT_OPERATION, 5],
]);

// ── Süit seçicileri — İKİ AYRI TABLO, bilerek ─────────────────────────────

const RSN_OUI = '000FAC';
const WPA_OUI = '0050F2';
const WPA_VENDOR_TYPE = 1;

/** `[KANIT]` `packet-ieee80211.c:19487` `ieee80211_rsn_cipher_vals`. */
const RSN_CIPHER_NAMES: ReadonlyMap<number, string> = new Map([
  [0, 'Use group cipher suite'],
  [1, 'WEP-40'],
  [2, 'TKIP'],
  [3, 'AES-OCB (deprecated)'],
  [4, 'CCMP-128 (AES-CCM)'],
  [5, 'WEP-104'],
  [6, 'BIP-CMAC-128'],
  [7, 'Group addressed traffic not allowed'],
  [8, 'GCMP-128'],
  [9, 'GCMP-256'],
  [10, 'CCMP-256'],
  [11, 'BIP-GMAC-128'],
  [12, 'BIP-GMAC-256'],
  [13, 'BIP-CMAC-256'],
]);

/** `[KANIT]` `packet-ieee80211.c:19528` `ieee80211_rsn_keymgmt_vals`. */
const RSN_AKM_NAMES: ReadonlyMap<number, string> = new Map([
  [0, 'None'],
  [1, '802.1X'],
  [2, 'PSK'],
  [3, 'FT over 802.1X'],
  [4, 'FT using PSK'],
  [5, '802.1X (SHA-256)'],
  [6, 'PSK (SHA-256)'],
  [7, 'TDLS / TPK handshake'],
  [8, 'SAE'],
  [9, 'FT using SAE'],
  [10, 'AP PeerKey'],
  [11, '802.1X Suite-B (SHA-256)'],
  [12, '802.1X Suite-B (SHA-384)'],
  [13, 'FT over 802.1X (SHA-384)'],
  [14, 'FILS (SHA-256)'],
  [15, 'FILS (SHA-384)'],
  [16, 'FT over FILS (SHA-256)'],
  [17, 'FT over FILS (SHA-384)'],
  [18, 'OWE'],
]);

/**
 * WPA'nın KENDİ tablosu — RSN'inkinin kopyası DEĞİL, KISALTILMIŞI.
 * `[KANIT]` `packet-ieee80211.c:19722` ve `:19734`; ikisi de 7'de biter.
 * Bir gün RSN tablosuna 18 (OWE) eklenince WPA IE'sinde "OWE" BASILMAMALI —
 * ayrı tablo tutmanın bütün sebebi budur.
 */
const WPA_CIPHER_NAMES: ReadonlyMap<number, string> = new Map([
  [0, 'Use group cipher suite'],
  [1, 'WEP-40'],
  [2, 'TKIP'],
  [3, 'AES-OCB (deprecated)'],
  [4, 'CCMP-128 (AES-CCM)'],
  [5, 'WEP-104'],
  [6, 'BIP'],
  [7, 'Group addressed traffic not allowed'],
]);

const WPA_AKM_NAMES: ReadonlyMap<number, string> = new Map([
  [0, 'None'],
  [1, '802.1X'],
  [2, 'PSK'],
  [3, 'FT over 802.1X'],
  [4, 'FT using PSK'],
  [5, '802.1X (SHA-256)'],
  [6, 'PSK (SHA-256)'],
  [7, 'TDLS / TPK handshake'],
]);

/**
 * Vendor element OUI etiketleri — `dot11Frame.ts`in MAC adresi etiketlerinden
 * AYRI tutuluyor. Aynı IEEE kaydından geliyorlar ama farklı sorulara cevap
 * veriyorlar: orada "bu donanımı kim yaptı", burada "bu element'i kim tanımladı".
 * Liste yine bilerek dar — TAM OUI kaydı gönderilmiyor.
 */
const VENDOR_OUI_LABELS: ReadonlyMap<string, string> = new Map([
  ['0050F2', 'Microsoft / Wi-Fi Alliance'],
  ['000FAC', 'IEEE 802.11'],
  ['001018', 'Broadcom'],
  ['18FE34', 'Espressif'],
  ['0017F2', 'Apple'],
  ['506F9A', 'Wi-Fi Alliance'],
]);

// ── Temel okuyucular ──────────────────────────────────────────────────────

function byteAt(data: Uint8Array, offset: number): number {
  return data[offset] ?? 0;
}

function readUint16Le(data: Uint8Array, offset: number): number {
  return byteAt(data, offset) | (byteAt(data, offset + 1) << 8);
}

function hexBytes(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).toUpperCase().padStart(2, '0')).join(' ');
}

function ouiKey(bytes: Uint8Array, offset: number): string {
  return [byteAt(bytes, offset), byteAt(bytes, offset + 1), byteAt(bytes, offset + 2)]
    .map((byte) => byte.toString(16).toUpperCase().padStart(2, '0'))
    .join('');
}

function ouiText(bytes: Uint8Array, offset: number): string {
  return [byteAt(bytes, offset), byteAt(bytes, offset + 1), byteAt(bytes, offset + 2)]
    .map((byte) => byte.toString(16).toUpperCase().padStart(2, '0'))
    .join('-');
}

// ── Yürüyücü — SAF, alan basmaz ───────────────────────────────────────────

export interface Dot11Element {
  readonly id: number;
  readonly length: number;
  /** Element ID baytının MUTLAK ofseti. */
  readonly offset: number;
  /** Veri baytlarının MUTLAK ofseti (`offset + 2`). */
  readonly dataOffset: number;
  readonly data: Uint8Array;
}

export interface Dot11ElementWalk {
  readonly elements: readonly Dot11Element[];
  /**
   * Zincir düzgün bitmediyse ARTAN baytların MUTLAK ofseti ve uzunluğu.
   * `length === 0` ise zincir tam tüketildi.
   */
  readonly trailingOffset: number;
  readonly trailingLength: number;
  /** Son TLV kendi başlığını ya da verisini aşıyordu. */
  readonly truncated: boolean;
}

/**
 * Element zincirini yürür. **Hiçbir şey basmaz, hiçbir şey uydurmaz**:
 * `Length` kalan bayttan büyükse element KABUL EDİLMEZ, kalan ham sayılır.
 *
 * `start`/`end` MUTLAK ofsetlerdir; çağıran `subarray` vermek zorunda değil,
 * böylece basılan alanların ofsetleri çerçevenin kendi ofsetleri kalır.
 */
export function walkDot11Elements(data: Uint8Array, start: number, end: number): Dot11ElementWalk {
  const elements: Dot11Element[] = [];
  const limit = Math.min(end, data.length);
  let cursor = Math.max(0, start);
  let truncated = false;

  while (cursor < limit) {
    if (cursor + 2 > limit) {
      truncated = true;
      break;
    }
    const id = byteAt(data, cursor);
    const length = byteAt(data, cursor + 1);
    if (cursor + 2 + length > limit) {
      truncated = true;
      break;
    }
    elements.push({
      id,
      length,
      offset: cursor,
      dataOffset: cursor + 2,
      data: data.slice(cursor + 2, cursor + 2 + length),
    });
    cursor += 2 + length;
  }

  return {
    elements,
    trailingOffset: cursor,
    trailingLength: limit - cursor,
    truncated,
  };
}

// ── Süit biçimlendirme ────────────────────────────────────────────────────

interface SuiteText {
  readonly text: string;
  readonly known: boolean;
}

type SuiteKind = 'cipher' | 'akm';

/**
 * Süit seçicisini metne çevirir. **OUI önce, numara sonra**: tanınmayan OUI
 * TESCİLLİ süittir ve adı UYDURULMAZ, ham OUI + tip basılır.
 */
function describeSuite(
  data: Uint8Array,
  offset: number,
  kind: SuiteKind,
  showLabels: boolean,
): SuiteText {
  const oui = ouiKey(data, offset);
  const type = byteAt(data, offset + 3);
  const raw = `${ouiText(data, offset)}:${String(type)}`;
  if (!showLabels) return { text: raw, known: false };

  const table =
    oui === RSN_OUI
      ? kind === 'cipher'
        ? RSN_CIPHER_NAMES
        : RSN_AKM_NAMES
      : oui === WPA_OUI
        ? kind === 'cipher'
          ? WPA_CIPHER_NAMES
          : WPA_AKM_NAMES
        : undefined;

  if (table === undefined) {
    const vendor = VENDOR_OUI_LABELS.get(oui);
    return {
      text: vendor === undefined ? `${raw} (proprietary suite)` : `${raw} (${vendor}, proprietary)`,
      known: false,
    };
  }
  const name = table.get(type);
  return name === undefined
    ? { text: `${raw} (type not in this release's table)`, known: false }
    : { text: `${name} (${raw})`, known: true };
}

// ── RSN / WPA zinciri ─────────────────────────────────────────────────────

/**
 * `Version` alanından sonrasını okuyan iç zincir. `rsn` ve `wpa` AYNI
 * gövdeyi paylaşır — tel biçimi gerçekten aynıdır; AYRILAN şey süit adı
 * tablosudur ve o `describeSuite` içinde OUI'den seçilir.
 *
 * `prefix` alan kimliklerini ayırır (`rsn-…` ↔ `wpa-…`); `label` alan
 * adlarında görünür.
 *
 * Dönen değer: zincirin tükettiği MUTLAK ofset. Çağıran onu `IE.Length` ile
 * karşılaştırır.
 */
function decodeRsnChain(
  data: Uint8Array,
  sink: FieldSink,
  warnings: ProtocolWarning[],
  errors: ProtocolError[],
  dataOffset: number,
  dataLength: number,
  prefix: string,
  label: string,
  showLabels: boolean,
): void {
  const limit = dataOffset + dataLength;
  let cursor = dataOffset;

  const remaining = (): number => limit - cursor;

  const pushRaw = (reason: string): void => {
    if (remaining() <= 0) return;
    pushField(sink, {
      id: `${prefix}-undecoded`,
      name: `802.11 · ${label} · remaining bytes (not decoded)`,
      offset: cursor,
      length: remaining(),
      rawBytes: data.slice(cursor, limit),
      rawValue: hexBytes(data.slice(cursor, limit)),
      physicalValue: `${String(remaining())} B left raw — ${reason}`,
      valid: false,
      warnings: [FIELD_WARN_RSN_COUNTER_OVERRUN],
    });
    cursor = limit;
  };

  /** Sayaç tuzağı TEK YERDE: `count × unit` kalan bayta SIĞMIYORSA durulur. */
  const counterFits = (count: number, unit: number, at: number, what: string): boolean => {
    if (count * unit <= remaining()) return true;
    errors.push({
      code: 'length-mismatch',
      message: ERROR_RSN_COUNTER_OVERRUN,
      offset: at,
      length: 2,
      details: { counter: what, count, unit, remaining: remaining() },
    });
    warnings.push(toProtocolWarning('rsnCounterOverrun', WARN_RSN_COUNTER_OVERRUN, at, 2));
    pushRaw(`${what} count ${String(count)} × ${String(unit)} B exceeds the ${String(remaining())} B left in the element`);
    return false;
  };

  if (remaining() < 2) {
    warnings.push(toProtocolWarning('rsnTruncated', WARN_RSN_TRUNCATED, dataOffset, dataLength));
    pushRaw('too short for the RSN version field');
    return;
  }
  const version = readUint16Le(data, cursor);
  pushField(sink, {
    id: `${prefix}-version`,
    name: `802.11 · ${label} · Version`,
    offset: cursor,
    length: 2,
    rawBytes: data.slice(cursor, cursor + 2),
    rawValue: version,
    physicalValue: version === 1 ? '1 (the only version defined)' : String(version),
    valid: version === 1,
    warnings: version === 1 ? [] : [FIELD_WARN_RSN_COUNTER_OVERRUN],
  });
  cursor += 2;
  if (version !== 1) {
    // Sürüm 1 değilse ZİNCİRE DEVAM EDİLMEZ: alan yerleşimi sürüme bağlıdır
    // ve bilinmeyen sürümün yerleşimini varsaymak tam olarak "uydurmak"tır.
    warnings.push(
      toProtocolWarning('rsnVersionUnsupported', WARN_RSN_VERSION_UNSUPPORTED, dataOffset, 2),
    );
    pushRaw(`version ${String(version)} is not 1 — the field layout is version dependent`);
    return;
  }

  if (remaining() < 4) {
    warnings.push(toProtocolWarning('rsnTruncated', WARN_RSN_TRUNCATED, cursor, remaining()));
    pushRaw('too short for the group data cipher suite');
    return;
  }
  const group = describeSuite(data, cursor, 'cipher', showLabels);
  pushField(sink, {
    id: `${prefix}-group-cipher`,
    name: `802.11 · ${label} · Group Data Cipher Suite`,
    offset: cursor,
    length: 4,
    rawBytes: data.slice(cursor, cursor + 4),
    rawValue: hexBytes(data.slice(cursor, cursor + 4)),
    physicalValue: group.text,
    valid: true,
    warnings: group.known ? [] : [FIELD_WARN_NOT_DECODED],
  });
  cursor += 4;

  // ── Pairwise ───────────────────────────────────────────────────────────
  if (remaining() < 2) {
    if (remaining() > 0) {
      warnings.push(toProtocolWarning('rsnTrailingBytes', WARN_RSN_TRAILING_BYTES, cursor, remaining()));
      pushRaw('one byte left over after the group cipher suite');
    }
    return;
  }
  const pairwiseCountOffset = cursor;
  const pairwiseCount = readUint16Le(data, cursor);
  pushField(sink, {
    id: `${prefix}-pairwise-count`,
    name: `802.11 · ${label} · Pairwise Cipher Suite Count`,
    offset: cursor,
    length: 2,
    rawBytes: data.slice(cursor, cursor + 2),
    rawValue: pairwiseCount,
    physicalValue: `${String(pairwiseCount)} suite(s) → ${String(pairwiseCount * 4)} B follow`,
    valid: true,
    warnings: [],
  });
  cursor += 2;
  if (!counterFits(pairwiseCount, 4, pairwiseCountOffset, 'pairwise cipher')) return;
  for (let index = 0; index < pairwiseCount; index += 1) {
    const suite = describeSuite(data, cursor, 'cipher', showLabels);
    pushField(sink, {
      id: `${prefix}-pairwise-suite`,
      name: `802.11 · ${label} · Pairwise Cipher Suite ${String(index + 1)}`,
      offset: cursor,
      length: 4,
      rawBytes: data.slice(cursor, cursor + 4),
      rawValue: hexBytes(data.slice(cursor, cursor + 4)),
      physicalValue: suite.text,
      valid: true,
      warnings: suite.known ? [] : [FIELD_WARN_NOT_DECODED],
    });
    cursor += 4;
  }

  // ── AKM ────────────────────────────────────────────────────────────────
  if (remaining() < 2) {
    if (remaining() > 0) {
      warnings.push(toProtocolWarning('rsnTrailingBytes', WARN_RSN_TRAILING_BYTES, cursor, remaining()));
      pushRaw('one byte left over after the pairwise cipher list');
    }
    return;
  }
  const akmCountOffset = cursor;
  const akmCount = readUint16Le(data, cursor);
  pushField(sink, {
    id: `${prefix}-akm-count`,
    name: `802.11 · ${label} · AKM Suite Count`,
    offset: cursor,
    length: 2,
    rawBytes: data.slice(cursor, cursor + 2),
    rawValue: akmCount,
    physicalValue: `${String(akmCount)} suite(s) → ${String(akmCount * 4)} B follow`,
    valid: true,
    warnings: [],
  });
  cursor += 2;
  if (!counterFits(akmCount, 4, akmCountOffset, 'AKM')) return;
  for (let index = 0; index < akmCount; index += 1) {
    const suite = describeSuite(data, cursor, 'akm', showLabels);
    pushField(sink, {
      id: `${prefix}-akm-suite`,
      name: `802.11 · ${label} · AKM Suite ${String(index + 1)}`,
      offset: cursor,
      length: 4,
      rawBytes: data.slice(cursor, cursor + 4),
      rawValue: hexBytes(data.slice(cursor, cursor + 4)),
      physicalValue: suite.text,
      valid: true,
      warnings: suite.known ? [] : [FIELD_WARN_NOT_DECODED],
    });
    cursor += 4;
  }

  // ── Capabilities (opsiyonel) ───────────────────────────────────────────
  if (remaining() < 2) {
    if (remaining() > 0) {
      warnings.push(toProtocolWarning('rsnTrailingBytes', WARN_RSN_TRAILING_BYTES, cursor, remaining()));
      pushRaw('one byte left over after the AKM list');
    }
    return;
  }
  const capabilities = readUint16Le(data, cursor);
  pushField(sink, {
    id: `${prefix}-capabilities`,
    name: `802.11 · ${label} · RSN Capabilities`,
    offset: cursor,
    length: 2,
    rawBytes: data.slice(cursor, cursor + 2),
    rawValue: `0x${capabilities.toString(16).toUpperCase().padStart(4, '0')}`,
    physicalValue: describeRsnCapabilities(capabilities),
    valid: true,
    warnings: [],
  });
  cursor += 2;

  // ── PMKID (opsiyonel) ──────────────────────────────────────────────────
  if (remaining() < 2) {
    if (remaining() > 0) {
      warnings.push(toProtocolWarning('rsnTrailingBytes', WARN_RSN_TRAILING_BYTES, cursor, remaining()));
      pushRaw('one byte left over after the RSN capabilities');
    }
    return;
  }
  const pmkidCountOffset = cursor;
  const pmkidCount = readUint16Le(data, cursor);
  pushField(sink, {
    id: `${prefix}-pmkid-count`,
    name: `802.11 · ${label} · PMKID Count`,
    offset: cursor,
    length: 2,
    rawBytes: data.slice(cursor, cursor + 2),
    rawValue: pmkidCount,
    physicalValue: `${String(pmkidCount)} PMKID(s) → ${String(pmkidCount * 16)} B follow`,
    valid: true,
    warnings: [],
  });
  cursor += 2;
  if (!counterFits(pmkidCount, 16, pmkidCountOffset, 'PMKID')) return;
  for (let index = 0; index < pmkidCount; index += 1) {
    pushField(sink, {
      id: `${prefix}-pmkid`,
      name: `802.11 · ${label} · PMKID ${String(index + 1)}`,
      offset: cursor,
      length: 16,
      rawBytes: data.slice(cursor, cursor + 16),
      rawValue: hexBytes(data.slice(cursor, cursor + 16)),
      // PMKID caching / PMKSA durumu `[KARAR 18-2]` kapsam dışıdır: kimlik
      // basılır, "bu oturum önceden kimliklenmiş" YORUMU yapılmaz.
      physicalValue: 'PMKID (identifier only; PMKSA caching state is out of scope)',
      valid: true,
      warnings: [],
    });
    cursor += 16;
  }

  // ── Group Management Cipher (opsiyonel) ────────────────────────────────
  if (remaining() >= 4) {
    const management = describeSuite(data, cursor, 'cipher', showLabels);
    pushField(sink, {
      id: `${prefix}-group-management-cipher`,
      name: `802.11 · ${label} · Group Management Cipher Suite`,
      offset: cursor,
      length: 4,
      rawBytes: data.slice(cursor, cursor + 4),
      rawValue: hexBytes(data.slice(cursor, cursor + 4)),
      physicalValue: management.text,
      valid: true,
      warnings: management.known ? [] : [FIELD_WARN_NOT_DECODED],
    });
    cursor += 4;
  }

  // ── SONDA: tüketilen ile `IE.Length` KARŞILAŞTIRILIR ───────────────────
  if (remaining() > 0) {
    warnings.push(
      toProtocolWarning('rsnTrailingBytes', WARN_RSN_TRAILING_BYTES, cursor, remaining()),
    );
    pushRaw('the chain consumed fewer bytes than the element length declares');
  }
}

/** RSN Capabilities bit alanları — IEEE 802.11 Table 9-151 sırası. */
function describeRsnCapabilities(value: number): string {
  const flags: string[] = [];
  if ((value & 0x0001) !== 0) flags.push('Pre-Auth');
  if ((value & 0x0002) !== 0) flags.push('No Pairwise');
  flags.push(`PTKSA replay counters ${String(1 << ((value >> 2) & 0x03))}`);
  flags.push(`GTKSA replay counters ${String(1 << ((value >> 4) & 0x03))}`);
  if ((value & 0x0040) !== 0) flags.push('MFPR (protection required)');
  if ((value & 0x0080) !== 0) flags.push('MFPC (protection capable)');
  if ((value & 0x0400) !== 0) flags.push('PeerKey enabled');
  return flags.join(', ');
}

// ── Adlandırılmış element çözücüleri ──────────────────────────────────────

interface ElementSummary {
  /** Element satırının `physicalValue`ı. */
  readonly summary: string;
  /** `false` ise element ADLANDIRILDI ama gövdesi ÇÖZÜLMEDİ. */
  readonly decoded: boolean;
}

function describeRates(data: Uint8Array): string {
  if (data.length === 0) return 'no rates listed';
  const parts = Array.from(data, (byte) => {
    const basic = (byte & 0x80) !== 0;
    const rate = (byte & 0x7f) * 0.5;
    return `${String(rate)}${basic ? '*' : ''}`;
  });
  return `${parts.join(', ')} Mbit/s (* = basic rate)`;
}

function describeErp(value: number): string {
  const flags: string[] = [];
  if ((value & 0x01) !== 0) flags.push('Non-ERP Present');
  if ((value & 0x02) !== 0) flags.push('Use Protection');
  if ((value & 0x04) !== 0) flags.push('Barker Preamble Mode');
  return flags.length === 0 ? 'no flags set' : flags.join(', ');
}

/** SSID'nin UTF-8 çözümü — çözülemeyen bayt dizisi HAM bırakılır. */
function describeSsid(data: Uint8Array): string {
  if (data.length === 0) return 'wildcard / hidden SSID (length 0 — the network name is not broadcast)';
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(data);
    return `"${text}"`;
  } catch {
    return `not valid UTF-8 — raw ${hexBytes(data)}`;
  }
}

function describeCountry(data: Uint8Array): string {
  if (data.length < 3) return `too short for a country string — raw ${hexBytes(data)}`;
  const code = String.fromCharCode(byteAt(data, 0), byteAt(data, 1));
  const environment = byteAt(data, 2);
  const triplets = Math.floor((data.length - 3) / 3);
  return `${code}, environment 0x${environment.toString(16).toUpperCase().padStart(2, '0')}, ${String(triplets)} triplet(s) left raw`;
}

// ── Element basıcı ────────────────────────────────────────────────────────

/**
 * Element zincirini alan alan basar. **`sink` PAYLAŞILIR** — çağıran aynı
 * biriktiriciyle devam eder, böylece alan listesi ofset sırasını korur.
 */
export function pushDot11Elements(
  data: Uint8Array,
  sink: FieldSink,
  warnings: ProtocolWarning[],
  errors: ProtocolError[],
  start: number,
  end: number,
  options: Dot11ElementOptions = DOT11_ELEMENT_DEFAULT_OPTIONS,
): Dot11ElementWalk {
  const walk = walkDot11Elements(data, start, end);
  const named = options.ieNameSet !== IE_NAME_SET_NONE;
  const showSuiteLabels = options.rsnSuiteLabels !== RSN_SUITE_LABELS_HIDE;
  let unknownCount = 0;
  let hiddenCount = 0;
  let vendorRawCount = 0;

  for (const element of walk.elements) {
    const name = named ? ELEMENT_NAMES.get(element.id) : undefined;
    const known = name !== undefined;
    // Adlandırma KAPALIYKEN element "bilinmeyen" DEĞİLDİR — kullanıcı ham TLV
    // görünümü istedi. Uyarıyı yine de basmak, kendi seçimini eksiklik diye
    // geri satmak olurdu.
    if (named && !known) unknownCount += 1;

    if (!known && options.unknownIeDisplay === UNKNOWN_IE_HIDDEN) {
      hiddenCount += 1;
      continue;
    }

    const expected = ELEMENT_EXPECTED_LENGTH.get(element.id);
    const lengthUnexpected = named && expected !== undefined && expected !== element.length;

    const summary = known
      ? describeElement(element, options, showSuiteLabels)
      : {
          // İki AYRI sebep, İKİ AYRI cümle: "tabloda yok" ile "adlandırma
          // kapatıldı" aynı şey değildir ve ikincisine "tabloda yok" demek
          // kullanıcıya kendi seçtiği şeyi eksiklik diye satardı.
          summary: named
            ? `${String(element.length)} B not decoded — element ID ${String(element.id)} is not in this release's table (the ID space grows with every 802.11 revision)`
            : `${String(element.length)} B raw — element naming is turned off, this is the plain Element ID / Length / Data view`,
          decoded: false,
        };

    const fieldWarnings: string[] = [];
    if (named && !known) fieldWarnings.push(FIELD_WARN_UNKNOWN_ELEMENT);
    else if (known && !summary.decoded) fieldWarnings.push(FIELD_WARN_NOT_DECODED);
    if (lengthUnexpected) fieldWarnings.push(FIELD_WARN_ELEMENT_LENGTH_UNEXPECTED);
    if (known && element.id === ELEMENT_SSID && element.length === 0) {
      fieldWarnings.push(FIELD_WARN_HIDDEN_SSID);
    }

    pushField(sink, {
      id: `ie-${String(element.id)}`,
      name: `802.11 · Element ${String(element.id)}${name === undefined ? '' : ` · ${name}`}`,
      offset: element.offset,
      length: 2 + element.length,
      rawBytes: data.slice(element.offset, element.offset + 2 + element.length),
      rawValue: element.length === 0 ? '(empty)' : hexBytes(element.data),
      physicalValue: summary.summary,
      valid: !lengthUnexpected,
      warnings: fieldWarnings,
    });

    if (lengthUnexpected) {
      warnings.push(
        toProtocolWarning(
          'elementLengthUnexpected',
          WARN_ELEMENT_LENGTH_UNEXPECTED,
          element.offset + 1,
          1,
        ),
      );
    }

    if (known) {
      pushElementDetail(data, sink, warnings, errors, element, options, showSuiteLabels);
      if (element.id === ELEMENT_VENDOR_SPECIFIC && options.vendorIeProfile === VENDOR_IE_RAW) {
        vendorRawCount += 1;
      }
    }
  }

  // Bu üç uyarı ELEMENT BAŞINA DEĞİL, ÇERÇEVE BAŞINA basılır: on element'lik
  // bir Beacon'da aynı cümleyi on kez göstermek uyarı listesini kullanılmaz
  // hâle getirirdi (dalga 13'ün "nabız konteyneri" dersinin uyarı düzeyi).
  if (unknownCount > 0) {
    warnings.push(toProtocolWarning('unknownElement', WARN_UNKNOWN_ELEMENT, start, end - start));
  }
  if (hiddenCount > 0) {
    warnings.push(toProtocolWarning('hiddenElements', WARN_HIDDEN_ELEMENTS, start, end - start));
  }
  if (vendorRawCount > 0) {
    warnings.push(
      toProtocolWarning('vendorElementRaw', WARN_VENDOR_ELEMENT_RAW, start, end - start),
    );
  }

  if (walk.trailingLength > 0) {
    // Zincir düzgün bitmedi. Kalan HAM basılır ve UYDURULMAZ: son element'in
    // `Length`i kalan bayttan büyük demektir, ki bu tam olarak "sessizce kayan
    // zincir"in element düzeyindeki hâlidir.
    pushField(sink, {
      id: 'ie-trailing',
      name: '802.11 · element chain · trailing bytes',
      offset: walk.trailingOffset,
      length: walk.trailingLength,
      rawBytes: data.slice(walk.trailingOffset, walk.trailingOffset + walk.trailingLength),
      rawValue: hexBytes(data.slice(walk.trailingOffset, walk.trailingOffset + walk.trailingLength)),
      physicalValue: `${String(walk.trailingLength)} B do not form a complete Element ID / Length / Data triple`,
      valid: false,
      warnings: [FIELD_WARN_ELEMENT_LENGTH_UNEXPECTED],
    });
    warnings.push(
      toProtocolWarning(
        'elementChainTruncated',
        WARN_ELEMENT_CHAIN_TRUNCATED,
        walk.trailingOffset,
        walk.trailingLength,
      ),
    );
  }

  return walk;
}

function describeElement(
  element: Dot11Element,
  options: Dot11ElementOptions,
  showSuiteLabels: boolean,
): ElementSummary {
  const data = element.data;
  switch (element.id) {
    case ELEMENT_SSID:
      return { summary: describeSsid(data), decoded: true };
    case ELEMENT_SUPPORTED_RATES:
    case ELEMENT_EXTENDED_SUPPORTED_RATES:
      return { summary: describeRates(data), decoded: true };
    case ELEMENT_DS_PARAMETER_SET:
      return { summary: `channel ${String(byteAt(data, 0))}`, decoded: true };
    case ELEMENT_TIM:
      return data.length < 4
        ? { summary: `too short for a TIM — raw ${hexBytes(data)}`, decoded: false }
        : {
            summary: `DTIM count ${String(byteAt(data, 0))}, DTIM period ${String(byteAt(data, 1))}, bitmap control 0x${byteAt(data, 2).toString(16).toUpperCase().padStart(2, '0')}, ${String(data.length - 3)} B partial virtual bitmap`,
            decoded: true,
          };
    case ELEMENT_COUNTRY:
      return { summary: describeCountry(data), decoded: true };
    case ELEMENT_POWER_CONSTRAINT:
      return { summary: `${String(byteAt(data, 0))} dB local power constraint`, decoded: true };
    case ELEMENT_ERP_INFORMATION:
    case ELEMENT_ERP_INFORMATION_OLD:
      return { summary: describeErp(byteAt(data, 0)), decoded: true };
    case ELEMENT_HT_OPERATION:
      return data.length === 0
        ? { summary: 'empty', decoded: false }
        : {
            summary: `primary channel ${String(byteAt(data, 0))}; the remaining ${String(data.length - 1)} B (HT PHY parameters) are OUT OF SCOPE`,
            decoded: false,
          };
    case ELEMENT_HT_CAPABILITIES:
    case ELEMENT_VHT_CAPABILITIES:
    case ELEMENT_VHT_OPERATION:
      return {
        summary: `${String(data.length)} B raw — HT/VHT PHY parameters are OUT OF SCOPE`,
        decoded: false,
      };
    case ELEMENT_EXTENDED_CAPABILITIES:
      return {
        summary: `${String(data.length)} B capability bitmap left raw — the bit meanings span several 802.11 revisions`,
        decoded: false,
      };
    case ELEMENT_ID_EXTENSION: {
      const extensionId = byteAt(data, 0);
      const extensionName = ELEMENT_EXTENSION_NAMES.get(extensionId);
      return {
        summary: `extension ID ${String(extensionId)}${extensionName === undefined ? '' : ` (${extensionName})`}; the ${String(Math.max(0, data.length - 1))} B body is OUT OF SCOPE`,
        decoded: false,
      };
    }
    case ELEMENT_RSN:
      return {
        summary: `RSNE, ${String(data.length)} B — the version / cipher / AKM chain is decoded in the rows below`,
        decoded: true,
      };
    case ELEMENT_VENDOR_SPECIFIC:
      return describeVendorElement(element, options, showSuiteLabels);
    default:
      return { summary: `${String(data.length)} B not decoded`, decoded: false };
  }
}

function describeVendorElement(
  element: Dot11Element,
  options: Dot11ElementOptions,
  showSuiteLabels: boolean,
): ElementSummary {
  const data = element.data;
  if (options.vendorIeProfile === VENDOR_IE_RAW) {
    return { summary: `${String(data.length)} B raw (vendor decoding turned off)`, decoded: false };
  }
  if (data.length < 4) {
    return {
      summary: `too short for an OUI + type header — raw ${hexBytes(data)}`,
      decoded: false,
    };
  }
  const oui = ouiKey(data, 0);
  const vendorType = byteAt(data, 3);
  const label = VENDOR_OUI_LABELS.get(oui);
  const head = `OUI ${ouiText(data, 0)}${label === undefined ? '' : ` (${label})`}, type ${String(vendorType)}`;

  const isWpa = oui === WPA_OUI && vendorType === WPA_VENDOR_TYPE;
  if (isWpa && options.vendorIeProfile === VENDOR_IE_DECODE) {
    // Süit adları ZORUNLU olarak WPA tablosundan okunur; `describeSuite`
    // tabloyu OUI'den seçtiği için burada ekstra bir kapı YOK.
    void showSuiteLabels;
    return { summary: `${head} — WPA (the pre-RSN twin of element 48)`, decoded: true };
  }
  return {
    summary: `${head} — the vendor payload (${String(data.length - 4)} B) is not decoded; only 00-50-F2 type 1 (WPA) has a decoder in this release`,
    decoded: false,
  };
}

/** Yapısı olan element'lerin ALT ALANLARI. Skalerler zaten satırda basıldı. */
function pushElementDetail(
  data: Uint8Array,
  sink: FieldSink,
  warnings: ProtocolWarning[],
  errors: ProtocolError[],
  element: Dot11Element,
  options: Dot11ElementOptions,
  showSuiteLabels: boolean,
): void {
  if (element.id === ELEMENT_RSN) {
    decodeRsnChain(
      data,
      sink,
      warnings,
      errors,
      element.dataOffset,
      element.length,
      'rsn',
      'RSN',
      showSuiteLabels,
    );
    return;
  }

  if (element.id !== ELEMENT_VENDOR_SPECIFIC) return;
  if (options.vendorIeProfile !== VENDOR_IE_DECODE) return;
  if (element.data.length < 4) return;
  if (ouiKey(element.data, 0) !== WPA_OUI || byteAt(element.data, 3) !== WPA_VENDOR_TYPE) return;

  // WPA IE: OUI(3) + type(1) TÜKETİLDİ, gerisi RSN'in AYNI iç zinciri.
  decodeRsnChain(
    data,
    sink,
    warnings,
    errors,
    element.dataOffset + 4,
    element.length - 4,
    'wpa',
    'WPA',
    showSuiteLabels,
  );
}
