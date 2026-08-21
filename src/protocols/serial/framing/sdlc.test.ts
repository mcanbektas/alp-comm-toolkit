import { describe, expect, it } from 'vitest';

import { computeNamedCrc } from '@/protocol-core/checksums/crcCatalogue';
import { HDLC_SYNC_FLAG, encodeHdlcSyncFrame } from './hdlcCore';
import { sdlcParser, sdlcPlugin } from './sdlc';
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

describe('sdlcParser — Station Address + I/S/U format çözümü', () => {
  it('I-frame: Station Address/Control/N(S)/N(R)/Information/FCS PASS ile çözülür', () => {
    const wire = encodeHdlcSyncFrame(Uint8Array.from([0x04, 0x42, 0xaa, 0xbb]));
    const frame = expectSuccess(sdlcParser.parse(wire)).frame;

    expect(fieldById(frame, 'station-address').rawValue).toBe('0x04');
    expect(fieldById(frame, 'station-address').physicalValue).toBeUndefined();
    expect(fieldById(frame, 'control').physicalValue).toBe('I-format');
    expect(fieldById(frame, 'send-sequence-number').rawValue).toBe(1);
    expect(fieldById(frame, 'information').rawValue).toBe('AA BB');
    expect(frame.valid).toBe(true);
    expect(frame.protocol).toBe('sdlc');
  });

  it('yayın adresi (0xFF) All-Stations olarak adlanır', () => {
    const wire = encodeHdlcSyncFrame(Uint8Array.from([0xff, 0x71]));
    const frame = expectSuccess(sdlcParser.parse(wire)).frame;

    expect(fieldById(frame, 'station-address').physicalValue).toBe('All-Stations (broadcast)');
    expect(fieldById(frame, 'supervisory-type').rawValue).toBe('RR (Receive Ready)');
    expect(fieldById(frame, 'poll-final').rawValue).toBe(1);
  });

  it('U-frame: yalnız format+P/F, sequence/supervisory alanı YOK', () => {
    const wire = encodeHdlcSyncFrame(Uint8Array.from([0x05, 0x03]));
    const frame = expectSuccess(sdlcParser.parse(wire)).frame;

    expect(fieldById(frame, 'control').physicalValue).toBe('U-format');
    expect(hasField(frame, 'send-sequence-number')).toBe(false);
    expect(hasField(frame, 'supervisory-type')).toBe(false);
  });

  it('bozuk FCS: frame.valid=false, fcs alanı FAIL, crc-mismatch hatası', () => {
    const goodWire = encodeHdlcSyncFrame(Uint8Array.from([0x04, 0x42, 0xaa, 0xbb]));
    const corrupted = Uint8Array.from(goodWire);
    corrupted[corrupted.length - 3] = (corrupted[corrupted.length - 3] ?? 0) ^ 0xff;

    const frame = expectSuccess(sdlcParser.parse(corrupted)).frame;
    expect(frame.valid).toBe(false);
    expect(fieldById(frame, 'fcs').valid).toBe(false);
    expect(frame.errors.map((e) => e.code)).toContain('crc-mismatch');
  });
});

describe('sdlcParser — hata yolları', () => {
  it('boş girdide truncated-frame döner', () => {
    expect(expectFailure(sdlcParser.parse(new Uint8Array(0))).error.code).toBe('truncated-frame');
  });

  it('delimiter hiç gelmeyen girdide truncated-frame döner', () => {
    expect(expectFailure(sdlcParser.parse(Uint8Array.from([0x01, 0x02, 0x03]))).error.code).toBe('truncated-frame');
  });

  it('içerik 4 bayttan kısaysa truncated-frame döner', () => {
    const wire = Uint8Array.from([HDLC_SYNC_FLAG, 0x01, 0x02, HDLC_SYNC_FLAG]);
    expect(expectFailure(sdlcParser.parse(wire)).error.code).toBe('truncated-frame');
  });

  it('iptal edilmiş signal ile parser-timeout döner', () => {
    const controller = new AbortController();
    controller.abort();
    const result = sdlcParser.parse(Uint8Array.from([HDLC_SYNC_FLAG]), { signal: controller.signal });
    expect(expectFailure(result).error.code).toBe('parser-timeout');
  });

  it('canParse boş girdide false, dolu girdide true döner', () => {
    expect(sdlcParser.canParse(new Uint8Array(0))).toBe(false);
    expect(sdlcParser.canParse(Uint8Array.from([0x01]))).toBe(true);
  });
});

describe('sdlcPlugin', () => {
  it('katalogdaki kimlik, kategori, parser ve encoder bağını taşır', () => {
    expect(sdlcPlugin.id).toBe('sdlc');
    expect(sdlcPlugin.category).toBe('interfaces-framing');
    expect(sdlcPlugin.parser).toBe(sdlcParser);
    expect(sdlcPlugin.encoder?.encode).toBe(encodeHdlcSyncFrame);
  });

  it('encoder çıktısı parser tarafından FCS PASS ile geri okunur (round-trip)', () => {
    const logical = Uint8Array.from([0x08, 0x42, 0x01, 0x02, 0x03]);
    const wire = sdlcPlugin.encoder?.encode(logical);
    if (wire === undefined) throw new Error('encoder tanımsız');
    const frame = expectSuccess(sdlcParser.parse(wire)).frame;
    const expectedCrc = Number(computeNamedCrc(logical, 'CRC16_X25'));
    const expectedHex = `0x${expectedCrc.toString(16).toUpperCase().padStart(4, '0')}`;

    expect(fieldById(frame, 'fcs').valid).toBe(true);
    expect(fieldById(frame, 'fcs').rawValue).toBe(expectedHex);
  });

  it('her örnek çözülür ve expectedValid ile eşleşir', () => {
    for (const example of sdlcPlugin.exampleFrames) {
      const result = sdlcParser.parse(example.bytes);
      if (!result.success) {
        throw new Error(`example "${example.id}" failed: ${result.error.code}`);
      }
      expect(result.frame.valid, `example "${example.id}"`).toBe(example.expectedValid ?? true);
    }
  });

  it('her örnek adı/açıklaması protocol.sdlc.example. önekli çeviri anahtarıdır', () => {
    for (const example of sdlcPlugin.exampleFrames) {
      expect(example.name.startsWith('protocol.sdlc.example.'), example.id).toBe(true);
      expect(example.description?.startsWith('protocol.sdlc.example.'), example.id).toBe(true);
    }
  });

  it('exampleFrames boş değildir (registry testinin genel kuralı)', () => {
    expect(sdlcPlugin.exampleFrames.length).toBeGreaterThan(0);
  });
});
