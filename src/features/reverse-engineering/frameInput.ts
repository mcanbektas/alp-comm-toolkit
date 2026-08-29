/**
 * Kullanıcının yapıştırdığı ham dökümü analiz çerçevelerine çevirir.
 *
 * Analiz motorları `AnalysisFrame[]` ister (`protocol-core/analysis/types.ts`);
 * kullanıcının elinde ise bir metin kutusu dolusu onaltılık vardır. Aradaki
 * dönüşüm BURADA, feature katmanında durur — `analysis/` bilerek girdi
 * biçimlerinden habersiz kalır (dosya başı yorumu: "dönüştürme çağıranın işi").
 *
 * ── İKİ MOD, ÇÜNKÜ İKİ FARKLI ELDEKİ VERİ ─────────────────────────────────
 * `lines`: her satır bir çerçeve. Terminal dökümü, analizör kopyası, elle
 * yazılmış örnek — çerçeve sınırı zaten satır sonudur, çerçeveleme yöntemi
 * SORULMAZ, uydurulmuş bir seçim kullanıcıyı yanıltır.
 * `stream`: bütün satırlar tek bir bayt akışına eklenir ve `protocol-core/
 * framing`in extractor'ı sınırları bulur. Ham UART/TCP dökümünde satır sonu
 * çerçeve sınırı DEĞİLDİR, orada yöntem seçmek zorunludur.
 *
 * Çerçeveleme `createStreamBuffer` üstünden koşar, elle bir çıkarım döngüsü
 * yazılmaz: hatadan kurtulma, kısmi çerçeve ve sonsuz döngü koruması orada
 * zaten çözülmüş; ikinci bir kopya yalnız birinde düzeltilen hatalar üretir.
 *
 * ── AYRAÇLAR VE ZAMAN DAMGASI ─────────────────────────────────────────────
 * Ayraç olarak boşluk, virgül, iki nokta ve tire kabul edilir (`AA:BB:CC` ve
 * `AA-BB-CC` yaygın kopyalama biçimleri), `0x` öneki atılır. Zaman damgası
 * bu yüzden yalnız KÖŞELİ PARANTEZLE yazılabilir (`[1712.5] AA BB`): `1712.5:`
 * gibi bir önek iki nokta ayraç olduğu için hex'ten ayırt edilemezdi ve
 * `1712` sessizce iki bayt olarak okunurdu — sessiz yanlış okuma, açık bir
 * biçim şartından kötüdür.
 *
 * Bozuk satır ATLANIR ama SAYILIR: 900 satırın 3'ü bozuksa analiz yapılabilir,
 * ama kullanıcı hangi satırların düştüğünü görmeden sonuca güvenmemeli.
 */

import { createExtractorFromConfig } from '../../protocol-core/framing/createExtractor';
import { createStreamBuffer } from '../../protocol-core/streams/streamBuffer';
import type { FramingMethodConfig } from '../../protocol-core/framing/createExtractor';
import type { AnalysisFrame } from '../../protocol-core/analysis/types';

export type FrameInputMode = 'lines' | 'stream';

export interface FrameInputIssue {
  /** 1 tabanlı kaynak satırı — kullanıcı metin kutusunda o satırı bulacak. */
  readonly line: number;
  readonly reason: 'odd-digits' | 'not-hex';
  /** Sorunlu parça; uzun satırda tamamı değil ilk kusurlu belirteç. */
  readonly text: string;
}

export interface FrameInputResult {
  readonly frames: readonly AnalysisFrame[];
  readonly issues: readonly FrameInputIssue[];
  /** Okunan toplam bayt — `stream` modunda çerçeveleme öncesi büyüklük. */
  readonly byteCount: number;
  /** `maxFrames` sınırı yüzünden kesildiyse `true`. */
  readonly truncated: boolean;
}

export interface FrameInputOptions {
  readonly mode?: FrameInputMode;
  /** Yalnız `stream` modunda okunur. */
  readonly framing?: FramingMethodConfig;
  /** Tarayıcıyı kilitlememek için üst sınır; §44'ün 100k çerçeve hedefi. */
  readonly maxFrames?: number;
  readonly maxFrameLength?: number;
}

const DEFAULT_MAX_FRAMES = 100_000;
const DEFAULT_MAX_FRAME_LENGTH = 4096;
/** Zaman tabanlı çerçevelemede son çerçeveyi kapatan sanal sessizlik. */
const FLUSH_SILENCE_MS = 1_000_000;

const COMMENT_PATTERN = /(#|\/\/).*$/;
const TIMESTAMP_PATTERN = /^\s*\[\s*(-?\d+(?:\.\d+)?)\s*\]\s*/;
const SEPARATOR_PATTERN = /[\s,:-]+/;
const HEX_PATTERN = /^[0-9a-fA-F]+$/;

interface ParsedLine {
  readonly line: number;
  readonly bytes: Uint8Array | undefined;
  readonly timestamp: number | undefined;
  readonly issue: FrameInputIssue | undefined;
}

function parseLine(raw: string, line: number): ParsedLine {
  const withoutComment = raw.replace(COMMENT_PATTERN, '');
  const timestampMatch = TIMESTAMP_PATTERN.exec(withoutComment);
  const timestamp = timestampMatch === null ? undefined : Number.parseFloat(timestampMatch[1] ?? '');
  const body = timestampMatch === null ? withoutComment : withoutComment.slice(timestampMatch[0].length);

  const trimmed = body.trim();
  if (trimmed.length === 0) {
    // Boş satır bir hata değil, yalnız veri taşımıyor: sessizce atlanır.
    return { line, bytes: undefined, timestamp: undefined, issue: undefined };
  }

  const tokens = trimmed
    .split(SEPARATOR_PATTERN)
    .map((token) => (token.startsWith('0x') || token.startsWith('0X') ? token.slice(2) : token))
    .filter((token) => token.length > 0);

  const digits: string[] = [];
  for (const token of tokens) {
    if (!HEX_PATTERN.test(token)) {
      return { line, bytes: undefined, timestamp: undefined, issue: { line, reason: 'not-hex', text: token } };
    }
    if (token.length % 2 !== 0) {
      // Tek haneli belirteç bayt sınırını belirsiz bırakır: "A B" mi "AB" mi?
      return { line, bytes: undefined, timestamp: undefined, issue: { line, reason: 'odd-digits', text: token } };
    }
    digits.push(token);
  }

  const joined = digits.join('');
  const bytes = new Uint8Array(joined.length / 2);
  for (let index = 0; index < bytes.length; index++) {
    bytes[index] = Number.parseInt(joined.slice(index * 2, index * 2 + 2), 16);
  }

  return { line, bytes, timestamp, issue: undefined };
}

function framesFromStream(
  chunks: readonly Uint8Array[],
  framing: FramingMethodConfig,
  maxFrames: number,
  maxFrameLength: number,
): { frames: AnalysisFrame[]; truncated: boolean } {
  const frames: AnalysisFrame[] = [];
  let truncated = false;

  const extractor = createExtractorFromConfig(framing);
  const buffer = createStreamBuffer(extractor, { maxFrameLength });
  buffer.onFrame((frame) => {
    if (frames.length >= maxFrames) {
      truncated = true;
      return;
    }
    // `slice`: çerçeve arabelleğin bir görünümü olabilir, arabellek ise
    // sonraki `push`ta yeniden yazılır (`simulatedProtocol.ts:191` aynı tuzak).
    frames.push({ bytes: frame.bytes.slice(), timestamp: undefined });
  });

  // Tek parça olarak itmek yerine satır satır itmenin bir faydası yok; akış
  // modunda satır sınırı zaten anlamsız sayılıyor.
  let total = 0;
  for (const chunk of chunks) total += chunk.length;
  const merged = new Uint8Array(total);
  let cursor = 0;
  for (const chunk of chunks) {
    merged.set(chunk, cursor);
    cursor += chunk.length;
  }
  buffer.push(merged, 0);
  // Zaman tabanlı yöntemlerde son çerçeve ancak sessizlikle kapanır; dosya
  // bittiğine göre sessizlik sonsuzdur.
  buffer.tick(FLUSH_SILENCE_MS);

  return { frames, truncated };
}

export function parseFrameInput(text: string, options: FrameInputOptions = {}): FrameInputResult {
  const mode = options.mode ?? 'lines';
  const maxFrames = options.maxFrames ?? DEFAULT_MAX_FRAMES;
  const maxFrameLength = options.maxFrameLength ?? DEFAULT_MAX_FRAME_LENGTH;

  const issues: FrameInputIssue[] = [];
  const chunks: Uint8Array[] = [];
  const frames: AnalysisFrame[] = [];
  let byteCount = 0;
  let truncated = false;

  const lines = text.split(/\r?\n/);
  for (let index = 0; index < lines.length; index++) {
    const parsed = parseLine(lines[index] ?? '', index + 1);
    if (parsed.issue !== undefined) {
      issues.push(parsed.issue);
      continue;
    }
    if (parsed.bytes === undefined || parsed.bytes.length === 0) continue;

    byteCount += parsed.bytes.length;
    if (mode === 'stream') {
      chunks.push(parsed.bytes);
      continue;
    }
    if (frames.length >= maxFrames) {
      truncated = true;
      break;
    }
    frames.push({ bytes: parsed.bytes, timestamp: parsed.timestamp });
  }

  if (mode === 'stream') {
    const framing = options.framing;
    if (framing === undefined) {
      // Yöntem seçilmeden akış çerçevelenemez; boş sonuç dönmek, rastgele bir
      // varsayılan yöntemle yanlış çerçeve üretmekten dürüsttür.
      return { frames: [], issues, byteCount, truncated: false };
    }
    const extracted = framesFromStream(chunks, framing, maxFrames, maxFrameLength);
    return { frames: extracted.frames, issues, byteCount, truncated: extracted.truncated };
  }

  return { frames, issues, byteCount, truncated };
}

/**
 * Log Analyzer'ın çözdüğü kayıtları analiz çerçevesine çevirir.
 *
 * Yalnız `data` alınır: kimlik/kanal/yön kaydın METİN çevresidir, telde geçen
 * baytlar değil. Bir CAN kaydının kimliği ayrı bir sütundur ve payload'ın
 * başına eklenirse "sabit bayt" ve sütun hizası olduğu gibi kayar.
 *
 * `originalLength` DEĞİL `data.length` esas alınır: kesilmiş yakalamada beyan
 * edilen uzunluk kadar bayt elde YOKTUR, eksik baytı sıfırla doldurmak sahte
 * sabit sütun üretirdi.
 */
export function framesFromLogRecords(
  records: readonly { readonly data: Uint8Array; readonly timestamp: number | undefined }[],
  options: { readonly maxFrames?: number } = {},
): FrameInputResult {
  const maxFrames = options.maxFrames ?? DEFAULT_MAX_FRAMES;
  const frames: AnalysisFrame[] = [];
  let byteCount = 0;
  let truncated = false;

  for (const record of records) {
    if (record.data.length === 0) continue;
    if (frames.length >= maxFrames) {
      truncated = true;
      break;
    }
    byteCount += record.data.length;
    frames.push({ bytes: record.data, timestamp: record.timestamp });
  }

  return { frames, issues: [], byteCount, truncated };
}
