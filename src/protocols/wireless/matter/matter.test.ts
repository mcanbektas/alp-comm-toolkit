import { describe, expect, it } from 'vitest';

import { matterParser, matterPlugin, parseMatter } from './matter';
import type { ParseFailure, ParseResult, ParseSuccess, ParsedField, ParsedFrame } from '@/protocol-core/types';

function expectSuccess(result: ParseResult): ParseSuccess {
  if (!result.success) {
    throw new Error(`expected success, got error "${result.error.code}"`);
  }
  return result;
}

function expectFailure(result: ParseResult): ParseFailure {
  if (result.success) {
    throw new Error('expected failure, got a parsed frame');
  }
  return result;
}

function fieldById(frame: ParsedFrame, id: string): ParsedField {
  const found = frame.fields.find((field) => field.id === id);
  if (found === undefined) {
    throw new Error(`field "${id}" not found; got ${frame.fields.map((f) => f.id).join(', ')}`);
  }
  return found;
}

function warningCodes(frame: ParsedFrame): string[] {
  return frame.warnings.map((warning) => warning.code);
}

/** Fixture'ların hepsi dış kaynaktan (spec Appendix A.12 tabloları / SDK TestTLV.cpp) — matter.ts dosya başı. */
function hex(text: string): Uint8Array {
  return Uint8Array.from(text.trim().split(/\s+/).map((part) => Number.parseInt(part, 16)));
}

describe('plugin kaydı', () => {
  it('kimlik/kategori/parser bağı katalogla eşleşir', () => {
    expect(matterPlugin.id).toBe('matter');
    expect(matterPlugin.category).toBe('wireless-iot');
    expect(matterPlugin.parser?.protocolId).toBe('matter');
    expect(matterPlugin.exampleFrames.length).toBeGreaterThan(0);
  });

  it('her örnek çerçeve çözülür ve expectedValid ile eşleşir', () => {
    for (const example of matterPlugin.exampleFrames) {
      const result = matterParser.parse(example.bytes);
      if (!result.success) {
        throw new Error(`example "${example.id}" failed: ${result.error.code}`);
      }
      expect(result.frame.valid, `example "${example.id}"`).toBe(example.expectedValid ?? true);
    }
  });

  it('her örnek adı/açıklaması protocol.matter. önekli çeviri anahtarıdır', () => {
    for (const example of matterPlugin.exampleFrames) {
      expect(example.name.startsWith('protocol.matter.'), example.id).toBe(true);
    }
  });
});

describe('ağaç düzleştirme', () => {
  it('Structure {0 = 42, 1 = −17}: container + iki üye, container aralığı TAMAMINI kapsar', () => {
    const bytes = hex('15 20 00 2a 20 01 ef 18');
    const frame = expectSuccess(parseMatter(bytes)).frame;

    expect(frame.fields).toHaveLength(3);
    const container = fieldById(frame, 'tlv-0');
    expect(container.name).toContain('Structure');
    expect(container.offset).toBe(0);
    // Açılıştan EŞLEŞEN end-of-container'ın sonuna kadar (dosya başı).
    expect(container.length).toBe(8);
    expect(container.rawBytes).toEqual(bytes);

    const first = fieldById(frame, 'tlv-1');
    expect(first.name).toContain('ctx:0');
    expect(first.physicalValue).toBe('42');
    const second = fieldById(frame, 'tlv-2');
    expect(second.name).toContain('ctx:1');
    expect(second.physicalValue).toBe('-17');
  });

  it('derinlik AD İÇİNDE girintiyle gösterilir', () => {
    const frame = expectSuccess(parseMatter(hex('15 20 00 2a 20 01 ef 18'))).frame;
    expect(fieldById(frame, 'tlv-0').name.startsWith('··')).toBe(false);
    expect(fieldById(frame, 'tlv-1').name.startsWith('··')).toBe(true);
  });

  it('end-of-container AYRI satır olarak basılmaz', () => {
    const frame = expectSuccess(parseMatter(hex('15 18'))).frame;
    expect(frame.fields).toHaveLength(1);
    expect(frame.fields[0]?.name).toContain('Structure');
    expect(frame.fields[0]?.length).toBe(2);
  });

  it('iç içe container: karışık tipli Array (spec Tablo 106)', () => {
    const bytes = hex('16 00 2a 02 f0 67 fd ff 15 18 0a 33 33 8f 41 0c 06 48 65 6c 6c 6f 21 18');
    const frame = expectSuccess(parseMatter(bytes)).frame;

    expect(fieldById(frame, 'tlv-0').name).toContain('Array');
    expect(fieldById(frame, 'tlv-1').physicalValue).toBe('42');
    expect(fieldById(frame, 'tlv-2').physicalValue).toBe('-170000');
    expect(fieldById(frame, 'tlv-3').name).toContain('Structure');
    expect(fieldById(frame, 'tlv-4').physicalValue).toBe('17.899999618530273');
    expect(fieldById(frame, 'tlv-5').physicalValue).toBe('"Hello!"');
    expect(frame.valid).toBe(true);
  });

  it('ofsetler HAM çerçeveye göre mutlaktır (byte-viewer drill-down şartı)', () => {
    const bytes = hex('15 20 00 2a 20 01 ef 18');
    const frame = expectSuccess(parseMatter(bytes)).frame;
    expect(fieldById(frame, 'tlv-1').offset).toBe(1);
    expect(fieldById(frame, 'tlv-2').offset).toBe(4);
  });
});

describe('tag biçimleri', () => {
  it('fully-qualified tag vendor::profile:tag olarak gösterilir', () => {
    const frame = expectSuccess(parseMatter(hex('d5 f1 ff ed de 01 00 c4 f1 ff ed de 55 aa 2a 18'))).frame;
    expect(fieldById(frame, 'tlv-0').name).toContain('0xFFF1::0xDEED:1');
    expect(fieldById(frame, 'tlv-1').name).toContain('0xFFF1::0xDEED:43605');
  });

  it('implicit profile tag çözülmez, uyarı basar (walker karar 8)', () => {
    const frame = expectSuccess(parseMatter(hex('88 02 00'))).frame;
    expect(fieldById(frame, 'tlv-0').name).toContain('implicit:2');
    expect(warningCodes(frame)).toContain('protocol.matter.warning.implicitProfileUnresolved');
  });

  it('anonim tag "anon" olarak gösterilir', () => {
    const frame = expectSuccess(parseMatter(hex('04 2a'))).frame;
    expect(fieldById(frame, 'tlv-0').name).toContain('anon');
  });
});

describe('SDK vektörü — gerçek Matter mesaj payload’ı', () => {
  it('53 baytlık Identify Response tam çözülür', () => {
    const bytes = hex(`
      d5 00 00 0e 00 01 00 25 00 5a 23 24 01 07 24 02
      05 25 03 22 1e 2c 04 10 30 34 41 41 30 31 41 43
      32 33 31 34 30 30 4c 50 2c 09 06 31 2e 34 72 63
      35 24 0c 01 18
    `);
    const frame = expectSuccess(parseMatter(bytes)).frame;
    expect(frame.valid).toBe(true);
    expect(frame.errors).toEqual([]);

    // Kök Structure + 7 üye.
    expect(frame.fields).toHaveLength(8);
    expect(fieldById(frame, 'tlv-0').length).toBe(53);
    expect(fieldById(frame, 'tlv-1').physicalValue).toBe('9050');
    expect(fieldById(frame, 'tlv-5').physicalValue).toBe('"04AA01AC231400LP"');
    expect(fieldById(frame, 'tlv-6').physicalValue).toBe('"1.4rc5"');
  });
});

describe('tag kuralı ihlalleri — HATA DEĞİL uyarı', () => {
  it('Array üyesi anonim değilse uyarır ama çözümleme sürer', () => {
    // Tablo 106'nın Array örneğinin üyesine context tag eklenmiş hâli.
    const frame = expectSuccess(parseMatter(hex('16 20 00 2a 18'))).frame;
    expect(frame.valid).toBe(true);
    expect(warningCodes(frame)).toContain('protocol.matter.warning.nonAnonymousTagInArray');
    expect(fieldById(frame, 'tlv-1').physicalValue).toBe('42');
  });

  it('Structure üyesi anonimse uyarır', () => {
    const frame = expectSuccess(parseMatter(hex('15 00 2a 18'))).frame;
    expect(frame.valid).toBe(true);
    expect(warningCodes(frame)).toContain('protocol.matter.warning.anonymousTagInStructure');
  });

  it('en dış seviyede context tag uyarır', () => {
    const frame = expectSuccess(parseMatter(hex('24 01 2a'))).frame;
    expect(frame.valid).toBe(true);
    expect(warningCodes(frame)).toContain('protocol.matter.warning.contextTagAtTopLevel');
  });

  it('List karışık tag’leri UYARMADAN kabul eder (spec A.5.3)', () => {
    const frame = expectSuccess(parseMatter(hex('17 00 01 20 00 2a 00 02 00 03 20 00 ef 18'))).frame;
    expect(frame.valid).toBe(true);
    expect(warningCodes(frame)).toEqual([]);
  });
});

describe('hata yolları', () => {
  it('boş girdi reddedilir', () => {
    const result = expectFailure(matterParser.parse(new Uint8Array()));
    expect(result.error.code).toBe('truncated-frame');
    expect(result.recoverable).toBe(true);
  });

  it('kapanmamış container hata basar (EOC spec’te ZORUNLU)', () => {
    const frame = expectSuccess(parseMatter(hex('15 20 00 2a 20 01 ef'))).frame;
    expect(frame.valid).toBe(false);
    expect(frame.errors.map((error) => error.message)).toContain('protocol.matter.error.unclosedContainer');
    // Kısmi sonuç YİNE basılır: kök + iki üye görünür.
    expect(frame.fields.length).toBeGreaterThanOrEqual(3);
  });

  it('beklenmedik end-of-container hata basar', () => {
    const frame = expectSuccess(parseMatter(hex('04 2a 18'))).frame;
    expect(frame.valid).toBe(false);
    expect(frame.errors.map((error) => error.message)).toContain(
      'protocol.matter.error.unexpectedEndOfContainer',
    );
  });

  it('kesik string gövdesi value-out-of-range basar, kısmi sonuç kalır', () => {
    const frame = expectSuccess(parseMatter(hex('0c 06 48 65'))).frame;
    expect(frame.valid).toBe(false);
    expect(frame.errors[0]?.code).toBe('value-out-of-range');
  });

  it('reserved eleman tipi unsupported-encoding basar', () => {
    const frame = expectSuccess(parseMatter(Uint8Array.from([0x1f]))).frame;
    expect(frame.valid).toBe(false);
    expect(frame.errors[0]?.code).toBe('unsupported-encoding');
    expect(frame.errors[0]?.message).toBe('protocol.matter.error.reservedElementType');
  });

  it('tag taşıyan end-of-container reddedilir', () => {
    const frame = expectSuccess(parseMatter(hex('38 00'))).frame;
    expect(frame.valid).toBe(false);
    expect(frame.errors[0]?.message).toBe('protocol.matter.error.taggedEndOfContainer');
  });

  it('maxFrameLength aşımı frame-too-long ile reddedilir', () => {
    const result = expectFailure(matterParser.parse(hex('15 20 00 2a 20 01 ef 18'), { maxFrameLength: 4 }));
    expect(result.error.code).toBe('frame-too-long');
  });

  it('iptal edilmiş sinyal parser-timeout ile reddedilir', () => {
    const controller = new AbortController();
    controller.abort();
    const result = expectFailure(matterParser.parse(hex('15 18'), { signal: controller.signal }));
    expect(result.error.code).toBe('parser-timeout');
  });
});

describe('tavanlar (dosya başı: uzunluksuz container sınırsız derinlik tarif edebilir)', () => {
  it('azami derinliği aşan girdi durur ve UYARIR (sessizce kesilmez)', () => {
    // 20 iç içe Structure açılışı — MAX_DEPTH 16.
    const frame = expectSuccess(parseMatter(new Uint8Array(20).fill(0x15))).frame;
    expect(warningCodes(frame)).toContain('protocol.matter.warning.maxDepthReached');
  });

  it('azami eleman sayısını aşan girdi durur ve UYARIR', () => {
    // 600 anonim Null elemanı — MAX_ELEMENTS 512.
    const frame = expectSuccess(parseMatter(new Uint8Array(600).fill(0x14))).frame;
    expect(warningCodes(frame)).toContain('protocol.matter.warning.maxElementsReached');
    expect(frame.fields).toHaveLength(512);
  });
});

describe('canParse', () => {
  it('geçerli bir kontrol baytı için true döner', () => {
    expect(matterParser.canParse(hex('15 18'))).toBe(true);
  });

  it('boş veri için false döner', () => {
    expect(matterParser.canParse(new Uint8Array())).toBe(false);
  });

  it('reserved eleman tipi için false döner', () => {
    expect(matterParser.canParse(Uint8Array.from([0x1f]))).toBe(false);
  });
});
