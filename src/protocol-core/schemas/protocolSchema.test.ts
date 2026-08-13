import { describe, expect, it } from 'vitest';

import { FIELD_TYPES, FIELD_TYPE_INFO, hasIntrinsicLength, isDerivedField, requiresBigInt } from './fieldTypes';
import { parseProtocolSchema, parseProtocolSchemaJson } from './protocolSchema';
import { SPEC_SENSOR_PROTOCOL_JSON } from './specFixture';

describe('FIELD_TYPES', () => {
  it('spec §9.1 listesinin tamamını taşır', () => {
    // Spec başlığı "32 tip" diyor ama gövdedeki liste 33 ad içeriyor; LİSTE esas.
    expect(FIELD_TYPES).toHaveLength(33);
    expect(new Set(FIELD_TYPES).size).toBe(33);
  });

  it('her tipin bilgi kaydı vardır', () => {
    for (const type of FIELD_TYPES) {
      expect(FIELD_TYPE_INFO[type]).toBeDefined();
    }
  });

  it('64 bitlik tipler BigInt ister — Number güvenli aralığı aşılır', () => {
    expect(requiresBigInt('uint64')).toBe(true);
    expect(requiresBigInt('int64')).toBe(true);
    expect(requiresBigInt('dateTime')).toBe(true);
    expect(requiresBigInt('uint32')).toBe(false);
  });

  it('sabit genişlikli tipler uzunluk istemez, değişkenler ister', () => {
    expect(hasIntrinsicLength('uint16')).toBe(true);
    expect(hasIntrinsicLength('float32')).toBe(true);
    expect(hasIntrinsicLength('rawBytes')).toBe(false);
    expect(hasIntrinsicLength('ascii')).toBe(false);
  });

  it('checksum ve crc türetilmiş alanlardır — kullanıcı değer giremez', () => {
    expect(isDerivedField('checksum')).toBe(true);
    expect(isDerivedField('crc')).toBe(true);
    expect(isDerivedField('uint8')).toBe(false);
  });

  it('işaretli/işaretsiz ayrımı doğrudur', () => {
    expect(FIELD_TYPE_INFO.int24).toMatchObject({ byteLength: 3, signed: true });
    expect(FIELD_TYPE_INFO.uint24).toMatchObject({ byteLength: 3, signed: false });
  });
});

describe('parseProtocolSchema', () => {
  it('spec §9.6 JSON şemasını olduğu gibi kabul eder', () => {
    const result = parseProtocolSchemaJson(SPEC_SENSOR_PROTOCOL_JSON);

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.schema.name).toBe('ALP Sensor Protocol');
    expect(result.schema.framing).toMatchObject({
      type: 'startEnd',
      startBytes: [170],
      endBytes: [85],
      maximumFrameLength: 256,
    });
    expect(result.schema.fields).toHaveLength(5);

    const payload = result.schema.fields[3];
    expect(payload).toMatchObject({ id: 'payload', type: 'rawBytes', lengthFrom: 'payloadLength' });
    // Dinamik uzunluklu alanda `length` OLMAMALI — ikisi çelişirdi.
    expect(payload?.length).toBeUndefined();

    const checksum = result.schema.fields[4];
    expect(checksum).toMatchObject({
      type: 'checksum',
      algorithm: 'xor8',
      coverage: { startField: 'address', endField: 'payload' },
    });
    // Konumu önündeki dinamik alana bağlı olduğu için `offset` taşımaz.
    expect(checksum?.offset).toBeUndefined();
  });

  it('enum anahtarlarını ondalık metin olarak korur', () => {
    const result = parseProtocolSchemaJson(SPEC_SENSOR_PROTOCOL_JSON);
    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.schema.fields[1]?.enumValues).toEqual({
      '16': 'Sensor Data',
      '32': 'Set Output',
      '48': 'Status Request',
    });
  });

  it('onaltılık enum anahtarını reddeder — iki gösterim karışırsa eşleşme sessizce kaçar', () => {
    const result = parseProtocolSchema({
      name: 'x',
      version: '1',
      framing: { type: 'none', maximumFrameLength: 16 },
      fields: [{ id: 'a', name: 'A', type: 'enum', length: 1, enumValues: { '0x10': 'Bad' } }],
    });

    expect(result.success).toBe(false);
  });

  it('bilinmeyen alan tipini reddeder', () => {
    const result = parseProtocolSchema({
      name: 'x',
      version: '1',
      framing: { type: 'none', maximumFrameLength: 16 },
      fields: [{ id: 'a', name: 'A', type: 'uint128' }],
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.issues[0]?.path).toBe('fields.0.type');
  });

  it('255 üstü çerçeveleme baytını reddeder', () => {
    const result = parseProtocolSchema({
      name: 'x',
      version: '1',
      framing: { type: 'startEnd', startBytes: [300], maximumFrameLength: 16 },
      fields: [{ id: 'a', name: 'A', type: 'uint8' }],
    });

    expect(result.success).toBe(false);
  });

  it('alansız şemayı reddeder', () => {
    const result = parseProtocolSchema({
      name: 'x',
      version: '1',
      framing: { type: 'none', maximumFrameLength: 16 },
      fields: [],
    });

    expect(result.success).toBe(false);
  });

  it('iç içe yapıyı (structure) özyinelemeli doğrular', () => {
    const result = parseProtocolSchema({
      name: 'nested',
      version: '1',
      framing: { type: 'none', maximumFrameLength: 64 },
      fields: [
        {
          id: 'samples',
          name: 'Samples',
          type: 'array',
          repeatCount: { fromField: 'count' },
          fields: [
            { id: 'temperature', name: 'Temperature', type: 'int16', scale: 0.1, unit: '°C' },
            { id: 'flags', name: 'Flags', type: 'bitField', bitOffset: 0, bitLength: 4 },
          ],
        },
      ],
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.schema.fields[0]?.fields).toHaveLength(2);
  });

  it('iç içe yapıda bozuk alanı yol bilgisiyle bildirir', () => {
    const result = parseProtocolSchema({
      name: 'nested',
      version: '1',
      framing: { type: 'none', maximumFrameLength: 64 },
      fields: [
        {
          id: 'outer',
          name: 'Outer',
          type: 'structure',
          fields: [{ id: 'inner', name: 'Inner', type: 'nope' }],
        },
      ],
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.issues[0]?.path).toBe('fields.0.fields.0.type');
  });

  it('bozuk JSON metnini doğrulama sorunu olarak bildirir, patlamaz', () => {
    const result = parseProtocolSchemaJson('{ bu json degil');

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.issues).toHaveLength(1);
  });

  it('kalibrasyon ofseti bayt konumundan AYRI anahtarla taşınır', () => {
    const result = parseProtocolSchema({
      name: 'x',
      version: '1',
      framing: { type: 'none', maximumFrameLength: 16 },
      fields: [
        {
          id: 'temp',
          name: 'Temperature',
          type: 'uint16',
          offset: 4,
          scale: 0.1,
          calibrationOffset: -40,
          unit: '°C',
        },
      ],
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    const field = result.schema.fields[0];
    expect(field?.offset).toBe(4);
    expect(field?.calibrationOffset).toBe(-40);
  });
});
