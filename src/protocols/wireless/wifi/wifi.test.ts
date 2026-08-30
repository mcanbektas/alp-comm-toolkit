import { describe, expect, it } from 'vitest';

import { isParseSuccess } from '@/protocol-core/types';
import type { ParseResult, ParsedFrame } from '@/protocol-core/types';
// Tam sözlük: plugin metinleri `protocol.*` namespace'inde ve o namespace
// ayrı bir chunk (bkz. `translations/all.ts`).
import { translations } from '@/translations/all';

import { wifiParser, wifiPlugin } from './wifi';

/**
 * Faz 10 dalga 18a — `wifi` eklentisinin birim testleri.
 *
 * `dot11Frame.test.ts` MOTORU sınar; bu dosya EKLENTİYİ sınar: kanal yüzeyi,
 * gövdenin ham bırakılması, şifreli damgası, hata yolları ve çeviri
 * anahtarlarının sözlükte GERÇEKTEN var olması.
 */

function decoded(bytes: Uint8Array, options?: Record<string, unknown>): ParsedFrame {
  const result: ParseResult = wifiParser.parse(
    bytes,
    options === undefined ? undefined : { options },
  );
  if (!isParseSuccess(result)) throw new Error(`parse failed: ${result.error.code}`);
  return result.frame;
}

function example(id: string): Uint8Array {
  const found = wifiPlugin.exampleFrames.find((candidate) => candidate.id === id);
  if (found === undefined) throw new Error(`missing example: ${id}`);
  return found.bytes;
}

function fieldById(frame: ParsedFrame, id: string) {
  return frame.fields.find((candidate) => candidate.id === id);
}

describe('wifi eklentisi — kimlik ve yüzey', () => {
  it('katalogla aynı kimlik ve kategoriyi taşır', () => {
    expect(wifiPlugin.id).toBe('wifi');
    expect(wifiPlugin.name).toBe('Wi-Fi');
    expect(wifiPlugin.category).toBe('wireless-iot');
    expect(wifiParser.protocolId).toBe('wifi');
  });

  it('`build` sekmesi olmadığı için ENCODER YOKTUR', () => {
    expect(wifiPlugin.encoder).toBeUndefined();
  });

  it('ON `decodeOptions` kanalı (18a`nın altısı + 18b`nin dördü)', () => {
    const options = wifiPlugin.decodeOptions ?? [];
    expect(options.map((option) => option.id)).toEqual([
      'fcsPresent',
      'addressRoleDisplay',
      'qosControlPresent',
      'htControlPresent',
      'protectedPayloadDisplay',
      'vendorAddressLabels',
      'ieNameSet',
      'vendorIeProfile',
      'rsnSuiteLabels',
      'unknownIeDisplay',
    ]);
    for (const option of options) {
      expect(option.kind, option.id).toBe('select');
      expect(option.choices?.length ?? 0, option.id).toBeGreaterThan(1);
      expect(
        option.choices?.some((choice) => choice.value === option.defaultValue),
        option.id,
      ).toBe(true);
    }
  });

  it('ON DÖRT örnek çerçeve; onu GERÇEK yakalamadan, dördü türetilmiş', () => {
    expect(wifiPlugin.exampleFrames).toHaveLength(14);
    const ids = wifiPlugin.exampleFrames.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain('corrupt-fcs');
    expect(ids).toContain('four-address-wds');
    expect(ids).toContain('qos-data');
    // 18b'nin dördü: ikisi gerçek, ikisi türetilmiş.
    expect(ids).toContain('probe-response');
    expect(ids).toContain('association-request');
    expect(ids).toContain('broken-rsn-counter');
    expect(ids).toContain('hidden-ssid');
  });

  it('her örneğin `expectedValid` bildirimi motorun sonucuyla TUTUYOR', () => {
    for (const entry of wifiPlugin.exampleFrames) {
      const frame = decoded(entry.bytes);
      expect(frame.valid, entry.id).toBe(entry.expectedValid ?? true);
    }
  });

  it('kullanılan her çeviri anahtarı SÖZLÜKTE var', () => {
    const keys = new Set<string>();
    for (const entry of wifiPlugin.exampleFrames) {
      keys.add(entry.name);
      if (entry.description !== undefined) keys.add(entry.description);
      const frame = decoded(entry.bytes);
      for (const warning of frame.warnings) keys.add(warning.message);
      for (const error of frame.errors) keys.add(error.message);
      for (const field of frame.fields) for (const warning of field.warnings) keys.add(warning);
    }
    for (const option of wifiPlugin.decodeOptions ?? []) {
      keys.add(option.label);
      if (option.description !== undefined) keys.add(option.description);
      for (const choice of option.choices ?? []) keys.add(choice.label);
    }
    const summary = wifiPlugin.documentation?.summary;
    if (summary !== undefined) keys.add(summary);

    const dictionary = translations.tr as Record<string, string | undefined>;
    const missing = [...keys].filter((key) => dictionary[key] === undefined);
    expect(missing, `sözlükte olmayan anahtarlar: ${missing.join(', ')}`).toEqual([]);
  });
});

describe('gövde kapıları — SIRA önemli', () => {
  it('🚨 Beacon gövdesi ARTIK ÇÖZÜLÜR — tek parça ham `body` alanı KALMADI', () => {
    const frame = decoded(example('beacon'));
    // 18a'da burada 116 baytlık tek bir ham alan vardı; 18b onu sabit alanlara
    // ve element zincirine böldü. Ham alan KALIRSA gövde çözülmemiş demektir.
    expect(fieldById(frame, 'body')).toBeUndefined();
    expect(frame.warnings.map((warning) => warning.code)).not.toContain('bodyNotDecoded');
    expect(fieldById(frame, 'mgmt-timestamp')?.offset).toBe(24);
    expect(fieldById(frame, 'ie-0')?.offset).toBe(36);
    // Gövdenin SON element'i FCS'ten hemen önce biter: 24 + 12 + 104 = 140.
    const last = fieldById(frame, 'wpa-capabilities');
    expect((last?.offset ?? 0) + (last?.length ?? 0)).toBe(140);
  });

  it('Control gövdesi ÇÖZÜLMEZ — kapsam dışı, "sonraki dalga" değil', () => {
    // Control çerçevelerinde gövde zaten yok; sınırı Data çerçevesi kanıtlar.
    const frame = decoded(example('protected-data'));
    expect(fieldById(frame, 'ie-0')).toBeUndefined();
    expect(fieldById(frame, 'mgmt-capability')).toBeUndefined();
  });

  it('🚨 KORUMALI YÖNETİM çerçevesinde IE zinciri ARANMAZ', () => {
    // 802.11w korumalı yönetim çerçevesi: şifreli baytları TLV sanmak uydurma
    // element basardı. `Protected` kapısı SINIF kapısından ÖNCE gelir.
    const beacon = Uint8Array.from(example('beacon'));
    beacon[1] = (beacon[1] ?? 0) | 0x40; // Protected = 1
    const frame = decoded(beacon);
    expect(fieldById(frame, 'body')?.name).toContain('encrypted');
    expect(fieldById(frame, 'ie-0')).toBeUndefined();
    expect(frame.warnings.map((warning) => warning.code)).toContain('encryptedPayload');
  });

  it('ACK`in gövdesi YOKTUR — boş bir alan basılmaz', () => {
    const frame = decoded(example('ack'));
    expect(fieldById(frame, 'body')).toBeUndefined();
    expect(frame.warnings.map((warning) => warning.code)).not.toContain('bodyNotDecoded');
  });

  it('🚨 `Protected = 1` gövdeyi ŞİFRELİ damgasıyla bırakır — ÖTEYE İNİLMEZ', () => {
    const frame = decoded(example('protected-data'));
    const body = fieldById(frame, 'body');
    expect(body?.name).toContain('encrypted');
    expect(String(body?.physicalValue)).toContain('not decoded');
    expect(body?.warnings).toContain('protocol.wifi.field.encryptedPayload');
    expect(frame.warnings.map((warning) => warning.code)).toContain('encryptedPayload');
    // Şifreli gövdede "çözülmedi" uyarısı DEĞİL, "şifreli" uyarısı basılır.
    expect(frame.warnings.map((warning) => warning.code)).not.toContain('bodyNotDecoded');
  });

  it('`protectedPayloadDisplay` yalnız GÖSTERİMİ değiştirir, çözüm YAPMAZ', () => {
    const marked = decoded(example('protected-data'));
    const hex = decoded(example('protected-data'), { protectedPayloadDisplay: 'hex' });
    expect(String(fieldById(marked, 'body')?.physicalValue)).toContain('not decoded');
    expect(String(fieldById(hex, 'body')?.physicalValue)).toMatch(/^02 22 CD A0/);
    // İki şıkta da ham baytlar AYNI ve uyarı DURUYOR.
    expect(fieldById(hex, 'body')?.rawBytes).toEqual(fieldById(marked, 'body')?.rawBytes);
    expect(hex.warnings.map((warning) => warning.code)).toContain('encryptedPayload');
  });

  it('girdi sözleşmesi HER çözümde söylenir — radiotap kapsam dışı', () => {
    for (const entry of wifiPlugin.exampleFrames) {
      const frame = decoded(entry.bytes);
      expect(frame.warnings.map((warning) => warning.code), entry.id).toContain(
        'radiotapOutOfScope',
      );
    }
  });
});

describe('dalga 18b — tamamlanma ölçütleri EKRANDA', () => {
  it('gerçek Beacon: SSID, kanal, aralık, Privacy ve RSN`in CCMP+TKIP/PSK üçlüsü', () => {
    const frame = decoded(example('beacon'));
    expect(String(fieldById(frame, 'ie-0')?.physicalValue)).toBe('"Coherer"');
    expect(String(fieldById(frame, 'ie-3')?.physicalValue)).toBe('channel 1');
    expect(fieldById(frame, 'mgmt-beacon-interval')?.rawValue).toBe(100);
    expect(fieldById(frame, 'mgmt-beacon-interval')?.unit).toBe('TU');
    expect(fieldById(frame, 'mgmt-capability-privacy')?.rawValue).toBe(1);
    expect(String(fieldById(frame, 'rsn-pairwise-suite')?.physicalValue)).toContain('CCMP-128');
    expect(String(fieldById(frame, 'rsn-pairwise-suite-2')?.physicalValue)).toContain('TKIP');
    expect(String(fieldById(frame, 'rsn-akm-suite')?.physicalValue)).toContain('PSK');
  });

  it('aynı Beacon`ın WPA vendor IE`si AYRI ve OUI`siyle basılıyor', () => {
    const frame = decoded(example('beacon'));
    expect(String(fieldById(frame, 'ie-221-2')?.physicalValue)).toContain('00-50-F2');
    expect(String(fieldById(frame, 'wpa-akm-suite')?.physicalValue)).toContain('00-50-F2');
    // 🚨 AYNI süit numarası, FARKLI OUI: iki alan aynı metni BASMAMALI.
    expect(String(fieldById(frame, 'wpa-akm-suite')?.physicalValue)).not.toBe(
      String(fieldById(frame, 'rsn-akm-suite')?.physicalValue),
    );
  });

  it('🚨 bozuk RSN sayacı örneği UYARI + HATA basar, ÇÖKMEZ', () => {
    const entry = wifiPlugin.exampleFrames.find((item) => item.id === 'broken-rsn-counter');
    if (entry === undefined) throw new Error('missing broken-rsn-counter');
    const frame = decoded(entry.bytes);
    expect(frame.valid).toBe(false);
    expect(frame.errors.map((error) => error.code)).toContain('length-mismatch');
    expect(frame.warnings.map((warning) => warning.code)).toContain('rsnCounterOverrun');
    // Çerçevenin GERİ KALANI çözülmeye devam eder: kısmi sonuç gösterilir.
    expect(fieldById(frame, 'ie-50')).toBeDefined();
    expect(fieldById(frame, 'fcs')?.valid).toBe(true);
  });

  it('gizli SSID örneği "wildcard" der, BOŞ KART BASMAZ', () => {
    const entry = wifiPlugin.exampleFrames.find((item) => item.id === 'hidden-ssid');
    if (entry === undefined) throw new Error('missing hidden-ssid');
    const frame = decoded(entry.bytes);
    const ssid = fieldById(frame, 'ie-0');
    expect(ssid?.length).toBe(2);
    expect(String(ssid?.physicalValue)).toContain('wildcard');
    expect(ssid?.warnings).toContain('protocol.wifi.field.hiddenSsid');
    // Türetilmiş çerçevenin FCS'i motorun kendi CRC'siyle üretildi.
    expect(fieldById(frame, 'fcs')?.valid).toBe(true);
  });

  it('Auth örneğinin "Open System / seq 1 / Successful" üçlüsü', () => {
    const frame = decoded(example('authentication'));
    expect(String(fieldById(frame, 'mgmt-auth-algorithm')?.physicalValue)).toContain('Open System');
    expect(fieldById(frame, 'mgmt-auth-sequence')?.rawValue).toBe(1);
    expect(String(fieldById(frame, 'mgmt-status-code')?.physicalValue)).toContain('Successful');
  });

  it('18b`nin dört kanalı da ÇIKTIYI GERÇEKTEN değiştirir', () => {
    const base = decoded(example('beacon'));
    const noNames = decoded(example('beacon'), { ieNameSet: 'none' });
    const hidden = decoded(example('beacon'), { ieNameSet: 'none', unknownIeDisplay: 'hidden' });
    const noLabels = decoded(example('beacon'), { rsnSuiteLabels: 'hide' });
    const rawVendor = decoded(example('beacon'), { vendorIeProfile: 'raw' });

    expect(noNames.fields.length).toBeLessThan(base.fields.length);
    expect(hidden.fields.length).toBeLessThan(noNames.fields.length);
    expect(String(fieldById(noLabels, 'rsn-group-cipher')?.physicalValue)).not.toContain('TKIP');
    expect(rawVendor.warnings.map((warning) => warning.code)).toContain('vendorElementRaw');
  });
});

describe('hata yolları', () => {
  it('boş girdi `truncated-frame` ile durur ve yeniden denenebilir', () => {
    const result = wifiParser.parse(new Uint8Array(0));
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe('truncated-frame');
    expect(result.recoverable).toBe(true);
  });

  it('on bayttan kısa girdi başlık için yetersiz sayılır ama KISMİ alanlar basılır', () => {
    const frame = decoded(Uint8Array.from([0x80, 0x00, 0x00, 0x00, 0x01]));
    expect(frame.valid).toBe(false);
    expect(frame.errors.map((error) => error.code)).toContain('truncated-frame');
    // Boş kart YASAK: Frame Control yine çözülür.
    expect(fieldById(frame, 'fc-subtype')?.physicalValue).toBe('Beacon');
  });

  it('`maxFrameLength` aşılırsa `frame-too-long` ile durur', () => {
    const result = wifiParser.parse(example('beacon'), { maxFrameLength: 64 });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe('frame-too-long');
    expect(result.recoverable).toBe(false);
  });

  it('iptal edilmiş `signal` `parser-timeout` verir, exception FIRLATMAZ', () => {
    const controller = new AbortController();
    controller.abort();
    const result = wifiParser.parse(example('beacon'), { signal: controller.signal });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe('parser-timeout');
  });

  it('bozuk FCS `crc-mismatch` basar ve çerçeve KISMEN çözülmüş kalır', () => {
    const frame = decoded(example('corrupt-fcs'));
    expect(frame.valid).toBe(false);
    expect(frame.errors.map((error) => error.code)).toEqual(['crc-mismatch']);
    expect(fieldById(frame, 'fcs')?.valid).toBe(false);
    expect(fieldById(frame, 'address-1')).toBeDefined();
  });
});

describe('`ParsedFrame` sözleşmesi', () => {
  it('alanlar DÜZDÜR, ofset/uzunluk BAYT`tır ve çerçeveye sığar', () => {
    for (const entry of wifiPlugin.exampleFrames) {
      const frame = decoded(entry.bytes);
      for (const field of frame.fields) {
        expect(field.offset, `${entry.id}/${field.id}`).toBeGreaterThanOrEqual(0);
        expect(field.offset + field.length, `${entry.id}/${field.id}`).toBeLessThanOrEqual(
          entry.bytes.length,
        );
        expect(field.rawBytes.length, `${entry.id}/${field.id}`).toBe(field.length);
        expect(Array.isArray(field.warnings)).toBe(true);
      }
      // Alan kimlikleri BENZERSİZ: ikizlenmiş id iki satır çizdirirdi.
      const ids = frame.fields.map((field) => field.id);
      expect(new Set(ids).size, entry.id).toBe(ids.length);
    }
  });

  it('`unit` YALNIZ gerçek fiziksel değerde vardır', () => {
    const units = new Set<string>();
    for (const entry of wifiPlugin.exampleFrames) {
      for (const field of decoded(entry.bytes).fields) {
        if (field.unit !== undefined) units.add(`${field.id}:${field.unit}`);
      }
    }
    // Üç alan birim taşır ve ÜÇÜ DE gerçek fiziksel büyüklüktür: Duration ve
    // TSF zaman damgası mikrosaniye, Beacon Interval ise 1024 µs'lik TU.
    // Listen Interval bilerek YOKTUR — o bir SAYIMDIR, süre değil.
    expect([...units].sort()).toEqual([
      'duration-id:µs',
      'mgmt-beacon-interval:TU',
      'mgmt-timestamp:µs',
    ]);
  });

  it('`parse` SAF: aynı girdi arka arkaya aynı sonucu verir', () => {
    const first = decoded(example('beacon'));
    const second = decoded(example('beacon'));
    expect(second.fields.map((field) => field.id)).toEqual(first.fields.map((field) => field.id));
    expect(second.warnings.map((warning) => warning.code)).toEqual(
      first.warnings.map((warning) => warning.code),
    );
  });

  it('geçersiz bir kanal değeri VARSAYILANA düşer, çökmez', () => {
    const frame = decoded(example('beacon'), { addressRoleDisplay: 'nonsense' });
    expect(fieldById(frame, 'address-1')?.name).toBe('802.11 · Address 1 · DA');
  });
});
