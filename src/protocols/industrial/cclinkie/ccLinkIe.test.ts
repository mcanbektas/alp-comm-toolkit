import { describe, expect, it } from 'vitest';

import {
  ERROR_ETHER_TYPE_NOT_CC_LINK_IE,
  ERROR_HEADER_TRUNCATED,
  WARN_CYCLIC_LAYOUT_FROM_NETWORK_PARAMETERS,
  WARN_FIELD_BASIC_NOT_ON_THIS_WIRE,
  WARN_FRAME_TYPE_NOT_NAMED,
  WARN_HEC_NOT_VERIFIED,
  WARN_MIDDLE_FIELDS_SINGLE_SOURCE,
  WARN_PADDING_NOT_ZERO,
  WARN_PROTOCOL_TYPE_RESERVED,
  WARN_SLMP_ENVELOPE_ONLY,
  WARN_SLMP_SUBHEADER_UNKNOWN,
  WARN_TRANSIENT_PAYLOAD_RAW,
  WARN_TSN_DETECTION_BODY_RAW,
  ccLinkIeParser,
  ccLinkIePlugin,
  parseCcLinkIe,
} from './ccLinkIe';
import type {
  ParseFailure,
  ParseResult,
  ParseSuccess,
  ParsedField,
  ParsedFrame,
} from '@/protocol-core/types';

function expectSuccess(result: ParseResult): ParseSuccess {
  if (!result.success) {
    throw new Error(`expected success, got failure ${result.error.code}: ${result.error.message}`);
  }
  return result;
}

function expectFailure(result: ParseResult): ParseFailure {
  if (result.success) throw new Error('expected failure, got success');
  return result;
}

function fieldById(frame: ParsedFrame, id: string): ParsedField {
  const found = frame.fields.find((field) => field.id === id);
  if (found === undefined) {
    throw new Error(`field "${id}" not found; got ${frame.fields.map((f) => f.id).join(', ')}`);
  }
  return found;
}

function hasField(frame: ParsedFrame, id: string): boolean {
  return frame.fields.some((field) => field.id === id);
}

function warningCodes(frame: ParsedFrame): string[] {
  return frame.warnings.map((warning) => warning.code);
}

function exampleBytes(id: string): Uint8Array {
  const example = ccLinkIePlugin.exampleFrames.find((candidate) => candidate.id === id);
  if (example === undefined) throw new Error(`example "${id}" not found`);
  return example.bytes;
}

/** Örnek çerçeveyi çözüp doğrudan `ParsedFrame` verir. */
function decodeExample(id: string): ParsedFrame {
  return expectSuccess(parseCcLinkIe(exampleBytes(id))).frame;
}

const SLAVE_MAC = [0x00, 0x00, 0x00, 0x00, 0x00, 0x01];
const MASTER_MAC = [0x00, 0x11, 0x11, 0x11, 0x11, 0x11];

function frame(body: readonly number[], padTo = 60): Uint8Array {
  const bytes = [...SLAVE_MAC, ...MASTER_MAC, 0x89, 0x0f, ...body];
  while (bytes.length < padTo) bytes.push(0x00);
  return Uint8Array.from(bytes);
}

describe('ccLinkIeParser', () => {
  it('exposes the catalog protocol id and a display name', () => {
    expect(ccLinkIeParser.protocolId).toBe('cc-link-ie');
    expect(ccLinkIePlugin.id).toBe('cc-link-ie');
    expect(ccLinkIePlugin.category).toBe('industrial-automation');
  });

  it('accepts only frames whose EtherType (plain or VLAN tagged) is 0x890F', () => {
    expect(ccLinkIeParser.canParse(frame([0x15, 0x01]))).toBe(true);
    // VLAN tag'li varyant: 0x8100 + TCI, sonra 0x890F.
    const tagged = Uint8Array.from([
      ...SLAVE_MAC,
      ...MASTER_MAC,
      0x81,
      0x00,
      0x00,
      0x64,
      0x89,
      0x0f,
      ...new Array<number>(46).fill(0x00),
    ]);
    expect(ccLinkIeParser.canParse(tagged)).toBe(true);
    const ipv4 = Uint8Array.from([
      ...SLAVE_MAC,
      ...MASTER_MAC,
      0x08,
      0x00,
      ...new Array<number>(46).fill(0x00),
    ]);
    expect(ccLinkIeParser.canParse(ipv4)).toBe(false);
    expect(ccLinkIeParser.canParse(Uint8Array.from([0x00, 0x01]))).toBe(false);
  });
});

describe('CC-Link IE Field/Control header', () => {
  it('decodes the 14-byte header and both protocolVerType nibbles', () => {
    const parsed = decodeExample('field-token-m');

    expect(fieldById(parsed, 'frame-type-14').physicalValue).toBe('TokenM');
    expect(fieldById(parsed, 'node-id-16').rawValue).toBe(0x0002);
    expect(fieldById(parsed, 'src-node-number-20').rawValue).toBe(0x0001);
    expect(fieldById(parsed, 'protocol-version-22').physicalValue).toBe(
      'CC-Link IE Field & Control, single master',
    );
    expect(fieldById(parsed, 'protocol-type-22').physicalValue).toBe('CC-Link IE Field');
    expect(fieldById(parsed, 'hec-24').physicalValue).toBe('0x12345678');
    expect(fieldById(parsed, 'hec-24').length).toBe(4);
    expect(parsed.valid).toBe(true);
  });

  it('never turns a HEC into an error — the algorithm is not public', () => {
    for (const id of ['field-token-m', 'field-my-status', 'tsn-cyclic-ms']) {
      const parsed = decodeExample(id);
      expect(parsed.errors, id).toEqual([]);
      expect(warningCodes(parsed), id).toContain(WARN_HEC_NOT_VERIFIED);
      const hec = parsed.fields.find((field) => field.id.startsWith('hec-'));
      expect(hec?.valid, id).toBe(true);
    }
  });

  it('breaks the middle four bytes down per frame type', () => {
    const myStatus = decodeExample('field-my-status');
    expect(fieldById(myStatus, 'node-id-16').rawValue).toBe(0x0003);
    expect(fieldById(myStatus, 'sync-flag-18').rawValue).toBe(0x13);
    expect(fieldById(myStatus, 'node-type-19').rawValue).toBe(0x01);
    expect(fieldById(myStatus, 'protocol-version-22').physicalValue).toBe(
      'CC-Link IE Field & Control, multi master',
    );

    const transient = decodeExample('field-transient1');
    expect(fieldById(transient, 'connection-info-18').rawValue).toBe(0x13);
    expect(hasField(transient, 'sync-flag-18')).toBe(false);
  });

  it('flags single-sourced middle fields but stays silent where both sources agree', () => {
    // TokenM'in kırılımını yalnız NTT ayrıştırıcısı veriyor.
    expect(warningCodes(decodeExample('field-token-m'))).toContain(
      WARN_MIDDLE_FIELDS_SINGLE_SOURCE,
    );
    // TestData'yı CLPA'nın kendi dissector'ı da AYNI ofsetlerle veriyor.
    const testData = decodeExample('field-test-data');
    expect(warningCodes(testData)).not.toContain(WARN_MIDDLE_FIELDS_SINGLE_SOURCE);
    expect(fieldById(testData, 'pers-priority-16').length).toBe(3);
    expect(fieldById(testData, 'node-type-19').rawValue).toBe(0x01);
    expect(fieldById(testData, 'pers-priority-16').warnings).toEqual([]);
  });

  it('names bytes 8-9 as reserved on Control frames instead of protocolVerType', () => {
    const control = decodeExample('control-token');
    expect(fieldById(control, 'frame-type-14').physicalValue).toBe('Token');
    expect(fieldById(control, 'scan-number-16').rawValue).toBe(0x00002a);
    expect(hasField(control, 'protocol-ver-type-22')).toBe(false);
    expect(hasField(control, 'protocol-type-22')).toBe(false);
    expect(fieldById(control, 'reserved-22').length).toBe(2);
  });

  it('leaves cyclic bodies as one raw block because the map lives in the network parameters', () => {
    const parsed = decodeExample('field-cyclic-data-rwr');
    const body = fieldById(parsed, 'cyclic-data-28');
    expect(body.length).toBe(32);
    expect(body.warnings).toContain(WARN_CYCLIC_LAYOUT_FROM_NETWORK_PARAMETERS);
    expect(warningCodes(parsed)).toContain(WARN_CYCLIC_LAYOUT_FROM_NETWORK_PARAMETERS);
    // Sahte kırılım yok: gövdeden tek bir alan bile türetilmiyor.
    expect(parsed.fields.filter((field) => field.offset >= 28)).toHaveLength(1);
  });

  it('leaves transient bodies raw', () => {
    const parsed = decodeExample('field-transient1');
    expect(fieldById(parsed, 'transient-data-28').warnings).toContain(WARN_TRANSIENT_PAYLOAD_RAW);
  });

  it('warns when a reserved protocolType nibble appears', () => {
    // protocolVerType 0x0F → protocolType 0xF, adlandırılmış kümede yok.
    const parsed = expectSuccess(
      parseCcLinkIe(
        frame([0x15, 0x01, 0x00, 0x02, 0x00, 0x00, 0x00, 0x01, 0x0f, 0x00, 0x00, 0x00, 0x00, 0x00]),
      ),
    ).frame;
    expect(warningCodes(parsed)).toContain(WARN_PROTOCOL_TYPE_RESERVED);
    expect(fieldById(parsed, 'protocol-type-22').warnings).toContain(WARN_PROTOCOL_TYPE_RESERVED);
  });
});

describe('CC-Link IE TSN frames', () => {
  it('decodes the 10-byte cyclic header with its cycle-number check flag', () => {
    const ms = decodeExample('tsn-cyclic-ms');
    expect(fieldById(ms, 'frame-type-14').physicalValue).toBe('Cyclic M / Ms');
    expect(fieldById(ms, 'tsn-cyclic-no-15').rawValue).toBe(5);
    expect(fieldById(ms, 'tsn-cyclic-no-check-flag-15').physicalValue).toBe('enable');
    expect(fieldById(ms, 'tsn-sa-16').rawValue).toBe(0x0102);
    expect(fieldById(ms, 'hec-20').length).toBe(4);

    const ss = decodeExample('tsn-cyclic-ss-check-disabled');
    expect(fieldById(ss, 'tsn-cyclic-no-15').rawValue).toBe(7);
    expect(fieldById(ss, 'tsn-cyclic-no-check-flag-15').physicalValue).toBe('disable');
    // Cihazdan gelen yönde alan `da`dır, `sa` DEĞİL.
    expect(hasField(ss, 'tsn-da-16')).toBe(true);
    expect(hasField(ss, 'tsn-sa-16')).toBe(false);
  });

  it('uses a two-byte header for Detection and leaves its body raw', () => {
    const parsed = decodeExample('tsn-acyclic-detection');
    expect(fieldById(parsed, 'frame-type-14').physicalValue).toBe('Detection');
    expect(fieldById(parsed, 'reserved-15').length).toBe(1);
    expect(fieldById(parsed, 'tsn-detection-body-16').warnings).toContain(
      WARN_TSN_DETECTION_BODY_RAW,
    );
  });

  it('decodes the SLMP 3E envelope carried by acyclicData and stops at the declared length', () => {
    const parsed = decodeExample('tsn-acyclic-data-slmp');
    expect(fieldById(parsed, 'tsn-da-16').rawValue).toBe(0x0102);
    expect(fieldById(parsed, 'slmp-subheader-20').physicalValue).toBe('Request (3E frame)');
    expect(fieldById(parsed, 'slmp-station-number-23').physicalValue).toBe('Own station');
    expect(fieldById(parsed, 'slmp-module-io-24').rawValue).toBe(0x03ff);
    expect(fieldById(parsed, 'slmp-data-length-27').rawValue).toBe(12);
    expect(fieldById(parsed, 'slmp-monitoring-timer-29').physicalValue).toBe('4000 ms');
    expect(fieldById(parsed, 'slmp-command-31').rawValue).toBe(0x0401);
    expect(fieldById(parsed, 'slmp-subcommand-33').rawValue).toBe(0x0000);
    // Bildirilen uzunluk 12 → 6 baytı zarf, 6 baytı veri; gerisi dolgudur.
    expect(fieldById(parsed, 'slmp-data-35').length).toBe(6);
    expect(fieldById(parsed, 'padding').offset).toBe(41);
    expect(warningCodes(parsed)).toContain(WARN_SLMP_ENVELOPE_ONLY);
  });

  it('decodes an SLMP response envelope with its end code', () => {
    const parsed = expectSuccess(
      parseCcLinkIe(
        frame([
          0xc3,
          0x00,
          0x02,
          0x01,
          0x00,
          0x00,
          0xd0,
          0x00,
          0x00,
          0xff,
          0xff,
          0x03,
          0x00,
          0x06,
          0x00,
          0x00,
          0x00,
          0x11,
          0x22,
          0x33,
          0x44,
        ]),
      ),
    ).frame;
    expect(fieldById(parsed, 'slmp-subheader-20').physicalValue).toBe('Response (3E frame)');
    expect(fieldById(parsed, 'slmp-end-code-29').physicalValue).toBe('Normal completion');
    expect(fieldById(parsed, 'slmp-data-31').length).toBe(4);
  });

  it('does not force an SLMP reading on a body that has no SLMP subheader', () => {
    const parsed = expectSuccess(
      parseCcLinkIe(frame([0xc3, 0x00, 0x02, 0x01, 0x00, 0x00, 0xaa, 0xbb, 0xcc, 0xdd])),
    ).frame;
    expect(warningCodes(parsed)).toContain(WARN_SLMP_SUBHEADER_UNKNOWN);
    expect(hasField(parsed, 'slmp-subheader-20')).toBe(false);
    expect(fieldById(parsed, 'slmp-payload-20').warnings).toContain(WARN_SLMP_SUBHEADER_UNKNOWN);
  });
});

describe('CC-Link IE failure and boundary paths', () => {
  it('reports a frame error and says Field Basic is not on this wire for IPv4', () => {
    const parsed = decodeExample('ethertype-ipv4-field-basic');
    expect(parsed.valid).toBe(false);
    expect(parsed.errors[0]?.code).toBe('start-delimiter-not-found');
    expect(parsed.errors[0]?.message).toBe(ERROR_ETHER_TYPE_NOT_CC_LINK_IE);
    expect(warningCodes(parsed)).toContain(WARN_FIELD_BASIC_NOT_ON_THIS_WIRE);
    // MAC alanları çözülür ama CC-Link IE başlığına DOKUNULMAZ.
    expect(hasField(parsed, 'destination-mac')).toBe(true);
    expect(hasField(parsed, 'frame-type-14')).toBe(false);
  });

  it('reports a truncated header when the frame type needs more bytes than are present', () => {
    const parsed = decodeExample('frame-too-short');
    expect(parsed.valid).toBe(false);
    expect(parsed.errors[0]?.code).toBe('truncated-frame');
    expect(parsed.errors[0]?.message).toBe(ERROR_HEADER_TRUNCATED);
  });

  it('fails outright (recoverable) when the input is shorter than an Ethernet header', () => {
    const failure = expectFailure(parseCcLinkIe(Uint8Array.from([0x00, 0x11, 0x22])));
    expect(failure.error.code).toBe('truncated-frame');
    expect(failure.recoverable).toBe(true);
  });

  it('rejects an oversized frame through the parse context', () => {
    const failure = expectFailure(
      ccLinkIeParser.parse(frame([0x15, 0x01]), { maxFrameLength: 32 }),
    );
    expect(failure.error.code).toBe('frame-too-long');
  });

  it('honours an aborted signal', () => {
    const controller = new AbortController();
    controller.abort();
    const failure = expectFailure(
      ccLinkIeParser.parse(frame([0x15, 0x01]), { signal: controller.signal }),
    );
    expect(failure.error.code).toBe('parser-timeout');
  });

  it('does not touch the body of an unnamed frame type', () => {
    const parsed = decodeExample('unknown-frame-type');
    expect(warningCodes(parsed)).toContain(WARN_FRAME_TYPE_NOT_NAMED);
    expect(fieldById(parsed, 'frame-type-14').valid).toBe(false);
    expect(fieldById(parsed, 'payload-15').warnings).toContain(WARN_FRAME_TYPE_NOT_NAMED);
    expect(hasField(parsed, 'src-node-number-20')).toBe(false);
  });

  it('warns when the trailing padding is not zero', () => {
    const parsed = expectSuccess(
      parseCcLinkIe(
        Uint8Array.from([
          ...SLAVE_MAC,
          ...MASTER_MAC,
          0x89,
          0x0f,
          0x15,
          0x01,
          0x00,
          0x02,
          0x00,
          0x00,
          0x00,
          0x01,
          0x01,
          0x00,
          0x00,
          0x00,
          0x00,
          0x00,
          0x77,
          0x77,
        ]),
      ),
    ).frame;
    expect(warningCodes(parsed)).toContain(WARN_PADDING_NOT_ZERO);
  });
});

describe('CC-Link IE example frames', () => {
  it('has at least one example per decoded network variant', () => {
    const ids = ccLinkIePlugin.exampleFrames.map((example) => example.id);
    expect(ids).toContain('field-token-m');
    expect(ids).toContain('control-token');
    expect(ids).toContain('tsn-cyclic-ms');
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every example matches its declared validity', () => {
    for (const example of ccLinkIePlugin.exampleFrames) {
      const result = parseCcLinkIe(example.bytes);
      if (!example.expectedValid) {
        const invalid = !result.success || !result.frame.valid;
        expect(invalid, `${example.id} should be invalid`).toBe(true);
        continue;
      }
      const parsed = expectSuccess(result).frame;
      expect(parsed.valid, `${example.id} should be valid`).toBe(true);
      expect(parsed.errors, example.id).toEqual([]);
    }
  });

  it('every example consumes the whole input', () => {
    for (const example of ccLinkIePlugin.exampleFrames) {
      const result = parseCcLinkIe(example.bytes);
      if (!result.success) continue;
      expect(result.consumedBytes, example.id).toBe(example.bytes.length);
    }
  });
});
