import { describe, expect, it } from 'vitest';

import { SAMPLE_DBC_EXTENDED_ID, SAMPLE_DBC_TEXT } from './dbcFixture';
import { parseDbc } from './dbcParser';
import { writeDbc } from './dbcWriter';
import type { DbcDatabase } from './dbcTypes';

function expectDatabase(text: string): DbcDatabase {
  const result = parseDbc(text);
  if (!result.success) throw new Error('DBC çözülemedi');
  return result.database;
}

const original = expectDatabase(SAMPLE_DBC_TEXT);

describe('writeDbc — gidiş dönüş', () => {
  it('yazılan metin GERİ OKUNABİLİR ve model korunur', () => {
    // Asıl çivi: yazıcı ile çözücü ayrışırsa kullanıcının dışa aktardığı dosya
    // kendi uygulamamızda bile açılmaz.
    const roundTripped = expectDatabase(writeDbc(original));
    expect(roundTripped).toEqual(original);
  });

  it('ikinci tur çıktısı birincisiyle BİREBİR aynıdır', () => {
    const once = writeDbc(original);
    const twice = writeDbc(expectDatabase(once));
    expect(twice).toBe(once);
  });

  it('sürüm, düğüm listesi ve mesaj başlıklarını yazar', () => {
    const text = writeDbc(original);
    expect(text).toContain('VERSION "1.0"');
    expect(text).toContain('BU_: Gateway Engine Dashboard');
    expect(text).toContain('BO_ 291 EngineData: 8 Engine');
  });

  it('extended identifier’a bayrağı GERİ EKLER', () => {
    // Model bayrağı ayrı tutar; dosya biçimi ise identifier'ın içinde bekler.
    const text = writeDbc(original);
    const expected = (SAMPLE_DBC_EXTENDED_ID | 0x80000000) >>> 0;
    expect(text).toContain(`BO_ ${String(expected)} DiagResponse: 8 Gateway`);
  });

  it('sinyal satırını DBC söz dizimiyle yazar', () => {
    const text = writeDbc(original);
    expect(text).toContain(
      ' SG_ EngineSpeed : 0|16@1+ (0.125,0) [0|8031.875] "rpm" Gateway,Dashboard',
    );
    // Motorola ve işaretli sinyal işaretleri korunur.
    expect(text).toContain(' SG_ ResponseCode : 7|16@0+ (1,0) [0|65535] "" Engine');
    expect(text).toContain(' SG_ Torque : 24|16@1- (1,0) [-32768|32767] "Nm" Gateway');
  });

  it('çoklayıcı işaretlerini yazar', () => {
    const text = writeDbc(original);
    expect(text).toContain(' SG_ Selector M : 0|8@1+');
    expect(text).toContain(' SG_ TempA m0 : 8|16@1+');
    expect(text).toContain(' SG_ VoltB m1 : 8|16@1+');
  });

  it('yorumları ve değer tablosunu yazar', () => {
    const text = writeDbc(original);
    expect(text).toContain('CM_ BO_ 291 "Engine data broadcast";');
    expect(text).toContain('CM_ SG_ 291 EngineSpeed "Crankshaft speed";');
    expect(text).toContain('VAL_ 291 CoolantTemp 0 "Sensor error" 255 "Not available" ;');
  });

  it('araçların beklediği NS_ / BS_ iskeletini bırakır', () => {
    const text = writeDbc(original);
    expect(text).toContain('NS_ :');
    expect(text).toContain('BS_:');
  });

  it('alıcısı olmayan sinyale Vector__XXX yer tutucusu koyar', () => {
    // Boş alıcı listesi yazılırsa satır eksik alanlı olur ve geri okunamaz.
    const database: DbcDatabase = {
      version: '1',
      nodes: [],
      comments: [],
      messages: [
        {
          canId: 1,
          extended: false,
          name: 'M',
          byteLength: 1,
          transmitter: '',
          signals: [
            {
              name: 'S',
              startBit: 0,
              bitLength: 8,
              byteOrder: 'intel',
              signed: false,
              factor: 1,
              offset: 0,
              minimum: 0,
              maximum: 0,
              unit: '',
              receivers: [],
              multiplex: { kind: 'none' },
            },
          ],
        },
      ],
    };
    const text = writeDbc(database);
    expect(text).toContain('BO_ 1 M: 1 Vector__XXX');
    expect(text).toContain('"" Vector__XXX');
    // Ve yine geri okunabilir olmalı.
    expect(expectDatabase(text).messages[0]?.name).toBe('M');
  });

  it('çok küçük faktörü üstel gösterimle YAZMAZ', () => {
    // `String(1e-7)` → "1e-7"; bazı DBC araçları bunu okumaz.
    const database: DbcDatabase = {
      ...original,
      messages: [
        {
          ...(original.messages[0] as DbcDatabase['messages'][number]),
          signals: [
            {
              ...(original.messages[0]?.signals[0] as DbcDatabase['messages'][number]['signals'][number]),
              factor: 1e-7,
            },
          ],
        },
      ],
    };
    const text = writeDbc(database);
    expect(text).not.toMatch(/\(1e-7,/);
    expect(text).toContain('(0.0000001,');
  });
});
