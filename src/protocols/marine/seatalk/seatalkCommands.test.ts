import { describe, expect, it } from 'vitest';

import {
  SEATALK_COMMANDS,
  SEATALK_DECODED_COMMAND_COUNT,
  SEATALK_RECOGNIZED_COMMAND_COUNT,
  crossConfirmedKeyName,
  decodeSeatalkCourse,
  decodeSeatalkHeading,
  findSeatalkCommand,
  headingCorrectionByBitCount,
  headingCorrectionBySignalKQuirk,
} from './seatalkCommands';

/**
 * Faz 10 dalga 16b — komut tablosunun bekçisi.
 * Sınanan şey tablonun İÇERİĞİ değil (o veri), **kapsam kararının kodda
 * gerçekten uygulandığıdır**: 59 tanınır / 22 çözülür, çift-kaynak ölçütünün
 * dışında kalan hiçbir komutun çözücüsü YOKTUR ve iki başlık formülü
 * BİRBİRİNE KARIŞMAMIŞTIR.
 */
describe('SeaTalk komut tablosu — kapsam kararı', () => {
  it('Knauf Part 2 sayımı 59 komuttur (brifteki 60 fantom `C7` içeriyordu)', () => {
    expect(SEATALK_RECOGNIZED_COMMAND_COUNT).toBe(59);
    expect(SEATALK_COMMANDS).toHaveLength(59);
    // `C7` Knauf Part 2'de yalnız `A1 … C1 C2 … C7 C8` waypoint ad
    // yer tutucusu olarak geçiyor — komut baytı DEĞİL.
    expect(findSeatalkCommand(0xc7)).toBeUndefined();
  });

  it('payload YALNIZ çift-kaynaklı 22 komutta çözülür', () => {
    expect(SEATALK_DECODED_COMMAND_COUNT).toBe(22);
    const decodedCommands = SEATALK_COMMANDS.filter((entry) => entry.decodePayload !== undefined).map(
      (entry) => entry.command,
    );
    // SignalK `src/hooks/seatalk/index.ts`in 21 hook'u ∪ canboat'ın komut
    // baytına eşlediği 0x86 (`126720-seatalk1Keystroke.yaml`, match 134).
    expect(decodedCommands).toEqual([
      0x00, 0x10, 0x11, 0x20, 0x21, 0x22, 0x25, 0x26, 0x27, 0x50, 0x51, 0x52, 0x53, 0x54, 0x56, 0x57,
      0x82, 0x84, 0x85, 0x86, 0x99, 0x9c,
    ]);
  });

  it('komut baytları benzersiz ve ARTAN sırada', () => {
    const commands = SEATALK_COMMANDS.map((entry) => entry.command);
    expect(new Set(commands).size).toBe(commands.length);
    expect([...commands].sort((left, right) => left - right)).toEqual(commands);
  });

  it('her komutun adı VERİDİR — çeviri anahtarı biçiminde OLAMAZ', () => {
    for (const entry of SEATALK_COMMANDS) {
      expect(entry.name.startsWith('protocol.'), `${entry.command} çeviri anahtarı taşıyor`).toBe(false);
      expect(entry.name.length).toBeGreaterThan(0);
    }
  });

  it('tümleyen çifti YALNIZ Knauf’un küçük harfle gösterdiği komutlarda tanımlı', () => {
    const withPairs = SEATALK_COMMANDS.filter((entry) => entry.complementPairs !== undefined).map(
      (entry) => entry.command,
    );
    // `38 X1 YY yy`, `55 X1 YY yy`, `82 … XX xx YY yy ZZ zz`, `85 … YF 00 yf`, `86 X1 YY yy`
    expect(withPairs).toEqual([0x38, 0x55, 0x82, 0x85, 0x86]);
  });
});

describe('Başlık formülleri — İKİSİ AYNI DEĞİLDİR', () => {
  it('84/9C düzeltme terimi Knauf’un İngilizce metnidir: SET olan bit SAYISI', () => {
    expect(headingCorrectionByBitCount(0x0)).toBe(0);
    expect(headingCorrectionByBitCount(0x4)).toBe(1);
    expect(headingCorrectionByBitCount(0x8)).toBe(1);
    expect(headingCorrectionByBitCount(0xc)).toBe(2);
  });

  it('SignalK’in koruduğu öncelik hatası FARKLI bir değer üretir — ayrışma ölçülür', () => {
    // `U & 0xC == 0xC` C'de `U & 1`e çöküyor (SignalK 0x84.ts kendi yorumunda
    // bunu yazıyor ve "test suite green" diye KORUYOR).
    expect(headingCorrectionBySignalKQuirk(0x0)).toBe(0);
    expect(headingCorrectionBySignalKQuirk(0x4)).toBe(1);
    expect(headingCorrectionBySignalKQuirk(0xc)).toBe(1);
    expect(headingCorrectionBySignalKQuirk(0x5)).toBe(2);

    const divergent = [0x0, 0x1, 0x2, 0x3, 0x4, 0x5, 0x6, 0x7, 0x8, 0x9, 0xa, 0xb, 0xc, 0xd, 0xe, 0xf].filter(
      (u) => headingCorrectionByBitCount(u) !== headingCorrectionBySignalKQuirk(u),
    );
    expect(divergent).toEqual([0x5, 0x7, 0x9, 0xb, 0xc, 0xe]);
  });

  it('84/9C başlığı üç terimlidir ve sadeleştirilemez', () => {
    // U=1, VW=0x2D → (1&3)*90 + (0x2D&0x3F)*2 + 0 = 90 + 90 = 180
    expect(decodeSeatalkHeading(0x1, 0x2d)).toEqual({ degrees: 180, ambiguous: false });
    // "Makul" sadeleştirme (U&3)*90 + VW/2 = 90 + 22.5 = 112.5 — YANLIŞ.
    expect(decodeSeatalkHeading(0x1, 0x2d).degrees).not.toBe(112.5);
    // U=0xC: düzeltme 2, iki okuma AYRIŞIYOR.
    expect(decodeSeatalkHeading(0xc, 0x2d)).toEqual({ degrees: 92, ambiguous: true });
  });

  it('53/89 (COG) ÜÇÜNCÜ TERİMİ FARKLIDIR: `(U & 0xC) / 8`', () => {
    expect(decodeSeatalkCourse(0x0, 0x2d)).toBe(90);
    // U=0x4 → (4 & 0xC)/8 = 0.5 (84/9C’de aynı U için düzeltme 1 olurdu)
    expect(decodeSeatalkCourse(0x4, 0x2d)).toBe(90.5);
    expect(headingCorrectionByBitCount(0x4)).toBe(1);
    // Knauf’un 85 örneğiyle aynı sınıf: U=2, VW=0x64 → 180 + 72 = 252
    expect(decodeSeatalkCourse(0x2, 0x64)).toBe(252);
  });
});

describe('0x86 tuş kodları — YALNIZ iki kaynakta örtüşenler adlandırılır', () => {
  it('canboat SEATALK_KEYSTROKE ile Knauf Part 2’nin örtüştüğü sekiz kod', () => {
    expect(crossConfirmedKeyName(0x01)).toBe('Auto');
    expect(crossConfirmedKeyName(0x02)).toBe('Standby');
    expect(crossConfirmedKeyName(0x05)).toBe('-1');
    expect(crossConfirmedKeyName(0x06)).toBe('-10');
    expect(crossConfirmedKeyName(0x07)).toBe('+1');
    expect(crossConfirmedKeyName(0x08)).toBe('+10');
    expect(crossConfirmedKeyName(0x21)).toBe('-1 and -10');
    expect(crossConfirmedKeyName(0x22)).toBe('+1 and +10');
  });

  it('kaynakların ÇELİŞTİĞİ kodlar adlandırılmaz', () => {
    // canboat `3: Wind` derken Knauf `X1 03 FC → Track` diyor.
    expect(crossConfirmedKeyName(0x03)).toBeUndefined();
    // canboat `35: Track` derken Knauf `X1 23 DC → Standby & Auto (wind mode)` diyor.
    expect(crossConfirmedKeyName(0x23)).toBeUndefined();
    // Yalnız Knauf'ta olanlar da adlandırılmaz.
    expect(crossConfirmedKeyName(0x45)).toBeUndefined();
    expect(crossConfirmedKeyName(0x84)).toBeUndefined();
  });
});
