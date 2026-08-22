import type { TranslationDictionary } from './tr';

/**
 * İngilizce sözlük. Tipi `tr`den türetildiği için iki sözlüğün sessizce
 * ayrışması MÜMKÜN DEĞİL: `tr`ye eklenip buraya eklenmeyen her anahtar
 * "missing property" derleme hatası, burada olup `tr`de olmayan her anahtar
 * "object literal may only specify known properties" hatası verir. Bu dosyada
 * çalışma zamanı kontrolü ya da fallback yok — olması da gerekmiyor.
 *
 * Anotasyon bilerek `TranslationDictionary`; `satisfies` kullanılırsa eksik
 * anahtar yine yakalanır ama değer tipi literal'e daralır ve `translations`
 * kaydında gereksiz genişleme sorunları çıkar.
 */
export const en: TranslationDictionary = {
  // --- Application shell ---
  'app.title': 'ALP Comm Toolkit',
  'app.tagline': 'A workbench for analysing and building communication protocols',
  'app.skipToContent': 'Skip to content',

  // --- Navigation and search ---
  'nav.home': 'Home',
  'nav.domains': 'Domains',
  'nav.search': 'Search',
  'nav.searchPlaceholder': 'Search protocols, families or domains…',
  'nav.searchHint': 'Press / to open search',
  'nav.noResults': 'No matching entries',
  'nav.resultCount': '{count} results',
  'nav.closeMenu': 'Close menu',
  'nav.openMenu': 'Open menu',
  'nav.calculators': 'Calculators',

  // --- Theme and language switches ---
  'theme.light': 'Light',
  'theme.dark': 'Dark',
  'theme.toggle': 'Toggle theme',
  'lang.label': 'Language',
  'lang.tr': 'Turkish',
  'lang.en': 'English',

  // --- Home page ---
  'home.heading': 'Communication protocol workbench',
  'home.intro':
    'Explore protocols grouped into eight domains: decode frames, build telegrams, and read timing and diagnostic data.',
  'home.domainCount': '{count} domains',
  'home.familyCount': '{count} families',
  'home.protocolCount': '{count} protocols',
  'home.openDomain': 'Open domain',
  'home.exploreDomains': 'Browse the domains',

  // --- Domain page ---
  'domain.familyCount': '{count} families',
  'domain.protocolCount': '{count} protocols',
  'domain.backToHome': 'Back to home',

  // --- Family page ---
  'family.protocolCount': '{count} protocols',
  'family.backToDomain': 'Back to domain',

  // --- Protocol page ---
  'protocol.layer': 'Layer',
  'protocol.status': 'Status',
  'protocol.tools': 'Tools',
  'protocol.relatedCalculators': 'Related calculators',
  'protocol.related': 'Related protocols',
  'protocol.definitions': 'Definition files',
  'protocol.aliasNotice':
    'This entry mirrors {name} from another domain; both are served by the same engine.',
  'protocol.canonical': 'Go to the canonical entry',
  'protocol.backToFamily': 'Back to family',
  'protocol.plannedNotice':
    'No decoder is wired up for this protocol yet; the page currently shows its scope and tooling.',
  'protocol.noToolsForTab': 'No tool is mapped to this tab.',

  // --- Workspace tabs (names mirror WorkspaceTab in the catalog) ---
  'tab.overview': 'Overview',
  'tab.live': 'Live',
  'tab.decode': 'Decode',
  'tab.build': 'Build',
  'tab.timing': 'Timing',
  'tab.data': 'Data',
  'tab.diagnostics': 'Diagnostics',
  'tab.definitions': 'Definitions',
  'tab.examples': 'Examples',
  'tab.groupLabel': 'Workspace tabs',

  // --- Maturity badges (ImplementationStatus) ---
  'status.planned': 'Planned',
  'status.partial': 'Partial',
  'status.ready': 'Ready',

  // --- Layer labels (ProtocolLayer) ---
  'layer.physical': 'Physical',
  'layer.data-link': 'Data link',
  'layer.network': 'Network',
  'layer.transport': 'Transport',
  'layer.application': 'Application',
  'layer.multi-layer': 'Multi-layer',

  // --- Definition file formats (DefinitionFormat) ---
  'definition.dbc': 'DBC — CAN database',
  'definition.eds': 'EDS — CANopen device description',
  'definition.gsd': 'GSD — PROFIBUS device description',
  'definition.gsdml': 'GSDML — PROFINET device description',
  'definition.iodd': 'IODD — IO-Link device description',
  'definition.a2l': 'A2L — ASAM measurement and calibration',
  'definition.ldf': 'LDF — LIN network description',
  'definition.scl': 'SCL — IEC 61850 station description',
  'definition.xif': 'XIF — LonWorks external interface file',
  'definition.dsdl': 'DSDL — Cyphal data structure language',
  'definition.vendor-map': 'Vendor register map',
  'definition.custom-schema': 'Custom schema',

  // --- Not found and errors ---
  'notFound.title': 'Page not found',
  'notFound.body':
    'This address does not match anything in the catalog. The link may be stale or a protocol id may have changed.',
  'notFound.back': 'Back to home',
  'error.title': 'Something went wrong',
  'error.body': 'This section failed to load. Try again, or move on to another protocol.',
  'error.retry': 'Try again',

  // --- Shared actions ---
  'common.copy': 'Copy',
  'common.copied': 'Copied',
  'common.copyFailed': 'Copy failed',
  'common.export': 'Export',
  'common.back': 'Back',
  'common.loading': 'Loading…',
  'common.empty': 'Nothing to show',
  'common.close': 'Close',
  'common.clear': 'Clear',
  'common.yes': 'Yes',
  'common.no': 'No',

  // --- Calculators — hub page (spec §11/§12/§13) ---
  'calculators.heading': 'Calculators',
  'calculators.intro': 'Byte/text conversions, timing calculations and a CRC/checksum finder — all local, no data ever leaves the browser.',
  'calculators.backToList': 'Back to tool list',
  'calculators.category.conversion': 'Data conversion',
  'calculators.category.timing': 'Timing',
  'calculators.category.checksum': 'CRC / checksum finder',

  // --- Calculators — shared field labels ---
  'calc.error.invalidInput': 'Could not parse the input — check the format.',
  'calc.field.hexInput': 'Hex input',
  'calc.field.textInput': 'Text input',
  'calc.field.binaryInput': 'Binary input',
  'calc.field.output': 'Result',
  'calc.field.hexOutput': 'Hex result',
  'calc.field.decimalOutput': 'Decimal result',
  'calc.field.byteIndex': 'Byte #',
  'calc.field.hex': 'Hex',
  'calc.field.decimal': 'Decimal',
  'calc.field.character': 'Character',
  'calc.field.leadByte': 'Lead byte',
  'calc.field.encode': 'Encode',
  'calc.field.decode': 'Decode',
  'calc.field.encodedInput': 'Encoded input',
  'calc.field.bytesToPercent': 'Bytes → percent encoding',
  'calc.field.value': 'Value',
  'calc.field.inputRadix': 'Input radix',
  'calc.field.radixBinary': '2 — Binary',
  'calc.field.radixOctal': '8 — Octal',
  'calc.field.radixDecimal': '10 — Decimal',
  'calc.field.radixHex': '16 — Hexadecimal',
  'calc.field.bitWidth': 'Bit width',
  'calc.field.rawUnsigned': 'Raw (unsigned) value',
  'calc.field.signedResult': 'Signed result',
  'calc.field.signedInput': 'Signed value',
  'calc.field.rawResult': 'Raw (unsigned) result',
  'calc.field.byteLength': 'Byte length',
  'calc.field.byteOrder': 'Byte order',
  'calc.field.bigEndianOption': 'Big-endian',
  'calc.field.littleEndianOption': 'Little-endian',
  'calc.field.floatValue': 'Float value',
  'calc.field.floatOutput': 'Float result',
  'calc.field.variableName': 'Variable name',
  'calc.field.codeOutput': 'Generated code',
  'calc.field.epochSeconds': 'Epoch (seconds)',
  'calc.field.isoOutput': 'ISO 8601 output',
  'calc.field.isoInput': 'ISO 8601 input',
  'calc.field.epochOutput': 'Epoch (seconds) result',
  'calc.field.bytes32Output': '32-bit byte output',
  'calc.field.maskBitWidth': 'Mask bit width',
  'calc.field.maskShift': 'Shift',
  'calc.field.maskOutput': 'Mask',
  'calc.field.maskedValue': 'Masked value',
  'calc.field.extractedField': 'Extracted field',
  'calc.field.baudRate': 'Baud rate',
  'calc.field.dataBits': 'Data bits',
  'calc.field.stopBits': 'Stop bits',
  'calc.field.parity': 'Parity',
  'calc.field.packetBytesOptional': 'Packet byte count (optional)',
  'calc.field.bitsPerCharacter': 'Bits per character',
  'calc.field.characterTime': 'Character time',
  'calc.field.maxByteRate': 'Max byte rate',
  'calc.field.packetTime': 'Packet time',
  'calc.field.maxPacketRate': 'Max packet rate',
  'calc.field.rs485Termination': 'Termination',
  'calc.field.rs485Bias': 'Bias',
  'calc.field.rs485Propagation': 'Propagation delay',
  'calc.field.rs485UnitLoad': 'Unit load',
  'calc.field.differentialVoltage': 'Differential voltage (V)',
  'calc.field.terminationOhms': 'Termination resistance (Ω)',
  'calc.field.effectiveResistance': 'Effective resistance',
  'calc.field.driverCurrent': 'Driver current',
  'calc.field.supplyVoltage': 'Supply voltage (V)',
  'calc.field.biasResistorOhms': 'Bias resistor (Ω)',
  'calc.field.differentialBiasVoltage': 'Differential bias voltage',
  'calc.field.biasCurrent': 'Bias current',
  'calc.field.cableLengthMeters': 'Cable length (m)',
  'calc.field.propagationVelocity': 'Propagation velocity (m/s)',
  'calc.field.propagationDelay': 'Propagation delay',
  'calc.field.roundTripDelay': 'Round-trip delay',
  'calc.field.rs485UnitLoadHint': 'Assumes N nodes with the same unit load — shows whether the total RS-485 bus limit (standard 32) is exceeded.',
  'calc.field.nodeCount': 'Node count',
  'calc.field.unitLoadPerNode': 'Unit load per node',
  'calc.field.totalUnitLoad': 'Total unit load',
  'calc.field.maximumAllowed': 'Maximum allowed',
  'calc.field.withinLimit': 'Within limit',
  'calc.field.clockFrequencyHz': 'Clock frequency (Hz)',
  'calc.field.totalClockBits': 'Total clock bits',
  'calc.field.transferTime': 'Transfer time',
  'calc.field.qspiThroughput': 'QSPI throughput',
  'calc.field.sclFrequencyHz': 'SCL frequency (Hz)',
  'calc.field.byteCount': 'Byte count',
  'calc.field.totalClockCount': 'Total clock pulses',
  'calc.field.i2cAddress7bit': 'I²C address (7-bit)',
  'calc.field.pullUpOhms': 'Pull-up resistor (Ω)',
  'calc.field.busCapacitancePf': 'Bus capacitance (pF)',
  'calc.field.writeByte': 'Write byte',
  'calc.field.readByte': 'Read byte',
  'calc.field.riseTime': 'Rise time',
  'calc.field.pmbusDecode': 'Decode',
  'calc.field.pmbusEncode': 'Encode',
  'calc.field.linear11Word': 'Linear11 word (hex/decimal)',
  'calc.field.decodedValue': 'Decoded value',
  'calc.field.exponentOptional': 'Exponent (optional — auto-selected)',
  'calc.field.encodedWord': 'Encoded word',
  'calc.field.mantissa': 'Mantissa',
  'calc.field.exponent': 'Exponent',
  'calc.field.checksumData': 'Data (hex bytes)',
  'calc.field.checksumExpected': 'Observed checksum (hex)',
  'calc.field.checksumMatches': 'Matches ({count})',
  'calc.field.checksumNoMatch': 'None of the 27 algorithms tried matched.',
  'calc.field.algorithm': 'Algorithm',
  'calc.field.checksumKind': 'Kind',
  'calc.field.checksumKindSimple': 'Simple',
  'calc.field.computedHex': 'Computed (hex)',
  'calc.field.byteOrderNormal': 'Normal',
  'calc.field.byteOrderSwapped': 'Byte-swapped',

  // --- LoRa PHY (Semtech SX1276 datasheet Rev.7 terminology) ---
  'calc.field.loraSpreadingFactor': 'Spreading factor (SF)',
  'calc.field.loraBandwidth': 'Bandwidth',
  'calc.field.loraCodingRate': 'Coding rate (CR)',
  'calc.field.loraPayloadBytes': 'PHY payload (bytes)',
  'calc.field.loraPreambleSymbols': 'Preamble symbols',
  'calc.field.loraCrcEnabled': 'Payload CRC enabled',
  'calc.field.loraCrcHint':
    'The current datasheet (Rev.7) keeps CRC as a parameter in the formula: with CRC off the packet is 5 symbols shorter. The 2013 AN1200.13 and the avbentem calculator assume CRC is always on — that is why results deliberately differ when CRC is off.',
  'calc.field.loraImplicitHeader': 'Implicit header',
  'calc.field.loraImplicitHeaderHint':
    'Header bytes are not carried over the air; the receiver knows length and CR in advance. SF6 only works in this mode.',
  'calc.field.loraLowDataRateOptimization': 'Low Data Rate Optimization',
  'calc.field.loraLdroAuto': 'Automatic (Ts > 16 ms)',
  'calc.field.loraLdroOn': 'On',
  'calc.field.loraLdroOff': 'Off',
  'calc.field.loraSymbolTime': 'Symbol time (Ts)',
  'calc.field.loraSymbolRate': 'Symbol rate (Rs)',
  'calc.field.loraLdroApplied': 'LDRO applied',
  'calc.field.loraTotalPreambleSymbols': 'Total preamble symbols (+4.25)',
  'calc.field.loraPreambleTime': 'Preamble time',
  'calc.field.loraPayloadSymbols': 'Payload symbol count',
  'calc.field.loraPayloadTime': 'Payload time',
  'calc.field.loraTimeOnAir': 'Time on Air (ToA)',
  'calc.field.loraBitRate': 'PHY bit rate',
  'calc.field.loraEffectiveBitRate': 'Effective bit rate (payload / ToA)',
  'calc.field.loraAirtimeSection': 'Airtime / duty cycle',
  'calc.field.loraDutyCycleHint':
    'The limit is defined over time, not packet count: the same duty cycle allows a few packets per hour at SF12 and hundreds at SF7. The EU868 g1 band is 1%.',
  'calc.field.loraDutyCyclePercent': 'Allowed duty cycle (%)',
  'calc.field.loraPacketsPerHour': 'Planned rate (packets/hour, optional)',
  'calc.field.loraMaxPacketsPerHour': 'Max packets/hour',
  'calc.field.loraMaxPacketsPerDay': 'Max packets/day',
  'calc.field.loraMinimumOffTime': 'Minimum off-time after transmission',
  'calc.field.loraMinimumInterval': 'Minimum interval between transmissions',
  'calc.field.loraOccupancy': 'Channel occupancy',
  'calc.field.loraWithinDutyCycle': 'Within limit',
  'calc.field.loraSensitivitySection': 'Receiver sensitivity',
  'calc.field.loraSensitivityEstimated': 'Estimate from SF/BW',
  'calc.field.loraSensitivityManual': 'Enter manually',
  'calc.field.loraNoiseFigure': 'Noise figure (dB)',
  'calc.field.loraThermalNoise': 'Thermal noise floor',
  'calc.field.loraDemodulatorSnr': 'Demodulator SNR limit',
  'calc.field.loraSensitivity': 'Sensitivity (dBm)',
  'calc.field.loraLinkBudgetSection': 'Link budget',
  'calc.field.loraTxPower': 'Transmit power (dBm)',
  'calc.field.loraTxAntennaGain': 'Transmit antenna gain (dBi)',
  'calc.field.loraRxAntennaGain': 'Receive antenna gain (dBi)',
  'calc.field.loraCableLoss': 'Cable/connector loss (dB)',
  'calc.field.loraFrequencyMhz': 'Frequency (MHz)',
  'calc.field.loraMeasuredRssi': 'Measured RSSI (dBm, optional)',
  'calc.field.loraEffectiveRadiatedPower': 'Effective radiated power',
  'calc.field.loraMaximumPathLoss': 'Maximum path loss budget',
  'calc.field.loraFreeSpaceRange': 'Free-space range estimate',
  'calc.field.loraMeasuredMargin': 'Measured margin',
  'calc.field.loraFreeSpaceRangeHint':
    'The range uses the FREE-SPACE model: no obstacles, diffraction or terrain. Real deployments see a path loss exponent of 2.7-4 rather than 2 — this figure is an upper bound, not a field range.',
  'calc.field.loraDutyProfileSection': 'Radio and processing profile',
  'calc.field.loraTimeOnAirHint':
    'Time on Air is the only timing term the energy model depends on, so the PHY parameters are not asked again here. The tool that produces ToA:',
  'calc.field.loraTimeOnAirMs': 'Time on Air (ms)',
  'calc.field.loraTransmitCurrent': 'Transmit current (mA)',
  'calc.field.loraReceiveCurrent': 'Receive current (mA)',
  'calc.field.loraReceiveWindowMs': 'Total receive window (ms)',
  'calc.field.loraActiveCurrent': 'Active current — MCU/sensor (mA)',
  'calc.field.loraActiveMs': 'Active duration (ms)',
  'calc.field.loraSleepCurrent': 'Sleep current (µA)',
  'calc.field.loraMessagesPerDay': 'Messages per day',
  'calc.field.loraBatterySection': 'Battery',
  'calc.field.loraBatteryCapacity': 'Battery capacity (mAh)',
  'calc.field.loraDerating': 'Unusable capacity share (%)',
  'calc.field.loraSelfDischarge': 'Self-discharge (%/year)',
  'calc.field.loraTransmitCharge': 'Transmit charge (per message)',
  'calc.field.loraReceiveCharge': 'Receive charge (per message)',
  'calc.field.loraActiveCharge': 'Active processing charge (per message)',
  'calc.field.loraChargePerMessage': 'Total charge per message',
  'calc.field.loraDailyActiveCharge': 'Daily transmission charge',
  'calc.field.loraDailySleepCharge': 'Daily sleep charge',
  'calc.field.loraDailySelfDischarge': 'Daily self-discharge',
  'calc.field.loraDailyCharge': 'Total daily charge',
  'calc.field.loraAverageCurrent': 'Average current',
  'calc.field.loraIdleShare': 'Idle share (sleep + self-discharge)',
  'calc.field.loraUsableCapacity': 'Usable capacity',
  'calc.field.loraBatteryLifeDays': 'Estimated battery life',
  'calc.field.loraBatteryLifeYears': 'Estimated battery life (years)',
  'calc.field.loraUnitDays': 'days',
  'calc.field.loraUnitYears': 'years',
  'calc.field.loraBatteryModelHint':
    'The model is three constant-current windows + continuous sleep + self-discharge. Not included: temperature effects, voltage droop under the transmit pulse (often the real limit on high internal resistance chemistries such as Li-SOCl2), radio ramp-up, and a shelf-life ceiling. If the idle share is high, transmitting less often will not extend life — look at sleep current and battery chemistry instead.',

  // --- Calculators — tool name/summary (spec §12 FULL LIST + §13 + §11) ---
  'calc.hexToAscii.name': 'HEX to ASCII',
  'calc.hexToAscii.summary': 'Converts a hexadecimal byte sequence to ASCII text.',
  'calc.asciiToHex.name': 'ASCII to HEX',
  'calc.asciiToHex.summary': 'Converts ASCII text to a hexadecimal byte sequence.',
  'calc.hexToBinary.name': 'HEX to binary',
  'calc.hexToBinary.summary': 'Converts a hexadecimal byte sequence to binary representation.',
  'calc.binaryToHex.name': 'Binary to HEX',
  'calc.binaryToHex.summary': 'Converts a binary representation to a hexadecimal byte sequence.',
  'calc.decimalConverter.name': 'Number base converter',
  'calc.decimalConverter.summary': 'Shows a value in binary, octal, decimal and hexadecimal at once.',
  'calc.utf8ByteViewer.name': 'UTF-8 byte viewer',
  'calc.utf8ByteViewer.summary': "Shows every byte of a text's UTF-8 encoding and the character boundaries.",
  'calc.base64.name': 'Base64',
  'calc.base64.summary': 'Encodes bytes as Base64, decodes Base64 text back to bytes.',
  'calc.base32.name': 'Base32',
  'calc.base32.summary': 'Encodes bytes as Base32, decodes Base32 text back to bytes.',
  'calc.urlEncoding.name': 'URL (percent) encoding',
  'calc.urlEncoding.summary': 'Converts text to percent-encoded URL form and back.',
  'calc.signedUnsigned.name': 'Signed / unsigned converter',
  'calc.signedUnsigned.summary': 'Converts a raw (unsigned) value to signed at a given bit width, and back.',
  'calc.littleEndian.name': 'Little-endian converter',
  'calc.littleEndian.summary': 'Reads a byte sequence as little-endian to a number, and encodes a number to little-endian bytes.',
  'calc.bigEndian.name': 'Big-endian converter',
  'calc.bigEndian.summary': 'Reads a byte sequence as big-endian to a number, and encodes a number to big-endian bytes.',
  'calc.mixedEndian.name': 'Mixed-endian converter',
  'calc.mixedEndian.summary': 'Reads a byte sequence with word-swapped byte order to a number, and back.',
  'calc.ieee754Float16.name': 'IEEE-754 Float16',
  'calc.ieee754Float16.summary': 'Encodes a 16-bit half-precision float to bytes, decodes bytes to a value.',
  'calc.ieee754Float32.name': 'IEEE-754 Float32',
  'calc.ieee754Float32.summary': 'Encodes a 32-bit single-precision float to bytes, decodes bytes to a value.',
  'calc.ieee754Float64.name': 'IEEE-754 Float64',
  'calc.ieee754Float64.summary': 'Encodes a 64-bit double-precision float to bytes, decodes bytes to a value.',
  'calc.bcdConverter.name': 'BCD converter',
  'calc.bcdConverter.summary': 'Encodes a decimal number to binary-coded-decimal bytes and back.',
  'calc.unixTimestamp.name': 'Unix timestamp',
  'calc.unixTimestamp.summary': 'Converts epoch seconds to an ISO 8601 date and back, and encodes to 32-bit bytes.',
  'calc.bitMask.name': 'Bit mask',
  'calc.bitMask.summary': 'Builds a mask from width and shift, applies it to a raw value and extracts the field.',
  'calc.byteSwap.name': 'Byte swap',
  'calc.byteSwap.summary': 'Reverses the order of a byte sequence.',
  'calc.bitReverse.name': 'Bit reverse',
  'calc.bitReverse.summary': 'Reverses the bit order (MSB↔LSB) of every byte.',
  'calc.nibbleSwap.name': 'Nibble swap',
  'calc.nibbleSwap.summary': 'Swaps the high and low nibble of every byte.',
  'calc.cArrayGenerator.name': 'C array generator',
  'calc.cArrayGenerator.summary': 'Generates a C array definition from a byte sequence.',
  'calc.cppArrayGenerator.name': 'C++ array generator',
  'calc.cppArrayGenerator.summary': 'Generates a C++ array definition from a byte sequence.',
  'calc.pythonBytesGenerator.name': 'Python bytes generator',
  'calc.pythonBytesGenerator.summary': 'Generates a Python `bytes` literal from a byte sequence.',
  'calc.rustArrayGenerator.name': 'Rust array generator',
  'calc.rustArrayGenerator.summary': 'Generates a Rust array definition from a byte sequence.',
  'calc.javaByteArrayGenerator.name': 'Java byte array generator',
  'calc.javaByteArrayGenerator.summary': 'Generates a Java `byte[]` definition from a byte sequence.',
  'calc.javascriptUint8ArrayGenerator.name': 'JavaScript Uint8Array generator',
  'calc.javascriptUint8ArrayGenerator.summary': 'Generates a JavaScript `Uint8Array` definition from a byte sequence.',
  'calc.uartTiming.name': 'UART timing',
  'calc.uartTiming.summary': 'Computes character/packet time and max rates from baud rate and frame format.',
  'calc.rs485Timing.name': 'RS-485 calculations',
  'calc.rs485Timing.summary': 'Computes termination, bias, cable propagation delay and bus unit load.',
  'calc.spiTiming.name': 'SPI timing',
  'calc.spiTiming.summary': 'Computes transfer time and QSPI throughput from clock frequency and bit count.',
  'calc.i2cTiming.name': 'I²C timing',
  'calc.i2cTiming.summary': 'Computes transfer time, 7-bit address bytes and pull-up rise time.',
  'calc.pmbusLinear.name': 'PMBus Linear11 / Linear16',
  'calc.pmbusLinear.summary': 'Decodes and encodes PMBus Linear11 and Linear16 telemetry codes.',
  'calc.loraAirtime.name': 'LoRa Time on Air / airtime',
  'calc.loraAirtime.summary':
    'Computes symbol time, Time on Air, bit rate and duty cycle budget from the PHY parameter set (Semtech SX1276 datasheet Rev.7).',
  'calc.loraBattery.name': 'LoRa battery / energy estimate',
  'calc.loraBattery.summary':
    'Derives per-message charge, daily consumption and estimated battery life from Time on Air and the node current profile.',
  'calc.loraLinkBudget.name': 'LoRa link budget',
  'calc.loraLinkBudget.summary':
    'Estimates receiver sensitivity from SF/BW, then reports maximum path loss, free-space range and measured margin.',
  'calc.checksumFinder.name': 'CRC / checksum finder',
  'calc.checksumFinder.summary': 'Tries 27 algorithms (18 CRC + 9 simple) against a data/observed-checksum pair, including byte-order variants.',
  'calc.crcCalculator.name': 'CRC calculator',
  'calc.crcCalculator.summary': 'Computes the CRC or checksum of the bytes you give it: 18 standard CRCs, 9 simple sums, and a fully parameterised custom CRC.',
  'calc.crc.customInit': 'Initial value (init)',
  'calc.crc.customOption': 'Custom parameters',
  'calc.crc.customPoly': 'Polynomial',
  'calc.crc.customRefin': 'Reflect input bits (refin)',
  'calc.crc.customRefout': 'Reflect output bits (refout)',
  'calc.crc.customXorout': 'Final XOR (xorout)',
  'calc.crc.group.crc': 'CRC',
  'calc.crc.group.custom': 'Custom',
  'calc.crc.group.simple': 'Simple sums',
  'calc.crc.loadSample': 'Load the sample input:',
  'calc.crc.paramsSummary': 'Algorithm parameters',
  'calc.crc.step.init': 'Initial value:',
  'calc.crc.step.input': 'Input:',
  'calc.crc.step.poly': 'Polynomial:',
  'calc.crc.step.refin': 'Input reflection:',
  'calc.crc.step.refout': 'Output reflection:',
  'calc.crc.step.result': 'Result:',
  'calc.crc.step.xorout': 'Final XOR:',
  'calc.crc.doc.example.title': 'Sample data',
  'calc.crc.doc.example.body': 'The verified reference from spec §43: the ASCII string "123456789". It must produce CRC-8 0xF4, CRC-16/CCITT-FALSE 0x29B1, CRC-16/MODBUS 0x4B37 and CRC-32 0xCBF43926.',
  'calc.crc.doc.formula.title': 'Formula',
  'calc.crc.doc.formula.body': 'A CRC divides the input by the chosen polynomial and keeps the remainder. Five parameters decide the answer: polynomial, initial value, input reflection, output reflection and the final XOR. The same polynomial with different reflection flags gives a completely different value.',
  'calc.crc.doc.steps.title': 'Step by step',
  'calc.crc.doc.steps.body': 'The parameters the selected algorithm uses, and the size of the input:',
  'calc.crc.doc.limits.title': 'Limitations',
  'calc.crc.doc.limits.bigint': 'A CRC-64 result is 64 bits wide and travels as a bigint on the JavaScript side, so the decimal form keeps full integer precision.',
  'calc.crc.doc.limits.coverage': 'This tool hashes ALL the bytes you give it. Real protocols usually cover only part of the frame (start and end bytes excluded), so you have to select and paste that part yourself.',
  'calc.crc.doc.limits.simpleParams': 'The simple sums (XOR8, SUM8, LRC, Fletcher, Adler-32, NMEA) have no polynomial or reflection parameters; the custom parameter fields apply to CRCs only.',
  'calc.crc.doc.mistakes.title': 'Common mistakes',
  'calc.crc.doc.mistakes.reflect': 'Wrong reflection flags raise no error — the value just comes out silently different. If you cannot match an expected value, try the refin/refout pair first.',
  'calc.crc.doc.mistakes.scope': 'With the wrong coverage the result is computed correctly but is not the value the protocol expects — this is the most common source of "CRC mismatch".',
  'calc.crc.doc.mistakes.byteOrder': 'The byte order a CRC is written in varies by protocol; the number computed here may appear reversed on the wire.',

  'nav.liveMonitor': 'Live monitor',

  'monitor.title': 'Live serial monitor',
  'monitor.intro':
    'Frames, validates and measures incoming serial bytes in real time. Parsing runs inside a Web Worker; the table is virtualized.',
  'monitor.privacy': 'Data flows from the device to the browser only; no byte is sent to a server.',

  'monitor.section.connection': 'Connection',
  'monitor.section.stream': 'Live stream',
  'monitor.section.statistics': 'Statistics',
  'monitor.section.signals': 'Signals',

  'monitor.source.label': 'Source',
  'monitor.source.serial': 'Web Serial',
  'monitor.source.simulated': 'Simulated',
  'monitor.source.serialHint': 'Port selection asks for browser permission; hardware required.',
  'monitor.source.simulatedHint': 'Hardware-free demo stream — produces split frames, corruption and garbage bytes.',
  'monitor.serialUnsupported': 'This browser does not support the Web Serial API. You can use the simulated source.',

  'monitor.action.connect': 'Connect',
  'monitor.action.disconnect': 'Disconnect',
  'monitor.action.clear': 'Clear records',
  'monitor.action.pause': 'Pause display',
  'monitor.action.resume': 'Resume',
  'monitor.action.followTail': 'Follow tail',
  'monitor.action.pausedNotice': 'Display paused — data is still being captured.',

  'monitor.field.baudRate': 'Baud rate',
  'monitor.field.dataBits': 'Data bits',
  'monitor.field.stopBits': 'Stop bits',
  'monitor.field.parity': 'Parity',
  'monitor.field.flowControl': 'Flow control',
  'monitor.field.bufferSize': 'Buffer size',
  'monitor.field.frameTimeout': 'Frame timeout (ms)',
  'monitor.field.framesPerSecond': 'Frames per second',
  'monitor.field.displayMode': 'Display mode',
  'monitor.field.timestampResolution': 'Timestamp resolution',
  'monitor.field.checksum': 'Validation algorithm',
  'monitor.field.framing': 'Framing',

  'monitor.parity.none': 'None',
  'monitor.parity.even': 'Even',
  'monitor.parity.odd': 'Odd',
  'monitor.flowControl.none': 'None',
  'monitor.flowControl.hardware': 'Hardware (RTS/CTS)',

  'monitor.display.hex': 'HEX',
  'monitor.display.ascii': 'ASCII',
  'monitor.display.utf8': 'UTF-8',
  'monitor.display.decimal': 'Decimal',
  'monitor.display.binary': 'Binary',
  'monitor.display.mixed': 'HEX + ASCII',

  'monitor.timestamp.ms': 'Milliseconds',
  'monitor.timestamp.us': 'Microseconds',

  'monitor.framing.simulated': 'Simulated telemetry (length field)',
  'monitor.framing.lineEnding': 'Line ending (CR LF)',
  'monitor.framing.modbusRtu': 'Modbus RTU (silent interval)',
  'monitor.framing.slip': 'SLIP',
  'monitor.framing.cobs': 'COBS',

  'monitor.status.label': 'Status',
  'monitor.status.idle': 'Not connected',
  'monitor.status.connecting': 'Connecting',
  'monitor.status.connected': 'Connected',
  'monitor.status.closing': 'Closing',
  'monitor.status.error': 'Error',

  'monitor.parser.label': 'Parser state',
  'monitor.parser.SEARCHING_FOR_FRAME': 'Searching for frame',
  'monitor.parser.READING_HEADER': 'Reading header',
  'monitor.parser.READING_LENGTH': 'Reading length',
  'monitor.parser.READING_PAYLOAD': 'Reading payload',
  'monitor.parser.READING_TRAILER': 'Reading trailer',
  'monitor.parser.VALIDATING_FRAME': 'Validating frame',
  'monitor.parser.FRAME_COMPLETE': 'Frame complete',
  'monitor.parser.FRAME_ERROR': 'Frame error',
  'monitor.parser.RECOVERING': 'Recovering',

  'monitor.table.label': 'Live frame table',
  'monitor.table.empty': 'No records yet. Connect to a source.',
  'monitor.table.timestamp': 'Time',
  'monitor.table.direction': 'Dir',
  'monitor.table.length': 'Length',
  'monitor.table.validation': 'Validation',
  'monitor.table.bytes': 'Bytes',
  'monitor.table.rowCount': '{count} records',
  'monitor.table.dropped': '{count} old records dropped due to capacity',

  'monitor.validity.valid': 'Valid',
  'monitor.validity.crcError': 'CRC error',
  'monitor.validity.checksumError': 'Checksum error',
  'monitor.validity.unchecked': 'Unchecked',

  'monitor.stats.totalFrames': 'Total frames',
  'monitor.stats.validFrames': 'Valid frames',
  'monitor.stats.invalidFrames': 'Invalid frames',
  'monitor.stats.rxBytes': 'RX bytes',
  'monitor.stats.txBytes': 'TX bytes',
  'monitor.stats.crcErrors': 'CRC errors',
  'monitor.stats.checksumErrors': 'Checksum errors',
  'monitor.stats.framingErrors': 'Framing errors',
  'monitor.stats.timeoutErrors': 'Timeout errors',
  'monitor.stats.packetRate': 'Packet rate',
  'monitor.stats.byteRate': 'Byte rate',
  'monitor.stats.minFrameLength': 'Min frame length',
  'monitor.stats.maxFrameLength': 'Max frame length',
  'monitor.stats.avgFrameLength': 'Average frame length',
  'monitor.stats.crcErrorRate': 'CRC error rate',
  'monitor.stats.packetLoss': 'Packet loss',
  'monitor.stats.sequenceErrors': 'Sequence errors',
  'monitor.stats.meanPeriod': 'Mean period',
  'monitor.stats.jitter': 'Jitter (last)',
  'monitor.stats.periodStdDev': 'Period σ',
  'monitor.stats.busLoad': 'Bus load',
  'monitor.stats.responseTime': 'Response time (min / max)',
  'monitor.stats.unknown': 'Not measured',
  'monitor.stats.formulaNote':
    'CRC error rate = errored / checked × 100 · Packet loss = missing / expected × 100 · σ = √[Σ(Pᵢ − mean)² / N]',

  'monitor.chart.empty': 'Waiting for signal data.',
  'monitor.chart.pointNote': 'Chart is downsampled to at most {count} points (LTTB).',
  'monitor.signal.min': 'Min',
  'monitor.signal.max': 'Max',
  'monitor.signal.average': 'Average',
  'monitor.signal.rms': 'RMS',
  'monitor.signal.stdDev': 'σ',
  'monitor.signal.last': 'Last',

  'monitor.export.csv': 'Download CSV',
  'monitor.export.json': 'Download JSON',
  'monitor.export.txt': 'Download TXT',

  'monitor.error.unsupported': 'The Web Serial API is unavailable in this browser.',
  'monitor.error.permissionDenied': 'Serial port permission denied.',
  'monitor.error.openFailed': 'Could not open the port.',
  'monitor.error.readFailed': 'Reading from the port failed — the device may have been removed.',
  'monitor.error.writeFailed': 'Writing to the port failed.',
  'monitor.error.notConnected': 'Not connected.',

  // --- Protocol Studio ---
  'nav.protocolStudio': 'Protocol studio',

  // Draft validation (schemaDraft.ts DRAFT_MESSAGE_KEYS)
  'studio.draft.byteRange': 'Byte value falls outside the 0–255 range: {value}',
  'studio.draft.conditionIncomplete': 'The condition is half filled — give both the field and the value to compare it against.',
  'studio.draft.coverageIncomplete': 'The checksum coverage is half filled — give both the start and the end offset.',
  'studio.draft.enumKeyDuplicate': 'This enum key is defined more than once: {key}',
  'studio.draft.enumKeyInvalid': 'Enum keys have to be integers: {key}',
  'studio.draft.enumLabelRequired': 'This key still needs a label: {key}',
  'studio.draft.fieldIdRequired': 'The field id is required.',
  'studio.draft.fieldNameRequired': 'The field name is required.',
  'studio.draft.fieldsRequired': 'A schema needs at least one field.',
  'studio.draft.integerInvalid': 'Not a readable integer: {value}',
  'studio.draft.maximumFrameLengthRequired': 'The maximum frame length is required.',
  'studio.draft.nameRequired': 'The protocol name is required.',
  'studio.draft.numberInvalid': 'Not a readable number: {value}',
  'studio.draft.repeatFieldRequired': 'Pick the field that carries the repeat count.',
  'studio.draft.schemaRejected': 'Schema validation rejected {path}: {detail}',
  'studio.draft.versionRequired': 'The version is required.',

  // --- Protocol Studio — error texts (spec §42, verbatim) ---
  'studio.error.invalidHex': 'Invalid hexadecimal input',
  'studio.error.invalidSchemaJson': 'This file is not a valid schema JSON document.',

  // --- Protocol Studio — field property labels ---
  'studio.field.algorithm': 'Algorithm',
  'studio.field.bitLength': 'Bit length',
  'studio.field.bitMask': 'Bit mask',
  'studio.field.bitOffset': 'Bit offset',
  'studio.field.bitOrder': 'Bit order',
  'studio.field.calibrationOffset': 'Calibration offset',
  'studio.field.color': 'Colour',
  'studio.field.colorNone': 'No colour',
  'studio.field.colorOption': 'Colour {index}',
  'studio.field.conditionEquals': 'Condition value',
  'studio.field.conditionField': 'Condition field',
  'studio.field.coverageEnd': 'Coverage end',
  'studio.field.coverageStart': 'Coverage start',
  'studio.field.defaultValue': 'Default value',
  'studio.field.defaultValueKind': 'Default value type',
  'studio.field.description': 'Description',
  'studio.field.documentation': 'Documentation note',
  'studio.field.endianness': 'Endianness',
  'studio.field.enumAdd': 'Add enum entry',
  'studio.field.enumEmpty': 'This field has no enum values yet.',
  'studio.field.enumKey': 'Key',
  'studio.field.enumLabel': 'Label',
  'studio.field.enumRemove': 'Remove enum entry',
  'studio.field.id': 'Id',
  'studio.field.length': 'Length',
  'studio.field.lengthFrom': 'Length carried by field',
  'studio.field.maximum': 'Maximum',
  'studio.field.minimum': 'Minimum',
  'studio.field.name': 'Name',
  'studio.field.offset': 'Offset',
  'studio.field.repeatCount': 'Repeat count',
  'studio.field.repeatFromField': 'Repeat count carried by field',
  'studio.field.repeatMode': 'Repeat mode',
  'studio.field.scale': 'Scale',
  'studio.field.signed': 'Sign',
  'studio.field.type': 'Type',
  'studio.field.unit': 'Unit',

  // --- Protocol Studio — field list ---
  'studio.fieldList.addChildField': 'Add a field inside {name}',
  'studio.fieldList.addField': 'Add field',
  'studio.fieldList.childListLabel': 'Child fields of {name}',
  'studio.fieldList.conditionBadge': 'if {field} = {value}',
  'studio.fieldList.duplicateField': 'Duplicate {name}',
  'studio.fieldList.empty': 'No fields in this schema yet. Add one to get started.',
  'studio.fieldList.emptyChildren': 'This field has no child fields yet.',
  'studio.fieldList.frameStructure': 'Frame structure',
  'studio.fieldList.issueCount': '{count} issues',
  'studio.fieldList.lengthFromValue': 'length: {field}',
  'studio.fieldList.lengthValue': 'length: {length}',
  'studio.fieldList.listLabel': 'Schema fields',
  'studio.fieldList.moveDown': 'Move down',
  'studio.fieldList.moveUp': 'Move up',
  'studio.fieldList.offsetValue': '@{offset}',
  'studio.fieldList.removeField': 'Remove {name}',
  'studio.fieldList.repeatFixed': 'repeat: {count}',
  'studio.fieldList.repeatFromField': 'repeat: {field}',
  'studio.fieldList.title': 'Fields',

  // --- Protocol Studio — frame view ---
  'studio.frame.byteCount': 'Byte count',
  'studio.frame.bytesPerRow': 'Bytes per row',
  'studio.frame.empty': 'Nothing to show yet. Type a sample frame as hex above.',
  'studio.frame.endBytes': 'End bytes',
  'studio.frame.fieldCount': 'Field count',
  'studio.frame.framing': 'Framing',
  'studio.frame.hexInput.label': 'Sample frame (hex)',
  'studio.frame.hexInput.placeholder': 'Space-separated hex bytes',
  'studio.frame.hideOffsets': 'Hide offsets',
  'studio.frame.name': 'Name',
  'studio.frame.startBytes': 'Start bytes',
  'studio.frame.title': 'Frame',
  'studio.frame.version': 'Version',
  'studio.frame.view.bits': 'Bits',
  'studio.frame.view.hexAscii': 'HEX + ASCII',
  'studio.frame.view.hexOnly': 'HEX only',
  'studio.frame.view.label': 'View',

  // --- Protocol Studio — framing modes ---
  'studio.framing.fixedLength': 'Fixed length',
  'studio.framing.lengthField': 'Length field',
  'studio.framing.none': 'None',
  'studio.framing.startEnd': 'Start and end delimiter',
  'studio.framing.startOnly': 'Start delimiter only',

  // --- Protocol Studio — select options ---
  'studio.option.algorithmNone': 'None',
  'studio.option.auto': 'Automatic',
  'studio.option.bitOrderLsb': 'LSB first',
  'studio.option.bitOrderMsb': 'MSB first',
  'studio.option.defaultKindNumber': 'Number',
  'studio.option.defaultKindText': 'Text',
  'studio.option.endianBig': 'Big-endian',
  'studio.option.endianLittle': 'Little-endian',
  'studio.option.repeatFixed': 'Fixed count',
  'studio.option.repeatFromField': 'From another field',
  'studio.option.repeatNone': 'No repeat',
  'studio.option.signedNo': 'Unsigned',
  'studio.option.signedYes': 'Signed',

  // --- Protocol Studio — generated output ---
  'studio.output.artifact.download': 'Download file',
  'studio.output.artifact.missing': 'Nothing has been generated for this tab yet — build a valid schema first.',
  'studio.output.artifact.notExecuted': 'The generated code is plain text; the browser never runs it.',
  'studio.output.parsed.column.field': 'Field',
  'studio.output.parsed.column.offset': 'Offset',
  'studio.output.parsed.column.physical': 'Physical value',
  'studio.output.parsed.column.raw': 'Raw value',
  'studio.output.parsed.column.unit': 'Unit',
  'studio.output.parsed.column.validity': 'Validity',
  'studio.output.parsed.computation': 'Computation steps',
  'studio.output.parsed.empty': 'No frame to parse. Type a sample frame as hex.',
  'studio.output.parsed.errors': 'Errors',
  'studio.output.parsed.status.invalid': 'Invalid',
  'studio.output.parsed.status.valid': 'Valid',
  'studio.output.parsed.summary.consumedBytes': 'Bytes consumed',
  'studio.output.parsed.summary.fieldCount': 'Field count',
  'studio.output.parsed.summary.schema': 'Schema',
  'studio.output.parsed.summary.status': 'Status',
  'studio.output.parsed.tableLabel': 'Parsed fields',
  'studio.output.parsed.warnings': 'Warnings',

  // Spec §42 sample error texts, carried over word for word.
  'studio.output.parseError.code.checksumMismatch': 'Checksum mismatch',
  'studio.output.parseError.code.circularLengthReference':
    'Protocol definition contains circular length references',
  'studio.output.parseError.code.crcMismatch': 'CRC mismatch',
  'studio.output.parseError.code.frameTooLong': 'Frame exceeds the maximum length',
  'studio.output.parseError.code.invalidHexInput': 'Invalid hexadecimal input',
  'studio.output.parseError.code.lengthMismatch': 'Frame length does not match the length field',
  'studio.output.parseError.code.parserTimeout': 'The parser timed out',
  'studio.output.parseError.code.startDelimiterNotFound': 'Start delimiter not found',
  'studio.output.parseError.code.truncatedFrame': 'Truncated frame, the bytes ran out',
  'studio.output.parseError.code.unsupportedFunctionCode': 'Unsupported function code',
  'studio.output.parseError.code.valueOutOfRange': 'Value exceeds uint16 range',
  'studio.output.parseError.code.unsupportedEncoding': 'Unsupported encoding form',
  'studio.output.parseError.offset': 'Error offset',
  'studio.output.parseError.recoverable': 'Recoverable — parsing can pick up at the next frame.',
  'studio.output.parseError.title': 'The frame could not be parsed',
  'studio.output.parseError.unrecoverable': 'Unrecoverable — nothing past this point can be trusted.',

  'studio.output.tab.cParser': 'C parser',
  'studio.output.tab.cStruct': 'C struct',
  'studio.output.tab.jsonSchema': 'JSON schema',
  'studio.output.tab.markdownDoc': 'Markdown doc',
  'studio.output.tab.parsed': 'Parsed',
  'studio.output.tab.pythonParser': 'Python parser',
  'studio.output.tab.typeScriptParser': 'TypeScript parser',
  'studio.output.tab.validation': 'Validation',
  'studio.output.tablistLabel': 'Output tabs',
  'studio.output.validation.empty': 'No validation issues.',
  'studio.output.validation.listLabel': 'Validation issues',
  'studio.output.validation.severity.error': 'Error',
  'studio.output.validation.severity.warning': 'Warning',
  'studio.output.validation.source.draft': 'Draft',
  'studio.output.validation.source.schema': 'Schema',

  // --- Protocol Studio — properties panel ---
  'studio.properties.childFieldsHint':
    'Child fields are added from the list on the left; they encode in the order shown there.',
  'studio.properties.derivedNote':
    'The encoder computes this field, so anything typed in by hand is ignored.',
  'studio.properties.empty': 'Pick a field on the left to see its properties.',
  'studio.properties.group.appearance': 'Appearance and default',
  'studio.properties.group.checksum': 'Checksum',
  'studio.properties.group.enum': 'Enum values',
  'studio.properties.group.identity': 'Identity',
  'studio.properties.group.layout': 'Layout',
  'studio.properties.group.repeat': 'Condition and repeat',
  'studio.properties.group.scaling': 'Scaling and limits',
  'studio.properties.intrinsicLengthHint': 'The type fixes this length, so the box is read-only.',
  'studio.properties.otherIssues': 'Issues that belong to no single field',

  // --- Protocol Studio — screen, actions and guide ---
  'studio.title': 'Custom Protocol Studio',
  'studio.intro':
    'Define your own binary protocol field by field, parse a sample frame instantly and export it in six different formats.',
  'studio.privacy':
    'The protocol definition and the sample frame stay in this browser; no byte is sent to a server.',
  'studio.section.schemaMeta': 'Schema details',
  'studio.section.properties': 'Field properties',
  'studio.section.output': 'Output',
  'studio.section.guide': 'Guide',
  'studio.section.project': 'Project',
  'studio.meta.maximumFrameLength': 'Maximum frame length',
  'studio.meta.byteListHint':
    'Separate bytes with spaces or commas; decimal (170) and hexadecimal (0xAA) are both accepted.',
  'studio.action.importSchema': 'Import schema file (JSON)',
  'studio.action.resetToSample': 'Back to the sample schema',
  'studio.action.analyze': 'Parse',
  'studio.action.sampleHint':
    'The sample schema is the ALP Sensor Protocol of spec §9.6; the sample frame carries the verified bytes of §43.',
  'studio.analyze.done': 'Parsing finished: the frame matched the schema.',
  'studio.analyze.failed': 'Parsing failed; details are in the output panel below.',
  'studio.analyze.empty': 'No frame to parse; enter the sample frame as hex first.',
  'studio.analyze.blocked': 'The schema is not valid yet; fix the issues on the validation tab.',
  'studio.error.fileReadFailed': 'The file could not be read.',
  'studio.help.purpose.title': 'What this tool is for',
  'studio.help.purpose.body':
    'It describes an undocumented or self-designed binary protocol, validates it against a sample frame and generates the code you will use on the embedded side.',
  'studio.help.protocols.title': 'Which protocols',
  'studio.help.protocols.body':
    'Any schema-driven binary frame: start/end delimited, fixed length, length-prefixed or unframed streams. Text-based protocols are out of scope for this tool.',
  'studio.help.sections.title': 'Where the spec §42 sections live on screen',
  'studio.help.sections.inputs':
    'Inputs: the schema details strip, the field list on the left and the sample frame box in the middle.',
  'studio.help.sections.sample':
    'Sample data: the reset button restores the §9.6 schema and the §43 frame.',
  'studio.help.sections.action':
    'Compute button: the parse button announces the result and scrolls to the output section.',
  'studio.help.sections.result':
    'Result: the parsing tab of the output section — raw value, physical value, unit and validity.',
  'studio.help.sections.formula':
    'Formula: the collapsible computation steps under each field row.',
  'studio.help.sections.steps':
    'Step by step: the same collapsible section lists the chain from raw bytes to physical value in order.',
  'studio.help.sections.copy': 'Copying: the copy button above every generated output.',
  'studio.help.sections.export': 'Exporting: the file download button on every output tab.',
  'studio.help.interpretation.title': 'How to read the result',
  'studio.help.interpretation.body':
    'The raw value is the assembled bytes; the physical value is what remains after scale and calibration. A field flagged invalid means the value falls outside the bounds declared in the schema.',
  'studio.help.limitations.title': 'Limitations',
  'studio.help.limitations.generatedCodeNotExecuted':
    'Generated code is plain text; it is never executed or compiled in the browser.',
  'studio.help.limitations.byteViewerLimit':
    'The byte viewer truncates rows on very large frames; the number of hidden bytes is reported below.',
  'studio.help.limitations.encoderIgnoresOffset':
    'The encoder writes fields in order; the offset in the schema is used while parsing, not while encoding.',
  'studio.help.limitations.bigintFields':
    '64-bit fields are carried as BigInt; applying a decimal scale to a 64-bit field may lose precision.',
  'studio.help.commonErrors.title': 'Common errors and what to do',
  'studio.help.commonErrors.invalidHexAdvice':
    'The input holds a non-hex character or a stray digit; every byte is two digits.',
  'studio.help.commonErrors.lengthMismatchAdvice':
    'The length field does not match the real payload length; check the length reference and the offsets.',
  'studio.help.commonErrors.crcMismatchAdvice':
    'The checksum coverage starts or ends on the wrong field; review the coverage start and end fields.',
  'studio.help.commonErrors.startDelimiterAdvice':
    'The frame does not begin with the start byte; fix either the sample frame or the framing setting.',
  'studio.help.commonErrors.valueOutOfRangeAdvice':
    'The value falls outside the range of its type or the minimum/maximum declared in the schema.',
  'studio.help.commonErrors.unsupportedFunctionCodeAdvice':
    'The enum table has no such key; add the key to the enum values.',
  'studio.help.commonErrors.circularLengthAdvice':
    'Two fields reference each other for length; break the length chain.',

  // --- Packet Builder ---
  'nav.packetBuilder': 'Packet builder',
  'builder.error.encodeFailed': 'Encoding the packet failed: {detail}',
  'builder.error.postProcessingFailed': 'Post-processing the frame failed: {detail}',
  'builder.issue.exceedsMaximumFrameLength': 'The frame exceeds the maximum length: {detail}',
  'builder.issue.invalidValue': 'This value cannot be written into the field: {detail}',
  'builder.issue.lengthMismatch': 'Frame length does not match the length field: {detail}',
  'builder.issue.missingValue': 'A required field is still empty: {detail}',
  'builder.issue.unknownEnumLabel': 'Unknown enum label: {detail}',
  'builder.issue.valueOutOfRange': 'The value is outside the range of the field: {detail}',
  'builder.warning.bitPadding': 'Added {bits} padding bits to align the bit stream to a byte boundary.',

  // --- Packet Builder — screen, panels and guide ---
  'builder.title': 'Packet builder',
  'builder.intro':
    'Fill in the schema fields, let length and checksum be computed for you, see the packet as hex and send it to the connected source.',
  'builder.privacy':
    'The schema, the field values and the generated packets stay in this browser; no byte is sent to a server.',
  'builder.section.schema': 'Schema',
  'builder.section.connection': 'Connection',
  'builder.section.form': 'Field values',
  'builder.section.preview': 'Packet preview',
  'builder.section.send': 'Sending',
  'builder.section.documentation': 'Guide',
  'builder.section.project': 'Project and templates',
  'builder.template.nameLabel': 'Template name',
  'builder.template.save': 'Save as template',
  'builder.schema.missing':
    'There is no valid protocol schema; build one on the Studio screen first.',
  'builder.schema.nameLabel': 'Protocol:',
  'builder.schema.versionLabel': 'Version:',
  'builder.schema.editInStudio': 'Edit on the Studio screen',
  'builder.schema.reload': 'Reload the schema',
  'builder.source.label': 'Source',
  'builder.source.simulated': 'Simulation',
  'builder.source.serial': 'Serial port',
  'builder.source.websocket': 'WebSocket',
  'builder.source.plannedBadge': 'planned',
  'builder.source.simulatedHint':
    'The simulation source only produces data; packets cannot be sent to it.',
  'builder.source.serialHint':
    'A serial connection asks for browser permission and only works in browsers that support Web Serial.',
  'builder.serialUnsupported':
    'This browser has no Web Serial API; the serial port option is unavailable.',
  'builder.status.label': 'Status:',
  'builder.status.disconnected': 'Disconnected',
  'builder.status.connecting': 'Connecting',
  'builder.status.connected': 'Connected',
  'builder.status.error': 'Error',
  'builder.action.connect': 'Connect',
  'builder.action.disconnect': 'Disconnect',
  'builder.action.build': 'Build the packet',
  'builder.action.send': 'Send',
  'builder.action.stop': 'Stop',
  'builder.warning.readOnlySource':
    'This source is read-only; the packet is built but cannot be sent.',
  'builder.build.idle': 'The packet is rebuilt on every change. Byte count:',
  'builder.build.ready': 'The packet is ready. Byte count:',
  'builder.build.blocked': 'The packet could not be built; fix the issues below. Byte count:',
  'builder.form.label': 'Schema fields',
  'builder.form.randomize': 'Fill randomly',
  'builder.form.empty': 'The schema has no field to fill in.',
  'builder.form.derivedBadge': 'automatic',
  'builder.form.minimum': 'min',
  'builder.form.maximum': 'max',
  'builder.field.increment': 'Increase',
  'builder.field.decrement': 'Decrease',
  'builder.field.postProcessing': 'Post-framing processing',
  'builder.postProcessing.none': 'None',
  'builder.postProcessing.byteStuffing': 'Byte stuffing',
  'builder.postProcessing.bitStuffing': 'Bit stuffing',
  'builder.postProcessing.cobs': 'COBS',
  'builder.postProcessing.slip': 'SLIP',
  'builder.preview.empty': 'No packet has been built yet.',
  'builder.preview.regionsNote':
    'There is no field colouring here; the byte ranges of the fields are shown by the Studio parser.',
  'builder.preview.byteCount': 'Byte count:',
  'builder.preview.hex': 'Packet (hex)',
  'builder.preview.overrideToggle': 'Edit the packet by hand',
  'builder.preview.overrideLabel': 'Hand-written packet (hex)',
  'builder.preview.overrideHint':
    'While hand editing is on, field values and derived bytes are ignored; whatever you typed is what gets sent.',
  'builder.preview.code.c': 'C array',
  'builder.preview.code.python': 'Python array',
  'builder.preview.code.javascript': 'JavaScript array',
  'builder.send.mode': 'Send mode',
  'builder.mode.once': 'Once',
  'builder.mode.count': 'N times',
  'builder.mode.periodic': 'Periodic',
  'builder.send.intervalMs': 'Interval (ms)',
  'builder.send.count': 'Repeat count',
  'builder.send.responseTimeoutMs': 'Response timeout (ms)',
  'builder.send.sentCount': 'Sent:',
  'builder.send.disabledHint': 'To send, connect to a writable source and build a valid packet.',
  'builder.send.lastResponse': 'Last response',
  'builder.send.noResponse': 'No response yet.',
  'builder.steps.column.order': 'Order',
  'builder.steps.column.field': 'Field',
  'builder.steps.column.type': 'Type',
  'builder.steps.column.value': 'Value',
  'builder.steps.column.role': 'Role',
  'builder.steps.role.derived': 'automatic',
  'builder.steps.role.input': 'input',
  'builder.steps.empty': 'The schema has no fields.',
  'builder.steps.tableLabel': 'Field encoding order',
  'builder.steps.rawFrame': 'Unframed bytes (hex)',
  'builder.steps.framedBytes': 'Outgoing bytes (hex)',
  'builder.example.packetLabel': 'Spec §10 sample packet (hex)',
  'builder.example.schemaLabel': 'Spec §9.6 sample schema (JSON)',
  'builder.result.outgoingLabel': 'Generated packet (hex)',
  'builder.copy.outgoingLabel': 'Generated packet',
  'builder.copy.exampleLabel': 'Sample packet',
  'builder.export.hex': 'Download as hex',
  'builder.export.c': 'Download C array',
  'builder.export.python': 'Download Python array',
  'builder.export.javascript': 'Download JavaScript array',
  'builder.export.unavailable': 'Nothing can be exported while there is no valid packet.',
  'builder.export.failed': 'The file could not be downloaded; the browser may have blocked it.',
  'builder.doc.purpose.title': 'What this tool is for',
  'builder.doc.purpose.body':
    'It builds a valid binary packet from the schema fields, computes derived fields such as length and checksum itself, and sends the packet to the connected source.',
  'builder.doc.protocols.title': 'Which protocols',
  'builder.doc.protocols.body':
    'Any schema defined on the Studio screen. When the schema changes there, this form is rebuilt on its own.',
  'builder.doc.inputs.title': 'Inputs',
  'builder.doc.inputs.body': 'There are four groups of inputs:',
  'builder.doc.inputs.fields': 'Field values — one input for every field that is not derived.',
  'builder.doc.inputs.postProcessing':
    'Post-framing processing — byte stuffing, bit stuffing, COBS or SLIP.',
  'builder.doc.inputs.hexOverride': 'Hand-written hex — replaces the generated packet.',
  'builder.doc.inputs.sending':
    'Send settings — mode, interval, repeat count and response timeout.',
  'builder.doc.example.title': 'Sample data',
  'builder.doc.example.body':
    'The Set Output example of spec §10 (channel 2, 75% duty) and the §9.6 schema, ready to copy:',
  'builder.doc.action.title': 'Compute button',
  'builder.doc.action.body':
    'The build button does not trigger the computation — the packet is already rebuilt on every keystroke. Its job is to announce the result to screen readers again.',
  'builder.doc.result.title': 'Result',
  'builder.doc.result.body':
    'The outgoing bytes, after framing and any post-framing processing has been applied:',
  'builder.doc.formula.title': 'Formula used',
  'builder.doc.formula.body': 'The checksum in the sample schema is computed with XOR8:',
  'builder.doc.formula.expression': 'checksum = b[0] XOR b[1] XOR … XOR b[n-1]',
  'builder.doc.formula.coverage':
    'Coverage comes from the schema; in the sample schema it runs from the address field to the end of the payload field.',
  'builder.doc.formula.crcNote':
    'When a CRC is selected, the polynomial, initial value, input/output reflection and final XOR are read from the schema; the checksum byte itself is outside the coverage.',
  'builder.doc.steps.title': 'Step by step',
  'builder.doc.steps.body':
    'Fields are encoded in schema order; derived fields are computed after the bytes before them have been written.',
  'builder.doc.interpretation.title': 'How to read the result',
  'builder.doc.interpretation.body':
    'The first byte of the hex output is the frame start and the last one is the frame end; the bytes in between follow the field order.',
  'builder.doc.interpretation.response':
    'When a response is awaited, the first incoming chunk is shown as hex in the last response box; parsing it is the job of the Live Monitor screen.',
  'builder.doc.limits.title': 'Limitations',
  'builder.doc.limits.websocket':
    'The WebSocket source is not implemented yet; the option is visible but disabled.',
  'builder.doc.limits.singleOwner':
    'A serial port can be held by one tab at a time; if the Live Monitor holds the same port you cannot connect from here.',
  'builder.doc.limits.checksumOrder':
    'The checksum field must be last in the schema; a checksum declared in the middle cannot cover the bytes that follow it.',
  'builder.doc.limits.offsetIgnored':
    'The encoder writes fields in order; the offset in the schema is not used while encoding.',
  'builder.doc.limits.permissionDenied':
    'If serial permission is denied the connection is not established; asking again requires a new user gesture.',
  'builder.doc.limits.simulatedReadOnly':
    'The simulation source only reads; while it is connected the send button stays disabled.',
  'builder.doc.mistakes.title': 'Common mistakes',
  'builder.doc.mistakes.specChecksum':
    'The sample packet in spec §10 writes the checksum byte as 6C; the correct XOR8 result is 6E and this tool produces 6E.',
  'builder.doc.mistakes.derivedFields':
    'Typing a value into a derived field has no effect; the encoder always computes those itself.',
  'builder.doc.mistakes.hexOverride':
    'While hand editing stays on, changes to the field values do not reach the packet.',
  'builder.doc.mistakes.oddHexDigits':
    'If the hex input ends on an odd digit count the last byte is half written and no packet is produced.',
  'builder.doc.mistakes.frameTooLong':
    'As the payload grows the frame may exceed the maximum length in the schema; the limit is shown in the schema strip.',
  'builder.doc.mistakes.enumLabel':
    'Typing a key that is not in the enum table produces an error, not a value.',
  'builder.doc.copy.title': 'Copying',
  'builder.doc.copy.body': 'Copy the generated packet or the spec sample to the clipboard:',
  'builder.doc.export.title': 'Exporting',
  'builder.doc.export.body':
    'The packet and its array form in three languages are produced entirely on the client; no file touches a server.',
  'builder.error.cannotWrite': 'This source is read-only; the packet cannot be sent.',
  'builder.error.invalidHex': 'The hand-written hex could not be read; every byte is two digits.',
  'builder.error.invalidSchema':
    'The protocol schema is not valid; fix the validation issues on the Studio screen.',
  'builder.error.notConnected': 'Connect to a source first.',
  'builder.error.nothingToSend': 'There is no packet to send.',
  'builder.error.openFailed': 'The port could not be opened.',
  'builder.error.permissionDenied': 'Serial port permission was not granted.',
  'builder.error.portBusy': 'The port is in use by another tab or application.',
  'builder.error.readFailed': 'Reading from the port failed.',
  'builder.error.serialUnsupported': 'This browser has no Web Serial API.',
  'builder.error.writeFailed': 'Writing to the port failed.',

  // --- Project file ---
  'projects.action.applyTemplate': 'Apply',
  'projects.action.load': 'Load project',
  'projects.action.removeTemplate': 'Remove',
  'projects.action.save': 'Save project',
  'projects.panel.loadedLabel': 'Loaded project',
  'projects.panel.nameLabel': 'Project name',
  'projects.panel.privacy': 'The project file is built and downloaded in this browser only; no byte is sent to a server.',
  'projects.panel.templateSchemaLabel': 'Schema',
  'projects.panel.templatesEmpty': 'No saved packet templates. You can store the current form values as a template in the packet builder.',
  'projects.panel.templatesTitle': 'Packet templates',
  'projects.error.downloadFailed': 'The project file could not be downloaded.',
  'projects.error.fileReadFailed': 'The file could not be read.',
  'projects.error.futureVersion':
    'This project file uses a newer format version — update the application first.',
  'projects.error.invalidDescription': 'The project description has to be text.',
  'projects.error.invalidJson': 'The file is not valid JSON.',
  'projects.error.invalidName': 'The project name cannot be empty.',
  'projects.error.invalidPacketTemplate': 'One of the packet templates could not be read.',
  'projects.error.invalidPacketTemplates': 'The packet template list is not an array.',
  'projects.error.invalidProtocols': 'The protocol list has to be an array of strings.',
  'projects.error.invalidSavedAt': 'The saved-at stamp is not a readable date.',
  'projects.error.missingProject': 'The file carries no project section.',
  'projects.error.missingVersion': 'The file carries no format version — this is not a project file.',
  'projects.error.notAnObject': 'The root of the file is not a JSON object.',
  'projects.error.unsupportedVersion': 'This format version is no longer supported.',
  'projects.error.versionNotNumber': 'The format version has to be an integer.',

  // --- Frame decode panel ---
  'decode.loadFailed': 'The protocol engine could not be loaded.',
  'decode.example.label': 'Example frame',
  'decode.example.empty': 'This plugin ships no example frames; enter the bytes by hand.',
  'decode.hexInput.label': 'Frame bytes (HEX)',
  // Spec §42'nin birebir metni — `studio.output.parseError.code.invalidHexInput` ile aynı cümle.
  'decode.error.invalidHex': 'Invalid hexadecimal input',
  'decode.byteCount': 'Byte count',
  'decode.noParser':
    'This plugin has no parser; it only provides encoding and example frames. The bytes are shown raw below.',
  'decode.parserCrashed': 'The parser stopped with an unexpected error; the raw bytes are below.',
  'decode.table.label': 'Parsed fields',
  'decode.column.field': 'Field',
  'decode.column.offset': 'Offset',
  'decode.column.length': 'Length',
  'decode.column.raw': 'Raw value',
  'decode.column.physical': 'Physical value',
  'decode.column.validity': 'Validity',
  'decode.status.valid': 'Valid',
  'decode.status.invalid': 'Invalid',
  'decode.fields.empty': 'The parse produced no fields.',
  'decode.parseError.title': 'The frame could not be parsed',
  'decode.parseError.offset': 'Error offset',
  'decode.parseError.consumedBytes': 'Consumed bytes',
  'decode.parseError.recoverable': 'Recoverable — parsing can pick up at the next frame.',
  'decode.parseError.unrecoverable': 'Unrecoverable — nothing past this point can be trusted.',

  // --- Modbus ---
  // Function code and protocol names are DATA and stay untranslated; these strings
  // only explain what the code does. None of them carries a placeholder — see the
  // `summaryParams` note in `modbusPdu.ts`.
  'protocol.modbus.pdu.summary.readCoils': 'Read coils',
  'protocol.modbus.pdu.summary.readDiscreteInputs': 'Read discrete inputs',
  'protocol.modbus.pdu.summary.readHoldingRegisters': 'Read holding registers',
  'protocol.modbus.pdu.summary.readInputRegisters': 'Read input registers',
  'protocol.modbus.pdu.summary.writeSingleCoil': 'Write single coil',
  'protocol.modbus.pdu.summary.writeSingleRegister': 'Write single register',
  'protocol.modbus.pdu.summary.writeMultipleCoils': 'Write multiple coils',
  'protocol.modbus.pdu.summary.writeMultipleRegisters': 'Write multiple registers',
  'protocol.modbus.pdu.summary.maskWriteRegister': 'Mask write register',
  'protocol.modbus.pdu.summary.readWriteMultipleRegisters': 'Read/write multiple registers',
  'protocol.modbus.pdu.summary.encapsulatedInterfaceTransport':
    'Encapsulated interface transport (MEI)',
  'protocol.modbus.pdu.summary.exceptionResponse': 'Exception response',
  'protocol.modbus.pdu.summary.unknownFunctionCode': 'Unknown function code',
  'protocol.modbus.pdu.warning.truncatedBody':
    'The PDU body is shorter than this function code expects; the remaining fields could not be decoded.',
  'protocol.modbus.pdu.warning.truncatedField':
    'The field does not fit inside the body and was read incomplete.',
  'protocol.modbus.pdu.warning.emptyBody': 'The PDU body is empty.',
  'protocol.modbus.pdu.warning.byteCountMismatch':
    'The byte count field does not match the amount of data left in the body.',
  'protocol.modbus.pdu.warning.oddRegisterByteCount':
    'The register data holds an odd number of bytes; a register is 16 bits.',
  'protocol.modbus.pdu.warning.trailingBytes': 'There are leftover bytes after the decoded fields.',
  'protocol.modbus.pdu.warning.zeroQuantity':
    'The quantity field is zero; no item is read or written.',
  'protocol.modbus.pdu.warning.unknownFunctionCode':
    'The function code is not in the table; the body is left as raw bytes.',
  'protocol.modbus.pdu.warning.illegalCoilValue':
    'A coil value may only be 0xFF00 (ON) or 0x0000 (OFF).',
  'protocol.modbus.pdu.warning.missingExceptionCode':
    'The exception response carries no exception code byte.',
  'protocol.modbus.pdu.warning.unknownExceptionCode': 'The exception code is not in the table.',
  'protocol.modbus.pdu.warning.exceptionBitInRequest':
    'The request PDU has the exception bit (0x80) set; requests never carry it.',
  'protocol.modbus.rtu.documentation.summary':
    'The binary serial-line encoding of the Modbus application protocol. Frame boundaries are silent intervals rather than delimiters, and integrity rests on a CRC-16 computed from the address through the end of the PDU.',
  'protocol.modbus.rtu.error.crcMismatch':
    'CRC mismatch: the calculated value differs from the one carried in the frame.',
  'protocol.modbus.rtu.error.frameTooShort':
    'Frame too short: a Modbus RTU frame carries at least an address, a function code and a two-byte CRC.',
  'protocol.modbus.rtu.error.frameTooLong':
    'The frame exceeds the maximum allowed Modbus RTU length.',
  'protocol.modbus.rtu.error.unsupportedFunctionCode':
    'Unsupported function code — the frame is still shown byte by byte.',
  'protocol.modbus.rtu.error.aborted': 'Parsing was cancelled.',
  'protocol.modbus.rtu.warning.roleInferredRequest':
    'No direction was given; the frame was decoded as a request based on its body.',
  'protocol.modbus.rtu.warning.roleInferredResponse':
    'No direction was given; the frame was decoded as a response based on its body.',
  'protocol.modbus.rtu.warning.broadcastAddress':
    'Address 0 is the broadcast address: every device listens and none replies.',
  'protocol.modbus.rtu.warning.reservedSlaveAddress':
    'This address is reserved by the standard; individual device addresses run from 1 to 247.',
  'protocol.modbus.rtu.example.readHoldingRegistersRequest.name': 'Read holding registers request',
  'protocol.modbus.rtu.example.readHoldingRegistersRequest.description':
    'Two holding registers requested from device 1 — the reference fixture with a verified CRC.',
  'protocol.modbus.rtu.example.readHoldingRegistersResponse.name':
    'Read holding registers response',
  'protocol.modbus.rtu.example.readHoldingRegistersResponse.description':
    'Four data bytes: the first register reads 100, the second reads 200.',
  'protocol.modbus.rtu.example.exceptionResponse.name': 'Exception response',
  'protocol.modbus.rtu.example.exceptionResponse.description':
    'The function code has bit 0x80 set: the device rejects the request with Illegal Data Address.',
  'protocol.modbus.rtu.example.writeMultipleCoilsRequest.name': 'Write multiple coils request',
  'protocol.modbus.rtu.example.writeMultipleCoilsRequest.description':
    'Ten coils written to device 17; the data is a bit string packed into two bytes.',
  'protocol.modbus.rtu.example.crcMismatch.name': 'Broken CRC',
  'protocol.modbus.rtu.example.crcMismatch.description':
    'The read request with a single-bit CRC corruption: received 0x0BC5, calculated 0x0BC4.',
  'protocol.modbus.ascii.documentation.summary':
    'Serial form that carries Modbus messages as printable hexadecimal characters between a colon and CR LF, protected by an LRC instead of a CRC.',
  'protocol.modbus.ascii.error.missingColon': 'Frame does not start with a colon',
  'protocol.modbus.ascii.error.invalidHexCharacter': 'Frame contains a non-hexadecimal character',
  'protocol.modbus.ascii.error.oddHexDigitCount': 'Odd number of hexadecimal digits',
  'protocol.modbus.ascii.error.missingCarriageReturn': 'Missing CR before LF',
  'protocol.modbus.ascii.error.missingLineFeed': 'Frame does not end with LF',
  'protocol.modbus.ascii.error.frameTooShort':
    'Frame is too short to carry address, function code and LRC',
  'protocol.modbus.ascii.error.frameTooLong': 'No frame terminator within the allowed length',
  'protocol.modbus.ascii.error.lrcMismatch': 'LRC mismatch',
  'protocol.modbus.ascii.error.parserCancelled': 'Parsing was cancelled',
  'protocol.modbus.ascii.warning.lrcMismatch': 'Calculated LRC differs from the received LRC',
  'protocol.modbus.ascii.warning.reservedSlaveAddress':
    'Slave address falls in the reserved 248-255 range',
  'protocol.modbus.ascii.example.readHoldingRegistersRequest.description':
    'Request that reads two holding registers from device 1; documentation addresses 40001-40002.',
  'protocol.modbus.ascii.example.readHoldingRegistersResponse.description':
    'Response to that request: four data bytes carrying two register values.',
  'protocol.modbus.ascii.example.exceptionResponse.description':
    'Exception response: the function code carries the 0x80 flag and the exception code reports an illegal data address.',
  'protocol.modbus.ascii.example.invalidHexCharacter.description':
    'Malformed frame containing a non-hexadecimal character; shows the error path.',
  'protocol.modbus.ascii.example.lrcMismatch.description':
    'Frame sent with an off-by-one LRC; fields are still decoded and the frame is marked invalid.',
  'protocol.modbus.tcp.warning.unexpectedProtocolId':
    'Protocol ID is not zero; another protocol may be encapsulated on this port.',
  'protocol.modbus.tcp.warning.oversizedLength':
    'The length field exceeds the largest PDU size the standard allows.',

  // --- NMEA 0183 ---
  'protocol.nmea.sentence.warning.insufficientFields':
    'The sentence carries fewer fields than expected; the missing fields were not resolved.',
  'protocol.nmea.sentence.warning.trailingFields':
    'The sentence carries more fields than expected; the extra fields are shown raw.',
  'protocol.nmea.sentence.warning.unparseableNumber':
    'The field does not match the expected numeric format; the raw value is shown as-is.',
  'protocol.nmea.sentence.warning.genericFieldsOnly':
    'This sentence type is shown as a raw field list only; field meanings cannot be named without a loaded NMEA revision database.',
  'protocol.nmea.sentence.warning.unknownFormatter':
    'Unrecognized sentence format; fields are shown raw without semantic names.',
  'protocol.nmea.sentence.summary.generic': 'Recognized formatter, raw field list',
  'protocol.nmea.sentence.summary.unknown': 'Unrecognized sentence format',
  'protocol.nmea.sentence.summary.gga': 'GPS position fix',
  'protocol.nmea.sentence.summary.rmc': 'Recommended minimum navigation information',
  'protocol.nmea.sentence.summary.gsa': 'DOP and active satellites',
  'protocol.nmea.sentence.summary.gsv': 'Satellites in view',
  'protocol.nmea.sentence.summary.vtg': 'Course and speed',
  'protocol.nmea.sentence.summary.gll': 'Geographic position',
  'protocol.nmea.sentence.summary.zda': 'Time and date',
  'protocol.nmea.0183.error.sentenceTooShort':
    'The sentence is shorter than the shortest meaningful NMEA 0183 sentence.',
  'protocol.nmea.0183.error.sentenceTooLong':
    'The sentence exceeds the classic 82-character NMEA 0183 limit.',
  'protocol.nmea.0183.error.startDelimiterNotFound': 'The sentence does not start with $.',
  'protocol.nmea.0183.error.missingChecksumDelimiter':
    'The sentence has no checksum delimiter (*).',
  'protocol.nmea.0183.error.malformedIdentifier':
    'The talker+formatter field must be at least three characters.',
  'protocol.nmea.0183.error.checksumMismatch':
    'Checksum mismatch: the calculated value does not match the value carried in the sentence.',
  'protocol.nmea.0183.error.aborted': 'Parsing was cancelled.',
  'protocol.nmea.0183.documentation.summary':
    'Single-talker / multiple-listener printable-ASCII sentence protocol; fields are comma-delimited and integrity is protected by an XOR checksum over the characters between $ and *.',
  'protocol.nmea.0183.example.ggaFix.name': 'GGA position fix (spec §43)',
  'protocol.nmea.0183.example.ggaFix.description':
    'The verified spec §43 reference sentence: latitude 48.1173°, longitude 11.516666...°, valid checksum.',
  'protocol.nmea.0183.example.ggaChecksumMismatch.name': 'Broken checksum',
  'protocol.nmea.0183.example.ggaChecksumMismatch.description':
    'The same GGA sentence with a single-digit checksum corruption: received 0x48, calculated 0x47.',
  'protocol.nmea.0183.example.rmcFix.name': 'RMC minimum navigation information',
  'protocol.nmea.0183.example.rmcFix.description':
    'The classic RMC reference sentence carrying the same position and time as the GGA fixture.',
  'protocol.nmea.0183.example.gsaActiveSatellites.name': 'GSA active satellites and DOP',
  'protocol.nmea.0183.example.gsaActiveSatellites.description':
    'Classic reference sentence carrying a 3D fix, six active satellite PRNs and PDOP/HDOP/VDOP values.',
  'protocol.nmea.0183.example.gsvSatellitesInView.name': 'GSV satellites in view',
  'protocol.nmea.0183.example.gsvSatellitesInView.description':
    'First of a three-message sequence: 11 satellites in view, this message carries PRN/elevation/azimuth/SNR for four of them.',
  'protocol.nmea.0183.example.vtgCourseSpeed.name': 'VTG course and speed',
  'protocol.nmea.0183.example.vtgCourseSpeed.description':
    'Classic reference sentence carrying true and magnetic course together with speed in knots and km/h.',
  'protocol.nmea.0183.example.gllPosition.name': 'GLL geographic position',
  'protocol.nmea.0183.example.gllPosition.description':
    'A minimal position sentence carrying only latitude/longitude, time and status.',
  'protocol.nmea.0183.example.zdaTimeDate.name': 'ZDA time and date',
  'protocol.nmea.0183.example.zdaTimeDate.description':
    'Sentence carrying UTC time, calendar date and the local zone offset.',
  'protocol.nmea.0183.example.mwvGenericEnvelope.name': 'MWV — generic envelope example',
  'protocol.nmea.0183.example.mwvGenericEnvelope.description':
    'A sentence type outside the GNSS seven: the formatter is recognized but fields are shown only as a raw list.',

  // --- NMEA 2000 ---
  'protocol.nmea.2000.error.frameTooShort':
    'The record is not long enough to carry the identifier and length fields.',
  'protocol.nmea.2000.error.frameTooLong': 'The record exceeds the fixed frame size.',
  'protocol.nmea.2000.error.notExtended':
    'NMEA 2000 requires a 29-bit extended identifier; a PGN cannot be extracted from an 11-bit frame.',
  'protocol.nmea.2000.error.aborted': 'Parsing was cancelled.',
  'protocol.nmea.2000.warning.reservedBitSet':
    'The reserved bit is set; the identifier may be corrupt, or the extended page semantics of the current standard may be in use.',
  'protocol.nmea.2000.warning.nullSourceAddress':
    'The source address is the null address: the sending node was unable to claim a valid address.',
  'protocol.nmea.2000.warning.remoteFrame':
    'The remote flag is set; NMEA 2000 does not use remote frames.',
  'protocol.nmea.2000.warning.truncatedPayload':
    'The declared data length is not present in the record; the bytes that are available were shown.',
  'protocol.nmea.2000.warning.pgnNeedsDatabase':
    'The PGN number can be computed, but its name and field layout come from the licensed NMEA 2000 database — they are not guessed here.',
  'protocol.nmea.2000.warning.fastPacketUnknown':
    'Whether this frame is self-contained or part of a multi-frame Fast Packet transfer cannot be known without a PGN database and the rest of the same session.',
  'protocol.nmea.2000.warning.possibleJ1939':
    'A 29-bit identifier alone is not proof of a protocol; this frame could equally be a J1939 message sharing the same bit layout.',
  'protocol.nmea.2000.summary.pdu1': 'Destination-specific NMEA 2000 message',
  'protocol.nmea.2000.summary.pdu2': 'Broadcast NMEA 2000 message',
  'protocol.nmea.2000.documentation.summary':
    'The IEC 61162-3 shipboard CAN network; identifier math is identical to J1939 (Priority/Reserved/Data Page/PDU Format/PDU Specific/Source Address → PGN). The meaning of a PGN and Fast Packet reassembly both require the licensed NMEA 2000 database — this page only resolves the frame level.',
  'protocol.nmea.2000.example.sharedJ1939Fixture.name': 'J1939 §43 fixture (shared formula)',
  'protocol.nmea.2000.example.sharedJ1939Fixture.description':
    'The exact same bytes as J1939’s verified §43 fixture: since the identifier formula is shared (spec 14701 = 38503), this also resolves to Priority 6, PGN 61444, Source Address 1.',
  'protocol.nmea.2000.example.singleFrameCandidate.name': 'Single-frame candidate (short payload)',
  'protocol.nmea.2000.example.singleFrameCandidate.description':
    'A four-byte short payload looks like a self-contained message, but the engine cannot PROVE it — without a PGN database the Fast Packet possibility always stays open.',
  'protocol.nmea.2000.example.fastPacketCandidate.name': 'Fast Packet candidate (full 8 bytes)',
  'protocol.nmea.2000.example.fastPacketCandidate.description':
    'A full eight-byte payload is classic CAN’s upper limit; this could just as well be the first or a middle frame of a multi-frame Fast Packet transfer — it cannot be told apart on its own.',
  'protocol.nmea.2000.example.widePgnRange.name': 'Wide PGN range (Data Page 1)',
  'protocol.nmea.2000.example.widePgnRange.description':
    'Data Page bit set to 1: the PGN falls into the extended range at 65536 and above; its meaning still depends on the licensed database.',
  'protocol.nmea.2000.example.pdu1DestinationSpecific.name': 'Destination-specific message (PDU1)',
  'protocol.nmea.2000.example.pdu1DestinationSpecific.description':
    'Below the PDU Format threshold: the PDU Specific field is a destination address and is zeroed out of the PGN calculation — the same formula as J1939.',
  'protocol.nmea.2000.example.baseFrameRejected.name': 'Base frame (cannot be decoded)',
  'protocol.nmea.2000.example.baseFrameRejected.description':
    'A frame carrying an 11-bit identifier: an error is raised but the frame is still shown field by field.',

  // --- AIS ---
  'protocol.ais.error.sentenceTooShort':
    'The sentence is not long enough to carry the envelope fields (fragment/sequence/channel/payload/fill bits).',
  'protocol.ais.error.sentenceTooLong': 'The sentence exceeds NMEA 0183’s fixed 82-character limit.',
  'protocol.ais.error.startDelimiterNotFound': 'The sentence does not start with !.',
  'protocol.ais.error.missingChecksumDelimiter': 'The sentence has no checksum delimiter (*).',
  'protocol.ais.error.malformedIdentifier': 'The identifier (talker+formatter) is shorter than five characters.',
  'protocol.ais.error.unknownFormatter': 'The sentence formatter is not AIVDM/AIVDO — this page only decodes those two.',
  'protocol.ais.error.insufficientEnvelopeFields':
    'The envelope is missing its payload and/or fill bits fields; the fields that are present were still shown.',
  'protocol.ais.error.emptyPayload': 'The payload field is empty; the Message Type could not be computed.',
  'protocol.ais.error.checksumMismatch': 'The NMEA checksum does not match.',
  'protocol.ais.error.aborted': 'Parsing was cancelled.',
  'protocol.ais.warning.fragmentedMessage':
    'This message is split across multiple NMEA sentences; this engine does NOT reassemble fragments, it only decodes a single sentence — the full meaning requires all parts to be brought together.',
  'protocol.ais.warning.messageTypeNeedsDatabase':
    'The Message Type number can be computed, but its name falls outside the five named on this page — the full name/field layout comes from the licensed ITU-R M.1371 database.',
  'protocol.ais.warning.fieldsNeedDatabase':
    'Every bit beyond the Message Type (MMSI, position, speed, navigation status …) depends on the licensed M.1371 message database — it is not guessed here, only the raw bit count is shown.',
  'protocol.ais.warning.unparseableNumber': 'The field could not be converted to a numeric value.',
  'protocol.ais.summary.received': 'Received AIS message (AIVDM)',
  'protocol.ais.summary.ownVessel': 'Own-vessel AIS report (AIVDO)',
  'protocol.ais.documentation.summary':
    'The !AIVDM/!AIVDO NMEA 0183 transport sentence; fragment/sequence/channel/payload/fill bits/checksum are FULLY decoded. The 6-bit armored payload is opened into a bit stream, but only the Message Type (first 6 bits) is named — no name is assigned outside the five types the spec names. Every other field (MMSI, position, speed …) requires the licensed ITU-R M.1371 database; this page only resolves the envelope + Message Type level.',
  'protocol.ais.example.positionReportClassA.name': 'Position Report Class A (Type 1)',
  'protocol.ais.example.positionReportClassA.description':
    'A single-fragment example with a named Message Type 1 — channel A, valid checksum.',
  'protocol.ais.example.multiFragmentStaticData.name': 'Multi-fragment Static Data (Type 5, 2 fragments)',
  'protocol.ais.example.multiFragmentStaticData.description':
    'Matches the spec’s own envelope example (2,1,5,A): the first of two fragments, Message Type 5 — the fragmentedMessage warning is raised, no reassembly is performed.',
  'protocol.ais.example.checksumMismatch.name': 'Corrupted checksum',
  'protocol.ais.example.checksumMismatch.description':
    'The same body as the first example, with the last checksum digit deliberately corrupted — an error is raised but the frame is still decoded field by field.',
  'protocol.ais.example.unnamedMessageType.name': 'Unnamed Message Type (Type 8)',
  'protocol.ais.example.unnamedMessageType.description':
    'Binary Broadcast Message: outside the five types the spec names — a raw number plus the messageTypeNeedsDatabase warning are shown.',
  'protocol.ais.example.ownVesselClassB.name': 'Own vessel, Class B (AIVDO, Type 18)',
  'protocol.ais.example.ownVesselClassB.description':
    'An AIVDO (own-vessel) formatter with a named Message Type 18 example — channel B.',

  // --- UBX ---
  'protocol.ubx.error.headerTruncated':
    'The record is not long enough to carry the Sync/Class/ID/Length fields.',
  'protocol.ubx.error.frameTooLong': 'The record exceeds the allowed maximum frame length.',
  'protocol.ubx.error.aborted': 'Parsing was cancelled.',
  'protocol.ubx.error.invalidSync': 'The record does not start with the B5 62 sync bytes.',
  'protocol.ubx.error.truncatedPayload':
    'The payload and/or checksum announced by the Length field is missing from the record.',
  'protocol.ubx.error.checksumMismatch':
    'Checksum mismatch: the computed CK_A/CK_B does not match the value carried in the frame.',
  'protocol.ubx.warning.unknownClass':
    'The class byte is outside the narrow, publicly documented u-blox class set (NAV/RXM/CFG/ACK/INF/MON…).',
  'protocol.ubx.warning.payloadNeedsDatabase':
    'Payload shown raw: the field layout (e.g. NAV-PVT) comes from u-blox’s version-dependent interface manual and is not guessed here.',
  'protocol.ubx.warning.trailingBytes':
    'There are extra bytes after Length + checksum; the surplus does not belong to this frame.',
  'protocol.ubx.summary.frame': 'UBX frame',
  'protocol.ubx.documentation.summary':
    'u-blox GNSS receivers’ own byte stream: Sync (B5 62) + Class + ID + little-endian Length + Payload + an 8-bit two-accumulator Checksum (CK_A/CK_B). Checksum coverage runs from Class to the end of the payload, EXCLUDING sync. Class is named from a narrow set; the ID number table and the internal payload layout (e.g. NAV-PVT) come from a version-dependent, licensed interface manual — left raw here.',
  'protocol.ubx.example.monVerPoll.name': 'MON-VER poll (spec ~5355)',
  'protocol.ubx.example.monVerPoll.description':
    'The ONE concrete UBX byte sequence the spec gives: B5 62 0A 06 00 00 10 3A — Class MON, empty payload, valid checksum.',
  'protocol.ubx.example.payloadNeedsDatabase.name': 'Populated payload (NAV class)',
  'protocol.ubx.example.payloadNeedsDatabase.description':
    'The NAV class is recognized, but the four-byte payload is left unnamed — the payloadNeedsDatabase warning fires.',
  'protocol.ubx.example.unknownClass.name': 'Unrecognized class',
  'protocol.ubx.example.unknownClass.description':
    'Class byte 0x99 is outside the narrow set: a warning fires but the frame is still considered valid.',
  'protocol.ubx.example.checksumMismatch.name': 'Corrupted checksum',
  'protocol.ubx.example.checksumMismatch.description':
    'The same body as the MON-VER poll example, with the CK_B byte deliberately corrupted (0x00 instead of 0x3A).',

  // --- RTCM ---
  'protocol.rtcm.error.headerTruncated':
    'The record is not long enough to carry the Preamble and Length fields.',
  'protocol.rtcm.error.frameTooLong': 'The record exceeds the allowed maximum frame length.',
  'protocol.rtcm.error.aborted': 'Parsing was cancelled.',
  'protocol.rtcm.error.invalidPreamble': 'The record does not start with the 0xD3 preamble byte.',
  'protocol.rtcm.error.truncatedPayload':
    'The payload and/or CRC announced by the Length field is missing from the record.',
  'protocol.rtcm.error.crcMismatch':
    'CRC-24Q mismatch: the computed value does not match the value carried in the frame.',
  'protocol.rtcm.warning.reservedBitSet':
    'The 6 reserved bits are not zero; the frame may be corrupted or an unknown revision may be using this field.',
  'protocol.rtcm.warning.payloadNeedsDatabase':
    'All payload bytes beyond the message number (station ID, observations, MSM/SSR cells …) depend on the official RTCM 10403 revision — shown raw here, not guessed.',
  'protocol.rtcm.warning.messageNumberUnavailable':
    'The payload is not long enough to carry the 12-bit message number.',
  'protocol.rtcm.warning.messageCategoryUnknown':
    'The message number is outside this page’s narrow category mapping; its full name and category come from the licensed RTCM message table.',
  'protocol.rtcm.warning.trailingBytes':
    'There are extra bytes after Length + CRC; the surplus does not belong to this frame.',
  'protocol.rtcm.summary.frame': 'RTCM frame',
  'protocol.rtcm.documentation.summary':
    'The frame format of GNSS correction messages (RTCM 10403.x): a 0xD3 preamble + 6 reserved bits + a 10-bit Length + Payload + CRC-24Q. The first 12 bits of the payload are the message number and are always resolved; the number’s category (Reference Station/MSM/GLONASS…) is named only through the narrow mapping the spec explicitly gives. The message’s human-readable name and field layout come from the licensed RTCM message table — not written here.',
  'protocol.rtcm.example.referenceStation.name': 'Message 1005 (Reference Station)',
  'protocol.rtcm.example.referenceStation.description':
    'Message number 1005, which the spec’s category mapping places under "Reference Station" — valid CRC-24Q.',
  'protocol.rtcm.example.unclassifiedMessageNumber.name': 'Unclassified message number',
  'protocol.rtcm.example.unclassifiedMessageNumber.description':
    'Message number 4095 is outside the narrow category mapping: a warning fires but the frame is still considered valid.',
  'protocol.rtcm.example.crcMismatch.name': 'Corrupted CRC',
  'protocol.rtcm.example.crcMismatch.description':
    'The same body as the message 1005 example, with the last CRC byte deliberately corrupted (0x00 instead of 0x27).',

  // --- CAN family (shared frame core) ---
  'protocol.can.frame.warning.truncatedPayload':
    'The declared data length is not present in the record; the available bytes were decoded.',
  'protocol.can.frame.warning.trailingBytes':
    'The record exceeds the fixed frame size; the extra bytes do not belong to the frame.',
  'protocol.can.frame.warning.errorFlagSet':
    'The error flag is set: this is an error notification, not a data frame.',
  'protocol.can.frame.warning.remoteWithPayload':
    'The remote frame carries data; a remote request has no data field.',
  'protocol.can.frame.warning.extendedOnBasePage':
    'This frame carries a 29-bit extended identifier; the page is for the 11-bit base format.',
  'protocol.can.frame.warning.baseOnExtendedPage':
    'This frame carries an 11-bit base identifier; the page is for the 29-bit extended format.',
  'protocol.can.frame.warning.nonCanonicalFdLength':
    'The length matches no CAN FD DLC code; the valid values are 0-8, 12, 16, 20, 24, 32, 48 and 64.',
  'protocol.can.frame.warning.missingFdfFlag':
    'The FDF flag is absent; the record is not marked as a CAN FD frame.',
  'protocol.can.frame.warning.higherLayerCandidates':
    'A 29-bit identifier alone is not proof of a protocol; J1939, NMEA 2000, ISO-TP Extended, CANopen Extended and vendor-specific formats are all candidates.',
  'protocol.can.frame.summary.classicData': 'Classical CAN data frame',
  'protocol.can.frame.summary.classicRemote': 'Classical CAN remote frame',
  'protocol.can.frame.summary.fdData': 'CAN FD data frame',

  // --- CAN 2.0A / 2.0B ---
  'protocol.can.classic.error.frameTooShort':
    'The record is too short to carry the identifier and length fields.',
  'protocol.can.classic.error.frameTooLong':
    'The record exceeds the fixed frame size; the frame boundary may have shifted.',
  'protocol.can.classic.error.aborted': 'Parsing was cancelled.',
  'protocol.can.classic.base.documentation.summary':
    'Classical CAN base frame with an 11-bit identifier and up to 8 data bytes. The input is the byte layout of a SocketCAN record: a little-endian four-byte identifier followed by length and data.',
  'protocol.can.classic.extended.documentation.summary':
    'Classical CAN extended frame carrying a 29-bit identifier, the transport for higher layers such as J1939 and NMEA 2000. The input is the byte layout of a SocketCAN record.',
  'protocol.can.classic.example.baseDataFrame.name': 'Base data frame',
  'protocol.can.classic.example.baseDataFrame.description':
    'Identifier 0x321 with eight data bytes — the exact counterpart of the DLC example in the specification.',
  'protocol.can.classic.example.baseArbitrationWinner.name': 'Arbitration winner',
  'protocol.can.classic.example.baseArbitrationWinner.description':
    'Identifier 0x120; the winning side against 0x123 in the arbitration example, because a lower identifier means higher priority.',
  'protocol.can.classic.example.baseRemoteFrame.name': 'Remote frame',
  'protocol.can.classic.example.baseRemoteFrame.description':
    'The RTR flag is set and there is no data field: a request for data carries none itself.',
  'protocol.can.classic.example.extendedJ1939Identifier.name': 'Extended identifier (spec §43)',
  'protocol.can.classic.example.extendedJ1939Identifier.description':
    'Identifier 0x18F00401 — the specification uses the same value both as an extended frame example and as the J1939 fixture.',
  'protocol.can.classic.example.extendedBaseFrameMismatch.name': 'Base frame (format mismatch)',
  'protocol.can.classic.example.extendedBaseFrameMismatch.description':
    'An 11-bit frame landing on the extended page: not an error, it shows the warning path.',

  // --- CAN FD ---
  'protocol.can.fd.error.frameTooShort':
    'The record is too short to carry the identifier, length and flag fields.',
  'protocol.can.fd.error.frameTooLong': 'The record exceeds the fixed CAN FD frame size.',
  'protocol.can.fd.error.aborted': 'Parsing was cancelled.',
  'protocol.can.fd.documentation.summary':
    'Second-generation CAN frame extending the data field to 64 bytes and allowing the data phase to switch to a faster bit rate. The length field is the actual byte count; the DLC code is derived back from it for display.',
  'protocol.can.fd.example.fdBrs12Byte.name': '12-byte BRS frame',
  'protocol.can.fd.example.fdBrs12Byte.description':
    'Twelve bytes, matching DLC code 9: just past the 8-byte limit of classical CAN, the first point where the mapping breaks.',
  'protocol.can.fd.example.fdMaxPayload.name': '64-byte maximum payload',
  'protocol.can.fd.example.fdMaxPayload.description':
    'DLC code 15, the CAN FD upper limit, together with an extended identifier and a bit rate switch.',
  'protocol.can.fd.example.fdErrorPassive.name': 'Error passive transmitter',
  'protocol.can.fd.example.fdErrorPassive.description':
    'The ESI flag is set: the transmitting node is in the error passive state.',
  'protocol.can.fd.example.fdNonCanonicalLength.name': 'Non-canonical length',
  'protocol.can.fd.example.fdNonCanonicalLength.description':
    'Thirteen bytes match no DLC code; the length field is marked invalid but the data is still shown.',

  // --- CAN XL ---
  'protocol.can.xl.error.frameTooShort': 'The record is too short to carry the CAN XL header.',
  'protocol.can.xl.error.frameTooLong': 'The record exceeds the maximum CAN XL frame size.',
  'protocol.can.xl.error.lengthOutOfRange':
    'The data length is outside the permitted range; the CAN XL data field is between 1 and 2048 bytes.',
  'protocol.can.xl.error.aborted': 'Parsing was cancelled.',
  'protocol.can.xl.warning.missingXlfFlag':
    'The XLF flag is absent; the record is not marked as a CAN XL frame.',
  'protocol.can.xl.warning.truncatedPayload':
    'The declared data length is not present in the record; the available bytes were shown.',
  'protocol.can.xl.warning.trailingBytes':
    'There are more bytes than the declared length; the surplus does not belong to the frame.',
  'protocol.can.xl.summary.frame': 'CAN XL frame',
  'protocol.can.xl.documentation.summary':
    'Third-generation CAN frame with a 1–2048 byte data field. The classical identifier splits in two: an 11-bit priority ID serves arbitration alone, while content and address information move to a 32-bit acceptance field. Scope in this release is limited to frame inspection.',
  'protocol.can.xl.example.xlShortFrame.name': 'Short CAN XL frame',
  'protocol.can.xl.example.xlShortFrame.description':
    'A sixteen-byte payload with a defined VCID and acceptance field, showing the basic field layout.',
  'protocol.can.xl.example.xlLargePayload.name': 'Large payload',
  'protocol.can.xl.example.xlLargePayload.description':
    'A 256-byte payload beyond anything classical CAN could carry in its eight bytes; the viewer has to scroll.',
  'protocol.can.xl.example.xlSecureFrame.name': 'Frame with the SEC flag',
  'protocol.can.xl.example.xlSecureFrame.description':
    'The simple extended content flag is set; the payload is interpreted according to the security format of the higher layer.',

  // --- J1939 ---
  'protocol.j1939.error.frameTooShort':
    'The record is too short to carry the identifier and length fields.',
  'protocol.j1939.error.frameTooLong': 'The record exceeds the fixed frame size.',
  'protocol.j1939.error.notExtended':
    'J1939 requires a 29-bit extended identifier; a PGN cannot be derived from an 11-bit frame.',
  'protocol.j1939.error.aborted': 'Parsing was cancelled.',
  'protocol.j1939.warning.reservedBitSet':
    'The reserved bit is set; the identifier may be corrupt, or the extended page semantics of the current standard may be in use.',
  'protocol.j1939.warning.nullSourceAddress':
    'The source address is the null address: the sending node could not claim a valid address.',
  'protocol.j1939.warning.remoteFrame':
    'The remote flag is set; J1939 does not use remote frames.',
  'protocol.j1939.warning.truncatedPayload':
    'The declared data length is not present in the record; the available bytes were shown.',
  'protocol.j1939.warning.spnNeedsDatabase':
    'The data field is shown raw: parameter names, resolutions and units come from the licensed J1939 database and are not guessed.',
  'protocol.j1939.warning.transportSession':
    'This is a transport or network management message; its full meaning emerges only together with the other frames of the same session.',
  'protocol.j1939.summary.pdu1': 'Destination-specific J1939 message',
  'protocol.j1939.summary.pdu2': 'Broadcast J1939 message',
  'protocol.j1939.documentation.summary':
    'Heavy-duty communication architecture that splits the 29-bit CAN identifier into priority, page selection, PGN and source address. The PGN rule depends on the PDU format threshold: below 240 the PDU specific field is a destination address and is cleared from the PGN, at 240 and above it enters the PGN as a group extension.',
  'protocol.j1939.example.pdu2Broadcast.name': 'Broadcast message (spec §43)',
  'protocol.j1939.example.pdu2Broadcast.description':
    'Identifier 0x18F00401 — the verified fixture of the specification: priority 6, PGN 61444, source address 1.',
  'protocol.j1939.example.pdu1DestinationSpecific.name': 'Destination-specific message',
  'protocol.j1939.example.pdu1DestinationSpecific.description':
    'PDU format 239 falls below the threshold: the PDU specific field is a destination address and is cleared when the PGN is computed.',
  'protocol.j1939.example.addressClaimed.name': 'Address claim',
  'protocol.j1939.example.addressClaimed.description':
    'A network management message; the destination is the broadcast address, so the claim reaches every node.',
  'protocol.j1939.example.transportDataTransfer.name': 'Transport data packet',
  'protocol.j1939.example.transportDataTransfer.description':
    'Part of a message longer than eight bytes; the first byte is the packet sequence number and reassembly belongs to the session layer.',
  'protocol.j1939.example.baseFrameRejected.name': 'Base frame (cannot be decoded)',
  'protocol.j1939.example.baseFrameRejected.description':
    'A frame carrying an 11-bit identifier: an error is reported but the frame is still shown field by field.',

  // --- ISO-TP ---
  'protocol.isotp.error.frameTooShort':
    'The record is not long enough to carry the CAN identifier and length fields.',
  'protocol.isotp.error.frameTooLong': 'The record exceeds the fixed frame size.',
  'protocol.isotp.error.aborted': 'Parsing was cancelled.',
  'protocol.isotp.error.missingPci': 'Payload is empty: no PCI byte, ISO-TP cannot be decoded.',
  'protocol.isotp.error.incompleteFirstFramePci':
    'The First Frame’s second PCI byte (the low eight bits of FF_DL) is missing.',
  'protocol.isotp.error.unknownPciType':
    'The PCI high nibble does not match any of ISO-TP’s four types (Single/First/Consecutive Frame, Flow Control).',
  'protocol.isotp.warning.remoteFrame':
    'Remote flag is set; ISO-TP does not use remote frames.',
  'protocol.isotp.warning.truncatedPayload':
    'The declared data length is not present in the record; the available bytes are shown.',
  'protocol.isotp.warning.truncatedSingleFrameData':
    'The data promised by SF_DL is not present in the record; the available bytes are shown.',
  'protocol.isotp.warning.transportSession':
    'This frame is part of a multi-frame ISO-TP session; reassembly and sequence validation are the analysis layer’s job and are not performed here.',
  'protocol.isotp.warning.unknownFlowStatus':
    'The Flow Status value is none of Continue To Send / Wait / Overflow.',
  'protocol.isotp.summary.singleFrame': 'Single-frame ISO-TP message',
  'protocol.isotp.summary.firstFrame': 'First frame of a multi-frame ISO-TP session',
  'protocol.isotp.summary.consecutiveFrame': 'Consecutive frame of a multi-frame ISO-TP session',
  'protocol.isotp.summary.flowControl': 'ISO-TP flow control frame',
  'protocol.isotp.summary.unknownPciType': 'Unrecognized ISO-TP PCI type',
  'protocol.isotp.documentation.summary':
    'ISO 15765-2 transport layer: decodes the CAN payload’s PCI byte into Single/First/Consecutive Frame and Flow Control. Multi-frame reassembly, sequence validation and STmin timing are deliberately out of scope — a single-frame parser holds no session state.',
  'protocol.isotp.example.singleFrame.name': 'Single Frame (spec summary §04)',
  'protocol.isotp.example.singleFrame.description':
    'PCI 0x02 → SF_DL 2, data 10 01 — the spec’s own inline example.',
  'protocol.isotp.example.firstFrame.name': 'First Frame (spec summary §04)',
  'protocol.isotp.example.firstFrame.description':
    'PCI 0x10 0x14 → FF_DL 20 bytes — the spec’s own inline example; the remaining six bytes are illustrative.',
  'protocol.isotp.example.consecutiveFrame.name': 'Consecutive Frame',
  'protocol.isotp.example.consecutiveFrame.description':
    'PCI 0x21 → sequence number 1, a seven-byte data chunk.',
  'protocol.isotp.example.flowControlContinue.name': 'Flow Control (Continue To Send)',
  'protocol.isotp.example.flowControlContinue.description':
    'FS Continue To Send, BS unlimited (0), STmin shown as a raw byte.',
  'protocol.isotp.example.singleFrameTruncated.name': 'Single Frame (truncated data)',
  'protocol.isotp.example.singleFrameTruncated.description':
    'SF_DL promises seven bytes but only three are present in the record.',
  'protocol.isotp.example.unknownPciTypeRejected.name': 'Unrecognized PCI type',
  'protocol.isotp.example.unknownPciTypeRejected.description':
    'High nibble 0xF: none of ISO-TP’s four PCI types.',

  // --- UDS ---
  'protocol.uds.error.emptyPdu': 'The PDU is empty: at least a SID byte is required.',
  'protocol.uds.error.incompleteNegativeResponse':
    'The negative response envelope is incomplete: Response Code, Original SID and NRC are all required.',
  'protocol.uds.error.frameTooLong': 'The PDU exceeds the allowed maximum length.',
  'protocol.uds.error.aborted': 'Parsing was cancelled.',
  'protocol.uds.warning.unknownSid': 'The SID is not in the spec’s service table.',
  'protocol.uds.warning.nrcNeedsDatabase':
    'The NRC is shown raw: the full code table lives in ISO 14229’s normative body and the spec does not provide it, so it is not guessed.',
  'protocol.uds.warning.trailingBytes': 'There are extra bytes after the negative response envelope.',
  'protocol.uds.summary.request': 'UDS service request',
  'protocol.uds.summary.positiveResponse': 'UDS positive response',
  'protocol.uds.summary.negativeResponse': 'UDS negative response',
  'protocol.uds.documentation.summary':
    'The SID/NRC envelope of ISO 14229 diagnostic services: distinguishes a request, a positive response (SID+0x40) and a negative response (0x7F + original SID + NRC). The service parameter body and the full NRC table are left raw because the spec does not provide them.',
  'protocol.uds.example.readDataByIdentifierRequest.name':
    'Read Data By Identifier request (spec summary §04)',
  'protocol.uds.example.readDataByIdentifierRequest.description':
    '22 F1 90 — the spec’s own example: a request to read DID 0xF190 (VIN).',
  'protocol.uds.example.readDataByIdentifierPositiveResponse.name':
    'Read Data By Identifier positive response',
  'protocol.uds.example.readDataByIdentifierPositiveResponse.description':
    '0x62 = 0x22 + 0x40: the request’s positive response, echoing the same DID.',
  'protocol.uds.example.negativeResponseRequestOutOfRange.name':
    'Negative response: Request Out Of Range (spec summary §04)',
  'protocol.uds.example.negativeResponseRequestOutOfRange.description':
    '7F 22 31 — the spec’s own example: NRC 0x31.',
  'protocol.uds.example.testerPresentRequest.name': 'Tester Present request',
  'protocol.uds.example.testerPresentRequest.description':
    'The minimal service request that keeps a session alive.',
  'protocol.uds.example.unknownSid.name': 'Unrecognized SID',
  'protocol.uds.example.unknownSid.description':
    'The SID is not in the table: the field is marked invalid but the frame is still shown.',
  'protocol.uds.example.negativeResponseTruncated.name': 'Negative response (missing NRC)',
  'protocol.uds.example.negativeResponseTruncated.description':
    'The NRC byte is missing: only the Response Code and Original SID are decoded.',

  // --- OBD-II ---
  'protocol.obd.error.emptyPdu': 'The PDU is empty: at least a mode byte is required.',
  'protocol.obd.error.frameTooLong': 'The PDU exceeds the allowed maximum length.',
  'protocol.obd.error.aborted': 'Parsing was cancelled.',
  'protocol.obd.warning.unknownMode': 'The mode does not match any of the spec’s nine modes.',
  'protocol.obd.summary.request': 'OBD-II mode request',
  'protocol.obd.summary.response': 'OBD-II mode response',
  'protocol.obd.documentation.summary':
    'SAE J1979 / ISO 15031-5 emissions diagnostic model: decodes the identity of the nine modes and the mode+0x40 response rule. PIDs are NOT bound to a name or formula — the spec does not give PID numbers, only three formulas (Engine RPM, Vehicle Speed, Coolant Temperature) exposed as separate calculation functions.',
  'protocol.obd.calculator.engineRpm.description':
    'RPM = (A×256+B)/4 — spec summary §04 fixture: A=0x1A, B=0xF8 → 1726 rpm.',
  'protocol.obd.calculator.vehicleSpeed.description': 'Speed = A km/h.',
  'protocol.obd.calculator.coolantTemperature.description': 'T = A − 40 °C.',
  'protocol.obd.example.currentDataRequest.name': 'Mode 01 request',
  'protocol.obd.example.currentDataRequest.description':
    'Current Data mode; the PID byte is illustrative and stays a raw parameter.',
  'protocol.obd.example.engineRpmResponse.name': 'Engine RPM response (spec summary §04)',
  'protocol.obd.example.engineRpmResponse.description':
    '41 0C 1A F8 — the spec’s fixture: Raw 1A F8, 1726 rpm via decodeEngineRpm.',
  'protocol.obd.example.storedDtcRequest.name': 'Mode 03 request',
  'protocol.obd.example.storedDtcRequest.description':
    'Stored DTC mode; requires no PID, a single-byte request.',
  'protocol.obd.example.vehicleInformationRequest.name': 'Mode 09 request',
  'protocol.obd.example.vehicleInformationRequest.description':
    'Vehicle Information mode; the InfoType byte stays a raw parameter.',
  'protocol.obd.example.unknownMode.name': 'Unrecognized mode',
  'protocol.obd.example.unknownMode.description':
    'The mode is not in the table: the field is marked invalid but the frame is still shown.',

  // --- AT Commands (ITU-T V.250 / 3GPP TS 27.007, generic engine) ---
  'protocol.atCommands.documentation.summary':
    'Generic framing for the ITU-T V.250 / 3GPP TS 27.007 text command family: command/response separation, URC stream, final result codes. The cellular vocabulary (CSQ/COPS/CREG…) is NOT here, it lives in lte-modem-at.',
  'protocol.atCommands.error.emptyLine': 'An empty line cannot be parsed.',
  'protocol.atCommands.error.frameTooLong': 'The line exceeds the allowed maximum length.',
  'protocol.atCommands.error.aborted': 'Parsing was aborted.',
  'protocol.atCommands.warning.mixedCasePrefix':
    'The AT prefix has mixed case ("At"/"aT") — V.250 only recognizes "AT" or "at", though most modems accept it anyway.',
  'protocol.atCommands.example.commandExecute.name': 'Execute command',
  'protocol.atCommands.example.commandExecute.description':
    'A parameterless extended command — queries signal quality.',
  'protocol.atCommands.example.commandRead.name': 'Read command (?)',
  'protocol.atCommands.example.commandRead.description':
    'Reads network registration status; a trailing `?` is the read action.',
  'protocol.atCommands.example.commandTest.name': 'Test command (=?)',
  'protocol.atCommands.example.commandTest.description':
    'Queries the supported parameter set; a trailing `=?` is the test action.',
  'protocol.atCommands.example.commandSet.name': 'Set command (=<params>)',
  'protocol.atCommands.example.commandSet.description':
    'Switches SMS text mode on; the `=1` parameter is carried in its own field.',
  'protocol.atCommands.example.commandBare.name': 'Bare AT',
  'protocol.atCommands.example.commandBare.description':
    'A connectivity check — no command name/action, just the `command` kind.',
  'protocol.atCommands.example.commandMixedCase.name': 'Mixed-case prefix',
  'protocol.atCommands.example.commandMixedCase.description':
    'The "At" prefix stays valid but raises a warning — V.250 only recognizes "AT"/"at".',
  'protocol.atCommands.example.informationResponse.name': 'Information response',
  'protocol.atCommands.example.informationResponse.description':
    'The `+NAME: params` shape — which command it belongs to needs session context.',
  'protocol.atCommands.example.finalResultOk.name': 'OK',
  'protocol.atCommands.example.finalResultOk.description':
    'A bare V.250 §6.3.1 final result code — the command completed successfully.',
  'protocol.atCommands.example.finalResultError.name': 'ERROR',
  'protocol.atCommands.example.finalResultError.description':
    'A bare V.250 §6.3.1 final result code — the command was rejected.',
  'protocol.atCommands.example.finalResultCmeNumeric.name': '+CME ERROR (numeric)',
  'protocol.atCommands.example.finalResultCmeNumeric.description':
    'A numeric error code under AT+CMEE=1 — the MEANING of the code is not decoded, only its structure.',
  'protocol.atCommands.example.finalResultCmeVerbose.name': '+CME ERROR (verbose)',
  'protocol.atCommands.example.finalResultCmeVerbose.description':
    'A text error description under AT+CMEE=2 — same syntax, different rendering.',
  'protocol.atCommands.example.finalResultCms.name': '+CMS ERROR',
  'protocol.atCommands.example.finalResultCms.description':
    'The messaging/SMS-specific error code family — carried under its own field name, separate from CME.',
  'protocol.atCommands.example.connectWithRate.name': 'CONNECT (with rate)',
  'protocol.atCommands.example.connectWithRate.description':
    'The connection rate is split into its own numeric sub-field (bit/s unit).',
  'protocol.atCommands.example.prompt.name': 'Data entry prompt (>)',
  'protocol.atCommands.example.prompt.description':
    'The data-entry wait marker that follows commands such as AT+CMGS.',
  'protocol.atCommands.example.bannerText.name': 'Free text (banner)',
  'protocol.atCommands.example.bannerText.description':
    'Manufacturer/banner text that matches no known pattern — not treated as an error.',

  // --- Hayes Command Set (V.250 basic syntax, layered on top of at-commands) ---
  'protocol.hayesCommandSet.documentation.summary':
    'Hayes’s original BASIC command syntax (ATD/ATA/ATH/ATZ, S-registers, +++ escape) — layered on top of at-commands. Numeric result codes (ATV0) live in at-commands instead, shared across every AT dialect.',
  'protocol.hayesCommandSet.warning.hookParameterUndocumented':
    'ATH parameter is not 0 — "off-hook" (H1) could not be confirmed in any source, its meaning is not assumed.',
  'protocol.hayesCommandSet.warning.resetParameterVendorSpecific':
    'The meaning of the ATZ parameter (profile index) is not defined by V.250 — the spec’s own wording calls it "manufacturer-specific".',
  'protocol.hayesCommandSet.warning.dialStringUnknownChar':
    'The dial string contains a character outside V.250’s allowed set (0-9 A-D # * + , " T P W @ !).',
  'protocol.hayesCommandSet.warning.sRegisterVendorOnly':
    'This S-register is not defined by V.250 — only u-blox documents it.',
  'protocol.hayesCommandSet.warning.sRegisterValueOutOfRange':
    'The written value falls outside the documented range for this register.',
  'protocol.hayesCommandSet.warning.unparsedBasicSyntax':
    'Trailing text that matches none of the basic-syntax patterns — left unparsed, raw.',
  'protocol.hayesCommandSet.warning.sRegisterResponseAmbiguous':
    'A three-digit zero-padded response COULD be an S-register read, but cannot be confirmed without session context.',
  'protocol.hayesCommandSet.example.chainedResetEchoVerbose.name': 'Chained basic commands',
  'protocol.hayesCommandSet.example.chainedResetEchoVerbose.description':
    'Z, E0, V1 back-to-back with no separator — V.250’s standard chaining rule.',
  'protocol.hayesCommandSet.example.dialWithReturn.name': 'Dial + return to command mode',
  'protocol.hayesCommandSet.example.dialWithReturn.description':
    'A dial string ending in ";" returns to command mode, then H0 (hang up) continues the chain.',
  'protocol.hayesCommandSet.example.dialTonePrefixNoReturn.name': 'Tone-prefixed dial (no ";")',
  'protocol.hayesCommandSet.example.dialTonePrefixNoReturn.description':
    'The "T" prefix is carried as opaque text — its tone/pulse meaning was not confirmed this round. With no ";", the dial string runs to the end of the line.',
  'protocol.hayesCommandSet.example.answer.name': 'Answer (A)',
  'protocol.hayesCommandSet.example.answer.description':
    'Parameterless, swallows the rest of the line — V.250’s own example.',
  'protocol.hayesCommandSet.example.hookHangUp.name': 'Hang up (H0)',
  'protocol.hayesCommandSet.example.hookHangUp.description':
    'Only H0 is documented across every source — "hang up".',
  'protocol.hayesCommandSet.example.hookUndocumentedParam.name': 'Undocumented H parameter (H1)',
  'protocol.hayesCommandSet.example.hookUndocumentedParam.description':
    'The "off-hook" meaning could not be confirmed in any source — structure is decoded, meaning is not invented.',
  'protocol.hayesCommandSet.example.sRegisterWriteKnown.name': 'Known register write (S0)',
  'protocol.hayesCommandSet.example.sRegisterWriteKnown.description':
    'Auto-answer ring count — V.250 §6.3.8, range 0-255.',
  'protocol.hayesCommandSet.example.sRegisterReadKnown.name': 'Known register read (S3?)',
  'protocol.hayesCommandSet.example.sRegisterReadKnown.description':
    'Line termination character query — the response comes back three digits, zero-padded.',
  'protocol.hayesCommandSet.example.sRegisterWriteVendorOnly.name': 'Vendor-only register (S12)',
  'protocol.hayesCommandSet.example.sRegisterWriteVendorOnly.description':
    'Guard time, documented only by u-blox — 1 unit = 20ms, converted to milliseconds here.',
  'protocol.hayesCommandSet.example.sRegisterWriteOutOfRange.name': 'Out-of-range value (S0=300)',
  'protocol.hayesCommandSet.example.sRegisterWriteOutOfRange.description':
    'S0’s documented range is 0-255 — 300 falls outside it, producing a warning.',
  'protocol.hayesCommandSet.example.sRegisterWriteUnverified.name': 'Unverified register (S5)',
  'protocol.hayesCommandSet.example.sRegisterWriteUnverified.description':
    'V.250 counts S5 among its registers, but this round’s research did not confirm its meaning — structure is decoded, no name is invented.',
  'protocol.hayesCommandSet.example.sRegisterResponseCandidate.name': 'S-register response (candidate)',
  'protocol.hayesCommandSet.example.sRegisterResponseCandidate.description':
    'A bare three-digit zero-padded line — cannot be confirmed as an S-register response without session context.',
  'protocol.hayesCommandSet.example.numericResultCode.name': 'Numeric result code (ATV0)',
  'protocol.hayesCommandSet.example.numericResultCode.description':
    'Inherited from at-commands’ numeric result code support — hayes gains it without writing any extra code.',

  // --- SLIP (RFC 1055, thin wrapper over the framing engine) ---
  'protocol.slip.documentation.summary':
    'RFC 1055 — wraps IP datagrams on a serial line with END and ESC bytes only; deliberately carries no addressing, length or integrity check. The framing engine (Faz 6) already cuts and decodes it — this page is just the display layer.',
  'protocol.slip.error.emptyFrame': 'An empty frame cannot be parsed.',
  'protocol.slip.error.noDelimiter': 'No END (0xC0) byte found in the buffer — frame incomplete.',
  'protocol.slip.error.aborted': 'Parsing was aborted.',
  'protocol.slip.warning.trailingBytes':
    'Bytes remain after the frame — shown in a separate field, not yet parsed.',
  'protocol.slip.example.escapedPayload.name': 'Escaped payload (END + ESC)',
  'protocol.slip.example.escapedPayload.description':
    'The payload carries both an END (0xC0) and an ESC (0xDB) byte — both get escaped, shown as separate fields.',
  'protocol.slip.example.leadingEndMarker.name': 'Leading optional END',
  'protocol.slip.example.leadingEndMarker.description':
    'RFC 1055’s line-noise flush marker — skipped before the frame search begins.',
  'protocol.slip.example.noEscaping.name': 'Data needing no escaping',
  'protocol.slip.example.noEscaping.description':
    'The payload carries no special byte (0xC0/0xDB) — the encoded form passes through unchanged.',

  // --- COBS (thin wrapper over the framing engine) ---
  'protocol.cobs.documentation.summary':
    'Encodes a chosen byte value (0x00) completely out of the data in a reversible way — worst case one extra byte per 254. The framing engine (Faz 6) already decodes the code bytes — this page is just the display layer.',
  'protocol.cobs.error.emptyFrame': 'An empty frame cannot be parsed.',
  'protocol.cobs.error.noDelimiter': 'No delimiter (0x00) byte found in the buffer — frame incomplete.',
  'protocol.cobs.error.aborted': 'Parsing was aborted.',
  'protocol.cobs.warning.trailingBytes':
    'Bytes remain after the frame — shown in a separate field, not yet parsed.',
  'protocol.cobs.example.zeroInMiddle.name': 'Zero in the middle (spec fixture)',
  'protocol.cobs.example.zeroInMiddle.description':
    'The payload carries a 0x00 partway through — encoded as two code bytes, one of which restores the zero.',
  'protocol.cobs.example.singleZero.name': 'Single zero byte',
  'protocol.cobs.example.singleZero.description':
    'The smallest possible COBS input — a lone 0x00 byte, encoded as two code bytes.',
  'protocol.cobs.example.noZeroBytes.name': 'Data with no zero bytes',
  'protocol.cobs.example.noZeroBytes.description':
    'The payload carries no 0x00 at all — encoded as a single block with one code byte.',

  // --- KISS (TAPR/AX.25 TNC interface protocol, thin wrapper over the framing engine) ---
  'protocol.kiss.documentation.summary':
    'Minimal FEND (0xC0) delimited framing between a computer and a packet-radio TNC — the bytes are IDENTICAL to SLIP. The payload is normally an AX.25 frame, which this engine does not decode (v1 scope).',
  'protocol.kiss.error.emptyFrame': 'An empty frame cannot be parsed.',
  'protocol.kiss.error.noDelimiter': 'No FEND (0xC0) byte found in the buffer — frame incomplete.',
  'protocol.kiss.error.aborted': 'Parsing was aborted.',
  'protocol.kiss.warning.trailingBytes':
    'Bytes remain after the frame — shown in a separate field, not yet parsed.',
  'protocol.kiss.warning.unknownCommand':
    'Unknown or reserved command nibble (7-14) — not defined by the TAPR spec.',
  'protocol.kiss.example.dataFrame.name': 'Data Frame (command 0)',
  'protocol.kiss.example.dataFrame.description':
    'Port 0, Data Frame command — the payload is assumed to be an AX.25 frame, not decoded by this engine.',
  'protocol.kiss.example.txdelayCommand.name': 'TXDELAY command',
  'protocol.kiss.example.txdelayCommand.description':
    'Port 0, TXDELAY command — the parameter byte is converted from 10ms units to milliseconds.',
  'protocol.kiss.example.escapedDataFrame.name': 'Escaped Data Frame (FEND + FESC)',
  'protocol.kiss.example.escapedDataFrame.description':
    'The payload carries both a FEND (0xC0) and a FESC (0xDB) byte — escaped using the exact same rule as SLIP.',

  // --- PPP (RFC 1661/1662, thin wrapper over the framing engine) ---
  'protocol.ppp.documentation.summary':
    'RFC 1661 — carries several network-layer protocols over a single point-to-point link, negotiated by LCP, framed HDLC-style with 0x7D escaping. The framing engine (Faz 6) already cuts and decodes it; this page adds Address/Control/Protocol demux and the LCP packet header.',
  'protocol.ppp.error.emptyFrame': 'An empty frame cannot be parsed.',
  'protocol.ppp.error.noDelimiter': 'No Flag (0x7E) byte found in the buffer — frame incomplete.',
  'protocol.ppp.error.aborted': 'Parsing was aborted.',
  'protocol.ppp.error.noProtocolField': 'Not enough bytes for a Protocol field after Address/Control.',
  'protocol.ppp.warning.trailingBytes':
    'Bytes remain after the frame — shown in a separate field, not yet parsed.',
  'protocol.ppp.warning.unknownLcpOption': 'Unknown LCP option type — shown as raw data.',
  'protocol.ppp.warning.malformedLcpOptions':
    'The LCP option chain is malformed (a Length field does not match the remaining data) — the remainder is shown raw.',
  'protocol.ppp.example.lcpConfigureRequest.name': 'LCP Configure-Request (MRU option)',
  'protocol.ppp.example.lcpConfigureRequest.description':
    'LCP Configure-Request over standard Address/Control — a single option: Maximum-Receive-Unit = 1500 bytes.',
  'protocol.ppp.example.escapedInformation.name': 'Escaped Information (0x7E)',
  'protocol.ppp.example.escapedInformation.description':
    'The IPv4 payload carries a 0x7E byte — encoded with the exact same async escaping as HDLC (0x7D + XOR 0x20).',
  'protocol.ppp.example.compressedFields.name': 'ACFC + PFC (compressed fields)',
  'protocol.ppp.example.compressedFields.description':
    'Address/Control omitted (ACFC), Protocol compressed to a single byte (PFC) — both at once.',

  // --- HDLC (ISO/IEC 13239 basic mode, thin wrapper over hdlcCore.ts) ---
  'protocol.hdlc.documentation.summary':
    'ISO/IEC 13239 (Q.921 basic mode) — bit-oriented data-link framing with a 0x7E flag, five-ones bit stuffing and an I/S/U control field, forming the base of PPP, SDLC and many telecom links. The decode tab already receives a bit-destuffed byte sequence — bit stuffing and synchronous capture are out of scope for this wave.',
  'protocol.hdlc.error.emptyFrame': 'An empty frame cannot be parsed.',
  'protocol.hdlc.error.noDelimiter': 'No Flag (0x7E) byte found in the buffer — frame incomplete.',
  'protocol.hdlc.error.aborted': 'Parsing was aborted.',
  'protocol.hdlc.error.tooShort': 'Content is shorter than the Address+Control+FCS minimum (4 bytes).',
  'protocol.hdlc.error.fcsMismatch': 'FCS mismatch — the frame may have been corrupted in transit.',
  'protocol.hdlc.warning.trailingBytes':
    'Bytes remain after the frame — shown in a separate field, not yet parsed.',
  'protocol.hdlc.example.iFrame.name': 'I-frame (sequenced data)',
  'protocol.hdlc.example.iFrame.description':
    'An Information frame carrying N(S)=1, N(R)=2, P/F=0 — the FCS is validated.',
  'protocol.hdlc.example.sFrame.name': 'S-frame (RR)',
  'protocol.hdlc.example.sFrame.description':
    'A Supervisory frame carrying RR (Receive Ready), N(R)=3, P/F=1 — no Information field.',
  'protocol.hdlc.example.uFrame.name': 'U-frame (unnamed command)',
  'protocol.hdlc.example.uFrame.description':
    'Unnumbered format — command bits are not named in this wave (see file header), only format and FCS are shown.',

  // --- SDLC (identical to hdlcCore.ts, Address field is named Station Address) ---
  'protocol.sdlc.documentation.summary':
    'IBM synchronous bit-oriented predecessor of HDLC, built around station addressing and primary/secondary poll/final signalling. The frame shape is identical to HDLC (shares hdlcCore.ts) — only the Address field is interpreted as a Station Address.',
  'protocol.sdlc.error.emptyFrame': 'An empty frame cannot be parsed.',
  'protocol.sdlc.error.noDelimiter': 'No Flag (0x7E) byte found in the buffer — frame incomplete.',
  'protocol.sdlc.error.aborted': 'Parsing was aborted.',
  'protocol.sdlc.error.tooShort': 'Content is shorter than the Station Address+Control+FCS minimum (4 bytes).',
  'protocol.sdlc.error.fcsMismatch': 'FCS mismatch — the frame may have been corrupted in transit.',
  'protocol.sdlc.warning.trailingBytes':
    'Bytes remain after the frame — shown in a separate field, not yet parsed.',
  'protocol.sdlc.example.iFrame.name': 'I-frame (sequenced data)',
  'protocol.sdlc.example.iFrame.description':
    'An Information frame carrying N(S)=1, N(R)=2, P/F=0 — the FCS is validated.',
  'protocol.sdlc.example.poll.name': 'Poll (broadcast address, RR)',
  'protocol.sdlc.example.poll.description':
    'Station Address=0xFF (All-Stations), RR with P/F=1 — an example primary-station poll.',
  'protocol.sdlc.example.uFrame.name': 'U-frame (unnamed command)',
  'protocol.sdlc.example.uFrame.description':
    'Unnumbered format — command bits are not named in this wave (see file header), only format and FCS are shown.',

  // --- XMODEM (never touches the framing engine, thin wrapper over xmodemCore.ts) ---
  'protocol.xmodem.documentation.summary':
    'Stop-and-wait serial file transfer — 128- or 1024-byte blocks, block-number complement checking, checksum (SUM-8) or CRC-16 (CRC16_XMODEM) mode, NAK-driven retransmission. Never touches the framing engine — the frame boundary is derived from the fixed data length carried by the Header byte itself.',
  'protocol.xmodem.error.emptyFrame': 'An empty frame cannot be parsed.',
  'protocol.xmodem.error.unknownHeader':
    'Unknown Header/control byte — not SOH (0x01), STX (0x02), or a recognized control byte (EOT/ACK/NAK/CAN).',
  'protocol.xmodem.error.badTrailerLength':
    'Frame length is consistent with neither checksum (1 byte) nor CRC (2 byte) mode.',
  'protocol.xmodem.error.aborted': 'Parsing was aborted.',
  'protocol.xmodem.error.complementMismatch': 'Block number complement (~Block) does not match.',
  'protocol.xmodem.error.checksumMismatch': 'Checksum mismatch — the frame may have been corrupted in transit.',
  'protocol.xmodem.error.crcMismatch': 'CRC mismatch — the frame may have been corrupted in transit.',
  'protocol.xmodem.example.checksumBlock.name': 'Checksum mode (128 bytes)',
  'protocol.xmodem.example.checksumBlock.description': 'Block 1 with SUM-8 checksum — the standard 128-byte block.',
  'protocol.xmodem.example.crcBlock1k.name': 'CRC-16 mode, XMODEM-1K (1024 bytes)',
  'protocol.xmodem.example.crcBlock1k.description':
    'Block 2 with CRC-16 (CRC16_XMODEM) — the STX-headed extended 1024-byte block.',
  'protocol.xmodem.example.eot.name': 'EOT (end of transmission)',
  'protocol.xmodem.example.eot.description': 'A single-byte control signal — the sender announces the transfer is complete.',

  // --- YMODEM (identical to xmodemCore.ts, Block 0 is named as batch metadata) ---
  'protocol.ymodem.documentation.summary':
    'An extended XMODEM — adds a Block 0 metadata header carrying the filename and size, allowing multiple files (a batch) to transfer in one session. The block shape is identical to XMODEM (the core is shared).',
  'protocol.ymodem.error.emptyFrame': 'An empty frame cannot be parsed.',
  'protocol.ymodem.error.unknownHeader':
    'Unknown Header/control byte — not SOH (0x01), STX (0x02), or a recognized control byte (EOT/ACK/NAK/CAN).',
  'protocol.ymodem.error.badTrailerLength':
    'Frame length is consistent with neither checksum (1 byte) nor CRC (2 byte) mode.',
  'protocol.ymodem.error.aborted': 'Parsing was aborted.',
  'protocol.ymodem.error.complementMismatch': 'Block number complement (~Block) does not match.',
  'protocol.ymodem.error.checksumMismatch': 'Checksum mismatch — the frame may have been corrupted in transit.',
  'protocol.ymodem.error.crcMismatch': 'CRC mismatch — the frame may have been corrupted in transit.',
  'protocol.ymodem.example.blockZeroMetadata.name': 'Block 0 (filename + size)',
  'protocol.ymodem.example.blockZeroMetadata.description':
    'The first block of a batch — carries the filename and size; the mtime/mode field is not decoded in this wave.',
  'protocol.ymodem.example.batchTerminator.name': 'Batch terminator (empty filename)',
  'protocol.ymodem.example.batchTerminator.description':
    'Block 0 with an empty filename — signals no more files remain in the session.',
  'protocol.ymodem.example.dataBlock.name': 'Data block (same as XMODEM)',
  'protocol.ymodem.example.dataBlock.description': 'Block 1 — regular file content, identical in shape to XMODEM itself.',

  // --- ZMODEM (lrzsz profile — shares nothing wire-level with XMODEM/YMODEM) ---
  'protocol.zmodem.documentation.summary':
    'A file transfer protocol entirely unlike XMODEM/YMODEM, offering streaming and position-based error recovery. Exchanges ZRQINIT/ZRINIT/ZFILE/ZRPOS/ZDATA/ZEOF/ZFIN headers via ZDLE escaping. No single canonical definition exists — the lrzsz (Forsberg) profile is decoded.',
  'protocol.zmodem.error.aborted': 'Parsing was aborted.',
  'protocol.zmodem.error.emptyFrame': 'An empty frame cannot be parsed.',
  'protocol.zmodem.error.noZdle': 'No ZDLE (0x18) found after ZPAD — header start not recognized.',
  'protocol.zmodem.error.unsupportedHeaderType':
    'RLE header variant (ZBINR32/ZVBIN/ZVHEX/ZVBIN32/ZVBINR32) — an lrzsz 1993 extension, not supported in the selected profile.',
  'protocol.zmodem.error.unknownHeaderType': 'Unknown header-form byte — not ZBIN (A), ZHEX (B), or ZBIN32 (C).',
  'protocol.zmodem.error.truncatedFrame': 'Frame ended before the header/subpacket was complete.',
  'protocol.zmodem.error.invalidEscape': 'Unrecognized byte after ZDLE — neither a valid escape nor a terminator.',
  'protocol.zmodem.error.invalidHexDigit': 'Invalid digit in HEX header — only lowercase 0-9a-f is accepted.',
  'protocol.zmodem.error.unknownFrameType': 'Unknown frame type — not between ZRQINIT (0) and ZSTDERR (19).',
  'protocol.zmodem.error.headerCrcMismatch': 'Header CRC mismatch — the frame may have been corrupted in transit.',
  'protocol.zmodem.error.subpacketCrcMismatch': 'Subpacket CRC mismatch — the data may have been corrupted in transit.',
  'protocol.zmodem.warning.incompleteSubpacket':
    'No subpacket terminator (ZCRCE/G/Q/W) or CRC found — the input may have been pasted partially.',
  'protocol.zmodem.example.zrqinitHex.name': 'ZRQINIT (HEX header)',
  'protocol.zmodem.example.zrqinitHex.description': 'Session-init request, in HEX form — no escaping, human-readable ASCII hex.',
  'protocol.zmodem.example.zrinitBinary.name': 'ZRINIT (binary16, CANFDX+CANOVIO+CANFC32)',
  'protocol.zmodem.example.zrinitBinary.description':
    'Announces receiver capabilities — full duplex, overlapped I/O, and 32-bit CRC support flags set.',
  'protocol.zmodem.example.zfileWithSubpacket.name': 'ZFILE + subpacket (filename + size)',
  'protocol.zmodem.example.zfileWithSubpacket.description':
    'Start of a file transfer — the subpacket content is in the same format as YMODEM Block 0 (spec §13).',
  'protocol.zmodem.example.zdataBinary32.name': 'ZDATA (binary32, 32-bit CRC session)',
  'protocol.zmodem.example.zdataBinary32.description': 'A streaming data frame — Position field is 5,242,880, subpacket protected with a 32-bit CRC.',

  // --- Custom Binary Protocol (first of the 4 "generic" pages — specFixture.ts verbatim) ---
  'protocol.customBinaryProtocol.documentation.summary':
    'Vendor-specific binary frame format — header, address, command, length, payload and CRC. Uses the ALP Sensor Protocol schema, cross-verified across spec §8.3/§9.6/§43.',
  'protocol.customBinaryProtocol.example.sensorData.name': 'Sensor Data (spec §43 acceptance frame)',
  'protocol.customBinaryProtocol.example.sensorData.description':
    'Address=5, Command=Sensor Data, Payload=34 12 7F, Checksum (XOR8) PASS.',
  'protocol.customBinaryProtocol.example.checksumMismatch.name': 'Checksum mismatch',
  'protocol.customBinaryProtocol.example.checksumMismatch.description':
    'The same frame with only the checksum byte corrupted (0x4F → 0x50) — the same vector used in DecodePanel.test.tsx.',

  // --- ASCII Protocol (second of the 4 "generic" pages) ---
  'protocol.asciiProtocol.documentation.summary':
    'A human-readable, line-oriented serial protocol class — CR/LF termination and command/parameter separation. Comma-separated numeric field parsing is not supported at the engine level, it stays raw text.',
  'protocol.asciiProtocol.example.temperatureReading.name': 'Temperature reading (spec summary line 57)',
  'protocol.asciiProtocol.example.temperatureReading.description':
    '"TEMP,25.3,40.2\\r\\n" — command TEMP, parameters as raw text, CRLF in its own field.',
  'protocol.asciiProtocol.example.missingLineEnding.name': 'Missing CRLF',
  'protocol.asciiProtocol.example.missingLineEnding.description':
    'The same line with the terminator CUT OFF — shows the spec summary\'s "Missing CR/LF" case.',

  // --- Delimiter-Based Protocol (third of the 4 "generic" pages — Faz 6's hdlc-flag engine, verbatim) ---
  'protocol.delimiterBasedProtocol.documentation.summary':
    'Framing via start/end marker bytes such as STX/ETX — the real work is handling escaping when the delimiter value also appears inside the payload (delimiter collision). Reuses Faz 6\'s hdlc-flag engine (the same one PPP uses).',
  'protocol.delimiterBasedProtocol.error.aborted': 'Parsing was aborted.',
  'protocol.delimiterBasedProtocol.error.incomplete': 'Frame incomplete — no closing flag (0x7E) found.',
  'protocol.delimiterBasedProtocol.example.collisionEscaped.name': 'Delimiter collision (escaped)',
  'protocol.delimiterBasedProtocol.example.collisionEscaped.description':
    'The payload (01 7E 02) contains a 0x7E that collides with the flag byte — matches the spec summary\'s "Escape Example" (01 7E 02 → 01 7D 5E 02) exactly.',
  'protocol.delimiterBasedProtocol.example.missingEndFlag.name': 'Missing closing flag',
  'protocol.delimiterBasedProtocol.example.missingEndFlag.description':
    'An opening flag but no closing one — shows a frame cut off mid-stream.',

  // --- Length-Based Protocol (fourth of the 4 "generic" pages) ---
  'protocol.lengthBasedProtocol.documentation.summary':
    'Frame length is driven by a field inside the header — length semantics, endianness, and a maximum-frame guard. LENGTH (uint16 big-endian) + PAYLOAD + CHECKSUM (XOR8), an independently computed fixture.',
  'protocol.lengthBasedProtocol.example.validFrame.name': 'Valid frame',
  'protocol.lengthBasedProtocol.example.validFrame.description':
    'LENGTH=4 (big-endian) + PAYLOAD (AA BB CC DD) + CHECKSUM — computed independently: XOR8(AA,BB,CC,DD)=0x00.',
  'protocol.lengthBasedProtocol.example.oversizedLength.name': 'Length field inconsistent with wire content',
  'protocol.lengthBasedProtocol.example.oversizedLength.description':
    'LENGTH says 1000 but the wire carries only 1 byte of payload — shows the "declared length exceeds available data" case.',

  // --- LTE Modem AT (3GPP TS 27.007 cellular vocabulary, on top of at-commands) ---
  'protocol.lteModemAt.documentation.summary':
    '3GPP TS 27.007 cellular AT command vocabulary: CSQ/COPS/CREG/CEREG/CGATT/CGDCONT/CIMI/CGSN/CCLK/CPIN. Reject-cause meaning, model/firmware and band are NOT in this engine — their source commands are out of scope.',
  'protocol.lteModemAt.warning.csqUnknown': 'Value is 99 — signal could not be measured or detected.',
  'protocol.lteModemAt.warning.accessTechnologyVendorCollision':
    'AcT value is 8 or higher — vendor firmware in this range may use extensions that COLLIDE with the official TS 27.007 table (e.g. SIMCom uses 8=CDMA/HDR while the spec defines 8=EC-GSM-IoT). Check the device’s own AT command manual to be sure.',
  'protocol.lteModemAt.warning.pdpTypeObsolete':
    'This PDP type is marked "Obsolete" in the current spec text — still listed, but not expected on new deployments.',
  'protocol.lteModemAt.warning.cgdcontTailNotDecoded':
    'Everything after the first six parameters (cid..h_comp) varies by vendor/release — not decoded as a fixed schema, left raw.',
  'protocol.lteModemAt.warning.cpinUnrecognizedCode':
    'Not in TS 27.007’s 16-code list — likely a vendor-specific status code.',
  'protocol.lteModemAt.warning.bareIdentifierAmbiguous':
    'An unprefixed bare digit string: could be an AT+CIMI (IMSI) or bare AT+CGSN (IMEI/serial) response — which one it is CANNOT be determined from a single line, it needs session context that knows which command was sent.',
  'protocol.lteModemAt.warning.sensitiveExportValue':
    'This value is a device/subscriber identifier — masking it on export is recommended.',
  'protocol.lteModemAt.example.csq.name': 'Signal quality (CSQ)',
  'protocol.lteModemAt.example.csq.description':
    'RSSI is converted to dBm; BER stays an ordinal class, never a percentage (vendor tables disagree).',
  'protocol.lteModemAt.example.copsAlphanumeric.name': 'Operator info (alphanumeric)',
  'protocol.lteModemAt.example.copsAlphanumeric.description':
    'Long alphanumeric operator name; access technology decodes to E-UTRAN.',
  'protocol.lteModemAt.example.copsNumericActCollision.name': 'Operator info (numeric, AcT collision warning)',
  'protocol.lteModemAt.example.copsNumericActCollision.description':
    'MCC/MNC split plus the vendor-collision warning for AcT=8 — MCC 901 is not assigned to any real country, chosen for illustration.',
  'protocol.lteModemAt.example.cregRegistered.name': 'Registration status (CREG, home network)',
  'protocol.lteModemAt.example.cregRegistered.description':
    'LAC and cell ID are converted from hex to decimal; access technology is E-UTRAN.',
  'protocol.lteModemAt.example.ceregEmergency.name': 'LTE registration status (CEREG, emergency only)',
  'protocol.lteModemAt.example.ceregEmergency.description':
    'The field is named TAC (unlike CREG’s LAC); AcT=9 indicates NB-IoT.',
  'protocol.lteModemAt.example.cgattAttached.name': 'PS attach state (CGATT)',
  'protocol.lteModemAt.example.cgattAttached.description': 'A simple boolean state — attached or not.',
  'protocol.lteModemAt.example.cgdcontFull.name': 'PDP context (CGDCONT)',
  'protocol.lteModemAt.example.cgdcontFull.description':
    'The six fixed fields are decoded; an empty PDP address is skipped without producing a field (vendors disagree on this behavior).',
  'protocol.lteModemAt.example.cimiBare.name': 'IMSI query (CIMI, unprefixed)',
  'protocol.lteModemAt.example.cimiBare.description':
    'The Quectel EC25/EC21 manual’s own worked example — an unprefixed bare digit string, indistinguishable from CGSN’s bare form.',
  'protocol.lteModemAt.example.cgsnBare.name': 'Serial number (CGSN, unprefixed)',
  'protocol.lteModemAt.example.cgsnBare.description':
    '3GPP TS 27.007’s own §5.4 example — an unprefixed bare digit string, indistinguishable from CIMI.',
  'protocol.lteModemAt.example.cgsnPrefixed.name': 'Serial number (CGSN=1, DEFINITE IMEI)',
  'protocol.lteModemAt.example.cgsnPrefixed.description':
    'The prefixed form — unambiguous, decodes directly as IMEI and carries the sensitive-value warning.',
  'protocol.lteModemAt.example.cclk.name': 'Real-time clock (CCLK)',
  'protocol.lteModemAt.example.cclk.description':
    'The timezone is in QUARTER-HOUR units — "+08" means two hours, not four (verified against the spec’s own example).',
  'protocol.lteModemAt.example.cpinReady.name': 'SIM status (ready)',
  'protocol.lteModemAt.example.cpinReady.description': 'No PIN required, the SIM is ready to use.',
  'protocol.lteModemAt.example.cpinLocked.name': 'SIM status (PIN pending)',
  'protocol.lteModemAt.example.cpinLocked.description': 'A known status from the standard 16-code list.',
  'protocol.lteModemAt.example.finalOk.name': 'OK',
  'protocol.lteModemAt.example.finalOk.description':
    'A final result code carried over verbatim from at-commands — stays consistent on this page too.',

  // --- Cellular Initialization Dashboard (same class of work as Karar 6, wave 9) ---
  'cellularDashboard.heading': 'Cellular Initialization Dashboard',
  'cellularDashboard.sessionInput.label': 'AT session (multi-line — command and response lines)',
  'cellularDashboard.linesProcessed': '{count} lines recognized',
  'cellularDashboard.empty': 'No recognizable cellular status field came out of the input.',
  'cellularDashboard.field.imei': 'IMEI',
  'cellularDashboard.field.numericIdentifierCandidate': 'Numeric identifier (IMSI/IMEI ambiguous)',
  'cellularDashboard.field.simStatus': 'SIM status',
  'cellularDashboard.field.operatorName': 'Operator',
  'cellularDashboard.field.operatorSelectionMode': 'Operator selection mode',
  'cellularDashboard.field.accessTechnology': 'Access technology (RAT)',
  'cellularDashboard.field.registrationStatus': 'Registration status',
  'cellularDashboard.field.pdpAddress': 'PDP / IP address',

  // --- NB-IoT (on top of lte-modem-at: AcT=9 detection + PSM/eDRX timers) ---
  'protocol.nbIot.documentation.summary':
    'NB-IoT interpretation layer on top of lte-modem-at: AcT=9 detection, PSM (AT+CPSMS, T3412/T3324) and eDRX (AT+CEDRXS/CEDRXRDP/CEDRXP, NB-S1 mode only) timer decoding.',
  'protocol.nbIot.warning.accessTechnologyNotNbIot':
    'Access technology is NOT AcT=9 (E-UTRAN NB-S1 mode) — this line may not reflect an NB-IoT context.',
  'protocol.nbIot.warning.timerMalformed':
    'An 8-digit binary string was expected, the value does not match that shape — unit/value could not be parsed, left raw.',
  'protocol.nbIot.warning.timerUnitReserved':
    'This unit code is not defined in the TS 24.008 table (reserved) — not converted to seconds, the raw value is carried.',
  'protocol.nbIot.warning.edrxMalformed':
    'A 4-digit binary string was expected, the value does not match that shape — cycle length could not be parsed, left raw.',
  'protocol.nbIot.warning.edrxCodeReserved':
    'This eDRX code is not defined in the TS 24.008 table (reserved) — not converted to seconds, the raw value is carried.',
  'protocol.nbIot.warning.edrxNotNbS1':
    'This value arrived for an access technology other than NB-S1 mode (AcT_type=5) — that mode’s eDRX table is not verified in this engine, not converted to seconds.',
  'protocol.nbIot.example.ceregNbIot.name': 'NB-IoT registration status (CEREG, AcT=9)',
  'protocol.nbIot.example.ceregNbIot.description':
    'Access technology is E-UTRAN (NB-S1 mode) — the NB-IoT match is confirmed, no warning.',
  'protocol.nbIot.example.ceregNotNbIot.name': 'Non-NB-IoT registration status (CEREG, AcT=7)',
  'protocol.nbIot.example.ceregNotNbIot.description':
    'Same CEREG response but AcT=7 (plain E-UTRAN) — the match field carries a "not NB-IoT" warning.',
  'protocol.nbIot.example.cpsmsEnabled.name': 'PSM enabled (CPSMS, T3412=40min, T3324=30s)',
  'protocol.nbIot.example.cpsmsEnabled.description':
    'The Quectel BG96 manual’s own example — periodic TAU and active timer are converted to seconds from DIFFERENT unit tables (GPRS Timer 3 / GPRS Timer 2).',
  'protocol.nbIot.example.cpsmsDeactivated.name': 'PSM timers deactivated (CPSMS)',
  'protocol.nbIot.example.cpsmsDeactivated.description':
    'Unit bits are 111 — both timers read "deactivated", no seconds value is produced.',
  'protocol.nbIot.example.cedrxsNbS1.name': 'eDRX cycle (CEDRXS, NB-S1)',
  'protocol.nbIot.example.cedrxsNbS1.description': 'AcT_type=5 (NB-S1) — the cycle code converts to 40.96 seconds.',
  'protocol.nbIot.example.cedrxsWbS1Unsupported.name': 'eDRX cycle (CEDRXS, WB-S1 — not decoded)',
  'protocol.nbIot.example.cedrxsWbS1Unsupported.description':
    'AcT_type=4 (WB-S1/LTE-M) — no verified table for this mode in this engine, raw value plus warning.',
  'protocol.nbIot.example.cedrxrdpFull.name': 'eDRX dynamic parameters (CEDRXRDP)',
  'protocol.nbIot.example.cedrxrdpFull.description':
    'The u-blox SARA-N2/N3 manual’s own example — requested and assigned cycle are decoded, Paging Time Window stays raw (not verified).',
  'protocol.nbIot.example.cedrxpUrc.name': 'eDRX parameters (CEDRXP URC)',
  'protocol.nbIot.example.cedrxpUrc.description':
    'An unsolicited result code carrying the same four fields as CEDRXRDP — uses the same decoder.',
  'protocol.nbIot.example.finalOk.name': 'OK',
  'protocol.nbIot.example.finalOk.description':
    'A final result code carried over verbatim from lte-modem-at/at-commands — stays consistent on this page too.',

  // --- GNSS Modem (on top of lte-modem-at + nmea-0183: QGPSGNMEA handoff + narrow QGPSLOC decode) ---
  'protocol.gnssModem.documentation.summary':
    'GNSS-over-AT interpretation layer on top of lte-modem-at and nmea-0183: the raw NMEA sentence inside an AT+QGPSGNMEA response is handed off to the nmea-0183 engine (not re-implemented), AT+QGPSLOC is decoded with a narrow field set (fix/lat/lon/alt/sat/hdop).',
  'protocol.gnssModem.warning.fixTypeUnrecognized':
    'This value is not defined in Quectel’s AT+QGPSLOC table (only 2=2D, 3=3D are documented) — the fix type was not invented.',
  'protocol.gnssModem.warning.qgpslocCoordinateUnrecognized':
    'Matches neither expected shape (letter-suffixed ddmm.mmmm or signed decimal degrees) — not converted to decimal degrees, the raw value is carried.',
  'protocol.gnssModem.warning.embeddedNmeaUnparseable':
    'The text inside the AT+QGPSGNMEA response could not be parsed as an NMEA sentence — the AT-layer fields are still shown.',
  'protocol.gnssModem.example.qgpslocTwoDFix.name': 'Position fix, 2D (QGPSLOC)',
  'protocol.gnssModem.example.qgpslocTwoDFix.description':
    'The Quectel manual’s own example — latitude/longitude convert to decimal degrees, HDOP/altitude/satellite count to numbers.',
  'protocol.gnssModem.example.qgpslocUnrecognizedFix.name': 'Unrecognized fix type (QGPSLOC, fix=1)',
  'protocol.gnssModem.example.qgpslocUnrecognizedFix.description':
    'Same fixture with <fix>=1 — Quectel’s own table only documents 2/3, a warning is raised.',
  'protocol.gnssModem.example.qgpsgnmeaGga.name': 'GGA sentence (QGPSGNMEA)',
  'protocol.gnssModem.example.qgpsgnmeaGga.description':
    'Quectel’s own <nmeasrc> example — the embedded GGA sentence is fully decoded by the nmea-0183 engine.',
  'protocol.gnssModem.example.qgpsgnmeaRmc.name': 'RMC sentence (QGPSGNMEA)',
  'protocol.gnssModem.example.qgpsgnmeaRmc.description':
    'nmea-0183’s own verified RMC fixture — shows a different sentence type taking the same path.',
  'protocol.gnssModem.example.qgpsgnmeaMalformed.name': 'Malformed embedded sentence (QGPSGNMEA)',
  'protocol.gnssModem.example.qgpsgnmeaMalformed.description':
    'The content is not an NMEA sentence — no position field is produced, the AT-layer fields still show.',
  'protocol.gnssModem.example.finalOk.name': 'OK',
  'protocol.gnssModem.example.finalOk.description':
    'A final result code carried over verbatim from lte-modem-at/at-commands — stays consistent on this page too.',

  // --- DoIP ---
  'protocol.doip.error.headerTruncated':
    'Generic header is incomplete: at least 8 bytes are required (version, inverse version, payload type, payload length).',
  'protocol.doip.error.frameTooLong': 'The DoIP message exceeds the allowed maximum length.',
  'protocol.doip.error.aborted': 'Parsing was cancelled.',
  'protocol.doip.error.inverseVersionMismatch':
    'Inverse Protocol Version is not Protocol Version XOR 0xFF — the header is inconsistent.',
  'protocol.doip.error.payloadTruncated': 'The payload is shorter than this type requires.',
  'protocol.doip.warning.unknownPayloadType':
    'The payload type does not match any of the 16 codes ISO 13400-2 defines.',
  'protocol.doip.warning.payloadLengthMismatch':
    'The payload length declared in the header does not match the number of bytes actually present.',
  'protocol.doip.warning.udsPayloadNeedsUdsPage':
    'The UDS body is shown raw: SID/NRC decoding happens on the UDS page, not in the DoIP payload (wave 1 decision).',
  'protocol.doip.warning.trailingBytes': 'There are more bytes than this payload type expects.',
  'protocol.doip.warning.unknownNackCode':
    'The NACK code is not in ISO 13400-2’s Generic NACK table.',
  'protocol.doip.warning.unknownActivationType':
    'The Activation Type is not one of the values ISO 13400-2 defines.',
  'protocol.doip.warning.unknownRoutingActivationResponseCode':
    'The Response Code is not in the Routing Activation Response table.',
  'protocol.doip.warning.unknownFurtherAction':
    'The Further Action Required value is not in the table.',
  'protocol.doip.warning.unknownSyncStatus':
    'The VIN/GID Sync Status value is not in the table.',
  'protocol.doip.warning.unknownNodeType':
    'The Node Type value is not in the table (other than Gateway/Node).',
  'protocol.doip.warning.unknownPowerMode': 'The Power Mode value is not in the table.',
  'protocol.doip.warning.unknownDiagnosticAckCode':
    'The ACK Code is something other than 0x00 — Diagnostic Message ACK only defines that code.',
  'protocol.doip.warning.unknownDiagnosticNackCode':
    'The NACK code is not in the Diagnostic Message NACK table.',
  'protocol.doip.summary.genericNack': 'DoIP Generic NACK',
  'protocol.doip.summary.vehicleIdentificationRequest': 'DoIP Vehicle Identification Request',
  'protocol.doip.summary.vehicleIdentificationRequestEid':
    'DoIP Vehicle Identification Request (EID)',
  'protocol.doip.summary.vehicleIdentificationRequestVin':
    'DoIP Vehicle Identification Request (VIN)',
  'protocol.doip.summary.vehicleAnnouncement': 'DoIP Vehicle Announcement',
  'protocol.doip.summary.routingActivationRequest': 'DoIP Routing Activation Request',
  'protocol.doip.summary.routingActivationResponse': 'DoIP Routing Activation Response',
  'protocol.doip.summary.aliveCheckRequest': 'DoIP Alive Check Request',
  'protocol.doip.summary.aliveCheckResponse': 'DoIP Alive Check Response',
  'protocol.doip.summary.entityStatusRequest': 'DoIP Entity Status Request',
  'protocol.doip.summary.entityStatusResponse': 'DoIP Entity Status Response',
  'protocol.doip.summary.powerModeRequest': 'DoIP Power Mode Request',
  'protocol.doip.summary.powerModeResponse': 'DoIP Power Mode Response',
  'protocol.doip.summary.diagnosticMessage': 'DoIP Diagnostic Message',
  'protocol.doip.summary.diagnosticMessageAck': 'DoIP Diagnostic Message ACK',
  'protocol.doip.summary.diagnosticMessageNack': 'DoIP Diagnostic Message NACK',
  'protocol.doip.summary.unknownPayloadType': 'DoIP — unrecognized payload type',
  'protocol.doip.documentation.summary':
    'ISO 13400-2 DoIP: decodes the generic header (version, payload type, payload length) and the field layout of all 16 payload types — including Vehicle Announcement, Routing Activation, Alive Check, Entity Status, Power Mode and Diagnostic Message. The UDS body inside a Diagnostic Message stays RAW; SID/NRC decoding is the UDS page’s job (wave 1 decision, the chain is not wired up at the parser level).',
  'protocol.doip.example.vehicleAnnouncement.name': 'Vehicle Announcement',
  'protocol.doip.example.vehicleAnnouncement.description':
    'VIN, Logical Address, EID, GID and Further Action Required are each decoded as their own field.',
  'protocol.doip.example.routingActivationRequest.name': 'Routing Activation Request (Default)',
  'protocol.doip.example.routingActivationRequest.description':
    'Activation Type 0x00: the default activation request.',
  'protocol.doip.example.routingActivationResponse.name':
    'Routing Activation Response (Activated)',
  'protocol.doip.example.routingActivationResponse.description':
    'Response Code 0x10: activation succeeded.',
  'protocol.doip.example.diagnosticMessage.name': 'Diagnostic Message',
  'protocol.doip.example.diagnosticMessage.description':
    'SA/TA are decoded; the UDS body (Read Data By Identifier, DID 0xF190) stays raw.',
  'protocol.doip.example.genericNack.name': 'Generic NACK (Message Too Large)',
  'protocol.doip.example.genericNack.description': 'NACK code 0x02: message too large.',
  'protocol.doip.example.aliveCheckRequest.name': 'Alive Check Request',
  'protocol.doip.example.aliveCheckRequest.description':
    'Empty payload — the generic header only.',
  'protocol.doip.example.aliveCheckResponse.name': 'Alive Check Response',
  'protocol.doip.example.aliveCheckResponse.description':
    'A single 2-byte Source Address field.',
  'protocol.doip.example.routingActivationResponseTruncated.name':
    'Routing Activation Response (truncated)',
  'protocol.doip.example.routingActivationResponseTruncated.description':
    'The second byte of Entity Logical Address is missing: reports truncated-frame, but Tester Logical Address still shows up.',

  // --- CANopen ---
  'protocol.canopen.error.frameTooShort':
    'The record is not long enough to carry the CAN identifier and length fields.',
  'protocol.canopen.error.frameTooLong': 'The record exceeds the fixed frame size.',
  'protocol.canopen.error.aborted': 'Parsing was cancelled.',
  'protocol.canopen.error.extendedNotSupported':
    'CANopen’s Predefined Connection Set only defines base (11-bit) identifiers; this frame is extended.',
  'protocol.canopen.error.unknownFunctionCode':
    'The function code does not match any of CiA 301’s fifteen assigned values (0xD/0xF are reserved).',
  'protocol.canopen.warning.remoteFrame':
    'Remote flag is set; the Predefined Connection Set does not use remote frames.',
  'protocol.canopen.warning.truncatedPayload':
    'The declared data length is not present in the record; the available bytes are shown.',
  'protocol.canopen.warning.pdoNeedsMapping':
    'The PDO data is shown raw: which byte maps to which Object Dictionary entry depends on the PDO mapping/EDS and is not guessed here.',
  'protocol.canopen.warning.emcyNeedsDatabase':
    'The Error Code is shown raw: the full error code table is device-profile-specific and the spec does not provide it.',
  'protocol.canopen.warning.sdoDataNeedsSchema':
    'The data bytes are shown raw: their type depends on the Object Dictionary entry and is unknown without an EDS.',
  'protocol.canopen.warning.sdoAbortNeedsTable':
    'The abort code is shown raw: the full code table lives in CiA 301’s normative body and the spec does not provide it.',
  'protocol.canopen.warning.unknownNmtState':
    'The byte does not match any of CiA 301’s four NMT states (Boot-up/Stopped/Operational/Pre-operational).',
  'protocol.canopen.summary.nmt': 'NMT network management command',
  'protocol.canopen.summary.sync': 'SYNC synchronization message',
  'protocol.canopen.summary.emcy': 'EMCY emergency message',
  'protocol.canopen.summary.time': 'TIME message',
  'protocol.canopen.summary.pdo1Tx': 'PDO1 (Tx) process data',
  'protocol.canopen.summary.pdo1Rx': 'PDO1 (Rx) process data',
  'protocol.canopen.summary.pdo2Tx': 'PDO2 (Tx) process data',
  'protocol.canopen.summary.pdo2Rx': 'PDO2 (Rx) process data',
  'protocol.canopen.summary.pdo3Tx': 'PDO3 (Tx) process data',
  'protocol.canopen.summary.pdo3Rx': 'PDO3 (Rx) process data',
  'protocol.canopen.summary.pdo4Tx': 'PDO4 (Tx) process data',
  'protocol.canopen.summary.pdo4Rx': 'PDO4 (Rx) process data',
  'protocol.canopen.summary.sdoTx': 'SDO (Tx) service request/response',
  'protocol.canopen.summary.sdoRx': 'SDO (Rx) service request/response',
  'protocol.canopen.summary.heartbeat': 'NMT Heartbeat',
  'protocol.canopen.summary.unknown': 'Unrecognized CANopen message',
  'protocol.canopen.documentation.summary':
    'CiA 301 Predefined Connection Set: decodes the message type (NMT/SYNC/EMCY/PDOn/SDO/Heartbeat) from the COB-ID’s function code + Node-ID split. The payload’s meaning depends on the EDS/Object Dictionary and is left raw — the same boundary as J1939 leaving SPN to the DBC.',
  'protocol.canopen.example.nmtStartRemoteNode.name': 'NMT: Start Remote Node',
  'protocol.canopen.example.nmtStartRemoteNode.description':
    'COB-ID 0x000, command 0x01, target node 0x00 (broadcast). The command byte’s meaning stays raw.',
  'protocol.canopen.example.sync.name': 'SYNC',
  'protocol.canopen.example.sync.description':
    'COB-ID 0x080, function code 1 and node 0 → SYNC; no payload expected.',
  'protocol.canopen.example.emcyNode5.name': 'EMCY (node 5)',
  'protocol.canopen.example.emcyNode5.description':
    'COB-ID 0x085 = 0x080 + 5. Error Code/Register are split into fields, meaning stays raw.',
  'protocol.canopen.example.pdoStatuswordVelocity.name': 'PDO1 Tx (spec summary §04:102)',
  'protocol.canopen.example.pdoStatuswordVelocity.description':
    'CAN ID 0x181, node 1. The spec’s own example decodes this into Statusword/Velocity, but that needs mapping/EDS — the data stays raw here.',
  'protocol.canopen.example.sdoWriteControlword.name': 'SDO write (spec summary §03:87)',
  'protocol.canopen.example.sdoWriteControlword.description':
    'Index 6040 Sub 00, expedited write, value 000F — the spec’s own example.',
  'protocol.canopen.example.sdoAbort.name': 'SDO Abort',
  'protocol.canopen.example.sdoAbort.description':
    'Command byte 0x80: Abort Transfer. The abort code is shown raw, not bound to a table.',
  'protocol.canopen.example.heartbeatOperational.name': 'Heartbeat (Operational)',
  'protocol.canopen.example.heartbeatOperational.description':
    'COB-ID 0x702 = 0x700 + 2, state byte 0x05 → Operational.',
  'protocol.canopen.example.reservedFunctionCodeRejected.name': 'Reserved function code',
  'protocol.canopen.example.reservedFunctionCodeRejected.description':
    'Function code 0xD: not one of CiA 301’s fifteen assigned values, an error is reported.',

  // --- LIN ---
  'protocol.lin.error.frameTooShort':
    'The record is not long enough to carry the Sync, PID and Checksum bytes.',
  'protocol.lin.error.frameTooLong': 'The record exceeds the length eight data bytes allow.',
  'protocol.lin.error.aborted': 'Parsing was cancelled.',
  'protocol.lin.error.invalidSync': 'The first byte is not 0x55; this cannot be a LIN Sync byte.',
  'protocol.lin.error.checksumMismatch':
    'The checksum matches neither the classic (data only) nor the enhanced (PID+data) convention.',
  'protocol.lin.warning.parityMismatch':
    'The PID’s parity bits do not match the value computed from the ID.',
  'protocol.lin.summary.frame': 'LIN frame',
  'protocol.lin.documentation.summary':
    'Decodes Sync (0x55) + PID + Data + Checksum. Break is a physical-layer signal and is not modeled as a byte. PID parity uses the spec’s own formula; the checksum uses an algorithm sourced externally from LIN 2.1 — since which convention (classic/enhanced) was used cannot be read off the wire, the engine tries both.',
  'protocol.lin.example.validClassicChecksum.name': 'Valid frame (Classic checksum)',
  'protocol.lin.example.validClassicChecksum.description':
    'ID 0x01, PID 0xC1. The checksum matches the one computed over data bytes only.',
  'protocol.lin.example.validEnhancedChecksum.name': 'Valid frame (Enhanced checksum)',
  'protocol.lin.example.validEnhancedChecksum.description':
    'Same PID/data; the checksum matches the one computed including PID, not the classic one.',
  'protocol.lin.example.zeroData.name': 'Frame with no data bytes',
  'protocol.lin.example.zeroData.description':
    'Sync + PID + Checksum, no data bytes at all — the classic checksum over an empty sum is 0xFF.',
  'protocol.lin.example.parityMismatch.name': 'Parity error',
  'protocol.lin.example.parityMismatch.description':
    'Same ID but the PID’s parity bits are zeroed out — a warning is reported, the frame is still shown.',
  'protocol.lin.example.checksumMismatchRejected.name': 'Checksum error',
  'protocol.lin.example.checksumMismatchRejected.description':
    'The checksum byte matches neither the classic nor the enhanced computation.',
  'protocol.lin.example.invalidSyncRejected.name': 'Invalid Sync byte',
  'protocol.lin.example.invalidSyncRejected.description':
    'The first byte is not 0x55: an error is reported but PID/checksum are still decoded.',

  // --- DBC definition file ---
  'definition.dbc.action.import': 'Import DBC file',
  'definition.dbc.action.export': 'Export as DBC',
  'definition.dbc.sampleNotice':
    'Showing a sample definition. You can import your own DBC file; it never leaves your device.',
  'definition.dbc.version': 'Version',
  'definition.dbc.messageCount': 'Message count',
  'definition.dbc.nodes': 'Nodes',
  'definition.dbc.line': 'Line',
  'definition.dbc.message.label': 'Message',
  'definition.dbc.sampleHex.label': 'Sample frame bytes (HEX)',
  'definition.dbc.table.signals': 'Signal definitions',
  'definition.dbc.table.decoded': 'Decoded signals',
  'definition.dbc.column.signal': 'Signal',
  'definition.dbc.column.start': 'Start bit',
  'definition.dbc.column.length': 'Bit length',
  'definition.dbc.column.byteOrder': 'Byte order',
  'definition.dbc.column.signed': 'Signed',
  'definition.dbc.column.factorOffset': 'Factor / offset',
  'definition.dbc.column.range': 'Range',
  'definition.dbc.column.unit': 'Unit',
  'definition.dbc.column.multiplex': 'Multiplex',
  'definition.dbc.column.label': 'Label',
  'definition.dbc.signals.empty': 'This message defines no signals.',
  'definition.dbc.decoded.empty':
    'No signal could be decoded from this frame; it may be shorter than the message expects.',
  'definition.dbc.error.readFailed': 'The file could not be read.',
  'definition.dbc.error.parseFailed':
    'The DBC file could not be parsed; it contains no message definitions.',
  'definition.dbc.issue.emptyInput': 'The file is empty.',
  'definition.dbc.issue.noMessages': 'The file contains no message definitions.',
  'definition.dbc.issue.malformedMessage': 'The message line is not in the expected format.',
  'definition.dbc.issue.malformedSignal': 'The signal line is not in the expected format.',
  'definition.dbc.issue.signalWithoutMessage': 'The signal is not attached to a message.',
  'definition.dbc.issue.malformedValueTable':
    'The value table line is not in the expected format.',
  'definition.dbc.issue.unknownValueTableTarget':
    'The message or signal the value table points to does not exist.',
  'definition.dbc.issue.unsupportedSection':
    'This section was not read; it does not affect signal decoding.',
  'definition.dbc.issue.duplicateMessageId':
    'The same identifier is defined more than once; the first definition was kept.',
  'definition.dbc.issue.signalExceedsMessage':
    'The signal does not fit the length the message declares.',

  // --- EDS definition file ---
  'definition.eds.action.import': 'Import EDS file',
  'definition.eds.sampleNotice':
    'A sample definition is shown. You can import your own EDS file; it never leaves your device.',
  'definition.eds.fileName': 'File name',
  'definition.eds.vendorProduct': 'Vendor / Product',
  'definition.eds.objectCount': 'Object count',
  'definition.eds.line': 'Line',
  'definition.eds.object.label': 'Object Dictionary entry',
  'definition.eds.decodeHex.label': 'Sample value bytes (HEX)',
  'definition.eds.table.objects': 'Object Dictionary',
  'definition.eds.column.index': 'Index',
  'definition.eds.column.name': 'Name',
  'definition.eds.column.dataType': 'Data type',
  'definition.eds.column.access': 'Access',
  'definition.eds.column.default': 'Default',
  'definition.eds.column.range': 'Range',
  'definition.eds.column.pdoMapping': 'PDO Mapping',
  'definition.eds.decode.unavailable':
    'This entry’s data type is unknown; raw bytes cannot be decoded by type.',
  'definition.eds.error.readFailed': 'Could not read the file.',
  'definition.eds.error.parseFailed':
    'The EDS file could not be parsed; no Object Dictionary entry was found in it.',
  'definition.eds.issue.emptyInput': 'The file is empty.',
  'definition.eds.issue.noObjects': 'The file has no Object Dictionary entries.',
  'definition.eds.issue.malformedLine': 'The line is neither a section header nor a key=value pair.',
  'definition.eds.issue.unsupportedSection':
    'This section was not read; it does not affect Object Dictionary resolution.',
  'definition.eds.issue.duplicateObject':
    'The same index/sub-index is defined more than once; the first definition was kept.',

  // --- ISO 14230 (KWP2000) ---
  'protocol.iso14230.error.frameTooShort':
    'The message is incomplete: at least 3 bytes are required (FMT, SID, Checksum).',
  'protocol.iso14230.error.frameTooLong': 'The KWP2000 message exceeds the allowed maximum length.',
  'protocol.iso14230.error.aborted': 'Parsing was cancelled.',
  'protocol.iso14230.error.addressBytesTruncated':
    'The FMT byte requests address bytes (Target/Source) but the message has no room for either.',
  'protocol.iso14230.error.lengthByteTruncated':
    'The FMT byte’s length bits are zero — a separate Length byte was expected but is missing.',
  'protocol.iso14230.error.serviceDataTruncated':
    'There are not enough bytes left in the message for Service ID and Checksum.',
  'protocol.iso14230.error.checksumMismatch':
    'The checksum does not match the 8-bit sum (mod 256) of the preceding bytes.',
  'protocol.iso14230.warning.unknownAddressMode':
    'The FMT byte’s address mode bits (7-6) are not one of the three recognized values — this may be CARB mode, which is not part of ISO 14230; no address byte was assumed as a best effort.',
  'protocol.iso14230.warning.serviceNeedsTable':
    'The Service ID is shown raw: the KWP2000 service table is not in the spec, and copying the UDS table here would be fabrication — it is not named.',
  'protocol.iso14230.warning.lengthMismatch':
    'The length declared by the FMT byte (or the separate Length byte) does not match the actual Service ID + data byte count in the message.',
  'protocol.iso14230.summary.frame': 'KWP2000 frame',
  'protocol.iso14230.documentation.summary':
    'ISO 14230-2 (KWP2000): decodes the FMT byte’s address mode (No Address/Physical/Functional) and length bits, and separates out the address bytes (Target/Source) and the length byte when it is carried separately. The Service ID stays raw — the service table that later evolved into UDS is not in the spec and was not fabricated. The checksum (8-bit sum mod 256) is verified and reports checksum-mismatch when it fails.',
  'protocol.iso14230.example.physicalInlineLength.name': 'Physical addressing (inline length)',
  'protocol.iso14230.example.physicalInlineLength.description':
    'FMT 0x83: physical addressing, the length is carried in the FMT byte’s own bits.',
  'protocol.iso14230.example.functionalSeparateLength.name':
    'Functional addressing (separate Length byte)',
  'protocol.iso14230.example.functionalSeparateLength.description':
    'FMT 0xC0: the length bits are zero, the real length follows Target/Source in a separate byte.',
  'protocol.iso14230.example.noAddress.name': 'No address byte',
  'protocol.iso14230.example.noAddress.description':
    'FMT 0x02: address mode bits are 00 — no Target/Source is produced.',
  'protocol.iso14230.example.carbModeWarning.name': 'CARB mode (warning path)',
  'protocol.iso14230.example.carbModeWarning.description':
    'FMT 0x42: address mode bits are 01 (CARB) — outside ISO 14230, warns but keeps decoding.',
  'protocol.iso14230.example.checksumMismatch.name': 'Corrupted checksum',
  'protocol.iso14230.example.checksumMismatch.description':
    'Same body as the physical addressing example, with the checksum byte deliberately corrupted.',
  'protocol.iso14230.example.serviceDataTruncated.name': 'No room for Service ID/Checksum',
  'protocol.iso14230.example.serviceDataTruncated.description':
    'FMT requests physical addressing; Target/Source are read, but no bytes remain for Service ID and Checksum.',

  // --- ISO 9141 ---
  'protocol.iso9141.error.frameTooShort':
    'The message is incomplete: at least 4 bytes are required (3-byte header + Checksum).',
  'protocol.iso9141.error.frameTooLong': 'The ISO 9141 message exceeds the allowed maximum length.',
  'protocol.iso9141.error.aborted': 'Parsing was cancelled.',
  'protocol.iso9141.error.checksumMismatch':
    'The checksum does not match the 8-bit sum (mod 256) of the preceding bytes.',
  'protocol.iso9141.warning.unexpectedFormatByte':
    'The first header byte is not 0x68 — this is not treated as a spec violation, it is shown raw and decoding continues.',
  'protocol.iso9141.warning.unexpectedTargetAddress':
    'The second header byte (Target Address) is not 0x6A — shown raw and decoding continues.',
  'protocol.iso9141.warning.dataNeedsObdPage':
    'The data is shown raw: Mode/PID decoding is the OBD-II page’s job, ISO 9141 does not build a chain parser at this level.',
  'protocol.iso9141.summary.frame': 'ISO 9141 frame',
  'protocol.iso9141.documentation.summary':
    'ISO 9141-2: decodes the fixed 3-byte header (Format 0x68, Target Address 0x6A, Source Address) — a different value in the first two bytes produces a warning, not an error. The data (SAE J1979 Mode/PID) stays raw; decoding it is the OBD-II page’s job. The checksum (8-bit sum mod 256) is verified and reports checksum-mismatch when it fails.',
  'protocol.iso9141.example.standardHeader.name': 'Standard header',
  'protocol.iso9141.example.standardHeader.description':
    '0x68/0x6A header, Source Address 0xF1 — a Mode 0x41 PID 0x0C (RPM) response stays raw.',
  'protocol.iso9141.example.unexpectedFormatByte.name': 'Unexpected Format byte (warning path)',
  'protocol.iso9141.example.unexpectedFormatByte.description':
    'The first header byte is not 0x68 — warns but shows it raw and keeps decoding.',
  'protocol.iso9141.example.unexpectedTargetAddress.name':
    'Unexpected Target Address (warning path)',
  'protocol.iso9141.example.unexpectedTargetAddress.description':
    'The second header byte is not 0x6A — warns but shows it raw and keeps decoding.',
  'protocol.iso9141.example.zeroData.name': 'No data bytes',
  'protocol.iso9141.example.zeroData.description':
    'Header + checksum only — the minimum length boundary.',
  'protocol.iso9141.example.checksumMismatch.name': 'Corrupted checksum',
  'protocol.iso9141.example.checksumMismatch.description':
    'Same body as the standard header example, with the checksum byte deliberately corrupted.',

  // --- MAVLink ---
  'protocol.mavlink.error.v1HeaderTruncated':
    'The MAVLink v1 header is incomplete: at least 6 bytes are required (STX, LEN, SEQ, SYSID, COMPID, MSGID).',
  'protocol.mavlink.error.v2HeaderTruncated':
    'The MAVLink v2 header is incomplete: at least 10 bytes are required (STX, LEN, Incompat/Compat Flags, SEQ, SYSID, COMPID, 24-bit MSGID).',
  'protocol.mavlink.error.bodyTruncated':
    'There are not enough bytes left in the message for the payload, checksum (and signature, if present).',
  'protocol.mavlink.error.frameTooLong': 'The MAVLink message exceeds the allowed maximum length.',
  'protocol.mavlink.error.aborted': 'Parsing was cancelled.',
  'protocol.mavlink.error.unknownMagic':
    'The first byte is neither 0xFE (v1) nor 0xFD (v2) — this cannot be a MAVLink frame.',
  'protocol.mavlink.warning.payloadNeedsDialect':
    'The payload is shown raw: the wire field order is not the same as the XML declaration order, and it cannot be decoded field by field without loading the MAVLink dialect (message definition).',
  'protocol.mavlink.warning.crcNeedsDialect':
    'The checksum is shown raw: the CRC-16/MCRF4XX parameters and the message-specific CRC_EXTRA depend on the dialect definition — the spec does not provide them, so no verification is performed (checksum-mismatch is never reported by this engine).',
  'protocol.mavlink.warning.signatureNeedsKey':
    'A signature is present but cannot be verified: MAVLink 2 signing verification is impossible without the secret key, and the key never leaves the local machine.',
  'protocol.mavlink.warning.trailingBytes': 'There are more bytes than this frame expects.',
  'protocol.mavlink.summary.frame': 'MAVLink frame',
  'protocol.mavlink.documentation.summary':
    'The MAVLink v1 (0xFE) and v2 (0xFD) header is fully decoded by branching on the magic byte: v1 carries LEN/SEQ/SYSID/COMPID/an 8-bit MSGID, v2 additionally carries Incompat/Compat Flags, a 24-bit MSGID and (when incompat bit 0x01 is set) a 13-byte signature. The payload stays raw — the wire field order is not the same as the XML declaration order, so fixed offsets are forbidden. The checksum also stays raw: the CRC-16/MCRF4XX parameters and the message-specific CRC_EXTRA depend on the dialect definition and are not in the spec — so checksum-mismatch is never reported, hence `status: partial` (same precedent as OBD-II).',
  'protocol.mavlink.example.v1Heartbeat.name': 'MAVLink 1 (happy path)',
  'protocol.mavlink.example.v1Heartbeat.description':
    "The spec's own example coloring: FE 09 2A 01 01 00 — the header is decoded field by field, the payload and checksum stay raw.",
  'protocol.mavlink.example.v2GpsRawInt.name': 'MAVLink 2, unsigned (happy path)',
  'protocol.mavlink.example.v2GpsRawInt.description':
    'Incompat Flags 0x00: no signature. The 24-bit MSGID is parsed without colliding with the flags/seq/sysid/compid bytes.',
  'protocol.mavlink.example.v2Signed.name': 'MAVLink 2, signed',
  'protocol.mavlink.example.v2Signed.description':
    'Incompat Flags 0x01: the signature flag is set. The 13-byte signature is shown raw, with a signatureNeedsKey warning.',
  'protocol.mavlink.example.v2LargeMessageId.name': '24-bit MSGID boundary',
  'protocol.mavlink.example.v2LargeMessageId.description':
    'MSGID 0xFFFFFF: the upper boundary of the 24-bit field, proving the three bytes are combined correctly and do not collide with neighboring fields.',
  'protocol.mavlink.example.v1Truncated.name': 'Truncated frame (error path)',
  'protocol.mavlink.example.v1Truncated.description':
    "The header declares LEN 4, but there are not enough bytes left for the payload and checksum — reports truncated-frame while the header still shows.",

  // --- Ethernet II / IEEE 802.3 / VLAN 802.1Q (single parser, three plugins) ---
  'protocol.ethernet.error.typeLengthTruncated':
    'Not enough bytes for the 2-byte EtherType/Length field after the MAC pair.',
  'protocol.ethernet.error.vlanTagTruncated':
    'A VLAN TPID was seen, but the full 2-byte TCI did not arrive.',
  'protocol.ethernet.error.frameTooShort':
    'A frame must be at least Destination MAC + Source MAC + the 2-byte field (14 bytes) long.',
  'protocol.ethernet.error.frameTooLong': 'The frame exceeds the allowed maximum length.',
  'protocol.ethernet.error.aborted': 'Decoding was cancelled.',
  'protocol.ethernet.warning.etherTypeHigherLayer':
    'EtherType names the upper-layer protocol; the payload is decoded on that protocol’s own page (engines do not chain).',
  'protocol.ethernet.warning.unknownEtherType':
    'The EtherType value is not in the narrow naming set (IPv4/ARP/IPv6/EtherCAT); the payload stays raw.',
  'protocol.ethernet.warning.undefinedTypeLengthRange':
    'The value falls in the 1501-1535 range: it is defined as neither EtherType nor an IEEE 802.3 Length — decoding still continues.',
  'protocol.ethernet.warning.tooManyVlanTags':
    'More than 3 nested VLAN tags are not supported; the remaining bytes are shown as raw payload.',
  'protocol.ethernet.warning.fcsOpportunisticMatch':
    'The last 4 bytes match a CRC-32 — this is NOT proof that an FCS is actually present (there is a chance of a random match), it is an informational note only.',
  'protocol.ethernet.warning.looksLikeEthernetII':
    'This frame looks like Ethernet II (an EtherType field) — see the Ethernet II page.',
  'protocol.ethernet.warning.looksLikeIeee8023':
    'This frame looks like IEEE 802.3 (a Length field) — see the IEEE 802.3 page.',
  'protocol.ethernet.warning.looksLikeVlanTagged':
    'This frame looks VLAN-tagged (a 0x8100 TPID) — see the VLAN 802.1Q page.',

  'protocol.ethernet.ethernetII.documentation.summary':
    'An Ethernet II frame: Destination/Source MAC (with broadcast/multicast/unicast classification), EtherType (the narrow IPv4/ARP/IPv6 set is named, the payload is not decoded) and a VLAN 802.1Q tag (if present) are decoded field by field. FCS is never assumed — a "FCS not captured" info field is always shown, and an opportunistic CRC-32 match on the last 4 bytes only adds an informational note.',
  'protocol.ethernet.ethernetII.example.broadcastArp.name': 'Broadcast ARP (spec example)',
  'protocol.ethernet.ethernetII.example.broadcastArp.description':
    'DST broadcast, SRC 00:11:22:33:44:55, EtherType 0x0806 → named as ARP, payload stays raw.',
  'protocol.ethernet.ethernetII.example.ipv4Unicast.name': 'Unicast IPv4 frame',
  'protocol.ethernet.ethernetII.example.ipv4Unicast.description':
    'EtherType 0x0800 → named as IPv4, and an upper-layer warning is reported.',
  'protocol.ethernet.ethernetII.example.unknownEtherType.name': 'Unrecognized EtherType',
  'protocol.ethernet.ethernetII.example.unknownEtherType.description':
    'EtherType 0x9000 is not in the narrow naming set: the field is marked invalid, the frame is still shown.',
  'protocol.ethernet.ethernetII.example.fcsOpportunisticMatch.name': 'Opportunistic FCS match',
  'protocol.ethernet.ethernetII.example.fcsOpportunisticMatch.description':
    'The last 4 bytes match an independently computed CRC-32 — an informational note only, not a PASS/FAIL claim.',

  'protocol.ethernet.ieee8023.documentation.summary':
    'The 2-byte field after the MAC pair is interpreted as a Length under IEEE 802.3 (the opposite of Ethernet II’s EtherType interpretation). The 1501-1535 range is neither EtherType nor Length — a warning is reported, decoding does not stop. LLC/SNAP payload is not decoded on this page, it stays raw.',
  'protocol.ethernet.ieee8023.example.snapLengthFrame.name': 'Length interpretation (spec example: 0x002E)',
  'protocol.ethernet.ieee8023.example.snapLengthFrame.description':
    '0x002E → IEEE 802.3 Payload Length = 46 bytes.',
  'protocol.ethernet.ieee8023.example.undefinedRange.name': 'Undefined range (1520)',
  'protocol.ethernet.ieee8023.example.undefinedRange.description':
    'The 1501-1535 range is neither EtherType nor Length: a warning is reported, not an error.',

  'protocol.ethernet.vlan8021q.documentation.summary':
    'A VLAN 802.1Q tag (TPID 0x8100 + TCI) is inserted after the MAC pair: PCP (3-bit priority), DEI (1 bit) and VLAN ID (12 bits) are decoded as separate fields, and the inner EtherType is read with a 4-byte offset shift. Double/triple tags (stacking) are supported, beyond 3 is stopped with a warning.',
  'protocol.ethernet.vlan8021q.example.singleTag.name': 'Single VLAN tag (spec example: PCP5/VID100)',
  'protocol.ethernet.vlan8021q.example.singleTag.description':
    'PCP 5, DEI 0, VLAN ID 100; the inner EtherType 0x0800 is named as IPv4.',
  'protocol.ethernet.vlan8021q.example.doubleTagStacked.name': 'Double VLAN tag (stacking)',
  'protocol.ethernet.vlan8021q.example.doubleTagStacked.description':
    'Tag #1 VID100 / Tag #2 VID20 — the same values as the spec’s own stacking example.',
  'protocol.ethernet.vlan8021q.example.truncatedTci.name': 'Incomplete TCI (error path)',
  'protocol.ethernet.vlan8021q.example.truncatedTci.description':
    'The TPID is present but only the first byte of the TCI arrived — reports truncated-frame while the MAC fields still show.',

  // --- IPv4 ---
  'protocol.ipv4.error.frameTooShort': 'The frame must be at least as long as the 20-byte minimum IPv4 header.',
  'protocol.ipv4.error.frameTooLong': 'The frame exceeds the configured maximum length.',
  'protocol.ipv4.error.aborted': 'Parsing was aborted.',
  'protocol.ipv4.error.ihlTooSmall': 'IHL is below 5 (20 bytes) — a structurally impossible header length.',
  'protocol.ipv4.error.totalLengthTooSmall': 'Total Length is smaller than the header length declared by IHL·4.',
  'protocol.ipv4.error.headerChecksumMismatch': 'The Header Checksum does not match the computed value.',
  'protocol.ipv4.warning.unexpectedVersion': 'The Version field is not 4 — parsing continues regardless.',
  'protocol.ipv4.warning.protocolHigherLayer':
    'Protocol names the upper-layer protocol; the payload is decoded on that protocol’s own page (engines do not chain).',
  'protocol.ipv4.warning.unknownProtocol':
    'The Protocol value is outside the narrow naming set (ICMP/TCP/UDP); the payload stays raw.',
  'protocol.ipv4.warning.checksumVerificationSkipped':
    'Checksum verification was skipped because the header boundary (invalid IHL, or missing from the buffer) is unknown.',

  'protocol.ipv4.documentation.summary':
    'The IPv4 header: Version/IHL, DSCP/ECN, Total Length, Identification/Flags/Fragment Offset (decoded as fields, NO reassembly), TTL, Protocol (the ICMP/TCP/UDP narrow set is named, the payload is not decoded), Header Checksum (does NOT need a pseudo-header, PASS/FAIL is FULLY verified), Source/Destination Address, and Options when present are all decoded field by field.',
  'protocol.ipv4.example.classicTcpHeader.name': 'Classic header (textbook example)',
  'protocol.ipv4.example.classicTcpHeader.description':
    'Protocol=TCP, checksum 0xB1E6 verified with an independent computation (same fixture as internetChecksum.test.ts).',
  'protocol.ipv4.example.udpCarrying.name': 'Header carrying UDP',
  'protocol.ipv4.example.udpCarrying.description':
    'Protocol=17 (UDP) → prints the upper-layer warning, checksum computed independently.',
  'protocol.ipv4.example.headerChecksumFail.name': 'Broken header checksum (error path)',
  'protocol.ipv4.example.headerChecksumFail.description':
    'Checksum is deliberately written as 0x0000 (the real value is 0x66D7) → checksum-mismatch.',
  'protocol.ipv4.example.unknownProtocol.name': 'Unrecognized Protocol',
  'protocol.ipv4.example.unknownProtocol.description':
    'Protocol=253 is outside the narrow set: the field is flagged invalid, the frame is still shown.',
  'protocol.ipv4.example.ihlTooSmall.name': 'IHL is structurally invalid (error path)',
  'protocol.ipv4.example.ihlTooSmall.description':
    'IHL=4 (16 bytes), below the minimum of 5 (20 bytes) — value-out-of-range; Options/Payload/checksum verification are skipped.',
  'protocol.ipv4.example.totalLengthTooSmall.name': 'Total Length too small (error path)',
  'protocol.ipv4.example.totalLengthTooSmall.description':
    'IHL is valid (20 bytes) but Total Length=16 < 20 — length-mismatch, the checksum still passes.',

  // --- IPv6 ---
  'protocol.ipv6.error.frameTooShort': 'The frame must be at least as long as the fixed 40-byte IPv6 base header.',
  'protocol.ipv6.error.frameTooLong': 'The frame exceeds the configured maximum length.',
  'protocol.ipv6.error.aborted': 'Parsing was aborted.',
  'protocol.ipv6.error.extensionHeaderTruncated':
    'There are not enough bytes in the buffer for an extension header’s declared length.',
  'protocol.ipv6.warning.unexpectedVersion': 'The Version field is not 6 — parsing continues regardless.',
  'protocol.ipv6.warning.nextHeaderHigherLayer':
    'Next Header names the upper-layer protocol; the payload is decoded on that protocol’s own page (engines do not chain).',
  'protocol.ipv6.warning.unknownNextHeader':
    'The Next Header value is outside the known extension-header and upper-layer sets; the chain stops here (infinite-loop guard).',
  'protocol.ipv6.warning.tooManyExtensionHeaders':
    'More than 8 nested extension headers are not supported; the remaining bytes are shown as raw payload.',

  'protocol.ipv6.documentation.summary':
    'The IPv6 base header is a fixed 40 bytes: Version/Traffic Class/Flow Label, Payload Length, Next Header (known extension headers — Hop-by-Hop/Routing/Fragment/Destination Options — are walked as a chain, upper-layer TCP/UDP/ICMPv6 is named, an unknown value stops the chain), Hop Limit, Source/Destination Address (128-bit). There is no checksum field — an "N/A" info field is shown instead.',
  'protocol.ipv6.example.tcpBasic.name': 'No extension headers, straight to TCP',
  'protocol.ipv6.example.tcpBasic.description':
    'Next Header=6 (TCP) → no extension headers at all, straight to the upper-layer warning.',
  'protocol.ipv6.example.hopByHopThenUdp.name': 'Hop-by-Hop → UDP chain',
  'protocol.ipv6.example.hopByHopThenUdp.description':
    'Next Header=0 (Hop-by-Hop) is skipped over; the extension header’s own Next Header of 17 (UDP) is named.',
  'protocol.ipv6.example.unknownNextHeader.name': 'Unrecognized Next Header',
  'protocol.ipv6.example.unknownNextHeader.description':
    'Next Header=253 is outside the narrow set: the chain never starts, a WARNING not an error.',
  'protocol.ipv6.example.truncatedExtensionHeader.name': 'Incomplete extension header (error path)',
  'protocol.ipv6.example.truncatedExtensionHeader.description':
    'The Hop-by-Hop extension header declares 48 bytes but only 2 bytes are in the buffer — reports truncated-frame.',

  // --- UDP ---
  'protocol.udp.error.frameTooShort': 'The frame must be at least as long as the fixed 8-byte UDP header.',
  'protocol.udp.error.frameTooLong': 'The frame exceeds the configured maximum length.',
  'protocol.udp.error.aborted': 'Parsing was aborted.',
  'protocol.udp.error.lengthTooSmall': 'Length is below 8 (the header itself) — structurally impossible.',
  'protocol.udp.error.declaredLengthExceedsBuffer':
    'There are not enough bytes in the buffer for the total length declared by the Length field.',
  'protocol.udp.warning.checksumNeedsPseudoHeader':
    'Checksum needs a pseudo-header from the IP header; a single-segment input has no such information — it cannot be verified, and is shown raw.',
  'protocol.udp.warning.checksumZeroMeansDisabledOverIpv4':
    'If this field is 0x0000 it means "checksum not used" over an IPv4 carrier (IPv6 makes the checksum mandatory).',
  'protocol.udp.warning.trailingBytes':
    'The buffer is longer than the Length field declares; the extra bytes are shown in a separate field (may belong to the next datagram).',

  'protocol.udp.documentation.summary':
    'The UDP header is 8 bytes: Source/Destination Port, Length (total length including itself, payload = length − 8), and Checksum. Because the checksum needs a pseudo-header it CANNOT be verified from a single segment — it is shown raw with a warning, mismatch is never reported; 0x0000 over an IPv4 carrier means "not used".',
  'protocol.udp.example.dnsQuery.name': 'DNS-like datagram',
  'protocol.udp.example.dnsQuery.description': 'Source Port=53, checksum shown raw (no pseudo-header).',
  'protocol.udp.example.checksumDisabledIpv4.name': 'Checksum 0x0000 (IPv4 special case)',
  'protocol.udp.example.checksumDisabledIpv4.description':
    'Checksum=0x0000 → the "not used" info note that only applies over an IPv4 carrier.',
  'protocol.udp.example.lengthTooSmall.name': 'Length too small (error path)',
  'protocol.udp.example.lengthTooSmall.description': 'Length=4 < 8 (smaller than the header itself) — value-out-of-range.',
  'protocol.udp.example.trailingBytes.name': 'Extra bytes (trailing data)',
  'protocol.udp.example.trailingBytes.description':
    'Length declares 10 but the buffer has 4 extra bytes — shown in a separate field, a warning rather than an error.',

  // --- TCP ---
  'protocol.tcp.error.frameTooShort': 'The frame must be at least as long as the 20-byte minimum TCP header.',
  'protocol.tcp.error.frameTooLong': 'The frame exceeds the configured maximum length.',
  'protocol.tcp.error.aborted': 'Parsing was aborted.',
  'protocol.tcp.error.dataOffsetTooSmall':
    'Data Offset is below 5 (20 bytes) — a structurally impossible header length.',
  'protocol.tcp.error.declaredHeaderExceedsBuffer':
    'There are not enough bytes in the buffer for the header (including options) declared by Data Offset.',
  'protocol.tcp.warning.checksumNeedsPseudoHeader':
    'Checksum needs a pseudo-header from the IP header; a single-segment input has no such information — it cannot be verified, and is shown raw.',

  'protocol.tcp.documentation.summary':
    'The TCP header is at least 20 bytes: Source/Destination Port, Sequence/Acknowledgment Number (32-bit, no relationship is established between them), Data Offset/Reserved, 8 flags (CWR/ECE/URG/ACK/PSH/RST/SYN/FIN), Window Size, Checksum (cannot be verified since it needs a pseudo-header, shown raw), Urgent Pointer, and Options (raw) when present. TCP delivers a BYTE STREAM, not packets — this engine decodes a single segment and does not reassemble the stream.',
  'protocol.tcp.example.synBasic.name': 'SYN (connection opening)',
  'protocol.tcp.example.synBasic.description': 'Data Offset=5 (no options), only the SYN flag is set.',
  'protocol.tcp.example.pshAckWithOptions.name': 'PSH+ACK, with options',
  'protocol.tcp.example.pshAckWithOptions.description':
    'Data Offset=6 (24 bytes: 20 + 4 bytes of options), the PSH and ACK flags are set.',
  'protocol.tcp.example.dataOffsetTooSmall.name': 'Data Offset is structurally invalid (error path)',
  'protocol.tcp.example.dataOffsetTooSmall.description':
    'Data Offset=4 (16 bytes), below the minimum of 5 (20 bytes) — value-out-of-range; Options/Payload are not produced.',
  'protocol.tcp.example.truncatedOptions.name': 'Incomplete options (error path)',
  'protocol.tcp.example.truncatedOptions.description':
    'Data Offset=8 declares 32 bytes but only 24 bytes are in the buffer — reports truncated-frame.',

  // --- MQTT ---
  'protocol.mqtt.error.frameTooShort': 'The frame must be at least as long as the Fixed Header byte plus a single-byte Remaining Length.',
  'protocol.mqtt.error.frameTooLong': 'The frame exceeds the configured maximum length.',
  'protocol.mqtt.error.aborted': 'Parsing was aborted.',
  'protocol.mqtt.error.reservedPacketType': 'Packet type 0 is none of the 15 types OASIS defines — a reserved value.',
  'protocol.mqtt.error.invalidQos': 'PUBLISH QoS bits are 0b11 (3) — a value OASIS reserves and leaves invalid.',
  'protocol.mqtt.error.remainingLengthMalformed':
    'Remaining Length never drops its continuation bit across four bytes — the Variable Byte Integer encoding is at most four bytes (OASIS §1.5.5).',
  'protocol.mqtt.error.remainingLengthTruncated': 'The data ended before Remaining Length was complete — more bytes are needed.',
  'protocol.mqtt.error.bodyTruncated': 'The body declared by Remaining Length is missing from the buffer.',
  'protocol.mqtt.error.connectFieldTruncated': 'A CONNECT field is missing from the buffer.',
  'protocol.mqtt.error.connectPropertiesTruncated':
    'Protocol Level=5 requires a Properties field, but the declared length is missing from the buffer.',
  'protocol.mqtt.error.publishFieldTruncated': 'A PUBLISH field is missing from the buffer.',
  'protocol.mqtt.error.packetIdentifierTruncated': 'There are not two bytes left in the buffer for Packet Identifier.',

  'protocol.mqtt.warning.fixedFlagsViolation':
    'This packet type has a fixed flags value defined by OASIS; the byte that arrived violates it. The frame is still decoded.',
  'protocol.mqtt.warning.unknownProtocolLevel':
    'Protocol Level is neither 4 (v3.1.1) nor 5 (v5) — the version is unknown, Properties was not attempted.',
  'protocol.mqtt.warning.unexpectedProtocolName': 'Protocol Name is not "MQTT" — an unexpected value.',
  'protocol.mqtt.warning.connectFlagsReservedBit': 'The reserved bit (bit 0) of Connect Flags should be zero, but it arrived set.',
  'protocol.mqtt.warning.unknownPropertyId':
    'An unrecognised Property Identifier was seen; the remaining block from this id onward is shown raw since its type is unknown.',
  'protocol.mqtt.warning.propertyTruncated': 'A known property’s value does not fit within the Properties Length boundary — the remaining block is shown raw.',
  'protocol.mqtt.warning.propertiesVersionAssumed':
    'This packet type does not by itself announce the MQTT version (no prior CONNECT is remembered); this field was decoded ASSUMING the v5 Properties TLV format, and that assumption is unverified.',
  'protocol.mqtt.warning.trailingBytes': 'More bytes arrived than Remaining Length declared — shown in a separate field.',

  'protocol.mqtt.summary.frame': 'MQTT frame',

  'protocol.mqtt.documentation.summary':
    'The MQTT Fixed Header (Packet Type + flags + Variable Byte Integer Remaining Length) is the same for every packet type. CONNECT and PUBLISH are fully decoded: CONNECT reads and names Protocol Level (4=v3.1.1, 5=v5), and when Level=5 the v5 Properties TLV (from OASIS’s narrow id table) is decoded as mandatory. PUBLISH decodes Topic Name, Packet Identifier when QoS>0, and Properties when present (under an unverified version assumption); the rest is Payload. The other 13 types only name Packet Identifier when present; the remaining body is shown raw. The input is a SINGLE MQTT Control Packet — no reassembly from a TCP stream is performed.',
  'protocol.mqtt.example.connectV311.name': 'CONNECT — MQTT 3.1.1',
  'protocol.mqtt.example.connectV311.description':
    'Protocol Level=4, Clean Session=1, Keep Alive=60, Client Identifier "sensor-01" — no will/user/password.',
  'protocol.mqtt.example.connectV5Properties.name': 'CONNECT — MQTT 5.0, with Properties',
  'protocol.mqtt.example.connectV5Properties.description':
    'Protocol Level=5, Properties: Session Expiry Interval=3600 + Receive Maximum=20, Client Identifier "sensor-02".',
  'protocol.mqtt.example.publishQos0.name': 'PUBLISH — QoS 0',
  'protocol.mqtt.example.publishQos0.description': 'No Packet Identifier, Topic "sensors/temp", Payload "23.5".',
  'protocol.mqtt.example.publishQos1.name': 'PUBLISH — QoS 1',
  'protocol.mqtt.example.publishQos1.description':
    'QoS 1 + RETAIN, Packet Identifier=0x1234, Topic "cmd/set", Payload "ON".',
  'protocol.mqtt.example.reservedPacketType.name': 'Reserved packet type (error path)',
  'protocol.mqtt.example.reservedPacketType.description':
    'Upper nibble 0x0 — none of the 15 OASIS types; the Fixed Header is still shown.',
  'protocol.mqtt.example.remainingLengthMalformed.name': 'Malformed Variable Byte Integer (error path)',
  'protocol.mqtt.example.remainingLengthMalformed.description':
    'Remaining Length never drops its continuation bit across four bytes (0xFF×4) — a violation of OASIS’s at-most-four-bytes rule.',
  'protocol.mqtt.example.subscribeFixedFlagsViolation.name': 'SUBSCRIBE — fixed flags violation (warning path)',
  'protocol.mqtt.example.subscribeFixedFlagsViolation.description':
    'SUBSCRIBE’s flags nibble should be 0b0010, but 0b0000 arrived — a warning is raised, the frame still decodes.',

  // --- CoAP ---
  'protocol.coap.error.headerTruncated': 'The frame is not even as long as the 4-byte fixed header.',
  'protocol.coap.error.frameTooLong': 'The frame exceeds the configured maximum length.',
  'protocol.coap.error.aborted': 'Parsing was aborted.',
  'protocol.coap.error.tokenLengthReserved':
    'Token Length is in the 9-15 range — a value RFC 7252 reserves and leaves invalid (a "message format error"). Token/Options/Payload were not decoded.',
  'protocol.coap.error.tokenTruncated': 'The byte count declared by Token Length is missing from the buffer.',
  'protocol.coap.error.optionTruncated': 'An option’s delta/length extension byte, or its value, is missing from the buffer.',
  'protocol.coap.error.optionNibbleReserved':
    'An option byte carries 15 alone in either the delta or the length nibble — that value is only valid in the exact 0xFF payload marker, so this is RFC 7252’s "message format error".',
  'protocol.coap.error.payloadMarkerEmpty':
    'No bytes followed the 0xFF payload marker — RFC 7252 requires a payload whenever the marker is present.',

  'protocol.coap.warning.versionUnexpected':
    'The Version field is not 1 — RFC 7252 does not call for a silent reject against future versions, so parsing continues anyway.',
  'protocol.coap.warning.unknownOption':
    'The option number is not in RFC 7252’s base option table (this includes later RFC extensions such as Observe/Block) — shown raw, no name is invented.',

  'protocol.coap.summary.frame': 'CoAP frame',

  'protocol.coap.documentation.summary':
    'The 4-byte fixed header (Version/Type/Token Length + Code + Message ID) is split into bit fields and decoded with bitCursor. Code is shown both as a raw byte and in "class.detail" notation (e.g. 0x45 → "2.05"). Token is shown raw for as many bytes as Token Length declares; the 9-15 range is a "message format error" RFC 7252 reserves. The Options list loops until the 0xFF payload marker or the end of the buffer: each option’s delta/length nibble expands under RFC 7252’s extended-value rules (13→+13, 14→+269), and the Option Number is the cumulative sum of the preceding deltas. Only the fourteen numbers in RFC 7252’s base option table are named; everything else is shown raw with a warning. Later RFC extensions such as Observe/Block are deliberately not decoded.',
  'protocol.coap.example.getRequest.name': 'GET request — Uri-Path',
  'protocol.coap.example.getRequest.description':
    'CON, no Token, Code=GET (0.01), Uri-Path="temp" — no payload.',
  'protocol.coap.example.contentResponse.name': '2.05 Content response',
  'protocol.coap.example.contentResponse.description':
    'ACK, Token=0xABCD, Code=2.05 Content, a Content-Format option, 0xFF marker + Payload "23.5".',
  'protocol.coap.example.multipleUriPath.name': 'Multiple Uri-Path segments',
  'protocol.coap.example.multipleUriPath.description':
    'GET /sensors/temp — two Uri-Path options, the second keeps the same option number (11) cumulatively with delta=0.',
  'protocol.coap.example.unrecognizedOption.name': 'Unrecognized option (warning path)',
  'protocol.coap.example.unrecognizedOption.description':
    'Observe (an RFC 7641 extension) — not in the base name set, shown raw with a warning; the frame still stays valid.',
  'protocol.coap.example.tokenLengthReserved.name': 'Token Length reserved (error path)',
  'protocol.coap.example.tokenLengthReserved.description':
    'TKL=9 — the range RFC 7252 reserves; Token/Options are never decoded.',
  'protocol.coap.example.payloadMarkerEmpty.name': 'Empty payload after 0xFF (error path)',
  'protocol.coap.example.payloadMarkerEmpty.description':
    'The payload marker arrived but not a single byte follows it — an RFC 7252 violation.',
  'protocol.coap.example.optionNibbleReserved.name': 'Option nibble 15 outside the marker (error path)',
  'protocol.coap.example.optionNibbleReserved.description':
    'Option byte 0xF0: the delta nibble is 15 but the byte is not exactly 0xFF — a "message format error".',

  // --- DNP3 ---
  'protocol.dnp3.error.frameTooShort': 'Frame is not as long as the link header (10 bytes).',
  'protocol.dnp3.error.frameTooLong': 'Frame exceeds the allowed maximum length.',
  'protocol.dnp3.error.aborted': 'Parsing was cancelled.',
  'protocol.dnp3.error.startBytesInvalid':
    'Start bytes are not 0x05 0x64 — this may not be a DNP3 link frame.',
  'protocol.dnp3.error.lengthTooSmall':
    'Length field is below the minimum (5); Control+Destination+Source alone would not fit.',
  'protocol.dnp3.error.headerCrcMismatch':
    'Header CRC does not match: the received and calculated values differ.',
  'protocol.dnp3.error.blockCrcMismatch':
    'Body block CRC does not match: the received and calculated values differ.',
  'protocol.dnp3.error.bodyTruncated':
    'Not enough bytes remain for the body block that Length promises.',
  'protocol.dnp3.error.applicationTruncated':
    'Not enough logical bytes remain for the application-layer field.',
  'protocol.dnp3.warning.unknownLinkFunctionCode':
    'Link function code is not in the narrow set recognized for this PRM value.',
  'protocol.dnp3.warning.unknownApplicationFunctionCode':
    'Application function code is not in the narrow name set — shown raw.',
  'protocol.dnp3.warning.multiSegmentSession':
    'FIR/FIN do not indicate a single segment: this is PART of a multi-segment application message. Segments are not reassembled (session/analyzer work); the remaining bytes are shown raw.',
  'protocol.dnp3.warning.unknownQualifier':
    "The qualifier's range specifier is not in the recognized narrow set — since the range/count length cannot be determined, everything after it is shown raw.",
  'protocol.dnp3.warning.objectDataNeedsVariationDecode':
    'The object header was decoded; the data after it (point values) is shown raw — decoding the layout per variation is next-phase work (Decision 6).',
  'protocol.dnp3.warning.headerSpansBlockBoundary':
    "A field crosses the CRC boundary between body blocks; the engine showed everything from that point on raw rather than guess.",
  'protocol.dnp3.warning.trailingBytes':
    'Frame carries extra bytes past the content that Length declares.',
  'protocol.dnp3.summary.linkOnly': 'Link-layer-only frame (no user data)',
  'protocol.dnp3.summary.multiSegment': 'Part of a multi-segment application message',
  'protocol.dnp3.summary.application': 'DNP3 application-layer frame',
  'protocol.dnp3.documentation.summary':
    'IEEE 1815 DNP3: decodes the link layer (start/length/control/destination/source, CRC16_DNP over 16-byte blocks), transport (FIR/FIN/SEQ — no segment reassembly) and application layer (application control, function code, IIN on responses, a single object header: Group/Variation/Qualifier/Range). The data after the object header (point values) stays raw: decoding it per variation is next-phase work (Decision 6). Field names are cross-checked against the opendnp3 documentation and the Wireshark DNP3 dissector field table.',
  'protocol.dnp3.example.linkOnlyRequestLinkStatus.name': 'Link-only: Request Link Status',
  'protocol.dnp3.example.linkOnlyRequestLinkStatus.description':
    'Length=5, no user data — link header only. Primary function 0x09 Request Link Status.',
  'protocol.dnp3.example.singleSegmentReadClass0.name': 'Single segment: Read Class 0',
  'protocol.dnp3.example.singleSegmentReadClass0.description':
    'FIR=FIN=1 single segment; application Read (0x01), Group 60 Var 1 Qualifier 0x06 (Class 0 poll, no range/data).',
  'protocol.dnp3.example.responseWithIin.name': 'Response + IIN (Need Time)',
  'protocol.dnp3.example.responseWithIin.description':
    'Outstation→master Response (0x81); IIN1 Need Time bit set. Group 1 (Binary Input) Var 2, Qualifier 0x00, single index; 1 raw object-data byte after the header.',
  'protocol.dnp3.example.multiSegmentFirstSegment.name': 'Multi-segment: first part',
  'protocol.dnp3.example.multiSegmentFirstSegment.description':
    'Transport FIR=1, FIN=0 — the first part of a multi-segment message. The application layer is shown raw as "Segment Data" without reassembly.',
  'protocol.dnp3.example.headerCrcMismatch.name': 'Header CRC error',
  'protocol.dnp3.example.headerCrcMismatch.description':
    'Same header as the link-only example, CRC bytes deliberately zeroed — the crc-mismatch error path.',
  'protocol.dnp3.example.blockCrcMismatch.name': 'Body block CRC error',
  'protocol.dnp3.example.blockCrcMismatch.description':
    'Same header as the single-segment example (header CRC correct), the body block CRC deliberately zeroed.',

  // --- IEC 60870-5-104 ---
  'protocol.iec104.error.frameTooShort': 'Frame is not as long as the APCI (6 bytes).',
  'protocol.iec104.error.frameTooLong': 'Frame length exceeds the configured maximum frame length.',
  'protocol.iec104.error.aborted': 'Parsing was aborted.',
  'protocol.iec104.error.contentLengthTooSmall':
    "The content promised by the Length field does not even fit the 4 control bytes.",
  'protocol.iec104.error.lengthMismatch':
    'The total frame length promised by Length exceeds the number of bytes available in the buffer.',
  'protocol.iec104.error.startByteInvalid':
    'Start byte is not 0x68 — this may not be an IEC 60870-5-104 APDU.',
  'protocol.iec104.error.asduTruncated': 'Not enough bytes remain for the ASDU field.',
  'protocol.iec104.warning.oversizedLength':
    "Length exceeds the standard's maximum APDU content of 253 bytes.",
  'protocol.iec104.warning.unknownUFormatFunction':
    'The U-format function byte is not one of the six recognized values (STARTDT/STOPDT/TESTFR act/con).',
  'protocol.iec104.warning.unknownTypeId':
    'Type Identification is not in the narrow name set — shown raw.',
  'protocol.iec104.warning.unknownCauseOfTransmission':
    'Cause of Transmission is not in the narrow name set — shown raw.',
  'protocol.iec104.warning.informationElementNeedsTypeDecode':
    'The Information Object Address was decoded; the element data is shown raw — decoding the layout per type is next-phase work.',
  'protocol.iec104.warning.multipleObjectsUnknownWidth':
    'The ASDU carries multiple Information Objects, but the element width for this type is not cross-verified — the objects could not be walked individually, so all of them are shown as one raw block (rather than printing a misaligned field).',
  'protocol.iec104.summary.uFormat': 'U-format control frame',
  'protocol.iec104.summary.sFormat': 'S-format acknowledgement frame',
  'protocol.iec104.summary.iFormat': 'I-format information transfer frame',
  'protocol.iec104.documentation.summary':
    'IEC 60870-5-104: decodes the APCI (start 0x68, length, I/S/U format split from the 4 control bytes, 15-bit send/receive sequence numbers on I-format) and, on I-format, the ASDU header that follows (Type Identification, Variable Structure Qualifier/SQ, Cause of Transmission, Common Address, Information Object Address + element). Only M_SP_NA_1’s SIQ element is decoded bit by bit (SPI + BL/SB/NT/IV quality bits); every other element stays raw. Sequence-number expectation/session tracking (which number is next) is analyzer work and is not attempted here. Field names are cross-checked against the Wireshark IEC-104 dissector field table, the iec104-cheat-sheet and the lib60870 documentation.',
  'protocol.iec104.example.uFormatStartdtAct.name': 'U-format: STARTDT act',
  'protocol.iec104.example.uFormatStartdtAct.description':
    'The shortest frame — APCI only, no ASDU. Control byte 0x07: STARTDT act.',
  'protocol.iec104.example.sFormatAck.name': 'S-format: acknowledgement N(R)=3',
  'protocol.iec104.example.sFormatAck.description':
    'Carries only a Receive Sequence Number (N(R)=3) — the numbered acknowledgement of I-format frames.',
  'protocol.iec104.example.iFormatSingleObjectSpontaneous.name':
    'I-format: single object, spontaneous (M_SP_NA_1)',
  'protocol.iec104.example.iFormatSingleObjectSpontaneous.description':
    'N(S)=0, N(R)=0; ASDU M_SP_NA_1, SQ=0/count=1, COT=Spontaneous, Common Address=1, IOA=1, SIQ with SPI on and clean quality bits.',
  'protocol.iec104.example.iFormatSequentialObjects.name': 'I-format: SQ=1, three consecutive objects',
  'protocol.iec104.example.iFormatSequentialObjects.description':
    'N(S)=1, N(R)=0; ASDU M_SP_NA_1, SQ=1/count=3, COT=Periodic/cyclic; a single IOA=1 followed by three consecutive SIQ elements (on/off/on+IV).',
  'protocol.iec104.example.iFormatInterrogationCommand.name': 'I-format: general interrogation command (C_IC_NA_1)',
  'protocol.iec104.example.iFormatInterrogationCommand.description':
    'N(S)=2, N(R)=1; ASDU C_IC_NA_1, COT=Activation, IOA=0 (the general-interrogation convention); the QOI element is shown raw.',
  'protocol.iec104.example.iFormatUnknownTypeId.name': 'I-format: unrecognized Type ID',
  'protocol.iec104.example.iFormatUnknownTypeId.description':
    'Type ID 200 is not in the narrow name set — the warning path; the frame is still considered valid (a warning, not an error).',
  'protocol.iec104.example.startByteInvalid.name': 'Start byte error',
  'protocol.iec104.example.startByteInvalid.description':
    'Same body as the STARTDT act example, start byte deliberately set to 0x67 — the start-delimiter-not-found error path; the rest of the APCI still decodes.',
  'protocol.iec104.example.lengthMismatch.name': 'Length mismatch',
  'protocol.iec104.example.lengthMismatch.description':
    'Length=10 promises a 12-byte frame but the buffer is only 6 bytes — a length-mismatch ParseFailure (modbusTcp precedent, recoverable).',

  // --- M-Bus ---
  'protocol.mbus.error.emptyFrame': 'Buffer is empty — no frame class can be read.',
  'protocol.mbus.error.unrecognizedFrameClass':
    'The first byte does not match any of the four frame classes (0xE5/0x10/0x68).',
  'protocol.mbus.error.frameTooLong': 'Frame length exceeds the configured maximum frame length.',
  'protocol.mbus.error.aborted': 'Parsing was aborted.',
  'protocol.mbus.error.shortFrameTruncated': 'Short Frame does not reach the fixed 5-byte length.',
  'protocol.mbus.error.longFrameHeaderTruncated':
    'Not enough bytes remain for the Control/Long Frame header (Start+L+L+Start, 4 bytes).',
  'protocol.mbus.error.lengthCopiesMismatch':
    "The two copies of the L field disagree — the first copy was used to continue decoding.",
  'protocol.mbus.error.secondStartInvalid': 'The second start byte is not 0x68.',
  'protocol.mbus.error.stopByteInvalid': 'The stop byte is not 0x16.',
  'protocol.mbus.error.checksumMismatch': 'Checksum (8-bit arithmetic sum, mod 256) does not match.',
  'protocol.mbus.error.bodyTruncated':
    'The total frame length promised by L exceeds the number of bytes available in the buffer.',
  'protocol.mbus.error.fixedHeaderTruncated':
    'Not enough bytes remain for the Fixed Data Header (12 bytes: Identification/Manufacturer/Version/Medium/Access No/Status/Signature).',
  'protocol.mbus.error.recordTruncated': 'A data record (DIF/DIFE/VIF/VIFE/DATA) was cut off mid-way.',
  'protocol.mbus.warning.unknownCFunction':
    'The C Field function code is not in the narrow name set (outside SND_NKE/SND_UD/REQ_UD2/RSP_UD) — shown raw.',
  'protocol.mbus.warning.unknownCi': 'CI Field is not in the narrow name set — shown raw.',
  'protocol.mbus.warning.ciDataNotDecoded':
    'The CI Field was named, but its user data is not decoded in this wave (only the CI=0x72 path is decoded) — shown raw.',
  'protocol.mbus.warning.trailingBytes': 'There are extra bytes past the frame boundary.',
  'protocol.mbus.warning.invalidBcd':
    'BCD nibbles fall outside the 0-9 range — the field could not be decoded, raw bytes are shown instead.',
  'protocol.mbus.warning.manufacturerSpecificBlock':
    'DIF=0x0F/0x1F: the remaining data is manufacturer-specific — not decoded in this wave, shown raw.',
  'protocol.mbus.warning.specialFunctionDif':
    'A DIF Special Functions code (low nibble 0xF) is not in the recognized subset — the remaining data is shown raw.',
  'protocol.mbus.warning.unsupportedVifString':
    'VIF=0x7C: the real unit name follows as an ASCII string — not decoded in this wave, the remaining data is shown raw.',
  'protocol.mbus.warning.unknownLvarLength':
    'The LVAR length byte falls in the reserved range (0xFB-0xFF) — the real length is unknowable, the remaining data is shown raw.',
  'protocol.mbus.warning.vifeNotDecoded': 'The VIFE extension is shown raw — not decoded in this wave.',
  'protocol.mbus.warning.unknownMedium': 'Medium is not in the narrow name set — shown raw.',
  'protocol.mbus.warning.unnamedVif':
    'VIF is not in the narrow name set — the data is still decoded, but no unit name is given.',
  'protocol.mbus.summary.singleCharacter': 'Single-character acknowledgement (ACK)',
  'protocol.mbus.summary.shortFrame': 'Short Frame — C/A fields decoded, no user data',
  'protocol.mbus.summary.controlFrame': 'Control Frame — C/A/CI fields decoded, no user data',
  'protocol.mbus.summary.longFrame': 'Long Frame — C/A/CI and user data decoded',
  'protocol.mbus.documentation.summary':
    'M-Bus (EN 13757, wired): decodes the four frame classes (Single Character/Short/Control/Long Frame), validates the checksum with sum8Checksum, decodes the C Field (DIR/FCB-ACD/FCV-DFC bit by bit plus the SND_NKE/SND_UD/REQ_UD2/RSP_UD narrow name set), the A Field (the special addresses 0/253/254/255) and the CI Field (narrow name set). On the CI=0x72 path (Variable Data Respond, Mode 1) the Fixed Data Header (identification/manufacturer/medium…) and the DIF/DIFE/VIF/VIFE/DATA record chain are fully decoded (energy/volume/mass/power/temperature narrow VIF set turned into a scaled engineering value); every other CI path — including the Fixed Data Structure — is shown raw. Field names are cross-checked against libmbus (rSCADA) documentation and m-bus.com\'s "The M-Bus: A Documentation".',
  'protocol.mbus.example.singleCharacterAck.name': 'Single Character: ACK',
  'protocol.mbus.example.singleCharacterAck.description':
    'A single-byte acknowledgement frame (0xE5) — confirms successful receipt of SND_NKE/SND_UD/REQ_UD2.',
  'protocol.mbus.example.shortFrameReqUd2.name': 'Short Frame: REQ_UD2',
  'protocol.mbus.example.shortFrameReqUd2.description':
    "A master-to-slave data request (Class 2). C=0x5B (calling, FCV=1, REQ_UD2), address 1, checksum and stop both correct.",
  'protocol.mbus.example.controlFrameSndNke.name': 'Control Frame: SND_NKE',
  'protocol.mbus.example.controlFrameSndNke.description':
    'A link-state reset (SND_NKE), no user data (L=3). The CI byte is structurally present but carries an unrecognized value in this scenario — the warning path.',
  'protocol.mbus.example.longFrameRspUdVariableData.name':
    'Long Frame: RSP_UD, variable data structure (3 records)',
  'protocol.mbus.example.longFrameRspUdVariableData.description':
    'A heat meter response with manufacturer code KAM (Kamstrup): a Fixed Data Header plus Energy (123456 Wh), Volume (12565 → 12.565 m³, the same DIF/VIF/data bytes as m-bus.com\'s own worked example) and Flow Temperature (235 → 23.5°C) records.',
  'protocol.mbus.example.checksumMismatch.name': 'Checksum error',
  'protocol.mbus.example.checksumMismatch.description':
    'Same body as the REQ_UD2 example, checksum byte deliberately set to 0x00 — the checksum-mismatch error path.',
  'protocol.mbus.example.lengthCopiesMismatch.name': 'Length copies mismatch',
  'protocol.mbus.example.lengthCopiesMismatch.description':
    'Same body as the SND_NKE example, second L copy deliberately different (0x03 → 0x04) — the length-mismatch error path; still decoded using the first copy.',
  'protocol.mbus.example.unrecognizedCi.name': 'Unrecognized CI',
  'protocol.mbus.example.unrecognizedCi.description':
    'RSP_UD, CI=0x99 is not in the narrow name set — the user data is shown raw, only a warning is raised (not an error).',

  // --- EtherCAT ---
  'protocol.ethercat.error.frameTooShort':
    'The frame is shorter than the Ethernet header (14 bytes) plus the EtherCAT header (2 bytes).',
  'protocol.ethercat.error.frameTooLong': 'The frame exceeds the allowed maximum length.',
  'protocol.ethercat.error.aborted': 'Decoding was cancelled.',
  'protocol.ethercat.error.etherTypeNotEtherCat':
    'The EtherType is not 0x88A4 — this frame is not EtherCAT; the body was left raw and not decoded.',
  'protocol.ethercat.error.headerTruncated':
    'The EtherCAT header (2 bytes) is not complete after the EtherType field.',
  'protocol.ethercat.error.datagramRegionTruncated':
    'The datagram region promised by the EtherCAT Length field exceeds the bytes available in the buffer.',
  'protocol.ethercat.error.datagramHeaderTruncated':
    'Not enough bytes for a datagram header (10 bytes: Cmd/Idx/Address/Len/IRQ).',
  'protocol.ethercat.error.datagramBodyTruncated':
    'The data promised by the datagram Len field plus the Working Counter (2 bytes) does not fit in the region.',
  'protocol.ethercat.warning.frameReservedBitSet':
    'The reserved bit (bit 11) of the EtherCAT header is not zero — a conforming frame must keep it zero.',
  'protocol.ethercat.warning.nonCommandType':
    'The EtherCAT Type field is not 1 (commands/datagrams); the body was not decoded as a datagram chain and is shown raw.',
  'protocol.ethercat.warning.unknownCommand':
    'The command code is not in the cross-verified set (NOP/APRD…FRMW, 0x00-0x0E) — it is left unnamed and the address field stays raw instead of being split.',
  'protocol.ethercat.warning.datagramReservedBitsSet':
    'The reserved bits (bits 11-13) of the datagram length word are not zero.',
  'protocol.ethercat.warning.processDataNeedsConfiguration':
    'The meaning of the datagram data depends on the slave configuration (PDO mapping / ESC register map); it cannot be derived from a single frame, so it stays raw.',
  'protocol.ethercat.warning.workingCounterNotVerifiable':
    'The expected Working Counter value depends on the topology (how many slaves processed the datagram) and cannot be computed from a single frame — the value is shown as is, with no pass/fail claim.',
  'protocol.ethercat.warning.declaredLengthMismatch':
    'The EtherCAT Length field disagrees with the number of bytes the datagram chain actually consumed.',
  'protocol.ethercat.warning.moreFlagWithoutRoom':
    'The last datagram sets the “More” bit, but there is no room for another datagram in the region — the chain was stopped here.',
  'protocol.ethercat.warning.datagramLimitReached':
    'The datagram count reached its upper bound; the chain walk was stopped as an infinite-loop guard.',
  'protocol.ethercat.warning.paddingNotZero':
    'The bytes after the datagram region are not zero — Ethernet padding was expected.',
  'protocol.ethercat.summary.commandFrame':
    '{datagramCount} datagram(s), first command {firstCommand}',
  'protocol.ethercat.summary.nonCommandType': 'EtherCAT Type {type} — body raw',
  'protocol.ethercat.summary.notEtherCat': 'Not EtherCAT (EtherType {etherType})',
  'protocol.ethercat.documentation.summary':
    'EtherCAT (ETG.1000 / IEC 61158): the input is a COMPLETE Ethernet frame — DST/SRC MAC, optional VLAN tags and EtherType 0x88A4 are decoded, followed by the little-endian EtherCAT header (11-bit Length, reserved, 4-bit Type); when Type=1 the datagram chain is walked to its end via the “More” bit. Every datagram exposes Cmd (NOP/APRD/APWR/APRW/FPRD/FPWR/FPRW/BRD/BWR/BRW/LRD/LWR/LRW/ARMW/FRMW), Idx, an address split according to the addressing mode (a single 32-bit logical address for the logical commands, ADP + ADO otherwise), the 11-bit Len plus the Reserved/Circulating/More bits, IRQ, and the Working Counter that follows the data. The datagram data stays raw: its meaning depends on the slave configuration. Field layouts are cross-verified against Wireshark’s Beckhoff-authored EtherCAT plugin, the IgH EtherCAT Master and SOEM; codes that could not be confirmed (e.g. 0xFF) are left unnamed.',
  'protocol.ethercat.example.lrwCyclicProcessData.name': 'LRW: cyclic process data',
  'protocol.ethercat.example.lrwCyclicProcessData.description':
    'The most common frame: a single LRW datagram at logical address 0x00010000 carrying 4 bytes of process data, Working Counter 3. The frame is zero-padded to 60 bytes as it would be on the wire — the padding is shown as its own field.',
  'protocol.ethercat.example.fprdConfiguredAddressRead.name': 'FPRD: configured address read',
  'protocol.ethercat.example.fprdConfiguredAddressRead.description':
    'Reads 2 bytes from register 0x0130 of the slave at configured station address 0x03E9. The address field is split into ADP + ADO here (this is where it differs from the logical commands), Working Counter 1.',
  'protocol.ethercat.example.brdStartupScan.name': 'BRD: startup scan',
  'protocol.ethercat.example.brdStartupScan.description':
    'A broadcast read — how the number of slaves is counted at startup. The Working Counter increments for every slave that processed the datagram (3 here), but its expected value cannot be computed without topology knowledge.',
  'protocol.ethercat.example.multiDatagramChain.name': 'Chain: two datagrams (More=1)',
  'protocol.ethercat.example.multiDatagramChain.description':
    'Two datagrams in one frame: the first length word is 0x8002 (Len=2, More=1), the second is an LWR that closes the chain with More=0. The chain walk and two separate Working Counters are visible here.',
  'protocol.ethercat.example.unknownCommand.name': 'Unconfirmed command',
  'protocol.ethercat.example.unknownCommand.description':
    'Command 0xFF does not appear in all three sources — it is left unnamed, and because the address split is unknown too, its 4 bytes stay raw (no guessing). The frame is still valid; only a warning is raised.',
  'protocol.ethercat.example.nonCommandType.name': 'Type ≠ 1 (Mailbox)',
  'protocol.ethercat.example.nonCommandType.description':
    'The EtherCAT Type field is 5 (Mailbox): the body is not a datagram chain, and this engine does not attempt to decode it — it is shown raw with a warning.',
  'protocol.ethercat.example.etherTypeNotEtherCat.name': 'Wrong EtherType',
  'protocol.ethercat.example.etherTypeNotEtherCat.description':
    'Same body as the LRW example, EtherType deliberately set to 0x0800 (IPv4). The MAC fields are still decoded but the body is left alone — decoding datagrams under the wrong EtherType would be silently wrong decoding.',
  'protocol.ethercat.example.datagramTruncated.name': 'Truncated datagram region',
  'protocol.ethercat.example.datagramTruncated.description':
    'The EtherCAT Length promises a 16-byte region but only 6 bytes are on the wire — the truncated-frame error path.',
  'protocol.ethercat.example.frameTooShort.name': 'Frame too short',
  'protocol.ethercat.example.frameTooShort.description':
    '10 bytes: not even the Ethernet header is complete — a ParseFailure (recoverable, the stream may continue).',

  // --- IEC 61850 GOOSE ---
  'protocol.goose.error.frameTooShort':
    'The frame is not long enough for the Ethernet header (14 bytes) plus the GOOSE header (8 bytes).',
  'protocol.goose.error.frameTooLong': 'The frame exceeds the maximum allowed length.',
  'protocol.goose.error.aborted': 'Decoding was cancelled.',
  'protocol.goose.error.etherTypeNotGoose':
    'The EtherType is not 0x88B8 — this frame is not GOOSE; the body was left raw and undecoded.',
  'protocol.goose.error.headerTruncated':
    'The GOOSE header (APPID + Length + Reserved 1 + Reserved 2, 8 bytes) is incomplete after the EtherType.',
  'protocol.goose.error.lengthBelowHeader':
    'The Length field is below 8 — it counts from APPID onwards and therefore includes the header itself, so it can never be smaller.',
  'protocol.goose.error.apduTruncated':
    'The APDU promised by the Length field exceeds the bytes available in the buffer; the walk was clamped to what is actually on the wire.',
  'protocol.goose.error.pduTagNotGoose':
    'The first APDU tag is not 0x61 (goosePdu) — the body was left raw and undecoded.',
  'protocol.goose.error.berTruncated':
    'The buffer (or the enclosing TLV) ended before the BER value was complete.',
  'protocol.goose.error.berLongFormTag':
    'Multi-byte (long-form) BER tag: the low five bits are 0x1F. This decoder does not support it and refuses to silently read it as 31 — the field was left raw.',
  'protocol.goose.error.berIndefiniteLength':
    'Indefinite length (0x80) exists in BER but is invalid in DER and in GOOSE — the value was not decoded.',
  'protocol.goose.error.berReservedLengthOctet':
    'Length octet 0xFF is reserved by X.690; it is not a length.',
  'protocol.goose.error.berLengthOctetsUnsupported':
    'The long-form length uses more than four octets, which this decoder does not accept.',
  'protocol.goose.error.berValueOverflow':
    'The BER value reaches past its own boundary (the enclosing TLV or the end of the frame).',
  'protocol.goose.error.berUnexpectedValueLength':
    'The BER value length does not match its type (for example a BOOLEAN that is not a single octet).',
  'protocol.goose.warning.destinationNotGooseRange':
    'The destination MAC is outside the IEC/TC57 GOOSE multicast range (01:0C:CD:01:xx:xx). This is not an error — it is an informational note.',
  'protocol.goose.warning.reservedNotZero':
    'A Reserved field is non-zero. Bit 15 is reported as “Simulated” by a single public source but could not be cross-confirmed, so the field is shown raw rather than named. For simulation state rely on the cross-confirmed `simulation` field.',
  'protocol.goose.warning.gseManagementPdu':
    'The APDU is a gseMngtPdu (APPLICATION 0), a GOOSE management message. This engine decodes goosePdu only; the body was left raw.',
  'protocol.goose.warning.unknownPduField':
    'The goosePdu contains an unrecognised tag — it was not named and is shown raw.',
  'protocol.goose.warning.missingMandatoryField':
    'A mandatory goosePdu field is missing (goID, simulation and ndsCom are optional, so their absence raises no warning).',
  'protocol.goose.warning.valueNotDecodable':
    'The field tag was recognised but its value is not in the expected form — it was not decoded and is shown raw.',
  'protocol.goose.warning.nonPrintableString':
    'A VisibleString field contains bytes outside 0x20-0x7E — it was not rendered as text and is shown raw.',
  'protocol.goose.warning.timestampLengthUnexpected':
    'The timestamp is not 8 bytes, so it was not split into second/fraction/quality parts — showing raw bytes beats inventing a time.',
  'protocol.goose.warning.clockNotTrustworthy':
    'The TimeQuality byte reports a clock failure or loss of synchronisation — the timestamp is carried but the publisher says it does not trust it.',
  'protocol.goose.warning.unknownDataType':
    'The dataset element type tag does not appear in two independent sources — it was not named and is left raw.',
  'protocol.goose.warning.dataSemanticsNeedScl':
    'Which Data Attribute a dataset element maps to comes from the SCL definition and cannot be derived from a single frame. Types are named, meanings are not.',
  'protocol.goose.warning.dataSetCountMismatch':
    'numDatSetEntries does not match the number of elements in the dataset — publisher and subscriber configurations may have diverged.',
  'protocol.goose.warning.dataDepthLimit':
    'The nested dataset depth limit was reached; this level was not descended into (infinite-loop guard).',
  'protocol.goose.warning.dataElementLimit':
    'The dataset element limit was reached; the walk was stopped (infinite-loop guard).',
  'protocol.goose.warning.simulationActive':
    'The simulation (test) field is TRUE — this publication is a simulation and protection devices normally do not treat it as a real event.',
  'protocol.goose.warning.needsCommissioning':
    'ndsCom is TRUE — the GOOSE control block awaits commissioning, so the publication may not carry production data.',
  'protocol.goose.warning.securityNotDecoded':
    'The PDU carries the field reserved for a signature or security data. This tool does not decrypt or verify signatures; the field was left raw.',
  'protocol.goose.warning.paddingNotZero':
    'The bytes after the APDU are not zero — Ethernet padding was expected.',
  'protocol.goose.warning.trailingBytes':
    'Bytes remain after the goosePdu inside the region covered by the Length field — the APDU decoded shorter than declared.',
  'protocol.goose.summary.publication': '{goId} — stNum {stNum}, sqNum {sqNum}, {entryCount} values',
  'protocol.goose.summary.management': 'GOOSE management message (APPID {appId})',
  'protocol.goose.summary.notGoose': 'Not GOOSE (EtherType {etherType})',
  'protocol.goose.summary.pduUnreadable': 'GOOSE header read, PDU undecodable (APPID {appId})',
  'protocol.goose.documentation.summary':
    'IEC 61850 GOOSE: the input is a COMPLETE Ethernet frame — destination/source MAC, optional VLAN tags and EtherType 0x88B8 are decoded, followed by the 8-byte GOOSE header (APPID, Length, Reserved 1, Reserved 2) and the BER/TLV encoded goosePdu. The Length field counts from APPID onwards and does NOT include the Ethernet header. Every PDU field is named and decoded: gocbRef, timeAllowedtoLive, datSet, goID, t (split into SecondSinceEpoch + FractionOfSecond + TimeQuality), stNum, sqNum, simulation, confRev, ndsCom, numDatSetEntries and allData. Dataset elements are decoded shallowly by type tag (boolean, bit-string, integer, unsigned, floating-point, octet-string, visible-string, binary-time, utc-time, array, structure) and nested structures are descended with a depth limit. What is NOT covered, stated plainly: MMS and SCL import are absent in this release (hence the “Partial” badge), stNum/sqNum timelines and retransmission analysis need multiple frames and live outside the engine, dataset element SEMANTICS come from SCL and are not asserted, and signed or encrypted fields are not decoded. Field layouts are cross-confirmed against the Wireshark GOOSE dissector (goose.asn + packet-goose.c) and libIEC61850; no tag that could not be confirmed by two independent sources is named.',
  'protocol.goose.example.steadyStatePublication.name': 'Steady-state publication',
  'protocol.goose.example.steadyStatePublication.description':
    'A typical cyclic GOOSE publication: stNum 1 (state unchanged), sqNum 12 (the 12th repeat of that state), a four-element dataset (boolean, 13-bit bit-string, integer, boolean). The references are as long as in a real installation, so the PDU body passes 127 bytes and the long-form BER length (0x81 LL) is genuinely exercised here.',
  'protocol.goose.example.vlanTaggedPublication.name': 'VLAN-tagged publication',
  'protocol.goose.example.vlanTaggedPublication.description':
    'The same publication with an 802.1Q tag: PCP=4, VID=0 (priority-tagged), the customary form in 61850 installations. The tag adds four bytes so the GOOSE header and every PDU field shift; field offsets remain absolute against the RAW frame.',
  'protocol.goose.example.stateChangePublication.name': 'State change (stNum incremented)',
  'protocol.goose.example.stateChangePublication.description':
    'The first boolean flipped from FALSE to TRUE: stNum goes from 1 to 2 and sqNum resets to 0. The engine does NOT establish that relationship — it looks at one frame; stNum/sqNum timelines are analyzer work. The relationship is only described here.',
  'protocol.goose.example.structuredDataset.name': 'Nested structure with a measurement',
  'protocol.goose.example.structuredDataset.description':
    'The first dataset element is a structure holding an IEEE-754 floating-point value (230.5) and a bit-string; the second element is a utc-time. Nesting is descended with a depth limit, and the measurement SEMANTICS (which Data Attribute) are not named because they come from SCL.',
  'protocol.goose.example.simulatedPublication.name': 'Simulated publication',
  'protocol.goose.example.simulatedPublication.description':
    'The PDU simulation field is TRUE (cross-confirmed, therefore named) and Reserved 1 is non-zero. Bit 15 of Reserved 1 is reported as “Simulated” by only one public source, so it is NOT named: the field is shown raw and a warning is raised.',
  'protocol.goose.example.dataSetCountMismatch.name': 'numDatSetEntries mismatch',
  'protocol.goose.example.dataSetCountMismatch.description':
    'numDatSetEntries claims 4 but the dataset holds 2 elements. The frame is structurally valid, so only a warning is raised — this is the first on-the-wire sign of a configuration mismatch.',
  'protocol.goose.example.indefiniteLengthBer.name': 'Malformed BER length',
  'protocol.goose.example.indefiniteLengthBer.description':
    'The first dataset element carries a 0x80 length octet: “indefinite length” in BER, forbidden in GOOSE/DER. The decoder raises an explicit error and stops reading rather than silently printing a wrong value.',
  'protocol.goose.example.etherTypeNotGoose.name': 'Wrong EtherType',
  'protocol.goose.example.etherTypeNotGoose.description':
    'The same body as the steady-state example with the EtherType deliberately set to 0x0800 (IPv4). The MAC fields are still decoded but the body is left alone — walking BER under the wrong EtherType would be silently wrong decoding.',
  'protocol.goose.example.frameTooShort.name': 'Frame too short',
  'protocol.goose.example.frameTooShort.description':
    '16 bytes: the Ethernet header is present but the 8-byte GOOSE header is incomplete — a ParseFailure (recoverable, the stream may continue).',

  // --- DMX512 ---
  'protocol.dmx512.error.frameTooShort': 'Buffer is empty — not even a Start Code byte.',
  'protocol.dmx512.error.frameTooLong': 'The frame exceeds the given maximum length.',
  'protocol.dmx512.error.aborted': 'Parsing was cancelled.',
  'protocol.dmx512.warning.unrecognizedStartCode':
    'Start Code is not in the narrow named set (0x00 DMX Level Data, 0x17 Text Packet, 0xCC RDM, 0xCF System Information Packet) — shown raw.',
  'protocol.dmx512.warning.slotCountExceedsMaximum':
    'Slot count exceeds the 512 ceiling allowed by ANSI E1.11 — out of spec, but decoding continued.',
  'protocol.dmx512.summary.frame': 'Start Code {startCode}, {slotCount} slots',
  'protocol.dmx512.documentation.summary':
    'ANSI E1.11 (ESTA, DMX512-A): a DMX universe frame is a Start Code (byte 0) followed by up to 512 slots (bytes 1..N). BREAK and Mark After Break are physical signalling events and never reach this engine as bytes — the input starts at the START CODE. The Start Code is only named for a narrow set (0x00 DMX Level Data / standard lighting, named by the spec text itself; 0x17 Text Packet, 0xCC RDM, 0xCF System Information Packet from a secondary source — the spec text gives no numeric list); an unrecognized value is shown raw with a warning. Slots are raw 8-bit values: 16-bit (Coarse/Fine) combination and fixture personality (channel meaning) are NOT done by this engine — slot meaning depends on a fixture profile and is never guessed without one (the definitions tab stays planned). A frame with more than 512 slots is a warning, not an error (out of spec but still decoded). There is no checksum; “valid” comes only from structural (length) checks.',
  'protocol.dmx512.example.standardLightingBasic.name': 'Standard lighting, a few slots',
  'protocol.dmx512.example.standardLightingBasic.description':
    'Start Code 0x00 (DMX Level Data) plus the spec’s own RGB fixture example: Slot1 Red=255, Slot2 Green=128, Slot3 Blue=0, Slot4 Dimmer=200.',
  'protocol.dmx512.example.full512SlotUniverse.name': 'Full 512-slot universe',
  'protocol.dmx512.example.full512SlotUniverse.description':
    'Start Code 0x00 plus a full 512 slots — the maximum universe size ANSI E1.11 allows. The field table shows the first 16 slots individually and the remaining 496 in one summary field.',
  'protocol.dmx512.example.oversizedSlotCount.name': 'Exceeding the 512-slot ceiling',
  'protocol.dmx512.example.oversizedSlotCount.description':
    '520 slots — over the ANSI E1.11 limit of 512. Not an error, only a slotCountExceedsMaximum warning; the frame is still decoded to the end.',
  'protocol.dmx512.example.unrecognizedStartCode.name': 'Unrecognized Start Code',
  'protocol.dmx512.example.unrecognizedStartCode.description':
    'Start Code 0x01 — not in the narrow named set. The field is shown raw and an unrecognizedStartCode warning is raised; the frame is still structurally valid.',
  'protocol.dmx512.example.recognizedAlternateStartCode.name':
    'Recognized alternate Start Code (0xCC RDM)',
  'protocol.dmx512.example.recognizedAlternateStartCode.description':
    'Start Code 0xCC — the RDM (Remote Device Management) alternate code, named from a secondary source. Shows that start codes other than 0x00 can be named too.',
  'protocol.dmx512.example.minimalStartCodeOnly.name': 'Start Code only (0 slots)',
  'protocol.dmx512.example.minimalStartCodeOnly.description':
    'The smallest valid frame at 1 byte: only the Start Code, no slot data at all.',

  // --- Art-Net (phase 10 wave 6b) ---
  'protocol.artnet.error.headerTooShort': 'Buffer too short — cannot even read the OpCode (10 bytes minimum).',
  'protocol.artnet.error.frameTooLong': 'The frame exceeds the given maximum length.',
  'protocol.artnet.error.aborted': 'Parsing was cancelled.',
  'protocol.artnet.error.invalidSignature':
    'The first 8 bytes do not match the "Art-Net" signature — this is not an Art-Net packet.',
  'protocol.artnet.error.headerTruncated': 'Not enough bytes for the ProtVer field.',
  'protocol.artnet.error.bodyTruncated': 'The body does not contain enough bytes for the expected field.',
  'protocol.artnet.warning.unrecognizedOpcode': 'An OpCode value not defined in Table 1.',
  'protocol.artnet.warning.opcodeBodyNotDecoded':
    'The OpCode name is known but its body structure is not decoded by this engine.',
  'protocol.artnet.warning.unknownDiagPriority': 'A DiagPriority value not defined in Table 5.',
  'protocol.artnet.warning.lengthMismatch':
    'The Length field does not match the number of DMX data bytes actually present in the packet.',
  'protocol.artnet.summary.artDmx': 'ArtDmx — Net {net}/SubUni {subUni}, Sequence {sequence}, {length} bytes',
  'protocol.artnet.summary.artPoll': 'ArtPoll — Flags {flags}, DiagPriority {diagPriority}',
  'protocol.artnet.summary.artPollReply': 'ArtPollReply — {ip}:{port}',
  'protocol.artnet.summary.namedOpcodeRawBody': '{opcodeName} — body not decoded (raw)',
  'protocol.artnet.summary.unknownOpcode': 'Unrecognized OpCode {opCode}',
  'protocol.artnet.summary.invalidSignature': 'Invalid Art-Net signature',
  'protocol.artnet.summary.headerTruncated': 'Header incomplete — could not read ProtVer.',
  'protocol.artnet.documentation.summary':
    "Artistic Licence's royalty-free Art-Net 4 protocol: a common header (ID+OpCode+ProtVer in most packets) followed by a body that branches on OpCode — ArtDmx is fully decoded, ArtPoll/ArtPollReply with a narrow field set, and the remaining OpCodes only by name plus a raw body.",
  'protocol.artnet.example.artDmxHappyPath.name': 'ArtDmx happy path (a few channels)',
  'protocol.artnet.example.artDmxHappyPath.description':
    "Sequence=0 (disabled), Net=0/SubUni=0, 4 channels of DMX data (Red 255, Green 128, Blue 0, Dimmer 200 — the same illustrative values as dmx512.ts's ANSI E1.11 example). Data[0] is directly Channel 1, there is no separate start code byte.",
  'protocol.artnet.example.artDmxFull512Universe.name': 'ArtDmx — full 512-channel universe',
  'protocol.artnet.example.artDmxFull512Universe.description':
    "Sequence=1, SubUni=1, 512 channels of deterministic filler data (6a's preview/summary-field pattern applies here too: the first 16 channels are separate fields, the rest is a single summary block).",
  'protocol.artnet.example.artPollBasic.name': 'ArtPoll — Flags + DiagPriority',
  'protocol.artnet.example.artPollBasic.description':
    'Flags=0x02 (diagnostics requested), DiagPriority=0x80 (DpHigh, Table 5). The remaining ArtPoll fields (TargetPortAddress, EstaMan, Oem…) sit in a single raw block.',
  'protocol.artnet.example.artPollReplyPartial.name': 'ArtPollReply — partial fields + raw remainder',
  'protocol.artnet.example.artPollReplyPartial.description':
    'IP Address, Port and PortName are named; the node-info bytes in between and everything after PortName (LongName/NodeReport/…) stay as raw blocks.',
  'protocol.artnet.example.artTimeCodeBodyNotDecoded.name': 'ArtTimeCode — OpCode recognized, body raw',
  'protocol.artnet.example.artTimeCodeBodyNotDecoded.description':
    'OpCode 0x9700 is named from Table 1 but its body fields are not decoded by this engine — the "OpCode name known, body not decoded" warning.',
  'protocol.artnet.example.unknownOpcode.name': 'Unrecognized OpCode',
  'protocol.artnet.example.unknownOpcode.description':
    'OpCode value 0x1234, which is not in Table 1 — triggers the "unrecognized OpCode" warning at both the field and the frame level.',
  'protocol.artnet.example.invalidSignature.name': 'Corrupted signature (not Art-Net)',
  'protocol.artnet.example.invalidSignature.description':
    "First byte is 0x58 ('X') instead of 0x41 ('A') — the mandatory 8-byte signature does not hold, parsing stops right after the ID field (error path).",
  'protocol.artnet.example.artDmxLengthMismatch.name': 'ArtDmx — inconsistent Length field',
  'protocol.artnet.example.artDmxLengthMismatch.description':
    'The Length field declares 10 bytes but the packet only carries 4 bytes of DMX data — a warning, not an error; the Data field shows the bytes that are actually present.',

  // --- sACN / ANSI E1.31 (wave 6c) ---
  'protocol.sacn.error.frameTooShort':
    'Buffer too short — cannot even read the ACN Packet Identifier (16 bytes minimum required).',
  'protocol.sacn.error.invalidAcnPacketIdentifier':
    'The ACN Packet Identifier does not match the expected signature — this packet is not sACN (E1.31).',
  'protocol.sacn.error.bodyTruncated': 'The body does not contain enough bytes for the expected field.',
  'protocol.sacn.error.frameTooLong': 'The frame exceeds the given maximum length.',
  'protocol.sacn.error.aborted': 'Parsing was cancelled.',
  'protocol.sacn.warning.unexpectedFixedValue':
    'This field expects one spec-mandated fixed value, but the packet carries a different one.',
  'protocol.sacn.warning.unexpectedFlagsNibble':
    'The top 4 bits of the Flags&Length field are not the expected 0x7 pattern.',
  'protocol.sacn.warning.unrecognizedRootVector':
    'The Root Layer Vector value is neither VECTOR_ROOT_E131_DATA nor VECTOR_ROOT_E131_EXTENDED.',
  'protocol.sacn.warning.rootVectorBodyNotDecoded':
    'The Root Vector points at a Synchronization/Universe Discovery packet — this packet type\'s body is not decoded by this engine.',
  'protocol.sacn.warning.priorityOutOfRange': 'The Priority value is outside the 0-200 range.',
  'protocol.sacn.warning.universeOutOfRange':
    'The Universe value is outside the 1-63999 range (0 and 64000-65535 are reserved).',
  'protocol.sacn.warning.layerLengthMismatch':
    'The Root/Framing/DMP Flags&Length and Property Value Count declarations do not all point at the same total frame length.',
  'protocol.sacn.summary.dataPacket': '{sourceName} — Universe {universe}, Priority {priority}, {slotCount} slots',
  'protocol.sacn.summary.extendedRootVectorRaw':
    'Synchronization/Universe Discovery packet — body not decoded (raw)',
  'protocol.sacn.summary.unrecognizedRootVector': 'Unrecognized Root Vector {rootVector}',
  'protocol.sacn.summary.invalidAcnPacketIdentifier': 'Invalid ACN Packet Identifier',
  'protocol.sacn.documentation.summary':
    'ANSI E1.31 (sACN): streams DMX512-A data over UDP/IP through Root→Framing→DMP layers, identifies every source by its CID, and resolves universe contention with a numeric source priority.',
  'protocol.sacn.example.dataPacketHappyPath.name': 'E1.31 Data Packet — happy path (a few slots)',
  'protocol.sacn.example.dataPacketHappyPath.description':
    "Start Code 0x00 plus the spec's own RGB fixture example: Red 255, Green 128, Blue 0, Dimmer 200 (same display values as dmx512.ts/artnet.ts). Priority 100 (default), Universe 1.",
  'protocol.sacn.example.dataPacketFull512Universe.name': 'E1.31 Data Packet — full 512-slot universe',
  'protocol.sacn.example.dataPacketFull512Universe.description':
    "Start Code plus 512 slots, deterministic fill (slot K value K mod 256) — the total frame matches the spec's own worked example (§5.4 NOTE) exactly: 638 bytes.",
  'protocol.sacn.example.priorityBoundaryZero.name': 'Priority boundary value — 0',
  'protocol.sacn.example.priorityBoundaryZero.description':
    'The Priority field sits at the lower bound of the valid range (0-200) — no warning.',
  'protocol.sacn.example.priorityBoundaryTwoHundred.name': 'Priority boundary value — 200',
  'protocol.sacn.example.priorityBoundaryTwoHundred.description':
    'The Priority field sits at the upper bound of the valid range (0-200, the highest priority) — no warning.',
  'protocol.sacn.example.optionsStreamTerminated.name': 'Options — Stream_Terminated bit set',
  'protocol.sacn.example.optionsStreamTerminated.description':
    'Bit 6 of the Options byte (Stream_Terminated) is 1 — indicates the source has terminated transmission of this universe; Preview_Data and Force_Synchronization stay 0.',
  'protocol.sacn.example.universeOutOfRange.name': 'Universe out of range (64214, reserved for Discovery)',
  'protocol.sacn.example.universeOutOfRange.description':
    'Universe 64214 = E131_DISCOVERY_UNIVERSE (Appendix A) — reserved for the Universe Discovery packet, so it counts as outside the valid range (1-63999) in a Data Packet; a warning, not an error.',
  'protocol.sacn.example.invalidAcnPacketIdentifier.name': 'Corrupted ACN Packet Identifier (not E1.31)',
  'protocol.sacn.example.invalidAcnPacketIdentifier.description':
    "The first signature byte is 0x58 ('X') instead of 0x41 ('A') — the mandatory 12-byte ACN Packet Identifier does not hold, parsing stops right after this field (error path).",
  'protocol.sacn.example.layerLengthMismatch.name': 'Layer-length mismatch',
  'protocol.sacn.example.layerLengthMismatch.description':
    'The DMP Property Value Count declares 10 more than the slot data actually present — the four length declarations (Root/Framing/DMP Flags&Length plus Property Value Count) no longer point at the same total frame; a warning, not an error, and fields are still decoded from the bytes actually present.',
  'protocol.sacn.example.rootVectorExtendedNotDecoded.name': 'Root Vector EXTENDED — body not decoded',
  'protocol.sacn.example.rootVectorExtendedNotDecoded.description':
    "The Root Layer Vector is VECTOR_ROOT_E131_EXTENDED (a Synchronization/Universe Discovery packet) — that packet type's Framing Layer is completely different from the Data Packet's, so the body stays a raw block this round.",

  // --- DALI (faz 10 dalga 6d) ---
  'protocol.dali.error.frameTooShort': 'Buffer is empty — it does not match any DALI frame length.',
  'protocol.dali.error.frameTooLong': 'The frame exceeds the given maximum length.',
  'protocol.dali.error.aborted': 'Parsing was cancelled.',
  'protocol.dali.warning.unrecognizedAddressClass':
    'The Address Byte does not match any of the Individual/Group/Broadcast patterns — shown raw.',
  'protocol.dali.warning.unrecognizedOpcode':
    'The opcode is not in the narrow named set (OFF, Go To Scene, Set Fade Time, Store Scene, Query Actual Level, Query Lamp Failure) — shown raw with category only.',
  'protocol.dali.warning.backwardFrameContextDependent':
    "Which Query this 8-bit response answers cannot be known from a single frame — interpretation depends on the preceding forward frame.",
  'protocol.dali.warning.dali2DeviceFramePlanned':
    'This 3-byte frame may be a DALI-2 24-bit control-device frame — out of scope for this wave, shown raw (planned).',
  'protocol.dali.summary.backwardFrame': 'Backward frame — response {value}',
  'protocol.dali.summary.forwardDapc': '{address} — DAPC {command}',
  'protocol.dali.summary.forwardCommand': '{address} — {command}',
  'protocol.dali.summary.dali2DeviceFrame': 'DALI-2 device frame (planned)',
  'protocol.dali.documentation.summary':
    "IEC 62386 (DALI) family: input is a raw 1-byte (backward), 2-byte (forward) or 3-byte (DALI-2 device frame, planned this wave) byte sequence — the physical layer's Manchester coding never reaches this engine. In a forward frame the Address Byte's upper bits classify it as Individual (0AAAAAAS, 6 bits, 0-63) / Group (100AAAAS, 4 bits, 0-15) / Broadcast (1111111S); the lowest bit (S) decides whether the Data Byte is DAPC (Direct Arc Power, 0-254 plus 255=MASK) or a Command. Commands are named from a narrow set (OFF, Go To Scene, Set Fade Time, Store Scene, Query Actual Level, Query Lamp Failure) plus a Control/Configuration/Query category; opcodes outside the set are shown raw with category only, never a made-up name. A backward frame's 8-bit response cannot be interpreted without context (which Query it answers is unknown to this engine). There is no checksum; \"valid\" comes only from the structural (length) check.",
  'protocol.dali.example.individualDapc.name': 'Individual address + DAPC (arc power level)',
  'protocol.dali.example.individualDapc.description':
    'Individual 5 (Address Byte 0x0A), Data Byte 200 — a Direct Arc Power Control target level (in the 0-254 range).',
  'protocol.dali.example.individualRecognizedCommandOff.name':
    'Individual address + recognized command (OFF)',
  'protocol.dali.example.individualRecognizedCommandOff.description':
    'Individual 5 (Address Byte 0x0B, S=1), Command OFF (0x00) — the most basic control command in the narrow named set.',
  'protocol.dali.example.groupCommand.name': 'Group address + command (Go To Scene)',
  'protocol.dali.example.groupCommand.description':
    'Group 3 (Address Byte 0x87), Command Go To Scene 7 (0x17) — the scene number is derived with the opcode-0x10 formula.',
  'protocol.dali.example.broadcastCommand.name': 'Broadcast + command (OFF)',
  'protocol.dali.example.broadcastCommand.description':
    'Broadcast (Address Byte 0xFF), Command OFF (0x00) — the classic broadcast frame that turns every device on the bus off at once.',
  'protocol.dali.example.unrecognizedOpcode.name': 'Unrecognized opcode (warning path)',
  'protocol.dali.example.unrecognizedOpcode.description':
    "Individual 10, Command 0x01 (known in DALI as \"UP\", but NOT in this engine's narrow named set) — shown raw with only its category (Control), no name is invented.",
  'protocol.dali.example.backwardFrameResponse.name': 'Backward frame — 8-bit response',
  'protocol.dali.example.backwardFrameResponse.description':
    'A single response byte (0xD2) — which Query it belongs to cannot be known from this one frame, only the raw value plus a context warning are shown.',
  'protocol.dali.example.dali2DeviceFrame.name': '3-byte DALI-2 device frame (out of scope)',
  'protocol.dali.example.dali2DeviceFrame.description':
    'Per Decision 6, the structure of the 24-bit DALI-2 control-device frame is not decoded this wave — all bytes are shown raw with a "planned" warning, no error is raised.',
  'protocol.dali.example.unrecognizedLength.name': 'Unrecognized length (error path)',
  'protocol.dali.example.unrecognizedLength.description':
    "4 bytes — matches none of DALI's backward (1), forward (2) or DALI-2 device (3) lengths, so it returns a ParseFailure.",

  // --- KNX (phase 10 wave 6e) ---
  'protocol.knx.error.frameTooShort':
    'Buffer does not contain enough bytes for the Standard L_Data header or the length declared by NPCI.',
  'protocol.knx.error.frameTooLong': 'The frame exceeds the given maximum length.',
  'protocol.knx.error.aborted': 'Parsing was cancelled.',
  'protocol.knx.error.checksumMismatch':
    'The calculated (inverted XOR) checksum does not match the value carried in the frame.',
  'protocol.knx.warning.extendedFrameOutOfScope':
    'Extended frame (Control Field bit7=0) is out of scope for this wave — the body is shown raw without being decoded.',
  'protocol.knx.warning.unrecognizedApci':
    'The APCI value is not in the narrow named set (GroupValueRead, GroupValueWrite, GroupValueResponse) — shown raw.',
  'protocol.knx.warning.unexpectedReservedBits':
    "The Control Field's fixed/reserved bits (bit6, bit4, bit1, bit0) are not in the expected pattern.",
  'protocol.knx.summary.namedService': '{apci} — {destination}',
  'protocol.knx.summary.unrecognizedApci': 'Unrecognized APCI — {destination}',
  'protocol.knx.summary.extendedFrame': 'Extended frame (out of scope, raw)',
  'protocol.knx.documentation.summary':
    'KNX Standard/ISO 22510 family: a TP1 Standard L_Data telegram — Control Field (Frame Type/Repeat/Priority), Source/Destination Address (Individual `a.b.c` / Group `a/b/c`, shown with TWO SEPARATE formatters depending on the AT bit), NPCI (Address Type + Hop Count + Length — the Length field is OFF-BY-ONE: the actual TPCI/APCI+data byte count is Length+1), TPCI/APCI (a narrow named set: GroupValueRead, GroupValueWrite, GroupValueResponse; anything else is shown raw with a warning). The payload stays RAW without a DPT (Datapoint Type) — shown as e.g. "raw uint16: 100", the engineering value is never invented. The checksum is an inverted (NOT) XOR. Extended frames (Control Field bit7=0) and KNXnet/IP are out of scope for this engine.',
  'protocol.knx.example.groupValueWrite.name': 'GroupValueWrite — group address (happy path)',
  'protocol.knx.example.groupValueWrite.description':
    'Source 1.1.10, Destination 2/1/5 (Group), Priority Low. GroupValueWrite sends an inline value of 1 — since the DPT is unknown, the "Light ON" meaning is never invented, only the raw bit is shown.',
  'protocol.knx.example.groupValueRead.name': 'GroupValueRead — query without a payload',
  'protocol.knx.example.groupValueRead.description':
    'Source 1.1.10, Destination 2/1/6 (Group), Priority Alarm. GroupValueRead carries no payload.',
  'protocol.knx.example.groupValueResponse.name': 'GroupValueResponse — 2-byte raw value (00 64)',
  'protocol.knx.example.groupValueResponse.description':
    'Source 1.1.10, Destination 3/2/10 (Group), Priority High. An appended 2-byte payload `00 64` (=100) — the exact same byte pair as the catalog comment\'s own "raw uint16: 100" example.',
  'protocol.knx.example.individualAddressDestination.name': 'Telegram addressed to an Individual Address',
  'protocol.knx.example.individualAddressDestination.description':
    'Source 1.1.10, Destination 4.2.100 (Individual — AT=0), Priority System. The same GroupValueWrite APCI sent to an Individual instead of a Group destination — the display becomes `4.2.100`, never confused with `X/Y/Z`.',
  'protocol.knx.example.extendedFrame.name': 'Extended frame (warning path, raw)',
  'protocol.knx.example.extendedFrame.description':
    'Control Field bit7=0 — out of scope per Decision 5. The Control Field is still decoded (Repeat, Priority), but the body is shown raw with an "out of scope" warning; no error is raised.',
  'protocol.knx.example.unrecognizedApci.name': 'Unrecognized APCI (warning path)',
  'protocol.knx.example.unrecognizedApci.description':
    "Source 1.1.10, Destination 4/3/20 (Group). APCI code 3 (IndividualAddress_Write in the full APCI table, but NOT in this wave's narrow named set) — shown raw only, no name is invented.",
  'protocol.knx.example.checksumMismatch.name': 'Corrupted checksum (error path)',
  'protocol.knx.example.checksumMismatch.description':
    'The exact same frame as "GroupValueWrite — group address", except the last byte (checksum) was deliberately corrupted — not a ParseFailure, but the frame carries valid:false and a checksum-mismatch error.',

  // --- BACnet MS/TP (phase 10 wave 6f) ---
  'protocol.bacnetMstp.error.frameTooShort':
    'The buffer does not contain the 8 bytes required for Preamble + Frame Type + MAC addresses + Length + Header CRC.',
  'protocol.bacnetMstp.error.frameTooLong': 'The frame exceeds the given maximum length.',
  'protocol.bacnetMstp.error.aborted': 'Parsing was cancelled.',
  'protocol.bacnetMstp.error.lengthMismatch':
    'The buffer does not contain the full Data (and, if present, Data CRC) bytes promised by the Length field.',
  'protocol.bacnetMstp.error.preambleInvalid': 'Preamble is not 0x55 0xFF — the frame signature was not recognized.',
  'protocol.bacnetMstp.error.headerCrcMismatch': 'The calculated Header CRC-8 does not match the value carried in the frame.',
  'protocol.bacnetMstp.error.dataCrcMismatch': 'The calculated Data CRC-16 does not match the value carried in the frame.',
  'protocol.bacnetMstp.error.npduTruncated': 'Not enough bytes in the buffer for the NPDU fields.',
  'protocol.bacnetMstp.error.apduTruncated': 'Not enough bytes in the buffer for the APDU fields.',
  'protocol.bacnetMstp.warning.unknownFrameType':
    'The Frame Type value is not in the narrow named set (Token, Poll For Master, … Reply Postponed) — shown raw.',
  'protocol.bacnetMstp.warning.dataNotNpdu':
    "This Frame Type does not carry NPDU/APDU (Test_Request/Response, reserved, or vendor-proprietary) — Data is shown raw.",
  'protocol.bacnetMstp.warning.unknownNetworkMessageType':
    'The Network Layer Message type is not in the narrow named set — shown raw.',
  'protocol.bacnetMstp.warning.unexpectedNpduVersion': 'The NPDU Version field is not the expected value of 1.',
  'protocol.bacnetMstp.warning.unknownPduType':
    'The APDU PDU Type value is not in the narrow named set (Confirmed-Request … Abort) — the remaining bytes are shown raw.',
  'protocol.bacnetMstp.warning.unknownServiceChoice':
    'The Service Choice value is not in the narrow named set — shown raw.',
  'protocol.bacnetMstp.warning.serviceParametersNotDecoded':
    "Service parameters are carried in BACnet's tag-based encoding; this engine does not decode them, that is tied to the official standard — shown as a raw block.",
  'protocol.bacnetMstp.summary.noData': '{frameType}',
  'protocol.bacnetMstp.summary.apdu': '{frameType}: {pduType} — {serviceChoice}',
  'protocol.bacnetMstp.summary.networkLayerMessage': '{frameType}: {messageType}',
  'protocol.bacnetMstp.summary.rawData': '{frameType} (raw)',
  'protocol.bacnetMstp.documentation.summary':
    'BACnet MS/TP (Master-Slave/Token-Passing) data-link frame: Preamble, Frame Type (a narrow named set), Destination/Source MAC Address (NEVER confused with the BACnet Device Instance), Length, Header CRC-8, and — if Length>0 — Data plus a Data CRC-16. Data is decoded into an NPDU + APDU HEADER (PDU type, Invoke ID, Service Choice name) through a shared core (npdu.ts/apdu.ts) only for the "BACnet Data Expecting Reply" and "BACnet Data Not Expecting Reply" Frame Types; tag-based service parameters stay RAW. Token rotation and error analysis are out of scope for this engine.',
  'protocol.bacnetMstp.example.token.name': 'Token (Length=0, no Data CRC)',
  'protocol.bacnetMstp.example.token.description':
    'A Token frame from MAC 1 to MAC 5. Since Length=0, the Data and Data CRC fields do not exist at all — the frame ends at the Header CRC.',
  'protocol.bacnetMstp.example.pollForMaster.name': 'Poll For Master (Length=0, a second Frame Type)',
  'protocol.bacnetMstp.example.pollForMaster.description':
    'A Poll For Master frame from MAC 5 to MAC 1 — shows that the Length=0 path is not specific to Token, it works the same way for another Frame Type too.',
  'protocol.bacnetMstp.example.dataExpectingReplyReadProperty.name':
    'BACnet Data Expecting Reply — Confirmed-Request / ReadProperty',
  'protocol.bacnetMstp.example.dataExpectingReplyReadProperty.description':
    'From MAC 1 to MAC 10; NPDU Expecting Reply=1, APDU Confirmed-Request (Invoke ID 1, Service Choice ReadProperty). The 3-byte service parameters are representative only — not decoded by this engine.',
  'protocol.bacnetMstp.example.dataNotExpectingReplyIAm.name':
    'BACnet Data Not Expecting Reply — Unconfirmed-Request / I-Am',
  'protocol.bacnetMstp.example.dataNotExpectingReplyIAm.description':
    'From MAC 10 to the broadcast MAC (0xFF); APDU Unconfirmed-Request (Service Choice I-Am), no Invoke ID. The 4-byte service parameters are representative only.',
  'protocol.bacnetMstp.example.badHeaderCrc.name': 'Corrupted Header CRC (error path)',
  'protocol.bacnetMstp.example.badHeaderCrc.description':
    'The exact same body as "Token", except the Header CRC byte was deliberately corrupted — not a ParseFailure, but the frame carries valid:false and a crc-mismatch error.',
  'protocol.bacnetMstp.example.badDataCrc.name': 'Corrupted Data CRC (error path)',
  'protocol.bacnetMstp.example.badDataCrc.description':
    'The exact same body as "BACnet Data Not Expecting Reply — Unconfirmed-Request / I-Am", with a CORRECT Header CRC but the last byte of the Data CRC deliberately corrupted — NPDU/APDU are still decoded structurally, only the Data CRC field is valid:false.',
  'protocol.bacnetMstp.example.unrecognizedFrameType.name': 'Unrecognized Frame Type (warning path)',
  'protocol.bacnetMstp.example.unrecognizedFrameType.description':
    'Frame Type 0xC8 (vendor-proprietary range) is not in the narrow named set — only a warning is raised (both CRCs are correct); Data is shown as a raw block rather than as NPDU/APDU.',

  // --- BACnet/IP (phase 10 wave 6g) ---
  'protocol.bacnetIp.error.headerTruncated':
    'The buffer does not contain enough data for the 4-byte BVLC header (Type + Function + Length).',
  'protocol.bacnetIp.error.frameTooLong': 'The frame exceeds the given maximum length.',
  'protocol.bacnetIp.error.aborted': 'Parsing was cancelled.',
  'protocol.bacnetIp.error.typeInvalid':
    'The BVLC Type byte is not 0x81 — this was not recognized as a BACnet/IP (Annex J) message.',
  'protocol.bacnetIp.error.bipAddressTruncated':
    'Not enough bytes in the buffer for the 6-byte Originating Device B/IP Address field of a Forwarded-NPDU.',
  'protocol.bacnetIp.warning.lengthMismatch':
    'The BVLC Length field (the total length, including itself) does not match the actual packet size.',
  'protocol.bacnetIp.warning.unknownFunction':
    'The BVLC Function value is not in the narrow named set (BVLC-Result … Original-Broadcast-NPDU) — shown raw.',
  'protocol.bacnetIp.warning.functionBodyNotDecoded':
    "This BVLC function's body (including any BBMD/Foreign Device table contents) is not decoded by this engine — shown as a raw block.",
  'protocol.bacnetIp.summary.noBody': '{function}',
  'protocol.bacnetIp.summary.apdu': '{function}: {pduType} — {serviceChoice}',
  'protocol.bacnetIp.summary.networkLayerMessage': '{function}: {messageType}',
  'protocol.bacnetIp.summary.rawData': '{function} (raw)',
  'protocol.bacnetIp.documentation.summary':
    'BACnet/IP (BVLL — BACnet Virtual Link Layer, ANSI/ASHRAE 135 Annex J): decodes the BVLC header (Type=0x81 fixed, Function from a narrow named set, Length — the total length INCLUDING ITSELF). Original-Unicast-NPDU / Original-Broadcast-NPDU / Forwarded-NPDU (AFTER a 6-byte B/IP address) are decoded into an NPDU + APDU HEADER through a shared core (npdu.ts/apdu.ts, SHARED with BACnet MS/TP); tag-based service parameters stay RAW. Other BVLC functions (BVLC-Result, Broadcast Distribution Table/Foreign Device Table reads and writes, Register-Foreign-Device, etc.) are shown only as a NAME plus a RAW body — BBMD/Foreign Device table tracking is out of scope for this engine.',
  'protocol.bacnetIp.example.originalUnicastNpduReadProperty.name':
    'Original-Unicast-NPDU — Confirmed-Request / ReadProperty (happy path)',
  'protocol.bacnetIp.example.originalUnicastNpduReadProperty.description':
    "BVLC Function 0x0A. NPDU Expecting Reply=1, APDU Confirmed-Request (Invoke ID 1, Service Choice ReadProperty) — the exact same bytes as bacnetmstp.ts's already-tested Data body, proving the shared core also works correctly in a BVLL context.",
  'protocol.bacnetIp.example.originalBroadcastNpduIAm.name': 'Original-Broadcast-NPDU — Unconfirmed-Request / I-Am',
  'protocol.bacnetIp.example.originalBroadcastNpduIAm.description':
    'BVLC Function 0x0B. APDU Unconfirmed-Request (Service Choice I-Am), no Invoke ID — the exact same Data body as bacnetmstp.ts\'s "data-not-expecting-reply-i-am" example.',
  'protocol.bacnetIp.example.forwardedNpdu.name': 'Forwarded-NPDU — with a B/IP address',
  'protocol.bacnetIp.example.forwardedNpdu.description':
    'BVLC Function 0x04. A 6-byte Originating Device B/IP Address (192.168.1.50:47808) comes BEFORE the NPDU — the NPDU only starts at offset 10; the body is the exact same as the "Original-Broadcast-NPDU" example (I-Am).',
  'protocol.bacnetIp.example.registerForeignDevice.name': 'Register-Foreign-Device (warning path, raw body)',
  'protocol.bacnetIp.example.registerForeignDevice.description':
    'BVLC Function 0x05, a 2-byte Time-To-Live (300s) body — in the narrow named set, BUT its body is not decoded by this engine, shown raw with a warning; BBMD/Foreign Device table tracking is NOT performed.',
  'protocol.bacnetIp.example.bvlcResult.name': 'BVLC-Result (narrow name + raw body)',
  'protocol.bacnetIp.example.bvlcResult.description': 'BVLC Function 0x00, a 2-byte Result Code body shown raw.',
  'protocol.bacnetIp.example.lengthMismatch.name': 'Length mismatch (warning path)',
  'protocol.bacnetIp.example.lengthMismatch.description':
    'The exact same 13-byte body as "Original-Unicast-NPDU — Confirmed-Request / ReadProperty", except the Length field was deliberately set to 99 — the actual packet size (the UDP datagram) is treated as the only source of truth, so this only raises a WARNING; the frame stays structurally valid:true.',
  'protocol.bacnetIp.example.invalidType.name': 'Type ≠ 0x81 (error path)',
  'protocol.bacnetIp.example.invalidType.description':
    'The exact same body as "Original-Unicast-NPDU — Confirmed-Request / ReadProperty", except the BVLC Type byte is 0x01 instead of 0x81 — this is not recognized as a BACnet/IP message (error), but the remaining fields are still decoded structurally at their fixed offsets.',

  // --- BLE Advertisement ---
  'protocol.bleAdvertisement.error.frameTooShort': 'The frame must be at least the 2-byte PDU Header long.',
  'protocol.bleAdvertisement.error.frameTooLong': 'The frame exceeds the maximum allowed length.',
  'protocol.bleAdvertisement.error.aborted': 'Parsing was aborted.',
  'protocol.bleAdvertisement.error.payloadTooShort':
    'Not enough bytes in the payload for AdvA (at least 6 bytes required).',
  'protocol.bleAdvertisement.error.adLengthZero':
    'AD Structure Length field is 0 — invalid, it must at least cover the AD Type byte.',
  'protocol.bleAdvertisement.error.adStructureTruncated':
    'Not enough bytes in the buffer for a declared AD Structure length.',
  'protocol.bleAdvertisement.warning.unknownPduType':
    'PDU Type is not in the narrow named set; the type could not be named.',
  'protocol.bleAdvertisement.warning.lengthMismatch':
    'The Length field in the header does not match the actual number of remaining bytes.',
  'protocol.bleAdvertisement.warning.payloadSchemaNotDecoded':
    "This PDU type's payload schema (not AdvA+AD chain) is not decoded in this wave; shown raw.",
  'protocol.bleAdvertisement.warning.unknownAdType':
    'AD Type is not in the narrow named set; shown raw with its type number.',

  'protocol.bleAdvertisement.documentation.summary':
    'BLE Advertisement decodes the advertising-channel PDU: a 2-byte Header (PDU Type/RFU/ChSel/TxAdd/RxAdd/Length) + Payload. Only for the four AD-bearing PDU types (ADV_IND/ADV_NONCONN_IND/ADV_SCAN_IND/SCAN_RSP) is the Payload opened as AdvA (6 bytes, LE) + an AD Structure chain (Length|Type|Data); Length COVERS the AD Type byte. A narrow AD Type set (Flags, Local Name, 16/128-bit Service UUID, Service Data, Manufacturer Specific, Tx Power) is decoded semantically, the rest stay raw + type number. Preamble/Access Address/CRC are NOT in the input — this is sniffer/Wireshark level.',
  'protocol.bleAdvertisement.example.flags.name': 'Flags (spec example)',
  'protocol.bleAdvertisement.example.flags.description':
    'AD chain `02 01 06` — Flags = LE General Discoverable Mode + BR/EDR Not Supported.',
  'protocol.bleAdvertisement.example.manufacturerSpecific.name': 'Manufacturer Specific Data (spec example)',
  'protocol.bleAdvertisement.example.manufacturerSpecific.description':
    'AD chain `05 FF 4C 00 01 02` — Company ID 0x004C (Apple, Inc.) + 2 bytes of data.',
  'protocol.bleAdvertisement.example.completeLocalName.name': 'Complete Local Name (spec example)',
  'protocol.bleAdvertisement.example.completeLocalName.description':
    'AD chain `09 09 53 65 6E 73 6F 72 30 31` — ASCII "Sensor01".',
  'protocol.bleAdvertisement.example.multipleAdStructures.name': 'Flags + Local Name (realistic beacon)',
  'protocol.bleAdvertisement.example.multipleAdStructures.description':
    'Two AD Structures back to back in the same payload — proves the chain walk.',
  'protocol.bleAdvertisement.example.unknownPduType.name': 'Unknown PDU Type (warning path)',
  'protocol.bleAdvertisement.example.unknownPduType.description':
    'PDU Type 0x0F (Reserved) — the header cannot be named, raises a warning; the frame still stays valid:true.',
  'protocol.bleAdvertisement.example.truncatedAdStructure.name': 'Truncated AD Structure (error path)',
  'protocol.bleAdvertisement.example.truncatedAdStructure.description':
    'AD Structure declares Length=5 but only 3 bytes remain in the buffer — raises truncated-frame.',

  // --- BLE GATT ---
  'protocol.bleGatt.error.frameTooShort': 'The frame must be at least the 1-byte Opcode long.',
  'protocol.bleGatt.error.frameTooLong': 'The frame exceeds the maximum allowed length.',
  'protocol.bleGatt.error.aborted': 'Parsing was aborted.',
  'protocol.bleGatt.error.pduTooShort': 'Not enough bytes in the buffer for this PDU kind.',
  'protocol.bleGatt.error.uuidLengthInvalid': 'The UUID field is neither 2 (16-bit) nor 16 (128-bit) bytes long.',
  'protocol.bleGatt.warning.unknownOpcode': 'Opcode is outside the narrow set; the PDU schema could not be resolved, shown raw.',
  'protocol.bleGatt.warning.pduSchemaNotDecoded':
    'This opcode/format is out of narrow scope; the body is not decoded in this wave, shown raw.',
  'protocol.bleGatt.warning.unknownErrorCode': 'Error Code is outside the narrow set; shown raw.',
  'protocol.bleGatt.warning.unknownFormat': 'Find Information Response Format is neither 0x01 nor 0x02; shown raw.',
  'protocol.bleGatt.warning.invalidEntryLength':
    'The Length field is below the minimum entry size for this PDU kind; the entry list could not be decoded.',
  'protocol.bleGatt.warning.l2capHeaderDetected':
    'The first 4 bytes are a valid L2CAP Basic frame header (Length+CID=0x0004) — detected and stripped.',

  'protocol.bleGatt.documentation.summary':
    'BLE GATT decodes the connection-oriented ATT/L2CAP PDU: a 1-byte Opcode (Method+Command Flag+Authentication Signature Flag) plus a body that varies by PDU kind. Seventeen opcodes (Error/Exchange MTU/Find Information/Read (By Type/By Group Type)/Write/Write Command/Handle Value Notification-Indication-Confirmation) are named and their bodies decoded; the rest stay raw with a warning. Input is a bare ATT PDU, with an optional L2CAP Basic frame prefix (Length+CID=0x0004) detected and stripped. The characteristic VALUE is schema-less — shown raw without a GATT schema.',
  'protocol.bleGatt.example.handleValueNotification.name': 'Handle Value Notification (Battery Level)',
  'protocol.bleGatt.example.handleValueNotification.description':
    'A Notification arriving on handle 0x0025 — value 90% (0x5A).',
  'protocol.bleGatt.example.writeRequestCccdEnable.name': 'Write Request — CCCD Notification Enable',
  'protocol.bleGatt.example.writeRequestCccdEnable.description':
    'A Write Request setting the Notification bit (0x0001) on the CCCD (0x2902) at handle 0x002B.',
  'protocol.bleGatt.example.errorResponseInvalidHandle.name': 'Error Response — Invalid Handle',
  'protocol.bleGatt.example.errorResponseInvalidHandle.description':
    'Response to a Read Request (0x0A) on handle 0x0099: Invalid Handle (0x01).',
  'protocol.bleGatt.example.readByGroupTypeResponsePrimaryServices.name':
    'Read By Group Type Response — Discover All Primary Services',
  'protocol.bleGatt.example.readByGroupTypeResponsePrimaryServices.description':
    'A single group: Handle 0x0001..0x0007, Value = Generic Access (0x1800).',
  'protocol.bleGatt.example.unknownOpcode.name': 'Unknown Opcode (warning path)',
  'protocol.bleGatt.example.unknownOpcode.description':
    'Find By Type Value Request (0x06) — outside the narrow set, its body is not decoded in this wave; shown raw.',
  'protocol.bleGatt.example.truncatedErrorResponse.name': 'Truncated Error Response (error path)',
  'protocol.bleGatt.example.truncatedErrorResponse.description':
    'Error Response requires 5 bytes, only 3 are present — Error Code is missing, raises truncated-frame.',

  // --- LoRaWAN ---
  'protocol.lorawan.error.frameTooShort': 'The frame must be at least MHDR(1)+MIC(4)=5 bytes long.',
  'protocol.lorawan.error.frameTooLong': 'The frame exceeds the maximum allowed length.',
  'protocol.lorawan.error.aborted': 'Parsing was aborted.',
  'protocol.lorawan.error.joinRequestLength':
    'A Join-Request must be exactly 23 bytes (MHDR+JoinEUI+DevEUI+DevNonce+MIC).',
  'protocol.lorawan.error.fhdrTruncated':
    'Not enough bytes in the buffer for the FHDR (DevAddr+FCtrl+FCnt requires at least 7 bytes).',
  'protocol.lorawan.error.foptsTruncated': 'Not enough bytes in the buffer for the declared FOptsLen.',
  'protocol.lorawan.error.macCommandTruncated':
    'The MAC command is recognized but there are not enough bytes in the FOpts buffer for its body.',
  'protocol.lorawan.warning.majorNotR1': 'The Major field is not LoRaWAN R1 (00); parsing continues anyway.',
  'protocol.lorawan.warning.frameKindNotDecoded':
    "This FType's payload schema (Proprietary or the 1.1-specific Rejoin Request) is not decoded in this wave; shown raw.",
  'protocol.lorawan.warning.joinAcceptEncrypted':
    'The Join-Accept body (including the MIC) is end-to-end encrypted; it cannot be decoded without a key, shown raw.',
  'protocol.lorawan.warning.unknownMacCommandCid':
    'CID is outside the narrow set (beyond the TS001-1.0.4 core, e.g. 1.1-specific) — its body length is unknown, could not be recognized.',
  'protocol.lorawan.warning.foptsRemainderNotDecoded':
    'The boundary of the FOpts bytes after the unknown CID could not be determined; shown raw.',
  'protocol.lorawan.warning.frmPayloadEncrypted':
    'FRMPayload is encrypted; it cannot be decoded without a key, shown raw.',
  'protocol.lorawan.warning.micNeedsSessionKeys':
    'A MIC is present; it cannot be verified without session keys (PASS/FAIL is never shown).',

  'protocol.lorawan.documentation.summary':
    'LoRaWAN decodes the PHYPayload: MHDR(1B) + MACPayload + MIC(4B). Join-Request is plaintext (JoinEUI/DevEUI/DevNonce). Join-Accept is end-to-end encrypted after the MHDR (including the MIC), shown raw. In a data frame, the FHDR (DevAddr/FCtrl/FCnt/FOpts) is decoded field by field — FCtrl has a different bit layout per direction; the MAC commands inside FOpts are decoded as a CID(1B)+body chain (LinkCheck/LinkADR/DutyCycle/RXParamSetup/DevStatus/NewChannel/RXTimingSetup/TxParamSetup/DlChannel/DeviceTime — the whole of TS001-1.0.4), with 1.1-specific CIDs staying outside the narrow set. FPort=0 does NOT mean application data, it means a MAC command. FRMPayload is always encrypted → raw + a flag. The MIC is never verified — "present, cannot verify without session keys" (the mavlink crcNeedsDialect pattern). Version anchor is L2 1.0.4 (TS001); FType 110 (the 1.1 Rejoin Request) is named narrowly, its body is not decoded in this wave.',
  'protocol.lorawan.example.joinRequest.name': 'Join-Request (plaintext)',
  'protocol.lorawan.example.joinRequest.description':
    'JoinEUI/DevEUI/DevNonce are decoded openly — a Join-Request is not encrypted.',
  'protocol.lorawan.example.joinAccept.name': 'Join-Accept (encrypted, raw)',
  'protocol.lorawan.example.joinAccept.description':
    'The entire body after the MHDR (including the MIC) is end-to-end encrypted — a single raw block without a key.',
  'protocol.lorawan.example.unconfirmedDataUp.name': 'Unconfirmed Data Up — happy path',
  'protocol.lorawan.example.unconfirmedDataUp.description':
    'FHDR + FPort + encrypted FRMPayload are decoded field by field; the MIC is shown raw with a cannot-verify warning.',
  'protocol.lorawan.example.confirmedDataDownWithFopts.name': 'Confirmed Data Down + FOpts',
  'protocol.lorawan.example.confirmedDataDownWithFopts.description':
    'Downlink FCtrl interpretation (RFU/FPending) + FOptsLen=2 — DutyCycleReq is decoded.',
  'protocol.lorawan.example.macCommandsLinkCheckReq.name': 'FOpts — LinkCheckReq (bodyless)',
  'protocol.lorawan.example.macCommandsLinkCheckReq.description':
    "Uplink, a single MAC command: LinkCheckReq (CID 0x02) — the device's link-quality request, no body.",
  'protocol.lorawan.example.macCommandsLinkAdrReq.name': 'FOpts — LinkADRReq (bit fields)',
  'protocol.lorawan.example.macCommandsLinkAdrReq.description':
    'Downlink LinkADRReq (CID 0x03): DataRate/TXPower/ChMask/ChMaskCntl/NbTrans bit fields are decoded.',
  'protocol.lorawan.example.macCommandsUnknownCid.name': 'FOpts — CID outside the narrow set (warning path)',
  'protocol.lorawan.example.macCommandsUnknownCid.description':
    'CID 0x0B (RekeyInd, LoRaWAN 1.1) is outside the version anchor — cannot be recognized, the rest of FOpts is shown raw.',
  'protocol.lorawan.example.macCommandOnly.name': 'FPort=0 (MAC command only)',
  'protocol.lorawan.example.macCommandOnly.description':
    'FPort=0 — does NOT mean application data, it means an encrypted MAC command.',
  'protocol.lorawan.example.noApplicationPayload.name': 'No FPort/FRMPayload (still a valid frame)',
  'protocol.lorawan.example.noApplicationPayload.description':
    'FHDR + FOptsLen=0, with no FPort and no FRMPayload at all — still valid per TS001 §4.3.',
  'protocol.lorawan.example.proprietary.name': 'Proprietary (out-of-scope body)',
  'protocol.lorawan.example.proprietary.description':
    'FType=111 — the body schema is not standardized, not decoded in this wave, shown raw.',
  'protocol.lorawan.example.truncatedFhdr.name': 'Truncated FHDR (error path)',
  'protocol.lorawan.example.truncatedFhdr.description':
    'MACPayload is only 6 bytes — the FHDR requires at least 7 (DevAddr+FCtrl+FCnt), raises truncated-frame.',

  // --- Zigbee ---
  'protocol.zigbee.error.frameTooShort':
    'The frame must be at least the 802.15.4 MAC minimum length (FCF+Sequence+FCS).',
  'protocol.zigbee.error.frameTooLong': 'The frame exceeds the maximum allowed length.',
  'protocol.zigbee.error.aborted': 'Parsing was aborted.',
  'protocol.zigbee.error.fcsMismatch': 'The FCS does not match the calculated CRC16/KERMIT value.',
  'protocol.zigbee.error.macAddressingTruncated': 'Not enough bytes in the buffer for the MAC addressing fields.',
  'protocol.zigbee.error.nwkTruncated': 'Not enough bytes in the buffer for the NWK header (including IEEE addresses).',
  'protocol.zigbee.error.apsTruncated': 'Not enough bytes in the buffer for the APS header.',
  'protocol.zigbee.warning.frameVersionUnsupported':
    'Frame Version is outside 2003/2006 (2015+); the addressing rule is not supported in this wave, fields shown raw.',
  'protocol.zigbee.warning.nonDataFrame':
    "The MAC Frame Type isn't Data; the payload was not passed to NWK, shown raw.",
  'protocol.zigbee.warning.nwkAdvancedAddressing':
    'The Multicast/Source Route subframe is not decoded in this wave; the remaining NWK payload is shown raw.',
  'protocol.zigbee.warning.nwkEncrypted': 'NWK Security is enabled; the payload is encrypted, shown raw (not decoded further).',
  'protocol.zigbee.warning.nwkNonData':
    "The NWK Frame Type isn't Data; the payload was not passed to APS, shown raw.",
  'protocol.zigbee.warning.apsOutOfScope':
    'Group addressing or an Extended Header is not decoded in this wave; the APS payload is shown raw.',
  'protocol.zigbee.warning.apsEncrypted': 'APS Security is enabled; the payload is encrypted, shown raw (not decoded further).',
  'protocol.zigbee.warning.apsNonData':
    "The APS Frame Type isn't Data; the payload was not passed to ZCL, shown raw.",
  'protocol.zigbee.warning.zclClusterSpecificNotDecoded':
    'The cluster-specific command body is not decoded in this wave; shown raw.',
  'protocol.zigbee.warning.zclGlobalCommandNotDecoded':
    "This global ZCL command's body is not decoded in this wave; shown raw.",
  'protocol.zigbee.warning.zclUnknownDataType':
    "The attribute data type isn't in the narrow set; since its length is unknown, the chain stopped here, the rest is shown raw.",

  'protocol.zigbee.documentation.summary':
    "Zigbee decodes three layers in one engine: 802.15.4 MAC (Frame Control, Sequence, addressing — variable per PAN ID Compression, FCS actually VERIFIED with CRC16/KERMIT) → NWK (Frame Control, Dest/Source Address, Radius, Sequence; if Security is enabled the payload stays encrypted and raw) → APS (Frame Control, Endpoints, Cluster/Profile ID, Counter; stays raw if Security is enabled) → ZCL (Frame Control, Transaction Sequence Number, Command ID; only the Read Attributes Response/Report Attributes/Default Response payload is decoded with a narrow data type set; cluster-specific command bodies still stay raw). Cluster ID and the Attribute IDs inside Read Attributes Response/Report Attributes are named via a narrow library — the 18 most common Home Automation clusters, not the full ZCL library. Only Frame Version 2003/2006 and only Data frames enter the NWK/APS/ZCL chain.",
  'protocol.zigbee.example.temperatureReport.name': 'Temperature Measurement — Report Attributes',
  'protocol.zigbee.example.temperatureReport.description':
    'MAC→NWK→APS(Temperature Measurement)→ZCL Report Attributes; raw `29 09` → Int16 2345 (the spec example wrapped in the layer chain).',
  'protocol.zigbee.example.readAttrResponse.name': 'Read Attributes Response (SUCCESS)',
  'protocol.zigbee.example.readAttrResponse.description':
    'AttrID + Status(SUCCESS) + DataType(Int16) + Value are decoded field by field.',
  'protocol.zigbee.example.defaultResponse.name': 'Default Response',
  'protocol.zigbee.example.defaultResponse.description': 'Response to Command ID + Status(SUCCESS) are decoded.',
  'protocol.zigbee.example.nwkEncrypted.name': 'NWK Security enabled (encrypted, raw)',
  'protocol.zigbee.example.nwkEncrypted.description':
    'NWK Security=1 — the payload is shown raw as "Encrypted NWK payload", APS is never reached.',
  'protocol.zigbee.example.clusterSpecificCommand.name': 'Cluster-specific command (out of scope)',
  'protocol.zigbee.example.clusterSpecificCommand.description':
    "ZCL Frame Type=Cluster-specific — the body isn't decoded in this wave, raw + warning.",
  'protocol.zigbee.example.macCommandFrame.name': "MAC Command frame (doesn't reach NWK)",
  'protocol.zigbee.example.macCommandFrame.description':
    'MAC Frame Type=MAC Command — the payload never reaches NWK, raw + warning.',
  'protocol.zigbee.example.fcsMismatch.name': 'Corrupt FCS (error path)',
  'protocol.zigbee.example.fcsMismatch.description': 'The last byte is corrupted — FCS FAILs, the frame is invalid.',
  'protocol.zigbee.example.truncatedMacAddressing.name': 'Truncated MAC addressing (error path)',
  'protocol.zigbee.example.truncatedMacAddressing.description':
    'The header addressing bits expect an address but no bytes remain in the buffer — raises truncated-frame.',

  // --- Matter ---
  'protocol.matter.error.frameEmpty': 'The input is empty; at least one TLV element is required.',
  'protocol.matter.error.frameTooLong': 'The frame exceeds the maximum allowed length.',
  'protocol.matter.error.aborted': 'Parsing was aborted.',
  'protocol.matter.error.truncated':
    "Not enough bytes in the buffer for a TLV element's header or value.",
  'protocol.matter.error.reservedElementType':
    'The element type is in the reserved 0x19–0x1F range; since its length is unknown, the walk stopped.',
  'protocol.matter.error.taggedEndOfContainer':
    'The end-of-container element carries a tag; the spec forbids this (tag control must be zero).',
  'protocol.matter.error.valueOverflow': "An element's declared length runs past the end of the buffer.",
  'protocol.matter.error.lengthUnsupported':
    'The declared length is above 0xFFFFFFFF; that size is not indexable.',
  'protocol.matter.error.unexpectedEndOfContainer':
    'An end-of-container element appeared with no container open.',
  'protocol.matter.error.unclosedContainer':
    'The input ended with a container still open; the end-of-container element is MANDATORY per the spec.',
  'protocol.matter.warning.maxDepthReached':
    'The maximum container depth was reached; deeper elements were not decoded.',
  'protocol.matter.warning.maxElementsReached':
    'The maximum element count was reached; the remaining elements were not decoded.',
  'protocol.matter.warning.implicitProfileUnresolved':
    'Implicit profile tag: the vendor/profile number is NOT in the bytes, it comes from protocol context — left unresolved rather than invented.',
  'protocol.matter.warning.malformedUtf8': 'The UTF-8 sequence is malformed; the text is shown anyway.',
  'protocol.matter.warning.contextTagAtTopLevel':
    'A context tag cannot be used at the top level (spec A.2.2).',
  'protocol.matter.warning.anonymousTagInStructure':
    'Structure members cannot carry an anonymous tag (spec A.5.1).',
  'protocol.matter.warning.nonAnonymousTagInArray':
    'Array members must carry an anonymous tag (spec A.5.2).',

  'protocol.matter.documentation.summary':
    'The Matter TLV Tree Decoder walks a standalone TLV blob recursively: for each element it decodes the control octet (upper 3 bits the tag form, lower 5 bits the element type), the tag field (anonymous / context / common / implicit / fully-qualified) and the little-endian length/value field whose width derives from the type; containers (Structure/Array/List) carry no length, so a mandatory end-of-container element marks their end. The input is NOT a Matter MESSAGE frame — that layer is encrypted and session-bound and needs a key; what you paste here is the bare TLV taken out of that envelope. Tag-rule violations (an Array member must be anonymous, a Structure member must not be) are warnings, not errors. Interaction Model, Commissioning and Session analysis are NOT in this wave.',
  'protocol.matter.example.identifyResponse.name': 'Real Matter message payload (SDK vector)',
  'protocol.matter.example.identifyResponse.description':
    'A connectedhomeip SDK test vector: a fully-qualified tagged Structure holding context-tagged number and string members (serial number, "1.4rc5").',
  'protocol.matter.example.mixedArray.name': 'Mixed-type Array (nested container)',
  'protocol.matter.example.mixedArray.description':
    'Spec example: [42, −170000, {}, 17.9, "Hello!"] — five different types, one an empty Structure.',
  'protocol.matter.example.structureContextTags.name': 'Structure with context tags',
  'protocol.matter.example.structureContextTags.description': 'Spec example: {0 = 42, 1 = −17}.',
  'protocol.matter.example.tagForms.name': 'Fully-qualified tag form',
  'protocol.matter.example.tagForms.description':
    'Spec example: a Structure and its member carrying vendor id + profile number + tag number.',
  'protocol.matter.example.listMixedTags.name': 'List — mixed tag forms',
  'protocol.matter.example.listMixedTags.description':
    'Spec example: List members may mix anonymous and context tags.',
  'protocol.matter.example.emptyStructure.name': 'Empty Structure',
  'protocol.matter.example.emptyStructure.description':
    'Opening + mandatory end-of-container: two bytes, the whole container range.',
  'protocol.matter.example.unclosedContainer.name': 'Unclosed container (error path)',
  'protocol.matter.example.unclosedContainer.description':
    "The Structure example with its end-of-container cut off — it is not inferred, it raises an error.",
  'protocol.matter.example.truncatedString.name': 'Truncated string body (error path)',
  'protocol.matter.example.truncatedString.description':
    'It declares a 6-byte length but only 2 bytes remain in the buffer — raises value-overflow.',

  // --- 1-Wire (phase 10 wave 11a) ---
  'protocol.oneWire.error.emptyFrame': 'The buffer must contain at least 1 byte (ROM Command).',
  'protocol.oneWire.error.romIdTruncated':
    'The buffer does not contain the 8 bytes required for the 64-bit ROM ID after a Read ROM/Match ROM/Overdrive Match ROM command.',
  'protocol.oneWire.error.frameTooLong': 'The frame exceeds the given maximum length.',
  'protocol.oneWire.error.aborted': 'Parsing was cancelled.',
  'protocol.oneWire.error.crcMismatch':
    'The calculated CRC-8/MAXIM does not match the last byte of the ROM ID.',
  'protocol.oneWire.warning.unknownRomCommand':
    'The ROM Command value is not in the known set (Read/Match/Skip/Search ROM, Overdrive Skip/Match ROM) — shown raw.',
  'protocol.oneWire.summary.commandOnly': '{command}',
  'protocol.oneWire.summary.romId': '{command}: Family {family}',
  'protocol.oneWire.summary.unknownCommand': '{command} (unrecognized)',
  'protocol.oneWire.documentation.summary':
    'Decodes the ROM Command byte (Read/Match/Skip/Search ROM plus the Overdrive pair, cross-checked against Microchip AN3320 and the esp-open-rtos onewire.c source) and — for Read ROM/Match ROM/Overdrive Match ROM — the 64-bit ROM ID that follows it (Family Code + Serial Number + CRC-8/MAXIM). The Serial Number is never collapsed into a single integer since its internal byte order was not verified — only the raw bytes are shown. Search ROM\'s bit-level Bit/Complement/Branch/Discrepancy search tree and the reset/presence pulse timing are out of scope for this engine.',
  'protocol.oneWire.example.readRom.name': 'Read ROM (Family 0x28, valid CRC)',
  'protocol.oneWire.example.readRom.description':
    'A Read ROM command followed by Family Code 0x28 (the DS18B20 family) plus a representative serial number plus an independently calculated CRC-8/MAXIM.',
  'protocol.oneWire.example.matchRom.name': 'Match ROM (a different serial number, valid CRC)',
  'protocol.oneWire.example.matchRom.description':
    'A Match ROM command with a different representative serial number plus an independently calculated CRC-8/MAXIM.',
  'protocol.oneWire.example.skipRom.name': 'Skip ROM (no ROM ID)',
  'protocol.oneWire.example.skipRom.description':
    'A single byte — addressless access to all devices, no ROM ID follows at all.',
  'protocol.oneWire.example.searchRom.name': 'Search ROM (search tree out of scope)',
  'protocol.oneWire.example.searchRom.description':
    'The command is recognized; the actual bit-level multi-device search algorithm is out of scope for this engine.',
  'protocol.oneWire.example.overdriveSkipRom.name': 'Overdrive Skip ROM',
  'protocol.oneWire.example.overdriveSkipRom.description':
    'The Overdrive family\'s member without a ROM ID — verified only against Microchip AN3320.',
  'protocol.oneWire.example.badCrc.name': 'Corrupted CRC (error path)',
  'protocol.oneWire.example.badCrc.description':
    'The exact same body as "Read ROM", except the CRC byte was deliberately corrupted — not a ParseFailure, but the frame carries valid:false and a crc-mismatch error.',
  'protocol.oneWire.example.unknownCommand.name': 'Unrecognized ROM Command (warning path)',
  'protocol.oneWire.example.unknownCommand.description':
    '0xAA is not one of the 6 known ROM commands — raises only a warning, not an error.',

  // --- SPI (phase 10 wave 11b) ---
  'protocol.spi.error.emptyFrame': 'The buffer must contain at least 1 byte (Command).',
  'protocol.spi.error.aborted': 'Parsing was cancelled.',
  'protocol.spi.summary.read': 'Read Register {register}',
  'protocol.spi.summary.write': 'Write Register {register}',
  'protocol.spi.documentation.summary':
    "Decodes a register transaction by reading bit 7 of the Command byte (read/write): a read is followed by 1 dummy byte plus the returned data, a write shows the written data directly. The CPOL/CPHA and transfer-time calculator (Timing tab) already existed as a separate engine. Full-duplex is collapsed into a single logical byte sequence — the line that is not in use at that moment is never shown. The dummy byte count (fixed at 1) and the position of the read/write bit follow the spec summary's own example; real devices may differ.",
  'protocol.spi.example.registerRead.name': 'Register read (spec IMU example)',
  'protocol.spi.example.registerRead.description':
    'Reading register 0x75: Command 0xF5 (0x75 with the read bit set), 1 dummy byte, returned value 0x71.',
  'protocol.spi.example.registerWrite.name': 'Register write',
  'protocol.spi.example.registerWrite.description':
    'Symmetric to the register-read example: with the read bit clear there is no dummy byte, the written value follows the command directly.',
  'protocol.spi.example.multiByteRead.name': 'Multi-byte read (burst)',
  'protocol.spi.example.multiByteRead.description':
    'Same register, a 4-byte burst read — shows the Data field carrying more than one byte at once.',

  // --- Quad SPI (phase 10 wave 11b) ---
  'protocol.quadSpi.error.emptyFrame': 'The buffer must contain at least 1 byte (Command).',
  'protocol.quadSpi.error.aborted': 'Parsing was cancelled.',
  'protocol.quadSpi.summary.transaction': 'Command {command}',
  'protocol.quadSpi.documentation.summary':
    "Decodes Command (1 byte) plus Address (3 bytes, big-endian — the spec summary's own 0xEB/0x001234 example) plus Data. Dummy cycles never consume a byte: the tri-state line carries no data, how many bytes they correspond to depends on lane width, and that is a timing parameter (the Timing tab's calculator already covers it). The address length is assumed to be a fixed 3 bytes; 4-byte addressing is not covered in this release.",
  'protocol.quadSpi.example.flashFastRead.name': 'Flash Fast Read (spec example)',
  'protocol.quadSpi.example.flashFastRead.description':
    'Command 0xEB (Fast Read Quad I/O), Address 0x001234, followed by 4 representative data bytes.',
  'protocol.quadSpi.example.commandOnly.name': 'Command only (no address)',
  'protocol.quadSpi.example.commandOnly.description':
    'An addressless command example, like Write Enable — the Address and Data fields never appear.',

  // --- Octal SPI (phase 10 wave 11b) ---
  'protocol.octalSpi.error.emptyFrame': 'The buffer must contain at least 1 byte (Command).',
  'protocol.octalSpi.error.aborted': 'Parsing was cancelled.',
  'protocol.octalSpi.summary.transaction': 'Command {command}',
  'protocol.octalSpi.documentation.summary':
    'Decodes the same Command plus Address (3 bytes, big-endian) plus Data structure as Quad SPI (shared core). SDR/DDR and the DQS data strobe are electrical/timing concepts and never appear in the decoded bytes — the throughput engine exists but no calculator UI reads it yet.',
  'protocol.octalSpi.example.flashRead.name': 'Flash read (representative)',
  'protocol.octalSpi.example.flashRead.description':
    "Command 0x0C, Address 0x000000, followed by 4 representative data bytes — not taken from a real vendor datasheet, illustrative only.",
  'protocol.octalSpi.example.commandOnly.name': 'Command only (no address)',
  'protocol.octalSpi.example.commandOnly.description':
    'An addressless command example, like Write Enable — the Address and Data fields never appear.',

  // --- I²C (phase 10 wave 11c) ---
  'protocol.i2c.error.emptyFrame': 'The buffer must contain at least 1 byte (Address).',
  'protocol.i2c.error.aborted': 'Parsing was cancelled.',
  'protocol.i2c.summary.probe': 'Bus Probe {address}',
  'protocol.i2c.summary.write': 'Write {address} · Register {register}',
  'protocol.i2c.summary.read': 'Read {address}',
  'protocol.i2c.summary.registerRead': 'Register Read {address} · Register {register}',
  'protocol.i2c.documentation.summary':
    "Decodes four transaction shapes by looking at the first byte's R/W bit and, when present, whether the third byte repeats the same address with the R/W bit flipped to read: address-only (bus probe), Address+Register+Data (write), Address+Data with no repeated start (read), and Address+Register+repeated-START Address+Data (the spec summary's main example). ACK/NACK, clock stretching and arbitration are bit-level electrical signals and never appear in the decoded bytes. The transfer-time/7-bit-address/pull-up calculator (Timing tab) already existed in a separate engine.",
  'protocol.i2c.example.registerRead.name': 'Register read (spec main example, repeated START)',
  'protocol.i2c.example.registerRead.description':
    'Address 0x68 write (0xD0), Register 0x75, repeated START then Address 0x68 read (0xD1), returned value 0x71.',
  'protocol.i2c.example.registerWrite.name': 'Register write',
  'protocol.i2c.example.registerWrite.description':
    'Symmetric with the register-read example: no repeated start, the written value follows the register directly.',
  'protocol.i2c.example.readOnly.name': 'Direct read (no repeated START)',
  'protocol.i2c.example.readOnly.description':
    'Starts directly with Address 0x68 read (0xD1) — no register concept, similar to an SMBus Receive Byte.',
  'protocol.i2c.example.busProbe.name': 'Bus scan (address only)',
  'protocol.i2c.example.busProbe.description':
    "Just the Address byte (0x1E write) — a present/absent probe, the spec summary's magnetometer example.",

  // --- RS-485 / RS-422 (phase 10 wave 11d) ---
  'protocol.rs485.error.emptyFrame': 'The buffer must contain at least 1 byte.',
  'protocol.rs485.error.aborted': 'Parsing was cancelled.',
  'protocol.rs485.warning.echoSuspected':
    'The two halves of the capture are byte-for-byte identical — this looks like half-duplex driver echo (the transmitter reading back its own frame). Deliberately sending the same frame twice produces the same pattern, so this is a warning rather than an error.',
  'protocol.rs485.summary.transmission': '{characters} characters · {bitTimes} bit times of DE window',
  'protocol.rs485.summary.echo':
    '{characters} characters · {bitTimes} bit times of DE window · echo suspected',
  'protocol.rs485.documentation.summary':
    'Expands every captured byte into its UART character line view — Start(0) · data bits LSB-first · Stop(1) — assuming 8N1, because the decoder has no baud/parity input. The differential counterpart is derived as V_AB: logic 1 positive, logic 0 negative. RS-485 is not a higher-level protocol, so the content of the carried bytes (Modbus RTU address/function/CRC fields and the like) is never interpreted here — the record links to those protocol pages instead. Half-duplex driver echo is flagged with a warning when the two halves of the capture are identical. Termination, bias/fail-safe, unit load and cable delay live in the existing engine behind the Timing tab; DE/RE timing and turnaround measurement are signal-level and never appear in a byte stream.',
  'protocol.rs485.example.modbusRtu.name': 'DE window carrying a Modbus RTU frame',
  'protocol.rs485.example.modbusRtu.description':
    "The spec summary's own bus view example (01 03 00 00 00 02 C4 0B). RS-485 does not interpret the content of these bytes — the field meanings belong to the Modbus RTU page.",
  'protocol.rs485.example.halfDuplexEcho.name': 'Half-duplex echo suspected',
  'protocol.rs485.example.halfDuplexEcho.description':
    'The same frame twice in a row: a transmitter reading back its own frame produces this pattern, the second half is split out as Echo fields and a warning is raised.',
  'protocol.rs485.example.singleCharacter.name': 'Single character (line view)',
  'protocol.rs485.example.singleCharacter.description':
    "0x41 = 'A' — the byte from the spec summary's bit view example: 0 10000010 1 (Start · D0..D7 LSB-first · Stop).",
  'protocol.rs422.error.emptyFrame': 'The buffer must contain at least 1 byte.',
  'protocol.rs422.error.aborted': 'Parsing was cancelled.',
  'protocol.rs422.summary.transmission': '{characters} characters · {bitTimes} bit times',
  'protocol.rs422.documentation.summary':
    'Expands every captured byte into its UART character line view — Start(0) · data bits LSB-first · Stop(1) — assuming 8N1, because the decoder has no baud/parity input. The differential counterpart is derived as V_AB: logic 1 positive, logic 0 negative. RS-422 is a four-wire full-duplex, single-driver multi-receiver electrical layer and never interprets the content of the carried bytes. Termination and propagation delay live in an engine published under the RS-485 name, so it is deliberately not linked from this page; character and packet time are in the UART timing calculator.',
  'protocol.rs422.example.singleCharacter.name': 'Single character (line view)',
  'protocol.rs422.example.singleCharacter.description':
    "0x41 = 'A' — the byte from the spec summary's bit view example: 0 10000010 1 (Start · D0..D7 LSB-first · Stop).",
  'protocol.rs422.example.multiCharacter.name': 'Multi-character transmission',
  'protocol.rs422.example.multiCharacter.description':
    'Four characters (OK + CR + LF) — a representative payload, since the spec gives no concrete byte example for RS-422. It also shows that the ASCII column is filled only for printable bytes.',
};
