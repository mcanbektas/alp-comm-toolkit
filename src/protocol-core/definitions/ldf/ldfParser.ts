/**
 * LDF metin çözümleyicisi — `.ldf` dosyası → `LdfCluster`.
 *
 * `edsParser`/`xifParser`/`gsdParser`in HOŞGÖRÜLÜ tavrı burada da geçerli
 * (spec §47 "hatalı veride uygulamayı çökertme"): tanınmayan bölüm atlanır,
 * bozuk bildirim bir sonraki `;`e kadar yutulur ve dosya okunmaya devam eder.
 *
 * ── ÖNCEKİ ÜÇ MOTORDAN NEDEN YAPI OLARAK AYRILDI ────────────────────────────
 * O üçü SATIR tarayıcısıdır. LDF'te satır sonu ANLAMSIZDIR — bildirimi `;`
 * bitirir, bloğu `{}` sınırlar ve gerçek dosyalar bunu sonuna kadar kullanır.
 * ÖLÇÜLDÜ: LIN 1.3 fixture'ı `VL1_CEM_Frm1:32,CEM,3 {` derken bütün alanları
 * BOŞLUKSUZ ve tek satırda yazıyor; Vector'ün 2.2 dosyası aynı bildirimi beş
 * satıra yayıyor. Bir satır tarayıcısı ikisini birden okuyamaz. Bu yüzden önce
 * SÖZCÜKLEYİCİ (`tokenize`) çalışır, sonra belirteç akışı üstünde özyinelemeli
 * bir bölüm makinesi yürür. Emsal `dbcParser.ts` değil bile — DBC de satır
 * tabanlıdır; bu motorun bu depoda emsali YOK, dilin kendisi öyle gerektirdi.
 *
 * ── TUZAK 1: YORUM İKİ BİÇİMLİ VE TIRNAĞIN İÇİNDE OLABİLİR ──────────────────
 * §9.3: "yorum söz dizimi C++'ınkiyle aynıdır: `//` ile satır sonuna kadar ve
 * `/* ... *\/` arası yok sayılır." İkisi de dosyanın HER YERİNDE geçerli.
 * `//` bir dize DEĞERİNİN içinde geçebileceği için (birim metinleri, açıklama
 * dizeleri) yorum kırpma karakter karakter, TIRNAK DURUMU izlenerek yapılır.
 * Kaba bir `replace(/\/\/.*$/gm, '')` gerçek dizeleri ortadan keserdi.
 *
 * ── TUZAK 2: BÜYÜK/KÜÇÜK HARFE **DUYARLI** ──────────────────────────────────
 * GSD'nin TAM TERSİ. §9.3 son cümlesi: "Ayrılmış metin ve tanıtıcılar
 * büyük/küçük harfe duyarlıdır." `gsdParser`in bölüm adlarını küçüğe indiren
 * yaklaşımı burada YANLIŞ olurdu: `Signals` bir bölüm, `signals` bir tanıtıcı
 * olabilir. Karşılaştırmalar bu yüzden BİREBİR.
 *
 * ── TUZAK 3: BAYT DİZİSİNİ BİT BOYU DEĞİL, KÜME PARANTEZİ AYIRIR ────────────
 * §9.2.3.1: "8 ya da 16 boyundaki bir sinyalin bir ya da iki elemanlı bayt
 * dizisi mi yoksa skaler mi olduğunu anlamanın TEK yolu `init_value`ı
 * incelemektir, yani küme parantezleri çok önemlidir." Ölçüldü: açılış
 * fixture'ında `Motor1Position: 32, {0, 0, 0, 0}` bayt dizisi, `Motor2Temp: 8,
 * 0` skaler. Bit boyuna bakan bir ayrım ikisini de yanlış sınıflandırırdı.
 *
 * ── TUZAK 4: SAYILAR ONLUK YA DA ONALTILIK, GERÇEK SAYI DA VAR ──────────────
 * §9.3: tamsayı onluk ya da `0x` önekli onaltılık; gerçek sayı yalnız onluk ve
 * gömülü ondalık noktalı. Ölçüldü, açılış fixture'ı AYNI dosyada ikisini de
 * kullanıyor — çerçeve kimlikleri onluk (`53`, `45`) ama teşhis çerçeveleri
 * onaltılık (`0x3c`, `0x3d`), ölçek ise gerçek (`0.5`, `19.2`). `Number()`
 * üçünü de doğru okur ama `parseInt` okumaz.
 */

import { BITS_PER_BYTE, readBits, writeBits } from '../../decoding/bitCursor';
import type {
  LdfChecksumResolution,
  LdfCluster,
  LdfConfigurableFrame,
  LdfDecodedSignal,
  LdfDiagnosticAddress,
  LdfEncodingEntry,
  LdfFrame,
  LdfFrameSignal,
  LdfNodeAttributes,
  LdfParseIssue,
  LdfParseResult,
  LdfScheduleEntry,
  LdfScheduleTable,
  LdfSignal,
  LdfSignalEncodingType,
  LdfSignalGroup,
} from './ldfTypes';

const ISSUE_TEXT_LIMIT = 120;
/** `gsdParser`in aynı disiplini: gürültüyü beşte kes, gerçek sorunu görünür bırak. */
const MALFORMED_LIMIT = 5;
const UNKNOWN_SECTION_LIMIT = 5;

const ISSUE_EMPTY_INPUT = 'definition.ldf.issue.emptyInput';
const ISSUE_NOT_LDF = 'definition.ldf.issue.notLdf';
const ISSUE_NO_FRAMES = 'definition.ldf.issue.noFrames';
const ISSUE_MALFORMED_ENTRY = 'definition.ldf.issue.malformedEntry';
const ISSUE_UNCLOSED_SECTION = 'definition.ldf.issue.unclosedSection';
const ISSUE_UNKNOWN_SECTION = 'definition.ldf.issue.unknownSection';
const ISSUE_FRAME_LENGTH_MISSING = 'definition.ldf.issue.frameLengthMissing';
const ISSUE_SIGNAL_NOT_DEFINED = 'definition.ldf.issue.signalNotDefined';
const ISSUE_SIGNAL_OUT_OF_FRAME = 'definition.ldf.issue.signalOutOfFrame';
const ISSUE_UNALIGNED_BYTE_ARRAY = 'definition.ldf.issue.unalignedByteArray';
const ISSUE_DUPLICATE_FRAME_ID = 'definition.ldf.issue.duplicateFrameId';
const ISSUE_UNKNOWN_ENCODING_SIGNAL = 'definition.ldf.issue.unknownEncodingSignal';
const ISSUE_SPEED_OUT_OF_RANGE = 'definition.ldf.issue.speedOutOfRange';

/** §9.2: üst düzey üretimin ZORUNLU ilk belirteci. Dosya tipi işareti budur. */
const FILE_MARKER = 'LIN_description_file';

/** §9.2.4.4 / §2.3.3.4: ayrılmış teşhis çerçevesi kimlikleri. */
const MASTER_REQUEST_ID = 0x3c;
const SLAVE_RESPONSE_ID = 0x3d;

/** §2.2.1: skaler sinyalin azami bit boyu. */
const MAX_SCALAR_BITS = 16;
/** §9.2.1.3: küme hızı bu aralıkta olmalı (kbit/s). */
const MIN_SPEED_KBPS = 1;
const MAX_SPEED_KBPS = 20;

/**
 * 2.2A BNF'inde OLMAYAN ama gerçek dosyalarda görülen ve UYARI ÜRETMEDEN
 * geçilmesi gereken genel anahtarlar. Ölçüldü: `LDF_file_revision`ı Vector'ün
 * DaVinci Network Designer'ı yazıyor, `LIN_sig_byte_order_big_endian` ise ISO
 * lehçesinin bayrağı. İkisi de dosyanın kendi yorumunda "New optional
 * parameter" diye anılıyor — bunlara uyarı basmak gerçek dosyaları kirli
 * göstermek olurdu.
 */
const KNOWN_EXTRA_GLOBALS: ReadonlySet<string> = new Set([
  'LDF_file_revision',
  'LIN_sig_byte_order_big_endian',
]);

/**
 * Tanınan ama MODELLENMEYEN bölümler: sessizce atlanır, uyarı üretilmez.
 * `composite` (§9.2.2.3) bilinçli olarak dışarıda — bir fiziksel düğümün kaç
 * mantıksal düğümden kurulduğu paneldeki hiçbir tabloya girmiyor ve modele
 * eklemek gösterilmeyen bir alan üretirdi.
 */
const IGNORED_SECTIONS: ReadonlySet<string> = new Set(['composite']);

type TokenKind = 'word' | 'string' | 'punct';

interface Token {
  readonly text: string;
  readonly kind: TokenKind;
  readonly line: number;
}

function clip(text: string): string {
  const flat = text.trim().replace(/\s+/gu, ' ');
  return flat.length > ISSUE_TEXT_LIMIT ? `${flat.slice(0, ISSUE_TEXT_LIMIT)}…` : flat;
}

/**
 * C++ yorumlarını, TIRNAK DURUMUNU izleyerek kırpar (tuzak 1). Kırpılan
 * karakterlerin yerine boşluk konur ki SATIR NUMARALARI ve karakter konumları
 * kaymasın — hata listesinin dosyayla tutması buna bağlı.
 */
export function stripLdfComments(text: string): string {
  const out: string[] = [];
  let index = 0;
  let inString = false;

  while (index < text.length) {
    const char = text[index] ?? '';
    const next = text[index + 1] ?? '';

    if (inString) {
      if (char === '"') inString = false;
      out.push(char);
      index += 1;
      continue;
    }
    if (char === '"') {
      inString = true;
      out.push(char);
      index += 1;
      continue;
    }
    if (char === '/' && next === '/') {
      while (index < text.length && text[index] !== '\n') {
        out.push(' ');
        index += 1;
      }
      continue;
    }
    if (char === '/' && next === '*') {
      out.push(' ', ' ');
      index += 2;
      while (index < text.length && !(text[index] === '*' && text[index + 1] === '/')) {
        // Satır sonu KORUNUR: blok yorumu birden çok satıra yayılabiliyor.
        out.push(text[index] === '\n' ? '\n' : ' ');
        index += 1;
      }
      if (index < text.length) {
        out.push(' ', ' ');
        index += 2;
      }
      continue;
    }
    out.push(char);
    index += 1;
  }
  return out.join('');
}

const PUNCTUATION: ReadonlySet<string> = new Set(['{', '}', ';', ':', ',', '=']);

/** Metni belirteçlere ayırır. Satır numarası her belirteçle birlikte taşınır. */
export function tokenizeLdf(text: string): Token[] {
  const source = stripLdfComments(text);
  const tokens: Token[] = [];
  let line = 1;
  let index = 0;

  while (index < source.length) {
    const char = source[index] ?? '';
    if (char === '\n') {
      line += 1;
      index += 1;
      continue;
    }
    if (/\s/u.test(char)) {
      index += 1;
      continue;
    }
    if (PUNCTUATION.has(char)) {
      tokens.push({ text: char, kind: 'punct', line });
      index += 1;
      continue;
    }
    if (char === '"') {
      const start = line;
      let value = '';
      index += 1;
      while (index < source.length && source[index] !== '"') {
        if (source[index] === '\n') line += 1;
        value += source[index];
        index += 1;
      }
      // Kapanmamış tırnakta dosyanın sonuna kadar yutulur; belirteç YİNE üretilir.
      if (index < source.length) index += 1;
      tokens.push({ text: value, kind: 'string', line: start });
      continue;
    }
    let word = '';
    while (index < source.length) {
      const current = source[index] ?? '';
      if (/\s/u.test(current) || PUNCTUATION.has(current) || current === '"') break;
      word += current;
      index += 1;
    }
    tokens.push({ text: word, kind: 'word', line });
  }
  return tokens;
}

/**
 * Onluk, onaltılık ya da gerçek sayıyı okur (tuzak 4). Sayı değilse
 * `undefined` — SIFIR UYDURULMAZ.
 */
function toNumber(token: Token | undefined): number | undefined {
  if (token === undefined || token.kind === 'punct') return undefined;
  const raw = token.text.trim();
  if (raw === '') return undefined;
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
}

/** Belirteç akışında imleç taşıyan, geri alınabilir okuyucu. */
class Reader {
  private position = 0;

  constructor(private readonly tokens: readonly Token[]) {}

  peek(offset = 0): Token | undefined {
    return this.tokens[this.position + offset];
  }

  next(): Token | undefined {
    const token = this.tokens[this.position];
    this.position += 1;
    return token;
  }

  done(): boolean {
    return this.position >= this.tokens.length;
  }

  lastLine(): number {
    return this.tokens[this.tokens.length - 1]?.line ?? 0;
  }

  /** Beklenen noktalama geldiyse tüketir ve `true` döner. */
  accept(text: string): boolean {
    const token = this.peek();
    if (token?.kind === 'punct' && token.text === text) {
      this.position += 1;
      return true;
    }
    return false;
  }

  /**
   * Bozuk bildirimden kurtulma: aynı derinlikteki bir sonraki `;`e kadar yutar.
   * `{` görürse dengeli olarak atlar — yarım kalan bir bildirim bloğun
   * tamamını yutmasın.
   */
  recover(): void {
    let depth = 0;
    while (!this.done()) {
      const token = this.peek();
      if (token === undefined) return;
      if (token.kind === 'punct') {
        if (token.text === '{') depth += 1;
        if (token.text === '}') {
          if (depth === 0) return;
          depth -= 1;
        }
        if (token.text === ';' && depth === 0) {
          this.position += 1;
          return;
        }
      }
      this.position += 1;
    }
  }

  /** Açılmış bir `{` bloğunu dengeli biçimde atlar (imleç `{`in ÜSTÜNDEDİR). */
  skipBlock(): void {
    if (!this.accept('{')) return;
    let depth = 1;
    while (!this.done() && depth > 0) {
      const token = this.next();
      if (token?.kind !== 'punct') continue;
      if (token.text === '{') depth += 1;
      else if (token.text === '}') depth -= 1;
    }
  }
}

interface Context {
  readonly issues: LdfParseIssue[];
  malformed: number;
  unknownSections: number;
}

function addIssue(context: Context, issue: LdfParseIssue): void {
  context.issues.push(issue);
}

function addMalformed(context: Context, line: number, text: string): void {
  if (context.malformed >= MALFORMED_LIMIT) return;
  context.malformed += 1;
  addIssue(context, { line, messageKey: ISSUE_MALFORMED_ENTRY, text: clip(text) });
}

/** `, a, b, c` biçimindeki virgülle ayrılmış tanıtıcı listesini `;`e kadar okur. */
function readIdentifierList(reader: Reader): string[] {
  const names: string[] = [];
  for (;;) {
    const token = reader.peek();
    if (token === undefined || token.kind === 'punct') break;
    reader.next();
    names.push(token.text);
    if (!reader.accept(',')) break;
  }
  return names;
}

/** `{a, b, c}` bayt dizisi başlangıç değeri (§9.2.3.1). */
function readInitArray(reader: Reader): number[] {
  const bytes: number[] = [];
  if (!reader.accept('{')) return bytes;
  for (;;) {
    if (reader.accept('}')) break;
    const token = reader.next();
    if (token === undefined) break;
    if (token.kind === 'punct') {
      if (token.text === '}') break;
      continue;
    }
    const value = toNumber(token);
    if (value !== undefined) bytes.push(value);
  }
  return bytes;
}

function parseNodesSection(reader: Reader, context: Context): { master: LdfCluster['master']; slaves: string[] } {
  let master: LdfCluster['master'] = { name: '', timeBaseMs: undefined, jitterMs: undefined };
  const slaves: string[] = [];

  if (!reader.accept('{')) return { master, slaves };

  while (!reader.done() && !reader.accept('}')) {
    const keyword = reader.next();
    if (keyword === undefined) break;
    if (keyword.kind === 'punct') continue;

    if (keyword.text === 'Master') {
      reader.accept(':');
      const name = reader.next();
      reader.accept(',');
      const timeBase = toNumber(reader.next());
      // `ms` birim sözcüğü ayrılmış: yutulur, değere karışmaz.
      if (reader.peek()?.text === 'ms') reader.next();
      reader.accept(',');
      const jitter = toNumber(reader.next());
      if (reader.peek()?.text === 'ms') reader.next();
      reader.accept(';');
      master = { name: name?.text ?? '', timeBaseMs: timeBase, jitterMs: jitter };
      continue;
    }
    if (keyword.text === 'Slaves') {
      reader.accept(':');
      slaves.push(...readIdentifierList(reader));
      reader.accept(';');
      continue;
    }
    addMalformed(context, keyword.line, keyword.text);
    reader.recover();
  }
  return { master, slaves };
}

function parseSignalsSection(reader: Reader, context: Context, diagnostic: boolean): LdfSignal[] {
  const signals: LdfSignal[] = [];
  if (!reader.accept('{')) return signals;

  while (!reader.done() && !reader.accept('}')) {
    const nameToken = reader.next();
    if (nameToken === undefined) break;
    if (nameToken.kind === 'punct') continue;
    if (!reader.accept(':')) {
      addMalformed(context, nameToken.line, nameToken.text);
      reader.recover();
      continue;
    }
    const sizeBits = toNumber(reader.next());
    reader.accept(',');

    // Tuzak 3: küme parantezi VARSA bayt dizisi, YOKSA skaler.
    let initValue: number | undefined;
    let initBytes: readonly number[] | undefined;
    if (reader.peek()?.kind === 'punct' && reader.peek()?.text === '{') {
      initBytes = readInitArray(reader);
    } else {
      initValue = toNumber(reader.next());
    }

    let publisher = '';
    const subscribers: string[] = [];
    if (!diagnostic && reader.accept(',')) {
      const names = readIdentifierList(reader);
      publisher = names[0] ?? '';
      subscribers.push(...names.slice(1));
    }
    reader.accept(';');

    if (sizeBits === undefined) {
      addMalformed(context, nameToken.line, nameToken.text);
      continue;
    }
    signals.push({
      name: nameToken.text,
      sizeBits,
      kind: initBytes === undefined ? 'scalar' : 'byte-array',
      initValue,
      initBytes,
      publisher,
      subscribers,
      diagnostic,
      line: nameToken.line,
    });
  }
  return signals;
}

/** `{ sinyalAdı , ofset ; }` gövdesi — çerçeve ve sinyal grubu ortak kullanır. */
function parsePlacementBlock(reader: Reader, context: Context): LdfFrameSignal[] {
  const placements: LdfFrameSignal[] = [];
  if (!reader.accept('{')) return placements;

  while (!reader.done() && !reader.accept('}')) {
    const nameToken = reader.next();
    if (nameToken === undefined) break;
    if (nameToken.kind === 'punct') continue;
    reader.accept(',');
    const offset = toNumber(reader.next());
    reader.accept(';');
    if (offset === undefined) {
      addMalformed(context, nameToken.line, nameToken.text);
      continue;
    }
    placements.push({ name: nameToken.text, offset, line: nameToken.line });
  }
  return placements;
}

function parseFramesSection(reader: Reader, context: Context): LdfFrame[] {
  const frames: LdfFrame[] = [];
  if (!reader.accept('{')) return frames;

  while (!reader.done() && !reader.accept('}')) {
    const nameToken = reader.next();
    if (nameToken === undefined) break;
    if (nameToken.kind === 'punct') continue;
    if (!reader.accept(':')) {
      addMalformed(context, nameToken.line, nameToken.text);
      reader.recover();
      continue;
    }
    const frameId = toNumber(reader.next());
    reader.accept(',');
    const publisher = reader.peek()?.kind === 'word' ? (reader.next()?.text ?? '') : '';
    // LIN 1.3 lehçesi boyu YAZMAYABİLİR: virgül gelmiyorsa boy alanı yok.
    let lengthBytes: number | undefined;
    if (reader.accept(',')) lengthBytes = toNumber(reader.next());

    const signals = parsePlacementBlock(reader, context);
    if (lengthBytes === undefined) {
      addIssue(context, {
        line: nameToken.line,
        messageKey: ISSUE_FRAME_LENGTH_MISSING,
        text: nameToken.text,
      });
    }
    frames.push({
      name: nameToken.text,
      kind: 'unconditional',
      frameId,
      publisher,
      lengthBytes,
      signals,
      collisionScheduleTable: '',
      associatedFrames: [],
      line: nameToken.line,
    });
  }
  return frames;
}

function parseSporadicFramesSection(reader: Reader, context: Context): LdfFrame[] {
  const frames: LdfFrame[] = [];
  if (!reader.accept('{')) return frames;

  while (!reader.done() && !reader.accept('}')) {
    const nameToken = reader.next();
    if (nameToken === undefined) break;
    if (nameToken.kind === 'punct') continue;
    if (!reader.accept(':')) {
      addMalformed(context, nameToken.line, nameToken.text);
      reader.recover();
      continue;
    }
    const associated = readIdentifierList(reader);
    reader.accept(';');
    frames.push({
      name: nameToken.text,
      kind: 'sporadic',
      frameId: undefined,
      publisher: '',
      lengthBytes: undefined,
      signals: [],
      collisionScheduleTable: '',
      associatedFrames: associated,
      line: nameToken.line,
    });
  }
  return frames;
}

function parseEventTriggeredSection(reader: Reader, context: Context): LdfFrame[] {
  const frames: LdfFrame[] = [];
  if (!reader.accept('{')) return frames;

  while (!reader.done() && !reader.accept('}')) {
    const nameToken = reader.next();
    if (nameToken === undefined) break;
    if (nameToken.kind === 'punct') continue;
    if (!reader.accept(':')) {
      addMalformed(context, nameToken.line, nameToken.text);
      reader.recover();
      continue;
    }
    const table = reader.next()?.text ?? '';
    reader.accept(',');
    const frameId = toNumber(reader.next());
    const associated: string[] = [];
    if (reader.accept(',')) associated.push(...readIdentifierList(reader));
    reader.accept(';');
    frames.push({
      name: nameToken.text,
      kind: 'event-triggered',
      frameId,
      publisher: '',
      lengthBytes: undefined,
      signals: [],
      collisionScheduleTable: table,
      associatedFrames: associated,
      line: nameToken.line,
    });
  }
  return frames;
}

function parseDiagnosticFramesSection(reader: Reader, context: Context): LdfFrame[] {
  const frames: LdfFrame[] = [];
  if (!reader.accept('{')) return frames;

  while (!reader.done() && !reader.accept('}')) {
    const nameToken = reader.next();
    if (nameToken === undefined) break;
    if (nameToken.kind === 'punct') continue;
    if (!reader.accept(':')) {
      addMalformed(context, nameToken.line, nameToken.text);
      reader.recover();
      continue;
    }
    const frameId = toNumber(reader.next());
    const signals = parsePlacementBlock(reader, context);
    frames.push({
      name: nameToken.text,
      kind: 'diagnostic',
      frameId,
      publisher: '',
      // §9.2.4.4: teşhis çerçeveleri her zaman sekiz bayttır (sekiz `…B0-B7` sinyali).
      lengthBytes: signals.length === 0 ? undefined : 8,
      signals,
      collisionScheduleTable: '',
      associatedFrames: [],
      line: nameToken.line,
    });
  }
  return frames;
}

function parseConfigurableFrames(reader: Reader): LdfConfigurableFrame[] {
  const entries: LdfConfigurableFrame[] = [];
  if (!reader.accept('{')) return entries;

  while (!reader.done() && !reader.accept('}')) {
    const nameToken = reader.next();
    if (nameToken === undefined) break;
    if (nameToken.kind === 'punct') continue;
    // LIN 2.0 lehçesi `ad = mesajKimliği ;`, 2.1/2.2 yalnız `ad ;`.
    let messageId: number | undefined;
    if (reader.accept('=')) messageId = toNumber(reader.next());
    reader.accept(';');
    entries.push({ name: nameToken.text, messageId });
  }
  return entries;
}

function parseNodeAttributeBody(reader: Reader, name: string, line: number, context: Context): LdfNodeAttributes {
  let linProtocol = '';
  let configuredNad: number | undefined;
  let initialNad: number | undefined;
  let supplierId: number | undefined;
  let functionId: number | undefined;
  let variant: number | undefined;
  let responseErrorSignal = '';
  let faultStateSignals: string[] = [];
  let p2Min: number | undefined;
  let stMin: number | undefined;
  let nAsTimeout: number | undefined;
  let nCrTimeout: number | undefined;
  let configurableFrames: LdfConfigurableFrame[] = [];

  if (!reader.accept('{')) {
    return {
      name,
      linProtocol,
      configuredNad,
      initialNad,
      supplierId,
      functionId,
      variant,
      responseErrorSignal,
      faultStateSignals,
      p2Min,
      stMin,
      nAsTimeout,
      nCrTimeout,
      configurableFrames,
      line,
    };
  }

  /** `anahtar = sayı ms ;` — birim sözcüğü yutulur. */
  const readMs = (): number | undefined => {
    reader.accept('=');
    const value = toNumber(reader.next());
    if (reader.peek()?.text === 'ms') reader.next();
    reader.accept(';');
    return value;
  };

  while (!reader.done() && !reader.accept('}')) {
    const key = reader.next();
    if (key === undefined) break;
    if (key.kind === 'punct') continue;

    switch (key.text) {
      case 'LIN_protocol': {
        reader.accept('=');
        linProtocol = reader.next()?.text ?? '';
        reader.accept(';');
        break;
      }
      case 'configured_NAD': {
        reader.accept('=');
        configuredNad = toNumber(reader.next());
        reader.accept(';');
        break;
      }
      case 'initial_NAD': {
        reader.accept('=');
        initialNad = toNumber(reader.next());
        reader.accept(';');
        break;
      }
      case 'product_id': {
        reader.accept('=');
        supplierId = toNumber(reader.next());
        reader.accept(',');
        functionId = toNumber(reader.next());
        // §9.2.2.2: variant İSTEĞE BAĞLI — yoksa `undefined` kalır, sıfır uydurulmaz.
        if (reader.accept(',')) variant = toNumber(reader.next());
        reader.accept(';');
        break;
      }
      case 'response_error': {
        reader.accept('=');
        responseErrorSignal = reader.next()?.text ?? '';
        reader.accept(';');
        break;
      }
      case 'fault_state_signals': {
        reader.accept('=');
        faultStateSignals = readIdentifierList(reader);
        reader.accept(';');
        break;
      }
      case 'P2_min': {
        p2Min = readMs();
        break;
      }
      case 'ST_min': {
        stMin = readMs();
        break;
      }
      case 'N_As_timeout': {
        nAsTimeout = readMs();
        break;
      }
      case 'N_Cr_timeout': {
        nCrTimeout = readMs();
        break;
      }
      case 'configurable_frames': {
        configurableFrames = parseConfigurableFrames(reader);
        break;
      }
      default: {
        addMalformed(context, key.line, key.text);
        reader.recover();
      }
    }
  }

  return {
    name,
    linProtocol,
    configuredNad,
    initialNad,
    supplierId,
    functionId,
    variant,
    responseErrorSignal,
    faultStateSignals,
    p2Min,
    stMin,
    nAsTimeout,
    nCrTimeout,
    configurableFrames,
    line,
  };
}

function parseNodeAttributesSection(reader: Reader, context: Context): LdfNodeAttributes[] {
  const attributes: LdfNodeAttributes[] = [];
  if (!reader.accept('{')) return attributes;

  while (!reader.done() && !reader.accept('}')) {
    const nameToken = reader.next();
    if (nameToken === undefined) break;
    if (nameToken.kind === 'punct') continue;
    attributes.push(parseNodeAttributeBody(reader, nameToken.text, nameToken.line, context));
  }
  return attributes;
}

function parseScheduleTablesSection(reader: Reader, context: Context): LdfScheduleTable[] {
  const tables: LdfScheduleTable[] = [];
  if (!reader.accept('{')) return tables;

  while (!reader.done() && !reader.accept('}')) {
    const nameToken = reader.next();
    if (nameToken === undefined) break;
    if (nameToken.kind === 'punct') continue;

    const entries: LdfScheduleEntry[] = [];
    if (!reader.accept('{')) {
      addMalformed(context, nameToken.line, nameToken.text);
      reader.recover();
      continue;
    }
    while (!reader.done() && !reader.accept('}')) {
      const commandToken = reader.next();
      if (commandToken === undefined) break;
      if (commandToken.kind === 'punct') continue;

      // Yapılandırma komutu argümanlarını `{ … }` içinde taşır (§9.2.5).
      const args: string[] = [];
      let isCommand = false;
      if (reader.peek()?.kind === 'punct' && reader.peek()?.text === '{') {
        isCommand = true;
        reader.next();
        while (!reader.done() && !reader.accept('}')) {
          const argument = reader.next();
          if (argument === undefined) break;
          if (argument.kind === 'punct') continue;
          args.push(argument.text);
        }
      }
      let delayMs: number | undefined;
      if (reader.peek()?.text === 'delay') {
        reader.next();
        delayMs = toNumber(reader.next());
        if (reader.peek()?.text === 'ms') reader.next();
      }
      reader.accept(';');
      entries.push({
        command: commandToken.text,
        arguments: args,
        delayMs,
        isFrame: !isCommand,
        line: commandToken.line,
      });
    }
    const totalDelayMs = entries.reduce((sum, entry) => sum + (entry.delayMs ?? 0), 0);
    tables.push({ name: nameToken.text, entries, totalDelayMs, line: nameToken.line });
  }
  return tables;
}

function parseEncodingBody(reader: Reader, context: Context): LdfEncodingEntry[] {
  const entries: LdfEncodingEntry[] = [];
  if (!reader.accept('{')) return entries;

  while (!reader.done() && !reader.accept('}')) {
    const kindToken = reader.next();
    if (kindToken === undefined) break;
    if (kindToken.kind === 'punct') continue;

    if (kindToken.text === 'logical_value') {
      reader.accept(',');
      const value = toNumber(reader.next());
      let text = '';
      // §9.2.6.1: metin İSTEĞE BAĞLI.
      if (reader.accept(',')) text = reader.next()?.text ?? '';
      reader.accept(';');
      if (value === undefined) {
        addMalformed(context, kindToken.line, kindToken.text);
        continue;
      }
      entries.push({ kind: 'logical', value, text, line: kindToken.line });
      continue;
    }
    if (kindToken.text === 'physical_value') {
      reader.accept(',');
      const minValue = toNumber(reader.next());
      reader.accept(',');
      const maxValue = toNumber(reader.next());
      reader.accept(',');
      const scale = toNumber(reader.next());
      reader.accept(',');
      const offset = toNumber(reader.next());
      let unit = '';
      if (reader.accept(',')) unit = reader.next()?.text ?? '';
      reader.accept(';');
      if (
        minValue === undefined ||
        maxValue === undefined ||
        scale === undefined ||
        offset === undefined
      ) {
        addMalformed(context, kindToken.line, kindToken.text);
        continue;
      }
      entries.push({ kind: 'physical', minValue, maxValue, scale, offset, unit, line: kindToken.line });
      continue;
    }
    if (kindToken.text === 'bcd_value' || kindToken.text === 'ascii_value') {
      reader.accept(';');
      entries.push({
        kind: kindToken.text === 'bcd_value' ? 'bcd' : 'ascii',
        line: kindToken.line,
      });
      continue;
    }
    addMalformed(context, kindToken.line, kindToken.text);
    reader.recover();
  }
  return entries;
}

function parseEncodingTypesSection(reader: Reader, context: Context): LdfSignalEncodingType[] {
  const types: LdfSignalEncodingType[] = [];
  if (!reader.accept('{')) return types;

  while (!reader.done() && !reader.accept('}')) {
    const nameToken = reader.next();
    if (nameToken === undefined) break;
    if (nameToken.kind === 'punct') continue;
    types.push({
      name: nameToken.text,
      entries: parseEncodingBody(reader, context),
      line: nameToken.line,
    });
  }
  return types;
}

function parseRepresentationSection(reader: Reader, context: Context): Map<string, string> {
  const map = new Map<string, string>();
  if (!reader.accept('{')) return map;

  while (!reader.done() && !reader.accept('}')) {
    const encodingToken = reader.next();
    if (encodingToken === undefined) break;
    if (encodingToken.kind === 'punct') continue;
    if (!reader.accept(':')) {
      addMalformed(context, encodingToken.line, encodingToken.text);
      reader.recover();
      continue;
    }
    for (const signalName of readIdentifierList(reader)) {
      // §9.2.6.2: bir sinyal EN ÇOK bir kodlamaya bağlanır — İLKİ kazanır.
      if (!map.has(signalName)) map.set(signalName, encodingToken.text);
    }
    reader.accept(';');
  }
  return map;
}

function parseSignalGroupsSection(reader: Reader, context: Context): LdfSignalGroup[] {
  const groups: LdfSignalGroup[] = [];
  if (!reader.accept('{')) return groups;

  while (!reader.done() && !reader.accept('}')) {
    const nameToken = reader.next();
    if (nameToken === undefined) break;
    if (nameToken.kind === 'punct') continue;
    if (!reader.accept(':')) {
      addMalformed(context, nameToken.line, nameToken.text);
      reader.recover();
      continue;
    }
    const sizeBits = toNumber(reader.next()) ?? 0;
    groups.push({
      name: nameToken.text,
      sizeBits,
      members: parsePlacementBlock(reader, context),
      line: nameToken.line,
    });
  }
  return groups;
}

function parseDiagnosticAddressesSection(reader: Reader, context: Context): LdfDiagnosticAddress[] {
  const addresses: LdfDiagnosticAddress[] = [];
  if (!reader.accept('{')) return addresses;

  while (!reader.done() && !reader.accept('}')) {
    const nodeToken = reader.next();
    if (nodeToken === undefined) break;
    if (nodeToken.kind === 'punct') continue;
    if (!reader.accept(':')) {
      addMalformed(context, nodeToken.line, nodeToken.text);
      reader.recover();
      continue;
    }
    const address = toNumber(reader.next());
    reader.accept(';');
    if (address === undefined) {
      addMalformed(context, nodeToken.line, nodeToken.text);
      continue;
    }
    addresses.push({ node: nodeToken.text, address, line: nodeToken.line });
  }
  return addresses;
}

/** Ayrıştırma sonrası ÇAPRAZ tutarlılık denetimleri — yalnız GERÇEK sorunlar. */
function validate(cluster: LdfCluster, context: Context): void {
  const signalByName = new Map(cluster.signals.map((signal) => [signal.name, signal]));
  for (const signal of cluster.diagnosticSignals) signalByName.set(signal.name, signal);

  const seenFrameIds = new Map<number, string>();
  for (const frame of cluster.frames) {
    if (frame.frameId !== undefined) {
      const existing = seenFrameIds.get(frame.frameId);
      if (existing === undefined) {
        seenFrameIds.set(frame.frameId, frame.name);
      } else {
        addIssue(context, {
          line: frame.line,
          messageKey: ISSUE_DUPLICATE_FRAME_ID,
          text: `${frame.name} ↔ ${existing}`,
        });
      }
    }

    for (const placement of frame.signals) {
      const signal = signalByName.get(placement.name);
      if (signal === undefined) {
        addIssue(context, {
          line: placement.line,
          messageKey: ISSUE_SIGNAL_NOT_DEFINED,
          text: placement.name,
        });
        continue;
      }
      if (
        frame.lengthBytes !== undefined &&
        placement.offset + signal.sizeBits > frame.lengthBytes * BITS_PER_BYTE
      ) {
        addIssue(context, {
          line: placement.line,
          messageKey: ISSUE_SIGNAL_OUT_OF_FRAME,
          text: placement.name,
        });
      }
      // §2.2.3: bayt dizisindeki her bayt TEK bir çerçeve baytına oturmalı.
      if (signal.kind === 'byte-array' && placement.offset % BITS_PER_BYTE !== 0) {
        addIssue(context, {
          line: placement.line,
          messageKey: ISSUE_UNALIGNED_BYTE_ARRAY,
          text: placement.name,
        });
      }
    }
  }

  for (const [signalName] of cluster.signalEncodingByName) {
    if (!signalByName.has(signalName)) {
      addIssue(context, {
        line: 0,
        messageKey: ISSUE_UNKNOWN_ENCODING_SIGNAL,
        text: signalName,
      });
    }
  }

  if (cluster.frames.length === 0) {
    addIssue(context, { line: 0, messageKey: ISSUE_NO_FRAMES });
  }
  if (
    cluster.speedKbps !== undefined &&
    (cluster.speedKbps < MIN_SPEED_KBPS || cluster.speedKbps > MAX_SPEED_KBPS)
  ) {
    addIssue(context, { line: 0, messageKey: ISSUE_SPEED_OUT_OF_RANGE, text: String(cluster.speedKbps) });
  }
}

/** `.ldf` metnini `LdfCluster`e çevirir. Saf ve eşzamanlıdır. */
export function parseLdf(text: string): LdfParseResult {
  if (text.trim() === '') {
    return { success: false, issues: [{ line: 0, messageKey: ISSUE_EMPTY_INPUT }] };
  }

  const tokens = tokenizeLdf(text);
  const reader = new Reader(tokens);
  const context: Context = { issues: [], malformed: 0, unknownSections: 0 };

  // §9.2: üst düzey üretimin ZORUNLU ilk belirteci. Yoksa bu bir LDF değildir.
  const first = reader.peek();
  if (first === undefined || first.text !== FILE_MARKER) {
    return { success: false, issues: [{ line: first?.line ?? 0, messageKey: ISSUE_NOT_LDF }] };
  }
  reader.next();
  reader.accept(';');

  let protocolVersion = '';
  let languageVersion = '';
  let speedKbps: number | undefined;
  let channelName = '';
  let fileRevision = '';
  let master: LdfCluster['master'] = { name: '', timeBaseMs: undefined, jitterMs: undefined };
  let slaves: string[] = [];
  let signals: LdfSignal[] = [];
  let diagnosticSignals: LdfSignal[] = [];
  const frames: LdfFrame[] = [];
  let nodeAttributes: LdfNodeAttributes[] = [];
  let scheduleTables: LdfScheduleTable[] = [];
  let encodingTypes: LdfSignalEncodingType[] = [];
  let signalEncodingByName = new Map<string, string>();
  let signalGroups: LdfSignalGroup[] = [];
  let diagnosticAddresses: LdfDiagnosticAddress[] = [];

  while (!reader.done()) {
    const token = reader.next();
    if (token === undefined) break;
    if (token.kind === 'punct') continue;

    switch (token.text) {
      case 'LIN_protocol_version': {
        reader.accept('=');
        protocolVersion = reader.next()?.text ?? '';
        reader.accept(';');
        break;
      }
      case 'LIN_language_version': {
        reader.accept('=');
        languageVersion = reader.next()?.text ?? '';
        reader.accept(';');
        break;
      }
      case 'LIN_speed': {
        reader.accept('=');
        speedKbps = toNumber(reader.next());
        // `kbps` birim sözcüğü ayrılmış (§9.2.1.3): yutulur.
        if (reader.peek()?.text === 'kbps') reader.next();
        reader.accept(';');
        break;
      }
      case 'Channel_name': {
        reader.accept('=');
        channelName = reader.next()?.text ?? '';
        reader.accept(';');
        break;
      }
      case 'Nodes': {
        const parsed = parseNodesSection(reader, context);
        master = parsed.master;
        slaves = parsed.slaves;
        break;
      }
      case 'Signals': {
        signals = parseSignalsSection(reader, context, false);
        break;
      }
      case 'Diagnostic_signals': {
        diagnosticSignals = parseSignalsSection(reader, context, true);
        break;
      }
      case 'Frames': {
        frames.push(...parseFramesSection(reader, context));
        break;
      }
      case 'Sporadic_frames': {
        frames.push(...parseSporadicFramesSection(reader, context));
        break;
      }
      case 'Event_triggered_frames': {
        frames.push(...parseEventTriggeredSection(reader, context));
        break;
      }
      case 'Diagnostic_frames': {
        frames.push(...parseDiagnosticFramesSection(reader, context));
        break;
      }
      case 'Node_attributes': {
        nodeAttributes = parseNodeAttributesSection(reader, context);
        break;
      }
      case 'Schedule_tables': {
        scheduleTables = parseScheduleTablesSection(reader, context);
        break;
      }
      case 'Signal_encoding_types': {
        encodingTypes = parseEncodingTypesSection(reader, context);
        break;
      }
      case 'Signal_representation': {
        signalEncodingByName = parseRepresentationSection(reader, context);
        break;
      }
      case 'Signal_groups': {
        signalGroups = parseSignalGroupsSection(reader, context);
        break;
      }
      case 'Diagnostic_addresses': {
        diagnosticAddresses = parseDiagnosticAddressesSection(reader, context);
        break;
      }
      default: {
        if (KNOWN_EXTRA_GLOBALS.has(token.text)) {
          reader.accept('=');
          const value = reader.next();
          if (token.text === 'LDF_file_revision') fileRevision = value?.text ?? '';
          reader.accept(';');
          break;
        }
        if (IGNORED_SECTIONS.has(token.text)) {
          reader.skipBlock();
          break;
        }
        // Bilinmeyen BÖLÜM: dengeli atlanır ve bir kez bildirilir.
        if (reader.peek()?.kind === 'punct' && reader.peek()?.text === '{') {
          if (context.unknownSections < UNKNOWN_SECTION_LIMIT) {
            context.unknownSections += 1;
            addIssue(context, {
              line: token.line,
              messageKey: ISSUE_UNKNOWN_SECTION,
              text: token.text,
            });
          }
          reader.skipBlock();
          break;
        }
        addMalformed(context, token.line, token.text);
        reader.recover();
      }
    }
  }

  const cluster: LdfCluster = {
    protocolVersion,
    languageVersion,
    speedKbps,
    channelName,
    fileRevision,
    master,
    slaves,
    signals,
    diagnosticSignals,
    frames,
    nodeAttributes,
    scheduleTables,
    encodingTypes,
    signalEncodingByName,
    signalGroups,
    diagnosticAddresses,
  };
  validate(cluster, context);

  // Sözcükleyici dosya sonunda hâlâ blok içindeyse bunu ancak burada görebiliriz.
  const openBraces = tokens.filter((item) => item.kind === 'punct' && item.text === '{').length;
  const closeBraces = tokens.filter((item) => item.kind === 'punct' && item.text === '}').length;
  if (openBraces !== closeBraces) {
    addIssue(context, { line: reader.lastLine(), messageKey: ISSUE_UNCLOSED_SECTION });
  }

  return { success: true, cluster, issues: context.issues };
}

/** Adıyla çerçeve arar; yoksa `undefined`. */
export function findLdfFrame(cluster: LdfCluster, name: string): LdfFrame | undefined {
  return cluster.frames.find((frame) => frame.name === name);
}

/** Adıyla sinyal arar — teşhis sinyalleri DAHİL. */
export function findLdfSignal(cluster: LdfCluster, name: string): LdfSignal | undefined {
  return (
    cluster.signals.find((signal) => signal.name === name) ??
    cluster.diagnosticSignals.find((signal) => signal.name === name)
  );
}

/** Bir sürüm dizesi LIN 1.x'i mi gösteriyor. `"1.3"` evet, `"2.1"`/ISO/J2602 hayır. */
function isLinOneVersion(version: string): boolean {
  return version.startsWith('1.');
}

/**
 * §2.3.1.5'in checksum modelini bu çerçeve için ÇÖZER.
 *
 * ── BU FONKSİYON NEDEN VAR ──────────────────────────────────────────────────
 * `protocols/automotive/lin/lin.ts` dosya başında şunu yazıyor: *"Hangi
 * KONVANSİYONUN (klasik: yalnız veri / geliştirilmiş: PID+veri) kullanıldığı
 * telden OKUNAMAZ — gönderenin yapılandırmasıdır."* Motor bu yüzden İKİSİNİ DE
 * hesaplayıp hangisiyle tuttuğunu söylüyor, birini "doğru" varsaymıyor.
 *
 * LDF tam olarak O YAPILANDIRMADIR. §2.3.1.5, birebir: *"Klasik ya da
 * geliştirilmiş checksum kullanımı master düğüm tarafından yönetilir ve ÇERÇEVE
 * KİMLİĞİ BAŞINA belirlenir; LIN 1.x slave düğümlerle iletişimde klasik, LIN
 * 2.x slave düğümlerle iletişimde geliştirilmiş. 60 (0x3C) ile 61 (0x3D)
 * kimlikli çerçeveler HER ZAMAN klasik checksum kullanır."*
 *
 * Yani: çerçevenin kimliği + o çerçeveye karışan SLAVE düğümün
 * `Node_attributes`taki `LIN_protocol` sürümü = model. Karar zinciri:
 *   1. Kimlik 60/61 ise → klasik, koşulsuz (`reservedDiagnostic`).
 *   2. Çerçeveye karışan slave düğümler bulunur: yayıncı slave ise odur;
 *      master yayınlıyorsa sinyallerin slave ABONELERİdir.
 *   3. Hepsi 2.x → geliştirilmiş. Herhangi biri 1.x → klasik (`mixedSlaves`
 *      ya da `linOneSlave`) — karışıkta KLASİK seçilir, çünkü 1.x slave
 *      geliştirilmişi anlamaz (§1.1.7.1).
 *   4. Hiç `Node_attributes` yoksa (LIN 1.3 dosyaları) kümenin kendi
 *      `LIN_protocol_version`ına düşülür (`clusterVersion`).
 *   5. O da yoksa `unknown` — VARSAYIM ÜRETİLMEZ.
 */
export function resolveLdfChecksumModel(cluster: LdfCluster, frame: LdfFrame): LdfChecksumResolution {
  if (frame.frameId === MASTER_REQUEST_ID || frame.frameId === SLAVE_RESPONSE_ID) {
    return { model: 'classic', reason: 'reservedDiagnostic', node: '' };
  }

  const slaveNames = new Set(cluster.slaves);
  const involved = new Set<string>();
  if (slaveNames.has(frame.publisher)) {
    involved.add(frame.publisher);
  } else {
    for (const placement of frame.signals) {
      const signal = findLdfSignal(cluster, placement.name);
      if (signal === undefined) continue;
      if (slaveNames.has(signal.publisher)) involved.add(signal.publisher);
      for (const subscriber of signal.subscribers) {
        if (slaveNames.has(subscriber)) involved.add(subscriber);
      }
    }
  }

  const versions: { node: string; version: string }[] = [];
  for (const node of involved) {
    const attributes = cluster.nodeAttributes.find((entry) => entry.name === node);
    if (attributes !== undefined && attributes.linProtocol !== '') {
      versions.push({ node, version: attributes.linProtocol });
    }
  }

  if (versions.length > 0) {
    const legacy = versions.find((entry) => isLinOneVersion(entry.version));
    if (legacy !== undefined) {
      return {
        model: 'classic',
        reason: versions.length > 1 ? 'mixedSlaves' : 'linOneSlave',
        node: legacy.node,
      };
    }
    return { model: 'enhanced', reason: 'linTwoSlave', node: versions[0]?.node ?? '' };
  }

  if (cluster.protocolVersion !== '') {
    return {
      model: isLinOneVersion(cluster.protocolVersion) ? 'classic' : 'enhanced',
      reason: 'clusterVersion',
      node: '',
    };
  }
  return { model: 'unknown', reason: 'noSlaveVersion', node: '' };
}

/**
 * Kodlama girdilerinden ham değere karşılık gelen fiziksel değeri/etiketi bulur.
 *
 * ── DOSYA SIRASI KAZANIR — VE BU BİR TERCİH DEĞİL, TEK SEÇENEK ──────────────
 * §9.2.6.1 `logical_value` ile `physical_value` arasında ÖNCELİK TANIMLAMAZ.
 * Spec'in kendi `V_battery` örneğinde çakışma yoktur (logical 0, sonra physical
 * 1-63, sonra logical 254/255 — aralıklar ayrık). Ama ÖLÇÜLDÜ: açılış
 * fixture'ında Vector'ün `encTemperature` tipi ÇAKIŞIYOR — `physical_value, 0,
 * 80, …` ile `logical_value, 0..7` aynı ham değerleri kapsıyor ve fiziksel
 * girdi dosyada ÖNCE geliyor. Bir "logical her zaman önceliklidir" kuralı
 * uydurmak, spec'in yazmadığı bir öncelik icat edip Vector'ün 0-7 arasındaki
 * sıcaklık ölçeklemesini görünmez yapardı. Bu yüzden kural DOSYA SIRASIDIR:
 * ilk eşleşen girdi kazanır. Belirsizlik dosyanın kendisindedir, motor onu
 * çözmeye çalışmaz.
 */
function applyEncoding(
  entries: readonly LdfEncodingEntry[],
  rawValue: number,
): { physicalValue: number | undefined; label: string | undefined; unit: string } {
  for (const entry of entries) {
    if (entry.kind === 'logical' && entry.value === rawValue) {
      return { physicalValue: undefined, label: entry.text, unit: '' };
    }
    if (entry.kind === 'physical' && rawValue >= entry.minValue && rawValue <= entry.maxValue) {
      // §9.2.6.1 denklem (17): physical_value = (scale × raw_value) + offset.
      return { physicalValue: entry.scale * rawValue + entry.offset, label: undefined, unit: entry.unit };
    }
  }
  return { physicalValue: undefined, label: undefined, unit: '' };
}

/**
 * Yakalanmış bir LIN çerçevesinin VERİ ALANINI, bu LDF'e göre sinyallere böler.
 *
 * Girdi çerçevenin veri alanıdır (Sync/PID/Checksum DEĞİL) — `DbcPanel`in
 * `decodeDbcMessage`e verdiği şeyle aynı sınıf girdi.
 *
 * §2.2.3: skaler sinyal LSB önce gönderilir ve bayt sınırını serbestçe
 * geçebilir → `readBits(..., 'lsb-first')`. Bayt dizisinde ise HER BAYT tek bir
 * çerçeve baytına oturmalıdır; ofset bayt sınırında değilse dosya kuralı
 * çiğniyor demektir ve okuma UYDURULMAZ (`unalignedByteArray`).
 */
export function decodeLdfFrame(
  data: Uint8Array,
  cluster: LdfCluster,
  frame: LdfFrame,
): LdfDecodedSignal[] {
  const decoded: LdfDecodedSignal[] = [];

  for (const placement of frame.signals) {
    const signal = findLdfSignal(cluster, placement.name);
    if (signal === undefined) {
      decoded.push({
        signal: {
          name: placement.name,
          sizeBits: 0,
          kind: 'scalar',
          initValue: undefined,
          initBytes: undefined,
          publisher: '',
          subscribers: [],
          diagnostic: false,
          line: placement.line,
        },
        placement,
        rawValue: undefined,
        bytes: undefined,
        physicalValue: undefined,
        label: undefined,
        unit: '',
        outOfFrame: false,
        unalignedByteArray: false,
        undefinedSignal: true,
      });
      continue;
    }

    const base = {
      signal,
      placement,
      physicalValue: undefined,
      label: undefined,
      unit: '',
      undefinedSignal: false,
    } as const;

    const fits = placement.offset >= 0 && placement.offset + signal.sizeBits <= data.length * BITS_PER_BYTE;
    if (!fits) {
      decoded.push({
        ...base,
        rawValue: undefined,
        bytes: undefined,
        outOfFrame: true,
        unalignedByteArray: false,
      });
      continue;
    }

    if (signal.kind === 'byte-array') {
      if (placement.offset % BITS_PER_BYTE !== 0) {
        decoded.push({
          ...base,
          rawValue: undefined,
          bytes: undefined,
          outOfFrame: false,
          unalignedByteArray: true,
        });
        continue;
      }
      const start = placement.offset / BITS_PER_BYTE;
      const count = Math.ceil(signal.sizeBits / BITS_PER_BYTE);
      decoded.push({
        ...base,
        rawValue: undefined,
        bytes: Array.from(data.slice(start, start + count)),
        outOfFrame: false,
        unalignedByteArray: false,
      });
      continue;
    }

    // §2.2.1: 2-16 bitlik skalerler İŞARETSİZ tamsayı — işaret uzatma YOK.
    const rawBits = readBits(data, placement.offset, signal.sizeBits, 'lsb-first');
    const rawValue = Number(rawBits);
    const encodingName = cluster.signalEncodingByName.get(signal.name);
    const encoding =
      encodingName === undefined
        ? undefined
        : cluster.encodingTypes.find((entry) => entry.name === encodingName);
    const applied =
      encoding === undefined
        ? { physicalValue: undefined, label: undefined, unit: '' }
        : applyEncoding(encoding.entries, rawValue);

    decoded.push({
      signal,
      placement,
      rawValue,
      bytes: undefined,
      physicalValue: applied.physicalValue,
      label: applied.label,
      unit: applied.unit,
      outOfFrame: false,
      unalignedByteArray: false,
      undefinedSignal: false,
    });
  }
  return decoded;
}

/** §2.3.1.4: bir çerçeve en çok sekiz bayt veri taşır. */
const MAX_FRAME_BYTES = 8;

/**
 * Çerçevenin veri alanı boyu. Bildirilmişse odur; bildirilmemişse (LIN 1.3
 * lehçesi) yerleşimlerin gerektirdiği EN KÜÇÜK boydur.
 *
 * ⚠ Bu bir UZUNLUK TÜRETMESİ DEĞİLDİR ve `LdfFrame.lengthBytes`e YAZILMAZ —
 * orası `undefined` kalır ve uyarı üretilir (dosya başındaki lehçe notu).
 * Burada yalnız "örnek veri kaç bayt olsun" sorusuna cevap veriliyor; dosyanın
 * söylemediği bir şeyi söylüyormuş gibi yapılmıyor.
 */
export function ldfFrameDataLength(frame: LdfFrame): number {
  if (frame.lengthBytes !== undefined) return frame.lengthBytes;
  let bits = 0;
  for (const placement of frame.signals) {
    bits = Math.max(bits, placement.offset + BITS_PER_BYTE);
  }
  const bytes = Math.ceil(bits / BITS_PER_BYTE);
  return Math.min(Math.max(bytes, 1), MAX_FRAME_BYTES);
}

/**
 * Çerçevenin veri alanını, DOSYANIN KENDİ bildirdiği başlangıç değerleriyle
 * doldurur — `decodeLdfFrame`in açılışta çözeceği örnek girdi budur.
 *
 * ── NEDEN SABİT BİR HEX DİZESİ DEĞİL ────────────────────────────────────────
 * Panelin ilk hâlinde örnek hex bir SABİTTİ. İki kusuru vardı ve ikincisi
 * ağırdı: (a) sabit yalnız TEK bir dosyanın TEK bir çerçevesi için doğruydu —
 * açılış fixture'ında 6 baytlık `Motor1State_Cycl`e göre yazılmıştı ama panel
 * `frames[0]`ı, yani 1 baytlık `Motor1_Dynamic`i seçiyordu, yani ekran 1
 * baytlık bir çerçeveye 6 bayt gösteriyordu; (b) kullanıcı KENDİ dosyasını
 * içe aktardığı anda o baytlar hiçbir şeye uymuyordu ve panel eski hex'i yeni
 * kümeye karşı tutmaya devam ediyordu.
 *
 * Çözüm örnek veriyi ÇERÇEVEDEN TÜRETMEK. Uydurulmuş bir desen yerine §9.2.3.1'in
 * `init_value`ları kullanılıyor: LDF her sinyal için "abone düğüm, çerçeve
 * gelene kadar BU değeri görür" der. Yani açılış ekranı dosyanın gerçekten
 * bildirdiği veriyi çözüyor — bu deponun "gerçek veri göster, uydurma"
 * çizgisinin tam karşılığı, ve hangi dosya yüklenirse yüklensin tutarlı.
 *
 * Yazım kuralları çözmenin AYNASIDIR: skaler `init_value` bit ofsetine
 * LSB-first yazılır (§2.2.3); bayt dizisi bayt sınırındaysa `init_value_array`
 * bildirim sırasıyla yazılır; HİZASIZ bayt dizisi ATLANIR — okunmayı
 * reddettiğimiz bir yerleşime yazmak da tutarsız olurdu.
 */
export function buildLdfSampleData(cluster: LdfCluster, frame: LdfFrame): Uint8Array {
  const data = new Uint8Array(ldfFrameDataLength(frame));

  for (const placement of frame.signals) {
    const signal = findLdfSignal(cluster, placement.name);
    if (signal === undefined) continue;
    if (placement.offset < 0) continue;

    if (signal.kind === 'byte-array') {
      if (placement.offset % BITS_PER_BYTE !== 0) continue;
      const start = placement.offset / BITS_PER_BYTE;
      const bytes = signal.initBytes ?? [];
      for (let index = 0; index < bytes.length; index += 1) {
        if (start + index >= data.length) break;
        data[start + index] = (bytes[index] ?? 0) & 0xff;
      }
      continue;
    }

    if (signal.sizeBits <= 0) continue;
    if (placement.offset + signal.sizeBits > data.length * BITS_PER_BYTE) continue;
    // `init_value` sinyalin boyunu aşabilir; taşan bitler KIRPILIR, yazma
    // komşu sinyalin bitlerine sarkmaz.
    const mask = (1n << BigInt(signal.sizeBits)) - 1n;
    writeBits(
      data,
      placement.offset,
      signal.sizeBits,
      BigInt(signal.initValue ?? 0) & mask,
      'lsb-first',
    );
  }
  return data;
}

/**
 * Panelin açılışta SEÇECEĞİ çerçeve. Kural, sırasıyla:
 *   1. Yerleşim taşıyan çerçeveler (sporadik olanın kendi sinyali yoktur).
 *   2. **Teşhis çerçeveleri (60/61) DIŞLANIR.** Uydurma bir tercih değil:
 *      §1.1.5.3 bu çerçevelerin veri alanının yorumunun "veri alanının
 *      kendisine VE düğümlerin durumuna" bağlı olduğunu söyler — yani anlamı
 *      LDF'te DEĞİLDİR. Sekiz opak `MasterReqB0-B7` baytı açılış ekranı için
 *      en bilgisiz seçim olurdu.
 *   3. En ÇOK sinyal taşıyan çerçeve — spec §50 "ekran boş/az bilgiyle
 *      açılmaz". `frames[0]` bu fixture'da 1 sinyalli `Motor1_Dynamic`e
 *      düşüyordu; kural onu 3 sinyalli `Motor1State_Cycl`e taşıyor.
 *   4. Eşitlikte DOSYA SIRASI — seçim belirlenimci olsun.
 * Hiçbiri yoksa (yerleşimsiz dosya) `undefined`; panel aracı hiç göstermez.
 */
export function chooseDefaultLdfFrame(cluster: LdfCluster): LdfFrame | undefined {
  const placed = cluster.frames.filter((frame) => frame.signals.length > 0);
  const preferred = placed.filter((frame) => frame.kind !== 'diagnostic');
  const pool = preferred.length > 0 ? preferred : placed;
  return pool.reduce<LdfFrame | undefined>(
    (best, frame) =>
      best === undefined || frame.signals.length > best.signals.length ? frame : best,
    undefined,
  );
}

/** Skaler sinyalin azami bit boyu — panel de aynı sınırı gösteriyor. */
export const LDF_MAX_SCALAR_BITS = MAX_SCALAR_BITS;
