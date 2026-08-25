import { describe, expect, it } from 'vitest';

import { encodePulseLog } from '@/protocol-core/decoding/pulseLog';

import { buildVpwPulseLog, j1850VpwParser, j1850VpwPlugin, parseJ1850Vpw } from './j1850Vpw';
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

describe('parseJ1850Vpw — geçerli çerçeve', () => {
  it('header + data + CRC’yi doğru çözer, CRC PASS eder', () => {
    const bytes = buildVpwPulseLog({ header: 0x68, data: [0x41, 0x0c, 0x1a, 0xf8] });
    const { frame } = expectSuccess(parseJ1850Vpw(bytes));

    expect(frame.valid).toBe(true);
    expect(fieldById(frame, 'header').rawValue).toBe(0x68);
    // Header HAM kalır: isme bağlanmaz.
    expect(fieldById(frame, 'header').physicalValue).toBeUndefined();
    expect(fieldById(frame, 'header').warnings).toContain('protocol.j1850.vpw.warning.headerUnresolved');
    expect(fieldById(frame, 'crc').physicalValue).toBe('Valid');
  });

  it('Data OLMADAN (yalnız Header+CRC) da geçerli en kısa çerçevedir', () => {
    const bytes = buildVpwPulseLog({ header: 0x8a });
    const { frame } = expectSuccess(parseJ1850Vpw(bytes));
    expect(frame.valid).toBe(true);
    expect(frame.fields.some((f) => f.id === 'data')).toBe(false);
  });

  it('bozuk CRC decode-parse-error DEĞİL, alan/frame seviyesinde hata basar', () => {
    const bytes = buildVpwPulseLog({ header: 0x68, data: [0x01], corruptCrc: true });
    const { frame } = expectSuccess(parseJ1850Vpw(bytes));
    expect(frame.valid).toBe(false);
    expect(frame.errors[0]?.code).toBe('crc-mismatch');
    expect(fieldById(frame, 'crc').physicalValue).toContain('Invalid');
  });
});

describe('parseJ1850Vpw — dosya başı tablosu (durum + süre → bit) tam çerçeve içinde', () => {
  it('active/passive + kısa/uzun kombinasyonu header baytını doğru kurar (varsayılan initialLevel=active)', () => {
    // SOF(active) sonrası pulses[1..8] sırayla passive,active,passive,active,passive,active,passive,active.
    // Süreler: [128,128,128,128,64,128,64,128] → bitler [1,0,1,0,0,0,0,0] = 0xA0.
    const pulses = [200, 128, 128, 128, 128, 64, 128, 64, 128, 128, 128, 128, 128, 128, 128, 128, 128];
    const bytes = encodePulseLog(pulses);
    const { frame } = expectSuccess(parseJ1850Vpw(bytes));
    expect(fieldById(frame, 'header').rawValue).toBe(0b10100000);
  });
});

describe('parseJ1850Vpw — decodeOptions', () => {
  const pulses = [200, 128, 128, 128, 128, 64, 128, 64, 128, 128, 128, 128, 128, 128, 128, 128, 128];
  const bytes = encodePulseLog(pulses);

  it('initialLevel=passive AYNI süreleri TERS bitlere çevirir (her pozisyonun durumu döner)', () => {
    const result = expectSuccess(
      j1850VpwParser.parse(bytes, { options: { initialLevel: 'passive' } }),
    );
    // 0xA0 = 1010 0000 → tüm bitler ters: 0101 1111 = 0x5F.
    expect(fieldById(result.frame, 'header').rawValue).toBe(0b01011111);
  });

  it('bitThreshold değişince ÇÖZÜLEN BİT değişir (80 µs sınır nabzı, passive konumda)', () => {
    // pos0 passive: 80 µs varsayılan eşik 96'da KISA (bit 0); eşik 50'de UZUN (bit 1).
    const boundaryPulses = [200, 80, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128];
    const boundaryBytes = encodePulseLog(boundaryPulses);

    const defaultResult = expectSuccess(parseJ1850Vpw(boundaryBytes));
    expect(fieldById(defaultResult.frame, 'header').rawValue).toBe(0b00101010);

    const customResult = expectSuccess(
      j1850VpwParser.parse(boundaryBytes, { options: { bitThreshold: 50 } }),
    );
    expect(fieldById(customResult.frame, 'header').rawValue).toBe(0b10101010);
  });
});

describe('parseJ1850Vpw — OBD-II zinciri (opt-in, devicenet.ts "cip-explicit" deseni birebir emsal)', () => {
  // Data = obd.ts'in KENDİ doğrulanmış "engine-rpm-response" fixture'ı (ozet 04:295).
  const bytes = buildVpwPulseLog({ header: 0x68, data: [0x41, 0x0c, 0x1a, 0xf8] });

  it('varsayılan (raw): Data alanı ham kalır ve "OBD-II sayfasında çözülür" uyarısı basılır', () => {
    const { frame } = expectSuccess(parseJ1850Vpw(bytes));
    expect(fieldById(frame, 'data').rawBytes).toEqual(new Uint8Array([0x41, 0x0c, 0x1a, 0xf8]));
    expect(frame.fields.some((f) => f.id.startsWith('obd-'))).toBe(false);
    expect(frame.warnings.some((w) => w.code === 'protocol.j1850.vpw.warning.dataMayBeObd')).toBe(true);
  });

  it('obd-ii seçilince Data alanı KAYBOLUR, parseObd’ın çözdüğü alanlar BELİRİR', () => {
    const result = expectSuccess(
      j1850VpwParser.parse(bytes, { options: { payloadInterpretation: 'obd-ii' } }),
    );
    expect(result.frame.fields.some((f) => f.id === 'data')).toBe(false);
    expect(fieldById(result.frame, 'obd-mode').rawValue).toBe(0x41);
    expect(fieldById(result.frame, 'obd-mode').physicalValue).toBe('Current Data');
    expect(fieldById(result.frame, 'obd-parameters').rawBytes).toEqual(
      new Uint8Array([0x0c, 0x1a, 0xf8]),
    );
    expect(
      result.frame.warnings.some((w) => w.code === 'protocol.j1850.vpw.warning.dataMayBeObd'),
    ).toBe(false);
  });

  it('sae-j1850-pwm’de AYNI kanal AÇILMAZ (spec zinciri yalnız VPW için istiyor)', async () => {
    const pwmModule = await import('./j1850Pwm');
    expect(pwmModule.j1850PwmPlugin.decodeOptions?.some((o) => o.id === 'payloadInterpretation')).toBe(
      false,
    );
  });
});

describe('parseJ1850Vpw — konteyner sözleşmesi hataları', () => {
  it('boş girdi truncated-frame döner', () => {
    expect(expectFailure(parseJ1850Vpw(new Uint8Array())).error.code).toBe('truncated-frame');
  });

  it('tek uzunluk truncated-frame döner (madde 2)', () => {
    expect(expectFailure(parseJ1850Vpw(new Uint8Array(3))).error.code).toBe('truncated-frame');
  });

  it('8’in katı olmayan veri nabzı sayısı truncated-frame döner', () => {
    const bytes = encodePulseLog([200, 64, 128, 64, 64, 128]);
    expect(expectFailure(parseJ1850Vpw(bytes)).error.code).toBe('truncated-frame');
  });

  it('Header+CRC’den az veri truncated-frame döner', () => {
    const bytes = encodePulseLog([200, 64, 128, 64, 128, 128, 128, 128, 128]);
    expect(expectFailure(parseJ1850Vpw(bytes)).error.code).toBe('truncated-frame');
  });

  it('maxFrameLength aşılırsa frame-too-long döner', () => {
    const bytes = buildVpwPulseLog({ header: 0x68, data: [0x01, 0x02] });
    const result = expectFailure(j1850VpwParser.parse(bytes, { maxFrameLength: bytes.length - 2 }));
    expect(result.error.code).toBe('frame-too-long');
  });

  it('iptal edilmiş signal’da parser-timeout döner', () => {
    const controller = new AbortController();
    controller.abort();
    const bytes = buildVpwPulseLog({ header: 0x68 });
    expect(expectFailure(j1850VpwParser.parse(bytes, { signal: controller.signal })).error.code).toBe(
      'parser-timeout',
    );
  });
});

describe('parseJ1850Vpw — rezerve nabız (madde 3)', () => {
  it('SOF ölçülemediyse (0) süreye ÇEVRİLMEZ ve uyarı basılır', () => {
    const bytes = buildVpwPulseLog({ header: 0x68 });
    const manual = new Uint8Array(bytes.length);
    manual.set(bytes);
    manual[0] = 0x00;
    manual[1] = 0x00;
    const { frame } = expectSuccess(parseJ1850Vpw(manual));
    const sofField = fieldById(frame, 'sof');
    expect(sofField.valid).toBe(false);
    expect(sofField.rawValue).toBeUndefined();
    expect(frame.warnings.some((w) => w.code === 'protocol.j1850.vpw.warning.sofReserved')).toBe(true);
  });

  it('veri nabzı ortasında rezerve değer görülürse frame uyarısı basılır', () => {
    // encodePulseLog 0'ı REZERVE ile çakışmasın diye 1'e yükseltir — rezerve
    // durumu doğrudan üretmek için o nabzın 2 baytı yer tutucudan SONRA elle sıfırlanır.
    const pulses = [200, 128, 128, 128, 128, 64, 128, 64, 128, 128, 128, 128, 128, 128, 128, 128, 128];
    const bytes = encodePulseLog(pulses);
    // 2. veri nabzı = konteynerde pulse-index 2 (SOF=0 dahil) → bayt 4-5.
    bytes[4] = 0x00;
    bytes[5] = 0x00;
    const { frame } = expectSuccess(parseJ1850Vpw(bytes));
    expect(
      frame.warnings.some((w) => w.code === 'protocol.j1850.vpw.warning.reservedPulseInFrame'),
    ).toBe(true);
  });
});

describe('j1850VpwParser.canParse', () => {
  it('kendi örneklerinde true döner', () => {
    for (const example of j1850VpwPlugin.exampleFrames) {
      expect(j1850VpwParser.canParse(example.bytes), example.id).toBe(true);
    }
  });

  it('tek uzunlukta false döner', () => {
    expect(j1850VpwParser.canParse(new Uint8Array(3))).toBe(false);
  });

  it('SOF PWM’in kendi ölçeğinde kalırsa (16 < süre < 64) false döner', () => {
    const bytes = encodePulseLog([40, 64, 128, 64, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128]);
    expect(j1850VpwParser.canParse(bytes)).toBe(false);
  });

  it('rezerve SOF ile false döner', () => {
    expect(j1850VpwParser.canParse(new Uint8Array([0x00, 0x00, 0x00, 0x00]))).toBe(false);
  });

  it('naif "her çift uzunluk" varsayımını ÇÜRÜTEN çok kısa bir SOF adayı false döner', () => {
    const bytes = encodePulseLog([4, 64, 128, 64, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128]);
    expect(j1850VpwParser.canParse(bytes)).toBe(false);
  });
});

describe('j1850VpwPlugin', () => {
  it('katalogdaki kimlik, kategori, parser ve decodeOptions bağını taşır', () => {
    expect(j1850VpwPlugin.id).toBe('sae-j1850-vpw');
    expect(j1850VpwPlugin.category).toBe('automotive');
    expect(j1850VpwPlugin.parser).toBe(j1850VpwParser);
    expect(j1850VpwPlugin.decodeOptions?.length).toBe(3);
  });

  it('her örnek çözülür ve expectedValid ile eşleşir', () => {
    for (const example of j1850VpwPlugin.exampleFrames) {
      const result = j1850VpwParser.parse(example.bytes);
      if (example.expectedValid === false) {
        const invalid = !result.success || !result.frame.valid;
        expect(invalid, `${example.id} geçerli çıktı ama bozuk olmalıydı`).toBe(true);
      } else {
        if (!result.success) throw new Error(`example "${example.id}" failed: ${result.error.code}`);
        expect(result.frame.valid, `example "${example.id}"`).toBe(true);
      }
    }
  });

  it('her örnek adı/açıklaması protocol.j1850.vpw.example. önekli çeviri anahtarıdır', () => {
    for (const example of j1850VpwPlugin.exampleFrames) {
      expect(example.name.startsWith('protocol.j1850.vpw.example.'), example.id).toBe(true);
      expect(example.description?.startsWith('protocol.j1850.vpw.example.'), example.id).toBe(true);
    }
  });
});
