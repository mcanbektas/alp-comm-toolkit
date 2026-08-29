/**
 * Bayt sırası tahmini — spec §35 "Endianness tahmini". Spec yöntem vermiyor;
 * buradaki ölçüt sayıların DEĞİŞİM DAĞILIMIDIR.
 *
 * Bir sayaç ya da ölçüm alanında en anlamlı bayt (MSB) en az, en anlamsız bayt
 * (LSB) en çok değişir: 0x0100'den 0x0101'e giden bir sayaçta üst bayt sabit
 * kalırken alt bayt her adımda oynar. Alanın içindeki sütunların değişim
 * oranlarına bakmak bu yüzden bayt sırasını ele verir:
 *
 * · Soldaki bayt sağdakinden AZ değişiyorsa MSB soldadır → büyük uçlu.
 * · Sağdaki soldakinden az değişiyorsa MSB sağdadır → küçük uçlu.
 * · Eşitse veri karar vermeye yetmez → `undefined` (0 ya da varsayılan bir
 *   sıra dönmek, olmayan bir bilgiyi varmış gibi gösterirdi).
 *
 * SINIR: ölçüt yalnız değişen alanlarda çalışır. Sabit bir alanda bütün
 * oranlar 0'dır ve cevap `undefined`tır — doğru cevap da budur, çünkü sabit
 * bir sayının bayt sırası veriden okunamaz.
 */

import { profileByteColumns } from './byteColumns';
import type { AnalysisFrame, FieldEndianness, FieldWidth } from './types';

export interface EndiannessGuess {
  readonly endianness: FieldEndianness | undefined;
  /** İlk (soldaki) baytın değişim oranı. */
  readonly firstByteChangeRate: number | undefined;
  /** Son (sağdaki) baytın değişim oranı. */
  readonly lastByteChangeRate: number | undefined;
}

export function guessFieldEndianness(
  frames: readonly AnalysisFrame[],
  offset: number,
  width: FieldWidth,
): EndiannessGuess {
  if (width === 1) {
    // Tek baytın bayt sırası yoktur; soru anlamsız.
    return { endianness: undefined, firstByteChangeRate: undefined, lastByteChangeRate: undefined };
  }

  const profiles = profileByteColumns(frames);
  const first = profiles[offset];
  const last = profiles[offset + width - 1];
  const firstRate = first?.changeRate;
  const lastRate = last?.changeRate;

  if (firstRate === undefined || lastRate === undefined || firstRate === lastRate) {
    return { endianness: undefined, firstByteChangeRate: firstRate, lastByteChangeRate: lastRate };
  }

  return {
    endianness: firstRate < lastRate ? 'big' : 'little',
    firstByteChangeRate: firstRate,
    lastByteChangeRate: lastRate,
  };
}
