import { describe, expect, it } from 'vitest';

import { parseDeviceDescription } from './deviceDescriptionParser';
import { SAMPLE_IODD_PROCESS_DATA, SAMPLE_IODD_TEXT, SAMPLE_SCL_TEXT } from './deviceDescriptionFixture';
import { decodeDeviceItem, isDecodable, itemBitLength } from './deviceItemDecoder';
import type { DeviceItem } from './deviceDescriptionTypes';

function item(overrides: Partial<DeviceItem> = {}): DeviceItem {
  return { id: 'X', name: 'X', group: 'process-data', dataType: 'UIntegerT', ...overrides };
}

describe('itemBitLength / isDecodable', () => {
  it('genişliği kalemden ya da tip adından alır', () => {
    expect(itemBitLength(item({ bitLength: 12 }))).toBe(12);
    expect(itemBitLength(item({ dataType: 'Unsigned16' }))).toBe(16);
    expect(itemBitLength(item({ dataType: 'UIntegerT' }))).toBeUndefined();
  });

  it('süreç verisinde konum ZORUNLU, parametrede baştan okunur', () => {
    expect(isDecodable(item({ bitOffset: 0, bitLength: 8 }))).toBe(true);
    // Süreç verisi kaleminde konum yoksa hangi bit okunacağı bilinmiyor.
    expect(isDecodable(item({ bitLength: 8 }))).toBe(false);
    // Parametre tek başına okunur (ISDU/kayıt okuma); baytları kendisinindir.
    expect(isDecodable(item({ group: 'parameter', bitLength: 8 }))).toBe(true);
  });
});

describe('decodeDeviceItem', () => {
  it('işaretsiz alanı okur', () => {
    const result = decodeDeviceItem(
      item({ bitOffset: 0, bitLength: 16 }),
      Uint8Array.from([0x04, 0xd2]),
    );
    expect(result).toMatchObject({ rawValue: 1234n, displayValue: '1234' });
  });

  it('işaretli alanı iki tümleyen okur', () => {
    const result = decodeDeviceItem(
      item({ dataType: 'IntegerT', bitOffset: 0, bitLength: 8 }),
      Uint8Array.from([0xec]),
    );
    expect(result).toMatchObject({ rawValue: -20n, displayValue: '-20' });
  });

  it('bayt sınırına oturmayan bit alanını okur', () => {
    const result = decodeDeviceItem(
      item({ dataType: 'BooleanT', bitOffset: 31, bitLength: 1 }),
      Uint8Array.from([0x00, 0x00, 0x00, 0x01]),
    );
    expect(result).toMatchObject({ displayValue: 'true' });
  });

  it('float32 okur', () => {
    const result = decodeDeviceItem(
      item({ dataType: 'Float32T', bitOffset: 0, bitLength: 32 }),
      Uint8Array.from([0x42, 0x48, 0x00, 0x00]),
    );
    expect(result).toMatchObject({ displayValue: '50' });
  });

  it('sözel karşılığı VARSA onu basar, yoksa sayıyı', () => {
    const withValues = item({
      dataType: 'UIntegerT',
      bitOffset: 0,
      bitLength: 8,
      values: { '1': 'Fast' },
    });
    expect(decodeDeviceItem(withValues, Uint8Array.from([1]))).toMatchObject({ displayValue: 'Fast' });
    expect(decodeDeviceItem(withValues, Uint8Array.from([9]))).toMatchObject({ displayValue: '9' });
  });

  it('tanınmayan tipi ham bit dizisi olarak gösterir', () => {
    const result = decodeDeviceItem(
      item({ dataType: 'ArrayT', bitOffset: 0, bitLength: 16 }),
      Uint8Array.from([0xde, 0xad]),
    );
    expect(result).toMatchObject({ displayValue: '0xDEAD' });
  });

  it('süreç verisi kalemini konum olmadan çözmez — hizalama UYDURMAZ', () => {
    const result = decodeDeviceItem(item({ bitLength: 8 }), Uint8Array.from([1]));
    expect(result).toEqual({ success: false, messageKey: 'definition.xmlDevice.decode.noLayout' });
  });

  it('parametreyi konum olmadan da çözer: baytlar tek başına o parametrenindir', () => {
    const result = decodeDeviceItem(
      item({ group: 'parameter', bitLength: 8, values: { '1': 'Fast' } }),
      Uint8Array.from([1]),
    );
    expect(result).toMatchObject({ displayValue: 'Fast' });
  });

  it('bayt yetmiyorsa kaç bayt gerektiğini söyler', () => {
    const result = decodeDeviceItem(
      item({ bitOffset: 16, bitLength: 16 }),
      Uint8Array.from([0x00, 0x01]),
    );
    expect(result).toEqual({
      success: false,
      messageKey: 'definition.xmlDevice.decode.tooShort',
      requiredBytes: 4,
    });
  });
});

describe('IODD süreç verisi — uçtan uca', () => {
  it('örnek çerçevenin üç kalemini de doğru çözer', () => {
    const parsed = parseDeviceDescription(SAMPLE_IODD_TEXT);
    if (!parsed.success) throw new Error('okunamadı');

    const byName = (name: string): DeviceItem => {
      const found = parsed.description.items.find((entry) => entry.name === name);
      if (found === undefined) throw new Error(`kalem yok: ${name}`);
      return found;
    };

    expect(decodeDeviceItem(byName('Process pressure'), SAMPLE_IODD_PROCESS_DATA)).toMatchObject({
      displayValue: '1234',
    });
    expect(decodeDeviceItem(byName('Sensor temperature'), SAMPLE_IODD_PROCESS_DATA)).toMatchObject({
      displayValue: '-20',
    });
    expect(decodeDeviceItem(byName('Switching signal'), SAMPLE_IODD_PROCESS_DATA)).toMatchObject({
      displayValue: 'true',
    });
  });
});

describe('SCL kalemleri', () => {
  it('çözülebilir sayılmaz: bayt yerleşimi yok', () => {
    const parsed = parseDeviceDescription(SAMPLE_SCL_TEXT);
    if (!parsed.success) throw new Error('okunamadı');
    expect(parsed.description.items.some((entry) => isDecodable(entry))).toBe(false);
  });
});
