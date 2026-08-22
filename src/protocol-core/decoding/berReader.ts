/**
 * ASN.1 BER/DER TLV yürüyüşü — saf, paylaşılan çözümleme yardımcısı.
 *
 * İlk tüketicisi IEC 61850 GOOSE (faz 10, dalga 5e); ileride MMS ve SNMP de
 * BER'le kodlanır ve aynı üç adımı ister (tag oku · length oku · value sınırını
 * bul). Bu yüzden yardımcı `protocol-core/decoding/`e, `bitCursor`ın yanına
 * kondu. İkisi FARKLI iş yapar ve karıştırılmamalı: `bitCursor` düzeni ÖNCEDEN
 * BİLİNEN bir alandan bit çeker; BER ise kendini tarif eden bir yapıdır — bir
 * sonraki alanın nerede bittiğini ancak akışın kendisi söyler.
 *
 * ── TASARIM KARARLARI ───────────────────────────────────────────────────────
 * Bu API'deki bir hata ileride MMS/SNMP'ye taşınacağı için kararlar burada
 * gerekçesiyle yazıldı; sonradan değiştirmenin bedeli her tüketiciye dokunmaktır.
 *
 * **1. FIRLATMAZ — `{ ok: true, … } | { ok: false, error, offset }` döner.**
 * `bitCursor` `RangeError` fırlatır ve bu bilinçli bir asimetridir: orada hata
 * PROGRAMLAMA hatasıdır (şema arabelleğin dışını istedi). Burada ise hata VERİ
 * hatasıdır — tel yalan söylemiştir. Protokol motorları kısmi sonuç basmak
 * zorundadır (`ParseResult` sözleşmesi, spec §47 "hatalı veride uygulamayı
 * çökertme"); exception, o ana kadar çözülmüş alanları da götürürdü. Union
 * `ParseResult`ün `success` yerine `ok` ayırıcısını kullanır: bu tip bir
 * `ParseResult` DEĞİLDİR, iki sözleşme birbirine karışmasın.
 *
 * **2. Ofsetler HAM arabelleğe göre MUTLAKtır.** Fonksiyonlar dilim (`subarray`)
 * almaz, `bytes + offset` alır. Sebep: `ParsedField.offset` ham çerçeveye göre
 * verilmek zorundadır (byte-viewer onu vurgular) ve iç içe TLV'lerde dilim
 * üstüne dilim almak her seviyede bir ofset toplama hatası riski demektir.
 *
 * **3. Long-form tag (tag baytının alt 5 biti 0x1F) DESTEKLENMEZ → açık hata.**
 * Sessizce 31 diye okumak — X.690'ın "sonraki baytlar base-128 devam eder"
 * kuralını görmezden gelmek — sessiz-yanlış çözümleme olurdu; bu depoda yasak.
 * Neden desteklemek yerine reddetmek: (a) GOOSE'un en büyük etiketi 17'dir,
 * MMS'in kullandığı küme de 30'un altındadır, yani bugün tüketicisi olmayan bir
 * base-128 döngüsü TEST EDİLMEMİŞ kod olarak dururdu — paylaşılan bir yardımcıda
 * en kötü şey budur; (b) reddetme GÜRÜLTÜLÜdür: çağıran `long-form-tag` kodunu
 * alır, alanı ham basar ve uyarır. Gerçekten gerektiğinde eklenmesi geriye dönük
 * UYUMLUDUR: `BerTag.number` zaten `number`, hata kodu erişilemez hâle gelir,
 * çağıranların hiçbiri değişmez.
 *
 * **4. Indefinite length (0x80) DESTEKLENMEZ → açık hata.** DER'de zaten
 * yasaktır ve GOOSE/MMS belirli-uzunluk kullanır. Desteklemek uzunluğu bilinmeyen
 * bir değeri atlayabilmek için içeriğin TAMAMINI özyinelemeli çözüp EOC (00 00)
 * aramak demektir — yani derinlik/eleman sınırı gibi POLİTİKA kararlarını saf bir
 * yardımcının içine taşımak. O politika protokole göre değişir ve çağıranda
 * kalmalıdır (bkz. karar 6).
 *
 * **5. Uzunluk oktet sayısı 4'le sınırlı; 0xFF reddedilir.** 4 oktet 4 GiB tarif
 * eder — `Uint8Array` ile indekslenebilecek her şeyin üstünde. 0xFF (N=127)
 * X.690'da AYRILMIŞtır, uzunluk değildir. TUZAK: uzunluk oktetleri `<<` ile
 * birleştirilirse 4. oktette işaret bitine taşar ve NEGATİF çıkar; burada
 * `* 0x100` kullanılıyor (sonuç 0xFFFFFFFF'e kadar `number` içinde güvenli).
 *
 * **6. Kapsam bilinçli DAR: döngü/derinlik/şema YOK.** Yardımcı tek bir TLV
 * okur; SEQUENCE içinde yürümek, kaç eleman kabul edileceği, kaç seviye
 * inileceği çağıranın işidir — çünkü bu sınırlar protokole göre değişir
 * (GOOSE'un dataset'i ile SNMP'nin VarBind listesi aynı politikayı paylaşmaz).
 * Matter TLV (dalga 7) BAŞKA bir kodlamadır; bu modül ona genelleştirilmez.
 *
 * **7. Uzun formda MİNİMAL OLMAYAN uzunluk KABUL EDİLİR** (ör. `81 05`, `05`
 * yerine). BER buna izin verir, DER vermez. Ayrımı burada hata saymak yerine
 * `lengthOctets` dışa veriliyor: DER katılığı isteyen çağıran `lengthOctets`e
 * bakıp kendi uyarısını basar.
 *
 * ── KAYNAK ──────────────────────────────────────────────────────────────────
 * Kodlama kuralları ITU-T X.690'dır ve KAMUYA AÇIKtır (ITU tavsiyeleri ücretsiz
 * indirilebilir): tag baytının sınıf/constructed/numara bölümlemesi, kısa/uzun
 * form uzunluk, indefinite form ve INTEGER'ın iki tümleyen + minimal oktet
 * kuralı oradan alındı. Lisanslı olan IEC 61850-8-1'in ALAN AĞACIdır, taşıyıcı
 * kodlama değil — o yüzden bu dosyada ikincil-kaynak sentezi yoktur.
 */

/** Tag baytının bit 7-6'sı. X.690 §8.1.2.2. */
export type BerTagClass = 'universal' | 'application' | 'context-specific' | 'private';

/**
 * Kapalı union — çağıran bunları switch'ler ve kendi çeviri anahtarına eşler.
 * `ProtocolErrorCode`den AYRIdır: bunlar kodlama katmanının hataları, o ise
 * protokol katmanının.
 */
export type BerErrorCode =
  /** Arabellek (ya da verilen sınır) istenen baytlardan önce bitti. */
  | 'truncated'
  /** Tag baytının alt 5 biti 0x1F — çok baytlı etiket (karar 3). */
  | 'long-form-tag'
  /** Uzunluk baytı 0x80 — belirsiz uzunluk (karar 4). */
  | 'indefinite-length'
  /** Uzunluk baytı 0xFF — X.690'da ayrılmış, uzunluk değil. */
  | 'reserved-length-octet'
  /** Uzun formda 4'ten çok uzunluk okteti (karar 5). */
  | 'length-octets-unsupported'
  /** Uzunluk alanının vaat ettiği değer sınırın dışına taşıyor. */
  | 'value-overflow'
  /** TLV yapısal olarak sağlam ama değer uzunluğu tipe uymuyor (ör. 2 baytlık BOOLEAN). */
  | 'unexpected-value-length';

export interface BerFailure {
  readonly ok: false;
  readonly error: BerErrorCode;
  /** Hatanın görüldüğü MUTLAK bayt ofseti — `ProtocolError.offset`e doğrudan verilebilir. */
  readonly offset: number;
}

/**
 * Kesişim (`{ ok: true } & TValue`) tercih edildi: çağıran `if (!result.ok)
 * return …` dedikten sonra alanlara sarmalayıcı olmadan erişir. `ok` iki
 * kolda da literal olduğu için daraltma çalışır.
 */
export type BerResult<TValue> = ({ readonly ok: true } & TValue) | BerFailure;

export interface BerTag {
  readonly tagClass: BerTagClass;
  /** bit 5: değer başka TLV'ler içeriyor mu (SEQUENCE/SET/yapı). */
  readonly constructed: boolean;
  /** bit 4-0. Long-form reddedildiği için her zaman 0-30 aralığındadır. */
  readonly number: number;
  /** Ham tag baytı — protokoller alanları çoğu zaman bu bayta göre switch'ler (ör. GOOSE 0xAB). */
  readonly byte: number;
}

export interface BerTagRead {
  readonly tag: BerTag;
  /** Tag baytından SONRAKİ mutlak ofset — uzunluk alanının ilk baytı. */
  readonly nextOffset: number;
}

export interface BerLengthRead {
  readonly length: number;
  /** Uzunluk alanının kendi bayt sayısı: kısa formda 1, uzun formda 1 + N (karar 7). */
  readonly lengthOctets: number;
  /** Uzunluk alanından SONRAKİ mutlak ofset — değerin ilk baytı. */
  readonly nextOffset: number;
}

export interface BerTlv {
  readonly tag: BerTag;
  /** TLV'nin ilk baytı (tag baytı), mutlak. */
  readonly offset: number;
  /** Değerin ilk baytı, mutlak. */
  readonly valueOffset: number;
  /** Değerin bayt uzunluğu. */
  readonly length: number;
  /** TLV'den SONRAKİ ilk bayt (`valueOffset + length`), mutlak — sıradaki TLV buradan başlar. */
  readonly end: number;
  /** tag + length baytlarının toplamı (`valueOffset - offset`). */
  readonly headerLength: number;
}

export interface BerIntegerRead {
  readonly value: bigint;
}

export interface BerBooleanRead {
  readonly value: boolean;
  /**
   * DER TRUE için 0xFF şart koşar, BER "sıfırdan farklı her şey" der. Değer
   * TRUE ve oktet 0xFF değilse `false` döner — çağıran isterse uyarır.
   */
  readonly derCompliant: boolean;
}

export interface BerStringRead {
  readonly text: string;
  /** VisibleString kümesi (0x20-0x7E) dışında bayt varsa `false` — çağıran ham basmayı seçebilir. */
  readonly printable: boolean;
}

const TAG_CLASS_MASK = 0xc0;
const TAG_CLASS_SHIFT = 6;
const TAG_CONSTRUCTED_MASK = 0x20;
const TAG_NUMBER_MASK = 0x1f;
/** Alt 5 bitin hepsi 1 ise numara sonraki baytlarda devam eder (karar 3). */
const TAG_LONG_FORM_MARKER = 0x1f;

const LENGTH_LONG_FORM_FLAG = 0x80;
const LENGTH_OCTET_COUNT_MASK = 0x7f;
const LENGTH_INDEFINITE_OCTET = 0x80;
const LENGTH_RESERVED_OCTET = 0xff;
/** Karar 5: 4 oktet = 4 GiB; üstü `Uint8Array` ile indekslenemez zaten. */
export const MAX_BER_LENGTH_OCTETS = 4;

const BYTE_RADIX = 0x100;
const SIGN_BIT_MASK = 0x80;
const BITS_PER_BYTE = 8;
const BER_TRUE_OCTET = 0xff;
const BOOLEAN_VALUE_LENGTH = 1;
const VISIBLE_STRING_MIN = 0x20;
const VISIBLE_STRING_MAX = 0x7e;

function failure(error: BerErrorCode, offset: number): BerFailure {
  return { ok: false, error, offset };
}

function classOf(tagByte: number): BerTagClass {
  switch ((tagByte & TAG_CLASS_MASK) >>> TAG_CLASS_SHIFT) {
    case 0:
      return 'universal';
    case 1:
      return 'application';
    case 2:
      return 'context-specific';
    default:
      return 'private';
  }
}

/**
 * Tek bayt tag okur. Long-form etiket (0x1F) açık hatayla reddedilir — sessizce
 * 31 diye okunmaz (karar 3).
 */
export function readBerTag(bytes: Uint8Array, offset: number): BerResult<BerTagRead> {
  // noUncheckedIndexedAccess: sınır kontrolü indeksin kendisiyle yapılır.
  const tagByte = bytes[offset];
  if (tagByte === undefined) {
    return failure('truncated', offset);
  }
  const number = tagByte & TAG_NUMBER_MASK;
  if (number === TAG_LONG_FORM_MARKER) {
    return failure('long-form-tag', offset);
  }
  return {
    ok: true,
    tag: {
      tagClass: classOf(tagByte),
      constructed: (tagByte & TAG_CONSTRUCTED_MASK) !== 0,
      number,
      byte: tagByte,
    },
    nextOffset: offset + 1,
  };
}

/**
 * Uzunluk alanını okur: kısa form (bit 7 = 0 → 0-127) ya da uzun form (bit 7 = 1
 * → alt 7 bit sonraki N oktetin sayısı). 0x80 (indefinite, karar 4), 0xFF
 * (ayrılmış) ve N > 4 (karar 5) reddedilir.
 */
export function readBerLength(bytes: Uint8Array, offset: number): BerResult<BerLengthRead> {
  const firstOctet = bytes[offset];
  if (firstOctet === undefined) {
    return failure('truncated', offset);
  }

  if ((firstOctet & LENGTH_LONG_FORM_FLAG) === 0) {
    return { ok: true, length: firstOctet, lengthOctets: 1, nextOffset: offset + 1 };
  }
  if (firstOctet === LENGTH_INDEFINITE_OCTET) {
    return failure('indefinite-length', offset);
  }
  if (firstOctet === LENGTH_RESERVED_OCTET) {
    return failure('reserved-length-octet', offset);
  }

  const octetCount = firstOctet & LENGTH_OCTET_COUNT_MASK;
  if (octetCount > MAX_BER_LENGTH_OCTETS) {
    return failure('length-octets-unsupported', offset);
  }

  let length = 0;
  for (let index = 0; index < octetCount; index += 1) {
    const position = offset + 1 + index;
    const octet = bytes[position];
    if (octet === undefined) {
      return failure('truncated', position);
    }
    // `<<` DEĞİL: 4. oktette işaret bitine taşar ve negatif üretir (karar 5).
    length = length * BYTE_RADIX + octet;
  }

  return {
    ok: true,
    length,
    lengthOctets: 1 + octetCount,
    nextOffset: offset + 1 + octetCount,
  };
}

/**
 * Tam bir TLV'nin sınırlarını çıkarır. `limit`, değerin taşmaması gereken ÜST
 * sınırdır (mutlak, dışlayıcı): iç içe yürüyüşte ANA TLV'nin `end`i verilir,
 * böylece bir çocuk kardeşinin alanına sarkamaz. Verilmezse arabelleğin sonu
 * kullanılır.
 *
 * Değerin İÇİ okunmaz — bu fonksiyon yalnız "nerede başlıyor, nerede bitiyor"
 * sorusunu cevaplar (karar 6).
 */
export function readBerTlv(
  bytes: Uint8Array,
  offset: number,
  limit: number = bytes.length,
): BerResult<BerTlv> {
  const effectiveLimit = Math.min(limit, bytes.length);
  if (offset >= effectiveLimit) {
    return failure('truncated', offset);
  }

  const tagRead = readBerTag(bytes, offset);
  if (!tagRead.ok) {
    return tagRead;
  }
  if (tagRead.nextOffset >= effectiveLimit) {
    // Tag okundu ama uzunluk baytı sınırın dışında kalıyor.
    return failure('truncated', tagRead.nextOffset);
  }

  const lengthRead = readBerLength(bytes, tagRead.nextOffset);
  if (!lengthRead.ok) {
    return lengthRead;
  }
  if (lengthRead.nextOffset > effectiveLimit) {
    // Uzun form uzunluk oktetleri sınırı aştı: okunan baytlar komşunun.
    return failure('value-overflow', tagRead.nextOffset);
  }

  const valueOffset = lengthRead.nextOffset;
  const end = valueOffset + lengthRead.length;
  if (end > effectiveLimit) {
    return failure('value-overflow', valueOffset);
  }

  return {
    ok: true,
    tag: tagRead.tag,
    offset,
    valueOffset,
    length: lengthRead.length,
    end,
    headerLength: valueOffset - offset,
  };
}

/**
 * BER INTEGER değeri: İKİ TÜMLEYEN, BIG-ENDIAN, MİNİMAL oktet.
 *
 * TUZAK (X.690 §8.3.2): kodlayıcı pozitif bir sayının en yüksek biti 1 ise başa
 * 0x00 ekler — `00 FF` = 255'tir, -1 değil. İşaret ilk oktetin bit 7'sinden
 * okunduğu için bu ek doğal olarak doğru sonucu verir; ayrı bir "unsigned"
 * çözücüye gerek YOKTUR (GOOSE'un `unsigned [6]` alanı da bu fonksiyonla
 * çözülür — negatif olmayan bir INTEGER'ın kodlaması aynıdır).
 *
 * Dönüş `bigint`: IEC 61850'nin `t` alanı ya da SNMP Counter64 gibi 64 bitlik
 * değerler `number`da sessizce yuvarlanır (bitCursor'ın aynı gerekçesi).
 */
export function decodeBerInteger(
  bytes: Uint8Array,
  offset: number,
  length: number,
): BerResult<BerIntegerRead> {
  if (length < 1) {
    // X.690: içerik oktetleri en az bir bayt olmalıdır.
    return failure('unexpected-value-length', offset);
  }
  const firstOctet = bytes[offset];
  if (firstOctet === undefined) {
    return failure('truncated', offset);
  }

  let magnitude = 0n;
  for (let index = 0; index < length; index += 1) {
    const position = offset + index;
    const octet = bytes[position];
    if (octet === undefined) {
      return failure('truncated', position);
    }
    magnitude = (magnitude << 8n) | BigInt(octet);
  }

  const negative = (firstOctet & SIGN_BIT_MASK) !== 0;
  const value = negative ? magnitude - (1n << BigInt(length * BITS_PER_BYTE)) : magnitude;
  return { ok: true, value };
}

/**
 * BER BOOLEAN: tek oktet, sıfır = FALSE, sıfırdan farklı = TRUE. DER ayrıca
 * TRUE'nun 0xFF olmasını şart koşar; ayrım hata değil, `derCompliant` bayrağıyla
 * çağırana bırakılır (karar 7'nin aynı mantığı).
 */
export function decodeBerBoolean(
  bytes: Uint8Array,
  offset: number,
  length: number,
): BerResult<BerBooleanRead> {
  if (length !== BOOLEAN_VALUE_LENGTH) {
    return failure('unexpected-value-length', offset);
  }
  const octet = bytes[offset];
  if (octet === undefined) {
    return failure('truncated', offset);
  }
  const value = octet !== 0;
  return { ok: true, value, derCompliant: !value || octet === BER_TRUE_OCTET };
}

/**
 * VisibleString (ISO 646 IRV, 0x20-0x7E). Küme dışı bayt HATA değildir:
 * `printable: false` döner ve metin yine kurulur (her bayt kendi kod noktasına),
 * böylece çağıran "ham göster + uyar" ya da "yine de bas" arasında seçim yapar.
 */
export function decodeBerVisibleString(
  bytes: Uint8Array,
  offset: number,
  length: number,
): BerResult<BerStringRead> {
  if (length < 0 || offset + length > bytes.length) {
    return failure('truncated', offset);
  }

  let printable = true;
  const characters: string[] = [];
  for (let index = 0; index < length; index += 1) {
    const octet = bytes[offset + index];
    if (octet === undefined) {
      return failure('truncated', offset + index);
    }
    if (octet < VISIBLE_STRING_MIN || octet > VISIBLE_STRING_MAX) {
      printable = false;
    }
    // Spread ile `String.fromCharCode(...)` uzun değerlerde yığını taşırır.
    characters.push(String.fromCharCode(octet));
  }

  return { ok: true, text: characters.join(''), printable };
}

export interface BerOidRead {
  /** Nokta ayrılmış metin gösterimi (ör. `1.3.6.1.2.1.1.3.0`). */
  readonly text: string;
  /** Ayrı ayrı arc'lar; `bigint` çünkü tek bir arc 2^53'ü aşabilir. */
  readonly arcs: readonly bigint[];
}

/** X.690 §8.19.4: ilk iki arc TEK bayta paketlenir, `40 × arc1 + arc2`. */
const OID_FIRST_ARC_DIVISOR = 40n;
/** Base-128 devam biti. */
const OID_CONTINUATION_MASK = 0x80;
const OID_ARC_VALUE_MASK = 0x7f;
const OID_ARC_SHIFT = 7n;

/**
 * OBJECT IDENTIFIER içerik oktetlerini çözer (X.690 §8.19).
 *
 * ── İLK İKİ ARC'IN AYRIŞTIRILMASI SAF BÖLME **DEĞİLDİR** ────────────────────
 * İlk bayt `40 × arc1 + arc2` taşır ve `arc1 ∈ {0,1,2}`dir. `arc1 = 2` olduğunda
 * `arc2` 39'u AŞABİLİR (ör. `2.100.3` geçerlidir), bu yüzden `first / 40` ve
 * `first % 40` yazmak `2.x` ağacının tamamını yanlış çözer — `1.3.6.1…` gibi
 * yaygın OID'lerde doğru çalıştığı için hata sahada geç fark edilir. Doğrusu
 * eşiklerle ayırmaktır: <40 → `0.n`, <80 → `1.(n-40)`, aksi hâlde `2.(n-80)`.
 *
 * ── ARC'LAR `bigint` ─────────────────────────────────────────────────────────
 * Base-128 kodlaması arc başına sınır koymaz; MIB'lerde 32 bitin üstüne çıkan
 * arc'lar (ör. IPv6 adresi taşıyan index'ler) görülür. `number`da sessizce
 * yuvarlanırlardı — `decodeBerInteger`ın aynı gerekçesi.
 *
 * ── EN AZ BİR BAYT, VE SON BAYT DEVAM BİTİ TAŞIYAMAZ ────────────────────────
 * Uzunluk 0 geçersizdir; son arc'ın devam biti açıksa kodlama yarım kalmıştır.
 * İkisi de `unexpected-value-length` ile reddedilir — "yarısı okundu" diye
 * göstermek uydurma bir OID üretirdi.
 */
export function decodeBerObjectIdentifier(
  bytes: Uint8Array,
  offset: number,
  length: number,
): BerResult<BerOidRead> {
  if (length < 1) {
    return failure('unexpected-value-length', offset);
  }
  if (offset + length > bytes.length) {
    return failure('truncated', offset);
  }

  const firstOctet = bytes[offset];
  if (firstOctet === undefined) {
    return failure('truncated', offset);
  }

  const arcs: bigint[] = [];
  let index = 0;

  // İlk bayt aslında base-128'in de ilk baytıdır: 0x80'i aşan paketli değerler
  // (ör. `2.999`) birden çok bayta yayılır, bu yüzden önce tam sayı okunur.
  let packed = 0n;
  let packedComplete = false;
  while (index < length) {
    const octet = bytes[offset + index];
    if (octet === undefined) {
      return failure('truncated', offset + index);
    }
    index += 1;
    packed = (packed << OID_ARC_SHIFT) | BigInt(octet & OID_ARC_VALUE_MASK);
    if ((octet & OID_CONTINUATION_MASK) === 0) {
      packedComplete = true;
      break;
    }
  }
  if (!packedComplete) {
    return failure('unexpected-value-length', offset + length - 1);
  }

  if (packed < OID_FIRST_ARC_DIVISOR) {
    arcs.push(0n, packed);
  } else if (packed < OID_FIRST_ARC_DIVISOR * 2n) {
    arcs.push(1n, packed - OID_FIRST_ARC_DIVISOR);
  } else {
    arcs.push(2n, packed - OID_FIRST_ARC_DIVISOR * 2n);
  }

  while (index < length) {
    let arc = 0n;
    let complete = false;
    while (index < length) {
      const octet = bytes[offset + index];
      if (octet === undefined) {
        return failure('truncated', offset + index);
      }
      index += 1;
      arc = (arc << OID_ARC_SHIFT) | BigInt(octet & OID_ARC_VALUE_MASK);
      if ((octet & OID_CONTINUATION_MASK) === 0) {
        complete = true;
        break;
      }
    }
    if (!complete) {
      return failure('unexpected-value-length', offset + length - 1);
    }
    arcs.push(arc);
  }

  return { ok: true, text: arcs.join('.'), arcs };
}

/**
 * İçerik oktetlerini İŞARETSİZ tam sayı olarak okur.
 *
 * `decodeBerInteger` X.690'ın INTEGER'ını, yani iki tümleyeni çözer. SNMP'nin
 * uygulama tipleri (`Counter32`, `Gauge32`, `TimeTicks`, `Counter64` — RFC 2578)
 * ise İŞARETSİZDİR: en anlamlı biti 1 olan bir Counter32'yi işaretli okumak
 * 3 000 000 000 yerine −1 294 967 296 verir ve sayaç "geri saymış" görünür.
 * Ayrı fonksiyon şart — aynı baytlar iki farklı sayı demektir.
 */
export function decodeBerUnsignedInteger(
  bytes: Uint8Array,
  offset: number,
  length: number,
): BerResult<BerIntegerRead> {
  if (length < 1) {
    return failure('unexpected-value-length', offset);
  }
  if (offset + length > bytes.length) {
    return failure('truncated', offset);
  }

  let value = 0n;
  for (let index = 0; index < length; index += 1) {
    const octet = bytes[offset + index];
    if (octet === undefined) {
      return failure('truncated', offset + index);
    }
    value = (value << 8n) | BigInt(octet);
  }

  return { ok: true, value };
}
