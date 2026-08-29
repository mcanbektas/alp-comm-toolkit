import { describe, expect, it } from 'vitest';

import { SAMPLE_VENDOR_MAP_CSV } from './vendorMapFixture';
import { parseVendorMap, parseVendorMapCsv, parseVendorMapJson, splitCsvLine } from './vendorMapParser';

/** Testte sık kullanılan minimal başlık. */
const HEADER = 'address,name,type';

describe('splitCsvLine', () => {
  it('tırnak içindeki virgülü VERİ sayar', () => {
    expect(splitCsvLine('40001,"Voltage, phase A",uint16', ',')).toEqual([
      '40001',
      'Voltage, phase A',
      'uint16',
    ]);
  });

  it('çift tırnak kaçışını (`""`) tek tırnağa indirir', () => {
    expect(splitCsvLine('1,"12"" ekran",raw', ',')).toEqual(['1', '12" ekran', 'raw']);
  });

  it('noktalı virgül ayracıyla da bölebilir', () => {
    expect(splitCsvLine('1;Voltage;uint16', ';')).toEqual(['1', 'Voltage', 'uint16']);
  });
});

describe('parseVendorMapCsv', () => {
  it('örnek haritanın yedi girdisini okur ve üstbilgiyi alır', () => {
    const result = parseVendorMapCsv(SAMPLE_VENDOR_MAP_CSV);
    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.map.device).toBe('Örnek Enerji Ölçer');
    expect(result.map.vendor).toBe('ALP Comm Toolkit');
    expect(result.map.defaultWordOrder).toBe('high-first');
    expect(result.map.entries).toHaveLength(7);
    expect(result.issues).toEqual([]);
  });

  it('ölçek, birim, erişim ve adres uzayını girdiye taşır', () => {
    const result = parseVendorMapCsv(SAMPLE_VENDOR_MAP_CSV);
    if (!result.success) throw new Error('harita okunamadı');

    expect(result.map.entries[0]).toMatchObject({
      address: 40001,
      name: 'Line Voltage',
      type: 'uint16',
      space: 'holding-register',
      scale: 0.1,
      unit: 'V',
      access: 'r',
    });
  });

  it('bit ve enum sütunlarını sözlüğe çevirir', () => {
    const result = parseVendorMapCsv(SAMPLE_VENDOR_MAP_CSV);
    if (!result.success) throw new Error('harita okunamadı');

    const status = result.map.entries.find((entry) => entry.address === 40007);
    expect(status?.bits).toEqual([
      { bit: 0, name: 'Ready' },
      { bit: 1, name: 'Fault' },
      { bit: 3, name: 'Overload' },
    ]);

    const mode = result.map.entries.find((entry) => entry.address === 40008);
    expect(mode?.enumValues).toEqual({ '0': 'Idle', '1': 'Run', '2': 'Service' });
  });

  it('sütun SIRASI dayatmaz, başlığı adından eşler', () => {
    const csv = ['Ad,Tip,Adres', 'Gerilim,uint16,0x9C41'].join('\n');
    const result = parseVendorMapCsv(csv);
    if (!result.success) throw new Error('harita okunamadı');

    // 0x9C41 = 40001; hex gösterim de kabul edilir.
    expect(result.map.entries[0]).toMatchObject({ address: 40001, name: 'Gerilim', type: 'uint16' });
  });

  it('tip yazılmamışsa `uint16` varsayar', () => {
    const result = parseVendorMapCsv(['address,name', '10,Voltage'].join('\n'));
    if (!result.success) throw new Error('harita okunamadı');
    expect(result.map.entries[0]?.type).toBe('uint16');
  });

  it('tanınmayan tipi `raw`a düşürür ve SORUN yazar — sessizce yutmaz', () => {
    const result = parseVendorMapCsv([HEADER, '10,Voltage,quantum'].join('\n'));
    if (!result.success) throw new Error('harita okunamadı');

    expect(result.map.entries[0]?.type).toBe('raw');
    expect(result.issues[0]?.messageKey).toBe('definition.vendorMap.issue.unknownType');
  });

  it('bozuk satırı ATLAR ama haritayı düşürmez', () => {
    const csv = [HEADER, '10,Voltage,uint16', ',,', 'N/A,,uint16', '11,Current,uint16'].join('\n');
    const result = parseVendorMapCsv(csv);
    if (!result.success) throw new Error('harita okunamadı');

    expect(result.map.entries).toHaveLength(2);
    expect(result.issues.some((issue) => issue.messageKey === 'definition.vendorMap.issue.rowSkipped')).toBe(
      true,
    );
  });

  it('aynı adres iki kez yazılırsa İLK tanım geçerli', () => {
    const csv = [HEADER, '10,Voltage,uint16', '10,Voltage kopya,int16'].join('\n');
    const result = parseVendorMapCsv(csv);
    if (!result.success) throw new Error('harita okunamadı');

    expect(result.map.entries).toHaveLength(1);
    expect(result.map.entries[0]?.name).toBe('Voltage');
    expect(result.issues[0]?.messageKey).toBe('definition.vendorMap.issue.duplicateAddress');
  });

  it('başlık bulunamazsa başarısız olur', () => {
    const result = parseVendorMapCsv(['bir,iki,üç', '1,2,3'].join('\n'));
    expect(result.success).toBe(false);
    expect(result.issues.some((issue) => issue.messageKey === 'definition.vendorMap.issue.headerNotFound')).toBe(
      true,
    );
  });

  it('başlık var ama hiç girdi yoksa başarısız olur', () => {
    const result = parseVendorMapCsv(HEADER);
    expect(result.success).toBe(false);
    expect(result.issues.some((issue) => issue.messageKey === 'definition.vendorMap.issue.noEntries')).toBe(true);
  });

  it('noktalı virgül ayraçlı (Türkçe Excel) dosyayı da okur', () => {
    const csv = ['address;name;type;scale', '40001;Gerilim;uint16;0,1'].join('\n');
    const result = parseVendorMapCsv(csv);
    if (!result.success) throw new Error('harita okunamadı');

    // Ondalık ayracı virgül olan hücre de sayıya çevrilir.
    expect(result.map.entries[0]).toMatchObject({ address: 40001, scale: 0.1 });
  });
});

describe('parseVendorMapJson', () => {
  it('girdileri ve varsayılan kelime sırasını okur', () => {
    const text = JSON.stringify({
      device: 'ACME 3000',
      defaultWordOrder: 'low-first',
      entries: [{ address: 40001, name: 'Voltage', type: 'uint16', space: 'holding', scale: 0.1 }],
    });
    const result = parseVendorMapJson(text);
    if (!result.success) throw new Error('harita okunamadı');

    expect(result.map.device).toBe('ACME 3000');
    expect(result.map.defaultWordOrder).toBe('low-first');
    expect(result.map.entries[0]).toMatchObject({ address: 40001, space: 'holding-register', scale: 0.1 });
  });

  it('bozuk JSON sorun listesiyle döner, atmaz', () => {
    const result = parseVendorMapJson('{ bozuk');
    expect(result.success).toBe(false);
    expect(result.issues[0]?.messageKey).toBe('definition.vendorMap.issue.invalidJson');
  });

  it('adı ya da adresi olmayan girdiyi atlar', () => {
    const text = JSON.stringify({ entries: [{ address: 1 }, { address: 2, name: 'İyi' }] });
    const result = parseVendorMapJson(text);
    if (!result.success) throw new Error('harita okunamadı');

    expect(result.map.entries).toHaveLength(1);
    expect(result.issues[0]?.messageKey).toBe('definition.vendorMap.issue.rowSkipped');
  });
});

describe('parseVendorMap', () => {
  it('biçimi İÇERİKTEN seçer: `{` ile başlayan JSON, kalanı CSV', () => {
    const json = parseVendorMap('{"entries":[{"address":1,"name":"A"}]}');
    expect(json.success).toBe(true);

    const csv = parseVendorMap([HEADER, '1,A,uint16'].join('\n'));
    expect(csv.success).toBe(true);
  });
});
