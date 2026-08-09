import type { ReactElement } from 'react';
import { Link } from 'react-router-dom';

import type { CatalogDomain } from '@/app/catalog';
import { useTranslation } from '@/app/providers/LanguageProvider';

export interface DomainCardProps {
  domain: CatalogDomain;
}

/**
 * Ana sayfadaki alan kartı. Kartın TAMAMI tek bir bağlantıdır; içinde ikinci
 * bir tıklanabilir öğe yok. İç içe bağlantı hem geçersiz HTML hem de klavye
 * kullanıcısı için gereksiz ikinci durak olurdu.
 */
export function DomainCard({ domain }: DomainCardProps): ReactElement {
  const { t } = useTranslation();

  const familyCount = domain.families.length;
  const protocolCount = domain.families.reduce((total, family) => total + family.protocols.length, 0);

  return (
    <Link
      to={`/${domain.id}`}
      className="group flex h-full flex-col gap-3 rounded-token border border-line bg-surface p-4 transition-colors hover:border-line-strong hover:bg-raised focus-visible:ring-2 focus-visible:ring-accent"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-display text-base font-semibold text-text">{domain.name}</h3>
        <span className="text-xs text-muted">
          {t('home.familyCount', { count: familyCount })} · {t('home.protocolCount', { count: protocolCount })}
        </span>
      </div>

      <p className="text-sm text-muted">{domain.summary}</p>

      <ul className="flex flex-wrap gap-1.5">
        {domain.highlights.map((highlight) => (
          <li
            key={highlight}
            className="rounded-token-sm border border-line bg-raised px-2 py-0.5 font-mono text-xs text-muted"
          >
            {highlight}
          </li>
        ))}
      </ul>

      <span className="mt-auto text-sm font-medium text-accent group-hover:text-accent-strong">
        {t('home.openDomain')}
      </span>
    </Link>
  );
}
