import { describe, expect, it } from 'vitest';

import { isParseSuccess } from '@/protocol-core/types';
import { parseRs485, rs485Parser, rs485Plugin } from './rs485';
import type { Rs485FrameMetadata } from './rs485';

function exampleBytes(id: string): Uint8Array {
  const example = rs485Plugin.exampleFrames.find((frame) => frame.id === id);
  if (example === undefined) throw new Error(`örnek çerçeve bulunamadı: ${id}`);
  return example.bytes;
}

describe('parseRs485 — Modbus RTU çerçevesi taşıyan DE penceresi (spec örneği)', () => {
  it('her bayt bir karakter alanına açılır, içerik YORUMLANMAZ', () => {
    const result = parseRs485(exampleBytes('modbus-rtu-frame'));
    if (!isParseSuccess(result)) throw new Error('beklenmeyen ParseFailure');

    expect(result.frame.valid).toBe(true);
    expect(result.consumedBytes).toBe(8);
    expect(result.frame.fields).toHaveLength(8);

    // Alan adları jenerik: RS-485 ≠ Modbus, adres/fonksiyon/CRC yorumu üst katmanın.
    expect(result.frame.fields.map((field) => field.name)).toEqual([
      'Character 1',
      'Character 2',
      'Character 3',
      'Character 4',
      'Character 5',
      'Character 6',
      'Character 7',
      'Character 8',
    ]);
    expect(result.frame.fields[0]?.rawValue).toBe(0x01);
    expect(result.frame.fields[0]?.physicalValue).toBe('0x01 · 0 10000000 1');
    expect(result.frame.fields[7]?.physicalValue).toBe('0x0B · 0 11010000 1');
  });

  it('DE penceresini bit-süresi cinsinden verir (8 karakter × 10 bit)', () => {
    const result = parseRs485(exampleBytes('modbus-rtu-frame'));
    if (!isParseSuccess(result)) throw new Error('beklenmeyen ParseFailure');

    const metadata = result.frame.rawFrame.metadata as Rs485FrameMetadata;
    expect(metadata.characterCount).toBe(8);
    expect(metadata.bitsPerCharacter).toBe(10);
    expect(metadata.totalBitTimes).toBe(80);
    expect(metadata.configLabel).toBe('8N1');
    expect(metadata.echoSuspected).toBe(false);
    expect(metadata.summaryKey).toBe('protocol.rs485.summary.transmission');
    expect(result.frame.warnings).toEqual([]);
  });
});

describe('parseRs485 — half-duplex echo şüphesi', () => {
  it('iki yarı birebir aynıysa uyarı basar ve ikinci yarıyı Echo alanlarına ayırır', () => {
    const result = parseRs485(exampleBytes('half-duplex-echo'));
    if (!isParseSuccess(result)) throw new Error('beklenmeyen ParseFailure');

    expect(result.frame.fields).toHaveLength(16);
    expect(result.frame.fields[0]?.name).toBe('TX · Character 1');
    expect(result.frame.fields[8]?.id).toBe('echochar0');
    expect(result.frame.fields[8]?.name).toBe('Echo · Character 1');
    expect(result.frame.fields[8]?.offset).toBe(8);

    expect(result.frame.warnings).toHaveLength(1);
    expect(result.frame.warnings[0]?.code).toBe('echo-suspected');
    expect(result.frame.warnings[0]?.message).toBe('protocol.rs485.warning.echoSuspected');
    expect(result.frame.warnings[0]?.offset).toBe(8);

    // Uyarı hata DEĞİL: çerçeve geçerli kalır, alanlar eksiksiz gösterilir.
    expect(result.frame.valid).toBe(true);
    expect(result.frame.errors).toEqual([]);
  });

  it('DE penceresi yalnız TX yarısını sayar, echo yarısını değil', () => {
    const result = parseRs485(exampleBytes('half-duplex-echo'));
    if (!isParseSuccess(result)) throw new Error('beklenmeyen ParseFailure');

    const metadata = result.frame.rawFrame.metadata as Rs485FrameMetadata;
    expect(metadata.characterCount).toBe(16);
    expect(metadata.echoSuspected).toBe(true);
    expect(metadata.totalBitTimes).toBe(80);
    expect(metadata.summaryKey).toBe('protocol.rs485.summary.echo');
    expect(metadata.summaryParams['characters']).toBe('8');
  });

  it('tek uzunluktaki yakalamada echo hiç denenmez', () => {
    const result = parseRs485(Uint8Array.from([0x01, 0x02, 0x01]));
    if (!isParseSuccess(result)) throw new Error('beklenmeyen ParseFailure');
    expect((result.frame.rawFrame.metadata as Rs485FrameMetadata).echoSuspected).toBe(false);
  });

  /** Yarısı 2 bayttan kısa dizilerde tesadüf oranı yüksek — eşik bilerek kondu. */
  it('iki baytlık tekrar (0x01 0x01) echo sayılmaz', () => {
    const result = parseRs485(Uint8Array.from([0x01, 0x01]));
    if (!isParseSuccess(result)) throw new Error('beklenmeyen ParseFailure');
    expect((result.frame.rawFrame.metadata as Rs485FrameMetadata).echoSuspected).toBe(false);
    expect(result.frame.warnings).toEqual([]);
  });

  it('dört baytlık gerçek tekrar echo sayılır', () => {
    const result = parseRs485(Uint8Array.from([0x01, 0x02, 0x01, 0x02]));
    if (!isParseSuccess(result)) throw new Error('beklenmeyen ParseFailure');
    expect((result.frame.rawFrame.metadata as Rs485FrameMetadata).echoSuspected).toBe(true);
  });

  it('son bayt farklıysa echo sayılmaz (kısmi eşleşme yeterli değil)', () => {
    const result = parseRs485(Uint8Array.from([0x01, 0x02, 0x01, 0x03]));
    if (!isParseSuccess(result)) throw new Error('beklenmeyen ParseFailure');
    expect((result.frame.rawFrame.metadata as Rs485FrameMetadata).echoSuspected).toBe(false);
  });
});

describe('parseRs485 — hata yolları', () => {
  it('boş arabellek kurtarılabilir hata verir', () => {
    const result = parseRs485(new Uint8Array(0));
    expect(isParseSuccess(result)).toBe(false);
    if (isParseSuccess(result)) return;
    expect(result.error.code).toBe('truncated-frame');
    expect(result.error.message).toBe('protocol.rs485.error.emptyFrame');
    expect(result.recoverable).toBe(true);
  });

  it('iptal edilmiş signal ile çözümleme yapılmaz', () => {
    const controller = new AbortController();
    controller.abort();
    const result = rs485Parser.parse(Uint8Array.from([0x41]), { signal: controller.signal });
    expect(isParseSuccess(result)).toBe(false);
    if (isParseSuccess(result)) return;
    expect(result.error.code).toBe('parser-timeout');
  });
});

describe('rs485Plugin', () => {
  it('katalog kaydının pluginId değeriyle aynı id ve interfaces-framing kategorisini taşır', () => {
    expect(rs485Plugin.id).toBe('rs-485');
    expect(rs485Plugin.category).toBe('interfaces-framing');
    expect(rs485Plugin.documentation?.layer).toBe('physical');
  });

  it('her örnek çerçeve geçerli çözülür', () => {
    for (const example of rs485Plugin.exampleFrames) {
      const result = parseRs485(example.bytes);
      expect(isParseSuccess(result), `örnek çözülemedi: ${example.id}`).toBe(true);
    }
  });

  it('boş olmayan her arabelleği kabul eder (elektriksel katmanın bayt imzası yok)', () => {
    expect(rs485Parser.canParse(Uint8Array.from([0x00]))).toBe(true);
    expect(rs485Parser.canParse(new Uint8Array(0))).toBe(false);
  });
});
