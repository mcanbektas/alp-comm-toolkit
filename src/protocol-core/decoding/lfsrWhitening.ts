/**
 * LFSR beyazlatma (whitening / scrambling) — Faz 10 dalga 18e.
 *
 * Sub-GHz telemetri radyoları (TI CC1101/CC2500, Semtech SX12xx, Nordic nRF …)
 * yükü bir sözde-rastgele bit dizisiyle XOR'lar ki telde uzun `00`/`FF` dizileri
 * kalmasın: alıcının saat kurtarma döngüsü geçiş görmeye ihtiyaç duyar. İşlem
 * XOR olduğu için **kendi tersidir** — beyazlatma ile beyazlatmayı çözme AYNI
 * fonksiyondur, ayrı bir `dewhiten` yazmak iki kopya bakmak olurdu.
 *
 * ## Neden `protocol-core`, neden `protocols/` değil
 *
 * Dönüşüm protokolden bağımsızdır: girdi bayt dizisi, çıktı bayt dizisi, arada
 * hiçbir alan yorumu yok. `pulseLog.ts`/`bitCursor.ts` ile aynı raf.
 * **DÜRÜSTÇE: bugün TEK tüketicisi var** (`protocols/wireless/rftelemetry/`).
 * "İleride paylaşılır" diye API şişirilmedi — yapılandırma yüzeyi PN9'un
 * ihtiyacı kadar (genişlik + tap kümesi + tohum) ve o kadar.
 *
 * ## Doğrulanmış fixture
 *
 * PN9 (9 bit, x⁹ + x⁵ + 1, tohum `0x1FF`, çıkış = LFSR'ın en düşük biti,
 * bayt başına 8 kaydırma, çıkış LSB-first paketlenir) ilk dokuz baytı
 * **`FF E1 1D 9A ED 85 33 24 EA`** üretir — TI'ın CC1101 belgelerinde yayımlanan
 * dizi. `lfsrWhitening.test.ts` bunu ASSERT eder; motor kendi kendini
 * doğrulamadan bir kayda bağlanmaz (CLAUDE.md "yeni motor yazarken fixture'ını
 * da yaz").
 *
 * ## Tanınmayan yapılandırma HATA DEĞİLDİR
 *
 * Tescilli radyolar farklı tohum ve tap kullanır; motor bir "bilinen diziler"
 * listesi tutmaz, kullanıcının BİLDİRİMİNİ uygular. Yalnız YAPISAL olarak
 * anlamsız yapılandırma reddedilir (genişlik aralık dışı, tap yok, tap genişliği
 * aşıyor, tohum sıfır): sıfır tohumlu bir Fibonacci LFSR sonsuza kadar sıfır
 * üretir, yani "beyazlatma açık" derken hiçbir şey yapmaz — sessizce yanlış
 * çalışmaktansa açıkça reddetmek doğrudur.
 */

import type { BitOrder } from './bitCursor';

export interface LfsrWhiteningConfig {
  /** LFSR bit genişliği; PN9 için 9. */
  readonly width: number;
  /**
   * Geri besleme tap'leri — 0 tabanlı bit konumları, XOR'lanır.
   * PN9'un `x⁹ + x⁵ + 1`i bu gösterimde `[0, 5]`tir: çıkış biti (en düşük bit)
   * ile beşinci bit XOR'lanıp en üst bite yazılır.
   */
  readonly taps: readonly number[];
  readonly seed: number;
}

/** LFSR'ın destekleyebileceği azami genişlik — 32 bit tamsayı kaydırmaları güvenli kalsın. */
const MAX_LFSR_WIDTH = 31;
const MIN_LFSR_WIDTH = 2;
const BITS_PER_BYTE = 8;

/**
 * TI CC1101/CC2500 ailesinin PN9'u. **Yayımlanmış dizisiyle sınanır** —
 * bu sabit, testin ASSERT ettiği tek "bilinen" yapılandırmadır.
 */
export const PN9_WHITENING: LfsrWhiteningConfig = {
  width: 9,
  taps: [0, 5],
  seed: 0x1ff,
};

export interface WhiteningConfigIssue {
  readonly message: string;
}

/**
 * Yapılandırmayı YAPISAL olarak sınar. Dönen değer `undefined` ise
 * yapılandırma çalıştırılabilir; değilse sebebi taşır.
 */
export function validateWhiteningConfig(
  config: LfsrWhiteningConfig,
): WhiteningConfigIssue | undefined {
  if (!Number.isInteger(config.width) || config.width < MIN_LFSR_WIDTH || config.width > MAX_LFSR_WIDTH) {
    return { message: `LFSR genişliği ${MIN_LFSR_WIDTH}..${MAX_LFSR_WIDTH} aralığında olmalı (gelen ${config.width})` };
  }
  if (config.taps.length === 0) {
    return { message: 'En az bir geri besleme tap\'i gerekli' };
  }
  for (const tap of config.taps) {
    if (!Number.isInteger(tap) || tap < 0 || tap >= config.width) {
      return { message: `Tap ${tap} genişlik dışında (0..${config.width - 1})` };
    }
  }
  const maximumSeed = (1 << config.width) - 1;
  if (!Number.isInteger(config.seed) || config.seed <= 0 || config.seed > maximumSeed) {
    return { message: `Tohum 1..${maximumSeed} aralığında olmalı (gelen ${config.seed})` };
  }
  return undefined;
}

/**
 * Beyazlatma dizisinin ilk `byteCount` baytını üretir.
 *
 * `bitOrder` çıkış bitlerinin bayta PAKETLENME sırasıdır: PN9'un yayımlanmış
 * bayt dizisi `lsb-first` paketlemeyle çıkar. `msb-first` istenirse aynı bit
 * akışı ters paketlenir — bu, dizinin bit-ters çevrilmiş hâlidir ve BAŞKA bir
 * dizidir; PN9 fixture'ı YALNIZ `lsb-first` için geçerlidir.
 */
export function whiteningSequence(
  config: LfsrWhiteningConfig,
  byteCount: number,
  bitOrder: BitOrder = 'lsb-first',
): Uint8Array {
  const issue = validateWhiteningConfig(config);
  if (issue !== undefined) {
    throw new Error(`whiteningSequence: ${issue.message}`);
  }
  if (!Number.isInteger(byteCount) || byteCount < 0) {
    throw new Error(`whiteningSequence: bayt sayısı negatif olamaz (gelen ${byteCount})`);
  }

  const mask = (1 << config.width) - 1;
  const topBit = 1 << (config.width - 1);
  let state = config.seed & mask;

  const out = new Uint8Array(byteCount);
  for (let index = 0; index < byteCount; index += 1) {
    let byte = 0;
    for (let bit = 0; bit < BITS_PER_BYTE; bit += 1) {
      // Çıkış biti KAYDIRMADAN ÖNCE okunur (Fibonacci LFSR'ın klasik biçimi):
      // tohumun kendisi dizinin ilk baytına katkı verir, ki PN9'un `FF`i
      // ancak böyle çıkar.
      const outputBit = state & 1;
      byte |= outputBit << (bitOrder === 'lsb-first' ? bit : BITS_PER_BYTE - 1 - bit);

      let feedback = 0;
      for (const tap of config.taps) {
        feedback ^= (state >>> tap) & 1;
      }
      state = ((state >>> 1) | (feedback * topBit)) & mask;
    }
    out[index] = byte;
  }
  return out;
}

/**
 * Baytları beyazlatma dizisiyle XOR'lar. **Kendi tersidir**: aynı çağrı hem
 * beyazlatır hem çözer. Girdi DEĞİŞTİRİLMEZ, yeni dizi döner.
 */
export function applyWhitening(
  bytes: Uint8Array,
  config: LfsrWhiteningConfig,
  bitOrder: BitOrder = 'lsb-first',
): Uint8Array {
  const sequence = whiteningSequence(config, bytes.length, bitOrder);
  const out = new Uint8Array(bytes.length);
  for (let index = 0; index < bytes.length; index += 1) {
    out[index] = (bytes[index] ?? 0) ^ (sequence[index] ?? 0);
  }
  return out;
}
