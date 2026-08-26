/**
 * Thread — 802.15.4 → 6LoWPAN → IPv6 → UDP → **MLE sınıflandırması**
 * (Faz 10, dalga 18d; `[KARAR 18-3]`).
 *
 * Bu dosya yalnız eklentiyi kurar: `canParse`, YEDİ `decodeOptions` kanalı,
 * on örnek çerçeve ve katmanların SIRASI. Motor DÖRT modüldedir ve üçü bu
 * kayda, biri TÜM 802.15.4 tüketicilerine aittir:
 *   · `protocol-core/framing/ieee802154Frame.ts` — MAC **KONTEYNERİ**,
 *     `zigbee` ile PAYLAŞILAN çekirdek (`[KARAR 18-1]`, dalga 18d Görev 0),
 *   · `thread/auxSecurityHeader.ts` — Auxiliary Security Header (MAC + MLE),
 *   · `thread/lowpan.ts`            — dispatch zinciri · IPHC · NHC-UDP,
 *   · `thread/mle.ts`               — Security Suite + iki Discovery komutu.
 *
 * ── ÇEKİRDEK NASIL TÜKETİLİR — `wifi.ts` DESENİ ──────────────────────────
 * Çekirdek bir ÖZET döndürür (`payloadStart` / `payloadEnd`), gövdeyi
 * TÜKETİCİ araya sokar, FCS EN SONDA basılır. `zigbee` FCS'i NWK'dan ÖNCE
 * basıyor (dalga 7'den beri, `data-field-id` seçicileri ona bağlı); `thread`
 * sonda basıyor. Çekirdeğin `pushIeee802154Fcs`i AYRI bir çağrı olmasının
 * sebebi tam olarak bu ayrımdır.
 *
 * ── GİRDİ SÖZLEŞMESİ ──────────────────────────────────────────────────────
 * Girdi = **TAM IEEE 802.15.4 MAC çerçevesi + 2 baytlık FCS** —
 * `zigbee` ile AYNI sözleşme, libpcap'te `LINKTYPE_IEEE802_15_4_WITHFCS`
 * = **195**. FCS'siz varyant 230, **TAP sözde başlığı 283**, Linux SLL 191,
 * NONASK PHY 215 ve **ZEP kapsüllemesi** GİRDİ DEĞİLDİR
 * `[KANIT]` `https://www.tcpdump.org/linktypes.html`.
 * OpenThread'in kendi sniffer'ı varsayılan olarak **195** yazar, `--tap` ile
 * 283 `[KANIT]` `openthread/pyspinel/sniffer.py:52-53, 251`. Kanal / RSSI /
 * LQI TAP ve ZEP'in sözde başlıklarındadır ve bu yüzden bu sayfada YOKTUR.
 *
 * ── KATMAN SIRASI ─────────────────────────────────────────────────────────
 * 1. MAC konteyneri (çekirdek).
 * 2. `Security Enabled = 1` ⇒ **Auxiliary Security Header** okunur ve MIC
 *    uzunluğu yükün SONUNDAN düşülür. 🚨 MIC çerçevenin SONUNDA, FCS'ten
 *    ÖNCE durur; çıkarılmazsa şifreli yük 4-16 bayt UZUN görünür,
 *    HATA VERMEDEN.
 * 3. Security Level ≥ 4 ⇒ MAC yükü ŞİFRELİ; 6LoWPAN zincirine **HİÇ
 *    GİRİLMEZ** (dispatch baytı ciphertext'in içindedir). Level 1-3 yalnız
 *    bütünlüktür, yük AÇIKTIR ve zincir NORMAL koşar.
 * 4. Frame Type ≠ Data ⇒ yük HAM (`zigbee`nin aynı dalı).
 * 5. 6LoWPAN dispatch zinciri: Mesh → BC0 → Fragment → IPHC/IPv6.
 * 6. UDP portu `mlePort`e eşitse **MLE sınıflandırması**; değilse yük HAM.
 * 7. FCS.
 *
 * ── 🚨🚨 MLE: KOMUT TİPİ ŞİFRELİ ÇERÇEVEDE OKUNAMAZ ───────────────────────
 * Şifresiz gönderilen SADECE **Discovery Request (16)** ve **Discovery
 * Response (17)**tir `[KANIT]` OpenThread `mle.cpp:3565-3568`. Ötekilerin
 * hepsi Security Suite 0 ile, yani şifreli gider. Şifreli dalda:
 * "şifreli MLE" damgası BASILIR · komut tipi **UYDURULMAZ** (alan HİÇ
 * basılmaz) · MIC bir ALAN olarak basılır ama **PASS/FAIL BASILMAZ**.
 * Gerekçe ve OpenThread'in TERS YORUMLARI `mle.ts` dosya başındadır.
 *
 * ── ROZET `partial` — NEDEN ───────────────────────────────────────────────
 * 1. **MLE gövdesi şifreli** — katalogun *"MLE Message Classifier (Parent
 *    Request / Response, Child ID, Advertisement, Link Request)"* vaadi
 *    ANAHTAR OLMADAN karşılanamaz (birinci sebep).
 * 2. Fragment **yeniden birleştirme YOK** — çerçeveler arası durum.
 * 3. **LOWPAN_HC1 tanınır, ÇÖZÜLMEZ**; Thread kullanmaz.
 * 4. **Bağlam tabanlı sıkıştırma (SAC/DAC = 1)** — tablo TELDE YOK.
 * 5. Mesh Topology Graph · Border Router Analyzer · Address Map ·
 *    RSSI & Link Margin Trend — **çerçeveler arası** ya da **PHY metadata**;
 *    ikisi de tek çerçeveden çıkmaz.
 * 6. MLE TLV'leri, Thread Network Data, MeshCoP ve TMF CoAP — ayrı dalga.
 *
 * "Yarım motor" DEĞİL: MAC konteyneri, Auxiliary Security Header, altı
 * dispatch dalı, IPHC'nin on bit alanı + adres kurulumu + sıkıştırma kazancı,
 * NHC-UDP'nin dört port kipi, IPv6/UDP başlıkları ve MLE süit ayrımı gerçek
 * çıktılardır.
 *
 * ── 🚨 KANAL YAPILMAYACAKLAR (ve neden) ───────────────────────────────────
 * `decodeOptions` yüzeyi ÇERÇEVEDEN ÇIKARILAMAYAN parametrelere ayrılmıştır.
 * Aşağıdakiler kanal DEĞİLDİR; gerekçe burada dursun ki bir sonraki nesil
 * "unutulmuş" sanmasın (dalga 17 dersi, `wifi.ts:55-95` emsali):
 *   · **Ağ anahtarı / MLE anahtarı girişi** — şifre çözme bu dalgada YOK.
 *     Kanal açmak OLMAYAN bir yeteneği vaat ederdi (CLAUDE.md anahtar kuralı).
 *   · **RLOC16 → düğüm rolü (Leader / Router / REED / End Device / SED)** —
 *     Network Data gerekir, çerçeveler ARASI durumdur (dalga 16 bulgu 12).
 *   · **Fragment birleştirme tamponu** — aynı gerekçe; başlık çözülür,
 *     tampon TUTULMAZ.
 *   · **Kanal / RSSI / LQI** — TAP (283) ve ZEP sözde başlıklarının işi,
 *     girdi sözleşmesinin DIŞI.
 *   · **Thread sürümü (1.1 / 1.3 / 1.4)** — çerçeveden ÇIKARILAMAZ ve bu
 *     dalgada hiçbir alanın yorumunu değiştirmiyor. Değiştirmeyen şık kanal
 *     değildir (18b'de iki şık tam bu ölçüyle çürüdü).
 *   · **`iphcContext` (Context ID → prefix)** — brifin öngördüğü SEKİZİNCİ
 *     kanal AÇILMADI ve gerekçesi ölçülebilir: `DecodeOption.kind` yalnız
 *     `'select' | 'number'` (`protocol-core/types.ts`), serbest metin kipi
 *     YOKTUR ve 18d'nin kabul ölçütü `types.ts`e dokunmayı AÇIKÇA yasaklıyor.
 *     Bir IPv6 prefix'i ne sonlu bir şıkka ne bir sayıya sığar; uydurma bir
 *     şık listesi "bu tablo tam" izlenimi verirdi. Kanal olmayınca davranış
 *     zaten brifin *"seçilmezse adres HAM kalır + uyarı"* dalıdır —
 *     `lowpan.ts` `contextNotOnWire` ile tam bunu yapıyor.
 *   · **Bayt sırası** — 6LoWPAN/IPv6/UDP alanları DAİMA big-endian, 802.15.4
 *     alanları DAİMA little-endian. Seçenek yaratmak olmayan bir belirsizlik
 *     uydurmak olurdu (`ccp.ts`in reddettiği tür).
 *
 * ── `build` SEKMESİ YOK → `encoder` YAZILMAZ ─────────────────────────────
 * Katalog `tabs`ı `['overview','decode','diagnostics','examples']`; `build`
 * yok (16c/17 gerekçesi).
 */

import { computeNamedCrc } from '@/protocol-core/checksums';
import {
  IEEE802154_ADDRESS_DISPLAY_EUI64,
  IEEE802154_ADDRESS_DISPLAY_RAW,
  IEEE802154_FCS_LENGTH,
  IEEE802154_FRAME_TYPE_DATA,
  IEEE802154_MIN_LENGTH,
  decodeIeee802154Header,
  ieee802154HeaderLength,
  pushIeee802154Fcs,
  readIeee802154FrameControl,
} from '@/protocol-core/framing/ieee802154Frame';
import type { Ieee802154Messages } from '@/protocol-core/framing/ieee802154Frame';
import { createRawFrame } from '@/protocol-core/types';
import type {
  DecodeOption,
  ExampleFrame,
  ParseContext,
  ParseResult,
  ParsedField,
  ParsedFrame,
  ProtocolError,
  ProtocolParser,
  ProtocolPlugin,
  ProtocolWarning,
} from '@/protocol-core/types';

import type { AuxSecurityHeaderMessages } from './auxSecurityHeader';
import { decodeAuxSecurityHeader, pushMic } from './auxSecurityHeader';
import {
  ADDRESS_DISPLAY_EUI64,
  ADDRESS_DISPLAY_RAW,
  DISPATCH_PROFILE_RFC4944,
  DISPATCH_PROFILE_THREAD,
  UDP_CHECKSUM_AUTO,
  UDP_CHECKSUM_ELIDED,
  UDP_CHECKSUM_PRESENT,
  decodeLowpan,
} from './lowpan';
import type { LowpanMessages, LowpanOptions } from './lowpan';
import { ENCRYPTED_PAYLOAD_HEX, ENCRYPTED_PAYLOAD_MARKED, MLE_UDP_PORT, decodeMle } from './mle';
import type { MleMessages, MleOptions } from './mle';

const PROTOCOL_ID = 'thread';
/** Protokol adı VERİDİR, çeviriye girmez (CLAUDE.md). */
const PROTOCOL_DISPLAY_NAME = 'Thread';
const TRANSLATION_KEY_PREFIX = 'protocol.thread';

// ── Çeviri anahtarları ────────────────────────────────────────────────────

const ERROR_ABORTED = `${TRANSLATION_KEY_PREFIX}.error.aborted`;
const ERROR_EMPTY_FRAME = `${TRANSLATION_KEY_PREFIX}.error.emptyFrame`;
const ERROR_FRAME_TOO_SHORT = `${TRANSLATION_KEY_PREFIX}.error.frameTooShort`;
const ERROR_FRAME_TOO_LONG = `${TRANSLATION_KEY_PREFIX}.error.frameTooLong`;
const ERROR_MAC_ADDRESSING_TRUNCATED = `${TRANSLATION_KEY_PREFIX}.error.macAddressingTruncated`;
const ERROR_FCS_MISMATCH = `${TRANSLATION_KEY_PREFIX}.error.fcsMismatch`;
const ERROR_AUX_SECURITY_TRUNCATED = `${TRANSLATION_KEY_PREFIX}.error.auxSecurityTruncated`;
const ERROR_LOWPAN_TRUNCATED = `${TRANSLATION_KEY_PREFIX}.error.lowpanTruncated`;

const WARN_LINK_TYPE_CONTRACT = `${TRANSLATION_KEY_PREFIX}.warning.linkTypeContract`;
const WARN_FRAME_VERSION_UNSUPPORTED = `${TRANSLATION_KEY_PREFIX}.warning.frameVersionUnsupported`;
const WARN_NON_DATA_FRAME = `${TRANSLATION_KEY_PREFIX}.warning.nonDataFrame`;
const WARN_MAC_PAYLOAD_ENCRYPTED = `${TRANSLATION_KEY_PREFIX}.warning.macPayloadEncrypted`;
const WARN_MIC_NOT_VERIFIABLE = `${TRANSLATION_KEY_PREFIX}.warning.micNotVerifiable`;
const WARN_HC1_OUT_OF_SCOPE = `${TRANSLATION_KEY_PREFIX}.warning.hc1OutOfScope`;
const WARN_NALP = `${TRANSLATION_KEY_PREFIX}.warning.nalp`;
const WARN_ESC_NOT_ALLOCATED = `${TRANSLATION_KEY_PREFIX}.warning.escNotAllocated`;
const WARN_UNKNOWN_DISPATCH = `${TRANSLATION_KEY_PREFIX}.warning.unknownDispatch`;
const WARN_FRAGMENT_NOT_REASSEMBLED = `${TRANSLATION_KEY_PREFIX}.warning.fragmentNotReassembled`;
const WARN_CONTEXT_NOT_ON_WIRE = `${TRANSLATION_KEY_PREFIX}.warning.contextNotOnWire`;
const WARN_IID_DERIVED = `${TRANSLATION_KEY_PREFIX}.warning.iidDerived`;
const WARN_RESERVED_ADDRESS_MODE = `${TRANSLATION_KEY_PREFIX}.warning.reservedAddressMode`;
const WARN_NHC_NOT_UDP = `${TRANSLATION_KEY_PREFIX}.warning.nhcNotUdp`;
const WARN_UDP_CHECKSUM_NOT_VERIFIED = `${TRANSLATION_KEY_PREFIX}.warning.udpChecksumNotVerified`;
const WARN_UDP_CHECKSUM_ELIDED = `${TRANSLATION_KEY_PREFIX}.warning.udpChecksumElidedOnWire`;
const WARN_NOT_MLE_PORT = `${TRANSLATION_KEY_PREFIX}.warning.notMlePort`;
const WARN_UNKNOWN_SECURITY_SUITE = `${TRANSLATION_KEY_PREFIX}.warning.unknownSecuritySuite`;
const WARN_ENCRYPTED_COMMAND_NOT_READABLE = `${TRANSLATION_KEY_PREFIX}.warning.encryptedCommandNotReadable`;
const WARN_COMMAND_NOT_DECODED = `${TRANSLATION_KEY_PREFIX}.warning.commandNotDecoded`;
const WARN_TLVS_NOT_DECODED = `${TRANSLATION_KEY_PREFIX}.warning.tlvsNotDecoded`;

// ── Mesaj demetleri — her modül KENDİ sözleşmesini alır ───────────────────

const MAC_MESSAGES: Ieee802154Messages = {
  frameVersionUnsupported: WARN_FRAME_VERSION_UNSUPPORTED,
  addressingTruncated: ERROR_MAC_ADDRESSING_TRUNCATED,
  fcsMismatch: ERROR_FCS_MISMATCH,
};

const AUX_MESSAGES: AuxSecurityHeaderMessages = {
  truncated: ERROR_AUX_SECURITY_TRUNCATED,
  micNotVerifiable: WARN_MIC_NOT_VERIFIABLE,
};

const LOWPAN_MESSAGES: LowpanMessages = {
  truncated: ERROR_LOWPAN_TRUNCATED,
  hc1OutOfScope: WARN_HC1_OUT_OF_SCOPE,
  nalp: WARN_NALP,
  escNotAllocated: WARN_ESC_NOT_ALLOCATED,
  unknownDispatch: WARN_UNKNOWN_DISPATCH,
  fragmentNotReassembled: WARN_FRAGMENT_NOT_REASSEMBLED,
  contextNotOnWire: WARN_CONTEXT_NOT_ON_WIRE,
  iidDerived: WARN_IID_DERIVED,
  reservedAddressMode: WARN_RESERVED_ADDRESS_MODE,
  nhcNotUdp: WARN_NHC_NOT_UDP,
  udpChecksumNotVerified: WARN_UDP_CHECKSUM_NOT_VERIFIED,
  udpChecksumElidedOnWire: WARN_UDP_CHECKSUM_ELIDED,
};

const MLE_MESSAGES: MleMessages = {
  truncated: ERROR_AUX_SECURITY_TRUNCATED,
  micNotVerifiable: WARN_MIC_NOT_VERIFIABLE,
  unknownSecuritySuite: WARN_UNKNOWN_SECURITY_SUITE,
  encryptedCommandNotReadable: WARN_ENCRYPTED_COMMAND_NOT_READABLE,
  commandNotDecoded: WARN_COMMAND_NOT_DECODED,
  tlvsNotDecoded: WARN_TLVS_NOT_DECODED,
};

// ── decodeOptions — YEDİ kanal ────────────────────────────────────────────
// Brif SEKİZ öngörmüştü; `iphcContext` çürüdü (dosya başı, "KANAL
// YAPILMAYACAKLAR"). Kalan yedinin BEŞİ çıktıyı BAYT DÜZEYİNDE değiştirir,
// İKİSİ (`encryptedPayloadDisplay`, `addressDisplay`) açıkça gösterim
// tercihidir ve gösterdikleri baytlar ZATEN ekrandadır.

const OPTION_FCS_PRESENT = 'fcsPresent';
const OPTION_SECURITY_LEVEL_OVERRIDE = 'securityLevelOverride';
const OPTION_MLE_PORT = 'mlePort';
const OPTION_DISPATCH_PROFILE = 'dispatchProfile';
const OPTION_ENCRYPTED_PAYLOAD_DISPLAY = 'encryptedPayloadDisplay';
const OPTION_ADDRESS_DISPLAY = 'addressDisplay';
const OPTION_UDP_CHECKSUM_ELIDED = 'udpChecksumElided';

const FCS_PRESENT_AUTO = 'auto';
const FCS_PRESENT_YES = 'yes';
const FCS_PRESENT_NO = 'no';

const SECURITY_LEVEL_AUTO = 'auto';

const DECODE_OPTIONS: readonly DecodeOption[] = [
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
    id: OPTION_SECURITY_LEVEL_OVERRIDE,
    label: `${TRANSLATION_KEY_PREFIX}.option.securityLevelOverride`,
    kind: 'select',
    defaultValue: SECURITY_LEVEL_AUTO,
    description: `${TRANSLATION_KEY_PREFIX}.option.securityLevelOverride.description`,
    choices: [
      {
        value: SECURITY_LEVEL_AUTO,
        label: `${TRANSLATION_KEY_PREFIX}.option.securityLevelOverride.auto`,
      },
      // Adlar §7.4.1.1 Table 9-6'nın kendi metnidir — VERİ, çevrilmez.
      { value: '0', label: '0 — None' },
      { value: '1', label: '1 — MIC-32' },
      { value: '2', label: '2 — MIC-64' },
      { value: '3', label: '3 — MIC-128' },
      { value: '4', label: '4 — ENC' },
      { value: '5', label: '5 — ENC-MIC-32' },
      { value: '6', label: '6 — ENC-MIC-64' },
      { value: '7', label: '7 — ENC-MIC-128' },
    ],
  },
  {
    id: OPTION_MLE_PORT,
    label: `${TRANSLATION_KEY_PREFIX}.option.mlePort`,
    kind: 'number',
    defaultValue: MLE_UDP_PORT,
    min: 0,
    max: 65535,
    description: `${TRANSLATION_KEY_PREFIX}.option.mlePort.description`,
  },
  {
    id: OPTION_DISPATCH_PROFILE,
    label: `${TRANSLATION_KEY_PREFIX}.option.dispatchProfile`,
    kind: 'select',
    defaultValue: DISPATCH_PROFILE_THREAD,
    description: `${TRANSLATION_KEY_PREFIX}.option.dispatchProfile.description`,
    choices: [
      {
        value: DISPATCH_PROFILE_THREAD,
        label: `${TRANSLATION_KEY_PREFIX}.option.dispatchProfile.thread`,
      },
      {
        value: DISPATCH_PROFILE_RFC4944,
        label: `${TRANSLATION_KEY_PREFIX}.option.dispatchProfile.rfc4944`,
      },
    ],
  },
  {
    id: OPTION_ENCRYPTED_PAYLOAD_DISPLAY,
    label: `${TRANSLATION_KEY_PREFIX}.option.encryptedPayloadDisplay`,
    kind: 'select',
    defaultValue: ENCRYPTED_PAYLOAD_MARKED,
    description: `${TRANSLATION_KEY_PREFIX}.option.encryptedPayloadDisplay.description`,
    choices: [
      {
        value: ENCRYPTED_PAYLOAD_MARKED,
        label: `${TRANSLATION_KEY_PREFIX}.option.encryptedPayloadDisplay.marked`,
      },
      {
        value: ENCRYPTED_PAYLOAD_HEX,
        label: `${TRANSLATION_KEY_PREFIX}.option.encryptedPayloadDisplay.hex`,
      },
    ],
  },
  {
    id: OPTION_ADDRESS_DISPLAY,
    label: `${TRANSLATION_KEY_PREFIX}.option.addressDisplay`,
    kind: 'select',
    defaultValue: ADDRESS_DISPLAY_EUI64,
    description: `${TRANSLATION_KEY_PREFIX}.option.addressDisplay.description`,
    choices: [
      { value: ADDRESS_DISPLAY_EUI64, label: `${TRANSLATION_KEY_PREFIX}.option.addressDisplay.eui64` },
      { value: ADDRESS_DISPLAY_RAW, label: `${TRANSLATION_KEY_PREFIX}.option.addressDisplay.raw` },
    ],
  },
  {
    id: OPTION_UDP_CHECKSUM_ELIDED,
    label: `${TRANSLATION_KEY_PREFIX}.option.udpChecksumElided`,
    kind: 'select',
    defaultValue: UDP_CHECKSUM_AUTO,
    description: `${TRANSLATION_KEY_PREFIX}.option.udpChecksumElided.description`,
    choices: [
      {
        value: UDP_CHECKSUM_AUTO,
        label: `${TRANSLATION_KEY_PREFIX}.option.udpChecksumElided.auto`,
      },
      {
        value: UDP_CHECKSUM_PRESENT,
        label: `${TRANSLATION_KEY_PREFIX}.option.udpChecksumElided.present`,
      },
      {
        value: UDP_CHECKSUM_ELIDED,
        label: `${TRANSLATION_KEY_PREFIX}.option.udpChecksumElided.elided`,
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

function readPort(options: Record<string, unknown> | undefined): number {
  const raw = options?.[OPTION_MLE_PORT];
  const value = typeof raw === 'string' ? Number(raw) : raw;
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > 0xffff) {
    return MLE_UDP_PORT;
  }
  return value;
}

// ── Yardımcılar ───────────────────────────────────────────────────────────

function toProtocolWarning(key: string): ProtocolWarning {
  return { code: key, message: key };
}

function hexBytes(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).toUpperCase().padStart(2, '0')).join(' ');
}

/**
 * Yükü ASCII olarak GÖSTERİR — yorumlamaz. Basılamayan bayt `.` olur; bu bir
 * gösterim kararıdır, "metin yükü" iddiası DEĞİLDİR (yükün ne olduğu telde
 * yazmıyor). `espNow.ts`in `payloadSchema: ascii` dalıyla aynı disiplin.
 */
function asciiPreview(bytes: Uint8Array): string {
  return `"${Array.from(bytes, (byte) => (byte >= 0x20 && byte <= 0x7e ? String.fromCharCode(byte) : '.')).join('')}"`;
}

// ── canParse — ana brifin T4'ü ────────────────────────────────────────────

/**
 * 802.15.4 Data çerçevesi + çözülebilir başlık uzunluğu + **MAC yükünün ilk
 * baytı bir 6LoWPAN dispatch'i** + geçerli FCS.
 *
 * Ölçüm (gerçek yakalama, ana brif T4): **0 / 899 yanlış pozitif**,
 * **298 / 331 doğru pozitif**. Reddedilen 33'ün TAMAMI dispatch `0x42` =
 * LOWPAN_HC1 — `[KARAR 18-3]`ün BİLİNÇLİ kapsam dışısı, yanlış negatif
 * DEĞİL. FCS'siz aynı imza 18, yalnız MAC frame type 138, yalnız 6LoWPAN
 * yükü 245 yanlış pozitif verirdi; üçü de bekçi testinde tekrarlanır.
 *
 * **`Security Enabled = 1` REDDEDİLİR** ve bu bir eksiklik değil, protokolün
 * kendisidir: o durumda `h`teki bayt 6LoWPAN dispatch'i DEĞİL, Auxiliary
 * Security Header'ın Security Control baytıdır; Level ≥ 4'te dispatch baytı
 * ciphertext'in İÇİNDEDİR ve dışarıdan bakan biri çerçevenin Thread olduğunu
 * ÇERÇEVEDEN BİLEMEZ. `esp-now`in `protected` örneğiyle aynı olgu
 * (`espNowCanParseRegistry.test.ts`) — bekçi testi bunu AÇIKÇA `false`
 * bekleyerek sınar. Elle seçildiğinde motor çerçeveyi TAM çözer.
 *
 * `decodeOptions` BURAYA GİRMEZ (`ProtocolParser` sözleşmesi): `fcsPresent`
 * `no` yapılmış olsa bile auto-detection imzası HÂLÂ FCS ister, çünkü
 * FCS'siz imza aynı kümede 18 çerçeve çalar (`wifi.ts` ile aynı gerekçe).
 */
export function hasThreadSignature(data: Uint8Array): boolean {
  if (data.length < IEEE802154_MIN_LENGTH + 1) return false;
  const fc = readIeee802154FrameControl(data);
  if (fc.frameType !== IEEE802154_FRAME_TYPE_DATA) return false;
  if (fc.securityEnabled === 1) return false;
  const headerLength = ieee802154HeaderLength(data);
  if (headerLength === undefined) return false;
  if (headerLength + IEEE802154_FCS_LENGTH >= data.length) return false;
  if (!isThreadDispatch(data[headerLength] ?? 0)) return false;
  const fcsOffset = data.length - IEEE802154_FCS_LENGTH;
  const received = (data[fcsOffset] ?? 0) | ((data[fcsOffset + 1] ?? 0) << 8);
  return Number(computeNamedCrc(data.slice(0, fcsOffset), 'CRC16_KERMIT')) === received;
}

/**
 * `0x41` (uncompressed IPv6) · `011xxxxx` (IPHC) · `10xxxxxx` (Mesh) ·
 * `11000xxx` (FRAG1) · `11100xxx` (FRAGN). **`0x42` (HC1) ve `01010000`
 * (BC0) YOK**: HC1 kapsam dışı; BC0 tek başına bir çerçeve başlatmaz, Mesh
 * başlığının ARDINDAN gelir (RFC 4944 §5.1 sırası).
 */
function isThreadDispatch(dispatch: number): boolean {
  if (dispatch === 0x41) return true;
  if ((dispatch & 0xe0) === 0x60) return true;
  if ((dispatch & 0xc0) === 0x80) return true;
  if ((dispatch & 0xf8) === 0xc0) return true;
  return (dispatch & 0xf8) === 0xe0;
}

/**
 * REDDEDİLEN naif imza (ana brifin T1'i): yalnız MAC Frame Type = Data.
 * Bekçi testinin TERS ayağı bunu aynı kümede koşturur ve *"yazılsaydı
 * çalardı"*yı sayıyla kanıtlar.
 */
export function hasNaiveThreadSignature(data: Uint8Array): boolean {
  if (data.length < IEEE802154_MIN_LENGTH) return false;
  return readIeee802154FrameControl(data).frameType === IEEE802154_FRAME_TYPE_DATA;
}

/**
 * REDDEDİLEN naif imza (ana brifin T3'ü): yalnız 6LoWPAN yükü — MAC
 * konteyneri hiç okunmadan ilk bayta bakmak.
 */
export function hasDispatchOnlySignature(data: Uint8Array): boolean {
  if (data.length < 1) return false;
  return isThreadDispatch(data[0] ?? 0);
}

// ── Çözüm ─────────────────────────────────────────────────────────────────

function parseThread(data: Uint8Array, context?: ParseContext): ParseResult {
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
  if (data.length < IEEE802154_MIN_LENGTH) {
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
  const fcsPresentOption = readSelect(options, OPTION_FCS_PRESENT, FCS_PRESENT_AUTO);
  const fcsPresent = fcsPresentOption !== FCS_PRESENT_NO;
  const securityLevelChoice = readSelect(
    options,
    OPTION_SECURITY_LEVEL_OVERRIDE,
    SECURITY_LEVEL_AUTO,
  );
  const securityLevelOverride =
    securityLevelChoice === SECURITY_LEVEL_AUTO ? undefined : Number(securityLevelChoice);
  const mlePort = readPort(options);
  const addressDisplay = readSelect(options, OPTION_ADDRESS_DISPLAY, ADDRESS_DISPLAY_EUI64);
  const encryptedPayloadDisplay = readSelect(
    options,
    OPTION_ENCRYPTED_PAYLOAD_DISPLAY,
    ENCRYPTED_PAYLOAD_MARKED,
  );
  const lowpanOptions: LowpanOptions = {
    dispatchProfile: readSelect(options, OPTION_DISPATCH_PROFILE, DISPATCH_PROFILE_THREAD),
    udpChecksumElided: readSelect(options, OPTION_UDP_CHECKSUM_ELIDED, UDP_CHECKSUM_AUTO),
    addressDisplay,
  };
  const mleOptions: MleOptions = { encryptedPayloadDisplay, securityLevelOverride };

  const fields: ParsedField[] = [];
  const warnings: ProtocolWarning[] = [];
  const errors: ProtocolError[] = [];

  // Girdi sözleşmesi HER çözümde söylenir (`wifi.ts`/`espNow.ts` deseni):
  // TAP (283) ve ZEP sözde başlıkları KAPSAM DIŞI.
  warnings.push(toProtocolWarning(WARN_LINK_TYPE_CONTRACT));

  // ═══════════════════════ 802.15.4 MAC — ÇEKİRDEKTEN ═══════════════════
  const mac = decodeIeee802154Header(data, fields, warnings, errors, MAC_MESSAGES, {
    addressDisplay:
      addressDisplay === ADDRESS_DISPLAY_RAW
        ? IEEE802154_ADDRESS_DISPLAY_RAW
        : IEEE802154_ADDRESS_DISPLAY_EUI64,
    fcsPresent,
  });

  let cursor = mac.payloadStart;
  let payloadEnd = mac.payloadEnd;
  let enterLowpan = !mac.truncated && mac.addressing.supported;
  /** MAC MIC'i EN SONDA, 6LoWPAN alanlarından SONRA basılır — ofseti onlardan
   *  büyüktür ve alan listesi ofset sırasını izler. */
  let macMic: { readonly end: number; readonly length: number } | undefined;

  if (mac.frameControl.frameType !== IEEE802154_FRAME_TYPE_DATA) {
    // Beacon / Ack / MAC Command — 6LoWPAN taşımaz (`zigbee`nin aynı dalı).
    enterLowpan = false;
  }

  // ═══════════════ Auxiliary Security Header (VARSA) ═════════════════════
  // 🚨 MIC çerçevenin SONUNDA, FCS'ten ÖNCE durur; yükten ÇIKARILMAZSA
  // şifreli yük 4-16 bayt uzun görünür ve zincir HATA VERMEDEN yanlış
  // yerden okur (`auxSecurityHeader.ts` dosya başı).
  if (enterLowpan && mac.frameControl.securityEnabled === 1) {
    const aux = decodeAuxSecurityHeader(
      data,
      cursor,
      payloadEnd,
      fields,
      warnings,
      errors,
      AUX_MESSAGES,
      'mac-sec',
      'MAC',
      securityLevelOverride,
    );
    if (aux.truncated) {
      enterLowpan = false;
    } else {
      cursor += aux.length;
      if (aux.micLength > 0) macMic = { end: payloadEnd, length: aux.micLength };
      payloadEnd = Math.max(cursor, payloadEnd - aux.micLength);
      if (aux.encrypted) {
        // Level ≥ 4 ⇒ MAC yükü ŞİFRELİ; dispatch baytı ciphertext'in
        // İÇİNDEDİR. Zincire HİÇ GİRİLMEZ, komut/başlık UYDURULMAZ.
        enterLowpan = false;
        if (payloadEnd > cursor) {
          const payload = data.slice(cursor, payloadEnd);
          const encryptedField: ParsedField = {
            id: 'mac-encrypted-payload',
            name: 'MAC Payload (encrypted, 6LoWPAN dispatch not readable on the wire)',
            offset: cursor,
            length: payload.length,
            rawBytes: payload,
            unit: 'B',
            valid: true,
            warnings: [WARN_MAC_PAYLOAD_ENCRYPTED],
          };
          if (encryptedPayloadDisplay === ENCRYPTED_PAYLOAD_HEX) {
            encryptedField.physicalValue = hexBytes(payload);
          }
          fields.push(encryptedField);
        }
        warnings.push(toProtocolWarning(WARN_MAC_PAYLOAD_ENCRYPTED));
      }
    }
  }

  // ═══════════════════════ 6LoWPAN → IPv6 → UDP ══════════════════════════
  if (enterLowpan && payloadEnd > cursor) {
    const lowpan = decodeLowpan(
      data,
      cursor,
      payloadEnd,
      fields,
      warnings,
      errors,
      lowpanOptions,
      LOWPAN_MESSAGES,
      mac.srcAddressBytes,
      mac.destAddressBytes,
    );

    // ═════════════════════════════ MLE ═══════════════════════════════════
    const udp = lowpan.udp;
    if (udp !== undefined && lowpan.outOfScope === undefined) {
      const isMle = udp.sourcePort === mlePort || udp.destinationPort === mlePort;
      if (isMle) {
        decodeMle(
          data,
          lowpan.payloadStart,
          lowpan.payloadEnd,
          fields,
          warnings,
          errors,
          mleOptions,
          MLE_MESSAGES,
        );
      } else if (lowpan.payloadEnd > lowpan.payloadStart) {
        const payload = data.slice(lowpan.payloadStart, lowpan.payloadEnd);
        fields.push({
          id: 'udp-payload',
          name: 'UDP Payload (not the MLE port; not decoded further)',
          offset: lowpan.payloadStart,
          length: payload.length,
          rawBytes: payload,
          physicalValue: asciiPreview(payload),
          unit: 'B',
          valid: true,
          warnings: [WARN_NOT_MLE_PORT],
        });
        warnings.push(toProtocolWarning(WARN_NOT_MLE_PORT));
      }
    }
  } else if (
    !enterLowpan &&
    mac.frameControl.securityEnabled !== 1 &&
    payloadEnd > cursor &&
    !mac.truncated
  ) {
    const payload = data.slice(cursor, payloadEnd);
    fields.push({
      id: 'mac-payload',
      name: 'MAC Payload',
      offset: cursor,
      length: payload.length,
      rawBytes: payload,
      unit: 'B',
      valid: true,
      warnings: [WARN_NON_DATA_FRAME],
    });
    warnings.push(toProtocolWarning(WARN_NON_DATA_FRAME));
  }

  // MAC MIC'i — yükten SONRA, FCS'ten ÖNCE (telde de tam orada durur).
  if (macMic !== undefined) {
    pushMic(data, macMic.end, macMic.length, fields, 'mac-sec', 'MAC', WARN_MIC_NOT_VERIFIABLE);
  }

  // ═══════════════════════════════ FCS ═══════════════════════════════════
  // EN SONDA (`wifi.ts` deseni). `zigbee` onu NWK'dan ÖNCE basıyor ve o sıra
  // dalga 7'den beri sabit — çekirdeğin ayrı `pushIeee802154Fcs` çağrısı tam
  // olarak bu iki sıranın bir arada yaşayabilmesi için var.
  if (fcsPresent) {
    pushIeee802154Fcs(data, fields, errors, MAC_MESSAGES);
  }

  const rawFrame = createRawFrame(data, {
    ...(context?.timestamp === undefined ? {} : { timestamp: context.timestamp }),
    ...(context?.direction === undefined ? {} : { direction: context.direction }),
    ...(context?.channel === undefined ? {} : { channel: context.channel }),
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

export const threadParser: ProtocolParser = {
  protocolId: PROTOCOL_ID,
  displayName: PROTOCOL_DISPLAY_NAME,
  canParse(data: Uint8Array): boolean {
    return hasThreadSignature(data);
  },
  parse(data: Uint8Array, context?: ParseContext): ParseResult {
    return parseThread(data, context);
  },
};

// ── Örnek çerçeveler ──────────────────────────────────────────────────────
// DÖRDÜ Wireshark SampleCaptures'ın `6LoWPAN.pcap` yakalamasının GERÇEK
// çerçeveleridir (ZEP v2 kapsüllemesi soyulmuş; yakalamanın 331 çerçevesinin
// FCS'i 331/331 doğru). Yakalama Thread DEĞİL, jenerik 6LoWPAN'dır (UDP portu
// 0xF0B1) — 802.15.4 MAC, FRAG ve sıkıştırılmamış IPv6 yollarını DOĞRULAR;
// IPHC, MLE ve güvenlik yollarını doğrulamaz, onlar TÜRETİLDİ.
//
// Türetilen her çerçevenin FCS'i `computeNamedCrc(…, 'CRC16_KERMIT')` ile
// BURADA hesaplanır — elle YAZILMAZ (dalga 17 dersi).

function fcsFor(bytesWithoutFcs: readonly number[]): number[] {
  const fcs = computeNamedCrc(Uint8Array.from(bytesWithoutFcs), 'CRC16_KERMIT');
  return [Number(fcs & 0xffn), Number((fcs >> 8n) & 0xffn)];
}

/** Gerçek yakalamanın iki düğümü — türetilen çerçeveler de onları kullanır. */
const DEST_EUI64_WIRE = [0x8a, 0x18, 0x00, 0xff, 0xff, 0xda, 0x1c, 0x00];
const SRC_EUI64_WIRE = [0x88, 0x18, 0x00, 0xff, 0xff, 0xda, 0x1c, 0x00];

/**
 * FCF `41 cc` — Data · Security = `securityEnabled` · PAN ID Compression = 1 ·
 * dest 64 bit · Frame Version 2003 · src 64 bit ⇒ başlık 3 + 2 + 8 + 8 = 21 B.
 * Gerçek yakalamanın FCF'iyle BİREBİR aynı (yalnız güvenlik biti değişebilir).
 */
function macHeader(sequenceNumber: number, securityEnabled = false): number[] {
  return [
    0x41 | (securityEnabled ? 0x08 : 0x00),
    0xcc,
    sequenceNumber,
    0xff,
    0xff,
    ...DEST_EUI64_WIRE,
    ...SRC_EUI64_WIRE,
  ];
}

function threadFrame(
  macPayload: readonly number[],
  sequenceNumber: number,
  securityEnabled = false,
): Uint8Array {
  const withoutFcs = [...macHeader(sequenceNumber, securityEnabled), ...macPayload];
  return Uint8Array.from([...withoutFcs, ...fcsFor(withoutFcs)]);
}

/** Sıkıştırılmamış UDP başlığı; `Length` yükten TÜRETİLİR, elle yazılmaz. */
function plainUdp(
  sourcePort: number,
  destinationPort: number,
  payload: readonly number[],
): number[] {
  const length = 8 + payload.length;
  return [
    (sourcePort >> 8) & 0xff,
    sourcePort & 0xff,
    (destinationPort >> 8) & 0xff,
    destinationPort & 0xff,
    (length >> 8) & 0xff,
    length & 0xff,
    0x00,
    0x00,
    ...payload,
  ];
}

/** IPHC `7b 33`: TF = 11 (elenmiş) · NH = 0 · HLIM = 11 (255) · SAM = DAM = 11. */
const IPHC_ELIDED_ADDRESSES = [0x7b, 0x33];
const IPHC_NEXT_HEADER_UDP = 0x11;

const EXAMPLE_UNCOMPRESSED_IPV6 = Uint8Array.from([
  0x41, 0xcc, 0xa4, 0xff, 0xff, 0x8a, 0x18, 0x00, 0xff, 0xff, 0xda, 0x1c, 0x00, 0x88, 0x18, 0x00,
  0xff, 0xff, 0xda, 0x1c, 0x00, 0x41, 0x60, 0x00, 0x00, 0x00, 0x00, 0x19, 0x11, 0x40, 0xfe, 0x80,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x1c, 0xda, 0xff, 0xff, 0x00, 0x18, 0x88, 0xfe, 0x80,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x1c, 0xda, 0xff, 0xff, 0x00, 0x18, 0x8a, 0x04, 0x01,
  0xf0, 0xb1, 0x00, 0x19, 0xea, 0x8a, 0x48, 0x65, 0x6c, 0x6c, 0x6f, 0x20, 0x30, 0x30, 0x33, 0x20,
  0x30, 0x78, 0x43, 0x35, 0x39, 0x41, 0x0a, 0xf9, 0x31,
]);

const EXAMPLE_FRAMES: ExampleFrame[] = [
  {
    id: 'uncompressed-ipv6',
    name: `${TRANSLATION_KEY_PREFIX}.example.uncompressedIpv6.name`,
    // GERÇEK — üçlü aritmetik çaprazlama UYGULAMADA YENİDEN ÇÖZÜLDÜ:
    // 21 (MAC) + 1 (dispatch 0x41) + 40 (IPv6) + 8 (UDP) + 17 (yük) + 2 (FCS)
    // = 89 ✓ · IPv6 Payload Length = 25 = UDP Length ✓ · FCS PASS.
    bytes: EXAMPLE_UNCOMPRESSED_IPV6,
    description: `${TRANSLATION_KEY_PREFIX}.example.uncompressedIpv6.description`,
    expectedValid: true,
  },
  {
    id: 'fragment-first',
    name: `${TRANSLATION_KEY_PREFIX}.example.fragmentFirst.name`,
    // GERÇEK — FRAG1 `c1 09 00 02`: datagram_size 265, tag 2, yük 96 B.
    bytes: Uint8Array.from([
      0x41, 0xcc, 0xa6, 0xff, 0xff, 0x8a, 0x18, 0x00, 0xff, 0xff, 0xda, 0x1c, 0x00, 0x88, 0x18,
      0x00, 0xff, 0xff, 0xda, 0x1c, 0x00, 0xc1, 0x09, 0x00, 0x02, 0x42, 0xfa, 0x40, 0x04, 0x01,
      0xf0, 0xb1, 0x01, 0x06, 0x6f, 0xaf, 0x48, 0x65, 0x6c, 0x6c, 0x6f, 0x20, 0x30, 0x30, 0x36,
      0x20, 0x30, 0x78, 0x46, 0x46, 0x33, 0x43, 0x0a, 0x00, 0x12, 0x13, 0x14, 0x15, 0x16, 0x17,
      0x18, 0x19, 0x1a, 0x1b, 0x1c, 0x1d, 0x1e, 0x1f, 0x20, 0x21, 0x22, 0x23, 0x24, 0x25, 0x26,
      0x27, 0x28, 0x29, 0x2a, 0x2b, 0x2c, 0x2d, 0x2e, 0x2f, 0x30, 0x31, 0x32, 0x33, 0x34, 0x35,
      0x36, 0x37, 0x38, 0x39, 0x3a, 0x3b, 0x3c, 0x3d, 0x3e, 0x3f, 0x40, 0x41, 0x42, 0x43, 0x44,
      0x45, 0x46, 0x47, 0x48, 0x49, 0x4a, 0x4b, 0x4c, 0x4d, 0x4e, 0x4f, 0x50, 0x51, 0x52, 0x53,
      0x54, 0x68, 0x79,
    ]),
    description: `${TRANSLATION_KEY_PREFIX}.example.fragmentFirst.description`,
    expectedValid: true,
  },
  {
    id: 'fragment-subsequent',
    name: `${TRANSLATION_KEY_PREFIX}.example.fragmentSubsequent.name`,
    // GERÇEK — FRAGN `e1 09 00 02 0c`: size 265 ✓ tag 2 ✓ offset 0x0C × 8 = 96
    // ✓ ve bu, FRAG1'in yük uzunluğuyla BİREBİR. Üç bağımsız sayı tutuyor.
    bytes: Uint8Array.from([
      0x41, 0xcc, 0xa7, 0xff, 0xff, 0x8a, 0x18, 0x00, 0xff, 0xff, 0xda, 0x1c, 0x00, 0x88, 0x18,
      0x00, 0xff, 0xff, 0xda, 0x1c, 0x00, 0xe1, 0x09, 0x00, 0x02, 0x0c, 0x55, 0x56, 0x57, 0x58,
      0x59, 0x5a, 0x5b, 0x5c, 0x5d, 0x5e, 0x5f, 0x60, 0x61, 0x62, 0x63, 0x64, 0x65, 0x66, 0x67,
      0x68, 0x69, 0x6a, 0x6b, 0x6c, 0x6d, 0x6e, 0x6f, 0x70, 0x71, 0x72, 0x73, 0x74, 0x75, 0x76,
      0x77, 0x78, 0x79, 0x7a, 0x7b, 0x7c, 0x7d, 0x7e, 0x7f, 0x80, 0x81, 0x82, 0x83, 0x84, 0x85,
      0x86, 0x87, 0x88, 0x89, 0x8a, 0x8b, 0x8c, 0x8d, 0x8e, 0x8f, 0x90, 0x91, 0x92, 0x93, 0x94,
      0x95, 0x96, 0x97, 0x98, 0x99, 0x9a, 0x9b, 0x9c, 0x9d, 0x9e, 0x9f, 0xa0, 0xa1, 0xa2, 0xa3,
      0xa4, 0xa5, 0xa6, 0xa7, 0xa8, 0xa9, 0xaa, 0xab, 0xac, 0xad, 0xae, 0xaf, 0xb0, 0xb1, 0xb2,
      0xb3, 0xb4, 0x55, 0x21,
    ]),
    description: `${TRANSLATION_KEY_PREFIX}.example.fragmentSubsequent.description`,
    expectedValid: true,
  },
  {
    id: 'lowpan-hc1',
    name: `${TRANSLATION_KEY_PREFIX}.example.lowpanHc1.name`,
    // GERÇEK — dispatch 0x42. `canParse` FALSE döner ama çerçeve GEÇERLİDİR
    // (`expectedValid: true`): kapsam dışı olmak bozuk olmak değildir.
    bytes: Uint8Array.from([
      0x41, 0xcc, 0xa5, 0xff, 0xff, 0x8a, 0x18, 0x00, 0xff, 0xff, 0xda, 0x1c, 0x00, 0x88, 0x18,
      0x00, 0xff, 0xff, 0xda, 0x1c, 0x00, 0x42, 0xfb, 0x60, 0x40, 0x04, 0x01, 0x1f, 0x88, 0xc0,
      0x48, 0x65, 0x6c, 0x6c, 0x6f, 0x20, 0x30, 0x30, 0x35, 0x20, 0x30, 0x78, 0x36, 0x32, 0x36,
      0x42, 0x0a, 0xa5, 0x0b,
    ]),
    description: `${TRANSLATION_KEY_PREFIX}.example.lowpanHc1.description`,
    expectedValid: true,
  },
  {
    id: 'mle-discovery-request',
    name: `${TRANSLATION_KEY_PREFIX}.example.mleDiscoveryRequest.name`,
    // TÜRETİLDİ. Brifin bayt dizisi bir sayı SAPMASI taşıyordu: UDP Length
    // `00 0d` = 13 yazıyordu ama başlık + yük 8 + 7 = 15'ti. Uzunluk burada
    // yükten TÜRETİLİYOR (`plainUdp`), yani sapma yapısal olarak imkânsız.
    bytes: threadFrame(
      [
        ...IPHC_ELIDED_ADDRESSES,
        IPHC_NEXT_HEADER_UDP,
        ...plainUdp(MLE_UDP_PORT, MLE_UDP_PORT, [0xff, 0x10, 0x0d, 0x02, 0x00, 0x02, 0x01]),
      ],
      0x5a,
    ),
    description: `${TRANSLATION_KEY_PREFIX}.example.mleDiscoveryRequest.description`,
    expectedValid: true,
  },
  {
    id: 'mle-encrypted',
    name: `${TRANSLATION_KEY_PREFIX}.example.mleEncrypted.name`,
    // TÜRETİLDİ. MLE Security Suite 0 ⇒ Aux Security Header (Security Control
    // 0x15 = Level 5 `ENC-MIC-32` + Key Id Mode 2) + 4 B Frame Counter +
    // 4 B Key Source + 1 B Key Index = 10 B, sonra ciphertext, EN SONDA 4 B
    // MIC. Komut tipi ciphertext'in İÇİNDE — UYDURULMAZ.
    bytes: threadFrame(
      [
        ...IPHC_ELIDED_ADDRESSES,
        IPHC_NEXT_HEADER_UDP,
        ...plainUdp(MLE_UDP_PORT, MLE_UDP_PORT, [
          0x00, 0x15, 0x2a, 0x00, 0x00, 0x00, 0xde, 0xad, 0xbe, 0xef, 0x03, 0x9c, 0x4e, 0x71, 0x2b,
          0xd8, 0x66, 0x1a, 0x0f, 0x5c, 0x11, 0x22, 0x33, 0x44,
        ]),
      ],
      0x5b,
    ),
    description: `${TRANSLATION_KEY_PREFIX}.example.mleEncrypted.description`,
    expectedValid: true,
  },
  {
    id: 'mac-security-mic',
    name: `${TRANSLATION_KEY_PREFIX}.example.macSecurityMic.name`,
    // TÜRETİLDİ. MAC `Security Enabled = 1`, Security Control 0x0D = Level 5
    // + Key Id Mode 1 ⇒ 1 + 4 + 1 = 6 B başlık, 4 B MIC. MIC ÇIKARILMAZSA
    // şifreli yük 4 bayt UZUN görünürdü — `thread.test.ts` bunu ölçer.
    bytes: threadFrame(
      [
        0x0d, 0x2a, 0x00, 0x00, 0x00, 0x05, 0x9f, 0x27, 0xc4, 0x60, 0x1d, 0xb3, 0x8e, 0x52, 0x7a,
        0x04, 0xe9, 0x66, 0xaa, 0xbb, 0xcc, 0xdd,
      ],
      0x5c,
      true,
    ),
    description: `${TRANSLATION_KEY_PREFIX}.example.macSecurityMic.description`,
    expectedValid: true,
  },
  {
    id: 'mesh-deep-hops',
    name: `${TRANSLATION_KEY_PREFIX}.example.meshDeepHops.name`,
    // TÜRETİLDİ. Mesh dispatch 0xBF = `10` + V = 1 + F = 1 + Hops Left 0xF ⇒
    // hemen ardından **Deep Hops Left** (RFC 4944 §5.2). Koşullu ofset
    // atlanırsa adresler bir bayt kayar, HATA VERMEDEN.
    bytes: threadFrame(
      [
        0xbf,
        0x2a,
        0x12,
        0x34,
        0x56,
        0x78,
        ...IPHC_ELIDED_ADDRESSES,
        IPHC_NEXT_HEADER_UDP,
        ...plainUdp(MLE_UDP_PORT, MLE_UDP_PORT, [0xff, 0x11, 0x0e, 0x02, 0x00, 0x01]),
      ],
      0x5d,
    ),
    description: `${TRANSLATION_KEY_PREFIX}.example.meshDeepHops.description`,
    expectedValid: true,
  },
  {
    id: 'nhc-udp-compressed',
    name: `${TRANSLATION_KEY_PREFIX}.example.nhcUdpCompressed.name`,
    // TÜRETİLDİ. IPHC dispatch **0x7F** — RFC 6282'de IPHC (`011 11111`),
    // RFC 4944'te ESC (`01 111111`). `dispatchProfile` kanalının çıktıyı BAYT
    // DÜZEYİNDE değiştirdiğinin ekrandaki kanıtı. NHC 0xF3 = `11110 011`:
    // C = 0 (checksum TELDE VAR), PP = 11 (iki port da 4 bit, 0xF0Bx).
    bytes: threadFrame(
      [
        0x7f, 0x33, 0xf3, 0x11, 0x12, 0x34, 0x48, 0x65, 0x6c, 0x6c, 0x6f, 0x20, 0x4e, 0x48, 0x43,
      ],
      0x5e,
    ),
    description: `${TRANSLATION_KEY_PREFIX}.example.nhcUdpCompressed.description`,
    expectedValid: true,
  },
  {
    id: 'fcs-mismatch',
    name: `${TRANSLATION_KEY_PREFIX}.example.fcsMismatch.name`,
    // Örnek 1'in son baytı bozuldu — FCS FAIL dalının kanıtı.
    bytes: (() => {
      const corrupted = EXAMPLE_UNCOMPRESSED_IPV6.slice();
      const last = corrupted.length - 1;
      corrupted[last] = (corrupted[last] ?? 0) ^ 0xff;
      return corrupted;
    })(),
    description: `${TRANSLATION_KEY_PREFIX}.example.fcsMismatch.description`,
    expectedValid: false,
  },
];

export const threadPlugin: ProtocolPlugin = {
  id: PROTOCOL_ID,
  name: PROTOCOL_DISPLAY_NAME,
  category: 'wireless-iot',
  parser: threadParser,
  // 'build' sekmesi YOK (katalog) → `encoder` YAZILMAZ.
  documentation: {
    summary: `${TRANSLATION_KEY_PREFIX}.documentation.summary`,
    layer: 'network',
    references: [
      {
        title:
          'RFC 4944 — Transmission of IPv6 Packets over IEEE 802.15.4 Networks; §5.1 is the dispatch table this page implements byte for byte, §5.2 the Mesh header (including the 0xF "Deep Hops Left" escape) and §5.3 the FRAG1/FRAGN pair',
        url: 'https://www.rfc-editor.org/rfc/rfc4944.txt',
      },
      {
        title:
          'RFC 6282 — Compression Format for IPv6 Datagrams over IEEE 802.15.4-Based Networks; §3.1 defines LOWPAN_IPHC, §4 the NHC chain, and §2 moves RFC 4944’s ESC dispatch, which is why the dispatchProfile option exists',
        url: 'https://www.rfc-editor.org/rfc/rfc6282.txt',
      },
      {
        title:
          'draft-kelsey-intarea-mesh-link-establishment-06 — the MLE message format: a Security Suite byte (0 = 802.15.4 Security, 255 = No Security) followed by either an Auxiliary Security Header or a plain command byte',
        url: 'https://datatracker.ietf.org/doc/html/draft-kelsey-intarea-mesh-link-establishment-06',
      },
      {
        title:
          'OpenThread src/core/thread/mle.cpp — the source-level proof that ONLY Discovery Request (16) and Discovery Response (17) are sent unsecured; every other MLE command is encrypted and its command type is NOT readable on the wire. Read the CODE, not the comments: mle.hpp:1498-1502 has the two SecuritySuite comments swapped',
        url: 'https://github.com/openthread/openthread/blob/main/src/core/thread/mle.cpp',
      },
      {
        title:
          'OpenThread src/core/thread/mle_types.hpp — kUdpPort = 19788 (0x4D4C, ASCII "ML"), the MLE port this page gates on, and the MLE command table',
        url: 'https://github.com/openthread/openthread/blob/main/src/core/thread/mle_types.hpp',
      },
      {
        title:
          'tcpdump.org LINK-LAYER HEADER TYPES — LINKTYPE_IEEE802_15_4_WITHFCS (195) is this page’s input contract; NOFCS (230), TAP (283), Linux SLL (191) and NONASK PHY (215) are SEPARATE link types, which is why channel/RSSI/LQI are out of scope here',
        url: 'https://www.tcpdump.org/linktypes.html',
      },
      {
        title:
          'Wireshark SampleCaptures 6LoWPAN.pcap — the capture four of the example frames come from. Its pcap global header says LINKTYPE 1 (Ethernet) because the 802.15.4 frames travel inside ZEP v2 over UDP; stripping the 32-byte ZEP header yields 331 frames whose FCS checks 331/331',
        url: 'https://wiki.wireshark.org/uploads/__moin_import__/attachments/SampleCaptures/6LoWPAN.pcap.gz',
      },
      {
        title:
          'Wireshark epan/dissectors/packet-ieee802154.c — "Existence of the Auxiliary Security Header is controlled by the Security Enabled Field"; the same dissector shows the MIC sits at the END of the frame, before the FCS',
        url: 'https://gitlab.com/wireshark/wireshark/-/raw/master/epan/dissectors/packet-ieee802154.c',
      },
    ],
  },
  exampleFrames: EXAMPLE_FRAMES,
  decodeOptions: DECODE_OPTIONS,
};
