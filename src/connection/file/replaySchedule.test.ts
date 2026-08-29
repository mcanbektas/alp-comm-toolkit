import { describe, expect, it } from 'vitest';

import { buildReplaySchedule, replayDurationMs } from './replaySchedule';

describe('buildReplaySchedule', () => {
  it('gerçek zamanlıda damgalar arası farkı korur', () => {
    expect(buildReplaySchedule([1000, 1100, 1400], { pacing: 'realtime' })).toEqual([0, 100, 400]);
  });

  it('hız çarpanı süreleri kısaltır', () => {
    expect(buildReplaySchedule([0, 100, 200], { pacing: 'realtime', speed: 2 })).toEqual([0, 50, 100]);
  });

  it('en küçük aralık iki kaydın tek çerçeveye yapışmasını engeller', () => {
    // Damgalar aynı: gerçek aralık 0, ama boşluksuz gönderim zaman tabanlı
    // çerçevelemede iki kaydı birleştirirdi.
    expect(buildReplaySchedule([50, 50, 50], { pacing: 'realtime', minimumGapMs: 5 })).toEqual([0, 5, 10]);
  });

  it('uzun sessizliği kırpar ama sırayı bozmaz', () => {
    expect(buildReplaySchedule([0, 600_000, 600_100], { pacing: 'realtime', maxGapMs: 250 })).toEqual([0, 250, 350]);
  });

  it('damgasız kayıtta sabit aralığa düşer, sıfır varsaymaz', () => {
    expect(buildReplaySchedule([undefined, undefined, undefined], { pacing: 'realtime', intervalMs: 20 })).toEqual([
      0, 20, 40,
    ]);
  });

  it('damgalar geri giderse aralığı sıfırlar, kayıt sırası korunur', () => {
    expect(buildReplaySchedule([1000, 900, 1000], { pacing: 'realtime' })).toEqual([0, 0, 100]);
  });

  it('sabit aralık kipinde damgaları yok sayar', () => {
    expect(buildReplaySchedule([0, 5000, 9000], { pacing: 'fixed-interval', intervalMs: 10 })).toEqual([0, 10, 20]);
  });

  it('anında kipinde her şeyi sıfıra yığar', () => {
    expect(buildReplaySchedule([0, 5000], { pacing: 'immediate' })).toEqual([0, 0]);
  });

  it('anında kipinde bile en küçük aralık uygulanır', () => {
    expect(buildReplaySchedule([0, 5000, 9000], { pacing: 'immediate', minimumGapMs: 2 })).toEqual([0, 2, 4]);
  });

  it('boş girdide boş çizelge ve sıfır süre döner', () => {
    expect(buildReplaySchedule([], { pacing: 'realtime' })).toEqual([]);
    expect(replayDurationMs([])).toBe(0);
  });

  it('süre son gönderim anıdır', () => {
    expect(replayDurationMs([0, 10, 25])).toBe(25);
  });
});
