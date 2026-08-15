import { describe, expect, it } from 'vitest';

import { ipv4Parser, ipv4Plugin, parseIpv4 } from './ipv4';
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

/** İyi biçimli asgari (20 bayt, options'sız) başlık — checksum bağımsız hesaplandı
 * (internetChecksum.test.ts aynı fixture: 0xB1E6). */
function classicHeader(overrides: Partial<Record<string, number>> = {}): Uint8Array {
  const bytes = Uint8Array.from([
    overrides.versionIhl ?? 0x45,
    overrides.dscpEcn ?? 0x00,
    (0x003c >>> 8) & 0xff,
    0x003c & 0xff,
    (0x1c46 >>> 8) & 0xff,
    0x1c46 & 0xff,
    (0x4000 >>> 8) & 0xff,
    0x4000 & 0xff,
    0x40,
    overrides.protocol ?? 6,
    (0xb1e6 >>> 8) & 0xff,
    0xb1e6 & 0xff,
    172, 16, 10, 99,
    172, 16, 10, 12,
  ]);
  if (overrides.totalLength !== undefined) {
    bytes[2] = (overrides.totalLength >>> 8) & 0xff;
    bytes[3] = overrides.totalLength & 0xff;
  }
  if (overrides.checksum !== undefined) {
    bytes[10] = (overrides.checksum >>> 8) & 0xff;
    bytes[11] = overrides.checksum & 0xff;
  }
  return bytes;
}

describe('plugin kaydı', () => {
  it('kimlik/kategori/parser bağı katalogla eşleşir', () => {
    expect(ipv4Plugin.id).toBe('ipv4');
    expect(ipv4Plugin.category).toBe('network-ethernet');
    expect(ipv4Plugin.parser?.protocolId).toBe('ipv4');
    expect(ipv4Plugin.exampleFrames.length).toBeGreaterThan(0);
  });

  it('her örnek çerçeve çözülür ve expectedValid ile eşleşir', () => {
    for (const example of ipv4Plugin.exampleFrames) {
      const result = ipv4Parser.parse(example.bytes);
      if (!result.success) {
        throw new Error(`example "${example.id}" failed: ${result.error.code}`);
      }
      expect(result.frame.valid, `example "${example.id}"`).toBe(example.expectedValid ?? true);
    }
  });

  it('her örnek adı/açıklaması protocol.ipv4. önekli çeviri anahtarıdır', () => {
    for (const example of ipv4Plugin.exampleFrames) {
      expect(example.name.startsWith('protocol.ipv4.'), example.id).toBe(true);
    }
  });
});

describe('Version/IHL', () => {
  it('Version 4 dışındaki bir değeri hata değil uyarıyla basar', () => {
    const { frame } = expectSuccess(ipv4Parser.parse(classicHeader({ versionIhl: 0x65 })));
    expect(fieldById(frame, 'version').rawValue).toBe(6);
    expect(fieldById(frame, 'version').valid).toBe(true);
    expect(warningCodes(frame)).toContain('protocol.ipv4.warning.unexpectedVersion');
  });

  it('IHL < 5 yapısal HATA üretir ama sabit ofsetli alanlar yine görünür (kısmi çözüm)', () => {
    const { frame } = expectSuccess(ipv4Parser.parse(classicHeader({ versionIhl: 0x44 })));
    expect(frame.valid).toBe(false);
    expect(frame.errors[0]?.code).toBe('value-out-of-range');
    expect(fieldById(frame, 'ihl').valid).toBe(false);
    // TTL/Protocol/adresler sabit ofsette — IHL'in geçersizliğinden ETKİLENMEZ.
    expect(fieldById(frame, 'ttl').rawValue).toBe(0x40);
    expect(fieldById(frame, 'source-address').rawValue).toBe('172.16.10.99');
    // Options/payload/checksum doğrulaması sınırı IHL'e bağlı olduğu için ATLANIR.
    expect(hasField(frame, 'options')).toBe(false);
    expect(hasField(frame, 'payload')).toBe(false);
    expect(fieldById(frame, 'checksum').valid).toBe(true);
    expect(warningCodes(frame)).toContain('protocol.ipv4.warning.checksumVerificationSkipped');
  });
});

describe('Total Length', () => {
  it('IHL·4’ten küçük Total Length length-mismatch üretir', () => {
    const { frame } = expectSuccess(ipv4Parser.parse(classicHeader({ totalLength: 10 })));
    expect(frame.valid).toBe(false);
    expect(frame.errors.some((error) => error.code === 'length-mismatch')).toBe(true);
    expect(fieldById(frame, 'total-length').valid).toBe(false);
  });

  it('geçerli Total Length hata üretmez', () => {
    const { frame } = expectSuccess(ipv4Parser.parse(classicHeader()));
    expect(fieldById(frame, 'total-length').valid).toBe(true);
  });
});

describe('DSCP/ECN', () => {
  it('tek bayttan iki alt alanı ayrıştırır', () => {
    // 0xB8 = 1011 1000 → DSCP (üst 6 bit) = 0x2E, ECN (alt 2 bit) = 0x0.
    const { frame } = expectSuccess(ipv4Parser.parse(classicHeader({ dscpEcn: 0xb8 })));
    expect(fieldById(frame, 'dscp').rawValue).toBe(0x2e);
    expect(fieldById(frame, 'ecn').rawValue).toBe(0x0);
  });
});

describe('Flags / Fragment Offset', () => {
  it('spec örneğinde DF set, MF temiz, fragment offset 0 çözülür (0x4000)', () => {
    const { frame } = expectSuccess(ipv4Parser.parse(classicHeader()));
    expect(fieldById(frame, 'flags-reserved').rawValue).toBe(0);
    expect(fieldById(frame, 'flags-df').rawValue).toBe(1);
    expect(fieldById(frame, 'flags-mf').rawValue).toBe(0);
    expect(fieldById(frame, 'fragment-offset').rawValue).toBe(0);
  });
});

describe('Protocol adlandırma (karar 1)', () => {
  it('6/TCP adlandırılır ve üst katman uyarısı basar', () => {
    const { frame } = expectSuccess(ipv4Parser.parse(classicHeader({ protocol: 6 })));
    const protocolField = fieldById(frame, 'protocol');
    expect(protocolField.physicalValue).toBe('TCP');
    expect(protocolField.valid).toBe(true);
    expect(warningCodes(frame)).toContain('protocol.ipv4.warning.protocolHigherLayer');
  });

  it('17/UDP ve 1/ICMP de adlandırılır', () => {
    expect(
      fieldById(expectSuccess(ipv4Parser.parse(classicHeader({ protocol: 17 }))).frame, 'protocol')
        .physicalValue,
    ).toBe('UDP');
    expect(
      fieldById(expectSuccess(ipv4Parser.parse(classicHeader({ protocol: 1 }))).frame, 'protocol')
        .physicalValue,
    ).toBe('ICMP');
  });

  it('dar kümede olmayan bir Protocol değeri geçersiz işaretlenir ve ayrı uyarı basar', () => {
    const { frame } = expectSuccess(ipv4Parser.parse(classicHeader({ protocol: 253 })));
    const protocolField = fieldById(frame, 'protocol');
    expect(protocolField.valid).toBe(false);
    expect(protocolField.physicalValue).toBeUndefined();
    expect(warningCodes(frame)).toContain('protocol.ipv4.warning.unknownProtocol');
    expect(warningCodes(frame)).not.toContain('protocol.ipv4.warning.protocolHigherLayer');
    // Tanınmayan Protocol tek başına HATA değil UYARI üretir (checksum burada
    // ayrıca bozulduğu için frame.valid'i test etmiyoruz — bkz. ipv4Plugin'in
    // 'unknown-protocol' örneği, checksum'ı da tutarlı bir başlıkla expectedValid:true kanıtlıyor).
  });
});

describe('Header Checksum — pseudo-header GEREKTİRMEZ, TAM DOĞRULANIR', () => {
  it('doğru checksum PASS olarak işaretlenir', () => {
    const { frame } = expectSuccess(ipv4Parser.parse(classicHeader()));
    const checksum = fieldById(frame, 'checksum');
    expect(checksum.valid).toBe(true);
    expect(checksum.physicalValue).toBe('Valid');
    expect(frame.errors).toEqual([]);
  });

  it('bozuk checksum checksum-mismatch HATASI üretir', () => {
    const { frame } = expectSuccess(ipv4Parser.parse(classicHeader({ checksum: 0x0000 })));
    const checksum = fieldById(frame, 'checksum');
    expect(checksum.valid).toBe(false);
    expect(frame.valid).toBe(false);
    expect(frame.errors[0]?.code).toBe('checksum-mismatch');
  });

  it('payload checksum hesabını ETKİLEMEZ (yalnız başlık kapsanır)', () => {
    const withoutPayload = classicHeader();
    const withPayload = Uint8Array.from([...classicHeader(), 0xde, 0xad, 0xbe, 0xef]);
    const a = fieldById(expectSuccess(ipv4Parser.parse(withoutPayload)).frame, 'checksum');
    const b = fieldById(expectSuccess(ipv4Parser.parse(withPayload)).frame, 'checksum');
    expect(a.rawValue).toBe(b.rawValue);
    expect(a.valid).toBe(true);
    expect(b.valid).toBe(true);
  });
});

describe('Adresler', () => {
  it('nokta-nokta gösterime çevirir', () => {
    const { frame } = expectSuccess(ipv4Parser.parse(classicHeader()));
    expect(fieldById(frame, 'source-address').rawValue).toBe('172.16.10.99');
    expect(fieldById(frame, 'destination-address').rawValue).toBe('172.16.10.12');
  });
});

describe('Options', () => {
  it('IHL>5 olduğunda ham Options alanı üretir', () => {
    // IHL=6 (24 bayt): 20 baytlık asgari başlık + 4 baytlık options.
    const header = classicHeader({ versionIhl: 0x46, totalLength: 0x0028 });
    const withOptions = Uint8Array.from([...header, 0x01, 0x01, 0x01, 0x00]);
    const { frame } = expectSuccess(ipv4Parser.parse(withOptions));
    const options = fieldById(frame, 'options');
    expect(options.offset).toBe(20);
    expect(options.length).toBe(4);
    expect(Array.from(options.rawBytes)).toEqual([0x01, 0x01, 0x01, 0x00]);
  });
});

describe('canParse — ucuz ön eleme', () => {
  it('yalnız uzunluk + Version nibble 4 olan veriyi kabul eder', () => {
    expect(ipv4Parser.canParse(classicHeader())).toBe(true);
    expect(ipv4Parser.canParse(classicHeader({ versionIhl: 0x65 }))).toBe(false);
    expect(ipv4Parser.canParse(Uint8Array.from([0x45, 0x00]))).toBe(false);
  });
});

describe('başlık/uzunluk hataları', () => {
  it('20 bayttan kısa veri recoverable truncated-frame ile başarısız olur', () => {
    const result = expectFailure(ipv4Parser.parse(Uint8Array.from([0x45, 0x00, 0x00])));
    expect(result.error.code).toBe('truncated-frame');
    expect(result.recoverable).toBe(true);
  });

  it('maxFrameLength aşılınca kurtarılamaz frame-too-long ile başarısız olur', () => {
    const result = expectFailure(ipv4Parser.parse(classicHeader(), { maxFrameLength: 10 }));
    expect(result.error.code).toBe('frame-too-long');
    expect(result.recoverable).toBe(false);
  });

  it('parseIpv4 kısayolu doğru protokol kimliğine bağlar', () => {
    const { frame } = expectSuccess(parseIpv4(classicHeader()));
    expect(frame.protocol).toBe('ipv4');
  });

  it('iptal edilmiş sinyal parser-timeout ile başarısız olur', () => {
    const controller = new AbortController();
    controller.abort();
    const result = expectFailure(ipv4Parser.parse(classicHeader(), { signal: controller.signal }));
    expect(result.error.code).toBe('parser-timeout');
  });
});
