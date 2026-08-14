import { describe, expect, it } from 'vitest';

import { buildCanClassicFrame } from '../../automotive/can/canClassic';
import { CAN_CLASSIC_FRAME_LENGTH } from '../../automotive/can/canFrame';
import { canopenParser, canopenPlugin, parseCanopen } from './canopen';
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

describe('parseCanopen — NMT (COB-ID 0x000)', () => {
  it('function code 0x0’ı NMT olarak tanır, komut ve hedef node’u ham gösterir', () => {
    const frame = buildCanClassicFrame(0x000, [0x01, 0x00]);
    const { frame: parsed } = expectSuccess(parseCanopen(frame));
    expect(parsed.valid).toBe(true);
    expect(fieldById(parsed, 'function-code').physicalValue).toBe('NMT');
    expect(fieldById(parsed, 'node-id').rawValue).toBe(0);
    expect(fieldById(parsed, 'command').rawValue).toBe(0x01);
    expect(fieldById(parsed, 'target-node-id').rawValue).toBe(0x00);
  });
});

describe('parseCanopen — SYNC vs EMCY (function code 0x1, node ayrımı)', () => {
  it('node 0 → SYNC, payload beklenmez', () => {
    const frame = buildCanClassicFrame(0x080, []);
    const { frame: parsed } = expectSuccess(parseCanopen(frame));
    expect(fieldById(parsed, 'function-code').physicalValue).toBe('SYNC');
    expect(fieldById(parsed, 'node-id').rawValue).toBe(0);
    expect(parsed.fields.some((f) => f.id === 'error-code')).toBe(false);
  });

  it('node ≠ 0 → EMCY, error code/register/manufacturer data alanlarına ayrılır', () => {
    // COB-ID 0x085 = 0x080 + 5.
    const frame = buildCanClassicFrame(0x085, [0x10, 0x81, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00]);
    const { frame: parsed } = expectSuccess(parseCanopen(frame));
    expect(fieldById(parsed, 'function-code').physicalValue).toBe('EMCY');
    expect(fieldById(parsed, 'node-id').rawValue).toBe(5);
    expect(fieldById(parsed, 'error-code').rawValue).toBe(0x8110);
    expect(fieldById(parsed, 'error-register').rawValue).toBe(0x01);
    expect(fieldById(parsed, 'manufacturer-data').rawBytes).toEqual(
      new Uint8Array([0x00, 0x00, 0x00, 0x00, 0x00]),
    );
    expect(warningCodes(parsed)).toContain('protocol.canopen.warning.emcyNeedsDatabase');
  });
});

describe('parseCanopen — PDO (spec özet 04:102)', () => {
  it('CAN ID 0x181’i TPDO1/node 1 olarak tanır, veriyi HAM bırakır', () => {
    const frame = buildCanClassicFrame(0x181, [0x37, 0x12, 0xdc, 0x05]);
    const { frame: parsed } = expectSuccess(parseCanopen(frame));
    expect(fieldById(parsed, 'function-code').physicalValue).toBe('PDO1 (Tx)');
    expect(fieldById(parsed, 'node-id').rawValue).toBe(1);
    const data = fieldById(parsed, 'data');
    expect(data.rawBytes).toEqual(new Uint8Array([0x37, 0x12, 0xdc, 0x05]));
    // Statusword/Velocity çözümü EDS/mapping ister — burada isim ATANMAZ.
    expect(data.physicalValue).toBeUndefined();
    expect(warningCodes(parsed)).toContain('protocol.canopen.warning.pdoNeedsMapping');
  });
});

describe('parseCanopen — SDO (spec özet 03:87, Index 6040 Sub 00 Write 000F)', () => {
  it('expedited yazma isteğini index/sub-index ile çözer', () => {
    const frame = buildCanClassicFrame(
      0x601,
      [0x2b, 0x40, 0x60, 0x00, 0x0f, 0x00, 0x00, 0x00],
    );
    const { frame: parsed } = expectSuccess(parseCanopen(frame));
    expect(fieldById(parsed, 'function-code').physicalValue).toBe('SDO (Rx)');
    expect(fieldById(parsed, 'node-id').rawValue).toBe(1);
    expect(fieldById(parsed, 'command-byte').physicalValue).toBe('Expedited');
    expect(fieldById(parsed, 'index').rawValue).toBe(0x6040);
    expect(fieldById(parsed, 'sub-index').rawValue).toBe(0x00);
    expect(fieldById(parsed, 'data').rawBytes).toEqual(new Uint8Array([0x0f, 0x00, 0x00, 0x00]));
    expect(warningCodes(parsed)).toContain('protocol.canopen.warning.sdoDataNeedsSchema');
  });

  it('0x80 komut baytını Abort Transfer olarak tanır, abort kodunu HAM gösterir', () => {
    const frame = buildCanClassicFrame(0x581, [0x80, 0x40, 0x60, 0x00, 0x06, 0x02, 0x00, 0x00]);
    const { frame: parsed } = expectSuccess(parseCanopen(frame));
    expect(fieldById(parsed, 'function-code').physicalValue).toBe('SDO (Tx)');
    expect(fieldById(parsed, 'command-byte').physicalValue).toBe('Abort Transfer');
    expect(fieldById(parsed, 'abort-code').rawBytes).toEqual(
      new Uint8Array([0x06, 0x02, 0x00, 0x00]),
    );
    expect(warningCodes(parsed)).toContain('protocol.canopen.warning.sdoAbortNeedsTable');
  });

  it('command specifier 6/5’i Block Download/Upload olarak ayırt eder', () => {
    // ccs=6 (0b110<<5 = 0xC0) → Block Download initiate.
    const download = buildCanClassicFrame(0x601, [0xc0, 0x40, 0x60, 0x00]);
    expect(
      fieldById(expectSuccess(parseCanopen(download)).frame, 'command-byte').physicalValue,
    ).toBe('Block Download');
    // scs=5 (0b101<<5 = 0xA0) → Block Upload initiate.
    const upload = buildCanClassicFrame(0x581, [0xa0, 0x40, 0x60, 0x00]);
    expect(
      fieldById(expectSuccess(parseCanopen(upload)).frame, 'command-byte').physicalValue,
    ).toBe('Block Upload');
  });
});

describe('parseCanopen — Heartbeat', () => {
  it('durum baytını CiA 301 NMT durumlarından adlandırır', () => {
    // COB-ID 0x702 = 0x700 + 2.
    const frame = buildCanClassicFrame(0x702, [0x05]);
    const { frame: parsed } = expectSuccess(parseCanopen(frame));
    expect(fieldById(parsed, 'function-code').physicalValue).toBe('Heartbeat');
    expect(fieldById(parsed, 'node-id').rawValue).toBe(2);
    expect(fieldById(parsed, 'nmt-state').physicalValue).toBe('Operational');
  });

  it('tanınmayan durum baytında alanı geçersiz işaretler ve uyarır', () => {
    const frame = buildCanClassicFrame(0x701, [0xaa]);
    const { frame: parsed } = expectSuccess(parseCanopen(frame));
    expect(fieldById(parsed, 'nmt-state').valid).toBe(false);
    expect(warningCodes(parsed)).toContain('protocol.canopen.warning.unknownNmtState');
  });
});

describe('parseCanopen — hata yolları', () => {
  it('extended identifier’ı reddeder ama çerçeveyi yine gösterir', () => {
    const frame = buildCanClassicFrame(0x18f00401, [0x01], { extended: true });
    const { frame: parsed } = expectSuccess(parseCanopen(frame));
    expect(parsed.valid).toBe(false);
    expect(parsed.errors[0]?.code).toBe('value-out-of-range');
    expect(parsed.fields.some((f) => f.id === 'function-code')).toBe(false);
    expect(fieldById(parsed, 'can-id').rawValue).toBe(0x18f00401);
  });

  it('ayrılmış function code (0xD) hatayı basar ama çerçeveyi yine gösterir', () => {
    // COB-ID 0x680 = 0xD << 7.
    const frame = buildCanClassicFrame(0x680, [0x00]);
    const { frame: parsed } = expectSuccess(parseCanopen(frame));
    expect(parsed.valid).toBe(false);
    expect(parsed.errors[0]?.code).toBe('value-out-of-range');
    expect(fieldById(parsed, 'function-code').valid).toBe(false);
  });

  it('başlıktan kısa girdide truncated-frame, uzun girdide frame-too-long döner', () => {
    expect(expectFailure(parseCanopen(new Uint8Array(4))).error.code).toBe('truncated-frame');
    expect(
      expectFailure(parseCanopen(new Uint8Array(CAN_CLASSIC_FRAME_LENGTH + 1))).error.code,
    ).toBe('frame-too-long');
  });
});

describe('canopenParser', () => {
  it('canParse tanınan function code’ları kabul eder, ayrılmışı ve extended’i eler', () => {
    expect(canopenParser.canParse(buildCanClassicFrame(0x080, []))).toBe(true);
    expect(canopenParser.canParse(buildCanClassicFrame(0x181, [0x01]))).toBe(true);
    expect(canopenParser.canParse(buildCanClassicFrame(0x680, [0x00]))).toBe(false);
    expect(canopenParser.canParse(buildCanClassicFrame(0x18f00401, [], { extended: true }))).toBe(
      false,
    );
  });

  it('iptal edilmiş signal’da parser-timeout döner', () => {
    const controller = new AbortController();
    controller.abort();
    const result = expectFailure(
      canopenParser.parse(buildCanClassicFrame(0x080, []), { signal: controller.signal }),
    );
    expect(result.error.code).toBe('parser-timeout');
  });
});

describe('canopenPlugin', () => {
  it('katalogdaki kimlik, kategori ve parser bağını taşır', () => {
    expect(canopenPlugin.id).toBe('canopen');
    expect(canopenPlugin.category).toBe('industrial-automation');
    expect(canopenPlugin.parser).toBe(canopenParser);
  });

  it('her örnek çözülür ve expectedValid ile eşleşir', () => {
    for (const example of canopenPlugin.exampleFrames) {
      const result = canopenParser.parse(example.bytes);
      if (!result.success) {
        throw new Error(`example "${example.id}" failed: ${result.error.code}`);
      }
      expect(result.frame.valid, `example "${example.id}"`).toBe(example.expectedValid ?? true);
    }
  });

  it('her örnek adı/açıklaması protocol.canopen.example. önekli çeviri anahtarıdır', () => {
    for (const example of canopenPlugin.exampleFrames) {
      expect(example.name.startsWith('protocol.canopen.example.'), example.id).toBe(true);
      expect(example.description?.startsWith('protocol.canopen.example.'), example.id).toBe(true);
    }
  });

  it('örnekler altı mesaj tipini ve hata yolunu birlikte kapsar', () => {
    const ids = canopenPlugin.exampleFrames.map((example) => example.id);
    expect(ids).toContain('nmt-start-remote-node');
    expect(ids).toContain('sync');
    expect(ids).toContain('emcy-node-5');
    expect(ids).toContain('pdo-statusword-velocity');
    expect(ids).toContain('sdo-write-controlword');
    expect(ids).toContain('heartbeat-operational');
    expect(ids).toContain('reserved-function-code-rejected');
  });
});
