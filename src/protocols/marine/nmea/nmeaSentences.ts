/**
 * NMEA 0183 cümle tipi tablosu ve alan çözümü — `nmea0183.ts`'in ORTAK beyni
 * (modbusRtu.ts/modbusPdu.ts ayrımının bu dalgadaki karşılığı).
 *
 * Spec (docs/spec/ozet/05-denizcilik.md, satır 17) 18 sentence formatter sayıyor
 * ama alan kırılımını yalnız GGA için veriyor (§43 fixture'ı da yalnız GGA);
 * kalanı bilerek "seçilen NMEA revizyon veritabanından gelmeli" diyor —
 * internetteki NMEA tablolarının çoğu eski/yanlış olabildiği için. Bu yüzden
 * dalga 2 kapsamı ikiye ayrıldı (kullanıcı kararı, brief-faz9-dalga2.md):
 *
 *   - GNSS odaklı 7'li (GGA, RMC, GSA, GSV, VTG, GLL, ZDA) — spec'in kendi "GPS
 *     NMEA Mesajları" alt kümesiyle (satır 166) birebir örtüşüyor — TAM semantik
 *     alan kırılımı alır (ad, birim, dönüşüm).
 *   - Kalan 11 tip (HDT, HDG, DPT, DBT, MWV, ROT, VHW, VLW, XDR, MTW, RSA) yalnız
 *     GENERIC ENVELOPE alır: formatter tanınır ama alan adı/birim uydurulmaz,
 *     ham virgül-ayrılmış alan listesi gösterilir.
 *
 * TUZAK — OFSET TABANI: buradaki her `ParsedField.offset` TAM CÜMLEYE göredir
 * (0 = `$`), modbusPdu.ts'in PDU-gövdesi-tabanlı ofsetlerinin AKSİNE — burada
 * ayrı bir taşıma kaydırması yok, `splitPayloadTokens` zaten tam cümle
 * ofsetiyle çalışıyor ve `nmea0183.ts` bu ofsetleri değiştirmeden kullanır.
 */

import type { ParsedField } from '@/protocol-core/types';

const NUMBER_RADIX = 10;
const MINUTES_PER_DEGREE = 60;
const DDMM_MINUTES_DIVISOR = 100;
/** NMEA 0183 iki haneli yıl taşır; standardın kendisi yüzyılı belirtmez — toolkit'in kapsadığı dönemde tek anlamlı okuma budur. */
const DATE_CENTURY_BASE = 2000;
const GSA_SATELLITE_SLOT_COUNT = 12;
const GSV_SATELLITE_BLOCK_LENGTH = 4;
/** Spec'in kendi örnekleri 6 ondalık basamak kullanıyor (48.117300° / 11.516667°). */
const COORDINATE_DECIMAL_PRECISION = 6;

/**
 * Uyarı ve özet dizgeleri ÇEVİRİ ANAHTARIDIR, düz metin değil: görünen hiçbir
 * metin koda gömülmez (CLAUDE.md). Hiçbirinde yer tutucu yoktur.
 */
const WARN_INSUFFICIENT_FIELDS = 'protocol.nmea.sentence.warning.insufficientFields';
const WARN_TRAILING_FIELDS = 'protocol.nmea.sentence.warning.trailingFields';
const WARN_UNPARSEABLE_NUMBER = 'protocol.nmea.sentence.warning.unparseableNumber';
const WARN_GENERIC_FIELDS_ONLY = 'protocol.nmea.sentence.warning.genericFieldsOnly';
const WARN_UNKNOWN_SENTENCE_FORMATTER = 'protocol.nmea.sentence.warning.unknownFormatter';

const SUMMARY_GENERIC = 'protocol.nmea.sentence.summary.generic';
const SUMMARY_UNKNOWN = 'protocol.nmea.sentence.summary.unknown';

export interface NmeaSentenceInfo {
  readonly formatter: string;
  /** Protokol terimi — veridir, çevrilmez (CLAUDE.md: protokol adları sözlüğe girmez). */
  readonly name: string;
  readonly summaryKey: string;
  /** true ise alan alan semantik çözüm var (GNSS 7'li); false ise generic envelope. */
  readonly hasSemanticFields: boolean;
}

/**
 * Spec'in isimlerini saydığı 18 sentence formatter — liste birebir odur
 * (05-denizcilik.md satır 17, 10-uygulama-spec.md §23 satır 731 ile çapraz
 * doğrulandı). Yalnız GNSS odaklı 7'li (satır 166 "GPS NMEA Mesajları" alt
 * kümesi) `hasSemanticFields: true` alır.
 */
export const NMEA_SENTENCE_FORMATTERS: readonly NmeaSentenceInfo[] = [
  {
    formatter: 'GGA',
    name: 'Global Positioning System Fix Data',
    summaryKey: 'protocol.nmea.sentence.summary.gga',
    hasSemanticFields: true,
  },
  {
    formatter: 'RMC',
    name: 'Recommended Minimum Navigation Information',
    summaryKey: 'protocol.nmea.sentence.summary.rmc',
    hasSemanticFields: true,
  },
  {
    formatter: 'GSA',
    name: 'GPS DOP and Active Satellites',
    summaryKey: 'protocol.nmea.sentence.summary.gsa',
    hasSemanticFields: true,
  },
  {
    formatter: 'GSV',
    name: 'Satellites in View',
    summaryKey: 'protocol.nmea.sentence.summary.gsv',
    hasSemanticFields: true,
  },
  {
    formatter: 'VTG',
    name: 'Course Over Ground and Ground Speed',
    summaryKey: 'protocol.nmea.sentence.summary.vtg',
    hasSemanticFields: true,
  },
  {
    formatter: 'GLL',
    name: 'Geographic Position - Latitude/Longitude',
    summaryKey: 'protocol.nmea.sentence.summary.gll',
    hasSemanticFields: true,
  },
  {
    formatter: 'ZDA',
    name: 'Time and Date',
    summaryKey: 'protocol.nmea.sentence.summary.zda',
    hasSemanticFields: true,
  },
  // Aşağıdaki 11 tip spec'te yalnız İSİM olarak geçiyor — alan kırılımı yok.
  { formatter: 'HDT', name: 'Heading - True', summaryKey: SUMMARY_GENERIC, hasSemanticFields: false },
  {
    formatter: 'HDG',
    name: 'Heading - Deviation and Variation',
    summaryKey: SUMMARY_GENERIC,
    hasSemanticFields: false,
  },
  { formatter: 'DPT', name: 'Depth of Water', summaryKey: SUMMARY_GENERIC, hasSemanticFields: false },
  { formatter: 'DBT', name: 'Depth Below Transducer', summaryKey: SUMMARY_GENERIC, hasSemanticFields: false },
  { formatter: 'MWV', name: 'Wind Speed and Angle', summaryKey: SUMMARY_GENERIC, hasSemanticFields: false },
  { formatter: 'ROT', name: 'Rate of Turn', summaryKey: SUMMARY_GENERIC, hasSemanticFields: false },
  { formatter: 'VHW', name: 'Water Speed and Heading', summaryKey: SUMMARY_GENERIC, hasSemanticFields: false },
  {
    formatter: 'VLW',
    name: 'Distance Traveled through Water',
    summaryKey: SUMMARY_GENERIC,
    hasSemanticFields: false,
  },
  { formatter: 'XDR', name: 'Transducer Measurement', summaryKey: SUMMARY_GENERIC, hasSemanticFields: false },
  { formatter: 'MTW', name: 'Water Temperature', summaryKey: SUMMARY_GENERIC, hasSemanticFields: false },
  { formatter: 'RSA', name: 'Rudder Sensor Angle', summaryKey: SUMMARY_GENERIC, hasSemanticFields: false },
];

const SENTENCE_INFO_INDEX: ReadonlyMap<string, NmeaSentenceInfo> = new Map(
  NMEA_SENTENCE_FORMATTERS.map((info) => [info.formatter, info]),
);

export function getSentenceInfo(formatter: string): NmeaSentenceInfo | undefined {
  return SENTENCE_INFO_INDEX.get(formatter);
}

/** Bir virgül-ayrılmış alanın ham metni + tam cümle içindeki karakter ofseti. */
export interface RawToken {
  readonly value: string;
  readonly offset: number;
}

/**
 * `payload`i virgülle böler, her parçanın TAM CÜMLE içindeki ofsetini korur.
 * `payloadOffset` payload'ın cümledeki başlangıcıdır (`$`den sonrası, yani 1).
 *
 * NMEA yazdırılabilir ASCII olmak ZORUNDADIR (spec) — karakter indeksi byte
 * ofsetiyle birebir örtüşür, ayrı bir byte-uzunluğu hesabına gerek yoktur.
 */
export function splitPayloadTokens(payload: string, payloadOffset: number): RawToken[] {
  const tokens: RawToken[] = [];
  let start = 0;
  for (let index = 0; index <= payload.length; index += 1) {
    if (index === payload.length || payload[index] === ',') {
      tokens.push({ value: payload.slice(start, index), offset: payloadOffset + start });
      start = index + 1;
    }
  }
  return tokens;
}

function tokenAt(tokens: readonly RawToken[], index: number): RawToken | undefined {
  return tokens[index];
}

/** Boş NMEA alanı "değer yok" demektir; ekranda `undefined` (—) daha doğru gösterim. */
function rawValueOf(token: RawToken): string | undefined {
  return token.value === '' ? undefined : token.value;
}

function parseNumber(text: string): number | undefined {
  const value = Number.parseFloat(text);
  return Number.isFinite(value) ? value : undefined;
}

/** `ddmm.mmmm` / `dddmm.mmmm` → ondalık derece. South/West negatiftir (spec satır 36-39). */
function convertCoordinate(rawDegreesMinutes: string, hemisphere: string): number | undefined {
  const raw = parseNumber(rawDegreesMinutes);
  if (raw === undefined) return undefined;
  const degrees = Math.floor(raw / DDMM_MINUTES_DIVISOR);
  const minutes = raw - degrees * DDMM_MINUTES_DIVISOR;
  const decimal = degrees + minutes / MINUTES_PER_DEGREE;
  const signed = hemisphere === 'S' || hemisphere === 'W' ? -decimal : decimal;
  // /60 bölümü ikili kayan noktada temiz bitmez (48.1173 → 48.11729999999999);
  // spec'in kendi örnekleri de 6 ondalık basamakla gösteriyor (48.117300°).
  return Number(signed.toFixed(COORDINATE_DECIMAL_PRECISION));
}

function formatUtcTime(raw: string): string | undefined {
  if (raw.length < 6) return undefined;
  return `${raw.slice(0, 2)}:${raw.slice(2, 4)}:${raw.slice(4)}`;
}

function formatUtcDate(raw: string): string | undefined {
  if (raw.length !== 6) return undefined;
  const day = raw.slice(0, 2);
  const month = raw.slice(2, 4);
  const year = DATE_CENTURY_BASE + Number.parseInt(raw.slice(4, 6), NUMBER_RADIX);
  return `${String(year)}-${month}-${day}`;
}

const STATUS_LABELS: Record<string, string> = { A: 'Active', V: 'Void' };
const MODE_INDICATOR_LABELS: Record<string, string> = {
  A: 'Autonomous',
  D: 'Differential',
  E: 'Estimated',
  N: 'Not Valid',
  S: 'Simulator',
};
const FIX_QUALITY_LABELS: Record<string, string> = {
  '0': 'Invalid',
  '1': 'GPS Fix',
  '2': 'DGPS Fix',
  '3': 'PPS Fix',
  '4': 'RTK Fixed',
  '5': 'RTK Float',
  '6': 'Estimated',
  '7': 'Manual Input',
  '8': 'Simulation',
};
const SELECTION_MODE_LABELS: Record<string, string> = { M: 'Manual', A: 'Automatic' };
const FIX_TYPE_LABELS: Record<string, string> = { '1': 'No Fix', '2': '2D Fix', '3': '3D Fix' };

/** Gövde çözümünün biriktirici durumu; dışarı sızmaz (bkz. `decodeSentenceFields`). */
interface SentenceDecodeState {
  readonly fields: ParsedField[];
  readonly warnings: string[];
  readonly params: Record<string, string>;
}

function addWarning(state: SentenceDecodeState, key: string): void {
  // Aynı uyarı birden çok alandan tetiklenebilir; kullanıcıya bir kez gösterilir.
  if (!state.warnings.includes(key)) {
    state.warnings.push(key);
  }
}

function markUnparseable(state: SentenceDecodeState, field: ParsedField): void {
  field.valid = false;
  field.warnings.push(WARN_UNPARSEABLE_NUMBER);
  addWarning(state, WARN_UNPARSEABLE_NUMBER);
}

/** Tek bir CSV alanını `ParsedField`e çevirir; token yoksa (cümle kısa kaldıysa) hiçbir şey üretmez. */
function pushSimpleField(
  state: SentenceDecodeState,
  data: Uint8Array,
  token: RawToken | undefined,
  id: string,
  name: string,
): ParsedField | undefined {
  if (token === undefined) return undefined;
  const field: ParsedField = {
    id,
    name,
    offset: token.offset,
    length: token.value.length,
    rawBytes: data.slice(token.offset, token.offset + token.value.length),
    valid: true,
    warnings: [],
  };
  const raw = rawValueOf(token);
  if (raw !== undefined) {
    field.rawValue = raw;
  }
  state.fields.push(field);
  return field;
}

/** Ham sayısal değeri `physicalValue`ya taşır; boş alanda sessizce atlar (spec'in boş-alan davranışı). */
function attachNumeric(field: ParsedField | undefined, state: SentenceDecodeState, unit?: string): void {
  if (field === undefined || field.rawValue === undefined) return;
  const value = parseNumber(String(field.rawValue));
  if (value === undefined) {
    markUnparseable(state, field);
    return;
  }
  field.physicalValue = value;
  if (unit !== undefined) {
    field.unit = unit;
  }
}

interface PairedField {
  readonly field: ParsedField;
  readonly valueToken: RawToken;
  readonly letterToken: RawToken;
}

/**
 * İki CSV alanını (değer + harf: hemisphere/unit/reference) TEK semantik alana
 * sarar — spec'in "Latitude: 48.117300°" gibi tek kavram olarak sunduğu
 * değer+işaret çiftleri için (Latitude+N/S, Altitude+M, COG+T …). Bölge ofseti
 * iki token'ı da (aradaki virgül dahil) kapsar.
 */
function pushPairedField(
  state: SentenceDecodeState,
  data: Uint8Array,
  valueToken: RawToken | undefined,
  letterToken: RawToken | undefined,
  id: string,
  name: string,
): PairedField | undefined {
  if (valueToken === undefined || letterToken === undefined) return undefined;
  const start = valueToken.offset;
  const end = letterToken.offset + letterToken.value.length;
  const field: ParsedField = {
    id,
    name,
    offset: start,
    length: end - start,
    rawBytes: data.slice(start, end),
    valid: true,
    warnings: [],
  };
  const raw = rawValueOf(valueToken);
  if (raw !== undefined) {
    field.rawValue = raw;
  }
  state.fields.push(field);
  return { field, valueToken, letterToken };
}

/** `pushPairedField` çiftini sayısal `physicalValue`ya çevirir; boş değerde sessizce atlar. */
function attachPairedNumeric(
  pair: PairedField | undefined,
  state: SentenceDecodeState,
  convert: (value: string, letter: string) => number | undefined,
  unit: string,
): void {
  if (pair === undefined || pair.field.rawValue === undefined) return;
  const value = convert(pair.valueToken.value, pair.letterToken.value);
  if (value === undefined) {
    markUnparseable(state, pair.field);
    return;
  }
  pair.field.physicalValue = value;
  pair.field.unit = unit;
}

/**
 * Beklenen son alan indeksiyle gerçek alan sayısını karşılaştırır: eksikse
 * uyarır, fazlaysa artan token'ları generic alan olarak ekler (spec §47
 * "hatalı veride uygulamayı çökertme" — fazla/eksik veri gizlenmez, gösterilir).
 * GSV'de KULLANILMAZ: uydu blok sayısı zaten değişkendir, bu normal bir durumdur.
 */
function checkFieldCount(
  state: SentenceDecodeState,
  data: Uint8Array,
  tokens: readonly RawToken[],
  expectedLastIndex: number,
): void {
  const lastIndex = tokens.length - 1;
  if (lastIndex < expectedLastIndex) {
    addWarning(state, WARN_INSUFFICIENT_FIELDS);
    return;
  }
  if (lastIndex > expectedLastIndex) {
    addWarning(state, WARN_TRAILING_FIELDS);
    for (let index = expectedLastIndex + 1; index <= lastIndex; index += 1) {
      const field = pushSimpleField(state, data, tokenAt(tokens, index), `field-${String(index)}`, `Field ${String(index)}`);
      if (field !== undefined) {
        field.valid = false;
        field.warnings.push(WARN_TRAILING_FIELDS);
      }
    }
  }
}

function decodeGga(state: SentenceDecodeState, data: Uint8Array, tokens: readonly RawToken[]): void {
  const utc = pushSimpleField(state, data, tokenAt(tokens, 1), 'utc-time', 'UTC Time');
  if (utc?.rawValue !== undefined) {
    const formatted = formatUtcTime(String(utc.rawValue));
    if (formatted === undefined) markUnparseable(state, utc);
    else utc.physicalValue = formatted;
  }

  attachPairedNumeric(
    pushPairedField(state, data, tokenAt(tokens, 2), tokenAt(tokens, 3), 'latitude', 'Latitude'),
    state,
    convertCoordinate,
    '°',
  );
  attachPairedNumeric(
    pushPairedField(state, data, tokenAt(tokens, 4), tokenAt(tokens, 5), 'longitude', 'Longitude'),
    state,
    convertCoordinate,
    '°',
  );

  const fixQuality = pushSimpleField(state, data, tokenAt(tokens, 6), 'fix-quality', 'Fix Quality');
  if (fixQuality?.rawValue !== undefined) {
    const label = FIX_QUALITY_LABELS[String(fixQuality.rawValue)];
    if (label !== undefined) fixQuality.physicalValue = label;
  }

  attachNumeric(pushSimpleField(state, data, tokenAt(tokens, 7), 'satellite-count', 'Satellite Count'), state);
  attachNumeric(pushSimpleField(state, data, tokenAt(tokens, 8), 'hdop', 'HDOP'), state);
  attachPairedNumeric(
    pushPairedField(state, data, tokenAt(tokens, 9), tokenAt(tokens, 10), 'altitude', 'Altitude'),
    state,
    (value) => parseNumber(value),
    'm',
  );
  attachPairedNumeric(
    pushPairedField(state, data, tokenAt(tokens, 11), tokenAt(tokens, 12), 'geoid-separation', 'Geoid Separation'),
    state,
    (value) => parseNumber(value),
    'm',
  );
  attachNumeric(pushSimpleField(state, data, tokenAt(tokens, 13), 'dgps-age', 'DGPS Age'), state, 's');
  pushSimpleField(state, data, tokenAt(tokens, 14), 'dgps-station-id', 'DGPS Station ID');

  checkFieldCount(state, data, tokens, 14);
}

function decodeRmc(state: SentenceDecodeState, data: Uint8Array, tokens: readonly RawToken[]): void {
  const utc = pushSimpleField(state, data, tokenAt(tokens, 1), 'utc-time', 'UTC Time');
  if (utc?.rawValue !== undefined) {
    const formatted = formatUtcTime(String(utc.rawValue));
    if (formatted === undefined) markUnparseable(state, utc);
    else utc.physicalValue = formatted;
  }

  const status = pushSimpleField(state, data, tokenAt(tokens, 2), 'status', 'Status');
  if (status?.rawValue !== undefined) {
    const label = STATUS_LABELS[String(status.rawValue)];
    if (label !== undefined) status.physicalValue = label;
  }

  attachPairedNumeric(
    pushPairedField(state, data, tokenAt(tokens, 3), tokenAt(tokens, 4), 'latitude', 'Latitude'),
    state,
    convertCoordinate,
    '°',
  );
  attachPairedNumeric(
    pushPairedField(state, data, tokenAt(tokens, 5), tokenAt(tokens, 6), 'longitude', 'Longitude'),
    state,
    convertCoordinate,
    '°',
  );

  attachNumeric(
    pushSimpleField(state, data, tokenAt(tokens, 7), 'speed-over-ground', 'Speed Over Ground'),
    state,
    'kn',
  );
  attachNumeric(
    pushSimpleField(state, data, tokenAt(tokens, 8), 'course-over-ground', 'Course Over Ground'),
    state,
    '°',
  );

  const date = pushSimpleField(state, data, tokenAt(tokens, 9), 'date', 'Date');
  if (date?.rawValue !== undefined) {
    const formatted = formatUtcDate(String(date.rawValue));
    if (formatted === undefined) markUnparseable(state, date);
    else date.physicalValue = formatted;
  }

  attachPairedNumeric(
    pushPairedField(state, data, tokenAt(tokens, 10), tokenAt(tokens, 11), 'magnetic-variation', 'Magnetic Variation'),
    state,
    (value, letter) => {
      const magnitude = parseNumber(value);
      if (magnitude === undefined) return undefined;
      return letter === 'W' ? -magnitude : magnitude;
    },
    '°',
  );

  const mode = pushSimpleField(state, data, tokenAt(tokens, 12), 'mode-indicator', 'Mode Indicator');
  if (mode?.rawValue !== undefined) {
    const label = MODE_INDICATOR_LABELS[String(mode.rawValue)];
    if (label !== undefined) mode.physicalValue = label;
  }

  checkFieldCount(state, data, tokens, 12);
}

function decodeGsa(state: SentenceDecodeState, data: Uint8Array, tokens: readonly RawToken[]): void {
  const selectionMode = pushSimpleField(state, data, tokenAt(tokens, 1), 'selection-mode', 'Selection Mode');
  if (selectionMode?.rawValue !== undefined) {
    const label = SELECTION_MODE_LABELS[String(selectionMode.rawValue)];
    if (label !== undefined) selectionMode.physicalValue = label;
  }

  const fixType = pushSimpleField(state, data, tokenAt(tokens, 2), 'fix-type', 'Fix Type');
  if (fixType?.rawValue !== undefined) {
    const label = FIX_TYPE_LABELS[String(fixType.rawValue)];
    if (label !== undefined) fixType.physicalValue = label;
  }

  for (let slot = 0; slot < GSA_SATELLITE_SLOT_COUNT; slot += 1) {
    pushSimpleField(
      state,
      data,
      tokenAt(tokens, 3 + slot),
      `satellite-prn-${String(slot)}`,
      `Satellite PRN ${String(slot + 1)}`,
    );
  }

  attachNumeric(pushSimpleField(state, data, tokenAt(tokens, 15), 'pdop', 'PDOP'), state);
  attachNumeric(pushSimpleField(state, data, tokenAt(tokens, 16), 'hdop', 'HDOP'), state);
  attachNumeric(pushSimpleField(state, data, tokenAt(tokens, 17), 'vdop', 'VDOP'), state);

  checkFieldCount(state, data, tokens, 17);
}

/**
 * GSV token sayısı DEĞİŞKENDİR: mesaj başına 1-4 uydu bloğu taşınır, son
 * mesajda daha az olabilir. `checkFieldCount` bilerek KULLANILMAZ — eksik/fazla
 * kavramı burada anlamsız, uydu sayısı zaten üçüncü alanda ayrıca bildiriliyor.
 */
function decodeGsv(state: SentenceDecodeState, data: Uint8Array, tokens: readonly RawToken[]): void {
  attachNumeric(pushSimpleField(state, data, tokenAt(tokens, 1), 'total-messages', 'Total Messages'), state);
  attachNumeric(pushSimpleField(state, data, tokenAt(tokens, 2), 'message-number', 'Message Number'), state);
  attachNumeric(
    pushSimpleField(state, data, tokenAt(tokens, 3), 'satellites-in-view', 'Satellites in View'),
    state,
  );

  const lastIndex = tokens.length - 1;
  let slot = 0;
  let index = 4;
  while (index <= lastIndex) {
    const slotLabel = String(slot + 1);
    attachNumeric(
      pushSimpleField(state, data, tokenAt(tokens, index), `satellite-${String(slot)}-prn`, `Satellite ${slotLabel} PRN`),
      state,
    );
    attachNumeric(
      pushSimpleField(
        state,
        data,
        tokenAt(tokens, index + 1),
        `satellite-${String(slot)}-elevation`,
        `Satellite ${slotLabel} Elevation`,
      ),
      state,
      '°',
    );
    attachNumeric(
      pushSimpleField(
        state,
        data,
        tokenAt(tokens, index + 2),
        `satellite-${String(slot)}-azimuth`,
        `Satellite ${slotLabel} Azimuth`,
      ),
      state,
      '°',
    );
    attachNumeric(
      pushSimpleField(state, data, tokenAt(tokens, index + 3), `satellite-${String(slot)}-snr`, `Satellite ${slotLabel} SNR`),
      state,
      'dB',
    );
    index += GSV_SATELLITE_BLOCK_LENGTH;
    slot += 1;
  }
}

function decodeVtg(state: SentenceDecodeState, data: Uint8Array, tokens: readonly RawToken[]): void {
  attachPairedNumeric(
    pushPairedField(state, data, tokenAt(tokens, 1), tokenAt(tokens, 2), 'course-true', 'Course Over Ground (True)'),
    state,
    (value) => parseNumber(value),
    '°',
  );
  attachPairedNumeric(
    pushPairedField(state, data, tokenAt(tokens, 3), tokenAt(tokens, 4), 'course-magnetic', 'Course Over Ground (Magnetic)'),
    state,
    (value) => parseNumber(value),
    '°',
  );
  attachPairedNumeric(
    pushPairedField(state, data, tokenAt(tokens, 5), tokenAt(tokens, 6), 'speed-knots', 'Speed Over Ground (Knots)'),
    state,
    (value) => parseNumber(value),
    'kn',
  );
  attachPairedNumeric(
    pushPairedField(state, data, tokenAt(tokens, 7), tokenAt(tokens, 8), 'speed-kmh', 'Speed Over Ground (km/h)'),
    state,
    (value) => parseNumber(value),
    'km/h',
  );

  const mode = pushSimpleField(state, data, tokenAt(tokens, 9), 'mode-indicator', 'Mode Indicator');
  if (mode?.rawValue !== undefined) {
    const label = MODE_INDICATOR_LABELS[String(mode.rawValue)];
    if (label !== undefined) mode.physicalValue = label;
  }

  checkFieldCount(state, data, tokens, 9);
}

function decodeGll(state: SentenceDecodeState, data: Uint8Array, tokens: readonly RawToken[]): void {
  attachPairedNumeric(
    pushPairedField(state, data, tokenAt(tokens, 1), tokenAt(tokens, 2), 'latitude', 'Latitude'),
    state,
    convertCoordinate,
    '°',
  );
  attachPairedNumeric(
    pushPairedField(state, data, tokenAt(tokens, 3), tokenAt(tokens, 4), 'longitude', 'Longitude'),
    state,
    convertCoordinate,
    '°',
  );

  const utc = pushSimpleField(state, data, tokenAt(tokens, 5), 'utc-time', 'UTC Time');
  if (utc?.rawValue !== undefined) {
    const formatted = formatUtcTime(String(utc.rawValue));
    if (formatted === undefined) markUnparseable(state, utc);
    else utc.physicalValue = formatted;
  }

  const status = pushSimpleField(state, data, tokenAt(tokens, 6), 'status', 'Status');
  if (status?.rawValue !== undefined) {
    const label = STATUS_LABELS[String(status.rawValue)];
    if (label !== undefined) status.physicalValue = label;
  }

  const mode = pushSimpleField(state, data, tokenAt(tokens, 7), 'mode-indicator', 'Mode Indicator');
  if (mode?.rawValue !== undefined) {
    const label = MODE_INDICATOR_LABELS[String(mode.rawValue)];
    if (label !== undefined) mode.physicalValue = label;
  }

  checkFieldCount(state, data, tokens, 7);
}

function decodeZda(state: SentenceDecodeState, data: Uint8Array, tokens: readonly RawToken[]): void {
  const utc = pushSimpleField(state, data, tokenAt(tokens, 1), 'utc-time', 'UTC Time');
  if (utc?.rawValue !== undefined) {
    const formatted = formatUtcTime(String(utc.rawValue));
    if (formatted === undefined) markUnparseable(state, utc);
    else utc.physicalValue = formatted;
  }

  attachNumeric(pushSimpleField(state, data, tokenAt(tokens, 2), 'day', 'Day'), state);
  attachNumeric(pushSimpleField(state, data, tokenAt(tokens, 3), 'month', 'Month'), state);
  attachNumeric(pushSimpleField(state, data, tokenAt(tokens, 4), 'year', 'Year'), state);
  attachNumeric(pushSimpleField(state, data, tokenAt(tokens, 5), 'local-zone-hours', 'Local Zone Hours'), state);
  attachNumeric(pushSimpleField(state, data, tokenAt(tokens, 6), 'local-zone-minutes', 'Local Zone Minutes'), state);

  checkFieldCount(state, data, tokens, 6);
}

/** Generic envelope: her CSV alanı kendi ham metniyle basılır, semantik ad/birim uydurulmaz. */
function decodeGeneric(state: SentenceDecodeState, data: Uint8Array, tokens: readonly RawToken[]): void {
  for (let index = 1; index < tokens.length; index += 1) {
    pushSimpleField(state, data, tokenAt(tokens, index), `field-${String(index)}`, `Field ${String(index)}`);
  }
}

export interface SentenceDecodeResult {
  readonly fields: readonly ParsedField[];
  readonly warnings: readonly string[];
  readonly summaryKey: string;
  readonly summaryParams: Record<string, string>;
}

/**
 * `formatter`e (GGA, RMC, …) göre veri alanlarını (`tokens[0]` = talker+formatter
 * hariç) çözer. Bilinmeyen formatter HATA DEĞİLDİR: generic envelope ile kısmi
 * çözüm döner (spec §47 "hatalı veride uygulamayı çökertme").
 */
export function decodeSentenceFields(
  formatter: string,
  data: Uint8Array,
  tokens: readonly RawToken[],
): SentenceDecodeResult {
  const state: SentenceDecodeState = { fields: [], warnings: [], params: { formatter } };
  const info = getSentenceInfo(formatter);

  if (info === undefined) {
    addWarning(state, WARN_UNKNOWN_SENTENCE_FORMATTER);
    decodeGeneric(state, data, tokens);
    return {
      fields: state.fields,
      warnings: state.warnings,
      summaryKey: SUMMARY_UNKNOWN,
      summaryParams: state.params,
    };
  }

  if (!info.hasSemanticFields) {
    addWarning(state, WARN_GENERIC_FIELDS_ONLY);
    decodeGeneric(state, data, tokens);
    return {
      fields: state.fields,
      warnings: state.warnings,
      summaryKey: info.summaryKey,
      summaryParams: state.params,
    };
  }

  switch (formatter) {
    case 'GGA':
      decodeGga(state, data, tokens);
      break;
    case 'RMC':
      decodeRmc(state, data, tokens);
      break;
    case 'GSA':
      decodeGsa(state, data, tokens);
      break;
    case 'GSV':
      decodeGsv(state, data, tokens);
      break;
    case 'VTG':
      decodeVtg(state, data, tokens);
      break;
    case 'GLL':
      decodeGll(state, data, tokens);
      break;
    case 'ZDA':
      decodeZda(state, data, tokens);
      break;
    default:
      decodeGeneric(state, data, tokens);
      break;
  }

  return {
    fields: state.fields,
    warnings: state.warnings,
    summaryKey: info.summaryKey,
    summaryParams: state.params,
  };
}
