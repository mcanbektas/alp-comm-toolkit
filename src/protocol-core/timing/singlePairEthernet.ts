/**
 * Single Pair Ethernet (SPE) hesapları — PHY sınıfı bit süresi ve 10BASE-T1S
 * PLCA çevrim/gecikme bütçesi. Faz 10 dalga 11k (sıralama önerisi #10).
 *
 * Dosya `timing/` altında: `rs485.ts`, `logicLevels.ts`, `currentLoop.ts`,
 * `vehiclePhy.ts` emsali.
 *
 * ── Bu kaydın decode'u YOK ─────────────────────────────────────────────────
 * SPE bir PHY ailesidir; hattaki çerçeve zaten Ethernet çerçevesidir ve
 * `protocols/network/ethernet/*` onu çözer. Bu sayfanın kendi konusu
 * (PHY sınıfı, multidrop, PLCA) yakalanmış bayt dizisinde görünmez — LoRa
 * paterni: `status:'partial'`, `pluginId` YOK, motor `calculatorIds`
 * üzerinden bağlanır (11g/11h kararının aynısı).
 *
 * ── Kaynağın verdiği ve VERMEDİĞİ şeyler ───────────────────────────────────
 * Spec özeti (`docs/spec/ozet/01-fiziksel-arayuzler.md`) dört PHY sınıfını
 * (10BASE-T1S, 10BASE-T1L, 100BASE-T1, 1000BASE-T1) ve PLCA'nın alanlarını
 * (Coordinator, Node ID, Node Count, Transmit Opportunity, Burst Count)
 * sayıyor ama TEK BİR SAYI vermiyor.
 *
 * Bu yüzden sayılar iki dış kaynaktan alındı, uydurulmadı:
 *   1. **Veri hızları PHY adının kendisinden** gelir (10BASE-T1x = 10 Mbit/s,
 *      100BASE-T1 = 100 Mbit/s, 1000BASE-T1 = 1000 Mbit/s) — IEEE 802.3
 *      adlandırma kuralı, ayrıca spec özeti LAN8651 için "10 Mbit/s" diyerek
 *      10BASE-T1S'i doğruluyor.
 *   2. **PLCA register varsayılanları**: OPEN Alliance *10BASE-T1S PLCA
 *      Management Registers* v1.2 (opensig.org) — `TOTMR` (31.CA04) `TOT`
 *      alanı "to_timer value", **varsayılan 32 bit-times**; `BURST`
 *      (31.CA05) `MAXBC` varsayılan 0 (burst kapalı), `BTMR` burst_timer
 *      varsayılan 128 bit-times. Bu belge to_timer'ın "bit-times cinsinden
 *      PLCA transmit opportunity süresini belirlediğini" ve tüm node'larda
 *      AYNI olması gerektiğini de yazar.
 *
 * **KAPALI FORMÜL HİÇBİR KAYNAKTA YOK.** PLCA çevrim süresinin buradaki
 * hesabı mekanizmanın kendisinden TÜRETİLDİ ve bu dosyada açıkça yazılıdır:
 * coordinator BEACON gönderir, sonra her node sırayla bir transmit
 * opportunity alır; node o pencerede göndermezse `to_timer` kadar beklenir ve
 * sıra bir sonrakine geçer. Yani çevrim = BEACON + Σ(gönderen node'ların
 * iletim süresi) + (sessiz node sayısı × to_timer). CAN gecikme bütçesindeki
 * (11h) disiplinle aynı: kural yazılı, sayı uydurulmamış.
 *
 * **BEACON süresi gömülmedi:** yukarıdaki iki kaynakta da BEACON'ın bit
 * uzunluğu yok, yalnız varlığı var. `beaconBitTimes` çağırandan gelir,
 * verilmezse 0 sayılır ve çevrim süresi BEACON'sız raporlanır. Zincir:
 * 1-Wire endianness → RS-232 gerilim aralığı → 4–20 mA arıza eşikleri →
 * LIN break asgarisi → PMBus ULINEAR16 üssü → bu.
 */

const BITS_PER_BYTE = 8;
const SECONDS_PER_MICROSECOND = 1e-6;

export type SpePhyType = '10base-t1s' | '10base-t1l' | '100base-t1' | '1000base-t1';

/**
 * PHY sınıfının hat hızı (bit/s). Değerler PHY ADININ KENDİSİNDEN gelir
 * (IEEE 802.3 adlandırması: baştaki sayı Mbit/s'dir), tablodan kopyalanmadı.
 */
export const SPE_BIT_RATES: Record<SpePhyType, number> = {
  '10base-t1s': 10e6,
  '10base-t1l': 10e6,
  '100base-t1': 100e6,
  '1000base-t1': 1000e6,
};

/**
 * OPEN Alliance PLCA Management Registers v1.2'nin yayımladığı register
 * varsayılanları. Hesaplarda ZORUNLU DEĞİL — arayüzün başlangıç değerleri ve
 * "cihazın varsayılanı buydu" karşılaştırması için. Motor bu sayıları
 * kendiliğinden kullanmaz, çağıran geçirir.
 */
export const PLCA_REGISTER_DEFAULTS = {
  /** TOTMR.TOT (31.CA04) — bit-times. */
  toTimerBitTimes: 32,
  /** BURST.MAXBC (31.CA05) — 0 = burst kapalı. */
  maxBurstCount: 0,
  /** BURST.BTMR (31.CA05) — bit-times. */
  burstTimerBitTimes: 128,
} as const;

/** Tek bir bitin süresi (saniye). */
export function speBitTime(phy: SpePhyType): number {
  return 1 / SPE_BIT_RATES[phy];
}

export interface SpeFrameTimeInput {
  phy: SpePhyType;
  /** Hat üzerinde giden bayt sayısı (preamble/SFD/FCS dahil, çağıranın işi). */
  frameBytes: number;
  /** Çerçeveler arası boşluk, bit-times. Verilmezse 0. */
  interFrameGapBitTimes?: number;
}

export interface SpeFrameTimeResult {
  bitTimeSeconds: number;
  frameBitTimes: number;
  frameSeconds: number;
  /** IFG dahil toplam — çağıran IFG vermezse `frameSeconds` ile aynıdır. */
  totalSeconds: number;
}

export function calculateSpeFrameTime(input: SpeFrameTimeInput): SpeFrameTimeResult {
  if (!Number.isFinite(input.frameBytes) || input.frameBytes < 0) {
    throw new RangeError('çerçeve bayt sayısı negatif olamaz');
  }
  const gap = input.interFrameGapBitTimes ?? 0;
  if (gap < 0) throw new RangeError('IFG negatif olamaz');

  const bitTimeSeconds = speBitTime(input.phy);
  const frameBitTimes = input.frameBytes * BITS_PER_BYTE;
  const frameSeconds = frameBitTimes * bitTimeSeconds;

  return {
    bitTimeSeconds,
    frameBitTimes,
    frameSeconds,
    totalSeconds: frameSeconds + gap * bitTimeSeconds,
  };
}

export interface PlcaCycleInput {
  /** PLCA yalnız 10BASE-T1S'te tanımlıdır ama hesap hızdan bağımsızdır. */
  phy: SpePhyType;
  /** Coordinator dahil toplam node sayısı (PLCACTRL1.NCNT karşılığı). */
  nodeCount: number;
  /** Bu çevrimde GERÇEKTEN gönderen node sayısı. */
  transmittingNodes: number;
  /** Gönderen node başına çerçeve boyu (bayt). */
  frameBytes: number;
  /** TOTMR.TOT — bit-times. */
  toTimerBitTimes: number;
  /** BEACON süresi, bit-times. Kaynaklarda YOK; verilmezse 0 sayılır. */
  beaconBitTimes?: number;
  /** Çerçeveler arası boşluk, bit-times. Verilmezse 0. */
  interFrameGapBitTimes?: number;
}

export interface PlcaCycleResult {
  bitTimeSeconds: number;
  /** Sessiz node'ların toplam bekleme süresi (bit-times). */
  idleBitTimes: number;
  /** Gönderen node'ların toplam iletim süresi (bit-times). */
  transmitBitTimes: number;
  beaconBitTimes: number;
  cycleBitTimes: number;
  cycleSeconds: number;
  /**
   * Bir node'un iki transmit opportunity arasında bekleyeceği en kötü süre —
   * PLCA'nın deterministik olma iddiasının sayısal karşılığı. Çevrimin
   * kendisidir (sıra bir tur sonra geri gelir).
   */
  worstCaseAccessSeconds: number;
  /** Hat kapasitesinin gerçekten veriye giden oranı (%). */
  efficiencyPercent: number;
  /** BEACON verilmediği için çevrim eksik hesaplandıysa true. */
  beaconOmitted: boolean;
}

/**
 * PLCA çevrim süresi. Formül mekanizmadan türetildi (dosya başı):
 * `çevrim = BEACON + gönderenler × (çerçeve + IFG) + sessizler × to_timer`.
 *
 * `transmittingNodes` node sayısını AŞAMAZ; aşarsa hata verilir — sessizce
 * kırpmak "kaç node sustu" sorusunu gizlerdi.
 */
export function calculatePlcaCycle(input: PlcaCycleInput): PlcaCycleResult {
  if (!Number.isInteger(input.nodeCount) || input.nodeCount < 1) {
    throw new RangeError('node sayısı en az 1 tam sayı olmalı');
  }
  if (!Number.isInteger(input.transmittingNodes) || input.transmittingNodes < 0) {
    throw new RangeError('gönderen node sayısı negatif olmayan tam sayı olmalı');
  }
  if (input.transmittingNodes > input.nodeCount) {
    throw new RangeError('gönderen node sayısı toplam node sayısını aşamaz');
  }
  if (input.toTimerBitTimes <= 0) throw new RangeError('to_timer pozitif olmalı');
  if (input.frameBytes < 0) throw new RangeError('çerçeve bayt sayısı negatif olamaz');

  const bitTimeSeconds = speBitTime(input.phy);
  const beacon = input.beaconBitTimes ?? 0;
  const gap = input.interFrameGapBitTimes ?? 0;

  const idleNodes = input.nodeCount - input.transmittingNodes;
  const idleBitTimes = idleNodes * input.toTimerBitTimes;
  const payloadBitTimes = input.transmittingNodes * input.frameBytes * BITS_PER_BYTE;
  const transmitBitTimes = payloadBitTimes + input.transmittingNodes * gap;

  const cycleBitTimes = beacon + idleBitTimes + transmitBitTimes;
  const cycleSeconds = cycleBitTimes * bitTimeSeconds;

  return {
    bitTimeSeconds,
    idleBitTimes,
    transmitBitTimes,
    beaconBitTimes: beacon,
    cycleBitTimes,
    cycleSeconds,
    worstCaseAccessSeconds: cycleSeconds,
    efficiencyPercent: cycleBitTimes === 0 ? 0 : (payloadBitTimes / cycleBitTimes) * 100,
    beaconOmitted: input.beaconBitTimes === undefined,
  };
}

export interface PlcaBurstInput {
  /** BURST.MAXBC — 0 ise burst kapalıdır. */
  maxBurstCount: number;
  /** BURST.BTMR — bit-times. */
  burstTimerBitTimes: number;
  frameBytes: number;
  phy: SpePhyType;
}

export interface PlcaBurstResult {
  enabled: boolean;
  /** Bir transmit opportunity'de gönderilebilecek toplam paket sayısı. */
  packetsPerOpportunity: number;
  opportunityBitTimes: number;
  opportunitySeconds: number;
}

/**
 * Burst modu: MAXBC sıfırdan büyükse node aynı transmit opportunity içinde
 * ek paketler gönderebilir; paketler arasında `burst_timer` kadar bekler
 * (OPEN Alliance PLCA Registers v1.2 §4.6). MAXBC = 0 varsayılan ve "burst
 * kapalı" demektir — o durumda pencere TEK pakettir.
 */
export function calculatePlcaBurst(input: PlcaBurstInput): PlcaBurstResult {
  if (!Number.isInteger(input.maxBurstCount) || input.maxBurstCount < 0) {
    throw new RangeError('MAXBC negatif olmayan tam sayı olmalı');
  }
  if (input.burstTimerBitTimes < 0) throw new RangeError('burst_timer negatif olamaz');

  const packetsPerOpportunity = 1 + input.maxBurstCount;
  const frameBitTimes = input.frameBytes * BITS_PER_BYTE;
  const opportunityBitTimes =
    packetsPerOpportunity * frameBitTimes + input.maxBurstCount * input.burstTimerBitTimes;

  return {
    enabled: input.maxBurstCount > 0,
    packetsPerOpportunity,
    opportunityBitTimes,
    opportunitySeconds: opportunityBitTimes * speBitTime(input.phy),
  };
}

/** Mikrosaniyeyi saniyeye çeviren küçük yardımcı (arayüz girdileri µs alır). */
export function microsecondsToSeconds(value: number): number {
  return value * SECONDS_PER_MICROSECOND;
}
