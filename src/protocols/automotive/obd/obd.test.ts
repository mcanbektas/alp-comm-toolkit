import { describe, expect, it } from 'vitest';

import {
  OBD_MINIMUM_REQUIRED_MODES,
  OBD_MODES,
  decodeCoolantTemperatureCelsius,
  decodeEngineRpm,
  decodeVehicleSpeedKmh,
  getObdModeInfo,
  obdParser,
  obdPlugin,
  parseObd,
} from './obd';
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

describe('OBD_MODES — spec özet 04:285-293', () => {
  it('spec’in verdiği dokuz modu birebir taşır', () => {
    expect(OBD_MODES.map((mode) => mode.mode).sort((a, b) => a - b)).toEqual([
      0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09,
    ]);
    expect(getObdModeInfo(0x01)?.name).toBe('Current Data');
    expect(getObdModeInfo(0x09)?.name).toBe('Vehicle Information');
  });

  it('asgari desteklenmesi gereken modlar spec’in dediği gibi 01/03/04/09', () => {
    expect([...OBD_MINIMUM_REQUIRED_MODES].sort((a, b) => a - b)).toEqual([0x01, 0x03, 0x04, 0x09]);
  });
});

describe('decodeEngineRpm — spec özet 04:295 doğrulanmış fixture', () => {
  it('A=0x1A, B=0xF8 → 1726 rpm', () => {
    expect(decodeEngineRpm(0x1a, 0xf8)).toBe(1726);
  });
});

describe('decodeVehicleSpeedKmh / decodeCoolantTemperatureCelsius — spec özet 04:297,299', () => {
  it('hız A’nın kendisidir, sıcaklık A-40’tır', () => {
    expect(decodeVehicleSpeedKmh(100)).toBe(100);
    expect(decodeCoolantTemperatureCelsius(0x5a)).toBe(90 - 40);
  });
});

describe('parseObd — Mode 01 isteği', () => {
  it('modu adlandırır, PID/veriyi ham Parameters bloğu yapar', () => {
    const { frame: parsed } = expectSuccess(parseObd(new Uint8Array([0x01, 0x0c])));
    expect(parsed.valid).toBe(true);
    expect(fieldById(parsed, 'mode').rawValue).toBe(0x01);
    expect(fieldById(parsed, 'mode').physicalValue).toBe('Current Data');
    expect(fieldById(parsed, 'parameters').rawBytes).toEqual(new Uint8Array([0x0c]));
    expect(parsed.rawFrame.metadata?.role).toBe('request');
  });
});

describe('parseObd — Mode+0x40 yanıtı (spec özet 04:295 fixture)', () => {
  it('0x41’i Mode 01’in yanıtı olarak tanır, PID/veri HAM kalır', () => {
    const { frame: parsed } = expectSuccess(
      parseObd(new Uint8Array([0x41, 0x0c, 0x1a, 0xf8])),
    );
    expect(fieldById(parsed, 'mode').rawValue).toBe(0x41);
    expect(fieldById(parsed, 'mode').physicalValue).toBe('Current Data');
    expect(parsed.rawFrame.metadata?.role).toBe('response');

    // PID/RPM baytları isme/formüle BAĞLANMAZ — ham parametre olarak kalır.
    const parameters = fieldById(parsed, 'parameters');
    expect(parameters.rawBytes).toEqual(new Uint8Array([0x0c, 0x1a, 0xf8]));
    expect(parameters.physicalValue).toBeUndefined();

    // Ham baytlar spec'in fixture'ıyla decodeEngineRpm üzerinden doğrulanır —
    // motor bunu OTOMATİK yapmaz, çağıran PID'i bağlamdan bilmek zorundadır.
    expect(decodeEngineRpm(parameters.rawBytes[1] ?? 0, parameters.rawBytes[2] ?? 0)).toBe(1726);
  });
});

describe('parseObd — PID gerektirmeyen mod', () => {
  it('Mode 03 tek baytlık istekte Parameters alanı üretmez', () => {
    const { frame: parsed } = expectSuccess(parseObd(new Uint8Array([0x03])));
    expect(fieldById(parsed, 'mode').physicalValue).toBe('Stored DTC');
    expect(parsed.fields.some((field) => field.id === 'parameters')).toBe(false);
  });
});

describe('parseObd — tanınmayan mod', () => {
  it('alanı geçersiz işaretler ve uyarır ama çerçeveyi yine gösterir', () => {
    const { frame: parsed } = expectSuccess(parseObd(new Uint8Array([0x0f])));
    expect(parsed.valid).toBe(true); // uyarı, hata değil
    expect(fieldById(parsed, 'mode').valid).toBe(false);
    expect(warningCodes(parsed)).toContain('protocol.obd.warning.unknownMode');
  });

  it('0x40 kendisi (offset ama temel mod yok) tanınmaz', () => {
    const { frame: parsed } = expectSuccess(parseObd(new Uint8Array([0x40])));
    expect(fieldById(parsed, 'mode').valid).toBe(false);
  });
});

describe('parseObd — boş ve uzun PDU', () => {
  it('boş PDU’da truncated-frame döner', () => {
    expect(expectFailure(parseObd(new Uint8Array(0))).error.code).toBe('truncated-frame');
  });

  it('maxFrameLength verilirse aşıldığında frame-too-long döner', () => {
    const result = expectFailure(
      obdParser.parse(new Uint8Array([0x01, 0x0c]), { maxFrameLength: 1 }),
    );
    expect(result.error.code).toBe('frame-too-long');
  });
});

describe('obdParser', () => {
  it('canParse tanınan modu ve yanıt offsetini kabul eder', () => {
    expect(obdParser.canParse(new Uint8Array([0x01, 0x0c]))).toBe(true);
    expect(obdParser.canParse(new Uint8Array([0x41, 0x0c]))).toBe(true);
  });

  it('canParse tanınmayan modu ve boş girdiyi eler', () => {
    expect(obdParser.canParse(new Uint8Array([0x0f]))).toBe(false);
    expect(obdParser.canParse(new Uint8Array(0))).toBe(false);
  });

  it('iptal edilmiş signal’da parser-timeout döner', () => {
    const controller = new AbortController();
    controller.abort();
    const result = expectFailure(
      obdParser.parse(new Uint8Array([0x01, 0x0c]), { signal: controller.signal }),
    );
    expect(result.error.code).toBe('parser-timeout');
  });
});

describe('obdPlugin', () => {
  it('katalogdaki kimlik, kategori ve parser bağını taşır', () => {
    expect(obdPlugin.id).toBe('obd-ii');
    expect(obdPlugin.category).toBe('automotive');
    expect(obdPlugin.parser).toBe(obdParser);
  });

  it('üç hesap aracını ŞEKİL olarak listeler (motor Faz 5’te)', () => {
    const ids = obdPlugin.calculators?.map((calculator) => calculator.id) ?? [];
    expect(ids).toEqual(['engine-rpm', 'vehicle-speed', 'coolant-temperature']);
  });

  it('her örnek çözülür ve expectedValid ile eşleşir', () => {
    for (const example of obdPlugin.exampleFrames) {
      const result = obdParser.parse(example.bytes);
      if (!result.success) {
        throw new Error(`example "${example.id}" failed: ${result.error.code}`);
      }
      expect(result.frame.valid, `example "${example.id}"`).toBe(example.expectedValid ?? true);
    }
  });

  it('her örnek adı/açıklaması protocol.obd.example. önekli çeviri anahtarıdır', () => {
    for (const example of obdPlugin.exampleFrames) {
      expect(example.name.startsWith('protocol.obd.example.'), example.id).toBe(true);
      expect(example.description?.startsWith('protocol.obd.example.'), example.id).toBe(true);
    }
  });

  it('örnekler istek, yanıt, PID’siz mod ve tanınmayan modu birlikte kapsar', () => {
    const ids = obdPlugin.exampleFrames.map((example) => example.id);
    expect(ids).toContain('current-data-request');
    expect(ids).toContain('engine-rpm-response');
    expect(ids).toContain('stored-dtc-request');
    expect(ids).toContain('unknown-mode');
  });
});
