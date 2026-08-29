/**
 * Örnek A2L dosyası ve ölçüm başına örnek baytlar.
 *
 * ── KAYNAK: SENTETİK, UYDURMA DEĞİL ─────────────────────────────────────────
 * Gerçek bir ECU projesinden alınmış gibi sunulmuyor. Söz dizimi ve parametre
 * SIRASI ASAM MCD-2 MC (ASAP2) V1.6'dan; içerik (ölçüm adları, katsayılar,
 * adresler) bu dosya için yazıldı ve kendi içinde tutarlı.
 *
 * Örnek bilerek üç tuzağı birden taşıyor, çünkü panelin bunları geçtiği
 * görülmeli:
 *
 * 1. `MOD_COMMON` `MSB_LAST` diyor (ASAM varsayılanı, little-endian) ama
 *    `ThrottlePosition` kendi `BYTE_ORDER MSB_FIRST`ini taşıyor — girdi
 *    modülü EZER.
 * 2. `CM_EngineSpeed` bir `RAT_FUNC`tır ve katsayıları TERS yönde tanımlıdır
 *    (`int = 4 × phys`), yani doğru çözüm `phys = int / 4`. Katsayıları
 *    doğrudan çarpan sanan bir uygulama 16000 basardı, 1000 değil.
 * 3. `RECORD_LAYOUT` ve `IF_DATA` blokları kapsam dışıdır ve dosyanın
 *    çoğunluğunu temsil eder — ayrıştırıcı bunları sessizce atlamalı.
 */

export const SAMPLE_A2L_TEXT = `/* Örnek A2L — ALP Comm Toolkit
   Söz dizimi: ASAM MCD-2 MC V1.6 */
ASAP2_VERSION 1 61

/begin PROJECT ALP_DEMO "ALP örnek kalibrasyon projesi"

  /begin MODULE ECU_MAIN "Örnek motor kontrol ünitesi"

    /begin MOD_COMMON "Modül varsayılanları"
      BYTE_ORDER MSB_LAST
      ALIGNMENT_BYTE 1
    /end MOD_COMMON

    /* Kapsam dışı blok: atlanmalı, uyarı üretmemeli. */
    /begin RECORD_LAYOUT RL_UWORD
      FNC_VALUES 1 UWORD COLUMN_DIR DIRECT
    /end RECORD_LAYOUT

    /begin MEASUREMENT EngineSpeed "Motor devri"
      UWORD CM_EngineSpeed 0 0 0 16383.75
      ECU_ADDRESS 0x800100
      PHYS_UNIT "rpm"
    /end MEASUREMENT

    /begin MEASUREMENT CoolantTemperature "Soğutma suyu sıcaklığı"
      UBYTE CM_Temperature 0 0 -40 87.5
      ECU_ADDRESS 0x800104
    /end MEASUREMENT

    /begin MEASUREMENT ThrottlePosition "Gaz kelebeği konumu"
      FLOAT32_IEEE CM_Identical 0 0 0 100
      ECU_ADDRESS 0x800108
      BYTE_ORDER MSB_FIRST
      PHYS_UNIT "%"
    /end MEASUREMENT

    /begin MEASUREMENT GearState "Vites konumu"
      UBYTE CM_Gear 0 0 0 6
      ECU_ADDRESS 0x80010C
    /end MEASUREMENT

    /begin MEASUREMENT LampState "Gösterge lambaları"
      UWORD CM_Identical 0 0 0 15
      ECU_ADDRESS 0x800110
      BIT_MASK 0x0F00
    /end MEASUREMENT

    /begin CHARACTERISTIC IdleSetpoint "Rölanti devri hedefi"
      VALUE 0x810000 RL_UWORD 0 CM_EngineSpeed 0 8000
    /end CHARACTERISTIC

    /begin COMPU_METHOD CM_EngineSpeed "Devir dönüşümü"
      RAT_FUNC "%6.1" "rpm"
      COEFFS 0 4 0 0 0 1
    /end COMPU_METHOD

    /begin COMPU_METHOD CM_Temperature "Sıcaklık dönüşümü"
      LINEAR "%6.1" "degC"
      COEFFS_LINEAR 0.5 -40
    /end COMPU_METHOD

    /begin COMPU_METHOD CM_Identical "Dönüşümsüz"
      IDENTICAL "%6.2" ""
    /end COMPU_METHOD

    /begin COMPU_METHOD CM_Gear "Vites sözlüğü"
      TAB_VERB "%.0" ""
      COMPU_TAB_REF VT_Gear
    /end COMPU_METHOD

    /begin COMPU_VTAB VT_Gear "Vites adları"
      TAB_VERB 4
      0 "Neutral"
      1 "First"
      2 "Second"
      3 "Third"
    /end COMPU_VTAB

    /begin IF_DATA XCP
      /begin DAQ DYNAMIC 0 2 0 OPTIMISATION_TYPE_DEFAULT ADDRESS_EXTENSION_FREE
      /end DAQ
    /end IF_DATA

  /end MODULE
/end PROJECT
`;

/**
 * Ölçüm başına örnek baytlar. Her biri TEK ölçümün baytıdır (DTO'nun tamamı
 * değil) — `decodeA2lMeasurement` sözleşmesi de böyle.
 */
export const SAMPLE_A2L_BYTES: Readonly<Record<string, Uint8Array>> = {
  /** MSB_LAST: A0 0F → 0x0FA0 = 4000 ham → RAT_FUNC tersi → 1000 rpm */
  EngineSpeed: Uint8Array.from([0xa0, 0x0f]),
  /** 0xB4 = 180 ham → LINEAR (0.5 × 180 − 40) = 50 °C */
  CoolantTemperature: Uint8Array.from([0xb4]),
  /** MSB_FIRST (girdi ezmesi): 42 48 00 00 = 50.0 */
  ThrottlePosition: Uint8Array.from([0x42, 0x48, 0x00, 0x00]),
  /** 0x01 → sözlükten "First" */
  GearState: Uint8Array.from([0x01]),
  /** MSB_LAST: 00 05 → 0x0500 ham, BIT_MASK 0x0F00 → 5 */
  LampState: Uint8Array.from([0x00, 0x05]),
};
