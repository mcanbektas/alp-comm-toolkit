/**
 * PMBus komut haritası ve STATUS bit ağaçları — saf veri, motor değil.
 *
 * ── Kaynak ──────────────────────────────────────────────────────────────────
 * Komut kodları, adları ve SMBus transaction türleri: **PMBus Specification
 * Part II Rev 1.3.1 (SMIF, 2015), Table 31 "Command Summary"**. STATUS_BYTE /
 * STATUS_WORD bit adları ve anlamları: aynı belgenin §17.1 Table 15 ve §17.2
 * Table 16'sı. Bu repo'nun spec ÖZETİ yalnız komut ADLARINI sayıyor (kod
 * vermiyor) ve STATUS_WORD için "bit ağacı" istiyor ama bitleri tek tek
 * saymıyor — kodlar ve bit anlamları bu yüzden birincil kaynaktan alındı.
 *
 * ── Neden TAM tablo değil ───────────────────────────────────────────────────
 * Table 31'de 200'ün üzerinde komut kodu var; buraya spec özetinin "Yaygın
 * komutlar" başlığı altında SAYDIĞI komutlar + Direct formatın çalışması için
 * gereken COEFFICIENTS (30h) alındı. Katalog kaydındaki `definitions:
 * ['vendor-map']` zaten cihaz-başına haritanın dışarıdan geleceğini söylüyor:
 * hangi komutun hangi formatta döndüğü ÜRETİCİYE aittir (§7.1 son paragraf:
 * "The product literature for each PMBus device shall describe which data
 * format is used for each PMBus command"). Buradaki `format` alanı bu yüzden
 * VARSAYILAN'dır, gerçek değil — cihaz DIRECT kullanıyorsa aynı komut Direct
 * döner ve çözüm katsayı ister.
 */

/** Komutun veri baytlarının VARSAYILAN yorumu (§7.1). */
export type PmbusDataFormat =
  /** İki bayt: 5-bit exponent + 11-bit mantissa, ikisi de iki tümleyen (§7.3). */
  | 'linear11'
  /** İki bayt işaretsiz mantissa; exponent VOUT_MODE'dan gelir (§8.4.1.1). */
  | 'ulinear16'
  /** Tek bayt, §8.3 Table 2 bit yerleşimi. */
  | 'vout-mode'
  /** Tek bayt bit alanı (§17.1). */
  | 'status-byte'
  /** İki bayt bit alanı, alt bayt STATUS_BYTE ile aynı (§17.2). */
  | 'status-word'
  /** Block Write-Block Read Process Call, 5 veri baytı (§14.1). */
  | 'coefficients'
  /** Sayısal olmayan/uygulamaya özel — ham gösterilir. */
  | 'raw';

export interface PmbusCommand {
  code: number;
  /** Komut adı VERİDİR, çeviriye girmez (CLAUDE.md). */
  name: string;
  format: PmbusDataFormat;
  /** Fiziksel birim; formatı sayısal olmayan komutlarda undefined. */
  unit?: string;
}

/**
 * Spec özetinin "Yaygın komutlar" listesi + COEFFICIENTS. Kodlar Table 31.
 * Sıra kod sırasıdır; arama `findPmbusCommand` ile lineer — liste küçük ve
 * sabit (`calculators/registry.ts`in aynı gerekçesi).
 */
export const PMBUS_COMMANDS: readonly PmbusCommand[] = [
  { code: 0x00, name: 'PAGE', format: 'raw' },
  { code: 0x01, name: 'OPERATION', format: 'raw' },
  { code: 0x02, name: 'ON_OFF_CONFIG', format: 'raw' },
  { code: 0x03, name: 'CLEAR_FAULTS', format: 'raw' },
  { code: 0x19, name: 'CAPABILITY', format: 'raw' },
  { code: 0x20, name: 'VOUT_MODE', format: 'vout-mode' },
  { code: 0x21, name: 'VOUT_COMMAND', format: 'ulinear16', unit: 'V' },
  { code: 0x30, name: 'COEFFICIENTS', format: 'coefficients' },
  { code: 0x78, name: 'STATUS_BYTE', format: 'status-byte' },
  { code: 0x79, name: 'STATUS_WORD', format: 'status-word' },
  { code: 0x7a, name: 'STATUS_VOUT', format: 'raw' },
  { code: 0x7b, name: 'STATUS_IOUT', format: 'raw' },
  { code: 0x7d, name: 'STATUS_TEMPERATURE', format: 'raw' },
  { code: 0x7e, name: 'STATUS_CML', format: 'raw' },
  { code: 0x88, name: 'READ_VIN', format: 'linear11', unit: 'V' },
  { code: 0x89, name: 'READ_IIN', format: 'linear11', unit: 'A' },
  { code: 0x8b, name: 'READ_VOUT', format: 'ulinear16', unit: 'V' },
  { code: 0x8c, name: 'READ_IOUT', format: 'linear11', unit: 'A' },
  { code: 0x8d, name: 'READ_TEMPERATURE_1', format: 'linear11', unit: '°C' },
  { code: 0x96, name: 'READ_POUT', format: 'linear11', unit: 'W' },
  { code: 0x97, name: 'READ_PIN', format: 'linear11', unit: 'W' },
  { code: 0x98, name: 'PMBUS_REVISION', format: 'raw' },
] as const;

export function findPmbusCommand(code: number): PmbusCommand | undefined {
  return PMBUS_COMMANDS.find((command) => command.code === code);
}

/** §17.1 Table 15 — STATUS_BYTE, bit 7'den 0'a. Adlar spec yazımıyla. */
export const STATUS_BYTE_BITS: readonly string[] = [
  'NONE_OF_THE_ABOVE',
  'CML',
  'TEMPERATURE',
  'VIN_UV_FAULT',
  'IOUT_OC_FAULT',
  'VOUT_OV_FAULT',
  'OFF',
  'BUSY',
] as const;

/**
 * §17.2 Table 16 — STATUS_WORD ÜST baytı, bit 7'den 0'a (dizide 0'dan 7'ye).
 * ALT bayt STATUS_BYTE ile AYNI registerdır (spec'in kendi cümlesi), bu yüzden
 * ayrı bir liste tutulmaz.
 */
export const STATUS_WORD_HIGH_BITS: readonly string[] = [
  'UNKNOWN',
  'OTHER',
  'FANS',
  'PG_STATUS#',
  'MFRSPECIFIC',
  'INPUT',
  'IOUT/POUT',
  'VOUT',
] as const;

/** Set edilmiş bitlerin adlarını MSB→LSB sırayla verir; hiçbiri set değilse boş dizi. */
export function decodeStatusBits(value: number, bitNames: readonly string[]): string[] {
  const names: string[] = [];
  for (let bit = bitNames.length - 1; bit >= 0; bit -= 1) {
    if ((value & (1 << bit)) !== 0) {
      names.push(bitNames[bit] ?? `bit${bit}`);
    }
  }
  return names;
}
