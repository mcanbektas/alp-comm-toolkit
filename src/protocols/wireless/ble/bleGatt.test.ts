import { describe, expect, it } from 'vitest';

import { bleGattParser, bleGattPlugin, decodeCccdValue, parseBleGatt } from './bleGatt';
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

function hasField(frame: ParsedFrame, id: string): boolean {
  return frame.fields.some((field) => field.id === id);
}

function warningCodes(frame: ParsedFrame): string[] {
  return frame.warnings.map((warning) => warning.code);
}

function le16(value: number): number[] {
  return [value & 0xff, (value >> 8) & 0xff];
}

function pdu(opcode: number, body: readonly number[] = []): Uint8Array {
  return Uint8Array.from([opcode, ...body]);
}

describe('plugin kaydı', () => {
  it('kimlik/kategori/parser bağı katalogla eşleşir', () => {
    expect(bleGattPlugin.id).toBe('ble-gatt');
    expect(bleGattPlugin.category).toBe('wireless-iot');
    expect(bleGattPlugin.parser?.protocolId).toBe('ble-gatt');
    expect(bleGattPlugin.exampleFrames.length).toBeGreaterThan(0);
  });

  it('her örnek çerçeve çözülür ve expectedValid ile eşleşir', () => {
    for (const example of bleGattPlugin.exampleFrames) {
      const result = bleGattParser.parse(example.bytes);
      if (!result.success) {
        throw new Error(`example "${example.id}" failed: ${result.error.code}`);
      }
      expect(result.frame.valid, `example "${example.id}"`).toBe(example.expectedValid ?? true);
    }
  });

  it('her örnek adı/açıklaması protocol.bleGatt. önekli çeviri anahtarıdır', () => {
    for (const example of bleGattPlugin.exampleFrames) {
      expect(example.name.startsWith('protocol.bleGatt.'), example.id).toBe(true);
    }
  });
});

describe('Opcode bit alanları', () => {
  it('Method/Command Flag/Authentication Signature Flag ayrıştırılır (Write Request)', () => {
    const frame = expectSuccess(parseBleGatt(pdu(0x12, [...le16(0x0025), 0x01]))).frame;
    expect(fieldById(frame, 'opcode').rawValue).toBe(0x12);
    expect(fieldById(frame, 'opcode').physicalValue).toBe('Write Request');
    expect(fieldById(frame, 'method').rawValue).toBe(0x12);
    expect(fieldById(frame, 'command-flag').rawValue).toBe(0);
    expect(fieldById(frame, 'auth-sig-flag').rawValue).toBe(0);
  });

  it('Write Command (0x52), Write Request ile AYNI Method’u taşır, ayrım Command Flag’tadır', () => {
    const frame = expectSuccess(parseBleGatt(pdu(0x52, [...le16(0x0025), 0x01]))).frame;
    expect(fieldById(frame, 'opcode').physicalValue).toBe('Write Command');
    expect(fieldById(frame, 'method').rawValue).toBe(0x12);
    expect(fieldById(frame, 'command-flag').rawValue).toBe(1);
  });

  it('dar küme dışı opcode adlandırılamaz, gövde ham + uyarıyla gösterilir', () => {
    const frame = expectSuccess(parseBleGatt(pdu(0x06, [0x01, 0x02, 0x03]))).frame;
    const opcodeField = fieldById(frame, 'opcode');
    expect(opcodeField.valid).toBe(false);
    expect(opcodeField.physicalValue).toBeUndefined();
    expect(warningCodes(frame)).toContain('protocol.bleGatt.warning.unknownOpcode');
    expect(fieldById(frame, 'payload').rawBytes).toEqual(Uint8Array.from([0x01, 0x02, 0x03]));
    expect(frame.valid).toBe(true);
  });
});

describe('Error Response', () => {
  it('Request Opcode/Handle/Error Code çözülür', () => {
    const frame = expectSuccess(parseBleGatt(pdu(0x01, [0x0a, ...le16(0x0099), 0x01]))).frame;
    expect(fieldById(frame, 'request-opcode-in-error').physicalValue).toBe('Read Request');
    expect(fieldById(frame, 'attribute-handle-in-error').rawValue).toBe('0x0099');
    expect(fieldById(frame, 'error-code').physicalValue).toBe('Invalid Handle');
  });

  it('bilinmeyen Error Code uyarıyla ham gösterilir', () => {
    const frame = expectSuccess(parseBleGatt(pdu(0x01, [0x0a, ...le16(0x0099), 0xf0]))).frame;
    const errorCodeField = fieldById(frame, 'error-code');
    expect(errorCodeField.valid).toBe(false);
    expect(warningCodes(frame)).toContain('protocol.bleGatt.warning.unknownErrorCode');
  });

  it('5 bayttan kısa Error Response truncated-frame hatası basar', () => {
    const frame = expectSuccess(parseBleGatt(pdu(0x01, [0x0a, ...le16(0x0099)]))).frame;
    expect(frame.valid).toBe(false);
    expect(frame.errors.map((error) => error.code)).toContain('truncated-frame');
  });
});

describe('Exchange MTU', () => {
  it('Request/Response MTU değerini çözer', () => {
    const requestFrame = expectSuccess(parseBleGatt(pdu(0x02, le16(247)))).frame;
    expect(fieldById(requestFrame, 'mtu').rawValue).toBe(247);
    expect(fieldById(requestFrame, 'mtu').name).toBe('Client Rx MTU');

    const responseFrame = expectSuccess(parseBleGatt(pdu(0x03, le16(185)))).frame;
    expect(fieldById(responseFrame, 'mtu').rawValue).toBe(185);
    expect(fieldById(responseFrame, 'mtu').name).toBe('Server Rx MTU');
  });
});

describe('Find Information', () => {
  it('Request Starting/Ending Handle çözer', () => {
    const frame = expectSuccess(parseBleGatt(pdu(0x04, [...le16(0x0001), ...le16(0xffff)]))).frame;
    expect(fieldById(frame, 'starting-handle').rawValue).toBe('0x0001');
    expect(fieldById(frame, 'ending-handle').rawValue).toBe('0xFFFF');
  });

  it('Response Format 0x01 (UUID16) birden fazla girdiyi sırayla çözer', () => {
    const frame = expectSuccess(
      parseBleGatt(pdu(0x05, [0x01, ...le16(0x0002), ...le16(0x2803), ...le16(0x0004), ...le16(0x2a19)])),
    ).frame;
    expect(fieldById(frame, 'format').physicalValue).toBe('UUID 16-bit');
    expect(fieldById(frame, 'entry-1').name).toContain('0x0002');
    expect(fieldById(frame, 'entry-1').physicalValue).toBe('Characteristic');
    expect(fieldById(frame, 'entry-2').physicalValue).toBe('Battery Level');
  });

  it('Response Format 0x02 (UUID128) TERS sırada tire gösterimine çevirir', () => {
    const wireUuid = Array.from({ length: 16 }, (_, index) => index);
    const frame = expectSuccess(parseBleGatt(pdu(0x05, [0x02, ...le16(0x0010), ...wireUuid]))).frame;
    expect(fieldById(frame, 'entry-1').rawValue).toBe('0f0e0d0c-0b0a-0908-0706-050403020100');
  });

  it('bilinmeyen Format ham + uyarıyla gösterilir', () => {
    const frame = expectSuccess(parseBleGatt(pdu(0x05, [0x99, 0x01, 0x02, 0x03]))).frame;
    expect(warningCodes(frame)).toContain('protocol.bleGatt.warning.unknownFormat');
    expect(fieldById(frame, 'information-data').rawBytes).toEqual(Uint8Array.from([0x01, 0x02, 0x03]));
  });

  it('Format 0x01 ile hizasız Information Data truncated-frame basar', () => {
    const frame = expectSuccess(parseBleGatt(pdu(0x05, [0x01, 0x02, 0x03]))).frame;
    expect(frame.valid).toBe(false);
    expect(frame.errors.map((error) => error.code)).toContain('truncated-frame');
  });
});

describe('Read By Type / Read By Group Type — Request', () => {
  it('16-bit Attribute Type UUID çözer', () => {
    const frame = expectSuccess(
      parseBleGatt(pdu(0x08, [...le16(0x0001), ...le16(0xffff), ...le16(0x2803)])),
    ).frame;
    expect(fieldById(frame, 'attribute-type').rawValue).toBe(0x2803);
    expect(fieldById(frame, 'attribute-type').physicalValue).toBe('Characteristic');
  });

  it('128-bit Group Type UUID çözer', () => {
    const wireUuid = Array.from({ length: 16 }, (_, index) => index);
    const frame = expectSuccess(
      parseBleGatt(pdu(0x10, [...le16(0x0001), ...le16(0xffff), ...wireUuid])),
    ).frame;
    expect(fieldById(frame, 'group-type').rawValue).toBe('0f0e0d0c-0b0a-0908-0706-050403020100');
  });

  it('ne 2 ne 16 baytlık UUID value-out-of-range hatası basar', () => {
    const frame = expectSuccess(
      parseBleGatt(pdu(0x08, [...le16(0x0001), ...le16(0xffff), 0x01, 0x02, 0x03])),
    ).frame;
    expect(frame.valid).toBe(false);
    expect(frame.errors.map((error) => error.code)).toContain('value-out-of-range');
  });
});

describe('Read By Type — Response', () => {
  it('sabit Length’e göre birden fazla girdiyi sırayla çözer', () => {
    // Length=3: Handle(2)+Value(1).
    const frame = expectSuccess(
      parseBleGatt(pdu(0x09, [3, ...le16(0x0003), 0x5a, ...le16(0x0005), 0x3c])),
    ).frame;
    expect(fieldById(frame, 'entry-length').rawValue).toBe(3);
    expect(fieldById(frame, 'entry-1').name).toContain('0x0003');
    expect(fieldById(frame, 'entry-1').rawBytes).toEqual(Uint8Array.from([...le16(0x0003), 0x5a]));
    expect(fieldById(frame, 'entry-2').name).toContain('0x0005');
  });

  it('Length 3’ten küçükse geçersiz sayılır (Handle + en az 1 bayt değer gerekir)', () => {
    const frame = expectSuccess(parseBleGatt(pdu(0x09, [2, ...le16(0x0003)]))).frame;
    expect(warningCodes(frame)).toContain('protocol.bleGatt.warning.invalidEntryLength');
  });

  it('taşan son girdi truncated-frame ile işaretlenir', () => {
    const frame = expectSuccess(parseBleGatt(pdu(0x09, [3, ...le16(0x0003), 0x5a, 0x00]))).frame;
    expect(frame.valid).toBe(false);
    expect(frame.errors.map((error) => error.code)).toContain('truncated-frame');
  });
});

describe('Read By Group Type — Response', () => {
  it('Handle + End Group Handle + Value çözer ("Discover All Primary Services" emsali)', () => {
    // Length=6: Handle(2)+EndGroupHandle(2)+Value(2, UUID16).
    const frame = expectSuccess(
      parseBleGatt(pdu(0x11, [6, ...le16(0x0001), ...le16(0x0007), ...le16(0x1800)])),
    ).frame;
    expect(fieldById(frame, 'entry-1').name).toContain('0x0001');
    expect(fieldById(frame, 'entry-1').name).toContain('0x0007');
  });

  it('Length 4’ten küçükse geçersiz sayılır (iki Handle zorunlu)', () => {
    const frame = expectSuccess(parseBleGatt(pdu(0x11, [3, ...le16(0x0001), 0x00]))).frame;
    expect(warningCodes(frame)).toContain('protocol.bleGatt.warning.invalidEntryLength');
  });
});

describe('Read', () => {
  it('Request Handle çözer', () => {
    const frame = expectSuccess(parseBleGatt(pdu(0x0a, le16(0x002a)))).frame;
    expect(fieldById(frame, 'handle').rawValue).toBe('0x002A');
  });

  it('Response Value’yu ham gösterir (şemasız, dosya başı)', () => {
    const frame = expectSuccess(parseBleGatt(pdu(0x0b, [0x01, 0x02, 0x03]))).frame;
    const valueField = fieldById(frame, 'value');
    expect(valueField.rawBytes).toEqual(Uint8Array.from([0x01, 0x02, 0x03]));
    expect(valueField.physicalValue).toBeUndefined();
  });

  it('Response boş Value’da value alanı hiç eklenmez', () => {
    const frame = expectSuccess(parseBleGatt(pdu(0x0b))).frame;
    expect(hasField(frame, 'value')).toBe(false);
  });
});

describe('Write / Handle Value', () => {
  it('Write Request Handle + Value çözer', () => {
    const frame = expectSuccess(parseBleGatt(pdu(0x12, [...le16(0x002b), 0x01, 0x00]))).frame;
    expect(fieldById(frame, 'handle').rawValue).toBe('0x002B');
    expect(fieldById(frame, 'value').rawBytes).toEqual(Uint8Array.from([0x01, 0x00]));
  });

  it('Write Response’un Opcode dışında alanı yoktur', () => {
    const frame = expectSuccess(parseBleGatt(pdu(0x13))).frame;
    expect(hasField(frame, 'handle')).toBe(false);
    expect(hasField(frame, 'value')).toBe(false);
    expect(frame.valid).toBe(true);
  });

  it('Handle Value Notification/Indication aynı şemayı paylaşır', () => {
    const notification = expectSuccess(parseBleGatt(pdu(0x1b, [...le16(0x0025), 0x64]))).frame;
    const indication = expectSuccess(parseBleGatt(pdu(0x1d, [...le16(0x0025), 0x64]))).frame;
    expect(fieldById(notification, 'value').rawBytes).toEqual(fieldById(indication, 'value').rawBytes);
  });

  it('Handle Value Confirmation’ın Opcode dışında alanı yoktur', () => {
    const frame = expectSuccess(parseBleGatt(pdu(0x1e))).frame;
    expect(hasField(frame, 'handle')).toBe(false);
  });

  it('3 bayttan kısa Write Request truncated-frame hatası basar', () => {
    const frame = expectSuccess(parseBleGatt(pdu(0x12, [0x2b]))).frame;
    expect(frame.valid).toBe(false);
    expect(frame.errors.map((error) => error.code)).toContain('truncated-frame');
  });
});

describe('L2CAP öneki — opsiyonel algılama (karar 2)', () => {
  it('Length TAM eşleşir VE CID==0x0004 ise önek algılanır ve soyulur', () => {
    const attPdu = pdu(0x13);
    const withL2cap = Uint8Array.from([...le16(attPdu.length), ...le16(0x0004), ...attPdu]);
    const frame = expectSuccess(parseBleGatt(withL2cap)).frame;
    expect(fieldById(frame, 'l2cap-header')).toBeDefined();
    expect(fieldById(frame, 'opcode').offset).toBe(4);
    expect(warningCodes(frame)).toContain('protocol.bleGatt.warning.l2capHeaderDetected');
  });

  it('CID 0x0004 değilse önek algılanmaz, çıplak ATT PDU varsayılır', () => {
    const attPdu = pdu(0x13);
    const notL2cap = Uint8Array.from([...le16(attPdu.length), ...le16(0x0005), ...attPdu]);
    const frame = expectSuccess(parseBleGatt(notL2cap)).frame;
    expect(hasField(frame, 'l2cap-header')).toBe(false);
    // Çıplak PDU olarak okununca ilk bayt Length'in alt baytı (attPdu.length=1) olur, opcode 0x13 değildir.
    expect(fieldById(frame, 'opcode').rawValue).toBe(attPdu.length);
  });

  it('Length kalan baytla eşleşmezse önek algılanmaz', () => {
    const attPdu = pdu(0x13);
    const wrongLength = Uint8Array.from([...le16(99), ...le16(0x0004), ...attPdu]);
    const frame = expectSuccess(parseBleGatt(wrongLength)).frame;
    expect(hasField(frame, 'l2cap-header')).toBe(false);
  });
});

describe('decodeCccdValue', () => {
  it('bit0 Notification, bit1 Indication, ikisi birden ve hiçbiri', () => {
    expect(decodeCccdValue(Uint8Array.from([0x00, 0x00]))).toBe('none');
    expect(decodeCccdValue(Uint8Array.from([0x01, 0x00]))).toBe('notification');
    expect(decodeCccdValue(Uint8Array.from([0x02, 0x00]))).toBe('indication');
    expect(decodeCccdValue(Uint8Array.from([0x03, 0x00]))).toBe('notification-and-indication');
  });
});

describe('canParse', () => {
  it('dar kümedeki opcode için true döner', () => {
    expect(bleGattParser.canParse(pdu(0x12, [...le16(0x0025), 0x01]))).toBe(true);
  });

  it('dar küme dışı opcode için false döner', () => {
    expect(bleGattParser.canParse(pdu(0x06, [0x01]))).toBe(false);
  });

  it('boş veri için false döner', () => {
    expect(bleGattParser.canParse(Uint8Array.from([]))).toBe(false);
  });

  it('L2CAP önekinden soyduktan sonra da opcode’a bakar', () => {
    const attPdu = pdu(0x13);
    const withL2cap = Uint8Array.from([...le16(attPdu.length), ...le16(0x0004), ...attPdu]);
    expect(bleGattParser.canParse(withL2cap)).toBe(true);
  });
});

describe('hata yolları', () => {
  it('boş veri truncated-frame ile reddedilir', () => {
    const result = expectFailure(bleGattParser.parse(Uint8Array.from([])));
    expect(result.error.code).toBe('truncated-frame');
    expect(result.recoverable).toBe(true);
  });

  it('maxFrameLength aşımı frame-too-long ile reddedilir', () => {
    const result = expectFailure(bleGattParser.parse(pdu(0x13), { maxFrameLength: 0 }));
    expect(result.error.code).toBe('frame-too-long');
  });

  it('iptal edilmiş sinyal parser-timeout ile reddedilir', () => {
    const controller = new AbortController();
    controller.abort();
    const result = expectFailure(bleGattParser.parse(pdu(0x13), { signal: controller.signal }));
    expect(result.error.code).toBe('parser-timeout');
  });
});
