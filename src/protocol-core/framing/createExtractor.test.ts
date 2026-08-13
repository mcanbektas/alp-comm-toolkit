import { describe, expect, it } from 'vitest';

import { createExtractorFromConfig } from './createExtractor';
import type { FramingMethodConfig } from './createExtractor';

const OPTIONS = { maxFrameLength: 1024 };

/** Her yapılandırma türü için: extractor üretilebiliyor mu VE `method` alanı doğru mu. */
const CONFIGS: readonly FramingMethodConfig[] = [
  { method: 'fixed-length', frameLength: 4 },
  { method: 'start-byte', startSequence: [0xaa] },
  { method: 'multiple-start-bytes', startSequence: [0xaa, 0x55] },
  { method: 'start-end-delimiter', startSequence: [0x02], endSequence: [0x03] },
  { method: 'line-ending', endSequence: [0x0d] },
  { method: 'length-field', headerBytesBeforeLength: 0, lengthFieldWidth: 1, lengthFieldEndianness: 'big', trailerLength: 0 },
  { method: 'inter-character-timeout', timeoutMs: 5 },
  { method: 'inter-frame-timeout', timeoutMs: 10 },
  { method: 'modbus-silent-interval', timeoutMs: 4 },
  { method: 'escape-based', delimiterByte: 0xc0, rule: { escapeByte: 0xdb, specialBytes: new Set([0xc0, 0xdb]), substitutions: new Map([[0xc0, 0xdc], [0xdb, 0xdd]]) } },
  { method: 'byte-stuffing', delimiterByte: 0x7e, rule: { escapeByte: 0x7d, specialBytes: new Set([0x7e, 0x7d]), xorMask: 0x20 } },
  { method: 'slip' },
  { method: 'hdlc-flag' },
  { method: 'cobs' },
];

describe('createExtractorFromConfig', () => {
  it('her yapılandırma türü çalışan bir extractor üretir', () => {
    for (const config of CONFIGS) {
      const extractor = createExtractorFromConfig(config);
      expect(extractor.method).toBe(config.method);
      // Boş girdide patlamamalı — en asgari sağlık kontrolü.
      expect(() => extractor.extract(new Uint8Array(0), OPTIONS)).not.toThrow();
    }
  });

  it('14 yöntemin (bit-stuffing hariç, bkz. dosya başı yorumu) tamamı kapsanıyor', () => {
    const coveredMethods = new Set(CONFIGS.map((config) => config.method));
    expect(coveredMethods.size).toBe(14);
  });
});
