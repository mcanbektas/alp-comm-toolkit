import { describe, expect, it } from 'vitest';

import { SCHEDULER_LIMITS, clampSchedulerConfig, createSendScheduler, waitForResponse } from './sendScheduler';
import type { SendSchedulerConfig, SendSchedulerState } from './sendScheduler';

/**
 * `vi.useFakeTimers()` KULLANILMIYOR: zamanlayıcı enjekte edilebilir olduğu için
 * hangi geri çağrının kurulduğunu, hangi gecikmeyle ve kaç tanesinin bekler
 * durumda kaldığını doğrudan gözlemleyebiliyoruz — sahte saat ilerletmenin
 * dolaylılığı ve "kaç tur mikro-görev kaldı" belirsizliği olmadan.
 */
interface TimerHarness {
  readonly setTimer: (fn: () => void, ms: number) => number;
  readonly clearTimer: (handle: number) => void;
  /** Kurulan zamanlayıcıların gecikmeleri, kuruluş sırasıyla. */
  readonly delays: readonly number[];
  readonly clearedHandles: readonly number[];
  readonly pendingCount: () => number;
  /** Bekleyen ilk zamanlayıcıyı ateşler. */
  readonly runNext: () => void;
  /** İptal edilmiş olsa BİLE bir geri çağrıyı ateşler — "eski nesil" senaryosu için. */
  readonly forceRun: (handle: number) => void;
}

function createTimerHarness(): TimerHarness {
  const delays: number[] = [];
  const clearedHandles: number[] = [];
  const pending = new Map<number, () => void>();
  const created = new Map<number, () => void>();
  let nextHandle = 1;

  return {
    setTimer(fn: () => void, ms: number): number {
      const handle = nextHandle;
      nextHandle += 1;
      delays.push(ms);
      pending.set(handle, fn);
      created.set(handle, fn);
      return handle;
    },
    clearTimer(handle: number): void {
      clearedHandles.push(handle);
      pending.delete(handle);
    },
    delays,
    clearedHandles,
    pendingCount: () => pending.size,
    runNext(): void {
      const first = Array.from(pending.entries())[0];
      if (first === undefined) throw new Error('bekleyen zamanlayıcı yok');
      pending.delete(first[0]);
      first[1]();
    },
    forceRun(handle: number): void {
      const fn = created.get(handle);
      if (fn === undefined) throw new Error(`zamanlayıcı ${handle} hiç kurulmadı`);
      pending.delete(handle);
      fn();
    },
  };
}

/** Söz (promise) zincirinin çözülmesi için birkaç mikro-görev turu. */
async function flush(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

interface SendHarness {
  readonly send: (index: number) => Promise<void>;
  /** `send`e geçilen index'ler, çağrı sırasıyla. */
  readonly calls: readonly number[];
  readonly resolveAt: (callIndex: number) => Promise<void>;
  readonly rejectAt: (callIndex: number, reason: unknown) => Promise<void>;
}

/** Elle çözülen gönderim: "gönderim sürerken" durumunu test kontrol eder. */
function createSendHarness(): SendHarness {
  const calls: number[] = [];
  const settlers: Array<{ resolve: () => void; reject: (reason: unknown) => void }> = [];

  function settlerAt(callIndex: number): { resolve: () => void; reject: (reason: unknown) => void } {
    const settler = settlers[callIndex];
    if (settler === undefined) throw new Error(`${callIndex}. gönderim hiç başlamadı`);
    return settler;
  }

  return {
    calls,
    send(index: number): Promise<void> {
      calls.push(index);
      return new Promise<void>((resolve, reject) => {
        settlers.push({ resolve, reject });
      });
    },
    async resolveAt(callIndex: number): Promise<void> {
      settlerAt(callIndex).resolve();
      await flush();
    },
    async rejectAt(callIndex: number, reason: unknown): Promise<void> {
      settlerAt(callIndex).reject(reason);
      await flush();
    },
  };
}

function config(overrides: Partial<SendSchedulerConfig> = {}): SendSchedulerConfig {
  return { mode: 'periodic', intervalMs: 100, count: 3, ...overrides };
}

describe('clampSchedulerConfig', () => {
  it('sınırlar içindeki değerleri değiştirmeden döndürür', () => {
    expect(clampSchedulerConfig({ mode: 'count', intervalMs: 250, count: 42 })).toEqual({ mode: 'count', intervalMs: 250, count: 42 });
  });

  it('intervalMs alt sınırın altındaysa 10 ms yapılır (tarayıcı kısıtı + seri port doyumu)', () => {
    expect(clampSchedulerConfig(config({ intervalMs: 5 })).intervalMs).toBe(10);
    expect(clampSchedulerConfig(config({ intervalMs: 0 })).intervalMs).toBe(10);
    expect(clampSchedulerConfig(config({ intervalMs: -400 })).intervalMs).toBe(10);
  });

  it('intervalMs üst sınırın üstündeyse 1 saate çekilir', () => {
    expect(clampSchedulerConfig(config({ intervalMs: 5_000_000 })).intervalMs).toBe(3_600_000);
  });

  it('sayı olmayan intervalMs sınıra değil VARSAYILANA düşer', () => {
    expect(clampSchedulerConfig(config({ intervalMs: Number.NaN })).intervalMs).toBe(1000);
    expect(clampSchedulerConfig(config({ intervalMs: Number.POSITIVE_INFINITY })).intervalMs).toBe(1000);
  });

  it('count alt sınırı 1', () => {
    expect(clampSchedulerConfig(config({ count: 0 })).count).toBe(1);
    expect(clampSchedulerConfig(config({ count: -9 })).count).toBe(1);
  });

  it('count üst sınırı 1_000_000 (spec §41 sonsuz loop engeli)', () => {
    expect(clampSchedulerConfig(config({ count: 2_500_000 })).count).toBe(1_000_000);
    expect(clampSchedulerConfig(config({ count: 1_000_000.6 })).count).toBe(1_000_000);
  });

  it('kesirli count yuvarlanır', () => {
    expect(clampSchedulerConfig(config({ count: 3.6 })).count).toBe(4);
    expect(clampSchedulerConfig(config({ count: 0.4 })).count).toBe(1);
  });

  it('sayı olmayan count varsayılan 10 olur', () => {
    expect(clampSchedulerConfig(config({ count: Number.NaN })).count).toBe(10);
  });

  it('bilinmeyen mod (bozuk proje dosyası) en güvenli mod olan once a düşer', () => {
    // Kaydedilmiş bir proje dosyasından gelen, artık tanınmayan mod: tip sistemi
    // dışından geldiği için çift dönüşümle üretiliyor.
    const persisted = { mode: 'loop-forever', intervalMs: 100, count: 5 } as unknown as SendSchedulerConfig;
    expect(clampSchedulerConfig(persisted).mode).toBe('once');
  });

  it('SCHEDULER_LIMITS belgelenen değerleri taşır', () => {
    expect(SCHEDULER_LIMITS).toEqual({
      minIntervalMs: 10,
      maxIntervalMs: 3_600_000,
      minCount: 1,
      maxCount: 1_000_000,
      defaultIntervalMs: 1000,
      defaultCount: 10,
      defaultResponseTimeoutMs: 500,
    });
  });
});

describe('createSendScheduler — temel akış', () => {
  it('start ilk gönderimi HEMEN (senkron) yapar ve durumu running yayınlar', () => {
    const timers = createTimerHarness();
    const sender = createSendHarness();
    const states: SendSchedulerState[] = [];
    const scheduler = createSendScheduler({ send: sender.send, onStateChange: (state) => states.push(state), setTimer: timers.setTimer, clearTimer: timers.clearTimer });

    scheduler.start(config({ mode: 'periodic' }));

    expect(sender.calls).toEqual([0]);
    expect(states[0]).toEqual({ running: true, sentCount: 0, lastErrorKey: null });
    expect(timers.delays).toHaveLength(0);
  });

  it('once modu tek gönderimden sonra kendiliğinden durur ve zamanlayıcı kurmaz', async () => {
    const timers = createTimerHarness();
    const sender = createSendHarness();
    const scheduler = createSendScheduler({ send: sender.send, onStateChange: () => {}, setTimer: timers.setTimer, clearTimer: timers.clearTimer });

    scheduler.start(config({ mode: 'once' }));
    await sender.resolveAt(0);

    expect(scheduler.getState()).toEqual({ running: false, sentCount: 1, lastErrorKey: null });
    expect(timers.delays).toHaveLength(0);
    expect(timers.pendingCount()).toBe(0);
    expect(sender.calls).toEqual([0]);
  });

  it('once modu count değerini yok sayar', async () => {
    const timers = createTimerHarness();
    const sender = createSendHarness();
    const scheduler = createSendScheduler({ send: sender.send, onStateChange: () => {}, setTimer: timers.setTimer, clearTimer: timers.clearTimer });

    scheduler.start(config({ mode: 'once', count: 50 }));
    await sender.resolveAt(0);

    expect(sender.calls).toEqual([0]);
    expect(scheduler.getState().running).toBe(false);
  });

  it('getState onStateChange ile yayınlanan son durumu döndürür', async () => {
    const timers = createTimerHarness();
    const sender = createSendHarness();
    const states: SendSchedulerState[] = [];
    const scheduler = createSendScheduler({ send: sender.send, onStateChange: (state) => states.push(state), setTimer: timers.setTimer, clearTimer: timers.clearTimer });

    scheduler.start(config({ mode: 'once' }));
    await sender.resolveAt(0);

    expect(states.at(-1)).toEqual(scheduler.getState());
  });

  it('start yapılandırmayı clamp eder: 1 ms istenirse zamanlayıcı 10 ms ile kurulur', async () => {
    const timers = createTimerHarness();
    const sender = createSendHarness();
    const scheduler = createSendScheduler({ send: sender.send, onStateChange: () => {}, setTimer: timers.setTimer, clearTimer: timers.clearTimer });

    scheduler.start(config({ mode: 'periodic', intervalMs: 1 }));
    await sender.resolveAt(0);

    expect(timers.delays).toEqual([10]);
  });
});

describe('createSendScheduler — örtüşme yasağı', () => {
  it('gönderim SÜRERKEN sonraki zamanlayıcı KURULMAZ', async () => {
    const timers = createTimerHarness();
    const sender = createSendHarness();
    const scheduler = createSendScheduler({ send: sender.send, onStateChange: () => {}, setTimer: timers.setTimer, clearTimer: timers.clearTimer });

    scheduler.start(config({ mode: 'periodic', intervalMs: 100 }));
    await flush(); // bekleyen gönderim çözülmüyor; sadece mikro-görev turu geçiyor

    expect(timers.delays).toHaveLength(0);
    expect(sender.calls).toEqual([0]);
  });

  it('zamanlayıcı ancak önceki gönderim ÇÖZÜLDÜKTEN sonra ve tek tane kurulur', async () => {
    const timers = createTimerHarness();
    const sender = createSendHarness();
    const scheduler = createSendScheduler({ send: sender.send, onStateChange: () => {}, setTimer: timers.setTimer, clearTimer: timers.clearTimer });

    scheduler.start(config({ mode: 'periodic', intervalMs: 100 }));
    await sender.resolveAt(0);

    expect(timers.delays).toEqual([100]);
    expect(timers.pendingCount()).toBe(1);
  });

  it('zamanlayıcı ateşlenince sıradaki gönderim artan index ile yapılır', async () => {
    const timers = createTimerHarness();
    const sender = createSendHarness();
    const scheduler = createSendScheduler({ send: sender.send, onStateChange: () => {}, setTimer: timers.setTimer, clearTimer: timers.clearTimer });

    scheduler.start(config({ mode: 'periodic', intervalMs: 100 }));
    await sender.resolveAt(0);
    timers.runNext();
    expect(sender.calls).toEqual([0, 1]);

    await sender.resolveAt(1);
    timers.runNext();
    expect(sender.calls).toEqual([0, 1, 2]);
    expect(scheduler.getState().sentCount).toBe(2);
  });

  it('periodic durdurulana kadar sürer: 5 tur sonra hâlâ çalışıyordur', async () => {
    const timers = createTimerHarness();
    const sender = createSendHarness();
    const scheduler = createSendScheduler({ send: sender.send, onStateChange: () => {}, setTimer: timers.setTimer, clearTimer: timers.clearTimer });

    scheduler.start(config({ mode: 'periodic', intervalMs: 100, count: 2 }));
    for (let turn = 0; turn < 5; turn += 1) {
      await sender.resolveAt(turn);
      timers.runNext();
    }

    // count=2 verilmiş olsa da periodic modda tekrar sayısı bağlayıcı değildir.
    expect(sender.calls).toEqual([0, 1, 2, 3, 4, 5]);
    expect(scheduler.getState().running).toBe(true);
  });
});

describe('createSendScheduler — count modu', () => {
  it('tam N gönderim yapar ve kendiliğinden durur', async () => {
    const timers = createTimerHarness();
    const sender = createSendHarness();
    const scheduler = createSendScheduler({ send: sender.send, onStateChange: () => {}, setTimer: timers.setTimer, clearTimer: timers.clearTimer });

    scheduler.start(config({ mode: 'count', count: 3, intervalMs: 20 }));
    await sender.resolveAt(0);
    timers.runNext();
    await sender.resolveAt(1);
    timers.runNext();
    await sender.resolveAt(2);

    expect(sender.calls).toEqual([0, 1, 2]);
    expect(scheduler.getState()).toEqual({ running: false, sentCount: 3, lastErrorKey: null });
  });

  it('N tamamlanınca bekleyen zamanlayıcı BIRAKMAZ', async () => {
    const timers = createTimerHarness();
    const sender = createSendHarness();
    const scheduler = createSendScheduler({ send: sender.send, onStateChange: () => {}, setTimer: timers.setTimer, clearTimer: timers.clearTimer });

    scheduler.start(config({ mode: 'count', count: 2, intervalMs: 20 }));
    await sender.resolveAt(0);
    timers.runNext();
    await sender.resolveAt(1);

    expect(timers.pendingCount()).toBe(0);
    expect(timers.delays).toEqual([20]); // yalnız birinci ile ikinci gönderim arası
  });

  it('count=1 tek gönderimle biter', async () => {
    const timers = createTimerHarness();
    const sender = createSendHarness();
    const scheduler = createSendScheduler({ send: sender.send, onStateChange: () => {}, setTimer: timers.setTimer, clearTimer: timers.clearTimer });

    scheduler.start(config({ mode: 'count', count: 1 }));
    await sender.resolveAt(0);

    expect(sender.calls).toEqual([0]);
    expect(scheduler.getState()).toEqual({ running: false, sentCount: 1, lastErrorKey: null });
  });
});

describe('createSendScheduler — iptal (spec §41)', () => {
  it('stop bekleyen zamanlayıcıyı temizler ve running=false yayınlar', async () => {
    const timers = createTimerHarness();
    const sender = createSendHarness();
    const scheduler = createSendScheduler({ send: sender.send, onStateChange: () => {}, setTimer: timers.setTimer, clearTimer: timers.clearTimer });

    scheduler.start(config({ mode: 'periodic' }));
    await sender.resolveAt(0);
    expect(timers.pendingCount()).toBe(1);

    scheduler.stop();

    expect(timers.clearedHandles).toHaveLength(1);
    expect(timers.pendingCount()).toBe(0);
    expect(scheduler.getState()).toEqual({ running: false, sentCount: 1, lastErrorKey: null });
  });

  it('stop sonrası bekleyen gönderim ÇÖZÜLSE bile yeni zamanlayıcı kurulmaz ve sentCount artmaz', async () => {
    const timers = createTimerHarness();
    const sender = createSendHarness();
    const states: SendSchedulerState[] = [];
    const scheduler = createSendScheduler({ send: sender.send, onStateChange: (state) => states.push(state), setTimer: timers.setTimer, clearTimer: timers.clearTimer });

    scheduler.start(config({ mode: 'periodic' }));
    scheduler.stop(); // gönderim hâlâ uçuşta
    const stateCountAfterStop = states.length;
    await sender.resolveAt(0);

    expect(timers.delays).toHaveLength(0);
    expect(sender.calls).toEqual([0]);
    expect(scheduler.getState()).toEqual({ running: false, sentCount: 0, lastErrorKey: null });
    expect(states).toHaveLength(stateCountAfterStop); // geç çözülme hiçbir durum yaymaz
  });

  it('stop sonrası bekleyen gönderim REDDEDİLSE bile lastErrorKey dolmaz', async () => {
    const timers = createTimerHarness();
    const sender = createSendHarness();
    const scheduler = createSendScheduler({ send: sender.send, onStateChange: () => {}, setTimer: timers.setTimer, clearTimer: timers.clearTimer });

    scheduler.start(config({ mode: 'periodic' }));
    scheduler.stop();
    await sender.rejectAt(0, new Error('port kapandı'));

    expect(scheduler.getState().lastErrorKey).toBeNull();
  });

  it('iptal edilmiş ESKİ neslin zamanlayıcısı yine de ateşlense gönderim tetiklemez', async () => {
    const timers = createTimerHarness();
    const sender = createSendHarness();
    const scheduler = createSendScheduler({ send: sender.send, onStateChange: () => {}, setTimer: timers.setTimer, clearTimer: timers.clearTimer });

    scheduler.start(config({ mode: 'periodic' }));
    await sender.resolveAt(0);
    scheduler.stop();

    // Nesil sayacı, clearTimer atlanmış olsa dahi ikinci savunma hattıdır.
    timers.forceRun(1);

    expect(sender.calls).toEqual([0]);
    expect(scheduler.getState().running).toBe(false);
  });

  it('stop idempotenttir: durum değişmiyorsa dinleyici tekrar çağrılmaz', () => {
    const timers = createTimerHarness();
    const sender = createSendHarness();
    const states: SendSchedulerState[] = [];
    const scheduler = createSendScheduler({ send: sender.send, onStateChange: (state) => states.push(state), setTimer: timers.setTimer, clearTimer: timers.clearTimer });

    scheduler.start(config({ mode: 'periodic' }));
    scheduler.stop();
    const afterFirstStop = states.length;
    scheduler.stop();
    scheduler.stop();

    expect(states).toHaveLength(afterFirstStop);
  });

  it('hiç başlatılmamış scheduler durdurulunca durum yaymaz', () => {
    const timers = createTimerHarness();
    const sender = createSendHarness();
    const states: SendSchedulerState[] = [];
    const scheduler = createSendScheduler({ send: sender.send, onStateChange: (state) => states.push(state), setTimer: timers.setTimer, clearTimer: timers.clearTimer });

    scheduler.stop();

    expect(states).toHaveLength(0);
    expect(scheduler.getState()).toEqual({ running: false, sentCount: 0, lastErrorKey: null });
  });

  it('stop mevcut lastErrorKey i KORUR (hata kullanıcı görene kadar durur)', async () => {
    const timers = createTimerHarness();
    const sender = createSendHarness();
    const scheduler = createSendScheduler({ send: sender.send, onStateChange: () => {}, setTimer: timers.setTimer, clearTimer: timers.clearTimer });

    scheduler.start(config({ mode: 'periodic' }));
    await sender.rejectAt(0, new Error('kablo çekildi'));
    scheduler.stop();

    expect(scheduler.getState().lastErrorKey).toBe('packetBuilder.scheduler.errors.sendFailed');
  });
});

describe('createSendScheduler — hata yolu', () => {
  it('send reddederse zamanlayıcı DURUR, sessizce devam etmez', async () => {
    const timers = createTimerHarness();
    const sender = createSendHarness();
    const scheduler = createSendScheduler({ send: sender.send, onStateChange: () => {}, setTimer: timers.setTimer, clearTimer: timers.clearTimer });

    scheduler.start(config({ mode: 'periodic' }));
    await sender.rejectAt(0, new Error('yazma başarısız'));

    expect(scheduler.getState().running).toBe(false);
    expect(timers.delays).toHaveLength(0);
    expect(sender.calls).toEqual([0]);
  });

  it('reddedilen gönderim sentCount u artırmaz', async () => {
    const timers = createTimerHarness();
    const sender = createSendHarness();
    const scheduler = createSendScheduler({ send: sender.send, onStateChange: () => {}, setTimer: timers.setTimer, clearTimer: timers.clearTimer });

    scheduler.start(config({ mode: 'count', count: 5, intervalMs: 20 }));
    await sender.resolveAt(0);
    timers.runNext();
    await sender.rejectAt(1, new Error('yazma başarısız'));

    expect(scheduler.getState().sentCount).toBe(1);
  });

  it('send SENKRON fırlatırsa da durur ve hata anahtarı dolar', () => {
    const timers = createTimerHarness();
    const states: SendSchedulerState[] = [];
    const scheduler = createSendScheduler({
      send: () => {
        throw new Error('port açık değil');
      },
      onStateChange: (state) => states.push(state),
      setTimer: timers.setTimer,
      clearTimer: timers.clearTimer,
    });

    scheduler.start(config({ mode: 'periodic' }));

    expect(scheduler.getState()).toEqual({ running: false, sentCount: 0, lastErrorKey: 'packetBuilder.scheduler.errors.sendFailed' });
    expect(timers.delays).toHaveLength(0);
  });

  it('noktalı hata mesajı çeviri anahtarı olarak taşınır', async () => {
    const timers = createTimerHarness();
    const sender = createSendHarness();
    const scheduler = createSendScheduler({ send: sender.send, onStateChange: () => {}, setTimer: timers.setTimer, clearTimer: timers.clearTimer });

    scheduler.start(config({ mode: 'periodic' }));
    await sender.rejectAt(0, new Error('packetBuilder.scheduler.errors.portClosed'));

    expect(scheduler.getState().lastErrorKey).toBe('packetBuilder.scheduler.errors.portClosed');
  });

  it('serbest metinli (yerelleştirilemez) hata genel anahtara düşer', async () => {
    const timers = createTimerHarness();
    const sender = createSendHarness();
    const scheduler = createSendScheduler({ send: sender.send, onStateChange: () => {}, setTimer: timers.setTimer, clearTimer: timers.clearTimer });

    scheduler.start(config({ mode: 'periodic' }));
    await sender.rejectAt(0, 'NetworkError: The device has been lost.');

    expect(scheduler.getState().lastErrorKey).toBe('packetBuilder.scheduler.errors.sendFailed');
  });
});

describe('createSendScheduler — yeniden başlatma', () => {
  it('yeniden start önce içten durdurur: eski zamanlayıcı temizlenir, sayaç sıfırlanır', async () => {
    const timers = createTimerHarness();
    const sender = createSendHarness();
    const scheduler = createSendScheduler({ send: sender.send, onStateChange: () => {}, setTimer: timers.setTimer, clearTimer: timers.clearTimer });

    scheduler.start(config({ mode: 'periodic', intervalMs: 100 }));
    await sender.resolveAt(0);
    expect(scheduler.getState().sentCount).toBe(1);

    scheduler.start(config({ mode: 'periodic', intervalMs: 200 }));

    expect(timers.clearedHandles).toEqual([1]);
    expect(scheduler.getState()).toEqual({ running: true, sentCount: 0, lastErrorKey: null });
    expect(sender.calls).toEqual([0, 0]); // yeni döngü index'i baştan başlatır
  });

  it('yeniden start sonrası ESKİ neslin bekleyen gönderimi yeni döngüyü kirletmez', async () => {
    const timers = createTimerHarness();
    const sender = createSendHarness();
    const scheduler = createSendScheduler({ send: sender.send, onStateChange: () => {}, setTimer: timers.setTimer, clearTimer: timers.clearTimer });

    scheduler.start(config({ mode: 'periodic', intervalMs: 100 }));
    scheduler.start(config({ mode: 'periodic', intervalMs: 100 }));
    await sender.resolveAt(0); // birinci neslin uçuştaki gönderimi geç çözülüyor

    expect(timers.delays).toHaveLength(0); // yalnız ikinci nesil zamanlayıcı kurabilir
    expect(scheduler.getState().sentCount).toBe(0);

    await sender.resolveAt(1); // ikinci neslin gönderimi
    expect(timers.delays).toEqual([100]);
    expect(scheduler.getState().sentCount).toBe(1);
  });

  it('start lastErrorKey i sıfırlar', async () => {
    const timers = createTimerHarness();
    const sender = createSendHarness();
    const scheduler = createSendScheduler({ send: sender.send, onStateChange: () => {}, setTimer: timers.setTimer, clearTimer: timers.clearTimer });

    scheduler.start(config({ mode: 'periodic' }));
    await sender.rejectAt(0, new Error('yazma başarısız'));
    expect(scheduler.getState().lastErrorKey).not.toBeNull();

    scheduler.start(config({ mode: 'periodic' }));

    expect(scheduler.getState()).toEqual({ running: true, sentCount: 0, lastErrorKey: null });
  });
});

describe('createSendScheduler — enjekte edilmemiş zamanlayıcı', () => {
  it('setTimer verilmezse gerçek zamanlayıcıyla çalışır ve stop ile kesin durur', async () => {
    const calls: number[] = [];
    let resolveSecond: (() => void) | null = null;
    const secondSend = new Promise<void>((resolve) => {
      resolveSecond = resolve;
    });

    const scheduler = createSendScheduler({
      send: (index: number) => {
        calls.push(index);
        if (index === 1 && resolveSecond !== null) resolveSecond();
        return Promise.resolve();
      },
      onStateChange: () => {},
    });

    scheduler.start({ mode: 'periodic', intervalMs: 10, count: 1 });
    await secondSend;
    scheduler.stop();
    const callsAtStop = calls.length;

    await new Promise<void>((resolve) => {
      setTimeout(resolve, 40);
    });

    expect(callsAtStop).toBeGreaterThanOrEqual(2);
    expect(calls).toHaveLength(callsAtStop); // durdurduktan sonra tek bir gönderim bile olmadı
  });
});

describe('waitForResponse', () => {
  interface SubscribeHarness {
    readonly subscribe: (listener: (bytes: Uint8Array) => void) => () => void;
    readonly emit: (bytes: Uint8Array) => void;
    readonly unsubscribeCount: () => number;
    readonly listenerCount: () => number;
  }

  function createSubscribeHarness(emitSynchronously?: Uint8Array): SubscribeHarness {
    const listeners = new Set<(bytes: Uint8Array) => void>();
    let unsubscribeCount = 0;
    return {
      subscribe(listener: (bytes: Uint8Array) => void): () => void {
        listeners.add(listener);
        // Bazı taşıyıcılar arabellekte bekleyen veriyi abone olur olmaz teslim eder.
        if (emitSynchronously !== undefined) listener(emitSynchronously);
        return () => {
          unsubscribeCount += 1;
          listeners.delete(listener);
        };
      },
      emit(bytes: Uint8Array): void {
        for (const listener of listeners) listener(bytes);
      },
      unsubscribeCount: () => unsubscribeCount,
      listenerCount: () => listeners.size,
    };
  }

  it('ilk gelen baytları döndürür', async () => {
    const timers = createTimerHarness();
    const source = createSubscribeHarness();
    const pending = waitForResponse(source.subscribe, 500, timers.setTimer, timers.clearTimer);

    source.emit(Uint8Array.from([0x31, 0x2a]));

    expect(await pending).toEqual(Uint8Array.from([0x31, 0x2a]));
  });

  it('yanıt gelince abone temizlenir (sızıntı yok)', async () => {
    const timers = createTimerHarness();
    const source = createSubscribeHarness();
    const pending = waitForResponse(source.subscribe, 500, timers.setTimer, timers.clearTimer);

    source.emit(Uint8Array.from([0x01]));
    await pending;

    expect(source.unsubscribeCount()).toBe(1);
    expect(source.listenerCount()).toBe(0);
  });

  it('yanıt gelince bekleyen timeout zamanlayıcısı temizlenir', async () => {
    const timers = createTimerHarness();
    const source = createSubscribeHarness();
    const pending = waitForResponse(source.subscribe, 500, timers.setTimer, timers.clearTimer);
    expect(timers.delays).toEqual([500]);

    source.emit(Uint8Array.from([0x01]));
    await pending;

    expect(timers.pendingCount()).toBe(0);
    expect(timers.clearedHandles).toEqual([1]);
  });

  it('timeout dolunca null döner', async () => {
    const timers = createTimerHarness();
    const source = createSubscribeHarness();
    const pending = waitForResponse(source.subscribe, 500, timers.setTimer, timers.clearTimer);

    timers.runNext();

    expect(await pending).toBeNull();
  });

  it('timeout yolunda da abone temizlenir', async () => {
    const timers = createTimerHarness();
    const source = createSubscribeHarness();
    const pending = waitForResponse(source.subscribe, 500, timers.setTimer, timers.clearTimer);

    timers.runNext();
    await pending;

    expect(source.unsubscribeCount()).toBe(1);
    expect(source.listenerCount()).toBe(0);
  });

  it('ilk yanıttan sonraki ikinci yayın sonucu değiştirmez ve ikinci kez abonelik kapatmaz', async () => {
    const timers = createTimerHarness();
    const source = createSubscribeHarness();
    const pending = waitForResponse(source.subscribe, 500, timers.setTimer, timers.clearTimer);

    source.emit(Uint8Array.from([0xaa]));
    source.emit(Uint8Array.from([0xbb]));

    expect(await pending).toEqual(Uint8Array.from([0xaa]));
    expect(source.unsubscribeCount()).toBe(1);
  });

  it('timeout sonrası gelen yanıt null sonucunu değiştirmez', async () => {
    const timers = createTimerHarness();
    const source = createSubscribeHarness();
    const pending = waitForResponse(source.subscribe, 500, timers.setTimer, timers.clearTimer);

    timers.runNext();
    source.emit(Uint8Array.from([0xff]));

    expect(await pending).toBeNull();
  });

  it('subscribe dinleyiciyi SENKRON çağırırsa abone yine temizlenir ve zamanlayıcı hiç kurulmaz', async () => {
    const timers = createTimerHarness();
    const source = createSubscribeHarness(Uint8Array.from([0x7e]));
    const pending = waitForResponse(source.subscribe, 500, timers.setTimer, timers.clearTimer);

    expect(await pending).toEqual(Uint8Array.from([0x7e]));
    expect(source.unsubscribeCount()).toBe(1);
    expect(source.listenerCount()).toBe(0);
    expect(timers.delays).toHaveLength(0);
  });

  it('geçersiz timeoutMs varsayılan 500 ms ile kurulur', () => {
    const timers = createTimerHarness();
    const source = createSubscribeHarness();
    void waitForResponse(source.subscribe, Number.NaN, timers.setTimer, timers.clearTimer);
    void waitForResponse(source.subscribe, -10, timers.setTimer, timers.clearTimer);

    expect(timers.delays).toEqual([500, 500]);
  });

  it('timeoutMs 0 geçerlidir (beklemeden bakma)', () => {
    const timers = createTimerHarness();
    const source = createSubscribeHarness();
    void waitForResponse(source.subscribe, 0, timers.setTimer, timers.clearTimer);

    expect(timers.delays).toEqual([0]);
  });
});
