import { describe, expect, it } from 'vitest';

import {
  DOIP_PAYLOAD_TYPE,
  DOIP_PAYLOAD_TYPES,
  doipParser,
  doipPlugin,
  getDoipPayloadTypeInfo,
  parseDoip,
} from './doip';
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

/** Header'ı elle kurar: version(1) + ~version(1) + payload type(2 BE) + length(4 BE) + payload. */
function buildFrame(version: number, payloadType: number, payload: readonly number[]): Uint8Array {
  return new Uint8Array([
    version,
    version ^ 0xff,
    (payloadType >>> 8) & 0xff,
    payloadType & 0xff,
    0x00,
    0x00,
    0x00,
    payload.length,
    ...payload,
  ]);
}

describe('DOIP_PAYLOAD_TYPES — brief-faz10-dalga2a.md tablosu', () => {
  it('16 payload tipini birebir taşır', () => {
    expect(DOIP_PAYLOAD_TYPES).toHaveLength(16);
  });

  it('getDoipPayloadTypeInfo tanınan kodun adını döner, tanınmayanda undefined', () => {
    expect(getDoipPayloadTypeInfo(DOIP_PAYLOAD_TYPE.DIAGNOSTIC_MESSAGE)?.name).toBe(
      'Diagnostic Message',
    );
    expect(getDoipPayloadTypeInfo(0x1234)).toBeUndefined();
  });
});

describe('parseDoip — generic header', () => {
  it('8 bayttan kısa girdide truncated-frame döner', () => {
    expect(expectFailure(parseDoip(new Uint8Array([0x02, 0xfd, 0x00]))).error.code).toBe(
      'truncated-frame',
    );
  });

  it('inverse version tutarsızsa value-out-of-range hatası basar ama alanlar yine gösterilir', () => {
    const frame = buildFrame(0x02, DOIP_PAYLOAD_TYPE.ALIVE_CHECK_REQUEST, []);
    frame[1] = 0x00; // bilerek bozuk: 0x02 ^ 0xFF = 0xFD olmalıydı
    const { frame: parsed } = expectSuccess(doipParser.parse(frame));
    expect(parsed.valid).toBe(false);
    expect(parsed.errors[0]?.code).toBe('value-out-of-range');
    expect(fieldById(parsed, 'inverse-version').valid).toBe(false);
    // Header'ın geri kalanı ve payload yine çözülür (spec §47 kısmi sonuç).
    expect(fieldById(parsed, 'payload-type').physicalValue).toBe('Alive Check Request');
  });

  it('maxFrameLength aşılırsa frame-too-long döner', () => {
    const frame = buildFrame(0x02, DOIP_PAYLOAD_TYPE.ALIVE_CHECK_REQUEST, []);
    const result = expectFailure(doipParser.parse(frame, { maxFrameLength: 4 }));
    expect(result.error.code).toBe('frame-too-long');
  });

  it('iptal edilmiş signal’da parser-timeout döner', () => {
    const controller = new AbortController();
    controller.abort();
    const frame = buildFrame(0x02, DOIP_PAYLOAD_TYPE.ALIVE_CHECK_REQUEST, []);
    const result = expectFailure(doipParser.parse(frame, { signal: controller.signal }));
    expect(result.error.code).toBe('parser-timeout');
  });

  it('bilinmeyen payload tipini uyarır ama ham gösterir', () => {
    const frame = buildFrame(0x02, 0x1234, [0xaa, 0xbb]);
    const { frame: parsed } = expectSuccess(doipParser.parse(frame));
    expect(parsed.valid).toBe(true);
    expect(fieldById(parsed, 'payload-type').valid).toBe(false);
    expect(warningCodes(parsed)).toContain('protocol.doip.warning.unknownPayloadType');
    expect(fieldById(parsed, 'payload').rawBytes).toEqual(new Uint8Array([0xaa, 0xbb]));
  });

  it('deklare edilen payload uzunluğu gerçek uzunlukla uyuşmazsa uyarır', () => {
    const frame = buildFrame(0x02, DOIP_PAYLOAD_TYPE.ALIVE_CHECK_REQUEST, []);
    frame[7] = 0x05; // gerçek payload 0 bayt ama header 5 bayt diyor
    const { frame: parsed } = expectSuccess(doipParser.parse(frame));
    expect(warningCodes(parsed)).toContain('protocol.doip.warning.payloadLengthMismatch');
  });
});

describe('parseDoip — Vehicle Announcement', () => {
  it('VIN/Logical Address/EID/GID/Further Action alan alan çözülür', () => {
    const payload = [
      // VIN: "WVWZZZ1JZXW000001"
      0x57, 0x56, 0x57, 0x5a, 0x5a, 0x5a, 0x31, 0x4a, 0x5a, 0x58, 0x57, 0x30, 0x30, 0x30, 0x30, 0x30,
      0x31,
      0x0e, 0x80, // logical address
      0x00, 0x01, 0x02, 0x03, 0x04, 0x05, // EID
      0xaa, 0xbb, 0xcc, 0xdd, 0xee, 0xff, // GID
      0x00, // further action
    ];
    const frame = buildFrame(0x02, DOIP_PAYLOAD_TYPE.VEHICLE_ANNOUNCEMENT, payload);
    const { frame: parsed } = expectSuccess(doipParser.parse(frame));
    expect(parsed.valid).toBe(true);
    expect(fieldById(parsed, 'vin').rawValue).toBe('WVWZZZ1JZXW000001');
    expect(fieldById(parsed, 'logical-address').rawValue).toBe(0x0e80);
    expect(fieldById(parsed, 'eid').rawValue).toBe('00:01:02:03:04:05');
    expect(fieldById(parsed, 'gid').rawValue).toBe('AA:BB:CC:DD:EE:FF');
    expect(fieldById(parsed, 'further-action').physicalValue).toBe('No Further Action Required');
    expect(parsed.fields.some((field) => field.id === 'sync-status')).toBe(false);
  });

  it('isteğe bağlı Sync Status baytı varsa çözülür', () => {
    // VIN(17)+LogicalAddress(2)+EID(6)+GID(6) = 31 dolgu baytı, + Further Action + Sync Status.
    const payload = [...new Array<number>(31).fill(0x30), 0x00, 0x10];
    const frame = buildFrame(0x02, DOIP_PAYLOAD_TYPE.VEHICLE_ANNOUNCEMENT, payload);
    const { frame: parsed } = expectSuccess(doipParser.parse(frame));
    expect(fieldById(parsed, 'sync-status').physicalValue).toBe('VIN/GID Not Synchronized');
  });

  it('VIN eksikse truncated-frame basar, sonraki alanlar üretilmez', () => {
    const frame = buildFrame(0x02, DOIP_PAYLOAD_TYPE.VEHICLE_ANNOUNCEMENT, [0x57, 0x56]);
    const { frame: parsed } = expectSuccess(doipParser.parse(frame));
    expect(parsed.valid).toBe(false);
    expect(parsed.errors[0]?.code).toBe('truncated-frame');
    expect(parsed.fields.some((field) => field.id === 'vin')).toBe(false);
  });
});

describe('parseDoip — Routing Activation', () => {
  it('istek: source address, activation type, reserved alanları çözülür', () => {
    const frame = buildFrame(0x02, DOIP_PAYLOAD_TYPE.ROUTING_ACTIVATION_REQUEST, [
      0x0e, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    ]);
    const { frame: parsed } = expectSuccess(doipParser.parse(frame));
    expect(fieldById(parsed, 'source-address').rawValue).toBe(0x0e00);
    expect(fieldById(parsed, 'activation-type').physicalValue).toBe('Default');
    expect(fieldById(parsed, 'reserved-iso').rawBytes).toHaveLength(4);
    expect(parsed.fields.some((field) => field.id === 'reserved-oem')).toBe(false);
  });

  it('Central Security activation type 0xE0 olarak tanınır (kaynaklar arası çoğunluk)', () => {
    const frame = buildFrame(0x02, DOIP_PAYLOAD_TYPE.ROUTING_ACTIVATION_REQUEST, [
      0x0e, 0x00, 0xe0, 0x00, 0x00, 0x00, 0x00,
    ]);
    const { frame: parsed } = expectSuccess(doipParser.parse(frame));
    expect(fieldById(parsed, 'activation-type').physicalValue).toBe('Central Security');
  });

  it('yanıt: başarılı activation kodu 0x10 "Activated" olarak çözülür', () => {
    const frame = buildFrame(0x02, DOIP_PAYLOAD_TYPE.ROUTING_ACTIVATION_RESPONSE, [
      0x0e, 0x00, 0x10, 0x01, 0x10, 0x00, 0x00, 0x00, 0x00,
    ]);
    const { frame: parsed } = expectSuccess(doipParser.parse(frame));
    expect(parsed.valid).toBe(true);
    expect(fieldById(parsed, 'tester-logical-address').rawValue).toBe(0x0e00);
    expect(fieldById(parsed, 'entity-logical-address').rawValue).toBe(0x1001);
    expect(fieldById(parsed, 'response-code').physicalValue).toBe('Activated');
  });

  it('response code eksikse truncated-frame basar ama önceki alanlar görünür', () => {
    const frame = buildFrame(0x02, DOIP_PAYLOAD_TYPE.ROUTING_ACTIVATION_RESPONSE, [
      0x0e, 0x00, 0x10,
    ]);
    const { frame: parsed } = expectSuccess(doipParser.parse(frame));
    expect(parsed.valid).toBe(false);
    expect(fieldById(parsed, 'tester-logical-address')).toBeDefined();
    expect(parsed.fields.some((field) => field.id === 'entity-logical-address')).toBe(false);
  });
});

describe('parseDoip — Diagnostic Message', () => {
  it('SA/TA ayrı alan olur, UDS gövdesi HAM kalır ve UDS sayfasına yönlendirir', () => {
    const frame = buildFrame(0x02, DOIP_PAYLOAD_TYPE.DIAGNOSTIC_MESSAGE, [
      0x0e, 0x00, 0x10, 0x01, 0x22, 0xf1, 0x90,
    ]);
    const { frame: parsed } = expectSuccess(doipParser.parse(frame));
    expect(fieldById(parsed, 'source-address').rawValue).toBe(0x0e00);
    expect(fieldById(parsed, 'target-address').rawValue).toBe(0x1001);
    expect(fieldById(parsed, 'uds-payload').rawBytes).toEqual(new Uint8Array([0x22, 0xf1, 0x90]));
    expect(fieldById(parsed, 'uds-payload').physicalValue).toBeUndefined();
    expect(warningCodes(parsed)).toContain('protocol.doip.warning.udsPayloadNeedsUdsPage');
  });
});

describe('doipParser.canParse', () => {
  it('geçerli header + tutarlı inverse version kabul eder', () => {
    expect(doipParser.canParse(buildFrame(0x02, DOIP_PAYLOAD_TYPE.ALIVE_CHECK_REQUEST, []))).toBe(
      true,
    );
  });

  it('8 bayttan kısa ya da inverse version tutarsız girdiyi eler', () => {
    expect(doipParser.canParse(new Uint8Array([0x02, 0xfd]))).toBe(false);
    const bad = buildFrame(0x02, DOIP_PAYLOAD_TYPE.ALIVE_CHECK_REQUEST, []);
    bad[1] = 0x00;
    expect(doipParser.canParse(bad)).toBe(false);
  });
});

describe('doipPlugin', () => {
  it('katalogdaki kimlik, kategori ve parser bağını taşır', () => {
    expect(doipPlugin.id).toBe('doip');
    expect(doipPlugin.category).toBe('automotive');
    expect(doipPlugin.parser).toBe(doipParser);
  });

  it('her örnek çözülür ve expectedValid ile eşleşir', () => {
    for (const example of doipPlugin.exampleFrames) {
      const result = doipParser.parse(example.bytes);
      if (!result.success) {
        throw new Error(`example "${example.id}" failed: ${result.error.code}`);
      }
      expect(result.frame.valid, `example "${example.id}"`).toBe(example.expectedValid ?? true);
    }
  });

  it('her örnek adı/açıklaması protocol.doip.example. önekli çeviri anahtarıdır', () => {
    for (const example of doipPlugin.exampleFrames) {
      expect(example.name.startsWith('protocol.doip.example.'), example.id).toBe(true);
      expect(example.description?.startsWith('protocol.doip.example.'), example.id).toBe(true);
    }
  });

  it('örnekler yapısal tipleri ve hata yolunu birlikte kapsar', () => {
    const ids = doipPlugin.exampleFrames.map((example) => example.id);
    expect(ids).toContain('vehicle-announcement');
    expect(ids).toContain('routing-activation-request');
    expect(ids).toContain('routing-activation-response');
    expect(ids).toContain('diagnostic-message');
    expect(ids).toContain('routing-activation-response-truncated');
  });
});
