import { describe, expect, it } from 'vitest';

import {
  ERROR_IMAGE_TRUNCATED,
  WARN_DETAIL_LIMIT,
  WARN_EXTENDED_CYCLIC_IS_VER2,
  WARN_LINK_LAYER_NOT_PUBLIC,
  WARN_POINT_MEANING_FROM_DEVICE_PROFILE,
  WARN_TRAILING_BYTES,
  WARN_WORD_ORDER_ASSUMPTION,
  ccLinkParser,
  ccLinkPlugin,
  parseCcLink,
} from './ccLink';
import type {
  ParseFailure,
  ParseResult,
  ParseSuccess,
  ParsedField,
  ParsedFrame,
} from '@/protocol-core/types';

function expectSuccess(result: ParseResult): ParseSuccess {
  if (!result.success) {
    throw new Error(`expected success, got failure ${result.error.code}: ${result.error.message}`);
  }
  return result;
}

function expectFailure(result: ParseResult): ParseFailure {
  if (result.success) throw new Error('expected failure, got success');
  return result;
}

function fieldById(frame: ParsedFrame, id: string): ParsedField {
  const found = frame.fields.find((field) => field.id === id);
  if (found === undefined) {
    throw new Error(`field "${id}" not found; got ${frame.fields.map((f) => f.id).join(', ')}`);
  }
  return found;
}

function hasField(frame: ParsedFrame, id: string): boolean {
  return frame.fields.some((field) => field.id === id);
}

function warningCodes(frame: ParsedFrame): string[] {
  return frame.warnings.map((warning) => warning.code);
}

function exampleBytes(id: string): Uint8Array {
  const example = ccLinkPlugin.exampleFrames.find((candidate) => candidate.id === id);
  if (example === undefined) throw new Error(`example "${id}" not found`);
  return example.bytes;
}

function decodeExample(id: string, options?: Record<string, unknown>): ParsedFrame {
  return expectSuccess(parseCcLink(exampleBytes(id), options)).frame;
}

/** İstenen boyda, indeksten türetilmiş baytlarla dolu bir görüntü. */
function image(byteCount: number): Uint8Array {
  return Uint8Array.from(new Array<number>(byteCount).fill(0).map((_, index) => index & 0xff));
}

describe('ccLinkParser', () => {
  it('exposes the catalog protocol id and declares its three decode options', () => {
    expect(ccLinkParser.protocolId).toBe('cc-link');
    expect(ccLinkPlugin.id).toBe('cc-link');
    expect(ccLinkPlugin.category).toBe('industrial-automation');
    expect(ccLinkPlugin.decodeOptions?.map((option) => option.id)).toEqual([
      'direction',
      'occupiedStations',
      'extendedCyclic',
    ]);
  });

  it('only pre-accepts word-aligned inputs long enough for the smallest configuration', () => {
    expect(ccLinkParser.canParse(image(12))).toBe(true);
    expect(ccLinkParser.canParse(image(11))).toBe(false);
    expect(ccLinkParser.canParse(image(10))).toBe(false);
  });
});

describe('CC-Link cyclic link-device image', () => {
  it('always says out loud that the RS-485 telegram is NOT what is being decoded', () => {
    const parsed = decodeExample('remote-device-typical');
    expect(warningCodes(parsed)).toContain(WARN_LINK_LAYER_NOT_PUBLIC);
    expect(warningCodes(parsed)).toContain(WARN_WORD_ORDER_ASSUMPTION);
    expect(warningCodes(parsed)).toContain(WARN_POINT_MEANING_FROM_DEVICE_PROFILE);
  });

  it('names RX bit points in hexadecimal and reads registers little-endian', () => {
    const parsed = decodeExample('remote-device-typical');

    expect(fieldById(parsed, 'rx-word-0').name).toBe('RX000F-RX0000');
    expect(fieldById(parsed, 'rx-word-0').physicalValue).toBe('RX0000 · RX0002');
    expect(fieldById(parsed, 'rx-word-2').physicalValue).toBe('RX0011');
    expect(fieldById(parsed, 'rwr-0').rawValue).toBe(250);
    expect(fieldById(parsed, 'rwr-1').physicalValue).toBe('0x1234');
    expect(fieldById(parsed, 'rwr-3').rawValue).toBe(0xffff);
    expect(parsed.valid).toBe(true);
  });

  it('prints an em dash for a word with no point set', () => {
    const parsed = decodeExample('remote-device-all-off');
    expect(fieldById(parsed, 'rx-word-0').physicalValue).toBe('—');
    expect(fieldById(parsed, 'rwr-0').rawValue).toBe(0);
  });

  it('lists all sixteen point names when every bit is set', () => {
    const parsed = decodeExample('remote-device-all-on');
    // Alan id'si KELİME İNDEKSİ değil BAYT OFSETİ taşır: ikinci kelime ofset 2.
    const names = String(fieldById(parsed, 'rx-word-2').physicalValue ?? '');
    expect(names.split(' · ')).toHaveLength(16);
    expect(names).toContain('RX0010');
    expect(names).toContain('RX001F');
  });

  it('renames the areas RY/RWw when the direction option flips', () => {
    const parsed = decodeExample('remote-device-typical', { direction: 'master-to-slave' });
    expect(hasField(parsed, 'ry-word-0')).toBe(true);
    expect(hasField(parsed, 'rx-word-0')).toBe(false);
    expect(fieldById(parsed, 'rww-1').physicalValue).toBe('0x1234');
    expect(fieldById(parsed, 'ry-word-0').physicalValue).toBe('RY0000 · RY0002');
  });
});

describe('CC-Link link point table', () => {
  /**
   * Pro-face'in bağlanabilir birim formüllerinden birebir; bir satırı
   * (1 istasyon × ×8 → 128 bit / 32 yazmaç) Mitsubishi EMU4-VA2 kılavuzuyla
   * çapraz teyitli. Tablo bozulursa bu test düşer.
   */
  const CASES: ReadonlyArray<{
    occupied: number;
    cyclic: string;
    bitPoints: number;
    wordPoints: number;
  }> = [
    { occupied: 1, cyclic: 'x1', bitPoints: 32, wordPoints: 4 },
    { occupied: 1, cyclic: 'x2', bitPoints: 32, wordPoints: 8 },
    { occupied: 1, cyclic: 'x4', bitPoints: 64, wordPoints: 16 },
    { occupied: 1, cyclic: 'x8', bitPoints: 128, wordPoints: 32 },
    { occupied: 2, cyclic: 'x1', bitPoints: 64, wordPoints: 8 },
    { occupied: 2, cyclic: 'x2', bitPoints: 96, wordPoints: 16 },
    { occupied: 2, cyclic: 'x4', bitPoints: 192, wordPoints: 32 },
    { occupied: 2, cyclic: 'x8', bitPoints: 384, wordPoints: 64 },
    { occupied: 3, cyclic: 'x1', bitPoints: 96, wordPoints: 12 },
    { occupied: 3, cyclic: 'x2', bitPoints: 160, wordPoints: 24 },
    { occupied: 3, cyclic: 'x4', bitPoints: 320, wordPoints: 48 },
    { occupied: 3, cyclic: 'x8', bitPoints: 640, wordPoints: 96 },
    { occupied: 4, cyclic: 'x1', bitPoints: 128, wordPoints: 16 },
    { occupied: 4, cyclic: 'x2', bitPoints: 224, wordPoints: 32 },
    { occupied: 4, cyclic: 'x4', bitPoints: 448, wordPoints: 64 },
    { occupied: 4, cyclic: 'x8', bitPoints: 896, wordPoints: 128 },
  ];

  it('sizes the image exactly as the published point table says', () => {
    for (const testCase of CASES) {
      const expectedBytes = testCase.bitPoints / 8 + testCase.wordPoints * 2;
      const label = `${testCase.occupied}×${testCase.cyclic}`;

      const exact = expectSuccess(
        parseCcLink(image(expectedBytes), {
          occupiedStations: testCase.occupied,
          extendedCyclic: testCase.cyclic,
        }),
      ).frame;
      expect(exact.errors, label).toEqual([]);
      expect(warningCodes(exact), label).not.toContain(WARN_TRAILING_BYTES);

      const short = expectSuccess(
        parseCcLink(image(expectedBytes - 2), {
          occupiedStations: testCase.occupied,
          extendedCyclic: testCase.cyclic,
        }),
      ).frame;
      expect(short.errors[0]?.message, label).toBe(ERROR_IMAGE_TRUNCATED);
      expect(short.errors[0]?.details?.['requiredBytes'], label).toBe(expectedBytes);
    }
  });

  it('flags the Ver.2-only settings and keeps ×1 silent', () => {
    const ver1 = expectSuccess(parseCcLink(image(12), { extendedCyclic: 'x1' })).frame;
    expect(warningCodes(ver1)).not.toContain(WARN_EXTENDED_CYCLIC_IS_VER2);
    const ver2 = expectSuccess(parseCcLink(image(4 + 16), { extendedCyclic: 'x2' })).frame;
    expect(warningCodes(ver2)).toContain(WARN_EXTENDED_CYCLIC_IS_VER2);
  });

  it('clamps out-of-range option values to the published bounds instead of inventing rows', () => {
    // 0 ve 9 tabloda yok; sınırlara çekilir, uydurulmuş bir satır üretilmez.
    const low = expectSuccess(parseCcLink(image(12), { occupiedStations: 0 })).frame;
    expect(low.errors).toEqual([]);
    const high = expectSuccess(
      parseCcLink(image(16 + 32), { occupiedStations: 9, extendedCyclic: 'x1' }),
    ).frame;
    // 9 → 4 istasyona kırpılır: 128 bit (16 bayt) + 16 yazmaç (32 bayt) = 48.
    expect(high.errors).toEqual([]);
    const unknownCyclic = expectSuccess(parseCcLink(image(12), { extendedCyclic: 'x16' })).frame;
    expect(unknownCyclic.errors).toEqual([]);
  });

  it('caps detail at 32 words per area and shows the rest as one raw block', () => {
    // 4 istasyon × ×8: 56 bit kelimesi + 128 yazmaç.
    const bytes = 896 / 8 + 128 * 2;
    const parsed = expectSuccess(
      parseCcLink(image(bytes), { occupiedStations: 4, extendedCyclic: 'x8' }),
    ).frame;
    expect(warningCodes(parsed)).toContain(WARN_DETAIL_LIMIT);
    expect(hasField(parsed, 'rx-word-62')).toBe(true);
    expect(hasField(parsed, 'rx-word-64')).toBe(false);
    expect(hasField(parsed, 'rx-remainder-64')).toBe(true);
    expect(hasField(parsed, 'rwr-31')).toBe(true);
    expect(hasField(parsed, 'rwr-32')).toBe(false);
  });
});

describe('CC-Link failure and boundary paths', () => {
  it('raises a frame error, not an invented field, when the image is short', () => {
    const parsed = decodeExample('image-truncated');
    expect(parsed.valid).toBe(false);
    expect(parsed.errors[0]?.code).toBe('truncated-frame');
    expect(parsed.errors[0]?.message).toBe(ERROR_IMAGE_TRUNCATED);
    // Var olan baytlar yine de çözülür; eksikler UYDURULMAZ.
    expect(hasField(parsed, 'rx-word-0')).toBe(true);
    expect(hasField(parsed, 'rwr-3')).toBe(false);
  });

  it('shows trailing bytes raw and warns that the configuration may not match', () => {
    const parsed = decodeExample('image-trailing-bytes');
    expect(parsed.valid).toBe(true);
    expect(fieldById(parsed, 'trailing-12').length).toBe(4);
    expect(warningCodes(parsed)).toContain(WARN_TRAILING_BYTES);
  });

  it('fails outright on empty input', () => {
    const failure = expectFailure(parseCcLink(Uint8Array.from([])));
    expect(failure.error.code).toBe('truncated-frame');
    expect(failure.recoverable).toBe(true);
  });

  it('rejects an oversized input through the parse context', () => {
    const failure = expectFailure(ccLinkParser.parse(image(64), { maxFrameLength: 32 }));
    expect(failure.error.code).toBe('frame-too-long');
  });

  it('honours an aborted signal', () => {
    const controller = new AbortController();
    controller.abort();
    const failure = expectFailure(ccLinkParser.parse(image(12), { signal: controller.signal }));
    expect(failure.error.code).toBe('parser-timeout');
  });

  it('passes decode options through the parse context', () => {
    const result = expectSuccess(
      ccLinkParser.parse(image(12), { options: { direction: 'master-to-slave' } }),
    );
    expect(hasField(result.frame, 'ry-word-0')).toBe(true);
  });
});

describe('CC-Link example frames', () => {
  it('every example matches its declared validity under the default options', () => {
    for (const example of ccLinkPlugin.exampleFrames) {
      const result = parseCcLink(example.bytes);
      const parsed = expectSuccess(result).frame;
      expect(parsed.valid, `${example.id} validity`).toBe(example.expectedValid);
      expect(result.consumedBytes, example.id).toBe(example.bytes.length);
    }
  });

  it('has unique example ids', () => {
    const ids = ccLinkPlugin.exampleFrames.map((example) => example.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
