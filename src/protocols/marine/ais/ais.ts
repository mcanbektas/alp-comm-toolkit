/**
 * AIS (Automatic Identification System) — `!AIVDM`/`!AIVDO` NMEA 0183 taşıma
 * cümlesinin TAM zarfı + 6-bit armored payload'ın yalnız Message Type (ilk 6 bit)
 * alanının çözümü.
 *
 * ── GİRDİ ─────────────────────────────────────────────────────────────────────
 * Girdi `!AIVDM`/`!AIVDO` cümle baytlarıdır (NMEA 0183 taşıması, spec
 * 05-denizcilik.md:128-136: "IEC/NMEA transport → !AIVDM/!AIVDO → AIS 6-bit
 * Payload"). NMEA 0183'ün ASCII cümle katmanı (`$` ile başlar) burada YENİDEN
 * YAZILMAZ — checksum ALGORİTMASI `nmeaChecksum.ts`teki `nmeaXorChecksum`/
 * `formatNmeaChecksum` ile hesaplanır ve alan bölme `nmeaSentences.ts`teki
 * `splitPayloadTokens` ile yapılır (ikisi de doğrudan import edilir). Yalnız
 * cümle sınırlayıcılarını bulan küçük fonksiyon (`splitAisSentence`) burada
 * YENİDEN yazıldı, çünkü `parseNmeaSentence` (nmeaChecksum.ts) `$` başlangıcını
 * SABİT varsayıyor — AIS taşıma cümlesi IEC 61162'nin `!` ile başlayan
 * "encapsulation sentence" alt kümesindendir, `nmea0183.ts`in kapsadığı `$`
 * cümlelerinden AYRI bir sınıf. Uzunluk üst sınırı (`NMEA_0183_MAX_SENTENCE_LENGTH`)
 * `nmea0183.ts`ten DOĞRUDAN import edilir: AIS de aynı 82 karakterlik NMEA 0183
 * cümle sınırına tabidir — fragment mekanizmasının VAR OLMA SEBEBİ zaten büyük
 * binary mesajları bu sınıra sığdırmaktır.
 *
 * ── FRAGMENT: BİRLEŞTİRME YOK, TEK CÜMLE PARSER'I ───────────────────────────
 * Spec (05-denizcilik.md:138-142) fragment reassembly'i (Sequence ID + Channel +
 * Fragment Count + Fragment Number + Arrival Time üzerinden birleştirme, eksik
 * fragment hatası) tarif ediyor ama bu KARAR TURUNDA kapsam dışı bırakıldı: bu
 * motor TEK CÜMLE parser'ıdır, ISO-TP'nin FF/CF parser'ı gibi (bkz. `isotp.ts`
 * dosya başı) çok-çerçeveli oturum TUTMAZ. Fragment count 1'den büyükse
 * `fragmentedMessage` uyarısı basılır — ISO-TP'nin `WARN_TRANSPORT_SESSION`
 * emsaliyle AYNI TONDA ("tam anlam çok parçalı oturum ister") ama KENDİ anahtarı
 * ile: o anahtar burada YENİDEN KULLANILMAZ, çünkü sebep farklı (ISO-TP'de
 * bilinen bir PCI tipi çok çerçeveli, burada NMEA taşıma katmanının kendi
 * fragment mekanizması çok çerçeveli).
 *
 * ── 6-BIT ARMORING: UYGULANIR (kullanıcı kararı) ────────────────────────────
 * Dalga başında sorulan karar EVET çıktı: payload bit akışına açılır, yalnız
 * Message Type (ilk 6 bit, her zaman payload'ın İLK karakterinde tam olarak
 * biter — 6 bit ≤ 8 bitlik bir ASCII karakter) adlandırılır. Alan tabloları
 * (MMSI offset'i, lat/lon ölçeği, Navigation Status enum'u …) M.1371 mesaj
 * veritabanına bağlı olduğu için YAZILMAZ — kalan bitler HAM kalır,
 * `fieldsNeedDatabase` uyarısıyla (spec 15305: "Exact bit-field table … M.1371
 * revision'a bağlı tutulmalı").
 *
 * Armoring kuralı (`decodeAisArmorChar`): karakter kodundan 48 çıkarılır; sonuç
 * 40'ı aşarsa AYRICA 8 çıkarılır (0x30-0x57 ve 0x60-0x77 aralıklarını 0-63'e
 * eşleyen standart M.1371 kuralı). DIŞ KAYNAK — brif "freediag/OBD tarzı
 * bağımsız ikinci kaynakla doğrulanmış" diyor: bu kural gpsd projesinin "AIVDM/
 * AIVDO protocol decoding" belgesi (Eric S. Raymond) VE Wikipedia'nın "Automatic
 * identification system" maddesinde BİRBİRİNDEN BAĞIMSIZ aynı şekilde geçiyor —
 * ikisi de mekanik/kamuya açık bir kural, lisanslı mesaj tablosu DEĞİL.
 *
 * ── MESSAGE TYPE ADLANDIRMASI — KAYNAK UYARISI, UYDURMA YASAK ───────────────
 * Bu deponun spec'i (ana dok. ~15305-15330, özet 05-denizcilik.md:150-154) AIS
 * mesaj tipi listesinde YALNIZ BEŞ İSİM veriyor, NUMARA VERMİYOR: Position
 * Report Class A, Static and Voyage Data, Class B Position Report, Base Station
 * Report, Safety Related Message ("Tam AIS message type/field database M.1371-6
 * revizyonuna bağlı tutulmalıdır" diyerek numaraları BİLEREK dışarıda bırakıyor).
 * Aşağıdaki `NAMED_MESSAGE_TYPES` tablosundaki BEŞ numara (1/4/5/14/18) DIŞ
 * KAYNAKTIR: ITU-R M.1371-5 Tablo 46'nın mesaj tipi numaralandırması, iki
 * bağımsız kamuya açık kaynakla çapraz kontrol edildi (gpsd'nin "AIVDM/AIVDO
 * protocol decoding" belgesi ve Wikipedia'nın AIS mesaj tipi tablosu — DoIP'in
 * payload tipi tablosunu doğrulama yöntemiyle AYNI, brief-faz10-dalga2a.md).
 * SADECE bu beş numara adlandırılır; kalan 22 numara (0, 2-3, 6-13, 15-17,
 * 19-27, 28-63) HER ZAMAN ham kalır + `messageTypeNeedsDatabase` uyarısı basılır
 * — spec'te adı olmayan hiçbir numaraya isim YAZILMAZ.
 *
 * Belirsizlik notu: "Safety Related Message" spec'te addressed/broadcast ayrımı
 * yapılmadan TEK isim olarak geçiyor; M.1371'de bu iki AYRI tiptir (12 addressed,
 * 14 broadcast). Genel amaçlı/daha sık kullanılan broadcast (14) seçildi;
 * addressed (12) adlandırılmadan HAM bırakıldı.
 *
 * ── DURUM: 'ready' (bu oturumda verilen karar, brif "tartışılır" diyordu) ───
 * Zarf (cümle düzeyi: fragment/seq/channel/fill/checksum) TAM çözülüyor VE
 * kimlik alanı (Message Type — KWP2000/ISO9141'deki SID'in AIS karşılığı)
 * adlandırılıyor. NMEA 2000 emsali: orada da zarf (identifier→Priority/PGN/
 * Source/Destination) tam + kimlik alanı (PGN, numara olarak) çözülüp 'ready'
 * verildi — PGN'in İÇERİĞİNİN adlandırılamaması (lisanslı DB) 'partial'e
 * düşürmedi (bkz. `nmea2000.ts` dosya başı). KWP2000/ISO9141 ise 'partial' aldı
 * çünkü SID'i BİLEREK adlandırmadılar (bkz. `iso14230.ts` dosya başı) — burada
 * Message Type BİLEREK adlandırıldığı için aynı mantıkla 'ready' tutarlıdır.
 *
 * ── KAPSAM DIŞI (bilinçli) ───────────────────────────────────────────────────
 * • Fragment reassembly / eksik fragment tespiti: analyzer katmanının işi.
 * • M.1371 alan tabloları (MMSI, Navigation Status, Position, COG, SOG,
 *   Heading …): lisanslı veritabanı ister, burada HİÇ üretilmez.
 * • AIS Target Table / staleness: navigation state modelinin işi, tek cümle
 *   parser'ına girmez.
 */

import { createRawFrame } from '@/protocol-core/types';
import type {
  ExampleFrame,
  FrameDirection,
  ParseContext,
  ParseResult,
  ParsedField,
  ParsedFrame,
  ProtocolError,
  ProtocolParser,
  ProtocolPlugin,
  ProtocolWarning,
} from '@/protocol-core/types';
import { formatNmeaChecksum, nmeaXorChecksum } from '@/protocol-core/checksums/nmeaChecksum';

import { NMEA_0183_MAX_SENTENCE_LENGTH } from '../nmea/nmea0183';
import { splitPayloadTokens } from '../nmea/nmeaSentences';
import type { RawToken } from '../nmea/nmeaSentences';

/** Kayıt defterindeki ve katalogdaki kimlikle AYNI olmak zorunda: bağ bu string. */
const PROTOCOL_ID = 'ais';
/** Protokol adı veridir, çeviriye girmez (CLAUDE.md). */
const PROTOCOL_DISPLAY_NAME = 'AIS';

const START_BYTE = 0x21; // '!' — nmea0183.ts'in `$`inden FARKLI (dosya başı).
/** Payload (talker+formatter+alanlar) cümlede `!`den hemen sonra başlar. */
const PAYLOAD_START_OFFSET = 1;
const CHECKSUM_DELIMITER = '*';
const TALKER_LENGTH = 2;
const FORMATTER_LENGTH = 3;
/** `AIVDM`/`AIVDO`: talker(2) + formatter(3), her zaman tam beş karakter. */
const IDENTIFIER_LENGTH = TALKER_LENGTH + FORMATTER_LENGTH;

/**
 * En kısa anlamlı zarf: `!`+`AIVDM`(5)+`,1,1,,A,X,0`(12)+`*`+2 haneli checksum(2)
 * = 20. Üst sınır `nmea0183.ts`ten devralınır (dosya başı).
 */
export const AIS_MIN_SENTENCE_LENGTH = 20;

const NUMBER_RADIX = 10;
const ARMOR_ASCII_OFFSET = 48;
const ARMOR_HIGH_THRESHOLD = 40;
const ARMOR_HIGH_ADJUSTMENT = 8;
const SIX_BIT_WIDTH = 6;
const MESSAGE_TYPE_BIT_WIDTH = 6;

/** Tokens dizisindeki alan indeksleri (tokens[0] = talker+formatter kimliği). */
const TOKEN_INDEX_FRAGMENT_COUNT = 1;
const TOKEN_INDEX_FRAGMENT_NUMBER = 2;
const TOKEN_INDEX_SEQUENCE_MESSAGE_ID = 3;
const TOKEN_INDEX_CHANNEL = 4;
const TOKEN_INDEX_PAYLOAD = 5;
const TOKEN_INDEX_FILL_BITS = 6;
/** Tam bir zarf en az bu kadar token içerir (indeks 0..6, yani yedi parça). */
const FULL_ENVELOPE_TOKEN_COUNT = 7;

const ERROR_SENTENCE_TOO_SHORT = 'protocol.ais.error.sentenceTooShort';
const ERROR_SENTENCE_TOO_LONG = 'protocol.ais.error.sentenceTooLong';
const ERROR_START_DELIMITER_NOT_FOUND = 'protocol.ais.error.startDelimiterNotFound';
const ERROR_MISSING_CHECKSUM_DELIMITER = 'protocol.ais.error.missingChecksumDelimiter';
const ERROR_MALFORMED_IDENTIFIER = 'protocol.ais.error.malformedIdentifier';
const ERROR_UNKNOWN_FORMATTER = 'protocol.ais.error.unknownFormatter';
const ERROR_INSUFFICIENT_ENVELOPE_FIELDS = 'protocol.ais.error.insufficientEnvelopeFields';
const ERROR_EMPTY_PAYLOAD = 'protocol.ais.error.emptyPayload';
const ERROR_CHECKSUM_MISMATCH = 'protocol.ais.error.checksumMismatch';
const ERROR_ABORTED = 'protocol.ais.error.aborted';

const WARN_FRAGMENTED_MESSAGE = 'protocol.ais.warning.fragmentedMessage';
const WARN_MESSAGE_TYPE_NEEDS_DATABASE = 'protocol.ais.warning.messageTypeNeedsDatabase';
const WARN_FIELDS_NEED_DATABASE = 'protocol.ais.warning.fieldsNeedDatabase';
const WARN_UNPARSEABLE_NUMBER = 'protocol.ais.warning.unparseableNumber';

const SUMMARY_RECEIVED = 'protocol.ais.summary.received';
const SUMMARY_OWN_VESSEL = 'protocol.ais.summary.ownVessel';

/**
 * Beş adlandırılmış Message Type numarası — dış kaynak, dosya başı "MESSAGE TYPE
 * ADLANDIRMASI" bölümüne bak. Protokol terimi, veridir, çevrilmez (CLAUDE.md).
 */
const NAMED_MESSAGE_TYPES: ReadonlyMap<number, string> = new Map([
  [1, 'Position Report Class A'],
  [4, 'Base Station Report'],
  [5, 'Static and Voyage Data'],
  [14, 'Safety Related Message'],
  [18, 'Class B Position Report'],
]);

/**
 * VDM/VDO açılımı ve received/own-vessel ayrımı IEC 61162-1'in talker+sentence
 * adlandırma kuralından gelir — yapısal terim, M.1371 mesaj alanı DEĞİL (DoIP'in
 * payload tipi adları emsali, dosya başı).
 */
const FORMATTER_DESCRIPTIONS: ReadonlyMap<string, string> = new Map([
  ['VDM', 'Received AIS VHF Data-link Message'],
  ['VDO', 'Own-vessel AIS VHF Data-link Report'],
]);

function toProtocolWarning(key: string): ProtocolWarning {
  return { code: key, message: key };
}

function byteAt(data: Uint8Array, offset: number): number {
  return data[offset] ?? 0;
}

/** Byte → karakter, `String.fromCharCode` ile (nmea0183.ts'teki ASCII tuzağının aynısı). */
function bytesToAsciiString(data: Uint8Array): string {
  let text = '';
  for (let index = 0; index < data.length; index += 1) {
    text += String.fromCharCode(data[index] ?? 0);
  }
  return text;
}

/** Örnek çerçeveler için ters yön: metin → ASCII byte dizisi. */
function asciiBytes(text: string): Uint8Array {
  const bytes = new Uint8Array(text.length);
  for (let index = 0; index < text.length; index += 1) {
    bytes[index] = text.charCodeAt(index);
  }
  return bytes;
}

function isAisFormatter(value: string): value is 'VDM' | 'VDO' {
  return value === 'VDM' || value === 'VDO';
}

interface AisSentenceParts {
  /** `!` ve `*` arasındaki, checksum'ın hesaplandığı ham metin. */
  payload: string;
  /** `*`dan sonraki, cümlenin kendi bildirdiği checksum. */
  checksumHex: string;
}

/**
 * `!`den `*`e kadarki payload'ı ve checksum hanesini ayırır. `parseNmeaSentence`
 * (nmeaChecksum.ts) burada KULLANILAMAZ çünkü `$` başlangıcını SABİT varsayıyor
 * (dosya başı). Checksum HESABI yine de nmeaChecksum.ts'teki fonksiyonlarla
 * yapılır — burada yeniden yazılan yalnız sınırlayıcı arama, algoritma değil.
 */
function splitAisSentence(sentence: string): AisSentenceParts | undefined {
  const delimiterIndex = sentence.indexOf(CHECKSUM_DELIMITER);
  if (delimiterIndex === -1) return undefined;
  const payload = sentence.slice(PAYLOAD_START_OFFSET, delimiterIndex);
  const checksumHex = sentence.slice(delimiterIndex + CHECKSUM_DELIMITER.length).trim();
  return { payload, checksumHex };
}

/**
 * M.1371 6-bit ASCII armoring kuralı — dosya başı kaynak uyarısına bak. Saf
 * mekanik fonksiyon: bir tablo değil, doğrudan aritmetik kural.
 */
export function decodeAisArmorChar(char: string): number {
  const code = char.charCodeAt(0);
  let value = code - ARMOR_ASCII_OFFSET;
  if (value > ARMOR_HIGH_THRESHOLD) {
    value -= ARMOR_HIGH_ADJUSTMENT;
  }
  return value;
}

interface AisPayloadDecode {
  readonly messageType: number;
  readonly totalBitCount: number;
  readonly validBitCount: number;
}

/**
 * Payload'ı TAM bit akışına açar (dosya başı: "payload bit akışına açılır").
 * Yalnız ilk altı bit (Message Type) kullanılır; kalanı çağıran HAM bırakır.
 * `fillBits` son karakterdeki dolgu bit sayısıdır — `validBitCount` bunu düşer.
 */
function decodeAisPayload(payloadValue: string, fillBits: number): AisPayloadDecode {
  const bits: number[] = [];
  for (let index = 0; index < payloadValue.length; index += 1) {
    const sixBit = decodeAisArmorChar(payloadValue.charAt(index));
    for (let bit = SIX_BIT_WIDTH - 1; bit >= 0; bit -= 1) {
      bits.push((sixBit >>> bit) & 1);
    }
  }
  const totalBitCount = bits.length;
  const validBitCount = Math.max(0, totalBitCount - fillBits);

  let messageType = 0;
  for (let bit = 0; bit < MESSAGE_TYPE_BIT_WIDTH; bit += 1) {
    messageType = (messageType << 1) | (bits[bit] ?? 0);
  }

  return { messageType, totalBitCount, validBitCount };
}

/** Tek bir CSV alanını `ParsedField`e çevirir; boş token da alan üretir (spec §47). */
function pushToken(
  fields: ParsedField[],
  data: Uint8Array,
  token: RawToken,
  id: string,
  name: string,
): ParsedField {
  const field: ParsedField = {
    id,
    name,
    offset: token.offset,
    length: token.value.length,
    rawBytes: data.slice(token.offset, token.offset + token.value.length),
    valid: true,
    warnings: [],
  };
  if (token.value !== '') {
    field.rawValue = token.value;
  }
  fields.push(field);
  return field;
}

/** Alanın ham metnini tamsayıya çevirir ve `physicalValue`ya yazar; başarısızsa alanı geçersiz işaretler. */
function attachIntegerValue(field: ParsedField, warnings: ProtocolWarning[]): number | undefined {
  if (field.rawValue === undefined) return undefined;
  const parsed = Number.parseInt(String(field.rawValue), NUMBER_RADIX);
  if (!Number.isFinite(parsed)) {
    field.valid = false;
    field.warnings.push(WARN_UNPARSEABLE_NUMBER);
    warnings.push(toProtocolWarning(WARN_UNPARSEABLE_NUMBER));
    return undefined;
  }
  field.physicalValue = parsed;
  return parsed;
}

export type AisFrameMetadata = {
  talker: string;
  formatter: 'VDM' | 'VDO';
  fragmentCount: number | undefined;
  fragmentNumber: number | undefined;
  sequenceMessageId: number | undefined;
  channel: string | undefined;
  fillBits: number | undefined;
  messageType: number | undefined;
  messageTypeName: string | undefined;
  checksumReceived: string;
  checksumCalculated: string;
  summaryKey: string;
  summaryParams: Record<string, string>;
};

interface AisParseOptions {
  timestamp?: number;
  direction?: FrameDirection;
  channel?: string;
  maxSentenceLength?: number;
  signal?: AbortSignal;
}

function parseAisFrame(data: Uint8Array, options: AisParseOptions): ParseResult {
  if (options.signal?.aborted === true) {
    // İptal beklenen bir sonuçtur, hata değil (spec §41) — nmea0183.ts emsali.
    return {
      success: false,
      error: { code: 'parser-timeout', message: ERROR_ABORTED },
      consumedBytes: 0,
      recoverable: false,
    };
  }

  if (data.length < AIS_MIN_SENTENCE_LENGTH) {
    return {
      success: false,
      error: {
        code: 'truncated-frame',
        message: ERROR_SENTENCE_TOO_SHORT,
        offset: 0,
        length: data.length,
      },
      consumedBytes: 0,
      recoverable: true,
    };
  }

  const maxSentenceLength = options.maxSentenceLength ?? NMEA_0183_MAX_SENTENCE_LENGTH;
  if (data.length > maxSentenceLength) {
    return {
      success: false,
      error: {
        code: 'frame-too-long',
        message: ERROR_SENTENCE_TOO_LONG,
        offset: maxSentenceLength,
        length: data.length - maxSentenceLength,
        details: { maxSentenceLength, sentenceLength: data.length },
      },
      consumedBytes: 0,
      recoverable: false,
    };
  }

  if (byteAt(data, 0) !== START_BYTE) {
    return {
      success: false,
      error: {
        code: 'start-delimiter-not-found',
        message: ERROR_START_DELIMITER_NOT_FOUND,
        offset: 0,
        length: 1,
      },
      consumedBytes: 0,
      recoverable: true,
    };
  }

  const sentence = bytesToAsciiString(data);
  const parts = splitAisSentence(sentence);
  if (parts === undefined) {
    return {
      success: false,
      error: {
        code: 'truncated-frame',
        message: ERROR_MISSING_CHECKSUM_DELIMITER,
        offset: 0,
        length: data.length,
      },
      consumedBytes: 0,
      recoverable: true,
    };
  }

  const tokens = splitPayloadTokens(parts.payload, PAYLOAD_START_OFFSET);
  const identifierToken = tokens[0];
  if (identifierToken === undefined || identifierToken.value.length !== IDENTIFIER_LENGTH) {
    return {
      success: false,
      error: {
        code: 'truncated-frame',
        message: ERROR_MALFORMED_IDENTIFIER,
        offset: PAYLOAD_START_OFFSET,
        length: identifierToken?.value.length ?? 0,
      },
      consumedBytes: 0,
      recoverable: true,
    };
  }

  const talker = identifierToken.value.slice(0, TALKER_LENGTH);
  const formatter = identifierToken.value.slice(TALKER_LENGTH);
  const formatterOffset = identifierToken.offset + TALKER_LENGTH;

  if (!isAisFormatter(formatter)) {
    return {
      success: false,
      error: {
        code: 'value-out-of-range',
        message: ERROR_UNKNOWN_FORMATTER,
        offset: formatterOffset,
        length: FORMATTER_LENGTH,
        details: { formatter },
      },
      consumedBytes: 0,
      recoverable: true,
    };
  }

  const fields: ParsedField[] = [];
  const warnings: ProtocolWarning[] = [];
  const errors: ProtocolError[] = [];

  fields.push({
    id: 'talker',
    name: 'Talker ID',
    offset: identifierToken.offset,
    length: TALKER_LENGTH,
    rawBytes: data.slice(identifierToken.offset, identifierToken.offset + TALKER_LENGTH),
    rawValue: talker,
    valid: true,
    warnings: [],
  });

  const formatterField: ParsedField = {
    id: 'sentence-formatter',
    name: 'Sentence Formatter',
    offset: formatterOffset,
    length: FORMATTER_LENGTH,
    rawBytes: data.slice(formatterOffset, formatterOffset + FORMATTER_LENGTH),
    rawValue: formatter,
    valid: true,
    warnings: [],
  };
  const formatterDescription = FORMATTER_DESCRIPTIONS.get(formatter);
  if (formatterDescription !== undefined) {
    // Protokol terimi — veridir, çevrilmez (dosya başı FORMATTER_DESCRIPTIONS notu).
    formatterField.physicalValue = formatterDescription;
  }
  fields.push(formatterField);

  const fragmentCountToken = tokens[TOKEN_INDEX_FRAGMENT_COUNT];
  let fragmentCountValue: number | undefined;
  if (fragmentCountToken !== undefined) {
    const field = pushToken(fields, data, fragmentCountToken, 'fragment-count', 'Fragment Count');
    fragmentCountValue = attachIntegerValue(field, warnings);
  }

  const fragmentNumberToken = tokens[TOKEN_INDEX_FRAGMENT_NUMBER];
  let fragmentNumberValue: number | undefined;
  if (fragmentNumberToken !== undefined) {
    const field = pushToken(fields, data, fragmentNumberToken, 'fragment-number', 'Fragment Number');
    fragmentNumberValue = attachIntegerValue(field, warnings);
  }

  const sequenceToken = tokens[TOKEN_INDEX_SEQUENCE_MESSAGE_ID];
  let sequenceValue: number | undefined;
  if (sequenceToken !== undefined) {
    // Tek parçalı mesajlarda bu alan boş kalır — NORMALDİR, uyarı basılmaz.
    const field = pushToken(fields, data, sequenceToken, 'sequence-message-id', 'Sequence Message ID');
    sequenceValue = attachIntegerValue(field, warnings);
  }

  const channelToken = tokens[TOKEN_INDEX_CHANNEL];
  let channelValue: string | undefined;
  if (channelToken !== undefined) {
    pushToken(fields, data, channelToken, 'channel', 'Channel');
    channelValue = channelToken.value === '' ? undefined : channelToken.value;
  }

  const payloadToken = tokens[TOKEN_INDEX_PAYLOAD];
  const fillBitsToken = tokens[TOKEN_INDEX_FILL_BITS];

  // Fill bits alanı, payload'ın validBitCount hesabından ÖNCE gerekiyor; alan
  // kendisi zarf sırasına (payload'dan SONRA) uygun şekilde aşağıda basılır.
  let fillBitsValue: number | undefined;
  if (fillBitsToken !== undefined && fillBitsToken.value !== '') {
    const parsed = Number.parseInt(fillBitsToken.value, NUMBER_RADIX);
    if (Number.isFinite(parsed)) {
      fillBitsValue = parsed;
    }
  }

  let messageType: number | undefined;
  let messageTypeName: string | undefined;

  if (payloadToken === undefined || payloadToken.value === '') {
    errors.push({
      code: 'truncated-frame',
      message: ERROR_EMPTY_PAYLOAD,
      offset: identifierToken.offset,
      length: 0,
    });
  } else {
    const decoded = decodeAisPayload(payloadToken.value, fillBitsValue ?? 0);
    messageType = decoded.messageType;
    messageTypeName = NAMED_MESSAGE_TYPES.get(messageType);

    const messageTypeField: ParsedField = {
      id: 'message-type',
      name: 'Message Type',
      offset: payloadToken.offset,
      length: 1,
      rawBytes: data.slice(payloadToken.offset, payloadToken.offset + 1),
      rawValue: messageType,
      valid: true,
      warnings: [],
    };
    if (messageTypeName !== undefined) {
      messageTypeField.physicalValue = messageTypeName;
    } else {
      messageTypeField.warnings.push(WARN_MESSAGE_TYPE_NEEDS_DATABASE);
      warnings.push(toProtocolWarning(WARN_MESSAGE_TYPE_NEEDS_DATABASE));
    }
    fields.push(messageTypeField);

    const remainingLength = payloadToken.value.length - 1;
    if (remainingLength > 0) {
      const remainingOffset = payloadToken.offset + 1;
      const remainingBitCount = Math.max(0, decoded.validBitCount - MESSAGE_TYPE_BIT_WIDTH);
      fields.push({
        id: 'remaining-payload',
        name: 'Remaining Payload (encoded)',
        offset: remainingOffset,
        length: remainingLength,
        rawBytes: data.slice(remainingOffset, remainingOffset + remainingLength),
        // Alan tabloları M.1371 veritabanına bağlı — burada YALNIZ bit sayısı
        // gösterilir, hiçbir anlam yakıştırılmaz (dosya başı).
        physicalValue: remainingBitCount,
        unit: 'bit',
        valid: true,
        warnings: [WARN_FIELDS_NEED_DATABASE],
      });
      warnings.push(toProtocolWarning(WARN_FIELDS_NEED_DATABASE));
    }
  }

  if (fillBitsToken !== undefined) {
    const field = pushToken(fields, data, fillBitsToken, 'fill-bits', 'Fill Bits');
    attachIntegerValue(field, warnings);
  }

  if (tokens.length < FULL_ENVELOPE_TOKEN_COUNT) {
    errors.push({
      code: 'truncated-frame',
      message: ERROR_INSUFFICIENT_ENVELOPE_FIELDS,
      offset: identifierToken.offset,
      length: 0,
    });
  }

  if (fragmentCountValue !== undefined && fragmentCountValue > 1) {
    warnings.push(toProtocolWarning(WARN_FRAGMENTED_MESSAGE));
  }

  const calculatedChecksum = formatNmeaChecksum(nmeaXorChecksum(parts.payload));
  const receivedChecksum = parts.checksumHex.toUpperCase();
  const checksumMatches = calculatedChecksum === receivedChecksum;
  const checksumOffset = sentence.indexOf(CHECKSUM_DELIMITER) + 1;
  const checksumField: ParsedField = {
    id: 'checksum',
    name: 'Checksum',
    offset: checksumOffset,
    length: parts.checksumHex.length,
    rawBytes: data.slice(checksumOffset, checksumOffset + parts.checksumHex.length),
    rawValue: receivedChecksum,
    physicalValue: calculatedChecksum,
    valid: checksumMatches,
    warnings: [],
  };
  if (!checksumMatches) {
    errors.push({
      code: 'checksum-mismatch',
      message: ERROR_CHECKSUM_MISMATCH,
      offset: checksumOffset,
      length: parts.checksumHex.length,
      details: { received: receivedChecksum, calculated: calculatedChecksum },
    });
  }
  fields.push(checksumField);

  const summaryParams: Record<string, string> = {
    formatter,
    messageType: messageType === undefined ? '' : String(messageType),
  };

  const metadata: AisFrameMetadata = {
    talker,
    formatter,
    fragmentCount: fragmentCountValue,
    fragmentNumber: fragmentNumberValue,
    sequenceMessageId: sequenceValue,
    channel: channelValue,
    fillBits: fillBitsValue,
    messageType,
    messageTypeName,
    checksumReceived: receivedChecksum,
    checksumCalculated: calculatedChecksum,
    summaryKey: formatter === 'VDO' ? SUMMARY_OWN_VESSEL : SUMMARY_RECEIVED,
    summaryParams,
  };

  const rawFrame = createRawFrame(data, {
    ...(options.timestamp === undefined ? {} : { timestamp: options.timestamp }),
    ...(options.direction === undefined ? {} : { direction: options.direction }),
    ...(options.channel === undefined ? {} : { channel: options.channel }),
    metadata,
  });

  const frame: ParsedFrame = {
    protocol: PROTOCOL_ID,
    timestamp: rawFrame.timestamp,
    rawFrame,
    fields,
    valid: errors.length === 0,
    errors,
    warnings,
  };

  return { success: true, frame, consumedBytes: data.length };
}

/** Tek bir AIS taşıma cümlesini çözer. `data` TAM BİR CÜMLE olmalıdır (`!`den checksum'a). */
export function parseAis(data: Uint8Array): ParseResult {
  return parseAisFrame(data, {});
}

export const aisParser: ProtocolParser = {
  protocolId: PROTOCOL_ID,
  displayName: PROTOCOL_DISPLAY_NAME,

  /**
   * UCUZ olmak zorunda (spec §7): uzunluk aralığı + `!` başlangıcı + formatter
   * baytlarının `VDM`/`VDO` olması. Tam checksum/armoring HESABI YAPILMAZ.
   */
  canParse(data: Uint8Array): boolean {
    if (data.length < AIS_MIN_SENTENCE_LENGTH || data.length > NMEA_0183_MAX_SENTENCE_LENGTH) {
      return false;
    }
    if (byteAt(data, 0) !== START_BYTE) return false;
    const formatterOffset = PAYLOAD_START_OFFSET + TALKER_LENGTH;
    const formatterBytes = [
      byteAt(data, formatterOffset),
      byteAt(data, formatterOffset + 1),
      byteAt(data, formatterOffset + 2),
    ];
    const isVdm = formatterBytes[0] === 0x56 && formatterBytes[1] === 0x44 && formatterBytes[2] === 0x4d;
    const isVdo = formatterBytes[0] === 0x56 && formatterBytes[1] === 0x44 && formatterBytes[2] === 0x4f;
    return isVdm || isVdo;
  },

  parse(data: Uint8Array, context?: ParseContext): ParseResult {
    const options: AisParseOptions = {};
    if (context?.timestamp !== undefined) options.timestamp = context.timestamp;
    if (context?.direction !== undefined) options.direction = context.direction;
    if (context?.channel !== undefined) options.channel = context.channel;
    if (context?.maxFrameLength !== undefined) options.maxSentenceLength = context.maxFrameLength;
    if (context?.signal !== undefined) options.signal = context.signal;
    return parseAisFrame(data, options);
  },
};

/**
 * Örnek çerçeveler. Checksum'ları GERÇEK XOR algoritmasıyla hesaplanıp
 * doğrulandı (`ais.test.ts`), nmea0183.ts'in kalan örnekleri gibi UYDURULMADI.
 * Payload karakterleri M.1371'in geçerli armor kümesinden (`0`-`W`, `` ` ``-`w`)
 * seçildi ama İÇERİK (MMSI, konum …) iddia etmez — yalnız Message Type ve zarf
 * alanlarını göstermek için var (dosya başı: alan tabloları HİÇ üretilmez).
 */
const EXAMPLE_FRAMES: ExampleFrame[] = [
  {
    id: 'position-report-class-a',
    name: 'protocol.ais.example.positionReportClassA.name',
    // Message Type 1 ('1' → 1): adlandırılmış tip, tek fragment, kanal A.
    bytes: asciiBytes('!AIVDM,1,1,,A,16b?w,0*0B'),
    description: 'protocol.ais.example.positionReportClassA.description',
    expectedValid: true,
  },
  {
    id: 'multi-fragment-static-data',
    name: 'protocol.ais.example.multiFragmentStaticData.name',
    // Spec'in kendi örnek zarfı (2,1,5,A) — Message Type 5 ('5' → 5), 2 fragment'in ilki.
    bytes: asciiBytes('!AIVDM,2,1,5,A,56b?w,0*39'),
    description: 'protocol.ais.example.multiFragmentStaticData.description',
    expectedValid: true,
  },
  {
    id: 'checksum-mismatch',
    name: 'protocol.ais.example.checksumMismatch.name',
    // İlk örnekle AYNI gövde, son checksum hanesi bilerek bozuldu (0B → 0C).
    bytes: asciiBytes('!AIVDM,1,1,,A,16b?w,0*0C'),
    description: 'protocol.ais.example.checksumMismatch.description',
    expectedValid: false,
  },
  {
    id: 'unnamed-message-type',
    name: 'protocol.ais.example.unnamedMessageType.name',
    // Message Type 8 ('8' → 8): Binary Broadcast Message — spec'in beşli
    // listesinde YOK, ham numara + messageTypeNeedsDatabase uyarısı basılır.
    bytes: asciiBytes('!AIVDM,1,1,,A,86b?w,0*02'),
    description: 'protocol.ais.example.unnamedMessageType.description',
    expectedValid: true,
  },
  {
    id: 'own-vessel-class-b',
    name: 'protocol.ais.example.ownVesselClassB.name',
    // AIVDO (own-vessel), Message Type 18 ('B' → 18): adlandırılmış tip.
    bytes: asciiBytes('!AIVDO,1,1,,B,B6b?w,0*79'),
    description: 'protocol.ais.example.ownVesselClassB.description',
    expectedValid: true,
  },
];

export const aisPlugin: ProtocolPlugin = {
  id: PROTOCOL_ID,
  name: PROTOCOL_DISPLAY_NAME,
  category: 'marine-navigation',
  parser: aisParser,
  documentation: {
    summary: 'protocol.ais.documentation.summary',
    layer: 'application',
  },
  exampleFrames: EXAMPLE_FRAMES,
};
