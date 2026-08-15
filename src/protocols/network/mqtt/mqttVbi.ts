/**
 * MQTT Variable Byte Integer (VBI) — OASIS MQTT spec §1.5.5 (MQTT 5.0) / §2.2.3
 * (MQTT 3.1.1, aynı algoritma). Hem CONTROL PACKET'in Fixed Header'ındaki
 * "Remaining Length" alanı HEM DE v5 Properties bloğunun "Property Length"
 * alanı BU KODLAMAYI kullanır — repo'da tek bir VBI yardımcısı burada yazılır,
 * ikisi de (mqtt.ts) BU MODÜLDEN import eder, ikinci bir kopya YAZILMAZ
 * (brief-faz10-dalga4.md tuzak notu).
 *
 * ── ALGORİTMA (OASIS'in kendi sözde-kodu, birebir) ───────────────────────────
 * Her bayt 7 bit VERİ + 1 bit DEVAM (MSB, bit 7) taşır. Baytlar küçük-uçlu
 * (little-endian) SIRAYLA gelir: İLK bayt değerin EN AZ ANLAMLI 7 bitini
 * taşır — bu, ağ protokollerinin alıştığı büyük-uçlu bayt sırasının TERSİDİR,
 * kasıtlı bir tuzak notu. Devam biti (bit 7) 1 ise bir sonraki bayt okunur;
 * 0 ise değer biter.
 *
 * ── ÜST SINIR: EN ÇOK 4 BAYT ─────────────────────────────────────────────────
 * Spec dördüncü bayttan sonra hâlâ devam biti set'liyse encoding'i "malformed"
 * ilan eder — bu MQTT'nin kendi kuralı, taşma korumasından fazlası: 4 bayt x
 * 7 bit = 28 bit temsil kapasitesi VAR OLMASI GEREKEN azami değerle
 * (268 435 455 = 0x0FFFFFFF) TAM örtüşür; 5. bayt asla meşru değildir.
 *
 * ── TEST VEKTÖRLERİ (OASIS'in kendi örnekleri, mqttVbi.test.ts'te doğrulanır) ─
 * 127 (0x7F) → tek bayt; 128 (0x80,0x01) → iki bayt; 16 383/16 384 iki/üç bayt
 * sınırı; 2 097 151/2 097 152 üç/dört bayt sınırı; 268 435 455 azami dört
 * baytlık değer; dördüncü baytta hâlâ devam biti set → malformed.
 */

/** Bir baytın taşıdığı veri biti sayısı; üst bit (0x80) yalnız devam bayrağıdır. */
const DATA_BITS_PER_BYTE = 7;
const CONTINUATION_BIT = 0x80;
const DATA_BIT_MASK = 0x7f;

/** OASIS'in kendisi verdiği üst sınır: dört baytlık VBI'nin temsil edebileceği azami değer. */
export const MQTT_VBI_MAX_VALUE = 268_435_455;
/** Dördüncü bayttan sonra devam biti hâlâ set'liyse "malformed" (dosya başı). */
export const MQTT_VBI_MAX_BYTES = 4;

export type VbiDecodeResult =
  | { readonly success: true; readonly value: number; readonly length: number }
  | { readonly success: false; readonly reason: 'truncated' | 'malformed' };

/**
 * `bytes[offset..]`den bir Variable Byte Integer okur.
 *
 * İki AYRI başarısızlık sınıfı vardır ve çağıran (mqtt.ts) bunları FARKLI
 * yorumlar: `'truncated'` arabellek VBI bitmeden tükendi demektir (belki daha
 * fazla veri gelecektir — "eksik veri" sınıfı); `'malformed'` arabellekte
 * bayt VARDIR ama kodlamanın kendisi OASIS kuralını (en çok 4 bayt) ihlal
 * eder — bu asla meşru olamayacak yapısal bir hatadır.
 */
export function decodeVariableByteInteger(bytes: Uint8Array, offset: number): VbiDecodeResult {
  let value = 0;
  let multiplier = 1;

  for (let index = 0; index < MQTT_VBI_MAX_BYTES; index += 1) {
    const byte = bytes[offset + index];
    if (byte === undefined) {
      return { success: false, reason: 'truncated' };
    }

    value += (byte & DATA_BIT_MASK) * multiplier;

    if ((byte & CONTINUATION_BIT) === 0) {
      return { success: true, value, length: index + 1 };
    }

    multiplier *= 2 ** DATA_BITS_PER_BYTE;
  }

  // Dört bayt tükendi, hâlâ devam biti set — OASIS'in "malformed" kuralı (dosya başı).
  return { success: false, reason: 'malformed' };
}

/**
 * `value`yi Variable Byte Integer baytlarına kodlar. `decodeVariableByteInteger`
 * ile TERS işlem — örnek çerçeve üretiminde ve testte kullanılır, motorun ana
 * karar yolunda ZORUNLU değildir (decode önceliklidir, brief-faz10-dalga4.md).
 */
export function encodeVariableByteInteger(value: number): Uint8Array {
  if (!Number.isInteger(value) || value < 0 || value > MQTT_VBI_MAX_VALUE) {
    throw new RangeError(
      `Variable Byte Integer 0..${String(MQTT_VBI_MAX_VALUE)} aralığında olmalı, alınan: ${String(value)}`,
    );
  }

  const bytes: number[] = [];
  let remaining = value;
  do {
    let encodedByte = remaining % 128;
    remaining = Math.floor(remaining / 128);
    if (remaining > 0) {
      encodedByte |= CONTINUATION_BIT;
    }
    bytes.push(encodedByte);
  } while (remaining > 0);

  return Uint8Array.from(bytes);
}
