/**
 * Matter TLV yürüyüşü — saf, paylaşılan çözümleme yardımcısı.
 *
 * İlk tüketicisi Matter TLV Tree Decoder (faz 10, dalga 7d); ileride Matter
 * Interaction Model / Commissioning ekranları da AYNI kodlamayı okuyacak.
 *
 * ── BU BER DEĞİLDİR: `berReader` KULLANILAMAZ ──────────────────────────────
 * `berReader.ts` X.690 BER/DER yürür: sınıf/constructed bitli tag okteti,
 * BIG-endian uzunluk oktetleri, uzunluğu HER TİPTE açıkça yazan bir yapı.
 * Matter TLV'de ise (a) tek bir KONTROL BAYTI hem eleman tipini (alt 5 bit)
 * hem tag biçimini (üst 3 bit) taşır, (b) tag ve uzunluk alanları
 * LITTLE-endian ve genişlikleri TİPTEN türer, (c) container'ların uzunluk
 * alanı HİÇ YOKTUR — sonlarını ayrı bir "end of container" elemanı bildirir.
 * Üç fark da yapısaldır; berReader'ın kendi JSDoc'u (karar 6) bu modülün ona
 * genelleştirilmemesini zaten emrediyor. Buradan alınan şey KOD değil, API
 * DESENİdir: fırlatmayan `ok` union'ı, mutlak ofset, politika çağıranda.
 *
 * ── TASARIM KARARLARI ───────────────────────────────────────────────────────
 * Bu API'deki bir hata ileride her TLV tüketicisine taşınacağı için kararlar
 * burada gerekçesiyle yazıldı (berReader'ın aynı disiplini).
 *
 * **1. FIRLATMAZ — `{ ok: true, … } | { ok: false, error, offset }` döner.**
 * Hata VERİ hatasıdır (tel yalan söylemiştir), programlama hatası değil;
 * protokol motoru kısmi sonuç basabilmelidir (`ParseResult` sözleşmesi).
 * `ok` ayırıcısı `ParseResult`ün `success`inden BİLEREK farklı: bu tip bir
 * `ParseResult` değildir, iki sözleşme karışmasın.
 *
 * **2. Ofsetler HAM arabelleğe göre MUTLAKtır.** Fonksiyonlar dilim almaz,
 * `bytes + offset` alır — `ParsedField.offset` ham çerçeveye göre verilmek
 * zorundadır (byte-viewer onu vurgular) ve iç içe TLV'de dilim üstüne dilim
 * her seviyede bir ofset toplama hatası riskidir.
 *
 * **3. Yardımcı TEK ELEMAN okur; container'ın İÇİNDE YÜRÜMEZ (politika
 * çağıranda).** Matter'da container'ın uzunluğu yoktur: nerede bittiğini ancak
 * eşleşen `end-of-container` elemanı söyler. Bu yüzden `readMatterTlvElement`
 * bir container gördüğünde `end`i başlık sonuna eşitler ve "içerik buradan
 * başlıyor" der; yığını tutmak, DERİNLİK ve ELEMAN SINIRI koymak çağıranın
 * işidir — çünkü bu sınırlar tüketiciye göre değişir (bir tree-decoder ile bir
 * commissioning analizörü aynı politikayı paylaşmaz). berReader karar 6'nın
 * aynısı; oradaki gerekçe burada DAHA da bağlayıcı, çünkü uzunluksuz container
 * sınırsız derinlik demektir.
 *
 * **4. Tag geçerlilik kuralları AYRI ve OPSİYONEL bir fonksiyondadır**
 * (`validateMatterTlvTag`). Kural container bağlamına bağlıdır (Array üyeleri
 * anonim OLMAK ZORUNDA, Structure üyeleri anonim OLAMAZ, List serbest, en dış
 * seviyede context tag yasak — spec A.5.1/A.5.2/A.5.3/A.2.2). Okuma
 * fonksiyonuna gömülseydi çağıranın bağlamı içeri taşıması gerekirdi ve
 * "yapısal olarak okunabilir ama kurala aykırı" bir eleman okunamaz olurdu;
 * oysa bir ANALİZ aracının onu gösterip UYARMASI gerekir.
 *
 * **5. `end-of-container` YALNIZ tag'siz kabul edilir.** Spec A.10 tag control
 * bitlerinin sıfır olmasını ŞART koşar. Tag'li 0x18 sessizce EOC sayılsaydı
 * yanlış yerde container kapanır ve sonraki her eleman kayardı — sessiz-yanlış
 * çözümleme, bu depoda yasak. Açık hata (`tagged-end-of-container`).
 *
 * **6. Reserved eleman tipi (0x19-0x1F) açık hatadır.** Spec A.7.1 bu aralığı
 * ayırır; "bilinmiyor, atla" demek uzunluğu bilinmeyen bir alanı atlamak olurdu.
 *
 * **7. Uzunluk tavanı 0xFFFFFFFF.** Spec 8 baytlık uzunluk alanına izin verir
 * (2⁶⁴-1) ama `Uint8Array` ile indekslenebilecek her şeyin üstündedir; SDK da
 * (`TLVReader.cpp`) UINT32_MAX üstünü reddeder. TUZAK: uzunluk oktetleri
 * `bigint` ile birleştirilir, `number`a ancak tavan kontrolünden SONRA
 * indirilir — `<<` ile 32 bitte işaret bitine taşma riski böyle kapanır.
 *
 * **8. Implicit profile tag'i ÇÖZÜLMEZ, işaretlenir.** Implicit formda vendor
 * id / profile number baytlarda YOKTUR, protokol bağlamından gelir (spec
 * A.8.2). Uydurmak yerine `control: 'implicit-profile-*'` + `tagNumber`
 * verilir; çağıran "profil bilinmiyor" diye gösterir. (SDK aynı durumda
 * `UnknownImplicitTag()` üretir.)
 *
 * ── KAYNAK ──────────────────────────────────────────────────────────────────
 * Kodlama kuralları CSA **Matter Core Specification R1.4** (Doc 23-27349,
 * 2024-11-04) Appendix A'dan alındı: A.7 kontrol baytı, A.7.1 eleman tipi
 * tablosu, A.7.2 tag control tablosu, A.8 tag kodlaması, A.9 uzunluk
 * kodlaması, A.10 end-of-container, A.5.1-A.5.3 container tag kuralları.
 * Her sayısal değer **connectedhomeip SDK** (Apache-2.0, SHA
 * a50d879769df0c0fd984a3545954438ba025813a) ile çapraz doğrulandı:
 * `src/lib/core/TLVTypes.h` (element type enum + `GetTLVFieldSize`),
 * `TLVTags.h` (tag control enum + maske), `TLVReader.cpp:47` (`sTagSizes`),
 * `TLVReader.cpp:903` (`ReadTag` alan düzeni). İki kaynak arasında sayısal
 * çelişki YOKTUR. Spec'in kendi içinde iki tutarsızlık var, ikisi de burada
 * çözüldü: (a) A.2.2 context tag'i "yalnız structure içinde" der ama A.5.3,
 * spec'in KENDİ örneği (Table 106) ve SDK list içinde de serbest bırakır —
 * `validateMatterTlvTag` list'te kısıt uygulamaz; (b) Table 107 giriş cümlesi
 * 0xFFF2 yazar ama tablodaki hex 0xFFF1 kodlar — fixture'larda hex esastır.
 */

/** Kontrol baytının üst 3 biti. Spec A.7.2; SDK `TLVTags.h` `TLVTagControl`. */
export type MatterTlvTagControl =
  | 'anonymous'
  | 'context-specific'
  | 'common-profile-2'
  | 'common-profile-4'
  | 'implicit-profile-2'
  | 'implicit-profile-4'
  | 'fully-qualified-6'
  | 'fully-qualified-8';

/**
 * Kontrol baytının alt 5 bitinin ANLAM sınıfı. Genişlik (1/2/4/8) ayrı taşınır
 * (`valueFieldBytes`) — çağıranların çoğu "bu bir tamsayı mı" diye sorar, kaç
 * bayt olduğunu değil.
 */
export type MatterTlvElementType =
  | 'signed-integer'
  | 'unsigned-integer'
  | 'boolean'
  | 'float'
  | 'utf8-string'
  | 'octet-string'
  | 'null'
  | 'structure'
  | 'array'
  | 'list'
  | 'end-of-container';

/** Container tipleri — `validateMatterTlvTag`ın bağlamı. */
export type MatterTlvContainerType = 'structure' | 'array' | 'list';

/**
 * Kapalı union — çağıran bunları switch'ler ve kendi çeviri anahtarına eşler.
 * `ProtocolErrorCode`den AYRIdır: bunlar kodlama katmanının hataları.
 */
export type MatterTlvErrorCode =
  /** Arabellek (ya da verilen sınır) istenen baytlardan önce bitti. */
  | 'truncated'
  /** Eleman tipi 0x19-0x1F: spec A.7.1'de ayrılmış (karar 6). */
  | 'reserved-element-type'
  /** 0x18 (end-of-container) tag taşıyor — spec A.10 yasaklar (karar 5). */
  | 'tagged-end-of-container'
  /** Uzunluk alanının vaat ettiği değer sınırın dışına taşıyor. */
  | 'value-overflow'
  /** Uzunluk 0xFFFFFFFF üstü — indekslenebilir değil (karar 7). */
  | 'length-unsupported';

export interface MatterTlvFailure {
  readonly ok: false;
  readonly error: MatterTlvErrorCode;
  /** Hatanın görüldüğü MUTLAK bayt ofseti — `ProtocolError.offset`e doğrudan verilebilir. */
  readonly offset: number;
}

/**
 * Kesişim (`{ ok: true } & TValue`): çağıran `if (!result.ok) return …`
 * dedikten sonra alanlara sarmalayıcı olmadan erişir (berReader emsali).
 */
export type MatterTlvResult<TValue> = ({ readonly ok: true } & TValue) | MatterTlvFailure;

export interface MatterTlvTag {
  readonly control: MatterTlvTagControl;
  /** Anonim tag'de YOKTUR. Fully-qualified'da tag numarasının kendisi. */
  readonly tagNumber?: number;
  /** Yalnız fully-qualified formlarda vardır (implicit'te baytlarda YOK — karar 8). */
  readonly vendorId?: number;
  /** Yalnız fully-qualified formlarda vardır. */
  readonly profileNumber?: number;
  /** Tag alanının bayt sayısı: 0/1/2/4/6/8. */
  readonly byteLength: number;
}

export interface MatterTlvElement {
  /** Kontrol baytının MUTLAK ofseti — elemanın ilk baytı. */
  readonly offset: number;
  /** Ham kontrol baytı; çağıranlar bazen doğrudan buna bakar. */
  readonly controlByte: number;
  readonly tag: MatterTlvTag;
  readonly type: MatterTlvElementType;
  /**
   * Sabit genişlikli sayısal tiplerde DEĞER alanının, string tiplerinde
   * UZUNLUK ÖNEKİNİN bayt sayısı (1/2/4/8). Değer alanı olmayan tiplerde
   * (boolean/null/container/EOC) 0 — spec A.7.1'in alt 2 bit kuralı.
   */
  readonly valueFieldBytes: number;
  /** Başlıktan (kontrol + tag + uzunluk/değer alanı) SONRAKİ mutlak ofset. */
  readonly headerEnd: number;
  /**
   * Değerin ilk baytının mutlak ofseti. Sayısal tiplerde başlığın İÇİNDEDİR
   * (değer alanı başlığın parçasıdır), string'lerde uzunluk önekinden sonrası,
   * değeri olmayan tiplerde `headerEnd`e eşittir.
   */
  readonly valueOffset: number;
  /** Değerin bayt uzunluğu. Boolean/null/container/EOC'de 0. */
  readonly valueLength: number;
  /**
   * Bu elemandan SONRAKİ ilk bayt (mutlak). Container'da `headerEnd`e eşittir:
   * içerik ayrı yürünür, sonu eşleşen EOC belirler (karar 3).
   */
  readonly end: number;
  /** Yalnız `type === 'boolean'`de vardır — değer TİPİN KENDİSİNDE taşınır (spec A.11.3). */
  readonly booleanValue?: boolean;
}

export interface MatterTlvIntegerRead {
  readonly value: bigint;
}

export interface MatterTlvFloatRead {
  readonly value: number;
}

export interface MatterTlvStringRead {
  readonly text: string;
  /** Baytlar geçerli UTF-8 değilse `false` — metin yine kurulur (replacement char), çağıran ham basmayı seçebilir. */
  readonly wellFormed: boolean;
}

/** Tag kuralı ihlalleri (karar 4). Hata DEĞİL, çağıranın uyarı basacağı bilgi. */
export type MatterTlvTagViolation =
  /** En dış seviyede context tag — spec A.2.2. */
  | 'context-tag-at-top-level'
  /** Structure üyesi anonim — spec A.5.1. */
  | 'anonymous-tag-in-structure'
  /** Array üyesi anonim değil — spec A.5.2. */
  | 'non-anonymous-tag-in-array';

const TYPE_MASK = 0x1f;
const TAG_CONTROL_MASK = 0xe0;
const TAG_CONTROL_SHIFT = 5;
/** Alt 2 bit değer/uzunluk alanının genişliğini verir (spec A.7.1). */
const FIELD_SIZE_MASK = 0x03;

/** SDK `TLVReader.cpp:47` `sTagSizes`; spec A.7.2 tablosuyla birebir. İndeks = tagControl >>> 5. */
const TAG_BYTE_LENGTHS: readonly number[] = [0, 1, 2, 4, 2, 4, 6, 8];

const TAG_CONTROLS: readonly MatterTlvTagControl[] = [
  'anonymous',
  'context-specific',
  'common-profile-2',
  'common-profile-4',
  'implicit-profile-2',
  'implicit-profile-4',
  'fully-qualified-6',
  'fully-qualified-8',
];

/** SDK `TLVTypes.h` `TLVElementType`; spec A.7.1 tablosuyla birebir. */
const ELEMENT_TYPE_SIGNED_INTEGER_MIN = 0x00;
const ELEMENT_TYPE_SIGNED_INTEGER_MAX = 0x03;
const ELEMENT_TYPE_UNSIGNED_INTEGER_MIN = 0x04;
const ELEMENT_TYPE_UNSIGNED_INTEGER_MAX = 0x07;
const ELEMENT_TYPE_BOOLEAN_FALSE = 0x08;
const ELEMENT_TYPE_BOOLEAN_TRUE = 0x09;
const ELEMENT_TYPE_FLOAT_32 = 0x0a;
const ELEMENT_TYPE_FLOAT_64 = 0x0b;
const ELEMENT_TYPE_UTF8_STRING_MIN = 0x0c;
const ELEMENT_TYPE_UTF8_STRING_MAX = 0x0f;
const ELEMENT_TYPE_OCTET_STRING_MIN = 0x10;
const ELEMENT_TYPE_OCTET_STRING_MAX = 0x13;
const ELEMENT_TYPE_NULL = 0x14;
const ELEMENT_TYPE_STRUCTURE = 0x15;
const ELEMENT_TYPE_ARRAY = 0x16;
const ELEMENT_TYPE_LIST = 0x17;
const ELEMENT_TYPE_END_OF_CONTAINER = 0x18;

/** Spec A.7.1: 0x19-0x1F ayrılmış (karar 6). */
const ELEMENT_TYPE_MAX_VALID = ELEMENT_TYPE_END_OF_CONTAINER;

/** Karar 7: `Uint8Array` ile indekslenebilecek üst sınır. */
export const MAX_MATTER_TLV_LENGTH = 0xffffffff;

const FLOAT_32_BYTES = 4;
const FLOAT_64_BYTES = 8;
const BITS_PER_BYTE = 8;

function failure(error: MatterTlvErrorCode, offset: number): MatterTlvFailure {
  return { ok: false, error, offset };
}

/**
 * `length` baytlık işaretsiz LITTLE-endian tamsayı. `bigint` döner: 8 baytlık
 * alanlar `number`da sessizce yuvarlanır (bitCursor/berReader aynı gerekçe).
 * Sınır dışına çıkarsa `undefined`.
 */
function readUintLe(bytes: Uint8Array, offset: number, length: number): bigint | undefined {
  let value = 0n;
  // En anlamlıdan geriye doğru: her adımda 8 bit kaydır (LE olduğu için sondan başlanır).
  for (let index = length - 1; index >= 0; index -= 1) {
    // noUncheckedIndexedAccess: sınır kontrolü indeksin kendisiyle yapılır.
    const octet = bytes[offset + index];
    if (octet === undefined) {
      return undefined;
    }
    value = (value << 8n) | BigInt(octet);
  }
  return value;
}

function classifyElementType(
  elementType: number,
): { readonly type: MatterTlvElementType; readonly hasValueField: boolean } | undefined {
  if (elementType >= ELEMENT_TYPE_SIGNED_INTEGER_MIN && elementType <= ELEMENT_TYPE_SIGNED_INTEGER_MAX) {
    return { type: 'signed-integer', hasValueField: true };
  }
  if (elementType >= ELEMENT_TYPE_UNSIGNED_INTEGER_MIN && elementType <= ELEMENT_TYPE_UNSIGNED_INTEGER_MAX) {
    return { type: 'unsigned-integer', hasValueField: true };
  }
  if (elementType === ELEMENT_TYPE_BOOLEAN_FALSE || elementType === ELEMENT_TYPE_BOOLEAN_TRUE) {
    return { type: 'boolean', hasValueField: false };
  }
  if (elementType === ELEMENT_TYPE_FLOAT_32 || elementType === ELEMENT_TYPE_FLOAT_64) {
    return { type: 'float', hasValueField: true };
  }
  if (elementType >= ELEMENT_TYPE_UTF8_STRING_MIN && elementType <= ELEMENT_TYPE_UTF8_STRING_MAX) {
    return { type: 'utf8-string', hasValueField: true };
  }
  if (elementType >= ELEMENT_TYPE_OCTET_STRING_MIN && elementType <= ELEMENT_TYPE_OCTET_STRING_MAX) {
    return { type: 'octet-string', hasValueField: true };
  }
  if (elementType === ELEMENT_TYPE_NULL) return { type: 'null', hasValueField: false };
  if (elementType === ELEMENT_TYPE_STRUCTURE) return { type: 'structure', hasValueField: false };
  if (elementType === ELEMENT_TYPE_ARRAY) return { type: 'array', hasValueField: false };
  if (elementType === ELEMENT_TYPE_LIST) return { type: 'list', hasValueField: false };
  if (elementType === ELEMENT_TYPE_END_OF_CONTAINER) {
    return { type: 'end-of-container', hasValueField: false };
  }
  return undefined;
}

/** Spec A.8: vendorId ‖ profileNumber ‖ tagNumber, hepsi little-endian. */
function readTag(
  bytes: Uint8Array,
  offset: number,
  control: MatterTlvTagControl,
  byteLength: number,
): MatterTlvTag | undefined {
  if (byteLength === 0) {
    return { control, byteLength };
  }

  if (control === 'fully-qualified-6' || control === 'fully-qualified-8') {
    const vendorId = readUintLe(bytes, offset, 2);
    const profileNumber = readUintLe(bytes, offset + 2, 2);
    const tagNumberBytes = byteLength - 4;
    const tagNumber = readUintLe(bytes, offset + 4, tagNumberBytes);
    if (vendorId === undefined || profileNumber === undefined || tagNumber === undefined) {
      return undefined;
    }
    return {
      control,
      vendorId: Number(vendorId),
      profileNumber: Number(profileNumber),
      tagNumber: Number(tagNumber),
      byteLength,
    };
  }

  // Context-specific / common / implicit: yalnız tag numarası (karar 8).
  const tagNumber = readUintLe(bytes, offset, byteLength);
  if (tagNumber === undefined) {
    return undefined;
  }
  return { control, tagNumber: Number(tagNumber), byteLength };
}

/**
 * Tek bir TLV elemanının başlığını ve sınırlarını çıkarır. Değerin İÇİ
 * okunmaz; container'ın İÇİNDE yürünmez (karar 3).
 *
 * `limit`, elemanın taşmaması gereken ÜST sınırdır (mutlak, dışlayıcı);
 * verilmezse arabelleğin sonu kullanılır.
 */
export function readMatterTlvElement(
  bytes: Uint8Array,
  offset: number,
  limit: number = bytes.length,
): MatterTlvResult<MatterTlvElement> {
  const effectiveLimit = Math.min(limit, bytes.length);
  if (offset >= effectiveLimit) {
    return failure('truncated', offset);
  }

  const controlByte = bytes[offset];
  if (controlByte === undefined) {
    return failure('truncated', offset);
  }

  const rawElementType = controlByte & TYPE_MASK;
  if (rawElementType > ELEMENT_TYPE_MAX_VALID) {
    return failure('reserved-element-type', offset);
  }
  const classification = classifyElementType(rawElementType);
  if (classification === undefined) {
    return failure('reserved-element-type', offset);
  }

  const tagControlIndex = (controlByte & TAG_CONTROL_MASK) >>> TAG_CONTROL_SHIFT;
  const control = TAG_CONTROLS[tagControlIndex] ?? 'anonymous';
  const tagByteLength = TAG_BYTE_LENGTHS[tagControlIndex] ?? 0;

  // Karar 5: end-of-container tag TAŞIYAMAZ (spec A.10).
  if (classification.type === 'end-of-container' && control !== 'anonymous') {
    return failure('tagged-end-of-container', offset);
  }

  const tagOffset = offset + 1;
  if (tagOffset + tagByteLength > effectiveLimit) {
    return failure('truncated', tagOffset);
  }
  const tag = readTag(bytes, tagOffset, control, tagByteLength);
  if (tag === undefined) {
    return failure('truncated', tagOffset);
  }

  // Spec A.7.1: değer/uzunluk alanının genişliği tipin alt 2 bitinden türer.
  const valueFieldBytes = classification.hasValueField ? 1 << (rawElementType & FIELD_SIZE_MASK) : 0;
  const valueFieldOffset = tagOffset + tagByteLength;
  const headerEnd = valueFieldOffset + valueFieldBytes;
  if (headerEnd > effectiveLimit) {
    return failure('truncated', valueFieldOffset);
  }

  const base = {
    offset,
    controlByte,
    tag,
    type: classification.type,
    valueFieldBytes,
    headerEnd,
  } as const;

  if (classification.type === 'boolean') {
    return {
      ok: true,
      ...base,
      valueOffset: headerEnd,
      valueLength: 0,
      end: headerEnd,
      booleanValue: rawElementType === ELEMENT_TYPE_BOOLEAN_TRUE,
    };
  }

  if (classification.type === 'utf8-string' || classification.type === 'octet-string') {
    // String'lerde başlıktaki alan UZUNLUK önekidir; gövde ondan sonra gelir.
    const declaredLength = readUintLe(bytes, valueFieldOffset, valueFieldBytes);
    if (declaredLength === undefined) {
      return failure('truncated', valueFieldOffset);
    }
    if (declaredLength > BigInt(MAX_MATTER_TLV_LENGTH)) {
      return failure('length-unsupported', valueFieldOffset);
    }
    const valueLength = Number(declaredLength);
    const end = headerEnd + valueLength;
    if (end > effectiveLimit) {
      return failure('value-overflow', headerEnd);
    }
    return { ok: true, ...base, valueOffset: headerEnd, valueLength, end };
  }

  if (classification.hasValueField) {
    // Sayısal tipler: değer alanı BAŞLIĞIN parçasıdır, ayrı gövde yoktur.
    return {
      ok: true,
      ...base,
      valueOffset: valueFieldOffset,
      valueLength: valueFieldBytes,
      end: headerEnd,
    };
  }

  // null / container / end-of-container: değer alanı yok. Container'da içerik
  // `headerEnd`den başlar ama sonu EOC belirler (karar 3) — `end` başlık sonudur.
  return { ok: true, ...base, valueOffset: headerEnd, valueLength: 0, end: headerEnd };
}

/**
 * Matter TLV signed integer: İKİ TÜMLEYEN, LITTLE-endian, sabit genişlik.
 *
 * BER'in aksine minimal-oktet kuralı YOKTUR — genişlik tipten gelir, gönderen
 * gereğinden geniş bir tip seçebilir (spec A.9 aynı serbestliği uzunluk alanı
 * için de tanır). Bu yüzden "başa eklenen 0x00" gibi bir tuzak burada yoktur.
 */
export function decodeMatterTlvSignedInteger(
  bytes: Uint8Array,
  offset: number,
  length: number,
): MatterTlvResult<MatterTlvIntegerRead> {
  const magnitude = readUintLe(bytes, offset, length);
  if (magnitude === undefined || length < 1) {
    return failure('truncated', offset);
  }
  const signBit = 1n << BigInt(length * BITS_PER_BYTE - 1);
  const value = (magnitude & signBit) === 0n ? magnitude : magnitude - (1n << BigInt(length * BITS_PER_BYTE));
  return { ok: true, value };
}

/** Matter TLV unsigned integer: LITTLE-endian, sabit genişlik. */
export function decodeMatterTlvUnsignedInteger(
  bytes: Uint8Array,
  offset: number,
  length: number,
): MatterTlvResult<MatterTlvIntegerRead> {
  const value = readUintLe(bytes, offset, length);
  if (value === undefined || length < 1) {
    return failure('truncated', offset);
  }
  return { ok: true, value };
}

/** IEEE 754 single/double, LITTLE-endian (spec A.11.1). */
export function decodeMatterTlvFloat(
  bytes: Uint8Array,
  offset: number,
  length: number,
): MatterTlvResult<MatterTlvFloatRead> {
  if (length !== FLOAT_32_BYTES && length !== FLOAT_64_BYTES) {
    return failure('truncated', offset);
  }
  if (offset + length > bytes.length) {
    return failure('truncated', offset);
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset + offset, length);
  const value = length === FLOAT_32_BYTES ? view.getFloat32(0, true) : view.getFloat64(0, true);
  return { ok: true, value };
}

/**
 * UTF-8 string. Uzunluk KARAKTER değil OKTET sayar ve sonlandırıcı bayt YOKTUR
 * (spec A.11.2) — spec'in kendi örneği bunu gösterir: `"Tschüs"` 6 karakterdir
 * ama 7 oktettir.
 *
 * Bozuk UTF-8 HATA değildir: `wellFormed: false` döner ve metin yine kurulur
 * (berReader'ın `printable` bayrağıyla aynı disiplin) — çağıran "ham göster +
 * uyar" ya da "yine de bas" arasında seçim yapar.
 */
export function decodeMatterTlvUtf8String(
  bytes: Uint8Array,
  offset: number,
  length: number,
): MatterTlvResult<MatterTlvStringRead> {
  if (length < 0 || offset + length > bytes.length) {
    return failure('truncated', offset);
  }
  const slice = bytes.slice(offset, offset + length);
  const text = new TextDecoder('utf-8').decode(slice);
  let wellFormed = true;
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(slice);
  } catch {
    wellFormed = false;
  }
  return { ok: true, text, wellFormed };
}

/**
 * Tag'in bulunduğu container bağlamında kurallara uyup uymadığı (karar 4).
 * `containerType` verilmezse en dış seviye kabul edilir.
 *
 * Kural ihlali HATA DEĞİLDİR — okunabilir ama kurala aykırı bir elemanı bir
 * analiz aracı göstermeli ve uyarmalıdır.
 */
export function validateMatterTlvTag(
  tag: MatterTlvTag,
  containerType?: MatterTlvContainerType,
): MatterTlvTagViolation | undefined {
  if (containerType === undefined) {
    // Spec A.2.2: en dış seviyede context tag yasak.
    return tag.control === 'context-specific' ? 'context-tag-at-top-level' : undefined;
  }
  if (containerType === 'structure') {
    // Spec A.5.1: structure üyeleri anonim olamaz.
    return tag.control === 'anonymous' ? 'anonymous-tag-in-structure' : undefined;
  }
  if (containerType === 'array') {
    // Spec A.5.2: array üyeleri anonim OLMAK ZORUNDA.
    return tag.control === 'anonymous' ? undefined : 'non-anonymous-tag-in-array';
  }
  // Spec A.5.3: list her tag formunu kabul eder (dosya başı, spec içi çelişki notu).
  return undefined;
}
