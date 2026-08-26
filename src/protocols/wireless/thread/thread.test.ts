import { describe, expect, it } from 'vitest';

import { computeNamedCrc } from '@/protocol-core/checksums';
import type { ParsedField, ParsedFrame } from '@/protocol-core/types';

import {
  hasDispatchOnlySignature,
  hasNaiveThreadSignature,
  hasThreadSignature,
  threadParser,
  threadPlugin,
} from './thread';

/**
 * `thread` eklentisinin testi (Faz 10, dalga 18d).
 *
 * Motorun katmanları kendi dosyalarında sınanıyor (`ieee802154Frame.test.ts`,
 * `auxSecurityHeader.test.ts`, `lowpan.test.ts`, `mle.test.ts`); burada
 * sınanan ZİNCİRİN KENDİSİ: katman sırası, MIC'in yükten düşülmesi, MLE
 * kapısı, yedi kanalın BAYT DÜZEYİNDEKİ etkisi ve `canParse` sınırları.
 */

function example(id: string): Uint8Array {
  const frame = threadPlugin.exampleFrames.find((candidate) => candidate.id === id);
  if (frame === undefined) throw new Error(`örnek yok: ${id}`);
  return frame.bytes;
}

function parse(bytes: Uint8Array, options?: Record<string, unknown>): ParsedFrame {
  const result = threadParser.parse(bytes, options === undefined ? undefined : { options });
  if (!result.success) throw new Error(`çözülemedi: ${result.error.code}`);
  return result.frame;
}

function fieldById(frame: ParsedFrame, id: string): ParsedField {
  const field = frame.fields.find((candidate) => candidate.id === id);
  if (field === undefined) throw new Error(`alan yok: ${id}`);
  return field;
}

function hasField(frame: ParsedFrame, id: string): boolean {
  return frame.fields.some((field) => field.id === id);
}

function warningCodes(frame: ParsedFrame): string[] {
  return frame.warnings.map((warning) => warning.code);
}

describe('thread — eklenti yüzeyi', () => {
  it('kimlik, kategori ve sekme sözleşmesi', () => {
    expect(threadPlugin.id).toBe('thread');
    expect(threadPlugin.name).toBe('Thread');
    expect(threadPlugin.category).toBe('wireless-iot');
    expect(threadPlugin.documentation?.layer).toBe('network');
    // Katalogda `build` sekmesi YOK → encoder YAZILMAZ.
    expect(threadPlugin.encoder).toBeUndefined();
  });

  it('YEDİ kanal var — brifin sekizincisi (`iphcContext`) çürüdü', () => {
    const ids = (threadPlugin.decodeOptions ?? []).map((option) => option.id);
    expect(ids).toEqual([
      'fcsPresent',
      'securityLevelOverride',
      'mlePort',
      'dispatchProfile',
      'encryptedPayloadDisplay',
      'addressDisplay',
      'udpChecksumElided',
    ]);
    // `DecodeOption.kind` yalnız 'select' | 'number'; serbest metin kipi YOK,
    // bir IPv6 prefix'i ikisine de sığmaz (dosya başı, "KANAL YAPILMAYACAKLAR").
    expect(ids).not.toContain('iphcContext');
    for (const option of threadPlugin.decodeOptions ?? []) {
      if (option.kind === 'select') expect(option.choices?.length ?? 0).toBeGreaterThan(1);
    }
  });

  it('ON örnek çerçeve var ve HEPSİNİN FCS\'i motordan yeniden üretilebiliyor', () => {
    expect(threadPlugin.exampleFrames).toHaveLength(10);
    for (const frame of threadPlugin.exampleFrames) {
      const body = frame.bytes.slice(0, frame.bytes.length - 2);
      const calculated = Number(computeNamedCrc(body, 'CRC16_KERMIT'));
      const received =
        (frame.bytes[frame.bytes.length - 2] ?? 0) | ((frame.bytes[frame.bytes.length - 1] ?? 0) << 8);
      // Tek istisna BİLEREK bozulmuş örnektir.
      if (frame.id === 'fcs-mismatch') expect(calculated, frame.id).not.toBe(received);
      else expect(calculated, frame.id).toBe(received);
    }
  });

  it('her örnek `expectedValid` sözünü tutar', () => {
    for (const frame of threadPlugin.exampleFrames) {
      expect(parse(frame.bytes).valid, frame.id).toBe(frame.expectedValid !== false);
    }
  });

  it('girdi sözleşmesi HER çözümde söylenir (TAP/ZEP kapsam dışı)', () => {
    for (const frame of threadPlugin.exampleFrames) {
      expect(warningCodes(parse(frame.bytes)), frame.id).toContain(
        'protocol.thread.warning.linkTypeContract',
      );
    }
  });
});

describe('thread — örnek 1: sıkıştırılmamış IPv6 (GERÇEK yakalama)', () => {
  const FRAME = example('uncompressed-ipv6');

  it('üçlü aritmetik çaprazlama UYGULAMADA yeniden çözüldü', () => {
    // 21 (MAC) + 1 (dispatch) + 40 (IPv6) + 8 (UDP) + 17 (yük) + 2 (FCS)
    expect(21 + 1 + 40 + 8 + 17 + 2).toBe(FRAME.length);
    const frame = parse(FRAME);
    // IPv6 Payload Length = UDP Length = 8 + 17 = 25
    expect(fieldById(frame, 'ipv6-payload-length').rawValue).toBe(25);
    expect(fieldById(frame, 'udp-length').rawValue).toBe(25);
    expect(fieldById(frame, 'udp-payload').length).toBe(17);
  });

  it('IPv6 adresleri, UDP portları ve yük ekranda; FCS PASS', () => {
    const frame = parse(FRAME);
    expect(fieldById(frame, 'ipv6-source').rawValue).toBe('fe80::1c:daff:ff00:1888');
    expect(fieldById(frame, 'ipv6-destination').rawValue).toBe('fe80::1c:daff:ff00:188a');
    expect(fieldById(frame, 'udp-source-port').rawValue).toBe(1025);
    expect(fieldById(frame, 'udp-destination-port').rawValue).toBe(0xf0b1);
    expect(String(fieldById(frame, 'udp-payload').physicalValue)).toContain('Hello 003 0xC59A');
    expect(fieldById(frame, 'mac-fcs').physicalValue).toBe('PASS');
    expect(frame.errors).toEqual([]);
  });

  it('UDP portu MLE portu DEĞİL ⇒ MLE olarak yorumlanmaz', () => {
    const frame = parse(FRAME);
    expect(hasField(frame, 'mle-security-suite')).toBe(false);
    expect(warningCodes(frame)).toContain('protocol.thread.warning.notMlePort');
  });

  it('FCS EN SONDA basılır (`zigbee` onu NWK\'dan ÖNCE basar)', () => {
    const frame = parse(FRAME);
    expect(frame.fields[frame.fields.length - 1]?.id).toBe('mac-fcs');
  });
});

describe('thread — örnek 2/3: aynı datagram\'ın iki parçası (GERÇEK yakalama)', () => {
  it('FRAG1 ve FRAGN AYNI tag\'i taşır; FRAGN\'in offset\'i FRAG1\'in yük uzunluğudur', () => {
    const first = parse(example('fragment-first'));
    const next = parse(example('fragment-subsequent'));

    expect(fieldById(first, 'lowpan-frag-datagram-size').rawValue).toBe(265);
    expect(fieldById(next, 'lowpan-frag-datagram-size').rawValue).toBe(265);
    expect(fieldById(first, 'lowpan-frag-datagram-tag').physicalValue).toBe(2);
    expect(fieldById(next, 'lowpan-frag-datagram-tag').physicalValue).toBe(2);

    const firstPayload = fieldById(first, 'lowpan-frag-position').length;
    expect(firstPayload).toBe(96);
    expect(fieldById(next, 'lowpan-frag-datagram-offset').physicalValue).toBe(firstPayload);
  });

  it('yeniden birleştirme YAPILMAZ — konum basılır, tampon tutulmaz', () => {
    expect(warningCodes(parse(example('fragment-subsequent')))).toContain(
      'protocol.thread.warning.fragmentNotReassembled',
    );
  });
});

describe('thread — örnek 4: LOWPAN_HC1 kapsam DIŞI ama çerçeve GEÇERLİ', () => {
  const FRAME = example('lowpan-hc1');

  it('adlandırılır, ÇÖZÜLMEZ, çökmez ve UYDURMAZ', () => {
    const frame = parse(FRAME);
    expect(fieldById(frame, 'lowpan-hc1-dispatch').physicalValue).toBe('LOWPAN_HC1');
    expect(frame.valid).toBe(true); // kapsam dışı olmak BOZUK olmak değildir
    expect(frame.errors).toEqual([]);
    expect(warningCodes(frame)).toContain('protocol.thread.warning.hc1OutOfScope');
    // HC1 gövdesinden hiçbir IPv6/UDP alanı UYDURULMADI.
    expect(hasField(frame, 'ipv6-source')).toBe(false);
    expect(hasField(frame, 'udp-source-port')).toBe(false);
  });

  it('`canParse` false döner — BİLİNÇLİ kapsam kararı, yanlış negatif DEĞİL', () => {
    expect(threadParser.canParse(FRAME)).toBe(false);
    // Gerçek yakalamanın 331 çerçevesinin 33'ü bu daldaydı.
    expect(fieldById(parse(FRAME), 'mac-fcs').physicalValue).toBe('PASS');
  });
});

describe('thread — örnek 5: MLE Discovery Request (şifresiz dal)', () => {
  const FRAME = example('mle-discovery-request');

  it('Security Suite 255 ve komut 16 ekranda', () => {
    const frame = parse(FRAME);
    expect(fieldById(frame, 'mle-security-suite').rawValue).toBe(255);
    expect(fieldById(frame, 'mle-security-suite').physicalValue).toBe('No Security');
    expect(fieldById(frame, 'mle-command').rawValue).toBe(16);
    expect(fieldById(frame, 'mle-command').physicalValue).toBe('Discovery Request');
  });

  it('UDP Length yükten TÜRETİLDİ — brifin bayt dizisindeki sapma tekrarlanmıyor', () => {
    const frame = parse(FRAME);
    const declared = Number(fieldById(frame, 'udp-length').rawValue);
    const header = fieldById(frame, 'udp-source-port').offset;
    // Beyan edilen uzunluk = UDP başlığı + gerçek yük; FCS'ten önce biter.
    expect(header + declared).toBe(FRAME.length - 2);
  });

  it('IPHC adresleri MAC adreslerinden TÜRETİLDİ ve işaretlendi', () => {
    const frame = parse(FRAME);
    expect(fieldById(frame, 'iphc-source-address').rawValue).toBe('fe80::21c:daff:ff00:1888');
    expect(fieldById(frame, 'iphc-source-address').warnings).toEqual([
      'protocol.thread.warning.iidDerived',
    ]);
    expect(fieldById(frame, 'iphc-compression-saving').physicalValue).toBe(37);
  });
});

describe('thread — örnek 6: ŞİFRELİ MLE (komut tipi OKUNAMAZ)', () => {
  const FRAME = example('mle-encrypted');

  it('"şifreli MLE" damgası BASILIR; komut tipi ve MIC verdict\'i BASILMAZ', () => {
    const frame = parse(FRAME);
    expect(fieldById(frame, 'mle-security-suite').physicalValue).toBe('802.15.4 Security');
    // 🚨 Komut tipi UYDURULMAZ — alan HİÇ BASILMAZ.
    expect(hasField(frame, 'mle-command')).toBe(false);
    expect(hasField(frame, 'mle-encrypted-payload')).toBe(true);
    // 🚨 MIC PASS/FAIL BASILMAZ.
    expect(fieldById(frame, 'mle-sec-mic').physicalValue).toBeUndefined();
    expect(warningCodes(frame)).toContain(
      'protocol.thread.warning.encryptedCommandNotReadable',
    );
    expect(warningCodes(frame)).toContain('protocol.thread.warning.micNotVerifiable');
  });

  it('Auxiliary Security Header alanları çözülür (Level 5, Key Id Mode 2)', () => {
    const frame = parse(FRAME);
    expect(fieldById(frame, 'mle-sec-level').physicalValue).toBe('ENC-MIC-32');
    expect(fieldById(frame, 'mle-sec-key-id-mode').physicalValue).toBe(
      'Key Source (4 octets) + Key Index',
    );
    expect(fieldById(frame, 'mle-sec-frame-counter').rawValue).toBe(0x2a);
  });
});

describe('thread — örnek 7: MAC güvenliği ve MIC\'in yükten düşülmesi', () => {
  const FRAME = example('mac-security-mic');

  it('🚨 MIC yükün SONUNDAN düşülür; düşülmeseydi yük 4 bayt UZUN görünürdü', () => {
    const frame = parse(FRAME);
    const payload = fieldById(frame, 'mac-encrypted-payload');
    const mic = fieldById(frame, 'mac-sec-mic');
    expect(mic.length).toBe(4);
    expect(mic.offset).toBe(payload.offset + payload.length);
    // MIC + FCS çerçevenin SONUNDA durur.
    expect(mic.offset + mic.length).toBe(FRAME.length - 2);
    // Naif hesap (MIC yok sayılsa):
    expect(FRAME.length - 2 - payload.offset).toBe(payload.length + 4);
  });

  it('Level ≥ 4 ⇒ 6LoWPAN zincirine HİÇ GİRİLMEZ', () => {
    const frame = parse(FRAME);
    expect(fieldById(frame, 'mac-sec-level').physicalValue).toBe('ENC-MIC-32');
    expect(hasField(frame, 'iphc-dispatch')).toBe(false);
    expect(hasField(frame, 'lowpan-nalp-dispatch')).toBe(false);
    expect(warningCodes(frame)).toContain('protocol.thread.warning.macPayloadEncrypted');
  });

  it('alan sırası ofset sırasını izler (MIC yükten SONRA, FCS\'ten ÖNCE)', () => {
    const frame = parse(FRAME);
    const offsets = frame.fields.map((field) => field.offset);
    const macSecIndex = frame.fields.findIndex((field) => field.id === 'mac-sec-control');
    for (let i = macSecIndex; i < offsets.length - 1; i += 1) {
      expect(offsets[i] ?? 0, frame.fields[i]?.id).toBeLessThanOrEqual(offsets[i + 1] ?? 0);
    }
  });
});

describe('thread — örnek 8: Mesh başlığı ve KOŞULLU Deep Hops Left', () => {
  it('Hops Left 0xF ⇒ Deep Hops Left; adresler onun ARDINDAN başlar', () => {
    const frame = parse(example('mesh-deep-hops'));
    expect(fieldById(frame, 'lowpan-mesh-hops-left').rawValue).toBe(0x0f);
    const deep = fieldById(frame, 'lowpan-mesh-deep-hops-left');
    expect(deep.offset).toBe(22);
    expect(fieldById(frame, 'lowpan-mesh-originator').offset).toBe(deep.offset + 1);
    // Zincir mesh'ten SONRA devam eder ve MLE'ye ulaşır.
    expect(fieldById(frame, 'mle-command').physicalValue).toBe('Discovery Response');
  });
});

describe('thread — örnek 9: NHC-UDP', () => {
  it('dört bitlik portlar 0xF0Bx kalıbından kurulur, checksum DOĞRULANMAZ', () => {
    const frame = parse(example('nhc-udp-compressed'));
    expect(fieldById(frame, 'nhc-udp-ports').physicalValue).toBe('both 4-bit (0xF0Bx)');
    expect(fieldById(frame, 'udp-source-port').rawValue).toBe(0xf0b1);
    expect(fieldById(frame, 'udp-checksum').physicalValue).toBeUndefined();
    expect(String(fieldById(frame, 'udp-payload').physicalValue)).toContain('Hello NHC');
  });
});

describe('thread — örnek 10: bozuk FCS', () => {
  it('`crc-mismatch` basar, alanlar YİNE DE çözülür (kısmi sonuç)', () => {
    const frame = parse(example('fcs-mismatch'));
    expect(frame.valid).toBe(false);
    expect(frame.errors[0]?.code).toBe('crc-mismatch');
    expect(fieldById(frame, 'mac-fcs').physicalValue).toBe('FAIL');
    expect(hasField(frame, 'ipv6-source')).toBe(true);
  });
});

describe('thread — YEDİ kanalın etkisi', () => {
  it('`fcsPresent: no` son iki baytı YÜKE katar ve FCS alanını KALDIRIR', () => {
    // NHC-UDP seçildi çünkü RFC 6282 §4.3.3 UDP Length'i TELDEN SİLER: yükün
    // sonunu yalnız alt katman söyler, yani kanal gerçekten bayt taşır.
    // Sıkıştırılmamış UDP'de aynı iki bayt yüke KATILMAZ ve bu bir hata
    // değildir — orada UDP Length telde vardır ve yükü kendisi sınırlar.
    const base = parse(example('nhc-udp-compressed'));
    const noFcs = parse(example('nhc-udp-compressed'), { fcsPresent: 'no' });
    expect(hasField(base, 'mac-fcs')).toBe(true);
    expect(hasField(noFcs, 'mac-fcs')).toBe(false);
    expect(fieldById(noFcs, 'udp-payload').length).toBe(
      fieldById(base, 'udp-payload').length + 2,
    );

    const cappedByUdpLength = parse(example('uncompressed-ipv6'), { fcsPresent: 'no' });
    expect(fieldById(cappedByUdpLength, 'udp-payload').length).toBe(17);
  });

  it('`securityLevelOverride` MIC uzunluğunu ve yükün sonunu KAYDIRIR', () => {
    const auto = parse(example('mac-security-mic'));
    const forced = parse(example('mac-security-mic'), { securityLevelOverride: '6' });
    expect(fieldById(auto, 'mac-sec-mic').length).toBe(4);
    expect(fieldById(forced, 'mac-sec-mic').length).toBe(8);
    expect(fieldById(forced, 'mac-encrypted-payload').length).toBe(
      fieldById(auto, 'mac-encrypted-payload').length - 4,
    );
  });

  it('`securityLevelOverride` Level 1-3\'te yükü AÇIK sayar ve zincire GİRER', () => {
    // Level 2 (MIC-64) bütünlük-only ⇒ yük ciphertext DEĞİL.
    const forced = parse(example('mac-security-mic'), { securityLevelOverride: '2' });
    expect(hasField(forced, 'mac-encrypted-payload')).toBe(false);
    expect(fieldById(forced, 'mac-sec-mic').length).toBe(8);
    // Yükün ilk baytı (0x9F) artık bir dispatch olarak OKUNDU — zincire
    // gerçekten girildi. (Bu örnek ciphertext taşıdığı için zincir kısa sürede
    // kesiliyor; ölçülen şey girilip girilmediği.)
    expect(hasField(forced, 'lowpan-mesh-dispatch')).toBe(true);
  });

  it('`mlePort` MLE kapısıdır — MLE OLMAYAN bir yükü MLE\'ye çevirebilir', () => {
    const asMle = parse(example('uncompressed-ipv6'), { mlePort: 0xf0b1 });
    expect(hasField(asMle, 'udp-payload')).toBe(false);
    expect(fieldById(asMle, 'mle-security-suite').rawValue).toBe(0x48); // 'H'
    expect(warningCodes(asMle)).toContain('protocol.thread.warning.unknownSecuritySuite');

    // Ters yön: MLE portunu değiştirince gerçek MLE çerçevesi HAM kalır.
    const notMle = parse(example('mle-discovery-request'), { mlePort: 1 });
    expect(hasField(notMle, 'mle-command')).toBe(false);
    expect(hasField(notMle, 'udp-payload')).toBe(true);
  });

  it('`dispatchProfile` 0x7F baytının ANLAMINI değiştirir (IPHC ↔ ESC)', () => {
    const thread = parse(example('nhc-udp-compressed'));
    const rfc4944 = parse(example('nhc-udp-compressed'), { dispatchProfile: 'rfc4944-full' });
    expect(hasField(thread, 'iphc-dispatch')).toBe(true);
    expect(hasField(rfc4944, 'iphc-dispatch')).toBe(false);
    expect(fieldById(rfc4944, 'lowpan-esc-dispatch').physicalValue).toBe('ESC');
    // ESC bir EK dispatch baytı TÜKETİR — bayt düzeyinde karar.
    expect(hasField(rfc4944, 'lowpan-esc-extension')).toBe(true);
  });

  it('`dispatchProfile` HC1\'i `rfc4944-full`de MEŞRU bir başlığa çevirir', () => {
    expect(fieldById(parse(example('lowpan-hc1')), 'lowpan-hc1-dispatch').valid).toBe(false);
    expect(
      fieldById(parse(example('lowpan-hc1'), { dispatchProfile: 'rfc4944-full' }), 'lowpan-hc1-dispatch')
        .valid,
    ).toBe(true);
  });

  it('`encryptedPayloadDisplay: hex` GÖSTERİMİ değiştirir, baytları değil', () => {
    const marked = fieldById(parse(example('mle-encrypted')), 'mle-encrypted-payload');
    const hex = fieldById(
      parse(example('mle-encrypted'), { encryptedPayloadDisplay: 'hex' }),
      'mle-encrypted-payload',
    );
    expect(marked.physicalValue).toBeUndefined();
    expect(String(hex.physicalValue)).toContain('9C 4E 71 2B');
    expect(hex.length).toBe(marked.length);
  });

  it('`addressDisplay: raw` MAC adresini ters ÇEVİRMEZ', () => {
    expect(fieldById(parse(example('uncompressed-ipv6')), 'mac-src-addr').rawValue).toBe(
      '00:1C:DA:FF:FF:00:18:88',
    );
    expect(
      fieldById(parse(example('uncompressed-ipv6'), { addressDisplay: 'raw' }), 'mac-src-addr')
        .rawValue,
    ).toBe('88 18 00 FF FF DA 1C 00');
  });

  it('`udpChecksumElided: elided` NHC yükünü İKİ BAYT öne çeker', () => {
    const auto = parse(example('nhc-udp-compressed'));
    const elided = parse(example('nhc-udp-compressed'), { udpChecksumElided: 'elided' });
    expect(hasField(auto, 'udp-checksum')).toBe(true);
    expect(hasField(elided, 'udp-checksum')).toBe(false);
    expect(fieldById(elided, 'udp-payload').length).toBe(
      fieldById(auto, 'udp-payload').length + 2,
    );
  });

  it('tanınmayan seçenek değeri varsayılana DÜŞER (panel dışından gelen çöp)', () => {
    const junk = parse(example('uncompressed-ipv6'), {
      fcsPresent: 'maybe',
      mlePort: -1,
      dispatchProfile: 42,
    });
    expect(hasField(junk, 'mac-fcs')).toBe(true);
    expect(warningCodes(junk)).toContain('protocol.thread.warning.notMlePort');
  });
});

describe('thread — hata yolları', () => {
  it('boş çerçeve, çok kısa çerçeve ve azami uzunluk aşımı', () => {
    const empty = threadParser.parse(new Uint8Array(0));
    expect(empty.success).toBe(false);
    if (!empty.success) expect(empty.error.code).toBe('truncated-frame');

    const short = threadParser.parse(Uint8Array.from([0x41, 0xcc]));
    expect(short.success).toBe(false);
    if (!short.success) expect(short.error.code).toBe('truncated-frame');

    const tooLong = threadParser.parse(example('uncompressed-ipv6'), { maxFrameLength: 10 });
    expect(tooLong.success).toBe(false);
    if (!tooLong.success) expect(tooLong.error.code).toBe('frame-too-long');
  });

  it('iptal edilmiş sinyal `parser-timeout` verir', () => {
    const controller = new AbortController();
    controller.abort();
    const aborted = threadParser.parse(example('uncompressed-ipv6'), {
      signal: controller.signal,
    });
    expect(aborted.success).toBe(false);
    if (!aborted.success) expect(aborted.error.code).toBe('parser-timeout');
  });

  it('Data OLMAYAN çerçevede 6LoWPAN denenmez, yük HAM kalır', () => {
    const macCommand = Uint8Array.from(example('uncompressed-ipv6'));
    macCommand[0] = 0x43; // Frame Type = MAC Command
    const frame = parse(macCommand);
    expect(hasField(frame, 'lowpan-ipv6-dispatch')).toBe(false);
    expect(hasField(frame, 'mac-payload')).toBe(true);
    expect(warningCodes(frame)).toContain('protocol.thread.warning.nonDataFrame');
  });
});

describe('thread — `canParse` (ana brifin T4 imzası)', () => {
  it('her ZORUNLU koşul tek başına bozulunca `false` döner', () => {
    const base = example('mle-discovery-request');
    expect(hasThreadSignature(base)).toBe(true);

    // n ≥ 6
    expect(hasThreadSignature(base.slice(0, 5))).toBe(false);

    // MAC Frame Type = Data
    const beacon = Uint8Array.from(base);
    beacon[0] = 0x40;
    expect(hasThreadSignature(beacon)).toBe(false);

    // Security Enabled = 0 (dispatch baytı aux başlığının ARDINDA kalırdı)
    const secured = Uint8Array.from(base);
    secured[0] = 0x49;
    expect(hasThreadSignature(secured)).toBe(false);

    // Başlık uzunluğu ÇÖZÜLEBİLİR olmalı (ayrılmış adres kipi)
    const reservedMode = Uint8Array.from(base);
    reservedMode[1] = 0xc4;
    expect(hasThreadSignature(reservedMode)).toBe(false);

    // MAC yükünün ilk baytı bir 6LoWPAN dispatch'i olmalı
    const nalp = Uint8Array.from(base);
    nalp[21] = 0x00;
    expect(hasThreadSignature(nalp)).toBe(false);

    // FCS geçerli olmalı
    const badFcs = Uint8Array.from(base);
    badFcs[badFcs.length - 1] = (badFcs[badFcs.length - 1] ?? 0) ^ 0xff;
    expect(hasThreadSignature(badFcs)).toBe(false);
  });

  it('BEŞ dispatch dalı kabul edilir; HC1 ve BC0 EDİLMEZ', () => {
    const base = Uint8Array.from(example('mle-discovery-request'));
    const withDispatch = (dispatch: number): boolean => {
      const bytes = Uint8Array.from(base);
      bytes[21] = dispatch;
      const body = bytes.slice(0, bytes.length - 2);
      const fcs = computeNamedCrc(body, 'CRC16_KERMIT');
      bytes[bytes.length - 2] = Number(fcs & 0xffn);
      bytes[bytes.length - 1] = Number((fcs >> 8n) & 0xffn);
      return hasThreadSignature(bytes);
    };
    expect(withDispatch(0x41)).toBe(true); // uncompressed IPv6
    expect(withDispatch(0x7b)).toBe(true); // IPHC
    expect(withDispatch(0xbf)).toBe(true); // Mesh
    expect(withDispatch(0xc1)).toBe(true); // FRAG1
    expect(withDispatch(0xe1)).toBe(true); // FRAGN
    expect(withDispatch(0x42)).toBe(false); // HC1 — kapsam DIŞI
    expect(withDispatch(0x50)).toBe(false); // BC0 — tek başına çerçeve başlatmaz
    expect(withDispatch(0x00)).toBe(false); // NALP (Zigbee NWK FC baytı)
  });

  it('REDDEDİLEN naif imzalar gerçekten daha GENİŞTİR', () => {
    const hc1 = example('lowpan-hc1');
    expect(hasThreadSignature(hc1)).toBe(false);
    // T1 (yalnız MAC frame type) ve T3 (yalnız dispatch) aynı çerçeveyi ÇALARDI.
    expect(hasNaiveThreadSignature(hc1)).toBe(true);

    const zigbeeLike = Uint8Array.from([0x41, 0x88, 0x01, 0x34, 0x12, 0x00, 0x00, 0x78, 0x56, 0x00, 0x00, 0x00]);
    expect(hasNaiveThreadSignature(zigbeeLike)).toBe(true);
    expect(hasThreadSignature(zigbeeLike)).toBe(false);

    expect(hasDispatchOnlySignature(Uint8Array.from([0xc1, 0x09]))).toBe(true);
    expect(hasDispatchOnlySignature(Uint8Array.from([0x00]))).toBe(false);
  });

  it('`canParse` true olan her örnek gerçekten çözülebilir', () => {
    for (const frame of threadPlugin.exampleFrames) {
      if (!threadParser.canParse(frame.bytes)) continue;
      expect(threadParser.parse(frame.bytes).success, frame.id).toBe(true);
    }
  });
});
