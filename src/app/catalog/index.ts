import type { CatalogDomain, CatalogFamily, CatalogProtocol, DomainId } from './types';
import { interfacesFramingDomain } from './domains/interfaces-framing';
import { industrialAutomationDomain } from './domains/industrial-automation';
import { automotiveDomain } from './domains/automotive';
import { marineNavigationDomain } from './domains/marine-navigation';
import { aerospaceUavDomain } from './domains/aerospace-uav';
import { buildingAutomationDomain } from './domains/building-automation';
import { networkEthernetDomain } from './domains/network-ethernet';
import { wirelessIotDomain } from './domains/wireless-iot';

export * from './types';

/** Ana sayfadaki sekiz Communication Domain kartının kaynağı — spec'teki sırayla. */
export const catalog: readonly CatalogDomain[] = [
  interfacesFramingDomain,
  industrialAutomationDomain,
  automotiveDomain,
  marineNavigationDomain,
  aerospaceUavDomain,
  buildingAutomationDomain,
  networkEthernetDomain,
  wirelessIotDomain,
];

/** Arama ve derin bağlantı için düzleştirilmiş kayıt. */
export interface CatalogEntry {
  domain: CatalogDomain;
  family: CatalogFamily;
  protocol: CatalogProtocol;
  /** `"<domainId>/<familyId>/<protocolId>"` — rota yolu ve `related` referansı. */
  path: string;
}

const entries: readonly CatalogEntry[] = catalog.flatMap((domain) =>
  domain.families.flatMap((family) =>
    family.protocols.map((protocol) => ({
      domain,
      family,
      protocol,
      path: `${domain.id}/${family.id}/${protocol.id}`,
    })),
  ),
);

const entriesByPath = new Map(entries.map((entry) => [entry.path, entry]));
const domainsById = new Map(catalog.map((domain) => [domain.id, domain]));

export function allEntries(): readonly CatalogEntry[] {
  return entries;
}

export function findDomain(domainId: string): CatalogDomain | undefined {
  return domainsById.get(domainId as DomainId);
}

export function findFamily(domainId: string, familyId: string): CatalogFamily | undefined {
  return findDomain(domainId)?.families.find((family) => family.id === familyId);
}

export function findEntry(path: string): CatalogEntry | undefined {
  return entriesByPath.get(path);
}

export interface CatalogCounts {
  domains: number;
  families: number;
  protocols: number;
  /** `aliasOf` taşımayan, yani kanonik protokol sayısı. */
  uniqueProtocols: number;
}

export function catalogCounts(): CatalogCounts {
  return {
    domains: catalog.length,
    families: catalog.reduce((total, domain) => total + domain.families.length, 0),
    protocols: entries.length,
    uniqueProtocols: entries.filter((entry) => entry.protocol.aliasOf === undefined).length,
  };
}

/**
 * Ad, özet ve araç adları üzerinde büyük/küçük harf duyarsız arama.
 * Katalog 172 kayıtla küçük olduğu için indeks kurulmaz — doğrusal tarama yeterli.
 */
export function searchCatalog(query: string, limit = 30): readonly CatalogEntry[] {
  const needle = query.trim().toLocaleLowerCase('en');
  if (needle.length === 0) return [];

  const scored: Array<{ entry: CatalogEntry; score: number }> = [];
  for (const entry of entries) {
    const name = entry.protocol.name.toLocaleLowerCase('en');
    let score = -1;
    if (name === needle) score = 0;
    else if (name.startsWith(needle)) score = 1;
    else if (name.includes(needle)) score = 2;
    else if (entry.family.name.toLocaleLowerCase('en').includes(needle)) score = 3;
    else if (entry.protocol.summary.toLocaleLowerCase('en').includes(needle)) score = 4;
    else if (entry.protocol.tools.some((tool) => tool.toLocaleLowerCase('en').includes(needle)))
      score = 5;

    if (score >= 0) scored.push({ entry, score });
  }

  scored.sort((a, b) => a.score - b.score || a.entry.protocol.name.localeCompare(b.entry.protocol.name));
  return scored.slice(0, limit).map((item) => item.entry);
}
