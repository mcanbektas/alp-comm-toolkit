/**
 * Gönderim denetimi — spec §10'un "tek gönderme / N kere gönderme / periyodik
 * gönderme / response bekleme" maddeleri.
 *
 * Panel zamanlayıcı KURMAZ; yalnız `SendSchedulerConfig`i düzenler ve
 * başlat/durdur çağırır. Nesil sayacı, örtüşme yasağı ve hata durdurması
 * `sendScheduler`ın değişmezleridir — bileşene taşınsalardı her yeniden
 * render'da yeniden kurulur ve iki döngü aynı anda dönebilirdi.
 *
 * Sayı girdileri HAM geçer, burada kırpılmaz: "50" yazmak için önce "5"
 * yazılır ve her tuşta alt sınıra sıçrayan bir alan yazılamaz hâle gelir.
 * Güvenli aralığa çekme `scheduler.start` içindeki `clampSchedulerConfig`ta.
 */

import type { ReactNode } from 'react';

import { useTranslation } from '@/app/providers/LanguageProvider';
import { NumberField, SelectField } from '@/components/forms';
import { bytesToHex } from '@/protocol-core/buffers/representation';
import type { TranslationKey } from '@/translations';

import type { SendControlPanelProps } from '../builderTypes';
import type { SendMode } from '../sendScheduler';

const SEND_MODES: readonly SendMode[] = ['once', 'count', 'periodic'];

const SEND_MODE_KEYS: Record<SendMode, TranslationKey> = {
  once: 'builder.mode.once',
  count: 'builder.mode.count',
  periodic: 'builder.mode.periodic',
};

function isSendMode(value: string): value is SendMode {
  return (SEND_MODES as readonly string[]).includes(value);
}

function buttonClass(primary: boolean): string {
  const base =
    'rounded-token border px-3 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-50';
  return primary
    ? `${base} border-line-strong bg-accent text-on-accent`
    : `${base} border-line bg-raised text-text hover:bg-surface`;
}

export function SendControlPanel(props: SendControlPanelProps): ReactNode {
  const { t } = useTranslation();

  // 'once' modunda periyot ve tekrar sayısı anlamsız: gösterilseydi kullanıcı
  // ayarladığı değerin işe yaradığını sanardı.
  const showInterval = props.config.mode !== 'once';
  const showCount = props.config.mode === 'count';

  return (
    <div className="flex flex-col gap-4" data-testid="builder-send-panel">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div data-testid="builder-send-mode">
          <SelectField
            id="builder-send-mode-select"
            label={t('builder.send.mode')}
            value={props.config.mode}
            onChange={(value) => {
              if (isSendMode(value)) {
                props.onConfigChange({ ...props.config, mode: value });
              }
            }}
            options={SEND_MODES.map((mode) => ({ value: mode, label: t(SEND_MODE_KEYS[mode]) }))}
          />
        </div>

        {showInterval ? (
          <div data-testid="builder-send-interval">
            <NumberField
              id="builder-send-interval-input"
              label={t('builder.send.intervalMs')}
              value={String(props.config.intervalMs)}
              onChange={(value) => {
                props.onConfigChange({ ...props.config, intervalMs: Number(value) });
              }}
            />
          </div>
        ) : null}

        {showCount ? (
          <div data-testid="builder-send-count">
            <NumberField
              id="builder-send-count-input"
              label={t('builder.send.count')}
              value={String(props.config.count)}
              onChange={(value) => {
                props.onConfigChange({ ...props.config, count: Number(value) });
              }}
            />
          </div>
        ) : null}

        <div data-testid="builder-send-timeout">
          <NumberField
            id="builder-send-timeout-input"
            label={t('builder.send.responseTimeoutMs')}
            value={String(props.responseTimeoutMs)}
            onChange={(value) => {
              props.onResponseTimeoutMsChange(Number(value));
            }}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          data-testid="builder-send"
          className={buttonClass(true)}
          onClick={props.onSend}
          disabled={!props.canSend || props.state.running}
        >
          {t('builder.action.send')}
        </button>
        <button
          type="button"
          data-testid="builder-stop"
          className={buttonClass(false)}
          onClick={props.onStop}
          disabled={!props.state.running}
        >
          {t('builder.action.stop')}
        </button>

        <span className="text-sm text-muted">
          {t('builder.send.sentCount')}{' '}
          <span data-testid="builder-sent-count" className="tabular font-medium text-text">
            {props.state.sentCount}
          </span>
        </span>
      </div>

      {!props.canSend ? (
        <p role="status" data-testid="builder-send-disabled" className="text-sm text-muted">
          {t('builder.send.disabledHint')}
        </p>
      ) : null}

      {props.state.lastErrorKey !== null ? (
        <p
          role="alert"
          data-testid="builder-send-error"
          className="rounded-token border border-line bg-danger-soft p-3 text-sm text-danger-strong"
        >
          {t(props.state.lastErrorKey as TranslationKey)}
        </p>
      ) : null}

      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium text-muted">{t('builder.send.lastResponse')}</span>
        {props.lastResponse === null ? (
          <span className="text-sm text-muted" data-testid="builder-last-response-empty">
            {t('builder.send.noResponse')}
          </span>
        ) : (
          <span
            data-testid="builder-last-response"
            className="break-all rounded-token-sm border border-line bg-raised px-2 py-1.5 font-mono text-sm text-text"
          >
            {bytesToHex(props.lastResponse)}
          </span>
        )}
      </div>
    </div>
  );
}
