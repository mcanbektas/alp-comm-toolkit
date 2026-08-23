import { describe, expect, it } from 'vitest';

import {
  ERROR_MESSAGE_LENGTH_MISMATCH,
  WARN_BODY_RAW,
  WARN_H1_NOT_DECODED,
  WARN_LAYOUT_SINGLE_SOURCE,
  WARN_RESERVED_OPTION_SET,
  WARN_SERVICE_NOT_NAMED,
  WARN_TRAILING_BYTES,
  foundationFieldbusParser,
  foundationFieldbusPlugin,
  parseFoundationFieldbus,
} from './foundationFieldbus';
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
  const example = foundationFieldbusPlugin.exampleFrames.find((candidate) => candidate.id === id);
  if (example === undefined) throw new Error(`example "${id}" not found`);
  return example.bytes;
}

function decodeExample(id: string): ParsedFrame {
  return expectSuccess(parseFoundationFieldbus(exampleBytes(id))).frame;
}

function uint32Be(value: number): number[] {
  return [(value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff];
}

/** Testin KENDİ, parser'dan bağımsız mesaj kurucusu. */
function buildMessage(init: {
  options: number;
  protocolId: number;
  messageType: number;
  confirmed: boolean;
  serviceId: number;
  body?: readonly number[];
  trailer?: readonly number[];
}): Uint8Array {
  const body = init.body ?? [];
  const trailer = init.trailer ?? [];
  const protocolByte = ((init.protocolId << 2) & 0xfc) | (init.messageType & 0x03);
  const serviceByte = (init.confirmed ? 0x80 : 0x00) | (init.serviceId & 0x7f);
  const total = 12 + body.length + trailer.length;
  return Uint8Array.from([
    1,
    init.options,
    protocolByte,
    serviceByte,
    ...uint32Be(0x11223344),
    ...uint32Be(total),
    ...body,
    ...trailer,
  ]);
}

describe('foundationFieldbusParser', () => {
  it('exposes the catalog protocol id', () => {
    expect(foundationFieldbusParser.protocolId).toBe('foundation-fieldbus');
    expect(foundationFieldbusPlugin.id).toBe('foundation-fieldbus');
    expect(foundationFieldbusPlugin.category).toBe('industrial-automation');
  });

  it('pre-accepts only inputs whose declared message length matches the input', () => {
    expect(
      foundationFieldbusParser.canParse(
        buildMessage({ options: 0, protocolId: 2, messageType: 0, confirmed: true, serviceId: 3 }),
      ),
    ).toBe(true);
    expect(foundationFieldbusParser.canParse(Uint8Array.from(new Array<number>(12).fill(0)))).toBe(
      false,
    );
    expect(foundationFieldbusParser.canParse(Uint8Array.from([0x01, 0x00]))).toBe(false);
  });

  it('always says the layout is single-sourced and that H1 is not decoded', () => {
    const parsed = decodeExample('fda-open-session-request');
    expect(warningCodes(parsed)).toContain(WARN_LAYOUT_SINGLE_SOURCE);
    expect(warningCodes(parsed)).toContain(WARN_H1_NOT_DECODED);
  });
});

describe('FDA message header', () => {
  it('decodes every field of a session-open request', () => {
    const parsed = decodeExample('fda-open-session-request');

    expect(fieldById(parsed, 'fda-version').rawValue).toBe(1);
    expect(fieldById(parsed, 'protocol-id').physicalValue).toBe('FDA Session Management');
    expect(fieldById(parsed, 'message-type').physicalValue).toBe('Request Message');
    expect(fieldById(parsed, 'service-confirmed-flag').physicalValue).toBe('Confirmed service');
    expect(fieldById(parsed, 'service-id').physicalValue).toBe('FDA Open Session');
    expect(fieldById(parsed, 'fda-address').physicalValue).toBe('0x00000001');
    expect(fieldById(parsed, 'message-length').rawValue).toBe(20);
    expect(parsed.valid).toBe(true);
  });

  it('names every sub-protocol the source table lists', () => {
    const CASES: ReadonlyArray<{ protocolId: number; expected: string }> = [
      { protocolId: 0x01, expected: 'FDA Session Management' },
      { protocolId: 0x02, expected: 'SM (System Management)' },
      { protocolId: 0x03, expected: 'FMS (Fieldbus Message Specification)' },
      { protocolId: 0x04, expected: 'LAN Redundancy' },
    ];
    for (const testCase of CASES) {
      const parsed = expectSuccess(
        parseFoundationFieldbus(
          buildMessage({
            options: 0,
            protocolId: testCase.protocolId,
            messageType: 0,
            confirmed: true,
            serviceId: 1,
          }),
        ),
      ).frame;
      expect(fieldById(parsed, 'protocol-id').physicalValue, testCase.expected).toBe(
        testCase.expected,
      );
    }
  });

  it('resolves the service name from protocol id plus confirmed flag', () => {
    const confirmed = expectSuccess(
      parseFoundationFieldbus(
        buildMessage({ options: 0, protocolId: 3, messageType: 0, confirmed: true, serviceId: 2 }),
      ),
    ).frame;
    expect(fieldById(confirmed, 'service-id').physicalValue).toBe('FMS Read');

    // AYNI servis kimliği, onaysız tabloda BAŞKA bir servistir.
    const unconfirmed = expectSuccess(
      parseFoundationFieldbus(
        buildMessage({ options: 0, protocolId: 3, messageType: 0, confirmed: false, serviceId: 2 }),
      ),
    ).frame;
    expect(fieldById(unconfirmed, 'service-id').physicalValue).toBe('FMS Event Notification');
  });

  it('does not invent a service name that is missing from the table', () => {
    const parsed = decodeExample('unnamed-service');
    expect(warningCodes(parsed)).toContain(WARN_SERVICE_NOT_NAMED);
    expect(fieldById(parsed, 'service-id').valid).toBe(false);
    expect(fieldById(parsed, 'service-id').physicalValue).toBe('0x7E');
  });

  it('flags the reserved option bit', () => {
    const parsed = decodeExample('reserved-option-set');
    expect(warningCodes(parsed)).toContain(WARN_RESERVED_OPTION_SET);
    expect(fieldById(parsed, 'option-reserved').valid).toBe(false);
  });

  it('names the pad-length values the source table gives', () => {
    const padded = expectSuccess(
      parseFoundationFieldbus(
        buildMessage({
          options: 0x07,
          protocolId: 2,
          messageType: 0,
          confirmed: true,
          serviceId: 3,
        }),
      ),
    ).frame;
    expect(fieldById(padded, 'option-pad-length').physicalValue).toBe('Pad to 8 byte boundary');
  });
});

describe('FDA trailer and body', () => {
  it('decodes the trailer from the END of the message and keeps the body raw', () => {
    const parsed = decodeExample('sm-identify-response');

    expect(fieldById(parsed, 'body-12').length).toBe(8);
    expect(fieldById(parsed, 'body-12').warnings).toContain(WARN_BODY_RAW);
    expect(fieldById(parsed, 'trailer-message-number-20').rawValue).toBe(7);
    expect(fieldById(parsed, 'trailer-invoke-id-24').rawValue).toBe(1234);
    expect(parsed.errors).toEqual([]);
  });

  it('sizes the trailer from the option flags alone', () => {
    const timeStamped = decodeExample('fms-information-report');
    expect(fieldById(timeStamped, 'trailer-time-stamp-16').length).toBe(8);
    expect(hasField(timeStamped, 'trailer-message-number-16')).toBe(false);

    const extended = decodeExample('lan-redundancy-diagnostic');
    expect(fieldById(extended, 'trailer-extended-control-16').physicalValue).toBe('0x0000ABCD');
  });

  it('produces no body field when the message is header only', () => {
    const parsed = decodeExample('header-only');
    expect(hasField(parsed, 'body-12')).toBe(false);
    expect(warningCodes(parsed)).not.toContain(WARN_BODY_RAW);
    expect(fieldById(parsed, 'message-length').rawValue).toBe(12);
  });

  it('shows bytes beyond the declared message as a raw block', () => {
    const base = buildMessage({
      options: 0,
      protocolId: 2,
      messageType: 0,
      confirmed: true,
      serviceId: 3,
      body: [0x01, 0x02, 0x03, 0x04],
    });
    // Bildirilen uzunluk 16 kalırken 4 bayt daha eklenir.
    const withExtra = Uint8Array.from([...base, 0xde, 0xad, 0xbe, 0xef]);
    const parsed = expectSuccess(parseFoundationFieldbus(withExtra)).frame;
    expect(parsed.errors[0]?.message).toBe(ERROR_MESSAGE_LENGTH_MISMATCH);
    expect(warningCodes(parsed)).toContain(WARN_TRAILING_BYTES);
  });
});

describe('FOUNDATION Fieldbus failure paths', () => {
  it('raises a frame error when the declared length does not match', () => {
    const parsed = decodeExample('message-length-mismatch');
    expect(parsed.valid).toBe(false);
    expect(parsed.errors[0]?.code).toBe('length-mismatch');
    expect(fieldById(parsed, 'message-length').valid).toBe(false);
  });

  it('fails outright when the FDA header is incomplete', () => {
    const failure = expectFailure(parseFoundationFieldbus(exampleBytes('frame-too-short')));
    expect(failure.error.code).toBe('truncated-frame');
    expect(failure.recoverable).toBe(true);
  });

  it('rejects an oversized input through the parse context', () => {
    const failure = expectFailure(
      foundationFieldbusParser.parse(exampleBytes('sm-identify-response'), { maxFrameLength: 8 }),
    );
    expect(failure.error.code).toBe('frame-too-long');
  });

  it('honours an aborted signal', () => {
    const controller = new AbortController();
    controller.abort();
    const failure = expectFailure(
      foundationFieldbusParser.parse(exampleBytes('sm-identify-response'), {
        signal: controller.signal,
      }),
    );
    expect(failure.error.code).toBe('parser-timeout');
  });
});

describe('FOUNDATION Fieldbus example frames', () => {
  it('every example matches its declared validity and consumes the whole input', () => {
    for (const example of foundationFieldbusPlugin.exampleFrames) {
      const result = parseFoundationFieldbus(example.bytes);
      if (!example.expectedValid && !result.success) continue;
      const parsed = expectSuccess(result).frame;
      expect(parsed.valid, `${example.id} validity`).toBe(example.expectedValid);
      expect(result.consumedBytes, example.id).toBe(example.bytes.length);
    }
  });

  it('covers all four sub-protocols and has unique ids', () => {
    const ids = foundationFieldbusPlugin.exampleFrames.map((example) => example.id);
    expect(new Set(ids).size).toBe(ids.length);
    const protocols = new Set<string>();
    for (const example of foundationFieldbusPlugin.exampleFrames) {
      const result = parseFoundationFieldbus(example.bytes);
      if (!result.success) continue;
      const name = result.frame.fields.find((field) => field.id === 'protocol-id')?.physicalValue;
      if (typeof name === 'string') protocols.add(name);
    }
    expect(protocols).toContain('FDA Session Management');
    expect(protocols).toContain('SM (System Management)');
    expect(protocols).toContain('FMS (Fieldbus Message Specification)');
    expect(protocols).toContain('LAN Redundancy');
  });
});
