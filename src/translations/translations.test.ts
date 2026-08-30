import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { LANGUAGE_STORAGE_KEY, LanguageProvider, useTranslation } from '@/app/providers/LanguageProvider';
import {
  DEFAULT_LANGUAGE,
  LANGUAGES,
  interpolate,
  isLanguage,
  matchLanguageTag,
  resolveLanguage,
} from '@/translations';
import { translations } from '@/translations/all';
import type { Language, TranslationKey } from '@/translations';

/**
 * Yer tutucu tarayıcısı: kaynaktaki `PLACEHOLDER_PATTERN`in KOPYASI değil,
 * bilerek bağımsız yazılmış ikinci bir okuma. İkisi aynı fonksiyonu paylaşsaydı
 * desendeki bir hata testte de aynen tekrarlanır ve görünmez olurdu.
 */
function placeholdersOf(text: string): ReadonlySet<string> {
  return new Set([...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1] ?? ''));
}

/**
 * `navigator.languages` jsdom'da salt okunur; örnek üstünde kendi özelliğini
 * tanımlayıp prototipteki getter'ı gölgeler, sonra geri alırız. `configurable`
 * olmadan ikinci çağrı atar — testler arası sızıntı burada başlar.
 */
/**
 * Aynı yardımcının ASENKRON ikizi. Gerekçe: `en` sözlüğü artık kendi
 * chunk'ında ve dil değişimi bir `import()` bekliyor (bkz. `translations/
 * all.ts`). Senkron sarmalla yazılan bir test, sözlük inmeden ölçüm yapardı.
 */
async function withBrowserLanguagesAsync(
  tags: readonly string[],
  run: () => Promise<void>,
): Promise<void> {
  const descriptor = Object.getOwnPropertyDescriptor(window.navigator, 'languages');
  Object.defineProperty(window.navigator, 'languages', { value: tags, configurable: true });
  try {
    await run();
  } finally {
    if (descriptor === undefined) {
      Reflect.deleteProperty(window.navigator, 'languages');
    } else {
      Object.defineProperty(window.navigator, 'languages', descriptor);
    }
  }
}

function withBrowserLanguages(tags: readonly string[], run: () => void): void {
  const descriptor = Object.getOwnPropertyDescriptor(window.navigator, 'languages');
  Object.defineProperty(window.navigator, 'languages', { value: tags, configurable: true });
  try {
    run();
  } finally {
    if (descriptor === undefined) {
      Reflect.deleteProperty(window.navigator, 'languages');
    } else {
      Object.defineProperty(window.navigator, 'languages', descriptor);
    }
  }
}

function renderTranslation() {
  return renderHook(() => useTranslation(), { wrapper: LanguageProvider });
}

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  document.documentElement.removeAttribute('lang');
});

describe('dictionaries', () => {
  const trKeys = Object.keys(translations.tr);
  const enKeys = Object.keys(translations.en);

  it('exposes every declared language', () => {
    for (const lang of LANGUAGES) {
      expect(translations[lang]).toBeDefined();
    }
    expect(LANGUAGES).toContain(DEFAULT_LANGUAGE);
    expect(DEFAULT_LANGUAGE).toBe('tr');
  });

  it('carries identical key sets in tr and en', () => {
    // Küme farkını iki yönlü raporla: hangi tarafın eksik olduğu tek bakışta görünsün.
    expect(enKeys.filter((key) => !trKeys.includes(key))).toEqual([]);
    expect(trKeys.filter((key) => !enKeys.includes(key))).toEqual([]);
    expect(enKeys).toHaveLength(trKeys.length);
  });

  it('has no empty or whitespace-only value in any language', () => {
    for (const lang of LANGUAGES) {
      const blank = Object.entries(translations[lang])
        .filter(([, value]) => value.trim() === '')
        .map(([key]) => key);
      expect(blank).toEqual([]);
    }
  });

  it('keeps the same placeholder set for a key across languages', () => {
    // "{count} alan" karşısında "domains" yazılırsa sayı ekrandan sessizce düşer;
    // bunu yakalayan tek yer burası.
    const mismatched = trKeys.filter((key) => {
      const typedKey = key as TranslationKey;
      const source = placeholdersOf(translations.tr[typedKey]);
      const target = placeholdersOf(translations.en[typedKey]);
      return source.size !== target.size || [...source].some((name) => !target.has(name));
    });
    expect(mismatched).toEqual([]);
  });

  it('covers the keys the shell depends on', () => {
    const required: readonly TranslationKey[] = [
      'app.title',
      'nav.home',
      'theme.toggle',
      'lang.label',
      'home.domainCount',
      'domain.protocolCount',
      'family.protocolCount',
      'protocol.plannedNotice',
      'tab.overview',
      'status.planned',
      'layer.multi-layer',
      'notFound.title',
      'common.copy',
    ];
    for (const key of required) {
      expect(trKeys).toContain(key);
    }
  });
});

describe('interpolate', () => {
  it('substitutes a placeholder with the supplied value', () => {
    expect(interpolate('{count} alan', { count: 8 })).toBe('8 alan');
  });

  it('substitutes every occurrence of the same placeholder', () => {
    expect(interpolate('{name} → {name}', { name: 'CAN' })).toBe('CAN → CAN');
  });

  it('keeps the placeholder verbatim when the variable is missing', () => {
    // TUZAK: boş string basmak hatayı gizler. Ekranda "{count} alan" görmek
    // çağrı yerindeki eksik değişkeni anında ele verir.
    expect(interpolate('{count} alan', {})).toBe('{count} alan');
    expect(interpolate('{count} alan')).toBe('{count} alan');
  });

  it('leaves non-placeholder braces untouched', () => {
    expect(interpolate('{frame.id} ve {crc-16}', { count: 1 })).toBe('{frame.id} ve {crc-16}');
  });

  it('does not carry regex state between calls', () => {
    // `PLACEHOLDER_PATTERN` modül düzeyinde ve `g` bayraklı; `lastIndex`
    // sızarsa ikinci çağrı ilk yer tutucuyu atlar.
    expect(interpolate('{a}{b}', { a: '1', b: '2' })).toBe('12');
    expect(interpolate('{a}{b}', { a: '1', b: '2' })).toBe('12');
  });
});

describe('language narrowing', () => {
  it('accepts supported codes and rejects everything else', () => {
    expect(isLanguage('tr')).toBe(true);
    expect(isLanguage('en')).toBe(true);
    expect(isLanguage('de')).toBe(false);
    expect(isLanguage(null)).toBe(false);
    expect(isLanguage(42)).toBe(false);
  });

  it('maps BCP 47 tags onto the primary subtag', () => {
    expect(matchLanguageTag('tr-TR')).toBe('tr');
    expect(matchLanguageTag('EN-GB')).toBe('en');
    expect(matchLanguageTag('de-DE')).toBeUndefined();
  });

  it('falls back to the default language for anything unrecognised', () => {
    expect(resolveLanguage('de')).toBe(DEFAULT_LANGUAGE);
    expect(resolveLanguage('')).toBe(DEFAULT_LANGUAGE);
    expect(resolveLanguage(undefined)).toBe(DEFAULT_LANGUAGE);
    expect(resolveLanguage({ lang: 'tr' })).toBe(DEFAULT_LANGUAGE);
    expect(resolveLanguage('en')).toBe('en');
  });
});

describe('LanguageProvider', () => {
  it('throws a named error when useTranslation runs outside the provider', () => {
    // React kendi kendine düşen ağacı `console.error` ile bildirir; burada hata
    // BEKLENEN olduğu için susturulur, yoksa gerçek uyarılar bu gürültüde kaybolur.
    const silenced = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      expect(() => renderHook(() => useTranslation())).toThrow(/LanguageProvider/);
    } finally {
      silenced.mockRestore();
    }
  });

  it('starts in Turkish when the browser asks for an unsupported language', () => {
    withBrowserLanguages(['de-DE'], () => {
      const { result } = renderTranslation();
      expect(result.current.lang).toBe('tr');
      expect(result.current.t('nav.home')).toBe('Ana sayfa');
    });
  });

  // Spec §4: arayüz başlangıçta Türkçe. Tarayıcı dili bilerek pazarlık edilmiyor —
  // yoksa `en-US` bir tarayıcı uygulamayı İngilizce açar ve kural sessizce çiğnenir.
  it('ignores the browser language on first visit and opens in the default language', () => {
    withBrowserLanguages(['en-GB', 'de'], () => {
      const { result } = renderTranslation();
      expect(result.current.lang).toBe(DEFAULT_LANGUAGE);
    });
  });

  it('prefers the stored choice over the browser language', () => {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, 'tr');
    withBrowserLanguages(['en-US'], () => {
      const { result } = renderTranslation();
      expect(result.current.lang).toBe('tr');
    });
  });

  it('falls back to the default language when the stored value is corrupt', () => {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, 'klingon');
    withBrowserLanguages(['en-US'], () => {
      const { result } = renderTranslation();
      expect(result.current.lang).toBe(DEFAULT_LANGUAGE);
    });
  });

  it('translates through the active dictionary and interpolates', () => {
    withBrowserLanguages(['tr-TR'], () => {
      const { result } = renderTranslation();
      expect(result.current.t('home.domainCount', { count: 8 })).toBe('8 alan');
      expect(result.current.t('home.domainCount')).toBe('{count} alan');
    });
  });

  it('switches dictionary, persists the choice and updates <html lang>', async () => {
    await withBrowserLanguagesAsync(['tr-TR'], async () => {
      const { result } = renderTranslation();
      expect(document.documentElement.lang).toBe('tr');

      act(() => {
        result.current.setLang('en');
      });

      // Seçim ANINDA geçerli; metinler sözlük İNİNCE değişir. İkisi ayrı
      // sorudur ve dinamik chunk'tan sonra ayrı zamanlarda cevaplanır.
      expect(result.current.lang).toBe('en');
      expect(document.documentElement.lang).toBe('en');
      expect(window.localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('en');
      await waitFor(() => {
        expect(result.current.t('nav.home')).toBe('Home');
      });
    });
  });

  it('does not persist a language that was only guessed from the browser', () => {
    // Tahmin kalıcılaşırsa kullanıcı hiç dokunmadan tercihi çakılır; sonradan
    // tarayıcı dilini değiştirse bile eski tahmin geri gelir.
    withBrowserLanguages(['en-US'], () => {
      renderTranslation();
      expect(window.localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBeNull();
    });
  });

  it('survives a localStorage that throws on read', () => {
    // Safari private/lockdown modunda `getItem` SecurityError atar. Dil tercihi
    // kritik veri değil: provider yine de açılmalı.
    const storage = window.localStorage;
    const failing: Pick<Storage, 'getItem' | 'setItem'> = {
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => {
        throw new Error('SecurityError');
      },
    };
    Object.defineProperty(window, 'localStorage', { value: failing, configurable: true });
    try {
      withBrowserLanguages(['de-DE'], () => {
        const { result } = renderTranslation();
        expect(result.current.lang).toBe(DEFAULT_LANGUAGE);
        act(() => {
          result.current.setLang('en');
        });
        expect(result.current.lang).toBe('en');
      });
    } finally {
      Object.defineProperty(window, 'localStorage', { value: storage, configurable: true });
    }
  });

  it('keeps the t identity stable while the language does not change', async () => {
    // `t` her render'da yeni referans olursa onu bağımlılık dizisine koyan her
    // `useMemo`/`useEffect` boşuna yeniden koşar.
    await withBrowserLanguagesAsync(['tr-TR'], async () => {
      const { result, rerender } = renderTranslation();
      const first = result.current.t;
      rerender();
      expect(result.current.t).toBe(first);

      act(() => {
        result.current.setLang('en');
      });
      // Kimlik SÖZLÜK değişince değişir, seçim anında değil: `t` artık dile
      // değil inen sözlüğe bağlı.
      await waitFor(() => {
        expect(result.current.t).not.toBe(first);
      });
    });
  });
});

/** Sözlük dışından gelen bir dilin tipi daralmadan kullanılamadığını gösterir. */
it('narrows an unknown language before indexing the dictionaries', () => {
  const fromUrl: unknown = 'fr';
  const lang: Language = resolveLanguage(fromUrl);
  expect(translations[lang]['app.title']).toBe('ALP Comm Toolkit');
});
