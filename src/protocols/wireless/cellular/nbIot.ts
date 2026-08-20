/**
 * NB-IoT'ye özgü yorumlama katmanı — `lte-modem-at`in (Faz 10 dalga 9c) ÜSTÜNDE
 * oturur (brief dalga 9, karar 5). Brif madde 11'in kapsadığı iki şey:
 *
 * ── AcT=9 TESPİTİ ─────────────────────────────────────────────────────────
 * CREG/CEREG/COPS'un ortak `access-technology` alanı (zaten `lte-modem-at`
 * tarafından çözülü) AcT=9 ("E-UTRAN (NB-S1 mode)") olup olmadığına göre
 * yorumlanır — ayrıca sayı üretilmez, VAR OLAN alan üstüne bir eşleşme
 * etiketi eklenir (bkz. `decodeNbIotAccessTechnologyMatch`).
 *
 * ── PSM/eDRX ZAMANLAYICI ÇIKARIMI ────────────────────────────────────────
 * `lte-modem-at`in madde 8 komut kümesinde `AT+CPSMS`/`AT+CEDRXS`/
 * `AT+CEDRXRDP`/`+CEDRXP` YOKTU — burada eklendi. TS 27.007'nin kendi metni
 * (ETSI TS 127 007 V18.7.0, doğrudan doğrulandı) T3324 (Active-Time) ve
 * T3412-extended (Periodic-TAU) için AYRI iki IE tablosu tanımlıyor — brief'in
 * "GPRS Timer 2/3, §10.5.7.4a" özeti İKİSİNİ TEK CLAUSE'A bağlıyor, bu
 * YANLIŞ: T3324 → GPRS Timer 2 (TS 24.008 Table 10.5.163), T3412-ext →
 * GPRS Timer 3 (Table 10.5.163a). İki tablo da FARKLI (Timer 2'de yalnız
 * dört birim tanımlı: 2sn/1dk/decihour/deactivated; Timer 3'te yedi: 10dk/
 * 1sa/10sa/2sn/30sn/1dk/320sa/deactivated) — karıştırmak sessiz-yanlış
 * saniye üretir (Quectel BG96/BC66 + SIMCom SIM7022 + ETSI TS 127.007
 * v18.7.0 çapraz doğrulandı, BG96'nın kendi örneği `"00000100"`→40dk (T3412)
 * ve `"00001111"`→30sn (T3324) İKİ tabloyu da bağımsız doğruluyor — fixture
 * olarak aynen kullanıldı). eDRX döngü tablosu (TS 24.008 Table 10.5.5.32)
 * yalnız NB-S1 modu (`AcT_type=5`) için doğrulandı (Quectel BC26/u-blox
 * SARA-N2/N3 çapraz teyitli) — WB-S1 (`AcT_type=4`, LTE-M) FARKLI bir tablo
 * kullanır ve bu motorda YOK, karıştırılmasın diye ayrı uyarı taşır. Paging
 * Time Window bağımsız doğrulanmadı — CREG/CEREG `reject_cause` disipliniyle
 * aynı: yapı (ham dize) taşınır, saniyeye ÇEVRİLMEZ.
 *
 * ── BİLEŞİM, KOPYALAMA DEĞİL — İKİ KATMAN DERİN ──────────────────────────
 * `nbIotParser.parse()` `atCommandsParser`i DEĞİL, `lteModemAtParser`i çağırır
 * (karar 5: "lte-modem-at'in ayrıştırıcısını içeriden çağırır") — bu yüzden
 * CSQ/COPS/CREG/CEREG/CGATT/CGDCONT/CPIN/CGSN/CCLK zaten çözülü gelir,
 * burada YENİDEN YAZILMAZ. `ParamToken`/`splitParameterTokens`/`unquote`/
 * `tokenField` bu dosyada YİNE tanımlı — `lteModemAt.ts`nin kendisi de
 * `atCommands.ts`teki eşdeğerlerini import ETMİYOR, aynı yerel-kopya emsali
 * (9c zaten bu deseni kurdu, burada bozulmadı).
 *
 * ── `decode` SEKMESİ AÇILDI — BİLİNÇLİ, KARAR 5'İN DOĞAL SONUCU ──────────
 * Katalogdaki `nb-iot` kaydının `tabs`'ında `decode` YOKTU (yalnız
 * `overview/timing/data/diagnostics/examples`). Bu motor tam olarak bir
 * decode-zamanı zenginleştirmesi olduğu için `decode` eklenmeden `ready` +
 * `pluginId` demek 9a'nın "ready sayfada yalan olmasın" dersini çiğnerdi —
 * `ProtocolPage.tsx`in `pluginId`i yalnız `decode` sekmesinde okuduğu
 * doğrulandı. `live`/`build` EKLENMEDİ (yeni bir canlı bağlantı ya da komut
 * gönderme yeteneği yok). Katalogun vaat ettiği STATEFUL panolar (Connection
 * State Machine, Registration Analyzer, Power Save Analyzer, Socket/Connection
 * Timeline) bu dalgada YOK — `lte-modem-at`in Cellular Initialization
 * Dashboard'uyla AYNI SINIF iş (karar 4: parser saf kalır, biriktirme UI
 * katmanında), kendi turunu hak ediyor; `timing`/`data`/`diagnostics`
 * sekmeleri hâlâ `tools` metin listesiyle "planlandı" gösterir.
 *
 * Kaynaklar: ETSI TS 127 007 V18.7.0 (+CPSMS/+CEDRXS/+CEDRXRDP tanımları,
 * doğrudan PDF), 3GPP TS 24.008 (GPRS Timer/Timer 2/Timer 3/eDRX IE
 * tabloları — Quectel BG96 V2.3 + BC66 V1.0 + SIMCom SIM7022 V1.05 AT
 * Commands Manual + u-blox SARA-N2/N3 (UBX-16014887) çapraz doğrulama).
 */

import type {
  ExampleFrame,
  ParseContext,
  ParseResult,
  ParsedField,
  ParsedFrame,
  ProtocolParser,
  ProtocolPlugin,
  ProtocolWarning,
} from '@/protocol-core/types';
import { lteModemAtParser } from './lteModemAt';

const PROTOCOL_ID = 'nb-iot';
/** Protokol adı veridir, çeviriye girmez (CLAUDE.md). */
const PROTOCOL_DISPLAY_NAME = 'NB-IoT';

const TRANSLATION_KEY_PREFIX = 'protocol.nbIot';

const WARN_ACCESS_TECHNOLOGY_NOT_NB_IOT = `${TRANSLATION_KEY_PREFIX}.warning.accessTechnologyNotNbIot`;
const WARN_TIMER_MALFORMED = `${TRANSLATION_KEY_PREFIX}.warning.timerMalformed`;
const WARN_TIMER_UNIT_RESERVED = `${TRANSLATION_KEY_PREFIX}.warning.timerUnitReserved`;
const WARN_EDRX_MALFORMED = `${TRANSLATION_KEY_PREFIX}.warning.edrxMalformed`;
const WARN_EDRX_CODE_RESERVED = `${TRANSLATION_KEY_PREFIX}.warning.edrxCodeReserved`;
const WARN_EDRX_NOT_NB_S1 = `${TRANSLATION_KEY_PREFIX}.warning.edrxNotNbS1`;

function toProtocolWarning(code: string): ProtocolWarning {
  return { code, message: code };
}

// ── Ortak yardımcılar (lteModemAt.ts'in yerel kopyasıyla AYNI — 9c emsali) ──

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

function unquote(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.length >= 2 && trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
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

// ── AcT=9 tespiti — `lte-modem-at`in ZATEN çözdüğü `access-technology` alanı üstüne ──

const NB_IOT_ACCESS_TECHNOLOGY = 9;

function decodeNbIotAccessTechnologyMatch(accessTechnologyField: ParsedField, value: number): ParsedField {
  const isNbIot = value === NB_IOT_ACCESS_TECHNOLOGY;
  return {
    id: 'nb-iot-access-technology-match',
    name: 'NB-IoT erişim teknolojisi eşleşmesi (AcT=9)',
    offset: accessTechnologyField.offset,
    length: accessTechnologyField.length,
    rawBytes: accessTechnologyField.rawBytes,
    rawValue: value,
    physicalValue: isNbIot ? 'NB-IoT (E-UTRAN NB-S1 mode)' : `NB-IoT değil (AcT=${value})`,
    valid: true,
    warnings: isNbIot ? [] : [WARN_ACCESS_TECHNOLOGY_NOT_NB_IOT],
  };
}

// ── PSM — AT+CPSMS? (GPRS Timer 2 / GPRS Timer 3, TS 24.008) ────────────────

/** TS 24.008 Table 10.5.163a/3GPP TS 24.008 ("GPRS Timer 3") — AT+CPSMS'nin
 *  `<Requested_Periodic-TAU>`si (T3412 extended) bu formatı kullanır. Yedi
 *  birim tanımlı; 320 saatlik birim (kod 110) BG96/BC66/ETSI'de bağımsız
 *  doğrulandı (31×320s = 413.3 gün, spec'in kendi "maks. 413 gün" notuyla
 *  örtüşüyor). */
const GPRS_TIMER_3_UNIT_SECONDS: Readonly<Record<string, number>> = {
  '000': 600, // 10 dakika
  '001': 3600, // 1 saat
  '010': 36000, // 10 saat
  '011': 2,
  '100': 30,
  '101': 60,
  '110': 1152000, // 320 saat
};

/** TS 24.008 Table 10.5.163/3GPP TS 24.008 ("GPRS Timer 2") — AT+CPSMS'nin
 *  `<Requested_Active-Time>`si (T3324) bu formatı kullanır. GPRS Timer 3'ten
 *  FARKLI: yalnız DÖRT birim tanımlı, en büyüğü decihour (6 dakika) — bu
 *  yüzden T3324'ün maksimumu 186 dakika (31×6dk), T3412-ext'in 413 günüyle
 *  KARIŞTIRILMASIN (dosya başı uyarısı). */
const GPRS_TIMER_2_UNIT_SECONDS: Readonly<Record<string, number>> = {
  '000': 2,
  '001': 60,
  '010': 360, // decihour = 6 dakika
};

const GPRS_TIMER_DEACTIVATED_BITS = '111';
const GPRS_TIMER_BIT_PATTERN = /^[01]{8}$/;

/** Ortak GPRS Timer 2/3 çözücü — hangi tabloyu kullanacağı çağırana bağlı,
 *  ikisini karıştırmamak için burada TEK bir "birim bulunamadı" dalı yok. */
function decodeGprsTimerField(
  unitSecondsTable: Readonly<Record<string, number>>,
  data: Uint8Array,
  paramsOffset: number,
  token: ParamToken,
  id: string,
  name: string,
): ParsedField {
  const bits = unquote(token.value);
  if (!GPRS_TIMER_BIT_PATTERN.test(bits)) {
    return tokenField(data, paramsOffset, token, id, name, bits, { warnings: [WARN_TIMER_MALFORMED] });
  }

  const unitBits = bits.slice(0, 3);
  const valueBits = bits.slice(3);
  const value = Number.parseInt(valueBits, 2);

  if (unitBits === GPRS_TIMER_DEACTIVATED_BITS) {
    return tokenField(data, paramsOffset, token, id, name, bits, { physicalValue: 'deactivated' });
  }

  const unitSeconds = unitSecondsTable[unitBits];
  if (unitSeconds === undefined) {
    // Rezerve birim kodu — CREG/CEREG reject_cause'la aynı disiplin: yapı
    // (ham 8 bit) taşınır, saniye UYDURULMAZ.
    return tokenField(data, paramsOffset, token, id, name, bits, { warnings: [WARN_TIMER_UNIT_RESERVED] });
  }

  return tokenField(data, paramsOffset, token, id, name, bits, { physicalValue: value * unitSeconds, unit: 's' });
}

function decodeCpsms(tokens: ParamToken[], data: Uint8Array, paramsOffset: number): ParsedField[] {
  const fields: ParsedField[] = [];

  const modeToken = tokens[0];
  if (modeToken !== undefined) {
    const mode = Number(modeToken.value.trim());
    fields.push(
      tokenField(data, paramsOffset, modeToken, 'psm-mode', 'PSM kullanımı', mode, {
        physicalValue: mode === 0 ? 'disabled' : mode === 1 ? 'enabled' : String(mode),
      }),
    );
  }

  // tokens[1]=Requested_Periodic-RAU (T3312), tokens[2]=Requested_GPRS-READY-timer
  // (T3314): GERAN/UTRAN'a özgü, saf E-UTRAN/NB-IoT'de PRATİKTE hep boş —
  // CGDCONT'un pdp-address deseniyle aynı, boşsa hiç alan üretilmez.

  const periodicTauToken = tokens[3];
  if (periodicTauToken !== undefined && unquote(periodicTauToken.value).length > 0) {
    fields.push(
      decodeGprsTimerField(
        GPRS_TIMER_3_UNIT_SECONDS,
        data,
        paramsOffset,
        periodicTauToken,
        'psm-periodic-tau',
        'Periyodik TAU zamanlayıcısı (T3412 extended)',
      ),
    );
  }

  const activeTimeToken = tokens[4];
  if (activeTimeToken !== undefined && unquote(activeTimeToken.value).length > 0) {
    fields.push(
      decodeGprsTimerField(
        GPRS_TIMER_2_UNIT_SECONDS,
        data,
        paramsOffset,
        activeTimeToken,
        'psm-active-time',
        'Aktif zamanlayıcı (T3324)',
      ),
    );
  }

  return fields;
}

// ── eDRX — AT+CEDRXS? / +CEDRXP / AT+CEDRXRDP (TS 24.008 Table 10.5.5.32) ───

const EDRX_ACT_TYPE_NB_S1 = 5;

const EDRX_ACT_TYPE_NAMES: Readonly<Record<number, string>> = {
  0: 'eDRX kullanılmıyor',
  2: 'GSM (A/Gb mode)',
  4: 'E-UTRAN (WB-S1 mode)',
  5: 'E-UTRAN (NB-S1 mode)',
};

/** Yalnız NB-S1 modu (AcT_type=5) — Quectel BC26 + u-blox SARA-N2/N3 çapraz
 *  doğrulandı. WB-S1 (AcT_type=4, LTE-M) FARKLI bir tablo kullanır ve burada
 *  YOK — karıştırmamak için ayrı uyarı taşır (`WARN_EDRX_NOT_NB_S1`). */
const EDRX_CYCLE_SECONDS_NB_S1: Readonly<Record<string, number>> = {
  '0010': 20.48,
  '0011': 40.96,
  '0101': 81.92,
  '1001': 163.84,
  '1010': 327.68,
  '1011': 655.36,
  '1100': 1310.72,
  '1101': 2621.44,
  '1110': 5242.88,
  '1111': 10485.76,
};

const EDRX_VALUE_BIT_PATTERN = /^[01]{4}$/;

function decodeEdrxCycleField(
  data: Uint8Array,
  paramsOffset: number,
  token: ParamToken,
  id: string,
  name: string,
): ParsedField {
  const bits = unquote(token.value);
  if (!EDRX_VALUE_BIT_PATTERN.test(bits)) {
    return tokenField(data, paramsOffset, token, id, name, bits, { warnings: [WARN_EDRX_MALFORMED] });
  }
  const seconds = EDRX_CYCLE_SECONDS_NB_S1[bits];
  if (seconds === undefined) {
    return tokenField(data, paramsOffset, token, id, name, bits, { warnings: [WARN_EDRX_CODE_RESERVED] });
  }
  return tokenField(data, paramsOffset, token, id, name, bits, { physicalValue: seconds, unit: 's' });
}

/** NB-S1 dışı (AcT_type ≠ 5) bir eDRX döngü değeri: tablo doğrulanmadı, ham dize taşınır. */
function rawEdrxCycleField(
  data: Uint8Array,
  paramsOffset: number,
  token: ParamToken,
  id: string,
  name: string,
): ParsedField {
  return tokenField(data, paramsOffset, token, id, name, unquote(token.value), {
    warnings: [WARN_EDRX_NOT_NB_S1],
  });
}

function decodeEdrxActType(tokens: ParamToken[], data: Uint8Array, paramsOffset: number): { fields: ParsedField[]; actType: number | undefined } {
  const fields: ParsedField[] = [];
  const actTypeToken = tokens[0];
  let actType: number | undefined;
  if (actTypeToken !== undefined) {
    actType = Number(actTypeToken.value.trim());
    fields.push(
      tokenField(data, paramsOffset, actTypeToken, 'edrx-act-type', 'eDRX erişim teknolojisi türü', actType, {
        ...(EDRX_ACT_TYPE_NAMES[actType] === undefined ? {} : { physicalValue: EDRX_ACT_TYPE_NAMES[actType] }),
      }),
    );
  }
  return { fields, actType };
}

/** AT+CEDRXS'in set/read yankısı: `<AcT_type>,<Requested_eDRX_value>`. */
function decodeCedrxs(tokens: ParamToken[], data: Uint8Array, paramsOffset: number): ParsedField[] {
  const { fields, actType } = decodeEdrxActType(tokens, data, paramsOffset);
  const isNbS1 = actType === EDRX_ACT_TYPE_NB_S1;

  const cycleToken = tokens[1];
  if (cycleToken !== undefined && unquote(cycleToken.value).length > 0) {
    fields.push(
      isNbS1
        ? decodeEdrxCycleField(data, paramsOffset, cycleToken, 'edrx-requested-cycle', 'İstenen eDRX döngü uzunluğu')
        : rawEdrxCycleField(data, paramsOffset, cycleToken, 'edrx-requested-cycle', 'İstenen eDRX döngü uzunluğu'),
    );
  }

  return fields;
}

/** `+CEDRXP` URC'si VE `AT+CEDRXRDP`in okuma yanıtı AYNI dört parametreyi
 *  taşır: `<AcT_type>,<Requested_eDRX_value>,<NW-provided/Assigned_eDRX_value>,
 *  <Paging_time_window>` — tek çözücü ikisine de dispatch edilir. */
function decodeCedrxParams(tokens: ParamToken[], data: Uint8Array, paramsOffset: number): ParsedField[] {
  const { fields, actType } = decodeEdrxActType(tokens, data, paramsOffset);
  const isNbS1 = actType === EDRX_ACT_TYPE_NB_S1;

  const requestedToken = tokens[1];
  if (requestedToken !== undefined && unquote(requestedToken.value).length > 0) {
    fields.push(
      isNbS1
        ? decodeEdrxCycleField(data, paramsOffset, requestedToken, 'edrx-requested-cycle', 'İstenen eDRX döngü uzunluğu')
        : rawEdrxCycleField(data, paramsOffset, requestedToken, 'edrx-requested-cycle', 'İstenen eDRX döngü uzunluğu'),
    );
  }

  const assignedToken = tokens[2];
  if (assignedToken !== undefined && unquote(assignedToken.value).length > 0) {
    fields.push(
      isNbS1
        ? decodeEdrxCycleField(data, paramsOffset, assignedToken, 'edrx-assigned-cycle', 'Atanan eDRX döngü uzunluğu')
        : rawEdrxCycleField(data, paramsOffset, assignedToken, 'edrx-assigned-cycle', 'Atanan eDRX döngü uzunluğu'),
    );
  }

  const pagingWindowToken = tokens[3];
  if (pagingWindowToken !== undefined && unquote(pagingWindowToken.value).length > 0) {
    // Paging Time Window tablosu bağımsız doğrulanmadı — CREG/CEREG
    // reject_cause disipliniyle aynı: yapı taşınır, saniye UYDURULMAZ.
    fields.push(
      tokenField(
        data,
        paramsOffset,
        pagingWindowToken,
        'edrx-paging-time-window',
        'Paging Time Window (ham, çözülmedi)',
        unquote(pagingWindowToken.value),
      ),
    );
  }

  return fields;
}

// ── Dispatch tablosu ───────────────────────────────────────────────────

type CommandDecoder = (tokens: ParamToken[], data: Uint8Array, paramsOffset: number) => ParsedField[];

const NB_IOT_COMMAND_DECODERS: ReadonlyMap<string, CommandDecoder> = new Map([
  ['CPSMS', decodeCpsms],
  ['CEDRXS', decodeCedrxs],
  ['CEDRXRDP', decodeCedrxParams],
  ['CEDRXP', decodeCedrxParams],
]);

function enrichFrame(frame: ParsedFrame, data: Uint8Array): ParsedFrame {
  const extraFields: ParsedField[] = [];

  // `lte-modem-at` CREG/CEREG/COPS'u ZATEN çözdüyse `access-technology` alanı
  // burada hazır bulunur — AcT=9 eşleşmesi bunun üstüne eklenir, yeniden
  // ayrıştırma YAPILMAZ.
  const accessTechnologyField = frame.fields.find((field) => field.id === 'access-technology');
  if (accessTechnologyField !== undefined && typeof accessTechnologyField.rawValue === 'number') {
    extraFields.push(decodeNbIotAccessTechnologyMatch(accessTechnologyField, accessTechnologyField.rawValue));
  }

  // `lte-modem-at`in TANIMADIĞI komutlar (CPSMS/CEDRXS/CEDRXRDP/CEDRXP) —
  // `kind`/`prefix`/`parameters` alanları at-commands'tan aynen geldi,
  // yalnız burada dispatch edilir.
  const kind = frame.fields.find((field) => field.id === 'kind')?.rawValue;
  if (kind === 'information') {
    const prefixValue = frame.fields.find((field) => field.id === 'prefix')?.rawValue;
    const parametersField = frame.fields.find((field) => field.id === 'parameters');
    const commandName = typeof prefixValue === 'string' && prefixValue.startsWith('+') ? prefixValue.slice(1).toUpperCase() : undefined;
    const decoder = commandName === undefined ? undefined : NB_IOT_COMMAND_DECODERS.get(commandName);
    if (decoder !== undefined) {
      const paramsText = typeof parametersField?.rawValue === 'string' ? parametersField.rawValue : '';
      const paramsOffset = parametersField?.offset ?? 0;
      extraFields.push(...decoder(splitParameterTokens(paramsText), data, paramsOffset));
    }
  }

  if (extraFields.length === 0) {
    return { ...frame, protocol: PROTOCOL_ID };
  }

  const derivedWarnings = extraFields.flatMap((field) => field.warnings.map(toProtocolWarning));
  return {
    ...frame,
    protocol: PROTOCOL_ID,
    fields: [...frame.fields, ...extraFields],
    warnings: [...frame.warnings, ...derivedWarnings],
  };
}

export const nbIotParser: ProtocolParser = {
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
    id: 'cereg-nb-iot',
    name: `${TRANSLATION_KEY_PREFIX}.example.ceregNbIot.name`,
    bytes: asciiBytes('+CEREG: 2,1,"1A2D","0001A2B3",9\r\n'),
    description: `${TRANSLATION_KEY_PREFIX}.example.ceregNbIot.description`,
    expectedValid: true,
  },
  {
    id: 'cereg-not-nb-iot',
    name: `${TRANSLATION_KEY_PREFIX}.example.ceregNotNbIot.name`,
    bytes: asciiBytes('+CEREG: 2,1,"1A2D","0001A2B3",7\r\n'),
    description: `${TRANSLATION_KEY_PREFIX}.example.ceregNotNbIot.description`,
    expectedValid: true,
  },
  {
    id: 'cpsms-enabled',
    // Quectel BG96 AT Commands Manual V2.3'ün kendi örneği: "00000100"→40
    // dakika (T3412), "00001111"→30 saniye (T3324) — iki tablo da bu tek
    // fixture'la bağımsız doğrulanmış oluyor.
    name: `${TRANSLATION_KEY_PREFIX}.example.cpsmsEnabled.name`,
    bytes: asciiBytes('+CPSMS: 1,,,"00000100","00001111"\r\n'),
    description: `${TRANSLATION_KEY_PREFIX}.example.cpsmsEnabled.description`,
    expectedValid: true,
  },
  {
    id: 'cpsms-deactivated',
    name: `${TRANSLATION_KEY_PREFIX}.example.cpsmsDeactivated.name`,
    bytes: asciiBytes('+CPSMS: 1,,,"11100000","11100000"\r\n'),
    description: `${TRANSLATION_KEY_PREFIX}.example.cpsmsDeactivated.description`,
    expectedValid: true,
  },
  {
    id: 'cedrxs-nb-s1',
    name: `${TRANSLATION_KEY_PREFIX}.example.cedrxsNbS1.name`,
    bytes: asciiBytes('+CEDRXS: 5,"0011"\r\n'),
    description: `${TRANSLATION_KEY_PREFIX}.example.cedrxsNbS1.description`,
    expectedValid: true,
  },
  {
    id: 'cedrxs-wb-s1-unsupported',
    name: `${TRANSLATION_KEY_PREFIX}.example.cedrxsWbS1Unsupported.name`,
    bytes: asciiBytes('+CEDRXS: 4,"1001"\r\n'),
    description: `${TRANSLATION_KEY_PREFIX}.example.cedrxsWbS1Unsupported.description`,
    expectedValid: true,
  },
  {
    id: 'cedrxrdp-full',
    // u-blox SARA-N2/N3 AT Commands Manual'ın (UBX-16014887) kendi örneği.
    name: `${TRANSLATION_KEY_PREFIX}.example.cedrxrdpFull.name`,
    bytes: asciiBytes('+CEDRXRDP: 5,"0010","1110","0101"\r\n'),
    description: `${TRANSLATION_KEY_PREFIX}.example.cedrxrdpFull.description`,
    expectedValid: true,
  },
  {
    id: 'cedrxp-urc',
    name: `${TRANSLATION_KEY_PREFIX}.example.cedrxpUrc.name`,
    bytes: asciiBytes('+CEDRXP: 5,"0010","1110","0101"\r\n'),
    description: `${TRANSLATION_KEY_PREFIX}.example.cedrxpUrc.description`,
    expectedValid: true,
  },
  {
    id: 'final-ok',
    name: `${TRANSLATION_KEY_PREFIX}.example.finalOk.name`,
    bytes: asciiBytes('OK\r\n'),
    description: `${TRANSLATION_KEY_PREFIX}.example.finalOk.description`,
    expectedValid: true,
  },
];

export const nbIotPlugin: ProtocolPlugin = {
  id: PROTOCOL_ID,
  name: PROTOCOL_DISPLAY_NAME,
  category: 'wireless-iot',
  parser: nbIotParser,
  documentation: {
    summary: `${TRANSLATION_KEY_PREFIX}.documentation.summary`,
    layer: 'application',
    references: [
      {
        title: '3GPP TS 27.007 — AT command set for User Equipment (UE)',
        url: 'https://www.etsi.org/deliver/etsi_TS/127000_127099/127007/18.08.00_60/ts_127007v180800p.pdf',
      },
      {
        title: 'Quectel BC66 AT Commands Manual V1.0 (NB-IoT)',
        url: 'https://sisoog.com/wp-content/uploads/2019/03/Quectel_BC66_AT_Commands_Manual_V1.0.pdf',
      },
      {
        title: 'u-blox SARA-N2/N3 series AT Commands Manual (UBX-16014887)',
        url: 'https://content.u-blox.com/sites/default/files/SARA-N2-N3_ATCommands_UBX-16014887.pdf',
      },
    ],
  },
  exampleFrames: EXAMPLE_FRAMES,
};
