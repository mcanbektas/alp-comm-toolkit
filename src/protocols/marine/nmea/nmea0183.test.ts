import { describe, expect, it } from 'vitest';

import {
  NMEA_0183_MAX_SENTENCE_LENGTH,
  NMEA_0183_MIN_SENTENCE_LENGTH,
  nmea0183Parser,
  nmea0183Plugin,
  parseNmea0183,
} from './nmea0183';
import type {
  ParseFailure,
  ParseResult,
  ParseSuccess,
  ParsedField,
  ParsedFrame,
} from '@/protocol-core/types';

function sentenceBytes(text: string): Uint8Array {
  const bytes = new Uint8Array(text.length);
  for (let index = 0; index < text.length; index += 1) {
    bytes[index] = text.charCodeAt(index);
  }
  return bytes;
}

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

/** Spec §43 fixture'ı, birebir: Latitude 48.1173, Longitude 11.516666..., Checksum valid. */
const GGA_FIX = sentenceBytes('$GPGGA,123519,4807.038,N,01131.000,E,1,08,0.9,545.4,M,46.9,M,,*47');
/** Aynı fixture, son checksum hanesi bilerek bozuldu (47 → 48). */
const GGA_CHECKSUM_MISMATCH = sentenceBytes(
  '$GPGGA,123519,4807.038,N,01131.000,E,1,08,0.9,545.4,M,46.9,M,,*48',
);

describe('parseNmea0183 — spec §43 fixture GGA', () => {
  it('succeeds and consumes the whole sentence', () => {
    const result = expectSuccess(parseNmea0183(GGA_FIX));
    expect(result.consumedBytes).toBe(GGA_FIX.length);
    expect(result.frame.protocol).toBe('nmea-0183');
  });

  it('decodes the talker and the sentence formatter', () => {
    const { frame } = expectSuccess(parseNmea0183(GGA_FIX));
    const talker = fieldById(frame, 'talker');
    expect(talker.rawValue).toBe('GP');
    expect(talker.offset).toBe(1);
    expect(talker.length).toBe(2);

    const formatter = fieldById(frame, 'sentence-formatter');
    expect(formatter.rawValue).toBe('GGA');
    expect(formatter.physicalValue).toBe('Global Positioning System Fix Data');
    expect(formatter.offset).toBe(3);
  });

  it('converts latitude/longitude to decimal degrees (spec §43: 48.1173 / 11.516666...)', () => {
    const { frame } = expectSuccess(parseNmea0183(GGA_FIX));
    const latitude = fieldById(frame, 'latitude');
    expect(latitude.physicalValue).toBeCloseTo(48.1173, 4);
    expect(latitude.unit).toBe('°');
    const longitude = fieldById(frame, 'longitude');
    expect(longitude.physicalValue).toBeCloseTo(11.516667, 4);
  });

  it('decodes fix quality, satellite count, HDOP and altitude', () => {
    const { frame } = expectSuccess(parseNmea0183(GGA_FIX));
    expect(fieldById(frame, 'fix-quality').physicalValue).toBe('GPS Fix');
    expect(fieldById(frame, 'satellite-count').physicalValue).toBe(8);
    expect(fieldById(frame, 'hdop').physicalValue).toBe(0.9);
    const altitude = fieldById(frame, 'altitude');
    expect(altitude.physicalValue).toBe(545.4);
    expect(altitude.unit).toBe('m');
  });

  it('validates the checksum and leaves the frame without errors', () => {
    const { frame } = expectSuccess(parseNmea0183(GGA_FIX));
    const checksum = fieldById(frame, 'checksum');
    expect(checksum.valid).toBe(true);
    expect(checksum.rawValue).toBe('47');
    expect(checksum.physicalValue).toBe('47');
    expect(frame.valid).toBe(true);
    expect(frame.errors).toEqual([]);
  });

  it('produces the exact field id order (talker, formatter, 10 GGA fields, checksum)', () => {
    const { frame } = expectSuccess(parseNmea0183(GGA_FIX));
    expect(frame.fields.map((field) => field.id)).toEqual([
      'talker',
      'sentence-formatter',
      'utc-time',
      'latitude',
      'longitude',
      'fix-quality',
      'satellite-count',
      'hdop',
      'altitude',
      'geoid-separation',
      'dgps-age',
      'dgps-station-id',
      'checksum',
    ]);
  });
});

describe('parseNmea0183 — bozuk checksum', () => {
  it('reports checksum-mismatch but still resolves every field (spec §47)', () => {
    const { frame } = expectSuccess(parseNmea0183(GGA_CHECKSUM_MISMATCH));
    expect(frame.valid).toBe(false);
    expect(frame.errors).toHaveLength(1);
    expect(frame.errors[0]?.code).toBe('checksum-mismatch');
    expect(fieldById(frame, 'checksum').valid).toBe(false);
    expect(fieldById(frame, 'latitude').physicalValue).toBeCloseTo(48.1173, 4);
  });
});

describe('parseNmea0183 — çerçeve sınırları', () => {
  it('rejects a sentence shorter than the minimum meaningful length', () => {
    const result = expectFailure(parseNmea0183(sentenceBytes('$G*00')));
    expect(result.error.code).toBe('truncated-frame');
    expect(result.recoverable).toBe(true);
  });

  it('rejects a sentence longer than the classic 82-character limit', () => {
    const overlong = `$GPGGA,${'1'.repeat(NMEA_0183_MAX_SENTENCE_LENGTH)}*00`;
    const result = expectFailure(parseNmea0183(sentenceBytes(overlong)));
    expect(result.error.code).toBe('frame-too-long');
    expect(result.recoverable).toBe(false);
  });

  it('rejects input without a leading $', () => {
    const result = expectFailure(parseNmea0183(sentenceBytes('GPGGA,123519,4807.038,N*47')));
    expect(result.error.code).toBe('start-delimiter-not-found');
  });

  it('rejects a sentence without a checksum delimiter', () => {
    const result = expectFailure(parseNmea0183(sentenceBytes('$GPGGA,123519,4807.038')));
    expect(result.error.code).toBe('truncated-frame');
  });

  it('rejects a malformed identifier shorter than talker+formatter', () => {
    const result = expectFailure(parseNmea0183(sentenceBytes('$GP,1,2*00')));
    expect(result.error.code).toBe('truncated-frame');
  });
});

describe('nmea0183Parser', () => {
  it('canParse accepts a sentence-shaped byte range and rejects out-of-range lengths', () => {
    expect(nmea0183Parser.canParse(GGA_FIX)).toBe(true);
    expect(nmea0183Parser.canParse(sentenceBytes('$*0'))).toBe(false);
    expect(nmea0183Parser.canParse(sentenceBytes('X'.repeat(NMEA_0183_MAX_SENTENCE_LENGTH + 1)))).toBe(
      false,
    );
  });

  it('canParse rejects data not starting with $', () => {
    expect(nmea0183Parser.canParse(sentenceBytes('GPGGA,123519,4807.038,N*47'))).toBe(false);
  });

  it('parse() matches parseNmea0183() on the spec fixture', () => {
    const viaParser = expectSuccess(nmea0183Parser.parse(GGA_FIX));
    const viaFunction = expectSuccess(parseNmea0183(GGA_FIX));
    expect(viaParser.frame.fields).toEqual(viaFunction.frame.fields);
  });
});

describe('nmea0183Plugin', () => {
  it('exposes the canonical id, category and parser', () => {
    expect(nmea0183Plugin.id).toBe('nmea-0183');
    expect(nmea0183Plugin.category).toBe('marine-navigation');
    expect(nmea0183Plugin.parser).toBe(nmea0183Parser);
  });

  it('includes the spec §43 GGA fixture among its examples', () => {
    const ggaExample = nmea0183Plugin.exampleFrames.find((example) => example.id === 'gga-fix');
    expect(ggaExample).toBeDefined();
    expect(ggaExample?.bytes).toEqual(GGA_FIX);
  });

  it('every example frame parses and matches its expectedValid flag', () => {
    const parser = nmea0183Plugin.parser;
    if (parser === undefined) throw new Error('plugin has no parser');
    for (const example of nmea0183Plugin.exampleFrames) {
      const result = parser.parse(example.bytes);
      if (!result.success) {
        throw new Error(`example "${example.id}" failed to parse: ${result.error.code}`);
      }
      expect(result.frame.valid, `example "${example.id}"`).toBe(example.expectedValid ?? true);
    }
  });

  it('every example name/description is a translation key under protocol.nmea.0183.example.', () => {
    for (const example of nmea0183Plugin.exampleFrames) {
      expect(example.name.startsWith('protocol.nmea.0183.example.')).toBe(true);
      expect(example.description?.startsWith('protocol.nmea.0183.example.')).toBe(true);
    }
  });

  it('the MWV example demonstrates the generic-envelope path (kalan 11 tip)', () => {
    const mwvExample = nmea0183Plugin.exampleFrames.find(
      (example) => example.id === 'mwv-generic-envelope',
    );
    expect(mwvExample).toBeDefined();
    const parser = nmea0183Plugin.parser;
    if (parser === undefined || mwvExample === undefined) throw new Error('eksik plugin/eklenti');
    const result = expectSuccess(parser.parse(mwvExample.bytes));
    expect(warningCodes(result.frame)).toContain('protocol.nmea.sentence.warning.genericFieldsOnly');
  });
});

describe('NMEA_0183_MIN_SENTENCE_LENGTH / NMEA_0183_MAX_SENTENCE_LENGTH', () => {
  it('spec fixture bu aralığın içindedir', () => {
    expect(GGA_FIX.length).toBeGreaterThanOrEqual(NMEA_0183_MIN_SENTENCE_LENGTH);
    expect(GGA_FIX.length).toBeLessThanOrEqual(NMEA_0183_MAX_SENTENCE_LENGTH);
  });
});
