/**
 * Live Serial Monitor ekranı — spec §8'in ekran karşılığı.
 *
 * Bu bileşen HESAP YAPMAZ: çerçeveleme Worker'da, doğrulama/istatistik/seyreltme
 * protocol-core'da, pencereleme sanallaştırılmış tabloda. Buradaki tek iş
 * yapılandırmayı tutmak ve panelleri yerleştirmek (CLAUDE.md mimari kuralı).
 */

import { useCallback, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { useTranslation } from '../../app/providers/LanguageProvider';
import {
  DEFAULT_SERIAL_OPTIONS,
  type SerialConnectionOptions,
} from '../../connection/serial/serialOptions';
import { requestSerialPort } from '../../connection/serial/webSerialTypes';
import { DEFAULT_SIMULATED_STREAM_OPTIONS } from '../../connection/mock/simulatedProtocol';
import { minimumGapForFraming } from '../../connection/file/fileSource';
import type { ReplayPacing } from '../../connection/file/replaySchedule';
import type { LogRecord } from '../../protocol-core/logs/types';
import { parseLogInWorker } from '../../workers/parseLogInWorker';
import { ConnectionPanel, type MonitorSourceKind } from './components/ConnectionPanel';
import { FrameTable } from './components/FrameTable';
import { SignalPanel } from './components/SignalPanel';
import { StatisticsPanel } from './components/StatisticsPanel';
import { formatRecordsAsCsv, formatRecordsAsJson, formatRecordsAsText } from './formatRecord';
import { DEFAULT_PRESET_ID, findPreset } from './presets';
import { useLiveMonitor } from './useLiveMonitor';
import type { DisplayMode, TimestampResolution } from './types';

/** Spec §44'ün 100 000 satır hedefi. */
const BUFFER_CAPACITY = 100_000;
/** Grafiğin kayan penceresi — seyreltmeden ÖNCEKİ örnek sayısı. */
const CHART_SAMPLE_CAPACITY = 4000;
/** Ekrana çizilen azami nokta (spec §44). */
const CHART_MAX_POINTS = 600;
const FRAME_TIMEOUT_MS = 1000;
const MAX_FRAME_LENGTH = 512;

function downloadText(fileName: string, contents: string, mimeType: string): void {
  // Dosya tarayıcıda üretilir ve indirilir — hiçbir bayt sunucuya gitmez (spec §41).
  const blob = new Blob([contents], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function buttonClass(): string {
  return 'rounded-token border border-line bg-raised px-3 py-1.5 text-sm text-text transition-colors hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent';
}

export function LiveMonitorScreen(): ReactNode {
  const { t } = useTranslation();

  const [sourceKind, setSourceKind] = useState<MonitorSourceKind>('simulated');
  /** Köprü genellikle kullanıcının kendi makinesinde koşar; boş kutu ilk denemede kesin hata demekti. */
  const [webSocketUrl, setWebSocketUrl] = useState('ws://localhost:8080');
  const [presetId, setPresetId] = useState(DEFAULT_PRESET_ID);
  const [serialOptions, setSerialOptions] = useState<SerialConnectionOptions>(DEFAULT_SERIAL_OPTIONS);
  const [displayMode, setDisplayMode] = useState<DisplayMode>('hex');
  const [timestampResolution, setTimestampResolution] = useState<TimestampResolution>('ms');
  const [framesPerSecond, setFramesPerSecond] = useState(200);
  const [fileRecords, setFileRecords] = useState<readonly LogRecord[] | undefined>(undefined);
  const [fileName, setFileName] = useState<string | undefined>(undefined);
  const [fileError, setFileError] = useState<string | undefined>(undefined);
  const [pacing, setPacing] = useState<ReplayPacing>('realtime');
  const [replaySpeed, setReplaySpeed] = useState(1);
  const [playbackFinished, setPlaybackFinished] = useState(false);
  const [followTail, setFollowTail] = useState(true);

  const preset = useMemo(() => findPreset(presetId), [presetId]);

  const monitor = useLiveMonitor({
    framing: preset.framing,
    maxFrameLength: MAX_FRAME_LENGTH,
    validation: preset.validation,
    taps: preset.taps,
    bufferCapacity: BUFFER_CAPACITY,
    chartSampleCapacity: CHART_SAMPLE_CAPACITY,
    chartMaxPoints: CHART_MAX_POINTS,
    frameTimeoutMs: FRAME_TIMEOUT_MS,
  });

  const connected = monitor.state.sourceKind !== undefined;

  const handleFileSelected = useCallback(async (file: File) => {
    setFileRecords(undefined);
    setFileError(undefined);
    setPlaybackFinished(false);
    setFileName(file.name);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const { result } = await parseLogInWorker(bytes, file.name);
      if (result.status === 'error') {
        setFileError(result.message);
        return;
      }
      setFileRecords(result.records);
    } catch (cause) {
      setFileError(cause instanceof Error ? cause.message : String(cause));
    }
  }, []);

  const handleConnect = useCallback(async () => {
    if (sourceKind === 'file') {
      if (fileRecords === undefined) {
        setFileError(t('monitor.file.needsFile'));
        return;
      }
      setPlaybackFinished(false);
      await monitor.connectFile(fileRecords, {
        pacing,
        speed: replaySpeed,
        // Kayıt sınırının çerçeve sınırı olarak korunması buna bağlı: seçili
        // çerçeveleme ayarı zaman tabanlıysa iki kayıt o sessizlikten daha
        // yakın gönderilemez, yoksa ikisi tek çerçeveye yapışırdı.
        minimumGapMs: minimumGapForFraming(preset.framing),
        onCompleted: () => {
          setPlaybackFinished(true);
        },
      });
      return;
    }
    if (sourceKind === 'simulated') {
      await monitor.connectSimulated({
        framesPerSecond,
        stream: DEFAULT_SIMULATED_STREAM_OPTIONS,
      });
      return;
    }
    if (sourceKind === 'websocket') {
      await monitor.connectWebSocket(webSocketUrl);
      return;
    }
    // `requestPort` KULLANICI JESTİ içinde çağrılmalı — bu geri çağırım tıklama
    // işleyicisinden senkron başlar, o yüzden izin istemi açılır (spec §41).
    const port = await requestSerialPort();
    await monitor.connectSerial(port, serialOptions);
  }, [fileRecords, framesPerSecond, monitor, pacing, preset.framing, replaySpeed, serialOptions, sourceKind, t, webSocketUrl]);

  const handleDisconnect = useCallback(() => {
    void monitor.disconnect();
  }, [monitor]);

  const exportOptions = useMemo(
    () => ({ displayMode, timestampResolution, taps: preset.taps }),
    [displayMode, preset.taps, timestampResolution],
  );

  const chartData = monitor.chartData();
  const signalStatistics = monitor.signalStatistics();

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-xl font-semibold text-text sm:text-2xl">
          {t('monitor.title')}
        </h1>
        <p className="max-w-3xl text-sm text-muted">{t('monitor.intro')}</p>
        <p className="max-w-3xl text-xs text-muted">{t('monitor.privacy')}</p>
      </header>

      <section className="flex flex-col gap-3 rounded-token border border-line bg-surface p-4">
        <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-muted">
          {t('monitor.section.connection')}
        </h2>
        <ConnectionPanel
          sourceKind={sourceKind}
          webSocketUrl={webSocketUrl}
          onWebSocketUrlChange={setWebSocketUrl}
          onSourceKindChange={setSourceKind}
          serialOptions={serialOptions}
          onSerialOptionsChange={setSerialOptions}
          presetId={presetId}
          onPresetIdChange={setPresetId}
          displayMode={displayMode}
          onDisplayModeChange={setDisplayMode}
          timestampResolution={timestampResolution}
          onTimestampResolutionChange={setTimestampResolution}
          framesPerSecond={framesPerSecond}
          onFramesPerSecondChange={setFramesPerSecond}
          fileName={fileName}
          fileRecordCount={fileRecords?.length}
          fileError={fileError}
          filePlaybackFinished={playbackFinished}
          onFileSelected={(file) => void handleFileSelected(file)}
          pacing={pacing}
          onPacingChange={setPacing}
          replaySpeed={replaySpeed}
          onReplaySpeedChange={setReplaySpeed}
          status={monitor.state.status}
          error={monitor.state.error}
          parserState={monitor.state.parserState}
          connected={connected}
          onConnect={() => void handleConnect()}
          onDisconnect={handleDisconnect}
        />
      </section>

      <section className="flex flex-col gap-3 rounded-token border border-line bg-surface p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-muted">
            {t('monitor.section.stream')}
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted tabular">
              {t('monitor.table.rowCount', { count: monitor.state.recordCount })}
            </span>
            <button
              type="button"
              className={buttonClass()}
              onClick={() => monitor.setDisplayPaused(!monitor.state.displayPaused)}
            >
              {monitor.state.displayPaused ? t('monitor.action.resume') : t('monitor.action.pause')}
            </button>
            <button
              type="button"
              className={buttonClass()}
              aria-pressed={followTail}
              onClick={() => setFollowTail((value) => !value)}
            >
              {t('monitor.action.followTail')}
            </button>
            <button type="button" className={buttonClass()} onClick={monitor.clear}>
              {t('monitor.action.clear')}
            </button>
          </div>
        </div>

        {monitor.state.displayPaused ? (
          <p className="text-xs text-warn">{t('monitor.action.pausedNotice')}</p>
        ) : null}
        {monitor.state.droppedCount > 0 ? (
          <p className="text-xs text-muted">
            {t('monitor.table.dropped', { count: monitor.state.droppedCount })}
          </p>
        ) : null}

        <FrameTable
          recordCount={monitor.state.recordCount}
          recordAt={monitor.recordAt}
          displayMode={displayMode}
          timestampResolution={timestampResolution}
          followTail={followTail}
          onFollowTailChange={setFollowTail}
        />

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={buttonClass()}
            onClick={() =>
              downloadText(
                'live-monitor.csv',
                formatRecordsAsCsv(monitor.allRecords(), exportOptions),
                'text/csv',
              )
            }
          >
            {t('monitor.export.csv')}
          </button>
          <button
            type="button"
            className={buttonClass()}
            onClick={() =>
              downloadText(
                'live-monitor.json',
                formatRecordsAsJson(monitor.allRecords(), exportOptions),
                'application/json',
              )
            }
          >
            {t('monitor.export.json')}
          </button>
          <button
            type="button"
            className={buttonClass()}
            onClick={() =>
              downloadText(
                'live-monitor.txt',
                formatRecordsAsText(monitor.allRecords(), exportOptions),
                'text/plain',
              )
            }
          >
            {t('monitor.export.txt')}
          </button>
        </div>
      </section>

      <section className="flex flex-col gap-3 rounded-token border border-line bg-surface p-4">
        <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-muted">
          {t('monitor.section.signals')}
        </h2>
        <SignalPanel
          taps={preset.taps}
          data={chartData}
          statistics={signalStatistics}
          maxPoints={CHART_MAX_POINTS}
        />
      </section>

      <section className="flex flex-col gap-3 rounded-token border border-line bg-surface p-4">
        <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-muted">
          {t('monitor.section.statistics')}
        </h2>
        <StatisticsPanel statistics={monitor.state.statistics} />
      </section>
    </div>
  );
}
