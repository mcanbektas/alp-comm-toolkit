import { describe, expect, it } from 'vitest';

import {
  WARN_APDU_STATUS_FROM_FRAME_END,
  WARN_IO_DATA_NEEDS_GSDML,
  WARN_RESERVED_FRAME_ID,
  WARN_TRANSFER_STATUS_NOT_OK,
  WARN_TSN_PROFILE_REASSIGNS_RANGE,
  parseProfinet,
  profinetParser,
  profinetPlugin,
} from './profinet';
import { WARN_ALARM_UNKNOWN_TYPE } from './profinetAlarm';
import { WARN_DCP_PADDING_NOT_ZERO, WARN_DCP_VALUE_NOT_DECODED } from './profinetDcp';
import { classifyFrameId } from './profinetFrameId';
import type {
  ParseFailure,
  ParseResult,
  ParseSuccess,
  ParsedField,
  ParsedFrame,
} from '@/protocol-core/types';

function expectSuccess(result: ParseResult): ParseSuccess {
  if (!result.success) {
    throw new Error(`expected success, got failure ${result.error.code}: ${result.error.message}`);
  }
  return result;
}

function expectFailure(result: ParseResult): ParseFailure {
  if (result.success) throw new Error('expected failure, got success');
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

function exampleBytes(id: string): Uint8Array {
  const example = profinetPlugin.exampleFrames.find((candidate) => candidate.id === id);
  if (example === undefined) throw new Error(`example "${id}" not found`);
  return example.bytes;
}

const DESTINATION = [0x02, 0x00, 0x00, 0x11, 0x22, 0x33];
const SOURCE = [0x00, 0x11, 0x22, 0x33, 0x44, 0x55];

/** Ethernet başlığı + EtherType 0x8892 + FrameID + gövde. */
function frame(frameId: number, body: readonly number[], padTo?: number): Uint8Array {
  const bytes = [
    ...DESTINATION,
    ...SOURCE,
    0x88,
    0x92,
    (frameId >>> 8) & 0xff,
    frameId & 0xff,
    ...body,
  ];
  if (padTo !== undefined) while (bytes.length < padTo) bytes.push(0x00);
  return Uint8Array.from(bytes);
}

/** Aynı çerçevenin tek VLAN tag'li varyantı (TPID 0x8100 + TCI). */
function vlanFrame(frameId: number, body: readonly number[], padTo?: number): Uint8Array {
  const bytes = [
    ...DESTINATION,
    ...SOURCE,
    0x81,
    0x00,
    0xa0,
    0x64,
    0x88,
    0x92,
    (frameId >>> 8) & 0xff,
    frameId & 0xff,
    ...body,
  ];
  if (padTo !== undefined) while (bytes.length < padTo) bytes.push(0x00);
  return Uint8Array.from(bytes);
}

/** 40 bayt opak I/O verisi + 4 bayt APDU Status = 44 baytlık döngüsel gövde. */
function cyclicBody(cycleCounter: number, dataStatus: number, transferStatus: number): number[] {
  return [
    ...new Array<number>(40).fill(0xaa),
    (cycleCounter >>> 8) & 0xff,
    cycleCounter & 0xff,
    dataStatus,
    transferStatus,
  ];
}

describe('parseProfinet — Ethernet sınırı ve EtherType', () => {
  it('ethercat.ts ile AYNI girdi sözleşmesi: MAC çiftini ve EtherType 0x8892’yi çözer', () => {
    const { frame: parsed } = expectSuccess(parseProfinet(frame(0x8000, cyclicBody(1, 0x35, 0))));
    expect(fieldById(parsed, 'destination-mac').rawValue).toBe('02:00:00:11:22:33');
    expect(fieldById(parsed, 'source-mac').rawValue).toBe('00:11:22:33:44:55');
    expect(fieldById(parsed, 'ethertype').rawValue).toBe(0x8892);
    expect(fieldById(parsed, 'ethertype').physicalValue).toBe('PROFINET (PN-RT)');
    expect(parsed.valid).toBe(true);
  });

  it('VLAN tag’li çerçevede FrameID’yi 4 bayt ileride bulur (paylaşılan tag yürüyüşü)', () => {
    const { frame: parsed } = expectSuccess(
      parseProfinet(vlanFrame(0x8000, cyclicBody(1, 0x35, 0))),
    );
    // 12 (MAC çifti) + 4 (VLAN tag) = 16 → EtherType, 18 → FrameID.
    expect(fieldById(parsed, 'ethertype').offset).toBe(16);
    expect(fieldById(parsed, 'frame-id').offset).toBe(18);
    expect(fieldById(parsed, 'frame-id').rawValue).toBe(0x8000);
  });

  it('EtherType PROFINET değilse gövdeye DOKUNMAZ, kısmi çözüm + hata rozeti basar', () => {
    const bytes = exampleBytes('ethertype-not-profinet');
    const { frame: parsed } = expectSuccess(parseProfinet(bytes));
    expect(parsed.valid).toBe(false);
    expect(parsed.errors[0]?.code).toBe('start-delimiter-not-found');
    expect(hasField(parsed, 'frame-id')).toBe(false);
    expect(hasField(parsed, 'cycle-counter')).toBe(false);
    expect(fieldById(parsed, 'payload').valid).toBe(false);
  });
});

describe('classifyFrameId — dispatch bandı', () => {
  it('DCP’nin dört FrameID’sini ayrı ayrı adlandırır', () => {
    expect(classifyFrameId(0xfefc).frameClass).toBe('dcp');
    expect(classifyFrameId(0xfefd).frameClass).toBe('dcp');
    expect(classifyFrameId(0xfefe).frameClass).toBe('dcp');
    expect(classifyFrameId(0xfeff).frameClass).toBe('dcp');
    expect(classifyFrameId(0xfefe).label).toBe('DCP Identify multicast request');
  });

  it('alarm FrameID’lerini önceliğiyle birlikte çözer, komşuları ayrılmış sayar', () => {
    expect(classifyFrameId(0xfc01).alarmPriority).toBe('high');
    expect(classifyFrameId(0xfe01).alarmPriority).toBe('low');
    // "with security" varyantları TEK kaynakta → adlandırılmaz.
    expect(classifyFrameId(0xfc41).frameClass).toBe('reserved');
    expect(classifyFrameId(0xfe41).frameClass).toBe('reserved');
  });

  it('yalnız döngüsel bantlarda APDU Status bekler', () => {
    expect(classifyFrameId(0x8000).cyclic).toBe(true);
    expect(classifyFrameId(0xbbff).cyclic).toBe(true);
    expect(classifyFrameId(0xbc00).cyclic).toBe(true);
    expect(classifyFrameId(0xf800).cyclic).toBe(true);
    expect(classifyFrameId(0xfbff).cyclic).toBe(true);
    // Ayrılmış ve acyclic bantlar döngüsel DEĞİL.
    expect(classifyFrameId(0x0000).cyclic).toBe(false);
    expect(classifyFrameId(0x4000).cyclic).toBe(false);
    expect(classifyFrameId(0xfefe).cyclic).toBe(false);
    expect(classifyFrameId(0xff00).cyclic).toBe(false);
  });

  it('PTCP bantlarını sınıflandırır; 0xFF22-0xFF3F Wireshark koşuluna DEĞİL yorumuna göre ayrılmış', () => {
    expect(classifyFrameId(0x0020).frameClass).toBe('ptcp');
    expect(classifyFrameId(0x0080).frameClass).toBe('ptcp');
    expect(classifyFrameId(0xff00).frameClass).toBe('ptcp');
    expect(classifyFrameId(0xff20).frameClass).toBe('ptcp');
    expect(classifyFrameId(0xff30).frameClass).toBe('reserved');
    expect(classifyFrameId(0xff40).frameClass).toBe('ptcp');
    expect(classifyFrameId(0xff43).frameClass).toBe('ptcp');
    expect(classifyFrameId(0xff80).frameClass).toBe('fragmentation');
  });

  it('time-aware (TSN) profilinde yeniden atanan bandı işaretler', () => {
    expect(classifyFrameId(0x0100).tsnAmbiguous).toBe(true);
    expect(classifyFrameId(0x3fff).tsnAmbiguous).toBe(true);
    expect(classifyFrameId(0x4000).tsnAmbiguous).toBe(false);
    expect(classifyFrameId(0x8000).tsnAmbiguous).toBe(false);
  });
});

describe('parseProfinet — APDU Status ÇERÇEVE SONUNDAN geri sayılır', () => {
  it('APDU Status’un üç alanını çerçeve sonundan hesaplanan ofsetlere yerleştirir', () => {
    const bytes = frame(0x8000, cyclicBody(0x1234, 0x35, 0x00));
    const { frame: parsed } = expectSuccess(parseProfinet(bytes));
    // BAĞIMSIZ aritmetik: kuyruk 4 bayttır ve çerçevenin SONUNDADIR.
    const apduStatusOffset = bytes.length - 4;
    expect(fieldById(parsed, 'cycle-counter').offset).toBe(apduStatusOffset);
    expect(fieldById(parsed, 'data-status').offset).toBe(apduStatusOffset + 2);
    expect(fieldById(parsed, 'transfer-status').offset).toBe(apduStatusOffset + 3);
    expect(fieldById(parsed, 'cycle-counter').rawValue).toBe(0x1234);
    expect(warningCodes(parsed)).toContain(WARN_APDU_STATUS_FROM_FRAME_END);
  });

  it('çerçeve uzayınca kuyruk da kayar — konum baştan DEĞİL sondan türetilir', () => {
    const shortFrame = frame(0x8000, cyclicBody(1, 0x35, 0));
    const longFrame = frame(0x8000, [
      ...new Array<number>(60).fill(0x11),
      ...cyclicBody(1, 0x35, 0).slice(40),
    ]);
    const shortParsed = expectSuccess(parseProfinet(shortFrame)).frame;
    const longParsed = expectSuccess(parseProfinet(longFrame)).frame;
    expect(fieldById(shortParsed, 'cycle-counter').offset).toBe(shortFrame.length - 4);
    expect(fieldById(longParsed, 'cycle-counter').offset).toBe(longFrame.length - 4);
    expect(fieldById(longParsed, 'cycle-counter').offset).toBeGreaterThan(
      fieldById(shortParsed, 'cycle-counter').offset,
    );
  });

  it('I/O verisi çerçeve sonuyla FrameID arasındaki her şeydir ve TEK PARÇA ham kalır', () => {
    const bytes = frame(0x8000, cyclicBody(1, 0x35, 0));
    const { frame: parsed } = expectSuccess(parseProfinet(bytes));
    const ioData = fieldById(parsed, 'io-data');
    // 14 Ethernet + 2 FrameID = 16; kuyruk 4 → 60 - 16 - 4 = 40.
    expect(ioData.offset).toBe(16);
    expect(ioData.length).toBe(bytes.length - 16 - 4);
    expect(ioData.warnings).toContain(WARN_IO_DATA_NEEDS_GSDML);
    // Uydurma kırılım YOK: I/O bölgesinde başka alan basılmaz.
    expect(parsed.fields.filter((field) => field.offset >= 16 && field.offset < 56)).toHaveLength(1);
  });

  it('DataStatus’un altı anlamlı bitini ve iki ayrılmış bitini ayrı ayrı adlandırır', () => {
    const { frame: parsed } = expectSuccess(parseProfinet(frame(0x8000, cyclicBody(1, 0x35, 0))));
    expect(fieldById(parsed, 'data-status-state').physicalValue).toBe('Primary');
    expect(fieldById(parsed, 'data-status-data-valid').physicalValue).toBe('Valid');
    expect(fieldById(parsed, 'data-status-provider-state').physicalValue).toBe('Run');
    expect(fieldById(parsed, 'data-status-station-problem').physicalValue).toBe('Normal operation');
    expect(fieldById(parsed, 'data-status-ignore').physicalValue).toBe('Evaluate');
    expect(fieldById(parsed, 'data-status-reserved').rawValue).toBe(0);
  });

  it('durdurulmuş sağlayıcı ve TransferStatus≠0 yolunu uyarıyla gösterir', () => {
    const { frame: parsed } = expectSuccess(parseProfinet(frame(0xbc01, cyclicBody(1, 0x20, 0x01))));
    expect(fieldById(parsed, 'data-status-provider-state').physicalValue).toBe('Stop');
    expect(fieldById(parsed, 'data-status-data-valid').physicalValue).toBe('Invalid');
    expect(fieldById(parsed, 'transfer-status').physicalValue).toBe('Ignore this frame');
    expect(warningCodes(parsed)).toContain(WARN_TRANSFER_STATUS_NOT_OK);
    // Uyarı hatadır değildir: çerçeve yapısal olarak geçerlidir.
    expect(parsed.valid).toBe(true);
  });

  it('döngüsel gövde 4 bayttan kısaysa APDU Status UYDURULMAZ, hata basılır', () => {
    const { frame: parsed } = expectSuccess(parseProfinet(frame(0x8000, [0x01, 0x02])));
    expect(parsed.valid).toBe(false);
    expect(parsed.errors[0]?.code).toBe('truncated-frame');
    expect(hasField(parsed, 'cycle-counter')).toBe(false);
  });
});

describe('parseProfinet — DCP blok pad tuzağı', () => {
  it('tek uzunluklu bloktan sonra 1 pad baytı tüketir; sonraki blok KAYMAZ', () => {
    const bytes = exampleBytes('dcp-identify-response');
    const { frame: parsed } = expectSuccess(parseProfinet(bytes));
    // BAĞIMSIZ aritmetik: 14 Ethernet + 2 FrameID + 10 DCP başlığı = 26.
    // Blok 0 = 4 başlık + 11 değer = 15 (TEK) → +1 pad = 16 → blok 1 @ 42.
    expect(fieldById(parsed, 'dcp-block-0-option').offset).toBe(26);
    expect(fieldById(parsed, 'dcp-block-0-length').rawValue).toBe(11);
    expect(fieldById(parsed, 'dcp-block-0-padding').offset).toBe(41);
    expect(fieldById(parsed, 'dcp-block-1-option').offset).toBe(42);
    // Pad atlanmış olsaydı burada 0x00 okunurdu, 0x02 değil.
    expect(bytes[41]).toBe(0x00);
    expect(fieldById(parsed, 'dcp-block-1-option').rawValue).toBe(0x02);
    expect(fieldById(parsed, 'dcp-block-1-text').rawValue).toBe('conveyor-io-01');
  });

  it('pad ZİNCİRİ: iki tek uzunluklu blok üst üste geldiğinde de hizalama korunur', () => {
    const bytes = exampleBytes('dcp-set-response-padding');
    const { frame: parsed } = expectSuccess(parseProfinet(bytes));
    expect(fieldById(parsed, 'dcp-block-0-length').rawValue).toBe(3);
    expect(fieldById(parsed, 'dcp-block-0-padding').offset).toBe(33);
    expect(fieldById(parsed, 'dcp-block-1-option').offset).toBe(34);
    expect(fieldById(parsed, 'dcp-block-1-block-error').physicalValue).toBe('Suboption not set');
    expect(parsed.valid).toBe(true);
  });

  it('pad baytı sıfır değilse uyarır — dolgu olmayan bir şeyi dolgu diye göstermez', () => {
    // Control/Response bloğu (değer 3 bayt, TEK) + kasten 0xFF pad.
    const body = [
      0x04,
      0x01,
      0x00,
      0x00,
      0x00,
      0x01,
      0x00,
      0x00,
      0x00,
      0x10,
      0x05,
      0x04,
      0x00,
      0x03,
      0x02,
      0x02,
      0x00,
      0xff,
      0x05,
      0x04,
      0x00,
      0x03,
      0x01,
      0x02,
      0x00,
      0x00,
    ];
    const { frame: parsed } = expectSuccess(parseProfinet(frame(0xfefd, body, 60)));
    expect(fieldById(parsed, 'dcp-block-0-padding').valid).toBe(false);
    expect(warningCodes(parsed)).toContain(WARN_DCP_PADDING_NOT_ZERO);
    expect(fieldById(parsed, 'dcp-block-1-option').offset).toBe(34);
  });
});

describe('parseProfinet — DCP başlığı ve blok değerleri', () => {
  it('Identify isteğinde 2 baytı ResponseDelayFactor, diğer servislerde Reserved sayar', () => {
    const request = expectSuccess(parseProfinet(exampleBytes('dcp-identify-request'))).frame;
    const response = expectSuccess(parseProfinet(exampleBytes('dcp-identify-response'))).frame;
    expect(fieldById(request, 'dcp-response-delay').name).toContain('ResponseDelayFactor');
    expect(fieldById(request, 'dcp-response-delay').rawValue).toBe(0x0100);
    expect(fieldById(response, 'dcp-response-delay').name).toContain('Reserved');
  });

  it('ServiceType’ı bit bit çözer ve Request/Response ayrımını buradan yapar', () => {
    const request = expectSuccess(parseProfinet(exampleBytes('dcp-identify-request'))).frame;
    const response = expectSuccess(parseProfinet(exampleBytes('dcp-identify-response'))).frame;
    expect(fieldById(request, 'dcp-service-type-selection').physicalValue).toBe('Request');
    expect(fieldById(response, 'dcp-service-type-selection').physicalValue).toBe('Response');
    expect(fieldById(response, 'dcp-service-type-response').physicalValue).toBe('Success');
  });

  it('BlockInfo’yu DCPBlockLength’in İÇİNDEN düşer; değer bölgesi 2 bayt kısalır', () => {
    const { frame: parsed } = expectSuccess(parseProfinet(exampleBytes('dcp-identify-response')));
    // Blok 2: DCPBlockLength 14 = BlockInfo 2 + IP/Mask/Gateway 12.
    expect(fieldById(parsed, 'dcp-block-2-length').rawValue).toBe(14);
    expect(fieldById(parsed, 'dcp-block-2-block-info').physicalValue).toBe('IP set');
    expect(fieldById(parsed, 'dcp-block-2-ip-address').rawValue).toBe('192.168.10.25');
    expect(fieldById(parsed, 'dcp-block-2-subnet-mask').rawValue).toBe('255.255.255.0');
    expect(fieldById(parsed, 'dcp-block-2-gateway').rawValue).toBe('192.168.10.1');
  });

  it('Get isteğinde bloklar DEĞİL uzunluksuz seçici çiftleri okunur (tuzak 3)', () => {
    const { frame: parsed } = expectSuccess(parseProfinet(exampleBytes('dcp-get-request-selectors')));
    expect(fieldById(parsed, 'dcp-data-length').rawValue).toBe(6);
    // Üç seçici çifti 2’şer bayt: 26, 28, 30. Uzunluk alanı BASILMAZ.
    expect(fieldById(parsed, 'dcp-block-0-option').offset).toBe(26);
    expect(fieldById(parsed, 'dcp-block-1-option').offset).toBe(28);
    expect(fieldById(parsed, 'dcp-block-2-option').offset).toBe(30);
    expect(hasField(parsed, 'dcp-block-0-length')).toBe(false);
  });

  it('Hello’yu Hello olarak adlandırır ve cihaz adını VisibleString çözer', () => {
    const { frame: parsed } = expectSuccess(parseProfinet(exampleBytes('dcp-hello')));
    expect(fieldById(parsed, 'dcp-service-id').physicalValue).toBe('Hello');
    expect(fieldById(parsed, 'dcp-block-0-text').rawValue).toBe('conveyor-io-01');
    expect(fieldById(parsed, 'frame-id').physicalValue).toBe('DCP Hello');
  });

  it('yerleşimi iki kaynakta teyitli olmayan blok değerini HAM bırakıp uyarır', () => {
    // Identify yanıtı içinde DHCP (Option 0x03) bloğu: suboption değerlerinin
    // yerleşimi bilerek çözülmedi (dosya başı "HAM BIRAKILIR" listesi).
    const body = [
      0x05, // ServiceID: Identify
      0x01, // ServiceType: Response Success
      0x00, 0x00, 0x00, 0x07, // Xid
      0x00, 0x00, // Reserved
      0x00, 0x0a, // DCPDataLength = 4 başlık + 6 değer
      0x03, // Option: DHCP
      0x3d, // Suboption: DHCP client identifier
      0x00, 0x06, // DCPBlockLength = BlockInfo 2 + değer 4
      0x00, 0x00, // BlockInfo
      0xde, 0xad, 0xbe, 0xef,
    ];
    const { frame: parsed } = expectSuccess(parseProfinet(frame(0xfeff, body, 60)));
    expect(fieldById(parsed, 'dcp-block-0-value').length).toBe(4);
    expect(fieldById(parsed, 'dcp-block-0-value').warnings).toContain(WARN_DCP_VALUE_NOT_DECODED);
  });
});

describe('parseProfinet — alarm (RTA) PDU’su', () => {
  it('12 baytlık sabit başlığı ve AlarmNotification bloğunu çözer', () => {
    const { frame: parsed } = expectSuccess(parseProfinet(exampleBytes('alarm-low-diagnosis')));
    expect(fieldById(parsed, 'alarm-pdu-type').physicalValue).toBe('Data-RTA-PDU');
    expect(fieldById(parsed, 'alarm-block-type').physicalValue).toBe('Alarm Notification Low');
    expect(fieldById(parsed, 'alarm-type').physicalValue).toBe('Diagnosis');
    expect(fieldById(parsed, 'alarm-slot-number').rawValue).toBe(1);
    expect(fieldById(parsed, 'alarm-module-ident').physicalValue).toBe('0x00000101');
    // Sabit başlık 16’da başlar, blok 12 bayt sonra: 28.
    expect(fieldById(parsed, 'alarm-dst-endpoint').offset).toBe(16);
    expect(fieldById(parsed, 'alarm-block-type').offset).toBe(28);
  });

  it('PDUType ve AddFlags baytlarını nibble nibble ayırır', () => {
    const { frame: parsed } = expectSuccess(parseProfinet(exampleBytes('alarm-high-plug')));
    expect(fieldById(parsed, 'alarm-pdu-type').rawValue).toBe(1);
    expect(fieldById(parsed, 'alarm-pdu-version').rawValue).toBe(1);
    expect(fieldById(parsed, 'alarm-window-size').rawValue).toBe(1);
    expect(fieldById(parsed, 'alarm-tack').rawValue).toBe(1);
    expect(fieldById(parsed, 'alarm-type').physicalValue).toBe('Plug');
  });

  it('AlarmSpecifier’ın 11 bitlik sırasını ve dört tanı bitini ayrı basar', () => {
    const { frame: parsed } = expectSuccess(parseProfinet(exampleBytes('alarm-low-diagnosis')));
    expect(fieldById(parsed, 'alarm-specifier-sequence').rawValue).toBe(1);
    expect(fieldById(parsed, 'alarm-specifier-channel').physicalValue).toBe('Yes');
    expect(fieldById(parsed, 'alarm-specifier-manufacturer').physicalValue).toBe('No');
    expect(fieldById(parsed, 'alarm-specifier-ar-diagnosis').physicalValue).toBe('No');
  });

  it('ERR-RTA’nın PNIOStatus dörtlüsünü çözer, ACK/NACK’te ek veri BEKLEMEZ', () => {
    const errBody = [
      0x00, 0x00, 0x00, 0x01,
      0x14, // PDUType: type 4 (ERR), version 1
      0x01,
      0x00, 0x03,
      0x00, 0x02,
      0x00, 0x04, // VarPartLen
      0xdf, 0x82, 0x01, 0x00,
    ];
    const err = expectSuccess(parseProfinet(frame(0xfe01, errBody, 60))).frame;
    expect(fieldById(err, 'alarm-pdu-type').physicalValue).toBe('ERR-RTA-PDU');
    expect(fieldById(err, 'alarm-pnio-status-0').physicalValue).toBe('0xDF');
    expect(fieldById(err, 'alarm-pnio-status-3').physicalValue).toBe('0x00');

    const ackBody = [0x00, 0x00, 0x00, 0x01, 0x13, 0x01, 0x00, 0x03, 0x00, 0x02, 0x00, 0x00];
    const ack = expectSuccess(parseProfinet(frame(0xfc01, ackBody, 60))).frame;
    expect(fieldById(ack, 'alarm-pdu-type').physicalValue).toBe('ACK-RTA-PDU');
    expect(hasField(ack, 'alarm-block-type')).toBe(false);
  });

  it('çakışan kaynak nedeniyle adlandırılmayan AlarmType’ı ham bırakıp uyarır', () => {
    // 0x0007: Wireshark "Redundancy", p-net "MEDIA_REDUNDANCY" → adlandırılmaz.
    const bytes = exampleBytes('alarm-low-diagnosis').slice();
    const alarmTypeOffset = 34;
    bytes[alarmTypeOffset] = 0x00;
    bytes[alarmTypeOffset + 1] = 0x07;
    const { frame: parsed } = expectSuccess(parseProfinet(bytes));
    expect(fieldById(parsed, 'alarm-type').physicalValue).toBeUndefined();
    expect(warningCodes(parsed)).toContain(WARN_ALARM_UNKNOWN_TYPE);
  });
});

describe('parseProfinet — kapsam dışı sınıflar ve hata yolları', () => {
  it('PTCP gövdesini ham bırakır ve NEDEN çözülmediğini uyarıyla söyler', () => {
    const { frame: parsed } = expectSuccess(parseProfinet(exampleBytes('ptcp-announce')));
    expect(fieldById(parsed, 'frame-id').physicalValue).toContain('PTCP Announce');
    expect(fieldById(parsed, 'payload').offset).toBe(16);
    expect(parsed.warnings.length).toBeGreaterThan(0);
    expect(parsed.valid).toBe(true);
  });

  it('ayrılmış FrameID bandını uyarır ama çözmeye ÇALIŞMAZ', () => {
    const { frame: parsed } = expectSuccess(parseProfinet(frame(0x4000, [0x01, 0x02, 0x03], 60)));
    expect(warningCodes(parsed)).toContain(WARN_RESERVED_FRAME_ID);
    expect(fieldById(parsed, 'frame-id').valid).toBe(false);
    expect(hasField(parsed, 'cycle-counter')).toBe(false);
  });

  it('TSN profilinde yeniden atanan bandı çözer ama belirsizliği uyarır', () => {
    const { frame: parsed } = expectSuccess(parseProfinet(frame(0x0100, cyclicBody(7, 0x35, 0))));
    expect(warningCodes(parsed)).toContain(WARN_TSN_PROFILE_REASSIGNS_RANGE);
    expect(fieldById(parsed, 'cycle-counter').rawValue).toBe(7);
  });

  it('DCPDataLength telde olandan büyükse kısmi çözüm + length-mismatch basar', () => {
    const { frame: parsed } = expectSuccess(parseProfinet(exampleBytes('dcp-block-truncated')));
    expect(parsed.valid).toBe(false);
    expect(parsed.errors[0]?.code).toBe('length-mismatch');
    // Kısmi çözüm KORUNUR: okunabilen blok yine de gösterilir.
    expect(fieldById(parsed, 'dcp-block-0-text').rawValue).toBe('ab');
  });

  it('Ethernet başlığı tamamlanmıyorsa ParseFailure döner (kısmi çerçeve değil)', () => {
    const failure = expectFailure(parseProfinet(exampleBytes('frame-too-short')));
    expect(failure.error.code).toBe('truncated-frame');
    expect(failure.recoverable).toBe(true);
  });

  it('maxFrameLength aşılırsa frame-too-long ile durur, buffer ayırmaz', () => {
    const failure = expectFailure(
      profinetParser.parse(frame(0x8000, cyclicBody(1, 0x35, 0)), { maxFrameLength: 32 }),
    );
    expect(failure.error.code).toBe('frame-too-long');
  });

  it('iptal sinyali gelmişse parser-timeout ile döner, exception fırlatmaz', () => {
    const controller = new AbortController();
    controller.abort();
    const failure = expectFailure(
      profinetParser.parse(frame(0x8000, cyclicBody(1, 0x35, 0)), { signal: controller.signal }),
    );
    expect(failure.error.code).toBe('parser-timeout');
  });
});

describe('profinetParser', () => {
  it('canParse yalnız 0x8892 EtherType’ına (VLAN’lı varyant dahil) evet der', () => {
    expect(profinetParser.canParse(frame(0x8000, cyclicBody(1, 0x35, 0)))).toBe(true);
    expect(profinetParser.canParse(vlanFrame(0x8000, cyclicBody(1, 0x35, 0)))).toBe(true);
    expect(profinetParser.canParse(exampleBytes('ethertype-not-profinet'))).toBe(false);
    expect(profinetParser.canParse(exampleBytes('frame-too-short'))).toBe(false);
  });
});

describe('profinetPlugin', () => {
  it('katalogdaki kimlik, kategori ve parser bağını taşır; decodeOptions AÇILMADI', () => {
    expect(profinetPlugin.id).toBe('profinet');
    expect(profinetPlugin.category).toBe('industrial-automation');
    expect(profinetPlugin.parser).toBe(profinetParser);
    expect(profinetPlugin.decodeOptions).toBeUndefined();
    expect(profinetPlugin.encoder).toBeUndefined();
  });

  it('her örnek çözülür ve expectedValid ile eşleşir', () => {
    for (const example of profinetPlugin.exampleFrames) {
      const result = profinetParser.parse(example.bytes);
      if (!result.success) {
        expect(example.expectedValid, `example "${example.id}" failed: ${result.error.code}`).toBe(
          false,
        );
        continue;
      }
      expect(result.frame.valid, `example "${example.id}"`).toBe(example.expectedValid ?? true);
    }
  });

  it('her örnek adı/açıklaması protocol.profinet.example. önekli çeviri anahtarıdır', () => {
    for (const example of profinetPlugin.exampleFrames) {
      expect(example.name.startsWith('protocol.profinet.example.'), example.id).toBe(true);
      expect(example.description?.startsWith('protocol.profinet.example.'), example.id).toBe(true);
    }
  });
});
