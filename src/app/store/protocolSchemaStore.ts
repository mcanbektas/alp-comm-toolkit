import { create } from 'zustand';

// Yalnız metin sabiti alınıyor. `specFixture` şema tipini `import type` ile
// çektiği için bu satır zod'u pakete TAŞIMAZ — barrel'dan uzak durma gerekçesi
// için bkz. src/protocol-core/index.ts.
import { SPEC_SENSOR_PROTOCOL_JSON } from '@/protocol-core/schemas/specFixture';

/**
 * Protocol Studio ile Packet Builder'ın PAYLAŞTIĞI protokol tanımı.
 *
 * Ekran-yerel state değil çünkü iki ekran arasında tek yönlü bir bağ var:
 * Studio yazar, Builder okur. İkisi ayrı rota olduğundan ortak bir React
 * ata bileşeni yok; state yukarı taşınamaz, bu yüzden küçük bir global store.
 *
 * ## Neden nesne değil, JSON METNİ saklanıyor
 *
 * 1. Store zod'a bağımlı olmamalı: `schemas/protocolSchema` bilerek ana
 *    barrel'ın dışında tutuluyor (zod ana paketi 239 → 309 kB yapıyor). Store
 *    kabuğun her yerinden içe aktarılacağından şemayı çözümlemesi bu maliyeti
 *    geri getirirdi. Doğrulama, ihtiyacı olan ekranın (Studio) işidir.
 * 2. §40'ın proje dosyası şemaları zaten METİN listesi olarak taşıyor; metin
 *    saklamak kaydet/yükle yolunda ileri geri dönüştürme gerektirmiyor.
 * 3. Studio'nun editörü yarım yazılmış JSON'u da göstermek zorunda; nesne
 *    saklansaydı geçersiz ara durumların temsili olmazdı.
 *
 * ## Gizlilik
 *
 * Protokol tanımı KULLANICI VERİSİDİR ve yereldedir: yalnız localStorage'a
 * yazılır, hiçbir uçtan sunucuya gönderilmez (spec §41, CLAUDE.md).
 */

/** localStorage anahtarı. Süitteki diğer SPA'larla çakışmasın diye `alp-comm-` önekli. */
export const PROTOCOL_SCHEMA_STORAGE_KEY = 'alp-comm-protocol-schema';

export interface ProtocolSchemaState {
  readonly schemaJson: string;
  readonly setSchemaJson: (json: string) => void;
  readonly resetSchema: () => void;
}

/**
 * Depodan gelen metin "en azından bir JSON nesnesi mi". Alan doğrulaması
 * DEĞİL — o zod'un işi. Buradaki tek amaç, bozulmuş ya da eski sürümden kalmış
 * bir kaydın uygulamayı açılışta kullanılamaz hâlde başlatmasını engellemek.
 * Dizi ve ilkel değerler de reddedilir: şema kökü her zaman bir nesnedir.
 */
function isWellFormedSchemaText(text: string): boolean {
  try {
    const decoded: unknown = JSON.parse(text);
    return typeof decoded === 'object' && decoded !== null && !Array.isArray(decoded);
  } catch {
    return false;
  }
}

/**
 * localStorage private/lockdown modunda ERİŞİMDE BİLE atabilir (Safari'de
 * `getItem` SecurityError verir), o yüzden okuma da yazma da try/catch içinde.
 * `typeof window` kontrolü SSR/worker bağlamı için: modül yüklenir yüklenmez
 * çalışan bir okuma bu ortamlarda ReferenceError verirdi.
 */
function readStoredSchemaJson(): string {
  if (typeof window === 'undefined') return SPEC_SENSOR_PROTOCOL_JSON;
  try {
    const raw = window.localStorage.getItem(PROTOCOL_SCHEMA_STORAGE_KEY);
    if (raw === null || raw === '') return SPEC_SENSOR_PROTOCOL_JSON;
    return isWellFormedSchemaText(raw) ? raw : SPEC_SENSOR_PROTOCOL_JSON;
  } catch {
    return SPEC_SENSOR_PROTOCOL_JSON;
  }
}

/**
 * Yazma İÇERİĞE BAKMAZ, okuma bakar — bu asimetri kasıtlı. Studio her tuş
 * vuruşunda yarım JSON gönderebilir; geçersiz diye yazmayı reddetmek, yeniden
 * yüklemede kullanıcının yarım kalan çalışmasını sessizce eski kayda
 * döndürürdü. Okumanın seçici olması ise açılışın her koşulda çalışmasını
 * garanti eder.
 */
function writeStoredSchemaJson(json: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(PROTOCOL_SCHEMA_STORAGE_KEY, json);
  } catch {
    // Kota dolu ya da depolama kapalı: şema yalnız bu oturum boyunca yaşar.
  }
}

/**
 * Sıfırlamada varsayılanı YAZMAK yerine kaydı SİLİYORUZ: böylece varsayılan
 * örnek ileride değişirse, sıfırlamış kullanıcı donmuş bir kopyaya değil yeni
 * varsayılana açılır.
 */
function clearStoredSchemaJson(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(PROTOCOL_SCHEMA_STORAGE_KEY);
  } catch {
    // Silinemedi: bir sonraki açılış eski kayda döner, ama bu oturum sıfırlanmıştır.
  }
}

export const useProtocolSchemaStore = create<ProtocolSchemaState>()((set) => ({
  // Depo okuması modül yüklenirken BİR KEZ yapılır. Store'un dışarıdan
  // yeniden okunacak bir yolu yok; başka bir sekmenin yazdığı değer bu sekmeye
  // yansımaz (`storage` olayı bilerek dinlenmiyor — iki sekmede iki farklı
  // şema üzerinde çalışmak meşru bir kullanım).
  schemaJson: readStoredSchemaJson(),

  setSchemaJson: (json) => {
    writeStoredSchemaJson(json);
    set({ schemaJson: json });
  },

  resetSchema: () => {
    clearStoredSchemaJson();
    set({ schemaJson: SPEC_SENSOR_PROTOCOL_JSON });
  },
}));
