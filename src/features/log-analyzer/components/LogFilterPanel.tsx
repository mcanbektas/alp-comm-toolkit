/**
 * Filtre paneli (spec §34 "Error filtering" ve genel süzme).
 *
 * Kanal/kimlik seçenekleri FİLTRE UYGULANMADAN ÖNCEKİ istatistikten gelir.
 * Filtrelenmiş listeden türetilseydi seçenekler kendi seçimiyle daralır ve
 * kullanıcı seçtiği değeri geri alamazdı (liste artık o değeri içermezdi).
 */

import type { ChangeEvent, ReactNode } from 'react';

import { useTranslation } from '@/app/providers/LanguageProvider';
import type { LogFilter } from '@/protocol-core/logs/logFilter';
import type { LogStatistics } from '@/protocol-core/logs/logStatistics';
import type { LogRecordFlag } from '@/protocol-core/logs/types';
import type { FrameDirection } from '@/protocol-core/types';
import type { TranslationKey } from '@/translations';

const FLAG_LABEL_KEYS: Record<LogRecordFlag, TranslationKey> = {
  'extended-id': 'logAnalyzer.flag.extendedId',
  'remote-frame': 'logAnalyzer.flag.remoteFrame',
  'error-frame': 'logAnalyzer.flag.errorFrame',
  'flexible-data-rate': 'logAnalyzer.flag.flexibleDataRate',
  truncated: 'logAnalyzer.flag.truncated',
};

const FLAG_ORDER: readonly LogRecordFlag[] = [
  'extended-id',
  'remote-frame',
  'error-frame',
  'flexible-data-rate',
  'truncated',
];

const FIELD_CLASS = 'rounded-token-sm border border-line bg-surface px-2 py-1 text-sm text-text';
const BUTTON_CLASS =
  'rounded-token-sm border border-line px-3 py-1.5 text-sm text-text hover:bg-raised focus-visible:ring-2 focus-visible:ring-accent';

export interface LogFilterPanelProps {
  readonly filter: LogFilter;
  readonly sourceStatistics: LogStatistics;
  readonly shownCount: number;
  readonly totalCount: number;
  readonly onFilterChange: (filter: LogFilter) => void;
  readonly onExport: () => void;
}

/** Boş metni "ölçüt yok"a çevirir; boş dizeyi ölçüt saymak her kaydı elerdi. */
function textOrUndefined(value: string): string | undefined {
  return value.length === 0 ? undefined : value;
}

function numberOrUndefined(value: string): number | undefined {
  if (value.trim().length === 0) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function LogFilterPanel({
  filter,
  sourceStatistics,
  shownCount,
  totalCount,
  onFilterChange,
  onExport,
}: LogFilterPanelProps): ReactNode {
  const { t } = useTranslation();

  const update = (patch: Partial<LogFilter>): void => {
    const next: LogFilter = { ...filter, ...patch };
    // `undefined` değerler nesnede kalırsa `exactOptionalPropertyTypes`
    // olmayan bir kodda bile "ölçüt var ama boş" gibi okunur; temizlenir.
    const cleaned = Object.fromEntries(Object.entries(next).filter(([, value]) => value !== undefined)) as LogFilter;
    onFilterChange(cleaned);
  };

  const handleSelect =
    (key: 'channel' | 'frameId') =>
    (event: ChangeEvent<HTMLSelectElement>): void => {
      update({ [key]: textOrUndefined(event.target.value) } as Partial<LogFilter>);
    };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm text-muted" htmlFor="log-filter-channel">
          {t('logAnalyzer.filter.channel')}
          <select
            id="log-filter-channel"
            className={FIELD_CLASS}
            value={filter.channel ?? ''}
            onChange={handleSelect('channel')}
          >
            <option value="">{t('logAnalyzer.filter.any')}</option>
            {sourceStatistics.channels.map((group) => (
              <option key={group.key} value={group.key}>
                {group.key} ({group.count})
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm text-muted" htmlFor="log-filter-id">
          {t('logAnalyzer.filter.frameId')}
          <select
            id="log-filter-id"
            className={FIELD_CLASS}
            value={filter.frameId ?? ''}
            onChange={handleSelect('frameId')}
          >
            <option value="">{t('logAnalyzer.filter.any')}</option>
            {sourceStatistics.frameIds.map((group) => (
              <option key={group.key} value={group.key}>
                {group.key} ({group.count})
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm text-muted" htmlFor="log-filter-direction">
          {t('logAnalyzer.filter.direction')}
          <select
            id="log-filter-direction"
            className={FIELD_CLASS}
            value={filter.direction ?? ''}
            onChange={(event) => {
              const value = event.target.value;
              update({ direction: value === '' ? undefined : (value as FrameDirection) });
            }}
          >
            <option value="">{t('logAnalyzer.filter.any')}</option>
            <option value="rx">{t('logAnalyzer.filter.rx')}</option>
            <option value="tx">{t('logAnalyzer.filter.tx')}</option>
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm text-muted" htmlFor="log-filter-flag">
          {t('logAnalyzer.filter.flag')}
          <select
            id="log-filter-flag"
            className={FIELD_CLASS}
            value={filter.flag ?? ''}
            onChange={(event) => {
              const value = event.target.value;
              update({ flag: value === '' ? undefined : (value as LogRecordFlag) });
            }}
          >
            <option value="">{t('logAnalyzer.filter.any')}</option>
            {FLAG_ORDER.map((flag) => (
              <option key={flag} value={flag}>
                {t(FLAG_LABEL_KEYS[flag])}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm text-muted" htmlFor="log-filter-min">
          {t('logAnalyzer.filter.minLength')}
          <input
            id="log-filter-min"
            className={`${FIELD_CLASS} w-24`}
            type="number"
            min={0}
            value={filter.minLength ?? ''}
            onChange={(event) => {
              update({ minLength: numberOrUndefined(event.target.value) });
            }}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-muted" htmlFor="log-filter-max">
          {t('logAnalyzer.filter.maxLength')}
          <input
            id="log-filter-max"
            className={`${FIELD_CLASS} w-24`}
            type="number"
            min={0}
            value={filter.maxLength ?? ''}
            onChange={(event) => {
              update({ maxLength: numberOrUndefined(event.target.value) });
            }}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-muted" htmlFor="log-filter-hex">
          {t('logAnalyzer.filter.hex')}
          <input
            id="log-filter-hex"
            data-testid="log-filter-hex"
            className={`${FIELD_CLASS} w-40 font-mono`}
            type="text"
            value={filter.hexContains ?? ''}
            onChange={(event) => {
              update({ hexContains: textOrUndefined(event.target.value) });
            }}
          />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm text-muted tabular" data-testid="log-filter-result">
          {t('logAnalyzer.filter.result', { shown: shownCount, total: totalCount })}
        </span>
        <button
          type="button"
          className={BUTTON_CLASS}
          onClick={() => {
            onFilterChange({});
          }}
        >
          {t('logAnalyzer.filter.reset')}
        </button>
        <button type="button" className={BUTTON_CLASS} onClick={onExport} disabled={shownCount === 0}>
          {t('logAnalyzer.filter.export')}
        </button>
      </div>
    </div>
  );
}
