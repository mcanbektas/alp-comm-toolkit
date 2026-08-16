import { describe, expect, it } from 'vitest';

import { dnp3Parser, dnp3Plugin, parseDnp3 } from './dnp3';
import type {
  ParseFailure,
  ParseResult,
  ParseSuccess,
  ParsedField,
  ParsedFrame,
} from '@/protocol-core/types';

function bytes(hex: string): Uint8Array {
  const cleaned = hex.replace(/\s+/g, '');
  const result = new Uint8Array(cleaned.length / 2);
  for (let index = 0; index < result.length; index++) {
    result[index] = Number.parseInt(cleaned.slice(index * 2, index * 2 + 2), 16);
  }
  return result;
}

function expectSuccess(result: ParseResult): ParseSuccess {
  if (!result.success) {
    throw new Error(`expected success, got error "${result.error.code}"`);
  }
  return result;
}

function expectFailure(result: ParseResult): ParseFailure {
  if (result.success) {
    throw new Error('expected failure, got a parsed frame');
  }
  return result;
}

function fieldById(frame: ParsedFrame, id: string): ParsedField {
  const found = frame.fields.find((field) => field.id === id);
  if (found === undefined) {
    throw new Error(`field "${id}" not found; got ${frame.fields.map((f) => f.id).join(', ')}`);
  }
  return found;
}

function hasField(frame: ParsedFrame, id: string): boolean {
  return frame.fields.some((field) => field.id === id);
}

function warningCodes(frame: ParsedFrame): string[] {
  return frame.warnings.map((warning) => warning.code);
}

function errorCodes(frame: ParsedFrame): string[] {
  return frame.errors.map((error) => error.code);
}

function exampleBytes(id: string): Uint8Array {
  const example = dnp3Plugin.exampleFrames.find((frame) => frame.id === id);
  if (example === undefined) {
    throw new Error(`example "${id}" not found`);
  }
  return example.bytes;
}

/**
 * CRC16_DNP'nin motorun `computeChecksum`ından TAMAMEN AYRI, bit-bazlı ikinci
 * bir uygulaması — RTCM/LIN/UBX deseni (dosya başı fixture uydurma yasağı
 * notu, dnp3.ts). poly 0x3D65, init 0x0000, refin/refout true, xorout 0xFFFF.
 * İki bağımsız kod yolu aynı sonucu verirse doğrulanan katalog PARAMETRESİdir,
 * motorun kopyası değil.
 */
function reflectBits(value: bigint, width: number): bigint {
  let remaining = value;
  let reflected = 0n;
  for (let index = 0; index < width; index++) {
    reflected = (reflected << 1n) | (remaining & 1n);
    remaining >>= 1n;
  }
  return reflected;
}

function independentCrc16Dnp(data: Uint8Array): number {
  const poly = 0x3d65n;
  const mask = 0xffffn;
  const topBit = 0x8000n;
  let register = 0x0000n;
  for (const byte of data) {
    const inputByte = reflectBits(BigInt(byte), 8);
    for (let bitIndex = 7; bitIndex >= 0; bitIndex--) {
      const inputBit = (inputByte >> BigInt(bitIndex)) & 1n;
      const topBitWasSet = (register & topBit) !== 0n ? 1n : 0n;
      register = (register << 1n) & mask;
      if ((topBitWasSet ^ inputBit) === 1n) register ^= poly;
    }
  }
  register = reflectBits(register, 16);
  return Number((register ^ 0xffffn) & mask);
}

function independentCrcLeBytes(value: number): Uint8Array {
  return Uint8Array.from([value & 0xff, (value >>> 8) & 0xff]);
}

describe('independentCrc16Dnp — spec fixture (ASCII "123456789")', () => {
  it('matches the published CRC16/DNP check value 0xEA82', () => {
    expect(independentCrc16Dnp(bytes('31 32 33 34 35 36 37 38 39'))).toBe(0xea82);
  });
});

describe('dnp3Plugin.exampleFrames — CRC değerleri bağımsız hesapla kanıtlanır', () => {
  it('link-only-request-link-status: header CRC bağımsız hesapla tutarlı', () => {
    const raw = exampleBytes('link-only-request-link-status');
    const headerCovered = raw.slice(0, 8);
    const expectedCrc = independentCrc16Dnp(headerCovered);
    expect(raw.slice(8, 10)).toEqual(independentCrcLeBytes(expectedCrc));
  });

  it('single-segment-read-class0: header + tek blok CRC bağımsız hesapla tutarlı', () => {
    const raw = exampleBytes('single-segment-read-class0');
    expect(raw.slice(8, 10)).toEqual(independentCrcLeBytes(independentCrc16Dnp(raw.slice(0, 8))));
    const blockData = raw.slice(10, 16);
    expect(raw.slice(16, 18)).toEqual(independentCrcLeBytes(independentCrc16Dnp(blockData)));
  });

  it('response-with-iin: header + tek blok CRC bağımsız hesapla tutarlı', () => {
    const raw = exampleBytes('response-with-iin');
    expect(raw.slice(8, 10)).toEqual(independentCrcLeBytes(independentCrc16Dnp(raw.slice(0, 8))));
    const blockData = raw.slice(10, 21);
    expect(raw.slice(21, 23)).toEqual(independentCrcLeBytes(independentCrc16Dnp(blockData)));
  });

  it('multi-segment-first-segment: header + tek blok CRC bağımsız hesapla tutarlı', () => {
    const raw = exampleBytes('multi-segment-first-segment');
    expect(raw.slice(8, 10)).toEqual(independentCrcLeBytes(independentCrc16Dnp(raw.slice(0, 8))));
    const blockData = raw.slice(10, 16);
    expect(raw.slice(16, 18)).toEqual(independentCrcLeBytes(independentCrc16Dnp(blockData)));
  });

  it('header-crc-mismatch: header CRC KASTEN 00 00, bağımsız hesapla FARKLI çıkar', () => {
    const raw = exampleBytes('header-crc-mismatch');
    const expectedCrc = independentCrc16Dnp(raw.slice(0, 8));
    expect(raw.slice(8, 10)).not.toEqual(independentCrcLeBytes(expectedCrc));
  });

  it('block-crc-mismatch: header CRC doğru, blok CRC KASTEN 00 00', () => {
    const raw = exampleBytes('block-crc-mismatch');
    expect(raw.slice(8, 10)).toEqual(independentCrcLeBytes(independentCrc16Dnp(raw.slice(0, 8))));
    const blockData = raw.slice(10, 16);
    expect(raw.slice(16, 18)).not.toEqual(independentCrcLeBytes(independentCrc16Dnp(blockData)));
  });

  it('every example round-trips through the real parser with its declared expectedValid', () => {
    for (const example of dnp3Plugin.exampleFrames) {
      const result = parseDnp3(example.bytes);
      const success = expectSuccess(result);
      expect(success.frame.valid, example.id).toBe(example.expectedValid ?? true);
    }
  });
});

describe('parseDnp3 — link-only-request-link-status', () => {
  const raw = exampleBytes('link-only-request-link-status');

  it('decodes start bytes, length and header CRC as valid', () => {
    const { frame } = expectSuccess(parseDnp3(raw));
    expect(frame.valid).toBe(true);

    const start = fieldById(frame, 'start-bytes');
    expect(start.offset).toBe(0);
    expect(start.length).toBe(2);
    expect(start.valid).toBe(true);

    const length = fieldById(frame, 'length');
    expect(length.rawValue).toBe(5);

    const headerCrc = fieldById(frame, 'header-crc');
    expect(headerCrc.valid).toBe(true);
    expect(headerCrc.offset).toBe(8);
    expect(headerCrc.length).toBe(2);
  });

  it('decodes the link control byte and the primary function code', () => {
    const { frame } = expectSuccess(parseDnp3(raw));

    expect(fieldById(frame, 'link-direction').rawValue).toBe(1);
    expect(fieldById(frame, 'link-primary').rawValue).toBe(1);
    const functionField = fieldById(frame, 'link-function-code');
    expect(functionField.rawValue).toBe(0x09);
    expect(functionField.physicalValue).toBe('Request Link Status');
  });

  it('decodes destination/source and produces no body-block fields', () => {
    const { frame, consumedBytes } = expectSuccess(parseDnp3(raw));
    expect(consumedBytes).toBe(raw.length);
    expect(fieldById(frame, 'destination').rawValue).toBe(4);
    expect(fieldById(frame, 'source').rawValue).toBe(1);
    expect(hasField(frame, 'block-crc-0')).toBe(false);
    expect(hasField(frame, 'transport-fin')).toBe(false);
  });
});

describe('parseDnp3 — single-segment-read-class0', () => {
  const raw = exampleBytes('single-segment-read-class0');

  it('decodes a single transport segment (FIR=FIN=1)', () => {
    const { frame } = expectSuccess(parseDnp3(raw));
    expect(fieldById(frame, 'transport-fin').rawValue).toBe(1);
    expect(fieldById(frame, 'transport-fir').rawValue).toBe(1);
    expect(fieldById(frame, 'transport-sequence').rawValue).toBe(0);
    expect(warningCodes(frame)).not.toContain('protocol.dnp3.warning.multiSegmentSession');
  });

  it('decodes the application function code as Read', () => {
    const { frame } = expectSuccess(parseDnp3(raw));
    const functionField = fieldById(frame, 'application-function-code');
    expect(functionField.rawValue).toBe(0x01);
    expect(functionField.physicalValue).toBe('Read');
    expect(hasField(frame, 'iin1-need-time')).toBe(false);
  });

  it('decodes the object header down to a no-range qualifier, no data blob', () => {
    const { frame } = expectSuccess(parseDnp3(raw));
    const group = fieldById(frame, 'object-group');
    expect(group.rawValue).toBe(60);
    expect(group.physicalValue).toBe('Class Objects');
    expect(fieldById(frame, 'object-variation').rawValue).toBe(1);
    const qualifier = fieldById(frame, 'object-qualifier');
    expect(qualifier.rawValue).toBe(0x06);
    expect(qualifier.physicalValue).toBe('No Range Field (All Objects)');
    expect(hasField(frame, 'range-start')).toBe(false);
    expect(hasField(frame, 'object-data')).toBe(false);
  });

  it('validates the single body-block CRC', () => {
    const { frame } = expectSuccess(parseDnp3(raw));
    const blockCrc = fieldById(frame, 'block-crc-0');
    expect(blockCrc.valid).toBe(true);
    expect(blockCrc.offset).toBe(16);
    expect(blockCrc.length).toBe(2);
  });
});

describe('parseDnp3 — response-with-iin', () => {
  const raw = exampleBytes('response-with-iin');

  it('flags the Response function code and Need Time IIN bit', () => {
    const { frame } = expectSuccess(parseDnp3(raw));
    const functionField = fieldById(frame, 'application-function-code');
    expect(functionField.rawValue).toBe(0x81);
    expect(functionField.physicalValue).toBe('Response');

    expect(fieldById(frame, 'iin1-need-time').rawValue).toBe(1);
    expect(fieldById(frame, 'iin1-broadcast').rawValue).toBe(0);
    expect(fieldById(frame, 'iin1-device-restart').rawValue).toBe(0);
    expect(fieldById(frame, 'iin2-reserved-6').rawValue).toBe(0);
    expect(fieldById(frame, 'iin2-reserved-7').rawValue).toBe(0);
  });

  it('decodes group/variation/qualifier and an 8-bit start/stop range', () => {
    const { frame } = expectSuccess(parseDnp3(raw));
    const group = fieldById(frame, 'object-group');
    expect(group.rawValue).toBe(1);
    expect(group.physicalValue).toBe('Binary Input');
    expect(fieldById(frame, 'object-variation').rawValue).toBe(2);

    const qualifier = fieldById(frame, 'object-qualifier');
    expect(qualifier.physicalValue).toBe('8-bit Start/Stop Indices');
    expect(fieldById(frame, 'range-start').rawValue).toBe(0);
    expect(fieldById(frame, 'range-stop').rawValue).toBe(0);
  });

  it('shows the point data after the header as ONE raw Object Data field — no CRC bleed', () => {
    const { frame } = expectSuccess(parseDnp3(raw));
    const objectData = fieldById(frame, 'object-data');
    // Bu alan tam bloğun İÇİNDE biter (offset 20, uzunluk 1) — bloğun kendi
    // CRC'sini (offset 21-22) YUTMAMALI (dosya başı ofset tuzağı fix'i).
    expect(objectData.offset).toBe(20);
    expect(objectData.length).toBe(1);
    expect(objectData.rawBytes).toEqual(Uint8Array.from([0x81]));
    expect(warningCodes(frame)).toContain('protocol.dnp3.warning.objectDataNeedsVariationDecode');
  });
});

describe('parseDnp3 — multi-segment-first-segment', () => {
  const raw = exampleBytes('multi-segment-first-segment');

  it('does not attempt application-layer decode, warns and shows raw segment data', () => {
    const { frame } = expectSuccess(parseDnp3(raw));
    expect(fieldById(frame, 'transport-fir').rawValue).toBe(1);
    expect(fieldById(frame, 'transport-fin').rawValue).toBe(0);
    expect(hasField(frame, 'application-function-code')).toBe(false);
    expect(warningCodes(frame)).toContain('protocol.dnp3.warning.multiSegmentSession');

    const segmentData = fieldById(frame, 'segment-data');
    expect(segmentData.offset).toBe(11);
    expect(segmentData.length).toBe(5);
    expect(segmentData.rawBytes).toEqual(bytes('01 02 03 04 05'));
  });
});

describe('parseDnp3 — CRC mismatch paths', () => {
  it('header-crc-mismatch: crc-mismatch error, frame invalid, other fields still parsed', () => {
    const raw = exampleBytes('header-crc-mismatch');
    const { frame } = expectSuccess(parseDnp3(raw));
    expect(frame.valid).toBe(false);
    expect(errorCodes(frame)).toContain('crc-mismatch');
    expect(fieldById(frame, 'header-crc').valid).toBe(false);
    // Header CRC'si tutmasa da diğer link alanları yine gösterilir (kısmi çözüm).
    expect(fieldById(frame, 'link-function-code').physicalValue).toBe('Request Link Status');
  });

  it('block-crc-mismatch: yürüyüş DEVAM EDER, application katmanı yine çözülür', () => {
    const raw = exampleBytes('block-crc-mismatch');
    const { frame } = expectSuccess(parseDnp3(raw));
    expect(frame.valid).toBe(false);
    expect(errorCodes(frame)).toContain('crc-mismatch');
    expect(fieldById(frame, 'block-crc-0').valid).toBe(false);
    // Bozuk blok CRC'sine RAĞMEN application katmanı çözülmeye devam eder.
    expect(fieldById(frame, 'application-function-code').rawValue).toBe(0x01);
  });
});

describe('parseDnp3 — malformed input', () => {
  it('rejects frames shorter than the 10-byte link header, recoverable', () => {
    const result = expectFailure(parseDnp3(bytes('05 64 05 C9')));
    expect(result.error.code).toBe('truncated-frame');
    expect(result.recoverable).toBe(true);
  });

  it('flags start bytes other than 05 64 as start-delimiter-not-found', () => {
    const raw = bytes('00 00 05 C9 04 00 01 00 00 00');
    const { frame } = expectSuccess(parseDnp3(raw));
    expect(frame.valid).toBe(false);
    expect(errorCodes(frame)).toContain('start-delimiter-not-found');
  });

  it('flags a Length below the 5-byte minimum as value-out-of-range', () => {
    const raw = bytes('05 64 04 C9 04 00 01 00 00 00');
    const { frame } = expectSuccess(parseDnp3(raw));
    expect(frame.valid).toBe(false);
    expect(errorCodes(frame)).toContain('value-out-of-range');
    // Length geçersizse gövde yürüyüşü hiç denenmez.
    expect(hasField(frame, 'block-crc-0')).toBe(false);
  });

  it('flags an unrecognized primary link function code as a warning, not an error', () => {
    // Control 0xC5: DIR=1,PRM=1,func=5 — primary kümede (0,2,3,4,9) yok.
    const header = bytes('05 64 05 C5 04 00 01 00');
    const crc = independentCrc16Dnp(header);
    const raw = new Uint8Array([...header, ...independentCrcLeBytes(crc)]);
    const { frame } = expectSuccess(parseDnp3(raw));
    expect(frame.valid).toBe(true);
    expect(warningCodes(frame)).toContain('protocol.dnp3.warning.unknownLinkFunctionCode');
    expect(fieldById(frame, 'link-function-code').valid).toBe(false);
  });

  it('reports truncated-frame when Length promises a body block that is not physically present', () => {
    // Length=11 → 6 bayt user data + CRC bekler ama fiziksel çerçeve header'da bitiyor.
    const raw = bytes('05 64 0B C4 04 00 01 00 01 30');
    const { frame } = expectSuccess(parseDnp3(raw));
    expect(frame.valid).toBe(false);
    expect(errorCodes(frame)).toContain('truncated-frame');
  });
});

describe('dnp3Parser.canParse', () => {
  it('accepts anything starting with 05 64 and at least 10 bytes long', () => {
    expect(dnp3Parser.canParse(exampleBytes('link-only-request-link-status'))).toBe(true);
  });

  it('rejects short buffers and wrong start bytes', () => {
    expect(dnp3Parser.canParse(bytes('05 64 05'))).toBe(false);
    expect(dnp3Parser.canParse(bytes('00 00 05 C9 04 00 01 00 53 3B'))).toBe(false);
  });
});

describe('dnp3Plugin', () => {
  it('is registered under the industrial-automation category with example frames', () => {
    expect(dnp3Plugin.id).toBe('dnp3');
    expect(dnp3Plugin.category).toBe('industrial-automation');
    expect(dnp3Plugin.exampleFrames.length).toBeGreaterThan(0);
    expect(dnp3Parser.protocolId).toBe('dnp3');
  });
});
