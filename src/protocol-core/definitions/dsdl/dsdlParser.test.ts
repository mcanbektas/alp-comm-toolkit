import { describe, expect, it } from 'vitest';

import { SAMPLE_DSDL_TEXT } from './dsdlFixture';
import { lengthPrefixBits, parseDsdl } from './dsdlParser';

function parse(text: string) {
  const result = parseDsdl(text);
  if (!result.success) throw new Error(`okunamadı: ${result.issues[0]?.messageKey ?? '?'}`);
  return result;
}

function fieldsOf(text: string) {
  const section = parse(text).definition.sections[0];
  if (section === undefined) throw new Error('bölüm yok');
  return section.fields;
}

describe('parseDsdl — alanlar', () => {
  it('ilkel alanları sırayla ve bit konumlarıyla okur', () => {
    const fields = fieldsOf(SAMPLE_DSDL_TEXT);

    expect(fields[0]).toMatchObject({ name: 'sequence', bitOffset: 0, bitLength: 16 });
    // Bayt hizasına oturmayan alanlar: 16. bitten başlayan iki dörtlük.
    expect(fields[1]).toMatchObject({ name: 'mode', bitOffset: 16, bitLength: 4 });
    expect(fields[2]).toMatchObject({ name: 'health', bitOffset: 20, bitLength: 4 });
    expect(fields[3]).toMatchObject({ name: 'temperature_deci', bitOffset: 24, bitLength: 16 });
    expect(fields[4]).toMatchObject({ name: 'voltage', bitOffset: 40, bitLength: 32 });
    expect(fields[5]).toMatchObject({ name: 'armed', bitOffset: 72, bitLength: 1 });
  });

  it('`void` dolgusunu adsız bir alan olarak tutar ve imleci ilerletir', () => {
    const fields = fieldsOf(SAMPLE_DSDL_TEXT);
    const padding = fields[6];
    expect(padding).toMatchObject({ name: '', bitOffset: 73, bitLength: 7 });
    expect(padding?.primitive?.kind).toBe('void');
  });

  it('sabitleri alanlardan AYIRIR — telde yer kaplamazlar', () => {
    const section = parse(SAMPLE_DSDL_TEXT).definition.sections[0];
    expect(section?.constants).toEqual([
      { typeText: 'uint8', name: 'MODE_STANDBY', value: '0' },
      { typeText: 'uint8', name: 'MODE_ACTIVE', value: '1' },
    ]);
    // Sabitler imleci kaydırsaydı `payload` öncesi toplam 80 bit tutmazdı.
    const payload = section?.fields.find((field) => field.name === 'payload');
    expect(payload?.bitOffset).toBe(80);
  });

  it('değişken uzunluklu diziden SONRA konum vermez', () => {
    const fields = fieldsOf(`${SAMPLE_DSDL_TEXT}\nuint8 trailer\n`);
    const payload = fields.find((field) => field.name === 'payload');
    const trailer = fields.find((field) => field.name === 'trailer');

    expect(payload?.array).toEqual({ mode: 'variable', capacity: 32 });
    expect(payload?.bitLength).toBeUndefined();
    // İçeriğe bağlı: tahmin edilmez.
    expect(trailer?.bitOffset).toBeUndefined();
  });

  it('sabit dizinin genişliğini eleman × kapasite alır', () => {
    const fields = fieldsOf('uint8[4] mac\nuint8 next\n');
    expect(fields[0]).toMatchObject({ bitOffset: 0, bitLength: 32 });
    expect(fields[1]).toMatchObject({ bitOffset: 32 });
  });

  it('bileşik tipte genişlik BİLİNMEZ ve sonrası da bilinmez', () => {
    const fields = fieldsOf('uavcan.node.Health.1.0 health\nuint8 after\n');
    expect(fields[0]?.primitive).toBeUndefined();
    expect(fields[0]?.bitLength).toBeUndefined();
    expect(fields[1]?.bitOffset).toBeUndefined();
  });

  it('`saturated`/`truncated` niteleyicisini yok sayar', () => {
    const fields = fieldsOf('saturated uint12 raw\ntruncated int8 delta\n');
    expect(fields[0]).toMatchObject({ name: 'raw', bitLength: 12 });
    expect(fields[1]).toMatchObject({ name: 'delta', bitLength: 8, bitOffset: 12 });
  });

  it('yönergeleri ve satır yorumlarını ayırır', () => {
    const result = parse(SAMPLE_DSDL_TEXT);
    const section = result.definition.sections[0];
    expect(section?.directives).toEqual(['@sealed']);
    expect(section?.fields[1]?.comment).toBe('Bayt hizasına OTURMAZ');
  });
});

describe('parseDsdl — servis tipleri', () => {
  it('`---` ayracıyla istek ve yanıt bölümlerine ayırır', () => {
    const result = parse('uint8 request_id\n---\nuint8 status\nuint16 value\n');
    expect(result.definition.isService).toBe(true);
    expect(result.definition.sections.map((section) => section.kind)).toEqual(['request', 'response']);
    // Yanıt bölümünün imleci SIFIRDAN başlar: ayrı bir seri gösterimdir.
    expect(result.definition.sections[1]?.fields[0]?.bitOffset).toBe(0);
  });

  it('ikinci bir ayraç bildirilir, üçüncü bölüm UYDURULMAZ', () => {
    const result = parse('uint8 a\n---\nuint8 b\n---\nuint8 c\n');
    expect(result.definition.sections).toHaveLength(2);
    expect(
      result.issues.some((issue) => issue.messageKey === 'definition.dsdl.issue.extraServiceSeparator'),
    ).toBe(true);
  });
});

describe('parseDsdl — sınır durumları', () => {
  it('boş/yalnız yorumlu dosyada başarısız olur', () => {
    const result = parseDsdl('# yalnız yorum\n\n');
    expect(result.success).toBe(false);
    expect(result.issues[0]?.messageKey).toBe('definition.dsdl.issue.empty');
  });

  it('adsız ilkel alanı bildirir ama ayrıştırmayı sürdürür', () => {
    const result = parse('uint8\nuint8 sonraki\n');
    expect(result.issues[0]?.messageKey).toBe('definition.dsdl.issue.fieldWithoutName');
    expect(result.definition.sections[0]?.fields).toHaveLength(2);
  });
});

describe('lengthPrefixBits', () => {
  it('kapasiteyi gösterecek en dar bit sayısını verir', () => {
    expect(lengthPrefixBits(32)).toBe(6); // 0..32 → 6 bit
    expect(lengthPrefixBits(255)).toBe(8);
    expect(lengthPrefixBits(1)).toBe(1);
  });
});
