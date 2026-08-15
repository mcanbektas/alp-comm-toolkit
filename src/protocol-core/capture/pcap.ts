/**
 * Klasik libpcap "savefile" DOSYA FORMATI ayrıştırıcısı — PCAP bir protokol
 * DEĞİLDİR, bir dosya formatıdır (karar 5a, brief-faz10-dalga4.md madde 5).
 * Katalogda kaydı yok, decode sekmesine bağlı bir "motor" değil; bu yüzden bu
 * modül BİLEREK `protocol-core/types.ts`teki `ProtocolParser`/`ProtocolPlugin`
 * sözleşmesine BAĞLI DEĞİL — bağımsız, saf TypeScript fonksiyonları. UI
 * entegrasyonu bu dalgada yok, Log Analyzer'ın (§34) işi.
 *
 * ── KAYNAK UYARISI ────────────────────────────────────────────────────────
 * Bu deponun `docs/spec/` dosyası PCAP için bayt düzeyinde hiçbir ayrıntı
 * vermiyor (spec'te yalnız "PCAP import" adı geçer). Global/per-packet header
 * alan düzeni, magic varyantları ve link-type numaraları İKİ KAMUYA AÇIK
 * kaynaktan çapraz doğrulandı:
 *   1) libpcap "pcap-savefile" man sayfası (tcpdump.org/manpages/pcap-savefile.5.html)
 *   2) IETF opsawg PCAP Capture File Format taslağı (draft-ietf-opsawg-pcap)
 * PCAPNG (Section Header Block, ayrı ve daha yeni bir format) bu ikisinde de
 * TANIMLANMAZ — burada yalnız tanınıp reddedilir, ayrıştırılmaz.
 *
 * ── MAGIC → ENDIANNESS + ZAMAN BİRİMİ ───────────────────────────────────────
 * Global header'ın ilk 4 baytı hem bir "bu bir pcap dosyası mı" imzası hem de
 * geri kalan tüm çok baytlı alanların byte sırasını (little/big-endian) ve
 * zaman damgası birimini (µs/ns) taşır. Baytlar dosyadaki SIRAYLA en anlamlı
 * bayt önce olacak şekilde (büyük-uçlu / MSB-first) TEK bir 32-bit sayıya
 * okunur ve dört bilinen sabitle karşılaştırılır:
 *
 *   0xA1B2C3D4 → baytlar dosyada ZATEN "doğal" (MSB-first) sırada yazılmış  →
 *                dosyanın diğer alanları BÜYÜK-uçlu (big-endian), µs.
 *   0xD4C3B2A1 → aynı sabitin bayt sırası TERS okunmuş (byte-swapped)      →
 *                dosyanın diğer alanları KÜÇÜK-uçlu (little-endian), µs.
 *                Bu, alışılagelmiş "d4 c3 b2 a1" imzasıdır — x86/x86_64 gibi
 *                little-endian sistemlerde tcpdump'ın ürettiği SIRADAN pcap
 *                dosyasının hex dökümünün başında görülen budur (iki kaynak
 *                da bu eşleşmeyi doğruluyor: "byte-swapped" varyant = LE).
 *   0xA1B23C4D → nanosaniye varyantı, "doğal" sırada → BÜYÜK-uçlu, ns.
 *   0x4D3CB2A1 → nanosaniye varyantının byte-swapped hâli → KÜÇÜK-uçlu, ns.
 *
 * NOT: bazı ikincil kaynaklar bu dört sabiti "hangisi LE hangisi BE" diye
 * anarken birbirine karışabiliyor (isimlendirme "okuyucunun doğal sırası"na
 * göre görelidir). Yukarıdaki eşleştirme MUTLAK bayt sırasına göre sabitlendi
 * ve iki kaynakla çapraz doğrulandı — 0xD4C3B2A1 HER ZAMAN little-endian
 * dosya demektir, okuyucunun platformundan bağımsız.
 *
 * ── KAPSAM DIŞI (bilinçli) ──────────────────────────────────────────────────
 * • PCAPNG — ayrı format, tanı-ve-reddet dışında hiçbir şey yapılmaz.
 * • Paket verisinin İÇİ (Ethernet/IP/…) — bu modül yalnız dosya zarfını söker,
 *   `data` alanı ham `Uint8Array` olarak döner; çözümleme başka motorların işi.
 * • IPv4/TCP reassembly, çok-dosya birleştirme — Log Analyzer katmanının işi.
 */

// ── Sabitler ────────────────────────────────────────────────────────────────

const GLOBAL_HEADER_LENGTH = 24;
const PACKET_HEADER_LENGTH = 16;

const MAGIC_OFFSET = 0;
const VERSION_MAJOR_OFFSET = 4;
const VERSION_MINOR_OFFSET = 6;
const THISZONE_OFFSET = 8;
const SIGFIGS_OFFSET = 12;
const SNAPLEN_OFFSET = 16;
const LINK_TYPE_OFFSET = 20;

const PACKET_TS_SECONDS_OFFSET = 0;
const PACKET_TS_SUBSECOND_OFFSET = 4;
const PACKET_INCL_LEN_OFFSET = 8;
const PACKET_ORIG_LEN_OFFSET = 12;

/** libpcap: sıradan (mikrosaniye), doğal bayt sırası → büyük-uçlu dosya. */
const MAGIC_BIG_ENDIAN_MICROS = 0xa1b2c3d4;
/** Aynı sabitin byte-swapped hâli → küçük-uçlu dosya (yaygın "d4 c3 b2 a1" imzası). */
const MAGIC_LITTLE_ENDIAN_MICROS = 0xd4c3b2a1;
/** libpcap nanosaniye varyantı, doğal bayt sırası → büyük-uçlu dosya. */
const MAGIC_BIG_ENDIAN_NANOS = 0xa1b23c4d;
/** Nanosaniye varyantının byte-swapped hâli → küçük-uçlu dosya. */
const MAGIC_LITTLE_ENDIAN_NANOS = 0x4d3cb2a1;

/**
 * PCAPNG Section Header Block'un Block Type alanı. Baytlar (0A 0D 0D 0A) kasıtlı
 * bir bayt-palindromu: MSB-first ve LSB-first okununca AYNI sayıyı verir, bu
 * yüzden dosyanın byte sırası bilinmeden de erkenden tanınabilir.
 */
const PCAPNG_SECTION_HEADER_MAGIC = 0x0a0d0d0a;

/** Alt 28 bit link-layer header type — üst 4 bit yeni taslakta FCS uzunluğu içindir. */
const LINK_TYPE_VALUE_MASK = 0x0fffffff;

/** Dar, bilinen link-type kümesi (libpcap `pcap/dlt.h`) — kapsam dışı kalanlar ham+adsız kalır. */
const LINK_TYPE_NAMES: ReadonlyMap<number, string> = new Map([
  [0, 'Null/Loopback'],
  [1, 'Ethernet'],
  [101, 'Raw IP'],
]);

const MILLISECONDS_PER_SECOND = 1000;
const MICROSECONDS_PER_MILLISECOND = 1000;
const NANOSECONDS_PER_MILLISECOND = 1_000_000;

const SIGNED_INT32_OVERFLOW = 0x100000000;
const SIGNED_INT32_SIGN_BIT = 0x80000000;

// ── Tipler ──────────────────────────────────────────────────────────────────

export type PcapEndianness = 'little' | 'big';
export type PcapTimestampUnit = 'microseconds' | 'nanoseconds';

export interface PcapGlobalHeader {
  /** Ham magic değeri, büyük-uçlu (MSB-first) okunuşuyla — dört bilinen sabitten biri. */
  magic: number;
  endianness: PcapEndianness;
  timestampUnit: PcapTimestampUnit;
  versionMajor: number;
  versionMinor: number;
  /** GMT→yerel düzeltmesi (saniye); modern dosyalarda hep 0, ham gösterilir. */
  thiszone: number;
  /** Zaman damgası hassasiyeti; modern dosyalarda hep 0, ham gösterilir. */
  sigfigs: number;
  /** Yakalama başına maksimum bayt sayısı. */
  snaplen: number;
  /** Alt 28 bit link-layer header type — ham değer. */
  linkType: number;
  /** Dar tanınan kümedeyse ad; değilse `undefined` (ham değer yine `linkType`de durur). */
  linkTypeName: string | undefined;
}

export interface PcapPacket {
  /** Epoch milisaniye; `ts_sec` + alt-saniye kısmı (magic'e göre µs/ns) birleştirilmiş temsil. */
  timestamp: number;
  /** Dosyaya yazılan (muhtemelen kesilmiş) uzunluk — `incl_len`. */
  capturedLength: number;
  /** Telde gerçek uzunluk — `orig_len`. */
  originalLength: number;
  /** `capturedLength < originalLength`: paket yakalamada kesilmiş, hata DEĞİL bilgi. */
  truncated: boolean;
  /** Paket baytları — kopyalamadan `subarray` dilimi (büyük dosyada kopya maliyeti yok). */
  data: Uint8Array;
}

export type PcapParseErrorCode =
  | 'too-short'
  | 'pcapng-not-supported'
  | 'unrecognized-magic'
  | 'truncated-packet-header'
  | 'corrupt-packet-length'
  | 'truncated-packet-data';

export interface PcapParseError {
  code: PcapParseErrorCode;
  message: string;
  /** Hatanın oluştuğu bayt konumu, biliniyorsa. */
  offset?: number;
}

export type PcapParseResult =
  | { status: 'ok'; header: PcapGlobalHeader; packets: PcapPacket[] }
  | ({ status: 'error' } & PcapParseError);

// ── Bayt okuma yardımcıları ───────────────────────────────────────────────

function byteAt(data: Uint8Array, offset: number): number {
  // noUncheckedIndexedAccess: dizi sonunu aşan okuma `undefined` döner, 0 varsayılır.
  return data[offset] ?? 0;
}

function readUint16(data: Uint8Array, offset: number, endianness: PcapEndianness): number {
  const first = byteAt(data, offset);
  const second = byteAt(data, offset + 1);
  return endianness === 'big' ? (first << 8) | second : (second << 8) | first;
}

/**
 * 4 baytlık işaretsiz büyük değer okuması: en üst bayt çarpımla taşınır (doip.ts
 * `readUint32BE` emsali) — JS'in işaretli 32-bit sol kaydırma tuzağına düşülmez,
 * son adımda `>>> 0` ile işaretsize sabitlenir.
 */
function readUint32(data: Uint8Array, offset: number, endianness: PcapEndianness): number {
  const b0 = byteAt(data, offset);
  const b1 = byteAt(data, offset + 1);
  const b2 = byteAt(data, offset + 2);
  const b3 = byteAt(data, offset + 3);
  const value =
    endianness === 'big'
      ? b0 * 0x1000000 + (b1 << 16) + (b2 << 8) + b3
      : b3 * 0x1000000 + (b2 << 16) + (b1 << 8) + b0;
  return value >>> 0;
}

function readInt32(data: Uint8Array, offset: number, endianness: PcapEndianness): number {
  const unsigned = readUint32(data, offset, endianness);
  return unsigned >= SIGNED_INT32_SIGN_BIT ? unsigned - SIGNED_INT32_OVERFLOW : unsigned;
}

// ── Magic tanıma ────────────────────────────────────────────────────────────

interface MagicInfo {
  endianness: PcapEndianness;
  timestampUnit: PcapTimestampUnit;
}

function identifyMagic(magic: number): MagicInfo | undefined {
  switch (magic) {
    case MAGIC_BIG_ENDIAN_MICROS:
      return { endianness: 'big', timestampUnit: 'microseconds' };
    case MAGIC_LITTLE_ENDIAN_MICROS:
      return { endianness: 'little', timestampUnit: 'microseconds' };
    case MAGIC_BIG_ENDIAN_NANOS:
      return { endianness: 'big', timestampUnit: 'nanoseconds' };
    case MAGIC_LITTLE_ENDIAN_NANOS:
      return { endianness: 'little', timestampUnit: 'nanoseconds' };
    default:
      return undefined;
  }
}

// ── Global header ───────────────────────────────────────────────────────────

function parseGlobalHeader(data: Uint8Array, magic: number, info: MagicInfo): PcapGlobalHeader {
  const { endianness, timestampUnit } = info;
  const rawLinkType = readUint32(data, LINK_TYPE_OFFSET, endianness);
  const linkType = rawLinkType & LINK_TYPE_VALUE_MASK;
  return {
    magic,
    endianness,
    timestampUnit,
    versionMajor: readUint16(data, VERSION_MAJOR_OFFSET, endianness),
    versionMinor: readUint16(data, VERSION_MINOR_OFFSET, endianness),
    thiszone: readInt32(data, THISZONE_OFFSET, endianness),
    sigfigs: readUint32(data, SIGFIGS_OFFSET, endianness),
    snaplen: readUint32(data, SNAPLEN_OFFSET, endianness),
    linkType,
    linkTypeName: LINK_TYPE_NAMES.get(linkType),
  };
}

// ── Paket döngüsü ───────────────────────────────────────────────────────────

function combineTimestamp(seconds: number, subsecond: number, unit: PcapTimestampUnit): number {
  const fractionalMs =
    unit === 'nanoseconds'
      ? subsecond / NANOSECONDS_PER_MILLISECOND
      : subsecond / MICROSECONDS_PER_MILLISECOND;
  return seconds * MILLISECONDS_PER_SECOND + fractionalMs;
}

/** Discriminated union: paket dizisi başarıyla tamamlanır ya da tek bir hatayla durur. */
type PacketLoopResult = { ok: true; packets: PcapPacket[] } | { ok: false; error: PcapParseError };

function parsePackets(data: Uint8Array, header: PcapGlobalHeader): PacketLoopResult {
  const packets: PcapPacket[] = [];
  let cursor = GLOBAL_HEADER_LENGTH;

  while (cursor < data.length) {
    if (data.length - cursor < PACKET_HEADER_LENGTH) {
      return {
        ok: false,
        error: {
          code: 'truncated-packet-header',
          message: `Paket başlığı için ${PACKET_HEADER_LENGTH} bayt gerekiyor, ${
            data.length - cursor
          } bayt kaldı (offset ${cursor}).`,
          offset: cursor,
        },
      };
    }

    const seconds = readUint32(data, cursor + PACKET_TS_SECONDS_OFFSET, header.endianness);
    const subsecond = readUint32(data, cursor + PACKET_TS_SUBSECOND_OFFSET, header.endianness);
    const capturedLength = readUint32(data, cursor + PACKET_INCL_LEN_OFFSET, header.endianness);
    const originalLength = readUint32(data, cursor + PACKET_ORIG_LEN_OFFSET, header.endianness);

    if (capturedLength > header.snaplen) {
      return {
        ok: false,
        error: {
          code: 'corrupt-packet-length',
          message: `incl_len (${capturedLength}) snaplen'i (${header.snaplen}) aşıyor — dosya bozuk (offset ${cursor}).`,
          offset: cursor,
        },
      };
    }

    const packetDataStart = cursor + PACKET_HEADER_LENGTH;
    const packetDataEnd = packetDataStart + capturedLength;
    if (packetDataEnd > data.length) {
      return {
        ok: false,
        error: {
          code: 'truncated-packet-data',
          message: `Paket verisi dosya sonundan taşıyor: incl_len ${capturedLength} bayt istiyor, ${
            data.length - packetDataStart
          } bayt kaldı (offset ${packetDataStart}).`,
          offset: packetDataStart,
        },
      };
    }

    packets.push({
      timestamp: combineTimestamp(seconds, subsecond, header.timestampUnit),
      capturedLength,
      originalLength,
      truncated: capturedLength < originalLength,
      // Büyük dosyalarda kopyalama maliyetinden kaçınmak için subarray (slice DEĞİL).
      data: data.subarray(packetDataStart, packetDataEnd),
    });

    cursor = packetDataEnd;
  }

  return { ok: true, packets };
}

// ── Giriş noktası ───────────────────────────────────────────────────────────

/**
 * Klasik (pcapng OLMAYAN) bir libpcap savefile'ı baştan sona ayrıştırır: global
 * header + ardışık per-packet header/veri çiftlerini söker. Saf fonksiyondur —
 * durum tutmaz, aynı girdi her zaman aynı sonucu verir. Çökme YOK: her hata yolu
 * `status: 'error'` ile döner (`noUncheckedIndexedAccess` guard'ları dizi sonunu
 * aşan okumaları 0'a düşürür, hata kontrolleri ayrıca uzunlukları doğrular).
 */
export function parsePcapFile(buffer: Uint8Array): PcapParseResult {
  if (buffer.length >= 4) {
    const magicBigEndianRead = readUint32(buffer, MAGIC_OFFSET, 'big');
    if (magicBigEndianRead === PCAPNG_SECTION_HEADER_MAGIC) {
      return {
        status: 'error',
        code: 'pcapng-not-supported',
        message:
          'Bu bir PCAPNG dosyası (Section Header Block imzası bulundu) — PCAPNG farklı bir format, bu ayrıştırıcı yalnız klasik pcap savefile destekler.',
        offset: 0,
      };
    }
  }

  if (buffer.length < GLOBAL_HEADER_LENGTH) {
    return {
      status: 'error',
      code: 'too-short',
      message: `Global header için en az ${GLOBAL_HEADER_LENGTH} bayt gerekiyor, dosya ${buffer.length} bayt.`,
      offset: 0,
    };
  }

  const magic = readUint32(buffer, MAGIC_OFFSET, 'big');
  const magicInfo = identifyMagic(magic);
  if (magicInfo === undefined) {
    return {
      status: 'error',
      code: 'unrecognized-magic',
      message: `Tanınmayan magic değeri: 0x${magic.toString(16).toUpperCase().padStart(8, '0')}.`,
      offset: 0,
    };
  }

  const header = parseGlobalHeader(buffer, magic, magicInfo);
  const packetsResult = parsePackets(buffer, header);
  if (!packetsResult.ok) {
    return { status: 'error', ...packetsResult.error };
  }

  return { status: 'ok', header, packets: packetsResult.packets };
}
