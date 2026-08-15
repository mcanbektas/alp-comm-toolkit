import { describe, expect, it } from 'vitest';

import { parseRtcm, rtcmParser, rtcmPlugin } from './rtcm';
import type {
  ParseFailure,
  ParseResult,
  ParseSuccess,
  ParsedField,
  ParsedFrame,
} from '@/protocol-core/types';

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

/**
 * Motorun `computeNamedCrc('CRC24_Q', ...)`ından TAMAMEN AYRI yazılmış ikinci
 * bit-bazlı CRC-24Q uygulaması — LIN/KWP2000 deseni (brief-faz10-dalga3.md):
 * poly 0x864CFB, init 0x000000, girdi/çıktı ters çevrilmez. İki bağımsız kod
 * yolu aynı sonucu verirse doğrulanan katalog PARAMETRESİdir, motorun kopyası
 * değil.
 */
function referenceCrc24Q(bytes: readonly number[]): number {
  const poly = 0x864cfb;
  const topBit = 1 << 23;
  const mask = 0xffffff;
  let register = 0;
  for (const byte of bytes) {
    for (let bitIndex = 7; bitIndex >= 0; bitIndex -= 1) {
      const inputBit = (byte >> bitIndex) & 1;
      const topBitWasSet = (register & topBit) !== 0 ? 1 : 0;
      register = (register << 1) & mask;
      if ((topBitWasSet ^ inputBit) === 1) {
        register ^= poly;
      }
    }
  }
  return register & mask;
}

/** "reference-station" örneğiyle aynı gövde: D3 00 05 3E D0 00 00 00 99 6E 27. */
const REFERENCE_STATION_FRAME = new Uint8Array([
  0xd3, 0x00, 0x05, 0x3e, 0xd0, 0x00, 0x00, 0x00, 0x99, 0x6e, 0x27,
]);

describe('parseRtcm — mesaj 1005 (Reference Station kategorisi, mutlu yol)', () => {
  it('CRC-24Q İKİ bağımsız hesapla doğrulanır: referans fonksiyon + motor', () => {
    const bodyBytes = Array.from(REFERENCE_STATION_FRAME.slice(0, 8));
    expect(referenceCrc24Q(bodyBytes)).toBe(0x996e27);

    const { frame } = expectSuccess(parseRtcm(REFERENCE_STATION_FRAME));
    expect(frame.valid).toBe(true);
    expect(fieldById(frame, 'crc').valid).toBe(true);
    expect(fieldById(frame, 'crc').physicalValue).toBe('Valid');
  });

  it('preamble/length/mesaj numarası alan alan çözülür', () => {
    const { frame } = expectSuccess(parseRtcm(REFERENCE_STATION_FRAME));
    expect(fieldById(frame, 'preamble').rawValue).toBe(0xd3);
    expect(fieldById(frame, 'reserved').rawValue).toBe(0);
    expect(fieldById(frame, 'length').rawValue).toBe(5);
    expect(fieldById(frame, 'message-number').rawValue).toBe(1005);
    expect(fieldById(frame, 'message-number').physicalValue).toBe('Reference Station');
    // Mesaj adı (insan-okur karşılığı) HİÇBİR YERDE yazılmaz — yalnız kategori.
    expect(fieldById(frame, 'message-number').physicalValue).not.toMatch(/ARP|station coordinates/i);
    expect(warningCodes(frame)).toContain('protocol.rtcm.warning.payloadNeedsDatabase');
  });
});

describe('parseRtcm — kategorisi belirsiz mesaj numarası (uyarı yolu)', () => {
  it('4095 tabloda yok: hata değil UYARI basar, çerçeve yine geçerli sayılır', () => {
    const bytes = new Uint8Array([0xd3, 0x00, 0x05, 0xff, 0xf0, 0x00, 0x00, 0x00, 0xef, 0xd5, 0x68]);
    const { frame } = expectSuccess(parseRtcm(bytes));

    expect(frame.valid).toBe(true); // uyarı, hata değil
    const messageNumber = fieldById(frame, 'message-number');
    expect(messageNumber.rawValue).toBe(4095);
    expect(messageNumber.valid).toBe(false);
    expect(messageNumber.physicalValue).toBeUndefined();
    expect(warningCodes(frame)).toContain('protocol.rtcm.warning.messageCategoryUnknown');
  });
});

describe('parseRtcm — bozuk CRC (hata yolu)', () => {
  it('CRC uyuşmazlığında HATA basar, çerçeve yine alan alan gösterilir', () => {
    const bytes = new Uint8Array([0xd3, 0x00, 0x05, 0x3e, 0xd0, 0x00, 0x00, 0x00, 0x99, 0x6e, 0x00]);
    const { frame } = expectSuccess(parseRtcm(bytes));

    expect(frame.valid).toBe(false);
    expect(frame.errors).toHaveLength(1);
    expect(frame.errors[0]?.code).toBe('crc-mismatch');
    expect(fieldById(frame, 'crc').valid).toBe(false);
    // Bozuk CRC'ye rağmen mesaj numarası yine görünür.
    expect(fieldById(frame, 'message-number').rawValue).toBe(1005);
  });
});

describe('parseRtcm — reserved bit set', () => {
  it('reserved bit sıfır değilse uyarı basar ama alan geçerli sayılır', () => {
    // reserved(6 bit)=1, length(10 bit)=5: bayt1 = 0000 01|00 = 0x04, bayt2 = 0000 0101 = 0x05.
    // CRC bilerek yanlış (bu senaryonun konusu değil, ayrı hata bekleniyor).
    const bytes = new Uint8Array([0xd3, 0x04, 0x05, 0x3e, 0xd0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
    const { frame } = expectSuccess(parseRtcm(bytes));
    expect(fieldById(frame, 'reserved').rawValue).toBe(1);
    expect(fieldById(frame, 'reserved').valid).toBe(true);
    expect(warningCodes(frame)).toContain('protocol.rtcm.warning.reservedBitSet');
  });
});

describe('parseRtcm — kısa girdi', () => {
  it('header bile taşımayan veri HARD FAIL olur (truncated-frame, recoverable)', () => {
    const result = expectFailure(parseRtcm(new Uint8Array([0xd3, 0x00])));
    expect(result.error.code).toBe('truncated-frame');
    expect(result.recoverable).toBe(true);
  });

  it('payload/CRC eksikse SOFT hata basar, header alanları yine gösterilir', () => {
    // length=5 diyor ama ardından hiç bayt yok.
    const bytes = new Uint8Array([0xd3, 0x00, 0x05]);
    const { frame } = expectSuccess(parseRtcm(bytes));

    expect(frame.valid).toBe(false);
    expect(frame.errors[0]?.code).toBe('truncated-frame');
    expect(fieldById(frame, 'length').rawValue).toBe(5);
    expect(frame.fields.some((field) => field.id === 'payload')).toBe(false);
    expect(frame.fields.some((field) => field.id === 'crc')).toBe(false);
  });
});

describe('parseRtcm — geçersiz preamble (savunma katmanı)', () => {
  it('canParse eler ama doğrudan parse çağrısı start-delimiter-not-found basar', () => {
    const bytes = new Uint8Array([0x00, 0x00, 0x05, 0x3e, 0xd0, 0x00, 0x00, 0x00, 0x99, 0x6e, 0x27]);
    const { frame } = expectSuccess(parseRtcm(bytes));
    expect(frame.valid).toBe(false);
    expect(frame.errors[0]?.code).toBe('start-delimiter-not-found');
  });
});

describe('rtcmParser.canParse', () => {
  it('preamble baytını ve asgari uzunluğu kontrol eder', () => {
    expect(rtcmParser.canParse(REFERENCE_STATION_FRAME)).toBe(true);
    expect(
      rtcmParser.canParse(new Uint8Array([0x00, 0x00, 0x05, 0x3e, 0xd0, 0x00, 0x00, 0x00, 0x99, 0x6e, 0x27])),
    ).toBe(false);
    expect(rtcmParser.canParse(new Uint8Array([0xd3, 0x00]))).toBe(false);
  });
});

describe('rtcmPlugin', () => {
  it('protocolId ve registry anahtarı birebir aynı: rtcm', () => {
    expect(rtcmPlugin.id).toBe('rtcm');
    expect(rtcmPlugin.parser?.protocolId).toBe('rtcm');
  });

  it('örnek çerçevelerin her biri beklenen valid/invalid örüntüsünü üretir', () => {
    expect(rtcmPlugin.exampleFrames.length).toBeGreaterThan(0);
    for (const example of rtcmPlugin.exampleFrames) {
      const result = parseRtcm(example.bytes);
      expect(result.success, example.id).toBe(true);
      if (result.success) {
        expect(result.frame.valid, example.id).toBe(example.expectedValid);
      }
    }
  });
});
