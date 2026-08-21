import { describe, expect, it } from 'vitest';

import { computeNamedCrc } from '@/protocol-core/checksums/crcCatalogue';
import {
  HDLC_SYNC_FLAG,
  classifyControlByte,
  decodeControlByte,
  encodeHdlcSyncFrame,
  hdlcSyncExtractor,
  validateHdlcFcs,
} from './hdlcCore';

describe('classifyControlByte — I/S/U format ayrımı (ISO 13239 temel mod)', () => {
  it('bit0=0 her zaman I-format döner (üst bitler önemsiz)', () => {
    expect(classifyControlByte(0b0000_0000)).toBe('i-format');
    expect(classifyControlByte(0b1110_1110)).toBe('i-format');
  });

  it('bit0-1=01 S-format döner', () => {
    expect(classifyControlByte(0b0000_0001)).toBe('s-format');
    expect(classifyControlByte(0b1111_1101)).toBe('s-format');
  });

  it('bit0-1=11 U-format döner', () => {
    expect(classifyControlByte(0b0000_0011)).toBe('u-format');
    expect(classifyControlByte(0b1111_1111)).toBe('u-format');
  });
});

describe('decodeControlByte — alan çıkarımı', () => {
  it('I-format: N(S) bit1-3, P/F bit4, N(R) bit5-7', () => {
    // control = 0100_0010 → N(R)=010=2, P/F=0, N(S)=001=1, format bit=0
    const result = decodeControlByte(0x42);
    expect(result.format).toBe('i-format');
    expect(result.sendSequenceNumber).toBe(1);
    expect(result.receiveSequenceNumber).toBe(2);
    expect(result.pollFinal).toBe(false);
    expect(result.supervisoryType).toBeUndefined();
  });

  it('I-format: P/F biti (bit4) ayrı okunur', () => {
    expect(decodeControlByte(0x10).pollFinal).toBe(true);
    expect(decodeControlByte(0x00).pollFinal).toBe(false);
  });

  it('S-format: dört S-tipi de (RR/REJ/RNR/SREJ) adlanır', () => {
    expect(decodeControlByte(0b0000_0001).supervisoryType).toBe('RR (Receive Ready)');
    expect(decodeControlByte(0b0000_0101).supervisoryType).toBe('REJ (Reject)');
    expect(decodeControlByte(0b0000_1001).supervisoryType).toBe('RNR (Receive Not Ready)');
    expect(decodeControlByte(0b0000_1101).supervisoryType).toBe('SREJ (Selective Reject)');
  });

  it('S-format: N(R) ve P/F, I-format ile aynı bit konumlarında okunur', () => {
    // control = 0111_0001 → N(R)=011=3, P/F=1, S-type=00(RR), format=01
    const result = decodeControlByte(0x71);
    expect(result.format).toBe('s-format');
    expect(result.receiveSequenceNumber).toBe(3);
    expect(result.pollFinal).toBe(true);
    expect(result.sendSequenceNumber).toBeUndefined();
  });

  it('U-format: yalnız format+P/F döner, sequence number/S-type YOK (dosya başı disiplini)', () => {
    const result = decodeControlByte(0x13); // 0001_0011: format=11, P/F=1
    expect(result.format).toBe('u-format');
    expect(result.pollFinal).toBe(true);
    expect(result.sendSequenceNumber).toBeUndefined();
    expect(result.receiveSequenceNumber).toBeUndefined();
    expect(result.supervisoryType).toBeUndefined();
  });
});

describe('validateHdlcFcs — CRC16_X25, little-endian tel sırası', () => {
  it('doğru FCS PASS döner, calculated===received', () => {
    const covered = Uint8Array.from([0x01, 0x42, 0xaa, 0xbb]);
    const crc = Number(computeNamedCrc(covered, 'CRC16_X25'));
    const fcsBytes = Uint8Array.from([crc & 0xff, (crc >> 8) & 0xff]);

    const result = validateHdlcFcs(covered, fcsBytes);
    expect(result.valid).toBe(true);
    expect(result.received).toBe(crc);
    expect(result.calculated).toBe(crc);
  });

  it('bozuk FCS FAIL döner, calculated değişmez ama received farklıdır', () => {
    const covered = Uint8Array.from([0x01, 0x42, 0xaa, 0xbb]);
    const crc = Number(computeNamedCrc(covered, 'CRC16_X25'));
    const corruptedFcsBytes = Uint8Array.from([(crc & 0xff) ^ 0xff, (crc >> 8) & 0xff]);

    const result = validateHdlcFcs(covered, corruptedFcsBytes);
    expect(result.valid).toBe(false);
    expect(result.calculated).toBe(crc);
    expect(result.received).not.toBe(crc);
  });

  it('bayt sırası little-endian: fcsBytes[0] düşük, fcsBytes[1] yüksek bayt', () => {
    const result = validateHdlcFcs(Uint8Array.from([]), Uint8Array.from([0x34, 0x12]));
    expect(result.received).toBe(0x1234);
  });
});

describe('encodeHdlcSyncFrame + hdlcSyncExtractor — round-trip', () => {
  it('Flag ile başlar/biter, FCS motorun kendi hesabıyla eşleşir', () => {
    const logical = Uint8Array.from([0x01, 0x42, 0xaa, 0xbb]);
    const wire = encodeHdlcSyncFrame(logical);

    expect(wire[0]).toBe(HDLC_SYNC_FLAG);
    expect(wire[wire.length - 1]).toBe(HDLC_SYNC_FLAG);
    expect(wire.length).toBe(logical.length + 4);

    const expectedCrc = Number(computeNamedCrc(logical, 'CRC16_X25'));
    expect(wire[wire.length - 3]).toBe(expectedCrc & 0xff);
    expect(wire[wire.length - 2]).toBe((expectedCrc >> 8) & 0xff);
  });

  it('hdlcSyncExtractor kaçışsız çalışır: 0x7D içeren veri bozulmadan geri gelir', () => {
    // hdlc-flag (async) motorunun tersine, senkron veride 0x7D sıradan bir
    // bayttır — kaçış motoru burada YOK, bu yüzden bozulmadan geçmeli.
    // `result.frame` FCS'i de İÇERİR (`hdlcSyncExtractor` yalnız flag'ler
    // arasını döner, FCS ayrımı hdlc.ts/sdlc.ts'in plugin katmanının işi).
    const logical = Uint8Array.from([0x01, 0x42, 0x7d, 0x99]);
    const wire = encodeHdlcSyncFrame(logical);
    const result = hdlcSyncExtractor.extract(wire, { maxFrameLength: wire.length });
    if (result.status !== 'complete') throw new Error(`expected complete, got ${result.status}`);
    expect(Array.from(result.frame.slice(0, 4))).toEqual(Array.from(logical));
    expect(result.frame.length).toBe(logical.length + 2); // +FCS
  });

  it('iki delimiter arasında içerik yoksa YİNE DE complete döner, boş frame ile — MIN_CONTENT_LENGTH guard\'ı bu yüzden hdlc.ts/sdlc.ts katmanında', () => {
    // `createBoundedDelimiterExtractor` (bounded/delimiter tipi) burada
    // `createEscapedDelimiterExtractor`den (SLIP/PPP, dalga 10a/10b) FARKLI
    // davranır: art arda iki delimiter'ı 'frame-too-short' HATASI saymaz,
    // yalnız boş bir `frame` ile 'complete' döner (delimiterFraming.ts'in
    // kendi kodu, satır 90) — bu yüzden Address+Control+FCS asgarisi
    // (`MIN_CONTENT_LENGTH`) hdlc.ts/sdlc.ts'in KENDİ sorumluluğu, motorun
    // garantisi DEĞİL.
    const wire = Uint8Array.from([HDLC_SYNC_FLAG, HDLC_SYNC_FLAG]);
    const result = hdlcSyncExtractor.extract(wire, { maxFrameLength: wire.length });
    if (result.status !== 'complete') throw new Error(`expected complete, got ${result.status}`);
    expect(result.frame.length).toBe(0);
  });
});
