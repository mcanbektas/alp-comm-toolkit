import { describe, expect, it } from 'vitest';

import { parseSacn, sacnParser, sacnPlugin } from './sacn';
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

function hasField(frame: ParsedFrame, id: string): boolean {
  return frame.fields.some((field) => field.id === id);
}

function warningCodes(frame: ParsedFrame): string[] {
  return frame.warnings.map((warning) => warning.code);
}

// ─────────────────────────── test-local paket kurucusu ─────────────────────
// sacn.ts'in KENDİ `buildDataPacket`ından BAĞIMSIZ yazıldı (import edilemez,
// dosya dışına açılmıyor) — aynı hata ikisinde de olsaydı paylaşılan bir
// kurucu bunu yakalamazdı; bu yüzden ofset/uzunluk aritmetiği burada SIFIRDAN
// türetildi (E1.31-2018 §5.4/§7.1: her katmanın length'i KENDİ Flags&Length
// ofsetinden — kendi 2 baytı DAHİL — çerçeve sonuna kadar sayılır).

const ACN_PACKET_IDENTIFIER = Uint8Array.from([
  0x41, 0x53, 0x43, 0x2d, 0x45, 0x31, 0x2e, 0x31, 0x37, 0x00, 0x00, 0x00,
]);

function concatBytes(...chunks: readonly Uint8Array[]): Uint8Array {
  const length = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const result = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

function u16(value: number): Uint8Array {
  return Uint8Array.from([(value >>> 8) & 0xff, value & 0xff]);
}

function u32(value: number): Uint8Array {
  return Uint8Array.from([(value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff]);
}

function flagsAndLength(flagsNibble: number, length: number): Uint8Array {
  return u16(((flagsNibble & 0x0f) << 12) | (length & 0x0fff));
}

function sourceNameBytes(name: string): Uint8Array {
  const bytes = new Uint8Array(64);
  bytes.set(new TextEncoder().encode(name).subarray(0, 64));
  return bytes;
}

interface TestPacketParams {
  cid?: Uint8Array;
  sourceName?: string;
  priority?: number;
  syncAddress?: number;
  sequenceNumber?: number;
  optionsByte?: number;
  universe?: number;
  propertyValues: Uint8Array;
  rootVectorOverride?: number;
  declaredPropertyValueCountOverride?: number;
  flagsNibbleOverride?: number;
}

function buildTestPacket(params: TestPacketParams): Uint8Array {
  const cid = params.cid ?? new Uint8Array(16).fill(0xab);
  const sourceName = params.sourceName ?? 'Test Console';
  const priority = params.priority ?? 100;
  const syncAddress = params.syncAddress ?? 0;
  const sequenceNumber = params.sequenceNumber ?? 0;
  const optionsByte = params.optionsByte ?? 0x00;
  const universe = params.universe ?? 1;
  const propertyValues = params.propertyValues;
  const declaredCount = params.declaredPropertyValueCountOverride ?? propertyValues.length;
  const flagsNibble = params.flagsNibbleOverride ?? 0x7;
  const rootVector = params.rootVectorOverride ?? 0x00000004; // VECTOR_ROOT_E131_DATA

  // dmpLength/framingLength/rootLength: "kendi ofsetinden çerçeve sonuna
  // kadar, kendi 2 baytı DAHİL" — bkz. dosya başı.
  const dmpLength = 10 + declaredCount; // Flags&Length(2)+Vector(1)+AddrType(1)+FirstPropAddr(2)+AddrIncrement(2)+PropValueCount(2)
  const framingLength = dmpLength + 77; // 115-38
  const rootLength = framingLength + 22; // 38-16

  const root = concatBytes(
    u16(0x0010),
    u16(0x0000),
    ACN_PACKET_IDENTIFIER,
    flagsAndLength(flagsNibble, rootLength),
    u32(rootVector),
    cid,
  );
  const framing = concatBytes(
    flagsAndLength(flagsNibble, framingLength),
    u32(0x00000002), // VECTOR_E131_DATA_PACKET
    sourceNameBytes(sourceName),
    Uint8Array.from([priority & 0xff]),
    u16(syncAddress),
    Uint8Array.from([sequenceNumber & 0xff]),
    Uint8Array.from([optionsByte & 0xff]),
    u16(universe),
  );
  const dmp = concatBytes(
    flagsAndLength(flagsNibble, dmpLength),
    Uint8Array.from([0x02]), // VECTOR_DMP_SET_PROPERTY
    Uint8Array.from([0xa1]), // Address Type & Data Type
    u16(0x0000), // First Property Address
    u16(0x0001), // Address Increment
    u16(declaredCount),
    propertyValues,
  );
  return concatBytes(root, framing, dmp);
}

/** Spec'in kendi RGB fixture örneği (dmx512.ts/artnet.ts ile aynı) — start code + Red/Green/Blue/Dimmer. */
const HAPPY_PROPERTY_VALUES = Uint8Array.from([0x00, 0xff, 0x80, 0x00, 0xc8]);

describe('parseSacn — ACN Packet Identifier (imza)', () => {
  it('geçerli imzada Root Layer alanları okunur, çerçeve valid kalır', () => {
    const { frame } = expectSuccess(parseSacn(buildTestPacket({ propertyValues: HAPPY_PROPERTY_VALUES })));
    expect(frame.valid).toBe(true);
    expect(frame.errors).toEqual([]);
    const identifier = fieldById(frame, 'acn-packet-identifier');
    expect(identifier.valid).toBe(true);
    expect(identifier.rawValue).toBe('ASC-E1.17');
  });

  it('bozuk imza start-delimiter-not-found hatasıyla durur, sonraki alanlar hiç okunmaz', () => {
    const bytes = buildTestPacket({ propertyValues: HAPPY_PROPERTY_VALUES });
    const corrupted = Uint8Array.from(bytes);
    corrupted[4] = 0x58; // 'X' — beklenen 'A' değil
    const { frame } = expectSuccess(parseSacn(corrupted));
    expect(frame.valid).toBe(false);
    expect(frame.errors[0]?.code).toBe('start-delimiter-not-found');
    const identifier = fieldById(frame, 'acn-packet-identifier');
    expect(identifier.valid).toBe(false);
    expect(hasField(frame, 'root-vector')).toBe(false); // imza doğrulanmadan sonrası hiç okunmaz
  });

  it('16 bayttan kısa tamponda truncated-frame döner (imza bile okunamaz)', () => {
    expect(expectFailure(parseSacn(new Uint8Array(10))).error.code).toBe('truncated-frame');
  });
});

describe('parseSacn — Root Layer', () => {
  it('Preamble/Post-amble Size beklenen sabit değerlerde uyarı basmaz', () => {
    const { frame } = expectSuccess(parseSacn(buildTestPacket({ propertyValues: HAPPY_PROPERTY_VALUES })));
    expect(fieldById(frame, 'preamble-size').valid).toBe(true);
    expect(fieldById(frame, 'preamble-size').rawValue).toBe(0x0010);
    expect(fieldById(frame, 'post-amble-size').valid).toBe(true);
    expect(warningCodes(frame)).not.toContain('protocol.sacn.warning.unexpectedFixedValue');
  });

  it('CID 16 baytı standart 8-4-4-4-12 UUID gösterimiyle sunulur', () => {
    const cid = Uint8Array.from([
      0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x0e, 0x0f, 0x10,
    ]);
    const { frame } = expectSuccess(parseSacn(buildTestPacket({ cid, propertyValues: HAPPY_PROPERTY_VALUES })));
    expect(fieldById(frame, 'cid').rawValue).toBe('01020304-0506-0708-090a-0b0c0d0e0f10');
  });

  it('Root Vector VECTOR_ROOT_E131_DATA adıyla tanınır, DATA dalına dallanır', () => {
    const { frame } = expectSuccess(parseSacn(buildTestPacket({ propertyValues: HAPPY_PROPERTY_VALUES })));
    const vector = fieldById(frame, 'root-vector');
    expect(vector.physicalValue).toBe('VECTOR_ROOT_E131_DATA');
    expect(vector.valid).toBe(true);
    expect(hasField(frame, 'source-name')).toBe(true);
  });

  it('Flags&Length üst nibble 0x7 değilse alan geçersiz işaretlenir + uyarı', () => {
    const { frame } = expectSuccess(
      parseSacn(buildTestPacket({ propertyValues: HAPPY_PROPERTY_VALUES, flagsNibbleOverride: 0x3 })),
    );
    const rootFlags = fieldById(frame, 'root-flags-and-length');
    expect(rootFlags.valid).toBe(false);
    expect(warningCodes(frame)).toContain('protocol.sacn.warning.unexpectedFlagsNibble');
  });
});

describe('parseSacn — Root Vector dallanması (EXTENDED / bilinmeyen)', () => {
  it('VECTOR_ROOT_E131_EXTENDED: gövde ham blok olur, Data Packet alanları YOKTUR', () => {
    const bytes = concatBytes(
      u16(0x0010),
      u16(0x0000),
      ACN_PACKET_IDENTIFIER,
      flagsAndLength(0x7, 26),
      u32(0x00000008), // VECTOR_ROOT_E131_EXTENDED
      new Uint8Array(16).fill(0xcd),
      Uint8Array.from([0x01, 0x02, 0x03, 0x04]),
    );
    const { frame } = expectSuccess(parseSacn(bytes));
    expect(fieldById(frame, 'root-vector').physicalValue).toBe('VECTOR_ROOT_E131_EXTENDED');
    expect(hasField(frame, 'source-name')).toBe(false);
    expect(hasField(frame, 'universe')).toBe(false);
    const body = fieldById(frame, 'body');
    expect(body.length).toBe(4);
    expect(warningCodes(frame)).toContain('protocol.sacn.warning.rootVectorBodyNotDecoded');
    expect(frame.valid).toBe(true); // uyarı, hata değil
  });

  it('bilinmeyen Root Vector ham blok + "tanınmayan" uyarısı basar', () => {
    const bytes = concatBytes(
      u16(0x0010),
      u16(0x0000),
      ACN_PACKET_IDENTIFIER,
      flagsAndLength(0x7, 26),
      u32(0x12345678),
      new Uint8Array(16).fill(0xcd),
      Uint8Array.from([0x01, 0x02, 0x03, 0x04]),
    );
    const { frame } = expectSuccess(parseSacn(bytes));
    const vector = fieldById(frame, 'root-vector');
    expect(vector.valid).toBe(false);
    expect(vector.physicalValue).toBeUndefined();
    expect(warningCodes(frame)).toContain('protocol.sacn.warning.unrecognizedRootVector');
    expect(fieldById(frame, 'body').valid).toBe(false);
  });
});

describe('parseSacn — Framing Layer: Source Name (UTF-8, null-terminated)', () => {
  it('trailing null baytları temizlenmiş metinde görünmez, ham blokta 64 bayt kalır', () => {
    const { frame } = expectSuccess(
      parseSacn(buildTestPacket({ sourceName: 'Lighting Console 1', propertyValues: HAPPY_PROPERTY_VALUES })),
    );
    const sourceName = fieldById(frame, 'source-name');
    expect(sourceName.rawValue).toBe('Lighting Console 1');
    expect(sourceName.length).toBe(64);
    expect(sourceName.rawBytes.length).toBe(64);
    expect(sourceName.rawBytes[sourceName.rawBytes.length - 1]).toBe(0x00);
  });

  it('çok baytlı UTF-8 karakter doğru çözülür', () => {
    const { frame } = expectSuccess(
      parseSacn(buildTestPacket({ sourceName: 'Işık Konsolu', propertyValues: HAPPY_PROPERTY_VALUES })),
    );
    expect(fieldById(frame, 'source-name').rawValue).toBe('Işık Konsolu');
  });
});

describe('parseSacn — Priority sınırları (0-200)', () => {
  it('0 ve 200 sınır değerleri geçerlidir, uyarı basmaz', () => {
    const zero = expectSuccess(parseSacn(buildTestPacket({ priority: 0, propertyValues: HAPPY_PROPERTY_VALUES })));
    expect(fieldById(zero.frame, 'priority').valid).toBe(true);
    expect(warningCodes(zero.frame)).not.toContain('protocol.sacn.warning.priorityOutOfRange');

    const max = expectSuccess(parseSacn(buildTestPacket({ priority: 200, propertyValues: HAPPY_PROPERTY_VALUES })));
    expect(fieldById(max.frame, 'priority').valid).toBe(true);
    expect(warningCodes(max.frame)).not.toContain('protocol.sacn.warning.priorityOutOfRange');
  });

  it('200’ün üstü aralık dışı uyarısı basar, hata değildir', () => {
    const { frame } = expectSuccess(
      parseSacn(buildTestPacket({ priority: 201, propertyValues: HAPPY_PROPERTY_VALUES })),
    );
    expect(fieldById(frame, 'priority').valid).toBe(false);
    expect(warningCodes(frame)).toContain('protocol.sacn.warning.priorityOutOfRange');
    expect(frame.valid).toBe(true);
    expect(frame.errors).toEqual([]);
  });
});

describe('parseSacn — Options bitleri (Preview_Data / Stream_Terminated / Force_Synchronization)', () => {
  it('hiçbir bit set değilse üçü de 0 döner', () => {
    const { frame } = expectSuccess(parseSacn(buildTestPacket({ propertyValues: HAPPY_PROPERTY_VALUES })));
    expect(fieldById(frame, 'preview-data').rawValue).toBe(0);
    expect(fieldById(frame, 'stream-terminated').rawValue).toBe(0);
    expect(fieldById(frame, 'force-synchronization').rawValue).toBe(0);
  });

  it('Stream_Terminated (bit 6) set edilince yalnız o alan 1 döner', () => {
    const { frame } = expectSuccess(
      parseSacn(buildTestPacket({ optionsByte: 0b0100_0000, propertyValues: HAPPY_PROPERTY_VALUES })),
    );
    expect(fieldById(frame, 'preview-data').rawValue).toBe(0);
    expect(fieldById(frame, 'stream-terminated').rawValue).toBe(1);
    expect(fieldById(frame, 'stream-terminated').physicalValue).toBe('Set');
    expect(fieldById(frame, 'force-synchronization').rawValue).toBe(0);
  });

  it('Preview_Data (bit 7, en anlamlı bit) set edilince doğru bit okunur', () => {
    const { frame } = expectSuccess(
      parseSacn(buildTestPacket({ optionsByte: 0b1000_0000, propertyValues: HAPPY_PROPERTY_VALUES })),
    );
    expect(fieldById(frame, 'preview-data').rawValue).toBe(1);
    expect(fieldById(frame, 'stream-terminated').rawValue).toBe(0);
  });
});

describe('parseSacn — Universe (1-63999)', () => {
  it('geçerli aralıkta uyarı basmaz', () => {
    const { frame } = expectSuccess(
      parseSacn(buildTestPacket({ universe: 63999, propertyValues: HAPPY_PROPERTY_VALUES })),
    );
    expect(fieldById(frame, 'universe').valid).toBe(true);
    expect(warningCodes(frame)).not.toContain('protocol.sacn.warning.universeOutOfRange');
  });

  it('0 rezervedir, aralık dışı uyarısı basar', () => {
    const { frame } = expectSuccess(parseSacn(buildTestPacket({ universe: 0, propertyValues: HAPPY_PROPERTY_VALUES })));
    expect(fieldById(frame, 'universe').valid).toBe(false);
    expect(warningCodes(frame)).toContain('protocol.sacn.warning.universeOutOfRange');
  });

  it('64000 ve üstü rezervedir (E131_DISCOVERY_UNIVERSE=64214 dahil)', () => {
    const { frame } = expectSuccess(
      parseSacn(buildTestPacket({ universe: 64214, propertyValues: HAPPY_PROPERTY_VALUES })),
    );
    expect(fieldById(frame, 'universe').valid).toBe(false);
    expect(warningCodes(frame)).toContain('protocol.sacn.warning.universeOutOfRange');
  });
});

describe('parseSacn — DMP Layer sabitleri', () => {
  it('Vector/Address Type/First Property Address/Address Increment beklenen değerlerde uyarı basmaz', () => {
    const { frame } = expectSuccess(parseSacn(buildTestPacket({ propertyValues: HAPPY_PROPERTY_VALUES })));
    expect(fieldById(frame, 'dmp-vector').valid).toBe(true);
    expect(fieldById(frame, 'address-type-and-data-type').valid).toBe(true);
    expect(fieldById(frame, 'address-type-and-data-type').rawValue).toBe(0xa1);
    expect(fieldById(frame, 'first-property-address').valid).toBe(true);
    expect(fieldById(frame, 'address-increment').valid).toBe(true);
    expect(warningCodes(frame)).not.toContain('protocol.sacn.warning.unexpectedFixedValue');
  });

  it('Property Value Count START CODE\'u DA SAYAR — 1 + slot sayısı (off-by-one)', () => {
    const { frame } = expectSuccess(parseSacn(buildTestPacket({ propertyValues: HAPPY_PROPERTY_VALUES })));
    // HAPPY_PROPERTY_VALUES = start code + 4 slot = 5 bayt → count 5.
    expect(fieldById(frame, 'property-value-count').rawValue).toBe(5);
  });
});

describe('parseSacn — Property Values (start code + slot özet deseni, dmx512.ts ile AYNI)', () => {
  it('bayt 0 = start code, slot 1 = bayt 1 (dmx512.ts ile aynı kayma)', () => {
    const { frame } = expectSuccess(parseSacn(buildTestPacket({ propertyValues: HAPPY_PROPERTY_VALUES })));
    const startCode = fieldById(frame, 'start-code');
    expect(startCode.rawValue).toBe(0x00);
    const slot1 = fieldById(frame, 'slot-1');
    expect(slot1.rawValue).toBe(0xff);
    expect(fieldById(frame, 'slot-4').rawValue).toBe(0xc8);
  });

  it('16’dan fazla slotta ilk 16 ayrı alan, kalanı tek özet blokta toplanır', () => {
    const slots = new Array(30).fill(0x2a);
    const propertyValues = Uint8Array.from([0x00, ...slots]);
    const { frame } = expectSuccess(parseSacn(buildTestPacket({ propertyValues })));
    expect(hasField(frame, 'slot-16')).toBe(true);
    expect(hasField(frame, 'slot-17')).toBe(false);
    const remainder = fieldById(frame, 'slot-data');
    expect(remainder.name).toBe('Slots 17-30');
    expect(remainder.length).toBe(14);
  });

  it('tam 512 slotlu universe’da toplam çerçeve 638 bayttır (spec §5.4 NOTE ile birebir)', () => {
    const slots = new Array(512).fill(0).map((_, index) => (index + 1) % 256);
    const propertyValues = Uint8Array.from([0x00, ...slots]);
    const bytes = buildTestPacket({ propertyValues });
    expect(bytes.length).toBe(638);
    const { frame } = expectSuccess(parseSacn(bytes));
    expect(frame.valid).toBe(true);
    expect(warningCodes(frame)).not.toContain('protocol.sacn.warning.layerLengthMismatch');
  });
});

describe('parseSacn — katman-length tutarlılığı (MBAP/doip tonu)', () => {
  it('dört katman beyanı tutarlıysa uyarı basılmaz', () => {
    const { frame } = expectSuccess(parseSacn(buildTestPacket({ propertyValues: HAPPY_PROPERTY_VALUES })));
    expect(warningCodes(frame)).not.toContain('protocol.sacn.warning.layerLengthMismatch');
  });

  it('Property Value Count gerçek bayttan fazla beyan edilirse tutarsızlık uyarısı basar, hata değildir', () => {
    const { frame } = expectSuccess(
      parseSacn(
        buildTestPacket({
          propertyValues: HAPPY_PROPERTY_VALUES,
          declaredPropertyValueCountOverride: HAPPY_PROPERTY_VALUES.length + 10,
        }),
      ),
    );
    expect(warningCodes(frame)).toContain('protocol.sacn.warning.layerLengthMismatch');
    expect(frame.valid).toBe(true);
    expect(frame.errors).toEqual([]);
    // Alanlar yine de GERÇEKTE mevcut bayttan çözülür (beyandan değil) — dosya başı.
    expect(fieldById(frame, 'property-value-count').rawValue).toBe(HAPPY_PROPERTY_VALUES.length + 10);
    expect(hasField(frame, 'slot-4')).toBe(true);
    expect(hasField(frame, 'slot-14')).toBe(false); // 4 slot gerçekte var, 14 slot yok
  });
});

describe('parseSacn — kesme (truncation) hata yolları', () => {
  // İmza (ACN Packet Identifier) doğrulandıktan SONRAKİ kesmeler artnet.ts'in
  // "ProtVer için yetersiz bayt" deseniyle AYNI: top-level ParseFailure DEĞİL,
  // `success:true` + `frame.valid:false` + `frame.errors[0]` — kısmi çerçeve
  // (o ana kadar okunan alanlar) yine gösterilir (spec §47 tonu).
  it('Root Layer CID’e kadar tamamlanmamışsa kısmi çerçeve + truncated-frame hatası döner', () => {
    const bytes = buildTestPacket({ propertyValues: HAPPY_PROPERTY_VALUES }).slice(0, 20);
    const { frame } = expectSuccess(parseSacn(bytes));
    expect(frame.valid).toBe(false);
    expect(frame.errors[0]?.code).toBe('truncated-frame');
    expect(hasField(frame, 'acn-packet-identifier')).toBe(true);
    expect(hasField(frame, 'root-vector')).toBe(false);
  });

  it('Framing Layer Universe’a kadar tamamlanmamışsa kısmi çerçeve + truncated-frame hatası döner', () => {
    const bytes = buildTestPacket({ propertyValues: HAPPY_PROPERTY_VALUES }).slice(0, 100);
    const { frame } = expectSuccess(parseSacn(bytes));
    expect(frame.valid).toBe(false);
    expect(frame.errors[0]?.code).toBe('truncated-frame');
    expect(hasField(frame, 'root-vector')).toBe(true);
    expect(hasField(frame, 'universe')).toBe(false);
  });

  it('DMP header’a (Property Value Count) kadar tamamlanmamışsa kısmi çerçeve + truncated-frame hatası döner', () => {
    const bytes = buildTestPacket({ propertyValues: HAPPY_PROPERTY_VALUES }).slice(0, 120);
    const { frame } = expectSuccess(parseSacn(bytes));
    expect(frame.valid).toBe(false);
    expect(frame.errors[0]?.code).toBe('truncated-frame');
    expect(hasField(frame, 'universe')).toBe(true);
    expect(hasField(frame, 'property-value-count')).toBe(false);
  });

  it('DMP header tamamsa ama hiç property value yoksa (tam 125 bayt) alan basmadan başarıyla biter', () => {
    const bytes = buildTestPacket({ propertyValues: HAPPY_PROPERTY_VALUES }).slice(0, 125);
    const { frame } = expectSuccess(parseSacn(bytes));
    expect(hasField(frame, 'start-code')).toBe(false);
    expect(frame.errors).toEqual([]);
  });

  it('context.maxFrameLength aşılırsa frame-too-long döner', () => {
    const bytes = buildTestPacket({ propertyValues: HAPPY_PROPERTY_VALUES });
    const result = sacnParser.parse(bytes, { maxFrameLength: 50 });
    expect(expectFailure(result).error.code).toBe('frame-too-long');
  });
});

describe('sacnParser', () => {
  it('canParse yalnız 12 baytlık ACN Packet Identifier imzasını denetler', () => {
    const bytes = buildTestPacket({ propertyValues: HAPPY_PROPERTY_VALUES });
    expect(sacnParser.canParse(bytes)).toBe(true);
    expect(sacnParser.canParse(new Uint8Array(20))).toBe(false); // imza yok
    expect(sacnParser.canParse(new Uint8Array(10))).toBe(false); // 16 bayttan kısa
  });

  it('iptal edilmiş signal’da parser-timeout döner', () => {
    const controller = new AbortController();
    controller.abort();
    const bytes = buildTestPacket({ propertyValues: HAPPY_PROPERTY_VALUES });
    const result = expectFailure(sacnParser.parse(bytes, { signal: controller.signal }));
    expect(result.error.code).toBe('parser-timeout');
  });
});

describe('sacnPlugin', () => {
  it('katalogdaki kimlik, kategori ve parser bağını taşır', () => {
    expect(sacnPlugin.id).toBe('sacn');
    expect(sacnPlugin.category).toBe('building-automation');
    expect(sacnPlugin.parser).toBe(sacnParser);
  });

  it('her örnek çözülür ve expectedValid ile eşleşir', () => {
    for (const example of sacnPlugin.exampleFrames) {
      const result = sacnParser.parse(example.bytes);
      if (!result.success) {
        throw new Error(`example "${example.id}" failed: ${result.error.code}`);
      }
      expect(result.frame.valid, `example "${example.id}"`).toBe(example.expectedValid ?? true);
    }
  });

  it('her örnek adı/açıklaması protocol.sacn.example. önekli çeviri anahtarıdır', () => {
    for (const example of sacnPlugin.exampleFrames) {
      expect(example.name.startsWith('protocol.sacn.example.'), example.id).toBe(true);
      expect(example.description?.startsWith('protocol.sacn.example.'), example.id).toBe(true);
    }
  });

  it('brief madde 8’in istediği yedi senaryonun tamamını kapsar', () => {
    const ids = sacnPlugin.exampleFrames.map((example) => example.id);
    expect(ids).toContain('data-packet-happy-path');
    expect(ids).toContain('data-packet-full-512-universe');
    expect(ids).toContain('priority-boundary-zero');
    expect(ids).toContain('priority-boundary-two-hundred');
    expect(ids).toContain('options-stream-terminated');
    expect(ids).toContain('universe-out-of-range');
    expect(ids).toContain('invalid-acn-packet-identifier');
    expect(ids).toContain('layer-length-mismatch');
  });

  it('universe-out-of-range örneği aralık dışı uyarısı basar (hata değil)', () => {
    const example = sacnPlugin.exampleFrames.find((frame) => frame.id === 'universe-out-of-range');
    if (example === undefined) throw new Error('universe-out-of-range example not found');
    const { frame } = expectSuccess(sacnParser.parse(example.bytes));
    expect(warningCodes(frame)).toContain('protocol.sacn.warning.universeOutOfRange');
  });

  it('layer-length-mismatch örneği katman tutarsızlığı uyarısı basar', () => {
    const example = sacnPlugin.exampleFrames.find((frame) => frame.id === 'layer-length-mismatch');
    if (example === undefined) throw new Error('layer-length-mismatch example not found');
    const { frame } = expectSuccess(sacnParser.parse(example.bytes));
    expect(warningCodes(frame)).toContain('protocol.sacn.warning.layerLengthMismatch');
  });

  it('invalid-acn-packet-identifier örneği hata yolunu izler', () => {
    const example = sacnPlugin.exampleFrames.find((frame) => frame.id === 'invalid-acn-packet-identifier');
    if (example === undefined) throw new Error('invalid-acn-packet-identifier example not found');
    const { frame } = expectSuccess(sacnParser.parse(example.bytes));
    expect(frame.valid).toBe(false);
    expect(frame.errors[0]?.code).toBe('start-delimiter-not-found');
  });

  it('root-vector-extended-not-decoded örneği gövdeyi çözmez, adlandırılmış uyarı basar', () => {
    const example = sacnPlugin.exampleFrames.find((frame) => frame.id === 'root-vector-extended-not-decoded');
    if (example === undefined) throw new Error('root-vector-extended-not-decoded example not found');
    const { frame } = expectSuccess(sacnParser.parse(example.bytes));
    expect(fieldById(frame, 'root-vector').physicalValue).toBe('VECTOR_ROOT_E131_EXTENDED');
    expect(warningCodes(frame)).toContain('protocol.sacn.warning.rootVectorBodyNotDecoded');
  });
});
