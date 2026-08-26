import { describe, expect, it } from 'vitest';

import { isParseSuccess } from '@/protocol-core/types';
import type { ParseResult, ParsedFrame } from '@/protocol-core/types';
import { tr } from '@/translations/tr';

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

  it('ALTI `decodeOptions` kanalı, hepsi geçerli varsayılanla', () => {
    const options = wifiPlugin.decodeOptions ?? [];
    expect(options.map((option) => option.id)).toEqual([
      'fcsPresent',
      'addressRoleDisplay',
      'qosControlPresent',
      'htControlPresent',
      'protectedPayloadDisplay',
      'vendorAddressLabels',
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

  it('ON örnek çerçeve; sekizi GERÇEK yakalamadan, ikisi türetilmiş', () => {
    expect(wifiPlugin.exampleFrames).toHaveLength(10);
    const ids = wifiPlugin.exampleFrames.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain('corrupt-fcs');
    expect(ids).toContain('four-address-wds');
    expect(ids).toContain('qos-data');
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

    const dictionary = tr as Record<string, string | undefined>;
    const missing = [...keys].filter((key) => dictionary[key] === undefined);
    expect(missing, `sözlükte olmayan anahtarlar: ${missing.join(', ')}`).toEqual([]);
  });
});

describe('gövde — 18a`da HAM kalır', () => {
  it('Beacon gövdesi 116 bayt HAM ve `bodyNotDecoded` uyarısı taşır', () => {
    const frame = decoded(example('beacon'));
    const body = fieldById(frame, 'body');
    expect(body?.offset).toBe(24);
    expect(body?.length).toBe(116);
    expect(body?.warnings).toContain('protocol.wifi.field.bodyNotDecoded');
    expect(frame.warnings.map((warning) => warning.code)).toContain('bodyNotDecoded');
    // 18b'nin işi: gövde bu dalgada ÇÖZÜLMEZ, uydurulmaz.
    expect(body?.rawValue).toBeUndefined();
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
    // Tek birim taşıyan alan Duration'dır ve o gerçekten mikrosaniyedir.
    expect([...units]).toEqual(['duration-id:µs']);
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
