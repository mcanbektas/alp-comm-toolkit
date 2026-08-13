/**
 * HDLC bit istifleme (bit stuffing) — spec §8.4 satır 156-173, "Dikkat
 * çekenler" satır 1258. Gerçek eşzamanlı (senkron) HDLC donanımı çerçeveyi
 * BİT düzeyinde iletir: gönderen art arda 5 adet `1` bitinden sonra bir `0`
 * bit ekler (spec satır 161), alıcı aynı deseni görünce onu ATAR. Bu, `0x7E`
 * bayrağının bit deseninin (`0111 1110` — ortada ALTI art arda `1`) veri
 * içinde YANLIŞLIKLA belirmesini imkansız kılar: istiflenmiş veride en uzun
 * `1` dizisi asla 5'i geçemez.
 *
 * `hdlcFraming.ts`teki `hdlc-flag` yöntemi BUNU KULLANMAZ — o, bu araç
 * setinin hedeflediği seri port/WebSocket bağlamında gerçekçi olan BAYT
 * odaklı "async HDLC" kaçış kuralını (PPP'yle aynı, `escapedDelimiterFraming`
 * üzerinden) kullanır. Bu dosya ayrı bir, bilinçli olarak dar kapsamlı araç:
 * BİT düzeyinde zaten yakalanmış veriyi (örn. bir mantık analizörü dökümü)
 * çözümlemek için doğru ve test edilmiş bir ilkel sağlar — canlı bir bayt
 * akışından bit-hizasız çerçeve çıkarmak (ayrı bir "bit imleci" gerektirir)
 * bu fazın kapsamı DIŞINDA bırakıldı, `FrameExtractor` sözleşmesi zaten bayt
 * arabelleği üzerine kurulu.
 */

const CONSECUTIVE_ONES_LIMIT = 5;
const BITS_PER_BYTE = 8;

export interface BitStream {
  /** MSB önce paketlenmiş baytlar; son bayt gerekirse `0` ile doldurulur. */
  readonly bytes: Uint8Array;
  /** Doldurma dahil olmayan gerçek bit sayısı. */
  readonly bitLength: number;
}

function getBit(data: Uint8Array, bitIndex: number): 0 | 1 {
  const byteIndex = bitIndex >> 3;
  const bitOffset = 7 - (bitIndex & 7);
  const byte = data[byteIndex] ?? 0;
  return ((byte >> bitOffset) & 1) as 0 | 1;
}

function packBits(bits: readonly (0 | 1)[]): BitStream {
  const bytes = new Uint8Array(Math.ceil(bits.length / BITS_PER_BYTE));
  bits.forEach((bit, index) => {
    if (bit !== 1) return;
    const byteIndex = index >> 3;
    const bitOffset = 7 - (index & 7);
    bytes[byteIndex] = (bytes[byteIndex] ?? 0) | (1 << bitOffset);
  });
  return { bytes, bitLength: bits.length };
}

function unpackBits(stream: BitStream): (0 | 1)[] {
  const bits: (0 | 1)[] = [];
  for (let i = 0; i < stream.bitLength; i += 1) bits.push(getBit(stream.bytes, i));
  return bits;
}

/** Ham baytları bit istifleyerek `BitStream`e çevirir. */
export function stuffBits(data: Uint8Array): BitStream {
  const inputBitLength = data.length * BITS_PER_BYTE;
  const outputBits: (0 | 1)[] = [];
  let onesRun = 0;

  for (let i = 0; i < inputBitLength; i += 1) {
    const bit = getBit(data, i);
    outputBits.push(bit);
    if (bit === 1) {
      onesRun += 1;
      if (onesRun === CONSECUTIVE_ONES_LIMIT) {
        outputBits.push(0);
        onesRun = 0;
      }
    } else {
      onesRun = 0;
    }
  }

  return packBits(outputBits);
}

export type DestuffResult = { ok: true; data: Uint8Array } | { ok: false; code: 'invalid-stuffing'; offset: number };

/** İstiflenmiş bir `BitStream`i ham baytlara çözer; istiflenmiş bit sırası bozulmuşsa hata döner. */
export function destuffBits(stream: BitStream): DestuffResult {
  const bits = unpackBits(stream);
  const outputBits: (0 | 1)[] = [];
  let onesRun = 0;

  for (let i = 0; i < bits.length; i += 1) {
    const bit = bits[i];
    if (bit === undefined) break; // döngü sınırı zaten `bits.length`

    if (onesRun === CONSECUTIVE_ONES_LIMIT) {
      if (bit !== 0) return { ok: false, code: 'invalid-stuffing', offset: i };
      onesRun = 0;
      continue; // istiflenmiş bit çıktıya YAZILMAZ
    }

    outputBits.push(bit);
    onesRun = bit === 1 ? onesRun + 1 : 0;
  }

  if (outputBits.length % BITS_PER_BYTE !== 0) {
    return { ok: false, code: 'invalid-stuffing', offset: bits.length };
  }

  return { ok: true, data: packBits(outputBits).bytes };
}
