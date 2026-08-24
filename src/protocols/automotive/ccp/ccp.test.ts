import { describe, expect, it } from 'vitest';

import { CCP_COMMAND_NAMES, CCP_RETURN_CODE_NAMES, ccpParser, ccpPlugin, parseCcp } from './ccp';
import { buildCanClassicFrame } from '../can/canClassic';
import { isParseSuccess } from '@/protocol-core/types';
import type { ParsedField } from '@/protocol-core/types';

function fieldById(fields: ParsedField[], id: string): ParsedField | undefined {
  return fields.find((field) => field.id === id);
}

describe('CCP komut/dönüş kodu tabloları — çapraz doğrulama boyutu', () => {
  it('28 komut kodu içerir (pySART + CanCat kesişimi)', () => {
    expect(CCP_COMMAND_NAMES.size).toBe(28);
    expect(CCP_COMMAND_NAMES.get(0x01)).toBe('CONNECT');
    expect(CCP_COMMAND_NAMES.get(0x02)).toBe('SET_MTA');
    expect(CCP_COMMAND_NAMES.get(0x1b)).toBe('GET_CCP_VERSION');
  });

  it('18 dönüş kodu içerir (pySART + CanCat kesişimi)', () => {
    expect(CCP_RETURN_CODE_NAMES.size).toBe(18);
    expect(CCP_RETURN_CODE_NAMES.get(0x00)).toBe('ACKNOWLEDGE');
    expect(CCP_RETURN_CODE_NAMES.get(0x36)).toBe('RESOURCE_FUNCTION_NOT_AVAILABLE');
  });
});

describe('ccpParser.canParse', () => {
  it('8-16 bayt arası her uzunluğu kabul eder', () => {
    expect(ccpParser.canParse(buildCanClassicFrame(0x7e0, [0x01]))).toBe(true);
    expect(
      ccpParser.canParse(buildCanClassicFrame(0x7e0, [0x01, 0x20, 0, 0, 0, 0, 0, 0])),
    ).toBe(true);
  });

  it('8 bayttan kısa ya da 16 bayttan uzun girdiyi reddeder', () => {
    expect(ccpParser.canParse(new Uint8Array(7))).toBe(false);
    expect(ccpParser.canParse(new Uint8Array(72))).toBe(false);
  });
});

describe('ccpParser.parse — girdi sınırları', () => {
  it('8 bayttan kısa girdi truncated-frame verir, kurtarılabilir', () => {
    const result = ccpParser.parse(new Uint8Array(4));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('truncated-frame');
      expect(result.recoverable).toBe(true);
    }
  });

  it('16 baytı aşan girdi frame-too-long verir', () => {
    const result = ccpParser.parse(new Uint8Array(20));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('frame-too-long');
    }
  });

  it('boş payload (DLC=0) truncated-frame hatası verir', () => {
    const result = ccpParser.parse(buildCanClassicFrame(0x7e0, []));
    expect(result.success).toBe(true);
    if (isParseSuccess(result)) {
      expect(result.frame.valid).toBe(false);
      expect(result.frame.errors.some((error) => error.code === 'truncated-frame')).toBe(true);
    }
  });

  it('8 bayttan kısa (ama sıfır olmayan) payload shortFrame uyarısı basar, hata basmaz', () => {
    const result = ccpParser.parse(buildCanClassicFrame(0x7e0, [0x01, 0x20]));
    expect(result.success).toBe(true);
    if (isParseSuccess(result)) {
      expect(result.frame.valid).toBe(true);
      expect(result.frame.warnings.some((warning) => warning.code === 'protocol.ccp.warning.shortFrame')).toBe(
        true,
      );
    }
  });

  it('iptal sinyali parser-timeout verir, kurtarılamaz', () => {
    const controller = new AbortController();
    controller.abort();
    const result = ccpParser.parse(buildCanClassicFrame(0x7e0, [0x01]), { signal: controller.signal });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('parser-timeout');
      expect(result.recoverable).toBe(false);
    }
  });
});

describe('ccpParser.parse — koşulsuz legacy uyarısı', () => {
  it('varsayılan raw modda bile HER başarılı çözümde basılır', () => {
    const result = parseCcp(buildCanClassicFrame(0x7e0, [0x01, 0x20, 0, 0, 0, 0, 0, 0]));
    expect(result.success).toBe(true);
    if (isParseSuccess(result)) {
      expect(result.frame.warnings.some((warning) => warning.code === 'protocol.ccp.warning.legacyProtocol')).toBe(
        true,
      );
    }
  });

  it('cro ve dto yorumlarında da basılır', () => {
    const data = buildCanClassicFrame(0x7e0, [0x01, 0x20, 0, 0, 0, 0, 0, 0]);
    const cro = ccpParser.parse(data, { options: { frameInterpretation: 'cro' } });
    const dto = ccpParser.parse(data, { options: { frameInterpretation: 'dto' } });
    for (const result of [cro, dto]) {
      expect(result.success).toBe(true);
      if (isParseSuccess(result)) {
        expect(
          result.frame.warnings.some((warning) => warning.code === 'protocol.ccp.warning.legacyProtocol'),
        ).toBe(true);
      }
    }
  });
});

describe('ccpParser.parse — decodeOptions: frameInterpretation=raw (varsayılan)', () => {
  it('tek genel Data alanı gösterir, Command/Counter alanı YOK', () => {
    const result = parseCcp(buildCanClassicFrame(0x7e0, [0x01, 0x20, 0, 0, 0, 0, 0, 0]));
    expect(result.success).toBe(true);
    if (isParseSuccess(result)) {
      expect(fieldById(result.frame.fields, 'data')).toBeDefined();
      expect(fieldById(result.frame.fields, 'command')).toBeUndefined();
      expect(fieldById(result.frame.fields, 'packet-id')).toBeUndefined();
    }
  });
});

describe('ccpParser.parse — decodeOptions: frameInterpretation=cro', () => {
  it('CONNECT komutunu adlandırır ve station address’i little-endian çözer', () => {
    // station address 0x1234 -> LE bayt: 34 12
    const data = buildCanClassicFrame(0x7e0, [0x01, 0x20, 0x34, 0x12, 0x90, 0x90, 0x90, 0x90]);
    const result = ccpParser.parse(data, { options: { frameInterpretation: 'cro' } });
    expect(result.success).toBe(true);
    if (isParseSuccess(result)) {
      expect(fieldById(result.frame.fields, 'command')?.physicalValue).toBe('CONNECT');
      expect(fieldById(result.frame.fields, 'counter')?.rawValue).toBe(0x20);
      expect(fieldById(result.frame.fields, 'station-address')?.rawValue).toBe(0x1234);
    }
  });

  it('SET_MTA adresini big-endian (Motorola, sabit) çözer', () => {
    // address 0x00002000 -> BE bayt: 00 00 20 00
    const data = buildCanClassicFrame(0x7e0, [0x02, 0x21, 0x00, 0x00, 0x00, 0x00, 0x20, 0x00]);
    const result = ccpParser.parse(data, { options: { frameInterpretation: 'cro' } });
    expect(result.success).toBe(true);
    if (isParseSuccess(result)) {
      expect(fieldById(result.frame.fields, 'command')?.physicalValue).toBe('SET_MTA');
      expect(fieldById(result.frame.fields, 'mta-number')?.rawValue).toBe(0);
      expect(fieldById(result.frame.fields, 'address-extension')?.rawValue).toBe(0);
      expect(fieldById(result.frame.fields, 'address')?.rawValue).toBe(0x00002000);
    }
  });

  it('tabloda olmayan komut kodu Unassigned + uyarı verir, uydurma isim YOK', () => {
    const data = buildCanClassicFrame(0x7e0, [0x0a, 0x00, 0x90, 0x90, 0x90, 0x90, 0x90, 0x90]);
    const result = ccpParser.parse(data, { options: { frameInterpretation: 'cro' } });
    expect(result.success).toBe(true);
    if (isParseSuccess(result)) {
      expect(fieldById(result.frame.fields, 'command')?.physicalValue).toBe('Unassigned (0x0A)');
      expect(
        result.frame.warnings.some((warning) => warning.code === 'protocol.ccp.warning.unassignedCommand'),
      ).toBe(true);
    }
  });

  it('CONNECT/SET_MTA dışındaki komutların parametreleri HAM kalır', () => {
    const data = buildCanClassicFrame(0x7e0, [0x04, 0x22, 0x11, 0x22, 0x33, 0x44, 0x55, 0x66]); // UPLOAD
    const result = ccpParser.parse(data, { options: { frameInterpretation: 'cro' } });
    expect(result.success).toBe(true);
    if (isParseSuccess(result)) {
      expect(fieldById(result.frame.fields, 'command')?.physicalValue).toBe('UPLOAD');
      expect(fieldById(result.frame.fields, 'parameters')).toBeDefined();
      expect(fieldById(result.frame.fields, 'parameters')?.rawBytes).toHaveLength(6);
    }
  });
});

describe('ccpParser.parse — decodeOptions: frameInterpretation=dto', () => {
  it('0xFF → Command Return Message, Return Code tabloya adlanır', () => {
    const data = buildCanClassicFrame(0x7e8, [0xff, 0x00, 0x20, 0x90, 0x90, 0x90, 0x90, 0x90]);
    const result = ccpParser.parse(data, { options: { frameInterpretation: 'dto' } });
    expect(result.success).toBe(true);
    if (isParseSuccess(result)) {
      expect(fieldById(result.frame.fields, 'packet-id')?.physicalValue).toBe('Command Return Message (CRM)');
      expect(fieldById(result.frame.fields, 'return-code')?.physicalValue).toBe('ACKNOWLEDGE');
      expect(fieldById(result.frame.fields, 'counter')?.rawValue).toBe(0x20);
      // Hangi komutun cevabı olduğu bilinmediği için response-data HER ZAMAN ham kalır.
      expect(fieldById(result.frame.fields, 'response-data')).toBeDefined();
      expect(
        result.frame.warnings.some((warning) => warning.code === 'protocol.ccp.warning.responseDataRaw'),
      ).toBe(true);
    }
  });

  it('bilinmeyen dönüş kodu için isim uydurmaz, ham hex + uyarı basar', () => {
    const data = buildCanClassicFrame(0x7e8, [0xff, 0x99, 0x20, 0x90, 0x90, 0x90, 0x90, 0x90]);
    const result = ccpParser.parse(data, { options: { frameInterpretation: 'dto' } });
    expect(result.success).toBe(true);
    if (isParseSuccess(result)) {
      expect(fieldById(result.frame.fields, 'return-code')?.physicalValue).toBe('0x99');
      expect(
        result.frame.warnings.some((warning) => warning.code === 'protocol.ccp.warning.unknownReturnCode'),
      ).toBe(true);
    }
  });

  it('0xFE → Event Message olarak adlanır', () => {
    const data = buildCanClassicFrame(0x7e8, [0xfe, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07]);
    const result = ccpParser.parse(data, { options: { frameInterpretation: 'dto' } });
    expect(result.success).toBe(true);
    if (isParseSuccess(result)) {
      expect(fieldById(result.frame.fields, 'packet-id')?.physicalValue).toBe('Event Message');
    }
  });

  it('0xFF/0xFE dışındaki ilk bayt DAQ verisi (PID) olarak adlanır, içerik A2L olmadan çözülmez', () => {
    const data = buildCanClassicFrame(0x7e8, [0x02, 0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77]);
    const result = ccpParser.parse(data, { options: { frameInterpretation: 'dto' } });
    expect(result.success).toBe(true);
    if (isParseSuccess(result)) {
      expect(fieldById(result.frame.fields, 'packet-id')?.physicalValue).toBe('DAQ data (PID)');
      expect(result.frame.warnings.some((warning) => warning.code === 'protocol.ccp.warning.daqData')).toBe(true);
    }
  });
});

describe('ccpPlugin', () => {
  it('xcp/xcpPacket çekirdeğini TÜKETMEZ — kendi bağımsız komut tablosu var', () => {
    // XCP'nin PID uzayı 0xC7-0xFF'te başlar; CCP'nin komut kodları 0x01-0x23
    // aralığında, tamamen farklı bir sayı uzayı ve anlam kümesi.
    expect(CCP_COMMAND_NAMES.has(0xff)).toBe(false);
    expect(CCP_COMMAND_NAMES.get(0x01)).toBe('CONNECT');
  });

  it('örnek çerçevelerin hepsi motorla sorunsuz çözülür', () => {
    for (const example of ccpPlugin.exampleFrames) {
      const result = ccpParser.parse(example.bytes);
      expect(result.success, `${example.id} parse etmedi`).toBe(true);
    }
  });

  it('decodeOptions tek şıklı frameInterpretation (raw/cro/dto) bildirir', () => {
    const options = ccpPlugin.decodeOptions ?? [];
    expect(options.map((option) => option.id)).toEqual(['frameInterpretation']);
    expect(options[0]?.choices?.map((choice) => choice.value)).toEqual(['raw', 'cro', 'dto']);
    expect(options[0]?.defaultValue).toBe('raw');
  });
});
