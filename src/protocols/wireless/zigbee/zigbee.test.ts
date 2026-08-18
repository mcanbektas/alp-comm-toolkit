import { describe, expect, it } from 'vitest';

import { computeNamedCrc } from '@/protocol-core/checksums/crcCatalogue';
import { parseZigbee, zigbeeParser, zigbeePlugin } from './zigbee';
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

function fcsFor(bytesWithoutFcs: readonly number[]): number[] {
  const fcs = computeNamedCrc(Uint8Array.from(bytesWithoutFcs), 'CRC16_KERMIT');
  return [Number(fcs & 0xffn), Number((fcs >> 8n) & 0xffn)];
}

// PAN=0x1234 (LE 34 12), Dest short=0x0000, Src short=0x5678 — testler boyunca sabit adresleme.
function macHeaderBytes(options: { frameType?: number; destAddrMode?: number; srcAddrMode?: number; panIdCompression?: number; frameVersion?: number } = {}): number[] {
  const frameType = options.frameType ?? 0b001; // Data
  const destAddrMode = options.destAddrMode ?? 0b10; // Short
  const srcAddrMode = options.srcAddrMode ?? 0b10; // Short
  const panIdCompression = options.panIdCompression ?? 1;
  const frameVersion = options.frameVersion ?? 0b01; // 2006
  const byte0 = (frameType & 0x07) | (panIdCompression === 1 ? 0x40 : 0);
  const byte1 = ((destAddrMode & 0x03) << 2) | ((frameVersion & 0x03) << 4) | ((srcAddrMode & 0x03) << 6);
  const bytes = [byte0, byte1, 0x01]; // Sequence=1
  const bothPresent = destAddrMode !== 0b00 && srcAddrMode !== 0b00;
  if (destAddrMode !== 0b00) bytes.push(0x34, 0x12); // Destination PAN ID (Dest adres varsa her zaman var)
  if (destAddrMode === 0b10) bytes.push(0x00, 0x00);
  else if (destAddrMode === 0b11) bytes.push(...Array.from({ length: 8 }, (_, i) => i + 1));
  const srcPanPresent = bothPresent ? panIdCompression === 0 : srcAddrMode !== 0b00;
  if (srcPanPresent) bytes.push(0x34, 0x12);
  if (srcAddrMode === 0b10) bytes.push(0x78, 0x56);
  else if (srcAddrMode === 0b11) bytes.push(...Array.from({ length: 8 }, (_, i) => i + 0x11));
  return bytes;
}

function zigbeeFrame(macPayload: readonly number[], macOptions: Parameters<typeof macHeaderBytes>[0] = {}): Uint8Array {
  const withoutFcs = [...macHeaderBytes(macOptions), ...macPayload];
  return Uint8Array.from([...withoutFcs, ...fcsFor(withoutFcs)]);
}

function nwkHeaderBytes(options: { frameType?: number; security?: number } = {}): number[] {
  const frameType = options.frameType ?? 0b00; // Data
  const security = options.security ?? 0;
  const byte0 = frameType & 0x03;
  const byte1 = security === 1 ? 0x02 : 0x00;
  return [byte0, byte1, 0x00, 0x00, 0x78, 0x56, 0x0a, 0x34]; // Dest=0x0000 Src=0x5678 Radius=10 Seq=52
}

function apsHeaderBytes(options: { frameType?: number; deliveryMode?: number; security?: number; extHeader?: number; clusterId?: number; profileId?: number } = {}): number[] {
  const frameType = options.frameType ?? 0b00;
  const deliveryMode = options.deliveryMode ?? 0b00;
  const security = options.security ?? 0;
  const extHeader = options.extHeader ?? 0;
  const clusterId = options.clusterId ?? 0x0402;
  const profileId = options.profileId ?? 0x0104;
  const fcf = (frameType & 0x03) | ((deliveryMode & 0x03) << 2) | (security === 1 ? 0x20 : 0) | (extHeader === 1 ? 0x80 : 0);
  return [fcf, 1, clusterId & 0xff, (clusterId >> 8) & 0xff, profileId & 0xff, (profileId >> 8) & 0xff, 1, 0x11];
}

function zclReportAttrInt16(attrId: number, value: number, tsn = 1): number[] {
  const unsigned = value < 0 ? value + 0x10000 : value;
  return [0x18, tsn, 0x0a, attrId & 0xff, (attrId >> 8) & 0xff, 0x29, unsigned & 0xff, (unsigned >> 8) & 0xff];
}

describe('plugin kaydı', () => {
  it('kimlik/kategori/parser bağı katalogla eşleşir', () => {
    expect(zigbeePlugin.id).toBe('zigbee');
    expect(zigbeePlugin.category).toBe('wireless-iot');
    expect(zigbeePlugin.parser?.protocolId).toBe('zigbee');
    expect(zigbeePlugin.exampleFrames.length).toBeGreaterThan(0);
  });

  it('her örnek çerçeve çözülür ve expectedValid ile eşleşir', () => {
    for (const example of zigbeePlugin.exampleFrames) {
      const result = zigbeeParser.parse(example.bytes);
      if (!result.success) {
        throw new Error(`example "${example.id}" failed: ${result.error.code}`);
      }
      expect(result.frame.valid, `example "${example.id}"`).toBe(example.expectedValid ?? true);
    }
  });

  it('her örnek adı/açıklaması protocol.zigbee. önekli çeviri anahtarıdır', () => {
    for (const example of zigbeePlugin.exampleFrames) {
      expect(example.name.startsWith('protocol.zigbee.'), example.id).toBe(true);
    }
  });
});

describe('802.15.4 MAC — Frame Control', () => {
  it('Frame Type/Frame Version/Addressing Mode alanlarını LSB-first ayrıştırır', () => {
    const frame = expectSuccess(parseZigbee(zigbeeFrame([...nwkHeaderBytes(), ...apsHeaderBytes()]))).frame;
    expect(fieldById(frame, 'mac-frame-type').physicalValue).toBe('Data');
    expect(fieldById(frame, 'mac-frame-version').physicalValue).toBe('IEEE 802.15.4-2006');
    expect(fieldById(frame, 'mac-dest-addr-mode').physicalValue).toBe('16-bit short address');
    expect(fieldById(frame, 'mac-src-addr-mode').physicalValue).toBe('16-bit short address');
  });

  it('desteklenmeyen Frame Version (2015+) uyarır, adresleme çözülmez', () => {
    const frame = expectSuccess(parseZigbee(zigbeeFrame([0xaa, 0xbb, 0xcc], { frameVersion: 0b10 }))).frame;
    expect(warningCodes(frame)).toContain('protocol.zigbee.warning.frameVersionUnsupported');
    expect(hasField(frame, 'mac-dest-pan')).toBe(false);
  });

  it('PAN ID Compression=1: hem dest hem src adres varsa Source PAN ID atlanır', () => {
    const frame = expectSuccess(
      parseZigbee(zigbeeFrame([...nwkHeaderBytes(), ...apsHeaderBytes()], { panIdCompression: 1 })),
    ).frame;
    expect(hasField(frame, 'mac-dest-pan')).toBe(true);
    expect(hasField(frame, 'mac-src-pan')).toBe(false);
  });

  it('PAN ID Compression=0: hem dest hem src adres varsa İKİ PAN ID de bulunur', () => {
    const frame = expectSuccess(
      parseZigbee(zigbeeFrame([...nwkHeaderBytes(), ...apsHeaderBytes()], { panIdCompression: 0 })),
    ).frame;
    expect(hasField(frame, 'mac-dest-pan')).toBe(true);
    expect(hasField(frame, 'mac-src-pan')).toBe(true);
    expect(fieldById(frame, 'mac-dest-pan').rawValue).toBe('0x1234');
    expect(fieldById(frame, 'mac-src-pan').rawValue).toBe('0x1234');
  });

  it('64-bit Extended adresleri ekranda TERS/ayraçlı gösterir', () => {
    const frame = expectSuccess(
      parseZigbee(
        zigbeeFrame([...nwkHeaderBytes(), ...apsHeaderBytes()], {
          destAddrMode: 0b11,
          srcAddrMode: 0b11,
          panIdCompression: 1,
        }),
      ),
    ).frame;
    // destAddrMode=11 → bytes [1,2,3,4,5,6,7,8] eklenir (macHeaderBytes), reverse → 08:07:...:01.
    expect(fieldById(frame, 'mac-dest-addr').rawValue).toBe('08:07:06:05:04:03:02:01');
  });
});

describe('802.15.4 MAC — FCS', () => {
  it('doğru FCS için PASS + valid çerçeve', () => {
    const frame = expectSuccess(parseZigbee(zigbeeFrame([...nwkHeaderBytes(), ...apsHeaderBytes()]))).frame;
    expect(fieldById(frame, 'mac-fcs').physicalValue).toBe('PASS');
    expect(frame.valid).toBe(true);
  });

  it('bozuk FCS için FAIL + crc-mismatch hatası, çerçeve geçersiz', () => {
    const bytes = zigbeeFrame([...nwkHeaderBytes(), ...apsHeaderBytes()]);
    const corrupted = bytes.slice();
    corrupted[corrupted.length - 1] = (corrupted[corrupted.length - 1] as number) ^ 0xff;
    const frame = expectSuccess(parseZigbee(corrupted)).frame;
    expect(fieldById(frame, 'mac-fcs').physicalValue).toBe('FAIL');
    expect(frame.valid).toBe(false);
    expect(frame.errors.map((error) => error.code)).toContain('crc-mismatch');
  });
});

describe('MAC → NWK → APS → ZCL zinciri', () => {
  it('yalnız Data frame payload NWK’ya geçer', () => {
    const dataFrame = expectSuccess(parseZigbee(zigbeeFrame([...nwkHeaderBytes(), ...apsHeaderBytes()]))).frame;
    expect(hasField(dataFrame, 'nwk-frame-type')).toBe(true);

    const ackFrame = expectSuccess(parseZigbee(zigbeeFrame([0xaa], { frameType: 0b010 }))).frame;
    expect(hasField(ackFrame, 'nwk-frame-type')).toBe(false);
    expect(hasField(ackFrame, 'mac-payload')).toBe(true);
    expect(warningCodes(ackFrame)).toContain('protocol.zigbee.warning.nonDataFrame');
  });

  it('NWK Security=1: payload "Encrypted NWK payload" ham gösterilir, APS’e geçilmez', () => {
    const frame = expectSuccess(
      parseZigbee(zigbeeFrame([...nwkHeaderBytes({ security: 1 }), 0xaa, 0xbb, 0xcc, 0xdd])),
    ).frame;
    expect(hasField(frame, 'aps-frame-type')).toBe(false);
    expect(fieldById(frame, 'nwk-payload').name).toContain('encrypted');
    expect(warningCodes(frame)).toContain('protocol.zigbee.warning.nwkEncrypted');
  });

  it('NWK Frame Type ≠ Data: payload ham gösterilir, APS’e geçilmez', () => {
    const frame = expectSuccess(
      parseZigbee(zigbeeFrame([...nwkHeaderBytes({ frameType: 0b01 }), 0xaa, 0xbb])),
    ).frame;
    expect(hasField(frame, 'aps-frame-type')).toBe(false);
    expect(warningCodes(frame)).toContain('protocol.zigbee.warning.nwkNonData');
  });

  it('APS Security=1: payload "encrypted" ham gösterilir, ZCL’e geçilmez', () => {
    const frame = expectSuccess(
      parseZigbee(zigbeeFrame([...nwkHeaderBytes(), ...apsHeaderBytes({ security: 1 }), 0xaa, 0xbb])),
    ).frame;
    expect(hasField(frame, 'zcl-frame-type')).toBe(false);
    expect(fieldById(frame, 'aps-payload').name).toContain('encrypted');
    expect(warningCodes(frame)).toContain('protocol.zigbee.warning.apsEncrypted');
  });

  it('APS Group delivery: dar kapsam dışı, ham + uyarı', () => {
    const frame = expectSuccess(
      parseZigbee(zigbeeFrame([...nwkHeaderBytes(), ...apsHeaderBytes({ deliveryMode: 0b11 }), 0xaa])),
    ).frame;
    expect(hasField(frame, 'aps-cluster-id')).toBe(false);
    expect(warningCodes(frame)).toContain('protocol.zigbee.warning.apsOutOfScope');
  });

  it('APS Extended Header: dar kapsam dışı, ham + uyarı', () => {
    const frame = expectSuccess(
      parseZigbee(zigbeeFrame([...nwkHeaderBytes(), ...apsHeaderBytes({ extHeader: 1 }), 0xaa])),
    ).frame;
    expect(hasField(frame, 'aps-cluster-id')).toBe(false);
    expect(warningCodes(frame)).toContain('protocol.zigbee.warning.apsOutOfScope');
  });

  it('Cluster ID / Profile ID doğru okunur (LE)', () => {
    const frame = expectSuccess(
      parseZigbee(zigbeeFrame([...nwkHeaderBytes(), ...apsHeaderBytes({ clusterId: 0x0402, profileId: 0x0104 })])),
    ).frame;
    expect(fieldById(frame, 'aps-cluster-id').rawValue).toBe('0x0402');
    expect(fieldById(frame, 'aps-profile-id').rawValue).toBe('0x0104');
  });
});

describe('ZCL — dar kapsam', () => {
  it('Report Attributes: Int16 değeri doğru çözer (spec 32931-32957 emsali: raw 29 09 → 2345)', () => {
    const frame = expectSuccess(
      parseZigbee(zigbeeFrame([...nwkHeaderBytes(), ...apsHeaderBytes(), ...zclReportAttrInt16(0x0000, 2345)])),
    ).frame;
    expect(fieldById(frame, 'zcl-command-id').physicalValue).toBe('Report Attributes');
    const attrField = fieldById(frame, 'zcl-attr-1');
    expect(attrField.rawValue).toBe('0x0000');
    expect(attrField.physicalValue).toBe('Signed 16-bit Integer = 2345');
  });

  it('Read Attributes Response: SUCCESS statüsünde değer, hata statüsünde yalnız status çözülür', () => {
    const success = expectSuccess(
      parseZigbee(
        zigbeeFrame([...nwkHeaderBytes(), ...apsHeaderBytes(), 0x18, 1, 0x01, 0x00, 0x00, 0x00, 0x29, 0x29, 0x09]),
      ),
    ).frame;
    expect(fieldById(success, 'zcl-attr-1').physicalValue).toBe('Signed 16-bit Integer = 2345');

    const failure = expectSuccess(
      parseZigbee(zigbeeFrame([...nwkHeaderBytes(), ...apsHeaderBytes(), 0x18, 1, 0x01, 0x00, 0x00, 0x86])),
    ).frame;
    expect(fieldById(failure, 'zcl-attr-1').physicalValue).toBe('Status 0x86');
  });

  it('Default Response: komut id + status çözülür', () => {
    const frame = expectSuccess(
      parseZigbee(zigbeeFrame([...nwkHeaderBytes(), ...apsHeaderBytes(), 0x18, 2, 0x0b, 0x0a, 0x00])),
    ).frame;
    expect(fieldById(frame, 'zcl-response-to-command').rawValue).toBe(0x0a);
    expect(fieldById(frame, 'zcl-status').physicalValue).toBe('SUCCESS');
  });

  it('birden fazla global komut adını doğru tanır', () => {
    const names: Record<number, string> = { 0x00: 'Read Attributes', 0x02: 'Write Attributes', 0x06: 'Configure Reporting' };
    for (const [code, name] of Object.entries(names)) {
      const frame = expectSuccess(
        parseZigbee(zigbeeFrame([...nwkHeaderBytes(), ...apsHeaderBytes(), 0x18, 1, Number(code), 0xaa])),
      ).frame;
      expect(fieldById(frame, 'zcl-command-id').physicalValue, name).toBe(name);
    }
  });

  it('Cluster-specific komut gövdesi (dar kapsam dışı) ham + uyarıyla gösterilir', () => {
    const frame = expectSuccess(
      parseZigbee(zigbeeFrame([...nwkHeaderBytes(), ...apsHeaderBytes(), 0x01, 3, 0x00, 0xaa, 0xbb])),
    ).frame;
    expect(fieldById(frame, 'zcl-frame-type').physicalValue).toBe('Cluster-specific');
    expect(hasField(frame, 'zcl-attr-1')).toBe(false);
    expect(warningCodes(frame)).toContain('protocol.zigbee.warning.zclClusterSpecificNotDecoded');
  });

  it('bilinmeyen data type zincirini durdurur, ham + uyarı bırakır', () => {
    const frame = expectSuccess(
      parseZigbee(
        zigbeeFrame([...nwkHeaderBytes(), ...apsHeaderBytes(), 0x18, 1, 0x0a, 0x00, 0x00, 0xff, 0xaa, 0xbb]),
      ),
    ).frame;
    expect(warningCodes(frame)).toContain('protocol.zigbee.warning.zclUnknownDataType');
  });

  it('diğer global komutların (Write Attributes) gövdesi ham + uyarı ile bırakılır', () => {
    const frame = expectSuccess(
      parseZigbee(zigbeeFrame([...nwkHeaderBytes(), ...apsHeaderBytes(), 0x18, 1, 0x02, 0x00, 0x00, 0x21, 0x05])),
    ).frame;
    expect(warningCodes(frame)).toContain('protocol.zigbee.warning.zclGlobalCommandNotDecoded');
  });
});

describe('hata yolları', () => {
  it('minimum uzunluktan kısa çerçeve truncated-frame ile reddedilir', () => {
    const result = expectFailure(zigbeeParser.parse(Uint8Array.from([0x41, 0x88])));
    expect(result.error.code).toBe('truncated-frame');
    expect(result.recoverable).toBe(true);
  });

  it('adresleme alanları tampon dışına taşarsa truncated-frame basar', () => {
    const withoutFcs = [0x41, 0x88, 0x01]; // Data, dest/src short, pan-compress — adres baytları eksik
    const frame = expectSuccess(parseZigbee(Uint8Array.from([...withoutFcs, ...fcsFor(withoutFcs)]))).frame;
    expect(frame.valid).toBe(false);
    expect(frame.errors.map((error) => error.code)).toContain('truncated-frame');
  });

  it('maxFrameLength aşımı frame-too-long ile reddedilir', () => {
    const result = expectFailure(
      zigbeeParser.parse(zigbeeFrame([...nwkHeaderBytes(), ...apsHeaderBytes()]), { maxFrameLength: 5 }),
    );
    expect(result.error.code).toBe('frame-too-long');
  });

  it('iptal edilmiş sinyal parser-timeout ile reddedilir', () => {
    const controller = new AbortController();
    controller.abort();
    const result = expectFailure(
      zigbeeParser.parse(zigbeeFrame([...nwkHeaderBytes(), ...apsHeaderBytes()]), { signal: controller.signal }),
    );
    expect(result.error.code).toBe('parser-timeout');
  });
});

describe('canParse', () => {
  it('yeterli uzunluk + Frame Type dar kümede ise true döner', () => {
    expect(zigbeeParser.canParse(zigbeeFrame([...nwkHeaderBytes(), ...apsHeaderBytes()]))).toBe(true);
  });

  it('minimum uzunluktan kısa veri için false döner', () => {
    expect(zigbeeParser.canParse(Uint8Array.from([0x41, 0x88]))).toBe(false);
  });
});
