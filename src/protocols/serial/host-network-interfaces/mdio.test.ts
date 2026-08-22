import { describe, expect, it } from 'vitest';

import { isParseSuccess } from '@/protocol-core/types';
import { translations } from '@/translations';

import {
  buildMdioFrame,
  decodeRegister,
  mdioParser,
  mdioPlugin,
  parseMdioFrame,
  splitMdioFrame,
  summariseRegister,
} from './mdio';
import type { MdioFrameMetadata } from './mdio';

function parseOrThrow(bytes: Uint8Array) {
  const result = parseMdioFrame(bytes);
  if (!isParseSuccess(result)) throw new Error(`çözümleme başarısız: ${result.error.message}`);
  return result.frame;
}

describe('MDIO çerçeve iskeleti (Clause 22)', () => {
  it('kaynak A tablosunun okuma dizisini üretir: preamble + <01><10><PHYAD><REGAD><10><data>', () => {
    const frame = buildMdioFrame({ opcode: 0b10, phyAddress: 1, registerAddress: 1, turnaround: 0b10, data: 0x782d });

    // 4 bayt preamble + 4 bayt çerçeve.
    expect(frame).toHaveLength(8);
    expect([...frame.slice(0, 4)]).toEqual([0xff, 0xff, 0xff, 0xff]);

    const structure = splitMdioFrame(frame);
    expect(structure).toMatchObject({
      preambleBytes: 4,
      start: 0b01,
      clause22: true,
      opcode: 0b10,
      operation: 'read',
      phyAddress: 1,
      registerAddress: 1,
      turnaround: 0b10,
      data: 0x782d,
    });
  });

  it('yazma çerçevesinin op kodu <01>', () => {
    const structure = splitMdioFrame(
      buildMdioFrame({ opcode: 0b01, phyAddress: 3, registerAddress: 0, turnaround: 0b10, data: 0x3100 }),
    );
    expect(structure?.operation).toBe('write');
    expect(structure?.phyAddress).toBe(3);
  });

  it('preamble opsiyoneldir (kaynak A §5.4.3.3 preamble suppression)', () => {
    const structure = splitMdioFrame(
      buildMdioFrame({ preamble: false, opcode: 0b10, phyAddress: 0, registerAddress: 4, turnaround: 0b10, data: 0 }),
    );
    expect(structure?.preambleBytes).toBe(0);
    expect(structure?.registerAddress).toBe(4);
  });

  it('4 bayttan kısa yakalama çözülmez', () => {
    expect(splitMdioFrame(Uint8Array.from([0xff, 0xff]))).toBeUndefined();
    expect(splitMdioFrame(Uint8Array.from([0x60, 0x41, 0x78]))).toBeUndefined();
  });

  it('tamamı 0xFF olan yakalamada çerçeve UYDURULMAZ', () => {
    expect(splitMdioFrame(Uint8Array.from([0xff, 0xff, 0xff, 0xff, 0xff, 0xff]))).toBeUndefined();
  });

  it('31 numaralı PHY ve register sınırında bitler taşmaz', () => {
    const structure = splitMdioFrame(
      buildMdioFrame({ opcode: 0b10, phyAddress: 31, registerAddress: 31, turnaround: 0b10, data: 0xffff }),
    );
    expect(structure?.phyAddress).toBe(31);
    expect(structure?.registerAddress).toBe(31);
    expect(structure?.data).toBe(0xffff);
  });
});

describe('PHY register çözümü (kaynak A tabloları ↔ kaynak C mii.h)', () => {
  it('BMSR 0x782D: link UP, AN tamam, 10/100 yetenekli', () => {
    const flags = Object.fromEntries(decodeRegister(1, 0x782d).map((flag) => [flag.name, flag.set]));

    expect(flags['Link Status']).toBe(true);
    expect(flags['Auto-Negotiation Complete']).toBe(true);
    expect(flags['100BASE-TX Full Duplex']).toBe(true);
    expect(flags['10BASE-T Half Duplex']).toBe(true);
    expect(flags['100BASE-T4']).toBe(false);
    expect(summariseRegister(1, 0x782d)).toBe('Link UP · Auto-Negotiation complete');
  });

  it('BMSR link biti 0 ise özet Link DOWN der', () => {
    expect(summariseRegister(1, 0x7829)).toContain('Link DOWN');
  });

  it('BMCR 0x3100: AN etkin — hız/duplex bitlerinin yok sayıldığı YAZILIR', () => {
    const flags = Object.fromEntries(decodeRegister(0, 0x3100).map((flag) => [flag.name, flag.set]));
    expect(flags['Auto-Negotiation Enable']).toBe(true);
    expect(flags['Speed 100 Mb/s']).toBe(true);
    expect(flags['Full Duplex']).toBe(true);
    expect(summariseRegister(0, 0x3100)).toContain('speed/duplex bits ignored');
  });

  it('BMCR AN kapalıyken hız ve duplex bildirilir', () => {
    expect(summariseRegister(0, 0x2100)).toBe('100 Mb/s · Full duplex · forced');
    expect(summariseRegister(0, 0x0000)).toBe('10 Mb/s · Half duplex · forced');
  });

  it('ANLPAR 0x45E1 partner 10/100 capable der (spec özetinin satırı)', () => {
    expect(summariseRegister(5, 0x45e1)).toBe('Partner 10/100 capable');
    const flags = Object.fromEntries(decodeRegister(5, 0x45e1).map((flag) => [flag.name, flag.set]));
    expect(flags['Acknowledge']).toBe(true);
    expect(flags['100BASE-TX Full Duplex']).toBe(true);
    expect(flags['10BASE-T']).toBe(true);
  });

  it('ANAR ile ANLPAR aynı bit haritasını paylaşır ama ACK yalnız partnerde anlamlıdır', () => {
    const advertise = decodeRegister(4, 0x45e1).map((flag) => flag.name);
    const partner = decodeRegister(5, 0x45e1).map((flag) => flag.name);
    expect(advertise).not.toContain('Acknowledge');
    expect(partner).toContain('Acknowledge');
    expect(summariseRegister(4, 0x01e1)).toBe('Advertising 10/100 capable');
  });

  it('haritası olmayan register için bayrak ÜRETİLMEZ', () => {
    expect(decodeRegister(2, 0x2000)).toHaveLength(0);
    expect(summariseRegister(2, 0x2000)).toBeUndefined();
  });
});

describe('MDIO eklentisi', () => {
  it('katalog kaydının pluginId değeriyle aynı id taşır', () => {
    expect(mdioPlugin.id).toBe('ethernet-interface');
    expect(mdioPlugin.category).toBe('interfaces-framing');
    expect(mdioPlugin.documentation?.layer).toBe('physical');
  });

  it('boş arabellek kendi çeviri anahtarıyla hata verir', () => {
    const result = parseMdioFrame(new Uint8Array(0));
    expect(isParseSuccess(result)).toBe(false);
    if (isParseSuccess(result)) return;
    expect(result.error.message).toBe('protocol.mdio.error.emptyFrame');
  });

  it('iptal edilmiş signal ile çözümleme yapılmaz', () => {
    const controller = new AbortController();
    controller.abort();
    const result = mdioParser.parse(
      buildMdioFrame({ opcode: 0b10, phyAddress: 1, registerAddress: 1, turnaround: 0b10, data: 0 }),
      { signal: controller.signal },
    );
    expect(isParseSuccess(result)).toBe(false);
  });

  it('okuma çerçevesi alanlara ayrılır ve register bayrakları basılır', () => {
    const frame = parseOrThrow(
      buildMdioFrame({ opcode: 0b10, phyAddress: 1, registerAddress: 1, turnaround: 0b10, data: 0x782d }),
    );
    const ids = frame.fields.map((field) => field.id);

    expect(ids.slice(0, 6)).toEqual(['preamble', 'start', 'opcode', 'phyAddress', 'registerAddress', 'turnaround']);
    expect(ids).toContain('data');
    expect(ids).toContain('bmsr.2');
    expect(frame.valid).toBe(true);

    const metadata = frame.rawFrame.metadata as MdioFrameMetadata;
    expect(metadata).toMatchObject({
      clause: 'clause-22',
      operation: 'read',
      phyAddress: 1,
      registerName: 'BMSR',
      summary: 'Link UP · Auto-Negotiation complete',
      phyResponded: true,
    });
  });

  it('cevapsız okuma (TA = 11) uyarı üretir — "PHY not detected" izi', () => {
    const frame = parseOrThrow(
      buildMdioFrame({ opcode: 0b10, phyAddress: 7, registerAddress: 1, turnaround: 0b11, data: 0xffff }),
    );

    expect(frame.warnings.some((warning) => warning.code === 'no-phy-response')).toBe(true);
    expect((frame.rawFrame.metadata as MdioFrameMetadata).phyResponded).toBe(false);
    expect(frame.fields.find((field) => field.id === 'turnaround')?.valid).toBe(false);
  });

  it('cevapsız okumada 0xFFFF register içeriği SANILMAZ — çözüm bastırılır', () => {
    const frame = parseOrThrow(
      buildMdioFrame({ opcode: 0b10, phyAddress: 7, registerAddress: 1, turnaround: 0b11, data: 0xffff }),
    );

    // Hat boşta yüksek kaldığı için 0xFFFF okunur; BMSR bit satırları basılsaydı
    // "Link UP, AN complete, her yetenek var" görünürdü — gerçeğin tam tersi.
    expect(frame.fields.some((field) => field.id.startsWith('bmsr.'))).toBe(false);
    const dataField = frame.fields.find((field) => field.id === 'data');
    expect(dataField?.physicalValue).toBe('0xFFFF · no response');
    expect(dataField?.valid).toBe(false);
    expect((frame.rawFrame.metadata as MdioFrameMetadata).summary).toBeUndefined();
  });

  it('preamble yoksa uyarı basılır ama çerçeve geçerli kalır', () => {
    const frame = parseOrThrow(
      buildMdioFrame({ preamble: false, opcode: 0b10, phyAddress: 1, registerAddress: 0, turnaround: 0b10, data: 0x1000 }),
    );

    expect(frame.valid).toBe(true);
    expect(frame.warnings.some((warning) => warning.code === 'preamble-suppressed')).toBe(true);
    expect(frame.fields.some((field) => field.id === 'preamble')).toBe(false);
  });

  it('Clause 45 çerçevesi ADLANIR ama alanları UYDURULMAZ', () => {
    const frame = parseOrThrow(
      buildMdioFrame({ start: 0b00, opcode: 0b11, phyAddress: 1, registerAddress: 31, turnaround: 0b10, data: 0xca04 }),
    );

    expect(frame.warnings.some((warning) => warning.code === 'clause-45')).toBe(true);
    expect(frame.fields.some((field) => field.id === 'clause45Frame')).toBe(true);
    expect(frame.fields.some((field) => field.id === 'phyAddress')).toBe(false);
    expect((frame.rawFrame.metadata as MdioFrameMetadata).clause).toBe('clause-45');
  });

  it('geçersiz ST (10 / 11) hata üretir', () => {
    const frame = parseOrThrow(
      buildMdioFrame({ start: 0b11, opcode: 0b10, phyAddress: 1, registerAddress: 1, turnaround: 0b10, data: 0 }),
    );
    expect(frame.valid).toBe(false);
    expect(frame.errors[0]?.message).toBe('protocol.mdio.error.invalidStart');
  });

  it('geçersiz op kodu uyarı üretir, alanlar yine dolar', () => {
    const frame = parseOrThrow(
      buildMdioFrame({ opcode: 0b00, phyAddress: 2, registerAddress: 1, turnaround: 0b10, data: 0x782d }),
    );
    expect(frame.warnings.some((warning) => warning.code === 'invalid-opcode')).toBe(true);
    expect(frame.fields.find((field) => field.id === 'opcode')?.valid).toBe(false);
    expect(frame.fields.some((field) => field.id === 'data')).toBe(true);
  });

  it('fazladan baytlar sessizce kaybolmaz', () => {
    const base = buildMdioFrame({ opcode: 0b10, phyAddress: 1, registerAddress: 1, turnaround: 0b10, data: 0x782d });
    const frame = parseOrThrow(Uint8Array.from([...base, 0xaa]));

    expect(frame.fields.find((field) => field.id === 'trailing')).toBeDefined();
    expect(frame.warnings.some((warning) => warning.code === 'trailing-bytes')).toBe(true);
  });

  it('alanlar ofset sırasında basılır (11i tuzağı)', () => {
    const frame = parseOrThrow(
      buildMdioFrame({ opcode: 0b10, phyAddress: 1, registerAddress: 5, turnaround: 0b10, data: 0x45e1 }),
    );
    const offsets = frame.fields.map((field) => field.offset);
    expect([...offsets].sort((left, right) => left - right)).toEqual(offsets);
  });

  it('her örnek beklenen geçerlilikle çözümlenir', () => {
    for (const example of mdioPlugin.exampleFrames) {
      const result = parseMdioFrame(example.bytes);
      expect(isParseSuccess(result), `çözümleme başarısız: ${example.id}`).toBe(true);
      if (!isParseSuccess(result)) continue;
      expect(result.frame.valid, `beklenen geçerlilik tutmadı: ${example.id}`).toBe(example.expectedValid ?? true);
    }
  });
});

describe('çeviri anahtarları — tr ve en sözlüklerinde karşılığı var', () => {
  it('documentation.summary ve her örnek çerçevenin ad/açıklaması çevrilidir', () => {
    const keys = [
      mdioPlugin.documentation?.summary ?? '',
      ...mdioPlugin.exampleFrames.flatMap((example) => [example.name, example.description ?? '']),
    ];

    for (const key of keys.filter((key) => key.length > 0)) {
      expect(Object.hasOwn(translations.tr, key), `tr.ts eksik: ${key}`).toBe(true);
      expect(Object.hasOwn(translations.en, key), `en.ts eksik: ${key}`).toBe(true);
    }
  });

  it('hata ve uyarı anahtarları da çevrilidir', () => {
    const suffixes = [
      'error.emptyFrame',
      'error.aborted',
      'error.truncated',
      'error.invalidStart',
      'warning.invalidOpcode',
      'warning.turnaround',
      'warning.noPhyResponse',
      'warning.clause45',
      'warning.trailingBytes',
      'warning.preambleSuppressed',
    ];

    for (const suffix of suffixes) {
      const key = `protocol.mdio.${suffix}`;
      expect(Object.hasOwn(translations.tr, key), `tr.ts eksik: ${key}`).toBe(true);
      expect(Object.hasOwn(translations.en, key), `en.ts eksik: ${key}`).toBe(true);
    }
  });
});
