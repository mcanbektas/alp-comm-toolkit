/**
 * Metin tabanlı log biçimlerinin (candump, Vector ASC, seri terminal dökümü,
 * CSV/TXT) ORTAK ayrıştırma yardımcıları. Üç ayrı ayrıştırıcının aynı hex ve
 * zaman kalıplarını kendi başına yeniden yazması, aynı hatayı üç kez düzeltmek
 * demekti; hepsi buradan geçer.
 *
 * `buffers/representation.ts`teki `hexToBytes` BİLEREK kullanılmıyor: o, sınır
 * katmanı olduğu için geçersiz girdide HATA FIRLATIR. Log ayrıştırıcısı ise
 * 100 bin satırın içindeki tek bozuk satırda çökemez — bozuk satırı atlayıp
 * uyarı üretmek zorundadır. Buradaki okuyucular bu yüzden `undefined` döner.
 */

const HEX_RADIX = 16;
const HEX_DIGITS_PER_BYTE = 2;
const SECONDS_TO_MILLISECONDS = 1000;
const MINUTES_TO_SECONDS = 60;
const HOURS_TO_MINUTES = 60;

/** Bayt sınırı ayracı olarak kabul edilen karakterler: boşluk, `-`, `:`, `,`. */
const BYTE_SEPARATOR_PATTERN = /[\s\-:,]+/g;
const HEX_ONLY_PATTERN = /^[0-9a-fA-F]*$/;
/** `0x` öneki tek bayt gruplarında da (`0xAA 0xBB`) görülür; baştan silinir. */
const HEX_PREFIX_PATTERN = /0[xX]/g;

/**
 * Serbest metinden bayt dizisi okur. Ayraçlar ve `0x` önekleri temizlenir,
 * kalan hane sayısı TEK ise `undefined` döner — tek hane son baytın yarısıdır
 * ve sessizce yuvarlanamaz (yarım bayt uydurmak, uzunluk istatistiğini bozar).
 */
export function readHexBytes(text: string): Uint8Array | undefined {
  const stripped = text.replace(HEX_PREFIX_PATTERN, '').replace(BYTE_SEPARATOR_PATTERN, '');
  if (stripped.length === 0) return new Uint8Array(0);
  if (stripped.length % HEX_DIGITS_PER_BYTE !== 0) return undefined;
  if (!HEX_ONLY_PATTERN.test(stripped)) return undefined;

  const bytes = new Uint8Array(stripped.length / HEX_DIGITS_PER_BYTE);
  for (let i = 0; i < bytes.length; i++) {
    const start = i * HEX_DIGITS_PER_BYTE;
    bytes[i] = Number.parseInt(stripped.slice(start, start + HEX_DIGITS_PER_BYTE), HEX_RADIX);
  }
  return bytes;
}

/** Onaltılık bir tam sayı okur (çerçeve kimliği). Boş/geçersiz girdide `undefined`. */
export function readHexNumber(text: string): number | undefined {
  const trimmed = text.trim().replace(HEX_PREFIX_PATTERN, '');
  if (trimmed.length === 0 || !HEX_ONLY_PATTERN.test(trimmed)) return undefined;
  const value = Number.parseInt(trimmed, HEX_RADIX);
  return Number.isFinite(value) ? value : undefined;
}

/**
 * Ondalık ya da onaltılık sayı okur; `0x` öneki varsa taban 16, yoksa 10.
 * CSV'de kimlik sütunu her iki tabanda da görülür, kullanıcının seçimi
 * `radix` ile açıkça verilebilir.
 */
export function readNumber(text: string, radix: 10 | 16 = 10): number | undefined {
  const trimmed = text.trim();
  if (trimmed.length === 0) return undefined;
  if (/^0[xX]/.test(trimmed)) return readHexNumber(trimmed);
  const value = Number.parseInt(trimmed, radix);
  return Number.isFinite(value) ? value : undefined;
}

/**
 * Zaman damgası okur ve MİLİSANİYEYE çevirir. Üç yazım tanınır:
 *   - saniye kesirli (`1637856000.123456`, `0.011557`) → ×1000
 *   - saat:dakika:saniye(.kesir) (`12:34:56.789`, `01:02:03`) → gün başından ms
 *   - ISO 8601 (`2021-11-25T18:40:00.123Z`) → epoch ms
 * Hangisinin MUTLAK hangisinin GÖRELİ olduğu buradan bilinemez — o karar
 * biçim ayrıştırıcısına aittir (`LogTimestampKind`).
 */
export function readTimestampMs(text: string): number | undefined {
  const trimmed = text.trim();
  if (trimmed.length === 0) return undefined;

  const clockMatch = /^(\d{1,2}):(\d{2}):(\d{2}(?:[.,]\d+)?)$/.exec(trimmed);
  if (clockMatch !== null) {
    const hours = Number.parseInt(clockMatch[1] ?? '', 10);
    const minutes = Number.parseInt(clockMatch[2] ?? '', 10);
    const seconds = Number.parseFloat((clockMatch[3] ?? '').replace(',', '.'));
    if (!Number.isFinite(hours) || !Number.isFinite(minutes) || !Number.isFinite(seconds)) return undefined;
    return ((hours * HOURS_TO_MINUTES + minutes) * MINUTES_TO_SECONDS + seconds) * SECONDS_TO_MILLISECONDS;
  }

  if (/^-?\d+(?:[.,]\d+)?$/.test(trimmed)) {
    const seconds = Number.parseFloat(trimmed.replace(',', '.'));
    return Number.isFinite(seconds) ? seconds * SECONDS_TO_MILLISECONDS : undefined;
  }

  const parsed = Date.parse(trimmed);
  return Number.isNaN(parsed) ? undefined : parsed;
}

/**
 * Yön işaretçisini çözer. Log biçimleri bunu üç ayrı sözlükle yazar
 * (`Rx`/`Tx`, `RX:`/`TX:`, `<-`/`->`); tanınmayan değer `undefined` kalır ve
 * kayıt YÖNSÜZ sayılır — `'rx'` varsayımı rx/tx dağılımını uydururdu.
 */
export function readDirection(text: string): 'rx' | 'tx' | undefined {
  const token = text.trim().toLowerCase().replace(/[:;]$/, '');
  if (token === 'rx' || token === 'r' || token === 'in' || token === 'recv' || token === '<-' || token === '<') {
    return 'rx';
  }
  if (token === 'tx' || token === 't' || token === 'out' || token === 'send' || token === '->' || token === '>') {
    return 'tx';
  }
  return undefined;
}

/**
 * Satırlara böler. CRLF ve tek CR (klasik seri terminal dökümü) da satır
 * sonudur; sondaki boş satır atılır. Satır numarası 1 tabanlıdır: dizideki
 * `i`. eleman kaynaktaki `i + 1`. satırdır.
 */
export function splitLines(text: string): string[] {
  const lines = text.split(/\r\n|\r|\n/);
  while (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
  return lines;
}

/**
 * 2001-09-09'un epoch milisaniyesi. Bunun ÜSTÜ bir zaman damgası, bir dosyanın
 * başından geçen süre olamaz (32 yıl süren bir yakalama yok); altı da bir
 * epoch tarihi olamaz. Mutlak/göreli ayrımı için kullanılan tek eşik budur —
 * ayrım biçimin bayrağından okunabiliyorsa (Vector ASC `timestamps absolute`)
 * ORAYA güvenilir, bu eşiğe düşülmez.
 */
const ABSOLUTE_TIMESTAMP_THRESHOLD_MS = 1_000_000_000_000;

export function inferTimestampKind(firstTimestamp: number | undefined): 'absolute' | 'relative' | 'none' {
  if (firstTimestamp === undefined) return 'none';
  return firstTimestamp >= ABSOLUTE_TIMESTAMP_THRESHOLD_MS ? 'absolute' : 'relative';
}
