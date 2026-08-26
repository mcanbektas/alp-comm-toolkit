/**
 * ESP-NOW (Espressif) — 802.11 vendor-specific action frame üstünde taşınan
 * bağlantısız cihaz-cihaz protokolü (Faz 10, dalga 18c; `wireless-iot`
 * domain'inin `wifi-wireless` ailesindeki ikinci kaydı, `wifi`nin İKİNCİ
 * tüketicisi — 18b `dot11Management.ts` birinciydi).
 *
 * Yeni bir tel biçimi YOK: `[KARAR 18-4]` (`docs/brief-faz10-dalga18.md`)
 * ESP-NOW'ı `wifi`nin PAYLAŞILAN çekirdeğinin (18a `dot11Frame.ts`, 18b
 * `dot11Elements.ts`) tüketicisi ilan eder — Espressif'in KENDİ şeması ilk 24
 * baytı 802.11 MAC başlığı, son 4 baytı 802.11 FCS diye tanımlıyor:
 *
 * ```
 * | MAC Header | Category Code | Organization Identifier | Random Values | Vendor Specific Content |  FCS  |
 *    24 bytes       1 byte              3 bytes                4 bytes            7-x bytes        4 bytes
 * ```
 *
 * `[KANIT]` ESP-IDF Programming Guide, "ESP-NOW → Frame Format"
 * (`https://docs.espressif.com/projects/esp-idf/en/stable/esp32/api-reference/network/esp_now.html`,
 * çekildi 2026-08-26). `xcpPacket.ts` sınıfı PAYLAŞIM, `ccp.ts` sınıfı
 * AYRILIK DEĞİL (aynı brif, aynı gerekçe).
 *
 * ── TÜKETİLEN, KOPYALANMAYAN ───────────────────────────────────────────────
 * Bu dosya `dot11Frame.ts` ve `dot11Elements.ts`e TEK BAYT DOKUNMAZ:
 *   · `decodeDot11Header` — MAC başlığını çözer, `bodyOffset`/`bodyLength`/
 *     `protectedFrame`/`fcs` verir. Adres rol matrisi (`resolveAddressRoles`,
 *     `dot11Frame.ts` içinde TEK YERDE yaşar) ToDS=FromDS=0 satırıyla ZATEN
 *     DA=Addr1 / SA=Addr2 / BSSID=Addr3 basıyor — Espressif'in "birinci=hedef,
 *     ikinci=kaynak, üçüncü=yayın" tarifiyle aynı satır. **Matrise
 *     DOKUNULMADI.**
 *   · `walkDot11Elements` — element zincirini yürür, HİÇBİR ŞEY basmaz.
 *     `dot11Elements.ts`in kendi başı bunu ayrıca söylüyor: *"yürüyücü
 *     ESP-NOW'a özel HİÇBİR ŞEY bilmez ve bilmemelidir."* Bu yüzden
 *     `pushDot11Elements` (yönetim IE'leri için genel alan basıcı) BURADA
 *     KULLANILMAZ — ESP-NOW'un vendor element'i (Reserved/More data/Version
 *     bit paketi, `Length` semantiği) TAMAMEN bu dosyanın KENDİ katmanıdır.
 *   · `pushDot11Fcs` — EN SONDA çağrılır, FCS bir KUYRUKTUR.
 *
 * ── GÖVDE KAPISI — `Protected = 1` ⇒ ÖTEYE İNİLMEZ ─────────────────────────
 * *"ESP-NOW uses the CCMP method… lengths of both PMK and LMK are 16 bytes."*
 * Anahtar tarayıcıya HİÇ GİRMEZ (CLAUDE.md anahtar kuralı); şifreli gövde
 * "encrypted" damgasıyla HAM kalır. **Category baytı da şifrelenmiş gövdenin
 * İÇİNDEDİR** — yani korumalı bir ESP-NOW çerçevesi `canParse`ı GEÇEMEZ
 * (aşağıda). Bu bir eksiklik değil, protokolün kendisi: dışarıdan bakan biri
 * korumalı bir vendor action frame'inin ESP-NOW olduğunu ÇERÇEVEDEN BİLEMEZ.
 *
 * ── `canParse` — ana brifin E1'i, ÖLÇÜLMÜŞ ─────────────────────────────────
 * ```
 * n ≥ 39
 * && b[0] === 0xD0                 // sürüm 0, tip 0 (Yönetim), alt tip 13 (Action)
 * && (b[1] & 0x03) === 0           // ToDS = FromDS = 0
 * && b[24] === 0x7F                // Category 127 (vendor-specific)
 * && b[25..27] === 18 FE 34        // Espressif OUI
 * ```
 * Deponun 899 örneğinde **0** çakışma. Element ofseti (32) İMZAYA BİLEREK
 * EKLENMEDİ: v2.0 çerçevesi altı element taşıyabilir, ilk element'in ofseti
 * yalnız "tek element" varsayımında sabit — Category + OUI zaten 0 çakışma
 * veriyor, ofset varsayımı GEREKSİZ risk eklerdi (`canParse` ucuz ön elemedir,
 * `schemaParser.ts:606-607`in kendi kuralı). `hasNaiveEspNowSignature`
 * (yalnız `b[0] === 0xD0`) **3/899** çakışıyor (`sae-j1850-vpw`) — bekçi
 * testinin "yazılsaydı çalardı" ayağı bunu ölçer, motorda KULLANILMAZ.
 *
 * Alt tip **14** ("Action No Ack", `0xE0`) BİLEREK KAPSANMADI: ne Espressif
 * kaynağı ne bu dalganın ölçümü onu doğruluyor, yalnız `0xD0` doğrulanmış —
 * genişletmek tahmin edilmiş bir alan tablosu yayınlamak olurdu.
 *
 * ── `decodeOptions` — DÖRT kanal ───────────────────────────────────────────
 * `espNowVersion` (auto/v1/v2) · `fcsPresent` (auto/yes/no, `wifi` ile AYNI
 * gerekçe — capture adaptörünün FCS'i düşürüp düşürmediği çerçeveden
 * ÇIKARILAMAZ) · `payloadSchema` (none/ascii/hex/custom) ·
 * `unknownVendorElementDisplay` (warn/raw).
 *
 * KANAL YAPILMAYANLAR (ve neden — dalga 17 dersi, bir sonraki nesil
 * "unutulmuş" sanmasın diye burada duruyor):
 *   · **PMK/LMK girişi** — CLAUDE.md'nin anahtar kuralı ANAHTARIN GİTMEMESİNİ
 *     garanti eder, şifre çözmeyi DEĞİL; bu dalgada şifre çözme YOK, kanal
 *     açmak var olmayan bir yetenek vaat ederdi.
 *   · **RSSI / kanal / veri hızı** — radiotap'in işi, KAPSAM DIŞI (`[KARAR 18-2]`).
 *   · **Peer listesi** — çerçeveler arası durum (dalga 16 bulgu 12).
 *   · **Random Value doğrulama** — tekrar saldırısı tespiti ÇOK-ÇERÇEVELİDİR.
 *
 * ── ROZET `ready` — GERÇEK YAKALAMAYLA DOĞRULANDI ──────────────────────────
 * Ana brif rozeti `esp-now`un ÇÜRÜTME KOŞULUNA bağlıyor: *"doğrulayıcı bir
 * örnek (gerçek yakalama ya da ESP32'den üretilmiş) BULUNAMAZSA `partial`e
 * düş."* Keşif turu bulamamıştı; **bu uygulama turu BULDU**:
 * `espressif/esp-idf`in kendi issue tracker'ında, gerçek ESP32 donanımından
 * monitor-mode'la yakalanmış, radiotap'li İKİ çerçeve hex dökümü olarak
 * duruyor `[KANIT]` `https://github.com/espressif/esp-idf/issues/2833`
 * ("Observed ESP-NOW frames are not according to the docs…", IDFGH-503,
 * 2018-12-13).
 *
 * Birinci çerçeve (66 B, 18 B radiotap) BAYT BAYT ÇAPRAZLANDI: radiotap
 * soyulunca kalan 48 bayt — 24 B MAC başlığı + Category `7F` + OUI `18 FE 34`
 * + 4 B Random + BİR element (ID 221, Length 14, element-OUI `18 FE 34`,
 * Type 4, Ver-byte `01`, gövde `48 65 6C 6C 6F C7 DB 01 44`) — **sıfır bayt
 * açık/fazla bırakıyor**, aritmetik tam kapanıyor. Bu dosyanın
 * `real-capture-hello` örneği bu çerçevedir; FCS capture'da YOKTU
 * (reporter'ın ikinci bulgusu, ve `fcsPresent` kanalının VAR OLMA
 * sebeplerinden birinin gerçek dünyadaki KANITI) — `withRecomputedFcs` ile
 * YENİDEN hesaplanıp eklendi. `[BEKLENTİ]` işaretlenmedi çünkü başlık ve
 * gövde baytlarının kendisi gerçek; yalnız FCS kuyruğu sentetik.
 *
 * 🚨 **Bu çapraz, Espressif'in kendi dokümantasyon örneğini bir noktada
 * ÇÜRÜTÜYOR:** dosyanın en üstündeki alıntı *"the third address field is set
 * to broadcast address"* der. Gerçek çerçevede Addr1 (DA) YAYIN DEĞİL
 * (`36:33:33:33:33:33`, belirli bir eş) ve Addr3 **Addr1 İLE AYNI** —
 * broadcast DEĞİL. Issue'nun İKİNCİ çerçevesi (Addr1 = broadcast) bunu
 * tamamlıyor: orada Addr3 DA broadcast. Yani üçüncü adres muhtemelen Addr1'i
 * AYNEN YANSITIYOR; Espressif dokümanının "broadcast" tarifi yalnız kendi
 * örneğinin özel durumuydu. `resolveAddressRoles`in ToDS=FromDS=0 satırı
 * (Addr3 = BSSID, bir ROL adı, bir DEĞER garantisi değil) bu gözlemle
 * ÇELİŞMİYOR ve DEĞİŞTİRİLMEDİ — yalnız Espressif kaynağının "hep broadcast"
 * ifadesinin bir genelleme olduğu netleşti.
 *
 * Kanıt tek kaynaklı ve 2018 tarihli (issue'da yanıt/onay görünmüyor); rozet
 * gerekçesi bu yüzden burada AÇIKÇA duruyor — bir sonraki nesil ikinci
 * bağımsız bir yakalama bulursa güçlendirir, çürütürse `partial`e döner.
 *
 * ── KAPSAM DIŞI ─────────────────────────────────────────────────────────────
 *   · CCMP şifre çözme (PMK/LMK) — CLAUDE.md anahtar kuralı.
 *   · Radiotap/PPI/Prism/AVS başlıkları ve pcap zarfı — `wifi` ile AYNI girdi
 *     sözleşmesi (`[KARAR 18-2]`).
 *   · Peer & Device Graph, TX → Application ACK Latency — çerçeveler arası
 *     durum (dalga 16 bulgu 12).
 *   · Action No Ack (alt tip 14) — yukarıda gerekçeli.
 */

import { createRawFrame } from '@/protocol-core/types';
import type {
  DecodeOption,
  ExampleFrame,
  ParseContext,
  ParseResult,
  ParsedFrame,
  ProtocolError,
  ProtocolParser,
  ProtocolPlugin,
  ProtocolWarning,
} from '@/protocol-core/types';
import { computeNamedCrc } from '@/protocol-core/checksums';

import { ELEMENT_VENDOR_SPECIFIC, walkDot11Elements } from '../wifi/dot11Elements';
import type { Dot11Element } from '../wifi/dot11Elements';
import {
  DOT11_DEFAULT_OPTIONS,
  DOT11_FCS_LENGTH,
  DOT11_TYPE_MANAGEMENT,
  FCS_PRESENT_AUTO,
  FCS_PRESENT_NO,
  FCS_PRESENT_YES,
  FC_FROM_DS_MASK,
  FC_TO_DS_MASK,
  createFieldSink,
  decodeDot11Header,
  pushDot11Fcs,
  pushField,
} from '../wifi/dot11Frame';
import type { Dot11DecodeOptions, Dot11HeaderSummary, FieldSink } from '../wifi/dot11Frame';

/** Kayıt defterindeki ve katalogdaki kimlikle AYNI olmak zorunda. */
const PROTOCOL_ID = 'esp-now';
/** Protokol adı VERİDİR, çeviriye girmez. */
const PROTOCOL_DISPLAY_NAME = 'ESP-NOW';

// `wifi` (`dot11Frame.ts`/`dot11Elements.ts`) `protocol.wifi` önekini
// kullanıyor çünkü çekirdek paylaşılıyor. ESP-NOW'un KENDİ katmanı (Action
// gövdesi + vendor element yorumu) bu dosyaya ÖZEL — üçüncü bir paylaşım
// yok, o yüzden kendi önekini alır (dosya başı yorumu, `mode-s` emsali).
const TRANSLATION_KEY_PREFIX = 'protocol.espNow';

// ── Çeviri anahtarları ──────────────────────────────────────────────────────

const ERROR_ABORTED = `${TRANSLATION_KEY_PREFIX}.error.aborted`;
const ERROR_EMPTY_FRAME = `${TRANSLATION_KEY_PREFIX}.error.emptyFrame`;
const ERROR_FRAME_TOO_LONG = `${TRANSLATION_KEY_PREFIX}.error.frameTooLong`;
const ERROR_BODY_TOO_SHORT = `${TRANSLATION_KEY_PREFIX}.error.bodyTooShortForAction`;
const ERROR_NO_ESPNOW_ELEMENT = `${TRANSLATION_KEY_PREFIX}.error.noEspNowElement`;
const ERROR_ELEMENT_LENGTH_EXCEEDS_FRAME = `${TRANSLATION_KEY_PREFIX}.error.elementLengthExceedsFrame`;

const WARN_RADIOTAP_OUT_OF_SCOPE = `${TRANSLATION_KEY_PREFIX}.warning.radiotapOutOfScope`;
const WARN_ENCRYPTED_PAYLOAD = `${TRANSLATION_KEY_PREFIX}.warning.encryptedPayload`;
const WARN_NOT_ACTION_FRAME = `${TRANSLATION_KEY_PREFIX}.warning.notActionFrame`;
const WARN_CATEGORY_NOT_VENDOR_SPECIFIC = `${TRANSLATION_KEY_PREFIX}.warning.categoryNotVendorSpecific`;
const WARN_ACTION_OUI_NOT_ESPRESSIF = `${TRANSLATION_KEY_PREFIX}.warning.actionOuiNotEspressif`;
const WARN_NO_ESPNOW_ELEMENT = `${TRANSLATION_KEY_PREFIX}.warning.noEspNowElementFound`;
const WARN_ELEMENT_CHAIN_TRUNCATED = `${TRANSLATION_KEY_PREFIX}.warning.elementChainTruncated`;
const WARN_UNRECOGNIZED_ELEMENT = `${TRANSLATION_KEY_PREFIX}.warning.unrecognizedElement`;
const WARN_FOREIGN_VENDOR_ELEMENT = `${TRANSLATION_KEY_PREFIX}.warning.foreignVendorElement`;
const WARN_VERSION_UNRECOGNIZED = `${TRANSLATION_KEY_PREFIX}.warning.unrecognizedVersion`;
const WARN_PAYLOAD_OVERSIZE_V1 = `${TRANSLATION_KEY_PREFIX}.warning.payloadOversizeV1`;
const WARN_PAYLOAD_OVERSIZE_V2 = `${TRANSLATION_KEY_PREFIX}.warning.payloadOversizeV2`;
const WARN_TOO_MANY_ELEMENTS = `${TRANSLATION_KEY_PREFIX}.warning.tooManyElements`;

const FIELD_WARN_ENCRYPTED = `${TRANSLATION_KEY_PREFIX}.field.encryptedBody`;
const FIELD_WARN_NOT_ACTION_FRAME = `${TRANSLATION_KEY_PREFIX}.field.notActionFrame`;
const FIELD_WARN_CATEGORY_INVALID = `${TRANSLATION_KEY_PREFIX}.field.categoryInvalid`;
const FIELD_WARN_OUI_NOT_ESPRESSIF = `${TRANSLATION_KEY_PREFIX}.field.ouiNotEspressif`;
const FIELD_WARN_ELEMENT_TOO_SHORT = `${TRANSLATION_KEY_PREFIX}.field.elementTooShort`;
const FIELD_WARN_ELEMENT_UNRECOGNIZED = `${TRANSLATION_KEY_PREFIX}.field.elementUnrecognized`;
const FIELD_WARN_FOREIGN_VENDOR_ELEMENT = `${TRANSLATION_KEY_PREFIX}.field.elementForeignVendor`;
const FIELD_WARN_VERSION_UNRECOGNIZED = `${TRANSLATION_KEY_PREFIX}.field.versionUnrecognized`;
const FIELD_WARN_TRAILING_BYTES = `${TRANSLATION_KEY_PREFIX}.field.trailingBytes`;

// ── Sabitler — Espressif'in şeması ──────────────────────────────────────────

/** E1'in asgari uzunluğu — ana brif, 0/899 çakışma. */
const ESPNOW_MIN_FRAME_LENGTH = 39;
/** Sürüm 0 + tip 0 (Yönetim) + alt tip 13 (Action) — TEK bayt, dört alanı birden kapatır. */
const ACTION_FRAME_CONTROL_BYTE0 = 0xd0;
/** `MANAGEMENT_SUBTYPE_NAMES.get(13) === 'Action'` (`dot11Frame.ts`). */
const MANAGEMENT_SUBTYPE_ACTION = 13;
const CATEGORY_VENDOR_SPECIFIC = 0x7f;
const ESPRESSIF_OUI_B0 = 0x18;
const ESPRESSIF_OUI_B1 = 0xfe;
const ESPRESSIF_OUI_B2 = 0x34;
const ESPRESSIF_OUI_TEXT = '18:FE:34';
const OUI_LENGTH = 3;
const RANDOM_VALUE_LENGTH = 4;
/** Category(1) + Organization Identifier(3) + Random Values(4). */
const ACTION_HEADER_LENGTH = 1 + OUI_LENGTH + RANDOM_VALUE_LENGTH;
const ELEMENT_ESPNOW_TYPE = 4;
/** Element gövdesindeki OUI(3) + Type(1) + Reserved/More/Version baytı(1). */
const ESPNOW_ELEMENT_PREFIX_LENGTH = OUI_LENGTH + 1 + 1;
// `ESP_NOW_MAX_DATA_LEN`. Not: `Length` TEK bayttır (azami 255), yani tek bir
// TLV element'inin gövdesi yapısal olarak zaten 255-5=250'yi AŞAMAZ — bu
// denetim pratikte hiçbir zaman TETİKLENMEZ (belgelenmiş sınırın kendisi
// tel biçimi tarafından zaten dayatılıyor). Yine de burada duruyor: hem
// brifin ZORUNLU tuttuğu bir denetim hem de savunma amaçlı — motorun bu
// varsayımı KAYDETMESİ, gelecekte `Length`in genişletildiği bir sürümde
// (belgelenmemiş) sessizce yanlış davranmaktan iyidir.
const ESPNOW_MAX_BODY_V1 = 250;
const ESPNOW_MAX_BODY_V2 = 1470; // `ESP_NOW_MAX_DATA_LEN_V2`
const ESPNOW_MAX_ELEMENTS = 6; // v2.0: 1470 + 6×7 = 1512

export const ESPNOW_VERSION_AUTO = 'auto';
export const ESPNOW_VERSION_V1 = 'v1';
export const ESPNOW_VERSION_V2 = 'v2';

export const PAYLOAD_SCHEMA_NONE = 'none';
export const PAYLOAD_SCHEMA_ASCII = 'ascii';
export const PAYLOAD_SCHEMA_HEX = 'hex';
export const PAYLOAD_SCHEMA_CUSTOM = 'custom';

export const UNKNOWN_VENDOR_ELEMENT_WARN = 'warn';
export const UNKNOWN_VENDOR_ELEMENT_RAW = 'raw';

// ── Küçük yardımcılar — `noUncheckedIndexedAccess` guard'ları ──────────────

function byteAt(data: Uint8Array, offset: number): number {
  return data[offset] ?? 0;
}

function bytesAt(data: Uint8Array, offset: number, length: number): Uint8Array {
  return data.slice(offset, offset + length);
}

function hexBytes(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).toUpperCase().padStart(2, '0')).join(' ');
}

function describeAsciiPayload(bytes: Uint8Array): string {
  let text = '';
  for (const byte of bytes) {
    text += byte >= 0x20 && byte < 0x7f ? String.fromCharCode(byte) : '.';
  }
  return text;
}

/** `payloadSchema` kanalının dört şıkkı — dördü de GERÇEKTEN farklı metin üretir. */
function formatPayload(bytes: Uint8Array, schema: string): string {
  if (schema === PAYLOAD_SCHEMA_ASCII) return `"${describeAsciiPayload(bytes)}"`;
  if (schema === PAYLOAD_SCHEMA_HEX) return hexBytes(bytes);
  if (schema === PAYLOAD_SCHEMA_CUSTOM) {
    return `${String(bytes.length)} B — application-defined payload, not interpreted (choose ascii/hex to view bytes)`;
  }
  return `${String(bytes.length)} B payload`;
}

// ── `canParse` — E1 ─────────────────────────────────────────────────────────

function checkEspNowEnvelope(data: Uint8Array): boolean {
  if (data.length < ESPNOW_MIN_FRAME_LENGTH) return false;
  if (byteAt(data, 0) !== ACTION_FRAME_CONTROL_BYTE0) return false;
  if ((byteAt(data, 1) & (FC_TO_DS_MASK | FC_FROM_DS_MASK)) !== 0) return false;
  if (byteAt(data, 24) !== CATEGORY_VENDOR_SPECIFIC) return false;
  if (byteAt(data, 25) !== ESPRESSIF_OUI_B0) return false;
  if (byteAt(data, 26) !== ESPRESSIF_OUI_B1) return false;
  if (byteAt(data, 27) !== ESPRESSIF_OUI_B2) return false;
  return true;
}

/**
 * **E4 — REDDEDİLEN naif imza**: yalnız `b[0] === 0xD0`. Ana brifte ölçüldü:
 * **3 / 899** çakışma (`sae-j1850-vpw`in üç örneği). Motorda KULLANILMAZ;
 * yalnız `espNowCanParseRegistry.test.ts`in "yazılsaydı çalardı" ayağı için
 * export edilir (`lonworks`in `hasNaiveLonTalkSignature` emsali).
 */
export function hasNaiveEspNowSignature(data: Uint8Array): boolean {
  return byteAt(data, 0) === ACTION_FRAME_CONTROL_BYTE0;
}

// ── `decodeOptions` ──────────────────────────────────────────────────────────

const OPTION_ESPNOW_VERSION = 'espNowVersion';
const OPTION_FCS_PRESENT = 'fcsPresent';
const OPTION_PAYLOAD_SCHEMA = 'payloadSchema';
const OPTION_UNKNOWN_VENDOR_ELEMENT_DISPLAY = 'unknownVendorElementDisplay';

const DECODE_OPTIONS: readonly DecodeOption[] = [
  {
    id: OPTION_ESPNOW_VERSION,
    label: `${TRANSLATION_KEY_PREFIX}.option.espNowVersion`,
    kind: 'select',
    defaultValue: ESPNOW_VERSION_AUTO,
    description: `${TRANSLATION_KEY_PREFIX}.option.espNowVersion.description`,
    choices: [
      { value: ESPNOW_VERSION_AUTO, label: `${TRANSLATION_KEY_PREFIX}.option.espNowVersion.auto` },
      { value: ESPNOW_VERSION_V1, label: `${TRANSLATION_KEY_PREFIX}.option.espNowVersion.v1` },
      { value: ESPNOW_VERSION_V2, label: `${TRANSLATION_KEY_PREFIX}.option.espNowVersion.v2` },
    ],
  },
  {
    id: OPTION_FCS_PRESENT,
    label: `${TRANSLATION_KEY_PREFIX}.option.fcsPresent`,
    kind: 'select',
    defaultValue: FCS_PRESENT_AUTO,
    description: `${TRANSLATION_KEY_PREFIX}.option.fcsPresent.description`,
    choices: [
      { value: FCS_PRESENT_AUTO, label: `${TRANSLATION_KEY_PREFIX}.option.fcsPresent.auto` },
      { value: FCS_PRESENT_YES, label: `${TRANSLATION_KEY_PREFIX}.option.fcsPresent.yes` },
      { value: FCS_PRESENT_NO, label: `${TRANSLATION_KEY_PREFIX}.option.fcsPresent.no` },
    ],
  },
  {
    id: OPTION_PAYLOAD_SCHEMA,
    label: `${TRANSLATION_KEY_PREFIX}.option.payloadSchema`,
    kind: 'select',
    defaultValue: PAYLOAD_SCHEMA_NONE,
    description: `${TRANSLATION_KEY_PREFIX}.option.payloadSchema.description`,
    choices: [
      { value: PAYLOAD_SCHEMA_NONE, label: `${TRANSLATION_KEY_PREFIX}.option.payloadSchema.none` },
      { value: PAYLOAD_SCHEMA_ASCII, label: `${TRANSLATION_KEY_PREFIX}.option.payloadSchema.ascii` },
      { value: PAYLOAD_SCHEMA_HEX, label: `${TRANSLATION_KEY_PREFIX}.option.payloadSchema.hex` },
      { value: PAYLOAD_SCHEMA_CUSTOM, label: `${TRANSLATION_KEY_PREFIX}.option.payloadSchema.custom` },
    ],
  },
  {
    id: OPTION_UNKNOWN_VENDOR_ELEMENT_DISPLAY,
    label: `${TRANSLATION_KEY_PREFIX}.option.unknownVendorElementDisplay`,
    kind: 'select',
    defaultValue: UNKNOWN_VENDOR_ELEMENT_WARN,
    description: `${TRANSLATION_KEY_PREFIX}.option.unknownVendorElementDisplay.description`,
    choices: [
      {
        value: UNKNOWN_VENDOR_ELEMENT_WARN,
        label: `${TRANSLATION_KEY_PREFIX}.option.unknownVendorElementDisplay.warn`,
      },
      {
        value: UNKNOWN_VENDOR_ELEMENT_RAW,
        label: `${TRANSLATION_KEY_PREFIX}.option.unknownVendorElementDisplay.raw`,
      },
    ],
  },
];

function readSelect(
  options: Record<string, unknown> | undefined,
  optionId: string,
  fallback: string,
): string {
  const raw = options?.[optionId];
  if (typeof raw !== 'string') return fallback;
  const option = DECODE_OPTIONS.find((candidate) => candidate.id === optionId);
  return option?.choices?.some((choice) => choice.value === raw) === true ? raw : fallback;
}

interface EspNowBodyOptions {
  readonly espNowVersion: string;
  readonly payloadSchema: string;
  readonly unknownVendorElementDisplay: string;
}

// ── Vendor element yorumu — ESP-NOW'a ÖZEL, `dot11Elements.ts`e GİRMEZ ─────

type EspNowElementVersion = 'v1' | 'v2' | 'unknown';

function deriveEspNowVersion(nibble: number, forced: string): EspNowElementVersion {
  if (forced === ESPNOW_VERSION_V1) return 'v1';
  if (forced === ESPNOW_VERSION_V2) return 'v2';
  // `auto`: nibble'IN KENDİSİ sürüm göstergesidir (Espressif'in dokümante
  // ettiği tek iki değer). Diğer her nibble BELGESİZDİR — HAM bırakılır.
  if (nibble === 0) return 'v1';
  if (nibble === 1) return 'v2';
  return 'unknown';
}

interface EspNowElementResult {
  readonly counted: boolean;
  readonly version: EspNowElementVersion | undefined;
  readonly bodyBytes: Uint8Array | undefined;
}

/**
 * Tek bir vendor-specific element'i (ID 221) yorumlar. `walkDot11Elements`in
 * verdiği `element.data` YALNIZ okunur, hiçbir şey uydurulmaz: OUI/Type
 * eşleşmiyorsa element HAM basılır ve `counted: false` döner — payload
 * birleştirmesine (More data zinciri) KATILMAZ.
 */
function processVendorElement(
  data: Uint8Array,
  sink: FieldSink,
  warnings: ProtocolWarning[],
  element: Dot11Element,
  index: number,
  options: EspNowBodyOptions,
): EspNowElementResult {
  const label = `ESP-NOW · Vendor Element ${String(index)}`;
  const elementSpan = 2 + element.length;

  if (element.data.length < OUI_LENGTH + 1) {
    pushField(sink, {
      id: `espnow-element-${String(index)}`,
      name: label,
      offset: element.offset,
      length: elementSpan,
      rawBytes: bytesAt(data, element.offset, elementSpan),
      rawValue: hexBytes(element.data),
      physicalValue: `${String(element.data.length)} B too short for OUI + Type`,
      valid: false,
      warnings: [FIELD_WARN_ELEMENT_TOO_SHORT],
    });
    return { counted: false, version: undefined, bodyBytes: undefined };
  }

  const ouiBytes = element.data.slice(0, OUI_LENGTH);
  const isEspressifOui =
    byteAt(ouiBytes, 0) === ESPRESSIF_OUI_B0 &&
    byteAt(ouiBytes, 1) === ESPRESSIF_OUI_B1 &&
    byteAt(ouiBytes, 2) === ESPRESSIF_OUI_B2;
  const vendorType = byteAt(element.data, OUI_LENGTH);

  if (!isEspressifOui || vendorType !== ELEMENT_ESPNOW_TYPE) {
    const flagged = options.unknownVendorElementDisplay === UNKNOWN_VENDOR_ELEMENT_WARN;
    pushField(sink, {
      id: `espnow-element-${String(index)}`,
      name: label,
      offset: element.offset,
      length: elementSpan,
      rawBytes: bytesAt(data, element.offset, elementSpan),
      rawValue: hexBytes(element.data),
      physicalValue: `OUI ${hexBytes(ouiBytes)}, type ${String(vendorType)} — not Espressif's ESP-NOW (${ESPRESSIF_OUI_TEXT}, type ${String(ELEMENT_ESPNOW_TYPE)})${flagged ? ', flagged' : ''}`,
      valid: true,
      warnings: flagged ? [FIELD_WARN_FOREIGN_VENDOR_ELEMENT] : [],
    });
    if (flagged) {
      warnings.push({
        code: 'foreignVendorElement',
        message: WARN_FOREIGN_VENDOR_ELEMENT,
        offset: element.offset,
        length: elementSpan,
      });
    }
    return { counted: false, version: undefined, bodyBytes: undefined };
  }

  if (element.data.length < ESPNOW_ELEMENT_PREFIX_LENGTH) {
    pushField(sink, {
      id: `espnow-element-${String(index)}`,
      name: label,
      offset: element.offset,
      length: elementSpan,
      rawBytes: bytesAt(data, element.offset, elementSpan),
      rawValue: hexBytes(element.data),
      physicalValue: `OUI ${ESPRESSIF_OUI_TEXT}, type ${String(ELEMENT_ESPNOW_TYPE)} but ${String(element.data.length)} B too short for the version byte`,
      valid: false,
      warnings: [FIELD_WARN_ELEMENT_TOO_SHORT],
    });
    return { counted: false, version: undefined, bodyBytes: undefined };
  }

  pushField(sink, {
    id: `espnow-element-${String(index)}-id`,
    name: `${label} · Element ID`,
    offset: element.offset,
    length: 1,
    rawBytes: bytesAt(data, element.offset, 1),
    rawValue: element.id,
    physicalValue: 'Vendor Specific (221)',
    valid: true,
    warnings: [],
  });
  pushField(sink, {
    id: `espnow-element-${String(index)}-length`,
    name: `${label} · Length`,
    offset: element.offset + 1,
    length: 1,
    rawBytes: bytesAt(data, element.offset + 1, 1),
    rawValue: element.length,
    physicalValue: `OUI + Type + Version + ${String(element.data.length - ESPNOW_ELEMENT_PREFIX_LENGTH)} B body`,
    valid: true,
    warnings: [],
  });
  pushField(sink, {
    id: `espnow-element-${String(index)}-oui`,
    name: `${label} · Organization Identifier`,
    offset: element.dataOffset,
    length: OUI_LENGTH,
    rawBytes: bytesAt(data, element.dataOffset, OUI_LENGTH),
    rawValue: hexBytes(ouiBytes),
    physicalValue: 'Espressif Systems',
    valid: true,
    warnings: [],
  });
  pushField(sink, {
    id: `espnow-element-${String(index)}-type`,
    name: `${label} · Type`,
    offset: element.dataOffset + OUI_LENGTH,
    length: 1,
    rawBytes: bytesAt(data, element.dataOffset + OUI_LENGTH, 1),
    rawValue: vendorType,
    physicalValue: 'ESP-NOW',
    valid: true,
    warnings: [],
  });

  const versionByteOffset = element.dataOffset + OUI_LENGTH + 1;
  const verByte = byteAt(element.data, OUI_LENGTH + 1);
  const versionNibble = verByte & 0x0f;
  const version = deriveEspNowVersion(versionNibble, options.espNowVersion);

  if (version === 'unknown') {
    pushField(sink, {
      id: `espnow-element-${String(index)}-version-byte`,
      name: `${label} · Reserved / More data / Version (undocumented nibble)`,
      offset: versionByteOffset,
      length: 1,
      rawBytes: bytesAt(data, versionByteOffset, 1),
      rawValue: verByte,
      physicalValue: `version nibble ${String(versionNibble)} is neither the documented v1.0 (0) nor v2.0 (1) — Reserved/More data bits left undecoded`,
      valid: true,
      warnings: [FIELD_WARN_VERSION_UNRECOGNIZED],
    });
    warnings.push({
      code: 'unrecognizedVersion',
      message: WARN_VERSION_UNRECOGNIZED,
      offset: versionByteOffset,
      length: 1,
    });
  } else if (version === 'v2') {
    const reserved = (verByte >> 5) & 0x07;
    const moreData = ((verByte >> 4) & 0x01) === 1;
    pushField(sink, {
      id: `espnow-element-${String(index)}-reserved`,
      name: `${label} · Reserved (v2.0, bits 7-5)`,
      offset: versionByteOffset,
      length: 1,
      rawBytes: bytesAt(data, versionByteOffset, 1),
      rawValue: reserved,
      physicalValue: `0b${reserved.toString(2).padStart(3, '0')}`,
      valid: true,
      warnings: [],
    });
    pushField(sink, {
      id: `espnow-element-${String(index)}-more-data`,
      name: `${label} · More data (v2.0, bit 4)`,
      offset: versionByteOffset,
      length: 1,
      rawBytes: bytesAt(data, versionByteOffset, 1),
      rawValue: moreData ? 1 : 0,
      physicalValue: moreData ? 'more elements follow in this frame' : 'last element of this payload',
      valid: true,
      warnings: [],
    });
    pushField(sink, {
      id: `espnow-element-${String(index)}-version`,
      name: `${label} · Version (bits 3-0)`,
      offset: versionByteOffset,
      length: 1,
      rawBytes: bytesAt(data, versionByteOffset, 1),
      rawValue: versionNibble,
      physicalValue: 'v2.0',
      valid: true,
      warnings: [],
    });
  } else {
    const reserved = (verByte >> 4) & 0x0f;
    pushField(sink, {
      id: `espnow-element-${String(index)}-reserved`,
      name: `${label} · Reserved (v1.0, bits 7-4)`,
      offset: versionByteOffset,
      length: 1,
      rawBytes: bytesAt(data, versionByteOffset, 1),
      rawValue: reserved,
      physicalValue: `0b${reserved.toString(2).padStart(4, '0')}`,
      valid: true,
      warnings: [],
    });
    pushField(sink, {
      id: `espnow-element-${String(index)}-version`,
      name: `${label} · Version (bits 3-0)`,
      offset: versionByteOffset,
      length: 1,
      rawBytes: bytesAt(data, versionByteOffset, 1),
      rawValue: versionNibble,
      physicalValue: 'v1.0',
      valid: true,
      warnings: [],
    });
  }

  const bodyOffset = versionByteOffset + 1;
  const bodyBytes = element.data.slice(OUI_LENGTH + 2);
  pushField(sink, {
    id: `espnow-element-${String(index)}-body`,
    name: `${label} · Body`,
    offset: bodyOffset,
    length: bodyBytes.length,
    rawBytes: bodyBytes,
    rawValue: hexBytes(bodyBytes),
    physicalValue: formatPayload(bodyBytes, options.payloadSchema),
    valid: true,
    warnings: [],
  });

  return { counted: true, version, bodyBytes };
}

/**
 * Action gövdesini çözer: Category → OUI → Random Value → element zinciri.
 * Yalnız `header.protectedFrame === false` VE alt tip Action İKEN çağrılır
 * (çağıran kapıyı tutar); burada TEKRAR kontrol edilmesinin sebebi `parse`in
 * `canParse`tan BAĞIMSIZ çağrılabilmesidir (kullanıcı sayfayı kendisi açar).
 */
function decodeEspNowBody(
  data: Uint8Array,
  sink: FieldSink,
  warnings: ProtocolWarning[],
  errors: ProtocolError[],
  header: Dot11HeaderSummary,
  options: EspNowBodyOptions,
): void {
  if (header.frameControl.type !== DOT11_TYPE_MANAGEMENT || header.frameControl.subtype !== MANAGEMENT_SUBTYPE_ACTION) {
    const bodyBytes = bytesAt(data, header.bodyOffset, header.bodyLength);
    pushField(sink, {
      id: 'espnow-body',
      name: 'ESP-NOW · Body (not an Action frame)',
      offset: header.bodyOffset,
      length: header.bodyLength,
      rawBytes: bodyBytes,
      rawValue: hexBytes(bodyBytes),
      physicalValue: `subtype ${String(header.frameControl.subtype)} is not Action (13) — ESP-NOW body not attempted`,
      valid: true,
      warnings: [FIELD_WARN_NOT_ACTION_FRAME],
    });
    warnings.push({ code: 'notActionFrame', message: WARN_NOT_ACTION_FRAME, offset: header.bodyOffset, length: header.bodyLength });
    return;
  }

  if (header.bodyLength < ACTION_HEADER_LENGTH) {
    const bodyBytes = bytesAt(data, header.bodyOffset, header.bodyLength);
    pushField(sink, {
      id: 'espnow-body',
      name: 'ESP-NOW · Body (truncated)',
      offset: header.bodyOffset,
      length: header.bodyLength,
      rawBytes: bodyBytes,
      rawValue: hexBytes(bodyBytes),
      physicalValue: `${String(header.bodyLength)} B — too short for Category + Organization Identifier + Random Values (${String(ACTION_HEADER_LENGTH)} B)`,
      valid: false,
      warnings: [FIELD_WARN_NOT_ACTION_FRAME],
    });
    errors.push({
      code: 'truncated-frame',
      message: ERROR_BODY_TOO_SHORT,
      offset: header.bodyOffset,
      length: header.bodyLength,
    });
    return;
  }

  const category = byteAt(data, header.bodyOffset);
  const categoryValid = category === CATEGORY_VENDOR_SPECIFIC;
  pushField(sink, {
    id: 'espnow-category',
    name: 'ESP-NOW · Category Code',
    offset: header.bodyOffset,
    length: 1,
    rawBytes: bytesAt(data, header.bodyOffset, 1),
    rawValue: category,
    physicalValue: categoryValid ? 'Vendor Specific (127)' : `${String(category)} (expected 127)`,
    valid: categoryValid,
    warnings: categoryValid ? [] : [FIELD_WARN_CATEGORY_INVALID],
  });
  if (!categoryValid) {
    warnings.push({
      code: 'categoryNotVendorSpecific',
      message: WARN_CATEGORY_NOT_VENDOR_SPECIFIC,
      offset: header.bodyOffset,
      length: 1,
    });
    return;
  }

  const ouiOffset = header.bodyOffset + 1;
  const ouiBytes = bytesAt(data, ouiOffset, OUI_LENGTH);
  const ouiValid =
    byteAt(ouiBytes, 0) === ESPRESSIF_OUI_B0 &&
    byteAt(ouiBytes, 1) === ESPRESSIF_OUI_B1 &&
    byteAt(ouiBytes, 2) === ESPRESSIF_OUI_B2;
  pushField(sink, {
    id: 'espnow-oui',
    name: 'ESP-NOW · Organization Identifier',
    offset: ouiOffset,
    length: OUI_LENGTH,
    rawBytes: ouiBytes,
    rawValue: hexBytes(ouiBytes),
    physicalValue: ouiValid ? 'Espressif Systems' : 'not Espressif',
    valid: ouiValid,
    warnings: ouiValid ? [] : [FIELD_WARN_OUI_NOT_ESPRESSIF],
  });
  if (!ouiValid) {
    warnings.push({
      code: 'actionOuiNotEspressif',
      message: WARN_ACTION_OUI_NOT_ESPRESSIF,
      offset: ouiOffset,
      length: OUI_LENGTH,
    });
    errors.push({
      code: 'unsupported-encoding',
      message: ERROR_NO_ESPNOW_ELEMENT,
      offset: ouiOffset,
      length: OUI_LENGTH,
    });
    return;
  }

  const randomOffset = ouiOffset + OUI_LENGTH;
  pushField(sink, {
    id: 'espnow-random-value',
    name: 'ESP-NOW · Random Value',
    offset: randomOffset,
    length: RANDOM_VALUE_LENGTH,
    rawBytes: bytesAt(data, randomOffset, RANDOM_VALUE_LENGTH),
    rawValue: hexBytes(bytesAt(data, randomOffset, RANDOM_VALUE_LENGTH)),
    // Tekrar saldırısı önleme nonce'u — çerçeveler arası doğrulama KAPSAM
    // DIŞI (dosya başı, "KANAL YAPILMAYACAKLAR").
    physicalValue: `${String(RANDOM_VALUE_LENGTH)} B anti-replay nonce (not validated — cross-frame state)`,
    valid: true,
    warnings: [],
  });

  const elementsStart = header.bodyOffset + ACTION_HEADER_LENGTH;
  const elementsEnd = header.bodyOffset + header.bodyLength;
  const walk = walkDot11Elements(data, elementsStart, elementsEnd);

  let espNowElementCount = 0;
  let anyV1Oversize = false;
  let anyV2 = false;
  let totalBodyBytes = 0;
  const payloadParts: Uint8Array[] = [];

  walk.elements.forEach((element, index) => {
    if (element.id !== ELEMENT_VENDOR_SPECIFIC) {
      const elementSpan = 2 + element.length;
      pushField(sink, {
        id: `espnow-element-${String(index)}`,
        name: `ESP-NOW · Element ${String(index)} (unexpected ID ${String(element.id)})`,
        offset: element.offset,
        length: elementSpan,
        rawBytes: bytesAt(data, element.offset, elementSpan),
        rawValue: hexBytes(element.data),
        physicalValue: `${String(elementSpan)} B — ESP-NOW's vendor content is a chain of Element ID 221 only`,
        valid: true,
        warnings: [FIELD_WARN_ELEMENT_UNRECOGNIZED],
      });
      warnings.push({
        code: 'unrecognizedElement',
        message: WARN_UNRECOGNIZED_ELEMENT,
        offset: element.offset,
        length: elementSpan,
      });
      return;
    }

    const result = processVendorElement(data, sink, warnings, element, index, options);
    if (!result.counted || result.bodyBytes === undefined) return;

    espNowElementCount += 1;
    totalBodyBytes += result.bodyBytes.length;
    payloadParts.push(result.bodyBytes);
    if (result.version === 'v2') anyV2 = true;
    if (result.version === 'v1' && result.bodyBytes.length > ESPNOW_MAX_BODY_V1) {
      anyV1Oversize = true;
    }
  });

  // Sınır uyarıları ÇERÇEVE BAŞINA basılır, element başına DEĞİL — on
  // element'lik bir zincirde aynı cümleyi tekrarlamak uyarı listesini
  // kullanılmaz hâle getirirdi (dalga 13'ün "nabız konteyneri" dersi).
  if (anyV1Oversize) {
    warnings.push({
      code: 'payloadOversizeV1',
      message: WARN_PAYLOAD_OVERSIZE_V1,
      offset: elementsStart,
      length: elementsEnd - elementsStart,
    });
  }

  if (walk.trailingLength > 0) {
    pushField(sink, {
      id: 'espnow-element-trailing',
      name: 'ESP-NOW · element chain · trailing bytes',
      offset: walk.trailingOffset,
      length: walk.trailingLength,
      rawBytes: bytesAt(data, walk.trailingOffset, walk.trailingLength),
      rawValue: hexBytes(bytesAt(data, walk.trailingOffset, walk.trailingLength)),
      physicalValue: `${String(walk.trailingLength)} B do not form a complete Element ID / Length / Data triple`,
      valid: false,
      warnings: [FIELD_WARN_TRAILING_BYTES],
    });
    warnings.push({
      code: 'elementChainTruncated',
      message: WARN_ELEMENT_CHAIN_TRUNCATED,
      offset: walk.trailingOffset,
      length: walk.trailingLength,
    });
    errors.push({
      code: 'length-mismatch',
      message: ERROR_ELEMENT_LENGTH_EXCEEDS_FRAME,
      offset: walk.trailingOffset,
      length: walk.trailingLength,
    });
  } else if (espNowElementCount === 0) {
    warnings.push({
      code: 'noEspNowElementFound',
      message: WARN_NO_ESPNOW_ELEMENT,
      offset: elementsStart,
      length: elementsEnd - elementsStart,
    });
    errors.push({
      code: 'unsupported-encoding',
      message: ERROR_NO_ESPNOW_ELEMENT,
      offset: elementsStart,
      length: elementsEnd - elementsStart,
    });
  }

  if (espNowElementCount > 1) {
    const combined = new Uint8Array(totalBodyBytes);
    let cursor = 0;
    for (const part of payloadParts) {
      combined.set(part, cursor);
      cursor += part.length;
    }
    // `offset`/`length`/`rawBytes` ELEMENT ZİNCİRİNİN TAMAMINI (başlıklar
    // dahil) kapsar — `combined` element başlıklarıyla ARAYA GİRDİĞİ için
    // gerçekte AYRIK baytlardan oluşuyor ve tek bir bitişik aralık değil.
    // `rawBytes.length === length` değişmezini KORUMAK için burayı bölge
    // sınırlarıyla eşliyoruz; ANLAMLI değer (`rawValue`/`physicalValue`)
    // yine yalnız birleştirilmiş yük baytlarını gösterir.
    pushField(sink, {
      id: 'espnow-payload-assembled',
      name: `ESP-NOW · Application Payload (${String(espNowElementCount)} elements combined)`,
      offset: elementsStart,
      length: elementsEnd - elementsStart,
      rawBytes: bytesAt(data, elementsStart, elementsEnd - elementsStart),
      rawValue: hexBytes(combined),
      // Çerçeve İÇİ birleştirme: "çerçeveler arası durum PARSER'A GİRMEZ"
      // kuralı BURAYA UYGULANMAZ — hepsi AYNI çerçevede, tek `parse` çağrısı.
      physicalValue: formatPayload(combined, options.payloadSchema),
      valid: true,
      warnings: [],
    });
  }

  if (anyV2 && totalBodyBytes > ESPNOW_MAX_BODY_V2) {
    warnings.push({
      code: 'payloadOversizeV2',
      message: WARN_PAYLOAD_OVERSIZE_V2,
      offset: elementsStart,
      length: elementsEnd - elementsStart,
    });
  }
  if (espNowElementCount > ESPNOW_MAX_ELEMENTS) {
    warnings.push({
      code: 'tooManyElements',
      message: WARN_TOO_MANY_ELEMENTS,
      offset: elementsStart,
      length: elementsEnd - elementsStart,
    });
  }
}

// ── Çözüm ─────────────────────────────────────────────────────────────────

function parseEspNow(data: Uint8Array, context?: ParseContext): ParseResult {
  if (context?.signal?.aborted === true) {
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

  const maxFrameLength = context?.maxFrameLength;
  if (maxFrameLength !== undefined && data.length > maxFrameLength) {
    return {
      success: false,
      error: {
        code: 'frame-too-long',
        message: ERROR_FRAME_TOO_LONG,
        offset: maxFrameLength,
        length: data.length - maxFrameLength,
        details: { maxFrameLength, frameLength: data.length },
      },
      consumedBytes: 0,
      recoverable: false,
    };
  }

  const options = context?.options;
  const fcsOption = readSelect(options, OPTION_FCS_PRESENT, FCS_PRESENT_AUTO);
  const bodyOptions: EspNowBodyOptions = {
    espNowVersion: readSelect(options, OPTION_ESPNOW_VERSION, ESPNOW_VERSION_AUTO),
    payloadSchema: readSelect(options, OPTION_PAYLOAD_SCHEMA, PAYLOAD_SCHEMA_NONE),
    unknownVendorElementDisplay: readSelect(
      options,
      OPTION_UNKNOWN_VENDOR_ELEMENT_DISPLAY,
      UNKNOWN_VENDOR_ELEMENT_WARN,
    ),
  };
  const headerOptions: Dot11DecodeOptions = { ...DOT11_DEFAULT_OPTIONS, fcsPresent: fcsOption };

  const sink = createFieldSink();
  const errors: ProtocolError[] = [];
  const warnings: ProtocolWarning[] = [];

  const header = decodeDot11Header(data, sink, warnings, errors, headerOptions);

  // Girdi sözleşmesi `wifi` ile AYNI (`[KARAR 18-2]`): her çözümde AÇIKÇA
  // söylenir, kullanıcı radiotap'li bir çerçeve yapıştırırsa nedenini görür.
  warnings.push({ code: 'radiotapOutOfScope', message: WARN_RADIOTAP_OUT_OF_SCOPE });

  if (header.readable && header.bodyLength > 0) {
    if (header.protectedFrame) {
      // KAPI — `Protected = 1` ⇒ ÖTEYE İNİLMEZ. Category baytı bile
      // şifrelenmiş gövdenin İÇİNDEDİR (dosya başı); UYDURULMAZ.
      const bodyBytes = bytesAt(data, header.bodyOffset, header.bodyLength);
      pushField(sink, {
        id: 'espnow-body',
        name: 'ESP-NOW · Body (encrypted)',
        offset: header.bodyOffset,
        length: header.bodyLength,
        rawBytes: bodyBytes,
        physicalValue: `encrypted payload, ${String(header.bodyLength)} B — protected, ESP-NOW cannot be confirmed from the frame, not decoded`,
        valid: true,
        warnings: [FIELD_WARN_ENCRYPTED],
      });
      warnings.push({
        code: 'encryptedPayload',
        message: WARN_ENCRYPTED_PAYLOAD,
        offset: header.bodyOffset,
        length: header.bodyLength,
      });
    } else {
      decodeEspNowBody(data, sink, warnings, errors, header, bodyOptions);
    }
  }

  // FCS bir KUYRUKTUR: gövdeden SONRA basılır (`pushDot11Fcs`in gerekçesi).
  pushDot11Fcs(data, sink, warnings, errors, header, headerOptions);

  const rawFrame = createRawFrame(data, {
    ...(context?.timestamp === undefined ? {} : { timestamp: context.timestamp }),
    ...(context?.direction === undefined ? {} : { direction: context.direction }),
    ...(context?.channel === undefined ? {} : { channel: context.channel }),
  });

  const frame: ParsedFrame = {
    protocol: PROTOCOL_ID,
    timestamp: rawFrame.timestamp,
    rawFrame,
    fields: sink.fields,
    valid: errors.length === 0,
    errors,
    warnings,
  };
  return { success: true, frame, consumedBytes: data.length };
}

export const espNowParser: ProtocolParser = {
  protocolId: PROTOCOL_ID,
  displayName: PROTOCOL_DISPLAY_NAME,

  /**
   * `true` DÖNER — imza E1, ana brifte ölçülmüş karar (dosya başı).
   * Korumalı bir ESP-NOW çerçevesi bu kapıyı GEÇEMEZ (Category baytı
   * şifreli gövdenin içinde) — bekçi testi bunu AÇIKÇA `false` bekleyerek
   * sınar, sessizce atlamaz.
   */
  canParse(data: Uint8Array): boolean {
    return checkEspNowEnvelope(data);
  },

  parse(data: Uint8Array, context?: ParseContext): ParseResult {
    return parseEspNow(data, context);
  },
};

// ── Örnekler ─────────────────────────────────────────────────────────────
// Beşi `docs/brief-faz10-dalga18c.md`ten TÜRETİLDİ: alan yerleşimi brifin
// Espressif alıntısından, FCS'ler bu turda `withRecomputedFcs` ile YENİDEN
// hesaplandı (brifin elle verdiği FCS baytları KOPYALANMADI — dalga 17
// dersi: "keşfin elle çözdüğü her çerçeve şüphelidir"). Altıncısı
// (`real-capture-hello`) GERÇEK: `espressif/esp-idf#2833`teki ESP32
// yakalamasının radiotap'i soyulmuş hâli (dosya başı belgeli); o çerçevede
// de FCS capture'da YOKTU, aynı yöntemle YENİDEN hesaplanıp EKLENDİ.

function hexToBytes(hex: string): Uint8Array {
  const parts = hex.trim().split(/\s+/);
  const bytes = new Uint8Array(parts.length);
  for (let index = 0; index < parts.length; index += 1) {
    bytes[index] = Number.parseInt(parts[index] ?? '0', 16) & 0xff;
  }
  return bytes;
}

/** Türetilen çerçevenin FCS'i ASLA elle yazılmaz; motorun kendi CRC'siyle üretilir. */
function withRecomputedFcs(headerAndBody: Uint8Array): Uint8Array {
  const frame = new Uint8Array(headerAndBody.length + DOT11_FCS_LENGTH);
  frame.set(headerAndBody, 0);
  const fcs = Number(computeNamedCrc(headerAndBody, 'CRC32')) >>> 0;
  frame[headerAndBody.length] = fcs & 0xff;
  frame[headerAndBody.length + 1] = (fcs >>> 8) & 0xff;
  frame[headerAndBody.length + 2] = (fcs >>> 16) & 0xff;
  frame[headerAndBody.length + 3] = (fcs >>> 24) & 0xff;
  return frame;
}

/** v1.0 yayın, TEK element, şifresiz — 55 B. Gövde `"ALP Comm 18c"`. */
const FRAME_BROADCAST_SINGLE_ELEMENT = withRecomputedFcs(
  hexToBytes(
    'd0 00 00 00 ff ff ff ff ff ff 24 6f 28 a1 b2 c3 ff ff ff ff ff ff 10 00 ' +
      '7f 18 fe 34 de ad be ef dd 11 18 fe 34 04 00 41 4c 50 20 43 6f 6d 6d 20 31 38 63',
  ),
);

/** v2.0 tekli-hedef (unicast), İKİ element, ilkinde `More data = 1` — 78 B. */
const FRAME_UNICAST_TWO_ELEMENTS = withRecomputedFcs(
  hexToBytes(
    'd0 00 3a 01 30 ae a4 11 22 33 24 6f 28 a1 b2 c3 ff ff ff ff ff ff 20 00 ' +
      '7f 18 fe 34 01 23 45 67 dd 19 18 fe 34 04 11 40 41 42 43 44 45 46 47 48 ' +
      '49 4a 4b 4c 4d 4e 4f 50 51 52 53 dd 0d 18 fe 34 04 01 60 61 62 63 64 65 66 67',
  ),
);

/** Korumalı (CCMP) — 60 B. `canParse` `false` döner, gövde ÇÖZÜLMEZ. */
const FRAME_PROTECTED = withRecomputedFcs(
  hexToBytes(
    'd0 40 3a 01 30 ae a4 11 22 33 24 6f 28 a1 b2 c3 ff ff ff ff ff ff 30 00 ' +
      '0b 00 20 00 00 00 00 00 9a 4c 1f d3 77 02 be 51 64 30 c8 aa 1d 9e 42 76 11 22 33 44 55 66 77 88',
  ),
);

/** BOZUK: vendor element'in OUI'si Espressif DEĞİL (`00:50:F2`) — 48 B. */
const FRAME_FOREIGN_VENDOR_OUI = withRecomputedFcs(
  hexToBytes(
    'd0 00 00 00 ff ff ff ff ff ff 24 6f 28 a1 b2 c3 ff ff ff ff ff ff 40 00 ' +
      '7f 18 fe 34 de ad be ef dd 0a 00 50 f2 04 00 58 58 58 58 58',
  ),
);

/** BOZUK: element `Length` (0xF0 = 240) çerçeveyi aşıyor — 47 B. */
const FRAME_TRUNCATED_ELEMENT_LENGTH = withRecomputedFcs(
  hexToBytes(
    'd0 00 00 00 ff ff ff ff ff ff 24 6f 28 a1 b2 c3 ff ff ff ff ff ff 50 00 ' +
      '7f 18 fe 34 de ad be ef dd f0 18 fe 34 04 00 6b 69 73 61',
  ),
);

/**
 * GERÇEK — `espressif/esp-idf#2833`, ilk çerçeve (radiotap 18 B soyuldu).
 * Capture'da FCS YOKTU (issue'nun ikinci bulgusu); burada YENİDEN
 * hesaplanıp eklendi. Gövde `"Hello"` + belgelenmemiş 4 bayt — o dört bayt
 * UYDURULMADI, `payloadSchema = ascii`de olduğu gibi ham görünür.
 */
const FRAME_REAL_CAPTURE_HELLO = withRecomputedFcs(
  hexToBytes(
    'd0 08 3a 01 36 33 33 33 33 33 86 0d 8e 85 f5 c4 36 33 33 33 33 33 c0 5b ' +
      '7f 18 fe 34 75 a0 d8 cb dd 0e 18 fe 34 04 01 48 65 6c 6c 6f c7 db 01 44',
  ),
);

const EXAMPLE_FRAMES: ExampleFrame[] = [
  {
    id: 'broadcast-single-element',
    name: `${TRANSLATION_KEY_PREFIX}.example.broadcastSingleElement.name`,
    bytes: FRAME_BROADCAST_SINGLE_ELEMENT,
    description: `${TRANSLATION_KEY_PREFIX}.example.broadcastSingleElement.description`,
    expectedValid: true,
  },
  {
    id: 'unicast-two-elements',
    name: `${TRANSLATION_KEY_PREFIX}.example.unicastTwoElements.name`,
    bytes: FRAME_UNICAST_TWO_ELEMENTS,
    description: `${TRANSLATION_KEY_PREFIX}.example.unicastTwoElements.description`,
    expectedValid: true,
  },
  {
    id: 'protected',
    name: `${TRANSLATION_KEY_PREFIX}.example.protected.name`,
    bytes: FRAME_PROTECTED,
    description: `${TRANSLATION_KEY_PREFIX}.example.protected.description`,
    expectedValid: true,
  },
  {
    id: 'foreign-vendor-oui',
    name: `${TRANSLATION_KEY_PREFIX}.example.foreignVendorOui.name`,
    bytes: FRAME_FOREIGN_VENDOR_OUI,
    description: `${TRANSLATION_KEY_PREFIX}.example.foreignVendorOui.description`,
    expectedValid: false,
  },
  {
    id: 'truncated-element-length',
    name: `${TRANSLATION_KEY_PREFIX}.example.truncatedElementLength.name`,
    bytes: FRAME_TRUNCATED_ELEMENT_LENGTH,
    description: `${TRANSLATION_KEY_PREFIX}.example.truncatedElementLength.description`,
    expectedValid: false,
  },
  {
    id: 'real-capture-hello',
    name: `${TRANSLATION_KEY_PREFIX}.example.realCaptureHello.name`,
    bytes: FRAME_REAL_CAPTURE_HELLO,
    description: `${TRANSLATION_KEY_PREFIX}.example.realCaptureHello.description`,
    expectedValid: true,
  },
];

export const espNowPlugin: ProtocolPlugin = {
  id: PROTOCOL_ID,
  name: PROTOCOL_DISPLAY_NAME,
  category: 'wireless-iot',
  parser: espNowParser,
  // 'build' sekmesi YOK (katalog) → `encoder` YAZILMAZ (dalga 16 bulgu 11 emsali).
  documentation: {
    summary: `${TRANSLATION_KEY_PREFIX}.documentation.summary`,
    layer: 'data-link',
    references: [
      {
        title:
          'ESP-IDF Programming Guide — ESP-NOW → Frame Format: the byte-exact Category/Organization Identifier/Random Values/Vendor Specific Content/FCS schema this module implements',
        url: 'https://docs.espressif.com/projects/esp-idf/en/stable/esp32/api-reference/network/esp_now.html',
      },
      {
        title:
          'esp-idf/components/esp_wifi/include/esp_now.h (Apache-2.0) — ESP_NOW_MAX_DATA_LEN / _V2 and ESP_NOW_MAX_IE_DATA_LEN, the source of the 250 B / 1470 B / 6-element limits this page warns about',
        url: 'https://github.com/espressif/esp-idf/blob/master/components/esp_wifi/include/esp_now.h',
      },
      {
        title:
          'espressif/esp-idf issue #2833 (IDFGH-503, 2018) — two real ESP32 monitor-mode captures as hex dumps; this page\'s "real-capture-hello" example is the first one with radiotap stripped and the FCS (absent in the capture) recomputed',
        url: 'https://github.com/espressif/esp-idf/issues/2833',
      },
      {
        title:
          'IEEE Registration Authority MA-L (OUI) public listing — confirms 18:FE:34 as an Espressif Systems assignment',
        url: 'https://standards-oui.ieee.org/oui/oui.csv',
      },
    ],
  },
  exampleFrames: EXAMPLE_FRAMES,
  decodeOptions: DECODE_OPTIONS,
};
