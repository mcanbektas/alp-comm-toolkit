import { describe, expect, it } from 'vitest';

import { decodeVendorMapEntry, requiredByteLength } from './vendorMapDecoder';
import type { VendorMapEntry } from './vendorMapTypes';

/**
 * Beklenen sayılar fixture'dan OKUNMUYOR, burada bağımsızca yazılıyor: iki
 * yer aynı kaynaktan beslenirse fixture'daki bir hata testte de aynen
 * tekrarlanır ve görünmez olur.
 */
function entry(overrides: Partial<VendorMapEntry> & Pick<VendorMapEntry, 'type'>): VendorMapEntry {
  return { address: 40001, name: 'Test', space: 'holding-register', ...overrides };
}

describe('requiredByteLength', () => {
  it('tipe göre bayt ister; `ascii`/`raw` uzunluğu girdiden alır', () => {
    expect(requiredByteLength(entry({ type: 'uint16' }))).toBe(2);
    expect(requiredByteLength(entry({ type: 'float32' }))).toBe(4);
    expect(requiredByteLength(entry({ type: 'ascii', length: 4 }))).toBe(8);
    expect(requiredByteLength(entry({ type: 'bool' }))).toBe(1);
  });
});

describe('decodeVendorMapEntry', () => {
  it('ölçekli `uint16`i fiziksel değere çevirir (0x08FC ×0.1 = 230)', () => {
    const result = decodeVendorMapEntry(
      entry({ type: 'uint16', scale: 0.1, unit: 'V' }),
      Uint8Array.from([0x08, 0xfc]),
      'high-first',
    );
    expect(result).toMatchObject({ success: true, rawValue: 2300, physicalValue: 230, unit: 'V' });
  });

  it('`int16`i iki tümleyen okur (0xFEF2 = -270)', () => {
    const result = decodeVendorMapEntry(
      entry({ type: 'int16', scale: 0.1 }),
      Uint8Array.from([0xfe, 0xf2]),
      'high-first',
    );
    expect(result).toMatchObject({ success: true, rawValue: -270, physicalValue: -27 });
  });

  it('kayan nokta artığını temizler: 0.1 ölçek 23.400000000000002 basmaz', () => {
    const result = decodeVendorMapEntry(
      entry({ type: 'uint16', scale: 0.1 }),
      Uint8Array.from([0x00, 0xea]), // 234
      'high-first',
    );
    expect(result).toMatchObject({ physicalValue: 23.4 });
  });

  it('`uint32`ü kelime sırasına göre farklı okur — sessiz anlamsız sayı tuzağı', () => {
    const bytes = Uint8Array.from([0x00, 0x01, 0x86, 0xa0]);

    expect(decodeVendorMapEntry(entry({ type: 'uint32' }), bytes, 'high-first')).toMatchObject({
      rawValue: 100_000, // 0x0001_86A0
    });
    expect(decodeVendorMapEntry(entry({ type: 'uint32' }), bytes, 'low-first')).toMatchObject({
      rawValue: 0x86a0_0001,
    });
  });

  it('girdinin kendi `wordOrder`u haritanın varsayılanını EZER', () => {
    const bytes = Uint8Array.from([0x00, 0x01, 0x86, 0xa0]);
    const result = decodeVendorMapEntry(
      entry({ type: 'uint32', wordOrder: 'low-first' }),
      bytes,
      'high-first',
    );
    expect(result).toMatchObject({ rawValue: 0x86a0_0001 });
  });

  it('0x8000_0000 üstü `uint32` NEGATİFE düşmez', () => {
    const result = decodeVendorMapEntry(
      entry({ type: 'uint32' }),
      Uint8Array.from([0xff, 0xff, 0xff, 0xff]),
      'high-first',
    );
    expect(result).toMatchObject({ rawValue: 4_294_967_295 });
  });

  it('`int32`ü işaretli okur', () => {
    const result = decodeVendorMapEntry(
      entry({ type: 'int32' }),
      Uint8Array.from([0xff, 0xff, 0xff, 0xff]),
      'high-first',
    );
    expect(result).toMatchObject({ rawValue: -1 });
  });

  it('`float32`ü IEEE 754 okur (0x44FA0000 = 2000)', () => {
    const result = decodeVendorMapEntry(
      entry({ type: 'float32' }),
      Uint8Array.from([0x44, 0xfa, 0x00, 0x00]),
      'high-first',
    );
    expect(result).toMatchObject({ rawValue: 2000, physicalValue: 2000 });
  });

  it('`float32`te kelime sırası register çiftini takas eder', () => {
    const result = decodeVendorMapEntry(
      entry({ type: 'float32' }),
      Uint8Array.from([0x00, 0x00, 0x44, 0xfa]),
      'low-first',
    );
    expect(result).toMatchObject({ rawValue: 2000 });
  });

  it('`bitfield`i bit bit adlandırır', () => {
    const result = decodeVendorMapEntry(
      entry({
        type: 'bitfield',
        bits: [
          { bit: 0, name: 'Ready' },
          { bit: 1, name: 'Fault' },
          { bit: 3, name: 'Overload' },
        ],
      }),
      Uint8Array.from([0x00, 0x09]), // bit0 + bit3
      'high-first',
    );
    expect(result).toMatchObject({
      rawValue: 9,
      bits: [
        { bit: 0, name: 'Ready', value: true },
        { bit: 1, name: 'Fault', value: false },
        { bit: 3, name: 'Overload', value: true },
      ],
    });
  });

  it('`enum`da sözlük karşılığını basar; karşılık yoksa HAM sayı kalır', () => {
    const values = { '0': 'Idle', '1': 'Run' };

    expect(
      decodeVendorMapEntry(entry({ type: 'enum', enumValues: values }), Uint8Array.from([0x00, 0x01]), 'high-first'),
    ).toMatchObject({ physicalValue: 'Run', enumLabel: 'Run' });

    const unknown = decodeVendorMapEntry(
      entry({ type: 'enum', enumValues: values }),
      Uint8Array.from([0x00, 0x09]),
      'high-first',
    );
    expect(unknown).toMatchObject({ rawValue: 9, physicalValue: 9 });
    expect(unknown.success && unknown.enumLabel).toBeUndefined();
  });

  it('`ascii`de dolgu baytlarını (NUL/0xFF) atar', () => {
    const result = decodeVendorMapEntry(
      entry({ type: 'ascii', length: 4 }),
      Uint8Array.from([0x41, 0x4c, 0x50, 0x2d, 0x30, 0x31, 0x00, 0xff]),
      'high-first',
    );
    expect(result).toMatchObject({ rawValue: 'ALP-01' });
  });

  it('`raw`ı ayraçlı hex basar', () => {
    const result = decodeVendorMapEntry(
      entry({ type: 'raw', length: 2 }),
      Uint8Array.from([0xde, 0xad, 0xbe, 0xef]),
      'high-first',
    );
    expect(result).toMatchObject({ rawValue: 'DE AD BE EF' });
  });

  it('bayt yetmiyorsa çözmez ve KAÇ bayt gerektiğini söyler', () => {
    const result = decodeVendorMapEntry(entry({ type: 'uint32' }), Uint8Array.from([0x00, 0x01]), 'high-first');
    expect(result).toEqual({
      success: false,
      messageKey: 'definition.vendorMap.decode.tooShort',
      requiredBytes: 4,
    });
  });
});
