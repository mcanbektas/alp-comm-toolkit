import { describe, expect, it } from 'vitest';

import { isParseSuccess } from '@/protocol-core/types';
import { bacnetIpParser, bacnetIpPlugin, parseBacnetIp } from './bacnetip';
import type { BacnetIpFrameMetadata } from './bacnetip';

function exampleBytes(id: string): Uint8Array {
  const example = bacnetIpPlugin.exampleFrames.find((frame) => frame.id === id);
  if (example === undefined) throw new Error(`örnek çerçeve bulunamadı: ${id}`);
  return example.bytes;
}

describe('parseBacnetIp — örnek çerçeveler', () => {
  it('original-unicast-npdu-read-property: NPDU + APDU başlığı, bacnetmstp.ts ile AYNI Data gövdesinden', () => {
    const result = parseBacnetIp(exampleBytes('original-unicast-npdu-read-property'));
    if (!isParseSuccess(result)) throw new Error('beklenmeyen ParseFailure');
    expect(result.frame.valid).toBe(true);

    expect(result.frame.fields.find((field) => field.id === 'bvlc-type')?.physicalValue).toBe(
      'BACnet/IP (Annex J)',
    );
    expect(result.frame.fields.find((field) => field.id === 'bvlc-function')?.physicalValue).toBe(
      'Original-Unicast-NPDU',
    );
    expect(result.frame.fields.find((field) => field.id === 'bvlc-length')?.valid).toBe(true);
    expect(result.frame.fields.find((field) => field.id === 'npdu-expecting-reply')?.rawValue).toBe(1);
    expect(result.frame.fields.find((field) => field.id === 'apdu-pdu-type')?.physicalValue).toBe(
      'BACnet-Confirmed-Request-PDU',
    );
    expect(result.frame.fields.find((field) => field.id === 'apdu-invoke-id')?.rawValue).toBe(1);
    expect(result.frame.fields.find((field) => field.id === 'apdu-service-choice')?.physicalValue).toBe(
      'ReadProperty',
    );
    const parameters = result.frame.fields.find((field) => field.id === 'apdu-service-parameters');
    expect(parameters?.rawBytes).toEqual(Uint8Array.from([0xaa, 0xbb, 0xcc]));

    const metadata = result.frame.rawFrame.metadata as BacnetIpFrameMetadata;
    expect(metadata.summaryKey).toBe('protocol.bacnetIp.summary.apdu');
    expect(metadata.bvlcFunctionLabel).toBe('Original-Unicast-NPDU');
  });

  it('original-broadcast-npdu-i-am: Unconfirmed-Request/I-Am adlanır, Invoke ID YOK', () => {
    const result = parseBacnetIp(exampleBytes('original-broadcast-npdu-i-am'));
    if (!isParseSuccess(result)) throw new Error('beklenmeyen ParseFailure');
    expect(result.frame.valid).toBe(true);

    expect(result.frame.fields.find((field) => field.id === 'bvlc-function')?.physicalValue).toBe(
      'Original-Broadcast-NPDU',
    );
    expect(result.frame.fields.find((field) => field.id === 'apdu-pdu-type')?.physicalValue).toBe(
      'BACnet-Unconfirmed-Request-PDU',
    );
    expect(result.frame.fields.find((field) => field.id === 'apdu-service-choice')?.physicalValue).toBe('I-Am');
    expect(result.frame.fields.find((field) => field.id === 'apdu-invoke-id')).toBeUndefined();
  });

  it('forwarded-npdu: B/IP adresi doğru gösterilir, NPDU offset 10’da başlar', () => {
    const result = parseBacnetIp(exampleBytes('forwarded-npdu'));
    if (!isParseSuccess(result)) throw new Error('beklenmeyen ParseFailure');
    expect(result.frame.valid).toBe(true);

    const address = result.frame.fields.find((field) => field.id === 'bvlc-originating-address');
    expect(address?.physicalValue).toBe('192.168.1.50:47808');
    expect(address?.offset).toBe(4);
    expect(address?.length).toBe(6);

    // NPDU/APDU alanları B/IP adresinden SONRAKİ offsetten (10) doğru okunmalı.
    expect(result.frame.fields.find((field) => field.id === 'apdu-service-choice')?.physicalValue).toBe('I-Am');
    const apduPduType = result.frame.fields.find((field) => field.id === 'apdu-pdu-type');
    expect(apduPduType?.offset).toBeGreaterThanOrEqual(10);
  });

  it('register-foreign-device: dar ad + ham gövde, uyarı yolu (frame yine valid:true)', () => {
    const result = parseBacnetIp(exampleBytes('register-foreign-device'));
    if (!isParseSuccess(result)) throw new Error('beklenmeyen ParseFailure');
    expect(result.frame.valid).toBe(true);

    expect(result.frame.fields.find((field) => field.id === 'bvlc-function')?.physicalValue).toBe(
      'Register-Foreign-Device',
    );
    const body = result.frame.fields.find((field) => field.id === 'bvlc-function-body');
    expect(body?.rawBytes).toEqual(Uint8Array.from([0x01, 0x2c]));
    expect(result.frame.warnings.some((warning) => warning.code === 'protocol.bacnetIp.warning.functionBodyNotDecoded')).toBe(
      true,
    );
    // BBMD/FDT tablo takibi YAPILMAZ — npdu-/apdu- alanı hiç üretilmez.
    expect(result.frame.fields.some((field) => field.id.startsWith('npdu-'))).toBe(false);
    expect(result.frame.fields.some((field) => field.id.startsWith('apdu-'))).toBe(false);
  });

  it('bvlc-result: dar ad + ham gövde', () => {
    const result = parseBacnetIp(exampleBytes('bvlc-result'));
    if (!isParseSuccess(result)) throw new Error('beklenmeyen ParseFailure');
    expect(result.frame.valid).toBe(true);

    expect(result.frame.fields.find((field) => field.id === 'bvlc-function')?.physicalValue).toBe('BVLC-Result');
    const body = result.frame.fields.find((field) => field.id === 'bvlc-function-body');
    expect(body?.rawBytes).toEqual(Uint8Array.from([0x00, 0x00]));
  });

  it('length-mismatch: yalnız uyarı üretir, Length alanı valid:false ama frame yapısal olarak valid:true kalır', () => {
    const result = parseBacnetIp(exampleBytes('length-mismatch'));
    if (!isParseSuccess(result)) throw new Error('beklenmeyen ParseFailure');
    expect(result.frame.valid).toBe(true);

    const lengthField = result.frame.fields.find((field) => field.id === 'bvlc-length');
    expect(lengthField?.valid).toBe(false);
    expect(lengthField?.rawValue).toBe(99);
    expect(result.frame.warnings.some((warning) => warning.code === 'protocol.bacnetIp.warning.lengthMismatch')).toBe(
      true,
    );
    // Length yanlış olsa da gerçek buffer TEK doğru kaynak sayılır — NPDU/APDU yine doğru çözülür.
    expect(result.frame.fields.find((field) => field.id === 'apdu-service-choice')?.physicalValue).toBe(
      'ReadProperty',
    );
  });

  it('invalid-type: Type ≠ 0x81 gerçek bir çerçeve hatası basar, geri kalan alanlar yine yapısal olarak çözülür', () => {
    const result = parseBacnetIp(exampleBytes('invalid-type'));
    if (!isParseSuccess(result)) throw new Error('beklenmeyen ParseFailure');
    expect(result.frame.valid).toBe(false);

    const typeField = result.frame.fields.find((field) => field.id === 'bvlc-type');
    expect(typeField?.valid).toBe(false);
    expect(result.frame.errors.some((error) => error.code === 'start-delimiter-not-found')).toBe(true);
    // Type hatalı olsa da Function/Length/NPDU/APDU hâlâ SABİT ofsetlerden doğru okunur.
    expect(result.frame.fields.find((field) => field.id === 'apdu-service-choice')?.physicalValue).toBe(
      'ReadProperty',
    );
  });
});

describe('parseBacnetIp — yapısal hata yolları', () => {
  it('4 bayttan kısa girdide truncated-frame ile ParseFailure döner (recoverable)', () => {
    const result = parseBacnetIp(Uint8Array.from([0x81, 0x0a, 0x00]));
    expect(result.success).toBe(false);
    if (result.success) throw new Error('beklenmeyen ParseSuccess');
    expect(result.error.code).toBe('truncated-frame');
    expect(result.recoverable).toBe(true);
    expect(result.consumedBytes).toBe(0);
  });

  it('Forwarded-NPDU’da B/IP adresine yetmeyen bayt truncated-frame hatası basar (ParseFailure DEĞİL)', () => {
    // Function=0x04 ama header'dan sonra yalnız 3 bayt var (6 gerekir).
    const result = parseBacnetIp(Uint8Array.from([0x81, 0x04, 0x00, 0x07, 0x11, 0x22, 0x33]));
    if (!isParseSuccess(result)) throw new Error('beklenmeyen ParseFailure');
    expect(result.frame.valid).toBe(false);
    expect(result.frame.errors.some((error) => error.code === 'truncated-frame')).toBe(true);
    expect(result.frame.fields.some((field) => field.id === 'bvlc-originating-address')).toBe(false);
  });

  it('maxFrameLength aşılırsa frame-too-long ile ParseFailure döner', () => {
    const result = bacnetIpParser.parse(exampleBytes('original-unicast-npdu-read-property'), {
      maxFrameLength: 5,
    });
    expect(result.success).toBe(false);
    if (result.success) throw new Error('beklenmeyen ParseSuccess');
    expect(result.error.code).toBe('frame-too-long');
    expect(result.recoverable).toBe(false);
  });

  it('iptal edilen sinyalde parser-timeout ile ParseFailure döner', () => {
    const controller = new AbortController();
    controller.abort();
    const result = bacnetIpParser.parse(exampleBytes('bvlc-result'), { signal: controller.signal });
    expect(result.success).toBe(false);
    if (result.success) throw new Error('beklenmeyen ParseSuccess');
    expect(result.error.code).toBe('parser-timeout');
  });

  it('bilinmeyen BVLC Function yalnız uyarı üretir, ham gövde gösterilir', () => {
    // Function=0x0C (Secured-BVLL) — dar kümenin BİLEREK dışında bırakıldı (dosya başı).
    const result = parseBacnetIp(Uint8Array.from([0x81, 0x0c, 0x00, 0x06, 0x11, 0x22]));
    if (!isParseSuccess(result)) throw new Error('beklenmeyen ParseFailure');
    expect(result.frame.valid).toBe(true);
    const functionField = result.frame.fields.find((field) => field.id === 'bvlc-function');
    expect(functionField?.valid).toBe(false);
    expect(functionField?.warnings).toContain('protocol.bacnetIp.warning.unknownFunction');
    expect(result.frame.fields.find((field) => field.id === 'bvlc-function-body')?.rawBytes).toEqual(
      Uint8Array.from([0x11, 0x22]),
    );
  });
});

describe('bacnetIpParser.canParse', () => {
  it('geçerli Type baytı + asgari uzunlukta true döner', () => {
    expect(bacnetIpParser.canParse(exampleBytes('bvlc-result'))).toBe(true);
  });

  it('yanlış Type baytında false döner', () => {
    expect(bacnetIpParser.canParse(Uint8Array.from([0x01, 0x0a, 0x00, 0x0d]))).toBe(false);
  });

  it('4 bayttan kısa girdide false döner', () => {
    expect(bacnetIpParser.canParse(Uint8Array.from([0x81, 0x0a]))).toBe(false);
  });
});

describe('bacnetIpPlugin', () => {
  it('her örnek çerçevenin expectedValid alanı gerçek parse sonucunu yansıtır', () => {
    for (const example of bacnetIpPlugin.exampleFrames) {
      const result = parseBacnetIp(example.bytes);
      if (example.expectedValid === false) {
        const structurallyInvalid = !result.success || !result.frame.valid;
        expect(structurallyInvalid, example.id).toBe(true);
      } else {
        expect(isParseSuccess(result), example.id).toBe(true);
        if (isParseSuccess(result)) {
          expect(result.frame.valid, example.id).toBe(true);
        }
      }
    }
  });

  it('katalog id, kategori ve örnek çerçeve sayısı beklenen gibidir', () => {
    expect(bacnetIpPlugin.id).toBe('bacnet-ip');
    expect(bacnetIpPlugin.category).toBe('building-automation');
    expect(bacnetIpPlugin.exampleFrames.length).toBe(7);
  });
});
