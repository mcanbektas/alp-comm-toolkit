/**
 * Protocol Converter ekranı — spec §33.
 *
 * Spec'in tarif ettiği zincir tek ekranda: kaynak protokolün ÇÖZÜCÜSÜ baytları
 * alanlara açar, kullanıcı alanları hedef adlara eşler, hedef biçimi çıktıyı
 * üretir. MQTT hedefinde çıktı metin değil GERÇEK PAKETTİR ve baytları `mqtt`
 * plugin'inin kendi encoder'ı yazar — ekran kendi kodlayıcısını yazsaydı
 * monitörün çözdüğü paketten ayrışabilirdi.
 *
 * Ekran HESAP YAPMAZ (CLAUDE.md mimari kuralı): çeviri `converterEngine.ts`te
 * saf ve senkron, ekran yalnız durumu toplayıp sonucu çizer.
 */

import { useCallback } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

import { useTranslation } from '@/app/providers/LanguageProvider';
import { useConverterHandoffStore } from '@/app/store/converterHandoffStore';
import { bytesToHex } from '@/protocol-core/buffers/representation';

import { MappingPanel } from './components/MappingPanel';
import { OutputPanel } from './components/OutputPanel';
import type { ConvertedPacket, DestinationKind } from './converterTypes';
import { sourceOptions, useProtocolConverter } from './useProtocolConverter';

const SECTION_CLASS = 'flex flex-col gap-3 rounded-token border border-line bg-surface p-4';
const SECTION_TITLE_CLASS = 'font-display text-sm font-semibold uppercase tracking-wide text-muted';
const FIELD_CLASS = 'rounded-token-sm border border-line bg-surface px-2 py-1 text-sm text-text';
const LABEL_CLASS = 'flex flex-col gap-1 text-xs text-muted';

const DESTINATION_KINDS: readonly DestinationKind[] = ['mqtt-publish', 'json', 'csv'];

export function ProtocolConverterScreen(): ReactNode {
  const { t } = useTranslation();
  const converter = useProtocolConverter();
  const { state, pluginState, parseState, output } = converter;
  const options = sourceOptions();
  const fields = parseState.status === 'ok' ? parseState.frame.fields : [];

  const navigate = useNavigate();
  const setPendingPacket = useConverterHandoffStore((store) => store.setPendingPacket);

  /**
   * Bir sonraki `/packet-builder` ziyaretinde `hexOverride`e uygulanacak
   * ham hex `converterHandoffStore`a bırakılır — feature'lar arası doğrudan
   * import yasak (CLAUDE.md mimari kuralı), `protocolSchemaStore.ts`nin
   * Studio↔Builder köprüsüyle AYNI desen.
   */
  const handleSendToPacketBuilder = useCallback(
    (packet: ConvertedPacket) => {
      setPendingPacket(bytesToHex(packet.bytes), packet.topic);
      navigate('/packet-builder');
    },
    [navigate, setPendingPacket],
  );

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-xl font-semibold text-text sm:text-2xl">{t('converter.title')}</h1>
        <p className="max-w-3xl text-sm text-muted">{t('converter.intro')}</p>
      </header>

      <section className={SECTION_CLASS}>
        <h2 className={SECTION_TITLE_CLASS}>{t('converter.section.source')}</h2>
        <div className="flex flex-wrap items-end gap-3">
          <label className={LABEL_CLASS} htmlFor="converter-source-protocol">
            {t('converter.field.sourceProtocol')}
            <select
              id="converter-source-protocol"
              data-testid="converter-source-protocol"
              className={FIELD_CLASS}
              value={state.sourcePluginId}
              onChange={(event) => converter.setSourcePluginId(event.target.value)}
            >
              {/* Protokol adı veridir, çeviriye girmez. */}
              {options.map((option) => (
                <option key={option.pluginId} value={option.pluginId}>
                  {option.name}
                </option>
              ))}
            </select>
          </label>

          <label className={`${LABEL_CLASS} grow`} htmlFor="converter-hex">
            {t('converter.field.hex')}
            <input
              id="converter-hex"
              data-testid="converter-hex"
              className={`${FIELD_CLASS} font-mono`}
              value={state.hexInput}
              onChange={(event) => converter.setHexInput(event.target.value)}
            />
          </label>
        </div>

        {pluginState.status === 'loading' ? (
          <p role="status" className="text-sm text-muted" data-testid="converter-loading">
            {t('common.loading')}
          </p>
        ) : null}

        {pluginState.status === 'failed' ? (
          <p role="alert" className="text-sm text-danger" data-testid="converter-load-error">
            {/* Kimlik ve teknik ayrıntı veridir, birebir aktarılır. */}
            {t('converter.loadFailed')} — {state.sourcePluginId}: {pluginState.detail}
          </p>
        ) : null}

        {parseState.status === 'invalid-hex' ? (
          <p className="text-sm text-warn" data-testid="converter-parse-issue">
            {t('converter.parse.invalidHex')}
          </p>
        ) : null}

        {parseState.status === 'failed' ? (
          <p className="text-sm text-warn" data-testid="converter-parse-issue">
            {t('converter.parse.failed', { detail: parseState.detail })}
          </p>
        ) : null}

        {parseState.status === 'no-parser' && pluginState.status === 'ready' ? (
          <p className="text-sm text-warn" data-testid="converter-parse-issue">
            {t('converter.parse.noParser')}
          </p>
        ) : null}

        {parseState.status === 'ok' ? (
          <p className="text-xs text-muted" data-testid="converter-field-count">
            {t('converter.source.fieldCount', { count: fields.length })}
          </p>
        ) : null}
      </section>

      <section className={SECTION_CLASS}>
        <h2 className={SECTION_TITLE_CLASS}>{t('converter.section.mapping')}</h2>
        <MappingPanel
          mappings={state.mappings}
          fields={fields}
          onAdd={converter.addMapping}
          onRemove={converter.removeMapping}
          onUpdate={converter.updateMapping}
        />
      </section>

      <section className={SECTION_CLASS}>
        <h2 className={SECTION_TITLE_CLASS}>{t('converter.section.output')}</h2>
        <label className={LABEL_CLASS} htmlFor="converter-destination">
          {t('converter.field.destination')}
          <select
            id="converter-destination"
            data-testid="converter-destination"
            className={FIELD_CLASS}
            value={state.destination}
            onChange={(event) => converter.setDestination(event.target.value as DestinationKind)}
          >
            {DESTINATION_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {t(
                  kind === 'json'
                    ? 'converter.destination.json'
                    : kind === 'csv'
                      ? 'converter.destination.csv'
                      : 'converter.destination.mqtt',
                )}
              </option>
            ))}
          </select>
        </label>

        <OutputPanel output={output} onSendToPacketBuilder={handleSendToPacketBuilder} />
      </section>
    </div>
  );
}
