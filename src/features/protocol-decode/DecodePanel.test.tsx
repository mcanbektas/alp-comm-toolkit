import { fireEvent, render, screen, within } from '@testing-library/react';
import type { RenderResult } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { LANGUAGE_STORAGE_KEY, LanguageProvider } from '@/app/providers/LanguageProvider';
import { parseWithSchema } from '@/protocol-core/decoding/schemaParser';
import { registerProtocolPlugin } from '@/protocol-core/registry';
import type { ProtocolPluginModule } from '@/protocol-core/registry';
import { SPEC_SENSOR_FRAME, SPEC_SENSOR_PROTOCOL } from '@/protocol-core/schemas/specFixture';
import type { ParseResult, ProtocolParser, ProtocolPlugin } from '@/protocol-core/types';
import { translations } from '@/translations/all';

import { DecodePanel } from './DecodePanel';

/**
 * Kayıt defteri SAHTELENMEDİ (`vi.mock` yok): panelin sınandığı asıl şey lazy
 * yüklemenin üç durumu ve gerçek `ParseResult` ile ekran arasındaki köprü.
 * Defteri sahtelemek tam da o köprünün kendisini taklit etmek olurdu.
 *
 * Çözümleyici de gerçek: `parseWithSchema` + spec §9.6 şeması. Elle yazılmış
 * bir `ParsedFrame` fixture'ı panelin gösterdiği hex/ondalık çiftini, checksum
 * uyarısını ve bölge geometrisini taklit edemez.
 */

const READY_ID = 'test-decode-ready';
const SLOW_ID = 'test-decode-slow';
const FAILING_ID = 'test-decode-failing';
const ENCODER_ONLY_ID = 'test-decode-encoder-only';
const CRASHING_ID = 'test-decode-crashing';
const NO_EXAMPLES_ID = 'test-decode-no-examples';
/** Deftere hiç kaydedilmez: `unknown-protocol` yolunu sınar. */
const UNREGISTERED_ID = 'test-decode-unregistered';

const LOADER_FAILURE_MESSAGE = 'Network error while fetching chunk';
const PARSER_CRASH_MESSAGE = 'Parser exploded';

/** `AA 05 10 03 34 12 7F 4F 55` — checksum baytı 0x4F yerine 0x50. */
const BAD_CHECKSUM_FRAME = Uint8Array.from([
  0xaa, 0x05, 0x10, 0x03, 0x34, 0x12, 0x7f, 0x50, 0x55,
]);

/** Başlangıç baytı bozuk: çerçeveleme doğrulaması çözümlemeyi hiç başlatmaz. */
const BAD_START_FRAME = Uint8Array.from([
  0xbb, 0x05, 0x10, 0x03, 0x34, 0x12, 0x7f, 0x4f, 0x55,
]);

const SPEC_RESULT: ParseResult = parseWithSchema(SPEC_SENSOR_PROTOCOL, SPEC_SENSOR_FRAME);
const BAD_CHECKSUM_RESULT: ParseResult = parseWithSchema(SPEC_SENSOR_PROTOCOL, BAD_CHECKSUM_FRAME);
const BAD_START_RESULT: ParseResult = parseWithSchema(SPEC_SENSOR_PROTOCOL, BAD_START_FRAME);

function specParser(protocolId: string): ProtocolParser {
  return {
    protocolId,
    displayName: 'ALP Sensor Protocol',
    canParse: (data: Uint8Array): boolean => data[0] === 0xaa,
    parse: (data: Uint8Array): ParseResult => parseWithSchema(SPEC_SENSOR_PROTOCOL, data),
  };
}

const READY_PLUGIN: ProtocolPlugin = {
  id: READY_ID,
  name: 'ALP Sensor Protocol',
  category: 'industrial-automation',
  parser: specParser(READY_ID),
  exampleFrames: [
    {
      id: 'valid',
      name: 'Sensor Data',
      bytes: SPEC_SENSOR_FRAME,
      description: 'XOR8 checksum doğrulanmış referans çerçeve',
    },
    { id: 'bad-checksum', name: 'Bad checksum', bytes: BAD_CHECKSUM_FRAME, expectedValid: false },
    { id: 'bad-start', name: 'Bad start delimiter', bytes: BAD_START_FRAME, expectedValid: false },
  ],
};

const ENCODER_ONLY_PLUGIN: ProtocolPlugin = {
  id: ENCODER_ONLY_ID,
  name: 'Encoder Only Protocol',
  category: 'industrial-automation',
  encoder: { encode: (): Uint8Array => SPEC_SENSOR_FRAME },
  exampleFrames: [{ id: 'valid', name: 'Sensor Data', bytes: SPEC_SENSOR_FRAME }],
};

const CRASHING_PLUGIN: ProtocolPlugin = {
  id: CRASHING_ID,
  name: 'Crashing Protocol',
  category: 'industrial-automation',
  parser: {
    protocolId: CRASHING_ID,
    displayName: 'Crashing Protocol',
    canParse: (): boolean => true,
    parse: (): ParseResult => {
      throw new Error(PARSER_CRASH_MESSAGE);
    },
  },
  exampleFrames: [{ id: 'valid', name: 'Sensor Data', bytes: SPEC_SENSOR_FRAME }],
};

const NO_EXAMPLES_PLUGIN: ProtocolPlugin = {
  id: NO_EXAMPLES_ID,
  name: 'Exampleless Protocol',
  category: 'industrial-automation',
  parser: specParser(NO_EXAMPLES_ID),
  exampleFrames: [],
};

registerProtocolPlugin(READY_ID, () => Promise.resolve(READY_PLUGIN));
registerProtocolPlugin(ENCODER_ONLY_ID, () => Promise.resolve(ENCODER_ONLY_PLUGIN));
registerProtocolPlugin(CRASHING_ID, () => Promise.resolve(CRASHING_PLUGIN));
registerProtocolPlugin(NO_EXAMPLES_ID, () => Promise.resolve(NO_EXAMPLES_PLUGIN));
// Hiç çözülmeyen loader: "yükleniyor" durumu ancak böyle gözlemlenebilir.
registerProtocolPlugin(SLOW_ID, () => new Promise<ProtocolPluginModule>(() => undefined));
registerProtocolPlugin(FAILING_ID, () => Promise.reject(new Error(LOADER_FAILURE_MESSAGE)));

function renderPanel(pluginId: string): RenderResult {
  return render(
    <LanguageProvider>
      <DecodePanel pluginId={pluginId} />
    </LanguageProvider>,
  );
}

/** Hazır olana kadar bekler; her testin ilk adımı bu. */
async function renderReady(pluginId: string): Promise<HTMLElement> {
  renderPanel(pluginId);
  return screen.findByTestId('decode-panel');
}

function hexInput(): HTMLTextAreaElement {
  const node = screen.getByRole('textbox');
  if (!(node instanceof HTMLTextAreaElement)) {
    throw new Error('Hex girdisi bir textarea değil');
  }
  return node;
}

/** ByteViewer bölgeyi `data-region-id` taşıyan bir düğmeyle çiziyor. */
function regionButton(regionId: string): HTMLElement {
  const node = screen
    .getByTestId('byte-viewer')
    .querySelector(`[data-region-id="${regionId}"]`);
  if (!(node instanceof HTMLElement)) {
    throw new Error(`Bölge çizilmemiş: ${regionId}`);
  }
  return node;
}

/** Sütun sırası: ad · ofset · uzunluk · ham · fiziksel · geçerlilik. */
function cellText(row: HTMLElement, columnIndex: number): string {
  const cell = row.querySelectorAll('td')[columnIndex];
  if (cell === undefined) {
    throw new Error(`Satırda ${String(columnIndex)}. hücre yok`);
  }
  return cell.textContent ?? '';
}

function fieldRow(fieldId: string): HTMLElement {
  const row = screen
    .getAllByTestId('decode-field-row')
    .find((candidate) => candidate.dataset['fieldId'] === fieldId);
  if (row === undefined) {
    throw new Error(`Alan satırı yok: ${fieldId}`);
  }
  return row;
}

beforeEach(() => {
  // jsdom'un dili İngilizce; sözlük karşılaştırmaları yapılacağı için başlangıç
  // dili AÇIKÇA sabitlenir.
  window.localStorage.clear();
  window.localStorage.setItem(LANGUAGE_STORAGE_KEY, 'tr');
});

describe('DecodePanel fixtures', () => {
  it('uses a real engine whose results match the spec §43 reference frame', () => {
    // Testlerin dayandığı üç sonucun şekli burada çivileniyor; aşağıdaki
    // beklentiler bu ayrımlara göre yazıldı.
    expect(SPEC_RESULT.success).toBe(true);
    expect(BAD_CHECKSUM_RESULT.success).toBe(true);
    expect(BAD_START_RESULT.success).toBe(false);
  });
});

describe('DecodePanel loading states', () => {
  it('shows the loading state while the plugin module is in flight', () => {
    renderPanel(SLOW_ID);
    expect(screen.getByTestId('decode-loading')).toHaveTextContent(
      translations.tr['common.loading'],
    );
    expect(screen.queryByTestId('decode-panel')).not.toBeInTheDocument();
  });

  it('reports a rejected loader instead of swallowing it', async () => {
    renderPanel(FAILING_ID);
    const alert = await screen.findByTestId('decode-load-error');
    expect(alert).toBeInTheDocument();
    expect(screen.getByTestId('decode-load-error-detail')).toHaveTextContent(
      LOADER_FAILURE_MESSAGE,
    );
    expect(screen.queryByTestId('decode-panel')).not.toBeInTheDocument();
  });

  it('reports an unregistered plugin id', async () => {
    renderPanel(UNREGISTERED_ID);
    const detail = await screen.findByTestId('decode-load-error-detail');
    expect(detail).toHaveTextContent(UNREGISTERED_ID);
    expect(detail).toHaveTextContent('is not registered');
  });
});

describe('DecodePanel example frames', () => {
  it('loads the first example frame by default, so the tab never opens empty', async () => {
    await renderReady(READY_ID);
    expect(hexInput()).toHaveValue('AA 05 10 03 34 12 7F 4F 55');
    expect(screen.getByTestId('decode-plugin-name')).toHaveTextContent('ALP Sensor Protocol');
  });

  it('draws the default frame in the byte viewer', async () => {
    await renderReady(READY_ID);
    expect(screen.getByTestId('byte-viewer')).toHaveTextContent('AA 05 10 03 34 12 7F 4F 55');
    expect(screen.getByTestId('decode-example-description')).toBeInTheDocument();
  });

  it('replaces the hex input when another example is picked', async () => {
    await renderReady(READY_ID);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'bad-start' } });
    expect(hexInput()).toHaveValue('BB 05 10 03 34 12 7F 4F 55');
  });

  it('states that the plugin ships no example frames instead of drawing an empty select', async () => {
    await renderReady(NO_EXAMPLES_ID);
    expect(screen.getByTestId('decode-examples-empty')).toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });
});

describe('DecodePanel successful decoding', () => {
  it('lists every parsed field with its offset and length', async () => {
    await renderReady(READY_ID);
    const rows = screen.getAllByTestId('decode-field-row');
    expect(rows).toHaveLength(5);
    expect(within(fieldRow('address')).getByTestId('decode-field-select')).toHaveTextContent(
      'Device Address',
    );
    // Payload spec §9.6'da 4. bayttan başlar ve uzunluğu `payloadLength`ten gelir.
    expect(cellText(fieldRow('payload'), 1)).toBe('4');
    expect(cellText(fieldRow('payload'), 2)).toBe('3');
  });

  it('shows the raw value as hex and decimal together', async () => {
    await renderReady(READY_ID);
    expect(within(fieldRow('address')).getByTestId('decode-field-raw')).toHaveTextContent(
      '0x5 (5)',
    );
    expect(within(fieldRow('checksum')).getByTestId('decode-field-raw')).toHaveTextContent(
      '0x4F (79)',
    );
  });

  it('shows the physical value resolved by the engine', async () => {
    await renderReady(READY_ID);
    expect(within(fieldRow('command')).getByTestId('decode-field-physical')).toHaveTextContent(
      'Sensor Data',
    );
    expect(fieldRow('checksum').dataset['valid']).toBe('true');
  });

  it('draws one byte-viewer region per parsed field', async () => {
    await renderReady(READY_ID);
    for (const fieldId of ['address', 'command', 'payloadLength', 'payload', 'checksum']) {
      expect(regionButton(fieldId)).toBeInTheDocument();
    }
  });
});

describe('DecodePanel field warnings and frame errors', () => {
  it('lists the field warning and the frame error of a bad checksum', async () => {
    await renderReady(READY_ID);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'bad-checksum' } });

    const warnings = screen.getAllByTestId('decode-field-warning');
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings[0]).toHaveTextContent('0x4F');
    expect(fieldRow('checksum').dataset['valid']).toBe('false');

    const frameErrors = screen.getAllByTestId('decode-frame-error');
    expect(frameErrors[0]?.dataset['errorCode']).toBe('checksum-mismatch');
    // Geçersiz alan görüntüleyicide de işaretli: renk tek sinyal değil.
    expect(regionButton('checksum').dataset['invalid']).toBe('true');
  });
});

describe('DecodePanel failure paths', () => {
  it('rejects invalid hexadecimal input without touching the parser', async () => {
    await renderReady(READY_ID);
    fireEvent.change(hexInput(), { target: { value: 'AA 0' } });

    expect(screen.getByTestId('decode-hex-error')).toBeInTheDocument();
    expect(hexInput()).toHaveAttribute('aria-invalid', 'true');
    expect(screen.queryByTestId('decode-field-table')).not.toBeInTheDocument();
    expect(screen.getByTestId('byte-viewer-empty')).toBeInTheDocument();
  });

  it('shows the parse error code and still draws the raw bytes', async () => {
    await renderReady(READY_ID);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'bad-start' } });

    const card = screen.getByTestId('decode-parse-error');
    expect(card.dataset['errorCode']).toBe(
      BAD_START_RESULT.success ? undefined : BAD_START_RESULT.error.code,
    );
    expect(card.dataset['recoverable']).toBe(
      BAD_START_RESULT.success ? undefined : String(BAD_START_RESULT.recoverable),
    );
    // Hatalı çerçeve de görünür: kullanıcı neyin bozuk olduğunu görmeli.
    expect(screen.getByTestId('byte-viewer')).toHaveTextContent('BB 05 10');
    expect(screen.queryByTestId('decode-field-table')).not.toBeInTheDocument();
  });

  it('announces an encoder-only plugin instead of rendering an empty card', async () => {
    await renderReady(ENCODER_ONLY_ID);
    expect(screen.getByTestId('decode-no-parser')).toBeInTheDocument();
    expect(screen.queryByTestId('decode-field-table')).not.toBeInTheDocument();
    // Baytlar yine çizilir; panel boş kalmaz.
    expect(screen.getByTestId('byte-viewer')).toHaveTextContent('AA 05 10');
  });

  it('contains a throwing parser instead of taking the page down', async () => {
    await renderReady(CRASHING_ID);
    expect(screen.getByTestId('decode-parser-crashed')).toHaveTextContent(PARSER_CRASH_MESSAGE);
    expect(screen.getByTestId('byte-viewer')).toHaveTextContent('AA 05 10');
  });
});

describe('DecodePanel selection', () => {
  it('highlights the matching field row when a region is picked', async () => {
    await renderReady(READY_ID);
    fireEvent.click(regionButton('command'));

    expect(fieldRow('command').dataset['selected']).toBe('true');
    expect(fieldRow('address').dataset['selected']).toBe('false');
    expect(regionButton('command')).toHaveAttribute('aria-pressed', 'true');
  });

  it('highlights the matching region when a field row is picked', async () => {
    await renderReady(READY_ID);
    fireEvent.click(within(fieldRow('payload')).getByTestId('decode-field-select'));

    expect(regionButton('payload').dataset['selected']).toBe('true');
    expect(fieldRow('payload').dataset['selected']).toBe('true');
  });

  it('clears the selection when the same region is picked twice', async () => {
    await renderReady(READY_ID);
    fireEvent.click(regionButton('address'));
    fireEvent.click(regionButton('address'));

    expect(fieldRow('address').dataset['selected']).toBe('false');
    expect(regionButton('address').dataset['selected']).toBe('false');
  });

  it('drops the selection when the frame changes', async () => {
    await renderReady(READY_ID);
    fireEvent.click(regionButton('address'));
    expect(fieldRow('address').dataset['selected']).toBe('true');

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'bad-checksum' } });
    expect(fieldRow('address').dataset['selected']).toBe('false');
  });
});
