import { describe, expect, it } from 'vitest';

import type { ParsedField, ProtocolError, ProtocolWarning } from '@/protocol-core/types';

import {
  ENCRYPTED_PAYLOAD_HEX,
  ENCRYPTED_PAYLOAD_MARKED,
  MLE_COMMAND_DISCOVERY_REQUEST,
  MLE_COMMAND_DISCOVERY_RESPONSE,
  MLE_COMMAND_NAMES,
  MLE_SECURITY_SUITE_802154,
  MLE_SECURITY_SUITE_NONE,
  MLE_UDP_PORT,
  decodeMle,
} from './mle';
import type { MleMessages, MleOptions } from './mle';

const MESSAGES: MleMessages = {
  truncated: 'test.auxTruncated',
  micNotVerifiable: 'test.micNotVerifiable',
  unknownSecuritySuite: 'test.unknownSuite',
  encryptedCommandNotReadable: 'test.encryptedCommand',
  commandNotDecoded: 'test.commandNotDecoded',
  tlvsNotDecoded: 'test.tlvsNotDecoded',
};

const DEFAULT_OPTIONS: MleOptions = {
  encryptedPayloadDisplay: ENCRYPTED_PAYLOAD_MARKED,
  securityLevelOverride: undefined,
};

interface Sink {
  fields: ParsedField[];
  warnings: ProtocolWarning[];
  errors: ProtocolError[];
}

function sink(): Sink {
  return { fields: [], warnings: [], errors: [] };
}

function ids(fields: readonly ParsedField[]): string[] {
  return fields.map((field) => field.id);
}

function fieldById(fields: readonly ParsedField[], id: string): ParsedField {
  const field = fields.find((candidate) => candidate.id === id);
  if (field === undefined) throw new Error(`alan yok: ${id}`);
  return field;
}

describe('mle — sabitler ADLARI VERİDİR', () => {
  it('UDP portu 19788 = 0x4D4C = ASCII "ML"', () => {
    expect(MLE_UDP_PORT).toBe(19788);
    expect(MLE_UDP_PORT).toBe(0x4d4c);
    expect(String.fromCharCode(0x4d, 0x4c)).toBe('ML');
  });

  it('şifresiz gönderilen İKİ komut 16 ve 17\'dir', () => {
    expect(MLE_COMMAND_DISCOVERY_REQUEST).toBe(16);
    expect(MLE_COMMAND_DISCOVERY_RESPONSE).toBe(17);
    expect(MLE_COMMAND_NAMES.get(16)).toBe('Discovery Request');
    expect(MLE_COMMAND_NAMES.get(17)).toBe('Discovery Response');
    // Sözlük 0-20'yi kapsar ama pratikte yalnız 16/17 telde OKUNABİLİR.
    expect(MLE_COMMAND_NAMES.get(9)).toBe('Parent Request');
    expect(MLE_COMMAND_NAMES.size).toBe(21);
  });
});

describe('mle — ŞİFRESİZ dal (Security Suite 255)', () => {
  it('Discovery Request: süit ve komut adlandırılır, TLV\'ler ham kalır', () => {
    const data = Uint8Array.from([0xff, 0x10, 0x0d, 0x02, 0x00, 0x02, 0x01]);
    const s = sink();
    const summary = decodeMle(
      data,
      0,
      data.length,
      s.fields,
      s.warnings,
      s.errors,
      DEFAULT_OPTIONS,
      MESSAGES,
    );

    expect(summary?.securitySuite).toBe(MLE_SECURITY_SUITE_NONE);
    expect(summary?.encrypted).toBe(false);
    expect(summary?.command).toBe(16);
    expect(summary?.commandName).toBe('Discovery Request');

    expect(ids(s.fields)).toEqual(['mle-security-suite', 'mle-command', 'mle-tlvs']);
    expect(fieldById(s.fields, 'mle-security-suite').physicalValue).toBe('No Security');
    expect(fieldById(s.fields, 'mle-command').physicalValue).toBe('Discovery Request');
    expect(fieldById(s.fields, 'mle-tlvs').offset).toBe(2);
    expect(fieldById(s.fields, 'mle-tlvs').length).toBe(5);
    expect(s.warnings.map((warning) => warning.code)).toContain(MESSAGES.tlvsNotDecoded);
    expect(s.warnings.map((warning) => warning.code)).not.toContain(MESSAGES.commandNotDecoded);
  });

  it('Discovery Response de şifresiz gönderilir', () => {
    const data = Uint8Array.from([0xff, 0x11]);
    const s = sink();
    const summary = decodeMle(
      data,
      0,
      data.length,
      s.fields,
      s.warnings,
      s.errors,
      DEFAULT_OPTIONS,
      MESSAGES,
    );
    expect(summary?.commandName).toBe('Discovery Response');
    expect(s.warnings.map((warning) => warning.code)).not.toContain(MESSAGES.commandNotDecoded);
  });

  it('🚨 16/17 DIŞINDA bir komut şifresiz görünüyorsa BEKLENMEDİKTİR — uyarı düşer', () => {
    // `mle.cpp:3565-3568`: OpenThread yalnız Discovery için suite 255 kullanır.
    const data = Uint8Array.from([0xff, 0x09]); // Parent Request
    const s = sink();
    const summary = decodeMle(
      data,
      0,
      data.length,
      s.fields,
      s.warnings,
      s.errors,
      DEFAULT_OPTIONS,
      MESSAGES,
    );
    expect(summary?.commandName).toBe('Parent Request');
    expect(s.warnings.map((warning) => warning.code)).toContain(MESSAGES.commandNotDecoded);
  });
});

describe('mle — ŞİFRELİ dal (Security Suite 0): komut tipi OKUNAMAZ', () => {
  const ENCRYPTED = Uint8Array.from([
    0x00, // Security Suite 0 — 802.15.4 Security
    0x15, 0x2a, 0x00, 0x00, 0x00, 0xde, 0xad, 0xbe, 0xef, 0x03, // Aux header (10 B)
    0x9c, 0x4e, 0x71, 0x2b, 0xd8, 0x66, 0x1a, 0x0f, 0x5c, // ciphertext (9 B)
    0x11, 0x22, 0x33, 0x44, // MIC-32
  ]);

  it('süit 0\'da Aux Security Header gelir ve `mle-command` alanı HİÇ BASILMAZ', () => {
    const s = sink();
    const summary = decodeMle(
      ENCRYPTED,
      0,
      ENCRYPTED.length,
      s.fields,
      s.warnings,
      s.errors,
      DEFAULT_OPTIONS,
      MESSAGES,
    );

    expect(summary?.securitySuite).toBe(MLE_SECURITY_SUITE_802154);
    expect(summary?.encrypted).toBe(true);
    // 🚨🚨 OpenThread'in YORUMU süit 0 için "not secured" der; KOD (`mle.cpp:3575`)
    // aksini söyler ve bu modül KODU izler. Komut tipi UYDURULMAZ:
    expect(summary?.command).toBeUndefined();
    expect(summary?.commandName).toBeUndefined();
    expect(ids(s.fields)).not.toContain('mle-command');

    expect(fieldById(s.fields, 'mle-security-suite').physicalValue).toBe('802.15.4 Security');
    expect(fieldById(s.fields, 'mle-sec-level').physicalValue).toBe('ENC-MIC-32');
    expect(fieldById(s.fields, 'mle-encrypted-payload').offset).toBe(11);
    // MIC yükün DIŞINDA: 24 - 11 - 4 = 9 bayt ciphertext.
    expect(fieldById(s.fields, 'mle-encrypted-payload').length).toBe(9);
    expect(fieldById(s.fields, 'mle-sec-mic').offset).toBe(20);
    expect(fieldById(s.fields, 'mle-sec-mic').length).toBe(4);
    // 🚨 MIC PASS/FAIL BASILMAZ.
    expect(fieldById(s.fields, 'mle-sec-mic').physicalValue).toBeUndefined();
    expect(s.warnings.map((warning) => warning.code)).toContain(
      MESSAGES.encryptedCommandNotReadable,
    );
  });

  it('MIC yükten ÇIKARILMAZSA şifreli yük 4 bayt UZUN görünürdü — ölçüm', () => {
    const s = sink();
    decodeMle(
      ENCRYPTED,
      0,
      ENCRYPTED.length,
      s.fields,
      s.warnings,
      s.errors,
      DEFAULT_OPTIONS,
      MESSAGES,
    );
    const payload = fieldById(s.fields, 'mle-encrypted-payload');
    const naiveLength = ENCRYPTED.length - payload.offset; // MIC hesaba katılmasa
    expect(naiveLength).toBe(13);
    expect(payload.length).toBe(naiveLength - 4);
  });

  it('`encryptedPayloadDisplay: hex` yalnız GÖSTERİMİ değiştirir, baytları değil', () => {
    const marked = sink();
    decodeMle(
      ENCRYPTED,
      0,
      ENCRYPTED.length,
      marked.fields,
      marked.warnings,
      marked.errors,
      DEFAULT_OPTIONS,
      MESSAGES,
    );
    const hex = sink();
    decodeMle(
      ENCRYPTED,
      0,
      ENCRYPTED.length,
      hex.fields,
      hex.warnings,
      hex.errors,
      { ...DEFAULT_OPTIONS, encryptedPayloadDisplay: ENCRYPTED_PAYLOAD_HEX },
      MESSAGES,
    );

    const markedPayload = fieldById(marked.fields, 'mle-encrypted-payload');
    const hexPayload = fieldById(hex.fields, 'mle-encrypted-payload');
    expect(markedPayload.physicalValue).toBeUndefined();
    expect(hexPayload.physicalValue).toBe('9C 4E 71 2B D8 66 1A 0F 5C');
    expect(hexPayload.offset).toBe(markedPayload.offset);
    expect(hexPayload.length).toBe(markedPayload.length);
  });

  it('`securityLevelOverride` MIC uzunluğunu, yani ciphertext\'in sonunu kaydırır', () => {
    const s = sink();
    decodeMle(
      ENCRYPTED,
      0,
      ENCRYPTED.length,
      s.fields,
      s.warnings,
      s.errors,
      { ...DEFAULT_OPTIONS, securityLevelOverride: 6 }, // ENC-MIC-64
      MESSAGES,
    );
    expect(fieldById(s.fields, 'mle-encrypted-payload').length).toBe(5);
    expect(fieldById(s.fields, 'mle-sec-mic').length).toBe(8);
  });
});

describe('mle — sınırlar', () => {
  it('tanınmayan süit gövdeyi HAM bırakır ve hiçbir şey uydurmaz', () => {
    const data = Uint8Array.from([0x42, 0x10, 0x20]);
    const s = sink();
    const summary = decodeMle(
      data,
      0,
      data.length,
      s.fields,
      s.warnings,
      s.errors,
      DEFAULT_OPTIONS,
      MESSAGES,
    );
    expect(summary?.command).toBeUndefined();
    expect(ids(s.fields)).toEqual(['mle-security-suite', 'mle-unknown-suite-payload']);
    expect(fieldById(s.fields, 'mle-security-suite').valid).toBe(false);
    expect(s.warnings.map((warning) => warning.code)).toContain(MESSAGES.unknownSecuritySuite);
  });

  it('boş aralıkta hiçbir şey basmaz', () => {
    const s = sink();
    expect(
      decodeMle(
        Uint8Array.from([0xff]),
        1,
        1,
        s.fields,
        s.warnings,
        s.errors,
        DEFAULT_OPTIONS,
        MESSAGES,
      ),
    ).toBeUndefined();
    expect(s.fields).toEqual([]);
  });
});
