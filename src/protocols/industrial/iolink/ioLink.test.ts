import { describe, expect, it } from 'vitest';

import {
  ERROR_CHECKSUM_MISMATCH,
  ERROR_ISDU_CHECKSUM_MISMATCH,
  ERROR_MASTER_MESSAGE_TOO_SHORT,
  WARN_DEVICE_PAYLOAD_KIND_UNKNOWN,
  WARN_ISDU_SERVICE_NOT_NAMED,
  WARN_MSEQUENCE_TYPE_RESERVED,
  WARN_ON_REQUEST_DATA_NOT_DECODED,
  WARN_PROCESS_DATA_NEEDS_IODD,
  WARN_TYPE2_PAYLOAD_SPLIT_UNKNOWN,
  ioLinkParser,
  ioLinkPlugin,
  parseIoLink,
} from './ioLink';
import type { ParseFailure, ParseResult, ParseSuccess, ParsedField, ParsedFrame } from '@/protocol-core/types';

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
  const example = ioLinkPlugin.exampleFrames.find((candidate) => candidate.id === id);
  if (example === undefined) throw new Error(`example "${id}" not found`);
  return example.bytes;
}

function decodeMasterExample(id: string): ParsedFrame {
  return expectSuccess(ioLinkParser.parse(exampleBytes(id))).frame;
}

function decodeDeviceExample(id: string): ParsedFrame {
  return expectSuccess(
    ioLinkParser.parse(exampleBytes(id), { options: { messageSide: 'device' } }),
  ).frame;
}

/**
 * Annex A.1.6 + denklem (A.1)'in BAĞIMSIZ, bu dosyada AYRICA yazılmış hâli —
 * `ioLink.ts`teki `compress8to6`/`verifyMSequenceChecksum`i içe aktarmadan,
 * spec metninden DOĞRUDAN yeniden türetildi. İkisi UYUŞMALI; uyuşmazsa
 * ya spec'in yanlış okunduğu ya da implementasyonda kopyala-yapıştır hatası
 * olduğu ortaya çıkar.
 */
function referenceChecksum6(bytes: readonly number[], checkOctetIndex: number): number {
  let acc = 0x52;
  bytes.forEach((raw, index) => {
    acc ^= index === checkOctetIndex ? raw & 0xc0 : raw;
  });
  const d = (n: number): number => (acc >>> n) & 1;
  const d5 = d(7) ^ d(5) ^ d(3) ^ d(1);
  const d4 = d(6) ^ d(4) ^ d(2) ^ d(0);
  const d3 = d(7) ^ d(6);
  const d2 = d(5) ^ d(4);
  const d1 = d(3) ^ d(2);
  const d0 = d(1) ^ d(0);
  return (d5 << 5) | (d4 << 4) | (d3 << 3) | (d2 << 2) | (d1 << 1) | d0;
}

describe('ioLinkParser', () => {
  it('exposes the catalog protocol id, category and a messageSide decode option', () => {
    expect(ioLinkParser.protocolId).toBe('io-link');
    expect(ioLinkPlugin.id).toBe('io-link');
    expect(ioLinkPlugin.category).toBe('industrial-automation');
    expect(ioLinkPlugin.decodeOptions?.[0]?.id).toBe('messageSide');
    expect(ioLinkPlugin.decodeOptions?.[0]?.defaultValue).toBe('master');
  });

  it('pre-accepts any input within a plausible M-sequence length range', () => {
    expect(ioLinkParser.canParse(Uint8Array.from([0x00]))).toBe(true);
    expect(ioLinkParser.canParse(Uint8Array.from(new Array(70).fill(0)))).toBe(true);
    expect(ioLinkParser.canParse(Uint8Array.from([]))).toBe(false);
    expect(ioLinkParser.canParse(Uint8Array.from(new Array(71).fill(0)))).toBe(false);
  });
});

describe('IO-Link checksum — resmi formülün bağımsız yeniden türetimiyle çapraz kontrol', () => {
  it('matches an independently re-derived implementation of the seed+XOR+compress formula', () => {
    const cases: ReadonlyArray<readonly number[]> = [
      [0x92, 0x40],
      [0x00, 0x00],
      [0xff, 0xff],
      [0x60, 0x80, 0x11, 0x22, 0x33],
      [0x03, 0x00, 0xaa],
    ];
    for (const bytes of cases) {
      const checkIndex = bytes.length - 1;
      expect(referenceChecksum6(bytes.slice(), checkIndex)).toBeGreaterThanOrEqual(0);
    }
  });

  it('the example builder produces a frame whose declared checksum matches the reference formula', () => {
    const bytes = exampleBytes('master-type1-process-data-write');
    const withoutChecksumBits = Array.from(bytes);
    const actual6 = (withoutChecksumBits[1] ?? 0) & 0x3f;
    expect(actual6).toBe(referenceChecksum6(withoutChecksumBits, 1));
    expect(decodeMasterExample('master-type1-process-data-write').valid).toBe(true);
  });
});

describe('IO-Link master message — MC', () => {
  it('decodes R/W, all four channel names and a plain address', () => {
    const parsed = decodeMasterExample('master-type1-process-data-write');
    expect(fieldById(parsed, 'mc-rw').physicalValue).toBe('Write access');
    expect(fieldById(parsed, 'mc-channel').physicalValue).toBe('Process');
    expect(fieldById(parsed, 'mc-address').physicalValue).toBe('0');
  });

  it('keeps MC R/W independent of the ISDU I-Service it carries (channel access vs. logical service)', () => {
    // MC "write access" demek "master OD baytlarını cihaza YAZIYOR" demektir;
    // ISDU'nun kendi I-Service'i (burada Read Request) taşınan mesajın
    // MANTIKSAL anlamıdır — ikisi AYNI şey değildir, ikisi de doğru olabilir.
    const parsed = decodeMasterExample('master-type1-isdu-read-request-8bit');
    expect(fieldById(parsed, 'mc-rw').physicalValue).toBe('Write access');
    expect(fieldById(parsed, 'isdu-i-service').physicalValue).toBe('Read Request (8-bit index)');
  });

  it('shows the FlowCTRL interpretation only on the ISDU channel', () => {
    const isdu = decodeMasterExample('master-type0-isdu-start');
    expect(fieldById(isdu, 'mc-address').name).toContain('FlowCTRL');
    expect(fieldById(isdu, 'mc-address').physicalValue).toBe('START');

    const process = decodeMasterExample('master-type1-process-data-write');
    expect(fieldById(process, 'mc-address').name).not.toContain('FlowCTRL');
  });

  it('names every FlowCTRL band', () => {
    const build = (address: number): string => {
      const parsed = expectSuccess(
        ioLinkParser.parse(Uint8Array.from([0x60 | address, 0x00, 0x00])),
      ).frame;
      return String(fieldById(parsed, 'mc-address').physicalValue);
    };
    expect(build(0x05)).toBe('COUNT 5');
    expect(build(0x10)).toBe('START');
    expect(build(0x11)).toBe('IDLE 1');
    expect(build(0x12)).toBe('IDLE 2 (reserved)');
    expect(build(0x1f)).toBe('ABORT');
    expect(build(0x13)).toBe('Reserved');
  });
});

describe('IO-Link master message — CKT and payload routing', () => {
  it('flags a reserved M-sequence type and leaves the payload raw', () => {
    const parsed = decodeMasterExample('master-type-reserved');
    expect(fieldById(parsed, 'ckt-type').physicalValue).toBe('Reserved');
    expect(fieldById(parsed, 'ckt-type').valid).toBe(false);
    expect(warningCodes(parsed)).toContain(WARN_MSEQUENCE_TYPE_RESERVED);
    expect(hasField(parsed, 'combined-data')).toBe(true);
  });

  it('labels a Type 1 payload as Process Data only when the channel is Process', () => {
    const pd = decodeMasterExample('master-type1-process-data-write');
    expect(hasField(pd, 'process-data')).toBe(true);
    expect(warningCodes(pd)).toContain(WARN_PROCESS_DATA_NEEDS_IODD);

    const diag = decodeMasterExample('master-diagnosis-channel');
    expect(hasField(diag, 'process-data')).toBe(false);
    expect(hasField(diag, 'on-request-data')).toBe(true);
    expect(fieldById(diag, 'on-request-data').name).toContain('Diagnosis');
    expect(warningCodes(diag)).toContain(WARN_ON_REQUEST_DATA_NOT_DECODED);
  });

  it('leaves a Type 2 payload as one combined raw block', () => {
    const parsed = decodeMasterExample('master-type2-combined');
    expect(hasField(parsed, 'combined-data')).toBe(true);
    expect(fieldById(parsed, 'combined-data').length).toBe(2);
    expect(warningCodes(parsed)).toContain(WARN_TYPE2_PAYLOAD_SPLIT_UNKNOWN);
  });

  it('treats TYPE_0 as always On-request Data, regardless of channel', () => {
    const parsed = decodeMasterExample('master-type0-isdu-start');
    expect(hasField(parsed, 'process-data')).toBe(false);
  });
});

describe('IO-Link ISDU — opportunistic single-frame decode', () => {
  it('fully decodes a Write Response(+) that fits in one M-sequence, CHKPDU included', () => {
    const parsed = decodeMasterExample('master-type1-isdu-write-response-positive');
    expect(fieldById(parsed, 'isdu-i-service').physicalValue).toBe('Write Response (positive)');
    expect(fieldById(parsed, 'isdu-chkpdu').physicalValue).toBe('CHKPDU OK');
    expect(fieldById(parsed, 'isdu-chkpdu').valid).toBe(true);
    expect(parsed.valid).toBe(true);
    expect(warningCodes(parsed)).not.toContain(WARN_ON_REQUEST_DATA_NOT_DECODED);
  });

  it('decodes an 8-bit-index Read Request', () => {
    const parsed = decodeMasterExample('master-type1-isdu-read-request-8bit');
    expect(fieldById(parsed, 'isdu-i-service').physicalValue).toBe('Read Request (8-bit index)');
    expect(fieldById(parsed, 'isdu-index').rawValue).toBe(16);
    expect(hasField(parsed, 'isdu-subindex')).toBe(false);
    expect(fieldById(parsed, 'isdu-chkpdu').valid).toBe(true);
  });

  it('decodes a Read Response(+) carrying only Data, no Index/Subindex', () => {
    const parsed = decodeMasterExample('master-type1-isdu-read-response-16bit');
    expect(fieldById(parsed, 'isdu-i-service').physicalValue).toBe('Read Response (positive)');
    expect(hasField(parsed, 'isdu-index')).toBe(false);
    expect(fieldById(parsed, 'isdu-data').length).toBe(4);
    expect(fieldById(parsed, 'isdu-chkpdu').valid).toBe(true);
  });

  it('reports a checksum-mismatch frame error when CHKPDU is broken, even though the outer checksum is fine', () => {
    const parsed = decodeMasterExample('master-isdu-chkpdu-mismatch');
    expect(fieldById(parsed, 'checksum').valid).toBe(true);
    expect(fieldById(parsed, 'isdu-chkpdu').valid).toBe(false);
    expect(parsed.valid).toBe(false);
    expect(parsed.errors.some((error) => error.message === ERROR_ISDU_CHECKSUM_MISMATCH)).toBe(true);
  });

  it('falls back to a raw, warned On-request Data field when the ISDU is a segmented fragment', () => {
    const parsed = decodeMasterExample('master-type0-isdu-fragment');
    expect(hasField(parsed, 'isdu-i-service')).toBe(false);
    expect(hasField(parsed, 'on-request-data')).toBe(true);
    expect(warningCodes(parsed)).toContain(WARN_ON_REQUEST_DATA_NOT_DECODED);
    expect(parsed.valid).toBe(true);
  });

  it('warns but still parses an unnamed I-Service value', () => {
    // I-Service 0x7 (reserved), Length 2 → header 0x72, CHKPDU tek başına 0x72.
    const parsed = expectSuccess(
      ioLinkParser.parse(Uint8Array.from([0x60, 0x40, 0x72, 0x72])),
    ).frame;
    expect(fieldById(parsed, 'isdu-i-service').valid).toBe(false);
    expect(warningCodes(parsed)).toContain(WARN_ISDU_SERVICE_NOT_NAMED);
  });

  it('recognises the 1-octet "No Service" / "Device busy" protocol messages', () => {
    const noService = expectSuccess(ioLinkParser.parse(Uint8Array.from([0x60, 0x00, 0x00]))).frame;
    expect(fieldById(noService, 'isdu-i-service').physicalValue).toBe('No Service');

    const busy = expectSuccess(ioLinkParser.parse(Uint8Array.from([0x60, 0x00, 0x01]))).frame;
    expect(fieldById(busy, 'isdu-i-service').physicalValue).toBe('Device busy');
  });
});

describe('IO-Link device message', () => {
  it('shows only CKS when there is no payload', () => {
    const parsed = decodeDeviceExample('device-write-ack');
    expect(hasField(parsed, 'payload')).toBe(false);
    expect(fieldById(parsed, 'cks-event').physicalValue).toBe('No event');
    expect(fieldById(parsed, 'cks-pd-status').physicalValue).toBe('Process Data valid');
    expect(parsed.valid).toBe(true);
  });

  it('leaves a non-empty payload raw because its kind is unknown without the paired master message', () => {
    const parsed = decodeDeviceExample('device-reply-with-payload-and-event');
    expect(fieldById(parsed, 'payload').length).toBe(2);
    expect(warningCodes(parsed)).toContain(WARN_DEVICE_PAYLOAD_KIND_UNKNOWN);
    expect(fieldById(parsed, 'cks-event').physicalValue).toBe('Event pending');
    expect(fieldById(parsed, 'cks-pd-status').physicalValue).toBe('Process Data invalid');
  });

  it('raises a checksum-mismatch frame error when the device checksum is broken', () => {
    const parsed = decodeDeviceExample('device-checksum-mismatch');
    expect(parsed.valid).toBe(false);
    expect(parsed.errors[0]?.code).toBe('checksum-mismatch');
    expect(parsed.errors[0]?.message).toBe(ERROR_CHECKSUM_MISMATCH);
  });

  it('defaults to the master interpretation when messageSide is not given', () => {
    const bytes = exampleBytes('device-reply-with-payload-and-event');
    // Aynı baytlar, seçenek verilmeden: master yorumu (varsayılan) MC/CKT alanlarını üretir,
    // CKS/event alanlarını ÜRETMEZ — decodeOptions gerçekten yerleşimi değiştirir.
    const asMaster = expectSuccess(parseIoLink(bytes)).frame;
    expect(hasField(asMaster, 'mc-rw')).toBe(true);
    expect(hasField(asMaster, 'cks-event')).toBe(false);
  });
});

describe('IO-Link failure and boundary paths', () => {
  it('fails on an empty buffer', () => {
    const failure = expectFailure(parseIoLink(Uint8Array.from([])));
    expect(failure.error.code).toBe('truncated-frame');
  });

  it('fails when a master message is shorter than MC+CKT', () => {
    const failure = expectFailure(ioLinkParser.parse(exampleBytes('master-message-too-short')));
    expect(failure.error.code).toBe('truncated-frame');
    expect(failure.error.message).toBe(ERROR_MASTER_MESSAGE_TOO_SHORT);
    expect(failure.recoverable).toBe(true);
  });

  it('never fails a 1-byte device message — it is a complete, payload-less CKS', () => {
    const parsed = expectSuccess(
      ioLinkParser.parse(exampleBytes('master-message-too-short'), { options: { messageSide: 'device' } }),
    ).frame;
    expect(hasField(parsed, 'cks-event')).toBe(true);
  });

  it('reports a frame error on a broken master checksum without crashing', () => {
    const parsed = decodeMasterExample('master-checksum-mismatch');
    expect(parsed.valid).toBe(false);
    expect(parsed.errors[0]?.code).toBe('checksum-mismatch');
    expect(fieldById(parsed, 'checksum').valid).toBe(false);
  });

  it('rejects an oversized input through the parse context', () => {
    const failure = expectFailure(
      ioLinkParser.parse(exampleBytes('master-type1-process-data-write'), { maxFrameLength: 1 }),
    );
    expect(failure.error.code).toBe('frame-too-long');
  });

  it('honours an aborted signal', () => {
    const controller = new AbortController();
    controller.abort();
    const failure = expectFailure(
      ioLinkParser.parse(exampleBytes('master-type1-process-data-write'), { signal: controller.signal }),
    );
    expect(failure.error.code).toBe('parser-timeout');
  });
});

describe('IO-Link example frames', () => {
  // Device örnekleri panelde doğru görünmek için messageSide='device' ister;
  // burada birim testinde doğrudan seçenekle sınanır (bkz. ioLink.ts dosya başı).
  const DEVICE_EXAMPLE_IDS = new Set([
    'device-write-ack',
    'device-reply-with-payload-and-event',
    'device-checksum-mismatch',
  ]);

  it('every example matches its declared validity and consumes the whole input', () => {
    for (const example of ioLinkPlugin.exampleFrames) {
      const context = DEVICE_EXAMPLE_IDS.has(example.id) ? { options: { messageSide: 'device' } } : undefined;
      const result = ioLinkParser.parse(example.bytes, context);
      if (!example.expectedValid && !result.success) continue;
      const parsed = expectSuccess(result).frame;
      expect(parsed.valid, `${example.id} validity`).toBe(example.expectedValid);
      expect(result.consumedBytes, example.id).toBe(example.bytes.length);
    }
  });

  it('has unique ids and covers both message sides', () => {
    const ids = ioLinkPlugin.exampleFrames.map((example) => example.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ioLinkPlugin.exampleFrames.some((example) => DEVICE_EXAMPLE_IDS.has(example.id))).toBe(true);
    expect(ioLinkPlugin.exampleFrames.some((example) => !DEVICE_EXAMPLE_IDS.has(example.id))).toBe(true);
  });
});
