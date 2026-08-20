/**
 * `lte-modem-at`in `data` sekmesinde yaşayan Cellular Initialization Dashboard
 * (Faz 10 dalga 9, karar 6'yla aynı sınıf iş — brief karar 4).
 *
 * Karar 4: `ProtocolParser` TEK satırı saf çözer, biriktirme UI katmanında
 * yaşar — `live-monitor`ın `MonitorIngestor`ıyla AYNI motor
 * (`createCellularInitializationState`, `protocols/wireless/cellular/lteModemAt.ts`).
 * Tek fark: `MonitorIngestor` canlı bir Worker akışını zamanla biriktirir, bu
 * panel ise yapıştırılan STATİK bir oturumu her değişiklikte SIFIRDAN
 * hesaplar (saf `useMemo`) — biriktirilecek "zaman içinde gelen" bir olay
 * yok, tüm oturum tek seferde elde.
 *
 * Girdi HEX değil düz metin: AT komutları zaten ASCII, `DecodePanel`in
 * hex-kutusu tek çerçeveli protokoller için evrensel ama çok satırlı bir
 * oturumu hex'e çevirip yapıştırmak kullanılamaz olurdu.
 */

import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { useTranslation } from '@/app/providers/LanguageProvider';
import {
  createCellularInitializationState,
  lteModemAtParser,
} from '@/protocols/wireless/cellular/lteModemAt';
import type { CellularInitializationSnapshot } from '@/protocols/wireless/cellular/lteModemAt';
import type { TranslationKey } from '@/translations';

/** Değeri olmayan hücrenin işareti; `DecodePanel`deki aynı kararın yerel kopyası. */
const EMPTY_GLYPH = '—';

const DEFAULT_SESSION = [
  'AT+CPIN?',
  '+CPIN: READY',
  'OK',
  'AT+CGSN=1',
  '+CGSN: "490154203237518"',
  'OK',
  'AT+COPS?',
  '+COPS: 0,0,"Example Operator",7',
  'OK',
  'AT+CREG?',
  '+CREG: 2,1,"1A2D","0001A2B3",7',
  'OK',
  'AT+CGDCONT?',
  '+CGDCONT: 1,"IP","example.apn","10.45.12.8",0,0',
  'OK',
].join('\n');

const SNAPSHOT_FIELD_LABEL_KEYS: Record<keyof CellularInitializationSnapshot, TranslationKey> = {
  imei: 'cellularDashboard.field.imei',
  numericIdentifierCandidate: 'cellularDashboard.field.numericIdentifierCandidate',
  simStatus: 'cellularDashboard.field.simStatus',
  operatorName: 'cellularDashboard.field.operatorName',
  operatorSelectionMode: 'cellularDashboard.field.operatorSelectionMode',
  accessTechnology: 'cellularDashboard.field.accessTechnology',
  registrationStatus: 'cellularDashboard.field.registrationStatus',
  pdpAddress: 'cellularDashboard.field.pdpAddress',
};

const SNAPSHOT_FIELD_ORDER = Object.keys(
  SNAPSHOT_FIELD_LABEL_KEYS,
) as ReadonlyArray<keyof CellularInitializationSnapshot>;

interface DashboardResult {
  readonly snapshot: CellularInitializationSnapshot;
  readonly lineCount: number;
}

/**
 * Satır satır işler: her satır BAĞIMSIZ bir `lteModemAtParser.parse()`
 * çağrısıdır (echo/OK/ERROR satırları da dahil — bunlar tanıdık bir alan
 * üretmediği için `ingest` onları sessizce yok sayar, `at-commands`ın
 * echo/URC ayrımını burada tekrar kurmaya gerek yok, bkz. dosya başı).
 * Çözümlenemeyen satır atlanır; panel çökmez, yalnız o satır sayılmaz.
 */
function computeDashboard(sessionText: string): DashboardResult {
  const state = createCellularInitializationState();
  let lineCount = 0;

  for (const rawLine of sessionText.split(/\r\n|\r|\n/)) {
    const line = rawLine.trim();
    if (line === '') continue;

    const result = lteModemAtParser.parse(new TextEncoder().encode(line));
    if (!result.success) continue;

    state.ingest(result.frame);
    lineCount += 1;
  }

  return { snapshot: state.snapshot, lineCount };
}

export function CellularInitializationDashboard(): ReactNode {
  const { t } = useTranslation();
  const [sessionText, setSessionText] = useState(DEFAULT_SESSION);

  const { snapshot, lineCount } = useMemo(() => computeDashboard(sessionText), [sessionText]);
  const hasAnyField = SNAPSHOT_FIELD_ORDER.some((key) => snapshot[key] !== undefined);

  return (
    <div className="flex flex-col gap-4" data-testid="cellular-dashboard">
      <h2 className="font-display text-sm font-semibold text-text">{t('cellularDashboard.heading')}</h2>

      <div className="flex flex-col gap-1">
        <label htmlFor="cellular-dashboard-session" className="text-xs font-medium text-muted">
          {t('cellularDashboard.sessionInput.label')}
        </label>
        <textarea
          id="cellular-dashboard-session"
          rows={8}
          spellCheck={false}
          value={sessionText}
          className="w-full rounded-token-sm border border-line bg-surface px-2 py-1.5 font-mono text-sm text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          onChange={(event) => {
            setSessionText(event.target.value);
          }}
        />
        <p className="text-xs text-muted" data-testid="cellular-dashboard-line-count">
          {t('cellularDashboard.linesProcessed', { count: lineCount })}
        </p>
      </div>

      {hasAnyField ? (
        <dl
          className="grid grid-cols-1 gap-x-4 gap-y-2 rounded-token border border-line bg-surface p-3 sm:grid-cols-2"
          data-testid="cellular-dashboard-summary"
        >
          {SNAPSHOT_FIELD_ORDER.map((key) => (
            <div key={key} data-testid="cellular-dashboard-field" data-field-id={key} className="flex flex-col gap-0.5">
              <dt className="text-xs uppercase tracking-wide text-muted">{t(SNAPSHOT_FIELD_LABEL_KEYS[key])}</dt>
              <dd className="tabular font-mono text-sm text-text">{snapshot[key] ?? EMPTY_GLYPH}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="text-sm text-muted" data-testid="cellular-dashboard-empty">
          {t('cellularDashboard.empty')}
        </p>
      )}
    </div>
  );
}
