/**
 * DBC (Vector CAN veritabanı) veri modeli.
 *
 * DBC bir PROTOKOL DEĞİL, bir TANIM DOSYASIDIR: kendi teli, çerçevesi ve
 * checksum'ı yoktur. Yaptığı iş, CAN çerçevelerinin baytlarına anlam vermektir
 * — hangi identifier hangi mesaj, mesajın hangi bitleri hangi sinyal, ham sayı
 * hangi fiziksel değere ölçekleniyor. Bu yüzden `protocols/` altında değil
 * `protocol-core/definitions/` altında yaşar ve katalogda kaydı yoktur;
 * karşılığı protokol sayfalarının `Definitions` sekmesidir.
 *
 * ── SÖZ DİZİMİ KAYNAĞI ──────────────────────────────────────────────────────
 * ⚠️ Spec DBC'nin SÖZ DİZİMİNİ HİÇ VERMİYOR. `BO_`, `SG_`, `VAL_`, `CM_` gibi
 * anahtar sözcükler spec'in tamamında geçmiyor; spec yalnız SEMANTİK ALAN
 * MODELİNİ sayıyor (§17.4: "Start bit, Length, Endianness, Signed, Factor,
 * Offset, Min, Max, Unit, Enum, Multiplexing") ve dönüşüm formülünü veriyor
 * (`Physical = Raw × Factor + Offset`). Söz dizimi Vector'ün yaygın DBC
 * biçiminden alındı. Bu yüzden burada tanımlanan tipler spec'in saydığı alan
 * kümesine BİREBİR oturur; söz dizimine özgü ne varsa parser'da kalır.
 *
 * ── ÖLÇEKLENMİŞ MODEL: MESAJ ≠ ÇERÇEVE ──────────────────────────────────────
 * `ProtocolSchema` (schemas/protocolSchema.ts) TEK bir çerçeveyi tanımlar; bir
 * DBC dosyası ise N mesajlık bir VERİTABANIDIR. İkisi aynı şey değildir ve
 * `ProtocolSchema` DBC'ye uydurulmak için deforme EDİLMEZ (spec §9.6 anahtarları
 * "aynen" işaretli). Model bu yüzden kendi tiplerini taşır; istenirse tek bir
 * `DbcMessage` ayrıca `ProtocolSchema`ya çevrilebilir, tersi değil.
 */

/** Sinyalin bayt sırası. DBC'de `@1` Intel, `@0` Motorola olarak yazılır. */
export type DbcByteOrder = 'intel' | 'motorola';

/**
 * Çoklayıcı rolü. DBC'de bir mesaj aynı bitleri farklı anlamlarla tekrar
 * kullanabilir: bir sinyal ÇOKLAYICI anahtardır (`M`), diğerleri yalnız o
 * anahtarın belirli bir değerinde geçerlidir (`m0`, `m1`, …).
 */
export type DbcMultiplexRole =
  | { readonly kind: 'none' }
  | { readonly kind: 'multiplexor' }
  | { readonly kind: 'multiplexed'; readonly switchValue: number };

export interface DbcSignal {
  /** Sinyal adı VERİDİR, çevrilmez (protokol/alan adları sözlüğe girmez). */
  readonly name: string;
  /**
   * DBC'nin kendi numaralandırmasındaki başlangıç biti. Intel'de sinyalin EN
   * DÜŞÜK, Motorola'da EN YÜKSEK bitidir — dönüşüm `dbcDecoder.ts`te.
   */
  readonly startBit: number;
  readonly bitLength: number;
  readonly byteOrder: DbcByteOrder;
  readonly signed: boolean;
  /** `Physical = Raw × factor + offset` (spec §17.4). */
  readonly factor: number;
  readonly offset: number;
  readonly minimum: number;
  readonly maximum: number;
  /** Birim VERİDİR ("rpm", "degC"); boş olabilir. */
  readonly unit: string;
  readonly receivers: readonly string[];
  readonly multiplex: DbcMultiplexRole;
  /** `VAL_` tablosundan gelen ham değer → etiket eşlemesi. */
  readonly valueTable?: ReadonlyMap<number, string>;
  /** `CM_ SG_` yorumu. */
  readonly comment?: string;
}

export interface DbcMessage {
  /**
   * Bayrak bitleri AYRILMIŞ identifier. DBC dosyasında extended mesajlar
   * 0x80000000 biti set edilerek yazılır; o bayrak `extended` alanına taşınır,
   * identifier'ın içinde bırakılmaz.
   */
  readonly canId: number;
  readonly extended: boolean;
  /** Mesaj adı VERİDİR, çevrilmez. */
  readonly name: string;
  /** DBC'nin bildirdiği bayt uzunluğu (klasik CAN'de 0-8, CAN FD'de 64'e kadar). */
  readonly byteLength: number;
  readonly transmitter: string;
  readonly signals: readonly DbcSignal[];
  /** `CM_ BO_` yorumu. */
  readonly comment?: string;
}

export interface DbcDatabase {
  /** `VERSION "..."` satırı; yoksa boş. */
  readonly version: string;
  /** `BU_:` düğüm listesi. */
  readonly nodes: readonly string[];
  readonly messages: readonly DbcMessage[];
  /** Anahtarsız `CM_ "..."` yorumları. */
  readonly comments: readonly string[];
}

/**
 * Çözümleme sorunu. `protocolSchema.ts`in `SchemaParseIssue` deseni izlenir ama
 * `path` yerine SATIR NUMARASI taşınır: DBC bir metin biçimidir ve kullanıcı
 * hatayı ancak satırda bulabilir.
 */
export interface DbcParseIssue {
  /** 1-tabanlı satır numarası; dosya seviyesindeki sorunlarda 0. */
  readonly line: number;
  /** Sorunun sebebi — ÇEVİRİ ANAHTARI (görünen metin koda gömülmez). */
  readonly messageKey: string;
  /** Sorunlu ham satır, kırpılmış. Veridir, çevrilmez. */
  readonly text?: string;
}

/**
 * Çözümleme sonucu. DBC parser'ı HOŞGÖRÜLÜDÜR: tanımadığı satır dosyayı
 * reddettirmez, uyarıya çevrilir (spec §47 "hatalı veride uygulamayı
 * çökertme"). `success: false` yalnız hiç mesaj çıkarılamadığında döner —
 * o zaman elde gösterilecek bir şey yoktur.
 */
export type DbcParseResult =
  | {
      readonly success: true;
      readonly database: DbcDatabase;
      /** Atlanan/tanınmayan satırlar; boş olabilir. */
      readonly issues: readonly DbcParseIssue[];
    }
  | { readonly success: false; readonly issues: readonly DbcParseIssue[] };

/** Bir sinyalin tek bir çerçeve üzerinde çözülmüş hâli. */
export interface DbcDecodedSignal {
  readonly signal: DbcSignal;
  /** Telden okunan sayı; işaretli sinyalde iki tümleyen uygulanmış. */
  readonly rawValue: number;
  /** `raw × factor + offset`. */
  readonly physicalValue: number;
  /** `VAL_` tablosunda karşılığı varsa etiketi. */
  readonly label?: string;
  /** Bildirilen [min, max] aralığının dışındaysa true. */
  readonly outOfRange: boolean;
}
