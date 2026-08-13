/**
 * NMEA 0183 XOR checksum. `$` ve `*` arasındaki karakterlerin (sınırlayıcılar
 * HARİÇ) byte değerlerinin XOR'udur, 2 haneli BÜYÜK harf hex olarak yazılır.
 * Tuzak: virgüller de XOR'a dahildir (yalnız alan değerleri değil, ayraçlar da) —
 * cümleyi virgülle bölüp yalnız alanları XOR'lamak yanlış sonuç üretir.
 */

const NMEA_START = '$';
const NMEA_CHECKSUM_DELIMITER = '*';
const HEX_RADIX = 16;
const NMEA_CHECKSUM_HEX_DIGITS = 2;

/** `$`/`*` sınırlayıcıları HARİÇ, aralarındaki tüm karakterlerin XOR'u. */
export function nmeaXorChecksum(payload: string): number {
  let checksum = 0;
  for (let index = 0; index < payload.length; index += 1) {
    checksum ^= payload.charCodeAt(index);
  }
  return checksum;
}

/** NMEA cümlelerinde checksum her zaman 2 haneli büyük harf hex olarak yazılır. */
export function formatNmeaChecksum(checksum: number): string {
  return checksum.toString(HEX_RADIX).toUpperCase().padStart(NMEA_CHECKSUM_HEX_DIGITS, '0');
}

export interface NmeaSentenceParts {
  /** `$` ve `*` arasındaki, checksum'ın hesaplandığı ham metin. */
  payload: string;
  /** `*`dan sonraki, cümlenin kendi bildirdiği checksum (satır sonu/CR-LF varsa kırpılmış). */
  checksumHex: string;
}

/**
 * Tam cümleyi ayrıştırır. `$` ve `*` ikisi de zorunludur; biri eksikse cümle
 * NMEA formatına uymuyor demektir. Burada exception fırlatılmaz — çağıran
 * (byte-viewer, auto-detection) `undefined`'ı kendi hata bağlamına çevirsin diye.
 */
export function parseNmeaSentence(sentence: string): NmeaSentenceParts | undefined {
  if (!sentence.startsWith(NMEA_START)) {
    return undefined;
  }
  const delimiterIndex = sentence.indexOf(NMEA_CHECKSUM_DELIMITER);
  if (delimiterIndex === -1) {
    return undefined;
  }

  const payload = sentence.slice(NMEA_START.length, delimiterIndex);
  // trim: cümle CR/LF ile bitiyorsa (`...*47\r\n`) checksum hanesine karışmasın.
  const checksumHex = sentence.slice(delimiterIndex + NMEA_CHECKSUM_DELIMITER.length).trim();
  return { payload, checksumHex };
}

/** Cümlenin taşıdığı checksum ile payload'dan hesaplananı karşılaştırır. */
export function verifyNmeaChecksum(sentence: string): boolean {
  const parts = parseNmeaSentence(sentence);
  if (parts === undefined) {
    return false;
  }
  return formatNmeaChecksum(nmeaXorChecksum(parts.payload)) === parts.checksumHex.toUpperCase();
}
