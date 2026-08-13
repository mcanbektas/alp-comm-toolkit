import { describe, expect, it } from 'vitest';

import { stringToUtf8Bytes, utf8BytesToString, viewUtf8Bytes } from './utf8Viewer';

describe('stringToUtf8Bytes / utf8BytesToString', () => {
  it('round-trips ASCII text', () => {
    const bytes = stringToUtf8Bytes('Hello');
    expect(utf8BytesToString(bytes)).toBe('Hello');
  });

  it('round-trips multi-byte text', () => {
    const bytes = stringToUtf8Bytes('€ 😀 ş');
    expect(utf8BytesToString(bytes)).toBe('€ 😀 ş');
  });

  it('throws on a malformed byte sequence', () => {
    // 0xC0 geçerli bir UTF-8 öncü baytı değildir (overlong encoding).
    expect(() => utf8BytesToString(Uint8Array.of(0xc0, 0x80))).toThrow();
  });
});

describe('viewUtf8Bytes', () => {
  it('maps a single ASCII character to one byte entry', () => {
    const info = viewUtf8Bytes('A');
    expect(info).toHaveLength(1);
    expect(info[0]).toMatchObject({
      byteIndex: 0,
      hex: '41',
      decimal: 65,
      charIndex: 0,
      character: 'A',
      charByteLength: 1,
      isLeadByte: true,
    });
  });

  it('groups a three-byte character with lead/continuation flags', () => {
    // € (U+20AC) UTF-8'de E2 82 AC olarak kodlanır.
    const info = viewUtf8Bytes('€');
    expect(info).toHaveLength(3);
    expect(info.map((b) => b.hex)).toEqual(['E2', '82', 'AC']);
    expect(info.every((b) => b.charIndex === 0 && b.character === '€' && b.charByteLength === 3)).toBe(
      true,
    );
    expect(info.map((b) => b.isLeadByte)).toEqual([true, false, false]);
  });

  it('treats a surrogate-pair emoji as a single four-byte character', () => {
    // 😀 (U+1F600) UTF-8'de 4 bayt: F0 9F 98 80. Array.from code-point-aware
    // bölmezse bu karakter iki ayrı "karakter" gibi yanlış çözümlenirdi.
    const info = viewUtf8Bytes('😀');
    expect(info).toHaveLength(4);
    expect(info.map((b) => b.hex)).toEqual(['F0', '9F', '98', '80']);
    expect(new Set(info.map((b) => b.charIndex)).size).toBe(1);
  });

  it('advances byteIndex and charIndex across multiple characters', () => {
    const info = viewUtf8Bytes('A€');
    expect(info.map((b) => b.byteIndex)).toEqual([0, 1, 2, 3]);
    expect(info.map((b) => b.charIndex)).toEqual([0, 1, 1, 1]);
  });
});
