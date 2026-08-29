import { describe, expect, it } from 'vitest';

import { parseDeviceDescription } from './deviceDescriptionParser';
import { SAMPLE_GSDML_TEXT, SAMPLE_IODD_TEXT, SAMPLE_SCL_TEXT } from './deviceDescriptionFixture';

function parse(text: string) {
  const result = parseDeviceDescription(text);
  if (!result.success) throw new Error(`okunamadı: ${result.issues[0]?.messageKey ?? '?'}`);
  return result;
}

describe('parseDeviceDescription — biçim seçimi', () => {
  it('biçimi KÖK ÖĞEDEN seçer', () => {
    expect(parse(SAMPLE_IODD_TEXT).description.format).toBe('iodd');
    expect(parse(SAMPLE_GSDML_TEXT).description.format).toBe('gsdml');
    expect(parse(SAMPLE_SCL_TEXT).description.format).toBe('scl');
  });

  it('tanınmayan kökte TAHMİN ETMEZ', () => {
    const result = parseDeviceDescription('<Something><A/></Something>');
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.issues[0]?.messageKey).toBe('definition.xmlDevice.issue.unknownFormat');
  });

  it('bozuk XML’de çökmez, sorun döner', () => {
    const result = parseDeviceDescription('<IODevice><Broken>');
    expect(result.success).toBe(false);
  });
});

describe('IODD okuyucu', () => {
  it('kimliği ve metin listesinden çözülen adı okur', () => {
    const { description } = parse(SAMPLE_IODD_TEXT);
    expect(description.vendor).toBe('ALP Comm Toolkit');
    expect(description.identity).toEqual([
      { label: 'vendorId', value: '888' },
      { label: 'deviceId', value: '1001' },
    ]);
  });

  it('parametreyi ve sözel değer listesini okur', () => {
    const { description } = parse(SAMPLE_IODD_TEXT);
    const mode = description.items.find((item) => item.id === '64');
    expect(mode).toMatchObject({
      name: 'Measurement mode',
      group: 'parameter',
      dataType: 'UIntegerT',
      bitLength: 8,
      access: 'rw',
    });
    expect(mode?.values).toEqual({ '0': 'Standard', '1': 'Fast' });
  });

  it('süreç verisi bit ofsetini SAĞDAN sayımdan BAŞTAN sayıma çevirir', () => {
    const { description } = parse(SAMPLE_IODD_TEXT);
    const processData = description.items.filter((item) => item.group === 'process-data');

    // 32 bitlik süreç verisi. IODD `bitOffset=16`, uzunluk 16 → baştan 0.
    expect(processData.find((item) => item.name === 'Process pressure')).toMatchObject({
      bitOffset: 0,
      bitLength: 16,
    });
    // `bitOffset=8`, uzunluk 8 → baştan 32−8−8 = 16.
    expect(processData.find((item) => item.name === 'Sensor temperature')).toMatchObject({
      bitOffset: 16,
      bitLength: 8,
    });
    // `bitOffset=0`, uzunluk 1 → baştan 31 (en son bit).
    expect(processData.find((item) => item.name === 'Switching signal')).toMatchObject({
      bitOffset: 31,
      bitLength: 1,
    });
  });

  it('toplam uzunluk yazmıyorsa yerleşimi BİLİNMİYOR sayar ve bildirir', () => {
    const text = SAMPLE_IODD_TEXT.replace('<ProcessDataIn id="PDI" bitLength="32">', '<ProcessDataIn id="PDI">')
      .replace('<Datatype xsi:type="RecordT" bitLength="32">', '<Datatype xsi:type="RecordT">');
    const result = parse(text);

    const pressure = result.description.items.find((item) => item.name === 'Process pressure');
    expect(pressure?.bitOffset).toBeUndefined();
    expect(
      result.issues.some((issue) => issue.messageKey === 'definition.xmlDevice.issue.unknownProcessDataLength'),
    ).toBe(true);
  });
});

describe('GSDML okuyucu', () => {
  it('kimliği ve metin listesinden çözülen adları okur', () => {
    const { description } = parse(SAMPLE_GSDML_TEXT);
    expect(description.vendor).toBe('ALP Comm Toolkit');
    expect(description.device).toBe('ALP IO Module 8DI');
    expect(description.identity).toEqual([
      { label: 'VendorID', value: '0x02A0' },
      { label: 'DeviceID', value: '0x0301' },
      { label: 'MainFamily', value: 'I/O' },
    ]);
  });

  it('parametre kalemlerini bayt ofsetiyle birlikte okur', () => {
    const { description } = parse(SAMPLE_GSDML_TEXT);
    expect(description.items).toHaveLength(2);
    expect(description.items[0]).toMatchObject({
      id: '100/P1',
      name: 'Input filter time',
      dataType: 'Unsigned16',
      // ByteOffset 0 → bit 0; ikinci kalem ByteOffset 2 → bit 16.
      bitOffset: 0,
      defaultValue: '1000',
    });
    expect(description.items[1]?.bitOffset).toBe(16);
  });

  it('`Assign` listesini sözel karşılıklara çevirir', () => {
    const { description } = parse(SAMPLE_GSDML_TEXT);
    expect(description.items[1]?.values).toEqual({ '0': '0-10 V', '1': '0-20 mA' });
  });

  it('metin kimliğinin karşılığı yoksa kimliği AYNEN basar', () => {
    const text = SAMPLE_GSDML_TEXT.replace('<Text TextId="TI_Filter" Value="Input filter time"/>', '');
    const { description } = parse(text);
    expect(description.items[0]?.name).toBe('TI_Filter');
  });
});

describe('SCL okuyucu', () => {
  it('IED kimliğini okur', () => {
    const { description } = parse(SAMPLE_SCL_TEXT);
    expect(description.vendor).toBe('ALP Comm Toolkit');
    expect(description.device).toBe('ALP_BAY1');
    expect(description.identity).toEqual([
      { label: 'type', value: 'ALP_PROT' },
      { label: 'configVersion', value: '1.2' },
    ]);
  });

  it('veri nesnelerini yol adıyla ve yapılandırılmış değeriyle listeler', () => {
    const { description } = parse(SAMPLE_SCL_TEXT);
    const pickup = description.items.find((item) => item.id === 'PROT/PTOC1.StrVal.setMag');
    expect(pickup).toMatchObject({
      group: 'data-object',
      defaultValue: '1.20',
      description: 'Pickup current',
    });
  });

  it('SCL kalemlerinde bayt yerleşimi YOKTUR — uydurulmaz', () => {
    const { description } = parse(SAMPLE_SCL_TEXT);
    expect(description.items.every((item) => item.bitOffset === undefined)).toBe(true);
  });
});
