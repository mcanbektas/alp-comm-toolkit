import type { ReactElement } from 'react';
import { Link } from 'react-router-dom';

import { useTranslation } from '@/app/providers/LanguageProvider';
import { calculatorsByCategory } from '@/features/calculators';
import type { CalculatorCategory } from '@/features/calculators';
import type { TranslationKey } from '@/translations';

const CATEGORY_ORDER: readonly CalculatorCategory[] = ['conversion', 'timing', 'checksum'];

const CATEGORY_LABEL_KEYS: Record<CalculatorCategory, TranslationKey> = {
  conversion: 'calculators.category.conversion',
  timing: 'calculators.category.timing',
  checksum: 'calculators.category.checksum',
};

export function CalculatorsPage(): ReactElement {
  const { t } = useTranslation();

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-xl font-semibold text-text sm:text-2xl">{t('calculators.heading')}</h1>
        <p className="max-w-3xl text-sm text-muted">{t('calculators.intro')}</p>
      </header>

      {CATEGORY_ORDER.map((category) => {
        const tools = calculatorsByCategory(category);
        return (
          <section key={category} className="flex flex-col gap-2">
            <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-muted">{t(CATEGORY_LABEL_KEYS[category])}</h2>
            <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
              {tools.map((tool) => (
                <li key={tool.id}>
                  <Link
                    to={`/calculators/${tool.id}`}
                    title={t(tool.summaryKey)}
                    className="block rounded-token-sm border border-line bg-surface px-3 py-2 text-sm text-text hover:border-line-strong hover:text-accent focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    {t(tool.nameKey)}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      <Link
        to="/"
        className="self-start rounded-token-sm px-1 text-sm text-muted hover:text-text focus-visible:ring-2 focus-visible:ring-accent"
      >
        {t('domain.backToHome')}
      </Link>
    </div>
  );
}
