/**
 * PMBus/SMBus sayısal format çözücü/kodlayıcı: Linear11 ve Linear16.
 *
 * Linear11: 16-bit word, üst 5 bit exponent + alt 11 bit mantissa, ikisi de
 * two's-complement işaretli (spec §3.1 "PMBus"). Çoğu READ_* komutu (READ_VIN,
 * READ_IOUT, READ_TEMPERATURE_1 …) bu formatı kullanır. Linear16: yalnız
 * mantissa taşınır, exponent VOUT_MODE komutundan ayrıca bilinir/verilir —
 * tipik VOUT_COMMAND/READ_VOUT kullanımı; VOUT hep pozitif olduğundan mantissa
 * burada işaretsizdir.
 */

const LINEAR11_EXPONENT_BIT_WIDTH = 5;
const LINEAR11_MANTISSA_BIT_WIDTH = 11;
/** 11-bit mantissa alanı word'ün alt bitlerinde — maskeler bit yerleşimini sabitler. */
const LINEAR11_MANTISSA_MASK = (1 << LINEAR11_MANTISSA_BIT_WIDTH) - 1; // 0x7FF
const LINEAR11_EXPONENT_MASK = (1 << LINEAR11_EXPONENT_BIT_WIDTH) - 1; // 0x1F

/** 5-bit two's complement aralığı. */
const LINEAR11_EXPONENT_MIN = -16;
const LINEAR11_EXPONENT_MAX = 15;
/** 11-bit two's complement aralığı. */
const LINEAR11_MANTISSA_MIN = -1024;
const LINEAR11_MANTISSA_MAX = 1023;

/**
 * `bits`-genişliğinde two's-complement ham değeri işaretli sayıya çevirir.
 * XOR-çıkar hilesi: üst bit (sign bit) set ise `raw − 2^bits`, değilse `raw` —
 * dallanmasız, tüm genişlikler için aynı ifade.
 */
function signExtend(raw: number, bits: number): number {
  const signBit = 1 << (bits - 1);
  return (raw ^ signBit) - signBit;
}

export interface Linear11Parts {
  mantissa: number;
  exponent: number;
}

/** Ham word'ü exponent/mantissa çiftine ayırır — bit-view gösterimi için ayrı tutuldu. */
export function decodeLinear11Parts(word: number): Linear11Parts {
  const exponentRaw = (word >> LINEAR11_MANTISSA_BIT_WIDTH) & LINEAR11_EXPONENT_MASK;
  const mantissaRaw = word & LINEAR11_MANTISSA_MASK;

  return {
    exponent: signExtend(exponentRaw, LINEAR11_EXPONENT_BIT_WIDTH),
    mantissa: signExtend(mantissaRaw, LINEAR11_MANTISSA_BIT_WIDTH),
  };
}

/**
 * 16-bit Linear11 word'ünü ondalık değere çözer: `Value = Mantissa × 2^Exponent`.
 * Bit yerleşimi PMBus spesifikasyonu standardıdır: bit 15-11 exponent, bit 10-0
 * mantissa (spec §3.1 "Linear11").
 */
export function decodeLinear11(word: number): number {
  const { mantissa, exponent } = decodeLinear11Parts(word);
  return mantissa * 2 ** exponent;
}

/**
 * Ondalık değeri Linear11 word'üne kodlar. `exponent` verilmezse mantissayı
 * 11-bit aralığa sığdıran EN KÜÇÜK (en hassas) exponent otomatik seçilir
 * (bkz. `selectLinear11Exponent`). Aralık dışına taşan mantissa/exponent
 * `RangeError` fırlatır — sessizce kırpmak yanlış fiziksel değeri gizler.
 */
export function encodeLinear11(value: number, exponent?: number): number {
  const chosenExponent = exponent ?? selectLinear11Exponent(value);
  const mantissa = Math.round(value / 2 ** chosenExponent);

  if (
    chosenExponent < LINEAR11_EXPONENT_MIN ||
    chosenExponent > LINEAR11_EXPONENT_MAX ||
    mantissa < LINEAR11_MANTISSA_MIN ||
    mantissa > LINEAR11_MANTISSA_MAX
  ) {
    throw new RangeError(
      `Linear11 aralığı aşıldı: exponent=${chosenExponent}, mantissa=${mantissa}`,
    );
  }

  const exponentRaw = chosenExponent & LINEAR11_EXPONENT_MASK;
  const mantissaRaw = mantissa & LINEAR11_MANTISSA_MASK;

  return (exponentRaw << LINEAR11_MANTISSA_BIT_WIDTH) | mantissaRaw;
}

/**
 * En hassas gösterimi bulmak için en negatif exponent'ten başlayıp mantissa
 * 11-bit aralığa sığana kadar dener. Sığan İLK (en küçük/en negatif) exponent
 * en büyük |mantissa|'yı, dolayısıyla en az yuvarlama hatasını verir.
 */
function selectLinear11Exponent(value: number): number {
  if (value === 0) {
    return 0;
  }
  for (let exponent = LINEAR11_EXPONENT_MIN; exponent <= LINEAR11_EXPONENT_MAX; exponent += 1) {
    const mantissa = Math.round(value / 2 ** exponent);
    if (mantissa >= LINEAR11_MANTISSA_MIN && mantissa <= LINEAR11_MANTISSA_MAX) {
      return exponent;
    }
  }
  throw new RangeError(`Değer Linear11 ile temsil edilemiyor: ${value}`);
}

// --- Linear16 ---

/** Linear16 mantissası işaretsiz 16-bit'tir (VOUT her zaman ≥0). */
const LINEAR16_MANTISSA_MIN = 0;
const LINEAR16_MANTISSA_MAX = 0xffff;

/**
 * Linear16 mantissasını ondalık değere çözer: `Value = Mantissa × 2^Exponent`.
 * Exponent word içinde taşınmaz — VOUT_MODE komutundan ayrıca okunup buraya
 * verilir (spec §3.1 "PMBus": "Format Linear16, Exponent, Physical 12.04V"
 * örneği exponent'in ayrı bilindiğini gösterir).
 */
export function decodeLinear16(mantissa: number, exponent: number): number {
  return mantissa * 2 ** exponent;
}

/** Ondalık değeri, host'un zaten bildiği sabit exponent ile Linear16 mantissasına kodlar. */
export function encodeLinear16(value: number, exponent: number): number {
  const mantissa = Math.round(value / 2 ** exponent);
  if (mantissa < LINEAR16_MANTISSA_MIN || mantissa > LINEAR16_MANTISSA_MAX) {
    throw new RangeError(`Linear16 mantissa aralığı aşıldı: ${mantissa}`);
  }
  return mantissa;
}
