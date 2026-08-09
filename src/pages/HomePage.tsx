import type { ReactElement } from 'react';

import { catalog, catalogCounts } from '@/app/catalog';
import { useTranslation } from '@/app/providers/LanguageProvider';
import { DomainCard } from '@/components/navigation/DomainCard';

export function HomePage(): ReactElement {
  const { t } = useTranslation();
  // Katalog derleme zamanı sabiti; sayım her render'da yeniden yapılabilecek
  // kadar ucuz (172 kayıt) — memo eklemek gereksiz karmaşa olurdu.
  const counts = catalogCounts();

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <section className="flex flex-col gap-2">
        <h1 className="font-display text-xl font-semibold text-text sm:text-2xl">{t('home.heading')}</h1>
        <p className="max-w-3xl text-sm text-muted">{t('home.intro')}</p>
        <ul className="flex flex-wrap gap-2 text-xs">
          {/* Anahtar çeviri anahtarıdır, basılan metin DEĞİL: metin dile ve
              sayıya göre değişiyor, React kimliği ise sabit kalmalı. */}
          {(
            [
              ['home.domainCount', counts.domains],
              ['home.familyCount', counts.families],
              ['home.protocolCount', counts.protocols],
            ] as const
          ).map(([key, count]) => (
            <li
              key={key}
              className="tabular rounded-token-sm border border-line bg-surface px-2 py-1 text-muted"
            >
              {t(key, { count })}
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-muted">
          {t('home.exploreDomains')}
        </h2>
        {/* Spec'teki 2×4 ızgara; 360px'de tek sütuna iner. */}
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {catalog.map((domain) => (
            <li key={domain.id}>
              <DomainCard domain={domain} />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
