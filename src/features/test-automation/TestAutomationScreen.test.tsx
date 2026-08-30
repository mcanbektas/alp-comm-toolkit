import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { LANGUAGE_STORAGE_KEY, LanguageProvider } from '@/app/providers/LanguageProvider';
import { translations } from '@/translations/all';

import { TestAutomationScreen } from './TestAutomationScreen';
import { SCENARIO_STORAGE_KEY } from './useTestAutomation';

const tr = translations.tr;

/**
 * Koşu gerçek zamanlayıcılarla ilerler (simüle cihaz 20 ms gecikmeli yanıt
 * veriyor); sahte zamanlayıcı kurmak `streamBuffer`ın tick döngüsünü de
 * dondurur ve testin ölçtüğü şey kalmazdı.
 */
function renderScreen(): void {
  render(
    <LanguageProvider>
      <TestAutomationScreen />
    </LanguageProvider>,
  );
}

describe('TestAutomationScreen', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, 'tr');
  });

  it('boş açılmaz: §38 örneğinin adımları hazır gelir', () => {
    renderScreen();
    expect(screen.getByTestId('ta-name')).toHaveValue('Sıcaklık durum testi');
    expect(screen.getByTestId('ta-step-connect')).toBeInTheDocument();
    expect(screen.getByTestId('ta-step-crc')).toBeInTheDocument();
    expect(screen.getByTestId('ta-step-report')).toBeInTheDocument();
  });

  /**
   * WebSocket kaynağı (spec §8.1) TA'da da seçilebilir. Adres kutusu YALNIZ o
   * kaynakta görünür: simüle cihazda ve seri portta karşılığı yok.
   */
  it('WebSocket kaynağı seçilince adres kutusu çıkar', () => {
    renderScreen();
    expect(screen.queryByTestId('ta-websocket-url')).not.toBeInTheDocument();

    fireEvent.change(screen.getByTestId('ta-source'), { target: { value: 'websocket' } });

    expect(screen.getByTestId('ta-websocket-url')).toHaveValue('ws://localhost:8080');

    fireEvent.change(screen.getByTestId('ta-websocket-url'), {
      target: { value: 'ws://localhost:9099' },
    });
    expect(screen.getByTestId('ta-websocket-url')).toHaveValue('ws://localhost:9099');
  });

  it('varsayılan senaryo simüle cihazda GEÇER', async () => {
    renderScreen();
    fireEvent.click(screen.getByTestId('ta-run'));

    await waitFor(
      () => {
        expect(screen.getByTestId('ta-run-status')).toHaveTextContent(tr['testAutomation.runStatus.passed']);
      },
      { timeout: 5000 },
    );

    expect(screen.getByTestId('ta-fail-count')).toHaveTextContent('0');
    expect(screen.getByTestId('ta-pass-count')).toHaveTextContent('10');
  });

  it('eşiği düşürünce doğrulama adımı KALIR', async () => {
    renderScreen();
    // Fixture'ın sıcaklık baytı 0x34 = 52; eşiği 10'a çekmek testi düşürmeli.
    const limitRow = screen.getByTestId('ta-step-limit');
    const constant = limitRow.querySelector<HTMLInputElement>('[data-testid="step-limit-right-value"]');
    expect(constant).not.toBeNull();
    fireEvent.change(constant as HTMLInputElement, { target: { value: '10' } });

    fireEvent.click(screen.getByTestId('ta-run'));
    await waitFor(
      () => {
        expect(screen.getByTestId('ta-run-status')).toHaveTextContent(tr['testAutomation.runStatus.failed']);
      },
      { timeout: 5000 },
    );
    expect(screen.getByTestId('ta-fail-count')).toHaveTextContent('1');
  });

  it('adım ekler ve siler', () => {
    renderScreen();
    fireEvent.change(screen.getByTestId('ta-add-step'), { target: { value: 'log' } });
    expect(screen.getByTestId('ta-step-log-1')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('ta-remove-log-1'));
    expect(screen.queryByTestId('ta-step-log-1')).not.toBeInTheDocument();
  });

  it('senaryoyu tarayıcı deposuna yazar', () => {
    renderScreen();
    fireEvent.change(screen.getByTestId('ta-name'), { target: { value: 'yeni ad' } });
    const stored = window.localStorage.getItem(SCENARIO_STORAGE_KEY);
    expect(stored).not.toBeNull();
    expect(JSON.parse(stored ?? '{}')).toMatchObject({ name: 'yeni ad' });
  });

  it('geçersiz senaryoda Çalıştır kapanır', () => {
    renderScreen();
    fireEvent.change(screen.getByTestId('ta-name'), { target: { value: '  ' } });
    expect(screen.getByTestId('ta-run')).toBeDisabled();
    expect(screen.getByTestId('ta-scenario-issues')).toHaveTextContent('senaryo adı boş');
  });

  it('döngü adımı çocuklarını girintili basar', () => {
    renderScreen();
    fireEvent.change(screen.getByTestId('ta-add-step'), { target: { value: 'loop' } });
    expect(screen.getByTestId('ta-step-loop-1')).toBeInTheDocument();
    // Varsayılan döngü boş doğmaz — `validateScenario` boş döngüyü reddediyor.
    expect(screen.getByTestId('ta-step-loop-1-log')).toBeInTheDocument();
    expect(screen.getByTestId('ta-add-loop-1-steps')).toBeInTheDocument();
  });
});
