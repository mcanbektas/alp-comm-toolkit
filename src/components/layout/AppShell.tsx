import { useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import { Outlet } from 'react-router-dom';

import { useTranslation } from '@/app/providers/LanguageProvider';
import { useUiStore } from '@/app/store/uiStore';
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

  useEffect(() => {
    if (!isOverlay) return;
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setSidebarOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
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
          className={`min-w-0 flex-1 p-4 ${isOverlay ? 'overflow-hidden' : 'overflow-y-auto'}`}
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}
