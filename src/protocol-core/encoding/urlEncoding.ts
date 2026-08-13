/**
 * URL (percent) encoding. Metin↔metin dönüşümü için yerleşik `encodeURIComponent`/
 * `decodeURIComponent` yeterli ve doğru (RFC 3986 unreserved küme dahil UTF-8
 * farkındalıklı çalışırlar, yeniden yazmaya gerek yok). Ayrıca ham bayt dizisi
 * ile çalışan bir çift eklendi: protokol frame'lerinde percent-encoding bazen
 * karakter değil doğrudan bayt taşır (ör. binary payload'ın URL-safe biçimi).
 */

const HEX_DIGITS_PER_BYTE = 2;
const HEX_RADIX = 16;
const PERCENT_CHAR = '%';
const HEX_PAIR_PATTERN = /^[0-9a-fA-F]{2}$/u;

export function urlEncode(input: string): string {
  return encodeURIComponent(input);
}

export function urlDecode(input: string): string {
  return decodeURIComponent(input);
}

/** Her baytı doğrudan `%XX` olarak yazar — bayt bir UTF-8 karakterine önce çözülmez. */
export function bytesToPercentEncoded(bytes: Uint8Array): string {
  let result = '';
  for (const byte of bytes) {
    result += PERCENT_CHAR + byte.toString(HEX_RADIX).padStart(HEX_DIGITS_PER_BYTE, '0').toUpperCase();
  }
  return result;
}

/**
 * `%XX` gruplarını tek bayta çevirir; percent olmayan karakterler doğrudan kod
 * noktası değerine (ASCII varsayımıyla) eşlenir. Bu fonksiyon `urlDecode`'un
 * aksine sonucu STRING'e çözmez — protokol byte-viewer'ı ham baytı görmek ister.
 */
export function percentEncodedToBytes(input: string): Uint8Array {
  const bytes: number[] = [];
  let i = 0;
  while (i < input.length) {
    const char = input.charAt(i);
    if (char === PERCENT_CHAR) {
      const hex = input.slice(i + 1, i + 1 + HEX_DIGITS_PER_BYTE);
      if (hex.length !== HEX_DIGITS_PER_BYTE || !HEX_PAIR_PATTERN.test(hex)) {
        throw new Error(`Geçersiz percent-encoding dizisi: '%${hex}'`);
      }
      bytes.push(parseInt(hex, HEX_RADIX));
      i += 1 + HEX_DIGITS_PER_BYTE;
    } else {
      bytes.push(char.charCodeAt(0));
      i += 1;
    }
  }
  return Uint8Array.from(bytes);
}
