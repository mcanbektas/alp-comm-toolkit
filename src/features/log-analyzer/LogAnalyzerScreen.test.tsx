import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { LANGUAGE_STORAGE_KEY, LanguageProvider } from '@/app/providers/LanguageProvider';
import { translations } from '@/translations';

import { LogAnalyzerScreen } from './LogAnalyzerScreen';

const CANDUMP_LOG = [
  '(1637856000.100000) can0 123#DEADBEEF',
  '(1637856000.200000) can0 124#AABBCCDD',
  '(1637856000.300000) can1 123#0102',
].join('\n');

/**
 * jsdom'un `File`ı `arrayBuffer()` taşımayabilir; hook dosyayı bu yolla okur.
 * Gerçek dosya nesnesine en yakın davranış, metni doğrudan bayta çevirmektir.
 */
function makeFile(name: string, content: string): File {
  const bytes = new TextEncoder().encode(content);
  const file = new File([content], name, { type: 'text/plain' });
  Object.defineProperty(file, 'arrayBuffer', {
    value: async () => bytes.buffer.slice(0, bytes.byteLength),
  });
  Object.defineProperty(file, 'size', { value: bytes.byteLength });
  return file;
}

function renderScreen(): void {
  render(
    <LanguageProvider>
      <LogAnalyzerScreen />
    </LanguageProvider>,
  );
}

async function loadLog(content: string, name = 'kayit.log'): Promise<void> {
  const input = screen.getByTestId('log-file');
  fireEvent.change(input, { target: { files: [makeFile(name, content)] } });
  await waitFor(() => {
    expect(screen.getByTestId('log-record-count')).toBeInTheDocument();
  });
}

describe('LogAnalyzerScreen', () => {
  beforeEach(() => {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, 'tr');
  });

  it('dosya açılmadan boş durumu gösterir ve tablo basmaz', () => {
    renderScreen();
    expect(screen.getByText(translations.tr['logAnalyzer.source.empty'])).toBeInTheDocument();
    expect(screen.queryByTestId('log-timeline')).not.toBeInTheDocument();
  });

  it('candump dosyasını okur, biçimi saptar ve kayıtları listeler', async () => {
    renderScreen();
    await loadLog(CANDUMP_LOG);

    expect(screen.getByTestId('log-record-count')).toHaveTextContent('3');
    expect(screen.getByTestId('log-detected-format')).toHaveTextContent(
      translations.tr['logAnalyzer.format.candump'],
    );

    const table = screen.getByRole('grid', { name: translations.tr['logAnalyzer.table.label'] });
    expect(within(table).getAllByRole('row')).toHaveLength(3);
    expect(within(table).getByText('DE AD BE EF')).toBeInTheDocument();
  });

  it('hex filtresi listeyi daraltır ve sayaç bunu yazar', async () => {
    renderScreen();
    await loadLog(CANDUMP_LOG);

    fireEvent.change(screen.getByTestId('log-filter-hex'), { target: { value: 'AABB' } });

    await waitFor(() => {
      expect(screen.getByTestId('log-filter-result')).toHaveTextContent('1 / 3');
    });
    const table = screen.getByRole('grid', { name: translations.tr['logAnalyzer.table.label'] });
    expect(within(table).getAllByRole('row')).toHaveLength(1);
  });

  it('kanal filtresi seçenekleri filtre uygulandıktan sonra da tam kalır', async () => {
    renderScreen();
    await loadLog(CANDUMP_LOG);

    const channelSelect = screen.getByLabelText(translations.tr['logAnalyzer.filter.channel']);
    fireEvent.change(channelSelect, { target: { value: 'can1' } });

    await waitFor(() => {
      expect(screen.getByTestId('log-filter-result')).toHaveTextContent('1 / 3');
    });
    // Seçenekler kaynağın tamamından türediği için `can0` hâlâ seçilebilir.
    expect(within(channelSelect).getByRole('option', { name: /can0/ })).toBeInTheDocument();
  });

  it('satır seçilince ayrıntı paneli o kaydın baytlarını gösterir', async () => {
    renderScreen();
    await loadLog(CANDUMP_LOG);

    const table = screen.getByRole('grid', { name: translations.tr['logAnalyzer.table.label'] });
    fireEvent.click(within(table).getAllByRole('row')[1] as HTMLElement);

    await waitFor(() => {
      expect(screen.getByTestId('log-detail-protocol')).toBeInTheDocument();
    });
    expect(screen.queryByText(translations.tr['logAnalyzer.detail.empty'])).not.toBeInTheDocument();
  });

  it('okunamayan dosyada hatayı gösterir, ekranı çökertmez', async () => {
    renderScreen();
    const input = screen.getByTestId('log-file');
    fireEvent.change(input, { target: { files: [makeFile('bos.log', 'sadece duz metin\nbaska metin')] } });

    await waitFor(() => {
      expect(screen.getByTestId('log-error')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('log-record-count')).not.toBeInTheDocument();
  });

  it('PCAPNG dosyasında yönlendirici hata mesajı verir', async () => {
    renderScreen();
    const bytes = new Uint8Array([0x0a, 0x0d, 0x0d, 0x0a, 0, 0, 0, 0]);
    const file = new File([bytes], 'yakalama.pcapng');
    Object.defineProperty(file, 'arrayBuffer', { value: async () => bytes.buffer });
    fireEvent.change(screen.getByTestId('log-file'), { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByTestId('log-error')).toHaveTextContent('PCAPNG');
    });
  });
});
