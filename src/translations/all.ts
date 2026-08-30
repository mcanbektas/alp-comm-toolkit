/**
 * Bütün sözlükler tek nesnede — TEST ve ARAÇ yüzeyi.
 *
 * ## Neden `index.ts`te değil
 *
 * `index.ts` uygulamanın çalışma zamanı yüzeyidir ve oraya statik bir
 * `import { en }` koymak, `en`i dinamik import etsek bile ilk boyaya taşırdı:
 * bir modül hem statik hem dinamik içe aktarıldığında paketleyici onu statik
 * chunk'a koyar, dinamik dal yalnız aynı chunk'a bakar.
 *
 * Ölçüm (2026-08-30): iki sözlük birlikte 1,4 MB ham / 379 kB gzip ve arayüz
 * Türkçe açıldığı için yarısı hiç okunmuyordu. Ayırma bunun içindir.
 *
 * Testler ve dil eşitliği denetimi iki sözlüğü de senkron istiyor; onların
 * paket boyutu diye bir sorunu yok, o yüzden giriş burası.
 */

import { en } from './en';
import type { Language, TranslationKey } from './index';
import { tr } from './tr';

export const translations: Record<Language, Record<TranslationKey, string>> = { tr, en };
