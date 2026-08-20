/**
 * 3GPP TS 27.007 hücresel AT komut sözlüğü — `at-commands`in (Faz 10 dalga
 * 9b, `serial/atcommands/atCommands.ts`) ÜSTÜNDE oturan lehçe. Brief 9c madde
 * 8'in kapsadığı on komut: CSQ/COPS/CREG/CEREG/CGATT/CGDCONT/CIMI/CGSN/CCLK/CPIN.
 *
 * ── BİLEŞİM, KOPYALAMA DEĞİL ─────────────────────────────────────────────
 * `lteModemAtParser.parse()` önce `atCommandsParser.parse()`i ÇAĞIRIR (satır
 * sınıflandırması, final result code, echo — hepsi ORADA çözülür), sonra
 * yalnız `kind: 'information'` ve prefiksi bilinen bir komut adına denk gelen
 * çerçeveleri ZENGİNLEŞTİRİR. `OK`/`ERROR`/echo/prompt satırları bu dosyaya
 * hiç uğramadan aynen geçer — bu sayfanın decode sekmesi hâlâ tutarlı görünür.
 *
 * ── CIMI/CGSN BARE YANIT: DÜRÜST BELİRSİZLİK ─────────────────────────────
 * `AT+CIMI` ve çıplak `AT+CGSN` İKİSİ de öneki OLMAYAN, salt rakam dizisi
 * döndürür (V.250'nin bilinçli istisnası). Tek satırdan (oturum bağlamı
 * olmadan) hangisi olduğu AYIRT EDİLEMEZ — bu yüzden `numeric-identifier`
 * alanı ikisini de kapsayan GENEL bir aday olarak işaretlenir, "bu kesinlikle
 * IMSI'dir" ya da "bu kesinlikle IMEI'dir" diye UYDURULMAZ. `AT+CGSN=1`in
 * prefiksli formu (`+CGSN: "..."`) kesindir, `serial-number` alanına gider.
 *
 * ── VERİLMEYEN ŞEY: SEBEP KODU ANLAMI, MODEL/FIRMWARE, BANT ─────────────
 * CREG/CEREG'in `<reject_cause>`sı YAPISAL çözülür (sayı + cause_type), ANLAMI
 * çözülmez — CREG TS 24.008 Annex G'ye, CEREG TS 24.301 Annex A'ya bakar, iki
 * FARKLI tablo, ikisi de bu dalgada doğrulanmadı (CME/CMS'teki 9b disipliniyle
 * aynı: yapı çözülür, tablo uydurulmaz). Katalogun "Cellular Initialization
 * Dashboard (model, firmware, IMEI, SIM, operator, RAT, band, IP)" vaadinden
 * model/firmware (ATI, AT+CGMM, AT+CGMR) ve bant (üretici özel, ör. AT+QNWINFO)
 * madde 8'in komut kümesinde YOK — LoRa'nın RSSI/SNR Scatter'ıyla aynı gerekçe:
 * veri kaynağı yok, uydurulmadı.
 *
 * ── AcT (ERİŞİM TEKNOLOJİSİ) — SATICI ÇAKIŞMASI UYARILI ──────────────────
 * COPS/CREG/CEREG'in ortak `<AcT>` tablosu 3GPP TS 27.007 v18.8.0'da 0-16
 * arası tanımlı, ama 8+ değerlerinde satıcılar ÇAKIŞAN eklentiler kullanıyor
 * (SIMCom'un 8=CDMA/HDR'ı spec'in 8=EC-GSM-IoT'siyle birebir çakışıyor,
 * Quectel 100=CDMA ekliyor). 8 ve üstü değerler bu yüzden bir UYARIYLA
 * işaretlenir — "resmi tabloya göre X" derken satıcı firmware'i farklı bir
 * şey kastediyor olabilir.
 *
 * ── PRIVACY MASKING ON EXPORT — MOTOR HAZIR, BAĞLANTI YOK ────────────────
 * Katalogun vaat ettiği maskeleme `maskSensitiveIdentifier`de yazılı ve test
 * edilmiş, ilgili alanlar (`serial-number`, `numeric-identifier`)
 * `sensitiveExportValue` uyarısıyla DecodePanel'de zaten görünür işaretli.
 * Ama BAĞLANMADI: bu depoda decoded-field seviyesinde export eden TEK
 * mekanizma `live-monitor/formatRecord.ts`teki CSV/JSON/TXT dışa aktarımı,
 * ve o HAM BAYT üzerinden çalışır — 172 protokolün TAMAMI için protokol
 * BAĞIMSIZ (decode edilmiş alan bilmez). Maskelemeyi oraya bağlamak o jenerik
 * mekanizmayı protokol-farkında yapmayı gerektirirdi; bu tek dalganın
 * kapsamının çok ötesinde bir sözleşme değişikliği (decision 4'ün "172
 * protokolün tamamına yayılır" uyarısıyla aynı sınıf risk). ICCID/telefon
 * numarası maskelemesi de bu yüzden YOK — kaynak komutları (AT+CCID/AT+QCCID,
 * AT+CNUM) brief madde 8'in listesinde değil.
 *
 * Kaynaklar: 3GPP TS 27.007 v18.8.0 (ETSI), Quectel EC25&EC21 AT Commands
 * Manual V1.3 (çapraz doğrulama — brief'in andığı BG96 V2.3 bu turda ayrıca
 * doğrulanmadı, EC25/EC21 aynı satıcı ailesinden kullanıldı).
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
import { atCommandsParser } from '../../serial/atcommands/atCommands';

const PROTOCOL_ID = 'lte-modem-at';
/** Protokol adı veridir, çeviriye girmez (CLAUDE.md). */
const PROTOCOL_DISPLAY_NAME = 'LTE Modem AT';

const TRANSLATION_KEY_PREFIX = 'protocol.lteModemAt';

const WARN_CSQ_UNKNOWN = `${TRANSLATION_KEY_PREFIX}.warning.csqUnknown`;
const WARN_ACCESS_TECHNOLOGY_VENDOR_COLLISION = `${TRANSLATION_KEY_PREFIX}.warning.accessTechnologyVendorCollision`;
const WARN_PDP_TYPE_OBSOLETE = `${TRANSLATION_KEY_PREFIX}.warning.pdpTypeObsolete`;
const WARN_CGDCONT_TAIL_NOT_DECODED = `${TRANSLATION_KEY_PREFIX}.warning.cgdcontTailNotDecoded`;
const WARN_CPIN_UNRECOGNIZED_CODE = `${TRANSLATION_KEY_PREFIX}.warning.cpinUnrecognizedCode`;
const WARN_BARE_IDENTIFIER_AMBIGUOUS = `${TRANSLATION_KEY_PREFIX}.warning.bareIdentifierAmbiguous`;
const WARN_SENSITIVE_EXPORT_VALUE = `${TRANSLATION_KEY_PREFIX}.warning.sensitiveExportValue`;

function toProtocolWarning(code: string): ProtocolWarning {
  return { code, message: code };
}

// ── Ortak yardımcılar ──────────────────────────────────────────────────

interface ParamToken {
  /** Tırnaklıysa tırnaklar DAHİL ham metin. */
  value: string;
  /** `parameters` alanının BAŞINA göre ofset (mutlak değil). */
  offset: number;
}

/** Virgülle ayrılmış parametre listesini böler — tırnak İÇİNDEKİ virgül ayraç sayılmaz. */
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

/**
 * `offset`/`length` her zaman HAM token aralığını (tırnaklar dahil) kapsar —
 * `rawValue`/`physicalValue` temizlenmiş değeri taşır. UDP'nin ham↔fiziksel
 * ayrımıyla aynı ilke, yalnız burada "ham" tırnaklı metin, sayı değil.
 */
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

// ── AcT (Access Technology) — COPS/CREG/CEREG ortak tablosu ─────────────

/** 3GPP TS 27.007 v18.8.0 — 8'den itibaren satıcı eklentileriyle ÇAKIŞMA riski var. */
const ACCESS_TECHNOLOGY_VENDOR_COLLISION_THRESHOLD = 8;

const ACCESS_TECHNOLOGY_NAMES: Readonly<Record<number, string>> = {
  0: 'GSM',
  1: 'GSM Compact',
  2: 'UTRAN',
  3: 'GSM w/EGPRS',
  4: 'UTRAN w/HSDPA',
  5: 'UTRAN w/HSUPA',
  6: 'UTRAN w/HSDPA and HSUPA',
  7: 'E-UTRAN',
  8: 'EC-GSM-IoT (A/Gb mode)',
  9: 'E-UTRAN (NB-S1 mode)',
  10: 'E-UTRA connected to a 5GCN',
  11: 'NR connected to a 5GCN',
  12: 'NG-RAN',
  13: 'E-UTRA-NR dual connectivity',
  14: 'satellite E-UTRAN (NB-S1 mode)',
  15: 'satellite E-UTRAN (WB-S1 mode)',
  16: 'satellite NG-RAN',
};

function decodeAccessTechnologyField(
  data: Uint8Array,
  paramsOffset: number,
  token: ParamToken,
  id: string,
): ParsedField {
  const value = Number(token.value.trim());
  return tokenField(data, paramsOffset, token, id, 'Erişim teknolojisi (AcT)', value, {
    ...(ACCESS_TECHNOLOGY_NAMES[value] === undefined ? {} : { physicalValue: ACCESS_TECHNOLOGY_NAMES[value] }),
    warnings: value >= ACCESS_TECHNOLOGY_VENDOR_COLLISION_THRESHOLD ? [WARN_ACCESS_TECHNOLOGY_VENDOR_COLLISION] : [],
  });
}

// ── AT+CSQ — Signal Quality Report ───────────────────────────────────────

function decodeCsq(tokens: ParamToken[], data: Uint8Array, paramsOffset: number): ParsedField[] {
  const fields: ParsedField[] = [];

  const rssiToken = tokens[0];
  if (rssiToken !== undefined) {
    const rssi = Number(rssiToken.value.trim());
    let physicalValue: number | undefined;
    // 0 ve 31 DOYGUNLUK ucu (≤−113 / ≥−51), tek nokta değil — spec'in kendi
    // tanımı. Aradaki 1-30 için dBm = −113 + 2×rssi (2 dBm adım, doğrulandı).
    if (rssi === 0) physicalValue = -113;
    else if (rssi === 31) physicalValue = -51;
    else if (rssi >= 1 && rssi <= 30) physicalValue = -113 + 2 * rssi;

    fields.push(
      tokenField(data, paramsOffset, rssiToken, 'csq-rssi', 'RSSI', rssi, {
        ...(physicalValue === undefined ? {} : { physicalValue, unit: 'dBm' }),
        warnings: rssi === 99 ? [WARN_CSQ_UNKNOWN] : [],
      }),
    );
  }

  const berToken = tokens[1];
  if (berToken !== undefined) {
    // %BER eşlemesi satıcılar arasında ÇELİŞİYOR (u-blox ve SIMCom farklı
    // tablo veriyor) — 3GPP TS 45.008'e bağımsız doğrulanmadan sayısal yüzde
    // UYDURULMAZ, yalnız ordinal sınıf (0-7) taşınır.
    const ber = Number(berToken.value.trim());
    fields.push(
      tokenField(data, paramsOffset, berToken, 'csq-ber', 'BER sınıfı (ordinal, TS 45.008)', ber, {
        warnings: ber === 99 ? [WARN_CSQ_UNKNOWN] : [],
      }),
    );
  }

  return fields;
}

// ── AT+COPS? — Operator Selection ────────────────────────────────────────

const COPS_MODE_NAMES: Readonly<Record<number, string>> = {
  0: 'automatic',
  1: 'manual',
  2: 'deregister',
  3: 'set format only',
  4: 'manual/automatic',
};
const COPS_FORMAT_NAMES: Readonly<Record<number, string>> = {
  0: 'long alphanumeric',
  1: 'short alphanumeric',
  2: 'numeric',
};

function decodeCops(tokens: ParamToken[], data: Uint8Array, paramsOffset: number): ParsedField[] {
  const fields: ParsedField[] = [];

  const modeToken = tokens[0];
  if (modeToken !== undefined) {
    const mode = Number(modeToken.value.trim());
    fields.push(
      tokenField(data, paramsOffset, modeToken, 'cops-mode', 'Seçim modu', mode, {
        ...(COPS_MODE_NAMES[mode] === undefined ? {} : { physicalValue: COPS_MODE_NAMES[mode] }),
      }),
    );
  }

  const formatToken = tokens[1];
  let format: number | undefined;
  if (formatToken !== undefined) {
    format = Number(formatToken.value.trim());
    fields.push(
      tokenField(data, paramsOffset, formatToken, 'cops-format', 'Gösterim biçimi', format, {
        ...(COPS_FORMAT_NAMES[format] === undefined ? {} : { physicalValue: COPS_FORMAT_NAMES[format] }),
      }),
    );
  }

  const operToken = tokens[2];
  if (operToken !== undefined) {
    const operator = unquote(operToken.value);
    fields.push(tokenField(data, paramsOffset, operToken, 'cops-operator', 'Operatör', operator));

    if (format === 2 && /^\d{5,6}$/.test(operator)) {
      // Numeric biçimde <oper> = MCC(3 hane)+MNC(2-3 hane), BCD'den IRA'ya
      // çevrilmiş (TS 24.008 §10.5.1.3) — spec'te doğrulandı.
      fields.push(tokenField(data, paramsOffset, operToken, 'cops-mcc', 'MCC', operator.slice(0, 3)));
      fields.push(tokenField(data, paramsOffset, operToken, 'cops-mnc', 'MNC', operator.slice(3)));
    }
  }

  const actToken = tokens[3];
  if (actToken !== undefined) {
    fields.push(decodeAccessTechnologyField(data, paramsOffset, actToken, 'access-technology'));
  }

  return fields;
}

// ── AT+CREG? / AT+CEREG? — Registration Status ───────────────────────────

/** 0-11 tam liste (TS 27.007 v18.8.0) — hangi değerin hangi komutta "uygulanabilir" olduğu spec'te ayrı ayrı işaretli, burada zorlanmaz. */
const REGISTRATION_STATUS_NAMES: Readonly<Record<number, string>> = {
  0: 'not registered, not searching',
  1: 'registered, home network',
  2: 'not registered, searching',
  3: 'registration denied',
  4: 'unknown',
  5: 'registered, roaming',
  6: 'registered "SMS only", home network',
  7: 'registered "SMS only", roaming',
  8: 'attached for emergency bearer services only',
  9: 'registered "CSFB not preferred", home network',
  10: 'registered "CSFB not preferred", roaming',
  11: 'attached for access to RLOS',
};

function decodeRegistrationStatus(
  areaFieldId: 'lac' | 'tac',
  tokens: ParamToken[],
  data: Uint8Array,
  paramsOffset: number,
): ParsedField[] {
  const fields: ParsedField[] = [];

  const nToken = tokens[0];
  if (nToken !== undefined) {
    fields.push(
      tokenField(data, paramsOffset, nToken, 'urc-config', 'URC ayarı (<n>)', Number(nToken.value.trim())),
    );
  }

  const statToken = tokens[1];
  if (statToken !== undefined) {
    const stat = Number(statToken.value.trim());
    fields.push(
      tokenField(data, paramsOffset, statToken, 'registration-status', 'Kayıt durumu', stat, {
        ...(REGISTRATION_STATUS_NAMES[stat] === undefined ? {} : { physicalValue: REGISTRATION_STATUS_NAMES[stat] }),
      }),
    );
  }

  const areaToken = tokens[2];
  if (areaToken !== undefined) {
    const areaHex = unquote(areaToken.value);
    const areaNumber = Number.parseInt(areaHex, 16);
    fields.push(
      tokenField(
        data,
        paramsOffset,
        areaToken,
        areaFieldId,
        areaFieldId === 'lac' ? 'Lokasyon alanı kodu (LAC)' : 'İzleme alanı kodu (TAC)',
        areaHex,
        { ...(Number.isNaN(areaNumber) ? {} : { physicalValue: areaNumber }) },
      ),
    );
  }

  const cellToken = tokens[3];
  if (cellToken !== undefined) {
    const cellHex = unquote(cellToken.value);
    const cellNumber = Number.parseInt(cellHex, 16);
    fields.push(
      tokenField(data, paramsOffset, cellToken, 'cell-id', 'Hücre kimliği', cellHex, {
        ...(Number.isNaN(cellNumber) ? {} : { physicalValue: cellNumber }),
      }),
    );
  }

  const actToken = tokens[4];
  if (actToken !== undefined) {
    fields.push(decodeAccessTechnologyField(data, paramsOffset, actToken, 'access-technology'));
  }

  const causeTypeToken = tokens[5];
  if (causeTypeToken !== undefined) {
    const causeType = Number(causeTypeToken.value.trim());
    fields.push(
      tokenField(data, paramsOffset, causeTypeToken, 'cause-type', 'Sebep tablosu', causeType, {
        physicalValue: causeType === 0 ? 'standart (MM/EMM cause)' : causeType === 1 ? 'üretici özel' : String(causeType),
      }),
    );
  }

  const rejectCauseToken = tokens[6];
  if (rejectCauseToken !== undefined) {
    // Sebep kodunun ANLAMI çözülmez: CREG TS 24.008 Annex G'ye, CEREG TS
    // 24.301 Annex A'ya bakar — FARKLI tablolar, ikisi de bu dalgada
    // doğrulanmadı (CME/CMS'teki 9b disipliniyle aynı: yapı çözülür, anlam
    // uydurulmaz).
    fields.push(
      tokenField(
        data,
        paramsOffset,
        rejectCauseToken,
        'reject-cause',
        'Red sebebi (ham kod, anlamı çözülmedi)',
        Number(rejectCauseToken.value.trim()),
      ),
    );
  }

  return fields;
}

// ── AT+CGATT? — PS Attach Status ─────────────────────────────────────────

function decodeCgatt(tokens: ParamToken[], data: Uint8Array, paramsOffset: number): ParsedField[] {
  const stateToken = tokens[0];
  if (stateToken === undefined) return [];
  const state = Number(stateToken.value.trim());
  return [
    tokenField(data, paramsOffset, stateToken, 'attach-state', 'PS bağlanma durumu', state, {
      physicalValue: state === 0 ? 'detached' : state === 1 ? 'attached' : String(state),
    }),
  ];
}

// ── AT+CGDCONT? — PDP Context Query ──────────────────────────────────────

/** Spec metninde hâlâ listeli ama "(Obsolete)" işaretli iki tür. */
const PDP_TYPE_OBSOLETE = new Set(['X.25', 'OSPIH']);
const DATA_COMPRESSION_NAMES: Readonly<Record<number, string>> = {
  0: 'off',
  1: 'on (manufacturer preferred)',
  2: 'V.42bis',
  3: 'V.44',
};
const HEADER_COMPRESSION_NAMES: Readonly<Record<number, string>> = {
  0: 'off',
  1: 'on (manufacturer preferred)',
  2: 'RFC1144',
  3: 'RFC2507',
  4: 'RFC3095',
};

function decodeCgdcont(tokens: ParamToken[], data: Uint8Array, paramsOffset: number): ParsedField[] {
  const fields: ParsedField[] = [];

  const cidToken = tokens[0];
  if (cidToken !== undefined) {
    fields.push(
      tokenField(data, paramsOffset, cidToken, 'context-id', 'Bağlam kimliği (CID)', Number(cidToken.value.trim())),
    );
  }

  const typeToken = tokens[1];
  if (typeToken !== undefined) {
    const pdpType = unquote(typeToken.value);
    fields.push(
      tokenField(data, paramsOffset, typeToken, 'pdp-type', 'PDP türü', pdpType, {
        warnings: PDP_TYPE_OBSOLETE.has(pdpType) ? [WARN_PDP_TYPE_OBSOLETE] : [],
      }),
    );
  }

  const apnToken = tokens[2];
  if (apnToken !== undefined) {
    fields.push(tokenField(data, paramsOffset, apnToken, 'apn', 'APN', unquote(apnToken.value)));
  }

  const addrToken = tokens[3];
  if (addrToken !== undefined) {
    // Boşsa alan HİÇ eklenmez: SIMCom read yanıtını hep boş döndürür, u-blox
    // dolu döndürür (kaynaklar çelişiyor) — "adres yok" mu "adres bilinmiyor"
    // mu ayrımı burada ZORLANMAZ, sessizce atlanır.
    const address = unquote(addrToken.value);
    if (address.length > 0) {
      fields.push(tokenField(data, paramsOffset, addrToken, 'pdp-address', 'PDP adresi', address));
    }
  }

  const dCompToken = tokens[4];
  if (dCompToken !== undefined) {
    const dComp = Number(dCompToken.value.trim());
    fields.push(
      tokenField(data, paramsOffset, dCompToken, 'data-compression', 'Veri sıkıştırma', dComp, {
        ...(DATA_COMPRESSION_NAMES[dComp] === undefined ? {} : { physicalValue: DATA_COMPRESSION_NAMES[dComp] }),
      }),
    );
  }

  const hCompToken = tokens[5];
  if (hCompToken !== undefined) {
    const hComp = Number(hCompToken.value.trim());
    fields.push(
      tokenField(data, paramsOffset, hCompToken, 'header-compression', 'Başlık sıkıştırma', hComp, {
        ...(HEADER_COMPRESSION_NAMES[hComp] === undefined ? {} : { physicalValue: HEADER_COMPRESSION_NAMES[hComp] }),
      }),
    );
  }

  if (tokens.length > 6) {
    const tailStart = tokens[6];
    const tailEnd = tokens[tokens.length - 1];
    if (tailStart !== undefined && tailEnd !== undefined) {
      // Trailing parametreler (`<IPv4AddrAlloc>`, `<P-CSCF_discovery>`…) sabit
      // isim/sayıda DEĞİL, satıcı/sürüme göre değişir — yalnız ilk 6 alan
      // (cid..h_comp) sabit şema sayılır, gerisi ham+uyarı.
      const start = paramsOffset + tailStart.offset;
      const end = paramsOffset + tailEnd.offset + tailEnd.value.length;
      fields.push({
        id: 'additional-parameters',
        name: 'Ek parametreler (üretici/sürüme bağlı, çözülmedi)',
        offset: start,
        length: end - start,
        rawBytes: data.slice(start, end),
        rawValue: new TextDecoder().decode(data.slice(start, end)),
        valid: true,
        warnings: [WARN_CGDCONT_TAIL_NOT_DECODED],
      });
    }
  }

  return fields;
}

// ── AT+CPIN? — PIN Status ─────────────────────────────────────────────────

/** TS 27.007 §8.3 — 16 kod, tamamı. Pek çoğu (PH-FSIM*) sahada neredeyse hiç görülmez ama spec-complete kabul edilir. */
const SIM_PIN_STATUS_CODES = new Set([
  'READY',
  'SIM PIN',
  'SIM PUK',
  'SIM PIN2',
  'SIM PUK2',
  'PH-SIM PIN',
  'PH-FSIM PIN',
  'PH-FSIM PUK',
  'PH-NET PIN',
  'PH-NET PUK',
  'PH-NETSUB PIN',
  'PH-NETSUB PUK',
  'PH-SP PIN',
  'PH-SP PUK',
  'PH-CORP PIN',
  'PH-CORP PUK',
]);

function decodeCpin(tokens: ParamToken[], data: Uint8Array, paramsOffset: number): ParsedField[] {
  const codeToken = tokens[0];
  if (codeToken === undefined) return [];
  const code = codeToken.value.trim();
  return [
    tokenField(data, paramsOffset, codeToken, 'pin-status', 'SIM PIN durumu', code, {
      warnings: SIM_PIN_STATUS_CODES.has(code) ? [] : [WARN_CPIN_UNRECOGNIZED_CODE],
    }),
  ];
}

// ── AT+CGSN=1 — Serial Number (prefiksli form, KESİN IMEI) ───────────────

function decodeCgsnPrefixed(tokens: ParamToken[], data: Uint8Array, paramsOffset: number): ParsedField[] {
  const snToken = tokens[0];
  if (snToken === undefined) return [];
  return [
    tokenField(data, paramsOffset, snToken, 'serial-number', 'Seri numarası (IMEI)', unquote(snToken.value), {
      warnings: [WARN_SENSITIVE_EXPORT_VALUE],
    }),
  ];
}

// ── AT+CCLK? — Real-Time Clock ────────────────────────────────────────────

/** `"yy/MM/dd,hh:mm:ss±zz"` — sabit genişlikli, spec'in kendi karakter sayımı. */
const CCLK_PATTERN = /^(\d{2})\/(\d{2})\/(\d{2}),(\d{2}):(\d{2}):(\d{2})([+-]\d{1,3})?$/;

function decodeCclk(tokens: ParamToken[], data: Uint8Array, paramsOffset: number): ParsedField[] {
  const raw = tokens[0];
  if (raw === undefined) return [];
  const text = unquote(raw.value);
  const quoteOpenIndex = raw.value.indexOf('"');
  const innerOffset = paramsOffset + raw.offset + (quoteOpenIndex === -1 ? 0 : quoteOpenIndex + 1);

  const match = CCLK_PATTERN.exec(text);
  if (match === null) {
    return [
      {
        id: 'timestamp-raw',
        name: 'Zaman damgası (ham, biçim tanınmadı)',
        offset: innerOffset,
        length: text.length,
        rawBytes: data.slice(innerOffset, innerOffset + text.length),
        rawValue: text,
        valid: false,
        warnings: [],
      },
    ];
  }

  const [, yy, mm, dd, hh, min, ss, tz] = match;
  const fields: ParsedField[] = [
    {
      id: 'date',
      name: 'Tarih (yy/MM/dd)',
      offset: innerOffset,
      length: 8,
      rawBytes: data.slice(innerOffset, innerOffset + 8),
      rawValue: `${yy}/${mm}/${dd}`,
      // İki haneli yıl yüzyıl bilgisi taşımaz (spec'in kendi tanımı da
      // çözmüyor) — bu araç GÜNCEL cihazlar için var, 20xx varsayımı bilinçli.
      // 1990'larda üretilmiş bir modem hedef kitle değil.
      physicalValue: `20${yy}-${mm}-${dd}`,
      valid: true,
      warnings: [],
    },
    {
      id: 'time',
      name: 'Saat (hh:mm:ss)',
      offset: innerOffset + 9,
      length: 8,
      rawBytes: data.slice(innerOffset + 9, innerOffset + 17),
      rawValue: `${hh}:${min}:${ss}`,
      valid: true,
      warnings: [],
    },
  ];

  if (tz !== undefined) {
    fields.push({
      id: 'timezone-offset',
      name: 'Saat dilimi',
      offset: innerOffset + 17,
      length: tz.length,
      rawBytes: data.slice(innerOffset + 17, innerOffset + 17 + tz.length),
      rawValue: tz,
      // KRİTİK GOTCHA: değer ÇEYREK SAAT biriminde, saat DEĞİL — spec'in
      // kendi örneği "+08" yazıp GMT+2 diyor (94/05/06,22:10:00+08 → +2 saat).
      // "+08" dört saat sanmak sessiz-yanlış zaman damgası üretir.
      physicalValue: Number(tz) / 4,
      unit: 'h',
      valid: true,
      warnings: [],
    });
  }

  return fields;
}

// ── Dispatch tablosu ───────────────────────────────────────────────────

type CommandDecoder = (tokens: ParamToken[], data: Uint8Array, paramsOffset: number) => ParsedField[];

const LTE_MODEM_COMMAND_DECODERS: ReadonlyMap<string, CommandDecoder> = new Map([
  ['CSQ', decodeCsq],
  ['COPS', decodeCops],
  ['CREG', (tokens, data, offset) => decodeRegistrationStatus('lac', tokens, data, offset)],
  ['CEREG', (tokens, data, offset) => decodeRegistrationStatus('tac', tokens, data, offset)],
  ['CGATT', decodeCgatt],
  ['CGDCONT', decodeCgdcont],
  ['CPIN', decodeCpin],
  ['CGSN', decodeCgsnPrefixed],
  ['CCLK', decodeCclk],
]);

/** `AT+CIMI` VE çıplak `AT+CGSN` — ikisi de öneksiz salt rakam dizisi döndürür. */
const BARE_NUMERIC_IDENTIFIER_PATTERN = /^\d{5,15}$/;

function enrichFrame(frame: ParsedFrame, data: Uint8Array): ParsedFrame {
  const kind = frame.fields.find((field) => field.id === 'kind')?.rawValue;
  const extraFields: ParsedField[] = [];

  if (kind === 'information') {
    const prefixValue = frame.fields.find((field) => field.id === 'prefix')?.rawValue;
    const parametersField = frame.fields.find((field) => field.id === 'parameters');
    const commandName = typeof prefixValue === 'string' && prefixValue.startsWith('+') ? prefixValue.slice(1).toUpperCase() : undefined;
    const decoder = commandName === undefined ? undefined : LTE_MODEM_COMMAND_DECODERS.get(commandName);
    if (decoder !== undefined) {
      const paramsText = typeof parametersField?.rawValue === 'string' ? parametersField.rawValue : '';
      const paramsOffset = parametersField?.offset ?? 0;
      extraFields.push(...decoder(splitParameterTokens(paramsText), data, paramsOffset));
    }
  } else if (kind === 'text') {
    const textValue = frame.fields.find((field) => field.id === 'text')?.rawValue;
    const text = typeof textValue === 'string' ? textValue : '';
    if (BARE_NUMERIC_IDENTIFIER_PATTERN.test(text)) {
      extraFields.push({
        id: 'numeric-identifier',
        name: 'Sayısal kimlik (IMSI ya da IMEI/seri no — belirsiz)',
        offset: 0,
        length: data.length,
        rawBytes: data,
        rawValue: text,
        valid: true,
        warnings: [WARN_BARE_IDENTIFIER_AMBIGUOUS, WARN_SENSITIVE_EXPORT_VALUE],
      });
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

export const lteModemAtParser: ProtocolParser = {
  protocolId: PROTOCOL_ID,
  displayName: PROTOCOL_DISPLAY_NAME,

  canParse(data: Uint8Array): boolean {
    return atCommandsParser.canParse(data);
  },

  parse(data: Uint8Array, context?: ParseContext): ParseResult {
    const base = atCommandsParser.parse(data, context);
    if (!base.success) return base;
    return { ...base, frame: enrichFrame(base.frame, data) };
  },
};

// ── Privacy Masking on Export ─────────────────────────────────────────────

/**
 * Kimlik değerini (IMEI/IMSI) dışa aktarım için maskeler: yalnız son 4 hane
 * görünür kalır. Katalogdaki "Privacy Masking on Export" vaadinin motoru —
 * bağlantısı YOK, dosya başı yorumunda gerekçesi var (jenerik export ham
 * bayt üzerinden çalışıyor, protokol alanı bilmiyor).
 */
export function maskSensitiveIdentifier(value: string): string {
  const digitsOnly = value.replace(/\D/g, '');
  if (digitsOnly.length <= 4) return '•'.repeat(digitsOnly.length);
  return '•'.repeat(digitsOnly.length - 4) + digitsOnly.slice(-4);
}

// ── Cellular Initialization Dashboard ─────────────────────────────────────

export interface CellularInitializationSnapshot {
  /** Yalnız CGSN'in PREFİKSLİ formundan (kesin IMEI). */
  readonly imei?: string;
  /** Bare CIMI/CGSN yanıtı — IMEI mi IMSI mi tek başına belirlenemez. */
  readonly numericIdentifierCandidate?: string;
  readonly simStatus?: string;
  readonly operatorName?: string;
  readonly operatorSelectionMode?: string;
  readonly accessTechnology?: string;
  readonly registrationStatus?: string;
  readonly pdpAddress?: string;
}

export interface CellularInitializationState {
  readonly snapshot: CellularInitializationSnapshot;
  ingest(frame: ParsedFrame): void;
  reset(): void;
}

function fieldValue(frame: ParsedFrame, id: string): string | undefined {
  const field = frame.fields.find((candidate) => candidate.id === id);
  const value = field?.physicalValue ?? field?.rawValue;
  if (value === undefined) return undefined;
  return typeof value === 'string' ? value : String(value);
}

/**
 * Cellular Initialization Dashboard — `features/live-monitor/monitorIngestor.ts`
 * (`MonitorIngestor`) ile AYNI desen: React'ten bağımsız, kapanışlı, saf
 * durum biriktirici (brief karar 4: parser saf kalır, biriktirme DIŞARIDA).
 * Girdisi `lteModemAtParser.parse()`in ürettiği `ParsedFrame`lerdir; `at-commands`
 * oturum makinesini (echo/URC ayrımı) hiç bilmez — yalnız "bu çerçevede
 * tanıdık bir alan varsa oku" yapar.
 *
 * Katalogun vaat ettiği "model, firmware, band" alanları YOK — kaynak
 * komutları (ATI/CGMM/CGMR, vendor-özel bant sorguları) brief madde 8'in
 * listesinde değil, uydurulmadı.
 */
export function createCellularInitializationState(): CellularInitializationState {
  let snapshot: CellularInitializationSnapshot = {};

  return {
    get snapshot() {
      return snapshot;
    },
    ingest(frame: ParsedFrame): void {
      // Yalnız YENİ değer bulunan alanlar güncellenir — bulunmayanlar önceki
      // snapshot'tan devralınır (tek `AT+CGSN` yanıtı `AT+CSQ`in birikmiş
      // sonucunu silmemeli).
      snapshot = {
        imei: fieldValue(frame, 'serial-number') ?? snapshot.imei,
        numericIdentifierCandidate: fieldValue(frame, 'numeric-identifier') ?? snapshot.numericIdentifierCandidate,
        simStatus: fieldValue(frame, 'pin-status') ?? snapshot.simStatus,
        operatorName: fieldValue(frame, 'cops-operator') ?? snapshot.operatorName,
        operatorSelectionMode: fieldValue(frame, 'cops-mode') ?? snapshot.operatorSelectionMode,
        accessTechnology: fieldValue(frame, 'access-technology') ?? snapshot.accessTechnology,
        registrationStatus: fieldValue(frame, 'registration-status') ?? snapshot.registrationStatus,
        pdpAddress: fieldValue(frame, 'pdp-address') ?? snapshot.pdpAddress,
      };
    },
    reset(): void {
      snapshot = {};
    },
  };
}

// ── Örnekler ───────────────────────────────────────────────────────────

function asciiBytes(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

const EXAMPLE_FRAMES: ExampleFrame[] = [
  {
    id: 'csq',
    name: `${TRANSLATION_KEY_PREFIX}.example.csq.name`,
    bytes: asciiBytes('+CSQ: 20,99\r\n'),
    description: `${TRANSLATION_KEY_PREFIX}.example.csq.description`,
    expectedValid: true,
  },
  {
    id: 'cops-alphanumeric',
    name: `${TRANSLATION_KEY_PREFIX}.example.copsAlphanumeric.name`,
    bytes: asciiBytes('+COPS: 0,0,"Example Operator",7\r\n'),
    description: `${TRANSLATION_KEY_PREFIX}.example.copsAlphanumeric.description`,
    expectedValid: true,
  },
  {
    id: 'cops-numeric-act-collision',
    // MCC 901: ITU'nun uluslararası/uydu ortak kullanım aralığı, gerçek bir
    // ülkeye atanmamış — gösterim amaçlı bilinçli seçildi. AcT=8 satıcı
    // çakışma uyarısını da gösterir (SIMCom'da CDMA/HDR, spec'te EC-GSM-IoT).
    name: `${TRANSLATION_KEY_PREFIX}.example.copsNumericActCollision.name`,
    bytes: asciiBytes('+COPS: 1,2,"90170",8\r\n'),
    description: `${TRANSLATION_KEY_PREFIX}.example.copsNumericActCollision.description`,
    expectedValid: true,
  },
  {
    id: 'creg-registered',
    name: `${TRANSLATION_KEY_PREFIX}.example.cregRegistered.name`,
    bytes: asciiBytes('+CREG: 2,1,"1A2D","0001A2B3",7\r\n'),
    description: `${TRANSLATION_KEY_PREFIX}.example.cregRegistered.description`,
    expectedValid: true,
  },
  {
    id: 'cereg-emergency',
    name: `${TRANSLATION_KEY_PREFIX}.example.ceregEmergency.name`,
    bytes: asciiBytes('+CEREG: 2,8,"1A2D","0001A2B3",9\r\n'),
    description: `${TRANSLATION_KEY_PREFIX}.example.ceregEmergency.description`,
    expectedValid: true,
  },
  {
    id: 'cgatt-attached',
    name: `${TRANSLATION_KEY_PREFIX}.example.cgattAttached.name`,
    bytes: asciiBytes('+CGATT: 1\r\n'),
    description: `${TRANSLATION_KEY_PREFIX}.example.cgattAttached.description`,
    expectedValid: true,
  },
  {
    id: 'cgdcont-full',
    name: `${TRANSLATION_KEY_PREFIX}.example.cgdcontFull.name`,
    bytes: asciiBytes('+CGDCONT: 1,"IP","example.apn","",0,0\r\n'),
    description: `${TRANSLATION_KEY_PREFIX}.example.cgdcontFull.description`,
    expectedValid: true,
  },
  {
    id: 'cimi-bare',
    // Quectel EC25&EC21 AT Commands Manual'ın kendi doğrulama örneği — gerçek
    // bir abonenin verisi değil, satıcının yayınladığı kanonik doküman örneği.
    name: `${TRANSLATION_KEY_PREFIX}.example.cimiBare.name`,
    bytes: asciiBytes('460023210226023\r\n'),
    description: `${TRANSLATION_KEY_PREFIX}.example.cimiBare.description`,
    expectedValid: true,
  },
  {
    id: 'cgsn-bare',
    // 3GPP TS 27.007'nin kendi §5.4 doğrulanmış örneği.
    name: `${TRANSLATION_KEY_PREFIX}.example.cgsnBare.name`,
    bytes: asciiBytes('490154203237518\r\n'),
    description: `${TRANSLATION_KEY_PREFIX}.example.cgsnBare.description`,
    expectedValid: true,
  },
  {
    id: 'cgsn-prefixed',
    name: `${TRANSLATION_KEY_PREFIX}.example.cgsnPrefixed.name`,
    bytes: asciiBytes('+CGSN: "490154203237518"\r\n'),
    description: `${TRANSLATION_KEY_PREFIX}.example.cgsnPrefixed.description`,
    expectedValid: true,
  },
  {
    id: 'cclk',
    // Formül TS 27.007'nin kendi örneğiyle doğrulandı (94/05/06,22:10:00+08 →
    // GMT+2, bkz. lteModemAt.test.ts) — burada güncel bir yıl kullanılıyor,
    // "+08" yine +2 saat demek (çeyrek saat gotcha'sı yıldan bağımsız).
    name: `${TRANSLATION_KEY_PREFIX}.example.cclk.name`,
    bytes: asciiBytes('+CCLK: "26/08/20,14:30:00+08"\r\n'),
    description: `${TRANSLATION_KEY_PREFIX}.example.cclk.description`,
    expectedValid: true,
  },
  {
    id: 'cpin-ready',
    name: `${TRANSLATION_KEY_PREFIX}.example.cpinReady.name`,
    bytes: asciiBytes('+CPIN: READY\r\n'),
    description: `${TRANSLATION_KEY_PREFIX}.example.cpinReady.description`,
    expectedValid: true,
  },
  {
    id: 'cpin-locked',
    name: `${TRANSLATION_KEY_PREFIX}.example.cpinLocked.name`,
    bytes: asciiBytes('+CPIN: SIM PIN\r\n'),
    description: `${TRANSLATION_KEY_PREFIX}.example.cpinLocked.description`,
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

export const lteModemAtPlugin: ProtocolPlugin = {
  id: PROTOCOL_ID,
  name: PROTOCOL_DISPLAY_NAME,
  category: 'wireless-iot',
  parser: lteModemAtParser,
  documentation: {
    summary: `${TRANSLATION_KEY_PREFIX}.documentation.summary`,
    layer: 'application',
    references: [
      {
        title: '3GPP TS 27.007 — AT command set for User Equipment (UE)',
        url: 'https://www.etsi.org/deliver/etsi_TS/127000_127099/127007/18.08.00_60/ts_127007v180800p.pdf',
      },
      {
        title: 'Quectel EC25&EC21 AT Commands Manual V1.3',
        url: 'https://quectel.com/content/uploads/2021/03/Quectel_EC25EC21_AT_Commands_Manual_V1.3.pdf',
      },
    ],
  },
  exampleFrames: EXAMPLE_FRAMES,
};
