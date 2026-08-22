/**
 * NTP 64-bit zaman damgası (RFC 5905 §6, "NTP Timestamp Format").
 *
 * ── NEDEN AYRI DOSYA, AMA NEDEN `protocol-core` DEĞİL ───────────────────────
 * Dalga 12'nin brief'i (`docs/brief-faz10-dalga12.md:91`) 12d için `networkTimestamp`
 * adında PAYLAŞILAN bir kaldıraç öngörüyordu: "Ortak 64-bit zaman damgası
 * aritmetiği; NTP dört-damga modeli PTP E2E delay'in sadeleştirilmiş hâli".
 *
 * Bu öngörü BİT DÜZEYİNDE YANLIŞ ÇIKTI — 12b'nin LLDP/DHCP "TLV" varsayımıyla
 * aynı cinsten bir hata:
 *
 *   NTP damgası : 64 bit = 32 bit saniye + 32 bit KESİR (2^-32 s birimli),
 *                 epoch 1900-01-01 UTC, era sarmalı 2036-02-07.
 *   PTP damgası : 80 bit = 48 bit saniye + 32 bit NANOSANİYE (tam sayı),
 *                 epoch 1970-01-01 **TAI** (UTC değil).
 *
 * Ortak olan tek şey "saniye + altbölüm" fikri; genişlikler, altbölümün BİRİMİ,
 * epoch'u ve zaman ölçeği (UTC/TAI) farklı. Paylaşılan bir motor kesir alanını
 * ya 2^-32 ya nanosaniye kabul etmek zorunda kalır ve diğerini SESSİZCE yanlış
 * ölçeklerdi. Bu yüzden `protocol-core/decoding` altına ortak modül AÇILMADI;
 * `ptp.ts` kendi 80-bit okuyucusunu yazar (12c'deki `dnsWire.ts` durumunun
 * TERSİ — orada iki protokol gerçekten AYNI teli okuyordu).
 *
 * Dosya yine de `ntp.ts`ten ayrı duruyor: era mantığı ve "sıfır = ayarlanmamış"
 * kuralı kendi başına test edilebilir birimler, parser gövdesine gömülünce
 * doğrulanamaz hâle gelirler.
 *
 * ── ERA SARMALI (RFC 4330 §3, RFC 5905 §6) ──────────────────────────────────
 * 32 bitlik saniye alanı 136 yılda dolar. Tek damgaya bakarak hangi era'da
 * olduğumuz BİLİNEMEZ; RFC'nin verdiği pratik kural uygulanır: saniyenin en
 * anlamlı biti 1 ise era 0 (1968-2036), 0 ise era 1 (2036-2104). Kural bir
 * VARSAYIMDIR, çerçevede kanıtı yoktur — bu yüzden dönen değer era'yı da
 * taşır ve çağıran bunu kullanıcıya söyleyebilir.
 *
 * ── SIFIR DAMGA "1900" DEĞİLDİR ─────────────────────────────────────────────
 * 64 bitin tamamı sıfırsa alan AYARLANMAMIŞ demektir (istemci isteğinde Origin
 * Timestamp tipik olarak sıfırdır). "1900-01-01T00:00:00Z" basmak burada
 * uydurma olur: veri yok, tarih de yok.
 */

/** 1900-01-01 ile 1970-01-01 arasındaki saniye farkı (70 yıl + 17 artık gün). */
const NTP_EPOCH_TO_UNIX_SECONDS = 2_208_988_800;

/**
 * Era 1'in başlangıcı (2036-02-07T06:28:16Z) Unix saniyesi cinsinden.
 * `2^32 - NTP_EPOCH_TO_UNIX_SECONDS` ile aynı sayıdır; sabit olarak yazılıyor ki
 * okuyan "era 1 nereden başlıyor" sorusunu hesap yapmadan görebilsin.
 */
const NTP_ERA1_UNIX_SECONDS = 2_085_978_496;

const FRACTION_DIVISOR = 2 ** 32;
const MILLISECONDS_PER_SECOND = 1000;
const SECONDS_MSB_MASK = 0x80000000;

/** Zaman damgası alanının tel üzerindeki genişliği. */
export const NTP_TIMESTAMP_LENGTH = 8;

export interface NtpTimestamp {
  /** Tel üzerindeki 64 bitin tamamı — `ParsedField.rawValue` için. */
  readonly raw: bigint;
  /** Üst 32 bit: NTP epoch'undan beri saniye. */
  readonly seconds: number;
  /** Alt 32 bit: 2^-32 saniye birimli kesir. */
  readonly fraction: number;
  /** Saniye + kesir, ondalık saniye olarak (kesir kaybı 2^-32 s mertebesinde). */
  readonly totalSeconds: number;
  /** 64 bitin tamamı sıfır — alan AYARLANMAMIŞ (dosya başı). */
  readonly unset: boolean;
  /** MSB kuralının verdiği era; `unset` ise anlamsızdır (dosya başı). */
  readonly era: 0 | 1;
  /** Unix epoch milisaniyesi; `unset` ise `undefined`. */
  readonly unixMilliseconds?: number;
  /** ISO-8601 UTC metni; `unset` ise `undefined`. */
  readonly iso?: string;
}

function byteAt(data: Uint8Array, offset: number): number {
  return data[offset] ?? 0;
}

/** İşaretsiz 32 bit — `<<` işaretli 32-bit sonuç verdiği için `>>> 0` şart. */
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
 * 8 baytlık NTP damgasını çözer. Tampon kısaysa eksik baytlar sıfır sayılır —
 * çağıran kesilmeyi zaten `truncated-frame` ile bildirir, burada exception
 * fırlatmak kısmi çözümü (spec §47) engellerdi.
 */
export function readNtpTimestamp(data: Uint8Array, offset: number): NtpTimestamp {
  const seconds = readUint32BE(data, offset);
  const fraction = readUint32BE(data, offset + 4);
  const raw = (BigInt(seconds) << 32n) | BigInt(fraction);

  if (seconds === 0 && fraction === 0) {
    return { raw, seconds, fraction, totalSeconds: 0, unset: true, era: 0 };
  }

  const era: 0 | 1 = (seconds & SECONDS_MSB_MASK) !== 0 ? 0 : 1;
  const unixSeconds =
    era === 0 ? seconds - NTP_EPOCH_TO_UNIX_SECONDS : seconds + NTP_ERA1_UNIX_SECONDS;
  const fractionalSeconds = fraction / FRACTION_DIVISOR;
  const unixMilliseconds = unixSeconds * MILLISECONDS_PER_SECOND + fractionalSeconds * MILLISECONDS_PER_SECOND;

  return {
    raw,
    seconds,
    fraction,
    totalSeconds: seconds + fractionalSeconds,
    unset: false,
    era,
    unixMilliseconds,
    iso: new Date(unixMilliseconds).toISOString(),
  };
}

/**
 * İki damga arasındaki farkı MİLİSANİYE olarak verir.
 *
 * Fark `totalSeconds` üzerinden alınır, ham 64-bit çıkarmasıyla DEĞİL: iki damga
 * farklı era'lardaysa ham çıkarma 136 yıllık saçma bir fark üretir. `unset`
 * damgayla fark hesaplanmaz — `undefined` döner, çağıran bunu "hesaplanamaz"
 * diye gösterir.
 */
export function ntpDeltaMilliseconds(from: NtpTimestamp, to: NtpTimestamp): number | undefined {
  if (from.unset || to.unset) return undefined;
  if (from.era !== to.era) return undefined;
  return (to.totalSeconds - from.totalSeconds) * MILLISECONDS_PER_SECOND;
}

/**
 * `Poll` ve `Precision` alanlarının ortak biçimi: 2 tabanlı logaritma, İŞARETLİ
 * 8 bit (RFC 5905 §7.3). `0xE9` = -23 → 2^-23 s ≈ 119 ns. İşaretsiz okumak
 * Precision'ı 233 saniye gibi gösterirdi — sessiz ve büyük bir hata.
 */
export function readSignedByte(data: Uint8Array, offset: number): number {
  const value = byteAt(data, offset);
  return value > 0x7f ? value - 0x100 : value;
}

/**
 * NTP Short Format (RFC 5905 §6): 16 bit saniye + 16 bit kesir, işaretsiz.
 * Root Delay ve Root Dispersion bu biçimdedir — 32 bitlik tam sayı DEĞİL.
 */
export function readNtpShortMilliseconds(data: Uint8Array, offset: number): number {
  return (readUint32BE(data, offset) / 65536) * MILLISECONDS_PER_SECOND;
}
