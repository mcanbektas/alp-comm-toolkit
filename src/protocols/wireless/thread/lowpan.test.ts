import { describe, expect, it } from 'vitest';

import type { ParsedField, ProtocolError, ProtocolWarning } from '@/protocol-core/types';

import {
  ADDRESS_DISPLAY_EUI64,
  ADDRESS_DISPLAY_RAW,
  DISPATCH_BC0,
  DISPATCH_ESC_4944,
  DISPATCH_ESC_6282,
  DISPATCH_HC1,
  DISPATCH_IPV6,
  DISPATCH_PROFILE_RFC4944,
  DISPATCH_PROFILE_THREAD,
  IPV6_HEADER_LENGTH,
  IP_PROTOCOL_NAMES,
  UDP_CHECKSUM_AUTO,
  UDP_CHECKSUM_ELIDED,
  UDP_CHECKSUM_PRESENT,
  UDP_HEADER_LENGTH,
  decodeLowpan,
  deriveIid,
  formatIpv6,
  formatLinkAddress,
} from './lowpan';
import type { LowpanMessages, LowpanOptions } from './lowpan';

const MESSAGES: LowpanMessages = {
  truncated: 'test.truncated',
  hc1OutOfScope: 'test.hc1',
  nalp: 'test.nalp',
  escNotAllocated: 'test.esc',
  unknownDispatch: 'test.unknownDispatch',
  fragmentNotReassembled: 'test.fragment',
  contextNotOnWire: 'test.context',
  iidDerived: 'test.iid',
  reservedAddressMode: 'test.reservedAddress',
  nhcNotUdp: 'test.nhcNotUdp',
  udpChecksumNotVerified: 'test.udpChecksumNotVerified',
  udpChecksumElidedOnWire: 'test.udpChecksumElided',
};

const DEFAULT_OPTIONS: LowpanOptions = {
  dispatchProfile: DISPATCH_PROFILE_THREAD,
  udpChecksumElided: UDP_CHECKSUM_AUTO,
  addressDisplay: ADDRESS_DISPLAY_EUI64,
};

/** Gerçek yakalamanın iki EUI-64'ü, TEL sırasında (little-endian). */
const SRC_LINK = Uint8Array.from([0x88, 0x18, 0x00, 0xff, 0xff, 0xda, 0x1c, 0x00]);
const DEST_LINK = Uint8Array.from([0x8a, 0x18, 0x00, 0xff, 0xff, 0xda, 0x1c, 0x00]);

interface Sink {
  fields: ParsedField[];
  warnings: ProtocolWarning[];
  errors: ProtocolError[];
}

function run(
  bytes: readonly number[],
  options: Partial<LowpanOptions> = {},
): { sink: Sink; summary: ReturnType<typeof decodeLowpan> } {
  const data = Uint8Array.from(bytes);
  const sink: Sink = { fields: [], warnings: [], errors: [] };
  const summary = decodeLowpan(
    data,
    0,
    data.length,
    sink.fields,
    sink.warnings,
    sink.errors,
    { ...DEFAULT_OPTIONS, ...options },
    MESSAGES,
    SRC_LINK,
    DEST_LINK,
  );
  return { sink, summary };
}

function fieldById(fields: readonly ParsedField[], id: string): ParsedField {
  const field = fields.find((candidate) => candidate.id === id);
  if (field === undefined) throw new Error(`alan yok: ${id}`);
  return field;
}

describe('lowpan — biçimleme yardımcıları', () => {
  it('IPv6 en uzun sıfır dizisini `::` ile kısaltır (RFC 5952)', () => {
    expect(
      formatIpv6(
        Uint8Array.from([
          0xfe, 0x80, 0, 0, 0, 0, 0, 0, 0x02, 0x1c, 0xda, 0xff, 0xff, 0x00, 0x18, 0x88,
        ]),
      ),
    ).toBe('fe80::21c:daff:ff00:1888');
    expect(formatIpv6(new Uint8Array(16))).toBe('::');
  });

  it('bağlantı adresi: 8 B ⇒ ters EUI-64, 2 B ⇒ LE okunmuş onaltılık, `raw` ⇒ tel sırası', () => {
    expect(formatLinkAddress(SRC_LINK, ADDRESS_DISPLAY_EUI64)).toBe('00:1C:DA:FF:FF:00:18:88');
    expect(formatLinkAddress(SRC_LINK, ADDRESS_DISPLAY_RAW)).toBe('88 18 00 FF FF DA 1C 00');
    expect(formatLinkAddress(Uint8Array.from([0x34, 0x12]), ADDRESS_DISPLAY_EUI64)).toBe('0x1234');
  });

  it('IID türetimi U/L bitini ÇEVİRİR (RFC 6282 §3.2.2)', () => {
    expect(Array.from(deriveIid(SRC_LINK) ?? [])).toEqual([
      0x02, 0x1c, 0xda, 0xff, 0xff, 0x00, 0x18, 0x88,
    ]);
    // Kısa adres: `0000:00ff:fe00:XXXX`, tel LE okunup BE yazılır.
    expect(Array.from(deriveIid(Uint8Array.from([0x34, 0x12])) ?? [])).toEqual([
      0, 0, 0, 0xff, 0xfe, 0, 0x12, 0x34,
    ]);
    expect(deriveIid(Uint8Array.from([1, 2, 3]))).toBeUndefined();
  });

  it('IP protokol adları DAR ve kaynağı belli (IANA)', () => {
    expect(IP_PROTOCOL_NAMES.get(17)).toBe('UDP');
    expect(IP_PROTOCOL_NAMES.get(58)).toBe('ICMPv6');
    expect(IP_PROTOCOL_NAMES.get(200)).toBeUndefined();
  });
});

describe('lowpan — dispatch zinciri (RFC 4944 §5.1)', () => {
  it('NALP (`00xxxxxx`) 6LoWPAN çerçevesi DEĞİLDİR — zincir hemen durur', () => {
    // Zigbee NWK Frame Control baytı da yapısal olarak buraya düşer.
    const { sink, summary } = run([0x00, 0x00, 0x00, 0x00]);
    expect(summary.outOfScope).toBe('NALP');
    expect(summary.headers).toEqual(['NALP']);
    expect(fieldById(sink.fields, 'lowpan-nalp-dispatch').physicalValue).toBe('NALP');
    expect(sink.warnings.map((warning) => warning.code)).toContain(MESSAGES.nalp);
  });

  it('LOWPAN_HC1 TANINIR ama ÇÖZÜLMEZ; `thread` profilinde alan geçersiz sayılır', () => {
    const thread = run([DISPATCH_HC1, 0xfb, 0x60, 0x40]);
    expect(thread.summary.outOfScope).toBe('LOWPAN_HC1');
    expect(fieldById(thread.sink.fields, 'lowpan-hc1-dispatch').valid).toBe(false);

    // `rfc4944-full` profilinde MEŞRU bir başlık türü — yalnız çözülmüyor.
    const rfc = run([DISPATCH_HC1, 0xfb, 0x60, 0x40], {
      dispatchProfile: DISPATCH_PROFILE_RFC4944,
    });
    expect(fieldById(rfc.sink.fields, 'lowpan-hc1-dispatch').valid).toBe(true);
    expect(rfc.summary.outOfScope).toBe('LOWPAN_HC1');
  });

  it('Mesh: Hops Left `0xF` ⇒ KOŞULLU 8 bitlik Deep Hops Left alanı gelir', () => {
    // 0xBF = MESH, V = 1, F = 1, Hops Left = 0xF.
    const withDeep = run([0xbf, 0x2a, 0x12, 0x34, 0x56, 0x78, DISPATCH_IPV6]);
    expect(withDeep.summary.headers[0]).toBe('MESH');
    expect(fieldById(withDeep.sink.fields, 'lowpan-mesh-deep-hops-left').rawValue).toBe(0x2a);
    expect(fieldById(withDeep.sink.fields, 'lowpan-mesh-originator').offset).toBe(2);
    expect(fieldById(withDeep.sink.fields, 'lowpan-mesh-final-destination').offset).toBe(4);

    // 🚨 Deep Hops Left YOKSA adresler BİR BAYT ÖNCE başlar; alan atlanırsa
    // her şey sessizce kayardı.
    const withoutDeep = run([0xb5, 0x12, 0x34, 0x56, 0x78, DISPATCH_IPV6]);
    expect(
      withoutDeep.sink.fields.some((field) => field.id === 'lowpan-mesh-deep-hops-left'),
    ).toBe(false);
    expect(fieldById(withoutDeep.sink.fields, 'lowpan-mesh-originator').offset).toBe(1);
  });

  it('Mesh V/F bitleri adres genişliğini belirler (0 ⇒ 8 B, 1 ⇒ 2 B)', () => {
    // 0x83 = MESH, V = 0, F = 0, Hops Left = 3 ⇒ iki adres de 8 bayt.
    const bytes = [0x83, ...Array.from({ length: 16 }, (_unused, index) => index), DISPATCH_IPV6];
    const { sink } = run(bytes);
    expect(fieldById(sink.fields, 'lowpan-mesh-originator').length).toBe(8);
    expect(fieldById(sink.fields, 'lowpan-mesh-final-destination').length).toBe(8);
    expect(fieldById(sink.fields, 'lowpan-mesh-final-destination').offset).toBe(9);
  });

  it('LOWPAN_BC0 iki bayt tüketir ve zincir DEVAM eder', () => {
    const { sink, summary } = run([DISPATCH_BC0, 0x07, DISPATCH_HC1]);
    expect(summary.headers).toEqual(['LOWPAN_BC0', 'LOWPAN_HC1']);
    expect(fieldById(sink.fields, 'lowpan-bc0-sequence').rawValue).toBe(0x07);
  });

  it('ESC: `0x40` her iki profilde, `0x7F` YALNIZ `rfc4944-full`de ESC\'tir', () => {
    const esc6282 = run([DISPATCH_ESC_6282, 0x11]);
    expect(esc6282.summary.outOfScope).toBe('ESC');

    // `0x7F` = `011 11111` ⇒ Thread profilinde IPHC.
    const iphc = run([DISPATCH_ESC_4944, 0x33, 0xf3, 0x11, 0x12, 0x34, 0x41]);
    expect(iphc.summary.headers).toContain('IPHC');
    expect(iphc.summary.outOfScope).toBeUndefined();

    // RFC 4944 tam tablosunda AYNI bayt ESC'tir ve EK bir dispatch baytı yer.
    const esc4944 = run([DISPATCH_ESC_4944, 0x33, 0xf3], {
      dispatchProfile: DISPATCH_PROFILE_RFC4944,
    });
    expect(esc4944.summary.outOfScope).toBe('ESC');
    expect(fieldById(esc4944.sink.fields, 'lowpan-esc-extension').rawValue).toBe(0x33);
  });

  it('tanınmayan dispatch UYDURULMAZ', () => {
    const { sink, summary } = run([0x5a, 0x00]);
    expect(summary.outOfScope).toBe('unknown');
    expect(fieldById(sink.fields, 'lowpan-unknown-dispatch').valid).toBe(false);
  });
});

describe('lowpan — FRAG1 / FRAGN (RFC 4944 §5.3)', () => {
  const FRAG1 = [0xc1, 0x09, 0x00, 0x02];
  const FRAGN = [0xe1, 0x09, 0x00, 0x02, 0x0c];

  it('FRAG1: datagram_size 11 bit, tag 16 bit, başlık 4 B', () => {
    const { sink, summary } = run([...FRAG1, DISPATCH_HC1, 0x00, 0x00]);
    expect(summary.fragment).toEqual({
      datagramSize: 265,
      datagramTag: 2,
      datagramOffset: 0,
      first: true,
    });
    expect(fieldById(sink.fields, 'lowpan-frag-datagram-size').rawValue).toBe(265);
    expect(fieldById(sink.fields, 'lowpan-frag-position').offset).toBe(4);
    // FRAG1'in yükü datagram'ın BAŞLIK yığınıdır — zincir DEVAM eder.
    expect(summary.headers).toEqual(['FRAG1', 'LOWPAN_HC1']);
  });

  it('🚨 FRAGN: `datagram_offset` 8 OKTET KATIDIR — çarpılmazsa sekiz kat sıkışır', () => {
    const { sink, summary } = run([...FRAGN, 0xaa, 0xbb]);
    expect(summary.fragment?.datagramOffset).toBe(96);
    const field = fieldById(sink.fields, 'lowpan-frag-datagram-offset');
    expect(field.rawValue).toBe(0x0c);
    expect(field.physicalValue).toBe(96);
    expect(0x0c * 8).toBe(96);
    // FRAGN'in yükü bir PARÇADIR; başlık taşımaz, zincir orada durur.
    expect(summary.headers).toEqual(['FRAGN']);
  });

  it('yeniden birleştirme YAPILMAZ — konum basılır, tampon tutulmaz', () => {
    const { sink } = run([...FRAGN, ...Array.from({ length: 10 }, () => 0x55)]);
    const position = fieldById(sink.fields, 'lowpan-frag-position');
    expect(position.rawValue).toBe('96..106 / 265');
    expect(position.warnings).toEqual([MESSAGES.fragmentNotReassembled]);
  });

  it('parça başlığı çerçeveye sığmazsa `truncated-frame` basar', () => {
    const { sink } = run([0xc1, 0x09]);
    expect(sink.errors[0]?.code).toBe('truncated-frame');
  });
});

describe('lowpan — sıkıştırılmamış IPv6 (dispatch 0x41)', () => {
  const IPV6_UDP = [
    DISPATCH_IPV6,
    0x60, 0x00, 0x00, 0x00, // version/TC/FL
    0x00, 0x09, // payload length = 9
    0x11, // next header = UDP
    0x40, // hop limit = 64
    ...Array.from({ length: 16 }, (_unused, index) => index), // source
    ...Array.from({ length: 16 }, (_unused, index) => 0x20 + index), // destination
    0x4d, 0x4c, 0x4d, 0x4c, 0x00, 0x09, 0xab, 0xcd, // UDP: 19788/19788, len 9
    0x42, // 1 baytlık yük
  ];

  it('40 baytlık IPv6 başlığı + 8 baytlık UDP çözülür ve yük konumu türetilir', () => {
    const { sink, summary } = run(IPV6_UDP);
    expect(summary.headers).toEqual(['IPv6']);
    expect(fieldById(sink.fields, 'ipv6-version').rawValue).toBe(6);
    expect(fieldById(sink.fields, 'ipv6-payload-length').rawValue).toBe(9);
    expect(fieldById(sink.fields, 'ipv6-next-header').physicalValue).toBe('UDP');
    expect(fieldById(sink.fields, 'ipv6-hop-limit').rawValue).toBe(64);
    expect(fieldById(sink.fields, 'ipv6-source').offset).toBe(1 + 8);
    expect(fieldById(sink.fields, 'ipv6-destination').offset).toBe(1 + 24);

    expect(summary.udp?.sourcePort).toBe(19788);
    expect(summary.udp?.destinationPort).toBe(19788);
    // 1 (dispatch) + 40 + 8 = 49
    expect(summary.udp?.payloadStart).toBe(1 + IPV6_HEADER_LENGTH + UDP_HEADER_LENGTH);
    // UDP Length telde VAR; yükün sonu ondan türetilir (9 - 8 = 1 bayt).
    expect(summary.udp?.payloadEnd).toBe((summary.udp?.payloadStart ?? 0) + 1);
    // Checksum DOĞRULANMAZ — kapsam IPv6 sözde başlığıdır.
    expect(fieldById(sink.fields, 'udp-checksum').warnings).toEqual([
      MESSAGES.udpChecksumNotVerified,
    ]);
    expect(fieldById(sink.fields, 'udp-checksum').physicalValue).toBeUndefined();
  });

  it('IPv6 başlığı çerçeveye sığmazsa `truncated-frame` basar', () => {
    const { sink } = run([DISPATCH_IPV6, 0x60, 0x00]);
    expect(sink.errors[0]?.code).toBe('truncated-frame');
  });
});

describe('lowpan — LOWPAN_IPHC (RFC 6282 §3.1)', () => {
  it('`7b 33` on bit alanını çözer: TF 11, NH 0, HLIM 11, SAM/DAM 11', () => {
    const { sink, summary } = run([0x7b, 0x33, 0x11, 0x4d, 0x4c, 0x4d, 0x4c, 0x00, 0x09, 0, 0, 0x42]);
    expect(summary.headers).toEqual(['IPHC']);
    expect(fieldById(sink.fields, 'iphc-tf').physicalValue).toBe('elided');
    expect(fieldById(sink.fields, 'iphc-nh').rawValue).toBe(0);
    expect(fieldById(sink.fields, 'iphc-hlim').physicalValue).toBe('255');
    expect(fieldById(sink.fields, 'iphc-sam').rawValue).toBe(3);
    expect(fieldById(sink.fields, 'iphc-dam').rawValue).toBe(3);
    expect(fieldById(sink.fields, 'iphc-next-header').physicalValue).toBe('UDP');
  });

  it('SAM/DAM = 11 ⇒ adres TÜRETİLİR ve `iidDerived` ile İŞARETLENİR', () => {
    const { sink } = run([0x7b, 0x33, 0x11, 0x4d, 0x4c, 0x4d, 0x4c, 0x00, 0x08]);
    const source = fieldById(sink.fields, 'iphc-source-address');
    const destination = fieldById(sink.fields, 'iphc-destination-address');
    expect(source.length).toBe(0);
    expect(source.rawValue).toBe('fe80::21c:daff:ff00:1888');
    expect(source.warnings).toEqual([MESSAGES.iidDerived]);
    expect(destination.rawValue).toBe('fe80::21c:daff:ff00:188a');
  });

  it('TF alanının bayt uzunluğu 00/01/10/11 ⇒ 4/3/1/0\'dır', () => {
    const lengths = [0, 1, 2, 3].map((tf) => {
      const b0 = 0x60 | (tf << 3) | 0x03; // NH = 0, HLIM = 11
      const { sink } = run([b0, 0x33, ...Array.from({ length: 4 }, () => 0x00), 0x11]);
      return sink.fields.find((field) => field.id === 'iphc-traffic-flow')?.length ?? 0;
    });
    expect(lengths).toEqual([4, 3, 1, 0]);
  });

  it('HLIM = 00 ⇒ satır içi Hop Limit baytı; CID = 1 ⇒ Context Identifier Extension baytı', () => {
    // b0 = 0x60 | TF 11 (0x18) | NH 0 | HLIM 00 = 0x78; b1 = 0xB3 ⇒ CID 1, SAM/DAM 11.
    const { sink } = run([0x78, 0xb3, 0x12, 0x11, 0x40, 0x00]);
    expect(fieldById(sink.fields, 'iphc-source-context').rawValue).toBe(1);
    expect(fieldById(sink.fields, 'iphc-destination-context').rawValue).toBe(2);
    expect(fieldById(sink.fields, 'iphc-hop-limit').rawValue).toBe(0x40);
  });

  it('🚨 SAC/DAC = 1 ⇒ bağlam tablosu TELDE YOK; adres KURULMAZ, uyarı düşer', () => {
    // b1 = 0x77 ⇒ SAC 1, SAM 11 (bağlam tabanlı), M 0, DAC 1, DAM 11.
    const { sink } = run([0x7b, 0x77, 0x11, 0x4d, 0x4c, 0x4d, 0x4c, 0x00, 0x08]);
    expect(fieldById(sink.fields, 'iphc-source-address').warnings).toEqual([
      MESSAGES.contextNotOnWire,
    ]);
    expect(sink.warnings.map((warning) => warning.code)).toContain(MESSAGES.contextNotOnWire);
  });

  it('SAC = 1 + SAM = 00 tanımlı tek istisnadır: adres `::`', () => {
    const { sink } = run([0x7b, 0x43, 0x11, 0x4d, 0x4c, 0x4d, 0x4c, 0x00, 0x08]);
    expect(fieldById(sink.fields, 'iphc-source-address').rawValue).toBe('::');
  });

  it('M = 1 çoklu yayın adresini RFC 6282 kalıbından kurar (DAM 11 ⇒ ff02::00XX)', () => {
    // b1 = 0x3B ⇒ SAM 11, M 1, DAC 0, DAM 11 ⇒ 1 bayt satır içi.
    const { sink } = run([0x7b, 0x3b, 0x11, 0x01, 0x4d, 0x4c, 0x4d, 0x4c, 0x00, 0x08]);
    expect(fieldById(sink.fields, 'iphc-destination-address').rawValue).toBe('ff02::1');
  });

  it('M = 0 + DAC = 1 + DAM = 00 REZERVEDİR — alan geçersiz sayılır', () => {
    const { sink } = run([0x7b, 0x34, 0x11, 0x4d, 0x4c, 0x4d, 0x4c, 0x00, 0x08]);
    const destination = fieldById(sink.fields, 'iphc-destination-address');
    expect(destination.valid).toBe(false);
    expect(destination.warnings).toEqual([MESSAGES.reservedAddressMode]);
  });

  it('sıkıştırma kazancı katalogun "Compression Saving" aracıdır', () => {
    const { sink } = run([0x7b, 0x33, 0x11, 0x4d, 0x4c, 0x4d, 0x4c, 0x00, 0x08]);
    const saving = fieldById(sink.fields, 'iphc-compression-saving');
    expect(saving.rawValue).toBe(3); // dispatch 2 B + next header 1 B
    expect(saving.physicalValue).toBe(IPV6_HEADER_LENGTH - 3);
  });
});

describe('lowpan — LOWPAN_NHC UDP (RFC 6282 §4)', () => {
  it('dört port sıkıştırma kipi doğru bayt sayısı tüketir', () => {
    // PP = 00 — iki port da 16 bit satır içi.
    const both16 = run([0x7f, 0x33, 0xf0, 0x4d, 0x4c, 0x4d, 0x4c, 0x12, 0x34, 0x42]);
    expect(both16.summary.udp?.sourcePort).toBe(19788);
    expect(both16.summary.udp?.destinationPort).toBe(19788);
    expect(both16.summary.udp?.payloadStart).toBe(9);

    // PP = 01 — hedef 8 bit (0xF0xx).
    const dest8 = run([0x7f, 0x33, 0xf1, 0x4d, 0x4c, 0xb1, 0x12, 0x34, 0x42]);
    expect(dest8.summary.udp?.destinationPort).toBe(0xf0b1);

    // PP = 10 — kaynak 8 bit.
    const source8 = run([0x7f, 0x33, 0xf2, 0xb1, 0x4d, 0x4c, 0x12, 0x34, 0x42]);
    expect(source8.summary.udp?.sourcePort).toBe(0xf0b1);
    expect(source8.summary.udp?.destinationPort).toBe(19788);

    // PP = 11 — iki port da 4 bit (0xF0Bx), TEK bayt.
    const both4 = run([0x7f, 0x33, 0xf3, 0x12, 0x12, 0x34, 0x42]);
    expect(both4.summary.udp?.sourcePort).toBe(0xf0b1);
    expect(both4.summary.udp?.destinationPort).toBe(0xf0b2);
  });

  it('🚨 `C` biti checksum\'ı eler ve yükün başlangıcını İKİ BAYT kaydırır', () => {
    // NHC 0xF7 = C 1 (elenmiş), PP 11.
    const elided = run([0x7f, 0x33, 0xf7, 0x12, 0x42, 0x43]);
    expect(elided.summary.udp?.payloadStart).toBe(4);
    expect(elided.sink.fields.some((field) => field.id === 'udp-checksum')).toBe(false);
    expect(elided.sink.warnings.map((warning) => warning.code)).toContain(
      MESSAGES.udpChecksumElidedOnWire,
    );

    const present = run([0x7f, 0x33, 0xf3, 0x12, 0x42, 0x43]);
    expect(present.summary.udp?.payloadStart).toBe(6);
  });

  it('`udpChecksumElided` kanalı telin `C` bitini EZER — bayt düzeyinde karar', () => {
    const forcedPresent = run([0x7f, 0x33, 0xf7, 0x12, 0x42, 0x43], {
      udpChecksumElided: UDP_CHECKSUM_PRESENT,
    });
    expect(forcedPresent.summary.udp?.payloadStart).toBe(6);
    expect(
      forcedPresent.sink.fields.some((field) => field.id === 'udp-checksum'),
    ).toBe(true);

    const forcedElided = run([0x7f, 0x33, 0xf3, 0x12, 0x42, 0x43], {
      udpChecksumElided: UDP_CHECKSUM_ELIDED,
    });
    expect(forcedElided.summary.udp?.payloadStart).toBe(4);
  });

  it('NHC var ama UDP değilse (genişletme başlığı) zincir DURUR, gövde ÇÖZÜLMEZ', () => {
    const { sink, summary } = run([0x7f, 0x33, 0xe0, 0x11, 0x00]);
    expect(summary.udp).toBeUndefined();
    expect(fieldById(sink.fields, 'nhc-dispatch').warnings).toEqual([MESSAGES.nhcNotUdp]);
  });
});
