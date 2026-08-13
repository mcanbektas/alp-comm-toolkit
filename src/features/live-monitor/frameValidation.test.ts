import { describe, expect, it } from 'vitest';

import { buildSimulatedFrame } from '../../connection/mock/simulatedProtocol';
import {
  checksumWidthBytes,
  DEFAULT_FRAME_VALIDATION,
  SIMULATED_FRAME_VALIDATION,
  validateFrame,
} from './frameValidation';

describe('checksumWidthBytes', () => {
  it('genişliği algoritmadan türetir', () => {
    expect(checksumWidthBytes('none')).toBe(0);
    expect(checksumWidthBytes('xor8')).toBe(1);
    expect(checksumWidthBytes('lrc')).toBe(1);
    expect(checksumWidthBytes('CRC8')).toBe(1);
    expect(checksumWidthBytes('CRC16_MODBUS')).toBe(2);
    expect(checksumWidthBytes('CRC32')).toBe(4);
  });
});

describe('validateFrame', () => {
  it('algoritma yokken denetlemez — "geçerli" DEMEZ', () => {
    const frame = buildSimulatedFrame({ temperatureDeciC: 250, voltageMilliV: 12_000, rpm: 1500 });

    expect(validateFrame(frame, DEFAULT_FRAME_VALIDATION)).toBe('unchecked');
  });

  it('simülasyon çerçevesini XOR8 ile doğrular', () => {
    const frame = buildSimulatedFrame({ temperatureDeciC: 250, voltageMilliV: 12_000, rpm: 1500 });

    expect(validateFrame(frame, SIMULATED_FRAME_VALIDATION)).toBe('valid');
  });

  it('payload bozulunca checksum hatası verir', () => {
    const frame = buildSimulatedFrame({ temperatureDeciC: 250, voltageMilliV: 12_000, rpm: 1500 });
    const corrupted = Uint8Array.from(frame);
    corrupted[4] = ((corrupted[4] ?? 0) ^ 0xff) & 0xff;

    expect(validateFrame(corrupted, SIMULATED_FRAME_VALIDATION)).toBe('checksum-error');
  });

  it('CRC algoritmalarında hata "crc-error" olarak ayrılır — spec §39 ayrı sayaç', () => {
    // Modbus RTU: `01 03 00 00 00 02 C4 0B` (spec §43 doğrulanmış fixture)
    const valid = Uint8Array.from([0x01, 0x03, 0x00, 0x00, 0x00, 0x02, 0xc4, 0x0b]);
    const config = {
      algorithm: 'CRC16_MODBUS',
      endianness: 'little',
      trailingBytesAfterChecksum: 0,
      skipLeadingBytes: 0,
    } as const;

    expect(validateFrame(valid, config)).toBe('valid');

    const broken = Uint8Array.from(valid);
    broken[2] = 0x01;
    expect(validateFrame(broken, config)).toBe('crc-error');
  });

  it('checksum bayt sırası yanlış verilirse doğrulama düşer', () => {
    const valid = Uint8Array.from([0x01, 0x03, 0x00, 0x00, 0x00, 0x02, 0xc4, 0x0b]);

    expect(
      validateFrame(valid, {
        algorithm: 'CRC16_MODBUS',
        endianness: 'big',
        trailingBytesAfterChecksum: 0,
        skipLeadingBytes: 0,
      }),
    ).toBe('crc-error');
  });

  it('checksum taşıyamayacak kadar kısa çerçeve denetlenmemiş sayılır', () => {
    expect(validateFrame(Uint8Array.from([0xaa]), SIMULATED_FRAME_VALIDATION)).toBe('unchecked');
    expect(validateFrame(new Uint8Array(0), SIMULATED_FRAME_VALIDATION)).toBe('unchecked');
  });

  it('skipLeadingBytes checksum kapsamını daraltır', () => {
    // Baştaki START baytı checksum'a girmesin: aynı veri iki farklı sonuç verir.
    const bytes = Uint8Array.from([0xaa, 0x01, 0x02, 0x03]);
    const covered = 0x01 ^ 0x02;
    bytes[3] = covered;

    expect(
      validateFrame(bytes, {
        algorithm: 'xor8',
        endianness: 'big',
        trailingBytesAfterChecksum: 0,
        skipLeadingBytes: 1,
      }),
    ).toBe('valid');

    expect(
      validateFrame(bytes, {
        algorithm: 'xor8',
        endianness: 'big',
        trailingBytesAfterChecksum: 0,
        skipLeadingBytes: 0,
      }),
    ).toBe('checksum-error');
  });
});
