/**
 * Türkçe KAYNAK sözlük. Uygulamanın tek gerçeğidir: yeni bir metin önce buraya
 * eklenir, `en.ts` derleyici zoruyla peşinden gelir.
 *
 * Anahtarlar bilerek DÜZ string'tir (`'home.heading'`), iç içe nesne değil.
 * Sebep: `keyof typeof tr` tek seviyeli literal union üretsin ki `t('home.hedaing')`
 * gibi bir yazım hatası derleme zamanında yakalansın. İç içe nesnede bu tip
 * güvencesi ancak elle yazılmış yol tipleriyle kurulabilirdi.
 *
 * `as const` şart: onsuz değerler `string`e genişler ve anahtar union'ı `string`
 * olur — o an tip güvencesinin tamamı kaybolur.
 *
 * Yer tutucu biçimi `{name}`. Aynı anahtarın Türkçesi ve İngilizcesi AYNI yer
 * tutucu kümesini taşımalı; testte doğrulanır.
 */
export const tr = {
  // --- Uygulama kabuğu ---
  'app.title': 'ALP Comm Toolkit',
  'app.tagline': 'Haberleşme protokollerini çözümleme ve geliştirme ortamı',
  'app.skipToContent': 'İçeriğe geç',

  // --- Gezinme ve arama ---
  'nav.home': 'Ana sayfa',
  'nav.domains': 'Alanlar',
  'nav.search': 'Ara',
  'nav.searchPlaceholder': 'Protokol, aile ya da alan ara…',
  'nav.searchHint': 'Aramayı açmak için / tuşuna basın',
  'nav.noResults': 'Eşleşen kayıt yok',
  'nav.resultCount': '{count} sonuç',
  'nav.closeMenu': 'Menüyü kapat',
  'nav.openMenu': 'Menüyü aç',

  // --- Tema ve dil anahtarları ---
  'theme.light': 'Açık',
  'theme.dark': 'Koyu',
  'theme.toggle': 'Temayı değiştir',
  'lang.label': 'Dil',
  'lang.tr': 'Türkçe',
  'lang.en': 'İngilizce',

  // --- Ana sayfa ---
  'home.heading': 'Haberleşme protokolleri çalışma ortamı',
  'home.intro':
    'Sekiz alan altında toplanan protokolleri inceleyin: çerçeve çözümleyin, telgraf kurun, zamanlama ve tanı verisini okuyun.',
  'home.domainCount': '{count} alan',
  'home.familyCount': '{count} aile',
  'home.protocolCount': '{count} protokol',
  'home.openDomain': 'Alanı aç',
  'home.exploreDomains': 'Alanları gözden geçir',

  // --- Alan sayfası ---
  'domain.familyCount': '{count} aile',
  'domain.protocolCount': '{count} protokol',
  'domain.backToHome': 'Ana sayfaya dön',

  // --- Aile sayfası ---
  'family.protocolCount': '{count} protokol',
  'family.backToDomain': 'Alana dön',

  // --- Protokol sayfası ---
  'protocol.layer': 'Katman',
  'protocol.status': 'Durum',
  'protocol.tools': 'Araçlar',
  'protocol.related': 'İlgili protokoller',
  'protocol.definitions': 'Tanım dosyaları',
  'protocol.aliasNotice':
    'Bu kayıt {name} protokolünün başka bir alandaki görünümüdür; ikisi aynı motoru kullanır.',
  'protocol.canonical': 'Kanonik kayda git',
  'protocol.backToFamily': 'Aileye dön',
  'protocol.plannedNotice':
    'Bu protokolün çözümleyicisi henüz bağlanmadı; sayfa şimdilik kapsamı ve araç listesini gösterir.',

  // --- Workspace sekmeleri (adlar catalog'daki WorkspaceTab ile birebir) ---
  'tab.overview': 'Genel bakış',
  'tab.live': 'Canlı',
  'tab.decode': 'Çözümle',
  'tab.build': 'Telgraf kur',
  'tab.timing': 'Zamanlama',
  'tab.data': 'Veri',
  'tab.diagnostics': 'Tanı',
  'tab.definitions': 'Tanımlar',
  'tab.examples': 'Örnekler',
  'tab.groupLabel': 'Çalışma alanı sekmeleri',

  // --- Olgunluk rozetleri (ImplementationStatus) ---
  'status.planned': 'Planlandı',
  'status.partial': 'Kısmi',
  'status.ready': 'Hazır',

  // --- Katman etiketleri (ProtocolLayer) ---
  'layer.physical': 'Fiziksel',
  'layer.data-link': 'Veri bağı',
  'layer.network': 'Ağ',
  'layer.transport': 'Taşıma',
  'layer.application': 'Uygulama',
  'layer.multi-layer': 'Çok katmanlı',

  // --- Tanım dosyası biçimleri (DefinitionFormat) ---
  'definition.dbc': 'DBC — CAN veritabanı',
  'definition.eds': 'EDS — CANopen aygıt tanımı',
  'definition.gsd': 'GSD — PROFIBUS aygıt tanımı',
  'definition.gsdml': 'GSDML — PROFINET aygıt tanımı',
  'definition.iodd': 'IODD — IO-Link aygıt tanımı',
  'definition.a2l': 'A2L — ASAM ölçüm ve kalibrasyon tanımı',
  'definition.ldf': 'LDF — LIN ağ tanımı',
  'definition.scl': 'SCL — IEC 61850 istasyon tanımı',
  'definition.xif': 'XIF — LonWorks arayüz dosyası',
  'definition.dsdl': 'DSDL — Cyphal veri yapısı dili',
  'definition.vendor-map': 'Üretici kayıt haritası',
  'definition.custom-schema': 'Özel şema',

  // --- Bulunamadı ve hata ---
  'notFound.title': 'Sayfa bulunamadı',
  'notFound.body':
    'Bu adres kataloğa karşılık gelmiyor. Bağlantı eskimiş ya da protokol kimliği değişmiş olabilir.',
  'notFound.back': 'Ana sayfaya dön',
  'error.title': 'Beklenmedik bir hata oluştu',
  'error.body': 'Bu bölüm yüklenemedi. Yeniden deneyebilir ya da başka bir protokole geçebilirsiniz.',
  'error.retry': 'Yeniden dene',

  // --- Ortak eylemler ---
  'common.copy': 'Kopyala',
  'common.copied': 'Kopyalandı',
  'common.copyFailed': 'Kopyalanamadı',
  'common.export': 'Dışa aktar',
  'common.back': 'Geri',
  'common.loading': 'Yükleniyor…',
  'common.empty': 'Gösterilecek kayıt yok',
  'common.close': 'Kapat',
  'common.clear': 'Temizle',
} as const;

/**
 * Bir sözlüğün taşıması gereken şekil. `en.ts` bunu ANOTASYON olarak kullanır
 * (`satisfies` değil): eksik anahtar ancak anotasyonla derleme hatası olur.
 */
export type TranslationDictionary = Record<keyof typeof tr, string>;
