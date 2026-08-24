import { describe, expect, it } from 'vitest';

import {
  parseXcpOnEthernet,
  xcpOnEthernetParser,
  xcpOnEthernetPlugin,
} from './xcpOnEthernet';
import { xcpOnCanPlugin } from './xcpOnCan';
import { isParseSuccess } from '@/protocol-core/types';
import type { ParsedField } from '@/protocol-core/types';

function fieldById(fields: ParsedField[], id: string): ParsedField | undefined {
  return fields.find((field) => field.id === id);
}

/** Başlık 00 00 00 00 + XCP paketi baytları — testlerde tekrar yazmamak için. */
function withNeutralHeader(...xcpPacketBytes: number[]): Uint8Array {
  return Uint8Array.from([0x00, 0x00, 0x00, 0x00, ...xcpPacketBytes]);
}

describe('xcpOnEthernetParser.canParse', () => {
  it('4 bayttan fazla her uzunluğu kabul eder (üst sınır Ethernet için doğal değil)', () => {
    expect(xcpOnEthernetParser.canParse(withNeutralHeader(0xff))).toBe(true);
    expect(xcpOnEthernetParser.canParse(new Uint8Array(500))).toBe(true);
  });

  it('4 bayt ya da daha kısa girdiyi reddeder (en az bir PID baytı gerekir)', () => {
    expect(xcpOnEthernetParser.canParse(new Uint8Array(4))).toBe(false);
    expect(xcpOnEthernetParser.canParse(new Uint8Array(2))).toBe(false);
  });
});

describe('xcpOnEthernetParser.parse — girdi sınırları', () => {
  it('4 bayttan kısa girdi truncated-frame verir, kurtarılabilir', () => {
    const result = xcpOnEthernetParser.parse(new Uint8Array(2));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('truncated-frame');
      expect(result.recoverable).toBe(true);
    }
  });

  it('yalnız 4 baytlık başlık (XCP paketi yok) frame.valid=false + truncated-frame hatası verir', () => {
    const result = xcpOnEthernetParser.parse(new Uint8Array(4));
    expect(result.success).toBe(true);
    if (isParseSuccess(result)) {
      expect(result.frame.valid).toBe(false);
      expect(result.frame.errors.some((error) => error.code === 'truncated-frame')).toBe(true);
    }
  });

  it('maxFrameLength verilmişse aşan girdi frame-too-long verir', () => {
    const result = xcpOnEthernetParser.parse(withNeutralHeader(0xfd), {
      maxFrameLength: 4,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('frame-too-long');
    }
  });

  it('maxFrameLength verilmemişse Ethernet girdisi için üst sınır uygulanmaz', () => {
    const result = xcpOnEthernetParser.parse(withNeutralHeader(0xfd, ...new Array(2000).fill(0)));
    expect(result.success).toBe(true);
  });

  it('iptal sinyali parser-timeout verir, kurtarılamaz', () => {
    const controller = new AbortController();
    controller.abort();
    const result = xcpOnEthernetParser.parse(withNeutralHeader(0xfd), { signal: controller.signal });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('parser-timeout');
      expect(result.recoverable).toBe(false);
    }
  });
});

describe('xcpOnEthernetParser.parse — taşıma başlığı (LEN/CTR) HAM kalır', () => {
  it('length/counter alanları rawValue TAŞIMAZ (iki kaynak bayt sırasında çelişiyor)', () => {
    const result = parseXcpOnEthernet(withNeutralHeader(0xff, 0x00));
    expect(result.success).toBe(true);
    if (isParseSuccess(result)) {
      const lengthField = fieldById(result.frame.fields, 'length');
      const counterField = fieldById(result.frame.fields, 'counter');
      expect(lengthField?.rawValue).toBeUndefined();
      expect(counterField?.rawValue).toBeUndefined();
      expect(lengthField?.rawBytes).toHaveLength(2);
      expect(counterField?.rawBytes).toHaveLength(2);
      expect(lengthField?.offset).toBe(0);
      expect(counterField?.offset).toBe(2);
    }
  });

  it('her başarılı çözümde headerByteOrderUnresolved uyarısı basılır', () => {
    const result = parseXcpOnEthernet(withNeutralHeader(0xfd));
    expect(result.success).toBe(true);
    if (isParseSuccess(result)) {
      expect(
        result.frame.warnings.some((warning) => warning.code === 'protocol.xcpEth.warning.headerByteOrderUnresolved'),
      ).toBe(true);
    }
  });
});

describe('xcpOnEthernetParser.parse — XCP paketi xcpPacket.ts çekirdeğiyle çözülür', () => {
  it('varsayılan role=command: 0xFF → CONNECT, ofset başlıktan sonra (4) başlar', () => {
    const result = parseXcpOnEthernet(withNeutralHeader(0xff, 0x00));
    expect(result.success).toBe(true);
    if (isParseSuccess(result)) {
      const pidField = fieldById(result.frame.fields, 'pid');
      expect(pidField?.physicalValue).toBe('CONNECT');
      expect(pidField?.offset).toBe(4);
    }
  });

  it('role=response seçilince AYNI PID baytı (0xFF) RES olarak okunur', () => {
    const data = withNeutralHeader(0xff, 0x05, 0x00, 0x08, 0x08, 0x00, 0x01, 0x01);
    const result = xcpOnEthernetParser.parse(data, { options: { role: 'response' } });
    expect(result.success).toBe(true);
    if (isParseSuccess(result)) {
      expect(fieldById(result.frame.fields, 'packet-code')?.physicalValue).toBe('positive-response');
      expect(fieldById(result.frame.fields, 'max-cto')?.rawValue).toBe(8);
    }
  });

  it('byteOrder little/big arasında SET_MTA adresini FARKLI çözer', () => {
    const data = withNeutralHeader(0xf6, 0x00, 0x00, 0x00, 0x00, 0x10, 0x00, 0x00);
    const little = xcpOnEthernetParser.parse(data, { options: { byteOrder: 'little-endian' } });
    const big = xcpOnEthernetParser.parse(data, { options: { byteOrder: 'big-endian' } });
    expect(isParseSuccess(little) && isParseSuccess(big)).toBe(true);
    if (isParseSuccess(little) && isParseSuccess(big)) {
      const littleAddress = fieldById(little.frame.fields, 'address')?.rawValue;
      const bigAddress = fieldById(big.frame.fields, 'address')?.rawValue;
      expect(littleAddress).not.toBe(bigAddress);
    }
  });

  it('ERR yanıtının error_code’u tabloya adlanır (role=response)', () => {
    const data = withNeutralHeader(0xfe, 0x20);
    const result = xcpOnEthernetParser.parse(data, { options: { role: 'response' } });
    expect(result.success).toBe(true);
    if (isParseSuccess(result)) {
      expect(fieldById(result.frame.fields, 'error-code')?.physicalValue).toBe('ERR_CMD_UNKNOWN');
    }
  });
});

describe('xcpOnEthernetPlugin', () => {
  it('örnek çerçevelerin hepsi motorla sorunsuz çözülür', () => {
    for (const example of xcpOnEthernetPlugin.exampleFrames) {
      const result = xcpOnEthernetParser.parse(example.bytes);
      expect(result.success, `${example.id} parse etmedi`).toBe(true);
    }
  });

  it('empty-packet-header-only örneği expectedValid:false ile eşleşen bir hata üretir', () => {
    const example = xcpOnEthernetPlugin.exampleFrames.find((frame) => frame.id === 'empty-packet-header-only');
    expect(example).toBeDefined();
    if (example === undefined) return;
    const result = xcpOnEthernetParser.parse(example.bytes);
    expect(result.success).toBe(true);
    if (isParseSuccess(result)) {
      expect(result.frame.valid).toBe(example.expectedValid);
    }
  });

  /**
   * En güçlü kanıt: decodeOptions xcpOnCan.ts'ten AYNI DİZİ REFERANSIYLA
   * paylaşılıyor — yapısal eşitlik değil, bellek referansı eşitliği.
   * İkinci kez yazılmış bir kopya bu testi GEÇEMEZ.
   */
  it('decodeOptions xcpOnCanPlugin ile AYNI dizi referansını paylaşır', () => {
    expect(xcpOnEthernetPlugin.decodeOptions).toBe(xcpOnCanPlugin.decodeOptions);
  });

  it('decodeOptions role/byteOrder ikisini de bildirir', () => {
    const ids = (xcpOnEthernetPlugin.decodeOptions ?? []).map((option) => option.id);
    expect(ids).toEqual(['role', 'byteOrder']);
  });
});
