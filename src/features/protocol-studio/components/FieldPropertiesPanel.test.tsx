import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LANGUAGE_STORAGE_KEY, LanguageProvider } from '@/app/providers/LanguageProvider';
import type { FieldType } from '@/protocol-core/schemas/fieldTypes';

import { createEnumEntryDraft, createFieldDraft, resetDraftIdCounter } from '../schemaDraft';
import type { DraftIssue, EnumEntryDraft, FieldDraft } from '../schemaDraft';
import { FieldPropertiesPanel } from './FieldPropertiesPanel';

/**
 * Seçiciler `data-testid`, rol ve ETİKET üzerinden kurulu; `t()` çıktısına
 * karşılaştırma yapılmıyor. Sözlük metni değişince testin kırılması yanlış
 * alarmdır — panelin sözleşmesi hangi girdinin GÖRÜNDÜĞÜ ve onChange'in ne
 * gönderdiğidir, cümlenin kendisi değil.
 *
 * Tek istisna: sorun listesinin yer tutucu doldurduğunu (`{value}` → gerçek
 * değer) doğrulayan test. Orada da tam cümle değil, YALNIZ parametre aranıyor.
 */

// --- Yardımcılar ---------------------------------------------------------

/** `noUncheckedIndexedAccess` altında indeksleme `undefined` döner; kaçak yerine patla. */
function entryAt(entries: readonly EnumEntryDraft[], index: number): EnumEntryDraft {
  const entry = entries[index];
  if (entry === undefined) {
    throw new Error(`enum entry ${String(index)} is missing from the fixture`);
  }
  return entry;
}

function createChangeSpy() {
  return vi.fn((_patch: Partial<FieldDraft>): void => undefined);
}

type ChangeSpy = ReturnType<typeof createChangeSpy>;

function patchAt(spy: ChangeSpy, index: number): Partial<FieldDraft> {
  const call = spy.mock.calls[index];
  if (call === undefined) {
    throw new Error(`onChange was not called ${String(index + 1)} time(s)`);
  }
  return call[0];
}

function enumPatch(patch: Partial<FieldDraft>): readonly EnumEntryDraft[] {
  const { enumValues } = patch;
  if (enumValues === undefined) {
    throw new Error('the patch carries no enumValues');
  }
  return enumValues;
}

interface Panel {
  readonly onChange: ChangeSpy;
  readonly rerender: (field: FieldDraft | null, issues?: readonly DraftIssue[]) => void;
}

function renderPanel(field: FieldDraft | null, issues: readonly DraftIssue[] = []): Panel {
  const onChange = createChangeSpy();
  const view = render(
    <LanguageProvider>
      <FieldPropertiesPanel field={field} issues={issues} onChange={onChange} />
    </LanguageProvider>,
  );
  return {
    onChange,
    rerender: (nextField, nextIssues = []) => {
      view.rerender(
        <LanguageProvider>
          <FieldPropertiesPanel field={nextField} issues={nextIssues} onChange={onChange} />
        </LanguageProvider>,
      );
    },
  };
}

function fieldOfType(type: FieldType): FieldDraft {
  const field = createFieldDraft(type);
  field.id = 'temperature';
  field.name = 'Temperature';
  field.offset = '3';
  return field;
}

/**
 * Tip seçimini gerçek akışıyla taklit eder: panel YAMA gönderir, üst katman
 * onu taslağa uygular, panel yeni taslakla yeniden çizilir. Yamayı atlayıp
 * doğrudan yeni bir taslak vermek, `length` tazelemesini de atlardı.
 */
function switchType(panel: Panel, field: FieldDraft, next: FieldType): FieldDraft {
  const callsBefore = panel.onChange.mock.calls.length;
  fireEvent.change(screen.getByTestId('field-props-type'), { target: { value: next } });
  const patch = patchAt(panel.onChange, callsBefore);
  const updated: FieldDraft = { ...field, ...patch, draftId: field.draftId };
  panel.rerender(updated);
  return updated;
}

function labelTextOf(controlId: string): string {
  const label = document.querySelector(`label[for="${controlId}"]`);
  if (label === null) {
    throw new Error(`no label is bound to ${controlId}`);
  }
  return label.textContent ?? '';
}

function issue(field: string, params?: Readonly<Record<string, string>>): DraftIssue {
  return params === undefined
    ? { draftId: 'fd-1', field, messageKey: 'studio.draft.integerInvalid' }
    : { draftId: 'fd-1', field, messageKey: 'studio.draft.integerInvalid', params };
}

beforeEach(() => {
  resetDraftIdCounter();
  // Dil provider'ı localStorage'dan okur; testin makinenin diline göre oynamaması için sabitle.
  window.localStorage.clear();
  window.localStorage.setItem(LANGUAGE_STORAGE_KEY, 'tr');
});

describe('FieldPropertiesPanel — empty state', () => {
  it('shows the empty notice and no controls when no field is selected', () => {
    renderPanel(null);

    expect(screen.getByTestId('field-properties-empty')).toBeInTheDocument();
    expect(screen.queryByTestId('field-props-group-identity')).toBeNull();
    expect(screen.queryAllByRole('textbox')).toHaveLength(0);
    expect(screen.queryAllByRole('combobox')).toHaveLength(0);
  });

  it('renders the identity values of the selected field', () => {
    const field = fieldOfType('uint16');
    field.description = 'Sensor reading';
    field.documentation = 'See spec section 9.1';
    renderPanel(field);

    expect(screen.queryByTestId('field-properties-empty')).toBeNull();
    expect(screen.getByTestId('field-props-id')).toHaveValue('temperature');
    expect(screen.getByTestId('field-props-name')).toHaveValue('Temperature');
    expect(screen.getByTestId('field-props-description')).toHaveValue('Sensor reading');
    expect(screen.getByTestId('field-props-documentation')).toHaveValue('See spec section 9.1');
  });
});

describe('FieldPropertiesPanel — type driven visibility', () => {
  it('drops the endianness control and opens the length inputs on uint8 → bitField', () => {
    const field = fieldOfType('uint8');
    const panel = renderPanel(field);

    // uint8: genişlik tipten gelir, endianness anlamlıdır.
    expect(screen.getByTestId('field-props-endianness')).toBeInTheDocument();
    expect(screen.getByTestId('field-props-length')).toHaveAttribute('readonly');
    expect(screen.queryByTestId('field-props-lengthFrom')).toBeNull();

    switchType(panel, field, 'bitField');

    // bitField bayt sınırı tanımaz: endianness anlamsız, uzunluk artık şemadan.
    expect(screen.queryByTestId('field-props-endianness')).toBeNull();
    expect(screen.getByTestId('field-props-length')).not.toHaveAttribute('readonly');
    expect(screen.getByTestId('field-props-lengthFrom')).toBeInTheDocument();
    // Bit girdileri ve işaret seçimi her iki tipte de durur.
    expect(screen.getByTestId('field-props-bitLength')).toBeInTheDocument();
    expect(screen.getByTestId('field-props-signed')).toBeInTheDocument();
  });

  it('replaces the bit and scaling inputs with the checksum group on bitField → checksum', () => {
    const field = fieldOfType('bitField');
    const panel = renderPanel(field);

    expect(screen.getByTestId('field-props-bitOffset')).toBeInTheDocument();
    expect(screen.getByTestId('field-props-group-scaling')).toBeInTheDocument();
    expect(screen.getByTestId('field-props-defaultValue')).toBeInTheDocument();
    expect(screen.queryByTestId('field-props-group-checksum')).toBeNull();
    expect(screen.queryByTestId('field-props-derived-note')).toBeNull();

    switchType(panel, field, 'checksum');

    expect(screen.queryByTestId('field-props-bitOffset')).toBeNull();
    expect(screen.queryByTestId('field-props-bitMask')).toBeNull();
    expect(screen.queryByTestId('field-props-group-scaling')).toBeNull();
    expect(screen.queryByTestId('field-props-signed')).toBeNull();
    // Değeri kodlayıcı hesaplar: varsayılan değer girdisi kalkar, not belirir.
    expect(screen.queryByTestId('field-props-defaultValue')).toBeNull();
    expect(screen.getByTestId('field-props-derived-note')).toBeInTheDocument();
    expect(screen.getByTestId('field-props-algorithm')).toBeInTheDocument();
    expect(screen.getByTestId('field-props-coverageStart')).toBeInTheDocument();
    expect(screen.getByTestId('field-props-coverageEnd')).toBeInTheDocument();
  });

  it('replaces the checksum group with the enum table on checksum → enum', () => {
    const field = fieldOfType('checksum');
    const panel = renderPanel(field);

    expect(screen.getByTestId('field-props-group-checksum')).toBeInTheDocument();
    expect(screen.queryByTestId('field-props-group-enum')).toBeNull();

    switchType(panel, field, 'enum');

    expect(screen.queryByTestId('field-props-group-checksum')).toBeNull();
    expect(screen.queryByTestId('field-props-algorithm')).toBeNull();
    expect(screen.queryByTestId('field-props-derived-note')).toBeNull();
    expect(screen.getByTestId('field-props-group-enum')).toBeInTheDocument();
    // Türetilmiş değildi artık: varsayılan değer geri gelir.
    expect(screen.getByTestId('field-props-defaultValue')).toBeInTheDocument();
  });

  it('replaces the enum table with the repeat controls on enum → array', () => {
    const field = fieldOfType('enum');
    const panel = renderPanel(field);

    expect(screen.getByTestId('field-props-group-enum')).toBeInTheDocument();
    expect(screen.queryByTestId('field-props-repeatMode')).toBeNull();

    switchType(panel, field, 'array');

    expect(screen.queryByTestId('field-props-group-enum')).toBeNull();
    expect(screen.queryByTestId('field-props-enum-add')).toBeNull();
    expect(screen.getByTestId('field-props-repeatMode')).toBeInTheDocument();
    // Koşul girdileri tipten bağımsızdır, tekrar kipiyle birlikte durur.
    expect(screen.getByTestId('field-props-conditionField')).toBeInTheDocument();
  });
});

describe('FieldPropertiesPanel — length', () => {
  it('shows the type width read-only and ignores edits when the type carries its own length', () => {
    const field = fieldOfType('uint16');
    // Taslakta saçma bir uzunluk dursa bile tipin genişliği gösterilmeli.
    field.length = '99';
    const panel = renderPanel(field);

    const length = screen.getByTestId('field-props-length');
    expect(length).toHaveValue('2');
    expect(length).toHaveAttribute('readonly');
    // Salt okunur kutunun yanında neden düzenlenemediğini söyleyen bir ipucu var.
    expect(length.parentElement?.querySelector('p')).not.toBeNull();

    fireEvent.change(length, { target: { value: '8' } });
    expect(panel.onChange).not.toHaveBeenCalled();
  });

  it('lets the length and its source field be edited when the type has no intrinsic width', () => {
    const field = fieldOfType('ascii');
    const panel = renderPanel(field);

    const length = screen.getByTestId('field-props-length');
    expect(length).not.toHaveAttribute('readonly');

    fireEvent.change(length, { target: { value: '12' } });
    fireEvent.change(screen.getByTestId('field-props-lengthFrom'), {
      target: { value: 'payloadLength' },
    });

    expect(patchAt(panel.onChange, 0)).toEqual({ length: '12' });
    expect(patchAt(panel.onChange, 1)).toEqual({ lengthFrom: 'payloadLength' });
  });

  it('refreshes the length text with the new width when the type has one', () => {
    const field = fieldOfType('uint8');
    const panel = renderPanel(field);

    fireEvent.change(screen.getByTestId('field-props-type'), { target: { value: 'uint32' } });

    expect(patchAt(panel.onChange, 0)).toEqual({ type: 'uint32', length: '4' });
  });

  it('keeps the typed length when the new type takes its width from the schema', () => {
    const field = fieldOfType('uint8');
    field.length = '9';
    const panel = renderPanel(field);

    fireEvent.change(screen.getByTestId('field-props-type'), { target: { value: 'ascii' } });

    expect(patchAt(panel.onChange, 0)).toEqual({ type: 'ascii', length: '9' });
  });

  it('ignores a type value that is not part of the catalogue', () => {
    const panel = renderPanel(fieldOfType('uint8'));

    fireEvent.change(screen.getByTestId('field-props-type'), { target: { value: 'not-a-type' } });

    expect(panel.onChange).not.toHaveBeenCalled();
  });
});

describe('FieldPropertiesPanel — enum table', () => {
  function enumField(): FieldDraft {
    const field = fieldOfType('enum');
    field.enumValues = [createEnumEntryDraft('1', 'Idle'), createEnumEntryDraft('2', 'Running')];
    return field;
  }

  it('shows an empty notice instead of rows while the table has no entries', () => {
    renderPanel(fieldOfType('enum'));

    expect(screen.getByTestId('field-props-enum-empty')).toBeInTheDocument();
    expect(screen.queryByTestId('field-props-enum-rows')).toBeNull();
    // Satır yokken bile ekleme düğmesi durmalı, yoksa tablo hiç doldurulamaz.
    expect(screen.getByTestId('field-props-enum-add')).toBeInTheDocument();
  });

  it('appends a blank entry and keeps the existing ones untouched', () => {
    const field = enumField();
    const panel = renderPanel(field);
    expect(within(screen.getByTestId('field-props-enum-rows')).getAllByRole('listitem')).toHaveLength(
      2,
    );

    fireEvent.click(screen.getByTestId('field-props-enum-add'));

    const next = enumPatch(patchAt(panel.onChange, 0));
    expect(next).toHaveLength(3);
    expect(next[0]).toEqual(entryAt(field.enumValues, 0));
    expect(next[1]).toEqual(entryAt(field.enumValues, 1));
    expect(entryAt(next, 2).key).toBe('');
    expect(entryAt(next, 2).label).toBe('');
    // Yeni satırın kimliği taze: React `key`'i eski satırlarla çakışmamalı.
    expect(entryAt(next, 2).entryId).not.toBe(entryAt(field.enumValues, 1).entryId);
  });

  it('removes exactly the clicked row', () => {
    const field = enumField();
    const panel = renderPanel(field);

    fireEvent.click(screen.getByTestId('field-props-enum-remove-0'));

    const next = enumPatch(patchAt(panel.onChange, 0));
    expect(next).toHaveLength(1);
    expect(next[0]).toEqual(entryAt(field.enumValues, 1));
  });

  it('edits the key of one row without disturbing its label or the other rows', () => {
    const field = enumField();
    const panel = renderPanel(field);

    fireEvent.change(screen.getByTestId('field-props-enum-key-1'), { target: { value: '0x10' } });

    const next = enumPatch(patchAt(panel.onChange, 0));
    expect(next[0]).toEqual(entryAt(field.enumValues, 0));
    expect(entryAt(next, 1)).toEqual({
      // `entryId` korunur: değişseydi girdi yeniden kurulur, odak kaybolurdu.
      entryId: entryAt(field.enumValues, 1).entryId,
      key: '0x10',
      label: 'Running',
    });
  });

  it('edits the label of one row without disturbing its key', () => {
    const field = enumField();
    const panel = renderPanel(field);

    fireEvent.change(screen.getByTestId('field-props-enum-label-0'), { target: { value: 'Halted' } });

    const next = enumPatch(patchAt(panel.onChange, 0));
    expect(entryAt(next, 0)).toEqual({
      entryId: entryAt(field.enumValues, 0).entryId,
      key: '1',
      label: 'Halted',
    });
    expect(next[1]).toEqual(entryAt(field.enumValues, 1));
  });
});

describe('FieldPropertiesPanel — patch shape', () => {
  it('reports a single edited key instead of the whole field', () => {
    const field = fieldOfType('uint8');
    const panel = renderPanel(field);

    fireEvent.change(screen.getByTestId('field-props-name'), { target: { value: 'Ambient' } });

    expect(panel.onChange).toHaveBeenCalledTimes(1);
    const patch = patchAt(panel.onChange, 0);
    expect(Object.keys(patch)).toEqual(['name']);
    expect(patch).toEqual({ name: 'Ambient' });
    // Kimlik ve tip yamada YOK: taşınsalardı üst katman onları da yazardı.
    expect(patch.draftId).toBeUndefined();
    expect(patch.type).toBeUndefined();
  });

  it('rebuilds only the nested object it edits and leaves its sibling keys in place', () => {
    const field = fieldOfType('checksum');
    field.coverage = { startField: 'header', endField: 'payload' };
    const panel = renderPanel(field);

    fireEvent.change(screen.getByTestId('field-props-coverageEnd'), { target: { value: 'tail' } });

    expect(patchAt(panel.onChange, 0)).toEqual({
      coverage: { startField: 'header', endField: 'tail' },
    });
  });

  it('maps the three signedness states onto the draft value', () => {
    const field = fieldOfType('uint8');
    const panel = renderPanel(field);
    const select = screen.getByTestId('field-props-signed');
    expect(select).toHaveValue('');

    fireEvent.change(select, { target: { value: 'true' } });
    const signed: FieldDraft = { ...field, signed: true };
    panel.rerender(signed);
    expect(screen.getByTestId('field-props-signed')).toHaveValue('true');

    fireEvent.change(screen.getByTestId('field-props-signed'), { target: { value: '' } });

    expect(patchAt(panel.onChange, 0)).toEqual({ signed: true });
    // Boş seçim `false` DEĞİL `null`: "tip zaten söylüyor" demektir.
    expect(patchAt(panel.onChange, 1)).toEqual({ signed: null });
  });

  it('switches the repeat inputs with the selected repeat mode', () => {
    const field = fieldOfType('array');
    const panel = renderPanel(field);
    expect(screen.queryByTestId('field-props-repeatCount')).toBeNull();
    expect(screen.queryByTestId('field-props-repeatFromField')).toBeNull();

    fireEvent.change(screen.getByTestId('field-props-repeatMode'), { target: { value: 'fixed' } });
    expect(patchAt(panel.onChange, 0)).toEqual({
      repeatCount: { mode: 'fixed', count: '', fromField: '' },
    });

    panel.rerender({ ...field, repeatCount: { mode: 'fixed', count: '4', fromField: '' } });
    expect(screen.getByTestId('field-props-repeatCount')).toHaveValue('4');
    expect(screen.queryByTestId('field-props-repeatFromField')).toBeNull();

    panel.rerender({ ...field, repeatCount: { mode: 'fromField', count: '', fromField: 'count' } });
    expect(screen.getByTestId('field-props-repeatFromField')).toHaveValue('count');
    expect(screen.queryByTestId('field-props-repeatCount')).toBeNull();
  });
});

describe('FieldPropertiesPanel — issues', () => {
  it('marks the offending control invalid and points it at its own message list', () => {
    renderPanel(fieldOfType('uint8'), [issue('fields.0.offset', { value: 'abc' })]);

    const offset = screen.getByTestId('field-props-offset');
    expect(offset).toHaveAttribute('aria-invalid', 'true');
    const describedBy = offset.getAttribute('aria-describedby');
    expect(describedBy).not.toBeNull();
    // Bağlantı gerçekten çözülmeli: id'si olmayan bir describedby sessizce ölür.
    expect(document.getElementById(describedBy ?? '')).toBe(
      screen.getByTestId('field-props-offset-issues'),
    );
    // Sorunsuz girdiler işaretlenmemeli.
    expect(screen.getByTestId('field-props-name')).not.toHaveAttribute('aria-invalid');
    expect(screen.getByTestId('field-props-name')).not.toHaveAttribute('aria-describedby');
  });

  it('fills the message placeholders from the issue params', () => {
    renderPanel(fieldOfType('uint8'), [issue('fields.0.offset', { value: 'ff' })]);

    const list = screen.getByTestId('field-props-offset-issues');
    expect(within(list).getAllByRole('listitem')).toHaveLength(1);
    expect(list).toHaveTextContent('ff');
    expect(list).not.toHaveTextContent('{value}');
  });

  it('routes an issue raised on a nested path to the matching control', () => {
    renderPanel(fieldOfType('uint8'), [issue('fields.2.fields.1.bitLength', { value: '-' })]);

    expect(screen.getByTestId('field-props-bitLength')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByTestId('field-props-bitLength-issues')).toBeInTheDocument();
    expect(screen.getByTestId('field-props-offset')).not.toHaveAttribute('aria-invalid');
  });

  it('shares one message list between the two coverage inputs', () => {
    renderPanel(fieldOfType('checksum'), [
      { draftId: 'fd-1', field: 'fields.0.coverage', messageKey: 'studio.draft.coverageIncomplete' },
    ]);

    // Tek liste, iki girdi: mesaj iki kez basılmamalı.
    expect(screen.getAllByTestId('field-props-coverage-issues')).toHaveLength(1);
    for (const controlId of ['field-props-coverageStart', 'field-props-coverageEnd']) {
      const control = screen.getByTestId(controlId);
      expect(control).toHaveAttribute('aria-invalid', 'true');
      expect(control).toHaveAttribute('aria-describedby', 'field-props-coverage-issues');
    }
  });

  it('surfaces issues that belong to no control instead of dropping them', () => {
    renderPanel(fieldOfType('uint8'), [
      {
        draftId: null,
        field: 'framing.maximumFrameLength',
        messageKey: 'studio.draft.schemaRejected',
        params: { path: 'framing', detail: 'expected a number' },
      },
    ]);

    const list = screen.getByTestId('field-props-issues-other');
    expect(within(list).getAllByRole('listitem')).toHaveLength(1);
    expect(list).toHaveTextContent('expected a number');
  });
});

describe('FieldPropertiesPanel — appearance', () => {
  it('offers exactly the four series colours with their literal swatch classes', () => {
    renderPanel(fieldOfType('uint8'));

    const expected = ['bg-series-1', 'bg-series-2', 'bg-series-3', 'bg-series-4'];
    expected.forEach((swatchClass, index) => {
      const button = screen.getByTestId(`field-props-color-${String(index)}`);
      expect(button.querySelector('span')?.className).toContain(swatchClass);
    });
    // Beşinci seri rengi yok; palet dört renkle sınırlı.
    expect(screen.queryByTestId('field-props-color-4')).toBeNull();
    expect(screen.getByTestId('field-props-color-none')).toBeInTheDocument();
  });

  it('presses the chosen colour and reports the picked index', () => {
    const field = fieldOfType('uint8');
    field.color = '2';
    const panel = renderPanel(field);

    expect(screen.getByTestId('field-props-color-2')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('field-props-color-0')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByTestId('field-props-color-none')).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(screen.getByTestId('field-props-color-3'));

    expect(patchAt(panel.onChange, 0)).toEqual({ color: '3' });
  });

  it('clears the colour with an empty string rather than a sentinel index', () => {
    const field = fieldOfType('uint8');
    field.color = '1';
    const panel = renderPanel(field);

    fireEvent.click(screen.getByTestId('field-props-color-none'));

    expect(patchAt(panel.onChange, 0)).toEqual({ color: '' });
  });

  it('warns that a derived field ignores hand written values', () => {
    const panel = renderPanel(fieldOfType('crc'));

    expect(screen.getByRole('note')).toBe(screen.getByTestId('field-props-derived-note'));

    panel.rerender(fieldOfType('uint8'));
    expect(screen.queryByRole('note')).toBeNull();
  });
});

describe('FieldPropertiesPanel — labels', () => {
  it('keeps the byte position and the calibration constant apart', () => {
    renderPanel(fieldOfType('uint8'));

    const positionLabel = labelTextOf('field-props-offset');
    const calibrationLabel = labelTextOf('field-props-calibrationOffset');
    expect(positionLabel).not.toBe('');
    expect(calibrationLabel).not.toBe('');
    expect(positionLabel).not.toBe(calibrationLabel);

    // Etiketin tek başına doğru girdiye götürmesi şart: `getBy*` birden çok
    // eşleşmede patlar, yani bu iki satır "ayırt edilebilir"in kanıtıdır.
    expect(screen.getByLabelText(positionLabel)).toBe(screen.getByTestId('field-props-offset'));
    expect(screen.getByLabelText(calibrationLabel)).toBe(
      screen.getByTestId('field-props-calibrationOffset'),
    );
  });
});
