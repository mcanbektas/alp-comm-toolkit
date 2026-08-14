import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LanguageProvider } from '@/app/providers/LanguageProvider';
import { useProtocolSchemaStore } from '@/app/store/protocolSchemaStore';
import { SPEC_SENSOR_PROTOCOL_JSON } from '@/protocol-core/schemas/specFixture';

import { ProjectPanel } from './ProjectPanel';
import type { PacketTemplate } from './projectFile';

/**
 * Panelin KENDİ metinleri (`projects.panel.*`, `projects.action.*`) sözlüğe
 * henüz eklenmedi; `t()` onlar için boş döner. Beklentiler bu yüzden
 * `data-testid` ve rol üzerinden kurulur. Metinle aranan tek şeyler VERİDEN
 * (proje adı, şablon adı) ya da SÖZLÜKTE ZATEN BULUNAN `projects.error.*`
 * anahtarlarından gelenler.
 */

const holder = vi.hoisted(() => ({
  downloadTextFile: vi.fn(),
}));

vi.mock('@/utils/downloadTextFile', () => ({
  downloadTextFile: holder.downloadTextFile,
}));

/**
 * jsdom'un depolaması test dosyası boyunca PAYLAŞILIR; store her kayıtta
 * yazdığı için bir testin çıktısı diğerinin başlangıcını değiştirirdi.
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

const TEMPLATE: PacketTemplate = {
  id: 'packet-template-1',
  name: 'Set output',
  schemaName: 'ALP Sensor Protocol',
  values: { address: '5', command: '32' },
};

function projectFileText(overrides: Readonly<Record<string, unknown>> = {}): string {
  return JSON.stringify({
    formatVersion: 1,
    project: {
      name: 'Bench setup',
      savedAt: '2026-01-02T03:04:05.000Z',
      protocols: ['{"name":"Loaded","version":"9.9","framing":{},"fields":[]}'],
      packetTemplates: [TEMPLATE],
      ...overrides,
    },
  });
}

function renderPanel(onApplyTemplate?: (template: PacketTemplate) => void): void {
  const element: ReactElement = (
    <LanguageProvider>
      {onApplyTemplate === undefined ? (
        <ProjectPanel />
      ) : (
        <ProjectPanel onApplyTemplate={onApplyTemplate} />
      )}
    </LanguageProvider>
  );
  render(element);
}

/** Dosya seçimini sürer; `files` jsdom'da salt okunur olduğu için tanımlanır. */
function pickFile(text: string, fileName = 'project.json'): void {
  const input = screen.getByTestId('project-load');
  const file = new File([text], fileName, { type: 'application/json' });
  fireEvent.change(input, { target: { files: [file] } });
}

/** `downloadTextFile`a giden argümanlar; `mock.calls` gevşek tipli. */
function downloadCall(index: number): readonly unknown[] {
  const calls: unknown[][] = holder.downloadTextFile.mock.calls;
  return calls[index] ?? [];
}

beforeEach(() => {
  holder.downloadTextFile.mockReset();
  memoryStorage.clear();
  useProtocolSchemaStore.setState({
    schemaJson: SPEC_SENSOR_PROTOCOL_JSON,
    packetTemplates: [],
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('ProjectPanel — saving', () => {
  it('mounts the name box, the save button and the file picker', () => {
    renderPanel();

    expect(screen.getByTestId('project-panel')).toBeInTheDocument();
    expect(screen.getByTestId('project-name')).toBeInTheDocument();
    expect(screen.getByTestId('project-save')).toBeInTheDocument();
    expect(screen.getByTestId('project-load')).toHaveAttribute('accept', 'application/json,.json');
  });

  it('keeps saving closed until the project has a name', () => {
    renderPanel();

    expect(screen.getByTestId('project-save')).toBeDisabled();

    // Yalnız boşluk da ad değildir: kendi çözümleyicimiz boş adı reddediyor.
    fireEvent.change(screen.getByTestId('project-name'), { target: { value: '   ' } });
    expect(screen.getByTestId('project-save')).toBeDisabled();

    fireEvent.change(screen.getByTestId('project-name'), { target: { value: 'Bench' } });
    expect(screen.getByTestId('project-save')).toBeEnabled();
  });

  it('downloads a JSON file whose name is slugified from the project name', () => {
    renderPanel();

    fireEvent.change(screen.getByTestId('project-name'), { target: { value: 'Işık Ölçüm / 2' } });
    fireEvent.click(screen.getByTestId('project-save'));

    expect(holder.downloadTextFile).toHaveBeenCalledTimes(1);
    // Türkçe harfler ASCII'ye iner, yol ayıracı tireye: indirme adı dizin gibi
    // yorumlanmamalı.
    expect(downloadCall(0)[0]).toBe('isik-olcum-2.alp-comm-project.json');
    expect(downloadCall(0)[2]).toBe('application/json');
  });

  it('falls back to a usable file name when the name has no ascii left', () => {
    renderPanel();

    fireEvent.change(screen.getByTestId('project-name'), { target: { value: '???' } });
    fireEvent.click(screen.getByTestId('project-save'));

    expect(downloadCall(0)[0]).toBe('project.alp-comm-project.json');
  });

  it('writes the current schema and templates into the file body', () => {
    useProtocolSchemaStore.setState({ packetTemplates: [TEMPLATE] });
    renderPanel();

    fireEvent.change(screen.getByTestId('project-name'), { target: { value: 'Bench setup' } });
    fireEvent.click(screen.getByTestId('project-save'));

    const written: unknown = JSON.parse(String(downloadCall(0)[1]));
    expect(written).toMatchObject({
      formatVersion: 1,
      project: {
        name: 'Bench setup',
        protocols: [SPEC_SENSOR_PROTOCOL_JSON],
        packetTemplates: [TEMPLATE],
      },
    });
  });

  it('stamps the save time from the clock at click time', () => {
    // Damgayı ÜRETEN tek yer bu bileşen; saf modül de store da saati okumuyor.
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-03T04:05:06.000Z'));
    renderPanel();

    fireEvent.change(screen.getByTestId('project-name'), { target: { value: 'Bench' } });
    fireEvent.click(screen.getByTestId('project-save'));

    const written: { readonly project: { readonly savedAt: string } } = JSON.parse(
      String(downloadCall(0)[1]),
    );
    expect(written.project.savedAt).toBe('2026-02-03T04:05:06.000Z');
  });

  it('surfaces a failed download instead of pretending it worked', () => {
    holder.downloadTextFile.mockImplementation(() => {
      throw new Error('no Blob URL support');
    });
    renderPanel();

    fireEvent.change(screen.getByTestId('project-name'), { target: { value: 'Bench' } });
    fireEvent.click(screen.getByTestId('project-save'));

    expect(screen.getByTestId('project-error')).toHaveAttribute('role', 'alert');
  });
});

describe('ProjectPanel — loading', () => {
  it('applies a valid project file to the shared store', async () => {
    renderPanel();

    pickFile(projectFileText());

    await waitFor(() => {
      expect(screen.getByTestId('project-loaded-name')).toHaveTextContent('Bench setup');
    });
    const state = useProtocolSchemaStore.getState();
    expect(state.schemaJson).toContain('"name":"Loaded"');
    expect(state.packetTemplates).toEqual([TEMPLATE]);
    expect(screen.queryByTestId('project-error')).not.toBeInTheDocument();
  });

  it('fills the name box with the loaded project name', async () => {
    renderPanel();

    pickFile(projectFileText());

    await waitFor(() => {
      expect(screen.getByTestId('project-name')).toHaveValue('Bench setup');
    });
  });

  it('rejects broken JSON with an alert and leaves the store alone', async () => {
    renderPanel();

    pickFile('{ "formatVersion": 1, ');

    await waitFor(() => {
      expect(screen.getByTestId('project-error')).toBeInTheDocument();
    });
    // `projects.error.*` anahtarları SÖZLÜKTE var; metinle doğrulanabilir.
    expect(screen.getByTestId('project-error-message')).toHaveTextContent('Dosya geçerli JSON değil.');
    expect(useProtocolSchemaStore.getState().schemaJson).toBe(SPEC_SENSOR_PROTOCOL_JSON);
    expect(screen.queryByTestId('project-loaded-name')).not.toBeInTheDocument();
  });

  it('names the offending version when the file comes from a newer build', async () => {
    renderPanel();

    pickFile(JSON.stringify({ formatVersion: 2, project: {} }));

    await waitFor(() => {
      expect(screen.getByTestId('project-error-detail')).toHaveTextContent('2');
    });
    expect(useProtocolSchemaStore.getState().packetTemplates).toEqual([]);
  });

  it('rejects a file whose template list is missing', async () => {
    renderPanel();

    pickFile(projectFileText({ packetTemplates: undefined }));

    await waitFor(() => {
      expect(screen.getByTestId('project-error-message')).toHaveTextContent(
        'Paket şablonu listesi dizi değil.',
      );
    });
    expect(useProtocolSchemaStore.getState().schemaJson).toBe(SPEC_SENSOR_PROTOCOL_JSON);
  });

  it('points at the offending template row instead of a bare rejection', async () => {
    renderPanel();

    pickFile(projectFileText({ packetTemplates: [TEMPLATE, { id: 'x', name: 'Bad' }] }));

    await waitFor(() => {
      expect(screen.getByTestId('project-error-detail')).toHaveTextContent(
        'packetTemplates[1].schemaName',
      );
    });
  });

  it('separates an unreadable file from a rejected one', async () => {
    renderPanel();

    const input = screen.getByTestId('project-load');
    const file = new File(['{}'], 'project.json', { type: 'application/json' });
    // İçerik HİÇ görülmedi: biçim reddiyle aynı mesajı basmak yanıltıcı olurdu.
    Object.defineProperty(file, 'text', {
      value: () => Promise.reject(new Error('permission denied')),
    });
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByTestId('project-error')).toBeInTheDocument();
    });
    // Anahtar sözlükte yok; boş çizilir ama ayrıntı satırı da basılmamalı.
    expect(screen.queryByTestId('project-error-detail')).not.toBeInTheDocument();
  });

  it('clears a stale error once a good file lands', async () => {
    renderPanel();

    pickFile('not json at all');
    await waitFor(() => {
      expect(screen.getByTestId('project-error')).toBeInTheDocument();
    });

    pickFile(projectFileText());
    await waitFor(() => {
      expect(screen.queryByTestId('project-error')).not.toBeInTheDocument();
    });
  });
});

describe('ProjectPanel — packet templates', () => {
  it('says the list is empty instead of drawing a blank box', () => {
    renderPanel();

    expect(screen.getByTestId('project-templates-empty')).toBeInTheDocument();
    expect(screen.queryByTestId('project-templates')).not.toBeInTheDocument();
  });

  it('lists every stored template with its schema name', () => {
    useProtocolSchemaStore.setState({ packetTemplates: [TEMPLATE] });
    renderPanel();

    expect(screen.getByTestId('project-template-name-packet-template-1')).toHaveTextContent(
      'Set output',
    );
    expect(screen.getByTestId('project-template-schema-packet-template-1')).toHaveTextContent(
      'ALP Sensor Protocol',
    );
  });

  it('hands the whole template back when apply is offered and pressed', () => {
    const onApplyTemplate = vi.fn();
    useProtocolSchemaStore.setState({ packetTemplates: [TEMPLATE] });
    renderPanel(onApplyTemplate);

    fireEvent.click(screen.getByTestId('project-template-apply-packet-template-1'));

    expect(onApplyTemplate).toHaveBeenCalledTimes(1);
    expect(onApplyTemplate).toHaveBeenCalledWith(TEMPLATE);
  });

  it('draws no apply button when the host screen cannot apply one', () => {
    // Studio'nun uygulayacak bir formu yok; devre dışı düğme "bir gün
    // çalışacak" yalanı olurdu.
    useProtocolSchemaStore.setState({ packetTemplates: [TEMPLATE] });
    renderPanel();

    expect(
      screen.queryByTestId('project-template-apply-packet-template-1'),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId('project-template-remove-packet-template-1')).toBeInTheDocument();
  });

  it('removes a template from the store and from the list', () => {
    useProtocolSchemaStore.setState({ packetTemplates: [TEMPLATE] });
    renderPanel();

    fireEvent.click(screen.getByTestId('project-template-remove-packet-template-1'));

    expect(useProtocolSchemaStore.getState().packetTemplates).toEqual([]);
    expect(screen.getByTestId('project-templates-empty')).toBeInTheDocument();
  });

  it('states that the project file never leaves the machine', () => {
    renderPanel();

    expect(screen.getByTestId('project-privacy')).toBeInTheDocument();
  });
});
