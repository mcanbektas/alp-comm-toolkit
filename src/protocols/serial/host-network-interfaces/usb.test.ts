import { describe, expect, it } from 'vitest';

import { isParseSuccess } from '@/protocol-core/types';
import { translations } from '@/translations/all';

import { parseUsb, usbParser, usbPlugin } from './usb';
import type { UsbFrameMetadata } from './usb';
import { buildDataPacket, buildSofPacket, buildTokenPacket, USB_PID_BYTES } from './usbPacket';

function parseOrThrow(bytes: Uint8Array) {
  const result = parseUsb(bytes);
  if (!isParseSuccess(result)) throw new Error(`çözümleme başarısız: ${result.error.message}`);
  return result.frame;
}

describe('USB eklentisi — kimlik ve sözleşme', () => {
  it('katalog kaydının pluginId değeriyle aynı id taşır', () => {
    expect(usbPlugin.id).toBe('usb');
    expect(usbPlugin.category).toBe('interfaces-framing');
    expect(usbPlugin.documentation?.layer).toBe('multi-layer');
  });

  it('boş arabellek kendi çeviri anahtarıyla hata verir', () => {
    const result = parseUsb(new Uint8Array(0));
    expect(isParseSuccess(result)).toBe(false);
    if (isParseSuccess(result)) return;
    expect(result.error.message).toBe('protocol.usb.error.emptyFrame');
  });

  it('iptal edilmiş signal ile çözümleme yapılmaz', () => {
    const controller = new AbortController();
    controller.abort();
    const result = usbParser.parse(Uint8Array.from([USB_PID_BYTES.ACK]), { signal: controller.signal });
    expect(isParseSuccess(result)).toBe(false);
    if (isParseSuccess(result)) return;
    expect(result.error.code).toBe('parser-timeout');
  });

  it('canParse PID check alanına bakar — imzası olmayan bayt reddedilir', () => {
    expect(usbParser.canParse(Uint8Array.from([USB_PID_BYTES.SETUP]))).toBe(true);
    expect(usbParser.canParse(Uint8Array.from([0x2c]))).toBe(false);
    expect(usbParser.canParse(new Uint8Array(0))).toBe(false);
  });
});

describe('paket çözümü — alan tablosu', () => {
  it('SETUP token paketini PID/Address/Endpoint/CRC5 alanlarına ayırır', () => {
    const frame = parseOrThrow(buildTokenPacket(USB_PID_BYTES.SETUP, 0, 0));
    const ids = frame.fields.map((field) => field.id);

    expect(ids).toEqual(['pid', 'address', 'endpoint', 'crc5']);
    expect(frame.valid).toBe(true);
    expect((frame.rawFrame.metadata as UsbFrameMetadata).pid).toBe('SETUP');
    expect(frame.fields[0]?.physicalValue).toContain('check OK');
    expect(frame.fields[1]?.physicalValue).toContain('default address');
  });

  it('IN token adres ve endpoint değerlerini doğru okur', () => {
    const frame = parseOrThrow(buildTokenPacket(USB_PID_BYTES.IN, 0x3a, 0x0a));
    const metadata = frame.rawFrame.metadata as UsbFrameMetadata;
    expect(metadata).toMatchObject({ pid: 'IN', address: 0x3a, endpoint: 0x0a, crcValid: true });
  });

  it('SOF paketinde frame number alanı çıkar', () => {
    const frame = parseOrThrow(buildSofPacket(USB_PID_BYTES.SOF, 0x64));
    expect(frame.fields.map((field) => field.id)).toEqual(['pid', 'frameNumber', 'crc5']);
    expect((frame.rawFrame.metadata as UsbFrameMetadata).frameNumber).toBe(0x64);
  });

  it('handshake paketi tek PID alanıdır', () => {
    const frame = parseOrThrow(Uint8Array.from([USB_PID_BYTES.NAK]));
    expect(frame.fields).toHaveLength(1);
    expect((frame.rawFrame.metadata as UsbFrameMetadata).pidGroup).toBe('handshake');
  });

  it('PID check alanı bozuksa yapısal çözüm gösterilir ama frame geçersizdir', () => {
    // 0x2C: SETUP tipinin check alanı bozulmuş hâli.
    const frame = parseOrThrow(Uint8Array.from([0x2c, 0x00, 0x10]));
    expect(frame.valid).toBe(false);
    expect(frame.errors[0]?.message).toBe('protocol.usb.error.pidCheckFailed');
    expect(frame.fields[0]?.valid).toBe(false);
  });

  it('bozuk CRC5 frame-level hata üretir, alanlar yine dolar', () => {
    const packet = buildTokenPacket(USB_PID_BYTES.OUT, 0x12, 0x03);
    packet[2] = (packet[2] ?? 0) ^ 0x80;
    const frame = parseOrThrow(packet);

    expect(frame.valid).toBe(false);
    expect(frame.errors[0]?.message).toBe('protocol.usb.error.crc5Mismatch');
    expect(frame.fields.some((field) => field.id === 'address')).toBe(true);
  });

  it('bozuk CRC16 frame-level hata üretir', () => {
    const packet = buildDataPacket(USB_PID_BYTES.DATA0, Uint8Array.from([0x01, 0x02, 0x03]));
    packet[packet.length - 1] = (packet[packet.length - 1] ?? 0) ^ 0xff;
    const frame = parseOrThrow(packet);

    expect(frame.valid).toBe(false);
    expect(frame.errors[0]?.message).toBe('protocol.usb.error.crc16Mismatch');
  });

  it('token 3 bayttan kısaysa truncated hatası verilir', () => {
    const frame = parseOrThrow(Uint8Array.from([USB_PID_BYTES.OUT, 0x05]));
    expect(frame.errors.some((error) => error.message === 'protocol.usb.error.tokenTruncated')).toBe(true);
  });

  it('fazladan baytlar sessizce kaybolmaz, kendi alanına ve uyarısına düşer', () => {
    const frame = parseOrThrow(Uint8Array.from([USB_PID_BYTES.ACK, 0xaa, 0xbb]));
    const trailing = frame.fields.find((field) => field.id === 'trailing');

    expect(trailing).toBeDefined();
    expect([...(trailing?.rawBytes ?? [])]).toEqual([0xaa, 0xbb]);
    expect(frame.warnings.some((warning) => warning.code === 'trailing-bytes')).toBe(true);
  });

  it('alanlar ofset sırasında basılır (11i tuzağı)', () => {
    const frame = parseOrThrow(
      buildDataPacket(USB_PID_BYTES.DATA0, Uint8Array.from([0x80, 0x06, 0x00, 0x01, 0x00, 0x00, 0x12, 0x00])),
    );
    const offsets = frame.fields.map((field) => field.offset);
    expect([...offsets].sort((left, right) => left - right)).toEqual(offsets);
  });
});

describe('yük çıkarımı — kesinlik iddia edilmez', () => {
  it('8 baytlık yük SETUP isteği olarak açılır ve uyarıyla işaretlenir', () => {
    const frame = parseOrThrow(
      buildDataPacket(USB_PID_BYTES.DATA0, Uint8Array.from([0x80, 0x06, 0x00, 0x01, 0x00, 0x00, 0x12, 0x00])),
    );

    const ids = frame.fields.map((field) => field.id);
    expect(ids).toContain('bmRequestType');
    expect(ids).toContain('wLength');
    expect(frame.warnings.some((warning) => warning.code === 'setup-inferred')).toBe(true);
    expect((frame.rawFrame.metadata as UsbFrameMetadata).setupRequest).toBe('GET_DESCRIPTOR');
  });

  it('tanımlayıcı zinciri alanlara açılır ve uyarıyla işaretlenir', () => {
    const descriptor = Uint8Array.from([
      0x12, 0x01, 0x00, 0x02, 0x02, 0x00, 0x00, 0x40, 0x83, 0x04, 0x40, 0x57, 0x00, 0x02, 0x01,
      0x02, 0x03, 0x01,
    ]);
    const frame = parseOrThrow(buildDataPacket(USB_PID_BYTES.DATA1, descriptor));

    const vendor = frame.fields.find((field) => field.id === 'descriptor0.idVendor');
    expect(vendor?.physicalValue).toBe('0x0483');
    expect(frame.warnings.some((warning) => warning.code === 'descriptor-inferred')).toBe(true);
    expect((frame.rawFrame.metadata as UsbFrameMetadata).descriptorTypes).toEqual(['DEVICE']);
  });

  it('ham veri yükü ne SETUP ne tanımlayıcı sayılır', () => {
    const frame = parseOrThrow(buildDataPacket(USB_PID_BYTES.DATA0, Uint8Array.from([0xde, 0xad, 0xbe])));
    expect(frame.warnings).toHaveLength(0);
    expect(frame.fields.map((field) => field.id)).toEqual(['pid', 'payload', 'crc16']);
  });

  it('özel PID (PING/SPLIT/PRE-ERR) uyarıyla işaretlenir, alanı uydurulmaz', () => {
    const frame = parseOrThrow(Uint8Array.from([USB_PID_BYTES.PING, 0x00, 0x10]));
    expect(frame.warnings.some((warning) => warning.code === 'special-pid')).toBe(true);
  });
});

describe('örnek çerçeveler', () => {
  it('her örnek beklenen geçerlilikle çözümlenir', () => {
    for (const example of usbPlugin.exampleFrames) {
      const result = parseUsb(example.bytes);
      expect(isParseSuccess(result), `çözümleme başarısız: ${example.id}`).toBe(true);
      if (!isParseSuccess(result)) continue;
      expect(result.frame.valid, `beklenen geçerlilik tutmadı: ${example.id}`).toBe(
        example.expectedValid ?? true,
      );
    }
  });

  it('configuration örneği dört tanımlayıcı taşır', () => {
    const example = usbPlugin.exampleFrames.find((item) => item.id === 'configuration-descriptor');
    const frame = parseOrThrow(example?.bytes ?? new Uint8Array(0));
    expect((frame.rawFrame.metadata as UsbFrameMetadata).descriptorTypes).toEqual([
      'CONFIGURATION',
      'INTERFACE',
      'ENDPOINT',
      'ENDPOINT',
    ]);
  });
});

describe('çeviri anahtarları — tr ve en sözlüklerinde karşılığı var', () => {
  it('documentation.summary ve her örnek çerçevenin ad/açıklaması çevrilidir', () => {
    const keys = [
      usbPlugin.documentation?.summary ?? '',
      ...usbPlugin.exampleFrames.flatMap((example) => [example.name, example.description ?? '']),
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
      'error.pidCheckFailed',
      'error.crc5Mismatch',
      'error.crc16Mismatch',
      'error.tokenTruncated',
      'warning.setupInferred',
      'warning.descriptorInferred',
      'warning.trailingBytes',
      'warning.reservedPid',
      'warning.specialPid',
    ];

    for (const suffix of suffixes) {
      const key = `protocol.usb.${suffix}`;
      expect(Object.hasOwn(translations.tr, key), `tr.ts eksik: ${key}`).toBe(true);
      expect(Object.hasOwn(translations.en, key), `en.ts eksik: ${key}`).toBe(true);
    }
  });
});
