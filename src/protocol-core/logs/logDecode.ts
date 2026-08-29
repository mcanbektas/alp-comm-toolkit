/**
 * Log kayıtlarını kayıtlı bir protokol motoruyla çözümleme (spec §34
 * "Protocol auto-detection", "Frame extraction", "CRC validation").
 *
 * ── `canParse` NEDEN KULLANILMIYOR ────────────────────────────────────────
 * `ProtocolParser.canParse` UCUZ bir ön eleyicidir ve deponun ölçülmüş
 * gerçeği şudur: naif bir `canParse` registry örnek çerçevelerinin %54'ünde
 * yanlış pozitif verir (bkz. `decoding/pulseLog.ts` başındaki not). Bir logun
 * hangi protokol olduğunu `canParse` sayımıyla ilan etmek, kullanıcıya
 * inandırıcı ama yanlış bir cevap verirdi. Bu yüzden ölçüt `parse()`in
 * GERÇEKTEN başarılı olmasıdır — checksum/CRC doğrulaması da o yolda çalışır.
 *
 * ── ÇÖKME YUTULUR, GİZLENMEZ ──────────────────────────────────────────────
 * Bir eklenti beklenmedik baytta istisna fırlatabilir. 200 bin kayıtlık bir
 * taramada tek bir istisna tüm sayfayı beyaza düşürmemeli; `crashed` ayrı bir
 * sonuç türü olarak SAYILIR ve kullanıcıya gösterilir (sessizce `failed`e
 * katmak, motorun hatasını protokol uyuşmazlığı gibi gösterirdi).
 */

import type { ParseResult, ProtocolParser } from '../types';
import type { LogRecord } from './types';

export type LogDecodeOutcome =
  | { readonly kind: 'parsed'; readonly result: ParseResult }
  | { readonly kind: 'crashed'; readonly detail: string };

export function decodeLogRecord(parser: ProtocolParser, record: LogRecord): LogDecodeOutcome {
  try {
    return { kind: 'parsed', result: parser.parse(record.data) };
  } catch (cause) {
    return { kind: 'crashed', detail: cause instanceof Error ? cause.message : String(cause) };
  }
}

export interface LogDecodeSummary {
  readonly protocolId: string;
  /** Denenen kayıt sayısı — örneklem sınırı yüzünden toplamdan küçük olabilir. */
  readonly attempted: number;
  readonly succeeded: number;
  readonly failed: number;
  readonly crashed: number;
  /** Başarı oranı yüzde; hiç deneme yapılmadıysa `undefined` — sıfır DEĞİL. */
  readonly successRatePercent: number | undefined;
}

const PERCENT = 100;

/**
 * Motoru kayıtların bir ÖRNEKLEMİNE uygular. Örneklem baştan alınır (rastgele
 * değil): log dosyaları çoğu zaman tek bir oturumun başından itibaren
 * homojendir ve rastgele seçim aynı girdide farklı sonuç üreterek karşılaştırmayı
 * tekrarlanamaz kılardı.
 */
export function summarizeLogDecode(
  protocolId: string,
  parser: ProtocolParser,
  records: readonly LogRecord[],
  sampleSize: number,
): LogDecodeSummary {
  const sample = records.slice(0, Math.max(0, sampleSize));
  let succeeded = 0;
  let failed = 0;
  let crashed = 0;

  for (const record of sample) {
    const outcome = decodeLogRecord(parser, record);
    if (outcome.kind === 'crashed') crashed += 1;
    else if (outcome.result.success) succeeded += 1;
    else failed += 1;
  }

  return {
    protocolId,
    attempted: sample.length,
    succeeded,
    failed,
    crashed,
    successRatePercent: sample.length === 0 ? undefined : (succeeded / sample.length) * PERCENT,
  };
}
