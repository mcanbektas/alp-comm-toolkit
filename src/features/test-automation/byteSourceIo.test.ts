import { describe, expect, it } from 'vitest';

import { createByteSourceIo } from './byteSourceIo';
import { runScenario } from './runner';
import { SCENARIO_FORMAT_VERSION } from './scenario';
import { createSimulatedDevice } from '../../connection/mock/simulatedDevice';
import type { TestScenario, TestStep } from './scenario';

/**
 * Uçtan uca tur: koşucu → `ScenarioIo` → `streamBuffer` → simüle cihaz.
 * Sahte zamanlayıcı YOK; gecikmeler milisaniyelik, gerçek zaman akıyor —
 * kuyruk/bekleme yarışları ancak böyle görünür.
 */

/** Spec §43 custom protocol fixture'ı; 9 bayt, XOR checksum geçerli. */
const DEVICE_RESPONSE = [0xaa, 0x05, 0x10, 0x03, 0x34, 0x12, 0x7f, 0x4f, 0x55];
const STATUS_REQUEST = [0xaa, 0x01];

function scenario(steps: readonly TestStep[]): TestScenario {
  return { formatVersion: SCENARIO_FORMAT_VERSION, name: 'uçtan uca', steps };
}

function deviceIo(rules: Parameters<typeof createSimulatedDevice>[0]['rules'], maxChunkSize?: number) {
  const source = createSimulatedDevice(maxChunkSize === undefined ? { rules } : { rules, maxChunkSize });
  return createByteSourceIo({
    source,
    // Sabit uzunluk seçildi: cevabın 9 baytı belli, çerçeve sınırı tartışmasız.
    framing: { method: 'fixed-length', frameLength: DEVICE_RESPONSE.length },
  });
}

describe('createByteSourceIo — simüle cihazla uçtan uca', () => {
  it('istek gönderir, yanıtı çerçeveler, CRC ve alanı doğrular', async () => {
    const io = deviceIo([{ match: { offset: 0, bytes: STATUS_REQUEST }, response: DEVICE_RESPONSE, delayMs: 5 }]);

    const run = runScenario(
      scenario([
        { id: 'c', kind: 'connect' },
        { id: 's', kind: 'send-frame', payload: { source: 'bytes', bytes: STATUS_REQUEST } },
        { id: 'w', kind: 'wait-for-frame', timeoutMs: 1000, match: { offset: 2, bytes: [0x10] } },
        { id: 'crc', kind: 'validate-crc', algorithm: 'xor8', dataStart: 1, trailingOffset: 1, endianness: 'big' },
        {
          id: 'v',
          kind: 'validate-field',
          condition: {
            kind: 'compare',
            left: { kind: 'frame-field', offset: 4, width: 1, endianness: 'big' },
            operator: '<=',
            right: { kind: 'constant', value: 85 },
          },
        },
        { id: 'd', kind: 'disconnect' },
      ]),
      io,
    );

    const report = await run.report;
    expect(report.status).toBe('passed');
    expect(report.steps.find((step) => step.stepId === 'w')?.receivedFrame).toBe('AA 05 10 03 34 12 7F 4F 55');
    expect(report.steps.find((step) => step.stepId === 'crc')?.outcome).toBe('pass');
    await io.dispose();
  });

  it('parçalı gelen yanıtı tek çerçevede birleştirir', async () => {
    const io = deviceIo([{ response: DEVICE_RESPONSE, delayMs: 1 }], 2);

    const run = runScenario(
      scenario([
        { id: 'c', kind: 'connect' },
        { id: 's', kind: 'send-frame', payload: { source: 'bytes', bytes: STATUS_REQUEST } },
        { id: 'w', kind: 'wait-for-frame', timeoutMs: 1000, match: undefined },
      ]),
      io,
    );

    const report = await run.report;
    expect(report.steps.find((step) => step.stepId === 'w')?.receivedFrame).toBe('AA 05 10 03 34 12 7F 4F 55');
    await io.dispose();
  });

  it('BEKLEMEDEN ÖNCE gelen çerçeveyi kaybetmez', async () => {
    const io = deviceIo([{ response: DEVICE_RESPONSE, delayMs: 1 }]);

    const run = runScenario(
      scenario([
        { id: 'c', kind: 'connect' },
        { id: 's', kind: 'send-frame', payload: { source: 'bytes', bytes: STATUS_REQUEST } },
        // Yanıt bu bekleme sırasında gelir; `waitForFrame` çağrılmadan önce.
        { id: 'sleep', kind: 'wait', durationMs: 40 },
        { id: 'w', kind: 'wait-for-frame', timeoutMs: 50, match: undefined },
      ]),
      io,
    );

    const report = await run.report;
    expect(report.status).toBe('passed');
    await io.dispose();
  });

  it('cihaz susarsa zaman aşımına düşer', async () => {
    const io = deviceIo([{ match: { offset: 0, bytes: [0xbb] }, response: DEVICE_RESPONSE }]);

    const run = runScenario(
      scenario([
        { id: 'c', kind: 'connect' },
        { id: 's', kind: 'send-frame', payload: { source: 'bytes', bytes: STATUS_REQUEST } },
        { id: 'w', kind: 'wait-for-frame', timeoutMs: 30, match: undefined },
      ]),
      io,
    );

    const report = await run.report;
    expect(report.timeoutCount).toBe(1);
    await io.dispose();
  });

  it('filtreye uymayan çerçeveyi atar ve eşleşeni bekler', async () => {
    const io = deviceIo([
      { match: { offset: 0, bytes: [0xaa, 0x02] }, response: [0xaa, 0x05, 0x99, 0x03, 0x00, 0x00, 0x00, 0x00, 0x55], delayMs: 1 },
      { match: { offset: 0, bytes: STATUS_REQUEST }, response: DEVICE_RESPONSE, delayMs: 1 },
    ]);

    const run = runScenario(
      scenario([
        { id: 'c', kind: 'connect' },
        { id: 's1', kind: 'send-frame', payload: { source: 'bytes', bytes: [0xaa, 0x02] } },
        { id: 's2', kind: 'send-frame', payload: { source: 'bytes', bytes: STATUS_REQUEST } },
        { id: 'sleep', kind: 'wait', durationMs: 40 },
        { id: 'w', kind: 'wait-for-frame', timeoutMs: 100, match: { offset: 2, bytes: [0x10] } },
      ]),
      io,
    );

    const report = await run.report;
    expect(report.status).toBe('passed');
    expect(report.steps.find((step) => step.stepId === 'w')?.receivedFrame).toBe('AA 05 10 03 34 12 7F 4F 55');
    // Atılan çerçeve SESSİZCE yutulmaz, sayılır.
    expect(io.droppedFrames).toBe(1);
    await io.dispose();
  });

  it('yazamayan kaynakta gönderimi sessizce başarılı SAYMAZ', async () => {
    const io = createByteSourceIo({
      source: {
        kind: 'simulated',
        canWrite: false,
        start: async () => undefined,
        stop: async () => undefined,
        write: async () => undefined,
      },
      framing: { method: 'fixed-length', frameLength: 4 },
    });

    const run = runScenario(
      scenario([
        { id: 'c', kind: 'connect' },
        { id: 's', kind: 'send-frame', payload: { source: 'bytes', bytes: STATUS_REQUEST } },
      ]),
      io,
    );

    const report = await run.report;
    expect(report.steps[1]?.outcome).toBe('error');
    expect(report.steps[1]?.errorDetails).toBe('kaynak yazma yönünü desteklemiyor');
    await io.dispose();
  });

  it('iptal bekleyen çerçeve beklemesini hemen çözer', async () => {
    const io = deviceIo([]);
    const run = runScenario(
      scenario([
        { id: 'c', kind: 'connect' },
        { id: 'w', kind: 'wait-for-frame', timeoutMs: 30_000, match: undefined },
      ]),
      io,
    );

    // Bekleme kurulsun diye zamanlayıcıya bir tur bırak.
    await new Promise((resolve) => setTimeout(resolve, 20));
    run.cancel();

    const report = await run.report;
    expect(report.status).toBe('cancelled');
    await io.dispose();
  });
});
