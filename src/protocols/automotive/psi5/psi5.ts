/**
 * PSI5 (Peripheral Sensor Interface 5) — yukarı yön (sensör → ECU) veri
 * çerçevesi çözümü. Faz 10, dalga 14h; `sensor-interfaces` ailesinin üçüncü ve
 * SON kaydı, `automotive` domain'ini kapatan motor.
 *
 * ── GİRDİ: ÇÖZÜLMÜŞ ÇERÇEVE BİTLERİ, AKIM DALGASI YA DA MANCHESTER DEĞİL ────
 * (`dali.ts:48-53`in "GİRDİ HAM BAYT DİZİSİ, MANCHESTER KODLAMASI DEĞİL"
 * kararının BİREBİR aynısı; `lin.ts`in "NEDEN BREAK BİR BAYT DEĞİL" gerekçesi.)
 * PSI5 fiziksel katmanda akım modülasyonlu ve Manchester-2 (G.E. Thomas
 * konvansiyonu — IEEE 802.3'ün TERSİ) kodludur, ama bu kodlama hiçbir PSI5
 * alıcısında uygulamaya sızmaz: Infineon'un PSI5 çevre birimi çerçeveyi
 * `readData`/`crc` alanları olarak teslim eder. Spec özeti bu esnekliğe
 * AÇIKÇA izin veriyor (`ozet/04-otomotiv.md:171`: *"fiziksel current waveform
 * capture zorunlu olmayabilir; pulse/frame log import desteklenebilir"*).
 *
 * Bu yüzden 14h, 14f/14g'nin nabız günlüğü konteynerini (`decoding/pulseLog.ts`)
 * KULLANMAZ. `timing/currentLoop.ts` de SAHTE DOSTTUR ve çağrılmaz: PSI5
 * 4-20 mA akım ilmeği değildir, taban (quiescent) akımın üstüne ΔI_S kadar
 * ek akım çeken bir modülasyondur ve ΔI_S için kaynaklar ÇELİŞİYOR
 * (psi5.org "20 mA", DigiKey örneği "30 mA") — tek sayı KODA GÖMÜLMEDİ.
 *
 * Girdi sözleşmesi: çerçevenin bitleri İLETİM SIRASINDA, MSB-first bayta
 * paketlenmiş, bayt sınırına SIFIRLA doldurulmuş (`microwire.ts`in 25 clock'u
 * 4 bayta sıfır-dolgulaması ile aynı yol). Toplam uzunluk
 * `p = 2 (start) + k (payload) + 1 (parity)` ya da `p = 2 + k + 3 (CRC)`.
 *
 * ── KAYNAKLAR ──────────────────────────────────────────────────────────────
 * PSI5 Association spec'leri kayıt duvarının arkasında (psi5.org/specification
 * indirme bağlantıları webform'a çıkıyor — 2026-08-24'te doğrulandı). Aşağıdaki
 * her sayı EN AZ İKİ BAĞIMSIZ kamuya açık kaynakla çaprazlandı ve ikisi ayrıca
 * YAYIMLANMIŞ TEST VEKTÖRÜYLE hesapla doğrulandı:
 *
 *   1. **psi5.org/overview** (PSI5 Steering Committee'nin KENDİ sayfası) —
 *      *"PSI5 uses data frames with two start bits, 8…24 data bits and a parity
 *      bit or an optional three bit CRC"*, Manchester kodlama, "logic high =
 *      +20 mA", senkron modda *"an individual numbering of the sensors is
 *      required"*.
 *   2. **PSI5 Technical Specification V2.1 §3.2.1/§3.2.2/§3.2.3** (08.10.2012).
 *      KÖKEN AÇIKLAMASI (`dali.ts`in aynı disiplini): resmî nüsha kayıt
 *      duvarının arkasında; metne üçüncü taraf bir kopya üzerinden ulaşıldı, bu
 *      yüzden TEK BAŞINA kaynak sayılmadı. Ondan alınan HER sayı aşağıdaki
 *      satıcı belgeleriyle bağımsız olarak çaprazlandı ve ikisi test vektörüyle
 *      hesapla doğrulandı. Alıntılar —
 *      *"two start bits (S1 and S2), always coded as "0" … payload data region
 *      (D0 … D[k-1]) with k = 10..28 bit … p = k+3 (parity) veya k+5 (CRC) …
 *      Data bits are transmitted LSB first"*; alan sırası
 *      `[M0 M1][F0..F(q-1)][E0..E(r-1)][B0..B(m-1)][A0..A(n-1)]`.
 *   3. **Infineon KP405 datasheet Rev. 1.00 (2025-01-31) §4.1.2.3** — "10-bit
 *      protocol (13-bit data message)" ve "16-bit protocol (21-bit message):
 *      two start bits, two serial channel bits, fourteen data bits and three
 *      CRC check bits"; ÇALIŞILMIŞ CRC ÖRNEĞİ (Figure 11).
 *   4. **NXP MMA51xxKW datasheet §4.3.2/§4.3.3.2** — *"two start bits, an 8-Bit
 *      or 10-bit data word, and error detection bit(s). Data words are
 *      transmitted least-significant bit (LSB) first"*; DOKUZ CRC TEST VEKTÖRÜ.
 *   5. **Infineon iLLD `IfxPsi5_Psi5.h` + `IfxPsi5.h`** (AURIX_code_examples,
 *      BSL-1.0) — `crc : 3`, `crcOrParity[IFXPSI5_NUM_SLOTS]`,
 *      `payloadLength[slot]`, `BaudRate_125`/`BaudRate_189`, `slotCounter : 3`.
 *   6. **Infineon `iLLD_TC375_ADS_PSI5_SensorEmulator` README** — ÇALIŞILMIŞ
 *      parity örneği (aşağıda fixture).
 *   7. **Pico Technology PSI5 decoder belgesi** (bağımsız ölçüm cihazı üreticisi)
 *      — *"two start bits, a data payload (between 10-28 bit length), and error
 *      detection bit(s) … Data words are transmitted least significant bit (LSB)
 *      first and CRC bits are transmitted MSB first"*.
 *
 * ── REDDEDİLEN İDDİA (dalga 13 dersi 5) ────────────────────────────────────
 * *"8…24 data bits"* (psi5.org/overview + onu kopyalayan Wikipedia). Aynı
 * paragraf *"fixed 125kbps"* ve *"unidirectional"* da diyor; ikisi de V2.x'te
 * geçersiz (V1.3 §"Bidirectional communication" ile bidirectional oldu, 189
 * kbit/s beş bağımsız kaynakta var). Yani o özet V1.3 döneminden kalma ve
 * BAYAT. V2.x'in gerçek aralığı `k = 10…28`; `8` yalnız V1.3 mirası (Infineon
 * TC3xx: *"Configurable data word length 8, 10, 16, 20, 24 bit according to
 * standard (PSI5 V1.3)"*, NXP MMA51xxKW: 8 ya da 10). Bu yüzden aralık
 * REVİZYONA BAĞLI: seçenek 8…28 kabul eder, revizyonun dışına çıkan değer
 * UYARI üretir — sessizce bir tarafı seçmek kaynağı gizlemek olurdu.
 * Ayrıca dolaşımdaki *"8/10/12/16/20/24"* listesindeki **12 hiçbir kaynakta
 * YOK** ve kullanılmadı.
 *
 * ── CRC: GERÇEKTEN DOĞRULANIYOR (sent.ts'in TERSİ, gerekçesi burada) ────────
 * 14g'de SENT'in CRC-4'ü yalnız GÖSTERİLMİŞTİ çünkü tek açık kaynak koduyla
 * görülebilmiş, ikinci bağımsız birincil kaynakla çaprazlanamamıştı. PSI5'te
 * durum TERSİNE döndü: polinom+seed İKİ BAĞIMSIZ ÜRETİCİNİN veri sayfasında
 * aynı, üstelik İKİSİ DE YAYIMLANMIŞ TEST VEKTÖRÜ veriyor ve `psi5.test.ts`
 * onların ONUNU DA yeniden üretiyor. Bu yüzden Received/Calculated/PASS-FAIL
 * BASILIR (spec özeti `:173` "Parity, CRC" alanlarını zaten istiyor).
 *
 *   g(x) = x³ + x + 1, seed "111", veri LSB-first beslenir, ÜÇ SIFIRLA
 *   (MSB tarafından) genişletilir, START BİTLERİ HARİÇ, çıkış telde
 *   MSB-first (C2, C1, C0).
 *
 * **`crcEngine.ts`in `crc()`/`crcBits()`i ve `CRC4_ITU`/`CRC8` REDDEDİLDİ** —
 * dalga 13 dersi 2'nin ("aynı genişlik aynı algoritma değildir") ÖLÇÜLMÜŞ hâli:
 *   - `crcBits` bayt bazlı çalışır ve `refin` KISMİ BAYTTA ATAR
 *     (`crcEngine.ts:144`); PSI5'in beslemesi bayt sınırı tanımayan, tüm yük
 *     boyunca LSB-first bir bit akışıdır — sözleşme uymuyor.
 *   - Klasik "direct" (augmentation'sız) döngüye seed=111 koymak 1024 olası
 *     10-bit yükün **0'ında** doğru sonucu veriyor (ölçüldü, `psi5.test.ts`te
 *     bekçili). Direct forma karşılık gelen seed **010**'dur. Yani "aynı
 *     polinom + aynı seed" bile ALGORİTMA TOPOLOJİSİ farklıysa sessizce yanlış
 *     CRC üretir. Bu yüzden augmented biçim BURADA, açık açık yazıldı.
 * Katalog girdisi de AÇILMADI: `CrcParams` bu bit-seviyesi beslemeyi ifade
 * edemiyor, `crcCatalogue.ts`e sahte bir satır eklemek tuzağı yayınlamak olurdu.
 *
 * ── ÇÖZÜLMEYEN: SLOT ZAMAN ÇİZELGESİ (kayıt rozeti `partial`) ───────────────
 * Spec `:175` `SYNC → TS1[Sensor 1], TS2[Sensor 2], TS3[Sensor 3]` görünümü
 * istiyor. Bir slot penceresi TEK çerçevede GÖRÜNMEZ ve — asıl önemlisi —
 * PSI5'in yukarı yön çerçevesinde SENSÖR ADRESİ ALANI YOKTUR: kimlik ZAMAN
 * SLOTUyla belirlenir (spec V2.1 §2.4.2: *"each sensor starts transmitting its
 * data with the corresponding time shift in the assigned time slot"*), slot
 * numarası ve zaman damgası ALICININ ürettiği veridir (iLLD:
 * `slotCounter : 3`, `timestamp : 24` — ikisi de çerçevenin İÇİNDEN değil,
 * çevre biriminin sayacından gelir). Emsal üç kez kurulu ve üçünde de kayıt
 * rozetiyle kapandı: 12c DNS Transaction Matching, 12d PTP δ/θ, 14e FlexRay
 * cycle timeline.
 *
 * Tek istisna OPSİYONEL `Frame Control` alanıdır — spec V2.1 §3.2.3 onu
 * *"indicates type of frame or data content, **or identifies the sensor**"*
 * diye tanımlıyor. Yani sensör kimliği çerçevede OLABİLİR ama genişliği
 * sistem yapılandırmasından gelir; bu yüzden `frameControlBits` bir seçenektir
 * ve varsayılanı 0'dır.
 *
 * ── ÇÖZÜLMEYEN: PROFİL PRESET'LERİ (brifin "preset EKLENMEZ" kuralı) ────────
 * Spec `:181` Application Profile'ı metadata olarak istiyor ve doğru: üç
 * substandard belgesi (**"airbag"**, **"vehicle dynamics control"**,
 * **"powertrain"** — adlar psi5.org'un V2.0 changelog'undan birebir; DigiKey'in
 * kullandığı "chassis & safety" RESMÎ AD DEĞİL) HİÇBİR kamuya açık kaynakta
 * bulunamadı ve base standard bunları KASITLI olarak dışarıda bırakıyor
 * (V2.1 ¶228: *"Reserved for application specific definitions. Detailed
 * description is given within the application specific substandard."*).
 *
 * Bu yüzden `applicationProfile` YALNIZ METADATA'dır: seçilmesi HİÇBİR bit
 * genişliğini değiştirmez, yalnız alan tablosunun ilk satırında adıyla basılır.
 * `microwire.ts`in *"93xx66 gibi tablosu doğrulanmamış aileler yalnız custom
 * yolundan kullanılır"* kararının genelleştirilmiş hâli — orada preset
 * GÖNDERİLMEMİŞTİ, burada preset HİÇ YOK, sayıları kullanıcı verir.
 *
 * ── AŞAĞI YÖN (ECU → sensör) KAPSAM DIŞI ───────────────────────────────────
 * Aşağı yön çerçeveleri TAMAMEN FARKLI bir biçimdir: üç (Frame 1-3) ya da
 * DOKUZ (Frame 4) start biti, 3 bitlik sensör adresi, function code ve 3 ya da
 * 6 bitlik CRC. 6-bit CRC'nin polinomu (x⁶+x⁴+x³+1, seed "010101") TEK
 * kaynakta var ve test vektörü YOK — doğrulanamadı. İki yönü tek alan
 * tablosunda birleştirmek hatalı olurdu; aşağı yön bu dalgaya GİRMEDİ.
 */

import { readBitsAsNumber } from '@/protocol-core/decoding/bitCursor';
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
const PROTOCOL_ID = 'psi5';
/** Protokol adı veridir, çeviriye girmez (CLAUDE.md). */
const PROTOCOL_DISPLAY_NAME = 'PSI5';

const BITS_PER_BYTE = 8;
const HEX_RADIX = 16;

/** İki start biti; V2.1 §3.2.1 "always coded as 0". */
const START_BIT_COUNT = 2;
const PARITY_BIT_COUNT = 1;
const CRC_BIT_COUNT = 3;

const OPTION_APPLICATION_PROFILE = 'applicationProfile';
const OPTION_REVISION = 'psi5Revision';
const OPTION_COMMUNICATION_MODE = 'communicationMode';
const OPTION_PAYLOAD_BITS = 'payloadBitCount';
const OPTION_ERROR_CHECK = 'errorCheck';
const OPTION_MESSAGING_BITS = 'messagingBits';
const OPTION_FRAME_CONTROL_BITS = 'frameControlBits';
const OPTION_STATUS_BITS = 'statusBits';
const OPTION_REGION_B_BITS = 'regionBBits';

/**
 * Yük genişliği sınırları. Alt sınır 8 çünkü V1.3 sekiz bitlik veri sözcüğüne
 * izin veriyor (NXP MMA51xxKW gerçekten destekliyor); üst sınır 28 çünkü V2.1
 * §3.2.1 `k = 10..28` diyor. Revizyona göre daralan gerçek aralık
 * `revisionPayloadRange` ile ayrıca UYARI olarak bildirilir.
 */
const PAYLOAD_BITS_MIN = 8;
const PAYLOAD_BITS_MAX = 28;
const DEFAULT_PAYLOAD_BITS = 10;

/** V2.1 §3.2.3'ün opsiyonel alan genişlikleri (M 0/2, F 0-4, E 0-2, B 0-12). */
const MESSAGING_BITS_MAX = 2;
const FRAME_CONTROL_BITS_MAX = 4;
const STATUS_BITS_MAX = 2;
const REGION_B_BITS_MAX = 12;

const ERROR_CHECK_PARITY = 'parity';
const ERROR_CHECK_CRC3 = 'crc3';

const REVISION_V1_3 = 'v1-3';
const REVISION_V2_1 = 'v2-1';

const ERROR_EMPTY_FRAME = 'protocol.psi5.error.empty';
const ERROR_TRUNCATED = 'protocol.psi5.error.truncated';
const ERROR_SUBFIELDS_EXCEED_PAYLOAD = 'protocol.psi5.error.subFieldsExceedPayload';
const ERROR_PARITY_MISMATCH = 'protocol.psi5.error.parityMismatch';
const ERROR_CRC_MISMATCH = 'protocol.psi5.error.crcMismatch';

const WARN_START_BITS_NOT_ZERO = 'protocol.psi5.warning.startBitsNotZero';
const WARN_TRAILING_BITS = 'protocol.psi5.warning.trailingBits';
const WARN_PADDING_NOT_ZERO = 'protocol.psi5.warning.paddingNotZero';
const WARN_PAYLOAD_OUT_OF_REVISION_RANGE = 'protocol.psi5.warning.payloadOutOfRevisionRange';
const WARN_REGION_A_BELOW_MINIMUM = 'protocol.psi5.warning.regionABelowMinimum';
const WARN_SLOT_TIMELINE_NOT_RESOLVED = 'protocol.psi5.warning.slotTimelineNotResolved';
const WARN_PROFILE_METADATA_ONLY = 'protocol.psi5.warning.profileMetadataOnly';
const WARN_MESSAGING_WIDTH = 'protocol.psi5.warning.messagingWidth';

/**
 * Panelin basacağı form. PSI5'te bu kanal SÜS DEĞİL, ZORUNLU: yük genişliği ve
 * parity/CRC seçimi telin İÇİNDE YOKTUR, alıcının yazmacında durur — Infineon
 * iLLD bunu kanıtlıyor (`payloadLength[slot]`, `crcOrParity[slot]` ikisi de
 * SLOT BAŞINA yapılandırma). Kanal açılmadan bu kayıt tek bir alan bile
 * üretemez (spec `:181`: *"toolkit ... tek global frame formatı varsaymamalıdır"*).
 */
const DECODE_OPTIONS: readonly DecodeOption[] = [
  {
    id: OPTION_APPLICATION_PROFILE,
    label: 'protocol.psi5.option.applicationProfile',
    kind: 'select',
    defaultValue: 'unspecified',
    description: 'protocol.psi5.option.applicationProfile.description',
    choices: [
      { value: 'unspecified', label: 'protocol.psi5.option.applicationProfile.unspecified' },
      // Üç substandard adı psi5.org'un V2.0 changelog'undan BİREBİR — veri, çeviriye girmez.
      { value: 'airbag', label: 'Airbag' },
      { value: 'vehicle-dynamics-control', label: 'Vehicle Dynamics Control' },
      { value: 'powertrain', label: 'Powertrain' },
    ],
  },
  {
    id: OPTION_REVISION,
    label: 'protocol.psi5.option.revision',
    kind: 'select',
    // V2.1 seçili: alan düzeni BU sürümün metniyle doğrulandı, V2.2/V2.3
    // metinlerine erişilemedi (aşağıdaki uyarı bunu söylüyor).
    defaultValue: REVISION_V2_1,
    description: 'protocol.psi5.option.revision.description',
    choices: [
      // Sürüm adları ve tarihleri psi5.org/specification'ın resmî tablosundan.
      { value: REVISION_V1_3, label: 'V1.3 (31.07.2008)' },
      { value: 'v2-0', label: 'V2.0 (01.06.2011)' },
      { value: REVISION_V2_1, label: 'V2.1 (08.10.2012)' },
      { value: 'v2-2', label: 'V2.2 (10.08.2016)' },
      { value: 'v2-3', label: 'V2.3 (01.02.2018)' },
    ],
  },
  {
    id: OPTION_COMMUNICATION_MODE,
    label: 'protocol.psi5.option.communicationMode',
    kind: 'select',
    defaultValue: 'A',
    description: 'protocol.psi5.option.communicationMode.description',
    choices: [
      // V2.1 §2.2'nin KENDİ mod harfleri. "auto" ŞIKKI YOK: sync/async ayrımı
      // çerçevede hiçbir bitle temsil edilmiyor, ECU'nun GERİLİM darbesiyle
      // yapılıyor — "otomatik" demek yalan olurdu.
      { value: 'A', label: 'PSI5-A — Asynchronous' },
      { value: 'P', label: 'PSI5-P — Synchronous Parallel Bus' },
      { value: 'U', label: 'PSI5-U — Synchronous Universal Bus' },
      { value: 'D', label: 'PSI5-D — Synchronous Daisy Chain Bus' },
      { value: 'V', label: 'PSI5-V — Variable Time Triggered Synchronous' },
    ],
  },
  {
    id: OPTION_PAYLOAD_BITS,
    label: 'protocol.psi5.option.payloadBitCount',
    kind: 'number',
    defaultValue: DEFAULT_PAYLOAD_BITS,
    min: PAYLOAD_BITS_MIN,
    max: PAYLOAD_BITS_MAX,
    description: 'protocol.psi5.option.payloadBitCount.description',
  },
  {
    id: OPTION_ERROR_CHECK,
    label: 'protocol.psi5.option.errorCheck',
    kind: 'select',
    defaultValue: ERROR_CHECK_PARITY,
    description: 'protocol.psi5.option.errorCheck.description',
    choices: [
      { value: ERROR_CHECK_PARITY, label: 'Parity (1 bit, even)' },
      { value: ERROR_CHECK_CRC3, label: 'CRC (3 bit)' },
    ],
  },
  {
    id: OPTION_MESSAGING_BITS,
    label: 'protocol.psi5.option.messagingBits',
    kind: 'number',
    defaultValue: 0,
    min: 0,
    max: MESSAGING_BITS_MAX,
    description: 'protocol.psi5.option.messagingBits.description',
  },
  {
    id: OPTION_FRAME_CONTROL_BITS,
    label: 'protocol.psi5.option.frameControlBits',
    kind: 'number',
    defaultValue: 0,
    min: 0,
    max: FRAME_CONTROL_BITS_MAX,
    description: 'protocol.psi5.option.frameControlBits.description',
  },
  {
    id: OPTION_STATUS_BITS,
    label: 'protocol.psi5.option.statusBits',
    kind: 'number',
    defaultValue: 0,
    min: 0,
    max: STATUS_BITS_MAX,
    description: 'protocol.psi5.option.statusBits.description',
  },
  {
    id: OPTION_REGION_B_BITS,
    label: 'protocol.psi5.option.regionBBits',
    kind: 'number',
    defaultValue: 0,
    min: 0,
    max: REGION_B_BITS_MAX,
    description: 'protocol.psi5.option.regionBBits.description',
  },
];

/**
 * PSI5'in üç bitlik CRC'si — V2.1 §3.2.2 ve NXP MMA51xxKW §4.3.3.2'nin
 * BİREBİR AYNI tarifi:
 *   g(x) = x³ + x + 1, seed "111", veri LSB-first beslenir ve ÜÇ SIFIRLA
 *   (MSB tarafından) genişletilir; start bitleri HESABA GİRMEZ.
 *
 * Geri besleme DIŞARI ÇIKAN bitten alınır (klasik "non-direct/augmented"
 * topoloji). Bu, `crcEngine.ts`in kullandığı "direct" döngüden FARKLI bir
 * makinedir — aynı polinom ve aynı seed ile direct döngü 1024 olası 10-bit
 * yükün HİÇBİRİNDE doğru sonuç vermez (bkz. dosya başı ve `psi5.test.ts`).
 *
 * Dönen değer telde MSB-first gönderilen (C2, C1, C0) üçlüsünün sayısal
 * karşılığıdır; yani `readBitsAsNumber(..., 3, 'msb-first')` ile doğrudan
 * karşılaştırılabilir.
 */
export function psi5Crc3(payload: number, payloadBitCount: number): number {
  let register = 0x7;
  for (let index = 0; index < payloadBitCount + CRC_BIT_COUNT; index += 1) {
    const bit = index < payloadBitCount ? (payload >>> index) & 1 : 0;
    const outgoing = (register >>> 2) & 1;
    register = ((register << 1) | bit) & 0x7;
    if (outgoing === 1) register ^= 0x3;
  }
  return register;
}

/** Çift (even) parite: yükün bir bitlerinin sayısı tek ise 1. Start bitleri hariç. */
export function psi5EvenParity(payload: number, payloadBitCount: number): number {
  let parity = 0;
  for (let index = 0; index < payloadBitCount; index += 1) {
    parity ^= (payload >>> index) & 1;
  }
  return parity;
}

interface ResolvedProfile {
  readonly applicationProfile: string;
  readonly applicationProfileLabel: string;
  readonly revision: string;
  readonly revisionLabel: string;
  readonly communicationModeLabel: string;
  readonly payloadBits: number;
  readonly usesCrc: boolean;
  readonly messagingBits: number;
  readonly frameControlBits: number;
  readonly statusBits: number;
  readonly regionBBits: number;
}

function optionLabel(optionId: string, value: string, fallback: string): string {
  const option = DECODE_OPTIONS.find((candidate) => candidate.id === optionId);
  const choice = option?.choices?.find((candidate) => candidate.value === value);
  return choice === undefined ? fallback : choice.label;
}

function clampInteger(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  const rounded = Math.round(value);
  if (rounded < min || rounded > max) return fallback;
  return rounded;
}

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

/**
 * Seçenekleri yürürlükteki yapılandırmaya çevirir. Tanınmayan/eksik değer
 * varsayılana düşer — panel her tuş vuruşunda `parse` çağırıyor ve yarım girdi
 * yüzünden çözümün tamamen kaybolması kullanıcıyı ekranda kör bırakırdı
 * (`microwire.ts`in aynı gerekçesi).
 */
function resolveProfile(options: Record<string, unknown> | undefined): ResolvedProfile {
  const applicationProfile = readSelect(options, OPTION_APPLICATION_PROFILE, 'unspecified');
  const revision = readSelect(options, OPTION_REVISION, REVISION_V2_1);
  const communicationMode = readSelect(options, OPTION_COMMUNICATION_MODE, 'A');

  return {
    applicationProfile,
    applicationProfileLabel: optionLabel(OPTION_APPLICATION_PROFILE, applicationProfile, applicationProfile),
    revision,
    revisionLabel: optionLabel(OPTION_REVISION, revision, revision),
    communicationModeLabel: optionLabel(OPTION_COMMUNICATION_MODE, communicationMode, communicationMode),
    payloadBits: clampInteger(
      options?.[OPTION_PAYLOAD_BITS],
      PAYLOAD_BITS_MIN,
      PAYLOAD_BITS_MAX,
      DEFAULT_PAYLOAD_BITS,
    ),
    usesCrc: readSelect(options, OPTION_ERROR_CHECK, ERROR_CHECK_PARITY) === ERROR_CHECK_CRC3,
    messagingBits: clampInteger(options?.[OPTION_MESSAGING_BITS], 0, MESSAGING_BITS_MAX, 0),
    frameControlBits: clampInteger(options?.[OPTION_FRAME_CONTROL_BITS], 0, FRAME_CONTROL_BITS_MAX, 0),
    statusBits: clampInteger(options?.[OPTION_STATUS_BITS], 0, STATUS_BITS_MAX, 0),
    regionBBits: clampInteger(options?.[OPTION_REGION_B_BITS], 0, REGION_B_BITS_MAX, 0),
  };
}

/**
 * Revizyonun izin verdiği yük aralığı. V1.3 sekiz bitlik veri sözcüğüne izin
 * veriyor (Infineon TC3xx: "8, 10, 16, 20, 24 bit according to standard (PSI5
 * V1.3)"); V2.x'te taban 10'a çıkıyor (V2.1 §3.2.1 `k = 10..28`).
 */
function revisionPayloadRange(revision: string): { min: number; max: number } {
  return revision === REVISION_V1_3 ? { min: 8, max: 24 } : { min: 10, max: 28 };
}

/**
 * Bit aralığını KAPSAYAN bayt aralığı. Çerçeve bit hizalıdır (13/21/… bit),
 * `ParsedField.offset`/`length` ise BAYT cinsindendir (`types.ts:34-36`,
 * kilitli sözleşme) — bit ayrıntısı alan ADINDA taşınır (`rtp.ts`/`rtcp.ts`,
 * `microwire.ts` emsali).
 */
function byteSpan(bitOffset: number, bitLength: number): { offset: number; length: number } {
  if (bitLength <= 0) return { offset: Math.floor(bitOffset / BITS_PER_BYTE), length: 0 };
  const firstByte = Math.floor(bitOffset / BITS_PER_BYTE);
  const lastByte = Math.floor((bitOffset + bitLength - 1) / BITS_PER_BYTE);
  return { offset: firstByte, length: lastByte - firstByte + 1 };
}

function formatHex(value: number, bitLength: number): string {
  const digits = Math.max(1, Math.ceil(bitLength / 4));
  return `0x${value.toString(HEX_RADIX).toUpperCase().padStart(digits, '0')}`;
}

function formatBinary(value: number, bitLength: number): string {
  return `0b${value.toString(2).padStart(Math.max(bitLength, 1), '0')}`;
}

/**
 * Telden bir alt alanın değerini okur. Yük LSB-first gönderildiği için
 * `payloadBitOffset` konumundaki tel biti alt alanın EN DÜŞÜK bitidir.
 */
function readLsbFirst(data: Uint8Array, wireBitOffset: number, bitLength: number): number {
  let value = 0;
  for (let index = 0; index < bitLength; index += 1) {
    value |= readBitsAsNumber(data, wireBitOffset + index, 1) << index;
  }
  return value >>> 0;
}

interface Psi5ParseOptions {
  timestamp?: number;
  direction?: FrameDirection;
  channel?: string;
  options?: Record<string, unknown>;
}

interface Psi5FrameMetadata extends Record<string, unknown> {
  readonly applicationProfile: string;
  readonly revision: string;
  readonly payloadBits: number;
  readonly errorCheck: string;
  readonly payloadValue: number;
}

function failure(
  code: ProtocolError['code'],
  message: string,
  data: Uint8Array,
  details?: Record<string, unknown>,
): ParseResult {
  return {
    success: false,
    error: {
      code,
      message,
      offset: 0,
      length: data.length,
      ...(details === undefined ? {} : { details }),
    },
    consumedBytes: 0,
    recoverable: false,
  };
}

function parsePsi5Frame(data: Uint8Array, parseOptions: Psi5ParseOptions): ParseResult {
  if (data.length === 0) {
    return failure('truncated-frame', ERROR_EMPTY_FRAME, data, { availableBytes: 0 });
  }

  const resolved = resolveProfile(parseOptions.options);
  const checkBits = resolved.usesCrc ? CRC_BIT_COUNT : PARITY_BIT_COUNT;
  const requiredBits = START_BIT_COUNT + resolved.payloadBits + checkBits;
  const availableBits = data.length * BITS_PER_BYTE;

  if (requiredBits > availableBits) {
    return failure('truncated-frame', ERROR_TRUNCATED, data, {
      requiredBits,
      availableBits,
      payloadBits: resolved.payloadBits,
      errorCheck: resolved.usesCrc ? ERROR_CHECK_CRC3 : ERROR_CHECK_PARITY,
    });
  }

  const optionalBits =
    resolved.messagingBits + resolved.frameControlBits + resolved.statusBits + resolved.regionBBits;
  if (optionalBits > resolved.payloadBits) {
    return failure('value-out-of-range', ERROR_SUBFIELDS_EXCEED_PAYLOAD, data, {
      optionalBits,
      payloadBits: resolved.payloadBits,
    });
  }

  const fields: ParsedField[] = [];
  const warnings: ProtocolWarning[] = [];
  const errors: ProtocolError[] = [];

  // İLK SATIR YÜRÜRLÜKTEKİ PROFİL (microwire.ts kararı): kullanıcı hangi
  // sayılarla çözüldüğünü tahmin etmek zorunda kalmasın. `physicalValue`
  // kaynağı taşır — profilin uydurulmadığı burada görünür.
  const profileWarnings: string[] = [WARN_SLOT_TIMELINE_NOT_RESOLVED];
  if (resolved.applicationProfile !== 'unspecified') {
    profileWarnings.push(WARN_PROFILE_METADATA_ONLY);
  }
  fields.push({
    id: 'profile',
    name: 'Profile',
    offset: 0,
    length: 0,
    rawBytes: new Uint8Array(),
    rawValue: `PSI5 ${resolved.revisionLabel} · ${resolved.communicationModeLabel} · ${String(resolved.payloadBits)} bit payload · ${resolved.usesCrc ? 'CRC (3 bit)' : 'Parity (1 bit, even)'} · profile ${resolved.applicationProfileLabel}`,
    physicalValue: 'PSI5 Technical Specification V2.1 §3.2.1–§3.2.3 · psi5.org/specification',
    valid: true,
    warnings: profileWarnings,
  });

  // ── Start bitleri ────────────────────────────────────────────────────────
  const startBits = readBitsAsNumber(data, 0, START_BIT_COUNT);
  const startBitsValid = startBits === 0;
  fields.push({
    id: 'startBits',
    name: 'Start Bits (S1, S2) · wire bit 0–1',
    ...byteSpan(0, START_BIT_COUNT),
    rawBytes: data.slice(0, 1),
    rawValue: formatBinary(startBits, START_BIT_COUNT),
    physicalValue: startBitsValid ? 'S1=0, S2=0' : 'Expected 0b00',
    valid: startBitsValid,
    warnings: startBitsValid ? [] : [WARN_START_BITS_NOT_ZERO],
  });
  if (!startBitsValid) {
    warnings.push({ code: 'start-bits-not-zero', message: WARN_START_BITS_NOT_ZERO, offset: 0, length: 1 });
  }

  // ── Yük bölgesi ve alt alanları ──────────────────────────────────────────
  const payloadWireOffset = START_BIT_COUNT;
  const payloadValue = readLsbFirst(data, payloadWireOffset, resolved.payloadBits);
  const payloadSpan = byteSpan(payloadWireOffset, resolved.payloadBits);

  const range = revisionPayloadRange(resolved.revision);
  if (resolved.payloadBits < range.min || resolved.payloadBits > range.max) {
    warnings.push({ code: 'payload-out-of-revision-range', message: WARN_PAYLOAD_OUT_OF_REVISION_RANGE });
  }
  if (resolved.messagingBits === 1) {
    warnings.push({ code: 'messaging-width', message: WARN_MESSAGING_WIDTH });
  }

  fields.push({
    id: 'payload',
    name: `Payload Data Region · wire bit ${String(payloadWireOffset)}–${String(payloadWireOffset + resolved.payloadBits - 1)} (LSB first)`,
    ...payloadSpan,
    rawBytes: data.slice(payloadSpan.offset, payloadSpan.offset + payloadSpan.length),
    rawValue: formatBinary(payloadValue, resolved.payloadBits),
    physicalValue: formatHex(payloadValue, resolved.payloadBits),
    valid: true,
    warnings: [],
  });

  // Alt alanlar V2.1 §3.2.3'ün SIRASIYLA, yükün EN DÜŞÜK bitinden başlayarak:
  // [M0 M1][F0..][E0..][B0..][A0..]. Genişlikler yapılandırmadan gelir; sıfır
  // genişlikli alan BASILMAZ (varsayılan görünüm sade kalsın).
  const subFields: readonly { id: string; name: string; bits: number }[] = [
    { id: 'messaging', name: 'Messaging (M)', bits: resolved.messagingBits },
    { id: 'frameControl', name: 'Frame Control (F)', bits: resolved.frameControlBits },
    { id: 'status', name: 'Status (E)', bits: resolved.statusBits },
    { id: 'regionB', name: 'Data Region B', bits: resolved.regionBBits },
    { id: 'regionA', name: 'Data Region A', bits: resolved.payloadBits - optionalBits },
  ];

  let subFieldBitCursor = payloadWireOffset;
  for (const subField of subFields) {
    if (subField.bits <= 0) continue;
    const span = byteSpan(subFieldBitCursor, subField.bits);
    const value = readLsbFirst(data, subFieldBitCursor, subField.bits);
    const isRegionA = subField.id === 'regionA';
    const belowMinimum = isRegionA && subField.bits < range.min;
    fields.push({
      id: subField.id,
      name: `${subField.name} · wire bit ${String(subFieldBitCursor)}–${String(subFieldBitCursor + subField.bits - 1)} (LSB first)`,
      ...span,
      rawBytes: data.slice(span.offset, span.offset + span.length),
      rawValue: formatBinary(value, subField.bits),
      physicalValue: formatHex(value, subField.bits),
      valid: true,
      warnings: belowMinimum ? [WARN_REGION_A_BELOW_MINIMUM] : [],
    });
    if (belowMinimum) {
      warnings.push({ code: 'region-a-below-minimum', message: WARN_REGION_A_BELOW_MINIMUM });
    }
    subFieldBitCursor += subField.bits;
  }

  // ── Hata denetimi: parity ya da 3 bit CRC ────────────────────────────────
  const checkWireOffset = payloadWireOffset + resolved.payloadBits;
  const checkSpan = byteSpan(checkWireOffset, checkBits);
  const receivedCheck = readBitsAsNumber(data, checkWireOffset, checkBits);
  const computedCheck = resolved.usesCrc
    ? psi5Crc3(payloadValue, resolved.payloadBits)
    : psi5EvenParity(payloadValue, resolved.payloadBits);
  const checkValid = receivedCheck === computedCheck;

  fields.push({
    id: resolved.usesCrc ? 'crc' : 'parity',
    name: resolved.usesCrc
      ? `CRC (C2, C1, C0) · wire bit ${String(checkWireOffset)}–${String(checkWireOffset + CRC_BIT_COUNT - 1)} (MSB first)`
      : `Parity (P, even) · wire bit ${String(checkWireOffset)}`,
    ...checkSpan,
    rawBytes: data.slice(checkSpan.offset, checkSpan.offset + checkSpan.length),
    rawValue: formatBinary(receivedCheck, checkBits),
    physicalValue: checkValid ? 'Valid' : `Invalid (computed ${formatBinary(computedCheck, checkBits)})`,
    valid: checkValid,
    warnings: [],
  });

  if (!checkValid) {
    errors.push({
      code: resolved.usesCrc ? 'crc-mismatch' : 'checksum-mismatch',
      message: resolved.usesCrc ? ERROR_CRC_MISMATCH : ERROR_PARITY_MISMATCH,
      offset: checkSpan.offset,
      length: checkSpan.length,
      details: {
        received: formatBinary(receivedCheck, checkBits),
        computed: formatBinary(computedCheck, checkBits),
      },
    });
  }

  // ── Bayt sınırına dolgu ──────────────────────────────────────────────────
  const paddingBits = availableBits - requiredBits;
  if (paddingBits > 0) {
    const paddingSpan = byteSpan(requiredBits, paddingBits);
    // 8 bitten uzun artık, çerçevenin kendisi değil BİR SONRAKİ yakalamadır:
    // ayrı bir uyarı, çünkü sebebi farklı (yanlış yük/hata-denetimi ayarı).
    const isPadding = paddingBits < BITS_PER_BYTE;
    const paddingValue = readBitsAsNumber(data, requiredBits, Math.min(paddingBits, 32));
    const paddingClean = paddingValue === 0;
    const paddingWarnings: string[] = [];
    if (!isPadding) paddingWarnings.push(WARN_TRAILING_BITS);
    if (!paddingClean) paddingWarnings.push(WARN_PADDING_NOT_ZERO);
    fields.push({
      id: 'padding',
      name: `Padding to byte boundary · wire bit ${String(requiredBits)}–${String(availableBits - 1)}`,
      ...paddingSpan,
      rawBytes: data.slice(paddingSpan.offset, paddingSpan.offset + paddingSpan.length),
      rawValue: formatBinary(paddingValue, Math.min(paddingBits, 32)),
      valid: paddingClean,
      warnings: paddingWarnings,
    });
    if (!isPadding) {
      warnings.push({ code: 'trailing-bits', message: WARN_TRAILING_BITS });
    }
    if (!paddingClean) {
      warnings.push({ code: 'padding-not-zero', message: WARN_PADDING_NOT_ZERO });
    }
  }

  const metadata: Psi5FrameMetadata = {
    applicationProfile: resolved.applicationProfile,
    revision: resolved.revision,
    payloadBits: resolved.payloadBits,
    errorCheck: resolved.usesCrc ? ERROR_CHECK_CRC3 : ERROR_CHECK_PARITY,
    payloadValue,
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
    valid: errors.length === 0 && startBitsValid,
    errors,
    warnings,
  };

  return { success: true, frame, consumedBytes: data.length };
}

export function parsePsi5(data: Uint8Array, options?: Record<string, unknown>): ParseResult {
  return parsePsi5Frame(data, options === undefined ? {} : { options });
}

/** İmzada sınanan yük genişlikleri — yukarıdaki gerekçe. */
const CAN_PARSE_PAYLOAD_WIDTHS: readonly number[] = [10, 16, 20, 24];

/**
 * PSI5 yakalamalarının auto-detection imzası. `canParse` SEÇENEK ALMAZ
 * (`ProtocolParser` sözleşmesi), o yüzden "her k ve her hata denetimi"
 * denenemez — 14f'in dersi (naif imza 761 örneğin 413'ünü kabul etmişti) tam
 * burada tekrar edecekti.
 *
 * **PARİTE BİÇİMİ İMZAYA GİRMEZ ve bu ÖLÇÜLMÜŞ bir karardır.** Tek bir parite
 * biti bir bitlik kanıt taşır; "2 bayt + üst iki bit sıfır + 3 bit dolgu sıfır
 * + parite tutuyor" eleği 777 kayıt örneğinden İKİSİNİ yanlış pozitif kabul
 * ediyordu (`as-interface/end-bit-error` ve `ble-advertisement/unknown-pdu-type`
 * — ikisi de gerçekten geçerli birer PSI5-10P çerçevesine BAYT BAYT eşit,
 * yapısal olarak ayrılamazlar). 3 bitlik CRC üç bit kanıt taşır ve aynı tarama
 * SIFIR çarpışma veriyor (`psi5CanParseRegistry.test.ts` ikisini de bekçiler).
 *
 * Sınanan yük genişlikleri UYDURULMADI: Infineon AURIX TC3xx'in belgelediği
 * *"Configurable data word length 8, 10, 16, 20, 24 bit according to standard"*
 * listesinin V2.x'in `k ≥ 10` tabanıyla kesişimi. Her birinde start bitleri 0,
 * bayt sınırına kadarki dolgu bitleri 0 ve CRC GERÇEKTEN tutmak zorunda.
 *
 * Parite biçimindeki (tamamen geçerli) yakalamalar auto-detection ile ayırt
 * EDİLEMEZ; bu bilinen ve kabul edilen sınırdır (`microwire.ts`in aynı kabulü)
 * — `decode` sekmesi seçeneklerle hepsini çözer.
 */
function matchesCanonicalConfiguration(data: Uint8Array, payloadBits: number, usesCrc: boolean): boolean {
  const checkBits = usesCrc ? CRC_BIT_COUNT : PARITY_BIT_COUNT;
  const requiredBits = START_BIT_COUNT + payloadBits + checkBits;
  if (data.length !== Math.ceil(requiredBits / BITS_PER_BYTE)) return false;
  if (readBitsAsNumber(data, 0, START_BIT_COUNT) !== 0) return false;

  const paddingBits = data.length * BITS_PER_BYTE - requiredBits;
  if (paddingBits > 0 && readBitsAsNumber(data, requiredBits, paddingBits) !== 0) return false;

  const payload = readLsbFirst(data, START_BIT_COUNT, payloadBits);
  const received = readBitsAsNumber(data, START_BIT_COUNT + payloadBits, checkBits);
  const computed = usesCrc ? psi5Crc3(payload, payloadBits) : psi5EvenParity(payload, payloadBits);
  return received === computed;
}

export const psi5Parser: ProtocolParser = {
  protocolId: PROTOCOL_ID,
  displayName: PROTOCOL_DISPLAY_NAME,

  canParse(data: Uint8Array): boolean {
    return CAN_PARSE_PAYLOAD_WIDTHS.some((payloadBits) =>
      matchesCanonicalConfiguration(data, payloadBits, true),
    );
  },

  parse(data: Uint8Array, context?: ParseContext): ParseResult {
    const options: Psi5ParseOptions = {};
    if (context?.timestamp !== undefined) options.timestamp = context.timestamp;
    if (context?.direction !== undefined) options.direction = context.direction;
    if (context?.channel !== undefined) options.channel = context.channel;
    if (context?.options !== undefined) options.options = context.options;
    return parsePsi5Frame(data, options);
  },
};

/**
 * Çerçeve kurucu — örnekler ve testler AYNI yoldan üretilir, böylece ekrandaki
 * örnek testte de yeşildir (spec §43 disiplini).
 *
 * `payloadValue` MANTIKSAL değerdir (LSB'i telde ÖNCE gider); fonksiyon bit
 * paketlemeyi yapar, çağıran elle bit dizmez.
 */
export function buildPsi5Frame(options: {
  payloadValue: number;
  payloadBits: number;
  usesCrc: boolean;
  /** Verilirse hesaplananın YERİNE yazılır — kasten bozuk örnek üretmek için. */
  overrideCheck?: number;
  /** Verilirse start bitleri bu değerle yazılır (varsayılan 0b00). */
  startBits?: number;
}): Uint8Array {
  const checkBits = options.usesCrc ? CRC_BIT_COUNT : PARITY_BIT_COUNT;
  const totalBits = START_BIT_COUNT + options.payloadBits + checkBits;
  const bytes = new Uint8Array(Math.ceil(totalBits / BITS_PER_BYTE));

  const writeBit = (position: number, bit: number): void => {
    if (bit === 0) return;
    const byteIndex = Math.floor(position / BITS_PER_BYTE);
    const shift = BITS_PER_BYTE - 1 - (position % BITS_PER_BYTE);
    const current = bytes[byteIndex] ?? 0;
    bytes[byteIndex] = current | (1 << shift);
  };

  const startBits = options.startBits ?? 0;
  for (let index = 0; index < START_BIT_COUNT; index += 1) {
    writeBit(index, (startBits >>> (START_BIT_COUNT - 1 - index)) & 1);
  }
  for (let index = 0; index < options.payloadBits; index += 1) {
    writeBit(START_BIT_COUNT + index, (options.payloadValue >>> index) & 1);
  }
  const check =
    options.overrideCheck ??
    (options.usesCrc
      ? psi5Crc3(options.payloadValue, options.payloadBits)
      : psi5EvenParity(options.payloadValue, options.payloadBits));
  for (let index = 0; index < checkBits; index += 1) {
    writeBit(START_BIT_COUNT + options.payloadBits + index, (check >>> (checkBits - 1 - index)) & 1);
  }

  return bytes;
}

/**
 * Örnek çerçeveler. İlk ikisi UYDURULMADI: ikisi de bir SATICININ KENDİ
 * belgesindeki çalışılmış örnektir ve `psi5.test.ts` onları bayt bayt bekçiler.
 */
const EXAMPLE_FRAMES: ExampleFrame[] = [
  {
    id: 'airbag-10-parity',
    name: 'protocol.psi5.example.airbag10Parity.name',
    // Infineon `iLLD_TC375_ADS_PSI5_SensorEmulator` README: start bitleri S0/S1,
    // ardından 10 veri biti "0001110000", son bit parity=1. Aynı belge alıcı
    // yazmacında RD = 0x38 okunduğunu söylüyor — LSB-first okumanın KANITI.
    bytes: buildPsi5Frame({ payloadValue: 0x038, payloadBits: 10, usesCrc: false }),
    description: 'protocol.psi5.example.airbag10Parity.description',
    expectedValid: true,
  },
  {
    id: 'airbag-16-crc',
    name: 'protocol.psi5.example.airbag16Crc.name',
    // Infineon KP405 datasheet Rev. 1.00 Figure 11: 16 bitlik yük 0xAD2C,
    // CRC (C2,C1,C0) = 0b100. Varsayılan seçeneklerle DEĞİL, `payloadBitCount`
    // 16 ve `errorCheck` CRC seçilerek çözülür (açıklama metni bunu söyler).
    bytes: buildPsi5Frame({ payloadValue: 0xad2c, payloadBits: 16, usesCrc: true }),
    description: 'protocol.psi5.example.airbag16Crc.description',
    expectedValid: true,
  },
  {
    id: 'bad-parity',
    name: 'protocol.psi5.example.badParity.name',
    bytes: buildPsi5Frame({ payloadValue: 0x038, payloadBits: 10, usesCrc: false, overrideCheck: 0 }),
    description: 'protocol.psi5.example.badParity.description',
    expectedValid: false,
  },
  {
    id: 'start-bit-error',
    name: 'protocol.psi5.example.startBitError.name',
    bytes: buildPsi5Frame({ payloadValue: 0x038, payloadBits: 10, usesCrc: false, startBits: 0b01 }),
    description: 'protocol.psi5.example.startBitError.description',
    expectedValid: false,
  },
  {
    id: 'truncated',
    name: 'protocol.psi5.example.truncated.name',
    // Tek bayt: varsayılan yapılandırma 13 bit istiyor, 8 bit var.
    bytes: Uint8Array.from([0x07]),
    description: 'protocol.psi5.example.truncated.description',
    expectedValid: false,
  },
];

export const psi5Plugin: ProtocolPlugin = {
  id: PROTOCOL_ID,
  name: PROTOCOL_DISPLAY_NAME,
  category: 'automotive',
  parser: psi5Parser,
  decodeOptions: DECODE_OPTIONS,
  documentation: {
    summary: 'protocol.psi5.documentation.summary',
    layer: 'data-link',
  },
  exampleFrames: EXAMPLE_FRAMES,
};
