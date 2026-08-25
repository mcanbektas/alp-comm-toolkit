/**
 * SAE J1850 PWM — 41.6 kbit/s, iki telli, darbe-genişlik modülasyonlu Class-B
 * araç ağı (Faz 10, dalga 14f). Girdi KONTEYNER sözleşmesi (nabız günlüğü,
 * bayt biçimi DEĞİL) `./j1850Pulse.ts` dosya başında TAM tanımlıdır — burada
 * TEKRAR EDİLMEZ, yalnız PWM'e özgü kararlar aşağıda.
 *
 * ── Bit kuralı: SÜRE TEK BAŞINA yeterli (aktif/pasif durum GEREKMEZ) ────────
 * Spec (`ozet/04-otomotiv.md:397`): *"Pulse 1: 8 us, Pulse 2: 16 us, Pulse 3:
 * 8 us → seçilen J1850 profiline göre Bit 1, Bit 0, Bit 1."* ve (`:399`):
 * *"Bit pulse view örneği: 8.1 us → Bit 1; 15.9 us → Bit 0; 8.0 us → Bit 1."*
 * PWM bölümü aktif/pasif durumdan HİÇ söz etmiyor (bu, VPW'nin `:407`
 * cümlesiyle AÇIK karşıtlık: "VPW'de bit anlamı yalnız pulse width'e değil,
 * aktif/passive state ile … birlikte değerlendirilmesine bağlıdır" — PWM için
 * böyle bir cümle YOK). Bu yüzden PWM `j1850Pulse.ts`in `deriveAlternatingLevels`
 * fonksiyonunu KULLANMAZ; yalnız `isShortPulse` yeterlidir: KISA → Bit 1,
 * UZUN → Bit 0 (yukarıdaki üç örnek de bu kuralla tutarlı).
 *
 * ── `bitThreshold` + `profile` — `microwire.ts`in DECODE_OPTIONS deseni ────
 * Katalog yorumu (`automotive.ts`) daha 14f başlamadan bunu yazmıştı: *"Bit
 * eşiği profile bağlıdır; '8 us = 1' gibi sabitler evrensel değildir."* Spec
 * `:512` de aynı şeyi genel kural olarak söylüyor. Varsayılan eşik
 * (`DEFAULT_BIT_THRESHOLD_US = 12`) spec'in KENDİ verdiği iki örnek süreninin
 * (8 ve 16 µs) ARİTMETİK ORTA NOKTASIDIR — spec bunu SÖZCÜK OLARAK vermiyor,
 * kısa/uzun ayrımı için standart bir karar sınırı türetildi (uydurma bir sabit
 * DEĞİL, verilen iki sayıdan çıkan bir SONUÇ). `profile` bir preset seçilirse
 * (`sae-standard`) sayı alanı YOK SAYILIR; alan tablosunun İLK SATIRI
 * yürürlükteki profili ADIYLA basar (`microwire.ts:20-26`: "bu sessiz bir
 * davranış değil"). `custom` seçilirse `bitThreshold` doğrudan geçerlidir.
 *
 * ── `canParse` — kendi senkron imzası, SOF + HER veri nabzı ────────────────
 * Kural ve gerekçe `j1850Pulse.ts` dosya başında ("canParse TUZAĞI" +
 * "ÖLÇÜLDÜ" notu — yalnız SOF'a bakan İLK sürüm registry'nin 761 örnek
 * çerçevesinin 413'ünü (%54) yanlış pozitif kabul ediyordu). PWM burada İKİ
 * şeye bakar: SOF `(PWM_SOF_MIN_US, PWM_SOF_MAX_US)` açık aralığında (16 µs <
 * süre < 64 µs) mı VE SOF'tan SONRAKİ HER nabız `[PWM_DATA_PULSE_MIN_US,
 * PWM_DATA_PULSE_MAX_US]` bandında (4-32 µs) mı — rezerve nabız ikisinde de
 * `false`e düşürür (`isWithinPulseBand`).
 *
 * ── Header HAM kalır ─────────────────────────────────────────────────────
 * Spec `:399`: *"Exact header semantics mesaj/uygulama standardına göre
 * değişebileceğinden J2178/J1979 gibi üst dokümanlarla eşlenmelidir."*
 * `j1939.ts`in SPN'i ve `obd.ts`in PID'i (`obd.ts:20-22`) ham bırakmasıyla
 * AYNI gerekçe: bağlamak, spec'in vermediği eşlemeyi uydurmak olurdu. J2178
 * tablosu bu dalganın kapsamı DEĞİLDİR.
 *
 * ── OBD-II zinciri AÇILMAZ ──────────────────────────────────────────────
 * Spec zinciri yalnız VPW için istiyor (`:413`); PWM bölümü (`:391-404`)
 * OBD'den hiç söz etmiyor. Bu yüzden PWM'in `decodeOptions`unda
 * `payloadInterpretation` YOK — `j1850Vpw.ts`in TEK farkı bu değil, ama en
 * görünür olanı.
 *
 * ── Çerçeve düzeni (bayta paketlendikten SONRA, pulse[0]=SOF hariç) ─────────
 * `Header(1 bayt) · Data(0+ bayt) · CRC(1 bayt)` — spec'in "SOF, Header, Data,
 * CRC, EOD, EOF" listesinden EOD/EOF birer SÜRE olarak bu depoda YOK (spec
 * ikisinin de kesin süresini vermiyor ve örnekler hiç EOD/EOF nabzı
 * içermiyor); yalnız veri taşıyan nabızlar (SOF sonrası) bit akışına girer.
 * Header'ın KAÇ BAYT olduğu da spec'te YOK — 1 bayt, HERHANGİ bir J1850
 * uygulamasının taşıyacağı ASGARİ header'dır (bazı uygulamalarda 3 bayt
 * olabilir; öyleyse fazlası Data içinde HAM görünür, zaten hiçbiri
 * yorumlanmadığı için yanlış ETİKETLENMİŞ olmaz, yalnız EKSİK ayrılmış olur).
 *
 * `CRC8_SAE_J1850` (`crcCatalogue.ts:51`, poly 0x1D/init 0xFF/xorout 0xFF) bu
 * dosyanın İLK tüketicisidir — Header+Data baytları üzerinden hesaplanır
 * (CRC alanının kendisi HARİÇ). Bit → bayt paketleme sırasının kanıtı ve
 * dürüstlük notu `j1850Pulse.ts` dosya başında.
 */

import { computeNamedCrc } from '@/protocol-core/checksums/crcCatalogue';
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
  decodePulseLog,
  encodePulseLog,
  isWithinPulseBand,
  pulseByteSpan,
} from '@/protocol-core/decoding/pulseLog';

import {
  PWM_DATA_PULSE_MAX_US,
  PWM_DATA_PULSE_MIN_US,
  PWM_SOF_MAX_US,
  PWM_SOF_MIN_US,
  isShortPulse,
  packBitsToBytes,
  unpackBytesToBits,
} from './j1850Pulse';

const PROTOCOL_ID = 'sae-j1850-pwm';
/** Protokol adı veridir, çeviriye girmez (CLAUDE.md). */
const PROTOCOL_DISPLAY_NAME = 'SAE J1850 PWM';

const BITS_PER_BYTE = 8;
const HEADER_LENGTH_BYTES = 1;
const CRC_LENGTH_BYTES = 1;
/** Header + CRC, Data OLMADAN da geçerli en kısa çerçeve (dosya başı, "Çerçeve düzeni"). */
const MIN_PACKED_BYTES = HEADER_LENGTH_BYTES + CRC_LENGTH_BYTES;
/** SOF hariç, en az bir bayt (8 bit) olmalı: 16 nabız. */
const MIN_DATA_PULSES = MIN_PACKED_BYTES * BITS_PER_BYTE;
/** `canParse`in ucuz eleme eşiği: SOF + en az bir bit (yalnız yapısal sağlık kontrolü). */
const MIN_PULSES_FOR_SIGNATURE = 2;

// Spec ozet 04-otomotiv.md:403 çalışılmış örneği — dosya başı "bitThreshold" notu.
const SHORT_PULSE_SPEC_US = 8;
const LONG_PULSE_SPEC_US = 16;
const DEFAULT_BIT_THRESHOLD_US = (SHORT_PULSE_SPEC_US + LONG_PULSE_SPEC_US) / 2;

const PROFILE_STANDARD = 'sae-standard';
const PROFILE_CUSTOM = 'custom';
/** Preset etiketi protokol VERİSİDİR, çeviriye girmez (microwire.ts'in preset.label'ı ile aynı disiplin). */
const PROFILE_STANDARD_LABEL = `SAE Standard (${String(SHORT_PULSE_SPEC_US)}/${String(LONG_PULSE_SPEC_US)} µs)`;

const OPTION_BIT_THRESHOLD = 'bitThreshold';
const OPTION_PROFILE = 'profile';

const BIT_THRESHOLD_MIN_US = 0.1;
const BIT_THRESHOLD_MAX_US = 6553.5;

const DECODE_OPTIONS: readonly DecodeOption[] = [
  {
    id: OPTION_BIT_THRESHOLD,
    label: 'protocol.j1850.pwm.option.bitThreshold',
    kind: 'number',
    defaultValue: DEFAULT_BIT_THRESHOLD_US,
    min: BIT_THRESHOLD_MIN_US,
    max: BIT_THRESHOLD_MAX_US,
    description: 'protocol.j1850.pwm.option.bitThreshold.description',
  },
  {
    id: OPTION_PROFILE,
    label: 'protocol.j1850.pwm.option.profile',
    kind: 'select',
    defaultValue: PROFILE_STANDARD,
    description: 'protocol.j1850.pwm.option.profile.description',
    choices: [
      { value: PROFILE_STANDARD, label: PROFILE_STANDARD_LABEL },
      { value: PROFILE_CUSTOM, label: 'protocol.j1850.pwm.option.profile.custom' },
    ],
  },
];

const ERROR_EMPTY = 'protocol.j1850.pwm.error.empty';
const ERROR_ODD_LENGTH = 'protocol.j1850.pwm.error.oddLength';
const ERROR_MISALIGNED_BITS = 'protocol.j1850.pwm.error.misalignedBits';
const ERROR_TOO_SHORT = 'protocol.j1850.pwm.error.tooShort';
const ERROR_FRAME_TOO_LONG = 'protocol.j1850.pwm.error.frameTooLong';
const ERROR_CRC_MISMATCH = 'protocol.j1850.pwm.error.crcMismatch';
const ERROR_ABORTED = 'protocol.j1850.pwm.error.aborted';

const WARN_SOF_RESERVED = 'protocol.j1850.pwm.warning.sofReserved';
const WARN_RESERVED_PULSE_IN_FRAME = 'protocol.j1850.pwm.warning.reservedPulseInFrame';
const WARN_HEADER_UNRESOLVED = 'protocol.j1850.pwm.warning.headerUnresolved';
const WARN_CRC_MISMATCH = 'protocol.j1850.pwm.warning.crcMismatch';

const SUMMARY_FRAME = 'protocol.j1850.pwm.summary.frame';

function toProtocolWarning(key: string): ProtocolWarning {
  return { code: key, message: key };
}

function formatHexByte(value: number): string {
  return `0x${value.toString(16).toUpperCase().padStart(2, '0')}`;
}

interface ResolvedPwmProfile {
  readonly thresholdUs: number;
  readonly label: string;
}

/** `microwire.ts`in `resolveProfile`iyle AYNI desen: tanınmayan değer sessizce varsayılana düşer. */
function resolveProfile(options: Record<string, unknown> | undefined): ResolvedPwmProfile {
  const profileId = typeof options?.[OPTION_PROFILE] === 'string' ? options[OPTION_PROFILE] : PROFILE_STANDARD;

  if (profileId !== PROFILE_CUSTOM) {
    return { thresholdUs: DEFAULT_BIT_THRESHOLD_US, label: PROFILE_STANDARD_LABEL };
  }

  const raw = options?.[OPTION_BIT_THRESHOLD];
  const thresholdUs =
    typeof raw === 'number' && Number.isFinite(raw) && raw > 0 && raw <= BIT_THRESHOLD_MAX_US
      ? raw
      : DEFAULT_BIT_THRESHOLD_US;
  return { thresholdUs, label: `Custom — threshold ${thresholdUs.toFixed(1)} µs` };
}

interface PwmParseOptions {
  timestamp?: number;
  direction?: FrameDirection;
  channel?: string;
  maxFrameLength?: number;
  signal?: AbortSignal;
  options?: Record<string, unknown>;
}

function resolveParseOptions(context: ParseContext | undefined): PwmParseOptions {
  return {
    ...(context?.timestamp === undefined ? {} : { timestamp: context.timestamp }),
    ...(context?.direction === undefined ? {} : { direction: context.direction }),
    ...(context?.channel === undefined ? {} : { channel: context.channel }),
    ...(context?.maxFrameLength === undefined ? {} : { maxFrameLength: context.maxFrameLength }),
    ...(context?.signal === undefined ? {} : { signal: context.signal }),
    ...(context?.options === undefined ? {} : { options: context.options }),
  };
}

export type J1850PwmFrameMetadata = {
  headerByte: number;
  dataLength: number;
  crcValid: boolean;
  summaryKey: string;
  summaryParams: Record<string, string>;
};

function parsePwmFrame(data: Uint8Array, options: PwmParseOptions): ParseResult {
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
  // decodePulseLog boş girdiyi zaten 'empty' ile eledi; pulses en az 1 eleman taşır.
  const sof = pulses[0];
  if (sof === undefined) {
    return {
      success: false,
      error: { code: 'truncated-frame', message: ERROR_EMPTY, offset: 0, length: 0 },
      consumedBytes: 0,
      recoverable: true,
    };
  }
  const dataPulses = pulses.slice(1);

  if (dataPulses.length % BITS_PER_BYTE !== 0) {
    return {
      success: false,
      error: {
        code: 'truncated-frame',
        message: ERROR_MISALIGNED_BITS,
        offset: 0,
        length: data.length,
        details: { dataPulseCount: dataPulses.length },
      },
      consumedBytes: 0,
      recoverable: true,
    };
  }

  if (dataPulses.length < MIN_DATA_PULSES) {
    return {
      success: false,
      error: {
        code: 'truncated-frame',
        message: ERROR_TOO_SHORT,
        offset: 0,
        length: data.length,
        details: { dataPulseCount: dataPulses.length, requiredPulses: MIN_DATA_PULSES },
      },
      consumedBytes: 0,
      recoverable: true,
    };
  }

  const resolved = resolveProfile(options.options);
  const fields: ParsedField[] = [];
  const warnings: ProtocolWarning[] = [];
  const errors: ProtocolError[] = [];

  // İlk satır YÜRÜRLÜKTEKİ PROFİL — preset seçiliyken bitThreshold alanının
  // YOK SAYILDIĞI yalnız burada görünür (microwire.ts:284-297 deseni).
  fields.push({
    id: 'profile',
    name: 'Profile',
    offset: 0,
    length: 0,
    rawBytes: new Uint8Array(),
    rawValue: resolved.label,
    valid: true,
    warnings: [],
  });

  const sofSpan = pulseByteSpan(0, 1);
  fields.push({
    id: 'sof',
    name: 'SOF',
    offset: sofSpan.offset,
    length: sofSpan.length,
    rawBytes: data.slice(sofSpan.offset, sofSpan.offset + sofSpan.length),
    ...(sof.reserved
      ? {}
      : { rawValue: sof.rawRegister, physicalValue: sof.durationUs.toFixed(1), unit: 'µs' }),
    valid: !sof.reserved,
    warnings: sof.reserved ? [WARN_SOF_RESERVED] : [],
  });
  if (sof.reserved) {
    warnings.push(toProtocolWarning(WARN_SOF_RESERVED));
  }

  // ── Nabızlardan bit akışı, bit akışından baytlar (dosya başı, CRC notu) ──
  let hasReservedDataPulse = false;
  const bits: (0 | 1)[] = dataPulses.map((pulse) => {
    if (pulse.reserved) {
      hasReservedDataPulse = true;
      return 0;
    }
    return isShortPulse(pulse.durationUs, resolved.thresholdUs) ? 1 : 0;
  });
  if (hasReservedDataPulse) {
    warnings.push(toProtocolWarning(WARN_RESERVED_PULSE_IN_FRAME));
  }

  const packed = packBitsToBytes(bits, 'msb-first');
  const headerByte = packed[0] ?? 0;
  const crcByteReceived = packed[packed.length - 1] ?? 0;
  const dataBytes = packed.slice(HEADER_LENGTH_BYTES, packed.length - CRC_LENGTH_BYTES);
  const crcCoverage = packed.slice(0, packed.length - CRC_LENGTH_BYTES);

  const headerSpan = pulseByteSpan(1, BITS_PER_BYTE);
  fields.push({
    id: 'header',
    name: 'Header',
    offset: headerSpan.offset,
    length: headerSpan.length,
    rawBytes: data.slice(headerSpan.offset, headerSpan.offset + headerSpan.length),
    rawValue: headerByte,
    valid: true,
    warnings: [WARN_HEADER_UNRESOLVED],
  });
  warnings.push(toProtocolWarning(WARN_HEADER_UNRESOLVED));

  const dataPulseStart = 1 + BITS_PER_BYTE;
  if (dataBytes.length > 0) {
    const dataSpan = pulseByteSpan(dataPulseStart, dataBytes.length * BITS_PER_BYTE);
    fields.push({
      id: 'data',
      name: 'Data',
      offset: dataSpan.offset,
      length: dataSpan.length,
      rawBytes: dataBytes,
      unit: 'B',
      valid: true,
      warnings: [],
    });
  }

  const computedCrc = Number(computeNamedCrc(crcCoverage, 'CRC8_SAE_J1850'));
  const crcValid = computedCrc === crcByteReceived;
  const crcPulseStart = dataPulseStart + dataBytes.length * BITS_PER_BYTE;
  const crcSpan = pulseByteSpan(crcPulseStart, BITS_PER_BYTE);
  fields.push({
    id: 'crc',
    name: 'CRC-8 (SAE J1850)',
    offset: crcSpan.offset,
    length: crcSpan.length,
    rawBytes: data.slice(crcSpan.offset, crcSpan.offset + crcSpan.length),
    rawValue: crcByteReceived,
    physicalValue: crcValid ? 'Valid' : `Invalid (computed ${formatHexByte(computedCrc)})`,
    valid: crcValid,
    warnings: crcValid ? [] : [WARN_CRC_MISMATCH],
  });
  if (!crcValid) {
    errors.push({
      code: 'crc-mismatch',
      message: ERROR_CRC_MISMATCH,
      offset: crcSpan.offset,
      length: crcSpan.length,
      details: { received: formatHexByte(crcByteReceived), computed: formatHexByte(computedCrc) },
    });
  }

  const metadata: J1850PwmFrameMetadata = {
    headerByte,
    dataLength: dataBytes.length,
    crcValid,
    summaryKey: SUMMARY_FRAME,
    summaryParams: { header: formatHexByte(headerByte), dataLength: String(dataBytes.length) },
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

export function parseJ1850Pwm(data: Uint8Array, options?: Record<string, unknown>): ParseResult {
  return parsePwmFrame(data, options === undefined ? {} : { options });
}

export const j1850PwmParser: ProtocolParser = {
  protocolId: PROTOCOL_ID,
  displayName: PROTOCOL_DISPLAY_NAME,

  /**
   * Ucuz ön eleme — kural ve gerekçe `j1850Pulse.ts` dosya başında ("canParse
   * TUZAĞI" + "ÖLÇÜLDÜ" notu). SOF, komşu VPW'nin ölçeğine SIÇRAMADAN kendi
   * en uzun veri bitinden belirgin biçimde uzun olmalı VE SOF'tan SONRAKİ
   * HER nabız (rezerve olmadan) PWM'in kendi tolerans bandında olmalı —
   * yalnız SOF'a bakmak yabancı protokollerin örneklerinin %54'ünü yanlış
   * pozitif kabul ediyordu, tek nabza bakmak naif kontrolün kendisiydi.
   */
  canParse(data: Uint8Array): boolean {
    const decoded = decodePulseLog(data);
    if (!decoded.ok) return false;
    const pulses = decoded.result.pulses;
    if (pulses.length < MIN_PULSES_FOR_SIGNATURE) return false;
    const sof = pulses[0];
    if (sof === undefined || !isWithinPulseBand(sof, PWM_SOF_MIN_US, PWM_SOF_MAX_US)) return false;
    return pulses
      .slice(1)
      .every((pulse) => isWithinPulseBand(pulse, PWM_DATA_PULSE_MIN_US, PWM_DATA_PULSE_MAX_US));
  },

  parse(data: Uint8Array, context?: ParseContext): ParseResult {
    return parsePwmFrame(data, resolveParseOptions(context));
  },
};

/** Örnek SOF süresi — bu dosyanın KENDİ tanıdığı ölçek bandı (16, 64) içinde, gösterim amaçlı seçildi; spec'ten alıntı bir SOF süresi DEĞİLDİR (dosya başı, "canParse" notu). */
const EXAMPLE_SOF_US = 40;

interface BuildPwmPulseLogInput {
  readonly header: number;
  readonly data?: readonly number[];
  readonly sofDurationUs?: number;
  readonly corruptCrc?: boolean;
}

/**
 * `decodePulseLog`in tersini (`encodePulseLog`) ve `CRC8_SAE_J1850`yi
 * kullanarak GEÇERLİ bir nabız günlüğü kurar — `canFrame.ts`in
 * `buildCanClassicFrame`iyle AYNI rol: örnekler elle hex yazılmak yerine tek
 * yerden üretilir, CRC her zaman GERÇEKTEN hesaplanır.
 */
export function buildPwmPulseLog(input: BuildPwmPulseLogInput): Uint8Array {
  const dataBytes = Uint8Array.from(input.data ?? []);
  const payload = new Uint8Array(HEADER_LENGTH_BYTES + dataBytes.length);
  payload[0] = input.header & 0xff;
  payload.set(dataBytes, HEADER_LENGTH_BYTES);

  let crcByte = Number(computeNamedCrc(payload, 'CRC8_SAE_J1850'));
  if (input.corruptCrc === true) crcByte = (crcByte + 1) & 0xff;

  const fullBytes = new Uint8Array(payload.length + CRC_LENGTH_BYTES);
  fullBytes.set(payload, 0);
  fullBytes[payload.length] = crcByte;

  const bits = unpackBytesToBits(fullBytes, 'msb-first');
  const durations = [
    input.sofDurationUs ?? EXAMPLE_SOF_US,
    ...bits.map((bit) => (bit === 1 ? SHORT_PULSE_SPEC_US : LONG_PULSE_SPEC_US)),
  ];
  return encodePulseLog(durations);
}

const EXAMPLE_FRAMES: ExampleFrame[] = [
  {
    id: 'valid-frame',
    name: 'protocol.j1850.pwm.example.validFrame.name',
    bytes: buildPwmPulseLog({ header: 0x61, data: [0x0c, 0x1a, 0xf8] }),
    description: 'protocol.j1850.pwm.example.validFrame.description',
    expectedValid: true,
  },
  {
    id: 'no-data-frame',
    name: 'protocol.j1850.pwm.example.noDataFrame.name',
    // Data OLMADAN da geçerli en kısa çerçeve: yalnız Header + CRC.
    bytes: buildPwmPulseLog({ header: 0x8a }),
    description: 'protocol.j1850.pwm.example.noDataFrame.description',
    expectedValid: true,
  },
  {
    id: 'bad-crc',
    name: 'protocol.j1850.pwm.example.badCrc.name',
    bytes: buildPwmPulseLog({ header: 0x61, data: [0x0c, 0x1a, 0xf8], corruptCrc: true }),
    description: 'protocol.j1850.pwm.example.badCrc.description',
    expectedValid: false,
  },
  {
    id: 'truncated',
    name: 'protocol.j1850.pwm.example.truncated.name',
    // SOF + yalnız 5 veri nabzı (bayta TAMAMLANMIYOR, 8'in katı değil).
    bytes: encodePulseLog([40, 8, 16, 8, 8, 16]),
    description: 'protocol.j1850.pwm.example.truncated.description',
    expectedValid: false,
  },
];

export const j1850PwmPlugin: ProtocolPlugin = {
  id: PROTOCOL_ID,
  name: PROTOCOL_DISPLAY_NAME,
  category: 'automotive',
  parser: j1850PwmParser,
  documentation: {
    summary: 'protocol.j1850.pwm.documentation.summary',
    layer: 'data-link',
  },
  exampleFrames: EXAMPLE_FRAMES,
  decodeOptions: DECODE_OPTIONS,
};
