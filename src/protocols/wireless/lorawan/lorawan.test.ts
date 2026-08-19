import { describe, expect, it } from 'vitest';

import { lorawanParser, lorawanPlugin, parseLoRaWAN } from './lorawan';
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

const MIC = [0xde, 0xad, 0xbe, 0xef];

function mhdrByte(fType: number, major = 0): number {
  return ((fType & 0b111) << 5) | (major & 0b11);
}

function joinRequestFrame(): Uint8Array {
  return Uint8Array.from([
    mhdrByte(0b000),
    0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, // JoinEUI (LE)
    0x11, 0x12, 0x13, 0x14, 0x15, 0x16, 0x17, 0x18, // DevEUI (LE)
    0x2a, 0x00, // DevNonce = 42 (LE)
    ...MIC,
  ]);
}

function le24(value: number): number[] {
  return [value & 0xff, (value >> 8) & 0xff, (value >> 16) & 0xff];
}

function dataFrame(
  fType: number,
  options: {
    fctrl?: number;
    fcnt?: number;
    fopts?: readonly number[];
    fport?: number;
    frmPayload?: readonly number[];
  } = {},
): Uint8Array {
  const fctrl = options.fctrl ?? 0x00;
  const fcnt = options.fcnt ?? 0;
  const fopts = options.fopts ?? [];
  const bytes = [
    mhdrByte(fType),
    0x26, 0x01, 0x1a, 0x2b, // DevAddr (LE)
    fctrl,
    fcnt & 0xff, (fcnt >> 8) & 0xff, // FCnt (LE)
    ...fopts,
  ];
  if (options.fport !== undefined) {
    bytes.push(options.fport, ...(options.frmPayload ?? []));
  }
  bytes.push(...MIC);
  return Uint8Array.from(bytes);
}

describe('plugin kaydı', () => {
  it('kimlik/kategori/parser bağı katalogla eşleşir', () => {
    expect(lorawanPlugin.id).toBe('lorawan');
    expect(lorawanPlugin.category).toBe('wireless-iot');
    expect(lorawanPlugin.parser?.protocolId).toBe('lorawan');
    expect(lorawanPlugin.exampleFrames.length).toBeGreaterThan(0);
  });

  it('her örnek çerçeve çözülür ve expectedValid ile eşleşir', () => {
    for (const example of lorawanPlugin.exampleFrames) {
      const result = lorawanParser.parse(example.bytes);
      if (!result.success) {
        throw new Error(`example "${example.id}" failed: ${result.error.code}`);
      }
      expect(result.frame.valid, `example "${example.id}"`).toBe(example.expectedValid ?? true);
    }
  });

  it('her örnek adı/açıklaması protocol.lorawan. önekli çeviri anahtarıdır', () => {
    for (const example of lorawanPlugin.exampleFrames) {
      expect(example.name.startsWith('protocol.lorawan.'), example.id).toBe(true);
    }
  });
});

describe('MHDR', () => {
  it('FType/Major alanlarını MSB-first ayrıştırır', () => {
    const frame = expectSuccess(parseLoRaWAN(dataFrame(0b010))).frame;
    expect(fieldById(frame, 'ftype').rawValue).toBe(0b010);
    expect(fieldById(frame, 'ftype').physicalValue).toBe('Unconfirmed Data Up');
    expect(fieldById(frame, 'major').physicalValue).toBe('LoRaWAN R1');
  });

  it('Major R1 değilse uyarır', () => {
    const bytes = dataFrame(0b010);
    bytes[0] = (bytes[0] as number) | 0b01; // Major alt bitini 1 yap → R1(00) değil
    const frame = expectSuccess(parseLoRaWAN(bytes)).frame;
    expect(warningCodes(frame)).toContain('protocol.lorawan.warning.majorNotR1');
  });

  it('FType 110 (1.1 Rejoin Request) dar adlanır, gövdesi çözülmez', () => {
    const frame = expectSuccess(
      parseLoRaWAN(Uint8Array.from([mhdrByte(0b110), 0x01, 0x02, ...MIC])),
    ).frame;
    expect(fieldById(frame, 'ftype').physicalValue).toBe('RFU (Rejoin Request in 1.1)');
    expect(hasField(frame, 'payload')).toBe(true);
    expect(warningCodes(frame)).toContain('protocol.lorawan.warning.frameKindNotDecoded');
  });

  it('Proprietary (111) gövdesi ham + uyarıyla gösterilir', () => {
    const frame = expectSuccess(
      parseLoRaWAN(Uint8Array.from([mhdrByte(0b111), 0x01, 0x02, 0x03, ...MIC])),
    ).frame;
    expect(fieldById(frame, 'ftype').physicalValue).toBe('Proprietary');
    expect(fieldById(frame, 'payload').rawBytes).toEqual(Uint8Array.from([0x01, 0x02, 0x03, ...MIC]));
  });
});

describe('Join-Request', () => {
  it('JoinEUI/DevEUI/DevNonce açık metin çözülür (LE, EUI TERS gösterim)', () => {
    const frame = expectSuccess(parseLoRaWAN(joinRequestFrame())).frame;
    expect(fieldById(frame, 'join-eui').rawValue).toBe('08:07:06:05:04:03:02:01');
    expect(fieldById(frame, 'dev-eui').rawValue).toBe('18:17:16:15:14:13:12:11');
    expect(fieldById(frame, 'dev-nonce').rawValue).toBe(42);
  });

  it('MIC ham + doğrulanamaz uyarısıyla gösterilir, PASS/FAIL basılmaz', () => {
    const frame = expectSuccess(parseLoRaWAN(joinRequestFrame())).frame;
    const micField = fieldById(frame, 'mic');
    expect(micField.rawBytes).toEqual(Uint8Array.from(MIC));
    expect(micField.warnings).toContain('protocol.lorawan.warning.micNeedsSessionKeys');
    expect(JSON.stringify(frame)).not.toMatch(/PASS|FAIL/);
  });

  it('23 bayttan farklı uzunlukta length-mismatch basar', () => {
    const truncated = joinRequestFrame().slice(0, 20);
    const frame = expectSuccess(parseLoRaWAN(truncated)).frame;
    expect(frame.valid).toBe(false);
    expect(frame.errors.map((error) => error.code)).toContain('length-mismatch');
  });
});

describe('Join-Accept', () => {
  it('MHDR sonrası tamamı (MIC dahil) tek ham blok olarak gösterilir', () => {
    const bytes = Uint8Array.from([mhdrByte(0b001), 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    const frame = expectSuccess(parseLoRaWAN(bytes)).frame;
    const payloadField = fieldById(frame, 'join-accept-payload');
    expect(payloadField.rawBytes).toEqual(Uint8Array.from([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]));
    expect(warningCodes(frame)).toContain('protocol.lorawan.warning.joinAcceptEncrypted');
    expect(hasField(frame, 'mic')).toBe(false);
  });
});

describe('Data frame — FHDR', () => {
  it('DevAddr’ı LE okur, tek hex sayı olarak gösterir (ayraçsız)', () => {
    const frame = expectSuccess(parseLoRaWAN(dataFrame(0b010))).frame;
    expect(fieldById(frame, 'dev-addr').rawValue).toBe('0x2B1A0126');
  });

  it('FCnt’ı LE okur', () => {
    const frame = expectSuccess(parseLoRaWAN(dataFrame(0b010, { fcnt: 300 }))).frame;
    expect(fieldById(frame, 'fcnt').rawValue).toBe(300);
  });

  it('uplink FCtrl: ADR/ADRACKReq/ACK/ClassB/FOptsLen alanlarını ayırır', () => {
    // 0b1010_0011: ADR=1 ADRACKReq=0 ACK=1 ClassB=0 FOptsLen=0011(3)
    const frame = expectSuccess(
      parseLoRaWAN(dataFrame(0b010, { fctrl: 0b1010_0011, fopts: [1, 2, 3] })),
    ).frame;
    expect(fieldById(frame, 'adr').rawValue).toBe(1);
    expect(fieldById(frame, 'adr-ack-req').rawValue).toBe(0);
    expect(fieldById(frame, 'ack').rawValue).toBe(1);
    expect(fieldById(frame, 'class-b').rawValue).toBe(0);
    expect(fieldById(frame, 'fopts-len').rawValue).toBe(3);
    expect(hasField(frame, 'fctrl-rfu')).toBe(false);
    expect(hasField(frame, 'f-pending')).toBe(false);
  });

  it('downlink FCtrl: RFU/FPending alanlarını ayırır (uplink alanları YOK)', () => {
    // 0b0001_0010: ADR=0 RFU=0 ACK=0 FPending=1 FOptsLen=0010(2)
    const frame = expectSuccess(
      parseLoRaWAN(dataFrame(0b011, { fctrl: 0b0001_0010, fopts: [9, 9] })),
    ).frame;
    expect(fieldById(frame, 'fctrl-rfu').rawValue).toBe(0);
    expect(fieldById(frame, 'f-pending').rawValue).toBe(1);
    expect(fieldById(frame, 'fopts-len').rawValue).toBe(2);
    expect(hasField(frame, 'adr-ack-req')).toBe(false);
    expect(hasField(frame, 'class-b')).toBe(false);
  });

});

describe('FOpts MAC komutları', () => {
  it('gövdesiz iki komutu ardışık çözer (LinkCheckReq + DutyCycleAns, uplink)', () => {
    const frame = expectSuccess(
      parseLoRaWAN(dataFrame(0b010, { fctrl: 2, fopts: [0x02, 0x04] })),
    ).frame;
    expect(fieldById(frame, 'mac-command-1').name).toContain('LinkCheckReq');
    expect(fieldById(frame, 'mac-command-1').length).toBe(1);
    expect(fieldById(frame, 'mac-command-2').name).toContain('DutyCycleAns');
    expect(fieldById(frame, 'mac-command-2').offset).toBe(fieldById(frame, 'mac-command-1').offset + 1);
    expect(frame.valid).toBe(true);
  });

  it('LinkADRReq (downlink) DataRate/TXPower/ChMask/ChMaskCntl/NbTrans bit alanlarını çözer', () => {
    // DataRate=5,TXPower=3 → 0x53. ChMask=0x0003 (ch0+ch1). ChMaskCntl=0,NbTrans=2 → 0x02.
    const frame = expectSuccess(
      parseLoRaWAN(dataFrame(0b011, { fctrl: 5, fopts: [0x03, 0x53, 0x03, 0x00, 0x02] })),
    ).frame;
    expect(fieldById(frame, 'mac-command-1').name).toContain('LinkADRReq');
    expect(fieldById(frame, 'mac-command-1-data-rate').rawValue).toBe(5);
    expect(fieldById(frame, 'mac-command-1-tx-power').rawValue).toBe(3);
    expect(fieldById(frame, 'mac-command-1-ch-mask').rawValue).toBe('0x0003');
    expect(fieldById(frame, 'mac-command-1-ch-mask-cntl').rawValue).toBe(0);
    expect(fieldById(frame, 'mac-command-1-nb-trans').rawValue).toBe(2);
  });

  it('LinkADRAns (uplink) üç ACK bitini ayrıştırır', () => {
    const frame = expectSuccess(
      parseLoRaWAN(dataFrame(0b010, { fctrl: 2, fopts: [0x03, 0b0000_0111] })),
    ).frame;
    expect(fieldById(frame, 'mac-command-1-channel-mask-ack').physicalValue).toBe('Acknowledged');
    expect(fieldById(frame, 'mac-command-1-data-rate-ack').physicalValue).toBe('Acknowledged');
    expect(fieldById(frame, 'mac-command-1-power-ack').physicalValue).toBe('Acknowledged');
  });

  it('DevStatusAns Margin’ı 6-bit iki’nin tümleyeni olarak çözer (pozitif ve negatif)', () => {
    const positive = expectSuccess(
      parseLoRaWAN(dataFrame(0b010, { fctrl: 3, fopts: [0x06, 100, 10] })),
    ).frame;
    expect(fieldById(positive, 'mac-command-1-battery').rawValue).toBe(100);
    expect(fieldById(positive, 'mac-command-1-margin').rawValue).toBe(10);

    const negative = expectSuccess(
      parseLoRaWAN(dataFrame(0b010, { fctrl: 3, fopts: [0x06, 50, 40] })),
    ).frame;
    expect(fieldById(negative, 'mac-command-1-margin').rawValue).toBe(-24);
  });

  it('Battery 0/255 sınır değerlerini adlandırır', () => {
    const external = expectSuccess(
      parseLoRaWAN(dataFrame(0b010, { fctrl: 3, fopts: [0x06, 0, 0] })),
    ).frame;
    expect(fieldById(external, 'mac-command-1-battery').physicalValue).toBe('External power');

    const unmeasurable = expectSuccess(
      parseLoRaWAN(dataFrame(0b010, { fctrl: 3, fopts: [0x06, 255, 0] })),
    ).frame;
    expect(fieldById(unmeasurable, 'mac-command-1-battery').physicalValue).toBe('Cannot measure');
  });

  it('RXParamSetupReq Frequency’i 100 Hz biriminden Hz’e çevirir (LE 24-bit)', () => {
    // RX1DROffset=2,RX2DataRate=9 → byte0=0x29. Freq birimi 8_681_000 → 868_100_000 Hz.
    const frame = expectSuccess(
      parseLoRaWAN(dataFrame(0b011, { fctrl: 5, fopts: [0x05, 0x29, ...le24(8_681_000)] })),
    ).frame;
    expect(fieldById(frame, 'mac-command-1-rx1-dr-offset').rawValue).toBe(2);
    expect(fieldById(frame, 'mac-command-1-rx2-data-rate').rawValue).toBe(9);
    expect(fieldById(frame, 'mac-command-1-frequency').rawValue).toBe(868_100_000);
    expect(fieldById(frame, 'mac-command-1-frequency').unit).toBe('Hz');
  });

  it('aynı FOpts zincirinde iki farklı komutun aynı adlı alanları ÇAKIŞMAZ (NewChannelReq + DlChannelReq)', () => {
    const newChannel = [0x07, 3, ...le24(8_681_000), 0x50]; // ChIndex=3, Freq, MaxDR=5,MinDR=0
    const dlChannel = [0x0a, 4, ...le24(8_695_250)]; // ChIndex=4, Freq
    const frame = expectSuccess(
      parseLoRaWAN(dataFrame(0b011, { fctrl: newChannel.length + dlChannel.length, fopts: [...newChannel, ...dlChannel] })),
    ).frame;

    expect(fieldById(frame, 'mac-command-1-ch-index').rawValue).toBe(3);
    expect(fieldById(frame, 'mac-command-1-frequency').rawValue).toBe(868_100_000);
    expect(fieldById(frame, 'mac-command-1-max-dr').rawValue).toBe(5);
    expect(fieldById(frame, 'mac-command-1-min-dr').rawValue).toBe(0);

    expect(fieldById(frame, 'mac-command-2-ch-index').rawValue).toBe(4);
    expect(fieldById(frame, 'mac-command-2-frequency').rawValue).toBe(869_525_000);
  });

  it('dar küme dışı (1.1’e özgü) CID tanınmaz, kalan FOpts ham + uyarıyla gösterilir', () => {
    // CID 0x0B = RekeyInd (LoRaWAN 1.1) — sürüm çıpası L2 1.0.4 dışında (dosya başı).
    const frame = expectSuccess(
      parseLoRaWAN(dataFrame(0b010, { fctrl: 3, fopts: [0x0b, 0xaa, 0xbb] })),
    ).frame;
    const cidField = fieldById(frame, 'mac-command-1');
    expect(cidField.valid).toBe(false);
    expect(cidField.rawBytes).toEqual(Uint8Array.from([0x0b]));
    expect(warningCodes(frame)).toContain('protocol.lorawan.warning.unknownMacCommandCid');
    expect(fieldById(frame, 'mac-command-1-remainder').rawBytes).toEqual(Uint8Array.from([0xaa, 0xbb]));
    expect(warningCodes(frame)).toContain('protocol.lorawan.warning.foptsRemainderNotDecoded');
    expect(frame.valid).toBe(true);
  });

  it('tanınan ama tampon yetersiz komut truncated-frame basar (bilinmeyen-CID’in uyarı katmanından farklı)', () => {
    // DutyCycleReq (downlink) 1 bayt gövde ister, FOpts’ta yalnız CID var.
    const frame = expectSuccess(
      parseLoRaWAN(dataFrame(0b011, { fctrl: 1, fopts: [0x04] })),
    ).frame;
    expect(frame.valid).toBe(false);
    expect(frame.errors.map((error) => error.code)).toContain('truncated-frame');
  });
});

describe('FPort / FRMPayload', () => {
  it('FPort=0 "MAC commands only" olarak işaretlenir (uygulama verisi DEĞİL)', () => {
    const frame = expectSuccess(
      parseLoRaWAN(dataFrame(0b010, { fport: 0, frmPayload: [0x01, 0x02] })),
    ).frame;
    expect(fieldById(frame, 'f-port').physicalValue).toBe('MAC commands only (no application data)');
  });

  it('FPort>0 için physicalValue verilmez (yalnız sayı)', () => {
    const frame = expectSuccess(
      parseLoRaWAN(dataFrame(0b010, { fport: 10, frmPayload: [0x01] })),
    ).frame;
    expect(fieldById(frame, 'f-port').physicalValue).toBeUndefined();
    expect(fieldById(frame, 'f-port').rawValue).toBe(10);
  });

  it('FRMPayload her zaman şifreli + uyarıyla ham gösterilir', () => {
    const frame = expectSuccess(
      parseLoRaWAN(dataFrame(0b010, { fport: 10, frmPayload: [0xaa, 0xbb, 0xcc] })),
    ).frame;
    expect(fieldById(frame, 'frm-payload').rawBytes).toEqual(Uint8Array.from([0xaa, 0xbb, 0xcc]));
    expect(warningCodes(frame)).toContain('protocol.lorawan.warning.frmPayloadEncrypted');
  });

  it('FPort/FRMPayload olmadan da geçerli bir çerçevedir', () => {
    const frame = expectSuccess(parseLoRaWAN(dataFrame(0b010))).frame;
    expect(hasField(frame, 'f-port')).toBe(false);
    expect(hasField(frame, 'frm-payload')).toBe(false);
    expect(frame.valid).toBe(true);
    expect(hasField(frame, 'mic')).toBe(true);
  });
});

describe('hata yolları', () => {
  it('5 bayttan kısa çerçeve truncated-frame ile reddedilir', () => {
    const result = expectFailure(lorawanParser.parse(Uint8Array.from([0x00, 0x01, 0x02])));
    expect(result.error.code).toBe('truncated-frame');
    expect(result.recoverable).toBe(true);
  });

  it('FHDR için yetersiz MACPayload truncated-frame basar', () => {
    const bytes = Uint8Array.from([mhdrByte(0b010), 0x26, 0x01, 0x1a, 0x2b, 0x00, 0x05, ...MIC]);
    const frame = expectSuccess(parseLoRaWAN(bytes)).frame;
    expect(frame.valid).toBe(false);
    expect(frame.errors[0]?.code).toBe('truncated-frame');
  });

  it('FOptsLen tampon dışına taşarsa truncated-frame basar', () => {
    // FOptsLen=5 bildiriyor ama hiç FOpts baytı yok.
    const bytes = Uint8Array.from([mhdrByte(0b010), 0x26, 0x01, 0x1a, 0x2b, 0b0000_0101, 0x00, 0x00, ...MIC]);
    const frame = expectSuccess(parseLoRaWAN(bytes)).frame;
    expect(frame.valid).toBe(false);
    expect(frame.errors.map((error) => error.code)).toContain('truncated-frame');
  });

  it('maxFrameLength aşımı frame-too-long ile reddedilir', () => {
    const result = expectFailure(lorawanParser.parse(dataFrame(0b010), { maxFrameLength: 5 }));
    expect(result.error.code).toBe('frame-too-long');
  });

  it('iptal edilmiş sinyal parser-timeout ile reddedilir', () => {
    const controller = new AbortController();
    controller.abort();
    const result = expectFailure(lorawanParser.parse(dataFrame(0b010), { signal: controller.signal }));
    expect(result.error.code).toBe('parser-timeout');
  });
});

describe('canParse', () => {
  it('yeterli uzunluk + Major R1 ise true döner', () => {
    expect(lorawanParser.canParse(dataFrame(0b010))).toBe(true);
  });

  it('5 bayttan kısa veri için false döner', () => {
    expect(lorawanParser.canParse(Uint8Array.from([0x00, 0x01]))).toBe(false);
  });

  it('Major R1 değilse false döner', () => {
    const bytes = dataFrame(0b010);
    bytes[0] = (bytes[0] as number) | 0b01;
    expect(lorawanParser.canParse(bytes)).toBe(false);
  });
});
