import { describe, expect, it } from 'vitest';

import { computeNamedCrc } from '@/protocol-core/checksums/crcCatalogue';
import type { ParseFailure, ParseResult, ParseSuccess, ParsedField, ParsedFrame } from '@/protocol-core/types';

import { parseWirelessMbus, wirelessMbusParser, wirelessMbusPlugin } from './wirelessMbus';

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

function fieldByIdOrUndefined(frame: ParsedFrame, id: string): ParsedField | undefined {
  return frame.fields.find((field) => field.id === id);
}

function exampleBytes(id: string): Uint8Array {
  const example = wirelessMbusPlugin.exampleFrames.find((candidate) => candidate.id === id);
  if (example === undefined) throw new Error(`example "${id}" not found`);
  return example.bytes;
}

/**
 * `simple-unencrypted` örneğinin gövdesi — CRC hesaplamalarını KENDİ elle
 * inşa edilmiş çerçevelerle de doğrulamak için burada tekrar kullanılıyor
 * (mbus.test.ts'nin `sum8Checksum`ı bağımsız çağırma deseninin aynısı).
 */
describe('CRC16_EN13757 fixture doğrulaması', () => {
  it('Block 1 (L+C+M+A) baytları üzerinde `computeNamedCrc` ile hesaplanan CRC, çerçevedeki baytla örtüşür', () => {
    const data = exampleBytes('simple-unencrypted');
    const covered = data.slice(0, 10);
    const calculated = Number(computeNamedCrc(covered, 'CRC16_EN13757'));
    const received = (data[10]! << 8) | data[11]!;
    expect(received).toBe(calculated);
  });
});

describe('wirelessMbusParser.canParse', () => {
  it('12 bayttan kısa veriyi reddeder', () => {
    expect(wirelessMbusParser.canParse(new Uint8Array(11))).toBe(false);
  });

  it('L alanı yapısal alt sınırın (9) altındaysa reddeder', () => {
    const data = new Uint8Array(12);
    data[0] = 3;
    expect(wirelessMbusParser.canParse(data)).toBe(false);
  });

  it('asgari uzunluk ve makul L değeriyle kabul eder (CRC burada DOĞRULANMAZ)', () => {
    expect(wirelessMbusParser.canParse(exampleBytes('simple-unencrypted'))).toBe(true);
  });
});

describe('simple-unencrypted — tek veri bloğu, CI=0x72, şifresiz', () => {
  const frame = expectSuccess(parseWirelessMbus(exampleBytes('simple-unencrypted'))).frame;

  it('çerçeve geçerli sayılır (hata yok)', () => {
    expect(frame.valid).toBe(true);
    expect(frame.errors).toEqual([]);
  });

  it('L-field ve C-field/Direction doğru çözülür', () => {
    expect(fieldById(frame, 'l-field').rawValue).toBe(25);
    expect(fieldById(frame, 'c-field-direction').physicalValue).toBe('From Meter');
  });

  it('Manufacturer ve Device Type DLL A-field üzerinden çözülür (KAM / Heat (Outlet))', () => {
    expect(fieldById(frame, 'm-field').physicalValue).toBe('KAM');
    expect(fieldById(frame, 'a-field-identification').rawValue).toBe('12345678');
    expect(fieldById(frame, 'a-field-device-type').physicalValue).toBe('Heat (Outlet)');
  });

  it('Block 1 CRC geçerli işaretlenir', () => {
    expect(fieldById(frame, 'block1-crc').valid).toBe(true);
  });

  it('CI-field 0x72 olarak adlandırılır ve decodeVariableData zincirine devredilir', () => {
    const ci = fieldById(frame, 'ci-field');
    expect(ci.physicalValue).toBe('TPL: Long Header APL Follows');
    // Paylaşılan motorun bastığı Fixed Header alanları (mbusVariableData.ts'teki id'lerin AYNISI).
    expect(fieldById(frame, 'fixed-header-identification-number').rawValue).toBe('12345678');
    expect(fieldById(frame, 'fixed-header-manufacturer').physicalValue).toBe('KAM');
    expect(fieldById(frame, 'fixed-header-medium').physicalValue).toBe('Heat (Outlet)');
  });

  it('Security Mode 0 (şifresiz) olarak çözülür', () => {
    const security = fieldById(frame, 'security-mode');
    expect(security.rawValue).toBe(0);
    expect(security.physicalValue).toBe('Not Encrypted');
    expect(security.valid).toBe(true);
  });

  it('tek DIF/VIF kaydı Energy=42 Wh olarak çözülür', () => {
    expect(fieldById(frame, 'vif-0').physicalValue).toBe('Energy (Wh)');
    expect(fieldById(frame, 'data-0').physicalValue).toBe(42);
  });

  it('şifreli payload alanı BASILMAZ (çünkü Mode 0)', () => {
    expect(fieldByIdOrUndefined(frame, 'encrypted-payload')).toBeUndefined();
  });

  it('çoklu-blok offset uyarısı basılmaz (tek blok)', () => {
    expect(frame.warnings.some((w) => w.code === 'protocol.wirelessMbus.warning.multiBlockOffsetApproximate')).toBe(
      false,
    );
  });
});

describe('multi-block-three-records — iki veri bloğuna yayılan CI=0x72', () => {
  const frame = expectSuccess(parseWirelessMbus(exampleBytes('multi-block-three-records'))).frame;

  it('çerçeve geçerli sayılır, iki veri bloğu CRC alanı basılır', () => {
    expect(frame.valid).toBe(true);
    expect(fieldById(frame, 'data-block-0-crc').valid).toBe(true);
    expect(fieldById(frame, 'data-block-1-crc').valid).toBe(true);
  });

  it('üç kayıt da (Energy/Volume/Flow Temperature) doğru mühendislik değerine çevrilir', () => {
    expect(fieldById(frame, 'vif-0').physicalValue).toBe('Energy (Wh)');
    expect(fieldById(frame, 'data-0').physicalValue).toBe(123456);

    expect(fieldById(frame, 'vif-1').physicalValue).toBe('Volume (m³)');
    expect(fieldById(frame, 'data-1').physicalValue).toBeCloseTo(12.565, 3);

    expect(fieldById(frame, 'vif-2').physicalValue).toBe('Flow Temperature (°C)');
    expect(fieldById(frame, 'data-2').physicalValue).toBeCloseTo(23.5, 3);
  });

  it('blok sınırı aşıldığı için offset-yaklaşıklığı uyarısı basılır', () => {
    expect(frame.warnings.some((w) => w.code === 'protocol.wirelessMbus.warning.multiBlockOffsetApproximate')).toBe(
      true,
    );
  });
});

describe('encrypted-mode-5 — Security Mode 5, header çözülür payload çözülmez', () => {
  const frame = expectSuccess(parseWirelessMbus(exampleBytes('encrypted-mode-5'))).frame;

  it('çerçeve geçerli sayılır (yapısal hata yok, yalnız payload şifreli)', () => {
    expect(frame.valid).toBe(true);
  });

  it('Security Mode 5 olarak adlandırılır', () => {
    const security = fieldById(frame, 'security-mode');
    expect(security.rawValue).toBe(5);
    expect(security.physicalValue).toContain('Mode 5');
    expect(security.valid).toBe(true);
  });

  it('Fixed Header alanları (şifrelenmemiş kısım) yine çözülür', () => {
    expect(fieldById(frame, 'fixed-header-manufacturer').physicalValue).toBe('KAM');
  });

  it('DIF/VIF zinciri BAŞLATILMAZ — decodeVariableData yalnız header ile çağrılır', () => {
    expect(fieldByIdOrUndefined(frame, 'vif-0')).toBeUndefined();
    expect(fieldByIdOrUndefined(frame, 'data-0')).toBeUndefined();
  });

  it('kalan baytlar "Encrypted Payload" olarak, şifre ÇÖZÜLMEDEN gösterilir', () => {
    const encrypted = fieldById(frame, 'encrypted-payload');
    expect(encrypted.physicalValue).toBe('Encrypted');
    expect(encrypted.rawBytes.length).toBe(16);
    expect(frame.warnings.some((w) => w.code === 'protocol.wirelessMbus.warning.encryptedPayload')).toBe(true);
  });
});

describe('block1-crc-mismatch — Block 1 CRC bozuk', () => {
  it('block1-crc alanı geçersiz işaretlenir ve crc-mismatch hatası basılır', () => {
    const frame = expectSuccess(parseWirelessMbus(exampleBytes('block1-crc-mismatch'))).frame;
    expect(frame.valid).toBe(false);
    expect(fieldById(frame, 'block1-crc').valid).toBe(false);
    expect(frame.errors.some((e) => e.code === 'crc-mismatch')).toBe(true);
    // Checksum bozuk olsa da alanlar yine çözülür (dürüstlük ilkesi — mbus.ts'nin aynı deseni).
    expect(fieldById(frame, 'm-field').physicalValue).toBe('KAM');
  });
});

describe('unsupported-ci — CI=0x78 (No Header APL), bu dalgada çözülmüyor', () => {
  it('CI adlandırılır ama APL payload HAM + uyarıyla basılır', () => {
    const frame = expectSuccess(parseWirelessMbus(exampleBytes('unsupported-ci'))).frame;
    const ci = fieldById(frame, 'ci-field');
    expect(ci.physicalValue).toBe('TPL: No Header APL Follows');
    const payload = fieldById(frame, 'apl-payload');
    expect(payload.rawBytes.length).toBe(4);
    expect(frame.warnings.some((w) => w.code === 'protocol.wirelessMbus.warning.ciNotDecoded')).toBe(true);
    // decodeVariableData'ya devredilmediği için Fixed Header alanları YOK.
    expect(fieldByIdOrUndefined(frame, 'fixed-header-identification-number')).toBeUndefined();
  });
});

describe('kısa çerçeveler', () => {
  it('boş veri ParseFailure döner (empty-frame)', () => {
    const failure = expectFailure(parseWirelessMbus(new Uint8Array()));
    expect(failure.error.message).toBe('protocol.wirelessMbus.error.emptyFrame');
  });

  it('12 bayttan kısa veri ParseFailure döner (block1Truncated)', () => {
    const failure = expectFailure(parseWirelessMbus(new Uint8Array(11)));
    expect(failure.error.message).toBe('protocol.wirelessMbus.error.block1Truncated');
    expect(failure.recoverable).toBe(true);
  });
});

describe('decodeOptions — radyo bağlamı (bayt akışından ÇIKARILAMAYAN alanlar)', () => {
  it('varsayılan değerlerle çağrıldığında radio-* alanları yine basılır', () => {
    const frame = expectSuccess(parseWirelessMbus(exampleBytes('simple-unencrypted'))).frame;
    expect(fieldById(frame, 'radio-mode').rawValue).toBe('unknown');
    expect(fieldById(frame, 'radio-frequency').rawValue).toBe(868.95);
  });

  it('context.options üzerinden verilen değerler alanlara yansır', () => {
    const result = wirelessMbusParser.parse(exampleBytes('simple-unencrypted'), {
      options: { radioMode: 'T1', frequencyMhz: 868.3, rssiDbm: -72, linkQuality: 180 },
    });
    const frame = expectSuccess(result).frame;
    expect(fieldById(frame, 'radio-mode').rawValue).toBe('T1');
    expect(fieldById(frame, 'radio-frequency').rawValue).toBe(868.3);
    expect(fieldById(frame, 'radio-rssi').rawValue).toBe(-72);
    expect(fieldById(frame, 'radio-link-quality').rawValue).toBe(180);
  });

  it('sınır dışı sayısal değer varsayılana düşer', () => {
    const result = wirelessMbusParser.parse(exampleBytes('simple-unencrypted'), {
      options: { rssiDbm: 999 },
    });
    const frame = expectSuccess(result).frame;
    expect(fieldById(frame, 'radio-rssi').rawValue).toBe(0);
  });
});

describe('wirelessMbusPlugin — örnek çerçeveler ve expectedValid tutarlılığı', () => {
  it.each(wirelessMbusPlugin.exampleFrames)('$id → parse sonucu expectedValid ile örtüşür', (example) => {
    const result = parseWirelessMbus(example.bytes);
    if (example.expectedValid === true) {
      const success = expectSuccess(result);
      expect(success.frame.valid).toBe(true);
    } else {
      const success = expectSuccess(result);
      expect(success.frame.valid).toBe(false);
    }
  });

  it('protocolId ve kategori doğru ayarlanır', () => {
    expect(wirelessMbusPlugin.id).toBe('wireless-m-bus');
    expect(wirelessMbusPlugin.category).toBe('industrial-automation');
    expect(wirelessMbusPlugin.parser?.protocolId).toBe('wireless-m-bus');
  });
});
