import { describe, expect, it } from 'vitest';

import type { ProtocolSchema } from '@/protocol-core/schemas/protocolSchema';
import { SPEC_SENSOR_PROTOCOL } from '@/protocol-core/schemas/specFixture';

import { generateCStruct } from './cStruct';

/** İç yapı + dinamik dizi + boolean: iç içe üretim yolunu tek şemada sınar. */
const NESTED_SCHEMA: ProtocolSchema = {
  name: 'Nested Telemetry',
  version: '2.1',
  framing: { type: 'lengthField', maximumFrameLength: 512 },
  fields: [
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
    { id: 'crc', name: 'CRC', type: 'crc', algorithm: 'CRC16_MODBUS' },
  ],
};

/** Sabit tekrar sayılı dizi: C dizisi olarak çıkmalı, sayaç alanı olmamalı. */
const FIXED_ARRAY_SCHEMA: ProtocolSchema = {
  name: 'Fixed Array Protocol',
  version: '1.0',
  framing: { type: 'fixedLength', maximumFrameLength: 64 },
  fields: [
    {
      id: 'samples',
      name: 'Samples',
      type: 'array',
      repeatCount: 3,
      fields: [{ id: 'reading', name: 'Reading', type: 'int16' }],
    },
  ],
};

const BITFIELD_SCHEMA: ProtocolSchema = {
  name: 'Status Word',
  version: '1.0',
  framing: { type: 'none', maximumFrameLength: 8 },
  fields: [
    {
      id: 'mode',
      name: 'Mode',
      type: 'bitField',
      bitOffset: 3,
      bitLength: 4,
      bitOrder: 'msb-first',
    },
  ],
};

/**
 * Kasten zor şema: C ayrılmış sözcüğü olan ad, aynı tanımlayıcıya inen iki ad,
 * iç alanı olmayan yapı ve başında sıfır taşıyan enum anahtarı.
 */
const AWKWARD_SCHEMA: ProtocolSchema = {
  name: 'Awkward Protocol',
  version: '0.1',
  framing: { type: 'none', maximumFrameLength: 32 },
  fields: [
    { id: 'a', name: 'int', type: 'uint8' },
    { id: 'b', name: 'Sıcaklık', type: 'uint8' },
    { id: 'c', name: 'Sicaklik', type: 'uint8' },
    { id: 'd', name: 'Empty Block', type: 'structure', fields: [] },
    {
      id: 'e',
      name: 'Mode',
      type: 'enum',
      length: 1,
      enumValues: { '016': 'Idle', '2': 'Run' },
    },
    {
      id: 'f',
      name: 'Temp',
      type: 'int16',
      unit: '°C',
      scale: 0.1,
      // Kullanıcı metni: yorum sınırlayıcısı ve satır sonu taşıyor.
      description: 'sensör /* içeride */ ölçüm\nikinci satır',
    },
  ],
};

describe('generateCStruct', () => {
  it('returns a c-struct artifact whose file name is the snake cased schema name', () => {
    const artifact = generateCStruct(SPEC_SENSOR_PROTOCOL);

    expect(artifact.id).toBe('c-struct');
    expect(artifact.language).toBe('c');
    expect(artifact.fileName).toBe('alp_sensor_protocol.h');
    // Dosya adı dizin yolu taşımaz (indirme adı olarak kullanılıyor).
    expect(artifact.fileName).not.toContain('/');
  });

  it('wraps the header in a matching include guard and ends with a single newline', () => {
    const { code } = generateCStruct(SPEC_SENSOR_PROTOCOL);

    expect(code).toContain('#ifndef ALP_ALP_SENSOR_PROTOCOL_H');
    expect(code).toContain('#define ALP_ALP_SENSOR_PROTOCOL_H');
    expect(code).toContain('#endif /* ALP_ALP_SENSOR_PROTOCOL_H */');
    expect(code.endsWith('*/\n')).toBe(true);
    expect(code.endsWith('\n\n')).toBe(false);
  });

  it('emits the banner by default and drops it when the option is false', () => {
    const withBanner = generateCStruct(SPEC_SENSOR_PROTOCOL).code;
    const withoutBanner = generateCStruct(SPEC_SENSOR_PROTOCOL, { banner: false }).code;

    expect(withBanner).toContain('elle düzenlemeyin');
    expect(withoutBanner).not.toContain('elle düzenlemeyin');
    expect(withoutBanner.startsWith('#ifndef ')).toBe(true);
  });

  it('includes stdint always and skips stdbool when no boolean field exists', () => {
    const { code } = generateCStruct(SPEC_SENSOR_PROTOCOL);

    expect(code).toContain('#include <stdint.h>');
    expect(code).not.toContain('#include <stdbool.h>');
  });

  it('includes stdbool when a boolean field is present', () => {
    const { code } = generateCStruct(NESTED_SCHEMA);

    expect(code).toContain('#include <stdbool.h>');
    expect(code).toContain('bool alarm;');
  });

  it('maps a dynamic length field to a pointer and pulls in stddef for NULL', () => {
    const { code } = generateCStruct(SPEC_SENSOR_PROTOCOL);

    expect(code).toContain('#include <stddef.h>');
    expect(code).toContain('uint8_t* payload;');
    // İşaretçinin neden işaretçi olduğu okuyucuya söylenmeli.
    expect(code).toContain('uzunluk "payloadLength" alanının değerinden gelir');
  });

  it('generates a C enum from enumValues in ascending numeric order', () => {
    const { code } = generateCStruct(SPEC_SENSOR_PROTOCOL);

    expect(code).toContain('ALP_SENSOR_PROTOCOL_COMMAND_SENSOR_DATA = 16');
    expect(code).toContain('ALP_SENSOR_PROTOCOL_COMMAND_SET_OUTPUT = 32');
    expect(code).toContain('ALP_SENSOR_PROTOCOL_COMMAND_STATUS_REQUEST = 48');
    expect(code).toContain('} AlpSensorProtocolCommand;');
    expect(code.indexOf('_SENSOR_DATA = 16')).toBeLessThan(code.indexOf('_SET_OUTPUT = 32'));
    expect(code.indexOf('_SET_OUTPUT = 32')).toBeLessThan(code.indexOf('_STATUS_REQUEST = 48'));
    // Enum ALANI yine sabit genişlikli tamsayı kalır; C enum'un alt tipi
    // derleyiciye bağlı olduğu için tel genişliği garanti edilemezdi.
    expect(code).toContain('uint8_t command;');
  });

  it('declares the root typedef with the pascal cased schema name and a frame length macro', () => {
    const { code } = generateCStruct(SPEC_SENSOR_PROTOCOL);

    expect(code).toContain('typedef struct {');
    expect(code).toContain('} AlpSensorProtocol;');
    expect(code).toContain('#define ALP_SENSOR_PROTOCOL_MAX_FRAME_LENGTH 256');
  });

  it('warns about padding instead of forcing a packed attribute', () => {
    const { code } = generateCStruct(SPEC_SENSOR_PROTOCOL);

    expect(code).toContain('DİKKAT — bu struct DOLGU (padding) içerebilir');
    expect(code).toContain('`__attribute__((packed))` bilerek konulmadı');
    // Uyarı metninde geçmesi serbest; struct'a YAPIŞMIŞ olması yasak.
    expect(code).not.toMatch(/struct\s+__attribute__/);
    expect(code).not.toMatch(/\}\s*__attribute__/);
    expect(code).not.toContain('#pragma pack');
  });

  it('keeps derived fields in the struct but marks them as auto computed', () => {
    const { code } = generateCStruct(SPEC_SENSOR_PROTOCOL);

    expect(code).toContain('uint8_t checksum;');
    expect(code).toContain('Otomatik hesaplanır (xor8)');
  });

  it('defines nested types before the struct that uses them', () => {
    const { code } = generateCStruct(NESTED_SCHEMA);

    const headerType = code.indexOf('} NestedTelemetryHeader;');
    const entryType = code.indexOf('} NestedTelemetryItemsEntry;');
    const flagsType = code.indexOf('} NestedTelemetryItemsEntryFlags;');
    const rootType = code.indexOf('} NestedTelemetry;');

    expect(headerType).toBeGreaterThan(-1);
    // İç içe yapı önce kendi iç tipini tanımlamalı: C'de eksik tip üye olamaz.
    expect(flagsType).toBeLessThan(entryType);
    expect(entryType).toBeLessThan(rootType);
    expect(headerType).toBeLessThan(rootType);
    expect(code).toContain('NestedTelemetryHeader header;');
  });

  it('renders a fixed repeat count as a plain C array without a count member', () => {
    const { code } = generateCStruct(FIXED_ARRAY_SCHEMA);

    expect(code).toContain('FixedArrayProtocolSamplesEntry samples[3];');
    expect(code).not.toContain('samples_count');
    expect(code).not.toContain('MAX_COUNT');
  });

  it('renders a dynamic repeat count as a bounded array plus a count member', () => {
    const { code } = generateCStruct(NESTED_SCHEMA);

    // Eleman 3 bayt (uint16 + boolean), çerçeve bütçesi 512 → 170 eleman.
    expect(code).toContain('#define NESTED_TELEMETRY_ITEMS_MAX_COUNT 170');
    expect(code).toContain('NestedTelemetryItemsEntry items[NESTED_TELEMETRY_ITEMS_MAX_COUNT];');
    expect(code).toContain('uint16_t items_count;');
    expect(code).toContain('eleman sayısı "itemCount" alanından gelir');
  });

  it('emits mask and shift macros for a bit field instead of a C bit-field', () => {
    const { code } = generateCStruct(BITFIELD_SCHEMA);

    expect(code).toContain('#define STATUS_WORD_MODE_BIT_OFFSET 3u');
    expect(code).toContain('#define STATUS_WORD_MODE_BIT_LENGTH 4u');
    expect(code).toContain('#define STATUS_WORD_MODE_MASK 0x78u');
    // Saklama tipi çıkarılmış değeri tutar; ham kelime değil.
    expect(code).toContain('uint8_t mode;');
    // C bit-field söz dizimi (`uint8_t mode : 4;`) hiç geçmemeli.
    expect(code).not.toMatch(/\bmode\s*:\s*\d/);
    expect(code).toContain('C bit-field kullanılmadı');
    expect(code).toContain('msb-first');
  });

  it('produces byte identical output for repeated calls', () => {
    const first = generateCStruct(NESTED_SCHEMA);
    const second = generateCStruct(NESTED_SCHEMA);

    expect(second.code).toBe(first.code);
    expect(second.fileName).toBe(first.fileName);
  });

  it('honours a custom indent', () => {
    const { code } = generateCStruct(SPEC_SENSOR_PROTOCOL, { indent: '\t' });

    expect(code).toContain('\tuint8_t device_address;');
    expect(code).not.toContain('  uint8_t device_address;');
  });

  it('escapes C reserved words used as field names', () => {
    const { code } = generateCStruct(AWKWARD_SCHEMA);

    expect(code).toContain('uint8_t int_;');
    expect(code).not.toMatch(/uint8_t int;/);
  });

  it('separates two field names that collapse to the same identifier', () => {
    const { code } = generateCStruct(AWKWARD_SCHEMA);

    expect(code).toContain('uint8_t sicaklik;');
    expect(code).toContain('uint8_t sicaklik_2;');
  });

  it('fills an empty composite with a placeholder member', () => {
    const { code } = generateCStruct(AWKWARD_SCHEMA);

    expect(code).toContain('} AwkwardProtocolEmptyBlock;');
    expect(code).toContain('uint8_t reserved_placeholder;');
    // Boş gövdeli `typedef struct { }` C'de geçersizdir.
    expect(code).not.toMatch(/typedef struct \{\s*\} /);
  });

  it('normalises enum keys so leading zeros are not read as octal', () => {
    const { code } = generateCStruct(AWKWARD_SCHEMA);

    expect(code).toContain('AWKWARD_PROTOCOL_MODE_RUN = 2');
    expect(code).toContain('AWKWARD_PROTOCOL_MODE_IDLE = 16');
    expect(code).not.toContain('= 016');
  });

  it('neutralises comment delimiters and newlines coming from the schema text', () => {
    const { code } = generateCStruct(AWKWARD_SCHEMA);

    // Kullanıcı metni yorumu erkenden kapatamamalı, satır sonu yorumu bölmemeli.
    expect(code).toContain('/* sensör / * içeride * / ölçüm ikinci satır */');
    expect(code).toContain('Birim: °C.');
    expect(code).toContain('Fiziksel değer = ham × 0.1 + 0.');
  });

  it('carries the schema version and framing into the header comment', () => {
    const { code } = generateCStruct(NESTED_SCHEMA);

    expect(code).toContain('Protokol: Nested Telemetry (sürüm 2.1)');
    expect(code).toContain('Çerçeveleme: lengthField · en büyük çerçeve 512 bayt');
  });
});
