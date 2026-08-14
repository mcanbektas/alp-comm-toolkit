import { describe, expect, it } from 'vitest';

import type { ProtocolFieldSchema, ProtocolSchema } from '@/protocol-core/schemas/protocolSchema';
import { SPEC_SENSOR_PROTOCOL } from '@/protocol-core/schemas/specFixture';

import { generatePythonParser } from './pythonParser';

/**
 * Üretilen metnin TAMAMI karşılaştırılmıyor: bir boşluk değişikliği tüm
 * testleri kırardı ve hangi değişmezin bozulduğunu söylemezdi. Her test tek bir
 * YAPISAL değişmezi (bayt sırası, kapsam, ad kaçışı…) doğruluyor.
 */
function makeSchema(
  fields: readonly ProtocolFieldSchema[],
  overrides: Partial<ProtocolSchema> = {},
): ProtocolSchema {
  return {
    name: 'Test Protocol',
    version: '2.1',
    framing: { type: 'none', maximumFrameLength: 128 },
    fields,
    ...overrides,
  };
}

const NESTED_SCHEMA: ProtocolSchema = makeSchema(
  [
    {
      id: 'header',
      name: 'Header',
      type: 'structure',
      fields: [
        { id: 'deviceAddress', name: 'Device Address', type: 'uint8' },
        { id: 'itemCount', name: 'Item Count', type: 'uint8' },
      ],
    },
    {
      id: 'items',
      name: 'Items',
      type: 'array',
      repeatCount: { fromField: 'itemCount' },
      fields: [
        { id: 'value', name: 'Value', type: 'uint16' },
        {
          id: 'flags',
          name: 'Flags',
          type: 'structure',
          fields: [{ id: 'alarm', name: 'Alarm', type: 'boolean' }],
        },
      ],
    },
    {
      id: 'crc',
      name: 'CRC',
      type: 'crc',
      algorithm: 'CRC16_MODBUS',
      coverage: { startField: 'header', endField: 'items' },
    },
  ],
  { name: 'Nested Telemetry' },
);

describe('generatePythonParser artifact', () => {
  it('reports the python artifact identity and a snake_case file name', () => {
    const artifact = generatePythonParser(SPEC_SENSOR_PROTOCOL);

    expect(artifact.id).toBe('python-parser');
    expect(artifact.language).toBe('python');
    expect(artifact.fileName).toBe('alp_sensor_protocol_parser.py');
  });

  it('is deterministic: the same schema yields byte-identical text', () => {
    const first = generatePythonParser(SPEC_SENSOR_PROTOCOL);
    const second = generatePythonParser(SPEC_SENSOR_PROTOCOL);

    expect(first.code).toBe(second.code);
    // Üretim tarihi damgalansaydı iki çağrı ayrışırdı; yıl geçmediğini de sınıyoruz.
    expect(first.code).not.toMatch(/20\d\d-\d\d-\d\d/);
  });

  it('writes the banner by default and drops it on request', () => {
    expect(generatePythonParser(SPEC_SENSOR_PROTOCOL).code).toContain(
      '# Protokol: ALP Sensor Protocol',
    );

    const bare = generatePythonParser(SPEC_SENSOR_PROTOCOL, { banner: false }).code;
    expect(bare.startsWith('from __future__ import annotations')).toBe(true);
  });
});

describe('generatePythonParser module shell', () => {
  it('emits the required imports, with enum only when the schema needs it', () => {
    const withEnum = generatePythonParser(SPEC_SENSOR_PROTOCOL).code;

    expect(withEnum).toContain('from __future__ import annotations');
    expect(withEnum).toContain('import struct');
    expect(withEnum).toContain('from dataclasses import dataclass');
    expect(withEnum).toContain('from typing import Optional');
    expect(withEnum).toContain('import enum');

    const withoutEnum = generatePythonParser(
      makeSchema([{ id: 'a', name: 'Alpha', type: 'uint8' }]),
    ).code;
    expect(withoutEnum).not.toContain('import enum');
  });

  it('declares the error class and the public parse entry point', () => {
    const code = generatePythonParser(SPEC_SENSOR_PROTOCOL).code;

    expect(code).toContain('class AlpSensorProtocolParseError(ValueError):');
    expect(code).toContain('def parse(data: bytes) -> AlpSensorProtocol:');
    expect(code).toContain('result, _ = _parse_alp_sensor_protocol(data, 0)');
  });

  it('builds the dataclass from pythonTypeFor annotations', () => {
    const code = generatePythonParser(SPEC_SENSOR_PROTOCOL).code;

    expect(code).toContain('@dataclass');
    expect(code).toContain('class AlpSensorProtocol:');
    expect(code).toContain('device_address: int');
    expect(code).toContain('payload: bytes');
    expect(code).toContain('checksum: int');
  });

  it('keeps every generated line within 100 columns and indents with four spaces', () => {
    for (const schema of [SPEC_SENSOR_PROTOCOL, NESTED_SCHEMA]) {
      const code = generatePythonParser(schema).code;
      for (const line of code.split('\n')) {
        expect(line.length).toBeLessThanOrEqual(100);
        expect(line).not.toMatch(/\s$/);
      }
    }

    expect(generatePythonParser(SPEC_SENSOR_PROTOCOL).code).toContain(
      '\n    # Device Address\n    device_address: int',
    );
    expect(generatePythonParser(SPEC_SENSOR_PROTOCOL, { indent: '  ' }).code).toContain(
      '\n  # Device Address\n  device_address: int',
    );
  });
});

describe('generatePythonParser enums', () => {
  it('emits an IntEnum per enum field, ordered by numeric value', () => {
    const schema = makeSchema([
      {
        id: 'command',
        name: 'Command',
        type: 'enum',
        length: 1,
        // Anahtar sırası bilerek karışık: sıralama nesne gezinmesine değil,
        // sayısal değere dayanmalı.
        enumValues: { '48': 'Status Request', '16': 'Sensor Data', '32': 'Set Output' },
      },
    ]);

    const code = generatePythonParser(schema).code;

    expect(code).toContain('class Command(enum.IntEnum):');
    expect(code.indexOf('SENSOR_DATA = 16')).toBeLessThan(code.indexOf('SET_OUTPUT = 32'));
    expect(code.indexOf('SET_OUTPUT = 32')).toBeLessThan(code.indexOf('STATUS_REQUEST = 48'));
  });

  it('exposes the enum label through an Optional property instead of a bare int', () => {
    const code = generatePythonParser(SPEC_SENSOR_PROTOCOL).code;

    expect(code).toContain('def command_label(self) -> Optional[str]:');
    expect(code).toContain('return Command(self.command).name');
    expect(code).toContain('except ValueError:');
  });
});

describe('generatePythonParser field reading', () => {
  it('reads fixed width numbers with struct.unpack_from and the schema byte order', () => {
    const fields: readonly ProtocolFieldSchema[] = [
      { id: 'a', name: 'Alpha', type: 'uint16' },
      { id: 'b', name: 'Beta', type: 'float32' },
    ];

    const bigEndian = generatePythonParser(makeSchema(fields)).code;
    expect(bigEndian).toContain('alpha = struct.unpack_from(">H", data, offset)[0]');
    expect(bigEndian).toContain('beta = struct.unpack_from(">f", data, offset)[0]');

    const littleEndian = generatePythonParser(
      makeSchema(fields, { defaultEndianness: 'little' }),
    ).code;
    expect(littleEndian).toContain('alpha = struct.unpack_from("<H", data, offset)[0]');
    // Alanın kendi sırası şemanın varsayılanını ezer.
    const mixed = generatePythonParser(
      makeSchema([{ id: 'a', name: 'Alpha', type: 'uint16', endianness: 'big' }], {
        defaultEndianness: 'little',
      }),
    ).code;
    expect(mixed).toContain('alpha = struct.unpack_from(">H", data, offset)[0]');
  });

  it('jumps to the absolute schema offset and takes dynamic lengths from the source field', () => {
    const code = generatePythonParser(SPEC_SENSOR_PROTOCOL).code;

    expect(code).toContain('offset = 4');
    expect(code).toContain('_require(data, offset, payload_length)');
    expect(code).toContain('payload = bytes(data[offset:offset + payload_length])');
    expect(code).toContain('offset += payload_length');
  });

  it('extracts bit fields with int.from_bytes plus shift and mask', () => {
    const msbFirst = generatePythonParser(
      makeSchema([{ id: 'f', name: 'Flags', type: 'bitField', bitOffset: 2, bitLength: 6 }]),
    ).code;
    // msb-first: bit 0 ilk baytın en yüksek biti — kaydırma 8 - 2 - 6 = 0.
    expect(msbFirst).toContain('flags_bits = int.from_bytes(data[offset:offset + 1], "big")');
    expect(msbFirst).toContain('flags = flags_bits & 0x3F');

    const lsbFirst = generatePythonParser(
      makeSchema([
        {
          id: 'f',
          name: 'Flags',
          type: 'bitField',
          bitOffset: 3,
          bitLength: 9,
          bitOrder: 'lsb-first',
        },
      ]),
    ).code;
    expect(lsbFirst).toContain('flags_bits = int.from_bytes(data[offset:offset + 2], "little")');
    expect(lsbFirst).toContain('flags = (flags_bits >> 3) & 0x1FF');
  });

  it('marks conditional fields Optional and leaves them None when the guard fails', () => {
    const code = generatePythonParser(
      makeSchema([
        { id: 'mode', name: 'Mode', type: 'uint8' },
        {
          id: 'tail',
          name: 'Tail',
          type: 'rawBytes',
          length: 2,
          condition: { field: 'mode', equals: 16 },
        },
      ]),
    ).code;

    expect(code).toContain('tail: Optional[bytes]');
    expect(code).toContain('tail = None');
    expect(code).toContain('if mode == 16:');
  });

  it('generates a physical value property from scale and calibration offset', () => {
    const code = generatePythonParser(
      makeSchema([
        {
          id: 't',
          name: 'Temperature',
          type: 'int16',
          scale: 0.1,
          calibrationOffset: -40,
          unit: '°C',
        },
      ]),
    ).code;

    expect(code).toContain('def physical_temperature(self) -> float:');
    expect(code).toContain('return self.temperature * 0.1 - 40.0');
    expect(code).toContain('(°C)');
  });
});

describe('generatePythonParser checksum verification', () => {
  it('verifies a simple checksum over the covered byte range', () => {
    const code = generatePythonParser(SPEC_SENSOR_PROTOCOL).code;

    expect(code).toContain('def _xor8(payload: bytes) -> int:');
    expect(code).toContain('device_address_start = offset');
    expect(code).toContain('payload_end = offset');
    expect(code).toContain('checksum_expected = _xor8(data[device_address_start:payload_end])');
    expect(code).toContain('if checksum != checksum_expected:');
    expect(code).toContain('raise AlpSensorProtocolParseError(');
  });

  it('feeds the generic CRC helper with the catalogue parameters', () => {
    const code = generatePythonParser(NESTED_SCHEMA).code;

    expect(code).toContain('def _reflect(value: int, width: int) -> int:');
    expect(code).toContain('crc_expected = _crc(');
    // CRC16_MODBUS: poly 0x8005, init 0xFFFF, refin/refout, xorout 0x0000.
    expect(code).toContain('    0x8005,');
    expect(code).toContain('    0xFFFF,');
    expect(code).toContain('    0x0000,');
    expect(code).toContain('    True,');
    expect(code).not.toContain('_xor8');
  });

  it('skips verification and says why when the coverage is missing', () => {
    const code = generatePythonParser(
      makeSchema([
        { id: 'a', name: 'Alpha', type: 'uint8' },
        { id: 'c', name: 'Checksum', type: 'checksum', algorithm: 'sum8' },
      ]),
    ).code;

    expect(code).toContain('doğrulama üretilmedi');
    expect(code).not.toContain('checksum_expected =');
  });
});

describe('generatePythonParser nested structures', () => {
  it('emits one dataclass and one parse function per composite field', () => {
    const code = generatePythonParser(NESTED_SCHEMA).code;

    expect(code).toContain('class Header:');
    expect(code).toContain('class ItemsEntry:');
    expect(code).toContain('class Flags:');
    expect(code).toContain('def _parse_header(data: bytes, offset: int) -> tuple[Header, int]:');
    expect(code).toContain('header, offset = _parse_header(data, offset)');
    expect(code).toContain('items: list[ItemsEntry]');
    // İç sınıf, kendisini kullanan sınıftan ÖNCE tanımlanmalı.
    expect(code.indexOf('class Header:')).toBeLessThan(code.indexOf('class NestedTelemetry:'));
  });

  it('resolves a repeat count that lives inside an already parsed structure', () => {
    const code = generatePythonParser(NESTED_SCHEMA).code;

    // `itemCount` header'ın İÇİNDE; ayrı fonksiyonun yereli görünmez, çözümlenmiş
    // nesnenin özniteliği görünür.
    expect(code).toContain('for _ in range(header.item_count):');
    expect(code).toContain('items_entry, offset = _parse_items_entry(data, offset)');
    expect(code).toContain('items.append(items_entry)');
  });

  it('ignores absolute offsets inside array elements', () => {
    const code = generatePythonParser(
      makeSchema([
        { id: 'n', name: 'Count', type: 'uint8', offset: 0 },
        {
          id: 'items',
          name: 'Items',
          type: 'array',
          repeatCount: { fromField: 'n' },
          fields: [{ id: 'v', name: 'Value', type: 'uint8', offset: 1 }],
        },
      ]),
    ).code;

    // Kök alan mutlak konuma atlar…
    expect(code).toContain('offset = 0');
    // …ama dizi elemanı atlamaz, yoksa her yineleme aynı baytı okurdu.
    expect(code).not.toContain('offset = 1\n');
  });
});

describe('generatePythonParser identifier safety', () => {
  it('escapes python keywords and de-duplicates colliding field names', () => {
    const code = generatePythonParser(
      makeSchema([
        { id: 'a', name: 'class', type: 'uint8' },
        { id: 'b', name: 'Sıcaklık', type: 'uint8' },
        { id: 'c', name: 'Sicaklik', type: 'uint8' },
      ]),
    ).code;

    expect(code).toContain('class_: int');
    expect(code).toContain('sicaklik: int');
    expect(code).toContain('sicaklik_2: int');
  });

  it('renames locals that would shadow the parser parameters', () => {
    const code = generatePythonParser(
      makeSchema([
        { id: 'd', name: 'Data', type: 'uint8' },
        { id: 'o', name: 'Offset', type: 'uint8' },
      ]),
    ).code;

    // Öznitelik adı korunur (self altında yaşar), yerel değişken kaçar.
    expect(code).toContain('data: int');
    expect(code).toContain('offset: int');
    expect(code).toContain('data_2 = struct.unpack_from(">B", data, offset)[0]');
    expect(code).toContain('data=data_2,');
    expect(code).toContain('offset=offset_2,');
  });
});
