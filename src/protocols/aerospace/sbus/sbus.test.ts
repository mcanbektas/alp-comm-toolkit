import { describe, expect, it } from 'vitest';

import { parseSbus, sbusParser, sbusPlugin } from './sbus';
import type { ParsedField } from '@/protocol-core/types';

/**
 * Faz 10 dalga 15c — SBUS. `packedChannels.test.ts` `BitOrder`ı İZOLE
 * kanıtladı; burada motorun o yardımcıyı `'lsb-first'` ile GERÇEKTEN
 * çağırdığı, örnek çerçevelerin beklenen 16 kanal değerini verdiği ve
 * bayrak bitlerinin AYRI alanlar olarak (spec `:200`) çözüldüğü sınanır.
 */

function field(fields: readonly ParsedField[], id: string): ParsedField {
  const found = fields.find((candidate) => candidate.id === id);
  if (found === undefined) throw new Error(`alan bulunamadı: ${id}`);
  return found;
}

function example(id: string): Uint8Array {
  const found = sbusPlugin.exampleFrames.find((candidate) => candidate.id === id);
  if (found === undefined) throw new Error(`örnek bulunamadı: ${id}`);
  return found.bytes;
}

const EXPECTED_TYPICAL_CHANNELS = [
  0, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1100, 1200, 1300, 1400, 1500,
];

describe('sbus — çerçeve uzunluğu', () => {
  it('25 bayttan kısa girdi truncated-frame döner', () => {
    const result = parseSbus(new Uint8Array(10));
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe('truncated-frame');
  });

  it('25 bayttan uzun girdi frame-too-long döner', () => {
    const result = parseSbus(new Uint8Array(30));
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe('frame-too-long');
  });
});

describe('sbus — typical-frame: packedChannels lsb-first ile GERÇEKTEN çağrılıyor', () => {
  it('16 kanalın hepsi beklenen değerlere çözülür', () => {
    const result = parseSbus(example('typical-frame'));
    expect(result.success).toBe(true);
    if (!result.success) return;

    EXPECTED_TYPICAL_CHANNELS.forEach((expectedValue, index) => {
      expect(field(result.frame.fields, `sbus-channel-${String(index)}`).rawValue).toBe(expectedValue);
    });
  });

  it('CH1 alanı bayt 1–2 aralığını kapsar ve adı yerel bit aralığı taşır (brief bulgu 5)', () => {
    const result = parseSbus(example('typical-frame'));
    if (!result.success) throw new Error('parse başarısız');

    const ch1 = field(result.frame.fields, 'sbus-channel-0');
    expect(ch1.offset).toBe(1);
    expect(ch1.length).toBe(2);
    expect(ch1.name).toBe('CH1 (bit 0:10)');
    // `unit` BİLEREK yok — ham paketli değer (dosya başı "Gömülmeyecekler").
    expect(ch1.unit).toBeUndefined();
  });

  it('ardışık kanal 0/1 AYNI baytı (byte 2) paylaşır ama id ÇAKIŞMAZ', () => {
    const result = parseSbus(example('typical-frame'));
    if (!result.success) throw new Error('parse başarısız');

    const ch1 = field(result.frame.fields, 'sbus-channel-0');
    const ch2 = field(result.frame.fields, 'sbus-channel-1');
    expect(ch1.offset + ch1.length - 1).toBe(2);
    expect(ch2.offset).toBe(2);
    expect(ch1.id).not.toBe(ch2.id);
  });

  it('bayrak bitlerinin hepsi "Not set" ve çerçeve geçerli', () => {
    const result = parseSbus(example('typical-frame'));
    if (!result.success) throw new Error('parse başarısız');

    for (const id of ['digital-channel-17', 'digital-channel-18', 'frame-lost', 'failsafe-active']) {
      expect(field(result.frame.fields, id).physicalValue).toBe('Not set');
    }
    expect(result.frame.valid).toBe(true);
    expect(result.frame.errors).toEqual([]);
  });
});

describe('sbus — bayrak bitleri AYRI alanlardır (spec :200, tek "RC LINK DEGRADED"e indirgenmez)', () => {
  it('failsafe-and-signal-loss örneğinde İKİ bit de Set, dijital kanallar Not set', () => {
    const result = parseSbus(example('failsafe-and-signal-loss'));
    if (!result.success) throw new Error('parse başarısız');

    expect(field(result.frame.fields, 'frame-lost').physicalValue).toBe('Set');
    expect(field(result.frame.fields, 'failsafe-active').physicalValue).toBe('Set');
    expect(field(result.frame.fields, 'digital-channel-17').physicalValue).toBe('Not set');
    expect(field(result.frame.fields, 'digital-channel-18').physicalValue).toBe('Not set');
  });

  it('digital-channels-17-18 örneğinde YALNIZ dijital kanal bitleri Set', () => {
    const result = parseSbus(example('digital-channels-17-18'));
    if (!result.success) throw new Error('parse başarısız');

    expect(field(result.frame.fields, 'digital-channel-17').physicalValue).toBe('Set');
    expect(field(result.frame.fields, 'digital-channel-18').physicalValue).toBe('Set');
    expect(field(result.frame.fields, 'frame-lost').physicalValue).toBe('Not set');
    expect(field(result.frame.fields, 'failsafe-active').physicalValue).toBe('Not set');
  });
});

describe('sbus — invalid-start-byte örneği', () => {
  it('start byte yanlışsa frame.valid:false ve start-delimiter-not-found, ama kanallar yine çözülür', () => {
    const result = parseSbus(example('invalid-start-byte'));
    expect(result.success).toBe(true); // yapısal olarak yine 25 bayt — kısmi çözüm gösterilir (spec §47)
    if (!result.success) return;

    expect(result.frame.valid).toBe(false);
    expect(result.frame.errors[0]?.code).toBe('start-delimiter-not-found');
    expect(field(result.frame.fields, 'start-byte').valid).toBe(false);
    // DroneCAN'in "not-extended" örneğiyle AYNI ilke: hata olsa da kalan alanlar basılır.
    expect(field(result.frame.fields, 'sbus-channel-0').rawValue).toBe(0);
  });
});

describe('sbus — end byte HAM basılır, doğrulanmaz (rx/sbus.c:98)', () => {
  it('end byte 0x00 dışında bir değer taşısa da valid:true kalır', () => {
    const bytes = Uint8Array.from(example('typical-frame'));
    bytes[24] = 0x42;
    const result = parseSbus(bytes);
    if (!result.success) throw new Error('parse başarısız');

    expect(field(result.frame.fields, 'end-byte').rawValue).toBe(0x42);
    expect(field(result.frame.fields, 'end-byte').valid).toBe(true);
    expect(result.frame.valid).toBe(true);
  });
});

describe('sbusParser.canParse', () => {
  it('tam 25 bayt + start byte 0x0F kabul eder', () => {
    expect(sbusParser.canParse(example('typical-frame'))).toBe(true);
  });

  it('yanlış uzunluğu reddeder', () => {
    expect(sbusParser.canParse(new Uint8Array(24))).toBe(false);
    expect(sbusParser.canParse(new Uint8Array(26))).toBe(false);
  });

  it('yanlış start byte reddeder (uzunluk doğru olsa bile)', () => {
    expect(sbusParser.canParse(example('invalid-start-byte'))).toBe(false);
  });
});

describe('sbusPlugin.exampleFrames — expectedValid gerçek parse sonucuyla TUTARLI', () => {
  it.each(sbusPlugin.exampleFrames.map((exampleFrame) => [exampleFrame.id, exampleFrame] as const))(
    '%s',
    (_id, exampleFrame) => {
      const result = parseSbus(exampleFrame.bytes);
      if (exampleFrame.expectedValid === false) {
        const actuallyValid = result.success && result.frame.valid;
        expect(actuallyValid).toBe(false);
      } else {
        expect(result.success).toBe(true);
        if (result.success) expect(result.frame.valid).toBe(true);
      }
    },
  );
});
