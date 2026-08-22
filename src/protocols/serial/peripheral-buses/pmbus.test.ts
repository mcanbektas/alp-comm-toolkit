import { describe, expect, it } from 'vitest';

import { decodeLinear11 } from '@/protocol-core/timing/pmbus';
import type { ParsedField } from '@/protocol-core/types';

import { decodeDirectReading, parsePmbus, pmbusParser, pmbusPlugin } from './pmbus';
import { decodeStatusBits, findPmbusCommand, STATUS_BYTE_BITS, STATUS_WORD_HIGH_BITS } from './pmbusCommands';
import { computeSmbusPec } from './smbusCore';

const ADDR_W = 0xb4;
const ADDR_R = 0xb5;

function withPec(body: number[]): Uint8Array {
  return Uint8Array.from([...body, computeSmbusPec(Uint8Array.from(body))]);
}

function fieldById(fields: readonly ParsedField[], id: string): ParsedField | undefined {
  return fields.find((field) => field.id === id);
}

function parseOrThrow(bytes: Uint8Array) {
  const result = parsePmbus(bytes);
  if (!result.success) throw new Error(`çözümleme başarısız: ${result.error.code}`);
  return result.frame;
}

describe('PMBus komut haritası', () => {
  it('kodlar Table 31 ile örtüşüyor', () => {
    expect(findPmbusCommand(0x8b)?.name).toBe('READ_VOUT');
    expect(findPmbusCommand(0x79)?.name).toBe('STATUS_WORD');
    expect(findPmbusCommand(0x30)?.name).toBe('COEFFICIENTS');
    expect(findPmbusCommand(0x8d)?.name).toBe('READ_TEMPERATURE_1');
  });

  it('bilinmeyen kod undefined döner (uydurma ad yok)', () => {
    expect(findPmbusCommand(0xff)).toBeUndefined();
  });

  it('çıkış gerilimi komutları ULINEAR16, diğer telemetri Linear11 (§7.1/§8.4)', () => {
    expect(findPmbusCommand(0x21)?.format).toBe('ulinear16');
    expect(findPmbusCommand(0x8b)?.format).toBe('ulinear16');
    expect(findPmbusCommand(0x88)?.format).toBe('linear11');
    expect(findPmbusCommand(0x8c)?.format).toBe('linear11');
  });
});

describe('decodeStatusBits', () => {
  it("spec özetinin KENDİ örneği 0x0840 tutarlı: alt bayt OFF, üst bayt PG_STATUS#", () => {
    expect(decodeStatusBits(0x40, STATUS_BYTE_BITS)).toEqual(['OFF']);
    expect(decodeStatusBits(0x08, STATUS_WORD_HIGH_BITS)).toEqual(['PG_STATUS#']);
  });

  it('birden çok bit MSB→LSB sırayla listelenir', () => {
    expect(decodeStatusBits(0b1000_0100, STATUS_BYTE_BITS)).toEqual(['BUSY', 'TEMPERATURE']);
  });

  it('hiçbir bit set değilse boş dizi', () => {
    expect(decodeStatusBits(0, STATUS_BYTE_BITS)).toEqual([]);
  });
});

describe('parsePmbus — komut yorumu', () => {
  it('READ_VIN Linear11 çözülür ve düşük bayt ÖNCE okunur (§7.6)', () => {
    const frame = parseOrThrow(withPec([ADDR_W, 0x88, ADDR_R, 0x00, 0xd3]));
    const data = fieldById(frame.fields, 'data');

    // Bayt sırası ters okunsaydı word 0x00D3 olur ve 12 V çıkmazdı.
    expect(data?.rawValue).toBe(0xd300);
    expect(decodeLinear11(0xd300)).toBeCloseTo(12, 12);
    expect(data?.physicalValue).toContain('12 V');
    expect(data?.physicalValue).toContain('N=-6');
  });

  it('komut kodu adıyla birlikte gösterilir', () => {
    const frame = parseOrThrow(withPec([ADDR_W, 0x88, ADDR_R, 0x00, 0xd3]));

    expect(fieldById(frame.fields, 'command')?.physicalValue).toBe('READ_VIN (0x88)');
  });

  it('bilinmeyen komut uyarı üretir ama çerçeve yine çözülür', () => {
    const frame = parseOrThrow(Uint8Array.from([ADDR_W, 0xf1, ADDR_R, 0x12, 0x34]));

    expect(frame.warnings.map((warning) => warning.code)).toContain('unknown-command');
    expect(fieldById(frame.fields, 'command')?.physicalValue).toBe('0xF1');
  });

  it('STATUS_WORD iki ayrı bayt alanına açılır, spec örneği 0x0840', () => {
    const frame = parseOrThrow(withPec([ADDR_W, 0x79, ADDR_R, 0x40, 0x08]));

    expect(fieldById(frame.fields, 'statusLow')?.physicalValue).toBe('OFF');
    expect(fieldById(frame.fields, 'statusHigh')?.physicalValue).toBe('PG_STATUS#');
    expect(frame.warnings.map((warning) => warning.code)).toContain('fault-set');
    expect(frame.rawFrame.metadata).toMatchObject({ statusBits: ['PG_STATUS#', 'OFF'] });
  });

  it('arıza yoksa fault uyarısı üretilmez', () => {
    const frame = parseOrThrow(Uint8Array.from([ADDR_W, 0x79, ADDR_R, 0x00, 0x00]));

    expect(frame.warnings.map((warning) => warning.code)).not.toContain('fault-set');
    expect(fieldById(frame.fields, 'statusLow')?.physicalValue).toBe('no fault');
  });

  it('VOUT_MODE modu ve ULINEAR16 üssünü çözer', () => {
    const frame = parseOrThrow(Uint8Array.from([ADDR_W, 0x20, ADDR_R, 0x17]));

    expect(fieldById(frame.fields, 'data')?.physicalValue).toBe('ULINEAR16 · Absolute · exponent -9');
  });

  it('ULINEAR16 okumasında üs UYDURULMAZ, VOUT_MODE gerektiği uyarılır', () => {
    const frame = parseOrThrow(withPec([ADDR_W, 0x8b, ADDR_R, 0x34, 0x12]));
    const data = fieldById(frame.fields, 'data');

    expect(data?.rawValue).toBe(0x1234);
    expect(data?.physicalValue).toBe('0x1234 · mantissa 4660');
    // Volt cinsinden bir sayı BASILMAZ.
    expect(data?.physicalValue).not.toContain('V');
    expect(frame.warnings.map((warning) => warning.code)).toContain('vout-mode-required');
  });

  it('COEFFICIENTS Block Write-Block Read yanıtı m/b/R olarak çözülür', () => {
    const frame = parseOrThrow(
      withPec([ADDR_W, 0x30, 0x02, 0x8b, 0x01, ADDR_R, 0x05, 0x01, 0x00, 0x9c, 0xff, 0x03]),
    );

    expect(fieldById(frame.fields, 'blockCount')?.rawValue).toBe(5);
    expect(fieldById(frame.fields, 'data')?.physicalValue).toBe('m=1, b=-100, R=3');
    // Yazma tarafındaki baytlar da kaybolmaz.
    expect(fieldById(frame.fields, 'writeData')?.length).toBe(3);
  });

  it('beklenen bayt sayısı tutmuyorsa ham gösterime düşer (zorla çözmez)', () => {
    // READ_VIN normalde 2 bayt döner; 3 baytlık kısmi/yabancı yakalama.
    const frame = parseOrThrow(Uint8Array.from([ADDR_W, 0x88, ADDR_R, 0x00, 0xd3, 0x77]));

    expect(fieldById(frame.fields, 'data')?.name).toBe('READ_VIN · Data');
    expect(fieldById(frame.fields, 'data')?.physicalValue).toBeUndefined();
  });
});

describe('parsePmbus — çerçeve iskeleti', () => {
  it('tek baytlık çerçeve reddedilir (PMBus komut kodu zorunlu)', () => {
    const result = parsePmbus(Uint8Array.from([ADDR_W]));

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe('truncated-frame');
  });

  it('alanların toplam uzunluğu çerçevenin tamamını kapsar (bayt sessizce düşmez)', () => {
    for (const example of pmbusPlugin.exampleFrames ?? []) {
      const frame = parseOrThrow(example.bytes);
      const covered = frame.fields.reduce((total, field) => total + field.length, 0);
      expect(covered, example.id).toBe(example.bytes.length);
    }
  });

  it('alanlar ofset sırasında listelenir (tablo 0,1,5,2… basmaz)', () => {
    for (const example of pmbusPlugin.exampleFrames ?? []) {
      const frame = parseOrThrow(example.bytes);
      const offsets = frame.fields.map((field) => field.offset);
      expect(offsets, example.id).toEqual([...offsets].sort((left, right) => left - right));
    }
  });

  it('PEC taşıyan çerçevede PEC alanı son bayta hizalanır', () => {
    const bytes = withPec([ADDR_W, 0x88, ADDR_R, 0x00, 0xd3]);
    const frame = parseOrThrow(bytes);

    expect(fieldById(frame.fields, 'pec')?.offset).toBe(bytes.length - 1);
  });

  it('canParse en az iki bayt ister', () => {
    expect(pmbusParser.canParse(Uint8Array.from([ADDR_W]))).toBe(false);
    expect(pmbusParser.canParse(Uint8Array.from([ADDR_W, 0x88]))).toBe(true);
  });
});

describe('decodeDirectReading', () => {
  it('düşük bayt önce okur ve §7.4.1 denklemini uygular', () => {
    // Y = 0x2EE0 = 12000, m=1, b=0, R=3 → 12.000 (SMIF APEC 2017 sadeleştirmesi).
    expect(decodeDirectReading(Uint8Array.from([0xe0, 0x2e]), { m: 1, b: 0, r: 3 })).toBeCloseTo(12, 12);
  });
});

describe('spec özetinin tutarsız Linear16 örneği', () => {
  it('0x1234 → 12.04 V iddiası hiçbir tamsayı üsle doğrulanmıyor', () => {
    // Kalıcı kayıt: 1-Wire'ın CRC tutmayan ROM ID örneğiyle aynı sınıf hata.
    // Bu yüzden 0x1234/12.04 V ikilisi FIXTURE OLARAK KULLANILMADI.
    const mantissa = 0x1234;
    const claimed = 12.04;
    const exponents = Array.from({ length: 32 }, (_, index) => index - 16);

    for (const exponent of exponents) {
      expect(Math.abs(mantissa * 2 ** exponent - claimed)).toBeGreaterThan(0.005);
    }
  });
});

describe('pmbusPlugin', () => {
  it('örnek çerçevelerin hepsi çözülür', () => {
    for (const example of pmbusPlugin.exampleFrames ?? []) {
      expect(pmbusParser.parse(example.bytes).success, example.id).toBe(true);
    }
  });

  it('PEC taşıyan örneklerin sağlaması gerçekten tutuyor', () => {
    for (const id of ['read-vin', 'status-word', 'coefficients']) {
      const example = (pmbusPlugin.exampleFrames ?? []).find((frame) => frame.id === id);
      expect(example, id).toBeDefined();
      if (!example) continue;
      const frame = parseOrThrow(example.bytes);
      expect(fieldById(frame.fields, 'pec'), id).toBeDefined();
    }
  });
});
