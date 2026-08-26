import { describe, expect, it } from 'vitest';

import { isParseSuccess } from '@/protocol-core/types';
import type { ParsedField, ParsedFrame, ParseResult } from '@/protocol-core/types';

import { iec61162Parser, iec61162Plugin } from './iec61162';

/**
 * Üç gerçek FKIE yakalaması, iki checksum'ın AYRI aralıkları ve çoklu cümlenin
 * düz alan tablosuna oturması. Dosyanın en kritik iki iddiası:
 *   1. TAG checksum'ı bozulunca cümleninki PASS kalır ve tersi — iki kapsamın
 *      GERÇEKTEN ayrı olduğunun kanıtı,
 *   2. sekiz cümlelik datagramda `ParsedField.id`ler BENZERSİZ.
 */

/** Gerçek NUL baytı — kaynakta görünmez olduğu için kod üzerinden üretilir. */
const NUL = String.fromCharCode(0);
const SINGLE_SENTENCE = `UdPbC${NUL}\\s:HE0001*45\\$HEROT,+000.05,A*35\r\n`;

function bytes(text: string): Uint8Array {
  const out = new Uint8Array(text.length);
  for (let index = 0; index < text.length; index += 1) out[index] = text.charCodeAt(index) & 0xff;
  return out;
}

function parse(text: string, options?: Record<string, unknown>): ParseResult {
  return iec61162Parser.parse(bytes(text), options === undefined ? undefined : { options });
}

function frameOf(result: ParseResult): ParsedFrame {
  if (!isParseSuccess(result)) throw new Error(`beklenen başarı, gelen hata: ${result.error.message}`);
  return result.frame;
}

function fieldById(frame: ParsedFrame, id: string): ParsedField | undefined {
  return frame.fields.find((field) => field.id === id);
}

function warningCodes(frame: ParsedFrame): string[] {
  return frame.warnings.map((warning) => warning.code);
}

function exampleBytes(id: string): Uint8Array {
  const example = iec61162Plugin.exampleFrames.find((entry) => entry.id === id);
  if (example === undefined) throw new Error(`örnek yok: ${id}`);
  return example.bytes;
}

describe('iec-61162 · sihirli önek ve kapsam', () => {
  it('`UdPbC` + NUL önekini alan olarak basar', () => {
    const frame = frameOf(parse(SINGLE_SENTENCE));
    const magic = fieldById(frame, 'magic-token');
    expect(magic?.offset).toBe(0);
    expect(magic?.length).toBe(6);
    expect(magic?.rawValue).toBe('55 64 50 62 43 00');
    expect(Array.from(magic?.rawBytes ?? [])).toEqual([0x55, 0x64, 0x50, 0x62, 0x43, 0x00]);
  });

  it('NUL’suz `UdPbC` REDDEDİLİR — altıncı bayt imzanın parçasıdır', () => {
    const result = parse(`UdPbCX\\s:HE0001*45\\$HEROT,+000.05,A*35\r\n`);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.message).toContain('invalidMagicToken');
  });

  it('`UdPbB` diye bir token YOKTUR — reddedilir', () => {
    const result = parse(`UdPbB${NUL}\\s:HE0001*45\\$HEROT,+000.05,A*35\r\n`);
    expect(result.success).toBe(false);
  });

  it('`R?UdP` binary teli TANINIR ve AÇIKÇA kapsam dışı denir', () => {
    const result = iec61162Parser.parse(exampleBytes('binary-transfer-out-of-scope'));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('unsupported-encoding');
      expect(result.error.message).toContain('binaryTransferOutOfScope');
      expect(result.error.details).toMatchObject({ token: 'RrUdP' });
    }
  });

  it('boş girdi ve altı bayttan kısa girdi ayrı ayrı reddedilir', () => {
    expect(parse('').success).toBe(false);
    expect(parse('UdPb').success).toBe(false);
  });
});

describe('iec-61162 · gerçek yakalama 1 (tek cümle, 40 bayt)', () => {
  it('TAG bloğunu ve cümleyi alan alan çözer', () => {
    const frame = frameOf(iec61162Parser.parse(exampleBytes('single-sentence-rot')));
    expect(frame.valid).toBe(true);

    const source = fieldById(frame, 'tag-1-1-s');
    expect(source?.name).toBe('TAG 1.1 · s: Source (SFI)');
    expect(source?.rawValue).toBe('HE0001');
    expect(source?.offset).toBe(7);
    expect(source?.length).toBe('s:HE0001'.length);

    expect(fieldById(frame, 'sentence-1-delimiter')?.physicalValue).toBe('Standard sentence');
    expect(fieldById(frame, 'sentence-1-talker')?.rawValue).toBe('HE');
    expect(fieldById(frame, 'sentence-1-formatter')?.rawValue).toBe('ROT');
    // Cümle adı PROTOKOL VERİSİDİR (nmeaSentences.ts'ten gelir).
    expect(fieldById(frame, 'sentence-1-formatter')?.physicalValue).toBe('Rate of Turn');
    expect(fieldById(frame, 'sentence-1-terminator')?.rawValue).toBe('0D 0A');
  });

  it('İKİ checksum da PASS ve KAPSAMLARI FARKLI', () => {
    const frame = frameOf(iec61162Parser.parse(exampleBytes('single-sentence-rot')));
    const tag = fieldById(frame, 'tag-1-1-checksum');
    const sentence = fieldById(frame, 'sentence-1-checksum');

    expect(tag?.rawValue).toBe('45');
    expect(tag?.valid).toBe(true);
    // `s:HE0001` sekiz karakter — `\` ile `*` ARASI.
    expect(tag?.physicalValue).toBe('PASS (covers 8 B)');

    expect(sentence?.rawValue).toBe('35');
    expect(sentence?.valid).toBe(true);
    // `HEROT,+000.05,A` on beş karakter — `$` ile `*` ARASI.
    expect(sentence?.physicalValue).toBe('PASS (covers 15 B)');

    // Kapsamlar gerçekten farklı: aynı olsalardı iki alan aynı sayıyı yazardı.
    expect(tag?.physicalValue).not.toBe(sentence?.physicalValue);
  });
});

describe('iec-61162 · İKİ CHECKSUM, İKİ AYRI ARALIK (bu dalganın en incelikli noktası)', () => {
  it('TAG checksum’ı bozulunca TAG FAIL / cümle PASS', () => {
    const frame = frameOf(iec61162Parser.parse(exampleBytes('tag-checksum-corrupt')));
    expect(frame.valid).toBe(false);
    expect(fieldById(frame, 'tag-1-1-checksum')?.valid).toBe(false);
    expect(fieldById(frame, 'tag-1-1-checksum')?.physicalValue).toBe('FAIL (calculated 45 over 8 B)');
    // Cümle ETKİLENMEZ.
    expect(fieldById(frame, 'sentence-1-checksum')?.valid).toBe(true);

    expect(frame.errors).toHaveLength(1);
    expect(frame.errors[0]?.code).toBe('checksum-mismatch');
    expect(frame.errors[0]?.details).toMatchObject({ scope: 'tag-block', coverage: 's:HE0001' });
  });

  it('cümle checksum’ı bozulunca cümle FAIL / TAG PASS', () => {
    const frame = frameOf(iec61162Parser.parse(exampleBytes('sentence-checksum-corrupt')));
    expect(frame.valid).toBe(false);
    expect(fieldById(frame, 'sentence-1-checksum')?.valid).toBe(false);
    expect(fieldById(frame, 'sentence-1-checksum')?.physicalValue).toBe(
      'FAIL (calculated 35 over 15 B)',
    );
    // TAG ETKİLENMEZ.
    expect(fieldById(frame, 'tag-1-1-checksum')?.valid).toBe(true);

    expect(frame.errors).toHaveLength(1);
    expect(frame.errors[0]?.details).toMatchObject({
      scope: 'sentence',
      coverage: 'HEROT,+000.05,A',
    });
  });
});

describe('iec-61162 · gerçek yakalama 2 (çoklu TAG, 53 bayt)', () => {
  it('iki TAG bloğu ayrı ayrı çözülür ve ikisinin de checksum’ı KENDİ aralığını kapsar', () => {
    const frame = frameOf(iec61162Parser.parse(exampleBytes('multi-tag-rot')));
    expect(frame.valid).toBe(true);

    expect(fieldById(frame, 'tag-1-1-d')?.rawValue).toBe('HE0002');
    expect(fieldById(frame, 'tag-1-1-d')?.name).toBe('TAG 1.1 · d: Destination');
    expect(fieldById(frame, 'tag-1-1-checksum')?.rawValue).toBe('51');
    expect(fieldById(frame, 'tag-1-2-s')?.rawValue).toBe('HE0001');
    expect(fieldById(frame, 'tag-1-2-checksum')?.rawValue).toBe('45');
    expect(fieldById(frame, 'tag-1-1-checksum')?.valid).toBe(true);
    expect(fieldById(frame, 'tag-1-2-checksum')?.valid).toBe(true);
  });
});

describe('iec-61162 · gerçek yakalama 3 (sekiz cümle, 568 bayt)', () => {
  it('sekiz cümlenin hepsi çözülür ve HER `ParsedField.id` BENZERSİZDİR', () => {
    const frame = frameOf(iec61162Parser.parse(exampleBytes('multi-sentence-navd')));
    expect(frame.valid).toBe(true);

    const ids = frame.fields.map((field) => field.id);
    expect(new Set(ids).size, `çakışan id: ${ids.join(', ')}`).toBe(ids.length);

    // Sekizinci cümleye kadar sayı numarası gerçekten ilerliyor.
    expect(fieldById(frame, 'sentence-8-formatter')?.rawValue).toBe('OSD');
    expect(fieldById(frame, 'sentence-9-formatter')).toBeUndefined();
    expect(fieldById(frame, 'tag-8-1-n')?.rawValue).toBe('888');
  });

  it('sekiz cümlenin de İKİ checksum’ı ayrı ayrı PASS', () => {
    const frame = frameOf(iec61162Parser.parse(exampleBytes('multi-sentence-navd')));
    for (let index = 1; index <= 8; index += 1) {
      expect(fieldById(frame, `tag-${String(index)}-1-checksum`)?.valid, `TAG ${String(index)}`).toBe(
        true,
      );
      expect(fieldById(frame, `sentence-${String(index)}-checksum`)?.valid, `cümle ${String(index)}`).toBe(
        true,
      );
    }
  });

  it('82 karakter sınırı CÜMLEYE aittir — 568 baytlık datagram uyarı ÜRETMEZ', () => {
    const frame = frameOf(iec61162Parser.parse(exampleBytes('multi-sentence-navd')));
    expect(warningCodes(frame)).not.toContain('sentenceExceedsNmeaLimit');
    expect(warningCodes(frame)).not.toContain('datagramExceedsStandardLimit');
  });
});

describe('iec-61162 · `c:` zaman damgası ölçeği ÇIKARIMDIR', () => {
  const withTimestamp = (value: string, checksum: string): string =>
    `UdPbC${NUL}\\s:IN0001,c:${value}*${checksum}\\$HEROT,+000.05,A*35\r\n`;

  function tagChecksum(coverage: string): string {
    let checksum = 0;
    for (let index = 0; index < coverage.length; index += 1) checksum ^= coverage.charCodeAt(index);
    return checksum.toString(16).toUpperCase().padStart(2, '0');
  }

  it('13 hane → milisaniye + `timestampScaleInferred`, ve BİRİM YOK', () => {
    const coverage = 's:IN0001,c:1683881316755';
    const frame = frameOf(parse(withTimestamp('1683881316755', tagChecksum(coverage))));
    const field = fieldById(frame, 'tag-1-1-c');
    expect(field?.physicalValue).toBe('2023-05-12T08:48:36.755Z (inferred scale: ms)');
    // Çıkarılmış ölçek bir ölçüm DEĞİLDİR: `unit` yazılmaz (types.ts:46).
    expect(field?.unit).toBeUndefined();
    expect(field?.warnings).toContain('protocol.iec61162.field.timestampScaleInferred');
    expect(warningCodes(frame)).toContain('timestampScaleInferred');
  });

  it('10 hane → saniye + aynı uyarı', () => {
    const coverage = 's:IN0001,c:1241544035';
    const frame = frameOf(parse(withTimestamp('1241544035', tagChecksum(coverage))));
    expect(fieldById(frame, 'tag-1-1-c')?.physicalValue).toBe(
      '2009-05-05T17:20:35.000Z (inferred scale: s)',
    );
    expect(warningCodes(frame)).toContain('timestampScaleInferred');
  });

  it('ne 10 ne 13 hane ise HİÇBİR ölçek iddia edilmez', () => {
    const coverage = 's:IN0001,c:12345';
    const frame = frameOf(parse(withTimestamp('12345', tagChecksum(coverage))));
    expect(fieldById(frame, 'tag-1-1-c')?.physicalValue).toBeUndefined();
    expect(warningCodes(frame)).toContain('timestampScaleUnknown');
  });

  it('`timestampScale` elle zorlanınca ÇIKARIM uyarısı düşmez', () => {
    const coverage = 's:IN0001,c:12345';
    const frame = frameOf(
      parse(withTimestamp('12345', tagChecksum(coverage)), { timestampScale: 'seconds' }),
    );
    expect(String(fieldById(frame, 'tag-1-1-c')?.physicalValue)).toContain('(scale set by user)');
    expect(warningCodes(frame)).not.toContain('timestampScaleInferred');
    expect(warningCodes(frame)).not.toContain('timestampScaleUnknown');
  });
});

describe('iec-61162 · `g:` CÜMLE gruplaması, transmission group DEĞİL', () => {
  it('`g:` alanı sentence/total/group üçlüsünü çözer', () => {
    const coverage = 'g:1-2-73874,s:AI0001';
    let checksum = 0;
    for (let index = 0; index < coverage.length; index += 1) checksum ^= coverage.charCodeAt(index);
    const hex = checksum.toString(16).toUpperCase().padStart(2, '0');
    const frame = frameOf(
      parse(`UdPbC${NUL}\\${coverage}*${hex}\\!AIVDM,1,1,,B,15N4,0*33\r\n`),
    );
    expect(fieldById(frame, 'tag-1-1-g')?.physicalValue).toBe('sentence 1 of 2 · group 73874');
    // `g:` basılmış olması transmission group alanının basıldığı anlamına GELMEZ.
    expect(fieldById(frame, 'transmission-group')).toBeUndefined();
  });

  it('`!` ile başlayan kapsülleme cümlesi KABUL EDİLİR ve işaretlenir', () => {
    const coverage = 'g:1-2-73874,s:AI0001';
    let checksum = 0;
    for (let index = 0; index < coverage.length; index += 1) checksum ^= coverage.charCodeAt(index);
    const hex = checksum.toString(16).toUpperCase().padStart(2, '0');
    const frame = frameOf(parse(`UdPbC${NUL}\\${coverage}*${hex}\\!AIVDM,1,1,,B,15N4,0*33\r\n`));
    expect(fieldById(frame, 'sentence-1-delimiter')?.physicalValue).toBe('Encapsulation sentence');
    expect(warningCodes(frame)).toContain('encapsulationSentence');
  });
});

describe('iec-61162 · transmission group ÇERÇEVEDE YOK', () => {
  it('varsayılanda grup alanı HİÇ BASILMAZ, yalnız nerede olduğu söylenir', () => {
    const frame = frameOf(parse(SINGLE_SENTENCE));
    expect(fieldById(frame, 'transmission-group')).toBeUndefined();
    expect(fieldById(frame, 'transmission-group-talkers')).toBeUndefined();
    expect(warningCodes(frame)).toContain('transmissionGroupUnknown');
    expect(warningCodes(frame)).not.toContain('groupFromUserNotWire');
  });

  it('seçilince grup basılır ve KOŞULSUZ `groupFromUserNotWire` uyarısı düşer', () => {
    const frame = frameOf(parse(SINGLE_SENTENCE, { transmissionGroup: 'SATD' }));
    const group = fieldById(frame, 'transmission-group');
    expect(group?.rawValue).toBe('SATD');
    expect(group?.physicalValue).toBe('239.192.0.3:60003');
    // Bayt karşılığı YOK: sıfır uzunluk, boş `rawBytes`.
    expect(group?.length).toBe(0);
    expect(group?.rawBytes).toHaveLength(0);
    expect(group?.warnings).toContain('protocol.iec61162.field.groupFromUserNotWire');
    expect(warningCodes(frame)).toContain('groupFromUserNotWire');
    expect(fieldById(frame, 'transmission-group-talkers')?.physicalValue).toBe('HE, HN, TI');
  });

  it('kullanıcının grubu telin talker’larıyla ÇELİŞİRSE uyarılır', () => {
    // Cümlenin talker'ı `HE` — SATD grubunda VAR, TIME grubunda YOK.
    expect(warningCodes(frameOf(parse(SINGLE_SENTENCE, { transmissionGroup: 'SATD' })))).not.toContain(
      'groupTalkerMismatch',
    );
    expect(warningCodes(frameOf(parse(SINGLE_SENTENCE, { transmissionGroup: 'TIME' })))).toContain(
      'groupTalkerMismatch',
    );
  });
});

describe('iec-61162 · `requireTagBlock`', () => {
  const noTagBlock = `UdPbC${NUL}$HEROT,+000.05,A*35\r\n`;

  it('varsayılan katı mod TAG bloğu olmayan datagramı reddeder', () => {
    const result = parse(noTagBlock);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.message).toContain('missingTagBlock');
  });

  it('kapatılınca çözüm SÜRER ve cümle tam çözülür', () => {
    const frame = frameOf(parse(noTagBlock, { requireTagBlock: 'false' }));
    expect(frame.valid).toBe(true);
    expect(fieldById(frame, 'sentence-1-checksum')?.valid).toBe(true);
    expect(warningCodes(frame)).toContain('tagBlockMissing');
    expect(warningCodes(frame)).toContain('sourceParameterMissing');
  });
});

describe('iec-61162 · `sentenceDecoding`', () => {
  const gga =
    `UdPbC${NUL}\\s:GP0001*4A\\$GPGGA,123519,4807.038,N,01131.000,E,1,08,0.9,545.4,M,46.9,M,,*47\r\n`;

  it('varsayılan `envelope-only`: cümle TEK ham alan olarak basılır', () => {
    const frame = frameOf(parse(gga));
    expect(fieldById(frame, 'sentence-1-body')?.rawValue).toContain('$GPGGA,123519');
    expect(fieldById(frame, 'sentence-1-latitude')).toBeUndefined();
    expect(warningCodes(frame)).toContain('sentenceEnvelopeOnly');
  });

  it('`full`: `decodeSentenceFields` alanları ÖNEKLİ olarak gelir', () => {
    const frame = frameOf(parse(gga, { sentenceDecoding: 'full' }));
    expect(fieldById(frame, 'sentence-1-body')).toBeUndefined();
    expect(fieldById(frame, 'sentence-1-latitude')?.physicalValue).toBe(48.1173);
    expect(warningCodes(frame)).not.toContain('sentenceEnvelopeOnly');
    // Önek olmasaydı çoklu cümlede id çakışırdı — bu testin asıl sebebi budur.
    const ids = frame.fields.map((field) => field.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('`full` modda sekiz cümlelik datagramda bile id’ler BENZERSİZ kalır', () => {
    const frame = frameOf(
      iec61162Parser.parse(exampleBytes('multi-sentence-navd'), {
        options: { sentenceDecoding: 'full' },
      }),
    );
    const ids = frame.fields.map((field) => field.id);
    expect(new Set(ids).size, `çakışan id: ${ids.join(', ')}`).toBe(ids.length);
  });
});

describe('iec-61162 · yönlendirme profilleri', () => {
  it('`61162-1` seçilince ÇERÇEVE ÇÖZÜLMEZ, yönlendirme tablosu basılır', () => {
    const result = parse(SINGLE_SENTENCE, { transportProfile: '61162-1' });
    const frame = frameOf(result);
    expect(result.consumedBytes).toBe(0);
    expect(fieldById(frame, 'magic-token')).toBeUndefined();
    expect(fieldById(frame, 'sentence-1-checksum')).toBeUndefined();
    expect(warningCodes(frame)).toEqual(['frameNotDecodedInRoutingProfile']);

    const values = frame.fields.map((field) => String(field.physicalValue));
    expect(values).toContain('marine-navigation/nmea-family/nmea-0183');
    expect(values).toContain('4800 bit/s (configurable in Ed. 6)');
    // Yönlendirme satırları bayta karşılık gelmez ve BİRİM taşımaz.
    expect(frame.fields.every((field) => field.length === 0)).toBe(true);
    expect(frame.fields.every((field) => field.unit === undefined)).toBe(true);
  });

  it('`61162-2` 38400 bit/s ve "veri biçimi maddesi silindi" notunu basar', () => {
    const frame = frameOf(parse(SINGLE_SENTENCE, { transportProfile: '61162-2' }));
    const values = frame.fields.map((field) => String(field.physicalValue));
    expect(values).toContain('38400 bit/s');
    expect(values.join(' ')).toContain('has been removed as this information is given in IEC 61162-1');
  });

  it('`61162-3` NMEA 2000’e, `61162-460` bu sayfaya yönlendirir', () => {
    const three = frameOf(parse(SINGLE_SENTENCE, { transportProfile: '61162-3' }));
    expect(three.fields.map((field) => String(field.physicalValue))).toContain(
      'marine-navigation/nmea-family/nmea-2000',
    );

    const fourSixty = frameOf(parse(SINGLE_SENTENCE, { transportProfile: '61162-460' }));
    expect(fourSixty.fields.map((field) => String(field.physicalValue)).join(' ')).toContain(
      'It does not introduce new application level protocol requirements',
    );
  });

  it('`canParse` seçenekten ETKİLENMEZ — her zaman `UdPbC` önekine bakar', () => {
    // `ProtocolParser` sözleşmesinde `canParse` `decodeOptions` almaz.
    expect(iec61162Parser.canParse(bytes(SINGLE_SENTENCE))).toBe(true);
  });
});

describe('iec-61162 · datagram sınırı ve sonlandırıcı', () => {
  it('1472 baytı aşan datagram UYARI basar, HATA değil', () => {
    const filler = 'x'.repeat(1500);
    const coverage = `s:IN0001,t:${filler}`;
    let checksum = 0;
    for (let index = 0; index < coverage.length; index += 1) checksum ^= coverage.charCodeAt(index);
    const hex = checksum.toString(16).toUpperCase().padStart(2, '0');
    const frame = frameOf(parse(`UdPbC${NUL}\\${coverage}*${hex}\\$HEROT,+000.05,A*35\r\n`));

    expect(warningCodes(frame)).toContain('datagramExceedsStandardLimit');
    expect(frame.errors.map((error) => error.code)).not.toContain('frame-too-long');
    // Sınır seçenekle yükseltilince uyarı KALKAR.
    const relaxed = frameOf(
      parse(`UdPbC${NUL}\\${coverage}*${hex}\\$HEROT,+000.05,A*35\r\n`, {
        maxDatagramBytes: 65507,
      }),
    );
    expect(warningCodes(relaxed)).not.toContain('datagramExceedsStandardLimit');
  });

  it('80 baytlık TAG bloğu sınırı aşılınca alan ve uyarı basılır', () => {
    const filler = 'x'.repeat(1000);
    const coverage = `s:IN0001,t:${filler}`;
    let checksum = 0;
    for (let index = 0; index < coverage.length; index += 1) checksum ^= coverage.charCodeAt(index);
    const hex = checksum.toString(16).toUpperCase().padStart(2, '0');
    const frame = frameOf(parse(`UdPbC${NUL}\\${coverage}*${hex}\\$HEROT,+000.05,A*35\r\n`));
    expect(warningCodes(frame)).toContain('tagBlockExceedsMaxLength');
    expect(fieldById(frame, 'tag-1-1-length')?.valid).toBe(false);
  });

  it('CRLF yoksa varsayılanda UYARI, katı modda HATA', () => {
    const noCrlf = `UdPbC${NUL}\\s:HE0001*45\\$HEROT,+000.05,A*35`;
    const permissive = frameOf(parse(noCrlf));
    expect(permissive.valid).toBe(true);
    expect(warningCodes(permissive)).toContain('missingTerminator');

    const strict = frameOf(parse(noCrlf, { strictTerminator: 'true' }));
    expect(strict.valid).toBe(false);
    expect(strict.errors.map((error) => error.message)).toContain(
      'protocol.iec61162.error.missingTerminator',
    );
  });

  it('kapanmamış TAG bloğu hata verir', () => {
    const result = parse(`UdPbC${NUL}\\s:HE0001*45`);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.message).toContain('unterminatedTagBlock');
  });
});

describe('iec-61162 · sözlük dışı ve çözülmeyen parametreler', () => {
  function withCoverage(coverage: string): string {
    let checksum = 0;
    for (let index = 0; index < coverage.length; index += 1) checksum ^= coverage.charCodeAt(index);
    const hex = checksum.toString(16).toUpperCase().padStart(2, '0');
    return `UdPbC${NUL}\\${coverage}*${hex}\\$HEROT,+000.05,A*35\r\n`;
  }

  it('`a:` TANINIR ama içeriği ÇÖZÜLMEZ — kripto yüzeyi açılmaz', () => {
    const frame = frameOf(parse(withCoverage('s:HE0001,a:ZZZZ')));
    const field = fieldById(frame, 'tag-1-1-a');
    expect(field?.name).toBe('TAG 1.1 · a: Authentication');
    expect(field?.rawValue).toBe('ZZZZ');
    expect(field?.physicalValue).toBeUndefined();
    expect(field?.warnings).toContain('protocol.iec61162.field.authNotDecoded');
    expect(warningCodes(frame)).toContain('authTagNotDecoded');
  });

  it('sözlükte olmayan harf HAM basılır, anlamı UYDURULMAZ', () => {
    const frame = frameOf(parse(withCoverage('s:HE0001,q:7')));
    expect(fieldById(frame, 'tag-1-1-q')?.name).toBe('TAG 1.1 · q: Unknown Parameter');
    expect(fieldById(frame, 'tag-1-1-q')?.physicalValue).toBeUndefined();
    expect(warningCodes(frame)).toContain('unknownTagParameter');
  });
});

describe('iec-61162 · eklenti sözleşmesi', () => {
  it('`build` sekmesi yok → `encoder` YAZILMAZ', () => {
    expect(iec61162Plugin.encoder).toBeUndefined();
  });

  it('yedi `decodeOptions` kanalı bildirir', () => {
    expect(iec61162Plugin.decodeOptions?.map((option) => option.id)).toEqual([
      'transportProfile',
      'transmissionGroup',
      'sentenceDecoding',
      'requireTagBlock',
      'strictTerminator',
      'timestampScale',
      'maxDatagramBytes',
    ]);
  });

  it('her örnek `expectedValid` sözünü tutar', () => {
    for (const example of iec61162Plugin.exampleFrames) {
      const result = iec61162Parser.parse(example.bytes);
      const valid = isParseSuccess(result) && result.frame.valid;
      expect(valid, example.id).toBe(example.expectedValid ?? true);
    }
  });

  it('iptal sinyali gelirse çözüm başlamaz', () => {
    const controller = new AbortController();
    controller.abort();
    const result = iec61162Parser.parse(bytes(SINGLE_SENTENCE), { signal: controller.signal });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe('parser-timeout');
  });
});
