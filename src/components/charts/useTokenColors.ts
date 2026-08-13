/**
 * Tasarım token'ının o anki RENK DEĞERİNİ okur.
 *
 * Neden gerekli: grafik kütüphanesi çizgi rengini SVG *presentation attribute*
 * olarak basıyor (`stroke="…"`). CSS `var()` presentation attribute içinde
 * çözülmez — SVG değer dilbilgisi CSS değildir. Tailwind sınıfı vermek de
 * yetmiyor, çünkü sınıf sarmalayıcı `<g>` üzerine iner, çizginin kendisi ise
 * kendi `stroke` attribute'unu taşır ve miras almaz.
 *
 * Bu yüzden token değeri çalışma zamanında hesaplanmış stilden okunur. Tema
 * `data-theme` attribute'uyla ya da `prefers-color-scheme` ile değiştiğinde
 * yeniden okunur; yoksa koyu temaya geçen kullanıcının grafiği açık tema
 * renklerinde kalırdı.
 *
 * Ham renk YAZILMIYOR (CLAUDE.md kuralı) — yalnız token adı veriliyor, değeri
 * yine tasarım paketinden geliyor.
 */

import { useCallback, useEffect, useState } from 'react';

/** Token okunamadığında (SSR, jsdom) çizgi yine görünür kalsın diye. */
const FALLBACK_COLOR = 'currentColor';

function readTokens(tokenNames: readonly string[]): string[] {
  if (typeof document === 'undefined' || typeof getComputedStyle !== 'function') {
    return tokenNames.map(() => FALLBACK_COLOR);
  }
  const computed = getComputedStyle(document.documentElement);
  return tokenNames.map((name) => {
    const value = computed.getPropertyValue(name).trim();
    return value === '' ? FALLBACK_COLOR : value;
  });
}

export function useTokenColors(tokenNames: readonly string[]): string[] {
  const key = tokenNames.join('|');

  const [colors, setColors] = useState<string[]>(() => readTokens(tokenNames));

  const refresh = useCallback(() => {
    setColors(readTokens(key.split('|')));
  }, [key]);

  useEffect(() => {
    refresh();

    if (typeof document === 'undefined') {
      return;
    }

    const observer = new MutationObserver(refresh);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    // `data-theme` yokken tema işletim sisteminden gelir; o değişimi attribute
    // gözlemcisi görmez.
    const media =
      typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : undefined;
    media?.addEventListener('change', refresh);

    return () => {
      observer.disconnect();
      media?.removeEventListener('change', refresh);
    };
  }, [refresh]);

  return colors;
}
