import { describe, expect, it } from 'vitest';

import { decodePulseLog, encodePulseLog } from '@/protocol-core/decoding/pulseLog';
import type { ParseFailure, ParseSuccess } from '@/protocol-core/types';

import {
  SENT_DEFAULT_DATA_NIBBLE_COUNT,
  SENT_MAX_NIBBLE_VALUE,
  SENT_NIBBLE_TICKS_MAX,
  SENT_NIBBLE_TICKS_MIN,
  SENT_SYNC_TICKS,
  buildSentPulseLog,
  decodeSentNibbles,
  forceReservedPulse,
  parseSent,
  sentParser,
  sentPlugin,
  sentSignatureFromPulses,
} from './sent';

function expectSuccess(result: ReturnType<typeof parseSent>): asserts result is ParseSuccess {
  if (!result.success) throw new Error(`beklenmedik başarısızlık: ${result.error.code} — ${result.error.message}`);
}

function expectFailure(result: ReturnType<typeof parseSent>): asserts result is ParseFailure {
  if (result.success) throw new Error('beklenmedik başarı');
}

describe('spec fixture — ozet 04-otomotiv.md:151 çalışılmış örnek', () => {
  it('Pulse 45.0 µs, Tick 3.0 µs → Pulse Ticks 15 → Decoded Nibble 0x3', () => {
    // Tick süresi senkron darbesinden türer: 56 tick × 3.0 µs = 168 µs (spec'in AÇILIŞ örneği).
    const bytes = buildSentPulseLog({
      statusNibble: 0,
      dataNibbles: [3, 0, 0, 0, 0, 0], // İlk veri nibble'ı = spec'in 0x3 örneği.
      crcNibble: 0,
      tickUs: 3,
    });
    const result = parseSent(bytes);
    expectSuccess(result);
    const dataNibble1 = result.frame.fields.find((f) => f.id === 'data-nibble-1');
    expect(dataNibble1?.physicalValue).toBe(3);
    // 45 µs / 3 µs tick = 15 tick — nabzın KENDİ süresi de spec'in örneğiyle örtüşmeli.
    expect(dataNibble1?.rawBytes).toBeDefined();
    const tickField = result.frame.fields.find((f) => f.id === 'estimatedTickTime');
    expect(tickField?.physicalValue).toBe('3.000');
  });
});

describe('parseSent — temel çözüm', () => {
  it('geçerli bir çerçeveyi başarıyla çözer, tüm nibble değerleri doğru', () => {
    const bytes = buildSentPulseLog({ statusNibble: 5, dataNibbles: [1, 10, 15, 3, 7, 2], crcNibble: 9 });
    const result = parseSent(bytes);
    expectSuccess(result);
    expect(result.frame.valid).toBe(true);
    expect(result.frame.fields.find((f) => f.id === 'status')?.physicalValue).toBe(5);
    [1, 10, 15, 3, 7, 2].forEach((value, index) => {
      expect(result.frame.fields.find((f) => f.id === `data-nibble-${String(index + 1)}`)?.physicalValue).toBe(
        value,
      );
    });
    expect(result.frame.fields.find((f) => f.id === 'crc')?.physicalValue).toBe(9);
  });

  it('profil satırı İLK SATIRDIR ve varsayılan profili ADIYLA basar', () => {
    const bytes = buildSentPulseLog({ statusNibble: 0, dataNibbles: [0, 0, 0, 0, 0, 0], crcNibble: 0 });
    const result = parseSent(bytes);
    expectSuccess(result);
    expect(result.frame.fields[0]?.id).toBe('profile');
    expect(result.frame.fields[0]?.rawValue).toContain('SAE J2716 Standard');
    expect(result.frame.fields[0]?.rawValue).toContain('6');
  });

  it('custom profil ile dataNibbleCount alan sayısını GERÇEKTEN değiştirir', () => {
    const bytes = buildSentPulseLog({ statusNibble: 0, dataNibbles: [1, 2, 3], crcNibble: 0 });
    const result = parseSent(bytes, { profile: 'custom', dataNibbleCount: 3 });
    expectSuccess(result);
    expect(result.frame.fields.some((f) => f.id === 'data-nibble-3')).toBe(true);
    expect(result.frame.fields.some((f) => f.id === 'data-nibble-4')).toBe(false);
  });

  it('nibble sayısı varsayılan profilde HER ZAMAN 6’dır — sayı alanı verilse de YOK SAYILIR', () => {
    const bytes = buildSentPulseLog({ statusNibble: 0, dataNibbles: [0, 0, 0, 0, 0, 0], crcNibble: 0 });
    const result = parseSent(bytes, { profile: 'sae-j2716-standard-6-nibble', dataNibbleCount: 3 });
    expectSuccess(result);
    expect(result.frame.fields.some((f) => f.id === 'data-nibble-6')).toBe(true);
  });

  it('sync darbesi rezerveyse ("ölçülemedi") tick süresi kestirilemez, nibble’lar çözülemez', () => {
    const valid = buildSentPulseLog({ statusNibble: 5, dataNibbles: [1, 2, 3, 4, 5, 6], crcNibble: 7 });
    const bytes = forceReservedPulse(valid, 0);
    const result = parseSent(bytes);
    expectSuccess(result);
    const syncField = result.frame.fields.find((f) => f.id === 'sync');
    expect(syncField?.valid).toBe(false);
    const tickField = result.frame.fields.find((f) => f.id === 'estimatedTickTime');
    expect(tickField?.valid).toBe(false);
    expect(tickField?.physicalValue).toBeUndefined();
    const statusField = result.frame.fields.find((f) => f.id === 'status');
    expect(statusField?.valid).toBe(false);
  });

  it('bir veri nibble’ı rezerveyse yalnız o alan geçersizdir, uyarı verilir', () => {
    const valid = buildSentPulseLog({ statusNibble: 5, dataNibbles: [1, 2, 3, 4, 5, 6], crcNibble: 7 });
    // data-nibble-2 → pulse index: sync=0, status=1, data1=2, data2=3.
    const bytes = forceReservedPulse(valid, 3);
    const result = parseSent(bytes);
    expectSuccess(result);
    const field = result.frame.fields.find((f) => f.id === 'data-nibble-2');
    expect(field?.valid).toBe(false);
    expect(field?.physicalValue).toBeUndefined();
    expect(result.frame.warnings.some((w) => w.code === 'protocol.sent.warning.nibbleReserved')).toBe(true);
    // Diğer nibble'lar ETKİLENMEMELİ.
    expect(result.frame.fields.find((f) => f.id === 'data-nibble-1')?.physicalValue).toBe(1);
  });

  it('tick bandının (12-27) dışına düşen bir nibble değer ÇÖZEMEZ ve çerçeveyi geçersiz kılar', () => {
    const bytes = buildSentPulseLog({
      statusNibble: 5,
      dataNibbles: [1, 10, 15, 3, 7, 2],
      crcNibble: 9,
      forceOutOfBandPulseIndex: 4,
    });
    const result = parseSent(bytes);
    expectSuccess(result);
    expect(result.frame.valid).toBe(false);
    const field = result.frame.fields.find((f) => f.id === 'data-nibble-3');
    expect(field?.valid).toBe(false);
    expect(field?.physicalValue).toBeUndefined();
    expect(result.frame.errors.some((e) => e.code === 'value-out-of-range')).toBe(true);
  });

  it('CRC nibble’ı ALINDIĞI GİBİ gösterilir, "doğrulanmadı" uyarısı taşır — Calculated/PASS-FAIL basılmaz', () => {
    const bytes = buildSentPulseLog({ statusNibble: 0, dataNibbles: [0, 0, 0, 0, 0, 0], crcNibble: 12 });
    const result = parseSent(bytes);
    expectSuccess(result);
    const crcField = result.frame.fields.find((f) => f.id === 'crc');
    expect(crcField?.physicalValue).toBe(12);
    expect(crcField?.warnings).toContain('protocol.sent.warning.crcNotVerified');
    expect(result.frame.warnings.some((w) => w.code === 'protocol.sent.warning.crcNotVerified')).toBe(true);
    // CRC doğrulanmadığı için TEK BAŞINA çerçeveyi geçersiz KILMAZ.
    expect(result.frame.valid).toBe(true);
  });

  it('Pause Pulse VARSA ayrı bir alan olarak görünür', () => {
    const bytes = buildSentPulseLog({
      statusNibble: 0,
      dataNibbles: [0, 0, 0, 0, 0, 0],
      crcNibble: 0,
      includePause: true,
      pauseDurationUs: 300,
    });
    const result = parseSent(bytes);
    expectSuccess(result);
    const pauseField = result.frame.fields.find((f) => f.id === 'pause');
    expect(pauseField).toBeDefined();
    expect(pauseField?.physicalValue).toBe('300.0');
  });

  it('Pause Pulse YOKSA alan tablosunda görünmez', () => {
    const bytes = buildSentPulseLog({ statusNibble: 0, dataNibbles: [0, 0, 0, 0, 0, 0], crcNibble: 0 });
    const result = parseSent(bytes);
    expectSuccess(result);
    expect(result.frame.fields.some((f) => f.id === 'pause')).toBe(false);
  });

  it('Pause’dan SONRA fazladan nabız varsa uyarır, çökmez', () => {
    const bytes = buildSentPulseLog({
      statusNibble: 0,
      dataNibbles: [0, 0, 0, 0, 0, 0],
      crcNibble: 0,
      includePause: true,
    });
    const withExtra = new Uint8Array(bytes.length + 2);
    withExtra.set(bytes);
    withExtra.set(encodePulseLog([50]), bytes.length);
    const result = parseSent(withExtra);
    expectSuccess(result);
    expect(result.frame.warnings.some((w) => w.code === 'protocol.sent.warning.trailingPulses')).toBe(true);
  });

  it('boş girdi truncated-frame ile başarısız olur', () => {
    const result = parseSent(new Uint8Array());
    expectFailure(result);
    expect(result.error.code).toBe('truncated-frame');
  });

  it('tek uzunlukta girdi truncated-frame ile başarısız olur', () => {
    const result = parseSent(new Uint8Array(3));
    expectFailure(result);
    expect(result.error.code).toBe('truncated-frame');
  });

  it('varsayılan profil için yetersiz nabız truncated-frame ile başarısız olur', () => {
    const result = parseSent(encodePulseLog([168, 51, 45]));
    expectFailure(result);
    expect(result.error.code).toBe('truncated-frame');
  });

  it('maxFrameLength aşılırsa frame-too-long ile başarısız olur', () => {
    const bytes = buildSentPulseLog({ statusNibble: 0, dataNibbles: [0, 0, 0, 0, 0, 0], crcNibble: 0 });
    const result = sentParser.parse(bytes, { maxFrameLength: 2 });
    expectFailure(result);
    expect(result.error.code).toBe('frame-too-long');
  });

  it('iptal edilmiş sinyal parser-timeout ile başarısız olur', () => {
    const controller = new AbortController();
    controller.abort();
    const bytes = buildSentPulseLog({ statusNibble: 0, dataNibbles: [0, 0, 0, 0, 0, 0], crcNibble: 0 });
    const result = sentParser.parse(bytes, { signal: controller.signal });
    expectFailure(result);
    expect(result.error.code).toBe('parser-timeout');
  });
});

describe('decodeSentNibbles — dışa açık çekirdek, ParseResult ÜRETMEZ', () => {
  it('yalnız fields/warnings/errors dizilerine yazar, kendi bir ParseResult döndürmez', () => {
    const bytes = buildSentPulseLog({ statusNibble: 1, dataNibbles: [2, 3, 4, 5, 6, 7], crcNibble: 8 });
    const decoded = decodePulseLog(bytes);
    if (!decoded.ok) throw new Error('expected ok');
    const fields: Parameters<typeof decodeSentNibbles>[4] = [];
    const warnings: Parameters<typeof decodeSentNibbles>[5] = [];
    const errors: Parameters<typeof decodeSentNibbles>[6] = [];
    const summary = decodeSentNibbles(bytes, decoded.result.pulses, 0, 6, fields, warnings, errors);
    expect(summary.statusNibble).toBe(1);
    expect(summary.dataNibbles).toEqual([2, 3, 4, 5, 6, 7]);
    expect(summary.crcReceivedNibble).toBe(8);
    expect(fields.length).toBeGreaterThan(0);
    // Dönüş değeri bir ParseResult DEĞİL, düz bir özet — success/frame alanı yok.
    expect(summary).not.toHaveProperty('success');
  });

  it('startPulseIndex parametresiyle KONTEYNERİN HERHANGİ bir yerinden başlayabilir (spc.ts’in kullandığı yol)', () => {
    const response = buildSentPulseLog({ statusNibble: 9, dataNibbles: [1, 1, 1, 1, 1, 1], crcNibble: 2 });
    const withLeadingPulse = new Uint8Array(2 + response.length);
    withLeadingPulse.set(encodePulseLog([999]));
    withLeadingPulse.set(response, 2);
    const decoded = decodePulseLog(withLeadingPulse);
    if (!decoded.ok) throw new Error('expected ok');
    const fields: Parameters<typeof decodeSentNibbles>[4] = [];
    const summary = decodeSentNibbles(withLeadingPulse, decoded.result.pulses, 1, 6, fields, [], []);
    expect(summary.statusNibble).toBe(9);
    // sync alanının offset'i KONTEYNERDEKİ gerçek konumu (2. bayttan) göstermeli, 0'dan DEĞİL.
    expect(fields.find((f) => f.id === 'sync')?.offset).toBe(2);
  });
});

describe('sentSignatureFromPulses / canParse — ORANLI imza (mutlak süre DEĞİL)', () => {
  it('kendi örnek çerçeveleri hâlâ true döner (invalid-nibble HARİÇ — aşağı bak)', () => {
    for (const example of sentPlugin.exampleFrames) {
      // invalid-nibble KASTEN bandın DIŞINDA bir nabız süresi taşıyor — bu
      // `j1850PwmPlugin`in "bad-crc" örneğinden FARKLI bir sınıf: CRC yalnış
      // bir DEĞER kusurudur (süre bandını hiç etkilemez), invalid-nibble ise
      // SÜRE düzeyinde bir anomalidir ve `canParse`in tam da yakalaması
      // GEREKEN şeydir (dosya başı, "canParse TUZAĞI"). Bu yüzden BİLEREK
      // false döner — aşağıdaki ayrı testte kanıtlanır.
      if (example.id === 'invalid-nibble') continue;
      expect(sentParser.canParse(example.bytes), example.id).toBe(true);
    }
  });

  it('invalid-nibble örneği canParse’i GEÇMEZ — bant dışı süre bir SİNYAL anomalisidir', () => {
    const invalidNibble = sentPlugin.exampleFrames.find((f) => f.id === 'invalid-nibble');
    if (invalidNibble === undefined) throw new Error('örnek bulunamadı');
    expect(sentParser.canParse(invalidNibble.bytes)).toBe(false);
  });

  it('truncated örneği YİNE DE canParse’i GEÇER — 4 nabız MUTLAK yapısal tabanı (sync+status+1data+crc) karşılıyor; "yetersiz" olması PROFİLE (varsayılan 6 nibble) göredir ve canParse decodeOptions’ı GÖRMEZ (`types.ts:182`, imza tek parametre alır) — `j1850CanParseRegistry.test.ts`teki "kendi örnekleri hâlâ true döner" testinin PWM/VPW için TÜM örnekleri (bad-crc dahil) geçirmesiyle AYNI katman ayrımı: canParse yapısal, parse() içerik/profil düzeyinde reddeder.', () => {
    const truncated = sentPlugin.exampleFrames.find((f) => f.id === 'truncated');
    if (truncated === undefined) throw new Error('örnek bulunamadı');
    expect(sentParser.canParse(truncated.bytes)).toBe(true);
    const parseResult = parseSent(truncated.bytes);
    expect(parseResult.success).toBe(false);
  });

  it('AYNI nibble içeriği FARKLI bir tick süresiyle de imzayı geçer — imza ORANLIDIR', () => {
    const slow = buildSentPulseLog({ statusNibble: 5, dataNibbles: [1, 10, 15, 3, 7, 2], crcNibble: 9, tickUs: 90 });
    const fast = buildSentPulseLog({ statusNibble: 5, dataNibbles: [1, 10, 15, 3, 7, 2], crcNibble: 9, tickUs: 3 });
    expect(sentSignatureFromPulses(decodePulseLogOrThrow(slow))).toBe(true);
    expect(sentSignatureFromPulses(decodePulseLogOrThrow(fast))).toBe(true);
  });

  it('tick aralığının (3-90 µs) DIŞINDA bir senkron darbesi imzayı reddeder', () => {
    // 56 tick × 200 µs = 11200 µs — spec'in tick üst sınırının (90 µs) çok üstünde.
    const bytes = encodePulseLog([11200, 51, 45, 60, 51, 45, 60, 51, 45]);
    expect(sentSignatureFromPulses(decodePulseLogOrThrow(bytes))).toBe(false);
  });

  it('SOF SONRASI tek bir nabız bile bandın dışındaysa imza reddeder (14f’in "yalnız SOF yetmez" dersi)', () => {
    const valid = buildSentPulseLog({ statusNibble: 5, dataNibbles: [1, 10, 15, 3, 7, 2], crcNibble: 9 });
    const decoded = decodePulseLogOrThrow(valid);
    const tampered = decoded.slice();
    // data-nibble-3'ü (index 4) bandın dışına taşı.
    tampered[4] = { rawRegister: 9999, durationUs: 999, reserved: false };
    expect(sentSignatureFromPulses(tampered)).toBe(false);
  });

  it('minimum nabız sayısının altında false döner', () => {
    expect(sentSignatureFromPulses(decodePulseLogOrThrow(encodePulseLog([168, 51, 45])))).toBe(false);
  });
});

function decodePulseLogOrThrow(bytes: Uint8Array) {
  const decoded = decodePulseLog(bytes);
  if (!decoded.ok) throw new Error('expected ok');
  return decoded.result.pulses;
}

describe('tolerans sabitleri — kaynak çapraz kontrolü', () => {
  it('56 tick × [3,90] µs senkron bandını üretir (spec özetinin AÇILIŞ örneği 168 µs = 56×3 İLE ÖRTÜŞÜR)', () => {
    expect(SENT_SYNC_TICKS).toBe(56);
    expect(SENT_SYNC_TICKS * 3).toBe(168);
  });

  it('nibble bandı [12,27] tick, en yüksek nibble değeri 15’tir', () => {
    expect(SENT_NIBBLE_TICKS_MIN).toBe(12);
    expect(SENT_NIBBLE_TICKS_MAX).toBe(27);
    expect(SENT_MAX_NIBBLE_VALUE).toBe(15);
  });

  it('varsayılan veri nibble sayısı 6’dır', () => {
    expect(SENT_DEFAULT_DATA_NIBBLE_COUNT).toBe(6);
  });
});
