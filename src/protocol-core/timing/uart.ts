/**
 * UART (Universal Asynchronous Receiver/Transmitter) zamanlama hesap motoru.
 *
 * UART kendi başına bir gerilim seviyesi/kablo standardı tanımlamaz (spec §3.1
 * "UART") — burada yalnız bit/karakter/paket seviyesindeki zamanlama hesaplanır.
 * Fiziksel taşıyıcı (RS-232/RS-422/RS-485/TTL/CMOS) ayrı arayüzlerdir, bu dosyaya
 * girmez.
 */

/** UART her zaman TEK start bit kullanır — asenkron alıcıyı senkronize eden kenar. */
const UART_START_BITS = 1;

export type UartParity = 'none' | 'even' | 'odd';

/** Parity biti varsa karaktere tam 1 bit ekler; `'none'` katkısı sıfırdır. */
const UART_PARITY_BITS: Record<UartParity, number> = {
  none: 0,
  even: 1,
  odd: 1,
};

/**
 * Girdi alanlarının çoğu opsiyoneldir: yalnız verilenler için ilgili çıktı
 * hesaplanır (ör. `actualBaud` verilmezse `baudError` hiç üretilmez, `undefined`
 * bile yazılmaz — bkz. `calculateUartTiming`).
 */
export interface UartTimingInput {
  baudRate: number;
  dataBits: number;
  stopBits: number;
  parity: UartParity;
  /** Tek paketteki TOPLAM byte sayısı (adres/uzunluk/checksum dahil). */
  packetBytes?: number;
  /** Paket içindeki yalnız kullanıcı verisi byte sayısı — efficiency hesabı için. */
  payloadBytes?: number;
  /** Gerçek ölçülen baud rate — hedeften sapma hesabı için. */
  actualBaud?: number;
}

export interface UartTimingResult {
  bitsPerCharacter: number;
  characterTimeSeconds: number;
  packetTimeSeconds?: number;
  maxByteRate: number;
  maxPacketRate?: number;
  efficiencyPercent?: number;
  baudError?: number;
  baudErrorPercent?: number;
}

/**
 * UART karakter/paket zamanlamasını hesaplar (spec §3.1 UART formülleri).
 * 8N1 için `bitsPerCharacter = 1(start) + 8(data) + 0(parity) + 1(stop) = 10`.
 *
 * Zorunlu fixture: 115200 baud, 8N1, 20 baytlık paket → `packetTimeSeconds ≈
 * 1.736 ms` (bkz. `uart.test.ts`).
 */
export function calculateUartTiming(input: UartTimingInput): UartTimingResult {
  if (input.baudRate <= 0) {
    throw new RangeError('baudRate pozitif olmalı');
  }

  const bitsPerCharacter =
    UART_START_BITS + input.dataBits + UART_PARITY_BITS[input.parity] + input.stopBits;
  const characterTimeSeconds = bitsPerCharacter / input.baudRate;
  const maxByteRate = input.baudRate / bitsPerCharacter;

  const result: UartTimingResult = {
    bitsPerCharacter,
    characterTimeSeconds,
    maxByteRate,
  };

  if (input.packetBytes !== undefined) {
    const packetTimeSeconds = (input.packetBytes * bitsPerCharacter) / input.baudRate;
    result.packetTimeSeconds = packetTimeSeconds;
    // packetTimeSeconds sıfırsa (packetBytes=0) paket hızı tanımsızdır, üretme.
    if (packetTimeSeconds > 0) {
      result.maxPacketRate = 1 / packetTimeSeconds;
    }

    if (input.payloadBytes !== undefined && input.packetBytes > 0) {
      // Efficiency = Payload Bytes / Total Frame Bytes × 100 — payload olmadan
      // "toplam frame byte" (packetBytes) anlamsız, o yüzden ikisi birlikte istenir.
      result.efficiencyPercent = (input.payloadBytes / input.packetBytes) * 100;
    }
  }

  if (input.actualBaud !== undefined) {
    const baudError = input.actualBaud - input.baudRate;
    result.baudError = baudError;
    result.baudErrorPercent = (baudError / input.baudRate) * 100;
  }

  return result;
}
