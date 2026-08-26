import { describe, expect, it } from 'vitest';

import { decodeManchester, encodeManchester } from './manchester';

/** Dalga 18e varsayılan profilinin sync sözcüğü ve IEEE 802.3 polaritesindeki teli. */
const SYNC_WORD = Uint8Array.from([0x2d, 0xd4]);
const SYNC_WORD_IEEE_WIRE = [0xa6, 0x59, 0x59, 0x9a];

describe('manchester — fixture', () => {
  it('IEEE 802.3 polaritesinde `2D D4` telde `A6 59 59 9A` olur', () => {
    // Elle türetildi ve burada motorla YENİDEN üretiliyor:
    // 0x2D = 0010 1101 → 10 10 01 10 01 01 10 01 → A6 59
    // 0xD4 = 1101 0100 → 01 01 10 01 10 01 10 10 → 59 9A
    expect([...encodeManchester(SYNC_WORD, 'ieee802.3')]).toEqual(SYNC_WORD_IEEE_WIRE);
  });

  it('tel iki katıdır ve gidiş-dönüş kayıpsızdır', () => {
    const wire = encodeManchester(SYNC_WORD, 'ieee802.3');
    expect(wire.length).toBe(SYNC_WORD.length * 2);
    const back = decodeManchester(wire, 'ieee802.3');
    expect(back.success).toBe(true);
    if (back.success) expect([...back.bytes]).toEqual([...SYNC_WORD]);
  });

  it('Thomas polaritesi IEEE 802.3\'ün BİT BİT tersidir', () => {
    const ieee = encodeManchester(SYNC_WORD, 'ieee802.3');
    const thomas = encodeManchester(SYNC_WORD, 'thomas');
    for (let index = 0; index < ieee.length; index += 1) {
      expect(thomas[index]).toBe((ieee[index] ?? 0) ^ 0xff);
    }
  });
});

describe('manchester — YANLIŞ POLARİTE HATA VERMEZ, sessizce tersler', () => {
  it('IEEE teli Thomas ile çözülünce her bayt bitwise NOT çıkar', () => {
    const wire = encodeManchester(SYNC_WORD, 'ieee802.3');
    const wrong = decodeManchester(wire, 'thomas');
    expect(wrong.success).toBe(true);
    if (wrong.success) {
      expect([...wrong.bytes]).toEqual([...SYNC_WORD].map((byte) => byte ^ 0xff));
      // 🚨 Kaydedilmiş OLGU: hiçbir hata üretilmedi. Polarite bu yüzden bir
      // ölçüm değil, kullanıcının BİLDİRİMİdir ve varsayılanı seçilemez.
      expect([...wrong.bytes]).not.toEqual([...SYNC_WORD]);
    }
  });
});

describe('manchester — geçersiz çift GERÇEK hatadır', () => {
  it('`00` çifti konumuyla bildirilir', () => {
    // 0x00'ın ilk çifti `00`: telde tanımsız.
    const result = decodeManchester(Uint8Array.from([0x00, 0x00]), 'ieee802.3');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.pair).toBe(0b00);
      expect(result.error.bitPairIndex).toBe(0);
      expect(result.error.wireOffset).toBe(0);
    }
  });

  it('`11` çifti konumuyla bildirilir ve konum İLK bozuk çifttir', () => {
    // İlk bayt geçerli (`A6` = 10 10 01 10), ikinci baytın ilk çifti `11`.
    const result = decodeManchester(Uint8Array.from([0xa6, 0xc9]), 'ieee802.3');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.pair).toBe(0b11);
      expect(result.error.bitPairIndex).toBe(4);
      expect(result.error.wireOffset).toBe(1);
    }
  });

  it('tek sayıda tel baytı reddedilir — son veri baytı yarımdır', () => {
    const result = decodeManchester(Uint8Array.from([0xa6, 0x59, 0x59]), 'ieee802.3');
    expect(result.success).toBe(false);
  });
});

describe('manchester — bit sırası kanalı', () => {
  it('lsb-first BAŞKA bir tel üretir ve kendi içinde gidiş-dönüş yapar', () => {
    const lsbWire = encodeManchester(SYNC_WORD, 'ieee802.3', 'lsb-first');
    expect([...lsbWire]).not.toEqual(SYNC_WORD_IEEE_WIRE);
    const back = decodeManchester(lsbWire, 'ieee802.3', 'lsb-first');
    expect(back.success).toBe(true);
    if (back.success) expect([...back.bytes]).toEqual([...SYNC_WORD]);
  });

  it('yanlış bit sırasıyla çözmek bayt içi bitleri ters çevirir', () => {
    const wire = encodeManchester(SYNC_WORD, 'ieee802.3', 'msb-first');
    const wrong = decodeManchester(wire, 'ieee802.3', 'lsb-first');
    expect(wrong.success).toBe(true);
    // 0x2D = 0010 1101 → bit-ters 1011 0100 = 0xB4; 0xD4 → 0x2B.
    if (wrong.success) expect([...wrong.bytes]).toEqual([0xb4, 0x2b]);
  });

  it('boş girdide boş çıktı verir', () => {
    const result = decodeManchester(new Uint8Array(0), 'ieee802.3');
    expect(result.success).toBe(true);
    if (result.success) expect(result.bytes.length).toBe(0);
  });
});
