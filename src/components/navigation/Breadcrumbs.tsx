import type { ReactElement } from 'react';
import { Link } from 'react-router-dom';

import type { CatalogDomain, CatalogFamily, CatalogProtocol } from '@/app/catalog';
import { useTranslation } from '@/app/providers/LanguageProvider';

export interface BreadcrumbsProps {
  domain: CatalogDomain;
  family?: CatalogFamily;
  protocol?: CatalogProtocol;
}

/**
 * Kırıntı yolu her zaman kataloğun GERÇEK nesneleriyle beslenir, URL
 * parçalarıyla değil: böylece ekranda çözülemeyen bir id asla görünmez —
 * çözülemeyen yol zaten NotFoundPage'e düşmüştür.
 *
 * Son basamak da bağlantıdır (aktif sayfanın kendisi). Gerekçe: protokol
 * sayfasında sekme URL'de `?tab=` ile taşınıyor; son basamağa tıklamak
 * sekmeyi sıfırlayan meşru bir hareket.
 */
export function Breadcrumbs({ domain, family, protocol }: BreadcrumbsProps): ReactElement {
  const { t } = useTranslation();

  const linkClass =
    'rounded-token-sm px-1 text-muted hover:text-text focus-visible:ring-2 focus-visible:ring-accent';

  return (
    // BİLEREK etiketsiz: kenar çubuğu zaten `nav.domains` adıyla bir gezinme
    // yer işareti kuruyor ve aynı adı taşıyan ikinci bir yer işareti ekran
    // okuyucuda ikisini ayırt edilemez kılar. Sözlükte kırıntı yoluna özel bir
    // anahtar açılınca (`nav.breadcrumb`) buraya aria-label eklenmeli.
    <nav className="min-w-0 text-sm">
      <ol className="flex flex-wrap items-center gap-x-1 gap-y-1">
        <li>
          <Link to="/" className={linkClass}>
            {t('nav.home')}
          </Link>
        </li>
        <li aria-hidden="true" className="text-muted">
          /
        </li>
        <li>
          <Link to={`/${domain.id}`} className={linkClass}>
            {domain.name}
          </Link>
        </li>
        {family !== undefined && (
          <>
            <li aria-hidden="true" className="text-muted">
              /
            </li>
            <li>
              <Link to={`/${domain.id}/${family.id}`} className={linkClass}>
                {family.name}
              </Link>
            </li>
          </>
        )}
        {family !== undefined && protocol !== undefined && (
          <>
            <li aria-hidden="true" className="text-muted">
              /
            </li>
            <li>
              <Link
                to={`/${domain.id}/${family.id}/${protocol.id}`}
                aria-current="page"
                className="rounded-token-sm px-1 font-medium text-text focus-visible:ring-2 focus-visible:ring-accent"
              >
                {protocol.name}
              </Link>
            </li>
          </>
        )}
      </ol>
    </nav>
  );
}
