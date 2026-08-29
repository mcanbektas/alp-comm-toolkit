/**
 * DSDL (Cyphal / DroneCAN veri yapısı dili) veri modeli.
 *
 * DSDL bir PROTOKOL DEĞİL, bir TANIM DİLİDİR: hangi mesajda hangi alan var,
 * hangi genişlikte ve hangi sırada — hepsi `.dsdl` dosyalarında yazar.
 * Katalog kaydı (`aerospace-uav.ts`) bunu şöyle işaretlemişti: "DSDL alanları
 * bit-packed'dir ve byte hizası garanti değildir."
 *
 * ── SÖZ DİZİMİ KAYNAĞI ──────────────────────────────────────────────────────
 * OpenCyphal, "Cyphal Specification" v1.0 §3 (Data Structure Description
 * Language). DroneCAN'in DSDL'i aynı dilin eski sürümüdür ve buradaki alt
 * küme ikisinde de aynı yazılır: ilkel tipler, sabit/değişken diziler, `void`
 * dolgusu, sabitler, servis ayracı `---`.
 *
 * ── KAPSAM ──────────────────────────────────────────────────────────────────
 * Panelin cevaplaması gereken soru: bu mesajda hangi alan var ve baytların
 * neresine düşüyor. Bunun için ilkel alanlar, `void` dolgusu, sabitler,
 * yönergeler ve servis bölümleri yeter. **Bileşik tipler ÇÖZÜLMEZ** (başka
 * dosyalardaki tanımlara başvururlar ve tek dosya elde yokken genişlikleri
 * bilinemez) — tabloda GÖRÜNÜRLER ama yerleşimleri "bilinmiyor" kalır,
 * uydurulmaz.
 */

/** İlkel tipin nasıl okunacağı. `void` yalnız yer kaplar, değeri yoktur. */
export type DsdlPrimitiveKind = 'unsigned' | 'signed' | 'float' | 'bool' | 'void';

export interface DsdlPrimitive {
  readonly kind: DsdlPrimitiveKind;
  readonly bitLength: number;
}

/**
 * Dizi türü:
 * - `fixed`  → `uint8[4]`, uzunluk sabittir.
 * - `variable` → `uint8[<=50]`, telde önce uzunluk alanı gelir; uzunluk
 *   alanının genişliği azami eleman sayısını gösterecek kadar bittir.
 */
export interface DsdlArraySpec {
  readonly mode: 'fixed' | 'variable';
  readonly capacity: number;
}

export interface DsdlField {
  /** Alan adı VERİDİR, çevrilmez. `void` dolgusunda boş kalır. */
  readonly name: string;
  /** Dosyada YAZAN tip metni (`saturated uint16`, `uavcan.node.Health.1.0`). */
  readonly typeText: string;
  /** İlkel tipse çözümü; bileşik tipte `undefined`. */
  readonly primitive?: DsdlPrimitive;
  readonly array?: DsdlArraySpec;
  /**
   * Çerçevenin başından bit konumu. Kendisinden ÖNCEKİ alanların hepsi sabit
   * genişlikteyse hesaplanabilir; değişken uzunluklu bir dizi ya da bileşik
   * tip geçildiği anda sonraki alanların konumu telin içeriğine bağlanır ve
   * burada `undefined` kalır.
   */
  readonly bitOffset?: number;
  /** Sabit genişlik; değişken/bileşik alanda `undefined`. */
  readonly bitLength?: number;
  readonly comment?: string;
}

export interface DsdlConstant {
  readonly name: string;
  readonly typeText: string;
  /** Ham metin: sayı, karakter sabiti ya da ifade olabilir; yorumlanmaz. */
  readonly value: string;
}

/** Mesaj tipi tek bölümdür; servis tipi `---` ile ikiye ayrılır. */
export type DsdlSectionKind = 'message' | 'request' | 'response';

export interface DsdlSection {
  readonly kind: DsdlSectionKind;
  readonly fields: readonly DsdlField[];
  readonly constants: readonly DsdlConstant[];
  /** `@extent`, `@sealed`, `@union`… — ham satır olarak tutulur. */
  readonly directives: readonly string[];
}

export interface DsdlDefinition {
  readonly sections: readonly DsdlSection[];
  /** Servis tipi mi (iki bölüm) — panel bunu ayrıca gösterir. */
  readonly isService: boolean;
}

export interface DsdlParseIssue {
  readonly line: number;
  readonly messageKey: string;
  readonly text?: string;
}

export type DsdlParseResult =
  | { readonly success: true; readonly definition: DsdlDefinition; readonly issues: readonly DsdlParseIssue[] }
  | { readonly success: false; readonly issues: readonly DsdlParseIssue[] };
