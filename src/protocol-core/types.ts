/**
 * Protocol core sözleşmesi: 172 protokolün parser/encoder'larının uyduğu tek tip
 * kümesi. Bu dosya spec §7 ve §47'deki arayüzleri harfiyen taşır — alan adları,
 * opsiyonellikler ve union şekli protokol motorlarının ortak zemini olduğu için
 * değiştirilemez. Yeni ihtiyaç çıkarsa alan eklenir, var olan yeniden adlandırılmaz.
 *
 * Burada React, DOM ya da katalog bağımlılığı YOKTUR: aynı tipler Web Worker
 * içinde de kullanılacak (spec §44 — ağır analizler worker'da koşar).
 */

/** Frame'in yönü. Kayıt/oynatma sırasında da korunur, çift yönlü loglarda tek ayırt edici. */
export type FrameDirection = 'rx' | 'tx';

/**
 * Bağlantıdan ham geldiği hâliyle bir frame. `bytes` üzerinde parser'lar
 * DEĞİŞİKLİK YAPMAZ: aynı ham frame birden çok parser'a (auto-detection) verilir,
 * biri byte'ları bozarsa diğerleri yanlış çözümler.
 */
export interface RawFrame {
  id: string;
  /** Epoch-benzeri milisaniye; üretimi için `createRawFrame` kullan. */
  timestamp: number;
  direction: FrameDirection;
  channel?: string;
  bytes: Uint8Array;
  metadata?: Record<string, unknown>;
}

/**
 * Çözümlenmiş tek alan. `offset`/`length` BYTE cinsindendir; bit alanları için
 * kapsayan byte aralığı verilir ve bit ayrıntısı `metadata` yerine alan adında
 * taşınır (bit seviyesi çözümleme Custom Protocol Studio'nun işi, spec §9.4).
 *
 * `rawValue` tel üzerindeki sayı, `physicalValue` ölçek/offset uygulanmış
 * mühendislik değeridir (spec §9.2). İkisi de opsiyonel: ham byte dizisi olan
 * alanlarda (payload) hiçbiri anlamlı değildir.
 */
export interface ParsedField {
  id: string;
  name: string;
  offset: number;
  length: number;
  rawBytes: Uint8Array;
  rawValue?: bigint | number | string;
  physicalValue?: bigint | number | string;
  unit?: string;
  valid: boolean;
  /**
   * Alan seviyesindeki uyarılar düz metindir — frame seviyesindeki
   * `ProtocolWarning`'den kasten farklı: alan uyarısının offset'i zaten alanın
   * kendisidir, kod taşımaya değmez (spec §7 bu asimetriyi böyle veriyor).
   */
  warnings: string[];
}

/**
 * Bir frame'in tam çözümü. `valid: false` olsa bile `fields` doldurulur —
 * kısmi çözüm kullanıcıya gösterilir (spec §47: "hatalı veride uygulamayı
 * çökertme", §35: bilinmeyen protokol analizi kısmi sonuçla çalışır).
 */
export interface ParsedFrame {
  protocol: string;
  timestamp: number;
  rawFrame: RawFrame;
  fields: ParsedField[];
  valid: boolean;
  errors: ProtocolError[];
  warnings: ProtocolWarning[];
}

/**
 * Hata kodları makine-okunur ayrımı taşır; kullanıcıya gösterilen metin
 * `message` alanındadır (spec §42'deki açıklayıcı mesaj listesi). Kod ile mesajı
 * karıştırma: kod switch'lenir ve çevrilir, mesaj çevrilmiş/parametreli metindir.
 */
export type ProtocolErrorCode =
  | 'invalid-hex-input'
  | 'length-mismatch'
  | 'checksum-mismatch'
  | 'crc-mismatch'
  | 'unsupported-function-code'
  | 'start-delimiter-not-found'
  | 'value-out-of-range'
  /**
   * Alan yapısal olarak okunabildi ama KODLAMA BİÇİMİ bu çözücünün kabul
   * ettiği kümede değil (faz 10 dalga 5e'de eklendi). `value-out-of-range`
   * değeri yargılar; bu kod değere hiç bakmadan biçimi reddeder — ör. BER'in
   * long-form etiketi ya da indefinite-length'i. Ayrımı korumak şart:
   * "bu sayı çok büyük" ile "bu kodlamayı okuyamıyorum" farklı hatalardır ve
   * kullanıcı ikincisinde veriyi değil aracın sınırını görmelidir.
   */
  | 'unsupported-encoding'
  | 'frame-too-long'
  | 'truncated-frame'
  | 'circular-length-reference'
  | 'parser-timeout';

export interface ProtocolError {
  code: ProtocolErrorCode;
  message: string;
  /** Hatanın gösterileceği byte konumu — byte-viewer bunu vurgular. */
  offset?: number;
  length?: number;
  details?: Record<string, unknown>;
}

/**
 * Uyarı kodu serbest string'dir: protokole özgü uyarılar (ör. "deprecated PGN")
 * merkezî bir union'a hapsedilemeyecek kadar çeşitli. Hatalar aksine kapalı
 * union'dır, çünkü hata davranışı (recovery, rozet rengi) merkezî karar verir.
 */
export interface ProtocolWarning {
  code: string;
  message: string;
  offset?: number;
  length?: number;
}

/**
 * Parser'a dışarıdan verilen bağlam. Hepsi opsiyoneldir: bağlamsız `parse(data)`
 * çağrısı geçerli kullanımdır (tek frame'lik hesap araçları böyle çağırır).
 */
export interface ParseContext {
  /** Verilmezse parser kendi `createRawFrame` varsayılanını kullanır. */
  timestamp?: number;
  direction?: FrameDirection;
  channel?: string;
  /**
   * Spec §41 "maximum frame length uygula": uzunluk alanı bozuk bir frame
   * parser'ı gigabyte'lık buffer ayırmaya zorlayabilir. Aşılırsa parser
   * `frame-too-long` ile durur, buffer ayırmaz.
   */
  maxFrameLength?: number;
  /**
   * Spec §41 "worker cancellation" + "parser timeout": uzun süren auto-detection
   * iptal edilebilmeli. Parser döngüde `signal.aborted` kontrol eder ve
   * `parser-timeout` ile döner — exception fırlatmaz, çünkü iptal beklenen bir
   * sonuçtur, hata değil.
   */
  signal?: AbortSignal;
  /** Protokole özgü ayarlar (endianness override, adres genişliği …). */
  options?: Record<string, unknown>;
}

/**
 * `consumedBytes` başarısızlıkta da doludur: stream parser bunu kullanarak
 * buffer'ı ilerletir ve resenkronize olur (spec §47 "parser recovery"). Sıfır
 * dönmek "daha çok veri bekle" demektir — çağıran sonsuz döngüye girmemek için
 * `recoverable` ile birlikte değerlendirir.
 */
export type ParseResult =
  | {
      success: true;
      frame: ParsedFrame;
      consumedBytes: number;
    }
  | {
      success: false;
      error: ProtocolError;
      consumedBytes: number;
      /** false ise akış bu protokol için terk edilir; true ise kaydırıp yeniden denenir. */
      recoverable: boolean;
    };

export type ParseSuccess = Extract<ParseResult, { success: true }>;
export type ParseFailure = Extract<ParseResult, { success: false }>;

/**
 * Ortak parser sözleşmesi. Uygulamalar SAF olmalı: `parse` çağrısı içeride
 * durum biriktirmez, aynı girdi aynı sonucu verir. Akış durumu (yarım frame)
 * stream katmanının işidir, parser'ın değil.
 */
export interface ProtocolParser {
  readonly protocolId: string;
  readonly displayName: string;

  /**
   * Ucuz ön eleme — auto-detection sırasında 172 parser'a sırayla sorulur.
   * Bu yüzden O(1)/kısa sabit maliyetli olmalı: start delimiter, uzunluk aralığı.
   * Tam doğrulamayı (CRC) burada yapma, `parse`'a bırak.
   */
  canParse(data: Uint8Array): boolean;
  parse(data: Uint8Array, context?: ParseContext): ParseResult;
}

export interface ProtocolEncoder<TMessage> {
  encode(message: TMessage): Uint8Array;
}

/**
 * Plugin kategorisi katalog `DomainId` ile AYNI değer kümesidir ama katalog tipi
 * KASTEN import edilmez: protocol-core katalogdan (ve dolayısıyla UI'dan)
 * bağımsız kalmalı, worker içinde katalog verisini yanında sürüklememeli.
 * Katalogda domain eklenirse bu liste de elle güncellenir —
 * `src/app/catalog/types.ts` içindeki `DOMAIN_IDS` ile eşleşmesi bir değişmezdir.
 *
 * Tip değil SABİT olarak yazılıyor: yalnız tip olsaydı iki kümenin ayrışması
 * derlemeye de teste de yakalanmazdı. `catalog.test.ts` ikisini karşılaştırır.
 */
export const PROTOCOL_CATEGORIES = [
  'interfaces-framing',
  'industrial-automation',
  'automotive',
  'marine-navigation',
  'aerospace-uav',
  'building-automation',
  'network-ethernet',
  'wireless-iot',
] as const;

export type ProtocolCategory = (typeof PROTOCOL_CATEGORIES)[number];

/**
 * Bir protokolün sunduğu hesap aracının kimliği. Motor değil, yalnız TANIM:
 * hesap motorları Faz 5'te gelecek, burada sadece şekil sabitleniyor ki plugin
 * yazarları bugünden listeyi doldurabilsin.
 */
export interface CalculatorDefinition {
  id: string;
  name: string;
  description: string;
  /** Sonucun birimi (ör. "ms", "kbit/s"); birimsiz hesaplarda boş bırakılır. */
  unit?: string;
}

export interface ProtocolDocumentation {
  summary: string;
  /** Katalogdaki `ProtocolLayer` ile aynı sözcükler beklenir; serbest string tutuldu. */
  layer?: string;
  references?: readonly { title: string; url: string }[];
}

/**
 * Spec §42 madde 4 "örnek veri" ve §43 test fixture'ları aynı kaynaktan beslenir:
 * UI'daki "örnek yükle" butonu ile parser testleri aynı byte dizisini kullanır,
 * böylece ekranda çalışan örnek testte de yeşildir.
 */
export interface ExampleFrame {
  id: string;
  name: string;
  bytes: Uint8Array;
  description?: string;
  /** Kasten bozuk örnekler için false — hata yolunu göstermek de örnektir. */
  expectedValid?: boolean;
}

/**
 * Bir protokolün uygulamaya takıldığı tek nokta (spec §47). Parser, encoder ve
 * dokümantasyon opsiyoneldir — yalnız hesap aracı sunan protokoller de vardır —
 * ama `exampleFrames` zorunludur: örneksiz sayfa kullanıcıya hiçbir şey vaat etmez.
 */
export interface ProtocolPlugin {
  id: string;
  name: string;
  category: ProtocolCategory;
  parser?: ProtocolParser;
  encoder?: ProtocolEncoder<unknown>;
  calculators?: CalculatorDefinition[];
  documentation?: ProtocolDocumentation;
  exampleFrames: ExampleFrame[];
}

/** Discriminated union daraltması — `if (isParseSuccess(r)) r.frame` çalışır. */
export function isParseSuccess(result: ParseResult): result is ParseSuccess {
  return result.success;
}

export interface RawFrameInit {
  /** Verilirse üretim atlanır — dosyadan/logdan gelen frame kendi id'sini korur. */
  id?: string;
  timestamp?: number;
  direction?: FrameDirection;
  channel?: string;
  metadata?: Record<string, unknown>;
}

/** UUID v4: 16 byte, 8-4-4-4-12 gruplaması. */
const UUID_BYTE_LENGTH = 16;
const UUID_VERSION_INDEX = 6;
const UUID_VARIANT_INDEX = 8;
const UUID_VERSION_NIBBLE_MASK = 0x0f;
const UUID_VERSION_4 = 0x40;
const UUID_VARIANT_BITS_MASK = 0x3f;
const UUID_VARIANT_RFC4122 = 0x80;
const UUID_GROUP_OFFSETS = [8, 12, 16, 20] as const;
const HEX_RADIX = 16;
const HEX_DIGITS_PER_BYTE = 2;

/**
 * `crypto.randomUUID` yalnız SECURE CONTEXT'te tanımlıdır. Uygulama sahada
 * `http://<lan-ip>` üzerinden de açılıyor (local bridge kurulumu, spec §8.1) —
 * orada randomUUID `undefined` olur ve id üretimi patlar. `getRandomValues`
 * güvensiz bağlamda da vardır, bu yüzden yedek yol elle v4 kurar.
 */
function generateFrameId(): string {
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  const bytes = new Uint8Array(UUID_BYTE_LENGTH);
  crypto.getRandomValues(bytes);
  // noUncheckedIndexedAccess: sabit uzunluklu dizide bile tip `number | undefined`.
  bytes[UUID_VERSION_INDEX] =
    ((bytes[UUID_VERSION_INDEX] ?? 0) & UUID_VERSION_NIBBLE_MASK) | UUID_VERSION_4;
  bytes[UUID_VARIANT_INDEX] =
    ((bytes[UUID_VARIANT_INDEX] ?? 0) & UUID_VARIANT_BITS_MASK) | UUID_VARIANT_RFC4122;

  const hex = Array.from(bytes, (byte) =>
    byte.toString(HEX_RADIX).padStart(HEX_DIGITS_PER_BYTE, '0'),
  ).join('');

  let cursor = 0;
  const groups: string[] = [];
  for (const offset of UUID_GROUP_OFFSETS) {
    groups.push(hex.slice(cursor, offset));
    cursor = offset;
  }
  groups.push(hex.slice(cursor));
  return groups.join('-');
}

/**
 * Zaman damgası `performance.timeOrigin + performance.now()` ile üretilir,
 * `Date.now()` ile DEĞİL: `Date.now()` NTP düzeltmesiyle geriye sıçrayabilir ve
 * canlı akışta negatif frame aralığı üretir (spec §39 istatistikleri, §37
 * grafikleri bunu doğrudan çizer). `performance.now()` monotondur; timeOrigin
 * eklenince epoch ile karşılaştırılabilir kalır.
 */
export function createRawFrame(bytes: Uint8Array, init: RawFrameInit = {}): RawFrame {
  const frame: RawFrame = {
    id: init.id ?? generateFrameId(),
    timestamp: init.timestamp ?? performance.timeOrigin + performance.now(),
    direction: init.direction ?? 'rx',
    bytes,
  };
  // exactOptionalPropertyTypes'a hazır olmak için opsiyoneller yalnız doluysa yazılır.
  if (init.channel !== undefined) {
    frame.channel = init.channel;
  }
  if (init.metadata !== undefined) {
    frame.metadata = init.metadata;
  }
  return frame;
}
