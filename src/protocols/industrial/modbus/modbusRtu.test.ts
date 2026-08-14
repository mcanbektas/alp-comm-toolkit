import { describe, expect, it } from 'vitest';

import {
  MODBUS_RTU_MAX_FRAME_LENGTH,
  MODBUS_RTU_MIN_FRAME_LENGTH,
  inferModbusRole,
  modbusRtuParser,
  modbusRtuPlugin,
  parseModbusRtu,
} from './modbusRtu';
import type {
  ParseFailure,
  ParseResult,
  ParseSuccess,
  ParsedField,
  ParsedFrame,
} from '@/protocol-core/types';

/** Fixture'lar spec'teki gibi hex yazılır; okunurluk byte dizisi kurmaktan önemli. */
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

function warningCodes(frame: ParsedFrame): string[] {
  return frame.warnings.map((warning) => warning.code);
}

/** Spec §43 fixture'ı: Address=1, Function=3, Start=0, Quantity=2, CRC geçerli. */
const READ_REQUEST = bytes('01 03 00 00 00 02 C4 0B');
/** Spec §3.3 yanıt örneği: ByteCount=4, Reg0=0x0064 (100), Reg1=0x00C8 (200). */
const READ_RESPONSE = bytes('01 03 04 00 64 00 C8 BA 7A');
/** Spec §3.3 CRC hata örneği: Received=0x0BC5, Calculated=0x0BC4, Difference=0x0001. */
const CRC_BROKEN_REQUEST = bytes('01 03 00 00 00 02 C5 0B');
/** Spec §3.3 exception örneği: FC=0x03 → Illegal Data Address. */
const EXCEPTION_RESPONSE = bytes('01 83 02 C0 F1');

describe('parseModbusRtu — spec fixture 01 03 00 00 00 02 C4 0B', () => {
  it('succeeds and consumes the whole frame', () => {
    const result = expectSuccess(parseModbusRtu(READ_REQUEST, 'request'));
    expect(result.consumedBytes).toBe(READ_REQUEST.length);
    expect(result.frame.protocol).toBe('modbus-rtu');
  });

  it('decodes the slave address and the function code', () => {
    const { frame } = expectSuccess(parseModbusRtu(READ_REQUEST, 'request'));
    const address = fieldById(frame, 'slave-address');
    expect(address.rawValue).toBe(1);
    expect(address.offset).toBe(0);
    expect(address.length).toBe(1);

    const functionCode = fieldById(frame, 'function-code');
    expect(functionCode.rawValue).toBe(0x03);
    expect(functionCode.physicalValue).toBe('Read Holding Registers');
    expect(functionCode.offset).toBe(1);
  });

  it('decodes the start address together with its documentation address', () => {
    const { frame } = expectSuccess(parseModbusRtu(READ_REQUEST, 'request'));
    const start = fieldById(frame, 'start-address');
    expect(start.rawValue).toBe(0);
    // Adres tuzağı: telde 0, PLC dokümanında 40001.
    expect(start.physicalValue).toBe(40001);
  });

  it('decodes the register quantity', () => {
    const { frame } = expectSuccess(parseModbusRtu(READ_REQUEST, 'request'));
    expect(fieldById(frame, 'quantity').rawValue).toBe(2);
  });

  it('validates the CRC and leaves the frame without errors', () => {
    const { frame } = expectSuccess(parseModbusRtu(READ_REQUEST, 'request'));
    const crc = fieldById(frame, 'crc');
    expect(crc.valid).toBe(true);
    expect(crc.rawValue).toBe(0x0bc4);
    expect(crc.physicalValue).toBe(0x0bc4);
    expect(frame.valid).toBe(true);
    expect(frame.errors).toEqual([]);
  });

  it('shifts every PDU field offset by the two-byte RTU header', () => {
    const { frame } = expectSuccess(parseModbusRtu(READ_REQUEST, 'request'));
    expect(fieldById(frame, 'start-address').offset).toBe(2);
    expect(fieldById(frame, 'quantity').offset).toBe(4);
    expect(fieldById(frame, 'crc').offset).toBe(6);
    expect(frame.fields.map((field) => field.id)).toEqual([
      'slave-address',
      'function-code',
      'start-address',
      'quantity',
      'crc',
    ]);
  });

  it('carries the PDU summary and the CRC view through the raw frame metadata', () => {
    const { frame } = expectSuccess(parseModbusRtu(READ_REQUEST, 'request'));
    const metadata = frame.rawFrame.metadata;
    expect(metadata?.['summaryKey']).toBe('protocol.modbus.pdu.summary.readHoldingRegisters');
    expect(metadata?.['role']).toBe('request');
    expect(metadata?.['roleInferred']).toBe(false);
    expect(metadata?.['crcReceived']).toBe(0x0bc4);
    expect(metadata?.['crcCalculated']).toBe(0x0bc4);
    // Kapsam adresten PDU sonuna kadar: sekiz byte'lık çerçevede altı byte.
    expect(metadata?.['crcCoverageLength']).toBe(6);
  });
});

describe('parseModbusRtu — response fixture 01 03 04 00 64 00 C8 BA 7A', () => {
  it('decodes the byte count and both registers', () => {
    const { frame } = expectSuccess(parseModbusRtu(READ_RESPONSE, 'response'));
    expect(fieldById(frame, 'byte-count').rawValue).toBe(4);
    expect(fieldById(frame, 'register-0').rawValue).toBe(100);
    expect(fieldById(frame, 'register-1').rawValue).toBe(200);
    expect(fieldById(frame, 'register-1').offset).toBe(5);
    expect(frame.valid).toBe(true);
  });

  it('infers the response role from the byte-count shape and reports the guess', () => {
    const { frame } = expectSuccess(parseModbusRtu(READ_RESPONSE));
    expect(frame.rawFrame.metadata?.['role']).toBe('response');
    expect(frame.rawFrame.metadata?.['roleInferred']).toBe(true);
    expect(warningCodes(frame)).toContain('protocol.modbus.rtu.warning.roleInferredResponse');
    expect(fieldById(frame, 'register-0').rawValue).toBe(100);
  });

  it('obeys an explicit request role even when the body looks like a response', () => {
    const { frame } = expectSuccess(parseModbusRtu(READ_RESPONSE, 'request'));
    // İstek şekli aynı byte'ları start address + quantity olarak okur.
    expect(fieldById(frame, 'start-address').rawValue).toBe(0x0400);
    expect(warningCodes(frame)).not.toContain('protocol.modbus.rtu.warning.roleInferredRequest');
  });
});

describe('parseModbusRtu — CRC mismatch', () => {
  it('marks the frame invalid and reports a crc-mismatch error', () => {
    const { frame } = expectSuccess(parseModbusRtu(CRC_BROKEN_REQUEST, 'request'));
    expect(frame.valid).toBe(false);
    expect(frame.errors).toHaveLength(1);
    expect(frame.errors[0]?.code).toBe('crc-mismatch');
    expect(frame.errors[0]?.message).toBe('protocol.modbus.rtu.error.crcMismatch');
  });

  it('still decodes the frame field by field', () => {
    const { frame } = expectSuccess(parseModbusRtu(CRC_BROKEN_REQUEST, 'request'));
    expect(fieldById(frame, 'slave-address').rawValue).toBe(1);
    expect(fieldById(frame, 'start-address').rawValue).toBe(0);
    expect(fieldById(frame, 'quantity').rawValue).toBe(2);
    expect(fieldById(frame, 'crc').valid).toBe(false);
  });

  it('points the error at the CRC bytes and carries received/calculated/difference', () => {
    const { frame } = expectSuccess(parseModbusRtu(CRC_BROKEN_REQUEST, 'request'));
    const error = frame.errors[0];
    expect(error?.offset).toBe(6);
    expect(error?.length).toBe(2);
    expect(error?.details?.['received']).toBe(0x0bc5);
    expect(error?.details?.['calculated']).toBe(0x0bc4);
    expect(error?.details?.['difference']).toBe(0x0001);
  });
});

describe('parseModbusRtu — frame length', () => {
  it('asks for more data when the frame is shorter than four bytes', () => {
    const result = expectFailure(parseModbusRtu(bytes('01 03 C4')));
    expect(result.error.code).toBe('truncated-frame');
    expect(result.error.message).toBe('protocol.modbus.rtu.error.frameTooShort');
    // Byte atmak hattaki bir sonraki çerçevenin başını da yutardı.
    expect(result.consumedBytes).toBe(0);
    expect(result.recoverable).toBe(true);
  });

  it('rejects an empty buffer the same way', () => {
    const result = expectFailure(parseModbusRtu(new Uint8Array(0)));
    expect(result.error.code).toBe('truncated-frame');
    expect(result.consumedBytes).toBe(0);
  });

  it('accepts the shortest legal frame, whose PDU body is empty', () => {
    const { frame } = expectSuccess(parseModbusRtu(bytes('01 04 01 E3')));
    expect(frame.valid).toBe(true);
    expect(fieldById(frame, 'crc').valid).toBe(true);
    expect(warningCodes(frame)).toContain('protocol.modbus.pdu.warning.emptyBody');
    expect(MODBUS_RTU_MIN_FRAME_LENGTH).toBe(4);
  });

  it('refuses a frame longer than the RTU maximum without parsing it', () => {
    const oversized = new Uint8Array(MODBUS_RTU_MAX_FRAME_LENGTH + 1);
    oversized[1] = 0x03;
    const result = expectFailure(parseModbusRtu(oversized));
    expect(result.error.code).toBe('frame-too-long');
    expect(result.error.message).toBe('protocol.modbus.rtu.error.frameTooLong');
    expect(result.consumedBytes).toBe(0);
    expect(result.recoverable).toBe(false);
  });

  it('honours a stricter maxFrameLength coming from the parse context', () => {
    const result = expectFailure(modbusRtuParser.parse(READ_REQUEST, { maxFrameLength: 6 }));
    expect(result.error.code).toBe('frame-too-long');
    expect(result.error.details?.['maxFrameLength']).toBe(6);
  });
});

describe('parseModbusRtu — exception response', () => {
  it('decodes the exception code with its semantic name', () => {
    const { frame } = expectSuccess(parseModbusRtu(EXCEPTION_RESPONSE, 'response'));
    const exception = fieldById(frame, 'exception-code');
    expect(exception.rawValue).toBe(0x02);
    expect(exception.physicalValue).toBe('Illegal Data Address');
    expect(exception.offset).toBe(2);
    expect(frame.valid).toBe(true);
  });

  it('names the original function on the function code field', () => {
    const { frame } = expectSuccess(parseModbusRtu(EXCEPTION_RESPONSE, 'response'));
    const functionCode = fieldById(frame, 'function-code');
    expect(functionCode.rawValue).toBe(0x83);
    expect(functionCode.physicalValue).toBe('Read Holding Registers');
    expect(functionCode.valid).toBe(true);
  });

  it('infers the response role from the exception bit', () => {
    const { frame } = expectSuccess(parseModbusRtu(EXCEPTION_RESPONSE));
    expect(frame.rawFrame.metadata?.['role']).toBe('response');
    expect(warningCodes(frame)).toContain('protocol.modbus.rtu.warning.roleInferredResponse');
  });

  it('warns when an exception PDU is decoded as a request', () => {
    const { frame } = expectSuccess(parseModbusRtu(EXCEPTION_RESPONSE, 'request'));
    expect(warningCodes(frame)).toContain(
      'protocol.modbus.pdu.warning.exceptionBitInRequest',
    );
  });
});

describe('parseModbusRtu — unknown function code', () => {
  /** 0x63 tabloda yok; CRC geçerli, yani çerçeve yapı olarak sağlam. */
  const UNKNOWN_FUNCTION = bytes('01 63 00 01 30 06');

  it('reports unsupported-function-code but still returns the frame', () => {
    const { frame } = expectSuccess(parseModbusRtu(UNKNOWN_FUNCTION, 'request'));
    expect(frame.errors.map((error) => error.code)).toEqual(['unsupported-function-code']);
    expect(frame.errors[0]?.message).toBe('protocol.modbus.rtu.error.unsupportedFunctionCode');
    expect(frame.errors[0]?.offset).toBe(1);
    expect(frame.valid).toBe(false);
  });

  it('keeps the CRC valid and shows the body as one raw block', () => {
    const { frame } = expectSuccess(parseModbusRtu(UNKNOWN_FUNCTION, 'request'));
    expect(fieldById(frame, 'crc').valid).toBe(true);
    const rawBody = fieldById(frame, 'raw-body');
    expect(rawBody.offset).toBe(2);
    expect(rawBody.length).toBe(2);
    expect(fieldById(frame, 'function-code').valid).toBe(false);
    expect(warningCodes(frame)).toContain(
      'protocol.modbus.pdu.warning.unknownFunctionCode',
    );
  });
});

describe('parseModbusRtu — slave address range', () => {
  it('flags the broadcast address, which never carries a response', () => {
    const { frame } = expectSuccess(parseModbusRtu(bytes('00 06 00 01 00 03 99 DA')));
    const address = fieldById(frame, 'slave-address');
    expect(address.rawValue).toBe(0);
    expect(address.valid).toBe(true);
    expect(address.warnings).toContain('protocol.modbus.rtu.warning.broadcastAddress');
    expect(frame.rawFrame.metadata?.['role']).toBe('request');
  });

  it('marks addresses above 247 as reserved without failing the frame', () => {
    const { frame } = expectSuccess(parseModbusRtu(bytes('F8 03 00 00 00 02 D0 62'), 'request'));
    const address = fieldById(frame, 'slave-address');
    expect(address.rawValue).toBe(0xf8);
    expect(address.valid).toBe(false);
    expect(address.warnings).toContain('protocol.modbus.rtu.warning.reservedSlaveAddress');
    // Alan geçersiz ama çerçeve seviyesinde hata yok: CRC sağlam.
    expect(frame.valid).toBe(true);
  });
});

describe('inferModbusRole', () => {
  it('tells a write-multiple request from its four-byte echo response', () => {
    const request = expectSuccess(parseModbusRtu(bytes('01 10 00 01 00 02 04 00 0A 01 02 92 30')));
    expect(request.frame.rawFrame.metadata?.['role']).toBe('request');
    expect(fieldById(request.frame, 'register-1').rawValue).toBe(0x0102);

    const response = expectSuccess(parseModbusRtu(bytes('01 10 00 01 00 02 10 08')));
    expect(response.frame.rawFrame.metadata?.['role']).toBe('response');
    expect(fieldById(response.frame, 'quantity').rawValue).toBe(2);
  });

  it('treats a broadcast frame as a request even when the body looks like a response', () => {
    expect(inferModbusRole(0x03, bytes('04 00 64 00 C8'), 0)).toBe('request');
    expect(inferModbusRole(0x03, bytes('04 00 64 00 C8'), 1)).toBe('response');
  });

  it('falls back to request for shapes that are identical in both directions', () => {
    // 0x06 (Write Single Register) yanıtı isteğin yankısıdır; telde ayırt edilemez.
    expect(inferModbusRole(0x06, bytes('00 01 00 03'))).toBe('request');
    // Bilinmeyen kodda da tahmin isteğe düşer.
    expect(inferModbusRole(0x63, bytes('00 01'))).toBe('request');
  });
});

describe('modbusRtuParser.canParse', () => {
  it('accepts a frame whose CRC is broken — it must not verify the CRC', () => {
    expect(modbusRtuParser.canParse(CRC_BROKEN_REQUEST)).toBe(true);
    expect(modbusRtuParser.canParse(READ_REQUEST)).toBe(true);
  });

  it('accepts an unknown function code so the unsupported path stays reachable', () => {
    expect(modbusRtuParser.canParse(bytes('01 63 00 01 30 06'))).toBe(true);
  });

  it('rejects lengths outside the RTU range', () => {
    expect(modbusRtuParser.canParse(bytes('01 03 C4'))).toBe(false);
    const oversized = new Uint8Array(MODBUS_RTU_MAX_FRAME_LENGTH + 1);
    oversized[1] = 0x03;
    expect(modbusRtuParser.canParse(oversized)).toBe(false);
    const largestAllowed = new Uint8Array(MODBUS_RTU_MAX_FRAME_LENGTH);
    largestAllowed[1] = 0x03;
    expect(modbusRtuParser.canParse(largestAllowed)).toBe(true);
  });

  it('rejects a zero function code, which no Modbus frame carries', () => {
    expect(modbusRtuParser.canParse(bytes('01 00 00 00'))).toBe(false);
    expect(modbusRtuParser.canParse(bytes('01 80 00 00'))).toBe(false);
  });

  it('stays cheap: fifty thousand calls on a full-length frame', () => {
    const CALL_COUNT = 50_000;
    const BUDGET_MS = 500;
    const frame = new Uint8Array(MODBUS_RTU_MAX_FRAME_LENGTH);
    frame[1] = 0x03;
    const started = performance.now();
    for (let index = 0; index < CALL_COUNT; index++) {
      modbusRtuParser.canParse(frame);
    }
    // Sabit maliyetli olduğu için 256 byte'lık çerçevede bile bütçe rahat rahat yeter;
    // içeriği tarayan bir uygulama bu sınırı geçerdi.
    expect(performance.now() - started).toBeLessThan(BUDGET_MS);
  });
});

describe('modbusRtuParser.parse', () => {
  it('reads the role from the parse context options', () => {
    const { frame } = expectSuccess(
      modbusRtuParser.parse(READ_RESPONSE, { options: { role: 'response' } }),
    );
    expect(frame.rawFrame.metadata?.['roleInferred']).toBe(false);
    expect(fieldById(frame, 'byte-count').rawValue).toBe(4);
  });

  it('carries timestamp, direction and channel into the raw frame', () => {
    const { frame } = expectSuccess(
      modbusRtuParser.parse(READ_REQUEST, {
        timestamp: 1234,
        direction: 'tx',
        channel: 'COM3',
        options: { role: 'request' },
      }),
    );
    expect(frame.timestamp).toBe(1234);
    expect(frame.rawFrame.direction).toBe('tx');
    expect(frame.rawFrame.channel).toBe('COM3');
  });

  it('returns parser-timeout instead of throwing when the signal is aborted', () => {
    const controller = new AbortController();
    controller.abort();
    const result = expectFailure(
      modbusRtuParser.parse(READ_REQUEST, { signal: controller.signal }),
    );
    expect(result.error.code).toBe('parser-timeout');
    expect(result.consumedBytes).toBe(0);
  });

  it('exposes the catalogue id and the display name', () => {
    expect(modbusRtuParser.protocolId).toBe('modbus-rtu');
    expect(modbusRtuParser.displayName).toBe('Modbus RTU');
  });
});

describe('modbusRtuPlugin', () => {
  it('registers under the catalogue id with a parser attached', () => {
    expect(modbusRtuPlugin.id).toBe('modbus-rtu');
    expect(modbusRtuPlugin.category).toBe('industrial-automation');
    expect(modbusRtuPlugin.parser).toBe(modbusRtuParser);
    expect(modbusRtuPlugin.exampleFrames.length).toBeGreaterThanOrEqual(3);
  });

  it('ships the spec fixture as a loadable example', () => {
    const fixture = modbusRtuPlugin.exampleFrames.find(
      (example) => example.id === 'read-holding-registers-request',
    );
    expect(fixture).toBeDefined();
    expect(Array.from(fixture?.bytes ?? [])).toEqual([
      0x01, 0x03, 0x00, 0x00, 0x00, 0x02, 0xc4, 0x0b,
    ]);
  });

  it('decodes every example frame with the validity it declares', () => {
    for (const example of modbusRtuPlugin.exampleFrames) {
      const result = parseModbusRtu(example.bytes);
      const parsed = expectSuccess(result);
      expect(parsed.frame.valid, `example "${example.id}"`).toBe(example.expectedValid);
      expect(modbusRtuParser.canParse(example.bytes), `example "${example.id}"`).toBe(true);
    }
  });

  it('keeps every visible example string as a translation key', () => {
    for (const example of modbusRtuPlugin.exampleFrames) {
      expect(example.name.startsWith('protocol.modbus.rtu.example.')).toBe(true);
      expect(example.description?.startsWith('protocol.modbus.rtu.example.')).toBe(true);
    }
    expect(modbusRtuPlugin.documentation?.summary).toBe(
      'protocol.modbus.rtu.documentation.summary',
    );
  });
});
