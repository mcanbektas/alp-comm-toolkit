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

// --- DIRECT format (PMBus spec Part II Rev 1.3.1 §7.4) ---

/**
 * ── Provenance: bu blok bu repo'nun spec ÖZETİNDE YOK ────────────────────────
 * `docs/spec/…Platformu.md`nin PMBus bölümü yalnız Linear11/Linear16'yı ve
 * STATUS_WORD bit ağacını tarif eder; katalogdaki "Direct Format Decoder"
 * (`interfaces-framing.ts`) karşılıksızdı. Formüller BİRİNCİL kaynaktan alındı:
 * **PMBus Power System Mgt Protocol Specification – Part II – Revision 1.3.1
 * (SMIF, 13 Mart 2015), §7.4 "DIRECT Data Format"**, pmbus.org'un açık yayını.
 * (Spec özeti "güncel tam revizyon 1.5" diyor; 1.5 Part II kamuya açık indirme
 * olarak bulunamadı, 1.3.1 kullanıldı — Direct formatın denklemi ve katsayı
 * genişlikleri 1.0'dan beri değişmedi. Bu sapma BİLEREK kayda geçirildi;
 * ZMODEM/lrzsz emsalindeki "dış kaynağı adıyla yaz" disiplini.)
 *
 * §7.4.1 (okuma):  X = (1/m)(Y × 10^−R − b)
 * §7.4.2 (yazma):  Y = (mX + b) × 10^R
 * Genişlikler §7.4.1: m 2 bayt two's complement, b 2 bayt two's complement,
 * R 1 bayt two's complement, Y 2 bayt two's complement.
 */
export interface DirectCoefficients {
  /** Eğim (slope). 0 OLAMAZ — denklemde bölen. */
  m: number;
  /** Ofset. */
  b: number;
  /** Onluk üs. */
  r: number;
}

const DIRECT_WORD_BITS = 16;
const DIRECT_COEFFICIENT_MIN = -32768;
const DIRECT_COEFFICIENT_MAX = 32767;
const DIRECT_EXPONENT_MIN = -128;
const DIRECT_EXPONENT_MAX = 127;

function assertDirectCoefficients({ m, b, r }: DirectCoefficients): void {
  if (m === 0) {
    throw new RangeError('DIRECT format: m katsayısı 0 olamaz (denklemde bölen)');
  }
  if (!Number.isInteger(m) || m < DIRECT_COEFFICIENT_MIN || m > DIRECT_COEFFICIENT_MAX) {
    throw new RangeError(`DIRECT format: m 2 bayt two's complement aralığında değil: ${m}`);
  }
  if (!Number.isInteger(b) || b < DIRECT_COEFFICIENT_MIN || b > DIRECT_COEFFICIENT_MAX) {
    throw new RangeError(`DIRECT format: b 2 bayt two's complement aralığında değil: ${b}`);
  }
  if (!Number.isInteger(r) || r < DIRECT_EXPONENT_MIN || r > DIRECT_EXPONENT_MAX) {
    throw new RangeError(`DIRECT format: R 1 bayt two's complement aralığında değil: ${r}`);
  }
}

/**
 * Cihazdan okunan ham Y word'ünü gerçek dünya değerine çevirir (§7.4.1).
 * `word` 16-bit HAM değerdir; two's complement yorumu burada yapılır.
 */
export function decodeDirect(word: number, coefficients: DirectCoefficients): number {
  assertDirectCoefficients(coefficients);
  const { m, b, r } = coefficients;
  const y = signExtend(word & 0xffff, DIRECT_WORD_BITS);
  return (y * 10 ** -r - b) / m;
}

/**
 * Gerçek dünya değerini gönderilecek Y word'üne kodlar (§7.4.2).
 * Sonuç 16-bit two's complement aralığını aşarsa `RangeError` — Linear11
 * kodlayıcısının disiplini (sessiz kırpma yanlış fiziksel değeri gizler).
 */
export function encodeDirect(value: number, coefficients: DirectCoefficients): number {
  assertDirectCoefficients(coefficients);
  const { m, b, r } = coefficients;
  const y = Math.round((m * value + b) * 10 ** r);
  if (y < DIRECT_COEFFICIENT_MIN || y > DIRECT_COEFFICIENT_MAX) {
    throw new RangeError(`DIRECT format: Y 16-bit aralığı aşıldı: ${y}`);
  }
  return y & 0xffff;
}

/**
 * COEFFICIENTS (komut kodu 30h) okuma yanıtındaki 5 veri baytını çözer.
 * Bayt sırası spec §14.1'de AÇIKÇA sayılı: m alt, m üst, b alt, b üst, R.
 * (Block Write-Block Read Process Call'un byte-count'u bu 5 baytın ÖNÜNDEDİR
 * ve buraya DAHİL DEĞİLDİR — çağıran ayıklar.)
 */
export function parseDirectCoefficients(bytes: Uint8Array): DirectCoefficients {
  const COEFFICIENT_BYTE_COUNT = 5;
  if (bytes.length !== COEFFICIENT_BYTE_COUNT) {
    throw new RangeError(`COEFFICIENTS 5 veri baytı bekler, ${bytes.length} geldi`);
  }
  const mRaw = (bytes[0] ?? 0) | ((bytes[1] ?? 0) << 8);
  const bRaw = (bytes[2] ?? 0) | ((bytes[3] ?? 0) << 8);
  const rRaw = bytes[4] ?? 0;
  return {
    m: signExtend(mRaw, DIRECT_WORD_BITS),
    b: signExtend(bRaw, DIRECT_WORD_BITS),
    r: signExtend(rRaw, 8),
  };
}

// --- VOUT_MODE (spec Part II §8.3, Table 2) ---

export type VoutMode = 'ulinear16' | 'vid' | 'direct' | 'ieee-half';

export interface VoutModeParts {
  mode: VoutMode;
  /** Bit [7]: 0 = Absolute, 1 = Relative (Table 2 alt iki satırı). */
  relative: boolean;
  /** Bit [4:0] ham parametre. */
  parameter: number;
  /**
   * ULINEAR16'da parametre 5-bit two's complement EXPONENT'tir (Table 2, Note 1).
   * Diğer modlarda anlamı exponent DEĞİLDİR — bu alan `undefined` kalır,
   * uydurulmuş bir üs döndürülmez.
   */
  exponent?: number;
}

const VOUT_MODE_SELECT_SHIFT = 5;
const VOUT_MODE_SELECT_MASK = 0b11;
const VOUT_MODE_RELATIVE_MASK = 0x80;
const VOUT_MODE_PARAMETER_MASK = 0x1f;
const VOUT_MODE_PARAMETER_BITS = 5;

/**
 * VOUT_MODE veri baytını çözer (§8.3.1, Figure 6 + Table 2).
 * Mode seçimi bit [6:5]'tedir: 00b ULINEAR16, 01b VID, 10b Direct, 11b IEEE
 * Half Precision. Bit [7] Absolute/Relative ayrımıdır ve mode seçiminden
 * BAĞIMSIZDIR (Table 2 son iki satırı: bit[7] için mode bitleri "XX").
 */
export function decodeVoutMode(byte: number): VoutModeParts {
  const select = (byte >> VOUT_MODE_SELECT_SHIFT) & VOUT_MODE_SELECT_MASK;
  const parameter = byte & VOUT_MODE_PARAMETER_MASK;
  const mode: VoutMode =
    select === 0b00 ? 'ulinear16' : select === 0b01 ? 'vid' : select === 0b10 ? 'direct' : 'ieee-half';

  return {
    mode,
    relative: (byte & VOUT_MODE_RELATIVE_MASK) !== 0,
    parameter,
    ...(mode === 'ulinear16'
      ? { exponent: signExtend(parameter, VOUT_MODE_PARAMETER_BITS) }
      : {}),
  };
}
