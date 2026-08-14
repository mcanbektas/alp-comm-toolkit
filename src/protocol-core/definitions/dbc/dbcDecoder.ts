/**
 * DBC sinyal çözücüsü — CAN payload'ı + `DbcMessage` → fiziksel değerler.
 *
 * Spec §17.4'ün tek formülü burada uygulanır: `Physical = Raw × Factor + Offset`.
 *
 * ── TUZAK: İKİ BAYT SIRASI, İKİ FARKLI BAŞLANGIÇ BİTİ ANLAMI ────────────────
 *
 * DBC her iki bayt sırası için de AYNI bit numaralandırmasını kullanır (bit N =
 * `floor(N/8)`. baytın, LSB'den sayarak `N%8`. biti) ama `startBit`in NE OLDUĞU
 * değişir:
 *
 *   Intel (`@1`)    → `startBit` sinyalin EN DÜŞÜK bitidir, okuma artan bit
 *                     numarasında ilerler.
 *   Motorola (`@0`) → `startBit` sinyalin EN YÜKSEK bitidir, okuma bayt içinde
 *                     azalan bit numarasında ilerler ve sonraki baytın 7.
 *                     bitinden devam eder.
 *
 * `bitCursor` bu iki yürüyüşü zaten biliyor: `lsb-first` birincisini, `msb-first`
 * ikincisini birebir karşılıyor. Tek gereken, Motorola'da DBC'nin testere dişi
 * numarasını `msb-first` MUTLAK konumuna çevirmek — `motorolaStartToAbsoluteBit`.
 * Bu çeviri atlanırsa sinyaller "çözülür" ama değerler sessizce yanlış çıkar;
 * hiçbir hata oluşmaz, bu yüzden fixture'la çivilenmiştir.
 *
 * ── ÇOKLAMA (multiplexing) ──────────────────────────────────────────────────
 * Bir mesaj aynı bitleri farklı anlamlarla tekrar kullanabilir. Çoklayıcı
 * anahtar (`M`) önce çözülür; `m<N>` sinyalleri YALNIZ anahtarın değeri N ise
 * listeye girer. Hepsini birden basmak, aynı bitleri çelişen iki değer olarak
 * göstermek olurdu.
 */

import { BITS_PER_BYTE, readBits, toSignedBits } from '../../decoding/bitCursor';
import type { DbcDecodedSignal, DbcMessage, DbcSignal } from './dbcTypes';

/** `Number`'a güvenle sığan azami bit genişliği; üstü sessizce yuvarlanır. */
const SAFE_INTEGER_BITS = 53;

/**
 * DBC'nin testere dişi bit numarasını `bitCursor`ın `msb-first` MUTLAK
 * konumuna çevirir (yalnız Motorola için gerekir).
 *
 * DBC: bit N = `floor(N/8)`. bayt, LSB'den `N%8`. bit.
 * msb-first mutlak: `byteIndex * 8 + (7 - lsbIndex)`.
 */
export function motorolaStartToAbsoluteBit(startBit: number): number {
  const byteIndex = Math.floor(startBit / BITS_PER_BYTE);
  const lsbIndex = startBit % BITS_PER_BYTE;
  return byteIndex * BITS_PER_BYTE + (BITS_PER_BYTE - 1 - lsbIndex);
}

/** Sinyalin okunacağı mutlak bit konumu ve yürüyüş yönü. */
interface BitWindow {
  readonly position: number;
  readonly order: 'msb-first' | 'lsb-first';
}

function bitWindowFor(signal: DbcSignal): BitWindow {
  return signal.byteOrder === 'intel'
    ? { position: signal.startBit, order: 'lsb-first' }
    : { position: motorolaStartToAbsoluteBit(signal.startBit), order: 'msb-first' };
}

/**
 * Tek bir sinyalin HAM değerini okur. Sinyal çerçeveye sığmıyorsa `undefined`
 * döner — `readBits` bu durumda fırlatır, ama kısa bir çerçeve beklenen bir
 * durumdur (DBC 8 bayt der, hat 3 bayt getirir) ve uygulamayı çökertmemeli.
 */
export function readDbcSignalRaw(data: Uint8Array, signal: DbcSignal): number | undefined {
  if (signal.bitLength <= 0 || signal.bitLength > SAFE_INTEGER_BITS) return undefined;
  const window = bitWindowFor(signal);
  if (window.position < 0 || window.position + signal.bitLength > data.length * BITS_PER_BYTE) {
    return undefined;
  }
  const rawBits = readBits(data, window.position, signal.bitLength, window.order);
  return Number(signal.signed ? toSignedBits(rawBits, signal.bitLength) : rawBits);
}

function decodeOne(data: Uint8Array, signal: DbcSignal): DbcDecodedSignal | undefined {
  const rawValue = readDbcSignalRaw(data, signal);
  if (rawValue === undefined) return undefined;

  // Spec §17.4'ün tek formülü.
  const physicalValue = rawValue * signal.factor + signal.offset;
  const label = signal.valueTable?.get(rawValue);
  // min ve max'ın ikisi de 0 ise DBC "aralık bildirilmedi" demektir; o durumda
  // her değeri aralık dışı saymak bütün sinyalleri kırmızıya boyardı.
  const rangeDeclared = signal.minimum !== 0 || signal.maximum !== 0;
  const outOfRange =
    rangeDeclared && (physicalValue < signal.minimum || physicalValue > signal.maximum);

  return {
    signal,
    rawValue,
    physicalValue,
    ...(label === undefined ? {} : { label }),
    outOfRange,
  };
}

/**
 * Bir mesajın bütün geçerli sinyallerini çözer.
 *
 * Çoklanmış sinyaller yalnız çoklayıcı anahtarın değeri eşleşiyorsa döner.
 * Çerçeveye sığmayan sinyaller sessizce atlanır — kısa çerçeve bir hata değil,
 * beklenen bir durumdur.
 */
export function decodeDbcMessage(data: Uint8Array, message: DbcMessage): DbcDecodedSignal[] {
  const multiplexor = message.signals.find((signal) => signal.multiplex.kind === 'multiplexor');
  const switchValue =
    multiplexor === undefined ? undefined : readDbcSignalRaw(data, multiplexor);

  const decoded: DbcDecodedSignal[] = [];
  for (const signal of message.signals) {
    if (signal.multiplex.kind === 'multiplexed') {
      // Anahtar okunamadıysa hiçbir çoklanmış sinyal gösterilmez: hangi
      // yorumun geçerli olduğu bilinmiyor demektir.
      if (switchValue === undefined || switchValue !== signal.multiplex.switchValue) {
        continue;
      }
    }
    const result = decodeOne(data, signal);
    if (result !== undefined) decoded.push(result);
  }
  return decoded;
}
