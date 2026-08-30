/**
 * Bağlantı paneli — spec §8.1'in bağlantı ayarları ve kaynak seçimi.
 *
 * Web Serial düğmesi tarayıcı desteği yoksa devre dışı kalır ve sebebi yazılır;
 * sessizce çalışmayan bir düğme bırakmak yerine kullanıcıya simülasyon yolu
 * gösterilir (spec §42: "sınırlamalar" ve "yaygın hatalar" görünür olmalı).
 */

import type { ReactNode } from 'react';

import { SelectField } from '../../../components/forms';
import { useTranslation } from '../../../app/providers/LanguageProvider';
import type { TranslationKey } from '../../../translations';
import type { ConnectionError, ConnectionStatus } from '../../../connection/types';
import {
  SERIAL_BAUD_RATES,
  SERIAL_DATA_BITS,
  SERIAL_FLOW_CONTROLS,
  SERIAL_PARITIES,
  SERIAL_STOP_BITS,
  type SerialConnectionOptions,
} from '../../../connection/serial/serialOptions';
import { isWebSerialSupported } from '../../../connection/serial/webSerialTypes';
import type { StreamBufferState } from '../../../protocol-core/streams/types';
import { DISPLAY_MODES, TIMESTAMP_RESOLUTIONS } from '../types';
import type { DisplayMode, TimestampResolution } from '../types';
import { FRAMING_PRESETS } from '../presets';
import type { ReplayPacing } from '../../../connection/file/replaySchedule';

export type MonitorSourceKind = 'serial' | 'simulated' | 'file' | 'websocket';

export interface ConnectionPanelProps {
  readonly sourceKind: MonitorSourceKind;
  /** Seçili log dosyasının adı; seçilmediyse `undefined`. */
  readonly fileName: string | undefined;
  /** Dosyadan okunan kayıt sayısı; dosya okunmadıysa `undefined`. */
  readonly fileRecordCount: number | undefined;
  /** Dosya okunamadıysa hata metni. */
  readonly fileError: string | undefined;
  /** Oynatma sonuna gelindi mi — kaynak hâlâ açıktır, bağlantıyı kullanıcı kapatır. */
  readonly filePlaybackFinished: boolean;
  readonly onFileSelected: (file: File) => void;
  readonly pacing: ReplayPacing;
  readonly onPacingChange: (pacing: ReplayPacing) => void;
  readonly replaySpeed: number;
  readonly onReplaySpeedChange: (speed: number) => void;
  readonly onSourceKindChange: (kind: MonitorSourceKind) => void;
  /** WebSocket köprüsünün adresi; yalnız o kaynak seçiliyken görünür. */
  readonly webSocketUrl: string;
  readonly onWebSocketUrlChange: (url: string) => void;
  readonly serialOptions: SerialConnectionOptions;
  readonly onSerialOptionsChange: (options: SerialConnectionOptions) => void;
  readonly presetId: string;
  readonly onPresetIdChange: (id: string) => void;
  readonly displayMode: DisplayMode;
  readonly onDisplayModeChange: (mode: DisplayMode) => void;
  readonly timestampResolution: TimestampResolution;
  readonly onTimestampResolutionChange: (resolution: TimestampResolution) => void;
  readonly framesPerSecond: number;
  readonly onFramesPerSecondChange: (value: number) => void;
  readonly status: ConnectionStatus;
  readonly error: ConnectionError | undefined;
  readonly parserState: StreamBufferState;
  readonly connected: boolean;
  readonly onConnect: () => void;
  readonly onDisconnect: () => void;
}

const STATUS_LABEL_KEYS: Record<ConnectionStatus, TranslationKey> = {
  idle: 'monitor.status.idle',
  connecting: 'monitor.status.connecting',
  connected: 'monitor.status.connected',
  closing: 'monitor.status.closing',
  error: 'monitor.status.error',
};

const PARSER_LABEL_KEYS: Record<StreamBufferState, TranslationKey> = {
  SEARCHING_FOR_FRAME: 'monitor.parser.SEARCHING_FOR_FRAME',
  READING_HEADER: 'monitor.parser.READING_HEADER',
  READING_LENGTH: 'monitor.parser.READING_LENGTH',
  READING_PAYLOAD: 'monitor.parser.READING_PAYLOAD',
  READING_TRAILER: 'monitor.parser.READING_TRAILER',
  VALIDATING_FRAME: 'monitor.parser.VALIDATING_FRAME',
  FRAME_COMPLETE: 'monitor.parser.FRAME_COMPLETE',
  FRAME_ERROR: 'monitor.parser.FRAME_ERROR',
  RECOVERING: 'monitor.parser.RECOVERING',
};

const CONNECTION_ERROR_KEYS: Record<ConnectionError['code'], TranslationKey> = {
  unsupported: 'monitor.error.unsupported',
  'permission-denied': 'monitor.error.permissionDenied',
  'open-failed': 'monitor.error.openFailed',
  'read-failed': 'monitor.error.readFailed',
  'write-failed': 'monitor.error.writeFailed',
  'not-connected': 'monitor.error.notConnected',
};

const DISPLAY_MODE_KEYS: Record<DisplayMode, TranslationKey> = {
  hex: 'monitor.display.hex',
  ascii: 'monitor.display.ascii',
  utf8: 'monitor.display.utf8',
  decimal: 'monitor.display.decimal',
  binary: 'monitor.display.binary',
  mixed: 'monitor.display.mixed',
};

const TIMESTAMP_KEYS: Record<TimestampResolution, TranslationKey> = {
  ms: 'monitor.timestamp.ms',
  us: 'monitor.timestamp.us',
};

const PARITY_KEYS = {
  none: 'monitor.parity.none',
  even: 'monitor.parity.even',
  odd: 'monitor.parity.odd',
} as const satisfies Record<string, TranslationKey>;

const FLOW_CONTROL_KEYS = {
  none: 'monitor.flowControl.none',
  hardware: 'monitor.flowControl.hardware',
} as const satisfies Record<string, TranslationKey>;

const FRAMES_PER_SECOND_CHOICES = [50, 200, 1000, 5000] as const;
const REPLAY_SPEED_CHOICES = [0.5, 1, 2, 5, 10, 50] as const;

const SOURCE_HINT_KEYS: Record<MonitorSourceKind, TranslationKey> = {
  serial: 'monitor.source.serialHint',
  simulated: 'monitor.source.simulatedHint',
  file: 'monitor.source.fileHint',
  websocket: 'monitor.source.websocketHint',
};

const PACING_KEYS = {
  realtime: 'monitor.pacing.realtime',
  'fixed-interval': 'monitor.pacing.fixedInterval',
  immediate: 'monitor.pacing.immediate',
} as const satisfies Record<ReplayPacing, TranslationKey>;

const PACING_CHOICES: readonly ReplayPacing[] = ['realtime', 'fixed-interval', 'immediate'];

function buttonClass(active: boolean): string {
  const base =
    'rounded-token border px-3 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent';
  return active
    ? `${base} border-accent bg-accent text-on-accent`
    : `${base} border-line bg-raised text-text hover:bg-surface`;
}

export function ConnectionPanel(props: ConnectionPanelProps): ReactNode {
  const { t } = useTranslation();
  const serialSupported = isWebSerialSupported();

  const updateSerial = (patch: Partial<SerialConnectionOptions>): void => {
    props.onSerialOptionsChange({ ...props.serialOptions, ...patch });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted">
          {t('monitor.source.label')}
        </span>
        <button
          type="button"
          className={buttonClass(props.sourceKind === 'simulated')}
          onClick={() => props.onSourceKindChange('simulated')}
          disabled={props.connected}
        >
          {t('monitor.source.simulated')}
        </button>
        <button
          type="button"
          className={buttonClass(props.sourceKind === 'serial')}
          onClick={() => props.onSourceKindChange('serial')}
          disabled={props.connected || !serialSupported}
        >
          {t('monitor.source.serial')}
        </button>
        <button
          type="button"
          className={buttonClass(props.sourceKind === 'file')}
          onClick={() => props.onSourceKindChange('file')}
          disabled={props.connected}
        >
          {t('monitor.source.file')}
        </button>
        <button
          type="button"
          data-testid="monitor-source-websocket"
          className={buttonClass(props.sourceKind === 'websocket')}
          onClick={() => props.onSourceKindChange('websocket')}
          disabled={props.connected}
        >
          {t('monitor.source.websocket')}
        </button>
      </div>

      <p className="text-sm text-muted">{t(SOURCE_HINT_KEYS[props.sourceKind])}</p>

      {/* Adres yalnız WebSocket seçiliyken sorulur: öteki kaynaklarda karşılığı yok. */}
      {props.sourceKind === 'websocket' ? (
        <label className="flex max-w-md flex-col gap-1 text-sm text-muted" htmlFor="monitor-websocket-url">
          {t('monitor.field.webSocketUrl')}
          <input
            id="monitor-websocket-url"
            data-testid="monitor-websocket-url"
            className="rounded-token-sm border border-line bg-surface px-2 py-1 font-mono text-sm text-text"
            value={props.webSocketUrl}
            disabled={props.connected}
            onChange={(event) => {
              props.onWebSocketUrlChange(event.target.value);
            }}
          />
        </label>
      ) : null}

      {props.sourceKind === 'file' ? (
        <div className="flex flex-col gap-2">
          <label className="flex flex-col gap-1 text-sm text-muted" htmlFor="monitor-file">
            {t('monitor.field.logFile')}
            <input
              id="monitor-file"
              data-testid="monitor-file"
              type="file"
              accept=".pcap,.cap,.log,.txt,.csv,.tsv,.asc,.json,.ndjson,.bin"
              disabled={props.connected}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file !== undefined) props.onFileSelected(file);
              }}
              className="rounded-token-sm border border-line bg-surface px-2 py-1 text-sm text-text"
            />
          </label>
          {props.fileRecordCount !== undefined ? (
            <p className="text-sm text-muted" data-testid="monitor-file-summary">
              {t('monitor.file.loaded', {
                name: props.fileName ?? '',
                count: props.fileRecordCount,
              })}
            </p>
          ) : null}
          {props.filePlaybackFinished ? (
            <p className="text-sm text-accent-strong" data-testid="monitor-file-finished">
              {t('monitor.file.finished')}
            </p>
          ) : null}
          {props.fileError !== undefined ? (
            <p role="alert" className="text-sm text-danger" data-testid="monitor-file-error">
              {props.fileError}
            </p>
          ) : null}
        </div>
      ) : null}

      {!serialSupported ? (
        <p className="rounded-token border border-line bg-raised p-3 text-sm text-warn">
          {t('monitor.serialUnsupported')}
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <SelectField
          id="monitor-framing"
          label={t('monitor.field.framing')}
          value={props.presetId}
          onChange={props.onPresetIdChange}
          options={FRAMING_PRESETS.map((preset) => ({
            value: preset.id,
            label: t(preset.labelKey),
          }))}
        />

        <SelectField
          id="monitor-display-mode"
          label={t('monitor.field.displayMode')}
          value={props.displayMode}
          onChange={(value) => props.onDisplayModeChange(value as DisplayMode)}
          options={DISPLAY_MODES.map((mode) => ({ value: mode, label: t(DISPLAY_MODE_KEYS[mode]) }))}
        />

        <SelectField
          id="monitor-timestamp"
          label={t('monitor.field.timestampResolution')}
          value={props.timestampResolution}
          onChange={(value) => props.onTimestampResolutionChange(value as TimestampResolution)}
          options={TIMESTAMP_RESOLUTIONS.map((resolution) => ({
            value: resolution,
            label: t(TIMESTAMP_KEYS[resolution]),
          }))}
        />

        {props.sourceKind === 'serial' ? (
          <>
            <SelectField
              id="monitor-baud"
              label={t('monitor.field.baudRate')}
              value={String(props.serialOptions.baudRate)}
              onChange={(value) => updateSerial({ baudRate: Number(value) })}
              options={SERIAL_BAUD_RATES.map((rate) => ({
                value: String(rate),
                label: String(rate),
              }))}
            />
            <SelectField
              id="monitor-data-bits"
              label={t('monitor.field.dataBits')}
              value={String(props.serialOptions.dataBits)}
              onChange={(value) =>
                updateSerial({ dataBits: Number(value) === 7 ? 7 : 8 })
              }
              options={SERIAL_DATA_BITS.map((bits) => ({
                value: String(bits),
                label: String(bits),
              }))}
            />
            <SelectField
              id="monitor-stop-bits"
              label={t('monitor.field.stopBits')}
              value={String(props.serialOptions.stopBits)}
              onChange={(value) => updateSerial({ stopBits: Number(value) === 2 ? 2 : 1 })}
              options={SERIAL_STOP_BITS.map((bits) => ({
                value: String(bits),
                label: String(bits),
              }))}
            />
            <SelectField
              id="monitor-parity"
              label={t('monitor.field.parity')}
              value={props.serialOptions.parity}
              onChange={(value) => {
                const parity = SERIAL_PARITIES.find((entry) => entry === value);
                if (parity !== undefined) {
                  updateSerial({ parity });
                }
              }}
              options={SERIAL_PARITIES.map((parity) => ({
                value: parity,
                label: t(PARITY_KEYS[parity]),
              }))}
            />
            <SelectField
              id="monitor-flow-control"
              label={t('monitor.field.flowControl')}
              value={props.serialOptions.flowControl}
              onChange={(value) => {
                const flowControl = SERIAL_FLOW_CONTROLS.find((entry) => entry === value);
                if (flowControl !== undefined) {
                  updateSerial({ flowControl });
                }
              }}
              options={SERIAL_FLOW_CONTROLS.map((flowControl) => ({
                value: flowControl,
                label: t(FLOW_CONTROL_KEYS[flowControl]),
              }))}
            />
          </>
        ) : props.sourceKind === 'file' ? (
          <>
            <SelectField
              id="monitor-pacing"
              label={t('monitor.field.pacing')}
              value={props.pacing}
              onChange={(value) => props.onPacingChange(value as ReplayPacing)}
              options={PACING_CHOICES.map((pacing) => ({ value: pacing, label: t(PACING_KEYS[pacing]) }))}
            />
            <SelectField
              id="monitor-replay-speed"
              label={t('monitor.field.replaySpeed')}
              value={String(props.replaySpeed)}
              onChange={(value) => props.onReplaySpeedChange(Number(value))}
              options={REPLAY_SPEED_CHOICES.map((speed) => ({ value: String(speed), label: `${speed}x` }))}
            />
          </>
        ) : (
          <SelectField
            id="monitor-frames-per-second"
            label={t('monitor.field.framesPerSecond')}
            value={String(props.framesPerSecond)}
            onChange={(value) => props.onFramesPerSecondChange(Number(value))}
            options={FRAMES_PER_SECOND_CHOICES.map((rate) => ({
              value: String(rate),
              label: String(rate),
            }))}
          />
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {props.connected ? (
          <button type="button" className={buttonClass(false)} onClick={props.onDisconnect}>
            {t('monitor.action.disconnect')}
          </button>
        ) : (
          <button type="button" className={buttonClass(true)} onClick={props.onConnect}>
            {t('monitor.action.connect')}
          </button>
        )}

        <span className="text-sm text-muted">
          {t('monitor.status.label')}:{' '}
          <span className="font-medium text-text">{t(STATUS_LABEL_KEYS[props.status])}</span>
        </span>
        <span className="text-sm text-muted">
          {t('monitor.parser.label')}:{' '}
          <span className="font-medium text-text">{t(PARSER_LABEL_KEYS[props.parserState])}</span>
        </span>
      </div>

      {props.error !== undefined ? (
        <p role="alert" className="rounded-token border border-danger bg-danger-soft p-3 text-sm text-danger-strong">
          {t(CONNECTION_ERROR_KEYS[props.error.code])}
        </p>
      ) : null}
    </div>
  );
}
