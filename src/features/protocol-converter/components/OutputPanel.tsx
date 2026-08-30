/**
 * Çevirinin çıktısı: değerler tablosu + hedef biçimin metni (+ MQTT hedefinde
 * gerçek paket baytları).
 *
 * Sorunlar çıktının YANINDA durur, yerine değil: bir satırın kaynağı kaybolsa
 * bile öteki satırların çıktısı üretilir ve gösterilir (`converterEngine.ts`).
 */

import type { ReactNode } from 'react';

import { useTranslation } from '@/app/providers/LanguageProvider';
import { bytesToHex } from '@/protocol-core/buffers/representation';

import type { ConversionOutput } from '../converterTypes';

const TABLE_CELL_CLASS = 'border-b border-line px-2 py-1 text-left text-sm text-text';

interface OutputPanelProps {
  readonly output: ConversionOutput | null;
}

export function OutputPanel({ output }: OutputPanelProps): ReactNode {
  const { t } = useTranslation();

  if (output === null) {
    return (
      <p className="text-sm text-muted" data-testid="converter-output-empty">
        {t('converter.output.empty')}
      </p>
    );
  }

  /**
   * Değer üretilmediğinde SORUNLAR yine de basılır. "Çıktı yok" deyip nedenini
   * saklamak, kaynak protokolü değiştiren kullanıcıyı sessiz bir boşlukla baş
   * başa bırakırdı — kaybolan alan bir hata değil, açıklanması gereken bir
   * DURUM (bkz. `converterEngine.ts`).
   */
  if (output.values.length === 0) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm text-muted" data-testid="converter-output-empty">
          {t('converter.output.empty')}
        </p>
        {output.issues.length > 0 ? (
          <ul className="flex flex-col gap-1" data-testid="converter-issues">
            {output.issues.map((issue) => (
              <li key={`${issue.mappingId ?? 'frame'}-${issue.messageKey}`} className="text-xs text-warn">
                {t(issue.messageKey, issue.params)}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[32rem] border-collapse">
          <thead>
            <tr>
              <th className={TABLE_CELL_CLASS}>{t('converter.output.sourceField')}</th>
              <th className={TABLE_CELL_CLASS}>{t('converter.output.destinationName')}</th>
              <th className={TABLE_CELL_CLASS}>{t('converter.output.value')}</th>
            </tr>
          </thead>
          <tbody data-testid="converter-output-rows">
            {output.values.map((value) => (
              <tr key={value.mappingId}>
                {/* Alan adı, hedef ad ve değer VERİDİR; üçü de çeviriye girmez. */}
                <td className={TABLE_CELL_CLASS}>{value.sourceFieldName}</td>
                <td className={TABLE_CELL_CLASS}>{value.destinationName}</td>
                <td className={`${TABLE_CELL_CLASS} tabular`} data-testid={`converter-value-${value.mappingId}`}>
                  {String(value.value)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <pre
        className="overflow-x-auto rounded-token border border-line bg-raised p-3 font-mono text-xs text-text"
        data-testid="converter-output-text"
      >
        {output.text}
      </pre>

      {output.packets.length > 0 ? (
        <ul className="flex flex-col gap-1" data-testid="converter-packets">
          {output.packets.map((packet) => (
            <li key={packet.mappingId} className="font-mono text-xs text-text">
              {/* Hex, monitörün çözdüğü paketin AYNISIDIR: baytları `mqtt`
                  plugin'inin kendi encoder'ı üretti. */}
              {packet.topic}: {bytesToHex(packet.bytes)}
            </li>
          ))}
        </ul>
      ) : null}

      {output.issues.length > 0 ? (
        <ul className="flex flex-col gap-1" data-testid="converter-issues">
          {output.issues.map((issue) => (
            <li key={`${issue.mappingId ?? 'frame'}-${issue.messageKey}`} className="text-xs text-warn">
              {t(issue.messageKey, issue.params)}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
