import { describe, expect, it } from 'vitest';

import {
  createHayesModeTracker,
  DEFAULT_ESCAPE_GUARD_TIME_MS,
  detectEscapeSequence,
  hayesCommandSetParser,
  hayesCommandSetPlugin,
} from './hayesCommandSet';
import { atCommandsParser } from './atCommands';
import type { ParseResult, ParseSuccess, ParsedField, ParsedFrame } from '@/protocol-core/types';
import type { TimedByte } from './hayesCommandSet';

function expectSuccess(result: ParseResult): ParseSuccess {
  if (!result.success) {
    throw new Error(`expected success, got error "${result.error.code}"`);
  }
  return result;
}

function fieldById(frame: ParsedFrame, id: string): ParsedField {
  const field = frame.fields.find((candidate) => candidate.id === id);
  if (field === undefined) {
    throw new Error(`field "${id}" not found among [${frame.fields.map((f) => f.id).join(', ')}]`);
  }
  return field;
}

function hasField(frame: ParsedFrame, id: string): boolean {
  return frame.fields.some((field) => field.id === id);
}

function ascii(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

function parse(line: string): ParsedFrame {
  return expectSuccess(hayesCommandSetParser.parse(ascii(line))).frame;
}

describe('hayesCommandSetParser — temel sözdizimi zincirleme', () => {
  it('ATZE0V1 üç ayrı temel komuta ayrışır (Z, E0, V1)', () => {
    const frame = parse('ATZE0V1\r\n');

    expect(fieldById(frame, 'basic-command-0').rawValue).toBe('Z');
    expect(fieldById(frame, 'basic-command-0').physicalValue).toBe('reset');
    expect(fieldById(frame, 'basic-command-1').rawValue).toBe('E0');
    expect(fieldById(frame, 'basic-command-1').physicalValue).toBeUndefined();
    expect(fieldById(frame, 'basic-command-2').rawValue).toBe('V1');
    expect(fieldById(frame, 'basic-command-2').physicalValue).toBeUndefined();
  });

  it('boş gövdeli çıplak AT hiçbir basic-command alanı üretmez', () => {
    const frame = parse('AT\r\n');

    expect(frame.fields.some((field) => field.id.startsWith('basic-command-'))).toBe(false);
  });

  it('çerçevenin protocol alanı hayes-command-set olur', () => {
    const frame = parse('ATZ\r\n');
    expect(frame.protocol).toBe('hayes-command-set');
  });

  it('genişletilmiş sözdizimi (AT+CSQ) zaten çözülüyse yeniden ayrıştırmaz', () => {
    const frame = parse('AT+CSQ\r\n');

    expect(fieldById(frame, 'command-name').rawValue).toBe('CSQ');
    expect(frame.fields.some((field) => field.id.startsWith('basic-command-'))).toBe(false);
  });
});

describe('hayesCommandSetParser — ATZ (reset)', () => {
  it('parametresiz Z de vendor-specific uyarısı taşır', () => {
    const frame = parse('ATZ\r\n');

    expect(fieldById(frame, 'basic-command-0').physicalValue).toBe('reset');
    expect(frame.warnings.map((w) => w.code)).toContain('protocol.hayesCommandSet.warning.resetParameterVendorSpecific');
  });

  it('parametreli Z1 de aynı uyarıyı taşır — parametrenin ANLAMI V.250\'de yok', () => {
    const frame = parse('ATZ1\r\n');

    expect(fieldById(frame, 'basic-command-0').rawValue).toBe('Z1');
    expect(fieldById(frame, 'basic-command-0').physicalValue).toBe('reset');
    expect(frame.warnings.map((w) => w.code)).toContain('protocol.hayesCommandSet.warning.resetParameterVendorSpecific');
  });
});

describe('hayesCommandSetParser — ATA (answer, satırın kalanını yutar)', () => {
  it('parametresiz A physicalValue "answer" alır', () => {
    const frame = parse('ATA\r\n');

    expect(fieldById(frame, 'basic-command-0').rawValue).toBe('A');
    expect(fieldById(frame, 'basic-command-0').physicalValue).toBe('answer');
  });

  it('A\'dan sonraki her şey ayrı komut sayılmaz, unparsed-tail\'e düşer', () => {
    const frame = parse('ATAX1\r\n');

    expect(fieldById(frame, 'basic-command-0').rawValue).toBe('A');
    expect(frame.fields.some((field) => field.id === 'basic-command-1')).toBe(false);
    expect(fieldById(frame, 'unparsed-tail').rawValue).toBe('X1');
    expect(frame.warnings.map((w) => w.code)).toContain('protocol.hayesCommandSet.warning.unparsedBasicSyntax');
  });
});

describe('hayesCommandSetParser — ATH (hook control)', () => {
  it('H0 belgeli hang-up sayılır, physicalValue "hang up"', () => {
    const frame = parse('ATH0\r\n');

    expect(fieldById(frame, 'basic-command-0').physicalValue).toBe('hang up');
    expect(fieldById(frame, 'basic-command-0').warnings).toEqual([]);
  });

  it('parametresiz H de (0 varsayılan) hang-up sayılır', () => {
    const frame = parse('ATH\r\n');

    expect(fieldById(frame, 'basic-command-0').rawValue).toBe('H');
    expect(fieldById(frame, 'basic-command-0').physicalValue).toBe('hang up');
  });

  it('H1 HİÇBİR kaynakta doğrulanamadı — physicalValue YAZILMAZ, uyarı taşır', () => {
    const frame = parse('ATH1\r\n');

    expect(fieldById(frame, 'basic-command-0').rawValue).toBe('H1');
    expect(fieldById(frame, 'basic-command-0').physicalValue).toBeUndefined();
    expect(frame.warnings.map((w) => w.code)).toContain('protocol.hayesCommandSet.warning.hookParameterUndocumented');
  });
});

describe('hayesCommandSetParser — ATD (dial, kendi sözdizimi)', () => {
  it('";" ile biten dial-string komut moduna döner VE zincir devam eder', () => {
    const frame = parse('ATD5551234567;H0\r\n');

    expect(fieldById(frame, 'dial-0-string').rawValue).toBe('5551234567');
    expect(fieldById(frame, 'dial-0-string').offset).toBe(3); // "AT" (2) + "D" (1)
    expect(fieldById(frame, 'dial-0-return-to-command-mode').rawValue).toBe(';');
    expect(fieldById(frame, 'basic-command-1').rawValue).toBe('H0');
    expect(fieldById(frame, 'basic-command-1').physicalValue).toBe('hang up');
  });

  it('";" yoksa dial-string satırın SONUNA kadar sürer, zincir bitmiş sayılır', () => {
    const frame = parse('ATDT5551234567\r\n');

    expect(fieldById(frame, 'dial-0-string').rawValue).toBe('T5551234567');
    expect(hasField(frame, 'dial-0-return-to-command-mode')).toBe(false);
    // T'nin ton/puls anlamı doğrulanmadı — opak metin olarak taşınır, ayrıştırılmaz.
    expect(fieldById(frame, 'dial-0-string').physicalValue).toBeUndefined();
  });

  it('geçersiz karakter (dial-string dışı) uyarı üretir', () => {
    const frame = parse('ATD555%1234;\r\n');

    expect(fieldById(frame, 'dial-0-string').warnings).toContain(
      'protocol.hayesCommandSet.warning.dialStringUnknownChar',
    );
  });

  it('DTMF A-D harfleri ve #,*,+,",T,P,W,@,! geçerli kabul edilir, uyarı üretmez', () => {
    const frame = parse('ATD1#*+,"TPW@!ABCD;\r\n');

    expect(fieldById(frame, 'dial-0-string').warnings).toEqual([]);
  });
});

describe('hayesCommandSetParser — S-register erişimi', () => {
  it('bilinen register YAZMA — number physicalValue + value alanı, unit yok (S0)', () => {
    const frame = parse('ATS0=2\r\n');

    expect(fieldById(frame, 's-register-0-number').rawValue).toBe(0);
    expect(fieldById(frame, 's-register-0-number').physicalValue).toBe('auto-answer ring count');
    expect(fieldById(frame, 's-register-0-operation').rawValue).toBe('write');
    expect(fieldById(frame, 's-register-0-value').rawValue).toBe(2);
    expect(fieldById(frame, 's-register-0-value').offset).toBe(5);
    expect(fieldById(frame, 's-register-0-value').unit).toBeUndefined();
  });

  it('bilinen register OKUMA — yalnız number+operation, value alanı YOK', () => {
    const frame = parse('ATS3?\r\n');

    expect(fieldById(frame, 's-register-0-number').rawValue).toBe(3);
    expect(fieldById(frame, 's-register-0-number').physicalValue).toBe('line termination character (ASCII)');
    expect(fieldById(frame, 's-register-0-operation').rawValue).toBe('read');
    expect(hasField(frame, 's-register-0-value')).toBe(false);
  });

  it('yalnız u-blox belgelediği S12 vendor-only uyarısı + 20ms/birim dönüşümü taşır', () => {
    const frame = parse('ATS12=50\r\n');

    expect(fieldById(frame, 's-register-0-number').warnings).toContain(
      'protocol.hayesCommandSet.warning.sRegisterVendorOnly',
    );
    expect(fieldById(frame, 's-register-0-value').physicalValue).toBe(1000);
    expect(fieldById(frame, 's-register-0-value').unit).toBe('ms');
  });

  it('S10 0.1sn biriminden saniyeye çevrilir', () => {
    const frame = parse('ATS10=15\r\n');

    expect(fieldById(frame, 's-register-0-value').rawValue).toBe(15);
    expect(fieldById(frame, 's-register-0-value').physicalValue).toBe(1.5);
    expect(fieldById(frame, 's-register-0-value').unit).toBe('s');
  });

  it('aralık dışı değer (S0 range 0-255) uyarı üretir', () => {
    const frame = parse('ATS0=300\r\n');

    expect(fieldById(frame, 's-register-0-value').rawValue).toBe(300);
    expect(fieldById(frame, 's-register-0-value').warnings).toContain(
      'protocol.hayesCommandSet.warning.sRegisterValueOutOfRange',
    );
  });

  it('S5 BİLEREK bilinmeyen — yapı çözülür, physicalValue/uyarı UYDURULMAZ', () => {
    const frame = parse('ATS5=8\r\n');

    expect(fieldById(frame, 's-register-0-number').rawValue).toBe(5);
    expect(fieldById(frame, 's-register-0-number').physicalValue).toBeUndefined();
    expect(fieldById(frame, 's-register-0-number').warnings).toEqual([]);
    expect(fieldById(frame, 's-register-0-value').rawValue).toBe(8);
    expect(fieldById(frame, 's-register-0-value').physicalValue).toBeUndefined();
  });

  it('zincirlenmiş iki S-register ayrı indekslerde çözülür, birbirine karışmaz', () => {
    const frame = parse('ATS0=1S3=13\r\n');

    expect(fieldById(frame, 's-register-0-number').rawValue).toBe(0);
    expect(fieldById(frame, 's-register-0-value').rawValue).toBe(1);
    expect(fieldById(frame, 's-register-1-number').rawValue).toBe(3);
    expect(fieldById(frame, 's-register-1-value').rawValue).toBe(13);
  });
});

describe('hayesCommandSetParser — S-register OKUMA yanıtı (oturumsuz belirsizlik)', () => {
  it('üç haneli sıfır dolgulu bare metin aday işaretlenir, kesin denmez', () => {
    const frame = parse('013\r\n');

    expect(fieldById(frame, 'kind').rawValue).toBe('text');
    expect(fieldById(frame, 's-register-response-candidate').rawValue).toBe(13);
    expect(frame.warnings.map((w) => w.code)).toContain(
      'protocol.hayesCommandSet.warning.sRegisterResponseAmbiguous',
    );
  });

  it('banner metni (üç hane değil) aday işaretlenmez', () => {
    const frame = parse('Quectel BG96\r\n');

    expect(hasField(frame, 's-register-response-candidate')).toBe(false);
  });
});

describe('hayesCommandSetParser — numerik result code (at-commands\'tan miras)', () => {
  it('bare "0" OK olarak çözülür — hayes hiçbir ek kod yazmadan devralır', () => {
    const frame = parse('0\r\n');

    expect(fieldById(frame, 'kind').rawValue).toBe('final-result-code');
    expect(fieldById(frame, 'result-code').rawValue).toBe(0);
    expect(fieldById(frame, 'result-code').physicalValue).toBe('OK');
    expect(frame.protocol).toBe('hayes-command-set');
  });
});

describe('hayesCommandSetPlugin', () => {
  it('katalogdaki kimlik, kategori ve parser bağını taşır', () => {
    expect(hayesCommandSetPlugin.id).toBe('hayes-command-set');
    expect(hayesCommandSetPlugin.category).toBe('interfaces-framing');
    expect(hayesCommandSetPlugin.parser).toBe(hayesCommandSetParser);
  });

  it('her örnek çözülür ve expectedValid ile eşleşir', () => {
    for (const example of hayesCommandSetPlugin.exampleFrames) {
      const result = hayesCommandSetParser.parse(example.bytes);
      if (!result.success) {
        throw new Error(`example "${example.id}" failed: ${result.error.code}`);
      }
      expect(result.frame.valid, `example "${example.id}"`).toBe(example.expectedValid ?? true);
    }
  });

  it('her örnek adı/açıklaması protocol.hayesCommandSet.example. önekli çeviri anahtarıdır', () => {
    for (const example of hayesCommandSetPlugin.exampleFrames) {
      expect(example.name.startsWith('protocol.hayesCommandSet.example.'), example.id).toBe(true);
      expect(example.description?.startsWith('protocol.hayesCommandSet.example.'), example.id).toBe(true);
    }
  });

  it('exampleFrames boş değildir (registry testinin genel kuralı)', () => {
    expect(hayesCommandSetPlugin.exampleFrames.length).toBeGreaterThan(0);
  });
});

describe('detectEscapeSequence — "+++" guard-time', () => {
  function timeline(spec: Array<{ byte: number; at: number }>): TimedByte[] {
    return spec.map(({ byte, at }) => ({ byte, timestamp: at }));
  }

  const PLUS = 0x2b;
  const X = 0x78;

  it('üç eşik de sağlanınca kaçışı bulur', () => {
    const bytes = timeline([
      { byte: X, at: 0 },
      { byte: PLUS, at: 1200 }, // >= 1000ms sessizlik
      { byte: PLUS, at: 1400 }, // 200ms ara, < guard
      { byte: PLUS, at: 1600 }, // 200ms ara, < guard
      { byte: X, at: 2700 }, // >= 1000ms sonrası sessizlik
    ]);

    const detection = detectEscapeSequence(bytes);
    expect(detection.detected).toBe(true);
    expect(detection.plusStartIndex).toBe(1);
  });

  it('yakalama üçüncü +\'ten hemen sonra bitiyorsa sonrası sessizlik yeterli sayılır', () => {
    const bytes = timeline([
      { byte: X, at: 0 },
      { byte: PLUS, at: 1200 },
      { byte: PLUS, at: 1400 },
      { byte: PLUS, at: 1600 },
    ]);

    expect(detectEscapeSequence(bytes).detected).toBe(true);
  });

  it('öncesinde yeterli sessizlik yoksa YANLIŞ POZİTİF üretmez (veri içindeki literal +++)', () => {
    // Tam da dosya başının uyardığı senaryo: bir URL/encoded payload içindeki
    // "+++" — hiçbir baytın arasında gerçek bir duraklama yok.
    const bytes = timeline([
      { byte: X, at: 0 },
      { byte: PLUS, at: 5 },
      { byte: PLUS, at: 10 },
      { byte: PLUS, at: 15 },
      { byte: X, at: 20 },
    ]);

    expect(detectEscapeSequence(bytes).detected).toBe(false);
  });

  it('üç + arasındaki boşluk guard time\'a eşit ya da fazlaysa kaçış sayılmaz', () => {
    const bytes = timeline([
      { byte: X, at: 0 },
      { byte: PLUS, at: 1200 },
      { byte: PLUS, at: 2300 }, // 1100ms >= guard
      { byte: PLUS, at: 2500 },
    ]);

    expect(detectEscapeSequence(bytes).detected).toBe(false);
  });

  it('üçüncü +\'ten sonra guard time dolmadan yeni bayt gelirse kaçış sayılmaz', () => {
    const bytes = timeline([
      { byte: X, at: 0 },
      { byte: PLUS, at: 1200 },
      { byte: PLUS, at: 1400 },
      { byte: PLUS, at: 1600 },
      { byte: X, at: 1900 }, // yalnız 300ms sonra
    ]);

    expect(detectEscapeSequence(bytes).detected).toBe(false);
  });

  it('özel guardTimeMs parametresi eşikleri değiştirir', () => {
    const bytes = timeline([
      { byte: X, at: 0 },
      { byte: PLUS, at: 60 },
      { byte: PLUS, at: 90 },
      { byte: PLUS, at: 120 },
      { byte: X, at: 180 },
    ]);

    expect(detectEscapeSequence(bytes, 50).detected).toBe(true);
    expect(detectEscapeSequence(bytes, DEFAULT_ESCAPE_GUARD_TIME_MS).detected).toBe(false);
  });
});

describe('createHayesModeTracker — command/data mode', () => {
  it('idle command modunda başlar', () => {
    expect(createHayesModeTracker().mode).toBe('command');
  });

  it('CONNECT (sözel) data moduna geçirir', () => {
    const tracker = createHayesModeTracker();
    const frame = expectSuccess(atCommandsParser.parse(ascii('CONNECT 115200\r\n'))).frame;

    tracker.ingestFrame(frame);
    expect(tracker.mode).toBe('data');
  });

  it('CONNECT (sayısal, 1) de data moduna geçirir', () => {
    const tracker = createHayesModeTracker();
    const frame = expectSuccess(atCommandsParser.parse(ascii('1\r\n'))).frame;

    tracker.ingestFrame(frame);
    expect(tracker.mode).toBe('data');
  });

  it('data modundayken onaylı +++ komut moduna döndürür', () => {
    const tracker = createHayesModeTracker();
    tracker.ingestFrame(expectSuccess(atCommandsParser.parse(ascii('CONNECT\r\n'))).frame);
    expect(tracker.mode).toBe('data');

    tracker.ingestByteWindow([
      { byte: 0x78, timestamp: 0 },
      { byte: 0x2b, timestamp: 1200 },
      { byte: 0x2b, timestamp: 1400 },
      { byte: 0x2b, timestamp: 1600 },
    ]);

    expect(tracker.mode).toBe('command');
  });

  it('command modundayken bayt penceresi kaçış aramaz (no-op)', () => {
    const tracker = createHayesModeTracker();
    tracker.ingestByteWindow([
      { byte: 0x2b, timestamp: 0 },
      { byte: 0x2b, timestamp: 1200 },
      { byte: 0x2b, timestamp: 1400 },
    ]);

    expect(tracker.mode).toBe('command');
  });

  it('belgeli hang-up (H0) data moddan komut moduna döndürür', () => {
    const tracker = createHayesModeTracker();
    tracker.ingestFrame(expectSuccess(atCommandsParser.parse(ascii('CONNECT\r\n'))).frame);
    expect(tracker.mode).toBe('data');

    tracker.ingestFrame(expectSuccess(hayesCommandSetParser.parse(ascii('ATH0\r\n'))).frame);
    expect(tracker.mode).toBe('command');
  });

  it('reset command moduna döner', () => {
    const tracker = createHayesModeTracker();
    tracker.ingestFrame(expectSuccess(atCommandsParser.parse(ascii('CONNECT\r\n'))).frame);
    tracker.reset();
    expect(tracker.mode).toBe('command');
  });
});
