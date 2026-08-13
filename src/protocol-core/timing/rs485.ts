/**
 * RS-485 sonlandırma, bias, yayılma gecikmesi ve Unit Load hesap motoru.
 *
 * RS-485 kendi başına bir üst-katman protokol değildir (spec §3.1: "RS-485 ≠
 * Modbus") — burada yalnız fiziksel katmanın elektriksel/zamanlama hesapları
 * var. Frame protokolü (Modbus RTU vb.) ayrı motorlardadır.
 */

/** Nominal twisted-pair hat sonlandırması — transceiver datasheet'lerinin ortak varsayımı. */
export const RS485_STANDARD_TERMINATION_OHMS = 120;

/** Standart RS-485 bus sürücüsü 32 Unit Load'a göre değerlendirilir (spec §3.1 "Unit Load"). */
export const RS485_MAX_UNIT_LOADS = 32;

/** Round-trip = sinyalin hat sonuna gidip yansımanın geri dönüş süresi: T_prop'un iki katı. */
const RS485_ROUND_TRIP_MULTIPLIER = 2;

// --- Sonlandırma (termination) ---

export interface Rs485TerminationInput {
  /** Sürücünün ürettiği diferansiyel gerilim (V_A − V_B), volt. */
  differentialVoltage: number;
  /** Hattın iki ucundaki sonlandırma direnci — ikisi eşit kabul edilir. Varsayılan 120 Ω. */
  terminationOhms?: number;
}

export interface Rs485TerminationResult {
  /** İki paralel sonlandırmanın efektif direnci: 120‖120 = 60 Ω. */
  effectiveResistanceOhms: number;
  /** Sürücünün sonlandırma üzerinden akıttığı akım (Ohm kanunu). */
  driverCurrentAmps: number;
}

/**
 * İki eşit sonlandırma direncinin paralel bileşkesini ve sürücü akımını
 * hesaplar. Enerjisiz bir RS-485 hattında A-B arası ölçülen ~60 Ω, iki 120 Ω
 * sonlandırmanın pratik göstergesidir (spec §3.1 "Termination").
 */
export function calculateRs485Termination(input: Rs485TerminationInput): Rs485TerminationResult {
  const terminationOhms = input.terminationOhms ?? RS485_STANDARD_TERMINATION_OHMS;
  if (terminationOhms <= 0) {
    throw new RangeError('terminationOhms pozitif olmalı');
  }
  // 1/(1/R + 1/R) = R/2 — iki eşit direncin paralel bileşkesi; formül genel
  // paralel-direnç ifadesiyle bırakıldı ki tek-taraflı sonlandırma (asimetrik
  // hat) ihtiyacı çıkarsa fonksiyon genişletilebilsin.
  const effectiveResistanceOhms = 1 / (1 / terminationOhms + 1 / terminationOhms);
  const driverCurrentAmps = input.differentialVoltage / effectiveResistanceOhms;

  return { effectiveResistanceOhms, driverCurrentAmps };
}

// --- Bias (fail-safe) ---

export interface Rs485BiasInput {
  /** Bias ağının beslendiği gerilim (V_CC). */
  supplyVoltage: number;
  /** Bus sonlandırma direnci (R_T). */
  terminationOhms: number;
  /** Pull-up ve pull-down bias direnci — ikisi eşit kabul edilir (R_B). */
  biasResistorOhms: number;
}

export interface Rs485BiasResult {
  /** Sürücü pasifken (idle bus) beklenen A-B diferansiyel gerilimi. */
  differentialBiasVoltage: number;
  biasCurrentAmps: number;
}

/**
 * Hiçbir sürücü aktif değilken (bus idle) bias direnç ağının ürettiği
 * diferansiyel gerilimi hesaplar. Bu gerilim, receiver'ın "floating bus"ı
 * yanlışlıkla dominant veri olarak okumasını engeller (spec §3.1
 * "Bias/fail-safe"): `V_AB = V_CC × R_T / (2×R_B + R_T)`.
 */
export function calculateRs485Bias(input: Rs485BiasInput): Rs485BiasResult {
  const denominator = 2 * input.biasResistorOhms + input.terminationOhms;
  if (denominator <= 0) {
    throw new RangeError('2×R_B + R_T pozitif olmalı');
  }
  const differentialBiasVoltage = (input.supplyVoltage * input.terminationOhms) / denominator;
  const biasCurrentAmps = input.supplyVoltage / denominator;

  return { differentialBiasVoltage, biasCurrentAmps };
}

// --- Propagation delay ---

export interface Rs485PropagationInput {
  cableLengthMeters: number;
  /** Kablo dielektriğine bağlı sinyal yayılma hızı (tipik twisted-pair ~2×10⁸ m/s). */
  propagationVelocityMetersPerSecond: number;
}

export interface Rs485PropagationResult {
  propagationDelaySeconds: number;
  /** Sinyalin hattın sonuna gidip yansımanın geri dönme süresi (T_prop'un iki katı). */
  roundTripDelaySeconds: number;
}

/**
 * Kablo uzunluğu ve yayılma hızından tek yön ve round-trip gecikmeyi hesaplar.
 * Zorunlu fixture: 500 m / 2×10⁸ m/s → `T_prop = 2.5 µs`, `T_RT = 5 µs`
 * (spec §3.1 "Propagation delay").
 */
export function calculateRs485Propagation(input: Rs485PropagationInput): Rs485PropagationResult {
  if (input.propagationVelocityMetersPerSecond <= 0) {
    throw new RangeError('propagationVelocityMetersPerSecond pozitif olmalı');
  }
  const propagationDelaySeconds =
    input.cableLengthMeters / input.propagationVelocityMetersPerSecond;

  return {
    propagationDelaySeconds,
    roundTripDelaySeconds: propagationDelaySeconds * RS485_ROUND_TRIP_MULTIPLIER,
  };
}

// --- Unit Load ---

export interface Rs485BusNode {
  id: string;
  /** Standart node = 1 UL; 1/4 UL, 1/8 UL gibi düşük yüklü alıcılar da olabilir. */
  unitLoad: number;
}

export interface Rs485UnitLoadResult {
  totalUnitLoad: number;
  maximumAllowed: number;
  withinLimit: boolean;
  nodeCount: number;
}

/**
 * Bus üzerindeki tüm node'ların Unit Load toplamını standart 32 UL sınırıyla
 * karşılaştırır (spec §3.1 "Unit Load": 1/8 UL cihazlarla teorik 256 node).
 * Yalnız elektriksel yük sınırıdır — topoloji/stub etkisi kapsam dışı (bkz.
 * spec özeti "dikkat çekenler" madde 6).
 */
export function calculateRs485UnitLoad(nodes: readonly Rs485BusNode[]): Rs485UnitLoadResult {
  const totalUnitLoad = nodes.reduce((sum, node) => sum + node.unitLoad, 0);

  return {
    totalUnitLoad,
    maximumAllowed: RS485_MAX_UNIT_LOADS,
    withinLimit: totalUnitLoad <= RS485_MAX_UNIT_LOADS,
    nodeCount: nodes.length,
  };
}
