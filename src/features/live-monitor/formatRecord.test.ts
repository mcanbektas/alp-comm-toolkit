import { describe, expect, it } from 'vitest';

import {
  formatBytesForDisplay,
  formatRecordsAsCsv,
  formatRecordsAsJson,
  formatRecordsAsText,
  formatTimestamp,
  type ExportOptions,
} from './formatRecord';
import { SIMULATED_SIGNAL_TAPS } from './signalTaps';
import type { MonitorRecord } from './types';

const SAMPLE = Uint8Array.from([0xaa, 0x05, 0x10, 0x41, 0x42, 0x00, 0x7f]);

describe('formatBytesForDisplay', () => {
  it('HEX kipinde büyük harf ve boşluklu yazar', () => {
    expect(formatBytesForDisplay(SAMPLE, 'hex')).toBe('AA 05 10 41 42 00 7F');
  });

  it('ASCII kipinde yazdırılamayanı nokta yapar', () => {
    expect(formatBytesForDisplay(SAMPLE, 'ascii')).toBe('...AB..');
  });

  it('ondalık kipinde bayt değerlerini yazar', () => {
    expect(formatBytesForDisplay(SAMPLE, 'decimal')).toBe('170 5 16 65 66 0 127');
  });

  it('ikilik kipinde sekiz haneye tamamlar', () => {
    expect(formatBytesForDisplay(Uint8Array.from([0x05, 0xff]), 'binary')).toBe('00000101 11111111');
  });

  it('karışık kipte hex ve ASCII bloklarını birlikte verir', () => {
    expect(formatBytesForDisplay(Uint8Array.from([0x41, 0x42]), 'mixed')).toBe('41 42  |AB|');
  });

  it('UTF-8 kipinde çok baytlı karakteri çözer', () => {
    const bytes = new TextEncoder().encode('ölçüm');

    expect(formatBytesForDisplay(bytes, 'utf8')).toBe('ölçüm');
  });

  it('UTF-8 kipinde geçersiz dizi satırı düşürmez', () => {
    // Yarım kalmış çok baytlı dizi — canlı akışta olağan.
    const result = formatBytesForDisplay(Uint8Array.from([0x41, 0xc3]), 'utf8');

    expect(result.startsWith('A')).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  it('boş çerçevede boş dize verir', () => {
    expect(formatBytesForDisplay(new Uint8Array(0), 'hex')).toBe('');
  });
});

describe('formatTimestamp', () => {
  it('milisaniye çözünürlüğünde saat:dakika:saniye.mmm verir', () => {
    const epochMs = new Date(2026, 0, 2, 9, 42, 15, 102).getTime();

    expect(formatTimestamp(epochMs, 'ms')).toBe('09:42:15.102');
  });

  it('mikrosaniye çözünürlüğünde altı hane verir ve YUKARI YUVARLAMAZ', () => {
    // 102 + 0.345 double'da 102.34499…'tur. Kesme (floor) bilinçli: yuvarlama
    // 999.9996 ms'yi 1 000 000 µs yapıp saniye alanı ilerlememişken bir sonraki
    // saniyeyi yazdırırdı. Zaman damgası ileri kaydırılmaz.
    const epochMs = new Date(2026, 0, 2, 9, 42, 15, 102).getTime() + 0.345;

    expect(formatTimestamp(epochMs, 'us')).toBe('09:42:15.102344');
  });

  it('mikrosaniye alanı saniye sınırında taşmaz', () => {
    const epochMs = new Date(2026, 0, 2, 9, 42, 15, 999).getTime() + 0.9996;

    expect(formatTimestamp(epochMs, 'us')).toBe('09:42:15.999999');
  });

  it('tek haneli alanları sıfırla doldurur', () => {
    const epochMs = new Date(2026, 0, 2, 1, 2, 3, 4).getTime();

    expect(formatTimestamp(epochMs, 'ms')).toBe('01:02:03.004');
  });
});

const BASE_EPOCH = new Date(2026, 0, 2, 9, 42, 15, 102).getTime();

const RECORDS: MonitorRecord[] = [
  {
    kind: 'frame',
    index: 0,
    timestamp: BASE_EPOCH,
    direction: 'rx',
    bytes: Uint8Array.from([0xaa, 0x05]),
    validity: 'valid',
    signals: [25, 12.345, 1780],
  },
  {
    kind: 'error',
    index: 1,
    timestamp: BASE_EPOCH + 10,
    code: 'no-sync',
    message: 'Beklenen başlangıç baytı yok',
    recoverable: true,
  },
];

const OPTIONS: ExportOptions = {
  displayMode: 'hex',
  timestampResolution: 'ms',
  taps: SIMULATED_SIGNAL_TAPS,
};

describe('formatRecordsAsCsv', () => {
  it('başlık satırı sinyal sütunlarını birimiyle taşır', () => {
    const [header] = formatRecordsAsCsv(RECORDS, OPTIONS).split('\n');

    expect(header).toBe(
      'index,timestamp,kind,direction,length,validation,bytes,error,Temperature (°C),Voltage (V),RPM (rpm)',
    );
  });

  it('çerçeve satırını alanlarıyla yazar', () => {
    const lines = formatRecordsAsCsv(RECORDS, OPTIONS).split('\n');

    expect(lines[1]).toBe('0,09:42:15.102,frame,RX,2,valid,AA 05,,25,12.345,1780');
  });

  it('hata satırında sinyal sütunları boş kalır', () => {
    const lines = formatRecordsAsCsv(RECORDS, OPTIONS).split('\n');

    expect(lines[2]).toBe('1,09:42:15.112,error,,,no-sync,,Beklenen başlangıç baytı yok,,,');
  });

  it('virgül içeren alanı RFC 4180 uyarınca tırnaklar', () => {
    const csv = formatRecordsAsCsv(
      [{ kind: 'error', index: 0, timestamp: BASE_EPOCH, code: 'no-sync', message: 'a,b "c"', recoverable: true }],
      { ...OPTIONS, taps: [] },
    );

    expect(csv.split('\n')[1]).toContain('"a,b ""c"""');
  });

  it('kayıt yokken yalnız başlık üretir', () => {
    expect(formatRecordsAsCsv([], OPTIONS).split('\n')).toHaveLength(1);
  });
});

describe('formatRecordsAsText', () => {
  it('her kaydı tek satırda özetler', () => {
    const lines = formatRecordsAsText(RECORDS, OPTIONS).split('\n');

    expect(lines[0]).toBe('09:42:15.102  RX  AA 05  valid');
    expect(lines[1]).toBe('09:42:15.112  --  no-sync: Beklenen başlangıç baytı yok');
  });
});

describe('formatRecordsAsJson', () => {
  it('sinyalleri musluk kimliğiyle eşler ve okunabilir JSON verir', () => {
    const parsed: unknown = JSON.parse(formatRecordsAsJson(RECORDS, OPTIONS));

    expect(parsed).toEqual([
      {
        index: 0,
        timestamp: '09:42:15.102',
        kind: 'frame',
        direction: 'rx',
        length: 2,
        validation: 'valid',
        bytes: 'AA 05',
        signals: { temperature: 25, voltage: 12.345, rpm: 1780 },
      },
      {
        index: 1,
        timestamp: '09:42:15.112',
        kind: 'error',
        code: 'no-sync',
        message: 'Beklenen başlangıç baytı yok',
        recoverable: true,
      },
    ]);
  });

  it('okunamayan sinyali null yazar — 0 ile karıştırılmasın', () => {
    const json: unknown = JSON.parse(
      formatRecordsAsJson(
        [
          {
            kind: 'frame',
            index: 0,
            timestamp: BASE_EPOCH,
            direction: 'rx',
            bytes: Uint8Array.from([0xaa]),
            validity: 'unchecked',
            signals: [undefined, undefined, undefined],
          },
        ],
        OPTIONS,
      ),
    );

    expect(json).toEqual([
      expect.objectContaining({ signals: { temperature: null, voltage: null, rpm: null } }),
    ]);
  });
});
