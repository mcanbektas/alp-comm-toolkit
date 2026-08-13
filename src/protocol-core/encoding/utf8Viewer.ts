/**
 * UTF-8 bayt görüntüleyici: bir string'i UTF-8 baytlarına açar ve her baytın
 * hangi karaktere ait olduğunu bilgisiyle birlikte döner (byte-viewer bileşeni
 * çok baytlı karakterleri tek blok olarak vurgulayabilsin diye). Motor `TextEncoder`/
 * `TextDecoder` kullanıyor — bunlar Web Worker'da da mevcut, DOM'a bağlı değil.
 */

const HEX_DIGITS_PER_BYTE = 2;
const HEX_RADIX = 16;

/** Tek bir UTF-8 baytının görünüm bilgisi. */
export interface Utf8ByteInfo {
  /** Baytın tüm dizideki (0 tabanlı) konumu. */
  byteIndex: number;
  /** İki haneli büyük harf hex gösterim, ör. "41". */
  hex: string;
  decimal: number;
  /** Bu baytın ait olduğu code point'in dizideki sırası (0 tabanlı). */
  charIndex: number;
  /** Baytın ait olduğu karakterin kendisi (tüm baytları birleşince okunur hâli). */
  character: string;
  /** Bu karakterin kaç bayt kapladığı (1-4) — art arda gelen baytları gruplamak için. */
  charByteLength: number;
  /** Bu bayt, karakterin İLK (öncü) baytı mı; UI'da öncü/devam ayrımı için. */
  isLeadByte: boolean;
}

/** Basit sarmalayıcı — motor genelinde tutarlılık için ayrı fonksiyon olarak tutuldu. */
export function stringToUtf8Bytes(input: string): Uint8Array {
  return new TextEncoder().encode(input);
}

/**
 * `fatal: true`: bozuk UTF-8 dizisini sessizce U+FFFD'ye çevirmek yerine hata
 * fırlatır — protokol analizi yaparken "bu bayt dizisi geçerli UTF-8 değil"
 * bilgisi kullanıcıdan gizlenmemeli.
 */
export function utf8BytesToString(bytes: Uint8Array): string {
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}

/**
 * Her karakteri (code point, surrogate pair dahil tek birim) kendi UTF-8
 * baytlarına ayırıp `Utf8ByteInfo` listesi üretir. `Array.from(string)` code
 * point-aware böler — `string[i]` kullansaydık surrogate pair'ler (ör. emoji)
 * ikiye bölünür ve karakter/bayt eşleşmesi yanlış çıkardı.
 */
export function viewUtf8Bytes(input: string): Utf8ByteInfo[] {
  const encoder = new TextEncoder();
  const result: Utf8ByteInfo[] = [];
  let byteIndex = 0;

  Array.from(input).forEach((character, charIndex) => {
    const charBytes = encoder.encode(character);
    charBytes.forEach((byte, indexWithinChar) => {
      result.push({
        byteIndex,
        hex: byte.toString(HEX_RADIX).padStart(HEX_DIGITS_PER_BYTE, '0').toUpperCase(),
        decimal: byte,
        charIndex,
        character,
        charByteLength: charBytes.length,
        isLeadByte: indexWithinChar === 0,
      });
      byteIndex += 1;
    });
  });

  return result;
}
