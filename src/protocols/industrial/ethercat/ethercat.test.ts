import { describe, expect, it } from 'vitest';

import {
  ERROR_DATAGRAM_REGION_TRUNCATED,
  ERROR_ETHER_TYPE_NOT_ETHERCAT,
  WARN_DATAGRAM_RESERVED_BITS_SET,
  WARN_DECLARED_LENGTH_MISMATCH,
  WARN_MORE_FLAG_WITHOUT_ROOM,
  WARN_NON_COMMAND_TYPE,
  WARN_PADDING_NOT_ZERO,
  WARN_PROCESS_DATA_NEEDS_CONFIGURATION,
  WARN_UNKNOWN_COMMAND,
  WARN_WORKING_COUNTER_NOT_VERIFIABLE,
  ethercatParser,
  ethercatPlugin,
  parseEtherCat,
} from './ethercat';
import type {
  ParseFailure,
  ParseResult,
  ParseSuccess,
  ParsedField,
  ParsedFrame,
} from '@/protocol-core/types';

function bytes(hex: string): Uint8Array {
  const cleaned = hex.replace(/\s+/g, '');
  const result = new Uint8Array(cleaned.length / 2);
  for (let index = 0; index < result.length; index++) {
    result[index] = Number.parseInt(cleaned.slice(index * 2, index * 2 + 2), 16);
  }
  return result;
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

function hasField(frame: ParsedFrame, id: string): boolean {
  return frame.fields.some((field) => field.id === id);
}

function warningCodes(frame: ParsedFrame): string[] {
  return frame.warnings.map((warning) => warning.code);
}

function errorCodes(frame: ParsedFrame): string[] {
  return frame.errors.map((error) => error.code);
}

function exampleBytes(id: string): Uint8Array {
  const example = ethercatPlugin.exampleFrames.find((frame) => frame.id === id);
  if (example === undefined) {
    throw new Error(`example "${id}" not found`);
  }
  return example.bytes;
}

function parseExample(id: string): ParsedFrame {
  return expectSuccess(parseEtherCat(exampleBytes(id))).frame;
}

/**
 * Motorun sabitlerinden BAĞIMSIZ çerçeve kurucusu — testin kanıt değeri bundan
 * gelir: baytları burada elle yerleştiriyoruz, motorun kendi yardımcılarıyla
 * değil. `headerWord` little-endian yazılır (EtherCAT başlığından itibaren her
 * şey LE; Ethernet başlığı ise network order).
 */
function buildFrame(
  headerWord: number,
  region: readonly number[],
  options: { etherType?: number; vlan?: number; padTo?: number } = {},
): Uint8Array {
  const etherType = options.etherType ?? 0x88a4;
  const out: number[] = [
    0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0x02, 0x00, 0x00, 0x00, 0x00, 0x01,
  ];
  if (options.vlan !== undefined) {
    out.push(0x81, 0x00, (options.vlan >>> 8) & 0xff, options.vlan & 0xff);
  }
  out.push((etherType >>> 8) & 0xff, etherType & 0xff);
  out.push(headerWord & 0xff, (headerWord >>> 8) & 0xff);
  out.push(...region);
  if (options.padTo !== undefined) {
    while (out.length < options.padTo) out.push(0x00);
  }
  return Uint8Array.from(out);
}

/** Datagram kurucusu: cmd(1)+idx(1)+addr(4)+lenWord(2)+irq(2)+data+wkc(2). */
function buildDatagram(
  command: number,
  index: number,
  address: readonly number[],
  lengthWord: number,
  data: readonly number[],
  workingCounter: number,
): number[] {
  return [
    command,
    index,
    ...address,
    lengthWord & 0xff,
    (lengthWord >>> 8) & 0xff,
    0x00,
    0x00,
    ...data,
    workingCounter & 0xff,
    (workingCounter >>> 8) & 0xff,
  ];
}

/** Type=1 çerçeve başlığı — testte elle: uzunluk bit 0-10, Type bit 12-15. */
function commandHeader(regionLength: number): number {
  return (regionLength & 0x07ff) | (1 << 12);
}

describe('EtherCAT — bayt bütçesi ve bit yerleşimi (bağımsız aritmetik)', () => {
  it('reproduces the SOEM byte budget: 14 + 2 + 10 + data + 2', () => {
    // SOEM `EC_MAXLRWDATA (EC_MAXECATFRAME - 14 - 2 - 10 - 2 - 4)` ifadesinin
    // aynı kırılımı; FCS (4) yakalanmış çerçevede yoktur, o yüzden burada yok.
    const dataLength = 4;
    const region = buildDatagram(0x0c, 0x01, [0x00, 0x00, 0x01, 0x00], dataLength, [
      0x12, 0x34, 0x56, 0x78,
    ], 3);
    expect(region).toHaveLength(10 + dataLength + 2);

    const frame = buildFrame(commandHeader(region.length), region);
    expect(frame).toHaveLength(14 + 2 + 10 + dataLength + 2);
  });

  it('splits the EtherCAT header word into 11/1/4 bits', () => {
    const frame = expectSuccess(parseEtherCat(exampleBytes('lrw-cyclic-process-data'))).frame;
    // Başlık sözcüğünü testte YENİDEN, motordan bağımsız oku.
    const low = frame.rawFrame.bytes[14] ?? 0;
    const high = frame.rawFrame.bytes[15] ?? 0;
    const word = low | (high << 8);

    expect(fieldById(frame, 'ecat-length').rawValue).toBe(word & 0x07ff);
    expect(fieldById(frame, 'ecat-reserved').rawValue).toBe((word & 0x0800) >>> 11);
    expect(fieldById(frame, 'ecat-type').rawValue).toBe((word & 0xf000) >>> 12);
    expect(fieldById(frame, 'ecat-type').physicalValue).toBe('EtherCAT commands');
  });

  it('places the Working Counter after the data, not before it', () => {
    const dataLength = 6;
    const region = buildDatagram(
      0x0c,
      0x01,
      [0x00, 0x00, 0x02, 0x00],
      dataLength,
      [0x11, 0x22, 0x33, 0x44, 0x55, 0x66],
      0x0007,
    );
    const frame = expectSuccess(parseEtherCat(buildFrame(commandHeader(region.length), region))).frame;

    const datagramStart = 14 + 2;
    expect(fieldById(frame, 'datagram-0-data').offset).toBe(datagramStart + 10);
    // Bağımsız hesap: WKC ofseti = datagram başı + 10 + len.
    expect(fieldById(frame, 'datagram-0-working-counter').offset).toBe(
      datagramStart + 10 + dataLength,
    );
    expect(fieldById(frame, 'datagram-0-working-counter').rawValue).toBe(7);
  });

  it('reads every EtherCAT field little-endian while the EtherType stays network order', () => {
    // ADP = 0x03E9 telde E9 03; EtherType 0x88A4 telde 88 A4.
    const region = buildDatagram(0x04, 0x02, [0xe9, 0x03, 0x30, 0x01], 2, [0x08, 0x00], 1);
    const frame = expectSuccess(parseEtherCat(buildFrame(commandHeader(region.length), region))).frame;

    expect(fieldById(frame, 'ethertype').rawValue).toBe(0x88a4);
    expect(fieldById(frame, 'datagram-0-adp').rawValue).toBe(0x03e9);
    expect(fieldById(frame, 'datagram-0-ado').rawValue).toBe(0x0130);
  });
});

describe('EtherCAT — Ethernet başlığı', () => {
  it('decodes the MAC pair with the shared dalga-4a helpers', () => {
    const frame = parseExample('brd-startup-scan');
    expect(fieldById(frame, 'destination-mac').rawValue).toBe('FF:FF:FF:FF:FF:FF');
    expect(fieldById(frame, 'destination-mac').physicalValue).toBe('Broadcast');
    expect(fieldById(frame, 'source-mac').rawValue).toBe('02:00:00:00:00:01');
  });

  it('walks a VLAN tag before the EtherType and keeps the offsets straight', () => {
    const region = buildDatagram(0x07, 0x00, [0x00, 0x00, 0x30, 0x01], 2, [0x08, 0x00], 3);
    const frame = expectSuccess(
      parseEtherCat(buildFrame(commandHeader(region.length), region, { vlan: 0x0064 })),
    ).frame;

    expect(fieldById(frame, 'vlan-1-vid').rawValue).toBe(100);
    // VLAN tag 4 bayt: EtherType 12 yerine 16'da, EtherCAT başlığı 18'de.
    expect(fieldById(frame, 'ethertype').offset).toBe(16);
    expect(fieldById(frame, 'ecat-length').offset).toBe(18);
    expect(fieldById(frame, 'datagram-0-command').offset).toBe(20);
    expect(errorCodes(frame)).toEqual([]);
  });

  it('refuses to decode the body when the EtherType is not 0x88A4', () => {
    const frame = parseExample('ethertype-not-ethercat');
    expect(frame.valid).toBe(false);
    expect(errorCodes(frame)).toEqual(['start-delimiter-not-found']);
    expect(frame.errors[0]?.message).toBe(ERROR_ETHER_TYPE_NOT_ETHERCAT);
    expect(hasField(frame, 'ecat-length')).toBe(false);
    expect(hasField(frame, 'datagram-0-command')).toBe(false);
    expect(hasField(frame, 'payload')).toBe(true);
  });
});

describe('EtherCAT — adresleme kipi komuttan türer', () => {
  it('keeps a single 32-bit logical address for LRW', () => {
    const frame = parseExample('lrw-cyclic-process-data');
    expect(fieldById(frame, 'datagram-0-command').physicalValue).toBe('LRW — Logical ReadWrite');
    expect(fieldById(frame, 'datagram-0-logical-address').rawValue).toBe(0x00010000);
    expect(fieldById(frame, 'datagram-0-logical-address').length).toBe(4);
    expect(hasField(frame, 'datagram-0-adp')).toBe(false);
    expect(hasField(frame, 'datagram-0-ado')).toBe(false);
  });

  it('splits ADP/ADO for a configured-address command', () => {
    const frame = parseExample('fprd-configured-address-read');
    expect(fieldById(frame, 'datagram-0-command').physicalValue).toBe(
      'FPRD — Configured Address Physical Read',
    );
    expect(fieldById(frame, 'datagram-0-adp').name).toContain('Configured Station Address');
    expect(fieldById(frame, 'datagram-0-ado').rawValue).toBe(0x0130);
    expect(hasField(frame, 'datagram-0-logical-address')).toBe(false);
  });

  it('labels the broadcast ADP differently from the auto-increment one', () => {
    const broadcast = parseExample('brd-startup-scan');
    expect(fieldById(broadcast, 'datagram-0-adp').name).toContain('Broadcast Position');

    const region = buildDatagram(0x01, 0x00, [0x00, 0x00, 0x30, 0x01], 2, [0x00, 0x00], 1);
    const autoIncrement = expectSuccess(
      parseEtherCat(buildFrame(commandHeader(region.length), region)),
    ).frame;
    expect(fieldById(autoIncrement, 'datagram-0-command').physicalValue).toBe(
      'APRD — Auto Increment Physical Read',
    );
    expect(fieldById(autoIncrement, 'datagram-0-adp').name).toContain('Auto-Increment Address');
  });

  it('leaves the address raw when the command is not cross-verified', () => {
    const frame = parseExample('unknown-command');
    expect(fieldById(frame, 'datagram-0-command').valid).toBe(false);
    expect(fieldById(frame, 'datagram-0-command').physicalValue).toBeUndefined();
    expect(fieldById(frame, 'datagram-0-address').length).toBe(4);
    expect(hasField(frame, 'datagram-0-adp')).toBe(false);
    expect(hasField(frame, 'datagram-0-logical-address')).toBe(false);
    expect(warningCodes(frame)).toContain(WARN_UNKNOWN_COMMAND);
    // Uyarı yolu — hata DEĞİL.
    expect(frame.valid).toBe(true);
  });

  it('names all fifteen cross-verified commands and nothing beyond them', () => {
    const expected = [
      'NOP',
      'APRD',
      'APWR',
      'APRW',
      'FPRD',
      'FPWR',
      'FPRW',
      'BRD',
      'BWR',
      'BRW',
      'LRD',
      'LWR',
      'LRW',
      'ARMW',
      'FRMW',
    ];
    for (let command = 0; command < expected.length; command++) {
      const region = buildDatagram(command, 0x00, [0x00, 0x00, 0x00, 0x00], 0, [], 0);
      const frame = expectSuccess(
        parseEtherCat(buildFrame(commandHeader(region.length), region)),
      ).frame;
      const physical = fieldById(frame, 'datagram-0-command').physicalValue;
      expect(typeof physical === 'string' ? physical.split(' — ')[0] : '').toBe(expected[command]);
    }

    // 0x0F ve 0xFF çapraz teyitli kümede YOK.
    for (const command of [0x0f, 0xff]) {
      const region = buildDatagram(command, 0x00, [0x00, 0x00, 0x00, 0x00], 0, [], 0);
      const frame = expectSuccess(
        parseEtherCat(buildFrame(commandHeader(region.length), region)),
      ).frame;
      expect(fieldById(frame, 'datagram-0-command').physicalValue).toBeUndefined();
    }
  });
});

describe('EtherCAT — uzunluk sözcüğü ve zincir yürüyüşü', () => {
  it('splits the datagram length word into 11/3/1/1 bits', () => {
    // Len=5, Reserved=0b101 (bit 11-13), Circulating=1, More=0.
    const lengthWord = 5 | (0b101 << 11) | 0x4000;
    const region = buildDatagram(
      0x0c,
      0x00,
      [0x00, 0x00, 0x00, 0x00],
      lengthWord,
      [0x01, 0x02, 0x03, 0x04, 0x05],
      1,
    );
    const frame = expectSuccess(parseEtherCat(buildFrame(commandHeader(region.length), region))).frame;

    expect(fieldById(frame, 'datagram-0-length').rawValue).toBe(5);
    expect(fieldById(frame, 'datagram-0-reserved').rawValue).toBe(0b101);
    expect(fieldById(frame, 'datagram-0-circulating').rawValue).toBe(1);
    expect(fieldById(frame, 'datagram-0-more').rawValue).toBe(0);
    expect(warningCodes(frame)).toContain(WARN_DATAGRAM_RESERVED_BITS_SET);
  });

  it('walks the whole chain while the More bit is set', () => {
    const frame = parseExample('multi-datagram-chain');
    expect(fieldById(frame, 'datagram-0-command').physicalValue).toBe('BRD — Broadcast Read');
    expect(fieldById(frame, 'datagram-0-more').rawValue).toBe(1);
    expect(fieldById(frame, 'datagram-1-command').physicalValue).toBe('LWR — Logical Write');
    expect(fieldById(frame, 'datagram-1-more').rawValue).toBe(0);
    expect(hasField(frame, 'datagram-2-command')).toBe(false);

    // İki ayrı WKC; ikincisi ilkinin verisinden sonra gelir.
    expect(fieldById(frame, 'datagram-0-working-counter').rawValue).toBe(2);
    expect(fieldById(frame, 'datagram-1-working-counter').rawValue).toBe(1);
    expect(fieldById(frame, 'datagram-1-working-counter').offset).toBe(14 + 2 + 14 + 10 + 4);
    expect(errorCodes(frame)).toEqual([]);
  });

  it('stops the chain when More=1 but no room is left', () => {
    // Tek datagram, More=1 — bölgede ikincisi için yer yok.
    const region = buildDatagram(0x07, 0x00, [0x00, 0x00, 0x30, 0x01], 2 | 0x8000, [0x00, 0x00], 1);
    const frame = expectSuccess(parseEtherCat(buildFrame(commandHeader(region.length), region))).frame;

    expect(hasField(frame, 'datagram-1-command')).toBe(false);
    expect(warningCodes(frame)).toContain(WARN_MORE_FLAG_WITHOUT_ROOM);
  });

  it('warns when the declared length does not match what the chain consumed', () => {
    const region = buildDatagram(0x07, 0x00, [0x00, 0x00, 0x30, 0x01], 2, [0x00, 0x00], 1);
    const filler = new Array<number>(14).fill(0x00);
    // Length 28 der ama zincir 14 baytta (More=0) biter.
    const frame = expectSuccess(parseEtherCat(buildFrame(commandHeader(28), [...region, ...filler]))).frame;

    expect(hasField(frame, 'datagram-0-command')).toBe(true);
    expect(warningCodes(frame)).toContain(WARN_DECLARED_LENGTH_MISMATCH);
  });

  it('reports a truncated datagram region instead of inventing bytes', () => {
    const frame = parseExample('datagram-truncated');
    expect(frame.valid).toBe(false);
    expect(errorCodes(frame)).toContain('truncated-frame');
    expect(frame.errors[0]?.message).toBe(ERROR_DATAGRAM_REGION_TRUNCATED);
    expect(hasField(frame, 'datagram-0-working-counter')).toBe(false);
  });

  it('errors when the Len field overruns the region', () => {
    // Bölge 14 bayt ama Len 100 diyor: veri + WKC sığmaz.
    const region = buildDatagram(0x0c, 0x00, [0x00, 0x00, 0x00, 0x00], 100, [0x00, 0x00], 1);
    const frame = expectSuccess(parseEtherCat(buildFrame(commandHeader(region.length), region))).frame;

    expect(frame.valid).toBe(false);
    expect(errorCodes(frame)).toContain('truncated-frame');
    // Başlık alanları yine çözüldü — kısmi çözüm gösterilir.
    expect(fieldById(frame, 'datagram-0-length').rawValue).toBe(100);
    expect(hasField(frame, 'datagram-0-working-counter')).toBe(false);
  });
});

describe('EtherCAT — ham kalan alanlar ve uyarılar', () => {
  it('marks process data as configuration dependent and never claims a WKC verdict', () => {
    const frame = parseExample('lrw-cyclic-process-data');
    expect(fieldById(frame, 'datagram-0-data').warnings).toContain(
      WARN_PROCESS_DATA_NEEDS_CONFIGURATION,
    );
    expect(fieldById(frame, 'datagram-0-working-counter').warnings).toContain(
      WARN_WORKING_COUNTER_NOT_VERIFIABLE,
    );
    // WKC bir checksum DEĞİL: hiçbir koşulda mismatch hatası basılmaz.
    expect(errorCodes(frame)).toEqual([]);
    expect(frame.valid).toBe(true);
  });

  it('reports each frame-level warning only once even across datagrams', () => {
    const frame = parseExample('multi-datagram-chain');
    const wkcWarnings = warningCodes(frame).filter(
      (code) => code === WARN_WORKING_COUNTER_NOT_VERIFIABLE,
    );
    expect(wkcWarnings).toHaveLength(1);
  });

  it('shows the Ethernet padding as its own field', () => {
    const frame = parseExample('lrw-cyclic-process-data');
    const padding = fieldById(frame, 'padding');
    // 60 - (14 + 2 + 16) = 28.
    expect(padding.offset).toBe(32);
    expect(padding.length).toBe(28);
    expect(warningCodes(frame)).not.toContain(WARN_PADDING_NOT_ZERO);
  });

  it('warns when the trailing bytes are not zero padding', () => {
    const region = buildDatagram(0x07, 0x00, [0x00, 0x00, 0x30, 0x01], 2, [0x00, 0x00], 1);
    const frame = expectSuccess(
      parseEtherCat(
        Uint8Array.from([...buildFrame(commandHeader(region.length), region), 0xaa, 0xbb]),
      ),
    ).frame;
    expect(fieldById(frame, 'padding').length).toBe(2);
    expect(warningCodes(frame)).toContain(WARN_PADDING_NOT_ZERO);
  });

  it('leaves a non-command frame type raw', () => {
    const frame = parseExample('non-command-type');
    expect(fieldById(frame, 'ecat-type').rawValue).toBe(5);
    expect(fieldById(frame, 'ecat-type').physicalValue).toBe('Mailbox');
    expect(fieldById(frame, 'ecat-payload').length).toBe(8);
    expect(hasField(frame, 'datagram-0-command')).toBe(false);
    expect(warningCodes(frame)).toContain(WARN_NON_COMMAND_TYPE);
    expect(frame.valid).toBe(true);
  });
});

describe('EtherCAT — parser sözleşmesi', () => {
  it('accepts an EtherCAT frame and rejects everything else in canParse', () => {
    expect(ethercatParser.canParse(exampleBytes('lrw-cyclic-process-data'))).toBe(true);
    expect(ethercatParser.canParse(exampleBytes('ethertype-not-ethercat'))).toBe(false);
    expect(ethercatParser.canParse(exampleBytes('frame-too-short'))).toBe(false);
    expect(ethercatParser.canParse(bytes(''))).toBe(false);
  });

  it('accepts the VLAN-tagged variant in canParse too', () => {
    const region = buildDatagram(0x07, 0x00, [0x00, 0x00, 0x30, 0x01], 2, [0x00, 0x00], 1);
    const tagged = buildFrame(commandHeader(region.length), region, { vlan: 0x0064 });
    expect(ethercatParser.canParse(tagged)).toBe(true);
  });

  it('fails, recoverably, on a frame shorter than the Ethernet + EtherCAT header', () => {
    const failure = expectFailure(parseEtherCat(exampleBytes('frame-too-short')));
    expect(failure.error.code).toBe('truncated-frame');
    expect(failure.recoverable).toBe(true);
    expect(failure.consumedBytes).toBe(0);
  });

  it('honours maxFrameLength and the abort signal', () => {
    const frame = exampleBytes('lrw-cyclic-process-data');
    const tooLong = expectFailure(ethercatParser.parse(frame, { maxFrameLength: 32 }));
    expect(tooLong.error.code).toBe('frame-too-long');

    const controller = new AbortController();
    controller.abort();
    const aborted = expectFailure(ethercatParser.parse(frame, { signal: controller.signal }));
    expect(aborted.error.code).toBe('parser-timeout');
  });

  it('consumes the whole buffer — the input is one complete Ethernet frame', () => {
    const raw = exampleBytes('lrw-cyclic-process-data');
    expect(expectSuccess(parseEtherCat(raw)).consumedBytes).toBe(raw.length);
  });

  it('keeps every parsed field inside the buffer', () => {
    for (const example of ethercatPlugin.exampleFrames) {
      const result = parseEtherCat(example.bytes);
      if (!result.success) continue;
      for (const field of result.frame.fields) {
        expect(field.offset, `${example.id}/${field.id} offset`).toBeGreaterThanOrEqual(0);
        expect(
          field.offset + field.length,
          `${example.id}/${field.id} taşıyor`,
        ).toBeLessThanOrEqual(example.bytes.length);
        expect(field.rawBytes.length, `${example.id}/${field.id} rawBytes`).toBe(field.length);
      }
    }
  });
});

describe('EtherCAT — plugin kaydı', () => {
  it('carries the catalog id, category and cross-verified references', () => {
    expect(ethercatPlugin.id).toBe('ethercat');
    expect(ethercatPlugin.category).toBe('industrial-automation');
    expect(ethercatPlugin.parser).toBe(ethercatParser);
    // Karar 2: en az İKİ bağımsız kamu kaynağı disclosure'ı.
    expect(ethercatPlugin.documentation?.references?.length ?? 0).toBeGreaterThanOrEqual(2);
  });

  it('matches every example against its expectedValid flag', () => {
    for (const example of ethercatPlugin.exampleFrames) {
      const result = parseEtherCat(example.bytes);
      const actual = result.success ? result.frame.valid : false;
      expect(actual, `${example.id} expectedValid`).toBe(example.expectedValid ?? true);
    }
  });

  it('uses translation keys, never literal text, for names and descriptions', () => {
    for (const example of ethercatPlugin.exampleFrames) {
      expect(example.name).toMatch(/^protocol\.ethercat\.example\./);
      expect(example.description).toMatch(/^protocol\.ethercat\.example\./);
    }
  });
});
