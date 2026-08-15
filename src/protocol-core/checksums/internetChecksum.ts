/**
 * RFC 1071 — "Computing the Internet Checksum": IPv4 başlığının, TCP'nin ve
 * UDP'nin kullandığı 16-bit one's-complement toplam. `simpleChecksums.ts`teki
 * `onesComplementChecksum` BU DEĞİL — o 8-BİT'tir (bkz. dosyanın kendi JSDoc'u),
 * burada 16-bit KELİME toplamı ve end-around-carry var; ikisi ayrı algoritma.
 *
 * Algoritma (RFC 1071 §1): veri büyük-uçlu (big-endian) 16-bit kelimelere
 * bölünür, hepsi bir's complement aritmetiğiyle toplanır (taşma "end-around
 * carry" ile geri katlanır — 17. bit taşarsa 1 olarak sonuca eklenir), son
 * toplamın bit'in tümleyeni (~) alınır. Tek bayt kalırsa (odd length) son
 * kelime sanki sonuna bir sıfır bayt eklenmiş gibi tamamlanır (RFC 1071 §1,
 * "the last octet is padded on the right with zeros").
 *
 * HESAPLA/DOĞRULA ayrımı `crcEngine.ts`nin `crc()` tek-fonksiyon + karşılaştırma
 * deseniyle AYNI ruhta ama internet checksum'ın kendine özgü bir DOĞRULA kısayolu
 * var: checksum alanı TELDEN GELDİĞİ HALİYLE (0'lanmadan) topluma dahil edilirse,
 * toplamın tümleyeni doğru checksum'da HER ZAMAN 0x0000 çıkar (ispat: doğru
 * checksum C, veri toplamı S için C = ~S olacak şekilde seçilir; S + C bir's
 * complement toplamda 0xFFFF'tir, tümleyeni 0x0000'dır). Bu yüzden `verify`
 * çağırana "checksum alanını sıfırla, tekrar hesapla, karşılaştır" adımlarını
 * YAPTIRMAZ — tek geçişte toplar.
 */

/** Bir 16-bit kelimenin taşabileceği üst sınır; end-around-carry döngüsü bunu kullanır. */
const WORD_MASK = 0xffff;
const CARRY_SHIFT = 16;

/**
 * Bayt çiftlerini big-endian 16-bit kelime olarak toplar, taşmaları anında
 * end-around carry ile katlar (toplam `number`'da hiçbir zaman 32 biti aşacak
 * kadar büyümez, döngü her adımda 16 bite geri iner — bu yüzden `>>> 0` gerekmez).
 * Tek bayt kalan son kelimede alt bayt üstü (`?? 0`) örtük sıfır dolgudur
 * (noUncheckedIndexedAccess: dizinin sonundan bir fazlası okununca `undefined`).
 */
function sumWords(bytes: Uint8Array): number {
  let sum = 0;
  for (let offset = 0; offset < bytes.length; offset += 2) {
    const highByte = bytes[offset] ?? 0;
    const lowByte = bytes[offset + 1] ?? 0;
    sum += (highByte << 8) | lowByte;
    if (sum > WORD_MASK) {
      sum = (sum & WORD_MASK) + (sum >>> CARRY_SHIFT);
    }
  }
  return sum;
}

/**
 * HESAPLA modu: `bytes` içindeki checksum alanının KENDİSİ dahilse, çağıran
 * onu ÖNCEDEN sıfırlamış olmalıdır (RFC 1071 "the checksum field itself is
 * replaced by zeros" kuralı) — bu fonksiyon böyle bir alanı ARAMAZ, kendisine
 * verilen baytları olduğu gibi toplar. Doğrudan bir alanı sıfırlamak gerekiyorsa
 * `computeInternetChecksumWithFieldZeroed` kullan.
 */
export function computeInternetChecksum(bytes: Uint8Array): number {
  return ~sumWords(bytes) & WORD_MASK;
}

/**
 * `bytes`i DEĞİŞTİRMEDEN (immutable kopya üzerinde) `fieldOffset..fieldOffset+
 * fieldLength` aralığını sıfırlanmış SAYARAK hesaplar. IPv4 başlık checksum'ı
 * gibi "alan, kapsadığı verinin İÇİNDE" durumlarda kullanılır — böylece çağıran
 * elle bir kopya açıp iki baytı sıfırlama tekrarını yazmaz.
 */
export function computeInternetChecksumWithFieldZeroed(
  bytes: Uint8Array,
  fieldOffset: number,
  fieldLength: number,
): number {
  const patched = Uint8Array.from(bytes);
  patched.fill(0, fieldOffset, fieldOffset + fieldLength);
  return computeInternetChecksum(patched);
}

/**
 * DOĞRULA modu: checksum alanı TELDEN GELDİĞİ HALİYLE (dahil, sıfırlanmadan)
 * toplanır; doğruysa tümleyen 0x0000 çıkar (dosya başı ispatı). `bytes` burada
 * checksum alanını da İÇERMELİDİR — yalnız başlığı (checksum hariç) verirsen
 * yanlış sonuç alırsın.
 */
export function verifyInternetChecksum(bytes: Uint8Array): boolean {
  return computeInternetChecksum(bytes) === 0;
}
