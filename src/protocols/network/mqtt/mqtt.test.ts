import { describe, expect, it } from 'vitest';

import { mqttParser, mqttPlugin, parseMqtt } from './mqtt';
import { encodeVariableByteInteger } from './mqttVbi';
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

/** `[fixedHeaderByte0, ...remainingLengthVbi, ...variableHeaderAndPayload]`. */
function packet(firstByte: number, body: readonly number[]): Uint8Array {
  return Uint8Array.from([firstByte, ...encodeVariableByteInteger(body.length), ...body]);
}

function str(text: string): number[] {
  return Array.from(text, (char) => char.charCodeAt(0));
}

function u16(value: number): number[] {
  return [(value >>> 8) & 0xff, value & 0xff];
}

function utf8String(text: string): number[] {
  return [...u16(text.length), ...str(text)];
}

describe('plugin kaydı', () => {
  it('kimlik/kategori/parser bağı katalogla eşleşir', () => {
    expect(mqttPlugin.id).toBe('mqtt');
    expect(mqttPlugin.category).toBe('network-ethernet');
    expect(mqttPlugin.parser?.protocolId).toBe('mqtt');
    expect(mqttPlugin.exampleFrames.length).toBeGreaterThan(0);
  });

  it('her örnek çerçeve çözülür ve expectedValid ile eşleşir', () => {
    for (const example of mqttPlugin.exampleFrames) {
      const result = mqttParser.parse(example.bytes);
      if (!result.success) {
        throw new Error(`example "${example.id}" failed: ${result.error.code}`);
      }
      expect(result.frame.valid, `example "${example.id}"`).toBe(example.expectedValid ?? true);
    }
  });

  it('her örnek adı/açıklaması protocol.mqtt. önekli çeviri anahtarıdır', () => {
    for (const example of mqttPlugin.exampleFrames) {
      expect(example.name.startsWith('protocol.mqtt.'), example.id).toBe(true);
    }
  });
});

describe('Fixed Header — Packet Type', () => {
  it('CONNECT(1)…AUTH(15) OASIS adlarıyla adlandırılır', () => {
    const { frame } = expectSuccess(mqttParser.parse(packet(0xc0, [])));
    expect(fieldById(frame, 'packet-type').rawValue).toBe(12);
    expect(fieldById(frame, 'packet-type').physicalValue).toBe('PINGREQ');
  });

  it('tip 0 (reserved) value-out-of-range basar ama çerçeve yine ham Body ile gösterilir', () => {
    const { frame } = expectSuccess(mqttParser.parse(packet(0x00, [0xaa, 0xbb])));
    expect(frame.valid).toBe(false);
    expect(frame.errors[0]?.code).toBe('value-out-of-range');
    expect(fieldById(frame, 'packet-type').valid).toBe(false);
    expect(fieldById(frame, 'body').rawBytes).toEqual(Uint8Array.from([0xaa, 0xbb]));
  });
});

describe('Fixed Header — flags', () => {
  it('PUBLISH DUP/QoS/RETAIN ayrı alanlar olarak çözülür', () => {
    // DUP=1, QoS=2(0b10), RETAIN=1 → nibble 0b1101 = 0xD.
    const bytes = packet(0x3d, [...utf8String('t'), 0x00, 0x01]);
    const { frame } = expectSuccess(mqttParser.parse(bytes));
    expect(fieldById(frame, 'publish-flag-dup').rawValue).toBe(1);
    expect(fieldById(frame, 'publish-flag-qos').rawValue).toBe(2);
    expect(fieldById(frame, 'publish-flag-retain').rawValue).toBe(1);
  });

  it('PUBLISH QoS=3 (reserved) value-out-of-range basar', () => {
    // QoS bitleri 0b11 → nibble 0b0110 = 0x6.
    const bytes = packet(0x36, [...utf8String('t')]);
    const { frame } = expectSuccess(mqttParser.parse(bytes));
    expect(frame.valid).toBe(false);
    expect(fieldById(frame, 'publish-flag-qos').valid).toBe(false);
    expect(frame.errors.some((error) => error.code === 'value-out-of-range')).toBe(true);
  });

  it('sabit flags ihlali (SUBSCRIBE 0b0010 beklenir) uyarı basar ama çerçeve valid kalır', () => {
    const bytes = packet(0x80, [...u16(1)]); // SUBSCRIBE, flags=0b0000 (beklenen 0b0010)
    const { frame } = expectSuccess(mqttParser.parse(bytes));
    expect(frame.valid).toBe(true);
    expect(warningCodes(frame)).toContain('protocol.mqtt.warning.fixedFlagsViolation');
  });

  it('sabit flags doğruysa uyarı basılmaz', () => {
    const bytes = packet(0x82, [...u16(1)]); // SUBSCRIBE, flags=0b0010 (doğru)
    const { frame } = expectSuccess(mqttParser.parse(bytes));
    expect(warningCodes(frame)).not.toContain('protocol.mqtt.warning.fixedFlagsViolation');
  });
});

describe('Remaining Length — VBI (mqttVbi.ts)', () => {
  it('truncated VBI (devam biti set, bayt yok) truncated-frame ile kısmi çözüm üretir', () => {
    const bytes = Uint8Array.from([0x10, 0x80]);
    const { frame } = expectSuccess(mqttParser.parse(bytes));
    expect(frame.valid).toBe(false);
    expect(fieldById(frame, 'remaining-length').valid).toBe(false);
    expect(frame.errors[0]?.code).toBe('truncated-frame');
  });

  it('malformed VBI (dört bayt hâlâ devam biti set) value-out-of-range ile kısmi çözüm üretir', () => {
    const bytes = Uint8Array.from([0x10, 0xff, 0xff, 0xff, 0xff]);
    const { frame } = expectSuccess(mqttParser.parse(bytes));
    expect(frame.valid).toBe(false);
    expect(fieldById(frame, 'remaining-length').valid).toBe(false);
    expect(frame.errors[0]?.code).toBe('value-out-of-range');
    // Fixed header (packet-type) yine gösterilir — kısmi çözüm.
    expect(fieldById(frame, 'packet-type').rawValue).toBe(1);
  });

  it('bildirilen Remaining Length tamponda eksikse truncated-frame basar, header yine görünür', () => {
    const bytes = Uint8Array.from([0x10, 0x0a, 0x00, 0x01]); // 10 bildiriyor, yalnız 2 bayt var
    const { frame } = expectSuccess(mqttParser.parse(bytes));
    expect(frame.valid).toBe(false);
    expect(frame.errors[0]?.code).toBe('truncated-frame');
    expect(fieldById(frame, 'remaining-length').rawValue).toBe(10);
    expect(hasField(frame, 'client-identifier')).toBe(false);
  });
});

describe('CONNECT — v3.1.1', () => {
  const body = [
    ...utf8String('MQTT'),
    0x04, // Protocol Level
    0x02, // Connect Flags: Clean Session
    ...u16(60), // Keep Alive
    ...utf8String('dev-1'),
  ];

  it('Protocol Name/Level/Flags/Keep Alive/Client Identifier çözülür', () => {
    const { frame } = expectSuccess(mqttParser.parse(packet(0x10, body)));
    expect(fieldById(frame, 'protocol-name').rawValue).toBe('MQTT');
    expect(fieldById(frame, 'protocol-level').rawValue).toBe(4);
    expect(fieldById(frame, 'protocol-level').physicalValue).toBe('MQTT 3.1.1');
    expect(fieldById(frame, 'connect-flag-clean-start').name).toBe('Clean Session');
    expect(fieldById(frame, 'connect-flag-clean-start').rawValue).toBe(1);
    expect(fieldById(frame, 'keep-alive').rawValue).toBe(60);
    expect(fieldById(frame, 'client-identifier').rawValue).toBe('dev-1');
    expect(frame.valid).toBe(true);
    expect(hasField(frame, 'properties-length')).toBe(false);
  });

  it('Reserved bit set ise uyarı basar', () => {
    const withReserved = [...body];
    withReserved[7] = 0x03; // Clean Session + Reserved bit (Connect Flags baytı)
    const { frame } = expectSuccess(mqttParser.parse(packet(0x10, withReserved)));
    expect(warningCodes(frame)).toContain('protocol.mqtt.warning.connectFlagsReservedBit');
  });

  it('bilinmeyen Protocol Level uyarı basar ama Client Identifier yine çözülür (Properties denenmez)', () => {
    const unknownLevel = [...body];
    unknownLevel[6] = 0x07; // ne 4 ne 5
    const { frame } = expectSuccess(mqttParser.parse(packet(0x10, unknownLevel)));
    expect(warningCodes(frame)).toContain('protocol.mqtt.warning.unknownProtocolLevel');
    expect(fieldById(frame, 'client-identifier').rawValue).toBe('dev-1');
  });

  it('Will/User/Password bayrakları set edilince ilgili alanlar sırayla çözülür', () => {
    const withExtras = [
      ...utf8String('MQTT'),
      0x04,
      0xce, // UserName+Password+WillRetain+WillFlag+CleanSession set
      ...u16(30),
      ...utf8String('dev-2'),
      ...utf8String('last/will'),
      ...u16(2),
      0xde,
      0xad,
      ...utf8String('alice'),
      ...u16(2),
      0x01,
      0x02,
    ];
    const { frame } = expectSuccess(mqttParser.parse(packet(0x10, withExtras)));
    expect(fieldById(frame, 'will-topic').rawValue).toBe('last/will');
    expect(Array.from(fieldById(frame, 'will-payload').rawBytes.slice(-2))).toEqual([0xde, 0xad]);
    expect(fieldById(frame, 'user-name').rawValue).toBe('alice');
    expect(Array.from(fieldById(frame, 'password').rawBytes.slice(-2))).toEqual([0x01, 0x02]);
  });
});

describe('CONNECT — v5 Properties', () => {
  it('Level=5 ise Properties zorunlu çözülür, bilinen id adlandırılır', () => {
    const properties = [
      0x11, // Session Expiry Interval (fourByteInt)
      0x00, 0x00, 0x0e, 0x10, // 3600
      0x21, // Receive Maximum (twoByteInt)
      0x00, 0x14, // 20
    ];
    const body = [
      ...utf8String('MQTT'),
      0x05,
      0x02,
      ...u16(60),
      properties.length,
      ...properties,
      ...utf8String('dev-3'),
    ];
    const { frame } = expectSuccess(mqttParser.parse(packet(0x10, body)));
    expect(fieldById(frame, 'properties-length').rawValue).toBe(8);
    const sessionExpiry = frame.fields.find((field) => field.name === 'Session Expiry Interval');
    expect(sessionExpiry?.rawValue).toBe(3600);
    const receiveMax = frame.fields.find((field) => field.name === 'Receive Maximum');
    expect(receiveMax?.rawValue).toBe(20);
    expect(fieldById(frame, 'client-identifier').rawValue).toBe('dev-3');
    expect(frame.valid).toBe(true);
  });

  it('tanınmayan property id kalanı ham gösterir + uyarı basar, döngü durur', () => {
    const properties = [0x63, 0xaa, 0xbb, 0xcc]; // 0x63 = 99, tanınmayan id
    const body = [...utf8String('MQTT'), 0x05, 0x00, ...u16(0), properties.length, ...properties, ...utf8String('x')];
    const { frame } = expectSuccess(mqttParser.parse(packet(0x10, body)));
    expect(warningCodes(frame)).toContain('protocol.mqtt.warning.unknownPropertyId');
    const unknown = frame.fields.find((field) => field.name === 'Unknown Property');
    expect(unknown?.rawBytes).toEqual(Uint8Array.from(properties));
  });

  it('Properties Level=5 gerektirdiği halde tamponda eksikse truncated-frame basar', () => {
    const body = [...utf8String('MQTT'), 0x05, 0x00, ...u16(0), 0x08, 0x11, 0x00]; // 8 bildiriyor, 2 bayt var
    const { frame } = expectSuccess(mqttParser.parse(packet(0x10, body)));
    expect(frame.valid).toBe(false);
    expect(frame.errors.some((error) => error.code === 'truncated-frame')).toBe(true);
    expect(hasField(frame, 'client-identifier')).toBe(false);
  });
});

describe('PUBLISH', () => {
  it('QoS0 Packet Identifier üretmez, Payload ham gösterilir', () => {
    // Payload baytları BİLEREK devam biti set (0xFF) — properties sezgisinin
    // VBI adımı bile tamamlanamaz (truncated), bu yüzden dene-ama-uyar hiç
    // devreye girmez ve tüm baytlar doğrudan Payload sayılır.
    const body = [...utf8String('a/b'), 0xff, 0xff, 0xff];
    const { frame } = expectSuccess(mqttParser.parse(packet(0x30, body)));
    expect(fieldById(frame, 'topic-name').rawValue).toBe('a/b');
    expect(hasField(frame, 'packet-identifier')).toBe(false);
    expect(hasField(frame, 'properties-length')).toBe(false);
    expect(fieldById(frame, 'payload').rawBytes).toEqual(Uint8Array.from([0xff, 0xff, 0xff]));
  });

  it('QoS1 Packet Identifier üretir', () => {
    const body = [...utf8String('a/b'), ...u16(0x1234), 0x99];
    const { frame } = expectSuccess(mqttParser.parse(packet(0x32, body)));
    expect(fieldById(frame, 'packet-identifier').rawValue).toBe(0x1234);
    expect(fieldById(frame, 'payload').rawBytes).toEqual(Uint8Array.from([0x99]));
  });

  it('Properties declared uzunluğu sığmıyorsa sessizce vazgeçilir, tüm baytlar Payload olur', () => {
    // 0x32 = 50 (MSB=0, VBI 1 bayt) → "properties length 50" iddiası ama yalnız
    // 3 bayt kalıyor: sığmaz, bu yüzden properties denenmez.
    const body = [...utf8String('a/b'), 0x32, 0x33, 0x2e];
    const { frame } = expectSuccess(mqttParser.parse(packet(0x30, body)));
    expect(hasField(frame, 'properties-length')).toBe(false);
    expect(fieldById(frame, 'payload').rawBytes).toEqual(Uint8Array.from([0x32, 0x33, 0x2e]));
  });

  it('Properties declared uzunluğu sığarsa denenir ve sürüm varsayımı uyarısı basar', () => {
    const properties = [0x01, 0x01]; // Payload Format Indicator (byte) = 1
    const body = [...utf8String('a/b'), properties.length, ...properties, 0xff];
    const { frame } = expectSuccess(mqttParser.parse(packet(0x30, body)));
    expect(fieldById(frame, 'properties-length').rawValue).toBe(2);
    expect(warningCodes(frame)).toContain('protocol.mqtt.warning.propertiesVersionAssumed');
    expect(fieldById(frame, 'payload').rawBytes).toEqual(Uint8Array.from([0xff]));
  });
});

describe('Packet Identifier taşıyan diğer tipler', () => {
  it('PUBACK Packet Identifier + ham Body çözer', () => {
    const body = [...u16(0x0007), 0x00];
    const { frame } = expectSuccess(mqttParser.parse(packet(0x40, body)));
    expect(fieldById(frame, 'packet-identifier').rawValue).toBe(7);
    expect(fieldById(frame, 'body').rawBytes).toEqual(Uint8Array.from([0x00]));
  });

  it('CONNACK gibi packet-id taşımayan tipler tamamen ham Body olur', () => {
    const body = [0x00, 0x00];
    const { frame } = expectSuccess(mqttParser.parse(packet(0x20, body)));
    expect(hasField(frame, 'packet-identifier')).toBe(false);
    expect(fieldById(frame, 'body').rawBytes).toEqual(Uint8Array.from(body));
  });

  it('PINGREQ boş gövdeyle hiçbir ekstra alan üretmez', () => {
    const { frame } = expectSuccess(mqttParser.parse(packet(0xc0, [])));
    expect(hasField(frame, 'body')).toBe(false);
    expect(frame.valid).toBe(true);
  });
});

describe('trailing data', () => {
  it('Remaining Length’in bildirdiğinden fazla bayt gelirse ayrı alanda gösterilir, hata değil uyarı', () => {
    const base = packet(0xc0, []);
    const withExtra = Uint8Array.from([...base, 0xaa, 0xbb]);
    const { frame } = expectSuccess(mqttParser.parse(withExtra));
    expect(frame.valid).toBe(true);
    expect(warningCodes(frame)).toContain('protocol.mqtt.warning.trailingBytes');
    expect(fieldById(frame, 'trailing-data').rawBytes).toEqual(Uint8Array.from([0xaa, 0xbb]));
  });
});

describe('canParse — ucuz ön eleme', () => {
  it('asgari uzunluk + tip nibble’ının rezerve olmamasına bakar', () => {
    expect(mqttParser.canParse(packet(0x10, [0x00]))).toBe(true);
    expect(mqttParser.canParse(Uint8Array.from([0x00, 0x00]))).toBe(false);
    expect(mqttParser.canParse(Uint8Array.from([0x10]))).toBe(false);
  });
});

describe('başlık hataları', () => {
  it('2 bayttan kısa veri recoverable truncated-frame ile başarısız olur', () => {
    const result = expectFailure(mqttParser.parse(Uint8Array.from([0x10])));
    expect(result.error.code).toBe('truncated-frame');
    expect(result.recoverable).toBe(true);
  });

  it('maxFrameLength aşılınca kurtarılamaz frame-too-long ile başarısız olur', () => {
    const bytes = packet(0x10, [...utf8String('MQTT'), 0x04, 0x00, ...u16(0), ...utf8String('x')]);
    const result = expectFailure(mqttParser.parse(bytes, { maxFrameLength: 3 }));
    expect(result.error.code).toBe('frame-too-long');
    expect(result.recoverable).toBe(false);
  });

  it('parseMqtt kısayolu doğru protokol kimliğine bağlar', () => {
    const { frame } = expectSuccess(parseMqtt(packet(0xc0, [])));
    expect(frame.protocol).toBe('mqtt');
  });
});
