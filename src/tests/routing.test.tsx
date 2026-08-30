import { fireEvent, render, screen } from '@testing-library/react';
import type { RenderResult } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';

import { findEntry } from '@/app/catalog';
import { LANGUAGE_STORAGE_KEY, LanguageProvider } from '@/app/providers/LanguageProvider';
import { ThemeProvider } from '@/app/providers/ThemeProvider';
import { AppRoutes } from '@/app/router/AppRouter';
import { translations } from '@/translations/all';

const MODBUS_RTU_PATH = 'industrial-automation/modbus/modbus-rtu';

/**
 * `AppRoutes` bilinçli olarak router'sız dışa veriliyor; burada `MemoryRouter`
 * ile bağlanıyor. `AppRouter`ı doğrudan render etmek testi jsdom'un adres
 * çubuğuna ve `BASE_URL`e bağlardı.
 */
function renderAt(path: string): RenderResult {
  return render(
    <ThemeProvider>
      <LanguageProvider>
        <MemoryRouter initialEntries={[path]}>
          <AppRoutes />
        </MemoryRouter>
      </LanguageProvider>
    </ThemeProvider>,
  );
}

beforeEach(() => {
  // jsdom'un `navigator.language` değeri İngilizce; dil provider'ı tarayıcıdan
  // tahmin ettiği için başlangıç dilini AÇIKÇA sabitlemek gerekiyor, yoksa
  // testler makinenin/ortamın diline göre oynar.
  window.localStorage.clear();
  window.localStorage.setItem(LANGUAGE_STORAGE_KEY, 'tr');
});

describe('routing', () => {
  it('renders the home page at the root path', () => {
    renderAt('/');
    expect(
      screen.getByRole('heading', { level: 1, name: translations.tr['home.heading'] }),
    ).toBeInTheDocument();
  });

  it('renders the protocol workspace for a valid protocol path', () => {
    const entry = findEntry(MODBUS_RTU_PATH);
    expect(entry).toBeDefined();

    renderAt(`/${MODBUS_RTU_PATH}`);
    expect(
      screen.getByRole('heading', { level: 1, name: entry?.protocol.name ?? '' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('tablist')).toBeInTheDocument();
  });

  it('falls back to the overview tab when the tab query is not part of the protocol', () => {
    renderAt(`/${MODBUS_RTU_PATH}?tab=not-a-tab`);
    expect(
      screen.getByRole('tab', { name: translations.tr['tab.overview'], selected: true }),
    ).toBeInTheDocument();
  });

  it('renders the not-found page for made-up paths', () => {
    renderAt('/not-a-real-domain/not-a-real-family/not-a-real-protocol');
    expect(
      screen.getByRole('heading', { level: 1, name: translations.tr['notFound.title'] }),
    ).toBeInTheDocument();
  });

  it('renders the not-found page for paths deeper than the catalog', () => {
    renderAt('/one/two/three/four');
    expect(
      screen.getByRole('heading', { level: 1, name: translations.tr['notFound.title'] }),
    ).toBeInTheDocument();
  });
});

describe('language switch', () => {
  it('swaps every visible string when the language button is pressed', async () => {
    renderAt('/');
    expect(
      screen.getByRole('heading', { level: 1, name: translations.tr['home.heading'] }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: translations.tr['lang.label'] }));

    // `find*` çünkü İngilizce sözlük kendi chunk'ında: seçim anında geçerli,
    // metinler sözlük inince değişiyor (bkz. `translations/all.ts`).
    expect(
      await screen.findByRole('heading', { level: 1, name: translations.en['home.heading'] }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { level: 1, name: translations.tr['home.heading'] }),
    ).not.toBeInTheDocument();
  });
});
