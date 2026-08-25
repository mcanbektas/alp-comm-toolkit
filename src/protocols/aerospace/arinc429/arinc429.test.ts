import { describe, expect, it } from 'vitest';

import { arinc429Parser, arinc429Plugin, buildArinc429Word, parseArinc429 } from './arinc429';
import { isParseSuccess } from '@/protocol-core/types';
import type { ParsedField, ParsedFrame } from '@/protocol-core/types';

/**
 * Faz 10 dalga 15f — ARINC 429.
 *
 * En önemli bölüm `Label bit sırası`: dosya başındaki dört bağımsız kaynağın
 * SAYISAL vektörleri buraya fixture olarak girdi ve TERS sıranın FARKLI sonuç
 * verdiği ayrıca kanıtlanıyor (15c'nin `packedChannels.test.ts` BitOrder
 * disiplini — "yalnız yeşil test değil, sırayı gerçekten sabitleyen test").
 */

const LITTLE_ENDIAN = 'little-endian';
const BIG_ENDIAN = 'big-endian';

function decode(bytes: Uint8Array, options?: Record<string, unknown>): ParsedFrame {
  const result = arinc429Parser.parse(bytes, options === undefined ? undefined : { options });
  if (!isParseSuccess(result)) {
    throw new Error(`beklenmeyen çözümleme hatası: ${result.error.code} ${result.error.message}`);
  }
  return result.frame;
}

function field(frame: ParsedFrame, id: string): ParsedField {
  const found = frame.fields.find((candidate) => candidate.id === id);
  if (found === undefined) {
    throw new Error(`alan bulunamadı: ${id} (var olanlar: ${frame.fields.map((f) => f.id).join(', ')})`);
  }
  return found;
}

/** Yalnız Label'i taşıyan en yalın word — geri kalan alanlar sıfır. */
function labelOnlyWord(labelOctet: number): Uint8Array {
  return buildArinc429Word({ labelOctet, sdi: 0, data: 0, ssm: 0 }, LITTLE_ENDIAN);
}

// ─────────────────────────────────────────────────────────────────────────────

describe('ARINC 429 — Label bit sırası (dört bağımsız kaynağın SAYISAL vektörleri)', () => {
  it('referansın KENDİ vektörü: Label okteti 0xD1 → 213₈ (standard sıra)', () => {
    // Wikipedia "ARINC 429": "to transmit a Label 213₈ [or 8B₁₆] the bit-reversed
    // value D1₁₆ is written to the Label octet". PyARINC429 aynı eşlemeyi
    // `LABELS[0xD1] = 0x8B` ile uyguluyor.
    const frame = decode(labelOnlyWord(0xd1), {
      wordByteOrder: LITTLE_ENDIAN,
      labelBitOrder: 'standard',
    });
    const label = field(frame, 'arinc429-word-0-label');
    expect(label.rawValue).toBe(0xd1);
    expect(label.physicalValue).toBe('213₈');
    // 213₈ = 0x8B — vektörün ikinci yarısı.
    expect(Number.parseInt(String(label.physicalValue).replace('₈', ''), 8)).toBe(0x8b);
  });

  it('TERS sıra FARKLI sonuç verir — aynı oktet pre-reversed’de 321₈ okunur', () => {
    // Bu, dalganın "sessiz yanlış değer" testidir: iki sıra da hata VERMEZ,
    // yalnız değer değişir (`bitCursor.ts:22`nin kendi uyarısı).
    const bytes = labelOnlyWord(0xd1);
    const standard = field(
      decode(bytes, { wordByteOrder: LITTLE_ENDIAN, labelBitOrder: 'standard' }),
      'arinc429-word-0-label',
    );
    const preReversed = field(
      decode(bytes, { wordByteOrder: LITTLE_ENDIAN, labelBitOrder: 'pre-reversed' }),
      'arinc429-word-0-label',
    );

    expect(standard.physicalValue).toBe('213₈');
    expect(preReversed.physicalValue).toBe('321₈'); // 0xD1 = 209 = 321₈
    expect(preReversed.physicalValue).not.toBe(standard.physicalValue);
    // Ham oktet İKİSİNDE DE aynı — değişen yalnız yorum.
    expect(standard.rawValue).toBe(preReversed.rawValue);
  });

  it('bağımsız bir uygulamanın YAYIMLANMIŞ fixture’larının hepsi tutuyor', () => {
    // musashin/Py429 `UnitTests/LabelFieldTest.py` `refValues`
    // (oktal Label ↔ paketlenmiş oktet).
    const published: readonly (readonly [string, number])[] = [
      ['000₈', 0x00],
      ['041₈', 0x84],
      ['107₈', 0xe2],
      ['206₈', 0x61],
      ['350₈', 0x17],
      ['377₈', 0xff],
    ];

    for (const [octal, octet] of published) {
      const frame = decode(labelOnlyWord(octet), {
        wordByteOrder: LITTLE_ENDIAN,
        labelBitOrder: 'standard',
      });
      expect(field(frame, 'arinc429-word-0-label').physicalValue, `oktet 0x${octet.toString(16)}`).toBe(
        octal,
      );
    }
  });

  it('labelBitOrder SEÇİLMEDEN oktal BASILMAZ ve uyarı çıkar', () => {
    const frame = decode(labelOnlyWord(0xd1), { wordByteOrder: LITTLE_ENDIAN });
    const label = field(frame, 'arinc429-word-0-label');

    expect(label.rawValue).toBe(0xd1);
    expect(label.physicalValue).toBeUndefined();
    expect(label.warnings).toContain('protocol.arinc429.field.labelBitOrderNotSelected');
    expect(frame.warnings.map((warning) => warning.code)).toContain('labelBitOrderNotSelected');
  });

  it('Label ANLAMI hiçbir kipte basılmaz — yalnız oktal/sayı', () => {
    const frame = decode(labelOnlyWord(0x84), {
      wordByteOrder: LITTLE_ENDIAN,
      labelBitOrder: 'standard',
    });
    const label = field(frame, 'arinc429-word-0-label');
    expect(label.name).toBe('Label (bit 8:1)');
    expect(String(label.physicalValue)).toMatch(/^[0-7]{3}₈$/);
    expect(label.warnings).toContain('protocol.arinc429.field.labelMeaningRequiresIcd');
  });
});

describe('ARINC 429 — alan sınırları (SDI 10:9, Data 29:11, SSM 31:30, Parity 32)', () => {
  it('her alan KENDİ bitlerini okur — dört alan da ayrı ayrı ayırt ediliyor', () => {
    const bytes = buildArinc429Word({ labelOctet: 0xd1, sdi: 0b10, data: 0x5a5a5, ssm: 0b01 }, LITTLE_ENDIAN);
    const frame = decode(bytes, { wordByteOrder: LITTLE_ENDIAN, labelBitOrder: 'standard' });

    expect(field(frame, 'arinc429-word-0-label').rawValue).toBe(0xd1);
    expect(field(frame, 'arinc429-word-0-sdi').rawValue).toBe(0b10);
    expect(field(frame, 'arinc429-word-0-data').rawValue).toBe(0x5a5a5);
    expect(field(frame, 'arinc429-word-0-ssm').rawValue).toBe(0b01);
    expect(field(frame, 'arinc429-word-0-parity').physicalValue).toBe('PASS');
  });

  it('alan ADLARI bit ayrıntısını taşır, offset/length BAYT cinsindendir', () => {
    const bytes = buildArinc429Word({ labelOctet: 0xd1, sdi: 1, data: 12345, ssm: 3 }, LITTLE_ENDIAN);
    const frame = decode(bytes, { wordByteOrder: LITTLE_ENDIAN, labelBitOrder: 'standard' });

    expect(field(frame, 'arinc429-word-0-label').name).toBe('Label (bit 8:1)');
    expect(field(frame, 'arinc429-word-0-sdi').name).toBe('SDI (bit 10:9)');
    expect(field(frame, 'arinc429-word-0-data').name).toBe('Data (bit 29:11)');
    expect(field(frame, 'arinc429-word-0-parity').name).toBe('Parity (bit 32)');

    // little-endian: Label okteti bayt 0, parite biti bayt 3'ün içindedir.
    expect(field(frame, 'arinc429-word-0-label')).toMatchObject({ offset: 0, length: 1 });
    expect(field(frame, 'arinc429-word-0-parity')).toMatchObject({ offset: 3, length: 1 });
    // Data bitleri 11–29 register baytları 1–3'ü kapsar.
    expect(field(frame, 'arinc429-word-0-data')).toMatchObject({ offset: 1, length: 3 });
    for (const parsed of frame.fields) {
      expect(parsed.offset + parsed.length).toBeLessThanOrEqual(bytes.length);
    }
  });
});

describe('ARINC 429 — bayt sırası', () => {
  it('AYNI mantıksal word LE ve BE yazıldığında AYNI alanlara çözülür', () => {
    const init = { labelOctet: 0xd1, sdi: 1, data: 12345, ssm: 3 } as const;
    const little = decode(buildArinc429Word(init, LITTLE_ENDIAN), {
      wordByteOrder: LITTLE_ENDIAN,
      labelBitOrder: 'standard',
    });
    const big = decode(buildArinc429Word(init, BIG_ENDIAN), {
      wordByteOrder: BIG_ENDIAN,
      labelBitOrder: 'standard',
    });

    for (const id of ['label', 'sdi', 'data', 'ssm'] as const) {
      const key = `arinc429-word-0-${id}`;
      expect(field(big, key).rawValue, key).toBe(field(little, key).rawValue);
    }
    expect(field(big, 'arinc429-word-0-label').physicalValue).toBe('213₈');
  });

  it('BE yazılmış word’ü LE sanmak SESSİZCE yanlış değer verir — bu yüzden varsayılan YOK', () => {
    const bytes = buildArinc429Word({ labelOctet: 0xd1, sdi: 1, data: 12345, ssm: 3 }, BIG_ENDIAN);
    const wrong = decode(bytes, { wordByteOrder: LITTLE_ENDIAN, labelBitOrder: 'standard' });
    expect(field(wrong, 'arinc429-word-0-label').rawValue).not.toBe(0xd1);
    expect(field(wrong, 'arinc429-word-0-data').rawValue).not.toBe(12345);
  });

  it('wordByteOrder SEÇİLMEDEN yalnız ham word + parite basılır', () => {
    const bytes = buildArinc429Word({ labelOctet: 0xd1, sdi: 1, data: 12345, ssm: 3 }, LITTLE_ENDIAN);
    const frame = decode(bytes);

    expect(frame.fields.map((parsed) => parsed.id)).toEqual([
      'arinc429-word-0-raw',
      'arinc429-word-0-parity',
    ]);
    expect(field(frame, 'arinc429-word-0-raw').rawBytes).toEqual(bytes);
    // Parite BAYT SIRASINDAN BAĞIMSIZ olduğu için burada da doğrulanır.
    expect(field(frame, 'arinc429-word-0-parity').physicalValue).toBe('PASS');
    expect(frame.warnings.map((warning) => warning.code)).toContain('wordByteOrderNotSelected');
  });

  it('parite gerçekten bayt sırasından bağımsız: aynı word LE ve BE’de aynı sonucu verir', () => {
    const init = { labelOctet: 0x84, sdi: 2, data: 0x3ffff, ssm: 1 } as const;
    const little = buildArinc429Word(init, LITTLE_ENDIAN);
    const big = buildArinc429Word(init, BIG_ENDIAN);
    expect(arinc429Parser.canParse(little)).toBe(arinc429Parser.canParse(big));
    expect(decode(little).fields.at(-1)?.physicalValue).toBe(
      decode(big).fields.at(-1)?.physicalValue,
    );
  });
});

describe('ARINC 429 — parite', () => {
  it('tek (odd) parite PASS: kurucu doğru biti üretiyor', () => {
    const bytes = buildArinc429Word({ labelOctet: 0xd1, sdi: 1, data: 12345, ssm: 3 }, LITTLE_ENDIAN);
    const frame = decode(bytes, { wordByteOrder: LITTLE_ENDIAN, labelBitOrder: 'standard' });
    expect(frame.valid).toBe(true);
    expect(frame.errors).toEqual([]);
    expect(field(frame, 'arinc429-word-0-parity').valid).toBe(true);
  });

  it('parite biti ters çevrilince checksum-mismatch basılır ve çerçeve geçersiz olur', () => {
    const good = buildArinc429Word({ labelOctet: 0xd1, sdi: 1, data: 12345, ssm: 3 }, LITTLE_ENDIAN);
    const bad = buildArinc429Word(
      { labelOctet: 0xd1, sdi: 1, data: 12345, ssm: 3, flipParity: true },
      LITTLE_ENDIAN,
    );
    expect(bad).not.toEqual(good);

    const frame = decode(bad, { wordByteOrder: LITTLE_ENDIAN, labelBitOrder: 'standard' });
    expect(frame.valid).toBe(false);
    expect(frame.errors.map((error) => error.code)).toEqual(['checksum-mismatch']);
    const parity = field(frame, 'arinc429-word-0-parity');
    expect(parity.valid).toBe(false);
    expect(parity.physicalValue).toBe('FAIL');
    expect(parity.warnings).toContain('protocol.arinc429.field.parityFailed');
  });

  it('parityMode "even" seçilirse aynı word REDDEDİLİR — kip gerçekten sonucu değiştiriyor', () => {
    const bytes = buildArinc429Word({ labelOctet: 0xd1, sdi: 1, data: 12345, ssm: 3 }, LITTLE_ENDIAN);
    const odd = decode(bytes, { wordByteOrder: LITTLE_ENDIAN, parityMode: 'odd' });
    const even = decode(bytes, { wordByteOrder: LITTLE_ENDIAN, parityMode: 'even' });
    expect(odd.valid).toBe(true);
    expect(even.valid).toBe(false);
    // "odd varsayıldı" uyarısı yalnız odd kipinde çıkar.
    expect(odd.warnings.map((warning) => warning.code)).toContain('parityModeAssumedOdd');
    expect(even.warnings.map((warning) => warning.code)).not.toContain('parityModeAssumedOdd');
  });
});

describe('ARINC 429 — BNR', () => {
  it('spec çalışılmış örneği: Raw=12345, Resolution=0.1 → 1234.5', () => {
    const bytes = buildArinc429Word({ labelOctet: 0xd1, sdi: 1, data: 12345, ssm: 3 }, LITTLE_ENDIAN);
    const frame = decode(bytes, {
      wordByteOrder: LITTLE_ENDIAN,
      labelBitOrder: 'standard',
      dataEncoding: 'bnr',
      resolution: 0.1,
    });
    const bnr = field(frame, 'arinc429-word-0-bnr');

    expect(bnr.rawValue).toBe(12345);
    expect(bnr.physicalValue).toBeCloseTo(1234.5, 10);
    // Birim UYDURULMAZ: `0.1 ft` spec'in ÖRNEĞİ, evrensel bir sabit değil.
    expect(bnr.unit).toBeUndefined();
    expect(field(frame, 'arinc429-word-0-bnr-sign').physicalValue).toBe(
      'Plus, North, East, Right, To, Above',
    );
  });

  it('resolution VERİLMEDEN fiziksel değer BASILMAZ, ham işaretli sayı + uyarı kalır', () => {
    const bytes = buildArinc429Word({ labelOctet: 0xd1, sdi: 1, data: 12345, ssm: 3 }, LITTLE_ENDIAN);
    const bnr = field(
      decode(bytes, { wordByteOrder: LITTLE_ENDIAN, dataEncoding: 'bnr' }),
      'arinc429-word-0-bnr',
    );
    expect(bnr.physicalValue).toBe(12345);
    expect(bnr.warnings).toContain('protocol.arinc429.field.resolutionRequiredForPhysicalValue');
  });

  it('negatif BNR: 19 bitlik iki tümleyen −12345 ve işaret alanı', () => {
    const bytes = buildArinc429Word({ labelOctet: 0x84, sdi: 2, data: 0x7cfc7, ssm: 3 }, LITTLE_ENDIAN);
    const frame = decode(bytes, {
      wordByteOrder: LITTLE_ENDIAN,
      labelBitOrder: 'standard',
      dataEncoding: 'bnr',
      resolution: 0.1,
    });

    expect(field(frame, 'arinc429-word-0-bnr').rawValue).toBe(0x7cfc7);
    expect(field(frame, 'arinc429-word-0-bnr').physicalValue).toBeCloseTo(-1234.5, 10);
    expect(field(frame, 'arinc429-word-0-bnr-sign').name).toBe('BNR Sign (bit 29)');
    expect(field(frame, 'arinc429-word-0-bnr-sign').physicalValue).toBe(
      'Minus, South, West, Left, From, Below',
    );
  });

  it('dataBitRange verilince yalnız alt aralık yorumlanır', () => {
    // Bitler 11–14 = 0b1010 (=10), üstteki bitler ilgisiz.
    const bytes = buildArinc429Word({ labelOctet: 0xd1, sdi: 0, data: 0x5a5a, ssm: 0 }, LITTLE_ENDIAN);
    const frame = decode(bytes, {
      wordByteOrder: LITTLE_ENDIAN,
      dataEncoding: 'bnr',
      dataLowBit: 11,
      dataHighBit: 14,
    });
    const bnr = field(frame, 'arinc429-word-0-bnr');
    expect(bnr.name).toBe("BNR Value (bit 14:11, two's complement)");
    expect(bnr.rawValue).toBe(0x5a5a & 0xf);
    // 0xA = 0b1010 → 4 bitlik iki tümleyende −6.
    expect(bnr.physicalValue).toBe(-6);
    expect(frame.warnings.map((warning) => warning.code)).not.toContain('dataBitRangeInvalid');
  });

  it('geçersiz dataBitRange SESSİZCE kabul edilmez — tam aralığa dönülür + uyarı', () => {
    const bytes = buildArinc429Word({ labelOctet: 0xd1, sdi: 0, data: 12345, ssm: 0 }, LITTLE_ENDIAN);
    const frame = decode(bytes, {
      wordByteOrder: LITTLE_ENDIAN,
      dataEncoding: 'bnr',
      dataLowBit: 20,
      dataHighBit: 14,
    });
    expect(field(frame, 'arinc429-word-0-bnr').name).toBe("BNR Value (bit 29:11, two's complement)");
    expect(frame.warnings.map((warning) => warning.code)).toContain('dataBitRangeInvalid');
  });
});

describe('ARINC 429 — BCD', () => {
  it('19 bit dört tam basamak + 3 bitlik en anlamlı basamağa bölünür', () => {
    const bytes = buildArinc429Word({ labelOctet: 0xe2, sdi: 0, data: 0x12345, ssm: 0 }, LITTLE_ENDIAN);
    const bcd = field(
      decode(bytes, { wordByteOrder: LITTLE_ENDIAN, dataEncoding: 'bcd' }),
      'arinc429-word-0-bcd',
    );
    expect(bcd.physicalValue).toBe('12345');
    expect(bcd.valid).toBe(true);
  });

  it('resolution verilince basamaklar ölçeklenir', () => {
    const bytes = buildArinc429Word({ labelOctet: 0xe2, sdi: 0, data: 0x12345, ssm: 0 }, LITTLE_ENDIAN);
    const bcd = field(
      decode(bytes, { wordByteOrder: LITTLE_ENDIAN, dataEncoding: 'bcd', resolution: 0.1 }),
      'arinc429-word-0-bcd',
    );
    expect(bcd.physicalValue).toBeCloseTo(1234.5, 10);
  });

  it('9’dan büyük bir 4 bitlik grup alanı GEÇERSİZ yapar', () => {
    const bytes = buildArinc429Word({ labelOctet: 0xe2, sdi: 0, data: 0x1234a, ssm: 0 }, LITTLE_ENDIAN);
    const bcd = field(
      decode(bytes, { wordByteOrder: LITTLE_ENDIAN, dataEncoding: 'bcd' }),
      'arinc429-word-0-bcd',
    );
    expect(bcd.valid).toBe(false);
    expect(bcd.warnings).toContain('protocol.arinc429.field.bcdDigitOutOfRange');
  });
});

describe('ARINC 429 — SSM (tuzak 3)', () => {
  it('dataEncoding SEÇİLMEDEN SSM HAM kalır + uyarı, ama iki bit HER ZAMAN basılır', () => {
    const bytes = buildArinc429Word({ labelOctet: 0xd1, sdi: 0, data: 0, ssm: 0b10 }, LITTLE_ENDIAN);
    const ssm = field(decode(bytes, { wordByteOrder: LITTLE_ENDIAN }), 'arinc429-word-0-ssm');

    expect(ssm.name).toBe('SSM (bit 31:30)');
    expect(ssm.rawValue).toBe(0b10);
    expect(ssm.physicalValue).toBe('10');
    expect(ssm.warnings).toContain('protocol.arinc429.field.ssmMeaningRequiresEncoding');
  });

  it('dataEncoding değişince SSM alanının ADI (rolü) değişir — iki bit AYNI kalır', () => {
    const bytes = buildArinc429Word({ labelOctet: 0xd1, sdi: 0, data: 0, ssm: 0b10 }, LITTLE_ENDIAN);
    const names = (['raw', 'bnr', 'bcd', 'discrete'] as const).map((encoding) => {
      const ssm = field(
        decode(bytes, { wordByteOrder: LITTLE_ENDIAN, dataEncoding: encoding }),
        'arinc429-word-0-ssm',
      );
      expect(ssm.physicalValue).toBe('10');
      return ssm.name;
    });

    expect(new Set(names).size).toBe(4);
    expect(names[1]).toBe('SSM (bit 31:30, BNR status — sign is bit 29)');
    expect(names[2]).toBe('SSM (bit 31:30, BCD status/sign)');
    expect(names[3]).toBe('SSM (bit 31:30, discrete signless status)');
  });

  it('SAYISAL durum adı (Normal Operation / Failure Warning …) HİÇBİR kodlamada basılmaz', () => {
    // İki bağımsız uygulama bu tabloda ÇELİŞİYOR (dosya başı) — depo kuralı:
    // örtüşmeyen kaynak → alan ADLANDIRILMAZ.
    const forbidden = ['Normal Operation', 'Functional Test', 'Failure Warning', 'No Computed Data'];
    for (const encoding of ['raw', 'bnr', 'bcd', 'discrete'] as const) {
      for (let ssmValue = 0; ssmValue < 4; ssmValue += 1) {
        const bytes = buildArinc429Word(
          { labelOctet: 0xd1, sdi: 0, data: 0, ssm: ssmValue },
          LITTLE_ENDIAN,
        );
        const ssm = field(
          decode(bytes, { wordByteOrder: LITTLE_ENDIAN, dataEncoding: encoding }),
          'arinc429-word-0-ssm',
        );
        const rendered = `${ssm.name} ${String(ssm.physicalValue)}`;
        for (const phrase of forbidden) {
          expect(rendered, `${encoding}/SSM=${String(ssmValue)}`).not.toContain(phrase);
        }
      }
      const bytes = buildArinc429Word({ labelOctet: 0xd1, sdi: 0, data: 0, ssm: 1 }, LITTLE_ENDIAN);
      const ssm = field(
        decode(bytes, { wordByteOrder: LITTLE_ENDIAN, dataEncoding: encoding }),
        'arinc429-word-0-ssm',
      );
      expect(ssm.warnings.length).toBe(1);
    }
  });
});

describe('ARINC 429 — Discrete', () => {
  it('19 bit ikilik gösterilir, bit ANLAMLARI verilmez', () => {
    const bytes = buildArinc429Word({ labelOctet: 0x61, sdi: 3, data: 0x15, ssm: 0 }, LITTLE_ENDIAN);
    const discrete = field(
      decode(bytes, { wordByteOrder: LITTLE_ENDIAN, dataEncoding: 'discrete' }),
      'arinc429-word-0-discrete',
    );
    expect(discrete.physicalValue).toBe('0000000000000010101');
    expect(String(discrete.physicalValue)).toHaveLength(19);
    expect(discrete.warnings).toContain('protocol.arinc429.field.discreteBitMeaningRequiresIcd');
  });
});

describe('ARINC 429 — çok word’lü girdi ve hata yolları', () => {
  it('alan id’si word İNDEKSİNİ taşır — ikinci word’ün alanları çakışmaz', () => {
    const bytes = new Uint8Array(8);
    bytes.set(buildArinc429Word({ labelOctet: 0xd1, sdi: 1, data: 12345, ssm: 3 }, LITTLE_ENDIAN), 0);
    bytes.set(buildArinc429Word({ labelOctet: 0xe2, sdi: 0, data: 0x12345, ssm: 0 }, LITTLE_ENDIAN), 4);

    const frame = decode(bytes, { wordByteOrder: LITTLE_ENDIAN, labelBitOrder: 'standard' });
    expect(field(frame, 'arinc429-word-0-label').physicalValue).toBe('213₈');
    expect(field(frame, 'arinc429-word-1-label').physicalValue).toBe('107₈');
    expect(field(frame, 'arinc429-word-1-label').offset).toBe(4);

    const ids = frame.fields.map((parsed) => parsed.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('4’ün katı olmayan girdi truncated-frame verir', () => {
    const result = parseArinc429(new Uint8Array([0xd1, 0x64, 0x30]));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('truncated-frame');
      expect(result.recoverable).toBe(true);
    }
  });

  it('boş girdi truncated-frame verir', () => {
    const result = parseArinc429(new Uint8Array(0));
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe('truncated-frame');
  });

  it('maxFrameLength aşılırsa frame-too-long verir', () => {
    const bytes = new Uint8Array(16);
    const result = arinc429Parser.parse(bytes, { maxFrameLength: 8 });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe('frame-too-long');
  });

  it('iptal edilen çözümleme parser-timeout ile döner, exception fırlatmaz', () => {
    const controller = new AbortController();
    controller.abort();
    const result = arinc429Parser.parse(new Uint8Array(4), { signal: controller.signal });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe('parser-timeout');
  });
});

describe('ARINC 429 — plugin sözleşmesi', () => {
  it('örnek çerçevelerin hepsi bildirdikleri geçerlilikte çözülür', () => {
    for (const example of arinc429Plugin.exampleFrames) {
      const result = arinc429Parser.parse(example.bytes, {
        options: { wordByteOrder: 'little-endian', labelBitOrder: 'standard' },
      });
      const expectedValid = example.expectedValid ?? true;
      const actuallyValid = isParseSuccess(result) && result.frame.valid;
      // `big-endian-adapter-word` bilerek LE ile okunuyor değil — kendi
      // sırasıyla ayrıca sınanıyor; burada yalnız parite (sıradan bağımsız)
      // ve yapısal geçerlilik ölçülüyor.
      expect(actuallyValid, `${example.id}`).toBe(expectedValid);
    }
  });

  it('decodeOptions kanalı yedi alanı bildiriyor ve hiçbirinde uydurma varsayılan yok', () => {
    const options = arinc429Plugin.decodeOptions ?? [];
    expect(options.map((option) => option.id)).toEqual([
      'wordByteOrder',
      'labelBitOrder',
      'dataEncoding',
      'parityMode',
      'resolution',
      'dataLowBit',
      'dataHighBit',
    ]);
    // Bayt sırası ve Label bit sırası TAHMİN EDİLMEZ.
    expect(options.find((option) => option.id === 'wordByteOrder')?.defaultValue).toBe('unset');
    expect(options.find((option) => option.id === 'labelBitOrder')?.defaultValue).toBe('unset');
    // `resolution` KODA GÖMÜLMEZ: sentinel 0 ve ÜST SINIR YOK (15e'nin dersi).
    const resolution = options.find((option) => option.id === 'resolution');
    expect(resolution?.defaultValue).toBe(0);
    expect(resolution?.max).toBeUndefined();
    // Bit aralığı seçenekleri gerçekçi değerleri (11–29) panelde reddettirmemeli.
    for (const id of ['dataLowBit', 'dataHighBit']) {
      const option = options.find((candidate) => candidate.id === id);
      expect(option?.min).toBe(0);
      expect(option?.max).toBeGreaterThanOrEqual(29);
    }
  });

  it('katalog `live` sekmesi VERMEDİĞİ için plugin de akış arayüzü sunmaz', () => {
    expect(arinc429Plugin.encoder).toBeUndefined();
    expect(arinc429Plugin.calculators).toBeUndefined();
  });
});
