import { describe, expect, it } from 'vitest';

import {
  ethernetIiParser,
  ethernetIiPlugin,
  ieee8023Parser,
  ieee8023Plugin,
  parseEthernetFrame,
  vlan8021qParser,
  vlan8021qPlugin,
} from './ethernet';
import {
  WARN_ETHERTYPE_HIGHER_LAYER,
  WARN_FCS_OPPORTUNISTIC_MATCH,
  WARN_LOOKS_LIKE_ETHERNET_II,
  WARN_LOOKS_LIKE_IEEE_802_3,
  WARN_LOOKS_LIKE_VLAN_TAGGED,
  WARN_TOO_MANY_VLAN_TAGS,
  WARN_UNDEFINED_TYPE_LENGTH_RANGE,
  WARN_UNKNOWN_ETHERTYPE,
} from './ethernetFrame';
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

function concat(...chunks: readonly Uint8Array[]): Uint8Array {
  const length = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const result = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

const DST = Uint8Array.from([0x00, 0x1a, 0x2b, 0x3c, 0x4d, 0x5e]);
const SRC = Uint8Array.from([0x00, 0x11, 0x22, 0x33, 0x44, 0x55]);
const BROADCAST = Uint8Array.from([0xff, 0xff, 0xff, 0xff, 0xff, 0xff]);
const MULTICAST = Uint8Array.from([0x01, 0x00, 0x5e, 0x00, 0x00, 0x01]);

function ipv4Frame(destination: Uint8Array = DST): Uint8Array {
  return concat(destination, SRC, Uint8Array.from([0x08, 0x00]), Uint8Array.from([0x00, 0x01]));
}

function lengthFrame(): Uint8Array {
  return concat(DST, SRC, Uint8Array.from([0x00, 0x2e]), new Uint8Array(4));
}

function vlanTag(pcp: number, dei: number, vid: number): Uint8Array {
  const tci = ((pcp & 0x7) << 13) | ((dei & 0x1) << 12) | (vid & 0x0fff);
  return Uint8Array.from([0x81, 0x00, (tci >>> 8) & 0xff, tci & 0xff]);
}

function vlanFrame(pcp: number, dei: number, vid: number): Uint8Array {
  return concat(DST, SRC, vlanTag(pcp, dei, vid), Uint8Array.from([0x08, 0x00]), Uint8Array.from([0xaa]));
}

describe('plugin kayıtları', () => {
  const plugins = [ethernetIiPlugin, ieee8023Plugin, vlan8021qPlugin];

  it('kimlik ve kategori katalog kaydıyla eşleşir', () => {
    expect(ethernetIiPlugin.id).toBe('ethernet-ii');
    expect(ieee8023Plugin.id).toBe('ieee-802-3');
    expect(vlan8021qPlugin.id).toBe('vlan-802-1q');
    for (const plugin of plugins) {
      expect(plugin.category, plugin.id).toBe('network-ethernet');
      expect(plugin.parser?.protocolId, plugin.id).toBe(plugin.id);
      expect(plugin.exampleFrames.length, plugin.id).toBeGreaterThan(0);
    }
  });

  it('her örnek çerçeve çözülür ve expectedValid ile eşleşir', () => {
    for (const plugin of plugins) {
      const parser = plugin.parser;
      if (parser === undefined) throw new Error(`${plugin.id} has no parser`);
      for (const example of plugin.exampleFrames) {
        const result = parser.parse(example.bytes);
        if (!result.success) {
          throw new Error(`example "${example.id}" failed: ${result.error.code}`);
        }
        expect(result.frame.valid, `example "${example.id}"`).toBe(example.expectedValid ?? true);
      }
    }
  });

  it('her örnek adı/açıklaması protocol.ethernet. önekli çeviri anahtarıdır', () => {
    for (const plugin of plugins) {
      for (const example of plugin.exampleFrames) {
        expect(example.name.startsWith('protocol.ethernet.'), example.id).toBe(true);
      }
    }
  });
});

describe('MAC alanları', () => {
  it('destination/source MAC metnini AA:BB:.. biçiminde çözer', () => {
    const { frame } = expectSuccess(ethernetIiParser.parse(ipv4Frame()));
    expect(fieldById(frame, 'destination-mac').rawValue).toBe('00:1A:2B:3C:4D:5E');
    expect(fieldById(frame, 'source-mac').rawValue).toBe('00:11:22:33:44:55');
  });

  it('broadcast/multicast/unicast destination sınıflandırması yapar', () => {
    expect(
      fieldById(expectSuccess(ethernetIiParser.parse(ipv4Frame(BROADCAST))).frame, 'destination-mac')
        .physicalValue,
    ).toBe('Broadcast');
    expect(
      fieldById(expectSuccess(ethernetIiParser.parse(ipv4Frame(MULTICAST))).frame, 'destination-mac')
        .physicalValue,
    ).toBe('Multicast');
    expect(
      fieldById(expectSuccess(ethernetIiParser.parse(ipv4Frame(DST))).frame, 'destination-mac')
        .physicalValue,
    ).toBe('Unicast');
  });
});

describe('EtherType / Length ayrımı', () => {
  it('≥0x0600 EtherType olarak çözülür ve bilinen değer adlandırılır + üst katman uyarısı basar', () => {
    const { frame } = expectSuccess(ethernetIiParser.parse(ipv4Frame()));
    const ethertype = fieldById(frame, 'ethertype');
    expect(ethertype.rawValue).toBe(0x0800);
    expect(ethertype.physicalValue).toBe('IPv4');
    expect(ethertype.valid).toBe(true);
    expect(warningCodes(frame)).toContain(WARN_ETHERTYPE_HIGHER_LAYER);
  });

  it('tanınmayan EtherType alanı geçersiz işaretler ve ayrı uyarı basar', () => {
    const frameBytes = concat(DST, SRC, Uint8Array.from([0x90, 0x00]), Uint8Array.from([0x01]));
    const { frame } = expectSuccess(ethernetIiParser.parse(frameBytes));
    const ethertype = fieldById(frame, 'ethertype');
    expect(ethertype.valid).toBe(false);
    expect(ethertype.physicalValue).toBeUndefined();
    expect(warningCodes(frame)).toContain(WARN_UNKNOWN_ETHERTYPE);
    expect(warningCodes(frame)).not.toContain(WARN_ETHERTYPE_HIGHER_LAYER);
  });

  it('≤0x05DC IEEE 802.3 Length olarak çözülür (spec örneği: 0x002E → 46 bayt)', () => {
    const { frame } = expectSuccess(ieee8023Parser.parse(lengthFrame()));
    const length = fieldById(frame, 'length');
    expect(length.rawValue).toBe(0x2e);
    expect(length.physicalValue).toBe('IEEE 802.3 Payload Length = 46 bytes');
  });

  it('1501-1535 tanımsız aralığı HATA değil UYARI olarak basar, çözüm sürer', () => {
    const frameBytes = concat(DST, SRC, Uint8Array.from([0x05, 0xf0]), Uint8Array.from([0x01, 0x02]));
    const { frame } = expectSuccess(ieee8023Parser.parse(frameBytes));
    expect(frame.errors).toEqual([]);
    const field = fieldById(frame, 'type-length');
    expect(field.rawValue).toBe(0x05f0);
    expect(field.valid).toBe(false);
    expect(warningCodes(frame)).toContain(WARN_UNDEFINED_TYPE_LENGTH_RANGE);
    // Çözüm durmadı: payload yine ham bir alan olarak görünür.
    expect(hasField(frame, 'payload')).toBe(true);
  });
});

describe('VLAN 802.1Q', () => {
  it('TCI PCP/DEI/VID alanlarını ayrıştırır (spec örneği: PCP5, VID100)', () => {
    const { frame } = expectSuccess(vlan8021qParser.parse(vlanFrame(5, 0, 100)));
    expect(fieldById(frame, 'vlan-1-pcp').rawValue).toBe(5);
    expect(fieldById(frame, 'vlan-1-dei').rawValue).toBe(0);
    expect(fieldById(frame, 'vlan-1-vid').rawValue).toBe(100);
  });

  it('tag EtherType/payload offsetini 4 bayt kaydırır', () => {
    const { frame } = expectSuccess(vlan8021qParser.parse(vlanFrame(0, 0, 20)));
    // DST(6)+SRC(6)+TPID(2)+TCI(2) = 16 → iç EtherType 16'da başlar.
    expect(fieldById(frame, 'ethertype').offset).toBe(16);
    expect(fieldById(frame, 'payload').offset).toBe(18);
  });

  it('çift VLAN tag (stacking) her iki tag’i de ayrı ayrı çözer (spec örneği: Tag#1 VID100 / Tag#2 VID20)', () => {
    const bytes = concat(
      DST,
      SRC,
      vlanTag(0, 0, 100),
      vlanTag(0, 0, 20),
      Uint8Array.from([0x08, 0x00]),
      Uint8Array.from([0x01]),
    );
    const { frame } = expectSuccess(vlan8021qParser.parse(bytes));
    expect(fieldById(frame, 'vlan-1-vid').rawValue).toBe(100);
    expect(fieldById(frame, 'vlan-2-vid').rawValue).toBe(20);
    // İç EtherType 12 + 4 + 4 = 20'de.
    expect(fieldById(frame, 'ethertype').offset).toBe(20);
  });

  it('3’ten fazla iç içe tag sınırını aşınca uyarı basar ve fazlasını ham payload bırakır', () => {
    const bytes = concat(
      DST,
      SRC,
      vlanTag(0, 0, 1),
      vlanTag(0, 0, 2),
      vlanTag(0, 0, 3),
      vlanTag(0, 0, 4),
      Uint8Array.from([0x08, 0x00]),
    );
    const { frame } = expectSuccess(vlan8021qParser.parse(bytes));
    expect(hasField(frame, 'vlan-4-tpid')).toBe(false);
    expect(warningCodes(frame)).toContain(WARN_TOO_MANY_VLAN_TAGS);
    const payload = fieldById(frame, 'payload');
    // 4. tag'in TPID'i dahil her şey ham payload'a düşer.
    expect(payload.rawBytes[0]).toBe(0x81);
    expect(payload.rawBytes[1]).toBe(0x00);
  });

  it('eksik TCI truncated-frame basar ama önceki MAC alanları yine görünür', () => {
    const bytes = concat(DST, SRC, Uint8Array.from([0x81, 0x00]), Uint8Array.from([0xa0]));
    const { frame } = expectSuccess(vlan8021qParser.parse(bytes));
    expect(frame.valid).toBe(false);
    expect(frame.errors[0]?.code).toBe('truncated-frame');
    expect(hasField(frame, 'destination-mac')).toBe(true);
    expect(hasField(frame, 'source-mac')).toBe(true);
  });
});

describe('sayfa uyuşmazlığı uyarısı (CAN suggestHigherLayers emsali)', () => {
  it('IEEE 802.3 sayfasına EtherType çerçeve gelirse "Ethernet II gibi" uyarır', () => {
    const { frame } = expectSuccess(ieee8023Parser.parse(ipv4Frame()));
    expect(warningCodes(frame)).toContain(WARN_LOOKS_LIKE_ETHERNET_II);
  });

  it('Ethernet II sayfasına Length çerçeve gelirse "IEEE 802.3 gibi" uyarır', () => {
    const { frame } = expectSuccess(ethernetIiParser.parse(lengthFrame()));
    expect(warningCodes(frame)).toContain(WARN_LOOKS_LIKE_IEEE_802_3);
  });

  it('Ethernet II sayfasına VLAN tag’li çerçeve gelirse "VLAN tag’li gibi" uyarır', () => {
    const { frame } = expectSuccess(ethernetIiParser.parse(vlanFrame(0, 0, 1)));
    expect(warningCodes(frame)).toContain(WARN_LOOKS_LIKE_VLAN_TAGGED);
  });

  it('doğru sayfada uyuşmazlık uyarısı basılmaz', () => {
    const { frame } = expectSuccess(ethernetIiParser.parse(ipv4Frame()));
    expect(warningCodes(frame)).not.toContain(WARN_LOOKS_LIKE_IEEE_802_3);
    expect(warningCodes(frame)).not.toContain(WARN_LOOKS_LIKE_VLAN_TAGGED);
  });
});

describe('FCS — karar 3a: hiç varsayılmaz, fırsatçı eşleşme yalnız bilgi notu', () => {
  it('normal örnekte "FCS not captured" gösterir ve fırsatçı eşleşme YOKTUR', () => {
    const { frame } = expectSuccess(ethernetIiParser.parse(ipv4Frame()));
    const fcs = fieldById(frame, 'fcs');
    expect(fcs.physicalValue).toBe('FCS not captured');
    expect(warningCodes(frame)).not.toContain(WARN_FCS_OPPORTUNISTIC_MATCH);
  });

  it('son 4 bayt bağımsız hesaplanan CRC-32 ile eşleşince bilgi notu ekler, hata/başarı iddia etmez', () => {
    // CRC-32 (Python zlib.crc32) DST/SRC/TYPE/PAYLOAD üzerinden bağımsız hesaplandı:
    // 0x29134A3D → little-endian 3D 4A 13 29.
    const body = concat(
      Uint8Array.from([0x00, 0x12, 0x34, 0x56, 0x78, 0x9a]),
      SRC,
      Uint8Array.from([0x08, 0x00]),
      Uint8Array.from([0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08]),
    );
    const bytes = concat(body, Uint8Array.from([0x3d, 0x4a, 0x13, 0x29]));
    const { frame } = expectSuccess(ethernetIiParser.parse(bytes));
    expect(warningCodes(frame)).toContain(WARN_FCS_OPPORTUNISTIC_MATCH);
    // Hâlâ ne PASS ne FAIL: hata listesi boş, "fcs" alanı yine "not captured" der.
    expect(frame.errors).toEqual([]);
    expect(fieldById(frame, 'fcs').physicalValue).toBe('FCS not captured');
  });
});

describe('canParse — ucuz ön eleme', () => {
  it('EtherType/Length/VLAN değerlerine göre doğru sayfayı seçer', () => {
    expect(ethernetIiParser.canParse(ipv4Frame())).toBe(true);
    expect(ieee8023Parser.canParse(ipv4Frame())).toBe(false);
    expect(vlan8021qParser.canParse(ipv4Frame())).toBe(false);

    expect(ethernetIiParser.canParse(lengthFrame())).toBe(false);
    expect(ieee8023Parser.canParse(lengthFrame())).toBe(true);

    const vlan = vlanFrame(0, 0, 1);
    expect(vlan8021qParser.canParse(vlan)).toBe(true);
    expect(ethernetIiParser.canParse(vlan)).toBe(false);
    expect(ieee8023Parser.canParse(vlan)).toBe(false);
  });

  it('MIN_HEADER_LENGTH altındaki veride false döner', () => {
    const short = Uint8Array.from([0x00, 0x11, 0x22]);
    expect(ethernetIiParser.canParse(short)).toBe(false);
    expect(ieee8023Parser.canParse(short)).toBe(false);
    expect(vlan8021qParser.canParse(short)).toBe(false);
  });
});

describe('başlık/uzunluk hataları', () => {
  it('14 bayttan kısa çerçevede recoverable truncated-frame ile başarısız olur', () => {
    const short = concat(DST, Uint8Array.from([0x00, 0x11]));
    const result = expectFailure(ethernetIiParser.parse(short));
    expect(result.error.code).toBe('truncated-frame');
    expect(result.recoverable).toBe(true);
  });

  it('maxFrameLength aşılınca kurtarılamaz frame-too-long ile başarısız olur', () => {
    const result = expectFailure(
      ethernetIiParser.parse(ipv4Frame(), { maxFrameLength: 10 }),
    );
    expect(result.error.code).toBe('frame-too-long');
    expect(result.recoverable).toBe(false);
  });

  it('parseEthernetFrame kısayolu doğru protokol kimliğine bağlar', () => {
    const { frame } = expectSuccess(parseEthernetFrame(ipv4Frame(), 'ethernet-ii'));
    expect(frame.protocol).toBe('ethernet-ii');
  });
});
