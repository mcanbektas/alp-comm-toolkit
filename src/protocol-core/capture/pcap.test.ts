import { describe, expect, it } from 'vitest';

import { parsePcapFile } from './pcap';
import type { PcapEndianness, PcapParseResult } from './pcap';

// ── Sentetik dosya inşa yardımcıları ─────────────────────────────────────────
// Gerçek bir capture değil — bayt bayt elle kurulmuş, kaynağı bu dosyanın
// kendisi (pcap.ts başındaki kaynak uyarısına göre inşa edildi).

function u16(value: number, endianness: PcapEndianness): number[] {
  const hi = (value >>> 8) & 0xff;
  const lo = value & 0xff;
  return endianness === 'big' ? [hi, lo] : [lo, hi];
}

function u32(value: number, endianness: PcapEndianness): number[] {
  const b0 = (value >>> 24) & 0xff;
  const b1 = (value >>> 16) & 0xff;
  const b2 = (value >>> 8) & 0xff;
  const b3 = value & 0xff;
  return endianness === 'big' ? [b0, b1, b2, b3] : [b3, b2, b1, b0];
}

interface GlobalHeaderOptions {
  magicBytes: readonly number[];
  endianness: PcapEndianness;
  versionMajor?: number;
  versionMinor?: number;
  thiszone?: number;
  sigfigs?: number;
  snaplen?: number;
  linkType?: number;
}

function buildGlobalHeader(options: GlobalHeaderOptions): number[] {
  const {
    magicBytes,
    endianness,
    versionMajor = 2,
    versionMinor = 4,
    thiszone = 0,
    sigfigs = 0,
    snaplen = 65535,
    linkType = 1,
  } = options;
  return [
    ...magicBytes,
    ...u16(versionMajor, endianness),
    ...u16(versionMinor, endianness),
    ...u32(thiszone, endianness),
    ...u32(sigfigs, endianness),
    ...u32(snaplen, endianness),
    ...u32(linkType, endianness),
  ];
}

interface PacketRecordOptions {
  endianness: PcapEndianness;
  seconds: number;
  subsecond: number;
  data: readonly number[];
  capturedLength?: number;
  originalLength?: number;
}

function buildPacketRecord(options: PacketRecordOptions): number[] {
  const { endianness, seconds, subsecond, data } = options;
  const capturedLength = options.capturedLength ?? data.length;
  const originalLength = options.originalLength ?? data.length;
  return [
    ...u32(seconds, endianness),
    ...u32(subsecond, endianness),
    ...u32(capturedLength, endianness),
    ...u32(originalLength, endianness),
    ...data,
  ];
}

function expectOk(result: PcapParseResult): Extract<PcapParseResult, { status: 'ok' }> {
  if (result.status !== 'ok') {
    throw new Error(`expected ok, got error "${result.code}": ${result.message}`);
  }
  return result;
}

function expectError(result: PcapParseResult): Extract<PcapParseResult, { status: 'error' }> {
  if (result.status !== 'error') {
    throw new Error('expected error, got a parsed file');
  }
  return result;
}

const ETHERNET_LIKE_PACKET_1 = [
  0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xaa, 0xbb, 0xcc, 0xdd, 0xee, 0xff, 0x08, 0x06,
];
const ETHERNET_LIKE_PACKET_2 = [0x01, 0x02, 0x03, 0x04, 0x05];

describe('parsePcapFile — normal dosya, magic 0xA1B2C3D4 (doğal bayt sırası → big-endian, µs)', () => {
  const bytes = Uint8Array.from([
    ...buildGlobalHeader({ magicBytes: [0xa1, 0xb2, 0xc3, 0xd4], endianness: 'big', snaplen: 65535, linkType: 1 }),
    ...buildPacketRecord({
      endianness: 'big',
      seconds: 1700000000,
      subsecond: 500000,
      data: ETHERNET_LIKE_PACKET_1,
    }),
    ...buildPacketRecord({
      endianness: 'big',
      seconds: 1700000001,
      subsecond: 250,
      data: ETHERNET_LIKE_PACKET_2,
    }),
  ]);

  it('global header alanlarını doğru okur', () => {
    const { header } = expectOk(parsePcapFile(bytes));
    expect(header.magic).toBe(0xa1b2c3d4);
    expect(header.endianness).toBe('big');
    expect(header.timestampUnit).toBe('microseconds');
    expect(header.versionMajor).toBe(2);
    expect(header.versionMinor).toBe(4);
    expect(header.thiszone).toBe(0);
    expect(header.sigfigs).toBe(0);
    expect(header.snaplen).toBe(65535);
    expect(header.linkType).toBe(1);
    expect(header.linkTypeName).toBe('Ethernet');
  });

  it('iki paketi de sırayla, doğru alanlarla ayrıştırır', () => {
    const { packets } = expectOk(parsePcapFile(bytes));
    expect(packets).toHaveLength(2);

    expect(packets[0]?.timestamp).toBeCloseTo(1700000000000 + 500000 / 1000, 6);
    expect(packets[0]?.capturedLength).toBe(ETHERNET_LIKE_PACKET_1.length);
    expect(packets[0]?.originalLength).toBe(ETHERNET_LIKE_PACKET_1.length);
    expect(packets[0]?.truncated).toBe(false);
    expect(Array.from(packets[0]?.data ?? [])).toEqual(ETHERNET_LIKE_PACKET_1);

    expect(packets[1]?.timestamp).toBeCloseTo(1700000001000 + 250 / 1000, 6);
    expect(Array.from(packets[1]?.data ?? [])).toEqual(ETHERNET_LIKE_PACKET_2);
  });
});

describe('parsePcapFile — nanosaniye varyantı, magic 0xA1B23C4D', () => {
  it('subsecond alanını nanosaniye olarak yorumlar', () => {
    const bytes = Uint8Array.from([
      ...buildGlobalHeader({ magicBytes: [0xa1, 0xb2, 0x3c, 0x4d], endianness: 'big' }),
      ...buildPacketRecord({
        endianness: 'big',
        seconds: 1000,
        subsecond: 123456789,
        data: [0xaa, 0xbb],
      }),
    ]);

    const { header, packets } = expectOk(parsePcapFile(bytes));
    expect(header.timestampUnit).toBe('nanoseconds');
    expect(header.endianness).toBe('big');
    expect(packets).toHaveLength(1);
    // 123456789 ns = 123.456789 ms.
    expect(packets[0]?.timestamp).toBeCloseTo(1000 * 1000 + 123.456789, 6);
  });
});

describe('parsePcapFile — byte-swapped varyant, magic 0xD4C3B2A1 (little-endian dosya, µs)', () => {
  it('little-endian alan sırasını doğru çözer', () => {
    const bytes = Uint8Array.from([
      ...buildGlobalHeader({
        magicBytes: [0xd4, 0xc3, 0xb2, 0xa1],
        endianness: 'little',
        snaplen: 262144,
        linkType: 0,
      }),
      ...buildPacketRecord({
        endianness: 'little',
        seconds: 42,
        subsecond: 1000,
        data: [0x11, 0x22, 0x33],
      }),
    ]);

    const { header, packets } = expectOk(parsePcapFile(bytes));
    expect(header.magic).toBe(0xd4c3b2a1);
    expect(header.endianness).toBe('little');
    expect(header.timestampUnit).toBe('microseconds');
    expect(header.snaplen).toBe(262144);
    expect(header.linkType).toBe(0);
    expect(header.linkTypeName).toBe('Null/Loopback');
    expect(packets).toHaveLength(1);
    expect(Array.from(packets[0]?.data ?? [])).toEqual([0x11, 0x22, 0x33]);
  });
});

describe('parsePcapFile — kesik paket (incl_len < orig_len)', () => {
  it('truncated: true işaretler, hata BASMAZ', () => {
    const data = [0xde, 0xad, 0xbe];
    const bytes = Uint8Array.from([
      ...buildGlobalHeader({ magicBytes: [0xa1, 0xb2, 0xc3, 0xd4], endianness: 'big' }),
      ...buildPacketRecord({
        endianness: 'big',
        seconds: 1,
        subsecond: 0,
        data,
        capturedLength: data.length,
        originalLength: 64, // telde daha uzundu, yakalamada kesildi
      }),
    ]);

    const { packets } = expectOk(parsePcapFile(bytes));
    expect(packets).toHaveLength(1);
    expect(packets[0]?.capturedLength).toBe(3);
    expect(packets[0]?.originalLength).toBe(64);
    expect(packets[0]?.truncated).toBe(true);
  });
});

describe('parsePcapFile — PCAPNG reddi', () => {
  it('Section Header Block magic\'i (0x0A0D0D0A) görünce pcapng-not-supported döner, ayrıştırmaya ÇALIŞMAZ', () => {
    const bytes = Uint8Array.from([
      0x0a, 0x0d, 0x0d, 0x0a, // SHB magic
      0x1c, 0x00, 0x00, 0x00, // block total length (uydurma, önemi yok — reddedilecek)
      0x4d, 0x3c, 0x2b, 0x1a, // byte-order magic (uydurma)
    ]);
    const result = expectError(parsePcapFile(bytes));
    expect(result.code).toBe('pcapng-not-supported');
  });

  it('kısa bir PCAPNG başlangıcında da (24 bayttan az) önce pcapng olarak tanır, too-short DEMEZ', () => {
    const bytes = Uint8Array.from([0x0a, 0x0d, 0x0d, 0x0a]);
    const result = expectError(parsePcapFile(bytes));
    expect(result.code).toBe('pcapng-not-supported');
  });
});

describe('parsePcapFile — bozuk/eksik dosya', () => {
  it('24 bayttan kısa (ve pcapng değil) girdide too-short döner, çökmez', () => {
    const bytes = Uint8Array.from([0xa1, 0xb2, 0xc3, 0xd4, 0x00, 0x02, 0x00, 0x04]);
    const result = expectError(parsePcapFile(bytes));
    expect(result.code).toBe('too-short');
  });

  it('boş dosyada (0 bayt) çökmeden too-short döner', () => {
    const result = expectError(parsePcapFile(new Uint8Array(0)));
    expect(result.code).toBe('too-short');
  });

  it('per-packet header buffer sonundan kısa kaldığında truncated-packet-header döner', () => {
    const bytes = Uint8Array.from([
      ...buildGlobalHeader({ magicBytes: [0xa1, 0xb2, 0xc3, 0xd4], endianness: 'big' }),
      0x00,
      0x00,
      0x00,
      0x01, // 16 baytlık paket başlığının yalnız 4 baytı var
    ]);
    const result = expectError(parsePcapFile(bytes));
    expect(result.code).toBe('truncated-packet-header');
  });

  it('paket verisi dosya sonundan taştığında truncated-packet-data döner', () => {
    const bytes = Uint8Array.from([
      ...buildGlobalHeader({ magicBytes: [0xa1, 0xb2, 0xc3, 0xd4], endianness: 'big' }),
      ...u32(1, 'big'), // ts_sec
      ...u32(0, 'big'), // ts_usec
      ...u32(100, 'big'), // incl_len: 100 bayt vadediyor
      ...u32(100, 'big'), // orig_len
      0x01,
      0x02,
      0x03, // ama yalnız 3 bayt veri var
    ]);
    const result = expectError(parsePcapFile(bytes));
    expect(result.code).toBe('truncated-packet-data');
  });

  it('incl_len snaplen\'i aştığında corrupt-packet-length döner', () => {
    const bytes = Uint8Array.from([
      ...buildGlobalHeader({ magicBytes: [0xa1, 0xb2, 0xc3, 0xd4], endianness: 'big', snaplen: 4 }),
      ...buildPacketRecord({
        endianness: 'big',
        seconds: 1,
        subsecond: 0,
        data: [0x01, 0x02, 0x03, 0x04, 0x05], // 5 bayt > snaplen (4)
      }),
    ]);
    const result = expectError(parsePcapFile(bytes));
    expect(result.code).toBe('corrupt-packet-length');
  });
});

describe('parsePcapFile — tanınmayan magic', () => {
  it('dört bilinen sabitten hiçbiriyle eşleşmeyen magic\'te unrecognized-magic döner', () => {
    const bytes = Uint8Array.from([
      0x12, 0x34, 0x56, 0x78, // bilinmeyen magic
      0x00, 0x02, 0x00, 0x04,
      0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0xff, 0xff,
      0x00, 0x00, 0x00, 0x01,
    ]);
    const result = expectError(parsePcapFile(bytes));
    expect(result.code).toBe('unrecognized-magic');
  });
});
