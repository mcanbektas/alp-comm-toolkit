import { describe, expect, it } from 'vitest';

import { encodePulseLog } from './j1850Pulse';
import { buildPwmPulseLog, j1850PwmParser, j1850PwmPlugin, parseJ1850Pwm } from './j1850Pwm';
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

describe('parseJ1850Pwm — geçerli çerçeve', () => {
  it('header + data + CRC’yi doğru çözer, CRC PASS eder', () => {
    const bytes = buildPwmPulseLog({ header: 0x61, data: [0x0c, 0x1a, 0xf8] });
    const { frame } = expectSuccess(parseJ1850Pwm(bytes));

    expect(frame.valid).toBe(true);
    expect(fieldById(frame, 'header').rawValue).toBe(0x61);
    // Header HAM kalır: isme bağlanmaz (dosya başı, "Header HAM kalır").
    expect(fieldById(frame, 'header').physicalValue).toBeUndefined();
    expect(fieldById(frame, 'header').warnings).toContain('protocol.j1850.pwm.warning.headerUnresolved');
    expect(fieldById(frame, 'data').rawBytes).toEqual(new Uint8Array([0x0c, 0x1a, 0xf8]));
    expect(fieldById(frame, 'crc').physicalValue).toBe('Valid');
  });

  it('Data OLMADAN (yalnız Header+CRC) da geçerli en kısa çerçevedir', () => {
    const bytes = buildPwmPulseLog({ header: 0x8a });
    const { frame } = expectSuccess(parseJ1850Pwm(bytes));
    expect(frame.valid).toBe(true);
    expect(frame.fields.some((f) => f.id === 'data')).toBe(false);
  });

  it('bozuk CRC decode-parse-error DEĞİL, alan/frame seviyesinde hata basar', () => {
    const bytes = buildPwmPulseLog({ header: 0x61, data: [0x0c], corruptCrc: true });
    const { frame } = expectSuccess(parseJ1850Pwm(bytes));
    expect(frame.valid).toBe(false);
    expect(frame.errors[0]?.code).toBe('crc-mismatch');
    expect(fieldById(frame, 'crc').physicalValue).toContain('Invalid');
  });
});

describe('parseJ1850Pwm — spec çalışılmış örneği tam çerçeve içinde (ozet 04-otomotiv.md:397/399)', () => {
  it('8 µs → Bit 1, 16 µs → Bit 0 sırası header baytını doğru kurar', () => {
    // SOF(40) + header 8 bit: 8,16,8,16,16,16,16,16 → Bit 1,0,1,0,0,0,0,0 = 0xA0.
    // + CRC 8 bit dummy (bu testte CRC doğrulaması ilgisiz).
    const pulses = [40, 8, 16, 8, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16];
    const bytes = encodePulseLog(pulses);
    const { frame } = expectSuccess(parseJ1850Pwm(bytes));
    expect(fieldById(frame, 'header').rawValue).toBe(0b10100000);
  });
});

describe('parseJ1850Pwm — decodeOptions', () => {
  it('bitThreshold değişince ÇÖZÜLEN BİT değişir (10 µs sınır nabzı)', () => {
    // 10 µs: varsayılan eşik 12'de KISA (Bit 1); custom eşik 5'te UZUN (Bit 0).
    const pulses = [40, 10, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16];
    const bytes = encodePulseLog(pulses);

    const defaultResult = expectSuccess(parseJ1850Pwm(bytes));
    expect(fieldById(defaultResult.frame, 'header').rawValue).toBe(0b10000000);

    const customResult = expectSuccess(
      j1850PwmParser.parse(bytes, { options: { profile: 'custom', bitThreshold: 5 } }),
    );
    expect(fieldById(customResult.frame, 'header').rawValue).toBe(0b00000000);
  });

  it('profile=sae-standard iken bitThreshold sayı alanı YOK SAYILIR', () => {
    const pulses = [40, 10, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16];
    const bytes = encodePulseLog(pulses);
    // profile açıkça standard + saçma bir bitThreshold verilse bile standart eşik (12) kullanılır.
    const result = expectSuccess(
      j1850PwmParser.parse(bytes, {
        options: { profile: 'sae-standard', bitThreshold: 999 },
      }),
    );
    expect(fieldById(result.frame, 'header').rawValue).toBe(0b10000000);
    expect(fieldById(result.frame, 'profile').rawValue).toContain('SAE Standard');
  });

  it('profile alanı İLK SATIRDIR ve yürürlükteki profili adıyla basar', () => {
    const bytes = buildPwmPulseLog({ header: 0x00 });
    const { frame } = expectSuccess(parseJ1850Pwm(bytes));
    expect(frame.fields[0]?.id).toBe('profile');
  });
});

describe('parseJ1850Pwm — konteyner sözleşmesi hataları', () => {
  it('boş girdi truncated-frame döner', () => {
    expect(expectFailure(parseJ1850Pwm(new Uint8Array())).error.code).toBe('truncated-frame');
  });

  it('tek uzunluk truncated-frame döner (madde 2)', () => {
    expect(expectFailure(parseJ1850Pwm(new Uint8Array(3))).error.code).toBe('truncated-frame');
  });

  it('8’in katı olmayan veri nabzı sayısı truncated-frame döner', () => {
    // SOF + 5 veri nabzı — bayta tamamlanmıyor.
    const bytes = encodePulseLog([40, 8, 16, 8, 8, 16]);
    expect(expectFailure(parseJ1850Pwm(bytes)).error.code).toBe('truncated-frame');
  });

  it('Header+CRC’den az veri truncated-frame döner', () => {
    // SOF + yalnız 8 bit (bir bayt): Header var ama CRC yok.
    const bytes = encodePulseLog([40, 8, 16, 8, 16, 16, 16, 16, 16]);
    expect(expectFailure(parseJ1850Pwm(bytes)).error.code).toBe('truncated-frame');
  });

  it('maxFrameLength aşılırsa frame-too-long döner', () => {
    const bytes = buildPwmPulseLog({ header: 0x61, data: [0x01, 0x02] });
    const result = expectFailure(j1850PwmParser.parse(bytes, { maxFrameLength: bytes.length - 2 }));
    expect(result.error.code).toBe('frame-too-long');
  });

  it('iptal edilmiş signal’da parser-timeout döner', () => {
    const controller = new AbortController();
    controller.abort();
    const bytes = buildPwmPulseLog({ header: 0x61 });
    expect(expectFailure(j1850PwmParser.parse(bytes, { signal: controller.signal })).error.code).toBe(
      'parser-timeout',
    );
  });
});

describe('parseJ1850Pwm — rezerve nabız (madde 3)', () => {
  it('SOF ölçülemediyse (0) süreye ÇEVRİLMEZ ve uyarı basılır', () => {
    const bytes = buildPwmPulseLog({ header: 0x61, sofDurationUs: 0 });
    // buildPwmPulseLog sofDurationUs'u encodePulseLog'a verir; encodePulseLog 0'ı
    // REZERVE ile çakışmasın diye 1'e yükseltir — rezerve durumu doğrudan test
    // etmek için konteyneri elle kuruyoruz.
    const manual = new Uint8Array(bytes.length);
    manual.set(bytes);
    manual[0] = 0x00;
    manual[1] = 0x00;
    const { frame } = expectSuccess(parseJ1850Pwm(manual));
    const sofField = fieldById(frame, 'sof');
    expect(sofField.valid).toBe(false);
    expect(sofField.rawValue).toBeUndefined();
    expect(frame.warnings.some((w) => w.code === 'protocol.j1850.pwm.warning.sofReserved')).toBe(true);
  });

  it('veri nabzı ortasında rezerve değer görülürse frame uyarısı basılır', () => {
    // SOF(40) + header 8 bit (3. veri nabzı yer tutucu 16, sonradan REZERVE'e
    // çevrilecek) + CRC 8 bit dummy. encodePulseLog 0'ı REZERVE ile
    // çakışmasın diye 1'e yükseltir (kendi testinde doğrulandı) — rezerve
    // durumu doğrudan üretmek için o nabzın 2 baytı ELLE sıfırlanır.
    const pulses = [40, 8, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16];
    const bytes = encodePulseLog(pulses);
    // 3. veri nabzı = konteynerde pulse-index 3 (SOF=0 dahil) → bayt 6-7.
    bytes[6] = 0x00;
    bytes[7] = 0x00;
    const { frame } = expectSuccess(parseJ1850Pwm(bytes));
    expect(
      frame.warnings.some((w) => w.code === 'protocol.j1850.pwm.warning.reservedPulseInFrame'),
    ).toBe(true);
  });
});

describe('j1850PwmParser.canParse', () => {
  it('kendi örneklerinde true döner', () => {
    for (const example of j1850PwmPlugin.exampleFrames) {
      expect(j1850PwmParser.canParse(example.bytes), example.id).toBe(true);
    }
  });

  it('tek uzunlukta false döner', () => {
    expect(j1850PwmParser.canParse(new Uint8Array(3))).toBe(false);
  });

  it('SOF’un komşu VPW ölçeğine sıçradığı bir dizi false döner', () => {
    // 200 µs SOF adayı — VPW ölçeğinde (>=64), PWM'in KENDİ ölçeği DEĞİL.
    const bytes = encodePulseLog([200, 8, 16, 8, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16]);
    expect(j1850PwmParser.canParse(bytes)).toBe(false);
  });

  it('rezerve SOF ile false döner — imza aranamaz', () => {
    const bytes = new Uint8Array([0x00, 0x00, 0x00, 0x00]);
    expect(j1850PwmParser.canParse(bytes)).toBe(false);
  });

  it('naif "her çift uzunluk" varsayımını ÇÜRÜTEN bir çift-uzunluklu rastgele dizi false döner', () => {
    // 4 µs’lik bir SOF adayı: PWM'in KENDİ en uzun veri bitinden (16 µs) bile kısa.
    const bytes = encodePulseLog([4, 8, 16, 8, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16]);
    expect(j1850PwmParser.canParse(bytes)).toBe(false);
  });
});

describe('j1850PwmPlugin', () => {
  it('katalogdaki kimlik, kategori, parser ve decodeOptions bağını taşır', () => {
    expect(j1850PwmPlugin.id).toBe('sae-j1850-pwm');
    expect(j1850PwmPlugin.category).toBe('automotive');
    expect(j1850PwmPlugin.parser).toBe(j1850PwmParser);
    expect(j1850PwmPlugin.decodeOptions?.length).toBe(2);
  });

  it('her örnek çözülür ve expectedValid ile eşleşir', () => {
    for (const example of j1850PwmPlugin.exampleFrames) {
      const result = j1850PwmParser.parse(example.bytes);
      if (example.expectedValid === false) {
        const invalid = !result.success || !result.frame.valid;
        expect(invalid, `${example.id} geçerli çıktı ama bozuk olmalıydı`).toBe(true);
      } else {
        if (!result.success) throw new Error(`example "${example.id}" failed: ${result.error.code}`);
        expect(result.frame.valid, `example "${example.id}"`).toBe(true);
      }
    }
  });

  it('her örnek adı/açıklaması protocol.j1850.pwm.example. önekli çeviri anahtarıdır', () => {
    for (const example of j1850PwmPlugin.exampleFrames) {
      expect(example.name.startsWith('protocol.j1850.pwm.example.'), example.id).toBe(true);
      expect(example.description?.startsWith('protocol.j1850.pwm.example.'), example.id).toBe(true);
    }
  });

  it('CRC8_SAE_J1850’nin ilk gerçek tüketicisidir', () => {
    // computeNamedCrc'nin GERÇEKTEN çağrıldığının kanıtı: bozuk CRC örneği
    // valid:false döner (yukarıdaki "bozuk CRC" testi) ve geçerli örnekler PASS eder.
    const bytes = buildPwmPulseLog({ header: 0x00, data: [0x00] });
    const { frame } = expectSuccess(parseJ1850Pwm(bytes));
    expect(fieldById(frame, 'crc').physicalValue).toBe('Valid');
  });
});
