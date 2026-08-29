/**
 * Dosya oynatmanın ZAMAN ÇİZELGESİ — spec §8.1 "Dosya oynatma" bağlantı
 * kaynağının saf çekirdeği. Zamanlayıcı (`setTimeout`) burada YOKTUR: çizelge
 * önce sayı olarak üretilir, kaynak onu sürer. Böylece "hangi kayıt ne zaman
 * gönderilir" sorusu sahte saat kurmadan test edilebilir.
 *
 * ── EN KÜÇÜK ARALIK NEDEN VAR ─────────────────────────────────────────────
 * Kayıt tabanlı bir log (candump, pcap) zaten ÇERÇEVELERDEN oluşur; monitör
 * ise gelen baytları kendi çerçeveleme ayarıyla böler. İki kaydı arka arkaya
 * boşluksuz göndermek, zaman tabanlı bir çerçeveleme ayarında (ör.
 * `inter-frame-timeout`) ikisini TEK çerçeveye yapıştırırdı — dosyada iki
 * satır olan şey ekranda bir satır olurdu. `minimumGapMs` bu yüzden var ve
 * çağıran onu çerçeveleme ayarının zaman aşımından türetir.
 *
 * ── EN BÜYÜK ARALIK NEDEN VAR ─────────────────────────────────────────────
 * Gerçek loglarda dakikalarca sessizlik olur. Bunu birebir oynatmak kullanıcıyı
 * boş ekrana baktırır; `maxGapMs` sessizliği kırpar. Kırpma zaman damgalarını
 * DEĞİŞTİRMEZ — yalnız gönderim anını öne çeker; kayıtların kendi damgaları
 * `receivedAt` olarak olduğu gibi taşınır.
 */

export type ReplayPacing = 'realtime' | 'fixed-interval' | 'immediate';

export interface ReplayScheduleOptions {
  readonly pacing: ReplayPacing;
  /** `realtime` hız çarpanı; 2 = iki kat hızlı. Pozitif olmalı. */
  readonly speed?: number;
  /** `fixed-interval` kayıtlar arası sabit süre. */
  readonly intervalMs?: number;
  /** İki kayıt arasında GARANTİ edilen en küçük boşluk. */
  readonly minimumGapMs?: number;
  /** Bir boşluğun kırpılacağı üst sınır. */
  readonly maxGapMs?: number;
}

const DEFAULT_INTERVAL_MS = 10;
const DEFAULT_SPEED = 1;

/**
 * Kayıt başına GÖNDERİM ANINI (ms, ilk kayıttan itibaren) üretir. Dönen dizi
 * kayıt dizisiyle aynı uzunlukta ve azalmayan sıradadır.
 *
 * `timestamps` içindeki `undefined` "bu kaydın zamanı bilinmiyor" demektir
 * (damgasız log); o kayıt için gerçek zamanlı aralık hesaplanamaz, sabit
 * aralığa düşülür — sıfır varsaymak bütün kayıtları tek ana yığardı.
 */
export function buildReplaySchedule(
  timestamps: readonly (number | undefined)[],
  options: ReplayScheduleOptions,
): number[] {
  const speed = options.speed !== undefined && options.speed > 0 ? options.speed : DEFAULT_SPEED;
  const intervalMs = options.intervalMs ?? DEFAULT_INTERVAL_MS;
  const minimumGapMs = options.minimumGapMs ?? 0;
  const maxGapMs = options.maxGapMs;

  const offsets: number[] = [];
  let elapsed = 0;
  let previousTimestamp: number | undefined;

  for (let index = 0; index < timestamps.length; index++) {
    const timestamp = timestamps[index];

    if (index === 0) {
      offsets.push(0);
      previousTimestamp = timestamp;
      continue;
    }

    let gap: number;
    if (options.pacing === 'immediate') {
      gap = 0;
    } else if (options.pacing === 'fixed-interval') {
      gap = intervalMs;
    } else if (timestamp === undefined || previousTimestamp === undefined) {
      gap = intervalMs;
    } else {
      // Damgalar geri gidebilir (birleştirilmiş loglar): negatif aralık
      // sıfırlanır, kayıtların SIRASI korunur.
      gap = Math.max(0, timestamp - previousTimestamp) / speed;
    }

    if (maxGapMs !== undefined) gap = Math.min(gap, maxGapMs);
    gap = Math.max(gap, minimumGapMs);

    elapsed += gap;
    offsets.push(elapsed);
    if (timestamp !== undefined) previousTimestamp = timestamp;
  }

  return offsets;
}

/** Çizelgenin toplam süresi (ms); boş listede 0. */
export function replayDurationMs(offsets: readonly number[]): number {
  return offsets.length === 0 ? 0 : (offsets[offsets.length - 1] ?? 0);
}
