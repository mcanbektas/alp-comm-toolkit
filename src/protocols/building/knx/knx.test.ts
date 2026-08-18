import { describe, expect, it } from 'vitest';

import { knxParser, knxPlugin, parseKnx } from './knx';
import type {
  ParseFailure,
  ParseResult,
  ParseSuccess,
  ParsedField,
  ParsedFrame,
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
  const found = frame.fields.find((field) => field.id === id);
  if (found === undefined) {
    throw new Error(`field "${id}" not found; got ${frame.fields.map((f) => f.id).join(', ')}`);
  }
  return found;
}

function warningCodes(frame: ParsedFrame): string[] {
  return frame.warnings.map((warning) => warning.code);
}

// ── Testin kendi bağımsız yardımcıları — motorun (knx.ts) fonksiyonlarını
// ÇAĞIRMAZ, aynı formülleri sıfırdan yeniden yazar (lin.test.ts'in
// `computeExpectedClassicChecksum` deseni, brief "motordan bağımsız ikinci
// hesap" şartı). ────────────────────────────────────────────────────────────

/** Testin kendi bağımsız checksum hesaplaması — terslenmiş (NOT) XOR. */
function computeExpectedKnxChecksum(bytes: readonly number[]): number {
  let xor = 0;
  for (const byte of bytes) {
    xor ^= byte;
  }
  return ~xor & 0xff;
}

function individualRaw(area: number, line: number, device: number): number {
  return ((area & 0xf) << 12) | ((line & 0xf) << 8) | (device & 0xff);
}

function groupRaw(main: number, middle: number, sub: number): number {
  return ((main & 0x1f) << 11) | ((middle & 0x7) << 8) | (sub & 0xff);
}

function hiByte(value: number): number {
  return (value >> 8) & 0xff;
}

function loByte(value: number): number {
  return value & 0xff;
}

interface BuildFrameOptions {
  controlByte?: number;
  frameType?: 0 | 1;
  repeat?: 0 | 1;
  priority?: 0 | 1 | 2 | 3;
  srcRaw: number;
  dstRaw: number;
  addressType: 0 | 1;
  hopCount?: number;
  tpdu: readonly number[];
  corruptChecksum?: boolean;
}

/** Testin kendi bağımsız çerçeve kurucusu — motorun bit maskelerini paylaşmaz. */
function buildStandardFrame(options: BuildFrameOptions): Uint8Array {
  const ctrl =
    options.controlByte ??
    (((options.frameType ?? 1) << 7) |
      ((options.repeat ?? 1) << 5) |
      (1 << 4) |
      ((options.priority ?? 3) << 2));
  const length = options.tpdu.length - 1;
  const npci =
    ((options.addressType & 1) << 7) | (((options.hopCount ?? 6) & 0x7) << 4) | (length & 0xf);
  const body = [
    ctrl,
    hiByte(options.srcRaw),
    loByte(options.srcRaw),
    hiByte(options.dstRaw),
    loByte(options.dstRaw),
    npci,
    ...options.tpdu,
  ];
  const checksum = computeExpectedKnxChecksum(body);
  const finalChecksum = options.corruptChecksum === true ? (checksum ^ 0xff) & 0xff : checksum;
  return Uint8Array.from([...body, finalChecksum]);
}

const SRC_1_1_10 = individualRaw(1, 1, 10);

describe('parseKnx — Control Field', () => {
  it('bit7=1 → Standard, bit7=0 → Extended', () => {
    const standard = expectSuccess(
      parseKnx(buildStandardFrame({ srcRaw: SRC_1_1_10, dstRaw: groupRaw(2, 1, 5), addressType: 1, tpdu: [0x00, 0x81] })),
    ).frame;
    expect(fieldById(standard, 'frameType').physicalValue).toBe('Standard');

    const extendedBytes = Uint8Array.from([0x3c, 0x11, 0x0a, 0x11, 0x05, 0xe1, 0x00, 0x81, 0x2c]);
    const extended = expectSuccess(parseKnx(extendedBytes)).frame;
    expect(fieldById(extended, 'frameType').physicalValue).toBe('Extended');
  });

  it('Repeat biti: 1=Not Repeated, 0=Repeated', () => {
    const notRepeated = expectSuccess(
      parseKnx(
        buildStandardFrame({ repeat: 1, srcRaw: SRC_1_1_10, dstRaw: groupRaw(2, 1, 5), addressType: 1, tpdu: [0x00, 0x81] }),
      ),
    ).frame;
    expect(fieldById(notRepeated, 'repeat').physicalValue).toBe('Not Repeated');

    const repeated = expectSuccess(
      parseKnx(
        buildStandardFrame({ repeat: 0, srcRaw: SRC_1_1_10, dstRaw: groupRaw(2, 1, 5), addressType: 1, tpdu: [0x00, 0x81] }),
      ),
    ).frame;
    expect(fieldById(repeated, 'repeat').physicalValue).toBe('Repeated');
  });

  it('Priority dar ad kümesi: 00=System, 01=High, 10=Alarm, 11=Low', () => {
    const names = ['System', 'High', 'Alarm', 'Low'] as const;
    for (const [bits, name] of names.entries()) {
      const frame = expectSuccess(
        parseKnx(
          buildStandardFrame({
            priority: bits as 0 | 1 | 2 | 3,
            srcRaw: SRC_1_1_10,
            dstRaw: groupRaw(2, 1, 5),
            addressType: 1,
            tpdu: [0x00, 0x81],
          }),
        ),
      ).frame;
      expect(fieldById(frame, 'priority').physicalValue, `bits=${String(bits)}`).toBe(name);
    }
  });

  it('sabit/reserved bit deseni bozulursa (Calimero (ctrl&0x53)!=0x10) uyarı basar ama çözmeye devam eder', () => {
    // 0xBC (geçerli) | 0x40 (bit6 set) = 0xFC — bit6 sabiti bozuluyor.
    const frame = expectSuccess(
      parseKnx(
        buildStandardFrame({
          controlByte: 0xfc,
          srcRaw: SRC_1_1_10,
          dstRaw: groupRaw(2, 1, 5),
          addressType: 1,
          tpdu: [0x00, 0x81],
        }),
      ),
    ).frame;
    expect(warningCodes(frame)).toContain('protocol.knx.warning.unexpectedReservedBits');
    expect(frame.valid).toBe(true);
  });
});

describe('parseKnx — Extended frame (Karar 5, kapsam dışı)', () => {
  it('gövdeyi ham gösterir, "kapsam dışı" uyarısı basar, HATA değildir', () => {
    const extendedBytes = Uint8Array.from([0x3c, 0x11, 0x0a, 0x11, 0x05, 0xe1, 0x00, 0x81, 0x2c]);
    const { frame, consumedBytes } = expectSuccess(parseKnx(extendedBytes));
    const body = fieldById(frame, 'extendedBody');
    expect(body.offset).toBe(1);
    expect(body.rawBytes).toEqual(extendedBytes.slice(1));
    expect(warningCodes(frame)).toContain('protocol.knx.warning.extendedFrameOutOfScope');
    expect(frame.valid).toBe(true);
    expect(frame.errors).toEqual([]);
    expect(consumedBytes).toBe(extendedBytes.length);
    // Extended yolda Control Field ALT alanları (frameType/repeat/priority)
    // yine üretilir ama adres/NPCI/APCI/checksum alanları YOKTUR.
    expect(frame.fields.map((f) => f.id)).toEqual(['frameType', 'repeat', 'priority', 'extendedBody']);
  });
});

describe('parseKnx — adres formatlama (AT bitine göre İKİ AYRI formatter)', () => {
  it('Source her zaman Individual (Area.Line.Device) formatındadır', () => {
    const frame = expectSuccess(
      parseKnx(
        buildStandardFrame({ srcRaw: individualRaw(1, 1, 10), dstRaw: groupRaw(2, 1, 5), addressType: 1, tpdu: [0x00, 0x81] }),
      ),
    ).frame;
    expect(fieldById(frame, 'sourceAddress').physicalValue).toBe('1.1.10');
  });

  it('AT=1 → Destination Group formatında (X/Y/Z)', () => {
    const frame = expectSuccess(
      parseKnx(
        buildStandardFrame({ srcRaw: SRC_1_1_10, dstRaw: groupRaw(2, 1, 5), addressType: 1, tpdu: [0x00, 0x81] }),
      ),
    ).frame;
    expect(fieldById(frame, 'destinationAddress').physicalValue).toBe('2/1/5');
    expect(fieldById(frame, 'addressType').physicalValue).toBe('Group');
  });

  it('AT=0 → Destination Individual formatında (X.Y.Z), Group formatıyla KARIŞMAZ', () => {
    const frame = expectSuccess(
      parseKnx(
        buildStandardFrame({ srcRaw: SRC_1_1_10, dstRaw: individualRaw(4, 2, 100), addressType: 0, tpdu: [0x00, 0x80] }),
      ),
    ).frame;
    expect(fieldById(frame, 'destinationAddress').physicalValue).toBe('4.2.100');
    expect(fieldById(frame, 'addressType').physicalValue).toBe('Individual');
  });

  it('Group Address 0 → System Broadcast notu eklenir (ozet07)', () => {
    const frame = expectSuccess(
      parseKnx(
        buildStandardFrame({ srcRaw: SRC_1_1_10, dstRaw: groupRaw(0, 0, 0), addressType: 1, tpdu: [0x00, 0x80] }),
      ),
    ).frame;
    expect(fieldById(frame, 'destinationAddress').physicalValue).toBe('0/0/0 (System Broadcast)');
  });
});

describe('parseKnx — NPCI (AT/HopCount/Length, off-by-one)', () => {
  it('Hop Count 3 biti doğru okunur', () => {
    const frame = expectSuccess(
      parseKnx(
        buildStandardFrame({
          hopCount: 5,
          srcRaw: SRC_1_1_10,
          dstRaw: groupRaw(2, 1, 5),
          addressType: 1,
          tpdu: [0x00, 0x81],
        }),
      ),
    ).frame;
    expect(fieldById(frame, 'hopCount').rawValue).toBe(5);
  });

  it('Length nibble OFF-BY-ONE: gerçek TPCI/APCI+data bayt sayısı = Length + 1', () => {
    // 4 baytlık TPCI/APCI+data (2 APCI + 2 appended payload) → Length nibble = 3.
    const frame = expectSuccess(
      parseKnx(
        buildStandardFrame({
          srcRaw: SRC_1_1_10,
          dstRaw: groupRaw(3, 2, 10),
          addressType: 1,
          tpdu: [0x00, 0x40, 0x00, 0x64],
        }),
      ),
    ).frame;
    const lengthField = fieldById(frame, 'length');
    expect(lengthField.rawValue).toBe(3);
    expect(lengthField.physicalValue).toBe('4 bytes (TPCI/APCI + data)');
  });
});

describe('parseKnx — APCI dar ad kümesi (GroupValueRead/Write/Response)', () => {
  it('APCI 0b00 → GroupValueRead', () => {
    const frame = expectSuccess(
      parseKnx(buildStandardFrame({ srcRaw: SRC_1_1_10, dstRaw: groupRaw(2, 1, 6), addressType: 1, tpdu: [0x00, 0x00] })),
    ).frame;
    expect(fieldById(frame, 'apciService').physicalValue).toBe('GroupValueRead');
  });

  it('APCI 0b01 → GroupValueResponse', () => {
    const frame = expectSuccess(
      parseKnx(
        buildStandardFrame({ srcRaw: SRC_1_1_10, dstRaw: groupRaw(3, 2, 10), addressType: 1, tpdu: [0x00, 0x40, 0x00, 0x64] }),
      ),
    ).frame;
    expect(fieldById(frame, 'apciService').physicalValue).toBe('GroupValueResponse');
  });

  it('APCI 0b10 → GroupValueWrite', () => {
    const frame = expectSuccess(
      parseKnx(buildStandardFrame({ srcRaw: SRC_1_1_10, dstRaw: groupRaw(2, 1, 5), addressType: 1, tpdu: [0x00, 0x81] })),
    ).frame;
    expect(fieldById(frame, 'apciService').physicalValue).toBe('GroupValueWrite');
  });

  it('dar kümenin dışındaki APCI kodu (0b11) ham + uyarı basar, ad UYDURULMAZ', () => {
    const frame = expectSuccess(
      parseKnx(buildStandardFrame({ srcRaw: SRC_1_1_10, dstRaw: groupRaw(4, 3, 20), addressType: 1, tpdu: [0x00, 0xc0] })),
    ).frame;
    const apci = fieldById(frame, 'apciService');
    expect(apci.physicalValue).toBeUndefined();
    expect(apci.valid).toBe(false);
    expect(warningCodes(frame)).toContain('protocol.knx.warning.unrecognizedApci');
    // Uyarı hata değildir: çerçeve yapısal olarak yine geçerli sayılır.
    expect(frame.valid).toBe(true);
    expect(frame.errors).toEqual([]);
  });

  it('TPCI sıfır değilse (bağlantı-yönelimli servis) APCI adlandırılmaz — düşük bitler tesadüfen 00 desenine uysa bile', () => {
    // byte6=0x40 → TPCI bits7-6=01 (nonzero), apciHigh bits1-0=00; byte7=0x00.
    // apci4bit mekanik olarak 0 (Read'e benzer) hesaplanır ama TPCI!=0 olduğu
    // için tanınmaz.
    const dst = groupRaw(2, 1, 6);
    const npci = (1 << 7) | (6 << 4) | 1;
    const body = [0xbc, hiByte(SRC_1_1_10), loByte(SRC_1_1_10), hiByte(dst), loByte(dst), npci, 0x40, 0x00];
    const checksum = computeExpectedKnxChecksum(body);
    const frame = expectSuccess(parseKnx(Uint8Array.from([...body, checksum]))).frame;
    const apci = fieldById(frame, 'apciService');
    expect(apci.valid).toBe(false);
    expect(warningCodes(frame)).toContain('protocol.knx.warning.unrecognizedApci');
  });

  it('NPCI Length yapısal asgarinin (TPCI/APCI>=2 bayt) altındaysa APCI/Payload çözülmez, ham + uyarı basar', () => {
    // Length nibble = 0 → apduLength = 1 (yapısal olarak APCI için yetersiz).
    const dst = groupRaw(2, 1, 5);
    const npci = (1 << 7) | (6 << 4) | 0; // Length=0
    const body = [0xbc, hiByte(SRC_1_1_10), loByte(SRC_1_1_10), hiByte(dst), loByte(dst), npci, 0x00];
    const checksum = computeExpectedKnxChecksum(body);
    const frame = expectSuccess(parseKnx(Uint8Array.from([...body, checksum]))).frame;
    const apci = fieldById(frame, 'apciService');
    expect(apci.valid).toBe(false);
    expect(apci.length).toBe(1);
    expect(frame.fields.find((f) => f.id === 'payload')).toBeUndefined();
    expect(warningCodes(frame)).toContain('protocol.knx.warning.unrecognizedApci');
  });
});

describe('parseKnx — Payload (DPT bilinmez, ham)', () => {
  it('inline 6-bit değer (<=6 bit veri, ayrı bayt yok) ham + "DPT unknown" gösterir', () => {
    const frame = expectSuccess(
      parseKnx(buildStandardFrame({ srcRaw: SRC_1_1_10, dstRaw: groupRaw(2, 1, 5), addressType: 1, tpdu: [0x00, 0x81] })),
    ).frame;
    const payload = fieldById(frame, 'payload');
    expect(payload.rawValue).toBe(1);
    expect(payload.physicalValue).toBe('raw 6-bit: 1 (DPT unknown, engineering meaning not resolved)');
  });

  it('appended 2 baytlık değer katalog örneğiyle (00 64 → raw uint16: 100) birebir eşleşir', () => {
    const frame = expectSuccess(
      parseKnx(
        buildStandardFrame({ srcRaw: SRC_1_1_10, dstRaw: groupRaw(3, 2, 10), addressType: 1, tpdu: [0x00, 0x40, 0x00, 0x64] }),
      ),
    ).frame;
    const payload = fieldById(frame, 'payload');
    expect(payload.rawValue).toBe(100n);
    expect(payload.physicalValue).toBe('raw uint16: 100 (DPT unknown, engineering meaning not resolved)');
  });
});

describe('parseKnx — checksum (terslenmiş XOR, motordan bağımsız ikinci hesap)', () => {
  it('geçerli çerçevede hesaplanan checksum motorun checksum alanıyla eşleşir', () => {
    const bytes = buildStandardFrame({ srcRaw: SRC_1_1_10, dstRaw: groupRaw(2, 1, 5), addressType: 1, tpdu: [0x00, 0x81] });
    const region = Array.from(bytes.slice(0, bytes.length - 1));
    const expected = computeExpectedKnxChecksum(region);

    const frame = expectSuccess(parseKnx(bytes)).frame;
    const checksum = fieldById(frame, 'checksum');
    expect(checksum.rawValue).toBe(expected);
    expect(checksum.valid).toBe(true);
    expect(frame.valid).toBe(true);
  });

  it('checksum, düz (terslenmemiş) XOR ile DOĞRUDAN karşılaştırılamaz — terslemek şarttır', () => {
    const bytes = buildStandardFrame({ srcRaw: SRC_1_1_10, dstRaw: groupRaw(2, 1, 5), addressType: 1, tpdu: [0x00, 0x81] });
    const region = Array.from(bytes.slice(0, bytes.length - 1));
    let plainXor = 0;
    for (const byte of region) plainXor ^= byte;
    const received = bytes[bytes.length - 1];

    expect(received).not.toBe(plainXor);
    expect(received).toBe((~plainXor) & 0xff);
  });

  it('bozuk checksum checksum-mismatch hatası basar, çerçeve invalid olur', () => {
    const bytes = buildStandardFrame({
      srcRaw: SRC_1_1_10,
      dstRaw: groupRaw(2, 1, 5),
      addressType: 1,
      tpdu: [0x00, 0x81],
      corruptChecksum: true,
    });
    const frame = expectSuccess(parseKnx(bytes)).frame;
    expect(fieldById(frame, 'checksum').valid).toBe(false);
    expect(frame.valid).toBe(false);
    expect(frame.errors[0]?.code).toBe('checksum-mismatch');
  });
});

describe('parseKnx — hata yolları', () => {
  it('boş tamponda truncated-frame döner', () => {
    expect(expectFailure(parseKnx(new Uint8Array(0))).error.code).toBe('truncated-frame');
  });

  it('6 baytlık başlıktan kısa standart çerçevede truncated-frame döner', () => {
    expect(expectFailure(parseKnx(Uint8Array.from([0xbc, 0x11, 0x0a]))).error.code).toBe('truncated-frame');
  });

  it('NPCI Length ilan ettiği kadar bayt yoksa truncated-frame döner', () => {
    // Length=3 → 4 baytlık APDU bekler ama yalnız 2 bayt + checksum verilir.
    const dst = groupRaw(3, 2, 10);
    const npci = (1 << 7) | (6 << 4) | 3;
    const short = Uint8Array.from([0xbc, hiByte(SRC_1_1_10), loByte(SRC_1_1_10), hiByte(dst), loByte(dst), npci, 0x00, 0x40, 0x00]);
    expect(expectFailure(parseKnx(short)).error.code).toBe('truncated-frame');
  });

  it('context.maxFrameLength verilip aşılırsa frame-too-long döner', () => {
    const bytes = buildStandardFrame({ srcRaw: SRC_1_1_10, dstRaw: groupRaw(2, 1, 5), addressType: 1, tpdu: [0x00, 0x81] });
    const result = knxParser.parse(bytes, { maxFrameLength: 4 });
    expect(expectFailure(result).error.code).toBe('frame-too-long');
  });

  it('iptal edilmiş signal’da parser-timeout döner', () => {
    const controller = new AbortController();
    controller.abort();
    const bytes = buildStandardFrame({ srcRaw: SRC_1_1_10, dstRaw: groupRaw(2, 1, 5), addressType: 1, tpdu: [0x00, 0x81] });
    const result = expectFailure(knxParser.parse(bytes, { signal: controller.signal }));
    expect(result.error.code).toBe('parser-timeout');
  });
});

describe('knxParser.canParse', () => {
  it('yalnız uzunluk penceresini denetler (1..23 bayt)', () => {
    expect(knxParser.canParse(Uint8Array.from([0xbc]))).toBe(true);
    expect(
      knxParser.canParse(buildStandardFrame({ srcRaw: SRC_1_1_10, dstRaw: groupRaw(2, 1, 5), addressType: 1, tpdu: [0x00, 0x81] })),
    ).toBe(true);
    expect(knxParser.canParse(new Uint8Array(0))).toBe(false);
    expect(knxParser.canParse(new Uint8Array(24))).toBe(false);
  });
});

describe('knxPlugin', () => {
  it('katalogdaki kimlik, kategori ve parser bağını taşır', () => {
    expect(knxPlugin.id).toBe('knx');
    expect(knxPlugin.category).toBe('building-automation');
    expect(knxPlugin.parser).toBe(knxParser);
  });

  it('her örnek gerçek parser’dan geçer ve expectedValid ile eşleşir', () => {
    for (const example of knxPlugin.exampleFrames) {
      const result = knxParser.parse(example.bytes);
      expect(result.success, `${example.id} unexpectedly failed to parse`).toBe(true);
      if (result.success) {
        expect(result.frame.valid, example.id).toBe(example.expectedValid ?? true);
      }
    }
  });

  it('her örnek adı/açıklaması protocol.knx.example. önekli çeviri anahtarıdır', () => {
    for (const example of knxPlugin.exampleFrames) {
      expect(example.name.startsWith('protocol.knx.example.'), example.id).toBe(true);
      expect(example.description?.startsWith('protocol.knx.example.'), example.id).toBe(true);
    }
  });

  it('örnekler brief madde 14’ün senaryolarını kapsar', () => {
    const ids = knxPlugin.exampleFrames.map((example) => example.id);
    expect(ids).toContain('group-value-write');
    expect(ids).toContain('group-value-read');
    expect(ids).toContain('group-value-response');
    expect(ids).toContain('individual-address-destination');
    expect(ids).toContain('extended-frame');
    expect(ids).toContain('checksum-mismatch');
    expect(ids).toContain('unrecognized-apci');
    expect(ids.length).toBe(7);
  });

  it('group-value-write örneği: dest 2/1/5, GroupValueWrite, inline değer 1', () => {
    const example = knxPlugin.exampleFrames.find((e) => e.id === 'group-value-write');
    expect(example).toBeDefined();
    const frame = expectSuccess(knxParser.parse(example?.bytes ?? new Uint8Array())).frame;
    expect(fieldById(frame, 'destinationAddress').physicalValue).toBe('2/1/5');
    expect(fieldById(frame, 'apciService').physicalValue).toBe('GroupValueWrite');
    expect(fieldById(frame, 'payload').rawValue).toBe(1);
  });

  it('checksum-mismatch örneği group-value-write ile AYNI gövdeyi taşır, yalnız son bayt farklıdır', () => {
    const write = knxPlugin.exampleFrames.find((e) => e.id === 'group-value-write');
    const mismatch = knxPlugin.exampleFrames.find((e) => e.id === 'checksum-mismatch');
    expect(write).toBeDefined();
    expect(mismatch).toBeDefined();
    if (write === undefined || mismatch === undefined) return;
    expect(mismatch.bytes.slice(0, -1)).toEqual(write.bytes.slice(0, -1));
    expect(mismatch.bytes[mismatch.bytes.length - 1]).not.toBe(write.bytes[write.bytes.length - 1]);
  });
});
