/**
 * Gönderim zamanlayıcısı — spec §10'un "Periyodik gönderme / N kere gönderme /
 * Response bekleme" maddeleri. SAF TypeScript: React yok, DOM'a yalnız varsayılan
 * zamanlayıcı üzerinden dokunur ve o da enjekte edilebilir.
 *
 * `createStreamBuffer()` (`@/protocol-core/streams/streamBuffer.ts`) ve
 * `createProtocolRegistry()` ile AYNI desen: kapatma yakalayan fabrika fonksiyonu,
 * `class` DEĞİL.
 *
 * ### Neden bu varsayılanlar
 * Spec periyot/tekrar/timeout için sayı vermiyor; tek ipucu §38'in örnek test
 * senaryosu ("Wait up to 500 ms", "Repeat 100 times"). Bu yüzden:
 *
 * - `defaultIntervalMs = 1000` — insanın akan listeyi izleyebildiği hız; saniyede
 *   bir çerçeve hem seri portu hem arayüzü rahat bırakır.
 * - `minIntervalMs = 10` — altında tarayıcı `setTimeout`u zaten kısıtlar (iç içe
 *   zamanlayıcılarda 4 ms taban, arka plan sekmesinde 1000 ms'e kadar seyreltme)
 *   ve 115200 8N1'de 10 ms ≈ 115 bayt, yani daha sık gönderim seri portu doyurur:
 *   söz verilen periyot tutmaz, kuyruk şişer.
 * - `maxIntervalMs = 3_600_000` (1 saat) — daha uzun bekleme sekme uykuya
 *   dalabileceği için zamanlayıcıyla değil, kullanıcı tetiğiyle yapılmalı.
 * - `defaultCount = 10` — §38'in 100'ü bir test koşusudur; elle deneme için 10 tur
 *   yeterli, yanlışlıkla 100 çerçeve göndermek kadar da sürprizli değil.
 * - `minCount = 1`, `maxCount = 1_000_000` — üst sınır spec §41'in "sonsuz loop
 *   engelle" maddesinin sayıya dökülmüş hâli: 'count' modu SONLU kalmalı, sınırsız
 *   tekrar isteyen 'periodic' seçip elle durdurur.
 * - `defaultResponseTimeoutMs = 500` — §38'in kendi verdiği tek sayı.
 *
 * ### Değişmezler
 * 1. ÖRTÜŞME YOK: bir gönderim sürerken sonraki tetiklenmez. Bir sonraki zamanlayıcı
 *    ancak önceki `send` ÇÖZÜLDÜKTEN sonra kurulur. Aksi hâlde yavaş bir seri portta
 *    (ya da yanıt bekleyen bir gönderimde) kuyruk sınırsız şişer.
 *    Sonucu: aralık, gönderim çözüldükten SONRA başlar — sabit hızlı (fixed-rate)
 *    değil, gerçek periyot `intervalMs` + gönderim süresidir. Bu bilinçli tercihtir;
 *    kaçırılan turu telafi etmek örtüşme yasağını çiğnerdi.
 * 2. `stop()` çağrıldıktan sonra bekleyen `send` çözülse bile YENİ zamanlayıcı
 *    kurulmaz, `sentCount` de artmaz: her `start`/`stop` bir NESİL (generation)
 *    sayacını artırır, eski nesle ait geri çağrılar sessizce düşer. Bayrak yerine
 *    sayaç, çünkü "durdur → yeniden başlat" arasında bekleyen eski gönderimin yeni
 *    döngüyü kirletmemesi gerekir (spec §41 "Worker cancellation").
 * 3. `send` reddederse zamanlayıcı DURUR ve `lastErrorKey` dolar — sessizce devam
 *    etmek, kopmuş bir portu fark ettirmeden yüzlerce hata üretirdi.
 * 4. 'once' tek gönderim; 'count' N gönderimden sonra kendiliğinden durur;
 *    'periodic' `stop()` gelene kadar sürer.
 * 5. Aynı scheduler yeniden `start` edilirse önce içten iptal koşar — iki döngü
 *    aynı anda dönemez.
 *
 * Sahibi (bileşen/worker) sayfa kapanışında ya da bağlantı düşünce `stop()`
 * ÇAĞIRMAK ZORUNDADIR; nesil sayacı geç çözülen gönderimleri etkisizleştirse de
 * bekleyen zamanlayıcıyı yalnız `stop()` temizler.
 */

export type SendMode = 'once' | 'count' | 'periodic';

export interface SendSchedulerConfig {
  readonly mode: SendMode;
  readonly intervalMs: number;
  readonly count: number;
}

export interface SendSchedulerState {
  readonly running: boolean;
  /** BAŞARIYLA çözülen gönderim sayısı — başlatılan değil. Reddedilen gönderim sayılmaz. */
  readonly sentCount: number;
  /** Çeviri anahtarı; ham hata metni ASLA taşınmaz (görünen metin koda gömülmez kuralı). */
  readonly lastErrorKey: string | null;
}

export interface SendSchedulerDeps {
  /** `index` 0 tabanlıdır: ilk gönderim 0. Sequence counter / alan artırma bunu kullanır (spec §10). */
  readonly send: (index: number) => Promise<void>;
  readonly onStateChange: (state: SendSchedulerState) => void;
  /** Test için enjekte edilebilir; verilmezse `globalThis.setTimeout`. */
  readonly setTimer?: (fn: () => void, ms: number) => number;
  readonly clearTimer?: (handle: number) => void;
}

export interface SendScheduler {
  readonly start: (config: SendSchedulerConfig) => void;
  readonly stop: () => void;
  readonly getState: () => SendSchedulerState;
}

export const SCHEDULER_LIMITS: {
  readonly minIntervalMs: number;
  readonly maxIntervalMs: number;
  readonly minCount: number;
  readonly maxCount: number;
  readonly defaultIntervalMs: number;
  readonly defaultCount: number;
  readonly defaultResponseTimeoutMs: number;
} = {
  minIntervalMs: 10,
  maxIntervalMs: 3_600_000,
  minCount: 1,
  maxCount: 1_000_000,
  defaultIntervalMs: 1000,
  defaultCount: 10,
  defaultResponseTimeoutMs: 500,
};

/**
 * Gönderim hatası için genel anahtar. Çağıran daha keskin bir sebebi
 * `new Error('packetBuilder.scheduler.errors.portClosed')` gibi NOKTALI bir anahtar
 * fırlatarak yükseltebilir; serbest metinli (yerelleştirilemez) hatalar buraya düşer.
 */
const DEFAULT_ERROR_KEY = 'packetBuilder.scheduler.errors.sendFailed';

/** Boşluksuz, en az bir noktalı, harfle başlayan dizge = çeviri anahtarı sayılır. */
const TRANSLATION_KEY_PATTERN = /^[A-Za-z][A-Za-z0-9]*(?:\.[A-Za-z0-9][A-Za-z0-9]*)+$/;

const KNOWN_MODES: readonly string[] = ['once', 'count', 'periodic'];

/**
 * Varsayılan zamanlayıcı. `Number(...)` sarmalaması Node'un `Timeout` nesnesi
 * içindir (testler/worker dışı koşumlar): `Symbol.toPrimitive` ile sayısal id'ye
 * döner, tarayıcıda zaten sayıdır. `globalThis` kullanılıyor çünkü bu modül
 * Web Worker içinde de koşabilir — orada `window` yoktur.
 */
function defaultSetTimer(fn: () => void, ms: number): number {
  return Number(globalThis.setTimeout(fn, ms));
}

function defaultClearTimer(handle: number): void {
  globalThis.clearTimeout(handle);
}

function clampNumber(value: number, min: number, max: number, fallback: number): number {
  // NaN/Infinity (bozuk proje dosyası ya da boş form alanı) sınıra değil VARSAYILANA düşer:
  // NaN'ı sınıra çekmek kullanıcının "boş bıraktım" niyetini 10 ms'lik gönderime çevirirdi.
  if (!Number.isFinite(value)) return fallback;
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function resolveErrorKey(reason: unknown): string {
  if (reason instanceof Error && TRANSLATION_KEY_PATTERN.test(reason.message)) return reason.message;
  if (typeof reason === 'string' && TRANSLATION_KEY_PATTERN.test(reason)) return reason;
  return DEFAULT_ERROR_KEY;
}

/**
 * Yapılandırmayı güvenli aralığa çeker. Saf fonksiyon: form alanı da, kaydedilmiş
 * proje dosyası da buradan geçer. `mode` bilinmeyen bir dizgeyse (eski/bozuk proje
 * dosyası) 'once'a düşer — en güvenli mod, tek gönderim, döngü riski yok.
 * `count` mod'dan bağımsız normalize edilir; 'once' modunda değeri yok sayılır.
 */
export function clampSchedulerConfig(config: SendSchedulerConfig): SendSchedulerConfig {
  const mode: SendMode = KNOWN_MODES.includes(config.mode) ? config.mode : 'once';
  return {
    mode,
    intervalMs: clampNumber(config.intervalMs, SCHEDULER_LIMITS.minIntervalMs, SCHEDULER_LIMITS.maxIntervalMs, SCHEDULER_LIMITS.defaultIntervalMs),
    // Kesirli tekrar sayısı anlamsız. Yuvarlama sınır kontrolünden ÖNCE yapılır:
    // aksi hâlde 1_000_000.6 gibi bir değer önce sınıra çekilir, sonra yuvarlanır ve
    // üst sınırın 1 üstüne çıkardı. NaN yuvarlanınca NaN kalır, varsayılana düşer.
    count: clampNumber(Math.round(config.count), SCHEDULER_LIMITS.minCount, SCHEDULER_LIMITS.maxCount, SCHEDULER_LIMITS.defaultCount),
  };
}

export function createSendScheduler(deps: SendSchedulerDeps): SendScheduler {
  const setTimer = deps.setTimer ?? defaultSetTimer;
  const clearTimer = deps.clearTimer ?? defaultClearTimer;

  // Nesil: her start/stop/doğal bitiş artırır. Bekleyen `send` ya da zamanlayıcı
  // geri çağrısı kendi neslini taşır; eşleşmiyorsa hiçbir şey yapmaz.
  let generation = 0;
  let timerHandle: number | null = null;
  let activeConfig: SendSchedulerConfig | null = null;
  let state: SendSchedulerState = { running: false, sentCount: 0, lastErrorKey: null };

  function setState(next: SendSchedulerState): void {
    state = next;
    deps.onStateChange(state);
  }

  /** Durumu YAYMADAN döngüyü keser — yeniden `start` bunu kullanır ki araya sahte bir "durdu" geçişi girmesin. */
  function cancelPending(): void {
    generation += 1;
    activeConfig = null;
    if (timerHandle !== null) {
      clearTimer(timerHandle);
      timerHandle = null;
    }
  }

  /** `errorKey` olduğu gibi yazılır: sade `stop()` mevcut anahtarı KORUR, yalnız `start()` temizler. */
  function halt(errorKey: string | null): void {
    const changed = state.running || errorKey !== state.lastErrorKey;
    cancelPending();
    // Zaten duran ve hata anahtarı değişmeyen bir zamanlayıcıda dinleyiciyi
    // rahatsız etmeyiz — `stop()` idempotenttir.
    if (!changed) return;
    setState({ running: false, sentCount: state.sentCount, lastErrorKey: errorKey });
  }

  function onSendSettled(myGeneration: number, config: SendSchedulerConfig): void {
    if (myGeneration !== generation) return; // 2. değişmez: iptal edilmiş turun sonucu sayılmaz
    const sentCount = state.sentCount + 1;
    const finished = config.mode === 'once' || (config.mode === 'count' && sentCount >= config.count);
    if (finished) {
      cancelPending();
      setState({ running: false, sentCount, lastErrorKey: state.lastErrorKey });
      return;
    }
    setState({ running: true, sentCount, lastErrorKey: state.lastErrorKey });
    // 1. değişmez: sonraki zamanlayıcı ANCAK burada, önceki gönderim çözüldükten sonra kurulur.
    timerHandle = setTimer(() => {
      timerHandle = null;
      dispatch(myGeneration);
    }, config.intervalMs);
  }

  function dispatch(myGeneration: number): void {
    if (myGeneration !== generation) return;
    const config = activeConfig;
    if (config === null) return;

    let pending: Promise<void>;
    try {
      // `send` senkron fırlatabilir (ör. port kapalıyken yazma denemesi); o yol da
      // reddetme yoluyla aynı yere, `halt`a gitmeli.
      pending = deps.send(state.sentCount);
    } catch (reason) {
      halt(resolveErrorKey(reason));
      return;
    }

    pending.then(
      () => {
        onSendSettled(myGeneration, config);
      },
      (reason: unknown) => {
        if (myGeneration !== generation) return;
        halt(resolveErrorKey(reason));
      },
    );
  }

  return {
    start(config: SendSchedulerConfig): void {
      // 5. değişmez: yeniden başlatma önce içten iptal koşar.
      cancelPending();
      const clamped = clampSchedulerConfig(config);
      activeConfig = clamped;
      const myGeneration = generation;
      // İlk gönderim HEMEN yapılır: 1 saniyelik varsayılan aralıkta önce beklemek,
      // "Başlat"a basan kullanıcıya arayüz tepkisizmiş gibi görünürdü.
      setState({ running: true, sentCount: 0, lastErrorKey: null });
      dispatch(myGeneration);
    },
    stop(): void {
      halt(state.lastErrorKey);
    },
    getState(): SendSchedulerState {
      return state;
    },
  };
}

/**
 * Response bekleme (spec §10) — `subscribe` ile gelen İLK bayt paketini döndürür,
 * `timeoutMs` dolarsa `null`.
 *
 * Abone HER YOLDA temizlenir (yanıt, timeout, senkron yayın): sızdırılan bir dinleyici
 * 100 turluk bir test senaryosunda 100 canlı abone bırakır ve her gelen çerçeve için
 * hepsi koşar. `subscribe`ın dinleyiciyi SENKRON çağırdığı durum ayrıca ele alınır —
 * o anda `unsubscribe` henüz elimizde değildir.
 */
export function waitForResponse(
  subscribe: (listener: (bytes: Uint8Array) => void) => () => void,
  timeoutMs: number,
  setTimer: (fn: () => void, ms: number) => number = defaultSetTimer,
  clearTimer: (handle: number) => void = defaultClearTimer,
): Promise<Uint8Array | null> {
  // Negatif/NaN süre (boş form alanı) bekleme yerine varsayılana düşer; 0 geçerlidir.
  const effectiveTimeoutMs = Number.isFinite(timeoutMs) && timeoutMs >= 0 ? timeoutMs : SCHEDULER_LIMITS.defaultResponseTimeoutMs;

  return new Promise<Uint8Array | null>((resolve) => {
    let settled = false;
    let timerHandle: number | null = null;
    let unsubscribe: (() => void) | null = null;

    function finish(value: Uint8Array | null): void {
      // İkinci bayt paketi ya da geç ateşleyen timeout sonucu DEĞİŞTİRMEZ.
      if (settled) return;
      settled = true;
      if (timerHandle !== null) {
        clearTimer(timerHandle);
        timerHandle = null;
      }
      if (unsubscribe !== null) {
        unsubscribe();
        unsubscribe = null;
      }
      resolve(value);
    }

    const dispose = subscribe((bytes) => {
      finish(bytes);
    });

    if (settled) {
      // Senkron yayın: `finish` koştuğunda `dispose` daha ortada yoktu, aboneliği
      // burada kapatıyoruz. Zamanlayıcı da hiç kurulmuyor — kuracak iş kalmadı.
      dispose();
      return;
    }

    unsubscribe = dispose;
    timerHandle = setTimer(() => {
      timerHandle = null;
      finish(null);
    }, effectiveTimeoutMs);
  });
}
