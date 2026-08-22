import { describe, expect, it } from 'vitest';

import { parseTftp, tftpParser, tftpPlugin } from './tftp';
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

function hasField(frame: ParsedFrame, id: string): boolean {
  return frame.fields.some((field) => field.id === id);
}

function warningCodes(frame: ParsedFrame): string[] {
  return frame.warnings.map((warning) => warning.code);
}

function ascii(text: string): number[] {
  return Array.from(text, (char) => char.charCodeAt(0));
}

describe('plugin kaydı', () => {
  it('kimlik/kategori/parser bağı katalogla eşleşir', () => {
    expect(tftpPlugin.id).toBe('tftp');
    expect(tftpPlugin.category).toBe('network-ethernet');
    expect(tftpPlugin.parser?.protocolId).toBe('tftp');
    expect(tftpPlugin.exampleFrames.length).toBeGreaterThan(0);
  });

  it('her örnek çerçeve çözülür ve expectedValid ile eşleşir', () => {
    for (const example of tftpPlugin.exampleFrames) {
      const result = tftpParser.parse(example.bytes);
      if (!result.success) {
        throw new Error(`example "${example.id}" failed: ${result.error.code}`);
      }
      expect(result.frame.valid, `example "${example.id}"`).toBe(example.expectedValid ?? true);
    }
  });

  it('her örnek adı/açıklaması protocol.tftp. önekli çeviri anahtarıdır', () => {
    for (const example of tftpPlugin.exampleFrames) {
      expect(example.name.startsWith('protocol.tftp.'), example.id).toBe(true);
      expect(example.description?.startsWith('protocol.tftp.'), example.id).toBe(true);
    }
  });
});

describe('canParse', () => {
  it('2 baytın altını reddeder', () => {
    expect(tftpParser.canParse(Uint8Array.from([0x00]))).toBe(false);
  });

  it('tanınmayan Opcode\'u reddeder', () => {
    expect(tftpParser.canParse(Uint8Array.from([0x00, 0x09]))).toBe(false);
  });

  it('tanınan Opcode\'u kabul eder', () => {
    expect(tftpParser.canParse(Uint8Array.from([0x00, 0x04]))).toBe(true);
  });
});

describe('RRQ / WRQ', () => {
  it('Filename + Mode okunur, tanınan mode için uyarı basmaz', () => {
    const bytes = Uint8Array.from([0x00, 0x01, ...ascii('a.bin'), 0x00, ...ascii('octet'), 0x00]);
    const { frame } = expectSuccess(tftpParser.parse(bytes));
    expect(frame.valid).toBe(true);
    expect(fieldById(frame, 'opcode').physicalValue).toBe('RRQ (Read Request)');
    expect(fieldById(frame, 'filename').physicalValue).toBe('a.bin');
    expect(fieldById(frame, 'mode').physicalValue).toBe('octet');
    expect(warningCodes(frame)).not.toContain('protocol.tftp.warning.unsupportedMode');
  });

  it('WRQ da aynı yoldan geçer', () => {
    const bytes = Uint8Array.from([0x00, 0x02, ...ascii('b.bin'), 0x00, ...ascii('netascii'), 0x00]);
    const { frame } = expectSuccess(tftpParser.parse(bytes));
    expect(fieldById(frame, 'opcode').physicalValue).toBe('WRQ (Write Request)');
  });

  it('tanınmayan mode uyarır ama alanı geçersiz sayar', () => {
    const bytes = Uint8Array.from([0x00, 0x01, ...ascii('a.bin'), 0x00, ...ascii('weird'), 0x00]);
    const { frame } = expectSuccess(tftpParser.parse(bytes));
    expect(fieldById(frame, 'mode').valid).toBe(false);
    expect(warningCodes(frame)).toContain('protocol.tftp.warning.unsupportedMode');
  });

  it('option extension çiftlerini (blksize=1024) okur', () => {
    const bytes = Uint8Array.from([
      0x00, 0x01, ...ascii('a.bin'), 0x00, ...ascii('octet'), 0x00, ...ascii('blksize'), 0x00,
      ...ascii('1024'), 0x00,
    ]);
    const { frame } = expectSuccess(tftpParser.parse(bytes));
    // offset: opcode(2)+filename(5)+NUL(1)+mode(5)+NUL(1) = 14
    expect(fieldById(frame, 'option-name-14').physicalValue).toBe('blksize');
    expect(fieldById(frame, 'option-value-22').physicalValue).toBe('1024');
  });

  it('Filename sonlandırılmamışsa truncated-frame basar', () => {
    const bytes = Uint8Array.from([0x00, 0x01, ...ascii('no-nul-here')]);
    const { frame } = expectSuccess(tftpParser.parse(bytes));
    expect(frame.valid).toBe(false);
    expect(frame.errors[0]?.code).toBe('truncated-frame');
    expect(hasField(frame, 'mode')).toBe(false);
  });

  it('Mode sonlandırılmamışsa truncated-frame basar, Filename yine de görünür', () => {
    const bytes = Uint8Array.from([0x00, 0x01, ...ascii('a.bin'), 0x00, ...ascii('no-nul')]);
    const { frame } = expectSuccess(tftpParser.parse(bytes));
    expect(frame.valid).toBe(false);
    expect(fieldById(frame, 'filename').physicalValue).toBe('a.bin');
  });
});

describe('DATA', () => {
  it('512 baytlık tam blok "Continue" der ve uyarır (klasik varsayım)', () => {
    const bytes = Uint8Array.from([0x00, 0x03, 0x00, 0x01, ...new Array<number>(512).fill(0xaa)]);
    const { frame } = expectSuccess(tftpParser.parse(bytes));
    expect(fieldById(frame, 'block-number').rawValue).toBe(1);
    expect(fieldById(frame, 'data').rawBytes.length).toBe(512);
    expect(fieldById(frame, 'transfer-state').physicalValue).toBe('Continue');
    expect(warningCodes(frame)).toContain('protocol.tftp.warning.blockSizeAssumed');
  });

  it('512 baytın altındaki blok kesin "Final Block" der, uyarmaz', () => {
    const bytes = Uint8Array.from([0x00, 0x03, 0x00, 0x02, 0x61, 0x62, 0x63]);
    const { frame } = expectSuccess(tftpParser.parse(bytes));
    expect(fieldById(frame, 'transfer-state').physicalValue).toBe('Final Block');
    expect(warningCodes(frame)).not.toContain('protocol.tftp.warning.blockSizeAssumed');
  });

  it('sıfır baytlık son blokta Data alanı basılmaz ama Transfer State basılır', () => {
    const bytes = Uint8Array.from([0x00, 0x03, 0x00, 0x03]);
    const { frame } = expectSuccess(tftpParser.parse(bytes));
    expect(hasField(frame, 'data')).toBe(false);
    expect(fieldById(frame, 'transfer-state').physicalValue).toBe('Final Block');
  });
});

describe('ACK', () => {
  it('Block Number okunur', () => {
    const bytes = Uint8Array.from([0x00, 0x04, 0x00, 0x07]);
    const { frame } = expectSuccess(tftpParser.parse(bytes));
    expect(fieldById(frame, 'block-number').rawValue).toBe(7);
  });
});

describe('ERROR', () => {
  it('bilinen Error Code anlamına eşlenir', () => {
    const bytes = Uint8Array.from([0x00, 0x05, 0x00, 0x01, ...ascii('not found'), 0x00]);
    const { frame } = expectSuccess(tftpParser.parse(bytes));
    expect(fieldById(frame, 'error-code').physicalValue).toBe('File not found');
    expect(fieldById(frame, 'error-message').physicalValue).toBe('not found');
  });

  it('bilinmeyen Error Code uyarır, ham değeri korur', () => {
    const bytes = Uint8Array.from([0x00, 0x05, 0x00, 0x63, ...ascii('x'), 0x00]);
    const { frame } = expectSuccess(tftpParser.parse(bytes));
    expect(fieldById(frame, 'error-code').rawValue).toBe(99);
    expect(fieldById(frame, 'error-code').physicalValue).toBeUndefined();
    expect(warningCodes(frame)).toContain('protocol.tftp.warning.unknownErrorCode');
  });

  it('Error Message sonlandırılmamışsa truncated-frame basar', () => {
    const bytes = Uint8Array.from([0x00, 0x05, 0x00, 0x01, ...ascii('no-nul')]);
    const { frame } = expectSuccess(tftpParser.parse(bytes));
    expect(frame.valid).toBe(false);
  });
});

describe('OACK', () => {
  it('opcode\'tan hemen sonra option çiftlerini okur', () => {
    const bytes = Uint8Array.from([0x00, 0x06, ...ascii('blksize'), 0x00, ...ascii('1024'), 0x00]);
    const { frame } = expectSuccess(tftpParser.parse(bytes));
    expect(fieldById(frame, 'option-name-2').physicalValue).toBe('blksize');
    expect(fieldById(frame, 'option-value-10').physicalValue).toBe('1024');
  });
});

describe('Opcode dışı vakalar', () => {
  it('tanınmayan Opcode ile başarısız olur', () => {
    const { error } = expectFailure(tftpParser.parse(Uint8Array.from([0x00, 0x09])));
    expect(error.code).toBe('unsupported-function-code');
  });

  it('2 bayttan kısa girdide truncated-frame ile başarısız olur', () => {
    const { error } = expectFailure(tftpParser.parse(Uint8Array.from([0x00])));
    expect(error.code).toBe('truncated-frame');
  });
});

describe('parseTftp yardımcı fonksiyonu', () => {
  it('bağlamsız çağrıda parser ile aynı alanları üretir', () => {
    const bytes = Uint8Array.from([0x00, 0x04, 0x00, 0x01]);
    const { frame } = expectSuccess(parseTftp(bytes));
    expect(frame.fields).toEqual(expectSuccess(tftpParser.parse(bytes)).frame.fields);
  });
});
