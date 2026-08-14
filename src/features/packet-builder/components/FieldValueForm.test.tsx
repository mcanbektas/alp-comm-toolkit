import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { LanguageProvider } from '@/app/providers/LanguageProvider';
import type { ProtocolSchema } from '@/protocol-core/schemas/protocolSchema';

import { describeBuilderFields } from '../packetPipeline';
import type { BuilderFieldDescriptor, PacketIssue } from '../packetPipeline';
import { FieldValueForm } from './FieldValueForm';

/**
 * Seçiciler `data-testid` ve rol üzerinden; panelin çeviri anahtarları sözlüğe
 * henüz eklenmedi ve `t()` boş döner. Görünen METİN üzerinden aranan tek şey
 * VERİDEN gelenler (alan adı, birim, enum etiketi) — onlar çeviriye girmez.
 */

const FORM_PROTOCOL: ProtocolSchema = {
  name: 'Form Probe',
  version: '1.0',
  framing: { type: 'none', maximumFrameLength: 32 },
  fields: [
    {
      id: 'speed',
      name: 'Speed',
      type: 'uint8',
      offset: 0,
      length: 1,
      unit: 'rpm',
      minimum: 10,
      maximum: 200,
    },
    { id: 'enabled', name: 'Enabled', type: 'boolean', offset: 1, length: 1 },
    {
      id: 'mode',
      name: 'Mode',
      type: 'enum',
      offset: 2,
      length: 1,
      enumValues: { '0': 'Idle', '1': 'Run' },
    },
    { id: 'label', name: 'Label', type: 'ascii', offset: 3, length: 4 },
    { id: 'blob', name: 'Blob', type: 'rawBytes', offset: 7, length: 2 },
    {
      id: 'checksum',
      name: 'Checksum',
      type: 'checksum',
      algorithm: 'xor8',
      coverage: { startField: 'speed', endField: 'blob' },
    },
  ],
};

const FIELDS: readonly BuilderFieldDescriptor[] = describeBuilderFields(FORM_PROTOCOL);

const DEFAULT_VALUES: Readonly<Record<string, string>> = {
  speed: '12',
  enabled: 'false',
  mode: '0',
  label: 'AB',
  blob: '00FF',
};

interface RenderOptions {
  readonly fields?: readonly BuilderFieldDescriptor[];
  readonly values?: Readonly<Record<string, string>>;
  readonly issues?: readonly PacketIssue[];
}

function renderForm(options: RenderOptions = {}): {
  readonly onValueChange: ReturnType<typeof vi.fn>;
  readonly onStepValue: ReturnType<typeof vi.fn>;
  readonly onRandomize: ReturnType<typeof vi.fn>;
} {
  const handlers = {
    onValueChange: vi.fn(),
    onStepValue: vi.fn(),
    onRandomize: vi.fn(),
  };

  render(
    <LanguageProvider>
      <FieldValueForm
        fields={options.fields ?? FIELDS}
        values={options.values ?? DEFAULT_VALUES}
        issues={options.issues ?? []}
        {...handlers}
      />
    </LanguageProvider>,
  );
  return handlers;
}

/** `noUncheckedIndexedAccess` altında sorgu `null` dönebilir; kaçak yerine patla. */
function elementById(id: string): HTMLElement {
  const element = document.getElementById(id);
  if (element === null) {
    throw new Error(`#${id} was not rendered`);
  }
  return element;
}

describe('FieldValueForm', () => {
  it('renders one entry per schema field', () => {
    renderForm();

    for (const field of FIELDS) {
      expect(screen.getByTestId(`builder-field-${field.path}`)).toBeInTheDocument();
    }
  });

  it('says so when the protocol has no fields to fill', () => {
    renderForm({ fields: [] });

    expect(screen.getByTestId('builder-form-empty')).toBeInTheDocument();
  });

  it('puts the unit into the label instead of a separate column', () => {
    renderForm();

    // Birim VERİDİR (şemadan gelir), çeviri sözlüğüne girmez.
    expect(screen.getByText('Speed (rpm)')).toBeInTheDocument();
  });

  it('offers the enum labels as a select', () => {
    renderForm();

    const select = elementById('builder-field-mode');
    expect(select.tagName).toBe('SELECT');
    expect(screen.getByRole('option', { name: 'Idle' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Run' })).toBeInTheDocument();

    fireEvent.change(select, { target: { value: '1' } });
  });

  it('reports the enum key rather than the label', () => {
    const handlers = renderForm();

    fireEvent.change(elementById('builder-field-mode'), { target: { value: '1' } });

    expect(handlers.onValueChange).toHaveBeenCalledWith('mode', '1');
  });

  it('turns a boolean field into a checkbox that reports text values', () => {
    const handlers = renderForm();

    const checkbox = elementById('builder-field-enabled');
    expect(checkbox).toHaveAttribute('type', 'checkbox');

    fireEvent.click(checkbox);
    expect(handlers.onValueChange).toHaveBeenCalledWith('enabled', 'true');
  });

  it('steps a numeric field by one in both directions', () => {
    const handlers = renderForm();

    fireEvent.click(screen.getByTestId('builder-step-up-speed'));
    fireEvent.click(screen.getByTestId('builder-step-down-speed'));

    expect(handlers.onStepValue).toHaveBeenNthCalledWith(1, 'speed', 1);
    expect(handlers.onStepValue).toHaveBeenNthCalledWith(2, 'speed', -1);
  });

  it('passes raw text through so the owner decides how to parse it', () => {
    const handlers = renderForm();

    fireEvent.change(elementById('builder-field-label'), { target: { value: 'Zz' } });
    fireEvent.change(elementById('builder-field-speed'), { target: { value: '25' } });

    // Metin OLARAK bildiriliyor; sayıya çevirme `usePacketBuilder`ın sınırında.
    expect(handlers.onValueChange).toHaveBeenNthCalledWith(1, 'label', 'Zz');
    expect(handlers.onValueChange).toHaveBeenNthCalledWith(2, 'speed', '25');
  });

  it('shows the declared range next to the field', () => {
    renderForm();

    const hint = screen.getByTestId('builder-range-speed');
    expect(hint.textContent).toContain('10');
    expect(hint.textContent).toContain('200');
  });

  it('renders derived fields read-only with an automatic badge', () => {
    renderForm();

    // ResultField `<output>` basar: türetilen alan hiçbir koşulda yazılamaz.
    expect(elementById('builder-field-checksum').tagName).toBe('OUTPUT');
    expect(screen.getByTestId('builder-derived-checksum')).toBeInTheDocument();
    expect(screen.queryByTestId('builder-step-up-checksum')).not.toBeInTheDocument();
  });

  it('shows a raw byte field as a monospace text entry', () => {
    renderForm();

    const input = elementById('builder-field-blob');
    expect(input).toHaveAttribute('type', 'text');
    expect(input.className).toContain('font-mono');
  });

  it('surfaces the issue that belongs to a field', () => {
    renderForm({
      issues: [{ fieldId: 'speed', messageKey: 'builder.issue.invalidValue', params: { detail: 'oops' } }],
    });

    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain('oops');
  });

  it('asks its owner to fill the form randomly', () => {
    const handlers = renderForm();

    fireEvent.click(screen.getByTestId('builder-randomize'));

    expect(handlers.onRandomize).toHaveBeenCalledTimes(1);
  });
});
