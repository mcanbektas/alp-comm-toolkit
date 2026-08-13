/**
 * Kullanıcı tanımlı protokollerin alan tipleri — spec §9.1.
 *
 * **Spec tutarsızlığı, bilerek listeye uyuldu:** §9.1'in başlığı "TAM LİSTE —
 * 32 tip" diyor ama gövdedeki liste 33 ad taşıyor. Sayı değil LİSTE esas
 * alındı; bir tipi keyfî olarak elemek, spec'in adını verdiği bir yeteneği
 * sessizce düşürmek olurdu.
 *
 * Tipler üç gruba ayrılır ve bu ayrım parser/encoder'ın tamamını belirler:
 *
 * - **Kendi genişliği olanlar** (`uint16`, `float32`…): uzunluk tipten gelir,
 *   şemada `length` verilmesi gerekmez.
 * - **Uzunluğu şemadan gelenler** (`ascii`, `rawBytes`, `bcd`…): `length` ya da
 *   `lengthFrom` zorunludur.
 * - **Anlamsal tamsayılar** (`address`, `command`, `length`, `sequenceCounter`):
 *   genişlik şemadan gelir; tip yalnız ALANIN ROLÜNÜ söyler. Rol bilgisi boşuna
 *   değil — `length` alanı otomatik uzunluk hesabında, `sequenceCounter` paket
 *   üretiminde otomatik artırmada kullanılır (spec §10).
 */

export const FIELD_TYPES = [
  'uint8',
  'int8',
  'uint16',
  'int16',
  'uint24',
  'int24',
  'uint32',
  'int32',
  'uint64',
  'int64',
  'float16',
  'float32',
  'float64',
  'boolean',
  'bitField',
  'enum',
  'ascii',
  'utf8',
  'bcd',
  'unixTimestamp',
  'dateTime',
  'rawBytes',
  'array',
  'structure',
  'checksum',
  'crc',
  'padding',
  'reserved',
  'delimiter',
  'length',
  'sequenceCounter',
  'address',
  'command',
] as const;

export type FieldType = (typeof FIELD_TYPES)[number];

export type FieldValueKind =
  /** Tam sayı; `rawValue` number ya da bigint. */
  | 'integer'
  /** IEEE-754 ondalıklı. */
  | 'float'
  | 'boolean'
  /** Bayt sınırı tanımayan bit alanı. */
  | 'bits'
  /** Tam sayı + ad tablosu. */
  | 'enum'
  /** Karakter dizisi. */
  | 'text'
  /** Ham bayt; yorumlanmaz. */
  | 'bytes'
  /** Epoch/zaman damgası. */
  | 'timestamp'
  /** İçinde başka alanlar taşır. */
  | 'composite'
  /** Değeri diğer alanlardan HESAPLANIR; kullanıcı girmez. */
  | 'derived';

export interface FieldTypeInfo {
  readonly kind: FieldValueKind;
  /** Tipin sabit bayt genişliği. Yoksa uzunluk şemadan (`length`/`lengthFrom`) gelir. */
  readonly byteLength?: number;
  readonly signed?: boolean;
  /**
   * 53 bitten geniş: `Number.MAX_SAFE_INTEGER` aşılır, değer sessizce yuvarlanır.
   * Bu tipler `bigint` okunur (spec §47: "BigInt gereken yerlerde BigInt kullan").
   */
  readonly requiresBigInt?: boolean;
  /** Şemada `length` ya da `lengthFrom` verilmesi ZORUNLU mu. */
  readonly requiresExplicitLength?: boolean;
}

const INTEGER = (byteLength: number, signed: boolean): FieldTypeInfo => ({
  kind: 'integer',
  byteLength,
  signed,
});

export const FIELD_TYPE_INFO: Readonly<Record<FieldType, FieldTypeInfo>> = {
  uint8: INTEGER(1, false),
  int8: INTEGER(1, true),
  uint16: INTEGER(2, false),
  int16: INTEGER(2, true),
  // 24 bit standart bir C tipi değil ama sahada yaygın (sensör ADC'leri,
  // Modbus genişletmeleri); spec listeye almış.
  uint24: INTEGER(3, false),
  int24: INTEGER(3, true),
  uint32: INTEGER(4, false),
  int32: INTEGER(4, true),
  uint64: { kind: 'integer', byteLength: 8, signed: false, requiresBigInt: true },
  int64: { kind: 'integer', byteLength: 8, signed: true, requiresBigInt: true },

  float16: { kind: 'float', byteLength: 2 },
  float32: { kind: 'float', byteLength: 4 },
  float64: { kind: 'float', byteLength: 8 },

  boolean: { kind: 'boolean', byteLength: 1 },
  // Genişliği bit cinsindendir (`bitLength`), bayt cinsinden değil.
  bitField: { kind: 'bits' },
  enum: { kind: 'enum', requiresExplicitLength: true },

  ascii: { kind: 'text', requiresExplicitLength: true },
  utf8: { kind: 'text', requiresExplicitLength: true },
  bcd: { kind: 'integer', requiresExplicitLength: true },

  // Epoch saniye, 32 bit — spec §12'nin unixTimestamp aracıyla aynı tanım.
  unixTimestamp: { kind: 'timestamp', byteLength: 4, signed: false },
  // Milisaniye çözünürlüklü 64 bit; 2038 sınırı yok, bu yüzden BigInt.
  dateTime: { kind: 'timestamp', byteLength: 8, signed: false, requiresBigInt: true },

  rawBytes: { kind: 'bytes', requiresExplicitLength: true },
  array: { kind: 'composite' },
  structure: { kind: 'composite' },

  // Değerleri kapsama (coverage) alanlarından hesaplanır — kullanıcı giremez.
  checksum: { kind: 'derived' },
  crc: { kind: 'derived' },

  padding: { kind: 'bytes', requiresExplicitLength: true },
  reserved: { kind: 'bytes', requiresExplicitLength: true },
  delimiter: { kind: 'bytes', requiresExplicitLength: true },
  // Anlamsal roller: genişlik şemadan gelir, tip alanın NE İŞE YARADIĞINI söyler.
  length: { kind: 'integer', requiresExplicitLength: true },
  sequenceCounter: { kind: 'integer', requiresExplicitLength: true },
  address: { kind: 'integer', requiresExplicitLength: true },
  command: { kind: 'integer', requiresExplicitLength: true },
};

export function fieldTypeInfo(type: FieldType): FieldTypeInfo {
  return FIELD_TYPE_INFO[type];
}

/** Tipin kendi sabit genişliği var mı — yoksa uzunluk şemadan gelmeli. */
export function hasIntrinsicLength(type: FieldType): boolean {
  return FIELD_TYPE_INFO[type].byteLength !== undefined;
}

/** Değeri kullanıcıdan DEĞİL, diğer alanlardan hesaplanan tipler. */
export function isDerivedField(type: FieldType): boolean {
  return FIELD_TYPE_INFO[type].kind === 'derived';
}

export function isCompositeField(type: FieldType): boolean {
  return FIELD_TYPE_INFO[type].kind === 'composite';
}

export function requiresBigInt(type: FieldType): boolean {
  return FIELD_TYPE_INFO[type].requiresBigInt === true;
}
