import { describe, expect, it } from 'vitest';

import {
  decodeMatterTlvFloat,
  decodeMatterTlvSignedInteger,
  decodeMatterTlvUnsignedInteger,
  decodeMatterTlvUtf8String,
  readMatterTlvElement,
  validateMatterTlvTag,
} from './matterTlv';
import type {
  MatterTlvContainerType,
  MatterTlvElement,
  MatterTlvFailure,
  MatterTlvResult,
} from './matterTlv';

/**
 * Fixture'ların TAMAMI dış kaynaktan, satır/tablo atıflı (fixture uydurma
 * yasağı, CLAUDE.md):
 *   - "Tablo 105/106/107" = CSA Matter Core Specification R1.4 (Doc 23-27349,
 *     2024-11-04), Appendix A.12'nin işlenmiş örnek tabloları.
 *   - "SDK" = connectedhomeip (Apache-2.0, SHA a50d879769df0c0fd984a3545954438ba025813a),
 *     `src/lib/core/tests/TestTLV.cpp` test vektörleri.
 * Hiçbir bayt dizisi bu depoda üretilmedi.
 */

function hex(text: string): Uint8Array {
  const parts = text.trim().split(/\s+/);
  return Uint8Array.from(parts.map((part) => Number.parseInt(part, 16)));
}

function expectOk(result: MatterTlvResult<MatterTlvElement>): MatterTlvElement {
  if (!result.ok) {
    throw new Error(`expected ok, got error "${result.error}" at offset ${String(result.offset)}`);
  }
  return result;
}

function expectFail(result: MatterTlvResult<unknown>): MatterTlvFailure {
  if (result.ok) {
    throw new Error('expected failure, got a successful read');
  }
  return result;
}

/** Tek elemanı okuyup değerini de çözen kısayol — testlerin çoğu bu ikisini birlikte sorar. */
function readValue(bytes: Uint8Array): { element: MatterTlvElement; value: unknown } {
  const element = expectOk(readMatterTlvElement(bytes, 0));
  switch (element.type) {
    case 'signed-integer': {
      const decoded = decodeMatterTlvSignedInteger(bytes, element.valueOffset, element.valueLength);
      if (!decoded.ok) throw new Error(`signed decode failed: ${decoded.error}`);
      return { element, value: decoded.value };
    }
    case 'unsigned-integer': {
      const decoded = decodeMatterTlvUnsignedInteger(bytes, element.valueOffset, element.valueLength);
      if (!decoded.ok) throw new Error(`unsigned decode failed: ${decoded.error}`);
      return { element, value: decoded.value };
    }
    case 'float': {
      const decoded = decodeMatterTlvFloat(bytes, element.valueOffset, element.valueLength);
      if (!decoded.ok) throw new Error(`float decode failed: ${decoded.error}`);
      return { element, value: decoded.value };
    }
    case 'utf8-string': {
      const decoded = decodeMatterTlvUtf8String(bytes, element.valueOffset, element.valueLength);
      if (!decoded.ok) throw new Error(`string decode failed: ${decoded.error}`);
      return { element, value: decoded.text };
    }
    case 'boolean':
      return { element, value: element.booleanValue };
    default:
      return { element, value: undefined };
  }
}

describe('Tablo 105 — ilkel tiplerin örnek kodlaması (spec Appendix A.12)', () => {
  it('Boolean false / true değeri TİPİN KENDİSİNDE taşır (değer alanı yok)', () => {
    const falseRead = readValue(hex('08'));
    expect(falseRead.element.type).toBe('boolean');
    expect(falseRead.element.valueFieldBytes).toBe(0);
    expect(falseRead.element.end).toBe(1);
    expect(falseRead.value).toBe(false);

    const trueRead = readValue(hex('09'));
    expect(trueRead.value).toBe(true);
    expect(trueRead.element.end).toBe(1);
  });

  it('Signed Integer 1-octet 42 / −17', () => {
    expect(readValue(hex('00 2a')).value).toBe(42n);
    expect(readValue(hex('00 ef')).value).toBe(-17n);
  });

  it('Unsigned Integer 1-octet 42U', () => {
    const read = readValue(hex('04 2a'));
    expect(read.element.type).toBe('unsigned-integer');
    expect(read.value).toBe(42n);
  });

  it('Signed Integer 2-octet 42 (LE)', () => {
    const read = readValue(hex('01 2a 00'));
    expect(read.element.valueFieldBytes).toBe(2);
    expect(read.value).toBe(42n);
  });

  it('Signed Integer 4-octet −170000 (LE, iki tümleyen)', () => {
    const read = readValue(hex('02 f0 67 fd ff'));
    expect(read.element.valueFieldBytes).toBe(4);
    expect(read.value).toBe(-170000n);
  });

  it('Signed Integer 8-octet 40000000000 — number’a sığmaz, bigint döner', () => {
    const read = readValue(hex('03 00 90 2f 50 09 00 00 00'));
    expect(read.element.valueFieldBytes).toBe(8);
    expect(read.value).toBe(40000000000n);
  });

  it('UTF-8 String "Hello!" (1 baytlık uzunluk öneki)', () => {
    const read = readValue(hex('0c 06 48 65 6c 6c 6f 21'));
    expect(read.element.type).toBe('utf8-string');
    expect(read.element.valueLength).toBe(6);
    expect(read.value).toBe('Hello!');
  });

  it('UTF-8 String "Tschüs" — uzunluk KARAKTER değil OKTET sayar (6 karakter, 7 oktet)', () => {
    const read = readValue(hex('0c 07 54 73 63 68 c3 bc 73'));
    expect(read.element.valueLength).toBe(7);
    expect(read.value).toBe('Tschüs');
    expect((read.value as string).length).toBe(6);
  });

  it('Octet String — gövde ham kalır, çözücü gerekmez', () => {
    const bytes = hex('10 05 00 01 02 03 04');
    const element = expectOk(readMatterTlvElement(bytes, 0));
    expect(element.type).toBe('octet-string');
    expect(element.valueLength).toBe(5);
    expect(bytes.slice(element.valueOffset, element.end)).toEqual(hex('00 01 02 03 04'));
  });

  it('Null — değer alanı yok', () => {
    const element = expectOk(readMatterTlvElement(hex('14'), 0));
    expect(element.type).toBe('null');
    expect(element.valueLength).toBe(0);
    expect(element.end).toBe(1);
  });

  it('Float single (IEEE 754, LE): 0.0 / 1÷3 / 17.9 / ±∞', () => {
    expect(readValue(hex('0a 00 00 00 00')).value).toBe(0);
    expect(readValue(hex('0a ab aa aa 3e')).value).toBeCloseTo(1 / 3, 6);
    expect(readValue(hex('0a 33 33 8f 41')).value).toBeCloseTo(17.9, 5);
    expect(readValue(hex('0a 00 00 80 7f')).value).toBe(Number.POSITIVE_INFINITY);
    expect(readValue(hex('0a 00 00 80 ff')).value).toBe(Number.NEGATIVE_INFINITY);
  });

  it('Float double (IEEE 754, LE): 0.0 / 1÷3 / 17.9 / ±∞', () => {
    expect(readValue(hex('0b 00 00 00 00 00 00 00 00')).value).toBe(0);
    expect(readValue(hex('0b 55 55 55 55 55 55 d5 3f')).value).toBeCloseTo(1 / 3, 15);
    expect(readValue(hex('0b 66 66 66 66 66 e6 31 40')).value).toBe(17.9);
    expect(readValue(hex('0b 00 00 00 00 00 00 f0 7f')).value).toBe(Number.POSITIVE_INFINITY);
    expect(readValue(hex('0b 00 00 00 00 00 00 f0 ff')).value).toBe(Number.NEGATIVE_INFINITY);
  });
});

describe('Tablo 106 — container kodlaması (spec Appendix A.12)', () => {
  it('boş Structure / Array / List: container + eşleşen end-of-container', () => {
    for (const [text, type] of [
      ['15 18', 'structure'],
      ['16 18', 'array'],
      ['17 18', 'list'],
    ] as const) {
      const bytes = hex(text);
      const container = expectOk(readMatterTlvElement(bytes, 0));
      expect(container.type, text).toBe(type);
      // Karar 3: container'ın `end`i BAŞLIK sonudur, içerik ayrı yürünür.
      expect(container.end, text).toBe(1);

      const eoc = expectOk(readMatterTlvElement(bytes, container.end));
      expect(eoc.type, text).toBe('end-of-container');
      expect(eoc.end, text).toBe(2);
    }
  });

  it('Structure {0 = 42, 1 = −17} — context tag’li iki üye', () => {
    const bytes = hex('15 20 00 2a 20 01 ef 18');
    const structure = expectOk(readMatterTlvElement(bytes, 0));
    expect(structure.type).toBe('structure');

    const first = expectOk(readMatterTlvElement(bytes, structure.end));
    expect(first.tag.control).toBe('context-specific');
    expect(first.tag.tagNumber).toBe(0);
    const firstValue = decodeMatterTlvSignedInteger(bytes, first.valueOffset, first.valueLength);
    expect(firstValue.ok && firstValue.value).toBe(42n);

    const second = expectOk(readMatterTlvElement(bytes, first.end));
    expect(second.tag.tagNumber).toBe(1);
    const secondValue = decodeMatterTlvSignedInteger(bytes, second.valueOffset, second.valueLength);
    expect(secondValue.ok && secondValue.value).toBe(-17n);

    expect(expectOk(readMatterTlvElement(bytes, second.end)).type).toBe('end-of-container');
  });

  it('Array [0, 1, 2, 3, 4] — beş anonim sint1, sonra EOC', () => {
    const bytes = hex('16 00 00 00 01 00 02 00 03 00 04 18');
    let cursor = expectOk(readMatterTlvElement(bytes, 0)).end;
    const values: bigint[] = [];
    for (;;) {
      const element = expectOk(readMatterTlvElement(bytes, cursor));
      if (element.type === 'end-of-container') break;
      expect(element.tag.control).toBe('anonymous');
      const decoded = decodeMatterTlvSignedInteger(bytes, element.valueOffset, element.valueLength);
      if (decoded.ok) values.push(decoded.value);
      cursor = element.end;
    }
    expect(values).toEqual([0n, 1n, 2n, 3n, 4n]);
  });

  it('Array [42, −170000, {}, 17.9, "Hello!"] — iç içe container + karışık tip', () => {
    const bytes = hex('16 00 2a 02 f0 67 fd ff 15 18 0a 33 33 8f 41 0c 06 48 65 6c 6c 6f 21 18');
    const array = expectOk(readMatterTlvElement(bytes, 0));
    expect(array.type).toBe('array');

    const types: string[] = [];
    let cursor = array.end;
    let depth = 0;
    for (;;) {
      const element = expectOk(readMatterTlvElement(bytes, cursor));
      if (element.type === 'end-of-container') {
        if (depth === 0) break;
        depth -= 1;
        cursor = element.end;
        continue;
      }
      if (depth === 0) types.push(element.type);
      if (element.type === 'structure' || element.type === 'array' || element.type === 'list') depth += 1;
      cursor = element.end;
    }
    expect(types).toEqual(['signed-integer', 'signed-integer', 'structure', 'float', 'utf8-string']);
  });

  it('List — anonim ve context tag KARIŞIK olabilir (spec A.5.3)', () => {
    const bytes = hex('17 00 01 20 00 2a 00 02 00 03 20 00 ef 18');
    const list = expectOk(readMatterTlvElement(bytes, 0));
    expect(list.type).toBe('list');

    const controls: string[] = [];
    let cursor = list.end;
    for (;;) {
      const element = expectOk(readMatterTlvElement(bytes, cursor));
      if (element.type === 'end-of-container') break;
      controls.push(element.tag.control);
      cursor = element.end;
    }
    expect(controls).toEqual([
      'anonymous',
      'context-specific',
      'anonymous',
      'anonymous',
      'context-specific',
    ]);
  });
});

describe('Tablo 107 — tag formları (spec Appendix A.12)', () => {
  it('Anonymous — tag alanı 0 bayt', () => {
    const element = expectOk(readMatterTlvElement(hex('04 2a'), 0));
    expect(element.tag.control).toBe('anonymous');
    expect(element.tag.byteLength).toBe(0);
    expect(element.tag.tagNumber).toBeUndefined();
  });

  it('Context-specific tag 1 — 1 bayt', () => {
    const element = expectOk(readMatterTlvElement(hex('24 01 2a'), 0));
    expect(element.tag.control).toBe('context-specific');
    expect(element.tag.byteLength).toBe(1);
    expect(element.tag.tagNumber).toBe(1);
  });

  it('Common profile tag 1 — 2 bayt (LE)', () => {
    const element = expectOk(readMatterTlvElement(hex('44 01 00 2a'), 0));
    expect(element.tag.control).toBe('common-profile-2');
    expect(element.tag.tagNumber).toBe(1);
  });

  it('Common profile tag 100000 — 4 bayt (LE)', () => {
    const element = expectOk(readMatterTlvElement(hex('64 a0 86 01 00 2a'), 0));
    expect(element.tag.control).toBe('common-profile-4');
    expect(element.tag.tagNumber).toBe(100000);
  });

  it('Fully-qualified 6 bayt — vendorId ‖ profileNumber ‖ tagNumber(2B)', () => {
    const element = expectOk(readMatterTlvElement(hex('c4 f1 ff ed de 01 00 2a'), 0));
    expect(element.tag.control).toBe('fully-qualified-6');
    expect(element.tag.vendorId).toBe(0xfff1);
    expect(element.tag.profileNumber).toBe(0xdeed);
    expect(element.tag.tagNumber).toBe(1);
  });

  it('Fully-qualified 8 bayt — tagNumber 4 bayt', () => {
    const element = expectOk(readMatterTlvElement(hex('e4 f1 ff ed de ed fe 55 aa 2a'), 0));
    expect(element.tag.control).toBe('fully-qualified-8');
    expect(element.tag.vendorId).toBe(0xfff1);
    expect(element.tag.profileNumber).toBe(0xdeed);
    expect(element.tag.tagNumber).toBe(0xaa55feed);
  });

  it('fully-qualified tag’li Structure içinde fully-qualified tag’li üye', () => {
    const bytes = hex('d5 f1 ff ed de 01 00 c4 f1 ff ed de 55 aa 2a 18');
    const structure = expectOk(readMatterTlvElement(bytes, 0));
    expect(structure.type).toBe('structure');
    expect(structure.tag.control).toBe('fully-qualified-6');
    expect(structure.tag.tagNumber).toBe(1);

    const member = expectOk(readMatterTlvElement(bytes, structure.end));
    expect(member.tag.tagNumber).toBe(43605);
    const value = decodeMatterTlvUnsignedInteger(bytes, member.valueOffset, member.valueLength);
    expect(value.ok && value.value).toBe(42n);
  });
});

describe('SDK çapraz doğrulaması (connectedhomeip TestTLV.cpp)', () => {
  it('sIdentifyResponseBuf — gerçek bir Matter mesajı, 53 bayt tam tüketilir', () => {
    const bytes = hex(`
      d5 00 00 0e 00 01 00 25 00 5a 23 24 01 07 24 02
      05 25 03 22 1e 2c 04 10 30 34 41 41 30 31 41 43
      32 33 31 34 30 30 4c 50 2c 09 06 31 2e 34 72 63
      35 24 0c 01 18
    `);
    expect(bytes.length).toBe(53);

    const structure = expectOk(readMatterTlvElement(bytes, 0));
    expect(structure.type).toBe('structure');
    expect(structure.tag.control).toBe('fully-qualified-6');
    expect(structure.tag.profileNumber).toBe(0x000e);

    const members: { tagNumber: number | undefined; value: unknown }[] = [];
    let cursor = structure.end;
    for (;;) {
      const element = expectOk(readMatterTlvElement(bytes, cursor));
      if (element.type === 'end-of-container') {
        expect(element.end).toBe(bytes.length);
        break;
      }
      let value: unknown;
      if (element.type === 'unsigned-integer') {
        const decoded = decodeMatterTlvUnsignedInteger(bytes, element.valueOffset, element.valueLength);
        if (decoded.ok) value = decoded.value;
      } else if (element.type === 'utf8-string') {
        const decoded = decodeMatterTlvUtf8String(bytes, element.valueOffset, element.valueLength);
        if (decoded.ok) value = decoded.text;
      }
      members.push({ tagNumber: element.tag.tagNumber, value });
      cursor = element.end;
    }

    expect(members).toEqual([
      { tagNumber: 0, value: 9050n },
      { tagNumber: 1, value: 7n },
      { tagNumber: 2, value: 5n },
      { tagNumber: 3, value: 7714n },
      { tagNumber: 4, value: '04AA01AC231400LP' },
      { tagNumber: 9, value: '1.4rc5' },
      { tagNumber: 12, value: 1n },
    ]);
  });

  it('implicit profile tag ÇÖZÜLMEZ, işaretlenir (karar 8)', () => {
    // SDK Encoding1: `88 02 00` = Boolean False, implicit profile 2 baytlık tag 2.
    const boolElement = expectOk(readMatterTlvElement(hex('88 02 00'), 0));
    expect(boolElement.tag.control).toBe('implicit-profile-2');
    expect(boolElement.tag.tagNumber).toBe(2);
    expect(boolElement.tag.vendorId).toBeUndefined();
    expect(boolElement.tag.profileNumber).toBeUndefined();
    expect(boolElement.booleanValue).toBe(false);

    // `b4 a0 bb 0d 00` = Null, implicit profile 4 baytlık tag 900000.
    const nullElement = expectOk(readMatterTlvElement(hex('b4 a0 bb 0d 00'), 0));
    expect(nullElement.tag.control).toBe('implicit-profile-4');
    expect(nullElement.tag.tagNumber).toBe(900000);
    expect(nullElement.type).toBe('null');
  });

  it('tag control ile eleman tipi OR’lanır — altı kombinasyon', () => {
    for (const [text, control, type] of [
      ['d5 bb aa dd cc 01 00', 'fully-qualified-6', 'structure'],
      ['c9 bb aa dd cc 02 00', 'fully-qualified-6', 'boolean'],
      ['88 02 00', 'implicit-profile-2', 'boolean'],
      ['36 00', 'context-specific', 'array'],
      ['d4 bb aa dd cc 11 00', 'fully-qualified-6', 'null'],
      ['b4 a0 bb 0d 00', 'implicit-profile-4', 'null'],
    ] as const) {
      const element = expectOk(readMatterTlvElement(hex(text), 0));
      expect(element.tag.control, text).toBe(control);
      expect(element.type, text).toBe(type);
    }
  });
});

describe('hata yolları', () => {
  it('boş/kısa arabellek truncated döner', () => {
    expect(expectFail(readMatterTlvElement(new Uint8Array(), 0)).error).toBe('truncated');
    // Context tag bekliyor ama tag baytı yok.
    expect(expectFail(readMatterTlvElement(hex('24'), 0)).error).toBe('truncated');
    // 4 baytlık değer bekliyor ama 2 bayt var.
    expect(expectFail(readMatterTlvElement(hex('02 f0 67'), 0)).error).toBe('truncated');
  });

  it('reserved eleman tipi (0x19-0x1F) açık hata (karar 6)', () => {
    for (const raw of [0x19, 0x1a, 0x1f]) {
      const result = expectFail(readMatterTlvElement(Uint8Array.from([raw]), 0));
      expect(result.error, `0x${raw.toString(16)}`).toBe('reserved-element-type');
    }
  });

  it('tag TAŞIYAN end-of-container reddedilir (karar 5)', () => {
    // 0x18 | 0x20 = 0x38 — context tag'li EOC, spec A.10 yasaklar.
    const result = expectFail(readMatterTlvElement(hex('38 00'), 0));
    expect(result.error).toBe('tagged-end-of-container');
  });

  it('string uzunluğu arabelleği aşarsa value-overflow', () => {
    // 10 baytlık gövde vaat ediyor ama 2 bayt var.
    const result = expectFail(readMatterTlvElement(hex('0c 0a 41 42'), 0));
    expect(result.error).toBe('value-overflow');
    expect(result.offset).toBe(2);
  });

  it('8 baytlık uzunluk 0xFFFFFFFF üstündeyse length-unsupported (karar 7)', () => {
    const bytes = hex('0f ff ff ff ff ff ff ff ff');
    const result = expectFail(readMatterTlvElement(bytes, 0));
    expect(result.error).toBe('length-unsupported');
  });

  it('`limit` komşu alana sarkmayı engeller', () => {
    const bytes = hex('0c 06 48 65 6c 6c 6f 21');
    // Sınır 4'te: 6 baytlık gövde sığmaz.
    const result = expectFail(readMatterTlvElement(bytes, 0, 4));
    expect(result.error).toBe('value-overflow');
    // Sınırsız okuma çalışır.
    expect(expectOk(readMatterTlvElement(bytes, 0)).valueLength).toBe(6);
  });

  it('bozuk UTF-8 hata DEĞİL, wellFormed:false ile işaretlenir', () => {
    // 0xFF geçerli bir UTF-8 başlangıç baytı değildir.
    const bytes = hex('0c 02 ff fe');
    const element = expectOk(readMatterTlvElement(bytes, 0));
    const decoded = decodeMatterTlvUtf8String(bytes, element.valueOffset, element.valueLength);
    expect(decoded.ok && decoded.wellFormed).toBe(false);
    expect(decoded.ok && decoded.text.length).toBeGreaterThan(0);
  });
});

describe('validateMatterTlvTag — container tag kuralları (karar 4)', () => {
  const anonymous = { control: 'anonymous', byteLength: 0 } as const;
  const context = { control: 'context-specific', tagNumber: 1, byteLength: 1 } as const;

  it('en dış seviyede context tag yasak (spec A.2.2)', () => {
    expect(validateMatterTlvTag(context, undefined)).toBe('context-tag-at-top-level');
    expect(validateMatterTlvTag(anonymous, undefined)).toBeUndefined();
  });

  it('structure üyesi anonim OLAMAZ (spec A.5.1)', () => {
    expect(validateMatterTlvTag(anonymous, 'structure')).toBe('anonymous-tag-in-structure');
    expect(validateMatterTlvTag(context, 'structure')).toBeUndefined();
  });

  it('array üyesi anonim OLMAK ZORUNDA (spec A.5.2)', () => {
    expect(validateMatterTlvTag(context, 'array')).toBe('non-anonymous-tag-in-array');
    expect(validateMatterTlvTag(anonymous, 'array')).toBeUndefined();
  });

  it('list her tag formunu kabul eder (spec A.5.3; A.2.2 ile çelişki dosya başında çözüldü)', () => {
    for (const containerType of ['list'] satisfies MatterTlvContainerType[]) {
      expect(validateMatterTlvTag(anonymous, containerType)).toBeUndefined();
      expect(validateMatterTlvTag(context, containerType)).toBeUndefined();
    }
  });
});
