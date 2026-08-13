import { describe, expect, it } from 'vitest';

import {
  generateCArray,
  generateCppArray,
  generateJavaArray,
  generateJavaScriptArray,
  generatePythonArray,
  generateRustArray,
} from './codeGenerators';

const sample = Uint8Array.of(0x01, 0x02, 0xff);

describe('code generators', () => {
  it('generates a C array literal', () => {
    expect(generateCArray(sample, 'frame')).toBe('uint8_t frame[] = {0x01, 0x02, 0xff};');
  });

  it('generates a C++ std::array literal with the length in the type', () => {
    expect(generateCppArray(sample, 'frame')).toBe(
      'std::array<uint8_t, 3> frame = {0x01, 0x02, 0xff};',
    );
  });

  it('generates a Python bytes() literal', () => {
    expect(generatePythonArray(sample, 'frame')).toBe('frame = bytes([0x01, 0x02, 0xff])');
  });

  it('generates a Rust fixed-size array literal', () => {
    expect(generateRustArray(sample, 'frame')).toBe('let frame: [u8; 3] = [0x01, 0x02, 0xff];');
  });

  it('generates a Java array literal with (byte) casts for values above 0x7F', () => {
    expect(generateJavaArray(sample, 'frame')).toBe(
      'byte[] frame = {(byte)0x01, (byte)0x02, (byte)0xff};',
    );
  });

  it('generates a JavaScript Uint8Array literal', () => {
    expect(generateJavaScriptArray(sample, 'frame')).toBe(
      'const frame = new Uint8Array([0x01, 0x02, 0xff]);',
    );
  });

  it('handles an empty byte array for every generator', () => {
    const empty = Uint8Array.of();
    expect(generateCArray(empty, 'empty')).toBe('uint8_t empty[] = {};');
    expect(generateCppArray(empty, 'empty')).toBe('std::array<uint8_t, 0> empty = {};');
    expect(generatePythonArray(empty, 'empty')).toBe('empty = bytes([])');
    expect(generateRustArray(empty, 'empty')).toBe('let empty: [u8; 0] = [];');
    expect(generateJavaArray(empty, 'empty')).toBe('byte[] empty = {};');
    expect(generateJavaScriptArray(empty, 'empty')).toBe('const empty = new Uint8Array([]);');
  });
});
