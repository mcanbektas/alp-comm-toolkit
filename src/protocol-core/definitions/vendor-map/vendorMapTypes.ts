/**
 * Üretici kayıt haritası (`vendor-map`) veri modeli.
 *
 * ── NEDEN AYRI BİR BİÇİM ────────────────────────────────────────────────────
 * DBC ve EDS'in aksine `vendor-map`in STANDART BİR DOSYA BİÇİMİ YOKTUR ve
 * olamaz: Modbus/PMBus/SeaTalk gibi protokoller telin nasıl taşınacağını
 * söyler, ama hangi adreste ne olduğunu SÖYLEMEZ — o bilgi cihaz üreticisinin
 * kılavuzundadır (`pmbusCommands.ts`in başlığı bunu PMBus §7.1'den alıntıyla
 * yazıyor: "The product literature for each PMBus device shall describe which
 * data format is used for each command"). Kullanıcı bu tabloyu elinde bir PDF
 * ya da Excel olarak taşır.
 *
 * Bu yüzden burada TANIMLANAN bir biçim var, ithal edilen değil. İki giriş
 * kabul edilir ve ikisi de aynı modele çıkar:
 *
 * - **CSV** — birincil. Üreticinin tablosu neredeyse her zaman elektronik
 *   tabloda; kullanıcı sütun başlıklarını eşleyip kaydeder. Başlık adları
 *   esnektir (`vendorMapParser.ts`), sütun SIRASI dayatılmaz.
 * - **JSON** — aynı modelin birebir teli; başka bir araçtan üretilen haritalar
 *   ve panelin kendi dışa aktarımı için.
 *
 * ── ADRES İKİ ANLAMA GELİR ──────────────────────────────────────────────────
 * Modbus'ta adres bir REGISTER numarasıdır ve hangi adres uzayında olduğu
 * anlamı değiştirir (aynı `00 00` teli coil'de başka, holding register'da
 * başka şeydir — `modbusPdu.ts` bunu `ModbusAddressSpace` ile ayırıyor).
 * SeaTalk/PMBus/LLDP tarafında ise "adres" bir KOMUT ya da TİP kodudur.
 * Model ikisini tek alanda taşır (`address`) ve ayrımı `space` yapar; uzay
 * bilinmiyorsa `unspecified` kalır — uydurulmaz.
 */

/**
 * Değerin baytlardan nasıl okunacağı. Liste bilerek KISA: burada amaç genel bir
 * tip sistemi kurmak değil (o `schemas/fieldTypes.ts`in işi, 33 tip), üretici
 * tablolarında fiilen görülen kolonları karşılamak.
 */
export type VendorMapValueType =
  /** Tek register (2 bayt), işaretsiz. */
  | 'uint16'
  /** Tek register, iki tümleyen işaretli. */
  | 'int16'
  /** İki register; sıralarını `wordOrder` belirler. */
  | 'uint32'
  | 'int32'
  /** İki register, IEEE 754 tek duyarlık. */
  | 'float32'
  /** Tek bit ya da sıfır/bir taşıyan register (coil, discrete input). */
  | 'bool'
  /** Register'ın bitleri ayrı ayrı adlandırılır (`bits`). */
  | 'bitfield'
  /** Sayısal değerin sözlükten okunan karşılığı (`enumValues`). */
  | 'enum'
  /** `length` register boyunca ASCII metin. */
  | 'ascii'
  /** Yorumlanmaz; ham baytlar gösterilir. */
  | 'raw';

/**
 * `modbusPdu.ts`in `ModbusAddressSpace`i ile aynı dört uzay + iki genel değer.
 * Aynı birleşimi ithal etmek yerine burada tanımlanır: `vendor-map` Modbus'a
 * BAĞLI DEĞİL (PMBus komutu ve SeaTalk datagramı da bu modele giriyor), ters
 * bağımlılık kurmak protokol katmanını tanım katmanının altına sokardı.
 */
export type VendorMapAddressSpace =
  | 'coil'
  | 'discrete-input'
  | 'input-register'
  | 'holding-register'
  /** PMBus komut kodu, SeaTalk datagram tipi, LLDP TLV türü… */
  | 'command'
  /** Tabloda yazmıyor — uydurulmaz. */
  | 'unspecified';

/** 32-bit değerin iki register'a hangi sırayla dağıldığı. */
export type VendorMapWordOrder = 'high-first' | 'low-first';

/** `bitfield` girdisinin tek biti. */
export interface VendorMapBit {
  /** 0 = en düşük anlamlı bit. */
  readonly bit: number;
  /** Bit adı VERİDİR (üreticinin tablosundan gelir), çevrilmez. */
  readonly name: string;
}

export interface VendorMapEntry {
  readonly address: number;
  /** Girdi adı VERİDİR, çevrilmez. */
  readonly name: string;
  readonly type: VendorMapValueType;
  readonly space: VendorMapAddressSpace;
  /**
   * `ascii` ve `raw` için register sayısı. Diğer tiplerde uzunluk tipten gelir
   * ve bu alan yok sayılır — tabloda yazsa bile tipin genişliği kazanır, aksi
   * hâlde iki kaynak çelişince hangisinin doğru olduğu belirsiz kalırdı.
   */
  readonly length?: number;
  /** Fiziksel değer = ham × scale + offset (ölçek yoksa 1, ofset yoksa 0). */
  readonly scale?: number;
  readonly offset?: number;
  /** Birim VERİDİR ("V", "kWh"), çevrilmez. */
  readonly unit?: string;
  readonly access?: 'r' | 'w' | 'rw';
  /** Girdiye özel sıra; verilmezse haritanın `defaultWordOrder`u geçerli. */
  readonly wordOrder?: VendorMapWordOrder;
  /** Anahtarlar ondalık sayı METNİdir — `schemas`taki `enumValues` ile aynı sözleşme. */
  readonly enumValues?: Readonly<Record<string, string>>;
  readonly bits?: readonly VendorMapBit[];
  readonly description?: string;
}

export interface VendorMap {
  /** Cihaz/harita adı VERİDİR, çevrilmez. */
  readonly device: string;
  readonly vendor?: string;
  readonly revision?: string;
  /**
   * Modbus 32-bit değerlerde sıra ÜRETİCİYE göre değişir ve standart bunu
   * söylemez; yanlış sıra sessizce anlamsız sayı üretir (0x0001_0000 yerine
   * 0x0000_0001). Varsayılan `high-first` — sahada baskın olan, ama harita
   * bunu ezebilsin diye alan tabloda taşınıyor.
   */
  readonly defaultWordOrder: VendorMapWordOrder;
  readonly entries: readonly VendorMapEntry[];
}

/**
 * Ayrıştırma sorunu. `messageKey` sözlükte varsa çevrilir, yoksa olduğu gibi
 * basılır — `EdsParseIssue`in aynı sözleşmesi.
 */
export interface VendorMapIssue {
  /** 1-tabanlı satır; dosya düzeyindeki sorunlarda 0. */
  readonly line: number;
  readonly messageKey: string;
  /** Sorunlu ham metin — kullanıcı satırı bulabilsin diye. */
  readonly text?: string;
}

export type VendorMapParseResult =
  | { readonly success: true; readonly map: VendorMap; readonly issues: readonly VendorMapIssue[] }
  | { readonly success: false; readonly issues: readonly VendorMapIssue[] };
