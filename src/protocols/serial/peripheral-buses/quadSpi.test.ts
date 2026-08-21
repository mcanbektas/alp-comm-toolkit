import { describe, expect, it } from 'vitest';

import { isParseSuccess } from '@/protocol-core/types';
import { parseQuadSpi, quadSpiParser, quadSpiPlugin } from './quadSpi';
import type { QuadSpiFrameMetadata } from './quadSpi';

function exampleBytes(id: string): Uint8Array {
  const example = quadSpiPlugin.exampleFrames.find((frame) => frame.id === id);
  if (example === undefined) throw new Error(`örnek çerçeve bulunamadı: ${id}`);
  return example.bytes;
}

describe('parseQuadSpi — flash-fast-read (spec örneği)', () => {
  it('Command 0xEB, Address 0x001234 büyük-uçlu, Data doğru çözülür', () => {
    const result = parseQuadSpi(exampleBytes('flash-fast-read'));
    if (!isParseSuccess(result)) throw new Error('beklenmeyen ParseFailure');
    expect(result.frame.valid).toBe(true);
    expect(result.consumedBytes).toBe(8);

    expect(result.frame.fields.find((field) => field.id === 'command')?.rawValue).toBe(0xeb);

    const address = result.frame.fields.find((field) => field.id === 'address');
    expect(address?.rawValue).toBe(0x001234);
    expect(address?.physicalValue).toBe('0x001234');

    const data = result.frame.fields.find((field) => field.id === 'data');
    expect(data?.rawBytes).toEqual(Uint8Array.from([0xde, 0xad, 0xbe, 0xef]));

    const metadata = result.frame.rawFrame.metadata as QuadSpiFrameMetadata;
    expect(metadata.command).toBe(0xeb);
    expect(metadata.address).toBe(0x001234);
    expect(metadata.summaryKey).toBe('protocol.quadSpi.summary.transaction');
  });
});

describe('parseQuadSpi — command-only', () => {
  it('adressiz komutta Address ve Data alanı hiç basılmaz', () => {
    const result = parseQuadSpi(exampleBytes('command-only'));
    if (!isParseSuccess(result)) throw new Error('beklenmeyen ParseFailure');
    expect(result.frame.valid).toBe(true);
    expect(result.frame.fields.find((field) => field.id === 'command')?.rawValue).toBe(0x06);
    expect(result.frame.fields.find((field) => field.id === 'address')).toBeUndefined();
    expect(result.frame.fields.find((field) => field.id === 'data')).toBeUndefined();

    const metadata = result.frame.rawFrame.metadata as QuadSpiFrameMetadata;
    expect(metadata.address).toBeUndefined();
  });
});

describe('parseQuadSpi — kısmi adres capture', () => {
  it('adres 3 bayttan kısaysa Address alanı hiç basılmaz, kalan bayt Data sayılır', () => {
    // Komut + yalnızca 2 adres baytı (3 tamamlanmadan kesilmiş capture).
    const result = parseQuadSpi(Uint8Array.from([0xeb, 0x00, 0x12]));
    if (!isParseSuccess(result)) throw new Error('beklenmeyen ParseFailure');
    expect(result.frame.fields.find((field) => field.id === 'address')).toBeUndefined();
    const data = result.frame.fields.find((field) => field.id === 'data');
    expect(data?.rawBytes).toEqual(Uint8Array.from([0x00, 0x12]));
  });
});

describe('parseQuadSpi — yapısal hata yolları', () => {
  it('boş girdide truncated-frame ile ParseFailure döner (recoverable)', () => {
    const result = parseQuadSpi(Uint8Array.from([]));
    expect(result.success).toBe(false);
    if (result.success) throw new Error('beklenmeyen ParseSuccess');
    expect(result.error.code).toBe('truncated-frame');
    expect(result.recoverable).toBe(true);
  });

  it('iptal edilen sinyalde parser-timeout ile ParseFailure döner', () => {
    const controller = new AbortController();
    controller.abort();
    const result = quadSpiParser.parse(exampleBytes('flash-fast-read'), { signal: controller.signal });
    expect(result.success).toBe(false);
    if (result.success) throw new Error('beklenmeyen ParseSuccess');
    expect(result.error.code).toBe('parser-timeout');
  });
});

describe('quadSpiParser.canParse', () => {
  it('boş olmayan her girdide true döner', () => {
    expect(quadSpiParser.canParse(Uint8Array.from([0x00]))).toBe(true);
  });

  it('boş girdide false döner', () => {
    expect(quadSpiParser.canParse(Uint8Array.from([]))).toBe(false);
  });
});

describe('quadSpiPlugin', () => {
  it('her örnek çerçevenin expectedValid alanı gerçek parse sonucunu yansıtır', () => {
    for (const example of quadSpiPlugin.exampleFrames) {
      const result = parseQuadSpi(example.bytes);
      expect(isParseSuccess(result), example.id).toBe(true);
    }
  });

  it('katalog id, kategori ve örnek çerçeve sayısı beklenen gibidir', () => {
    expect(quadSpiPlugin.id).toBe('quad-spi');
    expect(quadSpiPlugin.category).toBe('interfaces-framing');
    expect(quadSpiPlugin.exampleFrames.length).toBeGreaterThan(0);
  });
});
