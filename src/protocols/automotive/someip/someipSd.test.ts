import { describe, expect, it } from 'vitest';

import { parseSomeIp, someIpPlugin } from './someip';
import { SOMEIP_SD_MESSAGE_ID } from './someipSd';
import type { ParsedField, ParsedFrame } from '@/protocol-core/types';

function fieldById(fields: ParsedField[], id: string): ParsedField | undefined {
  return fields.find((field) => field.id === id);
}

function fieldByName(fields: ParsedField[], name: string): ParsedField | undefined {
  return fields.find((field) => field.name === name);
}

function frameOf(data: Uint8Array): ParsedFrame {
  const result = parseSomeIp(data);
  if (!result.success) throw new Error('beklenen başarılı çözüm');
  return result.frame;
}

function warningCodes(frame: ParsedFrame): string[] {
  return frame.warnings.map((warning) => warning.code);
}

function uint32(value: number): number[] {
  return [(value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff];
}

function uint16(value: number): number[] {
  return [(value >> 8) & 0xff, value & 0xff];
}

/**
 * SD mesajı kurar. `Length` BURADA hesaplanır (8 + payload) — üretim kodunun
 * formülüyle aynı ama BAĞIMSIZ yazılmış; ikisi kayarsa test kırılır.
 */
function sdMessage(options: {
  flags?: number;
  entries?: number[];
  options?: number[];
  messageType?: number;
  sessionId?: number;
}): Uint8Array {
  const entries = options.entries ?? [];
  const optionBytes = options.options ?? [];
  const payload = [
    options.flags ?? 0x00,
    0x00,
    0x00,
    0x00,
    ...uint32(entries.length),
    ...entries,
    ...uint32(optionBytes.length),
    ...optionBytes,
  ];
  return Uint8Array.from([
    0xff,
    0xff,
    0x81,
    0x00,
    ...uint32(8 + payload.length),
    0x00,
    0x00,
    ...uint16(options.sessionId ?? 0x0001),
    0x01,
    0x01,
    options.messageType ?? 0x02,
    0x00,
    ...payload,
  ]);
}

function serviceEntry(options: {
  type: number;
  indexFirst?: number;
  indexSecond?: number;
  numOptions1?: number;
  numOptions2?: number;
  serviceId: number;
  instanceId: number;
  majorVersion: number;
  ttl: number;
  minorVersion: number;
}): number[] {
  return [
    options.type,
    options.indexFirst ?? 0,
    options.indexSecond ?? 0,
    ((options.numOptions1 ?? 0) << 4) | (options.numOptions2 ?? 0),
    ...uint16(options.serviceId),
    ...uint16(options.instanceId),
    options.majorVersion,
    (options.ttl >> 16) & 0xff,
    (options.ttl >> 8) & 0xff,
    options.ttl & 0xff,
    ...uint32(options.minorVersion),
  ];
}

function eventgroupEntry(options: {
  type: number;
  serviceId: number;
  instanceId: number;
  majorVersion: number;
  ttl: number;
  counter: number;
  eventgroupId: number;
}): number[] {
  return [
    options.type,
    0,
    0,
    0x10,
    ...uint16(options.serviceId),
    ...uint16(options.instanceId),
    options.majorVersion,
    (options.ttl >> 16) & 0xff,
    (options.ttl >> 8) & 0xff,
    options.ttl & 0xff,
    0x00,
    options.counter & 0x0f,
    ...uint16(options.eventgroupId),
  ];
}

/** IPv4 Endpoint/Multicast/SD-Endpoint: Length 0x0009 → TOPLAM 12 bayt. */
function ipv4Option(type: number, address: number[], protocol: number, port: number): number[] {
  return [...uint16(0x0009), type, 0x00, ...address, 0x00, protocol, ...uint16(port)];
}

/** IPv6 karşılığı: Length 0x0015 → TOPLAM 24 bayt. */
function ipv6Option(type: number, address: number[], protocol: number, port: number): number[] {
  return [...uint16(0x0015), type, 0x00, ...address, 0x00, protocol, ...uint16(port)];
}

function loadBalancingOption(priority: number, weight: number): number[] {
  return [...uint16(0x0005), 0x02, 0x00, ...uint16(priority), ...uint16(weight)];
}

function configurationOption(entries: readonly string[]): number[] {
  const body: number[] = [];
  for (const entry of entries) {
    body.push(entry.length, ...Array.from(entry, (character) => character.charCodeAt(0)));
  }
  body.push(0x00);
  // PRS_SOMEIPSD_00276: Length, 2 baytlık Length ile 1 baytlık Type'ı SAYMAZ.
  return [...uint16(1 + body.length), 0x01, 0x00, ...body];
}

const IPV4_ENDPOINT = 0x04;
const IPV6_ENDPOINT = 0x06;
const OFFER_SERVICE = 0x01;
const FIND_SERVICE = 0x00;
const SUBSCRIBE_EVENTGROUP = 0x06;

describe('SOME/IP-SD ayrımı — çerçeveden çıkar, decodeOptions gerekmez', () => {
  it('ayrım kriteri üç kaynakta da aynı sayıdır: 0xFFFF8100', () => {
    expect(SOMEIP_SD_MESSAGE_ID).toBe(0xffff8100);
  });

  it('Message ID 0xFFFF8100 olan mesaj SD olarak çözülür, payload HAM KALMAZ', () => {
    const frame = frameOf(
      sdMessage({
        entries: serviceEntry({
          type: OFFER_SERVICE,
          serviceId: 0x1234,
          instanceId: 0x0001,
          majorVersion: 1,
          ttl: 3,
          minorVersion: 0,
        }),
      }),
    );

    expect(fieldById(frame.fields, 'payload')).toBeUndefined();
    expect(fieldByName(frame.fields, 'SD Flags')).toBeDefined();
    expect(fieldByName(frame.fields, 'SD Entry 1 Service ID')?.rawValue).toBe(0x1234);
  });

  it('Message ID başka bir değerse SD çözümü YAPILMAZ, payload ham kalır', () => {
    const nonSd = Uint8Array.from(
      sdMessage({
        entries: serviceEntry({
          type: OFFER_SERVICE,
          serviceId: 0x1234,
          instanceId: 0x0001,
          majorVersion: 1,
          ttl: 3,
          minorVersion: 0,
        }),
      }),
    );
    // Yalnız Method ID değişti: 0x8100 → 0x8101.
    nonSd[3] = 0x01;

    const frame = frameOf(nonSd);
    expect(fieldById(frame.fields, 'payload')).toBeDefined();
    expect(fieldByName(frame.fields, 'SD Flags')).toBeUndefined();
    expect(warningCodes(frame)).toContain('protocol.someip.warning.payloadNeedsServiceDefinition');
  });

  it('TP segmenti hâlindeki SD mesajı ÇÖZÜLMEZ (SD yalnız UDP taşınır)', () => {
    const data = sdMessage({
      entries: serviceEntry({
        type: OFFER_SERVICE,
        serviceId: 0x1234,
        instanceId: 0x0001,
        majorVersion: 1,
        ttl: 3,
        minorVersion: 0,
      }),
      messageType: 0x22,
    });

    const frame = frameOf(data);
    expect(fieldByName(frame.fields, 'SD Flags')).toBeUndefined();
    expect(fieldById(frame.fields, 'payload')).toBeDefined();
    expect(warningCodes(frame)).toContain('protocol.someip.warning.serviceDiscoveryTpSegment');
  });
});

describe('SOME/IP-SD başlığı', () => {
  it('Flags baytını hem toplu hem tek tek çözer', () => {
    const frame = frameOf(sdMessage({ flags: 0xc0 }));

    expect(fieldByName(frame.fields, 'SD Flags')).toMatchObject({
      offset: 16,
      length: 1,
      rawValue: 0xc0,
      physicalValue: 'Reboot | Unicast',
    });
    expect(fieldByName(frame.fields, 'SD Reboot Flag')?.rawValue).toBe(1);
    expect(fieldByName(frame.fields, 'SD Unicast Flag')?.rawValue).toBe(1);
    expect(fieldByName(frame.fields, 'SD Explicit Initial Data Control Flag')?.rawValue).toBe(0);
  });

  it('Reboot bayrağının anlamı Wireshark sd_reboot_flag ile aynı yöndedir', () => {
    expect(fieldByName(frameOf(sdMessage({ flags: 0x80 })).fields, 'SD Reboot Flag')?.physicalValue).toBe(
      'Session ID did not roll over since last reboot',
    );
    expect(fieldByName(frameOf(sdMessage({ flags: 0x00 })).fields, 'SD Reboot Flag')?.physicalValue).toBe(
      'Session ID rolled over since last reboot',
    );
  });

  it('Reserved 24 bit ve dizi uzunlukları doğru ofsetlerde durur', () => {
    const frame = frameOf(sdMessage({ flags: 0x20 }));
    expect(fieldByName(frame.fields, 'SD Reserved')).toMatchObject({ offset: 17, length: 3 });
    expect(fieldByName(frame.fields, 'SD Entries Array Length')).toMatchObject({
      offset: 20,
      length: 4,
      rawValue: 0,
      unit: 'B',
    });
    expect(fieldByName(frame.fields, 'SD Options Array Length')).toMatchObject({
      offset: 24,
      length: 4,
      rawValue: 0,
    });
  });

  it('12 bayttan kısa SD payload’u truncated-frame verir', () => {
    const short = Uint8Array.from([
      0xff, 0xff, 0x81, 0x00, ...uint32(8 + 6), 0x00, 0x00, 0x00, 0x01, 0x01, 0x01, 0x02, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    ]);
    const result = parseSomeIp(short);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.frame.valid).toBe(false);
      expect(result.frame.errors[0]?.code).toBe('truncated-frame');
    }
  });
});

describe('SOME/IP-SD girdileri — ağaç YOK, alan ADLARINA taşındı', () => {
  it('girdi alanları "SD Entry N …" olarak adlandırılır ve düz tabloda durur', () => {
    const frame = frameOf(
      sdMessage({
        entries: [
          ...serviceEntry({
            type: OFFER_SERVICE,
            numOptions1: 1,
            serviceId: 0x1234,
            instanceId: 0x0001,
            majorVersion: 1,
            ttl: 3,
            minorVersion: 7,
          }),
          ...serviceEntry({
            type: FIND_SERVICE,
            serviceId: 0x5678,
            instanceId: 0xffff,
            majorVersion: 0xff,
            ttl: 10,
            minorVersion: 0xffffffff,
          }),
        ],
      }),
    );

    expect(fieldByName(frame.fields, 'SD Entry 1 Type')?.physicalValue).toBe('Offer Service');
    expect(fieldByName(frame.fields, 'SD Entry 1 Number of Options 1')?.rawValue).toBe(1);
    expect(fieldByName(frame.fields, 'SD Entry 1 Minor Version')?.rawValue).toBe(7);

    expect(fieldByName(frame.fields, 'SD Entry 2 Type')?.physicalValue).toBe('Find Service');
    expect(fieldByName(frame.fields, 'SD Entry 2 Instance ID')?.physicalValue).toBe('ANY (0xFFFF)');
    expect(fieldByName(frame.fields, 'SD Entry 2 Major Version')?.physicalValue).toBe('ANY (0xFF)');
    expect(fieldByName(frame.fields, 'SD Entry 2 Minor Version')?.physicalValue).toBe(
      'ANY (0xFFFFFFFF)',
    );
  });

  it('alan id’leri KENDİ offset’lerini taşır, girdinin base offset’ini değil', () => {
    const frame = frameOf(
      sdMessage({
        entries: [
          ...serviceEntry({
            type: OFFER_SERVICE,
            serviceId: 0x1234,
            instanceId: 0x0001,
            majorVersion: 1,
            ttl: 3,
            minorVersion: 0,
          }),
          ...serviceEntry({
            type: OFFER_SERVICE,
            serviceId: 0x5678,
            instanceId: 0x0002,
            majorVersion: 1,
            ttl: 3,
            minorVersion: 0,
          }),
        ],
      }),
    );

    // SD payload 16'da başlar; girdiler 16+8=24'ten, ikincisi 40'tan.
    expect(fieldById(frame.fields, 'sd-entry-service-id-28')?.rawValue).toBe(0x1234);
    expect(fieldById(frame.fields, 'sd-entry-service-id-44')?.rawValue).toBe(0x5678);
    // Aynı id İKİ KEZ üretilmemeli — offset ekinin varlık sebebi bu.
    const ids = frame.fields.map((field) => field.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('AYNI tip kodu TTL’e göre FARKLI ada çözülür (0x01 Offer / Stop Offer)', () => {
    const offer = frameOf(
      sdMessage({
        entries: serviceEntry({
          type: OFFER_SERVICE,
          serviceId: 0x1234,
          instanceId: 0x0001,
          majorVersion: 1,
          ttl: 3,
          minorVersion: 0,
        }),
      }),
    );
    expect(fieldByName(offer.fields, 'SD Entry 1 Type')?.physicalValue).toBe('Offer Service');

    const stopOffer = frameOf(
      sdMessage({
        entries: serviceEntry({
          type: OFFER_SERVICE,
          serviceId: 0x1234,
          instanceId: 0x0001,
          majorVersion: 1,
          ttl: 0,
          minorVersion: 0,
        }),
      }),
    );
    expect(fieldByName(stopOffer.fields, 'SD Entry 1 Type')?.physicalValue).toBe(
      'Stop Offer Service',
    );
  });

  it('TTL saniyedir; 0xFFFFFF sonsuz demektir ve birim VERİLMEZ', () => {
    const finite = frameOf(
      sdMessage({
        entries: serviceEntry({
          type: OFFER_SERVICE,
          serviceId: 0x1234,
          instanceId: 0x0001,
          majorVersion: 1,
          ttl: 3,
          minorVersion: 0,
        }),
      }),
    );
    expect(fieldByName(finite.fields, 'SD Entry 1 TTL')).toMatchObject({ rawValue: 3, unit: 's' });

    const infinite = frameOf(
      sdMessage({
        entries: serviceEntry({
          type: OFFER_SERVICE,
          serviceId: 0x1234,
          instanceId: 0x0001,
          majorVersion: 1,
          ttl: 0xffffff,
          minorVersion: 0,
        }),
      }),
    );
    const ttlField = fieldByName(infinite.fields, 'SD Entry 1 TTL');
    expect(ttlField?.physicalValue).toBe('infinite (0xFFFFFF)');
    // Biçimlenmiş değere `unit` YAPIŞTIRILMAZ (devralınan tuzak).
    expect(ttlField?.unit).toBeUndefined();
  });

  it('Eventgroup girdisi Minor Version YERİNE Reserved/Counter/Eventgroup ID basar', () => {
    const frame = frameOf(
      sdMessage({
        entries: eventgroupEntry({
          type: SUBSCRIBE_EVENTGROUP,
          serviceId: 0x1234,
          instanceId: 0x0001,
          majorVersion: 1,
          ttl: 5,
          counter: 0x3,
          eventgroupId: 0x0002,
        }),
      }),
    );

    expect(fieldByName(frame.fields, 'SD Entry 1 Type')?.physicalValue).toBe('Subscribe Eventgroup');
    expect(fieldByName(frame.fields, 'SD Entry 1 Minor Version')).toBeUndefined();
    // Wireshark 0x80'i "Initial Event Request" sayıyor, AUTOSAR "Reserved[12]"
    // diyor — örtüşmediği için 12 bit TOPLUCA gösterilir.
    expect(fieldByName(frame.fields, 'SD Entry 1 Reserved (12 bit)')).toMatchObject({
      length: 2,
      rawValue: 0,
    });
    expect(fieldByName(frame.fields, 'SD Entry 1 Counter')?.rawValue).toBe(0x3);
    expect(fieldByName(frame.fields, 'SD Entry 1 Eventgroup ID')?.rawValue).toBe(0x0002);
  });

  it('tanınmayan girdi tipinde son 4 bayt HAM kalır, uydurulmaz', () => {
    const frame = frameOf(
      sdMessage({
        entries: serviceEntry({
          type: 0x33,
          serviceId: 0x1234,
          instanceId: 0x0001,
          majorVersion: 1,
          ttl: 3,
          minorVersion: 0x11223344,
        }),
      }),
    );

    const typeField = fieldByName(frame.fields, 'SD Entry 1 Type');
    expect(typeField?.physicalValue).toBeUndefined();
    expect(typeField?.valid).toBe(false);
    const raw = fieldByName(frame.fields, 'SD Entry 1 Type-specific Data (raw)');
    expect(raw?.rawValue).toBeUndefined();
    expect(Array.from(raw?.rawBytes ?? [])).toEqual([0x11, 0x22, 0x33, 0x44]);
    expect(warningCodes(frame)).toContain('protocol.someip.warning.sdUnknownEntryType');
  });

  it('16’nın katı olmayan Entries Array Length uyarı basar, tam girdiler yine çözülür', () => {
    const entry = serviceEntry({
      type: OFFER_SERVICE,
      serviceId: 0x1234,
      instanceId: 0x0001,
      majorVersion: 1,
      ttl: 3,
      minorVersion: 0,
    });
    const frame = frameOf(sdMessage({ entries: [...entry, 0xaa, 0xbb] }));

    expect(warningCodes(frame)).toContain('protocol.someip.warning.sdEntriesLengthNotMultiple');
    expect(fieldByName(frame.fields, 'SD Entry 1 Service ID')?.rawValue).toBe(0x1234);
    expect(fieldByName(frame.fields, 'SD Entry 2 Type')).toBeUndefined();
  });

  it('Entries Array Length tamponu aşarsa length-mismatch verir, girdi çözülmez', () => {
    const data = sdMessage({
      entries: serviceEntry({
        type: OFFER_SERVICE,
        serviceId: 0x1234,
        instanceId: 0x0001,
        majorVersion: 1,
        ttl: 3,
        minorVersion: 0,
      }),
    });
    // Entries Array Length alanı SD payload'ının 4. baytında (mutlak 20).
    data[23] = 0x60;

    const result = parseSomeIp(data);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.frame.valid).toBe(false);
      expect(result.frame.errors[0]?.code).toBe('length-mismatch');
      expect(fieldByName(result.frame.fields, 'SD Entry 1 Type')).toBeUndefined();
    }
  });
});

describe('SOME/IP-SD opsiyonları — Length TABANI (+3)', () => {
  /**
   * SD'nin ikinci uzunluk tabanı: PRS_SOMEIPSD_00276 "excluding the 16 bit
   * length field and the 8 bit type flag" + Wireshark `real_length = … + 3`.
   * Entries/Options Array Length'ten FARKLI; karıştırmak opsiyon başına 3 bayt
   * kaydırır.
   */
  it('IPv4 Endpoint: Length 0x0009 bildirilir, TOPLAM 12 bayt tüketilir', () => {
    const frame = frameOf(
      sdMessage({
        options: ipv4Option(IPV4_ENDPOINT, [192, 168, 1, 10], 0x11, 30509),
      }),
    );

    const lengthField = fieldByName(frame.fields, 'SD Option 1 Length (excludes Length + Type bytes)');
    expect(lengthField?.rawValue).toBe(9);
    expect(lengthField?.physicalValue).toBe(12);
    expect(lengthField?.unit).toBe('B');

    expect(fieldByName(frame.fields, 'SD Option 1 Type')?.physicalValue).toBe('IPv4 Endpoint');
    expect(fieldByName(frame.fields, 'SD Option 1 IPv4 Address')?.physicalValue).toBe('192.168.1.10');
    expect(fieldByName(frame.fields, 'SD Option 1 Transport Protocol')?.physicalValue).toBe('UDP');
    expect(fieldByName(frame.fields, 'SD Option 1 Port')?.rawValue).toBe(30509);
  });

  it('ARDIŞIK iki opsiyon 12 bayt arayla başlar — +3 tabanının kanıtı', () => {
    const frame = frameOf(
      sdMessage({
        options: [
          ...ipv4Option(IPV4_ENDPOINT, [10, 0, 0, 1], 0x06, 1000),
          ...ipv4Option(IPV4_ENDPOINT, [10, 0, 0, 2], 0x11, 2000),
        ],
      }),
    );

    // SD payload 16'da; opsiyonlar 16+12=28'de başlar (girdi yok).
    expect(fieldById(frame.fields, 'sd-option-length-28')?.rawValue).toBe(9);
    expect(fieldById(frame.fields, 'sd-option-length-40')?.rawValue).toBe(9);
    expect(fieldByName(frame.fields, 'SD Option 1 IPv4 Address')?.physicalValue).toBe('10.0.0.1');
    expect(fieldByName(frame.fields, 'SD Option 1 Transport Protocol')?.physicalValue).toBe('TCP');
    expect(fieldByName(frame.fields, 'SD Option 2 IPv4 Address')?.physicalValue).toBe('10.0.0.2');
    expect(fieldByName(frame.fields, 'SD Option 2 Port')?.rawValue).toBe(2000);
    expect(fieldByName(frame.fields, 'SD Option 3 Type')).toBeUndefined();
  });

  it('IPv6 Endpoint: Length 0x0015 → TOPLAM 24 bayt', () => {
    const address = [
      0xfe, 0x80, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x02, 0x11, 0x22, 0xff, 0xfe, 0x33, 0x44,
      0x55,
    ];
    const frame = frameOf(sdMessage({ options: ipv6Option(IPV6_ENDPOINT, address, 0x06, 443) }));

    expect(fieldByName(frame.fields, 'SD Option 1 Type')?.physicalValue).toBe('IPv6 Endpoint');
    expect(fieldByName(frame.fields, 'SD Option 1 IPv6 Address')?.physicalValue).toBe(
      'fe80:0000:0000:0000:0211:22ff:fe33:4455',
    );
    expect(fieldByName(frame.fields, 'SD Option 1 Transport Protocol')?.physicalValue).toBe('TCP');
    expect(fieldByName(frame.fields, 'SD Option 1 Port')?.rawValue).toBe(443);
  });

  it('Load Balancing: Priority ve Weight çözülür', () => {
    const frame = frameOf(sdMessage({ options: loadBalancingOption(2, 500) }));
    expect(fieldByName(frame.fields, 'SD Option 1 Type')?.physicalValue).toBe('Load Balancing');
    expect(fieldByName(frame.fields, 'SD Option 1 Priority')?.rawValue).toBe(2);
    expect(fieldByName(frame.fields, 'SD Option 1 Weight')?.rawValue).toBe(500);
  });

  it('Configuration: DNS-SD biçimli uzunluk önekli dizeler çözülür', () => {
    const frame = frameOf(sdMessage({ options: configurationOption(['abc=x', 'k=1']) }));

    expect(fieldByName(frame.fields, 'SD Option 1 Type')?.physicalValue).toBe('Configuration');
    expect(fieldByName(frame.fields, 'SD Option 1 Configuration String 1')?.physicalValue).toBe(
      'abc=x',
    );
    expect(fieldByName(frame.fields, 'SD Option 1 Configuration String 2')?.physicalValue).toBe('k=1');
    expect(fieldByName(frame.fields, 'SD Option 1 Configuration String Terminator')).toBeDefined();
  });

  it('Discardable bayrağı ve 7 bitlik reserved ayrı alanlardır', () => {
    const option = ipv4Option(IPV4_ENDPOINT, [10, 0, 0, 1], 0x11, 1);
    option[3] = 0x80;
    const frame = frameOf(sdMessage({ options: option }));

    expect(fieldByName(frame.fields, 'SD Option 1 Discardable Flag')).toMatchObject({
      rawValue: 1,
      physicalValue: 'Discardable',
    });
    expect(fieldByName(frame.fields, 'SD Option 1 Reserved (7 bit)')?.rawValue).toBe(0);
  });

  it('tanınmayan L4 protokolü ADLANDIRILMAZ, uyarı basar', () => {
    const frame = frameOf(sdMessage({ options: ipv4Option(IPV4_ENDPOINT, [10, 0, 0, 1], 0x84, 1) }));
    const protocolField = fieldByName(frame.fields, 'SD Option 1 Transport Protocol');
    expect(protocolField?.physicalValue).toBeUndefined();
    expect(protocolField?.valid).toBe(false);
    expect(warningCodes(frame)).toContain('protocol.someip.warning.sdUnknownL4Protocol');
  });

  it('tanınmayan opsiyon tipinin gövdesi HAM kalır', () => {
    const frame = frameOf(
      sdMessage({ options: [...uint16(0x0005), 0x7a, 0x00, 0x01, 0x02, 0x03, 0x04] }),
    );

    expect(fieldByName(frame.fields, 'SD Option 1 Type')?.valid).toBe(false);
    const raw = fieldByName(frame.fields, 'SD Option 1 Data (raw)');
    expect(Array.from(raw?.rawBytes ?? [])).toEqual([0x01, 0x02, 0x03, 0x04]);
    expect(warningCodes(frame)).toContain('protocol.someip.warning.sdUnknownOptionType');
  });

  it('sabit boylu opsiyon beklenmeyen boy bildirirse alan yerleşimi UYDURULMAZ', () => {
    // IPv4 Endpoint 0x0009 bildirmeli; 0x000b diyorsa yerleşime güvenilmez.
    const frame = frameOf(
      sdMessage({
        options: [...uint16(0x000b), IPV4_ENDPOINT, 0x00, 10, 0, 0, 1, 0, 0x11, 0x00, 0x01, 0, 0],
      }),
    );

    expect(fieldByName(frame.fields, 'SD Option 1 IPv4 Address')).toBeUndefined();
    expect(fieldByName(frame.fields, 'SD Option 1 Data (raw, unexpected length)')).toBeDefined();
    expect(warningCodes(frame)).toContain('protocol.someip.warning.sdOptionLengthMismatch');
  });

  it('Options Array Length tamponu aşarsa length-mismatch verir', () => {
    const data = sdMessage({
      options: ipv4Option(IPV4_ENDPOINT, [10, 0, 0, 1], 0x11, 1),
    });
    // Options Array Length: SD payload'ının 8. baytı (girdi yok) → mutlak 24-27.
    data[27] = 0x40;

    const result = parseSomeIp(data);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.frame.valid).toBe(false);
      expect(result.frame.errors[0]?.code).toBe('length-mismatch');
    }
  });

  it('opsiyon bildirilen boyla dizinin sonunu aşarsa gövde HAM kalır ve döngü durur', () => {
    const frame = frameOf(sdMessage({ options: [...uint16(0x0020), IPV4_ENDPOINT, 0x00, 1, 2] }));
    expect(fieldByName(frame.fields, 'SD Option 1 Data (raw, truncated)')).toBeDefined();
    expect(warningCodes(frame)).toContain('protocol.someip.warning.sdOptionTruncated');
  });
});

describe('SOME/IP-SD — plugin örnekleri', () => {
  it('sd-offer-service örneği bir Offer girdisi + bir IPv4 Endpoint opsiyonu çözer', () => {
    const example = someIpPlugin.exampleFrames.find((entry) => entry.id === 'sd-offer-service');
    const frame = frameOf(example?.bytes ?? new Uint8Array());

    expect(frame.valid).toBe(true);
    expect(fieldByName(frame.fields, 'SD Entry 1 Type')?.physicalValue).toBe('Offer Service');
    expect(fieldByName(frame.fields, 'SD Entry 1 Service ID')?.rawValue).toBe(0x1234);
    expect(fieldByName(frame.fields, 'SD Option 1 IPv4 Address')?.physicalValue).toBe('192.168.1.10');
    expect(fieldByName(frame.fields, 'SD Option 1 Transport Protocol')?.physicalValue).toBe('UDP');
  });

  it('sd-find-service örneği opsiyonsuz bir Find girdisi çözer', () => {
    const example = someIpPlugin.exampleFrames.find((entry) => entry.id === 'sd-find-service');
    const frame = frameOf(example?.bytes ?? new Uint8Array());

    expect(frame.valid).toBe(true);
    expect(fieldByName(frame.fields, 'SD Entry 1 Type')?.physicalValue).toBe('Find Service');
    expect(fieldByName(frame.fields, 'SD Options Array Length')?.rawValue).toBe(0);
    expect(fieldByName(frame.fields, 'SD Option 1 Type')).toBeUndefined();
  });
});
