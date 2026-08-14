import { describe, expect, it } from 'vitest';

import { decodeDbcMessage, motorolaStartToAbsoluteBit, readDbcSignalRaw } from './dbcDecoder';
import { SAMPLE_DBC_TEXT } from './dbcFixture';
import { parseDbc } from './dbcParser';
import type { DbcDatabase, DbcDecodedSignal, DbcMessage, DbcSignal } from './dbcTypes';

function bytes(hex: string): Uint8Array {
  const cleaned = hex.replace(/\s+/g, '');
  const result = new Uint8Array(cleaned.length / 2);
  for (let index = 0; index < result.length; index += 1) {
    result[index] = Number.parseInt(cleaned.slice(index * 2, index * 2 + 2), 16);
  }
  return result;
}

const database: DbcDatabase = (() => {
  const result = parseDbc(SAMPLE_DBC_TEXT);
  if (!result.success) throw new Error('örnek DBC çözülemedi');
  return result.database;
})();

function messageByName(name: string): DbcMessage {
  const found = database.messages.find((message) => message.name === name);
  if (found === undefined) throw new Error(`mesaj "${name}" yok`);
  return found;
}

function signalByName(message: DbcMessage, name: string): DbcSignal {
  const found = message.signals.find((signal) => signal.name === name);
  if (found === undefined) throw new Error(`sinyal "${name}" yok`);
  return found;
}

function decodedByName(decoded: readonly DbcDecodedSignal[], name: string): DbcDecodedSignal {
  const found = decoded.find((entry) => entry.signal.name === name);
  if (found === undefined) {
    throw new Error(`çözülen sinyal "${name}" yok; gelenler: ${decoded.map((d) => d.signal.name).join(', ')}`);
  }
  return found;
}

describe('motorolaStartToAbsoluteBit', () => {
  it('testere dişi numarasını msb-first mutlak konuma çevirir', () => {
    // DBC bit 7 = 0. baytın MSB'si = msb-first mutlak 0.
    expect(motorolaStartToAbsoluteBit(7)).toBe(0);
    // DBC bit 0 = 0. baytın LSB'si = msb-first mutlak 7.
    expect(motorolaStartToAbsoluteBit(0)).toBe(7);
    // DBC bit 15 = 1. baytın MSB'si = msb-first mutlak 8.
    expect(motorolaStartToAbsoluteBit(15)).toBe(8);
    expect(motorolaStartToAbsoluteBit(8)).toBe(15);
  });

  it('bayt sınırında kendi kendinin tersidir', () => {
    for (let bit = 0; bit < 64; bit += 1) {
      expect(motorolaStartToAbsoluteBit(motorolaStartToAbsoluteBit(bit))).toBe(bit);
    }
  });
});

describe('readDbcSignalRaw — Intel (@1)', () => {
  const message = messageByName('EngineData');

  it('little-endian okur: startBit sinyalin EN DÜŞÜK bitidir', () => {
    // E8 03 → 0x03E8 = 1000. Big-endian okunsaydı 0xE803 = 59395 çıkardı.
    const raw = readDbcSignalRaw(bytes('E8 03 5A 10 27 00 00 00'), signalByName(message, 'EngineSpeed'));
    expect(raw).toBe(1000);
  });

  it('bayt ortasından başlayan alanı çözer', () => {
    const raw = readDbcSignalRaw(bytes('E8 03 5A 10 27 00 00 00'), signalByName(message, 'CoolantTemp'));
    expect(raw).toBe(0x5a);
  });

  it('işaretli sinyalde iki tümleyen uygular', () => {
    const torque = signalByName(message, 'Torque');
    // 10 27 → 0x2710 = 10000 (pozitif).
    expect(readDbcSignalRaw(bytes('00 00 00 10 27 00 00 00'), torque)).toBe(10000);
    // F0 D8 → 0xD8F0 = 55536 işaretsiz; işaretli 16 bitte -10000.
    expect(readDbcSignalRaw(bytes('00 00 00 F0 D8 00 00 00'), torque)).toBe(-10000);
  });
});

describe('readDbcSignalRaw — Motorola (@0)', () => {
  const signal = signalByName(messageByName('DiagResponse'), 'ResponseCode');

  it('big-endian okur: startBit sinyalin EN YÜKSEK bitidir', () => {
    // Çivi: startBit 7 → 0. baytın MSB'si; 16 bit okuma bayt 0 ve 1'i
    // big-endian kapsar. Dönüşüm atlanırsa değer sessizce yanlış çıkar.
    expect(readDbcSignalRaw(bytes('12 34 00 00 00 00 00 00'), signal)).toBe(0x1234);
    expect(readDbcSignalRaw(bytes('FF 01 00 00 00 00 00 00'), signal)).toBe(0xff01);
  });

  it('Intel ile AYNI baytlardan FARKLI değer üretir', () => {
    // İki sıranın karıştırılması hata vermez, yalnız değer değişir — bu testin
    // varlık sebebi tam olarak bu.
    const payload = bytes('12 34 00 00 00 00 00 00');
    const asIntel: DbcSignal = { ...signal, byteOrder: 'intel', startBit: 0 };
    expect(readDbcSignalRaw(payload, signal)).toBe(0x1234);
    expect(readDbcSignalRaw(payload, asIntel)).toBe(0x3412);
  });
});

describe('readDbcSignalRaw — sınırlar', () => {
  const signal = signalByName(messageByName('EngineData'), 'EngineSpeed');

  it('çerçeveye sığmayan sinyalde undefined döner, FIRLATMAZ', () => {
    // DBC 8 bayt der, hat 1 bayt getirir: beklenen bir durum, çökme sebebi değil.
    expect(readDbcSignalRaw(bytes('E8'), signal)).toBeUndefined();
  });

  it('53 bitten geniş sinyalde undefined döner', () => {
    const tooWide: DbcSignal = { ...signal, bitLength: 64 };
    expect(readDbcSignalRaw(new Uint8Array(16), tooWide)).toBeUndefined();
  });
});

describe('decodeDbcMessage — fiziksel değer', () => {
  const message = messageByName('EngineData');
  const decoded = decodeDbcMessage(bytes('E8 03 5A 10 27 00 00 00'), message);

  it('Physical = Raw × Factor + Offset uygular (spec §17.4)', () => {
    const speed = decodedByName(decoded, 'EngineSpeed');
    expect(speed.rawValue).toBe(1000);
    expect(speed.physicalValue).toBe(125);

    const temperature = decodedByName(decoded, 'CoolantTemp');
    expect(temperature.rawValue).toBe(90);
    // 90 × 1 + (-40) = 50
    expect(temperature.physicalValue).toBe(50);
  });

  it('bildirilen aralığın dışını işaretler', () => {
    for (const entry of decoded) {
      expect(entry.outOfRange, entry.signal.name).toBe(false);
    }
    // CoolantTemp aralığı [-40, 215]; ham 255 → 215 sınırda, 0xFF üstü değil.
    const overRange = decodeDbcMessage(bytes('00 00 FF 00 00 00 00 00'), message);
    expect(decodedByName(overRange, 'CoolantTemp').physicalValue).toBe(215);
    expect(decodedByName(overRange, 'CoolantTemp').outOfRange).toBe(false);
  });

  it('min ve max’ın ikisi de 0 ise aralık BİLDİRİLMEMİŞ sayılır', () => {
    // Aksi hâlde aralık vermeyen her sinyal kırmızıya boyanırdı.
    const noRange: DbcSignal = {
      ...signalByName(message, 'EngineSpeed'),
      minimum: 0,
      maximum: 0,
    };
    const result = decodeDbcMessage(bytes('E8 03 00 00 00 00 00 00'), {
      ...message,
      signals: [noRange],
    });
    expect(result[0]?.outOfRange).toBe(false);
  });

  it('VAL_ tablosundaki karşılığı etiket olarak taşır', () => {
    const withLabel = decodeDbcMessage(bytes('00 00 00 00 00 00 00 00'), message);
    expect(decodedByName(withLabel, 'CoolantTemp').label).toBe('Sensor error');
    // Tablosu olmayan değerde etiket yazılmaz.
    expect(decodedByName(decoded, 'CoolantTemp').label).toBeUndefined();
  });

  it('kısa çerçevede sığmayan sinyalleri sessizce atlar', () => {
    const short = decodeDbcMessage(bytes('E8 03'), message);
    expect(short.map((entry) => entry.signal.name)).toEqual(['EngineSpeed']);
  });
});

describe('decodeDbcMessage — çoklama', () => {
  const message = messageByName('SensorMux');

  it('anahtar 0 iken YALNIZ m0 sinyalini döner', () => {
    const decoded = decodeDbcMessage(bytes('00 E8 03 00 00 00 00 00'), message);
    expect(decoded.map((entry) => entry.signal.name)).toEqual(['Selector', 'TempA']);
    expect(decodedByName(decoded, 'TempA').physicalValue).toBeCloseTo(100, 6);
  });

  it('anahtar 1 iken YALNIZ m1 sinyalini döner — aynı bitler, başka anlam', () => {
    const decoded = decodeDbcMessage(bytes('01 E8 03 00 00 00 00 00'), message);
    expect(decoded.map((entry) => entry.signal.name)).toEqual(['Selector', 'VoltB']);
    expect(decodedByName(decoded, 'VoltB').physicalValue).toBeCloseTo(1, 6);
  });

  it('eşleşmeyen anahtar değerinde hiçbir çoklanmış sinyal dönmez', () => {
    const decoded = decodeDbcMessage(bytes('07 E8 03 00 00 00 00 00'), message);
    expect(decoded.map((entry) => entry.signal.name)).toEqual(['Selector']);
  });

  it('anahtar okunamıyorsa çoklanmış sinyal gösterilmez', () => {
    // Tek baytlık çerçeve: anahtar okunur ama TempA sığmaz. Anahtarın kendisi
    // okunamayan durumu ayrıca kanıtlamak için sıfır baytlık çerçeve kullanılır.
    const decoded = decodeDbcMessage(new Uint8Array(0), message);
    expect(decoded).toEqual([]);
  });
});
