import type { ReactElement } from 'react';
import { Link, useParams } from 'react-router-dom';

import { findDomain, findFamily } from '@/app/catalog';
import type { ImplementationStatus, ProtocolLayer } from '@/app/catalog';
import { useTranslation } from '@/app/providers/LanguageProvider';
import type { TranslationKey } from '@/translations';
import { Breadcrumbs } from '@/components/navigation/Breadcrumbs';
import { resolveStatus } from '@/protocols/pluginBinding';
import { NotFoundPage } from './NotFoundPage';

/**
 * Katalog değerinden çeviri anahtarına eşleme. `Record<…>` ANOTASYON olarak
 * yazıldı ki katalog tipine yeni bir katman/durum eklendiğinde burada derleme
 * hatası çıksın — `t('layer.' + layer)` gibi bir birleştirme bu güvenceyi
 * kaybettirirdi.
 */
export const LAYER_LABEL_KEYS: Record<ProtocolLayer, TranslationKey> = {
  physical: 'layer.physical',
  'data-link': 'layer.data-link',
  network: 'layer.network',
  transport: 'layer.transport',
  application: 'layer.application',
  'multi-layer': 'layer.multi-layer',
};

export const STATUS_LABEL_KEYS: Record<ImplementationStatus, TranslationKey> = {
  planned: 'status.planned',
  partial: 'status.partial',
  ready: 'status.ready',
};

/** Durum rengi: `planned` nötr, `partial` uyarı, `ready` vurgu. */
const STATUS_TONE_CLASS: Record<ImplementationStatus, string> = {
  planned: 'border-line bg-raised text-muted',
  partial: 'border-line bg-warn-soft text-warn',
  ready: 'border-line bg-accent-soft text-accent-strong',
};

export interface ProtocolBadgesProps {
  layer: ProtocolLayer;
  status: ImplementationStatus;
}

/**
 * Katman + olgunluk rozetleri. Aile listesi ve protokol sayfası aynı çifti
 * gösteriyor; ortak `components/common` katmanı açılana kadar tek kaynak burası.
 */
export function ProtocolBadges({ layer, status }: ProtocolBadgesProps): ReactElement {
  const { t } = useTranslation();
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <span
        title={t('protocol.layer')}
        className="rounded-token-sm border border-line bg-raised px-1.5 py-0.5 text-xs text-muted"
      >
        {t(LAYER_LABEL_KEYS[layer])}
      </span>
      <span
        title={t('protocol.status')}
        className={`rounded-token-sm border px-1.5 py-0.5 text-xs ${STATUS_TONE_CLASS[status]}`}
      >
        {t(STATUS_LABEL_KEYS[status])}
      </span>
    </span>
  );
}

export function FamilyPage(): ReactElement {
  const { t } = useTranslation();
  const { domainId, familyId } = useParams();
  const domain = domainId === undefined ? undefined : findDomain(domainId);
  const family =
    domainId === undefined || familyId === undefined ? undefined : findFamily(domainId, familyId);

  if (domain === undefined || family === undefined) return <NotFoundPage />;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
      <Breadcrumbs domain={domain} family={family} />

      <header className="flex flex-col gap-2">
        <h1 className="font-display text-xl font-semibold text-text sm:text-2xl">{family.name}</h1>
        <p className="max-w-3xl text-sm text-muted">{family.summary}</p>
        <p className="tabular text-xs text-muted">
          {t('family.protocolCount', { count: family.protocols.length })}
        </p>
      </header>

      <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {family.protocols.map((protocol) => (
          <li key={protocol.id}>
            <Link
              to={`/${domain.id}/${family.id}/${protocol.id}`}
              className="flex h-full flex-col gap-2 rounded-token border border-line bg-surface p-4 hover:border-line-strong hover:bg-raised focus-visible:ring-2 focus-visible:ring-accent"
            >
              <span className="font-display text-base font-semibold text-text">{protocol.name}</span>
              {/*
                Rozet alias zincirinin SONUNDAN gelir, kaydın ham `status`undan
                değil — `ProtocolPage` (`resolveStatus`) zaten böyle yapıyordu
                ve ikisi ayrışmıştı: alias kartı listede "Planlandı", tek tık
                sonra kendi sayfasında "Hazır" gösteriyordu. 15 alias kaydın
                14'ü bu durumdaydı (ubx, rtcm, canopen, mqtt, coap, m-bus,
                modbus-rtu/tcp, nmea, j1939 …) — hepsinin çalışan bir motoru
                var, yalnız kanonik kayıt başka domain'de duruyor.
              */}
              <ProtocolBadges layer={protocol.layer} status={resolveStatus(protocol)} />
              <span className="text-sm text-muted">{protocol.summary}</span>
            </Link>
          </li>
        ))}
      </ul>

      <Link
        to={`/${domain.id}`}
        className="self-start rounded-token-sm px-1 text-sm text-muted hover:text-text focus-visible:ring-2 focus-visible:ring-accent"
      >
        {t('family.backToDomain')}
      </Link>
    </div>
  );
}
