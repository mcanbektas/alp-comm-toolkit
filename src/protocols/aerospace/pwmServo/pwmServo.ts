/**
 * PWM Servo — geleneksel RC aktüatör kontrolü: HER kanal kendi hattında,
 * pulse-genişliği servo pozisyonunu belirler. Faz 10, dalga 15e
 * (`brief-faz10-dalga15e.md`); `rc-control-links` ailesinin SON iki
 * kaydından biri (diğeri `../ppm/ppm.ts`).
 *
 * ── GİRDİ SÖZLEŞMESİ — `pulseLog.ts`, OLDUĞU GİBİ (`../ppm/ppm.ts` ile AYNI) ─
 * Sözleşmenin TAMAMI `@/protocol-core/decoding/pulseLog` dosya başında
 * (`:44-71`) yazılıdır, BURADA TEKRAR EDİLMEZ: nabız başına 2 bayt
 * `Uint16LE`, birim 0.1 µs, üst sınır 6553.5 µs (`MAX_PULSE_DURATION_US`),
 * girdi uzunluğu ÇİFT (`truncated-frame`), değer `0` REZERVE. Katalog/spec
 * bu girdinin nabız olduğunu zaten söylüyor: `layer: 'physical'`
 * (`aerospace-uav.ts:339`), spec `:270-284`.
 *
 * ── Girdi YORUMU: nabız ÇİFTLERİ (brif "Girdi yorumu" bölümü) ───────────────
 * Bir PWM servo sinyali HIGH süresi + LOW süresi ÇİFTİDİR; periyot ikisinin
 * TOPLAMIDIR. Konteyner nabızları sırayla verdiği için: `pulses[2k]` = HIGH
 * (pulse width), `pulses[2k+1]` = LOW, `period = pulses[2k] + pulses[2k+1]`.
 * Bu bir YORUMDUR ve `initialPulseLevel` decodeOption'ıyla SORULUR —
 * `j1850Pulse.ts`teki `initialLevel`in (VPW'nin `deriveAlternatingLevels`i,
 * KULLANILMAZ ama KARAR AYNI sınıf: "konteynere bit çalınmadan çözülen tek
 * bilinmeyen") karşılığı. `low` seçilirse İLK nabız LOW sayılır, eşleştirme
 * bir kayar: `pulses[0]` önceki (yakalanmamış) çevrimin LOW'u — yalnız
 * kendi başına gösterilir, çevrim EŞLEŞTİRİLMEZ; asıl çevrimler
 * `pulses[2k+1]`=HIGH, `pulses[2k+2]`=LOW olarak devam eder.
 *
 * ── `j1850Pulse.ts`ten HİÇBİR ŞEY import EDİLMEZ (`../ppm/ppm.ts` gerekçesiyle AYNI) ─
 * `isShortPulse` ikili kısa/uzun ayrımı içindir (PWM burada SÜREKLİ bir
 * değer). `deriveAlternatingLevels`/`PulseLevel` VPW'nin hat modeli içindir.
 * `packBitsToBytes`/`unpackBytesToBits` CRC için bit→bayt paketlemedir —
 * PWM servo'da CRC YOK, bit akışı YOK.
 *
 * ── `../ppm/ppm.ts` ile ORTAK modül YOK [Karar 15e-1] ───────────────────────
 * Katalog gerekçesi (`aerospace-uav.ts:309-311`): topoloji farklı — PPM tek
 * hatta çok kanal, PWM servo kanal başına ayrı hat; nabız okuma aynı, YORUM
 * (kanal+senkron-boşluk mu, HIGH/LOW çifti mi) farklı. İki dosya arasında
 * import YOK, ortak tek şey `pulseLog.ts` (`pulseLog.ts:11-12`, 12b'nin
 * LLDP/DHCP TLV dersi). Aşağıdaki doygunluk/format yardımcıları BİLEREK
 * `../ppm/ppm.ts`teki eşdeğerleriyle TEKRARLANMIŞTIR — paylaşılan bir üçüncü
 * modül açmak konteynerin üstüne 14g'nin reddettiği türden bir katman
 * koymak olurdu.
 *
 * ── GÖMÜLMEYECEKLER — spec + katalog İKİ yerde yasaklıyor ───────────────────
 * Katalog `:352-353`: *"20 ms / 50 Hz yalnız bir konfigürasyon örneğidir;
 * digital ve high-speed servolar farklı refresh rate ve pulse aralığı
 * kullanır."* Spec `:281` aynısını söylüyor. **50 Hz, 20 ms, 1000/1500/2000
 * µs bu dosyaya KODLANMAZ** — hepsi `decodeOptions`tan gelir (ya da hiç
 * gelmez: sentinel `0`, aşağı bak). `MICROSECONDS_PER_SECOND` (1.000.000) ve
 * `PERCENT_MULTIPLIER` (100) bu yasağın DIŞINDADIR: bunlar µs→saniye ve
 * oran→yüzde BİRİM DÖNÜŞÜM sabitleridir — evrensel SI aritmetiğidir, "tipik
 * bir PWM servo yapılandırması" DEĞİL. `j1850Pwm.ts`teki `BITS_PER_BYTE = 8`
 * ile AYNI sınıf.
 *
 * ── decodeOptions sentinel'i: `0` = "VERİLMEDİ" (`../ppm/ppm.ts` ile AYNI disiplin) ─
 * `DecodeOption.defaultValue` ZORUNLUDUR (`types.ts:280`) ve panel HER ZAMAN
 * bir sayı gönderir (`DecodePanel.tsx:362`) — "verilmedi" durumu yalnız bir
 * SENTİNEL'le temsil edilebilir. `psi5.ts`in `messagingBits` vb. alanlarıyla
 * AYNI çözüm: `0` gerçek bir süre olamayacağı için (ve `pulseLog.ts`in kendi
 * REZERVE kuralıyla tutarlı olarak) "verilmedi" anlamına gelir.
 *
 * ── `canParse` NEDEN kalibrasyonsuz DAİMA `false` DÖNER ─────────────────────
 * `../ppm/ppm.ts` dosya başındaki gerekçeyle BİREBİR AYNI: `canParse(data:
 * Uint8Array): boolean` (`types.ts:182`) `decodeOptions`a hiçbir zaman
 * ulaşamaz, ve PWM servo'nun evrensel tek bir HIGH/LOW bandı YOKTUR (katalog
 * `:352-353`). `uavcanCompatibility.ts`in *"canParse DAİMA false — BU BİR
 * EKSİKLİK DEĞİL, KARARDIR"* kararıyla AYNI SINIF.
 *
 * ── 6553.5 µs (`MAX_PULSE_DURATION_US`) — `../ppm/ppm.ts`TEN DE TİPİK VAKA ──
 * PPM'in sync gap'i için doğru olan (dosya başı, `ppm.ts`) burada DAHA da
 * belirgindir: TİPİK 20 ms periyot / 1.5 ms HIGH kalibrasyonunda LOW süresi
 * ~18.5 ms'dir — konteynerin 6553.5 µs sınırının NEREDEYSE ÜÇ KATI. Yani
 * herhangi bir GERÇEKÇİ 20 ms/50 Hz yakalamada LOW nabzı HER ZAMAN doygun
 * (`register = 0xffff`) olarak görünür; bu bir kenar durum değil, EN YAYGIN
 * KURULUMUN kendisidir. Sonuç: bu dosyada `Frame Period`/`Frequency`/
 * `Duty Cycle` LOW doygunken register'ın ALT SINIRIYLA hesaplanır ve YÖNÜ
 * BELLİ birer sınır olarak sunulur — `period` alt sınırdır ("≥"),
 * `frequency`/`dutyCycle` bu alt-sınır periyottan türedikleri için ÜST
 * sınırdır ("≤": gerçek periyot ne kadar uzunsa frekans/duty o kadar
 * KÜÇÜLÜR). HIGH nabzı doygunsa (çok daha nadir, dejenere bir yakalama)
 * yön belirsizleşir (pay VE payda birlikte etkilenir) — bu durumda periyot
 * ailesi HİÇ HESAPLANMAZ, yalnız Pulse Width doygunluk uyarısıyla gösterilir
 * (uydurma YOK). Rezerve (`0`, "ölçülemedi") bir yarı ise TAMAMEN FARKLI bir
 * durumdur: register bir ALT SINIR bile vermez, bu yüzden `Missing Pulse`
 * olarak işaretlenir ve periyot ailesi (sınır dahi olsa) HİÇ ÜRETİLMEZ.
 *
 * ── Spec'in kendi 20 ms/1.5 ms örneği KONTEYNERE SIĞMAZ — formül AYRI test edilir ─
 * Spec `:281`in çalışılmış örneği (Period=20 ms, Pulse=1.5 ms → f=50 Hz,
 * Duty=%7.5) tam da yukarıdaki nedenle bu depronun `Uint16LE` konteynerinde
 * TEK bir LOW nabzı olarak DOĞRUDAN kodlanamaz (18500 µs > 6553.5 µs).
 * Bu yüzden `computeCycleMetrics` saf bir fonksiyon olarak AYRIŞTIRILIP
 * export edilir: `pwmServo.test.ts` spec'in TAM SAYILARINI (1500, 20000)
 * konteyner sınırından bağımsız, DOĞRUDAN bu fonksiyona vererek doğrular.
 * Uçtan uca (konteyner üzerinden) testler ise sınırın İÇİNDE kalan, gerçekçi
 * ama küçültülmüş değerlerle koşar — ikisi birbirini SAHTE DOĞRULAMAZ, ayrı
 * ayrı kanıtlanır.
 *
 * ── Çerçeveler arası olanlar PARSER'A GİRMEZ (`mavlink.ts`in SEQ-LOSS kararı) ─
 * Jitter (Mean, Peak-to-Peak, Std Dev) TEK ÇAĞRIDAKİ nabız kaydı üzerinden
 * hesaplanır (brif: *"Jitter tek bir çerçeve içindeki nabızlar üzerinden
 * hesaplanabilir ve bu kadarı basılabilir"*) — birden çok ayrı `parse()`
 * çağrısı arasında durum TAŞINMAZ, yalnız TEK bir `data` arabelleğindeki
 * birden çok HIGH/LOW çifti (aynı kanalın ardışık çevrimleri) üzerinden
 * istatistik çıkarılır. RC Failsafe state machine (spec `:409`) parser'a
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
  pulseByteSpan,
} from '@/protocol-core/decoding/pulseLog';
import type { DecodedPulse } from '@/protocol-core/decoding/pulseLog';

const PROTOCOL_ID = 'pwm-servo';
/** Protokol adı veridir, çeviriye girmez (CLAUDE.md). */
const PROTOCOL_DISPLAY_NAME = 'PWM Servo';

/** Konteynerin ham kayıt sınırı — doygunluk testi BUNUNLA yapılır (tamsayı, float DEĞİL). */
const SATURATED_REGISTER = 0xffff;

/** Birim dönüşüm sabitleri — PROTOKOL kalibrasyonu DEĞİL (dosya başı, "GÖMÜLMEYECEKLER"). */
const MICROSECONDS_PER_SECOND = 1_000_000;
const PERCENT_MULTIPLIER = 100;

const OPTION_INITIAL_PULSE_LEVEL = 'initialPulseLevel';
const OPTION_MIN_PULSE_US = 'minPulseUs';
const OPTION_CENTER_PULSE_US = 'centerPulseUs';
const OPTION_MAX_PULSE_US = 'maxPulseUs';
const OPTION_EXPECTED_PERIOD_US = 'expectedPeriodUs';

const LEVEL_HIGH = 'high';
const LEVEL_LOW = 'low';

const DECODE_OPTIONS: readonly DecodeOption[] = [
  {
    id: OPTION_INITIAL_PULSE_LEVEL,
    label: 'protocol.pwmServo.option.initialPulseLevel',
    kind: 'select',
    defaultValue: LEVEL_HIGH,
    description: 'protocol.pwmServo.option.initialPulseLevel.description',
    choices: [
      { value: LEVEL_HIGH, label: 'protocol.pwmServo.option.initialPulseLevel.high' },
      { value: LEVEL_LOW, label: 'protocol.pwmServo.option.initialPulseLevel.low' },
    ],
  },
  {
    id: OPTION_MIN_PULSE_US,
    label: 'protocol.pwmServo.option.minPulseUs',
    kind: 'number',
    // 0 = VERİLMEDİ sentinel'i (dosya başı). Gerçek bir darbe süresi asla 0 µs olamaz.
    defaultValue: 0,
    min: 0,
    max: MAX_PULSE_DURATION_US,
    description: 'protocol.pwmServo.option.minPulseUs.description',
  },
  {
    id: OPTION_CENTER_PULSE_US,
    label: 'protocol.pwmServo.option.centerPulseUs',
    kind: 'number',
    defaultValue: 0,
    min: 0,
    max: MAX_PULSE_DURATION_US,
    description: 'protocol.pwmServo.option.centerPulseUs.description',
  },
  {
    id: OPTION_MAX_PULSE_US,
    label: 'protocol.pwmServo.option.maxPulseUs',
    kind: 'number',
    defaultValue: 0,
    min: 0,
    max: MAX_PULSE_DURATION_US,
    description: 'protocol.pwmServo.option.maxPulseUs.description',
  },
  {
    id: OPTION_EXPECTED_PERIOD_US,
    label: 'protocol.pwmServo.option.expectedPeriodUs',
    kind: 'number',
    // 0 = VERİLMEDİ. Üst sınır BİLEREK YOK: bu bir GERÇEK DÜNYA periyot
    // beklentisidir (ör. 20000 µs), konteynerin TEK bir nabız register'ının
    // sınırıyla (6553.5 µs) İLGİSİZDİR — dosya başı, "6553.5 µs TİPİK VAKA".
    defaultValue: 0,
    min: 0,
    description: 'protocol.pwmServo.option.expectedPeriodUs.description',
  },
];

const ERROR_EMPTY = 'protocol.pwmServo.error.empty';
const ERROR_ODD_LENGTH = 'protocol.pwmServo.error.oddLength';
const ERROR_ABORTED = 'protocol.pwmServo.error.aborted';
const ERROR_FRAME_TOO_LONG = 'protocol.pwmServo.error.frameTooLong';

const WARN_MISSING_PULSE = 'protocol.pwmServo.warning.missingPulse';
const WARN_PULSE_MAY_BE_SATURATED = 'protocol.pwmServo.warning.pulseMayBeSaturated';
const WARN_FRAME_PERIOD_ERROR = 'protocol.pwmServo.warning.framePeriodError';
const WARN_CALIBRATION_INVALID = 'protocol.pwmServo.warning.calibrationInvalid';
const WARN_JITTER_EXCLUDES_UNCERTAIN = 'protocol.pwmServo.warning.jitterExcludesUncertainPulses';

function toProtocolWarning(code: string): ProtocolWarning {
  return { code, message: code };
}

/** `rawRegister === 0xffff` (`../ppm/ppm.ts`teki eşdeğerin BİLİNÇLİ tekrarı, Karar 15e-1). */
function isSaturated(pulse: DecodedPulse): boolean {
  return pulse.rawRegister === SATURATED_REGISTER;
}

/** Doygun bir nabzın süresi ALT SINIRDIR — "≥ 6553.5" (`../ppm/ppm.ts`teki eşdeğerin tekrarı). */
function formatPulseDurationUs(pulse: DecodedPulse): string {
  return isSaturated(pulse) ? `≥ ${MAX_PULSE_DURATION_US.toFixed(1)}` : pulse.durationUs.toFixed(1);
}

export interface PwmServoCycleMetrics {
  readonly periodUs: number;
  readonly frequencyHz: number;
  readonly dutyCyclePercent: number;
}

/**
 * SAF fonksiyon — konteynerden BAĞIMSIZ. Spec `:274-281`in formülleri:
 * `Frequency = 1 / Period`, `DutyCycle = (PulseWidth / Period) × 100`.
 * Dosya başı "Spec'in kendi 20 ms/1.5 ms örneği KONTEYNERE SIĞMAZ" notu —
 * bu fonksiyon spec'in TAM SAYILARIYLA (1500, 20000) doğrudan test edilir.
 */
export function computeCycleMetrics(pulseWidthUs: number, periodUs: number): PwmServoCycleMetrics {
  return {
    periodUs,
    frequencyHz: MICROSECONDS_PER_SECOND / periodUs,
    dutyCyclePercent: (pulseWidthUs / periodUs) * PERCENT_MULTIPLIER,
  };
}

interface PwmServoCalibration {
  readonly initialPulseLevel: typeof LEVEL_HIGH | typeof LEVEL_LOW;
  readonly minPulseUs: number;
  readonly centerPulseUs: number;
  readonly maxPulseUs: number;
  readonly hasValidServoCalibration: boolean;
  readonly hasInvalidServoCalibration: boolean;
  /** 0 = VERİLMEDİ. */
  readonly expectedPeriodUs: number;
  readonly hasExpectedPeriod: boolean;
}

function readPositiveNumberOption(options: Record<string, unknown> | undefined, id: string): number {
  const raw = options?.[id];
  return typeof raw === 'number' && Number.isFinite(raw) && raw > 0 ? raw : 0;
}

function resolveCalibration(options: Record<string, unknown> | undefined): PwmServoCalibration {
  const levelRaw = options?.[OPTION_INITIAL_PULSE_LEVEL];
  const minPulseUs = readPositiveNumberOption(options, OPTION_MIN_PULSE_US);
  const centerPulseUs = readPositiveNumberOption(options, OPTION_CENTER_PULSE_US);
  const maxPulseUs = readPositiveNumberOption(options, OPTION_MAX_PULSE_US);
  const expectedPeriodUs = readPositiveNumberOption(options, OPTION_EXPECTED_PERIOD_US);

  const allThreeGiven = minPulseUs > 0 && centerPulseUs > 0 && maxPulseUs > 0;
  const orderingValid = minPulseUs < centerPulseUs && centerPulseUs < maxPulseUs;

  return {
    initialPulseLevel: levelRaw === LEVEL_LOW ? LEVEL_LOW : LEVEL_HIGH,
    minPulseUs,
    centerPulseUs,
    maxPulseUs,
    hasValidServoCalibration: allThreeGiven && orderingValid,
    hasInvalidServoCalibration: allThreeGiven && !orderingValid,
    expectedPeriodUs,
    hasExpectedPeriod: expectedPeriodUs > 0,
  };
}

interface PwmServoParseOptions {
  timestamp?: number;
  direction?: FrameDirection;
  channel?: string;
  maxFrameLength?: number;
  signal?: AbortSignal;
  options?: Record<string, unknown>;
}

function resolveParseOptions(context: ParseContext | undefined): PwmServoParseOptions {
  return {
    ...(context?.timestamp === undefined ? {} : { timestamp: context.timestamp }),
    ...(context?.direction === undefined ? {} : { direction: context.direction }),
    ...(context?.channel === undefined ? {} : { channel: context.channel }),
    ...(context?.maxFrameLength === undefined ? {} : { maxFrameLength: context.maxFrameLength }),
    ...(context?.signal === undefined ? {} : { signal: context.signal }),
    ...(context?.options === undefined ? {} : { options: context.options }),
  };
}

function infoField(id: string, name: string, physicalValue: string): ParsedField {
  return {
    id,
    name,
    offset: 0,
    length: 0,
    rawBytes: new Uint8Array(),
    physicalValue,
    valid: true,
    warnings: [],
  };
}

/** Eşleşmemiş tek bir nabız — baştaki sarkan LOW ya da sondaki sarkan HIGH. */
function danglingPulseField(data: Uint8Array, id: string, name: string, globalIndex: number, pulse: DecodedPulse): ParsedField {
  const span = pulseByteSpan(globalIndex, 1);
  const base = {
    id,
    name,
    offset: span.offset,
    length: span.length,
    rawBytes: data.slice(span.offset, span.offset + span.length),
  };
  if (pulse.reserved) return { ...base, valid: false, warnings: [WARN_MISSING_PULSE] };
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

function pulseWidthField(data: Uint8Array, cycleNumber: number, globalIndex: number, highPulse: DecodedPulse): ParsedField {
  const span = pulseByteSpan(globalIndex, 1);
  const base = {
    id: `cycle-${String(cycleNumber)}-pulse-width`,
    name: `Cycle ${String(cycleNumber + 1)} · Pulse Width`,
    offset: span.offset,
    length: span.length,
    rawBytes: data.slice(span.offset, span.offset + span.length),
  };
  if (highPulse.reserved) return { ...base, valid: false, warnings: [WARN_MISSING_PULSE] };
  const saturated = isSaturated(highPulse);
  return {
    ...base,
    rawValue: highPulse.rawRegister,
    physicalValue: formatPulseDurationUs(highPulse),
    unit: 'µs',
    valid: true,
    warnings: saturated ? [WARN_PULSE_MAY_BE_SATURATED] : [],
  };
}

interface CompleteCycle {
  readonly cycleNumber: number;
  readonly highGlobalIndex: number;
  readonly lowGlobalIndex: number;
  readonly highPulse: DecodedPulse;
  readonly lowPulse: DecodedPulse;
}

/**
 * Periyot ailesi (Frame Period/Frequency/Duty Cycle) — dosya başı "6553.5 µs
 * ... TİPİK VAKA" notu. LOW doygunsa sonuç YÖNÜ BELLİ birer SINIRDIR ("≥"/
 * "≤"); HIGH doygunsa yön belirsizleştiği için AİLE HİÇ ÜRETİLMEZ (`undefined`).
 */
function periodFamilyFields(
  data: Uint8Array,
  cycle: CompleteCycle,
  calibration: PwmServoCalibration,
): ParsedField[] {
  const { cycleNumber, highGlobalIndex, lowGlobalIndex, highPulse, lowPulse } = cycle;
  if (isSaturated(highPulse)) return [];

  const lowSaturated = isSaturated(lowPulse);
  const periodUs = highPulse.durationUs + lowPulse.durationUs;
  const metrics = computeCycleMetrics(highPulse.durationUs, periodUs);
  const bound = lowSaturated ? '≥ ' : '';
  const upperBound = lowSaturated ? '≤ ' : '';

  const span = pulseByteSpan(Math.min(highGlobalIndex, lowGlobalIndex), 2);
  // Not: her alan KENDİ `warnings` dizisini alır (`[...]` her yerde YENİDEN
  // yazılır) — aynı diziyi üç alan arasında PAYLAŞMAK, biri sonradan
  // mutasyona uğrarsa üçünü birden sessizce değiştirirdi.
  const fields: ParsedField[] = [
    {
      id: `cycle-${String(cycleNumber)}-period`,
      name: `Cycle ${String(cycleNumber + 1)} · Frame Period`,
      offset: span.offset,
      length: span.length,
      rawBytes: data.slice(span.offset, span.offset + span.length),
      physicalValue: `${bound}${metrics.periodUs.toFixed(1)}`,
      unit: 'µs',
      valid: true,
      warnings: lowSaturated ? [WARN_PULSE_MAY_BE_SATURATED] : [],
    },
    {
      id: `cycle-${String(cycleNumber)}-frequency`,
      name: `Cycle ${String(cycleNumber + 1)} · Frequency`,
      offset: span.offset,
      length: span.length,
      rawBytes: data.slice(span.offset, span.offset + span.length),
      physicalValue: `${upperBound}${metrics.frequencyHz.toFixed(2)}`,
      unit: 'Hz',
      valid: true,
      warnings: lowSaturated ? [WARN_PULSE_MAY_BE_SATURATED] : [],
    },
    {
      id: `cycle-${String(cycleNumber)}-duty-cycle`,
      name: `Cycle ${String(cycleNumber + 1)} · Duty Cycle`,
      offset: span.offset,
      length: span.length,
      rawBytes: data.slice(span.offset, span.offset + span.length),
      physicalValue: `${upperBound}${metrics.dutyCyclePercent.toFixed(2)}`,
      unit: '%',
      valid: true,
      warnings: lowSaturated ? [WARN_PULSE_MAY_BE_SATURATED] : [],
    },
  ];

  if (calibration.hasExpectedPeriod && !lowSaturated) {
    const deviationUs = periodUs - calibration.expectedPeriodUs;
    fields.push({
      id: `cycle-${String(cycleNumber)}-period-deviation`,
      name: `Cycle ${String(cycleNumber + 1)} · Period Deviation`,
      offset: span.offset,
      length: span.length,
      rawBytes: data.slice(span.offset, span.offset + span.length),
      physicalValue: deviationUs.toFixed(1),
      unit: 'µs',
      valid: true,
      warnings: deviationUs !== 0 ? [WARN_FRAME_PERIOD_ERROR] : [],
    });
  }

  return fields;
}

/** `periodFamilyFields`in döndürdüğü alanlarda `WARN_FRAME_PERIOD_ERROR` var mı — frame düzeyi özet için. */
function hasPeriodDeviationWarning(fields: readonly ParsedField[]): boolean {
  return fields.some((field) => field.warnings.includes(WARN_FRAME_PERIOD_ERROR));
}

/** Servo Position — yalnız HIGH'a bağlıdır (LOW'un durumundan BAĞIMSIZ hesaplanabilir). */
function servoPositionField(
  data: Uint8Array,
  cycleNumber: number,
  highGlobalIndex: number,
  highPulse: DecodedPulse,
  calibration: PwmServoCalibration,
): ParsedField | undefined {
  if (highPulse.reserved || isSaturated(highPulse) || !calibration.hasValidServoCalibration) return undefined;
  const span = pulseByteSpan(highGlobalIndex, 1);
  const denominator =
    highPulse.durationUs >= calibration.centerPulseUs
      ? calibration.maxPulseUs - calibration.centerPulseUs
      : calibration.centerPulseUs - calibration.minPulseUs;
  const percent = ((highPulse.durationUs - calibration.centerPulseUs) / denominator) * PERCENT_MULTIPLIER;
  return {
    id: `cycle-${String(cycleNumber)}-servo-position`,
    name: `Cycle ${String(cycleNumber + 1)} · Servo Position`,
    offset: span.offset,
    length: span.length,
    rawBytes: data.slice(span.offset, span.offset + span.length),
    physicalValue: percent.toFixed(1),
    unit: '%',
    valid: true,
    warnings: [],
  };
}

interface JitterStats {
  readonly meanUs: number;
  readonly peakToPeakUs: number;
  readonly stdDevUs: number;
}

/** Popülasyon standart sapması: TEK bir yakalamadaki nabızların TAMAMI değerlendiriliyor, bir örneklemden EVREN tahmini YOK. */
function computeJitterStats(widthsUs: readonly number[]): JitterStats {
  const mean = widthsUs.reduce((sum, value) => sum + value, 0) / widthsUs.length;
  const variance = widthsUs.reduce((sum, value) => sum + (value - mean) ** 2, 0) / widthsUs.length;
  return {
    meanUs: mean,
    peakToPeakUs: Math.max(...widthsUs) - Math.min(...widthsUs),
    stdDevUs: Math.sqrt(variance),
  };
}

function jitterFields(widthsUs: readonly number[]): ParsedField[] {
  if (widthsUs.length < 2) return [];
  const stats = computeJitterStats(widthsUs);
  const emptySpan = { offset: 0, length: 0, rawBytes: new Uint8Array() };
  return [
    { id: 'jitter-mean', name: 'Jitter · Mean', ...emptySpan, physicalValue: stats.meanUs.toFixed(1), unit: 'µs', valid: true, warnings: [] },
    {
      id: 'jitter-peak-to-peak',
      name: 'Jitter · Peak-to-Peak',
      ...emptySpan,
      physicalValue: stats.peakToPeakUs.toFixed(1),
      unit: 'µs',
      valid: true,
      warnings: [],
    },
    {
      id: 'jitter-std-dev',
      name: 'Jitter · Standard Deviation',
      ...emptySpan,
      physicalValue: stats.stdDevUs.toFixed(2),
      unit: 'µs',
      valid: true,
      warnings: [],
    },
  ];
}

function parsePwmServoFrame(data: Uint8Array, options: PwmServoParseOptions): ParseResult {
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

  fields.push(infoField('initial-pulse-level', 'Initial Pulse Level', calibration.initialPulseLevel === LEVEL_LOW ? 'Low' : 'High'));
  if (calibration.hasInvalidServoCalibration) warnings.push(toProtocolWarning(WARN_CALIBRATION_INVALID));

  const startIndex = calibration.initialPulseLevel === LEVEL_LOW ? 1 : 0;

  // TEK push per uyarı TİPİ (j1850Pwm.ts'in `hasReservedDataPulse` deseni) —
  // bayrak sarkan-LOW/sarkan-HIGH/rezerve-yarı üç kaynaktan da BESLENİR,
  // döngü sonunda BİR KEZ frame düzeyine yazılır.
  const jitterWidthsUs: number[] = [];
  let anyMissingPulse = false;
  let anySaturated = false;
  let anyFramePeriodError = false;
  // Tam bir çevrimde HIGH doygunken jitter'dan DIŞLANAN nabız sayısı — "eksik/rezerve"
  // dışlamasından (zaten WARN_MISSING_PULSE ile ayrı işaretli) BİLEREK AYRI sayılır.
  let highSaturatedInCompleteCycle = 0;
  let cycleNumber = 0;
  let index = startIndex;

  if (startIndex === 1) {
    const leading = pulses[0];
    if (leading !== undefined) {
      fields.push(danglingPulseField(data, 'leading-low', 'Leading Pulse (Incomplete Cycle)', 0, leading));
      anyMissingPulse = true;
    }
  }

  while (index < pulses.length) {
    const highGlobalIndex = index;
    const highPulse = pulses[highGlobalIndex];
    if (highPulse === undefined) break; // unreachable (index < pulses.length), TS daralması için.

    fields.push(pulseWidthField(data, cycleNumber, highGlobalIndex, highPulse));

    const lowGlobalIndex = highGlobalIndex + 1;
    const lowPulse = lowGlobalIndex < pulses.length ? pulses[lowGlobalIndex] : undefined;

    if (lowPulse === undefined) {
      // Sondaki sarkan HIGH — yapısal olarak eşi YOK (spec `:272` Missing Pulse).
      anyMissingPulse = true;
      cycleNumber += 1;
      index += 1;
      continue;
    }

    if (highPulse.reserved || lowPulse.reserved) {
      // Rezerve yarı: "ölçülemedi" — periyot ailesi HİÇ üretilmez (dosya başı, doygunluktan AYRI durum).
      anyMissingPulse = true;
      const servo = servoPositionField(data, cycleNumber, highGlobalIndex, highPulse, calibration);
      if (servo !== undefined) fields.push(servo);
      cycleNumber += 1;
      index += 2;
      continue;
    }

    if (isSaturated(highPulse)) {
      anySaturated = true;
      highSaturatedInCompleteCycle += 1;
    } else {
      jitterWidthsUs.push(highPulse.durationUs);
    }
    if (isSaturated(lowPulse)) anySaturated = true;

    const cycle: CompleteCycle = { cycleNumber, highGlobalIndex, lowGlobalIndex, highPulse, lowPulse };
    const periodFields = periodFamilyFields(data, cycle, calibration);
    fields.push(...periodFields);
    if (hasPeriodDeviationWarning(periodFields)) anyFramePeriodError = true;
    const servo = servoPositionField(data, cycleNumber, highGlobalIndex, highPulse, calibration);
    if (servo !== undefined) fields.push(servo);

    cycleNumber += 1;
    index += 2;
  }

  // TEK bir push per uyarı TİPİ (j1850Pwm.ts'in `hasReservedDataPulse` deseni) —
  // döngü içinde tekrar tekrar İTMEK aynı kodu N kez ekler, gürültü yaratır.
  if (anyMissingPulse) warnings.push(toProtocolWarning(WARN_MISSING_PULSE));
  if (anySaturated) warnings.push(toProtocolWarning(WARN_PULSE_MAY_BE_SATURATED));
  if (anyFramePeriodError) warnings.push(toProtocolWarning(WARN_FRAME_PERIOD_ERROR));

  fields.push(...jitterFields(jitterWidthsUs));
  if (jitterWidthsUs.length >= 2 && highSaturatedInCompleteCycle > 0) {
    warnings.push(toProtocolWarning(WARN_JITTER_EXCLUDES_UNCERTAIN));
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

export function parsePwmServo(data: Uint8Array, options?: Record<string, unknown>): ParseResult {
  return parsePwmServoFrame(data, options === undefined ? {} : { options });
}

export const pwmServoParser: ProtocolParser = {
  protocolId: PROTOCOL_ID,
  displayName: PROTOCOL_DISPLAY_NAME,

  /**
   * **DAİMA `false`.** Dosya başı "canParse NEDEN kalibrasyonsuz DAİMA false
   * DÖNER" — `../ppm/ppm.ts`/`uavcanCompatibility.ts` ile AYNI SINIF karar.
   */
  canParse(): boolean {
    return false;
  },

  parse(data: Uint8Array, context?: ParseContext): ParseResult {
    return parsePwmServoFrame(data, resolveParseOptions(context));
  },
};

/** `../ppm/ppm.ts`teki `buildPulseLog`in BİLİNÇLİ tekrarı (Karar 15e-1, ortak modül yok). */
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
    id: 'single-cycle-typical',
    name: 'protocol.pwmServo.example.singleCycleTypical.name',
    // HIGH=1500 µs (spec `:281`in Pulse'ı), LOW=2000 µs — periyodun İÇİNDE
    // kalması için küçültülmüş (gerçek 18500 µs konteynere SIĞMAZ, dosya başı).
    bytes: buildPulseLog([1500, 2000]),
    description: 'protocol.pwmServo.example.singleCycleTypical.description',
    expectedValid: true,
  },
  {
    id: 'low-saturates-realistic-period',
    name: 'protocol.pwmServo.example.lowSaturatesRealisticPeriod.name',
    // HIGH=1500 µs, LOW hedefi 18500 µs (GERÇEK 20 ms/50 Hz kalibrasyonu) —
    // `encodePulseLog` bunu register 0xffff'e KIRPAR (dosya başı, "6553.5 µs
    // ... TİPİK VAKA"). Period/Frequency/Duty Cycle ALT/ÜST SINIR olarak basılır.
    bytes: buildPulseLog([1500, 18500]),
    description: 'protocol.pwmServo.example.lowSaturatesRealisticPeriod.description',
    expectedValid: true,
  },
  {
    id: 'multi-channel-servo-positions',
    name: 'protocol.pwmServo.example.multiChannelServoPositions.name',
    // Spec `:283`in KENDİ multi-channel örneği: Servo1=1501, Servo2=1230,
    // Servo3=1782, Servo4=1500 µs — her biri kendi (güvenli) LOW'uyla eşleşir.
    bytes: buildPulseLog([1501, 2000, 1230, 2000, 1782, 2000, 1500, 2000]),
    description: 'protocol.pwmServo.example.multiChannelServoPositions.description',
    expectedValid: true,
  },
  {
    id: 'jitter-sample',
    name: 'protocol.pwmServo.example.jitterSample.name',
    // Spec `:284`in KENDİ jitter örneği: HIGH = 1498, 1502, 1501, 1497, 1503 µs
    // → Mean=1500.2, Peak-to-Peak=6. LOW'lar hepsi 2000 µs (jitter hesabına girmez).
    bytes: buildPulseLog([1498, 2000, 1502, 2000, 1501, 2000, 1497, 2000, 1503, 2000]),
    description: 'protocol.pwmServo.example.jitterSample.description',
    expectedValid: true,
  },
  {
    id: 'missing-pulse',
    name: 'protocol.pwmServo.example.missingPulse.name',
    // LOW REZERVE (0) — "ölçülemedi" (spec `:272`), periyot ailesi ÜRETİLMEZ.
    bytes: buildPulseLog([1500, 2000], [1]),
    description: 'protocol.pwmServo.example.missingPulse.description',
    expectedValid: true,
  },
  {
    id: 'truncated',
    name: 'protocol.pwmServo.example.truncated.name',
    // Tek uzunluk (3 bayt) — `decodePulseLog`in `odd-length` dalı.
    bytes: new Uint8Array([0x0a, 0x00, 0x05]),
    description: 'protocol.pwmServo.example.truncated.description',
    expectedValid: false,
  },
];

export const pwmServoPlugin: ProtocolPlugin = {
  id: PROTOCOL_ID,
  name: PROTOCOL_DISPLAY_NAME,
  category: 'aerospace-uav',
  parser: pwmServoParser,
  documentation: {
    summary: 'protocol.pwmServo.documentation.summary',
    layer: 'physical',
  },
  exampleFrames: EXAMPLE_FRAMES,
  decodeOptions: DECODE_OPTIONS,
};
