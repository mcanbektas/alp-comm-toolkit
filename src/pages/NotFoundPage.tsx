import type { ReactElement } from 'react';
import { Link } from 'react-router-dom';

import { useTranslation } from '@/app/providers/LanguageProvider';

/**
 * Yalnız `*` rotası değil: alan/aile/protokol sayfaları da çözülemeyen bir id
 * gördüğünde bunu basar. Yönlendirme yerine doğrudan basmanın sebebi, hatalı
 * adresin URL'de kalması — kullanıcı yanlışı görebilsin, geri düğmesi döngüye
 * girmesin.
 */
export function NotFoundPage(): ReactElement {
  const { t } = useTranslation();

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col items-start gap-3 py-10">
      <h1 className="font-display text-xl font-semibold text-text">{t('notFound.title')}</h1>
      <p className="text-sm text-muted">{t('notFound.body')}</p>
      <Link
        to="/"
        className="rounded-token-sm bg-accent px-3 py-2 text-sm font-medium text-on-accent hover:opacity-90 focus-visible:ring-2 focus-visible:ring-accent"
      >
        {t('notFound.back')}
      </Link>
    </div>
  );
}
