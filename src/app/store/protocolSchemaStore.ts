import { create } from 'zustand';

// Yalnız TİP alınıyor: `projectFile` saf bir biçim tanımı, store onu çalışma
// zamanında çağırmaz. Ters yön de yok (projectFile hiçbir şey içe aktarmıyor),
// yani döngü kurulamaz. Panel derin yoldan değil barrel'dan içe aktarılırdı;
// store bilerek `./projectFile`a bakar, `features/projects` barrel'ına değil —
// barrel bileşeni de taşıdığı için store React'e bağlanırdı.
import type { PacketTemplate, ProjectPayload } from '@/features/projects/projectFile';
import { readStoredScenarioJson, writeStoredScenarioJson } from '@/features/test-automation/scenarioStorage';
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

/**
 * Paket şablonları AYRI anahtarda tutulur, şemanın yanına gömülmez: şema her
 * tuş vuruşunda yeniden yazılıyor (bkz. `writeStoredSchemaJson`), şablonlar ise
 * seyrek değişir. Tek kayıtta olsalardı her tuş vuruşu bütün şablon listesini
 * de yeniden serileştirirdi ve kota dolduğunda ikisi birden kaybolurdu.
 */
export const PACKET_TEMPLATES_STORAGE_KEY = 'alp-comm-packet-templates';

export interface ProtocolSchemaState {
  readonly schemaJson: string;
  /** Packet Builder'da kaydedilmiş form değerleri; proje dosyasının ikinci yarısı. */
  readonly packetTemplates: readonly PacketTemplate[];
  readonly setSchemaJson: (json: string) => void;
  readonly resetSchema: () => void;
  /** Kimliği store üretir; çağıran ad, şema adı ve değerleri verir. */
  readonly savePacketTemplate: (
    name: string,
    schemaName: string,
    values: Record<string, string>,
  ) => void;
  readonly removePacketTemplate: (id: string) => void;
  /** Yüklenen proje dosyasını store'a uygular — şema ve şablonların ikisini de. */
  readonly applyProject: (payload: ProjectPayload) => void;
  /** Store'un o anki hâlinden proje gövdesi kurar. `savedAt` ÇAĞIRANDAN gelir. */
  readonly buildProjectPayload: (name: string, savedAt: string) => ProjectPayload;
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

// --- Paket şablonları ------------------------------------------------------

const EMPTY_TEMPLATES: readonly PacketTemplate[] = [];

/**
 * Kimlik öneki + ARTAN SAYAÇ, `crypto.randomUUID` değil.
 *
 * Şablon kimliği yalnız listede satır ayırmaya yarıyor; küresel benzersizlik
 * gerekmiyor. Rastgele kimlik ise her testi ya kimliği görmezden gelmeye ya
 * `crypto`yu sahtelemeye zorlardı. Sayaç modül düzeyinde: store'un yaşam
 * süresince artar, sayfa yenilenince sıfırlanır — bu yüzden depodan gelen
 * kimlikler sayacı İLERİ İTER (bkz. `adoptTemplateCounter`).
 */
const TEMPLATE_ID_PREFIX = 'packet-template-';

let templateCounter = 0;

function nextTemplateId(): string {
  templateCounter += 1;
  return `${TEMPLATE_ID_PREFIX}${templateCounter}`;
}

/**
 * Dışarıdan gelen (depo ya da proje dosyası) kimlikleri sayacın üstüne çeker.
 * Yapılmasaydı yeniden yüklenmiş bir listeye eklenen ilk şablon `…-1` alır ve
 * var olan bir satırla AYNI kimliği taşırdı; silme ikisini birden düşürürdü.
 */
function adoptTemplateCounter(templates: readonly PacketTemplate[]): void {
  for (const template of templates) {
    if (!template.id.startsWith(TEMPLATE_ID_PREFIX)) {
      continue;
    }
    const suffix = Number(template.id.slice(TEMPLATE_ID_PREFIX.length));
    if (Number.isInteger(suffix) && suffix > templateCounter) {
      templateCounter = suffix;
    }
  }
}

/** `Array.isArray` `unknown`ı `any[]`e daraltır; sarmalayıcı elemanları `unknown` bırakır. */
function isUnknownArray(value: unknown): value is readonly unknown[] {
  return Array.isArray(value);
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value !== '';
}

function isStringRecord(value: unknown): value is Record<string, string> {
  if (!isJsonObject(value)) return false;
  for (const entry of Object.values(value)) {
    if (typeof entry !== 'string') return false;
  }
  return true;
}

/**
 * Depodaki tek kaydı şablona daraltır.
 *
 * Doğrulama `projectFile.parseProjectFile`ta İKİNCİ KEZ yazılmış gibi
 * duruyor ama şekiller farklı: orada bir dosya biçimi (sürüm kapısı, hata
 * anahtarı, ayrıntı) doğrulanıyor, burada yalnız kendi yazdığımız bir kaydın
 * hâlâ okunabilir olup olmadığına bakılıyor ve hata bildirilmiyor. Store'u
 * dosya çözümleyicisine bağlamak, açılış yolunu proje biçimine bağımlı kılardı.
 */
function toPacketTemplate(value: unknown): PacketTemplate | undefined {
  if (!isJsonObject(value)) return undefined;
  if (!isNonEmptyString(value['id'])) return undefined;
  if (!isNonEmptyString(value['name'])) return undefined;
  if (!isNonEmptyString(value['schemaName'])) return undefined;
  if (!isStringRecord(value['values'])) return undefined;

  return {
    id: value['id'],
    name: value['name'],
    schemaName: value['schemaName'],
    values: value['values'],
  };
}

/**
 * Bozuk KAYIT düşürülür, bozuk LİSTE tamamen bırakılır. Tek bir satır yüzünden
 * kullanıcının bütün şablonlarını silmek, kurtarılabilir bir kaydı kurtarmamak
 * demekti; kökün kendisi dizi bile değilse kurtarılacak bir şey yok.
 */
function readStoredPacketTemplates(): readonly PacketTemplate[] {
  if (typeof window === 'undefined') return EMPTY_TEMPLATES;
  try {
    const raw = window.localStorage.getItem(PACKET_TEMPLATES_STORAGE_KEY);
    if (raw === null || raw === '') return EMPTY_TEMPLATES;

    const decoded: unknown = JSON.parse(raw);
    if (!isUnknownArray(decoded)) return EMPTY_TEMPLATES;

    const templates: PacketTemplate[] = [];
    for (const entry of decoded) {
      const template = toPacketTemplate(entry);
      if (template !== undefined) {
        templates.push(template);
      }
    }
    return templates;
  } catch {
    return EMPTY_TEMPLATES;
  }
}

function writeStoredPacketTemplates(templates: readonly PacketTemplate[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(PACKET_TEMPLATES_STORAGE_KEY, JSON.stringify(templates));
  } catch {
    // Kota dolu ya da depolama kapalı: şablonlar yalnız bu oturum boyunca yaşar.
  }
}

// Açılış okuması modül yüklenirken BİR KEZ; sayaç da o an geri yüklenenlerin
// üstüne çekilir.
const INITIAL_TEMPLATES = readStoredPacketTemplates();
adoptTemplateCounter(INITIAL_TEMPLATES);

export const useProtocolSchemaStore = create<ProtocolSchemaState>()((set, get) => ({
  // Depo okuması modül yüklenirken BİR KEZ yapılır. Store'un dışarıdan
  // yeniden okunacak bir yolu yok; başka bir sekmenin yazdığı değer bu sekmeye
  // yansımaz (`storage` olayı bilerek dinlenmiyor — iki sekmede iki farklı
  // şema üzerinde çalışmak meşru bir kullanım).
  schemaJson: readStoredSchemaJson(),

  packetTemplates: INITIAL_TEMPLATES,

  setSchemaJson: (json) => {
    writeStoredSchemaJson(json);
    set({ schemaJson: json });
  },

  resetSchema: () => {
    clearStoredSchemaJson();
    set({ schemaJson: SPEC_SENSOR_PROTOCOL_JSON });
  },

  /**
   * Şemanın aksine BURADA içerik denetleniyor: adı ya da şema adı boş bir
   * şablon listeye girerse bir sonraki açılışta okuma tarafı onu düşürür ve
   * kullanıcı kaydettiğini sandığı satırı SESSİZCE kaybeder. Yarım JSON'un
   * saklanması meşru bir ara durumdu; adsız şablonun değil.
   */
  savePacketTemplate: (name, schemaName, values) => {
    const trimmedName = name.trim();
    if (trimmedName === '' || schemaName === '') {
      return;
    }
    const template: PacketTemplate = {
      id: nextTemplateId(),
      name: trimmedName,
      schemaName,
      // Kopya: `values` çağıranın React state'i olabilir ve sonraki tuş
      // vuruşunda değişirse kaydedilmiş şablon da onunla birlikte kayardı.
      values: { ...values },
    };
    const next = [...get().packetTemplates, template];
    writeStoredPacketTemplates(next);
    set({ packetTemplates: next });
  },

  removePacketTemplate: (id) => {
    const current = get().packetTemplates;
    const next = current.filter((template) => template.id !== id);
    if (next.length === current.length) {
      // Bilinmeyen kimlik: depoya dokunmuyoruz. Aynı listeyi yeniden yazmak
      // abonelere sahte bir değişiklik bildirirdi.
      return;
    }
    writeStoredPacketTemplates(next);
    set({ packetTemplates: next });
  },

  /**
   * Proje dosyasını store'a uygular.
   *
   * Yalnız `protocols[0]` yükleniyor: store TEK bir şema tutuyor (bkz. dosya
   * başı), dosya biçimi ise liste taşıyor. Kalanını sessizce düşürmek, hangi
   * şemanın Builder'a gideceğini kullanıcıya sordurmaktan iyi — dosyayı yazan
   * da bugün tek şema koyuyor. Liste boşsa şemaya HİÇ dokunulmaz; boş metin
   * yazmak kullanıcının o anki tanımını silerdi.
   */
  applyProject: (payload) => {
    const templates = [...payload.packetTemplates];
    adoptTemplateCounter(templates);
    writeStoredPacketTemplates(templates);

    // §40 39513'ün "Test scenarios" yuvası. Yalnız ilki uygulanıyor: Test
    // Automation ekranı da tek senaryo tutuyor (`scenarioStorage.ts`), aynı
    // gerekçe `protocols[0]`daki gibi. Geçersiz metin depoya YAZILMAZ —
    // kullanıcının çalışan senaryosunu bozuk bir kayıtla değiştirmek, hiç
    // yüklememekten kötüdür.
    const [firstScenario] = payload.testScenarios ?? [];
    if (firstScenario !== undefined) writeStoredScenarioJson(firstScenario);

    const [firstProtocol] = payload.protocols;
    if (firstProtocol === undefined) {
      set({ packetTemplates: templates });
      return;
    }
    writeStoredSchemaJson(firstProtocol);
    set({ schemaJson: firstProtocol, packetTemplates: templates });
  },

  /**
   * `savedAt` ÇAĞIRANDAN gelir; store `new Date()` çağırmaz. Çağırsaydı bu
   * fonksiyon saf olmaktan çıkar ve testi ya saati sahtelemeye ya çıktının bir
   * parçasını görmezden gelmeye zorlardı (`projectFile` de aynı gerekçeyle
   * damgayı üretmiyor).
   */
  buildProjectPayload: (name, savedAt) => {
    const scenarioJson = readStoredScenarioJson();
    return {
      name,
      savedAt,
      protocols: [get().schemaJson],
      packetTemplates: get().packetTemplates,
      // Kayıt yoksa alan HİÇ yazılmaz; boş dizi, "senaryosu silinmiş proje"
      // ile "senaryosu hiç olmamış proje"yi aynı gösterirdi.
      ...(scenarioJson === undefined ? {} : { testScenarios: [scenarioJson] }),
    };
  },
}));
