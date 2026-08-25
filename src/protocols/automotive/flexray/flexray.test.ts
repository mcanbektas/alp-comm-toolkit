import { describe, expect, it } from 'vitest';

import { flexRayParser, flexRayPlugin } from './flexray';
import type { FlexRayFrameMetadata } from './flexray';
import { computeNamedCrc, computeNamedCrcBits } from '@/protocol-core/checksums/crcCatalogue';
import { isParseSuccess } from '@/protocol-core/types';
import type { ParsedField, ParseResult } from '@/protocol-core/types';

/**
 * Conformance Test Spec v3.0.1 §2.7.5 codeword 1, kanal A ve kanal B — AYNI
 * mesaj, farklı Frame CRC. Bu iki dizi UYDURULMADI (bkz. flexray.ts dosya başı).
 */
const CONFORMANCE_A = Uint8Array.from([0x18, 0x02, 0x02, 0x09, 0x88, 0x00, 0x00, 0xf3, 0x39, 0xc1]);
const CONFORMANCE_B = Uint8Array.from([0x18, 0x02, 0x02, 0x09, 0x88, 0x00, 0x00, 0xd5, 0xb9, 0x10]);
/** Frame ID 100, Payload Length 4 SÖZCÜK (= 8 bayt), Cycle 17, kanal A. */
const DATA_FRAME = Uint8Array.from([
  0x20, 0x64, 0x09, 0x9a, 0x11, 0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77, 0x88, 0xb1, 0x7e, 0xe9,
]);

function expectSuccess(result: ParseResult) {
  if (!isParseSuccess(result)) {
    throw new Error(`çözüm başarısız: ${result.error.code} / ${result.error.message}`);
  }
  return result;
}

function field(result: ParseResult, id: string): ParsedField {
  const found = expectSuccess(result).frame.fields.find((entry) => entry.id === id);
  if (found === undefined) throw new Error(`alan bulunamadı: ${id}`);
  return found;
}

function parseOnChannel(bytes: Uint8Array, channel: 'a' | 'b'): ParseResult {
  return flexRayParser.parse(bytes, { options: { channel } });
}

describe('flexRayParser — başlık alanları', () => {
  it('conformance codeword A çözülür ve İKİ CRC de geçerli çıkar', () => {
    const result = parseOnChannel(CONFORMANCE_A, 'a');
    const { frame } = expectSuccess(result);

    expect(frame.valid).toBe(true);
    expect(frame.errors).toEqual([]);
    expect(field(result, 'header-crc').valid).toBe(true);
    expect(field(result, 'header-crc').physicalValue).toBe('Valid');
    expect(field(result, 'frame-crc').valid).toBe(true);
    expect(field(result, 'frame-crc').physicalValue).toBe('Valid');
  });

  it('gösterge bitleri Wireshark maskeleriyle aynı sırada okunur', () => {
    // 0x18 = 0b0001_1000 → res=0, ppi=0, nfi=0, sfi=1, stfi=1.
    const result = parseOnChannel(CONFORMANCE_A, 'a');
    expect(field(result, 'reserved-bit').rawValue).toBe(0);
    expect(field(result, 'payload-preamble-indicator').rawValue).toBe(0);
    expect(field(result, 'null-frame-indicator').rawValue).toBe(0);
    expect(field(result, 'sync-frame-indicator').rawValue).toBe(1);
    expect(field(result, 'startup-frame-indicator').rawValue).toBe(1);

    // NFI TERSTİR: 0 = null frame, 1 = veri çerçevesi.
    expect(field(result, 'null-frame-indicator').physicalValue).toBe('Null frame (no payload data)');
    expect(field(result, 'sync-frame-indicator').physicalValue).toBe('Sync frame');
    expect(field(result, 'startup-frame-indicator').physicalValue).toBe('Startup frame');
  });

  it('Frame ID, Cycle Count ve Header CRC bit konumlarından okunur', () => {
    const result = parseOnChannel(CONFORMANCE_A, 'a');
    expect(field(result, 'frame-id').rawValue).toBe(2);
    expect(field(result, 'cycle-count').rawValue).toBe(8);
    // Codeword'ün içindeki header CRC 0x026 — CRC-11 codeword'üyle aynı değer.
    expect(field(result, 'header-crc').rawValue).toBe(0x026);
  });

  it('bit alanları KAPSAYAN bayt aralığı verir, bit ayrıntısı ADDA durur', () => {
    // `types.ts:30` kilitli sözleşmesi: offset/length BAYT cinsinden.
    const result = parseOnChannel(DATA_FRAME, 'a');
    expect(field(result, 'frame-id')).toMatchObject({ offset: 0, length: 2 });
    expect(field(result, 'frame-id').name).toContain('bits 5-15');
    expect(field(result, 'header-crc')).toMatchObject({ offset: 2, length: 3 });
    expect(field(result, 'header-crc').name).toContain('bits 23-33');
    expect(field(result, 'cycle-count')).toMatchObject({ offset: 4, length: 1 });
    expect(field(result, 'cycle-count').name).toContain('bits 34-39');
  });

  it('alan adları Header/Payload/Trailer ağacını taşır (ParsedFrame DÜZ)', () => {
    const result = parseOnChannel(DATA_FRAME, 'a');
    expect(field(result, 'frame-id').name).toMatch(/^Header /);
    expect(field(result, 'frame-crc').name).toMatch(/^Trailer /);
    // `children` YOK — düz alan listesi.
    expect(expectSuccess(result).frame.fields.every((entry) => !('children' in entry))).toBe(true);
  });
});

describe('flexRayParser — Payload Length SÖZCÜK sayısıdır, bayt değil', () => {
  it('ham değer sözcük, fiziksel değer BAYT olarak basılır', () => {
    const result = parseOnChannel(DATA_FRAME, 'a');
    const payloadLength = field(result, 'payload-length');
    expect(payloadLength.rawValue).toBe(4);
    expect(payloadLength.physicalValue).toBe(8);
    expect(payloadLength.unit).toBe('B');
  });

  it('payload sınırı sözcük × 2 ile bulunur; CRC tam da bu sınırın ardındadır', () => {
    const result = parseOnChannel(DATA_FRAME, 'a');
    expect(field(result, 'payload')).toMatchObject({ offset: 5, length: 8 });
    // Sözcük yerine bayt okunsaydı CRC offset 9'a düşerdi ve doğrulama patlardı.
    expect(field(result, 'frame-crc')).toMatchObject({ offset: 13, length: 3 });
    expect(field(result, 'frame-crc').valid).toBe(true);
  });

  it('Payload Length vaadi tutmuyorsa çözüm BAŞARISIZ olur (akış parçası)', () => {
    const truncated = DATA_FRAME.slice(0, 10);
    const result = flexRayParser.parse(truncated);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('truncated-frame');
      expect(result.recoverable).toBe(true);
      expect(result.error.details?.expectedLength).toBe('16');
    }
  });

  it('5 bayttan kısa girdi truncated-frame ile reddedilir', () => {
    const result = flexRayParser.parse(Uint8Array.from([0x20, 0x64, 0x09]));
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe('truncated-frame');
  });
});

describe('flexRayParser — Header CRC tam 20 biti kapsar', () => {
  /** Başlığı yeniden kurup istenen biti çevirir; CRC alanlarına dokunmaz. */
  function flipBit(bytes: Uint8Array, bitPosition: number): Uint8Array {
    const copy = Uint8Array.from(bytes);
    const index = bitPosition >> 3;
    copy[index] = (copy[index] ?? 0) ^ (0x80 >> (bitPosition & 7));
    return copy;
  }

  it.each([
    ['reserved biti (bit 0)', 0],
    ['payload preamble indicator (bit 1)', 1],
    ['null frame indicator (bit 2)', 2],
    ['cycle count (bit 39)', 39],
  ])('%s KAPSAM DIŞI: değişince Header CRC hâlâ geçerli kalır', (_label, bit) => {
    const mutated = flipBit(DATA_FRAME, bit);
    expect(field(parseOnChannel(mutated, 'a'), 'header-crc').valid).toBe(true);
  });

  it.each([
    ['sync frame indicator (bit 3)', 3],
    ['startup frame indicator (bit 4)', 4],
    ['frame ID (bit 15)', 15],
    ['payload length (bit 16)', 16],
  ])('%s KAPSAM İÇİ: değişince Header CRC GEÇERSİZ olur', (_label, bit) => {
    const mutated = flipBit(DATA_FRAME, bit);
    const result = flexRayParser.parse(mutated, { options: { channel: 'a' } });
    // Payload Length değişimi çerçeve boyunu da değiştirir; başarısız olabilir.
    if (isParseSuccess(result)) {
      expect(field(result, 'header-crc').valid).toBe(false);
    } else {
      expect(result.error.code).toBe('truncated-frame');
    }
  });

  it('Header CRC katalog fonksiyonuyla BİREBİR aynı yoldan hesaplanır', () => {
    // DATA_FRAME'in başlığındaki 20 bitin SOLA DAYALI hâli, elle kurulmuş:
    //   bit 3-7  = 0b00000  (sfi=0, stfi=0, frameId[10:8]=000)
    //   bit 8-15 = 0b01100100 (frameId[7:0] = 100)
    //   bit 16-22= 0b0000100  (payloadLength = 4 sözcük)
    // → 00000011 00100000 0100(0000) = 0x03 0x20 0x40
    const packed = Uint8Array.from([0x03, 0x20, 0x40]);
    expect(computeNamedCrcBits(packed, 20, 'CRC11_FLEXRAY')).toBe(0x668n);
    expect(field(parseOnChannel(DATA_FRAME, 'a'), 'header-crc').rawValue).toBe(0x668);
  });
});

describe('flexRayParser — Frame CRC init KANALA göre değişir', () => {
  it('conformance codeword A kanal A’da geçerli, kanal B’de GEÇERSİZ', () => {
    expect(field(parseOnChannel(CONFORMANCE_A, 'a'), 'frame-crc').valid).toBe(true);
    expect(field(parseOnChannel(CONFORMANCE_A, 'b'), 'frame-crc').valid).toBe(false);
  });

  it('conformance codeword B kanal B’de geçerli, kanal A’da GEÇERSİZ', () => {
    expect(field(parseOnChannel(CONFORMANCE_B, 'b'), 'frame-crc').valid).toBe(true);
    expect(field(parseOnChannel(CONFORMANCE_B, 'a'), 'frame-crc').valid).toBe(false);
  });

  it('Header CRC kanaldan ETKİLENMEZ — iki CRC gerçekten ayrı doğrulanır', () => {
    expect(field(parseOnChannel(CONFORMANCE_B, 'a'), 'header-crc').valid).toBe(true);
    expect(field(parseOnChannel(CONFORMANCE_B, 'b'), 'header-crc').valid).toBe(true);
  });

  it('kullanılan kanal alan ADINDA görünür', () => {
    expect(field(parseOnChannel(DATA_FRAME, 'a'), 'frame-crc').name).toContain('Channel A');
    expect(field(parseOnChannel(DATA_FRAME, 'b'), 'frame-crc').name).toContain('Channel B');
  });

  it('options verilmezse ParseContext.channel kullanılır (types.ts:127)', () => {
    // Brief: decodeOptions açmadan ÖNCE `RawFrame.channel`/`ParseContext.channel`
    // denenir. Kanal B'den gelen bir yakalama, seçenek olmadan da doğru çözülür.
    const result = flexRayParser.parse(CONFORMANCE_B, { channel: 'B' });
    expect(field(result, 'frame-crc').valid).toBe(true);
    expect(field(result, 'frame-crc').name).toContain('Channel B');
  });

  it('options, ParseContext.channel’ı EZER (panelin açık seçimi kazanır)', () => {
    const result = flexRayParser.parse(CONFORMANCE_A, {
      channel: 'B',
      options: { channel: 'a' },
    });
    expect(field(result, 'frame-crc').valid).toBe(true);
    expect(field(result, 'frame-crc').name).toContain('Channel A');
  });

  it('kanal hiçbir yerden gelmezse A varsayılır ve VARSAYILDIĞI uyarılır', () => {
    const result = flexRayParser.parse(CONFORMANCE_A);
    expect(field(result, 'frame-crc').valid).toBe(true);
    expect(field(result, 'frame-crc').warnings).toContain(
      'protocol.flexray.warning.channelAssumed',
    );
  });

  it('kanal açıkça verildiğinde varsayım uyarısı BASILMAZ', () => {
    expect(field(parseOnChannel(CONFORMANCE_A, 'a'), 'frame-crc').warnings).not.toContain(
      'protocol.flexray.warning.channelAssumed',
    );
  });
});

describe('flexRayParser — iki CRC AYRI AYRI raporlanır', () => {
  it('yalnız Frame CRC bozulursa Header CRC GEÇERLİ kalır', () => {
    const bytes = Uint8Array.from(DATA_FRAME);
    bytes[bytes.length - 1] = (bytes[bytes.length - 1] ?? 0) ^ 0xff;
    const result = parseOnChannel(bytes, 'a');

    expect(field(result, 'header-crc').valid).toBe(true);
    expect(field(result, 'frame-crc').valid).toBe(false);
    expect(field(result, 'frame-crc').warnings).toContain(
      'protocol.flexray.warning.frameCrcMismatch',
    );

    const { frame } = expectSuccess(result);
    // Alan seviyesinde hata: çözüm BAŞARILI, çerçeve geçersiz.
    expect(frame.valid).toBe(false);
    expect(frame.errors).toHaveLength(1);
    expect(frame.errors[0]?.code).toBe('crc-mismatch');
    expect(frame.errors[0]?.offset).toBe(13);
  });

  it('başlık bozulursa İKİ hata da ayrı ayrı, kendi offset’leriyle basılır', () => {
    const bytes = Uint8Array.from(DATA_FRAME);
    bytes[3] = (bytes[3] ?? 0) ^ 0x20;
    const result = parseOnChannel(bytes, 'a');
    const { frame } = expectSuccess(result);

    expect(field(result, 'header-crc').valid).toBe(false);
    expect(field(result, 'frame-crc').valid).toBe(false);
    expect(frame.errors.map((entry) => entry.offset)).toEqual([2, 13]);
  });

  it('bozuk CRC parse hatası DEĞİL alan hatasıdır (kısmi çözüm gösterilir)', () => {
    const bytes = Uint8Array.from(DATA_FRAME);
    bytes[bytes.length - 1] = (bytes[bytes.length - 1] ?? 0) ^ 0xff;
    const result = parseOnChannel(bytes, 'a');
    expect(result.success).toBe(true);
    // Başlık alanları yine de çözülmüş olmalı.
    expect(field(result, 'frame-id').rawValue).toBe(100);
  });

  it('geçersiz CRC’nin fiziksel değeri HESAPLANANI da gösterir', () => {
    const bytes = Uint8Array.from(DATA_FRAME);
    bytes[bytes.length - 1] = (bytes[bytes.length - 1] ?? 0) ^ 0xff;
    expect(field(parseOnChannel(bytes, 'a'), 'frame-crc').physicalValue).toBe(
      'Invalid (computed 0xB17EE9)',
    );
  });
});

describe('flexRayParser — payload HAM kalır', () => {
  it('payload sayısal değer BASMAZ ve tanım gerektiren uyarısını taşır', () => {
    const result = parseOnChannel(DATA_FRAME, 'a');
    const payload = field(result, 'payload');
    expect(payload.rawValue).toBeUndefined();
    expect(payload.physicalValue).toBeUndefined();
    expect(payload.warnings).toContain('protocol.flexray.warning.payloadNeedsDefinition');
  });

  it('payload’dan türetilmiş sahte alt alan basılmaz', () => {
    const { frame } = expectSuccess(parseOnChannel(DATA_FRAME, 'a'));
    expect(frame.fields.filter((entry) => entry.offset >= 5 && entry.offset < 13)).toHaveLength(1);
  });

  it('Payload Length 0 iken payload alanı HİÇ basılmaz', () => {
    const empty = Uint8Array.from([0x20, 0x37, 0x01, 0xb0, 0x01, 0x30, 0x40, 0x4a]);
    const result = parseOnChannel(empty, 'a');
    expect(expectSuccess(result).frame.fields.some((entry) => entry.id === 'payload')).toBe(false);
    expect(field(result, 'frame-crc').valid).toBe(true);
  });

  it('payload preamble VAR ama AYRIŞTIRILMAZ, yalnız bildirilir', () => {
    const bytes = Uint8Array.from([
      0x60, 0x07, 0x07, 0x8b, 0x8c, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x55, 0xd6, 0xa3,
    ]);
    const result = parseOnChannel(bytes, 'a');
    expect(field(result, 'payload-preamble-indicator').rawValue).toBe(1);
    expect(field(result, 'payload-preamble-indicator').warnings).toContain(
      'protocol.flexray.warning.payloadPreamblePresent',
    );
    // Preamble için AYRI alan yok — NMV mi Message ID mi olduğu çerçevede yok.
    const { frame } = expectSuccess(result);
    expect(frame.fields.filter((entry) => entry.offset >= 5 && entry.offset < 11)).toHaveLength(1);
  });
});

describe('flexRayParser — uyarılar', () => {
  it('null frame sıfırdan farklı payload taşırsa uyarır', () => {
    const bytes = Uint8Array.from([
      0x00, 0x28, 0x04, 0xfc, 0xc3, 0x00, 0x00, 0x00, 0x00, 0x79, 0xfd, 0xeb,
    ]);
    expect(field(parseOnChannel(bytes, 'a'), 'payload').warnings).not.toContain(
      'protocol.flexray.warning.nullFrameHasData',
    );

    const dirty = Uint8Array.from(bytes);
    dirty[5] = 0xff;
    expect(field(parseOnChannel(dirty, 'a'), 'payload').warnings).toContain(
      'protocol.flexray.warning.nullFrameHasData',
    );
  });

  it('reserved bit set ise uyarılır ama çerçeve geçersiz SAYILMAZ', () => {
    const bytes = Uint8Array.from([
      0xa0, 0x09, 0x02, 0x4d, 0xc5, 0xaa, 0xbb, 0xfa, 0x87, 0x0f,
    ]);
    const result = parseOnChannel(bytes, 'a');
    expect(field(result, 'reserved-bit').warnings).toContain(
      'protocol.flexray.warning.reservedBitSet',
    );
    expect(expectSuccess(result).frame.valid).toBe(true);
  });

  it('artan baytlar trailing-data alanı ve uyarısı üretir', () => {
    const bytes = Uint8Array.from([...CONFORMANCE_A, 0xaa, 0xbb]);
    const result = parseOnChannel(bytes, 'a');
    expect(field(result, 'trailing-data')).toMatchObject({ offset: 10, length: 2, valid: false });
  });
});

describe('flexRayParser — canParse ve iptal', () => {
  it('uzunluk tutarlıysa true, değilse false döner', () => {
    expect(flexRayParser.canParse(DATA_FRAME)).toBe(true);
    expect(flexRayParser.canParse(DATA_FRAME.slice(0, 10))).toBe(false);
    expect(flexRayParser.canParse(Uint8Array.from([0x20, 0x64]))).toBe(false);
  });

  it('canParse CRC HESAPLAMAZ — bozuk CRC’li çerçeve de aday sayılır', () => {
    const bytes = Uint8Array.from(DATA_FRAME);
    bytes[bytes.length - 1] = 0x00;
    expect(flexRayParser.canParse(bytes)).toBe(true);
  });

  it('iptal edilmiş signal parser-timeout ile döner', () => {
    const controller = new AbortController();
    controller.abort();
    const result = flexRayParser.parse(DATA_FRAME, { signal: controller.signal });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe('parser-timeout');
  });
});

describe('flexRayPlugin — kayıt yüzeyi', () => {
  it('decodeOptions YALNIZ channel kanalını açar', () => {
    const options = flexRayPlugin.decodeOptions ?? [];
    expect(options.map((option) => option.id)).toEqual(['channel']);
    expect(options[0]?.choices?.map((choice) => choice.value)).toEqual(['a', 'b']);
    expect(options[0]?.defaultValue).toBe('a');
  });

  it('calculatorIds/calculators ALMAZ — hesap flexray-phy kaydında', () => {
    expect(flexRayPlugin.calculators).toBeUndefined();
  });

  it('örnek çerçevelerin CRC’leri gerçekten tutarlıdır', () => {
    for (const example of flexRayPlugin.exampleFrames) {
      const channel = example.id === 'conformance-channel-b' ? 'b' : 'a';
      const result = flexRayParser.parse(example.bytes, { options: { channel } });
      if (example.expectedValid === false) {
        // Bozuk örnekler: ya çözülemez ya da bir CRC tutmaz.
        const invalid = !isParseSuccess(result) || !result.frame.valid;
        expect(invalid, `${example.id} geçerli çıktı ama bozuk olmalıydı`).toBe(true);
      } else {
        expect(isParseSuccess(result), `${example.id} çözülemedi`).toBe(true);
        if (isParseSuccess(result)) {
          expect(result.frame.valid, `${example.id} geçersiz çıktı`).toBe(true);
        }
      }
    }
  });

  it('metadata korelasyonun hammaddesini taşır (analyzer işi için)', () => {
    const { frame } = expectSuccess(parseOnChannel(DATA_FRAME, 'b'));
    const metadata = frame.rawFrame.metadata as FlexRayFrameMetadata;
    expect(metadata.frameId).toBe(100);
    expect(metadata.cycleCount).toBe(17);
    expect(metadata.payloadLengthWords).toBe(4);
    expect(metadata.channel).toBe('b');
    expect(metadata.nullFrame).toBe(false);
  });

  it('katalog CRC girdileri conformance codeword’ünü yeniden üretir', () => {
    // Motorun kullandığı katalog girdisinin GERÇEKTEN FlexRay'inki olduğunun
    // tek satırlık kanıtı (CRC24/CRC24_Q ile karıştırılmadı).
    const message = CONFORMANCE_A.slice(0, 7);
    expect(computeNamedCrc(message, 'CRC24_FLEXRAY_A')).toBe(0xf339c1n);
    expect(computeNamedCrc(message, 'CRC24_FLEXRAY_B')).toBe(0xd5b910n);
  });
});
