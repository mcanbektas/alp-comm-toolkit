import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactElement, ReactNode } from 'react';

/**
 * Tema seçimi. `'system'` bir renk DEĞİL, "karar verme" demektir: bu durumda
 * `data-theme` attribute'u kaldırılır ve token dosyası `prefers-color-scheme`e
 * düşer. Attribute'a `"system"` yazmak yanlış olurdu — CSS tarafında böyle bir
 * tema yok, yalnız açık/koyu değişkenleri var.
 */
export type ThemeChoice = 'light' | 'dark' | 'system';

/** Ekranda gerçekten uygulanan tema; `'system'` burada çözülmüş hâliyle görünür. */
export type ResolvedTheme = 'light' | 'dark';

/** localStorage anahtarı — süitteki diğer SPA'larla çakışmasın diye `alp-comm-` önekli. */
export const THEME_STORAGE_KEY = 'alp-comm-theme';

const DARK_SCHEME_QUERY = '(prefers-color-scheme: dark)';

export interface ThemeContextValue {
  theme: ThemeChoice;
  setTheme: (next: ThemeChoice) => void;
  resolvedTheme: ResolvedTheme;
}

/**
 * Varsayılan `null`: provider'sız kullanım sessizce açık temaya düşmemeli,
 * gürültülü hata olmalı — yoksa ağaçtan düşmüş bileşen fark edilmez.
 */
const ThemeContext = createContext<ThemeContextValue | null>(null);

function isThemeChoice(value: unknown): value is ThemeChoice {
  return value === 'light' || value === 'dark' || value === 'system';
}

/**
 * localStorage private/lockdown modunda ERİŞİMDE BİLE atabilir (Safari'de
 * `getItem` SecurityError verir), o yüzden okuma da yazma da try/catch içinde.
 * Tema tercihi kritik veri değil; kaybolursa sisteme düşmek doğru davranış.
 */
function readStoredTheme(): ThemeChoice {
  try {
    const raw = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isThemeChoice(raw) ? raw : 'system';
  } catch {
    return 'system';
  }
}

function writeStoredTheme(theme: ThemeChoice): void {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Kota dolu ya da depolama kapalı: tercih yalnız bu oturum boyunca yaşar.
  }
}

/** jsdom ve eski tarayıcılarda `matchMedia` olmayabilir; yokluğunda açık tema varsayılır. */
function prefersDarkScheme(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia(DARK_SCHEME_QUERY).matches;
}

export function ThemeProvider({ children }: { children: ReactNode }): ReactElement {
  // Lazy başlangıç: localStorage okuması her render'da değil, yalnız ilk mount'ta.
  const [theme, setThemeState] = useState<ThemeChoice>(() =>
    typeof window === 'undefined' ? 'system' : readStoredTheme(),
  );
  const [systemPrefersDark, setSystemPrefersDark] = useState<boolean>(prefersDarkScheme);

  // Sistem tercihi tema 'system' olmasa da izlenir: kullanıcı seçimi 'system'e
  // döndüğünde doğru değerin hazır olması, bir kare yanlış renk basmaktan iyi.
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const query = window.matchMedia(DARK_SCHEME_QUERY);
    const handleChange = (event: MediaQueryListEvent): void => {
      setSystemPrefersDark(event.matches);
    };
    query.addEventListener('change', handleChange);
    return () => {
      query.removeEventListener('change', handleChange);
    };
  }, []);

  const resolvedTheme: ResolvedTheme =
    theme === 'system' ? (systemPrefersDark ? 'dark' : 'light') : theme;

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'system') {
      // Attribute'u BIRAKMAK değil KALDIRMAK gerekiyor: varlığı `prefers-color-scheme`
      // kuralını gölgeler ve sistem koyuya geçtiğinde sayfa açık kalırdı.
      delete root.dataset.theme;
    } else {
      root.dataset.theme = theme;
    }
  }, [theme]);

  const setTheme = useCallback((next: ThemeChoice): void => {
    writeStoredTheme(next);
    setThemeState(next);
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, setTheme, resolvedTheme }),
    [theme, setTheme, resolvedTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (context === null) {
    throw new Error('useTheme must be used inside a <ThemeProvider>.');
  }
  return context;
}
