import { describe, expect, it } from 'vitest';

import { computeNamedCrc } from '@/protocol-core/checksums';
import { isParseSuccess } from '@/protocol-core/types';
import type { ParsedField, ParseResult } from '@/protocol-core/types';

import { hasCnipSignature, hasNaiveLonTalkSignature, lonworksParser, lonworksPlugin } from './lonworks';

/**
 * Faz 10 dalga 17 — `lonworks` eklentisi (uçtan uca).
 *
 * `cnip.test.ts` zarfı, `lonTalk.test.ts` PDU'yu alan alan sınıyor; bu dosya
 * ikisinin BİRLEŞTİĞİ yeri ve eklenti sözleşmesini sınar: örnek çerçeveler,
 * `decodeOptions` kanalları, kapsam reddi ve kuyruk CRC'si.
 */

function exampleBytes(id: string): Uint8Array {
  const example = lonworksPlugin.exampleFrames.find((candidate) => candidate.id === id);
  if (example === undefined) throw new Error(`missing example ${id}`);
  return example.bytes;
}

function parse(id: string, options?: Record<string, unknown>): ParseResult {
  return lonworksParser.parse(exampleBytes(id), options === undefined ? undefined : { options });
}

function fieldsOf(result: ParseResult): ParsedField[] {
  if (!isParseSuccess(result)) throw new Error('expected a successful parse');
  return result.frame.fields;
}

function field(result: ParseResult, id: string): ParsedField {
  const found = fieldsOf(result).find((candidate) => candidate.id === id);
  if (found === undefined) throw new Error(`missing field ${id}`);
  return found;
}

function warningCodes(result: ParseResult): string[] {
  if (!isParseSuccess(result)) throw new Error('expected a successful parse');
  return result.frame.warnings.map((warning) => warning.code);
}

describe('eklenti sözleşmesi', () => {
  it('katalogla aynı kimliği ve kategoriyi taşır, `encoder` YAZILMAZ', () => {
    expect(lonworksPlugin.id).toBe('lonworks');
    expect(lonworksPlugin.name).toBe('LonWorks');
    expect(lonworksPlugin.category).toBe('building-automation');
    // Katalog `tabs`ında 'build' YOK → encoder yazılmaz (16c gerekçesi).
    expect(lonworksPlugin.encoder).toBeUndefined();
    expect(lonworksPlugin.parser).toBe(lonworksParser);
  });

  it('SEKİZ `decodeOptions` kanalı sunar ve hepsi geçerli bir varsayılan taşır', () => {
    const options = lonworksPlugin.decodeOptions ?? [];
    expect(options).toHaveLength(8);
    for (const option of options) {
      expect(option.kind).toBe('select');
      expect(option.choices?.some((choice) => choice.value === option.defaultValue), option.id).toBe(
        true,
      );
    }
    expect(options.map((option) => option.id)).toEqual([
      'payloadKind',
      'nvPayloadType',
      'timestampEpoch',
      'strictLength',
      'neuronIdByteOrder',
      'unknownPacketTypeHandling',
      'versionByteSplit',
      'foreignFrameCodeLabels',
    ]);
  });

  it('`nvPayloadType` şıkları SNVT tablosundan üretilir ve `raw` varsayılandır', () => {
    const option = lonworksPlugin.decodeOptions?.find((candidate) => candidate.id === 'nvPayloadType');
    expect(option?.defaultValue).toBe('raw');
    expect(option?.choices?.length).toBeGreaterThan(70);
    expect(option?.choices?.some((choice) => choice.value === 'SNVT_temp')).toBe(true);
  });

  it('on üç örnek çerçeve taşır; yedisi GERÇEK yakalamadandır', () => {
    expect(lonworksPlugin.exampleFrames).toHaveLength(13);
    const ids = lonworksPlugin.exampleFrames.map((example) => example.id);
    expect(new Set(ids).size).toBe(ids.length);
    // Gerçek yedisinin `len` alanı KENDİNİ doğrular — yakalamada 12028/12028.
    for (const id of [
      'tpdu-ackd-nv-update',
      'tpdu-ack',
      'spdu-request-nv-fetch',
      'spdu-response-ambiguous',
      'apdu-direct-nv',
      'apdu-longest-nv',
      'broadcast-truncated',
    ]) {
      const data = exampleBytes(id);
      expect(((data[0] ?? 0) << 8) | (data[1] ?? 0), id).toBe(data.length);
    }
  });

  it('her örneğin `expectedValid` bayrağı motorun gerçek sonucuyla TUTARLIDIR', () => {
    for (const example of lonworksPlugin.exampleFrames) {
      const result = lonworksParser.parse(example.bytes);
      const actual = isParseSuccess(result) ? result.frame.valid : false;
      expect(actual, example.id).toBe(example.expectedValid);
    }
  });
});

describe('`canParse` imzası — R4', () => {
  it('gerçek datagramların hepsini kabul eder', () => {
    for (const id of ['tpdu-ackd-nv-update', 'tpdu-ack', 'broadcast-truncated']) {
      expect(lonworksParser.canParse(exampleBytes(id)), id).toBe(true);
    }
  });

  it('DÖRT koşulun HER BİRİ tek başına imzayı düşürür', () => {
    const base = exampleBytes('tpdu-ackd-nv-update');
    expect(hasCnipSignature(base)).toBe(true);

    const badLength = Uint8Array.from(base);
    badLength[1] = 0x21;
    expect(hasCnipSignature(badLength)).toBe(false);

    const badVersion = Uint8Array.from(base);
    badVersion[2] = 0x02;
    expect(hasCnipSignature(badVersion)).toBe(false);

    const badType = Uint8Array.from(base);
    badType[3] = 0x02;
    expect(hasCnipSignature(badType)).toBe(false);

    const badExth = Uint8Array.from(base);
    badExth[4] = 0x40;
    expect(hasCnipSignature(badExth)).toBe(false);

    expect(hasCnipSignature(base.slice(0, 19))).toBe(false);
  });

  it('ham LonTalk PDU`su imzayı GEÇMEZ — ve geçemez olması kapsam kararının ayağıdır', () => {
    const rawPdu = exampleBytes('raw-pdu-with-crc');
    expect(lonworksParser.canParse(rawPdu)).toBe(false);
    // Naif ham imza AYNI baytları kabul ederdi; bu yüzden motor ona dayanmıyor.
    expect(hasNaiveLonTalkSignature(rawPdu)).toBe(true);
  });

  it('`decodeOptions` `canParse`ı ETKİLEMEZ — sözleşme onu almıyor', () => {
    const rawPdu = exampleBytes('raw-pdu-with-crc');
    const parsed = lonworksParser.parse(rawPdu, {
      options: { payloadKind: 'raw-lontalk-pdu-with-crc' },
    });
    expect(isParseSuccess(parsed)).toBe(true);
    // Çözülebiliyor olması imzayı DEĞİŞTİRMEZ.
    expect(lonworksParser.canParse(rawPdu)).toBe(false);
  });
});

describe('gerçek yakalamanın çerçeveleri', () => {
  it('1) ve 2) AYNI transaction numarasını taşır — istek/yanıt eşleşmesi', () => {
    const request = parse('tpdu-ackd-nv-update');
    const acknowledge = parse('tpdu-ack');
    expect(field(request, 'lontalk-transaction').rawValue).toBe(3);
    expect(field(acknowledge, 'lontalk-transaction').rawValue).toBe(3);
    // Yön ters: 1/42 → 1/41 ve 1/41 → 1/42.
    expect(field(request, 'lontalk-dst-node').physicalValue).toBe('41');
    expect(field(acknowledge, 'lontalk-dst-node').physicalValue).toBe('42');
    expect(field(request, 'lontalk-tsa-type').physicalValue).toBe('ACKD');
    expect(field(acknowledge, 'lontalk-tsa-type').physicalValue).toBe('ACK');
  });

  it('3) ve 4) aynı transaction`da NM isteği ve ÇAKIŞAN yanıt kodudur', () => {
    const request = parse('spdu-request-nv-fetch');
    const response = parse('spdu-response-ambiguous');
    expect(field(request, 'lontalk-nm-code').physicalValue).toBe('NM_NV_FETCH');
    expect(field(request, 'lontalk-transaction').rawValue).toBe(0x0b);
    expect(field(response, 'lontalk-transaction').rawValue).toBe(0x0b);
    expect(warningCodes(response)).toContain('responseCodeAmbiguous');
  });

  it('7) GERÇEK bir kesik çerçevedir — türetilmiş veri DEĞİL', () => {
    const result = parse('broadcast-truncated');
    if (!isParseSuccess(result)) throw new Error('expected a successful parse');
    expect(result.frame.valid).toBe(false);
    expect(result.frame.errors.map((error) => error.code)).toEqual(['truncated-frame']);
    expect(field(result, 'lontalk-priority').rawValue).toBe(1);
    // KISMİ çözüm yine gösterilir (spec §47).
    expect(fieldsOf(result).length).toBeGreaterThan(15);
  });

  it('6) yakalamanın en uzun datagramıdır ve NV selector 845 taşır', () => {
    const result = parse('apdu-longest-nv');
    expect(exampleBytes('apdu-longest-nv')).toHaveLength(43);
    expect(field(result, 'lontalk-apdu-class').physicalValue).toBe('Network Variable');
    expect(field(result, 'lontalk-nv-selector').rawValue).toBe(845);
    expect(field(result, 'lontalk-nv-payload').length).toBe(14);
  });
});

describe('kapsam reddi ve türetilmiş örnekler', () => {
  it('kapsam dışı protokol kodu TANINIR ve AÇIKÇA reddedilir', () => {
    const result = parse('foreign-protocol-code');
    if (!isParseSuccess(result)) throw new Error('expected a successful parse');
    const error = result.frame.errors[0];
    expect(error?.code).toBe('unsupported-encoding');
    expect(error?.message).toBe('protocol.lonworks.error.protocolCodeOutOfScope');
    // Zarfın okunabilen alanları YİNE basılır; "geçersiz" deyip susmak yok.
    expect(field(result, 'cnip-session-id').rawValue).toBe(0x6b8b4567);
  });

  it('Data Packet olmayan tip HATA DEĞİLDİR — ad basılır, gövde ham kalır', () => {
    const result = parse('non-data-packet');
    if (!isParseSuccess(result)) throw new Error('expected a successful parse');
    expect(result.frame.valid).toBe(true);
    expect(field(result, 'cnip-packet-type').physicalValue).toBe('Device Configuration Request');
    expect(fieldsOf(result).some((candidate) => candidate.id.startsWith('lontalk-'))).toBe(false);
  });

  it('genişletilmiş başlık örneğinde LonTalk PDU`su DÖRT bayt ileri kayar', () => {
    const plain = parse('tpdu-ackd-nv-update');
    const extended = parse('extended-header');
    expect(field(extended, 'lontalk-priority').offset).toBe(
      field(plain, 'lontalk-priority').offset + 4,
    );
    expect(field(extended, 'lontalk-nv-selector').rawValue).toBe(269);
  });

  it('uzunluk alanı bozuk örnek katı modda hata, gevşek modda uyarı verir', () => {
    const strict = parse('length-mismatch');
    if (!isParseSuccess(strict)) throw new Error('expected a successful parse');
    expect(strict.frame.errors.map((error) => error.code)).toEqual(['length-mismatch']);

    const lenient = parse('length-mismatch', { strictLength: 'lenient' });
    if (!isParseSuccess(lenient)) throw new Error('expected a successful parse');
    expect(lenient.frame.valid).toBe(true);
    expect(lenient.frame.warnings.map((warning) => warning.code)).toContain('lengthMismatchLenient');
  });

  it('Foreign Frame örneği sınıfı basar ve kodun anlamsız olduğunu SÖYLER', () => {
    const result = parse('foreign-frame');
    expect(field(result, 'lontalk-apdu-class').physicalValue).toBe('Foreign Frame');
    expect(String(field(result, 'lontalk-foreign-code').physicalValue)).toContain('not published');
    expect(warningCodes(result)).toContain('foreignFrameCodeUnknown');
  });
});

describe('kuyruk CRC`si — tünelde YOK, ham PDU`da VAR', () => {
  it('CN/IP tünelinde CRC HİÇ hesaplanmaz ve bunu uyarıyla söyler', () => {
    const result = parse('tpdu-ackd-nv-update');
    expect(fieldsOf(result).some((candidate) => candidate.id === 'lontalk-crc')).toBe(false);
    expect(warningCodes(result)).toContain('tunnelCarriesNoCrc');
  });

  it('ham PDU + CRC şıkkında CRC-16/GENIBUS GERÇEKTEN doğrulanır', () => {
    const result = parse('raw-pdu-with-crc', { payloadKind: 'raw-lontalk-pdu-with-crc' });
    if (!isParseSuccess(result)) throw new Error('expected a successful parse');
    expect(result.frame.valid).toBe(true);
    expect(field(result, 'lontalk-crc').valid).toBe(true);
    expect(String(field(result, 'lontalk-crc').physicalValue)).toContain('PASS (covers 12 B)');
    expect(warningCodes(result)).toContain('rawPduModeNoEnvelope');

    // Motordan BAĞIMSIZ ikinci hesap: Echelon`un `LtCRC16` tablo döngüsü.
    const data = exampleBytes('raw-pdu-with-crc');
    const table: number[] = [];
    for (let index = 0; index < 256; index += 1) {
      let register = index << 8;
      for (let bit = 0; bit < 8; bit += 1) {
        register = (register & 0x8000) === 0 ? (register << 1) & 0xffff : ((register << 1) ^ 0x1021) & 0xffff;
      }
      table[index] = register;
    }
    let crc = 0xffff;
    for (const byte of data.subarray(0, data.length - 2)) {
      crc = ((crc << 8) ^ (table[((crc >> 8) & 0xff) ^ byte] ?? 0)) & 0xffff;
    }
    crc = ~crc & 0xffff;
    expect(crc).toBe(((data[data.length - 2] ?? 0) << 8) | (data[data.length - 1] ?? 0));
    expect(crc).toBe(Number(computeNamedCrc(data.subarray(0, data.length - 2), 'CRC16_GENIBUS')));
  });

  it('`CRC16_CCITT_FALSE` bu çerçevede FAIL verir — YALNIZ `xorout` ayrılıyor', () => {
    const data = exampleBytes('raw-pdu-with-crc');
    const covered = data.subarray(0, data.length - 2);
    const received = ((data[data.length - 2] ?? 0) << 8) | (data[data.length - 1] ?? 0);
    expect(Number(computeNamedCrc(covered, 'CRC16_GENIBUS'))).toBe(received);
    // Deponun en keskin sahte dostu: aynı poly, aynı init, aynı yansıma.
    expect(Number(computeNamedCrc(covered, 'CRC16_CCITT_FALSE'))).not.toBe(received);
    expect(Number(computeNamedCrc(covered, 'CRC16_X25'))).not.toBe(received);
  });

  it('CRC bozulunca `crc-mismatch` basar', () => {
    const data = Uint8Array.from(exampleBytes('raw-pdu-with-crc'));
    data[data.length - 1] = (data[data.length - 1] ?? 0) ^ 0x01;
    const result = lonworksParser.parse(data, {
      options: { payloadKind: 'raw-lontalk-pdu-with-crc' },
    });
    if (!isParseSuccess(result)) throw new Error('expected a successful parse');
    expect(result.frame.errors.map((error) => error.code)).toEqual(['crc-mismatch']);
  });

  it('CRC`siz ham PDU şıkkında CRC alanı HİÇ BASILMAZ', () => {
    const result = lonworksParser.parse(exampleBytes('raw-pdu-with-crc'), {
      options: { payloadKind: 'raw-lontalk-pdu' },
    });
    expect(fieldsOf(result).some((candidate) => candidate.id === 'lontalk-crc')).toBe(false);
    // Son iki bayt bu modda NV yükünün parçası sayılır — CRC İDDİA EDİLMEZ.
    expect(field(result, 'lontalk-nv-payload').length).toBe(4);
  });
});

describe('sözleşme sınırları', () => {
  it('boş girdi ve iptal edilmiş bağlam düzgün başarısız olur', () => {
    const empty = lonworksParser.parse(new Uint8Array(0));
    expect(empty.success).toBe(false);

    const controller = new AbortController();
    controller.abort();
    const aborted = lonworksParser.parse(exampleBytes('tpdu-ackd-nv-update'), {
      signal: controller.signal,
    });
    expect(aborted.success).toBe(false);
    if (!aborted.success) expect(aborted.error.code).toBe('parser-timeout');
  });

  it('`ParsedFrame` DÜZDÜR ve alanların hepsi bayt cinsinden konumlanır', () => {
    const result = parse('apdu-longest-nv');
    const data = exampleBytes('apdu-longest-nv');
    for (const parsedField of fieldsOf(result)) {
      expect(parsedField).not.toHaveProperty('children');
      expect(parsedField.offset).toBeGreaterThanOrEqual(0);
      expect(parsedField.offset + parsedField.length).toBeLessThanOrEqual(data.length);
      expect(parsedField.rawBytes.length).toBe(parsedField.length);
      expect(Array.isArray(parsedField.warnings)).toBe(true);
    }
  });

  it('bilinmeyen seçenek değeri varsayılana düşer, çözümü DÜŞÜRMEZ', () => {
    const result = parse('tpdu-ackd-nv-update', { nvPayloadType: 'SNVT_not_a_real_type' });
    expect(isParseSuccess(result)).toBe(true);
    expect(fieldsOf(result).some((candidate) => candidate.id === 'lontalk-nv-scaled')).toBe(false);
  });
});
