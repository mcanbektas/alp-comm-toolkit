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
    'The EtherType value is not in the narrow naming set (IPv4/ARP/IPv6); the payload stays raw.',
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
};
