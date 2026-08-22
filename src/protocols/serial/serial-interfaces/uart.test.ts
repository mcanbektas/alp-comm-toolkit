import { describe, expect, it } from 'vitest';

import { isParseSuccess } from '@/protocol-core/types';
import { parseUart, uartParser, uartPlugin } from './uart';
import type { UartFrameMetadata } from './uart';

function exampleBytes(id: string): Uint8Array {
  const example = uartPlugin.exampleFrames.find((frame) => frame.id === id);
  if (example === undefined) throw new Error(`örnek çerçeve bulunamadı: ${id}`);
  return example.bytes;
}

describe('parseUart — spec canlı görünüm örneği (Hello + CRLF)', () => {
  it('yükü karakterlere, satır sonunu ayrı alana ayırır', () => {
    const result = parseUart(exampleBytes('hello-crlf'));
    if (!isParseSuccess(result)) throw new Error('beklenmeyen ParseFailure');

    expect(result.consumedBytes).toBe(7);
    // 5 karakter + 1 satır sonu alanı; CRLF iki bayt ama TEK alan.
    expect(result.frame.fields).toHaveLength(6);
    expect(result.frame.fields[0]?.physicalValue).toBe("0x48 'H' · 0 00010010 1");

    const lineEnding = result.frame.fields[5];
    expect(lineEnding?.id).toBe('lineEnding');
    expect(lineEnding?.offset).toBe(5);
    expect(lineEnding?.length).toBe(2);
    expect(lineEnding?.physicalValue).toBe('CRLF (0x0D 0x0A)');
  });

  it("ASCII karşılığını ve satır sonu türünü metadata'ya yazar", () => {
    const result = parseUart(exampleBytes('hello-crlf'));
    if (!isParseSuccess(result)) throw new Error('beklenmeyen ParseFailure');

    const metadata = result.frame.rawFrame.metadata as UartFrameMetadata;
    expect(metadata.asciiText).toBe('Hello');
    expect(metadata.lineEnding).toBe('crlf');
    expect(metadata.payloadCharacterCount).toBe(5);
    // Satır sonu baytları da hat üzerinde geçer: süre TÜM baytları sayar.
    expect(metadata.characterCount).toBe(7);
    expect(metadata.totalBitTimes).toBe(70);
  });

  it('alanlar tüm baytları kapsar, hiçbiri sessizce düşmez', () => {
    const result = parseUart(exampleBytes('hello-crlf'));
    if (!isParseSuccess(result)) throw new Error('beklenmeyen ParseFailure');
    const covered = result.frame.fields.reduce((total, field) => total + field.length, 0);
    expect(covered).toBe(7);
  });
});

describe('parseUart — spec bit görünümü örneği (0x53)', () => {
  /** Spec özeti (`01-fiziksel-arayuzler.md:88`): 0x53 → `0 1 1 0 0 1 0 1 0 1`. */
  it('0x53 hattı LSB-first olarak 0 11001010 1 basar', () => {
    const result = parseUart(exampleBytes('bit-view'));
    if (!isParseSuccess(result)) throw new Error('beklenmeyen ParseFailure');
    expect(result.frame.fields).toHaveLength(1);
    expect(result.frame.fields[0]?.physicalValue).toBe("0x53 'S' · 0 11001010 1");
  });
});

describe('parseUart — satır sonu ayrımı', () => {
  it('yalnız LF ile biten yakalamada LF alanı üretir', () => {
    const result = parseUart(Uint8Array.from([0x41, 0x0a]));
    if (!isParseSuccess(result)) throw new Error('beklenmeyen ParseFailure');
    expect(result.frame.fields[1]?.physicalValue).toBe('LF (0x0A)');
    expect((result.frame.rawFrame.metadata as UartFrameMetadata).lineEnding).toBe('lf');
  });

  it('yalnız CR ile biten yakalamada CR alanı üretir', () => {
    const result = parseUart(Uint8Array.from([0x41, 0x0d]));
    if (!isParseSuccess(result)) throw new Error('beklenmeyen ParseFailure');
    expect(result.frame.fields[1]?.physicalValue).toBe('CR (0x0D)');
    expect((result.frame.rawFrame.metadata as UartFrameMetadata).lineEnding).toBe('cr');
  });

  /** Ortadaki CR/LF veri sayılır — yalnız yakalamanın SONU incelenir. */
  it('ortadaki CR satır sonu sayılmaz', () => {
    const result = parseUart(Uint8Array.from([0x41, 0x0d, 0x42]));
    if (!isParseSuccess(result)) throw new Error('beklenmeyen ParseFailure');
    expect(result.frame.fields).toHaveLength(3);
    expect(result.frame.fields.some((field) => field.id === 'lineEnding')).toBe(false);
    expect((result.frame.rawFrame.metadata as UartFrameMetadata).lineEnding).toBe('none');
  });

  it('satır sonu olmayan ikilik yükte alan hiç görünmez, ASCII nokta ile dolar', () => {
    const result = parseUart(exampleBytes('binary-payload'));
    if (!isParseSuccess(result)) throw new Error('beklenmeyen ParseFailure');
    expect(result.frame.fields.some((field) => field.id === 'lineEnding')).toBe(false);
    expect((result.frame.rawFrame.metadata as UartFrameMetadata).asciiText).toBe('..U');
  });

  it('yalnız satır sonundan oluşan yakalamada karakter alanı kalmaz', () => {
    const result = parseUart(Uint8Array.from([0x0d, 0x0a]));
    if (!isParseSuccess(result)) throw new Error('beklenmeyen ParseFailure');
    expect(result.frame.fields).toHaveLength(1);
    expect(result.frame.fields[0]?.id).toBe('lineEnding');
    expect((result.frame.rawFrame.metadata as UartFrameMetadata).payloadCharacterCount).toBe(0);
  });
});

describe('parseUart — hata yolları', () => {
  it('boş arabellek kurtarılabilir hata verir', () => {
    const result = parseUart(new Uint8Array(0));
    expect(isParseSuccess(result)).toBe(false);
    if (isParseSuccess(result)) return;
    expect(result.error.code).toBe('truncated-frame');
    expect(result.error.message).toBe('protocol.uart.error.emptyFrame');
  });

  it('iptal edilmiş signal ile çözümleme yapılmaz', () => {
    const controller = new AbortController();
    controller.abort();
    const result = uartParser.parse(Uint8Array.from([0x41]), { signal: controller.signal });
    expect(isParseSuccess(result)).toBe(false);
    if (isParseSuccess(result)) return;
    expect(result.error.code).toBe('parser-timeout');
  });
});

describe('uartPlugin', () => {
  it('katalog kaydının pluginId değeriyle aynı id ve interfaces-framing kategorisini taşır', () => {
    expect(uartPlugin.id).toBe('uart');
    expect(uartPlugin.category).toBe('interfaces-framing');
    expect(uartPlugin.documentation?.layer).toBe('physical');
  });

  it('her örnek çerçeve geçerli çözülür', () => {
    for (const example of uartPlugin.exampleFrames) {
      const result = parseUart(example.bytes);
      expect(isParseSuccess(result), `örnek çözülemedi: ${example.id}`).toBe(true);
    }
  });
});
