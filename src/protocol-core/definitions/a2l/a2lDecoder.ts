/**
 * A2L ölçümünün ham baytlardan fiziksel değere çözülmesi.
 *
 * İki adım var ve ikisi de ayrı ayrı yanlış yapılabiliyor:
 *
 * 1. **Bayt → ham sayı.** Veri tipi genişliği verir, `BYTE_ORDER` sırayı.
 *    A2L'in `MSB_FIRST`i big-endian, `MSB_LAST`i little-endian demektir ve
 *    ASAM varsayılanı `MSB_LAST`tır — DBC/EDS alışkanlığıyla big-endian
 *    varsaymak, aynı baytlardan başka sayı üretir.
 *
 * 2. **Ham sayı → fiziksel değer.** COMPU_METHOD'un YÖNÜ burada kritik:
 *
 *    - `LINEAR` doğrudan yönde tanımlıdır: `phys = a × int + b`.
 *    - `RAT_FUNC` TERS yönde tanımlıdır: `int = (a·phys² + b·phys + c) /
 *      (d·phys² + e·phys + f)`. Çözümleme için tersi gerekir ve bu ancak
 *      ikinci derece terimler yokken kapalı biçimde çözülür:
 *      `a = d = e = 0` → `phys = (f × int − c) / b`.
 *
 *    İki katsayı kümesini aynıymış gibi okumak yaygın bir hatadır ve çökme
 *    üretmez — sessizce yanlış fiziksel değer üretir. Desteklenmeyen durumda
 *    (ikinci derece RAT_FUNC, FORM, TAB_INTP) ham değer gösterilir ve NEDENİ
 *    söylenir; uydurulmuş formül YOK.
 */

import { decodeFloat32, decodeFloat64 } from '../../encoding/ieee754';

import type { A2lByteOrder, A2lCompuMethod, A2lDataType, A2lMeasurement, A2lVerbalTable } from './a2lTypes';

const BITS_PER_BYTE = 8;

/** Veri tipinin bayt genişliği. */
export function dataTypeWidth(dataType: A2lDataType): number {
  switch (dataType) {
    case 'UBYTE':
    case 'SBYTE':
      return 1;
    case 'UWORD':
    case 'SWORD':
    case 'FLOAT16_IEEE':
      return 2;
    case 'ULONG':
    case 'SLONG':
    case 'FLOAT32_IEEE':
      return 4;
    case 'A_UINT64':
    case 'A_INT64':
    case 'FLOAT64_IEEE':
      return 8;
  }
}

function isSigned(dataType: A2lDataType): boolean {
  return dataType === 'SBYTE' || dataType === 'SWORD' || dataType === 'SLONG' || dataType === 'A_INT64';
}

/**
 * Tamsayı okuma `bigint` üzerinden yapılır: `A_UINT64` 2^53'ü aşabilir ve
 * `number` ile okunursa sessizce yuvarlanır. Dar tipler sonunda `number`a
 * indiriliyor, çünkü ölçek/ofset hesabı zaten kayan noktada.
 */
function readInteger(bytes: Uint8Array, order: A2lByteOrder, signed: boolean): bigint {
  const ordered = order === 'MSB_FIRST' ? bytes : Uint8Array.from(bytes).reverse();
  let value = 0n;
  for (const byte of ordered) {
    value = (value << BigInt(BITS_PER_BYTE)) | BigInt(byte);
  }
  if (!signed) return value;

  const bits = BigInt(bytes.length * BITS_PER_BYTE);
  const limit = 1n << (bits - 1n);
  return value >= limit ? value - (1n << bits) : value;
}

export type A2lDecodeResult =
  | {
      readonly success: true;
      readonly rawValue: number | bigint;
      /** Dönüşüm uygulanamadıysa ham değerle aynıdır. */
      readonly physicalValue: number | bigint | string;
      readonly unit: string;
      /** Fiziksel değer üretilemediyse nedeni; çeviri anahtarı. */
      readonly conversionNoteKey?: string;
    }
  | {
      readonly success: false;
      readonly messageKey: string;
      readonly requiredBytes: number;
    };

/**
 * `bytes` bu ölçümün BAYTLARIDIR — DTO'nun tamamı değil. Hangi ölçümün
 * pakette nerede durduğu DAQ listesine bağlıdır ve o bilgi A2L'de değil,
 * XCP oturumundadır.
 */
export function decodeA2lMeasurement(
  measurement: A2lMeasurement,
  bytes: Uint8Array,
  defaultByteOrder: A2lByteOrder,
  method: A2lCompuMethod | null,
  verbalTable: A2lVerbalTable | null,
): A2lDecodeResult {
  const width = dataTypeWidth(measurement.dataType);
  if (bytes.length < width) {
    return { success: false, messageKey: 'definition.a2l.decode.tooShort', requiredBytes: width };
  }

  const order = measurement.byteOrder ?? defaultByteOrder;
  const slice = bytes.slice(0, width);

  let raw: number | bigint;
  if (measurement.dataType === 'FLOAT32_IEEE') {
    raw = decodeFloat32(order === 'MSB_FIRST' ? slice : Uint8Array.from(slice).reverse(), 'big');
  } else if (measurement.dataType === 'FLOAT64_IEEE') {
    raw = decodeFloat64(order === 'MSB_FIRST' ? slice : Uint8Array.from(slice).reverse(), 'big');
  } else if (measurement.dataType === 'FLOAT16_IEEE') {
    // 16-bit float `ieee754`de var ama A2L'de nadir; tam sayı yolundan
    // geçirmemek için ayrı tutuldu.
    raw = decodeFloat32(
      Uint8Array.from([0, 0, ...(order === 'MSB_FIRST' ? slice : Uint8Array.from(slice).reverse())]),
      'big',
    );
  } else {
    const integer = readInteger(slice, order, isSigned(measurement.dataType));
    const masked = applyBitMask(integer, measurement.bitMask);
    // 64-bit tipler `bigint` kalır; ötekiler `number`a iner ve hesaba girer.
    raw = width === 8 ? masked : Number(masked);
  }

  return applyConversion(measurement, raw, method, verbalTable);
}

/**
 * `BIT_MASK` maskeyi uygular VE sonucu maskenin en düşük set bitine göre sağa
 * kaydırır. Kaydırmamak, bit alanını doğru maskeleyip yanlış ölçekte okumak
 * olurdu (0x0F00 maskeli bir alan 256 katı büyük çıkardı).
 */
function applyBitMask(value: bigint, mask: number | undefined): bigint {
  if (mask === undefined || mask === 0) return value;
  const maskBig = BigInt(mask);
  let shift = 0n;
  while (((maskBig >> shift) & 1n) === 0n) shift++;
  return (value & maskBig) >> shift;
}

function applyConversion(
  measurement: A2lMeasurement,
  raw: number | bigint,
  method: A2lCompuMethod | null,
  verbalTable: A2lVerbalTable | null,
): A2lDecodeResult {
  const unit = measurement.unit ?? method?.unit ?? '';

  if (method === null) {
    return { success: true, rawValue: raw, physicalValue: raw, unit };
  }

  switch (method.conversionType) {
    case 'IDENTICAL':
      return { success: true, rawValue: raw, physicalValue: raw, unit };

    case 'LINEAR': {
      if (method.coeffsLinear === undefined) {
        return note(raw, unit, 'definition.a2l.note.missingCoeffs');
      }
      const [a, b] = method.coeffsLinear;
      return { success: true, rawValue: raw, physicalValue: round(Number(raw) * a + b), unit };
    }

    case 'RAT_FUNC': {
      if (method.coeffs === undefined) {
        return note(raw, unit, 'definition.a2l.note.missingCoeffs');
      }
      const [a, b, c, d, e, f] = method.coeffs;
      // İkinci derece terimler varsa ters çözüm kapalı biçimde yok: iki kök
      // çıkar ve hangisinin fiziksel olduğunu A2L SÖYLEMEZ. Tahmin etmek
      // yerine ham değer gösterilir.
      if (a !== 0 || d !== 0 || e !== 0) {
        return note(raw, unit, 'definition.a2l.note.nonLinearRatFunc');
      }
      if (b === 0) {
        return note(raw, unit, 'definition.a2l.note.notInvertible');
      }
      return { success: true, rawValue: raw, physicalValue: round((Number(raw) * f - c) / b), unit };
    }

    case 'TAB_VERB': {
      const label = verbalTable?.values[String(raw)];
      // Tabloda karşılığı olmayan ham değer UYDURULMAZ; sayı olarak kalır.
      return label === undefined
        ? note(raw, unit, 'definition.a2l.note.noVerbalMatch')
        : { success: true, rawValue: raw, physicalValue: label, unit };
    }

    case 'TAB_INTP':
    case 'TAB_NOINTP':
      return note(raw, unit, 'definition.a2l.note.tableNotLoaded');

    case 'FORM':
      return note(raw, unit, 'definition.a2l.note.formulaUnsupported');

    case 'UNKNOWN':
      return note(raw, unit, 'definition.a2l.note.unknownConversion');
  }
}

function note(raw: number | bigint, unit: string, key: string): A2lDecodeResult {
  return { success: true, rawValue: raw, physicalValue: raw, unit, conversionNoteKey: key };
}

/** Kayan nokta artığı temizlenir — `vendorMapDecoder`ın aynı gerekçesi. */
function round(value: number): number {
  return Number(value.toPrecision(12));
}
