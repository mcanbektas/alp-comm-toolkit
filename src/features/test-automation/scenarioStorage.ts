/**
 * Senaryonun tarayıcı deposundaki yeri.
 *
 * Ayrı bir dosya, çünkü İKİ tüketicisi var: Test Automation ekranı (kendi
 * senaryosunu saklar) ve proje deposu (§40'ın proje dosyasına senaryoyu yazar,
 * dosyadan geleni geri koyar). `useTestAutomation` içinde kalsaydı store bir
 * React hook'una bağımlı olurdu.
 *
 * Okuma tarafı ASLA istisna atmaz: bozuk ya da eski sürümlü bir kayıt ekranı
 * açılmaz yapmamalı, varsayılana düşülür. Ama sürümü tutmayan kayıt SESSİZCE
 * de yüklenmez — eski bir şemayı yeni model sanmak, adım alanlarını
 * `undefined` bırakıp koşuyu ortasında düşürürdü.
 */

import { SCENARIO_FORMAT_VERSION } from './scenario';
import type { TestScenario } from './scenario';

export const SCENARIO_STORAGE_KEY = 'alp-comm-test-scenario';

/** Metnin gerçekten bu sürümden bir senaryo olup olmadığını doğrular. */
export function parseScenarioJson(text: string): TestScenario | undefined {
  try {
    const parsed: unknown = JSON.parse(text);
    if (typeof parsed !== 'object' || parsed === null) return undefined;
    const candidate = parsed as TestScenario;
    if (candidate.formatVersion !== SCENARIO_FORMAT_VERSION) return undefined;
    if (typeof candidate.name !== 'string' || !Array.isArray(candidate.steps)) return undefined;
    return candidate;
  } catch {
    return undefined;
  }
}

export function readStoredScenario(): TestScenario | undefined {
  try {
    const raw = window.localStorage.getItem(SCENARIO_STORAGE_KEY);
    return raw === null ? undefined : parseScenarioJson(raw);
  } catch {
    // Depolama kapalı (gizli sekme, kota); varsayılan senaryo yine açılır.
    return undefined;
  }
}

export function writeStoredScenario(scenario: TestScenario): void {
  try {
    window.localStorage.setItem(SCENARIO_STORAGE_KEY, JSON.stringify(scenario));
  } catch {
    // Yazamamak düzenlemeyi engellememeli.
  }
}

/** Proje dosyasına gidecek METİN. Kayıt yoksa `undefined` — boş metin YAZILMAZ. */
export function readStoredScenarioJson(): string | undefined {
  try {
    const raw = window.localStorage.getItem(SCENARIO_STORAGE_KEY);
    if (raw === null) return undefined;
    // Bozuk kaydı projeye taşımak, hatayı ikinci bir dosyaya kopyalamak olurdu.
    return parseScenarioJson(raw) === undefined ? undefined : raw;
  } catch {
    return undefined;
  }
}

/** Proje dosyasından gelen metni depoya koyar; geçersizse DOKUNMAZ. */
export function writeStoredScenarioJson(text: string): boolean {
  if (parseScenarioJson(text) === undefined) return false;
  try {
    window.localStorage.setItem(SCENARIO_STORAGE_KEY, text);
    return true;
  } catch {
    return false;
  }
}
