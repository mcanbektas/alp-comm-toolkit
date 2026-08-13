/**
 * reveng.sourceforge.io "Catalogue of parametrised CRC algorithms" kaynağından
 * BİREBİR alınan 18 standart CRC tanımı. `poly`/`init`/`xorout` değerleri
 * UYDURULMADI ya da yuvarlanmadı — değiştirilirse `crcEngine.test.ts`'teki
 * `check` fixture'ları (ASCII "123456789" girdisinin beklenen CRC'si) tutmaz.
 * Bu yüzden burada elle "sadeleştirme" ya da "iyileştirme" yapılmaz.
 */

import { crc } from './crcEngine';
import type { CrcParams } from './crcEngine';

export const CRC_ALGORITHM_IDS = [
  'CRC4_ITU',
  'CRC5_USB',
  'CRC6_ITU',
  'CRC7_MMC',
  'CRC8',
  'CRC8_SAE_J1850',
  'CRC8_AUTOSAR',
  'CRC8_MAXIM',
  'CRC16_ARC',
  'CRC16_MODBUS',
  'CRC16_CCITT_FALSE',
  'CRC16_XMODEM',
  'CRC16_X25',
  'CRC16_DNP',
  'CRC24',
  'CRC32',
  'CRC32C',
  'CRC64',
] as const;

export type CrcAlgorithmId = (typeof CRC_ALGORITHM_IDS)[number];

/** Katalogdaki her algoritmanın `crc()`'ye doğrudan verilebilecek parametre kümesi. */
export const CRC_CATALOGUE: Record<CrcAlgorithmId, CrcParams> = {
  CRC4_ITU: { width: 4, poly: 0x3n, init: 0x0n, refin: true, refout: true, xorout: 0x0n },
  CRC5_USB: { width: 5, poly: 0x05n, init: 0x1fn, refin: true, refout: true, xorout: 0x1fn },
  CRC6_ITU: { width: 6, poly: 0x03n, init: 0x00n, refin: true, refout: true, xorout: 0x00n },
  CRC7_MMC: { width: 7, poly: 0x09n, init: 0x00n, refin: false, refout: false, xorout: 0x00n },
  CRC8: { width: 8, poly: 0x07n, init: 0x00n, refin: false, refout: false, xorout: 0x00n },
  CRC8_SAE_J1850: {
    width: 8,
    poly: 0x1dn,
    init: 0xffn,
    refin: false,
    refout: false,
    xorout: 0xffn,
  },
  CRC8_AUTOSAR: {
    width: 8,
    poly: 0x2fn,
    init: 0xffn,
    refin: false,
    refout: false,
    xorout: 0xffn,
  },
  CRC8_MAXIM: { width: 8, poly: 0x31n, init: 0x00n, refin: true, refout: true, xorout: 0x00n },
  CRC16_ARC: {
    width: 16,
    poly: 0x8005n,
    init: 0x0000n,
    refin: true,
    refout: true,
    xorout: 0x0000n,
  },
  CRC16_MODBUS: {
    width: 16,
    poly: 0x8005n,
    init: 0xffffn,
    refin: true,
    refout: true,
    xorout: 0x0000n,
  },
  CRC16_CCITT_FALSE: {
    width: 16,
    poly: 0x1021n,
    init: 0xffffn,
    refin: false,
    refout: false,
    xorout: 0x0000n,
  },
  CRC16_XMODEM: {
    width: 16,
    poly: 0x1021n,
    init: 0x0000n,
    refin: false,
    refout: false,
    xorout: 0x0000n,
  },
  CRC16_X25: {
    width: 16,
    poly: 0x1021n,
    init: 0xffffn,
    refin: true,
    refout: true,
    xorout: 0xffffn,
  },
  CRC16_DNP: {
    width: 16,
    poly: 0x3d65n,
    init: 0x0000n,
    refin: true,
    refout: true,
    xorout: 0xffffn,
  },
  CRC24: {
    width: 24,
    poly: 0x864cfbn,
    init: 0xb704cen,
    refin: false,
    refout: false,
    xorout: 0x000000n,
  },
  CRC32: {
    width: 32,
    poly: 0x04c11db7n,
    init: 0xffffffffn,
    refin: true,
    refout: true,
    xorout: 0xffffffffn,
  },
  CRC32C: {
    width: 32,
    poly: 0x1edc6f41n,
    init: 0xffffffffn,
    refin: true,
    refout: true,
    xorout: 0xffffffffn,
  },
  CRC64: {
    width: 64,
    poly: 0x42f0e1eba9ea3693n,
    init: 0xffffffffffffffffn,
    refin: true,
    refout: true,
    xorout: 0xffffffffffffffffn,
  },
};

/** Katalogdan parametreleri alıp `crc()`'yi çağıran kolaylık fonksiyonu. */
export function computeNamedCrc(bytes: Uint8Array, id: CrcAlgorithmId): bigint {
  return crc(bytes, CRC_CATALOGUE[id]);
}
