import { useMemo, useState } from 'react';
import type { ReactElement } from 'react';

import { useTranslation } from '@/app/providers/LanguageProvider';
import { TextField } from '@/components/forms';
import { findChecksumMatches } from '@/protocol-core';
import type { ChecksumMatch } from '@/protocol-core';

export function ChecksumFinderTool(): ReactElement {
  const { t } = useTranslation();
  const [dataHex, setDataHex] = useState('');
  const [expectedHex, setExpectedHex] = useState('');

  const result = useMemo(() => {
    if (dataHex.trim().length === 0 || expectedHex.trim().length === 0) return undefined;
    try {
      const matches = findChecksumMatches({ dataHex: dataHex.replace(/\s+/g, ''), expectedHex: expectedHex.replace(/\s+/g, '') });
      return { matches } as { matches: ChecksumMatch[] } | { error: true };
    } catch {
      return { error: true } as { matches: ChecksumMatch[] } | { error: true };
    }
  }, [dataHex, expectedHex]);

  return (
    <div className="flex flex-col gap-4">
      <TextField
        id="calc-data"
        label={t('calc.field.checksumData')}
        value={dataHex}
        onChange={setDataHex}
        monospace
        multiline
        placeholder="AA 05 10 03 34 12 7F 4F"
      />
      <TextField
        id="calc-expected"
        label={t('calc.field.checksumExpected')}
        value={expectedHex}
        onChange={setExpectedHex}
        monospace
        placeholder="4B37"
      />

      {result !== undefined && 'error' in result && <p className="text-xs text-danger">{t('calc.error.invalidInput')}</p>}

      {result !== undefined && 'matches' in result && (
        <div className="flex flex-col gap-2">
          <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-muted">
            {t('calc.field.checksumMatches', { count: result.matches.length })}
          </h2>
          {result.matches.length === 0 ? (
            <p className="text-sm text-muted">{t('calc.field.checksumNoMatch')}</p>
          ) : (
            <div className="overflow-x-auto rounded-token border border-line">
              <table className="w-full text-left text-sm tabular">
                <thead className="bg-raised text-xs text-muted">
                  <tr>
                    <th className="px-3 py-2 font-medium">{t('calc.field.algorithm')}</th>
                    <th className="px-3 py-2 font-medium">{t('calc.field.checksumKind')}</th>
                    <th className="px-3 py-2 font-medium">{t('calc.field.byteOrder')}</th>
                    <th className="px-3 py-2 font-medium">{t('calc.field.computedHex')}</th>
                  </tr>
                </thead>
                <tbody>
                  {result.matches.map((match) => (
                    <tr key={`${match.id}-${match.matchedByteOrder}`} className="border-t border-line">
                      <td className="px-3 py-1.5 font-mono font-medium text-text">{match.id}</td>
                      <td className="px-3 py-1.5 text-muted">{match.kind === 'crc' ? 'CRC' : t('calc.field.checksumKindSimple')}</td>
                      <td className="px-3 py-1.5 text-muted">
                        {match.matchedByteOrder === 'normal' ? t('calc.field.byteOrderNormal') : t('calc.field.byteOrderSwapped')}
                      </td>
                      <td className="px-3 py-1.5 font-mono">0x{match.computedHex}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
