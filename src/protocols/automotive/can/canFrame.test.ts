import { describe, expect, it } from 'vitest';

import {
  CAN_FD_DLC_LENGTHS,
  CAN_HEADER_LENGTH,
  approximateFrameBits,
  decodeCanId,
  decodeSocketCanFrame,
  dlcForLength,
  formatHex,
  lengthForDlc,
  readUint16Le,
  readUint32Le,
} from './canFrame';
import type { ParsedField } from '@/protocol-core/types';

function bytes(hex: string): Uint8Array {
  const cleaned = hex.replace(/\s+/g, '');
  const result = new Uint8Array(cleaned.length / 2);
  for (let index = 0; index < result.length; index += 1) {
    result[index] = Number.parseInt(cleaned.slice(index * 2, index * 2 + 2), 16);
  }
  return result;
}

function byId(fields: readonly ParsedField[], id: string): ParsedField {
  const found = fields.find((field) => field.id === id);
  if (found === undefined) {
    throw new Error(`field "${id}" not found; got ${fields.map((f) => f.id).join(', ')}`);
  }
  return found;
}

/** Spec §43 fixture identifier'ı, SocketCAN düzeninde: 0x18F00401 + EFF bayrağı. */
const J1939_FRAME = bytes('01 04 F0 98 08 00 00 00 FF FF FF 68 13 FF FF FF');
/** Base çerçeve: CAN ID 0x321, DLC 8 (spec §3.4'ün DLC örneği). */
const BASE_FRAME = bytes('21 03 00 00 08 00 00 00 10 27 00 64 12 34 FF 00');

describe('readUint32Le / readUint16Le', () => {
  it('little-endian okur — SocketCAN alanları ana makine sırasındadır', () => {
    expect(readUint32Le(J1939_FRAME, 0)).toBe(0x98f00401);
    expect(readUint16Le(bytes('34 12'), 0)).toBe(0x1234);
  });

  it('üst biti set 32-bit değeri NEGATİFE ÇEVİRMEZ', () => {
    // `>>> 0` olmasaydı 0x98F00401 işaretli okunup negatif dönerdi ve
    // maskeleme tamamen yanlış identifier üretirdi.
    expect(readUint32Le(bytes('00 00 00 80'), 0)).toBe(0x80000000);
    expect(readUint32Le(bytes('00 00 00 80'), 0)).toBeGreaterThan(0);
  });
});

describe('decodeCanId', () => {
  it('EFF bayrağını identifier’dan AYIRIR', () => {
    const identity = decodeCanId(0x98f00401);
    // Bayrak maskelenmezse identifier 0x98F00401 okunur ve J1939 priority’si
    // 6 yerine 4 çıkardı.
    expect(identity.id).toBe(0x18f00401);
    expect(identity.extended).toBe(true);
    expect(identity.remote).toBe(false);
    expect(identity.errorFrame).toBe(false);
    expect(identity.rawId).toBe(0x98f00401);
  });

  it('base identifier’ı 11 bite maskeler', () => {
    const identity = decodeCanId(0x00000321);
    expect(identity.id).toBe(0x321);
    expect(identity.extended).toBe(false);
  });

  it('RTR ve ERR bayraklarını ayrı ayrı okur', () => {
    expect(decodeCanId(0x40000123).remote).toBe(true);
    expect(decodeCanId(0x20000123).errorFrame).toBe(true);
    expect(decodeCanId(0x40000123).id).toBe(0x123);
  });
});

describe('CAN_FD_DLC_LENGTHS', () => {
  it('0-8 arası kod doğrudan bayt sayısıdır, kırılma 9’dan sonra başlar', () => {
    expect(CAN_FD_DLC_LENGTHS.slice(0, 9)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('spec’in saydığı uzunluk kümesini birebir kapsar', () => {
    // Spec tabloyu vermiyor ama hedef kümeyi sayıyor: "12, 16, 20, 24, 32, 48, 64".
    expect(CAN_FD_DLC_LENGTHS.slice(9)).toEqual([12, 16, 20, 24, 32, 48, 64]);
    expect(CAN_FD_DLC_LENGTHS).toHaveLength(16);
  });

  it('dlcForLength ve lengthForDlc birbirinin tersidir', () => {
    expect(dlcForLength(12)).toBe(9);
    expect(dlcForLength(64)).toBe(15);
    expect(lengthForDlc(9)).toBe(12);
    expect(lengthForDlc(15)).toBe(64);
  });

  it('kanonik olmayan uzunlukta DLC kodu üretmez', () => {
    // 13 bayt gerçek bir CAN FD çerçevesinde olamaz.
    expect(dlcForLength(13)).toBeUndefined();
    expect(dlcForLength(65)).toBeUndefined();
  });
});

describe('approximateFrameBits — spec §17.2', () => {
  it('standard: 47 + 8 × DLC, extended: 67 + 8 × DLC', () => {
    expect(approximateFrameBits(0, false)).toBe(47);
    expect(approximateFrameBits(8, false)).toBe(47 + 64);
    expect(approximateFrameBits(8, true)).toBe(67 + 64);
  });
});

describe('formatHex', () => {
  it('büyük harf hex üretir ve istenen haneye sıfırla doldurur', () => {
    expect(formatHex(0x1f, 2)).toBe('0x1F');
    expect(formatHex(0x4, 2)).toBe('0x04');
    expect(formatHex(0x18f00401, 8)).toBe('0x18F00401');
  });
});

describe('decodeSocketCanFrame — classic', () => {
  it('identifier, DLC ve payload alanlarını üretir', () => {
    const result = decodeSocketCanFrame(BASE_FRAME, { kind: 'classic' });
    expect(byId(result.fields, 'can-id').rawValue).toBe(0x321);
    expect(byId(result.fields, 'can-id').physicalValue).toBe('Base / 11-bit');
    expect(byId(result.fields, 'dlc').rawValue).toBe(8);
    const data = byId(result.fields, 'data');
    expect(data.offset).toBe(CAN_HEADER_LENGTH);
    expect(data.length).toBe(8);
    expect(result.payloadLength).toBe(8);
  });

  it('extended çerçevede identifier biçimini extended raporlar', () => {
    const result = decodeSocketCanFrame(J1939_FRAME, { kind: 'classic' });
    expect(byId(result.fields, 'can-id').rawValue).toBe(0x18f00401);
    expect(byId(result.fields, 'can-id').physicalValue).toBe('Extended / 29-bit');
    expect(byId(result.fields, 'ide').physicalValue).toBe('Extended');
  });

  it('sayfanın beklediği biçim uyuşmazsa UYARIR, hata üretmez', () => {
    const onBasePage = decodeSocketCanFrame(J1939_FRAME, {
      kind: 'classic',
      expectedFormat: 'base',
    });
    expect(onBasePage.warnings).toContain('protocol.can.frame.warning.extendedOnBasePage');
    // Uyarıya rağmen çerçeve tam çözülür.
    expect(onBasePage.payloadLength).toBe(8);

    const onExtendedPage = decodeSocketCanFrame(BASE_FRAME, {
      kind: 'classic',
      expectedFormat: 'extended',
    });
    expect(onExtendedPage.warnings).toContain('protocol.can.frame.warning.baseOnExtendedPage');
  });

  it('29-bit identifier’da üst katman adaylarını hatırlatır', () => {
    const result = decodeSocketCanFrame(J1939_FRAME, {
      kind: 'classic',
      suggestHigherLayers: true,
    });
    // Spec: "29-bit ID tek başına protokol kanıtı değildir".
    expect(result.warnings).toContain('protocol.can.frame.warning.higherLayerCandidates');
  });

  it('base identifier’da üst katman uyarısı BASMAZ', () => {
    const result = decodeSocketCanFrame(BASE_FRAME, {
      kind: 'classic',
      suggestHigherLayers: true,
    });
    expect(result.warnings).not.toContain('protocol.can.frame.warning.higherLayerCandidates');
  });

  it('bildirilen uzunluk elde olandan büyükse kısaltır ve uyarır', () => {
    // DLC 8 diyor ama gövdede yalnız 3 bayt var.
    const short = bytes('21 03 00 00 08 00 00 00 AA BB CC');
    const result = decodeSocketCanFrame(short, { kind: 'classic' });
    expect(result.warnings).toContain('protocol.can.frame.warning.truncatedPayload');
    expect(result.payloadLength).toBe(3);
    expect(byId(result.fields, 'data').length).toBe(3);
  });

  it('remote frame veri taşıyorsa uyarır', () => {
    const remote = bytes('23 01 00 40 02 00 00 00 AA BB 00 00 00 00 00 00');
    const result = decodeSocketCanFrame(remote, { kind: 'classic' });
    expect(byId(result.fields, 'rtr').physicalValue).toBe('Remote Frame');
    expect(result.warnings).toContain('protocol.can.frame.warning.remoteWithPayload');
  });

  it('ERR bayrağı set çerçevede uyarır ama çözümü sürdürür', () => {
    const errorFrame = bytes('23 01 00 20 08 00 00 00 01 02 03 04 05 06 07 08');
    const result = decodeSocketCanFrame(errorFrame, { kind: 'classic' });
    expect(result.warnings).toContain('protocol.can.frame.warning.errorFlagSet');
    expect(result.payloadLength).toBe(8);
  });

  it('RTR/IDE bayrak alanları identifier’ın TAMAMINI değil 3. baytı kaplar', () => {
    // Bekçi — tarayıcı turunda görülen kusur: bayrak alanlarına identifier'ın
    // dört baytı verilince byte-viewer'da `can-id` bölgesini tamamen örtüyor ve
    // CAN ID satırına tıklayınca hiçbir bayt vurgulanmıyordu. Bayraklar
    // SocketCAN'de `can_id`in 29-31. bitlerinde, yani little-endian düzende
    // dördüncü bayttadır.
    const result = decodeSocketCanFrame(J1939_FRAME, { kind: 'classic' });
    for (const id of ['rtr', 'ide']) {
      expect(byId(result.fields, id).offset, id).toBe(3);
      expect(byId(result.fields, id).length, id).toBe(1);
    }
    // Identifier alanı dört baytı kapsamayı sürdürür; ilk üç baytı bayraklara
    // kaptırmaz.
    expect(byId(result.fields, 'can-id').offset).toBe(0);
    expect(byId(result.fields, 'can-id').length).toBe(4);
  });

  it('payload 0 olduğunda hayalet veri alanı üretmez', () => {
    const empty = bytes('23 01 00 00 00 00 00 00 00 00 00 00 00 00 00 00');
    const result = decodeSocketCanFrame(empty, { kind: 'classic' });
    expect(result.fields.some((field) => field.id === 'data')).toBe(false);
  });
});

describe('decodeSocketCanFrame — CAN FD', () => {
  it('uzunluktan DLC kodunu GERİ TÜRETİR', () => {
    // canfd_frame.len GERÇEK uzunluktur (12), DLC kodu (9) gösterim için türetilir.
    const fd = bytes('23 01 00 00 0C 05 00 00 00 01 02 03 04 05 06 07 08 09 0A 0B');
    const result = decodeSocketCanFrame(fd, { kind: 'fd' });
    const lengthField = byId(result.fields, 'payload-length');
    expect(lengthField.rawValue).toBe(12);
    expect(lengthField.physicalValue).toBe('DLC 9');
    expect(result.payloadLength).toBe(12);
  });

  it('FDF/BRS/ESI bayraklarını ayrı alanlara açar', () => {
    const fd = bytes('23 01 00 00 08 07 00 00 00 01 02 03 04 05 06 07');
    const result = decodeSocketCanFrame(fd, { kind: 'fd' });
    expect(byId(result.fields, 'fdf').physicalValue).toBe('CAN FD Frame');
    expect(byId(result.fields, 'brs').physicalValue).toBe('Bit Rate Switched');
    expect(byId(result.fields, 'esi').physicalValue).toBe('Error Passive');
  });

  it('FDF bayrağı yoksa uyarır — kayıt tutarsızdır', () => {
    const noFdf = bytes('23 01 00 00 08 00 00 00 00 01 02 03 04 05 06 07');
    const result = decodeSocketCanFrame(noFdf, { kind: 'fd' });
    expect(result.warnings).toContain('protocol.can.frame.warning.missingFdfFlag');
  });

  it('kanonik olmayan uzunlukta alanı geçersiz işaretler', () => {
    const odd = bytes('23 01 00 00 0D 05 00 00').slice();
    const result = decodeSocketCanFrame(odd, { kind: 'fd' });
    expect(byId(result.fields, 'payload-length').valid).toBe(false);
    expect(result.warnings).toContain('protocol.can.frame.warning.nonCanonicalFdLength');
  });
});
