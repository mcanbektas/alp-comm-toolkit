/**
 * Türkçe KAYNAK sözlük. Uygulamanın tek gerçeğidir: yeni bir metin önce buraya
 * eklenir, `en.ts` derleyici zoruyla peşinden gelir.
 *
 * Anahtarlar bilerek DÜZ string'tir (`'home.heading'`), iç içe nesne değil.
 * Sebep: `keyof typeof tr` tek seviyeli literal union üretsin ki `t('home.hedaing')`
 * gibi bir yazım hatası derleme zamanında yakalansın. İç içe nesnede bu tip
 * güvencesi ancak elle yazılmış yol tipleriyle kurulabilirdi.
 *
 * `as const` şart: onsuz değerler `string`e genişler ve anahtar union'ı `string`
 * olur — o an tip güvencesinin tamamı kaybolur.
 *
 * Yer tutucu biçimi `{name}`. Aynı anahtarın Türkçesi ve İngilizcesi AYNI yer
 * tutucu kümesini taşımalı; testte doğrulanır.
 */
export const tr = {
  // --- Uygulama kabuğu ---
  'app.title': 'ALP Comm Toolkit',
  'app.tagline': 'Haberleşme protokollerini çözümleme ve geliştirme ortamı',
  'app.skipToContent': 'İçeriğe geç',

  // --- Gezinme ve arama ---
  'nav.home': 'Ana sayfa',
  'nav.domains': 'Alanlar',
  'nav.search': 'Ara',
  'nav.searchPlaceholder': 'Protokol, aile ya da alan ara…',
  'nav.searchHint': 'Aramayı açmak için / tuşuna basın',
  'nav.noResults': 'Eşleşen kayıt yok',
  'nav.resultCount': '{count} sonuç',
  'nav.closeMenu': 'Menüyü kapat',
  'nav.openMenu': 'Menüyü aç',
  'nav.calculators': 'Hesap araçları',

  // --- Tema ve dil anahtarları ---
  'theme.light': 'Açık',
  'theme.dark': 'Koyu',
  'theme.toggle': 'Temayı değiştir',
  'lang.label': 'Dil',
  'lang.tr': 'Türkçe',
  'lang.en': 'İngilizce',

  // --- Ana sayfa ---
  'home.heading': 'Haberleşme protokolleri çalışma ortamı',
  'home.intro':
    'Sekiz alan altında toplanan protokolleri inceleyin: çerçeve çözümleyin, telgraf kurun, zamanlama ve tanı verisini okuyun.',
  'home.domainCount': '{count} alan',
  'home.familyCount': '{count} aile',
  'home.protocolCount': '{count} protokol',
  'home.openDomain': 'Alanı aç',
  'home.exploreDomains': 'Alanları gözden geçir',

  // --- Alan sayfası ---
  'domain.familyCount': '{count} aile',
  'domain.protocolCount': '{count} protokol',
  'domain.backToHome': 'Ana sayfaya dön',

  // --- Aile sayfası ---
  'family.protocolCount': '{count} protokol',
  'family.backToDomain': 'Alana dön',

  // --- Protokol sayfası ---
  'protocol.layer': 'Katman',
  'protocol.status': 'Durum',
  'protocol.tools': 'Araçlar',
  'protocol.related': 'İlgili protokoller',
  'protocol.definitions': 'Tanım dosyaları',
  'protocol.aliasNotice':
    'Bu kayıt {name} protokolünün başka bir alandaki görünümüdür; ikisi aynı motoru kullanır.',
  'protocol.canonical': 'Kanonik kayda git',
  'protocol.backToFamily': 'Aileye dön',
  'protocol.plannedNotice':
    'Bu protokolün çözümleyicisi henüz bağlanmadı; sayfa şimdilik kapsamı ve araç listesini gösterir.',
  'protocol.noToolsForTab': 'Bu sekmeye bağlı bir araç yok.',

  // --- Workspace sekmeleri (adlar catalog'daki WorkspaceTab ile birebir) ---
  'tab.overview': 'Genel bakış',
  'tab.live': 'Canlı',
  'tab.decode': 'Çözümle',
  'tab.build': 'Telgraf kur',
  'tab.timing': 'Zamanlama',
  'tab.data': 'Veri',
  'tab.diagnostics': 'Tanı',
  'tab.definitions': 'Tanımlar',
  'tab.examples': 'Örnekler',
  'tab.groupLabel': 'Çalışma alanı sekmeleri',

  // --- Olgunluk rozetleri (ImplementationStatus) ---
  'status.planned': 'Planlandı',
  'status.partial': 'Kısmi',
  'status.ready': 'Hazır',

  // --- Katman etiketleri (ProtocolLayer) ---
  'layer.physical': 'Fiziksel',
  'layer.data-link': 'Veri bağı',
  'layer.network': 'Ağ',
  'layer.transport': 'Taşıma',
  'layer.application': 'Uygulama',
  'layer.multi-layer': 'Çok katmanlı',

  // --- Tanım dosyası biçimleri (DefinitionFormat) ---
  'definition.dbc': 'DBC — CAN veritabanı',
  'definition.eds': 'EDS — CANopen aygıt tanımı',
  'definition.gsd': 'GSD — PROFIBUS aygıt tanımı',
  'definition.gsdml': 'GSDML — PROFINET aygıt tanımı',
  'definition.iodd': 'IODD — IO-Link aygıt tanımı',
  'definition.a2l': 'A2L — ASAM ölçüm ve kalibrasyon tanımı',
  'definition.ldf': 'LDF — LIN ağ tanımı',
  'definition.scl': 'SCL — IEC 61850 istasyon tanımı',
  'definition.xif': 'XIF — LonWorks arayüz dosyası',
  'definition.dsdl': 'DSDL — Cyphal veri yapısı dili',
  'definition.vendor-map': 'Üretici kayıt haritası',
  'definition.custom-schema': 'Özel şema',

  // --- Bulunamadı ve hata ---
  'notFound.title': 'Sayfa bulunamadı',
  'notFound.body':
    'Bu adres kataloğa karşılık gelmiyor. Bağlantı eskimiş ya da protokol kimliği değişmiş olabilir.',
  'notFound.back': 'Ana sayfaya dön',
  'error.title': 'Beklenmedik bir hata oluştu',
  'error.body': 'Bu bölüm yüklenemedi. Yeniden deneyebilir ya da başka bir protokole geçebilirsiniz.',
  'error.retry': 'Yeniden dene',

  // --- Ortak eylemler ---
  'common.copy': 'Kopyala',
  'common.copied': 'Kopyalandı',
  'common.copyFailed': 'Kopyalanamadı',
  'common.export': 'Dışa aktar',
  'common.back': 'Geri',
  'common.loading': 'Yükleniyor…',
  'common.empty': 'Gösterilecek kayıt yok',
  'common.close': 'Kapat',
  'common.clear': 'Temizle',
  'common.yes': 'Evet',
  'common.no': 'Hayır',

  // --- Hesap araçları — hub sayfası (spec §11/§12/§13) ---
  'calculators.heading': 'Hesap araçları',
  'calculators.intro': 'Bayt/metin dönüşümleri, zamanlama hesapları ve CRC/checksum bulucu — hepsi yerelde, veri hiçbir yere gönderilmez.',
  'calculators.backToList': 'Araç listesine dön',
  'calculators.category.conversion': 'Veri dönüştürme',
  'calculators.category.timing': 'Zamanlama',
  'calculators.category.checksum': 'CRC / checksum bulucu',

  // --- Hesap araçları — ortak alan etiketleri ---
  'calc.error.invalidInput': 'Girdi çözümlenemedi — biçimi kontrol edin.',
  'calc.field.hexInput': 'Hex girdi',
  'calc.field.textInput': 'Metin girdi',
  'calc.field.binaryInput': 'İkili (binary) girdi',
  'calc.field.output': 'Sonuç',
  'calc.field.hexOutput': 'Hex sonuç',
  'calc.field.decimalOutput': 'Ondalık sonuç',
  'calc.field.byteIndex': 'Bayt no',
  'calc.field.hex': 'Hex',
  'calc.field.decimal': 'Ondalık',
  'calc.field.character': 'Karakter',
  'calc.field.leadByte': 'Öncü bayt',
  'calc.field.encode': 'Kodla',
  'calc.field.decode': 'Çöz',
  'calc.field.encodedInput': 'Kodlanmış girdi',
  'calc.field.bytesToPercent': 'Bayt → yüzde kodlama',
  'calc.field.value': 'Değer',
  'calc.field.inputRadix': 'Girdi tabanı',
  'calc.field.radixBinary': '2 — İkili',
  'calc.field.radixOctal': '8 — Sekizlik',
  'calc.field.radixDecimal': '10 — Ondalık',
  'calc.field.radixHex': '16 — Onaltılık',
  'calc.field.bitWidth': 'Bit genişliği',
  'calc.field.rawUnsigned': 'Ham (işaretsiz) değer',
  'calc.field.signedResult': 'İşaretli sonuç',
  'calc.field.signedInput': 'İşaretli değer',
  'calc.field.rawResult': 'Ham (işaretsiz) sonuç',
  'calc.field.byteLength': 'Bayt uzunluğu',
  'calc.field.byteOrder': 'Bayt sırası',
  'calc.field.bigEndianOption': 'Big-endian',
  'calc.field.littleEndianOption': 'Little-endian',
  'calc.field.floatValue': 'Ondalıklı (float) değer',
  'calc.field.floatOutput': 'Ondalıklı (float) sonuç',
  'calc.field.variableName': 'Değişken adı',
  'calc.field.codeOutput': 'Üretilen kod',
  'calc.field.epochSeconds': 'Epoch (saniye)',
  'calc.field.isoOutput': 'ISO 8601 çıktısı',
  'calc.field.isoInput': 'ISO 8601 girdisi',
  'calc.field.epochOutput': 'Epoch (saniye) sonucu',
  'calc.field.bytes32Output': '32-bit bayt çıktısı',
  'calc.field.maskBitWidth': 'Maske bit genişliği',
  'calc.field.maskShift': 'Kaydırma (shift)',
  'calc.field.maskOutput': 'Maske',
  'calc.field.maskedValue': 'Maskelenmiş değer',
  'calc.field.extractedField': 'Çıkarılan alan',
  'calc.field.baudRate': 'Baud hızı',
  'calc.field.dataBits': 'Veri biti',
  'calc.field.stopBits': 'Dur biti',
  'calc.field.parity': 'Parity',
  'calc.field.packetBytesOptional': 'Paket bayt sayısı (opsiyonel)',
  'calc.field.bitsPerCharacter': 'Karakter başına bit',
  'calc.field.characterTime': 'Karakter süresi',
  'calc.field.maxByteRate': 'Azami bayt hızı',
  'calc.field.packetTime': 'Paket süresi',
  'calc.field.maxPacketRate': 'Azami paket hızı',
  'calc.field.rs485Termination': 'Sonlandırma',
  'calc.field.rs485Bias': 'Bias',
  'calc.field.rs485Propagation': 'Yayılım gecikmesi',
  'calc.field.rs485UnitLoad': 'Birim yük',
  'calc.field.differentialVoltage': 'Diferansiyel gerilim (V)',
  'calc.field.terminationOhms': 'Sonlandırma direnci (Ω)',
  'calc.field.effectiveResistance': 'Etkin direnç',
  'calc.field.driverCurrent': 'Sürücü akımı',
  'calc.field.supplyVoltage': 'Besleme gerilimi (V)',
  'calc.field.biasResistorOhms': 'Bias direnci (Ω)',
  'calc.field.differentialBiasVoltage': 'Diferansiyel bias gerilimi',
  'calc.field.biasCurrent': 'Bias akımı',
  'calc.field.cableLengthMeters': 'Kablo uzunluğu (m)',
  'calc.field.propagationVelocity': 'Yayılım hızı (m/s)',
  'calc.field.propagationDelay': 'Yayılım gecikmesi',
  'calc.field.roundTripDelay': 'Gidiş-dönüş gecikmesi',
  'calc.field.rs485UnitLoadHint': 'Aynı birim yüke sahip N düğüm varsayılır — toplam RS-485 baküs sınırının (standart 32) aşılıp aşılmadığını gösterir.',
  'calc.field.nodeCount': 'Düğüm sayısı',
  'calc.field.unitLoadPerNode': 'Düğüm başına birim yük',
  'calc.field.totalUnitLoad': 'Toplam birim yük',
  'calc.field.maximumAllowed': 'İzin verilen azami',
  'calc.field.withinLimit': 'Sınır içinde mi',
  'calc.field.clockFrequencyHz': 'Saat frekansı (Hz)',
  'calc.field.totalClockBits': 'Toplam saat biti',
  'calc.field.transferTime': 'Aktarım süresi',
  'calc.field.qspiThroughput': 'QSPI verim',
  'calc.field.sclFrequencyHz': 'SCL frekansı (Hz)',
  'calc.field.byteCount': 'Bayt sayısı',
  'calc.field.totalClockCount': 'Toplam saat darbesi',
  'calc.field.i2cAddress7bit': 'I²C adresi (7 bit)',
  'calc.field.pullUpOhms': 'Pull-up direnci (Ω)',
  'calc.field.busCapacitancePf': 'Hat kapasitansı (pF)',
  'calc.field.writeByte': 'Yazma baytı',
  'calc.field.readByte': 'Okuma baytı',
  'calc.field.riseTime': 'Yükselme süresi',
  'calc.field.pmbusDecode': 'Çöz',
  'calc.field.pmbusEncode': 'Kodla',
  'calc.field.linear11Word': 'Linear11 sözcüğü (hex/ondalık)',
  'calc.field.decodedValue': 'Çözülen değer',
  'calc.field.exponentOptional': 'Üs (opsiyonel — otomatik seçilir)',
  'calc.field.encodedWord': 'Kodlanmış sözcük',
  'calc.field.mantissa': 'Mantissa',
  'calc.field.exponent': 'Üs',
  'calc.field.checksumData': 'Veri (hex bayt)',
  'calc.field.checksumExpected': 'Gözlenen checksum (hex)',
  'calc.field.checksumMatches': 'Eşleşmeler ({count})',
  'calc.field.checksumNoMatch': 'Denenen 27 algoritmanın hiçbirinde eşleşme yok.',
  'calc.field.algorithm': 'Algoritma',
  'calc.field.checksumKind': 'Tür',
  'calc.field.checksumKindSimple': 'Basit',
  'calc.field.computedHex': 'Hesaplanan (hex)',
  'calc.field.byteOrderNormal': 'Normal',
  'calc.field.byteOrderSwapped': 'Ters çevrilmiş',

  // --- Hesap araçları — araç adı/özeti (spec §12 TAM LİSTE + §13 + §11) ---
  'calc.hexToAscii.name': 'HEX → ASCII',
  'calc.hexToAscii.summary': 'Onaltılık bayt dizisini ASCII metne çevirir.',
  'calc.asciiToHex.name': 'ASCII → HEX',
  'calc.asciiToHex.summary': 'ASCII metni onaltılık bayt dizisine çevirir.',
  'calc.hexToBinary.name': 'HEX → İkili',
  'calc.hexToBinary.summary': 'Onaltılık bayt dizisini ikili (binary) gösterime çevirir.',
  'calc.binaryToHex.name': 'İkili → HEX',
  'calc.binaryToHex.summary': 'İkili (binary) gösterimi onaltılık bayt dizisine çevirir.',
  'calc.decimalConverter.name': 'Sayı tabanı dönüştürücü',
  'calc.decimalConverter.summary': 'Bir değeri ikili, sekizlik, ondalık ve onaltılık tabanlarda eşzamanlı gösterir.',
  'calc.utf8ByteViewer.name': 'UTF-8 bayt görüntüleyici',
  'calc.utf8ByteViewer.summary': 'Metnin UTF-8 kodlamasındaki her baytı ve karakter sınırlarını gösterir.',
  'calc.base64.name': 'Base64',
  'calc.base64.summary': 'Baytları Base64 ile kodlar, Base64 metni baytlara çözer.',
  'calc.base32.name': 'Base32',
  'calc.base32.summary': 'Baytları Base32 ile kodlar, Base32 metni baytlara çözer.',
  'calc.urlEncoding.name': 'URL (yüzde) kodlama',
  'calc.urlEncoding.summary': 'Metni yüzde-kodlu (percent-encoded) URL biçimine çevirir ve geri çözer.',
  'calc.signedUnsigned.name': 'İşaretli / işaretsiz dönüştürücü',
  'calc.signedUnsigned.summary': 'Seçili bit genişliğinde ham (unsigned) değeri işaretliye çevirir ve tersini yapar.',
  'calc.littleEndian.name': 'Little-endian dönüştürücü',
  'calc.littleEndian.summary': 'Bayt dizisini little-endian sırayla sayıya çevirir, sayıyı little-endian bayta kodlar.',
  'calc.bigEndian.name': 'Big-endian dönüştürücü',
  'calc.bigEndian.summary': 'Bayt dizisini big-endian sırayla sayıya çevirir, sayıyı big-endian bayta kodlar.',
  'calc.mixedEndian.name': 'Karışık (mixed) endian dönüştürücü',
  'calc.mixedEndian.summary': 'Bayt dizisini karışık (word-swapped) bayt sırasıyla sayıya çevirir ve tersini yapar.',
  'calc.ieee754Float16.name': 'IEEE-754 Float16',
  'calc.ieee754Float16.summary': '16 bit yarı hassasiyetli ondalıklı sayıyı bayta kodlar, baytı sayıya çözer.',
  'calc.ieee754Float32.name': 'IEEE-754 Float32',
  'calc.ieee754Float32.summary': '32 bit tek hassasiyetli ondalıklı sayıyı bayta kodlar, baytı sayıya çözer.',
  'calc.ieee754Float64.name': 'IEEE-754 Float64',
  'calc.ieee754Float64.summary': '64 bit çift hassasiyetli ondalıklı sayıyı bayta kodlar, baytı sayıya çözer.',
  'calc.bcdConverter.name': 'BCD dönüştürücü',
  'calc.bcdConverter.summary': 'Ondalık sayıyı BCD (binary-coded decimal) baytlara kodlar ve geri çözer.',
  'calc.unixTimestamp.name': 'Unix zaman damgası',
  'calc.unixTimestamp.summary': 'Epoch saniyesini ISO 8601 tarihine çevirir, tersini yapar, 32-bit bayta kodlar.',
  'calc.bitMask.name': 'Bit maskesi',
  'calc.bitMask.summary': 'Genişlik ve kaydırmadan maske üretir, ham değere uygular ve alanı çıkarır.',
  'calc.byteSwap.name': 'Bayt sırası değiştir',
  'calc.byteSwap.summary': 'Bayt dizisinin sırasını tersine çevirir.',
  'calc.bitReverse.name': 'Bit ters çevir',
  'calc.bitReverse.summary': 'Her baytın bit sırasını (MSB↔LSB) ters çevirir.',
  'calc.nibbleSwap.name': 'Nibble değiştir',
  'calc.nibbleSwap.summary': 'Her baytın üst ve alt yarım baytını (nibble) yer değiştirir.',
  'calc.cArrayGenerator.name': 'C dizi üreteci',
  'calc.cArrayGenerator.summary': 'Bayt dizisinden C dilinde bir dizi tanımı üretir.',
  'calc.cppArrayGenerator.name': 'C++ dizi üreteci',
  'calc.cppArrayGenerator.summary': 'Bayt dizisinden C++ dilinde bir dizi tanımı üretir.',
  'calc.pythonBytesGenerator.name': 'Python bytes üreteci',
  'calc.pythonBytesGenerator.summary': 'Bayt dizisinden Python `bytes` değişmezi üretir.',
  'calc.rustArrayGenerator.name': 'Rust dizi üreteci',
  'calc.rustArrayGenerator.summary': 'Bayt dizisinden Rust dilinde bir dizi tanımı üretir.',
  'calc.javaByteArrayGenerator.name': 'Java byte dizisi üreteci',
  'calc.javaByteArrayGenerator.summary': 'Bayt dizisinden Java `byte[]` tanımı üretir.',
  'calc.javascriptUint8ArrayGenerator.name': 'JavaScript Uint8Array üreteci',
  'calc.javascriptUint8ArrayGenerator.summary': 'Bayt dizisinden JavaScript `Uint8Array` tanımı üretir.',
  'calc.uartTiming.name': 'UART zamanlama',
  'calc.uartTiming.summary': 'Baud hızı ve çerçeve biçiminden karakter/paket süresi ve azami hızları hesaplar.',
  'calc.rs485Timing.name': 'RS-485 hesapları',
  'calc.rs485Timing.summary': 'Sonlandırma, bias, kablo yayılım gecikmesi ve baküs birim yükünü hesaplar.',
  'calc.spiTiming.name': 'SPI zamanlama',
  'calc.spiTiming.summary': 'Saat frekansı ve bit sayısından aktarım süresini ve QSPI verimini hesaplar.',
  'calc.i2cTiming.name': 'I²C zamanlama',
  'calc.i2cTiming.summary': 'Aktarım süresini, 7-bit adres baytlarını ve pull-up yükselme süresini hesaplar.',
  'calc.pmbusLinear.name': 'PMBus Linear11 / Linear16',
  'calc.pmbusLinear.summary': 'PMBus Linear11 ve Linear16 telemetri kodlarını çözer ve kodlar.',
  'calc.checksumFinder.name': 'CRC / checksum bulucu',
  'calc.checksumFinder.summary': 'Veri ve gözlenen checksum çiftinden 27 algoritmayı (18 CRC + 9 basit) dener, bayt sırası varyasyonlarını da kapsar.',
  'calc.crcCalculator.name': 'CRC hesaplayıcı',
  'calc.crcCalculator.summary': 'Verilen baytların CRC ya da checksum değerini hesaplar; 18 standart CRC, 9 basit toplam ve tam parametreli özel CRC.',
  'calc.crc.customInit': 'Başlangıç değeri (init)',
  'calc.crc.customOption': 'Özel parametreler',
  'calc.crc.customPoly': 'Polinom',
  'calc.crc.customRefin': 'Girdi bitleri ters çevrilsin (refin)',
  'calc.crc.customRefout': 'Çıktı bitleri ters çevrilsin (refout)',
  'calc.crc.customXorout': 'Çıkışta XOR (xorout)',
  'calc.crc.group.crc': 'CRC',
  'calc.crc.group.custom': 'Özel',
  'calc.crc.group.simple': 'Basit toplam',
  'calc.crc.loadSample': 'Örnek veriyi yükle:',
  'calc.crc.paramsSummary': 'Algoritma parametreleri',
  'calc.crc.step.init': 'Başlangıç değeri:',
  'calc.crc.step.input': 'Girdi:',
  'calc.crc.step.poly': 'Polinom:',
  'calc.crc.step.refin': 'Girdi yansıtma:',
  'calc.crc.step.refout': 'Çıktı yansıtma:',
  'calc.crc.step.result': 'Sonuç:',
  'calc.crc.step.xorout': 'Çıkışta XOR:',
  'calc.crc.doc.example.title': 'Örnek veri',
  'calc.crc.doc.example.body': 'Spec §43’ün doğrulanmış referansı: ASCII "123456789" dizisi. Bu girdiyle CRC-8 0xF4, CRC-16/CCITT-FALSE 0x29B1, CRC-16/MODBUS 0x4B37 ve CRC-32 0xCBF43926 vermelidir.',
  'calc.crc.doc.formula.title': 'Formül',
  'calc.crc.doc.formula.body': 'CRC, girdiyi seçilen polinoma göre bölüp kalanı alır. Beş parametre sonucu belirler: polinom, başlangıç değeri, girdi yansıtma, çıktı yansıtma ve çıkışta uygulanan XOR. Aynı polinom farklı yansıtma bayraklarıyla bambaşka bir değer üretir.',
  'calc.crc.doc.steps.title': 'Adım adım hesap',
  'calc.crc.doc.steps.body': 'Seçili algoritmanın kullandığı parametreler ve girdinin boyu:',
  'calc.crc.doc.limits.title': 'Sınırlamalar',
  'calc.crc.doc.limits.bigint': 'CRC-64 sonucu 64 bittir ve JavaScript tarafında bigint olarak taşınır; ondalık gösterim tam sayı hassasiyetini korur.',
  'calc.crc.doc.limits.coverage': 'Bu araç verilen baytların TAMAMINI hesaba katar. Gerçek protokollerde kapsam genelde çerçevenin bir bölümüdür (başlangıç ve bitiş baytları hariç); kapsamı siz seçip yapıştırmalısınız.',
  'calc.crc.doc.limits.simpleParams': 'Basit toplamların (XOR8, SUM8, LRC, Fletcher, Adler-32, NMEA) polinom ya da yansıtma parametresi yoktur; özel parametre alanları yalnız CRC için geçerlidir.',
  'calc.crc.doc.mistakes.title': 'Yaygın hatalar',
  'calc.crc.doc.mistakes.reflect': 'Yansıtma bayrakları yanlışken hata verilmez, yalnız değer sessizce farklı çıkar. Beklenen değeri tutturamıyorsanız önce refin/refout ikilisini deneyin.',
  'calc.crc.doc.mistakes.scope': 'Kapsam yanlış seçilmişse sonuç doğru hesaplanır ama protokolün beklediği değer değildir — "CRC mismatch" hatalarının en sık sebebi budur.',
  'calc.crc.doc.mistakes.byteOrder': 'Çerçeveye yazılırken CRC’nin bayt sırası protokole göre değişir; hesaplanan sayı ile telde görünen baytlar ters sırada olabilir.',

  'nav.liveMonitor': 'Canlı monitör',

  'monitor.title': 'Canlı seri monitör',
  'monitor.intro':
    'Seri porttan gelen baytları canlı olarak çerçeveler, doğrular ve istatistiğe çevirir. Ayrıştırma Web Worker içinde koşar; tablo sanallaştırılmıştır.',
  'monitor.privacy': 'Veri cihazdan tarayıcıya gelir; hiçbir bayt sunucuya gönderilmez.',

  'monitor.section.connection': 'Bağlantı',
  'monitor.section.stream': 'Canlı akış',
  'monitor.section.statistics': 'İstatistikler',
  'monitor.section.signals': 'Sinyaller',

  'monitor.source.label': 'Kaynak',
  'monitor.source.serial': 'Web Serial',
  'monitor.source.simulated': 'Simülasyon',
  'monitor.source.serialHint': 'Port seçimi tarayıcı izni ister; donanım gerekir.',
  'monitor.source.simulatedHint': 'Donanımsız gösteri akışı — parçalı çerçeve, bozulma ve çöp bayt üretir.',
  'monitor.serialUnsupported': 'Bu tarayıcı Web Serial API desteklemiyor. Simülasyon kaynağını kullanabilirsiniz.',

  'monitor.action.connect': 'Bağlan',
  'monitor.action.disconnect': 'Bağlantıyı kes',
  'monitor.action.clear': 'Kayıtları temizle',
  'monitor.action.pause': 'Ekranı duraklat',
  'monitor.action.resume': 'Sürdür',
  'monitor.action.followTail': 'Sona takip et',
  'monitor.action.pausedNotice': 'Ekran duraklatıldı — veri toplanmaya devam ediyor.',

  'monitor.field.baudRate': 'Baud hızı',
  'monitor.field.dataBits': 'Veri bitleri',
  'monitor.field.stopBits': 'Stop bitleri',
  'monitor.field.parity': 'Parity',
  'monitor.field.flowControl': 'Akış denetimi',
  'monitor.field.bufferSize': 'Arabellek boyutu',
  'monitor.field.frameTimeout': 'Çerçeve zaman aşımı (ms)',
  'monitor.field.framesPerSecond': 'Çerçeve/saniye',
  'monitor.field.displayMode': 'Görüntüleme kipi',
  'monitor.field.timestampResolution': 'Zaman damgası çözünürlüğü',
  'monitor.field.checksum': 'Doğrulama algoritması',
  'monitor.field.framing': 'Çerçeveleme',

  'monitor.parity.none': 'Yok',
  'monitor.parity.even': 'Çift',
  'monitor.parity.odd': 'Tek',
  'monitor.flowControl.none': 'Yok',
  'monitor.flowControl.hardware': 'Donanım (RTS/CTS)',

  'monitor.display.hex': 'HEX',
  'monitor.display.ascii': 'ASCII',
  'monitor.display.utf8': 'UTF-8',
  'monitor.display.decimal': 'Ondalık',
  'monitor.display.binary': 'İkilik',
  'monitor.display.mixed': 'HEX + ASCII',

  'monitor.timestamp.ms': 'Milisaniye',
  'monitor.timestamp.us': 'Mikrosaniye',

  'monitor.framing.simulated': 'Simülasyon telemetrisi (uzunluk alanı)',
  'monitor.framing.lineEnding': 'Satır sonu (CR LF)',
  'monitor.framing.modbusRtu': 'Modbus RTU (sessiz aralık)',
  'monitor.framing.slip': 'SLIP',
  'monitor.framing.cobs': 'COBS',

  'monitor.status.label': 'Durum',
  'monitor.status.idle': 'Bağlı değil',
  'monitor.status.connecting': 'Bağlanıyor',
  'monitor.status.connected': 'Bağlı',
  'monitor.status.closing': 'Kapanıyor',
  'monitor.status.error': 'Hata',

  'monitor.parser.label': 'Ayrıştırıcı durumu',
  'monitor.parser.SEARCHING_FOR_FRAME': 'Çerçeve aranıyor',
  'monitor.parser.READING_HEADER': 'Başlık okunuyor',
  'monitor.parser.READING_LENGTH': 'Uzunluk okunuyor',
  'monitor.parser.READING_PAYLOAD': 'Veri okunuyor',
  'monitor.parser.READING_TRAILER': 'Kuyruk okunuyor',
  'monitor.parser.VALIDATING_FRAME': 'Çerçeve doğrulanıyor',
  'monitor.parser.FRAME_COMPLETE': 'Çerçeve tamam',
  'monitor.parser.FRAME_ERROR': 'Çerçeve hatası',
  'monitor.parser.RECOVERING': 'Toparlanıyor',

  'monitor.table.label': 'Canlı çerçeve tablosu',
  'monitor.table.empty': 'Henüz kayıt yok. Bir kaynağa bağlanın.',
  'monitor.table.timestamp': 'Zaman',
  'monitor.table.direction': 'Yön',
  'monitor.table.length': 'Uzunluk',
  'monitor.table.validation': 'Doğrulama',
  'monitor.table.bytes': 'Baytlar',
  'monitor.table.rowCount': '{count} kayıt',
  'monitor.table.dropped': '{count} eski kayıt kapasite nedeniyle düşürüldü',

  'monitor.validity.valid': 'Geçerli',
  'monitor.validity.crcError': 'CRC hatası',
  'monitor.validity.checksumError': 'Checksum hatası',
  'monitor.validity.unchecked': 'Denetlenmedi',

  'monitor.stats.totalFrames': 'Toplam çerçeve',
  'monitor.stats.validFrames': 'Geçerli çerçeve',
  'monitor.stats.invalidFrames': 'Geçersiz çerçeve',
  'monitor.stats.rxBytes': 'RX bayt',
  'monitor.stats.txBytes': 'TX bayt',
  'monitor.stats.crcErrors': 'CRC hatası',
  'monitor.stats.checksumErrors': 'Checksum hatası',
  'monitor.stats.framingErrors': 'Çerçeveleme hatası',
  'monitor.stats.timeoutErrors': 'Zaman aşımı',
  'monitor.stats.packetRate': 'Paket hızı',
  'monitor.stats.byteRate': 'Bayt hızı',
  'monitor.stats.minFrameLength': 'En kısa çerçeve',
  'monitor.stats.maxFrameLength': 'En uzun çerçeve',
  'monitor.stats.avgFrameLength': 'Ortalama çerçeve',
  'monitor.stats.crcErrorRate': 'CRC hata oranı',
  'monitor.stats.packetLoss': 'Paket kaybı',
  'monitor.stats.sequenceErrors': 'Sıra hatası',
  'monitor.stats.meanPeriod': 'Ortalama periyot',
  'monitor.stats.jitter': 'Jitter (son)',
  'monitor.stats.periodStdDev': 'Periyot σ',
  'monitor.stats.busLoad': 'Hat yükü',
  'monitor.stats.responseTime': 'Yanıt süresi (en az / en çok)',
  'monitor.stats.unknown': 'Ölçülmedi',
  'monitor.stats.formulaNote':
    'CRC hata oranı = hatalı / denetlenen × 100 · Paket kaybı = eksik / beklenen × 100 · σ = √[Σ(Pᵢ − ortalama)² / N]',

  'monitor.chart.empty': 'Sinyal verisi bekleniyor.',
  'monitor.chart.pointNote': 'Grafik en çok {count} noktaya seyreltilir (LTTB).',
  'monitor.signal.min': 'En az',
  'monitor.signal.max': 'En çok',
  'monitor.signal.average': 'Ortalama',
  'monitor.signal.rms': 'RMS',
  'monitor.signal.stdDev': 'σ',
  'monitor.signal.last': 'Son',

  'monitor.export.csv': 'CSV indir',
  'monitor.export.json': 'JSON indir',
  'monitor.export.txt': 'TXT indir',

  'monitor.error.unsupported': 'Web Serial API bu tarayıcıda yok.',
  'monitor.error.permissionDenied': 'Seri port izni reddedildi.',
  'monitor.error.openFailed': 'Port açılamadı.',
  'monitor.error.readFailed': 'Porttan okuma başarısız — cihaz çıkarılmış olabilir.',
  'monitor.error.writeFailed': 'Porta yazma başarısız.',
  'monitor.error.notConnected': 'Bağlantı yok.',

  // --- Protocol Studio ---
  'nav.protocolStudio': 'Protokol stüdyosu',

  // Taslak doğrulama (schemaDraft.ts DRAFT_MESSAGE_KEYS)
  'studio.draft.byteRange': 'Bayt değeri 0–255 aralığının dışında: {value}',
  'studio.draft.conditionIncomplete': 'Koşul yarım kaldı: alan ve karşılaştırılacak değer birlikte verilmeli.',
  'studio.draft.coverageIncomplete': 'Checksum kapsamı yarım kaldı: başlangıç ve bitiş offset birlikte verilmeli.',
  'studio.draft.enumKeyDuplicate': 'Enum anahtarı birden çok kez tanımlanmış: {key}',
  'studio.draft.enumKeyInvalid': 'Enum anahtarı tam sayı olmalı: {key}',
  'studio.draft.enumLabelRequired': 'Bu anahtarın etiketi boş bırakılamaz: {key}',
  'studio.draft.fieldIdRequired': 'Alan kimliği zorunlu.',
  'studio.draft.fieldNameRequired': 'Alan adı zorunlu.',
  'studio.draft.fieldsRequired': 'Şemada en az bir alan olmalı.',
  'studio.draft.integerInvalid': 'Tam sayı olarak okunamadı: {value}',
  'studio.draft.maximumFrameLengthRequired': 'Azami çerçeve uzunluğu zorunlu.',
  'studio.draft.nameRequired': 'Protokol adı zorunlu.',
  'studio.draft.numberInvalid': 'Sayı olarak okunamadı: {value}',
  'studio.draft.repeatFieldRequired': 'Tekrar sayısını taşıyan alan seçilmeli.',
  'studio.draft.schemaRejected': 'Şema doğrulaması {path} yolunu reddetti: {detail}',
  'studio.draft.versionRequired': 'Sürüm zorunlu.',

  // --- Protocol Studio — hata metinleri (spec §42 sözcüğü sözcüğüne) ---
  'studio.error.invalidHex': 'Geçersiz onaltılık (hex) girdi',
  'studio.error.invalidSchemaJson': 'Dosya geçerli bir şema JSON dosyası değil.',

  // --- Protocol Studio — alan özelliği etiketleri ---
  'studio.field.algorithm': 'Algoritma',
  'studio.field.bitLength': 'Bit uzunluğu',
  'studio.field.bitMask': 'Bit maskesi',
  'studio.field.bitOffset': 'Bit offset',
  'studio.field.bitOrder': 'Bit sırası',
  'studio.field.calibrationOffset': 'Kalibrasyon offset',
  'studio.field.color': 'Renk',
  'studio.field.colorNone': 'Renk yok',
  'studio.field.colorOption': '{index}. renk',
  'studio.field.conditionEquals': 'Koşul değeri',
  'studio.field.conditionField': 'Koşul alanı',
  'studio.field.coverageEnd': 'Kapsam bitişi',
  'studio.field.coverageStart': 'Kapsam başlangıcı',
  'studio.field.defaultValue': 'Varsayılan değer',
  'studio.field.defaultValueKind': 'Varsayılan değer türü',
  'studio.field.description': 'Açıklama',
  'studio.field.documentation': 'Belge notu',
  'studio.field.endianness': 'Endianness',
  'studio.field.enumAdd': 'Enum satırı ekle',
  'studio.field.enumEmpty': 'Bu alanda henüz enum değeri yok.',
  'studio.field.enumKey': 'Anahtar',
  'studio.field.enumLabel': 'Etiket',
  'studio.field.enumRemove': 'Enum satırını sil',
  'studio.field.id': 'Kimlik',
  'studio.field.length': 'Uzunluk',
  'studio.field.lengthFrom': 'Uzunluğu taşıyan alan',
  'studio.field.maximum': 'Azami',
  'studio.field.minimum': 'Asgari',
  'studio.field.name': 'Ad',
  'studio.field.offset': 'Offset',
  'studio.field.repeatCount': 'Tekrar sayısı',
  'studio.field.repeatFromField': 'Tekrarı taşıyan alan',
  'studio.field.repeatMode': 'Tekrar kipi',
  'studio.field.scale': 'Ölçek',
  'studio.field.signed': 'İşaret',
  'studio.field.type': 'Tip',
  'studio.field.unit': 'Birim',

  // --- Protocol Studio — alan listesi ---
  'studio.fieldList.addChildField': '{name} içine alan ekle',
  'studio.fieldList.addField': 'Alan ekle',
  'studio.fieldList.childListLabel': '{name} alt alanları',
  'studio.fieldList.conditionBadge': '{field} = {value} ise',
  'studio.fieldList.duplicateField': '{name} alanını çoğalt',
  'studio.fieldList.empty': 'Şemada henüz alan yok. Alan ekleyerek başlayın.',
  'studio.fieldList.emptyChildren': 'Bu alanın içinde henüz alt alan yok.',
  'studio.fieldList.frameStructure': 'Çerçeve yapısı',
  'studio.fieldList.issueCount': '{count} sorun',
  'studio.fieldList.lengthFromValue': 'uzunluk: {field}',
  'studio.fieldList.lengthValue': 'uzunluk: {length}',
  'studio.fieldList.listLabel': 'Şema alanları',
  'studio.fieldList.moveDown': 'Aşağı taşı',
  'studio.fieldList.moveUp': 'Yukarı taşı',
  'studio.fieldList.offsetValue': '@{offset}',
  'studio.fieldList.removeField': '{name} alanını sil',
  'studio.fieldList.repeatFixed': 'tekrar: {count}',
  'studio.fieldList.repeatFromField': 'tekrar: {field}',
  'studio.fieldList.title': 'Alanlar',

  // --- Protocol Studio — çerçeve görünümü ---
  'studio.frame.byteCount': 'Bayt sayısı',
  'studio.frame.bytesPerRow': 'Satır başına bayt',
  'studio.frame.empty': 'Gösterilecek bayt yok. Yukarıya örnek çerçeveyi hex olarak girin.',
  'studio.frame.endBytes': 'Bitiş baytları',
  'studio.frame.fieldCount': 'Alan sayısı',
  'studio.frame.framing': 'Çerçeveleme',
  'studio.frame.hexInput.label': 'Örnek çerçeve (hex)',
  'studio.frame.hexInput.placeholder': 'Boşlukla ayrılmış hex baytlar',
  'studio.frame.hideOffsets': 'Offsetleri gizle',
  'studio.frame.name': 'Ad',
  'studio.frame.startBytes': 'Başlangıç baytları',
  'studio.frame.title': 'Çerçeve',
  'studio.frame.version': 'Sürüm',
  'studio.frame.view.bits': 'Bit',
  'studio.frame.view.hexAscii': 'HEX + ASCII',
  'studio.frame.view.hexOnly': 'Yalnız HEX',
  'studio.frame.view.label': 'Görünüm',

  // --- Protocol Studio — çerçeveleme kipleri ---
  'studio.framing.fixedLength': 'Sabit uzunluk',
  'studio.framing.lengthField': 'Uzunluk alanı',
  'studio.framing.none': 'Yok',
  'studio.framing.startEnd': 'Başlangıç ve bitiş baytı',
  'studio.framing.startOnly': 'Yalnız başlangıç baytı',

  // --- Protocol Studio — açılır liste seçenekleri ---
  'studio.option.algorithmNone': 'Yok',
  'studio.option.auto': 'Otomatik',
  'studio.option.bitOrderLsb': 'LSB önce',
  'studio.option.bitOrderMsb': 'MSB önce',
  'studio.option.defaultKindNumber': 'Sayı',
  'studio.option.defaultKindText': 'Metin',
  'studio.option.endianBig': 'Big-endian',
  'studio.option.endianLittle': 'Little-endian',
  'studio.option.repeatFixed': 'Sabit sayı',
  'studio.option.repeatFromField': 'Başka alandan',
  'studio.option.repeatNone': 'Tekrar yok',
  'studio.option.signedNo': 'İşaretsiz',
  'studio.option.signedYes': 'İşaretli',

  // --- Protocol Studio — üretilen çıktı ---
  'studio.output.artifact.download': 'Dosyayı indir',
  'studio.output.artifact.missing': 'Bu sekme için henüz çıktı üretilmedi — önce geçerli bir şema kurun.',
  'studio.output.artifact.notExecuted': 'Üretilen kod salt metindir; tarayıcıda çalıştırılmaz.',
  'studio.output.parsed.column.field': 'Alan',
  'studio.output.parsed.column.offset': 'Offset',
  'studio.output.parsed.column.physical': 'Fiziksel değer',
  'studio.output.parsed.column.raw': 'Ham değer',
  'studio.output.parsed.column.unit': 'Birim',
  'studio.output.parsed.column.validity': 'Geçerlilik',
  'studio.output.parsed.computation': 'Hesap adımları',
  'studio.output.parsed.empty': 'Çözümlenecek çerçeve yok. Örnek çerçeveyi hex olarak girin.',
  'studio.output.parsed.errors': 'Hatalar',
  'studio.output.parsed.status.invalid': 'Geçersiz',
  'studio.output.parsed.status.valid': 'Geçerli',
  'studio.output.parsed.summary.consumedBytes': 'Tüketilen bayt',
  'studio.output.parsed.summary.fieldCount': 'Alan sayısı',
  'studio.output.parsed.summary.schema': 'Şema',
  'studio.output.parsed.summary.status': 'Durum',
  'studio.output.parsed.tableLabel': 'Çözümlenen alanlar',
  'studio.output.parsed.warnings': 'Uyarılar',

  // Spec §42 örnek hata metinleri: İngilizcesi sözcüğü sözcüğüne korunur,
  // Türkçesi aynı anlamı verir. Kod adı veri, cümle sözlüktedir.
  'studio.output.parseError.code.checksumMismatch': 'Checksum uyuşmuyor',
  'studio.output.parseError.code.circularLengthReference':
    'Protokol tanımı döngüsel uzunluk başvurusu içeriyor',
  'studio.output.parseError.code.crcMismatch': 'CRC uyuşmuyor',
  'studio.output.parseError.code.frameTooLong': 'Çerçeve azami uzunluğu aşıyor',
  'studio.output.parseError.code.invalidHexInput': 'Geçersiz onaltılık (hex) girdi',
  'studio.output.parseError.code.lengthMismatch': 'Çerçeve uzunluğu, uzunluk alanıyla uyuşmuyor',
  'studio.output.parseError.code.parserTimeout': 'Çözümleyici zaman aşımına uğradı',
  'studio.output.parseError.code.startDelimiterNotFound': 'Başlangıç baytı bulunamadı',
  'studio.output.parseError.code.truncatedFrame': 'Çerçeve yarım kaldı, baytlar bitti',
  'studio.output.parseError.code.unsupportedFunctionCode': 'Desteklenmeyen fonksiyon kodu',
  'studio.output.parseError.code.valueOutOfRange': 'Değer uint16 aralığını aşıyor',
  'studio.output.parseError.offset': 'Hata offset',
  'studio.output.parseError.recoverable': 'Toparlanabilir — sonraki çerçeveden devam edilebilir.',
  'studio.output.parseError.title': 'Çerçeve çözümlenemedi',
  'studio.output.parseError.unrecoverable': 'Toparlanamaz — bu noktadan sonrası güvenilir değil.',

  'studio.output.tab.cParser': 'C parser',
  'studio.output.tab.cStruct': 'C struct',
  'studio.output.tab.jsonSchema': 'JSON şema',
  'studio.output.tab.markdownDoc': 'Markdown belge',
  'studio.output.tab.parsed': 'Çözümleme',
  'studio.output.tab.pythonParser': 'Python parser',
  'studio.output.tab.typeScriptParser': 'TypeScript parser',
  'studio.output.tab.validation': 'Doğrulama',
  'studio.output.tablistLabel': 'Çıktı sekmeleri',
  'studio.output.validation.empty': 'Doğrulama sorunu yok.',
  'studio.output.validation.listLabel': 'Doğrulama sorunları',
  'studio.output.validation.severity.error': 'Hata',
  'studio.output.validation.severity.warning': 'Uyarı',
  'studio.output.validation.source.draft': 'Taslak',
  'studio.output.validation.source.schema': 'Şema',

  // --- Protocol Studio — özellik paneli ---
  'studio.properties.childFieldsHint':
    'Alt alanlar soldaki listeden eklenir; içerik oradaki sırayla kodlanır.',
  'studio.properties.derivedNote':
    'Bu alanın değerini kodlayıcı hesaplar; elle girilen değer yok sayılır.',
  'studio.properties.empty': 'Özelliklerini görmek için soldan bir alan seçin.',
  'studio.properties.group.appearance': 'Görünüm ve varsayılan',
  'studio.properties.group.checksum': 'Checksum',
  'studio.properties.group.enum': 'Enum değerleri',
  'studio.properties.group.identity': 'Kimlik',
  'studio.properties.group.layout': 'Yerleşim',
  'studio.properties.group.repeat': 'Koşul ve tekrar',
  'studio.properties.group.scaling': 'Ölçekleme ve sınırlar',
  'studio.properties.intrinsicLengthHint': 'Uzunluğu tip belirler; bu alan salt okunurdur.',
  'studio.properties.otherIssues': 'Bir alana bağlanamayan sorunlar',

  // --- Protocol Studio — ekran, eylemler ve kılavuz ---
  'studio.title': 'Custom Protocol Studio',
  'studio.intro':
    'Kendi ikili protokolünüzü alan alan tanımlayın, örnek bir çerçeveyi anında çözümleyin ve altı ayrı biçimde dışa aktarın.',
  'studio.privacy':
    'Protokol tanımı ve örnek çerçeve yalnız bu tarayıcıda kalır; hiçbir bayt sunucuya gönderilmez.',
  'studio.section.schemaMeta': 'Şema bilgileri',
  'studio.section.properties': 'Alan özellikleri',
  'studio.section.output': 'Çıktı',
  'studio.section.guide': 'Kılavuz',
  'studio.section.project': 'Proje',
  'studio.meta.maximumFrameLength': 'Azami çerçeve uzunluğu',
  'studio.meta.byteListHint':
    'Baytları boşluk ya da virgülle ayırın; ondalık (170) ya da onaltılık (0xAA) yazabilirsiniz.',
  'studio.action.importSchema': 'Şema dosyası içe aktar (JSON)',
  'studio.action.resetToSample': 'Örnek şemaya dön',
  'studio.action.analyze': 'Çözümle',
  'studio.action.sampleHint':
    'Örnek şema spec §9.6 ALP Sensor Protocol tanımıdır; örnek çerçeve §43 doğrulanmış baytlarıdır.',
  'studio.analyze.done': 'Çözümleme tamam: çerçeve şemaya uydu.',
  'studio.analyze.failed': 'Çözümleme başarısız; ayrıntı aşağıdaki çıktı panelinde.',
  'studio.analyze.empty': 'Çözümlenecek çerçeve yok; önce örnek çerçeveyi hex olarak girin.',
  'studio.analyze.blocked': 'Şema henüz geçerli değil; doğrulama sekmesindeki sorunları giderin.',
  'studio.error.fileReadFailed': 'Dosya okunamadı.',
  'studio.help.purpose.title': 'Bu araç ne işe yarar',
  'studio.help.purpose.body':
    'Belgelenmemiş ya da kendi tasarladığınız ikili protokolü tanımlar, örnek bir çerçeve üzerinde doğrular ve gömülü tarafta kullanacağınız kodu üretir.',
  'studio.help.protocols.title': 'Hangi protokoller',
  'studio.help.protocols.body':
    'Şema tabanlı her ikili çerçeve: başlangıç/bitiş baytlı, sabit uzunluklu, uzunluk alanlı ya da çerçevelemesiz akışlar. Metin tabanlı protokoller bu aracın kapsamı dışındadır.',
  'studio.help.sections.title': 'Spec §42 bölümleri ekranda nerede',
  'studio.help.sections.inputs':
    'Girdiler: şema bilgileri şeridi, soldaki alan listesi ve ortadaki örnek çerçeve kutusu.',
  'studio.help.sections.sample':
    'Örnek veri: örnek şemaya dönüş düğmesi §9.6 şemasını ve §43 çerçevesini geri yükler.',
  'studio.help.sections.action':
    'Hesap düğmesi: çözümle düğmesi sonucu duyurur ve çıktı bölümüne kaydırır.',
  'studio.help.sections.result':
    'Sonuç: çıktı bölümünün çözümleme sekmesi — ham değer, fiziksel değer, birim ve geçerlilik.',
  'studio.help.sections.formula':
    'Formül: her alan satırının altındaki hesap adımları katlanır bölümü.',
  'studio.help.sections.steps':
    'Adım adım: aynı katlanır bölüm ham bayttan fiziksel değere giden zinciri sırayla yazar.',
  'studio.help.sections.copy': 'Kopyalama: her üretilen çıktının başındaki kopyala düğmesi.',
  'studio.help.sections.export': 'Dışa aktarma: her çıktı sekmesindeki dosya indirme düğmesi.',
  'studio.help.interpretation.title': 'Sonuç nasıl okunur',
  'studio.help.interpretation.body':
    'Ham değer baytların birleştirilmiş hâlidir; fiziksel değer ölçek ve kalibrasyon uygulandıktan sonrasıdır. Geçersiz işaretli bir alan, değerin şemadaki sınırların dışında kaldığını söyler.',
  'studio.help.limitations.title': 'Sınırlamalar',
  'studio.help.limitations.generatedCodeNotExecuted':
    'Üretilen kod salt metindir; tarayıcıda çalıştırılmaz ve derlenmez.',
  'studio.help.limitations.byteViewerLimit':
    'Bayt görüntüleyici çok büyük çerçevelerde satırları keser; kesilen bayt sayısı altta bildirilir.',
  'studio.help.limitations.encoderIgnoresOffset':
    'Kodlayıcı alanları sırayla yazar; şemadaki offset değeri çözümlemede kullanılır, kodlamada değil.',
  'studio.help.limitations.bigintFields':
    '64 bitlik alanlar BigInt ile taşınır; ondalık ölçek uygulanan 64 bit alanlarda duyarlık kaybı olabilir.',
  'studio.help.commonErrors.title': 'Yaygın hatalar ve ne yapmalı',
  'studio.help.commonErrors.invalidHexAdvice':
    'Girdide hex dışı karakter ya da tek basamak var; her bayt iki basamaktır.',
  'studio.help.commonErrors.lengthMismatchAdvice':
    'Uzunluk alanının değeri gerçek yük uzunluğuna uymuyor; uzunluk bağını ve offsetleri kontrol edin.',
  'studio.help.commonErrors.crcMismatchAdvice':
    'Checksum kapsamı yanlış alandan başlıyor ya da bitiyor; kapsam başlangıç ve bitiş alanlarını gözden geçirin.',
  'studio.help.commonErrors.startDelimiterAdvice':
    'Çerçeve başlangıç baytıyla başlamıyor; örnek çerçeveyi ya da çerçeveleme ayarını düzeltin.',
  'studio.help.commonErrors.valueOutOfRangeAdvice':
    'Alanın değeri tipinin ya da şemadaki asgari/azami sınırın dışında kalıyor.',
  'studio.help.commonErrors.unsupportedFunctionCodeAdvice':
    'Enum tablosunda bu anahtar yok; anahtarı enum değerlerine ekleyin.',
  'studio.help.commonErrors.circularLengthAdvice':
    'İki alan birbirinin uzunluğunu gösteriyor; uzunluk zincirini kırın.',

  // --- Packet Builder ---
  'nav.packetBuilder': 'Paket kurucu',
  'builder.error.encodeFailed': 'Paket kodlanamadı: {detail}',
  'builder.error.postProcessingFailed': 'Çerçeveleme sonrası işlem başarısız: {detail}',
  'builder.issue.exceedsMaximumFrameLength': 'Çerçeve azami uzunluğu aşıyor: {detail}',
  'builder.issue.invalidValue': 'Değer bu alana yazılamaz: {detail}',
  'builder.issue.lengthMismatch': 'Çerçeve uzunluğu, uzunluk alanıyla uyuşmuyor: {detail}',
  'builder.issue.missingValue': 'Zorunlu alan boş: {detail}',
  'builder.issue.unknownEnumLabel': 'Enum etiketi tanınmıyor: {detail}',
  'builder.issue.valueOutOfRange': 'Değer alanın aralığının dışında: {detail}',
  'builder.warning.bitPadding': 'Bit akışı bayta hizalansın diye {bits} bit dolgu eklendi.',

  // --- Packet Builder — ekran, paneller ve kılavuz ---
  'builder.title': 'Paket kurucu',
  'builder.intro':
    'Şemadaki alanları doldurun; uzunluk ve checksum kendiliğinden hesaplansın, paketi hex olarak görün ve bağlı kaynağa gönderin.',
  'builder.privacy':
    'Şema, alan değerleri ve üretilen paketler yalnız bu tarayıcıda kalır; hiçbir bayt sunucuya gönderilmez.',
  'builder.section.schema': 'Şema',
  'builder.section.connection': 'Bağlantı',
  'builder.section.form': 'Alan değerleri',
  'builder.section.preview': 'Paket önizleme',
  'builder.section.send': 'Gönderim',
  'builder.section.documentation': 'Kılavuz',
  'builder.section.project': 'Proje ve şablonlar',
  'builder.template.nameLabel': 'Şablon adı',
  'builder.template.save': 'Şablon olarak kaydet',
  'builder.schema.missing':
    'Geçerli bir protokol şeması yok; önce Studio ekranında bir şema kurun.',
  'builder.schema.nameLabel': 'Protokol:',
  'builder.schema.versionLabel': 'Sürüm:',
  'builder.schema.editInStudio': 'Studio ekranında düzenle',
  'builder.schema.reload': 'Şemayı yeniden yükle',
  'builder.source.label': 'Kaynak',
  'builder.source.simulated': 'Simülasyon',
  'builder.source.serial': 'Seri port',
  'builder.source.websocket': 'WebSocket',
  'builder.source.plannedBadge': 'planlandı',
  'builder.source.simulatedHint':
    'Simülasyon kaynağı yalnız veri üretir; bu kaynağa paket gönderilemez.',
  'builder.source.serialHint':
    'Seri port bağlantısı tarayıcı izni ister ve yalnız Web Serial destekleyen tarayıcılarda çalışır.',
  'builder.serialUnsupported': 'Bu tarayıcıda Web Serial API yok; seri port seçeneği kullanılamaz.',
  'builder.status.label': 'Durum:',
  'builder.status.disconnected': 'Bağlı değil',
  'builder.status.connecting': 'Bağlanıyor',
  'builder.status.connected': 'Bağlı',
  'builder.status.error': 'Hata',
  'builder.action.connect': 'Bağlan',
  'builder.action.disconnect': 'Bağlantıyı kes',
  'builder.action.build': 'Paketi oluştur',
  'builder.action.send': 'Gönder',
  'builder.action.stop': 'Durdur',
  'builder.warning.readOnlySource': 'Bu kaynak yazmaya kapalı; paket üretilir ama gönderilemez.',
  'builder.build.idle': 'Paket her değişiklikte yeniden üretiliyor. Bayt sayısı:',
  'builder.build.ready': 'Paket hazır. Bayt sayısı:',
  'builder.build.blocked': 'Paket üretilemedi; aşağıdaki sorunları giderin. Bayt sayısı:',
  'builder.form.label': 'Şema alanları',
  'builder.form.randomize': 'Rastgele doldur',
  'builder.form.empty': 'Şemada doldurulacak alan yok.',
  'builder.form.derivedBadge': 'otomatik',
  'builder.form.minimum': 'asgari',
  'builder.form.maximum': 'azami',
  'builder.field.increment': 'Artır',
  'builder.field.decrement': 'Azalt',
  'builder.field.postProcessing': 'Çerçeveleme sonrası işlem',
  'builder.postProcessing.none': 'Yok',
  'builder.postProcessing.byteStuffing': 'Bayt doldurma',
  'builder.postProcessing.bitStuffing': 'Bit doldurma',
  'builder.postProcessing.cobs': 'COBS',
  'builder.postProcessing.slip': 'SLIP',
  'builder.preview.empty': 'Henüz paket üretilmedi.',
  'builder.preview.regionsNote':
    'Burada alan renklendirmesi yoktur; alanların bayt aralıklarını Studio çözümlemesinde görebilirsiniz.',
  'builder.preview.byteCount': 'Bayt sayısı:',
  'builder.preview.hex': 'Paket (hex)',
  'builder.preview.overrideToggle': 'Paketi elle düzenle',
  'builder.preview.overrideLabel': 'Elle girilen paket (hex)',
  'builder.preview.overrideHint':
    'Elle düzenleme açıkken alan değerleri ve türetilen baytlar yok sayılır; ne yazdıysanız o gönderilir.',
  'builder.preview.code.c': 'C dizisi',
  'builder.preview.code.python': 'Python dizisi',
  'builder.preview.code.javascript': 'JavaScript dizisi',
  'builder.send.mode': 'Gönderim kipi',
  'builder.mode.once': 'Tek sefer',
  'builder.mode.count': 'N kere',
  'builder.mode.periodic': 'Periyodik',
  'builder.send.intervalMs': 'Periyot (ms)',
  'builder.send.count': 'Tekrar sayısı',
  'builder.send.responseTimeoutMs': 'Yanıt zaman aşımı (ms)',
  'builder.send.sentCount': 'Gönderilen:',
  'builder.send.disabledHint':
    'Gönderim için yazabilen bir kaynağa bağlanın ve geçerli bir paket üretin.',
  'builder.send.lastResponse': 'Son yanıt',
  'builder.send.noResponse': 'Henüz yanıt gelmedi.',
  'builder.steps.column.order': 'Sıra',
  'builder.steps.column.field': 'Alan',
  'builder.steps.column.type': 'Tip',
  'builder.steps.column.value': 'Değer',
  'builder.steps.column.role': 'Rol',
  'builder.steps.role.derived': 'otomatik',
  'builder.steps.role.input': 'girdi',
  'builder.steps.empty': 'Şemada alan yok.',
  'builder.steps.tableLabel': 'Alanların kodlanma sırası',
  'builder.steps.rawFrame': 'Çerçevelenmemiş baytlar (hex)',
  'builder.steps.framedBytes': 'Gönderilecek baytlar (hex)',
  'builder.example.packetLabel': 'Spec §10 örnek paketi (hex)',
  'builder.example.schemaLabel': 'Spec §9.6 örnek şeması (JSON)',
  'builder.result.outgoingLabel': 'Üretilen paket (hex)',
  'builder.copy.outgoingLabel': 'Üretilen paket',
  'builder.copy.exampleLabel': 'Örnek paket',
  'builder.export.hex': 'Hex olarak indir',
  'builder.export.c': 'C dizisi indir',
  'builder.export.python': 'Python dizisi indir',
  'builder.export.javascript': 'JavaScript dizisi indir',
  'builder.export.unavailable': 'Geçerli bir paket yokken dışa aktarma yapılamaz.',
  'builder.export.failed': 'Dosya indirilemedi; tarayıcı indirmeyi engellemiş olabilir.',
  'builder.doc.purpose.title': 'Bu araç ne işe yarar',
  'builder.doc.purpose.body':
    'Şemadaki alanları doldurup geçerli bir ikili paket üretir; uzunluk ve checksum gibi türetilen alanları kendisi hesaplar ve paketi bağlı kaynağa gönderir.',
  'builder.doc.protocols.title': 'Hangi protokoller',
  'builder.doc.protocols.body':
    'Studio ekranında tanımlanmış her şema. Şema orada değişince buradaki form kendiliğinden yeniden kurulur.',
  'builder.doc.inputs.title': 'Girdiler',
  'builder.doc.inputs.body': 'Dört girdi kümesi var:',
  'builder.doc.inputs.fields': 'Alan değerleri — türetilmeyen her alan için bir girdi.',
  'builder.doc.inputs.postProcessing':
    'Çerçeveleme sonrası işlem — bayt doldurma, bit doldurma, COBS ya da SLIP.',
  'builder.doc.inputs.hexOverride': 'Elle hex düzenleme — üretilen paketin yerine geçer.',
  'builder.doc.inputs.sending':
    'Gönderim ayarları — kip, periyot, tekrar sayısı ve yanıt zaman aşımı.',
  'builder.doc.example.title': 'Örnek veri',
  'builder.doc.example.body':
    'Spec §10 Set Output örneği (kanal 2, %75 duty) ve §9.6 şeması, kopyalanabilir hâlde:',
  'builder.doc.action.title': 'Hesap düğmesi',
  'builder.doc.action.body':
    'Paket oluştur düğmesi hesabı tetiklemez — paket zaten her tuş vuruşunda yeniden üretilir. Düğmenin işi sonucu ekran okuyucuya yeniden duyurmaktır.',
  'builder.doc.result.title': 'Sonuç',
  'builder.doc.result.body':
    'Gönderilecek baytlar, çerçeveleme ve varsa çerçeveleme sonrası işlem uygulandıktan sonraki hâliyle:',
  'builder.doc.formula.title': 'Kullanılan formül',
  'builder.doc.formula.body': 'Örnek şemadaki checksum XOR8 ile hesaplanır:',
  'builder.doc.formula.expression': 'checksum = b[0] XOR b[1] XOR … XOR b[n-1]',
  'builder.doc.formula.coverage':
    'Kapsam şemadaki coverage tanımından gelir; örnek şemada address alanından payload alanının sonuna kadar.',
  'builder.doc.formula.crcNote':
    'CRC seçilirse polinom, başlangıç değeri, giriş/çıkış yansıması ve son XOR şemadan okunur; checksum baytının kendisi kapsam dışıdır.',
  'builder.doc.steps.title': 'Adım adım',
  'builder.doc.steps.body':
    'Alanlar şemadaki sırayla kodlanır; türetilen alanlar kendilerinden önceki baytlar yazıldıktan sonra hesaplanır.',
  'builder.doc.interpretation.title': 'Sonuç nasıl okunur',
  'builder.doc.interpretation.body':
    'Hex çıktının ilk baytı çerçeve başlangıcı, son baytı çerçeve bitişidir; aradaki baytlar alan sırasını izler.',
  'builder.doc.interpretation.response':
    'Yanıt beklendiğinde gelen ilk bayt öbeği son yanıt alanında hex olarak gösterilir; çözümlemesi Live Monitor ekranının işidir.',
  'builder.doc.limits.title': 'Sınırlamalar',
  'builder.doc.limits.websocket':
    'WebSocket kaynağı henüz gerçeklenmedi; seçenek görünür ama devre dışıdır.',
  'builder.doc.limits.singleOwner':
    'Bir seri portu aynı anda tek sekme tutabilir; Live Monitor aynı portu tutuyorsa buradan bağlanamazsınız.',
  'builder.doc.limits.checksumOrder':
    'Checksum alanı şemada en sonda olmalı; ortada tanımlanmış bir checksum kendinden sonraki baytları kapsayamaz.',
  'builder.doc.limits.offsetIgnored':
    'Kodlayıcı alanları sırayla yazar; şemadaki offset değeri kodlamada kullanılmaz.',
  'builder.doc.limits.permissionDenied':
    'Seri port izni reddedilirse bağlantı kurulmaz; izni yeniden istemek yeni bir kullanıcı jesti gerektirir.',
  'builder.doc.limits.simulatedReadOnly':
    'Simülasyon kaynağı yalnız okur; bu kaynağa bağlıyken gönderim düğmesi kapalı kalır.',
  'builder.doc.mistakes.title': 'Yaygın hatalar',
  'builder.doc.mistakes.specChecksum':
    'Spec §10 örnek paketi checksum baytını 6C yazar; XOR8 hesabının doğru sonucu 6E ve bu araç 6E üretir.',
  'builder.doc.mistakes.derivedFields':
    'Türetilen alanlara elle değer yazmak işe yaramaz; kodlayıcı onları her zaman kendisi hesaplar.',
  'builder.doc.mistakes.hexOverride':
    'Elle hex düzenleme açık kaldığında alan değerlerindeki değişiklikler pakete yansımaz.',
  'builder.doc.mistakes.oddHexDigits':
    'Hex girdide basamak sayısı tek kalırsa son bayt yarım olur ve paket üretilmez.',
  'builder.doc.mistakes.frameTooLong':
    'Yük uzadıkça çerçeve şemadaki azami uzunluğu aşabilir; sınır şema bilgileri şeridinde yazar.',
  'builder.doc.mistakes.enumLabel':
    'Enum alanına tabloda olmayan bir anahtar yazmak değeri değil, hatayı üretir.',
  'builder.doc.copy.title': 'Kopyalama',
  'builder.doc.copy.body': 'Üretilen paketi ya da spec örneğini panoya alın:',
  'builder.doc.export.title': 'Dışa aktarma',
  'builder.doc.export.body':
    'Paket ve üç dildeki dizi karşılığı tamamen istemcide üretilir; hiçbir dosya sunucuya uğramaz.',
  'builder.error.cannotWrite': 'Bu kaynak yazmaya kapalı; paket gönderilemez.',
  'builder.error.invalidHex': 'Elle girilen hex okunamadı; her bayt iki basamaktır.',
  'builder.error.invalidSchema':
    'Protokol şeması geçerli değil; Studio ekranındaki doğrulama sorunlarını giderin.',
  'builder.error.notConnected': 'Önce bir kaynağa bağlanın.',
  'builder.error.nothingToSend': 'Gönderilecek paket yok.',
  'builder.error.openFailed': 'Port açılamadı.',
  'builder.error.permissionDenied': 'Seri port izni verilmedi.',
  'builder.error.portBusy': 'Port başka bir sekme ya da uygulama tarafından kullanılıyor.',
  'builder.error.readFailed': 'Porttan okuma başarısız oldu.',
  'builder.error.serialUnsupported': 'Bu tarayıcıda Web Serial API yok.',
  'builder.error.writeFailed': 'Porta yazma başarısız oldu.',

  // --- Proje dosyası ---
  'projects.action.applyTemplate': 'Uygula',
  'projects.action.load': 'Proje yükle',
  'projects.action.removeTemplate': 'Sil',
  'projects.action.save': 'Projeyi kaydet',
  'projects.panel.loadedLabel': 'Yüklü proje',
  'projects.panel.nameLabel': 'Proje adı',
  'projects.panel.privacy': 'Proje dosyası yalnız bu tarayıcıda üretilir ve indirilir; hiçbir bayt sunucuya gönderilmez.',
  'projects.panel.templateSchemaLabel': 'Şema',
  'projects.panel.templatesEmpty': 'Kayıtlı paket şablonu yok. Paket kurucuda form değerlerini şablon olarak kaydedebilirsiniz.',
  'projects.panel.templatesTitle': 'Paket şablonları',
  'projects.error.downloadFailed': 'Proje dosyası indirilemedi.',
  'projects.error.fileReadFailed': 'Dosya okunamadı.',
  'projects.error.futureVersion':
    'Proje dosyası daha yeni bir biçim sürümü taşıyor; uygulamayı güncelleyin.',
  'projects.error.invalidDescription': 'Proje açıklaması metin olmalı.',
  'projects.error.invalidJson': 'Dosya geçerli JSON değil.',
  'projects.error.invalidName': 'Proje adı boş olamaz.',
  'projects.error.invalidPacketTemplate': 'Paket şablonlarından biri okunamadı.',
  'projects.error.invalidPacketTemplates': 'Paket şablonu listesi dizi değil.',
  'projects.error.invalidProtocols': 'Protokol listesi metin dizisi olmalı.',
  'projects.error.invalidSavedAt': 'Kayıt zamanı okunabilir bir tarih değil.',
  'projects.error.missingProject': 'Dosyada proje bölümü yok.',
  'projects.error.missingVersion': 'Dosyada biçim sürümü yok — bu bir proje dosyası değil.',
  'projects.error.notAnObject': 'Dosyanın kökü JSON nesnesi değil.',
  'projects.error.unsupportedVersion': 'Bu biçim sürümü artık desteklenmiyor.',
  'projects.error.versionNotNumber': 'Biçim sürümü tam sayı olmalı.',

  // --- Çerçeve çözümleme paneli ---
  'decode.loadFailed': 'Protokol motoru yüklenemedi.',
  'decode.example.label': 'Örnek çerçeve',
  'decode.example.empty': 'Bu eklenti örnek çerçeve sunmuyor; baytları elle girebilirsiniz.',
  'decode.hexInput.label': 'Çerçeve baytları (HEX)',
  'decode.error.invalidHex': 'Geçersiz onaltılık (hex) girdi',
  'decode.byteCount': 'Bayt sayısı',
  'decode.noParser':
    'Bu eklentinin çözümleyicisi yok; yalnız kodlama ve örnek çerçeveler sunuyor. Baytlar aşağıda ham olarak gösteriliyor.',
  'decode.parserCrashed': 'Çözümleyici beklenmedik bir hatayla durdu; ham baytlar aşağıda.',
  'decode.table.label': 'Çözümlenen alanlar',
  'decode.column.field': 'Alan',
  'decode.column.offset': 'Ofset',
  'decode.column.length': 'Uzunluk',
  'decode.column.raw': 'Ham değer',
  'decode.column.physical': 'Fiziksel değer',
  'decode.column.validity': 'Geçerlilik',
  'decode.status.valid': 'Geçerli',
  'decode.status.invalid': 'Geçersiz',
  'decode.fields.empty': 'Çözümleme hiç alan üretmedi.',
  'decode.parseError.title': 'Çerçeve çözümlenemedi',
  'decode.parseError.offset': 'Hata offset',
  'decode.parseError.consumedBytes': 'Tüketilen bayt',
  'decode.parseError.recoverable': 'Toparlanabilir — sonraki çerçeveden devam edilebilir.',
  'decode.parseError.unrecoverable': 'Toparlanamaz — bu noktadan sonrası güvenilir değil.',

  // --- Modbus ---
  // Function code ve protokol adları VERİDİR, çevrilmez; buradaki metinler
  // yalnız o kodun ne yaptığını anlatır. Hiçbirinde yer tutucu yok:
  // `modbusPdu.ts` sayıları ayrı alanlarda basar (bkz. oradaki `summaryParams` notu).
  'protocol.modbus.pdu.summary.readCoils': 'Coil okuma',
  'protocol.modbus.pdu.summary.readDiscreteInputs': 'Discrete input okuma',
  'protocol.modbus.pdu.summary.readHoldingRegisters': 'Holding register okuma',
  'protocol.modbus.pdu.summary.readInputRegisters': 'Input register okuma',
  'protocol.modbus.pdu.summary.writeSingleCoil': 'Tek coil yazma',
  'protocol.modbus.pdu.summary.writeSingleRegister': 'Tek register yazma',
  'protocol.modbus.pdu.summary.writeMultipleCoils': 'Çoklu coil yazma',
  'protocol.modbus.pdu.summary.writeMultipleRegisters': 'Çoklu register yazma',
  'protocol.modbus.pdu.summary.maskWriteRegister': 'Maskeli register yazma',
  'protocol.modbus.pdu.summary.readWriteMultipleRegisters': 'Çoklu register okuma/yazma',
  'protocol.modbus.pdu.summary.encapsulatedInterfaceTransport':
    'Kapsüllenmiş arayüz taşıma (MEI)',
  'protocol.modbus.pdu.summary.exceptionResponse': 'Exception yanıtı',
  'protocol.modbus.pdu.summary.unknownFunctionCode': 'Bilinmeyen function code',
  'protocol.modbus.pdu.warning.truncatedBody':
    'PDU gövdesi bu function code’un beklediğinden kısa; kalan alanlar çözülemedi.',
  'protocol.modbus.pdu.warning.truncatedField': 'Alan gövdenin sonuna sığmıyor, eksik okundu.',
  'protocol.modbus.pdu.warning.emptyBody': 'PDU gövdesi boş.',
  'protocol.modbus.pdu.warning.byteCountMismatch':
    'Byte count alanı gövdede kalan veri uzunluğuyla uyuşmuyor.',
  'protocol.modbus.pdu.warning.oddRegisterByteCount':
    'Register verisi tek sayıda byte içeriyor; bir register 16 bittir.',
  'protocol.modbus.pdu.warning.trailingBytes': 'Gövdede çözülen alanlardan sonra artan byte var.',
  'protocol.modbus.pdu.warning.zeroQuantity':
    'Quantity alanı sıfır; hiçbir öğe okunmaz ya da yazılmaz.',
  'protocol.modbus.pdu.warning.unknownFunctionCode':
    'Function code tabloda yok; gövde ham byte olarak bırakıldı.',
  'protocol.modbus.pdu.warning.illegalCoilValue':
    'Coil değeri yalnız 0xFF00 (ON) ya da 0x0000 (OFF) olabilir.',
  'protocol.modbus.pdu.warning.missingExceptionCode':
    'Exception yanıtında exception code byte’ı yok.',
  'protocol.modbus.pdu.warning.unknownExceptionCode': 'Exception code tabloda yok.',
  'protocol.modbus.pdu.warning.exceptionBitInRequest':
    'İstek PDU’sunda exception biti (0x80) set; istekler bu biti taşımaz.',
  'protocol.modbus.rtu.documentation.summary':
    'Modbus uygulama protokolünün seri hatta ikili kodlanmış biçimi. Çerçeve sınırı bir sınırlayıcı değil sessiz aralıktır; bütünlük adresten PDU sonuna kadar hesaplanan CRC-16 ile korunur.',
  'protocol.modbus.rtu.error.crcMismatch':
    'CRC uyuşmuyor: hesaplanan değer çerçevede taşınan değerle aynı değil.',
  'protocol.modbus.rtu.error.frameTooShort':
    'Çerçeve çok kısa: bir Modbus RTU çerçevesi en az adres, function code ve iki baytlık CRC taşır.',
  'protocol.modbus.rtu.error.frameTooLong':
    'Çerçeve, izin verilen en büyük Modbus RTU uzunluğunu aşıyor.',
  'protocol.modbus.rtu.error.unsupportedFunctionCode':
    'Desteklenmeyen function code — çerçeve yine de bayt bayt gösteriliyor.',
  'protocol.modbus.rtu.error.aborted': 'Çözümleme iptal edildi.',
  'protocol.modbus.rtu.warning.roleInferredRequest':
    'Yön verilmedi; çerçeve gövdesine bakılarak istek olarak çözüldü.',
  'protocol.modbus.rtu.warning.roleInferredResponse':
    'Yön verilmedi; çerçeve gövdesine bakılarak yanıt olarak çözüldü.',
  'protocol.modbus.rtu.warning.broadcastAddress':
    'Adres 0 yayın adresidir: bütün cihazlar dinler, hiçbiri yanıt vermez.',
  'protocol.modbus.rtu.warning.reservedSlaveAddress':
    'Bu adres standartta ayrılmıştır; tekil cihaz adresleri 1 ile 247 arasındadır.',
  'protocol.modbus.rtu.example.readHoldingRegistersRequest.name':
    'Holding register okuma isteği',
  'protocol.modbus.rtu.example.readHoldingRegistersRequest.description':
    'Cihaz 1’den iki holding register isteniyor — CRC’si doğrulanmış referans örnek.',
  'protocol.modbus.rtu.example.readHoldingRegistersResponse.name':
    'Holding register okuma yanıtı',
  'protocol.modbus.rtu.example.readHoldingRegistersResponse.description':
    'Dört bayt veri: birinci register 100, ikinci register 200 okunuyor.',
  'protocol.modbus.rtu.example.exceptionResponse.name': 'Exception yanıtı',
  'protocol.modbus.rtu.example.exceptionResponse.description':
    'Function code’un 0x80 biti set: cihaz isteği Illegal Data Address diyerek reddediyor.',
  'protocol.modbus.rtu.example.writeMultipleCoilsRequest.name': 'Çoklu coil yazma isteği',
  'protocol.modbus.rtu.example.writeMultipleCoilsRequest.description':
    'Cihaz 17’ye on coil yazılıyor; veri iki bayta sığdırılmış bit dizisidir.',
  'protocol.modbus.rtu.example.crcMismatch.name': 'Bozuk CRC',
  'protocol.modbus.rtu.example.crcMismatch.description':
    'Okuma isteğinin CRC’si tek bit bozulmuş: alınan 0x0BC5, hesaplanan 0x0BC4.',
  'protocol.modbus.ascii.documentation.summary':
    'Modbus mesajlarını iki nokta ile CR LF arasında yazdırılabilir onaltılık karakterlerle taşıyan seri biçim; bütünlük CRC yerine LRC ile korunur.',
  'protocol.modbus.ascii.error.missingColon': 'Çerçeve iki nokta (:) ile başlamıyor',
  'protocol.modbus.ascii.error.invalidHexCharacter': 'Çerçevede onaltılık olmayan karakter var',
  'protocol.modbus.ascii.error.oddHexDigitCount': 'Onaltılık basamak sayısı tek',
  'protocol.modbus.ascii.error.missingCarriageReturn': 'LF’ten önce CR yok',
  'protocol.modbus.ascii.error.missingLineFeed': 'Çerçeve LF ile bitmiyor',
  'protocol.modbus.ascii.error.frameTooShort':
    'Çerçeve adres, fonksiyon ve LRC baytlarını taşıyacak kadar uzun değil',
  'protocol.modbus.ascii.error.frameTooLong':
    'İzin verilen uzunluk içinde çerçeve sonu bulunamadı',
  'protocol.modbus.ascii.error.lrcMismatch': 'LRC uyuşmuyor',
  'protocol.modbus.ascii.error.parserCancelled': 'Çözümleme iptal edildi',
  'protocol.modbus.ascii.warning.lrcMismatch': 'Hesaplanan LRC alınan LRC’den farklı',
  'protocol.modbus.ascii.warning.reservedSlaveAddress':
    'Slave adresi standardın ayırdığı 248-255 aralığında',
  'protocol.modbus.ascii.example.readHoldingRegistersRequest.description':
    '1 numaralı cihazdan iki holding register okuma isteği; dokümantasyon adresleri 40001-40002.',
  'protocol.modbus.ascii.example.readHoldingRegistersResponse.description':
    'Aynı isteğin yanıtı: dört bayt veri, iki register değeri.',
  'protocol.modbus.ascii.example.exceptionResponse.description':
    'Exception yanıtı: fonksiyon kodunda 0x80 biti set, exception kodu geçersiz veri adresini bildiriyor.',
  'protocol.modbus.ascii.example.invalidHexCharacter.description':
    'Onaltılık olmayan karakter içeren bozuk çerçeve; hata yolunu gösterir.',
  'protocol.modbus.ascii.example.lrcMismatch.description':
    'LRC’si bir eksik gönderilmiş çerçeve; alanlar yine çözülür, çerçeve geçersiz işaretlenir.',
  'protocol.modbus.tcp.warning.unexpectedProtocolId':
    'Protocol ID sıfır değil; bu port üzerinde başka bir protokol kapsülleniyor olabilir.',
  'protocol.modbus.tcp.warning.oversizedLength':
    'Uzunluk alanı standardın izin verdiği en büyük PDU boyutunu aşıyor.',

  // --- NMEA 0183 ---
  'protocol.nmea.sentence.warning.insufficientFields':
    'Cümle beklenenden az alan taşıyor; eksik alanlar için sonuç üretilmedi.',
  'protocol.nmea.sentence.warning.trailingFields':
    'Cümle beklenenden fazla alan taşıyor; artan alanlar ham olarak gösterildi.',
  'protocol.nmea.sentence.warning.unparseableNumber':
    'Alan sayısal biçime uymuyor; ham değer olduğu gibi gösterildi.',
  'protocol.nmea.sentence.warning.genericFieldsOnly':
    'Bu cümle tipi yalnız ham alan listesiyle gösteriliyor; alan anlamları seçilen NMEA revizyon veritabanı yüklenmeden adlandırılamaz.',
  'protocol.nmea.sentence.warning.unknownFormatter':
    'Bilinmeyen cümle formatı; alanlar semantik ad almadan ham olarak gösterildi.',
  'protocol.nmea.sentence.summary.generic': 'Tanınan formatter, ham alan listesi',
  'protocol.nmea.sentence.summary.unknown': 'Bilinmeyen cümle formatı',
  'protocol.nmea.sentence.summary.gga': 'GPS konum çözümü',
  'protocol.nmea.sentence.summary.rmc': 'Asgari önerilen seyir bilgisi',
  'protocol.nmea.sentence.summary.gsa': 'DOP ve aktif uydular',
  'protocol.nmea.sentence.summary.gsv': 'Görüş alanındaki uydular',
  'protocol.nmea.sentence.summary.vtg': 'Seyir ve hız',
  'protocol.nmea.sentence.summary.gll': 'Coğrafi konum',
  'protocol.nmea.sentence.summary.zda': 'Saat ve tarih',
  'protocol.nmea.0183.error.sentenceTooShort':
    'Cümle en kısa anlamlı NMEA 0183 cümlesinden daha kısa.',
  'protocol.nmea.0183.error.sentenceTooLong':
    'Cümle NMEA 0183’ün klasik 82 karakter sınırını aşıyor.',
  'protocol.nmea.0183.error.startDelimiterNotFound': 'Cümle $ ile başlamıyor.',
  'protocol.nmea.0183.error.missingChecksumDelimiter': 'Cümlede checksum ayracı (*) yok.',
  'protocol.nmea.0183.error.malformedIdentifier':
    'Talker+formatter alanı en az üç karakter olmalı.',
  'protocol.nmea.0183.error.checksumMismatch':
    'Checksum uyuşmuyor: hesaplanan değer cümlede taşınan değerle aynı değil.',
  'protocol.nmea.0183.error.aborted': 'Çözümleme iptal edildi.',
  'protocol.nmea.0183.documentation.summary':
    'Tek talker / çoklu listener yazdırılabilir ASCII cümle protokolü; alan sınırı virgül, bütünlük $ ile * arasındaki karakterlerin XOR checksum’uyla korunur.',
  'protocol.nmea.0183.example.ggaFix.name': 'GGA konum çözümü (spec §43)',
  'protocol.nmea.0183.example.ggaFix.description':
    'Spec §43’ün doğrulanmış referans cümlesi: enlem 48.1173°, boylam 11.516666...°, checksum geçerli.',
  'protocol.nmea.0183.example.ggaChecksumMismatch.name': 'Bozuk checksum',
  'protocol.nmea.0183.example.ggaChecksumMismatch.description':
    'Aynı GGA cümlesi, son checksum hanesi tek bit bozulmuş: alınan 0x48, hesaplanan 0x47.',
  'protocol.nmea.0183.example.rmcFix.name': 'RMC asgari seyir bilgisi',
  'protocol.nmea.0183.example.rmcFix.description':
    'GGA fixture’ıyla aynı konum ve zamanı taşıyan klasik RMC referans cümlesi.',
  'protocol.nmea.0183.example.gsaActiveSatellites.name': 'GSA aktif uydular ve DOP',
  'protocol.nmea.0183.example.gsaActiveSatellites.description':
    '3D fix, altı aktif uydu PRN’i ve PDOP/HDOP/VDOP değerlerini taşıyan klasik referans cümle.',
  'protocol.nmea.0183.example.gsvSatellitesInView.name': 'GSV görüş alanındaki uydular',
  'protocol.nmea.0183.example.gsvSatellitesInView.description':
    'Üç mesajlık dizinin ilki: 11 uydu görüş alanında, bu mesaj dört uydunun PRN/elevation/azimuth/SNR bilgisini taşıyor.',
  'protocol.nmea.0183.example.vtgCourseSpeed.name': 'VTG seyir ve hız',
  'protocol.nmea.0183.example.vtgCourseSpeed.description':
    'Gerçek ve manyetik seyri, knot ve km/h hızını birlikte taşıyan klasik referans cümle.',
  'protocol.nmea.0183.example.gllPosition.name': 'GLL coğrafi konum',
  'protocol.nmea.0183.example.gllPosition.description':
    'Yalnız enlem/boylam, saat ve durum taşıyan sade konum cümlesi.',
  'protocol.nmea.0183.example.zdaTimeDate.name': 'ZDA saat ve tarih',
  'protocol.nmea.0183.example.zdaTimeDate.description':
    'UTC saatini, takvim tarihini ve yerel dilim ofsetini taşıyan cümle.',
  'protocol.nmea.0183.example.mwvGenericEnvelope.name': 'MWV — generic envelope örneği',
  'protocol.nmea.0183.example.mwvGenericEnvelope.description':
    'GNSS 7’lisinin dışında kalan bir cümle tipi: formatter tanınır ama alanlar yalnız ham liste olarak gösterilir.',

  // --- NMEA 2000 ---
  'protocol.nmea.2000.error.frameTooShort':
    'Kayıt identifier ve uzunluk alanlarını taşıyacak kadar uzun değil.',
  'protocol.nmea.2000.error.frameTooLong': 'Kayıt sabit çerçeve boyunu aşıyor.',
  'protocol.nmea.2000.error.notExtended':
    'NMEA 2000 29-bit extended identifier gerektirir; 11-bit çerçeveden PGN çıkarılamaz.',
  'protocol.nmea.2000.error.aborted': 'Çözümleme iptal edildi.',
  'protocol.nmea.2000.warning.reservedBitSet':
    'Ayrılmış bit set; identifier bozuk olabilir ya da güncel standardın genişletilmiş sayfa semantiği kullanılıyor olabilir.',
  'protocol.nmea.2000.warning.nullSourceAddress':
    'Kaynak adres null adres: gönderen düğüm geçerli bir adres talep edememiş.',
  'protocol.nmea.2000.warning.remoteFrame':
    'Remote bayrağı set; NMEA 2000 remote çerçeve kullanmaz.',
  'protocol.nmea.2000.warning.truncatedPayload':
    'Bildirilen veri uzunluğu kayıtta yok; elde olan baytlar gösterildi.',
  'protocol.nmea.2000.warning.pgnNeedsDatabase':
    'PGN numarası hesaplanabiliyor ama adı ve alan düzeni lisanslı NMEA 2000 veritabanından gelir — burada tahmin edilmez.',
  'protocol.nmea.2000.warning.fastPacketUnknown':
    'Bu çerçevenin tek başına yeterli mi yoksa çok parçalı bir Fast Packet aktarımının bir parçası mı olduğu, PGN veritabanı ve aynı oturumun diğer çerçeveleri olmadan bilinemez.',
  'protocol.nmea.2000.warning.possibleJ1939':
    '29-bit identifier tek başına protokol kanıtı değildir; bu çerçeve aynı bit düzenini paylaşan bir J1939 mesajı da olabilir.',
  'protocol.nmea.2000.summary.pdu1': 'Hedefe yönelik NMEA 2000 mesajı',
  'protocol.nmea.2000.summary.pdu2': 'Yayın NMEA 2000 mesajı',
  'protocol.nmea.2000.documentation.summary':
    'IEC 61162-3 gemi içi CAN ağı; identifier matematiği J1939 ile birebir aynıdır (Priority/Reserved/Data Page/PDU Format/PDU Specific/Source Address → PGN). PGN’in anlamı ve Fast Packet birleştirmesi lisanslı NMEA 2000 veritabanı ister, bu sayfa yalnız çerçeve düzeyini çözer.',
  'protocol.nmea.2000.example.sharedJ1939Fixture.name': 'J1939 §43 fixture’ı (paylaşılan formül)',
  'protocol.nmea.2000.example.sharedJ1939Fixture.description':
    'J1939’un doğrulanmış §43 fixture’ıyla BİREBİR aynı baytlar: identifier formülü ortak olduğu için (spec 14701 = 38503) burada da Priority 6, PGN 61444, Source Address 1 çıkar.',
  'protocol.nmea.2000.example.singleFrameCandidate.name': 'Tek çerçeve adayı (kısa payload)',
  'protocol.nmea.2000.example.singleFrameCandidate.description':
    'Dört baytlık kısa payload tek başına yeterli bir mesaj gibi görünüyor, ama motor bunu KANITLAYAMAZ — PGN veritabanı olmadan Fast Packet olasılığı hep açık kalır.',
  'protocol.nmea.2000.example.fastPacketCandidate.name': 'Fast Packet adayı (tam 8 bayt)',
  'protocol.nmea.2000.example.fastPacketCandidate.description':
    'Tam sekiz baytlık payload klasik CAN’in üst sınırıdır; bu, çok parçalı bir Fast Packet aktarımının ilk ya da orta çerçevesi de olabilir, tek başına ayırt edilemez.',
  'protocol.nmea.2000.example.widePgnRange.name': 'Geniş PGN aralığı (Data Page 1)',
  'protocol.nmea.2000.example.widePgnRange.description':
    'Data Page biti 1: PGN 65536 ve üstü genişletilmiş aralığa düşer; numaranın anlamı yine lisanslı veritabanına bağlı.',
  'protocol.nmea.2000.example.pdu1DestinationSpecific.name': 'Hedefe yönelik mesaj (PDU1)',
  'protocol.nmea.2000.example.pdu1DestinationSpecific.description':
    'PDU Format eşiğin altında: PDU Specific alanı hedef adrestir ve PGN hesabında sıfırlanır — J1939 ile aynı formül.',
  'protocol.nmea.2000.example.baseFrameRejected.name': 'Base çerçeve (çözülemez)',
  'protocol.nmea.2000.example.baseFrameRejected.description':
    '11-bit identifier taşıyan çerçeve: hata basılır ama çerçeve yine alan alan gösterilir.',

  // --- CAN ailesi (ortak çerçeve çekirdeği) ---
  'protocol.can.frame.warning.truncatedPayload':
    'Bildirilen veri uzunluğu kayıtta yok; elde olan baytlar çözüldü.',
  'protocol.can.frame.warning.trailingBytes':
    'Kayıt sabit çerçeve boyunu aşıyor; fazla baytlar çerçeveye ait değil.',
  'protocol.can.frame.warning.errorFlagSet':
    'Error bayrağı set: bu bir veri çerçevesi değil, hata bildirimidir.',
  'protocol.can.frame.warning.remoteWithPayload':
    'Remote çerçeve veri taşıyor; remote istek veri alanı taşımaz.',
  'protocol.can.frame.warning.extendedOnBasePage':
    'Bu çerçeve 29-bit extended identifier taşıyor; sayfa 11-bit base biçimi için.',
  'protocol.can.frame.warning.baseOnExtendedPage':
    'Bu çerçeve 11-bit base identifier taşıyor; sayfa 29-bit extended biçimi için.',
  'protocol.can.frame.warning.nonCanonicalFdLength':
    'Uzunluk hiçbir CAN FD DLC koduna karşılık gelmiyor; geçerli değerler 0-8, 12, 16, 20, 24, 32, 48 ve 64’tür.',
  'protocol.can.frame.warning.missingFdfFlag':
    'FDF bayrağı yok; kayıt CAN FD çerçevesi olarak işaretlenmemiş.',
  'protocol.can.frame.warning.higherLayerCandidates':
    '29-bit identifier tek başına protokol kanıtı değildir; J1939, NMEA 2000, ISO-TP Extended, CANopen Extended ve üreticiye özel biçimler hepsi adaydır.',
  'protocol.can.frame.summary.classicData': 'Classical CAN veri çerçevesi',
  'protocol.can.frame.summary.classicRemote': 'Classical CAN remote çerçevesi',
  'protocol.can.frame.summary.fdData': 'CAN FD veri çerçevesi',

  // --- CAN 2.0A / 2.0B ---
  'protocol.can.classic.error.frameTooShort':
    'Kayıt identifier ve uzunluk alanlarını taşıyacak kadar uzun değil.',
  'protocol.can.classic.error.frameTooLong':
    'Kayıt sabit çerçeve boyunu aşıyor; çerçeve sınırı kaymış olabilir.',
  'protocol.can.classic.error.aborted': 'Çözümleme iptal edildi.',
  'protocol.can.classic.base.documentation.summary':
    '11-bit identifier ve en çok 8 bayt veri taşıyan Classical CAN base çerçevesi. Girdi, SocketCAN kaydının bayt düzenidir: identifier little-endian dört bayt, ardından uzunluk ve veri.',
  'protocol.can.classic.extended.documentation.summary':
    '29-bit identifier taşıyan Classical CAN extended çerçevesi; J1939 ve NMEA 2000 gibi üst katmanların taşıyıcısıdır. Girdi, SocketCAN kaydının bayt düzenidir.',
  'protocol.can.classic.example.baseDataFrame.name': 'Base veri çerçevesi',
  'protocol.can.classic.example.baseDataFrame.description':
    'Identifier 0x321, sekiz bayt veri — spec’in DLC örneğinin birebir karşılığı.',
  'protocol.can.classic.example.baseArbitrationWinner.name': 'Arbitrasyonu kazanan çerçeve',
  'protocol.can.classic.example.baseArbitrationWinner.description':
    'Identifier 0x120; spec’in arbitrasyon örneğinde 0x123’e karşı kazanan taraf, çünkü küçük identifier yüksek önceliktir.',
  'protocol.can.classic.example.baseRemoteFrame.name': 'Remote çerçeve',
  'protocol.can.classic.example.baseRemoteFrame.description':
    'RTR bayrağı set, veri alanı yok: veri talebi, veri taşımaz.',
  'protocol.can.classic.example.extendedJ1939Identifier.name': 'Extended identifier (spec §43)',
  'protocol.can.classic.example.extendedJ1939Identifier.description':
    'Identifier 0x18F00401 — spec aynı değeri hem extended çerçeve örneği hem J1939 fixture’ı olarak kullanıyor.',
  'protocol.can.classic.example.extendedBaseFrameMismatch.name': 'Base çerçeve (biçim uyuşmazlığı)',
  'protocol.can.classic.example.extendedBaseFrameMismatch.description':
    'Extended sayfasına düşen 11-bit çerçeve: hata değil, uyarı yolunu gösterir.',

  // --- CAN FD ---
  'protocol.can.fd.error.frameTooShort':
    'Kayıt identifier, uzunluk ve bayrak alanlarını taşıyacak kadar uzun değil.',
  'protocol.can.fd.error.frameTooLong': 'Kayıt CAN FD çerçevesinin sabit boyunu aşıyor.',
  'protocol.can.fd.error.aborted': 'Çözümleme iptal edildi.',
  'protocol.can.fd.documentation.summary':
    'Veri alanını 64 bayta çıkaran ve veri fazında daha hızlı bit rate’e geçebilen ikinci nesil CAN çerçevesi. Uzunluk alanı gerçek bayt sayısıdır; DLC kodu gösterim için geri türetilir.',
  'protocol.can.fd.example.fdBrs12Byte.name': '12 baytlık BRS çerçevesi',
  'protocol.can.fd.example.fdBrs12Byte.description':
    'DLC kodu 9’a karşılık gelen 12 bayt: klasik CAN’in 8 bayt sınırının hemen üstü, eşlemenin kırıldığı ilk nokta.',
  'protocol.can.fd.example.fdMaxPayload.name': '64 baytlık azami yük',
  'protocol.can.fd.example.fdMaxPayload.description':
    'DLC kodu 15, CAN FD’nin üst sınırı; extended identifier ve bit rate geçişi ile birlikte.',
  'protocol.can.fd.example.fdErrorPassive.name': 'Error passive gönderen',
  'protocol.can.fd.example.fdErrorPassive.description':
    'ESI bayrağı set: gönderen düğüm error passive durumunda.',
  'protocol.can.fd.example.fdNonCanonicalLength.name': 'Kanonik olmayan uzunluk',
  'protocol.can.fd.example.fdNonCanonicalLength.description':
    '13 bayt hiçbir DLC koduna karşılık gelmez; uzunluk alanı geçersiz işaretlenir ama veri yine gösterilir.',

  // --- CAN XL ---
  'protocol.can.xl.error.frameTooShort':
    'Kayıt CAN XL başlığını taşıyacak kadar uzun değil.',
  'protocol.can.xl.error.frameTooLong': 'Kayıt CAN XL’in azami çerçeve boyunu aşıyor.',
  'protocol.can.xl.error.lengthOutOfRange':
    'Veri uzunluğu izin verilen aralığın dışında; CAN XL veri alanı 1 ile 2048 bayt arasındadır.',
  'protocol.can.xl.error.aborted': 'Çözümleme iptal edildi.',
  'protocol.can.xl.warning.missingXlfFlag':
    'XLF bayrağı yok; kayıt CAN XL çerçevesi olarak işaretlenmemiş.',
  'protocol.can.xl.warning.truncatedPayload':
    'Bildirilen veri uzunluğu kayıtta yok; elde olan baytlar gösterildi.',
  'protocol.can.xl.warning.trailingBytes':
    'Bildirilen uzunluktan fazla bayt var; fazlası çerçeveye ait değil.',
  'protocol.can.xl.summary.frame': 'CAN XL çerçevesi',
  'protocol.can.xl.documentation.summary':
    'Veri alanı 1–2048 bayt olan üçüncü nesil CAN çerçevesi. Klasik identifier ikiye ayrılır: 11-bit Priority ID yalnız arbitrasyon içindir, içerik ve adres bilgisi 32-bit Acceptance Field’a taşınır. Bu sürümde kapsam çerçeve incelemesiyle sınırlıdır.',
  'protocol.can.xl.example.xlShortFrame.name': 'Kısa CAN XL çerçevesi',
  'protocol.can.xl.example.xlShortFrame.description':
    'On altı baytlık yük, tanımlı VCID ve acceptance field ile temel alan görünümü.',
  'protocol.can.xl.example.xlLargePayload.name': 'Büyük yük',
  'protocol.can.xl.example.xlLargePayload.description':
    'Klasik CAN’in sekiz baytıyla kıyaslanamayacak 256 baytlık yük; görüntüleyicinin kaydırmasını gerektirir.',
  'protocol.can.xl.example.xlSecureFrame.name': 'SEC bayraklı çerçeve',
  'protocol.can.xl.example.xlSecureFrame.description':
    'Simple Extended Content bayrağı set; yük üst katmanın güvenlik biçimine göre yorumlanır.',

  // --- J1939 ---
  'protocol.j1939.error.frameTooShort':
    'Kayıt identifier ve uzunluk alanlarını taşıyacak kadar uzun değil.',
  'protocol.j1939.error.frameTooLong': 'Kayıt sabit çerçeve boyunu aşıyor.',
  'protocol.j1939.error.notExtended':
    'J1939 29-bit extended identifier gerektirir; 11-bit çerçeveden PGN çıkarılamaz.',
  'protocol.j1939.error.aborted': 'Çözümleme iptal edildi.',
  'protocol.j1939.warning.reservedBitSet':
    'Ayrılmış bit set; identifier bozuk olabilir ya da güncel standardın genişletilmiş sayfa semantiği kullanılıyor olabilir.',
  'protocol.j1939.warning.nullSourceAddress':
    'Kaynak adres null adres: gönderen düğüm geçerli bir adres talep edememiş.',
  'protocol.j1939.warning.remoteFrame':
    'Remote bayrağı set; J1939 remote çerçeve kullanmaz.',
  'protocol.j1939.warning.truncatedPayload':
    'Bildirilen veri uzunluğu kayıtta yok; elde olan baytlar gösterildi.',
  'protocol.j1939.warning.spnNeedsDatabase':
    'Veri alanı ham gösteriliyor: parametrelerin isim, çözünürlük ve birimleri lisanslı J1939 veritabanından gelir, tahmin edilmez.',
  'protocol.j1939.warning.transportSession':
    'Bu bir taşıma ya da ağ yönetimi mesajıdır; tam anlamı ancak aynı oturumun diğer çerçeveleriyle birlikte çıkar.',
  'protocol.j1939.summary.pdu1': 'Hedefe yönelik J1939 mesajı',
  'protocol.j1939.summary.pdu2': 'Yayın J1939 mesajı',
  'protocol.j1939.documentation.summary':
    '29-bit CAN identifier’ını önceliğe, sayfa seçimine, PGN’e ve kaynak adrese ayıran ağır vasıta haberleşme mimarisi. PGN kuralı PDU Format eşiğine bağlıdır: 240’ın altında PDU Specific bir hedef adrestir ve PGN’den düşülür, 240 ve üstünde group extension olarak PGN’e girer.',
  'protocol.j1939.example.pdu2Broadcast.name': 'Yayın mesajı (spec §43)',
  'protocol.j1939.example.pdu2Broadcast.description':
    'Identifier 0x18F00401 — spec’in doğrulanmış fixture’ı: öncelik 6, PGN 61444, kaynak adres 1.',
  'protocol.j1939.example.pdu1DestinationSpecific.name': 'Hedefe yönelik mesaj',
  'protocol.j1939.example.pdu1DestinationSpecific.description':
    'PDU Format 239 eşiğin altında: PDU Specific alanı hedef adrestir ve PGN hesabında sıfırlanır.',
  'protocol.j1939.example.addressClaimed.name': 'Adres talebi',
  'protocol.j1939.example.addressClaimed.description':
    'Ağ yönetimi mesajı; hedef yayın adresidir, yani talep bütün düğümlere duyurulur.',
  'protocol.j1939.example.transportDataTransfer.name': 'Taşıma veri paketi',
  'protocol.j1939.example.transportDataTransfer.description':
    'Sekiz baytı aşan bir mesajın parçası; ilk bayt paket sırasıdır, birleştirme oturum katmanının işidir.',
  'protocol.j1939.example.baseFrameRejected.name': 'Base çerçeve (çözülemez)',
  'protocol.j1939.example.baseFrameRejected.description':
    '11-bit identifier taşıyan çerçeve: hata basılır ama çerçeve yine alan alan gösterilir.',

  // --- ISO-TP ---
  'protocol.isotp.error.frameTooShort':
    'Kayıt CAN kimliği ve uzunluk alanlarını taşıyacak kadar uzun değil.',
  'protocol.isotp.error.frameTooLong': 'Kayıt sabit çerçeve boyunu aşıyor.',
  'protocol.isotp.error.aborted': 'Çözümleme iptal edildi.',
  'protocol.isotp.error.missingPci': 'Payload boş: PCI baytı yok, ISO-TP çözülemez.',
  'protocol.isotp.error.incompleteFirstFramePci':
    'First Frame’in ikinci PCI baytı (FF_DL’in alt sekiz biti) eksik.',
  'protocol.isotp.error.unknownPciType':
    'PCI üst nibble’ı ISO-TP’nin dört tipinden (Single/First/Consecutive Frame, Flow Control) hiçbirine uymuyor.',
  'protocol.isotp.warning.remoteFrame':
    'Remote bayrağı set; ISO-TP remote çerçeve kullanmaz.',
  'protocol.isotp.warning.truncatedPayload':
    'Bildirilen veri uzunluğu kayıtta yok; elde olan baytlar gösterildi.',
  'protocol.isotp.warning.truncatedSingleFrameData':
    'SF_DL’in vaat ettiği veri kayıtta yok; elde olan baytlar gösterildi.',
  'protocol.isotp.warning.transportSession':
    'Bu çerçeve çok çerçeveli bir ISO-TP oturumunun parçasıdır; birleştirme ve sıra doğrulaması analiz katmanının işidir, burada yapılmaz.',
  'protocol.isotp.warning.unknownFlowStatus':
    'Flow Status değeri Continue To Send / Wait / Overflow’dan hiçbiri değil.',
  'protocol.isotp.summary.singleFrame': 'Tek çerçevelik ISO-TP mesajı',
  'protocol.isotp.summary.firstFrame': 'Çok çerçeveli ISO-TP oturumunun ilk çerçevesi',
  'protocol.isotp.summary.consecutiveFrame': 'Çok çerçeveli ISO-TP oturumunun ardıl çerçevesi',
  'protocol.isotp.summary.flowControl': 'ISO-TP akış kontrolü çerçevesi',
  'protocol.isotp.summary.unknownPciType': 'Tanınmayan ISO-TP PCI tipi',
  'protocol.isotp.documentation.summary':
    'ISO 15765-2 taşıma katmanı: CAN payload’ının PCI baytını Single/First/Consecutive Frame ve Flow Control olarak çözer. Çok çerçeveli birleştirme, sıra doğrulaması ve STmin zamanlaması bilinçli olarak kapsam dışıdır — tek çerçeve parser’ı oturum durumu tutmaz.',
  'protocol.isotp.example.singleFrame.name': 'Single Frame (spec özet §04)',
  'protocol.isotp.example.singleFrame.description':
    'PCI 0x02 → SF_DL 2, veri 10 01 — spec’in metin içi örneği.',
  'protocol.isotp.example.firstFrame.name': 'First Frame (spec özet §04)',
  'protocol.isotp.example.firstFrame.description':
    'PCI 0x10 0x14 → FF_DL 20 bayt — spec’in metin içi örneği; kalan altı bayt göstermelik.',
  'protocol.isotp.example.consecutiveFrame.name': 'Consecutive Frame',
  'protocol.isotp.example.consecutiveFrame.description':
    'PCI 0x21 → sıra numarası 1, yedi baytlık veri parçası.',
  'protocol.isotp.example.flowControlContinue.name': 'Flow Control (Continue To Send)',
  'protocol.isotp.example.flowControlContinue.description':
    'FS Continue To Send, BS sınırsız (0), STmin ham bayt olarak gösterilir.',
  'protocol.isotp.example.singleFrameTruncated.name': 'Single Frame (eksik veri)',
  'protocol.isotp.example.singleFrameTruncated.description':
    'SF_DL yedi bayt vaat ediyor ama kayıtta yalnız üç bayt var.',
  'protocol.isotp.example.unknownPciTypeRejected.name': 'Tanınmayan PCI tipi',
  'protocol.isotp.example.unknownPciTypeRejected.description':
    'Üst nibble 0xF: ISO-TP’nin dört PCI tipinden hiçbiri değil.',

  // --- UDS ---
  'protocol.uds.error.emptyPdu': 'PDU boş: en az SID baytı gerekir.',
  'protocol.uds.error.incompleteNegativeResponse':
    'Negatif yanıt zarfı eksik: Response Code, Original SID ve NRC’nin üçü de gerekir.',
  'protocol.uds.error.frameTooLong': 'PDU izin verilen azami uzunluğu aşıyor.',
  'protocol.uds.error.aborted': 'Çözümleme iptal edildi.',
  'protocol.uds.warning.unknownSid': 'SID spec’in verdiği servis tablosunda yok.',
  'protocol.uds.warning.nrcNeedsDatabase':
    'NRC ham gösteriliyor: tam kod tablosu ISO 14229’un normatif gövdesindedir ve spec bunu vermiyor, tahmin edilmez.',
  'protocol.uds.warning.trailingBytes': 'Negatif yanıt zarfından sonra artan baytlar var.',
  'protocol.uds.summary.request': 'UDS servis isteği',
  'protocol.uds.summary.positiveResponse': 'UDS pozitif yanıtı',
  'protocol.uds.summary.negativeResponse': 'UDS negatif yanıtı',
  'protocol.uds.documentation.summary':
    'ISO 14229 tanı servislerinin SID/NRC zarfı: istek, pozitif yanıt (SID+0x40) ve negatif yanıt (0x7F + orijinal SID + NRC) ayrımı. Servis parametre gövdesi ve tam NRC tablosu spec’te olmadığı için ham bırakılır.',
  'protocol.uds.example.readDataByIdentifierRequest.name':
    'Read Data By Identifier isteği (spec özet §04)',
  'protocol.uds.example.readDataByIdentifierRequest.description':
    '22 F1 90 — spec’in verdiği örnek: DID 0xF190 (VIN) okuma isteği.',
  'protocol.uds.example.readDataByIdentifierPositiveResponse.name':
    'Read Data By Identifier pozitif yanıtı',
  'protocol.uds.example.readDataByIdentifierPositiveResponse.description':
    '0x62 = 0x22 + 0x40: isteğin pozitif yanıtı, aynı DID’i yankılar.',
  'protocol.uds.example.negativeResponseRequestOutOfRange.name':
    'Negatif yanıt: Request Out Of Range (spec özet §04)',
  'protocol.uds.example.negativeResponseRequestOutOfRange.description':
    '7F 22 31 — spec’in verdiği örnek: NRC 0x31.',
  'protocol.uds.example.testerPresentRequest.name': 'Tester Present isteği',
  'protocol.uds.example.testerPresentRequest.description':
    'Bağlantıyı canlı tutan minimal servis isteği.',
  'protocol.uds.example.unknownSid.name': 'Tanınmayan SID',
  'protocol.uds.example.unknownSid.description':
    'SID tabloda yok: alan geçersiz işaretlenir, çerçeve yine gösterilir.',
  'protocol.uds.example.negativeResponseTruncated.name': 'Negatif yanıt (eksik NRC)',
  'protocol.uds.example.negativeResponseTruncated.description':
    'NRC baytı eksik: yalnız Response Code ve Original SID çözülür.',

  // --- OBD-II ---
  'protocol.obd.error.emptyPdu': 'PDU boş: en az mod baytı gerekir.',
  'protocol.obd.error.frameTooLong': 'PDU izin verilen azami uzunluğu aşıyor.',
  'protocol.obd.error.aborted': 'Çözümleme iptal edildi.',
  'protocol.obd.warning.unknownMode': 'Mod spec’in verdiği dokuz moddan hiçbirine uymuyor.',
  'protocol.obd.summary.request': 'OBD-II mod isteği',
  'protocol.obd.summary.response': 'OBD-II mod yanıtı',
  'protocol.obd.documentation.summary':
    'SAE J1979 / ISO 15031-5 emisyon tanı modeli: dokuz modun kimliği ve mod+0x40 yanıt kuralı çözülür. PID’ler isme/formüle BAĞLANMAZ — spec PID numaralarını vermiyor, yalnız üç formülü (Engine RPM, Vehicle Speed, Coolant Temperature) ayrı hesap fonksiyonu olarak sunar.',
  'protocol.obd.calculator.engineRpm.description':
    'RPM = (A×256+B)/4 — spec özet §04 fixture’ı: A=0x1A, B=0xF8 → 1726 rpm.',
  'protocol.obd.calculator.vehicleSpeed.description': 'Speed = A km/h.',
  'protocol.obd.calculator.coolantTemperature.description': 'T = A − 40 °C.',
  'protocol.obd.example.currentDataRequest.name': 'Mode 01 isteği',
  'protocol.obd.example.currentDataRequest.description':
    'Current Data modu; PID baytı gösterim amaçlı, ham parametre olarak kalır.',
  'protocol.obd.example.engineRpmResponse.name': 'Engine RPM yanıtı (spec özet §04)',
  'protocol.obd.example.engineRpmResponse.description':
    '41 0C 1A F8 — spec’in fixture’ı: Raw 1A F8, decodeEngineRpm ile 1726 rpm.',
  'protocol.obd.example.storedDtcRequest.name': 'Mode 03 isteği',
  'protocol.obd.example.storedDtcRequest.description':
    'Stored DTC modu; PID gerektirmez, tek baytlık istek.',
  'protocol.obd.example.vehicleInformationRequest.name': 'Mode 09 isteği',
  'protocol.obd.example.vehicleInformationRequest.description':
    'Vehicle Information modu; InfoType baytı ham parametre olarak kalır.',
  'protocol.obd.example.unknownMode.name': 'Tanınmayan mod',
  'protocol.obd.example.unknownMode.description':
    'Mod tabloda yok: alan geçersiz işaretlenir, çerçeve yine gösterilir.',

  // --- DoIP ---
  'protocol.doip.error.headerTruncated':
    'Generic header eksik: en az 8 bayt gerekir (version, inverse version, payload type, payload length).',
  'protocol.doip.error.frameTooLong': 'DoIP mesajı izin verilen azami uzunluğu aşıyor.',
  'protocol.doip.error.aborted': 'Çözümleme iptal edildi.',
  'protocol.doip.error.inverseVersionMismatch':
    'Inverse Protocol Version, Protocol Version’ın 0xFF ile XOR’u değil — başlık tutarsız.',
  'protocol.doip.error.payloadTruncated': 'Payload bu tipin gerektirdiği uzunluktan kısa.',
  'protocol.doip.warning.unknownPayloadType':
    'Payload type ISO 13400-2’nin tanıdığı 16 koddan hiçbirine uymuyor.',
  'protocol.doip.warning.payloadLengthMismatch':
    'Header’ın deklare ettiği payload uzunluğu, mesajda gerçekten bulunan bayt sayısıyla uyuşmuyor.',
  'protocol.doip.warning.udsPayloadNeedsUdsPage':
    'UDS gövdesi ham gösteriliyor: SID/NRC çözümü UDS sayfasında yapılır, DoIP payload’ını taşımaz (dalga 1 kararı).',
  'protocol.doip.warning.trailingBytes': 'Bu payload tipi için beklenenden fazla bayt var.',
  'protocol.doip.warning.unknownNackCode':
    'NACK kodu ISO 13400-2’nin Generic NACK tablosunda yok.',
  'protocol.doip.warning.unknownActivationType':
    'Activation Type ISO 13400-2’nin tanıdığı değerlerden biri değil.',
  'protocol.doip.warning.unknownRoutingActivationResponseCode':
    'Response Code Routing Activation Response tablosunda yok.',
  'protocol.doip.warning.unknownFurtherAction': 'Further Action Required değeri tabloda yok.',
  'protocol.doip.warning.unknownSyncStatus': 'VIN/GID Sync Status değeri tabloda yok.',
  'protocol.doip.warning.unknownNodeType':
    'Node Type değeri tabloda yok (Gateway/Node dışında).',
  'protocol.doip.warning.unknownPowerMode': 'Power Mode değeri tabloda yok.',
  'protocol.doip.warning.unknownDiagnosticAckCode':
    'ACK Code 0x00 dışında bir değer — Diagnostic Message ACK yalnız bu kodu tanımlıyor.',
  'protocol.doip.warning.unknownDiagnosticNackCode':
    'NACK kodu Diagnostic Message NACK tablosunda yok.',
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
  'protocol.doip.summary.unknownPayloadType': 'DoIP — bilinmeyen payload type',
  'protocol.doip.documentation.summary':
    'ISO 13400-2 DoIP: generic header (version, payload type, payload length) ve 16 payload tipinin alan düzeni çözülür — Vehicle Announcement, Routing Activation, Alive Check, Entity Status, Power Mode, Diagnostic Message dahil. Diagnostic Message içindeki UDS gövdesi HAM kalır; SID/NRC çözümü UDS sayfasının işidir (dalga 1 kararı, zincir parser seviyesinde kurulmaz).',
  'protocol.doip.example.vehicleAnnouncement.name': 'Vehicle Announcement',
  'protocol.doip.example.vehicleAnnouncement.description':
    'VIN, Logical Address, EID, GID ve Further Action Required alan alan çözülür.',
  'protocol.doip.example.routingActivationRequest.name': 'Routing Activation Request (Default)',
  'protocol.doip.example.routingActivationRequest.description':
    'Activation Type 0x00: varsayılan aktivasyon isteği.',
  'protocol.doip.example.routingActivationResponse.name':
    'Routing Activation Response (Activated)',
  'protocol.doip.example.routingActivationResponse.description':
    'Response Code 0x10: aktivasyon başarılı.',
  'protocol.doip.example.diagnosticMessage.name': 'Diagnostic Message',
  'protocol.doip.example.diagnosticMessage.description':
    'SA/TA çözülür; UDS gövdesi (Read Data By Identifier, DID 0xF190) ham kalır.',
  'protocol.doip.example.genericNack.name': 'Generic NACK (Message Too Large)',
  'protocol.doip.example.genericNack.description': 'NACK code 0x02: mesaj çok büyük.',
  'protocol.doip.example.aliveCheckRequest.name': 'Alive Check Request',
  'protocol.doip.example.aliveCheckRequest.description':
    'Boş payload — yalnız generic header.',
  'protocol.doip.example.aliveCheckResponse.name': 'Alive Check Response',
  'protocol.doip.example.aliveCheckResponse.description':
    'Source Address 2 baytlık tek alan.',
  'protocol.doip.example.routingActivationResponseTruncated.name':
    'Routing Activation Response (eksik)',
  'protocol.doip.example.routingActivationResponseTruncated.description':
    'Entity Logical Address’in ikinci baytı eksik: truncated-frame basar, Tester Logical Address yine görünür.',

  // --- CANopen ---
  'protocol.canopen.error.frameTooShort':
    'Kayıt CAN kimliği ve uzunluk alanlarını taşıyacak kadar uzun değil.',
  'protocol.canopen.error.frameTooLong': 'Kayıt sabit çerçeve boyunu aşıyor.',
  'protocol.canopen.error.aborted': 'Çözümleme iptal edildi.',
  'protocol.canopen.error.extendedNotSupported':
    'CANopen’ın Predefined Connection Set’i yalnız base (11-bit) identifier tanımlar; bu çerçeve extended.',
  'protocol.canopen.error.unknownFunctionCode':
    'Function code CiA 301’in on beş atanmış değerinden hiçbirine uymuyor (0xD/0xF ayrılmış).',
  'protocol.canopen.warning.remoteFrame':
    'Remote bayrağı set; Predefined Connection Set remote çerçeve kullanmaz.',
  'protocol.canopen.warning.truncatedPayload':
    'Bildirilen veri uzunluğu kayıtta yok; elde olan baytlar gösterildi.',
  'protocol.canopen.warning.pdoNeedsMapping':
    'PDO verisi ham gösteriliyor: hangi baytın hangi Object Dictionary girdisine karşılık geldiği PDO mapping’e/EDS’e bağlıdır, burada tahmin edilmez.',
  'protocol.canopen.warning.emcyNeedsDatabase':
    'Error Code ham gösteriliyor: tam hata kodu tablosu cihaza özgü profildendir, spec’te yok.',
  'protocol.canopen.warning.sdoDataNeedsSchema':
    'Veri baytları ham gösteriliyor: tipi Object Dictionary girdisine bağlıdır, EDS olmadan bilinmez.',
  'protocol.canopen.warning.sdoAbortNeedsTable':
    'Abort kodu ham gösteriliyor: tam kod tablosu CiA 301’in normatif gövdesindedir, spec vermiyor.',
  'protocol.canopen.warning.unknownNmtState':
    'Bayt CiA 301’in dört NMT durumundan (Boot-up/Stopped/Operational/Pre-operational) hiçbirine uymuyor.',
  'protocol.canopen.summary.nmt': 'NMT ağ yönetimi komutu',
  'protocol.canopen.summary.sync': 'SYNC senkronizasyon mesajı',
  'protocol.canopen.summary.emcy': 'EMCY acil durum mesajı',
  'protocol.canopen.summary.time': 'TIME zaman mesajı',
  'protocol.canopen.summary.pdo1Tx': 'PDO1 (Tx) süreç verisi',
  'protocol.canopen.summary.pdo1Rx': 'PDO1 (Rx) süreç verisi',
  'protocol.canopen.summary.pdo2Tx': 'PDO2 (Tx) süreç verisi',
  'protocol.canopen.summary.pdo2Rx': 'PDO2 (Rx) süreç verisi',
  'protocol.canopen.summary.pdo3Tx': 'PDO3 (Tx) süreç verisi',
  'protocol.canopen.summary.pdo3Rx': 'PDO3 (Rx) süreç verisi',
  'protocol.canopen.summary.pdo4Tx': 'PDO4 (Tx) süreç verisi',
  'protocol.canopen.summary.pdo4Rx': 'PDO4 (Rx) süreç verisi',
  'protocol.canopen.summary.sdoTx': 'SDO (Tx) servis isteği/yanıtı',
  'protocol.canopen.summary.sdoRx': 'SDO (Rx) servis isteği/yanıtı',
  'protocol.canopen.summary.heartbeat': 'NMT Heartbeat',
  'protocol.canopen.summary.unknown': 'Tanınmayan CANopen mesajı',
  'protocol.canopen.documentation.summary':
    'CiA 301 Predefined Connection Set: COB-ID’nin function code + Node-ID kırılımından mesaj tipini (NMT/SYNC/EMCY/PDOn/SDO/Heartbeat) çözer. Payload’ın anlamı EDS/Object Dictionary’ye bağlı olduğu için ham kalır — J1939’un SPN’i DBC’ye bırakmasıyla aynı sınır.',
  'protocol.canopen.example.nmtStartRemoteNode.name': 'NMT: Start Remote Node',
  'protocol.canopen.example.nmtStartRemoteNode.description':
    'COB-ID 0x000, komut 0x01, hedef node 0x00 (yayın). Komut baytının anlamı ham kalır.',
  'protocol.canopen.example.sync.name': 'SYNC',
  'protocol.canopen.example.sync.description':
    'COB-ID 0x080, function code 1 ve node 0 → SYNC; payload beklenmez.',
  'protocol.canopen.example.emcyNode5.name': 'EMCY (node 5)',
  'protocol.canopen.example.emcyNode5.description':
    'COB-ID 0x085 = 0x080 + 5. Error Code/Register alanlara ayrılır, anlamı ham kalır.',
  'protocol.canopen.example.pdoStatuswordVelocity.name': 'PDO1 Tx (spec özet 04:102)',
  'protocol.canopen.example.pdoStatuswordVelocity.description':
    'CAN ID 0x181, node 1. Spec’in kendi örneği Statusword/Velocity’e çözüyor ama bu, mapping/EDS ister — burada veri ham kalır.',
  'protocol.canopen.example.sdoWriteControlword.name': 'SDO yazma (spec özet 03:87)',
  'protocol.canopen.example.sdoWriteControlword.description':
    'Index 6040 Sub 00, expedited yazma, değer 000F — spec’in verdiği örnek.',
  'protocol.canopen.example.sdoAbort.name': 'SDO Abort',
  'protocol.canopen.example.sdoAbort.description':
    'Komut baytı 0x80: Abort Transfer. Abort kodu ham gösterilir, tabloya bağlanmaz.',
  'protocol.canopen.example.heartbeatOperational.name': 'Heartbeat (Operational)',
  'protocol.canopen.example.heartbeatOperational.description':
    'COB-ID 0x702 = 0x700 + 2, durum baytı 0x05 → Operational.',
  'protocol.canopen.example.reservedFunctionCodeRejected.name': 'Ayrılmış function code',
  'protocol.canopen.example.reservedFunctionCodeRejected.description':
    'Function code 0xD: CiA 301’in on beş atanmış değerinden biri değil, hata basılır.',

  // --- LIN ---
  'protocol.lin.error.frameTooShort':
    'Kayıt Sync, PID ve Checksum baytlarını taşıyacak kadar uzun değil.',
  'protocol.lin.error.frameTooLong': 'Kayıt azami sekiz veri baytının izin verdiği uzunluğu aşıyor.',
  'protocol.lin.error.aborted': 'Çözümleme iptal edildi.',
  'protocol.lin.error.invalidSync': 'İlk bayt 0x55 değil; bu bir LIN Sync baytı olamaz.',
  'protocol.lin.error.checksumMismatch':
    'Checksum ne klasik (yalnız veri) ne geliştirilmiş (PID+veri) konvansiyonuyla eşleşiyor.',
  'protocol.lin.warning.parityMismatch':
    'PID’in parite bitleri ID’den hesaplanan değerle eşleşmiyor.',
  'protocol.lin.summary.frame': 'LIN çerçevesi',
  'protocol.lin.documentation.summary':
    'Sync (0x55) + PID + Data + Checksum çözümü. Break fiziksel katman sinyalidir ve bayt olarak modellenmez. PID paritesi spec’in verdiği formülle, checksum LIN 2.1’den dış kaynaklı algoritmayla hesaplanır — hangi konvansiyonun (klasik/geliştirilmiş) kullanıldığı telden okunamadığı için motor ikisini de dener.',
  'protocol.lin.example.validClassicChecksum.name': 'Geçerli çerçeve (Classic checksum)',
  'protocol.lin.example.validClassicChecksum.description':
    'ID 0x01, PID 0xC1. Checksum yalnız veri baytları üzerinden hesaplananla eşleşiyor.',
  'protocol.lin.example.validEnhancedChecksum.name': 'Geçerli çerçeve (Enhanced checksum)',
  'protocol.lin.example.validEnhancedChecksum.description':
    'Aynı PID/veri; checksum PID dahil hesaplananla eşleşiyor, klasikle değil.',
  'protocol.lin.example.zeroData.name': 'Veri baytı olmayan çerçeve',
  'protocol.lin.example.zeroData.description':
    'Sync + PID + Checksum, hiç veri baytı yok — klasik checksum boş toplam üzerinden 0xFF.',
  'protocol.lin.example.parityMismatch.name': 'Parite hatası',
  'protocol.lin.example.parityMismatch.description':
    'Aynı ID ama PID’in parite bitleri sıfırlanmış — uyarı basılır, çerçeve yine gösterilir.',
  'protocol.lin.example.checksumMismatchRejected.name': 'Checksum hatası',
  'protocol.lin.example.checksumMismatchRejected.description':
    'Checksum baytı ne klasik ne geliştirilmiş hesapla eşleşiyor.',
  'protocol.lin.example.invalidSyncRejected.name': 'Geçersiz Sync baytı',
  'protocol.lin.example.invalidSyncRejected.description':
    'İlk bayt 0x55 değil: hata basılır ama PID/checksum yine çözülür.',

  // --- DBC tanım dosyası ---
  'definition.dbc.action.import': 'DBC dosyası içe aktar',
  'definition.dbc.action.export': 'DBC olarak dışa aktar',
  'definition.dbc.sampleNotice':
    'Örnek tanım gösteriliyor. Kendi DBC dosyanızı içe aktarabilirsiniz; dosya cihazınızdan çıkmaz.',
  'definition.dbc.version': 'Sürüm',
  'definition.dbc.messageCount': 'Mesaj sayısı',
  'definition.dbc.nodes': 'Düğümler',
  'definition.dbc.line': 'Satır',
  'definition.dbc.message.label': 'Mesaj',
  'definition.dbc.sampleHex.label': 'Örnek çerçeve baytları (HEX)',
  'definition.dbc.table.signals': 'Sinyal tanımları',
  'definition.dbc.table.decoded': 'Çözümlenmiş sinyaller',
  'definition.dbc.column.signal': 'Sinyal',
  'definition.dbc.column.start': 'Başlangıç biti',
  'definition.dbc.column.length': 'Bit uzunluğu',
  'definition.dbc.column.byteOrder': 'Bayt sırası',
  'definition.dbc.column.signed': 'İşaretli',
  'definition.dbc.column.factorOffset': 'Çarpan / offset',
  'definition.dbc.column.range': 'Aralık',
  'definition.dbc.column.unit': 'Birim',
  'definition.dbc.column.multiplex': 'Çoklama',
  'definition.dbc.column.label': 'Etiket',
  'definition.dbc.signals.empty': 'Bu mesajda tanımlı sinyal yok.',
  'definition.dbc.decoded.empty':
    'Bu çerçevede çözülebilen sinyal yok; çerçeve mesajın beklediğinden kısa olabilir.',
  'definition.dbc.error.readFailed': 'Dosya okunamadı.',
  'definition.dbc.error.parseFailed':
    'DBC dosyası çözümlenemedi; içinde hiç mesaj tanımı bulunamadı.',
  'definition.dbc.issue.emptyInput': 'Dosya boş.',
  'definition.dbc.issue.noMessages': 'Dosyada hiç mesaj tanımı yok.',
  'definition.dbc.issue.malformedMessage': 'Mesaj satırı beklenen biçimde değil.',
  'definition.dbc.issue.malformedSignal': 'Sinyal satırı beklenen biçimde değil.',
  'definition.dbc.issue.signalWithoutMessage': 'Sinyal bir mesaja bağlı değil.',
  'definition.dbc.issue.malformedValueTable': 'Değer tablosu satırı beklenen biçimde değil.',
  'definition.dbc.issue.unknownValueTableTarget':
    'Değer tablosunun işaret ettiği mesaj ya da sinyal yok.',
  'definition.dbc.issue.unsupportedSection':
    'Bu bölüm okunmadı; sinyal çözümünü etkilemiyor.',
  'definition.dbc.issue.duplicateMessageId':
    'Aynı identifier birden çok kez tanımlanmış; ilk tanım geçerli sayıldı.',
  'definition.dbc.issue.signalExceedsMessage':
    'Sinyal mesajın bildirdiği uzunluğa sığmıyor.',

  // --- EDS tanım dosyası ---
  'definition.eds.action.import': 'EDS dosyası içe aktar',
  'definition.eds.sampleNotice':
    'Örnek tanım gösteriliyor. Kendi EDS dosyanızı içe aktarabilirsiniz; dosya cihazınızdan çıkmaz.',
  'definition.eds.fileName': 'Dosya adı',
  'definition.eds.vendorProduct': 'Satıcı / Ürün',
  'definition.eds.objectCount': 'Nesne sayısı',
  'definition.eds.line': 'Satır',
  'definition.eds.object.label': 'Object Dictionary girdisi',
  'definition.eds.decodeHex.label': 'Örnek değer baytları (HEX)',
  'definition.eds.table.objects': 'Object Dictionary',
  'definition.eds.column.index': 'Index',
  'definition.eds.column.name': 'Ad',
  'definition.eds.column.dataType': 'Veri tipi',
  'definition.eds.column.access': 'Erişim',
  'definition.eds.column.default': 'Varsayılan',
  'definition.eds.column.range': 'Aralık',
  'definition.eds.column.pdoMapping': 'PDO Mapping',
  'definition.eds.decode.unavailable':
    'Bu girdinin veri tipi bilinmiyor; ham baytlar tipe göre çözülemez.',
  'definition.eds.error.readFailed': 'Dosya okunamadı.',
  'definition.eds.error.parseFailed':
    'EDS dosyası çözümlenemedi; içinde hiç Object Dictionary girdisi bulunamadı.',
  'definition.eds.issue.emptyInput': 'Dosya boş.',
  'definition.eds.issue.noObjects': 'Dosyada hiç Object Dictionary girdisi yok.',
  'definition.eds.issue.malformedLine': 'Satır ne bölüm başlığı ne anahtar=değer biçiminde.',
  'definition.eds.issue.unsupportedSection':
    'Bu bölüm okunmadı; Object Dictionary çözümünü etkilemiyor.',
  'definition.eds.issue.duplicateObject':
    'Aynı index/sub-index birden çok kez tanımlanmış; ilk tanım geçerli sayıldı.',

  // --- ISO 14230 (KWP2000) ---
  'protocol.iso14230.error.frameTooShort':
    'Mesaj eksik: en az 3 bayt gerekir (FMT, SID, Checksum).',
  'protocol.iso14230.error.frameTooLong': 'KWP2000 mesajı izin verilen azami uzunluğu aşıyor.',
  'protocol.iso14230.error.aborted': 'Çözümleme iptal edildi.',
  'protocol.iso14230.error.addressBytesTruncated':
    'FMT baytı adres baytlarını (Target/Source) istiyor ama mesajda ikisi için de yer yok.',
  'protocol.iso14230.error.lengthByteTruncated':
    'FMT baytının uzunluk bitleri sıfır — ayrı bir Length baytı bekleniyordu ama mesajda yok.',
  'protocol.iso14230.error.serviceDataTruncated':
    'Service ID ve Checksum için mesajda yeterli bayt kalmadı.',
  'protocol.iso14230.error.checksumMismatch':
    'Checksum, önceki baytların 8-bit toplamıyla (mod 256) uyuşmuyor.',
  'protocol.iso14230.warning.unknownAddressMode':
    'FMT baytının adres kipi bitleri (7-6) tanınan üç değerden biri değil — CARB modu olabilir, ISO 14230’un parçası değil; en iyi çaba ile adres baytı yok varsayıldı.',
  'protocol.iso14230.warning.serviceNeedsTable':
    'Service ID ham gösteriliyor: KWP2000 servis tablosu spec’te yok, UDS tablosunu buraya taşımak uydurma olurdu — adlandırma yapılmaz.',
  'protocol.iso14230.warning.lengthMismatch':
    'FMT baytının (ya da ayrı Length baytının) deklare ettiği uzunluk, mesajda gerçekten bulunan Service ID + veri bayt sayısıyla uyuşmuyor.',
  'protocol.iso14230.summary.frame': 'KWP2000 çerçevesi',
  'protocol.iso14230.documentation.summary':
    'ISO 14230-2 (KWP2000): FMT baytının adres kipi (No Address/Physical/Functional) ve uzunluk bitleri çözülür, adres baytları (Target/Source) ve uzunluk ayrı bir baytta taşınıyorsa o da ayrıştırılır. Service ID ham kalır — UDS’e evrilen servis tablosu spec’te yok, uydurulmadı. Checksum (8-bit toplam mod 256) doğrulanır, tutmazsa checksum-mismatch basar.',
  'protocol.iso14230.example.physicalInlineLength.name': 'Fiziksel adresleme (FMT-içi uzunluk)',
  'protocol.iso14230.example.physicalInlineLength.description':
    'FMT 0x83: fiziksel adresleme, uzunluk FMT baytının kendi bitlerinde taşınıyor.',
  'protocol.iso14230.example.functionalSeparateLength.name':
    'Fonksiyonel adresleme (ayrı Length baytı)',
  'protocol.iso14230.example.functionalSeparateLength.description':
    'FMT 0xC0: uzunluk bitleri sıfır, gerçek uzunluk Target/Source’tan sonraki ayrı baytta.',
  'protocol.iso14230.example.noAddress.name': 'Adres baytı yok',
  'protocol.iso14230.example.noAddress.description':
    'FMT 0x02: adres kipi bitleri 00 — Target/Source üretilmez.',
  'protocol.iso14230.example.carbModeWarning.name': 'CARB modu (uyarı yolu)',
  'protocol.iso14230.example.carbModeWarning.description':
    'FMT 0x42: adres kipi bitleri 01 (CARB) — ISO 14230 dışı, uyarı basar ama çözmeye devam eder.',
  'protocol.iso14230.example.checksumMismatch.name': 'Bozuk checksum',
  'protocol.iso14230.example.checksumMismatch.description':
    'Fiziksel adresleme örneğiyle aynı gövde, checksum baytı bilerek bozuldu.',
  'protocol.iso14230.example.serviceDataTruncated.name': 'Service ID/Checksum için yer yok',
  'protocol.iso14230.example.serviceDataTruncated.description':
    'FMT fiziksel adresleme istiyor; Target/Source okunur ama Service ID ve Checksum için mesajda hiç bayt kalmaz.',

  // --- ISO 9141 ---
  'protocol.iso9141.error.frameTooShort':
    'Mesaj eksik: en az 4 bayt gerekir (3 baytlık header + Checksum).',
  'protocol.iso9141.error.frameTooLong': 'ISO 9141 mesajı izin verilen azami uzunluğu aşıyor.',
  'protocol.iso9141.error.aborted': 'Çözümleme iptal edildi.',
  'protocol.iso9141.error.checksumMismatch':
    'Checksum, önceki baytların 8-bit toplamıyla (mod 256) uyuşmuyor.',
  'protocol.iso9141.warning.unexpectedFormatByte':
    'İlk header baytı 0x68 değil — spec ihlali sayılmaz, ham gösterilip çözümlemeye devam edilir.',
  'protocol.iso9141.warning.unexpectedTargetAddress':
    'İkinci header baytı (Target Address) 0x6A değil — ham gösterilip çözümlemeye devam edilir.',
  'protocol.iso9141.warning.dataNeedsObdPage':
    'Veri ham gösteriliyor: Mode/PID çözümü OBD-II sayfasının işi, ISO 9141 zincir parser seviyesinde kurulmaz.',
  'protocol.iso9141.summary.frame': 'ISO 9141 çerçevesi',
  'protocol.iso9141.documentation.summary':
    'ISO 9141-2: sabit 3 baytlık header (Format 0x68, Target Address 0x6A, Source Address) çözülür — ilk iki baytın farklı bir değeri hata değil uyarı üretir. Veri (SAE J1979 Mode/PID) ham kalır, çözümü OBD-II sayfasının işidir. Checksum (8-bit toplam mod 256) doğrulanır, tutmazsa checksum-mismatch basar.',
  'protocol.iso9141.example.standardHeader.name': 'Standart header',
  'protocol.iso9141.example.standardHeader.description':
    '0x68/0x6A header, Source Address 0xF1 — Mode 0x41 PID 0x0C (RPM) yanıtı ham kalır.',
  'protocol.iso9141.example.unexpectedFormatByte.name': 'Beklenmeyen Format baytı (uyarı yolu)',
  'protocol.iso9141.example.unexpectedFormatByte.description':
    'İlk header baytı 0x68 değil — uyarı basar ama ham gösterip çözmeye devam eder.',
  'protocol.iso9141.example.unexpectedTargetAddress.name':
    'Beklenmeyen Target Address (uyarı yolu)',
  'protocol.iso9141.example.unexpectedTargetAddress.description':
    'İkinci header baytı 0x6A değil — uyarı basar ama ham gösterip çözmeye devam eder.',
  'protocol.iso9141.example.zeroData.name': 'Veri baytı yok',
  'protocol.iso9141.example.zeroData.description':
    'Yalnız header + checksum — minimum uzunluk sınırı.',
  'protocol.iso9141.example.checksumMismatch.name': 'Bozuk checksum',
  'protocol.iso9141.example.checksumMismatch.description':
    'Standart header örneğiyle aynı gövde, checksum baytı bilerek bozuldu.',
} as const;

/**
 * Bir sözlüğün taşıması gereken şekil. `en.ts` bunu ANOTASYON olarak kullanır
 * (`satisfies` değil): eksik anahtar ancak anotasyonla derleme hatası olur.
 */
export type TranslationDictionary = Record<keyof typeof tr, string>;
