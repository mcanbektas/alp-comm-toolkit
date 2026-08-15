import { describe, expect, it } from 'vitest';

import { mavlinkParser, mavlinkPlugin, parseMavlink } from './mavlink';
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

function fieldIds(frame: ParsedFrame): string[] {
  return frame.fields.map((field) => field.id);
}

function warningCodes(frame: ParsedFrame): string[] {
  return frame.warnings.map((warning) => warning.code);
}

/** spec'in kendi örnek renklendirmesi: `FE 09 2A 01 01 00 PAYLOAD... CRC`. */
const V1_HEARTBEAT_FRAME = new Uint8Array([
  0xfe, 0x09, 0x2a, 0x01, 0x01, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0xab, 0xcd,
]);

const V2_UNSIGNED_FRAME = new Uint8Array([
  0xfd, 0x08, 0x00, 0x00, 0x10, 0x01, 0x01, 0x18, 0x00, 0x00, 0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77,
  0x88, 0x9a, 0xbc,
]);

const V2_SIGNED_FRAME = new Uint8Array([
  0xfd, 0x04, 0x01, 0x00, 0x20, 0x02, 0x01, 0x4c, 0x00, 0x00, 0xde, 0xad, 0xbe, 0xef, 0x12, 0x34, 0x01,
  0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0x0c, 0x0d,
]);

describe('parseMavlink — v1 mutlu yol (spec örneği)', () => {
  it('header alan alan çözülür, seq/sysid/compid/msgid doğru', () => {
    const { frame } = expectSuccess(parseMavlink(V1_HEARTBEAT_FRAME));

    expect(frame.valid).toBe(true);
    expect(fieldById(frame, 'magic').rawValue).toBe(0xfe);
    expect(fieldById(frame, 'magic').physicalValue).toBe('MAVLink 1');
    expect(fieldById(frame, 'payload-length').rawValue).toBe(9);
    expect(fieldById(frame, 'seq').rawValue).toBe(0x2a);
    expect(fieldById(frame, 'system-id').rawValue).toBe(0x01);
    expect(fieldById(frame, 'component-id').rawValue).toBe(0x01);
    expect(fieldById(frame, 'message-id').rawValue).toBe(0x00);
    expect(fieldById(frame, 'message-id').length).toBe(1);
  });

  it('payload ham gösterilir + payloadNeedsDialect, checksum ham gösterilir + crcNeedsDialect', () => {
    const { frame } = expectSuccess(parseMavlink(V1_HEARTBEAT_FRAME));

    const payload = fieldById(frame, 'payload');
    expect(payload.length).toBe(9);
    expect(payload.rawBytes).toEqual(V1_HEARTBEAT_FRAME.slice(6, 15));
    expect(payload.warnings).toContain('protocol.mavlink.warning.payloadNeedsDialect');

    const checksum = fieldById(frame, 'checksum');
    expect(checksum.rawValue).toBe(0xcdab); // LE: AB CD → 0xCDAB
    expect(checksum.valid).toBe(true);
    expect(checksum.warnings).toContain('protocol.mavlink.warning.crcNeedsDialect');

    expect(warningCodes(frame)).toContain('protocol.mavlink.warning.payloadNeedsDialect');
    expect(warningCodes(frame)).toContain('protocol.mavlink.warning.crcNeedsDialect');
  });

  it('checksum-mismatch HİÇBİR ZAMAN basılmaz — bozuk checksumla bile', () => {
    const corrupted = new Uint8Array(V1_HEARTBEAT_FRAME);
    corrupted[corrupted.length - 1] = 0x00;
    corrupted[corrupted.length - 2] = 0x00;

    const { frame } = expectSuccess(parseMavlink(corrupted));
    expect(frame.valid).toBe(true);
    expect(frame.errors).toHaveLength(0);
    expect(frame.errors.some((error) => error.code === 'checksum-mismatch')).toBe(false);
  });

  it('metadata seq DEĞERİNİ taşır, kayıp hesaplamaz (analyzer işi)', () => {
    const { frame } = expectSuccess(parseMavlink(V1_HEARTBEAT_FRAME));
    const metadata = frame.rawFrame.metadata;
    expect(metadata?.version).toBe('v1');
    expect(metadata?.seq).toBe(0x2a);
    expect(metadata?.signed).toBe(false);
  });
});

describe('parseMavlink — v2 mutlu yol, imzasız', () => {
  it('Incompat/Compat Flags ve 24-bit MSGID doğru ayrıştırılır', () => {
    const { frame } = expectSuccess(parseMavlink(V2_UNSIGNED_FRAME));

    expect(frame.valid).toBe(true);
    expect(fieldById(frame, 'magic').physicalValue).toBe('MAVLink 2');
    expect(fieldById(frame, 'incompat-flags').rawValue).toBe(0x00);
    expect(fieldById(frame, 'incompat-flags').physicalValue).toBeUndefined();
    expect(fieldById(frame, 'compat-flags').rawValue).toBe(0x00);
    expect(fieldById(frame, 'message-id').rawValue).toBe(24); // 0x000018 LE
    expect(fieldById(frame, 'message-id').offset).toBe(7);
    expect(fieldById(frame, 'message-id').length).toBe(3);
    expect(fieldIds(frame)).not.toContain('signature');

    const metadata = frame.rawFrame.metadata;
    expect(metadata?.version).toBe('v2');
    expect(metadata?.signed).toBe(false);
    expect(metadata?.messageId).toBe(24);
  });
});

describe('parseMavlink — v2 imzalı', () => {
  it('incompat 0x01 → Signed, 13 baytlık imza ham gösterilir + signatureNeedsKey', () => {
    const { frame } = expectSuccess(parseMavlink(V2_SIGNED_FRAME));

    expect(frame.valid).toBe(true);
    expect(fieldById(frame, 'incompat-flags').rawValue).toBe(0x01);
    expect(fieldById(frame, 'incompat-flags').physicalValue).toBe('Signed');
    expect(fieldById(frame, 'message-id').rawValue).toBe(0x4c);

    const signature = fieldById(frame, 'signature');
    expect(signature.length).toBe(13);
    expect(signature.warnings).toContain('protocol.mavlink.warning.signatureNeedsKey');
    expect(warningCodes(frame)).toContain('protocol.mavlink.warning.signatureNeedsKey');

    expect(frame.rawFrame.metadata?.signed).toBe(true);
  });

  it('imza için yer yoksa (incompat set ama veri kısa) truncated-frame basar', () => {
    // v2-signed'ın imza baytları KESİLMİŞ hâli: header+payload+checksum var, imza yok.
    const truncated = V2_SIGNED_FRAME.slice(0, V2_SIGNED_FRAME.length - 13);
    const { frame } = expectSuccess(parseMavlink(truncated));

    expect(frame.valid).toBe(false);
    expect(frame.errors[0]?.code).toBe('truncated-frame');
    expect(fieldIds(frame)).not.toContain('signature');
    expect(fieldIds(frame)).not.toContain('payload'); // gövde bütünüyle atlanır (RTCM deseni)
  });
});

describe('parseMavlink — 24-bit MSGID sınırı ve bayt-viewer çakışması yok', () => {
  it('MSGID 0xFFFFFF doğru birleştirilir, flags/seq/sysid/compid ile ÇAKIŞMAZ', () => {
    const bytes = new Uint8Array([
      0xfd, 0x02, 0x00, 0x00, 0xff, 0xee, 0xdd, 0xff, 0xff, 0xff, 0xaa, 0xbb, 0x55, 0x66,
    ]);
    const { frame } = expectSuccess(parseMavlink(bytes));

    expect(fieldById(frame, 'seq').rawValue).toBe(0xff);
    expect(fieldById(frame, 'system-id').rawValue).toBe(0xee);
    expect(fieldById(frame, 'component-id').rawValue).toBe(0xdd);
    expect(fieldById(frame, 'message-id').rawValue).toBe(0xffffff);

    // Offset aralıkları üst üste binmemeli: her alanın [offset, offset+length) aralığı ayrık.
    const ranges = frame.fields.map((field) => [field.offset, field.offset + field.length] as const);
    for (let i = 0; i < ranges.length; i += 1) {
      for (let j = i + 1; j < ranges.length; j += 1) {
        const a = ranges[i];
        const b = ranges[j];
        if (a === undefined || b === undefined) continue;
        const overlaps = a[0] < b[1] && b[0] < a[1];
        expect(overlaps, `${frame.fields[i]?.id} ve ${frame.fields[j]?.id} çakışıyor`).toBe(false);
      }
    }
  });
});

describe('parseMavlink — eksik/kısa çerçeve (hata yolu)', () => {
  it('v1 header 6 baytın altındaysa HARD FAIL (truncated-frame, recoverable)', () => {
    const result = expectFailure(parseMavlink(new Uint8Array([0xfe, 0x04, 0x01])));
    expect(result.error.code).toBe('truncated-frame');
    expect(result.recoverable).toBe(true);
  });

  it('v1 payload/checksum için yer yoksa SOFT hata basar, header yine gösterilir', () => {
    const bytes = new Uint8Array([0xfe, 0x04, 0x01, 0x01, 0x01, 0x00, 0xaa, 0xbb]);
    const { frame } = expectSuccess(parseMavlink(bytes));

    expect(frame.valid).toBe(false);
    expect(frame.errors[0]?.code).toBe('truncated-frame');
    expect(fieldById(frame, 'seq').rawValue).toBe(0x01);
    expect(fieldIds(frame)).not.toContain('payload');
    expect(fieldIds(frame)).not.toContain('checksum');
  });

  it('v2 header 10 baytın altındaysa HARD FAIL', () => {
    const result = expectFailure(parseMavlink(new Uint8Array([0xfd, 0x00, 0x00])));
    expect(result.error.code).toBe('truncated-frame');
    expect(result.recoverable).toBe(true);
  });
});

describe('parseMavlink — tanınmayan magic (savunma katmanı)', () => {
  it('canParse eler ama doğrudan çağrı start-delimiter-not-found basar', () => {
    const result = expectFailure(parseMavlink(new Uint8Array([0x00, 0x01, 0x02, 0x03])));
    expect(result.error.code).toBe('start-delimiter-not-found');
    expect(result.recoverable).toBe(true);
  });
});

describe('mavlinkParser.canParse', () => {
  it('v1/v2 magic baytını ve versiyona göre asgari uzunluğu kontrol eder', () => {
    expect(mavlinkParser.canParse(V1_HEARTBEAT_FRAME)).toBe(true);
    expect(mavlinkParser.canParse(V2_UNSIGNED_FRAME)).toBe(true);
    expect(mavlinkParser.canParse(new Uint8Array([0xfe, 0x00]))).toBe(false); // 8'in altında
    expect(mavlinkParser.canParse(new Uint8Array([0xfd, 0x00, 0x00]))).toBe(false); // 12'nin altında
    expect(mavlinkParser.canParse(new Uint8Array([0x00, 0x00, 0x00, 0x00, 0x00]))).toBe(false);
    expect(mavlinkParser.canParse(new Uint8Array())).toBe(false);
  });
});

describe('mavlinkPlugin', () => {
  it('protocolId ve registry anahtarı birebir aynı: mavlink', () => {
    expect(mavlinkPlugin.id).toBe('mavlink');
    expect(mavlinkPlugin.parser?.protocolId).toBe('mavlink');
    expect(mavlinkPlugin.category).toBe('aerospace-uav');
  });

  it('örnek çerçevelerin her biri beklenen valid/invalid örüntüsünü üretir', () => {
    expect(mavlinkPlugin.exampleFrames.length).toBeGreaterThan(0);
    for (const example of mavlinkPlugin.exampleFrames) {
      const result = parseMavlink(example.bytes);
      expect(result.success, example.id).toBe(true);
      if (result.success) {
        expect(result.frame.valid, example.id).toBe(example.expectedValid);
      }
    }
  });

  it('hiçbir örnek çerçeve checksum-mismatch üretmez (bu motorda hiç kullanılmayan kod)', () => {
    for (const example of mavlinkPlugin.exampleFrames) {
      const result = parseMavlink(example.bytes);
      if (result.success) {
        expect(
          result.frame.errors.some((error) => error.code === 'checksum-mismatch'),
          example.id,
        ).toBe(false);
      }
    }
  });
});
