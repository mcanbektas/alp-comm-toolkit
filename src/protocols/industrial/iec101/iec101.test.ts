import { describe, expect, it } from 'vitest';

import { iec101Parser, iec101Plugin, parseIec101 } from './iec101';
import type {
  ParseContext,
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
  const example = iec101Plugin.exampleFrames.find((frame) => frame.id === id);
  if (example === undefined) {
    throw new Error(`example "${id}" not found`);
  }
  return example.bytes;
}

/**
 * `sum8Checksum`ı İTHAL ETMEDEN bağımsız bir ikinci hesaplama — motorun
 * KENDİSİNİN çağırdığı fonksiyonu test etmek tautoloji olurdu (mbus.test.ts/
 * wirelessMbus.test.ts'in bağımsız doğrulama deseninin aynısı).
 */
function independentSum8(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0) % 256;
}

describe('iec101Plugin.exampleFrames — checksumlar bağımsız hesapla kanıtlanır', () => {
  it('fixed-length-reset-remote-link: sum8([0x40,0x01]) = 0x41', () => {
    expect(independentSum8([0x40, 0x01])).toBe(0x41);
  });

  it('variable-length-user-data: sum8(Control+Address+ASDU) = 0x5C, L=12', () => {
    const asdu = [0x01, 0x01, 0x03, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0x01];
    expect(independentSum8([0x53, 0x01, ...asdu])).toBe(0x5c);
    expect(2 + asdu.length).toBe(12);
  });

  it('variable-length-secondary-response: sum8(Control+Address+ASDU) = 0x11', () => {
    const asdu = [0x01, 0x01, 0x03, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0x01];
    expect(independentSum8([0x08, 0x01, ...asdu])).toBe(0x11);
  });

  it('every example round-trips through the real parser with its declared expectedValid', () => {
    for (const example of iec101Plugin.exampleFrames) {
      const result = parseIec101(example.bytes);
      if (!result.success) {
        // Hard-failure örnekleri (ör. variable-length-truncated) YALNIZ expectedValid:false ise beklenir.
        expect(example.expectedValid, `${example.id} unexpectedly failed to parse`).toBe(false);
        continue;
      }
      expect(result.frame.valid, example.id).toBe(example.expectedValid ?? true);
      expect(result.consumedBytes, example.id).toBe(example.bytes.length);
    }
  });
});

describe('parseIec101 — single-character-confirmation', () => {
  it('decodes the single 0xE5 byte, whole buffer consumed', () => {
    const raw = exampleBytes('single-character-confirmation');
    const { frame, consumedBytes } = expectSuccess(parseIec101(raw));
    expect(frame.valid).toBe(true);
    expect(consumedBytes).toBe(1);
    expect(fieldById(frame, 'confirmation').rawValue).toBe('0xE5');
    expect(hasField(frame, 'trailing-data')).toBe(false);
  });

  it('flags trailing bytes after the confirmation as a warning, still consumes everything', () => {
    const { frame, consumedBytes } = expectSuccess(parseIec101(bytes('E5 AA BB')));
    expect(consumedBytes).toBe(3);
    expect(frame.valid).toBe(true); // yalnız uyarı, hata değil
    expect(warningCodes(frame)).toContain('protocol.iec101.warning.trailingBytes');
    expect(fieldById(frame, 'trailing-data').rawBytes).toEqual(bytes('AA BB'));
  });
});

describe('parseIec101 — fixed-length-reset-remote-link (PRM=1)', () => {
  const raw = exampleBytes('fixed-length-reset-remote-link');

  it('decodes control field bits as RES=0/PRM=1/FCB=0/FCV=0', () => {
    const { frame } = expectSuccess(parseIec101(raw));
    expect(frame.valid).toBe(true);
    expect(fieldById(frame, 'res-dir').rawValue).toBe(0);
    expect(fieldById(frame, 'prm').rawValue).toBe(1);
    expect(fieldById(frame, 'fcb-acd').name).toBe('FCB');
    expect(fieldById(frame, 'fcv-dfc').name).toBe('FCV');
  });

  it('names function code 0 as "Reset of remote link" and decodes the link address', () => {
    const { frame } = expectSuccess(parseIec101(raw));
    const fn = fieldById(frame, 'function-code');
    expect(fn.rawValue).toBe(0);
    expect(fn.physicalValue).toBe('Reset of remote link');
    expect(fieldById(frame, 'link-address').rawValue).toBe(1);
  });

  it('validates the checksum', () => {
    const { frame } = expectSuccess(parseIec101(raw));
    expect(fieldById(frame, 'checksum').valid).toBe(true);
    expect(fieldById(frame, 'checksum').physicalValue).toBe(0x41);
  });
});

describe('parseIec101 — fixed-length-ack (PRM=0)', () => {
  const raw = exampleBytes('fixed-length-ack');

  it('reads bit6/bit5 as ACD/DFC (not FCB/FCV) when PRM=0', () => {
    const { frame } = expectSuccess(parseIec101(raw));
    expect(fieldById(frame, 'prm').rawValue).toBe(0);
    expect(fieldById(frame, 'fcb-acd').name).toBe('ACD');
    expect(fieldById(frame, 'fcv-dfc').name).toBe('DFC');
  });

  it('names function code 0 (PRM=0) as ACK — a DIFFERENT meaning from PRM=1 function code 0', () => {
    const { frame } = expectSuccess(parseIec101(raw));
    expect(fieldById(frame, 'function-code').physicalValue).toBe('ACK — positive acknowledgement');
  });
});

describe('parseIec101 — fixed-length-balanced-dir-bit', () => {
  it('shows RES/DIR=1 raw without asserting which interpretation applies', () => {
    const raw = exampleBytes('fixed-length-balanced-dir-bit');
    const { frame } = expectSuccess(parseIec101(raw));
    expect(frame.valid).toBe(true);
    const resDir = fieldById(frame, 'res-dir');
    expect(resDir.rawValue).toBe(1);
    expect(resDir.physicalValue).toBeUndefined();
  });
});

describe('parseIec101 — fixed-length-unknown-function', () => {
  it('flags function code 5 (conflicting/unnamed) as a warning, frame stays valid', () => {
    const raw = exampleBytes('fixed-length-unknown-function');
    const { frame } = expectSuccess(parseIec101(raw));
    expect(frame.valid).toBe(true);
    expect(fieldById(frame, 'function-code').valid).toBe(false);
    expect(warningCodes(frame)).toContain('protocol.iec101.warning.unknownFunctionCode');
  });
});

describe('parseIec101 — fixed-length error paths', () => {
  it('fixed-length-checksum-mismatch: soft error, other fields still decode', () => {
    const raw = exampleBytes('fixed-length-checksum-mismatch');
    const { frame } = expectSuccess(parseIec101(raw));
    expect(frame.valid).toBe(false);
    expect(errorCodes(frame)).toContain('checksum-mismatch');
    expect(fieldById(frame, 'function-code').physicalValue).toBe('Reset of remote link');
  });

  it('fixed-length-stop-byte-invalid: soft error, rest still decodes', () => {
    const raw = exampleBytes('fixed-length-stop-byte-invalid');
    const { frame } = expectSuccess(parseIec101(raw));
    expect(frame.valid).toBe(false);
    expect(errorCodes(frame)).toContain('value-out-of-range');
    expect(fieldById(frame, 'checksum').valid).toBe(true);
  });

  it('rejects a fixed-length buffer shorter than Start+Control+Checksum+End(+address)', () => {
    const result = expectFailure(parseIec101(bytes('10 40 01')));
    expect(result.error.code).toBe('truncated-frame');
    expect(result.recoverable).toBe(true);
  });
});

describe('parseIec101 — variable-length-user-data (default widths, CA=2/IOA=3/COT=2)', () => {
  const raw = exampleBytes('variable-length-user-data');

  it('decodes L, the repeated start byte and the control field', () => {
    const { frame } = expectSuccess(parseIec101(raw));
    expect(frame.valid).toBe(true);
    expect(fieldById(frame, 'length').rawValue).toBe(12);
    expect(fieldById(frame, 'length').physicalValue).toBe(18);
    expect(fieldById(frame, 'second-start-byte').valid).toBe(true);
    expect(fieldById(frame, 'function-code').physicalValue).toBe('Send/confirm — user data');
  });

  it('delegates the ASDU to decodeAsdu(): M_SP_NA_1, Spontaneous, CA=1, IOA=1, SIQ SPI-on', () => {
    const { frame } = expectSuccess(parseIec101(raw));
    expect(fieldById(frame, 'type-id').physicalValue).toBe('M_SP_NA_1 — Single-point information');
    expect(fieldById(frame, 'cause-of-transmission').physicalValue).toBe('Spontaneous');
    expect(fieldById(frame, 'common-address').rawValue).toBe(1);
    expect(fieldById(frame, 'information-object-address').rawValue).toBe(1);
    expect(fieldById(frame, 'siq-spi').rawValue).toBe(1);
    // COT genişliği 2 (varsayılan) → originator-address alanı VAR (104 ile aynı).
    expect(hasField(frame, 'originator-address')).toBe(true);
  });

  it('validates the checksum over Control+Address+ASDU (exactly L bytes)', () => {
    const { frame } = expectSuccess(parseIec101(raw));
    expect(fieldById(frame, 'checksum').valid).toBe(true);
    expect(fieldById(frame, 'checksum').physicalValue).toBe(0x5c);
  });
});

describe('parseIec101 — variable-length-secondary-response (PRM=0, same ASDU)', () => {
  it('names function code 8 (PRM=0) as "Respond — user data" and still decodes the same ASDU', () => {
    const raw = exampleBytes('variable-length-secondary-response');
    const { frame } = expectSuccess(parseIec101(raw));
    expect(frame.valid).toBe(true);
    expect(fieldById(frame, 'prm').rawValue).toBe(0);
    expect(fieldById(frame, 'function-code').physicalValue).toBe('Respond — user data');
    expect(fieldById(frame, 'type-id').physicalValue).toBe('M_SP_NA_1 — Single-point information');
  });
});

describe('parseIec101 — variable-length error paths', () => {
  it('variable-length-checksum-mismatch: soft error, ASDU still decodes', () => {
    const raw = exampleBytes('variable-length-checksum-mismatch');
    const { frame } = expectSuccess(parseIec101(raw));
    expect(frame.valid).toBe(false);
    expect(errorCodes(frame)).toContain('checksum-mismatch');
    expect(fieldById(frame, 'type-id').valid).toBe(true);
  });

  it('variable-length-copies-mismatch: soft error, first L copy used to keep decoding', () => {
    const raw = exampleBytes('variable-length-copies-mismatch');
    const { frame, consumedBytes } = expectSuccess(parseIec101(raw));
    expect(frame.valid).toBe(false);
    expect(errorCodes(frame)).toContain('length-mismatch');
    expect(consumedBytes).toBe(raw.length);
    expect(fieldById(frame, 'type-id').physicalValue).toBe('M_SP_NA_1 — Single-point information');
  });

  it('variable-length-truncated: hard ParseFailure, recoverable (wait for more bytes)', () => {
    const raw = exampleBytes('variable-length-truncated');
    const result = expectFailure(parseIec101(raw));
    expect(result.error.code).toBe('length-mismatch');
    expect(result.recoverable).toBe(true);
  });

  it('rejects a variable-length header shorter than Start+L+L+Start', () => {
    const result = expectFailure(parseIec101(bytes('68 0C 0C')));
    expect(result.error.code).toBe('truncated-frame');
    expect(result.recoverable).toBe(true);
  });
});

describe('parseIec101 — decodeOptions: narrow ASDU widths (CA=1/IOA=2/COT=1, no originator address)', () => {
  // variable-length-user-data'nın DAR genişlikli ikizi: Control=0x53, Address=1,
  // ASDU: TypeID=1,VSQ=0x01,Cause=0x03(1 bayt, originator YOK),CA(1)=1,IOA(2)=1,SIQ=SPI-on. L=9.
  const raw = bytes('68 09 09 68 53 01 01 01 03 01 01 00 01 5C 16');
  const context: ParseContext = {
    options: {
      commonAddressWidth: '1',
      informationObjectAddressWidth: '2',
      causeOfTransmissionWidth: '1',
    },
  };

  it('shapes the ASDU per the requested widths — no originator-address field', () => {
    const { frame } = expectSuccess(iec101Parser.parse(raw, context));
    expect(frame.valid).toBe(true);
    expect(fieldById(frame, 'common-address').rawValue).toBe(1);
    expect(fieldById(frame, 'information-object-address').rawValue).toBe(1);
    expect(fieldById(frame, 'siq-spi').rawValue).toBe(1);
    expect(hasField(frame, 'originator-address')).toBe(false);
  });

  it('the SAME bytes under DEFAULT widths would misalign — proves the channel actually matters', () => {
    // Aynı 15 baytlık tampon, decodeOptions VERİLMEDEN (CA=2/IOA=3/COT=2 varsayılanıyla)
    // çözülürse ASDU çok kısa kalır ve truncated-frame hatası basar — bu, genişlik
    // kanalının çerçeveden çıkarılamayan gerçek bir parametre olduğunu kanıtlar.
    const { frame } = expectSuccess(parseIec101(raw));
    expect(frame.valid).toBe(false);
    expect(errorCodes(frame)).toContain('truncated-frame');
  });
});

describe('parseIec101 — decodeOptions: link address width = 0 (no address byte)', () => {
  it('omits the link-address field and shifts checksum/end accordingly', () => {
    const raw = bytes('10 40 40 16'); // Start,Control(0x40),Checksum(sum8([0x40])=0x40),End
    const context: ParseContext = { options: { linkAddressWidth: '0' } };
    const { frame, consumedBytes } = expectSuccess(iec101Parser.parse(raw, context));
    expect(frame.valid).toBe(true);
    expect(consumedBytes).toBe(4);
    expect(hasField(frame, 'link-address')).toBe(false);
    expect(fieldById(frame, 'checksum').offset).toBe(2);
    expect(fieldById(frame, 'end-byte').offset).toBe(3);
  });
});

describe('iec101Parser.canParse', () => {
  it('accepts all three frame-class start bytes', () => {
    expect(iec101Parser.canParse(bytes('E5'))).toBe(true);
    expect(iec101Parser.canParse(bytes('10 40 01 41 16'))).toBe(true);
    expect(iec101Parser.canParse(bytes('68 0C 0C 68'))).toBe(true);
  });

  it('rejects an empty buffer and an unrecognized first byte', () => {
    expect(iec101Parser.canParse(bytes(''))).toBe(false);
    expect(iec101Parser.canParse(bytes('AA BB'))).toBe(false);
  });
});

describe('parseIec101 — malformed input', () => {
  it('rejects an empty buffer', () => {
    const result = expectFailure(parseIec101(new Uint8Array()));
    expect(result.error.code).toBe('truncated-frame');
    expect(result.recoverable).toBe(true);
  });

  it('rejects an unrecognized first byte', () => {
    const result = expectFailure(parseIec101(bytes('AA BB CC')));
    expect(result.error.code).toBe('start-delimiter-not-found');
    expect(result.recoverable).toBe(true);
  });
});

describe('iec101Plugin', () => {
  it('is registered under industrial-automation with example frames and decodeOptions', () => {
    expect(iec101Plugin.id).toBe('iec-60870-5-101');
    expect(iec101Plugin.category).toBe('industrial-automation');
    expect(iec101Plugin.exampleFrames.length).toBeGreaterThan(0);
    expect(iec101Parser.protocolId).toBe('iec-60870-5-101');
    expect(iec101Plugin.decodeOptions?.length).toBe(4);
  });
});
