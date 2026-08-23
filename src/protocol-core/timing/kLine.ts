/**
 * K-Line zamanlama hesapları — 5-baud init, fast init ve bayt/mesaj aralığı
 * bütçesi. Faz 10 dalga 14a (`docs/brief-faz10-dalga14a.md`).
 *
 * ── Bu kaydın decode'u YOK ───────────────────────────────────────────────
 * `iso9141.ts`/`iso14230.ts` dosya başlarının kararı: K-Line'ın fiziksel
 * katmanı (5-baud init, key bytes, hat zamanlaması) bir bayt akışı DEĞİLDİR
 * — decoder'a HİÇ girmez, init bir bayt akışı değil hat olayıdır. Bu dosya o
 * kararı bozmaz; `k-line` kaydı LoRa paterniyle `partial` + `calculatorIds`
 * kapanır (`vehiclePhy.ts`/`singlePairEthernet.ts` emsali), motor burada.
 *
 * ── UART İKİNCİ KEZ YAZILMADI ────────────────────────────────────────────
 * 5-baud init aslında 5 bit/s hızında gönderilen TEK bir UART karakteridir
 * (adres baytı). `calculateUartTiming` (`timing/uart.ts`) baudRate=5 ile
 * ÇAĞRILIR — `vehiclePhy.ts`in `calculateRs485Propagation`ı çağırma
 * disiplininin aynısı, kopyalamak değil.
 *
 * ── Kaynağın VERMEDİĞİ şeyler (KODA GÖMÜLMEZ) ────────────────────────────
 * Spec özeti (`04-otomotiv.md:183-190`) yalnız görünüm alanlarını (Idle,
 * Initialization, Request, Response, Inter-byte gap, Inter-message gap) ve
 * üç başlatma sınıfını (5-baud, Fast, Unknown/OEM) sayar — HİÇBİR zamanlama
 * SAYISI vermez. Bu yüzden:
 *   - Adres baytının DEĞERİ (klasik 0x33) burada YOK; bu dosya yalnız
 *     baytın SÜRESİNİ hesaplar, içeriğini değil.
 *   - ISO 14230-2'nin W1–W5 / P1–P4 pencereleri ve Fast Init'in 25 ms/25 ms
 *     gibi değerleri KODA GÖMÜLMEZ — `evaluateTimingWindow` sınırları
 *     çağırandan alır (LIN `breakBits`in aynı gerekçesi, `vehiclePhy.ts`).
 *   - Keyword bayt değerleri bu dosyanın konusu değil.
 */

import { calculateUartTiming } from './uart';
import type { UartParity } from './uart';

const FIVE_BAUD_RATE = 5;

// --- 5-baud init ---

export interface FiveBaudInitInput {
  /** Adres baytının veri bit sayısı; K-Line UART karakteri genelde 8N1'dir. */
  dataBits?: number;
  stopBits?: number;
  parity?: UartParity;
}

export interface FiveBaudInitResult {
  /** 5 bit/s'nin tanımı: `1 / 5` saniye — kaynak sabiti değil, "5 baud"un kendisi. */
  bitTimeSeconds: number;
  /** Adres baytının toplam iletim süresi (`calculateUartTiming`den gelir). */
  addressByteDurationSeconds: number;
  bitsPerCharacter: number;
}

/**
 * ISO 9141-2 / ISO 14230-2 ortak 5-baud init süresi. Adres baytı 5 bit/s
 * hızında gönderilen tek bir UART karakteridir — motor `calculateUartTiming`i
 * `baudRate: 5` ile çağırır, ikinci bir bit-süresi formülü yazmaz.
 */
export function calculateFiveBaudInit(input: FiveBaudInitInput = {}): FiveBaudInitResult {
  const timing = calculateUartTiming({
    baudRate: FIVE_BAUD_RATE,
    dataBits: input.dataBits ?? 8,
    stopBits: input.stopBits ?? 1,
    parity: input.parity ?? 'none',
  });

  return {
    bitTimeSeconds: timing.characterTimeSeconds / timing.bitsPerCharacter,
    addressByteDurationSeconds: timing.characterTimeSeconds,
    bitsPerCharacter: timing.bitsPerCharacter,
  };
}

// --- Fast init ---

export interface FastInitPulseInput {
  /** Wake-up pattern'in dominant (low) yarısı; kaynak süre VERMİYOR, çağırandan gelir. */
  lowPulseSeconds: number;
  /** Wake-up pattern'in recessive (high/idle) yarısı; çağırandan gelir. */
  highPulseSeconds: number;
}

export interface FastInitPulseResult {
  totalDurationSeconds: number;
}

/**
 * Fast init wake-up pattern'inin toplam süresi. 25 ms/25 ms gibi klasik
 * değerler burada YOKTUR — ikisi de çağırandan gelir, motor yalnız toplar.
 */
export function calculateFastInitPulse(input: FastInitPulseInput): FastInitPulseResult {
  if (input.lowPulseSeconds <= 0) throw new RangeError('lowPulseSeconds pozitif olmalı');
  if (input.highPulseSeconds <= 0) throw new RangeError('highPulseSeconds pozitif olmalı');
  return { totalDurationSeconds: input.lowPulseSeconds + input.highPulseSeconds };
}

// --- Genel zamanlama penceresi (inter-byte gap, inter-message gap, fast-init bütçesi) ---

export interface TimingWindowInput {
  measuredSeconds: number;
  minSeconds: number;
  maxSeconds: number;
}

export interface TimingWindowResult {
  measuredSeconds: number;
  belowMinimum: boolean;
  aboveMaximum: boolean;
  withinWindow: boolean;
}

/**
 * ISO 9141/14230'un W1-W5, P1-P4 gibi adlandırılmış pencerelerinin HİÇBİRİNİN
 * sayısal değeri kaynakta yok (spec özeti yalnız alan adlarını veriyor). Bu
 * yüzden sınırlar PARAMETRİKTİR: inter-byte gap, inter-message gap ve
 * fast-init darbe bütçesinin üçü de bu tek fonksiyonu ölçülen süre +
 * çağırandan gelen [min,max] ile kullanır — üç ayrı eşik-karşılaştırma
 * fonksiyonu yazmanın karşılığı yok.
 */
export function evaluateTimingWindow(input: TimingWindowInput): TimingWindowResult {
  if (input.measuredSeconds < 0) throw new RangeError('measuredSeconds negatif olamaz');
  if (input.minSeconds > input.maxSeconds) {
    throw new RangeError('minSeconds maxSeconds’tan büyük olamaz');
  }

  const belowMinimum = input.measuredSeconds < input.minSeconds;
  const aboveMaximum = input.measuredSeconds > input.maxSeconds;

  return {
    measuredSeconds: input.measuredSeconds,
    belowMinimum,
    aboveMaximum,
    withinWindow: !belowMinimum && !aboveMaximum,
  };
}
