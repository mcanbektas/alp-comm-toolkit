/**
 * PPM (Pulse Position Modulation) — birden fazla RC kanalının TEK bir nabız
 * treninde, zaman-alanında kodlandığı legacy RC kontrol sinyali. Faz 10,
 * dalga 15e (`brief-faz10-dalga15e.md`); `rc-control-links` ailesinin
 * SON iki kaydından biri (diğeri `../pwmServo/pwmServo.ts`).
 *
 * ── GİRDİ NEDEN NABIZDIR, KONTEYNER NEREDEN GELİR ───────────────────────────
 * PPM bir bayt akışı DEĞİLDİR: alıcı donanımı senkron boşluk (sync gap) ile
 * ayrılmış bir dizi nabız üretir, her nabzın SÜRESİ bir kanal değeridir. Bu
 * depronun `parse(Uint8Array)` sözleşmesine uyabilmesi için nabızlar
 * `@/protocol-core/decoding/pulseLog` KONTEYNERİNE yakalanır — sözleşmenin
 * TAMAMI o dosyanın başında yazılıdır (`:44-71`), BURADA TEKRAR EDİLMEZ.
 * Özet: nabız başına 2 bayt `Uint16LE`, birim 0.1 µs, üst sınır 6553.5 µs
 * (`MAX_PULSE_DURATION_US`), girdi uzunluğu ÇİFT olmalı (`truncated-frame`),
 * değer `0` REZERVE ("ölçülemedi"), nabızlar KESİN SIRAYLA ardışık. Konteyner
 * `sae-j1850-pwm`/`sae-j1850-vpw` (14f) ve `sent`/`spc` (14g) ile PAYLAŞILIR;
 * bu dosya `pulseLog.ts`i OLDUĞU GİBİ tüketir, DEĞİŞTİRMEZ.
 *
 * Konteyner bir YAKALAMA BİÇİMİDİR, PPM'in kendi tel biçimi DEĞİLDİR
 * (`pulseLog.ts:56-61`) — PPM aslında elektriksel bir darbe treni tanımlar,
 * "spec'ten geliyormuş" gibi SUNULMAZ. Katalog ve spec bunu zaten söylüyor:
 * `layer: 'physical'` (`aerospace-uav.ts:316`), summary *"decoded from capture
 * edges rather than from bytes"* (`:315`), spec `:254`: *"Pulse capture
 * edge'lerinden (…) channel süreleri hesaplanır."*
 *
 * ── `j1850Pulse.ts`ten HİÇBİR ŞEY import EDİLMEZ ────────────────────────────
 * Üç yardımcı da BİLEREK KULLANILMAZ (brif "GÖMÜLMEYECEKLER" + ana brif "✅
 * pulseLog" bölümü):
 *   - `isShortPulse` — J1850'nin İKİLİ kısa/uzun ayrımı içindir. PPM'in kanal
 *     süresi 1000-2000 µs arası SÜREKLİ bir değerdir, ikili değil.
 *   - `deriveAlternatingLevels`/`PulseLevel` — yalnız VPW'nin aktif/pasif hat
 *     modeli. PPM tek yönlü bir darbe trenidir, alterne "seviye" kavramı yok.
 *   - `packBitsToBytes`/`unpackBytesToBits` — CRC için bit→bayt paketleme.
 *     PPM'de CRC YOK, bit akışı YOK.
 * `isWithinPulseBand` SERBESTTİR — `pulseLog.ts`in kendisinde tanımlı.
 *
 * ── `../pwmServo/pwmServo.ts` ile ORTAK modül YOK [Karar 15e-1] ─────────────
 * Katalog PPM/PWM Servo'yu ayrı kayıt tutuyor, gerekçesini yazmış
 * (`aerospace-uav.ts:309-311`): topoloji farklı — PPM tek hatta çok kanal,
 * PWM servo kanal başına ayrı hat. Nabız OKUMA aynı ama YORUM farklı: PPM'de
 * nabızlar kanal+senkron-boşluk dizisi, PWM servo'da HIGH/LOW çiftidir. Bu
 * yüzden iki dosya arasında import YOK, ortak tek şey `pulseLog.ts` —
 * `pulseLog.ts:11-12`nin (12b'nin LLDP/DHCP TLV dersi: "yürüyücü LLDP'ye özel
 * yazıldı, paylaşılan modül AÇILMADI") birebir tekrarı. Konteynerin üstüne
 * ikinci bir ortak katman koymak, iki yorumun ayrıştığı her yerde sessiz
 * yanlış çözüm üretirdi.
 *
 * ── GÖMÜLMEYECEKLER — spec bunu ÜÇ yerde yasaklıyor ─────────────────────────
 * Spec `:254`: *"Tek bir evrensel pulse-width mapping varsayılmamalı;
 * kullanıcı Channel Count, Frame Period, Minimum/Center/Maximum Pulse, Sync
 * Gap, Polarity tanımlamalıdır."* Spec `:263`: 1000/1500/2000 µs kalibrasyonu
 * için *"Bu preset örneğidir, protokol standardı olarak hard-code
 * edilmemelidir."* Katalog `:330-331`: *"Evrensel bir pulse-width eşlemesi
 * YOKTUR."* **1000/1500/2000 µs, 20 ms, 50 Hz bu dosyaya KODLANMAZ** — hepsi
 * `decodeOptions`tan gelir, aşağıdaki `DECODE_OPTIONS`ta YALNIZ `polarity`nin
 * gerçek bir varsayılanı var, geri kalanı KASITLI olarak sıfır/`unspecified`
 * SENTİNEL'dir (aşağıdaki "sentinel" notuna bak). Not: `MICROSECONDS_PER_
 * SECOND`/yüzde çarpanı gibi BİRİM DÖNÜŞÜM sabitleri bu yasağın DIŞINDADIR —
 * onlar protokol kalibrasyonu değil, evrensel SI birim aritmetiğidir
 * (`pwmServo.ts`te kullanılır, bu dosyada değil).
 *
 * ── decodeOptions sentinel'i: sayısal alanlarda `0` = "VERİLMEDİ" ──────────
 * `DecodeOption.defaultValue` ZORUNLU bir alandır (`types.ts:280`) ve
 * `DecodePanel.tsx:362`nin ÖZETİ gereği panel HER ZAMAN bir sayı değeri
 * gönderir — "seçenek hiç verilmedi" durumu panel katmanında TEMSİL
 * EDİLEMEZ. `psi5.ts`in `messagingBits`/`frameControlBits`/`statusBits`/
 * `regionBBits` alanlarıyla AYNI çözüm: `0` gerçek bir süre OLAMAYACAĞI için
 * (`pulseLog.ts`in kendi REZERVE kuralıyla da tutarlı — `0` zaten "ölçülemedi"
 * anlamına gelir) sentinel olarak kullanılır. `pulseEncoding` seçim alanı için
 * AYNI disiplinin `'select'` karşılığı `psi5.ts`in `applicationProfile`
 * kararı: `defaultValue: 'unspecified'`, üçüncü bir şık olarak eklenir.
 *
 * ── `canParse` NEDEN kalibrasyonsuz DAİMA `false` DÖNER ─────────────────────
 * `ProtocolParser.canParse(data: Uint8Array): boolean` (`types.ts:182`)
 * yalnız BAYTLARI alır — `decodeOptions` auto-detection sırasında canParse'a
 * HİÇ ULAŞMAZ (kanal yalnız `parse(bytes, {options})`e akar,
 * `DecodePanel.tsx:398`). Yani "kalibrasyon verilirse farklı davranır" diye
 * bir kod yolu MÜMKÜN DEĞİL: canParse'ın gördüğü tek şey ham bayt dizisidir.
 *
 * Ve nabız konteyneri için bu ÖZELLİKLE tehlikelidir (`pulseLog.ts:63-71`,
 * 14f'in ÖLÇÜMÜ): "yalnız ilk nabza bakmak" registry'nin 761 örneğinin
 * %54'ünü yanlış pozitif kabul ediyordu. J1850'nin bari BİLİNEN kısa/uzun
 * bantları vardı (PWM 8/16 µs, VPW 64/128 µs); **PPM'in evrensel TEK bir
 * bandı YOKTUR** — yukarıdaki "GÖMÜLMEYECEKLER" bunu üç kaynaktan yasaklıyor.
 * Kalibrasızken hangi aralığın "makul" olduğuna dair TEK doğru cevap yok;
 * uydurmak `uavcan-compatibility`nin (15b) reddettiği türden bir varsayım
 * olurdu. Bu yüzden `canParse` **DAİMA `false`** döner — `uavcanCompatibility
 * .ts`in *"canParse DAİMA false — BU BİR EKSİKLİK DEĞİL, KARARDIR"* kararıyla
 * AYNI SINIF: PPM/PWM Servo otomatik algılamaya HİÇ girmez, kullanıcı sayfayı
 * AÇIKÇA seçer ve kalibrasyonunu kendisi verir.
 *
 * Kalibrasyonlu bir `canParse` KAVRAMSAL OLARAK ne ararmış (belgeleme amaçlı,
 * KOŞMAZ çünkü yukarıdaki gerekçeyle hiçbir zaman veri alamaz): (1) uzunluk
 * çift ve ≥ 4 bayt, (2) her nabız `isWithinPulseBand` ile verilen min/max
 * aralığında, (3) en az bir nabız sync-gap bandında. Bu üç madde
 * `rcPulseCanParseRegistry.test.ts`in "en zayıf halka" bölümünde ELLE
 * kurgulanan girdilerle SINANIR — kalıbın kendisi hiçbir zaman gerçek
 * `canParse`e ulaşamayacağı için sonuç HER ZAMAN `false` çıkar; test bunu
 * varsaymaz, ÖLÇER.
 *
 * ── 6553.5 µs (`MAX_PULSE_DURATION_US`) — KENAR DURUM DEĞİL, TİPİK VAKA ─────
 * `Uint16LE`nin taşıyabildiği en uzun süre 6553.5 µs'dir. PPM'in TİPİK 20 ms
 * çerçeve periyodunda, ortalama 1.5 ms'lik kanallarla, sync gap şu tabloyu
 * verir:
 *
 *   4 kanal -> sync gap 14000 us  TAŞAR
 *   6 kanal -> sync gap 11000 us  TAŞAR
 *   8 kanal -> sync gap  8000 us  TAŞAR   <-- EN YAYGIN KURULUM
 *   9 kanal -> sync gap  6500 us  sığar
 *  12 kanal -> sync gap  2000 us  sığar
 *
 * Yani 20 ms periyotta konteynere sığması için EN AZ 9 kanal gerekir — PPM'in
 * en yaygın kurulumu (8 kanal) TAŞAR. Bu bir kenar durum DEĞİL, TİPİK
 * VAKADIR. Kısıt bir SPEC boşluğu değil, YAKALAMA BİÇİMİNİN kendi sınırıdır
 * (`pulseLog.ts:56-61` zaten bunu söylüyor); parser konteynerin ifade
 * edebildiği HER ŞEYİ çözer.
 *
 * ÇÖZÜM (ana thread kararı): tam `MAX_PULSE_DURATION_US`e (register `0xffff`)
 * eşit bir nabız DOYGUN OLABİLİR — konteyner "6553.5 µs ölçüldü" ile
 * "6553.5+ µs'ye kırpıldı"yı AYIRT EDEMEZ. Böyle bir nabız
 * `pulseMayBeSaturated` uyarısı taşır, süresi KESİN değer değil ALT SINIR
 * olarak ("≥ 6553.5") sunulur, ve — kritik olan — sync-gap ADAYLIĞINDA
 * `durationUs >= syncGapUs` testine bir de "VEYA register doygun" şıkkı
 * EKLENİR (`isSyncGapCandidate` aşağıda). Böylece tipik 8-kanallı bir
 * yakalama (sync gap gerçekte 8000 µs, konteynerde 6553.5'e kırpılmış) yine
 * de senkron olarak TANINIR — sessizce çöpe gitmez. Gerçek süre HİÇBİR ZAMAN
 * tahmin EDİLMEZ; yalnız "≥ 6553.5" denir. Aynı kısıt `frame-period`
 * alanına da (toplamın bir bileşeni doygunsa toplam da alt sınırdır) ve
 * `../pwmServo/pwmServo.ts`teki LOW nabzına da (ORADA DAHA da tipik — 20 ms
 * periyotta 1.5 ms'lik HIGH'ın LOW'u ~18.5 ms, HER ZAMAN taşar) uygulanır.
 *
 * ── Çerçeveler arası olanlar PARSER'A GİRMEZ (`mavlink.ts`in SEQ-LOSS kararı) ─
 * `Signal Timeout` (spec `:266`) ve çerçeveler-arası jitter (spec `:284`,
 * ÇOK çerçeveli analyzer işi) BU DOSYADA YOK. Tek çağrıdaki TEK çerçeve
 * içinde tespit edilebilenler (Missing Sync, Too Many/Few Channels, Pulse
 * Out Of Range) BASILIR; RC Failsafe state machine (spec `:409`) parser'a
 * hiç girmez.
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
import {
  MAX_PULSE_DURATION_US,
  decodePulseLog,
  encodePulseLog,
  isWithinPulseBand,
  pulseByteSpan,
} from '@/protocol-core/decoding/pulseLog';
import type { DecodedPulse } from '@/protocol-core/decoding/pulseLog';

const PROTOCOL_ID = 'ppm';
/** Protokol adı veridir, çeviriye girmez (CLAUDE.md). */
const PROTOCOL_DISPLAY_NAME = 'PPM';

/** Konteynerin ham kayıt sınırı — doygunluk testi BUNUNLA yapılır (float karşılaştırması DEĞİL, tamsayı). */
const SATURATED_REGISTER = 0xffff;

const OPTION_SYNC_GAP_US = 'syncGapUs';
const OPTION_CHANNEL_COUNT = 'channelCount';
const OPTION_POLARITY = 'polarity';
const OPTION_PULSE_ENCODING = 'pulseEncoding';
const OPTION_MIN_PULSE_US = 'minPulseUs';
const OPTION_CENTER_PULSE_US = 'centerPulseUs';
const OPTION_MAX_PULSE_US = 'maxPulseUs';

const POLARITY_ACTIVE_HIGH = 'active-high';
const POLARITY_ACTIVE_LOW = 'active-low';

const PULSE_ENCODING_UNSPECIFIED = 'unspecified';
const PULSE_ENCODING_PULSE_WIDTH = 'pulse-width';
const PULSE_ENCODING_PULSE_TO_PULSE = 'pulse-to-pulse';

/**
 * `pulseEncoding`in İKİ şıkkı da AYNI hesabı üretir — dürüstçe belgelenen bir
 * denklik, KAÇIRILMIŞ bir dallanma DEĞİL. Spec `:254` iki yorumu da adlı adlı
 * anıyor (*"…veya implementasyona göre pulse-to-pulse interval"*) ve
 * kullanıcının BUNU TANIMLAMASINI istiyor; ama bu depronun konteyneri
 * (`pulseLog.ts`) ÖNCEDEN HESAPLANMIŞ bir süre dizisi taşır — ham seviye
 * geçişleri değil, elektriksel kutupluluk (polarity) bilgisi de YOK. Spec'in
 * KENDİ çalışılmış örneği (0/1502/3001 µs kenarları → CH1=1502, CH2=1499) bu
 * konteynerde "her nabız = bir kanal süresi, sırayla" okumasının aynısıdır;
 * bu iki isim arasındaki fark FİZİKSEL yakalama yönteminde yaşar (kenar
 * zaman damgalarının mı, yoksa doğrudan darbe genişliklerinin mi
 * kaydedildiği), konteyner bu ayrımı ZATEN kaybetmiştir. Seçenek yine de
 * AÇIK tutulur (spec'in "tanımlamalıdır" isteği + dürüstlük: sessizce TEK bir
 * yorumu varsaymak yerine, ikisinin BU SOYUTLAMA SEVİYESİNDE ayrışmadığını
 * SÖYLEMEK) — `tahmin etmek` burada "farklı davranıyormuş gibi yapıp aslında
 * rastgele birini seçmek" olurdu; bu dosya bunun yerine denkliği YAZIYOR.
 * Aynı gerekçeyle `polarity` de saf bilgi alanıdır (aşağıya bak).
 */

const DECODE_OPTIONS: readonly DecodeOption[] = [
  {
    id: OPTION_SYNC_GAP_US,
    label: 'protocol.ppm.option.syncGapUs',
    kind: 'number',
    // 0 = VERİLMEDİ sentinel'i (dosya başı). Gerçek bir sync gap asla 0 µs olamaz.
    defaultValue: 0,
    min: 0,
    // Üst sınır BİLEREK YOK: bu bir GERÇEK DÜNYA sync-gap beklentisidir (ör.
    // 8000 µs, tipik 8 kanal/20 ms kurulumu) ve tam da bu yüzden konteynerin
    // TEK bir nabız register'ının sınırını (6553.5 µs) SIK SIK AŞAR — dosya
    // başı, "6553.5 µs KENAR DURUM DEĞİL, TİPİK VAKA". `max: MAX_PULSE_
    // DURATION_US` konsaydı panel 8000 girildiğinde SESSİZCE 0'a (VERİLMEDİ)
    // düşürürdü (`DecodePanel.tsx` `resolveDecodeOptions`) — doygunluk
    // kurtarma mekanizmasının TAM ÖNLEMEYE çalıştığı sessiz kayıp bu olurdu
    // (e2e turunda ÖLÇÜLDÜ, bkz. `../../../../e2e/ppm-decode.spec.ts`).
    description: 'protocol.ppm.option.syncGapUs.description',
  },
  {
    id: OPTION_CHANNEL_COUNT,
    label: 'protocol.ppm.option.channelCount',
    kind: 'number',
    // 0 = kısıtlama YOK (opsiyonel doğrulama). Üst sınır bilerek YOK: spec
    // hiçbir kanal sayısı üst sınırı vermiyor, bir tane UYDURMAK bu dosyanın
    // "GÖMÜLMEYECEKLER" disiplinini ihlal ederdi.
    defaultValue: 0,
    min: 0,
    description: 'protocol.ppm.option.channelCount.description',
  },
  {
    id: OPTION_POLARITY,
    label: 'protocol.ppm.option.polarity',
    kind: 'select',
    defaultValue: POLARITY_ACTIVE_HIGH,
    description: 'protocol.ppm.option.polarity.description',
    choices: [
      { value: POLARITY_ACTIVE_HIGH, label: 'protocol.ppm.option.polarity.activeHigh' },
      { value: POLARITY_ACTIVE_LOW, label: 'protocol.ppm.option.polarity.activeLow' },
    ],
  },
  {
    id: OPTION_PULSE_ENCODING,
    label: 'protocol.ppm.option.pulseEncoding',
    kind: 'select',
    defaultValue: PULSE_ENCODING_UNSPECIFIED,
    description: 'protocol.ppm.option.pulseEncoding.description',
    choices: [
      { value: PULSE_ENCODING_UNSPECIFIED, label: 'protocol.ppm.option.pulseEncoding.unspecified' },
      { value: PULSE_ENCODING_PULSE_WIDTH, label: 'protocol.ppm.option.pulseEncoding.pulseWidth' },
      { value: PULSE_ENCODING_PULSE_TO_PULSE, label: 'protocol.ppm.option.pulseEncoding.pulseToPulse' },
    ],
  },
  {
    id: OPTION_MIN_PULSE_US,
    label: 'protocol.ppm.option.minPulseUs',
    kind: 'number',
    defaultValue: 0,
    min: 0,
    max: MAX_PULSE_DURATION_US,
    description: 'protocol.ppm.option.minPulseUs.description',
  },
  {
    id: OPTION_CENTER_PULSE_US,
    label: 'protocol.ppm.option.centerPulseUs',
    kind: 'number',
    defaultValue: 0,
    min: 0,
    max: MAX_PULSE_DURATION_US,
    description: 'protocol.ppm.option.centerPulseUs.description',
  },
  {
    id: OPTION_MAX_PULSE_US,
    label: 'protocol.ppm.option.maxPulseUs',
    kind: 'number',
    defaultValue: 0,
    min: 0,
    max: MAX_PULSE_DURATION_US,
    description: 'protocol.ppm.option.maxPulseUs.description',
  },
];

const ERROR_EMPTY = 'protocol.ppm.error.empty';
const ERROR_ODD_LENGTH = 'protocol.ppm.error.oddLength';
const ERROR_MISSING_SYNC = 'protocol.ppm.error.missingSync';
const ERROR_ABORTED = 'protocol.ppm.error.aborted';
const ERROR_FRAME_TOO_LONG = 'protocol.ppm.error.frameTooLong';

const WARN_SYNC_GAP_REQUIRED = 'protocol.ppm.warning.syncGapRequiredForChannelSplit';
const WARN_PULSE_ENCODING_UNSPECIFIED = 'protocol.ppm.warning.pulseEncodingUnspecified';
const WARN_PULSE_RESERVED = 'protocol.ppm.warning.pulseReserved';
const WARN_PULSE_MAY_BE_SATURATED = 'protocol.ppm.warning.pulseMayBeSaturated';
const WARN_PULSE_OUT_OF_RANGE = 'protocol.ppm.warning.pulseOutOfRange';
const WARN_TOO_MANY_CHANNELS = 'protocol.ppm.warning.tooManyChannels';
const WARN_TOO_FEW_CHANNELS = 'protocol.ppm.warning.tooFewChannels';
const WARN_TRAILING_PULSES_IGNORED = 'protocol.ppm.warning.trailingPulsesIgnored';
const WARN_CALIBRATION_INVALID = 'protocol.ppm.warning.calibrationInvalid';
const WARN_FRAME_PERIOD_UNCERTAIN = 'protocol.ppm.warning.framePeriodUncertain';

function toProtocolWarning(code: string): ProtocolWarning {
  return { code, message: code };
}

/** `rawRegister === 0xffff` — konteynerin taşıyabildiği en uzun kayıt (dosya başı, "6553.5 µs"). */
function isSaturated(pulse: DecodedPulse): boolean {
  return pulse.rawRegister === SATURATED_REGISTER;
}

/**
 * Sync-gap ADAYLIĞI: `durationUs >= syncGapUs` YA DA register DOYGUN (dosya
 * başı ÇÖZÜM notu). Rezerve nabız asla aday değildir — "ölçülemedi" bir süre
 * karşılaştırmasına giremez.
 */
function isSyncGapCandidate(pulse: DecodedPulse, syncGapUs: number): boolean {
  if (pulse.reserved) return false;
  return isSaturated(pulse) || pulse.durationUs >= syncGapUs;
}

/** Doygun bir nabzın süresi KESİN değer değil ALT SINIRDIR — "≥ 6553.5" olarak sunulur. */
function formatPulseDurationUs(pulse: DecodedPulse): string {
  return isSaturated(pulse) ? `≥ ${MAX_PULSE_DURATION_US.toFixed(1)}` : pulse.durationUs.toFixed(1);
}

interface PpmCalibration {
  /** 0 = VERİLMEDİ. */
  readonly syncGapUs: number;
  readonly hasSyncGap: boolean;
  /** 0 = kısıtlama YOK. */
  readonly channelCount: number;
  readonly hasChannelCount: boolean;
  readonly polarity: typeof POLARITY_ACTIVE_HIGH | typeof POLARITY_ACTIVE_LOW;
  readonly pulseEncoding:
    | typeof PULSE_ENCODING_UNSPECIFIED
    | typeof PULSE_ENCODING_PULSE_WIDTH
    | typeof PULSE_ENCODING_PULSE_TO_PULSE;
  readonly minPulseUs: number;
  readonly centerPulseUs: number;
  readonly maxPulseUs: number;
  /** Üçü de verildi VE min < center < max sıralaması geçerli. */
  readonly hasValidNormalization: boolean;
  /** Üçü de verildi ama sıralama BOZUK (`min >= center` veya `center >= max`). */
  readonly hasInvalidNormalization: boolean;
}

function readPositiveNumberOption(options: Record<string, unknown> | undefined, id: string): number {
  const raw = options?.[id];
  // `0` ve altı SENTİNEL'dir — "verilmedi" (dosya başı). Gerçek bir süre/sayı hiçbir zaman ≤ 0 olamaz.
  return typeof raw === 'number' && Number.isFinite(raw) && raw > 0 ? raw : 0;
}

function resolveCalibration(options: Record<string, unknown> | undefined): PpmCalibration {
  const polarityRaw = options?.[OPTION_POLARITY];
  const pulseEncodingRaw = options?.[OPTION_PULSE_ENCODING];
  const syncGapUs = readPositiveNumberOption(options, OPTION_SYNC_GAP_US);
  const channelCount = readPositiveNumberOption(options, OPTION_CHANNEL_COUNT);
  const minPulseUs = readPositiveNumberOption(options, OPTION_MIN_PULSE_US);
  const centerPulseUs = readPositiveNumberOption(options, OPTION_CENTER_PULSE_US);
  const maxPulseUs = readPositiveNumberOption(options, OPTION_MAX_PULSE_US);

  const allThreeGiven = minPulseUs > 0 && centerPulseUs > 0 && maxPulseUs > 0;
  const orderingValid = minPulseUs < centerPulseUs && centerPulseUs < maxPulseUs;

  let pulseEncoding: PpmCalibration['pulseEncoding'] = PULSE_ENCODING_UNSPECIFIED;
  if (pulseEncodingRaw === PULSE_ENCODING_PULSE_WIDTH) pulseEncoding = PULSE_ENCODING_PULSE_WIDTH;
  else if (pulseEncodingRaw === PULSE_ENCODING_PULSE_TO_PULSE) pulseEncoding = PULSE_ENCODING_PULSE_TO_PULSE;

  return {
    syncGapUs,
    hasSyncGap: syncGapUs > 0,
    channelCount,
    hasChannelCount: channelCount > 0,
    polarity: polarityRaw === POLARITY_ACTIVE_LOW ? POLARITY_ACTIVE_LOW : POLARITY_ACTIVE_HIGH,
    pulseEncoding,
    minPulseUs,
    centerPulseUs,
    maxPulseUs,
    hasValidNormalization: allThreeGiven && orderingValid,
    hasInvalidNormalization: allThreeGiven && !orderingValid,
  };
}

interface PpmParseOptions {
  timestamp?: number;
  direction?: FrameDirection;
  channel?: string;
  maxFrameLength?: number;
  signal?: AbortSignal;
  options?: Record<string, unknown>;
}

function resolveParseOptions(context: ParseContext | undefined): PpmParseOptions {
  return {
    ...(context?.timestamp === undefined ? {} : { timestamp: context.timestamp }),
    ...(context?.direction === undefined ? {} : { direction: context.direction }),
    ...(context?.channel === undefined ? {} : { channel: context.channel }),
    ...(context?.maxFrameLength === undefined ? {} : { maxFrameLength: context.maxFrameLength }),
    ...(context?.signal === undefined ? {} : { signal: context.signal }),
    ...(context?.options === undefined ? {} : { options: context.options }),
  };
}

/** Bilgi satırı — bayt tüketmez (`profile`, j1850Pwm.ts'in ilk-satır deseni). */
function infoField(id: string, name: string, physicalValue: string, warnings: readonly string[]): ParsedField {
  return {
    id,
    name,
    offset: 0,
    length: 0,
    rawBytes: new Uint8Array(),
    physicalValue,
    valid: true,
    warnings: [...warnings],
  };
}

function rawPulseField(data: Uint8Array, index: number, pulse: DecodedPulse): ParsedField {
  const span = pulseByteSpan(index, 1);
  const base = {
    id: `pulse-${String(index)}`,
    name: `Pulse ${String(index + 1)}`,
    offset: span.offset,
    length: span.length,
    rawBytes: data.slice(span.offset, span.offset + span.length),
  };
  if (pulse.reserved) {
    return { ...base, valid: false, warnings: [WARN_PULSE_RESERVED] };
  }
  const saturated = isSaturated(pulse);
  return {
    ...base,
    rawValue: pulse.rawRegister,
    physicalValue: formatPulseDurationUs(pulse),
    unit: 'µs',
    valid: true,
    warnings: saturated ? [WARN_PULSE_MAY_BE_SATURATED] : [],
  };
}

function channelField(
  data: Uint8Array,
  index: number,
  pulse: DecodedPulse,
  calibration: PpmCalibration,
): ParsedField {
  const span = pulseByteSpan(index, 1);
  const base = {
    id: `ch-${String(index + 1)}`,
    name: `CH${String(index + 1)} · Pulse`,
    offset: span.offset,
    length: span.length,
    rawBytes: data.slice(span.offset, span.offset + span.length),
  };
  if (pulse.reserved) {
    return { ...base, valid: false, warnings: [WARN_PULSE_RESERVED] };
  }
  const saturated = isSaturated(pulse);
  const warnings: string[] = [];
  if (saturated) warnings.push(WARN_PULSE_MAY_BE_SATURATED);
  // `isWithinPulseBand` (`pulseLog.ts`) — rezerve kontrolü zaten yukarıdaki
  // erken dönüşle elendi, burada yalnız [min,max] aralığı sınanıyor.
  if (calibration.hasValidNormalization && !isWithinPulseBand(pulse, calibration.minPulseUs, calibration.maxPulseUs)) {
    warnings.push(WARN_PULSE_OUT_OF_RANGE);
  }
  return {
    ...base,
    rawValue: pulse.rawRegister,
    physicalValue: formatPulseDurationUs(pulse),
    unit: 'µs',
    valid: true,
    warnings,
  };
}

/**
 * Normalize alan — spec `:256/:263` formülü, YALNIZ üç kalibrasyon değeri de
 * verildiğinde ve doygun OLMAYAN bir nabız için üretilir (doygun nabzın GERÇEK
 * süresi bilinmediği için normalize kesri de bilinemez — dosya başı).
 * Birimsizdir: `unit` BİLEREK YOK (`types.ts:46`, yalnız gerçek fiziksel
 * değere birim verilir).
 */
function normalizedChannelField(
  data: Uint8Array,
  index: number,
  pulse: DecodedPulse,
  calibration: PpmCalibration,
): ParsedField | undefined {
  if (pulse.reserved || isSaturated(pulse) || !calibration.hasValidNormalization) return undefined;
  const span = pulseByteSpan(index, 1);
  const denominator =
    pulse.durationUs >= calibration.centerPulseUs
      ? calibration.maxPulseUs - calibration.centerPulseUs
      : calibration.centerPulseUs - calibration.minPulseUs;
  const normalized = (pulse.durationUs - calibration.centerPulseUs) / denominator;
  return {
    id: `ch-${String(index + 1)}-normalized`,
    name: `CH${String(index + 1)} · Normalized`,
    offset: span.offset,
    length: span.length,
    rawBytes: data.slice(span.offset, span.offset + span.length),
    physicalValue: normalized.toFixed(3),
    valid: true,
    warnings: [],
  };
}

function syncGapField(data: Uint8Array, index: number, pulse: DecodedPulse): ParsedField {
  const span = pulseByteSpan(index, 1);
  const saturated = isSaturated(pulse);
  return {
    id: 'sync-gap',
    name: 'Sync Gap',
    offset: span.offset,
    length: span.length,
    rawBytes: data.slice(span.offset, span.offset + span.length),
    rawValue: pulse.rawRegister,
    physicalValue: formatPulseDurationUs(pulse),
    unit: 'µs',
    valid: true,
    warnings: saturated ? [WARN_PULSE_MAY_BE_SATURATED] : [],
  };
}

/** Çerçeve periyodu — kanal nabızları + sync gap TOPLAMI (bilgi amaçlı; PPM'de beklenen periyot verilmez, doğrulanmaz). */
function framePeriodField(
  data: Uint8Array,
  channelPulses: readonly DecodedPulse[],
  syncPulse: DecodedPulse,
): ParsedField {
  const span = pulseByteSpan(0, channelPulses.length + 1);
  const allPulses = [...channelPulses, syncPulse];
  const anySaturated = allPulses.some((pulse) => isSaturated(pulse));
  const anyReserved = allPulses.some((pulse) => pulse.reserved);
  const sumUs = allPulses.reduce((total, pulse) => total + (pulse.reserved ? 0 : pulse.durationUs), 0);
  const warnings: string[] = [];
  if (anySaturated) warnings.push(WARN_PULSE_MAY_BE_SATURATED);
  if (anyReserved) warnings.push(WARN_FRAME_PERIOD_UNCERTAIN);
  return {
    id: 'frame-period',
    name: 'Frame Period',
    offset: span.offset,
    length: span.length,
    rawBytes: data.slice(span.offset, span.offset + span.length),
    physicalValue: `${anySaturated ? '≥ ' : ''}${sumUs.toFixed(1)}`,
    unit: 'µs',
    valid: true,
    warnings,
  };
}

function parsePpmFrame(data: Uint8Array, options: PpmParseOptions): ParseResult {
  if (options.signal?.aborted === true) {
    return {
      success: false,
      error: { code: 'parser-timeout', message: ERROR_ABORTED },
      consumedBytes: 0,
      recoverable: false,
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

  const decoded = decodePulseLog(data);
  if (!decoded.ok) {
    return {
      success: false,
      error:
        decoded.failure.kind === 'empty'
          ? { code: 'truncated-frame', message: ERROR_EMPTY, offset: 0, length: 0 }
          : {
              code: 'truncated-frame',
              message: ERROR_ODD_LENGTH,
              offset: 0,
              length: decoded.failure.length,
              details: { length: decoded.failure.length },
            },
      consumedBytes: 0,
      recoverable: true,
    };
  }

  const pulses = decoded.result.pulses;
  const calibration = resolveCalibration(options.options);

  const fields: ParsedField[] = [];
  const warnings: ProtocolWarning[] = [];
  const errors: ProtocolError[] = [];

  // ── İki bilgi satırı: kullanıcının BEYAN ETTİĞİ kural (spec ikisini de istiyor, dosya başı) ──
  fields.push(
    infoField(
      'polarity',
      'Polarity',
      calibration.polarity === POLARITY_ACTIVE_LOW ? 'Active-low' : 'Active-high',
      [],
    ),
  );
  const pulseEncodingLabel =
    calibration.pulseEncoding === PULSE_ENCODING_PULSE_WIDTH
      ? 'Pulse-width'
      : calibration.pulseEncoding === PULSE_ENCODING_PULSE_TO_PULSE
        ? 'Pulse-to-pulse'
        : 'Not specified';
  fields.push(
    infoField(
      'pulse-encoding',
      'Pulse Encoding',
      pulseEncodingLabel,
      calibration.pulseEncoding === PULSE_ENCODING_UNSPECIFIED ? [WARN_PULSE_ENCODING_UNSPECIFIED] : [],
    ),
  );

  if (calibration.hasInvalidNormalization) {
    warnings.push(toProtocolWarning(WARN_CALIBRATION_INVALID));
  }

  if (!calibration.hasSyncGap) {
    // `syncGapUs` VERİLMEDİ: nabızlar sırayla HAM listelenir, kanal ayrımı
    // YAPILMAZ (brif "decodeOptions" bölümü). Kayıt yine `ready`dir.
    pulses.forEach((pulse, index) => fields.push(rawPulseField(data, index, pulse)));
    warnings.push(toProtocolWarning(WARN_SYNC_GAP_REQUIRED));
    if (pulses.some((pulse) => isSaturated(pulse))) {
      warnings.push(toProtocolWarning(WARN_PULSE_MAY_BE_SATURATED));
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

  const syncIndex = pulses.findIndex((pulse) => isSyncGapCandidate(pulse, calibration.syncGapUs));

  if (syncIndex === -1) {
    // Missing Sync (spec `:266`) — tek çerçeve içinde tespit edilebilir bir
    // hata. Kanallar AYRILAMAZ ama nabızlar yine de HAM gösterilir
    // ("hatalı veride uygulamayı çökertme", spec §47).
    pulses.forEach((pulse, index) => fields.push(rawPulseField(data, index, pulse)));
    if (pulses.some((pulse) => isSaturated(pulse))) {
      warnings.push(toProtocolWarning(WARN_PULSE_MAY_BE_SATURATED));
    }
    errors.push({
      code: 'start-delimiter-not-found',
      message: ERROR_MISSING_SYNC,
      offset: 0,
      length: data.length,
      details: { syncGapUs: calibration.syncGapUs, pulseCount: pulses.length },
    });

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

  const channelPulses = pulses.slice(0, syncIndex);
  const syncPulse = pulses[syncIndex];
  if (syncPulse === undefined) {
    // findIndex zaten geçerli bir index döndürdü; TypeScript daralması için savunma.
    throw new Error('unreachable: syncIndex bulundu ama syncPulse undefined');
  }

  if (calibration.hasChannelCount) {
    if (channelPulses.length > calibration.channelCount) warnings.push(toProtocolWarning(WARN_TOO_MANY_CHANNELS));
    if (channelPulses.length < calibration.channelCount) warnings.push(toProtocolWarning(WARN_TOO_FEW_CHANNELS));
  }

  let hasReservedChannelPulse = false;
  let hasOutOfRangePulse = false;
  channelPulses.forEach((pulse, index) => {
    fields.push(channelField(data, index, pulse, calibration));
    if (pulse.reserved) hasReservedChannelPulse = true;
    if (
      calibration.hasValidNormalization &&
      !pulse.reserved &&
      !isWithinPulseBand(pulse, calibration.minPulseUs, calibration.maxPulseUs)
    ) {
      hasOutOfRangePulse = true;
    }
    const normalized = normalizedChannelField(data, index, pulse, calibration);
    if (normalized !== undefined) fields.push(normalized);
  });
  if (hasReservedChannelPulse) warnings.push(toProtocolWarning(WARN_PULSE_RESERVED));
  if (hasOutOfRangePulse) warnings.push(toProtocolWarning(WARN_PULSE_OUT_OF_RANGE));

  fields.push(syncGapField(data, syncIndex, syncPulse));
  fields.push(framePeriodField(data, channelPulses, syncPulse));

  // TEK push per uyarı TİPİ (j1850Pwm.ts'in `hasReservedDataPulse` deseni) — kanal
  // nabızlarından biri VEYA sync gap doygunsa bile `WARN_PULSE_MAY_BE_SATURATED`
  // frame düzeyinde yalnız BİR KEZ görünür (alan düzeyindeki uyarılar zaten her
  // doygun alanda AYRI AYRI basılıyor, bkz. `channelField`/`syncGapField`).
  if (channelPulses.some((pulse) => isSaturated(pulse)) || isSaturated(syncPulse)) {
    warnings.push(toProtocolWarning(WARN_PULSE_MAY_BE_SATURATED));
  }

  const trailingPulseCount = pulses.length - (syncIndex + 1);
  if (trailingPulseCount > 0) {
    // Bu çağrı TEK çerçeve çözer (brif kapsamı). Sync gap'ten sonraki
    // nabızlar bir SONRAKİ çerçevenin başlangıcı olabilir — yok sayılır,
    // sessizce DEĞİL (`ibus.ts`/`crsf.ts`in `trailingBytes` uyarısı emsali).
    warnings.push(toProtocolWarning(WARN_TRAILING_PULSES_IGNORED));
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

export function parsePpm(data: Uint8Array, options?: Record<string, unknown>): ParseResult {
  return parsePpmFrame(data, options === undefined ? {} : { options });
}

export const ppmParser: ProtocolParser = {
  protocolId: PROTOCOL_ID,
  displayName: PROTOCOL_DISPLAY_NAME,

  /**
   * **DAİMA `false`.** Dosya başı "canParse NEDEN kalibrasyonsuz DAİMA false
   * DÖNER" bölümü — bu bir eksiklik değil KARARDIR, `uavcanCompatibility.ts`
   * ile AYNI SINIF. Girdi hiç okunmaz: `decodeOptions` bu fonksiyona hiçbir
   * zaman ulaşmaz (`types.ts:182` imzası yalnız `data` alır) ve PPM'in
   * evrensel tek bir bandı YOKTUR (spec üç yerde yasaklıyor), yani
   * kalibrasyonsuz "makul" bir aralık TANIMLANAMAZ. `rcPulseCanParseRegistry
   * .test.ts` bunu registry'nin TÜMÜ + elle kurgulanmış en-zayıf-halka
   * girdileri üzerinde ÖLÇER.
   */
  canParse(): boolean {
    return false;
  },

  parse(data: Uint8Array, context?: ParseContext): ParseResult {
    return parsePpmFrame(data, resolveParseOptions(context));
  },
};

/**
 * Nabız günlüğü kurar, dilenirse belirli indeksleri REZERVE (`0`) yapar.
 * `j1850Pwm.ts`in `buildPwmPulseLog`iyle AYNI rol: `encodePulseLog` süreyi
 * asla 0'a düşürmediği için (REZERVE ile çakışmasın diye asgari 1 dayatır),
 * rezerve durumu doğrudan üretmek isteyen çağıran ilgili nabzın 2 baytını
 * ELLE sıfırlar — `j1850Pwm.test.ts`in aynı tekniği.
 */
function buildPulseLog(durationsUs: readonly number[], reservedIndices: readonly number[] = []): Uint8Array {
  const bytes = encodePulseLog(durationsUs);
  for (const index of reservedIndices) {
    const span = pulseByteSpan(index, 1);
    bytes[span.offset] = 0;
    bytes[span.offset + 1] = 0;
  }
  return bytes;
}

const EXAMPLE_FRAMES: ExampleFrame[] = [
  {
    id: 'two-channel-worked-example',
    name: 'protocol.ppm.example.twoChannelWorkedExample.name',
    // Spec `:254`in KENDİ örneği: kenarlar 0/1502/3001 µs → CH1=1502, CH2=1499.
    // Sync gap 4000 µs (konteyner sınırının İÇİNDE, doygun DEĞİL) — "temiz" yol.
    bytes: buildPulseLog([1502, 1499, 4000]),
    description: 'protocol.ppm.example.twoChannelWorkedExample.description',
    expectedValid: true,
  },
  {
    id: 'typical-eight-channel-capture',
    name: 'protocol.ppm.example.typicalEightChannelCapture.name',
    // 8 kanal (1000..1700 µs) + 20 ms'lik TİPİK bir çerçeve periyodunun
    // gerektirdiği sync gap (9200 µs) — konteynerin 6553.5 µs sınırını AŞAR ve
    // `encodePulseLog` bunu register 0xffff'e KIRPAR (dosya başı, "6553.5 µs
    // TİPİK VAKA" tablosunun somut örneği).
    bytes: buildPulseLog([1000, 1100, 1200, 1300, 1400, 1500, 1600, 1700, 9200]),
    description: 'protocol.ppm.example.typicalEightChannelCapture.description',
    expectedValid: true,
  },
  {
    id: 'missing-sync-candidate',
    name: 'protocol.ppm.example.missingSyncCandidate.name',
    // Dört nabız, hepsi tipik kanal aralığında (1400-1600 µs) — kalibre
    // edilince (syncGapUs örn. 4000) HİÇBİRİ sync gap bandına girmez.
    bytes: buildPulseLog([1500, 1500, 1400, 1600]),
    description: 'protocol.ppm.example.missingSyncCandidate.description',
    expectedValid: true,
  },
  {
    id: 'reserved-mid-frame',
    name: 'protocol.ppm.example.reservedMidFrame.name',
    // CH2 REZERVE (0) — "ölçülemedi", süreye ÇEVRİLMEZ (pulseLog.ts madde 3).
    bytes: buildPulseLog([1500, 1500, 1500, 4000], [1]),
    description: 'protocol.ppm.example.reservedMidFrame.description',
    expectedValid: true,
  },
  {
    id: 'truncated',
    name: 'protocol.ppm.example.truncated.name',
    // Tek uzunluk (3 bayt) — `decodePulseLog`in `odd-length` dalı.
    bytes: new Uint8Array([0x0a, 0x00, 0x05]),
    description: 'protocol.ppm.example.truncated.description',
    expectedValid: false,
  },
];

export const ppmPlugin: ProtocolPlugin = {
  id: PROTOCOL_ID,
  name: PROTOCOL_DISPLAY_NAME,
  category: 'aerospace-uav',
  parser: ppmParser,
  documentation: {
    summary: 'protocol.ppm.documentation.summary',
    layer: 'physical',
  },
  exampleFrames: EXAMPLE_FRAMES,
  decodeOptions: DECODE_OPTIONS,
};
