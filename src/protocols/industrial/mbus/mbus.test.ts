import { describe, expect, it } from 'vitest';

import { mbusParser, mbusPlugin, parseMbus } from './mbus';
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
  const example = mbusPlugin.exampleFrames.find((frame) => frame.id === id);
  if (example === undefined) {
    throw new Error(`example "${id}" not found`);
  }
  return example.bytes;
}

/**
 * `sum8Checksum`ın motor kodundan TAMAMEN AYRI, ikinci bir uygulaması —
 * DNP3/UBX deseni (dosya başı fixture uydurma yasağı notu, mbus.ts). Basit
 * bir mod-256 toplamı olsa da bağımsız yeniden üretimi hâlâ "motorun kendi
 * hesabını doğrulamıyor, katalog değerini doğruluyor" ayrımını korur.
 */
function independentSum8(data: Uint8Array): number {
  let sum = 0;
  for (const byte of data) sum += byte;
  return sum % 256;
}

describe('mbusParser.canParse', () => {
  it('accepts all four frame class start bytes', () => {
    expect(mbusParser.canParse(Uint8Array.from([0xe5]))).toBe(true);
    expect(mbusParser.canParse(bytes('10 5B 01 5C 16'))).toBe(true);
    expect(mbusParser.canParse(bytes('68 03 03 68 40 05 00 45 16'))).toBe(true);
    expect(mbusParser.canParse(bytes('68 03 03 68 40 05 00 45 16'))).toBe(true);
  });

  it('rejects an empty buffer and an unrecognized first byte', () => {
    expect(mbusParser.canParse(Uint8Array.from([]))).toBe(false);
    expect(mbusParser.canParse(Uint8Array.from([0x00]))).toBe(false);
    expect(mbusParser.canParse(Uint8Array.from([0xff]))).toBe(false);
  });
});

describe('parseMbus — Single Character (0xE5)', () => {
  it('decodes the ACK example', () => {
    const result = expectSuccess(parseMbus(exampleBytes('single-character-ack')));
    expect(result.frame.valid).toBe(true);
    const ack = fieldById(result.frame, 'ack');
    expect(ack.physicalValue).toBe('ACK');
  });

  it('flags trailing bytes when the buffer is longer than one byte', () => {
    const result = expectSuccess(parseMbus(Uint8Array.from([0xe5, 0xaa, 0xbb])));
    expect(hasField(result.frame, 'trailing-data')).toBe(true);
    expect(warningCodes(result.frame)).toContain('protocol.mbus.warning.trailingBytes');
  });
});

describe('parseMbus — Short Frame', () => {
  it('decodes REQ_UD2 (calling direction, FCV set) and validates the checksum independently', () => {
    const raw = exampleBytes('short-frame-req-ud2');
    const result = expectSuccess(parseMbus(raw));
    expect(result.frame.valid).toBe(true);

    const covered = raw.slice(1, 3); // C + A
    expect(independentSum8(covered)).toBe(raw[3]);

    expect(fieldById(result.frame, 'c-field-function').physicalValue).toBe('REQ_UD2');
    expect(fieldById(result.frame, 'c-field-dir').rawValue).toBe(1); // calling direction
    expect(fieldById(result.frame, 'c-field-bit4').rawValue).toBe(1); // FCV
    expect(fieldById(result.frame, 'a-field').rawValue).toBe(1);
    expect(fieldById(result.frame, 'checksum').valid).toBe(true);
    expect(fieldById(result.frame, 'stop-byte').valid).toBe(true);
  });

  it('reports checksum-mismatch but still shows the decoded C/A fields', () => {
    const result = expectSuccess(parseMbus(exampleBytes('checksum-mismatch')));
    expect(result.frame.valid).toBe(false);
    expect(errorCodes(result.frame)).toContain('checksum-mismatch');
    expect(fieldById(result.frame, 'c-field-function').physicalValue).toBe('REQ_UD2');
  });

  it('rejects a stop byte other than 0x16', () => {
    const result = expectSuccess(parseMbus(bytes('10 5B 01 5C 00')));
    expect(result.frame.valid).toBe(false);
    expect(errorCodes(result.frame)).toContain('value-out-of-range');
    expect(fieldById(result.frame, 'stop-byte').valid).toBe(false);
  });

  it('fails hard when shorter than the fixed 5-byte length', () => {
    const failure = expectFailure(parseMbus(bytes('10 5B 01')));
    expect(failure.error.code).toBe('truncated-frame');
    expect(failure.recoverable).toBe(true);
  });
});

describe('parseMbus — Control Frame (0x68, L=3)', () => {
  it('decodes SND_NKE with an unrecognized CI (structural placeholder) as a warning, not an error', () => {
    const raw = exampleBytes('control-frame-snd-nke');
    const result = expectSuccess(parseMbus(raw));
    expect(result.frame.valid).toBe(true);

    const covered = raw.slice(4, 7); // C + A + CI
    expect(independentSum8(covered)).toBe(raw[7]);

    expect(fieldById(result.frame, 'c-field-function').physicalValue).toBe('SND_NKE');
    expect(fieldById(result.frame, 'ci-field').valid).toBe(false);
    expect(warningCodes(result.frame)).toContain('protocol.mbus.warning.unknownCi');
    expect(hasField(result.frame, 'user-data')).toBe(false); // Control Frame: user data yok
  });

  it('flags mismatched length copies but still decodes the fields using the first copy', () => {
    const result = expectSuccess(parseMbus(exampleBytes('length-copies-mismatch')));
    expect(result.frame.valid).toBe(false);
    expect(errorCodes(result.frame)).toContain('length-mismatch');
    expect(fieldById(result.frame, 'c-field-function').physicalValue).toBe('SND_NKE');
  });

  it('rejects a second start byte that is not 0x68', () => {
    const result = expectSuccess(parseMbus(bytes('68 03 03 00 40 05 00 45 16')));
    expect(result.frame.valid).toBe(false);
    expect(errorCodes(result.frame)).toContain('start-delimiter-not-found');
  });
});

describe('parseMbus — Long Frame, CI=0x72 Variable Data', () => {
  const raw = exampleBytes('long-frame-rsp-ud-variable-data');

  it('validates the checksum independently across C+A+CI+UserData', () => {
    const declaredLength = raw[1];
    if (declaredLength === undefined) throw new Error('missing length byte');
    const covered = raw.slice(4, 4 + declaredLength);
    const checksumOffset = 4 + declaredLength;
    expect(independentSum8(covered)).toBe(raw[checksumOffset]);
  });

  it('decodes the Fixed Data Header (identification, manufacturer, medium)', () => {
    const result = expectSuccess(parseMbus(raw));
    expect(result.frame.valid).toBe(true);

    expect(fieldById(result.frame, 'fixed-header-identification-number').rawValue).toBe('12345678');
    const manufacturer = fieldById(result.frame, 'fixed-header-manufacturer');
    expect(manufacturer.rawValue).toBe(0x2c2d);
    expect(manufacturer.physicalValue).toBe('KAM');
    expect(fieldById(result.frame, 'fixed-header-medium').physicalValue).toBe('Heat (Outlet)');
  });

  it('decodes three data records with correctly scaled engineering values', () => {
    const result = expectSuccess(parseMbus(raw));

    const energy = fieldById(result.frame, 'data-0');
    expect(energy.rawValue).toBe(123456);
    expect(energy.physicalValue).toBe(123456); // VIF 0x03 → exponent 0
    expect(energy.unit).toBe('Wh');
    expect(fieldById(result.frame, 'vif-0').physicalValue).toBe('Energy (Wh)');

    const volume = fieldById(result.frame, 'data-1');
    expect(volume.rawValue).toBe(12565);
    expect(volume.physicalValue).toBeCloseTo(12.565, 6); // VIF 0x13 → exponent -3, matches m-bus.com's own worked example (12565 l)
    expect(volume.unit).toBe('m³');

    const flowTemperature = fieldById(result.frame, 'data-2');
    expect(flowTemperature.rawValue).toBe(235);
    expect(flowTemperature.physicalValue).toBeCloseTo(23.5, 6); // VIF 0x5A → exponent -1
    expect(flowTemperature.unit).toBe('°C');
  });

  it('shows raw User Data and a warning when CI is not in the narrow set', () => {
    const result = expectSuccess(parseMbus(exampleBytes('unrecognized-ci')));
    expect(result.frame.valid).toBe(true);
    expect(fieldById(result.frame, 'ci-field').valid).toBe(false);
    expect(warningCodes(result.frame)).toContain('protocol.mbus.warning.unknownCi');
    const userData = fieldById(result.frame, 'user-data');
    expect(Array.from(userData.rawBytes)).toEqual([0xaa, 0xbb, 0xcc, 0xdd]);
  });
});

describe('parseMbus — DIF/VIF record chain edge cases', () => {
  it('stops the record chain at a manufacturer-specific block (DIF=0x0F) and shows the rest raw', () => {
    const raw = bytes('68 12 12 68 08 01 72 00 00 00 00 00 00 00 00 00 00 00 00 0f aa bb ef 16');
    const result = expectSuccess(parseMbus(raw));
    expect(result.frame.valid).toBe(true);
    const block = fieldById(result.frame, 'mfg-data-0');
    expect(Array.from(block.rawBytes)).toEqual([0x0f, 0xaa, 0xbb]);
    expect(warningCodes(result.frame)).toContain('protocol.mbus.warning.manufacturerSpecificBlock');
  });

  it('decodes a Variable Length (LVAR) ASCII record', () => {
    const raw = bytes('68 15 15 68 08 01 72 00 00 00 00 00 00 00 00 00 00 00 00 0d 79 03 41 42 43 ca 16');
    const result = expectSuccess(parseMbus(raw));
    expect(result.frame.valid).toBe(true);
    expect(fieldById(result.frame, 'data-0').rawValue).toBe('ABC');
  });

  it('stops the chain when LVAR falls in the reserved 0xFB-0xFF range (length unknowable)', () => {
    const raw = bytes('68 14 14 68 08 01 72 00 00 00 00 00 00 00 00 00 00 00 00 0d 79 fb 01 02 ff 16');
    const result = expectSuccess(parseMbus(raw));
    expect(result.frame.valid).toBe(true);
    expect(warningCodes(result.frame)).toContain('protocol.mbus.warning.unknownLvarLength');
  });

  it('marks a data field invalid when BCD nibbles are out of the 0-9 range', () => {
    const raw = bytes('68 12 12 68 08 01 72 00 00 00 00 00 00 00 00 00 00 00 00 09 00 ab 2f 16');
    const result = expectSuccess(parseMbus(raw));
    expect(result.frame.valid).toBe(true); // uyarı basar, hata BASMAZ (spec ihlali değil, çözülemeyen alan)
    expect(fieldById(result.frame, 'data-0').valid).toBe(false);
    expect(warningCodes(result.frame)).toContain('protocol.mbus.warning.invalidBcd');
  });

  it('counts a single DIFE byte and keeps walking to VIF/data', () => {
    const raw = bytes(
      '68 16 16 68 08 01 72 00 00 00 00 00 00 00 00 00 00 00 00 84 00 03 01 00 00 00 03 16',
    );
    const result = expectSuccess(parseMbus(raw));
    expect(result.frame.valid).toBe(true);
    expect(hasField(result.frame, 'dife-0-0')).toBe(true);
    expect(fieldById(result.frame, 'data-0').rawValue).toBe(1);
  });

  it('consumes a VIFE byte raw but still resolves the named VIF underneath it', () => {
    const raw = bytes(
      '68 16 16 68 08 01 72 00 00 00 00 00 00 00 00 00 00 00 00 04 83 00 10 00 00 00 12 16',
    );
    const result = expectSuccess(parseMbus(raw));
    expect(result.frame.valid).toBe(true);
    expect(hasField(result.frame, 'vife-0-0')).toBe(true);
    expect(warningCodes(result.frame)).toContain('protocol.mbus.warning.vifeNotDecoded');
    expect(fieldById(result.frame, 'vif-0').physicalValue).toBe('Energy (Wh)');
  });

  it('stops the chain at VIF=0x7C (custom ASCII unit string, unsupported)', () => {
    const raw = bytes('68 12 12 68 08 01 72 00 00 00 00 00 00 00 00 00 00 00 00 01 7c 99 91 16');
    const result = expectSuccess(parseMbus(raw));
    expect(result.frame.valid).toBe(true);
    expect(warningCodes(result.frame)).toContain('protocol.mbus.warning.unsupportedVifString');
  });

  it('caps the DIFE chain at ten bytes (spec-defined maximum) and reports truncation', () => {
    const raw = bytes(
      '68 1b 1b 68 08 01 72 00 00 00 00 00 00 00 00 00 00 00 00 84 80 80 80 80 80 80 80 80 80 80 80 7f 16',
    );
    const result = expectSuccess(parseMbus(raw));
    expect(result.frame.valid).toBe(false);
    expect(errorCodes(result.frame)).toContain('truncated-frame');
    // Yalnız 10 DIFE tüketilmiş olmalı (0..9), 11.'ye asla dokunulmadı.
    expect(hasField(result.frame, 'dife-0-9')).toBe(true);
    expect(hasField(result.frame, 'dife-0-10')).toBe(false);
  });
});

describe('parseMbus — genel hata yolları', () => {
  it('fails hard on an empty buffer', () => {
    const failure = expectFailure(parseMbus(Uint8Array.from([])));
    expect(failure.error.code).toBe('truncated-frame');
  });

  it('fails hard, but recoverably, on an unrecognized first byte', () => {
    const failure = expectFailure(parseMbus(Uint8Array.from([0x99, 0x00, 0x00])));
    expect(failure.error.code).toBe('start-delimiter-not-found');
    expect(failure.recoverable).toBe(true);
  });

  it('honors maxFrameLength on a Long Frame before allocating anything', () => {
    const raw = exampleBytes('long-frame-rsp-ud-variable-data');
    const failure = expectFailure(mbusParser.parse(raw, { maxFrameLength: 10 }));
    expect(failure.error.code).toBe('frame-too-long');
  });

  it('respects an already-aborted signal', () => {
    const controller = new AbortController();
    controller.abort();
    const failure = expectFailure(mbusParser.parse(exampleBytes('single-character-ack'), { signal: controller.signal }));
    expect(failure.error.code).toBe('parser-timeout');
  });
});

describe('mbusPlugin', () => {
  it('registers every example frame with the outcome its id promises', () => {
    for (const example of mbusPlugin.exampleFrames) {
      const result = parseMbus(example.bytes);
      if (example.expectedValid === false) {
        const outcome = result.success ? result.frame.valid : false;
        expect(outcome, example.id).toBe(false);
      } else {
        expect(result.success, example.id).toBe(true);
      }
    }
  });

  it('carries category, id and cross-verified documentation references', () => {
    expect(mbusPlugin.id).toBe('m-bus');
    expect(mbusPlugin.category).toBe('industrial-automation');
    expect(mbusPlugin.documentation?.references?.length).toBeGreaterThanOrEqual(2);
    expect(mbusPlugin.exampleFrames.length).toBeGreaterThanOrEqual(7);
  });
});
