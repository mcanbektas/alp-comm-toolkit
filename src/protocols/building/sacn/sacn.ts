/**
 * sACN / ANSI E1.31 (ESTA) — Root → Framing → DMP katmanlarıyla DMX512-A
 * verisini UDP/IP üzerinden taşıyan streaming protokolü (brief-faz10-
 * dalga6.md, 6c). Bu motor yalnız **E1.31 Data Packet**'i tam çözer; E1.31
 * Synchronization Packet ve E1.31 Universe Discovery Packet (brief kapsamı
 * dışı — sync/merge/discovery "ANALYZER" işi) Root Layer'dan sonra AD +
 * ham gövde + uyarıyla kalır (aşağıya bak).
 *
 * ── GİRDİ: TEK UDP PAYLOAD'I (coap.ts emsali) ───────────────────────────────
 * UDP datagramı mesaj sınırının KENDİSİDİR — TCP'nin aksine stream birleştirme
 * YOK (dalga 1 çizgisi, artnet.ts ile aynı model). `data` bir E1.31 paketinin
 * TAMAMIDIR.
 *
 * ── KAYNAK (Karar 2 — DMX ailesi KAMU, tek resmi kaynak yeter) ──────────────
 * Güncel yayımlanmış standart **ANSI E1.31-2025**'tir (5 Ocak 2026, +IPv6 —
 * `docs/spec/ozet/07-bina-otomasyonu.md` satır 313). Bu oturumda önce O sürüm
 * denendi: ESTA TSP'nin "Published Documents" sayfası (tsp.esta.org/tsp/
 * documents/published_docs.php) E1.31-2025 kaydını LİSTELER ama indirme linki
 * statik bir PDF değil, bir `postquery()` JS form-POST'u
 * (`downloaddoc.php`, `standardid=751`) — bu POST'u bu oturumda elle
 * tekrarladığımızda site "Please sign in with your email address" e-posta
 * kayıt duvarına düştü (HTML döndü, PDF değil). E-posta kaydı bu oturumda
 * TAMAMLANAMADI.
 *
 * Bunun yerine **ANSI E1.31-2018** aynı yöntemle (aynı published_docs.php
 * listesindeki bir önceki sürüm satırı) denendi ve bu kez DOĞRUDAN statik
 * URL'den (kayıt duvarı YOK) indi: `tsp.esta.org/tsp/documents/docs/
 * E1-31-2018.pdf`, 45 sayfa, `pdftotext -layout` TEMİZ metin çıkardı (art-
 * net.org.uk PDF'inin 6b'deki başarılı deneyiminin aynısı — OCR gerekmedi,
 * dmx512.ts'in 6a'da yaşadığı "indirildi ama okunamadı" sorunu burada
 * YAŞANMADI). Aşağıdaki TÜM bayt/bit sabitleri, ofsetler ve "Appendix A:
 * Defined Parameters (Normative)" değerleri BU metnin kendisinden — ikincil
 * özete güvenilmeden — birebir okunarak doğrulandı.
 *
 * 2018 ile 2025 arasındaki fark için tek kaynak `docs/spec/ozet/07-bina-
 * otomasyonu.md`nin kendisidir: 2025 revizyonu yalnız "IPv6 desteği eklemiş"
 * diye anılır (satır 313, 450) — Root/Framing/DMP bayt düzenini değiştirdiğine
 * dair HİÇBİR işaret yok. E1.31 gibi milyonlarca kurulu donanımın (konsol,
 * node, gateway) bağımlı olduğu 2014'ten beri sabit bir tel biçimini bir
 * revizyonda kırmak zaten ESTA'nın kendi "backward compatible" pratiğine
 * aykırı olurdu. Bu motor 2018 metnini birincil kaynak sayar; JSDoc bu
 * kısıtı ANAR (Karar 2'nin "resmi spec tek başına yeter" şartı, spec'in EN
 * GÜNCEL erişilebilir tam metnidir — 2025'in kendisi değil, ama aynı ailenin
 * normatif metni).
 *
 * ── ROOT LAYER (E1.31-2018 §5, Table 4-1 offset 0-37) ───────────────────────
 * • Preamble Size (0-1, 2B) = 0x0010 sabit (§5.1, "Sources shall set...").
 * • Post-amble Size (2-3, 2B) = 0x0000 sabit (§5.2, UDP'de post-amble yok).
 * • ACN Packet Identifier (4-15, 12B) = `0x41 0x53 0x43 0x2d 0x45 0x31 0x2e
 *   0x31 0x37 0x00 0x00 0x00` — ASCII "ASC-E1.17" + 3×0x00 dolgu (§5.3,
 *   birebir hex listesi). Bu, Art-Net'in 8 baytlık "Art-Net\0" imzasıyla AYNI
 *   rolü oynar: eşleşmezse paket sACN SAYILMAZ, çözümleme burada durur
 *   (`start-delimiter-not-found` — artnet.ts'in imza-hata deseninin aynısı).
 * • Flags & Length (16-17, 2B): üst 4 bit = 0x7 sabit desen, alt 12 bit =
 *   PDU length (§5.4, Figure 5-1) — bitCursor (`readBitsAsNumber`) ile okunur.
 *   Length "octet 16'dan başlayıp kalan HER baytı sayar" (§5.4 metni birebir)
 *   — bu yüzden `16 + length` TOPLAM çerçeve uzunluğunu vermeli (aşağıdaki
 *   "KATMAN-LENGTH TUTARLILIĞI" bölümüne bak).
 * • Vector (18-21, 4B) = `VECTOR_ROOT_E131_DATA` (0x00000004, Data Packet) ya
 *   da `VECTOR_ROOT_E131_EXTENDED` (0x00000008, Sync/Discovery Packet) —
 *   Appendix A. Bu alan motorun ANA DALLANMA noktasıdır (aşağıya bak).
 * • CID (22-37, 16B) = kaynağın UUID'si (RFC 4122, §5.6) — 8-4-4-4-12 hex
 *   gösterimiyle sunulur (dosya içi `formatCid`, types.ts'teki `RawFrame.id`
 *   üretimiyle AYNI gruplama, ondan İTHAL EDİLMEDİ — types.ts o fonksiyonu
 *   dışa açmıyor, protocol-core'un genel sözleşmesine yeni bir dışa-açık
 *   API eklemek bu motorun kapsamı değil).
 *
 * ── ANA DALLANMA: Root Vector (artnet.ts'in OpCode dispatch'iyle AYNI desen) ─
 * `VECTOR_ROOT_E131_DATA` → Framing+DMP katmanları TAM çözülür (aşağı bak).
 * `VECTOR_ROOT_E131_EXTENDED` → bu, bir Synchronization ya da Universe
 * Discovery paketidir; bu ikisinin Framing Layer'ı DATA PAKETİNİNKİNDEN
 * TAMAMEN FARKLIDIR (ör. Sync Packet'te Source Name/Priority/Options/
 * Universe YOK, yalnız Vector+Sequence+Sync Address+Reserved var — §6.3).
 * DATA paketinin sabit ofsetlerini buraya kör kör uygulamak BACnet/berReader
 * tuzağıyla AYNI hata olurdu (sessiz-yanlış çözüm — brief'in açıkça uyardığı
 * "en kötü mod"). Bu yüzden EXTENDED işaretliyse motor Root Layer'dan SONRAKİ
 * her baytı TEK ham blok olarak gösterir + "AD tanınır ama gövde bu turda
 * çözülmüyor" uyarısı — tıpkı artnet.ts'in "dar ad kümesi + ham gövde" OpCode
 * kolunun aynısı. Root Vector bu ikisinin DIŞINDAYSA (bilinmeyen değer) aynı
 * ham-blok yolu farklı bir uyarı koduyla izlenir (artnet'in "tanınmayan
 * OpCode" ayrımının aynısı).
 *
 * ── FRAMING LAYER — yalnız Data Packet kolunda (§6.2, offset 38-114) ────────
 * • Flags & Length (38-39, 2B): Root'la AYNI 4+12 bit desen; length "octet
 *   38'den başlar" (§6.1 desenin ROOT'takiyle simetriği; DMP'nin kendi
 *   paragrafıyla AÇIKÇA doğrulanan aynı formül, §7.1).
 * • Vector (40-43, 4B) = `VECTOR_E131_DATA_PACKET` (0x00000002, §6.2.1).
 * • Source Name (44-107, 64B) = UTF-8, NULL-TERMINATED (§6.2.2, "the source
 *   name shall be null-terminated") — `TextDecoder('utf-8')` ile çözülür
 *   (mqtt.ts'in `UTF8_DECODER` emsali), ilk 0x00'da kırpılır; ham 64 baytlık
 *   blok `rawBytes`te dolgu dahil KALIR, gösterilen `rawValue` metninde
 *   trailing null YOKTUR (brief tuzağı — artnet.ts'in `decodeNullTerminatedAscii`
 *   deseninin UTF-8 sürümü).
 * • Priority (108, 1B) = 0-200, varsayılan 100 (§6.2.3, "No priority outside
 *   the range of 0 to 200 shall be transmitted"). 200 = en yüksek öncelik.
 * • Synchronization Address (109-110, 2B, §6.2.4) — hangi universe'ta sync
 *   paketi bekleneceği; 0 = senkronizasyon kullanılmıyor (yaygın ikincil
 *   kullanım) — bu motor bunu YORUMLAMAZ, yalnız ham alan gösterir (brief:
 *   "sync ANALİZİ YOK").
 * • Sequence Number (111, 1B, §6.2.5) — kopya/sıra-dışı paket TESPİTİ için;
 *   ANALİZ YOK (brief §8), yalnız ham alan.
 * • Options (112, 1B, §6.2.6): bit7 Preview_Data, bit6 Stream_Terminated,
 *   bit5 Force_Synchronization, bit4-0 reserved (0 iletilir, alıcı YOK sayar
 *   — bu motor da reserved bitleri AYRI alan olarak basmaz). Spec'in "Bit 7 =
 *   en anlamlı bit" ifadesi msb-first ile birebir örtüşür: bitCursor'un
 *   msb-first `bitPosition 0` = spec'in "Bit 7"si (coap.ts'in Ver/Type/TKL
 *   deseninin aynısı — AYNI offset'te üç ayrı `ParsedField`, bit farkı
 *   ALAN ADINDA taşınır, types.ts'in kendi yönlendirmesi).
 * • Universe (113-114, 2B, §6.2.7) = 1-63999 geçerli; 0 ve 64000-65535
 *   REZERVE (64214 = `E131_DISCOVERY_UNIVERSE`, Appendix A — Discovery
 *   paketine ayrılmış, Data paketinde görülmesi beklenmez). Aralık dışıysa
 *   hata değil UYARI (dosya içi `WARN_UNIVERSE_OUT_OF_RANGE`).
 *
 * ── DMP LAYER — yalnız Data Packet kolunda (§7, offset 115-637) ─────────────
 * • Flags & Length (115-116, 2B): AYNI 4+12 bit desen; length "octet 115'ten
 *   başlar" (§7.1 birebir).
 * • Vector (117, 1B) = `VECTOR_DMP_SET_PROPERTY` (0x02, §7.2) — Appendix A bu
 *   değeri "(Informative)" diye işaretler: E1.31'in KENDİSİ değil, referans
 *   verdiği [ACN-DMP] 13.2 tanımlar; yine de telde giden değer budur ve §7.2
 *   normatif metni ("shall be set to… shall discard if not…") bunu net
 *   şart koşar.
 * • Address Type & Data Type (118, 1B) = 0xa1 sabit (§7.3).
 * • First Property Address (119-120, 2B) = 0x0000 sabit — "DMX512-A START
 *   Code DMP address 0'dadır" (§7.4).
 * • Address Increment (121-122, 2B) = 0x0001 sabit — "her property 1 oktet"
 *   (§7.5).
 * • Property Value Count (123-124, 2B) = **1 + slot sayısı** (§7.6, "1+ the
 *   number of slots in packet" — START CODE'u DA SAYAR, off-by-one tuzağı
 *   brief'te açıkça anılıyor). Geçerli aralık `0x0001-0x0201` (1-513, Table
 *   4-1) — yalnız start code'dan (513) tam 512 slota kadar.
 * • Property Values (125-637, 1-513B, §7.7) = START CODE + DMX slotları.
 *   dmx512.ts'in (6a, DOKUNULMADI) slot özet deseni BURADA AYNI YAKLAŞIMLA
 *   yeniden uygulanır (brief madde 4: "AYNI yaklaşımı uygula" — Art-Net'in
 *   DRY notunun TERSİNE, burada dmx512 ile ofset kayması BİREBİR aynı: bayt
 *   0 = start code, slot 1 = bayt 1 — Art-Net'in "Data[0]=Kanal 1" farkı
 *   sACN'de YOK, DMP burada da start-code'u bir slot DEĞİL ayrı alan sayar).
 *   İlk `SLOT_PREVIEW_COUNT` slot ayrı `ParsedField`, kalanı tek özet blok.
 *
 * ── KATMAN-LENGTH TUTARLILIĞI (MBAP/doip tonu, brief madde 5) ───────────────
 * Üç Flags&Length alanı İÇ İÇE aynı çerçeveyi tarif eder — her biri "kendi
 * ofsetinden çerçeve sonuna kadar" sayar (§5.4/§7.1 birebir metni, Framing
 * için simetri). Yani DÖRT bağımsız beyan aynı TOPLAM çerçeve uzunluğuna
 * işaret etmeli:
 *   16 + rootLength  ==  38 + framingLength  ==  115 + dmpLength
 *   ==  125 + propertyValueCount  ==  data.length (gerçek bayt sayısı)
 * (Spec'in kendi §5.4 örneği bunu doğrular: tam 512 slotluk yükte
 * rootLength=622, framingLength=600, dmpLength=523, propertyValueCount=513
 * → hepsi 16/38/115/125 eklenince 638'e — spec'in "total length of 638"
 * notuyla birebir örtüşür.) Modbus TCP'nin MBAP Length'i TEK bir beyanı
 * gerçek bayta karşı doğrularken, burada DÖRT beyan birbirine VE gerçek
 * bayta karşı doğrulanır — aynı disiplin, bir katman daha derin. Tutarsızsa
 * HATA değil TEK bir çerçeve uyarısı (`WARN_LAYER_LENGTH_MISMATCH`); alanlar
 * yine de GERÇEKTE mevcut baytlardan çözülür (artnet'in Length-mismatch
 * tonunun aynısı — beyan değil tel esas alınır).
 *
 * ── KAPSAM DIŞI (bilinçli, brief madde 8) ────────────────────────────────────
 * Sequence numarası sarma/kayıp tespiti, Priority'ye göre kaynak seçimi
 * (source arbitration), Universe Synchronization davranışı (ArtSync emsali),
 * CID'ye göre kaynak eşleştirme, Universe Discovery Packet'in Page/Last
 * Page/List of Universes alanları — hepsi ÇOK-PAKETLİ analyzer işi (E1.31-
 * 2018 §11/§12; `docs/spec/ozet/07-bina-otomasyonu.md` "sACN Sequence",
 * "sACN Source Merge", "sACN Universe Synchronization" bölümleri). Bu motor
 * TEK paketlik alan çözümüdür — artnet.ts ve dmx512.ts ile aynı sınır.
 */

import { bytesToNumber } from '@/protocol-core/buffers/endianness';
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

const PROTOCOL_ID = 'sacn';
/** Protokol adı veridir, çeviriye girmez (CLAUDE.md). */
const PROTOCOL_DISPLAY_NAME = 'sACN';

const HEX_RADIX = 16;

// --- Root Layer ofset/uzunlukları (E1.31-2018 Table 4-1, offset 0-37) ---
const PREAMBLE_SIZE_OFFSET = 0;
const POSTAMBLE_SIZE_OFFSET = 2;
const ACN_PACKET_IDENTIFIER_OFFSET = 4;
const ACN_PACKET_IDENTIFIER_LENGTH = 12;
const ROOT_FLAGS_LENGTH_OFFSET = 16;
const ROOT_VECTOR_OFFSET = 18;
const ROOT_VECTOR_LENGTH = 4;
const CID_OFFSET = 22;
const CID_LENGTH = 16;
/** Root Layer'ın toplam uzunluğu — Framing Layer'ın başladığı ofset. */
const ROOT_LAYER_LENGTH = 38;

// --- Framing Layer ofset/uzunlukları (§6.2, offset 38-114 — yalnız Data Packet) ---
const FRAMING_FLAGS_LENGTH_OFFSET = 38;
const FRAMING_VECTOR_OFFSET = 40;
const FRAMING_VECTOR_LENGTH = 4;
const SOURCE_NAME_OFFSET = 44;
const SOURCE_NAME_LENGTH = 64;
const PRIORITY_OFFSET = 108;
const SYNC_ADDRESS_OFFSET = 109;
const SEQUENCE_NUMBER_OFFSET = 111;
const OPTIONS_OFFSET = 112;
const UNIVERSE_OFFSET = 113;
/** Framing Layer'ın toplam uzunluğu — DMP Layer'ın başladığı ofset. */
const FRAMING_LAYER_LENGTH = 115;

// --- DMP Layer ofset/uzunlukları (§7, offset 115-637) ---
const DMP_FLAGS_LENGTH_OFFSET = 115;
const DMP_VECTOR_OFFSET = 117;
const ADDRESS_TYPE_DATA_TYPE_OFFSET = 118;
const FIRST_PROPERTY_ADDRESS_OFFSET = 119;
const ADDRESS_INCREMENT_OFFSET = 121;
const PROPERTY_VALUE_COUNT_OFFSET = 123;
/** DMP Layer sabit-genişlikli başlığının toplam uzunluğu (Property Values'tan önce). */
const DMP_HEADER_LENGTH = 125;
const PROPERTY_VALUES_OFFSET = DMP_HEADER_LENGTH;

const MAX_DMX_SLOTS = 512;
/**
 * Start code + en çok 512 slot (§7.6, Table 4-1: "0x0001 -- 0x0201"). Tam
 * yükte bu, spec'in kendi doğrulama sayısıyla (§5.4 NOTE) örtüşür:
 * `PROPERTY_VALUES_OFFSET(125) + MAX_PROPERTY_VALUES(513) = 638`.
 */
const MAX_PROPERTY_VALUES = MAX_DMX_SLOTS + 1;

/** İlk bu kadar slot ayrı `ParsedField` olur; kalanı tek özet alana toplanır (dmx512.ts deseni). */
const SLOT_PREVIEW_COUNT = 16;

// --- Sabit beklenen değerler (Appendix A: Defined Parameters (Normative)) ---
const EXPECTED_PREAMBLE_SIZE = 0x0010;
const EXPECTED_POSTAMBLE_SIZE = 0x0000;
/** "ASC-E1.17" ASCII + 3×0x00 dolgu (§5.3, hex listesi birebir). */
const ACN_PACKET_IDENTIFIER = Uint8Array.from([
  0x41, 0x53, 0x43, 0x2d, 0x45, 0x31, 0x2e, 0x31, 0x37, 0x00, 0x00, 0x00,
]);
const VECTOR_ROOT_E131_DATA = 0x00000004;
const VECTOR_ROOT_E131_EXTENDED = 0x00000008;
const VECTOR_E131_DATA_PACKET = 0x00000002;
/** DMP vektörü 1 baytlıktır (offset 117); Appendix A "(Informative)" notuyla 0x02 verir. */
const VECTOR_DMP_SET_PROPERTY = 0x02;
const EXPECTED_ADDRESS_TYPE_DATA_TYPE = 0xa1;
const EXPECTED_FIRST_PROPERTY_ADDRESS = 0x0000;
const EXPECTED_ADDRESS_INCREMENT = 0x0001;
/** Root/Framing/DMP Flags&Length'in üst 4 biti (§5.4/§7.1 Figure'ları). */
const EXPECTED_FLAGS_NIBBLE = 0x7;

const MIN_PRIORITY = 0;
const MAX_PRIORITY = 200;
const MIN_UNIVERSE = 1;
const MAX_UNIVERSE = 63999;

/** Root Layer'ın adını taşıyan ad tablosu — motorun ana dallanma noktası (dosya başı). */
const ROOT_VECTOR_NAMES: ReadonlyMap<number, string> = new Map([
  [VECTOR_ROOT_E131_DATA, 'VECTOR_ROOT_E131_DATA'],
  [VECTOR_ROOT_E131_EXTENDED, 'VECTOR_ROOT_E131_EXTENDED'],
]);

const ERROR_FRAME_TOO_SHORT = 'protocol.sacn.error.frameTooShort';
const ERROR_INVALID_ACN_PACKET_IDENTIFIER = 'protocol.sacn.error.invalidAcnPacketIdentifier';
const ERROR_BODY_TRUNCATED = 'protocol.sacn.error.bodyTruncated';
const ERROR_FRAME_TOO_LONG = 'protocol.sacn.error.frameTooLong';
const ERROR_ABORTED = 'protocol.sacn.error.aborted';

const WARN_UNEXPECTED_FIXED_VALUE = 'protocol.sacn.warning.unexpectedFixedValue';
const WARN_UNEXPECTED_FLAGS_NIBBLE = 'protocol.sacn.warning.unexpectedFlagsNibble';
const WARN_UNRECOGNIZED_ROOT_VECTOR = 'protocol.sacn.warning.unrecognizedRootVector';
const WARN_ROOT_VECTOR_BODY_NOT_DECODED = 'protocol.sacn.warning.rootVectorBodyNotDecoded';
const WARN_PRIORITY_OUT_OF_RANGE = 'protocol.sacn.warning.priorityOutOfRange';
const WARN_UNIVERSE_OUT_OF_RANGE = 'protocol.sacn.warning.universeOutOfRange';
const WARN_LAYER_LENGTH_MISMATCH = 'protocol.sacn.warning.layerLengthMismatch';

const SUMMARY_DATA_PACKET = 'protocol.sacn.summary.dataPacket';
const SUMMARY_EXTENDED_ROOT_VECTOR = 'protocol.sacn.summary.extendedRootVectorRaw';
const SUMMARY_UNRECOGNIZED_ROOT_VECTOR = 'protocol.sacn.summary.unrecognizedRootVector';
const SUMMARY_INVALID_ACN_PACKET_IDENTIFIER = 'protocol.sacn.summary.invalidAcnPacketIdentifier';

export type SacnFrameMetadata = {
  /** ACN Packet Identifier doğrulanamadıysa Root Vector hiç okunmaz — bu yüzden opsiyonel. */
  rootVector?: number;
  summaryKey: string;
  summaryParams: Record<string, string>;
};

interface ShapeResult {
  summaryKey: string;
  summaryParams: Record<string, string>;
}

function toProtocolWarning(key: string): ProtocolWarning {
  return { code: key, message: key };
}

/** noUncheckedIndexedAccess: bayt dizisi erişimi her yerde bu guard'dan geçer. */
function byteAt(data: Uint8Array, offset: number): number {
  return data[offset] ?? 0;
}

function formatHexByte(value: number): string {
  return `0x${value.toString(HEX_RADIX).toUpperCase().padStart(2, '0')}`;
}

function formatHexUint32(value: number): string {
  return `0x${value.toString(HEX_RADIX).toUpperCase().padStart(8, '0')}`;
}

/** CID 16 baytlık bir UUID'dir (§5.6, RFC 4122) — standart 8-4-4-4-12 hex gösterimi. Bu VERİ gösterimi çeviri anahtarı değil, tire tuzağı burada geçerli değil (brief). */
function formatCid(bytes: Uint8Array): string {
  const hex = Array.from(bytes, (byte) => byte.toString(HEX_RADIX).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

const UTF8_DECODER = new TextDecoder('utf-8');

/** Source Name: 64 baytlık UTF-8, null-terminated (§6.2.2) — mqtt.ts'in UTF8_DECODER emsali. İlk 0x00'da kırpar; UTF-8'de ham 0x00 yalnız NUL kod noktasını temsil edebilir (çok baytlı dizilerin devam/öncü baytları hep ≥0x80), bu yüzden decode ÖNCESİ bayt düzeyinde kesmek güvenlidir. */
function decodeNullTerminatedUtf8(bytes: Uint8Array): string {
  const nullIndex = bytes.indexOf(0);
  const textBytes = nullIndex === -1 ? bytes : bytes.subarray(0, nullIndex);
  return UTF8_DECODER.decode(textBytes);
}

function matchesAcnPacketIdentifier(bytes: Uint8Array): boolean {
  if (bytes.length !== ACN_PACKET_IDENTIFIER_LENGTH) return false;
  for (let index = 0; index < ACN_PACKET_IDENTIFIER_LENGTH; index += 1) {
    if (byteAt(bytes, index) !== byteAt(ACN_PACKET_IDENTIFIER, index)) return false;
  }
  return true;
}

/** artnet.ts `requireBytes` deseni — yetersiz bayt bulunca TEK ortak hata mesajıyla `errors`e düşer. */
function requireBytes(data: Uint8Array, offset: number, needed: number, errors: ProtocolError[]): boolean {
  if (data.length - offset < needed) {
    errors.push({
      code: 'truncated-frame',
      message: ERROR_BODY_TRUNCATED,
      offset,
      length: Math.max(0, data.length - offset),
    });
    return false;
  }
  return true;
}

/**
 * TEK bir spec-sabit değeri (Preamble/Post-amble Size, Framing/DMP Vector,
 * Address Type & Data Type, First Property Address, Address Increment)
 * bekleyen alanların ortak kalıbı — hepsi "shall discard the packet if the
 * received value is not X" normatif cümlesini paylaşır (§5.1/§5.2/§7.3/
 * §7.4/§7.5), ama bu motor "discard" ETMEZ (kısmi çözüm gösterilir, spec
 * §47 tonu): uyuşmazlık HATA değil `valid:false` + uyarı.
 */
function fixedValueField(
  id: string,
  name: string,
  offset: number,
  length: number,
  data: Uint8Array,
  value: number,
  expected: number,
  warnings: ProtocolWarning[],
): ParsedField {
  const valid = value === expected;
  const field: ParsedField = {
    id,
    name,
    offset,
    length,
    rawBytes: data.slice(offset, offset + length),
    rawValue: value,
    valid,
    warnings: [],
  };
  if (!valid) {
    field.warnings.push(WARN_UNEXPECTED_FIXED_VALUE);
    warnings.push(toProtocolWarning(WARN_UNEXPECTED_FIXED_VALUE));
  }
  return field;
}

/**
 * Flags&Length 16-bit alanı — üst 4 bit sabit desen 0x7, alt 12 bit PDU
 * uzunluğu (§5.4/§7.1, bitCursor ile). `rawValue` operasyonel olarak asıl
 * kullanılan sayıdır (uzunluk); flags nibble'ın kendisi bu alanın
 * geçerliliğini belirler — spec'in "Flags and Length"i TEK alan olarak
 * tarif etmesiyle (Table 4-1'in tek satırı) aynı granülerlik.
 */
function flagsAndLengthField(
  id: string,
  name: string,
  offset: number,
  data: Uint8Array,
  warnings: ProtocolWarning[],
): { readonly field: ParsedField; readonly length: number } {
  const flagsNibble = readBitsAsNumber(data, offset * 8, 4);
  const length = readBitsAsNumber(data, offset * 8 + 4, 12);
  const valid = flagsNibble === EXPECTED_FLAGS_NIBBLE;
  const field: ParsedField = {
    id,
    name,
    offset,
    length: 2,
    rawBytes: data.slice(offset, offset + 2),
    rawValue: length,
    physicalValue: `flags ${formatHexByte(flagsNibble)}`,
    valid,
    warnings: [],
  };
  if (!valid) {
    field.warnings.push(WARN_UNEXPECTED_FLAGS_NIBBLE);
    warnings.push(toProtocolWarning(WARN_UNEXPECTED_FLAGS_NIBBLE));
  }
  return { field, length };
}

/**
 * DMP Property Values (start code + slotlar) — dmx512.ts'in (6a, DOKUNULMADI)
 * önizleme+özet alan İLKESİ burada AYNI yaklaşımla yeniden uygulanır (brief
 * madde 4: dmx512'nin tersine burada da bayt 0 = start code kayması VAR,
 * Art-Net'teki "Data[0]=Kanal 1" farkı yok — bkz. dosya başı).
 */
function pushPropertyValueFields(
  data: Uint8Array,
  propertyValuesOffset: number,
  actualLength: number,
  fields: ParsedField[],
): void {
  if (actualLength <= 0) return;

  fields.push({
    id: 'start-code',
    name: 'Start Code',
    offset: propertyValuesOffset,
    length: 1,
    rawBytes: data.slice(propertyValuesOffset, propertyValuesOffset + 1),
    rawValue: byteAt(data, propertyValuesOffset),
    valid: true,
    warnings: [],
  });

  const slotCount = actualLength - 1;
  const slotsOffset = propertyValuesOffset + 1;
  const previewCount = Math.min(slotCount, SLOT_PREVIEW_COUNT);
  for (let index = 0; index < previewCount; index += 1) {
    const slotNumber = index + 1;
    const slotOffset = slotsOffset + index;
    fields.push({
      id: `slot-${String(slotNumber)}`,
      name: `Slot ${String(slotNumber)}`,
      offset: slotOffset,
      length: 1,
      rawBytes: data.slice(slotOffset, slotOffset + 1),
      rawValue: byteAt(data, slotOffset),
      valid: true,
      warnings: [],
    });
  }

  if (slotCount > previewCount) {
    const remainderOffset = slotsOffset + previewCount;
    const remainderLength = slotCount - previewCount;
    fields.push({
      id: 'slot-data',
      name: `Slots ${String(previewCount + 1)}-${String(slotCount)}`,
      offset: remainderOffset,
      length: remainderLength,
      rawBytes: data.slice(remainderOffset, remainderOffset + remainderLength),
      unit: 'B',
      valid: true,
      warnings: [],
    });
  }
}

/**
 * Dört bağımsız uzunluk beyanının (Root/Framing/DMP Flags&Length + Property
 * Value Count) aynı TOPLAM çerçeve uzunluğuna işaret edip etmediğini denetler
 * (dosya başı "KATMAN-LENGTH TUTARLILIĞI" — MBAP/doip tonu, brief madde 5).
 */
function impliedTotalLengthsMatch(
  actualLength: number,
  rootLength: number,
  framingLength: number,
  dmpLength: number,
  propertyValueCount: number,
): boolean {
  const impliedByRoot = ROOT_FLAGS_LENGTH_OFFSET + rootLength;
  const impliedByFraming = FRAMING_FLAGS_LENGTH_OFFSET + framingLength;
  const impliedByDmp = DMP_FLAGS_LENGTH_OFFSET + dmpLength;
  const impliedByPropertyCount = PROPERTY_VALUES_OFFSET + propertyValueCount;
  return (
    impliedByRoot === actualLength &&
    impliedByFraming === actualLength &&
    impliedByDmp === actualLength &&
    impliedByPropertyCount === actualLength
  );
}

/**
 * E1.31 Data Packet: Framing Layer + DMP Layer tam çözümü (§6.2 + §7).
 * `rootLength` çağıranın ZATEN OKUDUĞU Root Layer Flags&Length değeridir —
 * burada YENİDEN TÜRETİLMEZ: katman-length tutarlılık kontrolü ancak dört
 * bağımsız beyanın HER BİRİ telden okunmuş gerçek değerse anlamlıdır (dosya
 * başı "KATMAN-LENGTH TUTARLILIĞI"); framing'ten sentetik üretilen bir "root"
 * değeri kontrolü kör bırakırdı (root-vs-framing tutarsızlığı hiç YAKALANMAZ).
 */
function decodeDataPacketBody(
  data: Uint8Array,
  rootLength: number,
  fields: ParsedField[],
  warnings: ProtocolWarning[],
  errors: ProtocolError[],
): ShapeResult {
  const summaryParams: Record<string, string> = {};

  if (!requireBytes(data, ROOT_LAYER_LENGTH, FRAMING_LAYER_LENGTH - ROOT_LAYER_LENGTH, errors)) {
    return { summaryKey: SUMMARY_DATA_PACKET, summaryParams };
  }

  const framingFlagsAndLength = flagsAndLengthField(
    'framing-flags-and-length',
    'Flags and Length',
    FRAMING_FLAGS_LENGTH_OFFSET,
    data,
    warnings,
  );
  fields.push(framingFlagsAndLength.field);

  const framingVector = bytesToNumber(
    data.slice(FRAMING_VECTOR_OFFSET, FRAMING_VECTOR_OFFSET + FRAMING_VECTOR_LENGTH),
    'big',
  );
  fields.push(
    fixedValueField(
      'framing-vector',
      'Vector',
      FRAMING_VECTOR_OFFSET,
      FRAMING_VECTOR_LENGTH,
      data,
      framingVector,
      VECTOR_E131_DATA_PACKET,
      warnings,
    ),
  );

  const sourceNameBytes = data.slice(SOURCE_NAME_OFFSET, SOURCE_NAME_OFFSET + SOURCE_NAME_LENGTH);
  const sourceName = decodeNullTerminatedUtf8(sourceNameBytes);
  fields.push({
    id: 'source-name',
    name: 'Source Name',
    offset: SOURCE_NAME_OFFSET,
    length: SOURCE_NAME_LENGTH,
    rawBytes: sourceNameBytes,
    rawValue: sourceName,
    valid: true,
    warnings: [],
  });
  summaryParams['sourceName'] = sourceName;

  const priority = byteAt(data, PRIORITY_OFFSET);
  const priorityValid = priority >= MIN_PRIORITY && priority <= MAX_PRIORITY;
  const priorityField: ParsedField = {
    id: 'priority',
    name: 'Priority',
    offset: PRIORITY_OFFSET,
    length: 1,
    rawBytes: data.slice(PRIORITY_OFFSET, PRIORITY_OFFSET + 1),
    rawValue: priority,
    valid: priorityValid,
    warnings: [],
  };
  if (!priorityValid) {
    priorityField.warnings.push(WARN_PRIORITY_OUT_OF_RANGE);
    warnings.push(toProtocolWarning(WARN_PRIORITY_OUT_OF_RANGE));
  }
  fields.push(priorityField);
  summaryParams['priority'] = String(priority);

  const syncAddress = bytesToNumber(data.slice(SYNC_ADDRESS_OFFSET, SYNC_ADDRESS_OFFSET + 2), 'big');
  fields.push({
    id: 'synchronization-address',
    name: 'Synchronization Address',
    offset: SYNC_ADDRESS_OFFSET,
    length: 2,
    rawBytes: data.slice(SYNC_ADDRESS_OFFSET, SYNC_ADDRESS_OFFSET + 2),
    rawValue: syncAddress,
    valid: true,
    warnings: [],
  });

  // Analiz YOK (brief madde 8) — ham alan, physicalValue/valid yorumu yok.
  fields.push({
    id: 'sequence-number',
    name: 'Sequence Number',
    offset: SEQUENCE_NUMBER_OFFSET,
    length: 1,
    rawBytes: data.slice(SEQUENCE_NUMBER_OFFSET, SEQUENCE_NUMBER_OFFSET + 1),
    rawValue: byteAt(data, SEQUENCE_NUMBER_OFFSET),
    valid: true,
    warnings: [],
  });

  // Options bitleri — coap.ts'in Ver/Type/TKL deseni: AYNI offset'te üç ayrı
  // alan, bit farkı ADDA taşınır (§6.2.6, dosya başı).
  const optionsRawBytes = data.slice(OPTIONS_OFFSET, OPTIONS_OFFSET + 1);
  const previewData = readBitsAsNumber(data, OPTIONS_OFFSET * 8, 1);
  fields.push({
    id: 'preview-data',
    name: 'Preview_Data (bit 7)',
    offset: OPTIONS_OFFSET,
    length: 1,
    rawBytes: optionsRawBytes,
    rawValue: previewData,
    physicalValue: previewData === 1 ? 'Set' : 'Not set',
    valid: true,
    warnings: [],
  });
  const streamTerminated = readBitsAsNumber(data, OPTIONS_OFFSET * 8 + 1, 1);
  fields.push({
    id: 'stream-terminated',
    name: 'Stream_Terminated (bit 6)',
    offset: OPTIONS_OFFSET,
    length: 1,
    rawBytes: optionsRawBytes,
    rawValue: streamTerminated,
    physicalValue: streamTerminated === 1 ? 'Set' : 'Not set',
    valid: true,
    warnings: [],
  });
  const forceSynchronization = readBitsAsNumber(data, OPTIONS_OFFSET * 8 + 2, 1);
  fields.push({
    id: 'force-synchronization',
    name: 'Force_Synchronization (bit 5)',
    offset: OPTIONS_OFFSET,
    length: 1,
    rawBytes: optionsRawBytes,
    rawValue: forceSynchronization,
    physicalValue: forceSynchronization === 1 ? 'Set' : 'Not set',
    valid: true,
    warnings: [],
  });

  const universe = bytesToNumber(data.slice(UNIVERSE_OFFSET, UNIVERSE_OFFSET + 2), 'big');
  const universeValid = universe >= MIN_UNIVERSE && universe <= MAX_UNIVERSE;
  const universeField: ParsedField = {
    id: 'universe',
    name: 'Universe',
    offset: UNIVERSE_OFFSET,
    length: 2,
    rawBytes: data.slice(UNIVERSE_OFFSET, UNIVERSE_OFFSET + 2),
    rawValue: universe,
    valid: universeValid,
    warnings: [],
  };
  if (!universeValid) {
    universeField.warnings.push(WARN_UNIVERSE_OUT_OF_RANGE);
    warnings.push(toProtocolWarning(WARN_UNIVERSE_OUT_OF_RANGE));
  }
  fields.push(universeField);
  summaryParams['universe'] = String(universe);

  // --- DMP Layer ---
  if (!requireBytes(data, FRAMING_LAYER_LENGTH, DMP_HEADER_LENGTH - FRAMING_LAYER_LENGTH, errors)) {
    return { summaryKey: SUMMARY_DATA_PACKET, summaryParams };
  }

  const dmpFlagsAndLength = flagsAndLengthField(
    'dmp-flags-and-length',
    'Flags and Length',
    DMP_FLAGS_LENGTH_OFFSET,
    data,
    warnings,
  );
  fields.push(dmpFlagsAndLength.field);

  const dmpVector = byteAt(data, DMP_VECTOR_OFFSET);
  fields.push(
    fixedValueField('dmp-vector', 'Vector', DMP_VECTOR_OFFSET, 1, data, dmpVector, VECTOR_DMP_SET_PROPERTY, warnings),
  );

  const addressTypeDataType = byteAt(data, ADDRESS_TYPE_DATA_TYPE_OFFSET);
  fields.push(
    fixedValueField(
      'address-type-and-data-type',
      'Address Type & Data Type',
      ADDRESS_TYPE_DATA_TYPE_OFFSET,
      1,
      data,
      addressTypeDataType,
      EXPECTED_ADDRESS_TYPE_DATA_TYPE,
      warnings,
    ),
  );

  const firstPropertyAddress = bytesToNumber(
    data.slice(FIRST_PROPERTY_ADDRESS_OFFSET, FIRST_PROPERTY_ADDRESS_OFFSET + 2),
    'big',
  );
  fields.push(
    fixedValueField(
      'first-property-address',
      'First Property Address',
      FIRST_PROPERTY_ADDRESS_OFFSET,
      2,
      data,
      firstPropertyAddress,
      EXPECTED_FIRST_PROPERTY_ADDRESS,
      warnings,
    ),
  );

  const addressIncrement = bytesToNumber(data.slice(ADDRESS_INCREMENT_OFFSET, ADDRESS_INCREMENT_OFFSET + 2), 'big');
  fields.push(
    fixedValueField(
      'address-increment',
      'Address Increment',
      ADDRESS_INCREMENT_OFFSET,
      2,
      data,
      addressIncrement,
      EXPECTED_ADDRESS_INCREMENT,
      warnings,
    ),
  );

  const propertyValueCount = bytesToNumber(
    data.slice(PROPERTY_VALUE_COUNT_OFFSET, PROPERTY_VALUE_COUNT_OFFSET + 2),
    'big',
  );
  fields.push({
    id: 'property-value-count',
    name: 'Property Value Count',
    offset: PROPERTY_VALUE_COUNT_OFFSET,
    length: 2,
    rawBytes: data.slice(PROPERTY_VALUE_COUNT_OFFSET, PROPERTY_VALUE_COUNT_OFFSET + 2),
    // 1 + slot sayısı (start code DAHİL — §7.6, off-by-one tuzağı dosya başı).
    physicalValue: `1 + ${String(Math.max(0, propertyValueCount - 1))} slot`,
    rawValue: propertyValueCount,
    valid: propertyValueCount >= 1 && propertyValueCount <= MAX_PROPERTY_VALUES,
    warnings: [],
  });

  // --- Katman-length tutarlılığı (dosya başı, MBAP/doip tonu) ---
  const consistent = impliedTotalLengthsMatch(
    data.length,
    rootLength,
    framingFlagsAndLength.length,
    dmpFlagsAndLength.length,
    propertyValueCount,
  );
  if (!consistent) {
    warnings.push(toProtocolWarning(WARN_LAYER_LENGTH_MISMATCH));
  }

  // --- Property Values: start code + slotlar, HER ZAMAN gerçek mevcut bayttan (beyandan değil) ---
  const actualPropertyValuesLength = data.length - PROPERTY_VALUES_OFFSET;
  pushPropertyValueFields(data, PROPERTY_VALUES_OFFSET, actualPropertyValuesLength, fields);
  summaryParams['slotCount'] = String(Math.max(0, actualPropertyValuesLength - 1));

  return { summaryKey: SUMMARY_DATA_PACKET, summaryParams };
}

/**
 * Root Vector `VECTOR_ROOT_E131_EXTENDED` (Synchronization ya da Universe
 * Discovery Packet) — bu ikisinin Framing Layer'ı Data Packet'inkinden
 * TAMAMEN FARKLI olduğu için (dosya başı) gövde bu turda çözülmez, tek ham
 * blok + uyarı (artnet.ts'in "dar ad kümesi + ham gövde" deseninin aynısı).
 */
function decodeExtendedRootVectorBody(
  data: Uint8Array,
  fields: ParsedField[],
  warnings: ProtocolWarning[],
): ShapeResult {
  if (data.length > ROOT_LAYER_LENGTH) {
    fields.push({
      id: 'body',
      name: 'Body (raw) — Synchronization / Universe Discovery Packet',
      offset: ROOT_LAYER_LENGTH,
      length: data.length - ROOT_LAYER_LENGTH,
      rawBytes: data.slice(ROOT_LAYER_LENGTH),
      unit: 'B',
      valid: true,
      warnings: [WARN_ROOT_VECTOR_BODY_NOT_DECODED],
    });
  }
  warnings.push(toProtocolWarning(WARN_ROOT_VECTOR_BODY_NOT_DECODED));
  return { summaryKey: SUMMARY_EXTENDED_ROOT_VECTOR, summaryParams: {} };
}

/** Root Vector Appendix A'daki iki değerin (DATA/EXTENDED) DIŞINDA — ham + "tanınmayan" uyarısı. */
function decodeUnrecognizedRootVectorBody(
  data: Uint8Array,
  fields: ParsedField[],
  rootVector: number,
): ShapeResult {
  if (data.length > ROOT_LAYER_LENGTH) {
    fields.push({
      id: 'body',
      name: 'Body (raw)',
      offset: ROOT_LAYER_LENGTH,
      length: data.length - ROOT_LAYER_LENGTH,
      rawBytes: data.slice(ROOT_LAYER_LENGTH),
      unit: 'B',
      valid: false,
      warnings: [WARN_UNRECOGNIZED_ROOT_VECTOR],
    });
  }
  return {
    summaryKey: SUMMARY_UNRECOGNIZED_ROOT_VECTOR,
    summaryParams: { rootVector: formatHexUint32(rootVector) },
  };
}

interface SacnParseOptions {
  timestamp?: number;
  direction?: FrameDirection;
  channel?: string;
  maxFrameLength?: number;
  signal?: AbortSignal;
}

function finishFrame(
  data: Uint8Array,
  fields: ParsedField[],
  warnings: ProtocolWarning[],
  errors: ProtocolError[],
  options: SacnParseOptions,
  metadata: SacnFrameMetadata,
): ParseResult {
  const rawFrame = createRawFrame(data, {
    ...(options.timestamp === undefined ? {} : { timestamp: options.timestamp }),
    ...(options.direction === undefined ? {} : { direction: options.direction }),
    ...(options.channel === undefined ? {} : { channel: options.channel }),
    metadata,
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

function parseSacnFrame(data: Uint8Array, options: SacnParseOptions): ParseResult {
  if (options.signal?.aborted === true) {
    return {
      success: false,
      error: { code: 'parser-timeout', message: ERROR_ABORTED },
      consumedBytes: 0,
      recoverable: false,
    };
  }

  if (data.length < ACN_PACKET_IDENTIFIER_OFFSET + ACN_PACKET_IDENTIFIER_LENGTH) {
    return {
      success: false,
      error: { code: 'truncated-frame', message: ERROR_FRAME_TOO_SHORT, offset: 0, length: data.length },
      consumedBytes: 0,
      recoverable: true,
    };
  }

  if (options.maxFrameLength !== undefined && data.length > options.maxFrameLength) {
    return {
      success: false,
      error: {
        code: 'frame-too-long',
        message: ERROR_FRAME_TOO_LONG,
        offset: options.maxFrameLength,
        length: data.length - options.maxFrameLength,
        details: { maxFrameLength: options.maxFrameLength, frameLength: data.length },
      },
      consumedBytes: 0,
      recoverable: false,
    };
  }

  const fields: ParsedField[] = [];
  const warnings: ProtocolWarning[] = [];
  const errors: ProtocolError[] = [];

  // --- Preamble / Post-amble Size (dosya başı: "discard" edilmez, uyarı) ---
  const preambleSize = bytesToNumber(data.slice(PREAMBLE_SIZE_OFFSET, PREAMBLE_SIZE_OFFSET + 2), 'big');
  fields.push(
    fixedValueField(
      'preamble-size',
      'Preamble Size',
      PREAMBLE_SIZE_OFFSET,
      2,
      data,
      preambleSize,
      EXPECTED_PREAMBLE_SIZE,
      warnings,
    ),
  );
  const postambleSize = bytesToNumber(data.slice(POSTAMBLE_SIZE_OFFSET, POSTAMBLE_SIZE_OFFSET + 2), 'big');
  fields.push(
    fixedValueField(
      'post-amble-size',
      'Post-amble Size',
      POSTAMBLE_SIZE_OFFSET,
      2,
      data,
      postambleSize,
      EXPECTED_POSTAMBLE_SIZE,
      warnings,
    ),
  );

  // --- ACN Packet Identifier (12 bayt sabit imza — Art-Net'in ID'siyle AYNI rol, dosya başı) ---
  const acnPacketIdentifierBytes = data.slice(
    ACN_PACKET_IDENTIFIER_OFFSET,
    ACN_PACKET_IDENTIFIER_OFFSET + ACN_PACKET_IDENTIFIER_LENGTH,
  );
  const acnPacketIdentifierValid = matchesAcnPacketIdentifier(acnPacketIdentifierBytes);
  fields.push({
    id: 'acn-packet-identifier',
    name: 'ACN Packet Identifier',
    offset: ACN_PACKET_IDENTIFIER_OFFSET,
    length: ACN_PACKET_IDENTIFIER_LENGTH,
    rawBytes: acnPacketIdentifierBytes,
    rawValue: decodeNullTerminatedUtf8(acnPacketIdentifierBytes),
    valid: acnPacketIdentifierValid,
    warnings: acnPacketIdentifierValid ? [] : [ERROR_INVALID_ACN_PACKET_IDENTIFIER],
  });

  if (!acnPacketIdentifierValid) {
    // Bu imza olmadan paket sACN SAYILMAZ (dosya başı) — sonraki baytlar
    // Flags&Length/Vector/CID sanılıp yorumlanmaz, çözümleme burada durur.
    errors.push({
      code: 'start-delimiter-not-found',
      message: ERROR_INVALID_ACN_PACKET_IDENTIFIER,
      offset: ACN_PACKET_IDENTIFIER_OFFSET,
      length: ACN_PACKET_IDENTIFIER_LENGTH,
    });
    const metadata: SacnFrameMetadata = { summaryKey: SUMMARY_INVALID_ACN_PACKET_IDENTIFIER, summaryParams: {} };
    return finishFrame(data, fields, warnings, errors, options, metadata);
  }

  // --- Root Layer: Flags&Length + Vector + CID (imza doğrulandıktan sonra, offset 16-37) ---
  if (!requireBytes(data, ACN_PACKET_IDENTIFIER_OFFSET + ACN_PACKET_IDENTIFIER_LENGTH, ROOT_LAYER_LENGTH - (ACN_PACKET_IDENTIFIER_OFFSET + ACN_PACKET_IDENTIFIER_LENGTH), errors)) {
    const metadata: SacnFrameMetadata = { summaryKey: SUMMARY_INVALID_ACN_PACKET_IDENTIFIER, summaryParams: {} };
    return finishFrame(data, fields, warnings, errors, options, metadata);
  }

  const rootFlagsAndLength = flagsAndLengthField(
    'root-flags-and-length',
    'Flags and Length',
    ROOT_FLAGS_LENGTH_OFFSET,
    data,
    warnings,
  );
  fields.push(rootFlagsAndLength.field);

  const rootVector = bytesToNumber(data.slice(ROOT_VECTOR_OFFSET, ROOT_VECTOR_OFFSET + ROOT_VECTOR_LENGTH), 'big');
  const rootVectorName = ROOT_VECTOR_NAMES.get(rootVector);
  const rootVectorField: ParsedField = {
    id: 'root-vector',
    name: 'Vector',
    offset: ROOT_VECTOR_OFFSET,
    length: ROOT_VECTOR_LENGTH,
    rawBytes: data.slice(ROOT_VECTOR_OFFSET, ROOT_VECTOR_OFFSET + ROOT_VECTOR_LENGTH),
    rawValue: rootVector,
    valid: rootVectorName !== undefined,
    warnings: [],
  };
  if (rootVectorName !== undefined) {
    rootVectorField.physicalValue = rootVectorName;
  } else {
    rootVectorField.warnings.push(WARN_UNRECOGNIZED_ROOT_VECTOR);
    warnings.push(toProtocolWarning(WARN_UNRECOGNIZED_ROOT_VECTOR));
  }
  fields.push(rootVectorField);

  const cidBytes = data.slice(CID_OFFSET, CID_OFFSET + CID_LENGTH);
  fields.push({
    id: 'cid',
    name: 'CID',
    offset: CID_OFFSET,
    length: CID_LENGTH,
    rawBytes: cidBytes,
    rawValue: formatCid(cidBytes),
    valid: true,
    warnings: [],
  });

  // --- Ana dallanma: Root Vector (dosya başı) ---
  let shape: ShapeResult;
  if (rootVector === VECTOR_ROOT_E131_DATA) {
    shape = decodeDataPacketBody(data, rootFlagsAndLength.length, fields, warnings, errors);
  } else if (rootVector === VECTOR_ROOT_E131_EXTENDED) {
    shape = decodeExtendedRootVectorBody(data, fields, warnings);
  } else {
    shape = decodeUnrecognizedRootVectorBody(data, fields, rootVector);
  }

  const metadata: SacnFrameMetadata = {
    rootVector,
    summaryKey: shape.summaryKey,
    summaryParams: shape.summaryParams,
  };

  return finishFrame(data, fields, warnings, errors, options, metadata);
}

export function parseSacn(data: Uint8Array): ParseResult {
  return parseSacnFrame(data, {});
}

export const sacnParser: ProtocolParser = {
  protocolId: PROTOCOL_ID,
  displayName: PROTOCOL_DISPLAY_NAME,

  /** Ucuz ön eleme: asgari uzunluk + 12 baytlık "ASC-E1.17" ACN Packet Identifier'ı. */
  canParse(data: Uint8Array): boolean {
    if (data.length < ACN_PACKET_IDENTIFIER_OFFSET + ACN_PACKET_IDENTIFIER_LENGTH) return false;
    return matchesAcnPacketIdentifier(
      data.slice(ACN_PACKET_IDENTIFIER_OFFSET, ACN_PACKET_IDENTIFIER_OFFSET + ACN_PACKET_IDENTIFIER_LENGTH),
    );
  },

  parse(data: Uint8Array, context?: ParseContext): ParseResult {
    const options: SacnParseOptions = {};
    if (context?.timestamp !== undefined) options.timestamp = context.timestamp;
    if (context?.direction !== undefined) options.direction = context.direction;
    if (context?.channel !== undefined) options.channel = context.channel;
    if (context?.maxFrameLength !== undefined) options.maxFrameLength = context.maxFrameLength;
    if (context?.signal !== undefined) options.signal = context.signal;
    return parseSacnFrame(data, options);
  },
};

// ─────────────────────────── Örnek çerçeveler ───────────────────────────────

function concatBytes(...chunks: readonly Uint8Array[]): Uint8Array {
  const length = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const result = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

function uint16BE(value: number): Uint8Array {
  return Uint8Array.from([(value >>> 8) & 0xff, value & 0xff]);
}

function uint32BE(value: number): Uint8Array {
  return Uint8Array.from([(value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff]);
}

/** 4 bit flags (üst nibble) + 12 bit uzunluk — parse tarafının bitCursor okumasının tersi (dosya başı desen). */
function packFlagsAndLength(flagsNibble: number, length: number): Uint8Array {
  const value = ((flagsNibble & 0x0f) << 12) | (length & 0x0fff);
  return uint16BE(value);
}

/** "Lighting Console 1" — spec özetinin (`docs/spec/ozet/07-bina-otomasyonu.md:328`) kendi CID örneğiyle aynı Source Name. */
const EXAMPLE_SOURCE_NAME = 'Lighting Console 1';
/** Deterministik dolgu (dmx512/artnet örnek üretim emsali) — bayt 1..16, rastgele DEĞİL. */
const EXAMPLE_CID = Uint8Array.from([
  0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x0e, 0x0f, 0x10,
]);

function buildSourceNameBytes(name: string): Uint8Array {
  const bytes = new Uint8Array(SOURCE_NAME_LENGTH); // sıfır = null dolgu
  const encoded = new TextEncoder().encode(name);
  bytes.set(encoded.subarray(0, SOURCE_NAME_LENGTH));
  return bytes;
}

interface DataPacketParams {
  cid?: Uint8Array;
  sourceName?: string;
  priority?: number;
  syncAddress?: number;
  sequenceNumber?: number;
  optionsByte?: number;
  universe?: number;
  /** Start code + slotlar (Property Values) — ilk bayt start code. */
  propertyValues: Uint8Array;
  /** Yalnız test amaçlı: gerçek propertyValues uzunluğu yerine BEYAN EDİLEN sayı (tutarsızlık örneği için). */
  declaredPropertyValueCountOverride?: number;
}

/** Well-formed bir E1.31 Data Packet üretir — spec'in kendi alan sırasıyla, katman-length'ler HER ZAMAN tutarlı hesaplanır (aksi `declaredPropertyValueCountOverride` ile isteniyorsa). */
function buildDataPacket(params: DataPacketParams): Uint8Array {
  const cid = params.cid ?? EXAMPLE_CID;
  const sourceName = params.sourceName ?? EXAMPLE_SOURCE_NAME;
  const priority = params.priority ?? 100;
  const syncAddress = params.syncAddress ?? 0;
  const sequenceNumber = params.sequenceNumber ?? 0;
  const optionsByte = params.optionsByte ?? 0x00;
  const universe = params.universe ?? 1;
  const propertyValues = params.propertyValues;
  const declaredPropertyValueCount = params.declaredPropertyValueCountOverride ?? propertyValues.length;

  // Her katmanın length'i KENDİ Flags&Length ofsetinden (kendi 2 baytı DAHİL)
  // çerçeve sonuna kadar sayılır (§5.4/§7.1 "computed starting with octet
  // X" — dosya başı "KATMAN-LENGTH TUTARLILIĞI"). DMP: Flags&Length(2)+
  // Vector(1)+AddrType(1)+FirstPropAddr(2)+AddrIncrement(2)+PropValueCount(2)
  // = 10 sabit bayt + Property Values.
  const dmpLength = (DMP_HEADER_LENGTH - DMP_FLAGS_LENGTH_OFFSET) + declaredPropertyValueCount;
  const framingLength = dmpLength + (DMP_FLAGS_LENGTH_OFFSET - FRAMING_FLAGS_LENGTH_OFFSET);
  const rootLength = framingLength + (FRAMING_FLAGS_LENGTH_OFFSET - ROOT_FLAGS_LENGTH_OFFSET);

  const root = concatBytes(
    uint16BE(EXPECTED_PREAMBLE_SIZE),
    uint16BE(EXPECTED_POSTAMBLE_SIZE),
    ACN_PACKET_IDENTIFIER,
    packFlagsAndLength(EXPECTED_FLAGS_NIBBLE, rootLength),
    uint32BE(VECTOR_ROOT_E131_DATA),
    cid,
  );

  const framing = concatBytes(
    packFlagsAndLength(EXPECTED_FLAGS_NIBBLE, framingLength),
    uint32BE(VECTOR_E131_DATA_PACKET),
    buildSourceNameBytes(sourceName),
    Uint8Array.from([priority & 0xff]),
    uint16BE(syncAddress),
    Uint8Array.from([sequenceNumber & 0xff]),
    Uint8Array.from([optionsByte & 0xff]),
    uint16BE(universe),
  );

  const dmp = concatBytes(
    packFlagsAndLength(EXPECTED_FLAGS_NIBBLE, dmpLength),
    Uint8Array.from([VECTOR_DMP_SET_PROPERTY]),
    Uint8Array.from([EXPECTED_ADDRESS_TYPE_DATA_TYPE]),
    uint16BE(EXPECTED_FIRST_PROPERTY_ADDRESS),
    uint16BE(EXPECTED_ADDRESS_INCREMENT),
    uint16BE(declaredPropertyValueCount),
    propertyValues,
  );

  return concatBytes(root, framing, dmp);
}

/** dmx512.ts/artnet.ts'in ANSI E1.11 örneğiyle AYNI gösterim değerleri: Red 255, Green 128, Blue 0, Dimmer 200. Bayt 0 start code, kalan 4'ü slotlar. */
const HAPPY_PATH_PROPERTY_VALUES = Uint8Array.from([0x00, 0xff, 0x80, 0x00, 0xc8]);

/** 512 slotluk tam universe — start code + deterministik dolgu (slot K değeri K mod 256), dmx512.ts'in `buildFullUniverseSlots` deseni. */
function buildFullUniversePropertyValues(): Uint8Array {
  const values = new Array<number>(MAX_DMX_SLOTS + 1);
  values[0] = 0x00; // start code
  for (let slotNumber = 1; slotNumber <= MAX_DMX_SLOTS; slotNumber += 1) {
    values[slotNumber] = slotNumber % 256;
  }
  return Uint8Array.from(values);
}

function buildInvalidAcnPacketIdentifierExample(): Uint8Array {
  const packet = buildDataPacket({ propertyValues: HAPPY_PATH_PROPERTY_VALUES });
  const corrupted = Uint8Array.from(packet);
  corrupted[ACN_PACKET_IDENTIFIER_OFFSET] = 0x58; // 'X' — beklenen 'A' (0x41) değil
  return corrupted;
}

/** Options bit6 (Stream_Terminated) = 1. */
const OPTIONS_STREAM_TERMINATED_BIT = 0b0100_0000;

/** DMP Property Value Count'u GERÇEK slot verisinden 10 fazla beyan eder — dört katmandan biri tutarsız (dosya başı katman-length notu). */
function buildLayerLengthMismatchExample(): Uint8Array {
  return buildDataPacket({
    propertyValues: HAPPY_PATH_PROPERTY_VALUES,
    declaredPropertyValueCountOverride: HAPPY_PATH_PROPERTY_VALUES.length + 10,
  });
}

/**
 * Örnek çerçeveler. Checksum'suz protokol (dosya başı, DMX ailesinin ortak
 * özelliği — Karar 2) — motordan bağımsız doğrulama kanıtı gerekmez.
 * Kimlik/katman-length alanları hep spec-doğru üretilir (`buildDataPacket`
 * her zaman TUTARLI dört-katman uzunluğu hesaplar); CID ve Source Name
 * gösterim amaçlı deterministik/spec-özetli değerlerdir.
 */
const EXAMPLE_FRAMES: ExampleFrame[] = [
  {
    id: 'data-packet-happy-path',
    name: 'protocol.sacn.example.dataPacketHappyPath.name',
    bytes: buildDataPacket({ universe: 1, propertyValues: HAPPY_PATH_PROPERTY_VALUES }),
    description: 'protocol.sacn.example.dataPacketHappyPath.description',
    expectedValid: true,
  },
  {
    id: 'data-packet-full-512-universe',
    name: 'protocol.sacn.example.dataPacketFull512Universe.name',
    bytes: buildDataPacket({ universe: 4, propertyValues: buildFullUniversePropertyValues() }),
    description: 'protocol.sacn.example.dataPacketFull512Universe.description',
    expectedValid: true,
  },
  {
    id: 'priority-boundary-zero',
    name: 'protocol.sacn.example.priorityBoundaryZero.name',
    bytes: buildDataPacket({ priority: 0, propertyValues: HAPPY_PATH_PROPERTY_VALUES }),
    description: 'protocol.sacn.example.priorityBoundaryZero.description',
    expectedValid: true,
  },
  {
    id: 'priority-boundary-two-hundred',
    name: 'protocol.sacn.example.priorityBoundaryTwoHundred.name',
    bytes: buildDataPacket({ priority: 200, propertyValues: HAPPY_PATH_PROPERTY_VALUES }),
    description: 'protocol.sacn.example.priorityBoundaryTwoHundred.description',
    expectedValid: true,
  },
  {
    id: 'options-stream-terminated',
    name: 'protocol.sacn.example.optionsStreamTerminated.name',
    bytes: buildDataPacket({ optionsByte: OPTIONS_STREAM_TERMINATED_BIT, propertyValues: HAPPY_PATH_PROPERTY_VALUES }),
    description: 'protocol.sacn.example.optionsStreamTerminated.description',
    expectedValid: true,
  },
  {
    id: 'universe-out-of-range',
    name: 'protocol.sacn.example.universeOutOfRange.name',
    // 64214 = E131_DISCOVERY_UNIVERSE (Appendix A) — Discovery'ye ayrılmış, Data Packet'te rezerve (dosya başı).
    bytes: buildDataPacket({ universe: 64214, propertyValues: HAPPY_PATH_PROPERTY_VALUES }),
    description: 'protocol.sacn.example.universeOutOfRange.description',
    expectedValid: true,
  },
  {
    id: 'invalid-acn-packet-identifier',
    name: 'protocol.sacn.example.invalidAcnPacketIdentifier.name',
    bytes: buildInvalidAcnPacketIdentifierExample(),
    description: 'protocol.sacn.example.invalidAcnPacketIdentifier.description',
    expectedValid: false,
  },
  {
    id: 'layer-length-mismatch',
    name: 'protocol.sacn.example.layerLengthMismatch.name',
    bytes: buildLayerLengthMismatchExample(),
    description: 'protocol.sacn.example.layerLengthMismatch.description',
    expectedValid: true,
  },
  {
    id: 'root-vector-extended-not-decoded',
    name: 'protocol.sacn.example.rootVectorExtendedNotDecoded.name',
    // Root Vector = VECTOR_ROOT_E131_EXTENDED (Sync/Discovery paketi) — Framing/DMP bu turda çözülmez (dosya başı).
    bytes: concatBytes(
      uint16BE(EXPECTED_PREAMBLE_SIZE),
      uint16BE(EXPECTED_POSTAMBLE_SIZE),
      ACN_PACKET_IDENTIFIER,
      packFlagsAndLength(EXPECTED_FLAGS_NIBBLE, 26), // toplam 42 bayt (38 root + 4 gövde) - 16 = 26
      uint32BE(VECTOR_ROOT_E131_EXTENDED),
      EXAMPLE_CID,
      Uint8Array.from([0xde, 0xad, 0xbe, 0xef]), // gerçekte Sync/Discovery'nin kendi Framing Layer'ı — bu motor çözmez
    ),
    description: 'protocol.sacn.example.rootVectorExtendedNotDecoded.description',
    expectedValid: true,
  },
];

export const sacnPlugin: ProtocolPlugin = {
  id: PROTOCOL_ID,
  name: PROTOCOL_DISPLAY_NAME,
  category: 'building-automation',
  parser: sacnParser,
  documentation: {
    summary: 'protocol.sacn.documentation.summary',
    layer: 'application',
    references: [
      {
        title:
          'ANSI E1.31 — 2018, "Entertainment Technology — Lightweight streaming protocol for transport of DMX512 using ACN" — resmi ESTA TSP yayını, bu motorun birincil kaynağı (kamuya açık, doğrudan indirilebilir; bu oturumda indirilip pdftotext ile birebir okundu)',
        url: 'https://tsp.esta.org/tsp/documents/docs/E1-31-2018.pdf',
      },
      {
        title:
          'ANSI E1.31-2025 (güncel sürüm, 5 Ocak 2026, +IPv6) — ESTA TSP "Published Documents" sayfasında e-posta kayıt duvarı arkasında; bu oturumda indirilemedi. Root/Framing/DMP bayt düzeni 2018 sürümüyle aynı kabul edildi (dosya başı kaynak notu)',
        url: 'https://tsp.esta.org/tsp/documents/published_docs.php',
      },
    ],
  },
  exampleFrames: EXAMPLE_FRAMES,
};
