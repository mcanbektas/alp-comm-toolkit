/**
 * GSD (PROFIBUS DP General Station Description) veri modeli.
 *
 * EDS ve XIF gibi GSD de bir PROTOKOL DEĞİL, bir TANIM DOSYASIDIR: bir
 * PROFIBUS DP slave'inin master'a bildirdiği kimliğini, hız/zamanlama
 * sınırlarını, seçilebilir modüllerini ve parametre alanlarını tarif eder.
 * `protocols/` altında değil `protocol-core/definitions/` altında yaşar ve EDS
 * motorunun desenini izler (`edsTypes.ts` ile karşılaştır); en yakın emsali
 * XIF'tir, çünkü GSD de düz metin, `Anahtar = Değer` satırlarından ve
 * `X`/`EndX` bölümlerinden kurulu bir biçimdir.
 *
 * ── SÖZ DİZİMİ KAYNAĞI (KATMANI AÇIKÇA) ─────────────────────────────────────
 * PI'nin (PROFIBUS & PROFINET International) normatif belgesi *"Specification
 * for PROFIBUS Device Description and Device Integration, Volume 1: GSD
 * Specification"* ÜCRETLİDİR ve bu depoda YOKTUR — `profibusDp.ts`in FDL spec
 * metni için yazdığı notun aynısı. `profibus.com/download/gsd-specification`
 * sayfası belgenin varlığını ve kapsamını doğruluyor ama metnini vermiyor.
 * Söz dizimi bu yüzden İKİNCİL ama BİRBİRİNDEN BAĞIMSIZ üç kaynaktan elle
 * çıkarıldı (üçüne de bu oturumda gerçekten erişildi):
 *
 *   S = **Siemens/ComDeC, "The Generic Station Description File (GSD-file)",
 *       Version 2.2** (IEC 61158 tabanlı, 10 sayfalık anahtar sözcük
 *       başvurusu). Anahtar sözcüklerin zorunluluk sınıfını (M/O/D/G), veri
 *       tiplerini, `Module`/`EndModule` bloğunun `Mod_Name` + `Config` +
 *       `Module_Reference` parametrelerini, `ExtUserPrmData` tip satırının
 *       (`Bit(n)` · `BitArea(a-b)` · `Unsigned8/16` + varsayılan + aralık)
 *       yazımını ve — kritik olarak — GENEL ve ÖZEL kimlik baytı bit
 *       haritasını verir.
 *       https://cache.industry.siemens.com/dl/files/306/1172306/att_39239/v1/gsd_e.pdf
 *   F = **felser.ch PROFIBUS Manual**, "Structure of GSD files" ve "Modules in
 *       the GSD" sayfaları. `profibusDp.ts` telgraf biçimleri için ZATEN bu
 *       kaynağı üçüncü teyit olarak kullanıyor; `Slave_Family` hiyerarşisini,
 *       `Modular_Station` ayrımını ve dosya adlandırma kuralını doğruluyor.
 *       https://www.felser.ch/profibus-manual/gsd_dateien.html
 *   P = **pyprofibus** (Michael Buesch, GPL-2.0) — `pyprofibus/gsd/parser.py`
 *       ve `gsd/fields.py`. `profibusDp.ts`in ZATEN çapraz referans aldığı
 *       yığın. Bölüm makinesinin dört durumunu (global · PrmText ·
 *       ExtUserPrmData · Module) ve alan listesini teyit eder.
 *       KOD KOPYALANMADI; üstelik P'nin okumadığı iki şey burada okunuyor:
 *       `ExtUserPrmData` tip satırı ve `Module_Reference` (P ikisini de
 *       "Ignored unknown line" diye geçiyor).
 *
 * Kimlik baytı çözümü S'ten alındı ve GERÇEK DOSYALARLA ÖLÇÜLDÜ: depoya
 * girmeyenler dahil **14 `.gsd` dosyası** (11 üretici dosyası — Siemens,
 * ABB, SEW, HMS, LS Electric, Janitza, Eurotherm — + PI'nin kendi resmî E13
 * örneği + pyprofibus'un iki sınama dosyası) toplam **288 modül** taşıyor ve
 * hepsi ARTIK KALMADAN çözüldü: hiçbir modülün baytları yarım kalmadı, hiçbiri
 * dosyanın kendi `Max_Input_Len`/`Max_Output_Len` sınırını aşmadı ve çözüm
 * üreticinin KENDİ `Info_Text`i ya da modül adıyla birebir tuttu — ör. Janitza
 * UMG96S'in "STD: 62 Word In, 2 Byte Out" modülü `0xC0,0x01,0x7D`
 * baytlarından 124 bayt giriş + 2 bayt çıkış olarak çözülüyor.
 *
 * ── ⚠ GSD MODÜL LİSTESİ BİR KONFİGÜRASYON DEĞİLDİR ──────────────────────────
 * Bu dosyadaki modüller cihazın TAŞIYABİLECEĞİ modüllerdir. Hangilerinin
 * gerçekten takılı olduğu ve hangi sırayla oturduğu konfigürasyon aracında
 * seçilir ve Chk_Cfg telgrafıyla telde taşınır — GSD'de YAZMAZ. `profibusDp.ts`
 * Data Exchange telgrafının kullanıcı verisini tam bu yüzden ham bırakıyor
 * (`WARN_USER_DATA_NEEDS_GSD`). Yani bu model o uyarının ÖTEKİ yarısıdır:
 * baytların uzunluğu ve yönü burada YAZAR, hangi modülün nerede oturduğu
 * YAZMAZ. `GsdPanel.tsx` bunu koşulsuz yazar ve "hex çöz" alt aracının neden
 * eklenmediği kararı da buradan çıkar.
 */

/** Kimlik baytının bildirdiği veri yönü. */
export type GsdDataDirection = 'input' | 'output';

/** Kimlik baytının bit 6'sı: uzunluk bayt mı word mü sayıyor. */
export type GsdDataUnit = 'byte' | 'word';

/**
 * Kimlik baytının bit 7'si: `unit` = bayt/word başına tutarlılık,
 * `whole` = bildirilen uzunluğun TAMAMINDA tutarlılık.
 */
export type GsdConsistency = 'unit' | 'whole';

/**
 * Kimlik baytı biçimi. `general` = bit 5-4 sıfır DEĞİL, tek bayt kendi başına
 * yön + uzunluk taşır. `special` = bit 5-4 sıfır; bayt yalnız NE GELECEĞİNİ
 * söyler, uzunluklar ARDINDAN gelen ayrı baytlardadır (S: *"The special
 * configuration format exists always out of at least 2 bytes."*).
 */
export type GsdIdentifierFormat = 'general' | 'special';

/**
 * Bir modülün kimlik baytlarından çözülmüş TEK bir I/O bildirimi.
 *
 * Bir modül birden çok blok taşıyabilir: PROFIdrive'ın PKW+PZD telgrafları
 * (`0xF3, 0xC3, 0xC5, 0xC5, …`) genel biçimli bir blokla özel biçimli iki bloğu
 * ARDIŞIK kullanır ve toplam uzunluk bunların toplamıdır.
 */
export interface GsdIoBlock {
  readonly direction: GsdDataDirection;
  readonly unit: GsdDataUnit;
  /** Birim sayısı: genel biçimde 1-16, özel biçimde 1-64 (alan genişliği farklı). */
  readonly count: number;
  /** Bayt karşılığı — `count`, word ise ikiyle çarpılmış hâli. */
  readonly lengthBytes: number;
  readonly consistency: GsdConsistency;
  readonly format: GsdIdentifierFormat;
}

/** Bir modülün konfigürasyon (kimlik) baytlarının çözümü. */
export interface GsdConfigDecode {
  readonly blocks: readonly GsdIoBlock[];
  /**
   * Özel biçimin bildirdiği ÜRETİCİYE ÖZEL baytlar. İçerikleri YORUMLANMAZ:
   * anlamları GSD'de değil üreticinin kendi belgesindedir.
   */
  readonly manufacturerBytes: readonly number[];
  readonly inputLengthBytes: number;
  readonly outputLengthBytes: number;
  /** Baytlar bir bildirimin ORTASINDA bittiyse `true` — uzunluklar eksiktir. */
  readonly truncated: boolean;
}

/** `PrmText` bloğundaki tek bir `Text(n) = "…"` satırı. */
export interface GsdPrmTextValue {
  /** Parantez içindeki sayı — parametrenin bu metne karşılık gelen DEĞERİ. */
  readonly value: number;
  /** Seçenek metni VERİDİR, çevrilmez. */
  readonly text: string;
}

/** `PrmText = n` … `EndPrmText` bloğu — bir parametrenin seçenek metinleri. */
export interface GsdPrmText {
  /** Blok numarası; `Prm_Text_Ref` bunu gösterir. */
  readonly reference: number;
  readonly values: readonly GsdPrmTextValue[];
  readonly line: number;
}

/**
 * `ExtUserPrmData` tip satırının tanınan tipleri.
 *
 * `bit-area` bitişik BİRDEN ÇOK biti kaplar (`BitArea(2-3)`), `bit` tek biti
 * (`Bit(0)`). Sayısal tipler tam BAYT/WORD alanlardır ve bit konumu taşımaz.
 * Tanınmayan bir tip `undefined` bırakılır ve ham satır saklanır — biçim
 * sürümden sürüme tip ekliyor, bilinmeyeni uydurmak yerine göstermek doğru.
 */
export type GsdPrmDataType =
  | 'bit'
  | 'bit-area'
  | 'unsigned8'
  | 'unsigned16'
  | 'unsigned32'
  | 'signed8'
  | 'signed16'
  | 'signed32';

/** `ExtUserPrmData = n "ad"` … `EndExtUserPrmData` bloğu — tek bir parametre alanı. */
export interface GsdExtUserPrmData {
  /** Tanım numarası; `Ext_User_Prm_Data_Ref(offset) = n` bunu gösterir. */
  readonly reference: number;
  /** Parametre adı VERİDİR (`F_SIL`, `PNU in Input PZD/1` …), çevrilmez. */
  readonly name: string;
  readonly dataType: GsdPrmDataType | undefined;
  /** Ham tip satırı — tanınmayan tiplerde tek bilgi kaynağı budur. */
  readonly rawType: string;
  /** `Bit(n)`in `n`i ya da `BitArea(a-b)`nin `a`sı; sayısal tiplerde `undefined`. */
  readonly bitFrom: number | undefined;
  /** `BitArea(a-b)`nin `b`si; `Bit(n)`de `n`, sayısal tiplerde `undefined`. */
  readonly bitTo: number | undefined;
  readonly defaultValue: number | undefined;
  readonly minValue: number | undefined;
  readonly maxValue: number | undefined;
  /** `Prm_Text_Ref = n`; yoksa `undefined`. */
  readonly prmTextReference: number | undefined;
  readonly line: number;
}

/**
 * `Ext_User_Prm_Data_Ref(offset) = n` — parametre alanının kullanıcı parametre
 * bloğundaki YERİ. `safety` PROFIsafe'in `F_` önekli ikizini işaretler
 * (`F_Ext_User_Prm_Data_Ref`), çünkü o AYRI bir parametre bloğuna adreslenir.
 */
export interface GsdPrmDataRef {
  readonly offset: number;
  readonly reference: number;
  readonly safety: boolean;
}

/** `Ext_User_Prm_Data_Const(offset) = baytlar` — bloğun sabit ön yüklemesi. */
export interface GsdPrmDataConst {
  readonly offset: number;
  readonly bytes: readonly number[];
  readonly safety: boolean;
}

/** `Module = "ad" kimlikBaytları` … `EndModule` bloğu. */
export interface GsdModule {
  /** Modül adı VERİDİR, çevrilmez. */
  readonly name: string;
  readonly configBytes: readonly number[];
  /**
   * Blok içindeki ÇIPLAK tam sayı satırı — S'in `Module_Reference` parametresi
   * (Unsigned16, GSD_Revision 1'den itibaren opsiyonel). Cihaz başına EŞSİZ
   * olmalıdır; dil bağımsız konfigürasyon bunun üstünde yürür.
   */
  readonly moduleReference: number | undefined;
  /** `Preset = 1` — modül sabit olarak takılı gelir (`FixPresetModules` ile). */
  readonly preset: boolean;
  /** Modülün kendi açıklaması; yoksa boş dize. VERİDİR, çevrilmez. */
  readonly infoText: string;
  /** `Ext_Module_Prm_Data_Len` — modülün kendi parametre bloğunun uzunluğu. */
  readonly extModulePrmDataLength: number | undefined;
  readonly parameterRefs: readonly GsdPrmDataRef[];
  readonly parameterConstants: readonly GsdPrmDataConst[];
  readonly config: GsdConfigDecode;
  readonly line: number;
}

/**
 * Cihaz teşhis metni. İki kaynaktan gelir ve ikisi de AYNI tabloda gösterilir:
 * `Unit_Diag_Bit(bit) = "metin"` (basit, yaygın biçim) ve `UnitDiagType` bloğu
 * içindeki `X_Value(değer) = "metin"`.
 */
export interface GsdDiagnosisText {
  /** `Unit_Diag_Bit`te bit numarası, `X_Value`da alanın DEĞERİ. */
  readonly code: number;
  /** Teşhis metni VERİDİR, çevrilmez. */
  readonly text: string;
  /** `UnitDiagType` bloğunun tipi; `Unit_Diag_Bit` satırlarında `undefined`. */
  readonly unitDiagType: number | undefined;
  readonly line: number;
}

/** Desteklenen iletim hızı ve o hızdaki azami istasyon gecikmesi. */
export interface GsdBaudRate {
  /** GSD anahtarındaki hız etiketi (`9.6`, `187.5`, `1.5M`, `12M`) — VERİDİR. */
  readonly label: string;
  /** `<label>_supp = 1` mi. */
  readonly supported: boolean;
  /** `MaxTsdr_<label>` (bit süresi); bildirilmemişse `undefined`. */
  readonly maxTsdr: number | undefined;
}

/** Cihaz kimliği ve global bildirimleri. */
export interface GsdDevice {
  /** Aşağıdaki dize alanların hepsi VERİDİR, çevrilmez; yoksa boş dize. */
  readonly vendorName: string;
  readonly modelName: string;
  readonly revision: string;
  readonly hardwareRelease: string;
  readonly softwareRelease: string;
  readonly orderNumber: string;
  readonly infoText: string;
  readonly implementationType: string;
  /** PI'nin tahsis ettiği 16 bitlik tip numarası; master başlangıçta bunu doğrular. */
  readonly identNumber: number | undefined;
  /** `GSD_Revision` — biçim sürümü. Revizyon 1 ÖNCESİ dosyalarda YOKTUR. */
  readonly gsdRevision: number | undefined;
  /** 0 = PROFIBUS-DP. */
  readonly protocolIdent: number | undefined;
  /** 0 = DP slave, 1 = DP master (sınıf 1). */
  readonly stationType: number | undefined;
  /** Ham `Slave_Family` değeri (`3@Digital@24V` gibi) — VERİDİR. */
  readonly slaveFamily: string;
  /** Ana aile numarası (0 General · 1 Drives · 3 I/Os · 7 Encoders …). */
  readonly slaveFamilyId: number | undefined;
  /** `@` ile eklenen alt aileler; en çok üç tane olabilir. */
  readonly subFamilies: readonly string[];
  /** `Modular_Station = 1` → modüller seçilebilir; `0` → kompakt, sabit I/O. */
  readonly modularStation: boolean | undefined;
  readonly maxModule: number | undefined;
  readonly maxInputLength: number | undefined;
  readonly maxOutputLength: number | undefined;
  readonly maxDataLength: number | undefined;
  readonly maxDiagDataLength: number | undefined;
  /** `Min_Slave_Intervall` — 100 µs tabanında en küçük çevrim aralığı. */
  readonly minSlaveInterval: number | undefined;
  readonly maxUserPrmDataLength: number | undefined;
  readonly freezeModeSupported: boolean | undefined;
  readonly syncModeSupported: boolean | undefined;
  readonly autoBaudSupported: boolean | undefined;
  readonly failSafe: boolean | undefined;
  readonly dpv1Slave: boolean | undefined;
  readonly baudRates: readonly GsdBaudRate[];
}

export interface GsdDatabase {
  readonly device: GsdDevice;
  readonly prmTexts: readonly GsdPrmText[];
  readonly parameterDefinitions: readonly GsdExtUserPrmData[];
  readonly modules: readonly GsdModule[];
  readonly diagnosisTexts: readonly GsdDiagnosisText[];
  /**
   * BASİT parametre biçimi: `User_Prm_Data` baytları. F'in notu: basit ve
   * genişletilmiş biçim aynı dosyada BULUNMAMALIDIR, ikisi de varsa SONUNCUSU
   * geçerlidir. Model ikisini de saklar; hangisinin kullanıldığını
   * `parameterDefinitions`in boş olup olmaması söyler.
   */
  readonly userPrmData: readonly number[];
  /** Modül DIŞINDA, cihazın tamamına ait referanslar ve sabitler. */
  readonly deviceParameterRefs: readonly GsdPrmDataRef[];
  readonly deviceParameterConstants: readonly GsdPrmDataConst[];
}

/** `edsTypes.ts`teki `EdsParseIssue` ile birebir aynı şekil. */
export interface GsdParseIssue {
  readonly line: number;
  readonly messageKey: string;
  readonly text?: string;
}

/**
 * `success: false` yalnız dosya BİR GSD DEĞİLSE döner.
 *
 * ── EDS'TEN BİLİNÇLİ SAPMA (XIF'inkiyle aynı sınıf karar) ────────────────────
 * `EdsParseResult` "hiç Object Dictionary girdisi çıkarılamadıysa başarısız"
 * diyor. Aynı ölçütü modüllere uygulamak — yani "hiç `Module` yoksa reddet" —
 * burada YANLIŞ olurdu, iki sebeple:
 *
 *   1. **GSD'nin kendi dosya tipi işareti VAR.** EDS ve XIF'in aksine GSD ilk
 *      anlamlı satırında `#Profibus_DP` taşır (S ve F: biçim işareti). Yani
 *      "bu dosya bir GSD mi" sorusu içeriği saymadan, DOĞRUDAN cevaplanabilir.
 *      Daha zayıf bir ölçüt seçmek için sebep yok.
 *   2. **Modülsüz bir dosyayı reddetmek ÖLÇÜLEN içeriği çöpe atardı.** Modül
 *      listesi boş olsa bile hız tablosu, parametre tanımları, `PrmText`
 *      seçenekleri ve teşhis metinleri okunmuş durumdadır; bunları gösterecek
 *      tablolar hazırdır. XIF dalgasının dersi buydu: geçerli ama boş bir
 *      koleksiyonu hata saymak gerçek dosyaları reddetmek olur.
 *
 * Modülsüzlük bu yüzden `success: false` değil, satırsız bir UYARI üretir.
 */
export type GsdParseResult =
  | { readonly success: true; readonly database: GsdDatabase; readonly issues: readonly GsdParseIssue[] }
  | { readonly success: false; readonly issues: readonly GsdParseIssue[] };
