/**
 * PTP 80-bit zaman damgası ve `correctionField` aritmetiği (IEEE 1588-2019 §5.3.3).
 *
 * ── `ntpTimestamp.ts` İLE PAYLAŞILMAMASININ GEREKÇESİ ───────────────────────
 * Kardeş dosyanın başında ayrıntısı var; özeti: NTP damgası 64 bit (32 s +
 * 32 bit 2^-32 kesir, epoch 1900 UTC), PTP damgası 80 bit (48 bit saniye +
 * 32 bit TAM SAYI nanosaniye, epoch 1970 TAI). Ortak motor kesir alanının
 * birimini tek seçmek zorunda kalır ve diğerini sessizce 4295 kat yanlış
 * ölçekler. İki dosya bilerek yan yana duruyor.
 *
 * ── EPOCH TAI'DİR, UTC DEĞİL ────────────────────────────────────────────────
 * PTP zaman ölçeği varsayılan olarak TAI'dir ve TAI artık saniye BİLMEZ.
 * UTC'ye çevirmek için `currentUtcOffset` gerekir (2026'da 37 s) — bu alan
 * YALNIZ Announce mesajında taşınır. Bir Sync ya da Follow_Up damgası tek
 * başına UTC'ye çevrilemez; bu yüzden burada üretilen ISO metni TAI ölçeğinde
 * okunmalıdır ve çağıran bunu kullanıcıya söylemek zorundadır.
 *
 * ── SIFIR DAMGA ─────────────────────────────────────────────────────────────
 * NTP'dekiyle aynı kural: 80 bitin tamamı sıfırsa alan taşınmamış demektir
 * (two-step Sync'in `originTimestamp`ı tipik olarak sıfırdır — asıl damga
 * Follow_Up'ta gelir). "1970-01-01" basmak uydurma olur.
 */

/** 48 bit saniye + 32 bit nanosaniye. */
export const PTP_TIMESTAMP_LENGTH = 10;

/** `correctionField` NANOSANİYE × 2^16'dır — düz nanosaniye DEĞİL. */
export const CORRECTION_FIELD_SCALE = 65536;

const NANOSECONDS_PER_SECOND = 1_000_000_000;
const MILLISECONDS_PER_SECOND = 1000;
const NANOSECONDS_PER_MILLISECOND = 1_000_000;

export interface PtpTimestamp {
  /** 48 bitlik saniye alanı; `Number.MAX_SAFE_INTEGER`ın çok altında kalır. */
  readonly seconds: number;
  /** 32 bitlik nanosaniye alanı (tam sayı, 0…999 999 999 beklenir). */
  readonly nanoseconds: number;
  /** 80 bitin tamamı sıfır — alan taşınmamış (dosya başı). */
  readonly unset: boolean;
  /** Nanosaniye alanı bir saniyeyi aşıyor: tel bozuk ya da üretici hatalı. */
  readonly nanosecondsOutOfRange: boolean;
  /** TAI ölçeğinde ISO-8601 metni; `unset` ise `undefined` (dosya başı). */
  readonly taiIso?: string;
}

function byteAt(data: Uint8Array, offset: number): number {
  return data[offset] ?? 0;
}

function readUint16BE(data: Uint8Array, offset: number): number {
  return (byteAt(data, offset) << 8) | byteAt(data, offset + 1);
}

function readUint32BE(data: Uint8Array, offset: number): number {
  return (
    ((byteAt(data, offset) << 24) |
      (byteAt(data, offset + 1) << 16) |
      (byteAt(data, offset + 2) << 8) |
      byteAt(data, offset + 3)) >>>
    0
  );
}

/**
 * 10 baytlık PTP damgasını çözer. 48 bitlik saniye üst 16 bit + alt 32 bit
 * olarak toplanır; `<<` 32 bitte taştığı için ÇARPMA kullanılır — `high << 32`
 * JavaScript'te sıfır verirdi ve saniye alanı sessizce kaybolurdu.
 */
export function readPtpTimestamp(data: Uint8Array, offset: number): PtpTimestamp {
  const secondsHigh = readUint16BE(data, offset);
  const secondsLow = readUint32BE(data, offset + 2);
  const seconds = secondsHigh * 2 ** 32 + secondsLow;
  const nanoseconds = readUint32BE(data, offset + 6);

  if (seconds === 0 && nanoseconds === 0) {
    return { seconds, nanoseconds, unset: true, nanosecondsOutOfRange: false };
  }

  const nanosecondsOutOfRange = nanoseconds >= NANOSECONDS_PER_SECOND;
  const unixMilliseconds = seconds * MILLISECONDS_PER_SECOND + nanoseconds / NANOSECONDS_PER_MILLISECOND;

  return {
    seconds,
    nanoseconds,
    unset: false,
    nanosecondsOutOfRange,
    taiIso: new Date(unixMilliseconds).toISOString(),
  };
}

/** Damgayı tek bir nanosaniye sayısına indirger; `unset` ise `undefined`. */
export function ptpTotalNanoseconds(timestamp: PtpTimestamp): number | undefined {
  if (timestamp.unset) return undefined;
  return timestamp.seconds * NANOSECONDS_PER_SECOND + timestamp.nanoseconds;
}

/**
 * `correctionField`: İŞARETLİ 64 bit, birimi nanosaniye × 2^16.
 *
 * `BigInt` üzerinden okunur çünkü 64 bit `number`ın güvenli tam sayı aralığını
 * aşabilir; işaret ise iki tümleyendir — üst bit 1 ise 2^64 çıkarılır. Bunu
 * işaretsiz okumak transparent clock'un NEGATİF düzeltmesini 1.8×10^19 gibi
 * saçma bir sayıya çevirirdi.
 */
export function readCorrectionFieldNanoseconds(data: Uint8Array, offset: number): number {
  let value = 0n;
  for (let index = 0; index < 8; index += 1) {
    value = (value << 8n) | BigInt(byteAt(data, offset + index));
  }
  if (value >= 1n << 63n) value -= 1n << 64n;
  return Number(value) / CORRECTION_FIELD_SCALE;
}

/**
 * Clock Identity: 8 bayt, EUI-64. Tipik olarak MAC adresinden türetilir
 * (`xx:xx:xx:FF:FE:xx:xx:xx`) ama bu ZORUNLU DEĞİLDİR — MAC'i geri çıkarmaya
 * çalışmak, uymayan üreticilerde uydurma adres üretir. Yalnız iki nokta üst
 * üsteli onaltılık gösterim verilir.
 */
export function formatClockIdentity(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join(':');
}
