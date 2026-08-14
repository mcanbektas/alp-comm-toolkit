/**
 * EDS (CiA 306 Electronic Data Sheet) veri modeli.
 *
 * DBC gibi EDS de bir PROTOKOL DEĞİL, bir TANIM DOSYASIDIR: CANopen'ın Object
 * Dictionary'sini (hangi index/sub-index hangi parametre, hangi veri tipinde,
 * hangi erişimle) tarif eder. `protocols/` altında değil `protocol-core/
 * definitions/` altında yaşar, DBC motorunun BİREBİR desenini izler
 * (`dbcTypes.ts` ile karşılaştır).
 *
 * ── SÖZ DİZİMİ KAYNAĞI ──────────────────────────────────────────────────────
 * Spec EDS biçimini SIFIR veriyor (karar turu, brief-faz10-dalga1.md): 0 bölüm,
 * 0 anahtar, 0 örnek. Spec yalnız Object Dictionary'nin SEMANTİK alan kümesini
 * sayıyor (ana dok. ~7849-7867: Index, Sub-index, Name, Data Type, Access, Raw,
 * Physical, Default, Min, Max). Söz dizimi (INI bölümleri, `ParameterName=`,
 * `[XXXXsubYY]` başlığı) CiA 306'dan alındı — DBC'nin Vector söz diziminden
 * alınmasıyla AYNI gerekçe, aynı disclosure deseni.
 *
 * ── İÇERİK/ÇERÇEVE SINIRININ KAPANDIĞI YER ──────────────────────────────────
 * `canopen.ts` (dalga 1b) COB-ID'den mesaj TİPİNİ tanır ama payload'ı ham
 * bırakır — "EDS gerekir" uyarısıyla. Bu dosya TAM OLARAK o boşluğu doldurur:
 * bir Index/Sub-index çiftini insan-okunur bir isme ve veri tipine bağlar.
 */

/** `ParameterName=`, `DataType=` gibi anahtarlar VERİDİR; ham metin tutulur —
 * yorumu (hex mi ondalık mı, hangi DataType'a göre) `edsDecoder.ts`in işi. */
export interface EdsObject {
  /** 16-bit Object Dictionary index'i. */
  readonly index: number;
  /** Sub-index; üst nesnenin (VAR/ARRAY/RECORD kök girdisi) kendisinde yok. */
  readonly subIndex: number | undefined;
  /** Parametre adı VERİDİR, çevrilmez. */
  readonly parameterName: string;
  /** CiA 306 ObjectType kodu (0x7 VAR, 0x8 ARRAY, 0x9 RECORD); yoksa `undefined`. */
  readonly objectType: number | undefined;
  /** CiA 301 DataType kodu (`edsDecoder.ts`teki `EDS_DATA_TYPES` ile çözülür). */
  readonly dataType: number | undefined;
  /** `ro`/`wo`/`rw`/`rww`/`rwr`/`const` — ham metin, küçük harfe çevrilmiş. */
  readonly accessType: string | undefined;
  /** Ham metin: hex (`0x...`) ya da ondalık olabilir, DataType'a göre yorumlanır. */
  readonly defaultValue: string | undefined;
  readonly lowLimit: string | undefined;
  readonly highLimit: string | undefined;
  /** `PDOMapping=1` ise bu nesne bir PDO'ya eşlenebilir. */
  readonly pdoMapping: boolean | undefined;
}

export interface EdsFileInfo {
  readonly fileName: string;
  readonly description: string;
}

export interface EdsDeviceInfo {
  readonly vendorName: string;
  readonly productName: string;
}

export interface EdsDatabase {
  readonly fileInfo: EdsFileInfo;
  readonly deviceInfo: EdsDeviceInfo;
  readonly objects: readonly EdsObject[];
}

/** `dbcTypes.ts`teki `DbcParseIssue` ile birebir aynı şekil. */
export interface EdsParseIssue {
  readonly line: number;
  readonly messageKey: string;
  readonly text?: string;
}

/**
 * `success: false` yalnız hiç Object Dictionary girdisi çıkarılamadığında
 * döner (`dbcTypes.ts`teki `DbcParseResult` ile aynı sözleşme).
 */
export type EdsParseResult =
  | { readonly success: true; readonly database: EdsDatabase; readonly issues: readonly EdsParseIssue[] }
  | { readonly success: false; readonly issues: readonly EdsParseIssue[] };

/** Bir Object Dictionary girdisinin ham baytlardan çözülmüş değeri. */
export interface EdsDecodedValue {
  /** CiA 301 DataType adı (`UNSIGNED16` gibi) — protokol terimi, çevrilmez. */
  readonly dataTypeName: string;
  readonly value: number | string;
}
