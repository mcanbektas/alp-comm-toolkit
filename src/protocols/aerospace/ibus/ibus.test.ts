import { describe, expect, it } from 'vitest';

import { ibusParser, ibusPlugin, parseIbus } from './ibus';
import type { ParsedField } from '@/protocol-core/types';

/**
 * Faz 10 dalga 15c — IBUS. İki modelin (iA6/iA6B) İKİ AYRI checksum
 * algoritması olduğunu, `profile` seçeneğinin GERÇEKTEN sonucu değiştirdiğini
 * (brief-faz10-dalga15c.md "decodeOptions" tablosu: "yanlış seçim checksum'ı
 * her çerçevede FAIL gösterir"), üst nibble'ın HAM + çift-kaynaklı uyarıyla
 * basıldığını ve i-BUS2 kapsam-dışı uyarısının HER çözümde göründüğünü sınar.
 */

function field(fields: readonly ParsedField[], id: string): ParsedField {
  const found = fields.find((candidate) => candidate.id === id);
  if (found === undefined) throw new Error(`alan bulunamadı: ${id}`);
  return found;
}

function example(id: string): Uint8Array {
  const found = ibusPlugin.exampleFrames.find((candidate) => candidate.id === id);
  if (found === undefined) throw new Error(`örnek bulunamadı: ${id}`);
  return found.bytes;
}

const EXPECTED_CHANNELS = [1000, 1050, 1100, 1150, 1200, 1250, 1300, 1350, 1400, 1450, 1500, 1550, 1600, 1650];

describe('ibus — iA6B (varsayılan profil)', () => {
  it('14 kanalın hepsi beklenen 12-bit değerlere çözülür, checksum PASS', () => {
    const result = parseIbus(example('ia6b-typical'));
    expect(result.success).toBe(true);
    if (!result.success) return;

    EXPECTED_CHANNELS.forEach((expectedValue, index) => {
      expect(field(result.frame.fields, `ibus-channel-${String(index)}`).rawValue).toBe(expectedValue);
    });
    expect(field(result.frame.fields, 'checksum').physicalValue).toBe('PASS');
    expect(result.frame.valid).toBe(true);
    expect(result.frame.errors).toEqual([]);
  });

  it('üst nibble alanları HAM basılır ve çift-kaynaklı belirsizlik uyarısı taşır', () => {
    const result = parseIbus(example('ia6b-typical'));
    if (!result.success) throw new Error('parse başarısız');

    for (let index = 0; index < 14; index += 1) {
      const nibbleField = field(result.frame.fields, `ibus-channel-${String(index)}-upper-nibble`);
      expect(nibbleField.rawValue).toBe(index); // fixture: nibble[i] = i
      expect(nibbleField.warnings).toContain('protocol.ibus.warning.upperNibbleAmbiguous');
    }
    // Frame seviyesinde TEK sefer (14 kez DEĞİL) — strict-mode tuzağı (devralınan).
    const frameLevel = result.frame.warnings.filter(
      (warning) => warning.code === 'protocol.ibus.warning.upperNibbleAmbiguous',
    );
    expect(frameLevel).toHaveLength(1);
  });

  it('Length ve Command alanları doğru basılır (0x20 / 0x40)', () => {
    const result = parseIbus(example('ia6b-typical'));
    if (!result.success) throw new Error('parse başarısız');

    expect(field(result.frame.fields, 'length').rawValue).toBe(0x20);
    expect(field(result.frame.fields, 'command').rawValue).toBe(0x40);
    expect(field(result.frame.fields, 'command').physicalValue).toBe('RC Channel Command');
    expect(field(result.frame.fields, 'command').warnings).toEqual([]);
  });

  it('i-BUS2 kapsam-dışı uyarısı HER başarılı çözümde görünür (çerçeve içeriğine bağlı değil)', () => {
    const result = parseIbus(example('ia6b-typical'));
    if (!result.success) throw new Error('parse başarısız');
    expect(result.frame.warnings.some((warning) => warning.code === 'protocol.ibus.warning.ibus2OutOfScope')).toBe(
      true,
    );
  });
});

describe('ibus — komut baytı 0x40 değilse UYARIR, REDDETMEZ (Betaflight yolu — ArduPilot AKSİNE)', () => {
  it('ia6b-non-standard-command hâlâ checksum PASS ve valid:true, ama uyarı taşır', () => {
    const result = parseIbus(example('ia6b-non-standard-command'));
    if (!result.success) throw new Error('parse başarısız');

    expect(field(result.frame.fields, 'command').rawValue).toBe(0x08);
    expect(field(result.frame.fields, 'command').warnings).toContain(
      'protocol.ibus.warning.unexpectedCommandByte',
    );
    expect(field(result.frame.fields, 'checksum').physicalValue).toBe('PASS');
    expect(result.frame.valid).toBe(true);
  });
});

describe('ibus — checksum FAIL', () => {
  it('ia6b-checksum-mismatch valid:false ve checksum-mismatch hatası taşır, alanlar yine de gösterilir', () => {
    const result = parseIbus(example('ia6b-checksum-mismatch'));
    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(field(result.frame.fields, 'checksum').physicalValue).toBe('FAIL');
    expect(field(result.frame.fields, 'checksum').valid).toBe(false);
    expect(result.frame.valid).toBe(false);
    expect(result.frame.errors[0]?.code).toBe('checksum-mismatch');
    // Hatalı veride de kanallar basılır (spec §47).
    expect(field(result.frame.fields, 'ibus-channel-0').rawValue).toBe(1000);
  });
});

describe('ibus — iA6 profili', () => {
  it('profile: "ia6" ile ia6-typical örneği Sync=0x55 ve checksum PASS verir', () => {
    const result = parseIbus(example('ia6-typical'), { profile: 'ia6' });
    if (!result.success) throw new Error('parse başarısız');

    expect(field(result.frame.fields, 'sync').rawValue).toBe(0x55);
    expect(field(result.frame.fields, 'checksum').physicalValue).toBe('PASS');
    EXPECTED_CHANNELS.forEach((expectedValue, index) => {
      expect(field(result.frame.fields, `ibus-channel-${String(index)}`).rawValue).toBe(expectedValue);
    });
  });

  it('CH1 kanal offset\'i profile\'a göre KAYAR: iA6 byte 1, iA6B byte 2', () => {
    const ia6Result = parseIbus(example('ia6-typical'), { profile: 'ia6' });
    const ia6bResult = parseIbus(example('ia6b-typical'), { profile: 'ia6b' });
    if (!ia6Result.success || !ia6bResult.success) throw new Error('parse başarısız');

    expect(field(ia6Result.frame.fields, 'ibus-channel-0').offset).toBe(1);
    expect(field(ia6bResult.frame.fields, 'ibus-channel-0').offset).toBe(2);
  });

  it('varsayılan profil (seçenek verilmezse) iA6B\'dir — 31 baytlık ia6-typical\'ı truncated-frame sayar', () => {
    const result = parseIbus(example('ia6-typical'));
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe('truncated-frame');
  });
});

describe('ibus — PROFİL DEĞİŞİNCE checksum sonucu GERÇEKTEN değişir (decodeOptions gerçekten bağlı)', () => {
  it('ia6b-typical baytları profile:"ia6" ile checksum FAIL verir — aynı bayt, farklı yorum', () => {
    const asIa6b = parseIbus(example('ia6b-typical'), { profile: 'ia6b' });
    const asIa6 = parseIbus(example('ia6b-typical'), { profile: 'ia6' });
    if (!asIa6b.success || !asIa6.success) throw new Error('parse başarısız');

    expect(field(asIa6b.frame.fields, 'checksum').physicalValue).toBe('PASS');
    expect(field(asIa6.frame.fields, 'checksum').physicalValue).toBe('FAIL');
  });
});

describe('ibus — bilinmeyen/eksik profil değeri varsayılana (iA6B) düşer', () => {
  it('options.profile = "unknown" iA6B gibi davranır', () => {
    const result = parseIbus(example('ia6b-typical'), { profile: 'unknown' });
    if (!result.success) throw new Error('parse başarısız');
    expect(field(result.frame.fields, 'length')).toBeDefined();
  });
});

describe('ibusParser.canParse', () => {
  it('geçerli iA6B (32 bayt, checksum PASS) kabul eder', () => {
    expect(ibusParser.canParse(example('ia6b-typical'))).toBe(true);
  });

  it('geçerli iA6 (31 bayt, checksum PASS) kabul eder', () => {
    expect(ibusParser.canParse(example('ia6-typical'))).toBe(true);
  });

  it('checksum FAIL eden 32 baytlık çerçeveyi reddeder — yalnız uzunluğa bakmaz', () => {
    expect(ibusParser.canParse(example('ia6b-checksum-mismatch'))).toBe(false);
  });

  it('31/32 dışındaki uzunlukları reddeder', () => {
    expect(ibusParser.canParse(new Uint8Array(20))).toBe(false);
  });
});

describe('ibusPlugin.exampleFrames — expectedValid gerçek parse sonucuyla TUTARLI (varsayılan profil, iA6B)', () => {
  // `ia6-typical` BİLEREK dışarıda: o örnek yalnız `profile:'ia6'` seçiliyken
  // geçerlidir (varsayılan iA6B'yle 31 bayt truncated-frame'dir — "varsayılan
  // profil iA6B'dir" testinde AYRI kanıtlı) ve iA6 profiliyle "iA6 profili"
  // describe bloğunda zaten sınandı. `ExampleFrame`in `expectedValid`i her
  // zaman GEÇERLİ decodeOptions bağlamında okunur, panelin kendisi de aynı
  // şekilde davranır.
  const defaultProfileExamples = ibusPlugin.exampleFrames.filter((exampleFrame) => exampleFrame.id !== 'ia6-typical');

  it.each(defaultProfileExamples.map((exampleFrame) => [exampleFrame.id, exampleFrame] as const))(
    '%s',
    (_id, exampleFrame) => {
      const result = parseIbus(exampleFrame.bytes);
      if (exampleFrame.expectedValid === false) {
        const actuallyValid = result.success && result.frame.valid;
        expect(actuallyValid).toBe(false);
      } else {
        expect(result.success).toBe(true);
        if (result.success) expect(result.frame.valid).toBe(true);
      }
    },
  );
});
