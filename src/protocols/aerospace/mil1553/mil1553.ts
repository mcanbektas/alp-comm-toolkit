/**
 * MIL-STD-1553 — 16-bit sözcük çözümü. Faz 10, dalga 15g; `avionics-data-buses`
 * ailesinin İKİNCİ ve SON kaydı (aile bu kayıtla KAPANIR).
 *
 * ── GİRDİ: 16-BİT SÖZCÜKLERİN BAYT DİZİSİ, MANCHESTER DALGASI DEĞİL ────────
 * `dali.ts`in *"GİRDİ HAM BAYT DİZİSİ, MANCHESTER KODLAMASI DEĞİL"* kararının
 * ve `psi5.ts:6-13`in birebir aynısı — depoda bu kararı yazan YEDİNCİ dosya
 * (`dali.ts`, `psi5.ts`, `wirelessMbus.ts`, `asInterface.ts`, `profibusDp.ts`,
 * `foundationFieldbus.ts` ve bu). **Manchester çözücü YAZILMADI.** Spec özeti
 * girdiyi kendisi sayıyor (`06-havacilik-uav.md:311`): *"Toolkit ilk aşamada
 * analog Manchester waveform acquisition zorunda değildir; girdiler: bus
 * analyzer log, CSV, TXT, vendor adapter export, raw decoded word list."*
 *
 * Girdi 2 baytın KATI olmalıdır; birden çok sözcük gelirse hepsi tek bir
 * yakalama bloğu olarak çözülür. Bu yüzden HER alan id'si sözcük İNDEKSİNİ
 * taşır (`mil1553-word-2-rt-address`) — yoksa ikinci sözcüğün alanları
 * birincininkiyle çakışırdı (`arinc429.ts`in 15f'teki aynı kararı,
 * `ftp.ts`/`rtcp.ts` vakalarının mirasçısı).
 *
 * ── KAYNAKLAR — DÖRT BAĞIMSIZ UYGULAMA, SIFIR ÇELİŞKİ ──────────────────────
 * MIL-STD-1553B kamuya açık bir ABD askerî standardıdır (ARINC 429'un aksine
 * ÜCRETLİ DEĞİL, spec `:311` DLA ASSIST'te aktif diyor). Yine de depo kuralı
 * (dalga 13 mimari bulgu 1) uygulandı ve aşağıdaki HER yapısal iddia EN AZ İKİ
 * bağımsız kaynakla çaprazlandı:
 *
 *   1. **Wikipedia "MIL-STD-1553"** — "Bus protocol" (20-bit sözcük, senkron
 *      darbesi, tek parite), Command Word ve Status Word alan tabloları,
 *      broadcast adresi 31, ve bir BC→RT işleminin ADIM ADIM anlatıldığı
 *      çalışılmış örneği (bu dosyanın fixture'ları oradan).
 *   2. **`mjhouse/mil_std_1553b`** (Rust) — `src/fields.rs` ONALTI BİTİN
 *      HEPSİNİ maskeyle veriyor: `COMMAND_ADDRESS 0b1111100000000000`,
 *      `COMMAND_TRANSMIT_RECEIVE 0b0000010000000000`,
 *      `COMMAND_SUBADDRESS 0b0000001111100000`,
 *      `COMMAND_WORD_COUNT`/`COMMAND_MODE_CODE 0b0000000000011111` (AYNI maske),
 *      `STATUS_MESSAGE_ERROR` bit 10 · `STATUS_INSTRUMENTATION` bit 9 ·
 *      `STATUS_SERVICE_REQUEST` bit 8 · `STATUS_RESERVED 0b0000000011100000` ·
 *      `STATUS_BROADCAST_RECEIVED` bit 4 · `STATUS_TERMINAL_BUSY` bit 3 ·
 *      `STATUS_SUBSYSTEM_ERROR` bit 2 · `STATUS_DYNAMIC_BUS_ACCEPTANCE` bit 1 ·
 *      `STATUS_TERMINAL_ERROR` bit 0. Kendi kaynağını da veriyor: *"MIL-STD-1553
 *      Tutorial, page 28"*.
 *   3. **`jddiener/MIL-STD-1553-message-processor-eTPU`** (C, eTPU) —
 *      `etpu_code/etec_MS1553.h`: `MS1553_TERMINAL_ADDRESS_BITMASK 0xF800`,
 *      `MS1553_RX_TX_BITMASK 0x0400`, `MS1553_SUBADDRESS_MODE_BITMASK 0x03E0`,
 *      `MS1553_WORD_COUNT_BITMASK 0x001F`. Dördü de kaynak (2) ile BİREBİR.
 *   4. **`johnathan-convertino-afrl/open1553`** (Verilog, gerçek Manchester
 *      çözücü) — `util_axis_1553_decoder.v`. Bu dosyanın GİRDİ SÖZLEŞMESİNİN
 *      doğrudan kanıtı (aşağı bak).
 *   5. **`ShubhankarKulkarni/MIL-STD-1553-Simulator`** (Python) —
 *      `Data_Link_Layer_Encoder_RT.py` Status Word'ü bayrak bayrak, MSB'den
 *      LSB'ye AYNI sırada kuruyor (message_error → instrumentation →
 *      service_request → reserved(3) → brdcst_received → busy → subsystem_flag
 *      → dynamic_bus_control_accpt → terminal_flag → parity).
 *
 * ── PARİTE GİRDİDE YOKTUR — KAYNAK (4) BUNU KODDA KANITLIYOR ───────────────
 * Kaynak (1): *"Practically each word could be considered as a 20 bit word:
 * 3 bit for sync, 16 bit for payload and 1 bit for odd parity control."*
 * Yani parite 16 bitlik yükün İÇİNDE DEĞİL, YANINDADIR.
 *
 * Kaynak (4) bunu bir adapter'ın gerçek davranışı olarak gösteriyor:
 * `bits_per_trans = 20`, senkron 3 bit, sonra `for(bit_slice_index = 0;
 * bit_slice_index < 16; ...)` ile TAM 16 bit veriye ayrılıyor ve parite AYRI
 * bir `parity_bit` register'ına düşüyor. Modülün kendi belgesi: *"TDATA will
 * contain the 16 bit data payload. TUSER is a 8 bit status register that tells
 * what type of data it is (command or data) and if the parity was good."*
 *
 * → **Girdi 16 bitlik YÜKtür. Parite alanı YOKTUR ve DOĞRULANMAZ.** Parite
 * kuralının TEK (odd) olduğu teyitli (kaynak (1) *"odd parity control"*,
 * kaynak (4) kodlayıcısı `P = PARITY: 1 = ODD, 0 = EVEN`) ama bit girdide
 * bulunmadığı için bu motor onu HESAPLAMAZ ve DOĞRULAMAZ; `parityNotInInput`
 * uyarısı KOŞULSUZ basılır. `arinc-429`da parite gerçekten doğrulanıyordu —
 * fark girdi sözleşmesindedir, bir kapsam daraltması değil.
 *
 * `crcBits()` ve `crcEngine.ts` ÇAĞRILMAZ: bu protokolde CRC YOKTUR (ana brifin
 * "❌ crcBits" bölümü), ve olan tek bütünlük biti de girdiye girmiyor.
 *
 * ── SÖZCÜK TİPİ ÇERÇEVEDE YOKTUR — DALGANIN EN BÜYÜK KARARI ────────────────
 * Sözcüğün Command / Status / Data olduğu bilgisi **SENKRON DARBESİNDE**
 * yaşar, 16 bitlik yükün DIŞINDA (kaynak (1)): *"Each word is preceded by a
 * 3 μs sync pulse (1.5 μs low plus 1.5 μs high for data words and the opposite
 * for command and status words, which cannot occur in the Manchester code)."*
 * Adapter yükü verirken senkronu tüketip atar — kaynak (4)ün TDATA'sı tam
 * olarak budur.
 *
 * **VE İKİNCİ, DAHA SERT İNCELİK:** Command Word ile Status Word **AYNI**
 * senkron desenini paylaşır ("the opposite" ikisi için de aynıdır). Yani
 * **senkron KORUNSA BİLE** command/status ayrımı çerçeveden ÇIKMAZ. Kaynak (4)
 * bunu donanımda kanıtlıyor: TUSER'ın tip alanı yalnız iki değer taşıyor —
 * `010 DATA` ve `100 CMD/STATUS`. Gerçek bir Manchester çözücü, dalganın
 * kendisine bakarak bile command'ı status'tan ayıramıyor; ayrım veri yolu
 * BAĞLAMINDADIR (BC→RT komut, RT→BC durum).
 *
 * → `wordType` bir kolaylık seçeneği DEĞİL, YAPISAL bir zorunluluktur.
 *
 * Command Word ve Status Word'ün İKİSİ DE üst 5 bitte RT Address taşır
 * (kaynak (2)/(3): `COMMAND_ADDRESS` = `STATUS_ADDRESS` = `0xF800`); ayrımları
 * yalnız kalan 11 bitin ANLAMINDADIR. Bir parser tip tahmin ederse **her
 * çerçevede sessizce yanlış alan adı basar**: T/R biti aslında Message Error
 * bayrağı, Word Count aslında Terminal Flag olur. Bu, depodaki en pahalı hata
 * sınıfıdır — hata VERMEZ, test yeşil gelir, kullanıcı yanlış bir uçuş verisi
 * okur.
 *
 * ── `wordType`: VARSAYILANI YOK, `data` DA DEĞİL ───────────────────────────
 * `ioLink.ts`in `messageSide`i (13h) ve `microwire.ts`in profil kararı
 * (*"aynı dört bayt, x8 profiliyle READ 0x2A, x16 profiliyle bambaşka bir şey;
 * tahmin etmek uydurmaktır"*) emsal. Varsayılan `data` KONULMADI: Data Word en
 * yaygın olduğu için "makul" görünür, ama tam da bu yüzden Command/Status
 * çerçevelerini sessizce yanlış adlandırır.
 *
 * Seçilmediğinde: 16 bit HAM basılır, alt alan ADLANDIRILMAZ, `wordTypeUnknown`
 * uyarısı çıkar. Seçildiğinde alan tablosu O TİPE göre açılır — üçü de aynı
 * dosyada, tek bir dallanmada (`buildCommandFields` / `buildStatusFields` /
 * `buildDataFields`). `mil1553.test.ts` AYNI 2 baytın üç tipte FARKLI alan
 * tablosu ürettiğini kanıtlar (15c'nin `ibus` profil testinin disiplini).
 *
 * ── `wordType` YAKALAMANIN TAMAMINA UYGULANIR — SINIR AÇIKÇA UYARILIR ──────
 * `DecodeOption` tek bir değer taşır; seçim sözcük BAŞINA yapılamaz. Bir 1553
 * işlemi (Command + Status + Data) tek bir tiple çözülemez, ve bunu sessizce
 * yapmak yukarıdaki hata sınıfının ta kendisidir. Bu yüzden yakalamada birden
 * çok sözcük varken `wordTypeAppliedToAllWords` uyarısı basılır. İşlem
 * (transaction) çözümü ÇERÇEVELER ARASIDIR ve parser'a GİRMEZ
 * (`mavlink.ts`in SEQ-LOSS kararı) — analyzer işidir.
 *
 * ── `canParse` DAİMA `false` — ARINC 429'DAN BİLE ZAYIF ────────────────────
 * 2 baytın HİÇBİR imzası yoktur: senkron yok, checksum yok, parite girdide
 * bile değil, uzunluk kısıtı yalnız "çift". 15f'te `arinc-429` için ölçülen
 * (registry'de 42 yanlış pozitif, paritesi ayarlanmış girdide N=8'de bile %100
 * kabul) bu kayıtta daha da kötü olurdu — orada en azından parite bir elekti.
 *
 * Ama belirleyici olan ölçüm değil ASİMETRİdir ve 15f'te ana thread bunu
 * kurumsallaştırdı: **`wordType` ve `wordByteOrder` seçilmeden anlamlı bir
 * çözüm ÜRETİLEMEZ.** Otomatik algılama DOĞRU çalışsa bile kullanıcıya
 * kullanabileceği bir şey vermez — kullanıcı zaten sayfaya gelip kalibrasyonu
 * girmek zorundadır. Zorunlu kalibrasyon isteyen kayıt otomatik algılamaya
 * GİRMEZ. `arinc429.ts` (15f), `uavcanCompatibility.ts` (15b),
 * `ppm.ts`/`pwmServo.ts` (15e) ile AYNI sınıf ve aynı gerekçe.
 *
 * `mil1553CanParseRegistry.test.ts` bunu bekçiler VE gerekçeyi ÖLÇER
 * (2026-08-25 sayıları): registry'nin **840 örneğinden 0'ı** `canParse`ı
 * geçiyor, ama elde kalan TEK ölçüt olan "uzunluk çift ve ≥ 2" kullanılsaydı
 * **580'i (%69) yanlış pozitif** olurdu. Ve ARINC'in 2⁻ᴺ paritesinin aksine
 * burada sözcük sayısını artırmak HİÇBİR koruma sağlamıyor: kabul oranı
 * N=1'de de N=64'te de %100. Ölçüm bir gözlem değil, kararın dayanağıdır.
 *
 * ── NE ADLANDIRILMAZ, NE HESAPLANMAZ (`kLine.ts` disiplini) ────────────────
 * • **Mode code ADI.** Subaddress 0 ya da 31 iken alanın MODE CODE olduğu dört
 *   kaynakla teyitli (aşağı bak), ama kodun ADI (`Transmitter Shutdown` vb.)
 *   BASILMAZ — spec `:334`: *"Exact mode-code veritabanı aktif standard
 *   revizyonundan yüklenmelidir."* Yalnız SAYI basılır.
 * • **ICD engineering değeri.** Data Word 16 bit HAM kalır. Katalog
 *   `definitions: ['vendor-map','custom-schema']` bildiriyor ama **panel BOŞ**
 *   (`snmp.ts:46` / `bleGatt.ts:34` / 14'ün `a2l`/`ldf` emsali).
 * • **Kabul limitleri ve HİÇBİR zamanlama sayısı.** `8.2 µs`, `4 µs`, `12 µs`
 *   gibi tek bir sabit bile gömülmedi (spec `:340`, `:545`).
 * • **BC / RT / BM rolü.** Bir sözcük hangi rolden geldiğini SÖYLEMEZ; bu
 *   veri yolu bağlamıdır (yukarıdaki command/status inceliği). Sayfa metninde
 *   anlatılır, alan olarak BASILMAZ.
 * • **Transaction timeline, RT/Subaddress Explorer, Bus Utilization, Response
 *   Time, Bus A/B karşılaştırması** — hepsi ÇOK SÖZCÜKLÜ ya da ÇOK YAKALAMALI,
 *   analyzer işi.
 * • **`unit` hiçbir alanda YOK** (`types.ts:46`): RT Address, Subaddress, Word
 *   Count, Mode Code hepsi sayaç/kimlik, fiziksel değer değil.
 *
 * ── ADLANDIRILAN VE ÇAPRAZLANAN İKİ TÜRETİM ───────────────────────────────
 * İkisi de DÖRT kaynağın en az İKİSİNDE bağımsız olarak bulundu:
 *   • **Subaddress 0 ya da 31 → mode command.** Kaynak (2) `flags.rs`:
 *     *"If the SA value is 0b00000 or 0b11111, then the field is decoded as a
 *     Mode Code command"* (kendi kaynağı: MIL-STD-1553 Tutorial s. 28).
 *     Kaynak (3) `etec_MS1553_MT_RX.c:311-313`: *"// check for a mode command"*
 *     ardından `(word & 0x03E0) == 0x03E0 || (word & 0x03E0) == 0x0000`.
 *     Kaynak (1) yalnız *"in the case of a mode code"* diyor, DEĞERLERİ
 *     vermiyor — iki bağımsız uygulama tie-break etti.
 *   • **Word Count alanında 0 → 32 sözcük.** Kaynak (2) `words.rs`:
 *     `match ... { 0 => 32u8, k => k }`. Kaynak (3)
 *     `etec_MS1553_MT_RX.c:384`: `((receivedWord - 1) & 0x001F) + 1` — wc=0
 *     için 32 verir. Kaynak (1) bu kuralı HİÇ anmıyor; yine iki bağımsız
 *     uygulama örtüştü.
 *   • **RT Address 31 → broadcast.** Kaynak (1) *"All are sent to the
 *     broadcast address (31)"*; kaynak (2) `Address::Broadcast`; kaynak (3)
 *     `(word & 0xF800) == 0xF800` ardından `_isBroadcastMsg`.
 *
 * ── BİLİNEN SINIR (15f'ten miras) ─────────────────────────────────────────
 * `DecodeOption.kind` yalnız `'select' | 'number'` — metin kanalı YOKTUR
 * (`types.ts` KİLİTLİ sözleşme, DOKUNULMADI). Bu kayıtta ICD'den gelmesi
 * gereken hiçbir metin (mode code adı, subaddress etiketi, engineering birimi)
 * kullanıcıdan alınamaz; alınabilseydi bile basılmazdı (yukarıdaki
 * "NE ADLANDIRILMAZ"). Sınır burada bir kayba YOL AÇMIYOR, kayıt için yazıldı.
 *
 * ── STATUS: 'ready' — GEREKÇE ─────────────────────────────────────────────
 * Parser'ın ÇÖZEMEDİĞİ bir şey yok: üç sözcük tipinin de bütün alan sınırları
 * dört bağımsız kaynakla çaprazlandı ve gerçekten çözülüyor. Çerçevede OLMAYAN
 * bir bilgiyi (sözcük tipi) kullanıcıdan istiyor — `ioLink.ts` bu yolla `ready`
 * kapandı, `arinc-429`ın `dataEncoding`/`labelBitOrder`ı da aynı sınıf.
 * `partial` olsaydı yanlış olurdu: kapsam daraltılmadı, girdinin kendisinde
 * olmayan bir bilgi istendi.
 */

import { readBitsAsNumber } from '@/protocol-core/decoding/bitCursor';
import { createRawFrame } from '@/protocol-core/types';
import type {
  DecodeOption,
  ExampleFrame,
  FrameDirection,
  ParseContext,
  ParseResult,
  ParsedField,
  ParsedFrame,
  ProtocolParser,
  ProtocolPlugin,
  ProtocolWarning,
} from '@/protocol-core/types';

const PROTOCOL_ID = 'mil-std-1553';
const PROTOCOL_DISPLAY_NAME = 'MIL-STD-1553';

/** Sözcüğün YÜKÜ 16 bittir ve tam 2 bayta oturur (senkron ve parite girdide YOK). */
const WORD_BIT_COUNT = 16;
const WORD_BYTE_LENGTH = 2;
const BITS_PER_BYTE = 8;

/**
 * Alan sınırları — 0 tabanlı bit numarası, **bit 15 = MSB**. Dört bağımsız
 * kaynağın maskeleriyle çaprazlandı (dosya başı).
 */
const RT_ADDRESS_LOW_BIT = 11;
const RT_ADDRESS_HIGH_BIT = 15;
const TRANSMIT_RECEIVE_BIT = 10;
const SUBADDRESS_LOW_BIT = 5;
const SUBADDRESS_HIGH_BIT = 9;
const COUNT_LOW_BIT = 0;
const COUNT_HIGH_BIT = 4;

/** Status Word bayrak konumları (kaynak (2) ve (5) ile birebir). */
const STATUS_MESSAGE_ERROR_BIT = 10;
const STATUS_INSTRUMENTATION_BIT = 9;
const STATUS_SERVICE_REQUEST_BIT = 8;
const STATUS_RESERVED_LOW_BIT = 5;
const STATUS_RESERVED_HIGH_BIT = 7;
const STATUS_BROADCAST_RECEIVED_BIT = 4;
const STATUS_BUSY_BIT = 3;
const STATUS_SUBSYSTEM_FLAG_BIT = 2;
const STATUS_DYNAMIC_BUS_ACCEPTANCE_BIT = 1;
const STATUS_TERMINAL_FLAG_BIT = 0;

/** RT Address 31 broadcast için REZERVEDİR (kaynak (1)/(2)/(3)). */
const BROADCAST_RT_ADDRESS = 31;
/** Subaddress 0 ve 31 "bu bir mode command'dır" demektir (kaynak (2)/(3)). */
const MODE_COMMAND_SUBADDRESS_LOW = 0;
const MODE_COMMAND_SUBADDRESS_HIGH = 31;
/** Word Count alanındaki 0, 32 sözcük demektir (kaynak (2)/(3)). */
const WORD_COUNT_ZERO_MEANS = 32;

const OPTION_WORD_TYPE = 'wordType';
const OPTION_WORD_BYTE_ORDER = 'wordByteOrder';

const UNSET = 'unset';
const WORD_TYPE_COMMAND = 'command';
const WORD_TYPE_STATUS = 'status';
const WORD_TYPE_DATA = 'data';
const BYTE_ORDER_LITTLE_ENDIAN = 'little-endian';
const BYTE_ORDER_BIG_ENDIAN = 'big-endian';

type WordType = typeof WORD_TYPE_COMMAND | typeof WORD_TYPE_STATUS | typeof WORD_TYPE_DATA;
type WordByteOrder = typeof BYTE_ORDER_LITTLE_ENDIAN | typeof BYTE_ORDER_BIG_ENDIAN;

const ERROR_EMPTY = 'protocol.mil1553.error.empty';
const ERROR_NOT_WORD_ALIGNED = 'protocol.mil1553.error.notWordAligned';
const ERROR_ABORTED = 'protocol.mil1553.error.aborted';
const ERROR_FRAME_TOO_LONG = 'protocol.mil1553.error.frameTooLong';

const WARN_WORD_TYPE_UNKNOWN = 'protocol.mil1553.warning.wordTypeUnknown';
const WARN_WORD_BYTE_ORDER_NOT_SELECTED = 'protocol.mil1553.warning.wordByteOrderNotSelected';
const WARN_WORD_TYPE_APPLIED_TO_ALL = 'protocol.mil1553.warning.wordTypeAppliedToAllWords';
const WARN_PARITY_NOT_IN_INPUT = 'protocol.mil1553.warning.parityNotInInput';
const WARN_STATUS_RESERVED_NOT_ZERO = 'protocol.mil1553.warning.statusReservedBitsNotZero';

const FIELD_WARN_WORD_TYPE_UNKNOWN = 'protocol.mil1553.field.wordTypeUnknown';
const FIELD_WARN_WORD_BYTE_ORDER = 'protocol.mil1553.field.wordByteOrderNotSelected';
const FIELD_WARN_MODE_CODE_NAME = 'protocol.mil1553.field.modeCodeNameRequiresRevision';
const FIELD_WARN_WORD_COUNT_IN_MODE = 'protocol.mil1553.field.wordCountUnusedInModeCommand';
const FIELD_WARN_SUBADDRESS_MEANING = 'protocol.mil1553.field.subaddressMeaningRequiresIcd';
const FIELD_WARN_DATA_MEANING = 'protocol.mil1553.field.dataMeaningRequiresIcd';
const FIELD_WARN_RESERVED_NOT_ZERO = 'protocol.mil1553.field.reservedBitsNotZero';

const FLAG_SET = 'SET';
const FLAG_CLEAR = 'CLEAR';

// ─── BİT KONUMU DÖNÜŞÜMÜ — TEK YER ───────────────────────────────────────────

/**
 * 0 tabanlı bit numarasını (bit 15 = MSB) NORMALİZE EDİLMİŞ sözcüğün
 * `bitCursor` konumuna çevirir. **Bu dosyada bit numarasını konuma çeviren TEK
 * yer budur**; hiçbir alan okuması bu aritmetiği tekrarlamaz (15f'in
 * `arincBitPosition` disiplini).
 *
 * Normalize edilmiş sözcük: 2 bayt, big-endian — bayt 0'ın en yüksek biti
 * bit 15, bayt 1'in en düşük biti bit 0. `msb-first` okumada konum 0 = bit 15
 * olduğu için dönüşüm `15 − N`dir.
 */
function bitPosition(bitNumber: number): number {
  return WORD_BIT_COUNT - 1 - bitNumber;
}

/** `[lowBit..highBit]` aralığını okur; sonucun en yüksek biti `highBit`tir. */
function readField(normalizedWord: Uint8Array, lowBit: number, highBit: number): number {
  return readBitsAsNumber(normalizedWord, bitPosition(highBit), highBit - lowBit + 1, 'msb-first');
}

/** Tek bitlik bayrak okuması — `readField`in dar hâli, ayrı bir aritmetik DEĞİL. */
function readFlag(normalizedWord: Uint8Array, bit: number): number {
  return readField(normalizedWord, bit, bit);
}

/**
 * Girdideki 2 baytı NORMALİZE edilmiş (big-endian) sözcüğe çevirir.
 * `big-endian`: bayt 0 bit 15:8'i taşır. `little-endian`: bayt 0 bit 7:0'ı
 * taşır, dizi ters çevrilir.
 */
function normalizeWord(data: Uint8Array, wordOffset: number, byteOrder: WordByteOrder): Uint8Array {
  const slice = data.slice(wordOffset, wordOffset + WORD_BYTE_LENGTH);
  return byteOrder === BYTE_ORDER_BIG_ENDIAN ? slice : slice.reverse();
}

/**
 * Bir bit alanını KAPSAYAN girdi baytı aralığı. `ParsedField.offset`/`length`
 * BAYT cinsindendir (`types.ts:41-42`, kilitli sözleşme) ve bit ayrıntısı alan
 * ADINDA taşınır — ama kapsam yine de mümkün olan en dar aralık olmalı ki
 * byte-viewer doğru yeri vurgulasın (`arinc429.ts`in aynı yardımcısı).
 */
function fieldByteSpan(
  wordOffset: number,
  lowBit: number,
  highBit: number,
  byteOrder: WordByteOrder,
): { offset: number; length: number } {
  const lowRegisterByte = Math.floor(lowBit / BITS_PER_BYTE);
  const highRegisterByte = Math.floor(highBit / BITS_PER_BYTE);
  const first =
    byteOrder === BYTE_ORDER_LITTLE_ENDIAN
      ? lowRegisterByte
      : WORD_BYTE_LENGTH - 1 - highRegisterByte;
  const last =
    byteOrder === BYTE_ORDER_LITTLE_ENDIAN
      ? highRegisterByte
      : WORD_BYTE_LENGTH - 1 - lowRegisterByte;
  return { offset: wordOffset + first, length: last - first + 1 };
}

/** Alan id'si sözcük İNDEKSİNİ taşır — çok sözcüklü girdide alanlar çakışmasın diye. */
function fieldId(wordIndex: number, suffix: string): string {
  return `mil1553-word-${String(wordIndex)}-${suffix}`;
}

/** `bitLength` bitlik değeri sabit genişlikli ikilik metne çevirir. */
function toBinaryText(value: number, bitLength: number): string {
  return value.toString(2).padStart(bitLength, '0');
}

// ─── SEÇENEKLER ──────────────────────────────────────────────────────────────

interface Mil1553Settings {
  readonly wordType: WordType | null;
  readonly byteOrder: WordByteOrder | null;
}

function resolveSettings(options: Record<string, unknown> | undefined): Mil1553Settings {
  const typeRaw = options?.[OPTION_WORD_TYPE];
  const orderRaw = options?.[OPTION_WORD_BYTE_ORDER];

  let wordType: WordType | null = null;
  if (typeRaw === WORD_TYPE_COMMAND) wordType = WORD_TYPE_COMMAND;
  else if (typeRaw === WORD_TYPE_STATUS) wordType = WORD_TYPE_STATUS;
  else if (typeRaw === WORD_TYPE_DATA) wordType = WORD_TYPE_DATA;

  let byteOrder: WordByteOrder | null = null;
  if (orderRaw === BYTE_ORDER_LITTLE_ENDIAN) byteOrder = BYTE_ORDER_LITTLE_ENDIAN;
  else if (orderRaw === BYTE_ORDER_BIG_ENDIAN) byteOrder = BYTE_ORDER_BIG_ENDIAN;

  return { wordType, byteOrder };
}

const DECODE_OPTIONS: readonly DecodeOption[] = [
  {
    id: OPTION_WORD_TYPE,
    label: 'protocol.mil1553.option.wordType',
    kind: 'select',
    // Varsayılan YOK — `data` bile değil. Gerekçe dosya başında: tip senkron
    // darbesindedir, üstelik command ile status AYNI senkronu paylaşır.
    defaultValue: UNSET,
    description: 'protocol.mil1553.option.wordType.description',
    choices: [
      { value: UNSET, label: 'protocol.mil1553.option.wordType.unset' },
      { value: WORD_TYPE_COMMAND, label: 'protocol.mil1553.option.wordType.command' },
      { value: WORD_TYPE_STATUS, label: 'protocol.mil1553.option.wordType.status' },
      { value: WORD_TYPE_DATA, label: 'protocol.mil1553.option.wordType.data' },
    ],
  },
  {
    id: OPTION_WORD_BYTE_ORDER,
    label: 'protocol.mil1553.option.wordByteOrder',
    kind: 'select',
    // `arinc-429`la BİREBİR aynı gerekçe: adapter'a bağlı, yanlış seçim bütün
    // alanları kaydırır, tahmin edilmez.
    defaultValue: UNSET,
    description: 'protocol.mil1553.option.wordByteOrder.description',
    choices: [
      { value: UNSET, label: 'protocol.mil1553.option.wordByteOrder.unset' },
      { value: BYTE_ORDER_BIG_ENDIAN, label: 'protocol.mil1553.option.wordByteOrder.bigEndian' },
      {
        value: BYTE_ORDER_LITTLE_ENDIAN,
        label: 'protocol.mil1553.option.wordByteOrder.littleEndian',
      },
    ],
  },
];

// ─── ALAN ÜRETİMİ — ÜÇ AYRI ÇÖZÜM YOLU ───────────────────────────────────────

interface WordFieldsInput {
  readonly data: Uint8Array;
  readonly wordIndex: number;
  readonly wordOffset: number;
  readonly byteOrder: WordByteOrder;
  readonly normalized: Uint8Array;
}

/** `ParsedField` kurmanın ortak kabuğu — üç yol da aynı kapsamı hesaplar. */
function buildField(
  input: WordFieldsInput,
  suffix: string,
  name: string,
  lowBit: number,
  highBit: number,
  extra: {
    rawValue?: number;
    physicalValue?: number | string;
    valid?: boolean;
    warnings?: string[];
  },
): ParsedField {
  const span = fieldByteSpan(input.wordOffset, lowBit, highBit, input.byteOrder);
  return {
    id: fieldId(input.wordIndex, suffix),
    name,
    offset: span.offset,
    length: span.length,
    rawBytes: input.data.slice(span.offset, span.offset + span.length),
    rawValue: extra.rawValue ?? readField(input.normalized, lowBit, highBit),
    ...(extra.physicalValue === undefined ? {} : { physicalValue: extra.physicalValue }),
    // `unit` HİÇBİR alanda YOK — hepsi sayaç/kimlik/bayrak (dosya başı).
    valid: extra.valid ?? true,
    warnings: extra.warnings ?? [],
  };
}

/** Tek bitlik bayrak alanı — Status Word'ün dokuz bayrağı bunu paylaşır. */
function buildFlagField(
  input: WordFieldsInput,
  suffix: string,
  name: string,
  bit: number,
): ParsedField {
  const value = readFlag(input.normalized, bit);
  return buildField(input, suffix, name, bit, bit, {
    rawValue: value,
    physicalValue: value === 1 ? FLAG_SET : FLAG_CLEAR,
  });
}

/**
 * COMMAND WORD — kaynak (2)/(3)ün maskeleriyle birebir:
 * `0xF800` · `0x0400` · `0x03E0` · `0x001F`.
 */
function buildCommandFields(input: WordFieldsInput): ParsedField[] {
  const rtAddress = readField(input.normalized, RT_ADDRESS_LOW_BIT, RT_ADDRESS_HIGH_BIT);
  const transmitReceive = readFlag(input.normalized, TRANSMIT_RECEIVE_BIT);
  const subaddress = readField(input.normalized, SUBADDRESS_LOW_BIT, SUBADDRESS_HIGH_BIT);
  const count = readField(input.normalized, COUNT_LOW_BIT, COUNT_HIGH_BIT);
  const isModeCommand =
    subaddress === MODE_COMMAND_SUBADDRESS_LOW || subaddress === MODE_COMMAND_SUBADDRESS_HIGH;

  const fields: ParsedField[] = [
    buildField(
      input,
      'rt-address',
      'Command · RT Address (bit 15:11)',
      RT_ADDRESS_LOW_BIT,
      RT_ADDRESS_HIGH_BIT,
      {
        rawValue: rtAddress,
        // 31 broadcast için REZERVE (üç kaynak). Diğer değerlerde fiziksel
        // karşılık YOK — adres bir kimliktir, çevrilecek bir şey değil.
        ...(rtAddress === BROADCAST_RT_ADDRESS ? { physicalValue: 'Broadcast (31)' } : {}),
      },
    ),
    buildField(
      input,
      'transmit-receive',
      'Command · Transmit/Receive (bit 10)',
      TRANSMIT_RECEIVE_BIT,
      TRANSMIT_RECEIVE_BIT,
      {
        rawValue: transmitReceive,
        // Yön REMOTE TERMINAL'in bakış açısındandır (kaynak (2)): 1 = RT
        // gönderir, 0 = RT alır. BC/RT rolü BASILMAZ, yalnız bitin anlamı.
        physicalValue: transmitReceive === 1 ? 'Transmit (RT → bus)' : 'Receive (bus → RT)',
      },
    ),
    buildField(
      input,
      'subaddress',
      'Command · Subaddress / Mode (bit 9:5)',
      SUBADDRESS_LOW_BIT,
      SUBADDRESS_HIGH_BIT,
      {
        rawValue: subaddress,
        ...(isModeCommand ? { physicalValue: 'Mode command' } : {}),
        // Subaddress'in hangi alt sisteme baktığı equipment ICD'sindedir.
        warnings: isModeCommand ? [] : [FIELD_WARN_SUBADDRESS_MEANING],
      },
    ),
  ];

  if (isModeCommand) {
    // Alan MODE CODE'dur — SAYI basılır, ADI ASLA (spec `:334`).
    fields.push(
      buildField(input, 'mode-code', 'Command · Mode Code (bit 4:0)', COUNT_LOW_BIT, COUNT_HIGH_BIT, {
        rawValue: count,
        warnings: [FIELD_WARN_MODE_CODE_NAME, FIELD_WARN_WORD_COUNT_IN_MODE],
      }),
    );
  } else {
    // Word Count: 0 → 32 (iki bağımsız uygulamayla çaprazlandı, dosya başı).
    fields.push(
      buildField(
        input,
        'word-count',
        'Command · Word Count (bit 4:0)',
        COUNT_LOW_BIT,
        COUNT_HIGH_BIT,
        {
          rawValue: count,
          physicalValue: count === 0 ? WORD_COUNT_ZERO_MEANS : count,
        },
      ),
    );
  }

  return fields;
}

/**
 * STATUS WORD — kaynak (2)nin maskeleri ve kaynak (5)in MSB→LSB kurulum sırası
 * birebir örtüşüyor. Rezerve bitler (7:5) SIFIR olmalıdır.
 */
function buildStatusFields(input: WordFieldsInput): {
  fields: ParsedField[];
  reservedNotZero: boolean;
} {
  const rtAddress = readField(input.normalized, RT_ADDRESS_LOW_BIT, RT_ADDRESS_HIGH_BIT);
  const reserved = readField(input.normalized, STATUS_RESERVED_LOW_BIT, STATUS_RESERVED_HIGH_BIT);
  const reservedNotZero = reserved !== 0;

  const fields: ParsedField[] = [
    buildField(
      input,
      'rt-address',
      'Status · RT Address (bit 15:11)',
      RT_ADDRESS_LOW_BIT,
      RT_ADDRESS_HIGH_BIT,
      {
        rawValue: rtAddress,
        ...(rtAddress === BROADCAST_RT_ADDRESS ? { physicalValue: 'Broadcast (31)' } : {}),
      },
    ),
    buildFlagField(input, 'message-error', 'Status · Message Error (bit 10)', STATUS_MESSAGE_ERROR_BIT),
    buildFlagField(
      input,
      'instrumentation',
      'Status · Instrumentation (bit 9)',
      STATUS_INSTRUMENTATION_BIT,
    ),
    buildFlagField(
      input,
      'service-request',
      'Status · Service Request (bit 8)',
      STATUS_SERVICE_REQUEST_BIT,
    ),
    buildField(
      input,
      'reserved',
      'Status · Reserved (bit 7:5)',
      STATUS_RESERVED_LOW_BIT,
      STATUS_RESERVED_HIGH_BIT,
      {
        rawValue: reserved,
        physicalValue: toBinaryText(reserved, STATUS_RESERVED_HIGH_BIT - STATUS_RESERVED_LOW_BIT + 1),
        // Sıfırdan farklı rezerve bit, sözcüğün Status Word OLMADIĞINA dair en
        // güçlü göstergedir — yani `wordType` yanlış seçilmiş olabilir.
        valid: !reservedNotZero,
        warnings: reservedNotZero ? [FIELD_WARN_RESERVED_NOT_ZERO] : [],
      },
    ),
    buildFlagField(
      input,
      'broadcast-command-received',
      'Status · Broadcast Command Received (bit 4)',
      STATUS_BROADCAST_RECEIVED_BIT,
    ),
    buildFlagField(input, 'busy', 'Status · Busy (bit 3)', STATUS_BUSY_BIT),
    buildFlagField(input, 'subsystem-flag', 'Status · Subsystem Flag (bit 2)', STATUS_SUBSYSTEM_FLAG_BIT),
    buildFlagField(
      input,
      'dynamic-bus-acceptance',
      'Status · Dynamic Bus Control Acceptance (bit 1)',
      STATUS_DYNAMIC_BUS_ACCEPTANCE_BIT,
    ),
    buildFlagField(input, 'terminal-flag', 'Status · Terminal Flag (bit 0)', STATUS_TERMINAL_FLAG_BIT),
  ];

  return { fields, reservedNotZero };
}

/**
 * DATA WORD — 16 bit HAM, alt yapı YOK. Anlamı equipment ICD'sindedir ve
 * `mavlink.ts`in payload kararıyla aynı gerekçeyle YAKIŞTIRILMAZ.
 */
function buildDataFields(input: WordFieldsInput): ParsedField[] {
  const value = readField(input.normalized, 0, WORD_BIT_COUNT - 1);
  return [
    buildField(input, 'data', 'Data (bit 15:0)', 0, WORD_BIT_COUNT - 1, {
      rawValue: value,
      physicalValue: toBinaryText(value, WORD_BIT_COUNT),
      warnings: [FIELD_WARN_DATA_MEANING],
    }),
  ];
}

// ─── PARSER ──────────────────────────────────────────────────────────────────

interface Mil1553ParseOptions {
  timestamp?: number;
  direction?: FrameDirection;
  channel?: string;
  maxFrameLength?: number;
  signal?: AbortSignal;
  options?: Record<string, unknown>;
}

function parseMil1553Frame(data: Uint8Array, parseOptions: Mil1553ParseOptions): ParseResult {
  if (parseOptions.signal?.aborted === true) {
    return {
      success: false,
      error: { code: 'parser-timeout', message: ERROR_ABORTED },
      consumedBytes: 0,
      recoverable: false,
    };
  }

  if (data.length === 0) {
    return {
      success: false,
      error: { code: 'truncated-frame', message: ERROR_EMPTY, offset: 0, length: 0 },
      consumedBytes: 0,
      recoverable: true,
    };
  }

  if (parseOptions.maxFrameLength !== undefined && data.length > parseOptions.maxFrameLength) {
    return {
      success: false,
      error: {
        code: 'frame-too-long',
        message: ERROR_FRAME_TOO_LONG,
        offset: parseOptions.maxFrameLength,
        length: data.length - parseOptions.maxFrameLength,
        details: { maxFrameLength: parseOptions.maxFrameLength, frameLength: data.length },
      },
      consumedBytes: 0,
      recoverable: false,
    };
  }

  if (data.length % WORD_BYTE_LENGTH !== 0) {
    // Girdi 16-bit sözcüklerin BLOĞUDUR; artık bayt eksik sözcük demektir.
    return {
      success: false,
      error: {
        code: 'truncated-frame',
        message: ERROR_NOT_WORD_ALIGNED,
        offset: data.length - (data.length % WORD_BYTE_LENGTH),
        length: data.length % WORD_BYTE_LENGTH,
        details: { wordByteLength: WORD_BYTE_LENGTH, frameLength: data.length },
      },
      consumedBytes: 0,
      recoverable: true,
    };
  }

  const settings = resolveSettings(parseOptions.options);
  const warnings: ProtocolWarning[] = [];
  const fields: ParsedField[] = [];
  const wordCount = data.length / WORD_BYTE_LENGTH;

  // Parite girdide YOKTUR ve bu bir kapsam kararı değil girdi sözleşmesidir —
  // uyarı KOŞULSUZ basılır (dosya başı, kaynak (4)).
  warnings.push({ code: 'parityNotInInput', message: WARN_PARITY_NOT_IN_INPUT });

  if (settings.byteOrder === null) {
    warnings.push({ code: 'wordByteOrderNotSelected', message: WARN_WORD_BYTE_ORDER_NOT_SELECTED });
  } else if (settings.wordType === null) {
    warnings.push({ code: 'wordTypeUnknown', message: WARN_WORD_TYPE_UNKNOWN });
  } else if (wordCount > 1) {
    // Seçim yakalamanın TAMAMINA uygulanır; bir işlem tek tiple çözülemez.
    warnings.push({
      code: 'wordTypeAppliedToAllWords',
      message: WARN_WORD_TYPE_APPLIED_TO_ALL,
    });
  }

  let anyStatusReservedNotZero = false;

  for (let wordIndex = 0; wordIndex < wordCount; wordIndex += 1) {
    const wordOffset = wordIndex * WORD_BYTE_LENGTH;

    if (settings.byteOrder === null) {
      // Bayt sırası bilinmeden hiçbir bit numarası anlamlı değil — ham 2 bayt.
      // `rawValue` BİLEREK verilmiyor: bir sayı basmak bir sıra seçmektir.
      fields.push({
        id: fieldId(wordIndex, 'raw'),
        name: 'Raw Word (16 bit)',
        offset: wordOffset,
        length: WORD_BYTE_LENGTH,
        rawBytes: data.slice(wordOffset, wordOffset + WORD_BYTE_LENGTH),
        valid: true,
        warnings: [FIELD_WARN_WORD_BYTE_ORDER],
      });
      continue;
    }

    const normalized = normalizeWord(data, wordOffset, settings.byteOrder);
    const input: WordFieldsInput = {
      data,
      wordIndex,
      wordOffset,
      byteOrder: settings.byteOrder,
      normalized,
    };

    if (settings.wordType === null) {
      // Sözcük tipi çerçeveden ÇIKMAZ — 16 bit HAM, alt alan ADLANDIRILMAZ.
      fields.push(
        buildField(input, 'raw', 'Raw Word (bit 15:0, type unknown)', 0, WORD_BIT_COUNT - 1, {
          physicalValue: toBinaryText(readField(normalized, 0, WORD_BIT_COUNT - 1), WORD_BIT_COUNT),
          warnings: [FIELD_WARN_WORD_TYPE_UNKNOWN],
        }),
      );
      continue;
    }

    if (settings.wordType === WORD_TYPE_COMMAND) {
      fields.push(...buildCommandFields(input));
    } else if (settings.wordType === WORD_TYPE_STATUS) {
      const status = buildStatusFields(input);
      fields.push(...status.fields);
      if (status.reservedNotZero) anyStatusReservedNotZero = true;
    } else {
      fields.push(...buildDataFields(input));
    }
  }

  if (anyStatusReservedNotZero) {
    warnings.push({
      code: 'statusReservedBitsNotZero',
      message: WARN_STATUS_RESERVED_NOT_ZERO,
    });
  }

  const rawFrame = createRawFrame(data, {
    ...(parseOptions.timestamp === undefined ? {} : { timestamp: parseOptions.timestamp }),
    ...(parseOptions.direction === undefined ? {} : { direction: parseOptions.direction }),
    ...(parseOptions.channel === undefined ? {} : { channel: parseOptions.channel }),
  });

  const frame: ParsedFrame = {
    protocol: PROTOCOL_ID,
    timestamp: rawFrame.timestamp,
    rawFrame,
    fields,
    // Rezerve bitler bir HATA değil bir İŞARETTİR: büyük olasılıkla `wordType`
    // yanlış seçilmiştir. Çerçeve `valid` kalır, uyarı basılır — çözülemeyen
    // bir şey yok (dalga 13 dersi 3'ün "gösterilir ≠ doğrulanır" ayrımı).
    valid: true,
    errors: [],
    warnings,
  };

  return { success: true, frame, consumedBytes: data.length };
}

export function parseMil1553(data: Uint8Array, options?: Record<string, unknown>): ParseResult {
  return parseMil1553Frame(data, options === undefined ? {} : { options });
}

export const mil1553Parser: ProtocolParser = {
  protocolId: PROTOCOL_ID,
  displayName: PROTOCOL_DISPLAY_NAME,

  /**
   * YAPISAL `false` — gerekçe dosya başındaki *"canParse DAİMA false"*
   * bölümünde. 2 baytın hiçbir imzası yoktur ve `wordType` seçilmeden anlamlı
   * çözüm üretilemez; otomatik algılama doğru çalışsa bile kullanıcıya
   * kullanabileceği bir şey vermez. `mil1553CanParseRegistry.test.ts` bunu
   * bekçiler. `parse()` ETKİLENMEZ.
   */
  canParse(): boolean {
    return false;
  },

  parse(data: Uint8Array, context?: ParseContext): ParseResult {
    const options: Mil1553ParseOptions = {};
    if (context?.timestamp !== undefined) options.timestamp = context.timestamp;
    if (context?.direction !== undefined) options.direction = context.direction;
    if (context?.channel !== undefined) options.channel = context.channel;
    if (context?.maxFrameLength !== undefined) options.maxFrameLength = context.maxFrameLength;
    if (context?.signal !== undefined) options.signal = context.signal;
    if (context?.options !== undefined) options.options = context.options;
    return parseMil1553Frame(data, options);
  },
};

// ─── ÖRNEK ÇERÇEVE KURUCUSU ──────────────────────────────────────────────────

/**
 * 16 bitlik bir sözcüğü baytlara çevirir. Örnek çerçeveler ve birim testler
 * AYNI kurucuyu kullanır (spec §42/§43 disiplini).
 */
export function buildMil1553Word(value: number, byteOrder: WordByteOrder): Uint8Array {
  const word = value & 0xffff;
  const high = (word >>> BITS_PER_BYTE) & 0xff;
  const low = word & 0xff;
  return byteOrder === BYTE_ORDER_BIG_ENDIAN
    ? new Uint8Array([high, low])
    : new Uint8Array([low, high]);
}

function concatWords(words: readonly Uint8Array[]): Uint8Array {
  const out = new Uint8Array(words.length * WORD_BYTE_LENGTH);
  words.forEach((word, index) => {
    out.set(word, index * WORD_BYTE_LENGTH);
  });
  return out;
}

/**
 * Kaynak (1)in ÇALIŞILMIŞ ÖRNEĞİ — bir BC→RT işleminin üç sözcüğü. Makale
 * ikisinin ikilik değerini adım adım veriyor ve alan sınırları böylece ALAN
 * TABLOSUNDAN BAĞIMSIZ bir anlatının sayısal örneğiyle de doğrulanmış oluyor.
 */
// `0b0001110000100001` — RT 3 ("value of 0x3"), T/R 1 (transmit),
// subaddress 1, word count 1 ("the single word of data requested").
const EXAMPLE_COMMAND_WORD = 0x1c21;
// `0b0001100000000000` — RT 3 ("its address (0x3)"), rezerve bitler sıfır
// ("the reserved bits zeroed"), HİÇBİR bayrak set değil ("all status flags
// set to false").
const EXAMPLE_STATUS_WORD = 0x1800;
// Aynı senaryoda istenen veri sözcüğünün değeri.
const EXAMPLE_DATA_WORD = 0x0002;

/** Mode command örneği: subaddress 31 (`0b11111`), mode code 2. */
const EXAMPLE_MODE_COMMAND_WORD = 0x1be2;
/** Broadcast örneği: RT address 31, subaddress 0 → mode command, mode code 1. */
const EXAMPLE_BROADCAST_MODE_WORD = 0xf801;
/** Rezerve bitleri SIFIR OLMAYAN sözcük — yanlış `wordType` göstergesi. */
const EXAMPLE_BAD_RESERVED_WORD = 0x18e0;

const EXAMPLE_FRAMES: ExampleFrame[] = [
  {
    id: 'command-word-rt3-transmit',
    name: 'protocol.mil1553.example.commandRt3Transmit.name',
    bytes: buildMil1553Word(EXAMPLE_COMMAND_WORD, BYTE_ORDER_BIG_ENDIAN),
    description: 'protocol.mil1553.example.commandRt3Transmit.description',
    expectedValid: true,
  },
  {
    id: 'status-word-rt3-all-clear',
    name: 'protocol.mil1553.example.statusRt3AllClear.name',
    bytes: buildMil1553Word(EXAMPLE_STATUS_WORD, BYTE_ORDER_BIG_ENDIAN),
    description: 'protocol.mil1553.example.statusRt3AllClear.description',
    expectedValid: true,
  },
  {
    id: 'data-word-value-2',
    name: 'protocol.mil1553.example.dataWordValue2.name',
    bytes: buildMil1553Word(EXAMPLE_DATA_WORD, BYTE_ORDER_BIG_ENDIAN),
    description: 'protocol.mil1553.example.dataWordValue2.description',
    expectedValid: true,
  },
  {
    id: 'mode-command-subaddress-31',
    name: 'protocol.mil1553.example.modeCommandSubaddress31.name',
    bytes: buildMil1553Word(EXAMPLE_MODE_COMMAND_WORD, BYTE_ORDER_BIG_ENDIAN),
    description: 'protocol.mil1553.example.modeCommandSubaddress31.description',
    expectedValid: true,
  },
  {
    id: 'broadcast-mode-command-subaddress-0',
    name: 'protocol.mil1553.example.broadcastModeSubaddress0.name',
    bytes: buildMil1553Word(EXAMPLE_BROADCAST_MODE_WORD, BYTE_ORDER_BIG_ENDIAN),
    description: 'protocol.mil1553.example.broadcastModeSubaddress0.description',
    expectedValid: true,
  },
  {
    id: 'status-word-reserved-not-zero',
    name: 'protocol.mil1553.example.statusReservedNotZero.name',
    bytes: buildMil1553Word(EXAMPLE_BAD_RESERVED_WORD, BYTE_ORDER_BIG_ENDIAN),
    description: 'protocol.mil1553.example.statusReservedNotZero.description',
    expectedValid: true,
  },
  {
    id: 'little-endian-adapter-command',
    name: 'protocol.mil1553.example.littleEndianAdapter.name',
    // İlk örneğin MANTIKSAL olarak AYNISI, little-endian yazılmış.
    bytes: buildMil1553Word(EXAMPLE_COMMAND_WORD, BYTE_ORDER_LITTLE_ENDIAN),
    description: 'protocol.mil1553.example.littleEndianAdapter.description',
    expectedValid: true,
  },
  {
    id: 'three-word-transaction',
    name: 'protocol.mil1553.example.threeWordTransaction.name',
    // Kaynak (1)in çalışılmış işleminin TAMAMI. Tek bir `wordType` üçüne birden
    // uygulanır — tam da bu yüzden `wordTypeAppliedToAllWords` uyarısı basılır.
    bytes: concatWords([
      buildMil1553Word(EXAMPLE_COMMAND_WORD, BYTE_ORDER_BIG_ENDIAN),
      buildMil1553Word(EXAMPLE_STATUS_WORD, BYTE_ORDER_BIG_ENDIAN),
      buildMil1553Word(EXAMPLE_DATA_WORD, BYTE_ORDER_BIG_ENDIAN),
    ]),
    description: 'protocol.mil1553.example.threeWordTransaction.description',
    expectedValid: true,
  },
  {
    id: 'not-word-aligned',
    name: 'protocol.mil1553.example.notWordAligned.name',
    // 3 bayt — 2'nin katı değil, `truncated-frame`.
    bytes: new Uint8Array([0x1c, 0x21, 0x18]),
    description: 'protocol.mil1553.example.notWordAligned.description',
    expectedValid: false,
  },
];

export const mil1553Plugin: ProtocolPlugin = {
  id: PROTOCOL_ID,
  name: PROTOCOL_DISPLAY_NAME,
  category: 'aerospace-uav',
  parser: mil1553Parser,
  documentation: {
    summary: 'protocol.mil1553.documentation.summary',
    layer: 'multi-layer',
  },
  exampleFrames: EXAMPLE_FRAMES,
  decodeOptions: DECODE_OPTIONS,
};
