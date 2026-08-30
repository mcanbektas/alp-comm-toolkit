import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactElement, ReactNode } from 'react';
// `matchLanguageTag` bilerek kullanılmıyor — bkz. detectInitialLanguage yorumu.
import {
  DEFAULT_LANGUAGE,
  dictionaryFor,
  interpolate,
  loadDictionary,
  resolveLanguage,
  subscribeToDictionaries,
  tr,
} from '@/translations';
import type { Language, TranslationKey } from '@/translations';

/** localStorage anahtarı. Süit içindeki diğer SPA'larla çakışmaması için `alp-comm-` önekli. */
export const LANGUAGE_STORAGE_KEY = 'alp-comm-lang';

export interface LanguageContextValue {
  t: (key: TranslationKey, vars?: Readonly<Record<string, string | number>>) => string;
  lang: Language;
  setLang: (next: Language) => void;
}

/**
 * Varsayılan `null`: provider'sız kullanım "sessizce Türkçe göster" değil,
 * gürültülü hata olmalı — yoksa ağaçtan düşmüş bir bileşen fark edilmez.
 */
const LanguageContext = createContext<LanguageContextValue | null>(null);

/**
 * localStorage private/lockdown modunda ERİŞİMDE BİLE atabilir (Safari'de
 * `getItem` SecurityError verir), o yüzden okuma da yazma da try/catch içinde.
 * Dil tercihi kritik veri değil; kaybolursa varsayılana düşmek doğru davranış.
 */
function readStoredLanguage(): Language | undefined {
  try {
    const raw = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    return raw !== null && raw !== '' ? resolveLanguage(raw) : undefined;
  } catch {
    return undefined;
  }
}

function writeStoredLanguage(lang: Language): void {
  try {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
  } catch {
    // Kota dolu ya da depolama kapalı: tercih yalnız bu oturum boyunca yaşar.
  }
}

/**
 * İlk açılış dili. Sıra: kayıtlı tercih → varsayılan (tr).
 *
 * Tarayıcı dili BİLEREK pazarlık edilmiyor. Spec §4 "arayüz başlangıçta Türkçe"
 * diyor; `navigator.languages` okunsaydı `en-US` bir tarayıcı uygulamayı İngilizce
 * açardı ve bu kural sessizce çiğnenirdi. Tek istisna Türkçe'yi açıkça tercih eden
 * tarayıcıdır — o zaten varsayılana düşüyor, yani ek koda gerek yok.
 * Dil pazarlığı istenirse buradan tek fonksiyonla açılır.
 */
export function detectInitialLanguage(): Language {
  if (typeof window === 'undefined') return DEFAULT_LANGUAGE;

  const stored = readStoredLanguage();
  if (stored !== undefined) return stored;

  return DEFAULT_LANGUAGE;
}

export function LanguageProvider({ children }: { children: ReactNode }): ReactElement {
  // Başlangıç değeri lazy: localStorage ve navigator okuması her render'da değil,
  // yalnız ilk mount'ta yapılsın.
  const [lang, setLangState] = useState<Language>(detectInitialLanguage);
  /**
   * GÖSTERİLEN sözlük. `lang`den AYRI bir durum, çünkü ikisi bir an için
   * ayrışır: `en` kendi chunk'ında ve dil değişince indirilmesi gerekiyor.
   *
   * İnene kadar önceki sözlük durur — ekranı boşaltmak ya da anahtarları ham
   * basmak, yarım saniyelik bir indirme için ödenecek bedel değil. Açılışta
   * seçili dil `en` olsa bile ilk boya Türkçedir ve sözlük inince değişir;
   * varsayılan dili de tembelleştirmek uygulamayı boş bir kabukla açardı.
   */
  const [dictionary, setDictionary] = useState<Partial<Record<TranslationKey, string>>>(
    () => dictionaryFor(detectInitialLanguage()) ?? tr,
  );

  useEffect(() => {
    let cancelled = false;
    void loadDictionary(lang).then((loaded) => {
      // Kullanıcı dili tekrar değiştirdiyse geç gelen sözlük YAZILMAZ; yoksa
      // eski seçim yeni ekranın üstüne düşerdi (`DecodePanel`in aynı deseni).
      if (!cancelled) setDictionary(loaded);
    });

    /**
     * Sözlük parça parça büyüyor: rota lazy sınırı `protocol.*` namespace'ini
     * indirdiğinde bu bileşen HABERSİZ kalırsa ekran eski (eksik) sözlükle
     * çizili durur. Abonelik o yüzden var.
     */
    const unsubscribe = subscribeToDictionaries(() => {
      const current = dictionaryFor(lang);
      if (!cancelled && current !== undefined) setDictionary(current);
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [lang]);

  // `<html lang>` yalnız süs değil: ekran okuyucunun sesletimi ve tarayıcının
  // çeviri önerisi buna bakar.
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((next: Language): void => {
    // Yazma yalnız AÇIK seçimde; tarayıcıdan tahmin edilen dil kalıcılaştırılmaz,
    // yoksa kullanıcı hiç dokunmadan tercihi çakılı kalır.
    writeStoredLanguage(next);
    setLangState(next);
  }, []);

  const t = useCallback(
    (key: TranslationKey, vars?: Readonly<Record<string, string | number>>): string =>
      /**
       * Karşılığı olmayan anahtar ANAHTARIN KENDİSİYLE basılır. Bu bir yedek
       * çeviri değil, GÖRÜNÜR bir arıza: namespace'i beklemeden çizen bir rota
       * eklenirse ekranda `protocol.foo.bar` yazar ve hemen fark edilir. Boş
       * string basmak aynı hatayı görünmez kılardı.
       */
      interpolate(dictionary[key] ?? key, vars),
    [dictionary],
  );

  const value = useMemo<LanguageContextValue>(() => ({ t, lang, setLang }), [t, lang, setLang]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useTranslation(): LanguageContextValue {
  const context = useContext(LanguageContext);
  if (context === null) {
    throw new Error('useTranslation must be used inside a <LanguageProvider>.');
  }
  return context;
}
