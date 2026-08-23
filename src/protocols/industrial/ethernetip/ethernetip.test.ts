import { describe, expect, it } from 'vitest';

import { ethernetIpParser, ethernetIpPlugin, parseEthernetIp } from './ethernetip';
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

function warningCodes(frame: ParsedFrame): string[] {
  return frame.warnings.map((warning) => warning.code);
}

describe('parseEthernetIp — encapsulation başlığı', () => {
  it('RegisterSession başlığını ve Protocol Version/Options Flags’i çözer', () => {
    const example = ethernetIpPlugin.exampleFrames.find((f) => f.id === 'register-session-request');
    if (example === undefined) throw new Error('example not found');
    const { frame } = expectSuccess(parseEthernetIp(example.bytes));

    expect(fieldById(frame, 'command').physicalValue).toBe('Register Session');
    expect(fieldById(frame, 'length').rawValue).toBe(4);
    expect(fieldById(frame, 'status').physicalValue).toBe('Success');
    expect(fieldById(frame, 'protocol-version').rawValue).toBe(1);
    expect(fieldById(frame, 'options-flags').rawValue).toBe(0);
    expect(frame.valid).toBe(true);
  });

  it('tanınmayan komut kodunda uyarır ama çerçeveyi yine gösterir', () => {
    const bytes = new Uint8Array(24);
    bytes[0] = 0xff;
    bytes[1] = 0xff;
    const { frame } = expectSuccess(parseEthernetIp(bytes));
    expect(fieldById(frame, 'command').physicalValue).toBeUndefined();
    expect(warningCodes(frame)).toContain('protocol.ethernetip.warning.unknownCommand');
  });

  it('Length alanı gerçek gövde uzunluğuyla uyuşmazsa uyarır', () => {
    const bytes = new Uint8Array(24);
    bytes[2] = 0x0a; // Length=10 iddia ediyor, gövde 0 bayt.
    const { frame } = expectSuccess(parseEthernetIp(bytes));
    expect(fieldById(frame, 'length').valid).toBe(false);
    expect(warningCodes(frame)).toContain('protocol.ethernetip.warning.lengthMismatch');
  });
});

describe('parseEthernetIp — SendRRData → CPF → CIP çekirdeği', () => {
  it('Unconnected Data Item içindeki CIP isteğini decodeCipMessage ile çözer', () => {
    const example = ethernetIpPlugin.exampleFrames.find(
      (f) => f.id === 'send-rr-data-get-attribute-single',
    );
    if (example === undefined) throw new Error('example not found');
    const { frame } = expectSuccess(parseEthernetIp(example.bytes));

    expect(fieldById(frame, 'interface-handle').rawValue).toBe(0);
    expect(fieldById(frame, 'cpf-item-count').rawValue).toBe(2);
    expect(fieldById(frame, 'cpf-item-1-type').physicalValue).toBe('Null Address Item');
    expect(fieldById(frame, 'cpf-item-2-type').physicalValue).toBe('Unconnected Data Item');
    // CIP çekirdeği bu depodaki AYNI alan adlarını üretir (cip.ts ile ortak).
    expect(fieldById(frame, 'cpf-item-2-cip-service').physicalValue).toBe('Get_Attribute_Single');
    expect(fieldById(frame, 'cpf-item-2-cip-path-class').rawValue).toBe(1);
    expect(fieldById(frame, 'cpf-item-2-cip-path-instance').rawValue).toBe(1);
    expect(frame.valid).toBe(true);
  });

  it('CPF item uzunluğu tamponu aşarsa hata basar (frame.valid=false)', () => {
    const example = ethernetIpPlugin.exampleFrames.find(
      (f) => f.id === 'send-rr-data-cpf-item-truncated',
    );
    if (example === undefined) throw new Error('example not found');
    const { frame } = expectSuccess(parseEthernetIp(example.bytes));
    expect(frame.valid).toBe(false);
    expect(frame.errors.some((e) => e.code === 'truncated-frame')).toBe(true);
  });
});

describe('parseEthernetIp — SendUnitData → Connected Data Item (Sequence Count tuzağı)', () => {
  it('Sequence Count’u CIP mesajından AYRI bir alan olarak basar, gerisini cipCore’a devreder', () => {
    const example = ethernetIpPlugin.exampleFrames.find(
      (f) => f.id === 'send-unit-data-connected-response',
    );
    if (example === undefined) throw new Error('example not found');
    const { frame } = expectSuccess(parseEthernetIp(example.bytes));

    expect(fieldById(frame, 'cpf-item-1-type').physicalValue).toBe('Connected Address Item');
    expect(fieldById(frame, 'cpf-item-1-connection-id').rawValue).toBe(0x11223344);
    expect(fieldById(frame, 'cpf-item-2-type').physicalValue).toBe('Connected Data Item');
    expect(fieldById(frame, 'cpf-item-2-sequence-count').rawValue).toBe(1);
    // Sequence Count atlanmasaydı Reply Service baytı 0x01 (yanlış) okunurdu.
    expect(fieldById(frame, 'cpf-item-2-cip-reply-service').physicalValue).toBe(
      'Get_Attribute_Single (Reply)',
    );
    expect(fieldById(frame, 'cpf-item-2-cip-general-status').physicalValue).toBe('Success');
  });
});

describe('ethernetIpParser', () => {
  it('canParse tam başlık uzunluğunu ve tanınan komutu ister', () => {
    expect(ethernetIpParser.canParse(new Uint8Array(23))).toBe(false);
    const registerSession = new Uint8Array(24);
    registerSession[0] = 0x65; // Register Session = 0x0065.
    expect(ethernetIpParser.canParse(registerSession)).toBe(true);
    const unknown = new Uint8Array(24);
    unknown[0] = 0xaa;
    unknown[1] = 0xaa;
    expect(ethernetIpParser.canParse(unknown)).toBe(false);
  });

  it('başlıktan kısa girdide truncated-frame döner', () => {
    expect(expectFailure(parseEthernetIp(new Uint8Array(10))).error.code).toBe('truncated-frame');
  });

  it('iptal edilmiş signal’da parser-timeout döner', () => {
    const controller = new AbortController();
    controller.abort();
    const result = expectFailure(
      ethernetIpParser.parse(new Uint8Array(24), { signal: controller.signal }),
    );
    expect(result.error.code).toBe('parser-timeout');
  });
});

describe('ethernetIpPlugin', () => {
  it('katalogdaki kimlik, kategori ve parser bağını taşır', () => {
    expect(ethernetIpPlugin.id).toBe('ethernet-ip');
    expect(ethernetIpPlugin.category).toBe('industrial-automation');
    expect(ethernetIpPlugin.parser).toBe(ethernetIpParser);
  });

  it('her örnek çözülür ve expectedValid ile eşleşir', () => {
    for (const example of ethernetIpPlugin.exampleFrames) {
      const result = ethernetIpParser.parse(example.bytes);
      if (!result.success) {
        throw new Error(`example "${example.id}" failed: ${result.error.code}`);
      }
      expect(result.frame.valid, `example "${example.id}"`).toBe(example.expectedValid ?? true);
    }
  });

  it('her örnek adı/açıklaması protocol.ethernetip.example. önekli çeviri anahtarıdır', () => {
    for (const example of ethernetIpPlugin.exampleFrames) {
      expect(example.name.startsWith('protocol.ethernetip.example.'), example.id).toBe(true);
      expect(example.description?.startsWith('protocol.ethernetip.example.'), example.id).toBe(true);
    }
  });
});
