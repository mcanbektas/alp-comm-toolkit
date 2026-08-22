/**
 * Araç içi fiziksel katman hesapları — CAN PHY, LIN PHY, FlexRay PHY.
 * Faz 10 dalga 11h (sıralama önerisi #7, `docs/brief-faz10-dalga11.md`).
 *
 * Dosya `timing/` altında: `rs485.ts`, `logicLevels.ts` ve `currentLoop.ts`
 * emsali — elektriksel hesaplar bu klasörde toplanıyor (CLAUDE.md, spec §6
 * klasör listesinden sapılmıyor).
 *
 * ── Bu üç kaydın decode'u YOK ──────────────────────────────────────────────
 * Çerçeve çözümü zaten Automotive alanında: `protocols/automotive/can/*`,
 * `.../lin/lin.ts`. Bu sayfalar transceiver seviyesini anlatır (CAN_H/CAN_L,
 * tek tel LIN, BP/BM kanalları) — yakalanmış bayt dizisinde karşılığı yoktur.
 * Bu yüzden LoRa paterni: `status:'partial'`, `pluginId` YOK, motor
 * `calculatorIds` üzerinden hesap aracı olarak bağlanır (dalga 11g'deki
 * Current Loop / 4–20 mA kararının aynısı).
 *
 * ── Kablo gecikmesi TEKRAR YAZILMADI ───────────────────────────────────────
 * `calculateRs485Propagation` (Faz 5) `L / v_p` ve round-trip'i zaten
 * hesaplıyor; CAN ve FlexRay aynı fiziği kullanır, bu dosya onu ÇAĞIRIR.
 * Brief'in "rs485.ts'ten adapte edilebilir" saptamasının karşılığı budur —
 * kopyalamak değil, çağırmak.
 *
 * ── Kaynağın verdiği ve VERMEDİĞİ şeyler ───────────────────────────────────
 * Spec özeti (`docs/spec/ozet/01-fiziksel-arayuzler.md`) CAN için termination
 * değerlerini SAYIYLA veriyor (iki uçta 120 Ω, enerjisiz `120‖120 = 60 Ω`) ve
 * gecikme bütçesinin GİRDİLERİNİ sayıyor (kablo uzunluğu, yayılma hızı,
 * transceiver gecikmesi, node gecikmesi, bit hızı, sample point) ama kapalı
 * formülü vermiyor. Burada kullanılan kural CAN'in kendi arbitrasyon
 * gereğidir: en uzak iki node arasındaki GİDİŞ-DÖNÜŞ gecikmesi, bitin sample
 * point'ine kadar tamamlanmalıdır (wired-AND arbitrasyonu ancak böyle
 * çalışır). Bu varsayım burada açıkça yazılıdır; sayı uydurulmamıştır.
 *
 * LIN tarafında kaynak "Break, normal UART karakterinden daha uzun dominant
 * periyot" diyor ve süreyi "x bit times" olarak gösteriyor ama **asgari bit
 * sayısı vermiyor** — bu yüzden `breakBits` çağırandan gelir, LIN 2.x'in 13
 * bitlik asgarisi KODA GÖMÜLMEZ. Aynı disiplin: 1-Wire Serial Number
 * endianness'ı, RS-232 gerilim aralığı, 4–20 mA arıza eşikleri.
 */

import { calculateRs485Propagation } from './rs485';

/** 8N1 bir UART karakteri 10 bit sürer — LIN break'inin karşılaştırma ölçüsü. */
export const UART_CHARACTER_BIT_TIMES = 10;
/** Sinyalin en uzak node'a gidip dönmesi: tek yön gecikmenin iki katı. */
const ROUND_TRIP_MULTIPLIER = 2;
const PERCENT = 100;

// --- Termination ---

/**
 * Paralel sonlandırma direncinin eşdeğeri: `R / n`. Spec'in CAN örneği
 * `120‖120 = 60 Ω` (enerjisiz bus'ta A–B arası ölçülen değer); üçüncü bir
 * direnç takılırsa 40 Ω çıkar — kaynağın "3 adet termination" entegrasyon
 * hatasının ölçülebilir izi.
 */
export function calculateParallelTermination(ohmsEach: number, count: number): number {
  if (ohmsEach <= 0) throw new RangeError('sonlandırma direnci pozitif olmalı');
  if (!Number.isInteger(count) || count < 1) {
    throw new RangeError('sonlandırma sayısı en az 1 tam sayı olmalı');
  }
  return ohmsEach / count;
}

// --- CAN PHY: bit bütçesi ---

export interface CanBitBudgetInput {
  bitrateBps: number;
  /** Bitin hangi yüzdesinde örneklendiği (tipik %75–87.5 sınıfı). */
  samplePointPercent: number;
  cableLengthMeters: number;
  propagationVelocityMetersPerSecond: number;
  /** Transceiver'ın TX→bus + bus→RX toplam gecikmesi (datasheet değeri). */
  transceiverDelaySeconds: number;
  /** Denetleyici/node tarafındaki ek gecikme; verilmezse 0. */
  nodeDelaySeconds?: number;
}

export interface CanBitBudgetResult {
  bitTimeSeconds: number;
  cableDelaySeconds: number;
  /** `2 × (kablo + transceiver + node)` — en uzak node'a gidip dönen sinyal. */
  roundTripDelaySeconds: number;
  /** Sample point'e kadar geçen süre: `bitTime × samplePoint%`. */
  sampleTimeSeconds: number;
  /** `sampleTime − roundTrip`; negatifse arbitrasyon bu hızda/uzunlukta çalışmaz. */
  marginSeconds: number;
  withinBudget: boolean;
}

/**
 * CAN'in fiziksel gecikme bütçesi. Kablo gecikmesi `calculateRs485Propagation`
 * ile hesaplanır (aynı `L / v_p` fiziği, tekrar yazılmadı); round-trip'e
 * transceiver ve node gecikmeleri de girer, çünkü sinyal her iki uçta bu
 * katmanlardan geçer.
 */
export function calculateCanBitBudget(input: CanBitBudgetInput): CanBitBudgetResult {
  if (input.bitrateBps <= 0) throw new RangeError('bitrateBps pozitif olmalı');
  if (input.samplePointPercent <= 0 || input.samplePointPercent >= PERCENT) {
    throw new RangeError('samplePointPercent 0 ile 100 arasında olmalı');
  }

  const { propagationDelaySeconds: cableDelaySeconds } = calculateRs485Propagation({
    cableLengthMeters: input.cableLengthMeters,
    propagationVelocityMetersPerSecond: input.propagationVelocityMetersPerSecond,
  });

  const oneWaySeconds =
    cableDelaySeconds + input.transceiverDelaySeconds + (input.nodeDelaySeconds ?? 0);
  const roundTripDelaySeconds = oneWaySeconds * ROUND_TRIP_MULTIPLIER;
  const bitTimeSeconds = 1 / input.bitrateBps;
  const sampleTimeSeconds = bitTimeSeconds * (input.samplePointPercent / PERCENT);
  const marginSeconds = sampleTimeSeconds - roundTripDelaySeconds;

  return {
    bitTimeSeconds,
    cableDelaySeconds,
    roundTripDelaySeconds,
    sampleTimeSeconds,
    marginSeconds,
    withinBudget: marginSeconds >= 0,
  };
}

// --- LIN PHY: break ve sync ---

export interface LinBreakInput {
  baudRate: number;
  /** Break'in kaç bit süresi tutacağı. Kaynak asgari değer VERMİYOR, çağıran belirler. */
  breakBits: number;
}

export interface LinBreakResult {
  bitTimeSeconds: number;
  breakDurationSeconds: number;
  /** Karşılaştırma ölçüsü: 8N1 bir karakter 10 bit sürer. */
  uartCharacterBitTimes: number;
  /** Kaynağın tanımı: break, normal bir UART karakterinden UZUN olmalı. */
  longerThanUartCharacter: boolean;
}

export function calculateLinBreak(input: LinBreakInput): LinBreakResult {
  if (input.baudRate <= 0) throw new RangeError('baudRate pozitif olmalı');
  if (input.breakBits <= 0) throw new RangeError('breakBits pozitif olmalı');

  const bitTimeSeconds = 1 / input.baudRate;
  return {
    bitTimeSeconds,
    breakDurationSeconds: bitTimeSeconds * input.breakBits,
    uartCharacterBitTimes: UART_CHARACTER_BIT_TIMES,
    longerThanUartCharacter: input.breakBits > UART_CHARACTER_BIT_TIMES,
  };
}

export interface SyncBaudInput {
  /** Ölçülen süre (saniye). */
  spanSeconds: number;
  /**
   * Bu sürenin kaç bit sürdüğü. Varsayılan 8: sync alanı `0x55 = 01010101`
   * olduğu için sekiz veri bitinin kenarları ölçülür (kaynak "edge'ler
   * üzerinden baud senkronizasyonu yapılabilir" diyor, sayı vermiyor).
   */
  bitCount?: number;
}

/** Ölçülen sync süresinden baud tahmini: `bitCount / span`. */
export function estimateBaudFromSyncSpan(input: SyncBaudInput): number {
  const bitCount = input.bitCount ?? 8;
  if (input.spanSeconds <= 0) throw new RangeError('spanSeconds pozitif olmalı');
  if (bitCount <= 0) throw new RangeError('bitCount pozitif olmalı');
  return bitCount / input.spanSeconds;
}

// --- FlexRay PHY: kanal süreleri ve skew ---

export interface FlexrayChannelInput {
  bitrateBps: number;
  /** Çerçevenin bit sayısı; kaynak sabit bir uzunluk vermiyor, çağıran verir. */
  frameBits: number;
  channelADelaySeconds: number;
  channelBDelaySeconds: number;
}

export interface FlexrayChannelResult {
  bitTimeSeconds: number;
  frameDurationSeconds: number;
  /** İki kanal arasındaki gecikme farkının mutlak değeri (kaynağın "A/B skew"i). */
  skewSeconds: number;
  /** Skew'in bit süresi cinsinden karşılığı — redundansın ne kadar bozulduğunu gösterir. */
  skewBitTimes: number;
}

export function calculateFlexrayChannels(input: FlexrayChannelInput): FlexrayChannelResult {
  if (input.bitrateBps <= 0) throw new RangeError('bitrateBps pozitif olmalı');
  if (input.frameBits <= 0) throw new RangeError('frameBits pozitif olmalı');

  const bitTimeSeconds = 1 / input.bitrateBps;
  const skewSeconds = Math.abs(input.channelADelaySeconds - input.channelBDelaySeconds);

  return {
    bitTimeSeconds,
    frameDurationSeconds: bitTimeSeconds * input.frameBits,
    skewSeconds,
    skewBitTimes: skewSeconds / bitTimeSeconds,
  };
}
