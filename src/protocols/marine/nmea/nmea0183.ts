/**
 * NMEA 0183 taşıma katmanı — ASCII cümle çerçevesi (spec §"NMEA 0183", 05-denizcilik.md).
 *
 * Cümle çözümü BURADA YOKTUR; alan alan semantik/generic çözüm `nmeaSentences.ts`te
 * tek yerde yaşar (modbusPdu.ts/modbusRtu.ts ayrımının karşılığı). Bu dosyanın işi
 * yalnız çerçeve: `$`/`*` sınırlayıcıları, talker/formatter ayrımı, checksum ve
 * `ProtocolPlugin` bağlanması.
 *
 * TUZAK — OFSET TABANI: `nmeaSentences.ts`teki her ofset TAM CÜMLEYE göredir,
 * modbus'un PDU-gövdesi ofsetlerinin aksine burada ayrı bir taşıma kaydırması
 * YOKTUR — NMEA'nin tek bir taşıması var (RTU/ASCII/TCP gibi çoklu wire biçimi yok).
 *
 * TUZAK — ASCII VARSAYIMI: `bytesToAsciiString` her byte'ı doğrudan karakter
 * koduna çevirir (`String.fromCharCode`), `TextDecoder` KULLANILMAZ: spec NMEA'nin
 * yazdırılabilir ASCII olmak ZORUNDA olduğunu söylüyor, bu yüzden karakter indeksi
 * ile byte ofseti birebir örtüşür. `TextDecoder('utf-8')` çok baytlı girdide bu
 * eşleşmeyi bozardı (replacement karakteri farklı uzunlukta olabilir).
 *
 * Bozuk checksum HATA'dır ama cümle yine de ALAN ALAN çözülür (`success: true`,
 * `frame.valid: false`) — modbusRtu.ts'in CRC deseniyle aynı gerekçe (spec §47).
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
import {
  formatNmeaChecksum,
  nmeaXorChecksum,
  parseNmeaSentence,
} from '@/protocol-core/checksums/nmeaChecksum';

import { decodeSentenceFields, getSentenceInfo, splitPayloadTokens } from './nmeaSentences';

/** Kayıt defterindeki ve katalogdaki kimlikle AYNI olmak zorunda: bağ bu string. */
const PROTOCOL_ID = 'nmea-0183';
/** Protokol adı veridir, çeviriye girmez (CLAUDE.md "protokol adları veridir"). */
const PROTOCOL_DISPLAY_NAME = 'NMEA 0183';

const START_BYTE = 0x24; // '$'
/** Payload (talker+formatter+alanlar) cümlede `$`den hemen sonra başlar. */
const PAYLOAD_START_OFFSET = 1;
/** Talker her zaman 2 karakterdir; formatter en az 1 karakter olmalı. */
const IDENTIFIER_MIN_LENGTH = 3;
const TALKER_LENGTH = 2;

/** En kısa anlamlı cümle: `$` + talker(2) + formatter(1) + `*` + 2 hex haneli checksum. */
export const NMEA_0183_MIN_SENTENCE_LENGTH = 7;
/** NMEA 0183 klasik sınırı: `$` ve CR/LF dahil bir cümle en çok 82 karakterdir. */
export const NMEA_0183_MAX_SENTENCE_LENGTH = 82;

/**
 * Hata dizgeleri ÇEVİRİ ANAHTARIDIR, düz metin değil (CLAUDE.md): görünen hiçbir
 * metin koda gömülmez. Sayılar (alınan/hesaplanan checksum) `details` üzerinden ayrı basılır.
 */
const ERROR_SENTENCE_TOO_SHORT = 'protocol.nmea.0183.error.sentenceTooShort';
const ERROR_SENTENCE_TOO_LONG = 'protocol.nmea.0183.error.sentenceTooLong';
const ERROR_START_DELIMITER_NOT_FOUND = 'protocol.nmea.0183.error.startDelimiterNotFound';
const ERROR_MISSING_CHECKSUM_DELIMITER = 'protocol.nmea.0183.error.missingChecksumDelimiter';
const ERROR_MALFORMED_IDENTIFIER = 'protocol.nmea.0183.error.malformedIdentifier';
const ERROR_CHECKSUM_MISMATCH = 'protocol.nmea.0183.error.checksumMismatch';
const ERROR_ABORTED = 'protocol.nmea.0183.error.aborted';

/**
 * Çerçeve seviyesinde taşınan ek bilgi. `ParsedFrame`de özet alanı YOKTUR (spec §7);
 * `interface` DEĞİL `type`: `RawFrame.metadata` `Record<string, unknown>` ve
 * TypeScript arayüzleri örtük indeks imzası taşımadığı için oraya atanamazdı.
 */
export type NmeaSentenceFrameMetadata = {
  talker: string;
  formatter: string;
  hasSemanticFields: boolean;
  summaryKey: string;
  summaryParams: Record<string, string>;
  checksumReceived: string;
  checksumCalculated: string;
};

/**
 * `ProtocolWarning.code` ile `message` aynı çeviri anahtarını taşır — modbusRtu.ts'teki
 * aynı kararın gerekçesi burada da geçerli: anahtar zaten benzersiz makine kimliği.
 */
function toProtocolWarning(key: string): ProtocolWarning {
  return { code: key, message: key };
}

/**
 * Byte → karakter, `String.fromCharCode` ile birebir (bkz. dosya başı ASCII tuzağı).
 * `noUncheckedIndexedAccess`: dizi elemanı `number | undefined`.
 */
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

interface NmeaParseOptions {
  timestamp?: number;
  direction?: FrameDirection;
  channel?: string;
  maxSentenceLength?: number;
  signal?: AbortSignal;
}

function parseSentence(data: Uint8Array, options: NmeaParseOptions): ParseResult {
  if (options.signal?.aborted === true) {
    // İptal beklenen bir sonuçtur, hata değil: fırlatmak yerine kodla döner (spec §41).
    return {
      success: false,
      error: { code: 'parser-timeout', message: ERROR_ABORTED },
      consumedBytes: 0,
      recoverable: false,
    };
  }

  if (data.length < NMEA_0183_MIN_SENTENCE_LENGTH) {
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

  if (data[0] !== START_BYTE) {
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
  const parts = parseNmeaSentence(sentence);
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
  if (identifierToken === undefined || identifierToken.value.length < IDENTIFIER_MIN_LENGTH) {
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

  const talkerField: ParsedField = {
    id: 'talker',
    name: 'Talker ID',
    offset: identifierToken.offset,
    length: TALKER_LENGTH,
    rawBytes: data.slice(identifierToken.offset, identifierToken.offset + TALKER_LENGTH),
    rawValue: talker,
    valid: true,
    warnings: [],
  };

  const sentenceInfo = getSentenceInfo(formatter);
  const formatterField: ParsedField = {
    id: 'sentence-formatter',
    name: 'Sentence Formatter',
    offset: formatterOffset,
    length: formatter.length,
    rawBytes: data.slice(formatterOffset, formatterOffset + formatter.length),
    rawValue: formatter,
    valid: true,
    warnings: [],
  };
  if (sentenceInfo !== undefined) {
    // Protokol terimi — veridir, çevrilmez (spec §3.3'ün "GGA" gibi cümle isimleri).
    formatterField.physicalValue = sentenceInfo.name;
  }

  const decoded = decodeSentenceFields(formatter, data, tokens);
  const warnings: ProtocolWarning[] = decoded.warnings.map(toProtocolWarning);
  const errors: ProtocolError[] = [];

  const calculatedChecksum = formatNmeaChecksum(nmeaXorChecksum(parts.payload));
  const receivedChecksum = parts.checksumHex.toUpperCase();
  const checksumMatches = calculatedChecksum === receivedChecksum;
  const checksumOffset = sentence.indexOf('*') + 1;
  const checksumField: ParsedField = {
    id: 'checksum',
    name: 'Checksum',
    offset: checksumOffset,
    length: parts.checksumHex.length,
    rawBytes: data.slice(checksumOffset, checksumOffset + parts.checksumHex.length),
    rawValue: receivedChecksum,
    // Spec'in checksum görünümü alınan ve hesaplanan değeri YAN YANA ister.
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

  const metadata: NmeaSentenceFrameMetadata = {
    talker,
    formatter,
    hasSemanticFields: sentenceInfo?.hasSemanticFields ?? false,
    summaryKey: decoded.summaryKey,
    summaryParams: decoded.summaryParams,
    checksumReceived: receivedChecksum,
    checksumCalculated: calculatedChecksum,
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
    fields: [talkerField, formatterField, ...decoded.fields, checksumField],
    valid: errors.length === 0,
    errors,
    warnings,
  };

  return { success: true, frame, consumedBytes: data.length };
}

/** Tek bir NMEA 0183 cümlesini çözer. `data` TAM BİR CÜMLE olmalıdır (`$`den checksum'a). */
export function parseNmea0183(data: Uint8Array): ParseResult {
  return parseSentence(data, {});
}

export const nmea0183Parser: ProtocolParser = {
  protocolId: PROTOCOL_ID,
  displayName: PROTOCOL_DISPLAY_NAME,

  /**
   * UCUZ olmak zorunda: otomatik tanımada 172 parser'a sırayla soruluyor (spec §7).
   * Yalnız uzunluk aralığı ve ilk byte kontrol edilir — checksum hesabı YAPILMAZ.
   */
  canParse(data: Uint8Array): boolean {
    if (data.length < NMEA_0183_MIN_SENTENCE_LENGTH || data.length > NMEA_0183_MAX_SENTENCE_LENGTH) {
      return false;
    }
    return data[0] === START_BYTE;
  },

  parse(data: Uint8Array, context?: ParseContext): ParseResult {
    const options: NmeaParseOptions = {};
    if (context?.timestamp !== undefined) {
      options.timestamp = context.timestamp;
    }
    if (context?.direction !== undefined) {
      options.direction = context.direction;
    }
    if (context?.channel !== undefined) {
      options.channel = context.channel;
    }
    if (context?.maxFrameLength !== undefined) {
      options.maxSentenceLength = context.maxFrameLength;
    }
    if (context?.signal !== undefined) {
      options.signal = context.signal;
    }
    return parseSentence(data, options);
  },
};

/**
 * Örnek çerçeveler spec §43'ün fixture'ı ve §42 madde 4'ün "örnek veri"sidir:
 * arayüzdeki "örnek yükle" ile testler AYNI byte dizisini kullanır. GGA fixture'ı
 * spec'in doğrulanmış değeridir; kalan örneklerin checksum'ları gerçek XOR
 * algoritmasıyla hesaplanıp doğrulandı (`nmea0183.test.ts`), uydurulmadı.
 *
 * Adlar ve açıklamalar çeviri anahtarıdır; cümle metinleri veridir. Tüketici bu
 * dizileri DEĞİŞTİRMEMELİ — plugin nesnesi tekildir, paylaşılır.
 */
const EXAMPLE_FRAMES: ExampleFrame[] = [
  {
    id: 'gga-fix',
    name: 'protocol.nmea.0183.example.ggaFix.name',
    // Spec §43 fixture'ı, birebir: Latitude 48.1173, Longitude 11.516666..., Checksum valid.
    bytes: asciiBytes('$GPGGA,123519,4807.038,N,01131.000,E,1,08,0.9,545.4,M,46.9,M,,*47'),
    description: 'protocol.nmea.0183.example.ggaFix.description',
    expectedValid: true,
  },
  {
    id: 'gga-checksum-mismatch',
    name: 'protocol.nmea.0183.example.ggaChecksumMismatch.name',
    // Aynı GGA fixture'ı, son checksum hanesi bilerek bozuldu (47 → 48).
    bytes: asciiBytes('$GPGGA,123519,4807.038,N,01131.000,E,1,08,0.9,545.4,M,46.9,M,,*48'),
    description: 'protocol.nmea.0183.example.ggaChecksumMismatch.description',
    expectedValid: false,
  },
  {
    id: 'rmc-fix',
    name: 'protocol.nmea.0183.example.rmcFix.name',
    bytes: asciiBytes('$GPRMC,123519,A,4807.038,N,01131.000,E,022.4,084.4,230394,003.1,W*6A'),
    description: 'protocol.nmea.0183.example.rmcFix.description',
    expectedValid: true,
  },
  {
    id: 'gsa-active-satellites',
    name: 'protocol.nmea.0183.example.gsaActiveSatellites.name',
    bytes: asciiBytes('$GPGSA,A,3,04,05,,09,12,,,24,,,,,2.5,1.3,2.1*39'),
    description: 'protocol.nmea.0183.example.gsaActiveSatellites.description',
    expectedValid: true,
  },
  {
    id: 'gsv-satellites-in-view',
    name: 'protocol.nmea.0183.example.gsvSatellitesInView.name',
    bytes: asciiBytes('$GPGSV,3,1,11,03,03,111,00,04,15,270,00,06,01,010,00,13,06,292,00*74'),
    description: 'protocol.nmea.0183.example.gsvSatellitesInView.description',
    expectedValid: true,
  },
  {
    id: 'vtg-course-speed',
    name: 'protocol.nmea.0183.example.vtgCourseSpeed.name',
    bytes: asciiBytes('$GPVTG,054.7,T,034.4,M,005.5,N,010.2,K*48'),
    description: 'protocol.nmea.0183.example.vtgCourseSpeed.description',
    expectedValid: true,
  },
  {
    id: 'gll-position',
    name: 'protocol.nmea.0183.example.gllPosition.name',
    bytes: asciiBytes('$GPGLL,4916.45,N,12311.12,W,225444,A*31'),
    description: 'protocol.nmea.0183.example.gllPosition.description',
    expectedValid: true,
  },
  {
    id: 'zda-time-date',
    name: 'protocol.nmea.0183.example.zdaTimeDate.name',
    bytes: asciiBytes('$GPZDA,123519,29,08,2026,00,00*40'),
    description: 'protocol.nmea.0183.example.zdaTimeDate.description',
    expectedValid: true,
  },
  {
    id: 'mwv-generic-envelope',
    name: 'protocol.nmea.0183.example.mwvGenericEnvelope.name',
    // MWV, GNSS 7'lisinin dışında: yalnız generic envelope alır (kalan 11 tipin örneği).
    bytes: asciiBytes('$WIMWV,045.0,R,10.5,N,A*16'),
    description: 'protocol.nmea.0183.example.mwvGenericEnvelope.description',
    expectedValid: true,
  },
];

export const nmea0183Plugin: ProtocolPlugin = {
  id: PROTOCOL_ID,
  name: PROTOCOL_DISPLAY_NAME,
  category: 'marine-navigation',
  parser: nmea0183Parser,
  documentation: {
    summary: 'protocol.nmea.0183.documentation.summary',
    layer: 'application',
  },
  exampleFrames: EXAMPLE_FRAMES,
};
