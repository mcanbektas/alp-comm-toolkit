import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { RenderResult } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LanguageProvider } from '@/app/providers/LanguageProvider';
import { parseWithSchema } from '@/protocol-core';
import { isParseSuccess } from '@/protocol-core/types';
import type { ParseResult, ParsedField, ParsedFrame, SchemaIssue } from '@/protocol-core';
import type { ProtocolSchema } from '@/protocol-core/schemas/protocolSchema';
import { SPEC_SENSOR_FRAME, SPEC_SENSOR_PROTOCOL } from '@/protocol-core/schemas/specFixture';
import { validateProtocolSchema } from '@/protocol-core/validation/schemaValidation';
import {
  generateCParser,
  generateCStruct,
  generateJsonSchemaOutput,
  generateMarkdownDoc,
  generatePythonParser,
  generateTypeScriptParser,
} from '@/protocol-core/codegen';
import type { GeneratedArtifact, GeneratedArtifactId } from '@/protocol-core/codegen';
import { downloadTextFile } from '@/utils/downloadTextFile';
import { createEmptyDraft, draftToSchema } from '../schemaDraft';
import type { DraftIssue } from '../schemaDraft';

import { OutputPanel, describeFieldComputation } from './OutputPanel';
import type { OutputPanelProps, OutputTabId } from './OutputPanel';

/**
 * İndirme sahtelenir: gerçek `downloadTextFile` jsdom'da `URL.createObjectURL`
 * bulamayıp FIRLATIR (bilerek — bkz. o dosyanın yorumu), yani sahtelemeden
 * "indir" düğmesine basan her test patlardı.
 */
vi.mock('@/utils/downloadTextFile', () => ({
  downloadTextFile: vi.fn(),
}));

// --- Gerçek veri ---------------------------------------------------------
//
// Hiçbir `ParsedFrame` elle yazılmadı: çözümleme çıktısı da üretilen kod da
// gerçek motorlardan geliyor. El yazımı fixture, panelin gösterdiği hex/ondalık
// çiftini ve hesap adımlarını taklit edemez.

function frameOf(result: ParseResult): ParsedFrame {
  if (!isParseSuccess(result)) {
    throw new Error(`Fixture ayrıştırılamadı: ${result.error.message}`);
  }
  return result.frame;
}

function fieldOf(frame: ParsedFrame, id: string): ParsedField {
  const field = frame.fields.find((candidate) => candidate.id === id);
  if (field === undefined) {
    throw new Error(`Fixture'da böyle bir alan yok: ${id}`);
  }
  return field;
}

const SPEC_RESULT: ParseResult = parseWithSchema(SPEC_SENSOR_PROTOCOL, SPEC_SENSOR_FRAME);
const SPEC_FRAME = frameOf(SPEC_RESULT);

/** Checksum baytı bozuldu: çerçeve yine çözülür, tek alan geçersiz işaretlenir. */
const CORRUPTED_BYTES = ((): Uint8Array => {
  const bytes = Uint8Array.from(SPEC_SENSOR_FRAME);
  bytes[7] = 0x00;
  return bytes;
})();
const CORRUPTED_RESULT: ParseResult = parseWithSchema(SPEC_SENSOR_PROTOCOL, CORRUPTED_BYTES);

/** Başlangıç baytı yok → kurtarılabilir başarısızlık (akış kaydırılıp denenir). */
const NO_START_RESULT: ParseResult = parseWithSchema(
  SPEC_SENSOR_PROTOCOL,
  Uint8Array.from([0x01, 0x02]),
);

/** Azami uzunluk aşımı → `recoverable: false`, akış bu protokol için terk edilir. */
const TOO_LONG_RESULT: ParseResult = parseWithSchema(SPEC_SENSOR_PROTOCOL, new Uint8Array(300));

/**
 * Spec fixture'ında ölçek, birim ve işaretli alan yok; birim sütunu ile
 * `rawValue × scale + calibrationOffset` satırı için ikinci bir GERÇEK şema.
 */
const SCALED_PROTOCOL: ProtocolSchema = {
  name: 'Scaled Sensor',
  version: '2.0',
  framing: { type: 'none', maximumFrameLength: 64 },
  fields: [
    {
      id: 'temperature',
      name: 'Temperature',
      type: 'int16',
      offset: 0,
      length: 2,
      scale: 0.5,
      unit: '°C',
    },
    { id: 'trim', name: 'Trim', type: 'int8', offset: 2, length: 1 },
    { id: 'tail', name: 'Tail', type: 'rawBytes', offset: 3, length: 2, unit: 'raw' },
  ],
};
const SCALED_RESULT: ParseResult = parseWithSchema(
  SCALED_PROTOCOL,
  Uint8Array.from([0x01, 0x2d, 0xff, 0xde, 0xad]),
);
const SCALED_FRAME = frameOf(SCALED_RESULT);

/** payloadLength = 0 → payload alanı SIFIR bayt; hesap adımı nötr işaret basmalı. */
const EMPTY_PAYLOAD_FRAME = frameOf(
  parseWithSchema(SPEC_SENSOR_PROTOCOL, Uint8Array.from([0xaa, 0x05, 0x10, 0x00, 0x15, 0x55])),
);

/** Aynı kimlik iki kez (hata) + tipin doğal uzunluğuyla çelişen length (uyarı). */
const MIXED_ISSUE_PROTOCOL: ProtocolSchema = {
  name: 'Mixed',
  version: '1',
  framing: { type: 'none', maximumFrameLength: 16 },
  fields: [
    { id: 'a', name: 'A', type: 'uint16', offset: 0, length: 4 },
    { id: 'a', name: 'A again', type: 'uint8', offset: 8, length: 1 },
  ],
};
const MIXED_SCHEMA_ISSUES: readonly SchemaIssue[] =
  validateProtocolSchema(MIXED_ISSUE_PROTOCOL).issues;

const EMPTY_DRAFT_ISSUES: readonly DraftIssue[] = draftToSchema(createEmptyDraft()).issues;

const ARTIFACTS: readonly GeneratedArtifact[] = [
  generateJsonSchemaOutput(SPEC_SENSOR_PROTOCOL),
  generateCStruct(SPEC_SENSOR_PROTOCOL),
  generateCParser(SPEC_SENSOR_PROTOCOL),
  generatePythonParser(SPEC_SENSOR_PROTOCOL),
  generateTypeScriptParser(SPEC_SENSOR_PROTOCOL),
  generateMarkdownDoc(SPEC_SENSOR_PROTOCOL),
];

const ARTIFACT_ORDER: readonly GeneratedArtifactId[] = [
  'json-schema',
  'c-struct',
  'c-parser',
  'python-parser',
  'typescript-parser',
  'markdown-doc',
];

function artifactOf(id: GeneratedArtifactId): GeneratedArtifact {
  const artifact = ARTIFACTS.find((candidate) => candidate.id === id);
  if (artifact === undefined) {
    throw new Error(`Üretilmemiş artefakt: ${id}`);
  }
  return artifact;
}

// --- Yardımcılar ---------------------------------------------------------

function propsWith(overrides: Partial<OutputPanelProps> = {}): OutputPanelProps {
  return {
    parseResult: SPEC_RESULT,
    draftIssues: [],
    schemaIssues: [],
    artifacts: ARTIFACTS,
    schemaName: SPEC_SENSOR_PROTOCOL.name,
    ...overrides,
  };
}

function renderPanel(overrides: Partial<OutputPanelProps> = {}): RenderResult {
  return render(
    <LanguageProvider>
      <OutputPanel {...propsWith(overrides)} />
    </LanguageProvider>,
  );
}

function tabIds(): readonly string[] {
  return screen.getAllByRole('tab').map((node) => node.getAttribute('data-tab-id') ?? '');
}

function tabButton(id: OutputTabId): HTMLElement {
  const tab = screen
    .getAllByRole('tab')
    .find((node) => node.getAttribute('data-tab-id') === id);
  if (tab === undefined) {
    throw new Error(`Sekme bulunamadı: ${id}`);
  }
  return tab;
}

function activeTabId(): string {
  return screen.getByTestId('output-tabpanel').getAttribute('data-tab-id') ?? '';
}

function pressOnTablist(key: string): void {
  fireEvent.keyDown(screen.getByRole('tablist'), { key });
}

function rowOf(fieldId: string): HTMLElement {
  const row = screen
    .getAllByTestId('output-field-row')
    .find((node) => node.getAttribute('data-field-id') === fieldId);
  if (row === undefined) {
    throw new Error(`Alan satırı yok: ${fieldId}`);
  }
  return row;
}

function renderedStepsOf(fieldId: string): readonly string[] {
  const block = screen
    .getAllByTestId('output-field-computation')
    .find((node) => node.getAttribute('data-field-id') === fieldId);
  if (block === undefined) {
    throw new Error(`Hesap bloğu yok: ${fieldId}`);
  }
  return within(block)
    .getAllByTestId('output-computation-step')
    .map((node) => node.textContent ?? '');
}

/**
 * `CopyButton` kendi test kimliğini taşımıyor (ortak bileşen). Metne bakmamak
 * için indirme düğmesinin kardeşi olarak, yapıdan bulunuyor.
 */
function artifactCopyButton(): HTMLButtonElement {
  const row = screen.getByTestId('output-artifact-download').parentElement;
  if (row === null) {
    throw new Error('Artefakt eylem satırı bulunamadı');
  }
  const first = row.querySelectorAll('button')[0];
  if (!(first instanceof HTMLButtonElement)) {
    throw new Error('Kopyala düğmesi bulunamadı');
  }
  return first;
}

const writeText = vi.fn<(text: string) => Promise<void>>(() => Promise.resolve());

beforeEach(() => {
  vi.clearAllMocks();
  // jsdom'da `navigator.clipboard` yok; tanımlı olsaydı da salt okunur olurdu.
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText },
    configurable: true,
  });
});

describe('OutputPanel — sekme şeridi', () => {
  it('exposes two fixed tabs plus one tab per generated artifact', () => {
    renderPanel();

    expect(screen.getByRole('tablist')).toBeInTheDocument();
    expect(screen.getAllByRole('tab')).toHaveLength(8);
    expect(tabIds()).toEqual(['parsed', 'validation', ...ARTIFACT_ORDER]);
  });

  it('starts on the parsed tab and links panel to tab by id', () => {
    renderPanel();

    const panel = screen.getByTestId('output-tabpanel');

    expect(tabButton('parsed')).toHaveAttribute('aria-selected', 'true');
    expect(panel).toHaveAttribute('aria-labelledby', 'output-tab-parsed');
    expect(tabButton('parsed')).toHaveAttribute('aria-controls', 'output-panel-parsed');
  });

  it('keeps a single tab stop: only the selected tab has tabindex 0', () => {
    renderPanel();

    const tabs = screen.getAllByRole('tab');

    expect(tabs.filter((node) => node.getAttribute('tabindex') === '0')).toHaveLength(1);
    expect(tabButton('parsed')).toHaveAttribute('tabindex', '0');
    expect(tabButton('c-parser')).toHaveAttribute('tabindex', '-1');
  });

  it('moves selection and focus to the next tab on ArrowRight', () => {
    renderPanel();

    pressOnTablist('ArrowRight');

    expect(activeTabId()).toBe('validation');
    expect(tabButton('validation')).toHaveAttribute('aria-selected', 'true');
    expect(tabButton('validation')).toHaveAttribute('tabindex', '0');
    expect(document.activeElement).toBe(tabButton('validation'));
  });

  it('wraps from the first tab to the last on ArrowLeft', () => {
    renderPanel();

    pressOnTablist('ArrowLeft');

    expect(activeTabId()).toBe('markdown-doc');
    expect(document.activeElement).toBe(tabButton('markdown-doc'));
  });

  it('walks back with ArrowLeft after ArrowRight without skipping a tab', () => {
    renderPanel();

    pressOnTablist('ArrowRight');
    pressOnTablist('ArrowRight');
    expect(activeTabId()).toBe('json-schema');

    pressOnTablist('ArrowLeft');

    expect(activeTabId()).toBe('validation');
  });

  it('jumps to the ends with Home and End', () => {
    renderPanel();

    pressOnTablist('End');
    expect(activeTabId()).toBe('markdown-doc');

    pressOnTablist('Home');
    expect(activeTabId()).toBe('parsed');
  });

  it('ignores keys that are not tab navigation', () => {
    renderPanel();

    pressOnTablist('a');

    expect(activeTabId()).toBe('parsed');
  });

  it('switches panels on click', () => {
    renderPanel();

    fireEvent.click(tabButton('python-parser'));

    expect(activeTabId()).toBe('python-parser');
    expect(screen.getByTestId('output-artifact-code')).toHaveAttribute(
      'data-artifact-id',
      'python-parser',
    );
    expect(screen.queryByTestId('output-summary')).toBeNull();
  });

  it('falls back to the parsed tab when the selected artifact tab disappears', () => {
    const { rerender } = renderPanel();
    fireEvent.click(tabButton('c-struct'));
    expect(activeTabId()).toBe('c-struct');

    rerender(
      <LanguageProvider>
        <OutputPanel {...propsWith({ artifacts: [] })} />
      </LanguageProvider>,
    );

    expect(activeTabId()).toBe('parsed');
    expect(screen.getAllByRole('tab')).toHaveLength(2);
    expect(screen.getByTestId('output-summary')).toBeInTheDocument();
  });
});

describe('OutputPanel — Çözümleme sekmesi', () => {
  it('renders one row per parsed field, in frame order', () => {
    renderPanel();

    const ids = screen
      .getAllByTestId('output-field-row')
      .map((node) => node.getAttribute('data-field-id'));

    expect(ids).toEqual(['address', 'command', 'payloadLength', 'payload', 'checksum']);
    expect(ids).toHaveLength(SPEC_FRAME.fields.length);
  });

  it('prints the raw value as hexadecimal and decimal together', () => {
    renderPanel();

    // address = 5 (number), checksum = 0x4F (bigint) — iki farklı sayı tipi.
    expect(within(rowOf('address')).getByTestId('output-field-raw')).toHaveTextContent('0x5 (5)');
    expect(within(rowOf('checksum')).getByTestId('output-field-raw')).toHaveTextContent(
      '0x4F (79)',
    );
  });

  it('shows the physical value and falls back to a neutral glyph without one', () => {
    renderPanel();

    expect(within(rowOf('command')).getByTestId('output-field-physical')).toHaveTextContent(
      'Sensor Data',
    );
    // rawBytes alanının fiziksel değeri yoktur.
    expect(within(rowOf('payload')).getByTestId('output-field-physical').textContent).toBe('—');
    expect(within(rowOf('payload')).getByTestId('output-field-raw').textContent).toBe('—');
  });

  it('prints the unit of a scaled field and leaves unitless fields neutral', () => {
    renderPanel({ parseResult: SCALED_RESULT, schemaName: SCALED_PROTOCOL.name });

    const temperature = rowOf('temperature');

    expect(within(temperature).getByTestId('output-field-raw')).toHaveTextContent('0x12D (301)');
    expect(within(temperature).getByTestId('output-field-physical').textContent).toBe('150.5');
    expect(temperature.children[4]?.textContent).toBe('°C');
    expect(rowOf('trim').children[4]?.textContent).toBe('—');
  });

  it('summarises schema name, status, field count and consumed bytes', () => {
    renderPanel();

    const summary = screen.getByTestId('output-summary');

    expect(summary).toHaveTextContent('ALP Sensor Protocol');
    expect(screen.getByTestId('output-frame-status')).toHaveAttribute('data-valid', 'true');
    expect(summary).toHaveTextContent('5');
    expect(summary).toHaveTextContent('9');
  });

  it('shows a collapsed <details> with the computation steps of every field', () => {
    renderPanel();

    const blocks = screen.getAllByTestId('output-field-computation');

    expect(blocks).toHaveLength(SPEC_FRAME.fields.length);
    expect(blocks[0]?.tagName).toBe('DETAILS');
    expect(blocks[0]).not.toHaveAttribute('open');
    expect(renderedStepsOf('address')).toEqual([
      'rawBytes[1] = 05',
      'rawValue = 0x5 = 5',
      'physicalValue = rawValue = 5',
    ]);
    expect(renderedStepsOf('command')).toContain('physicalValue = "Sensor Data"');
  });

  it('marks the invalid field, its warning and the frame errors on a corrupted frame', () => {
    renderPanel({ parseResult: CORRUPTED_RESULT });

    const validity = within(rowOf('checksum')).getByTestId('output-field-validity');

    expect(validity).toHaveAttribute('data-valid', 'false');
    expect(validity.className).toContain('text-danger');
    expect(within(rowOf('address')).getByTestId('output-field-validity')).toHaveAttribute(
      'data-valid',
      'true',
    );
    expect(screen.getByTestId('output-frame-status')).toHaveAttribute('data-valid', 'false');
    expect(screen.getAllByTestId('output-frame-error')).toHaveLength(1);
    expect(screen.getAllByTestId('output-frame-warning')).toHaveLength(1);
    expect(screen.getByTestId('output-field-warning')).toBeInTheDocument();
  });

  it('hides the error and warning sections on a clean frame', () => {
    renderPanel();

    expect(screen.queryByTestId('output-frame-error')).toBeNull();
    expect(screen.queryByTestId('output-frame-warning')).toBeNull();
    expect(screen.queryByTestId('output-field-warning')).toBeNull();
  });
});

describe('OutputPanel — çözümleme başarısızlığı ve boş durum', () => {
  it('announces a recoverable parse failure with its translated code and offset', () => {
    renderPanel({ parseResult: NO_START_RESULT });

    const alert = screen.getByRole('alert');

    expect(alert).toHaveAttribute('data-testid', 'output-parse-error');
    expect(alert).toHaveAttribute('data-error-code', 'start-delimiter-not-found');
    expect(alert).toHaveAttribute('data-recoverable', 'true');
    expect(alert).toHaveTextContent('Başlangıç baytı bulunamadı');
    expect(screen.queryByTestId('output-field-row')).toBeNull();
    expect(screen.queryByTestId('output-summary')).toBeNull();
  });

  it('distinguishes an unrecoverable failure', () => {
    renderPanel({ parseResult: TOO_LONG_RESULT });

    const alert = screen.getByRole('alert');

    expect(alert).toHaveAttribute('data-error-code', 'frame-too-long');
    expect(alert).toHaveAttribute('data-recoverable', 'false');
    // Kurtarılamayan başarısızlık uyarı değil hata tonuyla yazılır.
    expect(alert.querySelector('.text-xs.text-danger')).not.toBeNull();
    expect(alert.querySelector('.text-xs.text-warn')).toBeNull();
  });

  it('shows the empty placeholder when there is nothing to parse', () => {
    renderPanel({ parseResult: null });

    expect(screen.getByTestId('output-parsed-empty')).toBeInTheDocument();
    expect(screen.queryByTestId('output-field-row')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('OutputPanel — Doğrulama sekmesi', () => {
  function openValidation(overrides: Partial<OutputPanelProps> = {}): void {
    renderPanel(overrides);
    fireEvent.click(tabButton('validation'));
  }

  it('lists draft issues as errors carrying their field path', () => {
    openValidation({ draftIssues: EMPTY_DRAFT_ISSUES });

    const issues = screen.getAllByTestId('output-issue');

    expect(issues).toHaveLength(EMPTY_DRAFT_ISSUES.length);
    expect(issues[0]).toHaveAttribute('data-source', 'draft');
    expect(issues[0]).toHaveAttribute('data-severity', 'error');
    expect(issues[0]?.querySelector('span.text-danger')).not.toBeNull();
    expect(issues[0]).toHaveTextContent('name');
  });

  it('separates schema error and warning severities by token colour', () => {
    openValidation({ schemaIssues: MIXED_SCHEMA_ISSUES });

    const issues = screen.getAllByTestId('output-issue');

    expect(issues).toHaveLength(2);
    expect(issues[0]).toHaveAttribute('data-severity', 'error');
    expect(issues[0]?.querySelector('span.text-danger')).not.toBeNull();
    expect(issues[1]).toHaveAttribute('data-severity', 'warning');
    expect(issues[1]?.querySelector('span.text-warn')).not.toBeNull();
    expect(issues[1]?.querySelector('span.text-danger')).toBeNull();
  });

  it('shows draft and schema issues together, drafts first', () => {
    openValidation({ draftIssues: EMPTY_DRAFT_ISSUES, schemaIssues: MIXED_SCHEMA_ISSUES });

    const sources = screen
      .getAllByTestId('output-issue')
      .map((node) => node.getAttribute('data-source'));

    expect(sources).toEqual(['draft', 'draft', 'schema', 'schema']);
  });

  it('shows the empty state when nothing is wrong', () => {
    openValidation();

    expect(screen.getByTestId('output-validation-empty')).toBeInTheDocument();
    expect(screen.queryByTestId('output-issue')).toBeNull();
  });
});

describe('OutputPanel — artefakt sekmeleri', () => {
  function openArtifact(id: GeneratedArtifactId): GeneratedArtifact {
    renderPanel();
    fireEvent.click(tabButton(id));
    return artifactOf(id);
  }

  it('prints the generated code verbatim inside a horizontally scrollable <pre>', () => {
    const artifact = openArtifact('c-parser');

    const pre = screen.getByTestId('output-artifact-code');

    expect(pre.tagName).toBe('PRE');
    expect(pre.textContent).toBe(artifact.code);
    expect(pre.className).toContain('overflow-x-auto');
    expect(pre).toHaveAttribute('data-artifact-id', 'c-parser');
    expect(screen.getByTestId('output-artifact-file')).toHaveTextContent(artifact.fileName);
  });

  it('renders each artifact with its own file name and body', () => {
    renderPanel();

    for (const id of ARTIFACT_ORDER) {
      fireEvent.click(tabButton(id));
      const artifact = artifactOf(id);
      expect(screen.getByTestId('output-artifact-code').textContent).toBe(artifact.code);
      expect(screen.getByTestId('output-artifact-file').textContent).toBe(artifact.fileName);
    }
  });

  it('copies exactly the artifact code to the clipboard', async () => {
    const artifact = openArtifact('markdown-doc');

    fireEvent.click(artifactCopyButton());

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledTimes(1);
    });
    expect(writeText).toHaveBeenCalledWith(artifact.code);
  });

  it('downloads the artifact with its own file name and code', () => {
    const artifact = openArtifact('json-schema');

    fireEvent.click(screen.getByTestId('output-artifact-download'));

    expect(vi.mocked(downloadTextFile)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(downloadTextFile)).toHaveBeenCalledWith(artifact.fileName, artifact.code);
  });

  it('does not download while merely switching tabs', () => {
    openArtifact('typescript-parser');

    expect(vi.mocked(downloadTextFile)).not.toHaveBeenCalled();
  });

  it('warns when no artifact could be generated and keeps the fixed tabs usable', () => {
    renderPanel({ artifacts: [], schemaIssues: MIXED_SCHEMA_ISSUES });

    const warning = screen.getByTestId('output-artifacts-missing');

    expect(warning).toHaveAttribute('role', 'status');
    expect(warning.className).toContain('bg-warn-soft');
    expect(screen.queryByTestId('output-artifact-code')).toBeNull();
    expect(tabIds()).toEqual(['parsed', 'validation']);
  });

  it('hides the warning as soon as artifacts exist', () => {
    renderPanel();

    expect(screen.queryByTestId('output-artifacts-missing')).toBeNull();
  });
});

describe('describeFieldComputation', () => {
  it('opens with the raw byte range of a single-byte field', () => {
    expect(describeFieldComputation(fieldOf(SPEC_FRAME, 'address'))[0]).toBe('rawBytes[1] = 05');
  });

  it('writes an inclusive range for a multi-byte field', () => {
    expect(describeFieldComputation(fieldOf(SPEC_FRAME, 'payload'))[0]).toBe(
      'rawBytes[4…6] = 34 12 7F',
    );
  });

  it('marks a zero-length field with the neutral glyph instead of an empty list', () => {
    const steps = describeFieldComputation(fieldOf(EMPTY_PAYLOAD_FRAME, 'payload'));

    expect(steps).toEqual(['rawBytes[4] = —']);
  });

  it('shows a numeric raw value as hexadecimal and decimal', () => {
    expect(describeFieldComputation(fieldOf(SPEC_FRAME, 'payloadLength'))).toEqual([
      'rawBytes[3] = 03',
      'rawValue = 0x3 = 3',
      'physicalValue = rawValue = 3',
    ]);
  });

  it('handles a bigint raw value the same way as a number', () => {
    // Checksum alanı `bigint` taşır; `number` ile karışık gelmesi normaldir.
    expect(describeFieldComputation(fieldOf(SPEC_FRAME, 'checksum'))).toEqual([
      'rawBytes[7] = 4F',
      'rawValue = 0x4F = 79',
      'physicalValue = "valid"',
    ]);
  });

  it('quotes a string physical value and skips the formula for it', () => {
    const steps = describeFieldComputation(fieldOf(SPEC_FRAME, 'command'));

    expect(steps).toContain('physicalValue = "Sensor Data"');
    expect(steps.some((step) => step.includes('scale'))).toBe(false);
  });

  it('omits the ×scale +offset formula when the physical value equals the raw value', () => {
    const steps = describeFieldComputation(fieldOf(SPEC_FRAME, 'address'));

    expect(steps).toContain('physicalValue = rawValue = 5');
    expect(steps.some((step) => step.includes('calibrationOffset'))).toBe(false);
  });

  it('writes the formula and the unit when a scale is applied', () => {
    expect(describeFieldComputation(fieldOf(SCALED_FRAME, 'temperature'))).toEqual([
      'rawBytes[0…1] = 01 2D',
      'rawValue = 0x12D = 301',
      'physicalValue = rawValue × scale + calibrationOffset = 150.5 °C',
    ]);
  });

  it('reports sign extension before the raw value of a negative field', () => {
    const steps = describeFieldComputation(fieldOf(SCALED_FRAME, 'trim'));

    expect(steps).toEqual([
      'rawBytes[2] = FF',
      'signed = true',
      'rawValue = -0x1 = -1',
      'physicalValue = rawValue = -1',
    ]);
  });

  it('falls back to a unit line when a field has a unit but no physical value', () => {
    expect(describeFieldComputation(fieldOf(SCALED_FRAME, 'tail'))).toEqual([
      'rawBytes[3…4] = DE AD',
      'unit = "raw"',
    ]);
  });

  it('stays pure: the same field always yields the same steps', () => {
    const field = fieldOf(SPEC_FRAME, 'command');

    expect(describeFieldComputation(field)).toEqual(describeFieldComputation(field));
  });
});
