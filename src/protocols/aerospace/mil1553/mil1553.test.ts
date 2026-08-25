import { describe, expect, it } from 'vitest';

import { buildMil1553Word, mil1553Parser, mil1553Plugin, parseMil1553 } from './mil1553';
import type { ParsedField, ParsedFrame } from '@/protocol-core/types';

/**
 * Faz 10, dalga 15g — MIL-STD-1553.
 *
 * Fixture'lar kaynak (1)in (Wikipedia "MIL-STD-1553") ADIM ADIM anlattığı
 * BC→RT işleminin sayısal değerleridir; alan sınırları böylece alan
 * TABLOSUNDAN BAĞIMSIZ bir anlatının örneğiyle de doğrulanır. Bit sınırlarının
 * kendisi ayrıca dört bağımsız uygulamayla çaprazlandı (`mil1553.ts` dosya
 * başı, kaynak listesi).
 */

const COMMAND_WORD = 0x1c21; // RT 3 · transmit · subaddress 1 · word count 1
const STATUS_WORD = 0x1800; // RT 3 · rezerve 0 · bütün bayraklar temiz
const DATA_WORD = 0x0002;

const BIG_ENDIAN = { wordByteOrder: 'big-endian' };

function parseFrame(bytes: Uint8Array, options: Record<string, unknown>): ParsedFrame {
  const result = parseMil1553(bytes, options);
  if (!result.success) throw new Error(`beklenmedik çözümleme hatası: ${result.error.message}`);
  return result.frame;
}

function field(frame: ParsedFrame, id: string): ParsedField {
  const found = frame.fields.find((candidate) => candidate.id === id);
  if (found === undefined) {
    throw new Error(`alan yok: ${id} (var olanlar: ${frame.fields.map((f) => f.id).join(', ')})`);
  }
  return found;
}

function warningCodes(frame: ParsedFrame): string[] {
  return frame.warnings.map((warning) => warning.code).sort();
}

describe('MIL-STD-1553 — girdi sözleşmesi', () => {
  it('boş girdi truncated-frame', () => {
    const result = parseMil1553(new Uint8Array([]));
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe('truncated-frame');
  });

  it('tek (çift olmayan) uzunluk truncated-frame — sözcük yükü tam 16 bittir', () => {
    const result = parseMil1553(new Uint8Array([0x1c, 0x21, 0x18]));
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe('truncated-frame');
    expect(result.error.offset).toBe(2);
    expect(result.error.length).toBe(1);
  });

  it('maxFrameLength aşılırsa frame-too-long', () => {
    const result = mil1553Parser.parse(new Uint8Array([0x1c, 0x21, 0x18, 0x00]), {
      maxFrameLength: 2,
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe('frame-too-long');
  });

  it('iptal edilmiş signal parser-timeout', () => {
    const controller = new AbortController();
    controller.abort();
    const result = mil1553Parser.parse(buildMil1553Word(COMMAND_WORD, 'big-endian'), {
      signal: controller.signal,
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe('parser-timeout');
  });

  it('parite uyarısı KOŞULSUZ basılır — bit girdide yok ve doğrulanmıyor', () => {
    for (const options of [{}, BIG_ENDIAN, { ...BIG_ENDIAN, wordType: 'data' }]) {
      const frame = parseFrame(buildMil1553Word(DATA_WORD, 'big-endian'), options);
      expect(warningCodes(frame)).toContain('parityNotInInput');
    }
  });
});

describe('MIL-STD-1553 — kalibrasyon seçilmediğinde HAM kalır', () => {
  it('bayt sırası seçilmezse alanlar AYRILMAZ ve sayı BASILMAZ', () => {
    const frame = parseFrame(buildMil1553Word(COMMAND_WORD, 'big-endian'), {});
    expect(frame.fields).toHaveLength(1);
    const raw = field(frame, 'mil1553-word-0-raw');
    expect(raw.offset).toBe(0);
    expect(raw.length).toBe(2);
    // Bir sayı basmak bir bayt sırası SEÇMEKTİR — bilerek verilmiyor.
    expect(raw.rawValue).toBeUndefined();
    expect(warningCodes(frame)).toContain('wordByteOrderNotSelected');
  });

  it('bayt sırası VAR ama sözcük tipi YOKSA 16 bit ham + wordTypeUnknown', () => {
    const frame = parseFrame(buildMil1553Word(COMMAND_WORD, 'big-endian'), BIG_ENDIAN);
    expect(frame.fields).toHaveLength(1);
    const raw = field(frame, 'mil1553-word-0-raw');
    expect(raw.rawValue).toBe(COMMAND_WORD);
    expect(raw.physicalValue).toBe('0001110000100001');
    expect(raw.warnings).toContain('protocol.mil1553.field.wordTypeUnknown');
    expect(warningCodes(frame)).toContain('wordTypeUnknown');
    // Hiçbir alt alan ADLANDIRILMADI.
    expect(frame.fields.some((candidate) => candidate.id.includes('rt-address'))).toBe(false);
  });
});

describe('MIL-STD-1553 — Command Word (kaynak (1)in çalışılmış örneği)', () => {
  const frame = parseFrame(buildMil1553Word(COMMAND_WORD, 'big-endian'), {
    ...BIG_ENDIAN,
    wordType: 'command',
  });

  it('RT Address (bit 15:11) = 3 — makalenin "value of 0x3"ü', () => {
    const rt = field(frame, 'mil1553-word-0-rt-address');
    expect(rt.rawValue).toBe(3);
    expect(rt.name).toContain('bit 15:11');
    // Kapsam yalnız yüksek bayt — bit 15:11 tek bayta sığar.
    expect({ offset: rt.offset, length: rt.length }).toEqual({ offset: 0, length: 1 });
    expect(rt.physicalValue).toBeUndefined();
  });

  it('T/R (bit 10) = 1 → transmit, yön RT bakış açısından', () => {
    const tr = field(frame, 'mil1553-word-0-transmit-receive');
    expect(tr.rawValue).toBe(1);
    expect(tr.physicalValue).toBe('Transmit (RT → bus)');
  });

  it('Subaddress (bit 9:5) = 1 — iki baytı da kapsar', () => {
    const sa = field(frame, 'mil1553-word-0-subaddress');
    expect(sa.rawValue).toBe(1);
    expect({ offset: sa.offset, length: sa.length }).toEqual({ offset: 0, length: 2 });
    expect(sa.warnings).toContain('protocol.mil1553.field.subaddressMeaningRequiresIcd');
  });

  it('Word Count (bit 4:0) = 1 — makalenin "the single word of data requested"ı', () => {
    const wc = field(frame, 'mil1553-word-0-word-count');
    expect(wc.rawValue).toBe(1);
    expect(wc.physicalValue).toBe(1);
    // Kapsam yalnız düşük bayt.
    expect({ offset: wc.offset, length: wc.length }).toEqual({ offset: 1, length: 1 });
  });

  it('Word Count alanındaki 0 → 32 sözcük (iki bağımsız uygulamayla çaprazlandı)', () => {
    const zeroCount = parseFrame(buildMil1553Word(0x1c20, 'big-endian'), {
      ...BIG_ENDIAN,
      wordType: 'command',
    });
    const wc = field(zeroCount, 'mil1553-word-0-word-count');
    expect(wc.rawValue).toBe(0);
    expect(wc.physicalValue).toBe(32);
  });

  it('subaddress 31 → alan Word Count DEĞİL Mode Code, ve kodun ADI basılmaz', () => {
    const modeFrame = parseFrame(buildMil1553Word(0x1be2, 'big-endian'), {
      ...BIG_ENDIAN,
      wordType: 'command',
    });
    const sa = field(modeFrame, 'mil1553-word-0-subaddress');
    expect(sa.rawValue).toBe(31);
    expect(sa.physicalValue).toBe('Mode command');
    const mode = field(modeFrame, 'mil1553-word-0-mode-code');
    expect(mode.rawValue).toBe(2);
    // ADI yok — yalnız sayı; `physicalValue` de basılmaz.
    expect(mode.physicalValue).toBeUndefined();
    expect(mode.warnings).toContain('protocol.mil1553.field.modeCodeNameRequiresRevision');
    expect(modeFrame.fields.some((f) => f.id.endsWith('word-count'))).toBe(false);
  });

  it('subaddress 0 DA mode command — ve RT 31 broadcast olarak adlandırılır', () => {
    const broadcast = parseFrame(buildMil1553Word(0xf801, 'big-endian'), {
      ...BIG_ENDIAN,
      wordType: 'command',
    });
    expect(field(broadcast, 'mil1553-word-0-rt-address').rawValue).toBe(31);
    expect(field(broadcast, 'mil1553-word-0-rt-address').physicalValue).toBe('Broadcast (31)');
    expect(field(broadcast, 'mil1553-word-0-subaddress').rawValue).toBe(0);
    expect(field(broadcast, 'mil1553-word-0-subaddress').physicalValue).toBe('Mode command');
    expect(field(broadcast, 'mil1553-word-0-mode-code').rawValue).toBe(1);
  });

  it('hiçbir alanda `unit` YOK — hepsi sayaç/kimlik', () => {
    expect(frame.fields.every((candidate) => candidate.unit === undefined)).toBe(true);
  });
});

describe('MIL-STD-1553 — Status Word (kaynak (1)in çalışılmış örneği)', () => {
  const frame = parseFrame(buildMil1553Word(STATUS_WORD, 'big-endian'), {
    ...BIG_ENDIAN,
    wordType: 'status',
  });

  it('RT Address (bit 15:11) = 3 — makalenin "its address (0x3)"ü', () => {
    expect(field(frame, 'mil1553-word-0-rt-address').rawValue).toBe(3);
  });

  it('rezerve bitler (7:5) SIFIR — makalenin "the reserved bits zeroed"ı', () => {
    const reserved = field(frame, 'mil1553-word-0-reserved');
    expect(reserved.rawValue).toBe(0);
    expect(reserved.physicalValue).toBe('000');
    expect(reserved.valid).toBe(true);
    expect(warningCodes(frame)).not.toContain('statusReservedBitsNotZero');
  });

  it('DOKUZ bayrağın hepsi CLEAR — makalenin "all status flags set to false"u', () => {
    const flagIds = [
      'message-error',
      'instrumentation',
      'service-request',
      'broadcast-command-received',
      'busy',
      'subsystem-flag',
      'dynamic-bus-acceptance',
      'terminal-flag',
    ];
    for (const suffix of flagIds) {
      const flag = field(frame, `mil1553-word-0-${suffix}`);
      expect(flag.rawValue, suffix).toBe(0);
      expect(flag.physicalValue, suffix).toBe('CLEAR');
    }
  });

  it('bayrak konumları: her bit AYRI AYRI set edilince YALNIZ kendi alanı SET olur', () => {
    // Konumların çaprazlanmış tablosu (kaynak (2)/(5)) burada bit bit sınanıyor —
    // bir kayma olursa iki alan birden yanlış çıkar ve test kırılır.
    const byBit: ReadonlyArray<readonly [number, string]> = [
      [10, 'message-error'],
      [9, 'instrumentation'],
      [8, 'service-request'],
      [4, 'broadcast-command-received'],
      [3, 'busy'],
      [2, 'subsystem-flag'],
      [1, 'dynamic-bus-acceptance'],
      [0, 'terminal-flag'],
    ];
    for (const [bit, suffix] of byBit) {
      const single = parseFrame(buildMil1553Word(1 << bit, 'big-endian'), {
        ...BIG_ENDIAN,
        wordType: 'status',
      });
      for (const [, otherSuffix] of byBit) {
        const flag = field(single, `mil1553-word-0-${otherSuffix}`);
        expect(flag.physicalValue, `bit ${String(bit)} → ${otherSuffix}`).toBe(
          otherSuffix === suffix ? 'SET' : 'CLEAR',
        );
      }
    }
  });

  it('rezerve bit sıfır değilse alan GEÇERSİZ + çerçeve uyarısı (yanlış wordType göstergesi)', () => {
    const bad = parseFrame(buildMil1553Word(0x18e0, 'big-endian'), {
      ...BIG_ENDIAN,
      wordType: 'status',
    });
    const reserved = field(bad, 'mil1553-word-0-reserved');
    expect(reserved.rawValue).toBe(7);
    expect(reserved.valid).toBe(false);
    expect(reserved.warnings).toContain('protocol.mil1553.field.reservedBitsNotZero');
    expect(warningCodes(bad)).toContain('statusReservedBitsNotZero');
    // Yine de bir HATA değil — çözülemeyen bir şey yok.
    expect(bad.valid).toBe(true);
    expect(bad.errors).toEqual([]);
  });
});

describe('MIL-STD-1553 — Data Word', () => {
  it('16 bit HAM, alt yapı YOK, anlamı ICD uyarısıyla işaretli', () => {
    const frame = parseFrame(buildMil1553Word(DATA_WORD, 'big-endian'), {
      ...BIG_ENDIAN,
      wordType: 'data',
    });
    expect(frame.fields).toHaveLength(1);
    const data = field(frame, 'mil1553-word-0-data');
    expect(data.rawValue).toBe(2);
    expect(data.physicalValue).toBe('0000000000000010');
    expect(data.unit).toBeUndefined();
    expect(data.warnings).toContain('protocol.mil1553.field.dataMeaningRequiresIcd');
  });
});

describe('MIL-STD-1553 — SEÇENEĞİN GERÇEKTEN BAĞLI OLDUĞUNUN KANITI', () => {
  /**
   * Brifin 3. disiplini: aynı 2 baytın üç tipte FARKLI alan tablosu ürettiği
   * TESTLE kanıtlanır. 15c'de `ibus`un profil testinin emsali — bir
   * `decodeOptions` alanı gerçekten bağlı değilse test yeşil kalırdı.
   */
  const bytes = buildMil1553Word(COMMAND_WORD, 'big-endian');

  function fieldIds(wordType: string): string[] {
    return parseFrame(bytes, { ...BIG_ENDIAN, wordType }).fields.map((f) => f.id);
  }

  it('AYNI 2 bayt, üç tipte ÜÇ FARKLI alan tablosu', () => {
    const command = fieldIds('command');
    const status = fieldIds('status');
    const data = fieldIds('data');

    expect(command).toEqual([
      'mil1553-word-0-rt-address',
      'mil1553-word-0-transmit-receive',
      'mil1553-word-0-subaddress',
      'mil1553-word-0-word-count',
    ]);
    expect(status).toEqual([
      'mil1553-word-0-rt-address',
      'mil1553-word-0-message-error',
      'mil1553-word-0-instrumentation',
      'mil1553-word-0-service-request',
      'mil1553-word-0-reserved',
      'mil1553-word-0-broadcast-command-received',
      'mil1553-word-0-busy',
      'mil1553-word-0-subsystem-flag',
      'mil1553-word-0-dynamic-bus-acceptance',
      'mil1553-word-0-terminal-flag',
    ]);
    expect(data).toEqual(['mil1553-word-0-data']);

    // Üçü de birbirinden FARKLI — hiçbir ikili aynı tabloyu üretmiyor.
    expect(new Set([command.join(), status.join(), data.join()]).size).toBe(3);
  });

  it('AYNI bit (10) üç tipte ÜÇ AYRI şey — sessiz yanlış adlandırmanın somut hâli', () => {
    const command = parseFrame(bytes, { ...BIG_ENDIAN, wordType: 'command' });
    const status = parseFrame(bytes, { ...BIG_ENDIAN, wordType: 'status' });
    // Command'da bit 10 T/R, Status'ta Message Error. Aynı bayt, aynı bit.
    expect(field(command, 'mil1553-word-0-transmit-receive').rawValue).toBe(1);
    expect(field(status, 'mil1553-word-0-message-error').rawValue).toBe(1);
    expect(field(command, 'mil1553-word-0-transmit-receive').physicalValue).toBe(
      'Transmit (RT → bus)',
    );
    expect(field(status, 'mil1553-word-0-message-error').physicalValue).toBe('SET');
  });

  it('bayt sırası da GERÇEKTEN bağlı — ters sıra bambaşka alan değerleri verir', () => {
    const little = parseFrame(bytes, { wordByteOrder: 'little-endian', wordType: 'command' });
    // Big-endian 0x1C21 → little-endian okumada 0x211C.
    expect(field(little, 'mil1553-word-0-rt-address').rawValue).toBe(4);
    expect(field(little, 'mil1553-word-0-transmit-receive').rawValue).toBe(0);
    expect(field(little, 'mil1553-word-0-subaddress').rawValue).toBe(8);
    expect(field(little, 'mil1553-word-0-word-count').rawValue).toBe(28);
  });

  it('little-endian YAZILMIŞ sözcük little-endian OKUNUNCA doğru çıkar', () => {
    const frame = parseFrame(buildMil1553Word(COMMAND_WORD, 'little-endian'), {
      wordByteOrder: 'little-endian',
      wordType: 'command',
    });
    expect(field(frame, 'mil1553-word-0-rt-address').rawValue).toBe(3);
    expect(field(frame, 'mil1553-word-0-word-count').rawValue).toBe(1);
    // Kapsam TERSİNE döner: bit 15:11 artık İKİNCİ bayttadır.
    const rt = field(frame, 'mil1553-word-0-rt-address');
    expect({ offset: rt.offset, length: rt.length }).toEqual({ offset: 1, length: 1 });
  });
});

describe('MIL-STD-1553 — çok sözcüklü yakalama', () => {
  const transaction = new Uint8Array([
    ...buildMil1553Word(COMMAND_WORD, 'big-endian'),
    ...buildMil1553Word(STATUS_WORD, 'big-endian'),
    ...buildMil1553Word(DATA_WORD, 'big-endian'),
  ]);

  it('alan id\'leri sözcük İNDEKSİ taşır — üç sözcüğün alanları çakışmaz', () => {
    const frame = parseFrame(transaction, { ...BIG_ENDIAN, wordType: 'data' });
    expect(frame.fields.map((f) => f.id)).toEqual([
      'mil1553-word-0-data',
      'mil1553-word-1-data',
      'mil1553-word-2-data',
    ]);
    expect(field(frame, 'mil1553-word-2-data').offset).toBe(4);
    expect(field(frame, 'mil1553-word-2-data').rawValue).toBe(DATA_WORD);
  });

  it('tip yakalamanın TAMAMINA uygulanır ve bu AÇIKÇA uyarılır', () => {
    const frame = parseFrame(transaction, { ...BIG_ENDIAN, wordType: 'command' });
    expect(warningCodes(frame)).toContain('wordTypeAppliedToAllWords');
    // Tek sözcükte uyarı YOK — gürültü yapmıyor.
    const single = parseFrame(buildMil1553Word(COMMAND_WORD, 'big-endian'), {
      ...BIG_ENDIAN,
      wordType: 'command',
    });
    expect(warningCodes(single)).not.toContain('wordTypeAppliedToAllWords');
  });
});

describe('MIL-STD-1553 — plugin ve örnekler', () => {
  it('canParse DAİMA false — kayıt otomatik algılamaya HİÇ girmez', () => {
    for (const example of mil1553Plugin.exampleFrames) {
      expect(mil1553Parser.canParse(example.bytes), example.id).toBe(false);
    }
    expect(mil1553Parser.canParse(new Uint8Array([0x1c, 0x21]))).toBe(false);
    expect(mil1553Parser.canParse(new Uint8Array([]))).toBe(false);
  });

  it('her örnek `expectedValid` ile tutarlı çözülür', () => {
    for (const example of mil1553Plugin.exampleFrames) {
      const result = mil1553Parser.parse(example.bytes, {
        options: { wordByteOrder: 'big-endian', wordType: 'command' },
      });
      expect(result.success, example.id).toBe(example.expectedValid ?? true);
    }
  });

  it('decodeOptions iki seçenek taşır ve İKİSİNİN de varsayılanı `unset`', () => {
    const options = mil1553Plugin.decodeOptions ?? [];
    expect(options.map((option) => option.id)).toEqual(['wordType', 'wordByteOrder']);
    for (const option of options) {
      expect(option.kind, option.id).toBe('select');
      expect(option.defaultValue, option.id).toBe('unset');
    }
  });

  it('hiçbir alan `unit` taşımaz ve hiçbir mode-code ADI basılmaz', () => {
    for (const wordType of ['command', 'status', 'data']) {
      for (const example of mil1553Plugin.exampleFrames) {
        const result = parseMil1553(example.bytes, { wordByteOrder: 'big-endian', wordType });
        if (!result.success) continue;
        for (const parsedField of result.frame.fields) {
          expect(parsedField.unit, `${example.id}/${parsedField.id}`).toBeUndefined();
          // Mode code adları asla physicalValue'ya sızmamalı.
          expect(String(parsedField.physicalValue ?? '')).not.toMatch(
            /shutdown|synchron|bit test|terminal address|reset remote/i,
          );
        }
      }
    }
  });
});
