import { describe, expect, it } from 'vitest';

import { isParseSuccess } from '@/protocol-core/types';
import { parseI2c, i2cParser, i2cPlugin } from './i2c';
import type { I2cFrameMetadata } from './i2c';

function exampleBytes(id: string): Uint8Array {
  const example = i2cPlugin.exampleFrames.find((frame) => frame.id === id);
  if (example === undefined) throw new Error(`örnek çerçeve bulunamadı: ${id}`);
  return example.bytes;
}

describe('parseI2c — register-read (spec ana örneği, repeated START)', () => {
  it('Address+W, Register, Repeated START Address+R, Data doğru ayrılır', () => {
    const result = parseI2c(exampleBytes('register-read'));
    if (!isParseSuccess(result)) throw new Error('beklenmeyen ParseFailure');
    expect(result.frame.valid).toBe(true);
    expect(result.consumedBytes).toBe(4);

    const address = result.frame.fields.find((field) => field.id === 'address');
    expect(address?.rawValue).toBe(0xd0);
    expect(address?.physicalValue).toBe('Write · 7-bit 0x68 (0xD0)');

    const register = result.frame.fields.find((field) => field.id === 'register');
    expect(register?.rawValue).toBe(0x75);

    const repeatedAddress = result.frame.fields.find((field) => field.id === 'repeatedAddress');
    expect(repeatedAddress?.rawValue).toBe(0xd1);
    expect(repeatedAddress?.physicalValue).toBe('Read · 7-bit 0x68 (0xD1)');

    expect(result.frame.fields.find((field) => field.id === 'data')?.rawBytes).toEqual(
      Uint8Array.from([0x71]),
    );

    const metadata = result.frame.rawFrame.metadata as I2cFrameMetadata;
    expect(metadata.address7bit).toBe(0x68);
    expect(metadata.hasRepeatedStart).toBe(true);
    expect(metadata.summaryKey).toBe('protocol.i2c.summary.registerRead');
  });
});

describe('parseI2c — register-write', () => {
  it('repeated-start YOK, register sonrası veri doğrudan Write olarak çözülür', () => {
    const result = parseI2c(exampleBytes('register-write'));
    if (!isParseSuccess(result)) throw new Error('beklenmeyen ParseFailure');
    expect(result.frame.valid).toBe(true);
    expect(result.frame.fields.find((field) => field.id === 'repeatedAddress')).toBeUndefined();
    expect(result.frame.fields.find((field) => field.id === 'register')?.rawValue).toBe(0x75);
    expect(result.frame.fields.find((field) => field.id === 'data')?.rawBytes).toEqual(
      Uint8Array.from([0xab]),
    );

    const metadata = result.frame.rawFrame.metadata as I2cFrameMetadata;
    expect(metadata.isRead).toBe(false);
    expect(metadata.hasRepeatedStart).toBe(false);
    expect(metadata.summaryKey).toBe('protocol.i2c.summary.write');
  });
});

describe('parseI2c — read-only (repeated-start yok, doğrudan Address+R)', () => {
  it('register alanı basılmaz, ikinci bayttan itibaren hepsi Data', () => {
    const result = parseI2c(exampleBytes('read-only'));
    if (!isParseSuccess(result)) throw new Error('beklenmeyen ParseFailure');
    expect(result.frame.fields.find((field) => field.id === 'register')).toBeUndefined();
    expect(result.frame.fields.find((field) => field.id === 'data')?.rawBytes).toEqual(
      Uint8Array.from([0x71]),
    );

    const metadata = result.frame.rawFrame.metadata as I2cFrameMetadata;
    expect(metadata.isRead).toBe(true);
    expect(metadata.summaryKey).toBe('protocol.i2c.summary.read');
  });
});

describe('parseI2c — bus-probe (address-only)', () => {
  it('tek bayt → register/data alanı basılmaz, probe özeti döner', () => {
    const result = parseI2c(exampleBytes('bus-probe'));
    if (!isParseSuccess(result)) throw new Error('beklenmeyen ParseFailure');
    expect(result.consumedBytes).toBe(1);
    expect(result.frame.fields).toHaveLength(1);
    expect(result.frame.fields[0]?.physicalValue).toBe('Write · 7-bit 0x1E (0x3C)');

    const metadata = result.frame.rawFrame.metadata as I2cFrameMetadata;
    expect(metadata.summaryKey).toBe('protocol.i2c.summary.probe');
  });
});

describe('parseI2c — yanlış pozitif olmayan repeated-start ayrımı', () => {
  it('3. bayt farklı 7-bit adres taşıyorsa repeated-start SAYILMAZ, düz write olarak çözülür', () => {
    // Address 0x68+W(0xD0), Register 0x75, 3. bayt FARKLI adres+Read (0x69<<1|1=0xD3) — register write'ın datası.
    const result = parseI2c(Uint8Array.from([0xd0, 0x75, 0xd3]));
    if (!isParseSuccess(result)) throw new Error('beklenmeyen ParseFailure');
    expect(result.frame.fields.find((field) => field.id === 'repeatedAddress')).toBeUndefined();

    const metadata = result.frame.rawFrame.metadata as I2cFrameMetadata;
    expect(metadata.hasRepeatedStart).toBe(false);
    expect(metadata.summaryKey).toBe('protocol.i2c.summary.write');
  });
});

describe('parseI2c — yapısal hata yolları', () => {
  it('boş girdide truncated-frame ile ParseFailure döner (recoverable)', () => {
    const result = parseI2c(Uint8Array.from([]));
    expect(result.success).toBe(false);
    if (result.success) throw new Error('beklenmeyen ParseSuccess');
    expect(result.error.code).toBe('truncated-frame');
    expect(result.recoverable).toBe(true);
  });

  it('iptal edilen sinyalde parser-timeout ile ParseFailure döner', () => {
    const controller = new AbortController();
    controller.abort();
    const result = i2cParser.parse(exampleBytes('register-read'), { signal: controller.signal });
    expect(result.success).toBe(false);
    if (result.success) throw new Error('beklenmeyen ParseSuccess');
    expect(result.error.code).toBe('parser-timeout');
  });
});

describe('i2cParser.canParse', () => {
  it('boş olmayan her girdide true döner (I2C ayırt edici bir imza taşımıyor)', () => {
    expect(i2cParser.canParse(Uint8Array.from([0x00]))).toBe(true);
  });

  it('boş girdide false döner', () => {
    expect(i2cParser.canParse(Uint8Array.from([]))).toBe(false);
  });
});

describe('i2cPlugin', () => {
  it('her örnek çerçevenin expectedValid alanı gerçek parse sonucunu yansıtır', () => {
    for (const example of i2cPlugin.exampleFrames) {
      const result = parseI2c(example.bytes);
      expect(isParseSuccess(result), example.id).toBe(true);
    }
  });

  it('katalog id, kategori ve örnek çerçeve sayısı beklenen gibidir', () => {
    expect(i2cPlugin.id).toBe('i2c');
    expect(i2cPlugin.category).toBe('interfaces-framing');
    expect(i2cPlugin.exampleFrames.length).toBeGreaterThan(0);
  });
});
