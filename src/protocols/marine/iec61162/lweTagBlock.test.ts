import { describe, expect, it } from 'vitest';

import {
  LWE_TAG_PARAMETERS,
  TAG_BLOCK_MAX_CONTENT_LENGTH,
  describeSentenceGrouping,
  getTagParameterInfo,
  inferTimestampScale,
  parseTagParameters,
  splitTagBlock,
} from './lweTagBlock';

/**
 * TAG bloğunun kendi dilbilgisi — cümle dilbilgisinden AYRI sınanır. Bu
 * dosyanın varlık sebebi checksum KAPSAMININ `\`…`*` olduğunu bağımsız olarak
 * çivilemektir: `iec61162.test.ts` aynı şeyi datagram düzeyinde sınar, ama
 * kapsam hatası orada cümle checksum'ının arkasına gizlenebilir.
 */

const SINGLE_TAG = '\\s:HE0001*45\\';

describe('splitTagBlock', () => {
  it('gerçek yakalamanın TAG bloğunu üç ayrı aralığa böler', () => {
    const block = splitTagBlock(SINGLE_TAG, 0);
    expect(block).toBeDefined();
    if (block === undefined) return;

    // Bloğun TAMAMI: iki ters bölü dahil.
    expect(block.offset).toBe(0);
    expect(block.length).toBe(SINGLE_TAG.length);
    // İçerik: ters bölüler HARİÇ, `*hh` DAHİL.
    expect(block.contentOffset).toBe(1);
    expect(block.contentLength).toBe('s:HE0001*45'.length);
    // Checksum'ın KAPSADIĞI aralık: `\` ile `*` ARASI — cümleninkinden farklı.
    expect(block.coverage).toBe('s:HE0001');
    expect(block.coverageOffset).toBe(1);
    expect(block.coverageLength).toBe(8);
  });

  it('checksum’ı KAPSAM üzerinden yeniden hesaplar (FKIE/PyLWE ile aynı sonuç)', () => {
    const block = splitTagBlock(SINGLE_TAG, 0);
    expect(block?.checksumHex).toBe('45');
    expect(block?.checksumOffset).toBe(10);
    expect(block?.calculatedChecksum).toBe('45');
    expect(block?.checksumValid).toBe(true);
  });

  it('checksum bozulunca YALNIZ TAG bloğu düşer, kapsam değişmez', () => {
    const block = splitTagBlock('\\s:HE0001*46\\', 0);
    expect(block?.checksumValid).toBe(false);
    expect(block?.calculatedChecksum).toBe('45');
    expect(block?.coverage).toBe('s:HE0001');
  });

  it('iki haneli olmayan ya da hex olmayan checksum BOZUK sayılır', () => {
    expect(splitTagBlock('\\s:HE0001*4\\', 0)?.checksumMalformed).toBe(true);
    expect(splitTagBlock('\\s:HE0001*ZZ\\', 0)?.checksumMalformed).toBe(true);
    expect(splitTagBlock('\\s:HE0001*45\\', 0)?.checksumMalformed).toBe(false);
  });

  it('kapanış ters bölüsü yoksa undefined döner — çağıran hataya çevirir', () => {
    expect(splitTagBlock('\\s:HE0001*45', 0)).toBeUndefined();
  });

  it('açılış ters bölüsü yoksa hiç denemez', () => {
    expect(splitTagBlock('$HEROT,+000.05,A*35', 0)).toBeUndefined();
  });

  it('80 baytlık içerik sınırı yalnız AŞILDIĞINDA işaretlenir', () => {
    const padding = 'x'.repeat(TAG_BLOCK_MAX_CONTENT_LENGTH - 't:'.length - '*00'.length);
    const exact = `\\t:${padding}*00\\`;
    expect(splitTagBlock(exact, 0)?.contentLength).toBe(TAG_BLOCK_MAX_CONTENT_LENGTH);
    expect(splitTagBlock(exact, 0)?.exceedsMaxLength).toBe(false);

    const oversized = `\\t:${padding}y*00\\`;
    expect(splitTagBlock(oversized, 0)?.exceedsMaxLength).toBe(true);
  });

  it('gerçek çoklu-cümle yakalamasının üç parametreli bloğunu çözer', () => {
    const block = splitTagBlock('\\s:IN0001,n:881,c:1683881316755*4D\\', 0);
    expect(block?.checksumValid).toBe(true);
    expect(block?.parameters.map((parameter) => parameter.letter)).toEqual(['s', 'n', 'c']);
    expect(block?.parameters.map((parameter) => parameter.value)).toEqual([
      'IN0001',
      '881',
      '1683881316755',
    ]);
  });
});

describe('parseTagParameters', () => {
  it('her token’ın ofsetini KAPSAM içindeki yerinden hesaplar', () => {
    const parameters = parseTagParameters('s:IN0001,n:881', 1);
    expect(parameters).toHaveLength(2);
    expect(parameters[0]?.offset).toBe(1);
    expect(parameters[0]?.length).toBe('s:IN0001'.length);
    expect(parameters[1]?.offset).toBe(1 + 's:IN0001,'.length);
    expect(parameters[1]?.length).toBe('n:881'.length);
  });

  it('iki nokta taşımayan parçayı UYDURMAZ, atlar', () => {
    expect(parseTagParameters('s:IN0001,garbage,n:881', 0).map((p) => p.letter)).toEqual(['s', 'n']);
  });

  it('sözlükte olmayan harf tanınır ama `info` verilmez', () => {
    const [parameter] = parseTagParameters('q:1', 0);
    expect(parameter?.letter).toBe('q');
    expect(parameter?.info).toBeUndefined();
  });
});

describe('parametre sözlüğü', () => {
  it('yalnız `s:` ZORUNLUDUR', () => {
    expect(LWE_TAG_PARAMETERS.filter((parameter) => parameter.required).map((p) => p.letter)).toEqual(['s']);
  });

  it('`a:` TANINIR ama ÇÖZÜLMEZ — biçimi kamuya açık değil', () => {
    expect(getTagParameterInfo('a')?.decoded).toBe(false);
    // Kalan hepsi çözülür; `a:` tek istisnadır.
    expect(LWE_TAG_PARAMETERS.filter((parameter) => !parameter.decoded).map((p) => p.letter)).toEqual(['a']);
  });
});

describe('inferTimestampScale', () => {
  it('13 hane → milisaniye (gerçek yakalamanın değeri)', () => {
    const inferred = inferTimestampScale('1683881316755');
    expect(inferred?.scale).toBe('ms');
    expect(inferred?.iso).toBe('2023-05-12T08:48:36.755Z');
  });

  it('10 hane → saniye (gpsd’nin örnek değeri)', () => {
    const inferred = inferTimestampScale('1241544035');
    expect(inferred?.scale).toBe('s');
    expect(inferred?.iso).toBe('2009-05-05T17:20:35.000Z');
  });

  it('ne 10 ne 13 hane ise HİÇBİR ölçek iddia edilmez', () => {
    expect(inferTimestampScale('123')).toBeUndefined();
    expect(inferTimestampScale('12345678901')).toBeUndefined();
    expect(inferTimestampScale('not-a-number')).toBeUndefined();
  });
});

describe('describeSentenceGrouping', () => {
  it('gpsd’nin `sentence-total-groupid` biçimini çözer', () => {
    expect(describeSentenceGrouping('1-2-73874')).toBe('sentence 1 of 2 · group 73874');
  });

  it('üç parçalı sayısal biçimde değilse UYDURMAZ', () => {
    expect(describeSentenceGrouping('1-2')).toBeUndefined();
    expect(describeSentenceGrouping('a-b-c')).toBeUndefined();
  });
});
