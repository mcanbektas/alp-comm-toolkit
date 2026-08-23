export * from './uart';
export * from './rs485';
export * from './spi';
export * from './i2c';
export * from './pmbus';
export * from './lora';
// Logic seviyesi uyumluluğu (TTL/CMOS UART) — zamanlama değil elektriksel
// hesap, ama rs485.ts emsaliyle aynı klasörde (bkz. logicLevels.ts dosya başı).
export * from './logicLevels';
// Akım döngüsü (Current Loop / 4-20 mA) — aynı gerekçe: elektriksel hesap,
// decode'u olmayan iki katalog kaydının tek motoru (bkz. currentLoop.ts).
export * from './currentLoop';
// Araç içi fiziksel katmanlar (CAN/LIN/FlexRay PHY) — kablo gecikmesini
// rs485.ts'ten ÇAĞIRIR, kopyalamaz (bkz. vehiclePhy.ts dosya başı).
export * from './vehiclePhy';
// Single Pair Ethernet (10BASE-T1S/T1L, 100BASE-T1, 1000BASE-T1) + PLCA çevrim
// bütçesi — yine decode'u olmayan bir katalog kaydının motoru
// (bkz. singlePairEthernet.ts dosya başı).
export * from './singlePairEthernet';
// Microwire — PARAMETRİK transaction motoru: profil (opcode/adres/word bit
// genişlikleri) girdidir, sabit değil. Spec'in "SPI ile aynı kabul etme"
// emrinin karşılığı (bkz. microwire.ts dosya başı).
export * from './microwire';
// K-Line — 5-baud init, fast init ve bayt/mesaj aralığı bütçesi. Yine
// decode'u olmayan bir katalog kaydının motoru (bkz. kLine.ts dosya başı).
export * from './kLine';
