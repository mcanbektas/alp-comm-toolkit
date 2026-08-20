/**
 * GNSS-üzerinden-AT yorumlama katmanı — `lte-modem-at` VE `nmea-0183`nin
 * ÜSTÜNDE oturur (brief dalga 9, karar 5 — 9d'nin `nb-iot` için kurduğu
 * "üstteki motoru içeriden çağır" şablonunun bu kez İKİ motora bağımlı
 * hâli). Quectel'in tümleşik hücresel+GNSS modülleri (EC25/EG25-G/BG96)
 * `AT+QGPSLOC` (önceden-ayrıştırılmış konum) VE `AT+QGPSGNMEA` (yanıtın
 * İÇİNE gömülü HAM NMEA cümlesi) ikisini birden veriyor.
 *
 * ── `AT+QGPSGNMEA` → `nmea-0183`YE DEVİR, MOTOR TEKRAR YAZILMAZ ─────────
 * `+QGPSGNMEA: $GPGGA,...,*77` satırının `parameters` alanı TAM BİR NMEA
 * cümlesidir (Quectel EC25&EC21 GNSS AT Commands Manual V1.1, §3.2'nin
 * kendi örneği). Bu metin `splitParameterTokens`le VİRGÜLE BÖLÜNMEZ —
 * cümlenin kendi virgülleri AT parametre ayracı sanılırdı, ilk token'dan
 * sonrasını sessizce keserdi. Bunun yerine `parameters` alanının HAM
 * BAYTLARI (`rawBytes`, zaten doğru ofsette) doğrudan `nmea0183Parser`e
 * verilir. `nmea0183Parser`in ürettiği alanlar KENDİ tamponuna (yalnız
 * cümle baytları) göre 0-tabanlıdır — bu yüzden `rebaseField` her alanı
 * `parameters` alanının ORİJİNAL `data` içindeki ofsetine göre kaydırır
 * (`tokenField`in `paramsOffset + token.offset` deseninin AYNISI, yalnız
 * burada kaydırılan token değil BAŞKA BİR PARSER'IN tüm çıktısı). Bozuk
 * checksum gibi iç motorun kendi teşhisi de (uyarı/hata) AYNEN taşınır —
 * motor tekrar yazılmadığı gibi, motorun teşhisi de tekrar üretilmez.
 *
 * ── `AT+QGPSLOC` — DAR bir alan kümesiyle çözülür (brief madde 12) ──────
 * `+QGPSLOC: <UTC>,<latitude>,<longitude>,<hdop>,<altitude>,<fix>,<cog>,
 * <spkm>,<spkn>,<date>,<nsat>` (Quectel EC25&EC21 GNSS AT Commands Manual
 * V1.1, §3.1 — doğrudan PDF'ten doğrulandı). Brief'in kendi kapsam sınırı
 * yalnız ALTI alanı istiyor: fix/lat/lon/alt/sat/hdop — `UTC`/`cog`/`spkm`/
 * `spkn`/`date` BİLEREK çözülmez (CGDCONT'un "ilk altı sabit alan, gerisi
 * ham" disipliniyle aynı sınıf karar, burada gerisi hiç EMİLMEZ).
 *
 * `<latitude>`/`<longitude>` TEK tokende hemisfer harfi taşır
 * (`3150.7223N`) — NMEA'nin kendi `lat,N` iki-tokenli biçiminden FARKLI.
 * `AT+QGPSLOC=<mode>` biçimi de değiştirir (0/1: harf sonekli ddmm.mmmm,
 * 2: `(-)dd.ddddd` zaten ondalık derece) — ama parser SAF kalmak zorunda
 * (karar 4), hangi `<mode>`in gönderildiğini BİLEMEZ. Çözüm: biçim TOKENİN
 * KENDİSİNDEN anlaşılır (harf sonekli mi, değil mi) — dışarıdan durum
 * gerekmez. ddmm.mmmm→ondalık formülü (`floor(/100)` + `%100/60`, 6 ondalık
 * basamağa yuvarlama) `nmeaSentences.ts`teki `convertCoordinate`in AYNISI
 * (48.1173/11.516666... fixture'ıyla çapraz doğrulandı) — o fonksiyon
 * export edilmediği için (lte-modem-at'in kendi tablolarını yerel tutması
 * emsali) burada yerel bir kopya var, İTHAL EDİLEMEZ.
 *
 * Kaynak: Quectel EC25&EC21 GNSS AT Commands Manual V1.1 (2017-02-13),
 * §3.1 (`AT+QGPSLOC`) ve §3.2 (`AT+QGPSGNMEA`, `<nmeasrc>` örneği dahil).
 */

import type {
  ExampleFrame,
  ParseContext,
  ParseResult,
  ParsedField,
  ParsedFrame,
  ProtocolError,
  ProtocolParser,
  ProtocolPlugin,
  ProtocolWarning,
} from '@/protocol-core/types';
import { lteModemAtParser } from './lteModemAt';
import { nmea0183Parser } from '../../marine/nmea/nmea0183';

const PROTOCOL_ID = 'gnss-modem';
/** Protokol adı veridir, çeviriye girmez (CLAUDE.md). */
const PROTOCOL_DISPLAY_NAME = 'GNSS Modem';

const TRANSLATION_KEY_PREFIX = 'protocol.gnssModem';

const WARN_GNSS_FIX_TYPE_UNRECOGNIZED = `${TRANSLATION_KEY_PREFIX}.warning.fixTypeUnrecognized`;
const WARN_QGPSLOC_COORDINATE_UNRECOGNIZED = `${TRANSLATION_KEY_PREFIX}.warning.qgpslocCoordinateUnrecognized`;
const WARN_EMBEDDED_NMEA_UNPARSEABLE = `${TRANSLATION_KEY_PREFIX}.warning.embeddedNmeaUnparseable`;

function toProtocolWarning(code: string): ProtocolWarning {
  return { code, message: code };
}

// ── Ortak yardımcılar (lteModemAt.ts'in yerel kopyasıyla AYNI — 9c/9d emsali) ──

interface ParamToken {
  /** Tırnaklıysa tırnaklar DAHİL ham metin. */
  value: string;
  /** `parameters` alanının BAŞINA göre ofset (mutlak değil). */
  offset: number;
}

function splitParameterTokens(params: string): ParamToken[] {
  const tokens: ParamToken[] = [];
  let tokenStart = 0;
  let inQuotes = false;
  for (let i = 0; i < params.length; i += 1) {
    if (params[i] === '"') inQuotes = !inQuotes;
    if (params[i] === ',' && !inQuotes) {
      tokens.push({ value: params.slice(tokenStart, i), offset: tokenStart });
      tokenStart = i + 1;
    }
  }
  tokens.push({ value: params.slice(tokenStart), offset: tokenStart });
  return tokens;
}

function tokenField(
  data: Uint8Array,
  paramsOffset: number,
  token: ParamToken,
  id: string,
  name: string,
  rawValue: number | string,
  extra?: { physicalValue?: number | string; unit?: string; warnings?: string[] },
): ParsedField {
  const offset = paramsOffset + token.offset;
  const length = token.value.length;
  return {
    id,
    name,
    offset,
    length,
    rawBytes: data.slice(offset, offset + length),
    rawValue,
    ...(extra?.physicalValue === undefined ? {} : { physicalValue: extra.physicalValue }),
    ...(extra?.unit === undefined ? {} : { unit: extra.unit }),
    valid: true,
    warnings: extra?.warnings ?? [],
  };
}

/** Başka bir parser'ın (`nmea0183Parser`) kendi tamponuna göre 0-tabanlı
 *  ürettiği bir alanı, DIŞ `data` tamponundaki gerçek konumuna kaydırır. */
function rebaseField(field: ParsedField, data: Uint8Array, baseOffset: number): ParsedField {
  const offset = baseOffset + field.offset;
  return { ...field, offset, rawBytes: data.slice(offset, offset + field.length) };
}

// ── AT+QGPSLOC — Acquire Positioning Information (dar alan kümesi) ──────

const GNSS_FIX_TYPE_NAMES: Readonly<Record<number, string>> = {
  2: '2D fix',
  3: '3D fix',
};

/** `nnn.nnnn` + hemisfer harfi TEK tokende (`<mode>=0/1`) ya da zaten
 *  imzalı ondalık derece (`<mode>=2`) — biçim tokenin kendisinden anlaşılır. */
const DDMM_HEMISPHERE_PATTERN = /^(\d+(?:\.\d+)?)([NSEW])$/;
const SIGNED_DECIMAL_PATTERN = /^-?\d+(?:\.\d+)?$/;
/** `nmeaSentences.ts`teki `convertCoordinate` ile AYNI sabitler/formül. */
const DDMM_MINUTES_DIVISOR = 100;
const MINUTES_PER_DEGREE = 60;
const COORDINATE_DECIMAL_PRECISION = 6;

function convertQgpslocCoordinate(raw: string): number | undefined {
  const ddmmMatch = DDMM_HEMISPHERE_PATTERN.exec(raw);
  if (ddmmMatch !== null) {
    const digits = ddmmMatch[1];
    const hemisphere = ddmmMatch[2];
    const value = digits === undefined ? NaN : Number(digits);
    if (!Number.isFinite(value)) return undefined;
    const degrees = Math.floor(value / DDMM_MINUTES_DIVISOR);
    const minutes = value - degrees * DDMM_MINUTES_DIVISOR;
    const decimal = degrees + minutes / MINUTES_PER_DEGREE;
    const signed = hemisphere === 'S' || hemisphere === 'W' ? -decimal : decimal;
    return Number(signed.toFixed(COORDINATE_DECIMAL_PRECISION));
  }
  if (SIGNED_DECIMAL_PATTERN.test(raw)) {
    // AT+QGPSLOC=2: zaten (-)dd.ddddd ondalık derece — dönüşüm gerekmez.
    return Number(Number(raw).toFixed(COORDINATE_DECIMAL_PRECISION));
  }
  return undefined;
}

function decodeQgpsLoc(tokens: ParamToken[], data: Uint8Array, paramsOffset: number): ParsedField[] {
  const fields: ParsedField[] = [];

  // tokens[0]=<UTC>: brief'in "dar" kapsamının DIŞINDA, bilerek çözülmez.

  const latToken = tokens[1];
  if (latToken !== undefined) {
    const raw = latToken.value.trim();
    const decimal = convertQgpslocCoordinate(raw);
    fields.push(
      tokenField(data, paramsOffset, latToken, 'latitude', 'Latitude', raw, {
        ...(decimal === undefined
          ? { warnings: [WARN_QGPSLOC_COORDINATE_UNRECOGNIZED] }
          : { physicalValue: decimal, unit: '°' }),
      }),
    );
  }

  const lonToken = tokens[2];
  if (lonToken !== undefined) {
    const raw = lonToken.value.trim();
    const decimal = convertQgpslocCoordinate(raw);
    fields.push(
      tokenField(data, paramsOffset, lonToken, 'longitude', 'Longitude', raw, {
        ...(decimal === undefined
          ? { warnings: [WARN_QGPSLOC_COORDINATE_UNRECOGNIZED] }
          : { physicalValue: decimal, unit: '°' }),
      }),
    );
  }

  const hdopToken = tokens[3];
  if (hdopToken !== undefined) {
    const hdop = Number(hdopToken.value.trim());
    fields.push(
      tokenField(data, paramsOffset, hdopToken, 'hdop', 'HDOP', hdop, {
        ...(Number.isFinite(hdop) ? { physicalValue: hdop } : {}),
      }),
    );
  }

  const altitudeToken = tokens[4];
  if (altitudeToken !== undefined) {
    const altitude = Number(altitudeToken.value.trim());
    fields.push(
      tokenField(data, paramsOffset, altitudeToken, 'altitude', 'Altitude', altitude, {
        ...(Number.isFinite(altitude) ? { physicalValue: altitude, unit: 'm' } : {}),
      }),
    );
  }

  const fixToken = tokens[5];
  if (fixToken !== undefined) {
    const fix = Number(fixToken.value.trim());
    fields.push(
      tokenField(data, paramsOffset, fixToken, 'gnss-fix-type', 'GNSS konumlama modu', fix, {
        ...(GNSS_FIX_TYPE_NAMES[fix] === undefined
          ? { warnings: [WARN_GNSS_FIX_TYPE_UNRECOGNIZED] }
          : { physicalValue: GNSS_FIX_TYPE_NAMES[fix] }),
      }),
    );
  }

  // tokens[6..9] = <cog>/<spkm>/<spkn>/<date>: "dar" kapsamının DIŞINDA.

  const nsatToken = tokens[10];
  if (nsatToken !== undefined) {
    const nsat = Number(nsatToken.value.trim());
    fields.push(
      tokenField(data, paramsOffset, nsatToken, 'satellite-count', 'Uydu sayısı', nsat, {
        ...(Number.isFinite(nsat) ? { physicalValue: nsat } : {}),
      }),
    );
  }

  return fields;
}

// ── AT+QGPSGNMEA — gömülü NMEA cümlesini nmea-0183'e devret ─────────────

interface EmbeddedNmeaResult {
  fields: ParsedField[];
  warnings: ProtocolWarning[];
  errors: ProtocolError[];
  valid: boolean;
}

function decodeEmbeddedNmeaSentence(data: Uint8Array, parametersField: ParsedField): EmbeddedNmeaResult {
  const inner = nmea0183Parser.parse(parametersField.rawBytes);
  if (!inner.success) {
    // Gömülü metin bir NMEA cümlesi olarak hiç ÇÖZÜLEMEDİ — bu, checksum
    // uyuşmazlığından daha ciddi bir durum (alan bile üretilemedi), dış
    // çerçeve de geçersiz sayılır (spec §47: kısmi çözüm gösterilir, ama
    // "geçerli" denmez).
    return { fields: [], warnings: [toProtocolWarning(WARN_EMBEDDED_NMEA_UNPARSEABLE)], errors: [], valid: false };
  }
  return {
    fields: inner.frame.fields.map((field) => rebaseField(field, data, parametersField.offset)),
    warnings: inner.frame.warnings,
    errors: inner.frame.errors,
    valid: inner.frame.valid,
  };
}

// ── Dispatch ──────────────────────────────────────────────────────────

function enrichFrame(frame: ParsedFrame, data: Uint8Array): ParsedFrame {
  const extraFields: ParsedField[] = [];
  const extraFrameWarnings: ProtocolWarning[] = [];
  const extraFrameErrors: ProtocolError[] = [];
  let frameValid = frame.valid;

  const kind = frame.fields.find((field) => field.id === 'kind')?.rawValue;
  if (kind === 'information') {
    const prefixValue = frame.fields.find((field) => field.id === 'prefix')?.rawValue;
    const parametersField = frame.fields.find((field) => field.id === 'parameters');
    const commandName = typeof prefixValue === 'string' && prefixValue.startsWith('+') ? prefixValue.slice(1).toUpperCase() : undefined;

    if (commandName === 'QGPSLOC') {
      const paramsText = typeof parametersField?.rawValue === 'string' ? parametersField.rawValue : '';
      const paramsOffset = parametersField?.offset ?? 0;
      extraFields.push(...decodeQgpsLoc(splitParameterTokens(paramsText), data, paramsOffset));
    } else if (commandName === 'QGPSGNMEA' && parametersField !== undefined) {
      const embedded = decodeEmbeddedNmeaSentence(data, parametersField);
      extraFields.push(...embedded.fields);
      extraFrameWarnings.push(...embedded.warnings);
      extraFrameErrors.push(...embedded.errors);
      if (!embedded.valid) frameValid = false;
    }
  }

  if (extraFields.length === 0 && extraFrameWarnings.length === 0 && extraFrameErrors.length === 0) {
    return { ...frame, protocol: PROTOCOL_ID };
  }

  const derivedFieldWarnings = extraFields.flatMap((field) => field.warnings.map(toProtocolWarning));
  return {
    ...frame,
    protocol: PROTOCOL_ID,
    fields: [...frame.fields, ...extraFields],
    valid: frameValid,
    errors: [...frame.errors, ...extraFrameErrors],
    warnings: [...frame.warnings, ...derivedFieldWarnings, ...extraFrameWarnings],
  };
}

export const gnssModemParser: ProtocolParser = {
  protocolId: PROTOCOL_ID,
  displayName: PROTOCOL_DISPLAY_NAME,

  canParse(data: Uint8Array): boolean {
    return lteModemAtParser.canParse(data);
  },

  parse(data: Uint8Array, context?: ParseContext): ParseResult {
    const base = lteModemAtParser.parse(data, context);
    if (!base.success) return base;
    return { ...base, frame: enrichFrame(base.frame, data) };
  },
};

// ── Örnekler ───────────────────────────────────────────────────────────

function asciiBytes(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

const EXAMPLE_FRAMES: ExampleFrame[] = [
  {
    id: 'qgpsloc-2d-fix',
    // Quectel EC25&EC21 GNSS AT Commands Manual V1.1'in kendi §3.1 örneği.
    name: `${TRANSLATION_KEY_PREFIX}.example.qgpslocTwoDFix.name`,
    bytes: asciiBytes('+QGPSLOC: 061951.0,3150.7223N,11711.9293E,0.7,62.2,2,0.0,0.0,0.0,110513,09\r\n'),
    description: `${TRANSLATION_KEY_PREFIX}.example.qgpslocTwoDFix.description`,
    expectedValid: true,
  },
  {
    id: 'qgpsloc-unrecognized-fix',
    name: `${TRANSLATION_KEY_PREFIX}.example.qgpslocUnrecognizedFix.name`,
    // Aynı fixture, <fix>=1 — Quectel'in kendi tablosu yalnız 2/3 tanımlıyor.
    bytes: asciiBytes('+QGPSLOC: 061951.0,3150.7223N,11711.9293E,0.7,62.2,1,0.0,0.0,0.0,110513,09\r\n'),
    description: `${TRANSLATION_KEY_PREFIX}.example.qgpslocUnrecognizedFix.description`,
    expectedValid: true,
  },
  {
    id: 'qgpsgnmea-gga',
    // Quectel'in kendi §3.2 <nmeasrc> örneği.
    name: `${TRANSLATION_KEY_PREFIX}.example.qgpsgnmeaGga.name`,
    bytes: asciiBytes('+QGPSGNMEA: $GPGGA,103647.0,3150.721154,N,11711.925873,E,1,02,4.7,59.8,M,-2.0,M,,*77\r\n'),
    description: `${TRANSLATION_KEY_PREFIX}.example.qgpsgnmeaGga.description`,
    expectedValid: true,
  },
  {
    id: 'qgpsgnmea-rmc',
    // nmea-0183'ün KENDİ doğrulanmış RMC fixture'ı — motor tekrar
    // yazılmadığının kanıtı, checksum burada YENİDEN hesaplanmadı.
    name: `${TRANSLATION_KEY_PREFIX}.example.qgpsgnmeaRmc.name`,
    bytes: asciiBytes('+QGPSGNMEA: $GPRMC,123519,A,4807.038,N,01131.000,E,022.4,084.4,230394,003.1,W*6A\r\n'),
    description: `${TRANSLATION_KEY_PREFIX}.example.qgpsgnmeaRmc.description`,
    expectedValid: true,
  },
  {
    id: 'qgpsgnmea-malformed',
    name: `${TRANSLATION_KEY_PREFIX}.example.qgpsgnmeaMalformed.name`,
    bytes: asciiBytes('+QGPSGNMEA: NOT-AN-NMEA-SENTENCE\r\n'),
    description: `${TRANSLATION_KEY_PREFIX}.example.qgpsgnmeaMalformed.description`,
    // Gömülü metin NMEA cümlesi olarak çözülemedi — dış çerçeve BİLEREK
    // geçersiz sayılır (bkz. dosya başı, decodeEmbeddedNmeaSentence).
    expectedValid: false,
  },
  {
    id: 'final-ok',
    name: `${TRANSLATION_KEY_PREFIX}.example.finalOk.name`,
    bytes: asciiBytes('OK\r\n'),
    description: `${TRANSLATION_KEY_PREFIX}.example.finalOk.description`,
    expectedValid: true,
  },
];

export const gnssModemPlugin: ProtocolPlugin = {
  id: PROTOCOL_ID,
  name: PROTOCOL_DISPLAY_NAME,
  category: 'wireless-iot',
  parser: gnssModemParser,
  documentation: {
    summary: `${TRANSLATION_KEY_PREFIX}.documentation.summary`,
    layer: 'application',
    references: [
      {
        title: 'Quectel EC25&EC21 GNSS AT Commands Manual V1.1',
        url: 'https://sixfab.com/wp-content/uploads/2018/09/Quectel_EC25EC21_GNSS_AT_Commands_Manual_V1.1.pdf',
      },
    ],
  },
  exampleFrames: EXAMPLE_FRAMES,
};
