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
