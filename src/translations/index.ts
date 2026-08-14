import { en } from './en';
import { tr } from './tr';

export type { TranslationDictionary } from './tr';

/** Desteklenen diller. Yeni dil eklemek = burayı ve `translations` kaydını genişletmek. */
export type Language = 'tr' | 'en';

/** Arayüz varsayılanı Türkçe (spec §4). */
export const DEFAULT_LANGUAGE: Language = 'tr';

/**
 * Dil seçici bunun sırasına göre çizilir. `Record<Language, …>` zaten eksik dili
 * derleme hatasına çevirdiği için bu dizi yalnız SIRA bilgisi taşır.
 */
export const LANGUAGES: readonly Language[] = ['tr', 'en'];

/**
 * Uygulamadaki her metnin anahtarı. `tr` kaynak sözlük olduğu için union da
 * ondan türer — `en`e yanlışlıkla fazladan anahtar eklense bile burada görünmez.
 */
export type TranslationKey = keyof typeof tr;

export const translations: Record<Language, Record<TranslationKey, string>> = { tr, en };

/**
 * `{name}` biçimindeki yer tutucular. `\w+` bilinçli olarak dar: boşluk, nokta
 * ya da tire içeren adlar (ör. `{frame.id}`, `{crc-16}`) yer tutucu sayılmaz.
 * Eşleşse bile karşılığı olmayan ad olduğu gibi kalır — aşağıya bak.
 */
const PLACEHOLDER_PATTERN = /\{(\w+)\}/g;

/**
 * Şablondaki yer tutucuları doldurur.
 *
 * TUZAK — karşılığı olmayan yer tutucu OLDUĞU GİBİ bırakılır, boş string'e
 * çevrilmez: "3 protokol" yerine " protokol" basmak hatayı gözden kaçırır,
 * "{count} protokol" basmak ise ekranda hemen göze batar.
 *
 * `PLACEHOLDER_PATTERN` modül düzeyinde ve `g` bayraklı; yalnız `replace` ile
 * kullanılabilir. `test`/`exec` `lastIndex`i taşıdığı için çağrılar arasında
 * sonucu bozardı.
 */
export function interpolate(
  template: string,
  vars?: Readonly<Record<string, string | number>>,
): string {
  if (vars === undefined) return template;
  return template.replace(PLACEHOLDER_PATTERN, (match: string, name: string): string => {
    const value = vars[name];
    return value === undefined ? match : String(value);
  });
}

/**
 * Bir metnin sözlükte karşılığı olup olmadığını söyler.
 *
 * Neden gerekli: `protocol-core` altındaki çözümleyiciler saf TypeScript'tir ve
 * yerelleştirilmiş metin üretemezler; `ParsedField.warnings` ve
 * `ProtocolWarning.message` alanlarına ÇEVİRİ ANAHTARI koyup çeviriyi arayüze
 * bırakırlar. Arayüz de anahtarı körlemesine `t()`'ye veremez: sözleşme (spec §7)
 * o alanları düz metin olarak tanımlıyor, yani anahtar olmayan bir metin de
 * gelebilir. Ölçüldü (2026-08-14): Modbus çözümleme sekmesinde uyarı satırı
 * ekranda ham `protocol.modbus.rtu.warning.roleInferredRequest` olarak göründü.
 */
export function isTranslationKey(value: string): value is TranslationKey {
  return Object.hasOwn(tr, value);
}

/** Dışarıdan gelen (localStorage, URL, navigator) değeri güvenle daraltır. */
export function isLanguage(value: unknown): value is Language {
  return typeof value === 'string' && (LANGUAGES as readonly string[]).includes(value);
}

/**
 * BCP 47 etiketini desteklenen bir dile eşler: `en-GB` → `en`, `tr-TR` → `tr`.
 * Eşleşme yoksa `undefined` — çağıran varsayılana düşmeye kendi karar verir.
 */
export function matchLanguageTag(tag: string): Language | undefined {
  const primary = tag.toLowerCase().split('-')[0];
  return primary !== undefined && isLanguage(primary) ? primary : undefined;
}

/** Tanınmayan her girdi varsayılana düşer; çağıranın try/catch yazmasına gerek kalmaz. */
export function resolveLanguage(value: unknown): Language {
  return isLanguage(value) ? value : DEFAULT_LANGUAGE;
}
