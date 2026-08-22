import { describe, expect, it } from 'vitest';

import { mqttSnParser, mqttSnPlugin, parseMqttSn } from './mqttSn';
import { decodeVariableByteInteger } from './mqttVbi';
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

function errorCodes(frame: ParsedFrame): string[] {
  return frame.errors.map((error) => error.code);
}

const MSG_ADVERTISE = 0x00;
const MSG_CONNECT = 0x04;
const MSG_REGISTER = 0x0a;
const MSG_PUBLISH = 0x0c;
const MSG_SUBSCRIBE = 0x12;
const MSG_DISCONNECT = 0x18;
const MSG_PINGREQ = 0x16;

const QOS_SHIFT = 5;
const TOPIC_TYPE_PREDEFINED = 0b01;
const TOPIC_TYPE_SHORT = 0b10;
const TOPIC_TYPE_RESERVED = 0b11;

function ascii(text: string): number[] {
  return Array.from(text, (character) => character.charCodeAt(0));
}

function word(value: number): number[] {
  return [(value >>> 8) & 0xff, value & 0xff];
}

/** Uzunluk KENDİNİ DE sayar — MQTT'nin Remaining Length'inin tersi. */
function message(messageType: number, body: readonly number[]): Uint8Array {
  return Uint8Array.from([body.length + 2, messageType, ...body]);
}

describe('mqttSnParser', () => {
  it('Length KENDİNİ DE sayar — MQTT’nin Remaining Length’i saymaz', () => {
    // PINGREQ gövdesiz: toplam 2 bayt, Length alanı da 2 yazar.
    const { frame } = expectSuccess(parseMqttSn(message(MSG_PINGREQ, [])));

    const length = fieldById(frame, 'length');
    expect(length.rawValue).toBe(2);
    expect(length.length).toBe(1);
    // MQTT olsaydı aynı mesaj için Remaining Length 0 yazardı.
    expect(fieldById(frame, 'message-type').physicalValue).toBe('PINGREQ');
  });

  it('üç baytlık uzunluk biçimi VBI DEĞİLDİR', () => {
    const bytes = Uint8Array.from([
      0x01,
      ...word(268),
      MSG_PUBLISH,
      1 << QOS_SHIFT,
      ...word(0x0012),
      ...word(9),
      ...new Array<number>(259).fill(0x5a),
    ]);
    const { frame } = expectSuccess(parseMqttSn(bytes));

    // MQTT-SN: 0x01 "uzunluk sonraki iki baytta" demektir → 268.
    expect(fieldById(frame, 'length').rawValue).toBe(268);
    expect(fieldById(frame, 'length').length).toBe(3);

    // Aynı baytları MQTT'nin VBI'ı okusaydı "1" derdi ve tek bayt tüketirdi.
    const asVbi = decodeVariableByteInteger(bytes, 0);
    expect(asVbi.success).toBe(true);
    if (asVbi.success) {
      expect(asVbi.value).toBe(1);
      expect(asVbi.length).toBe(1);
    }
  });

  it('kısa biçimde gereksiz üç baytlık uzunluğu uyarır', () => {
    const bytes = Uint8Array.from([0x01, ...word(6), MSG_ADVERTISE, 7, ...word(900)]);
    const { frame } = expectSuccess(parseMqttSn(bytes));

    expect(fieldById(frame, 'length').rawValue).toBe(6);
    expect(warningCodes(frame)).toContain('protocol.mqttSn.warning.nonMinimalLength');
  });

  it('QoS 0b11 hata değil, −1 demektir', () => {
    const { frame } = expectSuccess(
      parseMqttSn(
        message(MSG_PUBLISH, [(0b11 << QOS_SHIFT) | TOPIC_TYPE_PREDEFINED, ...word(1), ...word(0), ...ascii('42')]),
      ),
    );

    // mqtt.ts aynı bit kalıbında `invalid-qos` hatası basar.
    expect(frame.valid).toBe(true);
    expect(fieldById(frame, 'qos').physicalValue).toBe('-1');
    expect(warningCodes(frame)).toContain('protocol.mqttSn.warning.qosMinusOne');
  });

  it('kısa topic adında iki bayt SAYI değil METİNDİR', () => {
    const { frame } = expectSuccess(
      parseMqttSn(message(MSG_PUBLISH, [TOPIC_TYPE_SHORT, ...ascii('ab'), ...word(7), ...ascii('on')])),
    );

    const topic = fieldById(frame, 'topic-id');
    expect(topic.name).toBe('Short Topic Name');
    expect(topic.rawValue).toBe('ab');
    // Tipe bakmadan sayı basmak 0x6162 gösterirdi.
    expect(topic.rawValue).not.toBe(0x6162);
  });

  it('normal topic id tipinde iki bayt sayıdır', () => {
    const { frame } = expectSuccess(
      parseMqttSn(message(MSG_PUBLISH, [1 << QOS_SHIFT, ...word(0x0012), ...word(42), ...ascii('23.4')])),
    );

    expect(fieldById(frame, 'topic-id').rawValue).toBe(0x0012);
    expect(fieldById(frame, 'topic-id').physicalValue).toBe('0x0012');
    expect(fieldById(frame, 'message-id').rawValue).toBe(42);
    expect(fieldById(frame, 'qos').physicalValue).toBe('1');
    expect(warningCodes(frame)).toContain('protocol.mqttSn.warning.topicMappingNeedsStream');
  });

  it('rezerve topic id tipini uyarır', () => {
    const { frame } = expectSuccess(
      parseMqttSn(message(MSG_PUBLISH, [TOPIC_TYPE_RESERVED, ...word(1), ...word(1), 0x00])),
    );

    expect(fieldById(frame, 'topic-id-type').valid).toBe(false);
    expect(warningCodes(frame)).toContain('protocol.mqttSn.warning.topicIdTypeReserved');
  });

  it('ADVERTISE gövdesini gateway id ve süreye ayırır', () => {
    const { frame } = expectSuccess(parseMqttSn(message(MSG_ADVERTISE, [7, ...word(900)])));

    expect(fieldById(frame, 'gateway-id').rawValue).toBe(7);
    expect(fieldById(frame, 'duration').rawValue).toBe(900);
  });

  it('CONNECT gövdesini bayraklar / protokol / süre / client id olarak çözer', () => {
    const { frame } = expectSuccess(
      parseMqttSn(message(MSG_CONNECT, [0x04, 0x01, ...word(60), ...ascii('sensor-01')])),
    );

    expect(fieldById(frame, 'flags').physicalValue).toBe('CleanSession');
    expect(fieldById(frame, 'protocol-id').rawValue).toBe(0x01);
    expect(fieldById(frame, 'duration').rawValue).toBe(60);
    expect(fieldById(frame, 'client-id').rawValue).toBe('sensor-01');
  });

  it('REGISTER topic adı eşlemesini çözer ve akış işi olduğunu bildirir', () => {
    const { frame } = expectSuccess(
      parseMqttSn(message(MSG_REGISTER, [...word(0x0012), ...word(1), ...ascii('room/temperature')])),
    );

    expect(fieldById(frame, 'topic-id').rawValue).toBe(0x0012);
    expect(fieldById(frame, 'topic-name').rawValue).toBe('room/temperature');
    expect(warningCodes(frame)).toContain('protocol.mqttSn.warning.topicMappingNeedsStream');
  });

  it('SUBSCRIBE normal tipte topic ADI taşır, id değil', () => {
    const { frame } = expectSuccess(
      parseMqttSn(message(MSG_SUBSCRIBE, [0x00, ...word(3), ...ascii('room/+')])),
    );

    expect(fieldById(frame, 'topic-name').rawValue).toBe('room/+');
    expect(hasField(frame, 'topic-id')).toBe(false);
  });

  it('DISCONNECT’in süresi opsiyoneldir', () => {
    const plain = expectSuccess(parseMqttSn(message(MSG_DISCONNECT, [])));
    expect(hasField(plain.frame, 'duration')).toBe(false);

    const sleeping = expectSuccess(parseMqttSn(message(MSG_DISCONNECT, [...word(300)])));
    expect(fieldById(sleeping.frame, 'duration').rawValue).toBe(300);
  });

  it('bildirilen uzunluk tampondan büyükse truncated-frame basar', () => {
    const { frame } = expectSuccess(parseMqttSn(Uint8Array.from([20, MSG_PINGREQ])));

    expect(frame.valid).toBe(false);
    expect(errorCodes(frame)).toContain('truncated-frame');
  });

  it('kendi alanını bile karşılamayan uzunluğu reddeder', () => {
    const { frame } = expectSuccess(parseMqttSn(Uint8Array.from([0x01, 0x00, 0x00, MSG_PINGREQ])));

    expect(frame.valid).toBe(false);
    expect(errorCodes(frame)).toContain('length-mismatch');
  });

  it('bildirilen uzunluktan fazla bayt varsa sonraki mesaj sayıp uyarır', () => {
    // Aynı datagramda iki mesaj: PINGREQ + PINGRESP.
    const { frame } = expectSuccess(parseMqttSn(Uint8Array.from([2, MSG_PINGREQ, 2, 0x17])));

    expect(warningCodes(frame)).toContain('protocol.mqttSn.warning.lengthMismatch');
  });

  it('tanınmayan mesaj tipinin gövdesini ham bırakır', () => {
    const { frame } = expectSuccess(parseMqttSn(message(0x7f, [1, 2, 3])));

    expect(warningCodes(frame)).toContain('protocol.mqttSn.warning.unknownMessageType');
    expect(fieldById(frame, 'body').length).toBe(3);
  });

  it('profilin resmi OASIS standardı olmadığını her mesajda bildirir', () => {
    const { frame } = expectSuccess(parseMqttSn(message(MSG_PINGREQ, [])));

    expect(warningCodes(frame)).toContain('protocol.mqttSn.warning.profileNotOasisStandard');
  });

  it('maxFrameLength ve iptal edilmiş signal ayrı ayrı durdurur', () => {
    const bytes = message(MSG_ADVERTISE, [7, ...word(900)]);
    expect(expectFailure(mqttSnParser.parse(bytes, { maxFrameLength: 2 })).error.code).toBe('frame-too-long');

    const controller = new AbortController();
    controller.abort();
    expect(expectFailure(mqttSnParser.parse(bytes, { signal: controller.signal })).error.code).toBe('parser-timeout');
  });

  it('canParse uzunluk iddiasına bakar, mesaj tipine değil', () => {
    expect(mqttSnParser.canParse(message(MSG_PINGREQ, []))).toBe(true);
    // Tanınmayan tip ön elemede reddedilmez.
    expect(mqttSnParser.canParse(message(0x7f, [1]))).toBe(true);
    // Uzunluk tampondan büyük.
    expect(mqttSnParser.canParse(Uint8Array.from([200, MSG_PINGREQ]))).toBe(false);
  });
});

describe('mqttSnPlugin', () => {
  it('örnekleri beyan ettikleri geçerlilikle çözülür', () => {
    for (const example of mqttSnPlugin.exampleFrames) {
      const result = parseMqttSn(example.bytes);
      if (example.expectedValid === false) {
        const invalid = !result.success || !result.frame.valid;
        expect(invalid, `${example.id} geçersiz olmalıydı`).toBe(true);
        continue;
      }
      const { frame } = expectSuccess(result);
      expect(frame.valid, `${example.id} geçerli olmalıydı`).toBe(true);
    }
  });

  it('plugin kimliği ve kategorisi katalogla aynı', () => {
    expect(mqttSnPlugin.id).toBe('mqtt-sn');
    expect(mqttSnPlugin.category).toBe('network-ethernet');
    expect(mqttSnPlugin.parser).toBe(mqttSnParser);
  });
});
