/**
 * Cyphal (UAVCAN v1) — Cyphal/CAN, **Classic CAN 2.0B** transfer çözümü.
 *
 * Faz 10, dalga 15b. 15a'nın `dronecan.ts`i bittikten SONRA yazıldı ve ondan
 * BAĞIMSIZDIR: bu dosya `dronecan.ts`ten HİÇBİR ŞEY import ETMEZ.
 *
 * ── NEDEN DRONECAN'DEN AYRI DOSYA (14c'nin `ccp.ts` dersi) ──────────────────
 * Cyphal (UAVCAN v1) ile DroneCAN (UAVCAN v0) **aynı adı paylaşan iki AYRI
 * protokoldür**. Tail byte'ın ŞEKLİ benzer (SOT/EOT/Toggle/Transfer-ID) ama
 * CAN ID alan düzeni BAŞTAN SONA farklıdır ve toggle semantiği TERSTİR:
 *
 *   | | DroneCAN v0 | Cyphal v1 |
 *   |---|---|---|
 *   | Priority | 5 bit (28:24) | **3 bit (28:26)** |
 *   | Service-not-message | bit **7** | bit **25** |
 *   | Mesaj tip alanı | Message Type ID 16 bit (23:8) | **Subject-ID 13 bit (20:8)** |
 *   | Servis tip alanı | Service Type ID 8 bit (23:16) | **Service-ID 9 bit (22:14)** |
 *   | Anonim mesaj | Source Node ID **= 0** | **bit 24 = 1** (node-ID 0 normal bir düğümdür) |
 *   | İlk çerçevede Toggle | **0** | **1** |
 *   | Transfer CRC yeri | ilk çerçevenin BAŞI | **son çerçevenin SONU** |
 *   | Transfer CRC girdisi | data type signature + payload | **yalnız payload + dolgu** |
 *
 * Ortak tek şey `canFrame.ts`in SocketCAN konteyneridir — 15a'nın da paylaştığı
 * şey odur. Ortak bir çözücü, iki protokolün ayrıştığı HER kodu sessizce yanlış
 * çözerdi (`ccp.ts`in `xcpPacket.ts`ten ayrı tutulma kararının birebir aynısı).
 *
 * ── KAPSAM: Cyphal/CAN CLASSIC-ONLY, rozet `partial` (BİLİNÇLİ KARAR) ───────
 * Katalog üç taşıyıcı vadediyor (`Cyphal/CAN`, `Cyphal/UDP`, `Cyphal/Serial`);
 * resmî ekosistem de üçünü destekliyor. Bu motor YALNIZ **Cyphal/CAN, Classic
 * CAN 2.0B**'yi çözer. **Bu bir KAYNAK EKSİKLİĞİ DEĞİLDİR** — Cyphal spec'i
 * tamamen açıktır ve aşağıdaki kaynak turunda beş doğrulama noktasının BEŞİ de
 * iki bağımsız kaynakta BİREBİR örtüştü. Kapsam sınırı bir MÜHENDİSLİK
 * kararıdır: üç taşıyıcı üç ayrı tel biçimidir. Emsal bol ve hepsi `partial`
 * kapandı: `iec-61850` GOOSE-only, `cc-link-ie` 0x890F-only,
 * `foundation-fieldbus` HSE-only, `as-interface` klasik-only.
 *
 * **CAN FD de KAPSAM DIŞIDIR ve AÇIKÇA reddedilir** (`unsupported-encoding`,
 * `xcpOnCan.ts:169` emsali). Gerekçesi "ucuz olur, sonra eklerim" değil,
 * ÖLÇÜLEBİLİR bir tel farkı: CAN FD'nin DLC granülaritesi bayt düzeyinde
 * DEĞİLDİR (9..64 arasında yalnız 12/16/20/24/32/48/64 uzunlukları var), bu
 * yüzden FD çerçevelerinde payload ile tail byte arasına **sıfır dolgu baytları
 * girer ve bu dolgu baytları transfer CRC'sinin İÇİNE dahildir** (resmî spec,
 * "Transfer payload decomposition" + "Transfer CRC"; aşağıdaki kaynak turunda
 * spec'in KENDİ FD örneğiyle sayısal olarak doğrulandı: 92 baytlık dizi + 14
 * dolgu baytı → CRC `0xBC19`, spec'in bastığı değerle BİREBİR). Yani FD "aynı
 * biçim, daha uzun payload" DEĞİLDİR; sessizce classic gibi çözmek dolgu
 * baytlarını payload sanardı. Classic CAN'de DLC 0..8 birebir olduğu için
 * dolgu HİÇ oluşmaz — bu motorun classic'e kilitlenmesinin teknik sebebi budur.
 *
 * ── KAYNAK TURU (2026-08-25, İKİ BAĞIMSIZ KAYNAK DOĞRUDAN İNDİRİLDİ) ────────
 * 1. **Resmî Cyphal Specification kaynağı (LaTeX)** —
 *    `github.com/OpenCyphal/specification`, `specification/transport/can/can.tex`
 *    ve `specification/appendices/crc.tex`. `opencyphal.org/specification/`
 *    PDF'inin ÜRETİLDİĞİ kaynak; PDF yerine .tex kullanıldı çünkü tablolar
 *    satır satır okunabiliyor. (15a'da `dronecan.github.io` 404 vermişti; bu
 *    turda ölü adres ÇIKMADI, `opencyphal.org` ve GitHub kaynakları çalıştı.
 *    Tek düzeltme: `pycyphal` deposu `pycyphal/transport/can/…` yolundan
 *    `src/pycyphal2/can/…` yoluna TAŞINMIŞ, eski yol 404 veriyor.)
 * 2. **Referans uygulamalar (bağımsız çapraz kontrol)** — `libcanard`
 *    (`github.com/OpenCyphal/libcanard`, C) ve `pycyphal`
 *    (`github.com/OpenCyphal/pycyphal`, `src/pycyphal2/can/_wire.py`).
 *
 * Beş doğrulama noktasının HEPSİ iki kaynakta BİREBİR örtüştü — hiçbir alan
 * "ham + uyarı" durumunda BIRAKILMADI:
 *
 *  1. **29-bit CAN ID alan düzeni** — spec `can.tex` fig. "CAN ID bit layout"
 *     tabloları; `libcanard` `canard_publish_13b`/`tx_1v0_service`;
 *     `pycyphal2` `make_can_id`/`parse_frames`. Aşağıdaki tablo bu üçünün
 *     kesişimi.
 *  2. **Node-ID aralığı** — `[0, 127]`, 7 bit. Spec "Maximum node-ID value: 127
 *     (7 bits wide)"; `CANARD_NODE_ID_MAX 127U`; `NODE_ID_MAX = 127`.
 *     **v0'dan FARKI:** Cyphal'da node-ID **0 geçerli bir düğümdür**; anonimlik
 *     ayrı bir bittir (bit 24). v0'da 0 "anonim" demekti.
 *  3. **Transfer-ID genişliği** — 5 bit, modulo 32, `[0, 31]`. Spec "Transfer-ID
 *     mode: Cyclic, modulo 32"; `CANARD_TRANSFER_ID_BITS 5U`;
 *     `TRANSFER_ID_MODULO = 32`. **v0 ile AYNI** — yani transfer-ID genişliği
 *     bir ayrım ölçütü DEĞİLDİR (brifin "v1'de farklı olduğu iddiası var"
 *     uyarısı ÇÜRÜDÜ, bkz. dosya sonu "Çürüyen tahmin").
 *  4. **Transfer CRC** — **CRC-16/CCITT-FALSE** (poly `0x1021`, init `0xFFFF`,
 *     reflect yok, xorout yok, check `0x29B1`). Spec `crc.tex`; `libcanard`
 *     `CRC_INITIAL 0xFFFFU` + `crc_table` (`0x0000,0x1021,0x2042,…`, klasik
 *     MSB-first 0x1021 tablosu); `pycyphal2` `CRC_INITIAL =
 *     CRC16CCITT_FALSE_INITIAL`. **CRC-32C DEĞİL** — CRC-32C Cyphal/**UDP**'nin
 *     CRC'sidir, Cyphal/CAN'in değil (brifin "CRC-32C iddiası vardır" uyarısı
 *     bu şekilde çözüldü). Depodaki `CRC16_CCITT_FALSE` birebir aynı; **KATALOG
 *     EKLEMESİ YOK**, `CrcCalculatorTool.test.tsx`in 34 sayısı DEĞİŞMEZ.
 *  5. **Toggle bitinin başlangıç değeri** — **1**. Spec tail byte tablosu:
 *     tek çerçevede "Always 1", çok çerçevelide "First frame: 1, then
 *     alternates". `libcanard`: `bool toggle = true; // Cyphal transfers start
 *     with toggle==1, unlike legacy` ve `// Version detection: v1 requires the
 *     toggle to start from 1, v0 starts from 0.` `pycyphal2` aynısı.
 *     **v0'ın TERSİ** — dalganın en keskin ayrım ölçütü budur ve
 *     `uavcanCompatibility.ts` bunun üstüne kuruludur.
 *
 * **Spec'in KENDİ örnekleriyle sayısal doğrulama** (`can.tex` "Examples"):
 * `0x107D552A` → prio 4 (Nominal), message, subject-ID **7509** (Heartbeat),
 * source node **42**, tail `0xE0` → SOT=1, EOT=1, Toggle=**1** (v0'da 0 olurdu),
 * Transfer-ID=0.
 * `0x136B957B` → service **request**, service-ID **430** (`uavcan.node.GetInfo`),
 * dst **42**, src **123**. `0x126BBDAA` → aynı servisin **response**'u,
 * dst 123, src 42. Bu üç kimlik `EXAMPLE_FRAMES`te BİREBİR kullanılıyor —
 * uydurulmuş CAN ID yok (spec §43 fixture disiplini, CLAUDE.md).
 *
 * ── CAN ID ALAN DÜZENİ (29 bit, yüksekten alçağa) ───────────────────────────
 *   Message (v1.0) : Priority(3) · SNM(1)=0 · Anonymous(1) · R23(1)=0 ·
 *                    R22(1) · R21(1) · Subject-ID(13) · R7(1)=0 · Source Node-ID(7)
 *   Message (v1.1) : Priority(3) · SNM(1)=0 · R24(1)=0 · Subject-ID(16) ·
 *                    R7(1)=**1** · Source Node-ID(7)      ← DENEYSEL, opt-in
 *   Service        : Priority(3) · SNM(1)=1 · Request-not-response(1) ·
 *                    R23(1)=0 · Service-ID(9) · Destination Node-ID(7) ·
 *                    Source Node-ID(7)
 *
 * **AYRIM KURALI — SIRA ÖNEMLİ** (`decodeCyphalIdentity`): (1) SNM biti
 * (**bit 25**) 1 ise Service; (2) değilse Message, ve bit **7** mesajın
 * SÜRÜMÜNÜ söyler (0 → v1.0 13-bit subject-ID, 1 → v1.1 16-bit subject-ID).
 * Anonimlik SON bakılan şeydir (bit 24) — v0'ın "source node-ID 0 mı" sorusu
 * BURADA GEÇERSİZDİR ve sırayı ona göre kurmak Cyphal'ın 0 numaralı düğümünü
 * anonim sanardı.
 *
 * **R22/R21 DENETLENMEZ** — spec bu iki biti "Transmit 1; ignore (do not check)
 * when receiving" diye tanımlıyor, ve spec'in KENDİ anonim örneği
 * (`0x11133775`) onları 0 basıyor. Denetlemek spec örneğini reddederdi.
 * **R23 ve (mesajda) R7 ise DENETLENİR** — spec ikisi için de "Discard frame
 * if this field has a different value" diyor.
 *
 * ── `decodeOptions` ─────────────────────────────────────────────────────────
 * • `transport` — TEK şık: `can`. Kanal, kapsam sınırını kullanıcıya GÖRÜNÜR
 *   kılmak için var (`Cyphal/UDP` ve `Cyphal/Serial` şıkkı YOKTUR, "sonra
 *   gelecek" vaadi de yoktur; açıklama metni ikisini adıyla kapsam dışı ilan
 *   eder). Sahte kanal açmaktansa dürüst tek şık.
 * • `specVersion` — `v1.0` (varsayılan, stable) · `v1.1` (**experimental**).
 *   Spec bunu zorunlu kılıyor: v1.0'da bit 7 "Discard frame if this field has a
 *   different value" ile SIFIR olmak zorunda; 16-bit subject-ID'yi taşıyan
 *   v1.1 biçimi bit 7'yi 1 yaparak kendini ayırıyor. Yani v1.1'i çözmek
 *   v1.0'ın bir KURALINI ÇİĞNEMEK demektir — bu ancak AÇIK opt-in ile olur.
 *   `v1.1` seçildiğinde **koşulsuz** `experimentalSpecVersion` uyarısı basılır
 *   (`ccp.ts`in legacy uyarısının aynı biçimi).
 *
 * ── TRANSFER CRC: GÖSTERİLİR, DOĞRULANMAZ — ama GEREKÇESİ v0'DAN FARKLI ─────
 * DroneCAN'de CRC doğrulanamıyordu çünkü girdisi DSDL'den gelen bir data type
 * signature içeriyor (depoda DSDL derleyicisi YOK). **Cyphal'da böyle bir tohum
 * YOKTUR** — CRC doğrudan `0xFFFF`ten başlayıp payload + dolgu üzerinde
 * hesaplanır, yani MATEMATİKSEL olarak doğrulanabilir. Doğrulanmamasının sebebi
 * başka: CRC **transferin SONUNA** eklenir ve **TÜM çerçevelerin payload'ını**
 * kapsar — tek bir çerçeveden hesaplanamaz. Bu ÇERÇEVELER ARASI durumdur ve
 * `mavlink.ts`in SEQ-LOSS kararıyla analyzer katmanına aittir (bulgu 10).
 * Bu yüzden: son çerçevede tail byte'tan ÖNCEKİ iki bayt `transfer-crc` alanı
 * olarak (big-endian, spec: "most significant byte first") GÖSTERİLİR,
 * `transferCrcNeedsFullTransfer` uyarısıyla. Spec'in kendi örneği CRC'nin İKİ
 * çerçeveye bölünebildiğini gösteriyor (`… 9A 01` / `E7 61`) — son çerçevede
 * yalnız 1 bayt kalmışsa alan KISMİ olarak, ayrı bir uyarıyla basılır.
 * "Gösterilir" ile "doğrulanır" ayrımı kullanıcıya AÇIKÇA görünür (dalga 13
 * dersi 3).
 *
 * ── PAYLOAD HAM (DSDL kapsam dışı) ──────────────────────────────────────────
 * DSDL derleyicisi bu deponun kapsamı DIŞINDA (bulgu 9). Payload'a sabit
 * offset'le alan adı YAKIŞTIRILMAZ; ham bayt + `dsdlRequiredForPayload`.
 * Katalogda `definitions: ['dsdl']` ZATEN yazılı, DSDL Browser paneli BOŞ kalır
 * (`snmp.ts:46`/`bleGatt.ts:34` emsali).
 *
 * ── ÇERÇEVELER ARASI DURUM PARSER'A GİRMEZ ──────────────────────────────────
 * Multi-frame reassembly, toggle sırası takibi, transfer-ID zaman aşımı: hepsi
 * çerçeveler arası durumdur, analyzer işi. Parser çerçeveyi yalnız
 * `single-frame` / `multi-frame-first` / `multi-frame-middle` /
 * `multi-frame-last` olarak SINIFLAR.
 *
 * ── KAPSAM DIŞI (bilinçli) ──────────────────────────────────────────────────
 * • Cyphal/UDP, Cyphal/Serial — ayrı tel biçimleri, ayrı iş.
 * • CAN FD — yukarı bakın (dolgu + CRC kapsamı farkı).
 * • DSDL derleyicisi, Register Access, Network Graph — çerçeve dışı.
 * • Transfer CRC doğrulaması — çerçeveler arası.
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
  ProtocolParser,
  ProtocolPlugin,
  ProtocolWarning,
} from '@/protocol-core/types';

import { buildCanClassicFrame } from '../../automotive/can/canClassic';
import { buildCanFdFrame } from '../../automotive/can/canFd';
import {
  CAN_CLASSIC_FRAME_LENGTH,
  CAN_CLASSIC_MAX_PAYLOAD,
  CAN_FD_FRAME_LENGTH,
  CAN_HEADER_LENGTH,
  decodeCanId,
  formatHex,
  readUint32Le,
} from '../../automotive/can/canFrame';

const PROTOCOL_ID = 'cyphal';
/** Protokol adı veridir, çeviriye girmez (CLAUDE.md); katalog kaydıyla BİREBİR aynı. */
const PROTOCOL_DISPLAY_NAME = 'Cyphal';

// ── CAN ID bit düzeni — resmî spec `can.tex` tabloları (bkz. dosya başı) ────
const PRIORITY_SHIFT = 26;
const PRIORITY_MASK = 0x7; // 3 bit, bit 28:26
const SERVICE_NOT_MESSAGE_SHIFT = 25;
const ANONYMOUS_SHIFT = 24; // mesajda Anonymous, serviste Request-not-response
const REQUEST_NOT_RESPONSE_SHIFT = 24;
const RESERVED_23_SHIFT = 23;
const SUBJECT_ID_SHIFT = 8;
const SUBJECT_ID_13_MASK = 0x1fff; // 13 bit, bit 20:8 (v1.0)
const SUBJECT_ID_16_MASK = 0xffff; // 16 bit, bit 23:8 (v1.1, deneysel)
const SERVICE_ID_SHIFT = 14;
const SERVICE_ID_MASK = 0x1ff; // 9 bit, bit 22:14
const DESTINATION_NODE_ID_SHIFT = 7;
const NODE_ID_MASK = 0x7f; // 7 bit — hem kaynak (6:0) hem hedef (13:7)
const RESERVED_7_SHIFT = 7; // v1.0'da 0 ZORUNLU; v1.1 mesajında 1

// ── Tail byte — resmî spec "Tail byte structure" tablosu ────────────────────
const TAIL_SOT_SHIFT = 7;
const TAIL_EOT_SHIFT = 6;
const TAIL_TOGGLE_SHIFT = 5;
const TAIL_TRANSFER_ID_MASK = 0x1f; // 5 bit, bit 4:0 — modulo 32

const CAN_ID_FIELD_OFFSET = 0;
const CAN_ID_FIELD_LENGTH = 4;
const DLC_OFFSET = 4;
const TRANSFER_CRC_LENGTH = 2;

const PRIORITY_MNEMONIC: readonly string[] = [
  'Exceptional',
  'Immediate',
  'Fast',
  'High',
  'Nominal',
  'Low',
  'Slow',
  'Optional',
];

const ERROR_FRAME_TOO_SHORT = 'protocol.cyphal.error.frameTooShort';
const ERROR_FRAME_TOO_LONG = 'protocol.cyphal.error.frameTooLong';
const ERROR_CAN_FD_NOT_SUPPORTED = 'protocol.cyphal.error.canFdNotSupported';
const ERROR_NOT_EXTENDED = 'protocol.cyphal.error.notExtended';
const ERROR_TAIL_BYTE_MISSING = 'protocol.cyphal.error.tailByteMissing';
const ERROR_RESERVED_23_NOT_ZERO = 'protocol.cyphal.error.reservedBit23NotZero';
const ERROR_V11_REQUIRES_OPT_IN = 'protocol.cyphal.error.v11RequiresOptIn';
const ERROR_ABORTED = 'protocol.cyphal.error.aborted';

const WARN_DSDL_REQUIRED_FOR_PAYLOAD = 'protocol.cyphal.warning.dsdlRequiredForPayload';
const WARN_TRANSFER_CRC_NEEDS_FULL_TRANSFER =
  'protocol.cyphal.warning.transferCrcNeedsFullTransfer';
const WARN_TRANSFER_CRC_SPLIT_ACROSS_FRAMES =
  'protocol.cyphal.warning.transferCrcSplitAcrossFrames';
const WARN_EXPERIMENTAL_SPEC_VERSION = 'protocol.cyphal.warning.experimentalSpecVersion';
const WARN_REMOTE_FRAME = 'protocol.cyphal.warning.remoteFrame';
const WARN_TRUNCATED_PAYLOAD = 'protocol.cyphal.warning.truncatedPayload';
const WARN_TOGGLE_LOOKS_LIKE_DRONECAN = 'protocol.cyphal.warning.toggleLooksLikeDroneCan';
const WARN_NON_LAST_FRAME_NOT_FULL_MTU = 'protocol.cyphal.warning.nonLastFrameNotFullMtu';
const WARN_ANONYMOUS_MUST_BE_SINGLE_FRAME = 'protocol.cyphal.warning.anonymousMustBeSingleFrame';
const WARN_SELF_ADDRESSED_SERVICE = 'protocol.cyphal.warning.selfAddressedService';

const SUMMARY_PREFIX = 'protocol.cyphal.summary.';

// ── decodeOptions ───────────────────────────────────────────────────────────

const OPTION_TRANSPORT = 'transport';
const TRANSPORT_CAN = 'can';

const OPTION_SPEC_VERSION = 'specVersion';
export const CYPHAL_SPEC_V1_0 = 'v1.0';
export const CYPHAL_SPEC_V1_1 = 'v1.1';

export type CyphalSpecVersion = typeof CYPHAL_SPEC_V1_0 | typeof CYPHAL_SPEC_V1_1;

const DECODE_OPTIONS: readonly DecodeOption[] = [
  {
    id: OPTION_TRANSPORT,
    label: 'protocol.cyphal.option.transport',
    kind: 'select',
    defaultValue: TRANSPORT_CAN,
    description: 'protocol.cyphal.option.transport.description',
    // TEK şık BİLEREK: Cyphal/UDP ve Cyphal/Serial kapsam DIŞI (dosya başı).
    // Seçilemeyen bir şık eklemek `DecodeOption` sözleşmesinde yok ve sahte
    // bir vaat olurdu; kapsam sınırı açıklama metninde AÇIKÇA yazılı.
    choices: [{ value: TRANSPORT_CAN, label: 'protocol.cyphal.option.transport.can' }],
  },
  {
    id: OPTION_SPEC_VERSION,
    label: 'protocol.cyphal.option.specVersion',
    kind: 'select',
    defaultValue: CYPHAL_SPEC_V1_0,
    description: 'protocol.cyphal.option.specVersion.description',
    choices: [
      { value: CYPHAL_SPEC_V1_0, label: 'protocol.cyphal.option.specVersion.v10' },
      { value: CYPHAL_SPEC_V1_1, label: 'protocol.cyphal.option.specVersion.v11' },
    ],
  },
];

function readSpecVersion(options: Record<string, unknown> | undefined): CyphalSpecVersion {
  return options?.[OPTION_SPEC_VERSION] === CYPHAL_SPEC_V1_1 ? CYPHAL_SPEC_V1_1 : CYPHAL_SPEC_V1_0;
}

function byteAt(data: Uint8Array, offset: number): number {
  return data[offset] ?? 0;
}

function toProtocolWarning(key: string): ProtocolWarning {
  return { code: key, message: key };
}

// ── Cyphal transfer identity (29-bit CAN ID'nin türevi) ─────────────────────

export type CyphalTransferKind = 'message' | 'service-request' | 'service-response';

export interface CyphalMessageIdentity {
  readonly kind: 'message';
  readonly priority: number;
  /** `13` → v1.0 (bit 20:8), `16` → v1.1 deneysel biçim (bit 23:8). */
  readonly subjectIdWidth: 13 | 16;
  readonly subjectId: number;
  readonly anonymous: boolean;
  readonly sourceNodeId: number;
  /** Spec: "Discard frame if this field has a different value" — `false` ise çerçeve geçersiz. */
  readonly reserved23Zero: boolean;
}

export interface CyphalServiceIdentity {
  readonly kind: 'service-request' | 'service-response';
  readonly priority: number;
  readonly serviceId: number;
  readonly destinationNodeId: number;
  readonly sourceNodeId: number;
  readonly reserved23Zero: boolean;
}

export type CyphalIdentity = CyphalMessageIdentity | CyphalServiceIdentity;

/**
 * 29-bit CAN identifier'ı Cyphal/CAN transfer alanlarına ayırır.
 *
 * SIRA ÖNEMLİ (dosya başı "Ayrım kuralı"): (1) SNM **bit 25**; (2) mesajsa
 * bit **7** sürümü söyler; (3) anonimlik EN SON, **bit 24**'ten okunur —
 * DroneCAN'in "source node-ID 0 mı" sorusu Cyphal'da GEÇERSİZDİR (node-ID 0
 * burada normal bir düğümdür).
 *
 * `specVersion` yalnız MESAJ çerçevesinin yorumunu etkiler; servis çerçevesinde
 * bit 7 zaten hedef node-ID'nin bir parçasıdır ve sürümden bağımsızdır.
 *
 * Saf fonksiyon: `uavcanCompatibility.ts` bunu çerçeveden bağımsız ÇAĞIRIR
 * (kod kopyalanmaz — `j1939.ts`in `decodeJ1939Identifier` deseni).
 */
export function decodeCyphalIdentity(
  extendedId: number,
  specVersion: CyphalSpecVersion = CYPHAL_SPEC_V1_0,
): CyphalIdentity {
  const id = extendedId >>> 0;
  const priority = (id >>> PRIORITY_SHIFT) & PRIORITY_MASK;
  const reserved23Zero = ((id >>> RESERVED_23_SHIFT) & 0x1) === 0;
  const serviceNotMessage = ((id >>> SERVICE_NOT_MESSAGE_SHIFT) & 0x1) === 1;

  if (serviceNotMessage) {
    const requestNotResponse = ((id >>> REQUEST_NOT_RESPONSE_SHIFT) & 0x1) === 1;
    return {
      kind: requestNotResponse ? 'service-request' : 'service-response',
      priority,
      serviceId: (id >>> SERVICE_ID_SHIFT) & SERVICE_ID_MASK,
      destinationNodeId: (id >>> DESTINATION_NODE_ID_SHIFT) & NODE_ID_MASK,
      sourceNodeId: id & NODE_ID_MASK,
      reserved23Zero,
    };
  }

  const versionDiscriminator = (id >>> RESERVED_7_SHIFT) & 0x1;
  const isV11Layout = versionDiscriminator === 1 && specVersion === CYPHAL_SPEC_V1_1;

  if (isV11Layout) {
    // v1.1 deneysel biçim: subject-ID 16 bit (23:8), anonymous biti "reserved=0"
    // olarak yeniden atanmış (libcanard `canard_publish_16b` yorumu).
    return {
      kind: 'message',
      priority,
      subjectIdWidth: 16,
      subjectId: (id >>> SUBJECT_ID_SHIFT) & SUBJECT_ID_16_MASK,
      anonymous: false,
      sourceNodeId: id & NODE_ID_MASK,
      // v1.1'de bit 23 subject-ID'nin PARÇASIDIR, ayrılmış bir bit değil.
      reserved23Zero: true,
    };
  }

  return {
    kind: 'message',
    priority,
    subjectIdWidth: 13,
    subjectId: (id >>> SUBJECT_ID_SHIFT) & SUBJECT_ID_13_MASK,
    anonymous: ((id >>> ANONYMOUS_SHIFT) & 0x1) === 1,
    sourceNodeId: id & NODE_ID_MASK,
    reserved23Zero,
  };
}

/** v1.0'da bit 7 SIFIR olmak zorundadır; 1 ise çerçeve v1.1 biçimindedir. */
export function isCyphalV11MessageLayout(extendedId: number): boolean {
  const id = extendedId >>> 0;
  if (((id >>> SERVICE_NOT_MESSAGE_SHIFT) & 0x1) === 1) return false;
  return ((id >>> RESERVED_7_SHIFT) & 0x1) === 1;
}

const TRANSFER_KIND_LABEL: Record<CyphalTransferKind, string> = {
  message: 'Message',
  'service-request': 'Service Request',
  'service-response': 'Service Response',
};

// ── Tail byte ───────────────────────────────────────────────────────────────

export type CyphalFrameRole =
  | 'single-frame'
  | 'multi-frame-first'
  | 'multi-frame-middle'
  | 'multi-frame-last';

export interface CyphalTailByte {
  readonly startOfTransfer: boolean;
  readonly endOfTransfer: boolean;
  readonly toggle: boolean;
  readonly transferId: number;
  readonly frameRole: CyphalFrameRole;
}

/**
 * Spec örneği: `0xE0 = 11100000` → SOT=1, EOT=1, Toggle=**1**, Transfer-ID=0.
 * Toggle'ın 1 olması Cyphal'ın imzasıdır (DroneCAN'de aynı rolde 0'dır).
 */
export function decodeCyphalTailByte(tailByte: number): CyphalTailByte {
  const startOfTransfer = ((tailByte >>> TAIL_SOT_SHIFT) & 0x1) === 1;
  const endOfTransfer = ((tailByte >>> TAIL_EOT_SHIFT) & 0x1) === 1;
  const toggle = ((tailByte >>> TAIL_TOGGLE_SHIFT) & 0x1) === 1;
  const transferId = tailByte & TAIL_TRANSFER_ID_MASK;

  let frameRole: CyphalFrameRole;
  if (startOfTransfer && endOfTransfer) {
    frameRole = 'single-frame';
  } else if (startOfTransfer) {
    frameRole = 'multi-frame-first';
  } else if (endOfTransfer) {
    frameRole = 'multi-frame-last';
  } else {
    frameRole = 'multi-frame-middle';
  }

  return { startOfTransfer, endOfTransfer, toggle, transferId, frameRole };
}

const FRAME_ROLE_LABEL: Record<CyphalFrameRole, string> = {
  'single-frame': 'Single-frame',
  'multi-frame-first': 'Multi-frame (first)',
  'multi-frame-middle': 'Multi-frame (middle)',
  'multi-frame-last': 'Multi-frame (last)',
};

// `interface` DEĞİL `type`: `RawFrameInit.metadata`nın beklediği
// `Record<string, unknown>`a atanabilirlik yalnız nesne-tipi `type`
// takma adlarında örtük index imzasıyla çalışır (dronecan.ts ile aynı sebep).
export type CyphalFrameMetadata = {
  readonly transfer?: CyphalIdentity;
  readonly tailByte?: CyphalTailByte;
  readonly specVersion: CyphalSpecVersion;
  readonly payloadLength: number;
  readonly summaryKey: string;
  readonly summaryParams: Record<string, string>;
};

function canIdSubField(
  data: Uint8Array,
  id: string,
  name: string,
  rawValue: number | string,
  physicalValue?: string,
): ParsedField {
  return {
    id,
    name,
    offset: CAN_ID_FIELD_OFFSET,
    length: CAN_ID_FIELD_LENGTH,
    rawBytes: data.slice(CAN_ID_FIELD_OFFSET, CAN_ID_FIELD_OFFSET + CAN_ID_FIELD_LENGTH),
    rawValue,
    ...(physicalValue === undefined ? {} : { physicalValue }),
    valid: true,
    warnings: [],
  };
}

/** Transfer türüne göre CAN ID alt alanlarını üretir (dosya başı "Ayrım kuralı"). */
function buildTransferIdFields(
  data: Uint8Array,
  transfer: CyphalIdentity,
  warnings: ProtocolWarning[],
): ParsedField[] {
  const fields: ParsedField[] = [
    canIdSubField(
      data,
      'priority',
      'CAN ID · Priority (bit 28:26)',
      transfer.priority,
      PRIORITY_MNEMONIC[transfer.priority],
    ),
  ];

  if (transfer.kind === 'message') {
    fields.push(
      canIdSubField(data, 'service-not-message', 'CAN ID · Service-Not-Message (bit 25)', 0, 'Message'),
    );
    if (transfer.subjectIdWidth === 16) {
      fields.push(
        canIdSubField(data, 'subject-id', 'CAN ID · Subject-ID (bit 23:8)', transfer.subjectId),
        canIdSubField(
          data,
          'version-discriminator',
          'CAN ID · Version Discriminator (bit 7)',
          1,
          'v1.1 · 16-bit Subject-ID',
        ),
      );
    } else {
      fields.push(
        canIdSubField(
          data,
          'anonymous',
          'CAN ID · Anonymous (bit 24)',
          transfer.anonymous ? 1 : 0,
          transfer.anonymous ? 'Anonymous (pseudo-ID)' : 'Regular',
        ),
        canIdSubField(data, 'subject-id', 'CAN ID · Subject-ID (bit 20:8)', transfer.subjectId),
        canIdSubField(
          data,
          'version-discriminator',
          'CAN ID · Version Discriminator (bit 7)',
          0,
          'v1.0 · 13-bit Subject-ID',
        ),
      );
    }
  } else {
    fields.push(
      canIdSubField(data, 'service-not-message', 'CAN ID · Service-Not-Message (bit 25)', 1, 'Service'),
      canIdSubField(
        data,
        'request-not-response',
        'CAN ID · Request-Not-Response (bit 24)',
        transfer.kind === 'service-request' ? 1 : 0,
        transfer.kind === 'service-request' ? 'Request' : 'Response',
      ),
      canIdSubField(data, 'service-id', 'CAN ID · Service-ID (bit 22:14)', transfer.serviceId),
      canIdSubField(
        data,
        'destination-node-id',
        'CAN ID · Destination Node-ID (bit 13:7)',
        transfer.destinationNodeId,
      ),
    );
    if (transfer.sourceNodeId === transfer.destinationNodeId) {
      // Spec/libcanard: kendine adresleme YASAK ("self-addressing not allowed").
      warnings.push(toProtocolWarning(WARN_SELF_ADDRESSED_SERVICE));
    }
  }

  fields.push(
    canIdSubField(data, 'source-node-id', 'CAN ID · Source Node-ID (bit 6:0)', transfer.sourceNodeId),
    canIdSubField(
      data,
      'transfer-kind',
      'CAN ID · Transfer Kind',
      transfer.kind,
      TRANSFER_KIND_LABEL[transfer.kind],
    ),
  );
  return fields;
}

function buildTailByteFields(
  data: Uint8Array,
  tailByteOffset: number,
  tail: CyphalTailByte,
  warnings: ProtocolWarning[],
): ParsedField[] {
  const tailBytes = data.slice(tailByteOffset, tailByteOffset + 1);
  const flagField = (id: string, name: string, active: boolean): ParsedField => ({
    id,
    name,
    offset: tailByteOffset,
    length: 1,
    rawBytes: tailBytes,
    rawValue: active ? 1 : 0,
    physicalValue: active ? 'Set' : 'Not set',
    valid: true,
    warnings: [],
  });

  const toggleField = flagField('tail-toggle', 'Tail · Toggle', tail.toggle);
  if (tail.startOfTransfer && !tail.toggle) {
    // Spec: transferin İLK çerçevesinde Toggle her zaman 1. Toggle=0 olan bir
    // SOT çerçevesi Cyphal DEĞİL, büyük olasılıkla DroneCAN'dir — uyarı
    // kullanıcıyı `uavcan-compatibility` sayfasına yönlendirir.
    toggleField.valid = false;
    toggleField.warnings.push(WARN_TOGGLE_LOOKS_LIKE_DRONECAN);
    warnings.push(toProtocolWarning(WARN_TOGGLE_LOOKS_LIKE_DRONECAN));
  }

  return [
    flagField('tail-sot', 'Tail · Start Of Transfer', tail.startOfTransfer),
    flagField('tail-eot', 'Tail · End Of Transfer', tail.endOfTransfer),
    toggleField,
    {
      id: 'tail-transfer-id',
      name: 'Tail · Transfer ID',
      offset: tailByteOffset,
      length: 1,
      rawBytes: tailBytes,
      rawValue: tail.transferId,
      // `unit` BİLEREK yok: modulo-32 sayaç, fiziksel değer değil.
      valid: true,
      warnings: [],
    },
  ];
}

interface CyphalParseOptions {
  timestamp?: number;
  direction?: FrameDirection;
  channel?: string;
  maxFrameLength?: number;
  signal?: AbortSignal;
  options?: Record<string, unknown>;
}

function parseCyphalFrame(data: Uint8Array, parseOptions: CyphalParseOptions): ParseResult {
  if (parseOptions.signal?.aborted === true) {
    return {
      success: false,
      error: { code: 'parser-timeout', message: ERROR_ABORTED },
      consumedBytes: 0,
      recoverable: false,
    };
  }

  if (data.length < CAN_HEADER_LENGTH) {
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

  // CAN FD KAPSAM DIŞI ve AÇIKÇA reddedilir (dosya başı; `xcpOnCan.ts:169` emsali).
  if (data.length === CAN_FD_FRAME_LENGTH) {
    return {
      success: false,
      error: {
        code: 'unsupported-encoding',
        message: ERROR_CAN_FD_NOT_SUPPORTED,
        offset: 0,
        length: data.length,
      },
      consumedBytes: 0,
      recoverable: false,
    };
  }

  const maxFrameLength = parseOptions.maxFrameLength ?? CAN_CLASSIC_FRAME_LENGTH;
  if (data.length > maxFrameLength) {
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

  const specVersion = readSpecVersion(parseOptions.options);
  const identity = decodeCanId(readUint32Le(data, 0));
  const fields: ParsedField[] = [];
  const warnings: ProtocolWarning[] = [];
  const errors: ProtocolError[] = [];

  if (specVersion === CYPHAL_SPEC_V1_1) {
    // KOŞULSUZ: v1.1 deneyseldir, çerçeve o biçimde olmasa bile uyarı basılır
    // (`ccp.ts`in legacy uyarısının aynı biçimi).
    warnings.push(toProtocolWarning(WARN_EXPERIMENTAL_SPEC_VERSION));
  }

  fields.push({
    id: 'can-id',
    name: 'CAN ID',
    offset: CAN_ID_FIELD_OFFSET,
    length: CAN_ID_FIELD_LENGTH,
    rawBytes: data.slice(CAN_ID_FIELD_OFFSET, CAN_ID_FIELD_OFFSET + CAN_ID_FIELD_LENGTH),
    rawValue: identity.id,
    physicalValue: identity.extended ? 'Extended / 29-bit' : 'Base / 11-bit',
    valid: identity.extended,
    warnings: [],
  });

  const declaredLength = byteAt(data, DLC_OFFSET);
  const availableAfterHeader = Math.max(0, data.length - CAN_HEADER_LENGTH);
  const payloadLength = Math.min(declaredLength, CAN_CLASSIC_MAX_PAYLOAD, availableAfterHeader);

  fields.push({
    id: 'dlc',
    name: 'DLC',
    offset: DLC_OFFSET,
    length: 1,
    rawBytes: data.slice(DLC_OFFSET, DLC_OFFSET + 1),
    rawValue: declaredLength,
    physicalValue: payloadLength,
    unit: 'B',
    valid: true,
    warnings: [],
  });

  if (identity.remote) {
    // Cyphal/CAN remote frame TANIMLAMAZ; bilgilendirici uyarı, çözüm sürer.
    warnings.push(toProtocolWarning(WARN_REMOTE_FRAME));
  }
  if (payloadLength < Math.min(declaredLength, CAN_CLASSIC_MAX_PAYLOAD)) {
    warnings.push(toProtocolWarning(WARN_TRUNCATED_PAYLOAD));
  }

  let transfer: CyphalIdentity | undefined;
  let tail: CyphalTailByte | undefined;

  if (!identity.extended) {
    // Cyphal/CAN "transport frames are CAN 2.0B frames" (spec) — 29-bit
    // ZORUNLU. `canParse` bunu zaten elerdi; `parse` doğrudan çağrılabildiği
    // için kısmi bilgi gösterilir (spec §47 "hatalı veride çökertme").
    errors.push({
      code: 'value-out-of-range',
      message: ERROR_NOT_EXTENDED,
      offset: CAN_ID_FIELD_OFFSET,
      length: CAN_ID_FIELD_LENGTH,
      details: { canId: formatHex(identity.id, 3), requiredFormat: 'extended' },
    });
    if (payloadLength > 0) {
      fields.push({
        id: 'data',
        name: 'Data',
        offset: CAN_HEADER_LENGTH,
        length: payloadLength,
        rawBytes: data.slice(CAN_HEADER_LENGTH, CAN_HEADER_LENGTH + payloadLength),
        valid: true,
        warnings: [],
      });
    }
  } else {
    // v1.0 varsayılanında bit 7 = 1 olan bir MESAJ çerçevesi spec gereği
    // atılır ("Discard frame if this field has a different value"). Ne olduğunu
    // söyleyip v1.1 kanalına yönlendiriyoruz — sessizce yanlış çözmüyoruz.
    if (specVersion === CYPHAL_SPEC_V1_0 && isCyphalV11MessageLayout(identity.id)) {
      errors.push({
        code: 'unsupported-encoding',
        message: ERROR_V11_REQUIRES_OPT_IN,
        offset: CAN_ID_FIELD_OFFSET,
        length: CAN_ID_FIELD_LENGTH,
        details: { canId: formatHex(identity.id, 8), reservedBit7: 1 },
      });
    }

    transfer = decodeCyphalIdentity(identity.id, specVersion);
    fields.push(...buildTransferIdFields(data, transfer, warnings));

    if (!transfer.reserved23Zero) {
      errors.push({
        code: 'value-out-of-range',
        message: ERROR_RESERVED_23_NOT_ZERO,
        offset: CAN_ID_FIELD_OFFSET,
        length: CAN_ID_FIELD_LENGTH,
        details: { canId: formatHex(identity.id, 8), reservedBit23: 1 },
      });
    }

    if (payloadLength < 1) {
      // Spec: "A CAN frame whose data field contains less than one byte is not
      // a valid Cyphal/CAN frame" — tail byte HER çerçevede vardır.
      errors.push({
        code: 'truncated-frame',
        message: ERROR_TAIL_BYTE_MISSING,
        offset: CAN_HEADER_LENGTH,
        length: 0,
      });
    } else {
      const tailByteOffset = CAN_HEADER_LENGTH + payloadLength - 1;
      tail = decodeCyphalTailByte(byteAt(data, tailByteOffset));
      fields.push(...buildTailByteFields(data, tailByteOffset, tail, warnings));

      // Spec: son OLMAYAN çerçeve veri alanını TAMAMEN doldurmalıdır.
      if (!tail.endOfTransfer && payloadLength !== CAN_CLASSIC_MAX_PAYLOAD) {
        warnings.push(toProtocolWarning(WARN_NON_LAST_FRAME_NOT_FULL_MTU));
      }
      // Spec/libcanard: anonim transfer YALNIZ tek çerçeveli olabilir.
      if (
        transfer.kind === 'message' &&
        transfer.anonymous &&
        tail.frameRole !== 'single-frame'
      ) {
        warnings.push(toProtocolWarning(WARN_ANONYMOUS_MUST_BE_SINGLE_FRAME));
      }

      const bodyStart = CAN_HEADER_LENGTH;
      const bodyEnd = tailByteOffset; // tail byte hariç
      const bodyLength = Math.max(0, bodyEnd - bodyStart);

      if (tail.frameRole === 'multi-frame-last' && bodyLength > 0) {
        // Transfer CRC transferin SONUNDADIR (DroneCAN'in TERSİ) ve big-endian
        // basılır. Tek çerçeveden DOĞRULANAMAZ — tüm transferin payload'ını
        // kapsar (dosya başı).
        const crcStart = Math.max(bodyStart, bodyEnd - TRANSFER_CRC_LENGTH);
        const crcLength = bodyEnd - crcStart;
        const crcBytes = data.slice(crcStart, bodyEnd);
        const crcWarnings =
          crcLength === TRANSFER_CRC_LENGTH
            ? [WARN_TRANSFER_CRC_NEEDS_FULL_TRANSFER]
            : [WARN_TRANSFER_CRC_NEEDS_FULL_TRANSFER, WARN_TRANSFER_CRC_SPLIT_ACROSS_FRAMES];
        const crcField: ParsedField = {
          id: 'transfer-crc',
          name:
            crcLength === TRANSFER_CRC_LENGTH
              ? 'Transfer CRC (big-endian)'
              : 'Transfer CRC · low byte (split)',
          offset: crcStart,
          length: crcLength,
          rawBytes: crcBytes,
          rawValue:
            crcLength === TRANSFER_CRC_LENGTH
              ? ((byteAt(data, crcStart) << 8) | byteAt(data, crcStart + 1)) >>> 0
              : byteAt(data, crcStart),
          valid: true,
          warnings: crcWarnings,
        };
        fields.push(crcField);
        warnings.push(toProtocolWarning(WARN_TRANSFER_CRC_NEEDS_FULL_TRANSFER));
        if (crcLength !== TRANSFER_CRC_LENGTH) {
          warnings.push(toProtocolWarning(WARN_TRANSFER_CRC_SPLIT_ACROSS_FRAMES));
        }

        if (crcStart > bodyStart) {
          fields.push({
            id: 'data',
            name: 'Data',
            offset: bodyStart,
            length: crcStart - bodyStart,
            rawBytes: data.slice(bodyStart, crcStart),
            valid: true,
            warnings: [WARN_DSDL_REQUIRED_FOR_PAYLOAD],
          });
          warnings.push(toProtocolWarning(WARN_DSDL_REQUIRED_FOR_PAYLOAD));
        }
      } else if (bodyLength > 0) {
        fields.push({
          id: 'data',
          name: 'Data',
          offset: bodyStart,
          length: bodyLength,
          rawBytes: data.slice(bodyStart, bodyEnd),
          valid: true,
          warnings: [WARN_DSDL_REQUIRED_FOR_PAYLOAD],
        });
        warnings.push(toProtocolWarning(WARN_DSDL_REQUIRED_FOR_PAYLOAD));
      }
    }
  }

  let summaryKey: string;
  let summaryParams: Record<string, string>;
  if (transfer === undefined) {
    summaryKey = `${SUMMARY_PREFIX}notExtended`;
    summaryParams = {};
  } else {
    const frameRole = tail === undefined ? '—' : FRAME_ROLE_LABEL[tail.frameRole];
    if (transfer.kind === 'message') {
      summaryKey = transfer.anonymous
        ? `${SUMMARY_PREFIX}anonymousMessage`
        : `${SUMMARY_PREFIX}message`;
      summaryParams = {
        frameRole,
        subjectId: String(transfer.subjectId),
        sourceNodeId: String(transfer.sourceNodeId),
      };
    } else {
      summaryKey =
        transfer.kind === 'service-request'
          ? `${SUMMARY_PREFIX}serviceRequest`
          : `${SUMMARY_PREFIX}serviceResponse`;
      summaryParams = {
        frameRole,
        serviceId: String(transfer.serviceId),
        sourceNodeId: String(transfer.sourceNodeId),
        destinationNodeId: String(transfer.destinationNodeId),
      };
    }
  }

  const metadata: CyphalFrameMetadata = {
    ...(transfer === undefined ? {} : { transfer }),
    ...(tail === undefined ? {} : { tailByte: tail }),
    specVersion,
    payloadLength,
    summaryKey,
    summaryParams,
  };

  const rawFrame = createRawFrame(data, {
    ...(parseOptions.timestamp === undefined ? {} : { timestamp: parseOptions.timestamp }),
    ...(parseOptions.direction === undefined ? {} : { direction: parseOptions.direction }),
    ...(parseOptions.channel === undefined ? {} : { channel: parseOptions.channel }),
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

export function parseCyphal(data: Uint8Array, options?: Record<string, unknown>): ParseResult {
  return parseCyphalFrame(data, options === undefined ? {} : { options });
}

export const cyphalParser: ProtocolParser = {
  protocolId: PROTOCOL_ID,
  displayName: PROTOCOL_DISPLAY_NAME,

  /**
   * Bekçi — bu konteyner `isotp`/`j1939`/`canopen`/`devicenet`/`ccp`/
   * `xcpOnCan`/`nmea2000`/**`dronecan`** ile PAYLAŞILIYOR (dokuzuncu tüketici).
   * 15a'nın ÖLÇTÜĞÜ ders burada beşinci kez uygulanıyor: brifin verdiği
   * minimum ölçütler tek başına yetmez, protokolün KENDİ yapısal kısıtlarının
   * HEPSİ kullanılır. Hepsi resmî spec'ten (dosya başı "Kaynak turu"):
   *
   *  1. Tam `CAN_CLASSIC_FRAME_LENGTH` (16) — CAN FD kapsam DIŞI.
   *  2. `extended === true` — "transport frames are CAN 2.0B frames".
   *  3. DLC 1..8 — "a CAN frame whose data field contains less than one byte
   *     is not a valid Cyphal/CAN frame".
   *  4. **Ayrılmış bit 23 = 0** — spec: "Discard frame if this field has a
   *     different value". Mesaj ve servis çerçevelerinin İKİSİNDE de geçerli.
   *  5. **Mesaj çerçevesinde ayrılmış bit 7 = 0** — aynı "discard" kuralı.
   *     `canParse`in seçeneği YOKTUR, yani VARSAYILAN v1.0 geçerlidir: v1.1'in
   *     16-bit biçimi (bit 7 = 1) otomatik algılamaya GİRMEZ, açık opt-in
   *     ister. Servis çerçevesinde bit 7 hedef node-ID'nin parçasıdır,
   *     denetlenmez.
   *  6. **Toggle disiplini — Cyphal'ın İMZASI:** SOT=1 olan her çerçevede
   *     Toggle MUTLAKA 1 (spec: tek çerçevede "Always 1", çok çerçevelide
   *     "First frame: 1"). Bu, DroneCAN'in aynı roldeki `Toggle=0` kuralının
   *     TAM TERSİDİR — iki protokol SOT çerçevelerinde birbirini KESİNLİKLE
   *     dışlar.
   *  7. `multi-frame-middle` (SOT=0,EOT=0) KABUL EDİLMEZ — 15a'da ÖLÇÜLEN
   *     çarpışmaların %92'si (12/13) bu roldeydi; izole bir orta çerçevenin
   *     gerçekten Cyphal olduğu ancak komşularıyla (analyzer katmanı)
   *     kanıtlanabilir. `parse()` ETKİLENMEZ, orta çerçeve yine TAM çözülür.
   *  8. Son OLMAYAN çerçeve (EOT=0) veri alanını TAMAMEN doldurmalı → DLC = 8.
   *  9. `multi-frame-last` en az 2 bayt taşımalı (≥1 CRC baytı + tail byte).
   * 10. Servis transferinde kaynak = hedef OLAMAZ ("self-addressing not
   *     allowed", libcanard `rx` + pycyphal `parse_frames`).
   * 11. Anonim mesaj (bit 24 = 1) YALNIZ tek çerçeveli olabilir.
   *
   * **DENETLENMEYEN:** ayrılmış bit 22 ve 21. Spec onları "Transmit 1; ignore
   * (do not check) when receiving" diye tanımlıyor ve spec'in KENDİ anonim
   * örneği (`0x11133775`) ikisini de 0 basıyor — denetlemek yayımlanmış bir
   * spec örneğini reddederdi. İmza UYDURULMAZ.
   *
   * `cyphalCanParseRegistry.test.ts` bunu tüm registry'ye karşı ÖLÇER ve
   * `dronecan` ↔ `cyphal` ayrımını İKİ YÖNDE sınar.
   */
  canParse(data: Uint8Array): boolean {
    if (data.length !== CAN_CLASSIC_FRAME_LENGTH) return false;

    const identity = decodeCanId(readUint32Le(data, 0));
    if (!identity.extended) return false;

    const declaredLength = byteAt(data, DLC_OFFSET);
    if (declaredLength < 1 || declaredLength > CAN_CLASSIC_MAX_PAYLOAD) return false;

    // Ayrılmış bit 23 her iki düzende de SIFIR olmak zorunda ("discard").
    if (((identity.id >>> RESERVED_23_SHIFT) & 0x1) === 1) return false;
    // Mesaj çerçevesinde ayrılmış bit 7 de SIFIR (v1.0 varsayılanı).
    if (isCyphalV11MessageLayout(identity.id)) return false;

    const tail = decodeCyphalTailByte(byteAt(data, CAN_HEADER_LENGTH + declaredLength - 1));

    if (tail.frameRole === 'multi-frame-middle') return false;
    if (tail.startOfTransfer && !tail.toggle) return false;
    if (!tail.endOfTransfer && declaredLength !== CAN_CLASSIC_MAX_PAYLOAD) return false;
    if (tail.frameRole === 'multi-frame-last' && declaredLength < 2) return false;

    const transfer = decodeCyphalIdentity(identity.id, CYPHAL_SPEC_V1_0);
    if (transfer.kind === 'message') {
      if (transfer.anonymous && tail.frameRole !== 'single-frame') return false;
    } else if (transfer.sourceNodeId === transfer.destinationNodeId) {
      return false;
    }

    return true;
  },

  parse(data: Uint8Array, context?: ParseContext): ParseResult {
    const parseOptions: CyphalParseOptions = {};
    if (context?.timestamp !== undefined) parseOptions.timestamp = context.timestamp;
    if (context?.direction !== undefined) parseOptions.direction = context.direction;
    if (context?.channel !== undefined) parseOptions.channel = context.channel;
    if (context?.maxFrameLength !== undefined) parseOptions.maxFrameLength = context.maxFrameLength;
    if (context?.signal !== undefined) parseOptions.signal = context.signal;
    if (context?.options !== undefined) parseOptions.options = context.options;
    return parseCyphalFrame(data, parseOptions);
  },
};

/** Tail byte baytını SOT/EOT/Toggle/Transfer-ID'den kurar (örnek çerçeveler için). */
export function buildCyphalTailByte(
  startOfTransfer: boolean,
  endOfTransfer: boolean,
  toggle: boolean,
  transferId: number,
): number {
  return (
    ((startOfTransfer ? 1 : 0) << TAIL_SOT_SHIFT) |
    ((endOfTransfer ? 1 : 0) << TAIL_EOT_SHIFT) |
    ((toggle ? 1 : 0) << TAIL_TOGGLE_SHIFT) |
    (transferId & TAIL_TRANSFER_ID_MASK)
  );
}

/** v1.1 deneysel biçim (bit 7 = 1, subject-ID 16 bit) — yalnız örnek/test üretimi için. */
export function encodeCyphalV11MessageId(
  priority: number,
  subjectId: number,
  sourceNodeId: number,
): number {
  return (
    ((priority & PRIORITY_MASK) << PRIORITY_SHIFT) |
    ((subjectId & SUBJECT_ID_16_MASK) << SUBJECT_ID_SHIFT) |
    (0x1 << RESERVED_7_SHIFT) |
    (sourceNodeId & NODE_ID_MASK)
  ) >>> 0;
}

/**
 * Örnek çerçeveler — CAN ID'ler ve tail byte'lar **resmî spec'in "Examples"
 * bölümünden BİREBİR** alındı (dosya başı "Spec'in KENDİ örnekleriyle sayısal
 * doğrulama"). Uydurulmuş kimlik YOK. Spec'in anonim ve FD örnekleri 16/64
 * baytlık CAN FD çerçeveleridir; classic-only kapsamda kullanılamadıkları için
 * anonim örnekte spec'in CAN ID'si KORUNUP payload classic'e kısaltıldı
 * (açıklamasında yazılı), FD örneği ise RET YOLUNU göstermek için olduğu gibi
 * bırakıldı.
 */
const EXAMPLE_FRAMES: ExampleFrame[] = [
  {
    id: 'heartbeat-message',
    name: 'protocol.cyphal.example.heartbeatMessage.name',
    // Spec "Examples": CAN ID 0x107D552A, data 00 00 00 00 00 01 A1 E0.
    // → prio 4 (Nominal), subject-ID 7509 (Heartbeat), source node 42,
    //   tail 0xE0 = SOT=1, EOT=1, Toggle=1, Transfer-ID=0.
    bytes: buildCanClassicFrame(
      0x107d552a,
      [0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0xa1, 0xe0],
      { extended: true },
    ),
    description: 'protocol.cyphal.example.heartbeatMessage.description',
    expectedValid: true,
  },
  {
    id: 'anonymous-message',
    name: 'protocol.cyphal.example.anonymousMessage.name',
    // Spec "Examples" anonim örneğinin CAN ID'si (0x11133775): anonymous=1,
    // subject-ID 4919, pseudo-ID 117. Spec'in kendi payload'ı 16 baytlık CAN
    // FD'dir; classic kapsamda gösterebilmek için payload KISALTILDI, CAN ID
    // ve tail byte (0xE0) spec'ten aynen korundu.
    // Bu örnek AYRICA ayrılmış bit 22/21'in 0 basıldığını gösterir — bu yüzden
    // `canParse` onları DENETLEMEZ (dosya başı).
    bytes: buildCanClassicFrame(
      0x11133775,
      [0x48, 0x65, 0x6c, 0x6c, 0x6f, 0x21, 0xe0],
      { extended: true },
    ),
    description: 'protocol.cyphal.example.anonymousMessage.description',
    expectedValid: true,
  },
  {
    id: 'service-request',
    name: 'protocol.cyphal.example.serviceRequest.name',
    // Spec "Examples": CAN ID 0x136B957B, data E1 — uavcan.node.GetInfo
    // (service-ID 430) isteği, düğüm 123 → düğüm 42, payload YOK.
    bytes: buildCanClassicFrame(0x136b957b, [0xe1], { extended: true }),
    description: 'protocol.cyphal.example.serviceRequest.description',
    expectedValid: true,
  },
  {
    id: 'service-response-first',
    name: 'protocol.cyphal.example.serviceResponseFirst.name',
    // Spec "Examples": CAN ID 0x126BBDAA, data 01 00 00 00 01 00 00 A1
    // — yanıtın ilk çerçevesi, tail 0xA1 = SOT=1, EOT=0, Toggle=1.
    bytes: buildCanClassicFrame(
      0x126bbdaa,
      [0x01, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0xa1],
      { extended: true },
    ),
    description: 'protocol.cyphal.example.serviceResponseFirst.description',
    expectedValid: true,
  },
  {
    id: 'service-response-middle',
    name: 'protocol.cyphal.example.serviceResponseMiddle.name',
    // Aynı transferin ara çerçevesi, tail 0x01 = SOT=0, EOT=0, Toggle=0.
    bytes: buildCanClassicFrame(
      0x126bbdaa,
      [0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01],
      { extended: true },
    ),
    description: 'protocol.cyphal.example.serviceResponseMiddle.description',
    expectedValid: true,
  },
  {
    id: 'service-response-last',
    name: 'protocol.cyphal.example.serviceResponseLast.name',
    // Spec "Examples" son çerçevesi: data E7 61 — transfer CRC 0x9AE7'nin
    // DÜŞÜK baytı bu çerçevede, YÜKSEK baytı bir öncekinde ("Transfer CRC,
    // MSB" / "Transfer CRC, LSB"). Bölünmüş CRC vakası.
    bytes: buildCanClassicFrame(0x126bbdaa, [0xe7, 0x61], { extended: true }),
    description: 'protocol.cyphal.example.serviceResponseLast.description',
    expectedValid: true,
  },
  {
    id: 'v11-experimental-message',
    name: 'protocol.cyphal.example.v11ExperimentalMessage.name',
    // Bit 7 = 1 → v1.1'in 16-bit subject-ID biçimi. VARSAYILAN v1.0'da spec
    // "discard" der, bu yüzden `expectedValid: false`; `specVersion` seçeneği
    // v1.1 yapılınca 16-bit subject-ID olarak çözülür ve deneysel uyarı basar.
    // Subject-ID 9000 BİLEREK seçildi: v1.0'ın 13-bit sınırının (8191) ÜSTÜNDE
    // ama bit 23'ü set ETMEYECEK kadar küçük — böylece tek hata (v1.1 opt-in)
    // basılır, ayrılmış-bit-23 hatası karışmaz.
    bytes: buildCanClassicFrame(
      encodeCyphalV11MessageId(4, 9000, 42),
      [0x11, 0x22, 0x33, buildCyphalTailByte(true, true, true, 7)],
      { extended: true },
    ),
    description: 'protocol.cyphal.example.v11ExperimentalMessage.description',
    expectedValid: false,
  },
  {
    id: 'dronecan-toggle-rejected',
    name: 'protocol.cyphal.example.droneCanToggleRejected.name',
    // Aynı Heartbeat kimliği ama tail 0xC0 = SOT=1, EOT=1, Toggle=**0**.
    // Cyphal'da ilk çerçevede Toggle 1'dir; Toggle=0 DroneCAN imzasıdır.
    // Çerçeve yine çözülür ama uyarı `uavcan-compatibility`ye yönlendirir.
    bytes: buildCanClassicFrame(
      0x107d552a,
      [0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0xa1, 0xc0],
      { extended: true },
    ),
    description: 'protocol.cyphal.example.droneCanToggleRejected.description',
    expectedValid: true,
  },
  {
    id: 'can-fd-rejected',
    name: 'protocol.cyphal.example.canFdRejected.name',
    // CAN FD kapsam DIŞI ve AÇIKÇA reddedilir (dosya başı: dolgu baytları
    // transfer CRC'sinin içindedir, "aynı biçim daha uzun payload" DEĞİL).
    bytes: buildCanFdFrame(
      0x107d552a,
      Array.from({ length: 64 }, (_unused, index) => index & 0xff),
      { extended: true },
    ),
    description: 'protocol.cyphal.example.canFdRejected.description',
    expectedValid: false,
  },
  {
    id: 'not-extended-rejected',
    name: 'protocol.cyphal.example.notExtendedRejected.name',
    // 11-bit (base) identifier: Cyphal/CAN 29-bit ZORUNLU kılar.
    bytes: buildCanClassicFrame(0x123, [0xaa, 0xe0]),
    description: 'protocol.cyphal.example.notExtendedRejected.description',
    expectedValid: false,
  },
];

export const cyphalPlugin: ProtocolPlugin = {
  id: PROTOCOL_ID,
  name: PROTOCOL_DISPLAY_NAME,
  category: 'aerospace-uav',
  parser: cyphalParser,
  documentation: {
    summary: 'protocol.cyphal.documentation.summary',
    layer: 'multi-layer',
    references: [
      {
        title: 'Cyphal Specification — Cyphal/CAN transport (OpenCyphal, LaTeX source)',
        url: 'https://github.com/OpenCyphal/specification/blob/master/specification/transport/can/can.tex',
      },
      {
        title: 'Cyphal Specification (opencyphal.org)',
        url: 'https://opencyphal.org/specification/',
      },
      {
        title: 'libcanard — reference C implementation of Cyphal/CAN (MIT)',
        url: 'https://github.com/OpenCyphal/libcanard',
      },
      {
        title: 'pycyphal — reference Python implementation, CAN wire codec (_wire.py)',
        url: 'https://github.com/OpenCyphal/pycyphal/blob/master/src/pycyphal2/can/_wire.py',
      },
    ],
  },
  exampleFrames: EXAMPLE_FRAMES,
  decodeOptions: DECODE_OPTIONS,
};
