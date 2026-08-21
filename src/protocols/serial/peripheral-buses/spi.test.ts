import { describe, expect, it } from 'vitest';

import { isParseSuccess } from '@/protocol-core/types';
import { parseSpi, spiParser, spiPlugin } from './spi';
import type { SpiFrameMetadata } from './spi';

function exampleBytes(id: string): Uint8Array {
  const example = spiPlugin.exampleFrames.find((frame) => frame.id === id);
  if (example === undefined) throw new Error(`örnek çerçeve bulunamadı: ${id}`);
  return example.bytes;
}

describe('parseSpi — register-read (spec IMU örneği)', () => {
  it('bit7 set → Read, register adresi maskelenir, dummy + data doğru ayrılır', () => {
    const result = parseSpi(exampleBytes('register-read'));
    if (!isParseSuccess(result)) throw new Error('beklenmeyen ParseFailure');
    expect(result.frame.valid).toBe(true);
    expect(result.consumedBytes).toBe(3);

    const command = result.frame.fields.find((field) => field.id === 'command');
    expect(command?.rawValue).toBe(0xf5);
    expect(command?.physicalValue).toBe('Read · Register 0x75');

    expect(result.frame.fields.find((field) => field.id === 'dummy')?.rawValue).toBe(0x00);
    expect(result.frame.fields.find((field) => field.id === 'data')?.rawBytes).toEqual(
      Uint8Array.from([0x71]),
    );

    const metadata = result.frame.rawFrame.metadata as SpiFrameMetadata;
    expect(metadata.isRead).toBe(true);
    expect(metadata.registerAddress).toBe(0x75);
    expect(metadata.summaryKey).toBe('protocol.spi.summary.read');
  });
});

describe('parseSpi — register-write', () => {
  it('bit7 clear → Write, dummy YOK, data doğrudan komuttan sonra başlar', () => {
    const result = parseSpi(exampleBytes('register-write'));
    if (!isParseSuccess(result)) throw new Error('beklenmeyen ParseFailure');
    expect(result.frame.valid).toBe(true);

    const command = result.frame.fields.find((field) => field.id === 'command');
    expect(command?.physicalValue).toBe('Write · Register 0x75');
    expect(result.frame.fields.find((field) => field.id === 'dummy')).toBeUndefined();
    expect(result.frame.fields.find((field) => field.id === 'data')?.rawBytes).toEqual(
      Uint8Array.from([0xab]),
    );

    const metadata = result.frame.rawFrame.metadata as SpiFrameMetadata;
    expect(metadata.isRead).toBe(false);
    expect(metadata.summaryKey).toBe('protocol.spi.summary.write');
  });
});

describe('parseSpi — multi-byte-read', () => {
  it('Data alanı birden çok baytı tek alanda taşır', () => {
    const result = parseSpi(exampleBytes('multi-byte-read'));
    if (!isParseSuccess(result)) throw new Error('beklenmeyen ParseFailure');
    const dataField = result.frame.fields.find((field) => field.id === 'data');
    expect(dataField?.rawBytes).toEqual(Uint8Array.from([0x71, 0x1a, 0x00, 0x42]));
    expect(dataField?.length).toBe(4);
  });
});

describe('parseSpi — yapısal hata yolları', () => {
  it('boş girdide truncated-frame ile ParseFailure döner (recoverable)', () => {
    const result = parseSpi(Uint8Array.from([]));
    expect(result.success).toBe(false);
    if (result.success) throw new Error('beklenmeyen ParseSuccess');
    expect(result.error.code).toBe('truncated-frame');
    expect(result.recoverable).toBe(true);
  });

  it('yalnız komut baytı verilirse dummy/data alanı hiç basılmaz, çerçeve yine valid', () => {
    const result = parseSpi(Uint8Array.from([0xf5]));
    if (!isParseSuccess(result)) throw new Error('beklenmeyen ParseFailure');
    expect(result.frame.valid).toBe(true);
    expect(result.frame.fields.find((field) => field.id === 'dummy')).toBeUndefined();
    expect(result.frame.fields.find((field) => field.id === 'data')).toBeUndefined();
  });

  it('iptal edilen sinyalde parser-timeout ile ParseFailure döner', () => {
    const controller = new AbortController();
    controller.abort();
    const result = spiParser.parse(exampleBytes('register-read'), { signal: controller.signal });
    expect(result.success).toBe(false);
    if (result.success) throw new Error('beklenmeyen ParseSuccess');
    expect(result.error.code).toBe('parser-timeout');
  });
});

describe('spiParser.canParse', () => {
  it('boş olmayan her girdide true döner (SPI ayırt edici bir imza taşımıyor)', () => {
    expect(spiParser.canParse(Uint8Array.from([0x00]))).toBe(true);
  });

  it('boş girdide false döner', () => {
    expect(spiParser.canParse(Uint8Array.from([]))).toBe(false);
  });
});

describe('spiPlugin', () => {
  it('her örnek çerçevenin expectedValid alanı gerçek parse sonucunu yansıtır', () => {
    for (const example of spiPlugin.exampleFrames) {
      const result = parseSpi(example.bytes);
      expect(isParseSuccess(result), example.id).toBe(true);
    }
  });

  it('katalog id, kategori ve örnek çerçeve sayısı beklenen gibidir', () => {
    expect(spiPlugin.id).toBe('spi');
    expect(spiPlugin.category).toBe('interfaces-framing');
    expect(spiPlugin.exampleFrames.length).toBeGreaterThan(0);
  });
});
