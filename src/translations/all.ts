/**
 * Bütün sözlükler, BÜTÜN namespace'leriyle — TEST ve ARAÇ yüzeyi.
 *
 * ## Neden `index.ts`te değil
 *
 * `index.ts` uygulamanın çalışma zamanı yüzeyidir; oraya statik bir
 * `import { en }` koymak, `en`i dinamik import etsek bile ilk boyaya taşırdı:
 * bir modül hem statik hem dinamik içe aktarıldığında paketleyici onu statik
 * chunk'a koyar ve dinamik dal aynı chunk'a bakar.
 *
 * Aynı gerekçe `protocol.*` namespace'i için de geçerli (bkz. `trProtocols.ts`).
 *
 * Ölçüm (2026-08-30): `tr` + `en` birlikte 1,4 MB ham / 379 kB gzip'ti;
 * bunun 536 kB'ı (%86) yalnız protokol sayfalarında okunan `protocol.*`
 * metinleriydi.
 *
 * Testlerin ve dil eşitliği denetiminin paket boyutu diye bir sorunu yok, o
 * yüzden onların girişi burasıdır — uygulama kodu buraya DOKUNMAZ.
 */

import { en } from './en';
import { enProtocols } from './enProtocols';
import type { Language, TranslationKey } from './index';
import { tr } from './tr';
import { trProtocols } from './trProtocols';

export const translations: Record<Language, Record<TranslationKey, string>> = {
  tr: { ...tr, ...trProtocols },
  en: { ...en, ...enProtocols },
};
