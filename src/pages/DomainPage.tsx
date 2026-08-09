import type { ReactElement } from 'react';
import { Link, useParams } from 'react-router-dom';

import { findDomain } from '@/app/catalog';
import { useTranslation } from '@/app/providers/LanguageProvider';
import { Breadcrumbs } from '@/components/navigation/Breadcrumbs';
import { NotFoundPage } from './NotFoundPage';

export function DomainPage(): ReactElement {
  const { t } = useTranslation();
  const { domainId } = useParams();
  const domain = domainId === undefined ? undefined : findDomain(domainId);

  // Geçersiz id patlamaz, "bulunamadı" basar: adres çubuğuna elle yazılan ya
  // da eskimiş her bağlantı buraya düşer.
  if (domain === undefined) return <NotFoundPage />;

  const protocolCount = domain.families.reduce((total, family) => total + family.protocols.length, 0);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
      <Breadcrumbs domain={domain} />

      <header className="flex flex-col gap-2">
        <h1 className="font-display text-xl font-semibold text-text sm:text-2xl">{domain.name}</h1>
        <p className="max-w-3xl text-sm text-muted">{domain.summary}</p>
        <p className="tabular text-xs text-muted">
          {t('domain.familyCount', { count: domain.families.length })} ·{' '}
          {t('domain.protocolCount', { count: protocolCount })}
        </p>
      </header>

      <ul className="flex flex-col gap-3">
        {domain.families.map((family) => (
          <li key={family.id} className="rounded-token border border-line bg-surface p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-display text-base font-semibold">
                <Link
                  to={`/${domain.id}/${family.id}`}
                  className="rounded-token-sm text-text hover:text-accent focus-visible:ring-2 focus-visible:ring-accent"
                >
                  {family.name}
                </Link>
              </h2>
              <span className="tabular text-xs text-muted">
                {t('family.protocolCount', { count: family.protocols.length })}
              </span>
            </div>

            <p className="mt-1 text-sm text-muted">{family.summary}</p>

            <ul className="mt-3 flex flex-wrap gap-1.5">
              {family.protocols.map((protocol) => (
                <li key={protocol.id}>
                  <Link
                    to={`/${domain.id}/${family.id}/${protocol.id}`}
                    title={protocol.summary}
                    className="block rounded-token-sm border border-line bg-raised px-2 py-1 text-xs text-text hover:border-line-strong hover:text-accent focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    {protocol.name}
                  </Link>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>

      <Link
        to="/"
        className="self-start rounded-token-sm px-1 text-sm text-muted hover:text-text focus-visible:ring-2 focus-visible:ring-accent"
      >
        {t('domain.backToHome')}
      </Link>
    </div>
  );
}
