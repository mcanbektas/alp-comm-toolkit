import { describe, expect, it } from 'vitest';

import { mqttParser } from './mqtt';
import {
  MQTT_DISCONNECT_PACKET,
  MQTT_PACKET_TYPE_CONNACK,
  MQTT_WEBSOCKET_SUBPROTOCOL,
  createMqttPacketAssembler,
  encodeMqttConnectPacket,
  readMqttConnack,
} from './mqttSession';

import type { MqttControlPacket } from './mqttSession';

/**
 * Fixture uydurulmadı: üretilen CONNECT'in ALANLARI deponun kendi `mqtt`
 * çözücüsüne okutuluyor. Encoder'ın kendi sabitlerini tekrar eden bir bekleme
 * dizisi yazmak, encoder'ın kendisini iki kere yazmak olurdu — `mqttEncoders`
 * testinin de disiplini bu.
 */
function parseFields(bytes: Uint8Array): ReadonlyMap<string, string> {
  const result = mqttParser.parse(bytes);
  if (!result.success) {
    throw new Error(`expected success, got error "${result.error.code}"`);
  }

  const values = new Map<string, string>();
  for (const field of result.frame.fields) {
    values.set(field.name, String(field.physicalValue ?? field.rawValue));
  }
  return values;
}

function controlPacket(bytes: Uint8Array): MqttControlPacket {
  const assembler = createMqttPacketAssembler();
  const packets = assembler.push(bytes);
  expect(packets).toHaveLength(1);
  const [packet] = packets;
  if (packet === undefined) throw new Error('unreachable');
  return packet;
}

describe('encodeMqttConnectPacket', () => {
  it('writes a 3.1.1 CONNECT whose fields the repo\'s own MQTT parser reads back', () => {
    const packet = encodeMqttConnectPacket({ clientId: 'alp-comm-1' });

    // Fixed header: CONNECT (tip 3'ün değil, 1'in üst nibble'ı) + flags 0.
    expect(packet[0]).toBe(0x10);

    const fields = parseFields(packet);
    expect(fields.get('Packet Type')).toBe('CONNECT');
    expect(fields.get('Protocol Name')).toBe('MQTT');
    // Çözücü Level 4'ü kendi sürüm adıyla basıyor. Level 5 olsaydı encoder v5
    // biçimli PUBLISH borçlanırdı (dosya başı).
    expect(fields.get('Protocol Level')).toBe('MQTT 3.1.1');
    expect(fields.get('Client Identifier')).toBe('alp-comm-1');
  });

  /** Sabitlenen üç oturum parametresi (dosya başı) telde de sabit olmalı. */
  it('pins clean session on, and leaves the credential and will flags off', () => {
    const packet = encodeMqttConnectPacket({ clientId: 'x' });

    // Fixed header (1) + Remaining Length (1 bayt, gövde 128'in altında) +
    // Protocol Name (6) + Level (1) → Connect Flags 9. konumda.
    expect(packet[9]).toBe(0x02);
  });

  it('defaults keep alive to zero so a one-shot publisher owes no PINGREQ', () => {
    const packet = encodeMqttConnectPacket({ clientId: 'x' });
    expect(packet[10]).toBe(0x00);
    expect(packet[11]).toBe(0x00);
  });

  it('writes a caller supplied keep alive big-endian', () => {
    const packet = encodeMqttConnectPacket({ clientId: 'x', keepAliveSeconds: 0x0102 });
    expect(packet[10]).toBe(0x01);
    expect(packet[11]).toBe(0x02);
  });

  it('encodes the client identifier as UTF-8, not as one byte per character', () => {
    const packet = encodeMqttConnectPacket({ clientId: 'ölçüm' });
    const fields = parseFields(packet);
    expect(fields.get('Client Identifier')).toBe('ölçüm');
  });

  /** Boş kimlik sunucunun SEÇİMLİK kimlik atamasına bel bağlamak olurdu (dosya başı). */
  it('refuses an empty client identifier instead of hoping the broker assigns one', () => {
    expect(() => encodeMqttConnectPacket({ clientId: '' })).toThrow(RangeError);
  });

  it('refuses a keep alive outside the two byte field', () => {
    expect(() => encodeMqttConnectPacket({ clientId: 'x', keepAliveSeconds: 65_536 })).toThrow(RangeError);
    expect(() => encodeMqttConnectPacket({ clientId: 'x', keepAliveSeconds: -1 })).toThrow(RangeError);
    expect(() => encodeMqttConnectPacket({ clientId: 'x', keepAliveSeconds: 1.5 })).toThrow(RangeError);
  });
});

describe('readMqttConnack', () => {
  it('reads an accepted CONNACK', () => {
    const result = readMqttConnack(controlPacket(Uint8Array.from([0x20, 0x02, 0x00, 0x00])));
    expect(result).toEqual({
      ok: true,
      connack: {
        sessionPresent: false,
        returnCode: 0,
        accepted: true,
        description: 'Connection Accepted',
      },
    });
  });

  it('reads a refusal with the spec\'s own wording', () => {
    const result = readMqttConnack(controlPacket(Uint8Array.from([0x20, 0x02, 0x00, 0x05])));
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(result.connack.accepted).toBe(false);
    expect(result.connack.returnCode).toBe(5);
    expect(result.connack.description).toBe('Connection Refused, not authorized');
  });

  it('reports the session present bit', () => {
    const result = readMqttConnack(controlPacket(Uint8Array.from([0x20, 0x02, 0x01, 0x00])));
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(result.connack.sessionPresent).toBe(true);
  });

  /** Tanınmayan kod ADLANDIRILMAZ — uydurma açıklama yasak (dosya başı). */
  it('leaves an unknown return code undescribed rather than inventing a meaning', () => {
    const result = readMqttConnack(controlPacket(Uint8Array.from([0x20, 0x02, 0x00, 0x7f])));
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(result.connack.returnCode).toBe(0x7f);
    expect(result.connack.description).toBeUndefined();
    expect(result.connack.accepted).toBe(false);
  });

  /**
   * v5 CONNACK'i aynı iki bilgi baytının ardına Properties ekler; ilk iki baytın
   * anlamı iki sürümde de aynı olduğu için karar yine okunabilir.
   */
  it('still decides on a CONNACK longer than two bytes', () => {
    const result = readMqttConnack(controlPacket(Uint8Array.from([0x20, 0x03, 0x00, 0x00, 0x00])));
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(result.connack.accepted).toBe(true);
  });

  it('classifies a non CONNACK packet apart from a truncated one', () => {
    // PINGRESP — broker protokolü konuşuyor ama beklenen cevap bu değil.
    expect(readMqttConnack(controlPacket(Uint8Array.from([0xd0, 0x00])))).toEqual({
      ok: false,
      reason: 'wrong-packet-type',
    });
    expect(readMqttConnack(controlPacket(Uint8Array.from([0x20, 0x01, 0x00])))).toEqual({
      ok: false,
      reason: 'too-short',
    });
  });
});

describe('createMqttPacketAssembler', () => {
  /** OASIS §6: WebSocket çerçevesi MQTT paketiyle hizalı DEĞİLDİR. */
  it('reassembles one packet split across chunks', () => {
    const assembler = createMqttPacketAssembler();

    expect(assembler.push(Uint8Array.from([0x20, 0x02]))).toEqual([]);
    expect(assembler.push(Uint8Array.from([0x00]))).toEqual([]);

    const packets = assembler.push(Uint8Array.from([0x00]));
    expect(packets).toHaveLength(1);
    expect(packets[0]?.packetType).toBe(MQTT_PACKET_TYPE_CONNACK);
    expect(packets[0]?.remaining).toEqual(Uint8Array.from([0x00, 0x00]));
  });

  it('splits two packets arriving in one chunk', () => {
    const assembler = createMqttPacketAssembler();
    const packets = assembler.push(Uint8Array.from([0x20, 0x02, 0x00, 0x00, 0xd0, 0x00]));

    expect(packets.map((packet) => packet.packetType)).toEqual([MQTT_PACKET_TYPE_CONNACK, 13]);
    expect(packets[1]?.bytes).toEqual(Uint8Array.from([0xd0, 0x00]));
  });

  it('keeps the trailing partial packet for the next chunk', () => {
    const assembler = createMqttPacketAssembler();
    expect(assembler.push(Uint8Array.from([0x20, 0x02, 0x00, 0x00, 0x20, 0x02, 0x01]))).toHaveLength(1);
    expect(assembler.push(Uint8Array.from([0x00]))).toHaveLength(1);
  });

  it('reads a multi byte Remaining Length', () => {
    const body = new Uint8Array(200).fill(0x41);
    // 200 = VBI `C8 01`.
    const frame = Uint8Array.from([0x30, 0xc8, 0x01, ...body]);
    const assembler = createMqttPacketAssembler();
    const packets = assembler.push(frame);
    expect(packets).toHaveLength(1);
    expect(packets[0]?.remaining.length).toBe(200);
  });

  /** Bozuk akış LATCH'lenir: MQTT'de resenkronizasyon yapılamaz (dosya başı). */
  it('latches malformed and never resynchronises', () => {
    const assembler = createMqttPacketAssembler();
    // Dört bayt boyunca devam biti set — OASIS'in "malformed" kuralı.
    assembler.push(Uint8Array.from([0x20, 0xff, 0xff, 0xff, 0xff, 0x7f]));

    expect(assembler.malformed).toBe(true);
    expect(assembler.push(Uint8Array.from([0x20, 0x02, 0x00, 0x00]))).toEqual([]);
  });

  it('treats a packet larger than the reader\'s budget as malformed instead of buffering it', () => {
    const assembler = createMqttPacketAssembler({ maxPacketLength: 8 });
    expect(assembler.push(Uint8Array.from([0x30, 0x40]))).toEqual([]);
    expect(assembler.malformed).toBe(true);
  });

  it('copies packet bytes so a stored packet survives the next chunk', () => {
    const assembler = createMqttPacketAssembler();
    const packets = assembler.push(Uint8Array.from([0x20, 0x02, 0x00, 0x00]));
    const stored = packets[0]?.bytes;
    assembler.push(Uint8Array.from([0xd0, 0x00]));
    expect(stored).toEqual(Uint8Array.from([0x20, 0x02, 0x00, 0x00]));
  });
});

describe('session constants', () => {
  it('offers the subprotocol OASIS makes mandatory over WebSocket', () => {
    expect(MQTT_WEBSOCKET_SUBPROTOCOL).toBe('mqtt');
  });

  it('has a DISCONNECT the parser recognises', () => {
    const fields = parseFields(MQTT_DISCONNECT_PACKET);
    expect(fields.get('Packet Type')).toBe('DISCONNECT');
  });
});
