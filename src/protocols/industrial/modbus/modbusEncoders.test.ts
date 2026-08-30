import { describe, expect, it } from 'vitest';

import { bytesToHex } from '@/protocol-core/buffers/representation';

import { MODBUS_ASCII_EXAMPLE_FRAMES } from './modbusAscii';
import { encodeModbusAsciiFrame, encodeModbusRtuFrame, encodeModbusTcpFrame } from './modbusEncoders';

/**
 * Üç encoder'ın da doğruluk ölçütü AYNI: ürettiği çerçeve, çözücünün spec'ten
 * alınmış örnek çerçevesiyle BİREBİR eşleşmeli. Kendi ürettiğimizi kendi
 * çözücümüze verip "geçti" demek encoder'ın da çözücünün de aynı yanlışı
 * yaptığı durumu göremezdi; spec fixture'ı dışarıdan bir tanık.
 */

/** Read Holding Registers Request — spec §3.3'ün istek örneğinin gövdesi. */
const REQUEST_BODY = Uint8Array.from([0x01, 0x03, 0x00, 0x00, 0x00, 0x02]);

describe('encodeModbusRtuFrame', () => {
  it('produces the spec request frame, CRC low byte first', () => {
    // 01 03 00 00 00 02 C4 0B — `modbusRtu.ts`nin örnek çerçevesiyle aynı.
    expect(encodeModbusRtuFrame(REQUEST_BODY)).toEqual(
      Uint8Array.from([0x01, 0x03, 0x00, 0x00, 0x00, 0x02, 0xc4, 0x0b]),
    );
  });

  it('produces the spec exception frame', () => {
    // 01 83 02 C0 F1 — CRC'nin ters yazılması bu kısa çerçevede en görünürdür.
    expect(encodeModbusRtuFrame(Uint8Array.from([0x01, 0x83, 0x02]))).toEqual(
      Uint8Array.from([0x01, 0x83, 0x02, 0xc0, 0xf1]),
    );
  });

  it('refuses a body that leaves no room for a function code', () => {
    expect(() => encodeModbusRtuFrame(Uint8Array.from([0x01]))).toThrow(RangeError);
  });

  /** 254 + CRC = 256: ADU tavanının TAM üstünde duran ilk gövde. */
  it('refuses a body that would push the ADU past 256 bytes', () => {
    expect(() => encodeModbusRtuFrame(new Uint8Array(254))).not.toThrow();
    expect(() => encodeModbusRtuFrame(new Uint8Array(255))).toThrow(RangeError);
  });
});

describe('encodeModbusAsciiFrame', () => {
  it('produces the spec request frame verbatim', () => {
    const frame = encodeModbusAsciiFrame(REQUEST_BODY);

    expect(new TextDecoder().decode(frame)).toBe(':010300000002FA\r\n');
  });

  /**
   * Çözücünün kendi örnek çerçevesi tanık: encoder ile decoder ayrı ayrı
   * yazıldığı için ikisinin ayrışması ancak burada görülür.
   */
  it('matches the decoder example fixture byte for byte', () => {
    const fixture = MODBUS_ASCII_EXAMPLE_FRAMES.find((frame) => frame.id === 'read-holding-registers-request');

    expect(fixture).toBeDefined();
    expect(encodeModbusAsciiFrame(REQUEST_BODY)).toEqual(fixture?.bytes);
  });

  it('writes hex in upper case', () => {
    const frame = encodeModbusAsciiFrame(Uint8Array.from([0x01, 0x83, 0x02]));

    // :0183027A\r\n — küçük harf de çözülürdü ama spec'in dizgesi büyük harftir.
    expect(new TextDecoder().decode(frame)).toBe(':0183027A\r\n');
  });

  it('refuses a body shorter than address + function code', () => {
    expect(() => encodeModbusAsciiFrame(Uint8Array.from([0x01]))).toThrow(RangeError);
  });
});

describe('encodeModbusTcpFrame', () => {
  it('prefixes MBAP with the fixed transaction id and no checksum', () => {
    expect(encodeModbusTcpFrame(REQUEST_BODY)).toEqual(
      Uint8Array.from([0x00, 0x00, 0x00, 0x00, 0x00, 0x06, 0x01, 0x03, 0x00, 0x00, 0x00, 0x02]),
    );
  });

  /** `Length`, KENDİSİNDEN SONRAKİ baytları sayar — unit ID dahil. */
  it('counts the unit id inside the length field', () => {
    const frame = encodeModbusTcpFrame(new Uint8Array(20));

    expect(Array.from(frame.subarray(4, 6))).toEqual([0x00, 20]);
    expect(frame.length).toBe(26);
  });

  it('refuses a body shorter than unit id + function code', () => {
    expect(() => encodeModbusTcpFrame(Uint8Array.from([0x01]))).toThrow(RangeError);
  });
});

/**
 * Ortak girdinin asıl gerekçesi: aynı gövde üç taşıyıcıya da verilebilmeli.
 * Ayrı girdi tipleri seçilseydi bu test derlenmezdi (bkz. dosya başı).
 */
describe('shared body across carriers', () => {
  it('wraps one body into three different envelopes', () => {
    const rtu = encodeModbusRtuFrame(REQUEST_BODY);
    const ascii = encodeModbusAsciiFrame(REQUEST_BODY);
    const tcp = encodeModbusTcpFrame(REQUEST_BODY);

    // Gövde her üçünde de değişmeden durur; ayrışan yalnızca zarftır.
    expect(bytesToHex(rtu.subarray(0, REQUEST_BODY.length))).toBe(bytesToHex(REQUEST_BODY));
    expect(new TextDecoder().decode(ascii)).toContain(bytesToHex(REQUEST_BODY));
    expect(bytesToHex(tcp.subarray(6))).toBe(bytesToHex(REQUEST_BODY));

    expect(new Set([rtu.length, ascii.length, tcp.length]).size).toBe(3);
  });
});
