/**
 * Logic seviyesi uyumluluk motoru — TTL UART ve CMOS UART sayfalarının asıl
 * mühendislik sorusu. Faz 10 dalga 11f.
 *
 * Dosya `timing/` altında duruyor çünkü `rs485.ts` emsali aynı: termination,
 * bias ve unit load da zamanlama değil ELEKTRİKSEL hesaptır ve orada yaşıyor.
 * Ayrı bir `electrical/` klasörü açmak spec §6'nın klasör listesinden sapmak
 * olurdu (CLAUDE.md: yapı spec'ten birebir alındı).
 *
 * ── Kural, kaynağın kendi eşitsizlikleri ───────────────────────────────────
 * Spec özeti (`docs/spec/ozet/01-fiziksel-arayuzler.md:177-183`, TTL UART):
 *   - HIGH kontrolü: `VOH_min > VIH_min`
 *   - LOW kontrolü:  `VOL_max < VIL_max`
 * Sağlanırsa "Logic Compatibility: PASS", sağlanmazsa "WARNING: Level
 * Translation May Be Required".
 *
 * Gürültü payları bu eşitsizliklerin FARKIDIR, uydurma bir katsayı değil:
 * `NM_H = VOH_min − VIH_min`, `NM_L = VIL_max − VOL_max`. Uyumluluk ikisinin
 * de pozitif olmasıdır.
 *
 * ── Kaynağın ısrarla söylediği iki şey ─────────────────────────────────────
 * 1. **"3.3V mi 5V mi" seçtirip karar VERİLEMEZ** (`:181`): gerçek uyumluluk
 *    datasheet'teki VIH/VIL/VOH/VOL, Absolute Maximum ve 5V-tolerant
 *    değerlerine bağlıdır. Bu yüzden motor besleme gerilimi almaz, yalnız dört
 *    eşik değerini alır — "hazır profil" listesi bilerek yoktur.
 * 2. **Her yön AYRI değerlendirilmelidir** (`:189`, CMOS UART): iki cihazın
 *    çıkış/giriş karakteristikleri simetrik olmayabilir. Spec'in kendi örneği
 *    `A→B: PASS`, `B→A: FAIL (B VOH=1.8V, A VIH=2.0V)` — `evaluateLogicLevelLink`
 *    tam olarak bu iki yönü ayrı döndürür.
 *
 * ── Absolute Maximum ───────────────────────────────────────────────────────
 * Opsiyoneldir; verilirse sürücünün HIGH çıkışının alıcının mutlak maksimum
 * giriş geriliminden büyük olması ayrı bir bayrakla işaretlenir. Bu, logic
 * uyumluluğundan FARKLI bir arıza: seviyeler "uyumlu" görünürken alıcı fiziksel
 * olarak zarar görebilir (5V sürücü → 3.3V tolerant olmayan giriş). Değer
 * verilmezse hiçbir varsayım yapılmaz, bayrak `false` kalır.
 */

/** Bir cihazın datasheet'ten okunan dört eşiği; hepsi volt. */
export interface LogicLevelDevice {
  /** Çıkış HIGH minimum (V_OH min). */
  vohMinVolts: number;
  /** Çıkış LOW maksimum (V_OL max). */
  volMaxVolts: number;
  /** Giriş HIGH minimum (V_IH min). */
  vihMinVolts: number;
  /** Giriş LOW maksimum (V_IL max). */
  vilMaxVolts: number;
  /** Datasheet'teki mutlak maksimum giriş gerilimi — verilirse aşırı gerilim kontrolü yapılır. */
  absoluteMaxInputVolts?: number;
}

export interface LogicLevelDirectionResult {
  /** `VOH_min − VIH_min`; pozitifse HIGH seviyesi tanınır. */
  highMarginVolts: number;
  /** `VIL_max − VOL_max`; pozitifse LOW seviyesi tanınır. */
  lowMarginVolts: number;
  highCompatible: boolean;
  lowCompatible: boolean;
  /** İkisi birden sağlanıyorsa PASS; biri bile sağlanmazsa seviye çevirici gerekebilir. */
  compatible: boolean;
  /** Sürücünün HIGH çıkışı alıcının mutlak maksimumunu aşıyor mu (değer verildiyse). */
  overvoltage: boolean;
}

export interface LogicLevelLinkResult {
  aToB: LogicLevelDirectionResult;
  bToA: LogicLevelDirectionResult;
  /** İki yön de uyumluysa true — tek yönün geçmesi bağlantıyı kurtarmaz. */
  compatible: boolean;
}

function assertDevice(device: LogicLevelDevice, label: string): void {
  if (device.vohMinVolts <= device.volMaxVolts) {
    throw new RangeError(`${label}: V_OH(min) V_OL(max) değerinden büyük olmalı`);
  }
  if (device.vihMinVolts <= device.vilMaxVolts) {
    throw new RangeError(`${label}: V_IH(min) V_IL(max) değerinden büyük olmalı`);
  }
}

/**
 * Tek yön: `driver` süren, `receiver` dinleyen cihaz. Eşik değerlerinin
 * kendisi karşılaştırılır — besleme gerilimi ya da "aile adı" (TTL/LVCMOS)
 * hesaba HİÇ girmez (spec'in 1. ısrarı).
 */
export function evaluateLogicLevelDirection(
  driver: LogicLevelDevice,
  receiver: LogicLevelDevice,
): LogicLevelDirectionResult {
  assertDevice(driver, 'driver');
  assertDevice(receiver, 'receiver');

  const highMarginVolts = driver.vohMinVolts - receiver.vihMinVolts;
  const lowMarginVolts = receiver.vilMaxVolts - driver.volMaxVolts;
  const highCompatible = highMarginVolts > 0;
  const lowCompatible = lowMarginVolts > 0;

  const overvoltage =
    receiver.absoluteMaxInputVolts !== undefined &&
    driver.vohMinVolts > receiver.absoluteMaxInputVolts;

  return {
    highMarginVolts,
    lowMarginVolts,
    highCompatible,
    lowCompatible,
    compatible: highCompatible && lowCompatible,
    overvoltage,
  };
}

/**
 * İki yönü AYRI hesaplar (spec'in 2. ısrarı). Spec'in kendi CMOS örneğinde
 * `A→B: PASS` iken `B→A: FAIL` olabilir — tek bir "uyumlu mu" cevabı bu
 * asimetriyi gizlerdi.
 */
export function evaluateLogicLevelLink(
  deviceA: LogicLevelDevice,
  deviceB: LogicLevelDevice,
): LogicLevelLinkResult {
  const aToB = evaluateLogicLevelDirection(deviceA, deviceB);
  const bToA = evaluateLogicLevelDirection(deviceB, deviceA);
  return { aToB, bToA, compatible: aToB.compatible && bToA.compatible };
}
