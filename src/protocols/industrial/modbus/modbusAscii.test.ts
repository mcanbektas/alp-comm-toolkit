import { describe, expect, it } from 'vitest';

import { lrcChecksum } from '@/protocol-core/checksums/lrc';
import type { ParseFailure, ParseResult, ParseSuccess, ParsedField } from '@/protocol-core/types';

import {
  MODBUS_ASCII_EXAMPLE_FRAMES,
  buildModbusAsciiFrame,
  modbusAsciiParser,
  modbusAsciiPlugin,
  parseModbusAscii,
} from './modbusAscii';
import { decodePdu } from './modbusPdu';

/** Wire ASCII metnini bayta çevirir — fixture'lar spec'teki gibi okunur kalsın diye. */
function wire(text: string): Uint8Array {
  const bytes = new Uint8Array(text.length);
  for (let index = 0; index < text.length; index++) {
    bytes[index] = text.charCodeAt(index);
  }
  return bytes;
}

function toText(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => String.fromCharCode(byte)).join('');
}

/** Binary fixture'lar (RTU tarafı) hex yazılır. */
function hexBytes(hex: string): Uint8Array {
  const cleaned = hex.replace(/\s+/g, '');
  const result = new Uint8Array(cleaned.length / 2);
  for (let index = 0; index < result.length; index++) {
    result[index] = Number.parseInt(cleaned.slice(index * 2, index * 2 + 2), 16);
  }
  return result;
}

function expectSuccess(result: ParseResult): ParseSuccess {
  if (!result.success) {
    throw new Error(`expected success, got ${result.error.code} (${result.error.message})`);
  }
  return result;
}

function expectFailure(result: ParseResult): ParseFailure {
  if (result.success) {
    throw new Error(`expected failure, got a frame with ${result.frame.fields.length} fields`);
  }
  return result;
}

function fieldById(fields: readonly ParsedField[], id: string): ParsedField {
  const found = fields.find((field) => field.id === id);
  if (found === undefined) {
    throw new Error(`field "${id}" not found; got ${fields.map((f) => f.id).join(', ')}`);
  }
  return found;
}

/** Spec §3.3'ün birebir yazdığı wire ASCII isteği. */
const SPEC_REQUEST = ':010300000002FA\r\n';
/** Spec'in RTU yanıtından (`01 03 04 00 64 00 C8 BA 7A`) çevrilmiş hâli. */
const SPEC_RESPONSE = ':010304006400C8CC\r\n';

describe('modbusAsciiParser.canParse', () => {
  it('accepts anything that starts with a colon without validating the rest', () => {
    expect(modbusAsciiParser.canParse(wire(SPEC_REQUEST))).toBe(true);
    // Yarım gelmiş çerçeve de kabul edilmeli: canParse sonlandırıcıya bakmaz.
    expect(modbusAsciiParser.canParse(wire(':0103'))).toBe(true);
  });

  it('rejects a frame that does not start with a colon and an empty buffer', () => {
    expect(modbusAsciiParser.canParse(wire('010300000002FA\r\n'))).toBe(false);
    expect(modbusAsciiParser.canParse(new Uint8Array(0))).toBe(false);
  });
});

describe('parseModbusAscii — spec request frame', () => {
  it('decodes the spec frame into address, function, PDU, LRC and terminator', () => {
    const parsed = expectSuccess(parseModbusAscii(wire(SPEC_REQUEST)));
    expect(parsed.frame.valid).toBe(true);
    expect(parsed.frame.protocol).toBe('modbus-ascii');
    expect(parsed.frame.errors).toEqual([]);
    expect(parsed.frame.fields.map((field) => field.id)).toEqual([
      'start-delimiter',
      'slave-address',
      'function-code',
      'start-address',
      'quantity',
      'lrc',
      'end-delimiter',
    ]);
  });

  it('places every field offset on the RAW ASCII stream, not on the decoded bytes', () => {
    const parsed = expectSuccess(parseModbusAscii(wire(SPEC_REQUEST)));
    const offsets = parsed.frame.fields.map((field) => [field.id, field.offset, field.length]);
    expect(offsets).toEqual([
      ['start-delimiter', 0, 1],
      ['slave-address', 1, 2],
      ['function-code', 3, 2],
      // Çözülmüş gövdede 2 baytlık Start Address, telde DÖRT karakterdir.
      ['start-address', 5, 4],
      ['quantity', 9, 4],
      ['lrc', 13, 2],
      ['end-delimiter', 15, 2],
    ]);
  });

  it('keeps rawBytes as the raw ASCII characters so length matches the highlighted region', () => {
    const parsed = expectSuccess(parseModbusAscii(wire(SPEC_REQUEST)));
    const startAddress = fieldById(parsed.frame.fields, 'start-address');
    expect(toText(startAddress.rawBytes)).toBe('0000');
    expect(startAddress.rawBytes.length).toBe(startAddress.length);
    expect(toText(fieldById(parsed.frame.fields, 'quantity').rawBytes)).toBe('0002');
    expect(toText(fieldById(parsed.frame.fields, 'end-delimiter').rawBytes)).toBe('\r\n');
  });

  it('carries the decoded numbers as rawValue and the documentation address as physicalValue', () => {
    const parsed = expectSuccess(parseModbusAscii(wire(SPEC_REQUEST)));
    expect(fieldById(parsed.frame.fields, 'slave-address').rawValue).toBe(1);
    expect(fieldById(parsed.frame.fields, 'function-code').rawValue).toBe(0x03);
    expect(fieldById(parsed.frame.fields, 'function-code').physicalValue).toBe(
      'Read Holding Registers',
    );
    const startAddress = fieldById(parsed.frame.fields, 'start-address');
    expect(startAddress.rawValue).toBe(0);
    // Adres tuzağı: telde 0, dokümantasyonda 40001.
    expect(startAddress.physicalValue).toBe(40001);
    expect(fieldById(parsed.frame.fields, 'quantity').rawValue).toBe(2);
  });

  it('consumes exactly the frame and leaves a following frame in the buffer', () => {
    const twoFrames = wire(`${SPEC_REQUEST}${SPEC_RESPONSE}`);
    const first = expectSuccess(parseModbusAscii(twoFrames));
    expect(first.consumedBytes).toBe(SPEC_REQUEST.length);

    // İkinci çerçeve YANIT: rolü tel söylemez, çağıran bildirir. Rolsüz çözülürse
    // aynı baytlar istek şekline oturur ve artık kısım `trailing-data` olur.
    const second = expectSuccess(
      parseModbusAscii(twoFrames.slice(first.consumedBytes), 'response'),
    );
    expect(second.consumedBytes).toBe(SPEC_RESPONSE.length);
    expect(fieldById(second.frame.fields, 'register-1').rawValue).toBe(200);

    const withoutRole = expectSuccess(parseModbusAscii(twoFrames.slice(first.consumedBytes)));
    expect(withoutRole.frame.fields.map((field) => field.id)).toContain('trailing-data');
  });
});

describe('parseModbusAscii — spec response frame', () => {
  it('splits the register block exactly as the spec fixture demands', () => {
    const parsed = expectSuccess(parseModbusAscii(wire(SPEC_RESPONSE), 'response'));
    expect(parsed.frame.valid).toBe(true);
    expect(fieldById(parsed.frame.fields, 'byte-count').rawValue).toBe(4);
    expect(fieldById(parsed.frame.fields, 'register-0').rawValue).toBe(100);
    expect(fieldById(parsed.frame.fields, 'register-1').rawValue).toBe(200);
  });

  it('shifts register offsets onto the raw stream', () => {
    const parsed = expectSuccess(parseModbusAscii(wire(SPEC_RESPONSE), 'response'));
    expect(toText(fieldById(parsed.frame.fields, 'register-0').rawBytes)).toBe('0064');
    expect(fieldById(parsed.frame.fields, 'register-0').offset).toBe(7);
    expect(fieldById(parsed.frame.fields, 'register-1').offset).toBe(11);
    expect(fieldById(parsed.frame.fields, 'lrc').offset).toBe(15);
  });
});

describe('parseModbusAscii — round trip with the RTU fixture', () => {
  it('carries the spec RTU PDU through an ASCII frame and back unchanged', () => {
    // Spec §43 fixture'ı: RTU çerçevesi. Son iki bayt CRC'dir ve ASCII'de kullanılmaz.
    const rtuFrame = hexBytes('01 03 00 00 00 02 C4 0B');
    const payload = rtuFrame.slice(0, rtuFrame.length - 2);

    const asciiFrame = buildModbusAsciiFrame(payload);
    // Üretilen tel, spec'in birebir yazdığı dizgeyle aynı olmalı.
    expect(toText(asciiFrame)).toBe(SPEC_REQUEST);

    const parsed = expectSuccess(parseModbusAscii(asciiFrame, 'request'));
    const metadata = parsed.frame.rawFrame.metadata;
    // Çözülmüş baytlar = RTU yükü + LRC.
    expect(metadata?.decodedBytes).toEqual(hexBytes('010300000002FA'));

    // Aynı PDU, taşımasız çözüldüğünde de aynı alanları vermeli.
    const direct = decodePdu(0x03, payload.slice(2), 'request');
    const asciiPduValues = parsed.frame.fields
      .filter((field) => field.id === 'start-address' || field.id === 'quantity')
      .map((field) => [field.id, field.rawValue, field.physicalValue]);
    const directValues = direct.fields.map((field) => [
      field.id,
      field.rawValue,
      field.physicalValue,
    ]);
    expect(asciiPduValues).toEqual(directValues);
  });

  it('builds frames with uppercase hex, a computed LRC and a CR LF terminator', () => {
    const frame = buildModbusAsciiFrame(hexBytes('01 03 04 00 64 00 C8'));
    expect(toText(frame)).toBe(SPEC_RESPONSE);
    expect(toText(frame.slice(-2))).toBe('\r\n');
    expect(frame[0]).toBe(0x3a);
  });
});

describe('parseModbusAscii — hex character handling', () => {
  it('accepts lowercase hex and produces the same result as uppercase', () => {
    const upper = expectSuccess(parseModbusAscii(wire(SPEC_RESPONSE), 'response'));
    const lower = expectSuccess(parseModbusAscii(wire(':010304006400c8cc\r\n'), 'response'));
    expect(lower.frame.valid).toBe(true);
    expect(fieldById(lower.frame.fields, 'register-1').rawValue).toBe(
      fieldById(upper.frame.fields, 'register-1').rawValue,
    );
    expect(lower.frame.rawFrame.metadata?.decodedBytes).toEqual(
      upper.frame.rawFrame.metadata?.decodedBytes,
    );
  });

  it('reports the offending character and its offset for a non-hex character', () => {
    const failed = expectFailure(parseModbusAscii(wire(':0103GG00CC\r\n')));
    expect(failed.error.code).toBe('invalid-hex-input');
    expect(failed.error.message).toBe('protocol.modbus.ascii.error.invalidHexCharacter');
    // 'G' ham akışta 5. bayttır — ByteViewer tam oraya bakmalı.
    expect(failed.error.offset).toBe(5);
    expect(failed.error.details?.character).toBe('G');
    expect(failed.consumedBytes).toBe(13);
    expect(failed.recoverable).toBe(true);
  });

  it("reports the spec's ':0103GG00' example as an invalid character, not as a missing LF", () => {
    // Sıralama sözleşmesi: geçersiz hex, sonlandırıcı eksikliğinden ÖNCE gelir.
    const failed = expectFailure(parseModbusAscii(wire(':0103GG00')));
    expect(failed.error.message).toBe('protocol.modbus.ascii.error.invalidHexCharacter');
    expect(failed.error.offset).toBe(5);
    // Sonlandırıcı yokken hatalı karaktere kadar ilerlenir; 0 dönmek sonsuz döngü olurdu.
    expect(failed.consumedBytes).toBe(5);
  });

  it('rejects an odd number of hex digits', () => {
    const failed = expectFailure(parseModbusAscii(wire(':010300000002FA5\r\n')));
    expect(failed.error.code).toBe('invalid-hex-input');
    expect(failed.error.message).toBe('protocol.modbus.ascii.error.oddHexDigitCount');
    expect(failed.error.details?.hexDigitCount).toBe(15);
    expect(failed.consumedBytes).toBe(18);
  });
});

describe('parseModbusAscii — framing errors', () => {
  it('reports a missing colon and skips ahead to the next one', () => {
    const failed = expectFailure(parseModbusAscii(wire(`XY${SPEC_REQUEST}`)));
    expect(failed.error.code).toBe('start-delimiter-not-found');
    expect(failed.error.message).toBe('protocol.modbus.ascii.error.missingColon');
    expect(failed.consumedBytes).toBe(2);
    expect(failed.recoverable).toBe(true);
  });

  it('discards the whole buffer when there is no colon at all', () => {
    const failed = expectFailure(parseModbusAscii(wire('garbage')));
    expect(failed.error.code).toBe('start-delimiter-not-found');
    expect(failed.consumedBytes).toBe(7);
  });

  it('waits for more data on an empty buffer instead of consuming it', () => {
    const failed = expectFailure(parseModbusAscii(new Uint8Array(0)));
    expect(failed.consumedBytes).toBe(0);
    expect(failed.recoverable).toBe(true);
  });

  it('treats a frame without LF as incomplete and consumes nothing', () => {
    const failed = expectFailure(parseModbusAscii(wire(':010300000002FA\r')));
    expect(failed.error.code).toBe('truncated-frame');
    expect(failed.error.message).toBe('protocol.modbus.ascii.error.missingLineFeed');
    // Yarım çerçeve: CR "geçersiz hex" sanılmamalı ve veri atılmamalı.
    expect(failed.consumedBytes).toBe(0);
  });

  it('reports a missing CR and drops the broken frame', () => {
    const failed = expectFailure(parseModbusAscii(wire(':010300000002FA\n')));
    expect(failed.error.code).toBe('truncated-frame');
    expect(failed.error.message).toBe('protocol.modbus.ascii.error.missingCarriageReturn');
    expect(failed.consumedBytes).toBe(16);
  });

  it('rejects a frame that cannot even hold address, function and LRC', () => {
    const failed = expectFailure(parseModbusAscii(wire(':0103\r\n')));
    expect(failed.error.code).toBe('length-mismatch');
    expect(failed.error.message).toBe('protocol.modbus.ascii.error.frameTooShort');
    expect(failed.error.details?.decodedLength).toBe(2);
  });

  it('accepts the shortest legal frame: address, function code and LRC only', () => {
    // 0x01 + 0x03 = 0x04 → LRC = 0x100 − 0x04 = 0xFC.
    const parsed = expectSuccess(parseModbusAscii(wire(':0103FC\r\n')));
    expect(parsed.frame.valid).toBe(true);
    expect(parsed.frame.warnings.map((warning) => warning.code)).toContain(
      'protocol.modbus.pdu.warning.emptyBody',
    );
  });
});

describe('parseModbusAscii — LRC', () => {
  it('keeps decoding field by field when the LRC is wrong', () => {
    const parsed = expectSuccess(parseModbusAscii(wire(':010300000002FB\r\n')));
    expect(parsed.frame.valid).toBe(false);
    // Alanlar bozuk LRC'ye rağmen sonuna kadar çözülür.
    expect(fieldById(parsed.frame.fields, 'start-address').rawValue).toBe(0);
    expect(fieldById(parsed.frame.fields, 'quantity').rawValue).toBe(2);
    expect(fieldById(parsed.frame.fields, 'lrc').valid).toBe(false);
    expect(fieldById(parsed.frame.fields, 'lrc').warnings).toContain(
      'protocol.modbus.ascii.warning.lrcMismatch',
    );
  });

  it('reports received, calculated and coverage for a wrong LRC', () => {
    const parsed = expectSuccess(parseModbusAscii(wire(':010300000002FB\r\n')));
    const error = parsed.frame.errors[0];
    expect(error?.code).toBe('checksum-mismatch');
    expect(error?.message).toBe('protocol.modbus.ascii.error.lrcMismatch');
    expect(error?.details?.received).toBe(0xfb);
    expect(error?.details?.calculated).toBe(0xfa);
    // Kapsam LRC'nin kendisi hariç tüm hex karakterleridir: 6 bayt × 2 karakter.
    expect(error?.details?.coverageOffset).toBe(1);
    expect(error?.details?.coverageLength).toBe(12);
  });

  it('publishes the LRC panel data on a valid frame too', () => {
    const parsed = expectSuccess(parseModbusAscii(wire(SPEC_REQUEST)));
    const metadata = parsed.frame.rawFrame.metadata;
    expect(metadata?.lrcReceived).toBe(0xfa);
    expect(metadata?.lrcCalculated).toBe(0xfa);
    expect(metadata?.summaryKey).toBe('protocol.modbus.pdu.summary.readHoldingRegisters');
  });
});

describe('parseModbusAscii — role and addressing', () => {
  it('infers the response role from the exception bit when no role is given', () => {
    // 0x01 + 0x83 + 0x02 = 0x86 → LRC = 0x7A.
    const parsed = expectSuccess(parseModbusAscii(wire(':0183027A\r\n')));
    expect(fieldById(parsed.frame.fields, 'exception-code').physicalValue).toBe(
      'Illegal Data Address',
    );
    expect(fieldById(parsed.frame.fields, 'function-code').physicalValue).toBe(
      'Read Holding Registers',
    );
    expect(parsed.frame.warnings.map((warning) => warning.code)).not.toContain(
      'protocol.modbus.pdu.warning.exceptionBitInRequest',
    );
  });

  it('honours an explicit request role and warns about the exception bit', () => {
    const parsed = expectSuccess(parseModbusAscii(wire(':0183027A\r\n'), 'request'));
    expect(parsed.frame.warnings.map((warning) => warning.code)).toContain(
      'protocol.modbus.pdu.warning.exceptionBitInRequest',
    );
  });

  it('labels slave address 0 as a broadcast', () => {
    // 0x00 + 0x03 + 0x02 = 0x05 → LRC = 0xFB.
    const parsed = expectSuccess(parseModbusAscii(wire(':000300000002FB\r\n')));
    expect(fieldById(parsed.frame.fields, 'slave-address').rawValue).toBe(0);
    expect(fieldById(parsed.frame.fields, 'slave-address').physicalValue).toBe('Broadcast');
  });

  it('warns about a slave address in the reserved 248-255 range', () => {
    // 0xF8 + 0x03 + 0x02 = 0xFD → LRC = 0x03.
    const parsed = expectSuccess(parseModbusAscii(wire(':F8030000000203\r\n')));
    expect(parsed.frame.valid).toBe(true);
    expect(parsed.frame.warnings.map((warning) => warning.code)).toContain(
      'protocol.modbus.ascii.warning.reservedSlaveAddress',
    );
  });

  it('passes an unknown function code through as a warning, not as a failure', () => {
    // 0x01 + 0x63 = 0x64 → LRC = 0x9C.
    const parsed = expectSuccess(parseModbusAscii(wire(':01639C\r\n')));
    expect(parsed.frame.valid).toBe(true);
    expect(fieldById(parsed.frame.fields, 'function-code').physicalValue).toBeUndefined();
    expect(parsed.frame.warnings.map((warning) => warning.code)).toContain(
      'protocol.modbus.pdu.warning.unknownFunctionCode',
    );
  });
});

describe('modbusAsciiParser.parse — context handling', () => {
  it('takes the role from context options', () => {
    const parsed = expectSuccess(
      modbusAsciiParser.parse(wire(SPEC_RESPONSE), { options: { role: 'response' } }),
    );
    expect(fieldById(parsed.frame.fields, 'register-0').rawValue).toBe(100);
    expect(parsed.frame.rawFrame.metadata?.role).toBe('response');
  });

  it('ignores an unusable role value and falls back to the inferred one', () => {
    const parsed = expectSuccess(
      modbusAsciiParser.parse(wire(SPEC_REQUEST), { options: { role: 'nonsense' } }),
    );
    expect(parsed.frame.rawFrame.metadata?.role).toBe('request');
  });

  it('applies timestamp, direction and channel from the context', () => {
    const parsed = expectSuccess(
      modbusAsciiParser.parse(wire(SPEC_REQUEST), {
        timestamp: 1234,
        direction: 'tx',
        channel: 'COM3',
      }),
    );
    expect(parsed.frame.timestamp).toBe(1234);
    expect(parsed.frame.rawFrame.timestamp).toBe(1234);
    expect(parsed.frame.rawFrame.direction).toBe('tx');
    expect(parsed.frame.rawFrame.channel).toBe('COM3');
  });

  it('stops before scanning past maxFrameLength when no terminator shows up', () => {
    const flood = wire(`:${'0'.repeat(64)}`);
    const failed = expectFailure(modbusAsciiParser.parse(flood, { maxFrameLength: 16 }));
    expect(failed.error.code).toBe('frame-too-long');
    expect(failed.error.message).toBe('protocol.modbus.ascii.error.frameTooLong');
    expect(failed.consumedBytes).toBe(16);
  });

  it('returns parser-timeout instead of throwing when the signal is aborted', () => {
    const controller = new AbortController();
    controller.abort();
    const failed = expectFailure(
      modbusAsciiParser.parse(wire(SPEC_REQUEST), { signal: controller.signal }),
    );
    expect(failed.error.code).toBe('parser-timeout');
    expect(failed.recoverable).toBe(false);
    expect(failed.consumedBytes).toBe(0);
  });
});

describe('modbusAsciiPlugin', () => {
  it('registers under the catalogue id with the parser attached', () => {
    expect(modbusAsciiPlugin.id).toBe('modbus-ascii');
    expect(modbusAsciiPlugin.category).toBe('industrial-automation');
    expect(modbusAsciiPlugin.parser).toBe(modbusAsciiParser);
    expect(modbusAsciiPlugin.exampleFrames.length).toBe(MODBUS_ASCII_EXAMPLE_FRAMES.length);
  });

  it('carries an LRC that matches the algorithm in every well-formed example', () => {
    for (const example of modbusAsciiPlugin.exampleFrames) {
      if (example.expectedValid !== true) {
        continue;
      }
      const parsed = expectSuccess(parseModbusAscii(example.bytes));
      const decoded = parsed.frame.rawFrame.metadata?.decodedBytes;
      if (!(decoded instanceof Uint8Array)) {
        throw new Error(`example "${example.id}" published no decoded bytes`);
      }
      // Örnekteki elle yazılmış LRC ile hesaplanan LRC ayrışırsa test kırmızıya döner.
      expect(decoded[decoded.length - 1]).toBe(
        lrcChecksum(decoded.subarray(0, decoded.length - 1)),
      );
      expect(parsed.frame.valid).toBe(true);
    }
  });

  it('keeps the deliberately broken examples broken', () => {
    const invalidHex = modbusAsciiPlugin.exampleFrames.find(
      (example) => example.id === 'invalid-hex-character',
    );
    expect(invalidHex?.expectedValid).toBe(false);
    expect(expectFailure(parseModbusAscii(invalidHex?.bytes ?? new Uint8Array(0))).error.code).toBe(
      'invalid-hex-input',
    );

    const lrcMismatch = modbusAsciiPlugin.exampleFrames.find(
      (example) => example.id === 'lrc-mismatch',
    );
    expect(lrcMismatch?.expectedValid).toBe(false);
    expect(
      expectSuccess(parseModbusAscii(lrcMismatch?.bytes ?? new Uint8Array(0))).frame.valid,
    ).toBe(false);
  });

  it('describes every example with a translation key instead of embedded prose', () => {
    for (const example of modbusAsciiPlugin.exampleFrames) {
      expect(example.description?.startsWith('protocol.modbus.ascii.example.')).toBe(true);
    }
    expect(modbusAsciiPlugin.documentation?.summary).toBe(
      'protocol.modbus.ascii.documentation.summary',
    );
  });
});
