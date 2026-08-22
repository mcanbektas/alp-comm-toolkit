import type { CalculatorCategory, CalculatorTool } from './types';

/**
 * Hesap araçları listesi — spec §12 (28 dönüşüm aracı, TAM LİSTE), §13
 * (UART/RS-485/SPI/I²C/PMBus zamanlama) ve §11 (CRC Finder). Katalogdaki 172
 * protokolün aksine bu liste küçük ve sabit; `catalog/index.ts`teki gibi
 * doğrusal tarama yeterli, ayrı bir indeks kurulmaz.
 *
 * Birden çok kayıt AYNI bileşeni paylaşabilir (örn. altı kod üreteci
 * `CodeArrayGeneratorTool`'u `language` parametresiyle çağırır) — bu listedeki
 * `id` gezinme/derin bağlantı kimliğidir, bileşen seçimi `CalculatorPage`dedir.
 */
export const CALCULATOR_TOOLS: readonly CalculatorTool[] = [
  // --- Bayt/metin dönüşümleri ---
  { id: 'hex-to-ascii', category: 'conversion', nameKey: 'calc.hexToAscii.name', summaryKey: 'calc.hexToAscii.summary' },
  { id: 'ascii-to-hex', category: 'conversion', nameKey: 'calc.asciiToHex.name', summaryKey: 'calc.asciiToHex.summary' },
  { id: 'hex-to-binary', category: 'conversion', nameKey: 'calc.hexToBinary.name', summaryKey: 'calc.hexToBinary.summary' },
  { id: 'binary-to-hex', category: 'conversion', nameKey: 'calc.binaryToHex.name', summaryKey: 'calc.binaryToHex.summary' },
  { id: 'decimal-converter', category: 'conversion', nameKey: 'calc.decimalConverter.name', summaryKey: 'calc.decimalConverter.summary' },
  { id: 'utf8-byte-viewer', category: 'conversion', nameKey: 'calc.utf8ByteViewer.name', summaryKey: 'calc.utf8ByteViewer.summary' },
  { id: 'base64', category: 'conversion', nameKey: 'calc.base64.name', summaryKey: 'calc.base64.summary' },
  { id: 'base32', category: 'conversion', nameKey: 'calc.base32.name', summaryKey: 'calc.base32.summary' },
  { id: 'url-encoding', category: 'conversion', nameKey: 'calc.urlEncoding.name', summaryKey: 'calc.urlEncoding.summary' },

  // --- Sayısal/bit dönüşümleri ---
  { id: 'signed-unsigned', category: 'conversion', nameKey: 'calc.signedUnsigned.name', summaryKey: 'calc.signedUnsigned.summary' },
  { id: 'little-endian', category: 'conversion', nameKey: 'calc.littleEndian.name', summaryKey: 'calc.littleEndian.summary' },
  { id: 'big-endian', category: 'conversion', nameKey: 'calc.bigEndian.name', summaryKey: 'calc.bigEndian.summary' },
  { id: 'mixed-endian', category: 'conversion', nameKey: 'calc.mixedEndian.name', summaryKey: 'calc.mixedEndian.summary' },
  { id: 'ieee754-float16', category: 'conversion', nameKey: 'calc.ieee754Float16.name', summaryKey: 'calc.ieee754Float16.summary' },
  { id: 'ieee754-float32', category: 'conversion', nameKey: 'calc.ieee754Float32.name', summaryKey: 'calc.ieee754Float32.summary' },
  { id: 'ieee754-float64', category: 'conversion', nameKey: 'calc.ieee754Float64.name', summaryKey: 'calc.ieee754Float64.summary' },
  { id: 'bcd-converter', category: 'conversion', nameKey: 'calc.bcdConverter.name', summaryKey: 'calc.bcdConverter.summary' },
  { id: 'unix-timestamp', category: 'conversion', nameKey: 'calc.unixTimestamp.name', summaryKey: 'calc.unixTimestamp.summary' },
  { id: 'bit-mask', category: 'conversion', nameKey: 'calc.bitMask.name', summaryKey: 'calc.bitMask.summary' },
  { id: 'byte-swap', category: 'conversion', nameKey: 'calc.byteSwap.name', summaryKey: 'calc.byteSwap.summary' },
  { id: 'bit-reverse', category: 'conversion', nameKey: 'calc.bitReverse.name', summaryKey: 'calc.bitReverse.summary' },
  { id: 'nibble-swap', category: 'conversion', nameKey: 'calc.nibbleSwap.name', summaryKey: 'calc.nibbleSwap.summary' },

  // --- Kod üreteçleri (hepsi tek bileşen, `language` parametreli) ---
  { id: 'c-array-generator', category: 'conversion', nameKey: 'calc.cArrayGenerator.name', summaryKey: 'calc.cArrayGenerator.summary' },
  { id: 'cpp-array-generator', category: 'conversion', nameKey: 'calc.cppArrayGenerator.name', summaryKey: 'calc.cppArrayGenerator.summary' },
  { id: 'python-bytes-generator', category: 'conversion', nameKey: 'calc.pythonBytesGenerator.name', summaryKey: 'calc.pythonBytesGenerator.summary' },
  { id: 'rust-array-generator', category: 'conversion', nameKey: 'calc.rustArrayGenerator.name', summaryKey: 'calc.rustArrayGenerator.summary' },
  { id: 'java-byte-array-generator', category: 'conversion', nameKey: 'calc.javaByteArrayGenerator.name', summaryKey: 'calc.javaByteArrayGenerator.summary' },
  {
    id: 'javascript-uint8array-generator',
    category: 'conversion',
    nameKey: 'calc.javascriptUint8ArrayGenerator.name',
    summaryKey: 'calc.javascriptUint8ArrayGenerator.summary',
  },

  // --- Zamanlama (spec §13) ---
  { id: 'uart-timing', category: 'timing', nameKey: 'calc.uartTiming.name', summaryKey: 'calc.uartTiming.summary' },
  { id: 'rs485-timing', category: 'timing', nameKey: 'calc.rs485Timing.name', summaryKey: 'calc.rs485Timing.summary' },
  { id: 'spi-timing', category: 'timing', nameKey: 'calc.spiTiming.name', summaryKey: 'calc.spiTiming.summary' },
  { id: 'i2c-timing', category: 'timing', nameKey: 'calc.i2cTiming.name', summaryKey: 'calc.i2cTiming.summary' },
  { id: 'pmbus-linear', category: 'timing', nameKey: 'calc.pmbusLinear.name', summaryKey: 'calc.pmbusLinear.summary' },
  // DIRECT format AYRI kayıt: Linear11/16 çerçeveden çözülebilir, DIRECT ise
  // cihazın m/b/R katsayılarını gerektirir (PMBus Part II §7.4.3). Tek forma
  // sıkıştırmak "katsayı nereden geliyor" sorusunu gizlerdi.
  { id: 'pmbus-direct', category: 'timing', nameKey: 'calc.pmbusDirect.name', summaryKey: 'calc.pmbusDirect.summary' },
  // LoRa PHY: katalogdaki `wireless-iot/lora-lpwan/lora` kaydı çerçeve ÇÖZMEZ,
  // hesap makinesidir (`tabs` içinde `decode` yok) — motoru bu yüzden protokol
  // eklentisi olarak değil, buradaki zamanlama araçlarının yanında yaşar.
  { id: 'lora-airtime', category: 'timing', nameKey: 'calc.loraAirtime.name', summaryKey: 'calc.loraAirtime.summary' },
  { id: 'lora-link-budget', category: 'timing', nameKey: 'calc.loraLinkBudget.name', summaryKey: 'calc.loraLinkBudget.summary' },
  { id: 'lora-battery', category: 'timing', nameKey: 'calc.loraBattery.name', summaryKey: 'calc.loraBattery.summary' },
  // Logic seviyesi uyumluluğu (TTL/CMOS UART) — zamanlama değil elektriksel
  // hesap, ama rs485-timing emsaliyle aynı grupta: o kayıt da termination/
  // bias/unit-load taşıyor. Ayrı bir kategori açmak taksonomiyi spec §12/§13/
  // §11 üçlüsünden koparırdı.
  { id: 'logic-level-compat', category: 'timing', nameKey: 'calc.logicLevelCompat.name', summaryKey: 'calc.logicLevelCompat.summary' },
  // Current Loop / 4-20 mA kayıtlarının TEK motoru: o iki sayfanın decode'u
  // yok (LoRa paterni), hesap buraya bağlanıyor.
  { id: 'current-loop', category: 'timing', nameKey: 'calc.currentLoop.name', summaryKey: 'calc.currentLoop.summary' },
  // Araç içi PHY üçlüsü: üç katalog kaydının (can-phy/lin-phy/flexray-phy)
  // decode'u yok, motor burada. Üçü AYNI bileşeni `variant` ile paylaşır;
  // ayrı id'ler derin bağlantı ve sayfa-başına `calculatorIds` içindir.
  { id: 'can-phy-timing', category: 'timing', nameKey: 'calc.canPhy.name', summaryKey: 'calc.canPhy.summary' },
  { id: 'lin-phy-timing', category: 'timing', nameKey: 'calc.linPhy.name', summaryKey: 'calc.linPhy.summary' },
  { id: 'flexray-phy-timing', category: 'timing', nameKey: 'calc.flexrayPhy.name', summaryKey: 'calc.flexrayPhy.summary' },

  // --- CRC/checksum (spec §11 bulucu + §45 hesaplayıcı) ---
  // İleri yönlü hesaplayıcı ÖNCE: "bu baytların CRC'si nedir" sorusu, "bu değer
  // hangi algoritmadan çıktı" sorusundan daha sık sorulur ve bulucunun girdisi
  // çoğu zaman burada üretilir.
  { id: 'crc-calculator', category: 'checksum', nameKey: 'calc.crcCalculator.name', summaryKey: 'calc.crcCalculator.summary' },
  { id: 'checksum-finder', category: 'checksum', nameKey: 'calc.checksumFinder.name', summaryKey: 'calc.checksumFinder.summary' },
] as const;

export function findCalculator(id: string): CalculatorTool | undefined {
  return CALCULATOR_TOOLS.find((tool) => tool.id === id);
}

export function calculatorsByCategory(category: CalculatorCategory): readonly CalculatorTool[] {
  return CALCULATOR_TOOLS.filter((tool) => tool.category === category);
}
