import { describe, expect, it, vi } from 'vitest';

import { runScenario } from './runner';
import { SCENARIO_FORMAT_VERSION } from './scenario';
import type { ScenarioIo } from './runner';
import type { TestScenario, TestStep } from './scenario';

/** Spec §43 custom protocol fixture'ı — XOR checksum bayt 1..6'yı kapsar, geçerli. */
const VALID_FRAME = new Uint8Array([0xaa, 0x05, 0x10, 0x03, 0x34, 0x12, 0x7f, 0x4f, 0x55]);
/** Aynı çerçeve, checksum'ı bozulmuş. */
const BAD_CRC_FRAME = new Uint8Array([0xaa, 0x05, 0x10, 0x03, 0x34, 0x12, 0x7f, 0x50, 0x55]);

interface FakeIo {
  readonly io: ScenarioIo;
  readonly calls: string[];
  readonly written: Uint8Array[];
}

/**
 * Sahte dış dünya. Zaman ilerlemez, port yok: koşucunun bütün dalları gerçek
 * bekleme olmadan koşar. `frames` sırayla verilir; `undefined` bir zaman
 * aşımıdır, dizi bitince de zaman aşımı gelir.
 */
function fakeIo(frames: readonly (Uint8Array | undefined)[] = [], overrides: Partial<ScenarioIo> = {}): FakeIo {
  const calls: string[] = [];
  const written: Uint8Array[] = [];
  const queue = [...frames];
  let clock = 1000;

  const io: ScenarioIo = {
    connect: async () => {
      calls.push('connect');
    },
    disconnect: async () => {
      calls.push('disconnect');
    },
    write: async (bytes) => {
      calls.push('write');
      written.push(bytes);
    },
    waitForFrame: async () => {
      calls.push('waitForFrame');
      const next = queue.shift();
      return next === undefined ? undefined : { bytes: next, receivedAt: clock };
    },
    sleep: async (durationMs) => {
      calls.push(`sleep:${durationMs}`);
      clock += durationMs;
    },
    encodeTemplate: async (templateId) => {
      calls.push(`encodeTemplate:${templateId}`);
      return Uint8Array.from([0x01, 0x02]);
    },
    encodePluginFrame: async (pluginId, payload) => {
      calls.push(`encodePluginFrame:${pluginId}`);
      // Sahte zarf: yükü iki bayrak arasına alır — gerçek encoder'ın
      // davranışını taklit etmez, koşucunun onu ÇAĞIRDIĞINI kanıtlar.
      return Uint8Array.from([0x7e, ...payload, 0x7e]);
    },
    abort: () => {
      calls.push('abort');
    },
    now: () => {
      clock += 1;
      return clock;
    },
    ...overrides,
  };

  return { io, calls, written };
}

function scenario(steps: readonly TestStep[], name = 'senaryo'): TestScenario {
  return { formatVersion: SCENARIO_FORMAT_VERSION, name, steps };
}

describe('runScenario — spec §38 örnek akışı', () => {
  it('bağlan → gönder → bekle → çerçeve bekle → CRC → alan doğrula zincirini geçer', async () => {
    const fake = fakeIo([VALID_FRAME]);
    const run = runScenario(
      scenario([
        { id: 's1', kind: 'connect' },
        { id: 's2', kind: 'send-frame', payload: { source: 'bytes', bytes: [0xaa, 0x31] } },
        { id: 's3', kind: 'wait', durationMs: 500 },
        { id: 's4', kind: 'wait-for-frame', timeoutMs: 500, match: { offset: 2, bytes: [0x10] } },
        { id: 's5', kind: 'validate-crc', algorithm: 'xor8', dataStart: 1, trailingOffset: 1, endianness: 'big' },
        {
          id: 's6',
          kind: 'set-variable',
          name: 'temperature',
          value: { kind: 'frame-field', offset: 4, width: 1, endianness: 'big' },
        },
        {
          id: 's7',
          kind: 'validate-field',
          condition: {
            kind: 'compare',
            left: { kind: 'variable', name: 'temperature' },
            operator: '<=',
            right: { kind: 'constant', value: 85 },
          },
        },
        { id: 's8', kind: 'log', message: 'sıcaklık {temperature}' },
        { id: 's9', kind: 'export-report' },
        { id: 's10', kind: 'disconnect' },
      ]),
      fake.io,
    );

    const report = await run.report;
    expect(report.status).toBe('passed');
    expect(report.failCount).toBe(0);
    expect(report.errorCount).toBe(0);
    expect(report.executedSteps).toBe(10);
    expect(fake.written[0]).toEqual(Uint8Array.from([0xaa, 0x31]));

    const crcRow = report.steps.find((step) => step.stepId === 's5');
    expect(crcRow?.outcome).toBe('pass');
    expect(crcRow?.expectedValue).toBe('0x4F');
    expect(crcRow?.receivedFrame).toBe('AA 05 10 03 34 12 7F 4F 55');

    // 0x34 = 52; §38'in "sıcaklığı oku" adımının karşılığı.
    expect(report.steps.find((step) => step.stepId === 's7')?.actualValue).toBe('52');
    expect(report.steps.find((step) => step.stepId === 's8')?.message).toBe('sıcaklık 52');
  });

  it('bozuk CRC adımı FAIL eder ve koşuyu durdurur', async () => {
    const fake = fakeIo([BAD_CRC_FRAME]);
    const run = runScenario(
      scenario([
        { id: 's1', kind: 'wait-for-frame', timeoutMs: 100, match: undefined },
        { id: 's2', kind: 'validate-crc', algorithm: 'xor8', dataStart: 1, trailingOffset: 1, endianness: 'big' },
        { id: 's3', kind: 'log', message: 'buraya gelmemeli' },
      ]),
      fake.io,
    );

    const report = await run.report;
    expect(report.status).toBe('failed');
    expect(report.failCount).toBe(1);
    expect(report.executedSteps).toBe(2);
    const crcRow = report.steps[1];
    expect(crcRow?.expectedValue).toBe('0x50');
    expect(crcRow?.actualValue).toBe('0x4F');
  });
});

describe('runScenario — zaman aşımı ve çözülemeyen koşul', () => {
  it('çerçeve gelmezse TIMEOUT sayar, hata değil', async () => {
    const fake = fakeIo([undefined]);
    const run = runScenario(
      scenario([{ id: 's1', kind: 'wait-for-frame', timeoutMs: 500, match: undefined }]),
      fake.io,
    );

    const report = await run.report;
    expect(report.timeoutCount).toBe(1);
    expect(report.errorCount).toBe(0);
    expect(report.status).toBe('failed');
    expect(report.steps[0]?.errorDetails).toBe('500 ms içinde çerçeve gelmedi');
  });

  it('filtreye uymayan çerçeve FAIL eder, sessizce kabul edilmez', async () => {
    const fake = fakeIo([VALID_FRAME]);
    const run = runScenario(
      scenario([{ id: 's1', kind: 'wait-for-frame', timeoutMs: 500, match: { offset: 2, bytes: [0x99] } }]),
      fake.io,
    );

    const report = await run.report;
    expect(report.steps[0]?.outcome).toBe('fail');
    expect(report.steps[0]?.errorDetails).toBe('gelen çerçeve filtreye uymuyor');
  });

  it('çerçeve alınmadan alan doğrulaması HATA verir, FAIL değil', async () => {
    const fake = fakeIo();
    const run = runScenario(
      scenario([
        {
          id: 's1',
          kind: 'validate-field',
          condition: {
            kind: 'compare',
            left: { kind: 'frame-field', offset: 4, width: 1, endianness: 'big' },
            operator: '<=',
            right: { kind: 'constant', value: 85 },
          },
        },
      ]),
      fake.io,
    );

    const report = await run.report;
    expect(report.errorCount).toBe(1);
    expect(report.failCount).toBe(0);
    expect(report.status).toBe('error');
  });

  it('tanımsız değişkeni artırmayı REDDEDER', async () => {
    const fake = fakeIo();
    const run = runScenario(scenario([{ id: 's1', kind: 'increment-variable', name: 'sayac', by: 1 }]), fake.io);
    const report = await run.report;
    expect(report.steps[0]?.errorDetails).toBe('değişken tanımsız: sayac');
  });
});

describe('runScenario — döngü ve koşul', () => {
  it('döngü turlarını numaralandırır', async () => {
    const fake = fakeIo();
    const run = runScenario(
      scenario([
        { id: 'init', kind: 'set-variable', name: 'sayac', value: { kind: 'constant', value: 0 } },
        {
          id: 'loop',
          kind: 'loop',
          count: 3,
          steps: [{ id: 'inc', kind: 'increment-variable', name: 'sayac', by: 1 }],
        },
        { id: 'log', kind: 'log', message: 'sayac={sayac}' },
      ]),
      fake.io,
    );

    const report = await run.report;
    expect(report.status).toBe('passed');
    const iterations = report.steps.filter((step) => step.stepId === 'inc').map((step) => step.iteration);
    expect(iterations).toEqual([1, 2, 3]);
    expect(report.steps.at(-1)?.message).toBe('sayac=3');
  });

  it('koşullu dal yalnız seçilen kolu koşar', async () => {
    const fake = fakeIo();
    const run = runScenario(
      scenario([
        { id: 'init', kind: 'set-variable', name: 'v', value: { kind: 'constant', value: 90 } },
        {
          id: 'branch',
          kind: 'conditional',
          condition: {
            kind: 'compare',
            left: { kind: 'variable', name: 'v' },
            operator: '>',
            right: { kind: 'constant', value: 85 },
          },
          thenSteps: [{ id: 'hot', kind: 'log', message: 'sıcak' }],
          elseSteps: [{ id: 'cold', kind: 'log', message: 'soğuk' }],
        },
      ]),
      fake.io,
    );

    const report = await run.report;
    expect(report.steps.find((step) => step.stepId === 'branch')?.actualValue).toBe('then');
    expect(report.steps.some((step) => step.stepId === 'hot')).toBe(true);
    expect(report.steps.some((step) => step.stepId === 'cold')).toBe(false);
  });

  it('çözülemeyen koşulda dal SEÇMEZ, hata verir', async () => {
    const fake = fakeIo();
    const run = runScenario(
      scenario([
        {
          id: 'branch',
          kind: 'conditional',
          condition: {
            kind: 'compare',
            left: { kind: 'variable', name: 'yok' },
            operator: '>',
            right: { kind: 'constant', value: 1 },
          },
          thenSteps: [{ id: 'a', kind: 'log', message: 'a' }],
          elseSteps: [{ id: 'b', kind: 'log', message: 'b' }],
        },
      ]),
      fake.io,
    );

    const report = await run.report;
    expect(report.status).toBe('error');
    expect(report.steps).toHaveLength(1);
  });
});

describe('runScenario — durma, bütçe, iptal', () => {
  it('stopOnFailure kapalıyken hatadan sonra devam eder', async () => {
    const fake = fakeIo([undefined]);
    const run = runScenario(
      scenario([
        { id: 's1', kind: 'wait-for-frame', timeoutMs: 10, match: undefined },
        { id: 's2', kind: 'log', message: 'devam' },
      ]),
      fake.io,
      { stopOnFailure: false },
    );

    const report = await run.report;
    expect(report.executedSteps).toBe(2);
    expect(report.status).toBe('failed');
  });

  it('adım bütçesi aşılınca koşuyu hata ile bitirir', async () => {
    const fake = fakeIo();
    const run = runScenario(
      scenario([
        { id: 'init', kind: 'set-variable', name: 'v', value: { kind: 'constant', value: 0 } },
        {
          id: 'loop',
          kind: 'loop',
          count: 100,
          steps: [{ id: 'inc', kind: 'increment-variable', name: 'v', by: 1 }],
        },
      ]),
      fake.io,
      { maxExecutedSteps: 10 },
    );

    const report = await run.report;
    expect(report.status).toBe('error');
    expect(report.steps.at(-1)?.errorDetails).toBe('adım bütçesi aşıldı (10)');
  });

  it('iptal koşuyu durdurur ve bekleyen çağrıları da iptal eder', async () => {
    let release: (() => void) | undefined;
    const fake = fakeIo([], {
      sleep: async () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
      abort: () => {
        release?.();
      },
    });

    const run = runScenario(
      scenario([
        { id: 's1', kind: 'wait', durationMs: 30_000 },
        { id: 's2', kind: 'log', message: 'buraya gelmemeli' },
      ]),
      fake.io,
    );

    // Bekleme başlasın diye bir mikro göreve bırak.
    await Promise.resolve();
    run.cancel();

    const report = await run.report;
    expect(report.status).toBe('cancelled');
    expect(report.steps.some((step) => step.stepId === 's2')).toBe(false);
  });
});

describe('runScenario — geçersiz senaryo', () => {
  it('geçersiz senaryoyu HİÇ koşmaz', async () => {
    const fake = fakeIo();
    const run = runScenario(
      scenario([
        { id: 's1', kind: 'connect' },
        { id: 's1', kind: 'disconnect' },
      ]),
      fake.io,
    );

    const report = await run.report;
    expect(report.status).toBe('error');
    expect(fake.calls).not.toContain('connect');
    expect(report.steps[0]?.errorDetails).toContain('tekrar ediyor');
  });
});

describe('runScenario — şablondan gönderim', () => {
  it('şablon çözümünü ScenarioIo\'ya devreder', async () => {
    const fake = fakeIo();
    const run = runScenario(
      scenario([{ id: 's1', kind: 'send-frame', payload: { source: 'template', templateId: 'status-request' } }]),
      fake.io,
    );

    const report = await run.report;
    expect(fake.calls).toContain('encodeTemplate:status-request');
    expect(report.steps[0]?.actualValue).toBe('01 02');
  });

  it('plugin-frame yükü protokolün kendi zarfına sardırır', async () => {
    const fake = fakeIo();
    const run = runScenario(
      scenario([
        {
          id: 's1',
          kind: 'send-frame',
          payload: { source: 'plugin-frame', pluginId: 'hdlc', bytes: [0x01, 0x02] },
        },
      ]),
      fake.io,
    );

    await run.report;

    expect(fake.calls).toContain('encodePluginFrame:hdlc');
    // Kabloya çıkan şey YÜK DEĞİL, zarfın kendisidir.
    expect(Array.from(fake.written[0] ?? [])).toEqual([0x7e, 0x01, 0x02, 0x7e]);
  });

  it('zarf çözülemezse adım HATA olur ve hiçbir bayt yazılmaz', async () => {
    const fake = fakeIo([], {
      encodePluginFrame: vi.fn(async () => {
        throw new Error('motor yüklenemedi');
      }),
    });
    const run = runScenario(
      scenario([
        { id: 's1', kind: 'send-frame', payload: { source: 'plugin-frame', pluginId: 'yok', bytes: [0x01] } },
      ]),
      fake.io,
    );

    const report = await run.report;

    expect(report.steps[0]?.outcome).toBe('error');
    expect(fake.written).toHaveLength(0);
  });

  it('şablon çözülemezse adım HATA olur', async () => {
    const fake = fakeIo([], {
      encodeTemplate: vi.fn(async () => {
        throw new Error('şablon bulunamadı');
      }),
    });
    const run = runScenario(
      scenario([{ id: 's1', kind: 'send-frame', payload: { source: 'template', templateId: 'yok' } }]),
      fake.io,
    );

    const report = await run.report;
    expect(report.steps[0]?.outcome).toBe('error');
    expect(report.steps[0]?.errorDetails).toBe('şablon bulunamadı');
  });
});
