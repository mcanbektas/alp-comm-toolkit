import { describe, expect, it } from 'vitest';

import {
  MODBUS_EXCEPTION_CODES,
  MODBUS_FUNCTION_CODES,
  decodePdu,
  describeAddress,
  getExceptionCodeInfo,
  getFunctionCodeInfo,
  isExceptionResponse,
} from './modbusPdu';
import type { ParsedField } from '@/protocol-core/types';

/** Test fixture'ları spec'teki gibi hex yazılır; okunurluk byte dizisi kurmaktan önemli. */
function bytes(hex: string): Uint8Array {
  const cleaned = hex.replace(/\s+/g, '');
  const result = new Uint8Array(cleaned.length / 2);
  for (let index = 0; index < result.length; index++) {
    result[index] = Number.parseInt(cleaned.slice(index * 2, index * 2 + 2), 16);
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

describe('MODBUS_FUNCTION_CODES', () => {
  it('lists exactly the eleven function codes the spec enumerates', () => {
    expect(MODBUS_FUNCTION_CODES.map((info) => info.code)).toEqual([
      0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x0f, 0x10, 0x16, 0x17, 0x2b,
    ]);
  });

  it('names every function code and keeps the names unique', () => {
    const names = MODBUS_FUNCTION_CODES.map((info) => info.name);
    expect(new Set(names).size).toBe(names.length);
    expect(getFunctionCodeInfo(0x03)?.name).toBe('Read Holding Registers');
    expect(getFunctionCodeInfo(0x2b)?.name).toBe('Encapsulated Interface Transport');
  });

  it('gives every function code its own summary translation key', () => {
    const keys = MODBUS_FUNCTION_CODES.map((info) => info.summaryKey);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys.every((key) => key.startsWith('protocol.modbus.pdu.summary.'))).toBe(true);
  });

  it('returns undefined for a code outside the table', () => {
    expect(getFunctionCodeInfo(0x63)).toBeUndefined();
  });
});

describe('MODBUS_EXCEPTION_CODES', () => {
  it('carries the standard exception table including the spec example', () => {
    expect(MODBUS_EXCEPTION_CODES.map((info) => info.code)).toEqual([
      0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x08, 0x0a, 0x0b,
    ]);
    expect(getExceptionCodeInfo(0x02)?.name).toBe('Illegal Data Address');
  });

  it('leaves 0x07 and 0x09 undefined because the standard table has no such codes', () => {
    expect(getExceptionCodeInfo(0x07)).toBeUndefined();
    expect(getExceptionCodeInfo(0x09)).toBeUndefined();
  });
});

describe('isExceptionResponse', () => {
  it('detects the 0x80 flag and leaves normal codes alone', () => {
    expect(isExceptionResponse(0x03)).toBe(false);
    expect(isExceptionResponse(0x2b)).toBe(false);
    expect(isExceptionResponse(0x83)).toBe(true);
    expect(isExceptionResponse(0xab)).toBe(true);
    expect(isExceptionResponse(0x90)).toBe(true);
  });
});

describe('decodePdu — spec fixture 01 03 00 00 00 02 C4 0B', () => {
  it('decodes the PDU 03 00 00 00 02 as Read Holding Registers, start 0, quantity 2', () => {
    const result = decodePdu(0x03, bytes('00 00 00 02'), 'request');

    expect(result.summaryKey).toBe('protocol.modbus.pdu.summary.readHoldingRegisters');
    expect(result.warnings).toEqual([]);
    expect(fieldById(result.fields, 'start-address').rawValue).toBe(0);
    expect(fieldById(result.fields, 'quantity').rawValue).toBe(2);
    expect(result.summaryParams.startAddress).toBe('0');
    expect(result.summaryParams.quantity).toBe('2');
    expect(result.summaryParams.functionName).toBe('Read Holding Registers');
    expect(result.summaryParams.functionCode).toBe('0x03');
  });

  it('reports field offsets relative to the PDU body, not to the RTU frame', () => {
    const result = decodePdu(0x03, bytes('00 00 00 02'), 'request');

    // Taşıma katmanı RTU'da +2 ekleyecek; motorun kendisi 0'dan saymalı.
    expect(fieldById(result.fields, 'start-address').offset).toBe(0);
    expect(fieldById(result.fields, 'quantity').offset).toBe(2);
    expect(fieldById(result.fields, 'quantity').length).toBe(2);
  });

  it('maps the wire start address 0 to documentation address 40001', () => {
    const result = decodePdu(0x03, bytes('00 00 00 02'), 'request');

    expect(fieldById(result.fields, 'start-address').physicalValue).toBe(40001);
    expect(result.summaryParams.documentationStartAddress).toBe('40001');
    expect(result.summaryParams.documentationEndAddress).toBe('40002');
  });

  it('decodes the matching response 03 04 00 64 00 C8 into registers 100 and 200', () => {
    const result = decodePdu(0x03, bytes('04 00 64 00 C8'), 'response');

    expect(result.warnings).toEqual([]);
    expect(fieldById(result.fields, 'byte-count').rawValue).toBe(4);
    expect(fieldById(result.fields, 'register-0').rawValue).toBe(100);
    expect(fieldById(result.fields, 'register-1').rawValue).toBe(200);
    expect(fieldById(result.fields, 'register-0').name).toBe('Register 0');
    expect(result.summaryParams.registerCount).toBe('2');
  });

  it('produces the same decode for the RTU, ASCII and TCP forms of that request', () => {
    // Spec §3.3'ün üç örneği aynı PDU'yu taşır; taşıma katmanının kestiği yer farklıdır:
    // RTU  `01 03 00 00 00 02 C4 0B` → gövde 2. byte'tan CRC'ye kadar,
    // ASCII `:010300000002FA\r\n` → çözülmüş byte'larda yine 2. byte'tan LRC'ye kadar,
    // TCP   `00 01 00 00 00 06 01 03 00 00 00 02` → MBAP (7) + function code sonrası.
    const rtuFrame = bytes('01 03 00 00 00 02 C4 0B');
    const asciiDecodedBytes = bytes('01 03 00 00 00 02 FA');
    const tcpFrame = bytes('00 01 00 00 00 06 01 03 00 00 00 02');

    const rtu = decodePdu(0x03, rtuFrame.slice(2, rtuFrame.length - 2), 'request');
    const ascii = decodePdu(
      0x03,
      asciiDecodedBytes.slice(2, asciiDecodedBytes.length - 1),
      'request',
    );
    const tcp = decodePdu(0x03, tcpFrame.slice(8), 'request');

    expect(rtu.warnings).toEqual([]);
    expect(ascii.summaryParams).toEqual(rtu.summaryParams);
    expect(tcp.summaryParams).toEqual(rtu.summaryParams);
    expect(ascii.fields.map((field) => field.rawValue)).toEqual(
      rtu.fields.map((field) => field.rawValue),
    );
    expect(tcp.fields.map((field) => field.offset)).toEqual([0, 2]);
  });
});

describe('decodePdu — bit oriented function codes', () => {
  it('decodes a Read Coils request against the coil address space', () => {
    const result = decodePdu(0x01, bytes('00 13 00 25'), 'request');

    expect(result.summaryKey).toBe('protocol.modbus.pdu.summary.readCoils');
    expect(fieldById(result.fields, 'start-address').rawValue).toBe(0x13);
    expect(fieldById(result.fields, 'start-address').physicalValue).toBe(20);
    expect(fieldById(result.fields, 'quantity').rawValue).toBe(0x25);
  });

  it('keeps a Read Coils response as one packed block instead of inventing bit fields', () => {
    const result = decodePdu(0x01, bytes('03 CD 6B 05'), 'response');

    expect(fieldById(result.fields, 'byte-count').rawValue).toBe(3);
    const data = fieldById(result.fields, 'data');
    expect(data.name).toBe('Coil Status');
    expect(data.length).toBe(3);
    expect(data.rawValue).toBeUndefined();
    expect(result.warnings).toEqual([]);
  });

  it('decodes a Read Discrete Inputs request with the 10001 documentation base', () => {
    const result = decodePdu(0x02, bytes('00 C4 00 16'), 'request');

    expect(result.summaryKey).toBe('protocol.modbus.pdu.summary.readDiscreteInputs');
    expect(fieldById(result.fields, 'start-address').physicalValue).toBe(10197);
    expect(result.summaryParams.documentationStartAddress).toBe('10197');
  });

  it('decodes a Read Discrete Inputs response as an input status block', () => {
    const result = decodePdu(0x02, bytes('03 AC DB 35'), 'response');

    expect(fieldById(result.fields, 'data').name).toBe('Input Status');
    expect(result.summaryParams.byteCount).toBe('3');
  });
});

describe('decodePdu — register reads', () => {
  it('decodes a Read Input Registers request with the 30001 documentation base', () => {
    const result = decodePdu(0x04, bytes('00 08 00 01'), 'request');

    expect(result.summaryKey).toBe('protocol.modbus.pdu.summary.readInputRegisters');
    expect(fieldById(result.fields, 'start-address').physicalValue).toBe(30009);
  });

  it('decodes a Read Input Registers response into a single register', () => {
    const result = decodePdu(0x04, bytes('02 00 0A'), 'response');

    expect(fieldById(result.fields, 'register-0').rawValue).toBe(10);
    expect(result.summaryParams.registerCount).toBe('1');
  });
});

describe('decodePdu — single writes', () => {
  it('decodes Write Single Coil ON (0xFF00) with a semantic physical value', () => {
    const result = decodePdu(0x05, bytes('00 AC FF 00'), 'request');

    expect(result.summaryKey).toBe('protocol.modbus.pdu.summary.writeSingleCoil');
    expect(fieldById(result.fields, 'output-address').rawValue).toBe(0xac);
    expect(fieldById(result.fields, 'output-value').physicalValue).toBe('ON');
    expect(result.warnings).toEqual([]);
  });

  it('decodes the Write Single Coil response echo the same way as the request', () => {
    const request = decodePdu(0x05, bytes('00 AC 00 00'), 'request');
    const response = decodePdu(0x05, bytes('00 AC 00 00'), 'response');

    expect(fieldById(response.fields, 'output-value').physicalValue).toBe('OFF');
    expect(response.fields.map((field) => field.id)).toEqual(
      request.fields.map((field) => field.id),
    );
  });

  it('warns when a coil is written with a value other than 0xFF00 / 0x0000', () => {
    const result = decodePdu(0x05, bytes('00 AC 00 01'), 'request');

    expect(result.warnings).toContain('protocol.modbus.pdu.warning.illegalCoilValue');
    expect(fieldById(result.fields, 'output-value').valid).toBe(false);
  });

  it('decodes Write Single Register with register field names and a holding address', () => {
    const result = decodePdu(0x06, bytes('00 01 00 03'), 'request');

    expect(result.summaryKey).toBe('protocol.modbus.pdu.summary.writeSingleRegister');
    expect(fieldById(result.fields, 'register-address').physicalValue).toBe(40002);
    expect(fieldById(result.fields, 'register-value').rawValue).toBe(3);
    expect(result.summaryParams.documentationAddress).toBe('40002');
  });
});

describe('decodePdu — multiple writes', () => {
  it('decodes a Write Multiple Coils request with its packed output block', () => {
    const result = decodePdu(0x0f, bytes('00 13 00 0A 02 CD 01'), 'request');

    expect(result.summaryKey).toBe('protocol.modbus.pdu.summary.writeMultipleCoils');
    expect(fieldById(result.fields, 'quantity').rawValue).toBe(10);
    expect(fieldById(result.fields, 'byte-count').rawValue).toBe(2);
    expect(fieldById(result.fields, 'data').length).toBe(2);
    expect(result.warnings).toEqual([]);
  });

  it('decodes a Write Multiple Coils response as address plus quantity only', () => {
    const result = decodePdu(0x0f, bytes('00 13 00 0A'), 'response');

    expect(result.fields.map((field) => field.id)).toEqual(['start-address', 'quantity']);
    expect(result.summaryParams.quantity).toBe('10');
  });

  it('decodes a Write Multiple Registers request into individual registers', () => {
    const result = decodePdu(0x10, bytes('00 01 00 02 04 00 0A 01 02'), 'request');

    expect(result.summaryKey).toBe('protocol.modbus.pdu.summary.writeMultipleRegisters');
    expect(fieldById(result.fields, 'register-0').rawValue).toBe(0x000a);
    expect(fieldById(result.fields, 'register-1').rawValue).toBe(0x0102);
    expect(fieldById(result.fields, 'byte-count').offset).toBe(4);
  });

  it('decodes a Write Multiple Registers response as address plus quantity only', () => {
    const result = decodePdu(0x10, bytes('00 01 00 02'), 'response');

    expect(result.fields).toHaveLength(2);
    expect(result.summaryParams.documentationStartAddress).toBe('40002');
  });
});

describe('decodePdu — mask write and read/write multiple', () => {
  it('decodes a Mask Write Register request with hex masks', () => {
    const result = decodePdu(0x16, bytes('00 04 00 F2 00 25'), 'request');

    expect(result.summaryKey).toBe('protocol.modbus.pdu.summary.maskWriteRegister');
    expect(fieldById(result.fields, 'reference-address').physicalValue).toBe(40005);
    expect(fieldById(result.fields, 'and-mask').rawValue).toBe(0x00f2);
    expect(fieldById(result.fields, 'or-mask').rawValue).toBe(0x0025);
    expect(result.summaryParams.andMask).toBe('0x00F2');
    expect(result.summaryParams.orMask).toBe('0x0025');
  });

  it('decodes the Mask Write Register response echo identically', () => {
    const result = decodePdu(0x16, bytes('00 04 00 F2 00 25'), 'response');

    expect(result.fields.map((field) => field.id)).toEqual([
      'reference-address',
      'and-mask',
      'or-mask',
    ]);
  });

  it('decodes a Read/Write Multiple Registers request with both address ranges', () => {
    const result = decodePdu(0x17, bytes('00 03 00 06 00 0E 00 03 06 00 FF 00 FF 00 FF'), 'request');

    expect(result.summaryKey).toBe('protocol.modbus.pdu.summary.readWriteMultipleRegisters');
    expect(fieldById(result.fields, 'read-start-address').rawValue).toBe(3);
    expect(fieldById(result.fields, 'read-quantity').rawValue).toBe(6);
    expect(fieldById(result.fields, 'write-start-address').rawValue).toBe(14);
    expect(fieldById(result.fields, 'write-quantity').rawValue).toBe(3);
    expect(fieldById(result.fields, 'write-byte-count').rawValue).toBe(6);
    expect(result.summaryParams.readDocumentationStartAddress).toBe('40004');
    expect(result.summaryParams.writeDocumentationStartAddress).toBe('40015');
    expect(fieldById(result.fields, 'register-2').rawValue).toBe(0x00ff);
  });

  it('decodes the Read/Write Multiple Registers response as read registers only', () => {
    const result = decodePdu(0x17, bytes('04 00 FE 0A CD'), 'response');

    expect(fieldById(result.fields, 'register-0').rawValue).toBe(0x00fe);
    expect(fieldById(result.fields, 'register-1').rawValue).toBe(0x0acd);
    expect(result.summaryParams.registerCount).toBe('2');
  });
});

describe('decodePdu — encapsulated interface transport', () => {
  it('decodes the MEI type and leaves the encapsulated payload raw', () => {
    const result = decodePdu(0x2b, bytes('0E 01 00'), 'request');

    expect(result.summaryKey).toBe('protocol.modbus.pdu.summary.encapsulatedInterfaceTransport');
    expect(fieldById(result.fields, 'mei-type').rawValue).toBe(0x0e);
    expect(result.summaryParams.meiType).toBe('0x0E');
    expect(fieldById(result.fields, 'mei-data').length).toBe(2);
    expect(fieldById(result.fields, 'mei-data').rawValue).toBeUndefined();
  });
});

describe('decodePdu — exception responses', () => {
  it('decodes the spec example: function 0x03 answered with Illegal Data Address', () => {
    const result = decodePdu(0x83, bytes('02'), 'response');

    expect(result.summaryKey).toBe('protocol.modbus.pdu.summary.exceptionResponse');
    expect(result.summaryParams.originalFunctionCode).toBe('0x03');
    expect(result.summaryParams.originalFunctionName).toBe('Read Holding Registers');
    expect(result.summaryParams.exceptionName).toBe('Illegal Data Address');
    expect(fieldById(result.fields, 'exception-code').physicalValue).toBe('Illegal Data Address');
    expect(result.warnings).toEqual([]);
  });

  it('warns but still decodes an exception code missing from the table', () => {
    const result = decodePdu(0x83, bytes('07'), 'response');

    expect(result.warnings).toContain('protocol.modbus.pdu.warning.unknownExceptionCode');
    expect(fieldById(result.fields, 'exception-code').rawValue).toBe(7);
    expect(result.summaryParams.exceptionName).toBeUndefined();
  });

  it('warns when the exception response carries no exception code byte', () => {
    const result = decodePdu(0x83, new Uint8Array(0), 'response');

    expect(result.warnings).toEqual(['protocol.modbus.pdu.warning.missingExceptionCode']);
    expect(result.fields).toEqual([]);
  });

  it('warns when a request PDU carries the exception flag', () => {
    const result = decodePdu(0x83, bytes('02'), 'request');

    expect(result.warnings).toContain('protocol.modbus.pdu.warning.exceptionBitInRequest');
  });
});

describe('decodePdu — malformed and unknown bodies', () => {
  it('treats an unknown function code as raw data plus a warning, not an error', () => {
    const result = decodePdu(0x63, bytes('01 02 03'), 'request');

    expect(result.summaryKey).toBe('protocol.modbus.pdu.summary.unknownFunctionCode');
    expect(result.warnings).toEqual(['protocol.modbus.pdu.warning.unknownFunctionCode']);
    expect(fieldById(result.fields, 'raw-body').length).toBe(3);
    expect(result.summaryParams.functionCode).toBe('0x63');
  });

  it('flags a truncated read request and keeps the partial field', () => {
    const result = decodePdu(0x03, bytes('00 00 00'), 'request');

    expect(result.warnings).toContain('protocol.modbus.pdu.warning.truncatedBody');
    const quantity = fieldById(result.fields, 'quantity');
    expect(quantity.valid).toBe(false);
    expect(quantity.length).toBe(1);
    expect(quantity.warnings).toContain('protocol.modbus.pdu.warning.truncatedField');
    expect(result.summaryParams.quantity).toBeUndefined();
  });

  it('reports an empty body without inventing zero length fields', () => {
    const result = decodePdu(0x03, new Uint8Array(0), 'request');

    expect(result.warnings).toEqual(['protocol.modbus.pdu.warning.emptyBody']);
    expect(result.fields).toEqual([]);
    expect(result.summaryKey).toBe('protocol.modbus.pdu.summary.readHoldingRegisters');
  });

  it('flags a byte count that promises more data than the body holds', () => {
    const result = decodePdu(0x03, bytes('04 00 64'), 'response');

    expect(result.warnings).toContain('protocol.modbus.pdu.warning.byteCountMismatch');
    expect(fieldById(result.fields, 'byte-count').valid).toBe(false);
    expect(fieldById(result.fields, 'register-0').rawValue).toBe(100);
  });

  it('flags an odd register byte count', () => {
    const result = decodePdu(0x03, bytes('03 00 64 00'), 'response');

    expect(result.warnings).toContain('protocol.modbus.pdu.warning.oddRegisterByteCount');
    expect(fieldById(result.fields, 'register-0').rawValue).toBe(100);
  });

  it('exposes leftover bytes as a trailing field instead of hiding them', () => {
    const result = decodePdu(0x03, bytes('00 00 00 02 FF'), 'request');

    expect(result.warnings).toContain('protocol.modbus.pdu.warning.trailingBytes');
    const trailing = fieldById(result.fields, 'trailing-data');
    expect(trailing.offset).toBe(4);
    expect(trailing.length).toBe(1);
    expect(trailing.valid).toBe(false);
  });

  it('warns when a request asks for zero items', () => {
    const result = decodePdu(0x03, bytes('00 00 00 00'), 'request');

    expect(result.warnings).toContain('protocol.modbus.pdu.warning.zeroQuantity');
    expect(result.summaryParams.documentationEndAddress).toBe('40001');
  });

  it('never throws on random short bodies for any function code', () => {
    for (const info of MODBUS_FUNCTION_CODES) {
      for (const role of ['request', 'response'] as const) {
        expect(() => decodePdu(info.code, bytes('01'), role)).not.toThrow();
        expect(() => decodePdu(info.code, new Uint8Array(0), role)).not.toThrow();
      }
    }
  });
});

describe('describeAddress', () => {
  it('separates the 0-based wire address from the 1-based documentation address (coil)', () => {
    const description = describeAddress(0, 8, 0x01);

    expect(description.addressSpace).toBe('coil');
    expect(description.entityLabel).toBe('Coil');
    expect(description.wireStartAddress).toBe(0);
    expect(description.wireEndAddress).toBe(7);
    expect(description.documentationBase).toBe(1);
    expect(description.documentationStartAddress).toBe(1);
    expect(description.documentationEndAddress).toBe(8);
  });

  it('uses the 10001 block for discrete inputs', () => {
    const description = describeAddress(0, 1, 0x02);

    expect(description.addressSpace).toBe('discrete-input');
    expect(description.documentationBase).toBe(10001);
    expect(description.documentationStartAddress).toBe(10001);
  });

  it('uses the 30001 block for input registers', () => {
    const description = describeAddress(7, 2, 0x04);

    expect(description.addressSpace).toBe('input-register');
    expect(description.documentationStartAddress).toBe(30008);
    expect(description.documentationEndAddress).toBe(30009);
  });

  it('uses the 40001 block for holding registers (spec drill-down example)', () => {
    const description = describeAddress(0, 10, 0x03);

    expect(description.addressSpace).toBe('holding-register');
    expect(description.entityLabel).toBe('Holding Register');
    expect(description.documentationStartAddress).toBe(40001);
    expect(description.documentationEndAddress).toBe(40010);
  });

  it('routes every writing function code to its own address space', () => {
    expect(describeAddress(0, 1, 0x05).addressSpace).toBe('coil');
    expect(describeAddress(0, 1, 0x0f).addressSpace).toBe('coil');
    expect(describeAddress(0, 1, 0x06).addressSpace).toBe('holding-register');
    expect(describeAddress(0, 1, 0x10).addressSpace).toBe('holding-register');
    expect(describeAddress(0, 1, 0x16).addressSpace).toBe('holding-register');
    expect(describeAddress(0, 1, 0x17).addressSpace).toBe('holding-register');
  });

  it('falls back to a plain 1-based count for address-less or unknown function codes', () => {
    expect(describeAddress(0, 1, 0x2b).addressSpace).toBe('none');
    expect(describeAddress(4, 1, 0x63).documentationStartAddress).toBe(5);
    expect(describeAddress(4, 1, 0x63).documentationBase).toBe(1);
  });

  it('collapses an empty range instead of producing a reversed one', () => {
    const description = describeAddress(10, 0, 0x03);

    expect(description.wireEndAddress).toBe(10);
    expect(description.documentationStartAddress).toBe(40011);
    expect(description.documentationEndAddress).toBe(40011);
  });

  it('rejects negative or fractional inputs', () => {
    expect(() => describeAddress(-1, 1, 0x03)).toThrow(RangeError);
    expect(() => describeAddress(0, -1, 0x03)).toThrow(RangeError);
    expect(() => describeAddress(1.5, 1, 0x03)).toThrow(RangeError);
  });
});
