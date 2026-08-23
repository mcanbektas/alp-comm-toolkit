import { describe, expect, it } from 'vitest';

import { cipParser, cipPlugin, parseCip } from './cip';
import { decodeCipEpath, decodeCipMessage } from './cipCore';
import type {
  ParseFailure,
  ParseResult,
  ParseSuccess,
  ParsedField,
  ParsedFrame,
  ProtocolError,
  ProtocolWarning,
} from '@/protocol-core/types';

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
  return fieldIn(frame.fields, id);
}

/**
 * `cipCore.ts`in fonksiyonları tam bir `ParsedFrame` DEĞİL, doğrudan bir
 * `fields` dizisi üretir (iec104Asdu.ts/decodeAsdu ile aynı desen) — bu
 * yüzden ayrı bir arama yardımcısı, sahte bir `ParsedFrame` uydurmak yerine.
 */
function fieldIn(fields: readonly ParsedField[], id: string): ParsedField {
  const found = fields.find((field) => field.id === id);
  if (found === undefined) {
    throw new Error(`field "${id}" not found; got ${fields.map((f) => f.id).join(', ')}`);
  }
  return found;
}

describe('decodeCipEpath — 8-bit lojik segmentler (PAD baytı YOK)', () => {
  it('Class/Instance/Attribute segmentlerini ayrı ayrı çözer', () => {
    const fields: ParsedField[] = [];
    const warnings: ProtocolWarning[] = [];
    // 20 04 24 01 30 03 → Class=4(Assembly), Instance=1, Attribute=3.
    const bytes = Uint8Array.from([0x20, 0x04, 0x24, 0x01, 0x30, 0x03]);
    const summary = decodeCipEpath(bytes, 0, bytes.length, fields, warnings, '');

    expect(summary.classId).toBe(4);
    expect(summary.instanceId).toBe(1);
    expect(summary.attributeId).toBe(3);
    expect(summary.consumedBytes).toBe(6);
    expect(summary.stoppedAtUnsupportedSegment).toBe(false);
    expect(fieldIn(fields, 'class').physicalValue).toBe('Assembly');
    expect(fieldIn(fields, 'instance').offset).toBe(2);
    expect(fieldIn(fields, 'attribute').offset).toBe(4);
    expect(warnings).toEqual([]);
  });

  it('Member ve Connection Point alt tiplerini de ayırt eder', () => {
    const fields: ParsedField[] = [];
    const warnings: ProtocolWarning[] = [];
    // 20 04 2C 65 28 02 → Class=4, Connection Point=0x65, Member=2.
    const bytes = Uint8Array.from([0x20, 0x04, 0x2c, 0x65, 0x28, 0x02]);
    const summary = decodeCipEpath(bytes, 0, bytes.length, fields, warnings, '');
    expect(summary.connectionPoint).toBe(0x65);
    expect(summary.memberId).toBe(2);
  });
});

describe('decodeCipEpath — 16/32-bit PAD baytı tuzağı', () => {
  it('16-bit Class segmentinde PAD baytını atlar, değeri doğru okur', () => {
    const fields: ParsedField[] = [];
    const warnings: ProtocolWarning[] = [];
    // 21 00 04 00 24 01 → Class(16-bit)=0x0004 (byte2 PAD, byte3-4 değer LE), Instance(8-bit)=1.
    const bytes = Uint8Array.from([0x21, 0x00, 0x04, 0x00, 0x24, 0x01]);
    const summary = decodeCipEpath(bytes, 0, bytes.length, fields, warnings, '');

    expect(summary.classId).toBe(4);
    // PAD atlanmasaydı Instance segmenti 1 bayt kayardı ve offset 4 DEĞİL 5 olurdu.
    expect(fieldIn(fields, 'instance').offset).toBe(4);
    expect(fieldIn(fields, 'instance').rawValue).toBe(1);
    expect(summary.consumedBytes).toBe(6);
  });

  it('32-bit Instance segmentinde 4 baytlık değeri PAD’dan sonra okur', () => {
    const fields: ParsedField[] = [];
    const warnings: ProtocolWarning[] = [];
    // 20 01 26 00 00 01 00 00 → Class(8bit)=1, Instance(32-bit)=0x00000100=256.
    const bytes = Uint8Array.from([0x20, 0x01, 0x26, 0x00, 0x00, 0x01, 0x00, 0x00]);
    const summary = decodeCipEpath(bytes, 0, bytes.length, fields, warnings, '');
    expect(summary.instanceId).toBe(256);
    expect(summary.consumedBytes).toBe(8);
  });
});

describe('decodeCipEpath — Port/Symbolic gibi tanınmayan segmentler', () => {
  it('Port Segment ile karşılaşınca kalan path’i ham blok olarak basar ve durur', () => {
    const fields: ParsedField[] = [];
    const warnings: ProtocolWarning[] = [];
    // 20 01 | 00 01 (Port Segment, port=1, link address=1) — ikinci segment çözülmez.
    const bytes = Uint8Array.from([0x20, 0x01, 0x00, 0x01]);
    const summary = decodeCipEpath(bytes, 0, bytes.length, fields, warnings, '');

    expect(summary.classId).toBe(1);
    expect(summary.stoppedAtUnsupportedSegment).toBe(true);
    expect(summary.consumedBytes).toBe(4);
    expect(fieldIn(fields, 'extended-path').rawBytes).toEqual(
      Uint8Array.from([0x00, 0x01]),
    );
    expect(warnings.map((w) => w.code)).toContain('protocol.cip.warning.extendedPathNotDecoded');
  });
});

describe('decodeCipMessage — istek', () => {
  it('Service + Path Size + EPATH + Request Data çözer', () => {
    const fields: ParsedField[] = [];
    const warnings: ProtocolWarning[] = [];
    const errors: ProtocolError[] = [];
    // Set_Attribute_Single(0x10), Path Size=2 word, Class=4/Instance=1, Data=[0xAA,0xBB].
    const bytes = Uint8Array.from([0x10, 0x02, 0x20, 0x04, 0x24, 0x01, 0xaa, 0xbb]);
    const summary = decodeCipMessage(bytes, 0, bytes.length, fields, warnings, errors, '');

    expect(summary.isResponse).toBe(false);
    expect(summary.serviceName).toBe('Set_Attribute_Single');
    expect(summary.path?.classId).toBe(4);
    expect(summary.path?.instanceId).toBe(1);
    expect(fieldIn(fields, 'request-data').rawBytes).toEqual(
      Uint8Array.from([0xaa, 0xbb]),
    );
    expect(errors).toEqual([]);
  });

  it('adlandırılmamış servis kodunda uyarır ama GEÇERLİ sayar', () => {
    const fields: ParsedField[] = [];
    const warnings: ProtocolWarning[] = [];
    const errors: ProtocolError[] = [];
    const bytes = Uint8Array.from([0x4b, 0x00]);
    const summary = decodeCipMessage(bytes, 0, bytes.length, fields, warnings, errors, '');
    expect(summary.serviceName).toBeUndefined();
    expect(fieldIn(fields, 'service').valid).toBe(true);
    expect(warnings.map((w) => w.code)).toContain('protocol.cip.warning.unknownService');
  });
});

describe('decodeCipMessage — yanıt', () => {
  it('bit 7 set’i Reply Service olarak tanır, Additional Status Size’ı WORD olarak yorumlar', () => {
    const fields: ParsedField[] = [];
    const warnings: ProtocolWarning[] = [];
    const errors: ProtocolError[] = [];
    // Reply=0x8E, Reserved=0, Status=0x14(Attribute not supported), AddlSize=1 WORD → 2 bayt ek durum.
    const bytes = Uint8Array.from([0x8e, 0x00, 0x14, 0x01, 0xde, 0xad]);
    const summary = decodeCipMessage(bytes, 0, bytes.length, fields, warnings, errors, '');

    expect(summary.isResponse).toBe(true);
    expect(summary.serviceName).toBe('Get_Attribute_Single');
    expect(summary.generalStatusName).toBe('Attribute not supported');
    const addlSizeField = fieldIn(fields, 'additional-status-size');
    expect(addlSizeField.rawValue).toBe(1);
    // TUZAK: fiziksel değer BAYT sayısıdır (1 WORD × 2), ham değer WORD sayısıdır.
    expect(addlSizeField.physicalValue).toBe(2);
    expect(fieldIn(fields, 'additional-status').rawBytes).toEqual(
      Uint8Array.from([0xde, 0xad]),
    );
  });

  it('Reserved bayt sıfır değilse uyarır', () => {
    const fields: ParsedField[] = [];
    const warnings: ProtocolWarning[] = [];
    const errors: ProtocolError[] = [];
    const bytes = Uint8Array.from([0x8e, 0x01, 0x00, 0x00]);
    decodeCipMessage(bytes, 0, bytes.length, fields, warnings, errors, '');
    expect(warnings.map((w) => w.code)).toContain('protocol.cip.warning.reservedByteNonzero');
  });

  it('gövde eksikse truncated-frame hatası basar', () => {
    const fields: ParsedField[] = [];
    const warnings: ProtocolWarning[] = [];
    const errors: ProtocolError[] = [];
    const bytes = Uint8Array.from([0x8e, 0x00]);
    decodeCipMessage(bytes, 0, bytes.length, fields, warnings, errors, '');
    expect(errors.some((e) => e.code === 'truncated-frame')).toBe(true);
  });
});

describe('parseCip / cipParser', () => {
  it('istek ve yanıt çerçevelerini ayırt eder', () => {
    const request = expectSuccess(parseCip(Uint8Array.from([0x0e, 0x02, 0x20, 0x01, 0x24, 0x01])));
    expect(fieldById(request.frame, 'service').physicalValue).toBe('Get_Attribute_Single');

    const response = expectSuccess(
      parseCip(Uint8Array.from([0x8e, 0x00, 0x00, 0x00, 0x01, 0x00])),
    );
    expect(fieldById(response.frame, 'reply-service').physicalValue).toBe(
      'Get_Attribute_Single (Reply)',
    );
  });

  it('kısa girdide truncated-frame, uzun girdide frame-too-long döner', () => {
    expect(expectFailure(parseCip(new Uint8Array(1))).error.code).toBe('truncated-frame');
    expect(expectFailure(parseCip(new Uint8Array(513))).error.code).toBe('frame-too-long');
  });

  it('iptal edilmiş signal’da parser-timeout döner', () => {
    const controller = new AbortController();
    controller.abort();
    const result = expectFailure(
      cipParser.parse(Uint8Array.from([0x0e, 0x00]), { signal: controller.signal }),
    );
    expect(result.error.code).toBe('parser-timeout');
  });
});

describe('cipPlugin', () => {
  it('katalogdaki kimlik, kategori ve parser bağını taşır', () => {
    expect(cipPlugin.id).toBe('cip');
    expect(cipPlugin.category).toBe('industrial-automation');
    expect(cipPlugin.parser).toBe(cipParser);
  });

  it('her örnek çözülür ve expectedValid ile eşleşir', () => {
    for (const example of cipPlugin.exampleFrames) {
      const result = cipParser.parse(example.bytes);
      if (!result.success) {
        throw new Error(`example "${example.id}" failed: ${result.error.code}`);
      }
      expect(result.frame.valid, `example "${example.id}"`).toBe(example.expectedValid ?? true);
    }
  });

  it('her örnek adı/açıklaması protocol.cip.example. önekli çeviri anahtarıdır', () => {
    for (const example of cipPlugin.exampleFrames) {
      expect(example.name.startsWith('protocol.cip.example.'), example.id).toBe(true);
      expect(example.description?.startsWith('protocol.cip.example.'), example.id).toBe(true);
    }
  });

  it('PAD baytı örneği (16-bit Class) beklenen Class/Instance değerlerini üretir', () => {
    const example = cipPlugin.exampleFrames.find(
      (candidate) => candidate.id === 'get-attribute-all-request-16bit-class',
    );
    if (example === undefined) throw new Error('example not found');
    const { frame } = expectSuccess(cipParser.parse(example.bytes));
    expect(fieldById(frame, 'path-class').rawValue).toBe(4);
    expect(fieldById(frame, 'path-instance').rawValue).toBe(1);
  });
});
