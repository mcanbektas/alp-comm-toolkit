/**
 * SAE J1850 VPW — 10.4 kbit/s, tek telli, değişken darbe-genişlikli Class-B
 * araç ağı (Faz 10, dalga 14f). Girdi KONTEYNER sözleşmesi `./j1850Pulse.ts`
 * dosya başında TAM tanımlıdır — burada TEKRAR EDİLMEZ, yalnız VPW'e özgü
 * kararlar aşağıda. `sae-j1850-pwm`in AYNI klasördeki kardeşi: 12f'in
 * `mqtt.ts`/`mqttSn.ts` kararı burada da geçerli — akraba görünen iki biçim
 * yan yana konur ki fark GÖRÜNSÜN, tek dosyada gizlenmesin.
 *
 * ── Bit kuralı: SÜRE TEK BAŞINA YETMEZ, DURUMLA BİRLİKTE okunur ────────────
 * Spec (`ozet/04-otomotiv.md:407`): *"VPW'de bit anlamı yalnız pulse width'e
 * değil, aktif/passive state ile pulse duration'ın birlikte
 * değerlendirilmesine bağlıdır."* Bu, PWM'in AÇIK KARŞITIDIR (`j1850Pwm.ts`
 * dosya başı). Uygulanan tablo — SAE J1850 VPW'nin GENEL BİLİNEN kuralı,
 * `obd.ts:27-32`nin "MOD + 0x40 = YANIT" kuralını genel J1979 bilgisinden
 * (bu depronun spec özetinden DEĞİL) almasıyla AYNI kaynak sınıfı, bu depodaki
 * spec özeti tabloyu VERMİYOR, yalnız "durum + süre birlikte" cümlesini
 * veriyor (dürüstlük notu `j1850Pulse.ts` dosya başında da tekrarlanıyor):
 *
 *   | Durum   | Kısa (`isShortPulse`=true) | Uzun (`isShortPulse`=false) |
 *   |---------|-----------------------------|------------------------------|
 *   | Active  | Bit 1                       | Bit 0                        |
 *   | Passive | Bit 0                       | Bit 1                        |
 *
 * Yani `bit = (kısa === aktif) ? 1 : 0` (`deriveVpwBit`).
 *
 * ── `initialLevel` — konteynere bit ÇALINMADAN çözülen tek bilinmeyen ───────
 * Nabızlar KESİN ALTERNE eder (`j1850Pulse.ts`in `deriveAlternatingLevels`ı);
 * SOF (pulses[0]) varsayılan olarak AKTİFTİR (gerçek VPW'de SOF hattı aktife
 * SÜRER — genel bilinen kural, aynı dürüstlük sınırı). `initialLevel` bu
 * yüzden pulses[0]'ın seviyesini seçer, `pulses[1]` (ilk veri biti) OTOMATİK
 * TERSİNİ alır — panel her nabza ayrı bir seviye biti SORMAZ.
 *
 * ── `bitThreshold` — spec'in KENDİ verdiği iki sayının orta noktası ─────────
 * Spec `:411`: *"Örnek raw capture: Active 64 us, Passive 128 us…"*.
 * `DEFAULT_BIT_THRESHOLD_US = 96` bu iki sayının ARİTMETİK ORTA NOKTASIDIR —
 * `j1850Pwm.ts`in 12 µs'lik eşiğiyle AYNI türetme mantığı, spec'in sözcüğü
 * DEĞİL. VPW'de PWM'deki gibi bir `profile` preset'i YOK — spec yalnız TEK
 * bir çalışılmış örnek veriyor (PWM'in "8/16 µs" tekrarına karşılık VPW'de
 * ikinci bir profil ADAYI da yok), bu yüzden yalnız `bitThreshold` sayısı var.
 *
 * ── OBD-II zinciri — OPT-IN, SESSİZ DEĞİL (`devicenet.ts`in `cip-explicit`
 *    deseni BİREBİR emsal) ───────────────────────────────────────────────────
 * Spec `:413`: *"Toolkit zincirleme decode yapabilmelidir: J1850 VPW → OBD-II
 * → Mode → PID."* Dalga 1/2 kararı `obd.ts:4-6`de yazılı: "üç motor bağımsız
 * çalışır, zincir parser katmanında kurulmaz" — ama `devicenet.ts` bu kuralı
 * `:64-67`de yazılı KOŞULLU gerekçeyle deldi: ayrım GERÇEKTEN çerçeveden
 * çıkarılamıyor (kullanıcı sistem bağlamından bilir). J1850 VPW'nin Data alanı
 * ile `obd.ts`in girdisi ("GİRDİ CAN ÇERÇEVESİ DEĞİLDİR", `obd.ts:4-6`, ham
 * PDU baytı) TAM olarak örtüşüyor. Varsayılan `raw` + "OBD-II sayfasında
 * çözülür" uyarısı; `obd-ii` seçilirse `parseObd`ın ürettiği alanlar
 * `obd-` önekiyle tabloya EKLENİR, `data` alanı KAYBOLUR (`devicenet.ts:341-352`
 * ile `:330-340` arası birebir yapı). Bu kanal PWM'de YOK — spec `:391-404`
 * PWM bölümünde OBD'den hiç söz etmiyor, zincir yalnız VPW için isteniyor.
 *
 * ── Header HAM kalır, `canParse` ── `j1850Pwm.ts` dosya başındaki gerekçeler
 * BİREBİR burada da geçerli (spec `:401`, J2178/J1979 atfı; SOF ölçek sınırı
 * bu kez ALT sınır spec'in kısa bitinin KENDİSİ: `sof >= VPW_SOF_MIN_US`).
 * Üst sınır (`VPW_SOF_MAX_US`) İLK sürümde YOKTU ("VPW zaten en geniş ölçek,
 * komşu üst protokol yok" gerekçesiyle) ama bu, registry taramasında
 * (`j1850Pulse.ts` dosya başı, "ÖLÇÜLDÜ" notu) rastgele HERHANGİ bir ilk
 * nabzın neredeyse otomatik geçmesi anlamına geliyordu — üst sınır SONRADAN
 * eklendi. AYNI ders: yalnız SOF'a bakmak yetmiyordu, SOF'tan SONRAKİ HER
 * nabız da `[VPW_DATA_PULSE_MIN_US, VPW_DATA_PULSE_MAX_US]` bandında olmalı.
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
import { parseObd } from '../obd/obd';
import type { PulseLevel } from './j1850Pulse';
import {
  VPW_DATA_PULSE_MAX_US,
  VPW_DATA_PULSE_MIN_US,
  VPW_SOF_MAX_US,
  VPW_SOF_MIN_US,
  decodePulseLog,
  deriveAlternatingLevels,
  encodePulseLog,
  isShortPulse,
  isWithinPulseBand,
  packBitsToBytes,
  pulseByteSpan,
  unpackBytesToBits,
} from './j1850Pulse';

const PROTOCOL_ID = 'sae-j1850-vpw';
/** Protokol adı veridir, çeviriye girmez (CLAUDE.md). */
const PROTOCOL_DISPLAY_NAME = 'SAE J1850 VPW';

const BITS_PER_BYTE = 8;
const HEADER_LENGTH_BYTES = 1;
const CRC_LENGTH_BYTES = 1;
const MIN_PACKED_BYTES = HEADER_LENGTH_BYTES + CRC_LENGTH_BYTES;
const MIN_DATA_PULSES = MIN_PACKED_BYTES * BITS_PER_BYTE;
const MIN_PULSES_FOR_SIGNATURE = 2;
const HEADER_PULSE_START = 1;
const HEADER_PULSE_COUNT = BITS_PER_BYTE;
const DATA_PULSE_START = HEADER_PULSE_START + HEADER_PULSE_COUNT;

// Spec ozet 04-otomotiv.md:411 çalışılmış örneği — dosya başı "bitThreshold" notu.
const SHORT_PULSE_SPEC_US = 64;
const LONG_PULSE_SPEC_US = 128;
const DEFAULT_BIT_THRESHOLD_US = (SHORT_PULSE_SPEC_US + LONG_PULSE_SPEC_US) / 2;

const LEVEL_ACTIVE: PulseLevel = 'active';
const LEVEL_PASSIVE: PulseLevel = 'passive';

const PAYLOAD_RAW = 'raw';
const PAYLOAD_OBD_II = 'obd-ii';

const OPTION_BIT_THRESHOLD = 'bitThreshold';
const OPTION_INITIAL_LEVEL = 'initialLevel';
const OPTION_PAYLOAD_INTERPRETATION = 'payloadInterpretation';

const BIT_THRESHOLD_MIN_US = 0.1;
const BIT_THRESHOLD_MAX_US = 6553.5;

const DECODE_OPTIONS: readonly DecodeOption[] = [
  {
    id: OPTION_BIT_THRESHOLD,
    label: 'protocol.j1850.vpw.option.bitThreshold',
    kind: 'number',
    defaultValue: DEFAULT_BIT_THRESHOLD_US,
    min: BIT_THRESHOLD_MIN_US,
    max: BIT_THRESHOLD_MAX_US,
    description: 'protocol.j1850.vpw.option.bitThreshold.description',
  },
  {
    id: OPTION_INITIAL_LEVEL,
    label: 'protocol.j1850.vpw.option.initialLevel',
    kind: 'select',
    defaultValue: LEVEL_ACTIVE,
    description: 'protocol.j1850.vpw.option.initialLevel.description',
    choices: [
      { value: LEVEL_ACTIVE, label: 'protocol.j1850.vpw.option.initialLevel.active' },
      { value: LEVEL_PASSIVE, label: 'protocol.j1850.vpw.option.initialLevel.passive' },
    ],
  },
  {
    id: OPTION_PAYLOAD_INTERPRETATION,
    label: 'protocol.j1850.vpw.option.payloadInterpretation',
    kind: 'select',
    defaultValue: PAYLOAD_RAW,
    description: 'protocol.j1850.vpw.option.payloadInterpretation.description',
    choices: [
      { value: PAYLOAD_RAW, label: 'protocol.j1850.vpw.option.payloadInterpretation.raw' },
      { value: PAYLOAD_OBD_II, label: 'protocol.j1850.vpw.option.payloadInterpretation.obdIi' },
    ],
  },
];

const ERROR_EMPTY = 'protocol.j1850.vpw.error.empty';
const ERROR_ODD_LENGTH = 'protocol.j1850.vpw.error.oddLength';
const ERROR_MISALIGNED_BITS = 'protocol.j1850.vpw.error.misalignedBits';
const ERROR_TOO_SHORT = 'protocol.j1850.vpw.error.tooShort';
const ERROR_FRAME_TOO_LONG = 'protocol.j1850.vpw.error.frameTooLong';
const ERROR_CRC_MISMATCH = 'protocol.j1850.vpw.error.crcMismatch';
const ERROR_ABORTED = 'protocol.j1850.vpw.error.aborted';

const WARN_SOF_RESERVED = 'protocol.j1850.vpw.warning.sofReserved';
const WARN_RESERVED_PULSE_IN_FRAME = 'protocol.j1850.vpw.warning.reservedPulseInFrame';
const WARN_HEADER_UNRESOLVED = 'protocol.j1850.vpw.warning.headerUnresolved';
const WARN_CRC_MISMATCH = 'protocol.j1850.vpw.warning.crcMismatch';
const WARN_DATA_MAY_BE_OBD = 'protocol.j1850.vpw.warning.dataMayBeObd';
const WARN_OBD_PARSE_FAILED = 'protocol.j1850.vpw.warning.obdParseFailed';

const SUMMARY_FRAME = 'protocol.j1850.vpw.summary.frame';

function toProtocolWarning(key: string): ProtocolWarning {
  return { code: key, message: key };
}

function formatHexByte(value: number): string {
  return `0x${value.toString(16).toUpperCase().padStart(2, '0')}`;
}

/** Dosya başı tablosu: `bit = (kısa === aktif) ? 1 : 0`. */
function deriveVpwBit(durationUs: number, thresholdUs: number, level: PulseLevel): 0 | 1 {
  const short = isShortPulse(durationUs, thresholdUs);
  return short === (level === LEVEL_ACTIVE) ? 1 : 0;
}

interface VpwParseOptions {
  timestamp?: number;
  direction?: FrameDirection;
  channel?: string;
  maxFrameLength?: number;
  signal?: AbortSignal;
  bitThresholdUs: number;
  initialLevel: PulseLevel;
  payloadInterpretation: string;
}

function resolveParseOptions(context: ParseContext | undefined): VpwParseOptions {
  const rawThreshold = context?.options?.[OPTION_BIT_THRESHOLD];
  const bitThresholdUs =
    typeof rawThreshold === 'number' &&
    Number.isFinite(rawThreshold) &&
    rawThreshold > 0 &&
    rawThreshold <= BIT_THRESHOLD_MAX_US
      ? rawThreshold
      : DEFAULT_BIT_THRESHOLD_US;

  const rawLevel = context?.options?.[OPTION_INITIAL_LEVEL];
  const initialLevel: PulseLevel = rawLevel === LEVEL_PASSIVE ? LEVEL_PASSIVE : LEVEL_ACTIVE;

  const rawPayload = context?.options?.[OPTION_PAYLOAD_INTERPRETATION];
  const payloadInterpretation = rawPayload === PAYLOAD_OBD_II ? PAYLOAD_OBD_II : PAYLOAD_RAW;

  return {
    ...(context?.timestamp === undefined ? {} : { timestamp: context.timestamp }),
    ...(context?.direction === undefined ? {} : { direction: context.direction }),
    ...(context?.channel === undefined ? {} : { channel: context.channel }),
    ...(context?.maxFrameLength === undefined ? {} : { maxFrameLength: context.maxFrameLength }),
    ...(context?.signal === undefined ? {} : { signal: context.signal }),
    bitThresholdUs,
    initialLevel,
    payloadInterpretation,
  };
}

/**
 * `parseObd`ın ürettiği alanı BU çerçevenin konteyner koordinatlarına taşır.
 * OBD'nin `offset`/`length`i KENDİ girdisinin (paketlenmiş data baytları)
 * bayt cinsindendir — konteynerde her paketlenmiş bayt 8 nabza (16 konteyner
 * baytına) karşılık geldiği için düz toplama YAPILAMAZ, `pulseByteSpan`
 * üzerinden yeniden hesaplanır (`types.ts:41` "offset/length BAYT cinsinden"
 * kuralı burada iki farklı "bayt" anlamı taşıyor — paketlenmiş mi, konteyner
 * mi — karıştırılırsa byte-viewer yanlış aralığı vurgular).
 */
function remapObdField(field: ParsedField, dataStartPulseIndex: number): ParsedField {
  const span = pulseByteSpan(
    dataStartPulseIndex + field.offset * BITS_PER_BYTE,
    field.length * BITS_PER_BYTE,
  );
  return { ...field, id: `obd-${field.id}`, offset: span.offset, length: span.length };
}

export type J1850VpwFrameMetadata = {
  headerByte: number;
  dataLength: number;
  crcValid: boolean;
  payloadInterpretation: string;
  summaryKey: string;
  summaryParams: Record<string, string>;
};

function parseVpwFrame(data: Uint8Array, options: VpwParseOptions): ParseResult {
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

  const fields: ParsedField[] = [];
  const warnings: ProtocolWarning[] = [];
  const errors: ProtocolError[] = [];

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

  // ── Alterne seviye + süre → bit (dosya başı tablosu) ──────────────────────
  const levels = deriveAlternatingLevels(pulses.length, options.initialLevel);
  let hasReservedDataPulse = false;
  const bits: (0 | 1)[] = dataPulses.map((pulse, index) => {
    if (pulse.reserved) {
      hasReservedDataPulse = true;
      return 0;
    }
    const level = levels[index + 1] ?? LEVEL_ACTIVE;
    return deriveVpwBit(pulse.durationUs, options.bitThresholdUs, level);
  });
  if (hasReservedDataPulse) {
    warnings.push(toProtocolWarning(WARN_RESERVED_PULSE_IN_FRAME));
  }

  const packed = packBitsToBytes(bits, 'msb-first');
  const headerByte = packed[0] ?? 0;
  const crcByteReceived = packed[packed.length - 1] ?? 0;
  const dataBytes = packed.slice(HEADER_LENGTH_BYTES, packed.length - CRC_LENGTH_BYTES);
  const crcCoverage = packed.slice(0, packed.length - CRC_LENGTH_BYTES);

  const headerSpan = pulseByteSpan(HEADER_PULSE_START, HEADER_PULSE_COUNT);
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

  if (dataBytes.length > 0) {
    if (options.payloadInterpretation === PAYLOAD_OBD_II) {
      const obdResult = parseObd(dataBytes);
      if (obdResult.success) {
        for (const field of obdResult.frame.fields) {
          fields.push(remapObdField(field, DATA_PULSE_START));
        }
        for (const warning of obdResult.frame.warnings) {
          warnings.push(warning);
        }
        for (const error of obdResult.frame.errors) {
          errors.push(error);
        }
      } else {
        warnings.push(toProtocolWarning(WARN_OBD_PARSE_FAILED));
      }
    } else {
      const dataSpan = pulseByteSpan(DATA_PULSE_START, dataBytes.length * BITS_PER_BYTE);
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
      warnings.push(toProtocolWarning(WARN_DATA_MAY_BE_OBD));
    }
  }

  const computedCrc = Number(computeNamedCrc(crcCoverage, 'CRC8_SAE_J1850'));
  const crcValid = computedCrc === crcByteReceived;
  const crcPulseStart = DATA_PULSE_START + dataBytes.length * BITS_PER_BYTE;
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

  const metadata: J1850VpwFrameMetadata = {
    headerByte,
    dataLength: dataBytes.length,
    crcValid,
    payloadInterpretation: options.payloadInterpretation,
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

/** `options` verilmezse tüm alanlar varsayılana düşer (`resolveParseOptions(undefined)` ile AYNI). */
export function parseJ1850Vpw(data: Uint8Array, options?: Record<string, unknown>): ParseResult {
  return parseVpwFrame(
    data,
    resolveParseOptions(options === undefined ? undefined : { options }),
  );
}

export const j1850VpwParser: ProtocolParser = {
  protocolId: PROTOCOL_ID,
  displayName: PROTOCOL_DISPLAY_NAME,

  /**
   * Ucuz ön eleme — kural ve gerekçe `j1850Pulse.ts` dosya başında ("canParse
   * TUZAĞI" + "ÖLÇÜLDÜ" notu). VPW'nin SOF'u `[VPW_SOF_MIN_US, VPW_SOF_MAX_US]`
   * bandında olmalı — alt sınır spec'in kısa bitinin KENDİSİ (64 µs), üst
   * sınır SONRADAN eklendi (dosya başı notu: sınırsız üst uç rastgele
   * HERHANGİ bir ilk nabzı geçiriyordu). SOF'tan SONRAKİ HER nabız da
   * (rezerve olmadan) VPW'nin kendi tolerans bandında olmalı — yalnız SOF'a
   * bakmak yabancı protokollerin örneklerinin %54'ünü yanlış pozitif kabul
   * ediyordu.
   */
  canParse(data: Uint8Array): boolean {
    const decoded = decodePulseLog(data);
    if (!decoded.ok) return false;
    const pulses = decoded.result.pulses;
    if (pulses.length < MIN_PULSES_FOR_SIGNATURE) return false;
    const sof = pulses[0];
    if (sof === undefined || !isWithinPulseBand(sof, VPW_SOF_MIN_US, VPW_SOF_MAX_US)) {
      return false;
    }
    return pulses
      .slice(1)
      .every((pulse) => isWithinPulseBand(pulse, VPW_DATA_PULSE_MIN_US, VPW_DATA_PULSE_MAX_US));
  },

  parse(data: Uint8Array, context?: ParseContext): ParseResult {
    return parseVpwFrame(data, resolveParseOptions(context));
  },
};

/** Örnek SOF süresi — bu dosyanın KENDİ tanıdığı ölçek bandında (>=64 µs), gösterim amaçlı; spec'ten alıntı bir SOF süresi DEĞİLDİR. */
const EXAMPLE_SOF_US = 200;

function encodeVpwBitDuration(bit: 0 | 1, level: PulseLevel): number {
  const short = (bit === 1) === (level === LEVEL_ACTIVE);
  return short ? SHORT_PULSE_SPEC_US : LONG_PULSE_SPEC_US;
}

interface BuildVpwPulseLogInput {
  readonly header: number;
  readonly data?: readonly number[];
  readonly initialLevel?: PulseLevel;
  readonly sofDurationUs?: number;
  readonly corruptCrc?: boolean;
}

/**
 * `j1850Pwm.ts`in `buildPwmPulseLog`iyle AYNI rol — `deriveAlternatingLevels`i
 * DECODE ile PAYLAŞARAK (ikinci, bağımsız bir seviye hesaplama YAZILMADI)
 * bilinen baytlardan geçerli bir VPW nabız günlüğü kurar.
 */
export function buildVpwPulseLog(input: BuildVpwPulseLogInput): Uint8Array {
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
  const initialLevel = input.initialLevel ?? LEVEL_ACTIVE;
  const levels = deriveAlternatingLevels(1 + bits.length, initialLevel);

  const durations = [input.sofDurationUs ?? EXAMPLE_SOF_US];
  bits.forEach((bit, index) => {
    const level = levels[index + 1] ?? LEVEL_ACTIVE;
    durations.push(encodeVpwBitDuration(bit, level));
  });
  return encodePulseLog(durations);
}

const EXAMPLE_FRAMES: ExampleFrame[] = [
  {
    id: 'valid-frame',
    name: 'protocol.j1850.vpw.example.validFrame.name',
    // Data spec'in KENDİ doğrulanmış OBD-II fixture'ıdır (obd.ts "engine-rpm-response":
    // A=0x1A, B=0xF8 → 1726 rpm, ozet 04:295) — payloadInterpretation=obd-ii ile
    // AYNI motorun ürettiği alanları gösterir.
    bytes: buildVpwPulseLog({ header: 0x68, data: [0x41, 0x0c, 0x1a, 0xf8] }),
    description: 'protocol.j1850.vpw.example.validFrame.description',
    expectedValid: true,
  },
  {
    id: 'no-data-frame',
    name: 'protocol.j1850.vpw.example.noDataFrame.name',
    bytes: buildVpwPulseLog({ header: 0x8a }),
    description: 'protocol.j1850.vpw.example.noDataFrame.description',
    expectedValid: true,
  },
  {
    id: 'bad-crc',
    name: 'protocol.j1850.vpw.example.badCrc.name',
    bytes: buildVpwPulseLog({ header: 0x68, data: [0x41, 0x0c, 0x1a, 0xf8], corruptCrc: true }),
    description: 'protocol.j1850.vpw.example.badCrc.description',
    expectedValid: false,
  },
  {
    id: 'truncated',
    name: 'protocol.j1850.vpw.example.truncated.name',
    // SOF + yalnız 5 veri nabzı (8'in katı değil).
    bytes: encodePulseLog([200, 64, 128, 64, 64, 128]),
    description: 'protocol.j1850.vpw.example.truncated.description',
    expectedValid: false,
  },
];

export const j1850VpwPlugin: ProtocolPlugin = {
  id: PROTOCOL_ID,
  name: PROTOCOL_DISPLAY_NAME,
  category: 'automotive',
  parser: j1850VpwParser,
  documentation: {
    summary: 'protocol.j1850.vpw.documentation.summary',
    layer: 'data-link',
  },
  exampleFrames: EXAMPLE_FRAMES,
  decodeOptions: DECODE_OPTIONS,
};
