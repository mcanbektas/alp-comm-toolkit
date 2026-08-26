import { describe, expect, it } from 'vitest';

import { isParseSuccess } from '@/protocol-core/types';
import type { ParsedField, ParsedFrame } from '@/protocol-core/types';
import { computeNamedCrc } from '@/protocol-core/checksums';

import {
  ESPNOW_VERSION_V2,
  PAYLOAD_SCHEMA_ASCII,
  PAYLOAD_SCHEMA_HEX,
  espNowParser,
  espNowPlugin,
} from './espNow';

function exampleBytes(id: string): Uint8Array {
  const example = espNowPlugin.exampleFrames.find((frame) => frame.id === id);
  if (example === undefined) throw new Error(`örnek bulunamadı: ${id}`);
  return example.bytes;
}

function field(frame: ParsedFrame, id: string): ParsedField {
  const found = frame.fields.find((candidate) => candidate.id === id);
  if (found === undefined) {
    throw new Error(`alan bulunamadı: ${id} (mevcut: ${frame.fields.map((f) => f.id).join(', ')})`);
  }
  return found;
}

// ── Sınır testi için minimal, PROGRAMATİK çerçeve üretici ──────────────────
// Elle hex yazmak yerine kod üretiyor: 6×250 B / 7 element gibi büyük
// sentetik senaryolar hex literal olarak okunaksız ve hataya açık olurdu.

const MAC_HEADER = new Uint8Array([
  0xd0, 0x00, 0x00, 0x00, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0x24, 0x6f, 0x28, 0xa1, 0xb2, 0xc3,
  0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0x00, 0x00,
]);
const ACTION_HEADER = new Uint8Array([0x7f, 0x18, 0xfe, 0x34, 0xde, 0xad, 0xbe, 0xef]);

function buildV2Element(bodyLength: number, moreData: boolean): Uint8Array {
  const length = 5 + bodyLength;
  if (length > 255) throw new Error('element tek bir Length baytına sığmıyor');
  const element = new Uint8Array(2 + length);
  element[0] = 0xdd; // Element ID 221 (Vendor Specific)
  element[1] = length;
  element[2] = 0x18;
  element[3] = 0xfe;
  element[4] = 0x34; // Espressif OUI
  element[5] = 0x04; // Type 4 (ESP-NOW)
  element[6] = moreData ? 0x11 : 0x01; // v2.0: Reserved 000, More data, Version 1
  element.fill(0x41, 7); // gövde 'A' ile dolduruldu — içerik önemsiz, yalnız uzunluk sınanıyor
  return element;
}

function buildFrame(elements: readonly Uint8Array[]): Uint8Array {
  const elementBytes = elements.reduce((sum, element) => sum + element.length, 0);
  const withoutFcs = new Uint8Array(MAC_HEADER.length + ACTION_HEADER.length + elementBytes);
  withoutFcs.set(MAC_HEADER, 0);
  withoutFcs.set(ACTION_HEADER, MAC_HEADER.length);
  let cursor = MAC_HEADER.length + ACTION_HEADER.length;
  for (const element of elements) {
    withoutFcs.set(element, cursor);
    cursor += element.length;
  }
  const fcs = Number(computeNamedCrc(withoutFcs, 'CRC32')) >>> 0;
  const frame = new Uint8Array(withoutFcs.length + 4);
  frame.set(withoutFcs, 0);
  frame[withoutFcs.length] = fcs & 0xff;
  frame[withoutFcs.length + 1] = (fcs >>> 8) & 0xff;
  frame[withoutFcs.length + 2] = (fcs >>> 16) & 0xff;
  frame[withoutFcs.length + 3] = (fcs >>> 24) & 0xff;
  return frame;
}

describe('espNowParser — bağlam kapıları', () => {
  it('boş çerçeve reddedilir', () => {
    const result = espNowParser.parse(new Uint8Array(0));
    expect(result.success).toBe(false);
  });

  it('AbortSignal ile iptal edilmiş çağrı reddedilir', () => {
    const controller = new AbortController();
    controller.abort();
    const result = espNowParser.parse(exampleBytes('broadcast-single-element'), {
      signal: controller.signal,
    });
    expect(result.success).toBe(false);
  });

  it('maxFrameLength aşılırsa frame-too-long döner', () => {
    const bytes = exampleBytes('unicast-two-elements');
    const result = espNowParser.parse(bytes, { maxFrameLength: bytes.length - 1 });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe('frame-too-long');
  });
});

describe('espNowParser — brifin beş türetilmiş örneği + gerçek yakalama', () => {
  it('örnek 1 — yayın, tek element, gövde "ALP Comm 18c" (ascii şeması)', () => {
    const bytes = exampleBytes('broadcast-single-element');
    expect(espNowParser.canParse(bytes)).toBe(true);

    const result = espNowParser.parse(bytes, { options: { payloadSchema: PAYLOAD_SCHEMA_ASCII } });
    expect(isParseSuccess(result)).toBe(true);
    if (!isParseSuccess(result)) return;

    expect(result.frame.valid).toBe(true);
    expect(field(result.frame, 'espnow-category').rawValue).toBe(127);
    expect(field(result.frame, 'espnow-oui').physicalValue).toBe('Espressif Systems');
    expect(field(result.frame, 'espnow-element-0-version').physicalValue).toBe('v1.0');
    expect(field(result.frame, 'espnow-element-0-body').physicalValue).toBe('"ALP Comm 18c"');
    expect(field(result.frame, 'fcs').valid).toBe(true);
    // v1.0'da More data alanı YOK — sürüm ayrımının kanıtı.
    expect(result.frame.fields.some((candidate) => candidate.id === 'espnow-element-0-more-data')).toBe(
      false,
    );
  });

  it('örnek 2 — tekli hedef, İKİ element, More data biti ayrı ayrı görünür', () => {
    const bytes = exampleBytes('unicast-two-elements');
    expect(espNowParser.canParse(bytes)).toBe(true);

    const result = espNowParser.parse(bytes, { options: { payloadSchema: PAYLOAD_SCHEMA_HEX } });
    expect(isParseSuccess(result)).toBe(true);
    if (!isParseSuccess(result)) return;

    expect(result.frame.valid).toBe(true);
    expect(field(result.frame, 'espnow-element-0-more-data').rawValue).toBe(1);
    expect(field(result.frame, 'espnow-element-1-more-data').rawValue).toBe(0);
    expect(field(result.frame, 'espnow-element-0-version').physicalValue).toBe('v2.0');

    // Çerçeve içi birleştirme: 20 B + 8 B = 28 B PAYLOAD, TEK bir "assembled"
    // alanda. `length`/`rawBytes` iki element'in ARASINDAKİ başlık baytlarını
    // da kapsayan BÖLGE sınırıdır (42 B: 27 + 15) — payload AYRIK baytlardan
    // oluştuğu için `rawValue` (yalnız 28 B'lık birleştirilmiş yük) ayrı tutulur.
    const assembled = field(result.frame, 'espnow-payload-assembled');
    expect(assembled.length).toBe(42);
    expect(assembled.rawBytes.length).toBe(42);
    expect(String(assembled.rawValue).replace(/\s/g, '').length).toBe(28 * 2);
  });

  it('örnek 3 — korumalı: canParse false, çökmez, gövde uydurulmaz', () => {
    const bytes = exampleBytes('protected');
    expect(espNowParser.canParse(bytes)).toBe(false);

    const result = espNowParser.parse(bytes);
    expect(isParseSuccess(result)).toBe(true);
    if (!isParseSuccess(result)) return;

    expect(result.frame.valid).toBe(true);
    expect(field(result.frame, 'espnow-body').physicalValue).toContain('encrypted');
    expect(result.frame.fields.some((candidate) => candidate.id.startsWith('espnow-element'))).toBe(
      false,
    );
    expect(result.frame.warnings.some((warning) => warning.code === 'encryptedPayload')).toBe(true);
  });

  it('örnek 4 — element OUI Espressif değil: uyarı basar, valid false', () => {
    const bytes = exampleBytes('foreign-vendor-oui');
    // Action ZARFININ OUI'si hâlâ Espressif — yalnız İÇERİDEKİ element'in OUI'si yabancı.
    expect(espNowParser.canParse(bytes)).toBe(true);

    const result = espNowParser.parse(bytes);
    expect(isParseSuccess(result)).toBe(true);
    if (!isParseSuccess(result)) return;

    expect(result.frame.valid).toBe(false);
    expect(result.frame.errors.some((error) => error.code === 'unsupported-encoding')).toBe(true);
    expect(result.frame.warnings.some((warning) => warning.code === 'foreignVendorElement')).toBe(true);
  });

  it('örnek 5 — element Length çerçeveyi aşıyor: uyarı basar, valid false', () => {
    const bytes = exampleBytes('truncated-element-length');
    expect(espNowParser.canParse(bytes)).toBe(true);

    const result = espNowParser.parse(bytes);
    expect(isParseSuccess(result)).toBe(true);
    if (!isParseSuccess(result)) return;

    expect(result.frame.valid).toBe(false);
    expect(result.frame.errors.some((error) => error.code === 'length-mismatch')).toBe(true);
    expect(result.frame.fields.some((candidate) => candidate.id === 'espnow-element-trailing')).toBe(
      true,
    );
  });

  it('gerçek yakalama (espressif/esp-idf#2833) — "Hello" + 4 belgesiz bayt, uydurulmadı', () => {
    const bytes = exampleBytes('real-capture-hello');
    expect(espNowParser.canParse(bytes)).toBe(true);

    const result = espNowParser.parse(bytes, { options: { payloadSchema: PAYLOAD_SCHEMA_HEX } });
    expect(isParseSuccess(result)).toBe(true);
    if (!isParseSuccess(result)) return;

    expect(result.frame.valid).toBe(true);
    expect(field(result.frame, 'espnow-element-0-body').rawValue).toBe('48 65 6C 6C 6F C7 DB 01 44');
  });

  it('tüm örnek çerçeveler expectedValid ile frame.valid eşleşir', () => {
    for (const example of espNowPlugin.exampleFrames) {
      const result = espNowParser.parse(example.bytes);
      expect(isParseSuccess(result)).toBe(true);
      if (!isParseSuccess(result)) continue;
      expect(result.frame.valid).toBe(example.expectedValid);
    }
  });
});

describe('espNowParser — decodeOptions kanalları GERÇEKTEN çıktıyı değiştiriyor', () => {
  it('unknownVendorElementDisplay: warn uyarı ekler, raw AYNI baytlarda eklemez', () => {
    const bytes = exampleBytes('foreign-vendor-oui');
    const warnResult = espNowParser.parse(bytes, { options: { unknownVendorElementDisplay: 'warn' } });
    const rawResult = espNowParser.parse(bytes, { options: { unknownVendorElementDisplay: 'raw' } });
    if (!isParseSuccess(warnResult) || !isParseSuccess(rawResult)) throw new Error('parse başarısız');

    expect(warnResult.frame.warnings.some((warning) => warning.code === 'foreignVendorElement')).toBe(
      true,
    );
    expect(rawResult.frame.warnings.some((warning) => warning.code === 'foreignVendorElement')).toBe(
      false,
    );
  });

  it('espNowVersion zorlaması: nibble 0 olsa bile v2 kabul edilir (More data alanı ÇIKAR)', () => {
    const bytes = exampleBytes('broadcast-single-element'); // doğal hâliyle nibble = 0, v1.0
    const result = espNowParser.parse(bytes, { options: { espNowVersion: ESPNOW_VERSION_V2 } });
    if (!isParseSuccess(result)) throw new Error('parse başarısız');

    expect(result.frame.fields.some((candidate) => candidate.id === 'espnow-element-0-more-data')).toBe(
      true,
    );
  });

  it('belgelenmemiş version nibble (0/1 dışı) HAM bırakılır + uyarı basılır', () => {
    const element = buildV2Element(4, false);
    element[6] = 0x25; // Reserved 001, More 0, Version nibble 5 — ne v1.0 (0) ne v2.0 (1)
    const bytes = buildFrame([element]);

    const result = espNowParser.parse(bytes);
    if (!isParseSuccess(result)) throw new Error('parse başarısız');

    expect(result.frame.warnings.some((warning) => warning.code === 'unrecognizedVersion')).toBe(true);
    expect(field(result.frame, 'espnow-element-0-version-byte').rawValue).toBe(0x25);
  });
});

describe('espNowParser — yük sınırı denetimi (programatik sentetik çerçeveler)', () => {
  it('v2.0 toplam > 1470 B ⇒ uyarı (6 element × 250 B = 1500 B, ELEMENT SAYISI sınırını aşmaz)', () => {
    const elements = Array.from({ length: 6 }, (_unused, index) => buildV2Element(250, index < 5));
    const bytes = buildFrame(elements);

    const result = espNowParser.parse(bytes);
    if (!isParseSuccess(result)) throw new Error('parse başarısız');

    expect(result.frame.warnings.some((warning) => warning.code === 'payloadOversizeV2')).toBe(true);
    expect(result.frame.warnings.some((warning) => warning.code === 'tooManyElements')).toBe(false);
  });

  it('element sayısı > 6 ⇒ uyarı (7 küçük element, toplam yük küçük)', () => {
    const elements = Array.from({ length: 7 }, (_unused, index) => buildV2Element(1, index < 6));
    const bytes = buildFrame(elements);

    const result = espNowParser.parse(bytes);
    if (!isParseSuccess(result)) throw new Error('parse başarısız');

    expect(result.frame.warnings.some((warning) => warning.code === 'tooManyElements')).toBe(true);
    expect(result.frame.warnings.some((warning) => warning.code === 'payloadOversizeV2')).toBe(false);
  });
});
