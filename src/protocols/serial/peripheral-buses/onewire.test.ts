import { describe, expect, it } from 'vitest';

import { computeNamedCrc } from '@/protocol-core/checksums/crcCatalogue';
import { isParseSuccess } from '@/protocol-core/types';
import { oneWireParser, oneWirePlugin, parseOneWire } from './onewire';
import type { OneWireFrameMetadata } from './onewire';

/** noUncheckedIndexedAccess: bayt dizisi erişimi her yerde bu guard'dan geçer. */
function byteAt(data: Uint8Array, offset: number): number {
  return data[offset] ?? 0;
}

function exampleBytes(id: string): Uint8Array {
  const example = oneWirePlugin.exampleFrames.find((frame) => frame.id === id);
  if (example === undefined) throw new Error(`örnek çerçeve bulunamadı: ${id}`);
  return example.bytes;
}

describe('oneWire — CRC-8/MAXIM bağımsız doğrulama (bacnetmstp UBX 3c emsali)', () => {
  // Motorun KENDİ hesabından bağımsız: crcCatalogue'un computeNamedCrc'si doğrudan
  // çağrılıp örnek çerçevelerin GÖMÜLÜ CRC baytlarıyla karşılaştırılır.

  it('"read-rom" örneğinin CRC baytı bağımsız hesapla örtüşür', () => {
    const bytes = exampleBytes('read-rom');
    const coverage = bytes.slice(1, 8); // Family(1) + Serial(6), komut baytı (index 0) HARİÇ
    expect(Number(computeNamedCrc(coverage, 'CRC8_MAXIM'))).toBe(byteAt(bytes, 8));
  });

  it('"match-rom" örneğinin CRC baytı bağımsız hesapla örtüşür', () => {
    const bytes = exampleBytes('match-rom');
    const coverage = bytes.slice(1, 8);
    expect(Number(computeNamedCrc(coverage, 'CRC8_MAXIM'))).toBe(byteAt(bytes, 8));
  });

  it('"bad-crc" örneğinde gömülü bayt KASITLI olarak bağımsız hesaptan FARKLIDIR', () => {
    const bytes = exampleBytes('bad-crc');
    const coverage = bytes.slice(1, 8);
    expect(Number(computeNamedCrc(coverage, 'CRC8_MAXIM'))).not.toBe(byteAt(bytes, 8));
  });

  it('spec özetinin KENDİ ROM ID örneği (28 FF 64 1D 91 16 03 5C) CRC-8/MAXIM sağlamaz — illüstratif, fixture DEĞİL', () => {
    // docs/spec/ozet/01-fiziksel-arayuzler.md:338 — bu dosya başındaki bulgu notunun kalıcı kanıtı.
    const specExampleCoverage = Uint8Array.from([0x28, 0xff, 0x64, 0x1d, 0x91, 0x16, 0x03]);
    const specExampleCrc = 0x5c;
    expect(Number(computeNamedCrc(specExampleCoverage, 'CRC8_MAXIM'))).not.toBe(specExampleCrc);
  });
});

describe('parseOneWire — ROM ID taşıyan örnekler', () => {
  it('read-rom: komut + Family + Serial + CRC doğru çözülür, hepsi valid', () => {
    const result = parseOneWire(exampleBytes('read-rom'));
    if (!isParseSuccess(result)) throw new Error('beklenmeyen ParseFailure');
    expect(result.frame.valid).toBe(true);
    expect(result.consumedBytes).toBe(9);

    expect(result.frame.fields.find((field) => field.id === 'romCommand')?.physicalValue).toBe('Read ROM');
    expect(result.frame.fields.find((field) => field.id === 'familyCode')?.rawValue).toBe(0x28);
    expect(result.frame.fields.find((field) => field.id === 'serialNumber')?.rawBytes).toEqual(
      Uint8Array.from([0x00, 0x00, 0x01, 0x9a, 0xb3, 0x7f]),
    );
    // Serial Number BİLEREK rawValue taşımaz (dosya başı endianness tuzağı notu).
    expect(result.frame.fields.find((field) => field.id === 'serialNumber')?.rawValue).toBeUndefined();
    expect(result.frame.fields.find((field) => field.id === 'crc')?.valid).toBe(true);

    const metadata = result.frame.rawFrame.metadata as OneWireFrameMetadata;
    expect(metadata.summaryKey).toBe('protocol.oneWire.summary.romId');
    expect(metadata.summaryParams['family']).toBe('0x28');
  });

  it('match-rom: farklı Family/Serial değerlerinde de doğru çözülür', () => {
    const result = parseOneWire(exampleBytes('match-rom'));
    if (!isParseSuccess(result)) throw new Error('beklenmeyen ParseFailure');
    expect(result.frame.valid).toBe(true);
    expect(result.frame.fields.find((field) => field.id === 'romCommand')?.physicalValue).toBe('Match ROM');
    expect(result.frame.fields.find((field) => field.id === 'familyCode')?.rawValue).toBe(0x28);
    expect(result.frame.fields.find((field) => field.id === 'crc')?.valid).toBe(true);
  });

  it('bad-crc: çerçeve yine kurulur, CRC alanı valid:false ve crc-mismatch hatası taşır (ParseFailure DEĞİL)', () => {
    const result = parseOneWire(exampleBytes('bad-crc'));
    if (!isParseSuccess(result)) throw new Error('beklenmeyen ParseFailure');
    expect(result.frame.valid).toBe(false);
    // Family/Serial CRC bozuk olsa da yapısal olarak yine çözülür.
    expect(result.frame.fields.find((field) => field.id === 'familyCode')?.rawValue).toBe(0x28);
    expect(result.frame.fields.find((field) => field.id === 'crc')?.valid).toBe(false);
    expect(result.frame.errors.some((error) => error.code === 'crc-mismatch')).toBe(true);
  });
});

describe('parseOneWire — ROM ID taşımayan örnekler', () => {
  it('skip-rom: yalnız 1 bayt tüketilir, Family/Serial/CRC alanı hiç yok', () => {
    const result = parseOneWire(exampleBytes('skip-rom'));
    if (!isParseSuccess(result)) throw new Error('beklenmeyen ParseFailure');
    expect(result.frame.valid).toBe(true);
    expect(result.consumedBytes).toBe(1);
    expect(result.frame.fields.find((field) => field.id === 'romCommand')?.physicalValue).toBe('Skip ROM');
    expect(result.frame.fields.find((field) => field.id === 'familyCode')).toBeUndefined();

    const metadata = result.frame.rawFrame.metadata as OneWireFrameMetadata;
    expect(metadata.summaryKey).toBe('protocol.oneWire.summary.commandOnly');
  });

  it('search-rom: komut tanınır ama arama ağacı bu motorun kapsamı dışı, yalnız 1 bayt tüketilir', () => {
    const result = parseOneWire(exampleBytes('search-rom'));
    if (!isParseSuccess(result)) throw new Error('beklenmeyen ParseFailure');
    expect(result.frame.valid).toBe(true);
    expect(result.consumedBytes).toBe(1);
    expect(result.frame.fields.find((field) => field.id === 'romCommand')?.physicalValue).toBe('Search ROM');
  });

  it('overdrive-skip-rom: Microchip AN3320 doğrulamalı Overdrive ailesi de tanınır', () => {
    const result = parseOneWire(exampleBytes('overdrive-skip-rom'));
    if (!isParseSuccess(result)) throw new Error('beklenmeyen ParseFailure');
    expect(result.frame.valid).toBe(true);
    expect(result.frame.fields.find((field) => field.id === 'romCommand')?.physicalValue).toBe(
      'Overdrive Skip ROM',
    );
  });

  it('unknown-command: tanınmayan komut yalnız uyarı üretir, hata YOK', () => {
    const result = parseOneWire(exampleBytes('unknown-command'));
    if (!isParseSuccess(result)) throw new Error('beklenmeyen ParseFailure');
    expect(result.frame.valid).toBe(true);

    const commandField = result.frame.fields.find((field) => field.id === 'romCommand');
    expect(commandField?.valid).toBe(false);
    expect(commandField?.warnings).toContain('protocol.oneWire.warning.unknownRomCommand');

    const metadata = result.frame.rawFrame.metadata as OneWireFrameMetadata;
    expect(metadata.summaryKey).toBe('protocol.oneWire.summary.unknownCommand');
  });
});

describe('parseOneWire — yapısal hata yolları', () => {
  it('boş girdide truncated-frame ile ParseFailure döner (recoverable)', () => {
    const result = parseOneWire(Uint8Array.from([]));
    expect(result.success).toBe(false);
    if (result.success) throw new Error('beklenmeyen ParseSuccess');
    expect(result.error.code).toBe('truncated-frame');
    expect(result.recoverable).toBe(true);
    expect(result.consumedBytes).toBe(0);
  });

  it('Read ROM komutundan sonra 8 baytlık ROM ID eksikse truncated-frame ile ParseFailure döner', () => {
    // Yalnız komut + 3 bayt — 8 baytlık ROM ID için yetersiz.
    const result = parseOneWire(Uint8Array.from([0x33, 0x28, 0x00, 0x00]));
    expect(result.success).toBe(false);
    if (result.success) throw new Error('beklenmeyen ParseSuccess');
    expect(result.error.code).toBe('truncated-frame');
    expect(result.recoverable).toBe(true);
  });

  it('maxFrameLength aşılırsa frame-too-long ile ParseFailure döner', () => {
    const result = oneWireParser.parse(exampleBytes('read-rom'), { maxFrameLength: 5 });
    expect(result.success).toBe(false);
    if (result.success) throw new Error('beklenmeyen ParseSuccess');
    expect(result.error.code).toBe('frame-too-long');
    expect(result.recoverable).toBe(false);
  });

  it('iptal edilen sinyalde parser-timeout ile ParseFailure döner', () => {
    const controller = new AbortController();
    controller.abort();
    const result = oneWireParser.parse(exampleBytes('skip-rom'), { signal: controller.signal });
    expect(result.success).toBe(false);
    if (result.success) throw new Error('beklenmeyen ParseSuccess');
    expect(result.error.code).toBe('parser-timeout');
  });

  it('fazla bayt sonraki çerçeveye ait sayılır — yalnız gerekli kısım tüketilir', () => {
    const result = parseOneWire(Uint8Array.from([0xcc, 0x33, 0x28]));
    if (!isParseSuccess(result)) throw new Error('beklenmeyen ParseFailure');
    expect(result.consumedBytes).toBe(1);
  });
});

describe('oneWireParser.canParse', () => {
  it('bilinen ROM komut baytında true döner', () => {
    expect(oneWireParser.canParse(exampleBytes('read-rom'))).toBe(true);
    expect(oneWireParser.canParse(Uint8Array.from([0xcc]))).toBe(true);
  });

  it('bilinmeyen komut baytında false döner', () => {
    expect(oneWireParser.canParse(Uint8Array.from([0xaa]))).toBe(false);
  });

  it('boş girdide false döner', () => {
    expect(oneWireParser.canParse(Uint8Array.from([]))).toBe(false);
  });
});

describe('oneWirePlugin', () => {
  it('her örnek çerçevenin expectedValid alanı gerçek parse sonucunu yansıtır', () => {
    for (const example of oneWirePlugin.exampleFrames) {
      const result = parseOneWire(example.bytes);
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
    expect(oneWirePlugin.id).toBe('one-wire');
    expect(oneWirePlugin.category).toBe('interfaces-framing');
    expect(oneWirePlugin.exampleFrames.length).toBeGreaterThan(0);
  });
});
