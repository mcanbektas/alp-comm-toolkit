import { describe, expect, it } from 'vitest';

import type { ParsedField, ProtocolError, ProtocolWarning } from '@/protocol-core/types';

import {
  KEY_ID_MODE_NAMES,
  SECURITY_LEVEL_NAMES,
  decodeAuxSecurityHeader,
  isEncryptedSecurityLevel,
  keyIdentifierLength,
  micLengthForSecurityLevel,
  pushMic,
} from './auxSecurityHeader';

const MESSAGES = {
  truncated: 'test.auxTruncated',
  micNotVerifiable: 'test.micNotVerifiable',
};

interface Sink {
  fields: ParsedField[];
  warnings: ProtocolWarning[];
  errors: ProtocolError[];
}

function sink(): Sink {
  return { fields: [], warnings: [], errors: [] };
}

function fieldById(fields: readonly ParsedField[], id: string): ParsedField {
  const field = fields.find((candidate) => candidate.id === id);
  if (field === undefined) throw new Error(`alan yok: ${id}`);
  return field;
}

describe('auxSecurityHeader — Security Level tabloları (§7.4.1.1 Table 9-6)', () => {
  it('MIC uzunluğu seviyeden gelir: 0→0 · 1→4 · 2→8 · 3→16 · 4→0 · 5→4 · 6→8 · 7→16', () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7].map(micLengthForSecurityLevel)).toEqual([
      0, 4, 8, 16, 0, 4, 8, 16,
    ]);
  });

  it('Level ≥ 4 ŞİFRELİ demektir; 1-3 yalnız bütünlüktür ve yük AÇIKTIR', () => {
    expect([0, 1, 2, 3].map(isEncryptedSecurityLevel)).toEqual([false, false, false, false]);
    expect([4, 5, 6, 7].map(isEncryptedSecurityLevel)).toEqual([true, true, true, true]);
  });

  it('Key Identifier uzunluğu Mode 0/1/2/3 için 0/1/5/9 B\'dir', () => {
    expect([0, 1, 2, 3].map(keyIdentifierLength)).toEqual([0, 1, 5, 9]);
  });

  it('seviye ve kip ADLARI VERİDİR ve tablodan gelir', () => {
    expect(SECURITY_LEVEL_NAMES.get(5)).toBe('ENC-MIC-32');
    expect(SECURITY_LEVEL_NAMES.get(0)).toBe('None');
    expect(KEY_ID_MODE_NAMES.get(2)).toBe('Key Source (4 octets) + Key Index');
  });
});

describe('auxSecurityHeader — alan yerleşimi', () => {
  it('Key Id Mode 2 + Level 5 ⇒ 1 + 4 + (4 + 1) = 10 B ve MIC 4 B', () => {
    // Security Control 0x15 = Level 5, Key Id Mode 2, Suppression 0, ASN 0.
    const data = Uint8Array.from([
      0x15, 0x2a, 0x00, 0x00, 0x00, 0xde, 0xad, 0xbe, 0xef, 0x03, 0xaa, 0xbb,
    ]);
    const s = sink();
    const aux = decodeAuxSecurityHeader(
      data,
      0,
      data.length,
      s.fields,
      s.warnings,
      s.errors,
      MESSAGES,
      'mac-sec',
      'MAC',
    );

    expect(aux.length).toBe(10);
    expect(aux.securityLevel).toBe(5);
    expect(aux.keyIdMode).toBe(2);
    expect(aux.frameCounter).toBe(0x2a);
    expect(aux.keyIndex).toBe(0x03);
    expect(aux.micLength).toBe(4);
    expect(aux.encrypted).toBe(true);
    expect(aux.truncated).toBe(false);
    expect(s.errors).toEqual([]);

    expect(s.fields.map((field) => field.id)).toEqual([
      'mac-sec-control',
      'mac-sec-level',
      'mac-sec-key-id-mode',
      'mac-sec-frame-counter-suppression',
      'mac-sec-asn-in-nonce',
      'mac-sec-frame-counter',
      'mac-sec-key-source',
      'mac-sec-key-index',
    ]);
    expect(fieldById(s.fields, 'mac-sec-key-source').offset).toBe(5);
    expect(fieldById(s.fields, 'mac-sec-key-source').length).toBe(4);
    expect(fieldById(s.fields, 'mac-sec-key-index').offset).toBe(9);
    // MIC anahtarsız doğrulanamaz — çerçeve uyarısı DÜŞER.
    expect(s.warnings.map((warning) => warning.code)).toContain(MESSAGES.micNotVerifiable);
  });

  it('Frame Counter Suppression = 1 ⇒ sayaç alanı HİÇ YOK, başlık 4 bayt kısalır', () => {
    // 0x25 = Level 5, Key Id Mode 0, Suppression 1.
    const data = Uint8Array.from([0x25, 0xaa, 0xbb, 0xcc, 0xdd]);
    const s = sink();
    const aux = decodeAuxSecurityHeader(
      data,
      0,
      data.length,
      s.fields,
      s.warnings,
      s.errors,
      MESSAGES,
      'mle-sec',
      'MLE',
    );
    expect(aux.frameCounterSuppressed).toBe(true);
    expect(aux.frameCounter).toBeUndefined();
    expect(aux.length).toBe(1);
    expect(s.fields.some((field) => field.id === 'mle-sec-frame-counter')).toBe(false);
  });

  it('Key Id Mode 1\'de Key Source YOK, yalnız 1 baytlık Key Index vardır', () => {
    // 0x0D = Level 5, Key Id Mode 1.
    const data = Uint8Array.from([0x0d, 0x2a, 0x00, 0x00, 0x00, 0x05, 0x99]);
    const s = sink();
    const aux = decodeAuxSecurityHeader(
      data,
      0,
      data.length,
      s.fields,
      s.warnings,
      s.errors,
      MESSAGES,
      'mac-sec',
      'MAC',
    );
    expect(aux.length).toBe(6);
    expect(aux.keyIndex).toBe(5);
    expect(s.fields.some((field) => field.id === 'mac-sec-key-source')).toBe(false);
  });

  it('`securityLevelOverride` MIC uzunluğunu, yani yükün NEREDE bittiğini değiştirir', () => {
    const data = Uint8Array.from([0x0d, 0x2a, 0x00, 0x00, 0x00, 0x05, 0x99, 0x99, 0x99]);
    const s = sink();
    const forced = decodeAuxSecurityHeader(
      data,
      0,
      data.length,
      s.fields,
      s.warnings,
      s.errors,
      MESSAGES,
      'mac-sec',
      'MAC',
      2, // MIC-64, ŞİFRESİZ
    );
    expect(forced.securityLevel).toBe(2);
    expect(forced.micLength).toBe(8);
    expect(forced.encrypted).toBe(false);
    // Başlık uzunluğu Key Id Mode'dan gelir ve override'dan ETKİLENMEZ.
    expect(forced.length).toBe(6);
  });

  it('başlık çerçeveye sığmazsa `truncated-frame` basar ve üst zincire GİRİLMEZ', () => {
    const data = Uint8Array.from([0x0d, 0x2a]); // 4 baytlık sayaç sığmıyor
    const s = sink();
    const aux = decodeAuxSecurityHeader(
      data,
      0,
      data.length,
      s.fields,
      s.warnings,
      s.errors,
      MESSAGES,
      'mac-sec',
      'MAC',
    );
    expect(aux.truncated).toBe(true);
    expect(s.errors[0]?.code).toBe('truncated-frame');
    expect(s.errors[0]?.message).toBe(MESSAGES.truncated);
  });
});

describe('auxSecurityHeader — MIC PASS/FAIL BASILMAZ', () => {
  it('MIC bir ALAN olarak basılır ama `physicalValue` (verdict) TAŞIMAZ', () => {
    const data = Uint8Array.from([0, 1, 2, 3, 4, 5, 6, 7, 0xaa, 0xbb, 0xcc, 0xdd]);
    const fields: ParsedField[] = [];
    pushMic(data, data.length, 4, fields, 'mac-sec', 'MAC', MESSAGES.micNotVerifiable);

    expect(fields).toHaveLength(1);
    const mic = fields[0];
    expect(mic?.id).toBe('mac-sec-mic');
    expect(mic?.offset).toBe(8);
    expect(mic?.length).toBe(4);
    // 🚨 Dalga 13 dersi 3: anahtar yoksa PASS da FAIL de basılmaz.
    expect(mic?.physicalValue).toBeUndefined();
    expect(mic?.valid).toBe(true);
    expect(mic?.warnings).toEqual([MESSAGES.micNotVerifiable]);
  });

  it('MIC uzunluğu 0 ise (Level 0 / 4) alan HİÇ BASILMAZ', () => {
    const fields: ParsedField[] = [];
    pushMic(Uint8Array.from([1, 2, 3]), 3, 0, fields, 'mac-sec', 'MAC', MESSAGES.micNotVerifiable);
    expect(fields).toEqual([]);
  });
});
