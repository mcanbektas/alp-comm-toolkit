/**
 * Log Analyzer (spec §34) ortak KAYIT modeli.
 *
 * Spec on bir kaynak biçimi sayar (TXT, CSV, JSON, BIN, ASC, candump, PCAP,
 * PCAPNG, seri terminal logu, özel zaman damgalı log). Bu dosya, biçim
 * ayrıştırıcılarının HEPSİNİN indirgendiği tek ara temsili tanımlar: üstteki
 * katmanlar (filtre, istatistik, timeline, tablo) biçimi değil yalnız
 * `LogRecord`u tanır. Yeni bir biçim eklemek yalnız yeni bir ayrıştırıcı
 * yazmak demektir; UI'ya dokunulmaz.
 *
 * ── `RawFrame` NEDEN doğrudan kullanılmıyor ────────────────────────────────
 * `protocol-core/types.ts`teki `RawFrame` CANLI bağlantıdan gelen çerçevedir:
 * `direction` zorunludur, `id` üretilmiş bir UUID'dir, satır numarası ve
 * "yakalamada kesilmiş" bilgisi yoktur. Logda üçü de eksik olabilir — candump
 * satırında yön yoktur, pcap paketi `snaplen` yüzünden kesilmiş olabilir,
 * ayrıştırılamayan satırın numarası kullanıcının elindeki tek ipucudur.
 * Eksik yönü `'rx'` diye doldurmak rx/tx dağılımını sessizce uydururdu. Bu
 * yüzden `LogRecord` ayrı bir tiptir ve BİLİNMEYENİ `undefined` olarak saklar;
 * `RawFrame`e dönüşüm tüketicide, bilerek ve kayıp kabul edilerek yapılır.
 */

import type { FrameDirection } from '../types';

/** Ayrıştırıcı ailesi. `pcapng` ayrı bir değer DEĞİL: tanınır ve reddedilir (bkz. `pcap.ts`). */
export type LogSourceFormat =
  | 'pcap'
  | 'candump'
  | 'vector-asc'
  | 'delimited'
  | 'json'
  | 'hex-text'
  | 'binary';

/**
 * Zaman damgasının anlamı. `absolute` epoch ms'dir (pcap, candump'ın parantezli
 * biçimi); `relative` dosya başından geçen ms'dir (Vector ASC, çoğu terminal
 * logu); `none` dosyada hiç zaman yoktur. Üçünü ayırmak zorunlu: göreli bir
 * damgayı tarih olarak basmak 1970'i gösterir, mutlak damgayı "0.123 s" diye
 * basmak da 56 yıllık bir süre uydurur.
 */
export type LogTimestampKind = 'absolute' | 'relative' | 'none';

/**
 * Kayıt üstü işaretler. Yalnız kaynak biçimin AÇIKÇA söylediği şeyler girer —
 * çıkarım yapılmaz. `truncated` pcap `incl_len < orig_len` demektir, hata değil.
 */
export type LogRecordFlag =
  | 'extended-id'
  | 'remote-frame'
  | 'error-frame'
  | 'flexible-data-rate'
  | 'truncated';

export interface LogRecord {
  /** Kaynak sırasına göre 0 tabanlı; filtreleme sonrası da kaydın kimliği budur. */
  readonly index: number;
  /** 1 tabanlı kaynak satırı — yalnız metin biçimlerinde; ikili biçimlerde `undefined`. */
  readonly line: number | undefined;
  /** Anlamı `LogParseSummary.timestampKind`e bağlıdır; dosyada yoksa `undefined`. */
  readonly timestamp: number | undefined;
  /** Logda yön bilgisi yoksa `undefined` — `'rx'` varsayılmaz. */
  readonly direction: FrameDirection | undefined;
  /** Veri yolu/arayüz adı (`can0`, `eth0`, ASC kanal numarası). */
  readonly channel: string | undefined;
  /** Çerçeve kimliği kaynaktaki METİN hâliyle ("123", "18F00401") — sıfır dolgusu korunur. */
  readonly frameId: string | undefined;
  /** Aynı kimliğin sayısal hâli; onaltılık okunamıyorsa `undefined`. */
  readonly frameIdValue: number | undefined;
  readonly data: Uint8Array;
  /**
   * Telde/dosyada BEYAN EDİLEN uzunluk. `data.length`ten büyük olabilir
   * (kesilmiş yakalama) — istatistik telde geçen baytı bundan sayar.
   */
  readonly originalLength: number;
  readonly flags: readonly LogRecordFlag[];
}

export type LogWarningCode =
  /** Satır hiçbir kalıba uymadı, atlandı. */
  | 'unparsed-line'
  /** Veri alanı onaltılık okunamadı. */
  | 'bad-hex'
  /** Zaman damgası sayıya çevrilemedi; kayıt zamansız alındı. */
  | 'bad-timestamp'
  /** Yakalama kesilmiş paket içeriyor (`incl_len < orig_len`). */
  | 'truncated-packet'
  /** Kayıt sınırına ulaşıldı, dosyanın kalanı okunmadı. */
  | 'record-limit'
  /** Sütun eşlemesi istenen alanı bulamadı. */
  | 'missing-column';

export interface LogWarning {
  readonly code: LogWarningCode;
  readonly message: string;
  /** 1 tabanlı satır, biliniyorsa. */
  readonly line?: number;
  /** Aynı kodun kaç kez tekrarladığı — 100 bin satırlık logda uyarı listesi taşmasın diye toplanır. */
  readonly count: number;
}

export interface LogParseSummary {
  readonly format: LogSourceFormat;
  readonly timestampKind: LogTimestampKind;
  readonly recordCount: number;
  /** Metin biçimlerinde okunan toplam satır; ikili biçimlerde `undefined`. */
  readonly totalLines: number | undefined;
  /** Ayrıştırılamayıp atlanan satır sayısı (yorum/boş satır SAYILMAZ). */
  readonly skippedLines: number;
  /** Kayıt sınırı yüzünden dosyanın kalanı okunmadıysa `true`. */
  readonly limitReached: boolean;
  /** Biçime özel tek satırlık künye (pcap link-type'ı, tespit edilen ayraç…). */
  readonly detail: string | undefined;
}

export type LogParseErrorCode =
  | 'empty-input'
  | 'unsupported-format'
  | 'file-too-large'
  | 'no-records'
  /** Ayraçlı dosyada veri sütunu tahmin edilemedi; kullanıcı elle seçmeli. */
  | 'missing-data-column'
  | 'source-error';

export interface LogParseFailure {
  readonly status: 'error';
  readonly code: LogParseErrorCode;
  readonly message: string;
}

export interface LogParseSuccess {
  readonly status: 'ok';
  readonly summary: LogParseSummary;
  readonly records: readonly LogRecord[];
  readonly warnings: readonly LogWarning[];
}

export type LogParseResult = LogParseSuccess | LogParseFailure;

export interface LogParseOptions {
  /**
   * Bellekte tutulacak azami kayıt. Aşılınca ayrıştırma DURUR ve
   * `limitReached` işaretlenir — sessizce baştan kırpmak, kullanıcının
   * gördüğü "son paket" ile dosyanın sonunu farklı yapardı.
   */
  readonly maxRecords?: number;
}

/**
 * 200 bin kayıt: 8 baytlık CAN çerçevesiyle ~40 MB'lık bir candump logunun
 * tamamı; sanallaştırılmış tabloda akıcı kalan üst sınır. Spec §41 "dosya
 * boyutu sınırı uygula" maddesinin bu katmandaki karşılığı.
 */
export const DEFAULT_MAX_LOG_RECORDS = 200_000;
