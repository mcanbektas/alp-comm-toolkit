import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { useProtocolSchemaStore } from '@/app/store/protocolSchemaStore';
import { bytesToHex } from '@/protocol-core/buffers/representation';
import { generateJsonSchemaOutput } from '@/protocol-core/codegen';
import {
  SPEC_SENSOR_FRAME,
  SPEC_SENSOR_PROTOCOL,
  SPEC_SENSOR_PROTOCOL_JSON,
} from '@/protocol-core/schemas/specFixture';
import { resetDraftIdCounter } from './schemaDraft';
import { useProtocolStudio } from './useProtocolStudio';

/**
 * localStorage sahtesi. jsdom'unki test dosyası boyunca PAYLAŞILIR; store her
 * geçerli şemada yazdığı için bir testin çıktısı diğerinin açılışını
 * değiştirirdi. Bellek içi bir kopya her testte sıfırlanabilir.
 */
function createMemoryStorage(): Storage {
  const entries = new Map<string, string>();
  return {
    get length(): number {
      return entries.size;
    },
    clear(): void {
      entries.clear();
    },
    getItem(key: string): string | null {
      return entries.get(key) ?? null;
    },
    key(index: number): string | null {
      return Array.from(entries.keys())[index] ?? null;
    },
    removeItem(key: string): void {
      entries.delete(key);
    },
    setItem(key: string, value: string): void {
      entries.set(key, value);
    },
  };
}

const memoryStorage = createMemoryStorage();
Object.defineProperty(window, 'localStorage', {
  value: memoryStorage,
  configurable: true,
  writable: true,
});

/** Spec fixture'ının kanonik JSON çıktısı — store'a yazılması beklenen metin. */
const SPEC_SENSOR_PROTOCOL_GENERATED_JSON = generateJsonSchemaOutput(SPEC_SENSOR_PROTOCOL).code;

beforeEach(() => {
  memoryStorage.clear();
  resetDraftIdCounter();
  // Store modül yüklenirken bir kez okunur; her test kendi başlangıcını kurar.
  useProtocolSchemaStore.setState({ schemaJson: SPEC_SENSOR_PROTOCOL_JSON });
});

describe('useProtocolStudio', () => {
  it('opens with the schema stored by the shared protocol store', () => {
    const { result } = renderHook(() => useProtocolStudio());

    expect(result.current.draft.name).toBe('ALP Sensor Protocol');
    expect(result.current.draft.fields).toHaveLength(SPEC_SENSOR_PROTOCOL.fields.length);
    expect(result.current.schema?.name).toBe('ALP Sensor Protocol');
    expect(result.current.draftIssues).toHaveLength(0);
  });

  it('falls back to an empty draft when the stored schema is unreadable', () => {
    useProtocolSchemaStore.setState({ schemaJson: '{ this is not json' });

    const { result } = renderHook(() => useProtocolStudio());

    expect(result.current.draft.fields).toHaveLength(0);
    expect(result.current.schema).toBeNull();
    // Boş taslak şemaya çevrilemez; sorunlar taslak katmanından gelir.
    expect(result.current.draftIssues.map((issue) => issue.messageKey)).toContain(
      'studio.draft.fieldsRequired',
    );
  });

  it('starts with the spec frame as the sample and parses it successfully', () => {
    const { result } = renderHook(() => useProtocolStudio());

    expect(result.current.sampleHex).toBe(bytesToHex(SPEC_SENSOR_FRAME));
    expect(Array.from(result.current.sampleBytes)).toEqual(Array.from(SPEC_SENSOR_FRAME));
    expect(result.current.hexErrorKey).toBeNull();
    expect(result.current.parseResult?.success).toBe(true);
  });

  it('exposes byte regions for the parsed sample frame', () => {
    const { result } = renderHook(() => useProtocolStudio());

    expect(result.current.regions.length).toBeGreaterThan(0);
    expect(result.current.regions.map((region) => region.id)).toContain('command');
  });

  it('generates all six code artifacts while the schema is valid', () => {
    const { result } = renderHook(() => useProtocolStudio());

    expect(result.current.artifacts).toHaveLength(6);
    expect(result.current.artifacts.map((artifact) => artifact.id)).toEqual([
      'json-schema',
      'c-struct',
      'c-parser',
      'python-parser',
      'typescript-parser',
      'markdown-doc',
    ]);
  });

  it('prints the sample frame into the generated markdown document', () => {
    const { result } = renderHook(() => useProtocolStudio());

    const markdown = result.current.artifacts.find((artifact) => artifact.id === 'markdown-doc');
    expect(markdown?.code).toContain('## Example frame');
  });

  it('drops every artifact when the draft can no longer become a schema', () => {
    const { result } = renderHook(() => useProtocolStudio());

    act(() => {
      result.current.updateMeta({ name: '' });
    });

    expect(result.current.schema).toBeNull();
    expect(result.current.artifacts).toHaveLength(0);
    expect(result.current.parseResult).toBeNull();
    expect(result.current.regions).toHaveLength(0);
  });

  it('adds a field to the root list and selects it', () => {
    const { result } = renderHook(() => useProtocolStudio());
    const before = result.current.draft.fields.length;

    act(() => {
      result.current.addField(null);
    });

    expect(result.current.draft.fields).toHaveLength(before + 1);
    expect(result.current.selectedDraftId).not.toBeNull();
    expect(result.current.selectedField?.draftId).toBe(result.current.selectedDraftId);
  });

  it('adds a nested field under the given parent', () => {
    const { result } = renderHook(() => useProtocolStudio());
    const parent = result.current.draft.fields[0];
    expect(parent).toBeDefined();
    if (parent === undefined) return;

    act(() => {
      result.current.addField(parent.draftId);
    });

    const updatedParent = result.current.draft.fields[0];
    expect(updatedParent?.fields).toHaveLength(1);
    expect(result.current.draft.fields).toHaveLength(SPEC_SENSOR_PROTOCOL.fields.length);
  });

  it('removes a field and clears the selection that pointed at it', () => {
    const { result } = renderHook(() => useProtocolStudio());
    const target = result.current.draft.fields[0];
    expect(target).toBeDefined();
    if (target === undefined) return;

    act(() => {
      result.current.selectField(target.draftId);
    });
    expect(result.current.selectedField?.id).toBe('address');

    act(() => {
      result.current.removeField(target.draftId);
    });

    expect(result.current.draft.fields).toHaveLength(SPEC_SENSOR_PROTOCOL.fields.length - 1);
    expect(result.current.selectedDraftId).toBeNull();
    expect(result.current.selectedField).toBeNull();
  });

  it('duplicates a field right after the original with a fresh identifier', () => {
    const { result } = renderHook(() => useProtocolStudio());
    const target = result.current.draft.fields[0];
    expect(target).toBeDefined();
    if (target === undefined) return;

    act(() => {
      result.current.duplicateField(target.draftId);
    });

    const copy = result.current.draft.fields[1];
    expect(result.current.draft.fields).toHaveLength(SPEC_SENSOR_PROTOCOL.fields.length + 1);
    expect(copy?.id).toBe('addressCopy');
    expect(copy?.draftId).not.toBe(target.draftId);
  });

  it('moves a field inside its own list', () => {
    const { result } = renderHook(() => useProtocolStudio());
    const originalOrder = result.current.draft.fields.map((field) => field.id);

    act(() => {
      result.current.moveField(null, 0, 2);
    });

    const movedOrder = result.current.draft.fields.map((field) => field.id);
    expect(movedOrder[2]).toBe(originalOrder[0]);
    expect(movedOrder[0]).toBe(originalOrder[1]);
  });

  it('applies a patch to a single field without touching the others', () => {
    const { result } = renderHook(() => useProtocolStudio());
    const target = result.current.draft.fields[0];
    expect(target).toBeDefined();
    if (target === undefined) return;

    act(() => {
      result.current.updateField(target.draftId, { name: 'Node Address' });
    });

    expect(result.current.draft.fields[0]?.name).toBe('Node Address');
    expect(result.current.draft.fields[1]?.id).toBe('command');
  });

  it('reports invalid hexadecimal input without keeping the previous bytes', () => {
    const { result } = renderHook(() => useProtocolStudio());

    act(() => {
      result.current.setSampleHex('AA ZZ 10');
    });

    expect(result.current.hexErrorKey).toBe('studio.error.invalidHex');
    expect(result.current.sampleBytes).toHaveLength(0);
    expect(result.current.parseResult).toBeNull();
    expect(result.current.regions).toHaveLength(0);
  });

  it('accepts spaced hexadecimal and re-parses the new sample', () => {
    const { result } = renderHook(() => useProtocolStudio());

    act(() => {
      result.current.setSampleHex('AA 05 10 03 34 12 7F 4F 55');
    });

    expect(result.current.hexErrorKey).toBeNull();
    expect(Array.from(result.current.sampleBytes)).toEqual(Array.from(SPEC_SENSOR_FRAME));
    expect(result.current.parseResult?.success).toBe(true);
  });

  it('rejects an unreadable schema JSON and leaves the draft untouched', () => {
    const { result } = renderHook(() => useProtocolStudio());
    const before = result.current.draft;

    let outcome: { readonly ok: boolean } | undefined;
    act(() => {
      outcome = result.current.loadSchemaJson('{ "name": 42 }');
    });

    expect(outcome).toEqual({ ok: false, errorKey: 'studio.error.invalidSchemaJson' });
    expect(result.current.draft).toBe(before);
  });

  it('replaces the draft when a valid schema JSON is loaded', () => {
    const { result } = renderHook(() => useProtocolStudio());

    act(() => {
      result.current.loadSchemaJson(
        JSON.stringify({
          name: 'Loaded Protocol',
          version: '2.1',
          framing: { type: 'none', maximumFrameLength: 32 },
          fields: [{ id: 'status', name: 'Status', type: 'uint8', offset: 0, length: 1 }],
        }),
      );
    });

    expect(result.current.draft.name).toBe('Loaded Protocol');
    expect(result.current.draft.version).toBe('2.1');
    expect(result.current.draft.fields).toHaveLength(1);
    expect(result.current.schema?.name).toBe('Loaded Protocol');
  });

  it('returns to the spec fixture together with its sample frame', () => {
    const { result } = renderHook(() => useProtocolStudio());

    act(() => {
      result.current.updateMeta({ name: 'Scratch' });
      result.current.setSampleHex('00');
    });
    expect(result.current.draft.name).toBe('Scratch');

    act(() => {
      result.current.resetToSpecFixture();
    });

    expect(result.current.draft.name).toBe('ALP Sensor Protocol');
    expect(result.current.sampleHex).toBe(bytesToHex(SPEC_SENSOR_FRAME));
    expect(result.current.draft.fields).toHaveLength(SPEC_SENSOR_PROTOCOL.fields.length);
  });

  it('publishes the valid schema to the shared store', () => {
    renderHook(() => useProtocolStudio());

    expect(useProtocolSchemaStore.getState().schemaJson).toBe(
      SPEC_SENSOR_PROTOCOL_GENERATED_JSON,
    );
  });

  it('keeps the last published schema in the store while the draft is broken', () => {
    const { result } = renderHook(() => useProtocolStudio());
    expect(useProtocolSchemaStore.getState().schemaJson).toBe(
      SPEC_SENSOR_PROTOCOL_GENERATED_JSON,
    );

    act(() => {
      result.current.updateMeta({ name: '' });
    });

    expect(result.current.schema).toBeNull();
    expect(useProtocolSchemaStore.getState().schemaJson).toBe(
      SPEC_SENSOR_PROTOCOL_GENERATED_JSON,
    );
  });

  it('publishes the renamed protocol after a metadata edit', () => {
    const { result } = renderHook(() => useProtocolStudio());

    act(() => {
      result.current.updateMeta({ name: 'Renamed Protocol' });
    });

    expect(useProtocolSchemaStore.getState().schemaJson).toContain('"Renamed Protocol"');
  });

  it('does not re-publish when only the sample frame changes', () => {
    const { result } = renderHook(() => useProtocolStudio());
    const published = useProtocolSchemaStore.getState().schemaJson;

    act(() => {
      result.current.setSampleHex('AA 05 10 00 4F 55');
    });

    // Aynı metin ise store nesnesi de aynı kalmalı: örnek hex şemayı değiştirmez.
    expect(useProtocolSchemaStore.getState().schemaJson).toBe(published);
  });

  it('clears the selection when asked explicitly', () => {
    const { result } = renderHook(() => useProtocolStudio());
    const target = result.current.draft.fields[1];
    expect(target).toBeDefined();
    if (target === undefined) return;

    act(() => {
      result.current.selectField(target.draftId);
    });
    expect(result.current.selectedField?.id).toBe('command');

    act(() => {
      result.current.selectField(null);
    });

    expect(result.current.selectedDraftId).toBeNull();
    expect(result.current.selectedField).toBeNull();
  });
});
