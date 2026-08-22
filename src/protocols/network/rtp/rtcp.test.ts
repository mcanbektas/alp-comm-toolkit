import { describe, expect, it } from 'vitest';

import { parseRtcp, rtcpParser, rtcpPlugin } from './rtcp';
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

function hasField(frame: ParsedFrame, id: string): boolean {
  return frame.fields.some((field) => field.id === id);
}

function warningCodes(frame: ParsedFrame): string[] {
  return frame.warnings.map((warning) => warning.code);
}

describe('plugin kaydı', () => {
  it('kimlik/kategori/parser bağı katalogla eşleşir', () => {
    expect(rtcpPlugin.id).toBe('rtcp');
    expect(rtcpPlugin.category).toBe('network-ethernet');
    expect(rtcpPlugin.parser?.protocolId).toBe('rtcp');
    expect(rtcpPlugin.exampleFrames.length).toBeGreaterThan(0);
  });

  it('her örnek çerçeve çözülür ve expectedValid ile eşleşir', () => {
    for (const example of rtcpPlugin.exampleFrames) {
      const result = rtcpParser.parse(example.bytes);
      if (!result.success) {
        throw new Error(`example "${example.id}" failed: ${result.error.code}`);
      }
      expect(result.frame.valid, `example "${example.id}"`).toBe(example.expectedValid ?? true);
    }
  });

  it('her örnek adı/açıklaması protocol.rtcp. önekli çeviri anahtarıdır', () => {
    for (const example of rtcpPlugin.exampleFrames) {
      expect(example.name.startsWith('protocol.rtcp.'), example.id).toBe(true);
      expect(example.description?.startsWith('protocol.rtcp.'), example.id).toBe(true);
    }
  });
});

describe('canParse', () => {
  it('4 baytın altını reddeder', () => {
    expect(rtcpParser.canParse(Uint8Array.from([0x80, 0xc8, 0x00]))).toBe(false);
  });

  it('tanınmayan Packet Type\'ı reddeder', () => {
    expect(rtcpParser.canParse(Uint8Array.from([0x80, 0x05, 0x00, 0x00]))).toBe(false);
  });

  it('versiyon 2 + tanınan Packet Type\'ı kabul eder', () => {
    expect(rtcpParser.canParse(Uint8Array.from([0x80, 0xc8, 0x00, 0x00]))).toBe(true);
  });
});

describe('Ortak başlık', () => {
  it('RR başlığını V/P/Count/PacketType/Length alanlarına ayrıştırır', () => {
    const bytes = Uint8Array.from([0x80, 0xc9, 0x00, 0x01, 0x12, 0x34, 0x56, 0x78]);
    const { frame } = expectSuccess(rtcpParser.parse(bytes));
    expect(fieldById(frame, 'common-version-0').rawValue).toBe(2);
    expect(fieldById(frame, 'common-padding-0').rawValue).toBe(0);
    expect(fieldById(frame, 'common-count-0').name).toBe('RTCP Packet 0 Reception Report Count');
    expect(fieldById(frame, 'common-packet-type-1').rawValue).toBe(201);
    expect(fieldById(frame, 'common-packet-type-1').physicalValue).toBe('RR (Receiver Report)');
    expect(fieldById(frame, 'common-length-2').rawValue).toBe(1);
    expect(fieldById(frame, 'common-length-2').physicalValue).toBe(8);
  });

  it('versiyon 2 değilse uyarır', () => {
    const bytes = Uint8Array.from([0x00, 0xc8, 0x00, 0x00]);
    const { frame } = expectSuccess(rtcpParser.parse(bytes));
    expect(warningCodes(frame)).toContain('protocol.rtcp.warning.versionUnexpected');
  });

  it('4 bayttan kısa girdide truncated-frame ile başarısız olur', () => {
    const { error } = expectFailure(rtcpParser.parse(Uint8Array.from([0x80, 0xc8])));
    expect(error.code).toBe('truncated-frame');
  });

  it('length alanı tampon dışına taşarsa FATAL truncated-frame basar', () => {
    const bytes = Uint8Array.from([0x80, 0xc9, 0x00, 0x05, 0x12, 0x34, 0x56, 0x78]);
    const { frame } = expectSuccess(rtcpParser.parse(bytes));
    expect(frame.valid).toBe(false);
    expect(frame.errors[0]?.code).toBe('truncated-frame');
    expect(frame.errors[0]?.message).toBe('protocol.rtcp.error.lengthTruncated');
  });

  it('compound paket SR/RR ile başlamıyorsa uyarır', () => {
    const bytes = Uint8Array.from([0x80, 0xd2, 0x00, 0x01, 0xde, 0xad, 0xbe, 0xef]);
    const { frame } = expectSuccess(rtcpParser.parse(bytes));
    expect(warningCodes(frame)).toContain('protocol.rtcp.warning.compoundMustStartWithReport');
    expect(warningCodes(frame)).toContain('protocol.rtcp.warning.unknownPacketType');
  });
});

describe('Sender Report (SR)', () => {
  const bytes = Uint8Array.from([
    0x81, 0xc8, 0x00, 0x0c, // header: V2 P0 RC1 PT200 length=12 words (52B)
    0xaa, 0xbb, 0xcc, 0xdd, // SSRC
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, // NTP timestamp (unset)
    0x00, 0x00, 0x00, 0x01, // RTP timestamp
    0x00, 0x00, 0x00, 0x02, // sender packet count
    0x00, 0x00, 0x00, 0x03, // sender octet count
    0x11, 0x22, 0x33, 0x44, // report block SSRC
    0x80, // fraction lost = 128/256 = 50%
    0xff, 0xff, 0xff, // cumulative lost = -1 (signed 24-bit)
    0x00, 0x00, 0x00, 0x05, // extended highest sequence
    0x00, 0x00, 0x00, 0x06, // jitter
    0x00, 0x00, 0x00, 0x07, // LSR (ham)
    0x00, 0x01, 0x00, 0x00, // DLSR = 1.0 s = 1000 ms
  ]);

  it('sabit gövde + tek rapor bloğunu doğru çözer', () => {
    const { frame } = expectSuccess(rtcpParser.parse(bytes));
    expect(frame.valid).toBe(true);
    expect(fieldById(frame, 'report-ssrc-4').rawValue).toBe(0xaabbccdd);
    expect(fieldById(frame, 'report-ntp-timestamp-8').physicalValue).toBeUndefined();
    expect(fieldById(frame, 'report-rtp-timestamp-16').rawValue).toBe(1);
    expect(fieldById(frame, 'report-sender-packet-count-20').rawValue).toBe(2);
    expect(fieldById(frame, 'report-sender-octet-count-24').rawValue).toBe(3);
    expect(fieldById(frame, 'report-block-ssrc-28').rawValue).toBe(0x11223344);
    expect(fieldById(frame, 'report-block-fraction-lost-28').physicalValue).toBe(50);
    expect(fieldById(frame, 'report-block-cumulative-lost-28').rawValue).toBe(-1);
    expect(fieldById(frame, 'report-block-extended-seq-28').rawValue).toBe(5);
    expect(fieldById(frame, 'report-block-jitter-28').rawValue).toBe(6);
    expect(fieldById(frame, 'report-block-lsr-28').rawValue).toBe(7);
    expect(fieldById(frame, 'report-block-dlsr-28').physicalValue).toBe(1000);
  });

  it('gerçek NTP damgası verildiğinde ISO metnini üretir (ntpTimestamp.ts paylaşımı)', () => {
    const withNtp = bytes.slice();
    // seconds = 0xe4359c00, fraction = 0 — MSB=1 -> era 0, unset:false.
    withNtp.set([0xe4, 0x35, 0x9c, 0x00], 8);
    const { frame } = expectSuccess(rtcpParser.parse(withNtp));
    const ntpField = fieldById(frame, 'report-ntp-timestamp-8');
    expect(typeof ntpField.physicalValue).toBe('string');
    expect(ntpField.rawValue).toBe((0xe4359c00n << 32n) | 0n);
  });

  it('rapor bloğu declared length içine sığmıyorsa body-truncated basar ama sonraki alt pakete geçer', () => {
    const truncatedSr = Uint8Array.from([
      0x81, 0xc8, 0x00, 0x06, // length=6 words (28B) — yalnız sabit gövdeye yeter, rapor bloğuna DEĞİL
      0xaa, 0xbb, 0xcc, 0xdd,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x01,
      0x00, 0x00, 0x00, 0x02,
      0x00, 0x00, 0x00, 0x03,
    ]);
    const unknown = Uint8Array.from([0x80, 0xd2, 0x00, 0x01, 0xde, 0xad, 0xbe, 0xef]);
    const compound = new Uint8Array(truncatedSr.length + unknown.length);
    compound.set(truncatedSr, 0);
    compound.set(unknown, truncatedSr.length);

    const { frame } = expectSuccess(rtcpParser.parse(compound));
    expect(frame.valid).toBe(false);
    expect(frame.errors.some((e) => e.message === 'protocol.rtcp.error.bodyTruncated')).toBe(true);
    // Framing `length` alanına güvenerek ikinci alt pakete GEÇİLDİ (dosya başı kararı).
    expect(hasField(frame, 'unknown-body-32')).toBe(true);
    expect(warningCodes(frame)).toContain('protocol.rtcp.warning.unknownPacketType');
  });
});

describe('Receiver Report (RR) ve Padding', () => {
  it('RC=0 iken yalnız SSRC alanı basılır', () => {
    const bytes = Uint8Array.from([0x80, 0xc9, 0x00, 0x01, 0x12, 0x34, 0x56, 0x78]);
    const { frame } = expectSuccess(rtcpParser.parse(bytes));
    expect(fieldById(frame, 'report-ssrc-4').rawValue).toBe(0x12345678);
    expect(hasField(frame, 'report-block-ssrc-8')).toBe(false);
  });

  it('P=1 iken son bayt (kendisi dâhil) dolgu sayısı olur ve gövdeden çıkarılır', () => {
    const bytes = Uint8Array.from([
      0xa0, 0xc9, 0x00, 0x02, 0x12, 0x34, 0x56, 0x78, 0x00, 0x00, 0x00, 0x04,
    ]);
    const { frame } = expectSuccess(rtcpParser.parse(bytes));
    expect(frame.valid).toBe(true);
    expect(fieldById(frame, 'padding-bytes-0').rawValue).toBe(4);
    expect(fieldById(frame, 'report-ssrc-4').rawValue).toBe(0x12345678);
    // Tek (dolayısıyla SON) alt paket — "yalnız son paket geçerli" uyarısı BASILMAZ.
    expect(warningCodes(frame)).not.toContain('protocol.rtcp.warning.paddingNotLast');
  });

  it('son alt paket DEĞİLKEN dolgu taşıyorsa uyarır (RFC 3550 §6.1 ihlali)', () => {
    const paddedRr = Uint8Array.from([
      0xa0, 0xc9, 0x00, 0x02, 0x12, 0x34, 0x56, 0x78, 0x00, 0x00, 0x00, 0x04,
    ]);
    // Boş gövdeli BYE (SC0, length=0 word) — yalnız "sonrasında veri var mı"
    // kontrolünü tetiklemek için, kendi içeriği testin konusu değil.
    const bye = Uint8Array.from([0x80, 0xcb, 0x00, 0x00]);
    const compound = new Uint8Array(paddedRr.length + bye.length);
    compound.set(paddedRr, 0);
    compound.set(bye, paddedRr.length);

    const { frame } = expectSuccess(rtcpParser.parse(compound));
    expect(warningCodes(frame)).toContain('protocol.rtcp.warning.paddingNotLast');
  });

  it('dolgu sayısı kalan alandan büyükse value-out-of-range basar', () => {
    const bytes = Uint8Array.from([0xa0, 0xc9, 0x00, 0x01, 0x12, 0x34, 0x56, 0x09]);
    const { frame } = expectSuccess(rtcpParser.parse(bytes));
    expect(frame.valid).toBe(false);
    expect(frame.errors.some((e) => e.message === 'protocol.rtcp.error.paddingInvalid')).toBe(true);
  });
});

describe('Source Description (SDES)', () => {
  it('CNAME + TOOL item\'larını okur, END\'de durur', () => {
    const bytes = Uint8Array.from([
      0x81, 0xca, 0x00, 0x04, // V2 P0 SC1 PT202 length=4 words (20B)
      0x12, 0x34, 0x56, 0x78, // chunk SSRC (offset 4-7)
      0x01, 0x03, 0x61, 0x40, 0x62, // CNAME(1) len3 "a@b" (offset 8-12)
      0x06, 0x04, 0x6f, 0x62, 0x73, 0x00, // TOOL(6) len4 "obs\0" (offset 13-18)
      0x00, // END (offset 19)
    ]);
    // chunk baytları: 4(ssrc)+5(cname)+6(tool)+1(end)=16 -> zaten 4'e hizalı, ek dolgu yok.
    const { frame } = expectSuccess(rtcpParser.parse(bytes));
    expect(frame.valid).toBe(true);
    expect(fieldById(frame, 'sdes-chunk-ssrc-4').rawValue).toBe(0x12345678);
    expect(fieldById(frame, 'sdes-item-8').name).toBe('SDES Chunk 0 CNAME');
    expect(fieldById(frame, 'sdes-item-8').physicalValue).toBe('a@b');
    expect(fieldById(frame, 'sdes-item-13').name).toBe('SDES Chunk 0 TOOL');
    expect(fieldById(frame, 'sdes-item-13').physicalValue).toBe('obs\x00');
  });

  it('PRIV item\'ını prefix=value biçiminde çözer', () => {
    const bytes = Uint8Array.from([
      0x81, 0xca, 0x00, 0x03, // length=3 words (16B)
      0x12, 0x34, 0x56, 0x78, // chunk SSRC
      0x08, 0x05, 0x02, 0x69, 0x64, 0x39, 0x39, // PRIV(8) len5: prefixLen2 "id" value "99"
      0x00, // END
    ]);
    const { frame } = expectSuccess(rtcpParser.parse(bytes));
    expect(fieldById(frame, 'sdes-item-8').name).toBe('SDES Chunk 0 PRIV');
    expect(fieldById(frame, 'sdes-item-8').physicalValue).toBe('id=99');
  });

  it('tanınmayan item tipini "Unknown(n)" adıyla ham gösterir', () => {
    const bytes = Uint8Array.from([
      0x81, 0xca, 0x00, 0x03, 0x12, 0x34, 0x56, 0x78, 0x09, 0x02, 0xaa, 0xbb, 0x00, 0x00, 0x00, 0x00,
    ]);
    const { frame } = expectSuccess(rtcpParser.parse(bytes));
    expect(fieldById(frame, 'sdes-item-8').name).toBe('SDES Chunk 0 Unknown(9)');
  });
});

describe('BYE', () => {
  it('sebep metni olmadan SSRC listesini okur', () => {
    const bytes = Uint8Array.from([0x81, 0xcb, 0x00, 0x01, 0x12, 0x34, 0x56, 0x78]);
    const { frame } = expectSuccess(rtcpParser.parse(bytes));
    expect(fieldById(frame, 'bye-source-4').rawValue).toBe(0x12345678);
    expect(hasField(frame, 'bye-reason-8')).toBe(false);
  });

  it('sebep metnini uzunluk-öncelikli okur', () => {
    const bytes = Uint8Array.from([0x81, 0xcb, 0x00, 0x02, 0x12, 0x34, 0x56, 0x78, 0x03, 0x62, 0x79, 0x65]);
    const { frame } = expectSuccess(rtcpParser.parse(bytes));
    expect(fieldById(frame, 'bye-reason-8').physicalValue).toBe('bye');
  });
});

describe('APP', () => {
  it('SSRC + 4 karakterlik isim + ham veriyi ayrıştırır', () => {
    const bytes = Uint8Array.from([
      0x80, 0xcc, 0x00, 0x03, 0x12, 0x34, 0x56, 0x78, 0x71, 0x74, 0x73, 0x69, 0xde, 0xad, 0xbe, 0xef,
    ]);
    const { frame } = expectSuccess(rtcpParser.parse(bytes));
    expect(fieldById(frame, 'app-ssrc-4').rawValue).toBe(0x12345678);
    expect(fieldById(frame, 'app-name-8').physicalValue).toBe('qtsi');
    expect(fieldById(frame, 'app-data-12').rawBytes).toEqual(Uint8Array.from([0xde, 0xad, 0xbe, 0xef]));
  });
});

describe('parseRtcp yardımcı fonksiyonu', () => {
  it('bağlamsız çağrıda parser ile aynı alanları üretir', () => {
    const bytes = Uint8Array.from([0x80, 0xc9, 0x00, 0x01, 0x12, 0x34, 0x56, 0x78]);
    const { frame } = expectSuccess(parseRtcp(bytes));
    expect(frame.fields).toEqual(expectSuccess(rtcpParser.parse(bytes)).frame.fields);
  });
});
