import { describe, expect, it } from 'vitest';

import {
  buildCanClassicFrame,
  can20aParser,
  can20aPlugin,
  can20bParser,
  can20bPlugin,
  parseCanClassic,
} from './canClassic';
import { CAN_CLASSIC_FRAME_LENGTH, CAN_HEADER_LENGTH } from './canFrame';
import type {
  ParseFailure,
  ParseResult,
  ParseSuccess,
  ParsedField,
  ParsedFrame,
} from '@/protocol-core/types';

function expectSuccess(result: ParseResult): ParseSuccess {
  if (!result.success) {
    throw new Error(`expected success, got error "${result.error.code}"`);
  }
  return result;
}

function expectFailure(result: ParseResult): ParseFailure {
  if (result.success) {
    throw new Error('expected failure, got a parsed frame');
  }
  return result;
}

function fieldById(frame: ParsedFrame, id: string): ParsedField {
  const found = frame.fields.find((field) => field.id === id);
  if (found === undefined) {
    throw new Error(`field "${id}" not found; got ${frame.fields.map((f) => f.id).join(', ')}`);
  }
  return found;
}

function warningCodes(frame: ParsedFrame): string[] {
  return frame.warnings.map((warning) => warning.code);
}

describe('buildCanClassicFrame', () => {
  it('can_id alanını LITTLE-ENDIAN yazar', () => {
    // Big-endian yazılsaydı 0x18F00401 çerçevesi 0x0104F098 olarak çözülürdü.
    const frame = buildCanClassicFrame(0x18f00401, [], { extended: true });
    expect(Array.from(frame.slice(0, 4))).toEqual([0x01, 0x04, 0xf0, 0x98]);
  });

  it('sabit 16 baytlık struct üretir ve DLC’yi payload uzunluğuna yazar', () => {
    const frame = buildCanClassicFrame(0x321, [0x10, 0x27]);
    expect(frame).toHaveLength(CAN_CLASSIC_FRAME_LENGTH);
    expect(frame[4]).toBe(2);
    expect(Array.from(frame.slice(CAN_HEADER_LENGTH, CAN_HEADER_LENGTH + 2))).toEqual([
      0x10, 0x27,
    ]);
  });

  it('RTR bayrağını can_id üst bitine koyar', () => {
    const frame = buildCanClassicFrame(0x123, [], { remote: true });
    expect(frame[3]).toBe(0x40);
  });
});

describe('parseCanClassic — base çerçeve (spec §3.4 DLC örneği)', () => {
  const frame = buildCanClassicFrame(0x321, [0x10, 0x27, 0x00, 0x64, 0x12, 0x34, 0xff, 0x00]);

  it('tüm çerçeveyi tüketir ve protokol kimliğini base kayda bağlar', () => {
    const result = expectSuccess(parseCanClassic(frame));
    expect(result.consumedBytes).toBe(CAN_CLASSIC_FRAME_LENGTH);
    expect(result.frame.protocol).toBe('can-2-0a');
    expect(result.frame.valid).toBe(true);
  });

  it('identifier, DLC ve veri alanlarını çözer', () => {
    const { frame: parsed } = expectSuccess(parseCanClassic(frame));
    expect(fieldById(parsed, 'can-id').rawValue).toBe(0x321);
    expect(fieldById(parsed, 'dlc').rawValue).toBe(8);
    expect(fieldById(parsed, 'data').length).toBe(8);
    expect(Array.from(fieldById(parsed, 'data').rawBytes)).toEqual([
      0x10, 0x27, 0x00, 0x64, 0x12, 0x34, 0xff, 0x00,
    ]);
  });

  it('spec §17.2’nin yaklaşık çerçeve bit sayısını metadata’ya koyar', () => {
    const { frame: parsed } = expectSuccess(parseCanClassic(frame));
    const metadata = parsed.rawFrame.metadata;
    // 47 + 8 × 8 = 111 (standard çerçeve).
    expect(metadata?.approximateFrameBits).toBe(111);
    expect(metadata?.extended).toBe(false);
  });
});

describe('parseCanClassic — çerçeve sınırları', () => {
  it('başlıktan kısa girdide truncated-frame döner ve veri bekler', () => {
    const result = expectFailure(parseCanClassic(new Uint8Array(4)));
    expect(result.error.code).toBe('truncated-frame');
    expect(result.recoverable).toBe(true);
    expect(result.consumedBytes).toBe(0);
  });

  it('struct boyunu aşan girdide frame-too-long döner', () => {
    const result = expectFailure(parseCanClassic(new Uint8Array(CAN_CLASSIC_FRAME_LENGTH + 1)));
    expect(result.error.code).toBe('frame-too-long');
    expect(result.recoverable).toBe(false);
  });

  it('iptal edilmiş signal’da parser-timeout döner, fırlatmaz', () => {
    const controller = new AbortController();
    controller.abort();
    const frame = buildCanClassicFrame(0x123, [0x01]);
    const result = expectFailure(can20aParser.parse(frame, { signal: controller.signal }));
    expect(result.error.code).toBe('parser-timeout');
  });
});

describe('can20aParser / can20bParser — biçim beklentisi', () => {
  const baseFrame = buildCanClassicFrame(0x123, [0xaa, 0xbb]);
  const extendedFrame = buildCanClassicFrame(0x18f00401, [0x01], { extended: true });

  it('canParse yalnız KENDİ biçimini kabul eder', () => {
    expect(can20aParser.canParse(baseFrame)).toBe(true);
    expect(can20aParser.canParse(extendedFrame)).toBe(false);
    expect(can20bParser.canParse(extendedFrame)).toBe(true);
    expect(can20bParser.canParse(baseFrame)).toBe(false);
  });

  it('canParse aralık dışı uzunluğu eler', () => {
    expect(can20aParser.canParse(new Uint8Array(4))).toBe(false);
    expect(can20aParser.canParse(new Uint8Array(CAN_CLASSIC_FRAME_LENGTH + 1))).toBe(false);
  });

  it('yanlış biçim HATA değil UYARI üretir — çerçeve yine çözülür', () => {
    const onBase = expectSuccess(can20aParser.parse(extendedFrame));
    expect(warningCodes(onBase.frame)).toContain(
      'protocol.can.frame.warning.extendedOnBasePage',
    );
    expect(onBase.frame.valid).toBe(true);
    expect(fieldById(onBase.frame, 'can-id').rawValue).toBe(0x18f00401);

    const onExtended = expectSuccess(can20bParser.parse(baseFrame));
    expect(warningCodes(onExtended.frame)).toContain(
      'protocol.can.frame.warning.baseOnExtendedPage',
    );
  });

  it('yalnız 2.0B sayfası üst katman adaylarını hatırlatır', () => {
    const onExtended = expectSuccess(can20bParser.parse(extendedFrame));
    expect(warningCodes(onExtended.frame)).toContain(
      'protocol.can.frame.warning.higherLayerCandidates',
    );
    const onBase = expectSuccess(can20aParser.parse(extendedFrame));
    expect(warningCodes(onBase.frame)).not.toContain(
      'protocol.can.frame.warning.higherLayerCandidates',
    );
  });

  it('iki parser AYNI alan kümesini üretir — tel biçimi aynıdır', () => {
    const viaBase = expectSuccess(can20aParser.parse(baseFrame));
    const viaExtended = expectSuccess(can20bParser.parse(baseFrame));
    expect(viaBase.frame.fields.map((field) => field.id)).toEqual(
      viaExtended.frame.fields.map((field) => field.id),
    );
  });
});

describe('can20aPlugin / can20bPlugin', () => {
  const plugins = [can20aPlugin, can20bPlugin];

  it('katalogdaki kimlik, kategori ve parser bağını taşır', () => {
    expect(can20aPlugin.id).toBe('can-2-0a');
    expect(can20bPlugin.id).toBe('can-2-0b');
    for (const plugin of plugins) {
      expect(plugin.category, plugin.id).toBe('automotive');
      expect(plugin.parser?.protocolId, plugin.id).toBe(plugin.id);
    }
  });

  it('her örnek çerçeve çözülür ve expectedValid ile eşleşir', () => {
    for (const plugin of plugins) {
      const parser = plugin.parser;
      if (parser === undefined) throw new Error(`${plugin.id} has no parser`);
      for (const example of plugin.exampleFrames) {
        const result = parser.parse(example.bytes);
        if (!result.success) {
          throw new Error(`example "${example.id}" failed: ${result.error.code}`);
        }
        expect(result.frame.valid, `example "${example.id}"`).toBe(example.expectedValid ?? true);
      }
    }
  });

  it('her örnek adı/açıklaması protocol.can.classic.example. önekli çeviri anahtarıdır', () => {
    for (const plugin of plugins) {
      for (const example of plugin.exampleFrames) {
        expect(example.name.startsWith('protocol.can.classic.example.'), example.id).toBe(true);
        expect(
          example.description?.startsWith('protocol.can.classic.example.'),
          example.id,
        ).toBe(true);
      }
    }
  });

  it('2.0B örneği spec §43 identifier’ını taşır — iki sayfanın tutarlılık çıpası', () => {
    const example = can20bPlugin.exampleFrames.find(
      (candidate) => candidate.id === 'extended-j1939-identifier',
    );
    expect(example).toBeDefined();
    if (example === undefined) return;
    const result = expectSuccess(can20bParser.parse(example.bytes));
    expect(fieldById(result.frame, 'can-id').rawValue).toBe(0x18f00401);
  });

  it('remote örneği veri alanı üretmez', () => {
    const example = can20aPlugin.exampleFrames.find(
      (candidate) => candidate.id === 'base-remote-frame',
    );
    expect(example).toBeDefined();
    if (example === undefined) return;
    const result = expectSuccess(can20aParser.parse(example.bytes));
    expect(fieldById(result.frame, 'rtr').physicalValue).toBe('Remote Frame');
    expect(result.frame.fields.some((field) => field.id === 'data')).toBe(false);
  });
});
