import { describe, expect, it } from 'vitest';

import { buildCanClassicFrame } from '../../automotive/can/canClassic';
import { CAN_CLASSIC_FRAME_LENGTH } from '../../automotive/can/canFrame';
import { deviceNetParser, deviceNetPlugin, parseDeviceNet } from './devicenet';
import type { ParseFailure, ParseResult, ParseSuccess, ParsedField, ParsedFrame } from '@/protocol-core/types';

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

describe('parseDeviceNet — Group 1 (4-bit Message ID)', () => {
  it('CAN ID 0x145’i Group 1, Message ID 5, MAC ID 5 olarak çözer', () => {
    const frame = buildCanClassicFrame(0x145, [0x37, 0x12, 0xdc, 0x05]);
    const { frame: parsed } = expectSuccess(parseDeviceNet(frame));
    expect(fieldById(parsed, 'group').physicalValue).toBe('Group 1');
    expect(fieldById(parsed, 'message-id').rawValue).toBe(5);
    expect(fieldById(parsed, 'mac-id').rawValue).toBe(5);
    expect(fieldById(parsed, 'data').rawBytes).toEqual(new Uint8Array([0x37, 0x12, 0xdc, 0x05]));
  });
});

describe('parseDeviceNet — Group 2 (3-bit Message ID, farklı genişlik tuzağı)', () => {
  it('CAN ID 0x4CA’yı Group 2, Message ID 3, MAC ID 10 olarak çözer', () => {
    const frame = buildCanClassicFrame(0x4ca, [0x01]);
    const { frame: parsed } = expectSuccess(parseDeviceNet(frame));
    expect(fieldById(parsed, 'group').physicalValue).toBe('Group 2');
    // 4-bit genişlik yanlışlıkla uygulansaydı Message ID 3 DEĞİL farklı çıkardı.
    expect(fieldById(parsed, 'message-id').rawValue).toBe(3);
    expect(fieldById(parsed, 'mac-id').rawValue).toBe(10);
  });

  it('Group 1 ile Group 2 sınırındaki 0x400’ü doğru ayırt eder', () => {
    const group1Edge = expectSuccess(parseDeviceNet(buildCanClassicFrame(0x3ff, [0x00])));
    expect(fieldById(group1Edge.frame, 'group').physicalValue).toBe('Group 1');
    const group2Edge = expectSuccess(parseDeviceNet(buildCanClassicFrame(0x400, [0x00])));
    expect(fieldById(group2Edge.frame, 'group').physicalValue).toBe('Group 2');
  });
});

describe('parseDeviceNet — Group 3/4 (adlandırılmamış üst bölge)', () => {
  it('0x600 üstünü Group 3/4 olarak etiketler, Message ID/MAC ID’yi ham gösterir', () => {
    const frame = buildCanClassicFrame(0x6c1, [0xaa]);
    const { frame: parsed } = expectSuccess(parseDeviceNet(frame));
    expect(fieldById(parsed, 'group').physicalValue).toBe('Group 3/4');
    expect(fieldById(parsed, 'message-id').rawValue).toBe(3);
    expect(fieldById(parsed, 'mac-id').rawValue).toBe(1);
  });
});

describe('parseDeviceNet — payloadInterpretation kanalı', () => {
  it('varsayılan (raw) payload’ı ham bir Data alanı olarak gösterir', () => {
    const frame = buildCanClassicFrame(0x441, [0x0e, 0x02, 0x20, 0x01, 0x24, 0x01]);
    const { frame: parsed } = expectSuccess(parseDeviceNet(frame));
    expect(fieldById(parsed, 'data')).toBeDefined();
    expect(parsed.fields.some((f) => f.id === 'cip-service')).toBe(false);
  });

  it('cip-explicit seçilince AYNI payload’ı cipCore ile çözer', () => {
    const frame = buildCanClassicFrame(0x441, [0x0e, 0x02, 0x20, 0x01, 0x24, 0x01]);
    const result = expectSuccess(
      deviceNetParser.parse(frame, { options: { payloadInterpretation: 'cip-explicit' } }),
    );
    expect(fieldById(result.frame, 'cip-service').physicalValue).toBe('Get_Attribute_Single');
    expect(fieldById(result.frame, 'cip-path-class').rawValue).toBe(1);
    expect(result.frame.fields.some((f) => f.id === 'data')).toBe(false);
  });
});

describe('parseDeviceNet — hata yolları', () => {
  it('extended identifier’ı reddeder ama çerçeveyi yine gösterir', () => {
    const frame = buildCanClassicFrame(0x18f00401, [0x01], { extended: true });
    const { frame: parsed } = expectSuccess(parseDeviceNet(frame));
    expect(parsed.valid).toBe(false);
    expect(parsed.errors[0]?.code).toBe('value-out-of-range');
    expect(parsed.fields.some((f) => f.id === 'group')).toBe(false);
  });

  it('başlıktan kısa girdide truncated-frame, uzun girdide frame-too-long döner', () => {
    expect(expectFailure(parseDeviceNet(new Uint8Array(4))).error.code).toBe('truncated-frame');
    expect(
      expectFailure(parseDeviceNet(new Uint8Array(CAN_CLASSIC_FRAME_LENGTH + 1))).error.code,
    ).toBe('frame-too-long');
  });

  it('iptal edilmiş signal’da parser-timeout döner', () => {
    const controller = new AbortController();
    controller.abort();
    const result = expectFailure(
      deviceNetParser.parse(buildCanClassicFrame(0x145, []), { signal: controller.signal }),
    );
    expect(result.error.code).toBe('parser-timeout');
  });
});

describe('deviceNetParser', () => {
  it('canParse yalnız uzunluk ve base identifier’a bakar', () => {
    expect(deviceNetParser.canParse(buildCanClassicFrame(0x145, [0x00]))).toBe(true);
    expect(deviceNetParser.canParse(buildCanClassicFrame(0x7ff, [0x00]))).toBe(true);
    expect(
      deviceNetParser.canParse(buildCanClassicFrame(0x18f00401, [], { extended: true })),
    ).toBe(false);
  });
});

describe('deviceNetPlugin', () => {
  it('katalogdaki kimlik, kategori, parser ve decodeOptions bağını taşır', () => {
    expect(deviceNetPlugin.id).toBe('devicenet');
    expect(deviceNetPlugin.category).toBe('industrial-automation');
    expect(deviceNetPlugin.parser).toBe(deviceNetParser);
    expect(deviceNetPlugin.decodeOptions?.length).toBe(1);
  });

  it('her örnek çözülür ve expectedValid ile eşleşir', () => {
    for (const example of deviceNetPlugin.exampleFrames) {
      const result = deviceNetParser.parse(example.bytes);
      if (!result.success) {
        throw new Error(`example "${example.id}" failed: ${result.error.code}`);
      }
      expect(result.frame.valid, `example "${example.id}"`).toBe(example.expectedValid ?? true);
    }
  });

  it('her örnek adı/açıklaması protocol.devicenet.example. önekli çeviri anahtarıdır', () => {
    for (const example of deviceNetPlugin.exampleFrames) {
      expect(example.name.startsWith('protocol.devicenet.example.'), example.id).toBe(true);
      expect(example.description?.startsWith('protocol.devicenet.example.'), example.id).toBe(true);
    }
  });
});
