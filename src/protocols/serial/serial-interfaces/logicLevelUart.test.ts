import { describe, expect, it } from 'vitest';

import { isParseSuccess } from '@/protocol-core/types';
import { translations } from '@/translations/all';
import type { ProtocolPlugin } from '@/protocol-core/types';
import {
  cmosUartParser,
  cmosUartPlugin,
  parseCmosUart,
  parseTtlUart,
  ttlUartParser,
  ttlUartPlugin,
} from './logicLevelUart';
import type { LogicLevelUartFrameMetadata } from './logicLevelUart';

describe('TTL UART / CMOS UART — aynı çözümleyici, ayrı kimlik', () => {
  it('iki eklenti de katalog kaydının pluginId değeriyle aynı id taşır', () => {
    expect(ttlUartPlugin.id).toBe('ttl-uart');
    expect(cmosUartPlugin.id).toBe('cmos-uart');
    expect(ttlUartPlugin.category).toBe('interfaces-framing');
    expect(cmosUartPlugin.category).toBe('interfaces-framing');
  });

  /** Bayt akışında ikisini ayıran iz YOK — ayrım tamamen elektriksel. */
  it('aynı baytlar iki sayfada da aynı alanları üretir, yalnız protokol adı değişir', () => {
    const bytes = Uint8Array.from([0x4f, 0x4b]);
    const ttl = parseTtlUart(bytes);
    const cmos = parseCmosUart(bytes);
    if (!isParseSuccess(ttl) || !isParseSuccess(cmos)) throw new Error('beklenmeyen ParseFailure');

    expect(ttl.frame.protocol).toBe('ttl-uart');
    expect(cmos.frame.protocol).toBe('cmos-uart');
    expect(ttl.frame.fields.map((field) => field.physicalValue)).toEqual(
      cmos.frame.fields.map((field) => field.physicalValue),
    );
  });

  it('karakterleri hat görünümüne açar ve ASCII karşılığını metadata’ya yazar', () => {
    const result = parseTtlUart(Uint8Array.from([0x4f, 0x4b, 0x0d, 0x0a]));
    if (!isParseSuccess(result)) throw new Error('beklenmeyen ParseFailure');

    expect(result.frame.fields).toHaveLength(4);
    expect(result.frame.fields[0]?.physicalValue).toBe("0x4F 'O' · 0 11110010 1");

    const metadata = result.frame.rawFrame.metadata as LogicLevelUartFrameMetadata;
    expect(metadata.asciiText).toBe('OK..');
    expect(metadata.characterCount).toBe(4);
    expect(metadata.totalBitTimes).toBe(40);
    expect(metadata.summaryKey).toBe('protocol.ttlUart.summary.transmission');
  });

  /** UART sayfasının satır sonu eki BURAYA taşınmadı — CR/LF karakter olarak görünür. */
  it('CRLF ile biten yakalamada satır sonu alanı üretmez', () => {
    const result = parseCmosUart(Uint8Array.from([0x41, 0x0d, 0x0a]));
    if (!isParseSuccess(result)) throw new Error('beklenmeyen ParseFailure');
    expect(result.frame.fields).toHaveLength(3);
    expect(result.frame.fields.some((field) => field.id === 'lineEnding')).toBe(false);
  });
});

describe('TTL UART / CMOS UART — hata yolları', () => {
  it('boş arabellek her iki sayfada da kendi çeviri anahtarıyla hata verir', () => {
    const ttl = parseTtlUart(new Uint8Array(0));
    const cmos = parseCmosUart(new Uint8Array(0));
    if (isParseSuccess(ttl) || isParseSuccess(cmos)) throw new Error('hata bekleniyordu');
    expect(ttl.error.message).toBe('protocol.ttlUart.error.emptyFrame');
    expect(cmos.error.message).toBe('protocol.cmosUart.error.emptyFrame');
  });

  it('iptal edilmiş signal ile çözümleme yapılmaz', () => {
    const controller = new AbortController();
    controller.abort();
    for (const parser of [ttlUartParser, cmosUartParser]) {
      const result = parser.parse(Uint8Array.from([0x41]), { signal: controller.signal });
      expect(isParseSuccess(result)).toBe(false);
      if (isParseSuccess(result)) continue;
      expect(result.error.code).toBe('parser-timeout');
    }
  });
});

/**
 * Dalga 11c'nin dersi: `ExampleFrame.name` ve `documentation.summary` düz
 * `string` olduğu için eksik çeviri anahtarını ne tsc ne de çözümleme testleri
 * yakalar — UI ham anahtarı basar. Bu dosyada anahtarlar ŞABLONLA üretildiği
 * için (`${prefix}.example...`) risk daha da yüksek; bekçi buraya kondu.
 */
describe('çeviri anahtarları — tr ve en sözlüklerinde karşılığı var', () => {
  const plugins: ProtocolPlugin[] = [ttlUartPlugin, cmosUartPlugin];

  it('documentation.summary ve her örnek çerçevenin ad/açıklaması çevrilidir', () => {
    const keys = plugins.flatMap((plugin) => [
      plugin.documentation?.summary ?? '',
      ...plugin.exampleFrames.flatMap((example) => [example.name, example.description ?? '']),
    ]);

    for (const key of keys.filter((key) => key.length > 0)) {
      expect(Object.hasOwn(translations.tr, key), `tr.ts eksik: ${key}`).toBe(true);
      expect(Object.hasOwn(translations.en, key), `en.ts eksik: ${key}`).toBe(true);
    }
  });

  it('summary ve hata anahtarları da çevrilidir', () => {
    for (const prefix of ['protocol.ttlUart', 'protocol.cmosUart']) {
      for (const suffix of ['error.emptyFrame', 'error.aborted', 'summary.transmission']) {
        const key = `${prefix}.${suffix}`;
        expect(Object.hasOwn(translations.tr, key), `tr.ts eksik: ${key}`).toBe(true);
        expect(Object.hasOwn(translations.en, key), `en.ts eksik: ${key}`).toBe(true);
      }
    }
  });
});
