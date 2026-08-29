/**
 * Seçili kaydın ayrıntısı: bayt görüntüleyici ve istenirse kayıtlı bir
 * protokol motoruyla çözümleme (spec §34 "Protocol auto-detection",
 * "Frame extraction", "CRC validation").
 *
 * ── PROTOKOL SEÇİMİ NEDEN ELLE ────────────────────────────────────────────
 * Registry 170'in üzerinde motoru LAZY tutar; "hepsini dene" demek açılışta
 * hepsini indirmek demektir ve sonucun güvenilirliği de tartışmalıdır (bkz.
 * `logs/logDecode.ts` başındaki `canParse` notu). Bunun yerine kullanıcı bir
 * motor seçer, "örneklemde dene" düğmesi o motorun kayıtların yüzde kaçını
 * çözdüğünü ÖLÇER. Ölçüm bir kanıt değil bir ipucudur ve panelde öyle yazar.
 */

import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { useTranslation } from '@/app/providers/LanguageProvider';
import { ByteViewer } from '@/components/byte-viewer';
import { parsedFrameToRegions } from '@/components/byte-viewer/parsedFieldAdapter';
import { decodeLogRecord, summarizeLogDecode } from '@/protocol-core/logs/logDecode';
import type { LogDecodeSummary } from '@/protocol-core/logs/logDecode';
import type { LogRecord } from '@/protocol-core/logs/types';
import { loadProtocolPlugin, registeredProtocolIds } from '@/protocol-core/registry';
import type { ProtocolPlugin } from '@/protocol-core/types';

/** Örneklem boyu: 500 kayıt bir ipucu için yeter, en yavaş motorda bile anlık. */
const DECODE_SAMPLE_SIZE = 500;

const FIELD_CLASS = 'rounded-token-sm border border-line bg-surface px-2 py-1 text-sm text-text';
const BUTTON_CLASS =
  'rounded-token-sm border border-line px-3 py-1.5 text-sm text-text hover:bg-raised focus-visible:ring-2 focus-visible:ring-accent';

type PluginState =
  | { readonly status: 'none' }
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly plugin: ProtocolPlugin }
  | { readonly status: 'failed'; readonly message: string };

export interface LogRecordDetailProps {
  readonly record: LogRecord | undefined;
  /** Örneklem ölçümünün uygulanacağı (filtrelenmiş) kayıtlar. */
  readonly records: readonly LogRecord[];
}

export function LogRecordDetail({ record, records }: LogRecordDetailProps): ReactNode {
  const { t } = useTranslation();
  const [protocolId, setProtocolId] = useState('');
  const [pluginState, setPluginState] = useState<PluginState>({ status: 'none' });
  const [sampleSummary, setSampleSummary] = useState<LogDecodeSummary | undefined>(undefined);

  const protocolIds = useMemo(() => registeredProtocolIds(), []);

  useEffect(() => {
    setSampleSummary(undefined);
    if (protocolId === '') {
      setPluginState({ status: 'none' });
      return;
    }
    let cancelled = false;
    setPluginState({ status: 'loading' });
    loadProtocolPlugin(protocolId).then(
      (plugin) => {
        if (!cancelled) setPluginState({ status: 'ready', plugin });
      },
      (cause: unknown) => {
        if (!cancelled) {
          setPluginState({ status: 'failed', message: cause instanceof Error ? cause.message : String(cause) });
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [protocolId]);

  const parser = pluginState.status === 'ready' ? pluginState.plugin.parser : undefined;

  const outcome = useMemo(() => {
    if (record === undefined || parser === undefined) return undefined;
    return decodeLogRecord(parser, record);
  }, [record, parser]);

  const frame =
    outcome?.kind === 'parsed' && outcome.result.success ? outcome.result.frame : undefined;
  const regions = useMemo(() => (frame === undefined ? [] : parsedFrameToRegions(frame)), [frame]);

  if (record === undefined) {
    return <p className="text-sm text-muted">{t('logAnalyzer.detail.empty')}</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm text-muted" htmlFor="log-detail-protocol">
          {t('logAnalyzer.detail.protocol')}
          <select
            id="log-detail-protocol"
            data-testid="log-detail-protocol"
            className={FIELD_CLASS}
            value={protocolId}
            onChange={(event) => {
              setProtocolId(event.target.value);
            }}
          >
            <option value="">{t('logAnalyzer.detail.protocolNone')}</option>
            {protocolIds.map((id) => (
              <option key={id} value={id}>
                {id}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          className={BUTTON_CLASS}
          disabled={parser === undefined}
          onClick={() => {
            if (parser === undefined) return;
            setSampleSummary(summarizeLogDecode(protocolId, parser, records, DECODE_SAMPLE_SIZE));
          }}
        >
          {t('logAnalyzer.detail.matchRun')}
        </button>
      </div>

      {pluginState.status === 'loading' ? <p className="text-sm text-muted">{t('logAnalyzer.detail.loading')}</p> : null}
      {pluginState.status === 'failed' ? (
        <p className="text-sm text-danger" role="alert">
          {pluginState.message}
        </p>
      ) : null}
      {pluginState.status === 'ready' && parser === undefined ? (
        <p className="text-sm text-muted">{t('logAnalyzer.detail.noParser')}</p>
      ) : null}

      {sampleSummary !== undefined ? (
        <div className="flex flex-col gap-1" data-testid="log-decode-sample">
          <p className="text-sm text-text">
            {t('logAnalyzer.detail.match', {
              attempted: sampleSummary.attempted,
              rate: (sampleSummary.successRatePercent ?? 0).toFixed(1),
            })}
          </p>
          <p className="text-xs text-muted">{t('logAnalyzer.detail.matchHint')}</p>
        </div>
      ) : null}

      {outcome?.kind === 'crashed' ? (
        <p className="text-sm text-danger" role="alert">
          {t('logAnalyzer.detail.decodeCrashed')}: {outcome.detail}
        </p>
      ) : null}
      {outcome?.kind === 'parsed' && !outcome.result.success ? (
        <p className="text-sm text-danger">
          {t('logAnalyzer.detail.decodeFailed')}: {outcome.result.error.message}
        </p>
      ) : null}

      <div className="flex flex-col gap-1">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">{t('logAnalyzer.detail.bytes')}</h3>
        <ByteViewer bytes={record.data} regions={regions} />
      </div>

      {frame !== undefined && frame.fields.length > 0 ? (
        <div className="flex flex-col gap-1">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">{t('logAnalyzer.detail.fields')}</h3>
          <ul className="flex flex-col gap-0.5 text-sm">
            {frame.fields.map((field) => (
              <li key={field.id} className="flex justify-between gap-3 tabular">
                <span className="text-muted">{field.name}</span>
                <span className="font-mono text-text">
                  {String(field.physicalValue ?? field.rawValue ?? '')}
                  {field.unit === undefined ? '' : ` ${field.unit}`}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
