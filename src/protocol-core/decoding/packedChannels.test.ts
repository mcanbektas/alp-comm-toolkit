import { describe, expect, it } from 'vitest';

import { packedChannelByteSpan, readPackedChannels } from './packedChannels';

/**
 * Faz 10 dalga 15c — `BitOrder` doğrulaması, `sbus`/`ibus` motorları YAZILMADAN
 * ÖNCE (dalga zorunlu disiplini, `brief-faz10-dalga15c.md` "Uygulama görevleri"
 * madde 1). `j1850Pulse.test.ts`in `packBitsToBytes` testiyle AYNI disiplin:
 * fixture `readPackedChannels`in GÖVDESİNE BAKMADAN, bağımsız bit-set
 * döngüsüyle türetildi (aşağıdaki yorum türetimi gösteriyor), sonra iki sırayla
 * okunup FARKLI sonuç verdiği kanıtlanıyor — yalnız "yeşil test" değil, sırayı
 * GERÇEKTEN sınayan bir test.
 */

/**
 * 16 kanal × 11 bit, `lsb-first`, 22 bayt. Kanal değerleri `i × 100`
 * (0, 100, …, 1500) — hepsi 11 bite sığar (azami 2047).
 *
 * Türetim (ELLE, bu dosyanın DIŞINDA bir betikle çapraz kontrol edildi, ama
 * mantık BURADA da izlenebilir): `lsb-first`te bit dizisi bütün arabelleği
 * TEK bir little-endian bit akışı sayar — byte0'ın bit0'ı (LSB) akışın ilk
 * biti, byte0 bit7 sekizinci bit, byte1 bit0 dokuzuncu bit… Kanal `i` akışın
 * `[i×11, i×11+10]` aralığını kaplar ve okunan İLK bit sonucun EN DÜŞÜK biti
 * olur (`bitCursor.ts`in `lsb-first` sözleşmesi).
 *
 * Kanal 0 = 0 → 11 sıfır bit → byte0/byte1'in ilk 11 bitine katkısı yok.
 * Kanal 1 = 100 = 0b00001100100 → akışın bit[11..21] aralığına yazılır; bu
 * aralık byte1'in üst 5 bitiyle (bit11-15) byte2'nin alt 6 bitini (bit16-21)
 * kapsar — byte1 = 0x20 (0b00100000, yalnız bit5 set: kanal1'in bit(5-0=... )
 * bkz. betik çıktısı) değeri buradan gelir. Kalan 14 kanal aynı yöntemle
 * ardışık ilerler; tam bayt dizisi bağımsız bir Node betiğiyle üretildi ve
 * her baytın hangi kanal(lar)a ait olduğu `packedChannelByteSpan` testinde
 * ayrıca doğrulanıyor.
 */
const LSB_FIRST_FIXTURE = Uint8Array.from([
  0x00, 0x20, 0x03, 0x32, 0x58, 0x02, 0x19, 0xfa, 0x60, 0x89, 0x57, 0x20, 0x23, 0x1c, 0xfa, 0x98,
  0x08, 0x4b, 0x8a, 0xe2, 0x95, 0xbb,
]);

const EXPECTED_LSB_FIRST_CHANNELS = [0, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1100, 1200, 1300, 1400, 1500];

describe('readPackedChannels — BitOrder KANITI', () => {
  it('lsb-first: elle türetilmiş 22 baytlık fixture 16 kanalı da BEKLENEN değerlere çözer', () => {
    expect(readPackedChannels(LSB_FIRST_FIXTURE, 0, 16, 11, 'lsb-first')).toEqual(
      EXPECTED_LSB_FIRST_CHANNELS,
    );
  });

  it('AYNI fixture msb-first ile FARKLI değerler verir — sıra gerçekten sonucu değiştiriyor', () => {
    const msbFirstResult = readPackedChannels(LSB_FIRST_FIXTURE, 0, 16, 11, 'msb-first');
    expect(msbFirstResult).not.toEqual(EXPECTED_LSB_FIRST_CHANNELS);
    // Sessiz bir "aslında hepsi eşleşti ama farklı diziymiş" durumunu da elemek
    // için en az bir kanalın SAYISAL olarak değiştiğini ayrıca doğrula.
    expect(msbFirstResult[0]).not.toBe(EXPECTED_LSB_FIRST_CHANNELS[0]);
  });

  it('offset parametresi bayt biriminde kaydırır (SBUS gerçek kullanımı: kanal verisi byte 1de başlar)', () => {
    const withStartByte = Uint8Array.from([0x0f, ...LSB_FIRST_FIXTURE]);
    expect(readPackedChannels(withStartByte, 1, 16, 11, 'lsb-first')).toEqual(
      EXPECTED_LSB_FIRST_CHANNELS,
    );
  });

  it('bitsPerChannel parametreleştirilebilir — CRSF 0x17 alt-küme çerçevesinin 10 bitlik profili', () => {
    // 4 kanal × 10 bit = 40 bit = 5 bayt. Hepsi 0x3FF (10 bitin azamisi) →
    // tüm baytlar 0xFF olmalı (bit sırasından bağımsız, tüm bitler 1).
    const allOnes = new Uint8Array(5).fill(0xff);
    expect(readPackedChannels(allOnes, 0, 4, 10, 'lsb-first')).toEqual([0x3ff, 0x3ff, 0x3ff, 0x3ff]);
  });
});

describe('packedChannelByteSpan', () => {
  it('kanal 0 (11 bit, offset 1) byte 1–2 aralığını KAPSAR — SBUS "CH1 için bayt 1–2" (brief bulgu 5)', () => {
    expect(packedChannelByteSpan(1, 0, 11)).toEqual({ offset: 1, length: 2 });
  });

  it('ardışık kanallar AYNI baytı paylaşabilir — kanal 0 ve kanal 1 byte 2de kesişir', () => {
    const channel0 = packedChannelByteSpan(1, 0, 11);
    const channel1 = packedChannelByteSpan(1, 1, 11);
    expect(channel0).toEqual({ offset: 1, length: 2 }); // byte 1–2
    expect(channel1).toEqual({ offset: 2, length: 2 }); // byte 2–3 — byte 2 ORTAK
  });

  it('son kanal (index 15, 11 bit, offset 1) byte 22de biter — 22 baytlık paketli alanın tamamı kapsanır', () => {
    const lastChannel = packedChannelByteSpan(1, 15, 11);
    expect(lastChannel.offset + lastChannel.length).toBe(23); // 25 baytlık SBUS çerçevesinde flags byte 23'te başlar
  });
});
