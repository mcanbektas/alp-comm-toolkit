/**
 * LDF (LIN Description File) veri modeli.
 *
 * EDS/XIF/GSD gibi LDF de bir PROTOKOL DEĞİL, bir TANIM DOSYASIDIR: bir LIN
 * kümesinin (cluster) düğümlerini, sinyallerini, çerçevelerini, zamanlama
 * çizelgelerini ve sinyal ölçeklemesini tarif eder. `protocols/` altında değil
 * `protocol-core/definitions/` altında yaşar.
 *
 * ── ⚠ ÖNCEKİ ÜÇ MOTORDAN YAPISAL OLARAK FARKLI ──────────────────────────────
 * EDS · XIF · GSD üçü de SATIR TABANLIDIR: `Anahtar = Değer` satırları ve
 * `[Bölüm]`/`X`…`EndX` işaretleri. LDF DEĞİLDİR. LDF, C benzeri, KÜME
 * PARANTEZİYLE İÇ İÇE GEÇEN bir dildir — `Frames { ad: id, düğüm, boy { sinyal,
 * ofset ; } }` üç seviye derinleşir — ve noktalı virgülle sonlanan bildirimleri
 * satır sonuna DEĞİL ayraca bağlıdır. Bu yüzden `ldfParser.ts` bir satır
 * tarayıcısı değil, GERÇEK bir sözcükleyici + özyinelemeli bölüm makinesidir.
 * En yakın emsali bu depoda `dbcParser.ts`tir, `gsdParser.ts` değil.
 *
 * ── SÖZ DİZİMİ KAYNAĞI (KATMANI AÇIKÇA) ─────────────────────────────────────
 * S = **LIN Consortium, "LIN Specification Package, Revision 2.2A",
 *     31 Aralık 2010**, © LIN Consortium 2010. Söz dizimi bu belgenin
 *     **9. bölümünden** (kapak sayfası "LIN Configuration Language
 *     Specification", s. 175-193) BİREBİR çıkarıldı — GSD dalgasının aksine bu
 *     belge ÜCRETSİZ ve herkese açık; bu oturumda gerçekten indirildi ve
 *     okundu (3.655.487 bayt, 194 sayfa, iki bağımsız ayna aynı baytları
 *     veriyor):
 *       https://www.lin-cia.org/fileadmin/microsites/lin-cia.org/resources/documents/LIN_2.2A.pdf
 *       https://www.cs-group.de/wp-content/uploads/2016/11/LIN_Specification_Package_2.2A.pdf
 *     Kullanılan kesitler: §9.2 (üst düzey BNF üretimi ve bütün bölümler),
 *     §9.3 (BNF üstdilinin kendisi — `[]` BİR YA DA ÇOK, `()` İSTEĞE BAĞLI,
 *     yani yaygın BNF'in TERSİ; C++ yorumları her yerde geçerli; ayrılmış
 *     sözcükler ve tanıtıcılar BÜYÜK/KÜÇÜK HARFE DUYARLI), §9.4.1 (örnek
 *     dosya), ve bölüm dışından §2.2.3 (sinyal paketleme) ile §2.3.1.5
 *     (checksum modeli).
 *
 * `ISO 17987-6` bu dilin sonraki, standartlaşmış karşılığıdır ve ÜCRETLİDİR —
 * bu depoda YOKTUR, okunmadı ve iddia edilmiyor. Aşağıdaki model tamamen
 * 2.2A'ya dayanır. Gerçek dosyaların bir kısmı `LIN_protocol_version =
 * "ISO17987:2015"` diyor (açılış fixture'ının kardeşi dahil); bu bir DEĞERDİR,
 * olduğu gibi gösterilir, dil bilgisi ona göre değiştirilmez — ölçüldü, ISO
 * lehçesi 2.2A dil bilgisiyle sorunsuz okunuyor (§9.2'nin bütün bölümleri aynı
 * adla ve aynı şekilde).
 *
 * ── LEHÇELER: HANGİSİNİ OKUYORUZ, ÖTEKİLERE NE OLUYOR ───────────────────────
 * Ayrıştırıcı **2.2A dil bilgisini** okur ve bunu bir ÜST KÜME gibi uygular.
 * Ölçülen davranış (27 gerçek `.ldf` dosyası üzerinde):
 *   · **LIN 2.0 / 2.1 / 2.2** — tam destek. Aralarındaki tek gerçek söz dizimi
 *     farkı `configurable_frames`: 2.0 `ad = mesajKimliği ;` yazar, 2.1/2.2
 *     yalnız `ad ;`. İkisi de okunur (`LdfConfigurableFrame.messageId`
 *     yalnız 2.0'da doludur).
 *   · **ISO 17987:2015 / SAE J2602** — sürüm DİZESİ farklı, dil bilgisi aynı.
 *     Sürüm dizesi veridir, sayıya çevrilmez, üstünde koşul kurulmaz.
 *   · **LIN 1.3** — AYRI BİR LEHÇE ve KISMEN okunur. 2.2A bu lehçeyi TARİF
 *     ETMEZ. Ölçülen üç fark: (a) `Node_attributes` bölümü HİÇ YOKTUR, yerine
 *     `Diagnostic_addresses { düğüm: adres ; }` vardır; (b) `Signal_groups`
 *     kullanılır (§9.2.3.3 bunu "kullanımdan kalktı" diye tanır ve söz
 *     dizimini VERİR, bu yüzden okunuyor); (c) çerçeve boyu YAZILMAYABİLİR
 *     (`VL1_CEM_Frm2:48,CEM {` — boy alanı yok). Üçü de modelde karşılanıyor.
 *     ⚠ (c) için 1.3'ün kimlikten boy türeten kuralı UYGULANMAZ: o kural 1.3
 *     belgesindedir, 2.2A'da YOKTUR (arandı, geçmiyor) ve bu depoda o belge
 *     yok. Uydurmak yerine `lengthBytes` `undefined` bırakılır ve satırlı bir
 *     uyarı üretilir.
 */

/**
 * Sinyalin türü. §2.2.1: skaler 1-16 bit ve işaretsiz tamsayı; bayt dizisi
 * 1-8 bayt.
 *
 * ⚠ §9.2.3.1'in kendi uyarısı: 8 ya da 16 bitlik bir sinyalin skaler mi bayt
 * dizisi mi olduğunu söylemenin TEK yolu `init_value`a bakmaktır — küme
 * parantezi (`{0, 0}`) bayt dizisi demektir. Ayrıştırıcı ayrımı BURADAN yapar,
 * bit boyundan DEĞİL.
 */
export type LdfSignalKind = 'scalar' | 'byte-array';

/** `Signals { ad: boy, başlangıç, yayıncı [, aboneler] ; }` — §9.2.3.1. */
export interface LdfSignal {
  /** Sinyal adı VERİDİR, çevrilmez. */
  readonly name: string;
  readonly sizeBits: number;
  readonly kind: LdfSignalKind;
  /** Skalerde başlangıç değeri; bayt dizisinde `undefined`. */
  readonly initValue: number | undefined;
  /**
   * Bayt dizisinde başlangıç baytları. §9.2.3.1: bu dizi BIG-ENDIAN yazılır
   * (en anlamlı bayt önce) — telde baytların LSB'den başlaması (§2.2.3) ile
   * KARIŞTIRILMAMALI. Skalerde `undefined`.
   */
  readonly initBytes: readonly number[] | undefined;
  /** Yayıncı düğüm adı; `Diagnostic_signals`ta boş dize (§9.2.3.2). */
  readonly publisher: string;
  readonly subscribers: readonly string[];
  /** `Diagnostic_signals` bölümünden geldiyse `true`. */
  readonly diagnostic: boolean;
  readonly line: number;
}

/** Bir çerçevenin içindeki TEK bir sinyal yerleşimi — `[sinyal, ofset ;]`. */
export interface LdfFrameSignal {
  readonly name: string;
  /**
   * §9.2.4.1: "sinyalin çerçevedeki EN AZ ANLAMLI bit konumu … sinyalin en az
   * anlamlı biti ÖNCE gönderilir". Yani mutlak bit konumu, LSB-first yürüyüş.
   * Aralık 0 … (8 × frame_size − 1).
   */
  readonly offset: number;
  readonly line: number;
}

/**
 * Çerçeve türü. Dördü de AYRI bölümlerden gelir ama tek tabloda gösterilir;
 * `kind` hangisinden geldiğini söyler.
 */
export type LdfFrameKind = 'unconditional' | 'sporadic' | 'event-triggered' | 'diagnostic';

/** §9.2.4 — dört çerçeve bölümünün birleşik modeli. */
export interface LdfFrame {
  /** Çerçeve adı VERİDİR, çevrilmez. */
  readonly name: string;
  readonly kind: LdfFrameKind;
  /**
   * Çerçeve kimliği. Koşulsuz/olay tetiklemeli çerçevede 0-59, teşhis
   * çerçevesinde 60/61. `Sporadic_frames`ta KİMLİK YOKTUR (§9.2.4.2: sporadik
   * çerçeve yalnız ilişkili koşulsuz çerçeveleri sayar) — orada `undefined`.
   */
  readonly frameId: number | undefined;
  /** Yayıncı düğüm; sporadik ve olay tetiklemeli çerçevede boş dize. */
  readonly publisher: string;
  /**
   * Veri alanının bayt cinsinden boyu (1-8). LIN 1.3 dosyalarında YAZILMAYABİLİR
   * ve o zaman `undefined` kalır — dosya başındaki lehçe notuna bakın.
   */
  readonly lengthBytes: number | undefined;
  readonly signals: readonly LdfFrameSignal[];
  /**
   * Olay tetiklemeli çerçevenin çarpışma çözüm çizelgesi (§9.2.4.3); başka
   * türlerde boş dize.
   */
  readonly collisionScheduleTable: string;
  /**
   * Sporadik çerçevede sayılan, olay tetiklemelide ilişkilendirilen KOŞULSUZ
   * çerçevelerin adları. Başka türlerde boş.
   */
  readonly associatedFrames: readonly string[];
  readonly line: number;
}

/** `configurable_frames` girdisi — §9.2.2.2. */
export interface LdfConfigurableFrame {
  readonly name: string;
  /** YALNIZ LIN 2.0 lehçesinde doludur (`ad = 0x0001 ;`). */
  readonly messageId: number | undefined;
}

/** `Node_attributes { düğüm { … } }` — §9.2.2.2. LIN 1.3 dosyalarında HİÇ YOKTUR. */
export interface LdfNodeAttributes {
  readonly name: string;
  /** `LIN_protocol = "2.1"` — düğümün KENDİ sürümü, kümenin sürümünden farklı olabilir. */
  readonly linProtocol: string;
  readonly configuredNad: number | undefined;
  /** Verilmemişse §9.2.2.2 gereği `configured_NAD` ile aynıdır; model YİNE DE ayırır. */
  readonly initialNad: number | undefined;
  readonly supplierId: number | undefined;
  readonly functionId: number | undefined;
  /** LIN 2.0 düğümlerinde verilir, 2.1+ için isteğe bağlı. */
  readonly variant: number | undefined;
  readonly responseErrorSignal: string;
  /** LIN 2.1/2.2 özelliği (§5.3 tanı sınıfı I ve II). */
  readonly faultStateSignals: readonly string[];
  /** Milisaniye. Varsayılanlar §9.2.2.2: P2_min 50, ST_min 0, iki timeout 1000. */
  readonly p2Min: number | undefined;
  readonly stMin: number | undefined;
  readonly nAsTimeout: number | undefined;
  readonly nCrTimeout: number | undefined;
  /** SIRA ÖNEMLİDİR: PID atama isteği bu sıraya göre aralık dağıtır (§4.2.5.5). */
  readonly configurableFrames: readonly LdfConfigurableFrame[];
  readonly line: number;
}

/**
 * Çizelge girdisi. `command` ya bir çerçeve adıdır ya da §9.2.5'in on düğüm
 * yapılandırma komutundan biridir (`AssignNAD`, `AssignFrameIdRange`, …).
 */
export interface LdfScheduleEntry {
  /** Komut ya da çerçeve adı — VERİDİR, çevrilmez. */
  readonly command: string;
  /** `{ … }` içindeki argümanlar, ham parçalar hâlinde. Komut değilse boş. */
  readonly arguments: readonly string[];
  /** `delay <süre> ms` — milisaniye. */
  readonly delayMs: number | undefined;
  /** `command` çerçeve kümesinde bulunuyorsa `true`; yapılandırma komutunda `false`. */
  readonly isFrame: boolean;
  readonly line: number;
}

/** `Schedule_tables { ad { … } }` — §9.2.5. */
export interface LdfScheduleTable {
  readonly name: string;
  readonly entries: readonly LdfScheduleEntry[];
  /** Girdilerin gecikme toplamı — çizelgenin bir turu. `undefined` gecikme sayılmaz. */
  readonly totalDelayMs: number;
  readonly line: number;
}

/**
 * `Signal_encoding_types` içindeki tek bir girdi — §9.2.6.1.
 *
 * `bcd`/`ascii` gövdesizdir; ikisi de dosyanın "bu sinyali şöyle GÖSTER"
 * bildirimidir, ölçekleme taşımaz.
 */
export type LdfEncodingEntry =
  | { readonly kind: 'logical'; readonly value: number; readonly text: string; readonly line: number }
  | {
      readonly kind: 'physical';
      readonly minValue: number;
      readonly maxValue: number;
      readonly scale: number;
      readonly offset: number;
      /** Birim metni VERİDİR ("rpm", "Degree"), çevrilmez; yoksa boş dize. */
      readonly unit: string;
      readonly line: number;
    }
  | { readonly kind: 'bcd'; readonly line: number }
  | { readonly kind: 'ascii'; readonly line: number };

export interface LdfSignalEncodingType {
  readonly name: string;
  readonly entries: readonly LdfEncodingEntry[];
  readonly line: number;
}

/** `Signal_groups { ad:boy { sinyal, ofset ; } }` — §9.2.3.3, LIN 1.3 kalıntısı. */
export interface LdfSignalGroup {
  readonly name: string;
  readonly sizeBits: number;
  readonly members: readonly LdfFrameSignal[];
  readonly line: number;
}

/** `Diagnostic_addresses { düğüm: adres ; }` — YALNIZ LIN 1.3. */
export interface LdfDiagnosticAddress {
  readonly node: string;
  readonly address: number;
  readonly line: number;
}

/** `Nodes { Master: ad, taban ms, seğirme ms ; }` — §9.2.2.1. */
export interface LdfMaster {
  readonly name: string;
  /** Milisaniye. */
  readonly timeBaseMs: number | undefined;
  readonly jitterMs: number | undefined;
}

/** Bir LDF'in tarif ettiği kümenin tamamı. */
export interface LdfCluster {
  /** `LIN_protocol_version` — DİZEDİR, sayıya çevrilmez ("2.2", "ISO17987:2015", "J2602_1_1.0"). */
  readonly protocolVersion: string;
  readonly languageVersion: string;
  /** `LIN_speed = … kbps` — kbit/s. §9.2.1.3: 1-20 aralığında olmalı. */
  readonly speedKbps: number | undefined;
  /** `Channel_name` — §9.2.1.4, isteğe bağlı; yoksa boş dize. */
  readonly channelName: string;
  /**
   * 2.2A BNF'inde OLMAYAN ama gerçek dosyalarda görülen `LDF_file_revision`.
   * Ölçüldü: Vector'ün DaVinci Network Designer'ı yazıyor ve dosyanın kendi
   * yorumu "New optional parameter" diyor. Uyarı üretmeden saklanır.
   */
  readonly fileRevision: string;
  readonly master: LdfMaster;
  readonly slaves: readonly string[];
  /** `Diagnostic_signals` HARİÇ sinyaller. */
  readonly signals: readonly LdfSignal[];
  readonly diagnosticSignals: readonly LdfSignal[];
  /** Dört çerçeve bölümü BİRLEŞİK; `kind` ayırır. Dosyadaki sırayı korur. */
  readonly frames: readonly LdfFrame[];
  readonly nodeAttributes: readonly LdfNodeAttributes[];
  readonly scheduleTables: readonly LdfScheduleTable[];
  readonly encodingTypes: readonly LdfSignalEncodingType[];
  /**
   * `Signal_representation` — sinyal adı → kodlama tipi adı. §9.2.6.2: bir
   * sinyal EN ÇOK bir kodlama tipine bağlanabilir, o yüzden düz eşleme.
   */
  readonly signalEncodingByName: ReadonlyMap<string, string>;
  readonly signalGroups: readonly LdfSignalGroup[];
  readonly diagnosticAddresses: readonly LdfDiagnosticAddress[];
}

/** `edsTypes.ts`teki `EdsParseIssue` ile birebir aynı şekil. */
export interface LdfParseIssue {
  readonly line: number;
  readonly messageKey: string;
  readonly text?: string;
}

/**
 * `success: false` yalnız dosya BİR LDF DEĞİLSE döner.
 *
 * ── EDS'TEN BİLİNÇLİ SAPMA (XIF ve GSD dalgalarıyla aynı sınıf karar) ────────
 * `EdsParseResult` "hiç Object Dictionary girdisi çıkarılamadıysa başarısız"
 * diyor. Aynı ölçütü çerçevelere uygulamak burada YANLIŞ olurdu, GSD'dekiyle
 * AYNI ilk gerekçe ve LDF'e özel bir ikincisiyle:
 *
 *   1. **LDF'in kendi dosya tipi işareti VAR ve NORMATİFTİR.** §9.2'nin üst
 *      düzey üretimi dosyanın İLK anlamlı belirteci olarak `LIN_description_file
 *      ;` yazmayı ZORUNLU kılar (BNF'te kalın, yani ayrılmış sözcük). Bu, GSD'nin
 *      `#Profibus_DP`sinden bile güçlü bir işaret: opsiyonel değil, üretimin
 *      kendisinde. "Bu dosya bir LDF mi" sorusu içeriği saymadan cevaplanır.
 *   2. **Çerçevesiz bir dosyayı reddetmek ÖLÇÜLEN içeriği çöpe atardı.** Bir
 *      LDF'te çerçeve tablosu boş olsa bile düğümler, sinyaller, çizelgeler,
 *      kodlama tipleri okunmuş durumdadır. XIF dalgasının dersi buydu.
 *
 * Çerçevesizlik bu yüzden `success: false` değil, satırsız bir UYARI üretir.
 */
export type LdfParseResult =
  | { readonly success: true; readonly cluster: LdfCluster; readonly issues: readonly LdfParseIssue[] }
  | { readonly success: false; readonly issues: readonly LdfParseIssue[] };

/**
 * §2.3.1.5'in checksum modeli. `unknown` = dosya karar vermeye YETMİYOR;
 * uydurulmuş bir varsayım değil, bilinmezliğin kendisi.
 */
export type LdfChecksumModel = 'classic' | 'enhanced' | 'unknown';

/** Checksum modelinin NEREDEN çıktığı — panel bunu koşulsuz yazar. */
export type LdfChecksumReason =
  | 'reservedDiagnostic'
  | 'linOneSlave'
  | 'linTwoSlave'
  | 'mixedSlaves'
  | 'clusterVersion'
  | 'noSlaveVersion';

export interface LdfChecksumResolution {
  readonly model: LdfChecksumModel;
  readonly reason: LdfChecksumReason;
  /** Kararı veren düğümün adı; küme sürümünden geldiyse boş dize. */
  readonly node: string;
}

/** Çözülmüş tek bir sinyal — `DbcDecodedSignal`in LDF karşılığı. */
export interface LdfDecodedSignal {
  readonly signal: LdfSignal;
  readonly placement: LdfFrameSignal;
  /** Skalerde ham değer; okunamadıysa `undefined`. */
  readonly rawValue: number | undefined;
  /** Bayt dizisinde baytlar; skalerde `undefined`. */
  readonly bytes: readonly number[] | undefined;
  /** `physical_value` eşleştiyse `scale × raw + offset` (§9.2.6.1 denklem 17). */
  readonly physicalValue: number | undefined;
  /** `logical_value` eşleştiyse metni. VERİDİR, çevrilmez. */
  readonly label: string | undefined;
  /** Eşleşen `physical_value` girdisinin birimi. VERİDİR, çevrilmez. */
  readonly unit: string;
  /**
   * Sinyal çerçeveye SIĞMADI (çerçeve kısa geldi ya da ofset+boy taşıyor).
   * `readDbcSignalRaw`in aynı davranışı: hata değil, beklenen durum.
   */
  readonly outOfFrame: boolean;
  /**
   * Bayt dizisi BAYT SINIRINDA BAŞLAMIYOR. §2.2.3 "bayt dizisindeki her bayt
   * TEK bir çerçeve baytına oturmalıdır" diyor; oturmuyorsa okuma UYDURULMAZ.
   */
  readonly unalignedByteArray: boolean;
  /** `Signals` bölümünde tanımı BULUNAMADI — yalnız yerleşim var. */
  readonly undefinedSignal: boolean;
}
