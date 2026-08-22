export * from './uart';
export * from './rs485';
export * from './spi';
export * from './i2c';
export * from './pmbus';
export * from './lora';
// Logic seviyesi uyumluluğu (TTL/CMOS UART) — zamanlama değil elektriksel
// hesap, ama rs485.ts emsaliyle aynı klasörde (bkz. logicLevels.ts dosya başı).
export * from './logicLevels';
