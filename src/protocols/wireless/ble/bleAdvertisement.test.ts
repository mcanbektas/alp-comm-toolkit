import { describe, expect, it } from 'vitest';

import { bleAdvertisementParser, bleAdvertisementPlugin, parseBleAdvertisement } from './bleAdvertisement';
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

const TEST_ADV_A = [0x01, 0x02, 0x03, 0x04, 0x05, 0x06];

function headerByte0(
  pduType: number,
  options: { rfu?: number; chSel?: number; txAdd?: number; rxAdd?: number } = {},
): number {
  const rfu = options.rfu ?? 0;
  const chSel = options.chSel ?? 0;
  const txAdd = options.txAdd ?? 0;
  const rxAdd = options.rxAdd ?? 0;
  return (pduType & 0x0f) | ((rfu & 1) << 4) | ((chSel & 1) << 5) | ((txAdd & 1) << 6) | ((rxAdd & 1) << 7);
}

function advertisingFrame(
  pduType: number,
  payload: readonly number[],
  options?: { rfu?: number; chSel?: number; txAdd?: number; rxAdd?: number; declaredLength?: number },
): Uint8Array {
  const declaredLength = options?.declaredLength ?? payload.length;
  return Uint8Array.from([headerByte0(pduType, options), declaredLength, ...payload]);
}

function adStructure(type: number, data: readonly number[]): number[] {
  return [1 + data.length, type, ...data];
}

describe('plugin kaydı', () => {
  it('kimlik/kategori/parser bağı katalogla eşleşir', () => {
    expect(bleAdvertisementPlugin.id).toBe('ble-advertisement');
    expect(bleAdvertisementPlugin.category).toBe('wireless-iot');
    expect(bleAdvertisementPlugin.parser?.protocolId).toBe('ble-advertisement');
    expect(bleAdvertisementPlugin.exampleFrames.length).toBeGreaterThan(0);
  });

  it('her örnek çerçeve çözülür ve expectedValid ile eşleşir', () => {
    for (const example of bleAdvertisementPlugin.exampleFrames) {
      const result = bleAdvertisementParser.parse(example.bytes);
      if (!result.success) {
        throw new Error(`example "${example.id}" failed: ${result.error.code}`);
      }
      expect(result.frame.valid, `example "${example.id}"`).toBe(example.expectedValid ?? true);
    }
  });

  it('her örnek adı/açıklaması protocol.bleAdvertisement. önekli çeviri anahtarıdır', () => {
    for (const example of bleAdvertisementPlugin.exampleFrames) {
      expect(example.name.startsWith('protocol.bleAdvertisement.'), example.id).toBe(true);
    }
  });
});

describe('PDU Header', () => {
  it('PDU Type/RFU/TxAdd/RxAdd bit alanlarını ayrıştırır (ADV_IND)', () => {
    const frame = expectSuccess(
      parseBleAdvertisement(advertisingFrame(0x00, [...TEST_ADV_A], { txAdd: 1, rxAdd: 0 })),
    ).frame;
    expect(fieldById(frame, 'pdu-type').rawValue).toBe(0x00);
    expect(fieldById(frame, 'pdu-type').physicalValue).toBe('ADV_IND');
    expect(fieldById(frame, 'tx-add').physicalValue).toBe('Random');
    expect(fieldById(frame, 'rx-add').physicalValue).toBe('Public');
  });

  it('tüm legacy PDU Type kodlarını adlandırır', () => {
    const names: Record<number, string> = {
      0x00: 'ADV_IND',
      0x01: 'ADV_DIRECT_IND',
      0x02: 'ADV_NONCONN_IND',
      0x03: 'SCAN_REQ',
      0x04: 'SCAN_RSP',
      0x05: 'CONNECT_IND',
      0x06: 'ADV_SCAN_IND',
      0x07: 'ADV_EXT_IND',
    };
    for (const [code, name] of Object.entries(names)) {
      const frame = expectSuccess(parseBleAdvertisement(advertisingFrame(Number(code), []))).frame;
      expect(fieldById(frame, 'pdu-type').physicalValue, name).toBe(name);
    }
  });

  it('bilinmeyen PDU Type adlandırılamaz ama çerçeve valid kalır (yalnız uyarı)', () => {
    const frame = expectSuccess(parseBleAdvertisement(advertisingFrame(0x0f, []))).frame;
    const pduTypeField = fieldById(frame, 'pdu-type');
    expect(pduTypeField.valid).toBe(false);
    expect(pduTypeField.physicalValue).toBeUndefined();
    expect(warningCodes(frame)).toContain('protocol.bleAdvertisement.warning.unknownPduType');
    expect(frame.valid).toBe(true);
  });

  it('ChSel yalnız ADV_IND’de yorumlanır, diğer PDU tiplerinde ham kalır', () => {
    const advIndFrame = expectSuccess(
      parseBleAdvertisement(advertisingFrame(0x00, [...TEST_ADV_A], { chSel: 1 })),
    ).frame;
    expect(fieldById(advIndFrame, 'ch-sel').physicalValue).toBe('Algorithm #2');

    const scanReqFrame = expectSuccess(
      parseBleAdvertisement(advertisingFrame(0x03, [...TEST_ADV_A, ...TEST_ADV_A], { chSel: 1 })),
    ).frame;
    expect(fieldById(scanReqFrame, 'ch-sel').physicalValue).toBeUndefined();
    expect(fieldById(scanReqFrame, 'ch-sel').rawValue).toBe(1);
  });

  it('Length header’ı gerçek kalan bayt sayısıyla tutarsızsa uyarır', () => {
    const frame = expectSuccess(
      parseBleAdvertisement(advertisingFrame(0x00, [...TEST_ADV_A], { declaredLength: 99 })),
    ).frame;
    expect(warningCodes(frame)).toContain('protocol.bleAdvertisement.warning.lengthMismatch');
  });
});

describe('AdvA', () => {
  it('wire little-endian; ekranda geleneksel MAC gösterimiyle TERS sırada yazılır', () => {
    const frame = expectSuccess(parseBleAdvertisement(advertisingFrame(0x00, [...TEST_ADV_A]))).frame;
    expect(fieldById(frame, 'adv-a').rawValue).toBe('06:05:04:03:02:01');
  });

  it('TxAdd Random ise AdvA da Random etiketlenir', () => {
    const frame = expectSuccess(
      parseBleAdvertisement(advertisingFrame(0x00, [...TEST_ADV_A], { txAdd: 1 })),
    ).frame;
    expect(fieldById(frame, 'adv-a').physicalValue).toBe('Random');
  });
});

describe('AD Structure zinciri', () => {
  it('Length, AD Type baytını KAPSAR (data = length-1)', () => {
    const frame = expectSuccess(
      parseBleAdvertisement(advertisingFrame(0x00, [...TEST_ADV_A, ...adStructure(0x01, [0x06])])),
    ).frame;
    const adField = fieldById(frame, 'ad-1');
    expect(adField.rawBytes).toEqual(Uint8Array.from([0x02, 0x01, 0x06]));
    expect(adField.length).toBe(3);
  });

  it('birden fazla AD Structure’ı sırayla çözer', () => {
    const frame = expectSuccess(
      parseBleAdvertisement(
        advertisingFrame(0x00, [
          ...TEST_ADV_A,
          ...adStructure(0x01, [0x06]),
          ...adStructure(0x09, [0x41, 0x42]),
        ]),
      ),
    ).frame;
    expect(fieldById(frame, 'ad-1').name).toContain('Flags');
    expect(fieldById(frame, 'ad-2').name).toContain('Complete Local Name');
    expect(fieldById(frame, 'ad-2').physicalValue).toBe('AB');
  });

  it('AD Length=0 çerçeveyi geçersiz kılar (errors dizisinde value-out-of-range)', () => {
    const frame = expectSuccess(
      parseBleAdvertisement(Uint8Array.from(advertisingFrame(0x00, [...TEST_ADV_A, 0x00]))),
    ).frame;
    expect(frame.valid).toBe(false);
    expect(frame.errors.map((error) => error.code)).toContain('value-out-of-range');
  });

  it('taşan AD Structure Length’i truncated-frame ile işaretler', () => {
    const frame = expectSuccess(
      parseBleAdvertisement(advertisingFrame(0x00, [...TEST_ADV_A, 0x05, 0xff, 0x4c, 0x00])),
    ).frame;
    expect(frame.valid).toBe(false);
    const truncationError = frame.errors.find((error) => error.code === 'truncated-frame');
    expect(truncationError?.details).toMatchObject({ declaredLength: 5 });
  });
});

describe('AD Type — dar küme', () => {
  it('Flags bit panelini isimlendirir', () => {
    const frame = expectSuccess(
      parseBleAdvertisement(advertisingFrame(0x00, [...TEST_ADV_A, ...adStructure(0x01, [0x07])])),
    ).frame;
    expect(fieldById(frame, 'ad-1').physicalValue).toBe(
      'LE Limited Discoverable Mode, LE General Discoverable Mode, BR/EDR Not Supported',
    );
  });

  it('Complete/Shortened Local Name ASCII çözer', () => {
    const bytes = [0x53, 0x65, 0x6e, 0x73, 0x6f, 0x72, 0x30, 0x31]; // "Sensor01"
    const frame = expectSuccess(
      parseBleAdvertisement(advertisingFrame(0x00, [...TEST_ADV_A, ...adStructure(0x09, bytes)])),
    ).frame;
    expect(fieldById(frame, 'ad-1').physicalValue).toBe('Sensor01');
  });

  it('16-bit Service UUID listesini LE olarak çözer', () => {
    const frame = expectSuccess(
      parseBleAdvertisement(
        advertisingFrame(0x00, [...TEST_ADV_A, ...adStructure(0x03, [0x0d, 0x18, 0x0f, 0x18])]),
      ),
    ).frame;
    expect(fieldById(frame, 'ad-1').physicalValue).toBe('0x180D, 0x180F');
  });

  it('128-bit Service UUID’yi standart tire gösterimine çevirir (wire LE → gösterim TERS)', () => {
    const wireBytes = Array.from({ length: 16 }, (_, index) => index);
    const frame = expectSuccess(
      parseBleAdvertisement(advertisingFrame(0x00, [...TEST_ADV_A, ...adStructure(0x07, wireBytes)])),
    ).frame;
    expect(fieldById(frame, 'ad-1').physicalValue).toBe('0f0e0d0c-0b0a-0908-0706-050403020100');
  });

  it('Service Data — 16-bit UUID’yi ayırır', () => {
    const frame = expectSuccess(
      parseBleAdvertisement(
        advertisingFrame(0x00, [...TEST_ADV_A, ...adStructure(0x16, [0x0d, 0x18, 0xaa, 0xbb, 0xcc])]),
      ),
    ).frame;
    expect(fieldById(frame, 'ad-1').physicalValue).toBe('0x180D (3B)');
  });

  it('Manufacturer Specific — bilinen Company ID’yi isimlendirir (Apple)', () => {
    const frame = expectSuccess(
      parseBleAdvertisement(
        advertisingFrame(0x00, [...TEST_ADV_A, ...adStructure(0xff, [0x4c, 0x00, 0x01, 0x02])]),
      ),
    ).frame;
    expect(fieldById(frame, 'ad-1').physicalValue).toBe('Apple, Inc.');
  });

  it('Manufacturer Specific — bilinmeyen Company ID ham hex gösterilir', () => {
    const frame = expectSuccess(
      parseBleAdvertisement(advertisingFrame(0x00, [...TEST_ADV_A, ...adStructure(0xff, [0x34, 0x12])])),
    ).frame;
    expect(fieldById(frame, 'ad-1').physicalValue).toBe('0x1234');
  });

  it('Tx Power Level işaretli sayı olarak çözer (negatif dBm)', () => {
    const frame = expectSuccess(
      parseBleAdvertisement(advertisingFrame(0x00, [...TEST_ADV_A, ...adStructure(0x0a, [0xf6])])),
    ).frame;
    expect(fieldById(frame, 'ad-1').physicalValue).toBe('-10 dBm');
  });

  it('dar küme dışı AD Type ham + tip numarasıyla, uyarıyla gösterilir', () => {
    const frame = expectSuccess(
      parseBleAdvertisement(advertisingFrame(0x00, [...TEST_ADV_A, ...adStructure(0x99, [0x01, 0x02])])),
    ).frame;
    const adField = fieldById(frame, 'ad-1');
    expect(adField.name).toContain('Unknown (0x99)');
    expect(adField.warnings).toContain('protocol.bleAdvertisement.warning.unknownAdType');
  });
});

describe('PDU tipine göre payload şeması', () => {
  it('AD taşımayan PDU tipinde (SCAN_REQ) payload ham + uyarıyla bırakılır', () => {
    const frame = expectSuccess(
      parseBleAdvertisement(advertisingFrame(0x03, [...TEST_ADV_A, ...TEST_ADV_A])),
    ).frame;
    expect(hasField(frame, 'adv-a')).toBe(false);
    expect(hasField(frame, 'ad-1')).toBe(false);
    expect(fieldById(frame, 'payload').rawBytes).toEqual(Uint8Array.from([...TEST_ADV_A, ...TEST_ADV_A]));
    expect(warningCodes(frame)).toContain('protocol.bleAdvertisement.warning.payloadSchemaNotDecoded');
  });

  it('CONNECT_IND payload şeması da çözülmez (ham)', () => {
    const frame = expectSuccess(
      parseBleAdvertisement(advertisingFrame(0x05, [...TEST_ADV_A, ...TEST_ADV_A, 1, 2, 3])),
    ).frame;
    expect(hasField(frame, 'adv-a')).toBe(false);
    expect(fieldById(frame, 'payload').length).toBe(15);
  });
});

describe('canParse', () => {
  it('Length alanı gerçek kalan bayt sayısıyla eşleşiyorsa true döner', () => {
    expect(bleAdvertisementParser.canParse(advertisingFrame(0x00, [...TEST_ADV_A]))).toBe(true);
  });

  it('Length alanı tutarsızsa false döner', () => {
    expect(
      bleAdvertisementParser.canParse(advertisingFrame(0x00, [...TEST_ADV_A], { declaredLength: 99 })),
    ).toBe(false);
  });

  it('2 bayttan kısa veri için false döner', () => {
    expect(bleAdvertisementParser.canParse(Uint8Array.from([0x00]))).toBe(false);
  });
});

describe('hata yolları', () => {
  it('2 bayttan kısa çerçeve truncated-frame ile reddedilir', () => {
    const result = expectFailure(bleAdvertisementParser.parse(Uint8Array.from([0x00])));
    expect(result.error.code).toBe('truncated-frame');
    expect(result.recoverable).toBe(true);
  });

  it('maxFrameLength aşımı frame-too-long ile reddedilir', () => {
    const result = expectFailure(
      bleAdvertisementParser.parse(advertisingFrame(0x00, [...TEST_ADV_A]), { maxFrameLength: 4 }),
    );
    expect(result.error.code).toBe('frame-too-long');
  });

  it('iptal edilmiş sinyal parser-timeout ile reddedilir', () => {
    const controller = new AbortController();
    controller.abort();
    const result = expectFailure(
      bleAdvertisementParser.parse(advertisingFrame(0x00, [...TEST_ADV_A]), { signal: controller.signal }),
    );
    expect(result.error.code).toBe('parser-timeout');
  });

  it('payload AdvA için yetersizse truncated-frame basar', () => {
    const frame = expectSuccess(parseBleAdvertisement(advertisingFrame(0x00, [0x01, 0x02]))).frame;
    expect(frame.valid).toBe(false);
    expect(frame.errors[0]?.code).toBe('truncated-frame');
  });
});
