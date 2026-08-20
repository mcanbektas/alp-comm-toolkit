import { describe, expect, it } from 'vitest';

import { nbIotParser, nbIotPlugin } from './nbIot';
import type { ParseFailure, ParseResult, ParseSuccess, ParsedField, ParsedFrame } from '@/protocol-core/types';

function expectSuccess(result: ParseResult): ParseSuccess {
  if (!result.success) {
    throw new Error(`expected success, got error "${result.error.code}"`);
  }
  return result;
}

function expectFailure(result: ParseResult): ParseFailure {
  if (result.success) {
    throw new Error('expected failure, got success');
  }
  return result;
}

function fieldById(frame: ParsedFrame, id: string): ParsedField {
  const field = frame.fields.find((candidate) => candidate.id === id);
  if (field === undefined) {
    throw new Error(`field "${id}" not found among [${frame.fields.map((f) => f.id).join(', ')}]`);
  }
  return field;
}

function hasField(frame: ParsedFrame, id: string): boolean {
  return frame.fields.some((field) => field.id === id);
}

function ascii(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

function parse(text: string): ParsedFrame {
  return expectSuccess(nbIotParser.parse(ascii(text))).frame;
}

describe('nbIotParser — AcT=9 tespiti', () => {
  it('AcT=9: NB-IoT olarak eşleşir, uyarı taşımaz', () => {
    const frame = parse('+CEREG: 2,1,"1A2D","0001A2B3",9\r\n');
    const match = fieldById(frame, 'nb-iot-access-technology-match');

    expect(match.rawValue).toBe(9);
    expect(match.physicalValue).toBe('NB-IoT (E-UTRAN NB-S1 mode)');
    expect(match.warnings).toEqual([]);
    // Alttaki lte-modem-at alanı bozulmadan hâlâ orada.
    expect(fieldById(frame, 'access-technology').physicalValue).toBe('E-UTRAN (NB-S1 mode)');
  });

  it('AcT=7: NB-IoT DEĞİL uyarısı taşır', () => {
    const frame = parse('+CEREG: 2,1,"1A2D","0001A2B3",7\r\n');
    const match = fieldById(frame, 'nb-iot-access-technology-match');

    expect(match.physicalValue).toBe('NB-IoT değil (AcT=7)');
    expect(match.warnings).toContain('protocol.nbIot.warning.accessTechnologyNotNbIot');
  });

  it('access-technology alanı yoksa eşleşme alanı da üretilmez', () => {
    const frame = parse('+CGATT: 1\r\n');
    expect(hasField(frame, 'nb-iot-access-technology-match')).toBe(false);
  });
});

describe('nbIotParser — AT+CPSMS? (PSM)', () => {
  it('etkin PSM: T3412 40 dakika, T3324 30 saniye (Quectel BG96 kılavuzunun kendi örneği)', () => {
    const frame = parse('+CPSMS: 1,,,"00000100","00001111"\r\n');

    expect(fieldById(frame, 'psm-mode').physicalValue).toBe('enabled');
    expect(fieldById(frame, 'psm-periodic-tau').rawValue).toBe('00000100');
    expect(fieldById(frame, 'psm-periodic-tau').physicalValue).toBe(4 * 600); // 40 dakika
    expect(fieldById(frame, 'psm-periodic-tau').unit).toBe('s');
    expect(fieldById(frame, 'psm-active-time').physicalValue).toBe(15 * 2); // 30 saniye
    expect(fieldById(frame, 'psm-active-time').unit).toBe('s');
  });

  it('her iki zamanlayıcı da deactivated (birim biti 111)', () => {
    const frame = parse('+CPSMS: 1,,,"11100000","11100000"\r\n');

    expect(fieldById(frame, 'psm-periodic-tau').physicalValue).toBe('deactivated');
    expect(fieldById(frame, 'psm-active-time').physicalValue).toBe('deactivated');
  });

  it('yalnız mode verilince zamanlayıcı alanları hiç üretilmez', () => {
    const frame = parse('+CPSMS: 0\r\n');

    expect(fieldById(frame, 'psm-mode').physicalValue).toBe('disabled');
    expect(hasField(frame, 'psm-periodic-tau')).toBe(false);
    expect(hasField(frame, 'psm-active-time')).toBe(false);
  });

  it('rezerve birim kodu (GPRS Timer 2’de 011-110 tanımsız) saniye uydurmaz, uyarı verir', () => {
    const frame = parse('+CPSMS: 1,,,"00000001","01100000"\r\n');
    const activeTime = fieldById(frame, 'psm-active-time');

    expect(activeTime.physicalValue).toBeUndefined();
    expect(activeTime.warnings).toContain('protocol.nbIot.warning.timerUnitReserved');
  });

  it('8 bitlik ikili dize değilse (malformed) saniye uydurmaz, uyarı verir', () => {
    const frame = parse('+CPSMS: 1,,,"1010","00001111"\r\n');
    const periodicTau = fieldById(frame, 'psm-periodic-tau');

    expect(periodicTau.physicalValue).toBeUndefined();
    expect(periodicTau.warnings).toContain('protocol.nbIot.warning.timerMalformed');
  });
});

describe('nbIotParser — eDRX (CEDRXS / CEDRXRDP / CEDRXP)', () => {
  it('CEDRXS, NB-S1 modu: döngü saniyeye çevrilir', () => {
    const frame = parse('+CEDRXS: 5,"0011"\r\n');

    expect(fieldById(frame, 'edrx-act-type').physicalValue).toBe('E-UTRAN (NB-S1 mode)');
    expect(fieldById(frame, 'edrx-requested-cycle').physicalValue).toBe(40.96);
    expect(fieldById(frame, 'edrx-requested-cycle').unit).toBe('s');
  });

  it('CEDRXS, WB-S1 modu: tablo doğrulanmadığı için saniyeye çevrilmez, uyarı verir', () => {
    const frame = parse('+CEDRXS: 4,"1001"\r\n');
    const cycle = fieldById(frame, 'edrx-requested-cycle');

    expect(cycle.rawValue).toBe('1001');
    expect(cycle.physicalValue).toBeUndefined();
    expect(cycle.warnings).toContain('protocol.nbIot.warning.edrxNotNbS1');
  });

  it('CEDRXRDP: dört parametre de çözülür, Paging Time Window ham kalır (u-blox’un kendi örneği)', () => {
    const frame = parse('+CEDRXRDP: 5,"0010","1110","0101"\r\n');

    expect(fieldById(frame, 'edrx-requested-cycle').physicalValue).toBe(20.48);
    expect(fieldById(frame, 'edrx-assigned-cycle').physicalValue).toBe(5242.88);
    expect(fieldById(frame, 'edrx-paging-time-window').rawValue).toBe('0101');
    expect(fieldById(frame, 'edrx-paging-time-window').physicalValue).toBeUndefined();
  });

  it('CEDRXP URC’si CEDRXRDP ile AYNI çözücüyü kullanır', () => {
    const frame = parse('+CEDRXP: 5,"0010","1110","0101"\r\n');
    expect(fieldById(frame, 'edrx-assigned-cycle').physicalValue).toBe(5242.88);
  });

  it('rezerve eDRX kodu (0000, tabloda yok) saniye uydurmaz, uyarı verir', () => {
    const frame = parse('+CEDRXS: 5,"0000"\r\n');
    const cycle = fieldById(frame, 'edrx-requested-cycle');

    expect(cycle.physicalValue).toBeUndefined();
    expect(cycle.warnings).toContain('protocol.nbIot.warning.edrxCodeReserved');
  });

  it('4 bitlik ikili dize değilse (malformed) uyarı verir', () => {
    const frame = parse('+CEDRXS: 5,"101"\r\n');
    expect(fieldById(frame, 'edrx-requested-cycle').warnings).toContain('protocol.nbIot.warning.edrxMalformed');
  });
});

describe('nbIotParser — lte-modem-at geçişkenliği', () => {
  it('CSQ gibi NB-IoT’ye özgü olmayan komutlar aynen (yalnız protocol adı değişir) geçer', () => {
    const frame = parse('+CSQ: 20,99\r\n');

    expect(frame.protocol).toBe('nb-iot');
    expect(fieldById(frame, 'csq-rssi').physicalValue).toBe(-73);
    expect(hasField(frame, 'nb-iot-access-technology-match')).toBe(false);
  });

  it('OK/ERROR final result satırları aynen geçer', () => {
    const frame = parse('OK\r\n');
    expect(frame.protocol).toBe('nb-iot');
    expect(fieldById(frame, 'result-code').rawValue).toBe('OK');
  });

  it('boş girdide truncated-frame — hata yolu lte-modem-at/at-commands’tan devralınır', () => {
    expect(expectFailure(nbIotParser.parse(new Uint8Array(0))).error.code).toBe('truncated-frame');
  });

  it('canParse lte-modem-at ile aynı davranır', () => {
    expect(nbIotParser.canParse(new Uint8Array(0))).toBe(false);
    expect(nbIotParser.canParse(ascii('OK'))).toBe(true);
  });
});

describe('nbIotPlugin', () => {
  it('katalogdaki kimlik, kategori ve parser bağını taşır', () => {
    expect(nbIotPlugin.id).toBe('nb-iot');
    expect(nbIotPlugin.category).toBe('wireless-iot');
    expect(nbIotPlugin.parser).toBe(nbIotParser);
  });

  it('her örnek çözülür ve expectedValid ile eşleşir', () => {
    for (const example of nbIotPlugin.exampleFrames) {
      const result = nbIotParser.parse(example.bytes);
      if (!result.success) {
        throw new Error(`example "${example.id}" failed: ${result.error.code}`);
      }
      expect(result.frame.valid, `example "${example.id}"`).toBe(example.expectedValid ?? true);
    }
  });

  it('her örnek adı/açıklaması protocol.nbIot.example. önekli çeviri anahtarıdır', () => {
    for (const example of nbIotPlugin.exampleFrames) {
      expect(example.name.startsWith('protocol.nbIot.example.'), example.id).toBe(true);
      expect(example.description?.startsWith('protocol.nbIot.example.'), example.id).toBe(true);
    }
  });

  it('AcT=9/AcT≠9, PSM etkin/deactivated ve eDRX NB-S1/WB-S1 karşıtlarının hepsi en az bir örnekte var', () => {
    const ids = nbIotPlugin.exampleFrames.map((example) => example.id);
    for (const expected of [
      'cereg-nb-iot',
      'cereg-not-nb-iot',
      'cpsms-enabled',
      'cpsms-deactivated',
      'cedrxs-nb-s1',
      'cedrxs-wb-s1-unsupported',
      'cedrxrdp-full',
      'cedrxp-urc',
    ]) {
      expect(ids, expected).toContain(expected);
    }
  });
});
