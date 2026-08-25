/**
 * SPC — Short PWM Code (SAE J2716'ya bağlı, çift-yönlü/istek-tetikli kullanım
 * biçimi), Faz 10 dalga 14g. `sensor-interfaces` ailesinin ikinci kaydı.
 *
 * ── SPC = tetik darbesi + `sent`in ÇÖZÜCÜSÜNÜN TA KENDİSİ ───────────────────
 * Spec `ozet/04-otomotiv.md:161-163`: *"Receiver/ECU SENT hattında belirli
 * bir pulse oluşturarak transmitter/sensor'dan response talep eder... ECU →
 * SPC Trigger Pulse → Sensor recognizes request → SENT Response Frame."*
 * Yani konteyner: `[tetik darbesi, ...normal bir SENT Fast Channel çerçevesi]`
 * — yanıt çerçevesi `sent.ts`teki `decodeSentNibbles`in ÇÖZDÜĞÜ ÇERÇEVENİN TA
 * KENDİSİDİR. **İKİNCİ bir nibble çözücü YAZILMADI** — bu dosya `sent.ts`ten
 * `decodeSentNibbles`/`sentSignatureFromPulses`/`SENT_PROFILE_CHOICES`ı
 * import EDER, kendi kopyasını üretmez (kanıt: `spc.test.ts`teki "aynı
 * fonksiyon çağrılıyor" testi + referans-eşitliği testi).
 *
 * Bu, 12g'nin RTCP→`ntpTimestamp.ts` vakasının aynı sınıfı: iki kayıt aynı
 * teli okuyor, tek fark girişteki tetik darbesi. `cipCore.ts`in
 * `decodeCipMessage(data, offset, ..., fields, warnings, errors)` imzası
 * emsal — `decodeSentNibbles`in `startPulseIndex` parametresi tam bunun için
 * var: `sent.ts` 0 verir, burası 1 verir (tetik darbesinden SONRA).
 *
 * ── `sensorProfile` — `sent`in `profile` şıkkıyla AYNI çeviri anahtarlarını PAYLAŞIR ──
 * Brief kararı: ikinci kez yazılmaz. `SENT_PROFILE_CHOICES`in REFERANSI
 * doğrudan kullanılıyor (14c'de `xcpOnCan.ts`ten `DECODE_OPTIONS` paylaşımının
 * aynı deseni). Tek fark: SPC'nin kendi `dataNibbleCount` sayı alanı YOK
 * (brief'in decodeOptions listesi yalnız `sensorProfile`i sayıyor) — bu yüzden
 * `custom` seçilse bile yanıt çerçevesi hep `SENT_DEFAULT_DATA_NIBBLE_COUNT`
 * kullanır; seçimin pratik etkisi yalnız profil satırının ETİKETİDİR. Bunu
 * genişletmek (SPC'ye kendi sayı alanını eklemek) bu dalganın kapsamı DEĞİL.
 *
 * ── Yedi hata sınıfı (spec `:167`) — HANGİLERİ GERÇEKTEN ÇÖZÜLÜYOR ──────────
 * Konteyner yalnız NABIZ SÜRELERİ taşır, nabızlar ARASI BOŞLUK/ZAMAN taşımaz
 * (madde 4, `pulseLog.ts`) — bu, yedi sınıfın hangilerinin tek bir yakalamadan
 * GERÇEKTEN türetilebileceğini sınırlar:
 *
 *   - **No response** — ÇÖZÜLÜR: konteynerde tetikten sonra hiç nabız yoksa
 *     (`pulses.length === 1`) doğrudan tespit edilir.
 *   - **Trigger too short** — KISMEN ÇÖZÜLÜR: tetik darbesi REZERVE (0x0000,
 *     "ölçülemedi") ise bu sınıfın bir VEKİLİ olarak işaretlenir. Sayısal bir
 *     "şu kadar µs'den kısa" eşiği spec'te YOK (`:167`: *"SPC profile-specific
 *     pulse width semantikleri sensor/vendor datasheet'ine bağlı tutulmalı"*)
 *     — böyle bir eşik UYDURULMADI.
 *   - **Invalid SENT CRC** — GÖSTERİLİR, DOĞRULANMAZ: `sent.ts`in kendi CRC
 *     kararının (dosya başı) doğal sonucu, ikinci kez tartışılmadı.
 *   - **Trigger too long, Response timeout, Unexpected sensor, Line not idle
 *     before trigger** — BU DALGADA UYGULANMADI: üçü de ya sayısal bir eşik
 *     (spec vermiyor, "vendor datasheet'ine bağlı" diyor) ya da konteynerin
 *     TAŞIMADIĞI bir bilgi (tetik-öncesi hat durumu, tetik-yanıt ARASINDAKİ
 *     boşluk/zaman — konteyner yalnız nabız SÜRELERİNİ tutar, aralarındaki
 *     boşluğu AYRI bir alan olarak taşımaz) gerektiriyor. Bu dört sınıf
 *     çeviri sözlüğünde AD olarak var (gelecekte zengin bir yakalama biçimi
 *     gelirse kullanılabilir) ama bugün hiçbir kod yolu onları tetiklemiyor —
 *     bu, brief'in "kaynaksız kayıt politikası" ilkesinin bir hata sınıfı
 *     düzeyinde uygulanışı: uydurmak yerine AÇIKÇA "uygulanmadı" demek.
 */

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
import { createRawFrame } from '@/protocol-core/types';
import { decodePulseLog, encodePulseLog, pulseByteSpan } from '@/protocol-core/decoding/pulseLog';

import {
  SENT_DEFAULT_DATA_NIBBLE_COUNT,
  SENT_PROFILE_CHOICES,
  SENT_PROFILE_CUSTOM,
  SENT_PROFILE_STANDARD,
  SENT_PROFILE_STANDARD_LABEL,
  decodeSentNibbles,
  forceReservedPulse,
  sentSignatureFromPulses,
  buildSentPulseLog,
} from './sent';

const PROTOCOL_ID = 'spc';
/** Protokol adı veridir, çeviriye girmez (CLAUDE.md). */
const PROTOCOL_DISPLAY_NAME = 'SPC';

const OPTION_SENSOR_PROFILE = 'sensorProfile';

const DECODE_OPTIONS: readonly DecodeOption[] = [
  {
    id: OPTION_SENSOR_PROFILE,
    label: 'protocol.spc.option.sensorProfile',
    kind: 'select',
    defaultValue: SENT_PROFILE_STANDARD,
    description: 'protocol.spc.option.sensorProfile.description',
    // `sent.ts`in profil şıklarının AYNI referansı — ikinci kez yazılmadı
    // (dosya başı notu; `spc.test.ts` bunu referans eşitliğiyle kanıtlar).
    choices: SENT_PROFILE_CHOICES,
  },
];

const ERROR_EMPTY = 'protocol.spc.error.empty';
const ERROR_ODD_LENGTH = 'protocol.spc.error.oddLength';
const ERROR_TOO_SHORT = 'protocol.spc.error.tooShort';
const ERROR_FRAME_TOO_LONG = 'protocol.spc.error.frameTooLong';
const ERROR_ABORTED = 'protocol.spc.error.aborted';
const ERROR_NO_RESPONSE = 'protocol.spc.error.noResponse';
const ERROR_TRIGGER_TOO_SHORT = 'protocol.spc.error.triggerTooShort';

const WARN_TRIGGER_TOO_SHORT = 'protocol.spc.warning.triggerTooShort';
const WARN_NO_RESPONSE = 'protocol.spc.warning.noResponse';

const SUMMARY_FRAME = 'protocol.spc.summary.frame';

function toProtocolWarning(key: string): ProtocolWarning {
  return { code: key, message: key };
}

interface ResolvedSpcProfile {
  readonly dataNibbleCount: number;
  readonly label: string;
}

/**
 * SPC'nin KENDİ sayı alanı yok (dosya başı notu) — `custom` seçilse bile
 * yanıt çerçevesi hep varsayılan nibble sayısını kullanır, yalnız etiket değişir.
 */
function resolveSpcProfile(options: Record<string, unknown> | undefined): ResolvedSpcProfile {
  const profileId =
    typeof options?.[OPTION_SENSOR_PROFILE] === 'string' ? options[OPTION_SENSOR_PROFILE] : SENT_PROFILE_STANDARD;
  const label = profileId === SENT_PROFILE_CUSTOM ? 'Custom sensor profile' : SENT_PROFILE_STANDARD_LABEL;
  return { dataNibbleCount: SENT_DEFAULT_DATA_NIBBLE_COUNT, label };
}

interface SpcParseOptions {
  timestamp?: number;
  direction?: FrameDirection;
  channel?: string;
  maxFrameLength?: number;
  signal?: AbortSignal;
  options?: Record<string, unknown>;
}

function resolveParseOptions(context: ParseContext | undefined): SpcParseOptions {
  return {
    ...(context?.timestamp === undefined ? {} : { timestamp: context.timestamp }),
    ...(context?.direction === undefined ? {} : { direction: context.direction }),
    ...(context?.channel === undefined ? {} : { channel: context.channel }),
    ...(context?.maxFrameLength === undefined ? {} : { maxFrameLength: context.maxFrameLength }),
    ...(context?.signal === undefined ? {} : { signal: context.signal }),
    ...(context?.options === undefined ? {} : { options: context.options }),
  };
}

export type SpcFrameMetadata = {
  dataNibbleCount: number;
  hasResponse: boolean;
  summaryKey: string;
  summaryParams: Record<string, string>;
};

function parseSpcFrame(data: Uint8Array, options: SpcParseOptions): ParseResult {
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
  const trigger = pulses[0];
  // decodePulseLog boş girdiyi zaten 'empty' ile eledi; pulses en az 1 eleman taşır.
  if (trigger === undefined) {
    return {
      success: false,
      error: { code: 'truncated-frame', message: ERROR_EMPTY, offset: 0, length: 0 },
      consumedBytes: 0,
      recoverable: true,
    };
  }

  const resolved = resolveSpcProfile(options.options);
  const fields: ParsedField[] = [];
  const warnings: ProtocolWarning[] = [];
  const errors: ProtocolError[] = [];

  fields.push({
    id: 'profile',
    name: 'Sensor Profile',
    offset: 0,
    length: 0,
    rawBytes: new Uint8Array(),
    rawValue: resolved.label,
    valid: true,
    warnings: [],
  });

  const triggerSpan = pulseByteSpan(0, 1);
  fields.push({
    id: 'trigger',
    name: 'SPC Trigger Pulse',
    offset: triggerSpan.offset,
    length: triggerSpan.length,
    rawBytes: data.slice(triggerSpan.offset, triggerSpan.offset + triggerSpan.length),
    ...(trigger.reserved
      ? {}
      : { rawValue: trigger.rawRegister, physicalValue: trigger.durationUs.toFixed(1), unit: 'µs' }),
    valid: !trigger.reserved,
    warnings: trigger.reserved ? [WARN_TRIGGER_TOO_SHORT] : [],
  });
  if (trigger.reserved) {
    warnings.push(toProtocolWarning(WARN_TRIGGER_TOO_SHORT));
    errors.push({
      code: 'value-out-of-range',
      message: ERROR_TRIGGER_TOO_SHORT,
      offset: triggerSpan.offset,
      length: triggerSpan.length,
    });
  }

  const hasResponse = pulses.length > 1;

  if (!hasResponse) {
    warnings.push(toProtocolWarning(WARN_NO_RESPONSE));
    errors.push({
      code: 'truncated-frame',
      message: ERROR_NO_RESPONSE,
      offset: data.length,
      length: 0,
    });
  } else {
    const requiredPulses = 1 + 1 + 1 + resolved.dataNibbleCount + 1; // trigger + sync + status + data + crc
    if (pulses.length < requiredPulses) {
      return {
        success: false,
        error: {
          code: 'truncated-frame',
          message: ERROR_TOO_SHORT,
          offset: 0,
          length: data.length,
          details: { pulseCount: pulses.length, requiredPulses },
        },
        consumedBytes: 0,
        recoverable: true,
      };
    }
    // `sent.ts`in ÇÖZÜCÜSÜNÜ ÇAĞIRIR — ikinci nibble çözücü YOK (dosya başı).
    decodeSentNibbles(data, pulses, 1, resolved.dataNibbleCount, fields, warnings, errors);
  }

  const metadata: SpcFrameMetadata = {
    dataNibbleCount: resolved.dataNibbleCount,
    hasResponse,
    summaryKey: SUMMARY_FRAME,
    summaryParams: { hasResponse: String(hasResponse) },
  };

  const rawFrame = createRawFrame(data, {
    ...(options.timestamp === undefined ? {} : { timestamp: options.timestamp }),
    ...(options.direction === undefined ? {} : { direction: options.direction }),
    ...(options.channel === undefined ? {} : { channel: options.channel }),
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

export function parseSpc(data: Uint8Array, options?: Record<string, unknown>): ParseResult {
  return parseSpcFrame(data, options === undefined ? {} : { options });
}

export const spcParser: ProtocolParser = {
  protocolId: PROTOCOL_ID,
  displayName: PROTOCOL_DISPLAY_NAME,

  /**
   * Ucuz ön eleme — tetik darbesi ÖLÇÜLMÜŞ (rezerve değil) olmalı VE
   * tetikten SONRAKİ nabızlar `sent.ts`in KENDİ imzasını (`sentSignatureFromPulses`)
   * taşımalı. İKİNCİ bir imza fonksiyonu YAZILMADI — `sent.ts`inki
   * pulses.slice(1) ile ÇAĞRILIYOR.
   */
  canParse(data: Uint8Array): boolean {
    const decoded = decodePulseLog(data);
    if (!decoded.ok) return false;
    const pulses = decoded.result.pulses;
    const trigger = pulses[0];
    if (trigger === undefined || trigger.reserved) return false;
    return sentSignatureFromPulses(pulses.slice(1));
  },

  parse(data: Uint8Array, context?: ParseContext): ParseResult {
    return parseSpcFrame(data, resolveParseOptions(context));
  },
};

// ── Örnek çerçeveler ─────────────────────────────────────────────────────
/** Tetik darbesinin gösterim amaçlı süresi — spec'ten alıntı bir zorunluluk DEĞİL (`j1850Pwm.ts`in `EXAMPLE_SOF_US` notuyla aynı disiplin). */
const EXAMPLE_TRIGGER_US = 500;

/** `j1850Pwm.ts`in `buildPwmPulseLog`iyle AYNI rol — testler ve `EXAMPLE_FRAMES` için tek üretim noktası. */
export function buildSpcPulseLog(input: {
  readonly includeResponse: boolean;
  readonly triggerDurationUs?: number;
  readonly truncateResponse?: boolean;
}): Uint8Array {
  const triggerUs = input.triggerDurationUs ?? EXAMPLE_TRIGGER_US;
  if (!input.includeResponse) {
    return encodePulseLog([triggerUs]);
  }
  const response = buildSentPulseLog({ statusNibble: 4, dataNibbles: [2, 6, 11, 0, 15, 9], crcNibble: 3 });
  if (input.truncateResponse === true) {
    // Yanıtı yarıda kes (yalnız sync + status + 2 veri nibble'ı kalsın).
    const truncated = response.slice(0, 4 * 2);
    const merged = new Uint8Array(2 + truncated.length);
    merged.set(encodePulseLog([triggerUs]));
    merged.set(truncated, 2);
    return merged;
  }
  const merged = new Uint8Array(2 + response.length);
  merged.set(encodePulseLog([triggerUs]));
  merged.set(response, 2);
  return merged;
}

const EXAMPLE_FRAMES: ExampleFrame[] = [
  {
    id: 'valid-response',
    name: 'protocol.spc.example.validResponse.name',
    bytes: buildSpcPulseLog({ includeResponse: true }),
    description: 'protocol.spc.example.validResponse.description',
    expectedValid: true,
  },
  {
    id: 'no-response',
    name: 'protocol.spc.example.noResponse.name',
    bytes: buildSpcPulseLog({ includeResponse: false }),
    description: 'protocol.spc.example.noResponse.description',
    expectedValid: false,
  },
  {
    id: 'trigger-reserved',
    name: 'protocol.spc.example.triggerReserved.name',
    bytes: forceReservedPulse(buildSpcPulseLog({ includeResponse: true }), 0),
    description: 'protocol.spc.example.triggerReserved.description',
    expectedValid: false,
  },
  {
    id: 'truncated-response',
    name: 'protocol.spc.example.truncatedResponse.name',
    bytes: buildSpcPulseLog({ includeResponse: true, truncateResponse: true }),
    description: 'protocol.spc.example.truncatedResponse.description',
    expectedValid: false,
  },
];

export const spcPlugin: ProtocolPlugin = {
  id: PROTOCOL_ID,
  name: PROTOCOL_DISPLAY_NAME,
  category: 'automotive',
  parser: spcParser,
  documentation: {
    summary: 'protocol.spc.documentation.summary',
    layer: 'physical',
  },
  exampleFrames: EXAMPLE_FRAMES,
  decodeOptions: DECODE_OPTIONS,
};
