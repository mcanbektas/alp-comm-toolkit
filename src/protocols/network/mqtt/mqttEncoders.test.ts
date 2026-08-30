import { describe, expect, it } from 'vitest';

import { parseMqtt } from './mqtt';
import { encodeMqttPublishPacket } from './mqttEncoders';

/**
 * Ölçüt, Modbus encoder'larındakiyle aynı: üretilen paket çözücünün SPEC'TEN
 * alınmış örnek çerçevesiyle birebir eşleşmeli. `mqtt.ts`in `publish-qos0`
 * örneği dışarıdan tanıktır — encoder ile decoder'ın aynı yanlışı yapması
 * durumunu ancak o yakalar.
 */

function ascii(text: string): number[] {
  return Array.from(text, (character) => character.charCodeAt(0));
}

/** Topic "sensors/temp" (12 bayt) + payload "23.5" — örnek çerçevenin gövdesi. */
const PUBLISH_BODY = Uint8Array.from([0x00, 0x0c, ...ascii('sensors/temp'), ...ascii('23.5')]);

describe('encodeMqttPublishPacket', () => {
  it('produces the decoder example frame byte for byte', () => {
    expect(encodeMqttPublishPacket(PUBLISH_BODY)).toEqual(
      Uint8Array.from([0x30, 0x12, ...Array.from(PUBLISH_BODY)]),
    );
  });

  it('is read back as a valid PUBLISH by the parser', () => {
    const result = parseMqtt(encodeMqttPublishPacket(PUBLISH_BODY));

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.frame.errors).toEqual([]);
    expect(result.frame.valid).toBe(true);
    expect(result.consumedBytes).toBe(20);
  });

  /**
   * Remaining Length 127'yi aşınca VBI İKİ BAYTA çıkar. Tek baytlık bir uzunluk
   * varsayımı tam burada kırılır ve akış paketin ORTASINDA kayar.
   */
  it('grows the remaining length field past 127 bytes', () => {
    const body = Uint8Array.from([0x00, 0x01, 0x61, ...new Array<number>(200).fill(0x2a)]);

    const packet = encodeMqttPublishPacket(body);

    // 203 = 0xCB → VBI: CB 01 (devam biti + 1×128).
    expect(Array.from(packet.subarray(0, 3))).toEqual([0x30, 0xcb, 0x01]);
    expect(packet.length).toBe(3 + body.length);
  });

  it('refuses a body with no topic length field', () => {
    expect(() => encodeMqttPublishPacket(Uint8Array.from([0x00]))).toThrow(RangeError);
  });

  /** Boş topic sözdizimsel olarak çözülür ama broker reddeder. */
  it('refuses an empty topic name', () => {
    expect(() => encodeMqttPublishPacket(Uint8Array.from([0x00, 0x00, 0x41]))).toThrow(RangeError);
  });

  it('refuses a topic length the body cannot cover', () => {
    expect(() => encodeMqttPublishPacket(Uint8Array.from([0x00, 0x0c, 0x61, 0x62]))).toThrow(RangeError);
  });
});
