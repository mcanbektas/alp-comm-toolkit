/**
 * Bayt sütunu profili — §35'in birinci ve ikinci maddesi (sabit bayt / değişen
 * bayt) ile ChangeRate ve entropi formüllerinin ekrandaki karşılığı.
 *
 * Sanallaştırılmış: 4096 baytlık bir çerçevede 4096 satır olur ve spec §34'ün
 * "tablolar sanallaştırılmalıdır" maddesi burada da geçerli.
 *
 * Rol etiketi rapora AYRI bir adımda (§36 `assignFieldRoles`) konuluyor; tablo
 * onu yeniden HESAPLAMAZ, yalnız ofsete göre eşler. İki ayrı yerde hesaplanan
 * bir etiket, yalnız birinde düzeltilen bir eşikle sessizce ayrışırdı.
 */

import { useMemo } from 'react';
import type { ReactNode } from 'react';

import { useTranslation } from '@/app/providers/LanguageProvider';
import { VirtualizedTable } from '@/components/virtualized-tables/VirtualizedTable';
import type { ByteColumnProfile } from '@/protocol-core/analysis/byteColumns';
import type { FieldRole, FieldRoleAssignment } from '@/protocol-core/analysis/messageDiff';
import type { TranslationKey } from '@/translations';

const ROW_HEIGHT_PX = 28;
const TABLE_HEIGHT_PX = 320;

const ROLE_LABELS: Record<FieldRole, TranslationKey> = {
  constant: 'reverseEngineering.role.constant',
  'counter-candidate': 'reverseEngineering.role.counter',
  'checksum-candidate': 'reverseEngineering.role.checksum',
  payload: 'reverseEngineering.role.payload',
};

/** Rol renkleri token'dan; ham renk yazmak yasak (CLAUDE.md). */
const ROLE_CLASSES: Record<FieldRole, string> = {
  constant: 'text-muted',
  'counter-candidate': 'text-accent-strong',
  'checksum-candidate': 'text-warn',
  payload: 'text-text',
};

export interface ColumnProfileTableProps {
  readonly columns: readonly ByteColumnProfile[];
  readonly roles: readonly FieldRoleAssignment[];
}

function formatRatio(value: number | undefined): string {
  return value === undefined ? '—' : `%${(value * 100).toFixed(1)}`;
}

function formatHex(value: number | undefined): string {
  return value === undefined ? '—' : value.toString(16).toUpperCase().padStart(2, '0');
}

export function ColumnProfileTable({ columns, roles }: ColumnProfileTableProps): ReactNode {
  const { t } = useTranslation();

  const roleByOffset = useMemo(() => {
    const map = new Map<number, FieldRoleAssignment>();
    for (const role of roles) map.set(role.offset, role);
    return map;
  }, [roles]);

  const renderRow = (index: number): ReactNode => {
    const column = columns[index];
    if (column === undefined) return <div key={index} role="row" style={{ height: ROW_HEIGHT_PX }} />;
    const role = roleByOffset.get(column.offset);

    return (
      <div
        key={column.offset}
        role="row"
        className="flex w-full items-center gap-3 border-t border-line px-3 text-left text-xs tabular text-text"
        style={{ height: ROW_HEIGHT_PX }}
      >
        <span role="gridcell" className="w-12 shrink-0 font-mono text-muted">
          {column.offset}
        </span>
        <span role="gridcell" className="w-20 shrink-0">
          {formatRatio(column.changeRate)}
        </span>
        <span role="gridcell" className="w-20 shrink-0">
          {column.entropyBits.toFixed(2)}
        </span>
        <span role="gridcell" className="w-16 shrink-0">
          {column.distinctCount}
        </span>
        <span role="gridcell" className="w-24 shrink-0 font-mono">
          {formatHex(column.min)}…{formatHex(column.max)}
        </span>
        <span role="gridcell" className="w-16 shrink-0 font-mono">
          {column.constant ? formatHex(column.value) : '—'}
        </span>
        <span role="gridcell" className={`truncate ${role === undefined ? 'text-muted' : ROLE_CLASSES[role.role]}`}>
          {role === undefined ? '—' : t(ROLE_LABELS[role.role])}
        </span>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3 px-3 text-xs font-semibold uppercase tracking-wide text-muted">
        <span className="w-12 shrink-0">{t('reverseEngineering.columns.offset')}</span>
        <span className="w-20 shrink-0">{t('reverseEngineering.columns.changeRate')}</span>
        <span className="w-20 shrink-0">{t('reverseEngineering.columns.entropy')}</span>
        <span className="w-16 shrink-0">{t('reverseEngineering.columns.distinct')}</span>
        <span className="w-24 shrink-0">{t('reverseEngineering.columns.range')}</span>
        <span className="w-16 shrink-0">{t('reverseEngineering.columns.constant')}</span>
        <span>{t('reverseEngineering.columns.role')}</span>
      </div>

      <VirtualizedTable
        rowCount={columns.length}
        rowHeight={ROW_HEIGHT_PX}
        // Kısa çerçevede tablo boyunca boş kaydırma alanı bırakmamak için
        // yükseklik satır sayısına uyar; üst sınır sabit kalır ki uzun
        // çerçevede sanallaştırma penceresi büyümesin.
        height={Math.min(TABLE_HEIGHT_PX, Math.max(columns.length, 1) * ROW_HEIGHT_PX)}
        renderRow={renderRow}
        ariaLabel={t('reverseEngineering.columns.label')}
        emptyLabel={t('reverseEngineering.columns.empty')}
      />
    </div>
  );
}
