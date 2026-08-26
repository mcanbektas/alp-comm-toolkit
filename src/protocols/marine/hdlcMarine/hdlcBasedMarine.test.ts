import { describe, expect, it } from 'vitest';

import { computeNamedCrc } from '@/protocol-core/checksums/crcCatalogue';
import { encodeHdlcFlagFrame } from '@/protocol-core/framing/hdlcFraming';
import { HDLC_SYNC_FLAG, encodeHdlcSyncFrame } from '../../serial/framing/hdlcCore';
import { hdlcBasedMarineParser, hdlcBasedMarinePlugin } from './hdlcBasedMarine';
import type { ParseFailure, ParseResult, ParseSuccess, ParsedField, ParsedFrame } from '@/protocol-core/types';

function expectSuccess(result: ParseResult): ParseSuccess {
  if (!result.success) {
    throw new Error(`expected success, got error "${result.error.code}"`);
  }
  return result;
}

function expectFailure(result: ParseResult): ParseFailure {
  if (result.success) {
    throw new Error('expected failure, got success');
  }
  return result;
}

function fieldById(frame: ParsedFrame, id: string): ParsedField {
  const field = frame.fields.find((candidate) => candidate.id === id);
  if (field === undefined) {
    throw new Error(`field "${id}" not found among [${frame.fields.map((f) => f.id).join(', ')}]`);
  }
  return field;
}

function hasField(frame: ParsedFrame, id: string): boolean {
  return frame.fields.some((field) => field.id === id);
}

function toLittleEndianCrc16Bytes(coveredBytes: Uint8Array): [number, number] {
  const crc = Number(computeNamedCrc(coveredBytes, 'CRC16_X25'));
  return [crc & 0xff, (crc >>> 8) & 0xff];
}

describe('hdlcBasedMarineParser — spec §05 örneği (candidate alanlar, varsayılan seçenekler)', () => {
  it('Flag/Address/Control/Information/FCS candidate olarak çözülür, FCS PASS', () => {
    // 05-denizcilik.md:270 — "7E 12 03 18 04 20 10 33 88 XX XX 7E".
    const wire = encodeHdlcSyncFrame(Uint8Array.from([0x12, 0x03, 0x18, 0x04, 0x20, 0x10, 0x33, 0x88]));
    const frame = expectSuccess(hdlcBasedMarineParser.parse(wire)).frame;

    expect(fieldById(frame, 'address').name).toBe('Address (candidate)');
    expect(fieldById(frame, 'address').rawValue).toBe('0x12');
    expect(fieldById(frame, 'control').name).toBe('Control (candidate)');
    expect(fieldById(frame, 'control').rawValue).toBe('0x03');
    // Varsayılan profil raw-candidate — I/S/U çözümü YAPILMAZ.
    expect(fieldById(frame, 'control').physicalValue).toBeUndefined();
    expect(hasField(frame, 'send-sequence-number')).toBe(false);
    expect(fieldById(frame, 'information').name).toBe('Information');
    expect(fieldById(frame, 'information').rawValue).toBe('18 04 20 10 33 88');
    expect(fieldById(frame, 'fcs').name).toBe('FCS (candidate)');
    expect(fieldById(frame, 'fcs').valid).toBe(true);
    expect(frame.valid).toBe(true);
    expect(frame.protocol).toBe('hdlc-based-marine');
    expect(frame.warnings.some((w) => w.code === 'protocol.hdlcBasedMarine.warning.controlFieldNotInterpreted')).toBe(
      true,
    );
  });

  it('bozuk FCS: frame.valid=false, fcs FAIL, ama alanlar YİNE çözülür (nmea0183/modbusRtu deseni)', () => {
    const goodWire = encodeHdlcSyncFrame(Uint8Array.from([0x12, 0x03, 0x18, 0x04, 0x20, 0x10, 0x33, 0x88]));
    const corrupted = Uint8Array.from(goodWire);
    corrupted[corrupted.length - 3] = (corrupted[corrupted.length - 3] ?? 0) ^ 0xff;

    const frame = expectSuccess(hdlcBasedMarineParser.parse(corrupted)).frame;
    expect(frame.valid).toBe(false);
    expect(fieldById(frame, 'fcs').valid).toBe(false);
    expect(frame.errors.map((e) => e.code)).toContain('crc-mismatch');
    // Alanlar hâlâ tam:
    expect(fieldById(frame, 'address').rawValue).toBe('0x12');
    expect(fieldById(frame, 'information').rawValue).toBe('18 04 20 10 33 88');
  });
});

describe('hdlcBasedMarineParser — hata yolları', () => {
  it('boş girdide truncated-frame döner', () => {
    expect(expectFailure(hdlcBasedMarineParser.parse(new Uint8Array(0))).error.code).toBe('truncated-frame');
  });

  it('delimiter hiç gelmeyen girdide truncated-frame döner', () => {
    expect(expectFailure(hdlcBasedMarineParser.parse(Uint8Array.from([0x01, 0x02, 0x03]))).error.code).toBe(
      'truncated-frame',
    );
  });

  it('seçilen alan genişlikleriyle uyumlu asgari uzunluktan kısa içerikte truncated-frame döner', () => {
    const wire = Uint8Array.from([HDLC_SYNC_FLAG, 0x01, HDLC_SYNC_FLAG]);
    expect(expectFailure(hdlcBasedMarineParser.parse(wire)).error.code).toBe('truncated-frame');
  });

  it('iptal edilmiş signal ile parser-timeout döner', () => {
    const controller = new AbortController();
    controller.abort();
    const result = hdlcBasedMarineParser.parse(Uint8Array.from([HDLC_SYNC_FLAG]), { signal: controller.signal });
    expect(expectFailure(result).error.code).toBe('parser-timeout');
  });

  it('canParse DAİMA false döner — boş ve dolu girdide, kendi örneklerinde', () => {
    expect(hdlcBasedMarineParser.canParse(new Uint8Array(0))).toBe(false);
    expect(hdlcBasedMarineParser.canParse(Uint8Array.from([0x7e, 0x01, 0x02, 0x7e]))).toBe(false);
    for (const example of hdlcBasedMarinePlugin.exampleFrames) {
      expect(hdlcBasedMarineParser.canParse(example.bytes), example.id).toBe(false);
    }
  });
});

describe('hdlcBasedMarineParser — decodeOptions: fcsProfile', () => {
  it("crc32-iso-hdlc: 4 baytlık FCS, CRC32 ile PASS", () => {
    const logical = Uint8Array.from([0x12, 0x03, 0x18, 0x04]);
    const crc = Number(computeNamedCrc(logical, 'CRC32'));
    const wire = new Uint8Array(logical.length + 6);
    wire[0] = HDLC_SYNC_FLAG;
    wire.set(logical, 1);
    const base = 1 + logical.length;
    wire[base] = crc & 0xff;
    wire[base + 1] = (crc >>> 8) & 0xff;
    wire[base + 2] = (crc >>> 16) & 0xff;
    wire[base + 3] = (crc >>> 24) & 0xff;
    wire[base + 4] = HDLC_SYNC_FLAG;

    const frame = expectSuccess(
      hdlcBasedMarineParser.parse(wire, { options: { fcsProfile: 'crc32-iso-hdlc' } }),
    ).frame;
    expect(fieldById(frame, 'fcs').length).toBe(4);
    expect(fieldById(frame, 'fcs').valid).toBe(true);
    expect(frame.valid).toBe(true);
  });

  it("none: FCS alanı hiç basılmaz, frame koşulsuz valid", () => {
    const wire = Uint8Array.from([HDLC_SYNC_FLAG, 0x12, 0x03, 0xaa, 0xbb, HDLC_SYNC_FLAG]);
    const frame = expectSuccess(hdlcBasedMarineParser.parse(wire, { options: { fcsProfile: 'none' } })).frame;
    expect(hasField(frame, 'fcs')).toBe(false);
    expect(fieldById(frame, 'information').rawValue).toBe('AA BB');
    expect(frame.valid).toBe(true);
  });
});

describe('hdlcBasedMarineParser — decodeOptions: fcsByteOrder', () => {
  it('big-endian: ters bayt sırası doğru okunur, varsayılan (little-endian) yorumuyla FAIL verir', () => {
    const logical = Uint8Array.from([0x12, 0x03, 0xaa, 0xbb]);
    const [lo, hi] = toLittleEndianCrc16Bytes(logical);
    const beWire = Uint8Array.from([HDLC_SYNC_FLAG, ...logical, hi, lo, HDLC_SYNC_FLAG]);

    const beFrame = expectSuccess(
      hdlcBasedMarineParser.parse(beWire, { options: { fcsByteOrder: 'big-endian' } }),
    ).frame;
    expect(beFrame.valid).toBe(true);

    const defaultFrame = expectSuccess(hdlcBasedMarineParser.parse(beWire)).frame;
    expect(defaultFrame.valid).toBe(false);
  });
});

describe('hdlcBasedMarineParser — decodeOptions: addressFieldBytes / controlFieldBytes', () => {
  it('0 + 0 (AIS/M.1371-6 düzeni): Address ve Control alanları HİÇ basılmaz', () => {
    const info = Uint8Array.from([0x01, 0x02, 0x03, 0x04]);
    const wire = encodeHdlcSyncFrame(info);

    const frame = expectSuccess(
      hdlcBasedMarineParser.parse(wire, { options: { addressFieldBytes: '0', controlFieldBytes: '0' } }),
    ).frame;
    expect(hasField(frame, 'address')).toBe(false);
    expect(hasField(frame, 'control')).toBe(false);
    expect(fieldById(frame, 'information').rawValue).toBe('01 02 03 04');
    expect(frame.valid).toBe(true);
  });

  it('addressFieldBytes 2: iki baytlık candidate adres tek alanda gösterilir', () => {
    const wire = encodeHdlcSyncFrame(Uint8Array.from([0x11, 0x22, 0x03, 0xaa, 0xbb]));
    const frame = expectSuccess(
      hdlcBasedMarineParser.parse(wire, { options: { addressFieldBytes: '2' } }),
    ).frame;
    expect(fieldById(frame, 'address').rawValue).toBe('11 22');
    expect(fieldById(frame, 'address').length).toBe(2);
    expect(fieldById(frame, 'control').rawValue).toBe('0x03');
    expect(fieldById(frame, 'information').rawValue).toBe('AA BB');
  });

  it('controlFieldBytes 2 + U-OLMAYAN ilk bayt: control 2 bayt alır (packet-xdlc.h düzeni)', () => {
    const wire = encodeHdlcSyncFrame(Uint8Array.from([0x01, 0x02, 0x55, 0xaa, 0xbb]));
    const frame = expectSuccess(
      hdlcBasedMarineParser.parse(wire, { options: { controlFieldBytes: '2' } }),
    ).frame;
    expect(fieldById(frame, 'control').length).toBe(2);
    expect(fieldById(frame, 'control').rawValue).toBe('02 55');
    expect(fieldById(frame, 'information').rawValue).toBe('AA BB');
  });

  it('controlFieldBytes 2 + U-frame ilk bayt: istisna uygulanır, control 1 bayt KALIR', () => {
    // Control=0x03 → U-format (packet-xdlc.h: XDLC_S_U_MASK=0x03, XDLC_U=0x03).
    const wire = encodeHdlcSyncFrame(Uint8Array.from([0x01, 0x03, 0xaa, 0xbb]));
    const frame = expectSuccess(
      hdlcBasedMarineParser.parse(wire, { options: { controlFieldBytes: '2' } }),
    ).frame;
    expect(fieldById(frame, 'control').length).toBe(1);
    // İstisna uygulanmasaydı 0xAA control'e kayar, information yalnız 'BB' kalırdı.
    expect(fieldById(frame, 'information').rawValue).toBe('AA BB');
  });
});

describe('hdlcBasedMarineParser — decodeOptions: controlFieldProfile', () => {
  it("raw-candidate (varsayılan): tek ham alan, I/S/U basılmaz, controlFieldNotInterpreted uyarısı", () => {
    const wire = encodeHdlcSyncFrame(Uint8Array.from([0x01, 0x42, 0xaa, 0xbb]));
    const frame = expectSuccess(hdlcBasedMarineParser.parse(wire)).frame;
    expect(fieldById(frame, 'control').rawValue).toBe('0x42');
    expect(hasField(frame, 'poll-final')).toBe(false);
    expect(hasField(frame, 'send-sequence-number')).toBe(false);
    expect(
      frame.warnings.some((w) => w.code === 'protocol.hdlcBasedMarine.warning.controlFieldNotInterpreted'),
    ).toBe(true);
  });

  it('iso-13239-modulo8: I-format N(S)/N(R) candidate alanlarıyla basılır', () => {
    // Address=0x01, Control=0x42 → I-format, N(S)=1, N(R)=2, P/F=0 (hdlc.ts örneğiyle aynı bayt deseni).
    const wire = encodeHdlcSyncFrame(Uint8Array.from([0x01, 0x42, 0xaa, 0xbb]));
    const frame = expectSuccess(
      hdlcBasedMarineParser.parse(wire, { options: { controlFieldProfile: 'iso-13239-modulo8' } }),
    ).frame;
    expect(fieldById(frame, 'control').physicalValue).toBe('I-format');
    expect(fieldById(frame, 'send-sequence-number').name).toBe('Send Sequence Number N(S) (candidate)');
    expect(fieldById(frame, 'send-sequence-number').rawValue).toBe(1);
    expect(fieldById(frame, 'receive-sequence-number').rawValue).toBe(2);
    expect(hasField(frame, 'supervisory-type')).toBe(false);
  });

  it('iso-13239-modulo8 + controlFieldBytes 2 (U-olmayan): ikinci bayt candidate ham kalır, warn basılır', () => {
    const wire = encodeHdlcSyncFrame(Uint8Array.from([0x01, 0x02, 0x55, 0xaa]));
    const frame = expectSuccess(
      hdlcBasedMarineParser.parse(wire, {
        options: { controlFieldProfile: 'iso-13239-modulo8', controlFieldBytes: '2' },
      }),
    ).frame;
    expect(fieldById(frame, 'control-extended').rawValue).toBe('0x55');
    expect(
      frame.warnings.some((w) => w.code === 'protocol.hdlcBasedMarine.warning.extendedControlNotInterpreted'),
    ).toBe(true);
  });
});

describe('hdlcBasedMarineParser — decodeOptions: escaping', () => {
  it('rfc1662-octet-stuffed: kaçış çözülür, asyncEscapingAssumed uyarısı koşulsuz basılır', () => {
    // Information 0x7E ve 0x7D içeriyor — kaçışsız extractor bunları YANLIŞ okurdu.
    const logical = Uint8Array.from([0x01, 0x02, 0x7e, 0x7d]);
    const [lo, hi] = toLittleEndianCrc16Bytes(logical);
    const wire = encodeHdlcFlagFrame(Uint8Array.from([...logical, lo, hi]));

    const frame = expectSuccess(
      hdlcBasedMarineParser.parse(wire, { options: { escaping: 'rfc1662-octet-stuffed' } }),
    ).frame;
    expect(fieldById(frame, 'information').rawValue).toBe('7E 7D');
    expect(frame.valid).toBe(true);
    expect(frame.warnings.some((w) => w.code === 'protocol.hdlcBasedMarine.warning.asyncEscapingAssumed')).toBe(
      true,
    );
  });
});

describe('hdlcBasedMarineParser — decodeOptions: fcsCoverage', () => {
  it('information-only: yalnız Information kapsanır — varsayılan (ACI) kapsamıyla FAIL, bu şıkla PASS', () => {
    const address = 0x12;
    const control = 0x03;
    const info = Uint8Array.from([0xaa, 0xbb]);
    const [lo, hi] = toLittleEndianCrc16Bytes(info); // yalnız Information üzerinden hesaplanmış FCS.
    const wire = Uint8Array.from([HDLC_SYNC_FLAG, address, control, ...info, lo, hi, HDLC_SYNC_FLAG]);

    const defaultFrame = expectSuccess(hdlcBasedMarineParser.parse(wire)).frame;
    expect(defaultFrame.valid).toBe(false);

    const infoOnlyFrame = expectSuccess(
      hdlcBasedMarineParser.parse(wire, { options: { fcsCoverage: 'information-only' } }),
    ).frame;
    expect(infoOnlyFrame.valid).toBe(true);
  });
});

describe('hdlcBasedMarinePlugin', () => {
  it('katalogdaki kimlik, kategori ve parser bağını taşır', () => {
    expect(hdlcBasedMarinePlugin.id).toBe('hdlc-based-marine');
    expect(hdlcBasedMarinePlugin.category).toBe('marine-navigation');
    expect(hdlcBasedMarinePlugin.parser).toBe(hdlcBasedMarineParser);
    // 'build' sekmesi yok → encoder YAZILMAZ (katalog + dosya başı).
    expect(hdlcBasedMarinePlugin.encoder).toBeUndefined();
  });

  it('yedi decodeOptions kanalının hepsi tanımlı ve açıklamalı', () => {
    const ids = hdlcBasedMarinePlugin.decodeOptions?.map((option) => option.id) ?? [];
    expect(ids).toEqual([
      'fcsProfile',
      'fcsByteOrder',
      'addressFieldBytes',
      'controlFieldBytes',
      'controlFieldProfile',
      'escaping',
      'fcsCoverage',
    ]);
    for (const option of hdlcBasedMarinePlugin.decodeOptions ?? []) {
      expect(option.description, option.id).toBeDefined();
      expect(option.choices?.length ?? 0, option.id).toBeGreaterThan(0);
    }
  });

  it('her örnek çözülür ve expectedValid ile eşleşir', () => {
    for (const example of hdlcBasedMarinePlugin.exampleFrames) {
      const result = hdlcBasedMarineParser.parse(example.bytes);
      if (!result.success) {
        throw new Error(`example "${example.id}" failed: ${result.error.code}`);
      }
      expect(result.frame.valid, `example "${example.id}"`).toBe(example.expectedValid ?? true);
    }
  });

  it('her örnek adı/açıklaması protocol.hdlcBasedMarine.example. önekli çeviri anahtarıdır', () => {
    for (const example of hdlcBasedMarinePlugin.exampleFrames) {
      expect(example.name.startsWith('protocol.hdlcBasedMarine.example.'), example.id).toBe(true);
      expect(example.description?.startsWith('protocol.hdlcBasedMarine.example.'), example.id).toBe(true);
    }
  });

  it('exampleFrames boş değildir (registry testinin genel kuralı)', () => {
    expect(hdlcBasedMarinePlugin.exampleFrames.length).toBeGreaterThan(0);
  });
});
