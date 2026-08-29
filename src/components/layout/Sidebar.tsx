import { useCallback, useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import { NavLink, useLocation } from 'react-router-dom';

import { catalog } from '@/app/catalog';
import { useTranslation } from '@/app/providers/LanguageProvider';

/** `/<domain>/<family>/<protocol>` — kenar çubuğu yalnız ilk parçayla ilgilenir. */
function readActiveDomainId(pathname: string): string | undefined {
  return pathname.split('/').filter((segment) => segment.length > 0)[0];
}

export interface SidebarProps {
  /** Overlay modunda bir bağlantıya tıklamak menüyü kapatmalı. */
  onNavigate?: () => void;
}

/**
 * Alan ağacı. Konum bilgisi `useLocation` üzerinden okunur, `useParams` ile
 * DEĞİL: kenar çubuğu düzen (layout) rotasında oturuyor ve orada alt rotanın
 * parametreleri görünmez.
 */
export function Sidebar({ onNavigate }: SidebarProps): ReactElement {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const activeDomainId = readActiveDomainId(pathname);

  const [expandedIds, setExpandedIds] = useState<readonly string[]>(() =>
    activeDomainId === undefined ? [] : [activeDomainId],
  );

  // Gezinme açık alanı genişletir ama hiçbirini KAPATMAZ: kullanıcının elle
  // açtığı dalları rota değişince toplamak, karşılaştırmalı gezinmeyi bozar.
  useEffect(() => {
    if (activeDomainId === undefined) return;
    setExpandedIds((current) => (current.includes(activeDomainId) ? current : [...current, activeDomainId]));
  }, [activeDomainId]);

  const toggleExpanded = useCallback((domainId: string): void => {
    setExpandedIds((current) =>
      current.includes(domainId) ? current.filter((id) => id !== domainId) : [...current, domainId],
    );
  }, []);

  const linkClass = ({ isActive }: { isActive: boolean }): string =>
    [
      'block min-w-0 flex-1 truncate rounded-token-sm px-2 py-1.5 text-sm focus-visible:ring-2 focus-visible:ring-accent',
      isActive ? 'bg-accent-soft font-medium text-accent-strong' : 'text-muted hover:bg-raised hover:text-text',
    ].join(' ');

  return (
    <nav aria-label={t('nav.domains')} className="flex h-full flex-col gap-1 overflow-y-auto p-3">
      <NavLink
        to="/"
        end
        onClick={onNavigate}
        className={({ isActive }) =>
          [
            'rounded-token-sm px-2 py-1.5 text-sm focus-visible:ring-2 focus-visible:ring-accent',
            isActive ? 'bg-accent-soft font-medium text-accent-strong' : 'text-muted hover:bg-raised hover:text-text',
          ].join(' ')
        }
      >
        {t('nav.home')}
      </NavLink>

      <NavLink
        to="/calculators"
        onClick={onNavigate}
        className={({ isActive }) =>
          [
            'rounded-token-sm px-2 py-1.5 text-sm focus-visible:ring-2 focus-visible:ring-accent',
            isActive ? 'bg-accent-soft font-medium text-accent-strong' : 'text-muted hover:bg-raised hover:text-text',
          ].join(' ')
        }
      >
        {t('nav.calculators')}
      </NavLink>

      <NavLink
        to="/live-monitor"
        onClick={onNavigate}
        className={({ isActive }) =>
          [
            'rounded-token-sm px-2 py-1.5 text-sm focus-visible:ring-2 focus-visible:ring-accent',
            isActive ? 'bg-accent-soft font-medium text-accent-strong' : 'text-muted hover:bg-raised hover:text-text',
          ].join(' ')
        }
      >
        {t('nav.liveMonitor')}
      </NavLink>

      <NavLink
        to="/protocol-studio"
        onClick={onNavigate}
        className={({ isActive }) =>
          [
            'rounded-token-sm px-2 py-1.5 text-sm focus-visible:ring-2 focus-visible:ring-accent',
            isActive ? 'bg-accent-soft font-medium text-accent-strong' : 'text-muted hover:bg-raised hover:text-text',
          ].join(' ')
        }
      >
        {t('nav.protocolStudio')}
      </NavLink>

      <NavLink
        to="/packet-builder"
        onClick={onNavigate}
        className={({ isActive }) =>
          [
            'rounded-token-sm px-2 py-1.5 text-sm focus-visible:ring-2 focus-visible:ring-accent',
            isActive ? 'bg-accent-soft font-medium text-accent-strong' : 'text-muted hover:bg-raised hover:text-text',
          ].join(' ')
        }
      >
        {t('nav.packetBuilder')}
      </NavLink>

      <NavLink
        to="/log-analyzer"
        onClick={onNavigate}
        className={({ isActive }) =>
          [
            'rounded-token-sm px-2 py-1.5 text-sm focus-visible:ring-2 focus-visible:ring-accent',
            isActive ? 'bg-accent-soft font-medium text-accent-strong' : 'text-muted hover:bg-raised hover:text-text',
          ].join(' ')
        }
      >
        {t('nav.logAnalyzer')}
      </NavLink>

      <NavLink
        to="/reverse-engineering"
        onClick={onNavigate}
        className={({ isActive }) =>
          [
            'rounded-token-sm px-2 py-1.5 text-sm focus-visible:ring-2 focus-visible:ring-accent',
            isActive ? 'bg-accent-soft font-medium text-accent-strong' : 'text-muted hover:bg-raised hover:text-text',
          ].join(' ')
        }
      >
        {t('nav.reverseEngineering')}
      </NavLink>

      <NavLink
        to="/test-automation"
        onClick={onNavigate}
        className={({ isActive }) =>
          [
            'rounded-token-sm px-2 py-1.5 text-sm focus-visible:ring-2 focus-visible:ring-accent',
            isActive ? 'bg-accent-soft font-medium text-accent-strong' : 'text-muted hover:bg-raised hover:text-text',
          ].join(' ')
        }
      >
        {t('nav.testAutomation')}
      </NavLink>

      <ul className="mt-2 flex flex-col gap-0.5">
        {catalog.map((domain) => {
          const isExpanded = expandedIds.includes(domain.id);
          const panelId = `sidebar-domain-${domain.id}`;
          return (
            <li key={domain.id}>
              <div
                className={`flex items-center gap-1 rounded-token-sm ${
                  domain.id === activeDomainId ? 'bg-raised' : ''
                }`}
              >
                {/* `end`: alt rota açıkken aria-current tek bir bağlantıda kalsın;
                    üst düzeydeki vurgu ayrıca activeDomainId ile veriliyor. */}
                <NavLink to={`/${domain.id}`} end onClick={onNavigate} className={linkClass}>
                  {domain.name}
                </NavLink>
                <button
                  type="button"
                  aria-expanded={isExpanded}
                  // Aile listesi kapalıyken DOM'dan tamamen kalkıyor; `aria-controls`u
                  // sabit bırakmak boşa düşen bir IDREF üretirdi.
                  aria-controls={isExpanded ? panelId : undefined}
                  aria-label={domain.name}
                  onClick={() => {
                    toggleExpanded(domain.id);
                  }}
                  className="shrink-0 rounded-token-sm px-2 py-1.5 text-xs text-muted hover:text-text focus-visible:ring-2 focus-visible:ring-accent"
                >
                  <span aria-hidden="true">{isExpanded ? '▾' : '▸'}</span>
                </button>
              </div>

              {isExpanded && (
                <ul id={panelId} className="ml-3 border-l border-line pl-2">
                  {domain.families.map((family) => (
                    <li key={family.id} className="flex">
                      <NavLink
                        to={`/${domain.id}/${family.id}`}
                        onClick={onNavigate}
                        className={linkClass}
                        title={family.name}
                      >
                        {family.name}
                      </NavLink>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
