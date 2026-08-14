import { describe, expect, it } from 'vitest';

import {
  SAMPLE_DBC_ENGINE_ID,
  SAMPLE_DBC_EXTENDED_ID,
  SAMPLE_DBC_MUX_ID,
  SAMPLE_DBC_TEXT,
} from './dbcFixture';
import { findDbcMessage, parseDbc } from './dbcParser';
import type { DbcDatabase, DbcMessage, DbcSignal } from './dbcTypes';

function expectDatabase(text: string): DbcDatabase {
  const result = parseDbc(text);
  if (!result.success) {
    throw new Error(`beklenen başarı, gelen sorunlar: ${result.issues.map((i) => i.messageKey).join(', ')}`);
  }
  return result.database;
}

function messageByName(database: DbcDatabase, name: string): DbcMessage {
  const found = database.messages.find((message) => message.name === name);
  if (found === undefined) {
    throw new Error(`mesaj "${name}" yok; gelenler: ${database.messages.map((m) => m.name).join(', ')}`);
  }
  return found;
}

function signalByName(message: DbcMessage, name: string): DbcSignal {
  const found = message.signals.find((signal) => signal.name === name);
  if (found === undefined) {
    throw new Error(`sinyal "${name}" yok; gelenler: ${message.signals.map((s) => s.name).join(', ')}`);
  }
  return found;
}

describe('parseDbc — örnek dosya', () => {
  const database = expectDatabase(SAMPLE_DBC_TEXT);

  it('sürüm, düğüm listesi ve mesaj sayısını çözer', () => {
    expect(database.version).toBe('1.0');
    expect(database.nodes).toEqual(['Gateway', 'Engine', 'Dashboard']);
    expect(database.messages).toHaveLength(3);
  });

  it('mesaj başlığını alan alan çözer', () => {
    const message = messageByName(database, 'EngineData');
    expect(message.canId).toBe(SAMPLE_DBC_ENGINE_ID);
    expect(message.extended).toBe(false);
    expect(message.byteLength).toBe(8);
    expect(message.transmitter).toBe('Engine');
    expect(message.signals).toHaveLength(3);
  });

  it('EXTENDED bayrağını identifier’dan AYIRIR', () => {
    // Dosyada `BO_ 2565866497` yazıyor = 0x18F00401 | 0x80000000. Bayrak
    // ayrılmazsa iki milyarlık bir identifier okunur ve hiçbir çerçeveyle
    // eşleşmez.
    const message = messageByName(database, 'DiagResponse');
    expect(message.extended).toBe(true);
    expect(message.canId).toBe(SAMPLE_DBC_EXTENDED_ID);
  });

  it('Intel sinyalinin bütün alanlarını çözer', () => {
    const signal = signalByName(messageByName(database, 'EngineData'), 'EngineSpeed');
    expect(signal.startBit).toBe(0);
    expect(signal.bitLength).toBe(16);
    expect(signal.byteOrder).toBe('intel');
    expect(signal.signed).toBe(false);
    expect(signal.factor).toBe(0.125);
    expect(signal.offset).toBe(0);
    expect(signal.minimum).toBe(0);
    expect(signal.maximum).toBe(8031.875);
    expect(signal.unit).toBe('rpm');
    expect(signal.receivers).toEqual(['Gateway', 'Dashboard']);
  });

  it('Motorola sinyalini @0 olarak işaretler', () => {
    const signal = signalByName(messageByName(database, 'DiagResponse'), 'ResponseCode');
    expect(signal.byteOrder).toBe('motorola');
    expect(signal.startBit).toBe(7);
    expect(signal.bitLength).toBe(16);
  });

  it('işaretli sinyali ve negatif offset’i çözer', () => {
    const engine = messageByName(database, 'EngineData');
    expect(signalByName(engine, 'Torque').signed).toBe(true);
    expect(signalByName(engine, 'CoolantTemp').offset).toBe(-40);
  });

  it('çoklayıcı rollerini ayırt eder', () => {
    const mux = messageByName(database, 'SensorMux');
    expect(mux.canId).toBe(SAMPLE_DBC_MUX_ID);
    expect(signalByName(mux, 'Selector').multiplex).toEqual({ kind: 'multiplexor' });
    expect(signalByName(mux, 'TempA').multiplex).toEqual({ kind: 'multiplexed', switchValue: 0 });
    expect(signalByName(mux, 'VoltB').multiplex).toEqual({ kind: 'multiplexed', switchValue: 1 });
  });

  it('VAL_ değer tablosunu doğru sinyale bağlar', () => {
    const signal = signalByName(messageByName(database, 'EngineData'), 'CoolantTemp');
    expect(signal.valueTable?.get(0)).toBe('Sensor error');
    expect(signal.valueTable?.get(255)).toBe('Not available');
    // Tablosu olmayan sinyalde alan hiç yazılmaz.
    expect(signalByName(messageByName(database, 'EngineData'), 'Torque').valueTable).toBeUndefined();
  });

  it('CM_ yorumlarını mesaja ve sinyale bağlar', () => {
    const message = messageByName(database, 'EngineData');
    expect(message.comment).toBe('Engine data broadcast');
    expect(signalByName(message, 'EngineSpeed').comment).toBe('Crankshaft speed');
  });

  it('örnek dosya hiçbir sorun üretmez', () => {
    const result = parseDbc(SAMPLE_DBC_TEXT);
    expect(result.success).toBe(true);
    if (result.success) expect(result.issues).toEqual([]);
  });
});

describe('findDbcMessage', () => {
  const database = expectDatabase(SAMPLE_DBC_TEXT);

  it('identifier ve extended bayrağının İKİSİNİ birden eşleştirir', () => {
    expect(findDbcMessage(database, SAMPLE_DBC_ENGINE_ID, false)?.name).toBe('EngineData');
    expect(findDbcMessage(database, SAMPLE_DBC_EXTENDED_ID, true)?.name).toBe('DiagResponse');
    // Aynı sayı ama yanlış biçim: eşleşmemeli.
    expect(findDbcMessage(database, SAMPLE_DBC_EXTENDED_ID, false)).toBeUndefined();
    expect(findDbcMessage(database, SAMPLE_DBC_ENGINE_ID, true)).toBeUndefined();
  });
});

describe('parseDbc — hoşgörü', () => {
  it('CRLF satır sonlarını kırpar', () => {
    // `\r` kalırsa sinyal adları görünmez karakter taşır ve eşleştirme sessizce
    // başarısız olur.
    const database = expectDatabase(SAMPLE_DBC_TEXT.replace(/\n/g, '\r\n'));
    const signal = signalByName(messageByName(database, 'EngineData'), 'EngineSpeed');
    expect(signal.unit).toBe('rpm');
    expect(database.nodes).toEqual(['Gateway', 'Engine', 'Dashboard']);
  });

  it('desteklenmeyen bölümü bölüm başına BİR kez bildirir', () => {
    const text = `${SAMPLE_DBC_TEXT}
BA_DEF_ "GenMsgCycleTime" INT 0 65535;
BA_DEF_ "GenSigStartValue" FLOAT 0 100000;
BA_ "GenMsgCycleTime" BO_ 291 100;
BA_ "GenMsgCycleTime" BO_ 512 20;
`;
    const result = parseDbc(text);
    expect(result.success).toBe(true);
    if (!result.success) return;
    const unsupported = result.issues.filter(
      (issue) => issue.messageKey === 'definition.dbc.issue.unsupportedSection',
    );
    // İki farklı bölüm, dört satır → iki uyarı. Aksi hâlde büyük dosyalarda
    // binlerce satır uyarı listesini kullanılmaz hâle getirirdi.
    expect(unsupported).toHaveLength(2);
    expect(unsupported.map((issue) => issue.text).sort()).toEqual(['BA_', 'BA_DEF_']);
  });

  it('bozuk sinyal satırı dosyayı reddettirmez, uyarıya çevrilir', () => {
    const text = `${SAMPLE_DBC_TEXT}
BO_ 999 Broken: 8 Gateway
 SG_ ThisLineIsNotValid
`;
    const result = parseDbc(text);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.issues.some((issue) => issue.messageKey === 'definition.dbc.issue.malformedSignal')).toBe(
      true,
    );
    // Diğer mesajlar sağlam kalır.
    expect(result.database.messages).toHaveLength(4);
  });

  it('mesaja bağlı olmayan sinyali bildirir', () => {
    const result = parseDbc(`VERSION "1"\n SG_ Orphan : 0|8@1+ (1,0) [0|0] "" X\nBO_ 1 M: 1 A\n`);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(
      result.issues.some((issue) => issue.messageKey === 'definition.dbc.issue.signalWithoutMessage'),
    ).toBe(true);
  });

  it('mesajın uzunluğuna sığmayan sinyali bildirir ama atmaz', () => {
    const result = parseDbc(`BO_ 1 Small: 1 A\n SG_ TooWide : 0|16@1+ (1,0) [0|0] "" X\n`);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(
      result.issues.some((issue) => issue.messageKey === 'definition.dbc.issue.signalExceedsMessage'),
    ).toBe(true);
    expect(result.database.messages[0]?.signals).toHaveLength(1);
  });

  it('aynı identifier iki kez tanımlanırsa uyarır', () => {
    const result = parseDbc(`BO_ 1 First: 8 A\n SG_ S1 : 0|8@1+ (1,0) [0|0] "" X\nBO_ 1 Second: 8 A\n`);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(
      result.issues.some((issue) => issue.messageKey === 'definition.dbc.issue.duplicateMessageId'),
    ).toBe(true);
  });

  it('çok satırlı CM_ bloğunu tek yorumda toplar', () => {
    const text = `BO_ 1 M: 8 A\n SG_ S : 0|8@1+ (1,0) [0|0] "" X\nCM_ BO_ 1 "birinci satır\nikinci satır";\n`;
    const database = expectDatabase(text);
    expect(database.messages[0]?.comment).toBe('birinci satır\nikinci satır');
  });

  it('bilinmeyen VAL_ hedefini bildirir', () => {
    const text = `${SAMPLE_DBC_TEXT}\nVAL_ 291 NoSuchSignal 0 "x" ;\n`;
    const result = parseDbc(text);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(
      result.issues.some(
        (issue) => issue.messageKey === 'definition.dbc.issue.unknownValueTableTarget',
      ),
    ).toBe(true);
  });
});

describe('parseDbc — başarısızlık', () => {
  it('boş girdide emptyInput bildirir', () => {
    const result = parseDbc('   \n  ');
    expect(result.success).toBe(false);
    expect(result.issues[0]?.messageKey).toBe('definition.dbc.issue.emptyInput');
  });

  it('hiç mesaj yoksa noMessages bildirir', () => {
    const result = parseDbc('VERSION "1.0"\n\nBU_: A B\n');
    expect(result.success).toBe(false);
    expect(
      result.issues.some((issue) => issue.messageKey === 'definition.dbc.issue.noMessages'),
    ).toBe(true);
  });

  it('her sorun 1-tabanlı satır numarası taşır', () => {
    const result = parseDbc(`BO_ 1 M: 8 A\n SG_ bozuk satır\n`);
    expect(result.success).toBe(true);
    if (!result.success) return;
    const issue = result.issues.find(
      (entry) => entry.messageKey === 'definition.dbc.issue.malformedSignal',
    );
    expect(issue?.line).toBe(2);
  });
});
