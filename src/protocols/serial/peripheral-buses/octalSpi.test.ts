import { describe, expect, it } from 'vitest';

import { isParseSuccess } from '@/protocol-core/types';
import { octalSpiParser, octalSpiPlugin, parseOctalSpi } from './octalSpi';
import type { OctalSpiFrameMetadata } from './octalSpi';

function exampleBytes(id: string): Uint8Array {
  const example = octalSpiPlugin.exampleFrames.find((frame) => frame.id === id);
  if (example === undefined) throw new Error(`örnek çerçeve bulunamadı: ${id}`);
  return example.bytes;
}

describe('parseOctalSpi — flash-read', () => {
  it('Command + Address(3, büyük-uçlu) + Data doğru çözülür', () => {
    const result = parseOctalSpi(exampleBytes('flash-read'));
    if (!isParseSuccess(result)) throw new Error('beklenmeyen ParseFailure');
    expect(result.frame.valid).toBe(true);
    expect(result.consumedBytes).toBe(8);

    expect(result.frame.fields.find((field) => field.id === 'command')?.rawValue).toBe(0x0c);

    const address = result.frame.fields.find((field) => field.id === 'address');
    expect(address?.rawValue).toBe(0x000000);

    const data = result.frame.fields.find((field) => field.id === 'data');
    expect(data?.rawBytes).toEqual(Uint8Array.from([0xca, 0xfe, 0xba, 0xbe]));

    const metadata = result.frame.rawFrame.metadata as OctalSpiFrameMetadata;
    expect(metadata.command).toBe(0x0c);
    expect(metadata.summaryKey).toBe('protocol.octalSpi.summary.transaction');
  });
});

describe('parseOctalSpi — command-only', () => {
  it('adressiz komutta Address ve Data alanı hiç basılmaz', () => {
    const result = parseOctalSpi(exampleBytes('command-only'));
    if (!isParseSuccess(result)) throw new Error('beklenmeyen ParseFailure');
    expect(result.frame.fields.find((field) => field.id === 'address')).toBeUndefined();
    expect(result.frame.fields.find((field) => field.id === 'data')).toBeUndefined();

    const metadata = result.frame.rawFrame.metadata as OctalSpiFrameMetadata;
    expect(metadata.address).toBeUndefined();
  });
});

describe('parseOctalSpi — kısmi adres capture', () => {
  it('adres 3 bayttan kısaysa Address alanı hiç basılmaz, kalan bayt Data sayılır', () => {
    const result = parseOctalSpi(Uint8Array.from([0x0c, 0x00, 0x00]));
    if (!isParseSuccess(result)) throw new Error('beklenmeyen ParseFailure');
    expect(result.frame.fields.find((field) => field.id === 'address')).toBeUndefined();
    const data = result.frame.fields.find((field) => field.id === 'data');
    expect(data?.rawBytes).toEqual(Uint8Array.from([0x00, 0x00]));
  });
});

describe('parseOctalSpi — yapısal hata yolları', () => {
  it('boş girdide truncated-frame ile ParseFailure döner (recoverable)', () => {
    const result = parseOctalSpi(Uint8Array.from([]));
    expect(result.success).toBe(false);
    if (result.success) throw new Error('beklenmeyen ParseSuccess');
    expect(result.error.code).toBe('truncated-frame');
    expect(result.recoverable).toBe(true);
  });

  it('iptal edilen sinyalde parser-timeout ile ParseFailure döner', () => {
    const controller = new AbortController();
    controller.abort();
    const result = octalSpiParser.parse(exampleBytes('flash-read'), { signal: controller.signal });
    expect(result.success).toBe(false);
    if (result.success) throw new Error('beklenmeyen ParseSuccess');
    expect(result.error.code).toBe('parser-timeout');
  });
});

describe('octalSpiParser.canParse', () => {
  it('boş olmayan her girdide true döner', () => {
    expect(octalSpiParser.canParse(Uint8Array.from([0x00]))).toBe(true);
  });

  it('boş girdide false döner', () => {
    expect(octalSpiParser.canParse(Uint8Array.from([]))).toBe(false);
  });
});

describe('octalSpiPlugin', () => {
  it('her örnek çerçevenin expectedValid alanı gerçek parse sonucunu yansıtır', () => {
    for (const example of octalSpiPlugin.exampleFrames) {
      const result = parseOctalSpi(example.bytes);
      expect(isParseSuccess(result), example.id).toBe(true);
    }
  });

  it('katalog id, kategori ve örnek çerçeve sayısı beklenen gibidir', () => {
    expect(octalSpiPlugin.id).toBe('octal-spi');
    expect(octalSpiPlugin.category).toBe('interfaces-framing');
    expect(octalSpiPlugin.exampleFrames.length).toBeGreaterThan(0);
  });
});
