import { describe, expect, it } from 'vitest';

import { crc } from './crcEngine';
import type { CrcParams } from './crcEngine';
import { computeNamedCrc, CRC_ALGORITHM_IDS } from './crcCatalogue';
import type { CrcAlgorithmId } from './crcCatalogue';

/**
 * reveng.sourceforge.io kataloğundaki "check" değerleri: ASCII `"123456789"` (9
 * byte) girdisinin beklenen CRC'sidir, her kanonik CRC tanımının doğrulama
 * fixture'ıdır. Bu tabloya DOKUNULMAZ — dış kaynaktan doğrulanmış gerçek
 * değerlerdir, motor bunlara uymalı, tersi değil (bkz. crcCatalogue.ts başlığı).
 */
const CHECK_VALUES: Record<CrcAlgorithmId, bigint> = {
  CRC4_ITU: 0x7n,
  CRC5_USB: 0x19n,
  CRC6_ITU: 0x06n,
  CRC7_MMC: 0x75n,
  CRC8: 0xf4n,
  CRC8_SAE_J1850: 0x4bn,
  CRC8_AUTOSAR: 0xdfn,
  CRC8_MAXIM: 0xa1n,
  CRC16_ARC: 0xbb3dn,
  CRC16_MODBUS: 0x4b37n,
  CRC16_CCITT_FALSE: 0x29b1n,
  CRC16_XMODEM: 0x31c3n,
  CRC16_X25: 0x906en,
  CRC16_DNP: 0xea82n,
  CRC24: 0x21cf02n,
  CRC32: 0xcbf43926n,
  CRC32C: 0xe3069283n,
  CRC64: 0x995dc9bbdf1939fan,
};

const CHECK_INPUT = new TextEncoder().encode('123456789');

describe('computeNamedCrc — kanonik katalog fixture doğrulaması', () => {
  // 18 algoritmanın HER BİRİ tek tek doğrulanır: biri bile tutmazsa motorda
  // (özellikle refin/refout ya da width < 8 kaydırma mantığında) hata var demektir.
  it.each(CRC_ALGORITHM_IDS)('"123456789" için %s check değerini üretir', (id) => {
    expect(computeNamedCrc(CHECK_INPUT, id)).toBe(CHECK_VALUES[id]);
  });
});

describe('crc — custom (katalog dışı elle verilmiş) parametrelerle çağrı', () => {
  it('katalogdaki CRC-32 parametreleri elle geçirildiğinde computeNamedCrc ile aynı sonucu verir', () => {
    // "Custom CRC" için ayrı kod GEREKMEZ: motor zaten parametrik, kullanıcı kendi
    // CrcParams'ını doğrudan crc()'ye verebilir. Burada katalogdaki CRC-32'yi
    // "kullanıcı elle girdi" gibi kuruyoruz ve aynı sonucu aldığımızı doğruluyoruz.
    const customCrc32: CrcParams = {
      width: 32,
      poly: 0x04c11db7n,
      init: 0xffffffffn,
      refin: true,
      refout: true,
      xorout: 0xffffffffn,
    };

    expect(crc(CHECK_INPUT, customCrc32)).toBe(computeNamedCrc(CHECK_INPUT, 'CRC32'));
  });
});
