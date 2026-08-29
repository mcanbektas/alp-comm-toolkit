/**
 * Örnek DSDL tanımı ve ona ait örnek baytlar.
 *
 * ── KAYNAK: SENTETİK, UYDURMA DEĞİL ─────────────────────────────────────────
 * Gerçek bir `uavcan.*` dosyası olduğu iddia edilmiyor. Söz dizimi Cyphal
 * Specification §3'ten; içerik bir telemetri mesajını örneklemek için yazıldı
 * ve bilerek üç şeyi birden taşıyor: bayt hizasına oturmayan bir alan
 * (`uint4`), bir sabit ve konumu telin içeriğine bağlı bir değişken dizi.
 */

/** Panelin varsayılan örneği. */
export const SAMPLE_DSDL_TEXT = `# ALP telemetri örneği — Cyphal söz dizimi (§3)
@sealed

uint16 sequence          # Sıra numarası
uint4  mode              # Bayt hizasına OTURMAZ
uint4  health
int16  temperature_deci  # 0.1 °C adımlı
float32 voltage
bool   armed
void7                    # Dolgu: adı yoktur

uint8 MODE_STANDBY = 0
uint8 MODE_ACTIVE  = 1

# Buradan sonrası içeriğe bağlıdır: uzunluk teldedir.
uint8[<=32] payload
`;

/**
 * Örnek baytlar. Cyphal küçük endian, LSB-first paketler:
 *   D2 04    → sequence = 1234 (0x04D2)
 *   21       → mode = 1 (düşük yarı bayt), health = 2 (yüksek yarı bayt)
 *   2C 01    → temperature_deci = 300 → 30.0 °C
 *   00 00 48 42 → voltage = 50.0 (0x42480000)
 *   01       → armed = true (bit 0), kalan yedi bit `void7` dolgusu
 */
export const SAMPLE_DSDL_BYTES = Uint8Array.from([
  0xd2, 0x04, 0x21, 0x2c, 0x01, 0x00, 0x00, 0x48, 0x42, 0x01,
]);
