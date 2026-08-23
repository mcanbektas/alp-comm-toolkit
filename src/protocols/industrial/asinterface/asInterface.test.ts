import { describe, expect, it } from 'vitest';

import {
  AS_INTERFACE_MASTER_REQUEST_BITS,
  AS_INTERFACE_MAX_SLAVE_ADDRESS,
  AS_INTERFACE_SLAVE_RESPONSE_BITS,
  ERROR_PARITY_MISMATCH,
  ERROR_START_BIT_NOT_ZERO,
  ERROR_UNSUPPORTED_LENGTH,
  WARN_ADDRESS_ZERO_IS_UNCONFIGURED,
  WARN_CALL_NOT_NAMED,
  WARN_CLASSIC_ASI_ONLY,
  WARN_END_BIT_NOT_ONE,
  WARN_PADDING_BITS_NOT_ZERO,
  WARN_RESPONSE_MEANING_NEEDS_REQUEST,
  WARN_SELECT_BIT_POLARITY_UNCONFIRMED,
  asInterfaceParser,
  asInterfacePlugin,
  parseAsInterface,
} from './asInterface';
import type {
  ParseFailure,
  ParseResult,
  ParseSuccess,
  ParsedField,
  ParsedFrame,
} from '@/protocol-core/types';

function expectSuccess(result: ParseResult): ParseSuccess {
  if (!result.success) {
    throw new Error(`expected success, got failure ${result.error.code}: ${result.error.message}`);
  }
  return result;
}

function expectFailure(result: ParseResult): ParseFailure {
  if (result.success) throw new Error('expected failure, got success');
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

function exampleBytes(id: string): Uint8Array {
  const example = asInterfacePlugin.exampleFrames.find((candidate) => candidate.id === id);
  if (example === undefined) throw new Error(`example "${id}" not found`);
  return example.bytes;
}

function decodeExample(id: string): ParsedFrame {
  return expectSuccess(parseAsInterface(exampleBytes(id))).frame;
}

function countOnes(value: number): number {
  let count = 0;
  let remaining = value;
  while (remaining !== 0) {
    count += remaining & 1;
    remaining >>>= 1;
  }
  return count;
}

/** Testin KENDİ, parser'dan bağımsız çerçeve kurucusu (parite hesaplanır). */
function buildMasterRequest(
  controlBit: number,
  slaveAddress: number,
  informationField: number,
): Uint8Array {
  const withoutParity = (controlBit << 11) | (slaveAddress << 6) | (informationField << 1);
  const parityBit = countOnes(withoutParity) % 2 === 0 ? 0 : 1;
  const value =
    (controlBit << 12) | (slaveAddress << 7) | (informationField << 2) | (parityBit << 1) | 1;
  return Uint8Array.from([(value >>> 8) & 0xff, value & 0xff]);
}

describe('asInterfaceParser', () => {
  it('exposes the catalog protocol id and the documented frame widths', () => {
    expect(asInterfaceParser.protocolId).toBe('as-interface');
    expect(asInterfacePlugin.id).toBe('as-interface');
    expect(asInterfacePlugin.category).toBe('industrial-automation');
    expect(AS_INTERFACE_MASTER_REQUEST_BITS).toBe(14);
    expect(AS_INTERFACE_SLAVE_RESPONSE_BITS).toBe(7);
    expect(AS_INTERFACE_MAX_SLAVE_ADDRESS).toBe(31);
  });

  it('pre-accepts only 1- and 2-byte inputs whose start bit is zero', () => {
    expect(asInterfaceParser.canParse(buildMasterRequest(0, 5, 0b01010))).toBe(true);
    expect(asInterfaceParser.canParse(Uint8Array.from([0b0_0011_0_1]))).toBe(true);
    // Master çerçevesinde ST=1 (bit 13) → ön eleme reddeder.
    expect(asInterfaceParser.canParse(Uint8Array.from([0x20, 0x00]))).toBe(false);
    expect(asInterfaceParser.canParse(Uint8Array.from([0x00, 0x00, 0x00]))).toBe(false);
  });

  it('says on every decode that only classic AS-i is covered, not ASi-5', () => {
    expect(warningCodes(decodeExample('data-exchange-request'))).toContain(WARN_CLASSIC_ASI_ONLY);
    expect(warningCodes(decodeExample('data-exchange-response'))).toContain(WARN_CLASSIC_ASI_ONLY);
  });
});

describe('AS-i master call', () => {
  it('decodes every bit of a data call', () => {
    const parsed = decodeExample('data-exchange-request');

    expect(fieldById(parsed, 'start-bit').rawValue).toBe(0);
    expect(fieldById(parsed, 'control-bit').physicalValue).toBe('Data / parameter transfer');
    expect(fieldById(parsed, 'slave-address').rawValue).toBe(5);
    expect(fieldById(parsed, 'information-field').physicalValue).toBe('0b01010');
    expect(fieldById(parsed, 'output-data').physicalValue).toBe('0b1010');
    expect(fieldById(parsed, 'end-bit').rawValue).toBe(1);
    expect(parsed.valid).toBe(true);
    expect(parsed.errors).toEqual([]);
  });

  it('shows the I3 select bit but claims nothing about A/B slaves', () => {
    const parsed = decodeExample('data-exchange-request');
    const select = fieldById(parsed, 'select-bit');
    expect(select.warnings).toContain(WARN_SELECT_BIT_POLARITY_UNCONFIRMED);
    expect(String(select.physicalValue)).not.toContain('A-slave');
    expect(String(select.physicalValue)).not.toContain('B-slave');
    expect(warningCodes(parsed)).toContain(WARN_SELECT_BIT_POLARITY_UNCONFIRMED);
  });

  it('separates a parameter call from a data call through I4', () => {
    const parsed = decodeExample('write-parameter-request');
    expect(fieldById(parsed, 'slave-address').rawValue).toBe(12);
    expect(fieldById(parsed, 'parameter-data').physicalValue).toBe('0b0110');
    expect(hasField(parsed, 'output-data')).toBe(false);
  });

  it('reads the information field as a new address when the slave address is zero', () => {
    const parsed = decodeExample('address-assignment');
    expect(fieldById(parsed, 'slave-address').physicalValue).toBe('0 (unconfigured slave)');
    expect(fieldById(parsed, 'new-slave-address').rawValue).toBe(7);
    expect(warningCodes(parsed)).toContain(WARN_ADDRESS_ZERO_IS_UNCONFIGURED);
    expect(hasField(parsed, 'output-data')).toBe(false);
  });

  it('names every command the source table lists', () => {
    const CASES: ReadonlyArray<{ id: string; command: string }> = [
      { id: 'read-io-configuration', command: 'Read I/O Configuration' },
      { id: 'read-id-code', command: 'Read ID Code' },
      { id: 'reset-slave', command: 'Reset Slave' },
      { id: 'read-status', command: 'Read Status' },
      { id: 'delete-address', command: 'Delete Address' },
      { id: 'broadcast-reset', command: 'Broadcast (Reset)' },
    ];
    for (const testCase of CASES) {
      const parsed = decodeExample(testCase.id);
      expect(fieldById(parsed, 'command').physicalValue, testCase.id).toBe(testCase.command);
      expect(warningCodes(parsed), testCase.id).not.toContain(WARN_CALL_NOT_NAMED);
    }
  });

  it('reads Read ID Code_1 and Read ID Code_2 from the low information bits', () => {
    const rid1 = expectSuccess(parseAsInterface(buildMasterRequest(1, 3, 0b10010))).frame;
    expect(fieldById(rid1, 'command').physicalValue).toBe('Read ID Code_1');
    const rid2 = expectSuccess(parseAsInterface(buildMasterRequest(1, 3, 0b10011))).frame;
    expect(fieldById(rid2, 'command').physicalValue).toBe('Read ID Code_2');
  });

  it('turns the Delete Address code into Write Extended ID Code_1 at address zero', () => {
    const parsed = expectSuccess(parseAsInterface(buildMasterRequest(1, 0, 0b00101))).frame;
    expect(fieldById(parsed, 'command').physicalValue).toBe('Write Extended ID Code_1');
    expect(fieldById(parsed, 'extended-id-code-1').physicalValue).toBe('0b0101');
  });

  it('recognises Enter Program Mode only at address zero', () => {
    const prgm = expectSuccess(parseAsInterface(buildMasterRequest(1, 0, 0b11101))).frame;
    expect(fieldById(prgm, 'command').physicalValue).toBe('Enter Program Mode');
    // Aynı bilgi alanı başka bir adreste adlandırılmaz — UYDURULMAZ.
    const elsewhere = expectSuccess(parseAsInterface(buildMasterRequest(1, 7, 0b11101))).frame;
    expect(warningCodes(elsewhere)).toContain(WARN_CALL_NOT_NAMED);
  });

  it('does not invent a name for a reserved information field', () => {
    const parsed = decodeExample('unnamed-command');
    expect(warningCodes(parsed)).toContain(WARN_CALL_NOT_NAMED);
    expect(fieldById(parsed, 'command').physicalValue).toBe('0b10111');
    expect(fieldById(parsed, 'command').valid).toBe(false);
  });
});

describe('AS-i even parity', () => {
  it('accepts every generated frame across the whole address and information space', () => {
    for (let address = 0; address <= AS_INTERFACE_MAX_SLAVE_ADDRESS; address += 1) {
      for (let information = 0; information < 32; information += 1) {
        for (const controlBit of [0, 1]) {
          const parsed = expectSuccess(
            parseAsInterface(buildMasterRequest(controlBit, address, information)),
          ).frame;
          expect(
            parsed.errors,
            `CB=${controlBit} addr=${address} info=${information}`,
          ).toEqual([]);
        }
      }
    }
  });

  it('raises a frame error when the parity bit is flipped', () => {
    const parsed = decodeExample('parity-error');
    expect(parsed.valid).toBe(false);
    expect(parsed.errors[0]?.code).toBe('checksum-mismatch');
    expect(parsed.errors[0]?.message).toBe(ERROR_PARITY_MISMATCH);
    expect(fieldById(parsed, 'parity-bit').valid).toBe(false);
  });

  it('checks the slave response parity over its own four data bits', () => {
    const good = expectSuccess(parseAsInterface(exampleBytes('data-exchange-response'))).frame;
    expect(good.errors).toEqual([]);
    // Parite bitini ters çevir: 0b0000_0010 XOR.
    const flipped = Uint8Array.from([(exampleBytes('data-exchange-response')[0] ?? 0) ^ 0b10]);
    const bad = expectSuccess(parseAsInterface(flipped)).frame;
    expect(bad.errors[0]?.code).toBe('checksum-mismatch');
  });
});

describe('AS-i slave response', () => {
  it('decodes the four information bits but refuses to name their meaning', () => {
    const parsed = decodeExample('data-exchange-response');
    expect(fieldById(parsed, 'response-data').physicalValue).toBe('0b0011');
    expect(fieldById(parsed, 'response-data').warnings).toContain(
      WARN_RESPONSE_MEANING_NEEDS_REQUEST,
    );
    expect(fieldById(parsed, 'end-bit').rawValue).toBe(1);
    expect(hasField(parsed, 'slave-address')).toBe(false);
  });

  it('warns when the padding bit of the byte is not zero', () => {
    const parsed = expectSuccess(
      parseAsInterface(Uint8Array.from([(exampleBytes('data-exchange-response')[0] ?? 0) | 0x80])),
    ).frame;
    expect(warningCodes(parsed)).toContain(WARN_PADDING_BITS_NOT_ZERO);
  });
});

describe('AS-i failure and boundary paths', () => {
  it('rejects a start bit of one', () => {
    const parsed = decodeExample('start-bit-error');
    expect(parsed.valid).toBe(false);
    expect(parsed.errors[0]?.code).toBe('start-delimiter-not-found');
    expect(parsed.errors[0]?.message).toBe(ERROR_START_BIT_NOT_ZERO);
  });

  it('treats a missing end bit as a warning, not an error', () => {
    const parsed = decodeExample('end-bit-error');
    expect(parsed.valid).toBe(true);
    expect(warningCodes(parsed)).toContain(WARN_END_BIT_NOT_ONE);
    expect(fieldById(parsed, 'end-bit').valid).toBe(false);
  });

  it('fails outright on a length outside the 1/2 byte contract', () => {
    const failure = expectFailure(parseAsInterface(Uint8Array.from([0x00, 0x00, 0x00])));
    expect(failure.error.code).toBe('length-mismatch');
    expect(failure.error.message).toBe(ERROR_UNSUPPORTED_LENGTH);
    expect(failure.recoverable).toBe(true);
    expect(expectFailure(parseAsInterface(Uint8Array.from([]))).error.code).toBe('length-mismatch');
  });

  it('rejects an oversized input through the parse context', () => {
    const failure = expectFailure(
      asInterfaceParser.parse(buildMasterRequest(0, 5, 0b01010), { maxFrameLength: 1 }),
    );
    expect(failure.error.code).toBe('frame-too-long');
  });

  it('honours an aborted signal', () => {
    const controller = new AbortController();
    controller.abort();
    const failure = expectFailure(
      asInterfaceParser.parse(buildMasterRequest(0, 5, 0b01010), { signal: controller.signal }),
    );
    expect(failure.error.code).toBe('parser-timeout');
  });
});

describe('AS-i example frames', () => {
  it('every example matches its declared validity and consumes the whole input', () => {
    for (const example of asInterfacePlugin.exampleFrames) {
      const result = parseAsInterface(example.bytes);
      const parsed = expectSuccess(result).frame;
      expect(parsed.valid, `${example.id} validity`).toBe(example.expectedValid);
      expect(result.consumedBytes, example.id).toBe(example.bytes.length);
    }
  });

  it('covers both frame directions and has unique ids', () => {
    const ids = asInterfacePlugin.exampleFrames.map((example) => example.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(asInterfacePlugin.exampleFrames.some((example) => example.bytes.length === 1)).toBe(true);
    expect(asInterfacePlugin.exampleFrames.some((example) => example.bytes.length === 2)).toBe(true);
  });
});
