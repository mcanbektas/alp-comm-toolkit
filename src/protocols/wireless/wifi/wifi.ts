/**
 * Wi-Fi (IEEE 802.11) — MAC katmanı (Faz 10, dalga 18a; `wifi` kaydının 1/2'si).
 *
 * `wireless-iot`in — **deponun SON domain'inin** — ilk alt dalgası.
 * Motorun kendisi `dot11Frame.ts`tedir ve **paylaşılan çekirdektir**: 18b
 * (yönetim gövdeleri + IE) ve 18c (`esp-now`) onu TÜKETECEK. Bu dosya yalnız
 * eklentiyi kurar: `canParse`, altı `decodeOptions` kanalı, on örnek çerçeve
 * ve gövdenin HAM bırakılması.
 *
 * ── GİRDİ SÖZLEŞMESİ `[KARAR 18-2]` — dosya başına BİREBİR ────────────────
 * Girdi = **ÇIPLAK IEEE 802.11 MAC çerçevesi, 4 baytlık FCS DAHİL**
 * (`LINKTYPE_IEEE802_11` = 105 gövdesi). **Radiotap (127), PPI (192),
 * Prism (119), AVS (163) başlıkları ve pcap zarfı GİRDİ DEĞİLDİR** — bunlar
 * libpcap'in AYRI link-type'larıdır (`https://www.tcpdump.org/linktypes.html`).
 * Ayrımı biz icat etmedik: beş ayrı numara var ve dördü "metadata + 802.11".
 * Wireshark da ikiye bölüyor (`packet-ieee80211.c` ↔ ayrı dosya
 * `packet-ieee80211-radiotap.c`).
 *
 * ── ROZET `partial` — NEDEN ───────────────────────────────────────────────
 * Şifreli gövde çözülmez · radiotap/PHY metadata ayrı link-type ·
 * A-MSDU/A-MPDU ve defragmentation çerçeveler arası durum · EAPOL/WPA el
 * sıkışması yok · Connection Timeline / Airtime / Coexistence stateful ·
 * **yönetim gövdeleri 18b'de açılacak.**
 *
 * "Yarım motor" DEĞİL: 11 FC alt alanı, dört adresin BAĞLAMA GÖRE rol
 * çözümü, sıra/parça numarası, QoS/HT Control ve FCS PASS/FAIL gerçek
 * çıktılardır. Emsal `zigbee`: dalga 7'de MAC/NWK/APS, dalga 8'de ZCL —
 * aynı kayıt iki dalgada büyüdü.
 *
 * ── `canParse` `true` DÖNER — ÖLÇÜLMÜŞ karar ──────────────────────────────
 * İmza **W12**: protokol sürümü 0 + sınıf-farkındalıklı asgari uzunluk
 * (Mgmt/Data 28, Ctrl ACK/CTS 14, öteki Ctrl 20) + FCS CRC-32 GEÇERLİ.
 * Deponun 899 örneğinde **0** yanlış pozitif; `wpa-Induction.pcap`ın 1093
 * çerçevesinde **1080** doğru pozitif. **AYNI imza FCS'siz 216/899 (%24)**
 * veriyor — FCS bu kaydın auto-detection'da var olabilmesinin TEK sebebidir
 * ve bekçi testi iki sayıyı da kodda TEKRARLAR.
 *
 * **`fcsPresent = no` seçilse bile `canParse` FCS ister** ve bu kasıtlıdır:
 * `canParse` `ProtocolParser` sözleşmesinde seçenek ALMAZ (auto-detection
 * seçeneksiz koşar), `lonworks`ın `payloadKind`inde olduğu gibi.
 *
 * ── 🚨 KANAL YAPILMAYACAKLAR (ve neden) ───────────────────────────────────
 * `decodeOptions` yüzeyi ÇERÇEVEDEN ÇIKARILAMAYAN parametrelere ayrılmıştır;
 * aşağıdakiler kanal DEĞİLDİR ve olmamalarının gerekçesi burada durur ki bir
 * sonraki nesil "unutulmuş" sanmasın (dalga 17 dersi):
 *   · **Kanal / merkez frekans / bant genişliği / RSSI / MCS / spatial
 *     stream / guard interval** — radiotap'in işi, KAPSAM DIŞI. Kanal AÇMAK
 *     "bu bilgiyi biliyoruz" demek olurdu; bilmiyoruz, çünkü girdi ÇIPLAK
 *     MAC çerçevesi.
 *   · **Protokol sürümü geçersiz kılma** — 0 dışı GEÇERSİZDİR (802.11 hiç
 *     başka sürüm tanımlamadı), bir tercih değil.
 *   · **Bayt sırası** — 802.11'in çok baytlı alanları DAİMA little-endian.
 *     Seçenek yaratmak olmayan bir belirsizlik uydurmak olurdu
 *     (`ccp.ts`in reddettiği türden).
 *   · **BSSID'i elle verme** — adres rol matrisi zaten çözüyor; elle vermek
 *     ölçülen bir şeyi tahminle ezmek olurdu.
 *   · **Şifre çözme anahtarı (WEP/TKIP/CCMP/GCMP)** — CLAUDE.md'nin anahtar
 *     kuralı: anahtar yoksa payload `encrypted` bırakılır, UYDURULMAZ. Anahtar
 *     ALANI açmak da el sıkışmasını (EAPOL) ve PTK türetmesini gerektirirdi;
 *     ikisi de kapsam dışı.
 *   · **A-MSDU / A-MPDU ayrıştırma bayrağı** — çerçeveler arası durum
 *     PARSER'A GİRMEZ (dalga 16 bulgu 12).
 *
 * ── `build` SEKMESİ YOK → `encoder` YAZILMAZ ─────────────────────────────
 * Katalog `tabs`ı `['overview','decode','timing','diagnostics','examples']`;
 * `build` yok. 16c/17 gerekçesinin aynısı. `timing` sekmesi bu kayıtta bir
 * hesaplayıcıya bağlanmadığı için "planlandı" basar — airtime/occupancy
 * hesapları çok-çerçeveli ve PHY parametresi ister, ikisi de kapsam dışı.
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

import {
  ADDRESS_ROLE_BOTH,
  ADDRESS_ROLE_RAW,
  ADDRESS_ROLE_RESOLVED,
  DOT11_FCS_LENGTH,
  FCS_PRESENT_AUTO,
  FCS_PRESENT_NO,
  FCS_PRESENT_YES,
  PRESENCE_AUTO,
  PRESENCE_NO,
  PRESENCE_YES,
  VENDOR_LABELS_HIDE,
  VENDOR_LABELS_SHOW,
  createFieldSink,
  decodeDot11Header,
  hasDot11Signature,
  pushDot11Fcs,
  pushField,
  toProtocolWarning,
} from './dot11Frame';
import type { Dot11DecodeOptions } from './dot11Frame';

/** Kayıt defterindeki ve katalogdaki kimlikle AYNI olmak zorunda. */
const PROTOCOL_ID = 'wifi';
/** Protokol adı VERİDİR, çeviriye girmez; katalog kaydıyla birebir aynı. */
const PROTOCOL_DISPLAY_NAME = 'Wi-Fi';

const TRANSLATION_KEY_PREFIX = 'protocol.wifi';

const ERROR_ABORTED = `${TRANSLATION_KEY_PREFIX}.error.aborted`;
const ERROR_EMPTY_FRAME = `${TRANSLATION_KEY_PREFIX}.error.emptyFrame`;
const ERROR_FRAME_TOO_LONG = `${TRANSLATION_KEY_PREFIX}.error.frameTooLong`;

const WARN_BODY_NOT_DECODED = `${TRANSLATION_KEY_PREFIX}.warning.bodyNotDecoded`;
const WARN_ENCRYPTED_PAYLOAD = `${TRANSLATION_KEY_PREFIX}.warning.encryptedPayload`;
const WARN_RADIOTAP_OUT_OF_SCOPE = `${TRANSLATION_KEY_PREFIX}.warning.radiotapOutOfScope`;

const FIELD_WARN_BODY_NOT_DECODED = `${TRANSLATION_KEY_PREFIX}.field.bodyNotDecoded`;
const FIELD_WARN_ENCRYPTED_PAYLOAD = `${TRANSLATION_KEY_PREFIX}.field.encryptedPayload`;

// ── decodeOptions — ALTI kanal ────────────────────────────────────────────
// Hepsi ÇERÇEVEDEN ÇIKARILAMAYAN parametrelerdir. Yapılmayanların listesi ve
// gerekçeleri dosya başındadır ve o liste bu dalganın ZORUNLU çıktısıdır.

const OPTION_FCS_PRESENT = 'fcsPresent';
const OPTION_ADDRESS_ROLE_DISPLAY = 'addressRoleDisplay';
const OPTION_QOS_CONTROL_PRESENT = 'qosControlPresent';
const OPTION_HT_CONTROL_PRESENT = 'htControlPresent';
const OPTION_PROTECTED_PAYLOAD_DISPLAY = 'protectedPayloadDisplay';
const OPTION_VENDOR_ADDRESS_LABELS = 'vendorAddressLabels';

const PROTECTED_DISPLAY_MARKED = 'marked';
const PROTECTED_DISPLAY_HEX = 'hex';

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
    id: OPTION_ADDRESS_ROLE_DISPLAY,
    label: `${TRANSLATION_KEY_PREFIX}.option.addressRoleDisplay`,
    kind: 'select',
    defaultValue: ADDRESS_ROLE_RESOLVED,
    description: `${TRANSLATION_KEY_PREFIX}.option.addressRoleDisplay.description`,
    choices: [
      {
        value: ADDRESS_ROLE_RESOLVED,
        label: `${TRANSLATION_KEY_PREFIX}.option.addressRoleDisplay.resolved`,
      },
      { value: ADDRESS_ROLE_RAW, label: `${TRANSLATION_KEY_PREFIX}.option.addressRoleDisplay.raw` },
      { value: ADDRESS_ROLE_BOTH, label: `${TRANSLATION_KEY_PREFIX}.option.addressRoleDisplay.both` },
    ],
  },
  {
    id: OPTION_QOS_CONTROL_PRESENT,
    label: `${TRANSLATION_KEY_PREFIX}.option.qosControlPresent`,
    kind: 'select',
    defaultValue: PRESENCE_AUTO,
    description: `${TRANSLATION_KEY_PREFIX}.option.qosControlPresent.description`,
    choices: [
      { value: PRESENCE_AUTO, label: `${TRANSLATION_KEY_PREFIX}.option.presence.auto` },
      { value: PRESENCE_YES, label: `${TRANSLATION_KEY_PREFIX}.option.presence.yes` },
      { value: PRESENCE_NO, label: `${TRANSLATION_KEY_PREFIX}.option.presence.no` },
    ],
  },
  {
    id: OPTION_HT_CONTROL_PRESENT,
    label: `${TRANSLATION_KEY_PREFIX}.option.htControlPresent`,
    kind: 'select',
    defaultValue: PRESENCE_AUTO,
    description: `${TRANSLATION_KEY_PREFIX}.option.htControlPresent.description`,
    choices: [
      { value: PRESENCE_AUTO, label: `${TRANSLATION_KEY_PREFIX}.option.presence.auto` },
      { value: PRESENCE_YES, label: `${TRANSLATION_KEY_PREFIX}.option.presence.yes` },
      { value: PRESENCE_NO, label: `${TRANSLATION_KEY_PREFIX}.option.presence.no` },
    ],
  },
  {
    id: OPTION_PROTECTED_PAYLOAD_DISPLAY,
    label: `${TRANSLATION_KEY_PREFIX}.option.protectedPayloadDisplay`,
    kind: 'select',
    defaultValue: PROTECTED_DISPLAY_MARKED,
    description: `${TRANSLATION_KEY_PREFIX}.option.protectedPayloadDisplay.description`,
    choices: [
      {
        value: PROTECTED_DISPLAY_MARKED,
        label: `${TRANSLATION_KEY_PREFIX}.option.protectedPayloadDisplay.marked`,
      },
      {
        value: PROTECTED_DISPLAY_HEX,
        label: `${TRANSLATION_KEY_PREFIX}.option.protectedPayloadDisplay.hex`,
      },
    ],
  },
  {
    id: OPTION_VENDOR_ADDRESS_LABELS,
    label: `${TRANSLATION_KEY_PREFIX}.option.vendorAddressLabels`,
    kind: 'select',
    defaultValue: VENDOR_LABELS_SHOW,
    description: `${TRANSLATION_KEY_PREFIX}.option.vendorAddressLabels.description`,
    choices: [
      { value: VENDOR_LABELS_SHOW, label: `${TRANSLATION_KEY_PREFIX}.option.vendorAddressLabels.show` },
      { value: VENDOR_LABELS_HIDE, label: `${TRANSLATION_KEY_PREFIX}.option.vendorAddressLabels.hide` },
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

function hexBytes(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).toUpperCase().padStart(2, '0')).join(' ');
}

// ── Çözüm ─────────────────────────────────────────────────────────────────

function parseWifi(data: Uint8Array, context?: ParseContext): ParseResult {
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
  const headerOptions: Dot11DecodeOptions = {
    fcsPresent: readSelect(options, OPTION_FCS_PRESENT, FCS_PRESENT_AUTO),
    addressRoleDisplay: readSelect(options, OPTION_ADDRESS_ROLE_DISPLAY, ADDRESS_ROLE_RESOLVED),
    qosControlPresent: readSelect(options, OPTION_QOS_CONTROL_PRESENT, PRESENCE_AUTO),
    htControlPresent: readSelect(options, OPTION_HT_CONTROL_PRESENT, PRESENCE_AUTO),
    vendorAddressLabels: readSelect(options, OPTION_VENDOR_ADDRESS_LABELS, VENDOR_LABELS_SHOW),
  };
  const protectedDisplay = readSelect(
    options,
    OPTION_PROTECTED_PAYLOAD_DISPLAY,
    PROTECTED_DISPLAY_MARKED,
  );

  const sink = createFieldSink();
  const errors: ProtocolError[] = [];
  const warnings: ProtocolWarning[] = [];

  const header = decodeDot11Header(data, sink, warnings, errors, headerOptions);

  // Girdi sözleşmesi her çözümde AÇIKÇA söylenir: kullanıcı radiotap'li bir
  // çerçeveyi yapıştırırsa neden çözülmediğini EKRANDA görmeli.
  warnings.push(toProtocolWarning('radiotapOutOfScope', WARN_RADIOTAP_OUT_OF_SCOPE));

  if (header.readable && header.bodyLength > 0) {
    const bodyBytes = data.slice(header.bodyOffset, header.bodyOffset + header.bodyLength);
    const encrypted = header.protectedFrame;
    const showHex = protectedDisplay === PROTECTED_DISPLAY_HEX || !encrypted;
    pushField(sink, {
      id: 'body',
      name: encrypted ? '802.11 · Frame Body (encrypted)' : '802.11 · Frame Body',
      offset: header.bodyOffset,
      length: header.bodyLength,
      rawBytes: bodyBytes,
      physicalValue: showHex
        ? hexBytes(bodyBytes)
        : `encrypted payload, ${String(header.bodyLength)} B — not decoded`,
      valid: true,
      warnings: [encrypted ? FIELD_WARN_ENCRYPTED_PAYLOAD : FIELD_WARN_BODY_NOT_DECODED],
    });

    if (encrypted) {
      // CLAUDE.md anahtar kuralı: anahtar yoksa ÖTEYE İNİLMEZ, UYDURULMAZ.
      warnings.push(
        toProtocolWarning(
          'encryptedPayload',
          WARN_ENCRYPTED_PAYLOAD,
          header.bodyOffset,
          header.bodyLength,
        ),
      );
    } else {
      // Yönetim gövdeleri 18b'nin işi; Control/Data gövdeleri KAPSAM DIŞI.
      warnings.push(
        toProtocolWarning(
          'bodyNotDecoded',
          WARN_BODY_NOT_DECODED,
          header.bodyOffset,
          header.bodyLength,
        ),
      );
    }
  }

  // FCS bir KUYRUKTUR: gövdeden SONRA basılır ki alan listesi ofset sırasını
  // korusun (`dot11Frame.ts`in `pushDot11Fcs` gerekçesi).
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

export const wifiParser: ProtocolParser = {
  protocolId: PROTOCOL_ID,
  displayName: PROTOCOL_DISPLAY_NAME,

  /**
   * `true` DÖNER — imza W12, ölçülmüş karar (dosya başı). `decodeOptions`
   * BURAYA GİRMEZ (`ProtocolParser` sözleşmesi): `fcsPresent` `no` yapılmış
   * olsa bile auto-detection imzası HÂLÂ FCS ister, çünkü FCS'siz imza aynı
   * kümede 216 çerçeve çalıyor.
   */
  canParse(data: Uint8Array): boolean {
    return hasDot11Signature(data);
  },

  parse(data: Uint8Array, context?: ParseContext): ParseResult {
    return parseWifi(data, context);
  },
};

// ── Örnekler ──────────────────────────────────────────────────────────────
// İlk SEKİZİ Wireshark SampleCaptures'ın `wpa-Induction.pcap` yakalamasının
// (DLT 127, 1093 çerçeve, "Coherer" ağı) GERÇEK çerçeveleridir; radiotap'in
// 24 baytı SOYULMUŞTUR. Sekizincisi yakalamanın KENDİ bozuk çerçevesidir —
// uydurulmadı. Son İKİSİ 3)'ten TÜRETİLDİ ve FCS'leri `computeNamedCrc` ile
// YENİDEN HESAPLANDI (elle yazılmadı).
//
// Keşif turunun elle çözümü UYGULAMADA YENİDEN ÇÖZÜLDÜ: sekiz çerçevenin
// hepsinde uzunluk aritmetiği (`başlık + gövde + FCS === n`) ve FCS ayrı ayrı
// doğrulandı; SAPMA BULUNMADI (dalga 17'nin "brifin kendi çözümü bir bayt
// atlıyordu" dersi bu turda tekrarlamadı).

function hexToBytes(hex: string): Uint8Array {
  const parts = hex.trim().split(/\s+/);
  const bytes = new Uint8Array(parts.length);
  for (let index = 0; index < parts.length; index += 1) {
    bytes[index] = Number.parseInt(parts[index] ?? '0', 16) & 0xff;
  }
  return bytes;
}

/** ACK — 14 B, EN KISA ÇERÇEVE. A2 ve SeqCtl YOK: ofset zincirinin sınavı. */
const FRAME_ACK = 'd4 00 00 00 00 0c 41 82 b2 55 b3 33 6b 7c';

/** Beacon — 144 B. 24 (MAC) + 12 (sabit) + 104 (IE) + 4 (FCS). SSID "Coherer". */
const FRAME_BEACON =
  '80 00 00 00 ff ff ff ff ff ff 00 0c 41 82 b2 55 00 0c 41 82 b2 55 50 f8 ' +
  '89 f1 d4 1b 01 00 00 00 64 00 11 04 00 07 43 6f 68 65 72 65 72 01 08 82 ' +
  '84 8b 96 24 30 48 6c 03 01 01 05 04 00 01 00 00 2a 01 02 2f 01 02 30 18 ' +
  '01 00 00 0f ac 02 02 00 00 0f ac 04 00 0f ac 02 01 00 00 0f ac 02 00 00 ' +
  '32 04 0c 12 18 60 dd 06 00 10 18 02 00 04 dd 1c 00 50 f2 01 01 00 00 50 ' +
  'f2 02 02 00 00 50 f2 04 00 50 f2 02 01 00 00 50 f2 02 00 00 9f 61 c9 5c';

/** Korumalı Data — 94 B. ToDS=0/FromDS=1: matrisin ikinci dalının KANITI. */
const FRAME_PROTECTED_DATA =
  '08 42 00 00 01 80 c2 00 00 00 00 0c 41 82 b2 55 00 0c 41 82 b2 55 70 f8 ' +
  '02 22 cd a0 00 00 00 00 94 1c 1e be e0 4c b1 71 60 98 40 d1 66 cf 56 84 ' +
  'a1 20 9a f1 d5 e1 e9 4c cc d5 6a a0 68 33 1e cd 8d d1 2e f9 eb 8d 93 21 ' +
  '36 28 1b 8c c2 33 ff 69 42 4e 90 13 c7 9f 02 84 77 59 71 3e e0 e5';

/** Probe Request — 53 B. Addr3 broadcast (wildcard BSSID): `W5`in ilk karşı örneği. */
const FRAME_PROBE_REQUEST =
  '40 00 00 00 ff ff ff ff ff ff 00 0d 93 82 36 3a ff ff ff ff ff ff 10 00 ' +
  '00 07 43 6f 68 65 72 65 72 01 08 02 04 0b 16 24 30 48 6c 32 04 0c 12 18 ' +
  '60 f7 89 66 6d';

/** Authentication — 34 B. Addr3 ≠ Addr2: `W5`in yanlış NEGATİF ürettiği çerçeve. */
const FRAME_AUTHENTICATION =
  'b0 00 3a 01 00 0c 41 82 b2 55 00 0d 93 82 36 3a 00 0c 41 82 b2 55 70 01 ' +
  '00 00 01 00 00 00 0d f2 fd 2d';

/** Association Response — 58 B. 24 + 30 (6 sabit + 24 IE) + 4. */
const FRAME_ASSOCIATION_RESPONSE =
  '10 00 3a 01 00 0d 93 82 36 3a 00 0c 41 82 b2 55 00 0c 41 82 b2 55 a0 fc ' +
  '11 04 00 00 01 c0 01 08 82 84 8b 96 24 30 48 6c 32 04 0c 12 18 60 dd 06 ' +
  '00 10 18 02 00 04 4e a3 d6 0e';

/** Disassociation — 30 B. 24 + 2 (Reason Code) + 4. */
const FRAME_DISASSOCIATION =
  'a0 00 3a 01 00 0c 41 82 b2 55 00 0d 93 82 36 3a 00 0c 41 82 b2 55 50 0b ' +
  '08 00 fe aa 65 ac';

/**
 * BOZUK FCS — 65 B. **Uydurulmuş değil**: yakalamanın KENDİSİNDE bozuk olan
 * 13 çerçeveden biri. Protokol sürümü 0 ve uzunluk 28'i geçiyor, yani W12'yi
 * YALNIZ FCS'te eliyor — bekçi testinin bilinçli istisnası tam olarak budur.
 */
const FRAME_CORRUPT_FCS =
  '40 00 00 64 ef bf b9 f8 fe 3b 4a 91 5a a3 e4 0b f4 9f 8f ea 7b e6 d5 22 ' +
  'e1 1f 8b 1f 60 59 82 57 60 70 30 ca dd 2b b3 e0 49 13 b3 36 76 81 6e 83 ' +
  '84 0b 16 23 79 ef d3 c6 1d 7a 79 cb c9 10 fd 3f 58';

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

/**
 * TÜRETİLMİŞ — dört adresli WDS/mesh (ToDS = FromDS = 1). Matrisin DÖRDÜNCÜ
 * dalı gerçek yakalamada YOK. 3)'ün başlığında `b[1]` 0x42 → 0x43 yapıldı ve
 * ofset 24'e altı baytlık Address 4 (SA) EKLENDİ; gövde 3)'ün gövdesidir.
 * `[BEKLENTİ]` — tel doğrulaması yakalamadan gelmiyor, aritmetikten geliyor.
 */
function deriveFourAddressFrame(): Uint8Array {
  const source = hexToBytes(FRAME_PROTECTED_DATA);
  const bodyStart = 24;
  const bodyEnd = source.length - DOT11_FCS_LENGTH;
  const address4 = hexToBytes('00 0d 93 82 36 3a');
  const built = new Uint8Array(bodyStart + address4.length + (bodyEnd - bodyStart));
  built.set(source.subarray(0, bodyStart), 0);
  built[1] = 0x43; // ToDS = 1, FromDS = 1, Protected = 1
  built.set(address4, bodyStart);
  built.set(source.subarray(bodyStart, bodyEnd), bodyStart + address4.length);
  return withRecomputedFcs(built);
}
const FRAME_FOUR_ADDRESS = deriveFourAddressFrame();

/**
 * TÜRETİLMİŞ — QoS Data (alt tip 8). QoS Control alanının VARLIĞINI kanıtlar.
 * 3)'ün `b[0]`ı 0x08 → 0x88 yapıldı (type 2, subtype 8) ve ofset 24'e iki
 * baytlık QoS Control (`06 00` ⇒ TID 6) EKLENDİ. `Protected` biti KORUNDU:
 * gövde 3)'ün ciphertext'idir ve onu "düz metin" ilan etmek yalan olurdu.
 * `[BEKLENTİ]`
 */
function deriveQosDataFrame(): Uint8Array {
  const source = hexToBytes(FRAME_PROTECTED_DATA);
  const bodyStart = 24;
  const bodyEnd = source.length - DOT11_FCS_LENGTH;
  const qosControl = hexToBytes('06 00');
  const built = new Uint8Array(bodyStart + qosControl.length + (bodyEnd - bodyStart));
  built.set(source.subarray(0, bodyStart), 0);
  built[0] = 0x88; // type 2 (Data), subtype 8 (QoS Data)
  built.set(qosControl, bodyStart);
  built.set(source.subarray(bodyStart, bodyEnd), bodyStart + qosControl.length);
  return withRecomputedFcs(built);
}
const FRAME_QOS_DATA = deriveQosDataFrame();

const EXAMPLE_FRAMES: ExampleFrame[] = [
  {
    id: 'beacon',
    name: `${TRANSLATION_KEY_PREFIX}.example.beacon.name`,
    bytes: hexToBytes(FRAME_BEACON),
    description: `${TRANSLATION_KEY_PREFIX}.example.beacon.description`,
    expectedValid: true,
  },
  {
    id: 'ack',
    name: `${TRANSLATION_KEY_PREFIX}.example.ack.name`,
    bytes: hexToBytes(FRAME_ACK),
    description: `${TRANSLATION_KEY_PREFIX}.example.ack.description`,
    expectedValid: true,
  },
  {
    id: 'protected-data',
    name: `${TRANSLATION_KEY_PREFIX}.example.protectedData.name`,
    bytes: hexToBytes(FRAME_PROTECTED_DATA),
    description: `${TRANSLATION_KEY_PREFIX}.example.protectedData.description`,
    expectedValid: true,
  },
  {
    id: 'probe-request',
    name: `${TRANSLATION_KEY_PREFIX}.example.probeRequest.name`,
    bytes: hexToBytes(FRAME_PROBE_REQUEST),
    description: `${TRANSLATION_KEY_PREFIX}.example.probeRequest.description`,
    expectedValid: true,
  },
  {
    id: 'authentication',
    name: `${TRANSLATION_KEY_PREFIX}.example.authentication.name`,
    bytes: hexToBytes(FRAME_AUTHENTICATION),
    description: `${TRANSLATION_KEY_PREFIX}.example.authentication.description`,
    expectedValid: true,
  },
  {
    id: 'association-response',
    name: `${TRANSLATION_KEY_PREFIX}.example.associationResponse.name`,
    bytes: hexToBytes(FRAME_ASSOCIATION_RESPONSE),
    description: `${TRANSLATION_KEY_PREFIX}.example.associationResponse.description`,
    expectedValid: true,
  },
  {
    id: 'disassociation',
    name: `${TRANSLATION_KEY_PREFIX}.example.disassociation.name`,
    bytes: hexToBytes(FRAME_DISASSOCIATION),
    description: `${TRANSLATION_KEY_PREFIX}.example.disassociation.description`,
    expectedValid: true,
  },
  {
    id: 'four-address-wds',
    name: `${TRANSLATION_KEY_PREFIX}.example.fourAddressWds.name`,
    bytes: FRAME_FOUR_ADDRESS,
    description: `${TRANSLATION_KEY_PREFIX}.example.fourAddressWds.description`,
    expectedValid: true,
  },
  {
    id: 'qos-data',
    name: `${TRANSLATION_KEY_PREFIX}.example.qosData.name`,
    bytes: FRAME_QOS_DATA,
    description: `${TRANSLATION_KEY_PREFIX}.example.qosData.description`,
    expectedValid: true,
  },
  {
    id: 'corrupt-fcs',
    name: `${TRANSLATION_KEY_PREFIX}.example.corruptFcs.name`,
    bytes: hexToBytes(FRAME_CORRUPT_FCS),
    description: `${TRANSLATION_KEY_PREFIX}.example.corruptFcs.description`,
    expectedValid: false,
  },
];

export const wifiPlugin: ProtocolPlugin = {
  id: PROTOCOL_ID,
  name: PROTOCOL_DISPLAY_NAME,
  category: 'wireless-iot',
  parser: wifiParser,
  // 'build' sekmesi YOK (katalog) → `encoder` YAZILMAZ.
  documentation: {
    summary: `${TRANSLATION_KEY_PREFIX}.documentation.summary`,
    layer: 'data-link',
    references: [
      {
        title:
          'tcpdump.org LINK-LAYER HEADER TYPES — LINKTYPE_IEEE802_11 (105) is the bare frame; RADIOTAP (127), PRISM (119), AVS (163) and PPI (192) are SEPARATE link types, which is why capture metadata is out of scope here',
        url: 'https://www.tcpdump.org/linktypes.html',
      },
      {
        title:
          'Wireshark epan/dissectors/packet-ieee80211.c — the largest dissector in the project (64,051 lines); its register_dissector("wlan_withfcs") / ("wlan_withoutfcs") pair is the source-level proof that FCS presence is not derivable from the frame',
        url: 'https://gitlab.com/wireshark/wireshark/-/raw/master/epan/dissectors/packet-ieee80211.c',
      },
      {
        title:
          'Wireshark epan/dissectors/packet-ieee80211-radiotap.c — radiotap lives in its own dissector (7,480 lines), mirroring the link-type split',
        url: 'https://gitlab.com/wireshark/wireshark/-/raw/master/epan/dissectors/packet-ieee80211-radiotap.c',
      },
      {
        title:
          'Wireshark SampleCaptures wpa-Induction.pcap — 1,093 real 802.11 frames (DLT 127) of the "Coherer" network; every example frame on this page comes from it with the radiotap header stripped',
        url: 'https://wiki.wireshark.org/uploads/__moin_import__/attachments/SampleCaptures/wpa-Induction.pcap',
      },
      {
        title:
          'IEEE Standard 802.11 (via the IEEE GET Program) — normative source for the Frame Control subfields, the address role matrix and the +HTC/Order type dependency',
        url: 'https://standards.ieee.org/ieee/802.11/7028/',
      },
      {
        title:
          'IEEE Registration Authority MA-L (OUI) public listing — the source of the five vendor labels this page carries; the repository intentionally does NOT ship the full registry',
        url: 'https://standards-oui.ieee.org/oui/oui.csv',
      },
    ],
  },
  exampleFrames: EXAMPLE_FRAMES,
  decodeOptions: DECODE_OPTIONS,
};
