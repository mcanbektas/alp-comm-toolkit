/**
 * Çerçeveleme motoru — spec §8.4'ün 15 yöntemi (Fixed length … Modbus silent
 * interval) için ORTAK sözleşme. `../types.ts`teki `ProtocolParser`den BİLEREK
 * AYRI bir katman: o "bu baytlar hangi alanlara karşılık gelir" sorusuna cevap
 * verir (protokole özel, saf), bu katman "akan bayt dizisinde bir çerçeve
 * nerede biter" sorusuna cevap verir (protokolden bağımsız, yeniden kullanılır).
 * Çıktısı (`frame`) bir sonraki adımda bir `ProtocolParser.parse()`e ham girdi
 * olur — `../types.ts`teki `RawFrame.bytes` ile aynı sözleşme.
 *
 * `ProtocolParser.parse()` gibi bu katman da SAF kalmak zorunda: `extract()`
 * içeride durum biriktirmez, aynı girdi aynı sonucu verir. Akış durumu
 * (yarım çerçeve, kaç bayt biriktiği) `../streams/streamBuffer.ts`nin işidir.
 */

/**
 * Spec §8.4 (satır 262) TAM LİSTE — 15 yöntem. Bu proje 7 uygulama modülüne
 * damıtır (aşağıdaki `index.ts` yorumunda gerekçesi var); her yöntem yine de
 * kendi kimliğiyle burada AYRI listelenir — katalog/UI bu listeyi birebir
 * gösterecek, hangi modülün hangi yöntemi ürettiği kullanıcıyı ilgilendirmez.
 */
export const FRAMING_METHOD_IDS = [
  'fixed-length',
  'start-byte',
  'multiple-start-bytes',
  'start-end-delimiter',
  'length-field',
  'line-ending',
  'inter-character-timeout',
  'inter-frame-timeout',
  'escape-based',
  'bit-stuffing',
  'byte-stuffing',
  'cobs',
  'slip',
  'hdlc-flag',
  'modbus-silent-interval',
] as const;

export type FramingMethodId = (typeof FRAMING_METHOD_IDS)[number];

/**
 * Spec'in 19 kodluk hata listesinin (§ "Dikkat çekenler") ÇERÇEVELEME
 * alt kümesi — `../types.ts`teki `ProtocolErrorCode`den bilerek ayrı bir
 * union: o kod listesi PROTOKOL alan hatalarını (checksum-mismatch vb.)
 * kapsıyor, checksum/CRC doğrulaması framing katmanının işi DEĞİL (bkz.
 * `../types.ts` `ProtocolParser` sözleşmesi). Framing yalnız YAPISAL
 * bütünlükten sorumlu: çerçeve nerede başlıyor/bitiyor, uzunluk alanı makul
 * mü, escape/stuffing dizisi geçerli mi.
 */
export type FramingErrorCode =
  | 'no-sync'
  | 'invalid-header'
  | 'invalid-length'
  | 'frame-too-short'
  | 'frame-too-long'
  | 'truncated-frame'
  | 'invalid-escape'
  | 'invalid-stuffing'
  | 'buffer-overflow';

export interface FramingError {
  code: FramingErrorCode;
  message: string;
  /** Arabellek başından itibaren, hatanın saptandığı bayt konumu. */
  offset: number;
}

/**
 * `../streams/`teki 9 durumlu makinenin gözlemlenebilir alt-fazı. Her yöntem
 * dördünü de yaşamaz (COBS/SLIP'te ayrı bir "length" fazı yok, fixed-length'te
 * "trailer" yok) — extractor kendi doğal fazını bildirir, uymayan yöntemler
 * `'payload'`a düşer. Uydurma zenginlik değil, dürüst bir varsayılan.
 */
export type FramingPhase = 'header' | 'length' | 'payload' | 'trailer';

export type FrameExtractionResult =
  | { status: 'complete'; frame: Uint8Array; consumedBytes: number }
  | { status: 'incomplete'; consumedBytes: 0; phase: FramingPhase }
  | { status: 'error'; error: FramingError; consumedBytes: number; recoverable: boolean };

export interface FrameExtractorOptions {
  /** Aşılırsa `frame-too-long`/`buffer-overflow` — spec §41 "Maximum frame length uygula". */
  maxFrameLength: number;
  /**
   * Yalnız zaman-tabanlı yöntemler (`inter-character-timeout`,
   * `inter-frame-timeout`, `modbus-silent-interval`) okur. `undefined` ise
   * çağıran YENİ VERİ geldiği için çağırıyordur (push); bir sayı verilmişse
   * ÇAĞRI arabellek boşken de tetiklenen bir "idle tick"tir (bkz.
   * `streams/streamBuffer.ts`teki `tick()`). Saf fonksiyon kuralını korumak
   * için gerçek saat burada YOK — geçen süreyi ölçmek çağıranın işi.
   */
  elapsedSinceLastByteMs?: number;
}

/**
 * Bir çerçeveleme yönteminin çıkarım (decode) tarafı. Kodlama (encode) tarafı
 * bilerek AYRI, adlandırılmış fonksiyonlardır (`encodeSlip`, `encodeCobs`…) —
 * her yöntemin kendi dosyasında dururlar, ortak bir arayüze zorlanmazlar
 * çünkü kodlama girdisi (çıplak payload) yöntemler arası zaten tekdüze.
 */
export interface FrameExtractor {
  readonly method: FramingMethodId;
  extract(buffer: Uint8Array, options: FrameExtractorOptions): FrameExtractionResult;
}
