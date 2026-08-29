/**
 * Mesaj kümeleri (§35 "mesaj kümelendirme").
 *
 * İmza baytları ekranda `ofset=değer` çiftleriyle gösterilir; kümenin ADI
 * (`key`) motorun ürettiği kararlı anahtardır ve olduğu gibi basılır —
 * kullanıcı aynı girdiyi yeniden analiz ettiğinde aynı adı görsün diye.
 *
 * Çerçeve olmayan ofset (`value === undefined`) bir eksiklik değil AYIRT EDİCİ
 * bir gözlemdir: kısa çerçeve o baytı hiç taşımaz ve bu, kümeyi ayıran şeyin
 * kendisi olabilir. Bu yüzden boş yerine açık bir işaretle basılır.
 */

import type { ReactNode } from 'react';

import { useTranslation } from '@/app/providers/LanguageProvider';
import type { MessageCluster } from '@/protocol-core/analysis/messageClustering';

const TABLE_CLASS = 'w-full text-left text-xs tabular text-text';
const HEAD_CLASS = 'text-xs font-semibold uppercase tracking-wide text-muted';
const CELL_CLASS = 'border-t border-line py-1 pr-3';

export interface ClusterPanelProps {
  readonly clusters: readonly MessageCluster[];
}

export function ClusterPanel({ clusters }: ClusterPanelProps): ReactNode {
  const { t } = useTranslation();

  if (clusters.length === 0) {
    return <p className="text-xs text-muted">{t('reverseEngineering.candidates.empty')}</p>;
  }

  return (
    <table className={TABLE_CLASS} data-testid="re-clusters">
      <thead className={HEAD_CLASS}>
        <tr>
          <th className="pr-3">{t('reverseEngineering.cluster.key')}</th>
          <th className="pr-3">{t('reverseEngineering.cluster.size')}</th>
          <th className="pr-3">{t('reverseEngineering.cluster.frameLength')}</th>
          <th>{t('reverseEngineering.cluster.signature')}</th>
        </tr>
      </thead>
      <tbody>
        {clusters.map((cluster) => (
          <tr key={cluster.key}>
            <td className={`${CELL_CLASS} font-mono`}>{cluster.key}</td>
            <td className={CELL_CLASS}>{cluster.size}</td>
            <td className={CELL_CLASS}>{cluster.frameLength ?? '—'}</td>
            <td className={`${CELL_CLASS} font-mono`}>
              {cluster.signature.length === 0
                ? '—'
                : cluster.signature
                    .map((byte) =>
                      byte.value === undefined
                        ? `${byte.offset}=∅`
                        : `${byte.offset}=${byte.value.toString(16).toUpperCase().padStart(2, '0')}`,
                    )
                    .join(' ')}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
