import { describe, expect, it } from 'vitest';

import {
  MAX_BER_LENGTH_OCTETS,
  decodeBerBoolean,
  decodeBerInteger,
  decodeBerObjectIdentifier,
  decodeBerUnsignedInteger,
  decodeBerVisibleString,
  readBerLength,
  readBerTag,
  readBerTlv,
} from './berReader';
import type { BerFailure } from './berReader';

/**
 * Vektörler ELLE kuruldu — hiçbiri modülün kendi yardımcılarıyla üretilmedi.
 * Testin kanıt değeri bundan gelir: kodlama X.690'dan okunup baytlara burada
 * dönüştürüldü, sonra çözücüye verildi.
 */
function bytes(hex: string): Uint8Array {
  const cleaned = hex.replace(/\s+/g, '');
  const result = new Uint8Array(cleaned.length / 2);
  for (let index = 0; index < result.length; index += 1) {
    result[index] = Number.parseInt(cleaned.slice(index * 2, index * 2 + 2), 16);
  }
  return result;
}

function expectOid(result: ReturnType<typeof decodeBerObjectIdentifier>): string {
  if (!result.ok) {
    throw new Error(`expected an OID, got failure "${result.error}"`);
  }
  return result.text;
}

function expectFailure(result: { ok: boolean }): BerFailure {
  if (result.ok) {
    throw new Error('expected a BER failure, got a successful read');
  }
  return result as BerFailure;
}

describe('readBerTag', () => {
  it('splits class, constructed bit and number', () => {
    // 0x30 = 0b00_1_10000: universal (00), constructed (1), numara 16 = SEQUENCE.
    const universal = readBerTag(bytes('30'), 0);
    expect(universal.ok && universal.tag).toEqual({
      tagClass: 'universal',
      constructed: true,
      number: 16,
      byte: 0x30,
    });

    // 0x61 = 0b01_1_00001: application (01), constructed, numara 1 → GOOSE'un goosePdu'su.
    const application = readBerTag(bytes('61'), 0);
    expect(application.ok && application.tag).toEqual({
      tagClass: 'application',
      constructed: true,
      number: 1,
      byte: 0x61,
    });

    // 0x8a = 0b10_0_01010: context-specific (10), primitive, numara 10.
    const context = readBerTag(bytes('8A'), 0);
    expect(context.ok && context.tag).toEqual({
      tagClass: 'context-specific',
      constructed: false,
      number: 10,
      byte: 0x8a,
    });

    // 0xC5 = 0b11_0_00101: private (11), primitive, numara 5.
    const priv = readBerTag(bytes('C5'), 0);
    expect(priv.ok && priv.tag).toEqual({
      tagClass: 'private',
      constructed: false,
      number: 5,
      byte: 0xc5,
    });
  });

  it('reports the absolute offset of the byte it read', () => {
    const read = readBerTag(bytes('FF FF 8A'), 2);
    expect(read.ok && read.tag.number).toBe(10);
    expect(read.ok && read.nextOffset).toBe(3);
  });

  it('refuses long-form tags instead of reading 31 (karar 3)', () => {
    // 0x1F ve 0x9F: alt 5 bit 0x1F → numara sonraki baytlarda base-128 sürer.
    expect(expectFailure(readBerTag(bytes('1F 82 05'), 0)).error).toBe('long-form-tag');
    expect(expectFailure(readBerTag(bytes('9F 1F'), 0)).error).toBe('long-form-tag');
  });

  it('fails on an empty read position', () => {
    const failed = expectFailure(readBerTag(bytes('30'), 1));
    expect(failed.error).toBe('truncated');
    expect(failed.offset).toBe(1);
  });
});

describe('readBerLength', () => {
  it('reads the short form (bit 7 = 0)', () => {
    expect(readBerLength(bytes('00'), 0)).toEqual({
      ok: true,
      length: 0,
      lengthOctets: 1,
      nextOffset: 1,
    });
    expect(readBerLength(bytes('05'), 0)).toEqual({
      ok: true,
      length: 5,
      lengthOctets: 1,
      nextOffset: 1,
    });
    // 0x7F kısa formun tavanı; 0x80 artık uzun form işaretçisidir.
    expect(readBerLength(bytes('7F'), 0)).toEqual({
      ok: true,
      length: 127,
      lengthOctets: 1,
      nextOffset: 1,
    });
  });

  it('reads the long form and reports how many octets it consumed', () => {
    // 0x81 0x80 → 1 oktet, değer 128 (kısa formda gösterilemeyen ilk sayı).
    expect(readBerLength(bytes('81 80'), 0)).toEqual({
      ok: true,
      length: 128,
      lengthOctets: 2,
      nextOffset: 2,
    });
    // 0x82 0x01 0x2C → 2 oktet, 0x012C = 300.
    expect(readBerLength(bytes('82 01 2C'), 0)).toEqual({
      ok: true,
      length: 300,
      lengthOctets: 3,
      nextOffset: 3,
    });
  });

  it('keeps a four-octet length positive (the `<<` overflow trap)', () => {
    // 0xFFFFFFFF `<<` ile birleştirilseydi -1 çıkardı; `* 0x100` doğru sonucu verir.
    const read = readBerLength(bytes('84 FF FF FF FF'), 0);
    expect(read.ok && read.length).toBe(4294967295);
    expect(read.ok && read.lengthOctets).toBe(5);
  });

  it('accepts a non-minimal long form (BER allows it, karar 7)', () => {
    // 0x81 0x05 yerine 0x05 yazılmalıydı; DER katılığı çağıranın işidir.
    const read = readBerLength(bytes('81 05'), 0);
    expect(read.ok && read.length).toBe(5);
    expect(read.ok && read.lengthOctets).toBe(2);
  });

  it('refuses the indefinite form (karar 4)', () => {
    const failed = expectFailure(readBerLength(bytes('80 04 05 00 00'), 0));
    expect(failed.error).toBe('indefinite-length');
    expect(failed.offset).toBe(0);
  });

  it('refuses the reserved 0xFF octet', () => {
    expect(expectFailure(readBerLength(bytes('FF'), 0)).error).toBe('reserved-length-octet');
  });

  it('refuses more length octets than it can hold', () => {
    const tooMany = 0x80 | (MAX_BER_LENGTH_OCTETS + 1);
    const failed = expectFailure(readBerLength(Uint8Array.from([tooMany, 1, 1, 1, 1, 1]), 0));
    expect(failed.error).toBe('length-octets-unsupported');
  });

  it('fails when the long form runs off the buffer', () => {
    const failed = expectFailure(readBerLength(bytes('83 01 02'), 0));
    expect(failed.error).toBe('truncated');
    expect(failed.offset).toBe(3);
  });
});

describe('readBerTlv', () => {
  it('returns absolute boundaries for a primitive value', () => {
    // 85 03 01 02 03 — context 5, 3 baytlık değer.
    const tlv = readBerTlv(bytes('85 03 01 02 03'), 0);
    expect(tlv.ok && tlv.tag.number).toBe(5);
    expect(tlv.ok && tlv.offset).toBe(0);
    expect(tlv.ok && tlv.valueOffset).toBe(2);
    expect(tlv.ok && tlv.length).toBe(3);
    expect(tlv.ok && tlv.end).toBe(5);
    expect(tlv.ok && tlv.headerLength).toBe(2);
  });

  it('keeps offsets absolute when reading from the middle of a buffer', () => {
    const frame = bytes('DE AD BE EF 82 02 AA BB');
    const tlv = readBerTlv(frame, 4);
    expect(tlv.ok && tlv.offset).toBe(4);
    expect(tlv.ok && tlv.valueOffset).toBe(6);
    expect(tlv.ok && tlv.end).toBe(8);
  });

  it('walks siblings by chaining `end`', () => {
    // A2 06 { 83 01 FF, 85 01 07 } — yapı içinde iki kardeş.
    const frame = bytes('A2 06 83 01 FF 85 01 07');
    const outer = readBerTlv(frame, 0);
    expect(outer.ok && outer.tag.constructed).toBe(true);
    if (!outer.ok) throw new Error('outer TLV failed');

    const first = readBerTlv(frame, outer.valueOffset, outer.end);
    expect(first.ok && first.tag.byte).toBe(0x83);
    if (!first.ok) throw new Error('first child failed');
    expect(first.end).toBe(5);

    const second = readBerTlv(frame, first.end, outer.end);
    expect(second.ok && second.tag.byte).toBe(0x85);
    expect(second.ok && second.end).toBe(outer.end);
  });

  it('refuses a value that overflows the buffer', () => {
    const failed = expectFailure(readBerTlv(bytes('85 04 01 02'), 0));
    expect(failed.error).toBe('value-overflow');
    expect(failed.offset).toBe(2);
  });

  it('refuses a child that reaches past its parent even when the buffer allows it', () => {
    // Ana TLV 3 baytlık gövde vaat ediyor, çocuk 5 bayt istiyor; arabellekte yer VAR.
    const frame = bytes('A2 03 85 05 01 02 03 04 05');
    const outer = readBerTlv(frame, 0);
    if (!outer.ok) throw new Error('outer TLV failed');
    const child = expectFailure(readBerTlv(frame, outer.valueOffset, outer.end));
    expect(child.error).toBe('value-overflow');
  });

  it('propagates tag and length failures unchanged', () => {
    expect(expectFailure(readBerTlv(bytes('1F 02 00 00'), 0)).error).toBe('long-form-tag');
    expect(expectFailure(readBerTlv(bytes('30 80 05 00 00 00'), 0)).error).toBe('indefinite-length');
  });

  it('fails when only the tag byte fits inside the limit', () => {
    const failed = expectFailure(readBerTlv(bytes('85 03 01 02 03'), 0, 1));
    expect(failed.error).toBe('truncated');
    expect(failed.offset).toBe(1);
  });
});

describe('decodeBerInteger', () => {
  it('decodes two-complement big-endian values', () => {
    // Elle: 0x00 → 0, 0x7F → 127, 0x80 → -128, 0xFF → -1.
    expect(decodeBerInteger(bytes('00'), 0, 1)).toEqual({ ok: true, value: 0n });
    expect(decodeBerInteger(bytes('7F'), 0, 1)).toEqual({ ok: true, value: 127n });
    expect(decodeBerInteger(bytes('80'), 0, 1)).toEqual({ ok: true, value: -128n });
    expect(decodeBerInteger(bytes('FF'), 0, 1)).toEqual({ ok: true, value: -1n });
  });

  it('reads a leading 0x00 as a positive sign, not as a value byte', () => {
    // BER'in minimal-oktet kuralı: 255 pozitif kalsın diye başa 0x00 eklenir.
    expect(decodeBerInteger(bytes('00 FF'), 0, 2)).toEqual({ ok: true, value: 255n });
    expect(decodeBerInteger(bytes('00 80'), 0, 2)).toEqual({ ok: true, value: 128n });
    // Aynı iki bayt 0x00 önekisiz: 0xFF80 = -128.
    expect(decodeBerInteger(bytes('FF 80'), 0, 2)).toEqual({ ok: true, value: -128n });
  });

  it('decodes multi-byte magnitudes', () => {
    // 0x01 0x2C = 300; 0xFE 0xD4 = -300 (65536 - 300 = 65236 = 0xFED4).
    expect(decodeBerInteger(bytes('01 2C'), 0, 2)).toEqual({ ok: true, value: 300n });
    expect(decodeBerInteger(bytes('FE D4'), 0, 2)).toEqual({ ok: true, value: -300n });
    // 8 bayt: `number` 53 bitte yuvarlardı, bigint yuvarlamaz.
    expect(decodeBerInteger(bytes('00 FF FF FF FF FF FF FF'), 0, 8)).toEqual({
      ok: true,
      value: 72057594037927935n,
    });
  });

  it('honours the offset', () => {
    expect(decodeBerInteger(bytes('AA BB 01 2C'), 2, 2)).toEqual({ ok: true, value: 300n });
  });

  it('refuses an empty INTEGER', () => {
    expect(expectFailure(decodeBerInteger(bytes('05 00'), 2, 0)).error).toBe(
      'unexpected-value-length',
    );
  });

  it('fails when the declared length runs off the buffer', () => {
    expect(expectFailure(decodeBerInteger(bytes('01 2C'), 0, 4)).error).toBe('truncated');
  });
});

describe('decodeBerBoolean', () => {
  it('treats zero as false and anything else as true', () => {
    expect(decodeBerBoolean(bytes('00'), 0, 1)).toEqual({
      ok: true,
      value: false,
      derCompliant: true,
    });
    expect(decodeBerBoolean(bytes('FF'), 0, 1)).toEqual({
      ok: true,
      value: true,
      derCompliant: true,
    });
    // BER'de geçerli TRUE, DER'de değil — hata değil, bayrak.
    expect(decodeBerBoolean(bytes('01'), 0, 1)).toEqual({
      ok: true,
      value: true,
      derCompliant: false,
    });
  });

  it('refuses a BOOLEAN that is not exactly one octet', () => {
    expect(expectFailure(decodeBerBoolean(bytes('00 FF'), 0, 2)).error).toBe(
      'unexpected-value-length',
    );
    expect(expectFailure(decodeBerBoolean(bytes('00'), 0, 0)).error).toBe(
      'unexpected-value-length',
    );
  });
});

describe('decodeBerVisibleString', () => {
  it('decodes printable ISO 646 text', () => {
    // "GO" = 0x47 0x4F.
    expect(decodeBerVisibleString(bytes('47 4F'), 0, 2)).toEqual({
      ok: true,
      text: 'GO',
      printable: true,
    });
  });

  it('flags bytes outside 0x20-0x7E without failing', () => {
    const read = decodeBerVisibleString(bytes('41 00 42'), 0, 3);
    expect(read.ok && read.printable).toBe(false);
    expect(read.ok && read.text.length).toBe(3);
  });

  it('returns an empty string for a zero-length value', () => {
    expect(decodeBerVisibleString(bytes('41'), 0, 0)).toEqual({
      ok: true,
      text: '',
      printable: true,
    });
  });

  it('fails when the value runs off the buffer', () => {
    expect(expectFailure(decodeBerVisibleString(bytes('41 42'), 0, 5)).error).toBe('truncated');
  });
});

describe('decodeBerObjectIdentifier', () => {
  it('decodes the classic 1.3.6.1.2.1.1.3.0 (sysUpTime.0)', () => {
    // 0x2B = 43 = 40 × 1 + 3 → arcs 1 and 3.
    const result = decodeBerObjectIdentifier(bytes('2b 06 01 02 01 01 03 00'), 0, 8);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.text).toBe('1.3.6.1.2.1.1.3.0');
    expect(result.arcs).toHaveLength(9);
  });

  it('splits the first two arcs by threshold, not by division', () => {
    // 0x00 → 0.0 · 0x28 (40) → 1.0 · 0x50 (80) → 2.0.
    expect(expectOid(decodeBerObjectIdentifier(bytes('00'), 0, 1))).toBe('0.0');
    expect(expectOid(decodeBerObjectIdentifier(bytes('28'), 0, 1))).toBe('1.0');
    expect(expectOid(decodeBerObjectIdentifier(bytes('50'), 0, 1))).toBe('2.0');
  });

  it('lets the second arc exceed 39 when the first arc is 2', () => {
    // 2.100 = 40 × 2 + 100 = 180 → base-128: 0x81 0x34.
    expect(expectOid(decodeBerObjectIdentifier(bytes('81 34'), 0, 2))).toBe('2.100');
    // Saf bölme burada "4.20" derdi — 180/40 = 4, 180%40 = 20.
  });

  it('decodes multi-byte base-128 arcs', () => {
    // 1.2.840 → 0x2A, then 840 = 0x86 0x48.
    expect(expectOid(decodeBerObjectIdentifier(bytes('2a 86 48'), 0, 3))).toBe('1.2.840');
  });

  it('keeps arcs beyond 2^53 exact', () => {
    // 18 446 744 073 709 551 615 (2^64 − 1) base-128 kodlaması.
    const encoded = bytes('2b 81 ff ff ff ff ff ff ff ff 7f');
    const result = decodeBerObjectIdentifier(encoded, 0, encoded.length);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.arcs[2]).toBe(18_446_744_073_709_551_615n);
  });

  it('rejects an empty value and a dangling continuation bit', () => {
    expect(expectFailure(decodeBerObjectIdentifier(bytes('2b'), 0, 0)).error).toBe('unexpected-value-length');
    // Son bayt devam biti taşıyor: kodlama yarım kalmış.
    expect(expectFailure(decodeBerObjectIdentifier(bytes('2b 86'), 0, 2)).error).toBe('unexpected-value-length');
  });

  it('fails when the value runs off the buffer', () => {
    expect(expectFailure(decodeBerObjectIdentifier(bytes('2b'), 0, 4)).error).toBe('truncated');
  });
});

describe('decodeBerUnsignedInteger', () => {
  it('keeps a high-bit value positive where the signed reader would go negative', () => {
    const raw = bytes('b2 d0 5e 00'); // 3 000 000 000
    const unsigned = decodeBerUnsignedInteger(raw, 0, 4);
    const signed = decodeBerInteger(raw, 0, 4);

    expect(unsigned.ok).toBe(true);
    expect(signed.ok).toBe(true);
    if (!unsigned.ok || !signed.ok) return;
    expect(unsigned.value).toBe(3_000_000_000n);
    expect(signed.value).toBe(-1_294_967_296n);
  });

  it('decodes a 64-bit counter without rounding', () => {
    const result = decodeBerUnsignedInteger(bytes('ff ff ff ff ff ff ff ff'), 0, 8);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toBe(18_446_744_073_709_551_615n);
  });

  it('rejects an empty value and a value past the buffer', () => {
    expect(expectFailure(decodeBerUnsignedInteger(bytes('01'), 0, 0)).error).toBe('unexpected-value-length');
    expect(expectFailure(decodeBerUnsignedInteger(bytes('01'), 0, 4)).error).toBe('truncated');
  });
});
