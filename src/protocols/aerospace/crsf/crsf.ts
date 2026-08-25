/**
 * CRSF — TBS Crossfire'ın 416666/420000/pazarlıklı baud, 8N1, NON-inverted seri
 * protokolü: değişken uzunluklu çerçeve, kapalı adres/tip sözlükleri, İKİ AYRI
 * CRC-8. Faz 10, dalga 15d (`brief-faz10-dalga15d.md`). `rc-control-links`
 * ailesinde `sbus`/`ibus`in (dalga 15c) doğurduğu `packedChannels.ts`i tüketen
 * ikinci kayıt.
 *
 * ── GİRDİ SÖZLEŞMESİ: HAM CRSF çerçeve baytları, UART DEĞİL ────────────────
 * UART taşıyıcısı parser'a HİÇ girmez — `mavlink.ts`in "fiziksel taşıyıcı bir
 * bayt akışı değildir, parser'a hiç girmez" sınırı birebir (`sbus.ts` aynı
 * kararı verdi). Baud pazarlığı state machine'i de (spec `:248`: `416666 →
 * Speed Proposal → Accepted → Guard Time → Switch`) PARSER'A GİRMEZ —
 * çerçeveler arası durum, analyzer işi (`mavlink.ts`in SEQ-LOSS kararı).
 *
 * ── KAYNAK (ana thread'in 2026-08-25 kaynak turu — DOĞRULANMIŞ) ────────────
 * TBS'in resmî CRSF spec'i (`tbs-fpv/tbs-crsf-spec/crsf.md`, 1335 satır — ham
 * indirilip okundu) + Betaflight `rx/crsf.c`, `rx/crsf_protocol.h`,
 * `common/crc.h` — iki bağımsız kaynak birbirini örtüyor, bu dalganın en iyi
 * durumdaki kaydı. Bu dosyanın YAZIM ANINDA ek olarak doğrulanan iki nokta
 * (aşağıda ayrıntılı):
 *   1. Genişletilmiş/broadcast çerçeve ayrımının sınırı (`0x28`) spec'in
 *      kendi cümlesiyle teyitli: *"Frames with type 0x28 and higher (except
 *      explicitly mentioned) have extended header (with destination and
 *      origin)."*
 *   2. `0x7A`/`0x7B` adları spec'in "0x7A MSP Request / 0x7B Response"
 *      başlığından BİREBİR alındı; `0x7C` yalnız Betaflight'ın enum'unda var
 *      (bu depoda ayrıca açılmadı, tek kaynaklı — bkz. FRAME_TYPE_NAMES notu).
 *
 * ── ÇERÇEVE ──────────────────────────────────────────────────────────────
 *   [0]      Device / Sync Address  (CRSF_SYNC_BYTE = 0xC8 — bkz. "Adres
 *            sözlüğü" notu; ÇAKIŞMA: 0xC8 AYNI ZAMANDA
 *            CRSF_ADDRESS_FLIGHT_CONTROLLER'dır, Betaflight'ın kendi başlığı
 *            bunu `crsf_protocol.h:137`de açıkça yazar — `canParse` bunu TEK
 *            kanıt saymaz, aşağı bak)
 *   [1]      Frame Length            (Type + [Dest+Origin] + Payload + CRC
 *            baytlarının sayısı — Address ve kendisi HARİÇ)
 *   [2]      Type
 *   [3..]    Broadcast: Payload — Extended (`Type >= 0x28`): Destination(1) +
 *            Origin(1) + Payload
 *   [n-1]    Frame CRC-8  (Command çerçevesinde n-2'de AYRICA Command CRC-8)
 *
 * Maksimum çerçeve **64 bayt** (spec `:146`: *"not longer than 64 bytes
 * (including the Sync and CRC bytes)"*; Betaflight `crsf_protocol.h:41-42`
 * `CRSF_FRAME_SIZE_MAX=64`, `CRSF_PAYLOAD_SIZE_MAX=64-6`) → Frame Length
 * baytının üst sınırı `64-2=62` (`MAX_LENGTH_BYTE`).
 *
 * ── Adres sözlüğü — İKİ KAYNAK ÇELİŞİYOR, Betaflight'ınki KULLANILDI ───────
 * Bu dosyanın adres tablosu (`ADDRESS_NAMES`) Betaflight `crsf_protocol.h:
 * 45-73` kaynaklıdır (0x00 Broadcast · 0x10 USB · 0x80 TBS Core PNP Pro ·
 * 0xC0 Current Sensor · 0xC2 GPS · 0xC4 TBS Blackbox · 0xC8 Flight Controller
 * · 0xCC Race Tag · 0xEA Radio Transmitter · 0xEC CRSF Receiver · 0xEE CRSF
 * Transmitter) — yani ekosistemde FİİLEN kullanılan, Betaflight/INAV/
 * ArduPilot'un uyguladığı sabit adresler.
 *
 * DÜRÜSTLÜK NOTU: bu dosyanın yazımı sırasında TBS'in GÜNCEL spec deposu
 * (`tbs-fpv/tbs-crsf-spec/main/crsf.md`, "Device Addresses" bölümü) AYRICA
 * indirilip okundu ve bu bölüm YUKARIDAKİ listeyle ÖRTÜŞMÜYOR — güncel spec
 * `0x0E Cloud`, `0x12 Bluetooth/WiFi`, `0x13 WiFi receiver`, `0x14 Video
 * Receiver`, `0x20-0x7F` NAT için dinamik adres uzayı, `0x90-0x96` ESC1-7
 * gibi FARKLI, NAT-tabanlı bir adresleme şeması tarif ediyor ve 0xC0/0xC2/
 * 0xC4/0xC8/0xCC/0xEA/0xEC/0xEE'yi HİÇ anmıyor. Bu YOK SAYILMADI, burada
 * açıkça yazılıyor: aynı spec dosyasının `0xAA CRSF MAVLink Envelope`
 * örneği KENDİSİ "Sync byte (0xC8)" kullanıyor — yani 0xC8 güncel spec
 * metninde bile fiilen hâlâ örnek/referans değer. Betaflight'ın sabit
 * adresleri muhtemelen daha ESKİ bir spec revizyonunu yansıtıyor ama
 * DEPLOY EDİLMİŞ donanımın (ve dolayısıyla bu aracın gerçekte çözeceği
 * yakalamaların) hâlâ kullandığı şema bu. `canParse`/`parse` bu YÜZDEN
 * Betaflight listesini esas alır; ileride NAT şeması yaygınlaşırsa liste
 * genişletilir (`ADDRESS_NAMES`, tek nokta).
 *
 * ── CRC — KAPSAM Address/Length'i DIŞLAR, bu dosyanın EN KOLAY KAÇAN hatası ─
 * TBS `crsf.md` "CRC" bölümü: *"CRC includes Type and Payload of each frame
 * (doesn't include sync byte and frame length)."* Betaflight `rx/crsf.c:
 * 334-336` aynı şeyi kodda gösterir: `crc = crc8_dvb_s2(0, crsfFrame.frame.
 * type)` sonra yalnız payload baytları — Address ve Frame Length HİÇ
 * girmez. "CRC'yi çerçevenin tamamına uygula" varsayımı SESSİZCE yanlış
 * çıkar (`crsf.test.ts`teki kapsam testi bunu kanıtlar — zorunlu disiplin).
 * Algoritma: CRC-8/DVB-S2 (poly 0xD5, init 0x00, refin/refout false, xorout
 * 0x00) — katalogda `CRC8_DVB_S2` (`crcCatalogue.ts`, dosya başı notu).
 *
 * ── Command CRC (yalnız `0x32`) — Frame CRC'DEN AYRI, kaldırılmaz ─────────
 * Spec `:245` (özet, `06-havacilik-uav.md`): *"Extended komutlarda komut-özel
 * ek CRC yapıları olabileceğinden frame CRC ile command CRC ayrı
 * tutulmalıdır."* TBS `crsf.md` "0x32 Direct Commands": Command_CRC8 poly
 * 0xBA, KAPSAM *"frame type (byte 0x32), Destination, Origin, Command ID and
 * Payload"* — yani Frame CRC'nin YERİNE değil ONA EK. Spec'in kendi notu:
 * *"Command CRC doesn't exclude CRC at the end of each CRSF frame. You will
 * also need to include CRC at the end for the full frame."* Frame CRC'nin
 * kapsamı (Type'tan başlar) bu yüzden Command_CRC8 baytını da İÇİNE alır —
 * iki CRC KATMANLIDIR, alternatif değil. Algoritma: CRC-8/CRSF-COMMAND (poly
 * 0xBA, aynı init/refin/refout/xorout) — katalogda `CRC8_CRSF_COMMAND`.
 * Command_ID VE payload'ı (spec'in `0x32.0xNN` alt tablolarında ayrı ayrı
 * yorumlanan komut-özel içerik) bu motorda AYRIŞTIRILMAZ — ikisi tek bir HAM
 * `Payload` alanında kalır (aşağıdaki "Payload yalnız 0x16 için" kararının
 * doğal uzantısı: Command_ID'nin anlamı da payload YORUMUdur).
 *
 * ── Genişletilmiş/broadcast ayrımı — sınır `0x28`, spec'in kendi cümlesi ───
 * TBS `crsf.md`: *"Frames with type 0x28 and higher (except explicitly
 * mentioned) have extended header (with destination and origin)."* Bu
 * dalganın kapsamındaki TÜM tipler (`0x02`-`0x32`, `0x7A`-`0x7D`) bu
 * istisnanın DIŞINDA — brifin verdiği tip listesinin kendisi tam bu sınırda
 * ikiye ayrılıyor (broadcast: `0x02`-`0x21`, extended: `0x28`-`0x7D`), bu da
 * ayrımın bağımsız bir doğrulaması. `Command` (`0x32`) genişletilmiştir
 * (Command_CRC8'in KAPSAM notu Destination/Origin'i açıkça sayıyor, yukarı
 * bak) — bu tek başına `0x28` kuralının ikinci, dolaylı kanıtı.
 *
 * ── `0x16 RC Channels Packed` — 15c'nin yardımcısını TÜKETİR ──────────────
 * 16×11 bit, `lsb-first` — `readPackedChannels(payload, 0, 16, 11,
 * 'lsb-first')`, `packedChannels.ts`ten import edilir (YENİ okuyucu
 * YAZILMAZ, `sbus.ts`ten de import EDİLMEZ — protokoller birbirinden import
 * etmez). Ham + türetilmiş µs İKİ AYRI `ParsedField`dir; `unit: 'µs'` YALNIZ
 * türetilmiş alanda (`types.ts:46`, ham paketli değer fiziksel büyüklük
 * değildir). Dönüşüm TBS `crsf.md`den BİREBİR:
 *   `TICKS_TO_US(x) = (x - 992) * 5 / 8 + 1500`  (Center 1500µs = 992)
 * SBUS'un aksine bu ampirik bir alıcı-kalibrasyonu DEĞİL, protokolce TANIMLI
 * bir eşleme (`sbus_channels.c:93-95`teki *"Linear fitting … comparing with
 * values received by X4R"* yorumunun YOKLUĞU — CRSF'in formülü spec metninin
 * kendisinde, tek bir alıcıya uydurma değil). **Tam sayı bölmesi C
 * yarısıdır**: `(x-992)*5` negatif olabilir (x<992, CRSF'in gerçekçi kanal
 * aralığının BÜYÜK kısmı budur) ve C'nin `/`si SIFIRA DOĞRU keser
 * (`Math.trunc`), `Math.floor`E DOĞRU DEĞİL — ikisi farklı sonuç verir
 * (`ticksToUs.test` benzeri kanıt `crsf.test.ts`te: x=100 → trunc 943,
 * floor 942). Bu YÜZDEN `ticksToUs` burada `Math.trunc` kullanır,
 * `Math.floor` KULLANMAZ — 12f'in "chunk boyutunu ondalık okumak küçük
 * örneklerde çalışır" tuzağının aynı sınıfı, yalnız işaret yönünde.
 * **Ölçek fonksiyonu `packedChannels.ts`e EKLENMEZ** — SBUS'un (173…1812,
 * kullanıcı kalibrasyonu) ve CRSF'in (protokolce tanımlı `TICKS_TO_US`)
 * ölçekleri FARKLI; ortak bir dönüştürücü birini sessizce yanlış ölçekler
 * (12d'nin `networkTimestamp` vakası: NTP 2⁻³² kesir vs PTP tam sayı ns,
 * 4295 kat hata — aynı ders).
 *
 * ── `0x17`/`0x18` — kapsam DIŞI, satıcı UYARISI ───────────────────────────
 * TBS `crsf.md:550-551` birebir: **WARNING** *"This frame is discouraged for
 * implementation. Revision is in progress."* Kaynağın KENDİSİ kararsızsa
 * uygulamak uydurmaktır → tip ADLANDIRILIR (sözlük doğrulanmış), payload
 * ÇÖZÜLMEZ, ham + `frameTypeDiscouragedByVendor` uyarısı. `0x18` ("RC
 * Channels Packed 11-bits (Unused)") spec'in kendi başlığıyla zaten
 * "Unused" — AYNI muamele.
 *
 * ── Payload yalnız `0x16` için çözülür — bu bir KAPSAM DARALTMASI DEĞİL ────
 * `mavlink.ts`in "PAYLOAD HAM" kararının aynısı: telemetri çerçevelerinin
 * (`0x02`-`0x21`) ve parametre/komut çerçevelerinin (`0x28`-`0x7D`) alan
 * düzenlerini tek tek uygulamak bu alt dalganın kapsamını katlar, her biri
 * ayrı doğrulama ister. Diğer tiplerin payload'ı HAM +
 * `payloadNotDecodedForFrameType` uyarısı. Kayıt yine de `ready` kapanır —
 * ÇERÇEVE düzeyi (adres, uzunluk, tip, İKİ CRC, RC kanalları) TAM ve
 * doğrulanabilir; `sbus.ts`in checksum'sız `ready` kararıyla AYNI mantık
 * ("protokolde yok" ile "uygulanmadı" ayrımı — buradaki karşılığı "bu
 * dalganın kapsamı dışında bırakıldı, spec'in kendisi eksik değil").
 * `0x14 Link Statistics` de bu kurala tabidir: brif bunu "isteğe bağlı ikinci
 * hedef, zorunlu değil" olarak işaretledi (`brief-faz10-dalga15d.md`); süre
 * kısıtı yüzünden BU turda YAPILMADI, ham + aynı uyarıyla kalıyor — ileride
 * ayrı bir dalgada eklenmesi bu dosyanın kararını BOZMAZ.
 *
 * ── ALAN ADLANDIRMA (devralınan tuzaklar) ───────────────────────────────────
 * `ParsedField.offset`/`length` BAYT cinsindendir; 11-bit kanal alanı için
 * KAPSAYAN bayt aralığı verilir, bit ayrıntısı alan ADINDA (`CH1 (bit
 * 0:10)`). `ParsedField.id` KANAL İNDEKSİNİ taşır (`crsf-channel-0`…`-15` ve
 * türetilmiş `crsf-channel-0-us`…), offset'i DEĞİL — ardışık iki kanal aynı
 * baytı paylaşır (`sbus.ts`/`ibus.ts` ile aynı karar).
 *
 * ── `canParse` — DÖRT kanıt, aksi hâlde `0xC8` ile başlayan HER ŞEYİ çeker ──
 * 1. `data[0]` `CANPARSE_ADDRESS_EVIDENCE`te = `ADDRESS_NAMES`in TAMAMI.
 *    Yalnız `0xC8`i kabul etmek Betaflight'ın KENDİ bakış açısını (her zaman
 *    FC'ye gelen trafiği dinliyor) genel bir analizöre dayatırdı; bu araç veri
 *    yolunun HERHANGİ bir noktasından alınmış yakalamaları çözmeli.
 * 2. **`Type` `FRAME_TYPE_NAMES` sözlüğünde.** Bu kanıt ana thread'in 15d
 *    doğrulama turunda ÖLÇEREK eklendi ve `lengthByte=2` dejenere kalıbını
 *    adresten bağımsız olarak eler (`CANPARSE_ADDRESS_EVIDENCE` notu — kalıp
 *    olmadan on bir adresin ONUNDA geçiyordu).
 * 3. Frame Length dahili tutarlı (tipe göre asgari + azami 62) VE gerçek
 *    arabellek bu uzunluğu karşılıyor.
 * 4. **Frame CRC-8 PASS** (doğru kapsamla — yukarı bak). Command CRC
 *    `canParse`e GİRMEZ (command CRC yalnız `0x32`e özel ikincil bir
 *    doğrulamadır, kapıda değil `parse()` sonucunda raporlanır).
 * Dördü birden olmadan `0xC8` ile başlayan (bu değer AYNI ZAMANDA
 * CRSF_ADDRESS_FLIGHT_CONTROLLER) her çerçeveyi kendine çeker.
 * `rcCanParseRegistry.test.ts` (15c) bu bekçiyi GENİŞLETİR, yeni dosya
 * AÇILMAZ (zorunlu disiplin) ve ileri/ters yön ölçümünü CRSF için de yapar.
 *
 * ── Rozet: `ready` ─────────────────────────────────────────────────────────
 * Kaynak MÜKEMMEL (iki bağımsız kaynak birebir örtüşüyor), çerçeve düzeyi
 * TAM çözülür ve İKİ CRC de doğrulanır. Payload yalnız `0x16` için çözülmesi
 * (yukarı bak) `partial` gerekçesi DEĞİL.
 *
 * ── `decodeOptions`: `baudProfile` — ÇERÇEVEYİ ETKİLEMEZ, bilerek ─────────
 * Spec `:227` üç preset veriyor: `standard` (416666, varsayılan),
 * `fcCompatibility` (420000), `negotiated` (değer çağırandan gelir —
 * `vehiclePhy.ts`in "sabit gömülmez" disiplini). CRSF çerçevesi baytları
 * KENDİ İÇİNDE tam tanımlıdır (Frame Length alanı) — baud yalnız bir UART
 * ZAMANLAMA parametresidir ve hiçbir alanın DEĞERİNİ değiştirmez. Bu yüzden
 * `parse()` bu seçeneği çözülen ALANLARA hiç yansıtmaz; yalnız
 * `rawFrame.metadata.baudProfile`e yazar (ileride `timing` sekmesi
 * tüketebilsin diye, `ibus.ts`in `metadata.profile`siyle aynı biçimde) —
 * `decodeOptions`ta beyan edilmesi (`crsfPlugin.decodeOptions`) yine de
 * gereklidir (brif), çünkü seçenek `timing` görünümünün girdisidir, `decode`
 * sekmesinin değil.
 */

import { packedChannelByteSpan, readPackedChannels } from '@/protocol-core/decoding/packedChannels';
import { computeNamedCrc } from '@/protocol-core/checksums/crcCatalogue';
import { createRawFrame } from '@/protocol-core/types';
import type {
  DecodeOption,
  ExampleFrame,
  FrameDirection,
  ParseContext,
  ParseResult,
  ParsedField,
  ParsedFrame,
  ProtocolError,
  ProtocolParser,
  ProtocolPlugin,
  ProtocolWarning,
} from '@/protocol-core/types';

const PROTOCOL_ID = 'crsf';
/** Protokol adı veridir, çeviriye girmez (CLAUDE.md). */
const PROTOCOL_DISPLAY_NAME = 'CRSF';

const ADDRESS_OFFSET = 0;
const LENGTH_OFFSET = 1;
const TYPE_OFFSET = 2;
const HEADER_LENGTH = 2; // Address + Frame Length baytları — CRC kapsamının DIŞINDA (dosya başı).
/** Bu ikisini okumadan hiçbir alan güvenle kurulamaz — `data.length` altındaysa `success:false`. */
const MIN_READABLE_HEADER = TYPE_OFFSET + 1; // Address + Length + Type

const MAX_FRAME_SIZE = 64; // spec `:146`, `CRSF_FRAME_SIZE_MAX`.
const MAX_LENGTH_BYTE = MAX_FRAME_SIZE - HEADER_LENGTH; // 62.
const NON_PAYLOAD_LENGTH_BROADCAST = 2; // Type + Frame CRC.
const NON_PAYLOAD_LENGTH_EXTENDED = 4; // Type + Destination + Origin + Frame CRC.
/** Command_ID en az 1 bayttır (spec struct'ı zorunlu kılıyor) — Type+Dest+Origin+CommandID(≥1)+CommandCRC+FrameCRC. */
const NON_PAYLOAD_LENGTH_COMMAND = 6;

const EXTENDED_HEADER_THRESHOLD = 0x28; // TBS spec: "type 0x28 and higher … have extended header" (dosya başı).
const COMMAND_TYPE = 0x32;
const RC_CHANNELS_PACKED_TYPE = 0x16;
const SUBSET_RC_CHANNELS_PACKED_TYPE = 0x17;
const RC_CHANNELS_PACKED_11BIT_UNUSED_TYPE = 0x18;

const RC_CHANNEL_COUNT = 16;
const RC_CHANNEL_BITS = 11;
const RC_CHANNELS_PAYLOAD_LENGTH = 22; // 16 × 11 bit / 8.
const US_UNIT = 'µs';

// `TICKS_TO_US(x) = (x - 992) * 5 / 8 + 1500` (TBS crsf.md, dosya başı).
const TICKS_CENTER = 992;
const US_CENTER = 1500;
const US_PER_TICKS_NUMERATOR = 5;
const US_PER_TICKS_DENOMINATOR = 8;

/**
 * Betaflight `crsf_protocol.h:45-73` — bu dosyanın hangi kaynağı esas aldığı
 * ve güncel TBS spec'iyle neden çeliştiği dosya başında ayrıntılı yazılı.
 */
const ADDRESS_NAMES: Readonly<Record<number, string>> = {
  0x00: 'Broadcast',
  0x10: 'USB',
  0x80: 'TBS CORE PNP PRO',
  0xc0: 'Current Sensor',
  0xc2: 'GPS',
  0xc4: 'TBS Blackbox',
  0xc8: 'Flight Controller',
  0xcc: 'Race Tag',
  0xea: 'Radio Transmitter',
  0xec: 'CRSF Receiver',
  0xee: 'CRSF Transmitter',
};

/**
 * `canParse`in adres kanıtı `ADDRESS_NAMES`in TAMAMIDIR — ve DÖRDÜNCÜ bir
 * kanıt (`Type` sözlükte) bu yüzden gerekli.
 *
 * ÖLÇÜLMÜŞ ZAYIFLIK — `lengthByte=2` DEJENERE KALIBI. Asgari uzunlukta
 * (Type+CRC, payload YOK) Frame CRC'nin kapsamı TEK bir `Type` baytına iner.
 * `Type=0x00` olduğunda CRC-8/DVB-S2 (init 0x00, xorout 0x00, doğrusal) o tek
 * sıfır baytın CRC'sini de `0x00` üretir — yani `[adres, 0x02, 0x00, 0x00]`
 * kalıbı yapısal olarak "geçerli" bir CRSF çerçevesi gibi görünür. Bu kalıp
 * registry taramasında iki yanlış pozitif üretti
 * (`modbus-tcp/illegal-data-address-exception`,
 * `xcp-on-ethernet/empty-packet-header-only`), ikisi de `0x00` adresliydi.
 *
 * İLK DÜZELTME YETERSİZDİ ve ANA THREAD BUNU ÖLÇEREK BULDU: `0x00`ı adres
 * kanıtından çıkarmak yalnız GÖZLENEN iki örneği kapatıyordu, SINIFI değil.
 * Aynı dejenere kalıp kalan ON adresin (`0x10` … `0xEE`) HEPSİNDE geçiyordu —
 * ölçüm: `[addr, 0x02, 0x00, 0x00]` 0x10/0x80/0xC0/0xC2/0xC4/0xC8/0xCC/0xEA/
 * 0xEC/0xEE için `true`. Registry'nin "sıfır çakışma" sonucu imzanın değil
 * ÖRNEK KÜMESİNİN özelliğiydi — 14f'in "%54 yanlış pozitif" dersinin (imzayı
 * örnek kümesine uydurma) birebir tekrarı.
 *
 * İLKELİ DÜZELTME: `canParse` `Type`ın `FRAME_TYPE_NAMES`te olmasını da şart
 * koşar. `0x00` bir CRSF çerçeve tipi DEĞİLDİR, dolayısıyla dejenere kalıp
 * adresten BAĞIMSIZ olarak elenir — ve `0x00` Broadcast adres kanıtına GERİ
 * ALINABİLDİ (örnek kümesine uydurulmuş istisnaya gerek kalmadı). Tip
 * sözlüğü iki bağımsız kaynakta doğrulanmıştır (Betaflight
 * `crsf_protocol.h:45-73` + TBS `crsf.md`), yani bu kanıt kaynağa dayanır.
 *
 * TAKAS, açıkça: sözlükte OLMAYAN gerçek bir tip otomatik algılamada
 * yakalanmaz. Kabul edilebilir — `parse()` bilinmeyen tipi ham + uyarıyla
 * ÇÖZMEYE devam eder, yani kullanıcı CRSF'i elle seçtiğinde çerçeve yine
 * okunur; daralan yalnız otomatik-algılama KAPISI.
 */
const CANPARSE_ADDRESS_EVIDENCE: ReadonlySet<number> = new Set(
  Object.keys(ADDRESS_NAMES).map(Number),
);

/**
 * `crsf_protocol.h:45-73` + TBS `crsf.md` aynı listeyi taşıyor (dosya başı,
 * "KAYNAK"). `0x7A`/`0x7B` adları TBS spec'inin "0x7A MSP Request / 0x7B
 * Response" başlığından BİREBİR; `0x7C` YALNIZ Betaflight'ın enum'unda var
 * (`CRSF_FRAMETYPE_MSP_WRITE`) — TEK kaynaklı, ama brifin "0x7A/0x7B/0x7C
 * MSP" üçlüsüyle tutarlı ve Request/Response/Write üçlüsü MSP'nin kendi
 * modeliyle (istek/yanıt/yaz) örtüşüyor. Payload'ın İÇİ hiçbiri için
 * çözülmez (dosya başı) — bu sözlük yalnız TİP ADINI verir.
 */
const FRAME_TYPE_NAMES: Readonly<Record<number, string>> = {
  0x02: 'GPS',
  0x03: 'GPS Time',
  0x06: 'GPS Extended',
  0x07: 'Vario',
  0x08: 'Battery',
  0x09: 'Baro Altitude',
  0x0b: 'Heartbeat',
  0x11: 'Baro',
  0x12: 'Mag',
  0x13: 'AccGyro',
  0x14: 'Link Statistics',
  0x16: 'RC Channels Packed',
  0x17: 'Subset RC Channels Packed',
  0x18: 'RC Channels Packed 11-bits (Unused)',
  0x1c: 'Link Statistics RX',
  0x1d: 'Link Statistics TX',
  0x1e: 'Attitude',
  0x1f: 'MAVLink FC',
  0x21: 'Flight Mode',
  0x28: 'Device Ping',
  0x29: 'Device Info',
  0x2b: 'Parameter Settings Entry',
  0x2c: 'Parameter Read',
  0x2d: 'Parameter Write',
  0x32: 'Command',
  0x7a: 'MSP Request',
  0x7b: 'MSP Response',
  0x7c: 'MSP Write',
  0x7d: 'DisplayPort',
};

const OPTION_BAUD_PROFILE = 'baudProfile';
const BAUD_PROFILE_STANDARD = 'standard';
const BAUD_PROFILE_FC_COMPATIBILITY = 'fcCompatibility';
const BAUD_PROFILE_NEGOTIATED = 'negotiated';
const DEFAULT_BAUD_PROFILE = BAUD_PROFILE_STANDARD;

const DECODE_OPTIONS: readonly DecodeOption[] = [
  {
    id: OPTION_BAUD_PROFILE,
    label: 'protocol.crsf.option.baudProfile',
    kind: 'select',
    defaultValue: DEFAULT_BAUD_PROFILE,
    description: 'protocol.crsf.option.baudProfile.description',
    choices: [
      { value: BAUD_PROFILE_STANDARD, label: 'protocol.crsf.option.baudProfile.standard' },
      { value: BAUD_PROFILE_FC_COMPATIBILITY, label: 'protocol.crsf.option.baudProfile.fcCompatibility' },
      { value: BAUD_PROFILE_NEGOTIATED, label: 'protocol.crsf.option.baudProfile.negotiated' },
    ],
  },
];

const ERROR_BUFFER_TOO_SHORT = 'protocol.crsf.error.bufferTooShort';
const ERROR_FRAME_TRUNCATED = 'protocol.crsf.error.frameTruncated';
const ERROR_LENGTH_TOO_SHORT = 'protocol.crsf.error.lengthTooShort';
const ERROR_LENGTH_TOO_LONG = 'protocol.crsf.error.lengthTooLong';
const ERROR_UNKNOWN_ADDRESS = 'protocol.crsf.error.unknownAddress';
const ERROR_FRAME_CRC_MISMATCH = 'protocol.crsf.error.frameCrcMismatch';
const ERROR_COMMAND_CRC_MISMATCH = 'protocol.crsf.error.commandCrcMismatch';
const ERROR_ABORTED = 'protocol.crsf.error.aborted';

const WARN_PAYLOAD_NOT_DECODED = 'protocol.crsf.warning.payloadNotDecodedForFrameType';
const WARN_VENDOR_DISCOURAGED = 'protocol.crsf.warning.frameTypeDiscouragedByVendor';
const WARN_TRAILING_BYTES = 'protocol.crsf.warning.trailingBytes';

function byteAt(data: Uint8Array, offset: number): number {
  return data[offset] ?? 0;
}

function toProtocolWarning(key: string): ProtocolWarning {
  return { code: key, message: key };
}

function resolveAddressName(byte: number): string | undefined {
  return ADDRESS_NAMES[byte];
}

function resolveFrameTypeName(byte: number): string | undefined {
  return FRAME_TYPE_NAMES[byte];
}

function isExtendedFrameType(typeByte: number): boolean {
  return typeByte >= EXTENDED_HEADER_THRESHOLD;
}

/**
 * TBS `crsf.md`: `TICKS_TO_US(x) = (x - 992) * 5 / 8 + 1500` — C'nin tam
 * sayı bölmesi SIFIRA DOĞRU keser (`Math.trunc`), `Math.floor`E DOĞRU
 * DEĞİL. Negatif ara sonuçlarda (x<992, gerçekçi kanal aralığının büyük
 * kısmı) ikisi FARKLI sonuç verir — dosya başı notu, `crsf.test.ts`te
 * kanıtlanır.
 */
function ticksToUs(ticks: number): number {
  return Math.trunc(((ticks - TICKS_CENTER) * US_PER_TICKS_NUMERATOR) / US_PER_TICKS_DENOMINATOR) + US_CENTER;
}

/** Adres/hedef/köken alanları için ORTAK alan kurucusu — üçü de aynı sözlüğe bakar. */
function addressLikeField(
  data: Uint8Array,
  offset: number,
  id: string,
  name: string,
  options: { readonly strict: boolean },
): ParsedField {
  const byte = byteAt(data, offset);
  const resolvedName = resolveAddressName(byte);
  const valid = options.strict ? resolvedName !== undefined : true;
  return {
    id,
    name,
    offset,
    length: 1,
    rawBytes: data.slice(offset, offset + 1),
    rawValue: byte,
    ...(resolvedName === undefined ? {} : { physicalValue: resolvedName }),
    valid,
    warnings: [],
  };
}

/** Ham (paketlenmiş, ölçeklenmemiş) kanal alanı — `unit` BİLEREK yok (dosya başı). */
function rawChannelField(
  data: Uint8Array,
  payloadOffset: number,
  channelIndex: number,
  value: number,
): ParsedField {
  const span = packedChannelByteSpan(payloadOffset, channelIndex, RC_CHANNEL_BITS);
  return {
    id: `crsf-channel-${String(channelIndex)}`,
    name: `CH${String(channelIndex + 1)} (bit 0:10)`,
    offset: span.offset,
    length: span.length,
    rawBytes: data.slice(span.offset, span.offset + span.length),
    rawValue: value,
    valid: true,
    warnings: [],
  };
}

/**
 * Türetilmiş µs alanı — AYNI bayt aralığını (ham alanla PAYLAŞARAK) raporlar,
 * çünkü yeni bayt TÜKETMEZ, aynı paketli tam sayının protokolce tanımlı bir
 * dönüşümüdür. `unit: 'µs'` YALNIZ burada (dosya başı, `types.ts:46`).
 */
function derivedUsChannelField(
  data: Uint8Array,
  payloadOffset: number,
  channelIndex: number,
  rawValue: number,
): ParsedField {
  const span = packedChannelByteSpan(payloadOffset, channelIndex, RC_CHANNEL_BITS);
  return {
    id: `crsf-channel-${String(channelIndex)}-us`,
    name: `CH${String(channelIndex + 1)} (µs)`,
    offset: span.offset,
    length: span.length,
    rawBytes: data.slice(span.offset, span.offset + span.length),
    physicalValue: ticksToUs(rawValue),
    unit: US_UNIT,
    valid: true,
    warnings: [],
  };
}

function rawPayloadField(data: Uint8Array, start: number, end: number, warningKeys: readonly string[]): ParsedField {
  return {
    id: 'payload',
    name: 'Payload',
    offset: start,
    length: end - start,
    rawBytes: data.slice(start, end),
    valid: true,
    warnings: [...warningKeys],
  };
}

function crcField(id: string, name: string, data: Uint8Array, offset: number, computed: number): ParsedField {
  const transmitted = byteAt(data, offset);
  const ok = transmitted === computed;
  return {
    id,
    name,
    offset,
    length: 1,
    rawBytes: data.slice(offset, offset + 1),
    rawValue: transmitted,
    physicalValue: ok ? 'PASS' : 'FAIL',
    valid: ok,
    warnings: [],
  };
}

/** CRSF Frame CRC: CRC-8/DVB-S2, kapsam Type'tan başlar (dosya başı, en kritik karar). */
function computeFrameCrc(data: Uint8Array, frameCrcOffset: number): number {
  return Number(computeNamedCrc(data.slice(TYPE_OFFSET, frameCrcOffset), 'CRC8_DVB_S2'));
}

/** CRSF Command CRC: CRC-8/CRSF-COMMAND, kapsam Type'tan Command CRC baytının KENDİSİNE kadar (dosya başı). */
function computeCommandCrc(data: Uint8Array, commandCrcOffset: number): number {
  return Number(computeNamedCrc(data.slice(TYPE_OFFSET, commandCrcOffset), 'CRC8_CRSF_COMMAND'));
}

function resolveBaudProfile(options: Record<string, unknown> | undefined): string {
  const requested = typeof options?.[OPTION_BAUD_PROFILE] === 'string' ? options[OPTION_BAUD_PROFILE] : DEFAULT_BAUD_PROFILE;
  return requested === BAUD_PROFILE_FC_COMPATIBILITY || requested === BAUD_PROFILE_NEGOTIATED
    ? requested
    : BAUD_PROFILE_STANDARD;
}

interface CrsfParseOptions {
  timestamp?: number;
  direction?: FrameDirection;
  channel?: string;
  signal?: AbortSignal;
  options?: Record<string, unknown>;
}

function buildResult(
  data: Uint8Array,
  fields: ParsedField[],
  errors: ProtocolError[],
  warnings: ProtocolWarning[],
  parseOptions: CrsfParseOptions,
  baudProfile: string,
): ParseResult {
  const rawFrame = createRawFrame(data, {
    ...(parseOptions.timestamp === undefined ? {} : { timestamp: parseOptions.timestamp }),
    ...(parseOptions.direction === undefined ? {} : { direction: parseOptions.direction }),
    ...(parseOptions.channel === undefined ? {} : { channel: parseOptions.channel }),
    // Yalnız `timing` görünümü için — çözülen ALANLARI etkilemez (dosya başı).
    metadata: { baudProfile },
  });

  const frame: ParsedFrame = {
    protocol: PROTOCOL_ID,
    timestamp: rawFrame.timestamp,
    rawFrame,
    fields,
    valid: errors.length === 0,
    errors,
    warnings,
  };

  return { success: true, frame, consumedBytes: data.length };
}

function parseCrsfFrame(data: Uint8Array, parseOptions: CrsfParseOptions): ParseResult {
  if (parseOptions.signal?.aborted === true) {
    return {
      success: false,
      error: { code: 'parser-timeout', message: ERROR_ABORTED },
      consumedBytes: 0,
      recoverable: false,
    };
  }

  if (data.length < MIN_READABLE_HEADER) {
    return {
      success: false,
      error: {
        code: 'truncated-frame',
        message: ERROR_BUFFER_TOO_SHORT,
        offset: 0,
        length: data.length,
        details: { availableBytes: data.length, requiredBytes: MIN_READABLE_HEADER },
      },
      consumedBytes: 0,
      recoverable: true,
    };
  }

  const baudProfile = resolveBaudProfile(parseOptions.options);
  const errors: ProtocolError[] = [];
  const warnings: ProtocolWarning[] = [];
  const fields: ParsedField[] = [];

  // Adres — sözlükte yoksa `valid:false` + hata, ama geri kalan alanlar YİNE
  // DE çözülür (spec §47 "hatalı veride uygulamayı çökertme", sbus.ts/ibus.ts
  // ile aynı karar). CRC hesabı adrese hiç bakmaz (dosya başı) — bu yüzden
  // adres tanınmasa da CRC doğrulaması etkilenmez.
  const addressByte = byteAt(data, ADDRESS_OFFSET);
  const addressName = resolveAddressName(addressByte);
  const addressValid = addressName !== undefined;
  fields.push(addressLikeField(data, ADDRESS_OFFSET, 'address', 'Device / Sync Address', { strict: true }));
  if (!addressValid) {
    errors.push({
      code: 'start-delimiter-not-found',
      message: ERROR_UNKNOWN_ADDRESS,
      offset: ADDRESS_OFFSET,
      length: 1,
      details: { actual: addressByte, known: Object.keys(ADDRESS_NAMES).map(Number) },
    });
  }

  const typeByte = byteAt(data, TYPE_OFFSET);
  const isExtended = isExtendedFrameType(typeByte);
  const isCommand = typeByte === COMMAND_TYPE;
  const nonPayloadLength = isCommand
    ? NON_PAYLOAD_LENGTH_COMMAND
    : isExtended
      ? NON_PAYLOAD_LENGTH_EXTENDED
      : NON_PAYLOAD_LENGTH_BROADCAST;

  const lengthByte = byteAt(data, LENGTH_OFFSET);
  const totalFrameLength = HEADER_LENGTH + lengthByte;
  const lengthTooLong = lengthByte > MAX_LENGTH_BYTE;
  const lengthTooShortForType = lengthByte < nonPayloadLength;
  const lengthValid = !lengthTooLong && !lengthTooShortForType;

  fields.push({
    id: 'frame-length',
    name: 'Frame Length',
    offset: LENGTH_OFFSET,
    length: 1,
    rawBytes: data.slice(LENGTH_OFFSET, LENGTH_OFFSET + 1),
    rawValue: lengthByte,
    valid: lengthValid,
    warnings: [],
  });

  fields.push({
    id: 'type',
    name: 'Type',
    offset: TYPE_OFFSET,
    length: 1,
    rawBytes: data.slice(TYPE_OFFSET, TYPE_OFFSET + 1),
    rawValue: typeByte,
    ...(resolveFrameTypeName(typeByte) === undefined ? {} : { physicalValue: resolveFrameTypeName(typeByte) }),
    valid: true,
    warnings: [],
  });

  if (!lengthValid) {
    errors.push({
      code: lengthTooLong ? 'frame-too-long' : 'length-mismatch',
      message: lengthTooLong ? ERROR_LENGTH_TOO_LONG : ERROR_LENGTH_TOO_SHORT,
      offset: LENGTH_OFFSET,
      length: 1,
      details: { lengthByte, requiredMinimum: nonPayloadLength, maxLengthByte: MAX_LENGTH_BYTE, frameType: typeByte },
    });
    // Uzunluk kendi içinde tutarsız — Dest/Origin/Payload/CRC'nin nerede
    // başladığı GÜVENLE bilinemez, yalnız address+length+type gösterilir
    // (mavlink.ts'in "header shown, body not" deseni).
    return buildResult(data, fields, errors, warnings, parseOptions, baudProfile);
  }

  if (data.length < totalFrameLength) {
    errors.push({
      code: 'truncated-frame',
      message: ERROR_FRAME_TRUNCATED,
      offset: 0,
      length: data.length,
      details: { availableBytes: data.length, requiredBytes: totalFrameLength },
    });
    return buildResult(data, fields, errors, warnings, parseOptions, baudProfile);
  }

  let cursor = TYPE_OFFSET + 1;
  if (isExtended) {
    fields.push(addressLikeField(data, cursor, 'destination', 'Destination Address', { strict: false }));
    cursor += 1;
    fields.push(addressLikeField(data, cursor, 'origin', 'Origin Address', { strict: false }));
    cursor += 1;
  }

  const frameCrcOffset = totalFrameLength - 1;
  const commandCrcOffset = isCommand ? totalFrameLength - 2 : undefined;
  const payloadEnd = commandCrcOffset ?? frameCrcOffset;
  const payloadStart = cursor;
  const payloadLength = payloadEnd - payloadStart;

  if (typeByte === RC_CHANNELS_PACKED_TYPE && !isExtended && payloadLength >= RC_CHANNELS_PAYLOAD_LENGTH) {
    // `0x16` — bu motorun TEK payload-çözen dalı (dosya başı). Yeni okuyucu
    // YAZILMAZ, `sbus.ts`ten de import EDİLMEZ — `packedChannels.ts` (15c).
    const rawChannels = readPackedChannels(data, payloadStart, RC_CHANNEL_COUNT, RC_CHANNEL_BITS, 'lsb-first');
    rawChannels.forEach((value, index) => {
      fields.push(rawChannelField(data, payloadStart, index, value));
      fields.push(derivedUsChannelField(data, payloadStart, index, value));
    });
  } else {
    if (payloadLength > 0) {
      const isVendorDiscouraged =
        typeByte === SUBSET_RC_CHANNELS_PACKED_TYPE || typeByte === RC_CHANNELS_PACKED_11BIT_UNUSED_TYPE;
      const fieldWarnings = isVendorDiscouraged
        ? [WARN_PAYLOAD_NOT_DECODED, WARN_VENDOR_DISCOURAGED]
        : [WARN_PAYLOAD_NOT_DECODED];
      fields.push(rawPayloadField(data, payloadStart, payloadEnd, fieldWarnings));
    }
    warnings.push(toProtocolWarning(WARN_PAYLOAD_NOT_DECODED));
    if (typeByte === SUBSET_RC_CHANNELS_PACKED_TYPE || typeByte === RC_CHANNELS_PACKED_11BIT_UNUSED_TYPE) {
      warnings.push(toProtocolWarning(WARN_VENDOR_DISCOURAGED));
    }
  }

  // Command CRC ÖNCE (küçük offset, byte-order): Type..CommandCRC-1 kapsar.
  if (isCommand && commandCrcOffset !== undefined) {
    const computedCommandCrc = computeCommandCrc(data, commandCrcOffset);
    const commandCrcField = crcField('command-crc', 'Command CRC', data, commandCrcOffset, computedCommandCrc);
    fields.push(commandCrcField);
    if (!commandCrcField.valid) {
      errors.push({
        code: 'crc-mismatch',
        message: ERROR_COMMAND_CRC_MISMATCH,
        offset: commandCrcOffset,
        length: 1,
        details: { expected: computedCommandCrc, actual: byteAt(data, commandCrcOffset) },
      });
    }
  }

  // Frame CRC HER ZAMAN son alan — kapsamı Command CRC baytını da İÇERİR
  // (dosya başı, "Command CRC … Frame CRC'yi dışlamaz").
  const computedFrameCrc = computeFrameCrc(data, frameCrcOffset);
  const frameCrcField = crcField('frame-crc', 'Frame CRC', data, frameCrcOffset, computedFrameCrc);
  fields.push(frameCrcField);
  if (!frameCrcField.valid) {
    errors.push({
      code: 'crc-mismatch',
      message: ERROR_FRAME_CRC_MISMATCH,
      offset: frameCrcOffset,
      length: 1,
      details: { expected: computedFrameCrc, actual: byteAt(data, frameCrcOffset) },
    });
  }

  if (data.length > totalFrameLength) {
    const trailing = data.slice(totalFrameLength);
    fields.push({
      id: 'trailing-data',
      name: 'Trailing Data',
      offset: totalFrameLength,
      length: trailing.length,
      rawBytes: trailing,
      valid: false,
      warnings: [WARN_TRAILING_BYTES],
    });
    warnings.push(toProtocolWarning(WARN_TRAILING_BYTES));
  }

  return buildResult(data, fields, errors, warnings, parseOptions, baudProfile);
}

export function parseCrsf(data: Uint8Array, options?: Record<string, unknown>): ParseResult {
  return parseCrsfFrame(data, options === undefined ? {} : { options });
}

export const crsfParser: ProtocolParser = {
  protocolId: PROTOCOL_ID,
  displayName: PROTOCOL_DISPLAY_NAME,

  /**
   * ÜÇ kanıt (dosya başı) — üçü birden olmadan `0xC8` (CRSF_ADDRESS_FLIGHT_
   * CONTROLLER'la ÇAKIŞAN sync baytı) ile başlayan her şeyi kendine çeker.
   * Command CRC BURAYA girmez (yalnız `0x32`e özel — dosya başı).
   */
  canParse(data: Uint8Array): boolean {
    if (data.length < MIN_READABLE_HEADER) return false;
    if (!CANPARSE_ADDRESS_EVIDENCE.has(byteAt(data, ADDRESS_OFFSET))) return false;

    const typeByte = byteAt(data, TYPE_OFFSET);
    // DÖRDÜNCÜ kanıt — tip sözlükte olmalı. Bu OLMADAN `lengthByte=2` dejenere
    // kalıbı (`[adres, 0x02, 0x00, 0x00]`) her adres için geçiyor: CRC kapsamı
    // tek `Type` baytına iner ve `Type=0x00`ın CRC'si de 0x00'dır. Ölçüldü,
    // varsayılmadı — dosya başı `CANPARSE_ADDRESS_EVIDENCE` notu.
    if (!(typeByte in FRAME_TYPE_NAMES)) return false;

    const isExtended = isExtendedFrameType(typeByte);
    const isCommand = typeByte === COMMAND_TYPE;
    const nonPayloadLength = isCommand
      ? NON_PAYLOAD_LENGTH_COMMAND
      : isExtended
        ? NON_PAYLOAD_LENGTH_EXTENDED
        : NON_PAYLOAD_LENGTH_BROADCAST;

    const lengthByte = byteAt(data, LENGTH_OFFSET);
    if (lengthByte < nonPayloadLength || lengthByte > MAX_LENGTH_BYTE) return false;

    const totalFrameLength = HEADER_LENGTH + lengthByte;
    if (data.length < totalFrameLength) return false;

    const frameCrcOffset = totalFrameLength - 1;
    return computeFrameCrc(data, frameCrcOffset) === byteAt(data, frameCrcOffset);
  },

  parse(data: Uint8Array, context?: ParseContext): ParseResult {
    const options: CrsfParseOptions = {};
    if (context?.timestamp !== undefined) options.timestamp = context.timestamp;
    if (context?.direction !== undefined) options.direction = context.direction;
    if (context?.channel !== undefined) options.channel = context.channel;
    if (context?.signal !== undefined) options.signal = context.signal;
    if (context?.options !== undefined) options.options = context.options;
    return parseCrsfFrame(data, options);
  },
};

function crc8(bytes: readonly number[], poly: number): number {
  let crc = 0;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc & 0x80) !== 0 ? ((crc << 1) ^ poly) & 0xff : (crc << 1) & 0xff;
    }
  }
  return crc;
}

const FRAME_CRC_POLY = 0xd5;
const COMMAND_CRC_POLY = 0xba;

/**
 * 16 kanal: 0, 100, …, 1500 — `packedChannels.test.ts`teki `BitOrder` kanıt
 * fixture'ıyla (`sbus.ts`in de kullandığı) AYNI 22 bayt, çapraz doğrulanmış
 * (`sbus.ts` dosya başı notuyla AYNI gerekçe: iki dosya birbirini sessizce
 * çelişmesin).
 */
const RC_CHANNELS_PAYLOAD = [
  0x00, 0x20, 0x03, 0x32, 0x58, 0x02, 0x19, 0xfa, 0x60, 0x89, 0x57, 0x20, 0x23, 0x1c, 0xfa, 0x98, 0x08, 0x4b, 0x8a,
  0xe2, 0x95, 0xbb,
];

function buildBroadcastFrame(address: number, type: number, payload: readonly number[]): Uint8Array {
  const body = [type, ...payload];
  const crc = crc8(body, FRAME_CRC_POLY);
  return Uint8Array.from([address, body.length + 1, ...body, crc]);
}

function buildExtendedFrame(
  address: number,
  type: number,
  destination: number,
  origin: number,
  payload: readonly number[],
): Uint8Array {
  const body = [type, destination, origin, ...payload];
  const crc = crc8(body, FRAME_CRC_POLY);
  return Uint8Array.from([address, body.length + 1, ...body, crc]);
}

function buildCommandFrame(
  address: number,
  destination: number,
  origin: number,
  commandIdAndPayload: readonly number[],
  commandCrcOverride?: number,
): Uint8Array {
  const commandCrcScope = [COMMAND_TYPE, destination, origin, ...commandIdAndPayload];
  const commandCrc = commandCrcOverride ?? crc8(commandCrcScope, COMMAND_CRC_POLY);
  const frameCrcScope = [...commandCrcScope, commandCrc];
  const frameCrc = crc8(frameCrcScope, FRAME_CRC_POLY);
  return Uint8Array.from([address, frameCrcScope.length + 1, ...frameCrcScope, frameCrc]);
}

const RC_CHANNELS_PACKED_FRAME = buildBroadcastFrame(0xc8, RC_CHANNELS_PACKED_TYPE, RC_CHANNELS_PAYLOAD);

const COMMAND_FRAME_PASS = buildCommandFrame(0xc8, 0xec, 0xea, [0x01, 0x02]);
const COMMAND_CORRECT_COMMAND_CRC = crc8([COMMAND_TYPE, 0xec, 0xea, 0x01, 0x02], COMMAND_CRC_POLY);

const EXAMPLE_FRAMES: ExampleFrame[] = [
  {
    id: 'rc-channels-packed',
    name: 'protocol.crsf.example.rcChannelsPacked.name',
    bytes: RC_CHANNELS_PACKED_FRAME,
    description: 'protocol.crsf.example.rcChannelsPacked.description',
    expectedValid: true,
  },
  {
    id: 'subset-rc-channels-packed',
    name: 'protocol.crsf.example.subsetRcChannelsPacked.name',
    bytes: buildBroadcastFrame(0xc8, SUBSET_RC_CHANNELS_PACKED_TYPE, [0x11, 0x22, 0x33, 0x44]),
    description: 'protocol.crsf.example.subsetRcChannelsPacked.description',
    expectedValid: true,
  },
  {
    id: 'battery-sensor',
    name: 'protocol.crsf.example.batterySensor.name',
    bytes: buildBroadcastFrame(0xc8, 0x08, [0x01, 0x02, 0x03, 0x04]),
    description: 'protocol.crsf.example.batterySensor.description',
    expectedValid: true,
  },
  {
    id: 'device-ping',
    name: 'protocol.crsf.example.devicePing.name',
    bytes: buildExtendedFrame(0xc8, 0x28, 0x00, 0xea, []),
    description: 'protocol.crsf.example.devicePing.description',
    expectedValid: true,
  },
  {
    id: 'command',
    name: 'protocol.crsf.example.command.name',
    bytes: COMMAND_FRAME_PASS,
    description: 'protocol.crsf.example.command.description',
    expectedValid: true,
  },
  {
    id: 'command-crc-mismatch',
    name: 'protocol.crsf.example.commandCrcMismatch.name',
    // Command CRC baytı bozuldu; Frame CRC bu bozuk bayt ÜZERİNDEN yeniden
    // hesaplandığı için YİNE PASS eder — iki CRC'nin BAĞIMSIZ doğrulandığının
    // kanıtı (dosya başı "Command CRC … Frame CRC'yi dışlamaz").
    bytes: buildCommandFrame(0xc8, 0xec, 0xea, [0x01, 0x02], (COMMAND_CORRECT_COMMAND_CRC + 1) & 0xff),
    description: 'protocol.crsf.example.commandCrcMismatch.description',
    expectedValid: false,
  },
  {
    id: 'unrecognized-address',
    name: 'protocol.crsf.example.unrecognizedAddress.name',
    // `rc-channels-packed`in AYNISI, yalnız adres baytı sözlükte olmayan bir
    // değerle değiştirildi — CRC adrese bakmadığı için ETKİLENMEZ, kanallar
    // yine çözülür (spec §47, sbus.ts'in invalid-start-byte örneğiyle AYNI).
    bytes: Uint8Array.from([0x42, ...RC_CHANNELS_PACKED_FRAME.slice(1)]),
    description: 'protocol.crsf.example.unrecognizedAddress.description',
    expectedValid: false,
  },
  {
    id: 'frame-crc-mismatch',
    name: 'protocol.crsf.example.frameCrcMismatch.name',
    // `rc-channels-packed`in AYNISI, yalnız son bayt (Frame CRC) bozuldu.
    bytes: Uint8Array.from([
      ...RC_CHANNELS_PACKED_FRAME.slice(0, -1),
      ((RC_CHANNELS_PACKED_FRAME.at(-1) ?? 0) + 1) & 0xff,
    ]),
    description: 'protocol.crsf.example.frameCrcMismatch.description',
    expectedValid: false,
  },
];

export const crsfPlugin: ProtocolPlugin = {
  id: PROTOCOL_ID,
  name: PROTOCOL_DISPLAY_NAME,
  category: 'aerospace-uav',
  parser: crsfParser,
  decodeOptions: DECODE_OPTIONS,
  documentation: {
    summary: 'protocol.crsf.documentation.summary',
    layer: 'data-link',
    references: [
      {
        title: 'TBS — CRSF protocol specification (crsf.md)',
        url: 'https://github.com/tbs-fpv/tbs-crsf-spec/blob/main/crsf.md',
      },
      {
        title: 'Betaflight — rx/crsf.c, rx/crsf_protocol.h, common/crc.h',
        url: 'https://github.com/betaflight/betaflight/blob/master/src/main/rx/crsf.c',
      },
    ],
  },
  exampleFrames: EXAMPLE_FRAMES,
};
