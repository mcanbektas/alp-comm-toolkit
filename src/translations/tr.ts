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
  'protocol.relatedCalculators': 'İlgili hesap araçları',
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
  'calc.field.directFormat': 'DIRECT format',
  'calc.field.directWord': 'Ham Y sözcüğü (hex/ondalık)',
  'calc.field.directSlope': 'm (eğim)',
  'calc.field.directOffset': 'b (ofset)',
  'calc.field.directExponent': 'R (onluk üs)',
  'calc.field.coefficientBytes': 'COEFFICIENTS yanıtı (5 bayt hex: m alt, m üst, b alt, b üst, R)',
  'calc.field.voutModeByte': 'VOUT_MODE baytı (hex/ondalık)',
  'calc.field.voutModeMode': 'Mod',
  'calc.field.voutModeRelative': 'Absolute / Relative',
  'calc.field.voutModeExponent': 'ULINEAR16 üssü',
  'calc.field.microwireProfile': 'Cihaz profili',
  'calc.field.microwireCustom': 'Serbest — datasheet\'ten gir',
  'calc.field.microwireOpcodeBits': 'Opcode bit',
  'calc.field.microwireAddressBits': 'Adres bit',
  'calc.field.microwireWordBits': 'Sözcük bit',
  'calc.field.microwireSource': 'Kaynak belge',
  'calc.field.microwireCommand': 'Komut',
  'calc.field.microwireClockKhz': 'SK frekansı',
  'calc.field.microwireClockCycles': 'Gereken clock çevrimi',
  'calc.field.microwireTransferTime': 'Transaction süresi',
  'calc.field.microwireHasData': 'Veri sözcüğü taşır mı',
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

  // --- LoRa PHY (Semtech SX1276 datasheet Rev.7 terimleri) ---
  'calc.field.loraSpreadingFactor': 'Yayılma çarpanı (SF)',
  'calc.field.loraBandwidth': 'Bant genişliği',
  'calc.field.loraCodingRate': 'Kodlama oranı (CR)',
  'calc.field.loraPayloadBytes': 'PHY payload (bayt)',
  'calc.field.loraPreambleSymbols': 'Preamble sembolü',
  'calc.field.loraCrcEnabled': 'Payload CRC açık',
  'calc.field.loraCrcHint':
    'Güncel datasheet (Rev.7) CRC’yi formülde parametre tutar: kapalıyken paket 5 sembol kısalır. 2013 tarihli AN1200.13 ve avbentem hesaplayıcısı CRC’yi hep açık varsayar — bu yüzden CRC kapalıyken sonuçlar bilerek farklıdır.',
  'calc.field.loraImplicitHeader': 'Implicit header',
  'calc.field.loraImplicitHeaderHint':
    'Header baytları havada taşınmaz; alıcı uzunluğu/CR’yi önceden bilir. SF6 yalnız bu kipte çalışır.',
  'calc.field.loraLowDataRateOptimization': 'Low Data Rate Optimization',
  'calc.field.loraLdroAuto': 'Otomatik (Ts > 16 ms)',
  'calc.field.loraLdroOn': 'Açık',
  'calc.field.loraLdroOff': 'Kapalı',
  'calc.field.loraSymbolTime': 'Sembol süresi (Ts)',
  'calc.field.loraSymbolRate': 'Sembol hızı (Rs)',
  'calc.field.loraLdroApplied': 'LDRO uygulandı mı',
  'calc.field.loraTotalPreambleSymbols': 'Toplam preamble sembolü (+4.25)',
  'calc.field.loraPreambleTime': 'Preamble süresi',
  'calc.field.loraPayloadSymbols': 'Payload sembol sayısı',
  'calc.field.loraPayloadTime': 'Payload süresi',
  'calc.field.loraTimeOnAir': 'Time on Air (ToA)',
  'calc.field.loraBitRate': 'PHY bit hızı',
  'calc.field.loraEffectiveBitRate': 'Etkin bit hızı (payload / ToA)',
  'calc.field.loraAirtimeSection': 'Airtime / duty cycle',
  'calc.field.loraDutyCycleHint':
    'Sınır zaman üzerinden tanımlıdır, paket sayısı üzerinden değil: aynı duty cycle SF12’de saatte birkaç pakete, SF7’de yüzlercesine karşılık gelir. EU868 g1 bandı %1’dir.',
  'calc.field.loraDutyCyclePercent': 'İzin verilen duty cycle (%)',
  'calc.field.loraPacketsPerHour': 'Planlanan hız (paket/saat, opsiyonel)',
  'calc.field.loraMaxPacketsPerHour': 'Azami paket/saat',
  'calc.field.loraMaxPacketsPerDay': 'Azami paket/gün',
  'calc.field.loraMinimumOffTime': 'Gönderim sonrası asgari sessizlik',
  'calc.field.loraMinimumInterval': 'Gönderimler arası asgari aralık',
  'calc.field.loraOccupancy': 'Kanal doluluğu',
  'calc.field.loraWithinDutyCycle': 'Sınır içinde mi',
  'calc.field.loraSensitivitySection': 'Alıcı duyarlılığı',
  'calc.field.loraSensitivityEstimated': 'SF/BW’den tahmin et',
  'calc.field.loraSensitivityManual': 'Elle gir',
  'calc.field.loraNoiseFigure': 'Gürültü figürü (dB)',
  'calc.field.loraThermalNoise': 'Termal gürültü tabanı',
  'calc.field.loraDemodulatorSnr': 'Demodülatör SNR limiti',
  'calc.field.loraSensitivity': 'Duyarlılık (dBm)',
  'calc.field.loraLinkBudgetSection': 'Link bütçesi',
  'calc.field.loraTxPower': 'Verici gücü (dBm)',
  'calc.field.loraTxAntennaGain': 'Verici anten kazancı (dBi)',
  'calc.field.loraRxAntennaGain': 'Alıcı anten kazancı (dBi)',
  'calc.field.loraCableLoss': 'Kablo/konnektör kaybı (dB)',
  'calc.field.loraFrequencyMhz': 'Frekans (MHz)',
  'calc.field.loraMeasuredRssi': 'Ölçülen RSSI (dBm, opsiyonel)',
  'calc.field.loraEffectiveRadiatedPower': 'Etkin yayılan güç',
  'calc.field.loraMaximumPathLoss': 'Azami yol kaybı bütçesi',
  'calc.field.loraFreeSpaceRange': 'Serbest uzay menzil tahmini',
  'calc.field.loraMeasuredMargin': 'Ölçülen marj',
  'calc.field.loraFreeSpaceRangeHint':
    'Menzil SERBEST UZAY modelidir: engel, kırınım ve arazi yok. Gerçek dağıtımda yol kaybı üssü 2 değil 2.7-4 arasıdır — bu sayı üst sınırdır, saha menzili değil.',
  'calc.field.loraDutyProfileSection': 'Radyo ve işlem profili',
  'calc.field.loraTimeOnAirHint':
    'Enerji modelinin bağlı olduğu tek zaman terimi Time on Air’dır; PHY parametreleri burada ikinci kez sorulmaz. ToA’yı üreten araç:',
  'calc.field.loraTimeOnAirMs': 'Time on Air (ms)',
  'calc.field.loraTransmitCurrent': 'Gönderim akımı (mA)',
  'calc.field.loraReceiveCurrent': 'Alım akımı (mA)',
  'calc.field.loraReceiveWindowMs': 'Alım penceresi toplamı (ms)',
  'calc.field.loraActiveCurrent': 'Uyanık akım — MCU/sensör (mA)',
  'calc.field.loraActiveMs': 'Uyanık kalma süresi (ms)',
  'calc.field.loraSleepCurrent': 'Uyku akımı (µA)',
  'calc.field.loraMessagesPerDay': 'Günlük mesaj sayısı',
  'calc.field.loraBatterySection': 'Pil',
  'calc.field.loraBatteryCapacity': 'Pil kapasitesi (mAh)',
  'calc.field.loraDerating': 'Kullanılamayan kapasite payı (%)',
  'calc.field.loraSelfDischarge': 'Kendiliğinden boşalma (%/yıl)',
  'calc.field.loraTransmitCharge': 'Gönderim yükü (mesaj başına)',
  'calc.field.loraReceiveCharge': 'Alım yükü (mesaj başına)',
  'calc.field.loraActiveCharge': 'Uyanık işlem yükü (mesaj başına)',
  'calc.field.loraChargePerMessage': 'Mesaj başına toplam yük',
  'calc.field.loraDailyActiveCharge': 'Günlük gönderim yükü',
  'calc.field.loraDailySleepCharge': 'Günlük uyku yükü',
  'calc.field.loraDailySelfDischarge': 'Günlük kendiliğinden boşalma',
  'calc.field.loraDailyCharge': 'Günlük toplam yük',
  'calc.field.loraAverageCurrent': 'Ortalama akım',
  'calc.field.loraIdleShare': 'Boşta kalan payı (uyku + boşalma)',
  'calc.field.loraUsableCapacity': 'Kullanılabilir kapasite',
  'calc.field.loraBatteryLifeDays': 'Tahmini pil ömrü',
  'calc.field.loraBatteryLifeYears': 'Tahmini pil ömrü (yıl)',
  'calc.field.loraUnitDays': 'gün',
  'calc.field.loraUnitYears': 'yıl',
  'calc.field.loraBatteryModelHint':
    'Model sabit akımlı üç pencere + sürekli uyku + kendiliğinden boşalmadır. İçermedikleri: sıcaklık etkisi, gönderim darbesinde gerilim çökmesi (Li-SOCl2 gibi yüksek iç dirençli kimyalarda gerçek sınır çoğu zaman budur), radyo rampası ve raf ömrü tavanı. Boşta kalan payı yüksekse gönderim sıklığını azaltmak ömrü uzatmaz — uyku akımına ve pil kimyasına bakın.',

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
  'calc.microwireTransaction.name': 'Microwire transaction',
  'calc.microwireTransaction.summary':
    'Cihaz profilinden (opcode/adres/sözcük bit genişlikleri) bir komutun kaç clock çevrimi sürdüğünü ve seçilen SK frekansında ne kadar zaman aldığını hesaplar.',
  'calc.pmbusDirect.name': 'PMBus DIRECT format',
  'calc.pmbusDirect.summary':
    'PMBus DIRECT formatını cihazın m/b/R katsayılarıyla çözer ve kodlar; COEFFICIENTS yanıtını ve VOUT_MODE baytını da ayrıştırır.',
  'calc.loraAirtime.name': 'LoRa Time on Air / airtime',
  'calc.loraAirtime.summary':
    'PHY parametre setinden sembol süresini, Time on Air’ı, bit hızını ve duty cycle bütçesini hesaplar (Semtech SX1276 datasheet Rev.7).',
  'calc.loraBattery.name': 'LoRa pil / enerji tahmini',
  'calc.loraBattery.summary':
    'Time on Air ve düğüm akım profilinden mesaj başına yükü, günlük tüketimi ve tahmini pil ömrünü çıkarır.',
  'calc.loraLinkBudget.name': 'LoRa link bütçesi',
  'calc.loraLinkBudget.summary':
    'SF/BW’den alıcı duyarlılığını tahmin eder, azami yol kaybını, serbest uzay menzilini ve ölçülen marjı verir.',
  'calc.logicLevelCompat.name': 'Logic seviyesi uyumluluğu',
  'calc.logicLevelCompat.summary':
    'İki cihazın datasheet eşiklerinden (V_OH/V_OL/V_IH/V_IL) her iki yönü ayrı ayrı değerlendirir, gürültü paylarını verir ve seviye çevirici gerekip gerekmediğini söyler.',
  'calc.field.deviceA': 'Cihaz A',
  'calc.field.deviceB': 'Cihaz B',
  'calc.field.vohMin': 'V_OH (min) — çıkış HIGH',
  'calc.field.volMax': 'V_OL (max) — çıkış LOW',
  'calc.field.vihMin': 'V_IH (min) — giriş HIGH eşiği',
  'calc.field.vilMax': 'V_IL (max) — giriş LOW eşiği',
  'calc.field.absoluteMaxOptional': 'Mutlak maksimum giriş (opsiyonel)',
  'calc.field.directionAToB': 'Yön A → B',
  'calc.field.directionBToA': 'Yön B → A',
  'calc.field.logicVerdict': 'Sonuç',
  'calc.field.highNoiseMargin': 'HIGH gürültü payı',
  'calc.field.lowNoiseMargin': 'LOW gürültü payı',
  'calc.field.overvoltage': 'Aşırı gerilim',
  'calc.logicLevel.pass': 'Uyumlu',
  'calc.logicLevel.warning': 'Seviye çevirici gerekebilir',
  'calc.logicLevel.overvoltage':
    'Sürücünün HIGH çıkışı alıcının mutlak maksimum giriş gerilimini aşıyor — seviyeler uyumlu görünse bile alıcı zarar görebilir.',
  'calc.logicLevel.note':
    'Karar besleme gerilimiyle (3.3V/5V) değil, datasheet\'teki dört eşikle verilir; her yön ayrı değerlendirilir çünkü iki cihazın çıkış/giriş karakteristikleri simetrik olmayabilir.',
  'calc.currentLoop.name': 'Akım döngüsü (4–20 mA)',
  'calc.currentLoop.summary':
    'Döngü akımını mühendislik değerine (ve tersine) çevirir, shunt gerilimini ve durum sınıfını verir; ayrıca besleme/kablo/yük bütçesinden kalan compliance gerilimini hesaplar.',
  'calc.field.loopScaling': 'Ölçekleme',
  'calc.field.loopCompliance': 'Compliance bütçesi',
  'calc.field.loopCurrentMa': 'Döngü akımı',
  'calc.field.shuntOhms': 'Shunt / burden direnci',
  'calc.field.rangeMinValue': '4 mA karşılığı (aralık alt ucu)',
  'calc.field.rangeMaxValue': '20 mA karşılığı (aralık üst ucu)',
  'calc.field.openLoopBelowOptional': 'Kopuk döngü eşiği (opsiyonel)',
  'calc.field.shortAboveOptional': 'Kısa devre eşiği (opsiyonel)',
  'calc.field.engineeringValue': 'Mühendislik değeri',
  'calc.field.normalizedPercent': 'Normalize',
  'calc.field.shuntVoltageOut': 'Shunt gerilimi',
  'calc.field.loopState': 'Durum',
  'calc.field.loopSupplyVolts': 'Döngü besleme gerilimi',
  'calc.field.transmitterMinVolts': 'Transmitter minimum gerilimi',
  'calc.field.cableOhms': 'Kablo direnci',
  'calc.field.loadOhms': 'Alıcı / yük direnci',
  'calc.field.marginVoltsOptional': 'Emniyet marjı (opsiyonel)',
  'calc.field.cableDropVolts': 'Kablo üzerindeki düşüm',
  'calc.field.loadDropVolts': 'Yük üzerindeki düşüm',
  'calc.field.requiredVolts': 'Gereken gerilim',
  'calc.field.remainingCompliance': 'Kalan compliance',
  'calc.field.loopVerdict': 'Sonuç',
  'calc.loopState.openLoop': 'Kopuk döngü',
  'calc.loopState.underRange': 'Aralık altı',
  'calc.loopState.normal': 'Normal aralık',
  'calc.loopState.overRange': 'Aralık üstü',
  'calc.loopState.shortSuspected': 'Kısa devre şüphesi',
  'calc.loopCompliance.sufficient': 'Besleme yeterli',
  'calc.loopCompliance.insufficient': 'Besleme yetersiz — döngü kapanmaz',
  'calc.canPhy.name': 'CAN PHY zamanlama',
  'calc.canPhy.summary':
    'Bit süresini, kablo ve transceiver gecikmelerinden gidiş-dönüş bütçesini ve sample point’e kalan marjı hesaplar; ayrıca paralel sonlandırma eşdeğerini verir.',
  'calc.canPhy.withinBudget': 'Bütçe yeterli',
  'calc.canPhy.overBudget': 'Bütçe aşıldı — sample point’ten önce dönmüyor',
  'calc.linPhy.name': 'LIN PHY break / sync',
  'calc.linPhy.summary':
    'Break süresini bit süresi cinsinden hesaplar, normal bir UART karakterinden uzun olup olmadığını söyler ve ölçülen sync açıklığından baud tahmini yapar.',
  'calc.linPhy.breakLonger': 'Karakterden uzun — break ayırt edilebilir',
  'calc.linPhy.breakTooShort': 'Karakterden kısa/eşit — break ayırt edilemez',
  'calc.flexrayPhy.name': 'FlexRay PHY kanal zamanlaması',
  'calc.flexrayPhy.summary':
    'Bit süresini ve çerçeve süresini verir, Channel A ile Channel B gecikmeleri arasındaki skew’i saniye ve bit süresi cinsinden gösterir.',
  'calc.kLine.name': 'K-Line zamanlaması',
  'calc.kLine.summary':
    '5-baud init adres baytı süresini, fast-init wake-up darbe bütçesini ve parametrik bir bayt/mesaj aralığı penceresini hesaplar — ISO 9141/14230’un W1–W5 ya da P1–P4 zamanlama değerlerinden hiçbiri varsayılmaz, sizden gelir.',
  'calc.kLine.withinWindow': 'Pencere içinde',
  'calc.kLine.belowMinimum': 'Asgarinin altında',
  'calc.kLine.aboveMaximum': 'Azaminin üstünde',
  'calc.field.kLineFiveBaudSection': '5-Baud Init',
  'calc.field.kLineFastInitSection': 'Fast Init',
  'calc.field.kLineGapSection': 'Bayt Süresi & Aralık Bütçesi',
  'calc.field.addressByteDuration': 'Adres baytı süresi',
  'calc.field.fastInitLowPulseMs': 'Düşük darbe (ms)',
  'calc.field.fastInitHighPulseMs': 'Yüksek darbe (ms)',
  'calc.field.fastInitMinTotalMsOptional': 'Asgari toplam (ms, opsiyonel)',
  'calc.field.fastInitMaxTotalMsOptional': 'Azami toplam (ms, opsiyonel)',
  'calc.field.fastInitTotalDuration': 'Toplam wake-up süresi',
  'calc.field.kLineWindowVerdict': 'Pencere sonucu',
  'calc.field.kLineMeasuredGapMs': 'Ölçülen aralık (ms)',
  'calc.field.kLineMinGapMs': 'Asgari aralık (ms)',
  'calc.field.kLineMaxGapMs': 'Azami aralık (ms)',
  'calc.field.canBudget': 'Gecikme bütçesi',
  'calc.field.canTermination': 'Sonlandırma',
  'calc.field.terminationCount': 'Sonlandırma sayısı',
  'calc.field.equivalentOhms': 'Eşdeğer direnç',
  'calc.field.bitrateBps': 'Bit hızı (bit/s)',
  'calc.field.samplePointPercent': 'Sample point (%)',
  'calc.field.transceiverDelayNs': 'Transceiver gecikmesi (ns)',
  'calc.field.nodeDelayNsOptional': 'Node gecikmesi (ns, opsiyonel)',
  'calc.field.bitTime': 'Bit süresi',
  'calc.field.sampleTime': 'Sample point’e kadar geçen süre',
  'calc.field.timingMargin': 'Kalan marj',
  'calc.field.budgetVerdict': 'Sonuç',
  'calc.field.breakBits': 'Break süresi (bit)',
  'calc.field.breakDuration': 'Break süresi',
  'calc.field.breakVerdict': 'Break değerlendirmesi',
  'calc.field.syncSpanMicroseconds': 'Ölçülen sync açıklığı (µs)',
  'calc.field.estimatedBaud': 'Tahmini baud',
  'calc.field.frameBits': 'Çerçeve uzunluğu (bit)',
  'calc.field.channelADelayNs': 'Channel A gecikmesi (ns)',
  'calc.field.channelBDelayNs': 'Channel B gecikmesi (ns)',
  'calc.field.frameDuration': 'Çerçeve süresi',
  'calc.field.channelSkew': 'Kanal skew’i',
  'calc.field.skewBitTimes': 'Skew (bit süresi)',
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
  'decode.options.legend': 'Çözümleme parametreleri',
  'decode.options.hint':
    'Bu protokolde çerçevenin bazı bilgileri baytların içinde yoktur; aşağıdaki değerler cihazın datasheet\'inden ya da yakalamanın bağlamından gelir.',
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

  // --- AT Commands (ITU-T V.250 / 3GPP TS 27.007, jenerik motor) ---
  'protocol.atCommands.documentation.summary':
    'ITU-T V.250 ve 3GPP TS 27.007 metin komut ailesi için jenerik çerçeveleme: komut/yanıt ayrımı, URC akışı, final result code. Hücresel sözlük (CSQ/COPS/CREG…) bu motorda YOK, lte-modem-at’te.',
  'protocol.atCommands.error.emptyLine': 'Boş satır çözülemez.',
  'protocol.atCommands.error.frameTooLong': 'Satır izin verilen azami uzunluğu aşıyor.',
  'protocol.atCommands.error.aborted': 'Çözümleme iptal edildi.',
  'protocol.atCommands.warning.mixedCasePrefix':
    'AT öneki karışık büyük/küçük harf ("At"/"aT") — V.250 yalnız "AT" ya da "at" tanır, çoğu modem yine de kabul eder.',
  'protocol.atCommands.example.commandExecute.name': 'Execute komutu',
  'protocol.atCommands.example.commandExecute.description':
    'Parametresiz genişletilmiş komut — sinyal kalitesini sorar.',
  'protocol.atCommands.example.commandRead.name': 'Read komutu (?)',
  'protocol.atCommands.example.commandRead.description':
    'Ağ kayıt durumunu okur; `?` sonu okuma eylemidir.',
  'protocol.atCommands.example.commandTest.name': 'Test komutu (=?)',
  'protocol.atCommands.example.commandTest.description':
    'Desteklenen parametre kümesini sorar; `=?` sonu test eylemidir.',
  'protocol.atCommands.example.commandSet.name': 'Set komutu (=<params>)',
  'protocol.atCommands.example.commandSet.description':
    'SMS metin modunu açar; `=1` parametresi ayrı bir alanda taşınır.',
  'protocol.atCommands.example.commandBare.name': 'Çıplak AT',
  'protocol.atCommands.example.commandBare.description':
    'Bağlantı kontrolü — komut adı/eylemi yok, yalnız `command` sınıfı.',
  'protocol.atCommands.example.commandMixedCase.name': 'Karışık harf önek',
  'protocol.atCommands.example.commandMixedCase.description':
    '"At" öneki geçerli kalır ama uyarı üretir — V.250 yalnız "AT"/"at" tanır.',
  'protocol.atCommands.example.informationResponse.name': 'Bilgi yanıtı',
  'protocol.atCommands.example.informationResponse.description':
    '`+NAME: params` biçimi — hangi komuta ait olduğu oturum bağlamı ister.',
  'protocol.atCommands.example.finalResultOk.name': 'OK',
  'protocol.atCommands.example.finalResultOk.description':
    'V.250 §6.3.1 çıplak final result code — komut başarıyla tamamlandı.',
  'protocol.atCommands.example.finalResultError.name': 'ERROR',
  'protocol.atCommands.example.finalResultError.description':
    'V.250 §6.3.1 çıplak final result code — komut reddedildi.',
  'protocol.atCommands.example.finalResultCmeNumeric.name': '+CME ERROR (sayısal)',
  'protocol.atCommands.example.finalResultCmeNumeric.description':
    'AT+CMEE=1 modunda sayısal hata kodu — kodun ANLAMI çözülmez, yalnız yapısı.',
  'protocol.atCommands.example.finalResultCmeVerbose.name': '+CME ERROR (metin)',
  'protocol.atCommands.example.finalResultCmeVerbose.description':
    'AT+CMEE=2 modunda metin hata açıklaması — aynı sözdizimi, farklı gösterim.',
  'protocol.atCommands.example.finalResultCms.name': '+CMS ERROR',
  'protocol.atCommands.example.finalResultCms.description':
    'SMS/mesajlaşmaya özgü hata kodu ailesi — CME’den ayrı alan adıyla taşınır.',
  'protocol.atCommands.example.connectWithRate.name': 'CONNECT (hızla)',
  'protocol.atCommands.example.connectWithRate.description':
    'Bağlantı hızı sayısal bir alt-alana ayrıştırılır (bit/s birimiyle).',
  'protocol.atCommands.example.prompt.name': 'Veri girişi promptu (>)',
  'protocol.atCommands.example.prompt.description':
    'AT+CMGS gibi komutlardan sonra gelen veri girişi bekleme işareti.',
  'protocol.atCommands.example.bannerText.name': 'Serbest metin (banner)',
  'protocol.atCommands.example.bannerText.description':
    'Bilinen hiçbir kalıba uymayan üretici/banner metni — hata sayılmaz.',

  // --- Hayes Command Set (V.250 temel sözdizimi, at-commands'ın üstünde) ---
  'protocol.hayesCommandSet.documentation.summary':
    'Hayes’in orijinal TEMEL komut sözdizimi (ATD/ATA/ATH/ATZ, S-register’lar, +++ kaçış) — at-commands’ın üstünde. Numerik result code (ATV0) burada değil, at-commands’ta (tüm AT lehçelerine ortak).',
  'protocol.hayesCommandSet.warning.hookParameterUndocumented':
    'ATH parametresi 0 değil — "off-hook" (H1) hiçbir kaynakta doğrulanamadı, anlamı varsayılmaz.',
  'protocol.hayesCommandSet.warning.resetParameterVendorSpecific':
    'ATZ parametresinin anlamı (profil indeksi) V.250’de tanımlı değil — spec’in kendi ifadesiyle "manufacturer-specific".',
  'protocol.hayesCommandSet.warning.dialStringUnknownChar':
    'Dial-string V.250’nin izin verdiği karakter kümesinin (0-9 A-D # * + , " T P W @ !) dışında karakter içeriyor.',
  'protocol.hayesCommandSet.warning.sRegisterVendorOnly':
    'Bu S-register V.250’de tanımlı değil — yalnız u-blox belgeliyor.',
  'protocol.hayesCommandSet.warning.sRegisterValueOutOfRange':
    'Yazılan değer bu register için belgelenen aralığın dışında.',
  'protocol.hayesCommandSet.warning.unparsedBasicSyntax':
    'Temel sözdizimi kalıplarının hiçbirine uymayan artık metin — ayrıştırılmadı, ham bırakıldı.',
  'protocol.hayesCommandSet.warning.sRegisterResponseAmbiguous':
    'Üç haneli sıfır dolgulu yanıt S-register okuması OLABİLİR ama oturum bağlamı olmadan kesin denemez.',
  'protocol.hayesCommandSet.example.chainedResetEchoVerbose.name': 'Zincirlenmiş temel komutlar',
  'protocol.hayesCommandSet.example.chainedResetEchoVerbose.description':
    'Z, E0, V1 ayraçsız peş peşe — V.250’nin standart zincirleme kuralı.',
  'protocol.hayesCommandSet.example.dialWithReturn.name': 'Dial + komut moduna dönüş',
  'protocol.hayesCommandSet.example.dialWithReturn.description':
    '";" ile biten dial-string komut moduna döner, ardından H0 (kapat) zincire devam eder.',
  'protocol.hayesCommandSet.example.dialTonePrefixNoReturn.name': 'Ton önekli dial (";" yok)',
  'protocol.hayesCommandSet.example.dialTonePrefixNoReturn.description':
    '"T" öneki opak metin olarak taşınır — ton/puls anlamı bu turda doğrulanmadı, ";" olmadığı için dial-string satırın sonuna kadar sürer.',
  'protocol.hayesCommandSet.example.answer.name': 'Cevap ver (A)',
  'protocol.hayesCommandSet.example.answer.description':
    'Parametresiz, satırın kalanını yutan V.250’nin kendi örneği.',
  'protocol.hayesCommandSet.example.hookHangUp.name': 'Hattı kapat (H0)',
  'protocol.hayesCommandSet.example.hookHangUp.description':
    'Yalnız H0 tüm kaynaklarda belgeli — "hang up".',
  'protocol.hayesCommandSet.example.hookUndocumentedParam.name': 'Belgesiz H parametresi (H1)',
  'protocol.hayesCommandSet.example.hookUndocumentedParam.description':
    '"Off-hook" anlamı hiçbir kaynakta doğrulanamadı — yapı çözülür, anlam uydurulmaz.',
  'protocol.hayesCommandSet.example.sRegisterWriteKnown.name': 'Bilinen register yazma (S0)',
  'protocol.hayesCommandSet.example.sRegisterWriteKnown.description':
    'Auto-answer ring sayısı — V.250 §6.3.8, aralık 0-255.',
  'protocol.hayesCommandSet.example.sRegisterReadKnown.name': 'Bilinen register okuma (S3?)',
  'protocol.hayesCommandSet.example.sRegisterReadKnown.description':
    'Satır sonu karakteri sorgusu — yanıt üç haneli sıfır dolgulu gelir.',
  'protocol.hayesCommandSet.example.sRegisterWriteVendorOnly.name': 'Satıcı-özel register (S12)',
  'protocol.hayesCommandSet.example.sRegisterWriteVendorOnly.description':
    'Guard time, yalnız u-blox belgeliyor — 1 birim = 20ms, burada milisaniyeye çevrilir.',
  'protocol.hayesCommandSet.example.sRegisterWriteOutOfRange.name': 'Aralık dışı değer (S0=300)',
  'protocol.hayesCommandSet.example.sRegisterWriteOutOfRange.description':
    'S0’ın belgelenen aralığı 0-255 — 300 bu aralığın dışında, uyarı üretir.',
  'protocol.hayesCommandSet.example.sRegisterWriteUnverified.name': 'Doğrulanmamış register (S5)',
  'protocol.hayesCommandSet.example.sRegisterWriteUnverified.description':
    'V.250 S5’i sayar ama bu turun araştırması anlamını doğrulamadı — yapı çözülür, isim uydurulmaz.',
  'protocol.hayesCommandSet.example.sRegisterResponseCandidate.name': 'S-register yanıtı (aday)',
  'protocol.hayesCommandSet.example.sRegisterResponseCandidate.description':
    'Üç haneli sıfır dolgulu bare metin — oturum bağlamı olmadan kesin S-register yanıtı denemez.',
  'protocol.hayesCommandSet.example.numericResultCode.name': 'Sayısal result code (ATV0)',
  'protocol.hayesCommandSet.example.numericResultCode.description':
    'at-commands’ın numerik result code desteğinden miras — hayes hiçbir ek kod yazmadan devralır.',

  // --- SLIP (RFC 1055, framing motorunun üstünde ince sarmal) ---
  'protocol.slip.documentation.summary':
    'RFC 1055 — IP datagramlarını seri hat üzerinde END ve ESC baytlarıyla çerçeveler; adresleme, uzunluk ya da bütünlük denetimi BİLEREK taşımaz. Çerçeveleme motoru (Faz 6) zaten kesip çözüyor, burada yalnız gösterim katmanı var.',
  'protocol.slip.error.emptyFrame': 'Boş çerçeve çözülemez.',
  'protocol.slip.error.noDelimiter': 'Arabellekte END (0xC0) baytı bulunamadı — çerçeve tamamlanmamış.',
  'protocol.slip.error.aborted': 'Çözümleme iptal edildi.',
  'protocol.slip.warning.trailingBytes':
    'Çerçeveden sonra artık bayt var — ayrı bir alanda gösterildi, henüz çözülmedi.',
  'protocol.slip.example.escapedPayload.name': 'Kaçışlı payload (END + ESC)',
  'protocol.slip.example.escapedPayload.description':
    'Payload hem END (0xC0) hem ESC (0xDB) baytı taşıyor — ikisi de kaçışlanır, ayrı alanlarla gösterilir.',
  'protocol.slip.example.leadingEndMarker.name': 'Baştaki opsiyonel END',
  'protocol.slip.example.leadingEndMarker.description':
    'RFC 1055’in hat temizleme işaretleyicisi — çerçeve aramasından ÖNCE atlanır.',
  'protocol.slip.example.noEscaping.name': 'Kaçış gerekmeyen veri',
  'protocol.slip.example.noEscaping.description':
    'Payload hiç özel bayt (0xC0/0xDB) taşımıyor — kodlanmış hâli değişmeden geçer.',

  // --- COBS (framing motorunun üstünde ince sarmal) ---
  'protocol.cobs.documentation.summary':
    'Seçili bir bayt değerini (0x00) veriden tamamen kaldırıp geri döndürülebilir biçimde kodlar — en kötü durumda 254 baytta 1 bayt ek yük. Çerçeveleme motoru (Faz 6) zaten kod baytlarını çözüyor, burada yalnız gösterim katmanı var.',
  'protocol.cobs.error.emptyFrame': 'Boş çerçeve çözülemez.',
  'protocol.cobs.error.noDelimiter': 'Arabellekte delimiter (0x00) baytı bulunamadı — çerçeve tamamlanmamış.',
  'protocol.cobs.error.aborted': 'Çözümleme iptal edildi.',
  'protocol.cobs.warning.trailingBytes':
    'Çerçeveden sonra artık bayt var — ayrı bir alanda gösterildi, henüz çözülmedi.',
  'protocol.cobs.example.zeroInMiddle.name': 'Sıfır ortada (spec fixture)',
  'protocol.cobs.example.zeroInMiddle.description':
    'Payload ortasında bir 0x00 taşıyor — iki kod baytıyla kodlanır, biri sıfırı geri getirir.',
  'protocol.cobs.example.singleZero.name': 'Tek sıfır baytı',
  'protocol.cobs.example.singleZero.description':
    'En küçük olası COBS girdisi — tek başına bir 0x00 baytı, iki kod baytıyla kodlanır.',
  'protocol.cobs.example.noZeroBytes.name': 'Sıfır içermeyen veri',
  'protocol.cobs.example.noZeroBytes.description':
    'Payload hiç 0x00 taşımıyor — tek bir kod baytıyla, tek blokta kodlanır.',

  // --- KISS (TAPR/AX.25 TNC arayüzü, framing motorunun üstünde ince sarmal) ---
  'protocol.kiss.documentation.summary':
    'Bilgisayar ile paket-radyo TNC’si arasında FEND (0xC0) ile sınırlanan minimal çerçeveleme — baytları SLIP’le BİREBİR aynı. Payload normalde bir AX.25 çerçevesidir, bu motor onu çözmez (v1 kapsamı).',
  'protocol.kiss.error.emptyFrame': 'Boş çerçeve çözülemez.',
  'protocol.kiss.error.noDelimiter': 'Arabellekte FEND (0xC0) baytı bulunamadı — çerçeve tamamlanmamış.',
  'protocol.kiss.error.aborted': 'Çözümleme iptal edildi.',
  'protocol.kiss.warning.trailingBytes':
    'Çerçeveden sonra artık bayt var — ayrı bir alanda gösterildi, henüz çözülmedi.',
  'protocol.kiss.warning.unknownCommand':
    'Bilinmeyen ya da ayrılmış komut yarım baytı (7-14) — TAPR spec’te tanımlı değil.',
  'protocol.kiss.example.dataFrame.name': 'Data Frame (komut 0)',
  'protocol.kiss.example.dataFrame.description':
    'Port 0, Data Frame komutu — payload bir AX.25 çerçevesi varsayılır, bu motor tarafından çözülmez.',
  'protocol.kiss.example.txdelayCommand.name': 'TXDELAY komutu',
  'protocol.kiss.example.txdelayCommand.description':
    'Port 0, TXDELAY komutu — parametre baytı 10ms biriminden milisaniyeye çevrilir.',
  'protocol.kiss.example.escapedDataFrame.name': 'Kaçışlı Data Frame (FEND + FESC)',
  'protocol.kiss.example.escapedDataFrame.description':
    'Payload hem FEND (0xC0) hem FESC (0xDB) baytı taşıyor — SLIP’in AYNI kuralıyla kaçışlanır.',

  // --- PPP (RFC 1661/1662, framing motorunun üstünde ince sarmal) ---
  'protocol.ppp.documentation.summary':
    'RFC 1661 — birden çok ağ katmanı protokolünü tek bir noktadan noktaya bağlantı üzerinde taşır, LCP ile müzakere edilir, HDLC tarzı 0x7D kaçışıyla çerçevelenir. Çerçeveleme motoru (Faz 6) zaten kesip çözüyor; bu sayfa Address/Control/Protocol demux’unu ve LCP paket başlığını ekliyor.',
  'protocol.ppp.error.emptyFrame': 'Boş çerçeve çözülemez.',
  'protocol.ppp.error.noDelimiter': 'Arabellekte Flag (0x7E) baytı bulunamadı — çerçeve tamamlanmamış.',
  'protocol.ppp.error.aborted': 'Çözümleme iptal edildi.',
  'protocol.ppp.error.noProtocolField': 'Address/Control sonrası Protocol alanı için yeterli bayt yok.',
  'protocol.ppp.warning.trailingBytes':
    'Çerçeveden sonra artık bayt var — ayrı bir alanda gösterildi, henüz çözülmedi.',
  'protocol.ppp.warning.unknownLcpOption': 'Bilinmeyen LCP seçenek türü — ham veri gösterildi.',
  'protocol.ppp.warning.malformedLcpOptions':
    'LCP seçenek zinciri bozuk (Length alanı kalan veriyle uyuşmuyor) — kalan bayt ham gösterildi.',
  'protocol.ppp.example.lcpConfigureRequest.name': 'LCP Configure-Request (MRU seçeneği)',
  'protocol.ppp.example.lcpConfigureRequest.description':
    'Standart Address/Control üzerinde LCP Configure-Request — tek seçenek: Maximum-Receive-Unit = 1500 bayt.',
  'protocol.ppp.example.escapedInformation.name': 'Kaçışlı Information (0x7E)',
  'protocol.ppp.example.escapedInformation.description':
    'IPv4 payload’ı 0x7E baytı taşıyor — HDLC’nin AYNI async kaçışıyla (0x7D + XOR 0x20) kodlanır.',
  'protocol.ppp.example.compressedFields.name': 'ACFC + PFC (sıkıştırılmış alanlar)',
  'protocol.ppp.example.compressedFields.description':
    'Address/Control atlanmış (ACFC), Protocol tek bayt olarak sıkıştırılmış (PFC) — ikisi birden.',

  // --- HDLC (ISO/IEC 13239 temel mod, hdlcCore.ts'in üstünde ince sarmal) ---
  'protocol.hdlc.documentation.summary':
    'ISO/IEC 13239 (Q.921 temel modu) — 0x7E bayrağı, beş-bir bit doldurma ve I/S/U kontrol alanıyla PPP’nin, SDLC’nin ve birçok telekom hattının temelini oluşturan bit-yönelimli veri bağı çerçevelemesi. Decode sekmesi zaten bit-çözülmüş (destuffed) bayt dizisi alır — bit doldurma ve senkron yakalama bu dalgada kapsam dışı.',
  'protocol.hdlc.error.emptyFrame': 'Boş çerçeve çözülemez.',
  'protocol.hdlc.error.noDelimiter': 'Arabellekte Flag (0x7E) baytı bulunamadı — çerçeve tamamlanmamış.',
  'protocol.hdlc.error.aborted': 'Çözümleme iptal edildi.',
  'protocol.hdlc.error.tooShort': 'İçerik Address+Control+FCS asgarisinden (4 bayt) kısa.',
  'protocol.hdlc.error.fcsMismatch': 'FCS uyuşmuyor — çerçeve iletim sırasında bozulmuş olabilir.',
  'protocol.hdlc.warning.trailingBytes':
    'Çerçeveden sonra artık bayt var — ayrı bir alanda gösterildi, henüz çözülmedi.',
  'protocol.hdlc.example.iFrame.name': 'I-frame (sıra numaralı veri)',
  'protocol.hdlc.example.iFrame.description':
    'N(S)=1, N(R)=2, P/F=0 taşıyan bir Information çerçevesi — FCS doğrulanır.',
  'protocol.hdlc.example.sFrame.name': 'S-frame (RR)',
  'protocol.hdlc.example.sFrame.description':
    'RR (Receive Ready), N(R)=3, P/F=1 taşıyan bir Supervisory çerçevesi — Information alanı yok.',
  'protocol.hdlc.example.uFrame.name': 'U-frame (adlanmamış komut)',
  'protocol.hdlc.example.uFrame.description':
    'Unnumbered format — komut bitleri bu dalgada adlanmıyor (dosya başı disiplini), yalnız format + FCS gösterilir.',

  // --- SDLC (hdlcCore.ts'in AYNISI, Address alanı Station Address olarak adlanır) ---
  'protocol.sdlc.documentation.summary':
    'IBM’in HDLC’den önceki senkron bit-yönelimli protokolü — istasyon adresleme ve primary/secondary poll/final sinyalizasyonu etrafında kurulu. Çerçeve şekli HDLC ile birebir aynı (`hdlcCore.ts` paylaşılır); yalnız Address alanı Station Address olarak yorumlanır.',
  'protocol.sdlc.error.emptyFrame': 'Boş çerçeve çözülemez.',
  'protocol.sdlc.error.noDelimiter': 'Arabellekte Flag (0x7E) baytı bulunamadı — çerçeve tamamlanmamış.',
  'protocol.sdlc.error.aborted': 'Çözümleme iptal edildi.',
  'protocol.sdlc.error.tooShort': 'İçerik Station Address+Control+FCS asgarisinden (4 bayt) kısa.',
  'protocol.sdlc.error.fcsMismatch': 'FCS uyuşmuyor — çerçeve iletim sırasında bozulmuş olabilir.',
  'protocol.sdlc.warning.trailingBytes':
    'Çerçeveden sonra artık bayt var — ayrı bir alanda gösterildi, henüz çözülmedi.',
  'protocol.sdlc.example.iFrame.name': 'I-frame (sıra numaralı veri)',
  'protocol.sdlc.example.iFrame.description':
    'N(S)=1, N(R)=2, P/F=0 taşıyan bir Information çerçevesi — FCS doğrulanır.',
  'protocol.sdlc.example.poll.name': 'Poll (yayın adresi, RR)',
  'protocol.sdlc.example.poll.description':
    'Station Address=0xFF (All-Stations), RR ve P/F=1 — bir primary istasyonun poll çağrısı örneği.',
  'protocol.sdlc.example.uFrame.name': 'U-frame (adlanmamış komut)',
  'protocol.sdlc.example.uFrame.description':
    'Unnumbered format — komut bitleri bu dalgada adlanmıyor (dosya başı disiplini), yalnız format + FCS gösterilir.',

  // --- XMODEM (framing motoruna uğramaz, xmodemCore.ts'in üstünde ince sarmal) ---
  'protocol.xmodem.documentation.summary':
    'Stop-and-wait seri dosya transferi — 128 ya da 1024 baytlık bloklar, blok numarası tümleyeni kontrolü, checksum (SUM-8) ya da CRC-16 (CRC16_XMODEM) modu, NAK ile yeniden gönderim. Framing motoruna hiç uğramaz — çerçeve sınırı Header baytının taşıdığı sabit veri uzunluğundan türetilir.',
  'protocol.xmodem.error.emptyFrame': 'Boş çerçeve çözülemez.',
  'protocol.xmodem.error.unknownHeader':
    'Bilinmeyen Header/kontrol baytı — SOH (0x01), STX (0x02) ya da tanınan bir kontrol baytı (EOT/ACK/NAK/CAN) değil.',
  'protocol.xmodem.error.badTrailerLength':
    'Çerçeve uzunluğu ne checksum (1 bayt) ne CRC (2 bayt) moduyla tutarlı.',
  'protocol.xmodem.error.aborted': 'Çözümleme iptal edildi.',
  'protocol.xmodem.error.complementMismatch': 'Blok numarası tümleyeni (~Block) uyuşmuyor.',
  'protocol.xmodem.error.checksumMismatch': 'Checksum uyuşmuyor — çerçeve iletim sırasında bozulmuş olabilir.',
  'protocol.xmodem.error.crcMismatch': 'CRC uyuşmuyor — çerçeve iletim sırasında bozulmuş olabilir.',
  'protocol.xmodem.example.checksumBlock.name': 'Checksum modu (128 bayt)',
  'protocol.xmodem.example.checksumBlock.description': 'Block 1, SUM-8 checksum ile — 128 baytlık standart blok.',
  'protocol.xmodem.example.crcBlock1k.name': 'CRC-16 modu, XMODEM-1K (1024 bayt)',
  'protocol.xmodem.example.crcBlock1k.description':
    'Block 2, CRC-16 (CRC16_XMODEM) ile — STX başlıklı 1024 baytlık genişletilmiş blok.',
  'protocol.xmodem.example.eot.name': 'EOT (aktarım sonu)',
  'protocol.xmodem.example.eot.description': 'Tek baytlık kontrol sinyali — gönderici aktarımın bittiğini bildirir.',

  // --- YMODEM (xmodemCore.ts'in AYNISI, Block 0 batch metadata olarak adlanır) ---
  'protocol.ymodem.documentation.summary':
    'XMODEM’in genişletilmiş hali — dosya adı/boyutunu taşıyan bir Block 0 metadata başlığı ekler, tek oturumda çoklu dosya (batch) transferine izin verir. Blok yapısı XMODEM ile birebir aynı (aynı çekirdek paylaşılır).',
  'protocol.ymodem.error.emptyFrame': 'Boş çerçeve çözülemez.',
  'protocol.ymodem.error.unknownHeader':
    'Bilinmeyen Header/kontrol baytı — SOH (0x01), STX (0x02) ya da tanınan bir kontrol baytı (EOT/ACK/NAK/CAN) değil.',
  'protocol.ymodem.error.badTrailerLength':
    'Çerçeve uzunluğu ne checksum (1 bayt) ne CRC (2 bayt) moduyla tutarlı.',
  'protocol.ymodem.error.aborted': 'Çözümleme iptal edildi.',
  'protocol.ymodem.error.complementMismatch': 'Blok numarası tümleyeni (~Block) uyuşmuyor.',
  'protocol.ymodem.error.checksumMismatch': 'Checksum uyuşmuyor — çerçeve iletim sırasında bozulmuş olabilir.',
  'protocol.ymodem.error.crcMismatch': 'CRC uyuşmuyor — çerçeve iletim sırasında bozulmuş olabilir.',
  'protocol.ymodem.example.blockZeroMetadata.name': 'Block 0 (dosya adı + boyutu)',
  'protocol.ymodem.example.blockZeroMetadata.description':
    'Batch’in ilk bloğu — dosya adı ve boyutu taşır, mtime/mode alanı bu dalgada çözülmez.',
  'protocol.ymodem.example.batchTerminator.name': 'Batch terminatörü (boş dosya adı)',
  'protocol.ymodem.example.batchTerminator.description':
    'Block 0, boş dosya adıyla — oturumda başka dosya kalmadığını bildirir.',
  'protocol.ymodem.example.dataBlock.name': 'Veri bloğu (XMODEM ile aynı)',
  'protocol.ymodem.example.dataBlock.description':
    'Block 1 — normal dosya içeriği, yapı XMODEM’in kendisiyle birebir aynı.',

  // --- ZMODEM (lrzsz profili — XMODEM/YMODEM'le wire seviyesinde ortak yanı yok) ---
  'protocol.zmodem.documentation.summary':
    'XMODEM/YMODEM’den tamamen farklı, streaming ve konum-tabanlı hata kurtarma sunan dosya transfer protokolü. ZRQINIT/ZRINIT/ZFILE/ZRPOS/ZDATA/ZEOF/ZFIN başlıklarını ZDLE kaçışıyla değişir. Kanonik tek tanımı yok — lrzsz (Forsberg) profili çözülür.',
  'protocol.zmodem.error.aborted': 'Çözümleme iptal edildi.',
  'protocol.zmodem.error.emptyFrame': 'Boş çerçeve çözülemez.',
  'protocol.zmodem.error.noZdle': 'ZPAD sonrası ZDLE (0x18) bulunamadı — header başlangıcı tanınmıyor.',
  'protocol.zmodem.error.unsupportedHeaderType':
    'RLE’li header varyantı (ZBINR32/ZVBIN/ZVHEX/ZVBIN32/ZVBINR32) — lrzsz’nin 1993 uzantısı, seçilen profilde desteklenmiyor.',
  'protocol.zmodem.error.unknownHeaderType': 'Bilinmeyen header-form baytı — ZBIN (A), ZHEX (B) ya da ZBIN32 (C) değil.',
  'protocol.zmodem.error.truncatedFrame': 'Çerçeve header/subpacket tamamlanmadan bitti.',
  'protocol.zmodem.error.invalidEscape': 'ZDLE sonrası tanınmayan bayt — geçerli bir kaçış ya da terminatör değil.',
  'protocol.zmodem.error.invalidHexDigit': 'HEX header’da geçersiz hane — yalnız küçük harf 0-9a-f kabul edilir.',
  'protocol.zmodem.error.unknownFrameType': 'Bilinmeyen frame type — ZRQINIT (0) ile ZSTDERR (19) arasında değil.',
  'protocol.zmodem.error.headerCrcMismatch': 'Header CRC uyuşmuyor — çerçeve iletim sırasında bozulmuş olabilir.',
  'protocol.zmodem.error.subpacketCrcMismatch': 'Subpacket CRC uyuşmuyor — veri iletim sırasında bozulmuş olabilir.',
  'protocol.zmodem.warning.incompleteSubpacket':
    'Subpacket terminatörü (ZCRCE/G/Q/W) ya da CRC’si bulunamadı — girdi kısmi yapıştırılmış olabilir.',
  'protocol.zmodem.example.zrqinitHex.name': 'ZRQINIT (HEX header)',
  'protocol.zmodem.example.zrqinitHex.description':
    'Oturum başlatma isteği, HEX formda — kaçış yok, insan-okunur ASCII hex.',
  'protocol.zmodem.example.zrinitBinary.name': 'ZRINIT (binary16, CANFDX+CANOVIO+CANFC32)',
  'protocol.zmodem.example.zrinitBinary.description':
    'Alıcı yeteneklerini bildirir — tam dupleks, örtüşen I/O, 32-bit CRC desteği bayrakları set.',
  'protocol.zmodem.example.zfileWithSubpacket.name': 'ZFILE + subpacket (dosya adı + boyutu)',
  'protocol.zmodem.example.zfileWithSubpacket.description':
    'Dosya transferi başlangıcı — subpacket içeriği YMODEM Block 0 ile aynı formatta (spec §13).',
  'protocol.zmodem.example.zdataBinary32.name': 'ZDATA (binary32, 32-bit CRC oturumu)',
  'protocol.zmodem.example.zdataBinary32.description':
    'Streaming veri çerçevesi — Position alanı 5.242.880, subpacket 32-bit CRC ile korunur.',

  // --- Custom Binary Protocol (4 "jenerik" sayfanın ilki — specFixture.ts aynen) ---
  'protocol.customBinaryProtocol.documentation.summary':
    'Üreticiye özel binary çerçeve formatı — header, address, command, length, payload ve CRC. Spec §8.3/§9.6/§43 arasında çapraz doğrulanmış ALP Sensor Protocol şeması kullanılır.',
  'protocol.customBinaryProtocol.example.sensorData.name': 'Sensor Data (spec §43 kabul çerçevesi)',
  'protocol.customBinaryProtocol.example.sensorData.description':
    'Address=5, Command=Sensor Data, Payload=34 12 7F, Checksum (XOR8) PASS.',
  'protocol.customBinaryProtocol.example.checksumMismatch.name': 'Bozuk checksum',
  'protocol.customBinaryProtocol.example.checksumMismatch.description':
    'Aynı çerçeve, yalnız checksum baytı bozuk (0x4F → 0x50) — DecodePanel.test.tsx ile aynı vektör.',

  // --- ASCII Protocol (4 "jenerik" sayfanın ikincisi) ---
  'protocol.asciiProtocol.documentation.summary':
    'İnsan-okunur, satır tabanlı seri protokol sınıfı — CR/LF sonlandırma ve komut/parametre ayrımı. Virgüllü sayısal alan parse\'ı motor seviyesinde desteklenmiyor, ham metin kalır.',
  'protocol.asciiProtocol.example.temperatureReading.name': 'Sıcaklık okuması (spec özeti satır 57)',
  'protocol.asciiProtocol.example.temperatureReading.description':
    '"TEMP,25.3,40.2\\r\\n" — command TEMP, parametreler ham metin, CRLF ayrı alanda.',
  'protocol.asciiProtocol.example.missingLineEnding.name': 'CRLF eksik',
  'protocol.asciiProtocol.example.missingLineEnding.description':
    'Aynı satır, sonlandırıcı KESİLMİŞ — spec özetinin "Missing CR/LF" durumunu gösterir.',

  // --- Delimiter-Based Protocol (4 "jenerik" sayfanın üçüncüsü — Faz 6'nın hdlc-flag motoru aynen) ---
  'protocol.delimiterBasedProtocol.documentation.summary':
    'STX/ETX gibi başlangıç-bitiş baytlarıyla çerçeveleme — asıl iş, delimiter değeri payload içinde de geçtiğinde (delimiter collision) escape mekanizmasını yönetmek. Faz 6\'nın hdlc-flag motoru (PPP\'nin de kullandığı) kullanılır.',
  'protocol.delimiterBasedProtocol.error.aborted': 'Çözümleme iptal edildi.',
  'protocol.delimiterBasedProtocol.error.incomplete': 'Çerçeve tamamlanmadı — kapanış bayrağı (0x7E) bulunamadı.',
  'protocol.delimiterBasedProtocol.example.collisionEscaped.name': 'Delimiter collision (kaçışlı)',
  'protocol.delimiterBasedProtocol.example.collisionEscaped.description':
    'Payload (01 7E 02) flag baytıyla çakışan bir 0x7E içeriyor — spec özetinin "Escape Örneği" (01 7E 02 → 01 7D 5E 02) ile birebir.',
  'protocol.delimiterBasedProtocol.example.missingEndFlag.name': 'Kapanış bayrağı eksik',
  'protocol.delimiterBasedProtocol.example.missingEndFlag.description':
    'Açılış bayrağı var, kapanış yok — akış ortasında kesilmiş çerçeveyi gösterir.',

  // --- Length-Based Protocol (4 "jenerik" sayfanın dördüncüsü) ---
  'protocol.lengthBasedProtocol.documentation.summary':
    'Çerçeve uzunluğu header içindeki bir alandan belirlenir — uzunluk semantiği, endianness ve azami çerçeve koruması. LENGTH (uint16 büyük-uçlu) + PAYLOAD + CHECKSUM (XOR8), bağımsız hesaplanmış fixture.',
  'protocol.lengthBasedProtocol.example.validFrame.name': 'Geçerli çerçeve',
  'protocol.lengthBasedProtocol.example.validFrame.description':
    'LENGTH=4 (büyük-uçlu) + PAYLOAD (AA BB CC DD) + CHECKSUM — bağımsız hesap: XOR8(AA,BB,CC,DD)=0x00.',
  'protocol.lengthBasedProtocol.example.oversizedLength.name': 'Uzunluk alanı tel içerikle tutarsız',
  'protocol.lengthBasedProtocol.example.oversizedLength.description':
    'LENGTH=1000 diyor ama tel yalnız 1 bayt payload taşıyor — "declared length exceeds available data" durumunu gösterir.',

  // --- LTE Modem AT (3GPP TS 27.007 hücresel sözlük, at-commands üstünde) ---
  'protocol.lteModemAt.documentation.summary':
    '3GPP TS 27.007 hücresel AT komut sözlüğü: CSQ/COPS/CREG/CEREG/CGATT/CGDCONT/CIMI/CGSN/CCLK/CPIN. Sebep kodu anlamı, model/firmware ve bant bu motorda YOK — kaynak komutları kapsamda değil.',
  'protocol.lteModemAt.warning.csqUnknown': 'Değer 99 — sinyal ölçülemedi ya da algılanamadı.',
  'protocol.lteModemAt.warning.accessTechnologyVendorCollision':
    'AcT değeri 8 ve üstü — satıcı firmware’leri bu aralıkta resmi TS 27.007 tablosuyla ÇAKIŞAN eklentiler kullanabilir (ör. SIMCom’da 8=CDMA/HDR, spec’te 8=EC-GSM-IoT). Emin olmak için cihazın kendi AT komut kılavuzuna bakın.',
  'protocol.lteModemAt.warning.pdpTypeObsolete':
    'Bu PDP türü güncel spec metninde "Obsolete" işaretli — hâlâ listeli ama yeni dağıtımlarda beklenmez.',
  'protocol.lteModemAt.warning.cgdcontTailNotDecoded':
    'İlk altı parametreden (cid..h_comp) sonrası satıcıya/sürüme göre değişir — sabit bir şema olarak çözülmedi, ham bırakıldı.',
  'protocol.lteModemAt.warning.cpinUnrecognizedCode':
    'TS 27.007’nin 16 kodluk listesinde yok — muhtemelen satıcıya özel bir durum kodu.',
  'protocol.lteModemAt.warning.bareIdentifierAmbiguous':
    'Öneksiz salt rakam dizisi: AT+CIMI (IMSI) ya da çıplak AT+CGSN (IMEI/seri no) yanıtı olabilir — hangisi olduğu tek satırdan AYIRT EDİLEMEZ, gönderilen komutu bilen oturum bağlamı gerekir.',
  'protocol.lteModemAt.warning.sensitiveExportValue':
    'Bu değer bir cihaz/abone kimliğidir — dışa aktarırken maskelenmesi önerilir.',
  'protocol.lteModemAt.example.csq.name': 'Sinyal kalitesi (CSQ)',
  'protocol.lteModemAt.example.csq.description':
    'RSSI dBm’e çevrilir; BER ordinal sınıf olarak kalır, yüzdeye çevrilmez (satıcılar arası tablo çelişkisi).',
  'protocol.lteModemAt.example.copsAlphanumeric.name': 'Operatör bilgisi (alfanumerik)',
  'protocol.lteModemAt.example.copsAlphanumeric.description':
    'Uzun alfanumerik biçimde operatör adı; erişim teknolojisi E-UTRAN olarak çözülür.',
  'protocol.lteModemAt.example.copsNumericActCollision.name': 'Operatör bilgisi (numeric, AcT çakışma uyarısı)',
  'protocol.lteModemAt.example.copsNumericActCollision.description':
    'MCC/MNC ayrıştırması ve AcT=8’in satıcı çakışma uyarısı — MCC 901 gerçek bir ülkeye atanmamış, gösterim amaçlı.',
  'protocol.lteModemAt.example.cregRegistered.name': 'Kayıt durumu (CREG, ev şebekesi)',
  'protocol.lteModemAt.example.cregRegistered.description':
    'LAC ve hücre kimliği hex’ten ondalığa çevrilir; erişim teknolojisi E-UTRAN.',
  'protocol.lteModemAt.example.ceregEmergency.name': 'LTE kayıt durumu (CEREG, yalnız acil çağrı)',
  'protocol.lteModemAt.example.ceregEmergency.description':
    'Alan adı TAC olur (CREG’in LAC’ından farklı); AcT=9 NB-IoT’ye işaret eder.',
  'protocol.lteModemAt.example.cgattAttached.name': 'PS bağlanma durumu (CGATT)',
  'protocol.lteModemAt.example.cgattAttached.description': 'Basit ikili durum — bağlı/bağlı değil.',
  'protocol.lteModemAt.example.cgdcontFull.name': 'PDP bağlamı (CGDCONT)',
  'protocol.lteModemAt.example.cgdcontFull.description':
    'Altı sabit alan çözülür; boş PDP adresi alan hiç üretmeden atlanır (satıcılar arası çelişkili davranış).',
  'protocol.lteModemAt.example.cimiBare.name': 'IMSI sorgusu (CIMI, öneksiz)',
  'protocol.lteModemAt.example.cimiBare.description':
    'Quectel EC25/EC21 kılavuzunun kendi doğrulama örneği — öneksiz salt rakam, CGSN’in bare formundan AYIRT EDİLEMEZ.',
  'protocol.lteModemAt.example.cgsnBare.name': 'Seri numarası (CGSN, öneksiz)',
  'protocol.lteModemAt.example.cgsnBare.description':
    '3GPP TS 27.007’nin kendi §5.4 örneği — öneksiz salt rakam, CIMI’den AYIRT EDİLEMEZ.',
  'protocol.lteModemAt.example.cgsnPrefixed.name': 'Seri numarası (CGSN=1, KESİN IMEI)',
  'protocol.lteModemAt.example.cgsnPrefixed.description':
    'Prefiksli form — belirsizlik yok, doğrudan IMEI olarak çözülür ve hassas-veri uyarısı taşır.',
  'protocol.lteModemAt.example.cclk.name': 'Gerçek zamanlı saat (CCLK)',
  'protocol.lteModemAt.example.cclk.description':
    'Saat dilimi ÇEYREK SAAT biriminde — "+08" dört değil iki saat demektir (spec’in kendi örneğiyle doğrulandı).',
  'protocol.lteModemAt.example.cpinReady.name': 'SIM durumu (hazır)',
  'protocol.lteModemAt.example.cpinReady.description': 'PIN istenmiyor, SIM kullanıma hazır.',
  'protocol.lteModemAt.example.cpinLocked.name': 'SIM durumu (PIN bekleniyor)',
  'protocol.lteModemAt.example.cpinLocked.description': '16 kodluk standart listeden bilinen bir durum.',
  'protocol.lteModemAt.example.finalOk.name': 'OK',
  'protocol.lteModemAt.example.finalOk.description':
    'at-commands’tan aynen devralınan final result code — bu sayfada da tutarlı görünür.',

  // --- Cellular Initialization Dashboard (karar 6'yla aynı sınıf iş, dalga 9) ---
  'cellularDashboard.heading': 'Cellular Initialization Dashboard',
  'cellularDashboard.sessionInput.label': 'AT oturumu (çok satırlı — komut ve yanıt satırları)',
  'cellularDashboard.linesProcessed': '{count} satır tanındı',
  'cellularDashboard.empty': 'Girdiden tanınan bir hücresel durum alanı çıkmadı.',
  'cellularDashboard.field.imei': 'IMEI',
  'cellularDashboard.field.numericIdentifierCandidate': 'Sayısal kimlik (IMSI/IMEI belirsiz)',
  'cellularDashboard.field.simStatus': 'SIM durumu',
  'cellularDashboard.field.operatorName': 'Operatör',
  'cellularDashboard.field.operatorSelectionMode': 'Operatör seçim modu',
  'cellularDashboard.field.accessTechnology': 'Erişim teknolojisi (RAT)',
  'cellularDashboard.field.registrationStatus': 'Kayıt durumu',
  'cellularDashboard.field.pdpAddress': 'PDP / IP adresi',

  // --- NB-IoT (lte-modem-at üstünde: AcT=9 tespiti + PSM/eDRX zamanlayıcı) ---
  'protocol.nbIot.documentation.summary':
    'lte-modem-at üstünde NB-IoT yorumlama katmanı: AcT=9 tespiti, PSM (AT+CPSMS, T3412/T3324) ve eDRX (AT+CEDRXS/CEDRXRDP/CEDRXP, yalnız NB-S1 modu) zamanlayıcı çözümü.',
  'protocol.nbIot.warning.accessTechnologyNotNbIot':
    'Erişim teknolojisi AcT=9 (E-UTRAN NB-S1 mode) DEĞİL — bu satır NB-IoT bağlamını göstermiyor olabilir.',
  'protocol.nbIot.warning.timerMalformed':
    'Sekiz haneli ikili dize bekleniyordu, değer bu biçime uymuyor — birim/değer ayrıştırılamadı, ham bırakıldı.',
  'protocol.nbIot.warning.timerUnitReserved':
    'Bu birim kodu TS 24.008 tablosunda tanımlı değil (rezerve) — saniyeye çevrilmedi, ham değer taşınır.',
  'protocol.nbIot.warning.edrxMalformed':
    'Dört haneli ikili dize bekleniyordu, değer bu biçime uymuyor — döngü uzunluğu ayrıştırılamadı, ham bırakıldı.',
  'protocol.nbIot.warning.edrxCodeReserved':
    'Bu eDRX kodu TS 24.008 tablosunda tanımlı değil (rezerve) — saniyeye çevrilmedi, ham değer taşınır.',
  'protocol.nbIot.warning.edrxNotNbS1':
    'Bu değer NB-S1 modu (AcT_type=5) dışında bir erişim teknolojisi için geldi — o modun eDRX tablosu bu motorda doğrulanmadı, saniyeye çevrilmedi.',
  'protocol.nbIot.example.ceregNbIot.name': 'NB-IoT kayıt durumu (CEREG, AcT=9)',
  'protocol.nbIot.example.ceregNbIot.description':
    'Erişim teknolojisi E-UTRAN (NB-S1 mode) — NB-IoT eşleşmesi doğrulanır, uyarı taşımaz.',
  'protocol.nbIot.example.ceregNotNbIot.name': 'NB-IoT olmayan kayıt durumu (CEREG, AcT=7)',
  'protocol.nbIot.example.ceregNotNbIot.description':
    'Aynı CEREG yanıtı ama AcT=7 (düz E-UTRAN) — eşleşme alanı "NB-IoT değil" uyarısı taşır.',
  'protocol.nbIot.example.cpsmsEnabled.name': 'PSM etkin (CPSMS, T3412=40dk, T3324=30sn)',
  'protocol.nbIot.example.cpsmsEnabled.description':
    'Quectel BG96 kılavuzunun kendi örneği — periyodik TAU ve aktif zamanlayıcı FARKLI birim tablolarından (GPRS Timer 3 / GPRS Timer 2) saniyeye çevrilir.',
  'protocol.nbIot.example.cpsmsDeactivated.name': 'PSM zamanlayıcıları devre dışı (CPSMS)',
  'protocol.nbIot.example.cpsmsDeactivated.description':
    'Birim biti 111 — her iki zamanlayıcı da "deactivated", saniye üretilmez.',
  'protocol.nbIot.example.cedrxsNbS1.name': 'eDRX döngüsü (CEDRXS, NB-S1)',
  'protocol.nbIot.example.cedrxsNbS1.description': 'AcT_type=5 (NB-S1) — döngü kodu 40.96 saniyeye çevrilir.',
  'protocol.nbIot.example.cedrxsWbS1Unsupported.name': 'eDRX döngüsü (CEDRXS, WB-S1 — çözülmedi)',
  'protocol.nbIot.example.cedrxsWbS1Unsupported.description':
    'AcT_type=4 (WB-S1/LTE-M) — bu motorda doğrulanmış tablo yok, ham değer + uyarı.',
  'protocol.nbIot.example.cedrxrdpFull.name': 'eDRX dinamik parametreleri (CEDRXRDP)',
  'protocol.nbIot.example.cedrxrdpFull.description':
    'u-blox SARA-N2/N3 kılavuzunun kendi örneği — istenen ve atanan döngü çözülür, Paging Time Window ham kalır (doğrulanmadı).',
  'protocol.nbIot.example.cedrxpUrc.name': 'eDRX parametreleri (CEDRXP URC)',
  'protocol.nbIot.example.cedrxpUrc.description':
    'CEDRXRDP ile aynı dört alanı taşıyan istemsiz sonuç kodu — aynı çözücüyü kullanır.',
  'protocol.nbIot.example.finalOk.name': 'OK',
  'protocol.nbIot.example.finalOk.description':
    'lte-modem-at/at-commands’tan aynen devralınan final result code — bu sayfada da tutarlı görünür.',

  // --- GNSS Modem (lte-modem-at + nmea-0183 üstünde: QGPSGNMEA devri + QGPSLOC dar decode) ---
  'protocol.gnssModem.documentation.summary':
    'lte-modem-at ve nmea-0183 üstünde GNSS-üzerinden-AT yorumlama katmanı: AT+QGPSGNMEA yanıtındaki ham NMEA cümlesi nmea-0183 motoruna devredilir (motor tekrar yazılmaz), AT+QGPSLOC dar bir alan kümesiyle (fix/lat/lon/alt/sat/hdop) çözülür.',
  'protocol.gnssModem.warning.fixTypeUnrecognized':
    'Bu değer Quectel’in AT+QGPSLOC tablosunda tanımlı değil (yalnız 2=2D, 3=3D belgeli) — konumlama modu uydurulmadı.',
  'protocol.gnssModem.warning.qgpslocCoordinateUnrecognized':
    'Beklenen iki biçimden (harf sonekli ddmm.mmmm ya da imzalı ondalık derece) hiçbirine uymuyor — ondalık dereceye çevrilmedi, ham değer taşınır.',
  'protocol.gnssModem.warning.embeddedNmeaUnparseable':
    'AT+QGPSGNMEA yanıtının içindeki metin bir NMEA cümlesi olarak çözülemedi — AT katmanı alanları yine de gösterilir.',
  'protocol.gnssModem.example.qgpslocTwoDFix.name': 'Konum bilgisi, 2D fix (QGPSLOC)',
  'protocol.gnssModem.example.qgpslocTwoDFix.description':
    'Quectel kılavuzunun kendi örneği — enlem/boylam ondalık dereceye, HDOP/rakım/uydu sayısı sayıya çevrilir.',
  'protocol.gnssModem.example.qgpslocUnrecognizedFix.name': 'Tanınmayan konumlama modu (QGPSLOC, fix=1)',
  'protocol.gnssModem.example.qgpslocUnrecognizedFix.description':
    'Aynı fixture, <fix>=1 — Quectel’in kendi tablosu yalnız 2/3 tanımlıyor, uyarı basılır.',
  'protocol.gnssModem.example.qgpsgnmeaGga.name': 'GGA cümlesi (QGPSGNMEA)',
  'protocol.gnssModem.example.qgpsgnmeaGga.description':
    'Quectel’in <nmeasrc> örneği — gömülü GGA cümlesi nmea-0183 motoruyla tam olarak çözülür.',
  'protocol.gnssModem.example.qgpsgnmeaRmc.name': 'RMC cümlesi (QGPSGNMEA)',
  'protocol.gnssModem.example.qgpsgnmeaRmc.description':
    'nmea-0183’ün kendi doğrulanmış RMC fixture’ı — farklı cümle tipinin de aynı yoldan geçtiğini gösterir.',
  'protocol.gnssModem.example.qgpsgnmeaMalformed.name': 'Bozuk gömülü cümle (QGPSGNMEA)',
  'protocol.gnssModem.example.qgpsgnmeaMalformed.description':
    'İçerik bir NMEA cümlesi değil — pozisyon alanı üretilmez, AT katmanı alanları yine de görünür.',
  'protocol.gnssModem.example.finalOk.name': 'OK',
  'protocol.gnssModem.example.finalOk.description':
    'lte-modem-at/at-commands’tan aynen devralınan final result code — bu sayfada da tutarlı görünür.',

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

  // --- DroneCAN ---
  'protocol.dronecan.error.frameTooShort':
    'Kayıt identifier ve uzunluk alanlarını taşıyacak kadar uzun değil.',
  'protocol.dronecan.error.frameTooLong': 'Kayıt sabit çerçeve boyunu aşıyor.',
  'protocol.dronecan.error.canFdNotSupported':
    'DroneCAN v0 yalnız CAN 2.0B kullanır; CAN FD çerçevesi desteklenmiyor.',
  'protocol.dronecan.error.notExtended':
    'DroneCAN 29-bit extended identifier gerektirir; 11-bit çerçeve DroneCAN olamaz.',
  'protocol.dronecan.error.tailByteMissing':
    'Veri alanı boş: tail byte yok, transfer türü ve Transfer ID çözülemez.',
  'protocol.dronecan.error.aborted': 'Çözümleme iptal edildi.',
  'protocol.dronecan.warning.dsdlRequiredForPayload':
    'Veri alanı ham gösteriliyor: alan yerleşimi DSDL tanımından gelir, bu araçta DSDL derleyicisi yok.',
  'protocol.dronecan.warning.transferCrcNeedsDataTypeSignature':
    'Transfer CRC gösterildi ama doğrulanmadı: girdisi data type signature içerir, bu DSDL tanımından gelir ve burada yok.',
  'protocol.dronecan.warning.remoteFrame':
    'Remote bayrağı set; DroneCAN remote çerçeve tanımlamaz.',
  'protocol.dronecan.warning.truncatedPayload':
    'Bildirilen uzunluktaki bayt kayıtta yok; elde olan baytlar gösterildi.',
  'protocol.dronecan.warning.unexpectedToggleOnSingleFrame':
    'Single-frame transferde Toggle biti her zaman 0 olmalı; bu çerçevede farklı.',
  'protocol.dronecan.summary.notExtended': 'Geçersiz DroneCAN çerçevesi (29-bit gerekli)',
  'protocol.dronecan.summary.messageBroadcast':
    '{frameRole} mesaj yayını — tip {messageTypeId}, kaynak düğüm {sourceNodeId}',
  'protocol.dronecan.summary.anonymousMessage':
    '{frameRole} anonim mesaj — discriminator {discriminator}',
  'protocol.dronecan.summary.serviceRequest':
    '{frameRole} servis isteği — servis {serviceTypeId}, düğüm {sourceNodeId} → düğüm {destinationNodeId}',
  'protocol.dronecan.summary.serviceResponse':
    '{frameRole} servis yanıtı — servis {serviceTypeId}, düğüm {sourceNodeId} → düğüm {destinationNodeId}',
  'protocol.dronecan.documentation.summary':
    '29-bit CAN identifier’ını Priority/Message Type ID/Source Node ID (ya da Service Type ID/Destination Node ID) alanlarına ayıran, tail byte’tan SOT/EOT/Toggle/Transfer ID çözen masterless UAV ağ protokolü. Transfer CRC yalnız multi-frame transferde vardır ve data type signature (DSDL) olmadan doğrulanamaz; payload bu yüzden ham kalır.',
  'protocol.dronecan.example.messageBroadcastSingleFrame.name': 'Mesaj yayını (tek çerçeve)',
  'protocol.dronecan.example.messageBroadcastSingleFrame.description':
    'Priority 20, Message Type ID 1000, Source Node 42; tail byte spec örneği 0xC5 (SOT=1, EOT=1, Toggle=0, Transfer ID=5).',
  'protocol.dronecan.example.anonymousMessageSingleFrame.name': 'Anonim mesaj (tek çerçeve)',
  'protocol.dronecan.example.anonymousMessageSingleFrame.description':
    'Source Node ID her zaman 0 — düğüm henüz node ID almamış (dynamic node ID allocation senaryosu).',
  'protocol.dronecan.example.serviceRequestSingleFrame.name': 'Servis isteği (tek çerçeve)',
  'protocol.dronecan.example.serviceRequestSingleFrame.description':
    'Request-Not-Response=1: istemci düğüm 10’dan sunucu düğüm 42’ye servis isteği.',
  'protocol.dronecan.example.serviceResponseSingleFrame.name': 'Servis yanıtı (tek çerçeve)',
  'protocol.dronecan.example.serviceResponseSingleFrame.description':
    'Request-Not-Response=0: sunucu düğüm 10’dan istemci düğüm 42’ye servis yanıtı.',
  'protocol.dronecan.example.multiFrameFirst.name': 'Çok çerçeveli transfer — ilk çerçeve',
  'protocol.dronecan.example.multiFrameFirst.description':
    'İlk iki bayt transfer CRC’dir: gösterilir ama data type signature olmadan DOĞRULANMAZ.',
  'protocol.dronecan.example.multiFrameMiddle.name': 'Çok çerçeveli transfer — ara çerçeve',
  'protocol.dronecan.example.multiFrameMiddle.description':
    'SOT=0, EOT=0; Toggle bir önceki çerçeveye göre alternates eder (parser çerçeveler arası izlemez).',
  'protocol.dronecan.example.multiFrameLast.name': 'Çok çerçeveli transfer — son çerçeve',
  'protocol.dronecan.example.multiFrameLast.description':
    'EOT=1: transferin son çerçevesi, transfer CRC bu çerçevede DEĞİL ilk çerçevededir.',
  'protocol.dronecan.example.notExtendedRejected.name': 'Extended olmayan çerçeve (ret yolu)',
  'protocol.dronecan.example.notExtendedRejected.description':
    '11-bit (base) identifier: DroneCAN 29-bit zorunlu kılar, çerçeve yine gösterilir ama hata basılır.',

  // --- Cyphal (UAVCAN v1) — Cyphal/CAN, yalnız Classic CAN ---
  'protocol.cyphal.error.frameTooShort':
    'Kayıt identifier ve uzunluk alanlarını taşıyacak kadar uzun değil.',
  'protocol.cyphal.error.frameTooLong': 'Kayıt sabit çerçeve boyunu aşıyor.',
  'protocol.cyphal.error.canFdNotSupported':
    'CAN FD kapsam dışı: FD çerçevelerinde dolgu baytları transfer CRC’sinin içindedir, bu yüzden bir FD çerçevesi Classic CAN gibi çözülemez. Burada yalnız Classic CAN 2.0B üzerinden Cyphal/CAN çözülür.',
  'protocol.cyphal.error.notExtended':
    'Cyphal/CAN taşıma çerçeveleri CAN 2.0B çerçeveleridir; 11-bit çerçeve Cyphal olamaz.',
  'protocol.cyphal.error.tailByteMissing':
    'Veri alanı boş: bir baytdan az veri taşıyan CAN çerçevesi geçerli bir Cyphal/CAN çerçevesi değildir.',
  'protocol.cyphal.error.reservedBit23NotZero':
    'Ayrılmış bit 23 sıfır olmak zorunda; spec bu biti set eden çerçevenin atılmasını istiyor.',
  'protocol.cyphal.error.v11RequiresOptIn':
    'Ayrılmış bit 7 set: bu, deneysel v1.1’in 16-bit subject-ID düzeni ve v1.0 bunun atılmasını istiyor. Çözmek için sürüm seçeneğini v1.1 yapın.',
  'protocol.cyphal.error.aborted': 'Çözümleme iptal edildi.',
  'protocol.cyphal.warning.dsdlRequiredForPayload':
    'Veri alanı ham gösteriliyor: alan yerleşimi DSDL tanımından gelir, bu araçta DSDL derleyicisi yok.',
  'protocol.cyphal.warning.transferCrcNeedsFullTransfer':
    'Transfer CRC gösterildi ama doğrulanmadı: transferdeki tüm çerçevelerin payload’ını ve dolgu baytlarını kapsar, tek çerçeveden doğrulanamaz.',
  'protocol.cyphal.warning.transferCrcSplitAcrossFrames':
    'Transfer CRC’nin yalnız bir kısmı bu çerçevede; kalan bayt bir önceki çerçevededir.',
  'protocol.cyphal.warning.experimentalSpecVersion':
    'v1.1 sürümü deneyseldir: 16-bit subject-ID düzeni stable v1.0 spec’inin parçası değildir.',
  'protocol.cyphal.warning.remoteFrame':
    'Remote bayrağı set; Cyphal/CAN remote çerçeve tanımlamaz.',
  'protocol.cyphal.warning.truncatedPayload':
    'Bildirilen uzunluktaki bayt kayıtta yok; elde olan baytlar gösterildi.',
  'protocol.cyphal.warning.toggleLooksLikeDroneCan':
    'Transferin ilk çerçevesinde Toggle 0; Cyphal her zaman 1’den başlar, bu yüzden çerçeve DroneCAN (UAVCAN v0) görünüyor. Sınıflandırmak için UAVCAN Compatibility sayfasını kullanın.',
  'protocol.cyphal.warning.nonLastFrameNotFullMtu':
    'Çok çerçeveli transferin son olmayan her çerçevesi veri alanını tamamen doldurmalıdır (Classic CAN’de DLC 8).',
  'protocol.cyphal.warning.anonymousMustBeSingleFrame':
    'Anonim transfer yalnız tek çerçeveli olabilir; çok çerçeveli anonim transfer yasaktır.',
  'protocol.cyphal.warning.selfAddressedService':
    'Kaynak ve hedef node-ID aynı; kendine adreslenen servis transferi yasaktır.',
  'protocol.cyphal.option.transport': 'Taşıyıcı',
  'protocol.cyphal.option.transport.description':
    'Yalnız Classic CAN 2.0B üzerinden Cyphal/CAN çözülür. Cyphal/UDP, Cyphal/serial ve CAN FD bilinçli olarak kapsam dışıdır — bunlar bu biçimin daha uzun hâlleri değil, ayrı tel biçimleridir.',
  'protocol.cyphal.option.transport.can': 'Cyphal/CAN (Classic CAN 2.0B)',
  'protocol.cyphal.option.specVersion': 'Spec sürümü',
  'protocol.cyphal.option.specVersion.description':
    'v1.0 stable varsayılandır ve ayrılmış bit 7’nin sıfır olmasını ister. v1.1 deneyseldir ve bit 7’yi 16-bit subject-ID için bir sürüm ayırıcısı olarak yeniden yorumlar; bu yüzden yalnız açık opt-in ile geçerlidir.',
  'protocol.cyphal.option.specVersion.v10': 'v1.0 (stable)',
  'protocol.cyphal.option.specVersion.v11': 'v1.1 (deneysel)',
  'protocol.cyphal.summary.notExtended': 'Geçersiz Cyphal/CAN çerçevesi (29-bit gerekli)',
  'protocol.cyphal.summary.message':
    '{frameRole} mesaj — subject {subjectId}, kaynak düğüm {sourceNodeId}',
  'protocol.cyphal.summary.anonymousMessage':
    '{frameRole} anonim mesaj — subject {subjectId}, pseudo-ID {sourceNodeId}',
  'protocol.cyphal.summary.serviceRequest':
    '{frameRole} servis isteği — servis {serviceId}, düğüm {sourceNodeId} → düğüm {destinationNodeId}',
  'protocol.cyphal.summary.serviceResponse':
    '{frameRole} servis yanıtı — servis {serviceId}, düğüm {sourceNodeId} → düğüm {destinationNodeId}',
  'protocol.cyphal.documentation.summary':
    'Classic CAN 2.0B üzerinden Cyphal/CAN: 29-bit identifier Priority/Service-not-message/Anonymous/Subject-ID/Source node-ID (ya da Service-ID/Destination node-ID) alanlarına ayrılır, tail byte’tan Start-of-transfer, End-of-transfer, Toggle ve modulo-32 Transfer-ID çözülür. ÇÖZÜLEN: mesaj, servis isteği ve servis yanıtı çerçeveleri, dört çerçeve rolü ve transfer CRC’sinin yeri. ÇÖZÜLMEYEN (bilinçli kapsam): Cyphal/UDP, Cyphal/serial ve CAN FD kapsam dışıdır ve açıkça reddedilir; DSDL derlenmediği için payload alanları ham kalır; transfer CRC’si transferin tüm çerçevelerini kapsadığı için gösterilir ama doğrulanmaz. Spec sürümü varsayılan v1.0’dır, v1.1 deneysel opt-in’dir.',
  'protocol.cyphal.example.heartbeatMessage.name': 'Heartbeat mesajı (tek çerçeve)',
  'protocol.cyphal.example.heartbeatMessage.description':
    'Spec örneği 0x107D552A: nominal öncelik, subject-ID 7509 (Heartbeat), kaynak düğüm 42; tail byte 0xE0 = SOT=1, EOT=1, Toggle=1, Transfer-ID=0.',
  'protocol.cyphal.example.anonymousMessage.name': 'Anonim mesaj (tek çerçeve)',
  'protocol.cyphal.example.anonymousMessage.description':
    'Spec örneğinin identifier’ı 0x11133775: anonymous biti (24) set, subject-ID 4919, kaynak alanı bir pseudo-ID taşıyor. Ayrılmış bit 22 ve 21 burada sıfır — alımda hiç denetlenmemelerinin sebebi budur. Payload Classic CAN’e sığsın diye kısaltıldı; spec’teki asıl örnek bir CAN FD çerçevesidir.',
  'protocol.cyphal.example.serviceRequest.name': 'Servis isteği (tek çerçeve)',
  'protocol.cyphal.example.serviceRequest.description':
    'Spec örneği 0x136B957B: uavcan.node.GetInfo (service-ID 430) isteği, düğüm 123’ten düğüm 42’ye, payload yok — yalnız tail byte 0xE1.',
  'protocol.cyphal.example.serviceResponseFirst.name': 'Servis yanıtı — ilk çerçeve',
  'protocol.cyphal.example.serviceResponseFirst.description':
    'Spec örneği 0x126BBDAA: çok çerçeveli yanıtın ilk çerçevesi, tail byte 0xA1 = SOT=1, EOT=0, Toggle=1. Son olmayan her çerçevede gerektiği gibi veri alanı tamamen dolu.',
  'protocol.cyphal.example.serviceResponseMiddle.name': 'Servis yanıtı — ara çerçeve',
  'protocol.cyphal.example.serviceResponseMiddle.description':
    'Aynı transfer, tail byte 0x01 = SOT=0, EOT=0, Toggle=0. Parser çerçeveyi yalnız sınıflar; toggle sırasını çerçeveler arasında hiç izlemez.',
  'protocol.cyphal.example.serviceResponseLast.name': 'Servis yanıtı — son çerçeve',
  'protocol.cyphal.example.serviceResponseLast.description':
    'Spec örneği: E7 61 verisi transfer CRC’si 0x9AE7’nin yalnız düşük baytını taşır, yüksek bayt bir önceki çerçevede gönderilmiştir — bölünmüş CRC vakası.',
  'protocol.cyphal.example.v11ExperimentalMessage.name': 'v1.1 16-bit subject-ID (deneysel)',
  'protocol.cyphal.example.v11ExperimentalMessage.description':
    'Ayrılmış bit 7 set; v1.0 bunun atılmasını istiyor, bu yüzden varsayılanda hata basılır. Sürüm seçeneğini v1.1 yapınca çerçeve 16-bit subject-ID’li mesaj olarak çözülür ve deneysel uyarı basılır.',
  'protocol.cyphal.example.droneCanToggleRejected.name':
    'İlk çerçevede Toggle=0 (DroneCAN imzası)',
  'protocol.cyphal.example.droneCanToggleRejected.description':
    'Aynı Heartbeat kimliği ama tail byte 0xC0: transferin ilk çerçevesinde Toggle 0. Cyphal her zaman 1’den başlar, yani bu DroneCAN imzasıdır — çerçeve yine çözülür, uyarı UAVCAN Compatibility sayfasına yönlendirir.',
  'protocol.cyphal.example.canFdRejected.name': 'CAN FD çerçevesi (ret yolu)',
  'protocol.cyphal.example.canFdRejected.description':
    'CAN FD kapsam dışıdır ve açıkça reddedilir: FD dolgu baytları transfer CRC’sinin içindedir, yani bir FD çerçevesi yalnızca daha uzun bir Classic çerçevesi değildir.',
  'protocol.cyphal.example.notExtendedRejected.name': 'Extended olmayan çerçeve (ret yolu)',
  'protocol.cyphal.example.notExtendedRejected.description':
    '11-bit (base) identifier: Cyphal/CAN 29-bit zorunlu kılar, çerçeve yine gösterilir ama hata basılır.',

  // --- UAVCAN Compatibility — sınıflandırıcı, tel protokolü değil ---
  'protocol.uavcanCompatibility.error.frameTooShort':
    'Kayıt identifier ve uzunluk alanlarını taşıyacak kadar uzun değil.',
  'protocol.uavcanCompatibility.error.frameTooLong': 'Kayıt sabit çerçeve boyunu aşıyor.',
  'protocol.uavcanCompatibility.error.canFdNotSupported':
    'Bu aracın kapsamında iki hat da CAN FD tanımlamıyor, bu yüzden FD çerçevesi sınıflandırılamaz.',
  'protocol.uavcanCompatibility.error.notExtended':
    'İki hat da 29-bit extended identifier istiyor; 11-bit çerçeve ne DroneCAN ne Cyphal olabilir.',
  'protocol.uavcanCompatibility.error.tailByteMissing':
    'Veri alanı boş: tail byte olmadan sınıflandırmaya dayanak bir kanıt yok.',
  'protocol.uavcanCompatibility.error.aborted': 'Sınıflandırma iptal edildi.',
  'protocol.uavcanCompatibility.warning.classifierDoesNotDecode':
    'Bu sayfa çözmez, sınıflandırır: burada protokol alanı, CRC ya da payload yorumu üretilmez.',
  'protocol.uavcanCompatibility.warning.selectDroneCanPage':
    'Kanıtlar DroneCAN (UAVCAN v0) gösteriyor. Çerçeveyi DroneCAN sayfasında çözün.',
  'protocol.uavcanCompatibility.warning.selectCyphalPage':
    'Kanıtlar Cyphal (UAVCAN v1) gösteriyor. Çerçeveyi Cyphal sayfasında çözün.',
  'protocol.uavcanCompatibility.warning.ambiguousUserMustChoose':
    'Çerçeve iki düzene de uyuyor: devam çerçevesi sürüm kanıtı taşımaz, çünkü toggle biti yalnız transferin ilk çerçevesinde ayırt edicidir. Hattı açıkça seçmelisiniz — belirsiz “UAVCAN” seçimi kabul edilmez.',
  'protocol.uavcanCompatibility.warning.noCandidate':
    'Çerçeve iki hattın da yapısal bir kuralını çiğniyor; ne DroneCAN ne Cyphal aday.',
  'protocol.uavcanCompatibility.warning.notInAutoDetection':
    'Bu kayıt otomatik algılamada hiç önerilmez: kendi tel biçimi yoktur, bilerek seçilmesi gerekir.',
  'protocol.uavcanCompatibility.summary.notExtended':
    'Sınıflandırılamaz (29-bit extended identifier gerekli)',
  'protocol.uavcanCompatibility.summary.dronecan':
    'DroneCAN / UAVCAN v0 adayı — güven {confidence} ({reason})',
  'protocol.uavcanCompatibility.summary.cyphal':
    'Cyphal / UAVCAN v1 adayı — güven {confidence} ({reason})',
  'protocol.uavcanCompatibility.summary.ambiguous':
    'Belirsiz — iki düzene de uyuyor, hattı siz seçmelisiniz',
  'protocol.uavcanCompatibility.summary.none': 'Aday yok — hiçbir düzene uymuyor',
  'protocol.uavcanCompatibility.documentation.summary':
    'Tel protokolü değil, bir ayrıştırma katmanı: ham 29-bit CAN çerçevesini alır ve DroneCAN (UAVCAN v0) mı Cyphal (UAVCAN v1) mi göründüğünü raporlar, sonra onu gerçekten çözen kayda yönlendirir. Belirleyici kanıt, transferin ilk çerçevesindeki toggle bitidir — v0 0’dan, v1 1’den başlar — ve her iki düzenin yapısal kurallarıyla desteklenir. Alan çözmez, CRC hesaplamaz, payload’a dokunmaz; iki gerçek parser’ın çerçevesini çalmasın diye otomatik algılamanın dışında bırakılmıştır.',
  'protocol.uavcanCompatibility.example.cyphalStartOfTransfer.name':
    'Cyphal ilk çerçevesi (Toggle=1)',
  'protocol.uavcanCompatibility.example.cyphalStartOfTransfer.description':
    'Cyphal spec’inin Heartbeat çerçevesi: tail byte 0xE0 transferin ilk çerçevesinde toggle’ı set eder, bu da DroneCAN’i doğrudan dışlar.',
  'protocol.uavcanCompatibility.example.droneCanStartOfTransfer.name':
    'DroneCAN ilk çerçevesi (Toggle=0)',
  'protocol.uavcanCompatibility.example.droneCanStartOfTransfer.description':
    'Spec tail byte örneği 0xC5 ile bir DroneCAN mesaj yayını: transferin ilk çerçevesinde toggle sıfır, bu da Cyphal’i doğrudan dışlar.',
  'protocol.uavcanCompatibility.example.ambiguousContinuation.name':
    'Devam çerçevesi (belirsiz)',
  'protocol.uavcanCompatibility.example.ambiguousContinuation.description':
    'Çok çerçeveli bir transferin son çerçevesi. Start-of-transfer sıfır olduğu için toggle biti sürüm bilgisi taşımaz ve iki düzen de mümkün kalır — hattı kullanıcı seçmelidir.',
  'protocol.uavcanCompatibility.example.noCandidate.name': 'Hiçbir düzen (aday yok)',
  'protocol.uavcanCompatibility.example.noCandidate.description':
    'Transferin ilk çerçevesinde toggle set — bu DroneCAN’i dışlar; ayrılmış bit 23 de set — Cyphal spec’i bunun atılmasını ister. Geriye bir şey kalmıyor.',
  'protocol.uavcanCompatibility.example.notExtendedRejected.name':
    'Extended olmayan çerçeve (ret yolu)',
  'protocol.uavcanCompatibility.example.notExtendedRejected.description':
    '11-bit (base) identifier: iki hat da 29-bit istiyor, bu yüzden aday raporlanmaz.',

  // --- SBUS ---
  'protocol.sbus.error.frameTooShort':
    'Çerçeve 25 bayttan kısa: SBUS sabit uzunluklu bir çerçevedir.',
  'protocol.sbus.error.frameTooLong': 'Çerçeve 25 baytı aşıyor: SBUS sabit uzunluklu bir çerçevedir.',
  'protocol.sbus.error.invalidStartByte':
    'İlk bayt 0x0F değil (SBUS_FRAME_BEGIN_BYTE) — bu bir SBUS çerçevesi olamaz, ama kalan alanlar yine de gösterilir.',
  'protocol.sbus.error.aborted': 'Çözümleme iptal edildi.',
  'protocol.sbus.documentation.summary':
    'Futaba SBUS: 25 baytlık sabit çerçeve — start byte (0x0F), 22 baytlık paketli 16×11-bit kanal verisi (lsb-first bit sırası), bayrak baytı (Digital CH17/CH18, Signal Loss, Failsafe Active — dördü AYRI alan) ve end byte. Checksum yok; kanal değerleri ham paketli sayı olarak basılır, 173–1812 mikrosaniye eşlemesi bir kalibrasyon kararıdır ve gömülmez.',
  'protocol.sbus.example.typicalFrame.name': 'Tipik çerçeve',
  'protocol.sbus.example.typicalFrame.description':
    '16 kanal 0, 100, 200 … 1500 değerlerini taşır, hiçbir bayrak set değil.',
  'protocol.sbus.example.failsafeAndSignalLoss.name': 'Failsafe + Signal Loss',
  'protocol.sbus.example.failsafeAndSignalLoss.description':
    'Bit2 (Signal Loss) VE bit3 (Failsafe Active) birlikte set — iki bayrağın AYRI alanlar olduğu görülür.',
  'protocol.sbus.example.digitalChannels1718.name': 'Dijital kanal 17/18',
  'protocol.sbus.example.digitalChannels1718.description':
    'Bit0 (Digital Channel 17) ve bit1 (Digital Channel 18) set, kalan bayraklar temiz.',
  'protocol.sbus.example.invalidStartByte.name': 'Geçersiz start byte (hata yolu)',
  'protocol.sbus.example.invalidStartByte.description':
    'Start byte 0x0F yerine 0x00 — start-delimiter-not-found basar, kalan alanlar yine de çözülür.',

  // --- IBUS ---
  'protocol.ibus.error.frameTooShort':
    'Çerçeve, seçili profilin gerektirdiği asgari uzunluktan (iA6: 31, iA6B: 32 bayt) kısa.',
  'protocol.ibus.error.invalidLengthByte':
    'İlk bayt 0x20 (32) değil — iA6B profilinde ilk bayt çerçeve uzunluğunu bildirir.',
  'protocol.ibus.error.invalidSyncByte': 'İlk bayt 0x55 değil — iA6 profilinin senkron baytı budur.',
  'protocol.ibus.error.checksumMismatch':
    'Checksum uyuşmuyor: seçili profil (iA6/iA6B) yanlış olabilir ya da veri bozuk.',
  'protocol.ibus.error.aborted': 'Çözümleme iptal edildi.',
  'protocol.ibus.warning.unexpectedCommandByte':
    'İkinci bayt 0x40 ("RC Channel Command") değil — ArduPilot bunu reddeder, Betaflight’ın alım yolu denetlemez; bu motor Betaflight’ı izler, ham gösterip uyarır ama çözmeyi reddetmez.',
  'protocol.ibus.warning.upperNibbleAmbiguous':
    'Üst nibble’ın anlamı kaynaklar arasında çelişkili: Betaflight üç kanalın üst nibble’ını birleştirip ek 12-bit kanal türetir (rx/ibus.c:163), ArduPilot AYNI baytları failsafe göstergesi sayar (AP_RCProtocol_IBUS.cpp:45). Ham basılır, hiçbir yorum varsayılmaz.',
  'protocol.ibus.warning.ibus2OutOfScope':
    'i-BUS2 ağaç topolojisi bu motorun kapsamı dışındadır — FlySky yayınlamamış, Betaflight uygulamamış; halka açık bir tel biçimi kaynağı bulunamadı.',
  'protocol.ibus.warning.trailingBytes':
    'Seçili profilin beklediğinden fazla bayt var — fazlalık yok sayıldı, sonraki bir çerçevenin başı olabilir.',
  'protocol.ibus.option.profile': 'Profil',
  'protocol.ibus.option.profile.description':
    'iA6 ve iA6B farklı senkron baytı, kanal offset’i ve checksum algoritması kullanır — yanlış seçim checksum’ı her çerçevede FAIL gösterir. Yalnız klasik i-BUS modelleri çözülür; i-BUS2 için kaynak bulunamadığından kapsam dışıdır.',
  'protocol.ibus.option.profile.ia6b': 'iA6B (32 bayt, varsayılan)',
  'protocol.ibus.option.profile.ia6': 'iA6 (31 bayt)',
  'protocol.ibus.documentation.summary':
    'FlySky IBUS: iA6 (31 bayt, sync 0x55, senkron baytı checksum dışı, 16-bit LE kanal sözcükleri toplanır) ve iA6B (32 bayt, uzunluk+komut header’ı, checksum’dan önceki 30 baytın tamamı 0xFFFF’ten çıkarılır) iki AYRI model — profil seçeneğiyle seçilir, otomatik tahmin yapılmaz. Her kanal 12 bit (alt bayt + üst baytın alt nibble’ı); üst nibble’ın anlamı iki referans kaynakta çelişkili olduğu için ham basılır. i-BUS2 kaynaksızlık nedeniyle kapsam dışı, rozet bu yüzden Kısmi.',
  'protocol.ibus.example.ia6bTypical.name': 'iA6B tipik çerçeve',
  'protocol.ibus.example.ia6bTypical.description':
    '14 kanal 1000, 1050 … 1650 değerlerini taşır, komut baytı 0x40, checksum PASS.',
  'protocol.ibus.example.ia6bNonStandardCommand.name': 'iA6B, standart olmayan komut baytı',
  'protocol.ibus.example.ia6bNonStandardCommand.description':
    'Komut baytı 0x40 yerine 0x08 — checksum bu baytı da kapsadığı için yine PASS eder, yalnız uyarı tetiklenir.',
  'protocol.ibus.example.ia6bChecksumMismatch.name': 'iA6B, bozuk checksum (hata yolu)',
  'protocol.ibus.example.ia6bChecksumMismatch.description':
    'Tipik çerçeveyle aynı gövde, checksum baytı bilerek bozuldu — checksum-mismatch basar.',
  'protocol.ibus.example.ia6Typical.name': 'iA6 tipik çerçeve',
  'protocol.ibus.example.ia6Typical.description':
    '31 baytlık iA6 çerçevesi — aynı 14 kanal değeri, farklı senkron baytı ve checksum algoritmasıyla.',

  // --- CRSF ---
  'protocol.crsf.error.bufferTooShort':
    '3 bayttan az veri var — Device Address, Frame Length ve Type okunamıyor.',
  'protocol.crsf.error.frameTruncated': 'Bu çerçevenin bildirdiği uzunluk için yeterli bayt yok.',
  'protocol.crsf.error.lengthTooShort':
    'Frame Length, bu çerçeve tipinin yapısının gerektirdiğinden daha az bayt bildiriyor (broadcast çerçeveler Type+CRC, genişletilmiş çerçeveler ayrıca Destination+Origin, Command çerçeveleri ek olarak iki CRC baytının ikisini de gerektirir).',
  'protocol.crsf.error.lengthTooLong':
    'Frame Length protokolün üst sınırını aşıyor — bir CRSF çerçevesi sync ve CRC baytları dahil 64 baytı geçemez.',
  'protocol.crsf.error.unknownAddress':
    'İlk bayt bilinen CRSF cihaz adreslerinden biri değil — bu bir CRSF çerçevesi olmayabilir, ama kalan alanlar yine de gösterilir.',
  'protocol.crsf.error.frameCrcMismatch':
    'Frame CRC (CRC-8/DVB-S2, kapsam Type’tan son payload baytına kadar) tutmuyor — sync baytı ve Frame Length bu CRC’nin kapsamından bilerek DIŞLANMIŞTIR.',
  'protocol.crsf.error.commandCrcMismatch':
    'Command CRC (CRC-8/CRSF-COMMAND) tutmuyor — bu, yalnız Command çerçevelerinde bulunan, aşağıdaki Frame CRC’den BAĞIMSIZ ikinci ve ayrı bir CRC’dir.',
  'protocol.crsf.error.aborted': 'Çözümleme iptal edildi.',
  'protocol.crsf.warning.payloadNotDecodedForFrameType':
    'Bu çerçeve tipinin payload’ı ham gösterilir, yorumlanmaz — bu motor yalnız 0x16’yı (RC Channels Packed) çözer.',
  'protocol.crsf.warning.frameTypeDiscouragedByVendor':
    'TBS’in kendi spec’i bu çerçeve tipini uygulanması önerilmeyen ("Revision is in progress") olarak işaretliyor — payload’ı kararsız bir tanıma göre çözmek yerine ham gösterilir.',
  'protocol.crsf.warning.trailingBytes':
    'Bildirilen Frame Length’in kapsadığından daha fazla bayt var — fazla baytlar yok sayıldı, başka bir çerçevenin başlangıcı olabilir.',
  'protocol.crsf.option.baudProfile': 'Baud Profili',
  'protocol.crsf.option.baudProfile.description':
    'CRSF çerçeveleri Frame Length baytı sayesinde kendi kendine tam tanımlıdır — baud hızı yalnız bir UART zamanlama parametresidir ve hiçbir çözülen alanı DEĞİŞTİRMEZ. Bu seçim timing görünümünü besler, aşağıdaki çerçeve alanlarını değil.',
  'protocol.crsf.option.baudProfile.standard': 'Standart (416666 baud, varsayılan)',
  'protocol.crsf.option.baudProfile.fcCompatibility': 'FC uyumluluk (420000 baud)',
  'protocol.crsf.option.baudProfile.negotiated': 'Pazarlıklı (değer dışarıdan verilir)',
  'protocol.crsf.documentation.summary':
    'TBS Crossfire (CRSF): değişken uzunluklu bir çerçeve — Device/Sync Address, Frame Length, Type, 0x28 ve üzeri tipler için genişletilmiş başlık (Destination + Origin), payload ve kapsamı Type’tan başlayıp sync baytını/Frame Length’i dışlayan bir Frame CRC (CRC-8/DVB-S2). Command çerçeveleri (0x32) ayrıca ikinci, ayrı bir Command CRC (CRC-8/CRSF-COMMAND) taşır. Yalnız 0x16’nın (RC Channels Packed) payload’ı çözülür — 16×11 bit kanal, lsb-first, ham tik değeri VE protokolce tanımlı türetilmiş mikrosaniye değeri olarak gösterilir; diğer her tip doğrulanmış bir sözlükten adlandırılır ama ham gösterilir. 0x17 ve 0x18 ayrıca satıcının kendi spec’ince önerilmeyen olarak işaretlenir.',
  'protocol.crsf.example.rcChannelsPacked.name': 'RC Channels Packed (0x16)',
  'protocol.crsf.example.rcChannelsPacked.description':
    '0, 100, 200 … 1500 taşıyan 16 kanal (packedChannels.ts’in BitOrder fixture’ıyla AYNI) — ham tik ve protokolce tanımlı mikrosaniye değeri olarak çözülür, Frame CRC PASS eder.',
  'protocol.crsf.example.subsetRcChannelsPacked.name': 'Subset RC Channels Packed (0x17, satıcı önermiyor)',
  'protocol.crsf.example.subsetRcChannelsPacked.description':
    'TBS’in kendi spec’i bu çerçeve tipini uygulanması önerilmeyen olarak işaretliyor — payload ham gösterilir ve satıcı uyarısı basılır, Frame CRC yine de PASS eder.',
  'protocol.crsf.example.batterySensor.name': 'Battery Sensor (0x08, çözülmeyen payload)',
  'protocol.crsf.example.batterySensor.description':
    '0x16 dışında tanınan bir çerçeve tipi — tip doğrulanmış sözlükten adlandırılır, ama payload ham gösterilir çünkü yalnız RC Channels Packed çözülür.',
  'protocol.crsf.example.devicePing.name': 'Device Ping (0x28, genişletilmiş başlık)',
  'protocol.crsf.example.devicePing.description':
    'Boş payload’lu genişletilmiş başlıklı bir çerçeve — Destination ve Origin ayrı adres alanları olarak çözülür, Frame CRC PASS eder.',
  'protocol.crsf.example.command.name': 'Command (0x32), iki CRC de PASS',
  'protocol.crsf.example.command.description':
    'Genişletilmiş bir Command çerçevesi — Destination, Origin, Command CRC ve Frame CRC ayrı alanlar olarak gösterilir; ikisi de PASS eder.',
  'protocol.crsf.example.commandCrcMismatch.name': 'Command (0x32), Command CRC FAIL eder',
  'protocol.crsf.example.commandCrcMismatch.description':
    'Command CRC baytı bozuldu; Frame CRC bu bozuk bayt üzerinden yeniden hesaplandığı için yine PASS eder — iki CRC’nin BAĞIMSIZ doğrulandığının kanıtı.',
  'protocol.crsf.example.unrecognizedAddress.name': 'Tanınmayan adres (hata yolu)',
  'protocol.crsf.example.unrecognizedAddress.description':
    'RC Channels Packed örneğiyle AYNI gövde, yalnız ilk bayt bilinen bir CRSF cihaz adresi değil — hata verir, ama kanallar yine de çözülür.',
  'protocol.crsf.example.frameCrcMismatch.name': 'Frame CRC uyuşmazlığı (hata yolu)',
  'protocol.crsf.example.frameCrcMismatch.description':
    'RC Channels Packed örneğiyle AYNI gövde, yalnız son CRC baytı bozuldu.',

  // --- PPM ---
  'protocol.ppm.error.empty': 'Nabız günlüğü boş.',
  'protocol.ppm.error.oddLength':
    'Nabız günlüğü tek uzunlukta; her nabız 2 bayt (Uint16LE) olmalı.',
  'protocol.ppm.error.missingSync':
    'Hiçbir nabız sync gap eşiğine ulaşmıyor — çerçeve sınırı bulunamadı, kanallar ayrılamıyor.',
  'protocol.ppm.error.aborted': 'Çözümleme iptal edildi.',
  'protocol.ppm.error.frameTooLong': 'Çerçeve izin verilen azami uzunluğu aşıyor.',
  'protocol.ppm.option.syncGapUs': 'Sync Gap (µs)',
  'protocol.ppm.option.syncGapUs.description':
    'Çerçeve sınırını belirleyen tek şey. Verilmezse nabızlar ham sırayla listelenir, kanallar ayrılmaz — evrensel bir sync gap uzunluğu yoktur.',
  'protocol.ppm.option.channelCount': 'Kanal Sayısı',
  'protocol.ppm.option.channelCount.description':
    'Opsiyonel: verilirse gözlenen kanal sayısı buna göre denetlenir (Too Many/Too Few Channels). 0 bırakılırsa denetim yapılmaz.',
  'protocol.ppm.option.polarity': 'Kutupluluk',
  'protocol.ppm.option.polarity.description':
    'Yakalamanın elektriksel kutupluluğunu kayıt altına alır. Nabız-günlüğü konteyneri seviye bilgisini zaten atmış olduğu için bu, hesaplanan hiçbir değeri değiştirmez — şeffaflık için ilk alan olarak gösterilir.',
  'protocol.ppm.option.polarity.activeHigh': 'Active-high',
  'protocol.ppm.option.polarity.activeLow': 'Active-low',
  'protocol.ppm.option.pulseEncoding': 'Nabız Kodlaması',
  'protocol.ppm.option.pulseEncoding.description':
    'Bu nabız günlüğünü hangi yakalama kuralının ürettiğini belirtir. Konteyner ham seviye geçişleri yerine ÖNCEDEN HESAPLANMIŞ süreler taşıdığı için bu ayrıntı seviyesinde iki şık da AYNI sonucu üretir — seçenek, kural sessizce varsayılmak yerine AÇIKÇA belirtilsin diye var.',
  'protocol.ppm.option.pulseEncoding.unspecified': 'Belirtilmedi',
  'protocol.ppm.option.pulseEncoding.pulseWidth': 'Pulse-width',
  'protocol.ppm.option.pulseEncoding.pulseToPulse': 'Pulse-to-pulse',
  'protocol.ppm.option.minPulseUs': 'Minimum Nabız (µs)',
  'protocol.ppm.option.minPulseUs.description':
    'Kalibrasyon alt sınırı. Normalizasyon yalnız Minimum, Center ve Maximum üçü de verildiğinde gösterilir.',
  'protocol.ppm.option.centerPulseUs': 'Merkez Nabız (µs)',
  'protocol.ppm.option.centerPulseUs.description':
    'Kalibrasyon merkezi (nötr) değeri — normalize alanın sıfır noktası.',
  'protocol.ppm.option.maxPulseUs': 'Maksimum Nabız (µs)',
  'protocol.ppm.option.maxPulseUs.description':
    'Kalibrasyon üst sınırı. Normalizasyon yalnız Minimum, Center ve Maximum üçü de verildiğinde gösterilir.',
  'protocol.ppm.warning.syncGapRequiredForChannelSplit':
    'Sync Gap verilmedi — nabızlar ham sırayla listelenir, kanallar ayrılmaz.',
  'protocol.ppm.warning.pulseEncodingUnspecified':
    'Pulse Encoding belirtilmedi — spec iki yakalama kuralına da izin veriyor ve birinin sessizce varsayılmasını yasaklıyor (bu konteyner ayrıntı seviyesinde iki şık da aynı sonucu üretir).',
  'protocol.ppm.warning.pulseReserved':
    'Bu nabız rezerve değerdir (0) — ölçülemedi, süreye çevrilmedi.',
  'protocol.ppm.warning.pulseMayBeSaturated':
    'Bu nabız konteynerin taşıyabildiği en uzun süreye (6553.5 µs) eşit — gerçek süre daha uzun olabilir; gösterilen değer kesin bir ölçüm değil, bir ALT SINIRDIR.',
  'protocol.ppm.warning.pulseOutOfRange':
    'Bu nabız verilen Minimum/Maximum kalibrasyon aralığının dışında.',
  'protocol.ppm.warning.tooManyChannels':
    'Verilen Channel Count’tan daha fazla kanal nabzı gözlendi.',
  'protocol.ppm.warning.tooFewChannels':
    'Verilen Channel Count’tan daha az kanal nabzı gözlendi.',
  'protocol.ppm.warning.trailingPulsesIgnored':
    'Sync gap’ten sonra bu tek-çerçeve çözümünün tükettiğinden fazla nabız var — bunlar bir sonraki çerçevenin başlangıcı olabilir.',
  'protocol.ppm.warning.calibrationInvalid':
    'Minimum, Center ve Maximum üçü de verildi ama artan sırada değil — normalizasyon atlandı.',
  'protocol.ppm.warning.framePeriodUncertain':
    'Frame Period rezerve (ölçülemedi) bir nabız içeriyor — toplam eksik.',
  'protocol.ppm.documentation.summary':
    'PPM (Pulse Position Modulation): birden fazla RC kanalının tek bir nabız treninde zaman-kodlandığı, bayttan değil yakalanmış bir nabız-süresi günlüğünden çözülen sinyal. Evrensel bir pulse-width eşlemesi yoktur — Sync Gap, Channel Count, Polarity ve Minimum/Center/Maximum kalibrasyonunun hepsi kullanıcının verdiği çözümleme seçenekleridir. Sync Gap verilmezse nabızlar ham gösterilir; verilirse kanallar ayrılır ve konteynerin 6553.5 µs sınırına ulaşıldığında (gerçek bir 20 ms çerçeve için TİPİK vaka) sync gap nabzı ve çerçeve periyodu bir ALT SINIR olarak sunulur.',
  'protocol.ppm.example.twoChannelWorkedExample.name': 'İki kanallı çalışılmış örnek (spec)',
  'protocol.ppm.example.twoChannelWorkedExample.description':
    'Spec’in kendi kenarları (0/1502/3001 µs) kanal sürelerine çevrilmiş hâli: CH1=1502 µs, CH2=1499 µs, ardından konteyner sınırının güvenle içinde kalan 4000 µs’lik bir sync gap.',
  'protocol.ppm.example.typicalEightChannelCapture.name': 'Tipik 8 kanallı yakalama (sync gap doygunlaşır)',
  'protocol.ppm.example.typicalEightChannelCapture.description':
    'Sekiz kanal (1000-1700 µs) ve tipik 20 ms’lik bir çerçeve periyodunun gerektirdiği sync gap (9200 µs) — bu, 6553.5 µs’lik konteyner sınırını aşar ve register’ın azami değerine kırpılır.',
  'protocol.ppm.example.missingSyncCandidate.name': 'Sync gap adayı YOK (hata yolu)',
  'protocol.ppm.example.missingSyncCandidate.description':
    'Dört nabız, hepsi tipik kanal aralığında (1400-1600 µs) — bir Sync Gap ayarlanınca hiçbiri uymuyor ve Missing Sync tetikleniyor.',
  'protocol.ppm.example.reservedMidFrame.name': 'Çerçeve ortasında rezerve nabız',
  'protocol.ppm.example.reservedMidFrame.description':
    'İkinci kanal nabzı rezerve değerdir (0) — uyarıyla birlikte çözülmemiş gösterilir, diğer kanallar etkilenmez.',
  'protocol.ppm.example.truncated.name': 'Eksik çerçeve',
  'protocol.ppm.example.truncated.description':
    '3 baytlık bir arabellek — nabızları her zaman 2 bayt olan bir konteyner için tek (çift olmayan) bir uzunluk.',

  // --- PWM Servo ---
  'protocol.pwmServo.error.empty': 'Nabız günlüğü boş.',
  'protocol.pwmServo.error.oddLength':
    'Nabız günlüğü tek uzunlukta; her nabız 2 bayt (Uint16LE) olmalı.',
  'protocol.pwmServo.error.aborted': 'Çözümleme iptal edildi.',
  'protocol.pwmServo.error.frameTooLong': 'Çerçeve izin verilen azami uzunluğu aşıyor.',
  'protocol.pwmServo.option.initialPulseLevel': 'İlk Nabız Seviyesi',
  'protocol.pwmServo.option.initialPulseLevel.description':
    'Günlükteki ilk nabzın hangi seviyeyi temsil ettiği. Bir PWM servo çevrimi HIGH+LOW çiftidir; konteyner için bilinmeyen tek şey ilk nabzın seviyesidir, gerisi alterne eder. Yanlış seçim her duty cycle’ı tersine çevirir.',
  'protocol.pwmServo.option.initialPulseLevel.high': 'High (varsayılan)',
  'protocol.pwmServo.option.initialPulseLevel.low': 'Low',
  'protocol.pwmServo.option.minPulseUs': 'Minimum Nabız (µs)',
  'protocol.pwmServo.option.minPulseUs.description':
    'Kalibrasyon alt sınırı. Servo Position yalnız Minimum, Center ve Maximum üçü de verildiğinde gösterilir.',
  'protocol.pwmServo.option.centerPulseUs': 'Merkez Nabız (µs)',
  'protocol.pwmServo.option.centerPulseUs.description':
    'Kalibrasyon merkezi (nötr) değeri — Servo Position’ın %0 noktası.',
  'protocol.pwmServo.option.maxPulseUs': 'Maksimum Nabız (µs)',
  'protocol.pwmServo.option.maxPulseUs.description':
    'Kalibrasyon üst sınırı. Servo Position yalnız Minimum, Center ve Maximum üçü de verildiğinde gösterilir.',
  'protocol.pwmServo.option.expectedPeriodUs': 'Beklenen Çerçeve Periyodu (µs)',
  'protocol.pwmServo.option.expectedPeriodUs.description':
    'Gerçek dünya periyot beklentisi (ör. 50 Hz için 20000 µs) — konteynerin tek-nabız 6553.5 µs sınırıyla İLGİSİZDİR. Verilirse her çevrimin ölçülen periyodu bununla karşılaştırılır ve sapma gösterilir.',
  'protocol.pwmServo.warning.missingPulse':
    'Bu çevrimin eşleşen nabzı eksik — ya günlük o nabız gelmeden bitiyor ya da nabız rezerve değerdir (0). Frame Period, Frequency ve Duty Cycle bu çevrim için hesaplanmaz.',
  'protocol.pwmServo.warning.pulseMayBeSaturated':
    'Bu nabız konteynerin taşıyabildiği en uzun süreye (6553.5 µs) eşit — gerçek süre daha uzun olabilir. Bu, gerçek bir 20 ms/50 Hz yakalama için TİPİK vakadır: LOW nabzı tek başına genelde ~18.5 ms’dir.',
  'protocol.pwmServo.warning.framePeriodError':
    'Ölçülen Frame Period, Expected Frame Period ile tam eşleşmiyor.',
  'protocol.pwmServo.warning.calibrationInvalid':
    'Minimum, Center ve Maximum üçü de verildi ama artan sırada değil — Servo Position atlandı.',
  'protocol.pwmServo.warning.jitterExcludesUncertainPulses':
    'Bir veya daha fazla Pulse Width değeri, nabzı doygun olduğu (süresi belirsiz) için Jitter istatistiğinden dışlandı.',
  'protocol.pwmServo.documentation.summary':
    'PWM Servo: yakalanmış bir nabız-süresi günlüğünden okunan, HIGH süresi + LOW süresi çiftlerinden oluşan klasik kanal-başına RC aktüatör sinyali. Frame Period, Frequency ve Duty Cycle her çevrim için hesaplanır; Servo Position yalnız bir Minimum/Center/Maximum kalibrasyonu verildiğinde, PPM’le AYNI normalizasyon formülüyle ama yüzde olarak sunulur. Evrensel bir 50 Hz/20 ms eşlemesi yoktur — yalnız bir konfigürasyon örneğidir. LOW nabzı konteynerin 6553.5 µs sınırına ulaştığında (gerçek bir 20 ms periyot için TİPİK vaka) Period, Frequency ve Duty Cycle kesin değer yerine YÖNÜ BELLİ birer sınır olarak gösterilir.',
  'protocol.pwmServo.example.singleCycleTypical.name': 'Tek çevrim, konteynerin içinde (temiz yol)',
  'protocol.pwmServo.example.singleCycleTypical.description':
    'HIGH=1500 µs (spec’in Pulse değeri), LOW=2000 µs — konteyner sınırının içinde kalması için küçültüldü (gerçek 18500 µs sığmaz).',
  'protocol.pwmServo.example.lowSaturatesRealisticPeriod.name': 'LOW gerçekçi bir periyotta doygunlaşır',
  'protocol.pwmServo.example.lowSaturatesRealisticPeriod.description':
    'HIGH=1500 µs, LOW hedefi 18500 µs (spec’in gerçek 20 ms/50 Hz kalibrasyonu) — register’ın azami değerine kırpılır; Period, Frequency ve Duty Cycle birer sınır olarak gösterilir.',
  'protocol.pwmServo.example.multiChannelServoPositions.name': 'Çok kanallı servo pozisyonları (spec)',
  'protocol.pwmServo.example.multiChannelServoPositions.description':
    'Spec’in kendi multi-channel örneği: Servo1=1501, Servo2=1230, Servo3=1782, Servo4=1500 µs, her biri güvenli bir 2000 µs LOW ile eşleşti.',
  'protocol.pwmServo.example.jitterSample.name': 'Jitter örneği (spec)',
  'protocol.pwmServo.example.jitterSample.description':
    'Spec’in kendi jitter örneği: HIGH = 1498, 1502, 1501, 1497, 1503 µs → Mean=1500.2 µs, Peak-to-Peak=6 µs.',
  'protocol.pwmServo.example.missingPulse.name': 'Eksik nabız (rezerve LOW)',
  'protocol.pwmServo.example.missingPulse.description':
    'Çevrimin LOW yarısı rezerve değerdir (0) — ölçülemedi; Frame Period, Frequency ve Duty Cycle hesaplanmaz.',
  'protocol.pwmServo.example.truncated.name': 'Eksik çerçeve',
  'protocol.pwmServo.example.truncated.description':
    '3 baytlık bir arabellek — nabızları her zaman 2 bayt olan bir konteyner için tek (çift olmayan) bir uzunluk.',

  // --- ARINC 429 (Faz 10, dalga 15f) ---
  'protocol.arinc429.documentation.summary':
    'ARINC 429 32-bit word çözümü: Label (bit 8:1), SDI (bit 10:9), Data (bit 29:11), SSM (bit 31:30) ve bit 32 paritesi. Girdi 32-bit ham word / HEX / CSV / adapter log dosyasıdır; analog bipolar RZ dalgası çözülmez. Label ve SDI ANLAMI equipment ICD\'sine bağlıdır ve basılmaz.',
  'protocol.arinc429.error.empty': 'Girdi boş.',
  'protocol.arinc429.error.notWordAligned':
    'Girdi 4 baytın katı değil — ARINC 429 word\'ü tam 32 bittir, artan baytlar eksik bir word demektir.',
  'protocol.arinc429.error.aborted': 'Çözümleme iptal edildi.',
  'protocol.arinc429.error.frameTooLong': 'Çerçeve izin verilen azami uzunluğu aşıyor.',
  'protocol.arinc429.error.parity': 'Word paritesi tutmuyor (PARITY ERROR).',

  'protocol.arinc429.option.wordByteOrder': 'Word Bayt Sırası',
  'protocol.arinc429.option.wordByteOrder.description':
    'Adapter word\'ü hangi bayt sırasıyla yazıyor. Tahmin edilmez: yanlış seçim Label\'i tamamen kaydırır. Seçilmezse yalnız ham 4 bayt ve parite basılır.',
  'protocol.arinc429.option.wordByteOrder.unset': 'Seçilmedi (ham word)',
  'protocol.arinc429.option.wordByteOrder.littleEndian': 'Little-endian (bayt 0 = Label okteti)',
  'protocol.arinc429.option.wordByteOrder.bigEndian': 'Big-endian (bayt 0 = parite/SSM)',

  'protocol.arinc429.option.labelBitOrder': 'Label Bit Sırası',
  'protocol.arinc429.option.labelBitOrder.description':
    'Standartta Label MSB-first iletilir, geri kalan alanlar LSB-first — bu yüzden oktal Label okteti terslenerek okunur. Bazı alıcı-vericiler bunu donanımda zaten yapar. Seçilmezse oktal gösterim BASILMAZ.',
  'protocol.arinc429.option.labelBitOrder.unset': 'Seçilmedi (oktal basılmaz)',
  'protocol.arinc429.option.labelBitOrder.standard': 'Standart (bit 1 = MSB, oktet terslenir)',
  'protocol.arinc429.option.labelBitOrder.preReversed': 'Önceden terslenmiş (adapter donanımda çevirdi)',

  'protocol.arinc429.option.dataEncoding': 'Data Kodlaması',
  'protocol.arinc429.option.dataEncoding.description':
    'Data alanının ve SSM\'in yorumu buna bağlıdır. Seçilmezse ikisi de ham kalır.',
  'protocol.arinc429.option.dataEncoding.raw': 'Ham (yorumlanmaz)',
  'protocol.arinc429.option.dataEncoding.bnr': 'BNR (iki tümleyen ikilik sayı)',
  'protocol.arinc429.option.dataEncoding.bcd': 'BCD (ikilik kodlu ondalık)',
  'protocol.arinc429.option.dataEncoding.discrete': 'Discrete (bit alanları)',

  'protocol.arinc429.option.parityMode': 'Parite Kipi',
  'protocol.arinc429.option.parityMode.description':
    'ARINC 429 kanalları TİPİK olarak tek (odd) parite kullanır, ama bu bir garanti değildir — alıcı-verici sürücüleri iki kipi de yapılandırılabilir sunar.',
  'protocol.arinc429.option.parityMode.odd': 'Tek (odd)',
  'protocol.arinc429.option.parityMode.even': 'Çift (even)',

  'protocol.arinc429.option.resolution': 'Çözünürlük (Resolution)',
  'protocol.arinc429.option.resolution.description':
    'BNR/BCD için Physical = Raw × Resolution. Değer equipment ICD\'sinden gelir ve koda gömülmez; verilmezse fiziksel değer BASILMAZ (0 = verilmedi).',
  'protocol.arinc429.option.dataLowBit': 'Data Alt Biti',
  'protocol.arinc429.option.dataLowBit.description':
    'Bazı Label\'lerde anlamlı bitler 11–29\'un alt kümesidir; aralık ICD\'den gelir (0 = verilmedi, tam 11–29 kullanılır).',
  'protocol.arinc429.option.dataHighBit': 'Data Üst Biti',
  'protocol.arinc429.option.dataHighBit.description':
    'Seçilen Data alt aralığının en yüksek biti (0 = verilmedi, tam 11–29 kullanılır).',

  'protocol.arinc429.warning.wordByteOrderNotSelected':
    'Bayt sırası seçilmedi — alan sınırları yerinden oynayacağı için word\'ler HAM 4 bayt olarak basıldı; yalnız parite doğrulandı (parite bayt sırasından bağımsızdır).',
  'protocol.arinc429.warning.labelBitOrderNotSelected':
    'Label bit sırası seçilmedi — Label HAM 8 bit olarak basıldı, oktal gösterim üretilmedi.',
  'protocol.arinc429.warning.parityModeAssumedOdd':
    'Tek (odd) parite varsayıldı. ARINC 429 kanalları tipik olarak tek parite kullanır, ama bu bir garanti değildir.',
  'protocol.arinc429.warning.dataBitRangeInvalid':
    'Verilen Data bit aralığı geçersiz (11 ≤ alt ≤ üst ≤ 29 olmalı ve ikisi de verilmeli) — tam 11–29 aralığı kullanıldı.',

  'protocol.arinc429.field.labelMeaningRequiresIcd':
    'Label ANLAMI equipment ICD\'sine bağlıdır ve global olarak aynı olduğu varsayılamaz — yalnız sayı/oktal basılır.',
  'protocol.arinc429.field.labelBitOrderNotSelected':
    'Label bit sırası seçilmediği için oktal gösterim basılmadı; değer telin/adapter\'ın ham okteti.',
  'protocol.arinc429.field.sdiSemanticNameRequiresIcd':
    'SDI\'nin semantik adı (örn. "IRS #1") yalnız yapılandırılmış bir equipment eşlemesi varsa verilebilir — ICD veritabanı bu sürümün kapsamı dışında.',
  'protocol.arinc429.field.ssmMeaningRequiresEncoding':
    'SSM\'in anlamı seçilen data kodlamasına bağlıdır — kodlama seçilmediği için iki bit ham basıldı.',
  'protocol.arinc429.field.ssmStatusCodeNotCrossVerified':
    'SSM\'in iki bitten duruma (Normal Operation / Functional Test / Failure Warning / No Computed Data) SAYISAL eşlemesi iki bağımsız uygulamada ÇELİŞTİĞİ için adlandırılmadı; doğru tablo seçilen standart revizyonundan ve ICD\'den yüklenmelidir.',
  'protocol.arinc429.field.dataEncodingNotSelected':
    'Data kodlaması seçilmedi — 19 bit ham basıldı, yorumlanmadı.',
  'protocol.arinc429.field.resolutionRequiredForPhysicalValue':
    'Çözünürlük verilmediği için fiziksel değer hesaplanmadı; gösterilen sayı ölçeklenmemiş ham değerdir.',
  'protocol.arinc429.field.discreteBitMeaningRequiresIcd':
    'Discrete bitlerinin anlamı equipment ICD\'sinden gelir ve gömülmez — yalnız bitlerin kendisi gösterilir.',
  'protocol.arinc429.field.bcdDigitOutOfRange':
    'En az bir 4 bitlik grup 9\'dan büyük — bu alan geçerli bir BCD değeri değil.',
  'protocol.arinc429.field.parityFailed': 'Parite tutmuyor.',
  'protocol.arinc429.field.wordByteOrderNotSelected':
    'Bayt sırası seçilmediği için alanlar ayrılmadı — word ham 4 bayt olarak gösteriliyor.',

  'protocol.arinc429.example.label213Bnr.name': 'Label 213₈, BNR çalışılmış örneği',
  'protocol.arinc429.example.label213Bnr.description':
    'Label okteti 0xD1 → 213₈ (referansın kendi sayısal vektörü), SDI 01, Data 12345, SSM 11. Little-endian. Çözünürlük 0.1 verilirse BNR değeri 1234.5 olur (spec örneği).',
  'protocol.arinc429.example.label041NegativeBnr.name': 'Label 041₈, negatif BNR',
  'protocol.arinc429.example.label041NegativeBnr.description':
    'Label okteti 0x84 → 041₈ (bağımsız bir uygulamanın yayımlanmış fixture\'ı). Data 19 bitlik iki tümleyende −12345; bit 29 işaret bitidir.',
  'protocol.arinc429.example.label107Bcd.name': 'Label 107₈, beş basamaklı BCD',
  'protocol.arinc429.example.label107Bcd.description':
    'Label okteti 0xE2 → 107₈. Data 0x12345 → basamaklar 1 2 3 4 5; 19 bit dört tam basamak artı 3 bitlik en anlamlı basamağa bölünür.',
  'protocol.arinc429.example.label206Discrete.name': 'Label 206₈, discrete bitler',
  'protocol.arinc429.example.label206Discrete.description':
    'Label okteti 0x61 → 206₈, SDI 11. Discrete bit anlamları ICD\'ye bağlı olduğu için basılmaz; yalnız 19 bitin ikilik gösterimi verilir.',
  'protocol.arinc429.example.bigEndianAdapter.name': 'Big-endian adapter word\'ü',
  'protocol.arinc429.example.bigEndianAdapter.description':
    'İlk örneğin MANTIKSAL olarak aynısı, big-endian yazılmış: parite baytların ilkinin en yüksek bitinde, Label okteti sonuncu baytta. Bayt sırası little-endian seçilirse alanlar tamamen kayar.',
  'protocol.arinc429.example.twoWordCapture.name': 'İki word\'lük yakalama',
  'protocol.arinc429.example.twoWordCapture.description':
    'Tek bir blokta iki word — her alanın kimliği word indeksini taşır, ikinci word\'ün alanları birincininkiyle çakışmaz.',
  'protocol.arinc429.example.parityError.name': 'Parite hatası',
  'protocol.arinc429.example.parityError.description':
    'İlk örneğin parite biti kasten ters çevrildi — tek (odd) parite kipinde word reddedilir.',
  'protocol.arinc429.example.notWordAligned.name': 'Word hizasız girdi',
  'protocol.arinc429.example.notWordAligned.description':
    '3 baytlık bir arabellek — 32 bitlik word\'lerden oluşan bir bloğa göre eksik.',

  // --- MIL-STD-1553 (Faz 10, dalga 15g) ---
  'protocol.mil1553.documentation.summary':
    'MIL-STD-1553 16-bit sözcük çözümü: Command Word (RT Address bit 15:11, T/R bit 10, Subaddress/Mode bit 9:5, Word Count/Mode Code bit 4:0), Status Word (RT Address + dokuz bayrak + bit 7:5 rezerve) ve 16 bitlik ham Data Word. Girdi çözülmüş sözcük listesi / HEX / CSV / adapter log dosyasıdır; Manchester dalgası çözülmez. Sözcük tipi SENKRON DARBESİNDE taşınır ve 16 bitlik yükte YOKTUR — üstelik Command ile Status aynı senkronu paylaşır — bu yüzden tip kullanıcıdan alınır, TAHMİN EDİLMEZ. Mode code ADI, ICD engineering değeri ve kabul limitleri basılmaz.',
  'protocol.mil1553.error.empty': 'Girdi boş.',
  'protocol.mil1553.error.notWordAligned':
    'Girdi 2 baytın katı değil — MIL-STD-1553 sözcüğünün yükü tam 16 bittir, artan bayt eksik bir sözcük demektir.',
  'protocol.mil1553.error.aborted': 'Çözümleme iptal edildi.',
  'protocol.mil1553.error.frameTooLong': 'Çerçeve izin verilen azami uzunluğu aşıyor.',

  'protocol.mil1553.option.wordType': 'Sözcük Tipi',
  'protocol.mil1553.option.wordType.description':
    'Sözcüğün Command / Status / Data olduğu bilgisi 3 bitlik SENKRON DARBESİNDEDİR, 16 bitlik yükte değil — üstelik Command ile Status aynı senkron desenini paylaşır, yani senkron korunsa bile ayrım çerçeveden çıkmaz. Varsayılan YOKTUR: yanlış bir tip her sözcükte sessizce yanlış alan adı basar. Seçilmezse 16 bit ham gösterilir.',
  'protocol.mil1553.option.wordType.unset': 'Seçilmedi (16 bit ham)',
  'protocol.mil1553.option.wordType.command': 'Command Word (BC → RT komutu)',
  'protocol.mil1553.option.wordType.status': 'Status Word (RT → BC durumu)',
  'protocol.mil1553.option.wordType.data': 'Data Word (16 bit ham veri)',

  'protocol.mil1553.option.wordByteOrder': 'Sözcük Bayt Sırası',
  'protocol.mil1553.option.wordByteOrder.description':
    'Adapter 16 bitlik sözcüğü hangi bayt sırasıyla yazıyor. Tahmin edilmez: yanlış seçim bütün alan sınırlarını kaydırır. Seçilmezse yalnız ham 2 bayt basılır.',
  'protocol.mil1553.option.wordByteOrder.unset': 'Seçilmedi (ham bayt)',
  'protocol.mil1553.option.wordByteOrder.bigEndian': 'Big-endian (bayt 0 = bit 15:8)',
  'protocol.mil1553.option.wordByteOrder.littleEndian': 'Little-endian (bayt 0 = bit 7:0)',

  'protocol.mil1553.warning.wordTypeUnknown':
    'Sözcük tipi seçilmedi — tip senkron darbesindedir ve 16 bitlik yükte YOKTUR, tahmin edilemez. Sözcükler 16 bit ham basıldı, alt alanlar adlandırılmadı.',
  'protocol.mil1553.warning.wordByteOrderNotSelected':
    'Bayt sırası seçilmedi — bit numaraları anlamsız kalacağı için sözcükler HAM 2 bayt olarak basıldı.',
  'protocol.mil1553.warning.wordTypeAppliedToAllWords':
    'Seçilen sözcük tipi yakalamadaki BÜTÜN sözcüklere uygulandı. Bir 1553 işlemi (Command + Status + Data) tek bir tiple çözülemez — her tipi ayrı çözün; işlem zaman çizelgesi çerçeveler arası bir analizdir ve bu çözümleyicinin işi değildir.',
  'protocol.mil1553.warning.parityNotInInput':
    'Parite biti girdide YOKTUR ve DOĞRULANMADI: 1553 sözcüğü 3 bit senkron + 16 bit yük + 1 bit tek (odd) paritedir, adapter yükü verirken pariteyi tüketip ayrı bir bayrağa taşır. Bu çözümleyici yalnız 16 bitlik yükü alır.',
  'protocol.mil1553.warning.statusReservedBitsNotZero':
    'Status Word\'ün rezerve bitleri (7:5) sıfır değil — bu sözcük büyük olasılıkla bir Status Word DEĞİLDİR; sözcük tipi seçimini gözden geçirin.',

  'protocol.mil1553.field.wordTypeUnknown':
    'Sözcük tipi seçilmediği için alt alanlar ayrılmadı — 16 bitin kendisi gösteriliyor.',
  'protocol.mil1553.field.wordByteOrderNotSelected':
    'Bayt sırası seçilmediği için alanlar ayrılmadı — sözcük ham 2 bayt olarak gösteriliyor.',
  'protocol.mil1553.field.modeCodeNameRequiresRevision':
    'Mode code ADI (örn. "Transmitter Shutdown") basılmaz: mode-code veritabanı seçilen standart revizyonundan yüklenmelidir. Yalnız sayı gösterilir.',
  'protocol.mil1553.field.wordCountUnusedInModeCommand':
    'Subaddress 0 ya da 31 olduğu için bu alan Word Count değil Mode Code taşır.',
  'protocol.mil1553.field.subaddressMeaningRequiresIcd':
    'Subaddress\'in hangi alt sisteme baktığı equipment ICD\'sine bağlıdır ve gömülmez — yalnız sayı gösterilir.',
  'protocol.mil1553.field.dataMeaningRequiresIcd':
    'Data Word 16 bit hamdır ve mühendislik anlamı equipment ICD\'sinden gelir; sabit offset\'le alan adı yakıştırılmaz.',
  'protocol.mil1553.field.reservedBitsNotZero':
    'Rezerve bitler sıfır olmalıdır — sıfırdan farklı bir değer sözcüğün Status Word olmadığına işaret eder.',

  'protocol.mil1553.example.commandRt3Transmit.name': 'Command Word — RT 3, transmit, 1 sözcük',
  'protocol.mil1553.example.commandRt3Transmit.description':
    '0x1C21 = 0b0001110000100001: RT Address 3, T/R 1 (RT gönderir), Subaddress 1, Word Count 1. Referansın adım adım anlattığı BC→RT işleminin komut sözcüğü.',
  'protocol.mil1553.example.statusRt3AllClear.name': 'Status Word — RT 3, bütün bayraklar temiz',
  'protocol.mil1553.example.statusRt3AllClear.description':
    '0x1800 = 0b0001100000000000: RT Address 3, rezerve bitler sıfır, hiçbir durum bayrağı set değil. Aynı işlemin durum sözcüğü.',
  'protocol.mil1553.example.dataWordValue2.name': 'Data Word — değer 2',
  'protocol.mil1553.example.dataWordValue2.description':
    'Aynı işlemde istenen tek veri sözcüğü. 16 bit hamdır; mühendislik anlamı equipment ICD\'sinden gelir ve basılmaz.',
  'protocol.mil1553.example.modeCommandSubaddress31.name': 'Mode command — subaddress 31',
  'protocol.mil1553.example.modeCommandSubaddress31.description':
    '0x1BE2: RT Address 3, Subaddress 31 (0b11111). Subaddress 0 ya da 31 "bu bir mode command\'dır" demektir; son 5 bit Word Count değil Mode Code taşır. Kodun ADI basılmaz.',
  'protocol.mil1553.example.broadcastModeSubaddress0.name': 'Broadcast mode command — subaddress 0',
  'protocol.mil1553.example.broadcastModeSubaddress0.description':
    '0xF801: RT Address 31 (broadcast için rezerve), Subaddress 0 → yine mode command, Mode Code 1. Mode command\'ın iki subaddress değeriyle de geldiğini gösterir.',
  'protocol.mil1553.example.statusReservedNotZero.name': 'Rezerve bitleri sıfır olmayan sözcük',
  'protocol.mil1553.example.statusReservedNotZero.description':
    '0x18E0: bit 7:5 = 111. Status Word olarak çözülürse rezerve alan geçersiz işaretlenir ve uyarı basılır — sözcük tipinin yanlış seçilmiş olabileceğinin en güçlü göstergesi.',
  'protocol.mil1553.example.littleEndianAdapter.name': 'Little-endian adapter sözcüğü',
  'protocol.mil1553.example.littleEndianAdapter.description':
    'İlk örneğin MANTIKSAL olarak aynısı, bayt sırası ters yazılmış. Big-endian seçilirse bütün alanlar kayar — bayt sırasının neden tahmin edilmediğini gösterir.',
  'protocol.mil1553.example.threeWordTransaction.name': 'Üç sözcüklük BC→RT işlemi',
  'protocol.mil1553.example.threeWordTransaction.description':
    'Command + Status + Data tek bir blokta. Seçilen sözcük tipi ÜÇÜNE BİRDEN uygulanır — bu yüzden uyarı basılır; her sözcüğü kendi tipiyle ayrı çözün. Alan kimlikleri sözcük indeksi taşır, çakışmaz.',
  'protocol.mil1553.example.notWordAligned.name': 'Sözcük hizasız girdi',
  'protocol.mil1553.example.notWordAligned.description':
    '3 baytlık bir arabellek — 16 bitlik sözcüklerden oluşan bir bloğa göre eksik.',

  // --- Mode-S (Faz 10, dalga 15h) ---
  'protocol.modeS.documentation.summary':
    'Mode S çerçeve düzeyi çözümü: 56 bit (7 bayt) kısa ve 112 bit (14 bayt) uzun mesajlar, DF alanı (DF24 İLK İKİ BİTTEN tanınır, ilk beşten değil), ICAO adresi, ham gövde ve son 24 bitlik parite. Girdi HAM HEX mesajdır; Beast binary, SBS/BaseStation log ve dump1090 JSON birer konteyner biçimidir ve kapsam dışıdır. Parite alanının ANLAMI DF\'e göre değişir: DF11/17/18\'de PI düz CRC\'dir ve PASS/FAIL doğrulanır, DF0/4/5/16/20/21\'de AP = CRC ⊕ ICAO adresidir ve pasif dinleyici ikisini ayıramaz — adres çıkarılır ama DOĞRULANAMAZ. CRC-24 katalog girdisi CRC24_MODE_S\'tir (poly 0xFFF409); katalogdaki diğer dört 24-bit CRC\'nin hiçbiri değildir. Tek-bit CRC düzeltme adayları bu sürümde üretilmez.',
  'protocol.modeS.error.empty': 'Girdi boş.',
  'protocol.modeS.error.invalidLength':
    'Mode S mesajı 7 bayt (56 bit) ya da 14 bayt (112 bit) olmalıdır; ara uzunluk yoktur.',
  'protocol.modeS.error.aborted': 'Çözümleme iptal edildi.',
  'protocol.modeS.error.frameTooLong': 'Çerçeve izin verilen azami uzunluğu aşıyor.',
  'protocol.modeS.error.parityMismatch':
    'PI alanı hesaplanan CRC-24 ile eşleşmiyor — mesaj bozuk.',

  'protocol.modeS.warning.parityIsAddressXorCrc':
    'Bu DF\'te son 24 bit AP = CRC ⊕ ICAO adresidir; pasif dinleyici adresi checksum\'dan ayıramaz, bu yüzden CRC DOĞRULANAMADI.',
  'protocol.modeS.warning.paritySemanticsUnknown':
    'Bu DF\'in parite alanının anlamı kamuya açık kaynaklarla belirlenemedi; son 24 bit HAM basıldı ve hiçbir şey doğrulanmadı.',
  'protocol.modeS.warning.icaoRecoveredNotVerified':
    'ICAO adresi AP ⊕ CRC ile ÇIKARILDI; her mesaj bir “geçerli” adres ürettiği için bu çıkarım doğrulanamaz.',
  'protocol.modeS.warning.lengthDoesNotMatchDownlinkFormat':
    'Girdi uzunluğu DF\'in gerektirdiği uzunlukla çelişiyor (DF < 16 → 7 bayt, DF ≥ 16 → 14 bayt); alanlar genel yerleşimle basıldı ve parite doğrulanmadı.',
  'protocol.modeS.warning.downlinkFormatUnassigned':
    'Bu DF değeri ICAO Annex 10\'da atanmamıştır; çerçeve genel yerleşimle basıldı.',
  'protocol.modeS.warning.downlinkFormat24TwoBitException':
    'DF24 bir istisnadır: ilk İKİ bit “11” olduğu için DF24 seçildi, ilk beş bitin sayısal değeri kullanılmadı.',

  'protocol.modeS.field.icaoRecoveredNotVerified':
    'AP ⊕ CRC ile çıkarıldı, doğrulanmadı.',
  'protocol.modeS.field.parityNotVerifiable':
    'AP = CRC ⊕ ICAO adresi — adres bilinmeden doğrulanamaz.',
  'protocol.modeS.field.paritySemanticsUnknown':
    'Bu DF\'te parite alanının anlamı belirlenemedi — ham basıldı.',
  'protocol.modeS.field.parityMismatch': 'Hesaplanan CRC-24 ile eşleşmiyor.',
  'protocol.modeS.field.bodySubfieldsNotDecoded':
    'Gövdenin DF\'e özgü alt alanları bu çerçeve düzeyi çözücüde adlandırılmaz.',
  'protocol.modeS.field.messageExtendedSquitterHandoff':
    'ME alanının içeriği ADS-B sayfasında çözülür — bu çözücü çerçeve düzeyindedir.',
  'protocol.modeS.field.commBMessageNotDecoded':
    'MB alanı bir BDS yanıtıdır; BDS numarası çerçevede YOKTUR ve bu çözücü içeriği yorumlamaz.',
  'protocol.modeS.field.downlinkFormat24TwoBitException':
    'DF24 yalnız ilk İKİ bitten tanınır; kalan bitler başka bilgi taşır.',
  'protocol.modeS.field.downlinkFormatUnassigned': 'Bu DF değeri atanmamıştır.',
  'protocol.modeS.field.lengthDoesNotMatchDownlinkFormat':
    'DF\'in gerektirdiği uzunluk girdinin uzunluğuyla çelişiyor.',

  'protocol.modeS.example.df17Identification.name': 'DF17 — extended squitter, uçak kimliği',
  'protocol.modeS.example.df17Identification.description':
    'Gerçek bir yakalama (mode-s.org): ICAO 4840D6, CA 5, ME alanı Type Code 4 taşıyor. İlk 11 bayt üzerinde hesaplanan CRC-24 son 3 bayta birebir oturur — CRC PASS.',
  'protocol.modeS.example.df17AirbornePosition.name': 'DF17 — havada konum (even çerçeve)',
  'protocol.modeS.example.df17AirbornePosition.description':
    'Gerçek bir yakalama (mode-s.org): ICAO 40621D. ME alanı ham kalır; CPR yorumu ADS-B sayfasındadır.',
  'protocol.modeS.example.df17CrcFail.name': 'DF17 — CRC FAIL (bir ME baytı bozuldu)',
  'protocol.modeS.example.df17CrcFail.description':
    'İlk örneğin bir ME baytı değiştirildi, PI alanına dokunulmadı. CRC-24 artık tutmuyor; düzeltme adayı ÜRETİLMEZ.',
  'protocol.modeS.example.df11AllCall.name': 'DF11 — All-Call yanıtı',
  'protocol.modeS.example.df11AllCall.description':
    '56 bitlik kısa çerçeve. DF11 adres-açık sınıfındadır: ICAO adresi bit 9:32\'de açık durur ve PI doğrudan doğrulanır.',
  'protocol.modeS.example.df4Altitude.name': 'DF4 — gözetim, altitude yanıtı (AP sınıfı)',
  'protocol.modeS.example.df4Altitude.description':
    'AP = CRC ⊕ ICAO kuralıyla 0x400940 adresine oturtuldu. Adres çıkarılır ama DOĞRULANAMAZ — CRC PASS/FAIL göstergesi bu çerçevede HİÇ basılmaz.',
  'protocol.modeS.example.df5Identity.name': 'DF5 — gözetim, identity yanıtı (AP sınıfı)',
  'protocol.modeS.example.df5Identity.description':
    'DF4\'ün kardeşi: 13 bitlik alan altitude yerine squawk taşır. Gövde bu çerçeve düzeyi çözücüde ham kalır.',
  'protocol.modeS.example.df20CommB.name': 'DF20 — Comm-B, altitude yanıtı',
  'protocol.modeS.example.df20CommB.description':
    'Gerçek bir yakalama. MB alanı DF17\'nin ME alanıyla AYNI GÖRÜNÜR ama bir BDS yanıtıdır, Type Code değildir — ADS-B çözücüsü bu çerçeveyi kabul etmez.',
  'protocol.modeS.example.df24CommD.name': 'DF24 — Comm-D (iki-bit istisnası)',
  'protocol.modeS.example.df24CommD.description':
    'İlk baytın ilk beş biti 28 okur, ama ilk İKİ bit “11” olduğu için DF24\'tür. Naif bir beş-bit okuması bu çerçeveyi tanımsız DF sanardı.',
  'protocol.modeS.example.lengthMismatch.name': 'Uzunluk ile DF çelişiyor',
  'protocol.modeS.example.lengthMismatch.description':
    'DF17 uzun çerçeve DF\'idir ama girdi 7 bayt. Çerçeve reddedilmez; genel yerleşimle basılır ve parite doğrulanmaz.',
  'protocol.modeS.example.invalidLength.name': 'Geçersiz uzunluk (10 bayt)',
  'protocol.modeS.example.invalidLength.description':
    'Mode S\'te ara uzunluk yoktur: 7 ya da 14 bayt. 10 baytlık girdi eksik çerçevedir.',

  // --- ADS-B 1090ES (Faz 10, dalga 15h) ---
  'protocol.adsb.documentation.summary':
    'ADS-B 1090ES: Mode S DF17/DF18 extended squitter\'ının 56 bitlik ME alanının yorumu. Çerçeve ayrıştırma Mode-S motorundan gelir, KOPYALANMAZ. Çözülen Type Code\'lar: 1–4 (uçak kimliği ve kategorisi), 9–18 ve 20–22 (havada konum), 19 (havada hız). TC 5–8 (yüzey konumu), 23–27, 28, 29 ve 31 TANINIR ama payload ham kalır. 978 MHz UAT ayrı bir tel biçimidir ve KAPSAM DIŞIDIR. CPR enlem/boylamı HAM basılır: global konum bir Even + bir Odd çerçevesi ister ve tek çerçeveden üretilemez. Uçak tablosu ve mesaj yaşı çerçeveler arası iştir, bu çözücüye girmez.',
  'protocol.adsb.error.empty': 'Girdi boş.',
  'protocol.adsb.error.invalidLength':
    'ADS-B 1090ES mesajı 14 bayt (112 bit) uzun Mode S çerçevesidir.',
  'protocol.adsb.error.aborted': 'Çözümleme iptal edildi.',
  'protocol.adsb.error.frameTooLong': 'Çerçeve izin verilen azami uzunluğu aşıyor.',
  'protocol.adsb.error.notExtendedSquitter':
    'ADS-B 1090ES yalnız DF17/DF18 extended squitter\'ında taşınır; bu çerçevenin DF\'i farklı. Bir DF20 Comm-B yanıtının MB alanı ME gibi GÖRÜNÜR ama Type Code taşımaz — çerçeve Mode-S sayfasında çözülür.',
  'protocol.adsb.error.parityMismatch':
    'PI alanı hesaplanan CRC-24 ile eşleşmiyor — ME alanı bozuk baytlar üzerinde çözüldü.',

  'protocol.adsb.warning.typeCodeNotDecoded':
    'Bu Type Code tanınıyor ama payload\'ı bu sürümde çözülmüyor; ME alanı HAM bırakıldı.',
  'protocol.adsb.warning.cprNotConvertedToGlobalPosition':
    'CPR enlem/boylamı HAM basıldı: global konum bir Even (F=0) ve bir Odd (F=1) çerçevesi ister, tek çerçeveden üretilemez.',
  'protocol.adsb.warning.uatOutOfScope':
    'Bu çözücü 1090ES kapsamındadır; 978 MHz UAT ayrı bir tel biçimidir (farklı çerçeveleme, farklı FEC) ve kapsam dışıdır.',
  'protocol.adsb.warning.messageDecodedOnFailedCrc':
    'CRC-24 tutmadı; ME alanı yine de çözüldü ama BOZUK baytlar üzerinde. Düzeltme adayı üretilmez.',

  'protocol.adsb.field.typeCodeNotDecoded': 'Bu Type Code\'un payload\'ı çözülmüyor.',
  'protocol.adsb.field.categoryRequiresRevision':
    'Kategorinin metin karşılığı ICAO/DO-260 revizyonuna bağlıdır — yalnız sayı basılır.',
  'protocol.adsb.field.nicSupplementRequiresVersion':
    'Bitin anlamı ADS-B sürümüne göre değişir (v0 Single Antenna Flag, v1/v2 NIC Supplement-B) ve sürüm bu çerçevede yoktur.',
  'protocol.adsb.field.altitudeGillhamNotDecoded':
    'Q biti 0 — 100 ft\'lik Gillham (Gray) kodlaması bu sürümde çözülmüyor, 12 bit ham bırakıldı.',
  'protocol.adsb.field.altitudeGnssNotDecoded':
    'GNSS yüksekliğinin ölçeği DO-260 revizyonuna bağlıdır — 12 bit ham bırakıldı.',
  'protocol.adsb.field.altitudeUnavailable': 'Altitude kodu sıfır — irtifa bilgisi yok.',
  'protocol.adsb.field.cprRawNotDegrees':
    'Ham CPR değeri derece DEĞİLDİR, kodlanmış bir tam sayıdır.',
  'protocol.adsb.field.callsignInvalidCharacter':
    'Callsign ICAO 6-bit alfabesinde olmayan bir karakter içeriyor.',
  'protocol.adsb.field.valueUnavailable': 'Kodlanan değer “mevcut değil” anlamına geliyor.',
  'protocol.adsb.field.velocitySubtypeUnknown':
    'Bu hız alt tipi tanımlı değil — bileşen alanları çözülmedi.',

  'protocol.adsb.example.identificationKlm.name': 'Uçak kimliği — KLM1023 (TC 4)',
  'protocol.adsb.example.identificationKlm.description':
    'Gerçek bir yakalama (mode-s.org): ICAO 4840D6, Type Code 4, callsign 8 × 6 bitlik ICAO alfabesinden çözülür.',
  'protocol.adsb.example.identificationEzy.name': 'Uçak kimliği — EZY85MH (TC 4)',
  'protocol.adsb.example.identificationEzy.description':
    'İkinci bağımsız kaynaktan (pyModeS belgeleri) gerçek bir yakalama: ICAO 406B90.',
  'protocol.adsb.example.positionEven.name': 'Havada konum — Even çerçeve (TC 11)',
  'protocol.adsb.example.positionEven.description':
    'Gerçek bir yakalama (mode-s.org). Barometrik irtifa Q=1 dalıyla çözülür (38 000 ft); CPR enlem/boylamı HAM kalır.',
  'protocol.adsb.example.positionOdd.name': 'Havada konum — Odd çerçeve (TC 11)',
  'protocol.adsb.example.positionOdd.description':
    'Bir öncekinin Odd (F=1) eşi. İkisi BİRLİKTE global konum verirdi — ama bu çerçeveler arası bir hesaptır ve parser\'a girmez.',
  'protocol.adsb.example.velocityGroundSpeed.name': 'Havada hız — yer hızı (TC 19, alt tip 1)',
  'protocol.adsb.example.velocityGroundSpeed.description':
    'Gerçek bir yakalama (mode-s.org): yer hızı 159 kt, iz açısı 182,88°, dikey hız −832 ft/dk. Üçü de AYNI çerçeveden türetilir.',
  'protocol.adsb.example.velocityAirspeed.name': 'Havada hız — hava hızı (TC 19, alt tip 3)',
  'protocol.adsb.example.velocityAirspeed.description':
    'Gerçek bir yakalama (mode-s.org): başlık 243,98°, TAS 375 kt, dikey hız −2304 ft/dk (barometrik kaynak).',
  'protocol.adsb.example.df18Identification.name': 'DF18 — transponder olmayan yayıncı',
  'protocol.adsb.example.df18Identification.description':
    'DF17 ile AYNI ME yükü, ama DF18 (CF alanı). ADS-B çözücüsü ikisini de kabul eder; parite yine düz CRC\'dir.',
  'protocol.adsb.example.surfacePosition.name': 'Yüzey konumu (TC 7) — tanınır, çözülmez',
  'protocol.adsb.example.surfacePosition.description':
    'Type Code adlandırılır ama payload HAM bırakılır: yüzey konumu bu sürümün kapsamı dışındadır.',
  'protocol.adsb.example.operationStatus.name': 'Uçak işletim durumu (TC 31) — tanınır, çözülmez',
  'protocol.adsb.example.operationStatus.description':
    'Alan tahsisi ICAO/DO-260 revizyon veritabanına bağlıdır; payload yakıştırılmaz.',
  'protocol.adsb.example.crcFail.name': 'CRC FAIL — ME yine çözülür',
  'protocol.adsb.example.crcFail.description':
    'İlk örneğin bir ME baytı bozuldu. Kısmi çözüm gösterilir ama çerçeve geçersizdir ve düzeltme adayı ÜRETİLMEZ.',
  'protocol.adsb.example.notExtendedSquitter.name': 'ADS-B değil — DF20 Comm-B yanıtı',
  'protocol.adsb.example.notExtendedSquitter.description':
    'Gerçek bir DF20 yakalaması. MB alanı DF17\'nin ME alanıyla BİREBİR aynı görünür ve ilk baytı 0x20\'dir — Type Code sanılırsa sessizce yanlış çözülürdü. Çerçeve reddedilir.',

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

  // --- ICMP ---
  'protocol.icmp.error.frameTooShort': 'Çerçeve en az 8 baytlık ortak ICMP başlığı kadar uzun olmalı.',
  'protocol.icmp.error.frameTooLong': 'Çerçeve izin verilen azami uzunluğu aşıyor.',
  'protocol.icmp.error.aborted': 'Çözümleme iptal edildi.',
  'protocol.icmp.error.checksumMismatch': 'Checksum hesaplanan değerle uyuşmuyor.',
  'protocol.icmp.warning.unknownType':
    'Type dar kümenin (Echo Reply/Request, Destination Unreachable, Time Exceeded) dışında — gövde çözülmez.',
  'protocol.icmp.warning.unknownCode': 'Code, bu Type için bilinen değerler kümesinde değil.',
  'protocol.icmp.documentation.summary':
    'IPv4 üzerinde kontrol ve hata bildirimi — ping/traceroute\'un temeli. Echo, Destination Unreachable ve Time Exceeded mesajları alan alana çözülür; eşleştirme/RTT/hop analizi ayrı bir araçtır.',
  'protocol.icmp.example.echoRequest.name': 'Echo Request (ping)',
  'protocol.icmp.example.echoRequest.description':
    'Type=8, Code=0, Identifier/Sequence=1, 4 baytlık veri — checksum bağımsız hesaplandı.',
  'protocol.icmp.example.echoReply.name': 'Echo Reply (ping yanıtı)',
  'protocol.icmp.example.echoReply.description':
    'Type=0, Code=0, Echo Request ile aynı Identifier/Sequence/veri — checksum bağımsız hesaplandı.',
  'protocol.icmp.example.destinationUnreachablePort.name': 'Destination Unreachable — Port Unreachable',
  'protocol.icmp.example.destinationUnreachablePort.description':
    'Type=3, Code=3, original datagram olarak kısmi bir IPv4 başlığı taşır.',
  'protocol.icmp.example.timeExceededTtl.name': 'Time Exceeded — TTL Exceeded in Transit',
  'protocol.icmp.example.timeExceededTtl.description':
    'Type=11, Code=0 — traceroute\'un temelindeki mesaj.',
  'protocol.icmp.example.checksumFail.name': 'Bozuk checksum (hata yolu)',
  'protocol.icmp.example.checksumFail.description':
    'Checksum alanı bilerek 0x0000 yazıldı — checksum-mismatch basar.',
  'protocol.icmp.example.unknownType.name': 'Tanınmayan Type',
  'protocol.icmp.example.unknownType.description':
    'Type=30, dar kümenin dışında — gövde çözülmeden ham gösterilir.',

  // --- ICMPv6 ---
  'protocol.icmpv6.error.frameTooShort': 'Çerçeve en az 8 baytlık ortak ICMPv6 başlığı kadar uzun olmalı.',
  'protocol.icmpv6.error.frameTooLong': 'Çerçeve izin verilen azami uzunluğu aşıyor.',
  'protocol.icmpv6.error.aborted': 'Çözümleme iptal edildi.',
  'protocol.icmpv6.warning.unknownType':
    'Type, RFC 4443 çekirdeği ve Neighbor Discovery ailesinin dışında — gövde çözülmez.',
  'protocol.icmpv6.warning.unknownCode': 'Code, bu Type için bilinen değerler kümesinde değil.',
  'protocol.icmpv6.warning.neighborDiscoveryDeferred':
    'Neighbor Discovery mesajı (RFC 4861) — Type adlandırılır ama alan alana çözümü ayrı bir iş; gövde ham gösterilir.',
  'protocol.icmpv6.warning.checksumNeedsPseudoHeader':
    'Checksum IPv6 pseudo-header (kaynak/hedef adres) ister — tek başına doğrulanamaz, ham gösterilir.',
  'protocol.icmpv6.documentation.summary':
    'IPv6 üzerinde kontrol ve hata bildirimi (Next Header 58). Destination Unreachable, Packet Too Big, Time Exceeded, Parameter Problem ve Echo alan alana çözülür; Neighbor Discovery ailesi adlandırılır, gövdesi ayrı bir işte çözülecek.',
  'protocol.icmpv6.example.echoRequest.name': 'Echo Request (ping)',
  'protocol.icmpv6.example.echoRequest.description':
    'Type=128, Code=0, Identifier/Sequence=1, 4 baytlık veri.',
  'protocol.icmpv6.example.packetTooBig.name': 'Packet Too Big — Path MTU Discovery',
  'protocol.icmpv6.example.packetTooBig.description':
    'Type=2, MTU=1280 (IPv6\'nın asgari zorunlu MTU\'su) — PMTUD\'nin klasik örneği.',
  'protocol.icmpv6.example.destinationUnreachablePort.name': 'Destination Unreachable — Port Unreachable',
  'protocol.icmpv6.example.destinationUnreachablePort.description':
    'Type=1, Code=4, invoking packet olarak kısmi bir IPv6 başlığı taşır.',
  'protocol.icmpv6.example.routerSolicitationDeferred.name': 'Router Solicitation (Neighbor Discovery, ertelendi)',
  'protocol.icmpv6.example.routerSolicitationDeferred.description':
    'Type=133 adlandırılır ama gövdesi bu motorda çözülmez — ayrı bir işin kapsamı.',
  'protocol.icmpv6.example.unknownType.name': 'Tanınmayan Type',
  'protocol.icmpv6.example.unknownType.description':
    'Type=200, dar kümenin dışında — gövde çözülmeden ham gösterilir.',

  // --- ARP ---
  'protocol.arp.error.frameTooShort': 'Çerçeve en az 8 baytlık sabit ARP başlığı kadar uzun olmalı.',
  'protocol.arp.error.frameTooLong': 'Çerçeve izin verilen azami uzunluğu aşıyor.',
  'protocol.arp.error.aborted': 'Çözümleme iptal edildi.',
  'protocol.arp.error.addressesTruncated':
    'Hardware/Protocol Length alanlarının bildirdiği toplam uzunluk tampondan büyük.',
  'protocol.arp.warning.unknownOperation':
    'Operation dar kümenin (Request/Reply) dışında.',
  'protocol.arp.documentation.summary':
    'IPv4 adresini yerel bağlantıdaki MAC adresine çözen broadcast request/reply akışı. Adres uzunlukları telden okunur, sabitlenmez; IP↔MAC tablosu ve conflict detector ayrı bir araçtır.',
  'protocol.arp.example.request.name': 'ARP Request',
  'protocol.arp.example.request.description':
    'Spec\'in "Who has 192.168.1.20? Tell 192.168.1.10" örneği — Target Hardware Address sıfır (henüz bilinmiyor).',
  'protocol.arp.example.reply.name': 'ARP Reply',
  'protocol.arp.example.reply.description':
    '"192.168.1.20 is at AA:BB:CC:DD:EE:FF" — Sender/Target rolleri Request\'e göre ters döner.',
  'protocol.arp.example.padded.name': 'Ethernet dolgusuyla (Padding)',
  'protocol.arp.example.padded.description':
    'Ethernet asgari 64 baytlık çerçeve kuralı 28 baytlık ARP\'a 32 bayt dolgu ekletir — hata değil, saha gerçeği.',
  'protocol.arp.example.unknownOperation.name': 'Tanınmayan Operation',
  'protocol.arp.example.unknownOperation.description':
    'Operation=5, dar kümenin (Request/Reply) dışında — HATA değil UYARI basar.',

  // --- LLDP ---
  'protocol.lldp.error.frameTooShort': 'Çerçeve en az bir TLV başlığı (2 bayt) kadar uzun olmalı.',
  'protocol.lldp.error.frameTooLong': 'Çerçeve izin verilen azami uzunluğu aşıyor.',
  'protocol.lldp.error.aborted': 'Çözümleme iptal edildi.',
  'protocol.lldp.error.tlvTruncated':
    'Bir TLV\'nin bildirdiği uzunluk tampondan büyük — yürüyüş burada durur.',
  'protocol.lldp.warning.missingEndTlv':
    'End Of LLDPDU TLV\'si (Type 0) bulunamadı — LLDPDU tamponun sonunda eksik bitmiş olabilir.',
  'protocol.lldp.warning.endTlvLengthNotZero':
    'End Of LLDPDU TLV\'sinin Length alanı 0 olmalı.',
  'protocol.lldp.warning.unrecognizedTlvType':
    'TLV türü bilinen kümenin (Chassis/Port ID, TTL, açıklamalar, Capabilities, Management Address, Organizationally Specific) dışında — ham gösterilir.',
  'protocol.lldp.documentation.summary':
    'Komşu cihazların kimlik/topoloji bilgisini TLV dizisi olarak duyurduğu protokol (IEEE 802.1AB). Zorunlu TLV\'ler (Chassis ID, Port ID, TTL) ve isteğe bağlı olanların çoğu alan alana çözülür; Organizationally Specific TLV\'ler OUI/Subtype düzeyinde bırakılır, vendor adı çözümü ayrı bir tanım kaynağıdır.',
  'protocol.lldp.example.switchNeighbor.name': 'Switch komşuluğu (Chassis/Port ID + Capabilities)',
  'protocol.lldp.example.switchNeighbor.description':
    'Chassis ID (MAC) + Port ID (arayüz adı) + TTL 120s + System Name + System Capabilities (Bridge/Router duyurulur, yalnız Bridge etkin).',
  'protocol.lldp.example.managementAddressIpv4.name': 'Management Address (IPv4)',
  'protocol.lldp.example.managementAddressIpv4.description':
    'Address Subtype=IPv4, adres 192.168.1.1, Interface Number=1.',
  'protocol.lldp.example.organizationallySpecific.name': 'Organizationally Specific TLV',
  'protocol.lldp.example.organizationallySpecific.description':
    'OUI/Subtype ayrıştırılır, veri ham bırakılır — vendor adı çözümü katalogdaki tanım kaynağının işi.',
  'protocol.lldp.example.missingEndTlv.name': 'End TLV eksik (uyarı yolu)',
  'protocol.lldp.example.missingEndTlv.description':
    'Yalnız TTL TLV\'si var, End Of LLDPDU yok — HATA değil UYARI basar.',
  'protocol.lldp.example.truncatedTlv.name': 'Kesik TLV (hata yolu)',
  'protocol.lldp.example.truncatedTlv.description':
    'TTL TLV\'si 2 bayt bildiriyor ama tamponda yalnız 1 bayt var — truncated-frame basar.',

  // --- DNS Wire (dns.ts + mdns.ts paylaşır) ---
  'protocol.dnsWire.error.frameTooShort': 'Çerçeve en az 12 baytlık sabit DNS başlığı kadar uzun olmalı.',
  'protocol.dnsWire.error.frameTooLong': 'Çerçeve izin verilen azami uzunluğu aşıyor.',
  'protocol.dnsWire.error.aborted': 'Çözümleme iptal edildi.',
  'protocol.dnsWire.error.nameTruncated': 'Bir isim (NAME/QNAME) tamponun sonuna kesildi.',
  'protocol.dnsWire.error.nameLoop':
    'Bir isim pointer\'ı kendi kendine (ya da bir döngüye) işaret ediyor — çözümleme durduruldu.',
  'protocol.dnsWire.error.recordTruncated':
    'Bir kaydın (question/answer/authority/additional) sabit alanları ya da RDATA\'sı tampona sığmıyor.',
  'protocol.dnsWire.warning.unknownType': 'TYPE dar kümenin (A/NS/CNAME/SOA/PTR/MX/TXT/AAAA/SRV) dışında.',
  'protocol.dnsWire.warning.unknownClass': 'CLASS dar kümenin (yalnız IN) dışında.',
  'protocol.dnsWire.warning.tooManyRecords':
    'Bir bölümün bildirdiği kayıt sayısı güvenlik tavanını aşıyor — kalanı işlenmedi.',

  // --- DNS ---
  'protocol.dns.documentation.summary':
    'Unicast resolver sorgu/yanıt protokolü (RFC 1035). Header/Question/Answer/Authority/Additional bölümleri alan alana çözülür, isim sıkıştırması döngü korumalı çözülür; transaction eşleştirme/response time ayrı bir araçtır.',
  'protocol.dns.example.simpleQuery.name': 'Basit sorgu (A kaydı)',
  'protocol.dns.example.simpleQuery.description': 'QR=0, RD=1 — example.com için A kaydı sorgusu.',
  'protocol.dns.example.responseWithAnswer.name': 'Yanıt + sıkıştırılmış isim',
  'protocol.dns.example.responseWithAnswer.description':
    'Spec\'in kendi örneği: Flags 0x8180, Answer NAME\'i soru adını 0xC00C pointer\'ıyla sıkıştırır.',
  'protocol.dns.example.cnameChain.name': 'CNAME kaydı',
  'protocol.dns.example.cnameChain.description': 'www.example.com → example.com (CNAME, TTL 60s).',
  'protocol.dns.example.nxdomain.name': 'NXDOMAIN yanıtı',
  'protocol.dns.example.nxdomain.description': 'RCODE=3 (NXDOMAIN) — kayıt yok.',
  'protocol.dns.example.nameLoop.name': 'İsim döngüsü (hata yolu)',
  'protocol.dns.example.nameLoop.description':
    'Soru adı kendi kendini gösteren bir pointer — spec\'in "parser\'ı kilitlememeli" uyarısının en dar örneği.',

  // --- mDNS ---
  'protocol.mdns.documentation.summary':
    'DNS tel biçimini UDP multicast üzerinden (port 5353) .local namespace\'inde kullanan isim çözümü (RFC 6762). Tek fark CLASS alanının üst biti: soruda "unicast tercih edilir", yanıtta "cache flush". mDNS ≠ DNS-SD.',
  'protocol.mdns.example.queryLocal.name': 'Sorgu (.local)',
  'protocol.mdns.example.queryLocal.description': 'device.local için A kaydı sorgusu — spec\'in örneği.',
  'protocol.mdns.example.unicastResponseRequested.name': 'Unicast yanıt tercihi (QU biti)',
  'protocol.mdns.example.unicastResponseRequested.description':
    'QCLASS\'ın üst biti set — sorgulayıcı unicast yanıt tercih ediyor (RFC 6762 §5.4).',
  'protocol.mdns.example.responseCacheFlush.name': 'Yanıt + cache flush biti',
  'protocol.mdns.example.responseCacheFlush.description':
    'CLASS\'ın üst biti set — bu kayıt öncekilerin yerine geçer (RFC 6762 §10.2).',
  'protocol.mdns.example.queryWithAnswerCompressed.name': 'Sorgu + sıkıştırılmış yanıt',
  'protocol.mdns.example.queryWithAnswerCompressed.description':
    'Answer NAME\'i soru adını pointer\'la sıkıştırır — dns.ts\'teki örneğin mDNS emsali.',

  // --- DHCP ---
  'protocol.dhcp.error.frameTooShort':
    'Çerçeve en az 236 baytlık sabit BOOTP gövdesi kadar uzun olmalı.',
  'protocol.dhcp.error.frameTooLong': 'Çerçeve izin verilen azami uzunluğu aşıyor.',
  'protocol.dhcp.error.aborted': 'Çözümleme iptal edildi.',
  'protocol.dhcp.error.magicCookieMismatch': 'Magic Cookie beklenen 0x63825363 değerini taşımıyor.',
  'protocol.dhcp.error.optionTruncated': 'Bir option\'ın bildirdiği uzunluk tampondan büyük.',
  'protocol.dhcp.warning.unknownOp': 'op dar kümenin (BOOTREQUEST/BOOTREPLY) dışında.',
  'protocol.dhcp.warning.missingEndOption':
    'End option\'ı (255) bulunamadı — mesaj tamponun sonunda eksik bitmiş olabilir.',
  'protocol.dhcp.warning.unknownMessageType':
    'DHCP Message Type (option 53) dar kümenin (DISCOVER/OFFER/REQUEST/DECLINE/ACK/NAK/RELEASE/INFORM) dışında.',
  'protocol.dhcp.documentation.summary':
    'BOOTP mesaj yapısı üstüne kurulu host konfigürasyon protokolü (RFC 2131), DORA akışının (Discover/Offer/Request/Acknowledge) temeli. Options klasik TLV8\'dir; spec\'in adlandırdığı yedi kod alan alana çözülür, kalanı ham gösterilir. DORA eşleştirme/lease takibi ayrı bir araçtır.',
  'protocol.dhcp.example.discover.name': 'DHCPDISCOVER',
  'protocol.dhcp.example.discover.description': 'DORA akışının ilk adımı — BOOTREQUEST, Message Type=DISCOVER.',
  'protocol.dhcp.example.offer.name': 'DHCPOFFER',
  'protocol.dhcp.example.offer.description':
    'BOOTREPLY, Subnet Mask/Router/Lease Time/Server Identifier option\'larıyla birlikte.',
  'protocol.dhcp.example.unknownMessageType.name': 'Tanınmayan Message Type',
  'protocol.dhcp.example.unknownMessageType.description':
    'Option 53 değeri 99, dar kümenin dışında — HATA değil UYARI basar.',
  'protocol.dhcp.example.badMagicCookie.name': 'Bozuk Magic Cookie (hata yolu)',
  'protocol.dhcp.example.badMagicCookie.description':
    'Cookie\'nin ilk baytı bilerek bozuldu — value-out-of-range basar, options işlenmez.',

  // --- NTP ---
  'protocol.ntp.error.frameTooShort': 'Çerçeve en az 48 baytlık sabit NTP başlığı kadar uzun olmalı.',
  'protocol.ntp.error.frameTooLong': 'Çerçeve izin verilen azami uzunluğu aşıyor.',
  'protocol.ntp.error.aborted': 'Çözümleme iptal edildi.',
  'protocol.ntp.warning.leapAlarm':
    'Leap Indicator 3 (alarm): sunucu senkronize değil, damgalarına güvenilmemeli.',
  'protocol.ntp.warning.unknownMode': 'Mode dar kümenin (1-6) dışında — 0 rezerve, 7 üreticiye özel.',
  'protocol.ntp.warning.unexpectedVersion':
    'Version 4 değil. Başlık düzeni v3 ile aynı olduğu için çözüme devam edildi, alan adları v4’e göre verildi.',
  'protocol.ntp.warning.kissOfDeath':
    'Stratum 0: Reference ID bir “kiss code”dur (DENY/RATE/RSTR…), sunucu isteği reddediyor.',
  'protocol.ntp.warning.stratumUnsynchronized': 'Stratum 16: saat senkronize değil.',
  'protocol.ntp.warning.stratumReserved': 'Stratum 17-255 aralığı rezervedir, tanımlı bir anlamı yok.',
  'protocol.ntp.warning.referenceIdMayNotBeAddress':
    'Reference ID IPv4 adresi olarak gösterildi, ama IPv6 kurulumlarında bu dört bayt adres değil adresin MD5 özetinin ilk dört baytıdır (RFC 5905 §7.3).',
  'protocol.ntp.warning.timestampEra1':
    'Damganın en anlamlı biti temiz — RFC kuralına göre era 1 (2036-02-07 sonrası) varsayıldı. Era çerçeveden kanıtlanamaz.',
  'protocol.ntp.warning.timestampUnset': 'Damganın 64 bitinin tamamı sıfır: alan ayarlanmamış, 1900 tarihi değil.',
  'protocol.ntp.warning.unknownAuthenticator':
    'Başlıktan sonraki bayt sayısı tanınan authenticator uzunluklarından (4 / 20 / 24) hiçbiri değil.',
  'protocol.ntp.warning.serverTimeNegative':
    'Transmit damgası Receive damgasından küçük: sunucu saati geri gitmiş ya da bu bir yanıt değil.',
  'protocol.ntp.warning.fourTimestampNeedsT4':
    'Round Trip Delay ve Clock Offset basılmadı: T4 istemcinin yanıtı aldığı andaki kendi saatidir ve pakete yazılmaz. Dört damga modeli çok-paket analizi ister.',
  'protocol.ntp.documentation.summary':
    'Dört damgalı istemci/sunucu zaman protokolü (RFC 5905, NTPv4). 48 baytlık sabit başlık alan alana çözülür; Reference ID’nin anlamı stratum’a göre değişir (kiss code / referans saat kimliği / yukarı akış adresi). Tek çerçeveden T3−T2 türetilir; delay ve offset T4’ü gerektirdiği için analyzer işidir.',
  'protocol.ntp.example.clientRequest.name': 'İstemci isteği (Mode 3)',
  'protocol.ntp.example.clientRequest.description':
    'Origin/Receive damgaları sıfır — “ayarlanmamış” yolu; yalnız Transmit dolu.',
  'protocol.ntp.example.serverResponse.name': 'Sunucu yanıtı (Stratum 2)',
  'protocol.ntp.example.serverResponse.description':
    'Reference ID yukarı akış IPv4 adresi; T3−T2 ≈ 2 ms türetilir.',
  'protocol.ntp.example.stratum1Gps.name': 'Stratum 1 — GPS referansı',
  'protocol.ntp.example.stratum1Gps.description':
    'Reference ID ASCII referans saat kimliğidir (“GPS”), adres değil.',
  'protocol.ntp.example.kissOfDeath.name': 'Kiss-o’-Death (RATE)',
  'protocol.ntp.example.kissOfDeath.description':
    'Stratum 0 + “RATE” kiss code: sunucu istemciyi yavaşlamaya zorluyor, LI alarm.',
  'protocol.ntp.example.truncated.name': 'Kesilmiş çerçeve (hata yolu)',
  'protocol.ntp.example.truncated.description': '48 baytın altı — truncated-frame basar.',

  // --- PTP ---
  'protocol.ptp.error.frameTooShort': 'Çerçeve en az 34 baytlık ortak PTP başlığı kadar uzun olmalı.',
  'protocol.ptp.error.frameTooLong': 'Çerçeve izin verilen azami uzunluğu aşıyor.',
  'protocol.ptp.error.aborted': 'Çözümleme iptal edildi.',
  'protocol.ptp.error.bodyTruncated': 'Mesaj tipinin gerektirdiği gövde tamponun sonuna kesilmiş.',
  'protocol.ptp.warning.unknownMessageType':
    'messageType tanımlı on değerden hiçbiri değil — gövde ham gösterildi.',
  'protocol.ptp.warning.unexpectedVersion':
    'versionPTP 2 değil. PTPv1 başlık düzeni tamamen farklıdır, bu motor onu çözemez.',
  'protocol.ptp.warning.messageLengthMismatch':
    'messageLength gerçek çerçeve uzunluğuyla uyuşmuyor. Fazlalık taşıyıcı dolgusu olabilir; eksiklik gerçek kesilmedir.',
  'protocol.ptp.warning.controlFieldMismatch':
    'Legacy controlField mesaj tipiyle çelişiyor. Alan v2’de kullanım dışıdır ama tutarsızlık bozuk üretici işaretidir.',
  'protocol.ptp.warning.twoStepIgnored':
    'twoStepFlag set ama bu mesaj tipinde davranışı tanımsız — “Two-Step” diye yorumlanmadı.',
  'protocol.ptp.warning.timestampUnset':
    'Damganın 80 bitinin tamamı sıfır: alan taşınmamış. Two-step Sync’te asıl damga Follow_Up’ta gelir.',
  'protocol.ptp.warning.timestampTai':
    'Damga TAI ölçeğindedir. UTC’ye çevirmek Announce’un currentUtcOffset alanını gerektirir.',
  'protocol.ptp.warning.nanosecondsOutOfRange': 'nanosecondsField bir saniyeyi aşıyor.',
  'protocol.ptp.warning.unknownClockClass': 'clockClass IEEE 1588-2019 Tablo 4’ün adlandırdığı değerlerden değil.',
  'protocol.ptp.warning.unknownClockAccuracy': 'clockAccuracy Tablo 5 enumerasyonunun dışında.',
  'protocol.ptp.warning.unknownTimeSource': 'timeSource Tablo 6 enumerasyonunun dışında.',
  'protocol.ptp.warning.unknownTlvType': 'tlvType dar kümenin dışında — gövdesi ham bırakıldı.',
  'protocol.ptp.warning.tlvOddLength': 'TLV lengthField’i tek sayı; IEEE 1588-2019 §14.1.1 çift olmasını şart koşar.',
  'protocol.ptp.warning.tlvTruncated': 'Bir TLV’nin bildirdiği uzunluk tamponda kalan bayttan büyük.',
  'protocol.ptp.warning.tlvLimit': 'TLV sayısı üst sınıra dayandı, zincir okunmayı bıraktı.',
  'protocol.ptp.warning.bmcaNeedsMultipleAnnounce':
    'BMCA veri kümesi (Priority1/ClockClass/ClockAccuracy/Variance/Priority2/ClockIdentity) çözüldü, ama “Selected Grandmaster” kararı Announce mesajlarını karşılaştırmayı gerektirir.',
  'protocol.ptp.warning.pathDelayNeedsExchange':
    'MeanPathDelay ve OffsetFromMaster basılmadı: t1/t2/t3/t4 dört ayrı mesajda taşınır, tek çerçeveden çıkmaz.',
  'protocol.ptp.documentation.summary':
    'IEEE 1588-2019 (PTPv2.1) saat senkronizasyonu. 34 baytlık ortak başlık ve on mesaj tipinin gövdesi alan alana çözülür; correctionField işaretli ve nanosaniye × 2^16 ölçeğindedir, damgalar 80 bittir (48 bit saniye + 32 bit nanosaniye, TAI). TLV zinciri başlık düzeyinde yürünür. BMCA kararı ve E2E gecikme çok-mesaj analizidir.',
  'protocol.ptp.example.syncTwoStep.name': 'Sync (two-step)',
  'protocol.ptp.example.syncTwoStep.description':
    'twoStepFlag set, originTimestamp sıfır — asıl t1 Follow_Up’ta gelir.',
  'protocol.ptp.example.followUp.name': 'Follow_Up + correctionField',
  'protocol.ptp.example.followUp.description':
    'preciseOriginTimestamp dolu; correctionField transparent clock’un biriktirdiği 1250,5 ns.',
  'protocol.ptp.example.announce.name': 'Announce (BMCA veri kümesi)',
  'protocol.ptp.example.announce.description':
    'Priority1=128, clockClass=6 (GNSS’e kilitli), timeSource=GNSS, currentUtcOffset=37 s.',
  'protocol.ptp.example.delayRespNegativeCorrection.name': 'Delay_Resp — negatif correctionField',
  'protocol.ptp.example.delayRespNegativeCorrection.description':
    'correctionField −500 ns; işaretsiz okunursa astronomik bir sayıya dönüşürdü.',
  'protocol.ptp.example.signalingWithTlv.name': 'Signaling + TLV16',
  'protocol.ptp.example.signalingWithTlv.description':
    'REQUEST_UNICAST_TRANSMISSION TLV’si (tip 0x0004, 6 baytlık gövde) — LLDP ve DHCP’ninkinden farklı üçüncü TLV lehçesi.',
  'protocol.ptp.example.truncatedBody.name': 'Gövdesi eksik Announce (hata yolu)',
  'protocol.ptp.example.truncatedBody.description': 'Başlık var, 30 baytlık Announce gövdesi yok.',

  // --- SNMP ---
  'protocol.snmp.error.frameTooShort': 'Çerçeve en az bir SEQUENCE başlığı ve sürüm alanı kadar uzun olmalı.',
  'protocol.snmp.error.frameTooLong': 'Çerçeve izin verilen azami uzunluğu aşıyor.',
  'protocol.snmp.error.aborted': 'Çözümleme iptal edildi.',
  'protocol.snmp.error.notASequence': 'Dış TLV bir SEQUENCE değil — her SNMP mesajı SEQUENCE ile başlar.',
  'protocol.snmp.error.ber': 'BER kodlaması okunamadı; ayrıntı hata kodundadır.',
  'protocol.snmp.warning.unknownVersion':
    'Sürüm alanı 0 (v1), 1 (v2c) ya da 3 (v3) değil. Hangi şemanın uygulanacağı bilinmediği için gövde çözülmedi.',
  'protocol.snmp.warning.unknownPduType': 'PDU etiketi tanımlı dokuz işlemden hiçbiri değil.',
  'protocol.snmp.warning.trapV1Only':
    'Trap-PDU (0xA4) yalnız SNMPv1’de tanımlıdır; v2c/v3 mesajında görülmesi spec dışıdır.',
  'protocol.snmp.warning.unknownErrorStatus': 'Error Status RFC 1157/3416’nın adlandırdığı kümenin dışında.',
  'protocol.snmp.warning.unknownGenericTrap': 'Generic Trap 0-6 aralığının dışında.',
  'protocol.snmp.warning.communityInClear':
    'Community düz metindir ve v1/v2c’de tek kimlik denetimidir — hat üzerinde okunabilir.',
  'protocol.snmp.warning.unknownValueTag': 'VarBind değerinin etiketi tanınan tipler kümesinde değil; ham gösterildi.',
  'protocol.snmp.warning.oidNotInTable':
    'Bir ya da daha çok OID yerleşik tabloda yok. Tam çözüm MIB importunu gerektirir (Tanımlar kanalı henüz boş).',
  'protocol.snmp.warning.varbindException':
    'VarBind bir v2c istisnası taşıyor (noSuchObject / noSuchInstance / endOfMibView) — değer yok, durum var.',
  'protocol.snmp.warning.encryptedScopedPdu':
    'ScopedPDU şifreli. Çözmek USM anahtarını gerektirir; bu araç anahtar tutmaz.',
  'protocol.snmp.warning.unknownSecurityModel': 'Security Model 1/2/3 dışında; güvenlik parametrelerinin iç yapısı bilinmiyor.',
  'protocol.snmp.warning.varbindLimit': 'VarBind sayısı üst sınıra dayandı, liste okunmayı bıraktı.',
  'protocol.snmp.warning.ipAddressLength': 'IpAddress 4 bayt olmak zorundadır; adres olarak biçimlenmedi.',
  'protocol.snmp.documentation.summary':
    'BER kodlu ağ yönetim protokolü (RFC 1157 v1 · RFC 3416 v2c · RFC 3412 v3). Mesaj `berReader.ts` üstünde TLV TLV çözülür; OID’ler X.690 base-128 kodlamasından açılır, Counter32/Gauge32/TimeTicks/Counter64 işaretsiz okunur ve TimeTicks saniyenin yüzde biri olarak biçimlenir. v1 Trap-PDU’nun ayrı gövdesi ve GetBulk’un non-repeaters/max-repetitions alanları ayrı ele alınır. v3’te zarf ve USM parametreleri çözülür, şifreli ScopedPDU çözülmez. MIB importu Tanımlar kanalının işidir.',
  'protocol.snmp.example.getRequestV2c.name': 'GetRequest (v2c)',
  'protocol.snmp.example.getRequestV2c.description': 'sysUpTime.0 sorgusu; değer alanı NULL.',
  'protocol.snmp.example.responseTimeticks.name': 'Response — TimeTicks',
  'protocol.snmp.example.responseTimeticks.description':
    '360 000 tick = 1 saat. Ham sayı saniye sanılsaydı 100 saat görünürdü.',
  'protocol.snmp.example.responseCounter32High.name': 'Response — yüksek Counter32',
  'protocol.snmp.example.responseCounter32High.description':
    'Counter32 = 3 000 000 000; işaretli okunsaydı −1 294 967 296 çıkardı.',
  'protocol.snmp.example.getBulkRequest.name': 'GetBulkRequest',
  'protocol.snmp.example.getBulkRequest.description':
    'İkinci ve üçüncü INTEGER hata alanı değil: non-repeaters = 0, max-repetitions = 10.',
  'protocol.snmp.example.trapV1.name': 'Trap (v1)',
  'protocol.snmp.example.trapV1.description':
    'linkDown trap’i — gövdesi enterprise/agent-addr/generic/specific/timestamp, standart PDU’yla hiç ortak alanı yok.',
  'protocol.snmp.example.responseNoSuchObject.name': 'Response — noSuchObject',
  'protocol.snmp.example.responseNoSuchObject.description':
    'v2c istisnası: etiket 0x80, uzunluk sıfır — bilgi etiketin kendisindedir.',
  'protocol.snmp.example.v3Encrypted.name': 'SNMPv3 — authPriv',
  'protocol.snmp.example.v3Encrypted.description':
    'Zarf ve USM parametreleri (Engine ID, kullanıcı) anahtarsız okunur; ScopedPDU şifreli kalır.',
  'protocol.snmp.example.notASequence.name': 'SEQUENCE olmayan girdi (hata yolu)',
  'protocol.snmp.example.notASequence.description': 'Dış TLV bir INTEGER — çözüm başlamadan reddedilir.',

  // --- Syslog ---
  'protocol.syslog.error.frameTooShort': 'Mesaj en az `<0>1` kadar uzun olmalı.',
  'protocol.syslog.error.frameTooLong': 'Mesaj izin verilen azami uzunluğu aşıyor.',
  'protocol.syslog.error.aborted': 'Çözümleme iptal edildi.',
  'protocol.syslog.error.priMissing': 'Mesaj `<` ile başlamıyor — PRI alanı yok.',
  'protocol.syslog.error.priMalformed':
    'PRI biçimsiz: 1-3 basamak olmalı, başta sıfır taşımamalı (RFC 5424 §6.2.1) ve `>` ile kapanmalı.',
  'protocol.syslog.error.headerTruncated': 'Başlık alanlarından biri mesajın sonuna kesilmiş.',
  'protocol.syslog.error.structuredDataUnterminated': 'Structured Data elemanı kapanmadan mesaj bitti.',
  'protocol.syslog.warning.priOutOfRange':
    'PRI 191’i aşıyor. Azami değer 23 × 8 + 7’dir; üstünde tanımlı bir Facility yok.',
  'protocol.syslog.warning.legacyBsdFormat':
    'Mesaj RFC 3164 (BSD) biçiminde görünüyor: sürüm basamağı yok ve damga `Mmm dd hh:mm:ss`. RFC 5424 şeması uygulanmadı.',
  'protocol.syslog.warning.unexpectedVersion': 'VERSION alanı 1 değil; RFC 5424 yalnız sürüm 1’i tanımlar.',
  'protocol.syslog.warning.nilValue': 'Alan NILVALUE (`-`): değer yok. Metin olarak tire basılmadı.',
  'protocol.syslog.warning.timestampNotRfc3339': 'Zaman damgası RFC 3339 biçiminde değil.',
  'protocol.syslog.warning.msgWithoutBom':
    'MSG bayt sırası imiyle başlamıyor — RFC 5424 §6.4’e göre gövdenin kodlaması bilinmez.',
  'protocol.syslog.warning.severityDashboardNeedsStream':
    'Severity sayımı ve errors/minute trendi bir mesaj kümesinin işidir; tek mesajdan çıkmaz.',
  'protocol.syslog.warning.structuredDataMalformed':
    'Structured Data `NAME="VALUE"` kalıbına uymuyor; kalan kısım çözülmedi.',
  'protocol.syslog.documentation.summary':
    'Taşıyıcıdan bağımsız olay mesajı biçimi (RFC 5424). PRI baytı Facility ve Severity’yi paketler; başlık alanları NILVALUE (`-`) olabilir ve bu "değer yok" demektir. Structured Data kaçış farkındalığıyla ayrıştırılır (`\\]` eleman sonu değildir). MSG’in başındaki bayt sırası imi gövdenin UTF-8 olduğunu bildirir. RFC 3164 (BSD) biçimi tanınır ama çözülmez; Severity dashboard çok-mesaj işidir.',
  'protocol.syslog.example.headerOnly.name': 'Temel başlık (PRI 34)',
  'protocol.syslog.example.headerOnly.description': 'Facility 4, Severity 2 (Critical) — spec’in örneği.',
  'protocol.syslog.example.structuredData.name': 'Structured Data',
  'protocol.syslog.example.structuredData.description':
    '`[temperature sensor="1" value="85.2"]` — SD-ID ve iki parametre ayrı ayrı çözülür.',
  'protocol.syslog.example.escapedBracket.name': 'Kaçırılmış `]` (tuzak)',
  'protocol.syslog.example.escapedBracket.description':
    'PARAM-VALUE içindeki `\\]` eleman sonu değildir; naif bölme mesajı ortadan keserdi.',
  'protocol.syslog.example.nilValues.name': 'NILVALUE dolu başlık',
  'protocol.syslog.example.nilValues.description': 'Altı alan da `-`: "tire adlı host" gösterilmemeli.',
  'protocol.syslog.example.utf8Bom.name': 'UTF-8 BOM’lu mesaj',
  'protocol.syslog.example.utf8Bom.description': 'Gövde bayt sırası imiyle UTF-8 ilan edilmiş (§6.4).',
  'protocol.syslog.example.legacyBsd.name': 'RFC 3164 (BSD) biçimi',
  'protocol.syslog.example.legacyBsd.description':
    'Sürüm basamağı yok, damga `Oct 11 22:14:15` — tanınır, 5424 şemasıyla çözülmez.',
  'protocol.syslog.example.leadingZeroPri.name': 'Başta sıfırlı PRI (hata yolu)',
  'protocol.syslog.example.leadingZeroPri.description': '`<034>` — RFC 5424 §6.2.1 başta sıfırı yasaklar.',

  // --- HTTP ---
  'protocol.http.error.frameTooShort': 'Mesaj anlamlı bir başlangıç satırı taşıyacak kadar uzun değil.',
  'protocol.http.error.frameTooLong': 'Mesaj izin verilen azami uzunluğu aşıyor.',
  'protocol.http.error.aborted': 'Çözümleme iptal edildi.',
  'protocol.http.error.headersUnterminated': 'Başlık bölümü boş satırla (CRLF CRLF) kapanmıyor.',
  'protocol.http.error.startLineMalformed': 'Başlangıç satırı ne bir istek satırı ne de bir durum satırı.',
  'protocol.http.error.smugglingConflict':
    'Content-Length ve Transfer-Encoding aynı mesajda. RFC 9112 §6.1 bunu reddetmeyi şart koşar — ara sunucular ikisini farklı önceliklendirdiğinde request smuggling doğar.',
  'protocol.http.error.contentLengthConflict': 'Birden çok Content-Length başlığı çelişen değerler taşıyor.',
  'protocol.http.error.contentLengthMalformed': 'Content-Length değeri ondalık bir sayı değil.',
  'protocol.http.error.headerNameWhitespace':
    'Başlık adıyla iki nokta arasında boşluk var. RFC 9112 §5.1 bunu reddetmeyi şart koşar; kabul eden aracılar smuggling vektörüdür.',
  'protocol.http.error.bodyTruncated': 'Gövde, Content-Length’in bildirdiği uzunluktan kısa.',
  'protocol.http.error.chunkSizeMalformed': 'Chunk boyutu onaltılık bir sayı değil.',
  'protocol.http.error.chunkTruncated': 'Bir chunk’ın bildirdiği uzunluk tamponda kalan bayttan büyük.',
  'protocol.http.warning.unknownMethod': 'Metot temel kümenin dışında; kayıtlı ek metotlar bulunur.',
  'protocol.http.warning.unknownStatus': 'Durum kodu yerleşik tabloda yok.',
  'protocol.http.warning.reasonMismatch': 'Reason phrase kayıtlı metinden farklı. Alan isteğe bağlıdır ve anlam taşımaz.',
  'protocol.http.warning.binaryFramingVersion':
    'HTTP/2 ve HTTP/3 ikili çerçeveleme kullanır; bu metin çözücüsü onları okuyamaz.',
  'protocol.http.warning.unexpectedVersion': 'Sürüm alanı HTTP/1.0 ya da HTTP/1.1 değil.',
  'protocol.http.warning.obsFold': 'Boşlukla başlayan devam satırı (obs-fold) kullanımdan kaldırıldı; birleştirilmedi.',
  'protocol.http.warning.bareLf': 'Başlık bölümünde CR’siz LF var — smuggling vektörü.',
  'protocol.http.warning.bodyLongerThanDeclared':
    'Gövde Content-Length’ten uzun. Fazlalık büyük olasılıkla boru hattındaki bir sonraki mesaj.',
  'protocol.http.warning.bodyUntilClose':
    'Çerçeveleme başlığı yok: yanıtın gövdesi bağlantı kapanana kadar sürer.',
  'protocol.http.warning.bodyForbiddenButPresent': 'Bu mesaj gövde taşıyamaz ama gövde baytları var.',
  'protocol.http.warning.headResponseAssumed':
    'İstek HEAD olarak bildirildi: Content-Length yalnız bilgidir, gövde beklenmez.',
  'protocol.http.warning.transferEncodingNotChunked':
    'Transfer-Encoding’in son kodlaması `chunked` değil; gövde uzunluğu bilinemez.',
  'protocol.http.warning.chunkExtensionIgnored': 'Chunk uzantısı (`;` sonrası) okundu ama yok sayıldı.',
  'protocol.http.warning.trailerPresent': 'Son chunk’tan sonra trailer bölümü var.',
  'protocol.http.warning.headerLimit': 'Başlık sayısı üst sınıra dayandı, bölüm okunmayı bıraktı.',
  'protocol.http.warning.transactionMatchingNeedsStream':
    'İstek/yanıt eşleştirmesi ve süresi bir TCP akışının işidir; tek mesajdan çıkmaz.',
  'protocol.http.option.requestMethod': 'İsteğin metodu',
  'protocol.http.option.requestMethod.description':
    'HEAD yanıtı Content-Length taşır ama gövde TAŞIMAZ ve bu yanıttan çıkarılamaz. Çerçeveleme kipinin kendisi başlıklardan okunur, sorulmaz.',
  'protocol.http.option.requestMethod.unknown': 'Bilinmiyor',
  'protocol.http.option.requestMethod.head': 'HEAD',
  'protocol.http.documentation.summary':
    'HTTP/1.1 metin çerçeveli istek/yanıt (RFC 9110 semantik, RFC 9112 sözdizimi). Başlangıç satırı, başlıklar ve gövde alan alana çözülür; gövde çerçevelemesi RFC 9112 §6.3 sırasıyla belirlenir (1xx/204/304 gövdesiz, HEAD yanıtı gövdesiz, Transfer-Encoding Content-Length’i geçersizler). Content-Length ile Transfer-Encoding birlikte geldiğinde ve başlık adında boşluk olduğunda request smuggling hatası basılır. Chunked gövde onaltılık boyutlarla birleştirilir. HTTP/2 ve HTTP/3 ikili çerçeveleme ayrı bir iştir; işlem eşleştirmesi akış işidir.',
  'protocol.http.example.getRequest.name': 'GET isteği',
  'protocol.http.example.getRequest.description': 'Spec’in `GET /api/status HTTP/1.1` örneği; gövde yok.',
  'protocol.http.example.jsonResponse.name': 'JSON yanıtı (Content-Length)',
  'protocol.http.example.jsonResponse.description': 'Gövde 27 bayt ve Content-Length onu tam karşılıyor.',
  'protocol.http.example.chunkedResponse.name': 'Chunked yanıt',
  'protocol.http.example.chunkedResponse.description':
    'Spec’in örneği: 4 + 5 bayt iki chunk, birleştirilmiş gövde 9 bayt ("Wikipedia").',
  'protocol.http.example.chunkedHexSize.name': 'Chunk boyutu onaltılık',
  'protocol.http.example.chunkedHexSize.description':
    '`10` = 16 bayt. Ondalık okuyan bir çözücü burada 10 bayt alır ve gövdeyi kaydırır.',
  'protocol.http.example.noContent.name': '204 No Content',
  'protocol.http.example.noContent.description': 'Content-Length yazsa bile 204 gövde taşıyamaz.',
  'protocol.http.example.smugglingConflict.name': 'Content-Length + Transfer-Encoding (hata yolu)',
  'protocol.http.example.smugglingConflict.description':
    'İki çerçeveleme bildirimi bir arada — RFC 9112 §6.1 reddetmeyi şart koşar.',
  'protocol.http.example.headerNameWhitespace.name': 'Başlık adında boşluk (hata yolu)',
  'protocol.http.example.headerNameWhitespace.description':
    '`Content-Length : 5` — ad ile iki nokta arasındaki boşluk smuggling vektörüdür.',

  // --- WebSocket ---
  'protocol.websocket.error.frameTooShort': 'Çerçeve iki baytlık asgari başlığı taşımıyor.',
  'protocol.websocket.error.frameTooLong': 'Çerçeve izin verilen azami uzunluğu aşıyor.',
  'protocol.websocket.error.aborted': 'Çözümleme iptal edildi.',
  'protocol.websocket.error.lengthTruncated': 'Uzunluk uzantısı ya da maske anahtarı tamponun sonuna kesilmiş.',
  'protocol.websocket.error.payloadTruncated': 'Yük, uzunluk alanının bildirdiği kadar uzun değil.',
  'protocol.websocket.error.extendedLengthMsb':
    '64 bitlik uzunluğun en anlamlı biti 1. RFC 6455 §5.2 bunu 0 olmaya zorlar.',
  'protocol.websocket.error.controlFrameTooLong':
    'Kontrol çerçevesinin yükü 125 baytı aşıyor (RFC 6455 §5.5).',
  'protocol.websocket.error.controlFrameFragmented':
    'Kontrol çerçevesi parçalanamaz; FIN biti 1 olmak zorundadır (RFC 6455 §5.5).',
  'protocol.websocket.error.handshakeNotAFrame':
    'Bu bir WebSocket çerçevesi değil, açılış el sıkışması metni. HTTP sayfasında çözülür.',
  'protocol.websocket.warning.reservedOpcode': 'Opcode tanımlı kümenin dışında; ayrılmış bir değer.',
  'protocol.websocket.warning.rsvBitsSet':
    'RSV bitlerinden biri set. Yalnız anlaşılmış bir uzantı varsa anlamlıdır ve el sıkışması burada değil.',
  'protocol.websocket.warning.nonMinimalLength':
    'Uzunluk için gereğinden uzun biçim kullanılmış; RFC 6455 §5.2 en kısasını şart koşar.',
  'protocol.websocket.warning.payloadLongerThanFrame':
    'Tamponda yükten fazla bayt var — büyük olasılıkla akıştaki bir sonraki çerçeve.',
  'protocol.websocket.warning.closeStatusReserved':
    'Close durum kodu 1005/1006/1015 yerel kullanım içindir ve telde görünemez (RFC 6455 §7.4.1).',
  'protocol.websocket.warning.closeStatusUnknown': 'Close durum kodu yerleşik tabloda yok.',
  'protocol.websocket.warning.closePayloadTooShort': 'Close yükü bir bayt; durum kodu 16 bittir.',
  'protocol.websocket.warning.continuationOpcodeUnknown':
    'Continuation çerçevesinin yük tipi ilk parçadaydı; burada yorumlanamaz.',
  'protocol.websocket.warning.fragmentReassemblyNeedsStream':
    'Parça birleştirme çok-çerçeve işidir; tek çerçeveden çıkmaz.',
  'protocol.websocket.warning.textNotValidUtf8': 'Metin yükü geçerli UTF-8 değil (RFC 6455 §5.6).',
  'protocol.websocket.documentation.summary':
    'HTTP yükseltmesiyle açılan iki yönlü çerçeve kanalı (RFC 6455). FIN, RSV, opcode, MASK ve üç biçimli uzunluk alanı alan alana çözülür; maskeli yük XOR’la açılır ve yön MASK bitinden türetilir (istemci→sunucu maskeli, sunucu→istemci maskesiz). Kontrol çerçevelerinin 125 bayt ve parçalanmama sınırları denetlenir, Close yükü durum kodu ve UTF-8 gerekçeye ayrılır. Açılış el sıkışması HTTP mesajıdır ve HTTP sayfasında çözülür; parça birleştirme çok-çerçeve işidir.',
  'protocol.websocket.example.serverText.name': 'Sunucu metin çerçevesi',
  'protocol.websocket.example.serverText.description': 'Maskesiz — sunucu→istemci yönü (RFC 6455 §5.1).',
  'protocol.websocket.example.clientMaskedText.name': 'İstemci maskeli metin',
  'protocol.websocket.example.clientMaskedText.description': 'Maskeli — istemci→sunucu; yük XOR’la açılır.',
  'protocol.websocket.example.fragmentStart.name': 'Parça başlangıcı (FIN=0)',
  'protocol.websocket.example.fragmentStart.description': 'Birleştirme çok-çerçeve işidir, uyarıyla bildirilir.',
  'protocol.websocket.example.closeNormal.name': 'Close 1000',
  'protocol.websocket.example.closeNormal.description': 'Durum kodu + UTF-8 gerekçe ("bye").',
  'protocol.websocket.example.ping.name': 'Ping',
  'protocol.websocket.example.ping.description': 'Kontrol çerçevesi: 125 baytın altında ve FIN=1.',
  'protocol.websocket.example.extendedLength.name': '16 bitlik uzunluk uzantısı',
  'protocol.websocket.example.extendedLength.description': '200 baytlık yük: uzunluk kodu 126, gerçek uzunluk sonraki iki baytta.',
  'protocol.websocket.example.controlFrameTooLong.name': 'Aşırı uzun Ping (hata yolu)',
  'protocol.websocket.example.controlFrameTooLong.description': 'Kontrol çerçevesinin yükü 125 baytı aşamaz.',
  'protocol.websocket.example.handshakeText.name': 'El sıkışma metni (hata yolu)',
  'protocol.websocket.example.handshakeText.description': 'Bu bir HTTP mesajıdır; çerçeve çözücüsü onu okumaz.',

  // --- MQTT-SN ---
  'protocol.mqttSn.error.frameTooShort': 'Mesaj en az uzunluk ve tip baytlarını taşımalı.',
  'protocol.mqttSn.error.frameTooLong': 'Mesaj izin verilen azami uzunluğu aşıyor.',
  'protocol.mqttSn.error.aborted': 'Çözümleme iptal edildi.',
  'protocol.mqttSn.error.lengthTruncated': 'Üç baytlık uzunluk alanı tamponun sonuna kesilmiş.',
  'protocol.mqttSn.error.bodyTruncated': 'Bildirilen uzunluk tamponda kalan bayttan büyük.',
  'protocol.mqttSn.error.lengthTooSmall':
    'Bildirilen uzunluk kendi alanını ve mesaj tipini bile karşılamıyor. MQTT-SN’de Length KENDİ baytlarını da sayar.',
  'protocol.mqttSn.warning.unknownMessageType': 'Mesaj tipi tanımlı kümenin dışında; gövde ham gösterildi.',
  'protocol.mqttSn.warning.lengthMismatch':
    'Tamponda bildirilen uzunluktan fazla bayt var — büyük olasılıkla datagramdaki bir sonraki mesaj.',
  'protocol.mqttSn.warning.qosMinusOne':
    'QoS bitleri 0b11: MQTT’de rezerve ve geçersiz, MQTT-SN’de QoS −1 (bağlantısız yayın).',
  'protocol.mqttSn.warning.topicIdTypeReserved': 'Topic ID tipi 0b11 rezervedir.',
  'protocol.mqttSn.warning.unknownReturnCode': 'Return Code tanımlı dört değerden hiçbiri değil.',
  'protocol.mqttSn.warning.topicMappingNeedsStream':
    'Topic ID ↔ topic adı eşlemesi REGISTER/REGACK akışında kurulur; tek mesajdan çıkmaz.',
  'protocol.mqttSn.warning.nonMinimalLength': 'Üç baytlık uzunluk biçimi yalnız 255 baytı aşan mesajlar için gerekir.',
  'protocol.mqttSn.warning.encapsulatedOpaque': 'ENCAPSULATED mesajının içi ayrı bir MQTT-SN mesajıdır; çözülmedi.',
  'protocol.mqttSn.warning.profileNotOasisStandard':
    'Profil MQTT-SN 1.2: OASIS input specification’dır, MQTT 5 gibi onaylanmış bir OASIS Standard DEĞİLDİR.',
  'protocol.mqttSn.documentation.summary':
    'Kısıtlı sensör ağları için MQTT ile ilişkili mesajlaşma (MQTT-SN 1.2). Uzunluk alanı MQTT’nin Variable Byte Integer’ı DEĞİLDİR: ya tek bayttır ya `0x01` + 16 bittir, ve kendi baytlarını da sayar. QoS bitleri 0b11 burada geçersiz değil QoS −1 demektir; Topic ID tipi 0b10 iken iki bayt sayı değil kısa topic adıdır. Gateway keşfi, topic kaydı ve yayın/abonelik mesajları alan alana çözülür; topic id eşlemesi ve oturum görünümü çok-mesaj işidir.',
  'protocol.mqttSn.example.advertise.name': 'ADVERTISE',
  'protocol.mqttSn.example.advertise.description': 'Gateway 7, duyuru süresi 900 s.',
  'protocol.mqttSn.example.connect.name': 'CONNECT',
  'protocol.mqttSn.example.connect.description': 'CleanSession, keep-alive 60 s, client id `sensor-01`.',
  'protocol.mqttSn.example.register.name': 'REGISTER',
  'protocol.mqttSn.example.register.description': 'Spec’in örneği: `room/temperature ↔ 0x0012`.',
  'protocol.mqttSn.example.publishQos1.name': 'PUBLISH (QoS 1)',
  'protocol.mqttSn.example.publishQos1.description': 'Spec’in örneği: Topic ID 0x0012, Message ID 42.',
  'protocol.mqttSn.example.publishQosMinusOne.name': 'PUBLISH (QoS −1)',
  'protocol.mqttSn.example.publishQosMinusOne.description':
    'QoS bitleri 0b11 — MQTT’de hata, MQTT-SN’de bağlantısız yayın.',
  'protocol.mqttSn.example.publishShortTopic.name': 'PUBLISH (kısa topic adı)',
  'protocol.mqttSn.example.publishShortTopic.description':
    'Topic ID tipi 0b10: iki bayt sayı değil, iki ASCII karakter ("ab").',
  'protocol.mqttSn.example.extendedLength.name': 'Üç baytlık uzunluk',
  'protocol.mqttSn.example.extendedLength.description':
    '`0x01` + 16 bit = 268 bayt. MQTT’nin VBI’ı olarak okunsaydı "1" çıkardı.',
  'protocol.mqttSn.example.lengthTooSmall.name': 'Uzunluk kendi alanından küçük (hata yolu)',
  'protocol.mqttSn.example.lengthTooSmall.description': 'Bildirilen 0, asgari 4 — Length kendini de sayar.',

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

  // --- IEC 60870-5-101 ---
  'protocol.iec101.error.emptyFrame': 'Tampon boş — hiçbir çerçeve sınıfı okunamaz.',
  'protocol.iec101.error.unrecognizedFrameClass':
    'İlk bayt üç çerçeve sınıfından (0xE5/0x10/0x68) hiçbirine uymuyor.',
  'protocol.iec101.error.frameTooLong': 'Çerçeve izin verilen azami uzunluğu aşıyor.',
  'protocol.iec101.error.aborted': 'Çözümleme iptal edildi.',
  'protocol.iec101.error.fixedLengthTruncated':
    'Sabit uzunluklu çerçeve (Start+Control+Address+Checksum+End) için yeterli bayt yok.',
  'protocol.iec101.error.variableLengthHeaderTruncated':
    'Değişken uzunluklu çerçeve başlığı (Start+L+L+Start, 4 bayt) için yeterli bayt yok.',
  'protocol.iec101.error.lengthCopiesMismatch':
    'L alanının iki kopyası birbirini tutmuyor — ilk kopya baz alınarak devam edildi.',
  'protocol.iec101.error.secondStartInvalid': 'İkinci start baytı 0x68 değil.',
  'protocol.iec101.error.stopByteInvalid': 'End baytı 0x16 değil.',
  'protocol.iec101.error.checksumMismatch': 'Checksum (8-bit aritmetik toplam, mod 256) tutmuyor.',
  'protocol.iec101.error.bodyTruncated':
    'L alanının vaat ettiği toplam çerçeve uzunluğu tampondaki bayt sayısını aşıyor.',
  'protocol.iec101.warning.unknownFunctionCode':
    'Fonksiyon kodu dar ad kümesinde yok (bazı kodlar iki kaynak arasında çakıştığı ya da tek kaynaklı olduğu için bilerek ham bırakıldı) — ham gösteriliyor.',
  'protocol.iec101.warning.trailingBytes': 'Çerçeve sınırından sonra fazladan bayt var.',
  'protocol.iec101.summary.singleCharacter': 'Tek karakter onayı',
  'protocol.iec101.summary.fixedLength': 'Sabit uzunluklu çerçeve — control field çözüldü',
  'protocol.iec101.summary.variableLength': 'Değişken uzunluklu çerçeve — ASDU çözüldü',
  'protocol.iec101.documentation.summary':
    'IEC 60870-5-101: SERİ hat link katmanı (IEC 60870-5-1 FT1.2 — Tek Karakter Onayı 0xE5, Sabit Uzunluklu ve Değişken Uzunluklu çerçeve; sum8Checksum ile aritmetik toplam/mod 256 checksum) kendi kodunda çözülür. Control field bit bit ayrıştırılır (RES/DIR + PRM + FCB/ACD + FCV/DFC + fonksiyon kodu — aynı bit PRM yönüne göre farklı anlam taşır, iki ayrı fonksiyon kodu tablosu vardır). ASDU (Type Identification, Cause of Transmission, Common Address, Information Object Address + eleman) 104’ün decodeAsdu() çekirdeğine OLDUĞU GİBİ devredilir; Common Address/Information Object Address/Cause of Transmission genişlikleri ve Link Address genişliği (çerçeveden çıkarılamayan sistem parametreleri) decodeOptions formundan alınır. Alan adları Wireshark’ın IEC 60870 dissector’ı (packet-iec104.c) ve lib60870 dokümantasyonuyla çapraz teyitlidir; iki kaynak arasında çakışan ya da tek kaynaklı fonksiyon kodları (PRM=1 kod 2/7/8) ve broadcast link adresi bilerek ham bırakılmıştır.',
  'protocol.iec101.example.singleCharacterConfirmation.name': 'Tek Karakter Onayı (0xE5)',
  'protocol.iec101.example.singleCharacterConfirmation.description':
    'Tek baytlık onay çerçevesi — Sabit/Değişken Uzunluklu (Send/Confirm) bir çerçevenin alındığını bildirir.',
  'protocol.iec101.example.fixedLengthResetRemoteLink.name': 'Sabit Uzunluklu: link sıfırlama (PRM=1)',
  'protocol.iec101.example.fixedLengthResetRemoteLink.description':
    'Primary→secondary yönünde fonksiyon kodu 0 — Reset of remote link. Control=0x40, Address=1, checksum ve end doğru.',
  'protocol.iec101.example.fixedLengthAck.name': 'Sabit Uzunluklu: ACK (PRM=0)',
  'protocol.iec101.example.fixedLengthAck.description':
    'Secondary→primary yönünde fonksiyon kodu 0 — bu yönde AYNI sayı ACK anlamına gelir (reset ile KARIŞTIRILMAZ).',
  'protocol.iec101.example.fixedLengthBalancedDirBit.name': 'Sabit Uzunluklu: RES/DIR biti 1',
  'protocol.iec101.example.fixedLengthBalancedDirBit.description':
    'reset-remote-link ile aynı gövde, en üst bit (RES/DIR) kasten 1 — dengeli/dengesiz yorumu çerçeveden çıkarılamadığı için alan nötr gösterilir.',
  'protocol.iec101.example.fixedLengthUnknownFunction.name': 'Sabit Uzunluklu: tanınmayan fonksiyon kodu (5)',
  'protocol.iec101.example.fixedLengthUnknownFunction.description':
    'PRM=1, fonksiyon kodu 5 — iki kaynakta da adlandırılmamış (Reserved) — uyarı yolu, çerçeve yine geçerli sayılır.',
  'protocol.iec101.example.fixedLengthChecksumMismatch.name': 'Sabit Uzunluklu: checksum hatası',
  'protocol.iec101.example.fixedLengthChecksumMismatch.description':
    'reset-remote-link ile aynı gövde, checksum baytı kasten 0x00 — checksum-mismatch hata yolu.',
  'protocol.iec101.example.fixedLengthStopByteInvalid.name': 'Sabit Uzunluklu: end baytı hatası',
  'protocol.iec101.example.fixedLengthStopByteInvalid.description':
    'reset-remote-link ile aynı gövde, end baytı kasten 0x00 — soft hata yolu, geri kalan alanlar yine çözülür.',
  'protocol.iec101.example.variableLengthUserData.name':
    'Değişken Uzunluklu: user data (M_SP_NA_1, varsayılan genişlikler)',
  'protocol.iec101.example.variableLengthUserData.description':
    'PRM=1, fonksiyon kodu 3 (Send/confirm). ASDU: M_SP_NA_1, COT=Spontaneous, Common Address=1, IOA=1, SIQ SPI açık — 104’ün kendi örneğiyle aynı baytlar (CA=2/IOA=3/COT=2 varsayılan genişlikler).',
  'protocol.iec101.example.variableLengthSecondaryResponse.name': 'Değişken Uzunluklu: secondary yanıtı (PRM=0)',
  'protocol.iec101.example.variableLengthSecondaryResponse.description':
    'AYNI ASDU, fonksiyon kodu 8 (PRM=0) — Respond user data. Karşı yönün fonksiyon tablosunu ve aynı decodeAsdu() yolunu kanıtlar.',
  'protocol.iec101.example.variableLengthChecksumMismatch.name': 'Değişken Uzunluklu: checksum hatası',
  'protocol.iec101.example.variableLengthChecksumMismatch.description':
    'variable-length-user-data ile aynı gövde, checksum kasten 0x00 — checksum-mismatch hata yolu, ASDU yine çözülür.',
  'protocol.iec101.example.variableLengthCopiesMismatch.name': 'Değişken Uzunluklu: L kopyaları uyuşmazlığı',
  'protocol.iec101.example.variableLengthCopiesMismatch.description':
    'variable-length-user-data ile aynı gövde, ikinci L kopyası kasten farklı (0x0C → 0x0D) — length-mismatch hata yolu, ilk kopya baz alınarak yine de çözülür.',
  'protocol.iec101.example.variableLengthTruncated.name': 'Değişken Uzunluklu: gövde eksik',
  'protocol.iec101.example.variableLengthTruncated.description':
    'L=20 → 26 baytlık bir çerçeve vaat eder ama tampon yalnız 6 bayt — length-mismatch ile ParseFailure (kaydedilebilir).',
  'protocol.iec101.option.linkAddressWidth': 'Link Address Genişliği',
  'protocol.iec101.option.linkAddressWidth.description':
    'Link katmanı adres alanının bayt genişliği — sistem yapılandırması, çerçeveden çıkarılamaz.',
  'protocol.iec101.option.commonAddressWidth': 'Common Address Genişliği',
  'protocol.iec101.option.commonAddressWidth.description':
    'ASDU Common Address alanının bayt genişliği (1 veya 2) — 104 her zaman 2 kullanır, 101’de yapılandırılabilir.',
  'protocol.iec101.option.informationObjectAddressWidth': 'Information Object Address Genişliği',
  'protocol.iec101.option.informationObjectAddressWidth.description':
    'ASDU Information Object Address alanının bayt genişliği (1, 2 veya 3) — 104 her zaman 3 kullanır, 101’de yapılandırılabilir.',
  'protocol.iec101.option.causeOfTransmissionWidth': 'Cause of Transmission Genişliği',
  'protocol.iec101.option.causeOfTransmissionWidth.description':
    'ASDU Cause of Transmission alanının bayt genişliği — 2 bayt originator address okteti İÇERİR, 1 bayt İÇERMEZ. 104 her zaman 2 kullanır.',
  'protocol.iec101.option.width.zeroBytes': '0 bayt (adres yok)',
  'protocol.iec101.option.width.oneByte': '1 bayt',
  'protocol.iec101.option.width.twoBytes': '2 bayt',
  'protocol.iec101.option.width.threeBytes': '3 bayt',

  // --- OPC UA ---
  'protocol.opcua.error.emptyFrame': 'Tampon boş — mesaj tipi okunamaz.',
  'protocol.opcua.error.headerTruncated':
    'Mesaj başlığı 8 bayttan kısa; MessageSize okunamıyor.',
  'protocol.opcua.error.unknownMessageType':
    'İlk üç bayt tanınan bir mesaj tipi değil (HEL/ACK/ERR/RHE/OPN/CLO/MSG).',
  'protocol.opcua.error.messageSizeTooSmall':
    'MessageSize başlığın kendisini de sayar; 8 bayttan küçük olamaz.',
  'protocol.opcua.error.frameTooLong': 'MessageSize izin verilen azami uzunluğu aşıyor.',
  'protocol.opcua.error.aborted': 'Çözümleme iptal edildi.',
  'protocol.opcua.error.bodyTruncated':
    'Gövde çerçevenin sonundan önce kesildi; kesilene kadar okunan alanlar gösteriliyor.',
  'protocol.opcua.error.truncatedField': 'Alan tamponun dışına taşıyor.',
  'protocol.opcua.error.negativeLength':
    'Uzunluk alanı negatif ama −1 (null) değil; bu kodlama geçersiz.',
  'protocol.opcua.error.unknownNodeIdEncoding':
    'NodeId kodlama baytı tanınan altı biçimden hiçbirine uymuyor.',
  'protocol.opcua.error.unknownExtensionEncoding':
    'ExtensionObject gövde kodlaması 0x00/0x01/0x02 dışında.',
  'protocol.opcua.error.unknownVariantType': 'Variant yerleşik tip kimliği tanınmıyor.',
  'protocol.opcua.error.recursionLimit':
    'İç içe geçme sınırı aşıldı; daha derin çözümleme yapılmıyor.',
  'protocol.opcua.warning.messageSizeExceedsBuffer':
    'MessageSize elde olan bayt sayısından büyük — çerçeve eksik yakalanmış olabilir.',
  'protocol.opcua.warning.trailingBytes': 'MessageSize sınırından sonra fazladan bayt var.',
  'protocol.opcua.warning.chunkTypeNotFinal':
    'Chunk tipi “F” değil; bu çerçeve çok parçalı bir mesajın parçası.',
  'protocol.opcua.warning.unknownChunkType':
    'Chunk baytı tanınan üç değerden (F/C/A) hiçbirine uymuyor; ham gösteriliyor.',
  'protocol.opcua.warning.intermediateChunkBody':
    'Ara parçanın gövdesi bir kesittir: servis kimliği yalnız ilk parçada bulunur, bu yüzden ham bırakıldı.',
  'protocol.opcua.warning.encryptedPayload':
    'Şifreli bölge çözülmez: SequenceHeader, gövde, padding ve imza SignAndEncrypt modunda şifrelidir.',
  'protocol.opcua.warning.unknownService':
    'Gövdenin başındaki NodeId tanınan bir servise karşılık gelmiyor.',
  'protocol.opcua.warning.serviceBodyNotDecoded':
    'Servis adı tanındı ve başlığı çözüldü, ama gövdesi bu sürümde alan alan çözülmüyor.',
  'protocol.opcua.warning.signatureNotVerified':
    'İmza yalnız gövdeden ayrıldı; DOĞRULANMADI.',
  'protocol.opcua.warning.certificateNotValidated':
    'Sertifika yalnız gösterildi; zinciri, süresi ve iptal durumu DOĞRULANMADI.',
  'protocol.opcua.warning.arrayTruncated': 'Dizi uzun; yalnız ilk elemanlar gösteriliyor.',
  'protocol.opcua.warning.bodyDecodeFailed':
    'Gövde çözümlemesi yarıda kesildi; kısmi sonuç gösteriliyor.',
  'protocol.opcua.summary.connection': 'Bağlantı protokolü mesajı (UACP)',
  'protocol.opcua.summary.secureConversation': 'Güvenli oturum parçası — zarf ve gövde çözüldü',
  'protocol.opcua.summary.encrypted': 'Güvenli oturum parçası — gövde şifreli, zarf çözüldü',
  'protocol.opcua.documentation.summary':
    'OPC UA TCP (UACP) çerçevesi: HEL/ACK/ERR/RHE bağlantı mesajları ile OPN/CLO/MSG güvenli oturum parçaları çözülür. Zarf tamdır (SecurityPolicyUri, sertifikalar, TokenId, SequenceNumber, RequestId); 78 servisin adı tanınır ve her serviste Request/ResponseHeader çözülür. Dokuz servisin gövdesi alan alan çözülür: OpenSecureChannel istek/yanıt, CloseSecureChannel isteği, Read istek/yanıt, Write isteği, Browse isteği, CreateSubscription istek/yanıt. Kalan servislerin gövdesi ham bırakılır. Kripto DOĞRULANMAZ: imza, sertifika zinciri ve şifreli gövde çözülmez.',
  'protocol.opcua.option.bodySecurity': 'Gövde güvenlik modu',
  'protocol.opcua.option.bodySecurity.description':
    'MessageSecurityMode SecureChannel açılışında pazarlıkla belirlenir, tek bir çerçevenin baytlarında yazmaz. Otomatik seçenek, gövdenin başındaki NodeId tanınan bir servise çözülüyorsa açık, çözülmüyorsa şifreli sayar.',
  'protocol.opcua.option.bodySecurity.auto': 'Otomatik (servis kimliğinden çıkar)',
  'protocol.opcua.option.bodySecurity.plaintext': 'Açık — gövdeyi çöz',
  'protocol.opcua.option.bodySecurity.encrypted': 'Şifreli — gövdeyi çözme',
  'protocol.opcua.option.signatureLength': 'İmza uzunluğu (bayt)',
  'protocol.opcua.option.signatureLength.description':
    'Sign modunda gövdenin sonundaki imza bayt sayısı güvenlik politikasına bağlıdır ve çerçevede yazmaz. 0 verilirse imza alanı ayrılmaz.',
  'protocol.opcua.example.hello.name': 'Hello — bağlantı açılışı',
  'protocol.opcua.example.hello.description':
    'İstemcinin tampon boyutlarını ve endpoint adresini bildirdiği ilk mesaj.',
  'protocol.opcua.example.acknowledge.name': 'Acknowledge — sunucu yanıtı',
  'protocol.opcua.example.acknowledge.description':
    'Hello ile aynı alanları taşır ama EndpointUrl TAŞIMAZ — ikisi aynı sanılmamalı.',
  'protocol.opcua.example.errorEndpointUrlInvalid.name': 'Error — geçersiz endpoint adresi',
  'protocol.opcua.example.errorEndpointUrlInvalid.description':
    'Bağlantı katmanı hatası: StatusCode adı çözülür, açıklama metni okunur.',
  'protocol.opcua.example.reverseHello.name': 'ReverseHello — sunucudan bağlantı',
  'protocol.opcua.example.reverseHello.description':
    'Güvenlik duvarı arkasındaki sunucunun istemciye bağlandığı mesaj: ServerUri + EndpointUrl.',
  'protocol.opcua.example.nullVersusEmptyString.name': 'null metin ile BOŞ metin ayrımı',
  'protocol.opcua.example.nullVersusEmptyString.description':
    'ServerUri uzunluğu 0 (boş metin), EndpointUrl uzunluğu −1 (null). İkisi aynı şey değildir ve ayrı gösterilir.',
  'protocol.opcua.example.openSecureChannelRequestNone.name':
    'OpenSecureChannel isteği — SecurityPolicy #None',
  'protocol.opcua.example.openSecureChannelRequestNone.description':
    'Asimetrik güvenlik başlığı çözülür; politika #None olduğu için gövdenin açık olduğu baytların içinden bilinir.',
  'protocol.opcua.example.readRequest.name': 'Read isteği — Machine1.Temperature',
  'protocol.opcua.example.readRequest.description':
    'MSG parçası: simetrik başlık, SequenceHeader ve ReadValueId girdisi (String NodeId + AttributeId = Value).',
  'protocol.opcua.example.readResponse.name': 'Read yanıtı — Value 25.73, Good',
  'protocol.opcua.example.readResponse.description':
    'DataValue maskesi Value + StatusCode + SourceTimestamp taşır; zaman damgası 1601 epoch’undan çözülür.',
  'protocol.opcua.example.writeRequest.name': 'Write isteği — Machine1.Setpoint = 42.5',
  'protocol.opcua.example.writeRequest.description':
    'WriteValue içindeki DataValue yalnız Value taşır (maske 0x01); Variant skaler Double olarak çözülür.',
  'protocol.opcua.example.browseRequest.name': 'Browse isteği — ObjectsFolder',
  'protocol.opcua.example.browseRequest.description':
    'ViewDescription + BrowseDescription: yön, referans tipi ve sonuç maskesi çözülür.',
  'protocol.opcua.example.createSubscriptionRequest.name':
    'CreateSubscription isteği — 100 ms yayın aralığı',
  'protocol.opcua.example.createSubscriptionRequest.description':
    'Yayın aralığı Double olarak kodlanır ve milisaniye biriminde gösterilir.',
  'protocol.opcua.example.createSessionRequestBodyRaw.name':
    'CreateSession isteği — gövde kapsam dışı',
  'protocol.opcua.example.createSessionRequestBodyRaw.description':
    'Kapsam kararının ekrandaki karşılığı: servis adı tanınır, RequestHeader çözülür, gövde ham bırakılır.',
  'protocol.opcua.example.messageAbortChunk.name': 'Abort parçası (ChunkType A)',
  'protocol.opcua.example.messageAbortChunk.description':
    'Abort gövdesi normal servis gövdesi DEĞİLDİR: StatusCode + açıklama taşır.',
  'protocol.opcua.example.messageIntermediateChunk.name': 'Ara parça (ChunkType C)',
  'protocol.opcua.example.messageIntermediateChunk.description':
    'Servis kimliği yalnız ilk parçada bulunur; ara parçanın gövdesi ham bırakılır.',
  'protocol.opcua.example.messageEncryptedBody.name': 'Şifreli gövde — kripto sınırı',
  'protocol.opcua.example.messageEncryptedBody.description':
    'Gövde baytları YER TUTUCUdur, gerçek AES çıktısı değildir. Şifreli modda SequenceHeader bile okunmaz.',
  'protocol.opcua.example.unknownMessageType.name': 'Tanınmayan mesaj tipi',
  'protocol.opcua.example.unknownMessageType.description':
    'İlk üç bayt tanınan bir tipe uymuyor; çözümleme kurtarılabilir hatayla döner.',
  'protocol.opcua.example.truncatedBody.name': 'Kesik gövde',
  'protocol.opcua.example.truncatedBody.description':
    'MessageSize elde olan bayttan büyük; kesilene kadar okunan alanlar gösterilir.',

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

  // --- Wireless M-Bus ---
  'protocol.wirelessMbus.error.emptyFrame': 'Tampon boş — hiçbir alan okunamaz.',
  'protocol.wirelessMbus.error.block1Truncated':
    'Block 1 (L+C+M+A+CRC, 12 bayt) tam okunamıyor — çerçeve çok kısa.',
  'protocol.wirelessMbus.error.block1CrcMismatch': 'Block 1 CRC (CRC-16/EN-13757) uyuşmuyor.',
  'protocol.wirelessMbus.error.invalidLengthField':
    'L-field yapısal alt sınırın (C+M+A=9 bayt) altında — Block 2 çözümlenemiyor.',
  'protocol.wirelessMbus.error.dataBlockTruncated': 'Veri bloğu (16 bayt + 2 bayt CRC) yarıda kesildi.',
  'protocol.wirelessMbus.error.dataBlockCrcMismatch': 'Veri bloğu CRC (CRC-16/EN-13757) uyuşmuyor.',
  'protocol.wirelessMbus.error.aborted': 'Çözümleme iptal edildi.',
  'protocol.wirelessMbus.warning.invalidBcd': 'Identification Number geçerli BCD değil.',
  'protocol.wirelessMbus.warning.unknownCi': 'CI Field dar ad kümesinde yok — ham gösteriliyor.',
  'protocol.wirelessMbus.warning.ciNotDecoded':
    'CI Field adlandırıldı ama bu dalgada yalnız CI=0x72 (TPL Long Header) DIF/VIF zincirine devrediliyor — payload ham gösteriliyor.',
  'protocol.wirelessMbus.warning.unknownDeviceType': 'Device Type dar ad kümesinde yok — ham gösteriliyor.',
  'protocol.wirelessMbus.warning.encryptedPayload':
    'Payload şifreli (Security Mode ≠ 0) — bu dalga AES şifre çözme UYGULAMIYOR, yalnız "Encrypted" olarak gösteriliyor.',
  'protocol.wirelessMbus.warning.multiBlockOffsetApproximate':
    'Application data 16 bayttan uzun (birden çok veri bloğu) — ilk bloktan sonraki alanların bayt konumu (offset) yaklaşık gösterilir, DEĞERLER yine doğrudur.',
  'protocol.wirelessMbus.warning.unnamedSecurityMode':
    'Security Mode, OMS-Group Vol.2 Table 18/19in doğruladığı beş modun (0/5/7/10/13) dışında — adlandırılmadı.',
  'protocol.wirelessMbus.warning.trailingBytes': 'Çerçeve sınırından sonra fazladan bayt var.',
  'protocol.wirelessMbus.documentation.summary':
    'EN 13757-4 Format A link-layer (Block 1 + CRC16_EN13757 korumalı veri blokları) kendi kodunda çözülür; CI=0x72 (TPL Long Header) yolu wired M-Bus ile PAYLAŞILAN Fixed Header + DIF/VIF motoruna (mbusVariableData.ts) devredilir. Şifreli payload (Security Mode ≠ 0) çözülmeden "Encrypted" gösterilir — anahtar/şifre çözme bu dalganın kapsamında değil.',
  'protocol.wirelessMbus.option.radioMode': 'Radyo Modu',
  'protocol.wirelessMbus.option.radioMode.description':
    'Telgraf baytlarının İÇİNDE değildir — alıcı donanımının bildirdiği bağlam, yalnız bilgi amaçlı gösterilir.',
  'protocol.wirelessMbus.option.radioMode.unknown': 'Bilinmiyor',
  'protocol.wirelessMbus.option.frequency': 'Frekans (MHz)',
  'protocol.wirelessMbus.option.frequency.description':
    'Telgraf baytlarının İÇİNDE değildir — alıcı donanımının bildirdiği bağlam, yalnız bilgi amaçlı gösterilir.',
  'protocol.wirelessMbus.option.rssi': 'RSSI (dBm)',
  'protocol.wirelessMbus.option.rssi.description':
    'Telgraf baytlarının İÇİNDE değildir — alıcı donanımının bildirdiği bağlam, yalnız bilgi amaçlı gösterilir.',
  'protocol.wirelessMbus.option.linkQuality': 'LQI / SNR',
  'protocol.wirelessMbus.option.linkQuality.description':
    'Telgraf baytlarının İÇİNDE değildir — alıcı donanımının bildirdiği bağlam, yalnız bilgi amaçlı gösterilir.',
  'protocol.wirelessMbus.example.simpleUnencrypted.name': 'Basit örnek: tek veri bloğu, şifresiz',
  'protocol.wirelessMbus.example.simpleUnencrypted.description':
    'CI=0x72, Security Mode 0, Block 2 payload tam 16 bayt (tek veri bloğu) — Energy=42 Wh tek kaydı.',
  'protocol.wirelessMbus.example.multiBlockThreeRecords.name': 'Çoklu blok: 3 kayıt',
  'protocol.wirelessMbus.example.multiBlockThreeRecords.description':
    'CI=0x72, Block 2 payload 28 bayt — iki veri bloğuna yayılır (16+12), Energy/Volume/Flow Temperature kayıtları m-bus.ts örneğiyle aynı DIF/VIF baytlarını taşır.',
  'protocol.wirelessMbus.example.encryptedMode5.name': 'Şifreli: Security Mode 5',
  'protocol.wirelessMbus.example.encryptedMode5.description':
    'Configuration Field Security Mode=5 (AES-128-CBC) işaretliyor — Fixed Header çözülür, payload ("Encrypted") ŞİFRE ÇÖZÜLMEDEN gösterilir (16 baytlık yer tutucu, gerçek AES çıktısı değil).',
  'protocol.wirelessMbus.example.block1CrcMismatch.name': 'Block 1 CRC hatası',
  'protocol.wirelessMbus.example.block1CrcMismatch.description':
    'Basit örnekle aynı gövde, Block 1 CRC baytları kasten 0x00 0x00 — crc-mismatch hata yolu, alanlar yine de çözülür.',
  'protocol.wirelessMbus.example.unsupportedCi.name': 'Desteklenmeyen CI (0x78)',
  'protocol.wirelessMbus.example.unsupportedCi.description':
    'CI=0x78 ("No Header APL Follows") adlandırılır ama bu dalgada DIF/VIF zincirine devredilmez — APL payload ham + uyarıyla gösterilir.',

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

  // --- BLE GATT ---
  'protocol.bleGatt.error.frameTooShort': 'Çerçeve en az 1 baytlık Opcode kadar uzun olmalı.',
  'protocol.bleGatt.error.frameTooLong': 'Çerçeve izin verilen azami uzunluğu aşıyor.',
  'protocol.bleGatt.error.aborted': 'Çözümleme iptal edildi.',
  'protocol.bleGatt.error.pduTooShort': 'Bu PDU tipi için tamponda yeterli bayt yok.',
  'protocol.bleGatt.error.uuidLengthInvalid': 'UUID alanı ne 2 (16-bit) ne 16 (128-bit) bayt uzunluğunda.',
  'protocol.bleGatt.warning.unknownOpcode': 'Opcode dar kümede yok; PDU şeması çözülemedi, ham gösterildi.',
  'protocol.bleGatt.warning.pduSchemaNotDecoded':
    'Bu opcode/format dar kapsam dışı; gövde bu dalgada çözülmüyor, ham gösterildi.',
  'protocol.bleGatt.warning.unknownErrorCode': 'Error Code dar kümede yok; ham gösterildi.',
  'protocol.bleGatt.warning.unknownFormat': 'Find Information Response Format alanı 0x01/0x02 dışında; ham gösterildi.',
  'protocol.bleGatt.warning.invalidEntryLength':
    'Length alanı bu PDU tipi için asgari girdi uzunluğunun altında; girdi listesi çözülemedi.',
  'protocol.bleGatt.warning.l2capHeaderDetected':
    'İlk 4 bayt geçerli bir L2CAP Basic çerçeve başlığı (Length+CID=0x0004) — algılandı ve soyuldu.',

  'protocol.bleGatt.documentation.summary':
    'BLE GATT, ATT/L2CAP üzerindeki bağlantılı PDU’yu çözer: 1 baytlık Opcode (Method+Command Flag+Authentication Signature Flag) + PDU tipine göre değişen gövde. Onyedi opcode (Error/Exchange MTU/Find Information/Read (By Type/By Group Type)/Write/Write Command/Handle Value Notification-Indication-Confirmation) adlandırılır ve gövdesi çözülür; kalanı ham + uyarı. Girdi çıplak ATT PDU’dur, isteğe bağlı L2CAP Basic çerçeve öneki (Length+CID=0x0004) algılanıp soyulur. Characteristic DEĞERİ şemasızdır — GATT şeması olmadan ham gösterilir.',
  'protocol.bleGatt.example.handleValueNotification.name': 'Handle Value Notification (Battery Level)',
  'protocol.bleGatt.example.handleValueNotification.description':
    'Handle 0x0025 üzerinden gelen Notification — değer %90 (0x5A).',
  'protocol.bleGatt.example.writeRequestCccdEnable.name': 'Write Request — CCCD Notification Enable',
  'protocol.bleGatt.example.writeRequestCccdEnable.description':
    'CCCD (0x2902) handle 0x002B’ye Notification bitini set eden Write Request (0x0001).',
  'protocol.bleGatt.example.errorResponseInvalidHandle.name': 'Error Response — Invalid Handle',
  'protocol.bleGatt.example.errorResponseInvalidHandle.description':
    'Read Request (0x0A) handle 0x0099’a yanıt: Invalid Handle (0x01).',
  'protocol.bleGatt.example.readByGroupTypeResponsePrimaryServices.name':
    'Read By Group Type Response — Discover All Primary Services',
  'protocol.bleGatt.example.readByGroupTypeResponsePrimaryServices.description':
    'Tek grup: Handle 0x0001..0x0007, Value = Generic Access (0x1800).',
  'protocol.bleGatt.example.unknownOpcode.name': 'Bilinmeyen Opcode (uyarı yolu)',
  'protocol.bleGatt.example.unknownOpcode.description':
    'Find By Type Value Request (0x06) — dar kümenin dışında, gövdesi bu dalgada çözülmez; ham gösterilir.',
  'protocol.bleGatt.example.truncatedErrorResponse.name': 'Eksik Error Response (hata yolu)',
  'protocol.bleGatt.example.truncatedErrorResponse.description':
    'Error Response 5 bayt gerektirir, yalnız 3 bayt var — Error Code eksik, truncated-frame basar.',

  // --- LoRaWAN ---
  'protocol.lorawan.error.frameTooShort': 'Çerçeve en az MHDR(1)+MIC(4)=5 bayt kadar uzun olmalı.',
  'protocol.lorawan.error.frameTooLong': 'Çerçeve izin verilen azami uzunluğu aşıyor.',
  'protocol.lorawan.error.aborted': 'Çözümleme iptal edildi.',
  'protocol.lorawan.error.joinRequestLength': 'Join-Request tam 23 bayt olmalı (MHDR+JoinEUI+DevEUI+DevNonce+MIC).',
  'protocol.lorawan.error.fhdrTruncated': 'FHDR için tamponda yeterli bayt yok (DevAddr+FCtrl+FCnt en az 7 bayt ister).',
  'protocol.lorawan.error.foptsTruncated': 'FOptsLen’in bildirdiği uzunluk için tamponda yeterli bayt yok.',
  'protocol.lorawan.error.macCommandTruncated':
    'MAC komutu tanınıyor ama gövdesi için FOpts tamponunda yeterli bayt yok.',
  'protocol.lorawan.warning.majorNotR1': 'Major alanı LoRaWAN R1 (00) değil; çözüm yine de sürer.',
  'protocol.lorawan.warning.frameKindNotDecoded':
    'Bu FType’ın gövde şeması (Proprietary ya da 1.1’e özgü Rejoin Request) bu dalgada çözülmüyor; ham gösterildi.',
  'protocol.lorawan.warning.joinAcceptEncrypted':
    'Join-Accept gövdesi (MIC dahil) uçtan uca şifreli; anahtar olmadan çözülmez, ham gösterildi.',
  'protocol.lorawan.warning.unknownMacCommandCid':
    'CID dar kümede yok (TS001-1.0.4 çekirdeği dışında, ör. 1.1’e özgü) — gövde uzunluğu bilinmiyor, tanınamadı.',
  'protocol.lorawan.warning.foptsRemainderNotDecoded':
    'Bilinmeyen CID’den sonraki FOpts baytlarının sınırı belirlenemedi; ham gösterildi.',
  'protocol.lorawan.warning.frmPayloadEncrypted': 'FRMPayload şifreli; anahtar olmadan çözülmez, ham gösterildi.',
  'protocol.lorawan.warning.micNeedsSessionKeys':
    'MIC var; oturum anahtarları olmadan doğrulanamaz (PASS/FAIL basılmaz).',

  'protocol.lorawan.documentation.summary':
    'LoRaWAN, PHYPayload’ı çözer: MHDR(1B) + MACPayload + MIC(4B). Join-Request açık metindir (JoinEUI/DevEUI/DevNonce). Join-Accept MHDR sonrası uçtan uca şifrelidir (MIC dahil), ham gösterilir. Data frame’de FHDR (DevAddr/FCtrl/FCnt/FOpts) alan alan çözülür — FCtrl yöne göre farklı bit düzeni taşır; FOpts’taki MAC komutları CID(1B)+gövde zinciri olarak çözülür (LinkCheck/LinkADR/DutyCycle/RXParamSetup/DevStatus/NewChannel/RXTimingSetup/TxParamSetup/DlChannel/DeviceTime — TS001-1.0.4’ün tamamı), 1.1’e özgü CID’ler dar kümenin dışında kalır. FPort=0 uygulama verisi DEĞİL, MAC komutu demektir. FRMPayload her zaman şifreli → ham + işaret. MIC hiçbir zaman doğrulanmaz — "present, cannot verify without session keys" (mavlink crcNeedsDialect emsali). Sürüm çıpası L2 1.0.4 (TS001); FType 110 (1.1 Rejoin Request) dar adlanır, gövdesi bu dalgada çözülmez.',
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
    'Downlink FCtrl yorumu (RFU/FPending) + FOptsLen=2 — DutyCycleReq çözülür.',
  'protocol.lorawan.example.macCommandsLinkCheckReq.name': 'FOpts — LinkCheckReq (gövdesiz)',
  'protocol.lorawan.example.macCommandsLinkCheckReq.description':
    'Uplink, tek MAC komutu: LinkCheckReq (CID 0x02) — cihazın bağlantı kalitesi isteği, gövdesiz.',
  'protocol.lorawan.example.macCommandsLinkAdrReq.name': 'FOpts — LinkADRReq (bit alanları)',
  'protocol.lorawan.example.macCommandsLinkAdrReq.description':
    'Downlink LinkADRReq (CID 0x03): DataRate/TXPower/ChMask/ChMaskCntl/NbTrans bit alanları çözülür.',
  'protocol.lorawan.example.macCommandsUnknownCid.name': 'FOpts — dar küme dışı CID (uyarı yolu)',
  'protocol.lorawan.example.macCommandsUnknownCid.description':
    'CID 0x0B (RekeyInd, LoRaWAN 1.1) sürüm çıpası dışında — tanınamaz, kalan FOpts ham gösterilir.',
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

  // --- Zigbee ---
  'protocol.zigbee.error.frameTooShort': 'Çerçeve en az 802.15.4 MAC minimum uzunluğu (FCF+Sequence+FCS) kadar olmalı.',
  'protocol.zigbee.error.frameTooLong': 'Çerçeve izin verilen azami uzunluğu aşıyor.',
  'protocol.zigbee.error.aborted': 'Çözümleme iptal edildi.',
  'protocol.zigbee.error.fcsMismatch': 'FCS, hesaplanan CRC16/KERMIT değeriyle uyuşmuyor.',
  'protocol.zigbee.error.macAddressingTruncated': 'MAC adresleme alanları için tamponda yeterli bayt yok.',
  'protocol.zigbee.error.nwkTruncated': 'NWK başlığı (IEEE adresleri dahil) için tamponda yeterli bayt yok.',
  'protocol.zigbee.error.apsTruncated': 'APS başlığı için tamponda yeterli bayt yok.',
  'protocol.zigbee.warning.frameVersionUnsupported':
    'Frame Version 2003/2006 dışında (2015+); bu dalgada adresleme kuralı desteklenmiyor, alanlar ham bırakıldı.',
  'protocol.zigbee.warning.nonDataFrame': 'MAC Frame Type Data değil; payload NWK’ya geçirilmedi, ham gösterildi.',
  'protocol.zigbee.warning.nwkAdvancedAddressing':
    'Multicast/Source Route alt-çerçevesi bu dalgada çözülmüyor; kalan NWK payload’ı ham gösterildi.',
  'protocol.zigbee.warning.nwkEncrypted': 'NWK Security etkin; payload şifreli, ham gösterildi (öteye inilmedi).',
  'protocol.zigbee.warning.nwkNonData': 'NWK Frame Type Data değil; payload APS’e geçirilmedi, ham gösterildi.',
  'protocol.zigbee.warning.apsOutOfScope':
    'Group addressing veya Extended Header bu dalgada çözülmüyor; APS payload’ı ham gösterildi.',
  'protocol.zigbee.warning.apsEncrypted': 'APS Security etkin; payload şifreli, ham gösterildi (öteye inilmedi).',
  'protocol.zigbee.warning.apsNonData': 'APS Frame Type Data değil; payload ZCL’e geçirilmedi, ham gösterildi.',
  'protocol.zigbee.warning.zclClusterSpecificNotDecoded':
    'Cluster-specific komut gövdesi bu dalgada çözülmüyor; ham gösterildi.',
  'protocol.zigbee.warning.zclGlobalCommandNotDecoded':
    'Bu global ZCL komutunun gövdesi bu dalgada çözülmüyor; ham gösterildi.',
  'protocol.zigbee.warning.zclUnknownDataType':
    'Attribute veri tipi dar kümede yok; uzunluk bilinmediği için zincir burada durdu, kalan ham gösterildi.',

  'protocol.zigbee.documentation.summary':
    'Zigbee, üç katmanı tek motorda çözer: 802.15.4 MAC (Frame Control, Sequence, adresleme — PAN ID Compression’a göre değişken, FCS CRC16/KERMIT ile GERÇEKTEN doğrulanır) → NWK (Frame Control, Dest/Source Address, Radius, Sequence; Security etkinse payload şifreli ham kalır) → APS (Frame Control, Endpoint’ler, Cluster/Profile ID, Counter; Security etkinse ham kalır) → ZCL (Frame Control, Transaction Sequence Number, Command ID; yalnız Read Attributes Response/Report Attributes/Default Response payload’ı dar bir veri tipi kümesiyle çözülür; cluster-specific komutların gövdesi hâlâ ham). Cluster ID ve (Read Attributes Response/Report Attributes’taki) Attribute ID’ler dar bir kütüphaneyle isimlendirilir — Home Automation’ın en yaygın 18 cluster’ı, TAM ZCL kütüphanesi değil. Yalnız Frame Version 2003/2006 ve yalnız Data frame’ler NWK/APS/ZCL zincirine girer.',
  'protocol.zigbee.example.temperatureReport.name': 'Temperature Measurement — Report Attributes',
  'protocol.zigbee.example.temperatureReport.description':
    'MAC→NWK→APS(Temperature Measurement)→ZCL Report Attributes; raw `29 09` → Int16 2345 (spec örneğinin katman zinciriyle sarmalanmışı).',
  'protocol.zigbee.example.readAttrResponse.name': 'Read Attributes Response (SUCCESS)',
  'protocol.zigbee.example.readAttrResponse.description':
    'AttrID + Status(SUCCESS) + DataType(Int16) + Value alan alan çözülür.',
  'protocol.zigbee.example.defaultResponse.name': 'Default Response',
  'protocol.zigbee.example.defaultResponse.description': 'Response to Command ID + Status(SUCCESS) çözülür.',
  'protocol.zigbee.example.nwkEncrypted.name': 'NWK Security etkin (şifreli, ham)',
  'protocol.zigbee.example.nwkEncrypted.description':
    'NWK Security=1 — payload “Encrypted NWK payload” olarak ham gösterilir, APS’e hiç geçilmez.',
  'protocol.zigbee.example.clusterSpecificCommand.name': 'Cluster-specific komut (dar kapsam dışı)',
  'protocol.zigbee.example.clusterSpecificCommand.description':
    'ZCL Frame Type=Cluster-specific — gövde bu dalgada çözülmüyor, ham + uyarı.',
  'protocol.zigbee.example.macCommandFrame.name': 'MAC Command çerçevesi (NWK’ya geçmez)',
  'protocol.zigbee.example.macCommandFrame.description':
    'MAC Frame Type=MAC Command — payload NWK’ya hiç geçirilmez, ham + uyarı.',
  'protocol.zigbee.example.fcsMismatch.name': 'Bozuk FCS (hata yolu)',
  'protocol.zigbee.example.fcsMismatch.description': 'Son bayt bozulmuş — FCS FAIL, çerçeve geçersiz.',
  'protocol.zigbee.example.truncatedMacAddressing.name': 'Eksik MAC adresleme (hata yolu)',
  'protocol.zigbee.example.truncatedMacAddressing.description':
    'Header adresleme bitleri adres bekliyor ama tamponda bayt yok — truncated-frame basar.',

  // --- Matter ---
  'protocol.matter.error.frameEmpty': 'Girdi boş; en az bir TLV elemanı gerekir.',
  'protocol.matter.error.frameTooLong': 'Çerçeve izin verilen azami uzunluğu aşıyor.',
  'protocol.matter.error.aborted': 'Çözümleme iptal edildi.',
  'protocol.matter.error.truncated': 'Bir TLV elemanının başlığı ya da değeri için tamponda yeterli bayt yok.',
  'protocol.matter.error.reservedElementType':
    'Eleman tipi 0x19–0x1F aralığında (spec’te ayrılmış); uzunluğu bilinmediği için yürüyüş durdu.',
  'protocol.matter.error.taggedEndOfContainer':
    'End-of-container elemanı tag taşıyor; spec bunu yasaklar (tag control sıfır olmalı).',
  'protocol.matter.error.valueOverflow': 'Bir elemanın bildirdiği uzunluk tamponun dışına taşıyor.',
  'protocol.matter.error.lengthUnsupported':
    'Bildirilen uzunluk 0xFFFFFFFF üstünde; bu boyut indekslenebilir değil.',
  'protocol.matter.error.unexpectedEndOfContainer':
    'Açık bir container yokken end-of-container elemanı görüldü.',
  'protocol.matter.error.unclosedContainer':
    'Bir container kapanmadan girdi bitti; end-of-container elemanı spec’te ZORUNLUdur.',
  'protocol.matter.warning.maxDepthReached':
    'Azami container derinliğine ulaşıldı; daha derindeki elemanlar çözülmedi.',
  'protocol.matter.warning.maxElementsReached':
    'Azami eleman sayısına ulaşıldı; kalan elemanlar çözülmedi.',
  'protocol.matter.warning.implicitProfileUnresolved':
    'Implicit profile tag: vendor/profile numarası baytlarda YOK, protokol bağlamından gelir — çözülmedi, uydurulmadı.',
  'protocol.matter.warning.malformedUtf8': 'UTF-8 dizisi bozuk; metin yine de gösterildi.',
  'protocol.matter.warning.contextTagAtTopLevel': 'En dış seviyede context tag kullanılamaz (spec A.2.2).',
  'protocol.matter.warning.anonymousTagInStructure': 'Structure üyeleri anonim tag taşıyamaz (spec A.5.1).',
  'protocol.matter.warning.nonAnonymousTagInArray': 'Array üyeleri anonim tag taşımak zorundadır (spec A.5.2).',

  'protocol.matter.documentation.summary':
    'Matter TLV Tree Decoder, bağımsız bir TLV blob’unu özyinelemeli olarak yürür: her elemanın kontrol baytı (üst 3 bit tag biçimi, alt 5 bit eleman tipi), tag alanı (anonim / context / common / implicit / fully-qualified) ve tipten türeyen little-endian uzunluk/değer alanı çözülür; container’lar (Structure/Array/List) uzunluk taşımadığı için sonlarını zorunlu end-of-container elemanı belirler. Girdi Matter MESAJ çerçevesi DEĞİLDİR — o katman şifreli ve oturumludur, anahtar ister; buraya o zarfın içinden çıkmış çıplak TLV verilir. Tag kuralı ihlalleri (Array üyesi anonim olmalı, Structure üyesi olamaz) hata değil uyarıdır. Interaction Model, Commissioning ve Session çözümlemesi bu dalgada YOKTUR.',
  'protocol.matter.example.identifyResponse.name': 'Gerçek Matter mesaj payload’ı (SDK vektörü)',
  'protocol.matter.example.identifyResponse.description':
    'connectedhomeip SDK test vektörü: fully-qualified tag’li Structure, içinde context tag’li sayı ve metin üyeleri (seri numarası, "1.4rc5").',
  'protocol.matter.example.mixedArray.name': 'Karışık tipli Array (iç içe container)',
  'protocol.matter.example.mixedArray.description':
    'Spec örneği: [42, −170000, {}, 17.9, "Hello!"] — beş farklı tip, biri boş Structure.',
  'protocol.matter.example.structureContextTags.name': 'Context tag’li Structure',
  'protocol.matter.example.structureContextTags.description': 'Spec örneği: {0 = 42, 1 = −17}.',
  'protocol.matter.example.tagForms.name': 'Fully-qualified tag biçimi',
  'protocol.matter.example.tagForms.description':
    'Spec örneği: vendor id + profile number + tag numarası taşıyan Structure ve üyesi.',
  'protocol.matter.example.listMixedTags.name': 'List — karışık tag biçimleri',
  'protocol.matter.example.listMixedTags.description':
    'Spec örneği: List üyeleri anonim ve context tag’i birlikte kullanabilir.',
  'protocol.matter.example.emptyStructure.name': 'Boş Structure',
  'protocol.matter.example.emptyStructure.description':
    'Açılış + zorunlu end-of-container: iki bayt, container aralığının tamamı.',
  'protocol.matter.example.unclosedContainer.name': 'Kapanmamış container (hata yolu)',
  'protocol.matter.example.unclosedContainer.description':
    'Structure örneğinin end-of-container’ı kesilmiş hâli — çıkarımla tamamlanmaz, hata basar.',
  'protocol.matter.example.truncatedString.name': 'Kesik string gövdesi (hata yolu)',
  'protocol.matter.example.truncatedString.description':
    '6 bayt uzunluk bildiriyor ama tamponda 2 bayt var — value-overflow basar.',

  // --- 1-Wire (faz 10 dalga 11a) ---
  'protocol.oneWire.error.emptyFrame': 'Arabellek en az 1 bayt (ROM Command) içermeli.',
  'protocol.oneWire.error.romIdTruncated':
    'Read ROM/Match ROM/Overdrive Match ROM komutundan sonra 64-bit ROM ID için gereken 8 bayt arabellekte yok.',
  'protocol.oneWire.error.frameTooLong': 'Çerçeve, verilen azami uzunluğu aşıyor.',
  'protocol.oneWire.error.aborted': 'Çözümleme iptal edildi.',
  'protocol.oneWire.error.crcMismatch':
    'Hesaplanan CRC-8/MAXIM, ROM ID’nin son baytıyla eşleşmiyor.',
  'protocol.oneWire.warning.unknownRomCommand':
    'ROM Command değeri bilinen kümede (Read/Match/Skip/Search ROM, Overdrive Skip/Match ROM) yok — ham gösteriliyor.',
  'protocol.oneWire.summary.commandOnly': '{command}',
  'protocol.oneWire.summary.romId': '{command}: Family {family}',
  'protocol.oneWire.summary.unknownCommand': '{command} (tanınmayan)',
  'protocol.oneWire.documentation.summary':
    'ROM Command baytı (Read/Match/Skip/Search ROM + Overdrive çifti, Microchip AN3320 ve esp-open-rtos onewire.c ile çapraz teyitli) ve — Read ROM/Match ROM/Overdrive Match ROM’da — izleyen 64-bit ROM ID (Family Code + Serial Number + CRC-8/MAXIM) çözülür. Serial Number’ın iç bayt sırası doğrulanmadığı için tek sayıya birleştirilmez, yalnız ham bayt gösterilir. Search ROM’un bit-seviyeli Bit/Complement/Branch/Discrepancy arama ağacı ve Reset/Presence pulse timing’i bu motorun kapsamı dışındadır.',
  'protocol.oneWire.example.readRom.name': 'Read ROM (Family 0x28, geçerli CRC)',
  'protocol.oneWire.example.readRom.description':
    'Read ROM komutunu, Family Code 0x28 (DS18B20 ailesi) + temsili seri no + bağımsız hesaplanmış CRC-8/MAXIM izler.',
  'protocol.oneWire.example.matchRom.name': 'Match ROM (farklı seri no, geçerli CRC)',
  'protocol.oneWire.example.matchRom.description':
    'Match ROM komutuyla farklı bir temsili seri no + bağımsız hesaplanmış CRC-8/MAXIM.',
  'protocol.oneWire.example.skipRom.name': 'Skip ROM (ROM ID yok)',
  'protocol.oneWire.example.skipRom.description':
    'Tek bayt — tüm cihazlara adressiz erişim, ROM ID hiç izlemez.',
  'protocol.oneWire.example.searchRom.name': 'Search ROM (arama ağacı kapsam dışı)',
  'protocol.oneWire.example.searchRom.description':
    'Komut tanınır; asıl bit-seviyeli çoklu-cihaz arama algoritması bu motorun kapsamında değildir.',
  'protocol.oneWire.example.overdriveSkipRom.name': 'Overdrive Skip ROM',
  'protocol.oneWire.example.overdriveSkipRom.description':
    'Overdrive ailesinin ROM ID taşımayan üyesi — yalnız Microchip AN3320’de doğrulandı.',
  'protocol.oneWire.example.badCrc.name': 'Bozuk CRC (hata yolu)',
  'protocol.oneWire.example.badCrc.description':
    '"Read ROM" örneğiyle aynı gövde, yalnız CRC baytı bilerek bozuldu — ParseFailure değil ama çerçeve valid:false ve crc-mismatch hatası taşır.',
  'protocol.oneWire.example.unknownCommand.name': 'Tanınmayan ROM Command (uyarı yolu)',
  'protocol.oneWire.example.unknownCommand.description':
    '0xAA bilinen 6 ROM komutundan biri değil — yalnız uyarı üretir, hata basmaz.',

  // --- SPI (faz 10 dalga 11b) ---
  'protocol.spi.error.emptyFrame': 'Arabellek en az 1 bayt (Command) içermeli.',
  'protocol.spi.error.aborted': 'Çözümleme iptal edildi.',
  'protocol.spi.summary.read': 'Read Register {register}',
  'protocol.spi.summary.write': 'Write Register {register}',
  'protocol.spi.documentation.summary':
    'Command baytının 7. biti (okuma/yazma) okunarak register transaction çözülür: okuma ise 1 dummy bayt artı dönen veri, yazma ise doğrudan yazılan veri gösterilir. CPOL/CPHA ve transfer süresi hesaplayıcısı (Zamanlama sekmesi) ayrı bir motorda zaten hazırdı. Full-duplex tek bir mantıksal bayt dizisine indirgenir — o anki kullanılmayan hat hiç gösterilmez. Dummy bayt sayısı (sabit 1) ve okuma/yazma bitinin konumu spec özetinin kendi örneğine dayanır, gerçek cihazlarda değişebilir.',
  'protocol.spi.example.registerRead.name': 'Register okuma (spec IMU örneği)',
  'protocol.spi.example.registerRead.description':
    'Register 0x75 okunuyor: Command 0xF5 (0x75 üzerine okuma biti eklenmiş), 1 dummy bayt, dönen değer 0x71.',
  'protocol.spi.example.registerWrite.name': 'Register yazma',
  'protocol.spi.example.registerWrite.description':
    'Register okuma örneğiyle simetrik: okuma biti temizken dummy yok, yazılan değer doğrudan komuttan sonra gelir.',
  'protocol.spi.example.multiByteRead.name': 'Çok baytlı okuma (burst)',
  'protocol.spi.example.multiByteRead.description':
    'Aynı register, 4 baytlık burst okuma — Data alanının birden çok baytı tek seferde taşıdığını gösterir.',

  // --- Quad SPI (faz 10 dalga 11b) ---
  'protocol.quadSpi.error.emptyFrame': 'Arabellek en az 1 bayt (Command) içermeli.',
  'protocol.quadSpi.error.aborted': 'Çözümleme iptal edildi.',
  'protocol.quadSpi.summary.transaction': 'Command {command}',
  'protocol.quadSpi.documentation.summary':
    'Command (1 bayt) artı Address (3 bayt, büyük uçlu — spec özetinin 0xEB/0x001234 örneği) artı Data çözülür. Dummy cycle hiç bayt tüketmez: tri-state hat veri taşımaz, kaç bayta karşılık geldiği lane genişliğine bağlıdır ve bu bir zamanlama parametresidir (Zamanlama sekmesindeki hesaplayıcı zaten kapsıyor). Adres uzunluğu sabit 3 bayt varsayılır; 4 baytlık adresleme bu sürümde yok.',
  'protocol.quadSpi.example.flashFastRead.name': 'Flash Fast Read (spec örneği)',
  'protocol.quadSpi.example.flashFastRead.description':
    'Command 0xEB (Fast Read Quad I/O), Address 0x001234, ardından temsili 4 bayt veri.',
  'protocol.quadSpi.example.commandOnly.name': 'Yalnız komut (adressiz)',
  'protocol.quadSpi.example.commandOnly.description':
    'Write Enable gibi adres taşımayan bir komut örneği — Address ve Data alanı hiç görünmez.',

  // --- Octal SPI (faz 10 dalga 11b) ---
  'protocol.octalSpi.error.emptyFrame': 'Arabellek en az 1 bayt (Command) içermeli.',
  'protocol.octalSpi.error.aborted': 'Çözümleme iptal edildi.',
  'protocol.octalSpi.summary.transaction': 'Command {command}',
  'protocol.octalSpi.documentation.summary':
    'Quad SPI ile aynı Command artı Address (3 bayt, büyük uçlu) artı Data yapısı çözülür (paylaşılan çekirdek). SDR/DDR ve DQS data strobe elektriksel/zamanlama kavramlarıdır, decode baytlarında görünmez — throughput motoru hazır ama henüz hiçbir hesaplayıcı arayüzü onu okumuyor.',
  'protocol.octalSpi.example.flashRead.name': 'Flash okuma (temsili)',
  'protocol.octalSpi.example.flashRead.description':
    'Command 0x0C, Address 0x000000, ardından temsili 4 bayt veri — gerçek bir üretici datasheet inden alınmadı, illüstratif.',
  'protocol.octalSpi.example.commandOnly.name': 'Yalnız komut (adressiz)',
  'protocol.octalSpi.example.commandOnly.description':
    'Write Enable gibi adres taşımayan bir komut örneği — Address ve Data alanı hiç görünmez.',

  // --- I²C (faz 10 dalga 11c) ---
  'protocol.i2c.error.emptyFrame': 'Arabellek en az 1 bayt (Address) içermeli.',
  'protocol.i2c.error.aborted': 'Çözümleme iptal edildi.',
  'protocol.i2c.summary.probe': 'Bus Probe {address}',
  'protocol.i2c.summary.write': 'Write {address} · Register {register}',
  'protocol.i2c.summary.read': 'Read {address}',
  'protocol.i2c.summary.registerRead': 'Register Read {address} · Register {register}',
  'protocol.i2c.documentation.summary':
    'İlk baytın R/W bitine ve (varsa) üçüncü baytın adres+R/W eşleşmesine bakılarak dört transaction şekli çözülür: yalnız adres (bus probe), Address+Register+Data (write), Address+Data (repeated-start olmadan read) ve Address+Register+Repeated START Address+Data (spec özetinin ana örneği). ACK/NACK, clock stretching ve arbitration bit-seviyeli elektriksel sinyallerdir, decode baytlarında görünmez. Transfer süresi/7-bit adres kodlama/pull-up hesaplayıcısı (Zamanlama sekmesi) ayrı bir motorda zaten hazırdı.',
  'protocol.i2c.example.registerRead.name': 'Register okuma (spec ana örneği, repeated START)',
  'protocol.i2c.example.registerRead.description':
    'Address 0x68 yazma (0xD0), Register 0x75, Repeated START ile Address 0x68 okuma (0xD1), dönen değer 0x71.',
  'protocol.i2c.example.registerWrite.name': 'Register yazma',
  'protocol.i2c.example.registerWrite.description':
    'Register okuma örneğiyle simetrik: repeated START yok, register sonrası yazılan değer doğrudan gelir.',
  'protocol.i2c.example.readOnly.name': 'Doğrudan okuma (repeated START yok)',
  'protocol.i2c.example.readOnly.description':
    'Address 0x68 okuma (0xD1) ile doğrudan başlar — register kavramı yok, SMBus Receive Byte tarzına benzer.',
  'protocol.i2c.example.busProbe.name': 'Bus tarama (yalnız adres)',
  'protocol.i2c.example.busProbe.description':
    'Yalnız Address baytı (0x1E yazma) — cihaz var/yok kontrolü, spec özetinin magnetometer örneği.',

  // --- SMBus / PMBus (faz 10 dalga 11i) ---
  'protocol.smbus.error.emptyFrame': 'Arabellek en az 1 bayt (Address) içermeli.',
  'protocol.smbus.error.aborted': 'Çözümleme iptal edildi.',
  'protocol.smbus.warning.pecInferred':
    'Son bayt gövdenin CRC-8 sağlamasıyla eşleşti ve PEC kabul edildi. SMBus her protokolü PEC\'li ve PEC\'siz tanımlar; eşleşme tesadüf de olabilir (1/256).',
  'protocol.smbus.warning.ambiguousShape':
    'Bu bayt dizisi birden çok transaction türüne uyuyor. Sabit boyutlu yorum seçildi, alternatifi alan tablosunun altında.',
  'protocol.smbus.warning.unknownShape':
    'Bayt dizisi spec\'in saydığı transaction türlerinden hiçbirine uymuyor — kısmi yakalama ya da farklı bir cihaz konvansiyonu olabilir.',
  'protocol.smbus.documentation.summary':
    'I²C elektriksel altyapısı üzerine kapalı bir transaction kümesi: Quick Command\'dan Block Write-Block Read Process Call\'a kadar 11 tür, adres baytları dahil hesaplanan CRC-8 PEC ile. Timeout ve clock-LOW izleme bit seviyesindedir, bu sayfada çözülmez.',
  'protocol.smbus.example.readWordPec.name': 'Read Word + PEC (spec örneği)',
  'protocol.smbus.example.readWordPec.description':
    'Adres+W, komut 0x8B, repeated START, adres+R, iki veri baytı ve PEC. Sağlama adres baytları dahil hesaplanır.',
  'protocol.smbus.example.writeByte.name': 'Write Byte (PEC yok)',
  'protocol.smbus.example.writeByte.description':
    'Adres+W, komut 0x00, tek veri baytı. Aynı iskeletin PEC\'siz biçimi — panel yine de hesaplanan PEC\'i gösterir.',
  'protocol.smbus.example.quickCommand.name': 'Quick Command',
  'protocol.smbus.example.quickCommand.description':
    'Yalnız adres baytı: veri yok, komut yok — cihazı R/W bitiyle tetikler.',
  'protocol.smbus.example.blockReadPec.name': 'Block Read + PEC',
  'protocol.microwire.error.emptyFrame': 'Arabellek en az 1 bayt içermeli.',
  'protocol.microwire.error.noStartBit':
    'Start biti bulunamadı: yakalamada hiç 1 biti yok. Microwire çerçevesi CS ve DI yüksekken başlar.',
  'protocol.microwire.error.truncated':
    'Seçilen profilin gerektirdiği bit sayısı yakalamada yok; yarım okunan sözcük basılmaz.',
  'protocol.microwire.warning.trailingBits':
    'Komut bittikten sonra arabellekte bit kaldı. Beklenen durumdur (komut bit hizalı, bayta bölünmez) ama fazlalık bir sonraki transaction\'ın başı da olabilir.',
  'protocol.microwire.warning.leadingIdle':
    'Start bitinden önce boşta (sıfır) bitler atlandı. Datasheet\'e göre beklenen durumdur; sayısı çoksa yakalama yanlış yerden başlamış olabilir.',
  'protocol.microwire.warning.addressDontCare':
    'Bu profilde adres alanının üst biti don\'t-care\'dir; anlamlı adres maskelenerek basıldı.',
  'protocol.microwire.option.profile': 'Cihaz profili',
  'protocol.microwire.option.profile.description':
    'Bir preset seçilirse aşağıdaki üç sayı yok sayılır; hangi değerlerin uygulandığı çözüm tablosunun ilk satırında görünür.',
  'protocol.microwire.option.profile.custom': 'Serbest — datasheet\'ten gir',
  'protocol.microwire.option.opcodeBits': 'Opcode bit',
  'protocol.microwire.option.addressBits': 'Adres bit',
  'protocol.microwire.option.wordBits': 'Sözcük bit',
  'protocol.microwire.option.customOnly': 'Yalnız serbest profilde geçerli.',
  'protocol.microwire.documentation.summary':
    'Üç telli half-duplex EEPROM arayüzü. Çerçevenin şekli standart değil cihaz datasheet\'inden gelir; çözücü opcode/adres/sözcük genişliklerini parametre olarak alır.',
  'protocol.microwire.example.readWord.name': 'READ (93xx46 x16)',
  'protocol.microwire.example.readWord.description':
    'Start biti, opcode 10, 6 bitlik adres 0x0A ve 16 bitlik veri 0xBEEF — datasheet tablosunda 25 clock çevrimi.',
  'protocol.microwire.example.writeWord.name': 'WRITE (93xx46 x16)',
  'protocol.microwire.example.writeWord.description':
    'Opcode 01, adres 0x3F, yazılan sözcük 0x1234. Veri sözcüğünü master sürer (DI hattı).',
  'protocol.microwire.example.erase.name': 'ERASE (veri yok)',
  'protocol.microwire.example.erase.description':
    'Opcode 11 ve adres; veri sözcüğü taşımaz, çerçeve 9 clock çevriminde biter.',
  'protocol.microwire.example.ewen.name': 'EWEN (genişletilmiş komut)',
  'protocol.microwire.example.ewen.description':
    'Opcode 00 iken komutu adres alanının üst iki biti seçer; burada 11 → yazma/silme izni açılır.',
  'protocol.i3c.error.emptyFrame': 'Arabellek en az 1 bayt (adres) içermeli.',
  'protocol.i3c.error.cccMissingCode': 'Broadcast adresinden sonra CCC kodu baytı gelmiyor.',
  'protocol.i3c.error.directMissingTarget':
    'Direct CCC hedef adresi olmadan çözülemez; repeated START sonrası adres baytı eksik.',
  'protocol.i3c.warning.ibiAmbiguous':
    'Bu bir private SDR okuması da olabilir, bir IBI de: ikisi yakalanmış baytlarda AYNI görünür. Biliyorsanız çerçeve türünü yukarıdan seçin.',
  'protocol.i3c.warning.daaParityAssumed':
    'Atanan adres, adres-baytı konvansiyonuyla (adres üstte, parite altta) okundu. Parite bitinin kablodaki yeri açık kaynaklardan doğrulanamadı — bu bir varsayımdır.',
  'protocol.i3c.warning.daaTruncated':
    'Bir cihaz tanıtım bloğu (PID+BCR+DCR) yarım kaldı; kalan baytlar yorumlanmadan basıldı.',
  'protocol.i3c.warning.unknownCcc': 'Bu CCC kodu bilinen kod uzayında yok; ad uydurulmadı.',
  'protocol.i3c.warning.vendorCcc':
    'Satıcı tanımlı CCC aralığında; anlamı cihaz üreticisinin belgesinden gelir.',
  'protocol.i3c.warning.unknownDcr':
    'DCR değeri adlandırılmadı: cihaz sınıfı kodlarının kayıt belgesi kamuya açık değil, ham bayt basıldı.',
  'protocol.i3c.warning.entHdrOpaque':
    'ENTHDR komutu tanındı ama sonrasındaki HDR trafiği çözülmez — kapsam dışı.',
  'protocol.i3c.warning.pidRandom':
    'PID\'in alt 32 biti rastgele işaretli; part ve instance kimliği taşımadığı için basılmadı.',
  'protocol.i3c.option.frameKind': 'Çerçeve türü',
  'protocol.i3c.option.frameKind.description':
    'Yakalanmış baytlar private SDR okumasını IBI\'den ayırt etmeye yetmez; biliyorsanız burada söyleyin.',
  'protocol.i3c.option.frameKind.auto': 'Otomatik',
  'protocol.i3c.option.frameKind.ccc': 'CCC',
  'protocol.i3c.option.frameKind.private': 'Private SDR',
  'protocol.i3c.option.frameKind.ibi': 'IBI',
  'protocol.i3c.documentation.summary':
    'MIPI iki telli sensör bus\'ı: I²C hatlarını korur, üstüne dinamik adresleme, ortak komut kodları ve bant içi kesme ekler. Çözücü CCC kod uzayını, ENTDAA cihaz tablosunu ve BCR/DCR/PID bit alanlarını açar.',
  'protocol.i3c.example.entdaa.name': 'ENTDAA — iki cihaz keşfi',
  'protocol.i3c.example.entdaa.description':
    'Ayrılmış broadcast adresi, ENTDAA komutu ve iki hedefin PID/BCR/DCR tanıtımı ile atanan dinamik adresleri (0x08 ve 0x09).',
  'protocol.i3c.example.broadcastEnec.name': 'Broadcast ENEC',
  'protocol.i3c.example.broadcastEnec.description':
    'Tüm hedeflerde SIR, MR ve Hot-Join olaylarını açan yayın komutu.',
  'protocol.i3c.example.directGetbcr.name': 'Direct GETBCR',
  'protocol.i3c.example.directGetbcr.description':
    'Komut baytından sonra repeated START ile hedef adresi gelir; yanıt baytı BCR yetenek bitlerine açılır.',
  'protocol.i3c.example.privateSdrWrite.name': 'Private SDR yazma',
  'protocol.i3c.example.privateSdrWrite.description':
    'Broadcast adresi yok: doğrudan hedefin dinamik adresi ve ardından veri.',
  'protocol.i3c.example.ibi.name': 'IBI (bant içi kesme)',
  'protocol.i3c.example.ibi.description':
    'Otomatik türde private SDR okuması gibi görünür; çerçeve türünü IBI seçince zorunlu veri baytı adlandırılır.',
  'protocol.smbus.example.blockReadPec.description':
    'Repeated START sonrası sayaç baytı (0x04) ve dört veri baytı; sayaç veri sayısını doğruladığı için blok okuması olarak sınıflanır.',

  'protocol.pmbus.error.tooShort': 'Arabellek en az 2 bayt (Address + Command Code) içermeli.',
  'protocol.pmbus.error.aborted': 'Çözümleme iptal edildi.',
  'protocol.pmbus.warning.unknownCommand':
    'Komut kodu yerleşik haritada yok. PMBus komut kümesi cihaz başına genişler; veri baytları ham gösteriliyor.',
  'protocol.pmbus.warning.voutModeRequired':
    'Çıkış gerilimi komutlarının üssü çerçevede taşınmaz, VOUT_MODE komutundan bilinir. Üs uydurulmadı — ham mantissa gösteriliyor.',
  'protocol.pmbus.warning.faultSet': 'STATUS kaydında en az bir arıza/uyarı biti set.',
  'protocol.pmbus.warning.pecInferred':
    'Son bayt gövdenin CRC-8 sağlamasıyla eşleşti ve PEC kabul edildi (1/256 tesadüf payı).',
  'protocol.pmbus.documentation.summary':
    'SMBus paket iskeleti üzerine güç cihazlarının komut protokolü: komut kodu adına çevrilir, telemetri Linear11 olarak volt/amper/dereceye açılır, STATUS_BYTE/STATUS_WORD bit ağacına dökülür ve COEFFICIENTS yanıtı DIRECT formatın m/b/R katsayılarına ayrıştırılır.',
  'protocol.pmbus.example.readVin.name': 'READ_VIN (Linear11, 12 V)',
  'protocol.pmbus.example.readVin.description':
    'Read Word: komut 0x88, veri düşük bayt önce (0x00 0xD3 → 0xD300) → N=-6, Y=768, yani 12 V. Sonda PEC var.',
  'protocol.pmbus.example.statusWord.name': 'STATUS_WORD 0x0840 (spec örneği)',
  'protocol.pmbus.example.statusWord.description':
    'Alt bayt 0x40 → OFF, üst bayt 0x08 → PG_STATUS#. Spec özetinin kendi örneğinin bit ağacı karşılığı.',
  'protocol.pmbus.example.voutMode.name': 'VOUT_MODE 0x17',
  'protocol.pmbus.example.voutMode.description':
    'Read Byte: mod bitleri 00b (ULINEAR16), parametre 10111b → -9 üssü. Çıkış gerilimi okumalarının üssü buradan gelir.',
  'protocol.pmbus.example.coefficients.name': 'COEFFICIENTS (Block Write-Block Read)',
  'protocol.pmbus.example.coefficients.description':
    'Yazma tarafı komut 0x8B için okuma katsayılarını ister, okuma tarafı m=1, b=-100, R=3 döner.',

  // --- USB (faz 10 dalga 11j) ---
  'protocol.usb.error.emptyFrame': 'Arabellek en az 1 bayt (PID) içermeli.',
  'protocol.usb.error.aborted': 'Çözümleme iptal edildi.',
  'protocol.usb.error.pidCheckFailed':
    'PID check alanı paket türünün bire tümleyeni değil (USB 2.0 §8.3.1) — alıcı bu paketi yok sayar. Yapısal çözüm yine gösteriliyor.',
  'protocol.usb.error.crc5Mismatch':
    'Token CRC5 tutmuyor: adres/endpoint (ya da frame number) alanları bozulmuş olabilir.',
  'protocol.usb.error.crc16Mismatch': 'Veri paketinin CRC16 değeri hesaplananla uyuşmuyor.',
  'protocol.usb.error.tokenTruncated':
    'Token paketi 3 bayt olmalı (PID + iki alan baytı); eksik baytlar CRC5 konumunu da kaydırdığı için alanlar güvenilir çözülemez.',
  'protocol.usb.warning.setupInferred':
    'Yük 8 bayt olduğu için SETUP isteği (Table 9-2) varsayılarak açıldı. Bunu kesinleştiren şey önceki SETUP token paketidir; tek paketlik yakalamada o yok, bu yüzden yorum ÇIKARIMDIR.',
  'protocol.usb.warning.descriptorInferred':
    'İlk iki bayt (bLength, bDescriptorType) tutarlı olduğu için yük tanımlayıcı zinciri varsayılarak açıldı — kesin değil, çıkarım.',
  'protocol.usb.warning.trailingBytes':
    'Paketin beklenen uzunluğunu aşan baytlar hiçbir alana düşmedi; ayrı bir alanda gösteriliyorlar. Art arda yapıştırılmış paketler bu deseni üretir (paket sınırını veren SYNC/EOP bayt akışında yoktur).',
  'protocol.usb.warning.reservedPid': 'PID rezerve edilmiş değer (0000b) — Table 8-1de tanımlı bir paket türü değil.',
  'protocol.usb.warning.specialPid':
    'Özel PID (PRE/ERR, SPLIT, PING). PRE ve ERR aynı kodu paylaşır ve tek paketten ayrılamaz; SPLIT/PING alan çözümü bu dalgada yok.',
  'protocol.usb.documentation.summary':
    'USB 2.0 paket seviyesi: PID türü ve check alanı, token adres/endpoint çözümü, SOF frame number, veri yükü ve CRC16 doğrulaması, handshake paketleri. Veri yükü 8 baytsa SETUP isteği, tanımlayıcı başlığı taşıyorsa Device/Configuration/Interface/Endpoint/String zinciri olarak açılır. CRC5 ve CRC16 spec §8.3.5ten doğrulanmış parametrelerle hesaplanır.',
  'protocol.usb.example.setupToken.name': 'SETUP token (adres 0, endpoint 0)',
  'protocol.usb.example.setupToken.description':
    'Enumeration başındaki varsayılan adres. Hat dizisi 2D 00 10 — CRC5 spec algoritmasıyla bağımsızca hesaplandı.',
  'protocol.usb.example.inToken.name': 'IN token (adres 0x3A, endpoint 10)',
  'protocol.usb.example.inToken.description': 'Cihazdan hosta veri isteyen token; adres ve endpoint alanları 11 bitin içinde bölünür.',
  'protocol.usb.example.sof.name': 'SOF (frame 100)',
  'protocol.usb.example.sof.description': 'Start-of-Frame işaretçisi 11 bitlik frame number taşır, adres/endpoint taşımaz.',
  'protocol.usb.example.setupData.name': 'DATA0 · GET_DESCRIPTOR(Device)',
  'protocol.usb.example.setupData.description':
    'SETUP token peşinden gelen 8 baytlık istek: bmRequestType 0x80 (cihazdan hosta, standart, cihaz), bRequest 6, wValue 0x0100 (DEVICE #0), wLength 18.',
  'protocol.usb.example.deviceDescriptor.name': 'DATA1 · Device Descriptor (0x0483 / 0x5740)',
  'protocol.usb.example.deviceDescriptor.description':
    'Spec özetinin kendi örneği: VID 0x0483, PID 0x5740, CDC sınıfı, USB 2.00, endpoint 0 için 64 baytlık paket boyu.',
  'protocol.usb.example.configurationDescriptor.name': 'DATA0 · Configuration zinciri',
  'protocol.usb.example.configurationDescriptor.description':
    'Tek yükte Configuration + Interface + Endpoint IN 0x81 + Endpoint OUT 0x01; toplam 32 bayt, 100 mA bus-powered.',
  'protocol.usb.example.ack.name': 'ACK handshake',
  'protocol.usb.example.ack.description': 'Tek baytlık paket: yalnız PID. Handshake paketlerinde CRC yoktur.',
  'protocol.usb.example.badCrc.name': 'DATA0 · bozuk CRC16',
  'protocol.usb.example.badCrc.description': 'Aynı SETUP yükünün son CRC baytı kasten bozuldu — hata yolunun nasıl göründüğünü gösterir.',

  // --- Ethernet Interface / MDIO (faz 10 dalga 11k) ---
  'protocol.mdio.error.emptyFrame': 'Arabellek boş — MDIO çerçevesi 32 bit (4 bayt).',
  'protocol.mdio.error.aborted': 'Çözümleme iptal edildi.',
  'protocol.mdio.error.truncated':
    'MDIO çerçevesi için yeterli bayt yok: preamble sonrası en az 4 bayt gerekir. Tamamı 0xFF olan yakalama yalnız boşta kalan hattır, çerçeve taşımaz.',
  'protocol.mdio.error.invalidStart':
    'ST alanı ne 01 (Clause 22) ne 00 (Clause 45) — çerçeve hizası kaymış olabilir.',
  'protocol.mdio.warning.invalidOpcode':
    'OP alanı ne 10 (okuma) ne 01 (yazma). Alanlar yine gösteriliyor ama işlem türü bilinmiyor.',
  'protocol.mdio.warning.turnaround':
    'Turnaround alanı beklenen 10 değerinde değil; yazma işleminde bu değer sabittir.',
  'protocol.mdio.warning.noPhyResponse':
    'Okuma isteğine PHY cevap vermemiş: turnaround\'ın ikinci bitini adreslenen PHY 0\'a çeker, burada 1 kalmış (hat pull-up ile yüksek). Klasik "PHY not detected" / yanlış PHY adresi belirtisi — veri alanı da genelde 0xFFFF okunur.',
  'protocol.mdio.warning.clause45':
    'ST=00: Clause 45 (dolaylı adresleme) çerçevesi. Op kodu tablosu elimizdeki kamuya açık kaynaklarda olmadığı için alanlara AYRILMIYOR, ham 32 bit gösteriliyor.',
  'protocol.mdio.warning.trailingBytes':
    'Çerçevenin 4 baytından sonra artan baytlar hiçbir alana düşmedi; ayrı bir alanda gösteriliyorlar.',
  'protocol.mdio.warning.preambleSuppressed':
    'Preamble 32 bit (4 bayt 0xFF) değil. Bu hata değildir — PHY\'ler preamble bastırmayı destekler ve ilk senkronizasyondan sonra preamble göndermek gerekmez.',
  'protocol.mdio.documentation.summary':
    'MDIO/MDC yönetim çerçevesi (MII Serial Management Interface) çözümü: preamble, ST, OP, PHYAD, REGAD, turnaround ve 16 bitlik veri. Register 0/1/4/5 (BMCR/BMSR/ANAR/ANLPAR) bit bit açılır — link durumu, hız, duplex, auto-negotiation ve karşı tarafın yetenekleri buradan okunur. Cevapsız okuma turnaround bitinden ayırt edilir.',
  'protocol.mdio.example.readBmsr.name': 'BMSR okuma (PHY 1, register 1)',
  'protocol.mdio.example.readBmsr.description':
    'Klasik link kontrolü: 0x782D → link UP, auto-negotiation tamam, 10/100 yarım ve tam dupleks yetenekli.',
  'protocol.mdio.example.writeBmcr.name': 'BMCR yazma (0x3100)',
  'protocol.mdio.example.writeBmcr.description':
    'Auto-negotiation etkin + 100 Mb/s + full duplex bitleri. AN açıkken hız/duplex bitleri PHY tarafından yok sayılır; özet satırı bunu söyler.',
  'protocol.mdio.example.readAnlpar.name': 'ANLPAR okuma (partner yetenekleri)',
  'protocol.mdio.example.readAnlpar.description':
    '0x45E1 → karşı taraf 10/100 yetenekli, acknowledge biti set, pause destekli. Spec özetinin "Partner 10/100 capable" satırının bayt karşılığı.',
  'protocol.mdio.example.noPhy.name': 'Cevapsız okuma (PHY 7)',
  'protocol.mdio.example.noPhy.description':
    'Turnaround 11 ve veri 0xFFFF: o adreste PHY yok ya da adres yanlış. Uyarı bunu ayrıca söyler.',
  'protocol.mdio.example.preambleSuppressed.name': 'Preamble bastırılmış okuma',
  'protocol.mdio.example.preambleSuppressed.description':
    'Senkronizasyon bir kez kurulduktan sonra preamble göndermek zorunlu değildir; çerçeve doğrudan ST ile başlar.',
  'protocol.mdio.example.clause45.name': 'Clause 45 çerçevesi (ST=00)',
  'protocol.mdio.example.clause45.description':
    'PLCA gibi genişletilmiş register alanları bu yolla okunur (MMD 31 = Vendor Specific 2). Bu dalgada adlandırılır, alanlarına ayrılmaz.',

  // --- Single Pair Ethernet / PLCA (faz 10 dalga 11k) ---
  'calc.spePlca.name': 'Single Pair Ethernet / PLCA',
  'calc.spePlca.summary':
    '10BASE-T1S/T1L, 100BASE-T1 ve 1000BASE-T1 için bit ve çerçeve süresi; 10BASE-T1S multidrop hattında PLCA çevrim süresi, en kötü erişim gecikmesi ve burst penceresi.',
  'calc.field.spePhySection': 'PHY ve çerçeve',
  'calc.field.plcaSection': 'PLCA çevrimi',
  'calc.field.spePhyType': 'PHY sınıfı',
  'calc.field.frameBytes': 'Çerçeve boyu',
  'calc.field.interFrameGapBits': 'Çerçeveler arası boşluk',
  'calc.field.lineRate': 'Hat hızı',
  'calc.field.frameBitTimes': 'Çerçeve uzunluğu',
  'calc.field.frameTime': 'Çerçeve süresi',
  'calc.field.frameTimeWithGap': 'Boşlukla birlikte',
  'calc.field.plcaNodeCount': 'Node sayısı (NCNT)',
  'calc.field.plcaTransmittingNodes': 'Gönderen node sayısı',
  'calc.field.plcaToTimer': 'to_timer (TOTMR)',
  'calc.field.plcaMaxBurstCount': 'Maks. burst sayısı (MAXBC)',
  'calc.field.plcaBurstTimer': 'burst_timer (BTMR)',
  'calc.field.plcaBeaconOptional': 'BEACON süresi (opsiyonel)',
  'calc.field.plcaIdleBits': 'Susan node’ların payı',
  'calc.field.plcaTransmitBits': 'İletim payı',
  'calc.field.plcaCycleBits': 'Çevrim uzunluğu',
  'calc.field.plcaCycleTime': 'Çevrim süresi',
  'calc.field.plcaWorstCase': 'En kötü erişim gecikmesi',
  'calc.field.plcaEfficiency': 'Veri verimi',
  'calc.field.plcaBurstWindow': 'Burst penceresi',
  'calc.field.plcaBurstDisabled': 'Kapalı (MAXBC = 0)',
  'calc.field.plcaBeaconOmitted':
    'BEACON süresi girilmedi, çevrime eklenmedi — kaynaklar bu değeri sayıyla vermiyor, uydurulmuyor.',

  // --- RS-485 / RS-422 (faz 10 dalga 11d) ---
  'protocol.rs485.error.emptyFrame': 'Arabellek en az 1 bayt içermeli.',
  'protocol.rs485.error.aborted': 'Çözümleme iptal edildi.',
  'protocol.rs485.warning.echoSuspected':
    "Yakalanan dizinin iki yarısı birebir aynı — half-duplex sürücü echo'su olabilir (kendi gönderdiğini geri okuma). Aynı çerçevenin bilerek iki kez gönderilmesi de bu deseni üretir, bu yüzden hata değil uyarıdır.",
  'protocol.rs485.summary.transmission': '{characters} karakter · {bitTimes} bit-süresi DE penceresi',
  'protocol.rs485.summary.echo':
    '{characters} karakter · {bitTimes} bit-süresi DE penceresi · echo şüphesi',
  'protocol.rs485.documentation.summary':
    "Yakalanan her bayt bir UART karakteri olarak hat seviyelerine açılır — Start(0) · veri bitleri LSB-first · Stop(1) — ve 8N1 varsayılır (çözümleyicinin baud/parity girdisi yoktur). Diferansiyel karşılık V_AB olarak hesaplanır: logic 1 pozitif, logic 0 negatif. RS-485 üst seviye bir protokol değildir, taşınan baytların içeriği (Modbus RTU adres/fonksiyon/CRC alanları gibi) burada yorumlanmaz — ilgili protokol sayfalarına bağlantılar kayıtta duruyor. Half-duplex sürücü echo'su, dizinin iki yarısı birebir aynıysa uyarıyla işaretlenir. Termination, bias/fail-safe, unit load ve kablo gecikmesi hesapları Zamanlama sekmesindeki hazır motorda; DE/RE zamanlaması ve turnaround ölçümü sinyal seviyesindedir, bayt akışında görünmez.",
  'protocol.rs485.example.modbusRtu.name': 'Modbus RTU çerçevesi taşıyan DE penceresi',
  'protocol.rs485.example.modbusRtu.description':
    'Spec özetinin kendi bus görünümü örneği (01 03 00 00 00 02 C4 0B). RS-485 bu baytların içeriğini yorumlamaz — alan anlamları Modbus RTU sayfasında.',
  'protocol.rs485.example.halfDuplexEcho.name': 'Half-duplex echo şüphesi',
  'protocol.rs485.example.halfDuplexEcho.description':
    'Aynı çerçeve arka arkaya iki kez: sürücünün kendi gönderdiğini geri okuması bu deseni üretir, ikinci yarı Echo alanları olarak ayrılır ve uyarı basılır.',
  'protocol.rs485.example.singleCharacter.name': 'Tek karakter (hat görünümü)',
  'protocol.rs485.example.singleCharacter.description':
    "0x41 = 'A' — spec özetinin bit görünümü örneğinin baytı: 0 10000010 1 (Start · D0..D7 LSB-first · Stop).",
  'protocol.rs422.error.emptyFrame': 'Arabellek en az 1 bayt içermeli.',
  'protocol.rs422.error.aborted': 'Çözümleme iptal edildi.',
  'protocol.rs422.summary.transmission': '{characters} karakter · {bitTimes} bit-süresi',
  'protocol.rs422.documentation.summary':
    'Yakalanan her bayt bir UART karakteri olarak hat seviyelerine açılır — Start(0) · veri bitleri LSB-first · Stop(1) — ve 8N1 varsayılır (çözümleyicinin baud/parity girdisi yoktur). Diferansiyel karşılık V_AB olarak hesaplanır: logic 1 pozitif, logic 0 negatif. RS-422 dört telli full-duplex, tek sürücü çok alıcılı bir elektriksel katmandır; taşınan baytların içeriğini yorumlamaz. Termination ve yayılım gecikmesi hesapları RS-485 adıyla yayınlanmış motorda durduğu için bu sayfaya bilerek bağlanmadı; karakter/paket süresi UART zamanlama hesaplayıcısında.',
  'protocol.rs422.example.singleCharacter.name': 'Tek karakter (hat görünümü)',
  'protocol.rs422.example.singleCharacter.description':
    "0x41 = 'A' — spec özetinin bit görünümü örneğinin baytı: 0 10000010 1 (Start · D0..D7 LSB-first · Stop).",
  'protocol.rs422.example.multiCharacter.name': 'Çok karakterli aktarım',
  'protocol.rs422.example.multiCharacter.description':
    'Dört karakter (OK + CR + LF) — temsili bir yük, spec RS-422 için somut bayt örneği vermiyor. ASCII sütununun yalnız basılabilir aralıkta dolduğunu da gösterir.',

  // --- UART / RS-232 (faz 10 dalga 11e) ---
  'protocol.uart.error.emptyFrame': 'Arabellek en az 1 bayt içermeli.',
  'protocol.uart.error.aborted': 'Çözümleme iptal edildi.',
  'protocol.uart.summary.transmission': '{characters} karakter · {bitTimes} bit-süresi',
  'protocol.uart.documentation.summary':
    "UART kendi başına bir gerilim seviyesi ya da kablo standardı değildir: aynı bit akışı CMOS, TTL, RS-232, RS-422 ya da RS-485 üzerinden taşınabilir. Yakalanan her bayt karakter hattına açılır — Start(0) · veri bitleri LSB-first · Stop(1) — ve 8N1 varsayılır (çözümleyicinin baud/parity girdisi yoktur). Yakalamanın sonundaki CR, LF ya da CRLF baytları ayrı bir Satır Sonu alanına toplanır; yükün ASCII karşılığı da çıkarılır. Parity, framing, overrun ve break hataları bit seviyesinde ya da donanım bayrağında görünür, yakalanmış baytlarda izi yoktur. Baud, bit süresi, karakter/paket süresi, oversampling ve baud hatası Zamanlama sekmesindeki hazır hesaplayıcıda.",
  'protocol.uart.example.helloCrlf.name': 'Hello + CRLF (spec canlı görünüm örneği)',
  'protocol.uart.example.helloCrlf.description':
    'Spec özetinin kendi canlı görünüm satırı: 48 65 6C 6C 6F 0D 0A — beş karakterlik yük ve ardından CRLF satır sonu.',
  'protocol.uart.example.bitView.name': 'Tek karakter 0x53 (spec bit görünümü)',
  'protocol.uart.example.bitView.description':
    "Spec özetinin bit görünümü örneği: 0x53 = 0101 0011, LSB-first aktarımla hat 0 11001010 1 olur.",
  'protocol.uart.example.binaryPayload.name': 'İkilik yük (satır sonu yok)',
  'protocol.uart.example.binaryPayload.description':
    'Basılamayan baytlar ve satır sonu içermeyen bir yakalama — Satır Sonu alanı hiç görünmez, ASCII karşılığı nokta ile dolar.',
  'protocol.rs232.error.emptyFrame': 'Arabellek en az 1 bayt içermeli.',
  'protocol.rs232.error.aborted': 'Çözümleme iptal edildi.',
  'protocol.rs232.summary.transmission': '{characters} karakter · {bitTimes} bit-süresi',
  'protocol.rs232.documentation.summary':
    "UART ile RS-232 aynı şey değildir: biri çerçeveleme, öteki elektriksel katmandır ve RS-232 katmanı UART çerçevesini değiştirmez. Yakalanan her bayt karakter hattına açılır (Start(0) · veri bitleri LSB-first · Stop(1), 8N1 varsayılır) ve yanında RS-232 mark/space karşılığı gösterilir: Mark logic 1 ve negatif hat gerilimi, Space logic 0 ve pozitif. UART boşta logic 1 olduğu için RS-232 TX hattı boştayken negatiftir. Gerçek gerilim aralığı kaynakta verilmediği için sayı üretilmez, yalnız polarite adı gösterilir. DTE/DCE, null modem, DB9 pinout ve donanım akış denetimi kablolama konularıdır, bayt akışında izi yoktur.",
  'protocol.rs232.example.specCharacter.name': "9600 8N1 · 'A' (spec örneği)",
  'protocol.rs232.example.specCharacter.description':
    'Spec özetinin kendi örneği: Data 0x41, hat 0 10000010 1, RS-232 tarafında Space/Mark dizisi olarak gösterilir.',
  'protocol.rs232.example.twoCharacters.name': 'İki karakter (Hi)',
  'protocol.rs232.example.twoCharacters.description':
    'Ardışık iki karakterin hat ve mark/space karşılığı — spec çok karakterli RS-232 örneği vermiyor, temsili.',

  // --- TTL UART / CMOS UART (faz 10 dalga 11f) ---
  'protocol.ttlUart.error.emptyFrame': 'Arabellek en az 1 bayt içermeli.',
  'protocol.ttlUart.error.aborted': 'Çözümleme iptal edildi.',
  'protocol.ttlUart.summary.transmission': '{characters} karakter · {bitTimes} bit-süresi',
  'protocol.ttlUart.documentation.summary':
    'TTL UART ayrı bir çerçeve protokolü değildir: UART verisinin TTL uyumlu logic seviyeleriyle taşınmasıdır. Bu yüzden çözümleme UART ile aynıdır — her bayt karakter hattına açılır (Start(0) · veri bitleri LSB-first · Stop(1), 8N1 varsayılır). Sayfanın asıl sorusu elektrikseldir: iki cihaz birbirini seviye çevirici olmadan sürebiliyor mu? Karar besleme gerilimiyle değil, datasheet\'teki V_OH, V_OL, V_IH ve V_IL değerleriyle verilir — Logic seviyesi uyumluluğu hesaplayıcısı bunu her iki yön için ayrı ayrı yapar.',
  'protocol.ttlUart.example.debugConsole.name': 'Debug konsolu yanıtı (OK + CRLF)',
  'protocol.ttlUart.example.debugConsole.description':
    'TTL UART\'ın en yaygın kullanımı: dört karakterlik bir konsol/modem yanıtı. Satır sonu ayrımı UART sayfasının ekidir, burada karakterler olduğu gibi görünür.',
  'protocol.ttlUart.example.singleCharacter.name': 'Tek karakter (hat görünümü)',
  'protocol.ttlUart.example.singleCharacter.description':
    "0x41 = 'A' — hattın en yalın hâli: 0 10000010 1 (Start · D0..D7 LSB-first · Stop).",
  'protocol.cmosUart.error.emptyFrame': 'Arabellek en az 1 bayt içermeli.',
  'protocol.cmosUart.error.aborted': 'Çözümleme iptal edildi.',
  'protocol.cmosUart.summary.transmission': '{characters} karakter · {bitTimes} bit-süresi',
  'protocol.cmosUart.documentation.summary':
    'CMOS UART, UART çerçevesinin CMOS besleme seviyeleriyle (1.2V, 1.8V, 2.5V, 3.3V) taşınmasıdır; çözümleme UART ile aynıdır. Ayırt edici sorun asimetridir: 1.8V bir işlemci ile 3.3V bir modül arasında bir yön çalışırken öteki çalışmayabilir, bu yüzden A→B ve B→A ayrı ayrı değerlendirilmelidir. Logic seviyesi uyumluluğu hesaplayıcısı iki yönü de datasheet eşiklerinden hesaplar ve gürültü paylarını verir.',
  'protocol.cmosUart.example.debugConsole.name': 'Modül yanıtı (OK + CRLF)',
  'protocol.cmosUart.example.debugConsole.description':
    'SoC ile çevre birim arasındaki tipik dört karakterlik yanıt. Seviye uyumu bayt akışında görünmez; Logic seviyesi uyumluluğu hesaplayıcısında değerlendirilir.',
  'protocol.cmosUart.example.singleCharacter.name': 'Tek karakter (hat görünümü)',
  'protocol.cmosUart.example.singleCharacter.description':
    "0x41 = 'A' — hattın en yalın hâli: 0 10000010 1 (Start · D0..D7 LSB-first · Stop).",

  // --- RTP / RTCP (faz 10 dalga 12g) ---
  'protocol.rtp.error.headerTruncated': 'Çerçeve 12 baytlık sabit başlık kadar bile uzun değil.',
  'protocol.rtp.error.csrcTruncated':
    'CSRC Count’un bildirdiği katkı kaynağı listesi tamponda eksik.',
  'protocol.rtp.error.extensionTruncated':
    'Header Extension’ın bildirdiği uzunluk tamponda eksik.',
  'protocol.rtp.error.paddingInvalid':
    'Son bayttaki dolgu sayısı (kendisi dâhil) sıfır ya da kalan alandan büyük.',
  'protocol.rtp.error.frameTooLong': 'Çerçeve izin verilen azami uzunluğu aşıyor.',
  'protocol.rtp.error.aborted': 'Çözümleme iptal edildi.',
  'protocol.rtp.warning.versionUnexpected':
    'Version alanı 2 değil; RTP her zaman versiyon 2 kullanır.',
  'protocol.rtp.warning.payloadTypeUnresolved':
    'Payload Type sabit tabloda yok; codec ancak SDP/profil bilgisiyle çözülür, burada tahmin edilmedi.',
  'protocol.rtp.documentation.summary':
    'RTP (RFC 3550), gerçek zamanlı ses/video/simülasyon verisini payload-type kimliği, sıra numarası, zaman damgası ve SSRC ile taşır. Genellikle UDP üzerinde çalışır ama bu sayfa tek bir RTP paketini çözer — UDP sarmalayıcısı ayrı bir sayfadır.',
  'protocol.rtp.example.basicAudio.name': 'Temel ses akışı (PCMU)',
  'protocol.rtp.example.basicAudio.description':
    'CC=0, X=0, P=0, Payload Type 0 (PCMU) — RFC 3551 sabit tablosundan bilinen bir codec.',
  'protocol.rtp.example.videoMarkerCsrc.name': 'Video, Marker ve iki CSRC (mixer)',
  'protocol.rtp.example.videoMarkerCsrc.description':
    'Marker biti kare sonunu işaretler, iki katkı kaynağı bir mixer senaryosunu gösterir; Payload Type 96 dinamik olduğu için codec adı ÇÖZÜLMEZ.',
  'protocol.rtp.example.extensionAndPadding.name': 'Header Extension ve dolgu',
  'protocol.rtp.example.extensionAndPadding.description':
    'RFC 8285 profil imzası (0xBEDE) taşıyan bir header extension ile birlikte, son baytı kendini de sayan 3 baytlık dolgu.',
  'protocol.rtp.example.invalidPaddingCount.name': 'Geçersiz dolgu sayısı',
  'protocol.rtp.example.invalidPaddingCount.description':
    'Padding biti set ama son bayt kalan alandan büyük bir dolgu sayısı bildiriyor — RFC 3550 §5.1 ihlali.',

  'protocol.rtcp.error.headerTruncated': 'Çerçeve 4 baytlık ortak başlık kadar bile uzun değil.',
  'protocol.rtcp.error.lengthTruncated':
    'Alt paketin Length alanı tamponun dışına taşıyor; bir sonraki alt paketin nerede başladığı bilinemiyor.',
  'protocol.rtcp.error.bodyTruncated':
    'Alt paketin gövdesi (rapor bloğu/chunk/kaynak listesi) Length alanının sınırladığı alana sığmıyor.',
  'protocol.rtcp.error.paddingInvalid':
    'Son bayttaki dolgu sayısı (kendisi dâhil) sıfır ya da kalan alandan büyük.',
  'protocol.rtcp.error.frameTooLong': 'Çerçeve izin verilen azami uzunluğu aşıyor.',
  'protocol.rtcp.error.aborted': 'Çözümleme iptal edildi.',
  'protocol.rtcp.warning.versionUnexpected':
    'Version alanı 2 değil; RTCP her zaman versiyon 2 kullanır.',
  'protocol.rtcp.warning.unknownPacketType':
    'Packet Type, RFC 3550’nin beş temel türünde (SR/RR/SDES/BYE/APP) yok; gövde ham gösterildi.',
  'protocol.rtcp.warning.compoundMustStartWithReport':
    'Compound RTCP paketi SR ya da RR ile başlamalıdır (RFC 3550 §6.1); bu paket öyle başlamıyor.',
  'protocol.rtcp.warning.paddingNotLast':
    'Padding biti compound paketin son alt paketi OLMAYAN bir pakette set; RFC 3550 §6.1 dolguyu yalnız son pakette geçerli sayar.',
  'protocol.rtcp.documentation.summary':
    'RTCP (RFC 3550), bir RTP oturumunun teslim kalitesini ve katılımcı bilgisini raporlayan kontrol kanalıdır. Girdi tek bir mesaj değil, en az SR ya da RR ile başlayan compound bir paket dizisidir; her alt paket kendi Length alanıyla çerçevelenir.',
  'protocol.rtcp.example.srWithOneReportBlock.name': 'Sender Report + tek rapor bloğu',
  'protocol.rtcp.example.srWithOneReportBlock.description':
    'SSRC, NTP/RTP zaman damgaları, gönderici sayaçları ve tek bir alıcı rapor bloğu (Fraction Lost, Cumulative Lost, Jitter, LSR, DLSR).',
  'protocol.rtcp.example.compoundRrSdes.name': 'Compound: RR + SDES',
  'protocol.rtcp.example.compoundRrSdes.description':
    'RFC 3550 §6.1’in istediği asgari compound biçimi — Receiver Report’un ardından tek bir CNAME item’ı taşıyan SDES paketi.',
  'protocol.rtcp.example.byeWithReason.name': 'BYE, sebep metniyle',
  'protocol.rtcp.example.byeWithReason.description':
    'Oturumdan ayrılan SSRC ile birlikte kısa bir "bye" sebep metni.',
  'protocol.rtcp.example.unknownPacketType.name': 'Tanınmayan Packet Type',
  'protocol.rtcp.example.unknownPacketType.description':
    'Packet Type 210 — RFC 3550’nin beş temel türünde yok; gövde ham gösterilip uyarı basılır, çerçeve yine geçerli sayılır.',
  'protocol.rtcp.example.lengthExceedsBuffer.name': 'Length tampon dışına taşıyor',
  'protocol.rtcp.example.lengthExceedsBuffer.description':
    'RR paketi 24 bayt olduğunu iddia ediyor ama tamponda yalnız 8 bayt var — bir sonraki alt paketin başlangıcı bilinemediği için FATAL hata.',

  // --- TFTP / FTP / Telnet (faz 10 dalga 12h) ---
  'protocol.tftp.error.headerTruncated': 'Çerçeve 2 baytlık Opcode kadar bile uzun değil.',
  'protocol.tftp.error.unsupportedOpcode':
    'Opcode, RFC 1350/2347’nin tanıdığı 1-6 aralığında değil.',
  'protocol.tftp.error.stringUnterminated':
    'NUL ile sonlanması gereken bir alan (Filename/Mode/Option/Error Message) tamponda sonlanmadan bitiyor.',
  'protocol.tftp.error.frameTooLong': 'Çerçeve izin verilen azami uzunluğu aşıyor.',
  'protocol.tftp.error.aborted': 'Çözümleme iptal edildi.',
  'protocol.tftp.warning.unsupportedMode': 'Mode netascii/octet/mail kümesinde değil.',
  'protocol.tftp.warning.unknownErrorCode':
    'Error Code, RFC 1350 §5’in tanımladığı 0-7 aralığında değil.',
  'protocol.tftp.warning.blockSizeAssumed':
    'Final Block kararı klasik 512 baytlık varsayılan block size’a dayanır; OACK farklı bir boyut pazarlık etmiş olabilir.',
  'protocol.tftp.documentation.summary':
    'TFTP (RFC 1350), UDP üzerinde her veri bloğunun ayrı ACK ile onaylandığı basit bir dosya aktarım protokolüdür. Bu sayfa tek bir TFTP paketini (RRQ/WRQ/DATA/ACK/ERROR/OACK) çözer.',
  'protocol.tftp.example.readRequest.name': 'Read Request (RRQ)',
  'protocol.tftp.example.readRequest.description':
    '"firmware.bin" dosyasını octet modunda isteyen, seçenek pazarlığı olmayan klasik RRQ.',
  'protocol.tftp.example.readRequestWithOptions.name': 'RRQ + blksize seçeneği',
  'protocol.tftp.example.readRequestWithOptions.description':
    'RFC 2347/2348 option extension’ıyla 1024 baytlık block size pazarlığı isteyen RRQ.',
  'protocol.tftp.example.dataContinue.name': 'DATA — 512 baytlık tam blok',
  'protocol.tftp.example.dataContinue.description':
    'Blok 1, tam 512 bayt — klasik varsayılan block size’a göre "Continue" (uyarılı, çünkü OACK farklı olabilir).',
  'protocol.tftp.example.dataFinalBlock.name': 'DATA — kısa (son) blok',
  'protocol.tftp.example.dataFinalBlock.description':
    'Blok 2, yalnız 3 bayt — her block size’da transferin bittiğini gösteren kesin işaret.',
  'protocol.tftp.example.ack.name': 'ACK',
  'protocol.tftp.example.ack.description': 'Blok 1’i onaylayan basit ACK paketi.',
  'protocol.tftp.example.errorFileNotFound.name': 'ERROR — File not found',
  'protocol.tftp.example.errorFileNotFound.description':
    'RFC 1350 §5’in 1 numaralı hata kodu, açıklayıcı bir mesajla birlikte.',

  'protocol.ftp.error.emptyFrame': 'Arabellek boş; en az 1 bayt gerekir.',
  'protocol.ftp.error.frameTooLong': 'Çerçeve izin verilen azami uzunluğu aşıyor.',
  'protocol.ftp.error.aborted': 'Çözümleme iptal edildi.',
  'protocol.ftp.documentation.summary':
    'FTP (RFC 959) TCP üzerinde satır tabanlı bir kontrol bağlantısıdır. Bu sayfa kontrol mesajlarını (komut/yanıt) çözer — yapıştırılan tüm oturum, CRLF ile ayrılan her satır kendi başına sınıflandırılarak işlenir; veri bağlantısının taşıdığı dosyanın kendisi çözülmez.',
  'protocol.ftp.example.loginAndRetrieve.name': 'Giriş + dosya indirme oturumu',
  'protocol.ftp.example.loginAndRetrieve.description':
    'Karşılama, USER/PASS, PASV, RETR ve transfer tamamlanışını içeren uçtan uca bir kontrol oturumu dilimi. PASS’ın argümanı varsayılan görünümde redakte edilir.',
  'protocol.ftp.example.multilineResponse.name': 'Çok satırlı yanıt',
  'protocol.ftp.example.multilineResponse.description':
    'RFC 959 §4.2’nin çok satırlı yanıt biçimi: ara satırlar "-" ile sürer, son satır boşlukla kapanır.',
  'protocol.ftp.example.unclassifiedLine.name': 'Sınıflandırılamayan satır',
  'protocol.ftp.example.unclassifiedLine.description':
    'Ne 3 haneli yanıt koduna ne fiil dizisine uyan bir satır — ham gösterilir, uyarı basılmaz.',

  'protocol.telnet.error.emptyFrame': 'Arabellek boş; en az 1 bayt gerekir.',
  'protocol.telnet.error.trailingIac':
    'Çerçeve tek bir IAC (0xFF) ile bitiyor; ardından komut baytı yok.',
  'protocol.telnet.error.negotiationTruncated':
    'WILL/WONT/DO/DONT ya da SB, option baytı gelmeden tamponun sonuna geliyor.',
  'protocol.telnet.error.subnegotiationUnterminated':
    'IAC SB açıldı ama kapatan IAC SE tamponda hiç bulunamadı.',
  'protocol.telnet.error.unknownCommand':
    'IAC sonrası bayt RFC 854’ün 240-255 komut kümesinde değil.',
  'protocol.telnet.error.frameTooLong': 'Çerçeve izin verilen azami uzunluğu aşıyor.',
  'protocol.telnet.error.aborted': 'Çözümleme iptal edildi.',
  'protocol.telnet.warning.plaintextProtocol':
    'Telnet temel protokolü şifreleme sağlamaz; yakalamada kullanıcı adı/şifre gibi bilgiler açık metin görünebilir.',
  'protocol.telnet.documentation.summary':
    'Telnet (RFC 854) düz metin terminal trafiğini IAC (0xFF) ile başlayan option negotiation komutlarıyla aynı TCP akışında taşır. Bu sayfa yapıştırılan tüm akışı tek geçişte metin koşuları ve IAC dizileri olarak sıralar; WILL/WONT/DO/DONT çiftlerinin çapraz yorumu (ör. "istek kabul edildi") yapılmaz, her komut kendi RFC 854 anlamıyla gösterilir.',
  'protocol.telnet.example.echoNegotiation.name': 'ECHO negotiation + bilgi istemi',
  'protocol.telnet.example.echoNegotiation.description':
    'Sunucunun ECHO’yu etkinleştirmesini isteyen IAC DO ECHO, ardından düz metin bir bilgi istemi.',
  'protocol.telnet.example.terminalTypeSubnegotiation.name': 'Terminal Type subnegotiation',
  'protocol.telnet.example.terminalTypeSubnegotiation.description':
    'IAC WILL TERMINAL-TYPE ardından IAC SB … IAC SE arasında taşınan "VT100" değeri.',
  'protocol.telnet.example.escapedLiteralFf.name': 'Kaçışlı literal 0xFF',
  'protocol.telnet.example.escapedLiteralFf.description':
    'Düz metin içinde IAC IAC ile kaçışlanmış ham bir 0xFF baytı — byte-transparency örneği.',
  'protocol.telnet.example.unterminatedSubnegotiation.name': 'Kapatılmamış subnegotiation',
  'protocol.telnet.example.unterminatedSubnegotiation.description':
    'IAC SB açılıyor ama IAC SE hiç gelmiyor — kesilmiş bir yakalamayı gösterir.',

  // --- CIP ---
  'protocol.cip.error.frameTooShort':
    'Kayıt en az Service ve Path Size baytlarını taşıyacak kadar uzun değil.',
  'protocol.cip.error.frameTooLong': 'Kayıt izin verilen azami uzunluğu aşıyor.',
  'protocol.cip.error.aborted': 'Çözümleme iptal edildi.',
  'protocol.cip.error.messageEmpty': 'Mesaj gövdesi boş.',
  'protocol.cip.error.requestHeaderTruncated':
    'İstek başlığı (Service + Path Size) için yeterli bayt yok.',
  'protocol.cip.error.responseHeaderTruncated':
    'Yanıt başlığı (Reply Service + Reserved + General Status + Additional Status Size) için yeterli bayt yok.',
  'protocol.cip.warning.unknownService':
    'Servis kodu ortak servis tablosunda yok — sınıfa özel ya da vendor-specific olabilir, ad atanmadı.',
  'protocol.cip.warning.reservedByteNonzero': 'Reserved bayt sıfır değil.',
  'protocol.cip.warning.unknownGeneralStatus':
    'General Status kodu tanınan tabloda yok, ham gösteriliyor.',
  'protocol.cip.warning.pathTruncated':
    'Bildirilen Path Size kayıtta yok; elde olan baytlarla sınırlı çözüldü.',
  'protocol.cip.warning.extendedPathNotDecoded':
    'Port/Network/Symbolic/Data segmenti ya da Electronic Key/Service ID alt tipi: kendi format kuralları bu motorda çözülmüyor, kalan path ham gösterildi.',
  'protocol.cip.warning.additionalStatusTruncated':
    'Additional Status Size’ın vaat ettiği bayt sayısı kayıtta yok; elde olan kısım gösterildi.',
  'protocol.cip.summary.request': 'CIP isteği',
  'protocol.cip.summary.response': 'CIP yanıtı',
  'protocol.cip.documentation.summary':
    'Media-independent CIP Message Router isteği/yanıtı: Service/Reply Service, EPATH (Class/Instance/Member/Connection Point/Attribute) ve General Status çözülür. EtherNet/IP ve DeviceNet AYNI motoru kendi taşıyıcı zarflarının içinden tüketir.',
  'protocol.cip.example.getAttributeSingleRequest8Bit.name': 'Get_Attribute_Single isteği (8-bit path)',
  'protocol.cip.example.getAttributeSingleRequest8Bit.description':
    'Class 1 (Identity)/Instance 1/Attribute 1 — üç segment de 8-bit, pad baytı yok.',
  'protocol.cip.example.getAttributeAllRequest16BitClass.name': 'Get_Attribute_All isteği (16-bit Class)',
  'protocol.cip.example.getAttributeAllRequest16BitClass.description':
    '16-bit Class segmentinde segment baytından sonra bir PAD baytı gelir; atlanmazsa Instance segmenti bir bayt kayar.',
  'protocol.cip.example.getAttributeSingleResponseSuccess.name': 'Başarılı yanıt (Vendor ID)',
  'protocol.cip.example.getAttributeSingleResponseSuccess.description':
    'Reply Service = 0x8E (0x0E | 0x80), General Status = Success, Response Data = Vendor ID 1.',
  'protocol.cip.example.responsePathDestinationUnknown.name': 'Hata yanıtı (Path destination unknown)',
  'protocol.cip.example.responsePathDestinationUnknown.description':
    'General Status = 0x05: yol geçerli bir sınıf/instance/üyeye işaret etmiyor.',
  'protocol.cip.example.requestConnectionPointSegment.name': 'Connection Point segmenti',
  'protocol.cip.example.requestConnectionPointSegment.description':
    'EPATH’in dördüncü lojik alt tipi: Class 4 (Assembly) + Connection Point 0x65.',
  'protocol.cip.example.requestUnknownServiceCode.name': 'Adlandırılmamış servis kodu',
  'protocol.cip.example.requestUnknownServiceCode.description':
    '0x4B ortak servis tablosunda yok ama 0x00-0x7F aralığında — yapısal olarak geçerli, yalnız adsız.',
  'protocol.cip.example.requestPathTruncated.name': 'Kesik path',
  'protocol.cip.example.requestPathTruncated.description':
    'Path Size 3 word (6 bayt) vaat ediyor ama yalnız 4 bayt path verisi var.',

  // --- EtherNet/IP ---
  'protocol.ethernetip.error.headerTruncated':
    'Kayıt 24 baytlık encapsulation başlığını taşıyacak kadar uzun değil.',
  'protocol.ethernetip.error.frameTooLong': 'Kayıt izin verilen azami uzunluğu aşıyor.',
  'protocol.ethernetip.error.aborted': 'Çözümleme iptal edildi.',
  'protocol.ethernetip.error.cpfHeaderTruncated': 'CPF Item Count alanı için yeterli bayt yok.',
  'protocol.ethernetip.error.cpfItemTruncated':
    'CPF item’ının bildirilen uzunluğu kalan bayt sayısını aşıyor.',
  'protocol.ethernetip.warning.unknownCommand':
    'Komut kodu bilinen sekiz encapsulation komutundan biri değil.',
  'protocol.ethernetip.warning.unknownStatus': 'Status kodu tanınan tabloda yok, ham gösteriliyor.',
  'protocol.ethernetip.warning.lengthMismatch':
    'Length alanı gerçek gövde uzunluğuyla uyuşmuyor.',
  'protocol.ethernetip.warning.unhandledCommandData':
    'Bu komutun command-specific gövdesi bu motorda alan alan çözülmüyor, ham gösterildi.',
  'protocol.ethernetip.summary.known': 'EtherNet/IP encapsulation mesajı',
  'protocol.ethernetip.summary.unknown': 'Tanınmayan EtherNet/IP komutu',
  'protocol.ethernetip.documentation.summary':
    'Encapsulation başlığı (Command/Length/Session Handle/Status/Sender Context/Options) ve Common Packet Format çözülür. SendRRData/SendUnitData’nın Connected/Unconnected Data Item’larındaki CIP mesajı `cip` motoruyla PAYLAŞILARAK tam çözülür.',
  'protocol.ethernetip.example.registerSessionRequest.name': 'Register Session isteği',
  'protocol.ethernetip.example.registerSessionRequest.description':
    'Protocol Version = 1, Options Flags = 0 — oturum açmadan önceki ilk mesaj.',
  'protocol.ethernetip.example.registerSessionResponse.name': 'Register Session yanıtı',
  'protocol.ethernetip.example.registerSessionResponse.description':
    'Sunucunun döndürdüğü Session Handle, sonraki tüm mesajlarda taşınır.',
  'protocol.ethernetip.example.sendRrDataGetAttributeSingle.name': 'SendRRData — Get_Attribute_Single',
  'protocol.ethernetip.example.sendRrDataGetAttributeSingle.description':
    'CPF: Null Address Item + Unconnected Data Item. Data Item’ın içindeki CIP isteği `cip` motoruyla çözülür.',
  'protocol.ethernetip.example.sendUnitDataConnectedResponse.name': 'SendUnitData — bağlı yanıt',
  'protocol.ethernetip.example.sendUnitDataConnectedResponse.description':
    'Connected Address Item (Connection ID) + Connected Data Item. CIP mesajından önce 2 baytlık Sequence Count ayrılır.',
  'protocol.ethernetip.example.unregisterSession.name': 'UnRegister Session',
  'protocol.ethernetip.example.unregisterSession.description':
    'Command-specific veri taşımaz; oturumu kapatma isteği.',
  'protocol.ethernetip.example.sendRrDataCpfItemTruncated.name': 'Kesik CPF item’ı',
  'protocol.ethernetip.example.sendRrDataCpfItemTruncated.description':
    'Unconnected Data Item 6 bayt vaat ediyor ama yalnız 2 bayt veri var — hata basılır.',

  // --- DeviceNet ---
  'protocol.devicenet.error.frameTooShort':
    'Kayıt CAN kimliği ve uzunluk alanlarını taşıyacak kadar uzun değil.',
  'protocol.devicenet.error.frameTooLong': 'Kayıt sabit çerçeve boyunu aşıyor.',
  'protocol.devicenet.error.aborted': 'Çözümleme iptal edildi.',
  'protocol.devicenet.error.extendedNotSupported':
    'DeviceNet’in Predefined Master/Slave Connection Set’i yalnız base (11-bit) identifier tanımlar; bu çerçeve extended.',
  'protocol.devicenet.warning.truncatedPayload':
    'Bildirilen veri uzunluğu kayıtta yok; elde olan baytlar gösterildi.',
  'protocol.devicenet.summary.group1': 'Group 1 mesajı (I/O ağırlıklı)',
  'protocol.devicenet.summary.group2': 'Group 2 mesajı',
  'protocol.devicenet.summary.group3Or4': 'Group 3/4 mesajı (sınır adlandırılmadı)',
  'protocol.devicenet.summary.extendedRejected': 'Extended identifier — reddedildi',
  'protocol.devicenet.documentation.summary':
    'CAN identifier’ı Message Group’a (1/2/3-4) böler, gruba göre FARKLI genişlikte Message ID/MAC ID alanları çözer — CAN veri-bağı motoru automotive/can’den PAYLAŞILIR. Payload varsayılan olarak ham gösterilir; `payloadInterpretation` seçeneği CIP explicit mesajı olarak `cip` motoruna devretmeyi sağlar.',
  'protocol.devicenet.option.payloadInterpretation': 'Payload Yorumu',
  'protocol.devicenet.option.payloadInterpretation.description':
    'Grup/Message ID’den tek başına çıkarılamaz: payload I/O verisi mi yoksa CIP Explicit Message mi, kullanıcı sistem bağlamından bilir.',
  'protocol.devicenet.option.payloadInterpretation.raw': 'Ham veri',
  'protocol.devicenet.option.payloadInterpretation.cipExplicit': 'CIP Explicit Message',
  'protocol.devicenet.example.group1PollResponseNode5.name': 'Group 1 — Message ID 5, MAC ID 5',
  'protocol.devicenet.example.group1PollResponseNode5.description':
    'CAN ID 0x145 = (Message ID 5 << 6) | MAC ID 5 — Group 1’in 4-bit Message ID alanı.',
  'protocol.devicenet.example.group2MessageNode10.name': 'Group 2 — Message ID 3, MAC ID 10',
  'protocol.devicenet.example.group2MessageNode10.description':
    'CAN ID 0x4CA — Group 2’nin 3-bit Message ID alanı (Group 1’den FARKLI genişlik).',
  'protocol.devicenet.example.group3Or4Unnamed.name': 'Group 3/4 — adlandırılmamış üst bölge',
  'protocol.devicenet.example.group3Or4Unnamed.description':
    'CAN ID 0x6C1: Group 3 ile Group 4’ün kesin sınırı bu motorda adlandırılmadı, ham sayı gösterilir.',
  'protocol.devicenet.example.explicitMessageGetAttributeSingle.name': 'Explicit message payload’ı',
  'protocol.devicenet.example.explicitMessageGetAttributeSingle.description':
    'Payload ham bir Get_Attribute_Single isteği taşır; `payloadInterpretation=cip-explicit` seçilince `cip` motoruyla çözülür.',
  'protocol.devicenet.example.extendedIdentifierRejected.name': 'Extended identifier reddedildi',
  'protocol.devicenet.example.extendedIdentifierRejected.description':
    'Predefined Master/Slave Connection Set yalnız base identifier tanımlar; extended çerçeve hata basar.',

  // --- XCP on CAN ---
  'protocol.xcp.documentation.summary':
    'XCP CTO (Command Transfer Object) PID baytını çözer: komut adı (CONNECT/GET_STATUS/SET_MTA/UPLOAD/DOWNLOAD/…) ya da yanıt sınıfı (RES/ERR/EV/SERV); CONNECT, SET_MTA ve GET_STATUS alan alan çözülür. Komut/yanıt tabloları ve hata/olay kodları iki bağımsız açık kaynak XCP implementasyonuyla (Scapy, pyxcp) bayt bayt çapraz doğrulandı.',
  'protocol.xcp.option.role': 'Rol',
  'protocol.xcp.option.role.description':
    'Bu CAN çerçevesinin master→slave komut mu yoksa slave→master yanıt mı taşıdığı — aynı PID baytı ikisinde FARKLI anlama gelir (0xFF komutta CONNECT, yanıtta RES). Bu GERÇEKTEN çerçeveden çıkarılamaz; hangi konfigüre edilmiş CAN kimliğinden geldiğine bağlıdır.',
  'protocol.xcp.option.role.command': 'Komut (master → slave)',
  'protocol.xcp.option.role.response': 'Yanıt (slave → master)',
  'protocol.xcp.option.byteOrder': 'Bayt sırası',
  'protocol.xcp.option.byteOrder.description':
    'Çok baytlı alanlar (adresler, Max DTO, Session Configuration ID) CONNECT anında müzakere edilir ve tek, durumsuz bir çerçeveden geri alınamaz. Oturumunuzun müzakere ettiği bayt sırasını seçin.',
  'protocol.xcp.option.byteOrder.little': 'Little-endian (Intel)',
  'protocol.xcp.option.byteOrder.big': 'Big-endian (Motorola)',
  'protocol.xcp.error.frameTooShort': 'Çerçeve 8 baytlık SocketCAN başlığından kısa.',
  'protocol.xcp.error.frameTooLong': 'Çerçeve klasik CAN çerçeve uzunluğunu aşıyor.',
  'protocol.xcp.error.canFdNotSupported':
    'Bu çerçeve CAN FD uzunluğunda (72 bayt). CAN FD bu motorda henüz desteklenmiyor — yalnız klasik CAN çözülüyor.',
  'protocol.xcp.error.aborted': 'Çözümleme iptal edildi.',
  'protocol.xcp.error.emptyPayload': 'CAN payload’ı boş — bir XCP paketi en az bir PID baytı gerektirir.',
  'protocol.xcp.warning.daqData':
    'Bu PID, DAQ/STIM veri aralığına düşüyor — içeriği bu çözücünün sahip olmadığı bir DAQ list konfigürasyonuna bağlıdır, ham gösterilir.',
  'protocol.xcp.warning.unassignedCommand':
    'Bu PID, bu motor için çapraz doğrulanan komut tablosunda tanımlı değil (0xC0-0xC6 boşluğu).',
  'protocol.xcp.warning.commandParametersRaw':
    'Bu komutun parametreleri bu motor tarafından alan alan çözülmüyor; ham gösterilir.',
  'protocol.xcp.warning.responseBodyRaw':
    'Pozitif yanıt gövdesi hangi komuta karşılık geldiğine bağlıdır, tek durumsuz çerçeve bunu bilemez; ham gösterilir.',
  'protocol.xcp.warning.eventBodyRaw': 'Olay kodunun ötesindeki olay gövdesi çözülmüyor; ham gösterilir.',
  'protocol.xcp.warning.serviceBodyRaw':
    'Servis isteği adı yalnız tek kaynakta teyitli olduğu için adlandırılmadı; kod ve mesaj ham gösterilir.',
  'protocol.xcp.summary.command': 'XCP komut çerçevesi',
  'protocol.xcp.summary.response': 'XCP yanıt çerçevesi',
  'protocol.xcp.example.connectCommandNormal.name': 'CONNECT (normal kip)',
  'protocol.xcp.example.connectCommandNormal.description':
    'PID 0xFF = CONNECT, connection_mode 0x00 = NORMAL — her XCP oturumunun ilk komutu.',
  'protocol.xcp.example.connectPositiveResponse.name': 'CONNECT pozitif yanıtı',
  'protocol.xcp.example.connectPositiveResponse.description':
    'Yanıt tarafında PID 0xFF = RES. Komut CONNECT yerine resource/comm-mode/Max CTO/Max DTO/sürüm alanlarıyla çözülmesi için role=response seçin.',
  'protocol.xcp.example.getStatusCommand.name': 'GET_STATUS',
  'protocol.xcp.example.getStatusCommand.description': 'PID 0xFD = GET_STATUS, parametresiz.',
  'protocol.xcp.example.setMtaCommand.name': 'SET_MTA',
  'protocol.xcp.example.setMtaCommand.description':
    'PID 0xF6 = SET_MTA. Reserved baytlar, adres uzantısı ve little-endian 4 baytlık adres — aynı baytların byteOrder=big-endian ile FARKLI bir adrese çözüldüğünü görmek için role=command ile deneyin.',
  'protocol.xcp.example.errorResponseCmdUnknown.name': 'ERR — ERR_CMD_UNKNOWN',
  'protocol.xcp.example.errorResponseCmdUnknown.description':
    'Yanıt tarafında (role=response seçin) PID 0xFE = ERR, error_code 0x20 = ERR_CMD_UNKNOWN.',
  'protocol.xcp.example.stimDaqData.name': 'STIM/DAQ verisi (çözülmez)',
  'protocol.xcp.example.stimDaqData.description':
    'PID 0x00 STIM aralığına düşer — anlamı bu motorun sahip olmadığı bir DAQ list konfigürasyonuna bağlıdır, ham gösterilir.',

  // --- XCP on Ethernet ---
  'protocol.xcpEth.documentation.summary':
    'XCP-on-Ethernet taşıma birimini çözer (4 baytlık taşıma başlığı + XCP CTO/DTO paketi). XCP paketinin kendisi XCP on CAN ile AYNI motorla çözülür (komut/yanıt tabloları, hata/olay kodları). Taşıma başlığının Length ve Counter alanları yalnız ham bayt olarak gösterilir: iki bağımsız açık kaynak implementasyon (Scapy, pyxcp) bayt sırasında çelişiyor.',
  'protocol.xcpEth.error.frameTooShort': 'Çerçeve 4 baytlık XCP taşıma başlığından kısa.',
  'protocol.xcpEth.error.frameTooLong': 'Çerçeve yapılandırılmış azami uzunluğu aşıyor.',
  'protocol.xcpEth.error.aborted': 'Çözümleme iptal edildi.',
  'protocol.xcpEth.error.emptyPacket':
    'Yalnız taşıma başlığı var — bir XCP paketi en az bir PID baytı gerektirir.',
  'protocol.xcpEth.warning.headerByteOrderUnresolved':
    'Scapy (contrib/automotive/xcp) bu başlığı big-endian kodluyor, pyxcp (transport/eth.py) little-endian kodluyor — iki bağımsız kaynak çelişiyor, bu yüzden sayısal bir değer İDDİA EDİLMİYOR; yalnız ham baytlar gösterilir.',
  'protocol.xcpEth.summary.command': 'XCP-on-Ethernet komut çerçevesi',
  'protocol.xcpEth.summary.response': 'XCP-on-Ethernet yanıt çerçevesi',
  'protocol.xcpEth.example.connectCommandNormal.name': 'CONNECT (normal kip)',
  'protocol.xcpEth.example.connectCommandNormal.description':
    'Nötr başlık baytları + PID 0xFF = CONNECT, connection_mode 0x00 = NORMAL — CAN örneğiyle AYNI XCP paketi.',
  'protocol.xcpEth.example.connectPositiveResponse.name': 'CONNECT pozitif yanıtı',
  'protocol.xcpEth.example.connectPositiveResponse.description':
    'Yanıt tarafında PID 0xFF = RES. resource/comm-mode/Max CTO/Max DTO/sürüm alanlarıyla çözülmesi için role=response seçin.',
  'protocol.xcpEth.example.getStatusCommand.name': 'GET_STATUS',
  'protocol.xcpEth.example.getStatusCommand.description': 'PID 0xFD = GET_STATUS, parametresiz.',
  'protocol.xcpEth.example.setMtaCommand.name': 'SET_MTA',
  'protocol.xcpEth.example.setMtaCommand.description':
    'PID 0xF6 = SET_MTA. Aynı baytların byteOrder=big-endian ile FARKLI bir adrese çözüldüğünü görmek için deneyin.',
  'protocol.xcpEth.example.errorResponseCmdUnknown.name': 'ERR — ERR_CMD_UNKNOWN',
  'protocol.xcpEth.example.errorResponseCmdUnknown.description':
    'Yanıt tarafında (role=response seçin) PID 0xFE = ERR, error_code 0x20 = ERR_CMD_UNKNOWN.',
  'protocol.xcpEth.example.emptyPacketHeaderOnly.name': 'Yalnız başlık (XCP paketi yok)',
  'protocol.xcpEth.example.emptyPacketHeaderOnly.description':
    'Yalnız 4 baytlık taşıma başlığı var — çözülecek bir PID baytı yok, çerçeve geçersiz bildirilir.',

  // --- SOME/IP + SOME/IP-SD ---
  'protocol.someip.documentation.summary':
    'Tek bir SOME/IP mesajını çözer: Message ID (Service ID | Method ID), Length, Request ID (Client ID | Session ID), sürümler, Message Type ve Return Code. Message ID 0xFFFF8100 ise mesaj SOME/IP-SD olarak açılır; girdiler ve opsiyonlar (IPv4/IPv6 uç nokta, yük dengeleme, konfigürasyon dizeleri) alan alan çözülür. Girdi MAC/IP/UDP/TCP çerçevesi DEĞİL, tek bir SOME/IP mesajıdır — alt katmanları kendi sayfalarında çözün. Length alanı offset 8’den (Request ID) mesajın sonuna sayar, yani toplam mesaj 8 + Length’tir; bu taban AUTOSAR FO R23-11 (PRS_SOMEIP_00042), Wireshark ve Scapy ile çapraz doğrulandı. Payload HAM kalır: yapısı telden çıkmaz, servis arayüzü tanımından gelir.',
  'protocol.someip.error.aborted': 'Çözümleme iptal edildi.',
  'protocol.someip.error.headerTooShort':
    'Çerçeve 16 baytlık SOME/IP başlığından kısa — Length okunamıyor, mesaj sınırı bilinmiyor.',
  'protocol.someip.error.frameTooLong': 'Çerçeve yapılandırılmış azami uzunluğu aşıyor.',
  'protocol.someip.error.lengthTooSmall':
    'Length alanı 8’den küçük: yapısal olarak imkânsız, çünkü Length en az Request ID + iki sürüm + Message Type + Return Code’u (8 bayt) saymak zorundadır. Sabit ofsetli başlık alanları yine gösteriliyor ama mesaj sınırı kurulamadı.',
  'protocol.someip.error.tpLengthTooSmall':
    'Message Type TP bayrağını (0x20) taşıyor ama Length 4 baytlık TP başlığını kapsamıyor — TP alanları çözülmedi.',
  'protocol.someip.error.messageIncomplete':
    'Length’in vaat ettiği mesaj tamponda tamamlanmıyor. Bu bir akış (TCP) parçasıdır: bu motor segment BİRLEŞTİRMEZ, daha çok veri gerekiyor.',
  'protocol.someip.warning.payloadNeedsServiceDefinition':
    'Payload ham gösteriliyor: SOME/IP payload’ının alan yapısı telden çıkmaz, servis arayüzü tanımından (ARXML / servis tanımı) gelir. Bu araç tahmine dayalı bir alan kırılımı üretmez.',
  'protocol.someip.warning.trailingBytes':
    'Mesaj sınırından sonra bayt var — TCP’de yapışmış bir sonraki mesaj olabilir. Yalnız ilk mesaj çözüldü; consumedBytes bu sınırı bildiriyor.',
  'protocol.someip.warning.unknownMessageType':
    'Message Type AUTOSAR FO R23-11 Tablo 4.4’te yok. ACK varyantlarını (0x40 biti) Scapy ve Wireshark tanıyor ama AUTOSAR tablosunda yer almıyorlar — iki kaynak örtüşmediği için değer ADLANDIRILMADI.',
  'protocol.someip.warning.unknownReturnCode':
    'Return Code AUTOSAR FO R23-11 Tablo 4.11’de ne adlandırılmış ne de ayrılmış bir aralıkta.',
  'protocol.someip.warning.reservedReturnCode':
    'Return Code Tablo 4.11’in ayrılmış aralığında — anlamı bu belgede değil, servis/metot arayüz tanımında verilir.',
  'protocol.someip.warning.unexpectedProtocolVersion':
    'Protocol Version 1 değil (PRS_SOMEIP_00051: “shall be 1”). Alan yerleşimi yine de sürüm 1 varsayılarak okundu.',
  'protocol.someip.warning.returnCodeShouldBeEOk':
    'Bu Message Type için Return Code 0x00 (E_OK) olmalıydı (AUTOSAR Tablo 4.5).',
  'protocol.someip.warning.errorReturnCodeIsEOk':
    'ERROR mesajının Return Code’u 0x00 (E_OK) OLAMAZ (AUTOSAR Tablo 4.5).',
  'protocol.someip.warning.methodEventSplitRecommended':
    'Metot (0x0000–0x7FFF) / olay (0x8000–0xFFFF) bölünmesi AUTOSAR’ın NOTUdur (PRS_SOMEIP_00245: “common practise and recommended”), normatif bir kural DEĞİL. Türetilen sınıf yalnız bu tavsiyeye dayanır.',
  'protocol.someip.warning.serviceDiscoveryTpSegment':
    'Message ID SOME/IP-SD’yi (0xFFFF8100) gösteriyor ama mesaj bir TP segmenti. SD yalnız UDP üzerinde taşınır (PRS_SOMEIPSD_00220) — SD çözümü yapılmadı, payload ham bırakıldı.',
  'protocol.someip.error.sdPayloadTooShort':
    'SOME/IP-SD payload’u 12 bayttan kısa — Flags, Reserved ve iki dizi uzunluğu sığmıyor.',
  'protocol.someip.error.sdEntriesOverflow':
    'Entries Array Length mesaj sınırını aşıyor (ya da Options Array Length için yer bırakmıyor) — girdiler çözülmedi.',
  'protocol.someip.error.sdOptionsOverflow':
    'Options Array Length mesaj sınırını aşıyor — opsiyonlar çözülmedi.',
  'protocol.someip.warning.sdEntriesLengthNotMultiple':
    'Entries Array Length 16’nın katı değil; her SD girdisi tam 16 bayttır. Yalnız tam girdiler çözüldü, artan baytlar atlandı.',
  'protocol.someip.warning.sdUnknownEntryType':
    'SD girdi tipi bilinmiyor (bilinenler: 0x00 Find, 0x01 Offer / TTL=0 ise Stop Offer, 0x06 Subscribe / Stop Subscribe, 0x07 Subscribe Ack / Nack). Girdinin son 4 baytının yapısı bilinmediği için ham bırakıldı.',
  'protocol.someip.warning.sdUnknownOptionType':
    'SD opsiyon tipi bilinmiyor — gövdesi ham gösteriliyor, alan kırılımı uydurulmuyor.',
  'protocol.someip.warning.sdOptionLengthMismatch':
    'Sabit boylu bir SD opsiyonu beklenmeyen bir Length bildiriyor — alan yerleşimine güvenilemez, gövde ham gösteriliyor.',
  'protocol.someip.warning.sdOptionTruncated':
    'SD opsiyonunun bildirdiği boy opsiyon dizisinin sonunu aşıyor — kalan baytlar ham gösteriliyor ve çözüm durduruldu.',
  'protocol.someip.warning.sdUnknownL4Protocol':
    'Uç nokta opsiyonunun taşıma protokolü tanınmıyor (beklenen: 0x06 TCP, 0x11 UDP).',
  'protocol.someip.warning.sdTrailingBytes':
    'SD dizilerinden sonra artan bayt var — dizi uzunlukları mesaj sınırıyla örtüşmüyor.',
  'protocol.someip.warning.sdConfigStringTruncated':
    'Konfigürasyon dizesinin uzunluk öneki opsiyonun sonunu aşıyor — kalan baytlar ham gösteriliyor.',
  'protocol.someip.summary.request': 'SOME/IP isteği',
  'protocol.someip.summary.requestNoReturn': 'SOME/IP tek yönlü isteği (yanıt beklenmiyor)',
  'protocol.someip.summary.notification': 'SOME/IP bildirimi / olayı',
  'protocol.someip.summary.response': 'SOME/IP yanıtı',
  'protocol.someip.summary.error': 'SOME/IP hata yanıtı',
  'protocol.someip.summary.serviceDiscovery': 'SOME/IP-SD mesajı',
  'protocol.someip.summary.unknown': 'SOME/IP mesajı (tanınmayan Message Type)',
  'protocol.someip.example.request.name': 'Request (metot çağrısı)',
  'protocol.someip.example.request.description':
    'Service 0x1234, Method 0x0421, Message Type 0x00 = REQUEST. Length 12 → toplam 20 bayt, geriye 4 baytlık ham payload kalır.',
  'protocol.someip.example.response.name': 'Response (aynı Request ID)',
  'protocol.someip.example.response.description':
    'İstekle AYNI Client/Session kimliği, Message Type 0x80 = RESPONSE. Korelasyonu bu çift üzerinden izleyin.',
  'protocol.someip.example.notification.name': 'Notification (olay)',
  'protocol.someip.example.notification.description':
    'Event ID 0x8001 (tavsiye edilen olay aralığı), Message Type 0x02 = NOTIFICATION — türetilen sınıf “Notification / Event”.',
  'protocol.someip.example.error.name': 'ERROR — E_UNKNOWN_METHOD',
  'protocol.someip.example.error.description':
    'Message Type 0x81 = ERROR, Return Code 0x03 = E_UNKNOWN_METHOD. Payload yok, Length tam olarak 8.',
  'protocol.someip.example.tpSegment.name': 'SOME/IP-TP segmenti',
  'protocol.someip.example.tpSegment.description':
    'Message Type 0x20 = TP_REQUEST. Başlıktan sonra 4 baytlık TP başlığı gelir: Offset alanı 16 baytın katıdır, More Segments bayrağı 1.',
  'protocol.someip.example.sdOfferService.name': 'SOME/IP-SD — Offer Service',
  'protocol.someip.example.sdOfferService.description':
    'Message ID 0xFFFF8100 mesajı SD olarak açar. Bir Offer Service girdisi ve ona bağlı bir IPv4 Endpoint opsiyonu (192.168.1.10, UDP 30509) çözülür.',
  'protocol.someip.example.sdFindService.name': 'SOME/IP-SD — Find Service',
  'protocol.someip.example.sdFindService.description':
    'Opsiyonsuz bir Find Service girdisi: Instance/Major/Minor alanları “ANY” değerlerini taşır, Options Array Length sıfırdır.',
  'protocol.someip.example.truncatedMessage.name': 'Eksik mesaj (akış parçası)',
  'protocol.someip.example.truncatedMessage.description':
    'Length 20 baytlık bir mesaj vaat ediyor ama tamponda 18 bayt var — consumedBytes 0 döner, çağıran daha çok veri toplamalıdır.',

  // --- CCP ---
  'protocol.ccp.documentation.summary':
    'CAN Calibration Protocol çerçevelerini çözer: bir CRO’nun Command/Counter/Parameters alanları, ya da bir DTO’nun Command Return Message (Return Code tablosu), Event Message veya DAQ verisi işareti. Komut ve dönüş kodu tabloları iki bağımsız açık kaynak CCP implementasyonuyla (pySART/cccp, CanCat) bayt bayt çapraz doğrulandı. Her başarılı çözüm bir legacy uyarısı taşır — ASAM CCP’yi obsolete ilan etti, yerine XCP öneriyor.',
  'protocol.ccp.option.frameInterpretation': 'Çerçeve yorumu',
  'protocol.ccp.option.frameInterpretation.description':
    'Bu CAN çerçevesinin bir CRO (leader → follower komut) mu yoksa bir DTO (follower → leader yanıt/DAQ verisi) mu olduğu baytlardan GERÇEKTEN çıkarılamaz — küçük bir komut kodu ile bir DAQ PID’i aynı sayısal değeri paylaşabilir. Hangi konfigüre edilmiş CAN kimliğinden geldiğine bağlıdır.',
  'protocol.ccp.option.frameInterpretation.raw': 'Ham (yorumsuz)',
  'protocol.ccp.option.frameInterpretation.cro': 'CRO (komut)',
  'protocol.ccp.option.frameInterpretation.dto': 'DTO (yanıt / DAQ verisi)',
  'protocol.ccp.error.frameTooShort': 'Çerçeve 8 baytlık SocketCAN başlığından kısa.',
  'protocol.ccp.error.frameTooLong': 'Çerçeve klasik CAN çerçeve uzunluğunu aşıyor.',
  'protocol.ccp.error.aborted': 'Çözümleme iptal edildi.',
  'protocol.ccp.error.emptyPayload':
    'CAN payload’ı boş — bir CCP çerçevesi en az bir Command/Packet ID baytı gerektirir.',
  'protocol.ccp.warning.legacyProtocol':
    'CCP legacy bir protokoldür — ASAM bunu obsolete ilan etti ve yeni tasarımlarda XCP öneriyor.',
  'protocol.ccp.warning.shortFrame':
    'CRO ve DTO her zaman 8 bayttır; bu payload daha kısa, sondaki alanlar eksik.',
  'protocol.ccp.warning.unassignedCommand': 'Bu komut kodu bu motor için çapraz doğrulanan tabloda yok.',
  'protocol.ccp.warning.parametersRaw':
    'Bu komutun parametreleri bu motor tarafından alan alan çözülmüyor; ham gösterilir.',
  'protocol.ccp.warning.unknownReturnCode': 'Bu dönüş kodu bu motor için çapraz doğrulanan tabloda yok.',
  'protocol.ccp.warning.responseDataRaw':
    'Bu Command Return Message’ın hangi komutu yanıtladığı tek, durumsuz bir çerçeveden bilinemez — XCP’nin aksine her CCP CRM’i AYNI sabit uzunluktadır, bu yüzden uzunluk tabanlı bir ipucu da yok; ham gösterilir.',
  'protocol.ccp.warning.eventDataRaw': 'Packet ID’nin ötesindeki olay gövdesi çözülmüyor; ham gösterilir.',
  'protocol.ccp.warning.daqData':
    'Bu bayt DAQ veri aralığına düşüyor — içeriği bu çözücünün sahip olmadığı bir DAQ list konfigürasyonuna bağlıdır, ham gösterilir.',
  'protocol.ccp.summary.raw': 'CCP çerçevesi (ham)',
  'protocol.ccp.summary.cro': 'CCP komut çerçevesi (CRO)',
  'protocol.ccp.summary.dto': 'CCP yanıt çerçevesi (DTO)',
  'protocol.ccp.example.connectCro.name': 'CONNECT (CRO)',
  'protocol.ccp.example.connectCro.description':
    'Command 0x01 = CONNECT, Counter 0x20, station address 0x1234 Intel/little-endian biçiminde — çözülmüş görmek için frameInterpretation=cro seçin.',
  'protocol.ccp.example.connectCrmAck.name': 'CONNECT onaylandı (CRM)',
  'protocol.ccp.example.connectCrmAck.description':
    'Packet ID 0xFF = Command Return Message, Return Code 0x00 = ACKNOWLEDGE, Counter 0x20 CRO’yu yankılıyor — çözülmüş görmek için frameInterpretation=dto seçin.',
  'protocol.ccp.example.setMtaCro.name': 'SET_MTA (CRO)',
  'protocol.ccp.example.setMtaCro.description':
    'Command 0x02 = SET_MTA, address 0x00002000 Motorola/big-endian biçiminde — bu bayt sırası SABİTTİR, XCP’nin müzakere edilen SET_MTA adresinin aksine.',
  'protocol.ccp.example.unassignedCommandCro.name': 'Tanımsız komut kodu',
  'protocol.ccp.example.unassignedCommandCro.description':
    'Command 0x0A, GET_ACTIVE_CAL_PAGE (0x09) ile SET_S_STATUS (0x0C) arasındaki boşlukta — hiçbir kaynağın komut tablosunda yok, Unassigned gösterilir.',
  'protocol.ccp.example.daqDataDto.name': 'DAQ verisi (çözülmez)',
  'protocol.ccp.example.daqDataDto.description':
    'Packet ID 0x02 ne 0xFF (CRM) ne 0xFE (Event) — bir DAQ list PID’i; ölçüm baytları bu motorun sahip olmadığı bir DAQ list konfigürasyonu ister.',
  'protocol.ccp.example.emptyPayload.name': 'Boş payload',
  'protocol.ccp.example.emptyPayload.description': 'DLC 0 — çözülecek bir Command/Packet ID baytı yok.',
  'protocol.flexray.documentation.summary':
    'Tek bir FlexRay çerçevesini çözer — 5 baytlık başlık, payload ve 24 bitlik trailer CRC’si. Başlık bit bit okunur: beş gösterge biti (reserved, payload preamble, null frame, sync frame, startup frame), 11 bitlik Frame ID, 7 bitlik Payload Length ve 6 bitlik Cycle Count. Payload Length BAYT DEĞİL 2 BAYTLIK SÖZCÜK sayar — ham sözcük sayısı da bayt karşılığı da gösterilir. İki CRC de yalnız GÖSTERİLMEZ, GERÇEKTEN DOĞRULANIR: 11 bitlik header CRC’si tam 20 başlık biti üzerinden (sync + startup göstergesi, Frame ID, Payload Length — reserved, payload preamble ve null frame bitleri ile Cycle Count KAPSAM DIŞIDIR), 24 bitlik frame CRC’si ise başlık + payload üzerinden. Frame CRC’sinin başlangıç değeri kanala göre değişir (A 0xFEDCBA, B 0xABCDEF); kanal çerçevenin içinde değil yakalama bilgisi olduğu için seçilebilir. Bütün CRC parametreleri iki bağımsız açık kaynakla çapraz doğrulandı ve 14 conformance test codeword’ünden yeniden üretildi. Payload’ın kendisi ham kalır: yapısı telden değil FIBEX ya da AUTOSAR ARXML tanımından gelir. Çevrim ve slot korelasyonu analyzer işidir.',
  'protocol.flexray.option.channel': 'Kanal',
  'protocol.flexray.option.channel.description':
    'Frame CRC’si her kanalda farklı bir başlangıç değeri kullanır ve kanal çerçevenin içinde taşınmaz. Yanlış seçim geçerli bir çerçeveyi bozuk gösterir.',
  'protocol.flexray.option.channel.a': 'Kanal A (init 0xFEDCBA)',
  'protocol.flexray.option.channel.b': 'Kanal B (init 0xABCDEF)',
  'protocol.flexray.error.frameTooShort':
    'Çerçeve 8 baytlık asgari boydan kısa (5 bayt başlık + 3 bayt frame CRC).',
  'protocol.flexray.error.payloadTruncated':
    'Payload Length çerçevede olandan fazla bayt vaat ediyor; bu bir akış parçasına benziyor.',
  'protocol.flexray.error.headerCrcMismatch': 'Header CRC’si kapsadığı 20 başlık bitiyle tutmuyor.',
  'protocol.flexray.error.frameCrcMismatch':
    'Frame CRC’si seçilen kanal için başlık ve payload ile tutmuyor.',
  'protocol.flexray.error.aborted': 'Çözümleme iptal edildi.',
  'protocol.flexray.warning.headerCrcMismatch':
    'Header CRC’si tutmuyor — Frame ID ya da Payload Length bozulmuş olabilir, bu yüzden payload sınırı güvenilir değil.',
  'protocol.flexray.warning.frameCrcMismatch':
    'Frame CRC’si tutmuyor. Header CRC’si geçerliyse veriyi bozuk saymadan önce kanalın doğru seçilip seçilmediğine bak.',
  'protocol.flexray.warning.reservedBitSet':
    'Reserved biti set; spec bu biti 0 olarak gönderiyor. Header CRC kapsamının dışında olduğu için korunmuyor.',
  'protocol.flexray.warning.payloadNeedsDefinition':
    'Payload’ın yapısı telden çıkmaz — FIBEX ya da AUTOSAR ARXML tanımı gerekir. Ham gösteriliyor.',
  'protocol.flexray.warning.payloadPreamblePresent':
    'Payload preamble göstergesi set: payload bir network management vector ya da message ID ile başlıyor. Hangisi olduğu çerçevenin statik mi dinamik segmentte mi olduğuna bağlı, o da çerçevede yok — bu yüzden preamble ayrıştırılmıyor.',
  'protocol.flexray.warning.nullFrameHasData':
    'Null frame göstergesi bunun null frame olduğunu söylüyor ama payload tamamen sıfır değil.',
  'protocol.flexray.warning.channelAssumed':
    'Kanal verilmedi, frame CRC’si için kanal A varsayıldı. Aynı çerçeve kanal B’de CRC uyuşmazlığı bildirirdi.',
  'protocol.flexray.warning.trailingBytes': 'Frame CRC’sinden sonra artan baytlar var.',
  'protocol.flexray.summary.dataFrame': 'FlexRay veri çerçevesi',
  'protocol.flexray.summary.nullFrame': 'FlexRay null çerçevesi',
  'protocol.flexray.example.conformanceChannelA.name': 'Conformance codeword (kanal A)',
  'protocol.flexray.example.conformanceChannelA.description':
    'FlexRay Conformance Test Specification’dan sync + startup çerçevesi; Frame ID 2, Payload Length 1 sözcük (2 bayt), çevrim 8. Kanal A’da iki CRC de geçerli.',
  'protocol.flexray.example.conformanceChannelB.name': 'Aynı çerçeve (kanal B)',
  'protocol.flexray.example.conformanceChannelB.description':
    'Bayt bayt aynı mesaj, kanal B’nin frame CRC’siyle. Kanal A’da açarsan frame CRC’si geçersiz çıkar — başlangıç değeri farkının görünür hâli.',
  'protocol.flexray.example.dataFrame.name': 'Veri çerçevesi, 8 baytlık payload',
  'protocol.flexray.example.dataFrame.description':
    'Frame ID 100, Payload Length 4 sözcük = 8 BAYT, çevrim 17. Uzunluğu bayt okumak frame CRC’sini 4 bayt öne kaydırırdı.',
  'protocol.flexray.example.nullFrame.name': 'Null çerçeve',
  'protocol.flexray.example.nullFrame.description':
    'Null frame göstergesi 0; payload alanı ayrılmış ama veri taşımıyor.',
  'protocol.flexray.example.payloadPreamble.name': 'Payload preamble set',
  'protocol.flexray.example.payloadPreamble.description':
    'Preamble göstergesi set ama preamble ayrıştırılmıyor: network management vector mı message ID mi olduğu çerçevede yok.',
  'protocol.flexray.example.badHeaderCrc.name': 'Bozuk başlık',
  'protocol.flexray.example.badHeaderCrc.description':
    'Bir başlık baytı çevrildi: header CRC’si tutmuyor ve bayt frame CRC’sinin de kapsamında olduğu için o da tutmuyor. İki ayrı hata, kendi offset’leriyle.',
  'protocol.flexray.example.badFrameCrc.name': 'Bozuk frame CRC',
  'protocol.flexray.example.badFrameCrc.description':
    'Yalnız son trailer baytı çevrildi: header CRC’si GEÇERLİ kalırken frame CRC’si tutmuyor — ikisi birbirinden bağımsız doğrulanıyor.',
  'protocol.flexray.example.truncatedFrame.name': 'Eksik çerçeve',
  'protocol.flexray.example.truncatedFrame.description':
    'Payload Length 4 sözcük (8 bayt) vaat ediyor, yani 16 bayt gerek ama 10 bayt var.',

  // --- PROFINET ---
  'protocol.profinet.error.frameTooShort':
    'Çerçeve, Ethernet başlığı (14 bayt) + FrameID (2 bayt) kadar uzun değil.',
  'protocol.profinet.error.frameTooLong': 'Çerçeve izin verilen azami uzunluğu aşıyor.',
  'protocol.profinet.error.aborted': 'Çözümleme iptal edildi.',
  'protocol.profinet.error.etherTypeNotProfinet':
    'EtherType 0x8892 değil — bu çerçeve PROFINET (PN-RT) değildir; gövde çözülmedi, ham bırakıldı.',
  'protocol.profinet.error.cyclicTooShort':
    'Döngüsel çerçevenin sonunda APDU Status için gereken 4 bayt (CycleCounter + DataStatus + TransferStatus) yok.',
  'protocol.profinet.error.dcpHeaderTruncated':
    'DCP başlığının (10 bayt: ServiceID/ServiceType/Xid/ResponseDelay/DCPDataLength) tamamı gelmedi.',
  'protocol.profinet.error.dcpBlockTruncated':
    'DCPDataLength ya da DCPBlockLength alanının vaat ettiği bölge çerçevedeki bayt sayısını aşıyor.',
  'protocol.profinet.error.alarmHeaderTruncated':
    'Alarm (RTA) sabit başlığının 12 baytı için yeterli veri yok.',
  'protocol.profinet.error.alarmBlockTruncated':
    'VarPartLen ya da blok başlığının vaat ettiği alarm gövdesi çerçeveye sığmıyor.',
  'protocol.profinet.warning.apduStatusFromFrameEnd':
    'Döngüsel çerçevede I/O verisinin uzunluğu YAZMAZ; APDU Status yalnız çerçeve sonundan geri sayılarak bulunur. Yakalamaya eklenmiş her fazladan bayt (Ethernet dolgusu ya da FCS) bu üç alanı kaydırır.',
  'protocol.profinet.warning.ioDataNeedsGsdml':
    'I/O verisinin alanlara bölünmesi GSDML ve slot/subslot planına bağlıdır; IOPS/IOCS baytları veriyle iç içedir ve tek çerçeveden çıkarılamaz — bölge tek parça ham gösteriliyor.',
  'protocol.profinet.warning.dataStatusReservedBits':
    'DataStatus’un ayrılmış bitleri (bit 3 ve 6) sıfır değil — uyumlu bir çerçevede sıfır olmalıdır.',
  'protocol.profinet.warning.transferStatusNotOk':
    'TransferStatus sıfır değil: sağlayıcı bu çerçevenin yok sayılmasını istiyor.',
  'protocol.profinet.warning.tsnProfileReassignsRange':
    'Bu FrameID bandı (0x0100-0x3FFF) time-aware (TSN) profilinde başka bir sınıfa atanır. Hangi profilin geçerli olduğu çerçevede değil, önceki bağlantı kurulumunda yazar — klasik okuma uygulandı.',
  'protocol.profinet.warning.ptcpBodyNotDecoded':
    'PTCP (Precision Time Control Protocol) kendi başına bir tel biçimidir; FrameID sınıflandırıldı ama gövde bu motorda çözülmüyor, ham gösteriliyor.',
  'protocol.profinet.warning.reservedFrameId':
    'FrameID iki kaynakta da adlandırılmış bir sınıfa düşmüyor (ayrılmış ya da tek kaynaklı bant) — gövde çözülmedi.',
  'protocol.profinet.warning.fragmentationNotDecoded':
    'Real-Time parçalama (fragmentation) çerçevesi ayrı bir yeniden birleştirme adımı ister; gövde ham gösteriliyor.',
  'protocol.profinet.warning.paddingNotZero':
    'Bildirilen bölgeden sonraki baytlar sıfır değil — Ethernet dolgusu beklenirdi.',
  'protocol.profinet.warning.dcpUnknownService':
    'DCP ServiceID çapraz teyitli kümede (Get/Set/Identify/Hello) yok — adı verilmez.',
  'protocol.profinet.warning.dcpUnknownServiceType':
    'DCP ServiceType tanımlı üç değerden (0 Request, 1 Response Success, 5 ServiceID desteklenmiyor) biri değil.',
  'protocol.profinet.warning.dcpReservedBitsSet':
    'DCP başlığında ayrılmış olması gereken bir alan sıfır değil.',
  'protocol.profinet.warning.dcpDataLengthMismatch':
    'DCPDataLength ile blok zincirinin gerçekte tükettiği bayt sayısı uyuşmuyor — hizalama dolgusu atlanmış bir çözümlemede tam olarak burası kayar.',
  'protocol.profinet.warning.dcpUnknownOption':
    'DCP Option/Suboption çifti iki kaynakta da aynı adla geçmiyor — adlandırılmaz.',
  'protocol.profinet.warning.dcpValueNotDecoded':
    'Bu blok değerinin yerleşimi iki bağımsız kaynakta teyit edilemedi; uydurma alan basmak yerine ham bırakıldı.',
  'protocol.profinet.warning.dcpPaddingNotZero':
    'Tek uzunluklu bloğun hizalama dolgusu sıfır değil — dolgu baytının sıfır olması beklenir.',
  'protocol.profinet.warning.dcpBlockLimitReached':
    'Blok sayısı üst sınıra ulaştı; zincir yürüyüşü sonsuz döngüye karşı durduruldu.',
  'protocol.profinet.warning.dcpDeviceRoleBitsUnknown':
    'DeviceRole baytının bit anlamları hiçbir kamuya açık kaynakta adlandırılmıyor — ham bayt gösteriliyor.',
  'protocol.profinet.warning.dcpBlockLengthUnderflow':
    'Servis bu blokta BlockInfo/BlockQualifier bekliyor ama DCPBlockLength 2 bayta bile yetmiyor.',
  'protocol.profinet.warning.alarmUnknownPduType':
    'RTA PDUType çapraz teyitli kümede (Data/NACK/ACK/ERR) yok — gövde çözülmedi.',
  'protocol.profinet.warning.alarmUnknownType':
    'AlarmType iki kaynakta AYNI adla geçmiyor (ör. 0x0007 ve 0x000A farklı adlandırılmış, 0x0014-0x001D yalnız tek kaynakta) — sayı ham gösteriliyor.',
  'protocol.profinet.warning.alarmUnknownBlockType':
    'Alarm blok tipi Notification/Ack kümesinde değil; gövdenin yerleşimi bilinmediği için ham bırakıldı.',
  'protocol.profinet.warning.alarmVarPartMismatch':
    'VarPartLen ile alarm gövdesinin gerçekte tükettiği bayt sayısı uyuşmuyor.',
  'protocol.profinet.warning.alarmPayloadNeedsContext':
    'AlarmSpecifier’dan sonraki UserStructureIdentifier yükünün çözümü AR (Application Relation) bağlamına dayanır; tek çerçeveden çıkarılamaz, ham gösteriliyor.',
  'protocol.profinet.warning.alarmReservedBitSet':
    'AlarmSpecifier’ın ayrılmış biti (bit 14) sıfır değil.',
  'protocol.profinet.summary.cyclic': 'Döngüsel I/O — FrameID {frameId}',
  'protocol.profinet.summary.dcp': 'DCP {service} — {blockCount} blok',
  'protocol.profinet.summary.alarm': 'Alarm — {pduType}, {alarmType}',
  'protocol.profinet.summary.other': 'FrameID {frameId} — {frameClass}',
  'protocol.profinet.summary.notProfinet': 'PROFINET değil (EtherType {etherType})',
  'protocol.profinet.documentation.summary':
    'PROFINET (PI / IEC 61158-6-10): girdi TAM bir Ethernet çerçevesidir — DST/SRC MAC, opsiyonel VLAN tag’leri ve EtherType 0x8892 çözülür (ethercat.ts ile aynı girdi sözleşmesi, aynı paylaşılan Ethernet motoru). PROFINET tek bir tel biçimi değil, FrameID ile ayrışan bir ailedir: FrameID sınıfı belirler, gövde ona göre okunur. Döngüsel (RT) çerçevede APDU Status — CycleCounter, DataStatus’un altı anlamlı biti ve TransferStatus — yalnız çerçeve sonundan geri sayılarak bulunur; I/O verisinin uzunluğu çerçevede yazmadığı için bölge tek parça ham kalır. DCP (0xFEFC-0xFEFF) tam çözülür: ServiceID/ServiceType bit bit, Xid, ResponseDelayFactor, DCPDataLength ve blok zinciri; bloklar çift bayta hizalanır ve tek uzunluklu bloğun dolgusu ayrı alan olarak gösterilir. Alarm (0xFC01/0xFE01) RTA sabit başlığı, AlarmType/API/Slot/Subslot/ModuleIdent/SubmoduleIdent ve AlarmSpecifier bitleriyle çözülür. Alan düzenleri Wireshark’ın PROFINET eklentisi ile RT-Labs p-net yığını arasında çapraz teyitlidir; iki kaynakta aynı adla geçmeyen değerler (ör. AlarmType 0x0007/0x000A) adlandırılmaz. PN-IO acyclic (DCE/RPC üzerinden UDP), PTCP gövdesi ve GSDML ayrıştırma kapsam dışıdır.',
  'protocol.profinet.example.dcpIdentifyRequest.name': 'DCP Identify isteği (multicast)',
  'protocol.profinet.example.dcpIdentifyRequest.description':
    'FrameID 0xFEFE ile çok noktaya yayın cihaz taraması: tek All Selector bloğu (uzunluk 0) ve ResponseDelayFactor 0x0100. Aynı iki bayt yalnız bu serviste gecikme çarpanıdır, diğer her yerde Reserved’dır.',
  'protocol.profinet.example.dcpIdentifyResponse.name': 'DCP Identify yanıtı (hizalama dolgusu)',
  'protocol.profinet.example.dcpIdentifyResponse.description':
    'Dört bloklu yanıt: Type of Station, Name of Station, IP parametresi ve Device ID. İlk bloğun değeri 11 bayt (TEK) olduğu için ardından 1 bayt hizalama dolgusu gelir — dolgu atlansaydı sonraki HER blok bir bayt kayardı. Dolgu ayrı alan olarak gösterilir.',
  'protocol.profinet.example.dcpSetResponsePadding.name': 'DCP Set yanıtı — iki dolgulu blok',
  'protocol.profinet.example.dcpSetResponsePadding.description':
    'İki Control/Response bloğu; her birinin değeri Option + Suboption + BlockError = 3 bayt (TEK), yani her blok kendi hizalama dolgusunu taşır. İkinci bloğun doğru ofsette okunması dolgunun tüketildiğinin kanıtıdır.',
  'protocol.profinet.example.dcpGetRequestSelectors.name': 'DCP Get isteği (uzunluksuz seçiciler)',
  'protocol.profinet.example.dcpGetRequestSelectors.description':
    'Get isteğinde gövde blok DEĞİL seçici listesidir: yalnız Option + Suboption çiftleri, DCPBlockLength yoktur. Genel blok çözücüsüyle okunsaydı değer alanı çöp olurdu.',
  'protocol.profinet.example.dcpHello.name': 'DCP Hello (cihazdan kendiliğinden)',
  'protocol.profinet.example.dcpHello.description':
    'Cihaz açılışta kendini duyurur: FrameID 0xFEFC, hedef p-net’in de kullandığı 01:0E:CF:00:00:01 çok noktaya yayın adresi, blokta Name of Station. Hello isteğinde BlockInfo VARDIR — bu iki bayt DCPBlockLength’in içinden düşülür.',
  'protocol.profinet.example.rtCyclicIo.name': 'Döngüsel I/O — sağlayıcı çalışıyor',
  'protocol.profinet.example.rtCyclicIo.description':
    'FrameID 0x8000 (RT_CLASS_1 unicast). 40 bayt opak I/O verisinden sonra 4 baytlık APDU Status gelir; DataStatus 0x35 = Primary + DataValid + Run + Normal operation. Verinin başındaki 0x000F/0x05DC değerleri örnek bir Control Word ve Speed Setpoint’tir ama ADLANDIRILMAZ: kırılımı GSDML verir.',
  'protocol.profinet.example.rtCyclicProviderStopped.name': 'Döngüsel I/O — sağlayıcı durmuş',
  'protocol.profinet.example.rtCyclicProviderStopped.description':
    'Aynı yapı, DataStatus 0x20 = Backup + Invalid + Stop ve TransferStatus 0x01 (“bu çerçeveyi yok say”). Çerçeve yapısal olarak geçerlidir; sorun uyarıyla bildirilir, hata olarak değil.',
  'protocol.profinet.example.alarmLowDiagnosis.name': 'Alarm (düşük öncelik) — Diagnosis',
  'protocol.profinet.example.alarmLowDiagnosis.description':
    'FrameID 0xFE01, Data-RTA PDU’su ve Alarm Notification Low bloğu: AlarmType Diagnosis, API 0, Slot 1 / Subslot 1, ModuleIdent 0x00000101. AlarmSpecifier’ın 11 bitlik sıra numarası ve dört tanı biti ayrı ayrı gösterilir.',
  'protocol.profinet.example.alarmHighPlug.name': 'Alarm (yüksek öncelik) — Plug',
  'protocol.profinet.example.alarmHighPlug.description':
    'FrameID 0xFC01: modül takıldı bildirimi. PDUType ve AddFlags baytları nibble nibble ayrılır (tip/sürüm, WindowSize/TACK); AlarmSpecifier’dan sonraki UserStructureIdentifier yükü AR bağlamı istediği için ham bırakılır.',
  'protocol.profinet.example.ptcpAnnounce.name': 'PTCP Announce (kapsam dışı gövde)',
  'protocol.profinet.example.ptcpAnnounce.description':
    'FrameID 0xFF00 aynı EtherType altında gelir, bu yüzden sınıflandırılır — ama PTCP kendi başına bir tel biçimidir ve gövdesi bu motorda çözülmez. Boş kart basmak yerine ham gösterilip nedeni uyarıyla söylenir.',
  'protocol.profinet.example.etherTypeNotProfinet.name': 'Yanlış EtherType',
  'protocol.profinet.example.etherTypeNotProfinet.description':
    'Döngüsel örnekle aynı gövde, EtherType kasten 0x0800 (IPv4). MAC alanları yine çözülür ama FrameID’ye bile dokunulmaz — yanlış EtherType’ta gövde çözmek sessiz-yanlış çözümlemenin ta kendisi olurdu.',
  'protocol.profinet.example.dcpBlockTruncated.name': 'Kesik DCP blok bölgesi',
  'protocol.profinet.example.dcpBlockTruncated.description':
    'DCPDataLength 32 bayt vaat ediyor ama telde yalnız 8 bayt var. Okunabilen blok yine de gösterilir (kısmi çözüm korunur), çerçeve length-mismatch ile işaretlenir.',
  'protocol.profinet.example.frameTooShort.name': 'Çok kısa çerçeve',
  'protocol.profinet.example.frameTooShort.description':
    '10 bayt: Ethernet başlığı bile tamamlanmıyor — ParseFailure (kaydedilebilir, akış devam edebilir).',
  // --- POWERLINK ---
  'protocol.powerlink.error.aborted': 'Çözümleme iptal edildi.',
  'protocol.powerlink.error.asndBodyTruncated':
    'ASnd gövdesi ServiceID baytı için bile yeterli uzunlukta değil.',
  'protocol.powerlink.error.basicHeaderTruncated':
    'MessageType + Destination/Source Node ID için gereken 3 bayt tamamlanmıyor.',
  'protocol.powerlink.error.etherTypeNotPowerlink':
    'EtherType 0x88AB değil — bu çerçeve POWERLINK değildir; gövde çözülmedi, ham bırakıldı.',
  'protocol.powerlink.error.frameTooLong': 'Çerçeve izin verilen azami uzunluğu aşıyor.',
  'protocol.powerlink.error.frameTooShort':
    'Çerçeve, Ethernet başlığı (14 bayt) + temel POWERLINK başlığı (3 bayt) kadar uzun değil.',
  'protocol.powerlink.error.pdoHeaderTruncated':
    'PReq/PRes başlığının (7 bayt: durum/NMTStatus, bayraklar, PDOVersion, Size) tamamı gelmedi.',
  'protocol.powerlink.error.sdoCommandTruncated':
    'Command Layer sabit başlığının (8 bayt) ya da Abort Code’un (4 bayt) tamamı gelmedi.',
  'protocol.powerlink.error.sdoSequenceTruncated':
    'Sequence Layer için gereken 4 bayt (ReceiveCon/SendCon + ayrılmış) tamamlanmıyor.',
  'protocol.powerlink.warning.asndServiceBodyNotDecoded':
    'ASnd ServiceID çapraz teyitli altı serviste (IdentResponse/StatusResponse/NMTRequest/NMTCommand/SDO/SyncResponse) değil — gövde bu motorun kapsamı dışında, ham bırakıldı.',
  'protocol.powerlink.warning.asndServiceNotNamed':
    'ASnd ServiceID iki kaynakta da adlandırılmış kümede değil.',
  'protocol.powerlink.warning.bodyNotDecoded':
    'MessageType adlandırılmış olsa da (AInv/AMNI gibi) iki kaynak da bu tip için alan tablosu vermiyor — gövde ham gösteriliyor.',
  'protocol.powerlink.warning.errorHistoryTrailingBytes':
    'ErrorCodeList bölgesi 20 baytlık girdilere tam bölünmüyor; kalan baytlar ham gösteriliyor.',
  'protocol.powerlink.warning.ipFieldByteOrderConflict':
    'IdentResponse’un IPAddress/SubnetMask/DefaultGateway alanlarında iki kaynak bayt sırasında ANLAŞMIYOR (Wireshark big-endian, openPOWERLINK little-endian okuyor) — yanlış yönde okunmuş bir IP ham baytlardan daha kötü olacağı için alan çevrilmeden ham basılıyor.',
  'protocol.powerlink.warning.messageTypeHighBitSet':
    'MessageType baytının 7. biti set — Wireshark bu biti maskeler, openPOWERLINK MessageType’ı tam bayt sayar; değer maskelenmiş haliyle çözüldü.',
  'protocol.powerlink.warning.messageTypeNotNamed':
    'MessageType iki kaynakta da adlandırılmış kümede değil.',
  'protocol.powerlink.warning.nmtCommandDataNotDecoded':
    'NMT komut verisinin yapısı komuta göre değişir (node listesi, ana bilgisayar adı, hata gerekçesi …); iki kaynağın kesiştiği ortak bir kırılım yok, bölge ham gösteriliyor.',
  'protocol.powerlink.warning.nmtCommandNotNamed':
    'NMTCommandID/RequestedCommandID iki kaynakta da adlandırılmış kümede değil.',
  'protocol.powerlink.warning.nmtStateNotNamed':
    'NMT durum baytı ortak ya da role özgü tabloda yok (ya da STOPPED, tanımlı olmadığı Managing Node’dan geldi).',
  'protocol.powerlink.warning.paddingNotZero':
    'Bildirilen bölgeden sonraki baytlar sıfır değil — Ethernet dolgusu beklenirdi.',
  'protocol.powerlink.warning.pdoPayloadNeedsMapping':
    'PDO yükünün hangi baytı hangi objeye karşılık geldiği XDD/PDO eşlemesinden gelir, çerçeveden değil — bölge tek parça ham gösteriliyor.',
  'protocol.powerlink.warning.pdoSizeExceedsFrame':
    'Size alanının vaat ettiği bayt sayısı telde olandan büyük — çerçeve kesik ya da Size bozuk; yük telde olanla kırpıldı.',
  'protocol.powerlink.warning.sdoAbortCodeNotNamed':
    'SDO Abort Code, iki kaynağın kesiştiği kümede değil.',
  'protocol.powerlink.warning.sdoCommandLayerEmpty':
    'Command Layer boş: bu çerçeve yalnız Sequence Layer taşıyor (bağlantı kurulum/onay çerçevesi) — geçerli bir durum, hata değil.',
  'protocol.powerlink.warning.sdoCommandNotNamed':
    'SDO CommandID iki kaynakta da adlandırılmış kümede değil.',
  'protocol.powerlink.warning.sdoDataNeedsObjectDictionary':
    'Verinin tipi ve ölçeği Object Dictionary’de (XDD/EDS) tanımlanır, çerçevede değil — bölge tek parça ham gösteriliyor.',
  'protocol.powerlink.warning.sdoSegmentSizeMismatch':
    'SegmentSize alanının vaat ettiği bayt sayısı telde olandan büyük.',
  'protocol.powerlink.warning.singleSourceField':
    'Bu alan yalnız tek kaynakta (openPOWERLINK) adlandırılıyor; Wireshark bu baytı atlıyor.',
  'protocol.powerlink.warning.soaFlagsPartiallyNamed':
    'SoA bayrak baytının kalan bitleri (DNA AN yerel/genel, ring-redundancy) yalnız Wireshark’ta adlandırılıyor — openPOWERLINK’in bayrak listesinde yok.',
  'protocol.powerlink.warning.soaServiceNotNamed':
    'RequestedServiceID iki kaynakta da adlandırılmış kümede değil.',
  'protocol.powerlink.warning.staticErrorFieldNotSplit':
    'StaticErrorBitField’in iç kırılımı (ErrorRegister + DeviceSpecific) yalnız Wireshark’ta var; openPOWERLINK tek bir 64-bit alan sayıyor — sekiz bayt tek parça gösteriliyor.',
  'protocol.powerlink.summary.asnd': 'ASnd — {service} {detail}',
  'protocol.powerlink.summary.notPowerlink': 'POWERLINK değil (EtherType {etherType})',
  'protocol.powerlink.summary.other': '{messageType} — kaynak {sourceNodeId}, hedef {destinationNodeId}',
  'protocol.powerlink.summary.pdo': '{messageType} — {size} bayt, sürüm {pdoVersion}',
  'protocol.powerlink.summary.soa': 'SoA — {service}, hedef {target}',
  'protocol.powerlink.summary.soc': 'SoC — kaynak {sourceNodeId}, hedef {destinationNodeId}',
  'protocol.powerlink.documentation.summary':
    'POWERLINK (EPSG DS 301 / IEC 61784-2 CP 13): girdi TAM bir Ethernet çerçevesidir — DST/SRC MAC, opsiyonel VLAN tag’leri ve EtherType 0x88AB çözülür (ethercat.ts/profinet.ts ile aynı girdi sözleşmesi, aynı paylaşılan Ethernet motoru). CANopen ile ortak bir OD/PDO motoru paylaşma iddiası SINANDI ve ÇÜRÜDÜ: NMT durum baytları kesişmiyor, SDO çerçeveleri (Sequence+Command Layer) CANopen’ın tek baytlık command specifier’ından tamamen farklı ve PDO uzunluğu CANopen’da ≤8 baytlık CAN DLC’siyken POWERLINK’te çerçevede yazan 16-bit bir Size alanı — canopen.ts’e dokunulmadı. MessageType baytı (bit 7 maskeli) SoC/PReq/PRes/SoA/ASnd’i ayrıştırır; her tipin bayrak bitleri, NetTime/RelativeTime, PDOVersion ve Size alanı tam çözülür. ASnd altı servise (IdentResponse/StatusResponse/NMTRequest/NMTCommand/SDO/SyncResponse) dallanır; SDO via ASnd Sequence Layer (4 bayt) ve Command Layer’ı (8 baytlık sabit başlık + ReadByIndex/WriteByIndex alt başlığı + Abort Code) çözer. Alan yerleşimleri Wireshark’ın EPL dissector’ı ile openPOWERLINK V2’nin dokümante sabitleri arasında çapraz teyitlidir; yalnız tek kaynakta geçen alanlar (IdentResponse’un IP alanları, StaticErrorBitField’in iç kırılımı, FeatureFlags bitleri, SoA’nın ring-redundancy bayrakları) ham bırakılır ve uyarı taşır. PDO yükü ve NMT/SDO komut verisi XDD’ye/PDO eşlemesine bağlı olduğu için ham bırakılır — bu bir eksik değil, tanım-bağımlı içeriktir. SDO via UDP/PDO, XDD ayrıştırma ve çok çerçeveli analiz (cycle timing, node tablosu) kapsam dışıdır.',
  'protocol.powerlink.example.socCycleStart.name': 'SoC — döngü başlangıcı',
  'protocol.powerlink.example.socCycleStart.description':
    'Start of Cycle çok noktaya yayını: MC/PS bayrakları sıfır (ne çoklanmış ne ön ölçekli döngü), NetTime ve 64-bit RelativeTime alanları dolu.',
  'protocol.powerlink.example.socMultiplexedPrescaled.name':
    'SoC — çoklanmış ve ön ölçekli döngü',
  'protocol.powerlink.example.socMultiplexedPrescaled.description':
    'Aynı yapı, MC (multiplexed cycle completed) ve PS (prescaled slot) bayrakları set — iki bayrağın da ayrı ayrı okunduğunu gösterir.',
  'protocol.powerlink.example.preqPollRequest.name': 'PReq — anket isteği',
  'protocol.powerlink.example.preqPollRequest.description':
    'MN’den bir CN’e PollRequest: RD (data valid) bayrağı set, PDOVersion 1.0, 36 baytlık PDO yükü çerçevede YAZAN 16-bit Size alanıyla taşınıyor.',
  'protocol.powerlink.example.presPollResponse.name': 'PRes — anket yanıtı',
  'protocol.powerlink.example.presPollResponse.description':
    'CN’den çok noktaya yayınlanan PollResponse: NMTStatus NMT_CS_OPERATIONAL, RD bayrağı set, aynı 36 baytlık PDO yükü.',
  'protocol.powerlink.example.presLargePdo.name': 'PRes — büyük PDO yükü',
  'protocol.powerlink.example.presLargePdo.description':
    '200 baytlık PDO yükü: CANopen’ın ≤8 baytlık CAN DLC sınırının POWERLINK’te GEÇMEDİĞİNİ kanıtlıyor — Size alanı çerçevede 16-bit olarak yazıyor, üst sınır 1499 bayt.',
  'protocol.powerlink.example.presSizeExceedsFrame.name': 'PRes — Size çerçeveden büyük',
  'protocol.powerlink.example.presSizeExceedsFrame.description':
    'Size alanı 512 bayt vaat ediyor ama telde yalnız 36 bayt yük var — uyarı basılır, yük telde olanla kırpılır, UYDURULMAZ.',
  'protocol.powerlink.example.soaIdentRequest.name': 'SoA — IdentRequest daveti',
  'protocol.powerlink.example.soaIdentRequest.description':
    'MN’in bir CN’i asenkron faza davet etmesi: RequestedServiceID IdentRequest, hedef CN 1, POWERLINKVersion 2.0.',
  'protocol.powerlink.example.soaSyncRequest.name':
    'SoA — SyncRequest (PollResponse Chaining)',
  'protocol.powerlink.example.soaSyncRequest.description':
    'RequestedServiceID SyncRequest (0x06): SyncControl, PResTimeFirst/Second, SyncMNDelayFirst/Second, PResFallBackTimeout ve hedef MAC adresi ayrı ayrı çözülür.',
  'protocol.powerlink.example.asndIdentResponse.name': 'ASnd — IdentResponse',
  'protocol.powerlink.example.asndIdentResponse.description':
    'CN’in kimlik yanıtı: FeatureFlags/DeviceType/VendorId/ProductCode/RevisionNumber/SerialNumber hex biçiminde, IP alanları İKİ KAYNAĞIN bayt sırasında anlaşmadığı için ham bırakılıyor.',
  'protocol.powerlink.example.asndStatusResponse.name': 'ASnd — StatusResponse',
  'protocol.powerlink.example.asndStatusResponse.description':
    'StaticErrorBitField tek parça ham (iç kırılımı tek kaynaklı); ErrorCodeList’teki iki girdi EntryType’ın Profile/Mode/Emergency/Status alt bitlerini ayrı ayrı gösteriyor.',
  'protocol.powerlink.example.asndNmtStartNode.name': 'ASnd — NMTStartNode komutu',
  'protocol.powerlink.example.asndNmtStartNode.description':
    'MN’in çok noktaya yayınladığı NMTStartNode komutu: CommandID adlandırılır, CommandData’nın yapısı komuta göre değiştiği için ham bırakılır.',
  'protocol.powerlink.example.asndSdoReadByIndex.name':
    'ASnd — SDO ReadByIndex isteği (expedited)',
  'protocol.powerlink.example.asndSdoReadByIndex.description':
    'SDO via ASnd: Sequence Layer bağlantı geçerli, Command Layer’ın CommandID’si ReadByIndex, Index 0x1006/Sub-index 0x00 alt başlıktan okunuyor.',
  'protocol.powerlink.example.asndSdoAbort.name': 'ASnd — SDO Abort',
  'protocol.powerlink.example.asndSdoAbort.description':
    'Abort biti set: Abort Code 0x06020000 = "Object does not exist in the object dictionary" — iki kaynağın kesiştiği tabloda adlandırılmış bir kod.',
  'protocol.powerlink.example.ainvAsyncInvite.name': 'AInv — asenkron davet',
  'protocol.powerlink.example.ainvAsyncInvite.description':
    'MessageType adlandırılmış (Asynchronous Invite) ama iki kaynak da bu tip için alan tablosu vermiyor — gövde ham gösterilir, nedeni uyarıyla söylenir.',
  'protocol.powerlink.example.etherTypeNotPowerlink.name': 'Yanlış EtherType',
  'protocol.powerlink.example.etherTypeNotPowerlink.description':
    'SoC örneğiyle aynı gövde, EtherType kasten 0x0800 (IPv4). MAC alanları çözülür ama MessageType’a bile dokunulmaz.',
  'protocol.powerlink.example.frameTooShort.name': 'Çok kısa çerçeve',
  'protocol.powerlink.example.frameTooShort.description':
    '12 bayt: Ethernet başlığı bile tamamlanmıyor — ParseFailure (kaydedilebilir, akış devam edebilir).',
  // --- SERCOS III ---
  'protocol.sercosIii.error.aborted': 'Çözümleme iptal edildi.',
  'protocol.sercosIii.error.etherTypeNotSercos':
    'EtherType 0x88CD değil — bu çerçeve Sercos III değildir; gövde çözülmedi, ham bırakıldı.',
  'protocol.sercosIii.error.frameTooLong': 'Çerçeve izin verilen azami uzunluğu aşıyor.',
  'protocol.sercosIii.error.frameTooShort':
    'Çerçeve, Ethernet başlığı (14 bayt) + Sercos başlığı (6 bayt) kadar uzun değil.',
  'protocol.sercosIii.error.headerTruncated':
    '6 baytlık Sercos başlığı (telgraf tipi + faz + CRC32) tamamlanmıyor.',
  'protocol.sercosIii.warning.cp34LayoutFromCp2':
    'CP3/CP4’te servis kanalı, cihaz durumu ve bağlantı ofsetleri ÇERÇEVEDE YAZMAZ — CP2 sırasında pazarlanan konfigürasyondan gelir; referans dissector da aynı yerde durur. Bölge tek parça ham gösteriliyor.',
  'protocol.sercosIii.warning.crc32NotVerified':
    'CRC32 GÖSTERİLİR, DOĞRULANMAZ: üretici polinomu tek kaynakta teyitli ama başlangıç değeri/son XOR ikinci bir kaynakta yok — yanlış parametreyle hesaplanmış bir "hatalı" rozeti hiç doğrulamamaktan daha kötü olurdu.',
  'protocol.sercosIii.warning.cycleCountInvalid':
    'Cycle Count Valid biti sıfır: sayaç değeri basılıyor ama bu durumda anlamsızdır.',
  'protocol.sercosIii.warning.cycleCountSingleSource':
    'Cycle Count alanı (bit 4-6) yalnız Wireshark’ta adlandırılıyor; ikinci kaynağın faz baytında bu sayaç yok.',
  'protocol.sercosIii.warning.detailedDeviceLimit':
    'Ayrıntılı çözüm 16 cihazla sınırlı — tam boy bir telgraf 128 cihaz taşıyabilir; ötesi tek parça ham gösteriliyor.',
  'protocol.sercosIii.warning.deviceListTruncated':
    'Cihaz kontrol/durum listesi 128 cihazın tamamını kapsamıyor — telgraf kesik ya da tam boy değil.',
  'protocol.sercosIii.warning.hotPlugBitsSingleSource':
    'Hot-Plug kontrol/durum kelimesinin bit adları yalnız Wireshark’ta var — kelime tek alan olarak, adlandırılmadan gösteriliyor.',
  'protocol.sercosIii.warning.paddingNotZero':
    'Bildirilen bölgeden sonraki baytlar sıfır değil — Ethernet dolgusu beklenirdi.',
  'protocol.sercosIii.warning.phaseNotNamed':
    'Communication Phase iki kaynakta da adlandırılmış CP0-CP4 kümesinde değil — gövde ham gösteriliyor.',
  'protocol.sercosIii.warning.recognizedDeviceListRaw':
    'CP0/AT0’ın tanınan cihaz listesi 511 girdilik sabit bir dizidir; tek tek basmak yerine bölge ham gösterilip yapısı söyleniyor.',
  'protocol.sercosIii.warning.svcInfoNeedsIdnDictionary':
    'Servis kanalı bilgi alanının anlamı DBE’ye (IDN/ad/öznitelik/birim/min/maks/işletim verisi) bağlıdır; IDN sayısal olarak okunur ama parametre adı cihaz tanımından gelir — sözlük bu motorun kapsamı dışında.',
  'protocol.sercosIii.warning.telegramNumberWidthConflict':
    'Telgraf numarasının genişliği konusunda kaynaklar ANLAŞMIYOR: Wireshark 4 bit (0-3), Sercos Soft Master 2 bit (0-1) okuyor. Numara ortak 2 bitten okunuyor, bit 2-3 ayrı bir alan olarak gösteriliyor.',
  'protocol.sercosIii.warning.versionFieldBitsSingleSource':
    'Communication Version alanının bit adları (fast CP switch, init procedure version …) yalnız Wireshark’ta var — değer hex olarak, bit bit kırılmadan gösteriliyor.',
  'protocol.sercosIii.summary.at': '{telegram} — {phase}',
  'protocol.sercosIii.summary.mdt': '{telegram} — {phase}',
  'protocol.sercosIii.summary.notSercos': 'Sercos III değil (EtherType {etherType})',
  'protocol.sercosIii.documentation.summary':
    'Sercos III (Sercos International / IEC 61158 & 61784-2 CPF 16): girdi TAM bir Ethernet çerçevesidir — DST/SRC MAC, opsiyonel VLAN tag’leri ve EtherType 0x88CD çözülür (ethercat.ts/profinet.ts/powerlink.ts ile aynı girdi sözleşmesi). 6 baytlık Sercos başlığı (telgraf tipi/kanal/MDT-AT ayrımı, haberleşme fazı CP0-CP4, faz geçiş biti, cycle count ve CRC32) tam çözülür. Telgraf numarasının genişliği konusunda iki kaynak ayrışıyor (Wireshark 4 bit, Sercos Soft Master 2 bit) — numara ortak 2 bitten okunur, kalan iki bit ayrı bir alan olarak gösterilir. CRC32 alanı GÖSTERİLİR ama DOĞRULANMAZ: algoritma parametreleri (başlangıç değeri, son XOR) tek kaynaklı. Faz-bağımlı gövdeler yapısı sabit olduğu ölçüde çözülür: CP0’ın sürüm alanı (MDT) ve tanınan cihaz listesi (AT), CP1/CP2’nin 128 cihazlık servis kanalı (6 bayt/cihaz, ayrıntı 16 cihazla sınırlı) ve C-DEV/S-DEV kontrol/durum kelimeleri (4 bayt/cihaz), CP3/CP4’ün ilk telgrafındaki 8 baytlık Hot-Plug alanı. CP3/CP4’ün geri kalanı (servis kanalı, cihaz durumu, bağlantı ofsetleri) ÇERÇEVEDE YAZMAZ — CP2’de pazarlanan konfigürasyondan gelir ve tek parça ham bırakılır; referans dissector da aynı sınırda durur. Alan yerleşimleri Wireshark’ın Sercos III dissector’ı ile Sercos Soft Master Core Library (SICE+CoSeMa) arasında çapraz teyitlidir. UCC, Sercos I/II, SIP ve IDN sözlüğü kapsam dışıdır.',
  'protocol.sercosIii.example.mdt0Cp4Operational.name':
    'MDT0 — CP4 (operasyonel faz), Hot-Plug alanı',
  'protocol.sercosIii.example.mdt0Cp4Operational.description':
    'Master Data Telegram 0, CP4’te (operasyonel): 8 baytlık Hot-Plug alanı (Sercos adresi + kontrol/durum kelimesi + bilgi) çözülür, gerisi CP2’den pazarlanan konfigürasyona bağlı olduğu için ham kalır.',
  'protocol.sercosIii.example.at0Cp4Operational.name':
    'AT0 — CP4 (operasyonel faz), Hot-Plug alanı',
  'protocol.sercosIii.example.at0Cp4Operational.description':
    'Aynı yapının AT (cihazdan gelen) tarafı: AT biti set, Hot-Plug durum kelimesi gösterilir.',
  'protocol.sercosIii.example.mdt0Cp0CommunicationVersion.name':
    'MDT0 — CP0, Communication Version',
  'protocol.sercosIii.example.mdt0Cp0CommunicationVersion.description':
    'CP0’da MDT gövdesi 4 baytlık Communication Version alanından ibarettir; bit adları yalnız Wireshark’ta olduğu için değer hex gösterilir, bit bit kırılmaz.',
  'protocol.sercosIii.example.at0Cp0RecognizedDevices.name':
    'AT0 — CP0, tanınan cihaz listesi',
  'protocol.sercosIii.example.at0Cp0RecognizedDevices.description':
    'CP0’da AT gövdesi sıra sayacı (3 tanınan cihaz) ve 511 girdilik sabit bir Sercos adresi listesi taşır; liste tek parça ham gösterilir.',
  'protocol.sercosIii.example.mdt0Cp2ServiceChannel.name':
    'MDT0 — CP2, servis kanalı (tam boy telgraf)',
  'protocol.sercosIii.example.mdt0Cp2ServiceChannel.description':
    '14+6+768+512 = 1300 baytlık tam boy CP2 telgrafı: ilk üç cihazın servis kanalı kelimesi (MHS/Read-Write/EOT/DBE) ve C-DEV kontrol kelimesi ayrı ayrı çözülür, ayrıntı 16 cihazla sınırlı olduğu için gerisi ham gösterilir.',
  'protocol.sercosIii.example.at1Cp2SecondDeviceGroup.name':
    'AT1 — CP2, ikinci cihaz grubu',
  'protocol.sercosIii.example.at1Cp2SecondDeviceGroup.description':
    'Telgraf numarası 1: cihaz indeksleri 128’den başlar. Servis kanalı durum kelimesi (AHS/Idle-Busy/Error/Process) ve S-DEV durum kelimesi çözülür.',
  'protocol.sercosIii.example.mdt0Cp3PhaseSwitching.name': 'MDT0 — CP3, faz geçişi',
  'protocol.sercosIii.example.mdt0Cp3PhaseSwitching.description':
    'Faz baytında geçiş biti (bit 7) set — cihaz CP3’ten bir sonraki faza geçiyor; Hot-Plug alanı yine çözülür.',
  'protocol.sercosIii.example.mdtSecondaryChannel.name':
    'MDT — S-Telegram (ikincil port), cycle count geçersiz',
  'protocol.sercosIii.example.mdtSecondaryChannel.description':
    'Kanal biti set (ikincil port üzerinden gönderilen telgraf) ve Cycle Count Valid biti sıfır — sayaç değeri basılır ama geçersiz olduğu ayrıca söylenir.',
  'protocol.sercosIii.example.telegramNumberExtendedBits.name':
    'Telgraf numarası — bit 2-3 çakışması',
  'protocol.sercosIii.example.telegramNumberExtendedBits.description':
    'Bit 2-3 set: Wireshark bunları numaraya katar, Sercos Soft Master katmaz. İki kaynak ANLAŞMADIĞI için bu bitler ayrı bir alan olarak gösterilir, ana numara yalnız bit 0-1’den okunur.',
  'protocol.sercosIii.example.unknownPhase.name': 'Adı olmayan haberleşme fazı',
  'protocol.sercosIii.example.unknownPhase.description':
    'Faz alanı 7: iki kaynakta da CP0-CP4 dışında bir adı yok — gövde ham gösterilir, nedeni uyarıyla söylenir.',
  'protocol.sercosIii.example.etherTypeNotSercos.name': 'Yanlış EtherType',
  'protocol.sercosIii.example.etherTypeNotSercos.description':
    'CP4 örneğiyle aynı gövde, EtherType kasten 0x0800 (IPv4). MAC alanları çözülür ama Sercos başlığına bile dokunulmaz.',
  'protocol.sercosIii.example.frameTooShort.name': 'Çok kısa çerçeve',
  'protocol.sercosIii.example.frameTooShort.description':
    '16 bayt: Ethernet başlığı var ama 6 baytlık Sercos başlığı tamamlanmıyor — ParseFailure (kaydedilebilir, akış devam edebilir).',
  // --- CC-LINK IE ---
  'protocol.ccLinkIe.error.aborted': 'Çözümleme iptal edildi.',
  'protocol.ccLinkIe.error.etherTypeNotCcLinkIe':
    'EtherType 0x890F değil — bu çerçeve CC-Link IE değildir; gövde çözülmedi, ham bırakıldı.',
  'protocol.ccLinkIe.error.frameTooLong': 'Çerçeve izin verilen azami uzunluğu aşıyor.',
  'protocol.ccLinkIe.error.frameTooShort':
    'Çerçeve, Ethernet başlığı (14 bayt) + en kısa CC-Link IE başlığı (2 bayt) kadar uzun değil.',
  'protocol.ccLinkIe.error.headerTruncated':
    'Çerçeve tipinin gerektirdiği CC-Link IE başlığı tamamlanmıyor.',
  'protocol.ccLinkIe.warning.hecNotVerified':
    'HEC GÖSTERİLİR, DOĞRULANMAZ: 4 baytlık başlık sağlama alanının algoritması hiçbir kamuya açık kaynakta yok — iki referans ayrıştırıcı da alanı yalnız gösteriyor. Yanlış parametreyle hesaplanmış bir "HEC hatalı" rozeti hiç doğrulamamaktan daha kötü olurdu.',
  'protocol.ccLinkIe.warning.middleFieldsSingleSource':
    'Başlığın 2.-5. baytlarının bu çerçeve tipine özel kırılımı TEK KAYNAKLIDIR (NTT Communications’ın Zeek ayrıştırıcısı); CLPA’nın kendi dissector’ı bu tipi kapsamıyor. Alanlar adlandırılıp çözülüyor ama teyit tek kaynaktan.',
  'protocol.ccLinkIe.warning.frameTypeNotNamed':
    'Çerçeve tipi iki kaynağın da adlandırdığı kümede değil — gövdeye dokunulmadı, ham gösteriliyor.',
  'protocol.ccLinkIe.warning.cyclicLayoutFromNetworkParameters':
    'Döngüsel gövdenin hangi baytı hangi istasyonun hangi link cihazına (RX/RY/RWr/RWw) düştüğü ÇERÇEVEDE YAZMAZ — ağ parametresinden (CSP+ / ağ ayarı) gelir. Bölge tek parça ham gösteriliyor; her iki referans ayrıştırıcı da aynı yerde duruyor.',
  'protocol.ccLinkIe.warning.transientPayloadRaw':
    'Transient gövdesinin yapısı bağlantı tipine ve komut kataloğuna bağlıdır; kamuya açık kaynak yalnız başlığı veriyor — gövde ham gösteriliyor.',
  'protocol.ccLinkIe.warning.protocolTypeReserved':
    'protocolType nibble’ı adlandırılmış kümede değil (0=Control, 1=Field, 3=TSN) — ağ tipi çerçeveden belirlenemedi.',
  'protocol.ccLinkIe.warning.fieldBasicNotOnThisWire':
    'EtherType 0x0800 (IPv4): CC-Link IE Field Basic BU TELDE GELMEZ — standart IPv4/UDP üstünde SLMP’dir (master 61450, cihaz 61451) ve bu motorun girdi sözleşmesiyle kesişmez.',
  'protocol.ccLinkIe.warning.slmpEnvelopeOnly':
    'SLMP’nin yalnız ZARFI (subheader → subcommand) çözülür; komuta özel istek/cevap verisi ham bırakılır — komut kataloğu bu motorun kapsamı dışında.',
  'protocol.ccLinkIe.warning.slmpSubheaderUnknown':
    'Transient gövdesi 0x5000 (istek) ya da 0xD000 (cevap) subheader’ıyla başlamıyor — SLMP zarfı olarak çözülmedi, ham gösteriliyor.',
  'protocol.ccLinkIe.warning.tsnDetectionBodyRaw':
    'TSN Detection/DetectionAck gövdesinin alan kırılımı iki kaynakta ortaklaşmıyor — bölge ham gösteriliyor.',
  'protocol.ccLinkIe.warning.paddingNotZero':
    'Bildirilen bölgeden sonraki baytlar sıfır değil — Ethernet dolgusu beklenirdi.',
  'protocol.ccLinkIe.summary.frame': '{frameType}',
  'protocol.ccLinkIe.summary.notCcLinkIe': 'CC-Link IE değil (EtherType {etherType})',
  'protocol.ccLinkIe.documentation.summary':
    'CC-Link IE (CLPA): girdi TAM bir Ethernet çerçevesidir — DST/SRC MAC, opsiyonel VLAN tag’leri ve EtherType 0x890F çözülür (ethercat.ts/profinet.ts/powerlink.ts/sercosIii.ts ile aynı girdi sözleşmesi). Çerçeve tipi (arFType) adlandırılır ve tipe göre başlık çözülür: CC-Link IE Field ve Control çerçevelerinde 14 baytlık ortak başlık (dataType/priority, tipe özel dört bayt, srcNodeNumber, protocolVerType, HEC), TSN çerçevelerinde tipe göre 2/6/10/14 baytlık başlık (cyclicNo ve kontrol bayrağı, sa/da, HEC). protocolVerType baytının iki nibble’ı ağ tipini SÖYLER (Control / Field / TSN) — spec’in "analyzer önce network type belirlemeli" maddesinin çerçevedeki cevabı budur, bu yüzden ayrı bir seçenek kanalı açılmadı. TSN acyclicData (0xC3) gövdesindeki SLMP 3E zarfı (subheader, ağ/istasyon/modül I/O/multidrop numaraları, veri uzunluğu, izleme zamanlayıcısı, komut ve alt komut ya da end code) da çözülür. HEC alanı GÖSTERİLİR ama DOĞRULANMAZ: algoritması kamuya açık değil. Döngüsel gövde HAM bırakılır — hangi baytın hangi istasyonun hangi link cihazına düştüğü çerçevede değil ağ parametresinde yazar. CC-Link IE Field Basic KAPSAM DIŞIDIR: 0x890F altında değil, IPv4/UDP üstünde SLMP olarak gelir. Alan yerleşimleri CLPA’nın kendi yayımladığı CC-Link IE TSN Wireshark dissector’ı ile NTT Communications’ın Zeek/Spicy ayrıştırıcısı arasında çapraz teyitlidir; EtherType IEEE kayıt defterinden doğrulanmıştır.',
  'protocol.ccLinkIe.example.fieldTokenM.name': 'Field — TokenM (token geçişi)',
  'protocol.ccLinkIe.example.fieldTokenM.description':
    'CC-Link IE Field’ın token geçiş çerçevesi: nodeId, srcNodeNumber ve protocolVerType 0x01 (protocolVer 0 = tek master, protocolType 1 = Field) çözülür; HEC gösterilir ama doğrulanmaz.',
  'protocol.ccLinkIe.example.fieldMyStatus.name': 'Field — MyStatus (istasyon durumu)',
  'protocol.ccLinkIe.example.fieldMyStatus.description':
    'MyStatus’ta orta dört bayt nodeId + syncFlag + nodeType olarak kırılır; protocolVerType 0x11 → protocolVer 1 (çok master), protocolType 1 (Field).',
  'protocol.ccLinkIe.example.fieldCyclicDataRwr.name': 'Field — CyclicDataRWr (döngüsel veri)',
  'protocol.ccLinkIe.example.fieldCyclicDataRwr.description':
    'Döngüsel çerçevede başlık tam çözülür ama 32 baytlık gövde TEK PARÇA ham kalır: link cihazı haritası çerçevede değil ağ parametresinde yazar.',
  'protocol.ccLinkIe.example.fieldTransient1.name': 'Field — Transient1 (transient iletim)',
  'protocol.ccLinkIe.example.fieldTransient1.description':
    'Transient çerçevesinde nodeId + connectionInfo çözülür; transient gövdesinin yapısı bağlantı tipine bağlı olduğu için ham gösterilir.',
  'protocol.ccLinkIe.example.fieldTestData.name': 'Field — TestData (iki kaynakta teyitli tip)',
  'protocol.ccLinkIe.example.fieldTestData.description':
    'TestData, CLPA’nın kendi dissector’ının da kırılımını verdiği iki tipten biri: persPriority + nodeType iki kaynakta birebir aynı ofsette — bu yüzden "tek kaynaklı" uyarısı BASILMAZ.',
  'protocol.ccLinkIe.example.controlToken.name': 'Control — Token',
  'protocol.ccLinkIe.example.controlToken.description':
    'CC-Link IE Control çerçevesinde ikinci bayt priority, orta alan scanNumber’dır ve 8.-9. baytlar protocolVerType DEĞİL ayrılmış alandır — Field ile aynı iskelet, farklı adlar.',
  'protocol.ccLinkIe.example.tsnCyclicMs.name': 'TSN — Cyclic M/Ms (10 baytlık başlık)',
  'protocol.ccLinkIe.example.tsnCyclicMs.description':
    'TSN döngüsel çerçevesi: cyclicNo (bit 0-6) ve cyclicNoCheckFlag (bit 7) ayrı ayrı çözülür, sa alanı kaynak istasyonu verir, HEC 6. bayttan başlar.',
  'protocol.ccLinkIe.example.tsnCyclicSsCheckDisabled.name':
    'TSN — Cyclic S/Ss, döngü numarası kontrolü kapalı',
  'protocol.ccLinkIe.example.tsnCyclicSsCheckDisabled.description':
    'Bit 7 set: cyclicNoCheckFlag = disable, döngü numarası 7. Cihazdan gelen yönde alan sa değil da’dır.',
  'protocol.ccLinkIe.example.tsnAcyclicDataSlmp.name': 'TSN — AcyclicData, içinde SLMP 3E isteği',
  'protocol.ccLinkIe.example.tsnAcyclicDataSlmp.description':
    '6 baytlık TSN acyclicData başlığından sonra SLMP zarfı gelir: subheader 0x5000 (istek), izleme zamanlayıcısı 16 × 250 ms, komut 0x0401 / alt komut 0x0000. Komut verisi ham kalır.',
  'protocol.ccLinkIe.example.tsnAcyclicDetection.name': 'TSN — Detection (2 baytlık başlık)',
  'protocol.ccLinkIe.example.tsnAcyclicDetection.description':
    'Detection çerçevesinde başlık yalnız iki bayttır (çerçeve tipi + ayrılmış); gövdenin alan kırılımı iki kaynakta ortaklaşmadığı için ham gösterilir.',
  'protocol.ccLinkIe.example.unknownFrameType.name': 'Adı olmayan çerçeve tipi',
  'protocol.ccLinkIe.example.unknownFrameType.description':
    'Çerçeve tipi 0x77: iki kaynakta da adlandırılmamış — başlık boyu bile bilinmediği için gövdeye DOKUNULMAZ, tek parça ham gösterilir.',
  'protocol.ccLinkIe.example.etherTypeIpv4FieldBasic.name':
    'EtherType 0x0800 — CC-Link IE Field Basic bu telde gelmez',
  'protocol.ccLinkIe.example.etherTypeIpv4FieldBasic.description':
    'IPv4 çerçevesi: MAC alanları çözülür ama CC-Link IE başlığına dokunulmaz. Field Basic IPv4/UDP üstünde SLMP olarak gelir ve bu motorun kapsamında değildir — uyarı bunu açıkça söyler.',
  'protocol.ccLinkIe.example.frameTooShort.name': 'Çok kısa çerçeve',
  'protocol.ccLinkIe.example.frameTooShort.description':
    '20 bayt: EtherType 0x890F ve TokenM çerçeve tipi var ama başlığın gerektirdiği 14 bayttan yalnız 6’sı kaldı — kesik başlık hatası.',
  // --- CC-LINK (KLASİK) ---
  'protocol.ccLink.error.aborted': 'Çözümleme iptal edildi.',
  'protocol.ccLink.error.emptyInput': 'Girdi boş — çözülecek link cihazı görüntüsü yok.',
  'protocol.ccLink.error.frameTooLong': 'Girdi izin verilen azami uzunluğu aşıyor.',
  'protocol.ccLink.error.imageTruncated':
    'Girdi, seçilen konfigürasyonun (işgal edilen istasyon sayısı × genişletilmiş çevrim ayarı) gerektirdiği bayt sayısından kısa — görüntü kesik.',
  'protocol.ccLink.warning.linkLayerNotPublic':
    'ÇÖZÜLEN ŞEY RS-485 TELGRAFI DEĞİL, döngüsel link cihazı görüntüsüdür. CC-Link’in veri bağı telgraf biçimi (sınırlayıcılar, adres alanı, FCS) hiçbir kamuya açık kaynakta yok: Wireshark’ta dissector yok, CLPA spec’i üyelik arkasında. Tahmin edilmiş bir alan tablosu basmak yerine bu katman bilinçli olarak kapsam dışı bırakıldı.',
  'protocol.ccLink.warning.wordOrderAssumption':
    'Kelimeler LITTLE-ENDIAN okunuyor (Mitsubishi tampon belleği kuralı: alt bayt önce, RX0000 = ilk baytın en düşük anlamlı biti). Dışa aktarma aracınız kelimeleri ters sırada yazıyorsa değerler ters çıkar.',
  'protocol.ccLink.warning.pointMeaningFromDeviceProfile':
    'Nokta ADLANDIRILIR ama ANLAMLANDIRILMAZ: RX0000’ın "hazır", RWw2’nin "ayar değeri" demek olup olmadığı cihazın CSP+ dosyasından/kılavuzundan gelir, veriden değil.',
  'protocol.ccLink.warning.detailLimit':
    'Ayrıntılı çözüm alan başına 32 kelimeyle sınırlı — en büyük konfigürasyon (4 istasyon × ×8) 56 bit kelimesi ve 128 yazmaç üretir; ötesi tek parça ham gösteriliyor.',
  'protocol.ccLink.warning.trailingBytes':
    'Beklenen görüntüden sonra fazladan bayt var — uydurulmuş bir alan üretilmedi, bölge ham gösteriliyor. Konfigürasyon seçenekleri gerçek istasyonla eşleşmiyor olabilir.',
  'protocol.ccLink.warning.extendedCyclicIsVer2':
    '×1 dışındaki genişletilmiş çevrim ayarları yalnız CC-Link Ver.2’de vardır; Ver.1 uyumlu bir istasyonda ayar ×1’dir.',
  'protocol.ccLink.summary.image':
    '{area} — {stations} istasyon işgal, {multiplier} ({bitPoints} bit, {wordPoints} yazmaç)',
  'protocol.ccLink.option.direction': 'Yön',
  'protocol.ccLink.option.direction.description':
    'Aynı baytlar master→slave yönünde RY+RWw, slave→master yönünde RX+RWr’dir; görüntünün kendisi yönü söylemez.',
  'protocol.ccLink.option.direction.slaveToMaster': 'Slave → Master (RX + RWr)',
  'protocol.ccLink.option.direction.masterToSlave': 'Master → Slave (RY + RWw)',
  'protocol.ccLink.option.occupiedStations': 'İşgal edilen istasyon',
  'protocol.ccLink.option.occupiedStations.description':
    'Bir slave’in ağda kapladığı istasyon sayısı (1-4). Ağ parametresinde ayarlanır, baytların içinde yazmaz.',
  'protocol.ccLink.option.extendedCyclic': 'Genişletilmiş çevrim',
  'protocol.ccLink.option.extendedCyclic.description':
    'CC-Link Ver.2 çarpanı; nokta sayılarını belirler. ×1 aynı zamanda Ver.1 uyumlu istasyonun ayarıdır.',
  'protocol.ccLink.option.extendedCyclic.x1': '×1 (Ver.1 uyumlu)',
  'protocol.ccLink.option.extendedCyclic.x2': '×2',
  'protocol.ccLink.option.extendedCyclic.x4': '×4',
  'protocol.ccLink.option.extendedCyclic.x8': '×8',
  'protocol.ccLink.documentation.summary':
    'CC-Link (klasik, CLPA): RS-485 üstünde ≤10 Mbit/s, ≤64 istasyon, ≤1200 m master/slave fabrika otomasyonu veri yolu. BU MOTOR TELGRAFI ÇÖZMEZ — CC-Link’in veri bağı çerçeve biçimi hiçbir kamuya açık kaynakta belgelenmemiştir (Wireshark’ta dissector yok, CLPA spec paketi üyelik arkasında) ve tahmin edilmiş bir alan tablosu ham bloktan çok daha kötü olurdu. Çözülen şey protokolün kullanıcıya görünen yüzüdür: tek bir slave istasyonun DÖNGÜSEL LINK CİHAZI GÖRÜNTÜSÜ — önce bit alanı (uzak giriş RX ya da uzak çıkış RY), sonra yazmaç alanı (RWr ya da RWw). Nokta sayıları işgal edilen istasyon sayısı (1-4) ile genişletilmiş çevrim ayarından (×1/×2/×4/×8) gelir ve bu 4×4’lük link nokta tablosu iki bağımsız belgede teyitlidir: Pro-face’in CC-Link Intelligent Device Driver kılavuzundaki bağlanabilir birim formülleri ve Mitsubishi EMU4-VA2 CC-Link programlama kılavuzunun bir satırı. Bit noktaları 16’lık kelimeler hâlinde onaltılık indekslerle adlandırılır (RX0000, RX0011 …), yazmaçlar 16-bit little-endian okunur. Yön, işgal edilen istasyon sayısı ve çevrim çarpanı baytların İÇİNDE OLMADIĞI için seçenek olarak sorulur. Nokta adları verilir ama anlamları verilmez — onlar cihazın CSP+ dosyasından gelir. Transient iletim, cihaz profili anlamı ve ağ genelindeki adres eşlemesi kapsam dışıdır.',
  'protocol.ccLink.example.remoteDeviceTypical.name': 'Uzak cihaz istasyonu — tipik görüntü',
  'protocol.ccLink.example.remoteDeviceTypical.description':
    'Varsayılan konfigürasyon (slave→master, 1 istasyon, ×1): 32 bit RX + 4 RWr yazmaç = 12 bayt. RX0000, RX0002 ve RX0011 açık; RWr0 = 250, RWr1 = 0x1234.',
  'protocol.ccLink.example.remoteDeviceAllOff.name': 'Tüm noktalar kapalı',
  'protocol.ccLink.example.remoteDeviceAllOff.description':
    'Sıfırlanmış bir görüntü: her bit kelimesi "—" ile gösterilir, yazmaçlar 0x0000.',
  'protocol.ccLink.example.remoteDeviceAllOn.name': 'Tüm noktalar açık',
  'protocol.ccLink.example.remoteDeviceAllOn.description':
    'Bütün baytlar 0xFF: her kelimede 16 nokta adıyla listelenir, yazmaçlar 0xFFFF.',
  'protocol.ccLink.example.imageTruncated.name': 'Kesik görüntü',
  'protocol.ccLink.example.imageTruncated.description':
    '8 bayt: varsayılan konfigürasyon 12 bayt bekler. Eksik kısım uydurulmaz, kesik görüntü hatası basılır.',
  'protocol.ccLink.example.imageTrailingBytes.name': 'Fazladan bayt',
  'protocol.ccLink.example.imageTrailingBytes.description':
    '16 bayt: 12’si beklenen görüntü, 4’ü fazla. Fazlalık için sahte bir alan üretilmez — ham blok olarak gösterilip konfigürasyonun eşleşmiyor olabileceği söylenir.',
  // --- AS-INTERFACE (KLASIK) ---
  'protocol.asInterface.error.aborted': 'Çözümleme iptal edildi.',
  'protocol.asInterface.error.frameTooLong': 'Girdi izin verilen azami uzunluğu aşıyor.',
  'protocol.asInterface.error.unsupportedLength':
    'AS-i çerçevesi ya 2 bayttır (14 bitlik master çağrısı, sağa dayalı) ya da 1 bayt (7 bitlik slave yanıtı, sağa dayalı) — başka uzunluk bu sözleşmenin dışındadır.',
  'protocol.asInterface.error.startBitNotZero':
    'Başlangıç biti (ST) 1 — AS-i’de ST her zaman "0"dır; bu bir AS-i çerçevesi değil ya da hizalama kaymış.',
  'protocol.asInterface.error.parityMismatch':
    'Çift parite tutmuyor: başlangıç ve bitiş bitleri hariç, parite biti dâhil bitlerin toplamı ÇIFT olmalıdır (AS-Interface Complete Specification kuralı).',
  'protocol.asInterface.warning.classicAsiOnly':
    'Çözülen nesil KLASIK AS-i’dir (14 bit master çağrısı / 7 bit slave yanıtı). ASi-5 KAPSAM DIŞIDIR — OFDM tabanlı, tamamen farklı bir katmandır ve tel biçimi kamuya açık değildir; ASi-5 baytlarını buraya vermeyin.',
  'protocol.asInterface.warning.endBitNotOne':
    'Bitiş biti (EB) 0 — AS-i’de EB her zaman "1"dir; çerçeve eksik ya da hizalama kaymış olabilir.',
  'protocol.asInterface.warning.paddingBitsNotZero':
    'Sağa dayalı gösterimde kullanılmayan üst bitler sıfır değil — girdi 14/7 bitlik çerçeveyi doğru hizalamıyor olabilir.',
  'protocol.asInterface.warning.selectBitPolarityUnconfirmed':
    'I3 biti genişletilmiş adreslemede (A/B slave) seçim bilgisi taşır ama POLARITESI teyitli değil: aynı belgenin tablosu bu hücreyi "~Sel", hemen ardındaki şeması "Sel" olarak veriyor. Bit gösterilir, "A-slave mı B-slave mı" IDDIA EDILMEZ. Ayrıca tek bir çerçeve slave’in standart mı A/B mi olduğunu söylemez.',
  'protocol.asInterface.warning.responseMeaningNeedsRequest':
    'Slave yanıtının 4 biti tek başına anlamsızdır: giriş verisi mi, ID kodu mu, I/O konfigürasyonu mu yoksa durum mu olduğu ÖNCEKI master çağrısından gelir. Çok çerçeveli eşleştirme parser’ın değil analyzer’ın işidir — bitler ham gösteriliyor.',
  'protocol.asInterface.warning.callNotNamed':
    'Bilgi alanının bu bileşimi kaynak tabloda adlandırılmamış (ya da "reserved") — komut ADLANDIRILMADI, ham ikilik değer gösteriliyor.',
  'protocol.asInterface.warning.addressZeroIsUnconfigured':
    'Adres 0, henüz adreslenmemiş slave’i gösterir; bu adreste bilgi alanı veri değil yeni adres ya da genişletilmiş ID kodu taşır.',
  'protocol.asInterface.summary.masterRequest': 'Master → {address}: {call}',
  'protocol.asInterface.summary.slaveResponse': 'Slave yanıtı: {data}',
  'protocol.asInterface.documentation.summary':
    'AS-Interface (AS-i, IEC 62026-2 / EN 50295): sensör-aktüatör seviyesinde, veriyi ve gücü aynı iki telden taşıyan master/slave ağı. Bu motor KLASIK AS-i’yi çözer — ASi-5 (OFDM) kapsam dışıdır ve her çözümde bu söylenir. Girdi sözleşmesi: 2 bayt = 14 bitlik master çağrısı (16 bitlik big-endian değerin sağa dayalı hâli), 1 bayt = 7 bitlik slave yanıtı. Master çağrısında başlangıç biti (ST=0), kontrol biti (SB: 0 veri/parametre, 1 komut), 5 bitlik slave adresi, 5 bitlik bilgi alanı, parite ve bitiş biti (EB=1) ayrı ayrı çözülür. Bilgi alanının kırılımı çağrı tipine bağlıdır: SB=0 ve I4=0 → çıkış verisi D3-D0, SB=0 ve I4=1 → parametre P3-P0, adres 0 ve SB=0 → yeni slave adresi, SB=1 → komut (Read I/O Configuration, Read ID Code, Read ID Code_1/_2, Reset Slave, Read Status, Delete Address, Write Extended ID Code_1, Broadcast Reset, Enter Program Mode). Çift parite GERÇEKTEN hesaplanır ve uyuşmazlıkta hata basılır: kural, başlangıç ve bitiş bitleri hariç parite biti dâhil bit toplamının çift olmasıdır. Genişletilmiş adreslemenin seçim biti (I3) gösterilir ama polaritesi kaynaklarda çeliştiği için A/B slave iddiası yapılmaz. Slave yanıtının anlamı önceki çağrıya bağlı olduğu için bitler ham gösterilir. Alan yerleşimi AS-International Association’ın sitesinde yayımlanan ASI4U datasheet’inin Table 3.2’si ile bağımsız bir üretici kılavuzunun telgraf yapısı arasında çapraz teyitlidir.',
  'protocol.asInterface.example.dataExchangeRequest.name': 'Veri çağrısı (Data Exchange)',
  'protocol.asInterface.example.dataExchangeRequest.description':
    'SB=0 ve I4=0 → veri çağrısı: adres 5’e 0b1010 çıkış verisi. I3 biti hem D3 hem seçim biti olabileceği için ayrı bir alan olarak gösterilir.',
  'protocol.asInterface.example.dataExchangeResponse.name': 'Slave yanıtı (7 bit)',
  'protocol.asInterface.example.dataExchangeResponse.description':
    'Tek bayt: ST=0, dört bilgi biti (0b0011), parite ve EB=1. Bitlerin ANLAMI önceki çağrıdan gelir — burada söylenmez.',
  'protocol.asInterface.example.writeParameterRequest.name': 'Parametre çağrısı (Write Parameter)',
  'protocol.asInterface.example.writeParameterRequest.description':
    'SB=0 ve I4=1 → parametre çağrısı: adres 12’ye 0b0110 parametre biti.',
  'protocol.asInterface.example.addressAssignment.name': 'Adres atama (Address Assignment)',
  'protocol.asInterface.example.addressAssignment.description':
    'Adres alanı 0 (adreslenmemiş slave) ve SB=0: bilgi alanı veri değil YENI ADRESi taşır (burada 7).',
  'protocol.asInterface.example.readIoConfiguration.name': 'Read I/O Configuration',
  'protocol.asInterface.example.readIoConfiguration.description':
    'SB=1, I4=1, I2 I1 I0 = 000 → slave’in I/O konfigürasyonu okunur.',
  'protocol.asInterface.example.readIdCode.name': 'Read ID Code',
  'protocol.asInterface.example.readIdCode.description':
    'SB=1, I4=1, I2 I1 I0 = 001 → slave fabrikada yazılmış kimlik kodunu döner.',
  'protocol.asInterface.example.resetSlave.name': 'Reset Slave',
  'protocol.asInterface.example.resetSlave.description':
    'SB=1, I4=1, I2 I1 I0 = 100 → adreslenmiş slave sıfırlanır.',
  'protocol.asInterface.example.readStatus.name': 'Read Status',
  'protocol.asInterface.example.readStatus.description':
    'SB=1, I4=1, I2 I1 I0 = 110 → durum bitleri okunur; bitlerin anlamı profil tablosundan gelir, burada adlandırılmaz.',
  'protocol.asInterface.example.deleteAddress.name': 'Delete Address',
  'protocol.asInterface.example.deleteAddress.description':
    'SB=1, I4=0, I2 I1 I0 = 000 → slave’in adresi 0’a çekilir. Aynı kod adres 0’da Write Extended ID Code_1 anlamına gelir.',
  'protocol.asInterface.example.broadcastReset.name': 'Broadcast (Reset)',
  'protocol.asInterface.example.broadcastReset.description':
    'Adres 11111 + SB=1 + bilgi alanı 10101: bütün slave’lere yayın, yanıt beklenmez.',
  'protocol.asInterface.example.unnamedCommand.name': 'Adı olmayan komut',
  'protocol.asInterface.example.unnamedCommand.description':
    'I2 I1 I0 = 111: kaynak şemasında "reserved". Komut UYDURULMAZ, ham ikilik değer gösterilir ve nedeni uyarıyla söylenir.',
  'protocol.asInterface.example.parityError.name': 'Parite hatası',
  'protocol.asInterface.example.parityError.description':
    'Veri çağrısının parite biti bilerek ters çevrildi: çift parite tutmaz ve çerçeve düzeyinde hata basılır — bu doğrulama gerçekten yapılıyor.',
  'protocol.asInterface.example.startBitError.name': 'Başlangıç biti hatası',
  'protocol.asInterface.example.startBitError.description':
    'ST=1: AS-i’de başlangıç biti her zaman "0"dır. Çerçeve reddedilir, alanlar yine de gösterilir.',
  'protocol.asInterface.example.endBitError.name': 'Bitiş biti hatası',
  'protocol.asInterface.example.endBitError.description':
    'EB=0: bitiş biti her zaman "1" olmalı. Bu bir uyarıdır, hata değil — parite tuttuğu için çerçeve okunabilir kalır.',
  // --- FOUNDATION FIELDBUS (HSE) ---
  'protocol.foundationFieldbus.error.aborted': 'Çözümleme iptal edildi.',
  'protocol.foundationFieldbus.error.frameTooLong': 'Girdi izin verilen azami uzunluğu aşıyor.',
  'protocol.foundationFieldbus.error.frameTooShort':
    'Girdi 12 baytlık FDA mesaj başlığı kadar uzun değil.',
  'protocol.foundationFieldbus.error.messageLengthMismatch':
    'Başlıkta bildirilen mesaj uzunluğu girdinin uzunluğuyla eşleşmiyor — mesaj kesik, birden çok mesaj yapıştırılmış ya da taşıyıcı baytları da girdiye karışmış olabilir.',
  'protocol.foundationFieldbus.warning.layoutSingleSource':
    'Alan yerleşimi TEK KAYNAKLIDIR: yalnız Wireshark’ın FF-HSE dissector’ı (packet-ff.c, FF-588-1.3 §6’yı kaynak gösteriyor ve bir FF üyesi firmanın mühendisi tarafından yazılmış). İkinci bir bağımsız kamuya açık kaynak bulunamadı; bulunan iki aday da uydurma çıktığı için kullanılmadı. IANA port kayıtları yalnız dört alt protokolün (FDA/SM/FMS/LAN Redundancy) varlığını bağımsız doğruluyor, bayt ofsetlerini değil.',
  'protocol.foundationFieldbus.warning.h1NotDecoded':
    'ÇÖZÜLEN KATMAN HSE’dir, H1 DEĞİL. H1’in veri bağı çerçevesi ücretli standartta (IEC 61158-2 / FF-816) tanımlıdır ve başlangıç/bitiş sınırlayıcıları Manchester kuralını bilerek ihlal eden N+/N− sembolleridir — bayt olarak temsil edilemezler, bu panelin girdisiyle çözülemez.',
  'protocol.foundationFieldbus.warning.bodyRaw':
    'Servise özel parametreler ve kullanıcı verisi HAM bırakıldı: bu bölge servise göre onlarca farklı yapı alır ve hepsi tek kaynaklıdır. Uydurulmuş bir kırılım yerine tek parça gösteriliyor.',
  'protocol.foundationFieldbus.warning.protocolIdNotNamed':
    'Protokol kimliği adlandırılmış kümede değil (FDA Session Management, SM, FMS, LAN Redundancy) — ham değer gösteriliyor.',
  'protocol.foundationFieldbus.warning.serviceNotNamed':
    'Servis kimliği bu protokol ve onaylı/onaysız bileşimi için kaynak tabloda yok — servis ADLANDIRILMADI, ham değer gösteriliyor.',
  'protocol.foundationFieldbus.warning.reservedOptionSet':
    'Seçenek baytının ayrılmış biti (bit 4) set — kaynak bu bit için bir anlam vermiyor.',
  'protocol.foundationFieldbus.warning.trailerTruncated':
    'Seçenek bayrakları bildirilen mesaja sığmayan bir trailer istiyor — trailer çözülmedi, alanlar uydurulmadı.',
  'protocol.foundationFieldbus.warning.trailingBytes':
    'Mesajın sonundan sonra fazladan bayt var — girdide birden çok FDA mesajı ya da taşıyıcıdan artan baytlar olabilir; bölge ham gösteriliyor.',
  'protocol.foundationFieldbus.summary.message': '{protocol} — {service}',
  'protocol.foundationFieldbus.documentation.summary':
    'FOUNDATION Fieldbus (FieldComm Group): proses otomasyonu dijital veri yolu; H1 (31.25 kbit/s publisher/subscriber segmenti) ve HSE (100 Mbit/s Ethernet omurgası) AYRI katmanlardır. Bu motor HSE’yi çözer, H1’i çözmez. Girdi, TCP ya da UDP yükünün içindeki tek bir FDA mesajıdır (1089/1090/1091 portları) — Ethernet/IP/TCP başlıkları girdiye dâhil değildir, çünkü FF-HSE ham Ethernet değil normal bir TCP/UDP uygulamasıdır. 12 baytlık FDA mesaj başlığı tam çözülür: sürüm, seçenek bayrakları (mesaj numarası / invoke id / zaman damgası / genişletilmiş kontrol alanı ve dolgu uzunluğu), protokol kimliği (FDA Session Management, SM, FMS, LAN Redundancy), onaylı mesaj tipi (istek/yanıt/hata), servis (onaylı bayrağı + servis kimliği, protokole göre adlandırılır), FDA adresi ve mesaj uzunluğu. Bildirilen uzunluk girdiyle karşılaştırılır ve tutmazsa hata basılır. Seçenek bayraklarından çıkan trailer (mesaj numarası, invoke id, zaman damgası, genişletilmiş kontrol alanı) mesajın sonundan çözülür. Servise özel gövde HAM bırakılır. Alan yerleşimi TEK kaynaklıdır (Wireshark’ın FF-588-1.3 §6’yı kaynak gösteren FF-HSE dissector’ı) ve bu her çözümde açıkça söylenir; IANA port kayıtları yalnız dört alt protokolü bağımsız doğrular. H1, fonksiyon blok modeli ve cihaz tanımı (DD) kapsam dışıdır.',
  'protocol.foundationFieldbus.example.fdaOpenSessionRequest.name': 'FDA Open Session — istek',
  'protocol.foundationFieldbus.example.fdaOpenSessionRequest.description':
    'Oturum açma isteği: protokol kimliği FDA Session Management, mesaj tipi istek, onaylı servis 1. Seçenek yok, bu yüzden trailer da yok.',
  'protocol.foundationFieldbus.example.smIdentifyResponse.name':
    'SM Identify — yanıt (mesaj numarası + invoke id)',
  'protocol.foundationFieldbus.example.smIdentifyResponse.description':
    'Seçenek baytı 0xC0: mesaj numarası ve invoke id trailer’da bulunur ve mesajın SONUNDAN çözülür; aradaki gövde ham kalır.',
  'protocol.foundationFieldbus.example.smDeviceAnnunciation.name':
    'SM Device Annunciation (onaysız)',
  'protocol.foundationFieldbus.example.smDeviceAnnunciation.description':
    'Onaylı bayrağı sıfır: servis kimliği 16 onaysız SM tablosundan okunur ve "SM Device Annunciation" olarak adlandırılır.',
  'protocol.foundationFieldbus.example.fmsReadRequest.name': 'FMS Read — istek (invoke id)',
  'protocol.foundationFieldbus.example.fmsReadRequest.description':
    'FMS okuma isteği; yalnız invoke id seçeneği açık, trailer 4 bayttır. Okunacak nesnenin kimliği gövdededir ve ham gösterilir.',
  'protocol.foundationFieldbus.example.fmsInformationReport.name':
    'FMS Information Report (zaman damgalı)',
  'protocol.foundationFieldbus.example.fmsInformationReport.description':
    'Onaysız FMS servisi; zaman damgası seçeneği açık olduğu için 8 baytlık trailer var. Zaman damgasının iç kırılımı tek kaynakta bile yok, ham gösteriliyor.',
  'protocol.foundationFieldbus.example.lanRedundancyDiagnostic.name':
    'LAN Redundancy — Diagnostic Message',
  'protocol.foundationFieldbus.example.lanRedundancyDiagnostic.description':
    'Dördüncü alt protokol: genişletilmiş kontrol alanı seçeneği açık, trailer 4 bayt.',
  'protocol.foundationFieldbus.example.unnamedService.name': 'Adı olmayan servis',
  'protocol.foundationFieldbus.example.unnamedService.description':
    'Servis kimliği 0x7E, FMS onaylı tablosunda yok — servis UYDURULMAZ, ham değer gösterilir ve nedeni uyarıyla söylenir.',
  'protocol.foundationFieldbus.example.reservedOptionSet.name': 'Ayrılmış seçenek biti set',
  'protocol.foundationFieldbus.example.reservedOptionSet.description':
    'Seçenek baytının bit 4’ü set: kaynak bu bit için anlam vermiyor, alan geçersiz işaretlenip uyarı basılıyor.',
  'protocol.foundationFieldbus.example.messageLengthMismatch.name': 'Mesaj uzunluğu tutmuyor',
  'protocol.foundationFieldbus.example.messageLengthMismatch.description':
    'Başlık 64 bayt bildiriyor ama girdi daha kısa — çerçeve düzeyinde hata basılır, eksik kısım uydurulmaz.',
  'protocol.foundationFieldbus.example.headerOnly.name': 'Yalnız başlık (gövdesiz mesaj)',
  'protocol.foundationFieldbus.example.headerOnly.description':
    '12 baytlık FDA başlığından ibaret bir yanıt: gövde ve trailer yok, uzunluk alanı 12’dir.',
  'protocol.foundationFieldbus.example.frameTooShort.name': 'Çok kısa girdi',
  'protocol.foundationFieldbus.example.frameTooShort.description':
    '8 bayt: 12 baytlık FDA başlığı bile tamamlanmıyor — ParseFailure (kaydedilebilir, akış devam edebilir).',
  // --- PROFIBUS DP ---
  'protocol.profibusDp.error.aborted': 'Çözümleme iptal edildi.',
  'protocol.profibusDp.error.emptyInput': 'Girdi boş — çözülecek telgraf yok.',
  'protocol.profibusDp.error.frameTooLong': 'Telgraf izin verilen azami uzunluğu aşıyor.',
  'protocol.profibusDp.error.startDelimiterUnknown':
    'Başlangıç sınırlayıcısı tanınmıyor: PROFIBUS FDL yalnız SC (0xE5), SD1 (0x10), SD2 (0x68), SD3 (0xA2) ve SD4 (0xDC) ile başlar.',
  'protocol.profibusDp.error.telegramTruncated':
    'Telgraf, başlangıç sınırlayıcısının gerektirdiği uzunluğa ulaşmıyor.',
  'protocol.profibusDp.error.lengthRepeatMismatch':
    'Uzunluk alanı iki kez gönderilir ve aynı olmalıdır; LEr LE ile eşleşmiyor. Uzunluk güvenilmez olduğu için gövde alanlara BÖLÜNMEDİ.',
  'protocol.profibusDp.error.lengthOutOfRange':
    'LE alanı 3-249 aralığının dışında: en az DA+SA+FC (3 bayt) taşınmalı, en çok 246 bayt kullanıcı verisi eklenebilir.',
  'protocol.profibusDp.error.secondStartMismatch':
    'SD2 telgrafında başlangıç sınırlayıcısı uzunluk alanından sonra TEKRARLANIR; ikinci 0x68 eksik.',
  'protocol.profibusDp.error.endDelimiterInvalid':
    'Bitiş sınırlayıcısı 0x16 değil — telgraf eksik ya da hizalama kaymış.',
  'protocol.profibusDp.error.checksumMismatch':
    'FCS tutmuyor: kapsanan baytların 256 modundaki toplamı gönderilen değere eşit değil.',
  'protocol.profibusDp.warning.userDataNeedsGsd':
    'Kullanıcı verisi (DU) HAM bırakıldı: hangi baytın hangi modülün girişi/çıkışı olduğu ÇERÇEVEDE YAZMAZ, GSD dosyasındaki modül ve I/O uzunluk bildiriminden gelir. Servis telgraflarının gövdeleri de DP profiline bağlıdır.',
  'protocol.profibusDp.warning.functionCodeNotNamed':
    'Çerçeve kontrol baytının fonksiyon kodu kaynak tablolarda yok — kod ADLANDIRILMADI, ham değer gösteriliyor.',
  'protocol.profibusDp.warning.sapNotNamed':
    'Adres uzantısındaki servis erişim noktası (SAP) numarası bilinen DP tablosunda yok — numara gösteriliyor ama ADLANDIRILMIYOR.',
  'protocol.profibusDp.warning.addressExtensionTruncated':
    'Adres uzantısı zinciri "devam ediyor" diyor ama telgraf bitti — zincir eksik, kalan baytlar uydurulmadı.',
  'protocol.profibusDp.warning.trailingBytes':
    'Telgrafın sonundan sonra fazladan bayt var — girdide birden çok telgraf olabilir; bölge ham gösteriliyor.',
  'protocol.profibusDp.warning.fcvWithoutFcbMeaning':
    'FCB biti 1 ama FCV biti 0: alıcı bu durumda çerçeve sayacını DEĞERLENDİRMEZ, yani FCB’nin bir anlamı yoktur.',
  'protocol.profibusDp.summary.telegram': '{source} → {destination}: {function}',
  'protocol.profibusDp.summary.shortAck': 'SC — kısa onay',
  'protocol.profibusDp.summary.token': 'Token: {source} → {destination}',
  'protocol.profibusDp.documentation.summary':
    'PROFIBUS DP (PI, IEC 61158/61784 Type 3): RS-485 üstünde merkezî olmayan çevre birimi I/O veri yolu. Girdi, hattan okunmuş TEK bir FDL telgrafıdır; UART karakter çerçevelemesi (start + 8 veri + parite + stop) decoder’a sızmaz. Beş telgraf sınıfının hepsi çözülür: SC (0xE5, kısa onay), SD1 (0x10, verisiz, 6 bayt), SD2 (0x68, değişken veri; uzunluk alanı iki kez gönderilir ve başlangıç sınırlayıcısı tekrarlanır), SD3 (0xA2, sabit 8 bayt veri, 14 bayt) ve SD4 (0xDC, token, 3 bayt). Hedef ve kaynak adresinin bit 7’si adres uzantısı bayrağıdır; uzantı baytları DP servis erişim noktalarını (Set Parameters, Check Configuration, Slave Diagnosis, Global Control, Read Inputs/Outputs, Set Slave Address, MS1/MS2 asiklik kanalları …) ve segment adresini taşır ve adlandırılır. Çerçeve kontrol baytı istek ise FCB/FCV ve fonksiyon kodu (SDA/SDN/SRD düşük-yüksek öncelik, FDL durumu, ident, LSAP …), yanıt ise istasyon tipi (slave / master token halkasında mı) ve durum kodu (OK, UE, RR, RS, DL, NR, DH, RDL, RDH) olarak kırılır. FCS GERÇEKTEN doğrulanır: kapsanan baytların 256 modundaki toplamı. Bu hesap IEC 60870-5-1 FT1.2’ninkiyle birebir aynı olduğu için depodaki ortak sum8Checksum paylaşıldı; çerçeveleme ise ayrı yazıldı, çünkü FT1.2’de Control adresten önce gelir, PROFIBUS’ta iki adres fonksiyon kodundan önce gelir ve SD3/SD4 FT1.2’de hiç yoktur. Kullanıcı verisi ham bırakılır: yerleşimi GSD dosyasından gelir. GSD içe aktarma, DPV1 servis gövdeleri ve çok telgraflı analiz kapsam dışıdır.',
  'protocol.profibusDp.example.sd1FdlStatusRequest.name': 'SD1 — FDL durumu isteği',
  'protocol.profibusDp.example.sd1FdlStatusRequest.description':
    'Verisiz 6 baytlık telgraf (10 22 02 49 6D 16): bağımsız bir PROFIBUS yığınının birim testindeki gerçek vektör. FC 0x49 → istek biti set, FCB ve FCV sıfır, fonksiyon kodu 9 (FDL durumu iste). FCS = 0x22+0x02+0x49 = 0x6D.',
  'protocol.profibusDp.example.sd1FdlStatusResponse.name': 'SD1 — FDL durumu yanıtı',
  'protocol.profibusDp.example.sd1FdlStatusResponse.description':
    'FC 0x20: istek biti sıfır olduğu için bayt YANIT olarak kırılır — istasyon tipi 2 (token halkasına girmeye hazır master), durum kodu 0 (OK).',
  'protocol.profibusDp.example.sd2SetParameters.name': 'SD2 — Set Parameters (Set_Prm)',
  'protocol.profibusDp.example.sd2SetParameters.description':
    'Hedef ve kaynak adresinin bit 7’si set: veri biriminin ilk iki baytı adres uzantısıdır ve DSAP 61 (Set Parameters) ile SSAP 62 (DP master MS0) olarak adlandırılır. Parametre gövdesi GSD’ye bağlı olduğu için ham kalır.',
  'protocol.profibusDp.example.sd2SlaveDiagnosisRequest.name': 'SD2 — Slave Diagnosis isteği',
  'protocol.profibusDp.example.sd2SlaveDiagnosisRequest.description':
    'DSAP 60 (Slave Diagnosis) + SSAP 62; kullanıcı verisi yok, telgraf yalnız adres uzantılarından ibaret.',
  'protocol.profibusDp.example.sd2DataExchange.name': 'SD2 — Data Exchange (SAP’siz)',
  'protocol.profibusDp.example.sd2DataExchange.description':
    'Adres uzantısı YOK: Data Exchange varsayılan SAP’siz servistir, dört baytlık çıkış verisi doğrudan veri biriminde taşınır ve GSD olmadan kırılmaz.',
  'protocol.profibusDp.example.sd2ResponseDataLow.name': 'SD2 — yanıt, düşük öncelikli veri',
  'protocol.profibusDp.example.sd2ResponseDataLow.description':
    'FC 0x08: yanıt çerçevesi, istasyon tipi 0 (slave), durum kodu 8 (DL — düşük öncelikli yanıt verisi hazır).',
  'protocol.profibusDp.example.sd3FixedData.name': 'SD3 — sabit 8 baytlık veri',
  'protocol.profibusDp.example.sd3FixedData.description':
    'Uzunluk alanı YOKTUR: SD3 telgrafı her zaman 14 bayttır ve veri birimi tam 8 bayttır.',
  'protocol.profibusDp.example.sd4Token.name': 'SD4 — token telgrafı',
  'protocol.profibusDp.example.sd4Token.description':
    'Üç bayt: sınırlayıcı + hedef + kaynak. Ne fonksiyon kodu ne FCS ne de bitiş sınırlayıcısı vardır.',
  'protocol.profibusDp.example.shortAcknowledgement.name': 'SC — kısa onay',
  'protocol.profibusDp.example.shortAcknowledgement.description':
    'Tek bayt (0xE5): adres, fonksiyon kodu ve sağlama içermeyen en kısa telgraf sınıfı.',
  'protocol.profibusDp.example.sd2GlobalControl.name': 'SD2 — Global Control (yayın)',
  'protocol.profibusDp.example.sd2GlobalControl.description':
    'Hedef adres 127 (yayın) ve DSAP 58 (Global Control): Sync/Freeze gibi komutlar bütün slave’lere aynı anda gönderilir.',
  'protocol.profibusDp.example.checksumMismatch.name': 'FCS hatası',
  'protocol.profibusDp.example.checksumMismatch.description':
    'Data Exchange telgrafının sağlaması bilerek bir artırıldı: FCS gerçekten hesaplandığı için çerçeve düzeyinde hata basılır ve beklenen değer gösterilir.',
  'protocol.profibusDp.example.lengthRepeatMismatch.name': 'Uzunluk tekrarı tutmuyor',
  'protocol.profibusDp.example.lengthRepeatMismatch.description':
    'LE 7 ama LEr 8: uzunluk güvenilmez olduğu için gövde ALANLARA BÖLÜNMEZ, tek parça ham gösterilir. Yanlış hizalanmış bir alan tablosu basmaktan iyidir.',
  'protocol.profibusDp.example.endDelimiterInvalid.name': 'Bitiş sınırlayıcısı hatalı',
  'protocol.profibusDp.example.endDelimiterInvalid.description':
    'Son bayt 0x16 değil: alanlar yine de çözülür ama çerçeve geçersiz işaretlenir.',
  'protocol.profibusDp.example.unknownStartDelimiter.name': 'Tanınmayan başlangıç sınırlayıcısı',
  'protocol.profibusDp.example.unknownStartDelimiter.description':
    'İlk bayt 0x55: beş sınırlayıcıdan hiçbiri değil — ParseFailure (kaydedilebilir, akış devam edebilir).',

  'protocol.hart.error.emptyInput': 'Girdi boş — çözülecek mesaj yok.',
  'protocol.hart.error.frameTooLong': 'Mesaj izin verilen azami uzunluğu aşıyor.',
  'protocol.hart.error.aborted': 'Çözümleme iptal edildi.',
  'protocol.hart.error.noDelimiterFound':
    'Preamble sonunda tanınan bir başlangıç sınırlayıcısı bulunamadı.',
  'protocol.hart.error.delimiterUnknown':
    'Başlangıç sınırlayıcısı tanınan altı değerden biri değil.',
  'protocol.hart.error.frameTruncated':
    'Byte Count alanının vaat ettiği kadar veri yok — mesaj kesik.',
  'protocol.hart.error.checksumMismatch': 'Checksum tutmuyor.',
  'protocol.hart.warning.commandNotNamed':
    'Komut sınıfı biliniyor ama bu komut tek tek adlandırılmamış.',
  'protocol.hart.warning.commandRangeReserved':
    'Komut numarası Universal/Common Practice/Device-Specific aralıklarının hiçbirine girmiyor — ayrılmış/tanımsız.',
  'protocol.hart.warning.responseCodeNotNamed':
    'Response Code komuta özel durum tablosunda adlandırılmamış.',
  'protocol.hart.warning.dataIsCommandSpecific':
    'Data alanının yapısı komuta göre değişir, bu motor tarafından kırılmaz.',
  'protocol.hart.warning.burstStatusLayoutInferred':
    'Burst çerçevesinin durum baytları yanıt çerçevesiyle aynı varsayılıyor — bağımsız kaynakta doğrulanmadı.',
  'protocol.hart.warning.trailingBytes': 'Checksum sonrasında fazladan bayt var.',
  'protocol.hart.summary.request': '{address} → Komut {command}',
  'protocol.hart.summary.response': '{address} ← Komut {command}',
  'protocol.hart.summary.burst': 'Burst {address}: Komut {command}',
  'protocol.hart.documentation.summary':
    'Seri HART çerçevesi: preamble, kısa/uzun başlangıç sınırlayıcısı, kısa poll adresi ya da uzun üretici/cihaz tipi/cihaz ID adresi, Universal/Common Practice/Device-Specific komut sınıflandırması, byte count, response code ve device status, ve gerçekten doğrulanan XOR checksum. Data alanı komuta özel olduğu için ham bırakılır.',
  'protocol.hart.example.shortRequestReadUniqueIdentifier.name': 'Kısa istek — Read Unique Identifier',
  'protocol.hart.example.shortRequestReadUniqueIdentifier.description':
    'Delimiter 0x02 (master→slave, kısa çerçeve), adres 0, komut 0, veri yok. jszumigaj/hart kütüphanesinin birim testindeki gerçek vektör (checksum 0x02) — bağımsız kaynakla elle doğrulandı.',
  'protocol.hart.example.shortResponseReadUniqueIdentifier.name': 'Kısa yanıt — Read Unique Identifier',
  'protocol.hart.example.shortResponseReadUniqueIdentifier.description':
    'Delimiter 0x06 (slave→master, kısa çerçeve), status 00 40 (Configuration Changed), 12 baytlık veri. Aynı kütüphanenin ikinci doğrulanmış vektörü (checksum 0xA3).',
  'protocol.hart.example.longRequestSecondaryMaster.name': 'Uzun istek — secondary master',
  'protocol.hart.example.longRequestSecondaryMaster.description':
    'Delimiter 0x82 (master→slave, uzun çerçeve), adres baytının bit 7\'si temiz (secondary master). Üçüncü doğrulanmış vektör (checksum 0x07).',
  'protocol.hart.example.longRequestPrimaryMasterWritePollingAddress.name':
    'Uzun istek — primary master, Write Polling Address',
  'protocol.hart.example.longRequestPrimaryMasterWritePollingAddress.description':
    'Aynı adres ama bit 7 set (primary master); Command 6 ile yeni poll adresi 5 yazılıyor.',
  'protocol.hart.example.longResponseLoopCurrent.name': 'Uzun yanıt — Read Loop Current and % of Range',
  'protocol.hart.example.longResponseLoopCurrent.description':
    'Command 2 yanıtı: iki IEEE-754 float taşıyan 8 baytlık veri alanı — bu motor tarafından ham bırakılır, çünkü yorumlama komuta özeldir.',
  'protocol.hart.example.deviceMalfunctionStatus.name':
    'Device Status — Device Malfunction + PV Out of Limits',
  'protocol.hart.example.deviceMalfunctionStatus.description':
    'İkinci status baytında 0x81: bit 0x80 (Device Malfunction) ve bit 0x01 (Primary Variable Out of Limits) birlikte set.',
  'protocol.hart.example.communicationsErrorResponse.name': 'İletişim hatası — Longitudinal Parity Error',
  'protocol.hart.example.communicationsErrorResponse.description':
    'Response Code 0x88: bit 7 set olduğu için alt bitler iletişim hatası bayrağı olarak okunur (0x08 = Longitudinal Parity Error). jszumigaj/hart\'ın birim testindeki değerle aynı.',
  'protocol.hart.example.commandNotImplementedResponse.name':
    'Komuta özel durum — Command Not Implemented',
  'protocol.hart.example.commandNotImplementedResponse.description':
    'Response Code 0x40: bit 7 temiz olduğu için komuta özel durum tablosundan okunur (Command Not Implemented). Aynı kütüphanenin ikinci doğrulanmış status değeri.',
  'protocol.hart.example.burstFrame.name': 'Burst çerçevesi',
  'protocol.hart.example.burstFrame.description':
    'Delimiter 0x81 (uzun, istemsiz gönderim). Durum baytları yanıt çerçevesiyle aynı yapıda VARSAYILIYOR — bu çıkarım bağımsız kaynakta doğrulanmadı, uyarı basılır.',
  'protocol.hart.example.commonPracticeCommand.name':
    'Common Practice komutu — Reset Configuration Changed Flag',
  'protocol.hart.example.commonPracticeCommand.description':
    'Komut 38, Common Practice aralığında (32-126) ve isim tablosunda adlandırılmış.',
  'protocol.hart.example.deviceSpecificCommand.name': 'Device-Specific komut — adlandırılmamış',
  'protocol.hart.example.deviceSpecificCommand.description':
    'Komut 200, Device-Specific aralığında (128-253) ama isim tablosunda YOK — sınıfı gösterilir, ismi UYDURULMAZ.',
  'protocol.hart.example.reservedCommandRange.name': 'Ayrılmış komut aralığı',
  'protocol.hart.example.reservedCommandRange.description':
    'Komut 31: Universal (0-30) ile Common Practice (32-126) arasındaki boşlukta, hiçbir sınıfa girmiyor.',
  'protocol.hart.example.checksumMismatch.name': 'Checksum hatası',
  'protocol.hart.example.checksumMismatch.description':
    'Checksum baytı kasten bir artırıldı: XOR gerçekten hesaplandığı için çerçeve hatası basılır ve beklenen değer gösterilir.',
  'protocol.hart.example.unknownStartDelimiter.name': 'Tanınmayan başlangıç sınırlayıcısı',
  'protocol.hart.example.unknownStartDelimiter.description':
    'Preamble sonrası bayt 0x55 — altı bilinen sınırlayıcıdan hiçbiri değil.',
  'protocol.hart.example.noDelimiterFound.name': 'Sınırlayıcı bulunamadı',
  'protocol.hart.example.noDelimiterFound.description':
    'Girdi baştan sona 0xFF — preamble hiç bitmiyor, gerçek bir sınırlayıcıya ulaşılamıyor.',
  'protocol.hart.example.frameTruncated.name': 'Mesaj kesik',
  'protocol.hart.example.frameTruncated.description':
    'Byte Count 12 vaat ediyor ama yalnız 2 bayt veri var: uzunluk güvenilmez olduğu için kalan baytlar tek parça ham gösterilir.',
  'protocol.hart.example.trailingBytes.name': 'Checksum sonrası fazla bayt',
  'protocol.hart.example.trailingBytes.description':
    'Geçerli bir çerçevenin ardından iki fazladan bayt eklendi.',

  'protocol.ioLink.error.emptyInput': 'Girdi boş — çözülecek mesaj yok.',
  'protocol.ioLink.error.frameTooLong': 'Mesaj izin verilen azami uzunluğu aşıyor.',
  'protocol.ioLink.error.aborted': 'Çözümleme iptal edildi.',
  'protocol.ioLink.error.masterMessageTooShort':
    'Master mesajı için asgari 2 bayt (MC + CKT) gerekir.',
  'protocol.ioLink.error.checksumMismatch': '6-bit checksum tutmuyor.',
  'protocol.ioLink.error.isduChecksumMismatch': 'ISDU\'nun kendi CHKPDU checksum\'ı tutmuyor.',
  'protocol.ioLink.warning.processDataNeedsIodd':
    'Process Data içeriğinin yapısı IODD dosyasından gelir, bu motor tarafından kırılmaz.',
  'protocol.ioLink.warning.onRequestDataNotDecoded':
    'On-request Data ham bırakıldı: ISDU kanalı değil, segmentli bir ISDU fragmanı ya da tanınmayan bir I-Service.',
  'protocol.ioLink.warning.type2PayloadSplitUnknown':
    'Type 2\'nin Process/On-request Data sınırı önceden anlaşılmış M-sequence alt tipine bağlıdır ve bu çerçeveden çıkmaz.',
  'protocol.ioLink.warning.mSequenceTypeReserved': 'M-sequence tipi ayrılmış (3) — kullanılmamalıydı.',
  'protocol.ioLink.warning.devicePayloadKindUnknown':
    'Bu baytların Process mi On-request Data mı olduğu yalnız eşleşen master mesajından bilinir, tek başına bu çerçeveden çıkmaz.',
  'protocol.ioLink.warning.isduServiceNotNamed':
    'I-Service değeri tanınan on bir değerden biri değil — ayrılmış ya da tanımsız.',
  'protocol.ioLink.warning.isduTrailingBytes': 'ISDU\'nun bildirdiği uzunluktan sonra fazladan bayt var.',
  'protocol.ioLink.summary.master': '{rw} · {channel} · adres {address}',
  'protocol.ioLink.summary.device': 'Device yanıtı · PD {pdStatus} · Event {event}',
  'protocol.ioLink.documentation.summary':
    'M-sequence zarfı: Master mesajında MC (R/W, kanal, adres/FlowCTRL) + CKT (M-sequence tipi + gerçekten doğrulanan 6-bit XOR checksum); Device mesajında Event/PD status bayrakları + aynı checksum. ISDU kanalında tek çerçeveye sığan bir parametre isteği/yanıtı varsa Index/Subindex/Data ve kendi CHKPDU\'su da çözülür. Process Data içeriği, Type 2\'nin PD/OD sınırı ve segmentli ISDU ham bırakılır.',
  'protocol.ioLink.option.messageSide': 'Çerçeve yönü',
  'protocol.ioLink.option.messageSide.description':
    'M-sequence oktetleri hangi tarafın gönderdiğini baytların içinde SÖYLEMEZ — Master mesajı MC+CKT ile başlar, Device mesajı CKS ile biter. Hangisinin çözüleceği burada seçilir.',
  'protocol.ioLink.option.messageSide.master': 'Master → Device (MC, CKT, …)',
  'protocol.ioLink.option.messageSide.device': 'Device → Master (…, CKS)',
  'protocol.ioLink.example.masterType0IsduStart.name':
    'TYPE_0 — ISDU aktarımı başlıyor (FlowCTRL START)',
  'protocol.ioLink.example.masterType0IsduStart.description':
    'MC: write, ISDU kanalı, adres 0x10 (FlowCTRL START). TYPE_0\'ın tek OD baytı segmentli bir ISDU aktarımının başlangıç fragmanıdır — tek çerçeveye sığmadığı için ham bırakılır.',
  'protocol.ioLink.example.masterType1ProcessDataWrite.name': 'TYPE_1_1 — Process Data yazma',
  'protocol.ioLink.example.masterType1ProcessDataWrite.description':
    'MC\'nin kanalı Process olduğu için 2 baytlık gövde Process Data olarak adlandırılır — içerik IODD\'ye bağlı olduğundan ham kalır.',
  'protocol.ioLink.example.masterType1IsduWriteResponsePositive.name':
    'TYPE_1 — ISDU Write Response (+), tam çözülür',
  'protocol.ioLink.example.masterType1IsduWriteResponsePositive.description':
    'OD, tam olarak 2 baytlık bir Write Response(+) ISDU\'sudur (I-Service 0x5, Length 0x2) — CHKPDU dahil tamamen çözülür ve doğrulanır.',
  'protocol.ioLink.example.masterType1IsduReadRequest8Bit.name':
    'TYPE_1 — ISDU Read Request, 8-bit Index',
  'protocol.ioLink.example.masterType1IsduReadRequest8Bit.description':
    'Index 16 için 8-bit indeksli okuma isteği — üç oktetlik tam bir ISDU.',
  'protocol.ioLink.example.masterType1IsduReadResponse16Bit.name':
    'TYPE_1 — ISDU Read Response (+), veri',
  'protocol.ioLink.example.masterType1IsduReadResponse16Bit.description':
    'Read Response(+) yalnız Data taşır (Table A.13: yanıtta Index/Subindex YOKTUR) — dört baytlık veri + CHKPDU.',
  'protocol.ioLink.example.masterType0IsduFragment.name': 'TYPE_0 — ISDU fragmanı, tam çözülemez',
  'protocol.ioLink.example.masterType0IsduFragment.description':
    'En küçük ISDU bile (Write Response gibi) 2 bayt ister; TYPE_0\'ın tek OD baytına sığmaz — segmentli olduğu söylenir, ham bırakılır.',
  'protocol.ioLink.example.masterType2Combined.name': 'TYPE_2 — Process + On-request Data birleşik',
  'protocol.ioLink.example.masterType2Combined.description':
    'PD/OD sınırı önceden anlaşılmış alt tipe (2_1..2_5/2_V) bağlıdır ve bu çerçevede yazmaz — tek parça ham gösterilir.',
  'protocol.ioLink.example.masterTypeReserved.name': 'Ayrılmış M-sequence tipi',
  'protocol.ioLink.example.masterTypeReserved.description':
    'CKT\'nin tip bitleri 0b11 (3) — spec bunu "reserved and shall not be used" diyor.',
  'protocol.ioLink.example.masterDiagnosisChannel.name': 'Diagnosis kanalı — ISDU değil, ham',
  'protocol.ioLink.example.masterDiagnosisChannel.description':
    'Kanal Diagnosis olduğu için ISDU denenmez; içerik (Event/diagnostic alt yapısı) bu motorun kapsamı dışındadır.',
  'protocol.ioLink.example.masterChecksumMismatch.name': 'Checksum hatası',
  'protocol.ioLink.example.masterChecksumMismatch.description':
    '6-bit checksum kasten bir artırıldı: resmi XOR + sıkıştırma formülü gerçekten hesaplandığı için çerçeve hatası basılır.',
  'protocol.ioLink.example.masterIsduChkpduMismatch.name': 'ISDU CHKPDU hatası',
  'protocol.ioLink.example.masterIsduChkpduMismatch.description':
    'Dış 6-bit checksum doğru ama ISDU\'nun kendi, bağımsız CHKPDU\'su kasten bozuldu — iki checksum ayrı katmanları korur.',
  'protocol.ioLink.example.masterMessageTooShort.name': 'Master mesajı çok kısa',
  'protocol.ioLink.example.masterMessageTooShort.description':
    'Tek bayt: MC + CKT için asgari 2 bayt gerekir.',
  'protocol.ioLink.example.deviceWriteAck.name': 'Device — yazma onayı (yalnız CKS)',
  'protocol.ioLink.example.deviceWriteAck.description':
    'PD/OD yok, yalnız CKS: bir yazma isteğinin onayı.',
  'protocol.ioLink.example.deviceReplyWithPayloadAndEvent.name': 'Device — veri + Event bayrağı',
  'protocol.ioLink.example.deviceReplyWithPayloadAndEvent.description':
    '2 baytlık gövde (Process mi On-request Data mı olduğu eşleşen master çerçevesine bağlı, bu yüzden ham) + Event pending + Process Data invalid.',
  'protocol.ioLink.example.deviceChecksumMismatch.name': 'Device checksum hatası',
  'protocol.ioLink.example.deviceChecksumMismatch.description': 'CKS\'nin 6-bit checksum\'ı kasten bozuldu.',

  // --- SAE J1850 PWM/VPW (Faz 10, dalga 14f) ---
  'protocol.j1850.pwm.documentation.summary':
    'SAE J1850 PWM: 41.6 kbit/s darbe-genişlik modülasyonlu Class-B araç ağı. Girdi bir nabız günlüğüdür (bayt akışı değil); bit eşiği ve profil decodeOptions üzerinden seçilir.',
  'protocol.j1850.pwm.option.bitThreshold': 'Bit Eşiği (µs)',
  'protocol.j1850.pwm.option.bitThreshold.description':
    'Kısa ve uzun darbeyi ayıran süre sınırı. "Profil" bir preset seçiyorsa bu alan YOK SAYILIR.',
  'protocol.j1850.pwm.option.profile': 'Profil',
  'protocol.j1850.pwm.option.profile.description':
    'Bir preset seçilirse Bit Eşiği alanı yok sayılır ve alan tablosunun ilk satırı yürürlükteki profili adıyla gösterir.',
  'protocol.j1850.pwm.option.profile.custom': 'Özel (sayı alanını kullan)',
  'protocol.j1850.pwm.error.empty': 'Nabız günlüğü boş.',
  'protocol.j1850.pwm.error.oddLength': 'Nabız günlüğü tek uzunlukta; her nabız 2 bayt (Uint16LE) olmalı.',
  'protocol.j1850.pwm.error.misalignedBits':
    'SOF sonrası nabız sayısı 8’in katı değil; bayta tamamlanamıyor.',
  'protocol.j1850.pwm.error.tooShort': 'Header ve CRC için yetersiz nabız var.',
  'protocol.j1850.pwm.error.frameTooLong': 'Çerçeve izin verilen azami uzunluğu aşıyor.',
  'protocol.j1850.pwm.error.crcMismatch': 'CRC-8 (SAE J1850) hesaplanan değerle tutmuyor.',
  'protocol.j1850.pwm.error.aborted': 'Çözümleme iptal edildi.',
  'protocol.j1850.pwm.warning.sofReserved':
    'SOF nabzı rezerve (0) değerinde — ölçülemedi, süreye çevrilmedi.',
  'protocol.j1850.pwm.warning.reservedPulseInFrame':
    'Çerçeve içinde en az bir rezerve (ölçülemedi) nabız var; o baytın biti yer tutucu olarak 0 kabul edildi.',
  'protocol.j1850.pwm.warning.headerUnresolved':
    'Header ham gösteriliyor: tam anlamı J2178/J1979 gibi üst dokümanlara bağlıdır, bu araç eşlemiyor.',
  'protocol.j1850.pwm.warning.crcMismatch': 'CRC-8 (SAE J1850) tutmuyor.',
  'protocol.j1850.pwm.summary.frame': 'SAE J1850 PWM çerçevesi',
  'protocol.j1850.pwm.example.validFrame.name': 'Geçerli çerçeve (header + 3 bayt veri)',
  'protocol.j1850.pwm.example.validFrame.description':
    'CRC-8 (SAE J1850) doğrulanan tam bir çerçeve; header ham kalır.',
  'protocol.j1850.pwm.example.noDataFrame.name': 'Veri baytı olmadan (yalnız Header + CRC)',
  'protocol.j1850.pwm.example.noDataFrame.description':
    'Data alanı olmadan da geçerli olan en kısa çerçeve.',
  'protocol.j1850.pwm.example.badCrc.name': 'Bozuk CRC',
  'protocol.j1850.pwm.example.badCrc.description':
    'CRC baytı kasten bozuldu; çerçeve yine çözülür ama geçersiz işaretlenir.',
  'protocol.j1850.pwm.example.truncated.name': 'Eksik çerçeve',
  'protocol.j1850.pwm.example.truncated.description':
    'SOF sonrası nabız sayısı bayta tamamlanmıyor (8’in katı değil).',
  'protocol.j1850.vpw.documentation.summary':
    'SAE J1850 VPW: 10.4 kbit/s değişken darbe-genişlikli tek telli Class-B araç ağı. Bit anlamı süre ile aktif/pasif durumun BİRLİKTE değerlendirilmesine bağlıdır; ilk seviye decodeOptions ile seçilir.',
  'protocol.j1850.vpw.option.bitThreshold': 'Bit Eşiği (µs)',
  'protocol.j1850.vpw.option.bitThreshold.description': 'Kısa ve uzun darbeyi ayıran süre sınırı.',
  'protocol.j1850.vpw.option.initialLevel': 'İlk Seviye (SOF)',
  'protocol.j1850.vpw.option.initialLevel.description':
    'Nabızlar kesin alterne eder; tek bilinmeyen ilk nabzın (SOF) aktif mi pasif mi olduğudur.',
  'protocol.j1850.vpw.option.initialLevel.active': 'Aktif',
  'protocol.j1850.vpw.option.initialLevel.passive': 'Pasif',
  'protocol.j1850.vpw.option.payloadInterpretation': 'Payload Yorumu',
  'protocol.j1850.vpw.option.payloadInterpretation.description':
    'Data alanının OBD-II mesajı taşıdığı çerçeveden çıkarılamaz; kullanıcı sistem bağlamından bilir. Seçilirse AYNI baytlar OBD-II motoruyla çözülür.',
  'protocol.j1850.vpw.option.payloadInterpretation.raw': 'Ham veri',
  'protocol.j1850.vpw.option.payloadInterpretation.obdIi': 'OBD-II',
  'protocol.j1850.vpw.error.empty': 'Nabız günlüğü boş.',
  'protocol.j1850.vpw.error.oddLength': 'Nabız günlüğü tek uzunlukta; her nabız 2 bayt (Uint16LE) olmalı.',
  'protocol.j1850.vpw.error.misalignedBits':
    'SOF sonrası nabız sayısı 8’in katı değil; bayta tamamlanamıyor.',
  'protocol.j1850.vpw.error.tooShort': 'Header ve CRC için yetersiz nabız var.',
  'protocol.j1850.vpw.error.frameTooLong': 'Çerçeve izin verilen azami uzunluğu aşıyor.',
  'protocol.j1850.vpw.error.crcMismatch': 'CRC-8 (SAE J1850) hesaplanan değerle tutmuyor.',
  'protocol.j1850.vpw.error.aborted': 'Çözümleme iptal edildi.',
  'protocol.j1850.vpw.warning.sofReserved':
    'SOF nabzı rezerve (0) değerinde — ölçülemedi, süreye çevrilmedi.',
  'protocol.j1850.vpw.warning.reservedPulseInFrame':
    'Çerçeve içinde en az bir rezerve (ölçülemedi) nabız var; o baytın biti yer tutucu olarak 0 kabul edildi.',
  'protocol.j1850.vpw.warning.headerUnresolved':
    'Header ham gösteriliyor: tam anlamı J2178/J1979 gibi üst dokümanlara bağlıdır, bu araç eşlemiyor.',
  'protocol.j1850.vpw.warning.crcMismatch': 'CRC-8 (SAE J1850) tutmuyor.',
  'protocol.j1850.vpw.warning.dataMayBeObd':
    'Data alanı ham gösteriliyor. OBD-II mesajı taşıdığını biliyorsanız Payload Yorumu’nu "OBD-II" yapın.',
  'protocol.j1850.vpw.warning.obdParseFailed':
    'Data alanı OBD-II motoruyla çözülemedi; ham gösteriliyor.',
  'protocol.j1850.vpw.summary.frame': 'SAE J1850 VPW çerçevesi',
  'protocol.j1850.vpw.example.validFrame.name': 'Geçerli çerçeve (OBD-II Engine RPM yanıtı)',
  'protocol.j1850.vpw.example.validFrame.description':
    'Data alanı obd.ts’in doğrulanmış Engine RPM örneğidir (A=0x1A, B=0xF8 → 1726 rpm); Payload Yorumu "OBD-II" yapılınca aynı motorla çözülür.',
  'protocol.j1850.vpw.example.noDataFrame.name': 'Veri baytı olmadan (yalnız Header + CRC)',
  'protocol.j1850.vpw.example.noDataFrame.description':
    'Data alanı olmadan da geçerli olan en kısa çerçeve.',
  'protocol.j1850.vpw.example.badCrc.name': 'Bozuk CRC',
  'protocol.j1850.vpw.example.badCrc.description':
    'CRC baytı kasten bozuldu; çerçeve yine çözülür ama geçersiz işaretlenir.',
  'protocol.j1850.vpw.example.truncated.name': 'Eksik çerçeve',
  'protocol.j1850.vpw.example.truncated.description':
    'SOF sonrası nabız sayısı bayta tamamlanmıyor (8’in katı değil).',

  // --- SENT + SPC (Faz 10, dalga 14g) ---
  'protocol.sent.documentation.summary':
    'SAE J2716 SENT: kalibrasyon darbesinden çıkarılan tick süresiyle nibble’lara çözülen tek yönlü darbe treni. CRC alındığı gibi gösterilir, hesaplanmaz — nibble-özyinelemeli algoritma ikinci bağımsız kaynakla teyit edilemedi.',
  'protocol.sent.option.profile': 'Profil',
  'protocol.sent.option.profile.description':
    'Bir preset seçilirse Veri Nibble Sayısı alanı yok sayılır ve alan tablosunun ilk satırı yürürlükteki profili adıyla gösterir.',
  'protocol.sent.option.profile.custom': 'Özel (sayı alanını kullan)',
  'protocol.sent.option.dataNibbleCount': 'Veri Nibble Sayısı',
  'protocol.sent.option.dataNibbleCount.description':
    'Fast Channel çerçevesindeki veri nibble sayısı. Yalnız "Özel" profilinde geçerlidir.',
  'protocol.sent.error.empty': 'Nabız günlüğü boş.',
  'protocol.sent.error.oddLength': 'Nabız günlüğü tek uzunlukta; her nabız 2 bayt (Uint16LE) olmalı.',
  'protocol.sent.error.tooShort': 'Sync + Status + veri nibble’ları + CRC için yetersiz nabız var.',
  'protocol.sent.error.frameTooLong': 'Çerçeve izin verilen azami uzunluğu aşıyor.',
  'protocol.sent.error.aborted': 'Çözümleme iptal edildi.',
  'protocol.sent.error.nibbleOutOfRange': 'Bir nibble darbesinin tick sayısı geçerli aralığın (12-27) dışında.',
  'protocol.sent.warning.syncReserved':
    'Sync/Calibration darbesi rezerve (0) değerinde — tick süresi kestirilemedi, nibble’lar çözülemedi.',
  'protocol.sent.warning.nibbleReserved':
    'Bu nibble darbesi rezerve (0) değerinde — ölçülemedi, değer çözülemedi.',
  'protocol.sent.warning.nibbleOutOfBand':
    'Nibble darbesinin tick sayısı geçerli aralığın (12-27) dışında; değer çözülemedi.',
  'protocol.sent.warning.crcNotVerified':
    'CRC nibble’ı alındığı gibi gösterilir ama DOĞRULANMAZ: SAE J2716’nın nibble-özyinelemeli CRC-4 algoritması legacy/recommended/üretici varyantlarına göre değişir ve iki bağımsız birincil kaynakla tam teyit edilemedi. Genel CRC kataloğundaki 4-bit girişler (ör. CRC4_ITU) FARKLI bir algoritmadır, sahte dost olur.',
  'protocol.sent.warning.trailingPulses':
    'Beklenen çerçeve uzunluğundan (Pause dahil) sonra fazladan nabız var; yok sayıldı.',
  'protocol.sent.warning.slowChannelPartial':
    'Bu nibble Slow Channel bilgisini de taşır (Fast Channel’ın status/communication nibble’ından türer) ama TEK çerçevede yalnız kısmi katkı görünür; tam Slow Channel mesajı birden çok çerçeve ister ve Analyzer’ın işidir. Hangi bit(ler)in Slow Channel’a ait olduğuna dair bu depoda bit-düzeyi bir kaynak yok.',
  'protocol.sent.summary.frame': 'SENT çerçevesi ({dataNibbleCount} veri nibble’ı)',
  'protocol.sent.example.validFrame.name': 'Geçerli çerçeve (6 veri nibble’ı, Pause yok)',
  'protocol.sent.example.validFrame.description':
    'Sync + Status + 6 veri nibble’ı + CRC; tüm nibble’lar geçerli tick bandında.',
  'protocol.sent.example.withPause.name': 'Pause Pulse ile',
  'protocol.sent.example.withPause.description':
    'Çerçeveyi sabit uzunluğa tamamlayan isteğe bağlı Pause darbesi içerir.',
  'protocol.sent.example.invalidNibble.name': 'Geçersiz nibble (bant dışı tick sayısı)',
  'protocol.sent.example.invalidNibble.description':
    'Bir veri nibble’ının darbe süresi kasten geçerli [12,27] tick bandının dışına taşındı.',
  'protocol.sent.example.truncated.name': 'Eksik çerçeve',
  'protocol.sent.example.truncated.description':
    'Yalnız 4 nabız var; varsayılan profil (6 veri nibble’ı) için yetersiz.',
  'protocol.psi5.documentation.summary':
    'PSI5: iki telli, akım modülasyonlu otomotiv sensör arayüzü. Bu çözücü YUKARI YÖN (sensör → ECU) veri çerçevesini okur: iki start biti, LSB-first gönderilen yük bölgesi ve çift parite ya da 3 bitlik CRC. Yük genişliği ile parity/CRC seçimi telin içinde YOKTUR, seçeneklerden gelir.',
  'protocol.psi5.option.applicationProfile': 'Uygulama Profili',
  'protocol.psi5.option.applicationProfile.description':
    'Yalnız metadata olarak saklanır ve alan tablosunun ilk satırında görünür — hiçbir bit genişliğini DEĞİŞTİRMEZ. Üç substandard belgesi (airbag / vehicle dynamics control / powertrain) kamuya açık olmadığı için preset gönderilmedi; sayıları siz verirsiniz.',
  'protocol.psi5.option.applicationProfile.unspecified': 'Belirtilmedi',
  'protocol.psi5.option.revision': 'PSI5 Revizyonu',
  'protocol.psi5.option.revision.description':
    'Sürüm ve tarihler psi5.org’un resmî tablosundan. Alan düzeni V2.1 metniyle doğrulandı; revizyon yalnız izin verilen yük aralığını belirler (V1.3: 8–24 bit, V2.x: 10–28 bit).',
  'protocol.psi5.option.communicationMode': 'İletişim Modu',
  'protocol.psi5.option.communicationMode.description':
    'Senkron/asenkron ayrımı ÇERÇEVEDE hiçbir bitle temsil edilmez: ECU’nun gerilim senkron darbesiyle yapılır. Bu yüzden “otomatik” şıkkı yoktur, mod bilgisi metadata olarak sizden gelir.',
  'protocol.psi5.option.payloadBitCount': 'Yük Bit Sayısı',
  'protocol.psi5.option.payloadBitCount.description':
    'Yük bölgesinin toplam bit sayısı. Telden ÇIKARILAMAZ — alıcıda slot başına yazmaçtan gelir. Seçilen revizyonun aralığı dışına çıkarsanız uyarı basılır.',
  'protocol.psi5.option.errorCheck': 'Hata Denetimi',
  'protocol.psi5.option.errorCheck.description':
    'Tek bit çift parite mi, üç bit CRC mi. Bu seçim de telin içinde yoktur; alıcıda slot başına yapılandırılır. CRC g(x)=x³+x+1, başlangıç “111”, start bitleri hariç.',
  'protocol.psi5.option.messagingBits': 'Messaging (M) Bit Sayısı',
  'protocol.psi5.option.messagingBits.description':
    'Opsiyonel seri veri kanalı; standartta 0 ya da 2 bittir. Yükün EN DÜŞÜK bitlerinde durur.',
  'protocol.psi5.option.frameControlBits': 'Frame Control (F) Bit Sayısı',
  'protocol.psi5.option.frameControlBits.description':
    'Opsiyonel, 0–4 bit. Çerçevenin türünü ya da SENSÖR KİMLİĞİNİ taşıyabilir — genişliği sistem yapılandırmasından gelir, tahmin edilmez.',
  'protocol.psi5.option.statusBits': 'Status (E) Bit Sayısı',
  'protocol.psi5.option.statusBits.description': 'Opsiyonel durum alanı, 0–2 bit.',
  'protocol.psi5.option.regionBBits': 'Data Region B Bit Sayısı',
  'protocol.psi5.option.regionBBits.description':
    'Opsiyonel ikincil ölçüm bölgesi, 0–12 bit. Geriye kalan bitler zorunlu Data Region A’dır.',
  'protocol.psi5.error.empty': 'Çerçeve boş.',
  'protocol.psi5.error.truncated':
    'Seçilen yük genişliği ve hata denetimi için yeterli bit yok; çerçeve eksik.',
  'protocol.psi5.error.subFieldsExceedPayload':
    'Alt alanların toplam genişliği yük bit sayısını aşıyor; Data Region A için bit kalmıyor.',
  'protocol.psi5.error.parityMismatch': 'Parite uyuşmuyor.',
  'protocol.psi5.error.crcMismatch': 'CRC uyuşmuyor.',
  'protocol.psi5.warning.startBitsNotZero':
    'Start bitleri 0b00 değil. PSI5’te iki start biti DAİMA sıfırdır — hizalama kaymış ya da bu bir PSI5 çerçevesi değil.',
  'protocol.psi5.warning.trailingBits':
    'Çerçeveden sonra bir bayttan fazla bit artıyor — seçilen yük genişliği ya da hata denetimi bu yakalamayla uyuşmuyor olabilir.',
  'protocol.psi5.warning.paddingNotZero':
    'Bayt sınırına kadarki dolgu bitleri sıfır değil; girdi beklenen paketleme biçiminde olmayabilir.',
  'protocol.psi5.warning.payloadOutOfRevisionRange':
    'Seçilen yük bit sayısı, seçilen revizyonun izin verdiği aralığın dışında (V1.3: 8–24, V2.x: 10–28).',
  'protocol.psi5.warning.regionABelowMinimum':
    'Data Region A, standardın zorunlu alt sınırının altında kaldı; alt alan genişliklerini gözden geçirin.',
  'protocol.psi5.warning.slotTimelineNotResolved':
    'Slot zaman çizelgesi ve sensör kimliği ÇÖZÜLMEZ: yukarı yön çerçevesinde sensör adresi alanı yoktur, kimlik zaman slotuyla belirlenir ve slot sayacı alıcının ürettiği veridir. Bu bir analyzer işidir.',
  'protocol.psi5.warning.profileMetadataOnly':
    'Uygulama profili yalnız metadata olarak kaydedildi; substandard belgeleri kamuya açık olmadığı için hiçbir bit genişliği profilden GELMEZ.',
  'protocol.psi5.warning.messagingWidth':
    'Messaging alanı standartta 0 ya da 2 bittir; 1 bit belgelenmiş bir yapılandırma değil.',
  'protocol.psi5.example.airbag10Parity.name': '10 bit yük + parite (Infineon AURIX örneği)',
  'protocol.psi5.example.airbag10Parity.description':
    'Infineon’un PSI5 sensör emülatörü kod örneğinin çalışılmış çerçevesi: 10 veri biti “0001110000”, parite 1. Aynı belge alıcı yazmacında 0x38 okunduğunu söylüyor — LSB-first okumanın kanıtı. Varsayılan seçeneklerle çözülür.',
  'protocol.psi5.example.airbag16Crc.name': '16 bit yük + 3 bit CRC (Infineon KP405 örneği)',
  'protocol.psi5.example.airbag16Crc.description':
    'KP405 veri sayfasının çalışılmış CRC örneği: yük 0xAD2C, CRC 0b100. Çözmek için Yük Bit Sayısı’nı 16, Hata Denetimi’ni CRC yapın.',
  'protocol.psi5.example.badParity.name': 'Bozuk parite',
  'protocol.psi5.example.badParity.description':
    'Aynı yük, parite biti kasten ters çevrildi — hesaplanan değer alan tablosunda görünür.',
  'protocol.psi5.example.startBitError.name': 'Start biti hatası',
  'protocol.psi5.example.startBitError.description':
    'İkinci start biti 1 gönderildi; PSI5’te ikisi de daima 0 olmalıdır.',
  'protocol.psi5.example.truncated.name': 'Eksik çerçeve',
  'protocol.psi5.example.truncated.description':
    'Tek bayt: varsayılan yapılandırma 13 bit istiyor, elde 8 bit var.',
  'protocol.spc.documentation.summary':
    'SPC: SENT hattında bir tetik darbesiyle başlatılan istek-yanıt işlemi. Yanıt çerçevesi SENT’in KENDİ çözücüsüyle okunur — ikinci bir çözücü yok.',
  'protocol.spc.option.sensorProfile': 'Sensör Profili',
  'protocol.spc.option.sensorProfile.description':
    'SENT yanıt çerçevesinin profili — SENT’in Profil şıkkıyla AYNI seçenekleri paylaşır.',
  'protocol.spc.error.empty': 'Nabız günlüğü boş.',
  'protocol.spc.error.oddLength': 'Nabız günlüğü tek uzunlukta; her nabız 2 bayt (Uint16LE) olmalı.',
  'protocol.spc.error.tooShort':
    'Tetik darbesinden sonraki yanıt, tam bir SENT çerçevesi için yetersiz nabız içeriyor.',
  'protocol.spc.error.frameTooLong': 'Çerçeve izin verilen azami uzunluğu aşıyor.',
  'protocol.spc.error.aborted': 'Çözümleme iptal edildi.',
  'protocol.spc.error.noResponse': 'Tetik darbesinden sonra hiçbir yanıt nabzı yok (No response).',
  'protocol.spc.error.triggerTooShort':
    'Tetik darbesi rezerve (0) değerinde — ölçülemedi, geçerli bir tetik olarak kabul edilmedi.',
  'protocol.spc.warning.triggerTooShort':
    'Tetik darbesi rezerve (0) değerinde — ölçülemedi. Sayısal bir "çok kısa" eşiği spec’te yok, bu yüzden yalnız ölçülemeyen darbeler işaretlenir.',
  'protocol.spc.warning.noResponse':
    'Tetik darbesinden sonra hiçbir nabız yok — sensör yanıt vermedi ya da yakalama eksik.',
  'protocol.spc.summary.frame': 'SPC işlemi (yanıt: {hasResponse})',
  'protocol.spc.example.validResponse.name': 'Geçerli tetik + yanıt',
  'protocol.spc.example.validResponse.description':
    'Tetik darbesini AYNI SENT çözücüsüyle okunan geçerli bir yanıt çerçevesi izler.',
  'protocol.spc.example.noResponse.name': 'Yanıt yok',
  'protocol.spc.example.noResponse.description':
    'Yalnız tetik darbesi var; sensörden hiçbir yanıt nabzı gelmedi.',
  'protocol.spc.example.triggerReserved.name': 'Tetik darbesi rezerve',
  'protocol.spc.example.triggerReserved.description':
    'Tetik darbesi 0x0000 (rezerve/ölçülemedi) — "Trigger too short" sınıfının vekili.',
  'protocol.spc.example.truncatedResponse.name': 'Yarıda kesilmiş yanıt',
  'protocol.spc.example.truncatedResponse.description':
    'Tetikten sonra yanıt BAŞLIYOR ama tam bir SENT çerçevesi için yetersiz nabızda kesiliyor.',
} as const;

/**
 * Bir sözlüğün taşıması gereken şekil. `en.ts` bunu ANOTASYON olarak kullanır
 * (`satisfies` değil): eksik anahtar ancak anotasyonla derleme hatası olur.
 */
export type TranslationDictionary = Record<keyof typeof tr, string>;
