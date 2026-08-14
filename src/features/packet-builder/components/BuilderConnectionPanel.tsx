/**
 * Packet Builder'ın bağlantı paneli — spec §10'un "gönderme" ayağı.
 *
 * Live Monitor'ün `ConnectionPanel`i ile aynı deseni izler ama ondan hiçbir şey
 * içe aktarmaz: iki ekran ayrı özelliklerdir ve biri diğerinin panelini
 * kullanırsa Monitor'ün seri port ayarları (baud, parity…) Builder'a da sızar.
 *
 * ## WebSocket neden devre dışı bir düğme
 *
 * Spec §10 kaynak listesinde WebSocket'i sayıyor, ama `src/connection/websocket`
 * henüz yok. Seçeneği sessizce listeden düşürmek, spec'i okuyan kullanıcıya
 * "bu araç WebSocket'i desteklemiyor" yalanını söylerdi; tıklanabilir bırakmak
 * ise hiçbir şey yapmayan bir düğme demekti. Üçüncü yol seçildi: görünür,
 * devre dışı ve "planlandı" rozetli (CLAUDE.md "boş kart basmak yasak").
 */

import type { ReactNode } from 'react';

import { useTranslation } from '@/app/providers/LanguageProvider';
import { isWebSerialSupported } from '@/connection/serial/webSerialTypes';
import type { TranslationKey } from '@/translations';

import type { BuilderConnectionPanelProps, BuilderConnectionState, BuilderSourceKind } from '../builderTypes';

const STATUS_LABEL_KEYS: Record<BuilderConnectionState['status'], TranslationKey> = {
  disconnected: 'builder.status.disconnected',
  connecting: 'builder.status.connecting',
  connected: 'builder.status.connected',
  error: 'builder.status.error',
};

const SOURCE_LABEL_KEYS: Record<BuilderSourceKind, TranslationKey> = {
  simulated: 'builder.source.simulated',
  serial: 'builder.source.serial',
};

const SOURCE_HINT_KEYS: Record<BuilderSourceKind, TranslationKey> = {
  simulated: 'builder.source.simulatedHint',
  serial: 'builder.source.serialHint',
};

/** Seçim sırası: donanımsız kaynak önce — Web Serial'i olmayan tarayıcı da bir şey görsün. */
const SOURCE_KINDS: readonly BuilderSourceKind[] = ['simulated', 'serial'];

function buttonClass(active: boolean): string {
  const base =
    'rounded-token border px-3 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-50';
  return active
    ? `${base} border-line-strong bg-accent text-on-accent`
    : `${base} border-line bg-raised text-text hover:bg-surface`;
}

export function BuilderConnectionPanel(props: BuilderConnectionPanelProps): ReactNode {
  const { t } = useTranslation();
  const serialSupported = isWebSerialSupported();
  const connected = props.connection.status === 'connected';
  const busy = connected || props.connection.status === 'connecting';

  return (
    <div className="flex flex-col gap-4" data-testid="builder-connection-panel">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted">
          {t('builder.source.label')}
        </span>

        {SOURCE_KINDS.map((kind) => (
          <button
            key={kind}
            type="button"
            data-testid={`builder-source-${kind}`}
            // Seçim rengi tek başına yeterli değil: renk körü kullanıcı ve
            // ekran okuyucu için basılı durum ayrıca duyurulmalı.
            aria-pressed={props.selectedKind === kind}
            className={buttonClass(props.selectedKind === kind)}
            onClick={() => {
              props.onSelectedKindChange(kind);
            }}
            disabled={busy || (kind === 'serial' && !serialSupported)}
          >
            {t(SOURCE_LABEL_KEYS[kind])}
          </button>
        ))}

        {/* Gerçeklenmemiş kaynak: görünür ama seçilemez. Bkz. dosya başlığı. */}
        <span className="inline-flex items-center gap-2">
          <button
            type="button"
            data-testid="builder-source-websocket"
            className={buttonClass(false)}
            disabled
          >
            {t('builder.source.websocket')}
          </button>
          <span
            data-testid="builder-source-websocket-badge"
            className="rounded-token-sm bg-accent-soft px-2 py-0.5 text-xs text-accent"
          >
            {t('builder.source.plannedBadge')}
          </span>
        </span>
      </div>

      <p className="text-sm text-muted" data-testid="builder-source-hint">
        {t(SOURCE_HINT_KEYS[props.selectedKind])}
      </p>

      {!serialSupported ? (
        <p
          data-testid="builder-serial-unsupported"
          className="rounded-token border border-line bg-warn-soft p-3 text-sm text-warn"
        >
          {t('builder.serialUnsupported')}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        {connected ? (
          <button
            type="button"
            data-testid="builder-disconnect"
            className={buttonClass(false)}
            onClick={props.onDisconnect}
          >
            {t('builder.action.disconnect')}
          </button>
        ) : (
          <button
            type="button"
            data-testid="builder-connect"
            className={buttonClass(true)}
            onClick={props.onConnect}
            disabled={props.connection.status === 'connecting'}
          >
            {t('builder.action.connect')}
          </button>
        )}

        <span className="text-sm text-muted">
          {t('builder.status.label')}{' '}
          <span data-testid="builder-connection-status" className="font-medium text-text">
            {t(STATUS_LABEL_KEYS[props.connection.status])}
          </span>
        </span>
      </div>

      {/* Yazamayan kaynakta (simülasyon) gönderim düğmesi çalışmaz; sebebini
          gönderim panelinde değil BURADA söylüyoruz — düzeltmesi burada. */}
      {connected && !props.connection.canWrite ? (
        <p
          role="status"
          data-testid="builder-cannot-write"
          className="rounded-token border border-line bg-warn-soft p-3 text-sm text-warn"
        >
          {t('builder.warning.readOnlySource')}
        </p>
      ) : null}

      {props.connection.errorKey !== null ? (
        <p
          role="alert"
          data-testid="builder-connection-error"
          className="rounded-token border border-line bg-danger-soft p-3 text-sm text-danger-strong"
        >
          {t(props.connection.errorKey as TranslationKey)}
        </p>
      ) : null}
    </div>
  );
}
