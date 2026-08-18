/**
 * Art-Net 4 (Artistic Licence Engineering) — DMX512 evrenlerini Ethernet/UDP
 * üzerinden taşıyan, royalty-free bir lighting protokolü. Ortak başlık (ID +
 * OpCode + çoğu pakette ProtVer) + OpCode'a göre dallanan gövde (brief-faz10-
 * dalga6.md, 6b). ArtDmx TAM çözülür; ArtPoll/ArtPollReply dar bir alan
 * kümesiyle; geri kalan OpCode'lar yalnız AD + ham gövde + uyarı.
 *
 * ── GİRDİ: TEK UDP PAYLOAD'I (coap.ts emsali) ───────────────────────────────
 * UDP datagramı mesaj sınırının KENDİSİDİR — TCP'nin aksine stream birleştirme
 * YOK (dalga 1 çizgisi). `data` bir Art-Net paketinin TAMAMIDIR.
 *
 * ── KAYNAK (Karar 2 — Art-Net ailesi KAMU, tek resmi kaynak yeter) ──────────
 * Resmi PDF bu oturumda doğrudan indirilip metne çevrildi (ESTA'nın DMX512
 * PDF'inin aksine bu PDF `pdftotext` ile TEMİZ text-extract verdi — OCR
 * gerekmedi): "Art-Net 4 Protocol Release V1.4, Document Revision 1.4dp
 * 23/10/2025", Artistic Licence Engineering, art-net.org.uk (spec'in kendi
 * ifadesiyle royalty-free). Aşağıdaki sayfa numaraları spec'in KENDİ üstbilgi
 * numaralandırmasıdır. Data[0]'ın DMX start code mu Kanal 1 mi olduğu sorusu
 * (aşağı bak) spec metninde TEK cümleyle verilmiyor — o TEK nokta için
 * Wireshark (`epan/dissectors/packet-artnet.c`, `packet-dmx.c`) ve OLA
 * (`plugins/artnet/ArtNetPackets.h`) kaynak KODU çapraz referans olarak
 * kullanıldı (yorum/görüş değil, çalışan dissector/struct düzeni).
 *
 * ── ORTAK BAŞLIK: ID + OpCode + (genelde) ProtVer ───────────────────────────
 * ID: 8 bayt, "Art-Net" (7 ASCII) + 0x00 son bayt (p.17 vb., HER paket
 * tanımında birebir: "the final character is a null termination"). Bu imza
 * olmadan paket Art-Net SAYILMAZ: uyuşmazsa `errors`e `start-delimiter-not-
 * found` düşülür ve çözümleme ORADA durur — sonraki baytların anlamı imza
 * doğrulanmadan varsayılamaz (OpCode bile okunmaz).
 *
 * OpCode: 2 bayt. Spec p.17 (ArtPoll) ve p.63 (ArtDmx) dahil HER paket
 * tanımında birebir aynı not: "Transmitted low byte first." → KÜÇÜK-UÇLU (LE).
 *
 * ProtVer: spec ASLA tek bir Int16 alan olarak VERMEZ — her paket tanımında
 * İKİ ayrı Int8 alan sırayla: "ProtVerHi" (üst bayt) sonra "ProtVerLo" (alt
 * bayt, "Current value 14"). Bu Hi-önce-Lo tablo sırası BÜYÜK-UÇLU (BE)
 * demektir — ProtVer'in OpCode'daki gibi bir "transmitted low byte first"
 * notu YOKTUR (yalnız TEK Int16 tipli alanlar — OpCode ve ArtPollReply'nin
 * Port'u — o notu taşır). Yani OpCode ve ProtVer AYNI paketin başlığında
 * BİRBİRİNDEN FARKLI endianlıkla iletilir: varsayılmadı, spec'in ~20 paket
 * tanımının HER BİRİNDE bu dosyanın yazıldığı oturumda birebir okunarak
 * doğrulandı (tek readUint16 yardımcısına bağlanılmadı, iki ayrı fonksiyon —
 * `readUint16LE`/`readUint16BE` — bilerek var).
 *
 * ── TUZAK: ArtPollReply'nin ProtVer'i YOK ───────────────────────────────────
 * Spec'in taranan tüm paket tanımlarında (ArtPoll, ArtDmx, ArtSync,
 * ArtAddress, ArtTimeCode, ArtIpProg, ArtTrigger, ArtNzs, ArtIpProgReply,
 * ArtDataRequest/Reply, ArtDiagData, ArtCommand, ArtInput, ArtFirmwareMaster/
 * Reply, ArtTodRequest/Data/Control, ArtRdm, ArtRdmSub — hepsi tek tek
 * doğrulandı) ProtVerHi/Lo alan 3-4'te vardır. TEK istisna ArtPollReply
 * (p.24-25): field 3 doğrudan "IP Address[4]"tür, ProtVer YOKTUR. Bu yüzden
 * ortak başlık uzunluğu SABİT DEĞİL: OpCode == OpPollReply (0x2100) ise 10
 * bayt (ID+OpCode), aksi halde 12 bayt (+ProtVer) — bu ikinci kural bu
 * motorun TANIMADIĞI OpCode'lar için de varsayılan alınır (dokümante edilmiş
 * bir varsayım, ~21/22 pakette doğrulandı). Bu ayrımı atlayıp "başlık hep 12
 * bayt" varsaymak ArtPollReply'nin IP adresinin ilk 2 baytını ProtVer sanıp
 * gerisini kaydırırdı — sessiz-yanlış çözüm.
 *
 * ── ArtDmx (OpCode 0x5000) ──────────────────────────────────────────────────
 * Sequence (1 bayt): "The Sequence field is set to 0x00 to disable this
 * feature" (p.63, birebir) — 0 PAKET KAYBI değil, sequence numaralamanın
 * KAPALI olduğu anlamına gelir (katalog `art-net` kaydının kendi yorumuyla
 * aynı ton, building-automation.ts — "sequence boşluğu ≠ paket kaybı").
 * Physical (1 bayt, ham — giriş portunu ayırt eder, isimlendirilecek bir enum
 * DEĞİL). SubUni (1 bayt) + Net (1 bayt): spec'in KENDİ bölmesi — "SubUni:
 * the low byte of the 15 bit Port-Address", "Net: the top 7 bits of the 15
 * bit Port-Address" (p.63) — TEK bir "Universe" alanında BİRLEŞTİRİLMEZ, spec
 * ikisini ayrı Int8 verir, bu motor da öyle gösterir. Length (LengthHi+Length,
 * 2 bayt BE, p.63) DMX data dizisinin bildirdiği uzunluktur; gerçek kalan bayt
 * sayısıyla TUTARSIZSA uyarı (doip/MBAP tonu) — Data alanı HER ZAMAN pakette
 * GERÇEKTEN mevcut baytları gösterir, beyan edilen Length'e körü körüne
 * güvenilmez.
 *
 * Data[Length]: burada 6a'nın (dmx512.ts) START CODE kavramı YOKTUR. OpDmx'in
 * kendi tanımı "contains zero start code DMX512 information" (Table 1, p.19)
 * — yani ArtDmx zaten YALNIZ start-code-0 (standart lighting) verisini taşır;
 * start code Data içinde AYRI bir bayt olarak TEKRAR gönderilmez. Wireshark'ın
 * ArtDmx dissector'ı Data'yı start-code-strip eden `dissect_dmx` yerine
 * DOĞRUDAN `dissect_dmx_chan`e verir ve ilk baytı "Channel 1" diye etiketler;
 * OLA'nın `artnet_dmx_s` struct'ında `start_code` alanı YOKTUR. Yani
 * **Data[0] = Kanal 1** — 6a'daki "bayt 0 = start code, slot 1 = bayt 1"
 * kayması burada UYGULANMAZ, "Slot 1" doğrudan `Data[0]`dır.
 *
 * ── DRY NOTU: slot-özet deseni YENİDEN uygulandı, PAYLAŞILMADI ─────────────
 * `dmx512.ts` (6a) TAMAM ve commit'lenmiş — "dokunma" şartı gereği ondan İMPORT
 * edilmedi ve ortak bir modüle de TAŞINMADI (brief bu ikisini seçenek olarak
 * sunuyor: "import edip yeniden kullan ya da aynı yaklaşımı tekrar uygula").
 * Önizleme+özet-alan İLKESİ (ilk `SLOT_PREVIEW_COUNT` slot ayrı alan, kalanı
 * tek özet blok) buradaki `pushArtDmxDataFields` içinde AYNI ilkeyle, farklı
 * ofset hesabıyla (yukarıdaki not — start code kayması yok) yeniden yazıldı.
 *
 * ── ArtPoll (0x2000) / ArtPollReply (0x2100): dar ad kümesi ─────────────────
 * Brief'in andığı "TalkToMe"/"Priority" isimleri EKOSİSTEM/eski adlardır (OLA
 * struct alanları hâlâ `talk_to_me`/`priority` diyor) — GÜNCEL spec (V1.4,
 * p.17) bu alanları "Flags" ve "DiagPriority" diye adlandırıyor, bu motor
 * SPEC'İN GÜNCEL adını kullanır. DiagPriority'nin kendi dar ad kümesi var
 * (Table 5, p.53: DpLow/DpMed/DpHigh/DpCritical/DpVolatile) — tanınmayan
 * değer ham + uyarı. Flags'in kendi bitleri (Targeted Mode, VLC, diagnostics
 * broadcast/unicast…) AYRIŞTIRILMAZ — bit-düzeyi analiz brief kapsamı dışıdır
 * ("Analyzer işleri parser'a KONMAZ"), tek ham bayt alanı olarak kalır.
 * ArtPoll'un geri kalan alanları (TargetPortAddress*, EstaMan, Oem…) TEK ham
 * blokta toplanır.
 *
 * ArtPollReply de "ShortName" DEĞİL "PortName" adını taşır — spec'in 109
 * sayfası tarandığında "ShortName" ifadesi HİÇ geçmiyor (yalnız OLA'nın eski
 * struct alan adı olarak yaşıyor, `short_name[]`). Bu motor IP Address, Port
 * ve PortName'i adlandırır; aradaki (VersInfo/NetSwitch/SubSwitch/Oem/Ubea/
 * Status1/EstaMan, 10 bayt) ve PortName sonrası (LongName/NodeReport/
 * NumPorts/… — node başına değişken uzunluk) alanlar HAM bloktur — brief'in
 * istediği "kısmi alan + ham kalan" deseni budur.
 *
 * ── DİĞER OpCode'lar: dar ad kümesi + ham gövde + uyarı ─────────────────────
 * ArtNzs/ArtSync/ArtAddress/ArtTimeCode/ArtIpProg/ArtTrigger Table 1'den
 * (p.19-21) teyitli isim taşır ama gövdeleri bu turda ÇÖZÜLMEZ — "OpCode adı
 * biliniyor, gövde yapısı çözülmedi" uyarısıyla ham. Bu listenin DIŞINDAKİ her
 * OpCode (Table 1'de olsun ya da olmasın) "tanınmayan OpCode" uyarısına
 * düşer — ikisi FARKLI uyarı kodudur, karıştırılmaz.
 *
 * ── KAPSAM DIŞI (bilinçli) ───────────────────────────────────────────────────
 * Node discovery/keep-alive akışı, ArtPollReply'nin ~30+ alanının TAMAMI,
 * BBMD-benzeri yönlendirme, sequence/universe view analizi — "Analyzer işleri
 * parser'a KONMAZ" ilkesi (brief). Bu motor tek paketlik alan çözümüdür.
 */

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

const PROTOCOL_ID = 'art-net';
/** Protokol adı veridir, çeviriye girmez (CLAUDE.md). */
const PROTOCOL_DISPLAY_NAME = 'Art-Net';

const HEX_RADIX = 16;

// --- Ortak başlık ofset/uzunlukları (dosya başı) ---
const ID_OFFSET = 0;
const ID_LENGTH = 8;
const OPCODE_OFFSET = ID_LENGTH;
const OPCODE_LENGTH = 2;
/** ArtPollReply'nin (ProtVer'i YOK) gövdesinin başladığı ofset — dosya başı "TUZAK" notu. */
const HEADER_LENGTH_NO_PROT_VER = OPCODE_OFFSET + OPCODE_LENGTH; // 10
const PROT_VER_OFFSET = HEADER_LENGTH_NO_PROT_VER;
const PROT_VER_LENGTH = 2;
/** ArtPollReply DIŞINDAKİ her paketin gövdesinin başladığı ofset. */
const HEADER_LENGTH_WITH_PROT_VER = HEADER_LENGTH_NO_PROT_VER + PROT_VER_LENGTH; // 12

// --- OpCode değerleri (Table 1, p.19-21 — birebir teyitli) ---
const OP_POLL = 0x2000;
const OP_POLL_REPLY = 0x2100;
const OP_DMX = 0x5000;
const OP_NZS = 0x5100;
const OP_SYNC = 0x5200;
const OP_ADDRESS = 0x6000;
const OP_TIME_CODE = 0x9700;
const OP_TRIGGER = 0x9900;
const OP_IP_PROG = 0xf800;

/**
 * OpCode alanının ADLANDIRILMIŞ değerleri — ArtDmx/ArtPoll/ArtPollReply TAM
 * çözülür, geri kalanı "dar ad kümesi + ham gövde" (dosya başı). Bu listenin
 * dışındaki her değer (Table 1'de bulunsun ya da bulunmasın) "tanınmayan
 * OpCode" yoluna düşer — dar kümeyi bilerek küçük tutar (brief: "birkaç
 * yaygın OpCode adı").
 */
const OPCODE_DISPLAY_NAMES: ReadonlyMap<number, string> = new Map([
  [OP_POLL, 'ArtPoll'],
  [OP_POLL_REPLY, 'ArtPollReply'],
  [OP_DMX, 'ArtDmx'],
  [OP_NZS, 'ArtNzs'],
  [OP_SYNC, 'ArtSync'],
  [OP_ADDRESS, 'ArtAddress'],
  [OP_TIME_CODE, 'ArtTimeCode'],
  [OP_IP_PROG, 'ArtIpProg'],
  [OP_TRIGGER, 'ArtTrigger'],
]);

/** Table 5 – Priority Codes (p.53) — ArtPoll->DiagPriority'nin dar ad kümesi. */
const DIAG_PRIORITY_NAMES: ReadonlyMap<number, string> = new Map([
  [0x10, 'DpLow'],
  [0x40, 'DpMed'],
  [0x80, 'DpHigh'],
  [0xe0, 'DpCritical'],
  [0xf0, 'DpVolatile'],
]);

/** İlk bu kadar DMX kanalı ayrı `ParsedField` olur; kalanı tek özet alana toplanır (dosya başı DRY notu). */
const SLOT_PREVIEW_COUNT = 16;

/** ArtPollReply: Port'tan sonraki VersInfoH..EstaManHi bloğu (field 5-14, p.24-25) — ham. */
const ARTPOLLREPLY_NODE_INFO_GAP_LENGTH = 10;
/** ArtPollReply: PortName[18] (field 15, p.25) — null-terminated, max 17 karakter + null. */
const ARTPOLLREPLY_PORT_NAME_LENGTH = 18;

const ERROR_HEADER_TOO_SHORT = 'protocol.artnet.error.headerTooShort';
const ERROR_FRAME_TOO_LONG = 'protocol.artnet.error.frameTooLong';
const ERROR_ABORTED = 'protocol.artnet.error.aborted';
const ERROR_INVALID_SIGNATURE = 'protocol.artnet.error.invalidSignature';
const ERROR_HEADER_TRUNCATED = 'protocol.artnet.error.headerTruncated';
const ERROR_BODY_TRUNCATED = 'protocol.artnet.error.bodyTruncated';

const WARN_UNRECOGNIZED_OPCODE = 'protocol.artnet.warning.unrecognizedOpcode';
const WARN_OPCODE_BODY_NOT_DECODED = 'protocol.artnet.warning.opcodeBodyNotDecoded';
const WARN_UNKNOWN_DIAG_PRIORITY = 'protocol.artnet.warning.unknownDiagPriority';
const WARN_LENGTH_MISMATCH = 'protocol.artnet.warning.lengthMismatch';

const SUMMARY_ARTDMX = 'protocol.artnet.summary.artDmx';
const SUMMARY_ARTPOLL = 'protocol.artnet.summary.artPoll';
const SUMMARY_ARTPOLLREPLY = 'protocol.artnet.summary.artPollReply';
const SUMMARY_NAMED_OPCODE_RAW = 'protocol.artnet.summary.namedOpcodeRawBody';
const SUMMARY_UNKNOWN_OPCODE = 'protocol.artnet.summary.unknownOpcode';
const SUMMARY_INVALID_SIGNATURE = 'protocol.artnet.summary.invalidSignature';
const SUMMARY_HEADER_TRUNCATED = 'protocol.artnet.summary.headerTruncated';

export type ArtNetFrameMetadata = {
  /** İmza doğrulanamadıysa OpCode hiç okunmaz — bu yüzden opsiyonel. */
  opCode?: number;
  opCodeName?: string;
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

/** OpCode ve ArtPollReply->Port — spec: "Transmitted low byte first" (dosya başı). */
function readUint16LE(data: Uint8Array, offset: number): number {
  return byteAt(data, offset) | (byteAt(data, offset + 1) << 8);
}

/** ProtVerHi/Lo, LengthHi/Lo gibi Hi-önce-Lo çiftleri — tablo sırası BE anlamına gelir (dosya başı). */
function readUint16BE(data: Uint8Array, offset: number): number {
  return (byteAt(data, offset) << 8) | byteAt(data, offset + 1);
}

function formatHexByte(value: number): string {
  return `0x${value.toString(HEX_RADIX).toUpperCase().padStart(2, '0')}`;
}

function formatHexUint16(value: number): string {
  return `0x${value.toString(HEX_RADIX).toUpperCase().padStart(4, '0')}`;
}

function formatIPv4(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => String(byte)).join('.');
}

function decodeAsciiString(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => String.fromCharCode(byte)).join('');
}

/** "Null terminated" alanlar (ID, PortName) — ilk 0x00'da kırpar, dolgu baytlarını göstermez. */
function decodeNullTerminatedAscii(bytes: Uint8Array): string {
  const text = decodeAsciiString(bytes);
  const nullIndex = text.indexOf('\u0000');
  return nullIndex === -1 ? text : text.slice(0, nullIndex);
}

const ART_NET_SIGNATURE = Uint8Array.from([0x41, 0x72, 0x74, 0x2d, 0x4e, 0x65, 0x74, 0x00]); // "Art-Net" + 0x00 (p.17 vb.)

function matchesArtNetSignature(bytes: Uint8Array): boolean {
  if (bytes.length !== ID_LENGTH) return false;
  for (let index = 0; index < ID_LENGTH; index += 1) {
    if (byteAt(bytes, index) !== byteAt(ART_NET_SIGNATURE, index)) return false;
  }
  return true;
}

/** doip.ts `requireBytes` deseni — yetersiz bayt bulunca TEK ortak hata mesajıyla `errors`e düşer. */
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

/** doip.ts `enumField` deseni — dar ad kümesinde bulunmazsa alanı geçersiz işaretler + uyarı basar. */
function enumField(
  id: string,
  name: string,
  offset: number,
  length: number,
  rawBytes: Uint8Array,
  rawValue: number,
  table: ReadonlyMap<number, string>,
  warnKey: string,
  warnings: ProtocolWarning[],
): ParsedField {
  const label = table.get(rawValue);
  const field: ParsedField = { id, name, offset, length, rawBytes, rawValue, valid: label !== undefined, warnings: [] };
  if (label !== undefined) {
    field.physicalValue = label;
  } else {
    field.warnings.push(warnKey);
    warnings.push(toProtocolWarning(warnKey));
  }
  return field;
}

/**
 * ArtDmx Data[Length] dizisini 6a'nın (dmx512.ts, DOKUNULMADI) önizleme+özet
 * alan İLKESİYLE gösterir — DRY notu için dosya başına bak. dmx512'den TEK
 * fark: burada ayrı bir start code baytı YOK, Data[0] doğrudan Slot/Kanal 1.
 */
function pushArtDmxDataFields(
  data: Uint8Array,
  dataOffset: number,
  dataLength: number,
  fields: ParsedField[],
): void {
  const previewCount = Math.min(dataLength, SLOT_PREVIEW_COUNT);
  for (let index = 0; index < previewCount; index += 1) {
    const slotNumber = index + 1;
    const slotOffset = dataOffset + index;
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

  if (dataLength > previewCount) {
    const remainderOffset = dataOffset + previewCount;
    const remainderLength = dataLength - previewCount;
    fields.push({
      id: 'slot-data',
      name: `Slots ${String(previewCount + 1)}-${String(dataLength)}`,
      offset: remainderOffset,
      length: remainderLength,
      rawBytes: data.slice(remainderOffset, remainderOffset + remainderLength),
      unit: 'B',
      valid: true,
      warnings: [],
    });
  }
}

function decodeArtDmxBody(
  data: Uint8Array,
  bodyOffset: number,
  fields: ParsedField[],
  warnings: ProtocolWarning[],
  errors: ProtocolError[],
): ShapeResult {
  const summaryParams: Record<string, string> = {};

  // Sequence + Physical + SubUni + Net — dördü de sabit 1'er bayt, tek guard yeter.
  if (!requireBytes(data, bodyOffset, 4, errors)) {
    return { summaryKey: SUMMARY_ARTDMX, summaryParams };
  }

  const sequence = byteAt(data, bodyOffset);
  const sequenceField: ParsedField = {
    id: 'sequence',
    name: 'Sequence',
    offset: bodyOffset,
    length: 1,
    rawBytes: data.slice(bodyOffset, bodyOffset + 1),
    rawValue: sequence,
    valid: true,
    warnings: [],
  };
  if (sequence === 0) {
    // Spec (p.63, birebir): "set to 0x00 to disable this feature" — PAKET
    // KAYBI değil, sequence numaralamanın kapalı olduğu anlamına gelir.
    sequenceField.physicalValue = 'Disabled';
  }
  fields.push(sequenceField);
  summaryParams['sequence'] = sequence === 0 ? '—' : String(sequence);

  fields.push({
    id: 'physical',
    name: 'Physical',
    offset: bodyOffset + 1,
    length: 1,
    rawBytes: data.slice(bodyOffset + 1, bodyOffset + 2),
    rawValue: byteAt(data, bodyOffset + 1),
    valid: true,
    warnings: [],
  });

  const subUni = byteAt(data, bodyOffset + 2);
  fields.push({
    id: 'sub-uni',
    name: 'SubUni',
    offset: bodyOffset + 2,
    length: 1,
    rawBytes: data.slice(bodyOffset + 2, bodyOffset + 3),
    rawValue: subUni,
    valid: true,
    warnings: [],
  });
  summaryParams['subUni'] = String(subUni);

  const net = byteAt(data, bodyOffset + 3);
  fields.push({
    id: 'net',
    name: 'Net',
    offset: bodyOffset + 3,
    length: 1,
    rawBytes: data.slice(bodyOffset + 3, bodyOffset + 4),
    rawValue: net,
    valid: true,
    warnings: [],
  });
  summaryParams['net'] = String(net);

  const lengthOffset = bodyOffset + 4;
  if (!requireBytes(data, lengthOffset, 2, errors)) {
    return { summaryKey: SUMMARY_ARTDMX, summaryParams };
  }
  const declaredLength = readUint16BE(data, lengthOffset);
  fields.push({
    id: 'length',
    name: 'Length',
    offset: lengthOffset,
    length: 2,
    rawBytes: data.slice(lengthOffset, lengthOffset + 2),
    rawValue: declaredLength,
    unit: 'B',
    valid: true,
    warnings: [],
  });

  const dataOffset = lengthOffset + 2;
  const actualDataLength = data.length - dataOffset;
  if (declaredLength !== actualDataLength) {
    // MBAP/doip tonu: beyan edilen Length gerçek kalan baytla eşleşmiyor — hata değil uyarı,
    // Data alanı gerçekte mevcut baytları gösterir (dosya başı).
    warnings.push(toProtocolWarning(WARN_LENGTH_MISMATCH));
  }
  pushArtDmxDataFields(data, dataOffset, actualDataLength, fields);
  summaryParams['length'] = String(actualDataLength);

  return { summaryKey: SUMMARY_ARTDMX, summaryParams };
}

function decodeArtPollBody(
  data: Uint8Array,
  bodyOffset: number,
  fields: ParsedField[],
  warnings: ProtocolWarning[],
  errors: ProtocolError[],
): ShapeResult {
  if (!requireBytes(data, bodyOffset, 2, errors)) {
    return { summaryKey: SUMMARY_ARTPOLL, summaryParams: {} };
  }

  const flags = byteAt(data, bodyOffset);
  fields.push({
    id: 'flags',
    name: 'Flags',
    offset: bodyOffset,
    length: 1,
    rawBytes: data.slice(bodyOffset, bodyOffset + 1),
    rawValue: flags,
    valid: true,
    warnings: [],
  });

  const diagPriority = byteAt(data, bodyOffset + 1);
  fields.push(
    enumField(
      'diag-priority',
      'DiagPriority',
      bodyOffset + 1,
      1,
      data.slice(bodyOffset + 1, bodyOffset + 2),
      diagPriority,
      DIAG_PRIORITY_NAMES,
      WARN_UNKNOWN_DIAG_PRIORITY,
      warnings,
    ),
  );

  // ArtPoll'un geri kalanı (TargetPortAddress*, EstaMan, Oem…) — "kısa bir alt küme yeterli" (brief).
  const remainderOffset = bodyOffset + 2;
  if (data.length > remainderOffset) {
    fields.push({
      id: 'remaining-fields',
      name: 'Remaining ArtPoll Fields (raw)',
      offset: remainderOffset,
      length: data.length - remainderOffset,
      rawBytes: data.slice(remainderOffset),
      unit: 'B',
      valid: true,
      warnings: [],
    });
  }

  const diagPriorityName = DIAG_PRIORITY_NAMES.get(diagPriority);
  return {
    summaryKey: SUMMARY_ARTPOLL,
    summaryParams: { flags: formatHexByte(flags), diagPriority: diagPriorityName ?? formatHexByte(diagPriority) },
  };
}

function decodeArtPollReplyBody(
  data: Uint8Array,
  bodyOffset: number,
  fields: ParsedField[],
  errors: ProtocolError[],
): ShapeResult {
  const summaryParams: Record<string, string> = {};

  if (!requireBytes(data, bodyOffset, 4, errors)) {
    return { summaryKey: SUMMARY_ARTPOLLREPLY, summaryParams };
  }
  const ipBytes = data.slice(bodyOffset, bodyOffset + 4);
  const ipText = formatIPv4(ipBytes);
  fields.push({
    id: 'ip-address',
    name: 'IP Address',
    offset: bodyOffset,
    length: 4,
    rawBytes: ipBytes,
    rawValue: ipText,
    valid: true,
    warnings: [],
  });
  summaryParams['ip'] = ipText;

  const portOffset = bodyOffset + 4;
  if (!requireBytes(data, portOffset, 2, errors)) {
    return { summaryKey: SUMMARY_ARTPOLLREPLY, summaryParams };
  }
  // Port Int16, "transmitted low byte first" — OpCode'la AYNI kural (dosya başı), Hi/Lo çifti DEĞİL.
  const port = readUint16LE(data, portOffset);
  fields.push({
    id: 'port',
    name: 'Port',
    offset: portOffset,
    length: 2,
    rawBytes: data.slice(portOffset, portOffset + 2),
    rawValue: port,
    valid: true,
    warnings: [],
  });
  summaryParams['port'] = String(port);

  const nodeInfoOffset = portOffset + 2;
  if (!requireBytes(data, nodeInfoOffset, ARTPOLLREPLY_NODE_INFO_GAP_LENGTH, errors)) {
    return { summaryKey: SUMMARY_ARTPOLLREPLY, summaryParams };
  }
  fields.push({
    id: 'node-info-fields',
    name: 'Node Info Fields (VersInfo/NetSwitch/SubSwitch/Oem/Ubea/Status1/EstaMan, raw)',
    offset: nodeInfoOffset,
    length: ARTPOLLREPLY_NODE_INFO_GAP_LENGTH,
    rawBytes: data.slice(nodeInfoOffset, nodeInfoOffset + ARTPOLLREPLY_NODE_INFO_GAP_LENGTH),
    unit: 'B',
    valid: true,
    warnings: [],
  });

  const portNameOffset = nodeInfoOffset + ARTPOLLREPLY_NODE_INFO_GAP_LENGTH;
  if (!requireBytes(data, portNameOffset, ARTPOLLREPLY_PORT_NAME_LENGTH, errors)) {
    return { summaryKey: SUMMARY_ARTPOLLREPLY, summaryParams };
  }
  const portNameBytes = data.slice(portNameOffset, portNameOffset + ARTPOLLREPLY_PORT_NAME_LENGTH);
  fields.push({
    id: 'port-name',
    // Spec V1.4 "PortName" diyor; eski "ShortName" adı yalnız ekosistemde yaşıyor (dosya başı).
    name: 'PortName (a.k.a. ShortName)',
    offset: portNameOffset,
    length: ARTPOLLREPLY_PORT_NAME_LENGTH,
    rawBytes: portNameBytes,
    rawValue: decodeNullTerminatedAscii(portNameBytes),
    valid: true,
    warnings: [],
  });

  const remainderOffset = portNameOffset + ARTPOLLREPLY_PORT_NAME_LENGTH;
  if (data.length > remainderOffset) {
    fields.push({
      id: 'remaining-fields',
      name: 'Remaining ArtPollReply Fields (raw)',
      offset: remainderOffset,
      length: data.length - remainderOffset,
      rawBytes: data.slice(remainderOffset),
      unit: 'B',
      valid: true,
      warnings: [],
    });
  }

  return { summaryKey: SUMMARY_ARTPOLLREPLY, summaryParams };
}

/** OpCode adı biliniyor (Table 1) ama gövde yapısı bu turda çözülmedi — dosya başı "Diğer OpCode'lar". */
function decodeNamedRawBody(
  data: Uint8Array,
  bodyOffset: number,
  opcodeName: string,
  fields: ParsedField[],
  warnings: ProtocolWarning[],
): ShapeResult {
  if (data.length > bodyOffset) {
    fields.push({
      id: 'body',
      name: 'Body (raw)',
      offset: bodyOffset,
      length: data.length - bodyOffset,
      rawBytes: data.slice(bodyOffset),
      unit: 'B',
      valid: true,
      warnings: [WARN_OPCODE_BODY_NOT_DECODED],
    });
  }
  warnings.push(toProtocolWarning(WARN_OPCODE_BODY_NOT_DECODED));
  return { summaryKey: SUMMARY_NAMED_OPCODE_RAW, summaryParams: { opcodeName } };
}

/** OpCode Table 1'de DEĞİL (ya da bu motorun dar kümesinde değil) — ham + "tanınmayan" uyarısı. */
function decodeUnknownOpcodeBody(
  data: Uint8Array,
  bodyOffset: number,
  opCode: number,
  fields: ParsedField[],
): ShapeResult {
  if (data.length > bodyOffset) {
    fields.push({
      id: 'body',
      name: 'Body (raw)',
      offset: bodyOffset,
      length: data.length - bodyOffset,
      rawBytes: data.slice(bodyOffset),
      unit: 'B',
      valid: false,
      warnings: [WARN_UNRECOGNIZED_OPCODE],
    });
  }
  return { summaryKey: SUMMARY_UNKNOWN_OPCODE, summaryParams: { opCode: formatHexUint16(opCode) } };
}

function decodeBody(
  opCode: number,
  data: Uint8Array,
  bodyOffset: number,
  fields: ParsedField[],
  warnings: ProtocolWarning[],
  errors: ProtocolError[],
): ShapeResult {
  if (opCode === OP_DMX) return decodeArtDmxBody(data, bodyOffset, fields, warnings, errors);
  if (opCode === OP_POLL) return decodeArtPollBody(data, bodyOffset, fields, warnings, errors);
  if (opCode === OP_POLL_REPLY) return decodeArtPollReplyBody(data, bodyOffset, fields, errors);

  const knownName = OPCODE_DISPLAY_NAMES.get(opCode);
  if (knownName !== undefined) {
    return decodeNamedRawBody(data, bodyOffset, knownName, fields, warnings);
  }
  return decodeUnknownOpcodeBody(data, bodyOffset, opCode, fields);
}

interface ArtNetParseOptions {
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
  options: ArtNetParseOptions,
  metadata: ArtNetFrameMetadata,
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

function parseArtNetFrame(data: Uint8Array, options: ArtNetParseOptions): ParseResult {
  if (options.signal?.aborted === true) {
    return {
      success: false,
      error: { code: 'parser-timeout', message: ERROR_ABORTED },
      consumedBytes: 0,
      recoverable: false,
    };
  }

  if (data.length < HEADER_LENGTH_NO_PROT_VER) {
    return {
      success: false,
      error: { code: 'truncated-frame', message: ERROR_HEADER_TOO_SHORT, offset: 0, length: data.length },
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

  // --- ID imzası (8 bayt, null dahil — dosya başı) ---
  const idBytes = data.slice(ID_OFFSET, ID_OFFSET + ID_LENGTH);
  const idValid = matchesArtNetSignature(idBytes);
  fields.push({
    id: 'id',
    name: 'ID',
    offset: ID_OFFSET,
    length: ID_LENGTH,
    rawBytes: idBytes,
    rawValue: decodeNullTerminatedAscii(idBytes),
    valid: idValid,
    warnings: idValid ? [] : [ERROR_INVALID_SIGNATURE],
  });

  if (!idValid) {
    // Bu imza olmadan paket Art-Net SAYILMAZ (dosya başı) — sonraki baytlar
    // OpCode/ProtVer sanılıp yorumlanmaz, çözümleme burada durur.
    errors.push({
      code: 'start-delimiter-not-found',
      message: ERROR_INVALID_SIGNATURE,
      offset: ID_OFFSET,
      length: ID_LENGTH,
    });
    const metadata: ArtNetFrameMetadata = { summaryKey: SUMMARY_INVALID_SIGNATURE, summaryParams: {} };
    return finishFrame(data, fields, warnings, errors, options, metadata);
  }

  // --- OpCode (2 bayt, LE — "transmitted low byte first", dosya başı) ---
  const opCode = readUint16LE(data, OPCODE_OFFSET);
  fields.push(
    enumField(
      'op-code',
      'OpCode',
      OPCODE_OFFSET,
      OPCODE_LENGTH,
      data.slice(OPCODE_OFFSET, OPCODE_OFFSET + OPCODE_LENGTH),
      opCode,
      OPCODE_DISPLAY_NAMES,
      WARN_UNRECOGNIZED_OPCODE,
      warnings,
    ),
  );
  const opCodeName = OPCODE_DISPLAY_NAMES.get(opCode);

  // --- ProtVer (yalnız ArtPollReply DIŞINDA var — dosya başı "TUZAK" notu) ---
  let bodyOffset = HEADER_LENGTH_NO_PROT_VER;
  if (opCode !== OP_POLL_REPLY) {
    if (data.length - PROT_VER_OFFSET < PROT_VER_LENGTH) {
      errors.push({
        code: 'truncated-frame',
        message: ERROR_HEADER_TRUNCATED,
        offset: PROT_VER_OFFSET,
        length: Math.max(0, data.length - PROT_VER_OFFSET),
      });
      const metadata: ArtNetFrameMetadata = { opCode, opCodeName, summaryKey: SUMMARY_HEADER_TRUNCATED, summaryParams: {} };
      return finishFrame(data, fields, warnings, errors, options, metadata);
    }
    // ProtVerHi sonra ProtVerLo — Hi-önce-Lo tablo sırası BE demektir (dosya başı).
    const protVer = readUint16BE(data, PROT_VER_OFFSET);
    fields.push({
      id: 'prot-ver',
      name: 'ProtVer',
      offset: PROT_VER_OFFSET,
      length: PROT_VER_LENGTH,
      rawBytes: data.slice(PROT_VER_OFFSET, PROT_VER_OFFSET + PROT_VER_LENGTH),
      rawValue: protVer,
      valid: true,
      warnings: [],
    });
    bodyOffset = HEADER_LENGTH_WITH_PROT_VER;
  }

  const shape = decodeBody(opCode, data, bodyOffset, fields, warnings, errors);

  const metadata: ArtNetFrameMetadata = {
    opCode,
    opCodeName,
    summaryKey: shape.summaryKey,
    summaryParams: shape.summaryParams,
  };

  return finishFrame(data, fields, warnings, errors, options, metadata);
}

export function parseArtNet(data: Uint8Array): ParseResult {
  return parseArtNetFrame(data, {});
}

export const artNetParser: ProtocolParser = {
  protocolId: PROTOCOL_ID,
  displayName: PROTOCOL_DISPLAY_NAME,

  /** Ucuz ön eleme: asgari uzunluk + 8 baytlık "Art-Net" imzası. */
  canParse(data: Uint8Array): boolean {
    if (data.length < HEADER_LENGTH_NO_PROT_VER) return false;
    return matchesArtNetSignature(data.slice(ID_OFFSET, ID_OFFSET + ID_LENGTH));
  },

  parse(data: Uint8Array, context?: ParseContext): ParseResult {
    const options: ArtNetParseOptions = {};
    if (context?.timestamp !== undefined) options.timestamp = context.timestamp;
    if (context?.direction !== undefined) options.direction = context.direction;
    if (context?.channel !== undefined) options.channel = context.channel;
    if (context?.maxFrameLength !== undefined) options.maxFrameLength = context.maxFrameLength;
    if (context?.signal !== undefined) options.signal = context.signal;
    return parseArtNetFrame(data, options);
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

/** Spec: "Current value 14" (p.63 vb.) — örneklerin tamamı bu güncel sürümü kullanır. */
const EXAMPLE_PROT_VER_LO = 14;

/** ID(8)+OpCode(2,LE)+[ProtVerHi(0x00)+ProtVerLo(14)] — dosya başı endianlık kararlarının AYNISI. */
function buildCommonHeader(opCode: number, includeProtVer: boolean): Uint8Array {
  const opCodeBytes = Uint8Array.from([opCode & 0xff, (opCode >>> 8) & 0xff]);
  if (!includeProtVer) {
    return concatBytes(ART_NET_SIGNATURE, opCodeBytes);
  }
  const protVerBytes = Uint8Array.from([0x00, EXAMPLE_PROT_VER_LO]);
  return concatBytes(ART_NET_SIGNATURE, opCodeBytes, protVerBytes);
}

/** 6a'nın (dmx512.ts) ANSI E1.11 örneğiyle AYNI gösterim değerleri: Red 255, Green 128, Blue 0, Dimmer 200. */
const ARTDMX_HAPPY_DATA = Uint8Array.from([0xff, 0x80, 0x00, 0xc8]);

function buildArtDmxExample(sequence: number, subUni: number, net: number, channelData: Uint8Array): Uint8Array {
  const header = buildCommonHeader(OP_DMX, true);
  const lengthBytes = Uint8Array.from([(channelData.length >>> 8) & 0xff, channelData.length & 0xff]);
  return concatBytes(header, Uint8Array.from([sequence, 0x00, subUni, net]), lengthBytes, channelData);
}

const MAX_STANDARD_CHANNELS = 512;

/** 512 kanallık deterministik dolgu (kanal K değeri K mod 256) — dmx512.ts'nin `buildFullUniverseSlots` deseni, yeniden uygulandı. */
function buildFullUniverseChannels(): Uint8Array {
  const channels = new Array<number>(MAX_STANDARD_CHANNELS);
  for (let channelNumber = 1; channelNumber <= MAX_STANDARD_CHANNELS; channelNumber += 1) {
    channels[channelNumber - 1] = channelNumber % 256;
  }
  return Uint8Array.from(channels);
}

function buildArtPollExample(flags: number, diagPriority: number): Uint8Array {
  return concatBytes(buildCommonHeader(OP_POLL, true), Uint8Array.from([flags, diagPriority]));
}

function buildArtPollReplyExample(): Uint8Array {
  const header = buildCommonHeader(OP_POLL_REPLY, false); // ProtVer YOK (dosya başı "TUZAK" notu)
  const ip = Uint8Array.from([192, 168, 1, 50]);
  const port = Uint8Array.from([0x36, 0x19]); // 0x1936, LE
  const nodeInfoGap = new Uint8Array(ARTPOLLREPLY_NODE_INFO_GAP_LENGTH); // VersInfo/NetSwitch/…  — gösterim amaçlı sıfır
  const portNameText = 'Art-Net Node 1';
  const portNameBytes = new Uint8Array(ARTPOLLREPLY_PORT_NAME_LENGTH);
  portNameBytes.set(Uint8Array.from(portNameText, (char) => char.charCodeAt(0)));
  // Kalan bayt zaten 0x00 (null dolgu) — spec: "fixed length field, although the string it contains can be shorter."
  const trailing = Uint8Array.from([0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08]); // LongName/NodeReport/… kısaltılmış gösterim
  return concatBytes(header, ip, port, nodeInfoGap, portNameBytes, trailing);
}

function buildArtTimeCodeExample(): Uint8Array {
  const header = buildCommonHeader(OP_TIME_CODE, true);
  // Gövde alanları bu motorda çözülmüyor (dosya başı) — baytlar yalnız "ham blok var" davranışını gösterir.
  const body = Uint8Array.from([0x00, 0x0a, 0x0f, 0x02, 0x01, 0x00]);
  return concatBytes(header, body);
}

function buildUnknownOpcodeExample(): Uint8Array {
  const header = buildCommonHeader(0x1234, true); // Table 1'de YOK — kasıtlı tanınmayan değer
  return concatBytes(header, Uint8Array.from([0xde, 0xad, 0xbe, 0xef]));
}

function buildInvalidSignatureExample(): Uint8Array {
  const corrupted = Uint8Array.from(ART_NET_SIGNATURE);
  corrupted[0] = 0x58; // 'X' — beklenen 'A' (0x41) değil
  return concatBytes(corrupted, Uint8Array.from([0x00, 0x20, 0x00, 14]));
}

function buildLengthMismatchExample(): Uint8Array {
  const header = buildCommonHeader(OP_DMX, true);
  const declaredLength = 10; // ama gerçekte yalnız 4 bayt data gönderiliyor — TUTARSIZ (uyarı yolu)
  const lengthBytes = Uint8Array.from([0x00, declaredLength]);
  const actualData = Uint8Array.from([0x01, 0x02, 0x03, 0x04]);
  return concatBytes(header, Uint8Array.from([0x00, 0x00, 0x00, 0x00]), lengthBytes, actualData);
}

/**
 * Örnek çerçeveler. Checksum'suz protokol (dosya başı) — dolayısıyla motordan
 * bağımsız doğrulama kanıtı gerekmez (UBX/DNP3 tonu bu ailede uygulanmaz,
 * dalga 6 brifi karar 2). Kimlik alanları (ID/OpCode/ProtVer) hep spec-doğru;
 * DMX kanal içeriği ve ArtPollReply'nin bilgi baytları gösterim amaçlı
 * deterministik dolgudur (6a/doip örnek-üretim emsali).
 */
const EXAMPLE_FRAMES: ExampleFrame[] = [
  {
    id: 'art-dmx-happy-path',
    name: 'protocol.artnet.example.artDmxHappyPath.name',
    bytes: buildArtDmxExample(0, 0, 0, ARTDMX_HAPPY_DATA),
    description: 'protocol.artnet.example.artDmxHappyPath.description',
    expectedValid: true,
  },
  {
    id: 'art-dmx-full-512-universe',
    name: 'protocol.artnet.example.artDmxFull512Universe.name',
    bytes: buildArtDmxExample(1, 1, 0, buildFullUniverseChannels()),
    description: 'protocol.artnet.example.artDmxFull512Universe.description',
    expectedValid: true,
  },
  {
    id: 'art-poll-basic',
    name: 'protocol.artnet.example.artPollBasic.name',
    bytes: buildArtPollExample(0x02, 0x80), // Flags bit2 (diagnostics istekli), DiagPriority=DpHigh
    description: 'protocol.artnet.example.artPollBasic.description',
    expectedValid: true,
  },
  {
    id: 'art-poll-reply-partial',
    name: 'protocol.artnet.example.artPollReplyPartial.name',
    bytes: buildArtPollReplyExample(),
    description: 'protocol.artnet.example.artPollReplyPartial.description',
    expectedValid: true,
  },
  {
    id: 'art-time-code-body-not-decoded',
    name: 'protocol.artnet.example.artTimeCodeBodyNotDecoded.name',
    bytes: buildArtTimeCodeExample(),
    description: 'protocol.artnet.example.artTimeCodeBodyNotDecoded.description',
    expectedValid: true,
  },
  {
    id: 'unknown-opcode',
    name: 'protocol.artnet.example.unknownOpcode.name',
    bytes: buildUnknownOpcodeExample(),
    description: 'protocol.artnet.example.unknownOpcode.description',
    expectedValid: true,
  },
  {
    id: 'invalid-signature',
    name: 'protocol.artnet.example.invalidSignature.name',
    bytes: buildInvalidSignatureExample(),
    description: 'protocol.artnet.example.invalidSignature.description',
    expectedValid: false,
  },
  {
    id: 'art-dmx-length-mismatch',
    name: 'protocol.artnet.example.artDmxLengthMismatch.name',
    bytes: buildLengthMismatchExample(),
    description: 'protocol.artnet.example.artDmxLengthMismatch.description',
    expectedValid: true,
  },
];

export const artNetPlugin: ProtocolPlugin = {
  id: PROTOCOL_ID,
  name: PROTOCOL_DISPLAY_NAME,
  category: 'building-automation',
  parser: artNetParser,
  documentation: {
    summary: 'protocol.artnet.documentation.summary',
    layer: 'application',
    references: [
      {
        title:
          'Art-Net 4 Protocol Release V1.4 (Document Revision 1.4dp, 23/10/2025) — Artistic Licence Engineering, resmi yayın (kamu, royalty-free)',
        url: 'https://art-net.org.uk/downloads/art-net.pdf',
      },
    ],
  },
  exampleFrames: EXAMPLE_FRAMES,
};
