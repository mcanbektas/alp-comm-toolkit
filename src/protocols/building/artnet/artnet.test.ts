import { describe, expect, it } from 'vitest';

import { artNetParser, artNetPlugin, parseArtNet } from './artnet';
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

/** "Art-Net" (7 ASCII) + 0x00 — dosya başı imza. */
const VALID_ID = [0x41, 0x72, 0x74, 0x2d, 0x4e, 0x65, 0x74, 0x00];

function opCodeBytesLE(opCode: number): number[] {
  return [opCode & 0xff, (opCode >>> 8) & 0xff];
}

/** ProtVerHi=0x00, ProtVerLo=14 — spec "Current value 14". */
const PROT_VER_BYTES = [0x00, 14];

function buildHeader(opCode: number, includeProtVer = true): number[] {
  return includeProtVer
    ? [...VALID_ID, ...opCodeBytesLE(opCode), ...PROT_VER_BYTES]
    : [...VALID_ID, ...opCodeBytesLE(opCode)];
}

const OP_POLL = 0x2000;
const OP_POLL_REPLY = 0x2100;
const OP_DMX = 0x5000;
const OP_TIME_CODE = 0x9700;

describe('parseArtNet — ortak başlık: ID imzası', () => {
  it('doğru 8 baytlık "Art-Net" imzasını geçerli işaretler, hata basmaz', () => {
    const bytes = Uint8Array.from([...buildHeader(OP_POLL), 0x00, 0x00]);
    const { frame } = expectSuccess(parseArtNet(bytes));
    expect(frame.valid).toBe(true);
    const id = fieldById(frame, 'id');
    expect(id.valid).toBe(true);
    expect(id.rawValue).toBe('Art-Net');
    expect(frame.errors).toEqual([]);
  });

  it('bozuk imza start-delimiter-not-found hatası basar ve çözümleme ID’den sonra durur', () => {
    const corrupted = [...VALID_ID];
    corrupted[0] = 0x58; // 'X' — 'A' değil
    const bytes = Uint8Array.from([...corrupted, ...opCodeBytesLE(OP_POLL), ...PROT_VER_BYTES]);
    const { frame } = expectSuccess(parseArtNet(bytes));
    expect(frame.valid).toBe(false);
    expect(frame.errors).toHaveLength(1);
    expect(frame.errors[0]?.code).toBe('start-delimiter-not-found');
    // OpCode alanı hiç üretilmedi — imza doğrulanmadan sonraki baytlar yorumlanmaz (dosya başı).
    expect(hasField(frame, 'op-code')).toBe(false);
    expect(frame.fields).toHaveLength(1);
  });
});

describe('parseArtNet — OpCode (LE) / ProtVer (BE) endianlığı', () => {
  it('OpCode küçük-uçlu (LE) okunur: bayt [0x00,0x50] → 0x5000 (ArtDmx)', () => {
    const bytes = Uint8Array.from([...VALID_ID, 0x00, 0x50, ...PROT_VER_BYTES, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
    const { frame } = expectSuccess(parseArtNet(bytes));
    const opCode = fieldById(frame, 'op-code');
    expect(opCode.rawValue).toBe(OP_DMX);
    expect(opCode.physicalValue).toBe('ArtDmx');
  });

  it('ProtVer büyük-uçlu (BE) okunur: ProtVerHi/Lo bayt [0x01,0x02] → 0x0102', () => {
    const bytes = Uint8Array.from([...VALID_ID, ...opCodeBytesLE(OP_POLL), 0x01, 0x02, 0x00, 0x00]);
    const { frame } = expectSuccess(parseArtNet(bytes));
    const protVer = fieldById(frame, 'prot-ver');
    expect(protVer.rawValue).toBe(0x0102);
  });

  it('tanınmayan OpCode alanı geçersiz işaretler ve uyarı basar, ama çerçeve valid kalır', () => {
    const bytes = Uint8Array.from(buildHeader(0x1234));
    const { frame } = expectSuccess(parseArtNet(bytes));
    const opCode = fieldById(frame, 'op-code');
    expect(opCode.valid).toBe(false);
    expect(opCode.physicalValue).toBeUndefined();
    expect(warningCodes(frame)).toContain('protocol.artnet.warning.unrecognizedOpcode');
    expect(frame.valid).toBe(true);
    expect(frame.errors).toEqual([]);
  });
});

describe('parseArtNet — ArtPollReply: ProtVer YOK (tuzak)', () => {
  it('ArtPollReply gövdesi OpCode’dan hemen sonra başlar (offset 10), ProtVer alanı üretilmez', () => {
    const ip = [192, 168, 1, 50];
    const port = [0x36, 0x19]; // 0x1936 LE
    const bytes = Uint8Array.from([...VALID_ID, ...opCodeBytesLE(OP_POLL_REPLY), ...ip, ...port]);
    const { frame } = expectSuccess(parseArtNet(bytes));
    expect(hasField(frame, 'prot-ver')).toBe(false);
    const ipField = fieldById(frame, 'ip-address');
    expect(ipField.offset).toBe(10);
    expect(ipField.rawValue).toBe('192.168.1.50');
    const portField = fieldById(frame, 'port');
    expect(portField.offset).toBe(14);
    expect(portField.rawValue).toBe(0x1936);
  });

  it('IP/Port/PortName adlandırılır, aradaki ve sonraki alanlar ham blok olarak kalır', () => {
    const ip = [10, 0, 0, 1];
    const port = [0x36, 0x19];
    const nodeInfoGap = new Array(10).fill(0);
    const portNameText = 'Test Node';
    const portNameBytes = new Array(18).fill(0);
    for (let i = 0; i < portNameText.length; i += 1) {
      portNameBytes[i] = portNameText.charCodeAt(i);
    }
    const trailing = [0x01, 0x02, 0x03];
    const bytes = Uint8Array.from([
      ...VALID_ID,
      ...opCodeBytesLE(OP_POLL_REPLY),
      ...ip,
      ...port,
      ...nodeInfoGap,
      ...portNameBytes,
      ...trailing,
    ]);
    const { frame } = expectSuccess(parseArtNet(bytes));
    expect(fieldById(frame, 'port-name').rawValue).toBe('Test Node');
    const nodeInfo = fieldById(frame, 'node-info-fields');
    expect(nodeInfo.length).toBe(10);
    const remainder = fieldById(frame, 'remaining-fields');
    expect(remainder.length).toBe(3);
    expect(frame.valid).toBe(true);
  });

  it('IP baytları eksikse truncated-frame hatasıyla kısmi çerçeve döner', () => {
    const bytes = Uint8Array.from([...VALID_ID, ...opCodeBytesLE(OP_POLL_REPLY), 192, 168]);
    const { frame } = expectSuccess(parseArtNet(bytes));
    expect(frame.valid).toBe(false);
    expect(frame.errors[0]?.code).toBe('truncated-frame');
    expect(hasField(frame, 'ip-address')).toBe(false);
  });
});

describe('parseArtNet — ArtDmx', () => {
  it('Sequence=0 "Disabled" fiziksel değeri taşır — paket kaybı DEĞİL', () => {
    const bytes = Uint8Array.from([...buildHeader(OP_DMX), 0x00, 0x00, 0x00, 0x00, 0x00, 0x04, 0xff, 0x80, 0x00, 0xc8]);
    const { frame } = expectSuccess(parseArtNet(bytes));
    const sequence = fieldById(frame, 'sequence');
    expect(sequence.rawValue).toBe(0);
    expect(sequence.physicalValue).toBe('Disabled');
  });

  it('Sequence≠0 ham sayı olarak kalır, physicalValue basılmaz', () => {
    const bytes = Uint8Array.from([...buildHeader(OP_DMX), 0x05, 0x00, 0x00, 0x00, 0x00, 0x02, 0x01, 0x02]);
    const { frame } = expectSuccess(parseArtNet(bytes));
    const sequence = fieldById(frame, 'sequence');
    expect(sequence.rawValue).toBe(5);
    expect(sequence.physicalValue).toBeUndefined();
  });

  it('SubUni ve Net ayrı alanlardır, TEK bir Universe alanında birleştirilmez', () => {
    const bytes = Uint8Array.from([...buildHeader(OP_DMX), 0x00, 0x00, 0x03, 0x01, 0x00, 0x02, 0x0a, 0x0b]);
    const { frame } = expectSuccess(parseArtNet(bytes));
    expect(fieldById(frame, 'sub-uni').rawValue).toBe(3);
    expect(fieldById(frame, 'net').rawValue).toBe(1);
  });

  it('Data[0] doğrudan Kanal/Slot 1’dir — start code baytı YOK, dmx512’deki +1 kayma burada uygulanmaz', () => {
    const bytes = Uint8Array.from([...buildHeader(OP_DMX), 0x00, 0x00, 0x00, 0x00, 0x00, 0x02, 0xaa, 0xbb]);
    const { frame } = expectSuccess(parseArtNet(bytes));
    const slot1 = fieldById(frame, 'slot-1');
    // Header 12 bayt + Sequence/Physical/SubUni/Net (4) + Length (2) = 18 — Data ondan sonra başlar.
    expect(slot1.offset).toBe(18);
    expect(slot1.rawValue).toBe(0xaa);
    const slot2 = fieldById(frame, 'slot-2');
    expect(slot2.rawValue).toBe(0xbb);
  });

  it('Length beyan edilenle gerçek veri farklıysa uyarı basar, hata basmaz', () => {
    const bytes = Uint8Array.from([...buildHeader(OP_DMX), 0x00, 0x00, 0x00, 0x00, 0x00, 0x0a, 0x01, 0x02, 0x03, 0x04]);
    const { frame } = expectSuccess(parseArtNet(bytes));
    expect(frame.valid).toBe(true);
    expect(frame.errors).toEqual([]);
    expect(warningCodes(frame)).toContain('protocol.artnet.warning.lengthMismatch');
    // Data alanı GERÇEKTE mevcut 4 baytı gösterir, beyan edilen 10’u değil.
    expect(hasField(frame, 'slot-4')).toBe(true);
    expect(hasField(frame, 'slot-5')).toBe(false);
  });

  it('16’dan fazla kanalda ilk 16 ayrı alan, kalanı tek özet alanda toplanır (6a deseni)', () => {
    const channelCount = 20;
    const channels = new Array(channelCount).fill(0x2a);
    const bytes = Uint8Array.from([
      ...buildHeader(OP_DMX),
      0x00,
      0x00,
      0x00,
      0x00,
      (channelCount >>> 8) & 0xff,
      channelCount & 0xff,
      ...channels,
    ]);
    const { frame } = expectSuccess(parseArtNet(bytes));
    expect(hasField(frame, 'slot-16')).toBe(true);
    expect(hasField(frame, 'slot-17')).toBe(false);
    const remainder = fieldById(frame, 'slot-data');
    expect(remainder.name).toBe('Slots 17-20');
    expect(remainder.length).toBe(4);
  });
});

describe('parseArtNet — ArtPoll', () => {
  it('Flags ham bayt, DiagPriority Table 5’ten adlandırılır (DpHigh=0x80)', () => {
    const bytes = Uint8Array.from([...buildHeader(OP_POLL), 0x02, 0x80]);
    const { frame } = expectSuccess(parseArtNet(bytes));
    const flags = fieldById(frame, 'flags');
    expect(flags.rawValue).toBe(0x02);
    const diagPriority = fieldById(frame, 'diag-priority');
    expect(diagPriority.physicalValue).toBe('DpHigh');
    expect(diagPriority.valid).toBe(true);
  });

  it('tanınmayan DiagPriority ham gösterilir ve uyarı basar', () => {
    const bytes = Uint8Array.from([...buildHeader(OP_POLL), 0x00, 0x05]);
    const { frame } = expectSuccess(parseArtNet(bytes));
    const diagPriority = fieldById(frame, 'diag-priority');
    expect(diagPriority.valid).toBe(false);
    expect(warningCodes(frame)).toContain('protocol.artnet.warning.unknownDiagPriority');
    expect(frame.valid).toBe(true);
  });

  it('Flags/DiagPriority sonrası kalan baytlar tek ham blokta toplanır', () => {
    const bytes = Uint8Array.from([...buildHeader(OP_POLL), 0x00, 0x00, 0x00, 0x00, 0x00]);
    const { frame } = expectSuccess(parseArtNet(bytes));
    const remainder = fieldById(frame, 'remaining-fields');
    expect(remainder.length).toBe(3);
  });
});

describe('parseArtNet — diğer OpCode’lar: dar ad kümesi + ham gövde', () => {
  it('ArtTimeCode (0x9700) adıyla tanınır, gövdesi ham + uyarı taşır', () => {
    const bytes = Uint8Array.from([...buildHeader(OP_TIME_CODE), 0x00, 0x0a, 0x0f, 0x02]);
    const { frame } = expectSuccess(parseArtNet(bytes));
    const opCode = fieldById(frame, 'op-code');
    expect(opCode.physicalValue).toBe('ArtTimeCode');
    expect(opCode.valid).toBe(true);
    const body = fieldById(frame, 'body');
    expect(body.length).toBe(4);
    expect(warningCodes(frame)).toContain('protocol.artnet.warning.opcodeBodyNotDecoded');
    expect(frame.valid).toBe(true);
  });

  it('tamamen tanınmayan bir OpCode’ta gövde alanı geçersiz işaretlenir', () => {
    const bytes = Uint8Array.from([...buildHeader(0xabcd), 0xde, 0xad]);
    const { frame } = expectSuccess(parseArtNet(bytes));
    const body = fieldById(frame, 'body');
    expect(body.valid).toBe(false);
    expect(body.warnings).toContain('protocol.artnet.warning.unrecognizedOpcode');
  });
});

describe('parseArtNet — hata yolları', () => {
  it('10 bayttan kısa tamponda truncated-frame döner (OpCode bile okunamaz)', () => {
    const result = parseArtNet(Uint8Array.from([...VALID_ID, 0x00]));
    expect(expectFailure(result).error.code).toBe('truncated-frame');
  });

  it('context.maxFrameLength aşılırsa frame-too-long döner', () => {
    const bytes = Uint8Array.from(buildHeader(OP_POLL));
    const result = artNetParser.parse(bytes, { maxFrameLength: 4 });
    expect(expectFailure(result).error.code).toBe('frame-too-long');
  });

  it('iptal edilmiş signal’da parser-timeout döner', () => {
    const controller = new AbortController();
    controller.abort();
    const result = artNetParser.parse(Uint8Array.from(buildHeader(OP_POLL)), { signal: controller.signal });
    expect(expectFailure(result).error.code).toBe('parser-timeout');
  });

  it('ProtVer için yetersiz bayt truncated-frame hatasıyla kısmi çerçeve döner', () => {
    const bytes = Uint8Array.from([...VALID_ID, ...opCodeBytesLE(OP_POLL), 0x00]);
    const { frame } = expectSuccess(parseArtNet(bytes));
    expect(frame.valid).toBe(false);
    expect(frame.errors[0]?.code).toBe('truncated-frame');
    expect(hasField(frame, 'prot-ver')).toBe(false);
  });
});

describe('artNetParser.canParse', () => {
  it('yalnız asgari uzunluk + doğru imzayı denetler', () => {
    expect(artNetParser.canParse(Uint8Array.from(buildHeader(OP_POLL)))).toBe(true);
    expect(artNetParser.canParse(Uint8Array.from([...VALID_ID, 0x00]))).toBe(false); // <10 bayt
    const corrupted = [...VALID_ID];
    corrupted[0] = 0x00;
    expect(artNetParser.canParse(Uint8Array.from([...corrupted, 0x00, 0x00]))).toBe(false);
  });
});

describe('artNetPlugin', () => {
  it('katalogdaki kimlik, kategori ve parser bağını taşır', () => {
    expect(artNetPlugin.id).toBe('art-net');
    expect(artNetPlugin.category).toBe('building-automation');
    expect(artNetPlugin.parser).toBe(artNetParser);
  });

  it('her örnek çözülür ve expectedValid ile eşleşir', () => {
    for (const example of artNetPlugin.exampleFrames) {
      const result = artNetParser.parse(example.bytes);
      if (!result.success) {
        throw new Error(`example "${example.id}" failed: ${result.error.code}`);
      }
      expect(result.frame.valid, `example "${example.id}"`).toBe(example.expectedValid ?? true);
    }
  });

  it('her örnek adı/açıklaması protocol.artnet.example. önekli çeviri anahtarıdır', () => {
    for (const example of artNetPlugin.exampleFrames) {
      expect(example.name.startsWith('protocol.artnet.example.'), example.id).toBe(true);
      expect(example.description?.startsWith('protocol.artnet.example.'), example.id).toBe(true);
    }
  });

  it('örnekler brifin istediği yedi kategoriyi kapsar', () => {
    const ids = artNetPlugin.exampleFrames.map((example) => example.id);
    expect(ids).toContain('art-dmx-happy-path'); // ArtDmx mutlu yol
    expect(ids).toContain('art-dmx-full-512-universe'); // ArtDmx tam 512 slotlu
    expect(ids).toContain('art-poll-basic'); // ArtPoll
    expect(ids).toContain('art-poll-reply-partial'); // ArtPollReply (kısmi alan + ham kalan)
    expect(ids).toContain('art-time-code-body-not-decoded'); // az bilinen OpCode (uyarı yolu)
    expect(ids).toContain('unknown-opcode'); // tanınmayan OpCode (uyarı yolu)
    expect(ids).toContain('invalid-signature'); // imza bozuk (hata yolu)
    expect(ids).toContain('art-dmx-length-mismatch'); // Length tutarsız (uyarı yolu)
  });
});
