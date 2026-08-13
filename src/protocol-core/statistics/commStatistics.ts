/**
 * Haberleşme istatistikleri — spec §39'un metrik ve formül listesinin birebir
 * karşılığı.
 *
 * Akış tabanlı (streaming) biriktirici: her çerçeve O(1) işlenir, hiçbir metrik
 * için geçmiş kayıt listesi tutulmaz. Sebep spec §44: parser saniyede binlerce
 * çerçeve işleyebilmeli — çerçeve başına dizi büyütmek ya da her ekranda
 * yeniden toplam almak bu bütçeyi tek başına yerdi.
 *
 * Standart sapma Welford yöntemiyle artımlı hesaplanır; naive "kareler
 * toplamı - ortalamanın karesi" büyük N'de katastrofik iptal yaşar.
 *
 * Spec formülleri:
 *   CRC Error Rate   = CRC Error Frames / CRC Checked Frames × 100
 *   Packet Loss Rate = Missing Packets  / Expected Packets   × 100
 *   Jitter_i         = Period_i − Mean Period
 *   σ                = sqrt[ Σ(Period_i − Mean Period)² / N ]   (anakütle, N'e bölünür)
 */

import type { FramingErrorCode } from '../framing/types';
import type { FrameDirection } from '../types';
import { createRateMeter, type RateMeter } from './rateMeter';

/** `unchecked`: doğrulama yapılandırılmamış — geçerli SAYILMAZ, geçersiz de sayılmaz. */
export type FrameValidity = 'valid' | 'crc-error' | 'checksum-error' | 'unchecked';

export interface FrameObservation {
  readonly direction: FrameDirection;
  readonly byteLength: number;
  /** `performance.now()` tabanlı; `snapshot(nowMs)` ile aynı saat olmalı. */
  readonly timestamp: number;
  readonly validity: FrameValidity;
  /** Varsa sıra numarası — paket kaybı ve sıra hatası yalnız bu verildiğinde hesaplanır. */
  readonly sequenceNumber?: number;
}

export interface LinkOptions {
  readonly baudRate: number;
  /** Bir baytın hat üzerinde kapladığı bit sayısı (start+data+parity+stop). */
  readonly bitsPerByte: number;
}

export interface CommStatisticsOptions {
  readonly link?: LinkOptions;
  /** Sıra numarası sayacının sarma değeri (ör. 8 bitlik sayaç için 256). */
  readonly sequenceModulus?: number;
  /** Anlık hız penceresi. */
  readonly rateWindowMs?: number;
}

export interface CommStatisticsSnapshot {
  readonly totalFrames: number;
  readonly validFrames: number;
  readonly invalidFrames: number;
  readonly rxFrames: number;
  readonly txFrames: number;
  readonly rxBytes: number;
  readonly txBytes: number;

  readonly crcErrors: number;
  readonly checksumErrors: number;
  readonly framingErrors: number;
  readonly timeoutErrors: number;
  readonly framingErrorsByCode: Readonly<Partial<Record<FramingErrorCode, number>>>;

  readonly crcCheckedFrames: number;
  /** Hiç doğrulama yapılmadıysa `undefined` — sıfır DEĞİL, "bilinmiyor". */
  readonly crcErrorRatePercent: number | undefined;

  /** Son pencere içindeki anlık hızlar. */
  readonly packetRate: number;
  readonly byteRate: number;
  /** İlk çerçeveden bu yana ortalama hız. */
  readonly averagePacketRate: number | undefined;

  readonly minFrameLength: number | undefined;
  readonly maxFrameLength: number | undefined;
  readonly averageFrameLength: number | undefined;

  readonly sequenceErrors: number;
  readonly missingPackets: number;
  readonly expectedPackets: number;
  readonly packetLossRatePercent: number | undefined;

  readonly meanPeriodMs: number | undefined;
  readonly lastJitterMs: number | undefined;
  readonly periodStdDevMs: number | undefined;

  readonly busLoadPercent: number | undefined;

  readonly minResponseTimeMs: number | undefined;
  readonly maxResponseTimeMs: number | undefined;
  readonly averageResponseTimeMs: number | undefined;

  readonly elapsedMs: number;
}

export interface CommStatisticsAccumulator {
  recordFrame(observation: FrameObservation): void;
  recordFramingError(code: FramingErrorCode): void;
  /** Çerçeve zaman aşımı gözcüsü tetiklendiğinde (spec §8.1 "Frame timeout"). */
  recordTimeout(): void;
  recordResponseTime(elapsedMs: number): void;
  setLink(link: LinkOptions | undefined): void;
  snapshot(nowMs: number): CommStatisticsSnapshot;
  reset(): void;
}

const DEFAULT_RATE_WINDOW_MS = 1000;
const RATE_BUCKET_COUNT = 10;

export function createCommStatisticsAccumulator(
  options: CommStatisticsOptions = {},
): CommStatisticsAccumulator {
  const rateWindowMs = options.rateWindowMs ?? DEFAULT_RATE_WINDOW_MS;
  const sequenceModulus = options.sequenceModulus;

  let link: LinkOptions | undefined = options.link;
  let packetMeter: RateMeter = createRateMeter(rateWindowMs, RATE_BUCKET_COUNT);
  let byteMeter: RateMeter = createRateMeter(rateWindowMs, RATE_BUCKET_COUNT);

  let totalFrames = 0;
  let validFrames = 0;
  let invalidFrames = 0;
  let rxFrames = 0;
  let txFrames = 0;
  let rxBytes = 0;
  let txBytes = 0;

  let crcErrors = 0;
  let checksumErrors = 0;
  let crcCheckedFrames = 0;
  let framingErrors = 0;
  let timeoutErrors = 0;
  let framingErrorsByCode: Partial<Record<FramingErrorCode, number>> = {};

  let totalFrameBytes = 0;
  let minFrameLength: number | undefined;
  let maxFrameLength: number | undefined;

  let firstTimestamp: number | undefined;
  let lastTimestamp: number | undefined;

  /** Periyot yalnız ARDIŞIK RX çerçeveleri arasında ölçülür: jitter bir alıcı
   *  metriğidir, araya karışan TX çerçevesi periyodu yapay olarak böler. */
  let lastRxTimestamp: number | undefined;
  let periodCount = 0;
  let periodMean = 0;
  let periodM2 = 0;
  let lastPeriodMs: number | undefined;

  let lastSequence: number | undefined;
  let sequenceErrors = 0;
  let missingPackets = 0;
  let sequencedFrames = 0;

  let responseCount = 0;
  let responseTotalMs = 0;
  let minResponseTimeMs: number | undefined;
  let maxResponseTimeMs: number | undefined;

  function recordPeriod(timestamp: number): void {
    if (lastRxTimestamp !== undefined) {
      const period = timestamp - lastRxTimestamp;
      // Negatif/sıfır periyot yalnız saat geri gittiğinde olur; istatistiği bozmasın.
      if (period > 0) {
        lastPeriodMs = period;
        periodCount += 1;
        const delta = period - periodMean;
        periodMean += delta / periodCount;
        periodM2 += delta * (period - periodMean);
      }
    }
    lastRxTimestamp = timestamp;
  }

  function recordSequence(sequenceNumber: number): void {
    sequencedFrames += 1;
    if (lastSequence !== undefined) {
      const modulus = sequenceModulus;
      const rawDelta = sequenceNumber - lastSequence;
      const delta = modulus === undefined ? rawDelta : ((rawDelta % modulus) + modulus) % modulus;
      if (delta !== 1) {
        sequenceErrors += 1;
        if (delta > 1) {
          missingPackets += delta - 1;
        }
      }
    }
    lastSequence = sequenceNumber;
  }

  return {
    recordFrame(observation: FrameObservation): void {
      totalFrames += 1;
      totalFrameBytes += observation.byteLength;

      if (minFrameLength === undefined || observation.byteLength < minFrameLength) {
        minFrameLength = observation.byteLength;
      }
      if (maxFrameLength === undefined || observation.byteLength > maxFrameLength) {
        maxFrameLength = observation.byteLength;
      }

      if (observation.direction === 'rx') {
        rxFrames += 1;
        rxBytes += observation.byteLength;
        recordPeriod(observation.timestamp);
      } else {
        txFrames += 1;
        txBytes += observation.byteLength;
      }

      switch (observation.validity) {
        case 'valid':
          validFrames += 1;
          crcCheckedFrames += 1;
          break;
        case 'crc-error':
          invalidFrames += 1;
          crcCheckedFrames += 1;
          crcErrors += 1;
          break;
        case 'checksum-error':
          invalidFrames += 1;
          crcCheckedFrames += 1;
          checksumErrors += 1;
          break;
        case 'unchecked':
          break;
      }

      if (observation.sequenceNumber !== undefined) {
        recordSequence(observation.sequenceNumber);
      }

      if (firstTimestamp === undefined) {
        firstTimestamp = observation.timestamp;
      }
      lastTimestamp = observation.timestamp;

      packetMeter.record(observation.timestamp, 1);
      byteMeter.record(observation.timestamp, observation.byteLength);
    },

    recordFramingError(code: FramingErrorCode): void {
      framingErrors += 1;
      framingErrorsByCode[code] = (framingErrorsByCode[code] ?? 0) + 1;
    },

    recordTimeout(): void {
      timeoutErrors += 1;
    },

    recordResponseTime(elapsedMs: number): void {
      if (!(elapsedMs >= 0)) {
        return;
      }
      responseCount += 1;
      responseTotalMs += elapsedMs;
      if (minResponseTimeMs === undefined || elapsedMs < minResponseTimeMs) {
        minResponseTimeMs = elapsedMs;
      }
      if (maxResponseTimeMs === undefined || elapsedMs > maxResponseTimeMs) {
        maxResponseTimeMs = elapsedMs;
      }
    },

    setLink(next: LinkOptions | undefined): void {
      link = next;
    },

    snapshot(nowMs: number): CommStatisticsSnapshot {
      const elapsedMs = firstTimestamp === undefined ? 0 : Math.max(0, nowMs - firstTimestamp);
      const elapsedSeconds = elapsedMs / 1000;

      const expectedPackets = sequencedFrames === 0 ? 0 : sequencedFrames + missingPackets;

      let busLoadPercent: number | undefined;
      if (link !== undefined && link.baudRate > 0 && elapsedSeconds > 0) {
        const transferredBits = (rxBytes + txBytes) * link.bitsPerByte;
        busLoadPercent = (transferredBits / (link.baudRate * elapsedSeconds)) * 100;
      }

      return {
        totalFrames,
        validFrames,
        invalidFrames,
        rxFrames,
        txFrames,
        rxBytes,
        txBytes,

        crcErrors,
        checksumErrors,
        framingErrors,
        timeoutErrors,
        framingErrorsByCode: { ...framingErrorsByCode },

        crcCheckedFrames,
        crcErrorRatePercent:
          crcCheckedFrames === 0 ? undefined : ((crcErrors + checksumErrors) / crcCheckedFrames) * 100,

        packetRate: packetMeter.rate(nowMs),
        byteRate: byteMeter.rate(nowMs),
        averagePacketRate: elapsedSeconds > 0 ? totalFrames / elapsedSeconds : undefined,

        minFrameLength,
        maxFrameLength,
        averageFrameLength: totalFrames === 0 ? undefined : totalFrameBytes / totalFrames,

        sequenceErrors,
        missingPackets,
        expectedPackets,
        packetLossRatePercent:
          expectedPackets === 0 ? undefined : (missingPackets / expectedPackets) * 100,

        meanPeriodMs: periodCount === 0 ? undefined : periodMean,
        lastJitterMs: lastPeriodMs === undefined ? undefined : lastPeriodMs - periodMean,
        periodStdDevMs: periodCount === 0 ? undefined : Math.sqrt(periodM2 / periodCount),

        busLoadPercent,

        minResponseTimeMs,
        maxResponseTimeMs,
        averageResponseTimeMs: responseCount === 0 ? undefined : responseTotalMs / responseCount,

        elapsedMs: lastTimestamp === undefined ? 0 : elapsedMs,
      };
    },

    reset(): void {
      totalFrames = 0;
      validFrames = 0;
      invalidFrames = 0;
      rxFrames = 0;
      txFrames = 0;
      rxBytes = 0;
      txBytes = 0;
      crcErrors = 0;
      checksumErrors = 0;
      crcCheckedFrames = 0;
      framingErrors = 0;
      timeoutErrors = 0;
      framingErrorsByCode = {};
      totalFrameBytes = 0;
      minFrameLength = undefined;
      maxFrameLength = undefined;
      firstTimestamp = undefined;
      lastTimestamp = undefined;
      lastRxTimestamp = undefined;
      periodCount = 0;
      periodMean = 0;
      periodM2 = 0;
      lastPeriodMs = undefined;
      lastSequence = undefined;
      sequenceErrors = 0;
      missingPackets = 0;
      sequencedFrames = 0;
      responseCount = 0;
      responseTotalMs = 0;
      minResponseTimeMs = undefined;
      maxResponseTimeMs = undefined;
      packetMeter = createRateMeter(rateWindowMs, RATE_BUCKET_COUNT);
      byteMeter = createRateMeter(rateWindowMs, RATE_BUCKET_COUNT);
    },
  };
}

export const EMPTY_COMM_STATISTICS: CommStatisticsSnapshot =
  createCommStatisticsAccumulator().snapshot(0);
