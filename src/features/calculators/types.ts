import type { TranslationKey } from '@/translations';

/** Spec §12 (dönüşüm), §13 (zamanlama) ve §11 (CRC Finder) — üç grup, hesap araçları listesinin tamamı. */
export type CalculatorCategory = 'conversion' | 'timing' | 'checksum';

export interface CalculatorTool {
  id: string;
  category: CalculatorCategory;
  nameKey: TranslationKey;
  summaryKey: TranslationKey;
}
