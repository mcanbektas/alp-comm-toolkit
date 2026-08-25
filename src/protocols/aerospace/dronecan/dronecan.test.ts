import { describe, expect, it } from 'vitest';

import {
  decodeDroneCanIdentity,
  decodeDroneCanTailByte,
  droneCanParser,
  droneCanPlugin,
  parseDroneCan,
} from './dronecan';
import { buildCanClassicFrame } from '../../automotive/can/canClassic';
import { CAN_FD_FRAME_LENGTH } from '../../automotive/can/canFrame';
import { isParseSuccess } from '@/protocol-core/types';
import type { ParsedField, ProtocolWarning } from '@/protocol-core/types';

function fieldById(fields: readonly ParsedField[], id: string): ParsedField | undefined {
  return fields.find((field) => field.id === id);
}

function hasWarning(warnings: readonly ProtocolWarning[], code: string): boolean {
  return warnings.some((warning) => warning.code === code);
}

describe('decodeDroneCanIdentity — sıra: önce SNM, sonra source node id', () => {
  it('SNM=1 → service-request/response, source node id 0 olsa BİLE (sıra bozulmaz)', () => {
    // Spec'e göre service transferinde source node id 1..127 olmalı, ama
    // KOD SIRASI (SNM önce) burada sınanıyor: source=0 olsa bile SNM=1
    // servis dalına girer, anonim mesaja SAPMAZ.
    const id = (0x1 << 7) >>> 0; // yalnız SNM biti set, request-not-response=0 (response)
    const identity = decodeDroneCanIdentity(id);
    expect(identity.kind).toBe('service-response');
  });

  it('SNM=0 ve source node id=0 → anonymous-message', () => {
    const identity = decodeDroneCanIdentity(0);
    expect(identity.kind).toBe('anonymous-message');
  });

  it('SNM=0 ve source node id=1..127 → message-broadcast', () => {
    const identity = decodeDroneCanIdentity(1);
    expect(identity.kind).toBe('message-broadcast');
  });

  it('message broadcast alanlarını doğru ayırır (priority/messageTypeId/sourceNodeId)', () => {
    const id = ((20 & 0x1f) << 24) | ((1000 & 0xffff) << 8) | (42 & 0x7f);
    const identity = decodeDroneCanIdentity(id >>> 0);
    expect(identity.kind).toBe('message-broadcast');
    if (identity.kind === 'message-broadcast') {
      expect(identity.priority).toBe(20);
      expect(identity.messageTypeId).toBe(1000);
      expect(identity.sourceNodeId).toBe(42);
    }
  });

  it('anonymous message alanlarını doğru ayırır (discriminator/messageTypeIdLowerBits)', () => {
    const id = ((10 & 0x1f) << 24) | ((0x1234 & 0x3fff) << 10) | ((2 & 0x3) << 8);
    const identity = decodeDroneCanIdentity(id >>> 0);
    expect(identity.kind).toBe('anonymous-message');
    if (identity.kind === 'anonymous-message') {
      expect(identity.priority).toBe(10);
      expect(identity.discriminator).toBe(0x1234);
      expect(identity.messageTypeIdLowerBits).toBe(2);
    }
  });

  it('service alanlarını doğru ayırır (serviceTypeId/destinationNodeId/requestNotResponse)', () => {
    const id =
      ((25 & 0x1f) << 24) |
      ((1 & 0xff) << 16) |
      (1 << 15) |
      ((42 & 0x7f) << 8) |
      (1 << 7) |
      (10 & 0x7f);
    const identity = decodeDroneCanIdentity(id >>> 0);
    expect(identity.kind).toBe('service-request');
    if (identity.kind === 'service-request' || identity.kind === 'service-response') {
      expect(identity.priority).toBe(25);
      expect(identity.serviceTypeId).toBe(1);
      expect(identity.destinationNodeId).toBe(42);
      expect(identity.sourceNodeId).toBe(10);
    }
  });
});

describe('decodeDroneCanTailByte — spec fixture', () => {
  it('0xC5 = 11000101 → SOT=1, EOT=1, Toggle=0, Transfer ID=5 (spec örneği)', () => {
    const tail = decodeDroneCanTailByte(0xc5);
    expect(tail.startOfTransfer).toBe(true);
    expect(tail.endOfTransfer).toBe(true);
    expect(tail.toggle).toBe(false);
    expect(tail.transferId).toBe(5);
    expect(tail.frameRole).toBe('single-frame');
  });

  it('SOT/EOT kombinasyonlarını doğru sınıflar', () => {
    expect(decodeDroneCanTailByte(0b1000_0000).frameRole).toBe('multi-frame-first');
    expect(decodeDroneCanTailByte(0b0000_0000).frameRole).toBe('multi-frame-middle');
    expect(decodeDroneCanTailByte(0b0100_0000).frameRole).toBe('multi-frame-last');
  });

  it('Transfer ID 31→0 wrap DEĞERİ olarak sorunsuz okunur (uyarı bu katmanda YOK)', () => {
    expect(decodeDroneCanTailByte(0b111_11111).transferId).toBe(31);
    expect(decodeDroneCanTailByte(0b110_00000).transferId).toBe(0);
  });
});

describe('droneCanParser.canParse', () => {
  it('tam 16 bayt + extended + tutarlı single-frame tail byte kabul eder', () => {
    // DLC=2: tail byte 0xC5 gerçekten son bayt konumunda (offset 8+2-1=9).
    const frame = buildCanClassicFrame(0x1403e800 | 42, [0x01, 0xc5], { extended: true });
    expect(droneCanParser.canParse(frame)).toBe(true);
  });

  it('16 bayttan farklı uzunluğu reddeder (CAN FD dahil)', () => {
    expect(droneCanParser.canParse(new Uint8Array(8))).toBe(false);
    expect(droneCanParser.canParse(new Uint8Array(CAN_FD_FRAME_LENGTH))).toBe(false);
  });

  it('extended olmayan (base/11-bit) çerçeveyi reddeder', () => {
    const frame = buildCanClassicFrame(0x123, [0xc5]);
    expect(droneCanParser.canParse(frame)).toBe(false);
  });

  it('DLC 0 ya da 8den büyükse reddeder', () => {
    const zeroDlc = buildCanClassicFrame(0x18000000, [], { extended: true });
    expect(droneCanParser.canParse(zeroDlc)).toBe(false);
  });

  it('single-frame görünüp Toggle=1 olan tutarsız tail byte’ı reddeder', () => {
    // SOT=1,EOT=1,Toggle=1 → spec'e göre imkânsız (single-frame'de Toggle hep 0).
    const inconsistentTail = 0b1110_0101;
    const frame = buildCanClassicFrame(0x18000001, [0x01, inconsistentTail], { extended: true });
    expect(droneCanParser.canParse(frame)).toBe(false);
  });

  /**
   * ÖLÇÜLMÜŞ ders (2026-08-25): ilk sürüm `multi-frame-middle`i (SOT=0,EOT=0)
   * koşulsuz kabul ediyordu ve registry taramasında `isotp`/`j1939`/
   * `devicenet`/`nmea2000`in 12 örneğini yanlış pozitif kabul etti — hepsi bu
   * roldeydi (dosya başı `canParse` yorumu). Middle artık HİÇ kabul edilmez.
   */
  it('multi-frame-middle (SOT=0,EOT=0) HİÇBİR zaman kabul edilmez', () => {
    const middleTail = 0b0000_0011; // SOT=0,EOT=0,Toggle=0,TransferID=3
    const frame = buildCanClassicFrame(0x18000001, [0x01, 0x02, middleTail], { extended: true });
    expect(droneCanParser.canParse(frame)).toBe(false);
  });

  it('multi-frame-first Toggle≠0 ise reddeder (spec: ilk çerçeve hep Toggle=0 ile başlar)', () => {
    const badFirstTail = 0b1010_0000; // SOT=1,EOT=0,Toggle=1
    const frame = buildCanClassicFrame(
      0x18000001,
      [0, 0, 0, 0, 0, 0, 0, badFirstTail], // DLC=8, "filled" kuralı sağlanıyor
      { extended: true },
    );
    expect(droneCanParser.canParse(frame)).toBe(false);
  });

  it('multi-frame-first DLC<8 ise reddeder (spec: son çerçeve hariç "filled/fully utilized")', () => {
    const firstTail = 0b1000_0000; // SOT=1,EOT=0,Toggle=0
    const frame = buildCanClassicFrame(0x18000001, [0, 0, firstTail], { extended: true }); // DLC=3
    expect(droneCanParser.canParse(frame)).toBe(false);
  });

  it('anonim mesaj multi-frame görünürse reddeder (spec: "Multi-frame anonymous messages are not allowed")', () => {
    // SNM=0, Source Node ID=0 → anonymous-message; tail multi-frame-first.
    const firstTail = 0b1000_0000;
    const frame = buildCanClassicFrame(0, [0, 0, 0, 0, 0, 0, 0, firstTail], { extended: true });
    expect(droneCanParser.canParse(frame)).toBe(false);
  });

  it('servis transferinde Source/Destination Node ID=0 ise reddeder (spec Node ID: "zero is reserved")', () => {
    // SNM=1, destinationNodeId=0 (bit 14:8 hepsi sıfır) — spec'e göre geçersiz.
    const canId = (0x1 << 7) >>> 0; // yalnız SNM biti set
    const frame = buildCanClassicFrame(canId, [0xc5], { extended: true });
    expect(droneCanParser.canParse(frame)).toBe(false);
  });

  it('kendi örnek çerçevelerinin hepsini beklendiği gibi sınıflar (multi-frame-middle örneği BİLEREK canParse’i geçmez)', () => {
    const expectedFalse = new Set(['not-extended-rejected', 'multi-frame-middle']);
    for (const example of droneCanPlugin.exampleFrames) {
      const expected = !expectedFalse.has(example.id);
      expect(droneCanParser.canParse(example.bytes), example.id).toBe(expected);
    }
  });
});

describe('droneCanParser.parse — girdi sınırları', () => {
  it('8 bayttan kısa girdi truncated-frame verir, kurtarılabilir', () => {
    const result = droneCanParser.parse(new Uint8Array(4));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('truncated-frame');
      expect(result.recoverable).toBe(true);
    }
  });

  it('tam CAN FD uzunluğu (72 bayt) unsupported-encoding ile AÇIKÇA reddedilir', () => {
    const result = droneCanParser.parse(new Uint8Array(CAN_FD_FRAME_LENGTH));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('unsupported-encoding');
    }
  });

  it('16 baytı aşan (FD olmayan) girdi frame-too-long verir', () => {
    const result = droneCanParser.parse(new Uint8Array(20));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('frame-too-long');
    }
  });

  it('extended olmayan çerçeve value-out-of-range hatası verir ama CAN ID/DLC/Data yine gösterilir', () => {
    const result = droneCanParser.parse(buildCanClassicFrame(0x123, [0xaa, 0xbb]));
    expect(result.success).toBe(true);
    if (isParseSuccess(result)) {
      expect(result.frame.valid).toBe(false);
      expect(result.frame.errors.some((error) => error.code === 'value-out-of-range')).toBe(true);
      expect(fieldById(result.frame.fields, 'can-id')?.physicalValue).toBe('Base / 11-bit');
      expect(fieldById(result.frame.fields, 'data')).toBeDefined();
      // DroneCAN'e özel hiçbir alan (priority/tail byte) ÜRETİLMEZ.
      expect(fieldById(result.frame.fields, 'priority')).toBeUndefined();
      expect(fieldById(result.frame.fields, 'tail-sot')).toBeUndefined();
    }
  });

  it('DLC=0 extended çerçevede tail byte yok → truncated-frame hatası', () => {
    const result = droneCanParser.parse(buildCanClassicFrame(0x18000001, [], { extended: true }));
    expect(result.success).toBe(true);
    if (isParseSuccess(result)) {
      expect(result.frame.valid).toBe(false);
      expect(result.frame.errors.some((error) => error.code === 'truncated-frame')).toBe(true);
    }
  });
});

describe('droneCanParser.parse — üç transfer tipi ayrı ayrı çözülür', () => {
  it('message broadcast: Priority/Message Type ID/Source Node ID alanları ve Transfer Type', () => {
    const example = droneCanPlugin.exampleFrames.find((f) => f.id === 'message-broadcast-single-frame');
    expect(example).toBeDefined();
    const result = droneCanParser.parse(example?.bytes ?? new Uint8Array());
    expect(result.success).toBe(true);
    if (!isParseSuccess(result)) return;

    expect(result.frame.valid).toBe(true);
    expect(fieldById(result.frame.fields, 'priority')?.rawValue).toBe(20);
    expect(fieldById(result.frame.fields, 'message-type-id')?.rawValue).toBe(1000);
    expect(fieldById(result.frame.fields, 'source-node-id')?.rawValue).toBe(42);
    expect(fieldById(result.frame.fields, 'service-not-message')?.physicalValue).toBe('Message');
    expect(fieldById(result.frame.fields, 'transfer-type')?.physicalValue).toBe('Message Broadcast');

    // Spec fixture: tail byte 0xC5 → SOT=1,EOT=1,Toggle=0,TransferID=5.
    expect(fieldById(result.frame.fields, 'tail-sot')?.physicalValue).toBe('Set');
    expect(fieldById(result.frame.fields, 'tail-eot')?.physicalValue).toBe('Set');
    expect(fieldById(result.frame.fields, 'tail-toggle')?.physicalValue).toBe('Not set');
    expect(fieldById(result.frame.fields, 'tail-transfer-id')?.rawValue).toBe(5);
    expect(fieldById(result.frame.fields, 'tail-transfer-id')?.unit).toBeUndefined();

    // Single-frame'de transfer CRC alanı YOK (spec: yalnız multi-frame'de var).
    expect(fieldById(result.frame.fields, 'transfer-crc')).toBeUndefined();
    expect(fieldById(result.frame.fields, 'data')?.rawBytes).toEqual(new Uint8Array([0x01, 0x02, 0x03]));
    expect(hasWarning(result.frame.warnings, 'protocol.dronecan.warning.dsdlRequiredForPayload')).toBe(true);
  });

  it('anonymous message: Discriminator/Message Type ID Lower Bits, Source Node ID=0', () => {
    const example = droneCanPlugin.exampleFrames.find((f) => f.id === 'anonymous-message-single-frame');
    const result = droneCanParser.parse(example?.bytes ?? new Uint8Array());
    expect(result.success).toBe(true);
    if (!isParseSuccess(result)) return;

    expect(fieldById(result.frame.fields, 'discriminator')?.rawValue).toBe(0x1234);
    expect(fieldById(result.frame.fields, 'message-type-id-lower')?.rawValue).toBe(2);
    expect(fieldById(result.frame.fields, 'source-node-id')?.rawValue).toBe(0);
    expect(fieldById(result.frame.fields, 'source-node-id')?.physicalValue).toBe('Anonymous');
    expect(fieldById(result.frame.fields, 'transfer-type')?.physicalValue).toBe('Anonymous Message');
  });

  it('service request: Request-Not-Response=Request, Destination/Source Node ID', () => {
    const example = droneCanPlugin.exampleFrames.find((f) => f.id === 'service-request-single-frame');
    const result = droneCanParser.parse(example?.bytes ?? new Uint8Array());
    expect(result.success).toBe(true);
    if (!isParseSuccess(result)) return;

    expect(fieldById(result.frame.fields, 'service-type-id')?.rawValue).toBe(1);
    expect(fieldById(result.frame.fields, 'request-not-response')?.physicalValue).toBe('Request');
    expect(fieldById(result.frame.fields, 'destination-node-id')?.rawValue).toBe(42);
    expect(fieldById(result.frame.fields, 'source-node-id')?.rawValue).toBe(10);
    expect(fieldById(result.frame.fields, 'service-not-message')?.physicalValue).toBe('Service');
    expect(fieldById(result.frame.fields, 'transfer-type')?.physicalValue).toBe('Service Request');
  });

  it('service response: Request-Not-Response=Response', () => {
    const example = droneCanPlugin.exampleFrames.find((f) => f.id === 'service-response-single-frame');
    const result = droneCanParser.parse(example?.bytes ?? new Uint8Array());
    expect(result.success).toBe(true);
    if (!isParseSuccess(result)) return;

    expect(fieldById(result.frame.fields, 'request-not-response')?.physicalValue).toBe('Response');
    expect(fieldById(result.frame.fields, 'transfer-type')?.physicalValue).toBe('Service Response');
  });
});

describe('droneCanParser.parse — multi-frame ve transfer CRC', () => {
  it('multi-frame first: transfer CRC GÖSTERİLİR ve doğrulanmadığı uyarılır', () => {
    const example = droneCanPlugin.exampleFrames.find((f) => f.id === 'multi-frame-first');
    const result = droneCanParser.parse(example?.bytes ?? new Uint8Array());
    expect(result.success).toBe(true);
    if (!isParseSuccess(result)) return;

    expect(fieldById(result.frame.fields, 'tail-sot')?.physicalValue).toBe('Set');
    expect(fieldById(result.frame.fields, 'tail-eot')?.physicalValue).toBe('Not set');

    const crcField = fieldById(result.frame.fields, 'transfer-crc');
    expect(crcField).toBeDefined();
    expect(crcField?.rawValue).toBe(0x1234);
    expect(crcField?.valid).toBe(true);
    expect(crcField?.warnings).toContain('protocol.dronecan.warning.transferCrcNeedsDataTypeSignature');
    expect(
      hasWarning(result.frame.warnings, 'protocol.dronecan.warning.transferCrcNeedsDataTypeSignature'),
    ).toBe(true);

    expect(fieldById(result.frame.fields, 'data')?.rawBytes).toEqual(
      new Uint8Array([0x11, 0x22, 0x33, 0x44, 0x55]),
    );
  });

  it('multi-frame middle/last: transfer CRC alanı YOK, yalnız Data', () => {
    const middle = droneCanPlugin.exampleFrames.find((f) => f.id === 'multi-frame-middle');
    const middleResult = droneCanParser.parse(middle?.bytes ?? new Uint8Array());
    expect(middleResult.success).toBe(true);
    if (isParseSuccess(middleResult)) {
      expect(fieldById(middleResult.frame.fields, 'transfer-crc')).toBeUndefined();
      expect(fieldById(middleResult.frame.fields, 'tail-toggle')?.physicalValue).toBe('Set');
      expect(fieldById(middleResult.frame.fields, 'data')?.length).toBe(7);
    }

    const last = droneCanPlugin.exampleFrames.find((f) => f.id === 'multi-frame-last');
    const lastResult = droneCanParser.parse(last?.bytes ?? new Uint8Array());
    expect(lastResult.success).toBe(true);
    if (isParseSuccess(lastResult)) {
      expect(fieldById(lastResult.frame.fields, 'transfer-crc')).toBeUndefined();
      expect(fieldById(lastResult.frame.fields, 'tail-eot')?.physicalValue).toBe('Set');
    }
  });

  it('single-frame görünüp Toggle=1 olan çerçeve parse() ile ÇÖKMEZ, alan uyarılır (canParse zaten eler)', () => {
    const inconsistentTail = 0b1110_0101; // SOT=1,EOT=1,Toggle=1
    const data = buildCanClassicFrame(0x18000001, [0x01, inconsistentTail], { extended: true });
    const result = droneCanParser.parse(data);
    expect(result.success).toBe(true);
    if (isParseSuccess(result)) {
      const toggleField = fieldById(result.frame.fields, 'tail-toggle');
      expect(toggleField?.valid).toBe(false);
      expect(toggleField?.warnings).toContain('protocol.dronecan.warning.unexpectedToggleOnSingleFrame');
    }
  });
});

describe('droneCanPlugin', () => {
  it('örnek çerçevelerin hepsi expectedValid ile eşleşir', () => {
    for (const example of droneCanPlugin.exampleFrames) {
      const result = droneCanParser.parse(example.bytes);
      expect(result.success, `${example.id} parse etmedi`).toBe(true);
      if (isParseSuccess(result)) {
        expect(result.frame.valid, example.id).toBe(example.expectedValid ?? true);
      }
    }
  });

  it('decodeOptions AÇILMAZ (brief kararı)', () => {
    expect(droneCanPlugin.decodeOptions).toBeUndefined();
  });

  it('parseDroneCan kısayolu context’siz de çalışır', () => {
    const result = parseDroneCan(droneCanPlugin.exampleFrames[0]?.bytes ?? new Uint8Array());
    expect(result.success).toBe(true);
  });
});
