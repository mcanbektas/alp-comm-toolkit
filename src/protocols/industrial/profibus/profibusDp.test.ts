import { describe, expect, it } from 'vitest';

import { sum8Checksum } from '@/protocol-core/checksums/simpleChecksums';
import {
  ERROR_CHECKSUM_MISMATCH,
  ERROR_END_DELIMITER_INVALID,
  ERROR_LENGTH_REPEAT_MISMATCH,
  ERROR_START_DELIMITER_UNKNOWN,
  WARN_FCV_WITHOUT_FCB_MEANING,
  WARN_SAP_NOT_NAMED,
  WARN_TRAILING_BYTES,
  WARN_USER_DATA_NEEDS_GSD,
  parseProfibusDp,
  profibusDpParser,
  profibusDpPlugin,
} from './profibusDp';
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
  const example = profibusDpPlugin.exampleFrames.find((candidate) => candidate.id === id);
  if (example === undefined) throw new Error(`example "${id}" not found`);
  return example.bytes;
}

function decodeExample(id: string): ParsedFrame {
  return expectSuccess(parseProfibusDp(exampleBytes(id))).frame;
}

/** Testin KENDİ SD1 kurucusu — parser'ın örneklerinden bağımsız. */
function sd1(destination: number, source: number, functionCode: number): Uint8Array {
  const body = [destination, source, functionCode];
  return Uint8Array.from([0x10, ...body, sum8Checksum(Uint8Array.from(body)), 0x16]);
}

function sd2(
  destination: number,
  source: number,
  functionCode: number,
  dataUnit: readonly number[],
): Uint8Array {
  const body = [destination, source, functionCode, ...dataUnit];
  return Uint8Array.from([
    0x68,
    body.length,
    body.length,
    0x68,
    ...body,
    sum8Checksum(Uint8Array.from(body)),
    0x16,
  ]);
}

describe('profibusDpParser', () => {
  it('exposes the catalog protocol id', () => {
    expect(profibusDpParser.protocolId).toBe('profibus-dp');
    expect(profibusDpPlugin.id).toBe('profibus-dp');
    expect(profibusDpPlugin.category).toBe('industrial-automation');
  });

  it('pre-accepts only the five FDL start delimiters at their minimum lengths', () => {
    expect(profibusDpParser.canParse(Uint8Array.from([0xe5]))).toBe(true);
    expect(profibusDpParser.canParse(Uint8Array.from([0xe5, 0x00]))).toBe(false);
    expect(profibusDpParser.canParse(Uint8Array.from([0xdc, 0x03, 0x02]))).toBe(true);
    expect(profibusDpParser.canParse(Uint8Array.from([0xdc, 0x03]))).toBe(false);
    expect(profibusDpParser.canParse(sd1(0x22, 0x02, 0x49))).toBe(true);
    expect(profibusDpParser.canParse(Uint8Array.from([0x55, 0x00, 0x00, 0x00, 0x00, 0x00]))).toBe(
      false,
    );
  });
});

describe('PROFIBUS FDL telegram classes', () => {
  it('decodes the SD1 vector taken from an independent stack unit test', () => {
    // 10 22 02 49 6D 16 — profirust'ın kendi testindeki telgraf.
    expect(Array.from(exampleBytes('sd1-fdl-status-request'))).toEqual([
      0x10, 0x22, 0x02, 0x49, 0x6d, 0x16,
    ]);
    const parsed = decodeExample('sd1-fdl-status-request');
    expect(fieldById(parsed, 'destination-address').rawValue).toBe(0x22);
    expect(fieldById(parsed, 'source-address').rawValue).toBe(0x02);
    expect(fieldById(parsed, 'fc-function-3').physicalValue).toBe('Request FDL status');
    expect(fieldById(parsed, 'fcs-4').physicalValue).toBe('Checksum OK');
    expect(fieldById(parsed, 'end-delimiter-5').rawValue).toBe(0x16);
    expect(parsed.valid).toBe(true);
  });

  it('breaks the frame control byte down differently for requests and responses', () => {
    const request = decodeExample('sd1-fdl-status-request');
    expect(fieldById(request, 'frame-control-3').physicalValue).toBe('Request / send frame');
    // FC 0x49 = istek biti + fonksiyon 9; FCB ve FCV SIFIR.
    expect(fieldById(request, 'fc-fcb-3').rawValue).toBe(0);
    expect(fieldById(request, 'fc-fcv-3').physicalValue).toBe('FCB is not evaluated');
    expect(hasField(request, 'fc-station-type-3')).toBe(false);

    const response = decodeExample('sd1-fdl-status-response');
    expect(fieldById(response, 'frame-control-3').physicalValue).toBe(
      'Acknowledgement / response frame',
    );
    expect(fieldById(response, 'fc-station-type-3').physicalValue).toBe(
      'Master, ready to enter token ring',
    );
    expect(fieldById(response, 'fc-function-3').physicalValue).toBe('OK (positive acknowledgement)');
    expect(hasField(response, 'fc-fcb-3')).toBe(false);
  });

  it('decodes the SD2 length, its repeat and the repeated start delimiter', () => {
    const parsed = decodeExample('sd2-data-exchange');
    expect(fieldById(parsed, 'length').rawValue).toBe(7);
    expect(fieldById(parsed, 'length-repeat').physicalValue).toBe('Matches LE');
    expect(fieldById(parsed, 'second-start-delimiter').rawValue).toBe(0x68);
    expect(fieldById(parsed, 'destination-address').rawValue).toBe(3);
    expect(fieldById(parsed, 'data-unit-7').length).toBe(4);
    expect(parsed.errors).toEqual([]);
  });

  it('decodes SD3 as a fixed fourteen bytes with an eight byte data unit', () => {
    const parsed = decodeExample('sd3-fixed-data');
    expect(exampleBytes('sd3-fixed-data')).toHaveLength(14);
    expect(hasField(parsed, 'length')).toBe(false);
    expect(fieldById(parsed, 'data-unit-4').length).toBe(8);
    expect(fieldById(parsed, 'fcs-12').physicalValue).toBe('Checksum OK');
  });

  it('decodes the token telegram without a function code, checksum or end delimiter', () => {
    const parsed = decodeExample('sd4-token');
    expect(fieldById(parsed, 'destination-address').rawValue).toBe(3);
    expect(fieldById(parsed, 'source-address').rawValue).toBe(2);
    expect(hasField(parsed, 'frame-control-3')).toBe(false);
    expect(parsed.fields.some((field) => field.id.startsWith('fcs-'))).toBe(false);
  });

  it('decodes the short acknowledgement as a single byte', () => {
    const parsed = decodeExample('short-acknowledgement');
    expect(parsed.fields).toHaveLength(1);
    expect(fieldById(parsed, 'start-delimiter-0').physicalValue).toBe('SC — short acknowledgement');
  });
});

describe('PROFIBUS DP service access points', () => {
  it('reads DSAP and SSAP out of the address extension and names them', () => {
    const parsed = decodeExample('sd2-set-parameters');
    expect(fieldById(parsed, 'destination-address-extension-flag').physicalValue).toBe(
      'DAE/SAE present in data unit',
    );
    expect(fieldById(parsed, 'DAE-7').physicalValue).toBe('Set Parameters');
    expect(fieldById(parsed, 'SAE-8').physicalValue).toBe(
      'Check Configuration (slave) / DP master MS0',
    );
    expect(fieldById(parsed, 'data-unit-9').length).toBe(7);
  });

  it('names the diagnosis and global control SAPs', () => {
    expect(fieldById(decodeExample('sd2-slave-diagnosis-request'), 'DAE-7').physicalValue).toBe(
      'Slave Diagnosis',
    );
    const globalControl = decodeExample('sd2-global-control');
    expect(fieldById(globalControl, 'DAE-7').physicalValue).toBe('Global Control');
    expect(fieldById(globalControl, 'destination-address').physicalValue).toBe('127 (broadcast)');
  });

  it('does not name a SAP that is missing from the DP table', () => {
    // SAP 5 DP tablosunda yok → numara gösterilir, ad UYDURULMAZ.
    const parsed = expectSuccess(parseProfibusDp(sd2(0x83, 0x82, 0x5d, [5, 62, 0x00]))).frame;
    expect(warningCodes(parsed)).toContain(WARN_SAP_NOT_NAMED);
    expect(fieldById(parsed, 'DAE-7').physicalValue).toBe('SAP 5');
    expect(fieldById(parsed, 'DAE-7').valid).toBe(false);
  });

  it('produces no SAP fields when Data Exchange uses the default SAP', () => {
    const parsed = decodeExample('sd2-data-exchange');
    expect(parsed.fields.some((field) => field.id.startsWith('DAE-'))).toBe(false);
    expect(parsed.fields.some((field) => field.id.startsWith('SAE-'))).toBe(false);
  });
});

describe('PROFIBUS FCS shares the FT1.2 computation', () => {
  it('accepts every telegram whose checksum sum8Checksum itself produced', () => {
    for (let destination = 0; destination < 128; destination += 17) {
      for (let source = 0; source < 128; source += 13) {
        for (const functionCode of [0x49, 0x6d, 0x7d, 0x08, 0x20]) {
          const telegram = sd1(destination, source, functionCode);
          const parsed = expectSuccess(parseProfibusDp(telegram)).frame;
          expect(parsed.errors, `${destination}/${source}/${functionCode}`).toEqual([]);
        }
      }
    }
  });

  it('raises a frame error when the checksum is off by one', () => {
    const parsed = decodeExample('checksum-mismatch');
    expect(parsed.valid).toBe(false);
    expect(parsed.errors[0]?.code).toBe('checksum-mismatch');
    expect(parsed.errors[0]?.message).toBe(ERROR_CHECKSUM_MISMATCH);
    expect(String(fieldById(parsed, 'fcs-11').physicalValue)).toContain('Expected');
  });

  it('covers the bytes from the first address through the data unit', () => {
    // FCS'in kapsamı: DA+SA+FC(+DU). Tek bir veri baytını değiştirmek yeter.
    const good = sd2(0x03, 0x02, 0x7d, [0x05, 0x00]);
    expect(expectSuccess(parseProfibusDp(good)).frame.errors).toEqual([]);
    const tampered = Uint8Array.from(good);
    tampered[8] = ((tampered[8] ?? 0) + 1) & 0xff;
    expect(expectSuccess(parseProfibusDp(tampered)).frame.errors[0]?.code).toBe('checksum-mismatch');
  });
});

describe('PROFIBUS DP failure and boundary paths', () => {
  it('refuses to split the body when the repeated length disagrees', () => {
    const parsed = decodeExample('length-repeat-mismatch');
    expect(parsed.valid).toBe(false);
    expect(parsed.errors.some((error) => error.message === ERROR_LENGTH_REPEAT_MISMATCH)).toBe(true);
    // Alanlar UYDURULMAZ: adres, FC ve DU alanları hiç üretilmez.
    expect(hasField(parsed, 'destination-address')).toBe(false);
    expect(hasField(parsed, 'unparsed-4')).toBe(true);
  });

  it('marks an invalid end delimiter as a frame error', () => {
    const parsed = decodeExample('end-delimiter-invalid');
    expect(parsed.valid).toBe(false);
    expect(parsed.errors[0]?.message).toBe(ERROR_END_DELIMITER_INVALID);
  });

  it('fails outright on an unknown start delimiter', () => {
    const failure = expectFailure(parseProfibusDp(exampleBytes('unknown-start-delimiter')));
    expect(failure.error.code).toBe('start-delimiter-not-found');
    expect(failure.error.message).toBe(ERROR_START_DELIMITER_UNKNOWN);
    expect(failure.recoverable).toBe(true);
  });

  it('fails outright on empty input and on a truncated fixed-length telegram', () => {
    expect(expectFailure(parseProfibusDp(Uint8Array.from([]))).error.code).toBe('truncated-frame');
    expect(expectFailure(parseProfibusDp(Uint8Array.from([0x10, 0x22, 0x02]))).error.code).toBe(
      'truncated-frame',
    );
  });

  it('shows bytes beyond the telegram as a raw block', () => {
    const withExtra = Uint8Array.from([...sd1(0x22, 0x02, 0x49), 0xe5]);
    const parsed = expectSuccess(parseProfibusDp(withExtra)).frame;
    expect(warningCodes(parsed)).toContain(WARN_TRAILING_BYTES);
    expect(fieldById(parsed, 'trailing-6').length).toBe(1);
  });

  it('warns when FCB is set while FCV is clear', () => {
    // FC 0x60: request + FCB, FCV yok → FCB değerlendirilmez.
    const parsed = expectSuccess(parseProfibusDp(sd1(0x03, 0x02, 0x60))).frame;
    expect(warningCodes(parsed)).toContain(WARN_FCV_WITHOUT_FCB_MEANING);
  });

  it('rejects an oversized telegram and honours an aborted signal', () => {
    expect(
      expectFailure(profibusDpParser.parse(sd1(0x22, 0x02, 0x49), { maxFrameLength: 4 })).error.code,
    ).toBe('frame-too-long');
    const controller = new AbortController();
    controller.abort();
    expect(
      expectFailure(profibusDpParser.parse(sd1(0x22, 0x02, 0x49), { signal: controller.signal }))
        .error.code,
    ).toBe('parser-timeout');
  });
});

describe('PROFIBUS DP example frames', () => {
  it('every example matches its declared validity and consumes the whole input', () => {
    for (const example of profibusDpPlugin.exampleFrames) {
      const result = parseProfibusDp(example.bytes);
      if (!example.expectedValid && !result.success) continue;
      const parsed = expectSuccess(result).frame;
      expect(parsed.valid, `${example.id} validity`).toBe(example.expectedValid);
      expect(result.consumedBytes, example.id).toBe(example.bytes.length);
    }
  });

  it('covers all five telegram classes and has unique ids', () => {
    const ids = profibusDpPlugin.exampleFrames.map((example) => example.id);
    expect(new Set(ids).size).toBe(ids.length);
    const kinds = new Set<string>();
    for (const example of profibusDpPlugin.exampleFrames) {
      const result = parseProfibusDp(example.bytes);
      if (!result.success) continue;
      const metadata = result.frame.rawFrame.metadata as { telegramKind?: string } | undefined;
      if (metadata?.telegramKind !== undefined) kinds.add(metadata.telegramKind);
    }
    expect(kinds).toEqual(new Set(['short-ack', 'sd1', 'sd2', 'sd3', 'token']));
  });

  it('always says the user data unit needs the GSD file', () => {
    expect(warningCodes(decodeExample('sd2-data-exchange'))).toContain(WARN_USER_DATA_NEEDS_GSD);
    expect(warningCodes(decodeExample('sd3-fixed-data'))).toContain(WARN_USER_DATA_NEEDS_GSD);
  });
});
