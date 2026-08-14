import { describe, expect, it } from 'vitest';

import { modbusTcpParser, modbusTcpPlugin, parseModbusTcp } from './modbusTcp';
import type { ParseFailure, ParseSuccess, ParsedField, ParseResult } from '@/protocol-core/types';

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
    throw new Error(`expected success, got error ${result.error.code} (${result.error.message})`);
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

/** Spec §3.3 Modbus TCP: `00 01|00 00|00 06|01|03 00 00 00 02` → TID=1, PID=0, Len=6, UID=1. */
const SPEC_REQUEST = bytes('00 01 00 00 00 06 01 03 00 00 00 02');
/** Spec §3.3 RTU yanıtının (`01 03 04 00 64 00 C8`) MBAP'a sarılmış hâli; Len = 1 + 6 = 7. */
const SPEC_RESPONSE = bytes('00 01 00 00 00 07 01 03 04 00 64 00 C8');

describe('parseModbusTcp — MBAP header', () => {
  it('decodes the spec request frame field by field', () => {
    const { frame, consumedBytes } = expectSuccess(parseModbusTcp(SPEC_REQUEST));

    expect(consumedBytes).toBe(SPEC_REQUEST.length);
    expect(frame.protocol).toBe('modbus-tcp');
    expect(frame.valid).toBe(true);
    expect(frame.errors).toEqual([]);
    expect(frame.warnings).toEqual([]);
    expect(fieldById(frame.fields, 'transaction-id').rawValue).toBe(1);
    expect(fieldById(frame.fields, 'protocol-id').rawValue).toBe(0);
    expect(fieldById(frame.fields, 'length').rawValue).toBe(6);
    expect(fieldById(frame.fields, 'unit-id').rawValue).toBe(1);
    expect(fieldById(frame.fields, 'function-code').rawValue).toBe(0x03);
    expect(fieldById(frame.fields, 'function-code').physicalValue).toBe('Read Holding Registers');
  });

  it('places the MBAP fields at their fixed offsets', () => {
    const { frame } = expectSuccess(parseModbusTcp(SPEC_REQUEST));

    expect(fieldById(frame.fields, 'transaction-id').offset).toBe(0);
    expect(fieldById(frame.fields, 'protocol-id').offset).toBe(2);
    expect(fieldById(frame.fields, 'length').offset).toBe(4);
    expect(fieldById(frame.fields, 'unit-id').offset).toBe(6);
    expect(fieldById(frame.fields, 'function-code').offset).toBe(7);
    expect(fieldById(frame.fields, 'unit-id').length).toBe(1);
    expect(fieldById(frame.fields, 'transaction-id').length).toBe(2);
  });

  it('reads the transaction id as big-endian', () => {
    const { frame } = expectSuccess(parseModbusTcp(bytes('12 34 00 00 00 06 01 03 00 00 00 02')));

    expect(fieldById(frame.fields, 'transaction-id').rawValue).toBe(0x1234);
  });

  it('exposes the total frame length as the physical value of the length field', () => {
    // Tel değeri Unit ID'den itibaren sayar (6); kullanıcının saydığı toplam 12'dir.
    const { frame } = expectSuccess(parseModbusTcp(SPEC_REQUEST));
    const length = fieldById(frame.fields, 'length');

    expect(length.rawValue).toBe(6);
    expect(length.physicalValue).toBe(12);
  });

  it('accepts a gateway unit id of 0xFF', () => {
    const { frame } = expectSuccess(parseModbusTcp(bytes('00 01 00 00 00 06 FF 03 00 00 00 02')));

    expect(fieldById(frame.fields, 'unit-id').rawValue).toBe(0xff);
    expect(frame.valid).toBe(true);
  });
});

describe('parseModbusTcp — PDU handoff', () => {
  it('shifts every PDU field offset by the 8-byte MBAP + function code prefix', () => {
    const { frame } = expectSuccess(parseModbusTcp(SPEC_REQUEST));

    expect(fieldById(frame.fields, 'start-address').offset).toBe(8);
    expect(fieldById(frame.fields, 'quantity').offset).toBe(10);
  });

  it('resolves documentation addresses through the PDU decoder', () => {
    const { frame } = expectSuccess(parseModbusTcp(SPEC_REQUEST));

    expect(fieldById(frame.fields, 'start-address').rawValue).toBe(0);
    expect(fieldById(frame.fields, 'start-address').physicalValue).toBe(40001);
    expect(fieldById(frame.fields, 'quantity').rawValue).toBe(2);
  });

  it('decodes the response registers of the spec example', () => {
    const { frame, consumedBytes } = expectSuccess(parseModbusTcp(SPEC_RESPONSE, 'response'));

    expect(consumedBytes).toBe(13);
    expect(fieldById(frame.fields, 'byte-count').rawValue).toBe(4);
    expect(fieldById(frame.fields, 'register-0').rawValue).toBe(100);
    expect(fieldById(frame.fields, 'register-1').rawValue).toBe(200);
    expect(fieldById(frame.fields, 'register-0').offset).toBe(9);
    expect(fieldById(frame.fields, 'register-1').offset).toBe(11);
    expect(frame.valid).toBe(true);
  });

  it('never reports a CRC problem — TCP carries no checksum of its own', () => {
    // Aynı PDU'nun RTU karşılığı CRC ister; burada son iki bayt veridir, checksum değil.
    const results = [parseModbusTcp(SPEC_REQUEST), parseModbusTcp(SPEC_RESPONSE, 'response')];

    for (const result of results) {
      const { frame } = expectSuccess(result);
      expect(frame.errors).toEqual([]);
      expect(frame.warnings.map((warning) => warning.code)).not.toContain('crc-mismatch');
    }
  });

  it('carries the summary key and params on the raw frame metadata', () => {
    const { frame } = expectSuccess(parseModbusTcp(SPEC_REQUEST));

    expect(frame.rawFrame.metadata?.modbusSummaryKey).toBe(
      'protocol.modbus.pdu.summary.readHoldingRegisters',
    );
    expect(frame.rawFrame.metadata?.modbusSummaryParams).toMatchObject({
      functionCode: '0x03',
      startAddress: '0',
      quantity: '2',
      documentationStartAddress: '40001',
      documentationEndAddress: '40002',
    });
    expect(frame.rawFrame.metadata?.modbusRole).toBe('request');
  });

  it('surfaces PDU warnings such as trailing bytes inside the declared length', () => {
    // Len=8 → gövde 6 bayt, oysa FC 0x03 isteği 4 bayt okur: kalan 2 bayt artıktır.
    const { frame } = expectSuccess(parseModbusTcp(bytes('00 01 00 00 00 08 01 03 00 00 00 02 AA BB')));

    expect(fieldById(frame.fields, 'trailing-data').offset).toBe(12);
    expect(frame.warnings.map((warning) => warning.code)).toContain(
      'protocol.modbus.pdu.warning.trailingBytes',
    );
    expect(frame.valid).toBe(false);
  });

  it('treats an unknown function code as a warning, not an unsupported-function-code error', () => {
    const { frame } = expectSuccess(parseModbusTcp(bytes('00 01 00 00 00 04 01 63 AA BB')));

    expect(frame.errors).toEqual([]);
    expect(fieldById(frame.fields, 'raw-body').rawBytes).toEqual(bytes('AA BB'));
    expect(frame.warnings.map((warning) => warning.code)).toContain(
      'protocol.modbus.pdu.warning.unknownFunctionCode',
    );
    expect(frame.valid).toBe(false);
  });

  it('decodes a write multiple registers request', () => {
    // Len=11 = UID + FC + start(2) + qty(2) + byteCount(1) + 4 veri baytı.
    const { frame } = expectSuccess(
      parseModbusTcp(bytes('00 05 00 00 00 0B 01 10 00 10 00 02 04 00 0A 00 14')),
    );

    expect(fieldById(frame.fields, 'start-address').physicalValue).toBe(40017);
    expect(fieldById(frame.fields, 'quantity').rawValue).toBe(2);
    expect(fieldById(frame.fields, 'byte-count').rawValue).toBe(4);
    expect(fieldById(frame.fields, 'register-0').rawValue).toBe(10);
    expect(fieldById(frame.fields, 'register-1').rawValue).toBe(20);
    expect(frame.valid).toBe(true);
  });
});

describe('parseModbusTcp — exception responses', () => {
  const EXCEPTION_FRAME = bytes('00 02 00 00 00 03 01 83 02');

  it('decodes an exception response and names the exception', () => {
    const { frame } = expectSuccess(parseModbusTcp(EXCEPTION_FRAME));

    expect(fieldById(frame.fields, 'function-code').rawValue).toBe(0x83);
    expect(fieldById(frame.fields, 'exception-code').rawValue).toBe(0x02);
    expect(fieldById(frame.fields, 'exception-code').physicalValue).toBe('Illegal Data Address');
    expect(fieldById(frame.fields, 'exception-code').offset).toBe(8);
    expect(frame.valid).toBe(true);
  });

  it('infers the response role from the 0x80 flag when the caller gives none', () => {
    const { frame } = expectSuccess(parseModbusTcp(EXCEPTION_FRAME));

    expect(frame.rawFrame.metadata?.modbusRole).toBe('response');
    expect(frame.rawFrame.metadata?.modbusSummaryKey).toBe(
      'protocol.modbus.pdu.summary.exceptionResponse',
    );
    expect(frame.warnings).toEqual([]);
  });

  it('keeps the explicit request role so the misplaced exception bit is reported', () => {
    const { frame } = expectSuccess(parseModbusTcp(EXCEPTION_FRAME, 'request'));

    expect(frame.rawFrame.metadata?.modbusRole).toBe('request');
    expect(frame.warnings.map((warning) => warning.code)).toContain(
      'protocol.modbus.pdu.warning.exceptionBitInRequest',
    );
    expect(frame.valid).toBe(false);
  });

  it('shows which function was rejected next to the exception code', () => {
    const { frame } = expectSuccess(parseModbusTcp(EXCEPTION_FRAME));

    expect(fieldById(frame.fields, 'function-code').physicalValue).toBe('Read Holding Registers');
  });
});

describe('parseModbusTcp — length field', () => {
  it('fails with length-mismatch when the frame is shorter than the length field promises', () => {
    // Len=9 → 15 baytlık çerçeve bekleniyor, telde 12 bayt var.
    const failure = expectFailure(parseModbusTcp(bytes('00 01 00 00 00 09 01 03 00 00 00 02')));

    expect(failure.error.code).toBe('length-mismatch');
    // Spec §42'nin hata mesajı listesinden birebir; kullanıcıya gösterilen etiketi
    // arayüz `error.code` üzerinden çevirir.
    expect(failure.error.message).toBe('Frame length does not match the length field');
    expect(failure.error.offset).toBe(4);
    expect(failure.error.details).toMatchObject({
      declaredLength: 9,
      expectedFrameLength: 15,
      availableBytes: 12,
    });
    // Eksik olan yalnız zaman olabilir (ADU birden çok TCP segmentine bölünmüş).
    expect(failure.recoverable).toBe(true);
    expect(failure.consumedBytes).toBe(0);
  });

  it('abandons the stream when the length field cannot even cover unit id + function code', () => {
    const failure = expectFailure(parseModbusTcp(bytes('00 01 00 00 00 01 01 03')));

    expect(failure.error.code).toBe('length-mismatch');
    expect(failure.error.details).toMatchObject({ declaredLength: 1, minimumLength: 2 });
    // Veri eklenerek düzelmez ve TCP'de resenkronize olunacak başlangıç damgası yok.
    expect(failure.recoverable).toBe(false);
  });

  it('warns but still decodes when the length field exceeds the 254-byte PDU limit', () => {
    const header = bytes('00 01 00 00 01 00 01 03');
    const frameBytes = new Uint8Array(6 + 256);
    frameBytes.set(header, 0);

    const { frame, consumedBytes } = expectSuccess(parseModbusTcp(frameBytes, 'response'));

    expect(consumedBytes).toBe(262);
    expect(frame.warnings.map((warning) => warning.code)).toContain(
      'protocol.modbus.tcp.warning.oversizedLength',
    );
    expect(fieldById(frame.fields, 'length').warnings).toContain(
      'protocol.modbus.tcp.warning.oversizedLength',
    );
  });

  it('stops before allocating when the declared frame exceeds maxFrameLength', () => {
    const failure = expectFailure(
      parseModbusTcp(bytes('00 01 00 00 01 00 01 03'), 'response', { maxFrameLength: 260 }),
    );

    expect(failure.error.code).toBe('frame-too-long');
    expect(failure.error.details).toMatchObject({ frameLength: 262, maxFrameLength: 260 });
    expect(failure.recoverable).toBe(false);
  });
});

describe('parseModbusTcp — short and malformed input', () => {
  it('reports a truncated frame when fewer than eight bytes are available', () => {
    const failure = expectFailure(parseModbusTcp(bytes('00 01 00 00 00 06 01')));

    expect(failure.error.code).toBe('truncated-frame');
    expect(failure.error.message).toBe('Frame is shorter than the MBAP header and function code');
    expect(failure.error.details).toMatchObject({ availableBytes: 7, requiredBytes: 8 });
    expect(failure.recoverable).toBe(true);
    expect(failure.consumedBytes).toBe(0);
  });

  it('reports a truncated frame for an empty buffer', () => {
    const failure = expectFailure(parseModbusTcp(new Uint8Array()));

    expect(failure.error.code).toBe('truncated-frame');
    expect(failure.consumedBytes).toBe(0);
  });

  it('warns instead of failing when the protocol id is not zero', () => {
    const { frame } = expectSuccess(parseModbusTcp(bytes('00 01 00 07 00 06 01 03 00 00 00 02')));

    expect(frame.errors).toEqual([]);
    expect(fieldById(frame.fields, 'protocol-id').rawValue).toBe(7);
    expect(fieldById(frame.fields, 'protocol-id').valid).toBe(false);
    expect(frame.warnings.map((warning) => warning.code)).toContain(
      'protocol.modbus.tcp.warning.unexpectedProtocolId',
    );
    expect(frame.valid).toBe(false);
    // Kuşkulu başlığa rağmen PDU yine çözülür: kullanıcı baytları görmeli.
    expect(fieldById(frame.fields, 'quantity').rawValue).toBe(2);
  });

  it('returns parser-timeout without throwing when the caller has aborted', () => {
    const controller = new AbortController();
    controller.abort();

    const failure = expectFailure(parseModbusTcp(SPEC_REQUEST, 'request', { signal: controller.signal }));

    expect(failure.error.code).toBe('parser-timeout');
    expect(failure.error.message).toBe('Parsing was aborted by the caller');
    expect(failure.recoverable).toBe(false);
  });
});

describe('parseModbusTcp — stream behaviour', () => {
  it('reads only the first ADU when one payload carries several', () => {
    const payload = new Uint8Array(SPEC_REQUEST.length + SPEC_RESPONSE.length);
    payload.set(SPEC_REQUEST, 0);
    payload.set(SPEC_RESPONSE, SPEC_REQUEST.length);

    const first = expectSuccess(parseModbusTcp(payload));
    expect(first.consumedBytes).toBe(12);
    expect(first.frame.rawFrame.bytes).toEqual(SPEC_REQUEST);
    expect(fieldById(first.frame.fields, 'quantity').rawValue).toBe(2);
    expect(first.frame.valid).toBe(true);

    const second = expectSuccess(
      parseModbusTcp(payload.subarray(first.consumedBytes), 'response'),
    );
    expect(second.consumedBytes).toBe(13);
    expect(fieldById(second.frame.fields, 'register-1').rawValue).toBe(200);
  });

  it('ignores bytes past the declared frame instead of calling them trailing data', () => {
    const payload = new Uint8Array(SPEC_REQUEST.length + 1);
    payload.set(SPEC_REQUEST, 0);
    payload[SPEC_REQUEST.length] = 0x00;

    const { frame, consumedBytes } = expectSuccess(parseModbusTcp(payload));

    expect(consumedBytes).toBe(12);
    expect(frame.fields.some((field) => field.id === 'trailing-data')).toBe(false);
    expect(frame.valid).toBe(true);
  });

  it('does not mutate the input buffer and stays pure across calls', () => {
    const input = SPEC_REQUEST.slice();
    const first = expectSuccess(parseModbusTcp(input));
    const second = expectSuccess(parseModbusTcp(input));

    expect(input).toEqual(SPEC_REQUEST);
    expect(second.frame.fields.map((field) => [field.id, field.offset, field.rawValue])).toEqual(
      first.frame.fields.map((field) => [field.id, field.offset, field.rawValue]),
    );
  });

  it('takes timestamp, direction and channel from the parse context', () => {
    const { frame } = expectSuccess(
      parseModbusTcp(SPEC_REQUEST, 'request', {
        timestamp: 1_700_000_000_000,
        direction: 'tx',
        channel: 'plc-1',
      }),
    );

    expect(frame.timestamp).toBe(1_700_000_000_000);
    expect(frame.rawFrame.timestamp).toBe(1_700_000_000_000);
    expect(frame.rawFrame.direction).toBe('tx');
    expect(frame.rawFrame.channel).toBe('plc-1');
  });
});

describe('modbusTcpParser', () => {
  it('identifies itself with the catalog plugin id', () => {
    expect(modbusTcpParser.protocolId).toBe('modbus-tcp');
    expect(modbusTcpParser.displayName).toBe('Modbus TCP');
  });

  it('accepts a frame whose protocol id is zero and has room for a function code', () => {
    expect(modbusTcpParser.canParse(SPEC_REQUEST)).toBe(true);
    expect(modbusTcpParser.canParse(SPEC_RESPONSE)).toBe(true);
  });

  it('rejects short buffers and non-zero protocol ids without looking at the length field', () => {
    expect(modbusTcpParser.canParse(bytes('00 01 00 00 00 06 01'))).toBe(false);
    expect(modbusTcpParser.canParse(bytes('00 01 00 07 00 06 01 03'))).toBe(false);
    // Uzunluk alanı tutarsız olsa bile ön eleme geçer: eksik veri `parse`'ın işidir.
    expect(modbusTcpParser.canParse(bytes('00 01 00 00 00 FF 01 03'))).toBe(true);
  });

  it('reads the role from the parse context options', () => {
    const result = expectSuccess(
      modbusTcpParser.parse(SPEC_RESPONSE, { options: { role: 'response' } }),
    );

    expect(result.frame.rawFrame.metadata?.modbusRole).toBe('response');
    expect(fieldById(result.frame.fields, 'register-0').rawValue).toBe(100);
  });

  it('falls back to the inferred role when options carry no usable role', () => {
    const result = expectSuccess(modbusTcpParser.parse(SPEC_REQUEST, { options: { role: 42 } }));

    expect(result.frame.rawFrame.metadata?.modbusRole).toBe('request');
  });
});

describe('modbusTcpPlugin', () => {
  it('registers under the catalog id and the industrial domain', () => {
    expect(modbusTcpPlugin.id).toBe('modbus-tcp');
    expect(modbusTcpPlugin.name).toBe('Modbus TCP');
    expect(modbusTcpPlugin.category).toBe('industrial-automation');
    expect(modbusTcpPlugin.parser).toBe(modbusTcpParser);
  });

  it('ships example frames with unique ids', () => {
    const ids = modbusTcpPlugin.exampleFrames.map((example) => example.id);

    expect(ids.length).toBeGreaterThanOrEqual(4);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('starts from the spec frame verbatim', () => {
    const example = modbusTcpPlugin.exampleFrames[0];

    expect(example?.bytes).toEqual(SPEC_REQUEST);
  });

  it('parses every example that is not marked as deliberately broken', () => {
    for (const example of modbusTcpPlugin.exampleFrames) {
      const result = parseModbusTcp(example.bytes);
      if (example.expectedValid === false) {
        expect(result.success, example.id).toBe(false);
        continue;
      }
      const { consumedBytes } = expectSuccess(result);
      // Örnek çerçeve tek başına tam bir ADU olmalı; artık bayt bırakmamalı.
      expect(consumedBytes, example.id).toBe(example.bytes.length);
      expect(modbusTcpParser.canParse(example.bytes), example.id).toBe(true);
    }
  });
});
