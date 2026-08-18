import { describe, expect, it } from 'vitest';

import { daliParser, daliPlugin, parseDali } from './dali';
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

describe('parseDali — backward frame (1 bayt)', () => {
  it('8-bit yanıtı ham gösterir, bağlam-bağımlılık uyarısı basar, çerçeve yine valid kalır', () => {
    const { frame } = expectSuccess(parseDali(Uint8Array.from([0xd2])));
    expect(frame.fields.length).toBe(1);
    const response = fieldById(frame, 'response');
    expect(response.rawValue).toBe(0xd2);
    expect(response.valid).toBe(true);
    expect(warningCodes(frame)).toContain('protocol.dali.warning.backwardFrameContextDependent');
    expect(frame.valid).toBe(true);
    expect(frame.errors).toEqual([]);
  });
});

describe('parseDali — forward frame adres sınıfı (2 bayt)', () => {
  it('bit7=0 → Individual, 6-bit kısa adresi çözer', () => {
    // Individual 5, S=0: (5<<1)|0 = 0x0A.
    const { frame } = expectSuccess(parseDali(Uint8Array.from([0x0a, 0xc8])));
    const address = fieldById(frame, 'address');
    expect(address.rawValue).toBe(0x0a);
    expect(address.physicalValue).toBe('Individual 5');
    expect(address.valid).toBe(true);
  });

  it('100AAAAS → Group, 4-bit grup numarasını çözer', () => {
    // Group 3, S=1: 0x80|(3<<1)|1 = 0x87.
    const { frame } = expectSuccess(parseDali(Uint8Array.from([0x87, 0x17])));
    const address = fieldById(frame, 'address');
    expect(address.rawValue).toBe(0x87);
    expect(address.physicalValue).toBe('Group 3');
    expect(address.valid).toBe(true);
  });

  it('1111111S → Broadcast', () => {
    const { frame } = expectSuccess(parseDali(Uint8Array.from([0xff, 0x00])));
    const address = fieldById(frame, 'address');
    expect(address.rawValue).toBe(0xff);
    expect(address.physicalValue).toBe('Broadcast');
    expect(address.valid).toBe(true);
  });

  it('tanınmayan bit deseni (ör. "101" önekli special-command bölgesi) ham + uyarı basar', () => {
    // 1010 0001 = 0xA1: bit7=1 ama ne group (100xxxxx) ne broadcast (1111111x).
    const { frame } = expectSuccess(parseDali(Uint8Array.from([0xa1, 0x00])));
    const address = fieldById(frame, 'address');
    expect(address.physicalValue).toBeUndefined();
    expect(address.valid).toBe(false);
    expect(warningCodes(frame)).toContain('protocol.dali.warning.unrecognizedAddressClass');
    // Uyarı hata değildir: çerçeve yapısal olarak yine geçerli sayılır.
    expect(frame.valid).toBe(true);
    expect(frame.errors).toEqual([]);
  });
});

describe('parseDali — DAPC/komut ayrımı (Address Byte S biti)', () => {
  it('S=0 → Data byte DAPC seviyesi olarak çözülür', () => {
    const { frame } = expectSuccess(parseDali(Uint8Array.from([0x0a, 0xc8])));
    const data = fieldById(frame, 'data');
    expect(data.name).toBe('Direct Arc Power (DAPC)');
    expect(data.rawValue).toBe(200);
    expect(data.physicalValue).toBe('Direct Arc Power Level (Control)');
    expect(data.valid).toBe(true);
  });

  it('DAPC 255 özel "MASK" değeridir', () => {
    const { frame } = expectSuccess(parseDali(Uint8Array.from([0x0a, 0xff])));
    const data = fieldById(frame, 'data');
    expect(data.rawValue).toBe(255);
    expect(data.physicalValue).toBe('MASK (Control)');
  });

  it('S=1 → Data byte Command olarak çözülür ve dar ad kümesinden adlanır (OFF)', () => {
    const { frame } = expectSuccess(parseDali(Uint8Array.from([0x0b, 0x00])));
    const data = fieldById(frame, 'data');
    expect(data.name).toBe('Command');
    expect(data.physicalValue).toBe('OFF (Control)');
    expect(data.valid).toBe(true);
  });

  it('Go To Scene sahne numarasını opcode-0x10 formülüyle çıkarır', () => {
    const { frame } = expectSuccess(parseDali(Uint8Array.from([0x87, 0x17])));
    const data = fieldById(frame, 'data');
    expect(data.physicalValue).toBe('Go To Scene 7 (Control)');
  });

  it('Store Scene sahne numarasını opcode-0x40 formülüyle çıkarır, Configuration kategorisindedir', () => {
    const { frame } = expectSuccess(parseDali(Uint8Array.from([0x0b, 0x43])));
    const data = fieldById(frame, 'data');
    expect(data.physicalValue).toBe('Store Scene 3 (Configuration)');
  });

  it('Set Fade Time (0x2E) Configuration kategorisindedir', () => {
    const { frame } = expectSuccess(parseDali(Uint8Array.from([0x0b, 0x2e])));
    const data = fieldById(frame, 'data');
    expect(data.physicalValue).toBe('Set Fade Time (Configuration)');
  });

  it('Query Lamp Failure (0x92) ve Query Actual Level (0xA0) Query kategorisindedir', () => {
    const lampFailure = expectSuccess(parseDali(Uint8Array.from([0x0b, 0x92]))).frame;
    expect(fieldById(lampFailure, 'data').physicalValue).toBe('Query Lamp Failure (Query)');

    const actualLevel = expectSuccess(parseDali(Uint8Array.from([0x0b, 0xa0]))).frame;
    expect(fieldById(actualLevel, 'data').physicalValue).toBe('Query Actual Level (Query)');
  });

  it('dar kümenin dışındaki opcode ham + yalnız kategori gösterir, ad uydurulmaz', () => {
    // 0x01 = UP (bilinen bir DALI komutu ama brief'in dar kümesinde YOK).
    const { frame } = expectSuccess(parseDali(Uint8Array.from([0x15, 0x01])));
    const data = fieldById(frame, 'data');
    expect(data.physicalValue).toBe('Control');
    expect(data.valid).toBe(false);
    expect(warningCodes(frame)).toContain('protocol.dali.warning.unrecognizedOpcode');
    expect(frame.valid).toBe(true);
    expect(frame.errors).toEqual([]);
  });

  it('0x50-0x8F aralığı Configuration, 0x90+ Query kategorisine düşer', () => {
    const removeFromScene = expectSuccess(parseDali(Uint8Array.from([0x0b, 0x50]))).frame;
    expect(fieldById(removeFromScene, 'data').physicalValue).toBe('Configuration');

    const queryStatus = expectSuccess(parseDali(Uint8Array.from([0x0b, 0x90]))).frame;
    expect(fieldById(queryStatus, 'data').physicalValue).toBe('Query');
  });
});

describe('parseDali — DALI-2 24-bit device frame (3 bayt, Karar 6)', () => {
  it('tüm baytları ham gösterir, "planned" uyarısı basar, HATA değildir', () => {
    const { frame } = expectSuccess(parseDali(Uint8Array.from([0x81, 0x23, 0x45])));
    expect(frame.fields.length).toBe(1);
    const deviceFrame = fieldById(frame, 'dali2-device-frame');
    expect(deviceFrame.length).toBe(3);
    expect(deviceFrame.rawBytes).toEqual(Uint8Array.from([0x81, 0x23, 0x45]));
    expect(warningCodes(frame)).toContain('protocol.dali.warning.dali2DeviceFramePlanned');
    expect(frame.valid).toBe(true);
    expect(frame.errors).toEqual([]);
  });
});

describe('parseDali — hata yolları', () => {
  it('boş tamponda truncated-frame döner', () => {
    expect(expectFailure(parseDali(new Uint8Array(0))).error.code).toBe('truncated-frame');
  });

  it('4 bayt (forward/backward/DALI-2 hiçbirine uymaz) frame-too-long döner', () => {
    expect(expectFailure(parseDali(Uint8Array.from([0x0a, 0xc8, 0x00, 0x00]))).error.code).toBe(
      'frame-too-long',
    );
  });

  it('context.maxFrameLength verilip aşılırsa frame-too-long döner', () => {
    const result = daliParser.parse(Uint8Array.from([0x0a, 0xc8]), { maxFrameLength: 1 });
    expect(expectFailure(result).error.code).toBe('frame-too-long');
  });

  it('iptal edilmiş signal’da parser-timeout döner', () => {
    const controller = new AbortController();
    controller.abort();
    const result = expectFailure(daliParser.parse(Uint8Array.from([0xd2]), { signal: controller.signal }));
    expect(result.error.code).toBe('parser-timeout');
  });
});

describe('daliParser.canParse', () => {
  it('yalnız 1-3 bayt uzunluk penceresini denetler (DALI’nin magic baytı yok)', () => {
    expect(daliParser.canParse(Uint8Array.from([0xd2]))).toBe(true);
    expect(daliParser.canParse(Uint8Array.from([0x0a, 0xc8]))).toBe(true);
    expect(daliParser.canParse(Uint8Array.from([0x81, 0x23, 0x45]))).toBe(true);
    expect(daliParser.canParse(new Uint8Array(0))).toBe(false);
    expect(daliParser.canParse(new Uint8Array(4))).toBe(false);
  });
});

describe('daliPlugin', () => {
  it('katalogdaki kimlik, kategori ve parser bağını taşır', () => {
    expect(daliPlugin.id).toBe('dali');
    expect(daliPlugin.category).toBe('building-automation');
    expect(daliPlugin.parser).toBe(daliParser);
  });

  it('her örnek gerçek parser’dan geçer ve expectedValid ile eşleşir (hard-failure örnekleri hariç)', () => {
    for (const example of daliPlugin.exampleFrames) {
      const result = daliParser.parse(example.bytes);
      if (!result.success) {
        // Hard-failure örneği (ör. unrecognized-length) YALNIZ expectedValid:false ise beklenir.
        expect(example.expectedValid, `${example.id} unexpectedly failed to parse`).toBe(false);
        continue;
      }
      expect(result.frame.valid, example.id).toBe(example.expectedValid ?? true);
    }
  });

  it('her örnek adı/açıklaması protocol.dali.example. önekli çeviri anahtarıdır', () => {
    for (const example of daliPlugin.exampleFrames) {
      expect(example.name.startsWith('protocol.dali.example.'), example.id).toBe(true);
      expect(example.description?.startsWith('protocol.dali.example.'), example.id).toBe(true);
    }
  });

  it('örnekler brief madde 9’un sekiz senaryosunu kapsar', () => {
    const ids = daliPlugin.exampleFrames.map((example) => example.id);
    expect(ids).toContain('individual-dapc');
    expect(ids).toContain('individual-recognized-command-off');
    expect(ids).toContain('group-command');
    expect(ids).toContain('broadcast-command');
    expect(ids).toContain('unrecognized-opcode');
    expect(ids).toContain('backward-frame-response');
    expect(ids).toContain('dali2-device-frame');
    expect(ids).toContain('unrecognized-length');
    expect(ids.length).toBe(8);
  });
});
