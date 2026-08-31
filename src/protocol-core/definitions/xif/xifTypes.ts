/**
 * XIF (LONMARK device interface file) veri modeli.
 *
 * EDS ve DBC gibi XIF de bir PROTOKOL DEĞİL, bir TANIM DOSYASIDIR: bir LON
 * cihazının AĞDAN GÖRÜNEN arayüzünü (network variable'lar, message tag'ler,
 * konfigürasyon dosyaları) tarif eder. `protocols/` altında değil
 * `protocol-core/definitions/` altında yaşar ve EDS motorunun BİREBİR desenini
 * izler (`edsTypes.ts` ile karşılaştır).
 *
 * ── SÖZ DİZİMİ KAYNAĞI ──────────────────────────────────────────────────────
 * Spec XIF biçimini SIFIR veriyor (EDS'le aynı durum, `edsTypes.ts` dosya
 * başı). Söz dizimi — bölüm sırası, `VAR`/`TAG`/`FILE`/`NVVAL` kayıtları,
 * başlığın 11 satırı, satır 2'nin 13 alanı, `snvtIndex * elementCount` tip
 * satırı ve `type offset size signedFlag arraySize` eleman satırları —
 * **LONMARK Device Interface File Reference Guide rev 4.501** (Aralık 2020,
 * `lonmark.org/wp-content/uploads/2020/12/LmXif4501.pdf`, girişsiz) belgesinin
 * "Text Device Interface File Format" bölümünden alındı. EDS'in CiA 306'dan,
 * DBC'nin Vector'ın kendi spec'inden alınmasıyla AYNI disclosure deseni.
 *
 * Alan listesi ÇAPRAZ DOĞRULANDI: `g3gg0/LonScan`ın açık C# ayrıştırıcısı
 * (`LonScan/XifFile.cs`) aynı alanları aynı sırayla okuyor. LonScan'ın SABİT
 * SATIR ATLAMA mantığı (`for (line = 6; line < 11) ReadLine()`) BİLEREK
 * kopyalanmadı — kaynağın kendi notuna göre kırılgan ve 3.0 öncesi dosyalarda
 * satır 8-10 hiç yoktur. `xifParser.ts` bunun yerine bölüm makinesi kullanır.
 *
 * ── ⚠ SNVT TİPİ TELDE YOKTUR ────────────────────────────────────────────────
 * Bu dosyadaki `snvtIndex` bir BİLDİRİMDİR, bir ölçüm değil. LonTalk NV
 * mesajı yalnız 14 bitlik bir SELECTOR taşır ve selector cihazın bağlama
 * tablosundaki bir indekstir, tip DEĞİLDİR (`snvtTypes.ts`in
 * `nvTypeNotOnWire` uyarısı, dalga 17). Yani XIF dosyası bir NV'nin tipini
 * SÖYLER ama o tip yakalanmış bir çerçeveden DOĞRULANAMAZ. Panel bunu koşulsuz
 * yazar; `XifPanel.tsx` dosya başındaki "hex çöz aracı YOK" kararı da buradan
 * çıkar.
 *
 * ── CONFIGURATION PROPERTY NEDEN AYRI BİR KAYIT DEĞİL ───────────────────────
 * Rehber XIF'te `CP` diye bir kayıt TANIMLAMAZ. Configuration property iki
 * yerde yaşar: (a) konfigürasyon sınıfı bir network variable olarak — satır
 * 2'nin 13. alanı (`configClass`), CPNV; (b) bir konfigürasyon DOSYASININ
 * içinde — `FILE` kaydı. Ayrı bir `XifConfigProperty` arayüzü uydurmak
 * biçimde olmayan bir kayıt icat etmek olurdu; CPNV'ler `configClass`
 * bayrağıyla ayrılır (`selectConfigProperties`), dosya içindeki CP'ler ise
 * ÇÖZÜLMEZ: şablon dosyasının iç yerleşimi AYRI bir spesifikasyondur (CP
 * template format) ve bu depoda okunmadı.
 */

/** `VAR` kaydının tip satırındaki (`type offset size signedFlag arraySize`) tek eleman. */
export interface XifTypeElement {
  /**
   * Rehberin veri tipi kodu: 0 Character · 1 8-bit int (Neuron C `short`) ·
   * 2 16-bit int (Neuron C `long`) · 3 Bitfield · 4 Union · 5 Typeless.
   * Tanınmayan kod HAM tutulur — biçim ileri sürümlerde genişleyebilir.
   */
  readonly type: number;
  /** Bitfield ofseti (0-7); bitfield değilse 0. */
  readonly bitOffset: number;
  /** Bitfield'da bit sayısı (1-7), union'da bayt sayısı (1-225); ikisi de değilse 0. */
  readonly size: number;
  /** `signedFlag`: tip işaretliyse `true`. Uygulanmıyorsa `false`. */
  readonly signed: boolean;
  /** Tip bir dizi değilse 0, diziyse eleman sayısı. */
  readonly arraySize: number;
}

/** NV yönü: rehberde satır 2 alan 4 — 0 giriş, 1 çıkış. */
export type XifNvDirection = 'input' | 'output';

/** Bağlantı için varsayılan servis tipi: satır 2 alan 5 — 0/1/2. */
export type XifServiceType = 'acknowledged' | 'repeated' | 'unacknowledged';

/**
 * Bir `VAR` kaydı — cihazın ağdan görünen bir network variable'ı.
 *
 * `avgRate`/`maxRate` KODLANMIŞ tutulur (rehber: `2^(n/8)-5` saniyede mesaj).
 * Çözülmüş hızı burada saklamak, `0`ın "belirtilmemiş" anlamını (rehberin kendi
 * kuralı) sayısal bir tahminle karıştırırdı.
 */
export interface XifNetworkVariable {
  /** Programatik ad — VERİDİR, çevrilmez. En çok 16 karakter. */
  readonly name: string;
  /** NV indeksi (0-4095). Dizi elemanları ardışık indeks tüketir. */
  readonly index: number;
  /** Kodlanmış ortalama hız tahmini (0-250); 0 = belirtilmemiş. */
  readonly avgRateEncoded: number;
  /** Kodlanmış azami hız tahmini (0-250); 0 = belirtilmemiş. */
  readonly maxRateEncoded: number;
  /** NV dizisindeki eleman sayısı; dizi değilse 0. */
  readonly arraySize: number;
  /** Satır 2 alan 1: güncelleme için cihaz çevrimdışına alınmalı mı. */
  readonly takeOfflineToUpdate: boolean;
  readonly direction: XifNvDirection;
  /** Satır 2 alan 5; tanınmayan kod `undefined` bırakılır. */
  readonly serviceType: XifServiceType | undefined;
  /** Satır 2 alan 6: servis tipi sahada değiştirilebilir mi. */
  readonly serviceTypeConfigurable: boolean;
  /** Satır 2 alan 7/8: kimlik doğrulama varsayılanı ve değiştirilebilirliği. */
  readonly authenticated: boolean;
  readonly authenticationConfigurable: boolean;
  /** Satır 2 alan 9/10: öncelik varsayılanı ve değiştirilebilirliği. */
  readonly priority: boolean;
  readonly priorityConfigurable: boolean;
  /** Satır 2 alan 11. Girişte "uygulama bu NV ile poll eder", çıkışta "poll edilmeli". */
  readonly polled: boolean;
  /** Satır 2 alan 12: senkronize NV (bütün çıkışlar gönderilir, sıra korunur). */
  readonly synchronized: boolean;
  /** Satır 2 alan 13: konfigürasyon sınıfı NV — yani bir CPNV. */
  readonly configClass: boolean;
  /** Self-documentation metni; yoksa boş dize. VERİDİR, çevrilmez. */
  readonly selfDocumentation: string;
  /** SNVT indeksi (1-255); 0 = kullanıcı tanımlı tip (UNVT). */
  readonly snvtIndex: number;
  /** Yapı/union eleman sayısı (1-256); yapı değilse 1. */
  readonly elementCount: number;
  readonly elements: readonly XifTypeElement[];
  /**
   * `NVVAL` bölümünden gelen varsayılan değer baytları — YALNIZ konfigürasyon
   * sınıfı NV'lerde ve yalnız dosya o bölümü taşıyorsa dolu olur.
   */
  readonly defaultValue: readonly number[] | undefined;
  /** Kaydın `VAR` satırının 1'den başlayan dosya satır numarası. */
  readonly line: number;
}

/** Bir `TAG` kaydı — uygulama mesajları için bağlanabilir message tag. */
export interface XifMessageTag {
  /** Tag adı — VERİDİR, çevrilmez. */
  readonly name: string;
  /** Message tag indeksi (0-14). */
  readonly index: number;
  readonly avgRateEncoded: number;
  readonly maxRateEncoded: number;
  /** İkinci satırın 2. alanı: tag bağlanabilir mi. */
  readonly bindable: boolean;
  readonly line: number;
}

/**
 * Bir `FILE` kaydı — konfigürasyon şablonu ya da değer dosyası.
 *
 * İçerik BAYT olarak tutulur, YORUMLANMAZ: şablon dosyasının içindeki CP
 * kayıtlarının yerleşimi ayrı bir spesifikasyondur (dosya başı notu).
 */
export interface XifConfigFile {
  /** Dosya adı — VERİDİR, çevrilmez. */
  readonly name: string;
  /** LONWORKS dosya transfer protokolündeki dosya indeksi: 0 şablon, 1/2 değer. */
  readonly index: number;
  /** Dosya tipi: 2 şablon, 1 değer. */
  readonly type: number;
  /** Bildirilen uzunluk; `FILE` satırında verilmemişse `undefined`. */
  readonly declaredLength: number | undefined;
  /** Okunan içerik baytları; içerik verilmemişse boş. */
  readonly contents: readonly number[];
  readonly line: number;
}

/** Başlığın 1. satırından çözülen üretici bilgisi. */
export interface XifFileInfo {
  /** Dosya adı — VERİDİR, çevrilmez. */
  readonly fileName: string;
  /** Dosyayı üreten araç (`LONNCC32 Version 4.04.12` gibi). */
  readonly generatedBy: string;
  /** Biçim sürümü ham metni (`4.400`); sürüm kıyası için ayrıca sayılar. */
  readonly formatVersion: string;
  readonly formatMajor: number | undefined;
  readonly formatMinor: number | undefined;
  /** 3. satırın zaman damgası ham metni; yoksa boş dize. */
  readonly timestamp: string;
}

/**
 * Başlığın cihaz bilgisi.
 *
 * `programId` ham metin tutulur (`80:00:22:15:00:0A:04:05`): ilk hane biçimi
 * belirler ve 8/9 dışındaki değerlerde alanların anlamı BAŞKADIR — sayıya
 * çevirmek olmayan bir yapıyı varsaymak olurdu.
 */
export interface XifDevice {
  readonly programId: string;
  /** Cihaz self-documentation metni; yoksa boş dize. VERİDİR, çevrilmez. */
  readonly selfDocumentation: string;
  /** Satır 6 alan 1: ECS olmayan domain sayısı. */
  readonly domainCount: number | undefined;
  /** Satır 6 alan 2: ECS olmayan adres tablosu girdisi sayısı. */
  readonly addressTableEntries: number | undefined;
  /** Satır 6 alan 4: BİLDİRİLEN statik NV bildirimi sayısı (dizi = 1 bildirim). */
  readonly declaredStaticNvCount: number | undefined;
  /** Satır 6 alan 5: ECS olmayan message tag sayısı. */
  readonly declaredMessageTagCount: number | undefined;
  /** Satır 9 alan 1: kanal bit hızı (bit/s). 3.0 öncesi dosyalarda YOKTUR. */
  readonly channelBitRate: number | undefined;
}

export interface XifDatabase {
  readonly fileInfo: XifFileInfo;
  readonly device: XifDevice;
  readonly networkVariables: readonly XifNetworkVariable[];
  readonly messageTags: readonly XifMessageTag[];
  readonly configFiles: readonly XifConfigFile[];
}

/** `edsTypes.ts`teki `EdsParseIssue` ile birebir aynı şekil. */
export interface XifParseIssue {
  readonly line: number;
  readonly messageKey: string;
  readonly text?: string;
}

/**
 * `success: false` yalnız BAŞLIK kurulamadığında döner.
 *
 * ── EDS'TEN BİLİNÇLİ SAPMA ──────────────────────────────────────────────────
 * `EdsParseResult` "hiç nesne çıkarılamadıysa başarısız" diyor. XIF'te aynı
 * ölçütü NV'lere uygulamak YANLIŞ olurdu ve bu ÖLÇÜLDÜ: `izot/shortstack`taki
 * 20 gerçek microserver XIF'inin HEPSİNDE satır 6 alan 4 = 0'dır, yani sıfır
 * NV taşıyan GEÇERLİ dosyalardır. Rehberin kendi cümlesi de bunu söylüyor:
 * *"All sections are optional, except for the header section."* Sıfır NV'yi
 * hata saymak gerçek dosyaları reddetmek olurdu.
 */
export type XifParseResult =
  | { readonly success: true; readonly database: XifDatabase; readonly issues: readonly XifParseIssue[] }
  | { readonly success: false; readonly issues: readonly XifParseIssue[] };
