/**
 * LRC (Longitudinal Redundancy Check), Modbus ASCII'de kullanılan tanımıyla:
 * byte'ların toplamının 8-bit two's complement'i — formül olarak `twosComplementChecksum`
 * ile BİREBİR AYNI. Yine de ayrı, isimlendirilmiş bir fonksiyon olarak sağlanır:
 * çağıran kodda "LRC hesapla" niyeti "SUM-8'i tersine çevir" niyetinden farklı
 * okunur ve Modbus katmanı ileride yalnız bu isimle arama yapacaktır.
 */

import { twosComplementChecksum } from './simpleChecksums';

/**
 * Modbus resmi örneği (adres 0x11, fonksiyon 0x03, start 0x006B, count 0x0003)
 * üzerinde doğrulanmıştır: byte toplamı 0x11+0x03+0x00+0x6B+0x00+0x03 = 0x82,
 * two's complement'i 0x100 − 0x82 = 0x7E. Bu dosyanın testinde kullanılan değer
 * BUDUR (0x7E) — görev tarifindeki "0x87" iddiası bu elle yapılan toplamla
 * TUTARSIZ çıktı (muhtemelen 0x7E'nin rakamları ters yazılmış); implementasyonun
 * ürettiği ve elle doğrulanan değer esas alındı, uydurma iddia değil.
 */
export function lrcChecksum(bytes: Uint8Array): number {
  return twosComplementChecksum(bytes);
}
