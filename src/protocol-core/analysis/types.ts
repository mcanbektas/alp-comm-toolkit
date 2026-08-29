/**
 * Bilinmeyen protokol analizinin ortak girdi modeli (spec §35).
 *
 * Analiz motorları ÇERÇEVE KÜMESİ üzerinde çalışır: tek bir çerçeveden alan
 * yapısı çıkarılamaz — "sabit bayt" ancak birden çok çerçeve karşılaştırılınca
 * anlam kazanır, sayaç ancak ardışık değerlerle görülür. Bu yüzden bütün
 * motorların girdisi `readonly AnalysisFrame[]`tir ve hiçbiri tek çerçeveyle
 * anlamlı sonuç iddia etmez.
 *
 * Girdi `LogRecord`tan da (`protocol-core/logs`) canlı monitörden de gelebilir;
 * bu yüzden burada yalnız iki alan var — bağımlılık tersine dönmesin diye
 * `logs` tipleri BURAYA ithal EDİLMEZ, dönüştürme çağıranın işidir.
 */

export interface AnalysisFrame {
  readonly bytes: Uint8Array;
  /** Epoch ms ya da göreli ms; yoksa `undefined` — periyot analizi bunu ister. */
  readonly timestamp: number | undefined;
}

/** Çok baytlı alan okumalarında denenen bayt sırası. */
export type FieldEndianness = 'big' | 'little';

/** Denenen alan genişlikleri (bayt). 8 bayt yok: 64 bit `number`a sığmaz. */
export type FieldWidth = 1 | 2 | 4;

export const FIELD_WIDTHS: readonly FieldWidth[] = [1, 2, 4];
export const FIELD_ENDIANNESSES: readonly FieldEndianness[] = ['big', 'little'];

/**
 * Bir aday alanın konumu. `endianness` tek baytlık alanlarda anlamsızdır ama
 * yine de taşınır (`'big'` yazılır) — tüketicinin ayrı bir durum ele alması
 * gerekmesin diye.
 */
export interface FieldLocation {
  readonly offset: number;
  readonly width: FieldWidth;
  readonly endianness: FieldEndianness;
}

/** Aynı alanın iki kez (BE ve LE) raporlanmaması için tek baytta BE sabittir. */
export function normalizeEndianness(width: FieldWidth, endianness: FieldEndianness): FieldEndianness {
  return width === 1 ? 'big' : endianness;
}
