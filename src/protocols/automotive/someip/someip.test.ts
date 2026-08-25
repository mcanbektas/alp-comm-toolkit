import { describe, expect, it } from 'vitest';

import { parseSomeIp, someIpParser, someIpPlugin } from './someip';
import type { SomeIpFrameMetadata } from './someip';
import type { ParsedField, ParsedFrame } from '@/protocol-core/types';

function fieldById(fields: ParsedField[], id: string): ParsedField | undefined {
  return fields.find((field) => field.id === id);
}

function exampleBytes(id: string): Uint8Array {
  const example = someIpPlugin.exampleFrames.find((candidate) => candidate.id === id);
  if (example === undefined) throw new Error(`example ${id} missing`);
  return example.bytes;
}

/**
 * Başlığı ALAN ALAN kurar. `Length` BİLEREK dışarıdan verilir: testin, üretim
 * kodunun `8 + payload` formülünü tekrar etmesi doğrulamayı kısırlaştırırdı —
 * beklenen değerler testte elle yazılır.
 */
function header(options: {
  serviceId: number;
  methodId: number;
  length: number;
  clientId: number;
  sessionId: number;
  protocolVersion?: number;
  interfaceVersion?: number;
  messageType: number;
  returnCode: number;
}): number[] {
  return [
    (options.serviceId >> 8) & 0xff,
    options.serviceId & 0xff,
    (options.methodId >> 8) & 0xff,
    options.methodId & 0xff,
    (options.length >>> 24) & 0xff,
    (options.length >>> 16) & 0xff,
    (options.length >>> 8) & 0xff,
    options.length & 0xff,
    (options.clientId >> 8) & 0xff,
    options.clientId & 0xff,
    (options.sessionId >> 8) & 0xff,
    options.sessionId & 0xff,
    options.protocolVersion ?? 0x01,
    options.interfaceVersion ?? 0x01,
    options.messageType,
    options.returnCode,
  ];
}

const REQUEST_NO_PAYLOAD = Uint8Array.from(
  header({
    serviceId: 0x1234,
    methodId: 0x0421,
    length: 8,
    clientId: 0x0001,
    sessionId: 0x0002,
    messageType: 0x00,
    returnCode: 0x00,
  }),
);

function frameOf(data: Uint8Array): ParsedFrame {
  const result = parseSomeIp(data);
  if (!result.success) throw new Error('beklenen başarılı çözüm');
  return result.frame;
}

describe('someIpParser.canParse', () => {
  it('16 bayt, Protocol Version 1 ve tutarlı Length olan mesajı kabul eder', () => {
    expect(someIpParser.canParse(REQUEST_NO_PAYLOAD)).toBe(true);
  });

  it('16 bayttan kısa girdiyi reddeder', () => {
    expect(someIpParser.canParse(REQUEST_NO_PAYLOAD.slice(0, 15))).toBe(false);
  });

  it('Protocol Version 1 değilse reddeder (Wireshark test_someip sezgiseli)', () => {
    const wrongVersion = Uint8Array.from(REQUEST_NO_PAYLOAD);
    wrongVersion[12] = 0x02;
    expect(someIpParser.canParse(wrongVersion)).toBe(false);
  });

  it('Length 8’den küçükse reddeder (yapısal alt sınır)', () => {
    const shortLength = Uint8Array.from(REQUEST_NO_PAYLOAD);
    shortLength[7] = 0x07;
    expect(someIpParser.canParse(shortLength)).toBe(false);
  });

  it('Length tamponu aşıyorsa reddeder ama yapışmış fazlalığa izin verir', () => {
    const overflowing = Uint8Array.from(REQUEST_NO_PAYLOAD);
    overflowing[7] = 0x40;
    expect(someIpParser.canParse(overflowing)).toBe(false);
    expect(someIpParser.canParse(Uint8Array.from([...REQUEST_NO_PAYLOAD, 0xff, 0xff]))).toBe(true);
  });
});

describe('someIpParser — Length alanının sayım tabanı', () => {
  /**
   * Bu dalganın en olası SESSİZ hatası (brief). AUTOSAR PRS_SOMEIP_00042 +
   * Wireshark `SOMEIP_HDR_PART1_LEN 8` + Scapy `LEN_OFFSET 0x08`: Length,
   * offset 8'den (Request ID) mesaj sonuna kadar sayar.
   */
  it('Length KENDİ baytlarını ve Message ID’yi SAYMAZ: toplam = 8 + Length', () => {
    const payload = [0xde, 0xad, 0xbe, 0xef];
    const data = Uint8Array.from([
      ...header({
        serviceId: 0x1234,
        methodId: 0x0421,
        length: 12,
        clientId: 0x0001,
        sessionId: 0x0001,
        messageType: 0x00,
        returnCode: 0x00,
      }),
      ...payload,
    ]);
    expect(data.length).toBe(20);

    const result = parseSomeIp(data);
    expect(result.success).toBe(true);
    expect(result.consumedBytes).toBe(20);

    const frame = frameOf(data);
    const lengthField = fieldById(frame.fields, 'length');
    expect(lengthField?.rawValue).toBe(12);
    // Fiziksel değer TOPLAM mesaj boyudur, ham sayı değil.
    expect(lengthField?.physicalValue).toBe(20);
    expect(lengthField?.unit).toBe('B');

    const payloadField = fieldById(frame.fields, 'payload');
    expect(payloadField?.offset).toBe(16);
    expect(payloadField?.length).toBe(4);
    expect(Array.from(payloadField?.rawBytes ?? [])).toEqual(payload);
  });

  it('payload’suz mesajda Length tam olarak 8’dir ve payload alanı BASILMAZ', () => {
    const frame = frameOf(REQUEST_NO_PAYLOAD);
    expect(fieldById(frame.fields, 'length')?.rawValue).toBe(8);
    expect(fieldById(frame.fields, 'payload')).toBeUndefined();
    expect(frame.valid).toBe(true);
  });

  it('TCP yapışmasında yalnız İLK mesajı tüketir, consumedBytes mesaj sınırıdır', () => {
    const second = Uint8Array.from(
      header({
        serviceId: 0x5678,
        methodId: 0x0001,
        length: 8,
        clientId: 0x0001,
        sessionId: 0x0003,
        messageType: 0x00,
        returnCode: 0x00,
      }),
    );
    const glued = Uint8Array.from([...REQUEST_NO_PAYLOAD, ...second]);

    const result = parseSomeIp(glued);
    expect(result.success).toBe(true);
    // Segment BİRLEŞTİRİLMEZ; akış katmanı buffer’ı bu kadar ilerletir.
    expect(result.consumedBytes).toBe(16);
    if (result.success) {
      expect(fieldById(result.frame.fields, 'session-id')?.rawValue).toBe(0x0002);
      expect(result.frame.warnings.map((warning) => warning.code)).toContain(
        'protocol.someip.warning.trailingBytes',
      );
    }
  });

  it('eksik veri consumedBytes:0 + recoverable:true verir (segment birleştirilmez)', () => {
    const partial = Uint8Array.from([
      ...header({
        serviceId: 0x1234,
        methodId: 0x0421,
        length: 12,
        clientId: 0x0001,
        sessionId: 0x0004,
        messageType: 0x00,
        returnCode: 0x00,
      }),
      0xde,
      0xad,
    ]);

    const result = parseSomeIp(partial);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('truncated-frame');
      expect(result.consumedBytes).toBe(0);
      expect(result.recoverable).toBe(true);
      expect(result.error.details).toMatchObject({ expectedTotal: 20, available: 18 });
    }
  });

  it('16 bayttan kısa girdi Length okunamadığı için truncated-frame + recoverable verir', () => {
    const result = parseSomeIp(REQUEST_NO_PAYLOAD.slice(0, 10));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('truncated-frame');
      expect(result.consumedBytes).toBe(0);
      expect(result.recoverable).toBe(true);
    }
  });

  it('Length < 8 yapısal olarak imkânsızdır: kısmi çözüm + value-out-of-range', () => {
    const broken = Uint8Array.from(REQUEST_NO_PAYLOAD);
    broken[7] = 0x03;

    const result = parseSomeIp(broken);
    // ipv4.ts’in IHL<5 emsali: success:true + valid:false, tablo YİNE dolu.
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.frame.valid).toBe(false);
      expect(result.frame.errors[0]?.code).toBe('value-out-of-range');
      expect(fieldById(result.frame.fields, 'service-id')?.rawValue).toBe(0x1234);
      expect(fieldById(result.frame.fields, 'length')?.valid).toBe(false);
    }
  });
});

describe('someIpParser — Message ID ve Request ID bölünmeleri', () => {
  it('Message ID Service|Method, Request ID Client|Session olarak ikiye bölünür', () => {
    const frame = frameOf(REQUEST_NO_PAYLOAD);

    expect(fieldById(frame.fields, 'service-id')).toMatchObject({ offset: 0, length: 2, rawValue: 0x1234 });
    expect(fieldById(frame.fields, 'method-id')).toMatchObject({ offset: 2, length: 2, rawValue: 0x0421 });
    expect(fieldById(frame.fields, 'client-id')).toMatchObject({ offset: 8, length: 2, rawValue: 0x0001 });
    expect(fieldById(frame.fields, 'session-id')).toMatchObject({
      offset: 10,
      length: 2,
      rawValue: 0x0002,
    });
  });

  it('big-endian okunur: 0x1234 baytları ters çevrilmez', () => {
    const frame = frameOf(REQUEST_NO_PAYLOAD);
    expect(Array.from(fieldById(frame.fields, 'service-id')?.rawBytes ?? [])).toEqual([0x12, 0x34]);
    expect(fieldById(frame.fields, 'service-id')?.physicalValue).toBe('0x1234');
  });

  it('Method/Event bölünmesi TAVSİYEDİR: türetilmiş alan kendi uyarısını taşır', () => {
    const method = frameOf(REQUEST_NO_PAYLOAD);
    const methodClass = fieldById(method.fields, 'method-id-class');
    expect(methodClass?.physicalValue).toBe('Method (0x0000–0x7FFF)');
    expect(methodClass?.warnings).toContain('protocol.someip.warning.methodEventSplitRecommended');
    // Ham `method-id` alanı uyarısızdır — tavsiye yalnız türetimi ilgilendirir.
    expect(fieldById(method.fields, 'method-id')?.warnings).toEqual([]);

    const eventBytes = Uint8Array.from(REQUEST_NO_PAYLOAD);
    eventBytes[2] = 0x80;
    eventBytes[3] = 0x01;
    expect(fieldById(frameOf(eventBytes).fields, 'method-id-class')?.physicalValue).toBe(
      'Event (0x8000–0xFFFF)',
    );
  });
});

describe('someIpParser — Message Type tablosu ve türetilen sınıf', () => {
  const cases: ReadonlyArray<readonly [number, string, string]> = [
    [0x00, 'REQUEST', 'Request'],
    [0x01, 'REQUEST_NO_RETURN', 'Fire & Forget Request'],
    [0x02, 'NOTIFICATION', 'Notification / Event'],
    [0x80, 'RESPONSE', 'Response'],
    [0x81, 'ERROR', 'Error'],
    [0x20, 'TP_REQUEST', 'Request'],
    [0x21, 'TP_REQUEST_NO_RETURN', 'Fire & Forget Request'],
    [0x22, 'TP_NOTIFICATION', 'Notification / Event'],
    [0xa0, 'TP_RESPONSE', 'Response'],
    [0xa1, 'TP_ERROR', 'Error'],
  ];

  it.each(cases)(
    'Message Type 0x%s AUTOSAR Tablo 4.4 adını ve türetilmiş sınıfı basar',
    (code, typeName, kind) => {
      // TP tipleri Length’in TP başlığını da kapsamasını ister.
      const isTp = (code & 0x20) !== 0;
      const data = Uint8Array.from([
        ...header({
          serviceId: 0x1234,
          methodId: 0x0421,
          length: isTp ? 12 : 8,
          clientId: 0x0001,
          sessionId: 0x0001,
          messageType: code,
          // ERROR için Return Code 0x00 OLAMAZ (Tablo 4.5).
          returnCode: (code & ~0x20) === 0x81 ? 0x01 : 0x00,
        }),
        ...(isTp ? [0x00, 0x00, 0x00, 0x00] : []),
      ]);

      const frame = frameOf(data);
      expect(fieldById(frame.fields, 'message-type')?.physicalValue).toBe(typeName);
      expect(fieldById(frame.fields, 'message-kind')?.physicalValue).toBe(kind);
      expect(fieldById(frame.fields, 'message-type')?.valid).toBe(true);
    },
  );

  it('tabloda olmayan Message Type ADLANDIRILMAZ, uyarı basar', () => {
    // Scapy/Wireshark 0x40 ACK bitini tanır, AUTOSAR R23-11 Tablo 4.4 TANIMAZ —
    // iki kaynak örtüşmediği için ADLANDIRILMADI (brief kuralı).
    const acked = Uint8Array.from(REQUEST_NO_PAYLOAD);
    acked[14] = 0x40;

    const frame = frameOf(acked);
    const messageType = fieldById(frame.fields, 'message-type');
    expect(messageType?.physicalValue).toBeUndefined();
    expect(messageType?.valid).toBe(false);
    expect(messageType?.warnings).toContain('protocol.someip.warning.unknownMessageType');
    expect(fieldById(frame.fields, 'message-kind')?.physicalValue).toBe('Unknown');
  });
});

describe('someIpParser — Return Code tablosu', () => {
  it('AUTOSAR Tablo 4.11’in adlandırılmış kodlarını basar', () => {
    const withCode = (code: number): ParsedField | undefined => {
      const data = Uint8Array.from(REQUEST_NO_PAYLOAD);
      data[14] = 0x80;
      data[15] = code;
      return fieldById(frameOf(data).fields, 'return-code');
    };

    expect(withCode(0x00)?.physicalValue).toBe('E_OK');
    expect(withCode(0x02)?.physicalValue).toBe('E_UNKNOWN_SERVICE');
    expect(withCode(0x0a)?.physicalValue).toBe('E_WRONG_MESSAGE_TYPE');
    // 0x0b-0x0f E2E kodları YALNIZ AUTOSAR’da var (Scapy/Wireshark tanımıyor).
    expect(withCode(0x0e)?.physicalValue).toBe('E_E2E_NOT_AVAILABLE');
  });

  it('ayrılmış aralıkları "bilinmeyen" DEĞİL "ayrılmış" olarak işaretler', () => {
    const data = Uint8Array.from(REQUEST_NO_PAYLOAD);
    data[14] = 0x80;
    data[15] = 0x25;
    const field = fieldById(frameOf(data).fields, 'return-code');
    expect(field?.physicalValue).toBe('RESERVED (service specific)');
    expect(field?.warnings).toContain('protocol.someip.warning.reservedReturnCode');
    expect(field?.valid).toBe(true);
  });

  it('tablo dışı kodu geçersiz sayar', () => {
    const data = Uint8Array.from(REQUEST_NO_PAYLOAD);
    data[14] = 0x80;
    data[15] = 0x7f;
    const field = fieldById(frameOf(data).fields, 'return-code');
    expect(field?.valid).toBe(false);
    expect(field?.warnings).toContain('protocol.someip.warning.unknownReturnCode');
  });

  it('Tablo 4.5 tutarlılığı: REQUEST’in Return Code’u E_OK olmalı', () => {
    const data = Uint8Array.from(REQUEST_NO_PAYLOAD);
    data[15] = 0x01;
    expect(fieldById(frameOf(data).fields, 'return-code')?.warnings).toContain(
      'protocol.someip.warning.returnCodeShouldBeEOk',
    );
  });

  it('Tablo 4.5 tutarlılığı: ERROR’un Return Code’u E_OK OLAMAZ', () => {
    const data = Uint8Array.from(REQUEST_NO_PAYLOAD);
    data[14] = 0x81;
    data[15] = 0x00;
    expect(fieldById(frameOf(data).fields, 'return-code')?.warnings).toContain(
      'protocol.someip.warning.errorReturnCodeIsEOk',
    );
  });
});

describe('someIpParser — Protocol Version', () => {
  it('PRS_SOMEIP_00051 ihlali alanı geçersiz yapar ve uyarı basar', () => {
    const data = Uint8Array.from(REQUEST_NO_PAYLOAD);
    data[12] = 0x02;
    const frame = frameOf(data);
    expect(fieldById(frame.fields, 'protocol-version')?.valid).toBe(false);
    expect(frame.warnings.map((warning) => warning.code)).toContain(
      'protocol.someip.warning.unexpectedProtocolVersion',
    );
    // Uyarıdır, hata DEĞİL: çerçeve yine çözülür.
    expect(frame.errors).toEqual([]);
  });
});

describe('someIpParser — SOME/IP-TP başlığı', () => {
  it('TP bayrağı 0x20 ise 4 baytlık TP başlığı çözülür, payload 20’den başlar', () => {
    const data = exampleBytes('tp-segment');
    const frame = frameOf(data);

    const tpOffset = fieldById(frame.fields, 'tp-offset');
    expect(tpOffset).toMatchObject({ offset: 16, length: 4, rawValue: 1, unit: 'B' });
    // PRS_SOMEIP_00724: taşınan değer 16 baytın katı — gerçek ofset ×16.
    expect(tpOffset?.physicalValue).toBe(16);

    expect(fieldById(frame.fields, 'tp-reserved')?.rawValue).toBe(0);
    expect(fieldById(frame.fields, 'tp-more-segments')).toMatchObject({
      rawValue: 1,
      physicalValue: 'More segments follow',
    });

    const payload = fieldById(frame.fields, 'payload');
    expect(payload?.offset).toBe(20);
    expect(payload?.length).toBe(4);
  });

  it('TP bayrağı yokken TP alanları BASILMAZ', () => {
    const frame = frameOf(REQUEST_NO_PAYLOAD);
    expect(fieldById(frame.fields, 'tp-offset')).toBeUndefined();
    expect(fieldById(frame.fields, 'tp-more-segments')).toBeUndefined();
  });

  it('TP bayrağı var ama Length TP başlığını kapsamıyorsa length-mismatch verir', () => {
    const data = Uint8Array.from(REQUEST_NO_PAYLOAD);
    data[14] = 0x20;
    const result = parseSomeIp(data);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.frame.valid).toBe(false);
      expect(result.frame.errors[0]?.code).toBe('length-mismatch');
      expect(fieldById(result.frame.fields, 'tp-offset')).toBeUndefined();
    }
  });
});

describe('someIpParser — payload HAM kalır', () => {
  it('payload alan kırılımı ÜRETMEZ, yalnız ham bayt + uyarı verir', () => {
    const frame = frameOf(exampleBytes('request'));
    const payload = fieldById(frame.fields, 'payload');

    expect(payload?.rawValue).toBeUndefined();
    expect(payload?.physicalValue).toBeUndefined();
    expect(payload?.warnings).toContain('protocol.someip.warning.payloadNeedsServiceDefinition');
    expect(frame.warnings.map((warning) => warning.code)).toContain(
      'protocol.someip.warning.payloadNeedsServiceDefinition',
    );
  });

  it('payload’dan türetilmiş hiçbir alt alan basılmaz', () => {
    const frame = frameOf(exampleBytes('request'));
    const payloadFields = frame.fields.filter((field) => field.offset >= 16);
    expect(payloadFields.map((field) => field.id)).toEqual(['payload']);
  });
});

describe('someIpParser — metadata (korelasyonun hammaddesi)', () => {
  it('Client/Session/Service/Method kimliğini RawFrame.metadata’ya yazar', () => {
    const frame = frameOf(REQUEST_NO_PAYLOAD);
    const metadata = frame.rawFrame.metadata as SomeIpFrameMetadata;

    expect(metadata.serviceId).toBe(0x1234);
    expect(metadata.methodId).toBe(0x0421);
    expect(metadata.clientId).toBe(0x0001);
    expect(metadata.sessionId).toBe(0x0002);
    expect(metadata.messageType).toBe(0x00);
    expect(metadata.serviceDiscovery).toBe(false);
    expect(metadata.tpSegment).toBe(false);
    expect(metadata.summaryKey).toBe('protocol.someip.summary.request');
  });

  it('SD mesajında serviceDiscovery bayrağını yazar', () => {
    const frame = frameOf(exampleBytes('sd-offer-service'));
    const metadata = frame.rawFrame.metadata as SomeIpFrameMetadata;
    expect(metadata.serviceDiscovery).toBe(true);
    expect(metadata.summaryKey).toBe('protocol.someip.summary.serviceDiscovery');
  });
});

describe('someIpParser — iptal ve azami uzunluk', () => {
  it('iptal edilmiş signal parser-timeout verir, exception atmaz', () => {
    const controller = new AbortController();
    controller.abort();
    const result = someIpParser.parse(REQUEST_NO_PAYLOAD, { signal: controller.signal });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe('parser-timeout');
  });

  it('maxFrameLength aşılınca frame-too-long verir', () => {
    const result = someIpParser.parse(REQUEST_NO_PAYLOAD, { maxFrameLength: 8 });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('frame-too-long');
      expect(result.recoverable).toBe(false);
    }
  });
});

describe('someIpPlugin', () => {
  it('decodeOptions AÇMAZ — bir eksiklik değil, karar (dosya başı gerekçesi)', () => {
    expect(someIpPlugin.decodeOptions).toBeUndefined();
  });

  it('her örnek çerçeve expectedValid ile tutarlı çözülür', () => {
    for (const example of someIpPlugin.exampleFrames) {
      const result = someIpParser.parse(example.bytes);
      const actuallyValid = result.success && result.frame.valid;
      expect(actuallyValid, `${example.id}`).toBe(example.expectedValid ?? true);
    }
  });

  it('kaynak listesi AUTOSAR birincil + iki bağımsız açık kaynak taşır', () => {
    const titles = someIpPlugin.documentation?.references?.map((reference) => reference.title) ?? [];
    expect(titles.some((title) => title.includes('AUTOSAR'))).toBe(true);
    expect(titles.some((title) => title.includes('Wireshark'))).toBe(true);
    expect(titles.some((title) => title.includes('Scapy'))).toBe(true);
  });
});
