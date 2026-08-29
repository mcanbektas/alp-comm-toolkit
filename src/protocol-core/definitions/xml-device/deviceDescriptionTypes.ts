/**
 * XML tabanlı aygıt tanım dosyalarının ORTAK modeli — GSDML (PROFINET), IODD
 * (IO-Link) ve SCL (IEC 61850).
 *
 * ── NEDEN TEK MODEL ─────────────────────────────────────────────────────────
 * Üç biçim ayrı standartlardan geliyor ve söz dizimleri farklı, ama
 * `Definitions` sekmesinin sorduğu soru aynı: **bu aygıtta hangi veri kalemi
 * var, hangi tipte, nerede duruyor ve ham sayının anlamı ne?** Üç ayrı panel
 * yazmak, aynı tabloyu üç kez çizip üç kez çevirmek olurdu.
 *
 * Ortaklaştırma İÇERİĞİ DÜZLEŞTİRMEZ: biçime özgü kimlik alanları (`VendorID`,
 * IO-Link revizyonu, IED adı) `identity` listesinde ETİKETİYLE taşınır, çünkü
 * onları tek bir "cihaz adı" alanına sıkıştırmak, kullanıcının dosyada gördüğü
 * bilgiyi kaybetmek demek.
 *
 * ── ORTAKLAŞTIRILMAYAN ŞEY: ANLAM ───────────────────────────────────────────
 * `dataType` alanı biçimin KENDİ yazdığı metni taşır (`Unsigned8`,
 * `UIntegerT`, `BOOLEAN`) ve normalize EDİLMEZ. Üçünü tek bir iç tip
 * kümesine çevirmek, dosyada yazmayan bir kesinlik uydurmak olurdu; çözüm
 * (`deviceItemDecoder.ts`) eşlemeyi kendi tablosunda, açıkça yapıyor.
 */

export type DeviceDescriptionFormat = 'gsdml' | 'iodd' | 'scl';

/**
 * Kalemin hangi kümeye ait olduğu. Aynı dosyada iki farklı şey bulunuyor ve
 * karıştırmak yanıltıcı: parametre YAZILIR (kurulumda ayarlanır), süreç verisi
 * çevrimde AKAR (her döngüde okunur).
 */
export type DeviceItemGroup = 'parameter' | 'process-data' | 'data-object';

export interface DeviceItem {
  /** Biçimin kendi kimliği: GSDML `ID`, IODD `index[.subindex]`, SCL yol adı. */
  readonly id: string;
  /** Ad VERİDİR (metin listesinden çözülür), çevrilmez. */
  readonly name: string;
  readonly group: DeviceItemGroup;
  /** Dosyada YAZAN tip adı; normalize edilmez. */
  readonly dataType: string;
  /**
   * Yerleşim: çerçevenin BAŞINDAN (en yüksek bitten) itibaren bit konumu.
   *
   * Tek anlam dayatılıyor, çünkü kaynaklar farklı sayıyor: GSDML `ByteOffset`
   * baştan, IODD `bitOffset` ise süreç verisinin SONUNDAN (en düşük bitten)
   * sayar. İkisini olduğu gibi taşımak, aynı alanın iki farklı anlama geldiği
   * bir model olurdu ve çözüm sessizce yanlış biti okurdu; dönüşüm okuyucuda,
   * toplam uzunluğun bilindiği yerde yapılır.
   */
  readonly bitOffset?: number;
  readonly bitLength?: number;
  readonly access?: string;
  readonly unit?: string;
  readonly defaultValue?: string;
  readonly description?: string;
  /** Sayısal değerin sözel karşılığı; anahtar ondalık sayı METNİ. */
  readonly values?: Readonly<Record<string, string>>;
}

/** Biçime özgü kimlik satırı: etiket dosyanın kendi terimidir, çevrilmez. */
export interface DeviceIdentityEntry {
  readonly label: string;
  readonly value: string;
}

export interface DeviceDescription {
  readonly format: DeviceDescriptionFormat;
  /** Üretici ve aygıt adı VERİDİR, çevrilmez; bulunamazsa boş kalır. */
  readonly vendor: string;
  readonly device: string;
  readonly identity: readonly DeviceIdentityEntry[];
  readonly items: readonly DeviceItem[];
}

/** `messageKey` sözlükte varsa çevrilir — öteki tanım motorlarıyla aynı sözleşme. */
export interface DeviceDescriptionIssue {
  readonly line: number;
  readonly messageKey: string;
  readonly text?: string;
}

export type DeviceDescriptionResult =
  | {
      readonly success: true;
      readonly description: DeviceDescription;
      readonly issues: readonly DeviceDescriptionIssue[];
    }
  | { readonly success: false; readonly issues: readonly DeviceDescriptionIssue[] };
