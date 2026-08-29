import { describe, expect, it } from 'vitest';

import { createReverseEngineeringHandler } from './reverseEngineering.worker';
import { packFrames } from '../protocol-core/analysis/packedFrames';
import { ANALYSIS_PHASES } from '../protocol-core/analysis/report';
import type { ReverseEngineeringInMessage, ReverseEngineeringOutMessage } from './reverseEngineering.worker';
import type { AnalysisFrame } from '../protocol-core/analysis/types';

/** Fixture: spec 35060 RF telemetri seti. */
const RF_FRAMES: readonly AnalysisFrame[] = [
  { bytes: new Uint8Array([0xaa, 0xaa, 0x10, 0x00, 0x01, 0x53, 0x21]), timestamp: 1000 },
  { bytes: new Uint8Array([0xaa, 0xaa, 0x10, 0x00, 0x02, 0x61, 0x38]), timestamp: 1100 },
  { bytes: new Uint8Array([0xaa, 0xaa, 0x10, 0x00, 0x03, 0x14, 0xb7]), timestamp: 1200 },
];

/**
 * Gerçek Worker'da adımlar arasında kontrol makro göreve bırakılır; testte o
 * yer elle sürülen bir kuyruk. `drain` sırayla koşturur, `step` tek adım
 * ilerletir — iptalin adım ARASINDA görüldüğü böyle sınanır.
 */
function harness(): {
  send: (message: ReverseEngineeringInMessage) => void;
  posted: ReverseEngineeringOutMessage[];
  step: () => boolean;
  drain: () => void;
} {
  const queue: Array<() => void> = [];
  const posted: ReverseEngineeringOutMessage[] = [];
  const send = createReverseEngineeringHandler((message) => posted.push(message), {
    schedule: (task) => queue.push(task),
    now: () => 0,
  });

  function step(): boolean {
    const task = queue.shift();
    if (task === undefined) return false;
    task();
    return true;
  }

  return {
    send,
    posted,
    step,
    drain: () => {
      let guard = 0;
      while (step()) {
        guard += 1;
        if (guard > 1000) throw new Error('kuyruk bitmedi');
      }
    },
  };
}

describe('createReverseEngineeringHandler', () => {
  it('analizi bitirince raporu gönderir', () => {
    const { send, posted, drain } = harness();
    send({ type: 'analyze', requestId: 1, frames: packFrames(RF_FRAMES) });
    drain();

    const result = posted.find((message) => message.type === 'result');
    expect(result?.type).toBe('result');
    if (result?.type !== 'result') throw new Error('sonuç yok');
    expect(result.requestId).toBe(1);
    expect(result.report.frameCount).toBe(3);
    expect(result.report.completedPhases).toEqual([...ANALYSIS_PHASES]);
    expect(result.report.roles[4]?.role).toBe('counter-candidate');
  });

  it('her adım için ilerleme bildirir', () => {
    const { send, posted, drain } = harness();
    send({ type: 'analyze', requestId: 7, frames: packFrames(RF_FRAMES) });
    drain();

    const progress = posted.filter((message) => message.type === 'progress');
    expect(progress).toHaveLength(ANALYSIS_PHASES.length);
    const first = progress[0];
    if (first?.type !== 'progress') throw new Error('ilerleme yok');
    expect(first.phase).toBe('columns');
    expect(first.completed).toBe(1);
    expect(first.total).toBe(ANALYSIS_PHASES.length);
  });

  it('adım ARASINDA gelen iptali görür ve kısmi rapor döner', () => {
    const { send, posted, step, drain } = harness();
    send({ type: 'analyze', requestId: 2, frames: packFrames(RF_FRAMES) });
    step(); // columns
    step(); // clusters
    send({ type: 'cancel' });
    drain();

    const cancelled = posted.find((message) => message.type === 'cancelled');
    if (cancelled?.type !== 'cancelled') throw new Error('iptal yok');
    expect(cancelled.requestId).toBe(2);
    expect(cancelled.report.completedPhases).toEqual(['columns', 'clusters']);
    expect(posted.some((message) => message.type === 'result')).toBe(false);
  });

  it('iptal başka bir isteği vurmaz', () => {
    const { send, posted, drain } = harness();
    send({ type: 'analyze', requestId: 3, frames: packFrames(RF_FRAMES) });
    send({ type: 'cancel', requestId: 99 });
    drain();
    expect(posted.some((message) => message.type === 'result')).toBe(true);
    expect(posted.some((message) => message.type === 'cancelled')).toBe(false);
  });

  it('iptalden sonra yeni analiz koşar', () => {
    const { send, posted, step, drain } = harness();
    send({ type: 'analyze', requestId: 4, frames: packFrames(RF_FRAMES) });
    step();
    send({ type: 'cancel' });
    drain();
    send({ type: 'analyze', requestId: 5, frames: packFrames(RF_FRAMES) });
    drain();

    const result = posted.find((message) => message.type === 'result');
    if (result?.type !== 'result') throw new Error('sonuç yok');
    expect(result.requestId).toBe(5);
  });

  it('boş kümede çökmez', () => {
    const { send, posted, drain } = harness();
    send({ type: 'analyze', requestId: 6, frames: packFrames([]) });
    drain();
    const result = posted.find((message) => message.type === 'result');
    if (result?.type !== 'result') throw new Error('sonuç yok');
    expect(result.report.frameCount).toBe(0);
  });
});
