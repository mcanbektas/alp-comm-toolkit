import { useEffect, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import { Outlet, useLocation } from 'react-router-dom';

import { useTranslation } from '@/app/providers/LanguageProvider';
import { useUiStore } from '@/app/store/uiStore';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { Header } from './Header';
import { Sidebar } from './Sidebar';

/** Tailwind `lg` kırılımıyla AYNI değer olmak zorunda; ikisi ayrışırsa menü iki farklı gerçeğe göre çizilir. */
const DESKTOP_QUERY = '(min-width: 1024px)';

const SIDEBAR_ID = 'app-sidebar';

/**
 * jsdom ve eski tarayıcılarda `matchMedia` yok; yokluğunda "masaüstü değil"
 * varsayılır — dar düzen her ekranda çalışır, geniş düzen dar ekranda çalışmaz.
 */
function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState<boolean>(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
    return window.matchMedia(DESKTOP_QUERY).matches;
  });

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const query = window.matchMedia(DESKTOP_QUERY);
    const handleChange = (event: MediaQueryListEvent): void => {
      setIsDesktop(event.matches);
    };
    query.addEventListener('change', handleChange);
    return () => {
      query.removeEventListener('change', handleChange);
    };
  }, []);

  return isDesktop;
}

export function AppShell(): ReactElement {
  const { t } = useTranslation();
  const isDesktop = useIsDesktop();
  const location = useLocation();
  const sidebarRef = useRef<HTMLElement>(null);
  const sidebarOpen = useUiStore((state) => state.sidebarOpen);
  const setSidebarOpen = useUiStore((state) => state.setSidebarOpen);
  const toggleSidebar = useUiStore((state) => state.toggleSidebar);

  // Kırılım noktası her DEĞİŞTİĞİNDE menü o genişliğin varsayılanına döner:
  // masaüstünde açık, mobilde kapalı. Kullanıcının aradaki elle seçimi
  // korunur — effect yalnız `isDesktop` değiştiğinde koşar, her render'da değil.
  useEffect(() => {
    setSidebarOpen(isDesktop);
  }, [isDesktop, setSidebarOpen]);

  const isOverlay = sidebarOpen && !isDesktop;

  /**
   * Overlay menü açıkken odak yönetimi. Üç parça da gerekli, biri eksik olursa
   * klavye kullanıcısı görünmeyen bir menüde ya da menünün arkasında dolaşır:
   * Escape kapatır, açılışta odak menüye taşınır, kapanışta çağıran düğmeye döner.
   * `main`in `inert` olması arkadaki içeriğin Tab sırasından çıkmasını sağlar.
   */
  useEffect(() => {
    if (!isOverlay) return;

    const previouslyFocused = document.activeElement;
    sidebarRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setSidebarOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (previouslyFocused instanceof HTMLElement && previouslyFocused.isConnected) {
        previouslyFocused.focus();
      }
    };
  }, [isOverlay, setSidebarOpen]);

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-bg text-text">
      {/* Odaklanana kadar görünmez; `sr-only`yi geri almak için focus varyantı şart. */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-token-sm focus:bg-accent focus:px-3 focus:py-2 focus:text-sm focus:text-on-accent"
      >
        {t('app.skipToContent')}
      </a>

      <Header sidebarId={SIDEBAR_ID} isSidebarOpen={sidebarOpen} onToggleSidebar={toggleSidebar} />

      <div className="relative flex min-h-0 flex-1">
        {isOverlay && (
          <div
            aria-hidden="true"
            onClick={() => {
              setSidebarOpen(false);
            }}
            className="absolute inset-0 z-30 bg-bg/70"
          />
        )}

        {/* Kapalıyken de DOM'da kalır: menü düğmesinin `aria-controls` hedefi
            kaybolursa ilişki koparılmış olur. */}
        <aside
          id={SIDEBAR_ID}
          ref={sidebarRef}
          // Overlay modunda programatik odak hedefi; Tab sırasına GİRMEZ (-1).
          tabIndex={isOverlay ? -1 : undefined}
          aria-label={t('nav.domains')}
          className={[
            'border-line bg-surface',
            sidebarOpen ? '' : 'hidden',
            isDesktop
              ? 'w-72 shrink-0 overflow-y-auto border-r'
              : 'absolute inset-y-0 left-0 z-40 w-72 max-w-[85vw] overflow-y-auto border-r shadow-xl',
          ].join(' ')}
        >
          <Sidebar
            onNavigate={() => {
              // Overlay modunda seçim menüyü kapatır; masaüstünde açık kalır.
              if (!isDesktop) setSidebarOpen(false);
            }}
          />
        </aside>

        <main
          id="main"
          // Atlama bağlantısının hedefi odaklanabilir olmalı: yoksa Safari ve
          // Firefox yalnız kaydırır, odak başta kalır ve sonraki Tab başa döner.
          tabIndex={-1}
          // Overlay açıkken arkadaki içerik Tab sırasından ve ekran okuyucudan çıkar.
          inert={isOverlay ? '' : undefined}
          className={`min-w-0 flex-1 p-4 focus-visible:outline-none ${isOverlay ? 'overflow-hidden' : 'overflow-y-auto'}`}
        >
          {/* Sınır Outlet'i sarar, kabuğu değil: bir sayfa çökerse başlık ve menü
              ayakta kalır, kullanıcı başka protokole geçebilir. `resetKey` rota
              yolu — gezinme hatayı kendiliğinden temizler. */}
          <ErrorBoundary resetKey={location.pathname}>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
