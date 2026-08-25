import { describe, expect, it } from 'vitest';

import { MAX_PULSE_DURATION_US, encodePulseLog, pulseByteSpan } from '@/protocol-core/decoding/pulseLog';

import { parsePpm, ppmParser, ppmPlugin } from './ppm';
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

/** Manuel bir nabız günlüğü kurar, belirli indeksleri REZERVE (`0`) yapar — `ppm.ts`teki `buildPulseLog`in test-özel eşdeğeri. */
function buildPulseLog(durationsUs: readonly number[], reservedIndices: readonly number[] = []): Uint8Array {
  const bytes = encodePulseLog(durationsUs);
  for (const index of reservedIndices) {
    const span = pulseByteSpan(index, 1);
    bytes[span.offset] = 0;
    bytes[span.offset + 1] = 0;
  }
  return bytes;
}

describe('parsePpm — konteyner sözleşmesi hataları', () => {
  it('boş girdi truncated-frame döner', () => {
    expect(expectFailure(parsePpm(new Uint8Array())).error.code).toBe('truncated-frame');
  });

  it('tek uzunluk truncated-frame döner (madde 2)', () => {
    expect(expectFailure(parsePpm(new Uint8Array(3))).error.code).toBe('truncated-frame');
  });

  it('maxFrameLength aşılırsa frame-too-long döner', () => {
    const bytes = buildPulseLog([1502, 1499, 4000]);
    const result = expectFailure(ppmParser.parse(bytes, { maxFrameLength: bytes.length - 2 }));
    expect(result.error.code).toBe('frame-too-long');
  });

  it('iptal edilmiş signal’da parser-timeout döner', () => {
    const controller = new AbortController();
    controller.abort();
    const bytes = buildPulseLog([1502, 1499, 4000]);
    expect(expectFailure(ppmParser.parse(bytes, { signal: controller.signal })).error.code).toBe(
      'parser-timeout',
    );
  });
});

describe('parsePpm — spec çalışılmış örneği (06-havacilik-uav.md:254)', () => {
  it('kenarlar 0/1502/3001 µs → CH1=1502, CH2=1499', () => {
    // Spec: "Pulse capture edge'lerinden (0µs, 1502µs, 3001µs...) channel
    // süreleri hesaplanır (CH1=1502µs, CH2=1499µs...)." Bu depronun
    // konteynerinde kenarlar ZATEN nabız sürelerine çevrilmiş hâlde gelir:
    // 1502-0=1502 (CH1), 3001-1502=1499 (CH2). Sync gap 4000 µs.
    const bytes = buildPulseLog([1502, 1499, 4000]);
    const { frame } = expectSuccess(ppmParser.parse(bytes, { options: { syncGapUs: 4000 } }));

    expect(frame.valid).toBe(true);
    expect(fieldById(frame, 'ch-1').physicalValue).toBe('1502.0');
    expect(fieldById(frame, 'ch-2').physicalValue).toBe('1499.0');
    expect(fieldById(frame, 'sync-gap').physicalValue).toBe('4000.0');
    // Toplam periyot: 1502+1499+4000 = 7001.
    expect(fieldById(frame, 'frame-period').physicalValue).toBe('7001.0');
  });
});

describe('parsePpm — spec çalışılmış örneği (06-havacilik-uav.md:263, normalizasyon)', () => {
  it('Pulse=1750 µs, Min=1000/Center=1500/Max=2000 → Normalized=+0.5', () => {
    const bytes = buildPulseLog([1750, 4000]);
    const { frame } = expectSuccess(
      ppmParser.parse(bytes, {
        options: { syncGapUs: 4000, minPulseUs: 1000, centerPulseUs: 1500, maxPulseUs: 2000 },
      }),
    );
    expect(fieldById(frame, 'ch-1-normalized').physicalValue).toBe('0.500');
    // `unit` BİLEREK YOK — normalize değer birimsizdir (dosya başı, types.ts:46).
    expect(fieldById(frame, 'ch-1-normalized').unit).toBeUndefined();
  });

  it('negatif tarafta minimum-center aralığı kullanılır', () => {
    // Pulse=1250: center'ın altında, denominator = center-min = 500.
    // (1250-1500)/500 = -0.5.
    const bytes = buildPulseLog([1250, 4000]);
    const { frame } = expectSuccess(
      ppmParser.parse(bytes, {
        options: { syncGapUs: 4000, minPulseUs: 1000, centerPulseUs: 1500, maxPulseUs: 2000 },
      }),
    );
    expect(fieldById(frame, 'ch-1-normalized').physicalValue).toBe('-0.500');
  });

  it('üç kalibrasyon değeri de verilmezse normalize alan BASILMAZ', () => {
    const bytes = buildPulseLog([1750, 4000]);
    const { frame } = expectSuccess(ppmParser.parse(bytes, { options: { syncGapUs: 4000 } }));
    expect(frame.fields.some((f) => f.id === 'ch-1-normalized')).toBe(false);
  });

  it('yalnız ikisi verilirse (üçü değil) normalize alan yine BASILMAZ', () => {
    const bytes = buildPulseLog([1750, 4000]);
    const { frame } = expectSuccess(
      ppmParser.parse(bytes, { options: { syncGapUs: 4000, minPulseUs: 1000, centerPulseUs: 1500 } }),
    );
    expect(frame.fields.some((f) => f.id === 'ch-1-normalized')).toBe(false);
  });

  it('bozuk sıralama (min >= center) calibrationInvalid uyarır ve normalize alan basılmaz', () => {
    const bytes = buildPulseLog([1750, 4000]);
    const { frame } = expectSuccess(
      ppmParser.parse(bytes, {
        options: { syncGapUs: 4000, minPulseUs: 1500, centerPulseUs: 1500, maxPulseUs: 2000 },
      }),
    );
    expect(frame.fields.some((f) => f.id === 'ch-1-normalized')).toBe(false);
    expect(frame.warnings.some((w) => w.code === 'protocol.ppm.warning.calibrationInvalid')).toBe(true);
  });
});

describe('parsePpm — decodeOptions: syncGapUs VERİLMEDİĞİNDE', () => {
  it('nabızlar sırayla HAM listelenir, kanal ayrımı YAPILMAZ, kayıt yine valid:true', () => {
    const bytes = buildPulseLog([1502, 1499, 4000]);
    const { frame } = expectSuccess(parsePpm(bytes));

    expect(frame.valid).toBe(true);
    expect(frame.fields.some((f) => f.id === 'ch-1')).toBe(false);
    expect(frame.fields.some((f) => f.id === 'sync-gap')).toBe(false);
    expect(fieldById(frame, 'pulse-0').physicalValue).toBe('1502.0');
    expect(fieldById(frame, 'pulse-1').physicalValue).toBe('1499.0');
    expect(fieldById(frame, 'pulse-2').physicalValue).toBe('4000.0');
    expect(
      frame.warnings.some((w) => w.code === 'protocol.ppm.warning.syncGapRequiredForChannelSplit'),
    ).toBe(true);
  });
});

describe('parsePpm — Missing Sync (spec :266)', () => {
  it('hiçbir nabız syncGapUs bandında değilse start-delimiter-not-found basar', () => {
    const bytes = buildPulseLog([1500, 1500, 1400, 1600]);
    const { frame } = expectSuccess(ppmParser.parse(bytes, { options: { syncGapUs: 4000 } }));

    expect(frame.valid).toBe(false);
    expect(frame.errors[0]?.code).toBe('start-delimiter-not-found');
    // Kanallar ayrılamadı ama nabızlar HAM gösterilir (spec §47).
    expect(fieldById(frame, 'pulse-0').physicalValue).toBe('1500.0');
    expect(frame.fields.some((f) => f.id === 'ch-1')).toBe(false);
  });
});

describe('parsePpm — Too Many / Too Few Channels (channelCount)', () => {
  it('gözlenen kanal sayısı fazlaysa tooManyChannels uyarır', () => {
    const bytes = buildPulseLog([1500, 1500, 1500, 4000]); // 3 kanal
    const { frame } = expectSuccess(
      ppmParser.parse(bytes, { options: { syncGapUs: 4000, channelCount: 2 } }),
    );
    expect(frame.warnings.some((w) => w.code === 'protocol.ppm.warning.tooManyChannels')).toBe(true);
  });

  it('gözlenen kanal sayısı azsa tooFewChannels uyarır', () => {
    const bytes = buildPulseLog([1500, 1500, 4000]); // 2 kanal
    const { frame } = expectSuccess(
      ppmParser.parse(bytes, { options: { syncGapUs: 4000, channelCount: 4 } }),
    );
    expect(frame.warnings.some((w) => w.code === 'protocol.ppm.warning.tooFewChannels')).toBe(true);
  });

  it('channelCount VERİLMEZSE (sentinel 0) hiçbir sayı doğrulaması yapılmaz', () => {
    const bytes = buildPulseLog([1500, 1500, 4000]);
    const { frame } = expectSuccess(ppmParser.parse(bytes, { options: { syncGapUs: 4000 } }));
    expect(frame.warnings.some((w) => w.code.includes('tooMany') || w.code.includes('tooFew'))).toBe(
      false,
    );
  });
});

describe('parsePpm — rezerve nabız (pulseLog madde 3)', () => {
  it('kanal ortasında rezerve (0) değer süreye ÇEVRİLMEZ, alan HAM/geçersiz kalır', () => {
    const bytes = buildPulseLog([1500, 1500, 1500, 4000], [1]);
    const { frame } = expectSuccess(ppmParser.parse(bytes, { options: { syncGapUs: 4000 } }));

    const ch2 = fieldById(frame, 'ch-2');
    expect(ch2.valid).toBe(false);
    expect(ch2.rawValue).toBeUndefined();
    expect(ch2.physicalValue).toBeUndefined();
    expect(ch2.warnings).toContain('protocol.ppm.warning.pulseReserved');
    expect(frame.warnings.some((w) => w.code === 'protocol.ppm.warning.pulseReserved')).toBe(true);
    // Rezerve nabız duty/normalize hesabına GİRMEZ — CH1/CH3 hâlâ normal.
    expect(fieldById(frame, 'ch-1').valid).toBe(true);
  });
});

describe('parsePpm — 6553.5 µs doygunluk (ana thread kararı)', () => {
  it('tam MAX_PULSE_DURATION_US süreli bir nabız pulseMayBeSaturated taşır ve ALT SINIR olarak sunulur', () => {
    // 9200 µs (tipik 8 kanal / 20 ms sync gap'i) `encodePulseLog` tarafından
    // register 0xffff'e KIRPILIR.
    const bytes = buildPulseLog([1500, 1500, 9200]);
    const { frame } = expectSuccess(ppmParser.parse(bytes, { options: { syncGapUs: 4000 } }));

    const syncGap = fieldById(frame, 'sync-gap');
    expect(syncGap.physicalValue).toBe(`≥ ${MAX_PULSE_DURATION_US.toFixed(1)}`);
    expect(syncGap.warnings).toContain('protocol.ppm.warning.pulseMayBeSaturated');
    expect(frame.warnings.some((w) => w.code === 'protocol.ppm.warning.pulseMayBeSaturated')).toBe(true);
  });

  it('doygun sync gap YİNE DE senkron olarak TANINIR — tipik 8 kanal/20ms yakalaması sessizce çöpe gitmez', () => {
    // Ana thread tablosu: 8 kanal, ortalama 1.5 ms → sync gap 8000 µs, TAŞAR.
    const channels = [1000, 1100, 1200, 1300, 1400, 1500, 1600, 1700];
    const bytes = buildPulseLog([...channels, 9200]);
    // Kullanıcı gerçek kalibrasyonunu girer: syncGapUs=8000 (konteynerin
    // KENDİ üst sınırından BÜYÜK) — naif `durationUs >= syncGapUs` testi
    // register'ın kırpılmış 6553.5 değeriyle KARŞILAŞTIRILDIĞINDA başarısız
    // olurdu; `isSyncGapCandidate`in "VEYA doygun" şıkkı bunu KURTARIR.
    const { frame } = expectSuccess(ppmParser.parse(bytes, { options: { syncGapUs: 8000 } }));

    expect(frame.valid).toBe(true);
    expect(frame.errors).toEqual([]);
    for (let i = 0; i < channels.length; i += 1) {
      expect(fieldById(frame, `ch-${String(i + 1)}`).physicalValue).toBe(channels[i]?.toFixed(1));
    }
    expect(fieldById(frame, 'sync-gap').physicalValue).toBe(`≥ ${MAX_PULSE_DURATION_US.toFixed(1)}`);
  });

  it('frame period doygun bir bileşen içeriyorsa ALT SINIR ("≥") olarak sunulur', () => {
    const bytes = buildPulseLog([1500, 1500, 9200]);
    const { frame } = expectSuccess(ppmParser.parse(bytes, { options: { syncGapUs: 4000 } }));
    const framePeriod = fieldById(frame, 'frame-period');
    expect(framePeriod.physicalValue).toMatch(/^≥ /);
    expect(framePeriod.warnings).toContain('protocol.ppm.warning.pulseMayBeSaturated');
  });
});

describe('parsePpm — canParse DAİMA false', () => {
  it('kendi ÖRNEK çerçevelerinin hiçbiri canParse’i geçmez', () => {
    for (const example of ppmPlugin.exampleFrames) {
      expect(ppmParser.canParse(example.bytes), example.id).toBe(false);
    }
  });

  it('boş/rastgele/çift-uzunluklu HERHANGİ bir bayt dizisi canParse’i geçmez', () => {
    expect(ppmParser.canParse(new Uint8Array())).toBe(false);
    expect(ppmParser.canParse(new Uint8Array(2))).toBe(false);
    expect(ppmParser.canParse(new Uint8Array([0xff, 0xff, 0xff, 0xff]))).toBe(false);
  });
});

describe('ppmPlugin — örnek çerçeveler', () => {
  it('her örnek başarıyla çözülür (success:true)', () => {
    for (const example of ppmPlugin.exampleFrames) {
      const result = ppmParser.parse(example.bytes);
      expect(result.success, `${example.id}: ${result.success ? '' : result.error.code}`).toBe(
        example.id === 'truncated' ? false : true,
      );
    }
  });

  it('id kümesi benzersizdir', () => {
    const ids = ppmPlugin.exampleFrames.map((example) => example.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('decodeOptions yedi seçenek taşır, hepsinin defaultValue’su TANIMLI', () => {
    expect(ppmPlugin.decodeOptions?.length).toBe(7);
    for (const option of ppmPlugin.decodeOptions ?? []) {
      expect(option.defaultValue).toBeDefined();
    }
  });
});
