import { describe, expect, it } from 'vitest';

import {
  BUILT_IN_TYPE_NAMES,
  NULL_LENGTH,
  OpcUaDecodeError,
  TICKS_1601_TO_1970,
  convertTicksToIso,
  createCursor,
  formatDataValue,
  formatLocalizedText,
  formatNodeId,
  formatQualifiedName,
  formatStatusCode,
  readByteStringValue,
  readDataValueValue,
  readDateTimeValue,
  readDiagnosticInfoValue,
  readDoubleValue,
  readExpandedNodeIdValue,
  readExtensionObjectValue,
  readFloatValue,
  readGuidValue,
  readInt32,
  readInt64,
  readLocalizedTextValue,
  readNodeIdValue,
  readQualifiedNameValue,
  readStringValue,
  readUInt32,
  readVariantValue,
  statusSeverity,
} from './opcUaBinary';

function bytes(hex: string): Uint8Array {
  const cleaned = hex.replace(/\s+/g, '');
  const result = new Uint8Array(cleaned.length / 2);
  for (let index = 0; index < result.length; index++) {
    result[index] = Number.parseInt(cleaned.slice(index * 2, index * 2 + 2), 16);
  }
  return result;
}

/**
 * REFERANS DEĞERLER: OPC 10000-6 (Part 6: Mappings) v1.05'in KENDİ örnekleri.
 * Spec metinleri değerleri açıkça yazıyor (Şekil 2 "1 000 000 000 (Hex:
 * 3B9ACA00)", Şekil 3 "-6.5 (Hex: C0D00000)", Şekil 4 "'水Boy'", Şekil 5
 * Guid "72962B91-FA75-4AE6-8D28-B404DC7DAF63", Şekil 7 String NodeId
 * ns=1 "Hot水", Şekil 8 Two Byte NodeId id=72, Şekil 9 Four Byte NodeId
 * ns=5 id=1025); bayt sırası ise §5.2.2.2'nin "all integer types shall be
 * encoded as little-endian" kuralından türer ve Wireshark `parseNodeId()` +
 * open62541 `ENCODE_BINARY(Guid)` ile ÇAPRAZ TEYİTLİDİR.
 */
describe('opcUaBinary — Part 6 referans örnekleri', () => {
  it('Şekil 2: Int32 1 000 000 000 little-endian okunur', () => {
    expect(readUInt32(createCursor(bytes('00 CA 9A 3B')))).toBe(1_000_000_000);
  });

  it('Şekil 3: Float -6.5 (0xC0D00000) little-endian okunur', () => {
    expect(readFloatValue(createCursor(bytes('00 00 D0 C0')))).toBe(-6.5);
  });

  it('Şekil 4: String "水Boy" uzunluk önekli UTF-8 olarak okunur', () => {
    expect(readStringValue(createCursor(bytes('06 00 00 00 E6 B0 B4 42 6F 79')))).toBe('水Boy');
  });

  it('Şekil 5: Guid Data1/Data2/Data3 little-endian, Data4 HAM okunur', () => {
    // Düz 16 bayt kopyalasaydık ilk üç grup ters çıkardı — tuzak 5.
    const guid = readGuidValue(createCursor(bytes('91 2B 96 72 75 FA E6 4A 8D 28 B4 04 DC 7D AF 63')));
    expect(guid).toBe('72962B91-FA75-4AE6-8D28-B404DC7DAF63');
  });

  it('Şekil 7: String NodeId ns=1 s="Hot水"', () => {
    const nodeId = readNodeIdValue(createCursor(bytes('03 01 00 06 00 00 00 48 6F 74 E6 B0 B4')));
    expect(nodeId.namespaceIndex).toBe(1);
    expect(nodeId.identifier).toEqual({ kind: 'string', value: 'Hot水' });
    expect(formatNodeId(nodeId)).toBe('ns=1;s=Hot水');
  });

  it('Şekil 8: Two Byte NodeId TOPLAM 2 bayttır ve namespace örtük 0dır', () => {
    const cursor = createCursor(bytes('00 48'));
    const nodeId = readNodeIdValue(cursor);
    expect(cursor.offset).toBe(2);
    expect(nodeId.namespaceIndex).toBe(0);
    expect(nodeId.identifier).toEqual({ kind: 'numeric', value: 72 });
    expect(formatNodeId(nodeId)).toBe('i=72');
  });

  it('Şekil 9: Four Byte NodeId TOPLAM 4 bayttır, namespace TEK bayt okunur', () => {
    const cursor = createCursor(bytes('01 05 01 04'));
    const nodeId = readNodeIdValue(cursor);
    expect(cursor.offset).toBe(4);
    expect(nodeId.namespaceIndex).toBe(5);
    expect(nodeId.identifier).toEqual({ kind: 'numeric', value: 1025 });
    expect(formatNodeId(nodeId)).toBe('ns=5;i=1025');
  });

  it('Numeric NodeId (0x02) TOPLAM 7 bayttır — FourByte ile karıştırılamaz', () => {
    const cursor = createCursor(bytes('02 05 00 01 04 00 00'));
    const nodeId = readNodeIdValue(cursor);
    expect(cursor.offset).toBe(7);
    expect(nodeId.namespaceIndex).toBe(5);
    expect(nodeId.identifier).toEqual({ kind: 'numeric', value: 1025 });
  });
});

describe('opcUaBinary — DateTime (1601 epoch, 100 ns tick)', () => {
  it('epoch sabiti 1601→1970 farkını taşır', () => {
    // 134774 gün × 86400 s × 10^7 tick — türetimi dosya başında yazılı.
    expect(TICKS_1601_TO_1970).toBe(116444736000000000n);
  });

  it('Unix epoch tick değeri 1970-01-01T00:00:00Z verir', () => {
    expect(convertTicksToIso(TICKS_1601_TO_1970)).toBe('1970-01-01T00:00:00.000Z');
  });

  it('2024-01-01T00:00:00Z tick değeri Date ile birebir örtüşür', () => {
    const ticks = BigInt(Date.UTC(2024, 0, 1)) * 10_000n + TICKS_1601_TO_1970;
    expect(ticks).toBe(133485408000000000n);
    expect(convertTicksToIso(ticks)).toBe('2024-01-01T00:00:00.000Z');
  });

  it('SIFIR "1601" DEĞİL "belirtilmemiş" demektir — tarihe çevrilmez', () => {
    expect(convertTicksToIso(0n)).toBeNull();
  });

  it('Int64 üst sınırı da gerçek bir tarih değildir', () => {
    expect(convertTicksToIso(9223372036854775807n)).toBeNull();
  });

  it('okuyucu ham tick ile ISO metnini birlikte döner', () => {
    // 133485408000000000 = 0x01DA3C457689C000, little-endian.
    const value = readDateTimeValue(createCursor(bytes('00 C0 89 76 45 3C DA 01')));
    expect(value.ticks).toBe(133485408000000000n);
    expect(value.iso).toBe('2024-01-01T00:00:00.000Z');
  });

  it('Unix saniyesi varsayan bir çözüm 369 yıl kaydırırdı', () => {
    // Bu test `unixTimestamp.ts`in SAHTE DOST olduğunu kayda geçirir:
    // aynı ham sayıyı Unix ms saymak 1970+ değil 4200+ verirdi.
    const ticks = TICKS_1601_TO_1970;
    expect(convertTicksToIso(ticks)).toBe('1970-01-01T00:00:00.000Z');
    expect(new Date(Number(ticks / 10_000n)).getUTCFullYear()).toBeGreaterThan(2000);
  });
});

describe('opcUaBinary — null / boş ayrımı (tuzak 3)', () => {
  it('String uzunluğu -1 null, 0 boş metindir', () => {
    expect(readStringValue(createCursor(bytes('FF FF FF FF')))).toBeNull();
    expect(readStringValue(createCursor(bytes('00 00 00 00')))).toBe('');
  });

  it('ByteString uzunluğu -1 null, 0 boş dizidir', () => {
    expect(readByteStringValue(createCursor(bytes('FF FF FF FF')))).toBeNull();
    expect(readByteStringValue(createCursor(bytes('00 00 00 00')))).toEqual(new Uint8Array(0));
  });

  it('uzunluk alanı İŞARETLİ okunur — -1 asla 4294967295 olmaz', () => {
    expect(readInt32(createCursor(bytes('FF FF FF FF')))).toBe(NULL_LENGTH);
    expect(readUInt32(createCursor(bytes('FF FF FF FF')))).toBe(4294967295);
  });

  it('null dizi ile boş dizi Variant içinde de ayrışır', () => {
    // mask 0x80|6 = Int32 dizisi; uzunluk -1 → null dizi.
    const nullArray = readVariantValue(createCursor(bytes('86 FF FF FF FF')));
    expect(nullArray.arrayLength).toBe(NULL_LENGTH);
    expect(nullArray.formatted).toBeNull();

    const emptyArray = readVariantValue(createCursor(bytes('86 00 00 00 00')));
    expect(emptyArray.arrayLength).toBe(0);
    expect(emptyArray.formatted).toBe('[]');
  });

  it('tamponu aşan uzunluk sessizce yutulmaz, hata fırlatır', () => {
    expect(() => readStringValue(createCursor(bytes('10 00 00 00 41 42')))).toThrow(OpcUaDecodeError);
  });
});

describe('opcUaBinary — Variant', () => {
  it('mask 0 NULL variant demektir ve başka alan okunmaz', () => {
    const cursor = createCursor(bytes('00 AA BB'));
    const variant = readVariantValue(cursor);
    expect(cursor.offset).toBe(1);
    expect(variant.formatted).toBeNull();
    expect(variant.builtInTypeName).toBe('Null');
  });

  it('skaler Double 25.73 okunur ve sayısal değeri korunur', () => {
    // 25.73 → IEEE754 double little-endian.
    const buffer = new ArrayBuffer(8);
    new DataView(buffer).setFloat64(0, 25.73, true);
    const raw = new Uint8Array(9);
    raw[0] = 11; // built-in tip id: Double
    raw.set(new Uint8Array(buffer), 1);
    const variant = readVariantValue(createCursor(raw));
    expect(variant.builtInTypeName).toBe('Double');
    expect(variant.isArray).toBe(false);
    expect(variant.scalarNumber).toBe(25.73);
    expect(variant.formatted).toBe('25.73');
  });

  it('bit 7 dizi demektir ve önce Int32 eleman sayısı gelir', () => {
    // mask 0x83 = Byte dizisi, 3 eleman.
    const variant = readVariantValue(createCursor(bytes('83 03 00 00 00 01 02 03')));
    expect(variant.isArray).toBe(true);
    expect(variant.arrayLength).toBe(3);
    expect(variant.formatted).toBe('[1, 2, 3]');
    expect(variant.builtInTypeName).toBe('Byte');
  });

  it('bit 6 ArrayDimensions ekler — dizi elemanlarından SONRA okunur', () => {
    // mask 0xC6 = Int32 dizisi + boyutlar; 4 eleman, 2 boyut (2×2).
    const variant = readVariantValue(
      createCursor(
        bytes(
          'C6 04 00 00 00 01 00 00 00 02 00 00 00 03 00 00 00 04 00 00 00 02 00 00 00 02 00 00 00 02 00 00 00',
        ),
      ),
    );
    expect(variant.arrayLength).toBe(4);
    expect(variant.dimensions).toEqual([2, 2]);
  });

  it('tanınmayan tip id 26-31 ByteString sayılır (P6 §5.2.2.16)', () => {
    const variant = readVariantValue(createCursor(bytes('1A 02 00 00 00 AA BB')));
    expect(variant.builtInTypeName).toBe('Reserved(26)');
    expect(variant.formatted).toBe('AA BB');
  });

  it('yerleşik tip tablosu 25 tipi kapsar', () => {
    expect(BUILT_IN_TYPE_NAMES.get(1)).toBe('Boolean');
    expect(BUILT_IN_TYPE_NAMES.get(13)).toBe('DateTime');
    expect(BUILT_IN_TYPE_NAMES.get(25)).toBe('DiagnosticInfo');
    expect(BUILT_IN_TYPE_NAMES.size).toBe(26);
  });
});

describe('opcUaBinary — DataValue', () => {
  it('maskede olmayan alan AKIŞTA HİÇ YOKTUR', () => {
    // mask 0x02 = yalnız StatusCode; Value ve damgalar okunmaz.
    const cursor = createCursor(bytes('02 00 00 34 80'));
    const dataValue = readDataValueValue(cursor);
    expect(cursor.offset).toBe(5);
    expect(dataValue.value).toBeNull();
    expect(dataValue.statusCode).toBe(0x80340000);
    expect(formatDataValue(dataValue)).toBe('BadNodeIdUnknown (0x80340000)');
  });

  it('Value + Status + SourceTimestamp sırası P6 Tablo 27 SATIR sırasıdır', () => {
    // mask 0x07 = Value + Status + SourceTimestamp (0x01 | 0x02 | 0x04).
    const builder: number[] = [0x07, 11];
    const buffer = new ArrayBuffer(8);
    new DataView(buffer).setFloat64(0, 25.73, true);
    builder.push(...new Uint8Array(buffer));
    builder.push(0x00, 0x00, 0x00, 0x00); // StatusCode Good
    builder.push(...bytes('00 C0 89 76 45 3C DA 01')); // SourceTimestamp
    const dataValue = readDataValueValue(createCursor(Uint8Array.from(builder)));
    expect(dataValue.value?.scalarNumber).toBe(25.73);
    expect(dataValue.statusCode).toBe(0);
    expect(dataValue.sourceTimestamp?.iso).toBe('2024-01-01T00:00:00.000Z');
    expect(dataValue.serverTimestamp).toBeNull();
  });
});

describe('opcUaBinary — DiagnosticInfo', () => {
  it('AKIŞ sırası maskenin bit sırasından FARKLIDIR: Locale, LocalizedText ÖNCE/SONRA', () => {
    // mask 0x0C = LocalizedText (0x04) + Locale (0x08). Akışta ÖNCE Locale
    // gelir (open62541 ve Wireshark ile teyitli). Locale=7, LocalizedText=9.
    const cursor = createCursor(bytes('0C 07 00 00 00 09 00 00 00'));
    readDiagnosticInfoValue(cursor);
    expect(cursor.offset).toBe(9);
  });

  it('AdditionalInfo ve InnerStatusCode çözülür', () => {
    const cursor = createCursor(bytes('30 02 00 00 00 4F 4B 00 00 34 80'));
    const info = readDiagnosticInfoValue(cursor);
    expect(info.additionalInfo).toBe('OK');
    expect(info.innerStatusCode).toBe(0x80340000);
    expect(cursor.offset).toBe(11);
  });

  it('sınırsız özyineleme reddedilir', () => {
    // Her seviye yalnız InnerDiagnosticInfo taşır: 0x40 tekrar tekrar.
    const deep = new Uint8Array(32).fill(0x40);
    expect(() => readDiagnosticInfoValue(createCursor(deep))).toThrow(OpcUaDecodeError);
  });
});

describe('opcUaBinary — diğer yerleşik tipler', () => {
  it('ExpandedNodeId bayrakları NodeId biçiminden AYRI bitlerdedir', () => {
    // 0x81 = FourByte (0x01) + NamespaceUri bayrağı (0x80).
    const nodeId = readExpandedNodeIdValue(
      createCursor(bytes('81 00 01 04 08 00 00 00 75 72 6E 3A 64 65 6D 6F')),
    );
    expect(nodeId.identifier).toEqual({ kind: 'numeric', value: 1025 });
    expect(nodeId.namespaceUri).toBe('urn:demo');
    expect(nodeId.serverIndex).toBeNull();
  });

  it('ServerIndex bayrağı NamespaceUri’den SONRA okunur', () => {
    // 0xC0 = TwoByte (0x00) + NamespaceUri (0x80) + ServerIndex (0x40).
    const nodeId = readExpandedNodeIdValue(createCursor(bytes('C0 07 FF FF FF FF 03 00 00 00')));
    expect(nodeId.identifier).toEqual({ kind: 'numeric', value: 7 });
    expect(nodeId.namespaceUri).toBeNull();
    expect(nodeId.serverIndex).toBe(3);
  });

  it('LocalizedText maskesi eksik alanı AKIŞTAN çıkarır', () => {
    // 0x02 = yalnız Text.
    const text = readLocalizedTextValue(createCursor(bytes('02 04 00 00 00 54 65 6D 70')));
    expect(text.locale).toBeNull();
    expect(text.text).toBe('Temp');
    expect(formatLocalizedText(text)).toBe('Temp');
  });

  it('QualifiedName namespace ile birlikte biçimlenir', () => {
    const name = readQualifiedNameValue(createCursor(bytes('02 00 04 00 00 00 54 65 6D 70')));
    expect(formatQualifiedName(name)).toBe('2:Temp');
  });

  it('ExtensionObject encoding 0x00 gövde YOK demektir', () => {
    const cursor = createCursor(bytes('00 00 00'));
    const extension = readExtensionObjectValue(cursor);
    expect(cursor.offset).toBe(3);
    expect(extension.body).toBeNull();
  });

  it('ExtensionObject ByteString gövdesi uzunluk önekiyle okunur', () => {
    const cursor = createCursor(bytes('01 00 05 00 01 02 00 00 00 AA BB'));
    const extension = readExtensionObjectValue(cursor);
    expect(formatNodeId(extension.typeId)).toBe('i=5');
    expect(extension.body).toEqual(bytes('AA BB'));
    expect(cursor.offset).toBe(11);
  });

  it('Int64 işaretli okunur, UInt64 ile karışmaz', () => {
    expect(readInt64(createCursor(bytes('FF FF FF FF FF FF FF FF')))).toBe(-1n);
  });

  it('Double little-endian okunur', () => {
    const buffer = new ArrayBuffer(8);
    new DataView(buffer).setFloat64(0, 100, true);
    expect(readDoubleValue(createCursor(new Uint8Array(buffer)))).toBe(100);
  });

  it('StatusCode adlandırılır, tanınmayan kod yalnız önem derecesiyle anılır', () => {
    expect(formatStatusCode(0)).toBe('Good (0x00000000)');
    expect(formatStatusCode(0x807d0000)).toBe('BadTcpServerTooBusy (0x807D0000)');
    // Tabloda OLMAYAN kod ADLANDIRILMAZ.
    expect(formatStatusCode(0x80f10000)).toBe('Bad (0x80F10000)');
    expect(statusSeverity(0x40000000)).toBe('Uncertain');
  });
});
