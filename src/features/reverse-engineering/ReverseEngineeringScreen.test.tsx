import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { LANGUAGE_STORAGE_KEY, LanguageProvider } from '@/app/providers/LanguageProvider';
import { translations } from '@/translations';

import { ReverseEngineeringScreen } from './ReverseEngineeringScreen';

const tr = translations.tr;

/**
 * jsdom'da `Worker` yok; ekran bu yüzden `analyzeInWorker`ın ana-iş-parçacığı
 * yolunu koşturur. Adımlar makro göreve bölündüğü için sonuç ASENKRON gelir —
 * `waitFor` bu yüzden zorunlu, ekranı senkron beklemek yanlış olurdu.
 */
function renderScreen(): void {
  render(
    <LanguageProvider>
      <ReverseEngineeringScreen />
    </LanguageProvider>,
  );
}

async function analyze(): Promise<void> {
  fireEvent.click(screen.getByTestId('re-analyze'));
  await waitFor(() => {
    expect(screen.getByTestId('re-length-range')).toBeInTheDocument();
  });
}

describe('ReverseEngineeringScreen', () => {
  beforeEach(() => {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, 'tr');
  });

  it('boş açılmaz: girdi kutusu örnek dökümle gelir', () => {
    renderScreen();
    const input = screen.getByTestId('re-input');
    expect((input as HTMLTextAreaElement).value).toContain('AA AA 10 00 01 53 21');
  });

  it('analiz edilmeden sonuç bölümleri basılmaz', () => {
    renderScreen();
    expect(screen.queryByTestId('re-counters')).not.toBeInTheDocument();
    expect(screen.queryByTestId('re-clusters')).not.toBeInTheDocument();
  });

  it('varsayılan örnekte sabit başlığı, sayaç adayını ve checksum bölgesini bulur', async () => {
    renderScreen();
    await analyze();

    expect(screen.getByTestId('re-frame-count')).toHaveTextContent('4');
    expect(screen.getByTestId('re-length-range')).toHaveTextContent('7…7');

    // Ofset 4 spec 35060'ta artan sayaçtır; rol sütunu bunu etiketlemeli.
    const columns = screen.getByRole('grid', { name: tr['reverseEngineering.columns.label'] });
    expect(within(columns).getAllByText(tr['reverseEngineering.role.counter']).length).toBeGreaterThan(0);
    expect(within(columns).getAllByText(tr['reverseEngineering.role.constant']).length).toBeGreaterThan(0);

    expect(screen.getByTestId('re-counters')).toBeInTheDocument();
  });

  it('bozuk satırı satır numarasıyla bildirir ama analizi durdurmaz', async () => {
    renderScreen();
    fireEvent.change(screen.getByTestId('re-input'), {
      target: { value: 'AA AA 10 00 01 53 21\nZZ ZZ\nAA AA 10 00 02 61 38' },
    });
    await analyze();

    expect(screen.getByTestId('re-frame-count')).toHaveTextContent('2');
    expect(screen.getByTestId('re-issues')).toHaveTextContent('2');
  });

  it('akış modunda çerçeveleme alanını açar', () => {
    renderScreen();
    expect(screen.queryByTestId('re-framing')).not.toBeInTheDocument();
    fireEvent.change(screen.getByTestId('re-mode'), { target: { value: 'stream' } });
    expect(screen.getByTestId('re-framing')).toBeInTheDocument();
    expect(screen.getByTestId('re-framing-parameter')).toBeInTheDocument();
  });

  it('akış modunda yöntem parametresi olmayan yöntemde alan gizlenir', () => {
    renderScreen();
    fireEvent.change(screen.getByTestId('re-mode'), { target: { value: 'stream' } });
    fireEvent.change(screen.getByTestId('re-framing'), { target: { value: 'slip' } });
    expect(screen.queryByTestId('re-framing-parameter')).not.toBeInTheDocument();
  });

  it('§36 fark tablosu iki çerçeve arasındaki değişen baytı gösterir', async () => {
    renderScreen();
    await analyze();

    const diff = screen.getByTestId('re-diff');
    // Ofset 0-3 sabit; değişenler sayaç (4) ve checksum (5-6).
    expect(within(diff).queryByText('0')).not.toBeInTheDocument();
    expect(screen.getByTestId('re-diff-summary')).toHaveTextContent('3');
  });

  it('aynı çerçeve seçilirse fark tablosu yerine "birebir aynı" der', async () => {
    renderScreen();
    await analyze();

    fireEvent.change(screen.getByTestId('re-diff-right'), { target: { value: '0' } });
    expect(screen.getByText(tr['reverseEngineering.diff.identical'])).toBeInTheDocument();
  });
});
