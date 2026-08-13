/**
 * Simülasyon kaynağının ürettiği gösteri protokolü — saf, deterministik.
 *
 * Çerçeve şekli spec §8.3/§8.4'ün KANONİK örneğiyle aynı: `AA 05 10 03 34 12 7F
 * 4F 55` (START, ADDRESS, COMMAND, LENGTH, PAYLOAD, CHECKSUM, EOF). Payload
 * yalnız 6 bayta genişletildi ki grafiğe bağlanacak gerçek sayısal sinyaller
 * taşısın. Böylece simülasyon, uydurma bir format değil, spec'in kendi
 * örneğinin çalışan hâli oluyor.
 *
 *   0    1        2        3       4..3+len      4+len      5+len
 *   AA   ADDRESS  COMMAND  LENGTH  PAYLOAD       CHECKSUM   EOF(0x55)
 *
 * CHECKSUM = kendisinden önceki bütün baytların XOR8'i.
 */

import { numberToBytes, toUnsignedRaw } from '../../protocol-core/buffers/endianness';
import { xor8Checksum } from '../../protocol-core/checksums/simpleChecksums';
import type { FramingMethodConfig } from '../../protocol-core/framing/createExtractor';

export const SIMULATED_START_BYTE = 0xaa;
export const SIMULATED_EOF_BYTE = 0x55;
export const SIMULATED_ADDRESS = 0x05;
export const SIMULATED_COMMAND = 0x10;
export const SIMULATED_PAYLOAD_LENGTH = 6;
/** START + ADDRESS + COMMAND + LENGTH */
export const SIMULATED_HEADER_LENGTH = 4;
/** CHECKSUM + EOF */
export const SIMULATED_TRAILER_LENGTH = 2;
export const SIMULATED_FRAME_LENGTH =
  SIMULATED_HEADER_LENGTH + SIMULATED_PAYLOAD_LENGTH + SIMULATED_TRAILER_LENGTH;

/** Bu protokolü çözecek çerçeveleme ayarı — ekran varsayılanı olarak da kullanılır. */
export const SIMULATED_FRAMING_CONFIG: FramingMethodConfig = {
  method: 'length-field',
  startByte: SIMULATED_START_BYTE,
  headerBytesBeforeLength: 2,
  lengthFieldWidth: 1,
  lengthFieldEndianness: 'big',
  trailerLength: SIMULATED_TRAILER_LENGTH,
};

export interface SimulatedTelemetry {
  /** İşaretli int16, deci-°C (250 = 25.0 °C). */
  readonly temperatureDeciC: number;
  /** İşaretsiz uint16, milivolt. */
  readonly voltageMilliV: number;
  /** İşaretsiz uint16, devir/dakika. */
  readonly rpm: number;
}

export function buildSimulatedFrame(telemetry: SimulatedTelemetry): Uint8Array {
  const frame = new Uint8Array(SIMULATED_FRAME_LENGTH);
  frame[0] = SIMULATED_START_BYTE;
  frame[1] = SIMULATED_ADDRESS;
  frame[2] = SIMULATED_COMMAND;
  frame[3] = SIMULATED_PAYLOAD_LENGTH;

  frame.set(numberToBytes(toUnsignedRaw(telemetry.temperatureDeciC, 16), 2, 'big'), 4);
  frame.set(numberToBytes(telemetry.voltageMilliV, 2, 'big'), 6);
  frame.set(numberToBytes(telemetry.rpm, 2, 'big'), 8);

  const checksumIndex = SIMULATED_FRAME_LENGTH - 2;
  frame[checksumIndex] = xor8Checksum(frame.subarray(0, checksumIndex));
  frame[SIMULATED_FRAME_LENGTH - 1] = SIMULATED_EOF_BYTE;
  return frame;
}

/**
 * Deterministik LCG (Numerical Recipes katsayıları). `Math.random` bilerek
 * kullanılmadı: aynı tohum aynı akışı vermezse ne birim testi ne de Playwright
 * turu tekrarlanabilir olurdu. Kriptografik değildir, öyle kullanılmamalı.
 */
export function createLcg(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

export interface TelemetryGeneratorOptions {
  readonly seed: number;
}

/**
 * Gürültü değil SİNYAL üretir: sinüs taşıyıcı + küçük rastgele sapma. Düz
 * gürültü grafikte downsampling'in doğru çalışıp çalışmadığını göstermez —
 * şekli olan bir eğri gösterir.
 */
export function createTelemetryGenerator(
  options: TelemetryGeneratorOptions,
): () => SimulatedTelemetry {
  const random = createLcg(options.seed);
  let tick = 0;

  return () => {
    tick += 1;
    const temperatureDeciC = Math.round(250 + 90 * Math.sin(tick / 37) + (random() - 0.5) * 12);
    const voltageMilliV = Math.round(12_000 + 800 * Math.sin(tick / 19 + 1.2) + (random() - 0.5) * 120);
    const rpm = Math.round(1500 + 900 * Math.sin(tick / 53 + 2.5) + (random() - 0.5) * 60);
    return {
      temperatureDeciC,
      voltageMilliV,
      rpm: Math.max(0, rpm),
    };
  };
}

export interface SimulatedByteStreamOptions {
  readonly seed: number;
  /** 0..1 — bu oranda çerçevenin payload'ı bozulur, checksum düzeltilmez (checksum hatası üretir). */
  readonly corruptionRate: number;
  /** 0..1 — bu oranda çerçeve öncesine çöp bayt eklenir (framing/no-sync hatası üretir). */
  readonly garbageRate: number;
}

export const DEFAULT_SIMULATED_STREAM_OPTIONS: SimulatedByteStreamOptions = {
  seed: 0x5eed,
  corruptionRate: 0.04,
  garbageRate: 0.03,
};

export interface SimulatedByteStream {
  /** Bir sonraki çerçeveyi (gerekirse bozulmuş/çöple öncelenmiş) bayt dizisi olarak üretir. */
  next(): Uint8Array;
}

export function createSimulatedByteStream(
  options: SimulatedByteStreamOptions = DEFAULT_SIMULATED_STREAM_OPTIONS,
): SimulatedByteStream {
  const generateTelemetry = createTelemetryGenerator({ seed: options.seed });
  // Bozulma kararları ayrı bir akıştan çekilir; aynı LCG'yi paylaşsalardı
  // telemetri değerleri bozulma oranına göre kayardı ve fixture'lar kırılgan olurdu.
  const random = createLcg(options.seed ^ 0x9e37_79b9);

  return {
    next(): Uint8Array {
      const frame = buildSimulatedFrame(generateTelemetry());

      if (random() < options.corruptionRate) {
        // Payload'ın ilk baytını çevir; checksum'ı DÜZELTME — amaç tam olarak
        // doğrulamanın yakalayacağı bir çerçeve üretmek.
        const corrupted = Uint8Array.from(frame);
        corrupted[4] = ((corrupted[4] ?? 0) ^ 0xff) & 0xff;
        return prependGarbage(corrupted, random, options.garbageRate);
      }

      return prependGarbage(frame, random, options.garbageRate);
    },
  };
}

function prependGarbage(frame: Uint8Array, random: () => number, garbageRate: number): Uint8Array {
  if (random() >= garbageRate) {
    return frame;
  }
  const garbageLength = 1 + Math.floor(random() * 3);
  const garbage = new Uint8Array(garbageLength);
  for (let index = 0; index < garbageLength; index += 1) {
    // START baytıyla çakışmamalı, yoksa çöp yeni bir çerçeve başı sanılır.
    let byte = Math.floor(random() * 256);
    if (byte === SIMULATED_START_BYTE) {
      byte = (byte + 1) & 0xff;
    }
    garbage[index] = byte;
  }
  const combined = new Uint8Array(garbage.length + frame.length);
  combined.set(garbage, 0);
  combined.set(frame, garbage.length);
  return combined;
}

/**
 * Bayt dizisini rastgele boyutlu parçalara böler — spec §8.4'ün "chunk
 * sınırları çerçeve sınırlarıyla uyuşmaz" durumunu bilerek üretir. Simülasyon
 * bunu yapmazsa stream buffer'ın varlık sebebi hiç sınanmamış olur.
 */
export function splitIntoChunks(
  bytes: Uint8Array,
  random: () => number,
  maxChunkSize: number,
): Uint8Array[] {
  if (bytes.length === 0) {
    return [];
  }
  const chunks: Uint8Array[] = [];
  let offset = 0;
  while (offset < bytes.length) {
    const size = 1 + Math.floor(random() * maxChunkSize);
    const end = Math.min(offset + size, bytes.length);
    // `subarray` DEĞİL `slice`: parçalar postMessage ile Worker'a geçiyor ve
    // structured clone bir görünümü kopyalarken ALTTAKİ BÜTÜN ArrayBuffer'ı
    // kopyalar. Görünüm bırakılsaydı 20 baytlık parça, 2 KB'lık tur
    // arabelleğinin tamamını her seferinde klonlatırdı.
    chunks.push(bytes.slice(offset, end));
    offset = end;
  }
  return chunks;
}
