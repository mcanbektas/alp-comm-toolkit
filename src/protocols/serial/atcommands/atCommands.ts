/**
 * ITU-T V.250 / 3GPP TS 27.007 AT komut ailesi — JENERİK çerçeveleme motoru.
 *
 * Bu dosya belirli bir AT LEHÇESİNİ (hücresel sözlük, GNSS sarmalı) çözmez —
 * hangi lehçe olursa olsun ortak olan ÜÇ şeyi çözer: genişletilmiş komut satırı
 * sözdizimi (`AT+NAME`, `?`, `=?`, `=<params>`), bilgi yanıtı satırı
 * (`+NAME: params`) ve final result code (`OK`/`ERROR`/`CONNECT`/
 * `+CME ERROR: <n>`/`+CMS ERROR: <n>` …). Hücresel sözlük (CSQ/COPS/CREG/…)
 * `lte-modem-at`in işi (dalga 9c, brief karar 3'ün öngördüğü zincir).
 *
 * ── TEK SATIR = TEK GİRDİ ────────────────────────────────────────────────
 * `parse()` TAM BİR SATIR alır (bkz. `obd.ts`/`udp.ts` emsali: parser saf
 * kalır, akıştan satır kesmek `protocol-core/framing`in işi — brief karar 4).
 * Satır sonu SABİT `\r\n` VARSAYILMAZ: V.250 S3/S4 register'ları bunu
 * SEÇİLEBİLİR kılar — bu yüzden `createAtLineExtractor` parametriktir ve
 * `parseAtCommandLine` da satırı yalnız SONDAKİ CR/LF'den arındırır, baştaki
 * hiçbir karakteri kırpmaz (bayt-ofset hizası bu sayede tek bir `.trim()`
 * çağrısına muhtaç kalmadan korunur).
 *
 * ── TEMEL SÖZDİZİMİ vs GENİŞLETİLMİŞ SÖZDİZİMİ ──────────────────────────
 * V.250 iki komut ailesini tanır: TEMEL (`ATD`, `ATA`, `ATH`, `ATZ` — tek
 * harf, `+` yok) ve GENİŞLETİLMİŞ (`AT+NAME`, TS 27.007'nin tamamı bunun
 * üstüne kurulu). Bu motor yalnız GENİŞLETİLMİŞ sözdizimini adlandırır/
 * ayrıştırır (`command-name`/`action`/`parameters` alanları) — temel
 * sözdizimi `hayes-command-set`in işi (brief 9b madde 7, henüz karar
 * bekliyor — bugün cevapsız bırakıldı, aşağıya bakılsın). Temel bir komut
 * (`ATD`, `ATZ`…) hâlâ `kind: 'command'` sayılır, gövdesi HAM bırakılır —
 * uydurulmuş bir ayrıştırma yerine dürüst bir sınır.
 *
 * ── OTURUM DİZİLEYİCİ (createAtCommandSession) AYRI, SAF DEĞİL ─────────
 * `atCommandsParser` (bu dosyanın `ProtocolParser`ı) TEK satırı saf çözer.
 * "URC mü yanıt mı" ve IDLE→COMMAND_SENT→WAIT_RESPONSE→FINAL_RESULT durumu
 * BİRDEN ÇOK satırı biriktirir — bu yüzden `ProtocolParser` sözleşmesine
 * SOKULMAZ (brief karar 4: parser tek transaction'ı saf çözer, biriktirme
 * ayrı bir katmanda yaşar — `streams/streamBuffer.ts`'in `createStreamBuffer`ı
 * ile AYNI desen: kapanışlı, durum taşıyan ayrı bir fabrika). Fark: burada
 * biriktirilen şey bayt değil, zaten çözülmüş `ParsedFrame`lerdir.
 *
 * ── CME/CMS HATA KODLARI: SAYI YORUMLANMAZ ──────────────────────────────
 * `+CME ERROR: 10` yapısal olarak çözülür (numeric mi verbose mu, kodun
 * kendisi) ama 10'un "SIM not inserted" anlamına geldiği bir tabloya
 * BAĞLANMAZ — TS 27.007 Annex'teki ~100+150 kodluk tablo bu dalganın
 * kapsamı dışında (obd.ts'in PID tablosu uyarısıyla aynı gerekçe: spec'te
 * doğrulanmamış bir eşlemeyi uydurmak, ham bırakmaktan kötüdür).
 *
 * ── "+++" GUARD-TIME BU DOSYADA YOK ─────────────────────────────────────
 * Kaçış dizisi tespiti `hayes-command-set`in aracı (`Escape Sequence
 * Guard-Time Analyzer`, at-commands'ın tools listesinde YOK) — burada hiç
 * ele alınmaz, karıştırılmasın.
 */

import { createRawFrame } from '@/protocol-core/types';
import type {
  ExampleFrame,
  FrameDirection,
  ParseContext,
  ParseResult,
  ParsedField,
  ParsedFrame,
  ProtocolParser,
  ProtocolPlugin,
  ProtocolWarning,
} from '@/protocol-core/types';
import { createExtractorFromConfig } from '@/protocol-core';
import type { FrameExtractor } from '@/protocol-core';

const PROTOCOL_ID = 'at-commands';
/** Protokol adı veridir, çeviriye girmez (CLAUDE.md). */
const PROTOCOL_DISPLAY_NAME = 'AT Commands';

const TRANSLATION_KEY_PREFIX = 'protocol.atCommands';

const ERROR_EMPTY_LINE = `${TRANSLATION_KEY_PREFIX}.error.emptyLine`;
const ERROR_FRAME_TOO_LONG = `${TRANSLATION_KEY_PREFIX}.error.frameTooLong`;
const ERROR_ABORTED = `${TRANSLATION_KEY_PREFIX}.error.aborted`;

const WARN_MIXED_CASE_PREFIX = `${TRANSLATION_KEY_PREFIX}.warning.mixedCasePrefix`;

function toProtocolWarning(key: string): ProtocolWarning {
  return { code: key, message: key };
}

export type AtLineKind = 'command' | 'information' | 'final-result-code' | 'prompt' | 'text';

export type AtCommandAction = 'execute' | 'read' | 'test' | 'set';

/** V.250 §5.7.1 (Tablo 1) ortak sözcük dağarcığı — sabit metin, parametre taşımaz. */
const BARE_FINAL_RESULT_CODES = new Set([
  'OK',
  'ERROR',
  'RING',
  'NO CARRIER',
  'NO DIALTONE',
  'NO ANSWER',
  'BUSY',
]);

/**
 * V.250 §5.7.1 (Tablo 1) — ATV0 (numeric mode) aynı result code'ları sıfır
 * dolgusuz küçük tamsayı olarak basar (§6.2.6 Tablo 3: sayısal `<kod><cr>`,
 * verbose `<cr><lf><kod><cr><lf>` — çerçeveleme farkı bu dosyada zaten
 * satır-sonu arındırmasıyla eriyor, ayrıca ele alınmaz). 5 KASITLI OLARAK
 * YOK: spec'in kendi ifadesiyle "manufacturer-specific" (`CONNECT <text>`
 * için ayrılmış), evrensel bir sözcüğe bağlanmaz.
 */
const NUMERIC_RESULT_CODES: Readonly<Record<number, string>> = {
  0: 'OK',
  1: 'CONNECT',
  2: 'RING',
  3: 'NO CARRIER',
  4: 'ERROR',
  6: 'NO DIALTONE',
  7: 'BUSY',
  8: 'NO ANSWER',
};
/**
 * Sıfır dolgusuz `0`-`99`: `"0".."9"`, `"10".."99"`. Sıfır dolgulu üç haneli
 * metin (`"013"` gibi) BİLEREK dışarıda bırakılır — o, hayes-command-set'in
 * S-register OKUMA yanıtı biçimidir (V.250 §5.3.2, her zaman üç hane), farklı
 * bir sözleşme; ayrım burada dolgu varlığına göre yapılıyor.
 */
const NUMERIC_RESULT_CODE_PATTERN = /^(0|[1-9]\d?)$/;

/** TS 27.007 §9.2: `AT+CMEE=1` sayısal, `=2` metin — ikisi de aynı sözdizimi. */
const CME_ERROR_PATTERN = /^\+CME ERROR: ?(.+)$/;
const CMS_ERROR_PATTERN = /^\+CMS ERROR: ?(.+)$/;
/** `CONNECT` bağlantı hızıyla birlikte de gelebilir (`CONNECT 115200`). */
const CONNECT_PATTERN = /^CONNECT(?: (.+))?$/;
/** TS 27.007 §5.4 genişletilmiş sözdizimi: `+NAME` ardından `?`/`=?`/`=<params>`/hiçbiri. */
const EXTENDED_COMMAND_PATTERN = /^\+([A-Z][A-Z0-9]*)(\?|=\?|=(.*))?$/i;

function kindField(data: Uint8Array, kind: AtLineKind): ParsedField {
  return {
    id: 'kind',
    name: 'Line Kind',
    offset: 0,
    length: data.length,
    rawBytes: data,
    rawValue: kind,
    valid: true,
    warnings: [],
  };
}

interface DecodedLine {
  fields: ParsedField[];
  warnings: ProtocolWarning[];
}

function decodeFinalResultWithCode(
  data: Uint8Array,
  line: string,
  codeName: string,
  codeText: string,
  fieldLabel: string,
): DecodedLine {
  const fields: ParsedField[] = [
    kindField(data, 'final-result-code'),
    {
      id: 'result-code',
      name: 'Final Result Code',
      offset: 0,
      length: codeName.length,
      rawBytes: data.slice(0, codeName.length),
      rawValue: codeName,
      valid: true,
      warnings: [],
    },
  ];

  const codeOffset = line.indexOf(codeText, codeName.length);
  const trimmedCode = codeText.trim();
  const isNumeric = /^\d+$/.test(trimmedCode);
  if (codeOffset !== -1) {
    fields.push({
      id: 'error-code',
      name: fieldLabel,
      offset: codeOffset,
      length: codeText.length,
      rawBytes: data.slice(codeOffset, codeOffset + codeText.length),
      rawValue: isNumeric ? Number(trimmedCode) : trimmedCode,
      valid: true,
      warnings: [],
    });
  }

  return { fields, warnings: [] };
}

/**
 * Tek bir AT satırını sınıflandırır ve alanlarına ayırır. `line` çağıranın
 * `\r`/`\n` arındırdığı, ama başındaki hiçbir karakteri kırpmadığı metindir —
 * bu yüzden `line.indexOf(...)` sonuçları doğrudan `data` bayt ofseti olarak
 * kullanılabilir (ekstra bir "kırpılan önek uzunluğu" muhasebesi gerekmez).
 */
function decodeLine(data: Uint8Array, line: string): DecodedLine {
  if (line.length === 0) {
    return { fields: [kindField(data, 'text')], warnings: [] };
  }

  if (line === '>') {
    return {
      fields: [
        kindField(data, 'prompt'),
        {
          id: 'prompt',
          name: 'Data Entry Prompt',
          offset: 0,
          length: data.length,
          rawBytes: data,
          rawValue: '>',
          valid: true,
          warnings: [],
        },
      ],
      warnings: [],
    };
  }

  const cmeMatch = CME_ERROR_PATTERN.exec(line);
  if (cmeMatch !== null) {
    return decodeFinalResultWithCode(data, line, '+CME ERROR', cmeMatch[1] ?? '', 'CME Error Code');
  }
  const cmsMatch = CMS_ERROR_PATTERN.exec(line);
  if (cmsMatch !== null) {
    return decodeFinalResultWithCode(data, line, '+CMS ERROR', cmsMatch[1] ?? '', 'CMS Error Code');
  }

  if (BARE_FINAL_RESULT_CODES.has(line)) {
    return {
      fields: [
        kindField(data, 'final-result-code'),
        {
          id: 'result-code',
          name: 'Final Result Code',
          offset: 0,
          length: data.length,
          rawBytes: data,
          rawValue: line,
          valid: true,
          warnings: [],
        },
      ],
      warnings: [],
    };
  }

  const numericResultMatch = NUMERIC_RESULT_CODE_PATTERN.exec(line);
  if (numericResultMatch !== null) {
    const code = Number(numericResultMatch[1]);
    return {
      fields: [
        kindField(data, 'final-result-code'),
        {
          id: 'result-code',
          name: 'Final Result Code',
          offset: 0,
          length: data.length,
          rawBytes: data,
          rawValue: code,
          // Bilinmeyen sayı (satıcı uzantısı, ör. Telit'in 10-23'ü) hâlâ
          // final-result-code sayılır — yapı çözülür, sözcük UYDURULMAZ.
          ...(NUMERIC_RESULT_CODES[code] === undefined ? {} : { physicalValue: NUMERIC_RESULT_CODES[code] }),
          valid: true,
          warnings: [],
        },
      ],
      warnings: [],
    };
  }

  const connectMatch = CONNECT_PATTERN.exec(line);
  if (connectMatch !== null) {
    const fields: ParsedField[] = [
      kindField(data, 'final-result-code'),
      {
        id: 'result-code',
        name: 'Final Result Code',
        offset: 0,
        length: 'CONNECT'.length,
        rawBytes: data.slice(0, 'CONNECT'.length),
        rawValue: 'CONNECT',
        valid: true,
        warnings: [],
      },
    ];
    const rateText = connectMatch[1];
    if (rateText !== undefined && rateText.length > 0) {
      const rateOffset = line.indexOf(rateText, 'CONNECT'.length);
      const rateNumber = Number(rateText);
      const isNumericRate = rateText.trim().length > 0 && Number.isFinite(rateNumber);
      fields.push({
        id: 'connect-rate',
        name: 'Connection Rate',
        offset: rateOffset === -1 ? 'CONNECT '.length : rateOffset,
        length: rateText.length,
        rawBytes: data.slice(
          rateOffset === -1 ? 'CONNECT '.length : rateOffset,
          (rateOffset === -1 ? 'CONNECT '.length : rateOffset) + rateText.length,
        ),
        rawValue: isNumericRate ? rateNumber : rateText,
        // Metindeki sayı zaten mühendislik biriminde (bit/s) — ayrı bir
        // ham↔fiziksel dönüşüm formülü yok, ikisi aynı değeri taşır.
        physicalValue: isNumericRate ? rateNumber : undefined,
        unit: isNumericRate ? 'bit/s' : undefined,
        valid: true,
        warnings: [],
      });
    }
    return { fields, warnings: [] };
  }

  if (line.startsWith('+')) {
    // Bilgi yanıtı / URC: `+NAME: params` ya da `+NAME params`. Hangisi
    // olduğu (beklenen mi istemsiz mi) OTURUM bağlamı ister — bu fonksiyon
    // yalnız YAPIYI çözer, bkz. `createAtCommandSession`.
    const colonIndex = line.indexOf(':');
    const spaceIndex = line.indexOf(' ');
    const splitIndex =
      colonIndex === -1 ? spaceIndex : spaceIndex === -1 ? colonIndex : Math.min(colonIndex, spaceIndex);
    const prefix = splitIndex === -1 ? line : line.slice(0, splitIndex);

    const fields: ParsedField[] = [
      kindField(data, 'information'),
      {
        id: 'prefix',
        name: 'Response Prefix',
        offset: 0,
        length: prefix.length,
        rawBytes: data.slice(0, prefix.length),
        rawValue: prefix,
        valid: true,
        warnings: [],
      },
    ];

    if (splitIndex !== -1) {
      const afterSplit = line[splitIndex] === ':' ? splitIndex + 1 : splitIndex;
      const params = line.slice(afterSplit).trim();
      if (params.length > 0) {
        const paramsOffset = line.indexOf(params, afterSplit);
        fields.push({
          id: 'parameters',
          name: 'Parameters',
          offset: paramsOffset === -1 ? afterSplit : paramsOffset,
          length: params.length,
          rawBytes: data.slice(paramsOffset === -1 ? afterSplit : paramsOffset, (paramsOffset === -1 ? afterSplit : paramsOffset) + params.length),
          rawValue: params,
          valid: true,
          warnings: [],
        });
      }
    }

    return { fields, warnings: [] };
  }

  const prefixCandidate = line.slice(0, 2);
  if (prefixCandidate.toUpperCase() === 'AT') {
    const mixedCase = prefixCandidate !== 'AT' && prefixCandidate !== 'at';
    const fields: ParsedField[] = [
      kindField(data, 'command'),
      {
        id: 'prefix',
        name: 'AT Prefix',
        offset: 0,
        length: 2,
        rawBytes: data.slice(0, 2),
        rawValue: prefixCandidate,
        valid: true,
        warnings: mixedCase ? [WARN_MIXED_CASE_PREFIX] : [],
      },
    ];
    const warnings: ProtocolWarning[] = mixedCase ? [toProtocolWarning(WARN_MIXED_CASE_PREFIX)] : [];

    const body = line.slice(2);
    fields.push({
      id: 'body',
      name: 'Command Body',
      offset: 2,
      length: body.length,
      rawBytes: data.slice(2, 2 + body.length),
      rawValue: body,
      valid: true,
      warnings: [],
    });

    if (body.startsWith('+')) {
      const extendedMatch = EXTENDED_COMMAND_PATTERN.exec(body);
      if (extendedMatch !== null) {
        const nameGroup = extendedMatch[1] ?? '';
        const suffixGroup = extendedMatch[2];
        const nameOffset = 2 + 1; // "AT" + "+"
        fields.push({
          id: 'command-name',
          name: 'Command Name',
          offset: nameOffset,
          length: nameGroup.length,
          rawBytes: data.slice(nameOffset, nameOffset + nameGroup.length),
          rawValue: nameGroup.toUpperCase(),
          valid: true,
          warnings: [],
        });

        let action: AtCommandAction;
        let parameters: string | undefined;
        if (suffixGroup === undefined) {
          action = 'execute';
        } else if (suffixGroup === '?') {
          action = 'read';
        } else if (suffixGroup === '=?') {
          action = 'test';
        } else {
          action = 'set';
          parameters = extendedMatch[3] ?? '';
        }

        const actionOffset = nameOffset + nameGroup.length;
        const actionLength = suffixGroup?.length ?? 0;
        fields.push({
          id: 'action',
          name: 'Command Action',
          offset: actionOffset,
          length: actionLength,
          rawBytes: data.slice(actionOffset, actionOffset + actionLength),
          rawValue: action,
          valid: true,
          warnings: [],
        });

        if (parameters !== undefined) {
          const parametersOffset = actionOffset + 1; // '=' işaretinden sonrası
          fields.push({
            id: 'parameters',
            name: 'Parameters',
            offset: parametersOffset,
            length: parameters.length,
            rawBytes: data.slice(parametersOffset, parametersOffset + parameters.length),
            rawValue: parameters,
            valid: true,
            warnings: [],
          });
        }
      }
      // Eşleşmezse: '+' ile başlıyor ama genişletilmiş sözdizimine uymuyor —
      // gövde zaten ham olarak eklendi, ek ayrıştırma yapılmaz (hata değil).
    }
    // Temel sözdizimi (ör. `ATD`, `ATZ`) ya da çıplak `AT`: gövde ham kalır,
    // dosya başı yorumunun gerekçesiyle — hayes-command-set'in işi.

    return { fields, warnings };
  }

  // Katalog/banner/üretici serbest metni — hiçbir bilinen kalıba uymuyor.
  return {
    fields: [
      kindField(data, 'text'),
      {
        id: 'text',
        name: 'Text',
        offset: 0,
        length: data.length,
        rawBytes: data,
        rawValue: line,
        valid: true,
        warnings: [],
      },
    ],
    warnings: [],
  };
}

interface AtLineParseOptions {
  timestamp?: number;
  direction?: FrameDirection;
  channel?: string;
  maxFrameLength?: number;
  signal?: AbortSignal;
}

function parseAtLine(data: Uint8Array, options: AtLineParseOptions): ParseResult {
  if (options.signal?.aborted === true) {
    return {
      success: false,
      error: { code: 'parser-timeout', message: ERROR_ABORTED },
      consumedBytes: 0,
      recoverable: false,
    };
  }

  if (data.length === 0) {
    return {
      success: false,
      error: { code: 'truncated-frame', message: ERROR_EMPTY_LINE, offset: 0, length: 0 },
      consumedBytes: 0,
      recoverable: true,
    };
  }

  const maxFrameLength = options.maxFrameLength;
  if (maxFrameLength !== undefined && data.length > maxFrameLength) {
    return {
      success: false,
      error: {
        code: 'frame-too-long',
        message: ERROR_FRAME_TOO_LONG,
        offset: maxFrameLength,
        length: data.length - maxFrameLength,
        details: { maxFrameLength, frameLength: data.length },
      },
      consumedBytes: 0,
      recoverable: false,
    };
  }

  // Yalnız SONDAKİ CR/LF arındırılır — baştaki hiçbir karakter kırpılmaz,
  // böylece `line` içindeki her indeks doğrudan `data` bayt ofsetidir.
  const line = new TextDecoder().decode(data).replace(/[\r\n]+$/, '');
  const { fields, warnings } = decodeLine(data, line);

  const rawFrame = createRawFrame(data, {
    ...(options.timestamp === undefined ? {} : { timestamp: options.timestamp }),
    ...(options.direction === undefined ? {} : { direction: options.direction }),
    ...(options.channel === undefined ? {} : { channel: options.channel }),
  });

  const frame: ParsedFrame = {
    protocol: PROTOCOL_ID,
    timestamp: rawFrame.timestamp,
    rawFrame,
    fields,
    valid: true,
    errors: [],
    warnings,
  };

  return { success: true, frame, consumedBytes: data.length };
}

function readContextOptions(context: ParseContext | undefined): AtLineParseOptions {
  const options: AtLineParseOptions = {};
  if (context?.timestamp !== undefined) options.timestamp = context.timestamp;
  if (context?.direction !== undefined) options.direction = context.direction;
  if (context?.channel !== undefined) options.channel = context.channel;
  if (context?.maxFrameLength !== undefined) options.maxFrameLength = context.maxFrameLength;
  if (context?.signal !== undefined) options.signal = context.signal;
  return options;
}

export function parseAtCommandLine(data: Uint8Array): ParseResult {
  return parseAtLine(data, {});
}

export const atCommandsParser: ProtocolParser = {
  protocolId: PROTOCOL_ID,
  displayName: PROTOCOL_DISPLAY_NAME,

  canParse(data: Uint8Array): boolean {
    return data.length > 0;
  },

  parse(data: Uint8Array, context?: ParseContext): ParseResult {
    return parseAtLine(data, readContextOptions(context));
  },
};

/** V.250 S3 (satır sonu, varsayılan CR=0x0D) / S4 (satır besleme, varsayılan LF=0x0A) SEÇİLEBİLİR. */
const DEFAULT_LINE_TERMINATOR: readonly number[] = [0x0d, 0x0a];

/**
 * Akıştan tek tek AT satırları kesen `FrameExtractor`. Varsayılan `\r\n`dir
 * ama SABİT DEĞİLDİR — bir modem yalnız `\r` (S4=0) kullanıyorsa çağıran
 * `createAtLineExtractor([0x0d])` verir (brief tuzağı: sabit `\r\n` varsayımı
 * sessiz-yanlış çerçeveleme üretir).
 */
export function createAtLineExtractor(terminator: readonly number[] = DEFAULT_LINE_TERMINATOR): FrameExtractor {
  return createExtractorFromConfig({ method: 'line-ending', endSequence: terminator });
}

// ── Oturum dizileyici ────────────────────────────────────────────────────

export const AT_SESSION_STATES = ['idle', 'command-sent', 'wait-response', 'final-result'] as const;
export type AtSessionState = (typeof AT_SESSION_STATES)[number];

export interface AtCommandTransaction {
  command: string;
  sentAt: number;
  responseLines: ParsedFrame[];
  finalResult: ParsedFrame;
  completedAt: number;
  durationMs: number;
}

export interface AtCommandSession {
  readonly state: AtSessionState;
  sendCommand(command: string, sentAt?: number): void;
  pushLine(data: Uint8Array, receivedAt?: number): ParseResult;
  onTransaction(listener: (transaction: AtCommandTransaction) => void): () => void;
  onUnsolicited(listener: (frame: ParsedFrame) => void): () => void;
  onPrompt(listener: (frame: ParsedFrame) => void): () => void;
  reset(): void;
}

function now(): number {
  return performance.timeOrigin + performance.now();
}

function lineKindOf(frame: ParsedFrame): AtLineKind | undefined {
  const value = frame.fields.find((field) => field.id === 'kind')?.rawValue;
  return typeof value === 'string' ? (value as AtLineKind) : undefined;
}

/**
 * IDLE→COMMAND_SENT→WAIT_RESPONSE→FINAL_RESULT durum makinesi + URC ayrımı.
 * `atCommandsParser`in ÜSTÜNDE, ondan BAĞIMSIZ bir kapanış — parser'ın kendisi
 * bunu bilmez (bkz. dosya başı, brief karar 4). Echo bastırma (`ATE0`) şeffaf
 * ele alınır: gönderilen komutla eşleşmeyen ilk satır echo değil, yanıtın
 * kendisi sayılır.
 */
export function createAtCommandSession(): AtCommandSession {
  let state: AtSessionState = 'idle';
  let pending: { command: string; sentAt: number; responseLines: ParsedFrame[] } | undefined;

  const transactionListeners = new Set<(transaction: AtCommandTransaction) => void>();
  const unsolicitedListeners = new Set<(frame: ParsedFrame) => void>();
  const promptListeners = new Set<(frame: ParsedFrame) => void>();

  function emitTransaction(finalResult: ParsedFrame, completedAt: number): void {
    if (pending === undefined) return;
    const transaction: AtCommandTransaction = {
      command: pending.command,
      sentAt: pending.sentAt,
      responseLines: pending.responseLines,
      finalResult,
      completedAt,
      durationMs: completedAt - pending.sentAt,
    };
    state = 'final-result';
    for (const listener of transactionListeners) listener(transaction);
    pending = undefined;
    state = 'idle';
  }

  return {
    get state() {
      return state;
    },

    sendCommand(command: string, sentAt: number = now()): void {
      pending = { command, sentAt, responseLines: [] };
      state = 'command-sent';
    },

    pushLine(data: Uint8Array, receivedAt: number = now()): ParseResult {
      const result = parseAtLine(data, { timestamp: receivedAt });
      if (!result.success) return result;
      const { frame } = result;
      const kind = lineKindOf(frame);

      if (state === 'idle') {
        // Beklenen bir komut yokken gelen HER satır tanım gereği istemsizdir.
        for (const listener of unsolicitedListeners) listener(frame);
        return result;
      }

      if (state === 'command-sent') {
        state = 'wait-response';
        const isEcho =
          kind === 'command' &&
          pending !== undefined &&
          new TextDecoder().decode(data).replace(/[\r\n]+$/, '') === pending.command;
        if (isEcho) return result; // echo tüketildi, yanıta eklenmedi
        // Echo BASKILANMIŞ (ör. ATE0) — bu satır zaten yanıtın kendisi, aşağı düşer.
      }

      // state === 'wait-response'
      if (kind === 'prompt') {
        for (const listener of promptListeners) listener(frame);
        return result;
      }
      if (kind === 'final-result-code') {
        emitTransaction(frame, receivedAt);
        return result;
      }
      pending?.responseLines.push(frame);
      return result;
    },

    onTransaction(listener) {
      transactionListeners.add(listener);
      return () => transactionListeners.delete(listener);
    },

    onUnsolicited(listener) {
      unsolicitedListeners.add(listener);
      return () => unsolicitedListeners.delete(listener);
    },

    onPrompt(listener) {
      promptListeners.add(listener);
      return () => promptListeners.delete(listener);
    },

    reset(): void {
      pending = undefined;
      state = 'idle';
    },
  };
}

// ── Örnekler ─────────────────────────────────────────────────────────────

function asciiBytes(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

const EXAMPLE_FRAMES: ExampleFrame[] = [
  {
    id: 'command-execute',
    name: `${TRANSLATION_KEY_PREFIX}.example.commandExecute.name`,
    bytes: asciiBytes('AT+CSQ\r\n'),
    description: `${TRANSLATION_KEY_PREFIX}.example.commandExecute.description`,
    expectedValid: true,
  },
  {
    id: 'command-read',
    name: `${TRANSLATION_KEY_PREFIX}.example.commandRead.name`,
    bytes: asciiBytes('AT+CREG?\r\n'),
    description: `${TRANSLATION_KEY_PREFIX}.example.commandRead.description`,
    expectedValid: true,
  },
  {
    id: 'command-test',
    name: `${TRANSLATION_KEY_PREFIX}.example.commandTest.name`,
    bytes: asciiBytes('AT+CGDCONT=?\r\n'),
    description: `${TRANSLATION_KEY_PREFIX}.example.commandTest.description`,
    expectedValid: true,
  },
  {
    id: 'command-set',
    name: `${TRANSLATION_KEY_PREFIX}.example.commandSet.name`,
    bytes: asciiBytes('AT+CMGF=1\r\n'),
    description: `${TRANSLATION_KEY_PREFIX}.example.commandSet.description`,
    expectedValid: true,
  },
  {
    id: 'command-bare',
    name: `${TRANSLATION_KEY_PREFIX}.example.commandBare.name`,
    bytes: asciiBytes('AT\r\n'),
    description: `${TRANSLATION_KEY_PREFIX}.example.commandBare.description`,
    expectedValid: true,
  },
  {
    id: 'command-mixed-case',
    name: `${TRANSLATION_KEY_PREFIX}.example.commandMixedCase.name`,
    bytes: asciiBytes('At+CSQ\r\n'),
    description: `${TRANSLATION_KEY_PREFIX}.example.commandMixedCase.description`,
    expectedValid: true,
  },
  {
    id: 'information-response',
    name: `${TRANSLATION_KEY_PREFIX}.example.informationResponse.name`,
    bytes: asciiBytes('+CSQ: 20,99\r\n'),
    description: `${TRANSLATION_KEY_PREFIX}.example.informationResponse.description`,
    expectedValid: true,
  },
  {
    id: 'final-result-ok',
    name: `${TRANSLATION_KEY_PREFIX}.example.finalResultOk.name`,
    bytes: asciiBytes('OK\r\n'),
    description: `${TRANSLATION_KEY_PREFIX}.example.finalResultOk.description`,
    expectedValid: true,
  },
  {
    id: 'final-result-error',
    name: `${TRANSLATION_KEY_PREFIX}.example.finalResultError.name`,
    bytes: asciiBytes('ERROR\r\n'),
    description: `${TRANSLATION_KEY_PREFIX}.example.finalResultError.description`,
    expectedValid: true,
  },
  {
    id: 'final-result-cme-numeric',
    name: `${TRANSLATION_KEY_PREFIX}.example.finalResultCmeNumeric.name`,
    bytes: asciiBytes('+CME ERROR: 10\r\n'),
    description: `${TRANSLATION_KEY_PREFIX}.example.finalResultCmeNumeric.description`,
    expectedValid: true,
  },
  {
    id: 'final-result-cme-verbose',
    name: `${TRANSLATION_KEY_PREFIX}.example.finalResultCmeVerbose.name`,
    bytes: asciiBytes('+CME ERROR: SIM not inserted\r\n'),
    description: `${TRANSLATION_KEY_PREFIX}.example.finalResultCmeVerbose.description`,
    expectedValid: true,
  },
  {
    id: 'final-result-cms',
    name: `${TRANSLATION_KEY_PREFIX}.example.finalResultCms.name`,
    bytes: asciiBytes('+CMS ERROR: 500\r\n'),
    description: `${TRANSLATION_KEY_PREFIX}.example.finalResultCms.description`,
    expectedValid: true,
  },
  {
    id: 'connect-with-rate',
    name: `${TRANSLATION_KEY_PREFIX}.example.connectWithRate.name`,
    bytes: asciiBytes('CONNECT 115200\r\n'),
    description: `${TRANSLATION_KEY_PREFIX}.example.connectWithRate.description`,
    expectedValid: true,
  },
  {
    id: 'prompt',
    name: `${TRANSLATION_KEY_PREFIX}.example.prompt.name`,
    bytes: asciiBytes('>'),
    description: `${TRANSLATION_KEY_PREFIX}.example.prompt.description`,
    expectedValid: true,
  },
  {
    id: 'banner-text',
    name: `${TRANSLATION_KEY_PREFIX}.example.bannerText.name`,
    bytes: asciiBytes('Quectel BG96\r\n'),
    description: `${TRANSLATION_KEY_PREFIX}.example.bannerText.description`,
    expectedValid: true,
  },
];

export const atCommandsPlugin: ProtocolPlugin = {
  id: PROTOCOL_ID,
  name: PROTOCOL_DISPLAY_NAME,
  category: 'interfaces-framing',
  parser: atCommandsParser,
  documentation: {
    summary: `${TRANSLATION_KEY_PREFIX}.documentation.summary`,
    layer: 'application',
    references: [
      { title: 'ITU-T Recommendation V.250', url: 'https://www.itu.int/rec/T-REC-V.250' },
      { title: '3GPP TS 27.007 — AT command set for User Equipment (UE)', url: 'https://www.3gpp.org/DynaReport/27007.htm' },
    ],
  },
  exampleFrames: EXAMPLE_FRAMES,
};
