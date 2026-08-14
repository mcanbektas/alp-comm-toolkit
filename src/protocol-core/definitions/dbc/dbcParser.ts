/**
 * DBC metin çözümleyicisi — `.dbc` dosyası → `DbcDatabase`.
 *
 * HOŞGÖRÜLÜ: tanımadığı satırı yok sayıp uyarı üretir, dosyayı reddetmez.
 * Gerçek DBC dosyaları `BA_DEF_`, `BA_`, `SIG_GROUP_`, `NS_` gibi onlarca ek
 * bölüm taşır ve bunların hiçbiri sinyal çözümü için gerekli değildir; katı
 * davranıp reddetmek, kullanıcının elindeki dosyaların çoğunu kullanılamaz
 * kılardı (spec §47 "hatalı veride uygulamayı çökertme").
 *
 * Desteklenen bölümler: `VERSION`, `BU_`, `BO_`, `SG_`, `CM_`, `VAL_`.
 * Bilinçli DESTEKLENMEYEN: `BA_DEF_`/`BA_` (öznitelikler — sinyal çözümünü
 * etkilemez), `SIG_VALTYPE_` (IEEE float sinyaller — tamsayı yolundan farklı
 * bir çözüm ister, kendi dalgasını hak eder), `SG_MUL_VAL_` (genişletilmiş
 * çoklama). Üçü de uyarı olarak bildirilir, sessizce yutulmaz.
 *
 * TUZAK — EXTENDED IDENTIFIER BAYRAĞI: DBC dosyasında 29-bit mesajlar
 * identifier'a 0x80000000 eklenerek yazılır. Bayrak ayrılmazsa `BO_ 2566844673`
 * satırı iki milyarlık bir identifier gibi okunur ve hiçbir CAN çerçevesiyle
 * eşleşmez. Bayrak `DbcMessage.extended` alanına taşınır.
 *
 * TUZAK — SATIR SONU: DBC dosyaları çoğunlukla Windows'ta üretilir ve CRLF ile
 * gelir. `\r` kırpılmazsa sinyal adları ve birimler sonunda görünmez bir
 * karakter taşır, eşleştirme sessizce başarısız olur.
 */

import type {
  DbcByteOrder,
  DbcDatabase,
  DbcMessage,
  DbcMultiplexRole,
  DbcParseIssue,
  DbcParseResult,
  DbcSignal,
} from './dbcTypes';

/** DBC'de extended identifier bu bit ile işaretlenir. */
const DBC_EXTENDED_ID_FLAG = 0x80000000;
const DBC_ID_MASK = 0x1fffffff;
/** Sorunlu satır bildirimlerinde ham metin bu uzunlukta kırpılır. */
const ISSUE_TEXT_LIMIT = 120;
const DECIMAL_RADIX = 10;

/**
 * Sorun sebepleri ÇEVİRİ ANAHTARIDIR, düz metin değil (CLAUDE.md): görünen
 * hiçbir metin koda gömülmez. Hiçbirinde yer tutucu yoktur; satır numarası ve
 * ham metin `DbcParseIssue`in ayrı alanlarında taşınır.
 */
const ISSUE_EMPTY_INPUT = 'definition.dbc.issue.emptyInput';
const ISSUE_NO_MESSAGES = 'definition.dbc.issue.noMessages';
const ISSUE_MALFORMED_MESSAGE = 'definition.dbc.issue.malformedMessage';
const ISSUE_MALFORMED_SIGNAL = 'definition.dbc.issue.malformedSignal';
const ISSUE_SIGNAL_WITHOUT_MESSAGE = 'definition.dbc.issue.signalWithoutMessage';
const ISSUE_MALFORMED_VALUE_TABLE = 'definition.dbc.issue.malformedValueTable';
const ISSUE_UNKNOWN_VALUE_TABLE_TARGET = 'definition.dbc.issue.unknownValueTableTarget';
const ISSUE_UNSUPPORTED_SECTION = 'definition.dbc.issue.unsupportedSection';
const ISSUE_DUPLICATE_MESSAGE_ID = 'definition.dbc.issue.duplicateMessageId';
const ISSUE_SIGNAL_EXCEEDS_MESSAGE = 'definition.dbc.issue.signalExceedsMessage';

/** Çözümü etkilemeyen ama sessizce yutulmaması gereken bölüm anahtarları. */
const UNSUPPORTED_KEYWORDS = [
  'BA_DEF_',
  'BA_DEF_DEF_',
  'BA_',
  'SIG_VALTYPE_',
  'SG_MUL_VAL_',
  'BO_TX_BU_',
  'SIG_GROUP_',
  'EV_',
] as const;

/**
 * `SG_ <ad> [M|m<N>] : <start>|<len>@<0|1><+|-> (<factor>,<offset>)
 *  [<min>|<max>] "<birim>" <alıcılar>`
 *
 * Çoklayıcı işareti ada BİTİŞİK DEĞİL ayrı bir belirteçtir; iki nokta öncesinde
 * bulunur ve olmayabilir.
 */
const SIGNAL_PATTERN =
  /^SG_\s+([A-Za-z_][\w]*)\s*(M|m\d+)?\s*:\s*(\d+)\|(\d+)@([01])([+-])\s*\(([^,]+),([^)]*)\)\s*\[([^|]*)\|([^\]]*)\]\s*"([^"]*)"\s*(.*)$/;

/** `BO_ <id> <ad>: <uzunluk> <gönderen>` */
const MESSAGE_PATTERN = /^BO_\s+(\d+)\s+([A-Za-z_][\w]*)\s*:\s*(\d+)\s+(\S+)\s*$/;

/** `VAL_ <id> <sinyal> <n> "<etiket>" ... ;` */
const VALUE_TABLE_PATTERN = /^VAL_\s+(\d+)\s+([A-Za-z_][\w]*)\s+(.*?)\s*;?\s*$/;
/** Değer tablosundaki `<sayı> "<etiket>"` çiftleri. */
const VALUE_PAIR_PATTERN = /(-?\d+)\s+"([^"]*)"/g;

const VERSION_PATTERN = /^VERSION\s+"([^"]*)"/;
const NODES_PATTERN = /^BU_\s*:\s*(.*)$/;

const COMMENT_MESSAGE_PATTERN = /^CM_\s+BO_\s+(\d+)\s+"([\s\S]*)"\s*;?\s*$/;
const COMMENT_SIGNAL_PATTERN = /^CM_\s+SG_\s+(\d+)\s+([A-Za-z_][\w]*)\s+"([\s\S]*)"\s*;?\s*$/;
const COMMENT_GLOBAL_PATTERN = /^CM_\s+"([\s\S]*)"\s*;?\s*$/;

/** Değiştirilebilir biriktirici — `DbcSignal` salt okunur olduğu için ayrı tutulur. */
interface SignalAccumulator {
  name: string;
  startBit: number;
  bitLength: number;
  byteOrder: DbcByteOrder;
  signed: boolean;
  factor: number;
  offset: number;
  minimum: number;
  maximum: number;
  unit: string;
  receivers: string[];
  multiplex: DbcMultiplexRole;
  valueTable?: Map<number, string>;
  comment?: string;
}

interface MessageAccumulator {
  canId: number;
  extended: boolean;
  name: string;
  byteLength: number;
  transmitter: string;
  signals: SignalAccumulator[];
  comment?: string;
}

function clip(text: string): string {
  const trimmed = text.trim();
  return trimmed.length <= ISSUE_TEXT_LIMIT ? trimmed : `${trimmed.slice(0, ISSUE_TEXT_LIMIT)}…`;
}

/**
 * DBC sayıları nokta ondalıklıdır ve üstel gösterim (`1E-3`) taşıyabilir.
 * Çözülemeyen değerde `fallback` döner — tek bir bozuk faktör yüzünden bütün
 * sinyali atmak, kullanıcıyı elindeki dosyadan tamamen mahrum bırakırdı.
 */
function parseNumber(text: string, fallback: number): number {
  const value = Number.parseFloat(text.trim());
  return Number.isFinite(value) ? value : fallback;
}

function parseMultiplexRole(token: string | undefined): DbcMultiplexRole {
  if (token === undefined || token === '') return { kind: 'none' };
  if (token === 'M') return { kind: 'multiplexor' };
  const switchValue = Number.parseInt(token.slice(1), DECIMAL_RADIX);
  return Number.isFinite(switchValue)
    ? { kind: 'multiplexed', switchValue }
    : { kind: 'none' };
}

function parseReceivers(text: string): string[] {
  return text
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry !== '');
}

function toSignal(accumulator: SignalAccumulator): DbcSignal {
  const signal: DbcSignal = {
    name: accumulator.name,
    startBit: accumulator.startBit,
    bitLength: accumulator.bitLength,
    byteOrder: accumulator.byteOrder,
    signed: accumulator.signed,
    factor: accumulator.factor,
    offset: accumulator.offset,
    minimum: accumulator.minimum,
    maximum: accumulator.maximum,
    unit: accumulator.unit,
    receivers: accumulator.receivers,
    multiplex: accumulator.multiplex,
  };
  // exactOptionalPropertyTypes'a hazır olmak için opsiyoneller yalnız doluysa yazılır.
  return {
    ...signal,
    ...(accumulator.valueTable === undefined ? {} : { valueTable: accumulator.valueTable }),
    ...(accumulator.comment === undefined ? {} : { comment: accumulator.comment }),
  };
}

function toMessage(accumulator: MessageAccumulator): DbcMessage {
  const message: DbcMessage = {
    canId: accumulator.canId,
    extended: accumulator.extended,
    name: accumulator.name,
    byteLength: accumulator.byteLength,
    transmitter: accumulator.transmitter,
    signals: accumulator.signals.map(toSignal),
  };
  return {
    ...message,
    ...(accumulator.comment === undefined ? {} : { comment: accumulator.comment }),
  };
}

/**
 * Çok satırlı `CM_` bloklarını tek satıra indirger. Gerçek DBC dosyalarında
 * yorumlar satır sonlarını içerebilir ve `";` ile biter; satır satır işlemek o
 * yorumların gövdesini "tanınmayan satır" olarak uyarıya çevirirdi.
 *
 * Fiziksel satır numarası KORUNUR: birleştirilen blok, başladığı satırın
 * numarasını taşır, böylece sorun bildirimi kullanıcının gördüğü yeri gösterir.
 */
function joinLogicalLines(rawLines: readonly string[]): { text: string; line: number }[] {
  const logical: { text: string; line: number }[] = [];
  let buffer: string | null = null;
  let bufferLine = 0;

  for (let index = 0; index < rawLines.length; index += 1) {
    // CRLF tuzağı: `\r` kırpılmazsa adlar görünmez karakter taşır.
    const line = (rawLines[index] ?? '').replace(/\r$/, '');

    if (buffer !== null) {
      buffer += `\n${line}`;
      if (/"\s*;?\s*$/.test(line)) {
        logical.push({ text: buffer, line: bufferLine });
        buffer = null;
      }
      continue;
    }

    const trimmed = line.trim();
    // Açılmış ama kapanmamış bir yorum: tırnak sayısı tek ise blok sürüyor.
    if (trimmed.startsWith('CM_') && (trimmed.match(/"/g) ?? []).length === 1) {
      buffer = line;
      bufferLine = index + 1;
      continue;
    }
    logical.push({ text: line, line: index + 1 });
  }

  if (buffer !== null) {
    // Kapanmamış blok: elde olanı yine de sun, kaybetme.
    logical.push({ text: buffer, line: bufferLine });
  }
  return logical;
}

/**
 * DBC metnini çözer. Fırlatmaz; bozuk satırlar `issues` olarak döner.
 *
 * `success: false` yalnız HİÇ mesaj çıkarılamadığında verilir — o durumda
 * ekranda gösterilecek bir veritabanı yoktur.
 */
export function parseDbc(text: string): DbcParseResult {
  const issues: DbcParseIssue[] = [];

  if (text.trim() === '') {
    return { success: false, issues: [{ line: 0, messageKey: ISSUE_EMPTY_INPUT }] };
  }

  const messages: MessageAccumulator[] = [];
  const messagesById = new Map<number, MessageAccumulator>();
  const nodes: string[] = [];
  const comments: string[] = [];
  let version = '';
  let current: MessageAccumulator | null = null;
  const reportedUnsupported = new Set<string>();

  for (const { text: rawLine, line } of joinLogicalLines(text.split('\n'))) {
    const trimmed = rawLine.trim();
    if (trimmed === '') continue;

    // --- VERSION ---
    const versionMatch = VERSION_PATTERN.exec(trimmed);
    if (versionMatch !== null) {
      version = versionMatch[1] ?? '';
      current = null;
      continue;
    }

    // --- BU_ (düğüm listesi) ---
    const nodesMatch = NODES_PATTERN.exec(trimmed);
    if (nodesMatch !== null) {
      for (const node of (nodesMatch[1] ?? '').split(/\s+/)) {
        if (node !== '') nodes.push(node);
      }
      current = null;
      continue;
    }

    // --- BO_ (mesaj) ---
    if (trimmed.startsWith('BO_ ')) {
      const match = MESSAGE_PATTERN.exec(trimmed);
      if (match === null) {
        issues.push({ line, messageKey: ISSUE_MALFORMED_MESSAGE, text: clip(trimmed) });
        current = null;
        continue;
      }
      const rawId = Number.parseInt(match[1] ?? '0', DECIMAL_RADIX);
      // Extended bayrağı identifier'ın içinde bırakılmaz (dosya başı tuzağı).
      const extended = (rawId & DBC_EXTENDED_ID_FLAG) !== 0;
      const canId = extended ? rawId & DBC_ID_MASK : rawId;

      const accumulator: MessageAccumulator = {
        canId,
        extended,
        name: match[2] ?? '',
        byteLength: Number.parseInt(match[3] ?? '0', DECIMAL_RADIX),
        transmitter: match[4] ?? '',
        signals: [],
      };

      const existing = messagesById.get(canId);
      if (existing !== undefined) {
        // Aynı identifier iki kez tanımlanmış: dosya tutarsız. İlki korunur,
        // ikincisi yine çözülür ama kullanıcı hangi tanımın kazandığını bilmeli.
        issues.push({ line, messageKey: ISSUE_DUPLICATE_MESSAGE_ID, text: clip(trimmed) });
      } else {
        messagesById.set(canId, accumulator);
      }
      messages.push(accumulator);
      current = accumulator;
      continue;
    }

    // --- SG_ (sinyal) ---
    if (trimmed.startsWith('SG_ ')) {
      if (current === null) {
        issues.push({ line, messageKey: ISSUE_SIGNAL_WITHOUT_MESSAGE, text: clip(trimmed) });
        continue;
      }
      const match = SIGNAL_PATTERN.exec(trimmed);
      if (match === null) {
        issues.push({ line, messageKey: ISSUE_MALFORMED_SIGNAL, text: clip(trimmed) });
        continue;
      }

      const bitLength = Number.parseInt(match[4] ?? '0', DECIMAL_RADIX);
      const startBit = Number.parseInt(match[3] ?? '0', DECIMAL_RADIX);
      const signal: SignalAccumulator = {
        name: match[1] ?? '',
        startBit,
        bitLength,
        // `@1` Intel (little-endian), `@0` Motorola (big-endian).
        byteOrder: match[5] === '1' ? 'intel' : 'motorola',
        signed: match[6] === '-',
        factor: parseNumber(match[7] ?? '1', 1),
        offset: parseNumber(match[8] ?? '0', 0),
        minimum: parseNumber(match[9] ?? '0', 0),
        maximum: parseNumber(match[10] ?? '0', 0),
        unit: match[11] ?? '',
        receivers: parseReceivers(match[12] ?? ''),
        multiplex: parseMultiplexRole(match[2]),
      };

      if (startBit + bitLength > current.byteLength * 8) {
        // Sinyal mesajın bildirdiği uzunluğa sığmıyor. Atmak yerine uyarmak
        // doğru: çözücü zaten kısa çerçevede güvenli davranır ve kullanıcı
        // dosyadaki tutarsızlığı ancak böyle görür.
        issues.push({ line, messageKey: ISSUE_SIGNAL_EXCEEDS_MESSAGE, text: clip(trimmed) });
      }
      current.signals.push(signal);
      continue;
    }

    // --- VAL_ (değer tablosu) ---
    if (trimmed.startsWith('VAL_ ')) {
      const match = VALUE_TABLE_PATTERN.exec(trimmed);
      if (match === null) {
        issues.push({ line, messageKey: ISSUE_MALFORMED_VALUE_TABLE, text: clip(trimmed) });
        continue;
      }
      const rawId = Number.parseInt(match[1] ?? '0', DECIMAL_RADIX);
      const canId = (rawId & DBC_EXTENDED_ID_FLAG) !== 0 ? rawId & DBC_ID_MASK : rawId;
      const target = messagesById.get(canId)?.signals.find((entry) => entry.name === match[2]);
      if (target === undefined) {
        issues.push({ line, messageKey: ISSUE_UNKNOWN_VALUE_TABLE_TARGET, text: clip(trimmed) });
        continue;
      }
      const table = new Map<number, string>();
      // `exec` döngüsü için `lastIndex` sıfırlanır: desen `g` bayraklı ve
      // modül düzeyinde paylaşılıyor.
      VALUE_PAIR_PATTERN.lastIndex = 0;
      let pair = VALUE_PAIR_PATTERN.exec(match[3] ?? '');
      while (pair !== null) {
        table.set(Number.parseInt(pair[1] ?? '0', DECIMAL_RADIX), pair[2] ?? '');
        pair = VALUE_PAIR_PATTERN.exec(match[3] ?? '');
      }
      if (table.size > 0) target.valueTable = table;
      continue;
    }

    // --- CM_ (yorum) ---
    if (trimmed.startsWith('CM_')) {
      const signalComment = COMMENT_SIGNAL_PATTERN.exec(trimmed);
      if (signalComment !== null) {
        const rawId = Number.parseInt(signalComment[1] ?? '0', DECIMAL_RADIX);
        const canId = (rawId & DBC_EXTENDED_ID_FLAG) !== 0 ? rawId & DBC_ID_MASK : rawId;
        const target = messagesById
          .get(canId)
          ?.signals.find((entry) => entry.name === signalComment[2]);
        if (target !== undefined) target.comment = signalComment[3] ?? '';
        continue;
      }
      const messageComment = COMMENT_MESSAGE_PATTERN.exec(trimmed);
      if (messageComment !== null) {
        const rawId = Number.parseInt(messageComment[1] ?? '0', DECIMAL_RADIX);
        const canId = (rawId & DBC_EXTENDED_ID_FLAG) !== 0 ? rawId & DBC_ID_MASK : rawId;
        const target = messagesById.get(canId);
        if (target !== undefined) target.comment = messageComment[2] ?? '';
        continue;
      }
      const globalComment = COMMENT_GLOBAL_PATTERN.exec(trimmed);
      if (globalComment !== null) {
        comments.push(globalComment[1] ?? '');
        continue;
      }
      // `CM_ BU_ ...` ve tanınmayan yorum biçimleri sessizce atlanır: yorum
      // metni sinyal çözümünü etkilemez.
      continue;
    }

    // --- Bilinçli desteklenmeyen bölümler ---
    const unsupported = UNSUPPORTED_KEYWORDS.find((keyword) => trimmed.startsWith(keyword));
    if (unsupported !== undefined) {
      // Bölüm başına BİR kez bildirilir: büyük dosyalarda binlerce `BA_` satırı
      // uyarı listesini kullanılmaz hâle getirirdi.
      if (!reportedUnsupported.has(unsupported)) {
        reportedUnsupported.add(unsupported);
        issues.push({ line, messageKey: ISSUE_UNSUPPORTED_SECTION, text: unsupported });
      }
      continue;
    }

    // Kalanlar (NS_, BS_, girintili liste gövdeleri…) sessizce atlanır:
    // bunlar DBC'nin yapısal iskeleti, çözümü etkilemiyorlar.
  }

  if (messages.length === 0) {
    return { success: false, issues: [...issues, { line: 0, messageKey: ISSUE_NO_MESSAGES }] };
  }

  const database: DbcDatabase = {
    version,
    nodes,
    messages: messages.map(toMessage),
    comments,
  };
  return { success: true, database, issues };
}

/** Identifier'a göre mesaj arar. Extended bayrağı ayrı taşındığı için ikisi de sorulur. */
export function findDbcMessage(
  database: DbcDatabase,
  canId: number,
  extended: boolean,
): DbcMessage | undefined {
  return database.messages.find(
    (message) => message.canId === canId && message.extended === extended,
  );
}
