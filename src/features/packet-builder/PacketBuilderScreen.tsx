/**
 * Packet Builder ekranı — spec §10'un ekran karşılığı.
 *
 * Bu bileşen HESAP YAPMAZ: kodlama, checksum, post-processing ve zamanlama
 * `packetPipeline` / `sendScheduler` saf modüllerinde, durum yönetimi
 * `usePacketBuilder`da. Buradaki tek iş panelleri yerleştirmek ve §42'nin 13
 * bölümünü sayfaya bağlamak (CLAUDE.md mimari kuralı).
 *
 * ## §42 bölümleri neden `<details>`
 *
 * 13 bölümün tamamı her araçta ZORUNLU, ama hepsi aynı anda açık dururken
 * asıl araç (form + önizleme + gönderim) ekranın altına itilir. Katlanmış
 * `<details>` bölümü kaldırmadan görünürlüğü kullanıcıya bırakır; `<summary>`
 * yerleşik olarak klavye ve ekran okuyucu ile açılabilir, kendi yazacağımız
 * bir aç/kapa düğmesinin aksine.
 *
 * ## "Paketi oluştur" düğmesi neden var
 *
 * Üretim ANLIKTIR: `usePacketBuilder` her tuş vuruşunda paketi yeniden türetir,
 * yani düğme paketi "hesaplatmaz". Yine de §42'nin 5. maddesi açık bir hesap
 * düğmesi istiyor ve düğmenin gerçek bir işlevi var: `aria-live` bölgesine
 * sonucu YENİDEN duyurur. Ekran okuyucu kullanıcısı formu doldururken her
 * tuşta duyuru almaz; "şu an elimde ne var" sorusunun cevabı bu düğmededir.
 */

import { useCallback, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

import { useTranslation } from '@/app/providers/LanguageProvider';
import { CopyButton, ResultField } from '@/components/forms';
import { bytesToHex } from '@/protocol-core/buffers/representation';
import {
  generateCArray,
  generateJavaScriptArray,
  generatePythonArray,
} from '@/protocol-core/encoding/codeGenerators';
import { SPEC_BUILDER_FRAME, SPEC_SENSOR_PROTOCOL_JSON } from '@/protocol-core/schemas/specFixture';
import type { TranslationKey } from '@/translations';
import { downloadTextFile } from '@/utils/downloadTextFile';

import type { BuilderSourceKind } from './builderTypes';
import { BuilderConnectionPanel } from './components/BuilderConnectionPanel';
import { FieldValueForm } from './components/FieldValueForm';
import { PacketPreviewPanel } from './components/PacketPreviewPanel';
import { SendControlPanel } from './components/SendControlPanel';
import type { BuilderFieldDescriptor } from './packetPipeline';
import { usePacketBuilder } from './usePacketBuilder';

/** Üretilen kod ve indirilen dosyadaki değişken adı — tanımlayıcı, çeviriye girmez. */
const PACKET_VARIABLE_NAME = 'packet';

/** İndirilen dosya adları. Dosya adı veri değil kimliktir; çevrilmez. */
const DOWNLOAD_NAMES = {
  hex: 'packet.txt',
  c: 'packet.h',
  python: 'packet.py',
  javascript: 'packet.js',
} as const;

const MIME_TEXT = 'text/plain';

function buttonClass(): string {
  return 'rounded-token border border-line bg-raised px-3 py-1.5 text-sm text-text transition-colors hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-50';
}

function primaryButtonClass(): string {
  return 'rounded-token border border-line-strong bg-accent px-3 py-1.5 text-sm text-on-accent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-50';
}

function sectionClass(): string {
  return 'flex min-w-0 flex-col gap-3 rounded-token border border-line bg-surface p-4';
}

function headingClass(): string {
  return 'font-display text-sm font-semibold uppercase tracking-wide text-muted';
}

interface DocSectionProps {
  readonly testId: string;
  readonly title: string;
  readonly children: ReactNode;
}

/** §42'nin tek bir bölümü. Başlık `<summary>`dedir; açma/kapama tarayıcınındır. */
function DocSection({ testId, title, children }: DocSectionProps): ReactNode {
  return (
    <details
      data-testid={testId}
      className="rounded-token border border-line bg-raised px-3 py-2"
    >
      <summary className="cursor-pointer text-sm font-medium text-text hover:text-accent">
        {title}
      </summary>
      <div className="mt-2 flex flex-col gap-2 text-sm text-muted">{children}</div>
    </details>
  );
}

export function PacketBuilderScreen(): ReactNode {
  const { t } = useTranslation();
  const builder = usePacketBuilder();

  /**
   * Seçili kaynak EKRANDA tutulur, panelde değil: §40'ın proje dosyası bu
   * seçimi kaydetmek zorunda ve panel içinde kalsaydı bilgi buraya hiç
   * ulaşmazdı (bkz. `BuilderConnectionPanelProps` yorumu).
   */
  const [selectedKind, setSelectedKind] = useState<BuilderSourceKind>('simulated');
  /**
   * "Paketi oluştur" kaç kez basıldı. Duyuru metni yalnız durum değişince
   * yenilenir; sayaç bir kez bile basılmadığını ("henüz istenmedi") ayırt
   * etmek için tutuluyor.
   */
  const [buildRequests, setBuildRequests] = useState(0);
  /** İndirme başarısızsa (Blob URL yok) sessiz kalmıyoruz — bkz. `downloadTextFile`. */
  const [exportErrorKey, setExportErrorKey] = useState<string | null>(null);

  const outgoing = builder.outgoingBytes;
  const outgoingHex = useMemo(() => (outgoing === null ? '' : bytesToHex(outgoing)), [outgoing]);
  const rawFrame = builder.buildResult?.rawFrame ?? null;
  const rawHex = useMemo(() => (rawFrame === null ? '' : bytesToHex(rawFrame)), [rawFrame]);
  const issues = builder.buildResult?.issues ?? [];
  const canSend = builder.connection.canWrite && outgoing !== null;

  const handleConnect = useCallback(() => {
    // `requestSerialPort` KULLANICI JESTİ içinde çağrılmalı (spec §41); bu
    // geri çağırım tıklama işleyicisinden senkron başladığı için izin istemi
    // açılır. `void` ile beklenmiyor: tıklama işleyicisi senkron kalmalı.
    void builder.connect(selectedKind);
  }, [builder, selectedKind]);

  const handleDisconnect = useCallback(() => {
    void builder.disconnect();
  }, [builder]);

  const handleDownload = useCallback((fileName: string, text: string) => {
    try {
      downloadTextFile(fileName, text, MIME_TEXT);
      setExportErrorKey(null);
    } catch {
      // "İndirdim" numarası yapmak kullanıcının verisinin kaybolduğunu gizler.
      setExportErrorKey('builder.export.failed');
    }
  }, []);

  const buildStatusKey: TranslationKey =
    buildRequests === 0
      ? 'builder.build.idle'
      : outgoing === null
        ? 'builder.build.blocked'
        : 'builder.build.ready';

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-xl font-semibold text-text sm:text-2xl">
          {t('builder.title')}
        </h1>
        <p className="max-w-3xl text-sm text-muted">{t('builder.intro')}</p>
        <p className="max-w-3xl text-xs text-muted">{t('builder.privacy')}</p>
      </header>

      {/* --- Şema durumu şeridi ------------------------------------------- */}
      <section className={sectionClass()} data-testid="builder-schema-strip">
        <h2 className={headingClass()}>{t('builder.section.schema')}</h2>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {builder.schema === null ? (
            <p className="text-sm text-muted" data-testid="builder-schema-missing">
              {t('builder.schema.missing')}
            </p>
          ) : (
            <>
              <span className="text-sm text-muted">
                {t('builder.schema.nameLabel')}{' '}
                <span className="font-medium text-text" data-testid="builder-schema-name">
                  {builder.schema.name}
                </span>
              </span>
              <span className="text-sm text-muted">
                {t('builder.schema.versionLabel')}{' '}
                <span className="tabular font-medium text-text" data-testid="builder-schema-version">
                  {builder.schema.version}
                </span>
              </span>
            </>
          )}

          <Link
            to="/protocol-studio"
            data-testid="builder-open-studio"
            className="rounded-token border border-line bg-raised px-3 py-1.5 text-sm text-text transition-colors hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            {t('builder.schema.editInStudio')}
          </Link>

          <button
            type="button"
            data-testid="builder-reload-schema"
            className={buttonClass()}
            onClick={builder.reloadSchema}
          >
            {t('builder.schema.reload')}
          </button>
        </div>

        {builder.schemaErrorKey !== null ? (
          <p
            role="alert"
            data-testid="builder-schema-error"
            className="rounded-token border border-line bg-danger-soft p-3 text-sm text-danger-strong"
          >
            {t(builder.schemaErrorKey as TranslationKey)}
          </p>
        ) : null}
      </section>

      {/* --- Bağlantı ------------------------------------------------------ */}
      <section className={sectionClass()}>
        <h2 className={headingClass()}>{t('builder.section.connection')}</h2>
        <BuilderConnectionPanel
          connection={builder.connection}
          selectedKind={selectedKind}
          onSelectedKindChange={setSelectedKind}
          onConnect={handleConnect}
          onDisconnect={handleDisconnect}
        />
      </section>

      {/* --- İki sütun: solda form, sağda önizleme + gönderim -------------- */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <section className={sectionClass()}>
          <h2 className={headingClass()}>{t('builder.section.form')}</h2>
          <FieldValueForm
            fields={builder.fields}
            values={builder.values}
            issues={issues}
            onValueChange={builder.setValue}
            onStepValue={builder.stepValue}
            onRandomize={builder.randomize}
          />
        </section>

        <div className="flex min-w-0 flex-col gap-5">
          <section className={sectionClass()}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className={headingClass()}>{t('builder.section.preview')}</h2>
              <button
                type="button"
                data-testid="builder-build"
                className={primaryButtonClass()}
                onClick={() => {
                  setBuildRequests((count) => count + 1);
                }}
              >
                {t('builder.action.build')}
              </button>
            </div>

            {/* Duyuru metni + bayt sayısı: sayı değiştiği için aynı durum
                tekrarlansa bile ekran okuyucu yeni içerik görür. */}
            <p
              role="status"
              aria-live="polite"
              data-testid="builder-build-status"
              className="text-sm text-muted"
            >
              {t(buildStatusKey)}{' '}
              <span className="tabular font-medium text-text" data-testid="builder-build-byte-count">
                {outgoing?.length ?? 0}
              </span>
            </p>

            <PacketPreviewPanel
              bytes={outgoing}
              issues={issues}
              hexOverride={builder.hexOverride}
              onHexOverrideChange={builder.setHexOverride}
              postProcessing={builder.postProcessing}
              onPostProcessingChange={builder.setPostProcessing}
            />
          </section>

          <section className={sectionClass()}>
            <h2 className={headingClass()}>{t('builder.section.send')}</h2>
            <SendControlPanel
              config={builder.schedulerConfig}
              onConfigChange={builder.setSchedulerConfig}
              responseTimeoutMs={builder.responseTimeoutMs}
              onResponseTimeoutMsChange={builder.setResponseTimeoutMs}
              state={builder.scheduler}
              canSend={canSend}
              lastResponse={builder.lastResponse}
              onSend={builder.send}
              onStop={builder.stopSending}
            />
          </section>
        </div>
      </div>

      {/* --- Spec §42'nin 13 bölümü ---------------------------------------- */}
      <section className={sectionClass()} data-testid="builder-doc">
        <h2 className={headingClass()}>{t('builder.section.documentation')}</h2>

        <DocSection testId="builder-doc-purpose" title={t('builder.doc.purpose.title')}>
          <p>{t('builder.doc.purpose.body')}</p>
        </DocSection>

        <DocSection testId="builder-doc-protocols" title={t('builder.doc.protocols.title')}>
          <p>{t('builder.doc.protocols.body')}</p>
        </DocSection>

        <DocSection testId="builder-doc-inputs" title={t('builder.doc.inputs.title')}>
          <p>{t('builder.doc.inputs.body')}</p>
          <ul className="list-disc pl-5">
            <li>{t('builder.doc.inputs.fields')}</li>
            <li>{t('builder.doc.inputs.postProcessing')}</li>
            <li>{t('builder.doc.inputs.hexOverride')}</li>
            <li>{t('builder.doc.inputs.sending')}</li>
          </ul>
        </DocSection>

        {/* (4) Örnek veri — §9.6 şeması ve §10 paketi, kopyalanabilir hâlde. */}
        <DocSection testId="builder-doc-example" title={t('builder.doc.example.title')}>
          <p>{t('builder.doc.example.body')}</p>
          <div data-testid="builder-example-packet">
            <ResultField
              id="builder-example-packet-value"
              label={t('builder.example.packetLabel')}
              value={bytesToHex(SPEC_BUILDER_FRAME)}
            />
          </div>
          <div data-testid="builder-example-schema">
            <ResultField
              id="builder-example-schema-value"
              label={t('builder.example.schemaLabel')}
              value={SPEC_SENSOR_PROTOCOL_JSON}
            />
          </div>
        </DocSection>

        {/* (5) Hesap düğmesi — düğmenin kendisi önizleme bölümünde. */}
        <DocSection testId="builder-doc-action" title={t('builder.doc.action.title')}>
          <p>{t('builder.doc.action.body')}</p>
        </DocSection>

        <DocSection testId="builder-doc-result" title={t('builder.doc.result.title')}>
          <p>{t('builder.doc.result.body')}</p>
          <div data-testid="builder-doc-result-hex">
            <ResultField
              id="builder-doc-result-hex-value"
              label={t('builder.result.outgoingLabel')}
              value={outgoingHex}
            />
          </div>
        </DocSection>

        {/* (7) Formül — checksum algoritması ve kapsamı. */}
        <DocSection testId="builder-doc-formula" title={t('builder.doc.formula.title')}>
          <p>{t('builder.doc.formula.body')}</p>
          <p className="font-mono text-xs text-text" data-testid="builder-formula-expression">
            {t('builder.doc.formula.expression')}
          </p>
          <p>{t('builder.doc.formula.coverage')}</p>
          <p>{t('builder.doc.formula.crcNote')}</p>
        </DocSection>

        {/* (8) Adım adım — alanların sırası ve şu anki değerleri. */}
        <DocSection testId="builder-doc-steps" title={t('builder.doc.steps.title')}>
          <p>{t('builder.doc.steps.body')}</p>
          {builder.fields.length === 0 ? (
            <p data-testid="builder-steps-empty">{t('builder.steps.empty')}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs" data-testid="builder-steps-table">
                <caption className="sr-only">{t('builder.steps.tableLabel')}</caption>
                <thead>
                  <tr className="text-muted">
                    <th scope="col" className="py-1 pr-3 font-medium">
                      {t('builder.steps.column.order')}
                    </th>
                    <th scope="col" className="py-1 pr-3 font-medium">
                      {t('builder.steps.column.field')}
                    </th>
                    <th scope="col" className="py-1 pr-3 font-medium">
                      {t('builder.steps.column.type')}
                    </th>
                    <th scope="col" className="py-1 pr-3 font-medium">
                      {t('builder.steps.column.value')}
                    </th>
                    <th scope="col" className="py-1 font-medium">
                      {t('builder.steps.column.role')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {builder.fields.map((field: BuilderFieldDescriptor, index: number) => (
                    <tr
                      key={field.path}
                      data-testid={`builder-step-${field.path}`}
                      className="border-t border-line text-text"
                    >
                      <td className="tabular py-1 pr-3">{index + 1}</td>
                      <td className="py-1 pr-3">{field.name}</td>
                      <td className="py-1 pr-3 font-mono">{field.type}</td>
                      <td className="py-1 pr-3 font-mono">{builder.values[field.path] ?? ''}</td>
                      <td className="py-1">
                        {field.derived ? t('builder.steps.role.derived') : t('builder.steps.role.input')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div data-testid="builder-steps-raw">
            <ResultField
              id="builder-steps-raw-value"
              label={t('builder.steps.rawFrame')}
              value={rawHex}
            />
          </div>
          <div data-testid="builder-steps-framed">
            <ResultField
              id="builder-steps-framed-value"
              label={t('builder.steps.framedBytes')}
              value={outgoingHex}
            />
          </div>
        </DocSection>

        <DocSection testId="builder-doc-interpretation" title={t('builder.doc.interpretation.title')}>
          <p>{t('builder.doc.interpretation.body')}</p>
          <p>{t('builder.doc.interpretation.response')}</p>
        </DocSection>

        {/* (10) Sınırlamalar — hepsi gerçek, hiçbiri temenni değil. */}
        <DocSection testId="builder-doc-limits" title={t('builder.doc.limits.title')}>
          <ul className="list-disc pl-5">
            <li data-testid="builder-limit-websocket">{t('builder.doc.limits.websocket')}</li>
            <li data-testid="builder-limit-single-owner">{t('builder.doc.limits.singleOwner')}</li>
            <li data-testid="builder-limit-checksum-order">{t('builder.doc.limits.checksumOrder')}</li>
            <li data-testid="builder-limit-offset">{t('builder.doc.limits.offsetIgnored')}</li>
            <li data-testid="builder-limit-permission">{t('builder.doc.limits.permissionDenied')}</li>
            <li>{t('builder.doc.limits.simulatedReadOnly')}</li>
          </ul>
        </DocSection>

        {/* (11) Yaygın hatalar — §10'un `6C` dizgi hatası dahil. */}
        <DocSection testId="builder-doc-mistakes" title={t('builder.doc.mistakes.title')}>
          <ul className="list-disc pl-5">
            <li data-testid="builder-mistake-spec-checksum">
              {t('builder.doc.mistakes.specChecksum')}
            </li>
            <li>{t('builder.doc.mistakes.derivedFields')}</li>
            <li>{t('builder.doc.mistakes.hexOverride')}</li>
            <li>{t('builder.doc.mistakes.oddHexDigits')}</li>
            <li>{t('builder.doc.mistakes.frameTooLong')}</li>
            <li>{t('builder.doc.mistakes.enumLabel')}</li>
          </ul>
        </DocSection>

        {/* (12) Kopyalama. */}
        <DocSection testId="builder-doc-copy" title={t('builder.doc.copy.title')}>
          <p>{t('builder.doc.copy.body')}</p>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted">{t('builder.copy.outgoingLabel')}</span>
            <CopyButton value={outgoingHex} />
            <span className="text-xs text-muted">{t('builder.copy.exampleLabel')}</span>
            <CopyButton value={bytesToHex(SPEC_BUILDER_FRAME)} />
          </div>
        </DocSection>

        {/* (13) Dışa aktarma — paket ve üç dilde kod, hepsi istemcide üretilir. */}
        <DocSection testId="builder-doc-export" title={t('builder.doc.export.title')}>
          <p>{t('builder.doc.export.body')}</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              data-testid="builder-export-hex"
              className={buttonClass()}
              disabled={outgoing === null}
              onClick={() => {
                handleDownload(DOWNLOAD_NAMES.hex, outgoingHex);
              }}
            >
              {t('builder.export.hex')}
            </button>
            <button
              type="button"
              data-testid="builder-export-c"
              className={buttonClass()}
              disabled={outgoing === null}
              onClick={() => {
                handleDownload(
                  DOWNLOAD_NAMES.c,
                  generateCArray(outgoing ?? new Uint8Array(0), PACKET_VARIABLE_NAME),
                );
              }}
            >
              {t('builder.export.c')}
            </button>
            <button
              type="button"
              data-testid="builder-export-python"
              className={buttonClass()}
              disabled={outgoing === null}
              onClick={() => {
                handleDownload(
                  DOWNLOAD_NAMES.python,
                  generatePythonArray(outgoing ?? new Uint8Array(0), PACKET_VARIABLE_NAME),
                );
              }}
            >
              {t('builder.export.python')}
            </button>
            <button
              type="button"
              data-testid="builder-export-javascript"
              className={buttonClass()}
              disabled={outgoing === null}
              onClick={() => {
                handleDownload(
                  DOWNLOAD_NAMES.javascript,
                  generateJavaScriptArray(outgoing ?? new Uint8Array(0), PACKET_VARIABLE_NAME),
                );
              }}
            >
              {t('builder.export.javascript')}
            </button>
          </div>
          {outgoing === null ? (
            <p data-testid="builder-export-unavailable">{t('builder.export.unavailable')}</p>
          ) : null}
          {exportErrorKey !== null ? (
            <p
              role="alert"
              data-testid="builder-export-error"
              className="rounded-token border border-line bg-danger-soft p-3 text-sm text-danger-strong"
            >
              {t(exportErrorKey as TranslationKey)}
            </p>
          ) : null}
        </DocSection>
      </section>
    </div>
  );
}
