/**
 * Manchester hat kodlaması — Faz 10 dalga 18e.
 *
 * Her VERİ biti telde İKİ bite açılır; geçiş her bit süresinin ortasında
 * garanti edilir, böylece alıcı ayrı bir saat teline ihtiyaç duymaz. Bedeli
 * telin iki katına çıkmasıdır.
 *
 * ## 🚨 İKİ GELENEK TERSTİR ve telde hangisinin kullanıldığı YAZMAZ
 *
 * | Gelenek | 1 | 0 |
 * |---|---|---|
 * | IEEE 802.3   | `01` | `10` |
 * | G. E. Thomas | `10` | `01` |
 *
 * Yanlış polarite TÜM bitleri ters çevirir ve **hata VERMEZ** — çünkü geçersiz
 * çift üretmez, yalnız her biti tersine okur. Bu yüzden polarite bir ölçüm
 * değil, kullanıcının BİLDİRİMİdir (`decodeOptions` kanalı) ve varsayılan
 * seçilemez. Aynı sınıf tuzak: dalga 17'nin LonTalk selector'ı, dalga 13'ün
 * `messageSide`ı.
 *
 * ## Geçersiz çift GERÇEK bir hatadır
 *
 * `00` ve `11` Manchester'da tanımsızdır. Karşılaşıldığında konumu bildirilir;
 * "yaklaşık çöz" yapılmaz — bir kodlama hatasını sessizce yutmak, dalga 16c'nin
 * "gösterilir ≠ doğrulanır" dersinin tersine düşerdi.
 *
 * ## Neden `protocol-core`
 *
 * `lfsrWhitening.ts` ile aynı gerekçe: protokolden bağımsız bayt→bayt dönüşüm.
 * **DÜRÜSTÇE: bugün TEK tüketicisi `protocols/wireless/rftelemetry/`.**
 */

import type { BitOrder } from './bitCursor';

export type ManchesterPolarity = 'ieee802.3' | 'thomas';

const BITS_PER_BYTE = 8;

export interface ManchesterCodingError {
  /** Telde kaçıncı bit ÇİFTİ bozuk (0 tabanlı) — aynı zamanda çözülmüş bit indeksi. */
  readonly bitPairIndex: number;
  /** Bozuk çiftin başladığı TEL bayt konumu; `ParsedFrame` hatalarına doğrudan verilir. */
  readonly wireOffset: number;
  /** Gelen çift: 0 (`00`) ya da 3 (`11`). */
  readonly pair: number;
}

export type ManchesterDecodeResult =
  | { readonly success: true; readonly bytes: Uint8Array }
  | { readonly success: false; readonly error: ManchesterCodingError };

/**
 * `1` biti için tel çifti. IEEE 802.3'te `01` (yani sayısal 1), Thomas'ta `10`
 * (sayısal 2). `0` biti daima bunun tersidir.
 */
function pairForOne(polarity: ManchesterPolarity): number {
  return polarity === 'ieee802.3' ? 0b01 : 0b10;
}

/**
 * Veri baytlarını Manchester teline açar. Çıktı GİRDİNİN İKİ KATIDIR.
 *
 * `bitOrder` veri baytının bitlerinin telde hangi sırayla çıkacağıdır;
 * `msb-first` klasik sıradır ve bu kaydın fixture'ı (`2D D4` → `A6 59 59 9A`)
 * onunla üretilmiştir.
 */
export function encodeManchester(
  bytes: Uint8Array,
  polarity: ManchesterPolarity,
  bitOrder: BitOrder = 'msb-first',
): Uint8Array {
  const onePair = pairForOne(polarity);
  const wire = new Uint8Array(bytes.length * 2);
  let wireBit = 0;

  for (const byte of bytes) {
    for (let index = 0; index < BITS_PER_BYTE; index += 1) {
      const shift = bitOrder === 'msb-first' ? BITS_PER_BYTE - 1 - index : index;
      const dataBit = (byte >>> shift) & 1;
      const pair = dataBit === 1 ? onePair : onePair ^ 0b11;
      // Tel bitleri DAİMA MSB-first paketlenir: çift, bit süresinin iki yarısını
      // temsil eder ve zaman sırası bayt içinde soldan sağadır.
      for (let half = 0; half < 2; half += 1) {
        const bit = (pair >>> (1 - half)) & 1;
        const target = wireBit + half;
        const byteIndex = target >>> 3;
        const current = wire[byteIndex] ?? 0;
        wire[byteIndex] = current | (bit << (BITS_PER_BYTE - 1 - (target & 7)));
      }
      wireBit += 2;
    }
  }
  return wire;
}

/**
 * Manchester telini veri baytlarına çözer. Girdi uzunluğu ÇİFT olmalıdır —
 * tek bayt kalırsa son veri baytı yarımdır ve çözülemez.
 */
export function decodeManchester(
  wire: Uint8Array,
  polarity: ManchesterPolarity,
  bitOrder: BitOrder = 'msb-first',
): ManchesterDecodeResult {
  if (wire.length % 2 !== 0) {
    return {
      success: false,
      error: { bitPairIndex: (wire.length * BITS_PER_BYTE) >>> 1, wireOffset: wire.length - 1, pair: -1 },
    };
  }

  const onePair = pairForOne(polarity);
  const out = new Uint8Array(wire.length / 2);

  const totalPairs = (wire.length * BITS_PER_BYTE) / 2;
  for (let pairIndex = 0; pairIndex < totalPairs; pairIndex += 1) {
    const firstBitPosition = pairIndex * 2;
    const high = (wire[firstBitPosition >>> 3] ?? 0) >>> (BITS_PER_BYTE - 1 - (firstBitPosition & 7));
    const lowPosition = firstBitPosition + 1;
    const low = (wire[lowPosition >>> 3] ?? 0) >>> (BITS_PER_BYTE - 1 - (lowPosition & 7));
    const pair = ((high & 1) << 1) | (low & 1);

    if (pair === 0b00 || pair === 0b11) {
      return {
        success: false,
        error: { bitPairIndex: pairIndex, wireOffset: firstBitPosition >>> 3, pair },
      };
    }

    const dataBit = pair === onePair ? 1 : 0;
    const byteIndex = pairIndex >>> 3;
    const indexInByte = pairIndex & 7;
    const shift = bitOrder === 'msb-first' ? BITS_PER_BYTE - 1 - indexInByte : indexInByte;
    out[byteIndex] = (out[byteIndex] ?? 0) | (dataBit << shift);
  }

  return { success: true, bytes: out };
}
