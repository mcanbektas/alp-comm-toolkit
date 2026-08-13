/**
 * IEEE-754 float ↔ bayt dizisi dönüşümleri (spec §43 fixture: 25.75 → `41 CE 00 00`).
 *
 * Float32/Float64 için `DataView` doğrudan yeterli (motor zaten IEEE-754 kullanıyor,
 * yeniden icat etmeye gerek yok). Float16 (half precision) için JS'in yerleşik bir
 * `DataView` metodu YOK — bu yüzden float32 bit deseni üzerinden manuel dönüştürülür.
 * Bu dosya bir Web Worker içinde de çalışabilmeli (spec §44), bu yüzden DOM API'sine
 * (örn. `btoa`) bağımlılık yok; yalnız `DataView`/`ArrayBuffer` kullanılıyor.
 */

export type Endianness = 'big' | 'little';

const FLOAT16_BYTE_LENGTH = 2;
const FLOAT32_BYTE_LENGTH = 4;
const FLOAT64_BYTE_LENGTH = 8;

// --- Float32 bit alanları (1 işaret + 8 üs + 23 mantis) ---
const F32_EXPONENT_SHIFT = 23;
const F32_MANTISSA_MASK = 0x007fffff;
const F32_EXPONENT_ALL_ONES = 0xff;

// --- Float16 bit alanları (1 işaret + 5 üs + 10 mantis) ---
const F16_SIGN_MASK = 0x8000;
const F16_EXPONENT_MASK = 0x7c00;
const F16_MANTISSA_MASK = 0x03ff;
const F16_QUIET_NAN_BIT = 0x0200;
const F16_MAX_BITS = 0xffff;

/**
 * float32 bit deseninden float16 bit desenine yuvarlar (round-to-nearest-even).
 * Referans: Martin Kallman'ın yaygın atıf yapılan half-float dönüşüm algoritması —
 * eşik sabitleri (103/113/142) float32 üs alanının float16 aralığına denk düşen
 * kesim noktalarıdır, keyfi değildir: 103 = 127-24 (en küçük denormal half'ın
 * temsil edebileceği alt sınır), 142 = 127+15 (half üs taşma sınırı).
 */
function float32BitsToFloat16Bits(x: number): number {
  const FLUSH_TO_ZERO_EXPONENT = 103;
  const OVERFLOW_EXPONENT = 142;
  const DENORMAL_EXPONENT = 113;
  const SIGN_SHIFT_32_TO_16 = 16;
  const MANTISSA_SHIFT_32_TO_16 = 12;
  const DENORMAL_IMPLICIT_BIT = 0x0800;
  const DENORMAL_BASE_SHIFT = 114;
  const ROUNDING_BASE_SHIFT = 113;
  const NORMAL_EXPONENT_BIAS_DIFF = 112;

  let bits = (x >>> SIGN_SHIFT_32_TO_16) & F16_SIGN_MASK;
  let mantissa = (x >>> MANTISSA_SHIFT_32_TO_16) & 0x07ff;
  const exponent = (x >>> F32_EXPONENT_SHIFT) & F32_EXPONENT_ALL_ONES;

  if (exponent < FLUSH_TO_ZERO_EXPONENT) {
    // Half'ın temsil edebileceğinden küçük: işaretli sıfıra yuvarlanır.
    return bits;
  }
  if (exponent > OVERFLOW_EXPONENT) {
    // Zaten Inf/NaN ya da half aralığını taşıyor.
    bits |= F16_EXPONENT_MASK;
    if (exponent === F32_EXPONENT_ALL_ONES && (x & F32_MANTISSA_MASK) !== 0) {
      bits |= F16_QUIET_NAN_BIT; // NaN: mantis en az bir bit dolu kalmalı.
    }
    return bits;
  }
  if (exponent < DENORMAL_EXPONENT) {
    // Half normal aralığının altında ama denormal olarak temsil edilebilir.
    mantissa |= DENORMAL_IMPLICIT_BIT;
    bits |= (mantissa >> (DENORMAL_BASE_SHIFT - exponent)) +
      ((mantissa >> (ROUNDING_BASE_SHIFT - exponent)) & 1);
    return bits;
  }
  bits |= ((exponent - NORMAL_EXPONENT_BIAS_DIFF) << 10) | (mantissa >> 1);
  bits += mantissa & 1; // round-to-nearest-even; taşarsa üs alanına doğal olarak yayılır.
  return bits & F16_MAX_BITS;
}

/** float16 bit desenini float32 bit desenine genişletir (yukarıdakinin tersi). */
function float16BitsToFloat32Bits(h: number): number {
  const SIGN_SHIFT_16_TO_32 = 16;
  const EXPONENT_SHIFT_16 = 10;
  const EXPONENT_BITS_16 = 0x1f;
  const EXPONENT_ALL_ONES_16 = 0x1f;
  const NORMAL_EXPONENT_BIAS_DIFF = 112;
  const MANTISSA_SHIFT_16_TO_32 = 13;
  const F32_INFINITY_EXPONENT_BITS = 0x7f800000;
  const DENORMAL_LEADING_BIT = 0x400;

  const sign = (h & F16_SIGN_MASK) << SIGN_SHIFT_16_TO_32;
  let exponent = (h >> EXPONENT_SHIFT_16) & EXPONENT_BITS_16;
  let mantissa = h & F16_MANTISSA_MASK;

  if (exponent === 0) {
    if (mantissa === 0) {
      return sign; // işaretli sıfır
    }
    // Half denormal: örtük biti göründüğü yere kadar sola kaydırıp float32 normale çevir.
    exponent = 1;
    while ((mantissa & DENORMAL_LEADING_BIT) === 0) {
      mantissa <<= 1;
      exponent -= 1;
    }
    mantissa &= F16_MANTISSA_MASK;
    return sign | ((exponent + NORMAL_EXPONENT_BIAS_DIFF) << F32_EXPONENT_SHIFT) | (mantissa << MANTISSA_SHIFT_16_TO_32);
  }
  if (exponent === EXPONENT_ALL_ONES_16) {
    // Inf ya da NaN: float32'de de üs alanı tümü-bir olur.
    return sign | F32_INFINITY_EXPONENT_BITS | (mantissa << MANTISSA_SHIFT_16_TO_32);
  }
  return sign | ((exponent + NORMAL_EXPONENT_BIAS_DIFF) << F32_EXPONENT_SHIFT) | (mantissa << MANTISSA_SHIFT_16_TO_32);
}

export function encodeFloat16(value: number, endianness: Endianness): Uint8Array {
  // Önce değeri float32 bit desenine oturt (DataView bunu doğru/yuvarlamalı yapar),
  // sonra float32→float16 manuel indirgemeyi uygula. Ara adımın endianness'ı
  // önemsiz çünkü yalnız bit deseni okunuyor, bayt sırası son adımda uygulanıyor.
  const intermediate = new DataView(new ArrayBuffer(FLOAT32_BYTE_LENGTH));
  intermediate.setFloat32(0, value, false);
  const float16Bits = float32BitsToFloat16Bits(intermediate.getUint32(0, false));

  const out = new DataView(new ArrayBuffer(FLOAT16_BYTE_LENGTH));
  out.setUint16(0, float16Bits, endianness === 'little');
  return new Uint8Array(out.buffer);
}

export function decodeFloat16(bytes: Uint8Array, endianness: Endianness): number {
  if (bytes.length !== FLOAT16_BYTE_LENGTH) {
    throw new Error(`Float16 için ${FLOAT16_BYTE_LENGTH} bayt gerekir, ${bytes.length} verildi`);
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const float32Bits = float16BitsToFloat32Bits(view.getUint16(0, endianness === 'little'));

  const out = new DataView(new ArrayBuffer(FLOAT32_BYTE_LENGTH));
  out.setUint32(0, float32Bits, false);
  return out.getFloat32(0, false);
}

export function encodeFloat32(value: number, endianness: Endianness): Uint8Array {
  const view = new DataView(new ArrayBuffer(FLOAT32_BYTE_LENGTH));
  view.setFloat32(0, value, endianness === 'little');
  return new Uint8Array(view.buffer);
}

export function decodeFloat32(bytes: Uint8Array, endianness: Endianness): number {
  if (bytes.length !== FLOAT32_BYTE_LENGTH) {
    throw new Error(`Float32 için ${FLOAT32_BYTE_LENGTH} bayt gerekir, ${bytes.length} verildi`);
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return view.getFloat32(0, endianness === 'little');
}

export function encodeFloat64(value: number, endianness: Endianness): Uint8Array {
  const view = new DataView(new ArrayBuffer(FLOAT64_BYTE_LENGTH));
  view.setFloat64(0, value, endianness === 'little');
  return new Uint8Array(view.buffer);
}

export function decodeFloat64(bytes: Uint8Array, endianness: Endianness): number {
  if (bytes.length !== FLOAT64_BYTE_LENGTH) {
    throw new Error(`Float64 için ${FLOAT64_BYTE_LENGTH} bayt gerekir, ${bytes.length} verildi`);
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return view.getFloat64(0, endianness === 'little');
}
