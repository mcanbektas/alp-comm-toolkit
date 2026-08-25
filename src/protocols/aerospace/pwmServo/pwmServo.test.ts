import { describe, expect, it } from 'vitest';

import { MAX_PULSE_DURATION_US, encodePulseLog, pulseByteSpan } from '@/protocol-core/decoding/pulseLog';

import { computeCycleMetrics, parsePwmServo, pwmServoParser, pwmServoPlugin } from './pwmServo';
import type { ParseFailure, ParseResult, ParseSuccess, ParsedField, ParsedFrame } from '@/protocol-core/types';

function expectSuccess(result: ParseResult): ParseSuccess {
  if (!result.success) {
    throw new Error(`expected success, got error "${result.error.code}"`);
  }
  return result;
}

function expectFailure(result: ParseResult): ParseFailure {
  if (result.success) {
    throw new Error('expected failure, got a parsed frame');
  }
  return result;
}

function fieldById(frame: ParsedFrame, id: string): ParsedField {
  const found = frame.fields.find((field) => field.id === id);
  if (found === undefined) {
    throw new Error(`field "${id}" not found; got ${frame.fields.map((f) => f.id).join(', ')}`);
  }
  return found;
}

function buildPulseLog(durationsUs: readonly number[], reservedIndices: readonly number[] = []): Uint8Array {
  const bytes = encodePulseLog(durationsUs);
  for (const index of reservedIndices) {
    const span = pulseByteSpan(index, 1);
    bytes[span.offset] = 0;
    bytes[span.offset + 1] = 0;
  }
  return bytes;
}

describe('computeCycleMetrics — spec formülü (06-havacilik-uav.md:274-281), KONTEYNERDEN BAĞIMSIZ', () => {
  it('Period=20 ms, Pulse=1.5 ms → f=50 Hz, Duty=%7.5 (spec:281in TAM SAYILARI)', () => {
    // 18500 µs'lik LOW konteynere SIĞMAZ (dosya başı) — bu yüzden formül
    // SAF bir fonksiyon olarak, konteynerden bağımsız test edilir.
    const metrics = computeCycleMetrics(1500, 20000);
    expect(metrics.periodUs).toBe(20000);
    expect(metrics.frequencyHz).toBe(50);
    expect(metrics.dutyCyclePercent).toBe(7.5);
  });
});

describe('parsePwmServo — konteyner sözleşmesi hataları', () => {
  it('boş girdi truncated-frame döner', () => {
    expect(expectFailure(parsePwmServo(new Uint8Array())).error.code).toBe('truncated-frame');
  });

  it('tek uzunluk truncated-frame döner (madde 2)', () => {
    expect(expectFailure(parsePwmServo(new Uint8Array(3))).error.code).toBe('truncated-frame');
  });

  it('maxFrameLength aşılırsa frame-too-long döner', () => {
    const bytes = buildPulseLog([1500, 2000]);
    const result = expectFailure(pwmServoParser.parse(bytes, { maxFrameLength: bytes.length - 2 }));
    expect(result.error.code).toBe('frame-too-long');
  });

  it('iptal edilmiş signal’da parser-timeout döner', () => {
    const controller = new AbortController();
    controller.abort();
    const bytes = buildPulseLog([1500, 2000]);
    expect(
      expectFailure(pwmServoParser.parse(bytes, { signal: controller.signal })).error.code,
    ).toBe('parser-timeout');
  });
});

describe('parsePwmServo — tek çevrim, konteynerin İÇİNDE (temiz yol)', () => {
  it('HIGH=1500, LOW=2000 → Pulse Width/Period/Frequency/Duty Cycle TAM sayılarla çözülür', () => {
    const bytes = buildPulseLog([1500, 2000]);
    const { frame } = expectSuccess(parsePwmServo(bytes));

    expect(frame.valid).toBe(true);
    expect(fieldById(frame, 'cycle-0-pulse-width').physicalValue).toBe('1500.0');
    expect(fieldById(frame, 'cycle-0-pulse-width').unit).toBe('µs');
    expect(fieldById(frame, 'cycle-0-period').physicalValue).toBe('3500.0');
    // Frequency = 1e6/3500 ≈ 285.71 Hz; Duty = 1500/3500*100 ≈ 42.86 %.
    const metrics = computeCycleMetrics(1500, 3500);
    expect(fieldById(frame, 'cycle-0-frequency').physicalValue).toBe(metrics.frequencyHz.toFixed(2));
    expect(fieldById(frame, 'cycle-0-duty-cycle').physicalValue).toBe(metrics.dutyCyclePercent.toFixed(2));
    expect(fieldById(frame, 'cycle-0-frequency').unit).toBe('Hz');
    expect(fieldById(frame, 'cycle-0-duty-cycle').unit).toBe('%');
  });
});

describe('parsePwmServo — LOW doygun (ana thread kararının pwm-servo karşılığı, TİPİK VAKA)', () => {
  it('LOW hedefi 18500 µs iken register KIRPILIR; Period/Frequency/Duty Cycle YÖNÜ BELLİ birer SINIR olarak sunulur', () => {
    // Spec:281in KENDİ 20 ms/1.5 ms kalibrasyonu: HIGH=1500, LOW=18500 (period
    // 20000). 18500 > MAX_PULSE_DURATION_US → `encodePulseLog` register'ı
    // 0xffff'e KIRPAR — bu dosyanın "TİPİK VAKA" iddiasının somut kanıtı.
    const bytes = buildPulseLog([1500, 18500]);
    const { frame } = expectSuccess(parsePwmServo(bytes));

    const period = fieldById(frame, 'cycle-0-period');
    const frequency = fieldById(frame, 'cycle-0-frequency');
    const duty = fieldById(frame, 'cycle-0-duty-cycle');

    // Period ALT SINIRDIR ("≥"): gerçek LOW en az 6553.5 µs, muhtemelen daha uzun.
    expect(period.physicalValue).toMatch(/^≥ /);
    expect(Number(String(period.physicalValue).replace('≥ ', ''))).toBeCloseTo(1500 + MAX_PULSE_DURATION_US, 1);
    // Frequency/Duty Cycle ÜST SINIRDIR ("≤"): periyot alt sınırdan büyükse ikisi de küçülür.
    expect(frequency.physicalValue).toMatch(/^≤ /);
    expect(duty.physicalValue).toMatch(/^≤ /);

    expect(period.warnings).toContain('protocol.pwmServo.warning.pulseMayBeSaturated');
    expect(frame.warnings.some((w) => w.code === 'protocol.pwmServo.warning.pulseMayBeSaturated')).toBe(
      true,
    );
  });

  it('HIGH doygunsa (dejenere yakalama) periyot ailesi HİÇ ÜRETİLMEZ — yön belirsiz, uydurma YOK', () => {
    const bytes = buildPulseLog([9200, 2000]);
    const { frame } = expectSuccess(parsePwmServo(bytes));

    expect(fieldById(frame, 'cycle-0-pulse-width').physicalValue).toBe(`≥ ${MAX_PULSE_DURATION_US.toFixed(1)}`);
    expect(frame.fields.some((f) => f.id === 'cycle-0-period')).toBe(false);
    expect(frame.fields.some((f) => f.id === 'cycle-0-frequency')).toBe(false);
    expect(frame.fields.some((f) => f.id === 'cycle-0-duty-cycle')).toBe(false);
  });
});

describe('parsePwmServo — Missing Pulse (spec :272, rezerve DEĞİL doygunluktan AYRI durum)', () => {
  it('LOW rezerve (0) ise periyot ailesi üretilmez, missingPulse uyarır', () => {
    const bytes = buildPulseLog([1500, 2000], [1]);
    const { frame } = expectSuccess(parsePwmServo(bytes));

    expect(fieldById(frame, 'cycle-0-pulse-width').physicalValue).toBe('1500.0');
    expect(frame.fields.some((f) => f.id === 'cycle-0-period')).toBe(false);
    expect(frame.warnings.some((w) => w.code === 'protocol.pwmServo.warning.missingPulse')).toBe(true);
  });

  it('sondaki sarkan HIGH (eşi hiç YOK) missingPulse uyarır, yalnız Pulse Width basılır', () => {
    const bytes = buildPulseLog([1500, 2000, 1600]); // 3 nabız: 1 tam çevrim + sarkan HIGH.
    const { frame } = expectSuccess(parsePwmServo(bytes));

    expect(fieldById(frame, 'cycle-1-pulse-width').physicalValue).toBe('1600.0');
    expect(frame.fields.some((f) => f.id === 'cycle-1-period')).toBe(false);
    expect(frame.warnings.some((w) => w.code === 'protocol.pwmServo.warning.missingPulse')).toBe(true);
    // İlk çevrim (tam) etkilenmedi.
    expect(fieldById(frame, 'cycle-0-period').physicalValue).toBe('3500.0');
  });
});

describe('parsePwmServo — initialPulseLevel', () => {
  it('varsayılan (high): pulses[0]=HIGH, pulses[1]=LOW', () => {
    const bytes = buildPulseLog([1500, 2000, 1600, 2100]);
    const { frame } = expectSuccess(parsePwmServo(bytes));
    expect(fieldById(frame, 'cycle-0-pulse-width').physicalValue).toBe('1500.0');
    expect(fieldById(frame, 'cycle-1-pulse-width').physicalValue).toBe('1600.0');
    expect(fieldById(frame, 'initial-pulse-level').physicalValue).toBe('High');
  });

  it('low seçilirse pulses[0] sarkan LOW olur, çevrimler bir KAYAR', () => {
    const bytes = buildPulseLog([2000, 1500, 2100, 1600]);
    const { frame } = expectSuccess(pwmServoParser.parse(bytes, { options: { initialPulseLevel: 'low' } }));

    expect(fieldById(frame, 'leading-low').physicalValue).toBe('2000.0');
    expect(fieldById(frame, 'cycle-0-pulse-width').physicalValue).toBe('1500.0');
    expect(fieldById(frame, 'cycle-1-pulse-width').physicalValue).toBe('1600.0');
    expect(fieldById(frame, 'initial-pulse-level').physicalValue).toBe('Low');
    expect(frame.warnings.some((w) => w.code === 'protocol.pwmServo.warning.missingPulse')).toBe(true);
  });
});

describe('parsePwmServo — spec çalışılmış örneği (06-havacilik-uav.md:283, Servo Position)', () => {
  const CALIBRATION = { minPulseUs: 1000, centerPulseUs: 1500, maxPulseUs: 2000 };

  it('Min=1000/Center=1500/Max=2000: 1000→-100%, 1500→0%, 2000→+100% (uçlar)', () => {
    const bytes = buildPulseLog([1000, 2000, 1500, 2000, 2000, 2000]);
    const { frame } = expectSuccess(pwmServoParser.parse(bytes, { options: CALIBRATION }));
    expect(fieldById(frame, 'cycle-0-servo-position').physicalValue).toBe('-100.0');
    expect(fieldById(frame, 'cycle-1-servo-position').physicalValue).toBe('0.0');
    expect(fieldById(frame, 'cycle-2-servo-position').physicalValue).toBe('100.0');
    expect(fieldById(frame, 'cycle-0-servo-position').unit).toBe('%');
  });

  it('multi-channel örneği: Servo2=1230→-54.0%, Servo3=1782→+56.4%', () => {
    // Spec:283in KENDİ multi-channel örneği: Servo1=1501, Servo2=1230,
    // Servo3=1782, Servo4=1500 µs.
    const bytes = buildPulseLog([1501, 2000, 1230, 2000, 1782, 2000, 1500, 2000]);
    const { frame } = expectSuccess(pwmServoParser.parse(bytes, { options: CALIBRATION }));

    expect(fieldById(frame, 'cycle-1-servo-position').physicalValue).toBe('-54.0');
    expect(fieldById(frame, 'cycle-2-servo-position').physicalValue).toBe('56.4');
    expect(fieldById(frame, 'cycle-0-servo-position').physicalValue).toBe('0.2');
    expect(fieldById(frame, 'cycle-3-servo-position').physicalValue).toBe('0.0');
  });

  it('üç kalibrasyon değeri de verilmezse Servo Position alanı BASILMAZ', () => {
    const bytes = buildPulseLog([1230, 2000]);
    const { frame } = expectSuccess(parsePwmServo(bytes));
    expect(frame.fields.some((f) => f.id === 'cycle-0-servo-position')).toBe(false);
  });
});

describe('parsePwmServo — spec çalışılmış örneği (06-havacilik-uav.md:284, Jitter)', () => {
  it('HIGH = 1498, 1502, 1501, 1497, 1503 µs → Mean=1500.2, Peak-to-Peak=6', () => {
    const bytes = buildPulseLog([1498, 2000, 1502, 2000, 1501, 2000, 1497, 2000, 1503, 2000]);
    const { frame } = expectSuccess(parsePwmServo(bytes));

    expect(fieldById(frame, 'jitter-mean').physicalValue).toBe('1500.2');
    expect(fieldById(frame, 'jitter-peak-to-peak').physicalValue).toBe('6.0');
    const stdDev = Number(fieldById(frame, 'jitter-std-dev').physicalValue);
    expect(stdDev).toBeGreaterThan(2);
    expect(stdDev).toBeLessThan(3);
  });

  it('tek çevrim (N<2) varken jitter alanları BASILMAZ', () => {
    const bytes = buildPulseLog([1500, 2000]);
    const { frame } = expectSuccess(parsePwmServo(bytes));
    expect(frame.fields.some((f) => f.id.startsWith('jitter-'))).toBe(false);
  });
});

describe('parsePwmServo — expectedPeriodUs (Frame Period Error)', () => {
  it('sapma varsa Period Deviation alanı basılır ve framePeriodError uyarır', () => {
    const bytes = buildPulseLog([1500, 2000]); // period=3500
    const { frame } = expectSuccess(
      pwmServoParser.parse(bytes, { options: { expectedPeriodUs: 4000 } }),
    );
    expect(fieldById(frame, 'cycle-0-period-deviation').physicalValue).toBe('-500.0');
    expect(frame.warnings.some((w) => w.code === 'protocol.pwmServo.warning.framePeriodError')).toBe(true);
  });

  it('sapma YOKSA (tam eşleşme) Period Deviation 0.0 gösterir, uyarı BASILMAZ', () => {
    const bytes = buildPulseLog([1500, 2000]); // period=3500
    const { frame } = expectSuccess(
      pwmServoParser.parse(bytes, { options: { expectedPeriodUs: 3500 } }),
    );
    expect(fieldById(frame, 'cycle-0-period-deviation').physicalValue).toBe('0.0');
    expect(frame.warnings.some((w) => w.code === 'protocol.pwmServo.warning.framePeriodError')).toBe(
      false,
    );
  });

  it('expectedPeriodUs VERİLMEZSE Period Deviation alanı BASILMAZ', () => {
    const bytes = buildPulseLog([1500, 2000]);
    const { frame } = expectSuccess(parsePwmServo(bytes));
    expect(frame.fields.some((f) => f.id === 'cycle-0-period-deviation')).toBe(false);
  });
});

describe('parsePwmServo — canParse DAİMA false', () => {
  it('kendi ÖRNEK çerçevelerinin hiçbiri canParse’i geçmez', () => {
    for (const example of pwmServoPlugin.exampleFrames) {
      expect(pwmServoParser.canParse(example.bytes), example.id).toBe(false);
    }
  });

  it('boş/rastgele/çift-uzunluklu HERHANGİ bir bayt dizisi canParse’i geçmez', () => {
    expect(pwmServoParser.canParse(new Uint8Array())).toBe(false);
    expect(pwmServoParser.canParse(new Uint8Array(2))).toBe(false);
    expect(pwmServoParser.canParse(new Uint8Array([0xff, 0xff, 0xff, 0xff]))).toBe(false);
  });
});

describe('pwmServoPlugin — örnek çerçeveler', () => {
  it('her örnek beklenen success değerini döner', () => {
    for (const example of pwmServoPlugin.exampleFrames) {
      const result = pwmServoParser.parse(example.bytes);
      const expectedSuccess = example.id !== 'truncated';
      expect(result.success, `${example.id}: ${result.success ? '' : result.error.code}`).toBe(
        expectedSuccess,
      );
    }
  });

  it('id kümesi benzersizdir', () => {
    const ids = pwmServoPlugin.exampleFrames.map((example) => example.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('decodeOptions beş seçenek taşır, hepsinin defaultValue’su TANIMLI', () => {
    expect(pwmServoPlugin.decodeOptions?.length).toBe(5);
    for (const option of pwmServoPlugin.decodeOptions ?? []) {
      expect(option.defaultValue).toBeDefined();
    }
  });
});
