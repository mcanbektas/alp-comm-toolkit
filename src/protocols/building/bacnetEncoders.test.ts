import { describe, expect, it } from 'vitest';

import { encodeBacnetIpFrame, parseBacnetIp } from './bacnetip/bacnetip';
import { encodeBacnetMstpFrame, parseBacnetMstp } from './bacnetmstp/bacnetmstp';

/**
 * İki taşımanın da ölçütü çözücünün SPEC'TEN türetilmiş örnek çerçevesidir.
 * Bu iki encoder tam olarak dosya başlarında yazılı üç tuzağın üstünde duruyor
 * (BVLC Length kendini sayar · MS/TP Length yalnız veriyi sayar · Data CRC
 * koşulludur), o yüzden iddialar da o tuzakların etrafında.
 */

/** Read-Property isteğinin NPDU'su — `bacnetip.ts`in örnek çerçevesinin gövdesi. */
const READ_PROPERTY_NPDU = Uint8Array.from([0x01, 0x04, 0x00, 0x25, 0x01, 0x0c, 0xaa, 0xbb, 0xcc]);

describe('encodeBacnetIpFrame', () => {
  it('produces the decoder example frame byte for byte', () => {
    expect(encodeBacnetIpFrame(READ_PROPERTY_NPDU)).toEqual(
      Uint8Array.from([0x81, 0x0a, 0x00, 0x0d, ...Array.from(READ_PROPERTY_NPDU)]),
    );
  });

  /** MBAP'ın TERSİNE: BVLC Length başlığın dört baytını DA sayar. */
  it('counts the BVLC header inside its own length field', () => {
    const frame = encodeBacnetIpFrame(new Uint8Array(20));

    expect(Array.from(frame.subarray(2, 4))).toEqual([0x00, 24]);
    expect(frame.length).toBe(24);
  });

  it('is read back with no errors by its own parser', () => {
    const result = parseBacnetIp(encodeBacnetIpFrame(READ_PROPERTY_NPDU));

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.frame.errors).toEqual([]);
    expect(result.frame.valid).toBe(true);
  });

  it('refuses a body shorter than an NPDU header', () => {
    expect(() => encodeBacnetIpFrame(Uint8Array.from([0x01]))).toThrow(RangeError);
  });
});

describe('encodeBacnetMstpFrame', () => {
  it('produces the data frame example, Data CRC LSB first', () => {
    // Frame Type 0x05 (Data Expecting Reply), hedef 0x0A, kaynak 0x01.
    const body = Uint8Array.from([0x05, 0x0a, 0x01, ...Array.from(READ_PROPERTY_NPDU)]);

    expect(encodeBacnetMstpFrame(body)).toEqual(
      Uint8Array.from([
        0x55, 0xff, 0x05, 0x0a, 0x01, 0x00, 0x09, 0xa8, 0x01, 0x04, 0x00, 0x25, 0x01, 0x0c, 0xaa, 0xbb,
        0xcc, 0x58, 0x49,
      ]),
    );
  });

  /**
   * Verisiz çerçevede Data CRC HİÇ YAZILMAZ — sabit uzunluk varsayan bir
   * üretici Token çerçevesine iki bayt çöp eklerdi.
   */
  it('omits the Data CRC when there is no data', () => {
    // Token: Frame Type 0x00, hedef 0x01, kaynak 0x05.
    expect(encodeBacnetMstpFrame(Uint8Array.from([0x00, 0x01, 0x05]))).toEqual(
      Uint8Array.from([0x55, 0xff, 0x00, 0x01, 0x05, 0x00, 0x00, 0x8d]),
    );
  });

  /** Length yalnız VERİYİ sayar: ne başlığı ne CRC'leri. */
  it('counts only the data in the length field', () => {
    const frame = encodeBacnetMstpFrame(Uint8Array.from([0x06, 0xff, 0x0a, ...new Array<number>(30).fill(0x11)]));

    expect(Array.from(frame.subarray(5, 7))).toEqual([0x00, 30]);
    expect(frame.length).toBe(8 + 30 + 2);
  });

  it('is read back with no errors by its own parser', () => {
    const frame = encodeBacnetMstpFrame(Uint8Array.from([0x00, 0x01, 0x05]));

    const result = parseBacnetMstp(frame);

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.frame.errors).toEqual([]);
    expect(result.frame.valid).toBe(true);
  });

  it('refuses a body without the three header bytes', () => {
    expect(() => encodeBacnetMstpFrame(Uint8Array.from([0x00, 0x01]))).toThrow(RangeError);
  });

  it('refuses data past the MS/TP maximum', () => {
    const body = Uint8Array.from([0x05, 0x0a, 0x01, ...new Array<number>(502).fill(0)]);

    expect(() => encodeBacnetMstpFrame(body)).toThrow(RangeError);
  });
});
