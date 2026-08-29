/**
 * Üretilen paketin önizlemesi — spec §10'un "paket önizleme / HEX düzenleme /
 * kod üretimi" maddeleri.
 *
 * ## Neden `regions={[]}`
 *
 * `buildPacket` alan → bayt aralığı eşlemesi DÖNDÜRMEZ; yalnız çerçevenin
 * kendisini verir. Alan sırasından bölge "tahmin etmek" mümkün görünür ama
 * yanlış olur: koşullu alanlar (`condition`) atlanır, diziler `repeatCount`a
 * göre uzar, bit alanları bayt sınırına oturmaz. Uydurulmuş bir renklendirme
 * kullanıcıya checksum'un yanlış baytların üzerinde hesaplandığını
 * düşündürebilir. Bu yüzden bölge verilmiyor ve altına nerede bulunacağı
 * yazılıyor: alan renklendirmesi ayrıştırma yapan Studio'nun işi.
 */

import type { ReactNode } from 'react';

import { useTranslation } from '@/app/providers/LanguageProvider';
import { ByteViewer } from '@/components/byte-viewer';
import type { ByteRegion } from '@/components/byte-viewer';
import { CopyButton, ResultField, SelectField, TextField } from '@/components/forms';
import { bytesToHex } from '@/protocol-core/buffers/representation';
import {
  generateCArray,
  generateJavaScriptArray,
  generatePythonArray,
} from '@/protocol-core/encoding/codeGenerators';
import type { TranslationKey } from '@/translations';

import type { PacketPreviewPanelProps } from '../builderTypes';
import type { PostProcessing } from '../packetPipeline';

const EMPTY_BYTES = new Uint8Array(0);

/** Sabit boş dizi: her render'da yeni `[]` üretmek ByteViewer'ın memo'sunu boşa düşürürdü. */
const NO_REGIONS: readonly ByteRegion[] = [];

/** Üretilen kodda kullanılacak değişken adı — tanımlayıcı, çeviriye girmez. */
const PACKET_VARIABLE_NAME = 'packet';

type BuiltInPostProcessing = Exclude<PostProcessing, 'plugin'>;

const POST_PROCESSING_MODES: readonly BuiltInPostProcessing[] = [
  'none',
  'byteStuffing',
  'bitStuffing',
  'cobs',
  'slip',
];

const POST_PROCESSING_KEYS: Record<BuiltInPostProcessing, TranslationKey> = {
  none: 'builder.postProcessing.none',
  byteStuffing: 'builder.postProcessing.byteStuffing',
  bitStuffing: 'builder.postProcessing.bitStuffing',
  cobs: 'builder.postProcessing.cobs',
  slip: 'builder.postProcessing.slip',
};

/**
 * Plugin zarflarının seçim değerindeki ön eki.
 *
 * Tek bir açılır liste tutuluyor: çerçeveleme kullanıcı için TEK bir sorudur
 * ("bu çerçeve nasıl sarılacak"), iki ayrı kutu aynı soruyu iki kez sorup
 * hangisinin kazandığını belirsiz bırakırdı. Değer uzayı bu yüzden ön ekle
 * ayrılıyor: yerleşik dallar kendi adlarıyla, plugin'ler `plugin:` ile.
 */
const PLUGIN_VALUE_PREFIX = 'plugin:';

function isPostProcessing(value: string): value is BuiltInPostProcessing {
  return (POST_PROCESSING_MODES as readonly string[]).includes(value);
}

export function PacketPreviewPanel(props: PacketPreviewPanelProps): ReactNode {
  const { t } = useTranslation();

  const bytes = props.bytes ?? EMPTY_BYTES;
  const hex = bytesToHex(bytes);
  const overrideEnabled = props.hexOverride !== null;

  const selectedFraming =
    props.framingPluginId === null
      ? props.postProcessing
      : `${PLUGIN_VALUE_PREFIX}${props.framingPluginId}`;

  const selectedPlugin =
    props.framingPluginId === null
      ? undefined
      : props.framingPlugins.find((option) => option.pluginId === props.framingPluginId);

  return (
    <div className="flex flex-col gap-4" data-testid="builder-preview-panel">
      <SelectField
        id="builder-post-processing"
        label={t('builder.field.postProcessing')}
        value={selectedFraming}
        onChange={(value) => {
          if (value.startsWith(PLUGIN_VALUE_PREFIX)) {
            props.onFramingPluginChange(value.slice(PLUGIN_VALUE_PREFIX.length));
            return;
          }
          if (isPostProcessing(value)) {
            props.onPostProcessingChange(value);
          }
        }}
        options={[
          ...POST_PROCESSING_MODES.map((mode) => ({
            value: mode,
            label: t(POST_PROCESSING_KEYS[mode]),
          })),
          ...props.framingPlugins.map((option) => ({
            value: `${PLUGIN_VALUE_PREFIX}${option.pluginId}`,
            // Protokol adı veridir; çeviri sözlüğünden GEÇMEZ.
            label: option.displayName,
          })),
        ]}
      />

      {selectedPlugin?.fixedParametersKey === undefined ? null : (
        <p className="text-xs text-warn" data-testid="builder-framing-fixed-note">
          {t(selectedPlugin.fixedParametersKey as TranslationKey)}
        </p>
      )}

      {props.bytes === null ? (
        <p className="text-sm text-muted" data-testid="builder-preview-empty">
          {t('builder.preview.empty')}
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          <div
            data-testid="builder-byte-viewer"
            className="overflow-x-auto rounded-token border border-line bg-raised p-3"
          >
            <ByteViewer bytes={bytes} regions={NO_REGIONS} />
          </div>
          <p className="text-xs text-muted" data-testid="builder-preview-regions-note">
            {t('builder.preview.regionsNote')}
          </p>
          <p className="text-xs text-muted">
            {t('builder.preview.byteCount')}{' '}
            <span className="tabular" data-testid="builder-preview-byte-count">
              {bytes.length}
            </span>
          </p>
        </div>
      )}

      <div data-testid="builder-preview-hex">
        <ResultField id="builder-preview-hex-value" label={t('builder.preview.hex')} value={hex} />
      </div>

      {props.issues.length > 0 ? (
        <ul className="flex flex-col gap-1" data-testid="builder-preview-issues">
          {props.issues.map((issue, index) => (
            <li
              // Aynı anahtar birden çok alanda tekrar edebilir; yol + sıra benzersiz.
              key={`${issue.fieldId ?? ''}:${issue.messageKey}:${String(index)}`}
              role="alert"
              className="rounded-token border border-line bg-danger-soft px-3 py-2 text-sm text-danger-strong"
            >
              {t(issue.messageKey as TranslationKey, issue.params)}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <input
            id="builder-hex-override-toggle"
            type="checkbox"
            data-testid="builder-hex-override-toggle"
            checked={overrideEnabled}
            onChange={(event) => {
              // Açılışta mevcut paket metne kopyalanır: boş bir kutu açmak,
              // kullanıcıyı elindeki paketi elle yeniden yazmaya zorlardı.
              props.onHexOverrideChange(event.target.checked ? hex : null);
            }}
            className="size-4 shrink-0 rounded-token-sm border border-line bg-surface accent-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          />
          <label htmlFor="builder-hex-override-toggle" className="text-xs font-medium text-text">
            {t('builder.preview.overrideToggle')}
          </label>
        </div>

        {overrideEnabled ? (
          <div data-testid="builder-hex-override">
            <TextField
              id="builder-hex-override-value"
              label={t('builder.preview.overrideLabel')}
              value={props.hexOverride ?? ''}
              onChange={props.onHexOverrideChange}
              monospace
            />
            <p className="mt-1 text-xs text-warn">{t('builder.preview.overrideHint')}</p>
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-3">
        <div data-testid="builder-code-c">
          <ResultField
            id="builder-code-c-value"
            label={t('builder.preview.code.c')}
            value={generateCArray(bytes, PACKET_VARIABLE_NAME)}
          />
        </div>
        <div data-testid="builder-code-python">
          <ResultField
            id="builder-code-python-value"
            label={t('builder.preview.code.python')}
            value={generatePythonArray(bytes, PACKET_VARIABLE_NAME)}
          />
        </div>
        <div data-testid="builder-code-javascript">
          <ResultField
            id="builder-code-javascript-value"
            label={t('builder.preview.code.javascript')}
            value={generateJavaScriptArray(bytes, PACKET_VARIABLE_NAME)}
          />
        </div>
        <div className="flex justify-end">
          <CopyButton value={hex} />
        </div>
      </div>
    </div>
  );
}
