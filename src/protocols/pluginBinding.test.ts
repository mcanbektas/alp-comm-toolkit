import { describe, expect, it } from 'vitest';

import { findEntry } from '@/app/catalog';
import type {
  CatalogDomain,
  CatalogEntry,
  CatalogFamily,
  CatalogProtocol,
} from '@/app/catalog';
import { resolvePluginId, resolveStatus } from './pluginBinding';

/** Gerçek katalogdan kayıt çeker; yol kırılırsa test "undefined" yerine sebebi söyler. */
function protocolAt(path: string): CatalogProtocol {
  const entry = findEntry(path);
  if (entry === undefined) throw new Error(`Catalog entry not found: ${path}`);
  return entry.protocol;
}

/** Kanonik kayıtlar için ortak iskelet — testin ilgilendiği tek alan `pluginId`/`aliasOf`. */
function makeProtocol(
  overrides: Partial<CatalogProtocol> & Pick<CatalogProtocol, 'id'>,
): CatalogProtocol {
  return {
    name: overrides.id,
    summary: 'Test record.',
    layer: 'application',
    status: 'planned',
    tabs: ['overview'],
    tools: ['A', 'B', 'C'],
    ...overrides,
  };
}

const testDomain: CatalogDomain = {
  id: 'industrial-automation',
  name: 'Test Domain',
  summary: 'Test domain.',
  highlights: [],
  families: [],
};

const testFamily: CatalogFamily = {
  id: 'family',
  name: 'Test Family',
  summary: 'Test family.',
  protocols: [],
};

/** Sahte katalog: yol → kayıt. Gerçek katalogda kırık alias ya da halka kurulamaz. */
function lookupFrom(
  records: Readonly<Record<string, CatalogProtocol>>,
): (path: string) => CatalogEntry | undefined {
  return (path) => {
    const protocol = records[path];
    if (protocol === undefined) return undefined;
    return { domain: testDomain, family: testFamily, protocol, path };
  };
}

describe('resolvePluginId', () => {
  it('reads the plugin id straight off a canonical record', () => {
    expect(resolvePluginId(protocolAt('industrial-automation/modbus/modbus-rtu'))).toBe(
      'modbus-rtu',
    );
    expect(resolvePluginId(protocolAt('industrial-automation/modbus/modbus-ascii'))).toBe(
      'modbus-ascii',
    );
    expect(resolvePluginId(protocolAt('industrial-automation/modbus/modbus-tcp'))).toBe(
      'modbus-tcp',
    );
  });

  it('follows aliasOf to the canonical record', () => {
    expect(resolvePluginId(protocolAt('building-automation/modbus-building/modbus-rtu'))).toBe(
      'modbus-rtu',
    );
    expect(resolvePluginId(protocolAt('building-automation/modbus-building/modbus-tcp'))).toBe(
      'modbus-tcp',
    );
  });

  it('returns null when the canonical record has no engine yet', () => {
    expect(resolvePluginId(makeProtocol({ id: 'planned-protocol' }))).toBeNull();
  });

  it('ignores a plugin id sitting on the alias itself', () => {
    const canonicalPath = 'domain/family/canonical';
    const alias = makeProtocol({ id: 'alias', aliasOf: canonicalPath, pluginId: 'alias-plugin' });
    const catalog = lookupFrom({
      [canonicalPath]: makeProtocol({ id: 'canonical', pluginId: 'canonical-plugin' }),
    });

    expect(resolvePluginId(alias, catalog)).toBe('canonical-plugin');
  });

  it('returns null when the alias points at a missing record', () => {
    const alias = makeProtocol({ id: 'alias', aliasOf: 'domain/family/gone' });

    expect(resolvePluginId(alias, lookupFrom({}))).toBeNull();
  });

  it('returns null instead of looping when alias records point at each other', () => {
    const first = makeProtocol({ id: 'first', aliasOf: 'domain/family/second' });
    const second = makeProtocol({ id: 'second', aliasOf: 'domain/family/first' });
    const catalog = lookupFrom({
      'domain/family/first': first,
      'domain/family/second': second,
    });

    expect(resolvePluginId(first, catalog)).toBeNull();
  });
});

describe('resolveStatus', () => {
  it('returns the record own status when it is canonical', () => {
    expect(resolveStatus(makeProtocol({ id: 'canonical', status: 'ready' }), findEntry)).toBe('ready');
  });

  it('takes the status of the canonical record an alias points at', () => {
    // Gerçekte görülen kayma: Modbus motoru bağlandıktan sonra kanonik sayfa
    // "Hazır", bina otomasyonu alias sayfası hâlâ "Planlandı" basıyordu.
    const canonical = makeProtocol({ id: 'canonical', status: 'ready' });
    const alias = makeProtocol({ id: 'alias', status: 'planned', aliasOf: 'domain/family/canonical' });
    const catalog = lookupFrom({ 'domain/family/canonical': canonical });

    expect(resolveStatus(alias, catalog)).toBe('ready');
  });

  it('falls back to the own status when the alias target is missing', () => {
    const alias = makeProtocol({ id: 'alias', status: 'partial', aliasOf: 'domain/family/gone' });

    expect(resolveStatus(alias, lookupFrom({}))).toBe('partial');
  });

  it('stops on a cycle and reports the record it stopped on', () => {
    // Bozuk veride "Hazır" iddia etmektense üzerinde durulan kaydın durumunu
    // vermek doğru: rozet olduğundan iyi görünmemeli.
    const first = makeProtocol({ id: 'first', status: 'planned', aliasOf: 'domain/family/second' });
    const second = makeProtocol({ id: 'second', status: 'ready', aliasOf: 'domain/family/first' });
    const catalog = lookupFrom({
      'domain/family/first': first,
      'domain/family/second': second,
    });

    expect(resolveStatus(first, catalog)).toBe('planned');
  });

  it('reports the three canonical Modbus records as ready through the real catalog', () => {
    for (const path of [
      'industrial-automation/modbus/modbus-rtu',
      'industrial-automation/modbus/modbus-ascii',
      'industrial-automation/modbus/modbus-tcp',
    ]) {
      const entry = findEntry(path);
      expect(entry, path).toBeDefined();
      if (entry === undefined) continue;
      expect(resolveStatus(entry.protocol), path).toBe('ready');
    }
  });

  it('reports the Modbus alias records as ready too', () => {
    for (const path of [
      'building-automation/modbus-building/modbus-rtu',
      'building-automation/modbus-building/modbus-tcp',
      'marine-navigation/marine-machinery/marine-modbus',
    ]) {
      const entry = findEntry(path);
      expect(entry, path).toBeDefined();
      if (entry === undefined) continue;
      expect(resolveStatus(entry.protocol), path).toBe('ready');
    }
  });
});
