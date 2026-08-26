import { describe, expect, it } from 'vitest';

import { computeNamedCrc } from '@/protocol-core/checksums/crcCatalogue';
import type { ParsedField, ProtocolError, ProtocolWarning } from '@/protocol-core/types';

import {
  IEEE802154_ADDRESS_DISPLAY_RAW,
  IEEE802154_ADDR_MODE_EXT,
  IEEE802154_ADDR_MODE_NONE,
  IEEE802154_ADDR_MODE_SHORT,
  IEEE802154_FRAME_TYPE_ACK,
  IEEE802154_FRAME_TYPE_DATA,
  IEEE802154_FRAME_VERSION_2003,
  IEEE802154_FRAME_VERSION_2006,
  IEEE802154_MIN_LENGTH,
  checkIeee802154Fcs,
  decodeIeee802154Header,
  formatEui64,
  formatIeee802154Address,
  ieee802154AddressLength,
  ieee802154HeaderLength,
  planIeee802154Addressing,
  pushIeee802154Fcs,
  readIeee802154FrameControl,
} from './ieee802154Frame';

/**
 * PAYLAŞILAN ÇEKİRDEĞİN kendi testi (Faz 10, dalga 18d, `[KARAR 18-1]`).
 *
 * Çekirdek `zigbee.ts`ten ÇIKARILDI ve iki tüketicisi var: `zigbee` (dalga 7)
 * ve `thread` (18d). `zigbee.test.ts` taşımadan sonra DEĞİŞMEDİ ve 37 testi
 * geçmeye devam ediyor — yani bu dosya davranışı ikinci kez değil, çekirdeğin
 * KENDİ yüzeyini (saf fonksiyonlar + alan basımı) sınar.
 */

const MESSAGES = {
  frameVersionUnsupported: 'test.frameVersionUnsupported',
  addressingTruncated: 'test.addressingTruncated',
  fcsMismatch: 'test.fcsMismatch',
};

/**
 * Gerçek yakalamadan (Wireshark SampleCaptures `6LoWPAN.pcap`, ZEP v2 soyulmuş)
 * bir 802.15.4 Data çerçevesi: FCF `41 cc`, dest/src 64 bit, PAN ID
 * Compression = 1 ⇒ başlık 21 B, yük dispatch `0x41` ile başlıyor.
 */
const REAL_FRAME = Uint8Array.from([
  0x41, 0xcc, 0xa4, 0xff, 0xff, 0x8a, 0x18, 0x00, 0xff, 0xff, 0xda, 0x1c, 0x00, 0x88, 0x18, 0x00,
  0xff, 0xff, 0xda, 0x1c, 0x00, 0x41, 0x60, 0x00, 0x00, 0x00, 0x00, 0x19, 0x11, 0x40, 0xfe, 0x80,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x1c, 0xda, 0xff, 0xff, 0x00, 0x18, 0x88, 0xfe, 0x80,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x1c, 0xda, 0xff, 0xff, 0x00, 0x18, 0x8a, 0x04, 0x01,
  0xf0, 0xb1, 0x00, 0x19, 0xea, 0x8a, 0x48, 0x65, 0x6c, 0x6c, 0x6f, 0x20, 0x30, 0x30, 0x33, 0x20,
  0x30, 0x78, 0x43, 0x35, 0x39, 0x41, 0x0a, 0xf9, 0x31,
]);

interface Sink {
  fields: ParsedField[];
  warnings: ProtocolWarning[];
  errors: ProtocolError[];
}

function sink(): Sink {
  return { fields: [], warnings: [], errors: [] };
}

function fieldById(fields: readonly ParsedField[], id: string): ParsedField {
  const field = fields.find((candidate) => candidate.id === id);
  if (field === undefined) throw new Error(`alan yok: ${id}`);
  return field;
}

describe('ieee802154Frame — Frame Control Field', () => {
  it('gerçek yakalamanın `41 cc` FCF\'ini bit bit çözer', () => {
    const fc = readIeee802154FrameControl(REAL_FRAME);
    expect(fc.frameType).toBe(IEEE802154_FRAME_TYPE_DATA);
    expect(fc.securityEnabled).toBe(0);
    expect(fc.framePending).toBe(0);
    expect(fc.ackRequest).toBe(0);
    expect(fc.panIdCompression).toBe(1);
    expect(fc.destAddrMode).toBe(IEEE802154_ADDR_MODE_EXT);
    expect(fc.frameVersion).toBe(IEEE802154_FRAME_VERSION_2003);
    expect(fc.srcAddrMode).toBe(IEEE802154_ADDR_MODE_EXT);
  });

  it('güvenlik biti FCF baytının 3. bitidir', () => {
    const secured = Uint8Array.from(REAL_FRAME);
    secured[0] = 0x49; // 0x41 | 0x08
    expect(readIeee802154FrameControl(secured).securityEnabled).toBe(1);
    expect(readIeee802154FrameControl(secured).frameType).toBe(IEEE802154_FRAME_TYPE_DATA);
  });

  it('Ack çerçevesinin tipi 2\'dir', () => {
    expect(readIeee802154FrameControl(Uint8Array.from([0x02, 0x00, 0x6a])).frameType).toBe(
      IEEE802154_FRAME_TYPE_ACK,
    );
  });
});

describe('ieee802154Frame — adresleme planı ve başlık uzunluğu', () => {
  it('dest + src varken PAN ID Compression kaynak PAN\'ını ELER', () => {
    const plan = planIeee802154Addressing(
      IEEE802154_ADDR_MODE_EXT,
      IEEE802154_ADDR_MODE_EXT,
      1,
      IEEE802154_FRAME_VERSION_2003,
    );
    expect(plan).toEqual({ destPanPresent: true, srcPanPresent: false, supported: true });
  });

  it('sıkıştırma yokken İKİ PAN ID de vardır', () => {
    const plan = planIeee802154Addressing(
      IEEE802154_ADDR_MODE_SHORT,
      IEEE802154_ADDR_MODE_SHORT,
      0,
      IEEE802154_FRAME_VERSION_2006,
    );
    expect(plan.destPanPresent).toBe(true);
    expect(plan.srcPanPresent).toBe(true);
  });

  it('tek taraflı adreslemede yalnız o tarafın PAN\'ı vardır', () => {
    expect(
      planIeee802154Addressing(IEEE802154_ADDR_MODE_SHORT, IEEE802154_ADDR_MODE_NONE, 0, 0),
    ).toEqual({ destPanPresent: true, srcPanPresent: false, supported: true });
    expect(
      planIeee802154Addressing(IEEE802154_ADDR_MODE_NONE, IEEE802154_ADDR_MODE_SHORT, 0, 0),
    ).toEqual({ destPanPresent: false, srcPanPresent: true, supported: true });
    expect(
      planIeee802154Addressing(IEEE802154_ADDR_MODE_NONE, IEEE802154_ADDR_MODE_NONE, 0, 0),
    ).toEqual({ destPanPresent: false, srcPanPresent: false, supported: true });
  });

  it('Frame Version 2015+ DESTEKLENMEZ — adresleme alanları basılmaz', () => {
    expect(planIeee802154Addressing(IEEE802154_ADDR_MODE_EXT, IEEE802154_ADDR_MODE_EXT, 1, 0b10))
      .toEqual({ destPanPresent: false, srcPanPresent: false, supported: false });
  });

  it('başlık uzunluğu = 3 + 2 + 8 + 8 = 21 (gerçek çerçevede ölçüldü)', () => {
    expect(ieee802154HeaderLength(REAL_FRAME)).toBe(21);
    // Aritmetik çaprazlama: 21 + 1 (dispatch) + 40 (IPv6) + 8 (UDP) + 17 + 2 = 89
    expect(21 + 1 + 40 + 8 + 17 + 2).toBe(REAL_FRAME.length);
  });

  it('ayrılmış adres kipi (0b01) ve desteklenmeyen sürüm `undefined` verir — ofset UYDURULMAZ', () => {
    const reservedDest = Uint8Array.from([0x41, 0x04, 0x00, 0x00, 0x00]);
    expect(ieee802154HeaderLength(reservedDest)).toBeUndefined();
    const reservedSrc = Uint8Array.from([0x41, 0x40, 0x00, 0x00, 0x00]);
    expect(ieee802154HeaderLength(reservedSrc)).toBeUndefined();
    const version2015 = Uint8Array.from([0x41, 0xec, 0x00, 0x00, 0x00]);
    expect(ieee802154HeaderLength(version2015)).toBeUndefined();
  });

  it('adres uzunlukları: kip 2 ⇒ 2 B, kip 3 ⇒ 8 B, ötekiler 0', () => {
    expect(ieee802154AddressLength(IEEE802154_ADDR_MODE_SHORT)).toBe(2);
    expect(ieee802154AddressLength(IEEE802154_ADDR_MODE_EXT)).toBe(8);
    expect(ieee802154AddressLength(IEEE802154_ADDR_MODE_NONE)).toBe(0);
    expect(ieee802154AddressLength(0b01)).toBe(0);
  });
});

describe('ieee802154Frame — adres biçimleme', () => {
  it('EUI-64 telde LE, ekranda TERS ve iki nokta ayraçlı', () => {
    expect(formatEui64(Uint8Array.from([0x88, 0x18, 0x00, 0xff, 0xff, 0xda, 0x1c, 0x00]))).toBe(
      '00:1C:DA:FF:FF:00:18:88',
    );
  });

  it('kısa adres LE okunup onaltılık basılır', () => {
    expect(formatIeee802154Address(IEEE802154_ADDR_MODE_SHORT, Uint8Array.from([0x78, 0x56]))).toBe(
      '0x5678',
    );
  });

  it('`raw` gösterimi HAM tel sırasını korur — ters çevirmez', () => {
    expect(
      formatIeee802154Address(
        IEEE802154_ADDR_MODE_EXT,
        Uint8Array.from([0x88, 0x18, 0x00, 0xff, 0xff, 0xda, 0x1c, 0x00]),
        IEEE802154_ADDRESS_DISPLAY_RAW,
      ),
    ).toBe('88 18 00 FF FF DA 1C 00');
  });
});

describe('ieee802154Frame — FCS (`CRC16_KERMIT` ve DÖRT sahte dostu)', () => {
  it('resmi spec §7.2.1.9 worked example: `02 00 6A` ⇒ 0x79E4', () => {
    expect(Number(computeNamedCrc(Uint8Array.from([0x02, 0x00, 0x6a]), 'CRC16_KERMIT'))).toBe(
      0x79e4,
    );
    // Aynı çerçeve FCS'iyle birlikte (LE): `02 00 6A E4 79` ⇒ PASS.
    const ack = Uint8Array.from([0x02, 0x00, 0x6a, 0xe4, 0x79]);
    expect(ack.length).toBe(IEEE802154_MIN_LENGTH);
    expect(checkIeee802154Fcs(ack)?.valid).toBe(true);
  });

  it('KERMIT\'in yayımlanmış check değeri ("123456789") 0x2189\'dur', () => {
    const check = computeNamedCrc(
      Uint8Array.from(Array.from('123456789', (c) => c.charCodeAt(0))),
      'CRC16_KERMIT',
    );
    expect(Number(check)).toBe(0x2189);
  });

  it('gerçek çerçevenin FCS\'i PASS eder ve son baytı bozulunca FAIL\'e döner', () => {
    const good = checkIeee802154Fcs(REAL_FRAME);
    expect(good?.valid).toBe(true);
    expect(good?.received).toBe(0x31f9);
    expect(good?.offset).toBe(REAL_FRAME.length - 2);

    const corrupted = Uint8Array.from(REAL_FRAME);
    corrupted[corrupted.length - 1] = (corrupted[corrupted.length - 1] ?? 0) ^ 0xff;
    expect(checkIeee802154Fcs(corrupted)?.valid).toBe(false);
  });

  it('poly 0x1021 taşıyan DÖRT sahte dost aynı baytlarda BAŞKA sonuç verir', () => {
    const body = REAL_FRAME.slice(0, REAL_FRAME.length - 2);
    const kermit = Number(computeNamedCrc(body, 'CRC16_KERMIT'));
    for (const impostor of ['CRC16_CCITT_FALSE', 'CRC16_GENIBUS', 'CRC16_XMODEM', 'CRC16_X25'] as const) {
      expect(Number(computeNamedCrc(body, impostor)), impostor).not.toBe(kermit);
    }
  });

  it('2 bayttan kısa girdide FCS okunmaz', () => {
    expect(checkIeee802154Fcs(Uint8Array.from([0x41]))).toBeUndefined();
  });
});

describe('ieee802154Frame — `decodeIeee802154Header` alan basımı', () => {
  it('gerçek çerçevede 12 alan basar ve yükün nerede başladığını söyler', () => {
    const s = sink();
    const summary = decodeIeee802154Header(REAL_FRAME, s.fields, s.warnings, s.errors, MESSAGES);

    expect(summary.frameTypeName).toBe('Data');
    expect(summary.sequenceNumber).toBe(0xa4);
    expect(summary.destPanId).toBe(0xffff);
    expect(summary.destAddress).toBe('00:1C:DA:FF:FF:00:18:8A');
    expect(summary.srcAddress).toBe('00:1C:DA:FF:FF:00:18:88');
    expect(summary.srcPanId).toBeUndefined(); // PAN ID Compression = 1
    expect(summary.payloadStart).toBe(21);
    expect(summary.payloadEnd).toBe(REAL_FRAME.length - 2);
    expect(summary.truncated).toBe(false);
    expect(s.errors).toEqual([]);

    // HAM tel baytları da döner — `thread` IID türetiminde onları kullanır.
    expect(Array.from(summary.srcAddressBytes ?? [])).toEqual([
      0x88, 0x18, 0x00, 0xff, 0xff, 0xda, 0x1c, 0x00,
    ]);

    expect(s.fields.map((field) => field.id)).toEqual([
      'mac-frame-type',
      'mac-security',
      'mac-frame-pending',
      'mac-ack-request',
      'mac-pan-id-compression',
      'mac-dest-addr-mode',
      'mac-frame-version',
      'mac-src-addr-mode',
      'mac-seq',
      'mac-dest-pan',
      'mac-dest-addr',
      'mac-src-addr',
    ]);
    // 🚨 FCS BASILMAZ — ayrı bir çağrıdır, çünkü tüketiciler onu farklı
    // SIRADA basar (`zigbee` NWK'dan önce, `thread` en sonda).
    expect(s.fields.some((field) => field.id === 'mac-fcs')).toBe(false);
  });

  it('`fcsPresent: false` yükün sonunu çerçevenin sonuna kaydırır (LINKTYPE 230)', () => {
    const s = sink();
    const summary = decodeIeee802154Header(
      REAL_FRAME,
      s.fields,
      s.warnings,
      s.errors,
      MESSAGES,
      { fcsPresent: false },
    );
    expect(summary.payloadEnd).toBe(REAL_FRAME.length);

    // Varsayılan (`zigbee`nin hiç vermediği hâl) DEĞİŞMEZ.
    const s2 = sink();
    expect(
      decodeIeee802154Header(REAL_FRAME, s2.fields, s2.warnings, s2.errors, MESSAGES).payloadEnd,
    ).toBe(REAL_FRAME.length - 2);
  });

  it('adresleme alanları FCS\'e taşarsa `truncated-frame` basar ve yükü güvenilmez sayar', () => {
    // FCF: Data, dest short, src short, sıkıştırma 1 ⇒ 9 B başlık ister;
    // çerçeve yalnız 5 B.
    const short = Uint8Array.from([0x41, 0x88, 0x01, 0x00, 0x00]);
    const s = sink();
    const summary = decodeIeee802154Header(short, s.fields, s.warnings, s.errors, MESSAGES);
    expect(summary.truncated).toBe(true);
    expect(s.errors[0]?.code).toBe('truncated-frame');
    expect(s.errors[0]?.message).toBe(MESSAGES.addressingTruncated);
  });

  it('desteklenmeyen Frame Version alan uyarısı VE çerçeve uyarısı düşürür', () => {
    const version2015 = Uint8Array.from([0x41, 0xec, 0x00, 0x00, 0x00, 0x00, 0x00]);
    const s = sink();
    const summary = decodeIeee802154Header(version2015, s.fields, s.warnings, s.errors, MESSAGES);
    expect(summary.addressing.supported).toBe(false);
    expect(fieldById(s.fields, 'mac-frame-version').warnings).toEqual([
      MESSAGES.frameVersionUnsupported,
    ]);
    expect(s.warnings.map((warning) => warning.code)).toContain(MESSAGES.frameVersionUnsupported);
    // Adresleme alanları HİÇ basılmadı.
    expect(s.fields.some((field) => field.id === 'mac-dest-addr')).toBe(false);
  });

  it('ayrılmış Frame Type (4-7) ADLANDIRILMAZ', () => {
    const reserved = Uint8Array.from([0x07, 0x00, 0x00, 0x00, 0x00]);
    const s = sink();
    const summary = decodeIeee802154Header(reserved, s.fields, s.warnings, s.errors, MESSAGES);
    expect(summary.frameTypeName).toBeUndefined();
    expect(fieldById(s.fields, 'mac-frame-type').valid).toBe(false);
    expect(fieldById(s.fields, 'mac-frame-type').physicalValue).toBeUndefined();
  });

  it('`addressDisplay: raw` adresi ters ÇEVİRMEZ', () => {
    const s = sink();
    const summary = decodeIeee802154Header(REAL_FRAME, s.fields, s.warnings, s.errors, MESSAGES, {
      addressDisplay: IEEE802154_ADDRESS_DISPLAY_RAW,
    });
    expect(summary.srcAddress).toBe('88 18 00 FF FF DA 1C 00');
  });
});

describe('ieee802154Frame — `pushIeee802154Fcs`', () => {
  it('PASS basar ve hata eklemez', () => {
    const s = sink();
    const check = pushIeee802154Fcs(REAL_FRAME, s.fields, s.errors, MESSAGES);
    expect(check?.valid).toBe(true);
    expect(fieldById(s.fields, 'mac-fcs').physicalValue).toBe('PASS');
    expect(s.errors).toEqual([]);
  });

  it('FAIL\'de `crc-mismatch` ekler ve alınan/hesaplanan değerleri taşır', () => {
    const corrupted = Uint8Array.from(REAL_FRAME);
    corrupted[corrupted.length - 1] = (corrupted[corrupted.length - 1] ?? 0) ^ 0xff;
    const s = sink();
    pushIeee802154Fcs(corrupted, s.fields, s.errors, MESSAGES);
    expect(fieldById(s.fields, 'mac-fcs').physicalValue).toBe('FAIL');
    expect(fieldById(s.fields, 'mac-fcs').valid).toBe(false);
    expect(s.errors[0]?.code).toBe('crc-mismatch');
    expect(s.errors[0]?.details).toEqual({ received: 'cef9', calculated: '31f9' });
  });
});
