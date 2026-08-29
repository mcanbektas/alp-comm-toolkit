/**
 * §35'in aday listeleri: sayaç, uzunluk alanı, ASCII, timestamp, checksum/CRC,
 * periyot ve bilinen seriyle korelasyon.
 *
 * Bu tablolar sanallaştırılMAZ ve bu bilinçli: her motor kendi içinde eşiğe
 * göre eliyor, aday sayısı çerçeve uzunluğuyla değil BULGU sayısıyla orantılı
 * kalıyor (sütun profili öyle değildi, o yüzden orada sanallaştırma var).
 *
 * Boş liste GİZLENMEZ, "aday yok" yazar: gizlenen bölüm kullanıcıya motorun
 * hiç koşmadığını mı yoksa bir şey bulamadığını mı söylediğini belirsiz
 * bırakır.
 */

import type { ReactNode } from 'react';

import { useTranslation } from '@/app/providers/LanguageProvider';
import type { ChecksumScanCandidate } from '@/protocol-core/analysis/checksumScan';
import type { CounterCandidate } from '@/protocol-core/analysis/counterDetect';
import type { LengthFieldCandidate } from '@/protocol-core/analysis/lengthFieldDetect';
import type { AsciiFieldCandidate } from '@/protocol-core/analysis/asciiFieldDetect';
import type { TimestampFieldCandidate } from '@/protocol-core/analysis/timestampDetect';
import type { PeriodAnalysis } from '@/protocol-core/analysis/periodAnalysis';
import type { SeriesCorrelation } from '@/protocol-core/analysis/fieldCorrelation';
import type { FieldEndianness } from '@/protocol-core/analysis/types';

const SUBTITLE_CLASS = 'font-display text-xs font-semibold uppercase tracking-wide text-muted';
const TABLE_CLASS = 'w-full text-left text-xs tabular text-text';
const HEAD_CLASS = 'text-xs font-semibold uppercase tracking-wide text-muted';
const CELL_CLASS = 'border-t border-line py-1 pr-3';

/** BE/LE evrensel teknik kısaltmadır, çeviri sözlüğüne girmez (protokol adları gibi). */
function endiannessLabel(endianness: FieldEndianness): string {
  return endianness === 'big' ? 'BE' : 'LE';
}

function Section({ title, empty, children }: { title: string; empty: boolean; children: ReactNode }): ReactNode {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-1">
      <h3 className={SUBTITLE_CLASS}>{title}</h3>
      {empty ? <p className="text-xs text-muted">{t('reverseEngineering.candidates.empty')}</p> : children}
    </div>
  );
}

export interface FieldCandidatesPanelProps {
  readonly counters: readonly CounterCandidate[];
  readonly lengthFields: readonly LengthFieldCandidate[];
  readonly asciiFields: readonly AsciiFieldCandidate[];
  readonly timestampFields: readonly TimestampFieldCandidate[];
  readonly checksums: readonly ChecksumScanCandidate[];
  readonly period: PeriodAnalysis | undefined;
  readonly seriesCorrelations: readonly SeriesCorrelation[];
}

export function FieldCandidatesPanel({
  counters,
  lengthFields,
  asciiFields,
  timestampFields,
  checksums,
  period,
  seriesCorrelations,
}: FieldCandidatesPanelProps): ReactNode {
  const { t } = useTranslation();

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Section title={t('reverseEngineering.candidates.counters')} empty={counters.length === 0}>
        <table className={TABLE_CLASS} data-testid="re-counters">
          <thead className={HEAD_CLASS}>
            <tr>
              <th className="pr-3">{t('reverseEngineering.field.offset')}</th>
              <th className="pr-3">{t('reverseEngineering.field.width')}</th>
              <th className="pr-3">{t('reverseEngineering.field.endianness')}</th>
              <th className="pr-3">{t('reverseEngineering.field.step')}</th>
              <th className="pr-3">{t('reverseEngineering.field.wrapCount')}</th>
              <th>{t('reverseEngineering.field.valueRange')}</th>
            </tr>
          </thead>
          <tbody>
            {counters.map((candidate) => (
              <tr key={`${candidate.offset}-${candidate.width}-${candidate.endianness}`}>
                <td className={CELL_CLASS}>{candidate.offset}</td>
                <td className={CELL_CLASS}>{candidate.width}</td>
                <td className={CELL_CLASS}>{endiannessLabel(candidate.endianness)}</td>
                <td className={CELL_CLASS}>{candidate.step ?? '—'}</td>
                <td className={CELL_CLASS}>{candidate.wrapCount}</td>
                <td className={CELL_CLASS}>
                  {candidate.firstValue}…{candidate.lastValue}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section title={t('reverseEngineering.candidates.lengthFields')} empty={lengthFields.length === 0}>
        <table className={TABLE_CLASS} data-testid="re-length-fields">
          <thead className={HEAD_CLASS}>
            <tr>
              <th className="pr-3">{t('reverseEngineering.field.offset')}</th>
              <th className="pr-3">{t('reverseEngineering.field.width')}</th>
              <th className="pr-3">{t('reverseEngineering.field.endianness')}</th>
              <th>{t('reverseEngineering.field.lengthOffset')}</th>
            </tr>
          </thead>
          <tbody>
            {lengthFields.map((candidate) => (
              <tr key={`${candidate.offset}-${candidate.width}-${candidate.endianness}`}>
                <td className={CELL_CLASS}>{candidate.offset}</td>
                <td className={CELL_CLASS}>{candidate.width}</td>
                <td className={CELL_CLASS}>{endiannessLabel(candidate.endianness)}</td>
                <td className={CELL_CLASS}>{candidate.lengthOffset}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section title={t('reverseEngineering.candidates.asciiFields')} empty={asciiFields.length === 0}>
        <table className={TABLE_CLASS} data-testid="re-ascii-fields">
          <thead className={HEAD_CLASS}>
            <tr>
              <th className="pr-3">{t('reverseEngineering.field.offset')}</th>
              <th className="pr-3">{t('reverseEngineering.field.length')}</th>
              <th>{t('reverseEngineering.field.printableRatio')}</th>
            </tr>
          </thead>
          <tbody>
            {asciiFields.map((candidate) => (
              <tr key={candidate.offset}>
                <td className={CELL_CLASS}>{candidate.offset}</td>
                <td className={CELL_CLASS}>{candidate.length}</td>
                <td className={CELL_CLASS}>%{(candidate.minPrintableRatio * 100).toFixed(0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section title={t('reverseEngineering.candidates.timestampFields')} empty={timestampFields.length === 0}>
        <table className={TABLE_CLASS} data-testid="re-timestamp-fields">
          <thead className={HEAD_CLASS}>
            <tr>
              <th className="pr-3">{t('reverseEngineering.field.offset')}</th>
              <th className="pr-3">{t('reverseEngineering.field.endianness')}</th>
              <th className="pr-3">{t('reverseEngineering.field.valueRange')}</th>
              <th>{t('reverseEngineering.field.frameTimeCorrelation')}</th>
            </tr>
          </thead>
          <tbody>
            {timestampFields.map((candidate) => (
              <tr key={`${candidate.offset}-${candidate.endianness}`}>
                <td className={CELL_CLASS}>{candidate.offset}</td>
                <td className={CELL_CLASS}>{endiannessLabel(candidate.endianness)}</td>
                <td className={CELL_CLASS}>
                  {candidate.firstValue}…{candidate.lastValue}
                </td>
                <td className={CELL_CLASS}>
                  {candidate.frameTimeCorrelation === undefined ? '—' : candidate.frameTimeCorrelation.toFixed(3)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section title={t('reverseEngineering.candidates.checksums')} empty={checksums.length === 0}>
        <table className={TABLE_CLASS} data-testid="re-checksums">
          <thead className={HEAD_CLASS}>
            <tr>
              <th className="pr-3">{t('reverseEngineering.field.algorithm')}</th>
              <th className="pr-3">{t('reverseEngineering.field.dataRange')}</th>
              <th className="pr-3">{t('reverseEngineering.field.byteOrder')}</th>
              <th>{t('reverseEngineering.field.matchRate')}</th>
            </tr>
          </thead>
          <tbody>
            {checksums.map((candidate) => (
              <tr key={`${candidate.algorithmId}-${candidate.trailingOffset}-${candidate.dataStart}-${candidate.byteOrder}`}>
                <td className={CELL_CLASS}>{candidate.algorithmId}</td>
                <td className={CELL_CLASS}>
                  {candidate.dataStart}…−{candidate.trailingOffset + candidate.checksumWidth}
                </td>
                <td className={CELL_CLASS}>{candidate.byteOrder}</td>
                <td className={CELL_CLASS}>
                  {t('reverseEngineering.field.matchRateValue', {
                    percent: candidate.matchRatePercent.toFixed(0),
                    matched: candidate.matchedFrames,
                    tested: candidate.testedFrames,
                  })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section title={t('reverseEngineering.candidates.period')} empty={period === undefined || period.timedFrameCount < 2}>
        {period === undefined ? null : (
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs" data-testid="re-period">
            <dt className="text-muted">{t('reverseEngineering.period.mean')}</dt>
            <dd className="tabular">{period.interval.average?.toFixed(2) ?? '—'} ms</dd>
            <dt className="text-muted">{t('reverseEngineering.period.stddev')}</dt>
            <dd className="tabular">{period.interval.stdDev?.toFixed(2) ?? '—'} ms</dd>
            <dt className="text-muted">{t('reverseEngineering.period.variation')}</dt>
            <dd className="tabular">
              {period.coefficientOfVariation === undefined ? '—' : period.coefficientOfVariation.toFixed(3)}
            </dd>
            <dt className="text-muted">{t('reverseEngineering.period.periodic')}</dt>
            <dd data-testid="re-period-verdict">
              {period.periodic === undefined
                ? t('reverseEngineering.period.unknown')
                : period.periodic
                  ? t('reverseEngineering.period.yes')
                  : t('reverseEngineering.period.no')}
            </dd>
          </dl>
        )}
      </Section>

      <Section title={t('reverseEngineering.candidates.correlations')} empty={seriesCorrelations.length === 0}>
        <table className={TABLE_CLASS} data-testid="re-correlations">
          <thead className={HEAD_CLASS}>
            <tr>
              <th className="pr-3">{t('reverseEngineering.field.offset')}</th>
              <th className="pr-3">{t('reverseEngineering.field.width')}</th>
              <th className="pr-3">{t('reverseEngineering.field.endianness')}</th>
              <th>{t('reverseEngineering.field.coefficient')}</th>
            </tr>
          </thead>
          <tbody>
            {seriesCorrelations.map((candidate) => (
              <tr key={`${candidate.offset}-${candidate.width}-${candidate.endianness}`}>
                <td className={CELL_CLASS}>{candidate.offset}</td>
                <td className={CELL_CLASS}>{candidate.width}</td>
                <td className={CELL_CLASS}>{endiannessLabel(candidate.endianness)}</td>
                <td className={CELL_CLASS}>{candidate.coefficient.toFixed(3)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>
    </div>
  );
}
