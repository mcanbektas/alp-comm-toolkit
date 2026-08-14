import { describe, expect, it } from 'vitest';

import { decodeEdsValue, getEdsDataTypeInfo } from './edsDecoder';
import {
  SAMPLE_EDS_CONTROLWORD_INDEX,
  SAMPLE_EDS_STATUSWORD_INDEX,
  SAMPLE_EDS_TEXT,
  SAMPLE_EDS_VELOCITY_INDEX,
} from './edsFixture';
import { findEdsObject, parseEds } from './edsParser';

function database() {
  const result = parseEds(SAMPLE_EDS_TEXT);
  if (!result.success) throw new Error('sample EDS failed to parse');
  return result.database;
}

describe('decodeEdsValue — sabit uzunluklu sayısal tipler (little-endian)', () => {
  it('UNSIGNED8/INTEGER8 tek bayt okur, INTEGER8 işaretlidir', () => {
    expect(decodeEdsValue(new Uint8Array([0xff]), 0x0005)).toEqual({
      dataTypeName: 'UNSIGNED8',
      value: 255,
    });
    expect(decodeEdsValue(new Uint8Array([0xff]), 0x0002)).toEqual({
      dataTypeName: 'INTEGER8',
      value: -1,
    });
  });

  it('BOOLEAN tek baytı sayı olarak döner', () => {
    expect(decodeEdsValue(new Uint8Array([0x01]), 0x0001)).toEqual({
      dataTypeName: 'BOOLEAN',
      value: 1,
    });
  });

  it('UNSIGNED32 dört baytı LE okur', () => {
    // Fixture'ın 0x1000 DefaultValue'su: 92 01 02 00 → 0x00020192.
    expect(decodeEdsValue(new Uint8Array([0x92, 0x01, 0x02, 0x00]), 0x0007)).toEqual({
      dataTypeName: 'UNSIGNED32',
      value: 0x00020192,
    });
  });

  it('REAL32 IEEE-754 LE okur (spec §43 fixture: 25.75 → LE 00 00 CE 41)', () => {
    const result = decodeEdsValue(new Uint8Array([0x00, 0x00, 0xce, 0x41]), 0x0008);
    expect(result?.dataTypeName).toBe('REAL32');
    expect(result?.value).toBeCloseTo(25.75, 5);
  });

  it('yetersiz baytta undefined döner, fırlatmaz', () => {
    expect(decodeEdsValue(new Uint8Array([0x01, 0x02]), 0x0007)).toBeUndefined();
  });

  it('tabloda olmayan DataType kodunda undefined döner', () => {
    // 0x0016 (INTEGER24) bilinçli dışarıda — dosya başı KAYNAK UYARISI.
    expect(decodeEdsValue(new Uint8Array([0x01, 0x02, 0x03]), 0x0016)).toBeUndefined();
    expect(getEdsDataTypeInfo(0x0016)).toBeUndefined();
  });
});

describe('decodeEdsValue — değişken uzunluklu tipler', () => {
  it('VISIBLE_STRING ASCII metne çözer', () => {
    const bytes = new Uint8Array([0x48, 0x69]); // "Hi"
    expect(decodeEdsValue(bytes, 0x0009)).toEqual({ dataTypeName: 'VISIBLE_STRING', value: 'Hi' });
  });

  it('OCTET_STRING boşlukla ayrılmış hex çiftlerine çözer', () => {
    const bytes = new Uint8Array([0xab, 0xcd]);
    expect(decodeEdsValue(bytes, 0x000a)).toEqual({ dataTypeName: 'OCTET_STRING', value: 'AB CD' });
  });
});

describe('EDS ↔ CANopen (dalga 1b) bağlantısı', () => {
  it('Controlword yazma değerini (canopen.ts sdo-write-controlword) çözer', () => {
    const db = database();
    const controlword = findEdsObject(db, SAMPLE_EDS_CONTROLWORD_INDEX, undefined);
    expect(controlword?.dataType).toBeDefined();
    // canopen.ts örneğinin SDO veri baytları: 0F 00 00 00 (expedited, 4 bayt).
    // Controlword UNSIGNED16 olduğu için ilk iki bayt anlamlıdır.
    const decoded = decodeEdsValue(new Uint8Array([0x0f, 0x00]), controlword?.dataType ?? -1);
    expect(decoded).toEqual({ dataTypeName: 'UNSIGNED16', value: 15 });
  });

  it('PDO örneğinin (canopen.ts pdo-statusword-velocity, 37 12 DC 05) iki sinyalini çözer', () => {
    const db = database();
    const statusword = findEdsObject(db, SAMPLE_EDS_STATUSWORD_INDEX, undefined);
    const velocity = findEdsObject(db, SAMPLE_EDS_VELOCITY_INDEX, undefined);

    // Spec özet 04:102: Statusword 0x1237.
    const statuswordValue = decodeEdsValue(new Uint8Array([0x37, 0x12]), statusword?.dataType ?? -1);
    expect(statuswordValue).toEqual({ dataTypeName: 'UNSIGNED16', value: 0x1237 });

    // Spec özet 04:102: Velocity 1500 rpm.
    const velocityValue = decodeEdsValue(new Uint8Array([0xdc, 0x05]), velocity?.dataType ?? -1);
    expect(velocityValue).toEqual({ dataTypeName: 'INTEGER16', value: 1500 });
  });
});
