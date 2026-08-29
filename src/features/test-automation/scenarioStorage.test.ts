import { beforeEach, describe, expect, it } from 'vitest';

import { DEFAULT_SCENARIO } from './defaultScenario';
import { SCENARIO_FORMAT_VERSION } from './scenario';
import {
  SCENARIO_STORAGE_KEY,
  parseScenarioJson,
  readStoredScenario,
  readStoredScenarioJson,
  writeStoredScenario,
  writeStoredScenarioJson,
} from './scenarioStorage';

describe('parseScenarioJson', () => {
  it('geçerli senaryoyu çözer', () => {
    expect(parseScenarioJson(JSON.stringify(DEFAULT_SCENARIO))?.name).toBe(DEFAULT_SCENARIO.name);
  });

  it('bozuk JSON\'da undefined döner, ATMAZ', () => {
    expect(parseScenarioJson('{')).toBeUndefined();
  });

  it('sürümü tutmayan kaydı REDDEDER', () => {
    const stale = JSON.stringify({ ...DEFAULT_SCENARIO, formatVersion: SCENARIO_FORMAT_VERSION + 1 });
    expect(parseScenarioJson(stale)).toBeUndefined();
  });

  it('adımı dizi olmayan kaydı reddeder', () => {
    expect(parseScenarioJson(JSON.stringify({ formatVersion: SCENARIO_FORMAT_VERSION, name: 'x', steps: {} }))).toBeUndefined();
  });
});

describe('depo turu', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('yazılan senaryo geri okunur', () => {
    writeStoredScenario(DEFAULT_SCENARIO);
    expect(readStoredScenario()).toEqual(DEFAULT_SCENARIO);
  });

  it('kayıt yoksa undefined', () => {
    expect(readStoredScenario()).toBeUndefined();
    expect(readStoredScenarioJson()).toBeUndefined();
  });

  it('bozuk kaydı projeye TAŞIMAZ', () => {
    window.localStorage.setItem(SCENARIO_STORAGE_KEY, '{bozuk');
    expect(readStoredScenarioJson()).toBeUndefined();
  });

  it('geçersiz metni depoya YAZMAZ', () => {
    writeStoredScenario(DEFAULT_SCENARIO);
    expect(writeStoredScenarioJson('{bozuk')).toBe(false);
    // Çalışan senaryo yerinde kalır.
    expect(readStoredScenario()?.name).toBe(DEFAULT_SCENARIO.name);
  });

  it('geçerli metni depoya yazar', () => {
    const other = { ...DEFAULT_SCENARIO, name: 'proje senaryosu' };
    expect(writeStoredScenarioJson(JSON.stringify(other))).toBe(true);
    expect(readStoredScenario()?.name).toBe('proje senaryosu');
  });
});
