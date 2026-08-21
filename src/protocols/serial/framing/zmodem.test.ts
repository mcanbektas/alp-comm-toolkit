import { describe, expect, it } from 'vitest';

import { zmodemParser, zmodemPlugin } from './zmodem';
import { ZCRCE, ZCRCG, ZCRCQ, ZCRCW, encodeZmodemHeader, encodeZmodemSubpacket } from './zmodemCore';
import type { ParseFailure, ParseResult, ParseSuccess, ParsedField, ParsedFrame } from '@/protocol-core/types';

// CRC fixture disiplini (xmodemCore.ts/hdlcCore.ts dosya başı ile aynı): bu
// testler CRC ALGORİTMASINI yeniden hesaplamıyor — `crcCatalogue`/
// `crcEngine.test.ts` (CRC16_XMODEM→0x31C3, CRC32→0xCBF43926, CLAUDE.md'nin
// kendi fixture'ı) tarafından AYRICA doğrulanmış sayılıyor. Bu dosyanın testi
// BAYT SINIRLARI (header/subpacket segment offset-length, ZDLE kaçışı,
// terminatör tanıma). Fixture'lar `encodeZmodemHeader`/`encodeZmodemSubpacket`
// (motorun KENDİSİ) ile kurulur, ELLE hesaplanmış bir CRC sabiti YOK.
//
// ZMODEM'in 16-bit CRC parametreleri (poly 0x1021, init 0x0000) projenin
// kendi speci ya da Forsberg'in zmodem.txt'sinde AÇIKÇA yazmıyor — zm.c'nin
// residue-check yöntemi (`if (crc & 0xFFFF)` sıfır bekliyor, CRC32'nin
// karşılığı `if (crc != 0xDEBB20E3)` sıfırDIŞI bekliyor) üzerinden DOLAYLI
// ama sağlam bir kanıtla türetildi (zmodemCore.ts dosya başı notu) — bu
// projede DAHA ÖNCE gerçek bir ZMODEM yakalamasıyla bayt-bayt doğrulanmadı.

function expectSuccess(result: ParseResult): ParseSuccess {
  if (!result.success) {
    throw new Error(`expected success, got error "${result.error.code}": ${result.error.message}`);
  }
  return result;
}

function expectFailure(result: ParseResult): ParseFailure {
  if (result.success) {
    throw new Error('expected failure, got success');
  }
  return result;
}

function fieldById(frame: ParsedFrame, id: string): ParsedField {
  const field = frame.fields.find((candidate) => candidate.id === id);
  if (field === undefined) {
    throw new Error(`field "${id}" not found among [${frame.fields.map((f) => f.id).join(', ')}]`);
  }
  return field;
}

describe('zmodemParser — header formları', () => {
  it('ZHEX (hex16): ZRQINIT, escape yok, hex sindirimi doğru çözülür', () => {
    const wire = encodeZmodemHeader(0, new Uint8Array(4), 'hex16');
    const frame = expectSuccess(zmodemParser.parse(wire)).frame;

    expect(fieldById(frame, 'header-form').physicalValue).toContain('ZHEX');
    expect(fieldById(frame, 'frame-type').physicalValue).toBe('ZRQINIT');
    expect(fieldById(frame, 'header-crc').physicalValue).toContain('PASS');
    expect(frame.valid).toBe(true);
    expect(frame.protocol).toBe('zmodem');
  });

  it('ZBIN (binary16): ZRINIT flag baytı doğru çözülür (CANFDX/CANOVIO/CANFC32)', () => {
    const wire = encodeZmodemHeader(1, Uint8Array.from([0x00, 0x00, 0x00, 0x23]), 'binary16');
    const frame = expectSuccess(zmodemParser.parse(wire)).frame;

    expect(fieldById(frame, 'frame-type').physicalValue).toBe('ZRINIT');
    const interpretation = fieldById(frame, 'header-data').physicalValue;
    expect(interpretation).toContain('CANFDX');
    expect(interpretation).toContain('CANOVIO');
    expect(interpretation).toContain('CANFC32');
    expect(interpretation).not.toContain('CANBRK');
    expect(fieldById(frame, 'header-crc').physicalValue).toContain('PASS');
  });

  it('ZBIN32 (binary32): position alanı little-endian çözülür', () => {
    const wire = encodeZmodemHeader(10, Uint8Array.from([0x00, 0x00, 0x50, 0x00]), 'binary32');
    const frame = expectSuccess(zmodemParser.parse(wire)).frame;

    expect(fieldById(frame, 'header-form').physicalValue).toContain('ZBIN32');
    expect(fieldById(frame, 'frame-type').physicalValue).toBe('ZDATA');
    expect(fieldById(frame, 'header-data').physicalValue).toBe('Position: 5242880');
    expect(fieldById(frame, 'header-crc').name).toBe('CRC-32');
    expect(fieldById(frame, 'header-crc').physicalValue).toContain('PASS');
  });

  it('ZDLE kaçışı gerektiren header data (0x00/0x18/0x7F/0xFF karışık) round-trip eder', () => {
    const wire = encodeZmodemHeader(9, Uint8Array.from([0x00, 0x18, 0x7f, 0xff]), 'binary16');
    const frame = expectSuccess(zmodemParser.parse(wire)).frame;

    expect(fieldById(frame, 'header-crc').physicalValue).toContain('PASS');
    // ZRPOS (9) → position yorumlanır; kaçışı çözülmüş mantıksal baytlar 00 18 7F FF olmalı.
    expect(fieldById(frame, 'header-data').rawValue).toBe('00 18 7F FF');
  });

  it('bozuk header CRC (hex form, güvenli tek-hane bozma): frame.valid=false, crc-mismatch', () => {
    const good = encodeZmodemHeader(8, new Uint8Array(4), 'hex16'); // ZFIN
    const corrupted = Uint8Array.from(good);
    const lastCrcDigitIndex = corrupted.length - 1 - 3; // CR LF XON'dan önceki son hex hanesi
    const originalChar = String.fromCharCode(corrupted[lastCrcDigitIndex] ?? 0x30);
    const replacement = originalChar === '0' ? '1' : '0';
    corrupted[lastCrcDigitIndex] = replacement.charCodeAt(0);

    const frame = expectSuccess(zmodemParser.parse(corrupted)).frame;
    expect(frame.valid).toBe(false);
    expect(fieldById(frame, 'header-crc').physicalValue).toContain('FAIL');
    expect(frame.errors.map((e) => e.code)).toContain('crc-mismatch');
  });
});

describe('zmodemParser — subpacket', () => {
  it('ZFILE + subpacket: filename/filesize ayrı alanlara çözülür, metadata-remainder yok', () => {
    const header = encodeZmodemHeader(4, new Uint8Array(4), 'binary16');
    const filenameBytes = Array.from('firmware.bin', (char) => char.charCodeAt(0));
    const sizeBytes = Array.from('32768', (char) => char.charCodeAt(0));
    const subpacketData = Uint8Array.from([...filenameBytes, 0x00, ...sizeBytes]);
    const subpacket = encodeZmodemSubpacket(subpacketData, ZCRCW, 16);
    const wire = Uint8Array.from([...header, ...subpacket]);

    const frame = expectSuccess(zmodemParser.parse(wire)).frame;
    expect(fieldById(frame, 'filename').rawValue).toBe('firmware.bin');
    expect(fieldById(frame, 'filesize').physicalValue).toBe(32768);
    expect(() => fieldById(frame, 'metadata-remainder')).toThrow();
    expect(fieldById(frame, 'subpacket-terminator').physicalValue).toContain('ZCRCW');
    expect(fieldById(frame, 'subpacket-crc').physicalValue).toContain('PASS');
    expect(frame.valid).toBe(true);
  });

  it.each([
    ['ZCRCE', ZCRCE],
    ['ZCRCG', ZCRCG],
    ['ZCRCQ', ZCRCQ],
    ['ZCRCW', ZCRCW],
  ])('ZDATA + subpacket, terminatör %s: generic subpacket-data alanı ve CRC PASS', (name, terminator) => {
    const header = encodeZmodemHeader(10, new Uint8Array(4), 'binary16');
    const subpacket = encodeZmodemSubpacket(Uint8Array.from([0x01, 0x02, 0x03]), terminator, 16);
    const wire = Uint8Array.from([...header, ...subpacket]);

    const frame = expectSuccess(zmodemParser.parse(wire)).frame;
    expect(fieldById(frame, 'subpacket-data').rawValue).toBe('01 02 03');
    expect(fieldById(frame, 'subpacket-terminator').physicalValue).toContain(name);
    expect(fieldById(frame, 'subpacket-crc').physicalValue).toContain('PASS');
    expect(frame.valid).toBe(true);
  });

  it('32-bit CRC subpacket (CANFC32 oturumu) PASS gösterir', () => {
    const header = encodeZmodemHeader(10, new Uint8Array(4), 'binary32');
    const subpacket = encodeZmodemSubpacket(new Uint8Array(16).fill(0x42), ZCRCE, 32);
    const wire = Uint8Array.from([...header, ...subpacket]);

    const frame = expectSuccess(zmodemParser.parse(wire)).frame;
    expect(fieldById(frame, 'subpacket-crc').name).toBe('CRC-32');
    expect(fieldById(frame, 'subpacket-crc').physicalValue).toContain('PASS');
  });

  it('terminatörsüz (eksik) subpacket: hata değil, incomplete-subpacket uyarısı — header yine valid', () => {
    const header = encodeZmodemHeader(10, new Uint8Array(4), 'binary16');
    const incomplete = Uint8Array.from([0x01, 0x02, 0x03]); // ZDLE+terminatör YOK
    const wire = Uint8Array.from([...header, ...incomplete]);

    const frame = expectSuccess(zmodemParser.parse(wire)).frame;
    expect(frame.valid).toBe(true);
    expect(frame.warnings.map((w) => w.code)).toContain('incomplete-subpacket');
    expect(() => fieldById(frame, 'subpacket-terminator')).toThrow();
  });

  it('bozuk subpacket CRC: frame.valid=false, crc-mismatch, header kendisi hâlâ PASS gösterir', () => {
    const header = encodeZmodemHeader(10, new Uint8Array(4), 'binary16');
    const good = encodeZmodemSubpacket(Uint8Array.from([0x41, 0x42, 0x43]), ZCRCW, 16);
    const wire = Uint8Array.from([...header, ...good]);

    // Terminatörden HEMEN SONRAKİ bayt CRC'nin ilk (kaçışsız olduğu bilinen — 0x41-0x43
    // veri hiçbir kaçışa girmez, CRC baytı da rastgele ama tek bayt bozma ZDLE'ye denk
    // gelmediği sürece güvenli) baytı; denk gelirse ikinci bir aday denenir.
    const crcFieldOffset = header.length + good.length - 2; // (data 3 kaçışsız + ZDLE + terminatör(2) + CRC(2)) — son 2 bayt CRC
    const corrupted = Uint8Array.from(wire);
    const candidateOffset = corrupted[crcFieldOffset] === 0x18 ? crcFieldOffset + 1 : crcFieldOffset;
    corrupted[candidateOffset] = (corrupted[candidateOffset] ?? 0) ^ 0xff;

    const frame = expectSuccess(zmodemParser.parse(corrupted)).frame;
    expect(frame.valid).toBe(false);
    expect(frame.errors.map((e) => e.code)).toContain('crc-mismatch');
    expect(fieldById(frame, 'header-crc').physicalValue).toContain('PASS');
  });
});

describe('zmodemParser — hata yolları', () => {
  it('boş girdide truncated-frame döner', () => {
    expect(expectFailure(zmodemParser.parse(new Uint8Array(0))).error.code).toBe('truncated-frame');
  });

  it('ZPAD/ZDLE olmadan start-delimiter-not-found döner', () => {
    const result = expectFailure(zmodemParser.parse(Uint8Array.from([0x41, 0x42, 0x43])));
    expect(result.error.code).toBe('start-delimiter-not-found');
  });

  it('RLE uzantısı (ZBINR32, lrzsz-profili dışı) unsupported-encoding döner', () => {
    const wire = Uint8Array.from([0x2a, 0x18, 0x44, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
    expect(expectFailure(zmodemParser.parse(wire)).error.code).toBe('unsupported-encoding');
  });

  it('tanınmayan header-form baytı unsupported-encoding döner', () => {
    const wire = Uint8Array.from([0x2a, 0x18, 0x5a]); // 'Z' — ne ZBIN/ZHEX/ZBIN32 ne bilinen RLE varyantı
    expect(expectFailure(zmodemParser.parse(wire)).error.code).toBe('unsupported-encoding');
  });

  it('tanınmayan frame type (20) unsupported-function-code döner', () => {
    const wire = encodeZmodemHeader(0, new Uint8Array(4), 'hex16');
    const corrupted = Uint8Array.from(wire);
    corrupted[4] = '1'.charCodeAt(0);
    corrupted[5] = '4'.charCodeAt(0); // TYPE hex hanesi 00 → 14 (20 decimal)
    expect(expectFailure(zmodemParser.parse(corrupted)).error.code).toBe('unsupported-function-code');
  });

  it('hex formda geçersiz hane (büyük harf ya da hex-dışı) invalid-hex-input döner', () => {
    const wire = encodeZmodemHeader(0, new Uint8Array(4), 'hex16');
    const corrupted = Uint8Array.from(wire);
    corrupted[4] = 'G'.charCodeAt(0);
    expect(expectFailure(zmodemParser.parse(corrupted)).error.code).toBe('invalid-hex-input');
  });

  it('yarım bırakılmış binary header truncated-frame döner', () => {
    const wire = Uint8Array.from([0x2a, 0x18, 0x41, 0x00]); // ZBIN + tek bayt, CRC'ye kadar tamamlanmadan kesildi
    expect(expectFailure(zmodemParser.parse(wire)).error.code).toBe('truncated-frame');
  });

  it('ZDLE sonrası tanınmayan bayt (header alanında) unsupported-encoding döner', () => {
    const wire = Uint8Array.from([0x2a, 0x18, 0x41, 0x18, 0x68, 0, 0, 0, 0, 0, 0]); // ZDLE+'h' (ZCRCE) header alanında ANLAMSIZ
    expect(expectFailure(zmodemParser.parse(wire)).error.code).toBe('unsupported-encoding');
  });

  it('iptal edilmiş signal ile parser-timeout döner', () => {
    const controller = new AbortController();
    controller.abort();
    const result = zmodemParser.parse(encodeZmodemHeader(0, new Uint8Array(4), 'hex16'), { signal: controller.signal });
    expect(expectFailure(result).error.code).toBe('parser-timeout');
  });

  it('canParse boş girdide false, dolu girdide true döner', () => {
    expect(zmodemParser.canParse(new Uint8Array(0))).toBe(false);
    expect(zmodemParser.canParse(Uint8Array.from([0x2a]))).toBe(true);
  });
});

describe('zmodemPlugin', () => {
  it('katalogdaki kimlik, kategori ve parser bağını taşır', () => {
    expect(zmodemPlugin.id).toBe('zmodem');
    expect(zmodemPlugin.category).toBe('interfaces-framing');
    expect(zmodemPlugin.parser).toBe(zmodemParser);
  });

  it('encoder çıktısı (ZDATA çerçevesi) parser tarafından geçerli olarak geri okunur (round-trip)', () => {
    const wire = zmodemPlugin.encoder?.encode(Uint8Array.from([0xde, 0xad, 0xbe, 0xef]));
    if (wire === undefined) throw new Error('encoder tanımsız');
    const frame = expectSuccess(zmodemParser.parse(wire)).frame;
    expect(frame.valid).toBe(true);
    expect(fieldById(frame, 'frame-type').physicalValue).toBe('ZDATA');
  });

  it('her örnek çözülür ve expectedValid ile eşleşir', () => {
    for (const example of zmodemPlugin.exampleFrames) {
      const result = zmodemParser.parse(example.bytes);
      if (!result.success) {
        throw new Error(`example "${example.id}" failed: ${result.error.code} — ${result.error.message}`);
      }
      expect(result.frame.valid, `example "${example.id}"`).toBe(example.expectedValid ?? true);
    }
  });

  it('her örnek adı/açıklaması protocol.zmodem.example. önekli çeviri anahtarıdır', () => {
    for (const example of zmodemPlugin.exampleFrames) {
      expect(example.name.startsWith('protocol.zmodem.example.'), example.id).toBe(true);
      expect(example.description?.startsWith('protocol.zmodem.example.'), example.id).toBe(true);
    }
  });

  it('exampleFrames boş değildir (registry testinin genel kuralı)', () => {
    expect(zmodemPlugin.exampleFrames.length).toBeGreaterThan(0);
  });
});
