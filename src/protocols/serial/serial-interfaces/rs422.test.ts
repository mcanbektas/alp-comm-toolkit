import { describe, expect, it } from 'vitest';

import { isParseSuccess } from '@/protocol-core/types';
import { parseRs422, rs422Parser, rs422Plugin } from './rs422';
import type { Rs422FrameMetadata } from './rs422';

function exampleBytes(id: string): Uint8Array {
  const example = rs422Plugin.exampleFrames.find((frame) => frame.id === id);
  if (example === undefined) throw new Error(`örnek çerçeve bulunamadı: ${id}`);
  return example.bytes;
}

describe('parseRs422 — tek karakter (spec bit görünümü örneği)', () => {
  it("0x41 karakterini 0 10000010 1 hattına açar ve ASCII karşılığını gösterir", () => {
    const result = parseRs422(exampleBytes('single-character'));
    if (!isParseSuccess(result)) throw new Error('beklenmeyen ParseFailure');

    expect(result.frame.valid).toBe(true);
    expect(result.consumedBytes).toBe(1);
    expect(result.frame.fields).toHaveLength(1);
    expect(result.frame.fields[0]?.id).toBe('char0');
    expect(result.frame.fields[0]?.rawValue).toBe(0x41);
    expect(result.frame.fields[0]?.physicalValue).toBe("0x41 'A' · 0 10000010 1");
  });

  it('diferansiyel karşılık metadata alanında durur (alan tablosunu tekrar etmez)', () => {
    const result = parseRs422(exampleBytes('single-character'));
    if (!isParseSuccess(result)) throw new Error('beklenmeyen ParseFailure');

    const metadata = result.frame.rawFrame.metadata as Rs422FrameMetadata;
    expect(metadata.differentialLines).toEqual(['−+−−−−−+−+']);
    expect(metadata.bitsPerCharacter).toBe(10);
    expect(metadata.totalBitTimes).toBe(10);
    expect(metadata.configLabel).toBe('8N1');
    expect(metadata.summaryKey).toBe('protocol.rs422.summary.transmission');
  });
});

describe('parseRs422 — çok karakterli aktarım', () => {
  it('dört karakteri sırayla açar, kontrol baytlarında ASCII sütunu boş kalır', () => {
    const result = parseRs422(exampleBytes('multi-character'));
    if (!isParseSuccess(result)) throw new Error('beklenmeyen ParseFailure');

    expect(result.frame.fields).toHaveLength(4);
    expect(result.frame.fields[0]?.physicalValue).toBe("0x4F 'O' · 0 11110010 1");
    expect(result.frame.fields[1]?.physicalValue).toBe("0x4B 'K' · 0 11010010 1");
    expect(result.frame.fields[2]?.physicalValue).toBe('0x0D · 0 10110000 1');
    expect(result.frame.fields[3]?.physicalValue).toBe('0x0A · 0 01010000 1');

    const metadata = result.frame.rawFrame.metadata as Rs422FrameMetadata;
    expect(metadata.characterCount).toBe(4);
    expect(metadata.totalBitTimes).toBe(40);
    expect(metadata.differentialLines).toHaveLength(4);
  });

  it('alanlar tüm baytları kapsar, hiçbiri sessizce düşmez', () => {
    const result = parseRs422(exampleBytes('multi-character'));
    if (!isParseSuccess(result)) throw new Error('beklenmeyen ParseFailure');

    const covered = result.frame.fields.reduce((total, field) => total + field.length, 0);
    expect(covered).toBe(exampleBytes('multi-character').length);
  });
});

describe('parseRs422 — hata yolları', () => {
  it('boş arabellek kurtarılabilir hata verir', () => {
    const result = parseRs422(new Uint8Array(0));
    expect(isParseSuccess(result)).toBe(false);
    if (isParseSuccess(result)) return;
    expect(result.error.code).toBe('truncated-frame');
    expect(result.error.message).toBe('protocol.rs422.error.emptyFrame');
    expect(result.recoverable).toBe(true);
  });

  it('iptal edilmiş signal ile çözümleme yapılmaz', () => {
    const controller = new AbortController();
    controller.abort();
    const result = rs422Parser.parse(Uint8Array.from([0x41]), { signal: controller.signal });
    expect(isParseSuccess(result)).toBe(false);
    if (isParseSuccess(result)) return;
    expect(result.error.code).toBe('parser-timeout');
  });
});

describe('rs422Plugin', () => {
  it('katalog kaydının pluginId değeriyle aynı id ve interfaces-framing kategorisini taşır', () => {
    expect(rs422Plugin.id).toBe('rs-422');
    expect(rs422Plugin.category).toBe('interfaces-framing');
    expect(rs422Plugin.documentation?.layer).toBe('physical');
  });

  it('her örnek çerçeve geçerli çözülür', () => {
    for (const example of rs422Plugin.exampleFrames) {
      const result = parseRs422(example.bytes);
      expect(isParseSuccess(result), `örnek çözülemedi: ${example.id}`).toBe(true);
    }
  });

  /** RS-485'in echo şüphesi RS-422'ye TAŞINMADI: full-duplex'te sürücü kendi yayınını geri okumaz. */
  it('tekrar eden dizide uyarı basmaz', () => {
    const result = parseRs422(Uint8Array.from([0x01, 0x02, 0x01, 0x02]));
    if (!isParseSuccess(result)) throw new Error('beklenmeyen ParseFailure');
    expect(result.frame.warnings).toEqual([]);
  });
});
