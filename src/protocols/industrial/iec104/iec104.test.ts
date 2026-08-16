import { describe, expect, it } from 'vitest';

import { iec104Parser, iec104Plugin, parseIec104 } from './iec104';
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
  const example = iec104Plugin.exampleFrames.find((frame) => frame.id === id);
  if (example === undefined) {
    throw new Error(`example "${id}" not found`);
  }
  return example.bytes;
}

/**
 * Motorun `readSequenceNumber15`ından TAMAMEN AYRI, bağımsız bir 15-bit
 * kaydırma uygulaması (DNP3'ün CRC'yi bağımsız ikinci kez hesapladığı desenin
 * sequence-number karşılığı) — iki yol aynı sonucu verirse doğrulanan
 * KAYNAKTAN teyitli KODLAMA KURALIdır, motorun kopyası değil.
 */
function independentSequenceNumber(lowByte: number, highByte: number): number {
  const combined = (highByte << 8) | lowByte;
  return combined >> 1;
}

describe('iec104Plugin.exampleFrames — sequence sayıları bağımsız hesapla kanıtlanır', () => {
  it('s-format-ack: N(R) bağımsız hesapla 3 çıkar', () => {
    const raw = exampleBytes('s-format-ack');
    expect(independentSequenceNumber(raw[4] ?? 0, raw[5] ?? 0)).toBe(3);
  });

  it('i-format-single-object-spontaneous: N(S)=0, N(R)=0', () => {
    const raw = exampleBytes('i-format-single-object-spontaneous');
    expect(independentSequenceNumber(raw[2] ?? 0, raw[3] ?? 0)).toBe(0);
    expect(independentSequenceNumber(raw[4] ?? 0, raw[5] ?? 0)).toBe(0);
  });

  it('i-format-sequential-objects: N(S)=1, N(R)=0', () => {
    const raw = exampleBytes('i-format-sequential-objects');
    expect(independentSequenceNumber(raw[2] ?? 0, raw[3] ?? 0)).toBe(1);
    expect(independentSequenceNumber(raw[4] ?? 0, raw[5] ?? 0)).toBe(0);
  });

  it('i-format-interrogation-command: N(S)=2, N(R)=1', () => {
    const raw = exampleBytes('i-format-interrogation-command');
    expect(independentSequenceNumber(raw[2] ?? 0, raw[3] ?? 0)).toBe(2);
    expect(independentSequenceNumber(raw[4] ?? 0, raw[5] ?? 0)).toBe(1);
  });

  it('every example round-trips through the real parser with its declared expectedValid', () => {
    for (const example of iec104Plugin.exampleFrames) {
      const result = parseIec104(example.bytes);
      if (!result.success) {
        // Hard-failure örnekleri (ör. length-mismatch) YALNIZ expectedValid:false ise beklenir.
        expect(example.expectedValid, `${example.id} unexpectedly failed to parse`).toBe(false);
        continue;
      }
      expect(result.frame.valid, example.id).toBe(example.expectedValid ?? true);
      expect(result.consumedBytes, example.id).toBe(example.bytes.length);
    }
  });
});

describe('parseIec104 — u-format-startdt-act', () => {
  const raw = exampleBytes('u-format-startdt-act');

  it('decodes the start byte, length and frame format as U-format', () => {
    const { frame } = expectSuccess(parseIec104(raw));
    expect(frame.valid).toBe(true);

    const start = fieldById(frame, 'start-byte');
    expect(start.valid).toBe(true);

    const length = fieldById(frame, 'length');
    expect(length.rawValue).toBe(4);
    expect(length.physicalValue).toBe(6);

    const format = fieldById(frame, 'frame-format');
    expect(format.physicalValue).toBe('U-format');
  });

  it('decodes the U-format function as STARTDT act', () => {
    const { frame, consumedBytes } = expectSuccess(parseIec104(raw));
    expect(consumedBytes).toBe(raw.length);
    const functionField = fieldById(frame, 'u-format-function');
    expect(functionField.physicalValue).toBe('STARTDT act');
    expect(hasField(frame, 'send-sequence-number')).toBe(false);
    expect(hasField(frame, 'type-id')).toBe(false);
  });
});

describe('parseIec104 — s-format-ack', () => {
  const raw = exampleBytes('s-format-ack');

  it('decodes the frame format as S-format with N(R)=3', () => {
    const { frame } = expectSuccess(parseIec104(raw));
    expect(fieldById(frame, 'frame-format').physicalValue).toBe('S-format');
    expect(fieldById(frame, 'receive-sequence-number').rawValue).toBe(3);
    expect(hasField(frame, 'u-format-function')).toBe(false);
  });
});

describe('parseIec104 — i-format-single-object-spontaneous', () => {
  const raw = exampleBytes('i-format-single-object-spontaneous');

  it('decodes I-format sequence numbers', () => {
    const { frame } = expectSuccess(parseIec104(raw));
    expect(fieldById(frame, 'frame-format').physicalValue).toBe('I-format');
    expect(fieldById(frame, 'send-sequence-number').rawValue).toBe(0);
    expect(fieldById(frame, 'receive-sequence-number').rawValue).toBe(0);
  });

  it('decodes the ASDU header: M_SP_NA_1, spontaneous, CA=1', () => {
    const { frame } = expectSuccess(parseIec104(raw));
    const typeId = fieldById(frame, 'type-id');
    expect(typeId.rawValue).toBe(1);
    expect(typeId.physicalValue).toBe('M_SP_NA_1 — Single-point information');
    expect(fieldById(frame, 'sq').rawValue).toBe(0);
    expect(fieldById(frame, 'number-of-objects').rawValue).toBe(1);
    const cause = fieldById(frame, 'cause-of-transmission');
    expect(cause.rawValue).toBe(3);
    expect(cause.physicalValue).toBe('Spontaneous');
    expect(fieldById(frame, 'common-address').rawValue).toBe(1);
  });

  it('decodes the single Information Object address and SIQ element bit by bit', () => {
    const { frame } = expectSuccess(parseIec104(raw));
    expect(fieldById(frame, 'information-object-address').rawValue).toBe(1);
    expect(fieldById(frame, 'siq-spi').rawValue).toBe(1);
    expect(fieldById(frame, 'siq-bl').rawValue).toBe(0);
    expect(fieldById(frame, 'siq-sb').rawValue).toBe(0);
    expect(fieldById(frame, 'siq-nt').rawValue).toBe(0);
    expect(fieldById(frame, 'siq-iv').rawValue).toBe(0);
    expect(hasField(frame, 'information-element')).toBe(false);
    expect(warningCodes(frame)).not.toContain(
      'protocol.iec104.warning.informationElementNeedsTypeDecode',
    );
  });
});

describe('parseIec104 — i-format-sequential-objects (SQ=1)', () => {
  const raw = exampleBytes('i-format-sequential-objects');

  it('decodes SQ=1 with a single IOA and three consecutive SIQ elements', () => {
    const { frame } = expectSuccess(parseIec104(raw));
    expect(fieldById(frame, 'sq').rawValue).toBe(1);
    expect(fieldById(frame, 'number-of-objects').rawValue).toBe(3);
    expect(fieldById(frame, 'cause-of-transmission').physicalValue).toBe('Periodic/cyclic');

    // Tek IOA — indeksli DEĞİL (dosya başı iec104Asdu.ts notu).
    expect(fieldById(frame, 'information-object-address').rawValue).toBe(1);
    expect(hasField(frame, 'information-object-address-0')).toBe(false);

    expect(fieldById(frame, 'siq-spi-0').rawValue).toBe(1);
    expect(fieldById(frame, 'siq-spi-1').rawValue).toBe(0);
    expect(fieldById(frame, 'siq-spi-2').rawValue).toBe(1);
    expect(fieldById(frame, 'siq-iv-2').rawValue).toBe(1);
  });
});

describe('parseIec104 — i-format-interrogation-command', () => {
  const raw = exampleBytes('i-format-interrogation-command');

  it('decodes C_IC_NA_1 activation with IOA=0 and a raw QOI element', () => {
    const { frame } = expectSuccess(parseIec104(raw));
    const typeId = fieldById(frame, 'type-id');
    expect(typeId.rawValue).toBe(100);
    expect(typeId.physicalValue).toBe('C_IC_NA_1 — Interrogation command');
    expect(fieldById(frame, 'cause-of-transmission').physicalValue).toBe('Activation');
    expect(fieldById(frame, 'information-object-address').rawValue).toBe(0);

    const element = fieldById(frame, 'information-element');
    expect(element.rawBytes).toEqual(bytes('14'));
    expect(warningCodes(frame)).toContain(
      'protocol.iec104.warning.informationElementNeedsTypeDecode',
    );
  });
});

describe('parseIec104 — i-format-unknown-type-id', () => {
  const raw = exampleBytes('i-format-unknown-type-id');

  it('flags the unrecognized Type ID as a warning, frame stays valid', () => {
    const { frame } = expectSuccess(parseIec104(raw));
    expect(frame.valid).toBe(true);
    const typeId = fieldById(frame, 'type-id');
    expect(typeId.rawValue).toBe(200);
    expect(typeId.valid).toBe(false);
    expect(warningCodes(frame)).toContain('protocol.iec104.warning.unknownTypeId');
  });
});

describe('parseIec104 — malformed input', () => {
  it('rejects buffers shorter than the 6-byte APCI, recoverable', () => {
    const result = expectFailure(parseIec104(bytes('68 04 07')));
    expect(result.error.code).toBe('truncated-frame');
    expect(result.recoverable).toBe(true);
  });

  it('rejects a declared content length below 4 as value-out-of-range, not recoverable', () => {
    const result = expectFailure(parseIec104(bytes('68 03 01 00 00 00')));
    expect(result.error.code).toBe('value-out-of-range');
    expect(result.recoverable).toBe(false);
  });

  it('start-byte-invalid: soft error, rest of the APCI still decodes', () => {
    const raw = exampleBytes('start-byte-invalid');
    const { frame } = expectSuccess(parseIec104(raw));
    expect(frame.valid).toBe(false);
    expect(errorCodes(frame)).toContain('start-delimiter-not-found');
    // Start baytı yanlış olsa da geri kalan APCI hâlâ çözülür (kısmi çözüm).
    expect(fieldById(frame, 'u-format-function').physicalValue).toBe('STARTDT act');
  });

  it('length-mismatch: hard ParseFailure, recoverable (wait for more TCP bytes)', () => {
    const raw = exampleBytes('length-mismatch');
    const result = expectFailure(parseIec104(raw));
    expect(result.error.code).toBe('length-mismatch');
    expect(result.recoverable).toBe(true);
  });
});

describe('iec104Parser.canParse', () => {
  it('accepts anything starting with 0x68 and at least 6 bytes long', () => {
    expect(iec104Parser.canParse(exampleBytes('u-format-startdt-act'))).toBe(true);
  });

  it('rejects short buffers and wrong start bytes', () => {
    expect(iec104Parser.canParse(bytes('68 04 07'))).toBe(false);
    expect(iec104Parser.canParse(bytes('67 04 07 00 00 00'))).toBe(false);
  });
});

describe('iec104Plugin', () => {
  it('is registered under the industrial-automation category with example frames', () => {
    expect(iec104Plugin.id).toBe('iec-60870-5-104');
    expect(iec104Plugin.category).toBe('industrial-automation');
    expect(iec104Plugin.exampleFrames.length).toBeGreaterThan(0);
    expect(iec104Parser.protocolId).toBe('iec-60870-5-104');
  });
});
