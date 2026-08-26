/**
 * Mode S — ikincil gözetim transponder'ının ÇERÇEVE düzeyi. Faz 10, dalga 15h;
 * `surveillance` ailesinin İLK kaydı. Bu dosya ÇERÇEVEYİ çözer; DF17/18'in ME
 * alanının İÇİNİ `adsb.ts` çözer ve bağımlılık TEK YÖNLÜDÜR: `adsb.ts` buradan
 * `parseModeSFrameLayout()`u çağırır, bu dosya `adsb.ts`i BİLMEZ
 * (`xcpPacket.ts`in `xcpOnCan`/`xcpOnEthernet` ilişkisiyle aynı yön).
 *
 * ── GİRDİ: HAM MESAJ BAYTLARI, RF DEĞİL ────────────────────────────────────
 * 7 bayt (56 bit, kısa) ya da 14 bayt (112 bit, uzun). Demodülasyon parser'a
 * HİÇ girmez; spec özeti girdiyi kendisi sayıyor
 * (`06-havacilik-uav.md:349`): *"Toolkit'in doğrudan SDR demodulator olması
 * gerekmez; girdi: raw hex, Beast binary, SBS/BaseStation log, dump1090 JSON,
 * PCAP/custom receiver export olabilir."*
 *
 * **Bu kayıtta kapsam HAM HEX'tir.** Beast binary, SBS/BaseStation ve dump1090
 * JSON birer KONTEYNER biçimidir, tel değildir — bir konteyner çözücüsü bu
 * parser'ın ÖNÜNE gelir, içine değil (`dali.ts`/`psi5.ts`/`mil1553.ts`in
 * "girdi ham bayt dizisidir" kararının aynı sınıfı). Kapsam sayfa metninde
 * (katalog `summary`) açıkça yazılıdır.
 *
 * ── UZUNLUK KURALI: DF'İN 5. BİTİ ─────────────────────────────────────────
 * `DF & 0x10` uzunluğu belirler: **DF < 16 → 56 bit (7 bayt), DF ≥ 16 → 112 bit
 * (14 bayt)**. dump1090 aynısını `modesMessageLenByType(msg[0] >> 3)` ile
 * yapar; checksum tablosunun kendi notu da bunu söyler: *"For messages of 112
 * bit, the whole table is used. For messages of 56 bits only the last 56
 * elements are used."*
 *
 * Uzunluk ile DF çelişirse (7 baytlık girdide DF17 gibi) çerçeve REDDEDİLMEZ;
 * `lengthDoesNotMatchDownlinkFormat` uyarısıyla GENEL yerleşimle çözülür ve
 * parite DOĞRULANMAZ. Reddetmek kullanıcıdan bilgi saklamak olurdu (spec §47).
 *
 * ── DF24 TUZAĞI — İLK BEŞ BİT DEĞİL, İLK İKİ BİT ──────────────────────────
 * mode-s.org'un kendi uyarısı: *"Format number 24 is an exception. It is
 * identified using only the first two bits, which must be `11` in binary. All
 * following bits are used for encoding other information."*
 *
 * → DF çözümü ÖNCE ilk iki bite bakar. Naif bir `readBits(bytes, 0, 5)` DF24'ü
 * 24…31 arası RASTGELE bir sayı olarak okur ve çerçeveyi "tanımsız DF" diye
 * eler. Spec özeti bu istisnayı VERMİYOR (`:364` yalnız *"İlk bit'ler mesajın
 * DF tipini belirler"* diyor); istisna dış kaynaktan geldi ve İKİNCİ bir
 * kaynakla çaprazlandı: `pyModeS` `util.py:df()` *"Values 24-31 all denote the
 * same 'extended-length Comm-D' format in Annex 10, so the return is clamped at
 * 24 — matching every public Mode-S decoder including pyModeS v2, dump1090, and
 * rs1090."* İki kaynak AYNI kuralı iki farklı biçimde yazıyor (iki-bit testi ≡
 * ≥24 kırpması) ve bu dosya birinci biçimi kullanır, çünkü istisnayı GÖRÜNÜR
 * kılar: DF alanı DF24'te `bit 1:2` olarak adlandırılır, `bit 1:5` olarak
 * değil.
 *
 * ── EN İNCELİKLİ TUZAK: PARİTE ALANININ ANLAMI DF'E GÖRE DEĞİŞİR ──────────
 * Son 24 bit her çerçevede vardır ama AYNI ŞEY DEĞİLDİR. dump1090'ın kendi
 * yorumu (parite tablosunun hemen üstü):
 *
 *   *"Note: this function can be used with DF11 and DF17, other modes have the
 *   CRC xored with the sender address as they are reply to interrogations, but
 *   a casual listener can't split the address from the checksum."*
 *
 * `pyModeS` `util.py:icao()` AYNI ayrımı kodda gösteriyor: DF11/17/18'de adres
 * `msg[2:8]`ten DOĞRUDAN okunur, DF0/4/5/16/20/21'de `crc_remainder()`den
 * ÇIKARILIR, diğer DF'lerde `None` döner.
 *
 *   | DF                | son 24 bit            | ICAO adresi          | CRC     |
 *   |-------------------|-----------------------|----------------------|---------|
 *   | 11, 17, 18        | PI = CRC ⊕ II (II=0)  | bit 9:32'de AÇIK     | PASS/FAIL DOĞRULANIR |
 *   | 0, 4, 5, 16,20,21 | AP = CRC ⊕ ICAO       | AP ⊕ CRC ile ÇIKARILIR | DOĞRULANAMAZ |
 *   | 19, 24, atanmamış | anlamı KAMUYA AÇIK DEĞİL | çıkarılmaz        | DOĞRULANAMAZ |
 *
 * **Tek bir "CRC PASS" göstergesi YANLIŞTIR.** AP sınıfında her mesaj bir
 * "geçerli" adres üretir — çıkarım hiçbir zaman çürütülemez, dolayısıyla hiçbir
 * zaman doğrulanmış da değildir. Bu yüzden AP sınıfında `modes-crc-check` alanı
 * HİÇ BASILMAZ (basılıp "doğrulanamadı" demek, olmayan bir ölçümü varmış gibi
 * gösterirdi) ve çıkarılan adres KOŞULSUZ `icaoRecoveredNotVerified` uyarısı
 * taşır. Dalga 13 dersi 3'ün (*"gösterilir ile doğrulanır ayrımı KULLANICIYA
 * GÖRÜNÜR olmalı"*) bu kayıttaki karşılığı budur ve burada ayrım çerçeveden
 * çerçeveye DEĞİŞTİĞİ için her çerçevede ayrıca belirtilir.
 *
 * **DF24 ve DF19 için adres ÇIKARILMAZ.** Comm-D'nin AP alanı da adresle
 * XOR'lanmıştır (dump1090'ın "other modes" ifadesi onu da kapsar) ama `pyModeS`
 * DF24 için açıkça `None` döndürüyor. İki kaynak örtüşmediğinde alan
 * ADLANDIRILMAZ, ham kalır + uyarılır (dalga 13 dersi 5).
 *
 * **ICAO adresi Callsign DEĞİLDİR** — spec `:370` özellikle uyarıyor:
 * *"ICAO Address ile Callsign/Registration/Flight Number karıştırılmamalıdır."*
 * Bu dosya adresi yalnız 24 bitlik onaltılık kimlik olarak basar; kuyruk numarası
 * ya da uçuş numarası TÜRETMEZ (o eşleme bir veritabanı işidir, çerçevede yok).
 *
 * ── CRC-24: KATALOGDAKİ DÖRT 24-BİT GİRDİNİN HİÇBİRİ DEĞİL ────────────────
 * Yeni katalog girdisi `CRC24_MODE_S` (poly 0xFFF409, init 0, yansıtma yok,
 * xorout yok). Reddedilen dört sahte dost:
 *   `CRC24` (OpenPGP)  poly 0x864CFB init 0xB704CE — polinom DA init DE farklı
 *   `CRC24_Q`          poly 0x864CFB init 0x000000 — init aynı, POLİNOM farklı
 *   `CRC24_FLEXRAY_A`  poly 0x5D6DCB init 0xFEDCBA — ikisi de farklı
 *   `CRC24_FLEXRAY_B`  poly 0x5D6DCB init 0xABCDEF — ikisi de farklı
 * Dördü de 24 bittir ve dördü de burada SESSİZCE yanlış sonuç verirdi: çerçeve
 * çözülür, alanlar dolar, tek fark her DF17'nin "CRC FAIL" görünmesidir.
 * *"Aynı bit genişliği aynı CRC algoritması DEĞİLDİR"* (dalga 13 dersi 2)
 * kuralının yedinci vakası — gerekçesi ve üç bağımsız doğrulaması
 * `crcCatalogue.ts`teki `CRC24_MODE_S` girdisinin başındadır.
 *
 * **`crcBits()` ÇAĞRILMAZ**: 56 ve 112 bit, ikisi de tam bayt (7 ve 14).
 * `computeNamedCrc()` yeter.
 *
 * ── [Karar 15h-1] CRC DÜZELTME MOTORU BU DALGADA YAPILMADI ────────────────
 * Katalog `CRC Correction Candidates` aracını listeliyor ve spec örnek veriyor
 * (`:373`), ama spec AYNI yerde bir TASARIM KISITI da koyuyor (`:373`, `:541`):
 * *"Corrected mesaj hiçbir zaman native-valid frame ile aynı confidence
 * seviyesinde gösterilmemelidir."*
 *
 * Alt dalga brifinin önerisi uygulandı: **motor YAZILMADI**, dolayısıyla
 * `attemptCrcCorrection` seçeneği de AÇILMADI ve bu kayıtta `decodeOptions`
 * HİÇ yoktur. Gerekçe: domain'i kapatan alt dalgada opsiyonel bir motor riski
 * artırır ve kayıt onsuz da tam çözülüyor. Yapıldığında uyulacak kısıtlar
 * (yalnız tek-bit, AYRI alan, koşulsuz düşük-güven uyarısı, düzeltilmiş
 * baytların `adsb.ts`e GEÇMEMESİ) brifte yazılıdır. Sayfa metni bunu "ileride"
 * olarak söyler.
 *
 * ── NE ÇÖZÜLMEZ (kapsam, eksiklik değil) ──────────────────────────────────
 * • **Gövdenin DF'e özgü alt alanları** (DF4/5'in DR/UM/AC/ID'si, DF20/21'in
 *   MB'sinin BDS yorumu, DF0/16'nın VS/CC/SL/RI'si). Bu dosya ÇERÇEVE
 *   düzeyidir; gövde HAM basılır. DF17/18'in ME'si de burada ham kalır —
 *   onu `adsb.ts` çözer.
 * • **Altitude / squawk.** DF4'ün AC'si ve DF5'in ID'si 13 bitlik Gillham
 *   kodlu alanlardır; katalogun `mode-s` araç listesi bunları istemiyor
 *   (istediği: DF Decoder, Short/Extended Frame, ICAO Address, Payload,
 *   Parity/CRC). ADS-B tarafındaki altitude `adsb.ts`te ve orada da yalnız
 *   Q=1 dalında çözülür.
 * • **CA/CF/FS'in metin sözlüğü.** Alanın ADI iki kaynakla teyitli, ama
 *   değerlerin metin karşılığı tek kaynakta. Sayı basılır, metin BASILMAZ
 *   (`mil1553.ts`in mode code kararı).
 * • **Uçak tablosu, mesaj yaşı, çerçeveler arası her şey.** `mavlink.ts`in
 *   SEQ-LOSS kararı: çerçeveden üretilemeyen sayı parser'da üretilmez.
 *
 * ── `canParse` — ÜÇ KANIT, AMA HEPSİ HER DF'TE YOK ────────────────────────
 * Kabul ölçütü: uzunluk TAM 7 ya da 14 · DF ATANMIŞ bir değer · DF ile uzunluk
 * TUTARLI · ve DF ∈ {11, 17, 18} ise ayrıca **CRC PASS**.
 *
 * Üçüncü kanıt yalnız adres-açık sınıfında var; AP sınıfında (DF0/4/5/16/20/21)
 * doğrulanacak bir şey YOK, elde uzunluk + DF tutarlılığı kalıyor. Bu bir
 * eksiklik değil pasif yakalamanın matematiksel sınırıdır, ama YANLIŞ POZİTİF
 * ÜRETİR ve o yüzden ÖLÇÜLÜR: `surveillanceCanParseRegistry.test.ts` registry'nin
 * bütün örnekleri üzerinde sayıyı basar ve bir tavana bağlar.
 *
 * `ads-b`in `canParse`ı bunun DAHA DARIDIR (DF ∈ {17,18}, yani her zaman CRC
 * doğrulamalı). İkisinin AYNI çerçevede birden kabul etmesi BEKLENEN
 * davranıştır: aynı 14 baytı iki sayfa da açabilir, biri çerçeveyi biri ME'yi
 * gösterir.
 *
 * ── STATUS: 'ready' — GEREKÇE ─────────────────────────────────────────────
 * Çerçeve düzeyinde çözülemeyen bir şey yok: uzunluk, DF (DF24 istisnasıyla),
 * adres sınıfı, gövde ve parite tam çözülüyor; CRC gerçekten doğrulanıyor
 * (doğrulanabildiği yerde) ve doğrulanamadığı yerde bunu SÖYLÜYOR. DF'e göre
 * değişen parite semantiği protokolün kendisidir, bir kapsam daraltması değil —
 * `partial` demek protokolde olmayan bir eksikliği bu kayda yüklemek olurdu.
 */

import { computeNamedCrc } from '@/protocol-core/checksums/crcCatalogue';
import { readBitsAsNumber } from '@/protocol-core/decoding/bitCursor';
import { createRawFrame } from '@/protocol-core/types';
import type {
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

const PROTOCOL_ID = 'mode-s';
const PROTOCOL_DISPLAY_NAME = 'Mode-S';

/** 56 bit = 7 bayt (kısa), 112 bit = 14 bayt (uzun). Aradaki hiçbir uzunluk geçerli değil. */
export const MODE_S_SHORT_BYTE_LENGTH = 7;
export const MODE_S_LONG_BYTE_LENGTH = 14;
/** Son 24 bit HER çerçevede vardır; anlamı DF'e göre değişir (dosya başı). */
const PARITY_BYTE_LENGTH = 3;
const BITS_PER_BYTE = 8;

/** ME/MB alanı: bit 33:88 → bayt 4..10 (yalnız uzun çerçevede). */
const PAYLOAD_FIRST_BIT = 33;
const PAYLOAD_LAST_BIT = 88;

/** DF'in kendisi ilk beş bittir — DF24 hariç, o ilk İKİ bitten tanınır. */
const DF_FIRST_BIT = 1;
const DF_LAST_BIT = 5;
const DF24_LAST_BIT = 2;
/** İlk iki bit `11` ise DF24 (mode-s.org'un kendi istisnası, dosya başı). */
const DF24_TWO_BIT_MARKER = 0b11;
export const DOWNLINK_FORMAT_COMM_D = 24;

/** DF'ten hemen sonraki 3 bit — adı DF'e göre değişir, bazı DF'lerde tek alan bile değil. */
const SUBFIELD_FIRST_BIT = 6;
const SUBFIELD_LAST_BIT = 8;
/** Adres-açık sınıfında ICAO adresi bit 9:32'de AÇIK durur. */
const ICAO_FIRST_BIT = 9;
const ICAO_LAST_BIT = 32;

/** DF ≥ 16 uzun çerçeve demektir; kural DF'in 5. bitidir (`DF & 0x10`). */
const LONG_FRAME_DF_THRESHOLD = 16;

/**
 * Son 24 bit CRC ⊕ II (II genelde 0) — yani CRC DOĞRUDAN doğrulanabilir ve
 * ICAO adresi ayrıca bit 9:32'de açık durur.
 */
const ADDRESS_EXPLICIT_FORMATS: readonly number[] = [11, 17, 18];
/**
 * Son 24 bit AP = CRC ⊕ ICAO — adres çıkarılabilir ama ÇÜRÜTÜLEMEZ, dolayısıyla
 * doğrulanmış da değildir (dump1090: *"a casual listener can't split the
 * address from the checksum"*).
 */
const ADDRESS_PARITY_FORMATS: readonly number[] = [0, 4, 5, 16, 20, 21];
/** ADS-B'nin taşındığı iki DF — `adsb.ts`in kabul ettiği küme. */
export const EXTENDED_SQUITTER_FORMATS: readonly number[] = [17, 18];
/** Comm-B: gövdenin ikinci yarısı MB alanıdır (ME DEĞİL — BDS yorumu ayrı iştir). */
const COMM_B_FORMATS: readonly number[] = [20, 21];
/** ICAO Annex 10'un atadığı downlink formatları; gerisi atanmamıştır. */
const ASSIGNED_FORMATS: readonly number[] = [0, 4, 5, 11, 16, 17, 18, 19, 20, 21, 24];

/**
 * DF adları — mode-s.org "Mode S format" tablosu ile brifin tablosu birebir
 * örtüşüyor. Alan ADI değil, alanın fiziksel karşılığı olarak basılır.
 */
const DOWNLINK_FORMAT_NAMES: Readonly<Record<number, string>> = {
  0: 'DF0 · Short air-air surveillance (ACAS)',
  4: 'DF4 · Surveillance, altitude reply',
  5: 'DF5 · Surveillance, identity reply',
  11: 'DF11 · All-Call reply',
  16: 'DF16 · Long air-air surveillance (ACAS)',
  17: 'DF17 · Extended squitter (ADS-B 1090ES)',
  18: 'DF18 · Extended squitter / non-transponder',
  19: 'DF19 · Military extended squitter',
  20: 'DF20 · Comm-B, altitude reply',
  21: 'DF21 · Comm-B, identity reply',
  24: 'DF24 · Comm-D (ELM)',
};

const ERROR_EMPTY = 'protocol.modeS.error.empty';
const ERROR_INVALID_LENGTH = 'protocol.modeS.error.invalidLength';
const ERROR_ABORTED = 'protocol.modeS.error.aborted';
const ERROR_FRAME_TOO_LONG = 'protocol.modeS.error.frameTooLong';
const ERROR_PARITY_MISMATCH = 'protocol.modeS.error.parityMismatch';

const WARN_PARITY_IS_ADDRESS_XOR_CRC = 'protocol.modeS.warning.parityIsAddressXorCrc';
const WARN_PARITY_SEMANTICS_UNKNOWN = 'protocol.modeS.warning.paritySemanticsUnknown';
const WARN_ICAO_RECOVERED_NOT_VERIFIED = 'protocol.modeS.warning.icaoRecoveredNotVerified';
const WARN_LENGTH_DOES_NOT_MATCH_DF = 'protocol.modeS.warning.lengthDoesNotMatchDownlinkFormat';
const WARN_DF_UNASSIGNED = 'protocol.modeS.warning.downlinkFormatUnassigned';
const WARN_DF24_TWO_BIT_EXCEPTION = 'protocol.modeS.warning.downlinkFormat24TwoBitException';

const FIELD_WARN_ICAO_RECOVERED = 'protocol.modeS.field.icaoRecoveredNotVerified';
const FIELD_WARN_PARITY_NOT_VERIFIABLE = 'protocol.modeS.field.parityNotVerifiable';
const FIELD_WARN_PARITY_SEMANTICS_UNKNOWN = 'protocol.modeS.field.paritySemanticsUnknown';
const FIELD_WARN_PARITY_MISMATCH = 'protocol.modeS.field.parityMismatch';
const FIELD_WARN_BODY_NOT_DECODED = 'protocol.modeS.field.bodySubfieldsNotDecoded';
const FIELD_WARN_ME_HANDOFF = 'protocol.modeS.field.messageExtendedSquitterHandoff';
const FIELD_WARN_MB_NOT_DECODED = 'protocol.modeS.field.commBMessageNotDecoded';
const FIELD_WARN_DF24_TWO_BIT = 'protocol.modeS.field.downlinkFormat24TwoBitException';
const FIELD_WARN_DF_UNASSIGNED = 'protocol.modeS.field.downlinkFormatUnassigned';
const FIELD_WARN_LENGTH_MISMATCH = 'protocol.modeS.field.lengthDoesNotMatchDownlinkFormat';

const CRC_PASS_TEXT = 'CRC PASS';
const CRC_FAIL_TEXT = 'CRC FAIL';

// ─── BİT/BAYT DÖNÜŞÜMÜ — TEK YER ─────────────────────────────────────────────

/**
 * 1 tabanlı bit numarası aralığını KAPSAYAN bayt aralığına çevirir.
 * `ParsedField.offset`/`length` BAYT cinsindendir (`types.ts:41-42`, kilitli
 * sözleşme); bit ayrıntısı alan ADINDA taşınır (`ICAO Address (bit 9:32)`).
 * **Bu dosyada bit→bayt aritmetiğini yapan TEK yer budur** (15f/15g disiplini).
 */
export function byteSpan(firstBit: number, lastBit: number): { offset: number; length: number } {
  const offset = Math.floor((firstBit - 1) / BITS_PER_BYTE);
  const last = Math.floor((lastBit - 1) / BITS_PER_BYTE);
  return { offset, length: last - offset + 1 };
}

/** 1 tabanlı bit aralığını sayı olarak okur. En geniş kullanım 24 bit — güvenli. */
export function readBitRange(data: Uint8Array, firstBit: number, lastBit: number): number {
  return readBitsAsNumber(data, firstBit - 1, lastBit - firstBit + 1, 'msb-first');
}

/** 24 bitlik kimlik/parite değerlerinin kanonik gösterimi: 6 haneli büyük harf hex. */
function toHex24(value: number): string {
  return value.toString(16).toUpperCase().padStart(6, '0');
}

function toHexBytes(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).toUpperCase().padStart(2, '0')).join('');
}

/**
 * DF çözümü — **ÖNCE ilk iki bit**. `11` ise DF24, değilse ilk beş bit.
 * Naif `readBits(bytes, 0, 5)` DF24'ü 24…31 arası rastgele okur (dosya başı).
 */
export function resolveDownlinkFormat(firstByte: number): number {
  const firstTwoBits = (firstByte >>> 6) & 0b11;
  if (firstTwoBits === DF24_TWO_BIT_MARKER) return DOWNLINK_FORMAT_COMM_D;
  return (firstByte >>> 3) & 0b11111;
}

/** DF'in 5. biti uzunluğu belirler: DF < 16 → 7 bayt, DF ≥ 16 → 14 bayt. */
export function expectedByteLengthForDownlinkFormat(downlinkFormat: number): number {
  return downlinkFormat < LONG_FRAME_DF_THRESHOLD
    ? MODE_S_SHORT_BYTE_LENGTH
    : MODE_S_LONG_BYTE_LENGTH;
}

/** Mode S CRC-24'ü: parite baytları HARİÇ, mesajın baştan gelen kısmı üzerinde. */
export function computeModeSCrc(data: Uint8Array): number {
  const covered = data.subarray(0, data.length - PARITY_BYTE_LENGTH);
  return Number(computeNamedCrc(covered, 'CRC24_MODE_S'));
}

// ─── ÇERÇEVE YERLEŞİMİ — `adsb.ts`in DE TÜKETTİĞİ TEK KAYNAK ─────────────────

/** Paritenin hangi anlam sınıfına düştüğü — DF'ten TÜRETİLİR, tahmin edilmez. */
export type ModeSParityClass =
  /** PI = CRC ⊕ II; CRC gerçekten doğrulanır (DF11/17/18). */
  | 'verifiable'
  /** AP = CRC ⊕ ICAO; adres çıkarılır ama doğrulanamaz (DF0/4/5/16/20/21). */
  | 'address-parity'
  /** Anlamı kamuya açık değil ya da DF atanmamış; hiçbir şey türetilmez. */
  | 'unknown';

export interface ModeSFrameLayout {
  readonly downlinkFormat: number;
  readonly parityClass: ModeSParityClass;
  /** DF24 ilk İKİ bitten tanındı mı — istisnanın görünür kanıtı. */
  readonly isCommDTwoBitException: boolean;
  readonly downlinkFormatAssigned: boolean;
  readonly lengthMatchesDownlinkFormat: boolean;
  /** Parite alanının 24 bitlik ham değeri (PI ya da AP). */
  readonly parityValue: number;
  /** Hesaplanan CRC-24 — HER çerçevede hesaplanır, yalnız yorumu değişir. */
  readonly computedCrc: number;
  /** Yalnız `verifiable` sınıfında anlamlı; diğerlerinde `undefined`. */
  readonly crcValid: boolean | undefined;
  /** Bit 9:32'den DOĞRUDAN okunan adres (adres-açık sınıfı) — yoksa `undefined`. */
  readonly icaoAddress: number | undefined;
  /** AP ⊕ CRC ile ÇIKARILAN adres (AP sınıfı) — yoksa `undefined`. */
  readonly recoveredIcaoAddress: number | undefined;
  /** DF17/18'in 56 bitlik ME alanı — `adsb.ts`in girdisi. Yoksa `undefined`. */
  readonly messageField: Uint8Array | undefined;
  readonly fields: ParsedField[];
  readonly warnings: ProtocolWarning[];
  readonly errors: ProtocolError[];
}

function parityClassOf(downlinkFormat: number): ModeSParityClass {
  if (ADDRESS_EXPLICIT_FORMATS.includes(downlinkFormat)) return 'verifiable';
  if (ADDRESS_PARITY_FORMATS.includes(downlinkFormat)) return 'address-parity';
  return 'unknown';
}

/**
 * DF'ten sonraki 3 bitin ADI — yalnız ambiguity OLMAYAN DF'lerde verilir.
 * DF0/16'da bu üç bit tek bir alan bile değildir (VS · CC · spare), DF19'un AF
 * alanı tek kaynakta, DF24'te bu bitler DF'ten sonraki ilk bitler bile değil.
 * Adlandırılamayan yerde alan BASILMAZ, gövdeye dâhil edilir (dalga 13 dersi 5).
 */
function subfieldNameFor(downlinkFormat: number): { id: string; name: string } | undefined {
  if (downlinkFormat === 11 || downlinkFormat === 17) {
    return { id: 'modes-capability', name: 'CA · Capability (bit 6:8)' };
  }
  if (downlinkFormat === 18) {
    return { id: 'modes-control-field', name: 'CF · Control Field (bit 6:8)' };
  }
  if (downlinkFormat === 4 || downlinkFormat === 5 || downlinkFormat === 20 || downlinkFormat === 21) {
    return { id: 'modes-flight-status', name: 'FS · Flight Status (bit 6:8)' };
  }
  return undefined;
}

interface FieldInput {
  readonly data: Uint8Array;
  readonly id: string;
  readonly name: string;
  readonly firstBit: number;
  readonly lastBit: number;
  readonly rawValue?: number | string;
  readonly physicalValue?: number | string;
  readonly valid?: boolean;
  readonly warnings?: string[];
}

/** `ParsedField` kurmanın ortak kabuğu — `unit` HİÇBİR alanda YOK (dosya başı). */
function buildField(input: FieldInput): ParsedField {
  const span = byteSpan(input.firstBit, input.lastBit);
  return {
    id: input.id,
    name: input.name,
    offset: span.offset,
    length: span.length,
    rawBytes: input.data.slice(span.offset, span.offset + span.length),
    ...(input.rawValue === undefined ? {} : { rawValue: input.rawValue }),
    ...(input.physicalValue === undefined ? {} : { physicalValue: input.physicalValue }),
    valid: input.valid ?? true,
    warnings: input.warnings ?? [],
  };
}

/**
 * Çerçeve düzeyi yerleşim — `mode-s`in kendi `parse()`i ve `adsb.ts` AYNI
 * fonksiyonu çağırır. İkinci bir kopya yazmak 12d'nin `networkTimestamp`
 * vakasının tekrarı olurdu: iki kopya sessizce ayrışır.
 *
 * Girdi uzunluğu ÇAĞIRAN tarafından doğrulanmış olmalıdır (7 ya da 14).
 */
export function parseModeSFrameLayout(data: Uint8Array): ModeSFrameLayout {
  const fields: ParsedField[] = [];
  const warnings: ProtocolWarning[] = [];
  const errors: ProtocolError[] = [];

  const firstByte = data[0] ?? 0;
  const downlinkFormat = resolveDownlinkFormat(firstByte);
  const isCommDTwoBitException = downlinkFormat === DOWNLINK_FORMAT_COMM_D;
  const downlinkFormatAssigned = ASSIGNED_FORMATS.includes(downlinkFormat);
  const lengthMatchesDownlinkFormat =
    data.length === expectedByteLengthForDownlinkFormat(downlinkFormat);

  const parityFirstBit = (data.length - PARITY_BYTE_LENGTH) * BITS_PER_BYTE + 1;
  const parityLastBit = data.length * BITS_PER_BYTE;
  const parityValue = readBitRange(data, parityFirstBit, parityLastBit);
  const computedCrc = computeModeSCrc(data);

  // Uzunluk ile DF çelişiyorsa parite hiçbir sınıfa güvenle atanamaz: DF17
  // sanılan 7 baytlık bir yığında son 24 bit ne PI'dır ne AP.
  const parityClass: ModeSParityClass = lengthMatchesDownlinkFormat
    ? parityClassOf(downlinkFormat)
    : 'unknown';

  // ── 1) DF alanı — DF24'te bit 1:2, diğer her yerde bit 1:5 ────────────────
  const dfLastBit = isCommDTwoBitException ? DF24_LAST_BIT : DF_LAST_BIT;
  const dfRawValue = readBitRange(data, DF_FIRST_BIT, dfLastBit);
  const dfFieldWarnings: string[] = [];
  if (isCommDTwoBitException) dfFieldWarnings.push(FIELD_WARN_DF24_TWO_BIT);
  if (!downlinkFormatAssigned) dfFieldWarnings.push(FIELD_WARN_DF_UNASSIGNED);
  if (!lengthMatchesDownlinkFormat) dfFieldWarnings.push(FIELD_WARN_LENGTH_MISMATCH);
  fields.push(
    buildField({
      data,
      id: 'modes-downlink-format',
      name: isCommDTwoBitException
        ? 'DF · Downlink Format (bit 1:2 = 11)'
        : 'DF · Downlink Format (bit 1:5)',
      firstBit: DF_FIRST_BIT,
      lastBit: dfLastBit,
      rawValue: dfRawValue,
      physicalValue: DOWNLINK_FORMAT_NAMES[downlinkFormat] ?? `DF${String(downlinkFormat)}`,
      valid: downlinkFormatAssigned,
      warnings: dfFieldWarnings,
    }),
  );

  if (isCommDTwoBitException) {
    warnings.push({
      code: 'downlinkFormat24TwoBitException',
      message: WARN_DF24_TWO_BIT_EXCEPTION,
      offset: 0,
      length: 1,
    });
  }
  if (!downlinkFormatAssigned) {
    warnings.push({ code: 'downlinkFormatUnassigned', message: WARN_DF_UNASSIGNED, offset: 0, length: 1 });
  }
  if (!lengthMatchesDownlinkFormat) {
    warnings.push({
      code: 'lengthDoesNotMatchDownlinkFormat',
      message: WARN_LENGTH_DOES_NOT_MATCH_DF,
      offset: 0,
      length: data.length,
    });
  }

  // ── 2) DF'ten sonraki 3 bit — yalnız adlandırılabildiği yerde ─────────────
  const subfield = lengthMatchesDownlinkFormat ? subfieldNameFor(downlinkFormat) : undefined;
  if (subfield !== undefined) {
    fields.push(
      buildField({
        data,
        id: subfield.id,
        name: subfield.name,
        firstBit: SUBFIELD_FIRST_BIT,
        lastBit: SUBFIELD_LAST_BIT,
        rawValue: readBitRange(data, SUBFIELD_FIRST_BIT, SUBFIELD_LAST_BIT),
      }),
    );
  }

  // ── 3) Adres ve gövde ─────────────────────────────────────────────────────
  let icaoAddress: number | undefined;
  let recoveredIcaoAddress: number | undefined;
  let messageField: Uint8Array | undefined;

  if (parityClass === 'verifiable') {
    icaoAddress = readBitRange(data, ICAO_FIRST_BIT, ICAO_LAST_BIT);
    fields.push(
      buildField({
        data,
        id: 'modes-icao-address',
        name: 'ICAO Address (bit 9:32)',
        firstBit: ICAO_FIRST_BIT,
        lastBit: ICAO_LAST_BIT,
        rawValue: icaoAddress,
        // Adresin fiziksel karşılığı 24 bitlik onaltılık kimliktir; kuyruk
        // numarası ya da callsign DEĞİLDİR (spec `:370`).
        physicalValue: toHex24(icaoAddress),
      }),
    );
  }

  const bodyFirstBit = subfield === undefined ? SUBFIELD_FIRST_BIT : ICAO_FIRST_BIT;

  if (lengthMatchesDownlinkFormat && EXTENDED_SQUITTER_FORMATS.includes(downlinkFormat)) {
    const span = byteSpan(PAYLOAD_FIRST_BIT, PAYLOAD_LAST_BIT);
    messageField = data.slice(span.offset, span.offset + span.length);
    fields.push(
      buildField({
        data,
        id: 'modes-me',
        name: 'ME · Extended Squitter Message (bit 33:88)',
        firstBit: PAYLOAD_FIRST_BIT,
        lastBit: PAYLOAD_LAST_BIT,
        // 56 bit `Number`e sığmaz; ham baytlar + onaltılık gösterim yeter.
        physicalValue: toHexBytes(messageField),
        warnings: [FIELD_WARN_ME_HANDOFF],
      }),
    );
  } else if (lengthMatchesDownlinkFormat && COMM_B_FORMATS.includes(downlinkFormat)) {
    // DF20/21'in gövdesi İKİ parçadır: DF'e özgü başlık (bit 9:32) ve MB.
    fields.push(
      buildField({
        data,
        id: 'modes-body',
        name: 'Reply Body (bit 9:32)',
        firstBit: ICAO_FIRST_BIT,
        lastBit: ICAO_LAST_BIT,
        rawValue: readBitRange(data, ICAO_FIRST_BIT, ICAO_LAST_BIT),
        warnings: [FIELD_WARN_BODY_NOT_DECODED],
      }),
    );
    const span = byteSpan(PAYLOAD_FIRST_BIT, PAYLOAD_LAST_BIT);
    fields.push(
      buildField({
        data,
        id: 'modes-mb',
        name: 'MB · Comm-B Message (bit 33:88)',
        firstBit: PAYLOAD_FIRST_BIT,
        lastBit: PAYLOAD_LAST_BIT,
        physicalValue: toHexBytes(data.slice(span.offset, span.offset + span.length)),
        warnings: [FIELD_WARN_MB_NOT_DECODED],
      }),
    );
  } else if (bodyFirstBit < parityFirstBit) {
    const bodyLastBit = parityFirstBit - 1;
    const span = byteSpan(bodyFirstBit, bodyLastBit);
    fields.push(
      buildField({
        data,
        id: 'modes-body',
        name: `Reply Body (bit ${String(bodyFirstBit)}:${String(bodyLastBit)})`,
        firstBit: bodyFirstBit,
        lastBit: bodyLastBit,
        physicalValue: toHexBytes(data.slice(span.offset, span.offset + span.length)),
        warnings: [FIELD_WARN_BODY_NOT_DECODED],
      }),
    );
  }

  // ── 4) Parite — ÜÇ AYRI ANLAM, ÜÇ AYRI RAPORLAMA ─────────────────────────
  const parityBitRange = `bit ${String(parityFirstBit)}:${String(parityLastBit)}`;

  if (parityClass === 'verifiable') {
    const crcValid = parityValue === computedCrc;
    fields.push(
      buildField({
        data,
        id: 'modes-parity',
        name: `PI · Parity / Interrogator Identifier (${parityBitRange})`,
        firstBit: parityFirstBit,
        lastBit: parityLastBit,
        rawValue: parityValue,
        physicalValue: toHex24(parityValue),
        valid: crcValid,
        warnings: crcValid ? [] : [FIELD_WARN_PARITY_MISMATCH],
      }),
    );
    // Hesaplanan CRC AYRI bir alandır: FAIL durumunda kullanıcı ne beklendiğini
    // görür, PASS durumunda "doğrulandı" iddiası bir alana bağlanmış olur.
    fields.push(
      buildField({
        data,
        id: 'modes-crc-check',
        name: 'CRC-24 Check (CRC24_MODE_S)',
        firstBit: parityFirstBit,
        lastBit: parityLastBit,
        rawValue: computedCrc,
        physicalValue: crcValid ? CRC_PASS_TEXT : `${CRC_FAIL_TEXT} (0x${toHex24(computedCrc)})`,
        valid: crcValid,
      }),
    );
    if (!crcValid) {
      errors.push({
        code: 'crc-mismatch',
        message: ERROR_PARITY_MISMATCH,
        offset: data.length - PARITY_BYTE_LENGTH,
        length: PARITY_BYTE_LENGTH,
        details: { expected: computedCrc, actual: parityValue },
      });
    }
    return {
      downlinkFormat,
      parityClass,
      isCommDTwoBitException,
      downlinkFormatAssigned,
      lengthMatchesDownlinkFormat,
      parityValue,
      computedCrc,
      crcValid,
      icaoAddress,
      recoveredIcaoAddress,
      messageField,
      fields,
      warnings,
      errors,
    };
  }

  if (parityClass === 'address-parity') {
    recoveredIcaoAddress = (parityValue ^ computedCrc) & 0xffffff;
    fields.push(
      buildField({
        data,
        id: 'modes-parity',
        name: `AP · Address / Parity (${parityBitRange})`,
        firstBit: parityFirstBit,
        lastBit: parityLastBit,
        rawValue: parityValue,
        physicalValue: toHex24(parityValue),
        // `valid` TRUE kalır: alan yapısal olarak okunabildi. Okunamayan şey
        // doğruluğu değil, doğrulanabilirliği — o da uyarıyla söylenir.
        warnings: [FIELD_WARN_PARITY_NOT_VERIFIABLE],
      }),
    );
    fields.push(
      buildField({
        data,
        id: 'modes-icao-recovered',
        name: 'ICAO Address (AP ⊕ CRC ile çıkarıldı)',
        firstBit: parityFirstBit,
        lastBit: parityLastBit,
        rawValue: recoveredIcaoAddress,
        physicalValue: toHex24(recoveredIcaoAddress),
        warnings: [FIELD_WARN_ICAO_RECOVERED],
      }),
    );
    warnings.push({
      code: 'parityIsAddressXorCrc',
      message: WARN_PARITY_IS_ADDRESS_XOR_CRC,
      offset: data.length - PARITY_BYTE_LENGTH,
      length: PARITY_BYTE_LENGTH,
    });
    warnings.push({
      code: 'icaoRecoveredNotVerified',
      message: WARN_ICAO_RECOVERED_NOT_VERIFIED,
      offset: data.length - PARITY_BYTE_LENGTH,
      length: PARITY_BYTE_LENGTH,
    });
    return {
      downlinkFormat,
      parityClass,
      isCommDTwoBitException,
      downlinkFormatAssigned,
      lengthMatchesDownlinkFormat,
      parityValue,
      computedCrc,
      crcValid: undefined,
      icaoAddress,
      recoveredIcaoAddress,
      messageField,
      fields,
      warnings,
      errors,
    };
  }

  // `unknown`: DF19, DF24, atanmamış DF'ler ve uzunluk-DF çelişkisi. Hiçbir
  // şey türetilmez — adres ÇIKARILMAZ (pyModeS DF24 için açıkça `None` döner).
  fields.push(
    buildField({
      data,
      id: 'modes-parity',
      name: `Parity Field (${parityBitRange})`,
      firstBit: parityFirstBit,
      lastBit: parityLastBit,
      rawValue: parityValue,
      physicalValue: toHex24(parityValue),
      warnings: [FIELD_WARN_PARITY_SEMANTICS_UNKNOWN],
    }),
  );
  warnings.push({
    code: 'paritySemanticsUnknown',
    message: WARN_PARITY_SEMANTICS_UNKNOWN,
    offset: data.length - PARITY_BYTE_LENGTH,
    length: PARITY_BYTE_LENGTH,
  });

  return {
    downlinkFormat,
    parityClass,
    isCommDTwoBitException,
    downlinkFormatAssigned,
    lengthMatchesDownlinkFormat,
    parityValue,
    computedCrc,
    crcValid: undefined,
    icaoAddress,
    recoveredIcaoAddress,
    messageField,
    fields,
    warnings,
    errors,
  };
}

// ─── PARSER ──────────────────────────────────────────────────────────────────

export interface ModeSParseOptions {
  timestamp?: number;
  direction?: FrameDirection;
  channel?: string;
  maxFrameLength?: number;
  signal?: AbortSignal;
}

/**
 * Uzunluk ön kontrolü — `mode-s` ve `ads-b` AYNI kontrolü kullanır.
 * Başarısızlıkta hazır `ParseResult` döner, başarıda `undefined`.
 */
export interface ModeSLengthErrorMessages {
  readonly empty: string;
  readonly invalidLength: string;
  readonly aborted: string;
  readonly frameTooLong: string;
}

export function rejectInvalidModeSLength(
  data: Uint8Array,
  parseOptions: ModeSParseOptions,
  messages: ModeSLengthErrorMessages,
): ParseResult | undefined {
  if (parseOptions.signal?.aborted === true) {
    return {
      success: false,
      error: { code: 'parser-timeout', message: messages.aborted },
      consumedBytes: 0,
      recoverable: false,
    };
  }
  if (data.length === 0) {
    return {
      success: false,
      error: { code: 'truncated-frame', message: messages.empty, offset: 0, length: 0 },
      consumedBytes: 0,
      recoverable: true,
    };
  }
  if (parseOptions.maxFrameLength !== undefined && data.length > parseOptions.maxFrameLength) {
    return {
      success: false,
      error: {
        code: 'frame-too-long',
        message: messages.frameTooLong,
        offset: parseOptions.maxFrameLength,
        length: data.length - parseOptions.maxFrameLength,
        details: { maxFrameLength: parseOptions.maxFrameLength, frameLength: data.length },
      },
      consumedBytes: 0,
      recoverable: false,
    };
  }
  if (data.length !== MODE_S_SHORT_BYTE_LENGTH && data.length !== MODE_S_LONG_BYTE_LENGTH) {
    // Mode S'te ARA uzunluk yoktur: 56 ya da 112 bit. 13 baytlık bir yığın
    // "eksik uzun çerçeve"dir ve hangi alanın kesildiği bilinemez.
    return {
      success: false,
      error: {
        code: 'truncated-frame',
        message: messages.invalidLength,
        offset: 0,
        length: data.length,
        details: {
          frameLength: data.length,
          shortFrameLength: MODE_S_SHORT_BYTE_LENGTH,
          longFrameLength: MODE_S_LONG_BYTE_LENGTH,
        },
      },
      consumedBytes: 0,
      recoverable: true,
    };
  }
  return undefined;
}

function parseModeSFrame(data: Uint8Array, parseOptions: ModeSParseOptions): ParseResult {
  const rejection = rejectInvalidModeSLength(data, parseOptions, {
    empty: ERROR_EMPTY,
    invalidLength: ERROR_INVALID_LENGTH,
    aborted: ERROR_ABORTED,
    frameTooLong: ERROR_FRAME_TOO_LONG,
  });
  if (rejection !== undefined) return rejection;

  const layout = parseModeSFrameLayout(data);

  const rawFrame = createRawFrame(data, {
    ...(parseOptions.timestamp === undefined ? {} : { timestamp: parseOptions.timestamp }),
    ...(parseOptions.direction === undefined ? {} : { direction: parseOptions.direction }),
    ...(parseOptions.channel === undefined ? {} : { channel: parseOptions.channel }),
  });

  const frame: ParsedFrame = {
    protocol: PROTOCOL_ID,
    timestamp: rawFrame.timestamp,
    rawFrame,
    fields: layout.fields,
    valid: layout.errors.length === 0,
    errors: layout.errors,
    warnings: layout.warnings,
  };

  return { success: true, frame, consumedBytes: data.length };
}

export function parseModeS(data: Uint8Array): ParseResult {
  return parseModeSFrame(data, {});
}

/**
 * `canParse` — üç kanıt, ama üçüncüsü yalnız adres-açık sınıfında var
 * (dosya başı). Ölçüm `surveillanceCanParseRegistry.test.ts`te.
 */
export function canParseModeS(data: Uint8Array): boolean {
  if (data.length !== MODE_S_SHORT_BYTE_LENGTH && data.length !== MODE_S_LONG_BYTE_LENGTH) {
    return false;
  }
  const downlinkFormat = resolveDownlinkFormat(data[0] ?? 0);
  if (!ASSIGNED_FORMATS.includes(downlinkFormat)) return false;
  if (data.length !== expectedByteLengthForDownlinkFormat(downlinkFormat)) return false;
  if (ADDRESS_EXPLICIT_FORMATS.includes(downlinkFormat)) {
    const parityValue = readBitRange(
      data,
      (data.length - PARITY_BYTE_LENGTH) * BITS_PER_BYTE + 1,
      data.length * BITS_PER_BYTE,
    );
    return parityValue === computeModeSCrc(data);
  }
  return true;
}

export const modeSParser: ProtocolParser = {
  protocolId: PROTOCOL_ID,
  displayName: PROTOCOL_DISPLAY_NAME,
  canParse: canParseModeS,
  parse(data: Uint8Array, context?: ParseContext): ParseResult {
    const options: ModeSParseOptions = {};
    if (context?.timestamp !== undefined) options.timestamp = context.timestamp;
    if (context?.direction !== undefined) options.direction = context.direction;
    if (context?.channel !== undefined) options.channel = context.channel;
    if (context?.maxFrameLength !== undefined) options.maxFrameLength = context.maxFrameLength;
    if (context?.signal !== undefined) options.signal = context.signal;
    return parseModeSFrame(data, options);
  },
};

// ─── ÖRNEK ÇERÇEVELER ────────────────────────────────────────────────────────

export function modeSBytesFromHex(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let index = 0; index < out.length; index += 1) {
    out[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  }
  return out;
}

/**
 * mode-s.org'un yayımlı ADS-B örnekleri — DÖRDÜ DE gerçek yakalamalardır ve
 * dördünün de CRC'si bu motorla PASS eder (`modeS.test.ts` tek tek kanıtlar).
 */
export const EXAMPLE_DF17_IDENTIFICATION = '8D4840D6202CC371C32CE0576098';
export const EXAMPLE_DF17_POSITION_EVEN = '8D40621D58C382D690C8AC2863A7';
export const EXAMPLE_DF17_POSITION_ODD = '8D40621D58C386435CC412692AD6';
export const EXAMPLE_DF17_VELOCITY = '8D485020994409940838175B284F';
/** `pyModeS` doctest'inin mesajı — ikinci bir bağımsız kaynaktan gerçek yakalama. */
export const EXAMPLE_DF17_IDENTIFICATION_EZY = '8D406B902015A678D4D220AA4BDA';
/**
 * Gerçek bir DF20 Comm-B yanıtı (`pyModeS` `tests/test_commb.py`). MB alanı
 * `202CC371C31DE0` — DF17'nin ME'siyle AYNI GÖRÜNÜR ama BDS 2,0'dır, Type Code
 * DEĞİLDİR. `adsb.ts`in bu çerçeveyi REDDETMESİNİN somut sebebi budur.
 */
export const EXAMPLE_DF20_COMM_B = 'A000083E202CC371C31DE0AA1CCF';

/**
 * AP sınıfının örnekleri KURULDU, yakalanmadı: AP = CRC ⊕ ICAO kuralı
 * uygulanarak bilinen bir adrese (`pyModeS` `tests/test_surv.py`in kullandığı
 * 0x400940 ve mode-s.org örneklerinin 0x4840D6'sı) oturtuldu. Kurulmuş olmaları
 * bu kayıtta bir zayıflık DEĞİL, tam tersine gösterilmek isteneni gösteriyor:
 * çıkarılan adres her zaman "geçerli" görünür, çünkü kuralın kendisi tersine
 * çevrilebilir.
 */
const EXAMPLE_DF11_ALL_CALL = '5D4840D6F8740F';
const EXAMPLE_DF4_ALTITUDE = '20001030219677';
const EXAMPLE_DF5_IDENTITY = '280005A258D8F3';
/** İlk bayt 0xE7 → ilk beş bit 28, ama ilk İKİ bit `11` → DF24. İstisnanın kanıtı. */
const EXAMPLE_DF24_COMM_D = 'E7123456789ABCDEF01122E38FB8';
/** Bir ME baytı bozuldu; PI dokunulmadı → CRC FAIL. */
const EXAMPLE_DF17_CRC_FAIL = '8D4840D6202CC271C32CE0576098';

const EXAMPLE_FRAMES: ExampleFrame[] = [
  {
    id: 'df17-identification',
    name: 'protocol.modeS.example.df17Identification.name',
    bytes: modeSBytesFromHex(EXAMPLE_DF17_IDENTIFICATION),
    description: 'protocol.modeS.example.df17Identification.description',
    expectedValid: true,
  },
  {
    id: 'df17-airborne-position',
    name: 'protocol.modeS.example.df17AirbornePosition.name',
    bytes: modeSBytesFromHex(EXAMPLE_DF17_POSITION_EVEN),
    description: 'protocol.modeS.example.df17AirbornePosition.description',
    expectedValid: true,
  },
  {
    id: 'df17-crc-fail',
    name: 'protocol.modeS.example.df17CrcFail.name',
    bytes: modeSBytesFromHex(EXAMPLE_DF17_CRC_FAIL),
    description: 'protocol.modeS.example.df17CrcFail.description',
    expectedValid: false,
  },
  {
    id: 'df11-all-call-reply',
    name: 'protocol.modeS.example.df11AllCall.name',
    bytes: modeSBytesFromHex(EXAMPLE_DF11_ALL_CALL),
    description: 'protocol.modeS.example.df11AllCall.description',
    expectedValid: true,
  },
  {
    id: 'df4-surveillance-altitude',
    name: 'protocol.modeS.example.df4Altitude.name',
    bytes: modeSBytesFromHex(EXAMPLE_DF4_ALTITUDE),
    description: 'protocol.modeS.example.df4Altitude.description',
    expectedValid: true,
  },
  {
    id: 'df5-surveillance-identity',
    name: 'protocol.modeS.example.df5Identity.name',
    bytes: modeSBytesFromHex(EXAMPLE_DF5_IDENTITY),
    description: 'protocol.modeS.example.df5Identity.description',
    expectedValid: true,
  },
  {
    id: 'df20-comm-b',
    name: 'protocol.modeS.example.df20CommB.name',
    bytes: modeSBytesFromHex(EXAMPLE_DF20_COMM_B),
    description: 'protocol.modeS.example.df20CommB.description',
    expectedValid: true,
  },
  {
    id: 'df24-comm-d',
    name: 'protocol.modeS.example.df24CommD.name',
    bytes: modeSBytesFromHex(EXAMPLE_DF24_COMM_D),
    description: 'protocol.modeS.example.df24CommD.description',
    expectedValid: true,
  },
  {
    id: 'length-mismatch',
    name: 'protocol.modeS.example.lengthMismatch.name',
    // DF17 (uzun çerçeve DF'i) ama 7 bayt — çelişki uyarıyla raporlanır.
    bytes: modeSBytesFromHex('8D4840D6202CC3'),
    description: 'protocol.modeS.example.lengthMismatch.description',
    expectedValid: true,
  },
  {
    id: 'invalid-length',
    name: 'protocol.modeS.example.invalidLength.name',
    // 10 bayt — ne 7 ne 14; Mode S'te ara uzunluk YOKTUR.
    bytes: modeSBytesFromHex('8D4840D6202CC371C32C'),
    description: 'protocol.modeS.example.invalidLength.description',
    expectedValid: false,
  },
];

export const modeSPlugin: ProtocolPlugin = {
  id: PROTOCOL_ID,
  name: PROTOCOL_DISPLAY_NAME,
  category: 'aerospace-uav',
  parser: modeSParser,
  documentation: {
    summary: 'protocol.modeS.documentation.summary',
    layer: 'data-link',
  },
  exampleFrames: EXAMPLE_FRAMES,
  // `decodeOptions` YOK — `attemptCrcCorrection` bu dalgada yazılmadı
  // (dosya başı, [Karar 15h-1]).
};
