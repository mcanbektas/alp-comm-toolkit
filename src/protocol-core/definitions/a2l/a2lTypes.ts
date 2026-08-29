/**
 * A2L (ASAM MCD-2 MC, eski adıyla ASAP2) veri modeli.
 *
 * A2L bir PROTOKOL DEĞİL, bir TANIM DOSYASIDIR: XCP/CCP'nin okuduğu ECU
 * belleğinde hangi adreste hangi ölçüm değişkeni var, hangi veri tipinde ve
 * ham sayının fiziksel karşılığı hangi formülle çıkıyor — hepsi burada yazar.
 * `automotive.ts`teki XCP kaydı bunu açıkça söylüyor: "Ham DTO baytları A2L
 * olmadan anlamsızdır."
 *
 * ── SÖZ DİZİMİ KAYNAĞI ──────────────────────────────────────────────────────
 * Anahtar kelimeler, blok yapısı (`/begin X … /end X`) ve MEASUREMENT /
 * COMPU_METHOD / COMPU_VTAB parametre SIRASI **ASAM MCD-2 MC (ASAP2) V1.6**
 * belgesinden alındı. Bu repo'nun spec özeti A2L söz dizimini vermiyor —
 * DBC'nin Vector söz diziminden, EDS'in CiA 306'dan alınmasıyla aynı durum ve
 * aynı açıklama.
 *
 * ── KAPSAM ──────────────────────────────────────────────────────────────────
 * A2L devasa bir biçimdir (RECORD_LAYOUT, AXIS_DESCR, FUNCTION, GROUP,
 * IF_DATA, A2ML…). Burada `Definitions` sekmesinin cevaplaması gereken tek
 * soru hedeflendi: **"şu adresteki şu baytlar ne anlama geliyor?"** Bunun için
 * MEASUREMENT, CHARACTERISTIC, COMPU_METHOD ve COMPU_VTAB yeter. Kapsam dışı
 * bloklar ATLANIR — hata değildir, dosyanın çoğu zaten onlardır.
 */

/** ASAM veri tipleri; `a2lDecoder.ts` bunları bayta çevirir. */
export type A2lDataType =
  | 'UBYTE'
  | 'SBYTE'
  | 'UWORD'
  | 'SWORD'
  | 'ULONG'
  | 'SLONG'
  | 'A_UINT64'
  | 'A_INT64'
  | 'FLOAT16_IEEE'
  | 'FLOAT32_IEEE'
  | 'FLOAT64_IEEE';

/**
 * Dönüşüm türü. Dördü destekleniyor; kalanlar (TAB_INTP, TAB_NOINTP, FORM…)
 * tanınır ama uygulanmaz — çözüm ham değeri gösterip nedenini söyler,
 * uydurulmuş bir formülle yanlış fiziksel değer basmaz.
 */
export type A2lConversionType =
  | 'IDENTICAL'
  | 'LINEAR'
  | 'RAT_FUNC'
  | 'TAB_VERB'
  | 'TAB_INTP'
  | 'TAB_NOINTP'
  | 'FORM'
  | 'UNKNOWN';

/** MSB_FIRST = big-endian. A2L varsayılanı modül düzeyindedir (`MOD_COMMON`). */
export type A2lByteOrder = 'MSB_FIRST' | 'MSB_LAST';

export interface A2lCompuMethod {
  /** Ad VERİDİR (A2L'den gelir), çevrilmez. */
  readonly name: string;
  readonly longIdentifier: string;
  readonly conversionType: A2lConversionType;
  /** Birim VERİDİR ("km/h", "°C"), çevrilmez. */
  readonly unit: string;
  /**
   * LINEAR'ın iki katsayısı: `phys = a × int + b`.
   */
  readonly coeffsLinear?: readonly [number, number];
  /**
   * RAT_FUNC'ın altı katsayısı `[a, b, c, d, e, f]`.
   *
   * **YÖN TUZAĞI:** ASAM'ın formülü fiziksel değerden HAM değere gider —
   * `int = (a·phys² + b·phys + c) / (d·phys² + e·phys + f)`. Çözümleme ters
   * yöne ihtiyaç duyar ve bu ancak ikinci derece terimler yokken kapalı
   * biçimde çözülür (`a = d = e = 0` → `phys = (f·int − c) / b`). Katsayıları
   * doğrudan `phys = b·int + c` gibi okumak, LINEAR ile RAT_FUNC'ı
   * karıştırmak demektir ve sessizce yanlış sayı üretir.
   */
  readonly coeffs?: readonly [number, number, number, number, number, number];
  /** TAB_VERB için `COMPU_VTAB` adı. */
  readonly compuTabRef?: string;
}

/** `COMPU_VTAB`: ham değer → sözel karşılık. */
export interface A2lVerbalTable {
  readonly name: string;
  readonly longIdentifier: string;
  /** Anahtar ondalık sayı METNİdir — `schemas`/`vendor-map` ile aynı sözleşme. */
  readonly values: Readonly<Record<string, string>>;
}

export interface A2lMeasurement {
  readonly name: string;
  readonly longIdentifier: string;
  readonly dataType: A2lDataType;
  /** `COMPU_METHOD` adı; `NO_COMPU_METHOD` yazan dosyalarda boş kalır. */
  readonly conversion: string;
  readonly lowerLimit: number;
  readonly upperLimit: number;
  readonly ecuAddress?: number;
  /** Girdiye özel bayt sırası; yoksa modül varsayılanı geçerli. */
  readonly byteOrder?: A2lByteOrder;
  /** `BIT_MASK` — ham değere okumadan SONRA uygulanır ve sağa kaydırılır. */
  readonly bitMask?: number;
  readonly unit?: string;
}

/** Kalibrasyon parametresi. Ölçümden farkı: adresi YAZILABİLİR bir değere işaret eder. */
export interface A2lCharacteristic {
  readonly name: string;
  readonly longIdentifier: string;
  /** VALUE, CURVE, MAP, VAL_BLK… — ham metin tutulur, yorumu panelin işi değil. */
  readonly type: string;
  readonly address: number;
  readonly conversion: string;
  readonly lowerLimit: number;
  readonly upperLimit: number;
}

export interface A2lDatabase {
  /** PROJECT adı VERİDİR, çevrilmez. */
  readonly project: string;
  readonly module: string;
  readonly moduleDescription: string;
  /** `MOD_COMMON` içindeki varsayılan; yazmıyorsa ASAM varsayılanı MSB_LAST. */
  readonly defaultByteOrder: A2lByteOrder;
  readonly measurements: readonly A2lMeasurement[];
  readonly characteristics: readonly A2lCharacteristic[];
  readonly compuMethods: readonly A2lCompuMethod[];
  readonly verbalTables: readonly A2lVerbalTable[];
}

/** `messageKey` sözlükte varsa çevrilir — `EdsParseIssue`in aynı sözleşmesi. */
export interface A2lParseIssue {
  readonly line: number;
  readonly messageKey: string;
  readonly text?: string;
}

export type A2lParseResult =
  | { readonly success: true; readonly database: A2lDatabase; readonly issues: readonly A2lParseIssue[] }
  | { readonly success: false; readonly issues: readonly A2lParseIssue[] };
