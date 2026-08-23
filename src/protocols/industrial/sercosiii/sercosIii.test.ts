import { describe, expect, it } from 'vitest';

import {
  ERROR_HEADER_TRUNCATED,
  WARN_CP34_LAYOUT_FROM_CP2,
  WARN_CRC32_NOT_VERIFIED,
  WARN_CYCLE_COUNT_INVALID,
  WARN_CYCLE_COUNT_SINGLE_SOURCE,
  WARN_DETAILED_DEVICE_LIMIT,
  WARN_DEVICE_LIST_TRUNCATED,
  WARN_HOT_PLUG_BITS_SINGLE_SOURCE,
  WARN_PADDING_NOT_ZERO,
  WARN_PHASE_NOT_NAMED,
  WARN_RECOGNIZED_DEVICE_LIST_RAW,
  WARN_SVC_INFO_NEEDS_IDN_DICTIONARY,
  WARN_TELEGRAM_NUMBER_WIDTH_CONFLICT,
  WARN_VERSION_FIELD_BITS_SINGLE_SOURCE,
  parseSercosIii,
  sercosIiiParser,
  sercosIiiPlugin,
} from './sercosIii';
import type {
  ParseFailure,
  ParseResult,
  ParseSuccess,
  ParsedField,
  ParsedFrame,
} from '@/protocol-core/types';

function expectSuccess(result: ParseResult): ParseSuccess {
  if (!result.success) {
    throw new Error(`expected success, got failure ${result.error.code}: ${result.error.message}`);
  }
  return result;
}

function expectFailure(result: ParseResult): ParseFailure {
  if (result.success) throw new Error('expected failure, got success');
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

function exampleBytes(id: string): Uint8Array {
  const example = sercosIiiPlugin.exampleFrames.find((candidate) => candidate.id === id);
  if (example === undefined) throw new Error(`example "${id}" not found`);
  return example.bytes;
}

const BROADCAST_MAC = [0xff, 0xff, 0xff, 0xff, 0xff, 0xff];
const MASTER_MAC = [0x02, 0x00, 0x00, 0x53, 0x33, 0x01];

function uint32(value: number): number[] {
  return [value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff];
}

/** Ethernet başlığı + EtherType 0x88CD + telgraf tipi/faz baytları + CRC32(4) + gövde. */
function frame(
  typeByte: number,
  phaseByte: number,
  crc: number,
  body: readonly number[],
  padTo?: number,
): Uint8Array {
  const bytes = [
    ...BROADCAST_MAC,
    ...MASTER_MAC,
    0x88,
    0xcd,
    typeByte,
    phaseByte,
    ...uint32(crc),
    ...body,
  ];
  if (padTo !== undefined) while (bytes.length < padTo) bytes.push(0x00);
  return Uint8Array.from(bytes);
}

/** Aynı çerçevenin tek VLAN tag'li varyantı (TPID 0x8100 + TCI). */
function vlanFrame(
  typeByte: number,
  phaseByte: number,
  crc: number,
  body: readonly number[],
  padTo?: number,
): Uint8Array {
  const bytes = [
    ...BROADCAST_MAC,
    ...MASTER_MAC,
    0x81,
    0x00,
    0xa0,
    0x64,
    0x88,
    0xcd,
    typeByte,
    phaseByte,
    ...uint32(crc),
    ...body,
  ];
  if (padTo !== undefined) while (bytes.length < padTo) bytes.push(0x00);
  return Uint8Array.from(bytes);
}

describe('parseSercosIii — Ethernet sınırı ve EtherType', () => {
  it('MAC çiftini ve EtherType 0x88CDyi çözer (ethercat.ts/profinet.ts/powerlink.ts ile aynı sözleşme)', () => {
    const { frame: parsed } = expectSuccess(parseSercosIii(exampleBytes('mdt0-cp4-operational')));
    expect(fieldById(parsed, 'destination-mac').rawValue).toBe('FF:FF:FF:FF:FF:FF');
    expect(fieldById(parsed, 'destination-mac').physicalValue).toBe('Broadcast');
    expect(fieldById(parsed, 'source-mac').rawValue).toBe('02:00:00:53:33:01');
    expect(fieldById(parsed, 'ethertype').rawValue).toBe(0x88cd);
    expect(fieldById(parsed, 'ethertype').physicalValue).toBe('Sercos III');
    expect(parsed.valid).toBe(true);
  });

  it('VLAN tagli cercevede ethertype/telgraf baslik alanlari 4 bayt ileride bulunur', () => {
    const { frame: parsed } = expectSuccess(
      parseSercosIii(vlanFrame(0x20, 0x34, 0x1a2b3c4d, [], 24)),
    );
    // 12 (MAC çifti) + 4 (VLAN tag) = 16 → EtherType, 18 → telgraf tipi baytı.
    expect(fieldById(parsed, 'ethertype').offset).toBe(16);
    expect(fieldById(parsed, 'telegram-channel-18').offset).toBe(18);
    expect(fieldById(parsed, 'communication-phase-19').offset).toBe(19);
    expect(fieldById(parsed, 'header-crc32-20').offset).toBe(20);
  });

  it('VLAN tagli cercevede 6 baytlik Sercos baslığı eksikse truncated-frame basar', () => {
    // Yalnız MAC çifti + VLAN tag + EtherType (18 bayt) + 2 fazladan bayt = 20 (üst sınırı geçer ama başlık eksik kalır).
    const bytes = Uint8Array.from([...BROADCAST_MAC, ...MASTER_MAC, 0x81, 0x00, 0xa0, 0x64, 0x88, 0xcd, 0x20, 0x34]);
    const { frame: parsed } = expectSuccess(parseSercosIii(bytes));
    expect(parsed.valid).toBe(false);
    expect(parsed.errors[0]?.code).toBe('truncated-frame');
    expect(parsed.errors[0]?.message).toBe(ERROR_HEADER_TRUNCATED);
    expect(hasField(parsed, 'communication-phase-19')).toBe(false);
  });

  it('EtherType Sercos III değilse gövdeye DOKUNMAZ, kısmi çözüm + hata rozeti basar', () => {
    const bytes = exampleBytes('ethertype-not-sercos');
    const { frame: parsed } = expectSuccess(parseSercosIii(bytes));
    expect(parsed.valid).toBe(false);
    expect(parsed.errors[0]?.code).toBe('start-delimiter-not-found');
    expect(fieldById(parsed, 'ethertype').rawValue).toBe(0x0800);
    expect(hasField(parsed, 'communication-phase-14')).toBe(false);
    expect(fieldById(parsed, 'payload').valid).toBe(false);
  });

  it('Ethernet başlığı tamamlanmıyorsa ParseFailure döner (kısmi çerçeve değil)', () => {
    const failure = expectFailure(parseSercosIii(exampleBytes('frame-too-short')));
    expect(failure.error.code).toBe('truncated-frame');
    expect(failure.recoverable).toBe(true);
  });

  it('canParse yalnız 0x88CD EtherTypeına (VLANlı varyant dahil) evet der', () => {
    expect(sercosIiiParser.canParse(exampleBytes('mdt0-cp4-operational'))).toBe(true);
    expect(sercosIiiParser.canParse(vlanFrame(0x20, 0x34, 0x1a2b3c4d, [], 24))).toBe(true);
    expect(sercosIiiParser.canParse(exampleBytes('ethertype-not-sercos'))).toBe(false);
    expect(sercosIiiParser.canParse(exampleBytes('frame-too-short'))).toBe(false);
  });
});

describe('parseSercosIii — Sercos başlığı: kanal/tip/cycle-valid/numara ve TELGRAF NUMARASI GENİŞLİK ÇAKIŞMASI', () => {
  it('MDT/AT ayrımını ve kanal/cycle-valid bitlerini çözer', () => {
    const { frame: mdt } = expectSuccess(parseSercosIii(exampleBytes('mdt0-cp4-operational')));
    expect(fieldById(mdt, 'telegram-channel-14').physicalValue).toBe('P-Telegram (primary port)');
    expect(fieldById(mdt, 'telegram-kind-14').physicalValue).toBe('MDT (master data telegram)');
    expect(fieldById(mdt, 'cycle-count-valid-14').physicalValue).toBe('Valid');
    expect(fieldById(mdt, 'telegram-number-14').rawValue).toBe(0);

    const { frame: at } = expectSuccess(parseSercosIii(exampleBytes('at0-cp4-operational')));
    expect(fieldById(at, 'telegram-kind-14').physicalValue).toBe('AT (device telegram)');
  });

  it('iki kaynağın ANLAŞMADIĞI bit 2-3ü ayrı bir alanda gösterir, ana numarayı yalnız bit 0-1den okur', () => {
    const { frame: parsed } = expectSuccess(
      parseSercosIii(exampleBytes('telegram-number-extended-bits')),
    );
    // typeByte 0x2e = 0b00101110 → bit0-1=2, bit2-3=3.
    expect(fieldById(parsed, 'telegram-number-14').rawValue).toBe(2);
    const extended = fieldById(parsed, 'telegram-number-extended-14');
    expect(extended.rawValue).toBe(3);
    expect(extended.warnings).toContain(WARN_TELEGRAM_NUMBER_WIDTH_CONFLICT);
    expect(warningCodes(parsed)).toContain(WARN_TELEGRAM_NUMBER_WIDTH_CONFLICT);
  });

  it('faz baytı: Communication Phase + geçiş biti (bit 7)', () => {
    const { frame: parsed } = expectSuccess(parseSercosIii(exampleBytes('mdt0-cp3-phase-switching')));
    expect(fieldById(parsed, 'communication-phase-15').physicalValue).toBe('CP3');
    expect(fieldById(parsed, 'phase-switching-15').physicalValue).toBe('Switching');
  });

  it('CP0-CP4 dışındaki faz adlandırılmaz, gövde TEK PARÇA ham + WARN_PHASE_NOT_NAMED', () => {
    const { frame: parsed } = expectSuccess(parseSercosIii(exampleBytes('unknown-phase')));
    const phase = fieldById(parsed, 'communication-phase-15');
    expect(phase.valid).toBe(false);
    expect(phase.physicalValue).toBe('0x07');
    expect(warningCodes(parsed)).toContain(WARN_PHASE_NOT_NAMED);
    expect(fieldById(parsed, 'payload-20').warnings).toContain(WARN_PHASE_NOT_NAMED);
  });

  it('Cycle Count her zaman tek-kaynak uyarısı taşır; Valid biti sıfırken AYRICA geçersiz uyarır', () => {
    const { frame: valid } = expectSuccess(parseSercosIii(exampleBytes('mdt0-cp4-operational')));
    expect(fieldById(valid, 'cycle-count-15').warnings).toEqual([WARN_CYCLE_COUNT_SINGLE_SOURCE]);

    const { frame: invalid } = expectSuccess(parseSercosIii(exampleBytes('mdt-secondary-channel')));
    expect(fieldById(invalid, 'cycle-count-valid-14').physicalValue).toBe('Invalid');
    expect(fieldById(invalid, 'cycle-count-15').warnings).toEqual([
      WARN_CYCLE_COUNT_SINGLE_SOURCE,
      WARN_CYCLE_COUNT_INVALID,
    ]);
    expect(fieldById(invalid, 'telegram-channel-14').physicalValue).toBe('S-Telegram (secondary port)');
  });

  it('CRC32 GÖSTERİLİR ama ASLA DOĞRULANMAZ: iki farklı (gerçek olmayan) değer de hatasız kabul edilir', () => {
    const { frame: a } = expectSuccess(parseSercosIii(exampleBytes('mdt0-cp4-operational')));
    const { frame: b } = expectSuccess(parseSercosIii(exampleBytes('at0-cp4-operational')));
    expect(fieldById(a, 'header-crc32-16').physicalValue).toBe('0x1A2B3C4D');
    expect(fieldById(b, 'header-crc32-16').physicalValue).toBe('0x4D3C2B1A');
    for (const parsed of [a, b]) {
      expect(fieldById(parsed, 'header-crc32-16').warnings).toContain(WARN_CRC32_NOT_VERIFIED);
      expect(parsed.errors).toEqual([]);
      expect(parsed.valid).toBe(true);
    }
  });
});

describe('parseSercosIii — CP0 gövdesi', () => {
  it('MDT: Communication Version 4 baytlık ham hex, bit adları TEK KAYNAKLI', () => {
    const { frame: parsed } = expectSuccess(
      parseSercosIii(exampleBytes('mdt0-cp0-communication-version')),
    );
    const version = fieldById(parsed, 'cp0-communication-version-20');
    expect(version.rawValue).toBe(0x00300100);
    expect(version.physicalValue).toBe('0x00300100');
    expect(version.warnings).toContain(WARN_VERSION_FIELD_BITS_SINGLE_SOURCE);
  });

  it('AT: sıra sayacından tanınan cihaz sayısını türetir, 511 girdilik liste TEK PARÇA ham', () => {
    const { frame: parsed } = expectSuccess(
      parseSercosIii(exampleBytes('at0-cp0-recognized-devices')),
    );
    expect(fieldById(parsed, 'cp0-sequence-counter-20').physicalValue).toBe('3 recognized device(s)');
    const list = fieldById(parsed, 'cp0-recognized-device-list-22');
    expect(list.warnings).toContain(WARN_RECOGNIZED_DEVICE_LIST_RAW);
    expect(warningCodes(parsed)).toContain(WARN_RECOGNIZED_DEVICE_LIST_RAW);
  });
});

describe('parseSercosIii — CP1/CP2 gövdesi: 128 cihazlık servis kanalı + cihaz kontrol/durum', () => {
  it('MDT: ilk üç servis kanalı girdisini ve C-DEV kontrol kelimesini çözer, 16 cihazdan sonrası ham', () => {
    const { frame: parsed } = expectSuccess(parseSercosIii(exampleBytes('mdt0-cp2-service-channel')));
    expect(fieldById(parsed, 'svc-0-word-20').physicalValue).toBe('MHS=1 · Write · EOT=0 · DBE=IDN');
    expect(fieldById(parsed, 'svc-0-info-22').warnings).toContain(WARN_SVC_INFO_NEEDS_IDN_DICTIONARY);
    expect(fieldById(parsed, 'device-0-word-788').physicalValue).toBe(
      'Ident LED · TopologyHS=0 · Fast forward on both ports · Ring closed · Master valid',
    );
    const svcRemainder = fieldById(parsed, 'svc-region-remainder-116');
    expect(svcRemainder.length).toBe(672);
    expect(svcRemainder.warnings).toContain(WARN_DETAILED_DEVICE_LIMIT);
    const deviceRemainder = fieldById(parsed, 'device-region-remainder-852');
    expect(deviceRemainder.length).toBe(448);
    expect(hasField(parsed, 'device-16-word-852')).toBe(false);
  });

  it('AT: telgraf numarası cihaz grubunu kaydırır (128den başlar), durum kelimelerini çözer', () => {
    const { frame: parsed } = expectSuccess(
      parseSercosIii(exampleBytes('at1-cp2-second-device-group')),
    );
    expect(fieldById(parsed, 'svc-128-word-20').physicalValue).toBe('AHS=1 · Idle · No error · In process');
    expect(fieldById(parsed, 'device-128-word-788').physicalValue).toBe(
      'TopologyHS=0 · Fast forward on both ports · Link on inactive port · Slave valid',
    );
    expect(hasField(parsed, 'svc-0-word-20')).toBe(false);
  });

  it('cihaz listesi 128ü tamamlamıyorsa WARN_DEVICE_LIST_TRUNCATED GERÇEKTEN basılır', () => {
    // CP1, yalnız 2 servis kanalı girdisi (12 bayt); cihaz kontrol bölgesi HİÇ yok.
    const bytes = frame(0x20, 0x01, 0x00000000, [0x0b, 0x00, 0x64, 0x00, 0x00, 0x00, 0x0b, 0x00, 0x65, 0x00, 0x00, 0x00]);
    const { frame: parsed } = expectSuccess(parseSercosIii(bytes));
    expect(warningCodes(parsed)).toContain(WARN_DEVICE_LIST_TRUNCATED);
    expect(fieldById(parsed, 'svc-0-word-20').rawValue).toBe(0x000b);
    expect(fieldById(parsed, 'svc-1-word-26').rawValue).toBe(0x000b);
    expect(hasField(parsed, 'device-0-word-788')).toBe(false);
  });
});

describe('parseSercosIii — CP3/CP4 gövdesi: yalnız Hot-Plug alanı çözülür, gerisi TEK PARÇA ham', () => {
  it('telgraf 0da 8 baytlık Hot-Plug alanını (adres+kelime+bilgi) çözer', () => {
    const { frame: parsed } = expectSuccess(parseSercosIii(exampleBytes('mdt0-cp4-operational')));
    expect(fieldById(parsed, 'hot-plug-address-20').rawValue).toBe(5);
    const word = fieldById(parsed, 'hot-plug-word-22');
    expect(word.physicalValue).toBe('0x0100');
    expect(word.warnings).toContain(WARN_HOT_PLUG_BITS_SINGLE_SOURCE);
    expect(fieldById(parsed, 'hot-plug-info-24').length).toBe(4);
  });

  it('Hot-Plugdan SONRAKİ bölge (servis kanalı/cihaz durumu/bağlantılar) ÇERÇEVEDE YAZMAZ — CP2 pazarlığından gelir', () => {
    const { frame: parsed } = expectSuccess(parseSercosIii(exampleBytes('mdt0-cp4-operational')));
    const cp34 = fieldById(parsed, 'cp34-payload-28');
    expect(cp34.length).toBe(40);
    expect(cp34.warnings).toContain(WARN_CP34_LAYOUT_FROM_CP2);
    expect(warningCodes(parsed)).toContain(WARN_CP34_LAYOUT_FROM_CP2);
  });

  it('telgraf numarası 0 değilse Hot-Plug alanı da basılmaz, gövdenin TAMAMI ham', () => {
    // telegram-number-extended-bits örneği telgraf numarası 2dir.
    const { frame: parsed } = expectSuccess(
      parseSercosIii(exampleBytes('telegram-number-extended-bits')),
    );
    expect(hasField(parsed, 'hot-plug-address-20')).toBe(false);
    const cp34 = fieldById(parsed, 'cp34-payload-20');
    expect(cp34.offset).toBe(20);
    expect(cp34.warnings).toContain(WARN_CP34_LAYOUT_FROM_CP2);
  });
});

describe('parseSercosIii — padding, maxFrameLength ve iptal', () => {
  it('Bildirilen bölgeden sonraki bayt sıfır değilse uyarır', () => {
    const bytes = exampleBytes('mdt0-cp0-communication-version').slice();
    bytes[30] = 0xff; // padding bölgesi [24,60).
    const { frame: parsed } = expectSuccess(parseSercosIii(bytes));
    const padding = fieldById(parsed, 'padding');
    expect(padding.warnings).toContain(WARN_PADDING_NOT_ZERO);
    expect(warningCodes(parsed)).toContain(WARN_PADDING_NOT_ZERO);
  });

  it('maxFrameLength aşılırsa frame-too-long ile durur', () => {
    const failure = expectFailure(
      sercosIiiParser.parse(exampleBytes('mdt0-cp4-operational'), { maxFrameLength: 32 }),
    );
    expect(failure.error.code).toBe('frame-too-long');
  });

  it('iptal edilmiş signalda parser-timeout döner', () => {
    const controller = new AbortController();
    controller.abort();
    const failure = expectFailure(
      sercosIiiParser.parse(exampleBytes('mdt0-cp4-operational'), { signal: controller.signal }),
    );
    expect(failure.error.code).toBe('parser-timeout');
  });
});

describe('sercosIiiPlugin', () => {
  it('katalogdaki kimlik, kategori ve parser bağını taşır; decodeOptions AÇILMADI', () => {
    expect(sercosIiiPlugin.id).toBe('sercos-iii');
    expect(sercosIiiPlugin.category).toBe('industrial-automation');
    expect(sercosIiiPlugin.parser).toBe(sercosIiiParser);
    expect(sercosIiiPlugin.decodeOptions).toBeUndefined();
    expect(sercosIiiPlugin.encoder).toBeUndefined();
  });

  it('her örnek çözülür ve expectedValid ile eşleşir', () => {
    for (const example of sercosIiiPlugin.exampleFrames) {
      const result = sercosIiiParser.parse(example.bytes);
      if (!result.success) {
        expect(example.expectedValid, `example "${example.id}" failed: ${result.error.code}`).toBe(
          false,
        );
        continue;
      }
      expect(result.frame.valid, `example "${example.id}"`).toBe(example.expectedValid ?? true);
    }
  });

  it('her örnek adı/açıklaması protocol.sercosIii.example. önekli çeviri anahtarıdır', () => {
    for (const example of sercosIiiPlugin.exampleFrames) {
      expect(example.name.startsWith('protocol.sercosIii.example.'), example.id).toBe(true);
      expect(example.description?.startsWith('protocol.sercosIii.example.'), example.id).toBe(true);
    }
  });
});
