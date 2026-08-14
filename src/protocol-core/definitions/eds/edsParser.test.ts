import { describe, expect, it } from 'vitest';

import { SAMPLE_EDS_CONTROLWORD_INDEX, SAMPLE_EDS_TEXT } from './edsFixture';
import { findEdsObject, parseEds } from './edsParser';
import type { EdsParseResult } from './edsTypes';

function expectSuccess(result: EdsParseResult): Extract<EdsParseResult, { success: true }> {
  if (!result.success) {
    throw new Error(`expected success, got issues: ${result.issues.map((i) => i.messageKey).join(', ')}`);
  }
  return result;
}

describe('parseEds — örnek dosya', () => {
  it('FileInfo/DeviceInfo alanlarını çözer', () => {
    const { database } = expectSuccess(parseEds(SAMPLE_EDS_TEXT));
    expect(database.fileInfo.fileName).toBe('SAMPLE.eds');
    expect(database.deviceInfo.vendorName).toBe('ALP Comm Toolkit');
    expect(database.deviceInfo.productName).toBe('Sample Servo Drive');
  });

  it('beş Object Dictionary girdisini sırayla çıkarır', () => {
    const { database } = expectSuccess(parseEds(SAMPLE_EDS_TEXT));
    expect(database.objects.map((o) => o.index)).toEqual([0x1000, 0x1001, 0x6040, 0x6041, 0x6044]);
  });

  it('[MandatoryObjects] gibi yapısal liste bölümlerini SESSİZCE atlar, uyarı üretmez', () => {
    const { issues } = expectSuccess(parseEds(SAMPLE_EDS_TEXT));
    expect(issues).toEqual([]);
  });

  it('Controlword nesnesinin tüm alanlarını çözer', () => {
    const { database } = expectSuccess(parseEds(SAMPLE_EDS_TEXT));
    const controlword = findEdsObject(database, SAMPLE_EDS_CONTROLWORD_INDEX, undefined);
    expect(controlword).toBeDefined();
    expect(controlword?.parameterName).toBe('Controlword');
    expect(controlword?.objectType).toBe(0x7);
    expect(controlword?.dataType).toBe(0x0006);
    expect(controlword?.accessType).toBe('rw');
    expect(controlword?.pdoMapping).toBe(true);
    expect(controlword?.lowLimit).toBe('0x0000');
    expect(controlword?.highLimit).toBe('0xFFFF');
  });

  it('AccessType küçük harfe çevrilir', () => {
    const { database } = expectSuccess(parseEds(SAMPLE_EDS_TEXT));
    expect(database.objects.every((o) => o.accessType === undefined || o.accessType === o.accessType?.toLowerCase())).toBe(
      true,
    );
  });
});

describe('parseEds — sub-index bölümleri', () => {
  it('[XXXXsubYY] başlığını index+sub-index olarak ayırır', () => {
    const text = `[1018]
ParameterName=Identity Object
ObjectType=0x9

[1018sub0]
ParameterName=Number of Entries
DataType=0x0005
AccessType=ro

[1018sub1]
ParameterName=Vendor ID
DataType=0x0007
AccessType=ro
`;
    const { database } = expectSuccess(parseEds(text));
    expect(database.objects.map((o) => [o.index, o.subIndex])).toEqual([
      [0x1018, undefined],
      [0x1018, 0],
      [0x1018, 1],
    ]);
    expect(findEdsObject(database, 0x1018, 1)?.parameterName).toBe('Vendor ID');
  });
});

describe('parseEds — hoşgörü ve hata yolları', () => {
  it('boş girdide success:false döner', () => {
    const result = parseEds('');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.issues[0]?.messageKey).toBe('definition.eds.issue.emptyInput');
    }
  });

  it('hiç Object Dictionary girdisi olmayan dosyada success:false döner', () => {
    const result = parseEds('[FileInfo]\nFileName=Empty.eds\n');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.issues.some((i) => i.messageKey === 'definition.eds.issue.noObjects')).toBe(true);
    }
  });

  it('tanınmayan bölümü satır numarasıyla BİR KEZ bildirir, dosyayı reddetmez', () => {
    const text = `[VendorExtension]
Foo=Bar
Baz=Qux

[1000]
ParameterName=Device Type
DataType=0x0007
`;
    const { issues, database } = expectSuccess(parseEds(text));
    const unsupported = issues.filter((i) => i.messageKey === 'definition.eds.issue.unsupportedSection');
    expect(unsupported).toHaveLength(1);
    expect(unsupported[0]?.text).toBe('VendorExtension');
    expect(database.objects).toHaveLength(1);
  });

  it('CRLF satır sonlarını kırpar', () => {
    const text = '[1000]\r\nParameterName=Device Type\r\nDataType=0x0007\r\n';
    const { database } = expectSuccess(parseEds(text));
    expect(database.objects[0]?.parameterName).toBe('Device Type');
  });

  it('aynı index/sub-index ikinci kez tanımlanırsa uyarır ama ikisini de tutar', () => {
    const text = `[1000]
ParameterName=First

[1000]
ParameterName=Second
`;
    const { issues, database } = expectSuccess(parseEds(text));
    expect(issues.some((i) => i.messageKey === 'definition.eds.issue.duplicateObject')).toBe(true);
    expect(database.objects).toHaveLength(2);
  });

  it('bölüm dışındaki tanınmayan satır malformedLine olarak bildirilir', () => {
    const text = `[1000]
ParameterName=Device Type
not a key value line
`;
    const { issues } = expectSuccess(parseEds(text));
    expect(issues.some((i) => i.messageKey === 'definition.eds.issue.malformedLine')).toBe(true);
  });
});

describe('findEdsObject', () => {
  it('bulunamayan index/sub-index için undefined döner', () => {
    const { database } = expectSuccess(parseEds(SAMPLE_EDS_TEXT));
    expect(findEdsObject(database, 0x9999, undefined)).toBeUndefined();
  });
});
