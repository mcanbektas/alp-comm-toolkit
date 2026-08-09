import { describe, expect, it } from 'vitest';

import { DOMAIN_IDS, allEntries, catalog, catalogCounts, findEntry, searchCatalog } from '@/app/catalog';
import { PROTOCOL_CATEGORIES } from '@/protocol-core';

/**
 * Katalog grafiğinin değişmezleri. Bu dosya bir "sayım testi" değil, veri
 * bütünlüğü bekçisidir: 172 sayfanın gezinmesi tamamen bu grafiğe dayanıyor,
 * kırık bir `related` yolu ya da ikizlenmiş bir id ancak burada yakalanır.
 */

const EXPECTED_DOMAIN_COUNT = 8;
const EXPECTED_FAMILY_COUNT = 54;
const EXPECTED_PROTOCOL_COUNT = 172;
/** Her sayfa en az bu kadar araç vaat eder; altına düşen kayıt boş kart demektir. */
const MIN_TOOLS_PER_PROTOCOL = 3;

describe('catalog shape', () => {
  it('holds exactly eight domains, 54 families and 172 protocols', () => {
    expect(catalogCounts()).toMatchObject({
      domains: EXPECTED_DOMAIN_COUNT,
      families: EXPECTED_FAMILY_COUNT,
      protocols: EXPECTED_PROTOCOL_COUNT,
    });
  });

  it('exposes every declared domain id exactly once', () => {
    const ids = catalog.map((domain) => domain.id);
    expect(new Set(ids)).toEqual(new Set(DOMAIN_IDS));
    expect(ids).toHaveLength(DOMAIN_IDS.length);
  });

  it('keeps family ids unique inside a domain', () => {
    for (const domain of catalog) {
      const ids = domain.families.map((family) => family.id);
      expect(new Set(ids).size, `duplicate family id in ${domain.id}`).toBe(ids.length);
    }
  });

  it('keeps protocol ids unique inside a family', () => {
    for (const domain of catalog) {
      for (const family of domain.families) {
        const ids = family.protocols.map((protocol) => protocol.id);
        expect(new Set(ids).size, `duplicate protocol id in ${domain.id}/${family.id}`).toBe(ids.length);
      }
    }
  });
});

describe('catalog references', () => {
  it('resolves every related path', () => {
    for (const entry of allEntries()) {
      for (const relatedPath of entry.protocol.related ?? []) {
        expect(findEntry(relatedPath), `${entry.path} → ${relatedPath}`).toBeDefined();
      }
    }
  });

  it('resolves every aliasOf path to a different, canonical entry', () => {
    for (const entry of allEntries()) {
      const { aliasOf } = entry.protocol;
      if (aliasOf === undefined) continue;

      const canonical = findEntry(aliasOf);
      expect(canonical, `${entry.path} → ${aliasOf}`).toBeDefined();
      expect(aliasOf, `${entry.path} points at itself`).not.toBe(entry.path);
      // Alias zinciri yasak: kanonik kayıt kendisi alias olamaz, yoksa arama
      // sonuçları ikizlenir ve "kanonik kayda git" bağlantısı halkaya girer.
      expect(canonical?.protocol.aliasOf, `${aliasOf} is itself an alias`).toBeUndefined();
    }
  });
});

describe('catalog protocol content', () => {
  it('pairs the definitions tab with a non-empty definitions list', () => {
    for (const entry of allEntries()) {
      const hasTab = entry.protocol.tabs.includes('definitions');
      const hasList = (entry.protocol.definitions ?? []).length > 0;
      expect(hasTab, `${entry.path}: definitions tab without formats`).toBe(hasList);
    }
  });

  /**
   * Alias mekanizmasının tek amacı, aynı protokolün birden çok alan sayfasında
   * görünmesine izin verirken TEK bir kanonik kayıt bırakmak. Var olan `aliasOf`
   * yollarını doğrulamak bunu bekçilemez: eksik `aliasOf` sessizce ikinci bir
   * kanonik kayıt yaratır ve sayımlar şişer. Bu test o boşluğu kapatır —
   * bir kez gerçekten kaçtı (bina otomasyonundaki iki Modbus kaydı).
   */
  it('leaves exactly one canonical record per protocol name', () => {
    const byName = new Map<string, string[]>();
    for (const entry of allEntries()) {
      if (entry.protocol.aliasOf !== undefined) continue;
      const paths = byName.get(entry.protocol.name) ?? [];
      paths.push(entry.path);
      byName.set(entry.protocol.name, paths);
    }

    const duplicated = [...byName.entries()].filter(([, paths]) => paths.length > 1);
    expect(
      duplicated,
      `aliasOf taşımayan ikinci kayıt: ${duplicated.map(([name, paths]) => `${name} → ${paths.join(', ')}`).join(' | ')}`,
    ).toEqual([]);
  });

  /**
   * `ProtocolCategory` katalog tipini bilerek import etmiyor (protocol-core
   * katalogdan bağımsız kalmalı), ama iki değer kümesi ayrışırsa eklenti kaydı
   * bir domain'e bağlanamaz. Bağımsızlığın bedeli bu testtir.
   */
  it('keeps ProtocolCategory in step with the catalog domain ids', () => {
    expect([...PROTOCOL_CATEGORIES].sort()).toEqual([...DOMAIN_IDS].sort());
  });

  it('promises at least three tools and a summary on every protocol', () => {
    for (const entry of allEntries()) {
      expect(entry.protocol.tools.length, `${entry.path} has too few tools`).toBeGreaterThanOrEqual(
        MIN_TOOLS_PER_PROTOCOL,
      );
      expect(entry.protocol.summary.trim(), `${entry.path} has an empty summary`).not.toBe('');
    }
  });
});

describe('searchCatalog', () => {
  it('finds Modbus RTU by a lowercase fragment', () => {
    const paths = searchCatalog('modbus').map((entry) => entry.path);
    expect(paths).toContain('industrial-automation/modbus/modbus-rtu');
  });

  it('returns nothing for a blank query', () => {
    expect(searchCatalog('   ')).toHaveLength(0);
  });

  it('never returns an alias record — the same protocol must not appear twice', () => {
    for (const query of ['mqtt', 'coap', 'modbus', 'canopen', 'm-bus', 'rtcm', 'nmea']) {
      const aliases = searchCatalog(query, 50).filter(
        (entry) => entry.protocol.aliasOf !== undefined,
      );
      expect(aliases.map((entry) => entry.path), `"${query}" alias döndürdü`).toEqual([]);
    }
  });
});
