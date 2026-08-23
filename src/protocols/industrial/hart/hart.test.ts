import { describe, expect, it } from 'vitest';

import { xor8Checksum } from '@/protocol-core/checksums/simpleChecksums';
import {
  ERROR_CHECKSUM_MISMATCH,
  ERROR_DELIMITER_UNKNOWN,
  ERROR_FRAME_TRUNCATED,
  ERROR_NO_DELIMITER_FOUND,
  WARN_BURST_STATUS_LAYOUT_INFERRED,
  WARN_COMMAND_NOT_NAMED,
  WARN_COMMAND_RANGE_RESERVED,
  WARN_DATA_IS_COMMAND_SPECIFIC,
  WARN_RESPONSE_CODE_NOT_NAMED,
  WARN_TRAILING_BYTES,
  hartParser,
  hartPlugin,
  parseHart,
} from './hart';
import type { ParseFailure, ParseResult, ParseSuccess, ParsedField, ParsedFrame } from '@/protocol-core/types';

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
  const example = hartPlugin.exampleFrames.find((candidate) => candidate.id === id);
  if (example === undefined) throw new Error(`example "${id}" not found`);
  return example.bytes;
}

function decodeExample(id: string): ParsedFrame {
  return expectSuccess(parseHart(exampleBytes(id))).frame;
}

describe('hartParser', () => {
  it('exposes the catalog protocol id and category', () => {
    expect(hartParser.protocolId).toBe('hart');
    expect(hartPlugin.id).toBe('hart');
    expect(hartPlugin.category).toBe('industrial-automation');
  });

  it('pre-accepts frames with a recognised delimiter and a full envelope after the preamble', () => {
    expect(hartParser.canParse(exampleBytes('short-request-read-unique-identifier'))).toBe(true);
    expect(hartParser.canParse(exampleBytes('long-request-secondary-master'))).toBe(true);
    // 0xFF tekrarından sonra tanınmayan bir bayt.
    expect(hartParser.canParse(Uint8Array.from([0xff, 0xff, 0x55, 0x00]))).toBe(false);
    // Hiç veri yok.
    expect(hartParser.canParse(Uint8Array.from([]))).toBe(false);
    // Sadece preamble, sınırlayıcıya hiç ulaşılmıyor.
    expect(hartParser.canParse(Uint8Array.from([0xff, 0xff, 0xff]))).toBe(false);
    // Tanınan sınırlayıcı ama asgari zarf boyu yok (kısa istek: delim+addr+cmd+bytecount = 4 bayt ister).
    expect(hartParser.canParse(Uint8Array.from([0xff, 0x02, 0x00]))).toBe(false);
  });
});

describe('HART checksum — dosya başında kaynak gösterilen üç vektör', () => {
  // jszumigaj/hart `frame_test.go`daki GERÇEK birim-test vektörleri; burada
  // xor8Checksum ile bağımsız olarak yeniden hesaplanıp doğrulanıyor.
  it('matches the checksum of TestShortHartFrame (delim 0x02, addr 0, cmd 0) — 0x02', () => {
    expect(xor8Checksum(Uint8Array.from([0x02, 0x00, 0x00, 0x00]))).toBe(0x02);
    const parsed = decodeExample('short-request-read-unique-identifier');
    expect(fieldById(parsed, 'checksum').rawValue).toBe(0x02);
    expect(parsed.valid).toBe(true);
  });

  it('matches the checksum of TestShortReplyHartFrame (delim 0x06, addr 0, cmd 0, status 00 40, 12-byte data) — 0xA3', () => {
    const body = [
      0x06, 0x00, 0x00, 0x0e, 0x00, 0x40, 0xfe, 0xbc, 0x7b, 0x05, 0x05, 0x03, 0x02, 0x10, 0x01, 0x12, 0x31, 0xe1,
    ];
    expect(xor8Checksum(Uint8Array.from(body))).toBe(0xa3);
    const parsed = decodeExample('short-response-read-unique-identifier');
    expect(fieldById(parsed, 'checksum').rawValue).toBe(0xa3);
    expect(parsed.valid).toBe(true);
  });

  it('matches the checksum of TestLongHartFrame (delim 0x82, addr 3C 7B 12 31 E1, cmd 0) — 0x07', () => {
    expect(xor8Checksum(Uint8Array.from([0x82, 0x3c, 0x7b, 0x12, 0x31, 0xe1, 0x00, 0x00]))).toBe(0x07);
    const parsed = decodeExample('long-request-secondary-master');
    expect(fieldById(parsed, 'checksum').rawValue).toBe(0x07);
    expect(parsed.valid).toBe(true);
  });

  it('the checksum excludes the preamble and does not cover itself', () => {
    // Aynı gövde farklı preamble sayısıyla: checksum DEĞİŞMEMELİ.
    const short = decodeExample('short-request-read-unique-identifier');
    const withMorePreamble = expectSuccess(
      parseHart(Uint8Array.from([0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0x02, 0x00, 0x00, 0x00, 0x02])),
    ).frame;
    expect(withMorePreamble.valid).toBe(true);
    expect(fieldById(withMorePreamble, 'checksum').rawValue).toBe(fieldById(short, 'checksum').rawValue);
  });
});

describe('HART preamble and start delimiter', () => {
  it('shows the preamble as its own field when present', () => {
    const parsed = decodeExample('short-request-read-unique-identifier');
    expect(fieldById(parsed, 'preamble').rawValue).toBe(5);
  });

  it('decodes all six delimiter values to the right direction/form/kind', () => {
    const request = decodeExample('short-request-read-unique-identifier');
    expect(fieldById(request, 'start-delimiter').physicalValue).toContain('Master → Slave');
    expect(fieldById(request, 'start-delimiter').physicalValue).toContain('Short frame');

    const longRequest = decodeExample('long-request-secondary-master');
    expect(fieldById(longRequest, 'start-delimiter').physicalValue).toContain('Long frame');

    const response = decodeExample('short-response-read-unique-identifier');
    expect(fieldById(response, 'start-delimiter').physicalValue).toContain('Slave → Master');
    expect(fieldById(response, 'start-delimiter').physicalValue).toContain('Response');

    const burst = decodeExample('burst-frame');
    expect(fieldById(burst, 'start-delimiter').physicalValue).toContain('Burst');
  });

  it('rejects the "0 = long / 8 = short" claim: 0x82 decodes as long, 0x02 as short', () => {
    // Dosya başında REDDEDİLEN iddianın tersini elle sınıyor.
    const shortAddr = decodeExample('short-request-read-unique-identifier');
    expect(hasField(shortAddr, 'address-manufacturer-id')).toBe(false);
    expect(fieldById(shortAddr, 'address').id).toBe('address');

    const longAddr = decodeExample('long-request-secondary-master');
    expect(hasField(longAddr, 'address-manufacturer-id')).toBe(true);
    expect(fieldById(longAddr, 'address-device-id').length).toBe(3);
  });

  it('fails with a recoverable error when no delimiter is ever reached', () => {
    const failure = expectFailure(parseHart(exampleBytes('no-delimiter-found')));
    expect(failure.error.code).toBe('truncated-frame');
    expect(failure.error.message).toBe(ERROR_NO_DELIMITER_FOUND);
    expect(failure.recoverable).toBe(true);
  });

  it('fails with a recoverable error on an unrecognised delimiter byte', () => {
    const failure = expectFailure(parseHart(exampleBytes('unknown-start-delimiter')));
    expect(failure.error.code).toBe('start-delimiter-not-found');
    expect(failure.error.message).toBe(ERROR_DELIMITER_UNKNOWN);
    expect(failure.recoverable).toBe(true);
  });
});

describe('HART address', () => {
  it('splits the short address into master type and a numeric polling address', () => {
    const parsed = decodeExample('long-request-primary-master-write-polling-address');
    // Bu örnek UZUN adresli; kısa adresi ayrıca kur.
    const shortFrame = expectSuccess(parseHart(Uint8Array.from([0x02, 0x85, 0x00, 0x00, 0x87]))).frame;
    expect(fieldById(shortFrame, 'address-master-type').physicalValue).toBe('Primary master');
    expect(fieldById(shortFrame, 'address').rawValue).toBe(5);
    void parsed;
  });

  it('marks bit 7 clear as secondary master and set as primary master on long addresses', () => {
    const secondary = decodeExample('long-request-secondary-master');
    expect(fieldById(secondary, 'address-master-type').physicalValue).toBe('Secondary master');

    const primary = decodeExample('long-request-primary-master-write-polling-address');
    expect(fieldById(primary, 'address-master-type').physicalValue).toBe('Primary master');
    // Aynı alt 7 bit (manufacturer id) korunmalı: yalnız bit 7 farklı.
    expect(fieldById(primary, 'address-manufacturer-id').rawValue).toBe(
      fieldById(secondary, 'address-manufacturer-id').rawValue,
    );
  });

  it('splits the long address into manufacturer id, device type and a 24-bit device id', () => {
    const parsed = decodeExample('long-request-secondary-master');
    expect(fieldById(parsed, 'address-manufacturer-id').rawValue).toBe(0x3c);
    expect(fieldById(parsed, 'address-device-type').rawValue).toBe(0x7b);
    expect(fieldById(parsed, 'address-device-id').rawValue).toBe((0x12 << 16) | (0x31 << 8) | 0xe1);
  });
});

describe('HART command classification', () => {
  it('names universal commands (0-30)', () => {
    const parsed = decodeExample('short-request-read-unique-identifier');
    expect(fieldById(parsed, 'command').physicalValue).toBe('Read Unique Identifier');
    expect(fieldById(parsed, 'command-class').physicalValue).toBe('Universal');
    expect(warningCodes(parsed)).not.toContain(WARN_COMMAND_NOT_NAMED);
  });

  it('names common practice commands (32-126)', () => {
    const parsed = decodeExample('common-practice-command');
    expect(fieldById(parsed, 'command').physicalValue).toBe('Reset Configuration Changed Flag');
    expect(fieldById(parsed, 'command-class').physicalValue).toBe('Common Practice');
  });

  it('shows the class but does not invent a name for an unnamed device-specific command', () => {
    const parsed = decodeExample('device-specific-command');
    expect(fieldById(parsed, 'command-class').physicalValue).toBe('Device-Specific');
    expect(fieldById(parsed, 'command').physicalValue).toBe('0xC8');
    expect(fieldById(parsed, 'command').valid).toBe(false);
    expect(warningCodes(parsed)).toContain(WARN_COMMAND_NOT_NAMED);
  });

  it('flags a command number that falls in none of the three ranges as reserved', () => {
    const parsed = decodeExample('reserved-command-range');
    expect(fieldById(parsed, 'command-class').physicalValue).toBe('Reserved / undefined range');
    expect(fieldById(parsed, 'command-class').valid).toBe(false);
    expect(warningCodes(parsed)).toContain(WARN_COMMAND_RANGE_RESERVED);
    // Sınıf bile yoksa "adlandırılmamış komut" uyarısı AYRICA basılmaz — tek uyarı yeter.
    expect(warningCodes(parsed)).not.toContain(WARN_COMMAND_NOT_NAMED);
  });
});

describe('HART response code and device status', () => {
  it('reads communication error flags when bit 7 of the response code is set', () => {
    const parsed = decodeExample('communications-error-response');
    const field = fieldById(parsed, 'response-code');
    expect(field.name).toContain('Communication error flags');
    expect(field.physicalValue).toBe('Longitudinal parity error');
    expect(field.rawValue).toBe(0x08);
  });

  it('reads command-specific status when bit 7 of the response code is clear', () => {
    const parsed = decodeExample('command-not-implemented-response');
    const field = fieldById(parsed, 'response-code');
    expect(field.name).toContain('Command-specific status');
    expect(field.physicalValue).toBe('Command not implemented');
    expect(warningCodes(parsed)).not.toContain(WARN_RESPONSE_CODE_NOT_NAMED);
  });

  it('warns when a command-specific status byte has no name in the table', () => {
    const parsed = expectSuccess(
      parseHart(Uint8Array.from([0x06, 0x00, 0x00, 0x02, 0x01, 0x00, 0x03])),
    ).frame;
    expect(warningCodes(parsed)).toContain(WARN_RESPONSE_CODE_NOT_NAMED);
    expect(fieldById(parsed, 'response-code').valid).toBe(false);
  });

  it('decodes multiple device status flags together', () => {
    const parsed = decodeExample('device-malfunction-status');
    const status = fieldById(parsed, 'device-status');
    expect(status.rawValue).toBe(0x81);
    expect(status.physicalValue).toContain('Device malfunction');
    expect(status.physicalValue).toContain('Primary variable out of limits');
  });

  it('shows the configuration-changed flag by name and OK when every bit is clear', () => {
    const changed = decodeExample('short-response-read-unique-identifier');
    expect(fieldById(changed, 'device-status').rawValue).toBe(0x40);
    expect(fieldById(changed, 'device-status').physicalValue).toBe('Configuration changed');

    // delim 0x06, addr 0, cmd 0, byteCount 2 (yalnız status, veri yok), status 00 00.
    const okBytes = Uint8Array.from([0x06, 0x00, 0x00, 0x02, 0x00, 0x00, 0x04]);
    expect(xor8Checksum(okBytes.slice(0, 6))).toBe(0x04);
    const ok = expectSuccess(parseHart(okBytes)).frame;
    expect(fieldById(ok, 'device-status').physicalValue).toBe('OK');
    expect(ok.valid).toBe(true);
  });

  it('does not attach status bytes or their warnings to a request frame', () => {
    const parsed = decodeExample('short-request-read-unique-identifier');
    expect(hasField(parsed, 'response-code')).toBe(false);
    expect(hasField(parsed, 'device-status')).toBe(false);
  });

  it('infers the burst frame status layout from the response frame and says so', () => {
    const parsed = decodeExample('burst-frame');
    expect(hasField(parsed, 'response-code')).toBe(true);
    expect(hasField(parsed, 'device-status')).toBe(true);
    expect(warningCodes(parsed)).toContain(WARN_BURST_STATUS_LAYOUT_INFERRED);
  });
});

describe('HART data and trailing bytes', () => {
  it('leaves command data raw with a command-specific warning', () => {
    const parsed = decodeExample('long-response-loop-current');
    const data = fieldById(parsed, 'data');
    expect(data.length).toBe(8);
    expect(data.warnings).toContain(WARN_DATA_IS_COMMAND_SPECIFIC);
    expect(warningCodes(parsed)).toContain(WARN_DATA_IS_COMMAND_SPECIFIC);
  });

  it('omits the data field entirely when byte count is zero', () => {
    const parsed = decodeExample('short-request-read-unique-identifier');
    expect(hasField(parsed, 'data')).toBe(false);
    expect(warningCodes(parsed)).not.toContain(WARN_DATA_IS_COMMAND_SPECIFIC);
  });

  it('warns about bytes found after the checksum', () => {
    const parsed = decodeExample('trailing-bytes');
    expect(warningCodes(parsed)).toContain(WARN_TRAILING_BYTES);
    const trailing = parsed.fields.find((field) => field.id.startsWith('trailing-'));
    expect(trailing?.length).toBe(2);
  });
});

describe('HART truncated and malformed frames', () => {
  it('raises a checksum-mismatch frame error without crashing when the checksum is wrong', () => {
    const parsed = decodeExample('checksum-mismatch');
    expect(parsed.valid).toBe(false);
    expect(parsed.errors[0]?.code).toBe('checksum-mismatch');
    expect(parsed.errors[0]?.message).toBe(ERROR_CHECKSUM_MISMATCH);
    expect(fieldById(parsed, 'checksum').valid).toBe(false);
  });

  it('shows the remaining bytes raw and records an error when Byte Count promises more than is available', () => {
    const parsed = decodeExample('frame-truncated');
    expect(parsed.valid).toBe(false);
    expect(parsed.errors[0]?.code).toBe('truncated-frame');
    expect(parsed.errors[0]?.message).toBe(ERROR_FRAME_TRUNCATED);
    expect(hasField(parsed, 'unparsed')).toBe(true);
    // Uzunluk güvenilmez: checksum/data alanları UYDURULMAZ.
    expect(hasField(parsed, 'checksum')).toBe(false);
  });

  it('fails outright when there are not even enough bytes for the fixed envelope', () => {
    const failure = expectFailure(hartParser.parse(Uint8Array.from([0xff, 0xff, 0xff, 0xff, 0xff, 0x02, 0x00])));
    expect(failure.error.code).toBe('truncated-frame');
    expect(failure.recoverable).toBe(true);
  });

  it('fails on an empty buffer', () => {
    const failure = expectFailure(parseHart(Uint8Array.from([])));
    expect(failure.error.code).toBe('truncated-frame');
  });

  it('rejects an oversized input through the parse context', () => {
    const failure = expectFailure(
      hartParser.parse(exampleBytes('short-request-read-unique-identifier'), { maxFrameLength: 3 }),
    );
    expect(failure.error.code).toBe('frame-too-long');
  });

  it('honours an aborted signal', () => {
    const controller = new AbortController();
    controller.abort();
    const failure = expectFailure(
      hartParser.parse(exampleBytes('short-request-read-unique-identifier'), { signal: controller.signal }),
    );
    expect(failure.error.code).toBe('parser-timeout');
  });
});

describe('HART example frames', () => {
  it('every example matches its declared validity and consumes the whole input', () => {
    // unknown-start-delimiter / no-delimiter-found gibi örnekler GERÇEK bir
    // ParseFailure döner (success:false) — profibusDp.test.ts'in aynı deseni:
    // beklenen geçersizlik zaten hard-failure ile karşılandıysa döngüde atla.
    for (const example of hartPlugin.exampleFrames) {
      const result = parseHart(example.bytes);
      if (!example.expectedValid && !result.success) continue;
      const parsed = expectSuccess(result).frame;
      expect(parsed.valid, `${example.id} validity`).toBe(example.expectedValid);
      expect(result.consumedBytes, example.id).toBe(example.bytes.length);
    }
  });

  it('has unique ids and covers every message kind', () => {
    const ids = hartPlugin.exampleFrames.map((example) => example.id);
    expect(new Set(ids).size).toBe(ids.length);

    const kinds = new Set<string>();
    for (const example of hartPlugin.exampleFrames) {
      const result = parseHart(example.bytes);
      if (!result.success) continue;
      const metadata = result.frame.rawFrame.metadata as { messageKind?: string } | undefined;
      if (metadata?.messageKind !== undefined) kinds.add(metadata.messageKind);
    }
    expect(kinds).toEqual(new Set(['request', 'response', 'burst']));
  });
});
