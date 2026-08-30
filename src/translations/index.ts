import { tr } from './tr';
// TİP OLARAK: bu satır çalışma zamanında yok olur, chunk'ı çekmez.
import type { trProtocols } from './trProtocols';

export type { TranslationDictionary } from './tr';
/**
 * Varsayılan sözlük. Dışa AÇIK, çünkü ilk boya senkron bir sözlük istiyor ve
 * `tr` zaten ana pakete giriyor (spec §4: arayüz Türkçe açılır).
 */
export { tr } from './tr';

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
 * Uygulamadaki her metnin anahtarı. Türkçe sözlükler KAYNAK olduğu için union
 * da onlardan türer — `en`e yanlışlıkla fazladan anahtar eklense bile burada
 * görünmez.
 *
 * İki parçalı: çekirdek (`tr`) her zaman yüklü, protokol metinleri
 * (`trProtocols`) kendi chunk'ında ve TİP OLARAK içe aktarılıyor — `import
 * type` derlemede silinir, yani union'ı kurmak o 536 kB'ı ilk boyaya taşımaz.
 */
export type TranslationKey = keyof typeof tr | keyof typeof trProtocols;

/**
 * Yüklenmiş sözlükler. `tr` HER ZAMAN burada: varsayılan dil ilk boyada
 * gerekiyor (spec §4 "arayüz Türkçe açılır") ve onu da tembelleştirmek ekranı
 * boş bir kabukla açmak olurdu.
 */
type PartialDictionary = Partial<Record<TranslationKey, string>>;

/**
 * Yüklenmiş sözlük parçaları. `tr`nin ÇEKİRDEĞİ her zaman burada: varsayılan
 * dil ilk boyada gerekiyor (spec §4 "arayüz Türkçe açılır") ve onu da
 * tembelleştirmek ekranı boş bir kabukla açardı.
 *
 * Değerler PARÇALIDIR: protokol namespace'i inmeden önce `protocol.*`
 * anahtarları yoktur. Bu yüzden tip `Partial` — "her anahtar hazır" demek
 * yalan olurdu ve `t` içinde sessizce `undefined` basardı.
 */
const loadedDictionaries = new Map<Language, PartialDictionary>([['tr', { ...tr }]]);

/** Namespace inince ekranın yeniden çizilmesi için: provider buraya abone olur. */
const dictionaryListeners = new Set<() => void>();

export function subscribeToDictionaries(listener: () => void): () => void {
  dictionaryListeners.add(listener);
  return () => {
    dictionaryListeners.delete(listener);
  };
}

function mergeInto(lang: Language, part: PartialDictionary): PartialDictionary {
  const merged = { ...loadedDictionaries.get(lang), ...part };
  loadedDictionaries.set(lang, merged);
  for (const listener of dictionaryListeners) listener();
  return merged;
}

/** `protocol.*` namespace'i o dil için inmiş mi. */
export function hasProtocolStrings(lang: Language): boolean {
  return loadedProtocolNamespaces.has(lang);
}

const loadedProtocolNamespaces = new Set<Language>();
/** Çekirdek sözlüğü inmiş diller. `tr` statik geldiği için başlangıçta orada. */
const loadedCoreLanguages = new Set<Language>(['tr']);

/**
 * Protokol metinlerini indirir (bkz. `trProtocols.ts`). Çağrısı ROTALARIN lazy
 * sınırına bağlıdır (`AppRouter`): sayfa inerken sözlük de iner, böylece
 * ekranda ham anahtar görünen bir aralık oluşmaz.
 *
 * Aynı dil için ikinci çağrı ağa çıkmaz; `import()` zaten önbelleklidir ama
 * küme kontrolü birleştirme işini de atlatır.
 */
export async function loadProtocolStrings(lang: Language): Promise<void> {
  if (loadedProtocolNamespaces.has(lang)) return;

  switch (lang) {
    case 'tr': {
      const module = await import('./trProtocols');
      loadedProtocolNamespaces.add('tr');
      mergeInto('tr', module.trProtocols);
      return;
    }
    case 'en': {
      const module = await import('./enProtocols');
      loadedProtocolNamespaces.add('en');
      mergeInto('en', module.enProtocols);
      return;
    }
  }
}

/** Sözlük İNMİŞSE verir; inmediyse `undefined` — çağıran ne göstereceğine kendi karar verir. */
export function dictionaryFor(lang: Language): PartialDictionary | undefined {
  return loadedDictionaries.get(lang);
}

/**
 * Sözlüğü getirir; gerekiyorsa İNDİRİR. `en` dinamik `import()` ile gelir ve
 * kendi chunk'ına düşer — dil hiç değiştirilmezse o baytlar hiç inmez.
 *
 * `switch` bilerek exhaustive: yeni bir dil eklendiğinde derleyici burayı
 * gösterir, sessizce varsayılana düşen bir dal bırakmaz.
 */
export async function loadDictionary(lang: Language): Promise<PartialDictionary> {
  /**
   * Kontrol HARİTANIN VARLIĞINA değil ÇEKİRDEĞİN yüklü olmasına bakar.
   * Harita parçalı: `protocol.*` namespace'i çekirdekten ÖNCE inebilir (rota
   * lazy sınırı onu getiriyor). "Harita var" demek "çekirdek var" demek
   * olsaydı, protokol sayfasında dil değiştiren kullanıcı çekirdek metinleri
   * hiç indiremez ve ekranda ham anahtar görürdü — e2e turu tam bunu yakaladı.
   */
  const loaded = loadedDictionaries.get(lang);
  if (loadedCoreLanguages.has(lang) && loaded !== undefined) return loaded;

  switch (lang) {
    case 'tr':
      loadedCoreLanguages.add('tr');
      return mergeInto('tr', tr);
    case 'en': {
      const module = await import('./en');
      loadedCoreLanguages.add('en');
      const merged = mergeInto('en', module.en);
      // Dil değişiminde protokol metinleri de peşinden gelmeli: kullanıcı bir
      // protokol sayfasındayken dili değiştirdiyse o sayfanın metinleri yeni
      // dilde de gerekiyor ve rota lazy sınırı ikinci kez koşmaz.
      if (loadedProtocolNamespaces.size > 0) await loadProtocolStrings('en');
      return merged;
    }
  }
}

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
/**
 * ⚠️ YALNIZ YÜKLÜ namespace'lere bakar. Protokol metinleri kendi chunk'ında
 * olduğu için, o chunk inmeden `protocol.*` bir anahtar için `false` döner.
 *
 * Bugünkü çağıranların hepsi (tanım panelleri, `parseDiagnostics`) protokol
 * sayfalarında koşuyor ve o rotalar sözlüğü lazy sınırlarında bekletiyor
 * (`AppRouter`), yani pratikte namespace hep yüklü. Bunu bir değişmez sayan
 * yeni bir çağıran çıkarsa BURAYA bakmalı.
 */
export function isTranslationKey(value: string): value is TranslationKey {
  if (Object.hasOwn(tr, value)) return true;
  // HANGİ DİL yüklüyse ona bakılır, varsayılana değil: anahtar KÜMESİ iki dilde
  // aynı (derleyici zoruyla) ama arayüz İngilizce açıldığında Türkçe namespace
  // hiç inmez. Yalnız `tr`ye bakan bir sürüm, İngilizce oturumda her protokol
  // anahtarına "bu bir anahtar değil" der ve `parseDiagnostics` mesajı HAM
  // basardı — tarayıcı turu tam olarak bunu yakaladı.
  for (const dictionary of loadedDictionaries.values()) {
    if (Object.hasOwn(dictionary, value)) return true;
  }
  return false;
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
