import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { PacketTemplate, ProjectPayload } from '@/features/projects/projectFile';
import { SPEC_SENSOR_PROTOCOL_JSON } from '@/protocol-core/schemas/specFixture';

/**
 * Store başlangıç değerini MODÜL YÜKLENİRKEN okuduğu için her senaryo, sahte
 * depo kurulduktan SONRA modülü yeniden yüklemek zorunda; bu yüzden statik
 * import yerine `vi.resetModules()` + dinamik import.
 */
async function loadStore(): Promise<typeof import('./protocolSchemaStore')> {
  vi.resetModules();
  return await import('./protocolSchemaStore');
}

interface FakeStorageBehaviour {
  /** Safari private mode: `getItem` erişimde SecurityError atar. */
  readonly throwOnRead?: boolean;
  /** Kota dolu: `setItem` QuotaExceededError atar. */
  readonly throwOnWrite?: boolean;
}

function createFakeStorage(
  initial: Readonly<Record<string, string>> = {},
  behaviour: FakeStorageBehaviour = {},
) {
  const entries = new Map<string, string>(Object.entries(initial));

  const getItem = vi.fn<(key: string) => string | null>((key) => {
    if (behaviour.throwOnRead === true) throw new Error('SecurityError');
    return entries.get(key) ?? null;
  });
  const setItem = vi.fn<(key: string, value: string) => void>((key, value) => {
    if (behaviour.throwOnWrite === true) throw new Error('QuotaExceededError');
    entries.set(key, value);
  });
  const removeItem = vi.fn<(key: string) => void>((key) => {
    entries.delete(key);
  });

  const storage: Storage = {
    get length() {
      return entries.size;
    },
    clear: () => entries.clear(),
    key: (index: number) => Array.from(entries.keys())[index] ?? null,
    getItem,
    setItem,
    removeItem,
  };

  return { storage, entries, getItem, setItem, removeItem };
}

// jsdom `localStorage`ı window üstünde bir getter olarak verir; testte onu
// gölgeleyip her senaryodan sonra ÖZGÜN tanımı geri koyuyoruz, yoksa sahte
// depo sonraki dosyalara sızar.
const originalDescriptor = Object.getOwnPropertyDescriptor(window, 'localStorage');

function installStorage(storage: Storage): void {
  Object.defineProperty(window, 'localStorage', { value: storage, configurable: true });
}

const VALID_SCHEMA_JSON = '{"name":"Custom","version":"2.0","framing":{},"fields":[]}';

const TEMPLATES_KEY = 'alp-comm-packet-templates';

/** Depoya yazılmış gibi görünen tek şablon; kimlik öneki store'unkiyle aynı. */
function storedTemplate(id: string, name: string): PacketTemplate {
  return { id, name, schemaName: 'ALP Sensor Protocol', values: { address: '5' } };
}

function storedTemplatesJson(...templates: readonly PacketTemplate[]): string {
  return JSON.stringify(templates);
}

beforeEach(() => {
  installStorage(createFakeStorage().storage);
});

afterEach(() => {
  if (originalDescriptor !== undefined) {
    Object.defineProperty(window, 'localStorage', originalDescriptor);
  } else {
    Reflect.deleteProperty(window, 'localStorage');
  }
  vi.restoreAllMocks();
});

describe('useProtocolSchemaStore', () => {
  it('starts from the spec fixture when nothing is stored', async () => {
    const { useProtocolSchemaStore } = await loadStore();

    expect(useProtocolSchemaStore.getState().schemaJson).toBe(SPEC_SENSOR_PROTOCOL_JSON);
  });

  it('restores a previously stored schema', async () => {
    const { storage } = createFakeStorage({ 'alp-comm-protocol-schema': VALID_SCHEMA_JSON });
    installStorage(storage);

    const { useProtocolSchemaStore, PROTOCOL_SCHEMA_STORAGE_KEY } = await loadStore();

    expect(PROTOCOL_SCHEMA_STORAGE_KEY).toBe('alp-comm-protocol-schema');
    expect(useProtocolSchemaStore.getState().schemaJson).toBe(VALID_SCHEMA_JSON);
  });

  it('falls back to the default when the stored text is not valid JSON', async () => {
    const { storage } = createFakeStorage({ 'alp-comm-protocol-schema': '{ "name": ' });
    installStorage(storage);

    const { useProtocolSchemaStore } = await loadStore();

    expect(useProtocolSchemaStore.getState().schemaJson).toBe(SPEC_SENSOR_PROTOCOL_JSON);
  });

  it('falls back to the default when the stored JSON is not an object', async () => {
    // Geçerli JSON ama şema kökü olamaz: dizi de ilkel de reddedilmeli.
    const { storage } = createFakeStorage({ 'alp-comm-protocol-schema': '[1,2,3]' });
    installStorage(storage);

    const { useProtocolSchemaStore } = await loadStore();

    expect(useProtocolSchemaStore.getState().schemaJson).toBe(SPEC_SENSOR_PROTOCOL_JSON);
  });

  it('falls back to the default when reading storage throws', async () => {
    const { storage } = createFakeStorage(
      { 'alp-comm-protocol-schema': VALID_SCHEMA_JSON },
      { throwOnRead: true },
    );
    installStorage(storage);

    const { useProtocolSchemaStore } = await loadStore();

    expect(useProtocolSchemaStore.getState().schemaJson).toBe(SPEC_SENSOR_PROTOCOL_JSON);
  });

  it('persists the schema set through setSchemaJson', async () => {
    const fake = createFakeStorage();
    installStorage(fake.storage);

    const { useProtocolSchemaStore } = await loadStore();
    useProtocolSchemaStore.getState().setSchemaJson(VALID_SCHEMA_JSON);

    expect(useProtocolSchemaStore.getState().schemaJson).toBe(VALID_SCHEMA_JSON);
    expect(fake.setItem).toHaveBeenCalledWith('alp-comm-protocol-schema', VALID_SCHEMA_JSON);
    expect(fake.entries.get('alp-comm-protocol-schema')).toBe(VALID_SCHEMA_JSON);
  });

  it('keeps the in-memory schema when writing to storage throws', async () => {
    const fake = createFakeStorage({}, { throwOnWrite: true });
    installStorage(fake.storage);

    const { useProtocolSchemaStore } = await loadStore();

    expect(() => {
      useProtocolSchemaStore.getState().setSchemaJson(VALID_SCHEMA_JSON);
    }).not.toThrow();
    expect(useProtocolSchemaStore.getState().schemaJson).toBe(VALID_SCHEMA_JSON);
  });

  it('stores half-typed schemas too, because validation belongs to the writer screen', async () => {
    const fake = createFakeStorage();
    installStorage(fake.storage);

    const { useProtocolSchemaStore } = await loadStore();
    useProtocolSchemaStore.getState().setSchemaJson('{ "name": ');

    expect(fake.entries.get('alp-comm-protocol-schema')).toBe('{ "name": ');
  });

  it('drops the stored record on resetSchema so the default can evolve', async () => {
    const fake = createFakeStorage({ 'alp-comm-protocol-schema': VALID_SCHEMA_JSON });
    installStorage(fake.storage);

    const { useProtocolSchemaStore } = await loadStore();
    useProtocolSchemaStore.getState().resetSchema();

    expect(useProtocolSchemaStore.getState().schemaJson).toBe(SPEC_SENSOR_PROTOCOL_JSON);
    expect(fake.removeItem).toHaveBeenCalledWith('alp-comm-protocol-schema');
    expect(fake.entries.has('alp-comm-protocol-schema')).toBe(false);
  });
});

describe('packet templates', () => {
  it('starts with an empty list when nothing is stored', async () => {
    const { useProtocolSchemaStore, PACKET_TEMPLATES_STORAGE_KEY } = await loadStore();

    expect(PACKET_TEMPLATES_STORAGE_KEY).toBe(TEMPLATES_KEY);
    expect(useProtocolSchemaStore.getState().packetTemplates).toEqual([]);
  });

  it('restores stored templates', async () => {
    const { storage } = createFakeStorage({
      [TEMPLATES_KEY]: storedTemplatesJson(
        storedTemplate('packet-template-1', 'Set output'),
        storedTemplate('packet-template-2', 'Read status'),
      ),
    });
    installStorage(storage);

    const { useProtocolSchemaStore } = await loadStore();

    const templates = useProtocolSchemaStore.getState().packetTemplates;
    expect(templates).toHaveLength(2);
    expect(templates[0]?.name).toBe('Set output');
    expect(templates[1]?.values).toEqual({ address: '5' });
  });

  it('drops only the unreadable record instead of the whole list', async () => {
    // Tek bozuk satır yüzünden kullanıcının kalan şablonlarını silmek,
    // kurtarılabilir kaydı kurtarmamak demekti.
    const { storage } = createFakeStorage({
      [TEMPLATES_KEY]: JSON.stringify([
        storedTemplate('packet-template-1', 'Good'),
        { id: 'packet-template-2', name: '', schemaName: 'X', values: {} },
        { id: 'packet-template-3', name: 'No values', schemaName: 'X', values: { a: 7 } },
      ]),
    });
    installStorage(storage);

    const { useProtocolSchemaStore } = await loadStore();

    const templates = useProtocolSchemaStore.getState().packetTemplates;
    expect(templates).toHaveLength(1);
    expect(templates[0]?.id).toBe('packet-template-1');
  });

  it('falls back to an empty list when the stored root is not an array', async () => {
    const { storage } = createFakeStorage({ [TEMPLATES_KEY]: '{"id":"packet-template-1"}' });
    installStorage(storage);

    const { useProtocolSchemaStore } = await loadStore();

    expect(useProtocolSchemaStore.getState().packetTemplates).toEqual([]);
  });

  it('falls back to an empty list when reading storage throws', async () => {
    const { storage } = createFakeStorage(
      { [TEMPLATES_KEY]: storedTemplatesJson(storedTemplate('packet-template-1', 'Good')) },
      { throwOnRead: true },
    );
    installStorage(storage);

    const { useProtocolSchemaStore } = await loadStore();

    expect(useProtocolSchemaStore.getState().packetTemplates).toEqual([]);
  });

  it('gives saved templates deterministic increasing ids and persists them', async () => {
    const fake = createFakeStorage();
    installStorage(fake.storage);

    const { useProtocolSchemaStore } = await loadStore();
    useProtocolSchemaStore.getState().savePacketTemplate('First', 'ALP Sensor Protocol', { a: '1' });
    useProtocolSchemaStore.getState().savePacketTemplate('Second', 'ALP Sensor Protocol', { a: '2' });

    const templates = useProtocolSchemaStore.getState().packetTemplates;
    expect(templates.map((template) => template.id)).toEqual([
      'packet-template-1',
      'packet-template-2',
    ]);
    expect(JSON.parse(fake.entries.get(TEMPLATES_KEY) ?? '[]')).toHaveLength(2);
  });

  it('continues the id counter past restored ids so no two rows collide', async () => {
    // Sayaç sıfırdan başlasaydı eklenen ilk şablon `packet-template-3` ile
    // aynı kimliği alır, silme ikisini birden düşürürdü.
    const { storage } = createFakeStorage({
      [TEMPLATES_KEY]: storedTemplatesJson(storedTemplate('packet-template-3', 'Restored')),
    });
    installStorage(storage);

    const { useProtocolSchemaStore } = await loadStore();
    useProtocolSchemaStore.getState().savePacketTemplate('New', 'ALP Sensor Protocol', {});

    const ids = useProtocolSchemaStore.getState().packetTemplates.map((template) => template.id);
    expect(ids).toEqual(['packet-template-3', 'packet-template-4']);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('refuses a template whose own reader would drop it on the next launch', async () => {
    const fake = createFakeStorage();
    installStorage(fake.storage);

    const { useProtocolSchemaStore } = await loadStore();
    useProtocolSchemaStore.getState().savePacketTemplate('   ', 'ALP Sensor Protocol', {});
    useProtocolSchemaStore.getState().savePacketTemplate('Nameless schema', '', {});

    expect(useProtocolSchemaStore.getState().packetTemplates).toEqual([]);
    expect(fake.setItem).not.toHaveBeenCalled();
  });

  it('copies the values object so later form edits do not leak into the template', async () => {
    installStorage(createFakeStorage().storage);

    const { useProtocolSchemaStore } = await loadStore();
    const live: Record<string, string> = { address: '5' };
    useProtocolSchemaStore.getState().savePacketTemplate('Live', 'ALP Sensor Protocol', live);
    live['address'] = '9';

    expect(useProtocolSchemaStore.getState().packetTemplates[0]?.values).toEqual({ address: '5' });
  });

  it('keeps the in-memory list when writing templates to storage throws', async () => {
    const fake = createFakeStorage({}, { throwOnWrite: true });
    installStorage(fake.storage);

    const { useProtocolSchemaStore } = await loadStore();

    expect(() => {
      useProtocolSchemaStore.getState().savePacketTemplate('First', 'ALP Sensor Protocol', {});
    }).not.toThrow();
    expect(useProtocolSchemaStore.getState().packetTemplates).toHaveLength(1);
  });

  it('removes a template by id and rewrites the record', async () => {
    const { storage, entries } = createFakeStorage({
      [TEMPLATES_KEY]: storedTemplatesJson(
        storedTemplate('packet-template-1', 'First'),
        storedTemplate('packet-template-2', 'Second'),
      ),
    });
    installStorage(storage);

    const { useProtocolSchemaStore } = await loadStore();
    useProtocolSchemaStore.getState().removePacketTemplate('packet-template-1');

    const templates = useProtocolSchemaStore.getState().packetTemplates;
    expect(templates).toHaveLength(1);
    expect(templates[0]?.id).toBe('packet-template-2');
    expect(entries.get(TEMPLATES_KEY)).toContain('packet-template-2');
    expect(entries.get(TEMPLATES_KEY)).not.toContain('packet-template-1');
  });

  it('leaves the list untouched when the removed id is unknown', async () => {
    const fake = createFakeStorage({
      [TEMPLATES_KEY]: storedTemplatesJson(storedTemplate('packet-template-1', 'First')),
    });
    installStorage(fake.storage);

    const { useProtocolSchemaStore } = await loadStore();
    const before = useProtocolSchemaStore.getState().packetTemplates;
    useProtocolSchemaStore.getState().removePacketTemplate('packet-template-404');

    // Aynı referans: aboneler sahte bir değişiklik bildirimi almamalı.
    expect(useProtocolSchemaStore.getState().packetTemplates).toBe(before);
    expect(fake.setItem).not.toHaveBeenCalled();
  });
});

describe('project payload', () => {
  const PROJECT: ProjectPayload = {
    name: 'Bench setup',
    savedAt: '2026-01-02T03:04:05.000Z',
    protocols: [VALID_SCHEMA_JSON],
    packetTemplates: [storedTemplate('packet-template-7', 'From file')],
  };

  it('applies the first protocol and replaces the template list', async () => {
    const fake = createFakeStorage({
      [TEMPLATES_KEY]: storedTemplatesJson(storedTemplate('packet-template-1', 'Old')),
    });
    installStorage(fake.storage);

    const { useProtocolSchemaStore } = await loadStore();
    useProtocolSchemaStore.getState().applyProject(PROJECT);

    const state = useProtocolSchemaStore.getState();
    expect(state.schemaJson).toBe(VALID_SCHEMA_JSON);
    expect(state.packetTemplates.map((template) => template.name)).toEqual(['From file']);
    expect(fake.entries.get('alp-comm-protocol-schema')).toBe(VALID_SCHEMA_JSON);
    expect(fake.entries.get(TEMPLATES_KEY)).toContain('From file');
  });

  it('keeps the current schema when the project carries no protocol', async () => {
    installStorage(createFakeStorage().storage);

    const { useProtocolSchemaStore } = await loadStore();
    useProtocolSchemaStore.getState().setSchemaJson(VALID_SCHEMA_JSON);
    useProtocolSchemaStore.getState().applyProject({ ...PROJECT, protocols: [] });

    // Boş listeyi şemaya yazmak kullanıcının o anki tanımını silerdi.
    expect(useProtocolSchemaStore.getState().schemaJson).toBe(VALID_SCHEMA_JSON);
    expect(useProtocolSchemaStore.getState().packetTemplates).toHaveLength(1);
  });

  it('pushes the id counter past the ids that came in with the project', async () => {
    installStorage(createFakeStorage().storage);

    const { useProtocolSchemaStore } = await loadStore();
    useProtocolSchemaStore.getState().applyProject(PROJECT);
    useProtocolSchemaStore.getState().savePacketTemplate('Added', 'ALP Sensor Protocol', {});

    const ids = useProtocolSchemaStore.getState().packetTemplates.map((template) => template.id);
    expect(ids).toEqual(['packet-template-7', 'packet-template-8']);
  });

  it('builds the project body from the current store with the caller timestamp', async () => {
    installStorage(createFakeStorage().storage);

    const { useProtocolSchemaStore } = await loadStore();
    useProtocolSchemaStore.getState().setSchemaJson(VALID_SCHEMA_JSON);
    useProtocolSchemaStore.getState().savePacketTemplate('Saved', 'Custom', { a: '1' });

    const payload = useProtocolSchemaStore
      .getState()
      .buildProjectPayload('Bench setup', '2026-01-02T03:04:05.000Z');

    expect(payload).toEqual({
      name: 'Bench setup',
      savedAt: '2026-01-02T03:04:05.000Z',
      protocols: [VALID_SCHEMA_JSON],
      packetTemplates: [
        { id: 'packet-template-1', name: 'Saved', schemaName: 'Custom', values: { a: '1' } },
      ],
    });
  });

  it('never reads the clock itself, so two calls a moment apart agree', async () => {
    installStorage(createFakeStorage().storage);

    const { useProtocolSchemaStore } = await loadStore();
    const first = useProtocolSchemaStore.getState().buildProjectPayload('P', '2026-01-01T00:00:00.000Z');
    const second = useProtocolSchemaStore.getState().buildProjectPayload('P', '2026-01-01T00:00:00.000Z');

    expect(first).toEqual(second);
  });
});
