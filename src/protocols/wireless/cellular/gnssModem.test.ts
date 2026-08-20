import { describe, expect, it } from 'vitest';

import { gnssModemParser, gnssModemPlugin } from './gnssModem';
import type { ParseFailure, ParseResult, ParseSuccess, ParsedField, ParsedFrame } from '@/protocol-core/types';

function expectSuccess(result: ParseResult): ParseSuccess {
  if (!result.success) {
    throw new Error(`expected success, got error "${result.error.code}"`);
  }
  return result;
}

function expectFailure(result: ParseResult): ParseFailure {
  if (result.success) {
    throw new Error('expected failure, got success');
  }
  return result;
}

function fieldById(frame: ParsedFrame, id: string): ParsedField {
  const field = frame.fields.find((candidate) => candidate.id === id);
  if (field === undefined) {
    throw new Error(`field "${id}" not found among [${frame.fields.map((f) => f.id).join(', ')}]`);
  }
  return field;
}

function hasField(frame: ParsedFrame, id: string): boolean {
  return frame.fields.some((field) => field.id === id);
}

function ascii(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

function parse(text: string): ParsedFrame {
  return expectSuccess(gnssModemParser.parse(ascii(text))).frame;
}

describe('gnssModemParser — AT+QGPSLOC (dar alan kümesi)', () => {
  it('2D fix: Quectel kılavuzunun kendi §3.1 örneği — altı alan da doğru çözülür', () => {
    const frame = parse('+QGPSLOC: 061951.0,3150.7223N,11711.9293E,0.7,62.2,2,0.0,0.0,0.0,110513,09\r\n');

    expect(fieldById(frame, 'latitude').rawValue).toBe('3150.7223N');
    expect(fieldById(frame, 'latitude').physicalValue).toBeCloseTo(31.845372, 5);
    expect(fieldById(frame, 'latitude').unit).toBe('°');
    expect(fieldById(frame, 'longitude').physicalValue).toBeCloseTo(117.198822, 5);
    expect(fieldById(frame, 'hdop').physicalValue).toBe(0.7);
    expect(fieldById(frame, 'altitude').physicalValue).toBe(62.2);
    expect(fieldById(frame, 'altitude').unit).toBe('m');
    expect(fieldById(frame, 'gnss-fix-type').physicalValue).toBe('2D fix');
    expect(fieldById(frame, 'satellite-count').physicalValue).toBe(9);
  });

  it('"dar" kapsamın dışındaki alanlar (UTC/cog/spkm/spkn/date) hiç üretilmez', () => {
    const frame = parse('+QGPSLOC: 061951.0,3150.7223N,11711.9293E,0.7,62.2,2,0.0,0.0,0.0,110513,09\r\n');
    for (const id of ['utc-time', 'cog', 'speed-kmh', 'speed-knots', 'date']) {
      expect(hasField(frame, id), id).toBe(false);
    }
  });

  it('tanınmayan <fix> değeri (Quectel yalnız 2/3 tanımlıyor) saniye uydurmaz, uyarı verir', () => {
    const frame = parse('+QGPSLOC: 061951.0,3150.7223N,11711.9293E,0.7,62.2,1,0.0,0.0,0.0,110513,09\r\n');
    const fix = fieldById(frame, 'gnss-fix-type');

    expect(fix.rawValue).toBe(1);
    expect(fix.physicalValue).toBeUndefined();
    expect(fix.warnings).toContain('protocol.gnssModem.warning.fixTypeUnrecognized');
  });

  it('AT+QGPSLOC=2 biçimi: zaten imzalı ondalık derece, dönüşüm yapılmaz', () => {
    const frame = parse('+QGPSLOC: 061951.0,-31.845372,117.198822,0.7,62.2,3,0.0,0.0,0.0,110513,09\r\n');

    expect(fieldById(frame, 'latitude').physicalValue).toBe(-31.845372);
    expect(fieldById(frame, 'longitude').physicalValue).toBe(117.198822);
    expect(fieldById(frame, 'gnss-fix-type').physicalValue).toBe('3D fix');
  });

  it('tanınmayan koordinat biçimi saniye/derece uydurmaz, uyarı verir', () => {
    const frame = parse('+QGPSLOC: 061951.0,abc,11711.9293E,0.7,62.2,2,0.0,0.0,0.0,110513,09\r\n');
    const lat = fieldById(frame, 'latitude');

    expect(lat.rawValue).toBe('abc');
    expect(lat.physicalValue).toBeUndefined();
    expect(lat.warnings).toContain('protocol.gnssModem.warning.qgpslocCoordinateUnrecognized');
  });
});

describe('gnssModemParser — AT+QGPSGNMEA (nmea-0183 devri, motor tekrar yazılmaz)', () => {
  it('GGA: gömülü cümle nmea-0183 motoruyla çözülür, ofsetler DIŞ tampona doğru kaydırılır', () => {
    const frame = parse('+QGPSGNMEA: $GPGGA,103647.0,3150.721154,N,11711.925873,E,1,02,4.7,59.8,M,-2.0,M,,*77\r\n');

    expect(fieldById(frame, 'talker').rawValue).toBe('GP');
    expect(fieldById(frame, 'sentence-formatter').rawValue).toBe('GGA');
    expect(fieldById(frame, 'fix-quality').physicalValue).toBe('GPS Fix');
    expect(fieldById(frame, 'latitude').physicalValue).toBeCloseTo(31.8454, 3);
    expect(fieldById(frame, 'longitude').physicalValue).toBeCloseTo(117.1988, 3);
    expect(fieldById(frame, 'hdop').physicalValue).toBe(4.7);
    expect(fieldById(frame, 'altitude').physicalValue).toBe(59.8);
    expect(frame.valid).toBe(true);

    // Rebase doğrulaması: checksum alanının rawBytes'ı DIŞ tampondaki doğru
    // konuma işaret ediyor mu — nmea0183Parser kendi (yalnız cümle) tamponuna
    // göre 0-tabanlı üretti, burada tam AT satırına göre kaydırılmış olmalı.
    const checksum = fieldById(frame, 'checksum');
    expect(new TextDecoder().decode(checksum.rawBytes)).toBe('77');
  });

  it('RMC: nmea-0183ün KENDİ doğrulanmış fixture’ı — checksum burada YENİDEN hesaplanmadı', () => {
    const frame = parse('+QGPSGNMEA: $GPRMC,123519,A,4807.038,N,01131.000,E,022.4,084.4,230394,003.1,W*6A\r\n');

    expect(fieldById(frame, 'sentence-formatter').rawValue).toBe('RMC');
    expect(fieldById(frame, 'status').physicalValue).toBe('Active');
    expect(fieldById(frame, 'latitude').physicalValue).toBeCloseTo(48.1173, 3);
    expect(frame.valid).toBe(true);
  });

  it('bozuk NMEA cümlesi: pozisyon alanı üretilmez, dış çerçeve geçersiz sayılır ama AT alanları KORUNUR', () => {
    const frame = parse('+QGPSGNMEA: NOT-AN-NMEA-SENTENCE\r\n');

    expect(hasField(frame, 'latitude')).toBe(false);
    expect(frame.valid).toBe(false);
    expect(frame.warnings.map((warning) => warning.code)).toContain(
      'protocol.gnssModem.warning.embeddedNmeaUnparseable',
    );
    // Dış AT-katmanı alanları hâlâ orada — çerçeve tamamen atılmadı.
    expect(fieldById(frame, 'prefix').rawValue).toBe('+QGPSGNMEA');
  });
});

describe('gnssModemParser — lte-modem-at geçişkenliği', () => {
  it('CSQ gibi GNSS’e özgü olmayan komutlar aynen (yalnız protocol adı değişir) geçer', () => {
    const frame = parse('+CSQ: 20,99\r\n');

    expect(frame.protocol).toBe('gnss-modem');
    expect(fieldById(frame, 'csq-rssi').physicalValue).toBe(-73);
  });

  it('OK/ERROR final result satırları aynen geçer', () => {
    const frame = parse('OK\r\n');
    expect(frame.protocol).toBe('gnss-modem');
    expect(fieldById(frame, 'result-code').rawValue).toBe('OK');
  });

  it('boş girdide truncated-frame — hata yolu lte-modem-at/at-commands’tan devralınır', () => {
    expect(expectFailure(gnssModemParser.parse(new Uint8Array(0))).error.code).toBe('truncated-frame');
  });

  it('canParse lte-modem-at ile aynı davranır', () => {
    expect(gnssModemParser.canParse(new Uint8Array(0))).toBe(false);
    expect(gnssModemParser.canParse(ascii('OK'))).toBe(true);
  });
});

describe('gnssModemPlugin', () => {
  it('katalogdaki kimlik, kategori ve parser bağını taşır', () => {
    expect(gnssModemPlugin.id).toBe('gnss-modem');
    expect(gnssModemPlugin.category).toBe('wireless-iot');
    expect(gnssModemPlugin.parser).toBe(gnssModemParser);
  });

  it('her örnek çözülür ve expectedValid ile eşleşir', () => {
    for (const example of gnssModemPlugin.exampleFrames) {
      const result = gnssModemParser.parse(example.bytes);
      if (!result.success) {
        throw new Error(`example "${example.id}" failed: ${result.error.code}`);
      }
      expect(result.frame.valid, `example "${example.id}"`).toBe(example.expectedValid ?? true);
    }
  });

  it('her örnek adı/açıklaması protocol.gnssModem.example. önekli çeviri anahtarıdır', () => {
    for (const example of gnssModemPlugin.exampleFrames) {
      expect(example.name.startsWith('protocol.gnssModem.example.'), example.id).toBe(true);
      expect(example.description?.startsWith('protocol.gnssModem.example.'), example.id).toBe(true);
    }
  });

  it('QGPSLOC 2D/tanınmayan-fix ve QGPSGNMEA GGA/RMC/bozuk karşıtlarının hepsi en az bir örnekte var', () => {
    const ids = gnssModemPlugin.exampleFrames.map((example) => example.id);
    for (const expected of [
      'qgpsloc-2d-fix',
      'qgpsloc-unrecognized-fix',
      'qgpsgnmea-gga',
      'qgpsgnmea-rmc',
      'qgpsgnmea-malformed',
    ]) {
      expect(ids, expected).toContain(expected);
    }
  });
});
