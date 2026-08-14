import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ReactElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LanguageProvider } from '@/app/providers/LanguageProvider';
import { useProtocolSchemaStore } from '@/app/store/protocolSchemaStore';
import type { ByteSource, ByteSourceHandlers } from '@/connection/types';
import { SPEC_SENSOR_PROTOCOL_JSON } from '@/protocol-core/schemas/specFixture';

import { PacketBuilderScreen } from './PacketBuilderScreen';

/**
 * Seçiciler `data-testid` ve rol üzerinden, METİN ÜZERİNDEN DEĞİL: ekranın
 * çeviri anahtarları sözlüğe henüz eklenmedi ve `t()` boş dönüyor. Ada göre
 * arayan bir test bugün de, anahtarlar eklendiği gün de kırılırdı. Metinle
 * aranan tek şeyler VERİDEN gelenler: şema adı, sürümü ve üretilen hex.
 */

// --- Bağlantı katmanı sahtesi ---------------------------------------------

const holder = vi.hoisted(() => ({
  createSerialSource: vi.fn(),
  createSimulatedSource: vi.fn(),
  requestSerialPort: vi.fn(),
  serialSupported: true,
  downloadTextFile: vi.fn(),
}));

vi.mock('@/connection/serial/serialSource', () => ({
  createSerialSource: holder.createSerialSource,
}));

vi.mock('@/connection/mock/simulatedSource', () => ({
  createSimulatedSource: holder.createSimulatedSource,
}));

vi.mock('@/connection/serial/webSerialTypes', () => ({
  requestSerialPort: holder.requestSerialPort,
  isWebSerialSupported: () => holder.serialSupported,
}));

vi.mock('@/utils/downloadTextFile', () => ({
  downloadTextFile: holder.downloadTextFile,
}));

/**
 * jsdom'un depolaması test dosyası boyunca PAYLAŞILIR; bellek içi bir kopya
 * her testte sıfırlanabilir (`usePacketBuilder.test.ts` ile aynı gerekçe).
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

Object.defineProperty(window, 'localStorage', {
  value: createMemoryStorage(),
  configurable: true,
  writable: true,
});

interface FakeSource {
  readonly source: ByteSource;
  readonly writes: Uint8Array[];
}

/** `ByteSource` sözleşmesini birebir gerçekler; hook üretimdekiyle aynı biçimi görür. */
function createFakeSource(canWrite: boolean): FakeSource {
  const writes: Uint8Array[] = [];

  const source: ByteSource = {
    kind: canWrite ? 'web-serial' : 'simulated',
    canWrite,
    async start(handlers: ByteSourceHandlers): Promise<void> {
      handlers.onStatus('connecting');
      handlers.onStatus('connected');
    },
    async stop(): Promise<void> {
      // Sahte kaynak zamanlayıcı kurmuyor; kapatılacak bir şey yok.
    },
    async write(bytes: Uint8Array): Promise<void> {
      writes.push(bytes);
    },
  };

  return { source, writes };
}

// --- Render yardımcısı ----------------------------------------------------

function renderScreen(): void {
  const element: ReactElement = (
    <MemoryRouter>
      <LanguageProvider>
        <PacketBuilderScreen />
      </LanguageProvider>
    </MemoryRouter>
  );
  render(element);
}

/**
 * Etiketi çeviriden gelen (yani şu an BOŞ) girdileri id ile buluyoruz;
 * `getByLabelText('')` hem belirsiz hem de anahtar eklendiği gün kırılırdı.
 */
function selectById(id: string): HTMLSelectElement {
  const element = document.getElementById(id);
  if (!(element instanceof HTMLSelectElement)) {
    throw new Error(`Expected a <select> with id "${id}"`);
  }
  return element;
}

function inputById(id: string): HTMLInputElement {
  const element = document.getElementById(id);
  if (!(element instanceof HTMLInputElement)) {
    throw new Error(`Expected an <input> with id "${id}"`);
  }
  return element;
}

/** Formu spec §10'un örneğine ayarlar: Set Output, kanal 2, %75 duty. */
function fillSpecExample(): void {
  // Alan etiketleri VERİDEN gelir (şemadaki `name`), çeviriden değil — bu üçü
  // ada göre aranabilir.
  fireEvent.change(screen.getByLabelText('Device Address'), { target: { value: '5' } });
  fireEvent.change(screen.getByLabelText('Command'), { target: { value: '32' } });
  fireEvent.change(screen.getByLabelText('Payload'), { target: { value: '024B' } });
}

beforeEach(() => {
  holder.serialSupported = true;
  holder.createSerialSource.mockReset();
  holder.createSimulatedSource.mockReset();
  holder.requestSerialPort.mockReset();
  holder.downloadTextFile.mockReset();
  useProtocolSchemaStore.setState({ schemaJson: SPEC_SENSOR_PROTOCOL_JSON });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('PacketBuilderScreen', () => {
  it('mounts the four panels under their own sections', () => {
    renderScreen();

    expect(screen.getByTestId('builder-connection-panel')).toBeInTheDocument();
    expect(screen.getByTestId('builder-field-form')).toBeInTheDocument();
    expect(screen.getByTestId('builder-preview-panel')).toBeInTheDocument();
    expect(screen.getByTestId('builder-send-panel')).toBeInTheDocument();
    // Ekranda tek bir `h1` olmalı; panellerin kendi başlığı yok.
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });

  it('names the loaded protocol and its version from the shared store', () => {
    renderScreen();

    expect(screen.getByTestId('builder-schema-name')).toHaveTextContent('ALP Sensor Protocol');
    expect(screen.getByTestId('builder-schema-version')).toHaveTextContent('1.0');
    expect(screen.queryByTestId('builder-schema-error')).not.toBeInTheDocument();
  });

  it('raises an alert instead of a half schema when the stored definition is rejected', () => {
    useProtocolSchemaStore.setState({ schemaJson: '{"name":"broken"}' });
    renderScreen();

    expect(screen.getByTestId('builder-schema-error')).toHaveAttribute('role', 'alert');
    expect(screen.getByTestId('builder-schema-missing')).toBeInTheDocument();
    expect(screen.queryByTestId('builder-schema-name')).not.toBeInTheDocument();
  });

  it('links to Protocol Studio so the definition can be edited where it lives', () => {
    renderScreen();

    expect(screen.getByTestId('builder-open-studio')).toHaveAttribute('href', '/protocol-studio');
  });

  it('rebuilds the form from the schema when the definition is reloaded', () => {
    renderScreen();

    fireEvent.change(screen.getByLabelText('Device Address'), { target: { value: '9' } });
    // `type="number"` girdisinde jest-dom SAYI bekler; '9' ile karşılaştırmak
    // tipi tutmadığı için başarısız olurdu.
    expect(screen.getByLabelText('Device Address')).toHaveValue(9);

    fireEvent.click(screen.getByTestId('builder-reload-schema'));

    // Metin değişmese bile yeniden yükleme form varsayılanlarına döner —
    // "yeniden yükle" düğmesinin tek gözle görülür etkisi bu.
    expect(screen.getByLabelText('Device Address')).toHaveValue(0);
  });

  it('encodes the spec §10 example frame from the form', () => {
    renderScreen();
    fillSpecExample();

    // AA 05 20 02 02 4B 6E 55 — §10 metni `6C` yazar ve YANLIŞTIR (bkz. spec
    // fixture yorumu); XOR8(05 20 02 02 4B) = 0x6E.
    expect(screen.getByTestId('builder-preview-hex')).toHaveTextContent('AA052002024B6E55');
    expect(screen.getByTestId('builder-preview-byte-count')).toHaveTextContent('8');
  });

  it('computes the derived fields instead of asking for them', () => {
    renderScreen();

    // Payload uzunluğu ve checksum forma HİÇ girilmez; kodlayıcı yazar.
    expect(screen.getByTestId('builder-derived-payloadLength')).toBeInTheDocument();
    expect(screen.getByTestId('builder-derived-checksum')).toBeInTheDocument();
  });

  it('re-announces the current packet through an aria-live region on demand', () => {
    renderScreen();
    fillSpecExample();

    const status = screen.getByTestId('builder-build-status');
    expect(status).toHaveAttribute('aria-live', 'polite');

    fireEvent.click(screen.getByTestId('builder-build'));

    expect(screen.getByTestId('builder-build-byte-count')).toHaveTextContent('8');
  });

  it('reports a blocked build rather than a silently truncated packet', () => {
    renderScreen();

    // Tek haneli hex çevrilemez: sonuç `null`, gönderilecek bayt yok.
    fireEvent.click(screen.getByTestId('builder-hex-override-toggle'));
    fireEvent.change(inputById('builder-hex-override-value'), { target: { value: 'ABC' } });
    fireEvent.click(screen.getByTestId('builder-build'));

    expect(screen.getByTestId('builder-build-byte-count')).toHaveTextContent('0');
    expect(screen.getByTestId('builder-export-unavailable')).toBeInTheDocument();
    expect(screen.getByTestId('builder-export-hex')).toBeDisabled();
  });

  it('lists every schema field in wire order for the step-by-step section', () => {
    renderScreen();

    const rows = within(screen.getByTestId('builder-steps-table')).getAllByRole('row');
    // Başlık satırı + beş alan (address, command, payloadLength, payload, checksum).
    expect(rows).toHaveLength(6);
    expect(screen.getByTestId('builder-step-address')).toBeInTheDocument();
    expect(screen.getByTestId('builder-step-checksum')).toBeInTheDocument();
  });

  it('shows the raw frame and the wire bytes separately so post-processing stays visible', () => {
    renderScreen();
    fillSpecExample();

    fireEvent.change(selectById('builder-post-processing'), { target: { value: 'byteStuffing' } });

    // Ham çerçeve checksum'un hesaplandığı hâldir; kabloya çıkan bayt dizisi
    // kaçışlama sonrasıdır. İkisinin AYRI gösterilmesi §42'nin 8. maddesi.
    expect(screen.getByTestId('builder-steps-raw')).toHaveTextContent('AA052002024B6E55');
    expect(screen.getByTestId('builder-steps-framed')).toBeInTheDocument();
  });

  it('carries all thirteen spec §42 sections', () => {
    renderScreen();

    const sections = [
      'builder-doc-purpose',
      'builder-doc-protocols',
      'builder-doc-inputs',
      'builder-doc-example',
      'builder-doc-action',
      'builder-doc-result',
      'builder-doc-formula',
      'builder-doc-steps',
      'builder-doc-interpretation',
      'builder-doc-limits',
      'builder-doc-mistakes',
      'builder-doc-copy',
      'builder-doc-export',
    ];

    for (const testId of sections) {
      expect(screen.getByTestId(testId)).toBeInTheDocument();
    }
    expect(sections).toHaveLength(13);
  });

  it('states each real limitation instead of a generic disclaimer', () => {
    renderScreen();

    for (const testId of [
      'builder-limit-websocket',
      'builder-limit-single-owner',
      'builder-limit-checksum-order',
      'builder-limit-offset',
      'builder-limit-permission',
    ]) {
      expect(screen.getByTestId(testId)).toBeInTheDocument();
    }
  });

  it('keeps the spec §10 checksum typo on record under common mistakes', () => {
    renderScreen();

    expect(screen.getByTestId('builder-mistake-spec-checksum')).toBeInTheDocument();
  });

  it('offers the spec §9.6 schema and the §10 packet as copyable example data', () => {
    renderScreen();

    expect(screen.getByTestId('builder-example-packet')).toHaveTextContent('AA052002024B6E55');
    expect(screen.getByTestId('builder-example-schema')).toHaveTextContent('ALP Sensor Protocol');
  });

  it('exports the packet and its three code renderings as downloads', () => {
    renderScreen();
    fillSpecExample();

    fireEvent.click(screen.getByTestId('builder-export-hex'));
    fireEvent.click(screen.getByTestId('builder-export-c'));
    fireEvent.click(screen.getByTestId('builder-export-python'));
    fireEvent.click(screen.getByTestId('builder-export-javascript'));

    expect(holder.downloadTextFile).toHaveBeenCalledTimes(4);
    // `mock.calls` gevşek tipli; `unknown[][]`e daraltmak `any`yi teste sızdırmaz.
    const calls: unknown[][] = holder.downloadTextFile.mock.calls;
    expect(calls[0]?.[0]).toBe('packet.txt');
    expect(calls[0]?.[1]).toBe('AA052002024B6E55');
    expect(calls[1]?.[0]).toBe('packet.h');
    expect(String(calls[1]?.[1])).toContain('uint8_t packet[]');
    expect(calls[2]?.[0]).toBe('packet.py');
    expect(calls[3]?.[0]).toBe('packet.js');
  });

  it('surfaces a failed download instead of pretending it worked', () => {
    holder.downloadTextFile.mockImplementation(() => {
      throw new Error('no Blob URL support');
    });
    renderScreen();
    fillSpecExample();

    fireEvent.click(screen.getByTestId('builder-export-hex'));

    expect(screen.getByTestId('builder-export-error')).toHaveAttribute('role', 'alert');
  });

  it('connects the picked source and warns when it cannot write', async () => {
    const fake = createFakeSource(false);
    holder.createSimulatedSource.mockReturnValue(fake.source);
    renderScreen();

    await act(async () => {
      fireEvent.click(screen.getByTestId('builder-connect'));
    });

    expect(holder.createSimulatedSource).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(screen.getByTestId('builder-cannot-write')).toBeInTheDocument();
    });
    // Yazamayan kaynakta gönderim gerçekten çalışmaz — düğme de kapalı.
    expect(screen.getByTestId('builder-send')).toBeDisabled();
  });

  it('asks for a serial port only when the serial source is picked', async () => {
    const fake = createFakeSource(true);
    holder.requestSerialPort.mockResolvedValue({});
    holder.createSerialSource.mockReturnValue(fake.source);
    renderScreen();

    fireEvent.click(screen.getByTestId('builder-source-serial'));
    await act(async () => {
      fireEvent.click(screen.getByTestId('builder-connect'));
    });

    expect(holder.requestSerialPort).toHaveBeenCalledTimes(1);
    expect(holder.createSimulatedSource).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.getByTestId('builder-disconnect')).toBeInTheDocument();
    });
  });

  it('writes the built packet once when a writable source sends', async () => {
    const fake = createFakeSource(true);
    holder.requestSerialPort.mockResolvedValue({});
    holder.createSerialSource.mockReturnValue(fake.source);
    renderScreen();
    fillSpecExample();

    fireEvent.click(screen.getByTestId('builder-source-serial'));
    await act(async () => {
      fireEvent.click(screen.getByTestId('builder-connect'));
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('builder-send'));
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(fake.writes).toHaveLength(1);
    });
    expect(Array.from(fake.writes[0] ?? new Uint8Array(0))).toEqual([
      0xaa, 0x05, 0x20, 0x02, 0x02, 0x4b, 0x6e, 0x55,
    ]);
  });
});
