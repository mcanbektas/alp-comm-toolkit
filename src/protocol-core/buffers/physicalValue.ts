/**
 * Fiziksel değer ↔ ham değer dönüşümü (spec §9.2). Kalibrasyon eğrisi doğrusal
 * kabul edilir: `scale`/`offset` protokole özgü alan tanımından gelir (DBC
 * `Factor`/`Offset`, ARINC 429 `Resolution` gibi karşılıkların ortak paydası,
 * bkz. `types.ts` `ParsedField.rawValue`/`physicalValue` ayrımı).
 */

/** Physical Value = Raw Value × Scale + Offset. */
export function toPhysicalValue(rawValue: number, scale: number, offset: number): number {
  return rawValue * scale + offset;
}

/** Raw Value = (Physical Value − Offset) / Scale. */
export function toRawValue(physicalValue: number, scale: number, offset: number): number {
  if (scale === 0) {
    // scale=0 ile geri dönmek 0'a bölmek demektir — kalibrasyon tanımı bozuktur, sessizce Infinity/NaN üretmek yerine erken patlar.
    throw new RangeError('scale must not be zero when converting back to a raw value');
  }
  return (physicalValue - offset) / scale;
}
