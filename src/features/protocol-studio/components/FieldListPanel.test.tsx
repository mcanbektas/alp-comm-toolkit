import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LANGUAGE_STORAGE_KEY, LanguageProvider } from '@/app/providers/LanguageProvider';
import { SPEC_SENSOR_PROTOCOL } from '@/protocol-core/schemas/specFixture';

import { createEmptyDraft, createFieldDraft, schemaToDraft } from '../schemaDraft';
import type { DraftIssue, FieldDraft, SchemaDraft } from '../schemaDraft';
import { FieldListPanel } from './FieldListPanel';

/**
 * Seçiciler `data-testid` ve rol üzerinden kurulu, METİN ÜZERİNDEN DEĞİL:
 * panelin çeviri anahtarları sözlüğe henüz eklenmedi, `t()` bu yüzden boş
 * döner. Ada göre arayan bir test, anahtar eklendiği gün de kırılırdı.
 */

/** noUncheckedIndexedAccess altında indeksleme `undefined` döner; kaçak yerine patla. */
function fieldAt(fields: readonly FieldDraft[], index: number): FieldDraft {
  const field = fields[index];
  if (field === undefined) {
    throw new Error(`field ${String(index)} is missing from the fixture`);
  }
  return field;
}

function nodeAt(nodes: readonly HTMLElement[], index: number): HTMLElement {
  const node = nodes[index];
  if (node === undefined) {
    throw new Error(`node ${String(index)} was not rendered`);
  }
  return node;
}

/** ReorderableList'in taşıma düğmeleri ok GLİFİ taşır; erişilebilir ad çeviriden gelir. */
function buttonOf(glyph: HTMLElement): HTMLElement {
  const button = glyph.closest('button');
  if (button === null) {
    throw new Error('the glyph is not inside a button');
  }
  return button;
}

function createHandlers() {
  return {
    onSelect: vi.fn(),
    onAdd: vi.fn(),
    onRemove: vi.fn(),
    onDuplicate: vi.fn(),
    onMove: vi.fn(),
  };
}

interface RenderOptions {
  readonly selectedDraftId?: string | null;
  readonly issuesByDraftId?: ReadonlyMap<string, readonly DraftIssue[]>;
}

function renderPanel(
  draft: SchemaDraft,
  options: RenderOptions = {},
): ReturnType<typeof createHandlers> {
  const handlers = createHandlers();
  render(
    <LanguageProvider>
      <FieldListPanel
        draft={draft}
        selectedDraftId={options.selectedDraftId ?? null}
        issuesByDraftId={options.issuesByDraftId ?? new Map<string, readonly DraftIssue[]>()}
        onSelect={handlers.onSelect}
        onAdd={handlers.onAdd}
        onRemove={handlers.onRemove}
        onDuplicate={handlers.onDuplicate}
        onMove={handlers.onMove}
      />
    </LanguageProvider>,
  );
  return handlers;
}

/** Spec §9.6 şeması: beş kök alan, iç içe yapı yok. */
function specDraft(): SchemaDraft {
  return schemaToDraft(SPEC_SENSOR_PROTOCOL);
}

/**
 * Elle kurulmuş taslak: iç içe `structure`, koşullu alan ve iki tür tekrar
 * (sabit sayı + alandan gelen sayı) bir arada.
 */
function nestedDraft(): SchemaDraft {
  const draft = createEmptyDraft();
  draft.name = 'Nested Protocol';
  draft.version = '2.0';
  draft.framing = {
    type: 'lengthField',
    startBytes: ['0x7E'],
    endBytes: [],
    maximumFrameLength: '512',
  };

  const address = createFieldDraft('uint8');
  address.id = 'deviceAddress';
  address.name = 'Device Address';
  address.offset = '1';

  const block = createFieldDraft('structure');
  block.id = 'sensorBlock';
  block.name = 'Sensor Block';
  block.offset = '2';
  block.repeatCount = { mode: 'fixed', count: '4', fromField: '' };

  const temperature = createFieldDraft('int16');
  temperature.id = 'temperature';
  temperature.name = 'Temperature';
  temperature.offset = '0';

  const humidity = createFieldDraft('uint8');
  humidity.id = 'humidity';
  humidity.name = 'Humidity';
  humidity.offset = '2';
  humidity.condition = { field: 'deviceAddress', equals: '5' };

  const pressure = createFieldDraft('uint16');
  pressure.id = 'pressure';
  pressure.name = 'Pressure';
  pressure.offset = '3';

  block.fields = [temperature, humidity, pressure];

  const tail = createFieldDraft('rawBytes');
  tail.id = 'tail';
  tail.name = 'Tail';
  tail.length = '';
  tail.lengthFrom = 'payloadLength';
  tail.repeatCount = { mode: 'fromField', count: '', fromField: 'blockCount' };

  draft.fields = [address, block, tail];
  return draft;
}

function issue(draftId: string, field: string): DraftIssue {
  return { draftId, field, messageKey: 'studio.draft.fieldNameRequired' };
}

beforeEach(() => {
  // Dil provider'ı localStorage'dan okur; testin makinenin diline göre oynamaması için sabitle.
  window.localStorage.clear();
  window.localStorage.setItem(LANGUAGE_STORAGE_KEY, 'tr');
});

describe('FieldListPanel', () => {
  it('summarises the frame meta as read-only text', () => {
    const draft = specDraft();
    renderPanel(draft);

    expect(screen.getByTestId('studio-frame-name')).toHaveTextContent(draft.name);
    expect(screen.getByTestId('studio-frame-version')).toHaveTextContent(draft.version);
    expect(screen.getByTestId('studio-frame-startBytes')).toHaveTextContent(
      draft.framing.startBytes.join(' '),
    );
    expect(screen.getByTestId('studio-frame-endBytes')).toHaveTextContent(
      draft.framing.endBytes.join(' '),
    );
    // Özet salt okunur: içinde tek bir girdi alanı bulunmamalı.
    expect(within(screen.getByTestId('studio-frame-summary')).queryByRole('textbox')).toBeNull();
  });

  it('counts nested fields in the frame summary total', () => {
    // 3 kök alan + 3 iç alan = 6; yalnız kökleri sayan bir uygulama 3 yazardı.
    renderPanel(nestedDraft());

    expect(screen.getByTestId('studio-frame-fieldCount')).toHaveTextContent('6');
  });

  it('renders one row per root field with its name and type badge', () => {
    const draft = specDraft();
    renderPanel(draft);

    for (const field of draft.fields) {
      expect(screen.getByTestId(`field-name-${field.draftId}`)).toHaveTextContent(field.name);
      expect(screen.getByTestId(`field-type-${field.draftId}`)).toHaveTextContent(field.type);
    }
    expect(
      within(screen.getByTestId('studio-field-list-root')).getAllByRole('listitem'),
    ).toHaveLength(draft.fields.length);
  });

  it('nests the children of a composite field inside their parent row', () => {
    const draft = nestedDraft();
    const block = fieldAt(draft.fields, 1);
    const temperature = fieldAt(block.fields, 0);
    renderPanel(draft);

    const parentRow = screen.getByTestId(`field-row-${block.draftId}`);
    expect(
      within(parentRow).getByTestId(`field-row-${temperature.draftId}`),
    ).toBeInTheDocument();
    expect(within(parentRow).getByTestId(`field-children-${block.draftId}`)).toBeInTheDocument();
  });

  it('cycles the series colour of the leading dot by row order', () => {
    const draft = specDraft();
    renderPanel(draft);

    const dotClasses = draft.fields.map((field) =>
      within(screen.getByTestId(`field-select-${field.draftId}`)).getByText('●').className,
    );

    expect(dotClasses[0]).toContain('text-series-1');
    expect(dotClasses[1]).toContain('text-series-2');
    expect(dotClasses[2]).toContain('text-series-3');
    expect(dotClasses[3]).toContain('text-series-4');
    // Beşinci alan başa döner — dört renk döngüsel dağıtılır.
    expect(dotClasses[4]).toContain('text-series-1');
  });

  it('marks the selected row and leaves the others unpressed', () => {
    const draft = specDraft();
    const selected = fieldAt(draft.fields, 2);
    renderPanel(draft, { selectedDraftId: selected.draftId });

    const row = screen.getByTestId(`field-select-${selected.draftId}`);
    expect(row).toHaveAttribute('aria-pressed', 'true');
    expect(row).toHaveClass('ring-2', 'ring-accent');
    expect(screen.getByTestId(`field-select-${fieldAt(draft.fields, 0).draftId}`)).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('selects a row by its draft id when clicked', () => {
    const draft = specDraft();
    const target = fieldAt(draft.fields, 1);
    const handlers = renderPanel(draft);

    fireEvent.click(screen.getByTestId(`field-select-${target.draftId}`));

    expect(handlers.onSelect).toHaveBeenCalledTimes(1);
    expect(handlers.onSelect).toHaveBeenCalledWith(target.draftId);
  });

  it('clears the selection when the already selected row is clicked again', () => {
    const draft = specDraft();
    const target = fieldAt(draft.fields, 1);
    const handlers = renderPanel(draft, { selectedDraftId: target.draftId });

    fireEvent.click(screen.getByTestId(`field-select-${target.draftId}`));

    expect(handlers.onSelect).toHaveBeenCalledWith(null);
  });

  it('flags rows that carry issues and leaves the rest valid', () => {
    const draft = specDraft();
    const broken = fieldAt(draft.fields, 3);
    const healthy = fieldAt(draft.fields, 0);
    renderPanel(draft, {
      issuesByDraftId: new Map<string, readonly DraftIssue[]>([
        [broken.draftId, [issue(broken.draftId, 'fields.3.name')]],
      ]),
    });

    expect(screen.getByTestId(`field-select-${broken.draftId}`)).toHaveAttribute(
      'aria-invalid',
      'true',
    );
    expect(screen.getByTestId(`field-issue-${broken.draftId}`)).toBeInTheDocument();
    expect(screen.getByTestId(`field-name-${broken.draftId}`)).toHaveClass('text-danger');

    expect(screen.getByTestId(`field-select-${healthy.draftId}`)).toHaveAttribute(
      'aria-invalid',
      'false',
    );
    expect(screen.queryByTestId(`field-issue-${healthy.draftId}`)).toBeNull();
  });

  it('adds a root level field from the panel header button', () => {
    const handlers = renderPanel(specDraft());

    fireEvent.click(screen.getByTestId('studio-add-root-field'));

    expect(handlers.onAdd).toHaveBeenCalledTimes(1);
    expect(handlers.onAdd).toHaveBeenCalledWith(null);
  });

  it('adds a nested field from a composite row and offers no such button on a leaf', () => {
    const draft = nestedDraft();
    const block = fieldAt(draft.fields, 1);
    const address = fieldAt(draft.fields, 0);
    const handlers = renderPanel(draft);

    expect(screen.queryByTestId(`field-add-child-${address.draftId}`)).toBeNull();
    fireEvent.click(screen.getByTestId(`field-add-child-${block.draftId}`));

    expect(handlers.onAdd).toHaveBeenCalledWith(block.draftId);
  });

  it('duplicates and removes a row by its draft id', () => {
    const draft = specDraft();
    const target = fieldAt(draft.fields, 2);
    const handlers = renderPanel(draft);

    fireEvent.click(screen.getByTestId(`field-duplicate-${target.draftId}`));
    fireEvent.click(screen.getByTestId(`field-remove-${target.draftId}`));

    expect(handlers.onDuplicate).toHaveBeenCalledWith(target.draftId);
    expect(handlers.onRemove).toHaveBeenCalledWith(target.draftId);
    // Silme onay istemiyor: tek tık geri çağırımı doğrudan tetiklemeli.
    expect(handlers.onRemove).toHaveBeenCalledTimes(1);
  });

  it('reports a root level drag and drop with a null parent', () => {
    const draft = specDraft();
    const handlers = renderPanel(draft);
    const rows = within(screen.getByTestId('studio-field-list-root')).getAllByRole('listitem');

    fireEvent.dragStart(nodeAt(rows, 0));
    fireEvent.dragOver(nodeAt(rows, 2));
    fireEvent.drop(nodeAt(rows, 2));

    expect(handlers.onMove).toHaveBeenCalledTimes(1);
    expect(handlers.onMove).toHaveBeenCalledWith(null, 0, 2);
  });

  it('reports a nested move with the owning parent draft id', () => {
    const draft = nestedDraft();
    const block = fieldAt(draft.fields, 1);
    const handlers = renderPanel(draft);

    const childList = screen.getByTestId(`field-children-${block.draftId}`);
    // İç alanlar kendi listelerinde sıralanır; ilk çocuğun "aşağı" düğmesi 0 → 1 taşır.
    fireEvent.click(buttonOf(nodeAt(within(childList).getAllByText('↓'), 0)));

    expect(handlers.onMove).toHaveBeenCalledTimes(1);
    expect(handlers.onMove).toHaveBeenCalledWith(block.draftId, 0, 1);
  });

  it('shows a condition badge only on conditional fields', () => {
    const draft = nestedDraft();
    const block = fieldAt(draft.fields, 1);
    const humidity = fieldAt(block.fields, 1);
    const temperature = fieldAt(block.fields, 0);
    renderPanel(draft);

    const badge = screen.getByTestId(`field-condition-${humidity.draftId}`);
    expect(badge).toHaveTextContent('deviceAddress');
    expect(badge).toHaveTextContent('5');
    expect(screen.queryByTestId(`field-condition-${temperature.draftId}`)).toBeNull();
  });

  it('shows the repeat badge for both a fixed count and a count taken from a field', () => {
    const draft = nestedDraft();
    const address = fieldAt(draft.fields, 0);
    const block = fieldAt(draft.fields, 1);
    const tail = fieldAt(draft.fields, 2);
    renderPanel(draft);

    expect(screen.getByTestId(`field-repeat-${block.draftId}`)).toHaveTextContent('4');
    expect(screen.getByTestId(`field-repeat-${tail.draftId}`)).toHaveTextContent('blockCount');
    expect(screen.queryByTestId(`field-repeat-${address.draftId}`)).toBeNull();
  });

  it('shows the source field instead of a byte count when the length is indirect', () => {
    const draft = nestedDraft();
    const tail = fieldAt(draft.fields, 2);
    const address = fieldAt(draft.fields, 0);
    renderPanel(draft);

    expect(screen.getByTestId(`field-length-${tail.draftId}`)).toHaveTextContent('payloadLength');
    expect(screen.getByTestId(`field-offset-${address.draftId}`)).toHaveTextContent('1');
  });

  it('renders an empty state instead of a list when the draft has no fields', () => {
    renderPanel(createEmptyDraft());

    expect(screen.getByTestId('studio-field-list-empty')).toBeInTheDocument();
    expect(screen.queryByTestId('studio-field-list-root')).toBeNull();
    expect(screen.getByTestId('studio-frame-fieldCount')).toHaveTextContent('0');
  });

  it('renders an empty state inside a composite field that has no children yet', () => {
    const draft = createEmptyDraft();
    const empty = createFieldDraft('array');
    empty.name = 'Samples';
    draft.fields = [empty];
    renderPanel(draft);

    expect(screen.getByTestId(`field-children-empty-${empty.draftId}`)).toBeInTheDocument();
    expect(screen.queryByTestId(`field-children-${empty.draftId}`)).toBeNull();
    // İç alanı olmasa da ekleme düğmesi durmalı, yoksa yapı hiç doldurulamaz.
    expect(screen.getByTestId(`field-add-child-${empty.draftId}`)).toBeInTheDocument();
  });

  it('falls back to the field id when the name is blank', () => {
    const draft = createEmptyDraft();
    const unnamed = createFieldDraft('uint8');
    unnamed.id = 'crcLow';
    unnamed.name = '   ';
    draft.fields = [unnamed];
    renderPanel(draft);

    expect(screen.getByTestId(`field-name-${unnamed.draftId}`)).toHaveTextContent('crcLow');
  });
});
