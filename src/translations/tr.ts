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
  'studio.output.parseError.code.unsupportedEncoding': 'Desteklenmeyen kodlama biçimi',
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

  // --- AIS ---
  'protocol.ais.error.sentenceTooShort':
    'Cümle zarfın (fragment/sequence/channel/payload/fill bits) alanlarını taşıyacak kadar uzun değil.',
  'protocol.ais.error.sentenceTooLong': 'Cümle NMEA 0183’ün 82 karakterlik sabit sınırını aşıyor.',
  'protocol.ais.error.startDelimiterNotFound': 'Cümle ! ile başlamıyor.',
  'protocol.ais.error.missingChecksumDelimiter': 'Cümlede checksum ayracı (*) yok.',
  'protocol.ais.error.malformedIdentifier': 'Kimlik (talker+formatter) beş karakterden kısa.',
  'protocol.ais.error.unknownFormatter': 'Sentence formatter AIVDM/AIVDO değil — bu sayfa yalnız bu ikisini çözer.',
  'protocol.ais.error.insufficientEnvelopeFields':
    'Zarfın payload ve/veya fill bits alanları eksik; var olan alanlar yine de gösterildi.',
  'protocol.ais.error.emptyPayload': 'Payload alanı boş; Message Type hesaplanamadı.',
  'protocol.ais.error.checksumMismatch': 'NMEA checksum uyuşmuyor.',
  'protocol.ais.error.aborted': 'Çözümleme iptal edildi.',
  'protocol.ais.warning.fragmentedMessage':
    'Bu mesaj birden fazla NMEA cümlesine bölünmüş; bu motor fragment BİRLEŞTİRMEZ, yalnız tek cümleyi çözer — tam anlam tüm parçaların bir araya getirilmesini ister.',
  'protocol.ais.warning.messageTypeNeedsDatabase':
    'Message Type numarası hesaplanabiliyor ama adı bu sayfada adlandırılan beşlinin dışında — tam ad/alan tablosu lisanslı ITU-R M.1371 veritabanından gelir.',
  'protocol.ais.warning.fieldsNeedDatabase':
    'Message Type dışındaki tüm bitler (MMSI, konum, hız, seyir durumu …) lisanslı M.1371 mesaj veritabanına bağlıdır — burada tahmin edilmez, ham bit sayısı gösterilir.',
  'protocol.ais.warning.unparseableNumber': 'Alan sayısal bir değere çevrilemedi.',
  'protocol.ais.summary.received': 'Alınan AIS mesajı (AIVDM)',
  'protocol.ais.summary.ownVessel': 'Kendi gemi AIS raporu (AIVDO)',
  'protocol.ais.documentation.summary':
    '!AIVDM/!AIVDO NMEA 0183 taşıma cümlesi; fragment/sequence/channel/payload/fill bits/checksum TAM çözülür. 6-bit armored payload bit akışına açılır, yalnız Message Type (ilk 6 bit) adlandırılır — spec’in isimlendirdiği beş tip dışında ad atanmaz. Kalan tüm alanlar (MMSI, konum, hız …) lisanslı ITU-R M.1371 veritabanı ister, bu sayfa yalnız zarf + Message Type düzeyini çözer.',
  'protocol.ais.example.positionReportClassA.name': 'Position Report Class A (Tip 1)',
  'protocol.ais.example.positionReportClassA.description':
    'Tek fragmentli, adlandırılmış Message Type 1 örneği — kanal A, geçerli checksum.',
  'protocol.ais.example.multiFragmentStaticData.name': 'Çok parçalı Static Data (Tip 5, 2 fragment)',
  'protocol.ais.example.multiFragmentStaticData.description':
    'Spec’in kendi zarf örneğiyle (2,1,5,A) aynı şekilde: iki fragmentin ilki, Message Type 5 — fragmentedMessage uyarısı basılır, birleştirme YAPILMAZ.',
  'protocol.ais.example.checksumMismatch.name': 'Bozuk checksum',
  'protocol.ais.example.checksumMismatch.description':
    'İlk örnekle aynı gövde, son checksum hanesi bilerek bozuldu — hata basılır ama çerçeve yine alan alan çözülür.',
  'protocol.ais.example.unnamedMessageType.name': 'Adsız Message Type (Tip 8)',
  'protocol.ais.example.unnamedMessageType.description':
    'Binary Broadcast Message: spec’in adlandırdığı beşli listesinde yok — ham numara + messageTypeNeedsDatabase uyarısı basılır.',
  'protocol.ais.example.ownVesselClassB.name': 'Kendi gemi, Class B (AIVDO, Tip 18)',
  'protocol.ais.example.ownVesselClassB.description':
    'AIVDO (own-vessel) formatörü ve adlandırılmış Message Type 18 örneği — kanal B.',

  // --- UBX ---
  'protocol.ubx.error.headerTruncated':
    'Kayıt Sync/Class/ID/Length alanlarını taşıyacak kadar uzun değil.',
  'protocol.ubx.error.frameTooLong': 'Kayıt izin verilen azami çerçeve boyunu aşıyor.',
  'protocol.ubx.error.aborted': 'Çözümleme iptal edildi.',
  'protocol.ubx.error.invalidSync': 'Kayıt B5 62 sync baytlarıyla başlamıyor.',
  'protocol.ubx.error.truncatedPayload':
    'Length alanının bildirdiği payload ve/veya checksum kayıtta yok.',
  'protocol.ubx.error.checksumMismatch':
    'Checksum uyuşmuyor: hesaplanan CK_A/CK_B, çerçevede taşınan değerle aynı değil.',
  'protocol.ubx.warning.unknownClass':
    'Class baytı u-blox arayüz kılavuzunun dar, kamuya açık class kümesinde (NAV/RXM/CFG/ACK/INF/MON…) yok.',
  'protocol.ubx.warning.payloadNeedsDatabase':
    'Payload ham gösteriliyor: alan düzeni (ör. NAV-PVT) u-blox’un sürüme bağlı arayüz kılavuzundan gelir, burada tahmin edilmez.',
  'protocol.ubx.warning.trailingBytes':
    'Length + checksum sonrasında fazladan bayt var; fazlası bu çerçeveye ait değil.',
  'protocol.ubx.summary.frame': 'UBX çerçevesi',
  'protocol.ubx.documentation.summary':
    'u-blox GNSS alıcılarının kendi bayt akışı: Sync (B5 62) + Class + ID + little-endian Length + Payload + 8-bit iki akümülatörlü Checksum (CK_A/CK_B). Checksum kapsamı Class’tan payload sonuna kadardır, sync HARİÇ. Class dar bir kümeden adlandırılır; ID numara tablosu ve payload içi alan düzeni (NAV-PVT gibi) sürüme bağlı, lisanslı arayüz kılavuzundan gelir — burada ham bırakılır.',
  'protocol.ubx.example.monVerPoll.name': 'MON-VER poll (spec ~5355)',
  'protocol.ubx.example.monVerPoll.description':
    'Spec’in verdiği TEK somut UBX bayt dizisi: B5 62 0A 06 00 00 10 3A — Class MON, boş payload, geçerli checksum.',
  'protocol.ubx.example.payloadNeedsDatabase.name': 'Dolu payload (NAV class)',
  'protocol.ubx.example.payloadNeedsDatabase.description':
    'NAV class tanınır ama dört baytlık payload adlandırılmaz — payloadNeedsDatabase uyarısı basılır.',
  'protocol.ubx.example.unknownClass.name': 'Tanınmayan class',
  'protocol.ubx.example.unknownClass.description':
    'Class baytı 0x99 dar kümede yok: uyarı basılır ama çerçeve yine geçerli sayılır.',
  'protocol.ubx.example.checksumMismatch.name': 'Bozuk checksum',
  'protocol.ubx.example.checksumMismatch.description':
    'MON-VER poll örneğiyle aynı gövde, CK_B baytı bilerek bozuldu (0x3A yerine 0x00).',

  // --- RTCM ---
  'protocol.rtcm.error.headerTruncated':
    'Kayıt Preamble ve Length alanlarını taşıyacak kadar uzun değil.',
  'protocol.rtcm.error.frameTooLong': 'Kayıt izin verilen azami çerçeve boyunu aşıyor.',
  'protocol.rtcm.error.aborted': 'Çözümleme iptal edildi.',
  'protocol.rtcm.error.invalidPreamble': 'Kayıt 0xD3 preamble baytıyla başlamıyor.',
  'protocol.rtcm.error.truncatedPayload':
    'Length alanının bildirdiği payload ve/veya CRC kayıtta yok.',
  'protocol.rtcm.error.crcMismatch':
    'CRC-24Q uyuşmuyor: hesaplanan değer, çerçevede taşınan değerle aynı değil.',
  'protocol.rtcm.warning.reservedBitSet':
    'Ayrılmış 6 bit sıfır değil; çerçeve bozuk olabilir ya da bilinmeyen bir revizyon bu alanı kullanıyor olabilir.',
  'protocol.rtcm.warning.payloadNeedsDatabase':
    'Mesaj numarası dışındaki tüm payload baytları (istasyon kimliği, gözlemler, MSM/SSR hücreleri …) resmi RTCM 10403 revizyonuna bağlı — burada ham gösterilir, tahmin edilmez.',
  'protocol.rtcm.warning.messageNumberUnavailable':
    'Payload, 12-bit mesaj numarasını taşıyacak kadar uzun değil.',
  'protocol.rtcm.warning.messageCategoryUnknown':
    'Mesaj numarası bu sayfanın dar kategori eşlemesinde yok; tam adı ve kategorisi lisanslı RTCM mesaj tablosundan gelir.',
  'protocol.rtcm.warning.trailingBytes':
    'Length + CRC sonrasında fazladan bayt var; fazlası bu çerçeveye ait değil.',
  'protocol.rtcm.summary.frame': 'RTCM çerçevesi',
  'protocol.rtcm.documentation.summary':
    'GNSS düzeltme mesajlarının çerçeve biçimi (RTCM 10403.x): 0xD3 preamble + 6-bit ayrılmış + 10-bit Length + Payload + CRC-24Q. Payload’ın ilk 12 biti mesaj numarasıdır ve her zaman çözülür; numaranın kategorisi (Reference Station/MSM/GLONASS…) yalnız spec’in açıkça verdiği dar bir eşlemeyle adlandırılır. Mesajın insan-okur adı ve alan düzeni lisanslı RTCM mesaj tablosundan gelir — burada yazılmaz.',
  'protocol.rtcm.example.referenceStation.name': 'Mesaj 1005 (Reference Station)',
  'protocol.rtcm.example.referenceStation.description':
    'Mesaj numarası 1005, spec’in verdiği kategori eşlemesinde "Reference Station" — geçerli CRC-24Q.',
  'protocol.rtcm.example.unclassifiedMessageNumber.name': 'Kategorisi belirsiz mesaj numarası',
  'protocol.rtcm.example.unclassifiedMessageNumber.description':
    'Mesaj numarası 4095, dar kategori eşlemesinde yok: uyarı basılır ama çerçeve yine geçerli sayılır.',
  'protocol.rtcm.example.crcMismatch.name': 'Bozuk CRC',
  'protocol.rtcm.example.crcMismatch.description':
    'Mesaj 1005 örneğiyle aynı gövde, son CRC baytı bilerek bozuldu (0x27 yerine 0x00).',

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

  // --- MAVLink ---
  'protocol.mavlink.error.v1HeaderTruncated':
    'MAVLink v1 header eksik: en az 6 bayt gerekir (STX, LEN, SEQ, SYSID, COMPID, MSGID).',
  'protocol.mavlink.error.v2HeaderTruncated':
    'MAVLink v2 header eksik: en az 10 bayt gerekir (STX, LEN, Incompat/Compat Flags, SEQ, SYSID, COMPID, 24-bit MSGID).',
  'protocol.mavlink.error.bodyTruncated':
    'Payload, checksum (ve varsa imza) için mesajda yeterli bayt yok.',
  'protocol.mavlink.error.frameTooLong': 'MAVLink mesajı izin verilen azami uzunluğu aşıyor.',
  'protocol.mavlink.error.aborted': 'Çözümleme iptal edildi.',
  'protocol.mavlink.error.unknownMagic':
    'İlk bayt 0xFE (v1) ya da 0xFD (v2) değil — bu bir MAVLink çerçevesi olamaz.',
  'protocol.mavlink.warning.payloadNeedsDialect':
    'Payload ham gösteriliyor: wire alan sırası XML declaration sırasıyla aynı değil, MAVLink dialect tanımı (message definition) yüklenmeden alan alan çözülemez.',
  'protocol.mavlink.warning.crcNeedsDialect':
    'Checksum ham gösteriliyor: CRC-16/MCRF4XX’in parametreleri ve mesaj-özel CRC_EXTRA dialect tanımına bağlı — spec’te yok, bu yüzden doğrulama yapılmaz (checksum-mismatch bu motorda hiç basılmaz).',
  'protocol.mavlink.warning.signatureNeedsKey':
    'İmza mevcut ama doğrulanamıyor: gizli anahtar olmadan MAVLink 2 signing doğrulaması yapılamaz, anahtar hiçbir zaman yerelden çıkmaz.',
  'protocol.mavlink.warning.trailingBytes': 'Çerçeve için beklenenden fazla bayt var.',
  'protocol.mavlink.summary.frame': 'MAVLink çerçevesi',
  'protocol.mavlink.documentation.summary':
    'MAVLink v1 (0xFE) ve v2 (0xFD) header’ı magic baytına göre dallanarak tam çözülür: v1’de LEN/SEQ/SYSID/COMPID/8-bit MSGID, v2’de ayrıca Incompat/Compat Flags, 24-bit MSGID ve (incompat bit 0x01 ise) 13 baytlık imza. Payload ham kalır — wire alan sırası XML declaration sırasıyla aynı değildir, sabit offset yasak. Checksum de ham kalır: CRC-16/MCRF4XX parametreleri ve mesaj-özel CRC_EXTRA dialect tanımına bağlı, spec’te yok — bu yüzden checksum-mismatch hiç basılmaz, `status: partial` (OBD-II emsali).',
  'protocol.mavlink.example.v1Heartbeat.name': 'MAVLink 1 (mutlu yol)',
  'protocol.mavlink.example.v1Heartbeat.description':
    'Spec’in kendi örnek renklendirmesi: FE 09 2A 01 01 00 — header alan alan çözülür, payload ve checksum ham kalır.',
  'protocol.mavlink.example.v2GpsRawInt.name': 'MAVLink 2, imzasız (mutlu yol)',
  'protocol.mavlink.example.v2GpsRawInt.description':
    'Incompat Flags 0x00: imza yok. 24-bit MSGID flags/seq/sysid/compid baytlarıyla çakışmadan ayrıştırılır.',
  'protocol.mavlink.example.v2Signed.name': 'MAVLink 2, imzalı',
  'protocol.mavlink.example.v2Signed.description':
    'Incompat Flags 0x01: imza bayrağı set. 13 baytlık imza ham gösterilir, signatureNeedsKey uyarısıyla.',
  'protocol.mavlink.example.v2LargeMessageId.name': '24-bit MSGID sınırı',
  'protocol.mavlink.example.v2LargeMessageId.description':
    'MSGID 0xFFFFFF: 24-bit alanın üst sınırı, üç baytın doğru birleştirildiğini ve komşu alanlarla çakışmadığını kanıtlar.',
  'protocol.mavlink.example.v1Truncated.name': 'Eksik çerçeve (hata yolu)',
  'protocol.mavlink.example.v1Truncated.description':
    'Header LEN 4 bildiriyor ama payload + checksum için yeterli bayt yok — truncated-frame basar, header yine görünür.',

  // --- Ethernet II / IEEE 802.3 / VLAN 802.1Q (tek parser, üç plugin) ---
  'protocol.ethernet.error.typeLengthTruncated':
    'MAC çiftinden sonraki 2 baytlık EtherType/Length alanı için yeterli bayt yok.',
  'protocol.ethernet.error.vlanTagTruncated':
    'VLAN TPID görüldü ama TCI’ın (2 bayt) tamamı gelmedi.',
  'protocol.ethernet.error.frameTooShort':
    'Çerçeve en az DST MAC + SRC MAC + 2 baytlık alan (14 bayt) kadar uzun olmalı.',
  'protocol.ethernet.error.frameTooLong': 'Çerçeve izin verilen azami uzunluğu aşıyor.',
  'protocol.ethernet.error.aborted': 'Çözümleme iptal edildi.',
  'protocol.ethernet.warning.etherTypeHigherLayer':
    'EtherType üst katman protokolünü adlandırır; payload bu protokolün kendi sayfasında çözülür (motorlar zincir kurmaz).',
  'protocol.ethernet.warning.unknownEtherType':
    'EtherType değeri dar adlandırma kümesinde (IPv4/ARP/IPv6/EtherCAT) yok; payload ham kalır.',
  'protocol.ethernet.warning.undefinedTypeLengthRange':
    'Değer 1501-1535 aralığında: ne EtherType ne IEEE 802.3 Length olarak tanımlı; çözüm yine de sürer.',
  'protocol.ethernet.warning.tooManyVlanTags':
    '3’ten fazla iç içe VLAN tag’i desteklenmiyor; kalan baytlar ham payload olarak gösterildi.',
  'protocol.ethernet.warning.fcsOpportunisticMatch':
    'Son 4 bayt CRC-32 ile uyuşuyor — bu FCS’in gerçekten var olduğunun kanıtı DEĞİLDİR (rastgele eşleşme ihtimali var), yalnız bilgi notu.',
  'protocol.ethernet.warning.looksLikeEthernetII':
    'Bu çerçeve Ethernet II gibi görünüyor (EtherType alanı) — Ethernet II sayfasına bakın.',
  'protocol.ethernet.warning.looksLikeIeee8023':
    'Bu çerçeve IEEE 802.3 gibi görünüyor (Length alanı) — IEEE 802.3 sayfasına bakın.',
  'protocol.ethernet.warning.looksLikeVlanTagged':
    'Bu çerçeve VLAN etiketli gibi görünüyor (0x8100 TPID) — VLAN 802.1Q sayfasına bakın.',

  'protocol.ethernet.ethernetII.documentation.summary':
    'Ethernet II çerçevesi: Destination/Source MAC (broadcast/multicast/unicast sınıflandırmasıyla), EtherType (IPv4/ARP/IPv6 dar kümesi adlandırılır, payload çözülmez) ve VLAN 802.1Q tag’i (varsa) alan alan çözülür. FCS hiç varsayılmaz — "FCS not captured" bilgi alanı her zaman basılır, son 4 bayt CRC-32 ile fırsatçı eşleşirse yalnız bilgi notu eklenir.',
  'protocol.ethernet.ethernetII.example.broadcastArp.name': 'Broadcast ARP (spec örneği)',
  'protocol.ethernet.ethernetII.example.broadcastArp.description':
    'DST broadcast, SRC 00:11:22:33:44:55, EtherType 0x0806 → ARP adlandırılır, payload ham kalır.',
  'protocol.ethernet.ethernetII.example.ipv4Unicast.name': 'Unicast IPv4 çerçevesi',
  'protocol.ethernet.ethernetII.example.ipv4Unicast.description':
    'EtherType 0x0800 → IPv4 adlandırılır ve üst katman uyarısı basılır.',
  'protocol.ethernet.ethernetII.example.unknownEtherType.name': 'Tanınmayan EtherType',
  'protocol.ethernet.ethernetII.example.unknownEtherType.description':
    'EtherType 0x9000 dar adlandırma kümesinde yok: alan geçersiz işaretlenir, çerçeve yine gösterilir.',
  'protocol.ethernet.ethernetII.example.fcsOpportunisticMatch.name': 'Fırsatçı FCS eşleşmesi',
  'protocol.ethernet.ethernetII.example.fcsOpportunisticMatch.description':
    'Son 4 bayt bağımsız hesaplanan CRC-32 ile uyuşuyor — yalnız bilgi notu, PASS/FAIL iddiası değil.',

  'protocol.ethernet.ieee8023.documentation.summary':
    'MAC çiftinden sonraki 2 baytlık alan IEEE 802.3’te Length olarak yorumlanır (Ethernet II’nin EtherType yorumunun tersi). 1501-1535 aralığı ne EtherType ne Length’tir — uyarı basılır, çözüm durmaz. LLC/SNAP payload’ı bu sayfada çözülmez, ham kalır.',
  'protocol.ethernet.ieee8023.example.snapLengthFrame.name': 'Length yorumu (spec örneği: 0x002E)',
  'protocol.ethernet.ieee8023.example.snapLengthFrame.description':
    '0x002E → IEEE 802.3 Payload Length = 46 bayt.',
  'protocol.ethernet.ieee8023.example.undefinedRange.name': 'Tanımsız aralık (1520)',
  'protocol.ethernet.ieee8023.example.undefinedRange.description':
    '1501-1535 aralığı ne EtherType ne Length’tir: uyarı basılır, hata değil.',

  'protocol.ethernet.vlan8021q.documentation.summary':
    'VLAN 802.1Q tag’i (TPID 0x8100 + TCI) MAC çiftinden sonra araya girer: PCP (3 bit öncelik), DEI (1 bit) ve VLAN ID (12 bit) ayrı alanlar olarak çözülür, iç EtherType 4 bayt kaydırmayla okunur. Çift/üçlü tag (stacking) desteklenir, 3’ten fazlası uyarıyla durdurulur.',
  'protocol.ethernet.vlan8021q.example.singleTag.name': 'Tek VLAN tag (spec örneği: PCP5/VID100)',
  'protocol.ethernet.vlan8021q.example.singleTag.description':
    'PCP 5, DEI 0, VLAN ID 100; iç EtherType 0x0800 IPv4 adlandırılır.',
  'protocol.ethernet.vlan8021q.example.doubleTagStacked.name': 'Çift VLAN tag (stacking)',
  'protocol.ethernet.vlan8021q.example.doubleTagStacked.description':
    'Tag#1 VID100 / Tag#2 VID20 — spec’in stacking örneğiyle aynı değerler.',
  'protocol.ethernet.vlan8021q.example.truncatedTci.name': 'Eksik TCI (hata yolu)',
  'protocol.ethernet.vlan8021q.example.truncatedTci.description':
    'TPID var ama TCI’ın yalnız ilk baytı var — truncated-frame basar, MAC alanları yine görünür.',

  // --- IPv4 ---
  'protocol.ipv4.error.frameTooShort': 'Çerçeve en az 20 baytlık asgari IPv4 başlığı kadar uzun olmalı.',
  'protocol.ipv4.error.frameTooLong': 'Çerçeve izin verilen azami uzunluğu aşıyor.',
  'protocol.ipv4.error.aborted': 'Çözümleme iptal edildi.',
  'protocol.ipv4.error.ihlTooSmall': 'IHL 5’ten (20 bayt) küçük — yapısal olarak imkânsız bir başlık uzunluğu.',
  'protocol.ipv4.error.totalLengthTooSmall': 'Total Length, IHL·4 ile bildirilen başlık uzunluğundan küçük.',
  'protocol.ipv4.error.headerChecksumMismatch': 'Header Checksum hesaplanan değerle uyuşmuyor.',
  'protocol.ipv4.warning.unexpectedVersion': 'Version alanı 4 değil — çözüm yine de sürer.',
  'protocol.ipv4.warning.protocolHigherLayer':
    'Protocol üst katman protokolünü adlandırır; payload bu protokolün kendi sayfasında çözülür (motorlar zincir kurmaz).',
  'protocol.ipv4.warning.unknownProtocol':
    'Protocol değeri dar adlandırma kümesinde (ICMP/TCP/UDP) yok; payload ham kalır.',
  'protocol.ipv4.warning.checksumVerificationSkipped':
    'Başlık sınırı (IHL geçersiz ya da tamponda eksik) bilinmediği için checksum doğrulaması atlandı.',

  'protocol.ipv4.documentation.summary':
    'IPv4 başlığı: Version/IHL, DSCP/ECN, Total Length, Identification/Flags/Fragment Offset (alan olarak, reassembly YOK), TTL, Protocol (ICMP/TCP/UDP dar kümesi adlandırılır, payload çözülmez), Header Checksum (pseudo-header GEREKTİRMEZ, PASS/FAIL TAM DOĞRULANIR), Source/Destination Address ve varsa Options alan alan çözülür.',
  'protocol.ipv4.example.classicTcpHeader.name': 'Klasik başlık (ders kitabı örneği)',
  'protocol.ipv4.example.classicTcpHeader.description':
    'Protocol=TCP, checksum 0xB1E6 bağımsız hesapla doğrulandı (internetChecksum.test.ts aynı fixture).',
  'protocol.ipv4.example.udpCarrying.name': 'UDP taşıyan başlık',
  'protocol.ipv4.example.udpCarrying.description':
    'Protocol=17 (UDP) → üst katman uyarısı basar, checksum bağımsız hesaplandı.',
  'protocol.ipv4.example.headerChecksumFail.name': 'Bozuk header checksum (hata yolu)',
  'protocol.ipv4.example.headerChecksumFail.description':
    'Checksum bilerek 0x0000 yazıldı (gerçek değer 0x66D7) → checksum-mismatch.',
  'protocol.ipv4.example.unknownProtocol.name': 'Tanınmayan Protocol',
  'protocol.ipv4.example.unknownProtocol.description':
    'Protocol=253 dar kümede yok: alan geçersiz işaretlenir, çerçeve yine gösterilir.',
  'protocol.ipv4.example.ihlTooSmall.name': 'IHL yapısal olarak geçersiz (hata yolu)',
  'protocol.ipv4.example.ihlTooSmall.description':
    'IHL=4 (16 bayt), minimum 5 (20 bayt) altında — value-out-of-range; Options/Payload/checksum doğrulaması atlanır.',
  'protocol.ipv4.example.totalLengthTooSmall.name': 'Total Length çok küçük (hata yolu)',
  'protocol.ipv4.example.totalLengthTooSmall.description':
    'IHL geçerli (20 bayt) ama Total Length=16 < 20 — length-mismatch, checksum yine PASS olur.',

  // --- IPv6 ---
  'protocol.ipv6.error.frameTooShort': 'Çerçeve en az sabit 40 baytlık IPv6 taban başlığı kadar uzun olmalı.',
  'protocol.ipv6.error.frameTooLong': 'Çerçeve izin verilen azami uzunluğu aşıyor.',
  'protocol.ipv6.error.aborted': 'Çözümleme iptal edildi.',
  'protocol.ipv6.error.extensionHeaderTruncated':
    'Bir uzantı başlığının bildirdiği uzunluk için tamponda yeterli bayt yok.',
  'protocol.ipv6.warning.unexpectedVersion': 'Version alanı 6 değil — çözüm yine de sürer.',
  'protocol.ipv6.warning.nextHeaderHigherLayer':
    'Next Header üst katman protokolünü adlandırır; payload bu protokolün kendi sayfasında çözülür (motorlar zincir kurmaz).',
  'protocol.ipv6.warning.unknownNextHeader':
    'Next Header değeri bilinen uzantı başlığı ya da üst katman kümesinde yok; zincir burada durur (sonsuz döngü koruması).',
  'protocol.ipv6.warning.tooManyExtensionHeaders':
    '8’den fazla iç içe uzantı başlığı desteklenmiyor; kalan baytlar ham payload olarak gösterildi.',

  'protocol.ipv6.documentation.summary':
    'IPv6 taban başlığı sabit 40 bayttır: Version/Traffic Class/Flow Label, Payload Length, Next Header (bilinen uzantı başlıkları — Hop-by-Hop/Routing/Fragment/Destination Options — zincir olarak yürünür, üst katman TCP/UDP/ICMPv6 adlandırılır, bilinmeyen değerde zincir durur), Hop Limit, Source/Destination Address (128-bit). Checksum alanı YOK — "N/A" bilgi alanı gösterilir.',
  'protocol.ipv6.example.tcpBasic.name': 'Uzantı başlıksız, doğrudan TCP',
  'protocol.ipv6.example.tcpBasic.description':
    'Next Header=6 (TCP) → hiç uzantı başlığı yok, doğrudan üst katman uyarısı.',
  'protocol.ipv6.example.hopByHopThenUdp.name': 'Hop-by-Hop → UDP zinciri',
  'protocol.ipv6.example.hopByHopThenUdp.description':
    'Next Header=0 (Hop-by-Hop) atlanır, uzantı başlığının kendi Next Header’ı 17 (UDP) adlandırılır.',
  'protocol.ipv6.example.unknownNextHeader.name': 'Tanınmayan Next Header',
  'protocol.ipv6.example.unknownNextHeader.description':
    'Next Header=253 dar kümede yok: zincir hiç başlamaz, HATA değil UYARI.',
  'protocol.ipv6.example.truncatedExtensionHeader.name': 'Eksik uzantı başlığı (hata yolu)',
  'protocol.ipv6.example.truncatedExtensionHeader.description':
    'Hop-by-Hop uzantı başlığı 48 bayt bildiriyor ama tamponda yalnız 2 bayt var — truncated-frame basar.',

  // --- UDP ---
  'protocol.udp.error.frameTooShort': 'Çerçeve en az 8 baytlık sabit UDP başlığı kadar uzun olmalı.',
  'protocol.udp.error.frameTooLong': 'Çerçeve izin verilen azami uzunluğu aşıyor.',
  'protocol.udp.error.aborted': 'Çözümleme iptal edildi.',
  'protocol.udp.error.lengthTooSmall': 'Length 8’den (başlığın kendisi) küçük — yapısal olarak imkânsız.',
  'protocol.udp.error.declaredLengthExceedsBuffer':
    'Length alanının bildirdiği toplam uzunluk için tamponda yeterli bayt yok.',
  'protocol.udp.warning.checksumNeedsPseudoHeader':
    'Checksum, IP başlığından gelen pseudo-header ister; tek segmentlik girdide bu bilgi yok — doğrulanamaz, ham gösterilir.',
  'protocol.udp.warning.checksumZeroMeansDisabledOverIpv4':
    'Bu alan 0x0000 ise IPv4 taşıyıcısında "checksum kullanılmıyor" anlamına gelir (IPv6’da checksum zorunludur).',
  'protocol.udp.warning.trailingBytes':
    'Tampon Length alanının bildirdiğinden uzun; fazlası ayrı bir alanda gösterildi (sonraki datagramın parçası olabilir).',

  'protocol.udp.documentation.summary':
    'UDP başlığı 8 bayttır: Source/Destination Port, Length (kendisi dahil toplam uzunluk, payload = length−8) ve Checksum. Checksum pseudo-header gerektirdiği için tek segmentten DOĞRULANAMAZ — ham gösterilir + uyarı, mismatch hiç basılmaz; IPv4 taşıyıcısında 0x0000 "kullanılmıyor" anlamına gelir.',
  'protocol.udp.example.dnsQuery.name': 'DNS benzeri datagram',
  'protocol.udp.example.dnsQuery.description':
    'Source Port=53, checksum ham gösterilir (pseudo-header yok).',
  'protocol.udp.example.checksumDisabledIpv4.name': 'Checksum 0x0000 (IPv4 özel durumu)',
  'protocol.udp.example.checksumDisabledIpv4.description':
    'Checksum=0x0000 → yalnız IPv4 taşıyıcısında geçerli olan "kullanılmıyor" bilgi notu.',
  'protocol.udp.example.lengthTooSmall.name': 'Length çok küçük (hata yolu)',
  'protocol.udp.example.lengthTooSmall.description': 'Length=4 < 8 (başlığın kendisinden küçük) — value-out-of-range.',
  'protocol.udp.example.trailingBytes.name': 'Fazladan bayt (trailing data)',
  'protocol.udp.example.trailingBytes.description':
    'Length=10 bildiriyor ama tamponda 4 bayt fazlası var — ayrı alanda gösterilir, hata değil uyarı.',

  // --- TCP ---
  'protocol.tcp.error.frameTooShort': 'Çerçeve en az 20 baytlık asgari TCP başlığı kadar uzun olmalı.',
  'protocol.tcp.error.frameTooLong': 'Çerçeve izin verilen azami uzunluğu aşıyor.',
  'protocol.tcp.error.aborted': 'Çözümleme iptal edildi.',
  'protocol.tcp.error.dataOffsetTooSmall':
    'Data Offset 5’ten (20 bayt) küçük — yapısal olarak imkânsız bir başlık uzunluğu.',
  'protocol.tcp.error.declaredHeaderExceedsBuffer':
    'Data Offset’in bildirdiği başlık (options dahil) için tamponda yeterli bayt yok.',
  'protocol.tcp.warning.checksumNeedsPseudoHeader':
    'Checksum, IP başlığından gelen pseudo-header ister; tek segmentlik girdide bu bilgi yok — doğrulanamaz, ham gösterilir.',

  'protocol.tcp.documentation.summary':
    'TCP başlığı en az 20 bayttır: Source/Destination Port, Sequence/Acknowledgment Number (32-bit, ilişki kurulmaz), Data Offset/Reserved, 8 bayrak (CWR/ECE/URG/ACK/PSH/RST/SYN/FIN), Window Size, Checksum (pseudo-header gerektirdiği için doğrulanamaz, ham gösterilir), Urgent Pointer ve varsa Options (ham). TCP paket değil BYTE STREAM verir — bu motor tek segmenti çözer, akış birleştirme yapmaz.',
  'protocol.tcp.example.synBasic.name': 'SYN (bağlantı açılışı)',
  'protocol.tcp.example.synBasic.description': 'Data Offset=5 (options yok), yalnız SYN bayrağı set.',
  'protocol.tcp.example.pshAckWithOptions.name': 'PSH+ACK, options’lı',
  'protocol.tcp.example.pshAckWithOptions.description':
    'Data Offset=6 (24 bayt: 20 + 4 bayt options), PSH ve ACK bayrakları set.',
  'protocol.tcp.example.dataOffsetTooSmall.name': 'Data Offset yapısal olarak geçersiz (hata yolu)',
  'protocol.tcp.example.dataOffsetTooSmall.description':
    'Data Offset=4 (16 bayt), minimum 5 (20 bayt) altında — value-out-of-range; Options/Payload üretilmez.',
  'protocol.tcp.example.truncatedOptions.name': 'Eksik options (hata yolu)',
  'protocol.tcp.example.truncatedOptions.description':
    'Data Offset=8 (32 bayt bildiriyor) ama tamponda yalnız 24 bayt var — truncated-frame basar.',

  // --- MQTT ---
  'protocol.mqtt.error.frameTooShort': 'Çerçeve en az Fixed Header baytı ve Remaining Length’in tek baytlık hâli kadar uzun olmalı.',
  'protocol.mqtt.error.frameTooLong': 'Çerçeve izin verilen azami uzunluğu aşıyor.',
  'protocol.mqtt.error.aborted': 'Çözümleme iptal edildi.',
  'protocol.mqtt.error.reservedPacketType': 'Paket tipi 0 OASIS’in tanımladığı 15 tipten hiçbiri değil — rezerve değer.',
  'protocol.mqtt.error.invalidQos': 'PUBLISH QoS biti 0b11 (3) — OASIS’in rezerve bıraktığı, geçersiz bir değer.',
  'protocol.mqtt.error.remainingLengthMalformed':
    'Remaining Length dört bayt boyunca devam bitini hiç bırakmıyor — Variable Byte Integer kodlaması en çok dört bayt olabilir (OASIS §1.5.5).',
  'protocol.mqtt.error.remainingLengthTruncated': 'Remaining Length tamamlanmadan veri bitti — daha fazla bayt gerekiyor.',
  'protocol.mqtt.error.bodyTruncated': 'Remaining Length’in bildirdiği gövde tamponda eksik.',
  'protocol.mqtt.error.connectFieldTruncated': 'CONNECT’in bir alanı tamponda eksik kaldı.',
  'protocol.mqtt.error.connectPropertiesTruncated':
    'Protocol Level=5 için Properties alanı zorunlu ama bildirilen uzunluk tamponda eksik.',
  'protocol.mqtt.error.publishFieldTruncated': 'PUBLISH’in bir alanı tamponda eksik kaldı.',
  'protocol.mqtt.error.packetIdentifierTruncated': 'Packet Identifier için tamponda iki bayt yok.',

  'protocol.mqtt.warning.fixedFlagsViolation':
    'Bu paket tipinin OASIS’in verdiği sabit flags değeri var; gelen bayt bunu ihlal ediyor. Çerçeve yine çözülür.',
  'protocol.mqtt.warning.unknownProtocolLevel':
    'Protocol Level ne 4 (v3.1.1) ne 5 (v5) — sürüm bilinmiyor, Properties denenmedi.',
  'protocol.mqtt.warning.unexpectedProtocolName': 'Protocol Name "MQTT" değil — beklenmeyen bir değer.',
  'protocol.mqtt.warning.connectFlagsReservedBit': 'Connect Flags’ın rezerve biti (bit 0) sıfır olmalı, set geldi.',
  'protocol.mqtt.warning.unknownPropertyId':
    'Tanınmayan bir Property Identifier görüldü; bu id’den itibaren kalan blok tipinin bilinmediği için ham gösterilir.',
  'protocol.mqtt.warning.propertyTruncated': 'Bilinen bir property’nin değeri Properties Length sınırına sığmıyor — kalan blok ham gösterilir.',
  'protocol.mqtt.warning.propertiesVersionAssumed':
    'Bu paket tipi tek başına MQTT sürümünü bildirmez (önceki CONNECT hatırlanmaz); bu alan v5 Properties TLV formatı VARSAYILARAK çözüldü, doğrulanamadı.',
  'protocol.mqtt.warning.trailingBytes': 'Remaining Length’in bildirdiğinden fazla bayt geldi — ayrı alanda gösterilir.',

  'protocol.mqtt.summary.frame': 'MQTT çerçevesi',

  'protocol.mqtt.documentation.summary':
    'MQTT Fixed Header (Packet Type + flags + Variable Byte Integer Remaining Length) her paket tipinde aynıdır. CONNECT ve PUBLISH tam çözülür: CONNECT’te Protocol Level (4=v3.1.1, 5=v5) okunup adlandırılır, Level=5 ise v5 Properties TLV’si (OASIS’in dar id tablosuyla) zorunlu çözülür. PUBLISH’te Topic Name, QoS>0’da Packet Identifier ve varsa (sürümü doğrulanamayan bir varsayımla) Properties çözülür, gerisi Payload’dır. Diğer 13 tipte yalnız Packet Identifier (varsa) adlandırılır, kalan gövde ham gösterilir. Girdi TEK bir MQTT Control Packet’tir — TCP akışından birleştirme yapılmaz.',
  'protocol.mqtt.example.connectV311.name': 'CONNECT — MQTT 3.1.1',
  'protocol.mqtt.example.connectV311.description':
    'Protocol Level=4, Clean Session=1, Keep Alive=60, Client Identifier "sensor-01" — will/user/password yok.',
  'protocol.mqtt.example.connectV5Properties.name': 'CONNECT — MQTT 5.0, Properties’li',
  'protocol.mqtt.example.connectV5Properties.description':
    'Protocol Level=5, Properties: Session Expiry Interval=3600 + Receive Maximum=20, Client Identifier "sensor-02".',
  'protocol.mqtt.example.publishQos0.name': 'PUBLISH — QoS 0',
  'protocol.mqtt.example.publishQos0.description': 'Packet Identifier yok, Topic "sensors/temp", Payload "23.5".',
  'protocol.mqtt.example.publishQos1.name': 'PUBLISH — QoS 1',
  'protocol.mqtt.example.publishQos1.description':
    'QoS 1 + RETAIN, Packet Identifier=0x1234, Topic "cmd/set", Payload "ON".',
  'protocol.mqtt.example.reservedPacketType.name': 'Rezerve paket tipi (hata yolu)',
  'protocol.mqtt.example.reservedPacketType.description':
    'Üst nibble 0x0 — OASIS’in 15 tipinden hiçbiri değil; Fixed Header yine de gösterilir.',
  'protocol.mqtt.example.remainingLengthMalformed.name': 'Malformed Variable Byte Integer (hata yolu)',
  'protocol.mqtt.example.remainingLengthMalformed.description':
    'Remaining Length dört bayt boyunca (0xFF×4) devam bitini hiç bırakmıyor — OASIS’in en-çok-dört-bayt kuralı ihlali.',
  'protocol.mqtt.example.subscribeFixedFlagsViolation.name': 'SUBSCRIBE — sabit flags ihlali (uyarı yolu)',
  'protocol.mqtt.example.subscribeFixedFlagsViolation.description':
    'SUBSCRIBE’ın flags nibble’ı 0b0010 olmalı, burada 0b0000 geldi — uyarı basılır, çerçeve yine çözülür.',

  // --- CoAP ---
  'protocol.coap.error.headerTruncated': 'Çerçeve 4 baytlık sabit başlık kadar bile uzun değil.',
  'protocol.coap.error.frameTooLong': 'Çerçeve izin verilen azami uzunluğu aşıyor.',
  'protocol.coap.error.aborted': 'Çözümleme iptal edildi.',
  'protocol.coap.error.tokenLengthReserved':
    'Token Length 9-15 aralığında — RFC 7252’nin rezerve bıraktığı, geçersiz bir değer ("message format error"). Token/Options/Payload çözülmedi.',
  'protocol.coap.error.tokenTruncated': 'Token Length’in bildirdiği bayt sayısı tamponda eksik.',
  'protocol.coap.error.optionTruncated': 'Bir option’ın delta/length uzantı baytı ya da değeri tamponda eksik.',
  'protocol.coap.error.optionNibbleReserved':
    'Option baytında delta ya da length nibble’ı tek başına 15 — bu yalnız tam 0xFF payload marker’ında geçerlidir, RFC 7252’nin "message format error"udur.',
  'protocol.coap.error.payloadMarkerEmpty':
    '0xFF payload marker’dan sonra hiç bayt gelmedi — RFC 7252 marker varsa payload’ı zorunlu kılar.',

  'protocol.coap.warning.versionUnexpected':
    'Version alanı 1 değil — RFC 7252 gelecekteki sürümlere karşı sessiz ret istemiyor, çözümleme yine de devam eder.',
  'protocol.coap.warning.unknownOption':
    'Option numarası RFC 7252’nin temel option tablosunda yok (Observe/Block gibi sonraki RFC uzantıları da dahil) — ham gösterilir, isim uydurulmaz.',

  'protocol.coap.summary.frame': 'CoAP çerçevesi',

  'protocol.coap.documentation.summary':
    '4 baytlık sabit başlık (Version/Type/Token Length + Code + Message ID) bitCursor ile bit alanlarına bölünüp çözülür. Code hem ham bayt hem "class.detail" gösterimiyle (ör. 0x45 → "2.05") basılır. Token Length’in bildirdiği kadar Token ham gösterilir; 9-15 aralığı RFC 7252’nin rezerve bıraktığı bir "message format error"dur. Options listesi 0xFF payload marker’a ya da tampon sonuna kadar döner: her option’ın delta/length nibble’ı RFC 7252’nin extended-value kurallarıyla (13→+13, 14→+269) genişler, Option Number önceki delta’ların kümülatif toplamıdır. Yalnız RFC 7252’nin temel option tablosundaki on dört numara adlandırılır, gerisi ham + uyarı. Observe/Block gibi sonraki RFC uzantıları bilerek çözülmez.',
  'protocol.coap.example.getRequest.name': 'GET isteği — Uri-Path',
  'protocol.coap.example.getRequest.description':
    'CON, Token yok, Code=GET (0.01), Uri-Path="temp" — payload yok.',
  'protocol.coap.example.contentResponse.name': '2.05 Content yanıtı',
  'protocol.coap.example.contentResponse.description':
    'ACK, Token=0xABCD, Code=2.05 Content, Content-Format option’ı, 0xFF marker + Payload "23.5".',
  'protocol.coap.example.multipleUriPath.name': 'Birden fazla Uri-Path segmenti',
  'protocol.coap.example.multipleUriPath.description':
    'GET /sensors/temp — iki Uri-Path option’ı, ikincisi delta=0 ile aynı option numarasını (11) kümülatif korur.',
  'protocol.coap.example.unrecognizedOption.name': 'Tanınmayan option (uyarı yolu)',
  'protocol.coap.example.unrecognizedOption.description':
    'Observe (RFC 7641 uzantısı) — dar ad kümesinde yok, ham + uyarı basılır, çerçeve yine valid kalır.',
  'protocol.coap.example.tokenLengthReserved.name': 'Token Length rezerve (hata yolu)',
  'protocol.coap.example.tokenLengthReserved.description':
    'TKL=9 — RFC 7252’nin rezerve bıraktığı aralık, Token/Options hiç çözülmez.',
  'protocol.coap.example.payloadMarkerEmpty.name': '0xFF sonrası boş payload (hata yolu)',
  'protocol.coap.example.payloadMarkerEmpty.description':
    'Payload marker geldi ama ardından tek bayt bile yok — RFC 7252 ihlali.',
  'protocol.coap.example.optionNibbleReserved.name': 'Option nibble’ı marker dışı 15 (hata yolu)',
  'protocol.coap.example.optionNibbleReserved.description':
    'Option baytı 0xF0: delta nibble’ı 15 ama bayt tam 0xFF değil — "message format error".',

  // --- DNP3 ---
  'protocol.dnp3.error.frameTooShort': 'Çerçeve link başlığı (10 bayt) kadar uzun değil.',
  'protocol.dnp3.error.frameTooLong': 'Çerçeve izin verilen azami uzunluğu aşıyor.',
  'protocol.dnp3.error.aborted': 'Çözümleme iptal edildi.',
  'protocol.dnp3.error.startBytesInvalid':
    'Start baytları 0x05 0x64 değil — bu bir DNP3 link çerçevesi olmayabilir.',
  'protocol.dnp3.error.lengthTooSmall':
    'Length alanı asgari değerin (5) altında; Control+Destination+Source bile sığmaz.',
  'protocol.dnp3.error.headerCrcMismatch':
    'Header CRC tutmuyor: alınan ve hesaplanan değer farklı.',
  'protocol.dnp3.error.blockCrcMismatch':
    'Gövde bloğunun CRC’si tutmuyor: alınan ve hesaplanan değer farklı.',
  'protocol.dnp3.error.bodyTruncated':
    'Length’in vaat ettiği gövde bloğu için yeterli bayt yok.',
  'protocol.dnp3.error.applicationTruncated':
    'Application katmanı alanı için yeterli mantıksal bayt yok.',
  'protocol.dnp3.warning.unknownLinkFunctionCode':
    'Link function code, PRM’ye göre tanınan dar kümede yok.',
  'protocol.dnp3.warning.unknownApplicationFunctionCode':
    'Application function code dar ad kümesinde yok — ham gösteriliyor.',
  'protocol.dnp3.warning.multiSegmentSession':
    'FIR/FIN tek segmenti işaret etmiyor: bu, çok-segmentli bir application mesajının PARÇASI. Segmentler birleştirilmez (oturum/analyzer işi); kalan bayt ham gösterildi.',
  'protocol.dnp3.warning.unknownQualifier':
    'Qualifier’ın range specifier’ı tanınan dar kümede yok — range/count uzunluğu bilinemediği için bundan sonrası ham gösterildi.',
  'protocol.dnp3.warning.objectDataNeedsVariationDecode':
    'Object header çözüldü; header sonrası veri (point değerleri) ham gösteriliyor — variation’a göre veri düzeni sonraki faz işi (Karar 6).',
  'protocol.dnp3.warning.headerSpansBlockBoundary':
    'Alan, gövde bloklarının arasındaki CRC sınırını aşıyor; motor bu noktadan sonrasını ayırt etmeden ham gösterdi.',
  'protocol.dnp3.warning.trailingBytes':
    'Çerçeve, Length’in belirttiği içerikten sonra fazladan bayt taşıyor.',
  'protocol.dnp3.summary.linkOnly': 'Yalnız link katmanı çerçevesi (user data yok)',
  'protocol.dnp3.summary.multiSegment': 'Çok-segmentli application mesajının bir parçası',
  'protocol.dnp3.summary.application': 'DNP3 application katmanı çerçevesi',
  'protocol.dnp3.documentation.summary':
    'IEEE 1815 DNP3: link katmanı (start/length/control/destination/source, 16’şar baytlık bloklara ayrılmış CRC16_DNP), transport (FIR/FIN/SEQ — segment birleştirme yok) ve application katmanı (application control, function code, response’ta IIN, tek object header: Group/Variation/Qualifier/Range) çözülür. Object header sonrası veri (point değerleri) ham kalır: variation’a göre veri düzeni sonraki faz işidir (Karar 6). Alan adları opendnp3 dokümantasyonu ve Wireshark DNP3 dissector alan tablosuyla çapraz teyitlidir.',
  'protocol.dnp3.example.linkOnlyRequestLinkStatus.name': 'Link-only: Request Link Status',
  'protocol.dnp3.example.linkOnlyRequestLinkStatus.description':
    'Length=5, user data yok — yalnız link başlığı. Primary function 0x09 Request Link Status.',
  'protocol.dnp3.example.singleSegmentReadClass0.name': 'Tek segment: Read Class 0',
  'protocol.dnp3.example.singleSegmentReadClass0.description':
    'FIR=FIN=1 tek segment; application Read (0x01), Group 60 Var 1 Qualifier 0x06 (Class 0 poll, range/data yok).',
  'protocol.dnp3.example.responseWithIin.name': 'Response + IIN (Need Time)',
  'protocol.dnp3.example.responseWithIin.description':
    'Outstation→master Response (0x81); IIN1 Need Time biti set. Group 1 (Binary Input) Var 2, Qualifier 0x00, tek index; header sonrası 1 bayt ham object data.',
  'protocol.dnp3.example.multiSegmentFirstSegment.name': 'Çok-segment: ilk parça',
  'protocol.dnp3.example.multiSegmentFirstSegment.description':
    'Transport FIR=1, FIN=0 — çok-segmentli bir mesajın ilk parçası. Application katmanı birleştirilmeden ham "Segment Data" olarak gösterilir.',
  'protocol.dnp3.example.headerCrcMismatch.name': 'Header CRC hatası',
  'protocol.dnp3.example.headerCrcMismatch.description':
    'Link-only örnekle aynı header, CRC baytları kasten 00 00 — crc-mismatch hata yolu.',
  'protocol.dnp3.example.blockCrcMismatch.name': 'Gövde bloğu CRC hatası',
  'protocol.dnp3.example.blockCrcMismatch.description':
    'Tek segment örnekle aynı header (header CRC doğru), gövde bloğunun CRC’si kasten 00 00.',

  // --- IEC 60870-5-104 ---
  'protocol.iec104.error.frameTooShort': 'Çerçeve APCI (6 bayt) kadar uzun değil.',
  'protocol.iec104.error.frameTooLong': 'Çerçeve izin verilen azami uzunluğu aşıyor.',
  'protocol.iec104.error.aborted': 'Çözümleme iptal edildi.',
  'protocol.iec104.error.contentLengthTooSmall':
    'Length alanının vaat ettiği içerik 4 kontrol baytına bile sığmıyor.',
  'protocol.iec104.error.lengthMismatch':
    'Length’in vaat ettiği toplam çerçeve uzunluğu tampondaki bayt sayısını aşıyor.',
  'protocol.iec104.error.startByteInvalid':
    'Start baytı 0x68 değil — bu bir IEC 60870-5-104 APDU’su olmayabilir.',
  'protocol.iec104.error.asduTruncated': 'ASDU alanı için yeterli bayt yok.',
  'protocol.iec104.warning.oversizedLength':
    'Length, standardın öngördüğü 253 baytlık azami APDU içeriğini aşıyor.',
  'protocol.iec104.warning.unknownUFormatFunction':
    'U-format fonksiyon baytı tanınan altı değerden (STARTDT/STOPDT/TESTFR act/con) biri değil.',
  'protocol.iec104.warning.unknownTypeId':
    'Type Identification dar ad kümesinde yok — ham gösteriliyor.',
  'protocol.iec104.warning.unknownCauseOfTransmission':
    'Cause of Transmission dar ad kümesinde yok — ham gösteriliyor.',
  'protocol.iec104.warning.informationElementNeedsTypeDecode':
    'Information Object Address çözüldü; eleman verisi ham gösteriliyor — tip başına eleman düzeni sonraki faz işi.',
  'protocol.iec104.warning.multipleObjectsUnknownWidth':
    'ASDU birden çok Information Object taşıyor ama bu tip için eleman genişliği teyitli değil — nesneler tek tek ayrıştırılamadı, tamamı ham blok olarak gösterildi (yanlış hizalanmış alan basmaktansa).',
  'protocol.iec104.summary.uFormat': 'U-format kontrol çerçevesi',
  'protocol.iec104.summary.sFormat': 'S-format onay çerçevesi',
  'protocol.iec104.summary.iFormat': 'I-format bilgi aktarım çerçevesi',
  'protocol.iec104.documentation.summary':
    'IEC 60870-5-104: APCI (start 0x68, length, 4 kontrol baytından I/S/U format ayrımı, I-format’ta 15-bit send/receive sequence numaraları) ve I-format’ta ardından gelen ASDU başlığı (Type Identification, Variable Structure Qualifier/SQ, Cause of Transmission, Common Address, Information Object Address + eleman) çözülür. Yalnız M_SP_NA_1’in SIQ elemanı bit bit çözülür (SPI + BL/SB/NT/IV kalite bitleri); diğer tüm elemanlar ham kalır. Sequence bekleme/oturum takibi (hangi numaranın sırada olduğu) analyzer işidir, bu motora girmez. Alan adları Wireshark IEC-104 dissector’ının alan tablosu, iec104-cheat-sheet ve lib60870 dokümantasyonuyla çapraz teyitlidir.',
  'protocol.iec104.example.uFormatStartdtAct.name': 'U-format: STARTDT act',
  'protocol.iec104.example.uFormatStartdtAct.description':
    'En kısa çerçeve — yalnız APCI, ASDU yok. Kontrol baytı 0x07: STARTDT act.',
  'protocol.iec104.example.sFormatAck.name': 'S-format: onay N(R)=3',
  'protocol.iec104.example.sFormatAck.description':
    'Yalnız Receive Sequence Number taşır (N(R)=3) — I-format çerçevelerin numaralı onayı.',
  'protocol.iec104.example.iFormatSingleObjectSpontaneous.name':
    'I-format: tek obje, kendiliğinden (M_SP_NA_1)',
  'protocol.iec104.example.iFormatSingleObjectSpontaneous.description':
    'N(S)=0, N(R)=0; ASDU M_SP_NA_1, SQ=0/count=1, COT=Spontaneous, Common Address=1, IOA=1, SIQ=SPI açık ve kalite bitleri temiz.',
  'protocol.iec104.example.iFormatSequentialObjects.name': 'I-format: SQ=1 ardışık üç obje',
  'protocol.iec104.example.iFormatSequentialObjects.description':
    'N(S)=1, N(R)=0; ASDU M_SP_NA_1, SQ=1/count=3, COT=Periodic/cyclic; tek IOA=1’den başlayarak üç ardışık SIQ elemanı (açık/kapalı/açık+IV).',
  'protocol.iec104.example.iFormatInterrogationCommand.name': 'I-format: genel sorgulama komutu (C_IC_NA_1)',
  'protocol.iec104.example.iFormatInterrogationCommand.description':
    'N(S)=2, N(R)=1; ASDU C_IC_NA_1, COT=Activation, IOA=0 (genel sorgulama kuralı); QOI elemanı ham gösterilir.',
  'protocol.iec104.example.iFormatUnknownTypeId.name': 'I-format: tanınmayan Type ID',
  'protocol.iec104.example.iFormatUnknownTypeId.description':
    'Type ID 200 dar ad kümesinde yok — uyarı yolu, çerçeve yine de geçerli sayılır (yalnız uyarı, hata değil).',
  'protocol.iec104.example.startByteInvalid.name': 'Start baytı hatası',
  'protocol.iec104.example.startByteInvalid.description':
    'STARTDT act örneğiyle aynı gövde, start baytı kasten 0x67 — start-delimiter-not-found hata yolu; geri kalan APCI yine de çözülür.',
  'protocol.iec104.example.lengthMismatch.name': 'Length uyuşmazlığı',
  'protocol.iec104.example.lengthMismatch.description':
    'Length=10 → 12 baytlık bir çerçeve vaat eder ama tampon yalnız 6 bayt — length-mismatch ile ParseFailure (modbusTcp emsali, kaydedilebilir).',

  // --- M-Bus ---
  'protocol.mbus.error.emptyFrame': 'Tampon boş — hiçbir çerçeve sınıfı okunamaz.',
  'protocol.mbus.error.unrecognizedFrameClass':
    'İlk bayt dört çerçeve sınıfından (0xE5/0x10/0x68) hiçbirine uymuyor.',
  'protocol.mbus.error.frameTooLong': 'Çerçeve izin verilen azami uzunluğu aşıyor.',
  'protocol.mbus.error.aborted': 'Çözümleme iptal edildi.',
  'protocol.mbus.error.shortFrameTruncated': 'Short Frame sabit 5 bayt uzunluğa ulaşmıyor.',
  'protocol.mbus.error.longFrameHeaderTruncated':
    'Control/Long Frame başlığı (Start+L+L+Start, 4 bayt) için yeterli bayt yok.',
  'protocol.mbus.error.lengthCopiesMismatch':
    'L alanının iki kopyası birbirini tutmuyor — ilk kopya baz alınarak devam edildi.',
  'protocol.mbus.error.secondStartInvalid': 'İkinci start baytı 0x68 değil.',
  'protocol.mbus.error.stopByteInvalid': 'Stop baytı 0x16 değil.',
  'protocol.mbus.error.checksumMismatch':
    'Checksum (8-bit aritmetik toplam, mod 256) tutmuyor.',
  'protocol.mbus.error.bodyTruncated':
    'L alanının vaat ettiği toplam çerçeve uzunluğu tampondaki bayt sayısını aşıyor.',
  'protocol.mbus.error.fixedHeaderTruncated':
    'Fixed Data Header (12 bayt: Identification/Manufacturer/Version/Medium/Access No/Status/Signature) için yeterli bayt yok.',
  'protocol.mbus.error.recordTruncated': 'Veri kaydı (DIF/DIFE/VIF/VIFE/DATA) yarıda kesildi.',
  'protocol.mbus.warning.unknownCFunction':
    'C Field fonksiyon kodu dar ad kümesinde yok (SND_NKE/SND_UD/REQ_UD2/RSP_UD dışında) — ham gösteriliyor.',
  'protocol.mbus.warning.unknownCi': 'CI Field dar ad kümesinde yok — ham gösteriliyor.',
  'protocol.mbus.warning.ciDataNotDecoded':
    'CI Field adlandırıldı ama user data bu dalgada çözülmüyor (yalnız CI=0x72 yolu çözülür) — ham gösteriliyor.',
  'protocol.mbus.warning.trailingBytes': 'Çerçeve sınırından sonra fazladan bayt var.',
  'protocol.mbus.warning.invalidBcd':
    'BCD nibble’ları 0-9 aralığının dışında — alan çözülemedi, ham bayt gösteriliyor.',
  'protocol.mbus.warning.manufacturerSpecificBlock':
    'DIF=0x0F/0x1F: kalan veri üretici-özel — bu dalgada çözülmüyor, ham gösteriliyor.',
  'protocol.mbus.warning.specialFunctionDif':
    'DIF Special Functions kodu (alt nibble 0xF) tanınan alt kümede yok — kalan veri ham gösteriliyor.',
  'protocol.mbus.warning.unsupportedVifString':
    'VIF=0x7C: gerçek birim adı ardından gelen ASCII string’te — bu dalgada çözülmüyor, kalan veri ham gösteriliyor.',
  'protocol.mbus.warning.unknownLvarLength':
    'LVAR uzunluk baytı ayrılmış (0xFB-0xFF) aralıkta — gerçek uzunluk bilinemiyor, kalan veri ham gösteriliyor.',
  'protocol.mbus.warning.vifeNotDecoded': 'VIFE uzantısı ham gösteriliyor — bu dalgada çözülmüyor.',
  'protocol.mbus.warning.unknownMedium': 'Medium dar ad kümesinde yok — ham gösteriliyor.',
  'protocol.mbus.warning.unnamedVif': 'VIF dar ad kümesinde yok — veri yine çözülür, birim adı verilmez.',
  'protocol.mbus.summary.singleCharacter': 'Tek karakterlik onay (ACK)',
  'protocol.mbus.summary.shortFrame': 'Short Frame — C/A alanları çözüldü, user data yok',
  'protocol.mbus.summary.controlFrame': 'Control Frame — C/A/CI alanları çözüldü, user data yok',
  'protocol.mbus.summary.longFrame': 'Long Frame — C/A/CI ve user data çözüldü',
  'protocol.mbus.documentation.summary':
    'M-Bus (EN 13757, kablolu): dört çerçeve sınıfı (Single Character/Short/Control/Long Frame), sum8Checksum ile checksum doğrulaması, C Field (DIR/FCB-ACD/FCV-DFC bit bit + SND_NKE/SND_UD/REQ_UD2/RSP_UD dar ad kümesi), A Field (0/253/254/255 özel adresler) ve CI Field (dar ad kümesi) çözülür. CI=0x72 (Variable Data Respond, Mode 1) yolunda Fixed Data Header (identification/manufacturer/medium…) ve DIF/DIFE/VIF/VIFE/DATA kayıt zinciri (enerji/hacim/kütle/güç/sıcaklık dar VIF kümesiyle ölçeklenmiş mühendislik değerine çevrilir) tam çözülür; diğer CI yolları (Fixed Data Structure dahil) ham gösterilir. Alan adları libmbus (rSCADA) dokümantasyonu ve m-bus.com "The M-Bus: A Documentation" ile çapraz teyitlidir.',
  'protocol.mbus.example.singleCharacterAck.name': 'Single Character: ACK',
  'protocol.mbus.example.singleCharacterAck.description':
    'Tek baytlık onay çerçevesi (0xE5) — SND_NKE/SND_UD/REQ_UD2’nin başarılı alımının onayı.',
  'protocol.mbus.example.shortFrameReqUd2.name': 'Short Frame: REQ_UD2',
  'protocol.mbus.example.shortFrameReqUd2.description':
    'Master→slave veri isteği (Class 2). C=0x5B (calling, FCV=1, REQ_UD2), adres 1, checksum ve stop doğru.',
  'protocol.mbus.example.controlFrameSndNke.name': 'Control Frame: SND_NKE',
  'protocol.mbus.example.controlFrameSndNke.description':
    'Link durumunu sıfırlama (SND_NKE), user data yok (L=3). CI baytı yapısal olarak var ama bu senaryoda tanınmayan bir değer taşıyor — uyarı yolu.',
  'protocol.mbus.example.longFrameRspUdVariableData.name':
    'Long Frame: RSP_UD, değişken veri yapısı (3 kayıt)',
  'protocol.mbus.example.longFrameRspUdVariableData.description':
    'Kamstrup (KAM) üretici kodlu bir ısı sayacı yanıtı: Fixed Data Header + Energy (123456 Wh), Volume (12565 → 12,565 m³, m-bus.com’un kendi örneğiyle aynı DIF/VIF/veri baytları) ve Flow Temperature (235 → 23,5 °C) kayıtları.',
  'protocol.mbus.example.checksumMismatch.name': 'Checksum hatası',
  'protocol.mbus.example.checksumMismatch.description':
    'REQ_UD2 örneğiyle aynı gövde, checksum baytı kasten 0x00 — checksum-mismatch hata yolu.',
  'protocol.mbus.example.lengthCopiesMismatch.name': 'L kopyaları uyuşmazlığı',
  'protocol.mbus.example.lengthCopiesMismatch.description':
    'SND_NKE örneğiyle aynı gövde, ikinci L kopyası kasten farklı (0x03 → 0x04) — length-mismatch hata yolu, ilk kopya baz alınarak yine de çözülür.',
  'protocol.mbus.example.unrecognizedCi.name': 'Tanınmayan CI',
  'protocol.mbus.example.unrecognizedCi.description':
    'RSP_UD, CI=0x99 dar ad kümesinde yok — user data ham gösterilir, yalnız uyarı basılır (hata değil).',

  // --- EtherCAT ---
  'protocol.ethercat.error.frameTooShort':
    'Çerçeve, Ethernet başlığı (14 bayt) + EtherCAT başlığı (2 bayt) kadar uzun değil.',
  'protocol.ethercat.error.frameTooLong': 'Çerçeve izin verilen azami uzunluğu aşıyor.',
  'protocol.ethercat.error.aborted': 'Çözümleme iptal edildi.',
  'protocol.ethercat.error.etherTypeNotEtherCat':
    'EtherType 0x88A4 değil — bu çerçeve EtherCAT değildir; gövde çözülmedi, ham bırakıldı.',
  'protocol.ethercat.error.headerTruncated':
    'EtherType’tan sonra EtherCAT başlığının (2 bayt) tamamı gelmedi.',
  'protocol.ethercat.error.datagramRegionTruncated':
    'EtherCAT Length alanının vaat ettiği datagram bölgesi tampondaki bayt sayısını aşıyor.',
  'protocol.ethercat.error.datagramHeaderTruncated':
    'Datagram başlığı (10 bayt: Cmd/Idx/Address/Len/IRQ) için yeterli bayt yok.',
  'protocol.ethercat.error.datagramBodyTruncated':
    'Datagram Len alanının vaat ettiği veri + Working Counter (2 bayt) bölgeye sığmıyor.',
  'protocol.ethercat.warning.frameReservedBitSet':
    'EtherCAT başlığının reserved biti (bit 11) sıfır değil — uyumlu bir çerçevede sıfır olmalıdır.',
  'protocol.ethercat.warning.nonCommandType':
    'EtherCAT Type alanı 1 (komut/datagram) değil; gövde datagram zinciri olarak çözülmedi, ham gösteriliyor.',
  'protocol.ethercat.warning.unknownCommand':
    'Komut kodu çapraz teyitli kümede (NOP/APRD…FRMW, 0x00-0x0E) yok — adı verilmez ve adres alanı bölünmeden ham bırakılır.',
  'protocol.ethercat.warning.datagramReservedBitsSet':
    'Datagram uzunluk sözcüğünün reserved bitleri (bit 11-13) sıfır değil.',
  'protocol.ethercat.warning.processDataNeedsConfiguration':
    'Datagram verisinin anlamı slave konfigürasyonuna (PDO eşlemesi / ESC register haritası) bağlıdır; tek çerçeveden çıkarılamaz, ham gösteriliyor.',
  'protocol.ethercat.warning.workingCounterNotVerifiable':
    'Beklenen Working Counter değeri topolojiye bağlıdır (kaç slave datagramı işledi) ve tek çerçeveden hesaplanamaz — değer olduğu gibi gösterilir, doğru/yanlış iddiası basılmaz.',
  'protocol.ethercat.warning.declaredLengthMismatch':
    'EtherCAT Length alanı ile datagram zincirinin gerçekte tükettiği bayt sayısı uyuşmuyor.',
  'protocol.ethercat.warning.moreFlagWithoutRoom':
    'Son datagramın “More” biti 1 ama bölgede bir datagram daha için yer yok — zincir burada durduruldu.',
  'protocol.ethercat.warning.datagramLimitReached':
    'Datagram sayısı üst sınıra ulaştı; zincir yürüyüşü sonsuz döngüye karşı durduruldu.',
  'protocol.ethercat.warning.paddingNotZero':
    'Datagram bölgesinden sonraki baytlar sıfır değil — Ethernet dolgusu beklenirdi.',
  'protocol.ethercat.summary.commandFrame':
    '{datagramCount} datagram, ilk komut {firstCommand}',
  'protocol.ethercat.summary.nonCommandType': 'EtherCAT Type {type} — gövde ham',
  'protocol.ethercat.summary.notEtherCat': 'EtherCAT değil (EtherType {etherType})',
  'protocol.ethercat.documentation.summary':
    'EtherCAT (ETG.1000 / IEC 61158): girdi TAM bir Ethernet çerçevesidir — DST/SRC MAC, opsiyonel VLAN tag’leri ve EtherType 0x88A4 çözülür, ardından little-endian EtherCAT başlığı (11-bit Length, reserved, 4-bit Type) ve Type=1 ise datagram zinciri “More” bitiyle sonuna kadar yürünür. Her datagramda Cmd (NOP/APRD/APWR/APRW/FPRD/FPWR/FPRW/BRD/BWR/BRW/LRD/LWR/LRW/ARMW/FRMW), Idx, adresleme kipine göre bölünmüş adres (logical komutlarda tek 32-bit logical address, diğerlerinde ADP + ADO), 11-bit Len + Reserved/Circulating/More bitleri, IRQ ve veriden SONRA gelen Working Counter adlandırılır. Datagram verisi ham kalır: anlamı slave konfigürasyonuna bağlıdır. Alan düzenleri Wireshark’ın Beckhoff imzalı EtherCAT eklentisi, IgH EtherCAT Master ve SOEM ile çapraz teyitlidir; teyit edilemeyen kodlar (ör. 0xFF) adlandırılmaz.',
  'protocol.ethercat.example.lrwCyclicProcessData.name': 'LRW: döngüsel process data',
  'protocol.ethercat.example.lrwCyclicProcessData.description':
    'En yaygın çerçeve: tek LRW datagramı, logical address 0x00010000, 4 bayt process data, Working Counter 3. Çerçeve gerçek telde olduğu gibi 60 bayta sıfırla dolgulanmış — dolgu ayrı alan olarak gösterilir.',
  'protocol.ethercat.example.fprdConfiguredAddressRead.name': 'FPRD: configured address okuma',
  'protocol.ethercat.example.fprdConfiguredAddressRead.description':
    'Configured station address 0x03E9’daki slave’in 0x0130 register’ından 2 bayt okuma. Adres alanı ADP + ADO olarak İKİYE bölünür (logical komutlardan farkı burada görülür), Working Counter 1.',
  'protocol.ethercat.example.brdStartupScan.name': 'BRD: açılış taraması',
  'protocol.ethercat.example.brdStartupScan.description':
    'Broadcast okuma — açılışta kaç slave olduğunu saymanın yolu. Working Counter datagramı işleyen her slave için artar (burada 3), ama beklenen değeri topoloji bilgisi olmadan hesaplanamaz.',
  'protocol.ethercat.example.multiDatagramChain.name': 'Zincir: iki datagram (More=1)',
  'protocol.ethercat.example.multiDatagramChain.description':
    'Tek çerçevede iki datagram: ilkinin uzunluk sözcüğü 0x8002 (Len=2, More=1), ikincisi LWR ve More=0 ile zinciri kapatır. Zincir yürüyüşü ve iki ayrı Working Counter burada görülür.',
  'protocol.ethercat.example.unknownCommand.name': 'Teyit edilmemiş komut',
  'protocol.ethercat.example.unknownCommand.description':
    'Komut 0xFF üç kaynağın hepsinde birden geçmiyor — adlandırılmaz, adresin nasıl bölüneceği de bilinmediği için 4 bayt ham bırakılır (uydurma yasağı). Çerçeve yine de geçerlidir, yalnız uyarı basılır.',
  'protocol.ethercat.example.nonCommandType.name': 'Type ≠ 1 (Mailbox)',
  'protocol.ethercat.example.nonCommandType.description':
    'EtherCAT Type alanı 5 (Mailbox): gövde datagram zinciri değildir, bu motor çözmeye kalkmaz — ham gösterilir ve uyarı basılır.',
  'protocol.ethercat.example.etherTypeNotEtherCat.name': 'Yanlış EtherType',
  'protocol.ethercat.example.etherTypeNotEtherCat.description':
    'LRW örneğiyle aynı gövde, EtherType kasten 0x0800 (IPv4). MAC alanları yine çözülür ama gövdeye dokunulmaz — yanlış EtherType’ta datagram çözmek sessiz-yanlış çözümlemenin ta kendisi olurdu.',
  'protocol.ethercat.example.datagramTruncated.name': 'Kesik datagram bölgesi',
  'protocol.ethercat.example.datagramTruncated.description':
    'EtherCAT Length 16 baytlık bir bölge vaat ediyor ama telde yalnız 6 bayt var — truncated-frame hata yolu.',
  'protocol.ethercat.example.frameTooShort.name': 'Çok kısa çerçeve',
  'protocol.ethercat.example.frameTooShort.description':
    '10 bayt: Ethernet başlığı bile tamamlanmıyor — ParseFailure (kaydedilebilir, akış devam edebilir).',

  // --- IEC 61850 GOOSE ---
  'protocol.goose.error.frameTooShort':
    'Çerçeve, Ethernet başlığı (14 bayt) + GOOSE başlığı (8 bayt) kadar uzun değil.',
  'protocol.goose.error.frameTooLong': 'Çerçeve izin verilen azami uzunluğu aşıyor.',
  'protocol.goose.error.aborted': 'Çözümleme iptal edildi.',
  'protocol.goose.error.etherTypeNotGoose':
    'EtherType 0x88B8 değil — bu çerçeve GOOSE değildir; gövde çözülmedi, ham bırakıldı.',
  'protocol.goose.error.headerTruncated':
    'EtherType’tan sonra GOOSE başlığının (APPID + Length + Reserved 1 + Reserved 2, 8 bayt) tamamı gelmedi.',
  'protocol.goose.error.lengthBelowHeader':
    'Length alanı 8’den küçük — bu alan APPID’den itibaren sayar ve başlığın kendisini de kapsar, 8’in altına inemez.',
  'protocol.goose.error.apduTruncated':
    'Length alanının vaat ettiği APDU tampondaki bayt sayısını aşıyor; yürüyüş telde gerçekten olan baytlarla sınırlandı.',
  'protocol.goose.error.pduTagNotGoose':
    'APDU’nun ilk etiketi 0x61 (goosePdu) değil — gövde çözülmedi, ham bırakıldı.',
  'protocol.goose.error.berTruncated': 'BER değeri okunmadan arabellek (ya da üst TLV) bitti.',
  'protocol.goose.error.berLongFormTag':
    'Çok baytlı (long-form) BER etiketi: alt 5 bit 0x1F. Bu çözücü desteklemiyor ve sessizce 31 diye okumuyor — alan ham bırakıldı.',
  'protocol.goose.error.berIndefiniteLength':
    'Belirsiz uzunluk (0x80) BER’de vardır ama DER’de ve GOOSE’ta geçersizdir — değer çözülmedi.',
  'protocol.goose.error.berReservedLengthOctet':
    'Uzunluk okteti 0xFF: X.690’da ayrılmıştır, uzunluk değildir.',
  'protocol.goose.error.berLengthOctetsUnsupported':
    'Uzun form uzunluk 4 oktetten fazlasını kullanıyor; bu çözücü kabul etmiyor.',
  'protocol.goose.error.berValueOverflow':
    'BER değeri kendi sınırının (üst TLV ya da çerçeve sonu) dışına taşıyor.',
  'protocol.goose.error.berUnexpectedValueLength':
    'BER değerinin uzunluğu tipiyle bağdaşmıyor (ör. tek oktet olması gereken BOOLEAN).',
  'protocol.goose.warning.destinationNotGooseRange':
    'Hedef MAC, IEC/TC57’nin GOOSE çok-alıcılı aralığında (01:0C:CD:01:xx:xx) değil. Bu bir hata değildir — bilgi notu.',
  'protocol.goose.warning.reservedNotZero':
    'Reserved alanı sıfır değil. Bit 15 tek bir kamu kaynağında “Simulated” olarak geçiyor ama çift teyit edilemedi; alan adlandırılmadan ham gösteriliyor. Simülasyon durumu için çift teyitli `simulation` alanına bakın.',
  'protocol.goose.warning.gseManagementPdu':
    'APDU gseMngtPdu (APPLICATION 0) — GOOSE yönetim mesajı. Bu motor yalnız goosePdu’yu çözer; gövde ham bırakıldı.',
  'protocol.goose.warning.unknownPduField':
    'goosePdu içinde tanınmayan bir etiket var — adlandırılmadı, ham bırakıldı.',
  'protocol.goose.warning.missingMandatoryField':
    'goosePdu’da zorunlu alanlardan biri yok (goID, simulation ve ndsCom opsiyoneldir, onların yokluğu uyarı üretmez).',
  'protocol.goose.warning.valueNotDecodable':
    'Alanın etiketi tanındı ama değeri beklenen biçimde değil — çözülmedi, ham gösteriliyor.',
  'protocol.goose.warning.nonPrintableString':
    'VisibleString alanında 0x20-0x7E dışında bayt var — metin olarak basılmadı, ham gösteriliyor.',
  'protocol.goose.warning.timestampLengthUnexpected':
    'Zaman damgası 8 bayt değil; saniye/kesir/kalite parçalarına bölünmedi — uydurulmuş bir zaman basmaktansa ham bırakıldı.',
  'protocol.goose.warning.clockNotTrustworthy':
    'TimeQuality baytı saat arızası ya da senkronsuzluk bildiriyor — zaman damgası taşınıyor ama yayıncı ona güvenmediğini söylüyor.',
  'protocol.goose.warning.unknownDataType':
    'Dataset elemanının tip etiketi iki bağımsız kaynakta birden geçmiyor — adlandırılmadı, ham bırakıldı.',
  'protocol.goose.warning.dataSemanticsNeedScl':
    'Dataset elemanının hangi Data Attribute’a karşılık geldiği SCL tanımından gelir; tek çerçeveden çıkarılamaz. Tipler adlandırılır, anlamlar adlandırılmaz.',
  'protocol.goose.warning.dataSetCountMismatch':
    'numDatSetEntries ile dataset’teki eleman sayısı uyuşmuyor — yayıncı ile abonenin konfigürasyonu ayrışmış olabilir.',
  'protocol.goose.warning.dataDepthLimit':
    'İç içe dataset derinliği üst sınıra ulaştı; bu seviyenin altına inilmedi (sonsuz döngü koruması).',
  'protocol.goose.warning.dataElementLimit':
    'Dataset eleman sayısı üst sınıra ulaştı; yürüyüş durduruldu (sonsuz döngü koruması).',
  'protocol.goose.warning.simulationActive':
    'simulation (test) alanı TRUE — bu yayın simülasyondur; koruma cihazları normalde gerçek olay saymaz.',
  'protocol.goose.warning.needsCommissioning':
    'ndsCom TRUE — GOOSE kontrol bloğu devreye alma bekliyor, yayın üretim verisi taşımıyor olabilir.',
  'protocol.goose.warning.securityNotDecoded':
    'PDU’da imza/güvenlik için ayrılmış alan var. Şifre çözme ve imza doğrulama bu araçta yoktur; alan ham bırakıldı.',
  'protocol.goose.warning.paddingNotZero':
    'APDU’dan sonraki baytlar sıfır değil — Ethernet dolgusu beklenirdi.',
  'protocol.goose.warning.trailingBytes':
    'Length alanının kapsadığı bölgede goosePdu’dan sonra bayt kaldı — APDU beklenenden kısa çözüldü.',
  'protocol.goose.summary.publication':
    '{goId} — stNum {stNum}, sqNum {sqNum}, {entryCount} veri',
  'protocol.goose.summary.management': 'GOOSE yönetim mesajı (APPID {appId})',
  'protocol.goose.summary.notGoose': 'GOOSE değil (EtherType {etherType})',
  'protocol.goose.summary.pduUnreadable': 'GOOSE başlığı okundu, PDU çözülemedi (APPID {appId})',
  'protocol.goose.documentation.summary':
    'IEC 61850 GOOSE: girdi TAM bir Ethernet çerçevesidir — DST/SRC MAC, opsiyonel VLAN tag’leri ve EtherType 0x88B8 çözülür, ardından 8 baytlık GOOSE başlığı (APPID, Length, Reserved 1, Reserved 2) ve BER/TLV kodlu goosePdu gelir. Length alanı APPID’den itibaren sayar (Ethernet başlığını KAPSAMAZ). PDU’nun her alanı adlandırılıp çözülür: gocbRef, timeAllowedtoLive, datSet, goID, t (SecondSinceEpoch + FractionOfSecond + TimeQuality olarak üçe bölünür), stNum, sqNum, simulation, confRev, ndsCom, numDatSetEntries ve allData. Dataset elemanları tip etiketiyle sığ çözülür (boolean, bit-string, integer, unsigned, floating-point, octet-string, visible-string, binary-time, utc-time, array, structure); iç içe yapılara derinlik sınırıyla inilir. ÇÖZÜLMEYENLER dürüstçe: MMS ve SCL içe aktarımı bu sürümde YOK (rozet bu yüzden “Kısmi”), stNum/sqNum zaman çizelgesi ve retransmission analizi çok çerçeve istediği için motorun dışında, dataset elemanlarının SEMANTİĞİ SCL’den geldiği için verilmiyor, imzalı/şifreli alan çözülmüyor. Alan düzenleri Wireshark’ın GOOSE dissector’ı (goose.asn + packet-goose.c) ve libIEC61850 ile çapraz teyitlidir; iki kaynakta birden doğrulanamayan hiçbir etiket adlandırılmaz.',
  'protocol.goose.example.steadyStatePublication.name': 'Kararlı durum yayını',
  'protocol.goose.example.steadyStatePublication.description':
    'Tipik döngüsel GOOSE yayını: stNum 1 (durum değişmedi), sqNum 12 (aynı durumun 12. tekrarı), dört elemanlı dataset (boolean, 13 bitlik bit-string, integer, boolean). Referanslar gerçek kurulumlardaki kadar uzun olduğu için PDU gövdesi 127 baytı aşar ve uzun form BER uzunluğu (0x81 LL) burada gerçekten koşar.',
  'protocol.goose.example.vlanTaggedPublication.name': 'VLAN tag’li yayın',
  'protocol.goose.example.vlanTaggedPublication.description':
    'Aynı yayın 802.1Q tag’li: PCP=4, VID=0 (priority-tagged) — 61850 kurulumlarında alışılmış biçim. Tag 4 bayt eklediği için GOOSE başlığı ve tüm PDU alanları kayar; alan ofsetleri yine HAM çerçeveye göre mutlaktır.',
  'protocol.goose.example.stateChangePublication.name': 'Durum değişikliği (stNum arttı)',
  'protocol.goose.example.stateChangePublication.description':
    'İlk boolean FALSE’tan TRUE’ya döndü: stNum 1’den 2’ye artar ve sqNum 0’a döner. Motor bu ilişkiyi KURMAZ — tek çerçeveye bakar; stNum/sqNum zaman çizelgesi analyzer işidir. İlişki burada yalnız anlatılıyor.',
  'protocol.goose.example.structuredDataset.name': 'İç içe structure + ölçüm',
  'protocol.goose.example.structuredDataset.description':
    'Dataset’in ilk elemanı bir structure: içinde IEEE-754 floating-point (230.5) ve bir bit-string var; ikinci eleman utc-time. İç içe yapıya derinlik sınırıyla inilir ve ölçümün SEMANTİĞİ (hangi Data Attribute) SCL’den geleceği için adlandırılmaz.',
  'protocol.goose.example.simulatedPublication.name': 'Simülasyon yayını',
  'protocol.goose.example.simulatedPublication.description':
    'PDU’nun simulation alanı TRUE (çift teyitli, adlandırılır) ve Reserved 1 sıfırdan farklı. Reserved 1’in bit 15’i yalnız tek kamu kaynağında “Simulated” olarak geçtiği için ADLANDIRILMAZ: alan ham gösterilir, uyarı basılır.',
  'protocol.goose.example.dataSetCountMismatch.name': 'numDatSetEntries uyuşmazlığı',
  'protocol.goose.example.dataSetCountMismatch.description':
    'numDatSetEntries 4 diyor ama dataset’te 2 eleman var. Çerçeve yapısal olarak geçerlidir; yalnız uyarı basılır — konfigürasyon ayrışmasının tel üstündeki ilk işareti budur.',
  'protocol.goose.example.indefiniteLengthBer.name': 'Bozuk BER uzunluğu',
  'protocol.goose.example.indefiniteLengthBer.description':
    'Dataset’in ilk elemanı 0x80 uzunluk okteti taşıyor: BER’de “belirsiz uzunluk”, GOOSE/DER’de yasak. Çözücü net hata verir ve okumayı durdurur — sessizce yanlış bir değer basmaz.',
  'protocol.goose.example.etherTypeNotGoose.name': 'Yanlış EtherType',
  'protocol.goose.example.etherTypeNotGoose.description':
    'Kararlı durum örneğiyle aynı gövde, EtherType kasten 0x0800 (IPv4). MAC alanları yine çözülür ama gövdeye dokunulmaz — yanlış EtherType’ta BER yürümek sessiz-yanlış çözümlemenin ta kendisi olurdu.',
  'protocol.goose.example.frameTooShort.name': 'Çok kısa çerçeve',
  'protocol.goose.example.frameTooShort.description':
    '16 bayt: Ethernet başlığı var ama 8 baytlık GOOSE başlığı tamamlanmıyor — ParseFailure (kaydedilebilir, akış devam edebilir).',

  // --- DMX512 ---
  'protocol.dmx512.error.frameTooShort': 'Tampon boş — Start Code baytı bile yok.',
  'protocol.dmx512.error.frameTooLong': 'Çerçeve, verilen azami uzunluğu aşıyor.',
  'protocol.dmx512.error.aborted': 'Çözümleme iptal edildi.',
  'protocol.dmx512.warning.unrecognizedStartCode':
    'Start Code, adlandırılan dar kümede (0x00 DMX Level Data, 0x17 Text Packet, 0xCC RDM, 0xCF System Information Packet) yok — ham gösteriliyor.',
  'protocol.dmx512.warning.slotCountExceedsMaximum':
    'Slot sayısı ANSI E1.11’in izin verdiği 512 üst sınırını aşıyor — spec dışı, ama çözümlemeye devam edildi.',
  'protocol.dmx512.summary.frame': 'Start Code {startCode}, {slotCount} slot',
  'protocol.dmx512.documentation.summary':
    'ANSI E1.11 (ESTA, DMX512-A): bir DMX universe çerçevesi Start Code (bayt 0) ve en çok 512 slottan (bayt 1..N) oluşur. BREAK ve Mark After Break fiziksel sinyal olaylarıdır, bu motora bayt olarak hiç girmez — girdi START CODE’tan başlar. Start Code yalnız dar bir kümede adlandırılır (0x00 DMX Level Data/standart lighting spec’in kendisinde; 0x17 Text Packet, 0xCC RDM, 0xCF System Information Packet ikincil kaynaktan — spec metni sayısal liste vermiyor); tanınmayan değer ham + uyarıyla gösterilir. Slotlar ham 8-bit değerdir: 16-bit (Coarse/Fine) birleştirme ve fixture personality (kanal anlamı) bu motorda YAPILMAZ — slot anlamı fixture profiline bağlıdır, profilsiz uydurulmaz (definitions sekmesi planned kalır). 512 slotu aşan çerçeve hata değil uyarıdır (spec dışı ama çözülmeye devam edilir). Checksum yoktur; “valid” yalnız yapısal (uzunluk) kontrolden gelir.',
  'protocol.dmx512.example.standardLightingBasic.name': 'Standart lighting, birkaç slot',
  'protocol.dmx512.example.standardLightingBasic.description':
    'Start Code 0x00 (DMX Level Data) + spec’in kendi RGB fixture örneği: Slot1 Red=255, Slot2 Green=128, Slot3 Blue=0, Slot4 Dimmer=200.',
  'protocol.dmx512.example.full512SlotUniverse.name': 'Tam 512 slotlu universe',
  'protocol.dmx512.example.full512SlotUniverse.description':
    'Start Code 0x00 + tam 512 slot — ANSI E1.11’in izin verdiği azami universe boyutu. Alan tablosunda ilk 16 slot ayrı satır, kalan 496 slot tek özet alanda gösterilir.',
  'protocol.dmx512.example.oversizedSlotCount.name': '512 slot tavanının aşılması',
  'protocol.dmx512.example.oversizedSlotCount.description':
    '520 slot — ANSI E1.11’in 512 sınırını aşıyor. Hata değil, yalnız slotCountExceedsMaximum uyarısı basılır; çerçeve yine de sonuna kadar çözülür.',
  'protocol.dmx512.example.unrecognizedStartCode.name': 'Tanınmayan Start Code',
  'protocol.dmx512.example.unrecognizedStartCode.description':
    'Start Code 0x01 — dar ad kümesinde yok. Alan ham gösterilir ve unrecognizedStartCode uyarısı basılır; çerçeve yapısal olarak yine geçerlidir.',
  'protocol.dmx512.example.recognizedAlternateStartCode.name':
    'Tanınan alternatif Start Code (0xCC RDM)',
  'protocol.dmx512.example.recognizedAlternateStartCode.description':
    'Start Code 0xCC — ikincil kaynaktan adlandırılan RDM (Remote Device Management) alternatif kodu. 0x00 dışındaki start code’ların da adlandığını gösterir.',
  'protocol.dmx512.example.minimalStartCodeOnly.name': 'Yalnız Start Code (0 slot)',
  'protocol.dmx512.example.minimalStartCodeOnly.description':
    '1 baytlık en küçük geçerli çerçeve: yalnız Start Code, hiç slot verisi yok.',

  // --- Art-Net (faz 10 dalga 6b) ---
  'protocol.artnet.error.headerTooShort': 'Tampon çok kısa — OpCode bile okunamaz (asgari 10 bayt gerekir).',
  'protocol.artnet.error.frameTooLong': 'Çerçeve, verilen azami uzunluğu aşıyor.',
  'protocol.artnet.error.aborted': 'Çözümleme iptal edildi.',
  'protocol.artnet.error.invalidSignature':
    'İlk 8 bayt "Art-Net" imzasıyla eşleşmiyor — bu bir Art-Net paketi değil.',
  'protocol.artnet.error.headerTruncated': 'ProtVer alanı için yeterli bayt yok.',
  'protocol.artnet.error.bodyTruncated': 'Gövde, beklenen alan için yeterli bayt içermiyor.',
  'protocol.artnet.warning.unrecognizedOpcode': 'Table 1’de tanımlı olmayan bir OpCode değeri.',
  'protocol.artnet.warning.opcodeBodyNotDecoded':
    'OpCode adı biliniyor ama gövde yapısı bu motorda çözülmedi.',
  'protocol.artnet.warning.unknownDiagPriority': 'Table 5’te tanımlı olmayan bir DiagPriority değeri.',
  'protocol.artnet.warning.lengthMismatch':
    'Length alanı, paketteki gerçek DMX veri baytı sayısıyla eşleşmiyor.',
  'protocol.artnet.summary.artDmx': 'ArtDmx — Net {net}/SubUni {subUni}, Sequence {sequence}, {length} bayt',
  'protocol.artnet.summary.artPoll': 'ArtPoll — Flags {flags}, DiagPriority {diagPriority}',
  'protocol.artnet.summary.artPollReply': 'ArtPollReply — {ip}:{port}',
  'protocol.artnet.summary.namedOpcodeRawBody': '{opcodeName} — gövde çözülmedi (ham)',
  'protocol.artnet.summary.unknownOpcode': 'Tanınmayan OpCode {opCode}',
  'protocol.artnet.summary.invalidSignature': 'Geçersiz Art-Net imzası',
  'protocol.artnet.summary.headerTruncated': 'Başlık eksik — ProtVer okunamadı.',
  'protocol.artnet.documentation.summary':
    'Artistic Licence’ın royalty-free Art-Net 4 protokolü: ortak başlık (ID+OpCode+çoğu pakette ProtVer) ve OpCode’a göre gövde — ArtDmx tam, ArtPoll/ArtPollReply dar alan kümesiyle, geri kalan OpCode’lar yalnız ad+ham gövdeyle çözülür.',
  'protocol.artnet.example.artDmxHappyPath.name': 'ArtDmx mutlu yol (birkaç kanal)',
  'protocol.artnet.example.artDmxHappyPath.description':
    'Sequence=0 (devre dışı), Net=0/SubUni=0, 4 kanallık DMX verisi (Red 255, Green 128, Blue 0, Dimmer 200 — dmx512.ts’in ANSI E1.11 örneğiyle aynı gösterim değerleri). Data[0] doğrudan Kanal 1’dir, ayrı bir start code baytı yoktur.',
  'protocol.artnet.example.artDmxFull512Universe.name': 'ArtDmx — tam 512 kanallı universe',
  'protocol.artnet.example.artDmxFull512Universe.description':
    'Sequence=1, SubUni=1, 512 kanallık deterministik dolgu veri (6a’nın önizleme/özet-alan deseni burada da uygulanır: ilk 16 kanal ayrı alan, kalanı tek özet blokta).',
  'protocol.artnet.example.artPollBasic.name': 'ArtPoll — Flags + DiagPriority',
  'protocol.artnet.example.artPollBasic.description':
    'Flags=0x02 (diagnostics istekli), DiagPriority=0x80 (DpHigh, Table 5). Diğer ArtPoll alanları (TargetPortAddress, EstaMan, Oem…) tek ham blokta.',
  'protocol.artnet.example.artPollReplyPartial.name': 'ArtPollReply — kısmi alan + ham kalan',
  'protocol.artnet.example.artPollReplyPartial.description':
    'IP Address, Port ve PortName adlandırılır; aradaki Node bilgisi baytları ve PortName sonrası (LongName/NodeReport/…) ham blok olarak kalır.',
  'protocol.artnet.example.artTimeCodeBodyNotDecoded.name': 'ArtTimeCode — OpCode tanınır, gövde ham',
  'protocol.artnet.example.artTimeCodeBodyNotDecoded.description':
    'OpCode 0x9700 Table 1’den adlandırılır ama gövde alanları bu motorda çözülmez — "OpCode adı biliniyor, gövde çözülmedi" uyarısı.',
  'protocol.artnet.example.unknownOpcode.name': 'Tanınmayan OpCode',
  'protocol.artnet.example.unknownOpcode.description':
    'Table 1’de bulunmayan 0x1234 OpCode değeri — hem alan hem çerçeve düzeyinde "tanınmayan OpCode" uyarısı.',
  'protocol.artnet.example.invalidSignature.name': 'Bozuk imza (Art-Net değil)',
  'protocol.artnet.example.invalidSignature.description':
    'İlk bayt 0x41 (\'A\') yerine 0x58 (\'X\') — 8 baytlık zorunlu imza tutmuyor, çözümleme ID alanından sonra durur (hata yolu).',
  'protocol.artnet.example.artDmxLengthMismatch.name': 'ArtDmx — Length alanı tutarsız',
  'protocol.artnet.example.artDmxLengthMismatch.description':
    'Length alanı 10 bayt bildirir ama paket yalnız 4 bayt DMX verisi taşıyor — hata değil uyarı, Data alanı gerçekte mevcut baytları gösterir.',

  // --- sACN / ANSI E1.31 (dalga 6c) ---
  'protocol.sacn.error.frameTooShort':
    'Tampon çok kısa — ACN Packet Identifier bile okunamaz (asgari 16 bayt gerekir).',
  'protocol.sacn.error.invalidAcnPacketIdentifier':
    'ACN Packet Identifier beklenen imzayla eşleşmiyor — bu paket sACN (E1.31) değil.',
  'protocol.sacn.error.bodyTruncated': 'Gövde, beklenen alan için yeterli bayt içermiyor.',
  'protocol.sacn.error.frameTooLong': 'Çerçeve, verilen azami uzunluğu aşıyor.',
  'protocol.sacn.error.aborted': 'Çözümleme iptal edildi.',
  'protocol.sacn.warning.unexpectedFixedValue':
    'Bu alan spec’in sabit bir değer beklediği bir alan ama paket farklı bir değer taşıyor.',
  'protocol.sacn.warning.unexpectedFlagsNibble':
    'Flags&Length alanının üst 4 biti beklenen 0x7 deseninde değil.',
  'protocol.sacn.warning.unrecognizedRootVector':
    'Root Layer Vector değeri VECTOR_ROOT_E131_DATA ya da VECTOR_ROOT_E131_EXTENDED değil.',
  'protocol.sacn.warning.rootVectorBodyNotDecoded':
    'Root Vector bir Synchronization/Universe Discovery paketini işaret ediyor — bu paket türünün gövdesi bu motorda çözülmüyor.',
  'protocol.sacn.warning.priorityOutOfRange': 'Priority değeri 0-200 aralığının dışında.',
  'protocol.sacn.warning.universeOutOfRange':
    'Universe değeri 1-63999 aralığının dışında (0 ve 64000-65535 rezerve).',
  'protocol.sacn.warning.layerLengthMismatch':
    'Root/Framing/DMP Flags&Length ve Property Value Count beyanları aynı toplam çerçeve uzunluğuna işaret etmiyor.',
  'protocol.sacn.summary.dataPacket': '{sourceName} — Universe {universe}, Priority {priority}, {slotCount} slot',
  'protocol.sacn.summary.extendedRootVectorRaw':
    'Synchronization/Universe Discovery paketi — gövde çözülmedi (ham)',
  'protocol.sacn.summary.unrecognizedRootVector': 'Tanınmayan Root Vector {rootVector}',
  'protocol.sacn.summary.invalidAcnPacketIdentifier': 'Geçersiz ACN Packet Identifier',
  'protocol.sacn.documentation.summary':
    'ANSI E1.31 (sACN): DMX512-A verisini Root→Framing→DMP katmanlarıyla UDP/IP üzerinden streaming olarak taşıyan protokol; her kaynağı CID’siyle tanımlar, universe çakışmasını sayısal source priority ile çözer.',
  'protocol.sacn.example.dataPacketHappyPath.name': 'E1.31 Data Packet — mutlu yol (birkaç slot)',
  'protocol.sacn.example.dataPacketHappyPath.description':
    'Start Code 0x00 + spec’in kendi RGB fixture örneği: Red 255, Green 128, Blue 0, Dimmer 200 (dmx512.ts/artnet.ts ile aynı gösterim değerleri). Priority 100 (varsayılan), Universe 1.',
  'protocol.sacn.example.dataPacketFull512Universe.name': 'E1.31 Data Packet — tam 512 slotlu universe',
  'protocol.sacn.example.dataPacketFull512Universe.description':
    'Start Code + 512 slot, deterministik dolgu (slot K değeri K mod 256) — toplam çerçeve spec’in kendi doğrulama örneğiyle (§5.4 NOTE) birebir 638 bayttır.',
  'protocol.sacn.example.priorityBoundaryZero.name': 'Priority sınır değeri — 0',
  'protocol.sacn.example.priorityBoundaryZero.description':
    'Priority alanı geçerli aralığın (0-200) alt sınırında — uyarı basmaz.',
  'protocol.sacn.example.priorityBoundaryTwoHundred.name': 'Priority sınır değeri — 200',
  'protocol.sacn.example.priorityBoundaryTwoHundred.description':
    'Priority alanı geçerli aralığın (0-200) üst sınırında (en yüksek öncelik) — uyarı basmaz.',
  'protocol.sacn.example.optionsStreamTerminated.name': 'Options — Stream_Terminated biti set',
  'protocol.sacn.example.optionsStreamTerminated.description':
    'Options baytının bit 6’sı (Stream_Terminated) 1 — kaynağın bu universe’un yayınını sonlandırdığını belirtir; Preview_Data ve Force_Synchronization bitleri 0 kalır.',
  'protocol.sacn.example.universeOutOfRange.name': 'Universe aralık dışı (64214, Discovery’ye rezerve)',
  'protocol.sacn.example.universeOutOfRange.description':
    'Universe 64214 = E131_DISCOVERY_UNIVERSE (Appendix A) — Universe Discovery paketine rezerve, Data Packet’te geçerli aralığın (1-63999) dışında sayılır; hata değil uyarı.',
  'protocol.sacn.example.invalidAcnPacketIdentifier.name': 'Bozuk ACN Packet Identifier (E1.31 değil)',
  'protocol.sacn.example.invalidAcnPacketIdentifier.description':
    'İlk imza baytı 0x41 (\'A\') yerine 0x58 (\'X\') — 12 baytlık zorunlu ACN Packet Identifier tutmuyor, çözümleme bu alandan sonra durur (hata yolu).',
  'protocol.sacn.example.layerLengthMismatch.name': 'Katman-length tutarsızlığı',
  'protocol.sacn.example.layerLengthMismatch.description':
    'DMP Property Value Count gerçek mevcut slot verisinden 10 fazla beyan eder — dört katman uzunluk beyanı (Root/Framing/DMP Flags&Length + Property Value Count) aynı toplam çerçeveye işaret etmez; hata değil uyarı, alanlar gerçek bayttan çözülür.',
  'protocol.sacn.example.rootVectorExtendedNotDecoded.name': 'Root Vector EXTENDED — gövde çözülmez',
  'protocol.sacn.example.rootVectorExtendedNotDecoded.description':
    'Root Layer Vector VECTOR_ROOT_E131_EXTENDED (Synchronization/Universe Discovery Packet) — bu paket türünün Framing Layer’ı Data Packet’inkinden tamamen farklıdır, bu yüzden gövde bu turda ham blok olarak kalır.',

  // --- DALI (faz 10 dalga 6d) ---
  'protocol.dali.error.frameTooShort': 'Tampon boş — hiçbir DALI çerçeve uzunluğuna uymuyor.',
  'protocol.dali.error.frameTooLong': 'Çerçeve, verilen azami uzunluğu aşıyor.',
  'protocol.dali.error.aborted': 'Çözümleme iptal edildi.',
  'protocol.dali.warning.unrecognizedAddressClass':
    'Address Byte, Individual/Group/Broadcast kalıplarının hiçbirine uymuyor — ham gösteriliyor.',
  'protocol.dali.warning.unrecognizedOpcode':
    'Opcode, dar ad kümesinde (OFF, Go To Scene, Set Fade Time, Store Scene, Query Actual Level, Query Lamp Failure) yok — yalnız kategorisiyle ham gösteriliyor.',
  'protocol.dali.warning.backwardFrameContextDependent':
    'Bu 8-bit yanıtın hangi Query’nin cevabı olduğu tek çerçeveden bilinemez — yorum, önceki forward frame bağlamına bağlıdır.',
  'protocol.dali.warning.dali2DeviceFramePlanned':
    'Bu 3 baytlık çerçeve DALI-2 24-bit control-device çerçevesi olabilir — bu dalganın kapsamı dışında, ham gösteriliyor (planned).',
  'protocol.dali.summary.backwardFrame': 'Backward frame — yanıt {value}',
  'protocol.dali.summary.forwardDapc': '{address} — DAPC {command}',
  'protocol.dali.summary.forwardCommand': '{address} — {command}',
  'protocol.dali.summary.dali2DeviceFrame': 'DALI-2 device frame (planned)',
  'protocol.dali.documentation.summary':
    'IEC 62386 (DALI) ailesi: girdi 1 (backward), 2 (forward) ya da 3 baytlık (DALI-2 device frame, bu dalgada planned) ham bayt dizisidir — fiziksel katmanın Manchester kodlaması bu motora hiç girmez. Forward frame’de Address Byte üst bitlerden Individual (0AAAAAAS, 6 bit, 0-63) / Group (100AAAAS, 4 bit, 0-15) / Broadcast (1111111S) sınıfına ayrılır; en düşük bit (S) Data Byte’ın DAPC (Direct Arc Power, 0-254 + 255=MASK) mi yoksa Command mı olduğunu belirler. Command dar bir ad kümesiyle adlandırılır (OFF, Go To Scene, Set Fade Time, Store Scene, Query Actual Level, Query Lamp Failure) + Control/Configuration/Query kategorisi; kümenin dışındaki opcode’lar ham + yalnız kategori gösterir, ad uydurulmaz. Backward frame’in 8-bit yanıtı bağlamsız yorumlanamaz (hangi Query’nin cevabı olduğu bu motorda bilinmez). Checksum yoktur; “valid” yalnız yapısal (uzunluk) kontrolden gelir.',
  'protocol.dali.example.individualDapc.name': 'Individual adres + DAPC (arc power seviyesi)',
  'protocol.dali.example.individualDapc.description':
    'Individual 5 (Address Byte 0x0A), Data Byte 200 — Direct Arc Power Control hedef seviyesi (0-254 aralığında).',
  'protocol.dali.example.individualRecognizedCommandOff.name': 'Individual adres + tanınan komut (OFF)',
  'protocol.dali.example.individualRecognizedCommandOff.description':
    'Individual 5 (Address Byte 0x0B, S=1), Command OFF (0x00) — dar ad kümesindeki en temel kontrol komutu.',
  'protocol.dali.example.groupCommand.name': 'Group adres + komut (Go To Scene)',
  'protocol.dali.example.groupCommand.description':
    'Group 3 (Address Byte 0x87), Command Go To Scene 7 (0x17) — sahne numarası opcode-0x10 formülüyle çıkarılır.',
  'protocol.dali.example.broadcastCommand.name': 'Broadcast + komut (OFF)',
  'protocol.dali.example.broadcastCommand.description':
    'Broadcast (Address Byte 0xFF), Command OFF (0x00) — bustaki tüm cihazları aynı anda kapatan klasik yayın çerçevesi.',
  'protocol.dali.example.unrecognizedOpcode.name': 'Tanınmayan opcode (uyarı yolu)',
  'protocol.dali.example.unrecognizedOpcode.description':
    'Individual 10, Command 0x01 (DALI’de "UP" olarak bilinir ama bu motorun dar ad kümesinde YOK) — yalnız kategorisiyle (Control) ham gösterilir, ad uydurulmaz.',
  'protocol.dali.example.backwardFrameResponse.name': 'Backward frame — 8-bit yanıt',
  'protocol.dali.example.backwardFrameResponse.description':
    'Tek baytlık yanıt (0xD2) — hangi Query’ye ait olduğu bu tek çerçeveden bilinemez, yalnız ham değer + bağlam uyarısı gösterilir.',
  'protocol.dali.example.dali2DeviceFrame.name': '3 baytlık DALI-2 device frame (kapsam dışı)',
  'protocol.dali.example.dali2DeviceFrame.description':
    'Karar 6 gereği 24-bit DALI-2 control-device çerçevesinin yapısı bu dalgada çözülmez — tüm baytlar ham + "planned" uyarısıyla gösterilir, hata üretilmez.',
  'protocol.dali.example.unrecognizedLength.name': 'Tanınmayan uzunluk (hata yolu)',
  'protocol.dali.example.unrecognizedLength.description':
    '4 bayt — DALI’nin backward (1), forward (2) ya da DALI-2 device (3) uzunluklarının hiçbirine uymuyor, ParseFailure döner.',

  // --- KNX (faz 10 dalga 6e) ---
  'protocol.knx.error.frameTooShort':
    'Tampon, Standard L_Data başlığı ya da NPCI’nin bildirdiği uzunluk için yeterli bayt içermiyor.',
  'protocol.knx.error.frameTooLong': 'Çerçeve, verilen azami uzunluğu aşıyor.',
  'protocol.knx.error.aborted': 'Çözümleme iptal edildi.',
  'protocol.knx.error.checksumMismatch':
    'Hesaplanan (terslenmiş XOR) checksum, çerçevedeki değerle eşleşmiyor.',
  'protocol.knx.warning.extendedFrameOutOfScope':
    'Extended frame (Control Field bit7=0) bu dalganın kapsamı dışında — gövde çözülmeden ham gösteriliyor.',
  'protocol.knx.warning.unrecognizedApci':
    'APCI değeri dar ad kümesinde (GroupValueRead, GroupValueWrite, GroupValueResponse) yok — ham gösteriliyor.',
  'protocol.knx.warning.unexpectedReservedBits':
    'Control Field’ın sabit/reserved bitleri (bit6, bit4, bit1, bit0) beklenen desende değil.',
  'protocol.knx.summary.namedService': '{apci} — {destination}',
  'protocol.knx.summary.unrecognizedApci': 'Tanınmayan APCI — {destination}',
  'protocol.knx.summary.extendedFrame': 'Extended frame (kapsam dışı, ham)',
  'protocol.knx.documentation.summary':
    'KNX Standard/ISO 22510 ailesi: TP1 Standard L_Data telegramı — Control Field (Frame Type/Repeat/Priority), Source/Destination Address (Individual `a.b.c` / Group `a/b/c`, AT bitine göre İKİ AYRI gösterim), NPCI (Address Type + Hop Count + Length — Length alanı OFF-BY-ONE: gerçek TPCI/APCI+data bayt sayısı Length+1’dir), TPCI/APCI (dar ad kümesi: GroupValueRead, GroupValueWrite, GroupValueResponse; dışındakiler ham + uyarı) çözülür. Payload DPT (Datapoint Type) bilinmeden HAM kalır — “raw uint16: 100” gibi bir gösterim, mühendislik değeri asla UYDURULMAZ. Checksum terslenmiş (NOT) XOR’dur. Extended frame (Control Field bit7=0) ve KNXnet/IP bu motorun kapsamı dışındadır.',
  'protocol.knx.example.groupValueWrite.name': 'GroupValueWrite — Group adres (mutlu yol)',
  'protocol.knx.example.groupValueWrite.description':
    'Source 1.1.10, Destination 2/1/5 (Group), Priority Low. GroupValueWrite ile inline değer 1 gönderilir — DPT bilinmediği için "Light ON" anlamı UYDURULMAZ, yalnız ham bit gösterilir.',
  'protocol.knx.example.groupValueRead.name': 'GroupValueRead — payload’suz sorgu',
  'protocol.knx.example.groupValueRead.description':
    'Source 1.1.10, Destination 2/1/6 (Group), Priority Alarm. GroupValueRead’in payload’u yoktur.',
  'protocol.knx.example.groupValueResponse.name': 'GroupValueResponse — 2 baytlık ham değer (00 64)',
  'protocol.knx.example.groupValueResponse.description':
    'Source 1.1.10, Destination 3/2/10 (Group), Priority High. Payload appended 2 bayt `00 64` (=100) — katalog yorumunun kendi "raw uint16: 100" örneğiyle birebir aynı bayt çifti.',
  'protocol.knx.example.individualAddressDestination.name': 'Individual adres hedefli telegram',
  'protocol.knx.example.individualAddressDestination.description':
    'Source 1.1.10, Destination 4.2.100 (Individual — AT=0). Priority System. Aynı GroupValueWrite APCI’si Group yerine Individual hedefe gönderilir; gösterim `4.2.100` olur, `X/Y/Z` ile KARIŞMAZ.',
  'protocol.knx.example.extendedFrame.name': 'Extended frame (uyarı yolu, ham)',
  'protocol.knx.example.extendedFrame.description':
    'Control Field bit7=0 — Karar 5 gereği bu dalganın kapsamı dışı. Control Field yine çözülür (Repeat, Priority), gövde ham + "kapsam dışı" uyarısıyla gösterilir; HATA üretilmez.',
  'protocol.knx.example.unrecognizedApci.name': 'Tanınmayan APCI (uyarı yolu)',
  'protocol.knx.example.unrecognizedApci.description':
    'Source 1.1.10, Destination 4/3/20 (Group). APCI kodu 3 (tam APCI tablosunda IndividualAddress_Write ama bu dalganın dar kümesinde YOK) — yalnız ham gösterilir, ad UYDURULMAZ.',
  'protocol.knx.example.checksumMismatch.name': 'Bozuk checksum (hata yolu)',
  'protocol.knx.example.checksumMismatch.description':
    '"GroupValueWrite — Group adres" örneğiyle AYNI çerçeve, yalnız son bayt (checksum) bilerek bozuldu — ParseFailure değil ama çerçeve valid:false ve checksum-mismatch hatası taşır.',

  // --- BACnet MS/TP (faz 10 dalga 6f) ---
  'protocol.bacnetMstp.error.frameTooShort':
    'Arabellek, Preamble + Frame Type + MAC adresleri + Length + Header CRC için gereken 8 baytı içermiyor.',
  'protocol.bacnetMstp.error.frameTooLong': 'Çerçeve, verilen azami uzunluğu aşıyor.',
  'protocol.bacnetMstp.error.aborted': 'Çözümleme iptal edildi.',
  'protocol.bacnetMstp.error.lengthMismatch':
    'Length alanının vaat ettiği Data ve (varsa) Data CRC baytlarının tamamı arabellekte yok.',
  'protocol.bacnetMstp.error.preambleInvalid': 'Preamble 0x55 0xFF değil — çerçeve imzası tanınmadı.',
  'protocol.bacnetMstp.error.headerCrcMismatch': 'Hesaplanan Header CRC-8, çerçevedeki değerle eşleşmiyor.',
  'protocol.bacnetMstp.error.dataCrcMismatch': 'Hesaplanan Data CRC-16, çerçevedeki değerle eşleşmiyor.',
  'protocol.bacnetMstp.error.npduTruncated': 'NPDU alanları için arabellekte yeterli bayt yok.',
  'protocol.bacnetMstp.error.apduTruncated': 'APDU alanları için arabellekte yeterli bayt yok.',
  'protocol.bacnetMstp.warning.unknownFrameType':
    'Frame Type değeri dar ad kümesinde (Token, Poll For Master, … Reply Postponed) yok — ham gösteriliyor.',
  'protocol.bacnetMstp.warning.dataNotNpdu':
    'Bu Frame Type NPDU/APDU taşımaz (Test_Request/Response, rezerve ya da vendor-proprietary) — Data ham gösteriliyor.',
  'protocol.bacnetMstp.warning.unknownNetworkMessageType':
    'Network Layer Message tipi dar ad kümesinde yok — ham gösteriliyor.',
  'protocol.bacnetMstp.warning.unexpectedNpduVersion': 'NPDU Version alanı beklenen 1 değerinde değil.',
  'protocol.bacnetMstp.warning.unknownPduType':
    'APDU PDU Type değeri dar ad kümesinde (Confirmed-Request … Abort) yok — geri kalan baytlar ham gösteriliyor.',
  'protocol.bacnetMstp.warning.unknownServiceChoice':
    'Service Choice değeri dar ad kümesinde yok — ham gösteriliyor.',
  'protocol.bacnetMstp.warning.serviceParametersNotDecoded':
    'Servis parametreleri tag’li BACnet kodlamasıyla taşınır; bu motor onları çözmez, resmi standarda bağlıdır — ham blok gösteriliyor.',
  'protocol.bacnetMstp.summary.noData': '{frameType}',
  'protocol.bacnetMstp.summary.apdu': '{frameType}: {pduType} — {serviceChoice}',
  'protocol.bacnetMstp.summary.networkLayerMessage': '{frameType}: {messageType}',
  'protocol.bacnetMstp.summary.rawData': '{frameType} (ham)',
  'protocol.bacnetMstp.documentation.summary':
    'BACnet MS/TP (Master-Slave/Token-Passing) veri bağı çerçevesi: Preamble, Frame Type (dar ad kümesi), Destination/Source MAC Address (BACnet Device Instance İLE KARIŞTIRILMAZ), Length, Header CRC-8 ve — Length>0 ise — Data + Data CRC-16 çözülür. Data yalnız "BACnet Data Expecting Reply" ve "BACnet Data Not Expecting Reply" Frame Type’larında paylaşılan bir çekirdekle (npdu.ts/apdu.ts) NPDU + APDU BAŞLIĞINA (PDU type, Invoke ID, Service Choice adı) çözülür; tag’li servis parametreleri HAM kalır. Token dolaşımı/hata analizi bu motorun kapsamı dışındadır.',
  'protocol.bacnetMstp.example.token.name': 'Token (Length=0, Data CRC yok)',
  'protocol.bacnetMstp.example.token.description':
    'MAC 1’den MAC 5’e Token çerçevesi. Length=0 olduğu için Data ve Data CRC alanları hiç yoktur — çerçeve Header CRC’de biter.',
  'protocol.bacnetMstp.example.pollForMaster.name': 'Poll For Master (Length=0, ikinci Frame Type)',
  'protocol.bacnetMstp.example.pollForMaster.description':
    'MAC 5’ten MAC 1’e Poll For Master çerçevesi — Length=0 yolunun yalnız Token’a özgü olmadığını, başka bir Frame Type’ta da aynı şekilde işlediğini gösterir.',
  'protocol.bacnetMstp.example.dataExpectingReplyReadProperty.name':
    'BACnet Data Expecting Reply — Confirmed-Request / ReadProperty',
  'protocol.bacnetMstp.example.dataExpectingReplyReadProperty.description':
    'MAC 1’den MAC 10’a; NPDU Expecting Reply=1, APDU Confirmed-Request (Invoke ID 1, Service Choice ReadProperty). Servis parametreleri (3 bayt) temsilidir — bu motor tarafından çözülmez.',
  'protocol.bacnetMstp.example.dataNotExpectingReplyIAm.name':
    'BACnet Data Not Expecting Reply — Unconfirmed-Request / I-Am',
  'protocol.bacnetMstp.example.dataNotExpectingReplyIAm.description':
    'MAC 10’dan broadcast MAC’e (0xFF); APDU Unconfirmed-Request (Service Choice I-Am), Invoke ID YOK. Servis parametreleri (4 bayt) temsilidir.',
  'protocol.bacnetMstp.example.badHeaderCrc.name': 'Bozuk Header CRC (hata yolu)',
  'protocol.bacnetMstp.example.badHeaderCrc.description':
    '"Token" örneğiyle AYNI gövde, yalnız Header CRC baytı bilerek bozuldu — ParseFailure değil ama çerçeve valid:false ve crc-mismatch hatası taşır.',
  'protocol.bacnetMstp.example.badDataCrc.name': 'Bozuk Data CRC (hata yolu)',
  'protocol.bacnetMstp.example.badDataCrc.description':
    '"BACnet Data Not Expecting Reply — Unconfirmed-Request / I-Am" örneğiyle AYNI gövde, Header CRC DOĞRU ama Data CRC’nin son baytı bilerek bozuldu — NPDU/APDU yine yapısal olarak çözülür, yalnız Data CRC alanı valid:false olur.',
  'protocol.bacnetMstp.example.unrecognizedFrameType.name': 'Tanınmayan Frame Type (uyarı yolu)',
  'protocol.bacnetMstp.example.unrecognizedFrameType.description':
    'Frame Type 0xC8 (vendor-proprietary aralığı) dar ad kümesinde yok — yalnız uyarı üretir (CRC’lerin ikisi de doğru), Data NPDU/APDU olarak değil ham blok olarak gösterilir.',

  // --- BACnet/IP (faz 10 dalga 6g) ---
  'protocol.bacnetIp.error.headerTruncated':
    'Arabellek, 4 baytlık BVLC başlığı (Type + Function + Length) için yeterli veri içermiyor.',
  'protocol.bacnetIp.error.frameTooLong': 'Çerçeve, verilen azami uzunluğu aşıyor.',
  'protocol.bacnetIp.error.aborted': 'Çözümleme iptal edildi.',
  'protocol.bacnetIp.error.typeInvalid':
    'BVLC Type baytı 0x81 değil — bu bir BACnet/IP (Annex J) mesajı olarak tanınmadı.',
  'protocol.bacnetIp.error.bipAddressTruncated':
    'Forwarded-NPDU’nun 6 baytlık Originating Device B/IP Address alanı için arabellekte yeterli bayt yok.',
  'protocol.bacnetIp.warning.lengthMismatch':
    'BVLC Length alanı (kendisi dahil toplam uzunluk) gerçek paket boyutuyla eşleşmiyor.',
  'protocol.bacnetIp.warning.unknownFunction':
    'BVLC Function değeri dar ad kümesinde (BVLC-Result … Original-Broadcast-NPDU) yok — ham gösteriliyor.',
  'protocol.bacnetIp.warning.functionBodyNotDecoded':
    'Bu BVLC fonksiyonunun gövdesi (BBMD/Foreign Device tablo içeriği dahil) bu motor tarafından çözülmez — ham blok gösteriliyor.',
  'protocol.bacnetIp.summary.noBody': '{function}',
  'protocol.bacnetIp.summary.apdu': '{function}: {pduType} — {serviceChoice}',
  'protocol.bacnetIp.summary.networkLayerMessage': '{function}: {messageType}',
  'protocol.bacnetIp.summary.rawData': '{function} (ham)',
  'protocol.bacnetIp.documentation.summary':
    'BACnet/IP (BVLL — BACnet Virtual Link Layer, ANSI/ASHRAE 135 Annex J): BVLC başlığı (Type=0x81 sabit, Function dar ad kümesi, Length — KENDİSİNİ DE SAYAN toplam uzunluk) çözülür. Original-Unicast-NPDU / Original-Broadcast-NPDU / Forwarded-NPDU (6 baytlık B/IP adresinden SONRA) paylaşılan bir çekirdekle (npdu.ts/apdu.ts, BACnet MS/TP ile ORTAK) NPDU + APDU BAŞLIĞINA çözülür; tag’li servis parametreleri HAM kalır. Diğer BVLC fonksiyonları (BVLC-Result, Broadcast Distribution Table/Foreign Device Table okuma-yazma, Register-Foreign-Device vb.) yalnız AD + HAM gövde olarak gösterilir — BBMD/Foreign Device tablo takibi bu motorun kapsamı dışındadır.',
  'protocol.bacnetIp.example.originalUnicastNpduReadProperty.name':
    'Original-Unicast-NPDU — Confirmed-Request / ReadProperty (mutlu yol)',
  'protocol.bacnetIp.example.originalUnicastNpduReadProperty.description':
    'BVLC Function 0x0A. NPDU Expecting Reply=1, APDU Confirmed-Request (Invoke ID 1, Service Choice ReadProperty) — bacnetmstp.ts’nin ZATEN test edilmiş Data gövdesiyle AYNI baytlar, paylaşılan çekirdeğin BVLL bağlamında da doğru çalıştığını kanıtlar.',
  'protocol.bacnetIp.example.originalBroadcastNpduIAm.name': 'Original-Broadcast-NPDU — Unconfirmed-Request / I-Am',
  'protocol.bacnetIp.example.originalBroadcastNpduIAm.description':
    'BVLC Function 0x0B. APDU Unconfirmed-Request (Service Choice I-Am), Invoke ID YOK — bacnetmstp.ts’nin “data-not-expecting-reply-i-am” örneğiyle AYNI Data gövdesi.',
  'protocol.bacnetIp.example.forwardedNpdu.name': 'Forwarded-NPDU — B/IP adresli',
  'protocol.bacnetIp.example.forwardedNpdu.description':
    'BVLC Function 0x04. 6 baytlık Originating Device B/IP Address (192.168.1.50:47808) NPDU’dan ÖNCE gelir — NPDU ancak offset 10’da başlar; gövde “Original-Broadcast-NPDU” örneğiyle AYNI (I-Am).',
  'protocol.bacnetIp.example.registerForeignDevice.name': 'Register-Foreign-Device (uyarı yolu, ham gövde)',
  'protocol.bacnetIp.example.registerForeignDevice.description':
    'BVLC Function 0x05, 2 baytlık Time-To-Live (300 sn) gövdesi — dar ad kümesinde AMA gövdesi bu motor tarafından çözülmez, ham + uyarı gösterilir; BBMD/Foreign Device tablo takibi YAPILMAZ.',
  'protocol.bacnetIp.example.bvlcResult.name': 'BVLC-Result (dar ad + ham gövde)',
  'protocol.bacnetIp.example.bvlcResult.description':
    'BVLC Function 0x00, 2 baytlık Result Code gövdesi ham gösterilir.',
  'protocol.bacnetIp.example.lengthMismatch.name': 'Length tutarsızlığı (uyarı yolu)',
  'protocol.bacnetIp.example.lengthMismatch.description':
    '"Original-Unicast-NPDU — Confirmed-Request / ReadProperty" ile AYNI 13 baytlık gövde, yalnız Length alanı bilerek 99 yazıldı — gerçek paket boyutu (UDP datagramı) TEK doğru kaynak sayılır, yalnız UYARI üretir, çerçeve yapısal olarak valid:true kalır.',
  'protocol.bacnetIp.example.invalidType.name': 'Type ≠ 0x81 (hata yolu)',
  'protocol.bacnetIp.example.invalidType.description':
    '"Original-Unicast-NPDU — Confirmed-Request / ReadProperty" ile AYNI gövde, yalnız BVLC Type baytı 0x81 yerine 0x01 — bu bir BACnet/IP mesajı olarak tanınmaz (hata), ama geri kalan alanlar yine SABİT ofsetlerden yapısal olarak kurulur.',

  // --- BLE Advertisement ---
  'protocol.bleAdvertisement.error.frameTooShort': 'Çerçeve en az 2 baytlık PDU Header kadar uzun olmalı.',
  'protocol.bleAdvertisement.error.frameTooLong': 'Çerçeve izin verilen azami uzunluğu aşıyor.',
  'protocol.bleAdvertisement.error.aborted': 'Çözümleme iptal edildi.',
  'protocol.bleAdvertisement.error.payloadTooShort': 'AdvA alanı için payload’da yeterli bayt yok (en az 6 bayt gerekir).',
  'protocol.bleAdvertisement.error.adLengthZero': 'AD Structure Length alanı 0 — geçersiz, en az AD Type baytını kapsamalı.',
  'protocol.bleAdvertisement.error.adStructureTruncated':
    'Bir AD Structure’ın bildirdiği uzunluk için tamponda yeterli bayt yok.',
  'protocol.bleAdvertisement.warning.unknownPduType': 'PDU Type dar kümede yok; tür adlandırılamadı.',
  'protocol.bleAdvertisement.warning.lengthMismatch':
    'Header’daki Length alanı gerçek kalan bayt sayısıyla uyuşmuyor.',
  'protocol.bleAdvertisement.warning.payloadSchemaNotDecoded':
    'Bu PDU tipinin payload şeması (AdvA+AD zinciri değil) bu dalgada çözülmüyor; ham gösterildi.',
  'protocol.bleAdvertisement.warning.unknownAdType': 'AD Type dar kümede yok; ham + tip numarasıyla gösterildi.',

  'protocol.bleAdvertisement.documentation.summary':
    'BLE Advertisement, advertising-channel PDU’sunu çözer: 2 baytlık Header (PDU Type/RFU/ChSel/TxAdd/RxAdd/Length) + Payload. Yalnız AD taşıyan dört PDU tipinde (ADV_IND/ADV_NONCONN_IND/ADV_SCAN_IND/SCAN_RSP) Payload, AdvA (6 bayt, LE) + AD Structure zinciri (Length|Type|Data) olarak açılır; Length AD Type baytını KAPSAR. Dar bir AD Type kümesi (Flags, Local Name, 16/128-bit Service UUID, Service Data, Manufacturer Specific, Tx Power) semantik çözülür, kalanı ham + tip numarası. Preamble/Access Address/CRC girdide YOK — sniffer/Wireshark seviyesi.',
  'protocol.bleAdvertisement.example.flags.name': 'Flags (spec örneği)',
  'protocol.bleAdvertisement.example.flags.description':
    'AD chain `02 01 06` — Flags = LE General Discoverable Mode + BR/EDR Not Supported.',
  'protocol.bleAdvertisement.example.manufacturerSpecific.name': 'Manufacturer Specific Data (spec örneği)',
  'protocol.bleAdvertisement.example.manufacturerSpecific.description':
    'AD chain `05 FF 4C 00 01 02` — Company ID 0x004C (Apple, Inc.) + 2 baytlık veri.',
  'protocol.bleAdvertisement.example.completeLocalName.name': 'Complete Local Name (spec örneği)',
  'protocol.bleAdvertisement.example.completeLocalName.description':
    'AD chain `09 09 53 65 6E 73 6F 72 30 31` — ASCII "Sensor01".',
  'protocol.bleAdvertisement.example.multipleAdStructures.name': 'Flags + Local Name (gerçekçi beacon)',
  'protocol.bleAdvertisement.example.multipleAdStructures.description':
    'İki AD Structure aynı payload’da art arda — zincir yürüyüşünü kanıtlar.',
  'protocol.bleAdvertisement.example.unknownPduType.name': 'Bilinmeyen PDU Type (uyarı yolu)',
  'protocol.bleAdvertisement.example.unknownPduType.description':
    'PDU Type 0x0F (Reserved) — header adlandırılamaz, uyarı basar; çerçeve yine valid:true kalır.',
  'protocol.bleAdvertisement.example.truncatedAdStructure.name': 'Eksik AD Structure (hata yolu)',
  'protocol.bleAdvertisement.example.truncatedAdStructure.description':
    'AD Structure Length=5 bildiriyor ama tamponda yalnız 3 bayt kalan var — truncated-frame basar.',

  // --- LoRaWAN ---
  'protocol.lorawan.error.frameTooShort': 'Çerçeve en az MHDR(1)+MIC(4)=5 bayt kadar uzun olmalı.',
  'protocol.lorawan.error.frameTooLong': 'Çerçeve izin verilen azami uzunluğu aşıyor.',
  'protocol.lorawan.error.aborted': 'Çözümleme iptal edildi.',
  'protocol.lorawan.error.joinRequestLength': 'Join-Request tam 23 bayt olmalı (MHDR+JoinEUI+DevEUI+DevNonce+MIC).',
  'protocol.lorawan.error.fhdrTruncated': 'FHDR için tamponda yeterli bayt yok (DevAddr+FCtrl+FCnt en az 7 bayt ister).',
  'protocol.lorawan.error.foptsTruncated': 'FOptsLen’in bildirdiği uzunluk için tamponda yeterli bayt yok.',
  'protocol.lorawan.warning.majorNotR1': 'Major alanı LoRaWAN R1 (00) değil; çözüm yine de sürer.',
  'protocol.lorawan.warning.frameKindNotDecoded':
    'Bu FType’ın gövde şeması (Proprietary ya da 1.1’e özgü Rejoin Request) bu dalgada çözülmüyor; ham gösterildi.',
  'protocol.lorawan.warning.joinAcceptEncrypted':
    'Join-Accept gövdesi (MIC dahil) uçtan uca şifreli; anahtar olmadan çözülmez, ham gösterildi.',
  'protocol.lorawan.warning.foptsNotDecoded':
    'FOpts içindeki MAC komutları bu dalgada çözülmüyor (analyzer işi); ham gösterildi.',
  'protocol.lorawan.warning.frmPayloadEncrypted': 'FRMPayload şifreli; anahtar olmadan çözülmez, ham gösterildi.',
  'protocol.lorawan.warning.micNeedsSessionKeys':
    'MIC var; oturum anahtarları olmadan doğrulanamaz (PASS/FAIL basılmaz).',

  'protocol.lorawan.documentation.summary':
    'LoRaWAN, PHYPayload’ı çözer: MHDR(1B) + MACPayload + MIC(4B). Join-Request açık metindir (JoinEUI/DevEUI/DevNonce). Join-Accept MHDR sonrası uçtan uca şifrelidir (MIC dahil), ham gösterilir. Data frame’de FHDR (DevAddr/FCtrl/FCnt/FOpts) alan alan çözülür — FCtrl yöne göre farklı bit düzeni taşır; FOpts’taki MAC komutları ham kalır (analyzer işi). FPort=0 uygulama verisi DEĞİL, MAC komutu demektir. FRMPayload her zaman şifreli → ham + işaret. MIC hiçbir zaman doğrulanmaz — "present, cannot verify without session keys" (mavlink crcNeedsDialect emsali). Sürüm çıpası L2 1.0.4 (TS001); FType 110 (1.1 Rejoin Request) dar adlanır, gövdesi bu dalgada çözülmez.',
  'protocol.lorawan.example.joinRequest.name': 'Join-Request (açık metin)',
  'protocol.lorawan.example.joinRequest.description':
    'JoinEUI/DevEUI/DevNonce açıkça çözülür — Join-Request şifreli değildir.',
  'protocol.lorawan.example.joinAccept.name': 'Join-Accept (şifreli, ham)',
  'protocol.lorawan.example.joinAccept.description':
    'MHDR sonrası tüm gövde (MIC dahil) uçtan uca şifreli — anahtar olmadan tek ham blok.',
  'protocol.lorawan.example.unconfirmedDataUp.name': 'Unconfirmed Data Up — mutlu yol',
  'protocol.lorawan.example.unconfirmedDataUp.description':
    'FHDR + FPort + şifreli FRMPayload alan alan çözülür; MIC ham + doğrulanamaz uyarısı.',
  'protocol.lorawan.example.confirmedDataDownWithFopts.name': 'Confirmed Data Down + FOpts',
  'protocol.lorawan.example.confirmedDataDownWithFopts.description':
    'Downlink FCtrl yorumu (RFU/FPending) + FOptsLen=2 — MAC komutları ham gösterilir.',
  'protocol.lorawan.example.macCommandOnly.name': 'FPort=0 (yalnız MAC komutu)',
  'protocol.lorawan.example.macCommandOnly.description':
    'FPort=0 — uygulama verisi DEĞİL, şifreli MAC komutu anlamına gelir.',
  'protocol.lorawan.example.noApplicationPayload.name': 'FPort/FRMPayload yok (geçerli çerçeve)',
  'protocol.lorawan.example.noApplicationPayload.description':
    'FHDR + FOptsLen=0, FPort ve FRMPayload hiç yok — TS001 §4.3’e göre yine de geçerli.',
  'protocol.lorawan.example.proprietary.name': 'Proprietary (gövde şeması dışı)',
  'protocol.lorawan.example.proprietary.description':
    'FType=111 — gövde şeması standartlaştırılmamış, bu dalgada çözülmez, ham gösterilir.',
  'protocol.lorawan.example.truncatedFhdr.name': 'Eksik FHDR (hata yolu)',
  'protocol.lorawan.example.truncatedFhdr.description':
    'MACPayload yalnız 6 bayt — FHDR en az 7 bayt (DevAddr+FCtrl+FCnt) ister, truncated-frame basar.',

} as const;

/**
 * Bir sözlüğün taşıması gereken şekil. `en.ts` bunu ANOTASYON olarak kullanır
 * (`satisfies` değil): eksik anahtar ancak anotasyonla derleme hatası olur.
 */
export type TranslationDictionary = Record<keyof typeof tr, string>;
