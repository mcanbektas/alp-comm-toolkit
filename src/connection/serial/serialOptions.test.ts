import { describe, expect, it } from 'vitest';

import {
  DEFAULT_SERIAL_OPTIONS,
  SERIAL_BAUD_RATES,
  serialBitsPerByte,
  validateSerialOptions,
  type SerialConnectionOptions,
} from './serialOptions';

describe('SERIAL_BAUD_RATES', () => {
  it('spec §8.1 listesini birebir taşır', () => {
    expect(Array.from(SERIAL_BAUD_RATES)).toEqual([
      300, 600, 1200, 2400, 4800, 9600, 19200, 38400, 57600, 115200, 230400, 460800, 921600,
      1000000, 2000000,
    ]);
  });
});

describe('validateSerialOptions', () => {
  it('varsayılan ayarlar geçerlidir', () => {
    expect(validateSerialOptions(DEFAULT_SERIAL_OPTIONS)).toEqual([]);
  });

  it('listede olmayan baud rate kabul edilir — spec §8.1 "Custom" seçeneği', () => {
    expect(validateSerialOptions({ ...DEFAULT_SERIAL_OPTIONS, baudRate: 31_250 })).toEqual([]);
  });

  it('kesirli baud rate reddedilir', () => {
    expect(validateSerialOptions({ ...DEFAULT_SERIAL_OPTIONS, baudRate: 9600.5 })).toEqual([
      { field: 'baudRate', code: 'not-integer' },
    ]);
  });

  it('sıfır ve negatif baud rate aralık dışıdır', () => {
    expect(validateSerialOptions({ ...DEFAULT_SERIAL_OPTIONS, baudRate: 0 })).toEqual([
      { field: 'baudRate', code: 'out-of-range' },
    ]);
    expect(validateSerialOptions({ ...DEFAULT_SERIAL_OPTIONS, baudRate: -9600 })).toEqual([
      { field: 'baudRate', code: 'out-of-range' },
    ]);
  });

  it('buffer size alt ve üst sınırları uygulanır', () => {
    expect(validateSerialOptions({ ...DEFAULT_SERIAL_OPTIONS, bufferSize: 32 })).toEqual([
      { field: 'bufferSize', code: 'out-of-range' },
    ]);
    expect(validateSerialOptions({ ...DEFAULT_SERIAL_OPTIONS, bufferSize: 2 * 1024 * 1024 })).toEqual([
      { field: 'bufferSize', code: 'out-of-range' },
    ]);
  });

  it('form girdisinden gelen geçersiz sayım değerlerini yakalar', () => {
    // Tip düzeyinde erişilemez ama çalışma zamanında form/URL girdisinden
    // gelebilir; doğrulamanın var olma sebebi tam olarak bu yol.
    const fromUntypedInput = {
      ...DEFAULT_SERIAL_OPTIONS,
      dataBits: 5,
      parity: 'mark',
    } as unknown as SerialConnectionOptions;

    expect(validateSerialOptions(fromUntypedInput)).toEqual([
      { field: 'dataBits', code: 'not-allowed' },
      { field: 'parity', code: 'not-allowed' },
    ]);
  });

  it('birden çok hatayı birlikte bildirir', () => {
    const issues = validateSerialOptions({
      ...DEFAULT_SERIAL_OPTIONS,
      baudRate: -1,
      bufferSize: 0,
    });

    expect(issues).toHaveLength(2);
  });
});

describe('serialBitsPerByte', () => {
  it('8N1 için 10 bit verir (1 start + 8 data + 0 parity + 1 stop)', () => {
    expect(serialBitsPerByte(DEFAULT_SERIAL_OPTIONS)).toBe(10);
  });

  it('parity ve ikinci stop biti karakter uzunluğunu artırır', () => {
    expect(
      serialBitsPerByte({ ...DEFAULT_SERIAL_OPTIONS, parity: 'even', stopBits: 2 }),
    ).toBe(12);
  });
});
