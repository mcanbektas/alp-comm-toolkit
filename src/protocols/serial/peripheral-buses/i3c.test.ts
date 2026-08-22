import { describe, expect, it } from 'vitest';

import { isParseSuccess } from '@/protocol-core/types';
import type { ParsedField } from '@/protocol-core/types';

import { i3cParser, i3cPlugin, parseI3c } from './i3c';

function fieldById(fields: readonly ParsedField[], id: string): ParsedField {
  const field = fields.find((candidate) => candidate.id === id);
  if (field === undefined) throw new Error(`alan yok: ${id}`);
  return field;
}

function warningCodes(fields: { code: string }[]): string[] {
  return fields.map((warning) => warning.code);
}

describe('i3c eklentisi — CCC çerçeveleri', () => {
  it('broadcast ENEC: 0xFC + 0x00 + olay maskesi', () => {
    const result = parseI3c(Uint8Array.from([0xfc, 0x00, 0x0b]));
    if (!isParseSuccess(result)) throw new Error('çözülmeliydi');

    expect(fieldById(result.frame.fields, 'broadcastAddress').physicalValue).toContain('7-bit 0x7E');
    expect(fieldById(result.frame.fields, 'ccc').physicalValue).toBe('ENEC · Broadcast');
    expect(fieldById(result.frame.fields, 'events').physicalValue).toContain('SIR');
    expect(fieldById(result.frame.fields, 'events').physicalValue).toContain('HJ');
  });

  it('direct GETBCR: CCC baytından SONRA hedef adresi gelir', () => {
    const result = parseI3c(Uint8Array.from([0xfc, 0x8e, 0x11, 0x26]));
    if (!isParseSuccess(result)) throw new Error('çözülmeliydi');

    expect(fieldById(result.frame.fields, 'ccc').physicalValue).toBe('GETBCR · Direct');
    expect(fieldById(result.frame.fields, 'targetAddress').physicalValue).toContain('7-bit 0x08');
    // BCR 0x26 = 0b0010_0110 → HDR + IBI payload + IBI req.
    const bcr = fieldById(result.frame.fields, 'bcr').physicalValue;
    expect(bcr).toContain('Target');
    expect(bcr).toContain('HDR');
    expect(bcr).toContain('IBI payload');
  });

  it('direct GETSTATUS gövdesi 16 bit big endian çözülür', () => {
    const result = parseI3c(Uint8Array.from([0xfc, 0x90, 0x11, 0x00, 0x25]));
    if (!isParseSuccess(result)) throw new Error('çözülmeliydi');
    const status = fieldById(result.frame.fields, 'status');
    expect(status.rawValue).toBe('0x0025');
    // 0x25 = 0b0010_0101 → bekleyen kesme 5, protokol hatası biti (0x20) kurulu.
    expect(status.physicalValue).toContain('Pending IRQ 5');
    expect(status.physicalValue).toContain('Protocol error');
  });

  it('bilinmeyen CCC kodu uyarı üretir, ad UYDURULMAZ', () => {
    const result = parseI3c(Uint8Array.from([0xfc, 0x40, 0x00]));
    if (!isParseSuccess(result)) throw new Error('çözülmeliydi');
    expect(fieldById(result.frame.fields, 'ccc').physicalValue).toContain('Unknown CCC');
    expect(warningCodes(result.frame.warnings)).toContain('unknown-ccc');
  });

  it('satıcı tanımlı CCC ayrı uyarı üretir', () => {
    const result = parseI3c(Uint8Array.from([0xfc, 0x62, 0xaa]));
    if (!isParseSuccess(result)) throw new Error('çözülmeliydi');
    expect(warningCodes(result.frame.warnings)).toContain('vendor-ccc');
  });

  it('ENTHDR tanınır ama sonrası ÇÖZÜLMEZ — uyarı bunu söyler', () => {
    const result = parseI3c(Uint8Array.from([0xfc, 0x20, 0x11, 0x22]));
    if (!isParseSuccess(result)) throw new Error('çözülmeliydi');
    expect(fieldById(result.frame.fields, 'ccc').physicalValue).toBe('ENTHDR0 · Broadcast');
    expect(warningCodes(result.frame.warnings)).toContain('enthdr-opaque');
  });

  it('direct CCC hedef adresi eksikse reddedilir', () => {
    const result = parseI3c(Uint8Array.from([0xfc, 0x8e]));
    expect(isParseSuccess(result)).toBe(false);
    if (isParseSuccess(result)) return;
    expect(result.error.code).toBe('truncated-frame');
  });
});

describe('i3c eklentisi — ENTDAA (spec bus discovery örneği)', () => {
  /** Spec'in "Bus discovery görünümü" iki hedefi: PID 0x123456789ABC→0x08, 0x00A112334455→0x09. */
  const ENTDAA = Uint8Array.from([
    0xfc, 0x07, 0xfd, 0x12, 0x34, 0x56, 0x78, 0x9a, 0xbc, 0x06, 0x00, 0x10, 0x00, 0xa1, 0x12, 0x33,
    0x44, 0x55, 0x00, 0x00, 0x12,
  ]);

  it('iki hedefi de PID/BCR/DCR/atanan adres olarak açar', () => {
    const result = parseI3c(ENTDAA);
    if (!isParseSuccess(result)) throw new Error('çözülmeliydi');

    expect(fieldById(result.frame.fields, 'pid-0').rawValue).toBe('0x123456789ABC');
    expect(fieldById(result.frame.fields, 'assignedAddress-0').physicalValue).toBe('DA 0x08');

    expect(fieldById(result.frame.fields, 'pid-1').rawValue).toBe('0x00A112334455');
    expect(fieldById(result.frame.fields, 'assignedAddress-1').physicalValue).toBe('DA 0x09');
  });

  it('DCR 0x00 Generic Device diye adlanır', () => {
    const result = parseI3c(ENTDAA);
    if (!isParseSuccess(result)) throw new Error('çözülmeliydi');
    expect(fieldById(result.frame.fields, 'dcr-0').physicalValue).toBe('Generic Device');
  });

  it('atanan adresin parite VARSAYIMI uyarı olarak basılır — gizlenmez', () => {
    const result = parseI3c(ENTDAA);
    if (!isParseSuccess(result)) throw new Error('çözülmeliydi');
    expect(warningCodes(result.frame.warnings)).toContain('daa-parity-assumed');
  });

  it('yarım tanıtım bloğu yorumlanmaz, ham kuyruk olarak basılır', () => {
    const truncated = ENTDAA.slice(0, 16);
    const result = parseI3c(truncated);
    if (!isParseSuccess(result)) throw new Error('çözülmeliydi');
    expect(warningCodes(result.frame.warnings)).toContain('daa-truncated');
    expect(fieldById(result.frame.fields, 'payload').name).toBe('Unparsed tail');
  });

  it('bilinmeyen DCR uyarı üretir', () => {
    const withOddDcr = Uint8Array.from(ENTDAA);
    withOddDcr[10] = 0x2a;
    const result = parseI3c(withOddDcr);
    if (!isParseSuccess(result)) throw new Error('çözülmeliydi');
    expect(warningCodes(result.frame.warnings)).toContain('unknown-dcr');
    expect(fieldById(result.frame.fields, 'dcr-0').physicalValue).toBeUndefined();
  });
});

describe('i3c eklentisi — private SDR ve IBI ayrımı', () => {
  const READ_LIKE = Uint8Array.from([0x11, 0x40, 0x01, 0x23]);

  it("auto: yazma transaction'ında IBI belirsizliği uyarısı YOK", () => {
    const result = parseI3c(Uint8Array.from([0x10, 0x2f, 0xa5, 0x5a]));
    if (!isParseSuccess(result)) throw new Error('çözülmeliydi');
    expect(fieldById(result.frame.fields, 'targetAddress').physicalValue).toContain('Write');
    expect(warningCodes(result.frame.warnings)).not.toContain('ibi-ambiguous');
  });

  it('auto: OKUMA transaction bir IBI de olabilir — belirsizlik uyarı olarak basılır', () => {
    const result = parseI3c(READ_LIKE);
    if (!isParseSuccess(result)) throw new Error('çözülmeliydi');
    expect(warningCodes(result.frame.warnings)).toContain('ibi-ambiguous');
    // `auto`da MDB adlandırılmaz — bilinmediği için veri olarak basılır.
    expect(result.frame.fields.some((field) => field.id === 'mdb')).toBe(false);
  });

  it('frameKind=ibi seçilince AYNI baytlar MDB + payload olarak açılır', () => {
    const result = parseI3c(READ_LIKE, { frameKind: 'ibi' });
    if (!isParseSuccess(result)) throw new Error('çözülmeliydi');

    expect(fieldById(result.frame.fields, 'ibiAddress').physicalValue).toContain('7-bit 0x08');
    expect(fieldById(result.frame.fields, 'mdb').rawValue).toBe('0x40');
    expect(fieldById(result.frame.fields, 'payload').name).toBe('IBI Payload');
    // Kullanıcı söylediyse belirsizlik kalmaz.
    expect(warningCodes(result.frame.warnings)).not.toContain('ibi-ambiguous');
  });

  it('frameKind=private-sdr 0xFC ile başlayan baytları CCC saymaz', () => {
    const result = parseI3c(Uint8Array.from([0xfc, 0x00, 0x0b]), { frameKind: 'private-sdr' });
    if (!isParseSuccess(result)) throw new Error('çözülmeliydi');
    expect(result.frame.fields.some((field) => field.id === 'ccc')).toBe(false);
    expect(fieldById(result.frame.fields, 'targetAddress').physicalValue).toContain('7-bit 0x7E');
  });

  it('frameKind=ccc 0xFC ile başlamayan baytları da CCC olarak çözer', () => {
    const result = parseI3c(Uint8Array.from([0x10, 0x8e, 0x11, 0x26]), { frameKind: 'ccc' });
    if (!isParseSuccess(result)) throw new Error('çözülmeliydi');
    expect(fieldById(result.frame.fields, 'ccc').physicalValue).toBe('GETBCR · Direct');
  });
});

describe('i3c eklentisi — seçenek bildirimi ve örnekler', () => {
  it('frameKind dört şık bildirir', () => {
    const option = (i3cPlugin.decodeOptions ?? []).find((candidate) => candidate.id === 'frameKind');
    expect(option?.kind).toBe('select');
    expect((option?.choices ?? []).map((choice) => choice.value)).toEqual([
      'auto',
      'ccc',
      'private-sdr',
      'ibi',
    ]);
  });

  it('her örnek varsayılan seçeneklerle çözülür', () => {
    for (const example of i3cPlugin.exampleFrames) {
      const result = i3cParser.parse(example.bytes);
      expect(isParseSuccess(result), `örnek çözülmedi: ${example.id}`).toBe(true);
    }
  });

  it('boş arabellek reddedilir', () => {
    const result = parseI3c(new Uint8Array());
    expect(isParseSuccess(result)).toBe(false);
    if (isParseSuccess(result)) return;
    expect(result.error.code).toBe('truncated-frame');
  });

  it('HDR ve hot-join çerçeveleri KAPSAM DIŞI — sahte alan üretilmez', () => {
    // ENTHDR sonrası baytlar payload olarak kalır, HDR alanı diye açılmaz.
    const result = parseI3c(Uint8Array.from([0xfc, 0x21, 0xde, 0xad, 0xbe, 0xef]));
    if (!isParseSuccess(result)) throw new Error('çözülmeliydi');
    expect(fieldById(result.frame.fields, 'payload').name).toBe('Payload');
  });
});
