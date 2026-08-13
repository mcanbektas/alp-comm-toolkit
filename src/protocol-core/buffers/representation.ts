/**
 * Bayt/temsil dönüştürücüleri: HEX ↔ ASCII, HEX ↔ binary (bit string) ve genel
 * radix (taban) dönüşümü. Hepsi saf, stateless fonksiyonlardır — girdi doğrulanır,
 * geçersizse (tek/çift hane uyuşmazlığı, alfabe dışı karakter) açık hata fırlatılır;
 * sessizce yarım/yanlış sonuç üretmek byte-viewer gibi tüketicilerde sinsi hataya
 * dönüşür (bkz. CLAUDE.md "hatalı veride uygulamayı çökertme" ama burası zaten
 * kullanıcı girişini doğrulayan sınır katmanı, çökme değil erken hata beklenir).
 */

const HEX_RADIX = 16;
const BINARY_RADIX = 2;
const HEX_DIGITS_PER_BYTE = 2;
const BITS_PER_HEX_DIGIT = 4;
/** Latin-1/tek bayt sınırı: bunun üstü çok baytlı Unicode'dur, tek hex çiftine sığmaz. */
const MAX_SINGLE_BYTE_CODE = 0xff;

/** `bytes[i].toString(16).padStart(2,'0')` her zaman büyük harfe çevrilir — dosyadaki tüm hex çıktıları tutarlı olsun diye. */
export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(HEX_RADIX).padStart(HEX_DIGITS_PER_BYTE, '0'))
    .join('')
    .toUpperCase();
}

/**
 * Boşlukları (byte grupları arası ayraç, ör. "01 03 00") temizler ve hane
 * sayısının çift olduğunu doğrular — tek haneli bir hex string son baytın
 * yarısını temsil eder, bu sessizce yuvarlanamaz.
 */
function normalizeHex(hex: string): string {
  const stripped = hex.replace(/\s+/g, '');
  if (stripped.length % HEX_DIGITS_PER_BYTE !== 0) {
    throw new Error(`Hex string must have an even number of digits, got "${hex}"`);
  }
  if (!/^[0-9a-fA-F]*$/.test(stripped)) {
    throw new Error(`"${hex}" contains non-hex characters`);
  }
  return stripped;
}

export function hexToBytes(hex: string): Uint8Array {
  const normalized = normalizeHex(hex);
  const bytes = new Uint8Array(normalized.length / HEX_DIGITS_PER_BYTE);
  for (let i = 0; i < bytes.length; i++) {
    const pair = normalized.slice(i * HEX_DIGITS_PER_BYTE, i * HEX_DIGITS_PER_BYTE + HEX_DIGITS_PER_BYTE);
    bytes[i] = Number.parseInt(pair, HEX_RADIX);
  }
  return bytes;
}

export function hexToAscii(hex: string): string {
  const bytes = hexToBytes(hex);
  return Array.from(bytes, (byte) => String.fromCharCode(byte)).join('');
}

/**
 * `for...of` kod noktası bazında iterasyon yapar (surrogate çiftlerini tek adımda
 * gezer); BMP-dışı bir karakter geldiğinde `charCodeAt(0)` yüksek surrogate'i
 * döner ki bu zaten `MAX_SINGLE_BYTE_CODE`'u aşar ve doğru şekilde reddedilir.
 */
export function asciiToHex(ascii: string): string {
  const codes: number[] = [];
  for (const char of ascii) {
    const code = char.charCodeAt(0);
    if (code > MAX_SINGLE_BYTE_CODE) {
      throw new Error(`"${char}" cannot be represented as a single byte (code point ${code})`);
    }
    codes.push(code);
  }
  return codes
    .map((code) => code.toString(HEX_RADIX).padStart(HEX_DIGITS_PER_BYTE, '0'))
    .join('')
    .toUpperCase();
}

export function hexToBinary(hex: string): string {
  const normalized = normalizeHex(hex);
  return Array.from(normalized, (digit) =>
    Number.parseInt(digit, HEX_RADIX).toString(BINARY_RADIX).padStart(BITS_PER_HEX_DIGIT, '0'),
  ).join('');
}

/**
 * Bit dizisi 4'ün katı olmayabilir (ör. bir bit-field çıktısı "10110" olabilir);
 * her hex hanesi tam 4 bit temsil ettiği için baştan 0 ile 4'ün katına tamamlanır,
 * aksi hâlde son hane yanlış nibble sınırından okunur.
 */
function normalizeBinary(binary: string): string {
  const stripped = binary.replace(/\s+/g, '');
  if (stripped.length === 0 || !/^[01]+$/.test(stripped)) {
    throw new Error(`"${binary}" is not a valid binary string`);
  }
  const paddedLength = Math.ceil(stripped.length / BITS_PER_HEX_DIGIT) * BITS_PER_HEX_DIGIT;
  return stripped.padStart(paddedLength, '0');
}

export function binaryToHex(binary: string): string {
  const normalized = normalizeBinary(binary);
  const digits: string[] = [];
  for (let i = 0; i < normalized.length; i += BITS_PER_HEX_DIGIT) {
    const nibble = normalized.slice(i, i + BITS_PER_HEX_DIGIT);
    digits.push(Number.parseInt(nibble, BINARY_RADIX).toString(HEX_RADIX));
  }
  return digits.join('').toUpperCase();
}

/** Spec §50'deki "Decimal converter" — hex/binary/octal/decimal arası genel taban dönüşümü. */
export type RadixBase = 2 | 8 | 10 | 16;

const RADIX_DIGIT_PATTERN: Record<RadixBase, RegExp> = {
  2: /^[01]+$/,
  8: /^[0-7]+$/,
  10: /^[0-9]+$/,
  16: /^[0-9a-fA-F]+$/,
};

export function numberToRadix(value: number, radix: RadixBase): string {
  if (!Number.isInteger(value) || value < 0) {
    throw new RangeError(`value must be a non-negative integer, got ${value}`);
  }
  return value.toString(radix).toUpperCase();
}

/**
 * `Number.parseInt` alfabe dışı karakterlerde sessizce durup elindeki kadarını
 * döner (ör. `parseInt("12", 2)` → 1) — bu yüzden önce tabana özgü regex ile
 * TÜM string doğrulanır, ancak öyle parseInt'e verilir.
 */
export function radixToNumber(value: string, radix: RadixBase): number {
  const trimmed = value.trim();
  const pattern = RADIX_DIGIT_PATTERN[radix];
  if (trimmed.length === 0 || !pattern.test(trimmed)) {
    throw new Error(`"${value}" is not a valid base-${radix} number`);
  }
  return Number.parseInt(trimmed, radix);
}

export function convertRadix(value: string, fromRadix: RadixBase, toRadix: RadixBase): string {
  return numberToRadix(radixToNumber(value, fromRadix), toRadix);
}
