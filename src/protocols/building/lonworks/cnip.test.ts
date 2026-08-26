import { describe, expect, it } from 'vitest';

import type { ParsedField, ProtocolError, ProtocolWarning } from '@/protocol-core/types';

import {
  CNIP_HEADER_LENGTH,
  LENGTH_LENIENT,
  LENGTH_STRICT,
  PACKET_TYPE_HANDLING_NAME_AND_RAW,
  PACKET_TYPE_HANDLING_REJECT,
  TIMESTAMP_EPOCH_1900,
  TIMESTAMP_EPOCH_1970,
  TIMESTAMP_EPOCH_RAW,
  VERSION_SPLIT_ECHELON,
  VERSION_SPLIT_WHOLE_BYTE,
  cnipPacketTypeName,
  decodeCnipHeader,
  isKnownCnipPacketType,
} from './cnip';
import type { CnipDecodeOptions, FieldSink } from './cnip';

/**
 * Faz 10 dalga 17 — CN/IP (ISO/IEC 14908-4) tünel başlığı.
 *
 * Bu dosyanın kilit iddiaları üç tanedir ve üçü de "hata VERMEDEN yanlış"
 * sınıfındandır: (1) uzunluk alanı KENDİSİNİ DE sayar, (2) `exth` 32-BİT
 * SÖZCÜK sayar, (3) bayt 2 Echelon'a göre 5+3 bölünür.
 */

const DEFAULTS: CnipDecodeOptions = {
  versionByteSplit: VERSION_SPLIT_ECHELON,
  strictLength: LENGTH_STRICT,
  unknownPacketTypeHandling: PACKET_TYPE_HANDLING_NAME_AND_RAW,
  timestampEpoch: TIMESTAMP_EPOCH_RAW,
};

function bytes(hex: string): Uint8Array {
  const parts = hex.trim().split(/\s+/);
  return Uint8Array.from(parts, (part) => Number.parseInt(part, 16) & 0xff);
}

interface Run {
  readonly fields: ParsedField[];
  readonly warnings: ProtocolWarning[];
  readonly errors: ProtocolError[];
  readonly summary: ReturnType<typeof decodeCnipHeader>;
}

function run(data: Uint8Array, options: Partial<CnipDecodeOptions> = {}): Run {
  const sink: FieldSink = { fields: [], usedIds: new Set() };
  const warnings: ProtocolWarning[] = [];
  const errors: ProtocolError[] = [];
  const summary = decodeCnipHeader(data, sink, warnings, errors, { ...DEFAULTS, ...options });
  return { fields: sink.fields, warnings, errors, summary };
}

function field(result: Run, id: string): ParsedField {
  const found = result.fields.find((candidate) => candidate.id === id);
  if (found === undefined) throw new Error(`missing field ${id}`);
  return found;
}

/** Gerçek yakalamanın ilk datagramı (32 bayt), Faz 10 dalga 17 örnek 1). */
const REAL_DATAGRAM =
  '00 20 01 01 00 00 00 00 6B 8B 45 67 00 00 00 00 00 00 00 00 01 09 01 AA 01 A9 01 03 81 0D 00 CA';

describe('CN/IP başlığı — gerçek datagram', () => {
  it('yirmi baytlık başlığı alan alan çözer ve LonTalk yükünün yerini verir', () => {
    const result = run(bytes(REAL_DATAGRAM));

    expect(result.errors).toEqual([]);
    expect(field(result, 'cnip-packet-size').rawValue).toBe(32);
    expect(field(result, 'cnip-version').physicalValue).toBe('1');
    expect(field(result, 'cnip-packet-type').physicalValue).toBe('Data Packet');
    expect(field(result, 'cnip-ext-header-size').rawValue).toBe(0);
    expect(field(result, 'cnip-vendor-code').physicalValue).toBe('0x0000');
    // `>>> 0` olmadan 0x6B8B4567 negatife dönerdi — o regresyonun bekçisi.
    expect(field(result, 'cnip-session-id').rawValue).toBe(0x6b8b4567);
    expect(field(result, 'cnip-sequence').rawValue).toBe(0);
    expect(result.summary.payloadOffset).toBe(CNIP_HEADER_LENGTH);
    expect(result.summary.carriesLonTalk).toBe(true);
  });

  it('`packetSize` KENDİSİNİ DE sayar — BVLC gibi, MBAP`ın TERSİNE', () => {
    const data = bytes(REAL_DATAGRAM);
    expect(field(run(data), 'cnip-packet-size').rawValue).toBe(data.length);
    // Yükün uzunluğu (12 B) yazılsaydı alan 20 bayt kayardı ve tutmazdı.
    expect(field(run(data), 'cnip-packet-size').rawValue).not.toBe(data.length - CNIP_HEADER_LENGTH);
  });

  it('uzunluk alanı ayrışırsa katı modda HATA, gevşek modda UYARI basar', () => {
    const corrupt = bytes(REAL_DATAGRAM);
    corrupt[1] = 0x21;

    const strict = run(corrupt);
    expect(strict.errors.map((error) => error.code)).toEqual(['length-mismatch']);
    expect(field(strict, 'cnip-packet-size').valid).toBe(false);

    const lenient = run(corrupt, { strictLength: LENGTH_LENIENT });
    expect(lenient.errors).toEqual([]);
    expect(lenient.warnings.map((warning) => warning.code)).toContain('lengthMismatchLenient');
  });
});

describe('`extndHdrSize` — 32-BİT SÖZCÜK, bayt DEĞİL', () => {
  it('bir sözcüklük genişletilmiş başlıkta yük DÖRT bayt ileri kayar', () => {
    const original = bytes(REAL_DATAGRAM);
    const extended = new Uint8Array(original.length + 4);
    extended.set(original.subarray(0, CNIP_HEADER_LENGTH), 0);
    extended.set(original.subarray(CNIP_HEADER_LENGTH), CNIP_HEADER_LENGTH + 4);
    extended[1] = (original[1] ?? 0) + 4;
    extended[4] = 1;

    const result = run(extended);
    expect(result.errors).toEqual([]);
    // Bayt saysaydı 21 çıkardı ve LonTalk PDU'su ÜÇ bayt kayardı — hata vermeden.
    expect(result.summary.payloadOffset).toBe(CNIP_HEADER_LENGTH + 4);
    expect(field(result, 'cnip-ext-header-size').physicalValue).toBe('1 × 32-bit word = 4 B');
    expect(field(result, 'cnip-extended-header').length).toBe(4);
    expect(result.warnings.map((warning) => warning.code)).toContain('extendedHeaderUnverified');
  });

  it('genişletilmiş başlık datagrama sığmıyorsa kesik çerçeve hatası basar', () => {
    const data = bytes(REAL_DATAGRAM);
    data[4] = 0x40;
    const result = run(data);
    expect(result.errors.map((error) => error.code)).toContain('truncated-frame');
    expect(result.summary.carriesLonTalk).toBe(false);
  });
});

describe('sürüm baytı — SAPMA 1', () => {
  it('varsayılan Echelon bölünmesi 5 bit sürüm + 3 bayrak biti verir', () => {
    const data = bytes(REAL_DATAGRAM);
    data[2] = 0x81; // bit 7 kurulu, sürüm hâlâ 1
    const result = run(data);
    expect(field(result, 'cnip-version').physicalValue).toBe('1');
    expect(field(result, 'cnip-version-bits').physicalValue).toContain('vendor private packet');
    expect(result.warnings.map((warning) => warning.code)).toContain('vendorPrivatePacketFollows');
  });

  it('MBZ bitleri kurulu olunca uyarır', () => {
    const data = bytes(REAL_DATAGRAM);
    data[2] = 0x21;
    expect(run(data).warnings.map((warning) => warning.code)).toContain('reservedBitsNotZero');
  });

  it('Wireshark okumasında bayrak alanı HİÇ BASILMAZ ve sürüm tüm bayttır', () => {
    const data = bytes(REAL_DATAGRAM);
    data[2] = 0x81;
    const result = run(data, { versionByteSplit: VERSION_SPLIT_WHOLE_BYTE });
    expect(field(result, 'cnip-version').physicalValue).toBe('129');
    expect(result.fields.some((candidate) => candidate.id === 'cnip-version-bits')).toBe(false);
    expect(result.warnings.map((warning) => warning.code)).toContain('unexpectedCnipVersion');
  });
});

describe('paket tipi ve protokol kodu — kapsam çizgisi', () => {
  it('on dört tipin hepsi adlandırılır, on beşincisi adlandırılmaz', () => {
    expect(cnipPacketTypeName(0x01)).toBe('Data Packet');
    expect(cnipPacketTypeName(0x7f)).toBe('Segment');
    expect(cnipPacketTypeName(0x02)).toBeUndefined();
    expect(isKnownCnipPacketType(0x63)).toBe(true);
    expect(isKnownCnipPacketType(0x02)).toBe(false);
  });

  it('Data Packet olmayan tipin ADI basılır, gövdesi HAM kalır, hata YOKTUR', () => {
    const data = bytes(REAL_DATAGRAM);
    data[3] = 0x63;
    const result = run(data);
    expect(result.errors).toEqual([]);
    expect(field(result, 'cnip-packet-type').physicalValue).toBe('Device Configuration Request');
    expect(field(result, 'cnip-body').length).toBe(data.length - CNIP_HEADER_LENGTH);
    expect(result.summary.carriesLonTalk).toBe(false);
    expect(result.warnings.map((warning) => warning.code)).toContain('nonDataPacketNotDecoded');
  });

  it('reddet seçeneği açıkken aynı çerçeve `unsupported-encoding` verir', () => {
    const data = bytes(REAL_DATAGRAM);
    data[3] = 0x63;
    const result = run(data, { unknownPacketTypeHandling: PACKET_TYPE_HANDLING_REJECT });
    expect(result.errors.map((error) => error.code)).toEqual(['unsupported-encoding']);
  });

  it('protokol kodu 0 değilse KAPSAM DIŞI denir — sessizce "geçersiz" DENMEZ', () => {
    const data = bytes(REAL_DATAGRAM);
    data[5] = 0x01;
    const result = run(data);
    expect(result.errors.map((error) => error.code)).toEqual(['unsupported-encoding']);
    expect(result.errors[0]?.details).toEqual({ protocolCode: 1 });
    expect(field(result, 'cnip-protocol-flags').physicalValue).toContain('not EIA-709');
    // Gövde HAM basılır: boş kart yasağı.
    expect(field(result, 'cnip-body').length).toBeGreaterThan(0);
    expect(result.summary.carriesLonTalk).toBe(false);
  });

  it('güvenlik biti kurulu olunca uyarır ama protokol kodunu bozmaz', () => {
    const data = bytes(REAL_DATAGRAM);
    data[5] = 0x20;
    const result = run(data);
    expect(result.errors).toEqual([]);
    expect(result.warnings.map((warning) => warning.code)).toContain('securityBitSet');
    expect(result.summary.carriesLonTalk).toBe(true);
  });
});

describe('zaman damgası — birim biliniyor, EPOCH bilinmiyor', () => {
  it('varsayılanda ham milisaniye basılır ve TARİHE ÇEVRİLMEZ', () => {
    const result = run(bytes(REAL_DATAGRAM));
    const stamp = field(result, 'cnip-timestamp');
    expect(stamp.unit).toBe('ms');
    expect(stamp.physicalValue).toBe(0);
    expect(result.warnings.map((warning) => warning.code)).toContain('timestampEpochUnknown');
  });

  it('kullanıcı taban bildirirse tarih üretilir ve BİRİM DÜŞER', () => {
    const data = bytes(REAL_DATAGRAM);
    data.set([0x00, 0x00, 0x03, 0xe8], 16); // 1000 ms

    const unix = field(run(data, { timestampEpoch: TIMESTAMP_EPOCH_1970 }), 'cnip-timestamp');
    expect(String(unix.physicalValue)).toContain('1970-01-01T00:00:01.000Z');
    expect(unix.unit).toBeUndefined();

    const y1900 = field(run(data, { timestampEpoch: TIMESTAMP_EPOCH_1900 }), 'cnip-timestamp');
    expect(String(y1900.physicalValue)).toContain('1900-01-01T00:00:01.000Z');
  });
});

describe('kısa girdi', () => {
  it('yirmi bayttan kısa girdi okunamaz sayılır', () => {
    const result = run(bytes(REAL_DATAGRAM).slice(0, 19));
    expect(result.summary.readable).toBe(false);
    expect(result.errors.map((error) => error.code)).toEqual(['truncated-frame']);
    expect(result.fields).toEqual([]);
  });
});
