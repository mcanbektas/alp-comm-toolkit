import type { ReactElement } from 'react';
import { Link } from 'react-router-dom';

import { useTranslation } from '@/app/providers/LanguageProvider';
import { useTheme } from '@/app/providers/ThemeProvider';
import { SearchBox } from '@/components/navigation/SearchBox';

export interface HeaderProps {
  /** Menü düğmesinin `aria-controls` hedefi — kenar çubuğu öğesinin id'si. */
  sidebarId: string;
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
}

export function Header({ sidebarId, isSidebarOpen, onToggleSidebar }: HeaderProps): ReactElement {
  const { t, lang, setLang } = useTranslation();
  const { resolvedTheme, setTheme } = useTheme();

  // Düğme, İÇİNDE BULUNULAN temayı değil GİDİLECEK temayı yazar; kullanıcı
  // etiketi bir eylem olarak okur. Erişilebilir ad `theme.toggle` ile sabit
  // kalır ki metin değişse de ekran okuyucudaki komut adı oynamasın.
  const nextTheme = resolvedTheme === 'dark' ? 'light' : 'dark';
  const nextLang = lang === 'tr' ? 'en' : 'tr';

  const buttonClass =
    'shrink-0 rounded-token-sm border border-line px-2 py-1.5 text-xs text-muted hover:bg-raised hover:text-text focus-visible:ring-2 focus-visible:ring-accent';

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface">
      <div className="flex items-center gap-2 px-3 py-2">
        <button
          type="button"
          aria-expanded={isSidebarOpen}
          aria-controls={sidebarId}
          aria-label={isSidebarOpen ? t('nav.closeMenu') : t('nav.openMenu')}
          onClick={onToggleSidebar}
          className={buttonClass}
        >
          <span aria-hidden="true">☰</span>
        </button>

        <Link
          to="/"
          className="min-w-0 rounded-token-sm px-1 focus-visible:ring-2 focus-visible:ring-accent"
        >
          <span className="block truncate font-display text-sm font-semibold text-text">
            {t('app.title')}
          </span>
          <span className="hidden truncate text-xs text-muted sm:block">{t('app.tagline')}</span>
        </Link>

        {/* Faz 4: süit ürün değiştirici (@mcanbektas/design) buraya gelecek. */}

        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            aria-label={t('theme.toggle')}
            onClick={() => {
              setTheme(nextTheme);
            }}
            className={buttonClass}
          >
            {nextTheme === 'dark' ? t('theme.dark') : t('theme.light')}
          </button>

          <button
            type="button"
            aria-label={t('lang.label')}
            onClick={() => {
              setLang(nextLang);
            }}
            className={buttonClass}
          >
            {nextLang === 'tr' ? t('lang.tr') : t('lang.en')}
          </button>
        </div>
      </div>

      {/* Arama kendi satırında: 360px'de başlık satırına sıkıştırmak ya kutuyu
          okunmaz daraltır ya da yatay kaydırma doğurur. */}
      <div className="px-3 pb-2">
        <div className="max-w-xl">
          <SearchBox />
        </div>
      </div>
    </header>
  );
}
