import { describe, expect, it } from 'vitest';

import { ftpParser, ftpPlugin, parseFtp } from './ftp';
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

const enc = (text: string): Uint8Array => new TextEncoder().encode(text);

describe('plugin kaydı', () => {
  it('kimlik/kategori/parser bağı katalogla eşleşir', () => {
    expect(ftpPlugin.id).toBe('ftp');
    expect(ftpPlugin.category).toBe('network-ethernet');
    expect(ftpPlugin.parser?.protocolId).toBe('ftp');
    expect(ftpPlugin.exampleFrames.length).toBeGreaterThan(0);
  });

  it('her örnek çerçeve çözülür ve expectedValid ile eşleşir', () => {
    for (const example of ftpPlugin.exampleFrames) {
      const result = ftpParser.parse(example.bytes);
      if (!result.success) {
        throw new Error(`example "${example.id}" failed: ${result.error.code}`);
      }
      expect(result.frame.valid, `example "${example.id}"`).toBe(example.expectedValid ?? true);
    }
  });

  it('her örnek adı/açıklaması protocol.ftp. önekli çeviri anahtarıdır', () => {
    for (const example of ftpPlugin.exampleFrames) {
      expect(example.name.startsWith('protocol.ftp.'), example.id).toBe(true);
      expect(example.description?.startsWith('protocol.ftp.'), example.id).toBe(true);
    }
  });
});

describe('canParse', () => {
  it('boş girdiyi reddeder', () => {
    expect(ftpParser.canParse(Uint8Array.from([]))).toBe(false);
  });

  it('en az 1 baytı kabul eder', () => {
    expect(ftpParser.canParse(enc('x'))).toBe(true);
  });
});

describe('Yanıt satırı', () => {
  it('bilinen kod anlamına eşlenir, ayırıcı tek satır olarak okunur', () => {
    const { frame } = expectSuccess(ftpParser.parse(enc('220 hi\r\n')));
    expect(fieldById(frame, 'response-code-0').rawValue).toBe(220);
    expect(fieldById(frame, 'response-code-0').physicalValue).toBe('Service ready for new user');
    expect(fieldById(frame, 'response-multiline-0').physicalValue).toBe('Final Line');
    expect(fieldById(frame, 'response-text-4').physicalValue).toBe('hi');
  });

  it('bilinmeyen ama geçerli sınıftaki kod, sınıf adına düşer', () => {
    const { frame } = expectSuccess(ftpParser.parse(enc('211-Extensions supported\r\n')));
    expect(fieldById(frame, 'response-code-0').physicalValue).toBe('Positive Completion Reply');
    expect(fieldById(frame, 'response-multiline-0').physicalValue).toBe('Continues');
  });
});

describe('Komut satırı', () => {
  it('bilinen fiil anlamına eşlenir, argüman ayrılır', () => {
    const { frame } = expectSuccess(ftpParser.parse(enc('RETR firmware.bin\r\n')));
    expect(fieldById(frame, 'command-verb-0').physicalValue).toBe('Retrieve (download) a file');
    expect(fieldById(frame, 'command-argument-5').physicalValue).toBe('firmware.bin');
  });

  it('PASS argümanı physicalValue’da redakte edilir, rawBytes gerçek kalır', () => {
    const { frame } = expectSuccess(ftpParser.parse(enc('PASS secret123\r\n')));
    const argument = fieldById(frame, 'command-argument-5');
    expect(argument.physicalValue).toBe('********');
    expect(new TextDecoder().decode(argument.rawBytes)).toBe('secret123');
  });

  it('argümansız komutta Argument alanı basılmaz', () => {
    const { frame } = expectSuccess(ftpParser.parse(enc('QUIT\r\n')));
    expect(fieldById(frame, 'command-verb-0').physicalValue).toBe('End the session');
    expect(hasField(frame, 'command-argument-4')).toBe(false);
  });

  it('bilinmeyen fiil physicalValue basmaz ama Command alanı yine oluşur', () => {
    const { frame } = expectSuccess(ftpParser.parse(enc('NOOP\r\n')));
    expect(fieldById(frame, 'command-verb-0').physicalValue).toBeUndefined();
  });
});

describe('Unclassified Line', () => {
  it('ne yanıt ne komut kalıbına uyan satır ham gösterilir, uyarı basmaz', () => {
    const { frame } = expectSuccess(ftpParser.parse(enc('12ab garbage\r\n')));
    expect(fieldById(frame, 'unclassified-line-0').physicalValue).toBe('12ab garbage');
    expect(frame.warnings).toEqual([]);
  });
});

describe('Çok satırlı girdi', () => {
  it('birden çok satır aynı çerçevede sırayla çözülür', () => {
    const { frame } = expectSuccess(ftpParser.parse(enc('220 hi\r\nUSER a\r\n')));
    expect(fieldById(frame, 'response-code-0').rawValue).toBe(220);
    expect(fieldById(frame, 'command-verb-8').physicalValue).toBe('Provide username');
    expect(fieldById(frame, 'command-argument-13').physicalValue).toBe('a');
  });

  it('yalın LF de satır sonu sayılır (CR olmadan)', () => {
    const { frame } = expectSuccess(ftpParser.parse(enc('220 hi\nUSER a\n')));
    expect(fieldById(frame, 'response-code-0').rawValue).toBe(220);
    expect(fieldById(frame, 'command-verb-7').physicalValue).toBe('Provide username');
  });

  it('son satırda sonlandırıcı unutulmuşsa yine de çözülür', () => {
    const { frame } = expectSuccess(ftpParser.parse(enc('QUIT')));
    expect(fieldById(frame, 'command-verb-0').physicalValue).toBe('End the session');
  });

  it('boş satırlar sessizce atlanır', () => {
    const { frame } = expectSuccess(ftpParser.parse(enc('220 hi\r\n\r\nQUIT\r\n')));
    expect(frame.fields.some((f) => f.id.startsWith('unclassified-line'))).toBe(false);
  });
});

describe('Boş girdi', () => {
  it('truncated-frame ile başarısız olur', () => {
    const { error } = expectFailure(ftpParser.parse(Uint8Array.from([])));
    expect(error.code).toBe('truncated-frame');
  });
});

describe('parseFtp yardımcı fonksiyonu', () => {
  it('bağlamsız çağrıda parser ile aynı alanları üretir', () => {
    const bytes = enc('220 hi\r\n');
    const { frame } = expectSuccess(parseFtp(bytes));
    expect(frame.fields).toEqual(expectSuccess(ftpParser.parse(bytes)).frame.fields);
  });
});
