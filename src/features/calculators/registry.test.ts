import { describe, expect, it } from 'vitest';

import { TOOL_RENDERERS } from '@/pages/CalculatorPage';
// Tam sözlük: bazı araçların özeti `protocol.*` namespace'inden geliyor ve o
// namespace artık ayrı bir chunk (bkz. `translations/all.ts`).
import { translations } from '@/translations/all';
import { CALCULATOR_TOOLS } from './registry';

/**
 * `CALCULATOR_TOOLS` veri bütünlüğü — `catalog.test.ts`teki desenin küçük
 * ölçekli karşılığı. Asıl risk burada "34 araç" sayısını doğrulamak değil,
 * `nameKey`/`summaryKey`nin gerçekten sözlükte VAR olduğunu ve boş
 * bırakılmadığını garanti etmek: bir yazım hatası derleyiciyi geçer
 * (`TranslationKey` union'ı üretimden bağımsız yazılmış bir string'le hâlâ
 * eşleşebilir), yalnız burada yakalanır.
 */
describe('CALCULATOR_TOOLS', () => {
  it('keeps every tool id unique', () => {
    const ids = CALCULATOR_TOOLS.map((tool) => tool.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('points nameKey/summaryKey at real, non-blank tr.ts entries', () => {
    const dictionary = translations.tr;
    for (const tool of CALCULATOR_TOOLS) {
      expect(dictionary[tool.nameKey], `${tool.id}.nameKey (${tool.nameKey})`).toBeDefined();
      expect(dictionary[tool.nameKey].trim(), `${tool.id}.nameKey (${tool.nameKey}) is blank`).not.toBe('');
      expect(dictionary[tool.summaryKey], `${tool.id}.summaryKey (${tool.summaryKey})`).toBeDefined();
      expect(dictionary[tool.summaryKey].trim(), `${tool.id}.summaryKey (${tool.summaryKey}) is blank`).not.toBe('');
    }
  });

  it('uses kebab-case ids matching the URL segment convention', () => {
    for (const tool of CALCULATOR_TOOLS) {
      expect(tool.id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
  });

  it('has a CalculatorPage renderer for every registered id, and no orphan renderers', () => {
    // İki yönlü kontrol: kayıtlı ama bileşensiz araç `NotFoundPage`e sessizce
    // düşer, bileşenli ama kayıtsız araç hiç gezinilemez — ikisi de burada yakalanır.
    const registryIds = CALCULATOR_TOOLS.map((tool) => tool.id);
    const rendererIds = Object.keys(TOOL_RENDERERS);
    expect(registryIds.filter((id) => !rendererIds.includes(id))).toEqual([]);
    expect(rendererIds.filter((id) => !registryIds.includes(id))).toEqual([]);
  });
});
