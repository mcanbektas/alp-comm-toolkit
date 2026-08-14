import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
