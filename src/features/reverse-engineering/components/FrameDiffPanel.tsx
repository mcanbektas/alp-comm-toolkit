/**
 * §36 Message Difference Analyzer — iki çerçevenin bayt bayt farkı.
 *
 * Fark motoru SAF ve ucuz (`diffFrames`), iki çerçevenin uzunluğu kadar iş
 * yapıyor; bu yüzden Worker'a GİTMEZ ve seçim değişince yeniden hesaplanır.
 * Ağır olan analiz zaten raporda; burada yeniden koşan bir şey yok.
 *
 * Yalnız DEĞİŞEN ofsetler basılır: 64 baytlık iki çerçevede 60 satırın "aynı"
 * demesi, gerçekten değişen 4 baytı görünmez eder. Değişmeyen ofsetlerin
 * sayısı ayrıca yazılır, kullanıcı tabloya güvenirken neyin gizlendiğini bilir.
 */

import { useMemo } from 'react';
import type { ReactNode } from 'react';

import { useTranslation } from '@/app/providers/LanguageProvider';
import { diffFrames } from '@/protocol-core/analysis/messageDiff';
import type { AnalysisFrame } from '@/protocol-core/analysis/types';

const FIELD_CLASS = 'rounded-token-sm border border-line bg-surface px-2 py-1 text-sm text-text';
const TABLE_CLASS = 'w-full text-left text-xs tabular text-text';
const HEAD_CLASS = 'text-xs font-semibold uppercase tracking-wide text-muted';
const CELL_CLASS = 'border-t border-line py-1 pr-3';

export interface FrameDiffPanelProps {
  readonly frames: readonly AnalysisFrame[];
  readonly leftIndex: number;
  readonly rightIndex: number;
  readonly onSelect: (side: 'left' | 'right', index: number) => void;
}

function formatByte(value: number | undefined): string {
  return value === undefined ? '—' : value.toString(16).toUpperCase().padStart(2, '0');
}

export function FrameDiffPanel({ frames, leftIndex, rightIndex, onSelect }: FrameDiffPanelProps): ReactNode {
  const { t } = useTranslation();

  const left = frames[leftIndex];
  const right = frames[rightIndex];

  const diffs = useMemo(() => {
    if (left === undefined || right === undefined) return [];
    return diffFrames(left, right);
  }, [left, right]);

  const changed = diffs.filter((diff) => diff.changed);
  const unchangedCount = diffs.length - changed.length;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm text-muted" htmlFor="re-diff-left">
          {t('reverseEngineering.diff.left')}
          <input
            id="re-diff-left"
            data-testid="re-diff-left"
            type="number"
            min={0}
            max={Math.max(0, frames.length - 1)}
            className={FIELD_CLASS}
            value={leftIndex}
            onChange={(event) => onSelect('left', Number.parseInt(event.target.value, 10))}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-muted" htmlFor="re-diff-right">
          {t('reverseEngineering.diff.right')}
          <input
            id="re-diff-right"
            data-testid="re-diff-right"
            type="number"
            min={0}
            max={Math.max(0, frames.length - 1)}
            className={FIELD_CLASS}
            value={rightIndex}
            onChange={(event) => onSelect('right', Number.parseInt(event.target.value, 10))}
          />
        </label>
      </div>

      {left === undefined || right === undefined ? (
        <p className="text-xs text-muted">{t('reverseEngineering.diff.outOfRange')}</p>
      ) : (
        <>
          <p className="text-xs text-muted" data-testid="re-diff-summary">
            {t('reverseEngineering.diff.summary', { changed: changed.length, unchanged: unchangedCount })}
          </p>

          {changed.length === 0 ? (
            <p className="text-xs text-muted">{t('reverseEngineering.diff.identical')}</p>
          ) : (
            <table className={TABLE_CLASS} data-testid="re-diff">
              <thead className={HEAD_CLASS}>
                <tr>
                  <th className="pr-3">{t('reverseEngineering.field.offset')}</th>
                  <th className="pr-3">{t('reverseEngineering.diff.leftValue')}</th>
                  <th className="pr-3">{t('reverseEngineering.diff.rightValue')}</th>
                  <th className="pr-3">{t('reverseEngineering.diff.xor')}</th>
                  <th className="pr-3">{t('reverseEngineering.diff.decimal')}</th>
                  <th className="pr-3">{t('reverseEngineering.diff.signed')}</th>
                  <th>{t('reverseEngineering.diff.bits')}</th>
                </tr>
              </thead>
              <tbody>
                {changed.map((diff) => (
                  <tr key={diff.offset}>
                    <td className={CELL_CLASS}>{diff.offset}</td>
                    <td className={`${CELL_CLASS} font-mono`}>{formatByte(diff.left)}</td>
                    <td className={`${CELL_CLASS} font-mono`}>{formatByte(diff.right)}</td>
                    <td className={`${CELL_CLASS} font-mono`}>{formatByte(diff.xor)}</td>
                    <td className={CELL_CLASS}>{diff.decimalDifference ?? '—'}</td>
                    <td className={CELL_CLASS}>{diff.signedDifference ?? '—'}</td>
                    <td className={CELL_CLASS}>{diff.changedBits.join(', ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  );
}
