import { describe, expect, it } from 'vitest';

import { isParseSuccess } from '@/protocol-core/types';
import { parseRs232, rs232Parser, rs232Plugin } from './rs232';
import type { Rs232FrameMetadata } from './rs232';

function exampleBytes(id: string): Uint8Array {
  const example = rs232Plugin.exampleFrames.find((frame) => frame.id === id);
  if (example === undefined) throw new Error(`örnek çerçeve bulunamadı: ${id}`);
  return example.bytes;
}

describe('parseRs232 — spec örneği (9600 8N1, 0x41)', () => {
  /**
   * Spec özeti (`01-fiziksel-arayuzler.md:109`) hattı `0 1 0 0 0 0 0 1 0 1`
   * veriyor; mark/space eşlemesi aynı bölümün Mark/Space kuralından
   * (`:101`, logic 1 → Mark → negatif hat) bağımsız olarak türetiliyor.
   */
  it('UART hattını ve RS-232 mark/space karşılığını yan yana basar', () => {
    const result = parseRs232(exampleBytes('spec-character'));
    if (!isParseSuccess(result)) throw new Error('beklenmeyen ParseFailure');

    expect(result.frame.fields).toHaveLength(1);
    expect(result.frame.fields[0]?.physicalValue).toBe("0x41 'A' · 0 10000010 1 · SMSSSSSMSM");
  });

  it('mark/space dizisini metadata’ya da yazar', () => {
    const result = parseRs232(exampleBytes('spec-character'));
    if (!isParseSuccess(result)) throw new Error('beklenmeyen ParseFailure');

    const metadata = result.frame.rawFrame.metadata as Rs232FrameMetadata;
    expect(metadata.markSpaceLines).toEqual(['SMSSSSSMSM']);
    expect(metadata.characterCount).toBe(1);
    expect(metadata.bitsPerCharacter).toBe(10);
    expect(metadata.totalBitTimes).toBe(10);
    expect(metadata.configLabel).toBe('8N1');
  });

  /** Start biti daima Space, Stop biti daima Mark — polarite kuralının değişmezi. */
  it('her karakter Space ile başlar, Mark ile biter', () => {
    const result = parseRs232(exampleBytes('two-characters'));
    if (!isParseSuccess(result)) throw new Error('beklenmeyen ParseFailure');

    const metadata = result.frame.rawFrame.metadata as Rs232FrameMetadata;
    expect(metadata.markSpaceLines).toEqual(['SSSSMSSMSM', 'SMSSMSMMSM']);
    for (const line of metadata.markSpaceLines) {
      expect(line.startsWith('S')).toBe(true);
      expect(line.endsWith('M')).toBe(true);
    }
  });
});

describe('parseRs232 — hata yolları', () => {
  it('boş arabellek kurtarılabilir hata verir', () => {
    const result = parseRs232(new Uint8Array(0));
    expect(isParseSuccess(result)).toBe(false);
    if (isParseSuccess(result)) return;
    expect(result.error.code).toBe('truncated-frame');
    expect(result.error.message).toBe('protocol.rs232.error.emptyFrame');
  });

  it('iptal edilmiş signal ile çözümleme yapılmaz', () => {
    const controller = new AbortController();
    controller.abort();
    const result = rs232Parser.parse(Uint8Array.from([0x41]), { signal: controller.signal });
    expect(isParseSuccess(result)).toBe(false);
    if (isParseSuccess(result)) return;
    expect(result.error.code).toBe('parser-timeout');
  });
});

describe('rs232Plugin', () => {
  it('katalog kaydının pluginId değeriyle aynı id ve interfaces-framing kategorisini taşır', () => {
    expect(rs232Plugin.id).toBe('rs-232');
    expect(rs232Plugin.category).toBe('interfaces-framing');
    expect(rs232Plugin.documentation?.layer).toBe('physical');
  });

  it('her örnek çerçeve geçerli çözülür', () => {
    for (const example of rs232Plugin.exampleFrames) {
      const result = parseRs232(example.bytes);
      expect(isParseSuccess(result), `örnek çözülemedi: ${example.id}`).toBe(true);
    }
  });

  /** UART sayfasının satır sonu ayrımı buraya TAŞINMADI — elektriksel katman odaklı kalır. */
  it('CRLF ile biten yakalamada satır sonu alanı üretmez', () => {
    const result = parseRs232(Uint8Array.from([0x41, 0x0d, 0x0a]));
    if (!isParseSuccess(result)) throw new Error('beklenmeyen ParseFailure');
    expect(result.frame.fields).toHaveLength(3);
    expect(result.frame.fields.some((field) => field.id === 'lineEnding')).toBe(false);
  });
});
