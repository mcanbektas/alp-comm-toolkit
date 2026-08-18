import { describe, expect, it } from 'vitest';

import { computeNamedCrc } from '@/protocol-core/checksums/crcCatalogue';
import { isParseSuccess } from '@/protocol-core/types';
import { bacnetMstpParser, bacnetMstpPlugin, parseBacnetMstp } from './bacnetmstp';
import type { BacnetMstpFrameMetadata } from './bacnetmstp';

/** noUncheckedIndexedAccess: bayt dizisi erişimi her yerde bu guard'dan geçer. */
function byteAt(data: Uint8Array, offset: number): number {
  return data[offset] ?? 0;
}

function exampleBytes(id: string): Uint8Array {
  const example = bacnetMstpPlugin.exampleFrames.find((frame) => frame.id === id);
  if (example === undefined) throw new Error(`örnek çerçeve bulunamadı: ${id}`);
  return example.bytes;
}

describe('bacnetMstp — Header CRC-8 / Data CRC-16 bağımsız doğrulama (UBX 3c emsali)', () => {
  // Motorun KENDİ hesabından bağımsız: crcCatalogue'un computeNamedCrc'si
  // doğrudan çağrılıp örnek çerçevelerin GÖMÜLÜ CRC baytlarıyla karşılaştırılır.
  // Bu ikisi tutmuyorsa fixture'ın kendisi bozuktur, motorun hatası değil.

  it('"token" örneğinin Header CRC baytı bağımsız hesapla örtüşür', () => {
    const bytes = exampleBytes('token');
    const headerBytes = bytes.slice(2, 7); // FrameType + Destination + Source + Length(2)
    expect(Number(computeNamedCrc(headerBytes, 'CRC8_BACNET_MSTP'))).toBe(byteAt(bytes, 7));
  });

  it('"poll-for-master" örneğinin Header CRC baytı bağımsız hesapla örtüşür', () => {
    const bytes = exampleBytes('poll-for-master');
    const headerBytes = bytes.slice(2, 7);
    expect(Number(computeNamedCrc(headerBytes, 'CRC8_BACNET_MSTP'))).toBe(byteAt(bytes, 7));
  });

  it('"data-expecting-reply-read-property" örneğinin Header CRC ve Data CRC baytları bağımsız hesapla örtüşür', () => {
    const bytes = exampleBytes('data-expecting-reply-read-property');
    const headerBytes = bytes.slice(2, 7);
    expect(Number(computeNamedCrc(headerBytes, 'CRC8_BACNET_MSTP'))).toBe(byteAt(bytes, 7));

    const dataLength = 9;
    const dataBytes = bytes.slice(8, 8 + dataLength);
    const calculatedDataCrc = Number(computeNamedCrc(dataBytes, 'CRC16_X25'));
    // Data CRC LSB-first iletilir (npdu/apdu dosya başı kaynak uyarısı) — düşük bayt önce.
    const receivedDataCrc = byteAt(bytes, 8 + dataLength) | (byteAt(bytes, 8 + dataLength + 1) << 8);
    expect(receivedDataCrc).toBe(calculatedDataCrc);
  });

  it('"data-not-expecting-reply-i-am" örneğinin Header CRC ve Data CRC baytları bağımsız hesapla örtüşür', () => {
    const bytes = exampleBytes('data-not-expecting-reply-i-am');
    const headerBytes = bytes.slice(2, 7);
    expect(Number(computeNamedCrc(headerBytes, 'CRC8_BACNET_MSTP'))).toBe(byteAt(bytes, 7));

    const dataLength = 8;
    const dataBytes = bytes.slice(8, 8 + dataLength);
    const calculatedDataCrc = Number(computeNamedCrc(dataBytes, 'CRC16_X25'));
    const receivedDataCrc = byteAt(bytes, 8 + dataLength) | (byteAt(bytes, 8 + dataLength + 1) << 8);
    expect(receivedDataCrc).toBe(calculatedDataCrc);
  });

  it('"bad-header-crc" örneğinde gömülü bayt KASITLI olarak bağımsız hesaptan FARKLIDIR', () => {
    const bytes = exampleBytes('bad-header-crc');
    const headerBytes = bytes.slice(2, 7);
    expect(Number(computeNamedCrc(headerBytes, 'CRC8_BACNET_MSTP'))).not.toBe(byteAt(bytes, 7));
  });

  it('"bad-data-crc" örneğinde Header CRC doğru ama Data CRC baytı KASITLI olarak bağımsız hesaptan FARKLIDIR', () => {
    const bytes = exampleBytes('bad-data-crc');
    const headerBytes = bytes.slice(2, 7);
    expect(Number(computeNamedCrc(headerBytes, 'CRC8_BACNET_MSTP'))).toBe(byteAt(bytes, 7));

    const dataLength = 8;
    const dataBytes = bytes.slice(8, 8 + dataLength);
    const calculatedDataCrc = Number(computeNamedCrc(dataBytes, 'CRC16_X25'));
    const receivedDataCrc = byteAt(bytes, 8 + dataLength) | (byteAt(bytes, 8 + dataLength + 1) << 8);
    expect(receivedDataCrc).not.toBe(calculatedDataCrc);
  });
});

describe('parseBacnetMstp — örnek çerçeveler', () => {
  it('token: Length=0, Data CRC alanı hiç basılmaz, 8 bayt tüketilir', () => {
    const result = parseBacnetMstp(exampleBytes('token'));
    if (!isParseSuccess(result)) throw new Error('beklenmeyen ParseFailure');
    expect(result.frame.valid).toBe(true);
    expect(result.consumedBytes).toBe(8);
    expect(result.frame.fields.find((field) => field.id === 'dataCrc')).toBeUndefined();
    expect(result.frame.fields.find((field) => field.id === 'frameType')?.physicalValue).toBe('Token');
  });

  it('poll-for-master: farklı bir Frame Type değerinde de Length=0 doğru işlenir', () => {
    const result = parseBacnetMstp(exampleBytes('poll-for-master'));
    if (!isParseSuccess(result)) throw new Error('beklenmeyen ParseFailure');
    expect(result.frame.valid).toBe(true);
    expect(result.frame.fields.find((field) => field.id === 'frameType')?.physicalValue).toBe('Poll For Master');
    expect(result.frame.fields.find((field) => field.id === 'dataCrc')).toBeUndefined();
  });

  it('data-expecting-reply-read-property: NPDU + APDU başlığı doğru çözülür', () => {
    const result = parseBacnetMstp(exampleBytes('data-expecting-reply-read-property'));
    if (!isParseSuccess(result)) throw new Error('beklenmeyen ParseFailure');
    expect(result.frame.valid).toBe(true);

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

    const metadata = result.frame.rawFrame.metadata as BacnetMstpFrameMetadata;
    expect(metadata.summaryKey).toBe('protocol.bacnetMstp.summary.apdu');
  });

  it('data-not-expecting-reply-i-am: Unconfirmed-Request/I-Am adlanır, broadcast MAC Device Instance ile karışmaz', () => {
    const result = parseBacnetMstp(exampleBytes('data-not-expecting-reply-i-am'));
    if (!isParseSuccess(result)) throw new Error('beklenmeyen ParseFailure');
    expect(result.frame.valid).toBe(true);

    expect(result.frame.fields.find((field) => field.id === 'destinationMac')?.rawValue).toBe(0xff);
    expect(result.frame.fields.find((field) => field.id === 'apdu-pdu-type')?.physicalValue).toBe(
      'BACnet-Unconfirmed-Request-PDU',
    );
    expect(result.frame.fields.find((field) => field.id === 'apdu-service-choice')?.physicalValue).toBe('I-Am');
    // Unconfirmed-Request'te Invoke ID YOKTUR.
    expect(result.frame.fields.find((field) => field.id === 'apdu-invoke-id')).toBeUndefined();
  });

  it('bad-header-crc: çerçeve yine kurulur, Header CRC alanı valid:false ve crc-mismatch hatası taşır (ParseFailure DEĞİL)', () => {
    const result = parseBacnetMstp(exampleBytes('bad-header-crc'));
    if (!isParseSuccess(result)) throw new Error('beklenmeyen ParseFailure');
    expect(result.frame.valid).toBe(false);
    expect(result.frame.fields.find((field) => field.id === 'headerCrc')?.valid).toBe(false);
    expect(result.frame.errors.some((error) => error.code === 'crc-mismatch')).toBe(true);
  });

  it('bad-data-crc: Header CRC doğru, NPDU/APDU yine çözülür, yalnız Data CRC valid:false olur', () => {
    const result = parseBacnetMstp(exampleBytes('bad-data-crc'));
    if (!isParseSuccess(result)) throw new Error('beklenmeyen ParseFailure');
    expect(result.frame.valid).toBe(false);
    expect(result.frame.fields.find((field) => field.id === 'headerCrc')?.valid).toBe(true);
    expect(result.frame.fields.find((field) => field.id === 'dataCrc')?.valid).toBe(false);
    // Data CRC bozuk olsa da yapısal çözüm (Length güvenilir olduğu için) yine tamdır.
    expect(result.frame.fields.find((field) => field.id === 'apdu-service-choice')?.physicalValue).toBe('I-Am');
  });

  it('unrecognized-frame-type: tanınmayan Frame Type yalnız uyarı üretir, CRC hatası YOK', () => {
    const result = parseBacnetMstp(exampleBytes('unrecognized-frame-type'));
    if (!isParseSuccess(result)) throw new Error('beklenmeyen ParseFailure');
    expect(result.frame.valid).toBe(true);

    const frameTypeField = result.frame.fields.find((field) => field.id === 'frameType');
    expect(frameTypeField?.valid).toBe(false);
    expect(frameTypeField?.warnings).toContain('protocol.bacnetMstp.warning.unknownFrameType');

    const dataField = result.frame.fields.find((field) => field.id === 'data');
    expect(dataField?.rawBytes).toEqual(Uint8Array.from([0x11, 0x22, 0x33]));
    // Tanınmayan Frame Type NPDU/APDU alanı ÜRETMEZ — decodeNpdu'ya hiç geçirilmedi.
    expect(result.frame.fields.some((field) => field.id.startsWith('npdu-'))).toBe(false);
    expect(result.frame.fields.some((field) => field.id.startsWith('apdu-'))).toBe(false);
  });
});

describe('parseBacnetMstp — yapısal hata yolları', () => {
  it('8 bayttan kısa girdide truncated-frame ile ParseFailure döner (recoverable)', () => {
    const result = parseBacnetMstp(Uint8Array.from([0x55, 0xff, 0x00]));
    expect(result.success).toBe(false);
    if (result.success) throw new Error('beklenmeyen ParseSuccess');
    expect(result.error.code).toBe('truncated-frame');
    expect(result.recoverable).toBe(true);
    expect(result.consumedBytes).toBe(0);
  });

  it('Length alanının vaat ettiği Data+Data CRC tamamı yoksa length-mismatch ile ParseFailure döner', () => {
    // token gövdesi ama Length=5 yazıldı (Data+Data CRC gerektirir); buffer yalnız 8 bayt.
    const result = parseBacnetMstp(Uint8Array.from([0x55, 0xff, 0x00, 0x01, 0x05, 0x00, 0x05, 0x00]));
    expect(result.success).toBe(false);
    if (result.success) throw new Error('beklenmeyen ParseSuccess');
    expect(result.error.code).toBe('length-mismatch');
    expect(result.recoverable).toBe(true);
  });

  it('maxFrameLength aşılırsa frame-too-long ile ParseFailure döner', () => {
    const result = bacnetMstpParser.parse(exampleBytes('data-expecting-reply-read-property'), {
      maxFrameLength: 10,
    });
    expect(result.success).toBe(false);
    if (result.success) throw new Error('beklenmeyen ParseSuccess');
    expect(result.error.code).toBe('frame-too-long');
    expect(result.recoverable).toBe(false);
  });

  it('iptal edilen sinyalde parser-timeout ile ParseFailure döner', () => {
    const controller = new AbortController();
    controller.abort();
    const result = bacnetMstpParser.parse(exampleBytes('token'), { signal: controller.signal });
    expect(result.success).toBe(false);
    if (result.success) throw new Error('beklenmeyen ParseSuccess');
    expect(result.error.code).toBe('parser-timeout');
  });

  it('Preamble yanlışsa da geri kalan alanlar yapısal olarak yine çözülür (iec104.ts start-byte emsali)', () => {
    // "token" gövdesi ama ilk bayt 0x55 yerine 0x00.
    const bytes = Uint8Array.from(exampleBytes('token'));
    bytes[0] = 0x00;
    const result = parseBacnetMstp(bytes);
    if (!isParseSuccess(result)) throw new Error('beklenmeyen ParseFailure');
    expect(result.frame.valid).toBe(false);
    expect(result.frame.errors.some((error) => error.code === 'start-delimiter-not-found')).toBe(true);
    // Preamble hatalı olsa da Frame Type hâlâ doğru ofsetten okunur.
    expect(result.frame.fields.find((field) => field.id === 'frameType')?.physicalValue).toBe('Token');
  });
});

describe('bacnetMstpParser.canParse', () => {
  it('geçerli Preamble + asgari uzunlukta true döner', () => {
    expect(bacnetMstpParser.canParse(exampleBytes('token'))).toBe(true);
  });

  it('yanlış Preamble baytında false döner', () => {
    expect(bacnetMstpParser.canParse(Uint8Array.from([0x00, 0xff, 0x00, 0x01, 0x05, 0x00, 0x00, 0x8d]))).toBe(
      false,
    );
  });

  it('8 bayttan kısa girdide false döner', () => {
    expect(bacnetMstpParser.canParse(Uint8Array.from([0x55, 0xff]))).toBe(false);
  });
});

describe('bacnetMstpPlugin', () => {
  it('her örnek çerçevenin expectedValid alanı gerçek parse sonucunu yansıtır', () => {
    for (const example of bacnetMstpPlugin.exampleFrames) {
      const result = parseBacnetMstp(example.bytes);
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
    expect(bacnetMstpPlugin.id).toBe('bacnet-mstp');
    expect(bacnetMstpPlugin.category).toBe('building-automation');
    expect(bacnetMstpPlugin.exampleFrames.length).toBeGreaterThan(0);
  });
});
