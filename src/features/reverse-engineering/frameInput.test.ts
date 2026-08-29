import { describe, expect, it } from 'vitest';

import { framesFromLogRecords, parseFrameInput } from './frameInput';

/** Spec 35060 RF telemetri seti — analiz motorlarının kanonik fixture'ı. */
const RF_TEXT = ['AA AA 10 00 01 53 21', 'AA AA 10 00 02 61 38', 'AA AA 10 00 03 14 B7'].join('\n');

function hex(frame: { bytes: Uint8Array } | undefined): string {
  return Array.from(frame?.bytes ?? [], (byte) => byte.toString(16).padStart(2, '0')).join(' ');
}

describe('parseFrameInput — satır modu', () => {
  it('her satırı bir çerçeve sayar', () => {
    const result = parseFrameInput(RF_TEXT);
    expect(result.frames).toHaveLength(3);
    expect(hex(result.frames[0])).toBe('aa aa 10 00 01 53 21');
    expect(result.byteCount).toBe(21);
    expect(result.issues).toEqual([]);
  });

  it('boşluksuz, virgüllü, iki noktalı ve 0x önekli yazımı aynı okur', () => {
    const result = parseFrameInput(['AAAA1000', 'AA,AA,10,00', 'AA:AA:10:00', '0xAA 0xAA 0x10 0x00'].join('\n'));
    expect(result.frames).toHaveLength(4);
    const rendered = result.frames.map((frame) => hex(frame));
    expect(new Set(rendered).size).toBe(1);
    expect(rendered[0]).toBe('aa aa 10 00');
  });

  it('köşeli parantezli zaman damgasını alır', () => {
    const result = parseFrameInput('[1000] AA BB\n[1100.5] CC DD');
    expect(result.frames[0]?.timestamp).toBe(1000);
    expect(result.frames[1]?.timestamp).toBe(1100.5);
  });

  it('damga yoksa 0 uydurmaz', () => {
    const result = parseFrameInput('AA BB');
    expect(result.frames[0]?.timestamp).toBeUndefined();
  });

  it('boş satırı ve yorumu atlar, sorun saymaz', () => {
    const result = parseFrameInput('# başlık\nAA BB\n\n// açıklama\nCC DD  # kuyruk yorumu');
    expect(result.frames).toHaveLength(2);
    expect(hex(result.frames[1])).toBe('cc dd');
    expect(result.issues).toEqual([]);
  });

  it('bozuk satırı ATLAR ama satır numarasıyla RAPORLAR', () => {
    const result = parseFrameInput('AA BB\nZZ 11\nAAB\nCC DD');
    expect(result.frames).toHaveLength(2);
    expect(result.issues).toEqual([
      { line: 2, reason: 'not-hex', text: 'ZZ' },
      { line: 3, reason: 'odd-digits', text: 'AAB' },
    ]);
  });

  it('maxFrames sınırında keser ve kesildiğini söyler', () => {
    const result = parseFrameInput(RF_TEXT, { maxFrames: 2 });
    expect(result.frames).toHaveLength(2);
    expect(result.truncated).toBe(true);
  });
});

describe('parseFrameInput — akış modu', () => {
  it('satır sonlarını yok sayıp seçilen yöntemle çerçeveler', () => {
    // Üç satıra bölünmüş TEK bir akış; sınırı 0xAA 0xAA başlangıç imzası çizer.
    const result = parseFrameInput('AA AA 10 00 01 53\n21 AA AA 10 00 02\n61 38 AA AA 10 00 03 14 B7', {
      mode: 'stream',
      framing: { method: 'start-byte', startSequence: [0xaa, 0xaa] },
    });
    expect(result.frames.length).toBeGreaterThanOrEqual(2);
    expect(hex(result.frames[0])).toBe('aa aa 10 00 01 53 21');
    expect(result.byteCount).toBe(21);
  });

  it('sabit uzunlukla böler', () => {
    const result = parseFrameInput('AA AA 10 00 01 53 21 AA AA 10 00 02 61 38', {
      mode: 'stream',
      framing: { method: 'fixed-length', frameLength: 7 },
    });
    expect(result.frames).toHaveLength(2);
    expect(hex(result.frames[1])).toBe('aa aa 10 00 02 61 38');
  });

  it('yöntem seçilmeden çerçeve UYDURMAZ', () => {
    const result = parseFrameInput(RF_TEXT, { mode: 'stream' });
    expect(result.frames).toEqual([]);
    // Baytlar okundu; eksik olan yalnız yöntem.
    expect(result.byteCount).toBe(21);
  });

  it('akış modunda çerçeve damgası UYDURULMAZ', () => {
    const result = parseFrameInput('[1000] AA AA 10 00 01 53 21', {
      mode: 'stream',
      framing: { method: 'fixed-length', frameLength: 7 },
    });
    expect(result.frames[0]?.timestamp).toBeUndefined();
  });
});

describe('framesFromLogRecords', () => {
  it('yalnız veri baytlarını ve damgayı taşır', () => {
    const result = framesFromLogRecords([
      { data: new Uint8Array([0x01, 0x02]), timestamp: 5 },
      { data: new Uint8Array([0x03, 0x04]), timestamp: undefined },
    ]);
    expect(result.frames).toHaveLength(2);
    expect(hex(result.frames[0])).toBe('01 02');
    expect(result.frames[1]?.timestamp).toBeUndefined();
    expect(result.byteCount).toBe(4);
  });

  it('veri taşımayan kaydı atlar', () => {
    const result = framesFromLogRecords([
      { data: new Uint8Array([]), timestamp: 1 },
      { data: new Uint8Array([0xff]), timestamp: 2 },
    ]);
    expect(result.frames).toHaveLength(1);
  });
});
