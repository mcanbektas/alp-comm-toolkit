import { describe, expect, it } from 'vitest';

import type { ParsedField, ParsedFrame, ParseResult } from '@/protocol-core/types';
import { isParseSuccess } from '@/protocol-core/types';

import { analyzeSeatalkChain, seatalkDatagramLength, seatalkParser, seatalkPlugin } from './seatalk';

/**
 * Faz 10 dalga 16b — SeaTalk 1 motoru.
 *
 * Fixture'ların ÇOĞU Knauf Part 2'nin GERÇEK yakalamalarıdır ve birkaçı
 * kaynağın KENDİ örnek hesabını doğrular (`85`in tek çerçevesi Knauf'un ÜÇ
 * ayrı worked example'ını aynı anda sınar). Türetilmiş fixture'lar
 * yorumlarında böyle işaretlidir — spec §43 disiplininin bu dosyadaki karşılığı.
 */

function parse(bytes: number[], options?: Record<string, unknown>): ParseResult {
  return seatalkParser.parse(Uint8Array.from(bytes), options === undefined ? undefined : { options });
}

function expectFrame(result: ParseResult): ParsedFrame {
  expect(isParseSuccess(result), 'çözüm başarısız').toBe(true);
  if (!isParseSuccess(result)) throw new Error('unreachable');
  return result.frame;
}

function field(frame: ParsedFrame, id: string): ParsedField {
  const found = frame.fields.find((entry) => entry.id === id);
  expect(found, `alan bulunamadı: ${id} (var olanlar: ${frame.fields.map((f) => f.id).join(', ')})`).toBeDefined();
  if (found === undefined) throw new Error('unreachable');
  return found;
}

function warningCodes(frame: ParsedFrame): string[] {
  return frame.warnings.map((warning) => warning.code);
}

describe('Zarf — `3 + (attribute & 0x0F)` formülü', () => {
  it('uzunluk formülü asgari (3 bayt) ve azami (18 bayt) sınırlarda tutar', () => {
    expect(seatalkDatagramLength(0x00)).toBe(3);
    expect(seatalkDatagramLength(0x0f)).toBe(18);
    // Yüksek nibble uzunluğu ETKİLEMEZ — o VERİDİR.
    expect(seatalkDatagramLength(0xf0)).toBe(3);
    expect(seatalkDatagramLength(0xaf)).toBe(18);
  });

  it('asgari 3 baytlık datagram çözülür (`53 U0 VW` — Course over Ground)', () => {
    const frame = expectFrame(parse([0x53, 0x00, 0x2d]));
    expect(field(frame, 'attribute-additional-byte-count').rawValue).toBe(0);
    expect(field(frame, 'course-over-ground').physicalValue).toBe(90);
    expect(field(frame, 'course-over-ground').unit).toBe('°');
  });

  it('azami 18 baytlık datagram çözülür', () => {
    const bytes = [0x9e, 0x0f, ...Array.from({ length: 16 }, () => 0x00)];
    const frame = expectFrame(parse(bytes));
    expect(frame.rawFrame.bytes).toHaveLength(18);
    expect(field(frame, 'attribute-additional-byte-count').rawValue).toBe(15);
    expect(field(frame, 'data').length).toBe(16);
  });

  it('attribute’ın YÜKSEK nibble’ı VERİDİR, dolgu değil — ayrı alan olarak basılır', () => {
    // `25 Z4 XX YY UU VV AW` — Z toplam sayacının en üst 4 bitidir.
    const frame = expectFrame(parse([0x25, 0x34, 0x10, 0x00, 0x20, 0x00, 0x02]));
    expect(field(frame, 'attribute-data-nibble').rawValue).toBe(0x3);
    expect(field(frame, 'attribute-additional-byte-count').rawValue).toBe(4);
    // total = (0x10 + 0x00*256 + 3*65536) / 10
    expect(field(frame, 'total-log').rawValue).toBe(0x10 + 3 * 65536);
    expect(field(frame, 'total-log').physicalValue).toBeCloseTo((0x10 + 3 * 65536) / 10, 6);
    // trip = (0x20 + 0x00*256 + 2*65536) / 100
    expect(field(frame, 'trip-log').physicalValue).toBeCloseTo((0x20 + 2 * 65536) / 100, 6);
  });

  it('komut baytı "(assumed)" adını taşır ve alan uyarısı basar', () => {
    const frame = expectFrame(parse([0x86, 0x11, 0x05, 0xfa]));
    const command = field(frame, 'command');
    expect(command.name).toBe('Command (assumed)');
    expect(command.rawValue).toBe('0x86');
    expect(command.physicalValue).toBe('Keystroke');
    expect(command.warnings).toContain('protocol.seatalk.field.commandAssumed');
  });
});

describe('KOŞULSUZ uyarılar — çerçevede olmayan bit ve olmayan checksum', () => {
  it('`commandBitNotInBytes` HER çözümde basılır', () => {
    for (const example of seatalkPlugin.exampleFrames) {
      const result = seatalkParser.parse(example.bytes);
      const frame = expectFrame(result);
      expect(warningCodes(frame), example.id).toContain('commandBitNotInBytes');
    }
  });

  it('`noIntegrityCheckOnWire` HER çözümde basılır — checksum YOKTUR', () => {
    for (const example of seatalkPlugin.exampleFrames) {
      const frame = expectFrame(seatalkParser.parse(example.bytes));
      expect(warningCodes(frame), example.id).toContain('noIntegrityCheckOnWire');
    }
  });

  it('hiçbir alan "checksum"/"crc" adı taşımaz — uydurma doğrulama yok', () => {
    for (const example of seatalkPlugin.exampleFrames) {
      const result = seatalkParser.parse(example.bytes);
      if (!isParseSuccess(result)) continue;
      for (const parsedField of result.frame.fields) {
        expect(/checksum|crc/i.test(parsedField.name), `${example.id}/${parsedField.id}`).toBe(false);
      }
    }
  });
});

describe('Tümleyen çifti — YALNIZ tanımlı olduğu komutlarda', () => {
  it('`86 11 05 FA` (Knauf’un gerçek yakalaması) PASS verir', () => {
    const frame = expectFrame(parse([0x86, 0x11, 0x05, 0xfa]));
    const complement = field(frame, 'complement-3');
    expect(complement.physicalValue).toBe('PASS');
    expect(complement.valid).toBe(true);
    expect(frame.valid).toBe(true);
    expect(frame.errors).toEqual([]);
  });

  it('bozulmuş tümleyen FAIL verir ve çerçeveyi geçersiz kılar', () => {
    const frame = expectFrame(parse([0x86, 0x11, 0x05, 0xfb]));
    const complement = field(frame, 'complement-3');
    expect(complement.valid).toBe(false);
    expect(String(complement.physicalValue)).toContain('FAIL');
    expect(frame.valid).toBe(false);
    // Bu bir CHECKSUM değildir → `checksum-mismatch` kodu KULLANILMAZ.
    expect(frame.errors.map((error) => error.code)).toEqual(['value-out-of-range']);
  });

  it('tanımlı OLMAYAN komutta tümleyen alanı HİÇ BASILMAZ', () => {
    const frame = expectFrame(parse([0x00, 0x02, 0x00, 0x10, 0x01]));
    expect(frame.fields.some((entry) => entry.id.startsWith('complement-'))).toBe(false);
  });

  it('`complementCheck: false` alanı kaldırır ve çerçeveyi geçerli bırakır', () => {
    const frame = expectFrame(parse([0x86, 0x11, 0x05, 0xfb], { complementCheck: 'false' }));
    expect(frame.fields.some((entry) => entry.id.startsWith('complement-'))).toBe(false);
    expect(frame.valid).toBe(true);
  });
});

describe('Çözülen komutlar — Knauf’un kendi örnekleriyle', () => {
  it('`00` Depth: bayraklar ayrı alan, derinlik DAİMA feet', () => {
    // Y=6 (metrik EKRAN bayrağı + "kullanılıyor"), Z=0, XXXX = 0x0110 = 272
    const frame = expectFrame(parse([0x00, 0x02, 0x60, 0x10, 0x01]));
    expect(field(frame, 'depth-below-transducer').rawValue).toBe(272);
    expect(field(frame, 'depth-below-transducer').physicalValue).toBeCloseTo(27.2, 6);
    // Metrik bayrağı EKRANIN tercihidir; teldeki ölçek DEĞİŞMEZ.
    expect(field(frame, 'depth-below-transducer').unit).toBe('ft');
    expect(field(frame, 'depth-metric-display').rawValue).toBe(1);
    expect(field(frame, 'depth-anchor-alarm').rawValue).toBe(0);
    expect(field(frame, 'depth-shallow-alarm').rawValue).toBe(0);
    // Ham bayrak alanına BİRİM VERİLMEZ.
    expect(field(frame, 'depth-metric-display').unit).toBeUndefined();
  });

  it('`20` Speed Through Water little-endian okunur (SignalK burada baytları TOPLUYOR)', () => {
    // 0x13 0x57 → 0x5713 = 22291 (Knauf Part 1 §Data Coding’in kendi örneği)
    const frame = expectFrame(parse([0x20, 0x01, 0x13, 0x57]));
    expect(field(frame, 'speed-through-water').rawValue).toBe(0x5713);
    // SignalK’in hatalı toplaması 0x13 + 0x57 = 106 verirdi.
    expect(field(frame, 'speed-through-water').rawValue).not.toBe(0x13 + 0x57);
  });

  it('`10` Apparent Wind Angle BÜYÜK-endian’dır (Knauf `XXYY` yazıyor)', () => {
    const frame = expectFrame(parse([0x10, 0x01, 0x01, 0x68]));
    expect(field(frame, 'apparent-wind-angle').rawValue).toBe(0x0168);
    expect(field(frame, 'apparent-wind-angle').physicalValue).toBe(0x0168 / 2);
  });

  it('`11` Apparent Wind Speed: 7 bit tam + nibble ondalık + gösterim birimi bayrağı', () => {
    const frame = expectFrame(parse([0x11, 0x01, 0x8c, 0x05]));
    expect(field(frame, 'apparent-wind-speed').physicalValue).toBeCloseTo(12.5, 6);
    expect(field(frame, 'apparent-wind-speed').unit).toBe('kn');
    expect(field(frame, 'apparent-wind-speed-display-unit').physicalValue).toBe('m/s');
  });

  it('`27` Water Temperature: `(XXXX - 100) / 10`', () => {
    const frame = expectFrame(parse([0x27, 0x01, 0x2c, 0x01]));
    expect(field(frame, 'water-temperature').physicalValue).toBeCloseTo((0x012c - 100) / 10, 6);
    expect(field(frame, 'water-temperature').unit).toBe('°C');
  });

  it('`50`/`51` konum: derece + dakika + yarımküre biti ayrı alanlar', () => {
    const lat = expectFrame(parse([0x50, 0x02, 0x35, 0x10, 0x92]));
    expect(field(lat, 'lat-degrees').rawValue).toBe(0x35);
    expect(field(lat, 'lat-minutes').physicalValue).toBeCloseTo((0x9210 & 0x7fff) / 100, 6);
    expect(field(lat, 'lat-hemisphere').physicalValue).toBe('South');

    const lon = expectFrame(parse([0x51, 0x02, 0x05, 0x10, 0x12]));
    expect(field(lon, 'lon-hemisphere').physicalValue).toBe('West');
  });

  it('`54` GMT: saniye nibble’ları attribute ile byte 2’ye YAYILIR', () => {
    // T=8 (attribute yüksek nibble), RS=0x8B → dakika 34, saniye 8 + 3*16 = 56
    const frame = expectFrame(parse([0x54, 0x81, 0x8b, 0x0c]));
    expect(field(frame, 'gmt-hours').rawValue).toBe(12);
    expect(field(frame, 'gmt-minutes').rawValue).toBe(34);
    expect(field(frame, 'gmt-seconds').rawValue).toBe(56);
    // Saniye alanı İKİ baytı kapsıyor (attribute + RS) — bit ayrıntısı ADDA.
    expect(field(frame, 'gmt-seconds').offset).toBe(1);
    expect(field(frame, 'gmt-seconds').length).toBe(2);
  });

  it('`56` Date yüzyıl VARSAYMAZ — ham YY basılır', () => {
    const frame = expectFrame(parse([0x56, 0x51, 0x1a, 0x18]));
    expect(field(frame, 'date-month').rawValue).toBe(5);
    expect(field(frame, 'date-day').rawValue).toBe(0x1a);
    expect(field(frame, 'date-year').rawValue).toBe(0x18);
    expect(field(frame, 'date-year').physicalValue).toBeUndefined();
  });

  it('`57` Satellite Info: sayı attribute nibble’ında', () => {
    const frame = expectFrame(parse([0x57, 0x60, 0x94]));
    expect(field(frame, 'satellite-count').rawValue).toBe(6);
    expect(field(frame, 'horizontal-dilution').rawValue).toBe(0x94);
  });

  it('`82` Target Waypoint Name: dört karakter + ÜÇ tümleyen çifti', () => {
    const frame = expectFrame(parse([0x82, 0x05, 0x27, 0xd8, 0x48, 0xb7, 0x06, 0xf9]));
    expect(field(frame, 'target-waypoint-name').physicalValue).toBe('WPT1');
    for (const id of ['complement-3', 'complement-5', 'complement-7']) {
      expect(field(frame, id).physicalValue, id).toBe('PASS');
    }
    expect(frame.valid).toBe(true);
  });

  it('`84` Autopilot: başlık, kurs, mod bitleri ve işaretli dümen açısı', () => {
    // U=1, VW=0x2D → 180°; V=2, XY=0x64 → kurs 50°; Z=2 Auto; M=4 off-course;
    // RR=0xFE → −2° (Knauf: "0xFE = 2° left")
    const frame = expectFrame(parse([0x84, 0x16, 0x2d, 0x64, 0x02, 0x04, 0xfe, 0x02, 0x08]));
    expect(field(frame, 'compass-heading').physicalValue).toBe(180);
    expect(field(frame, 'compass-heading').unit).toBe('°');
    expect(field(frame, 'autopilot-course').physicalValue).toBe(50);
    expect(field(frame, 'autopilot-auto-mode').rawValue).toBe(1);
    expect(field(frame, 'autopilot-vane-mode').rawValue).toBe(0);
    expect(field(frame, 'autopilot-track-mode').rawValue).toBe(0);
    expect(field(frame, 'autopilot-alarm-off-course').rawValue).toBe(1);
    expect(field(frame, 'autopilot-alarm-wind-shift').rawValue).toBe(0);
    expect(field(frame, 'rudder-position').physicalValue).toBe(-2);
    // SS/TT tek kaynaklıdır: HAM basılır, bit anlamları ADLANDIRILMAZ.
    expect(field(frame, 'autopilot-display-flags').physicalValue).toBeUndefined();
    expect(field(frame, 'autopilot-computer-type').rawValue).toBe('0x08');
  });

  it('`84` mod bitleri Vane ve Track için ayrı ayrı yükselir', () => {
    const vane = expectFrame(parse([0x84, 0x16, 0x2d, 0x64, 0x04, 0x00, 0x00, 0x00, 0x08]));
    expect(field(vane, 'autopilot-vane-mode').rawValue).toBe(1);
    expect(field(vane, 'autopilot-auto-mode').rawValue).toBe(0);

    const track = expectFrame(parse([0x84, 0x16, 0x2d, 0x64, 0x0a, 0x08, 0x00, 0x00, 0x08]));
    expect(field(track, 'autopilot-track-mode').rawValue).toBe(1);
    expect(field(track, 'autopilot-auto-mode').rawValue).toBe(1);
    expect(field(track, 'autopilot-alarm-wind-shift').rawValue).toBe(1);
  });

  it('`85` TEK çerçeve Knauf’un ÜÇ worked example’ını aynı anda doğrular', () => {
    // XTE 2.61 nm → "X6XX = 5_ 10"; bearing 230° → "VUZW = 42_6";
    // menzil 5.13 nm sola → "ZW ZZ YF = 1_ 20 1_".
    const frame = expectFrame(parse([0x85, 0x56, 0x10, 0x42, 0x16, 0x20, 0x17, 0x00, 0xe8]));
    expect(field(frame, 'cross-track-error').rawValue).toBe(0x105);
    expect(field(frame, 'cross-track-error').physicalValue).toBeCloseTo(2.61, 6);
    expect(field(frame, 'bearing-to-destination').physicalValue).toBe(230);
    expect(field(frame, 'bearing-reference').physicalValue).toBe('magnetic');
    expect(field(frame, 'range-to-destination').physicalValue).toBeCloseTo(5.13, 6);
    expect(field(frame, 'steer-direction').physicalValue).toBe('left');
    // `YF` / `yf` tümleyen çifti.
    expect(field(frame, 'complement-8').physicalValue).toBe('PASS');
    // SignalK’in `(X << 8) | XX` okuması 0x510 = 12.96 nm verirdi — çürütüldü.
    expect(field(frame, 'cross-track-error').rawValue).not.toBe(0x510);
  });

  it('`85` "veri mevcut" bayrağı düşükken alan uyarı taşır', () => {
    // F = 0x0 → hiçbiri mevcut değil.
    const frame = expectFrame(parse([0x85, 0x56, 0x10, 0x42, 0x16, 0x20, 0x10, 0x00, 0xef]));
    expect(field(frame, 'cross-track-error').warnings).toContain('protocol.seatalk.field.valueNotPresent');
    expect(field(frame, 'bearing-to-destination').warnings).toContain(
      'protocol.seatalk.field.valueNotPresent',
    );
    expect(field(frame, 'range-to-destination').warnings).toContain('protocol.seatalk.field.valueNotPresent');
  });

  it('`86` tuş adı YALNIZ çift teyitli kodda basılır', () => {
    const confirmed = expectFrame(parse([0x86, 0x11, 0x05, 0xfa]));
    expect(field(confirmed, 'keystroke-key').physicalValue).toBe('-1');
    expect(field(confirmed, 'keystroke-key').warnings).toEqual([]);
    expect(field(confirmed, 'keystroke-device').rawValue).toBe(1);

    // 0x03: canboat "Wind" ↔ Knauf "Track" — ÇELİŞİYOR, adlandırılmaz.
    const contested = expectFrame(parse([0x86, 0x11, 0x03, 0xfc]));
    expect(field(contested, 'keystroke-key').physicalValue).toBeUndefined();
    expect(field(contested, 'keystroke-key').warnings).toContain(
      'protocol.seatalk.field.keyCodeSingleSource',
    );
  });

  it('`99` Compass Variation işaretlidir ve pozitif değer DOĞUYU gösterir', () => {
    expect(field(expectFrame(parse([0x99, 0x00, 0x01])), 'compass-variation').physicalValue).toBe(-1);
    expect(field(expectFrame(parse([0x99, 0x00, 0xff])), 'compass-variation').physicalValue).toBe(1);
    expect(field(expectFrame(parse([0x99, 0x00, 0x00])), 'compass-variation').physicalValue).toBe(-0);
  });

  it('`9C` başlık ayrışması alan uyarısı basar, ayrışmıyorsa basmaz', () => {
    const clean = expectFrame(parse([0x9c, 0x11, 0x2d, 0xfe]));
    expect(field(clean, 'compass-heading').physicalValue).toBe(180);
    expect(field(clean, 'compass-heading').warnings).toEqual([]);
    expect(field(clean, 'rudder-position').physicalValue).toBe(-2);
    expect(field(clean, 'turning-direction').physicalValue).toContain('left');

    // U = 0xC → popcount 2, SignalK’in okuması 1 → AYRIŞIYOR.
    const ambiguous = expectFrame(parse([0x9c, 0xc1, 0x2d, 0x00]));
    expect(field(ambiguous, 'compass-heading').warnings).toContain(
      'protocol.seatalk.field.headingCorrectionAmbiguous',
    );
    expect(field(ambiguous, 'turning-direction').physicalValue).toContain('right');
  });
});

describe('TANINIR AMA ÇÖZÜLMEZ — 37 komutun politikası', () => {
  it('`A7` adı basılır, payload HAM kalır, vendor-map uyarısı düşer', () => {
    const frame = expectFrame(
      parse([0xa7, 0x09, 0x86, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x79]),
    );
    expect(field(frame, 'command').physicalValue).toBe('Unknown Meaning (Raystar 120 GPS)');
    expect(field(frame, 'data').length).toBe(10);
    expect(field(frame, 'data').warnings).toContain('protocol.seatalk.field.payloadNotDecoded');
    expect(warningCodes(frame)).toContain('commandPayloadNeedsVendorMap');
  });

  it('`01` Equipment ID (gerçek yakalama) TANINIR ama çözülmez', () => {
    const frame = expectFrame(parse([0x01, 0x05, 0x00, 0x00, 0x00, 0x60, 0x01, 0x00]));
    expect(field(frame, 'command').physicalValue).toBe('Equipment ID');
    expect(warningCodes(frame)).toContain('commandPayloadNeedsVendorMap');
  });

  it('Knauf’ta HİÇ olmayan komut baytı `commandNotDocumented` uyarısı verir', () => {
    const frame = expectFrame(parse([0xc7, 0x01, 0x00, 0x00]));
    expect(field(frame, 'command').physicalValue).toBeUndefined();
    expect(warningCodes(frame)).toContain('commandNotDocumented');
  });
});

describe('decodeOptions — dört kanalın her biri', () => {
  it('`semanticDepth: envelope` komutu adlandırır ama payload’ı çözmez', () => {
    const frame = expectFrame(parse([0x86, 0x11, 0x05, 0xfa], { semanticDepth: 'envelope' }));
    expect(field(frame, 'command').physicalValue).toBe('Keystroke');
    expect(frame.fields.some((entry) => entry.id === 'keystroke-key')).toBe(false);
    expect(field(frame, 'data').rawValue).toBe('05 FA');
    expect(warningCodes(frame)).toContain('envelopeOnly');
  });

  it('`semanticDepth: raw` HİÇ adlandırma yapmaz, her veri baytı ayrı basılır', () => {
    const frame = expectFrame(parse([0x86, 0x11, 0x05, 0xfa], { semanticDepth: 'raw' }));
    expect(field(frame, 'command').physicalValue).toBeUndefined();
    expect(field(frame, 'data-byte-2').rawValue).toBe('0x05');
    expect(field(frame, 'data-byte-3').rawValue).toBe('0xFA');
    expect(warningCodes(frame)).toContain('rawModeNoNaming');
  });

  it('`strictLength: true` kısa datagramda `success: false` döner', () => {
    // attribute 0x11 → beklenen 4 bayt, girdide 3 var.
    const result = parse([0x86, 0x11, 0x05]);
    expect(result.success).toBe(false);
    if (result.success) throw new Error('unreachable');
    expect(result.error.code).toBe('truncated-frame');
  });

  it('`strictLength: true` FAZLA baytta da hata verir, `false` uyarıya düşürür', () => {
    const strict = parse([0x86, 0x11, 0x05, 0xfa, 0x00]);
    expect(strict.success).toBe(false);
    if (strict.success) throw new Error('unreachable');
    expect(strict.error.code).toBe('length-mismatch');

    const lenient = expectFrame(parse([0x86, 0x11, 0x05, 0xfa, 0x00], { strictLength: 'false' }));
    expect(warningCodes(lenient)).toContain('lengthMismatch');
    expect(field(lenient, 'keystroke-key').physicalValue).toBe('-1');
  });

  it('`commandByteSource: lengthChained` çok datagramlı girdiyi döşer', () => {
    const chained = [0x86, 0x11, 0x05, 0xfa, 0x9c, 0x11, 0x2d, 0xfe, 0x53, 0x00, 0x2d];
    expect(analyzeSeatalkChain(Uint8Array.from(chained))).toEqual({ tiled: true, datagramCount: 3 });

    const frame = expectFrame(parse(chained, { commandByteSource: 'lengthChained' }));
    expect(field(frame, 'datagram-chain').rawValue).toBe(3);
    expect(warningCodes(frame)).toContain('additionalDatagramsNotDecoded');
    // YALNIZ İLK datagram çözülür.
    expect(field(frame, 'keystroke-key').physicalValue).toBe('-1');
    expect(frame.fields.some((entry) => entry.id === 'compass-heading')).toBe(false);
  });

  it('`lengthChained` döşemeyen girdide sınırın DOĞRULANAMADIĞINI söyler', () => {
    const misaligned = [0x86, 0x11, 0x05, 0xfa, 0x9c, 0x15, 0x2d];
    expect(analyzeSeatalkChain(Uint8Array.from(misaligned)).tiled).toBe(false);

    const strict = parse(misaligned, { commandByteSource: 'lengthChained' });
    expect(strict.success).toBe(false);
    if (strict.success) throw new Error('unreachable');
    expect(strict.error.code).toBe('length-mismatch');

    const lenient = expectFrame(
      parse(misaligned, { commandByteSource: 'lengthChained', strictLength: 'false' }),
    );
    expect(warningCodes(lenient)).toContain('datagramBoundaryUnverified');
  });

  it('dört kanalın hepsi `decodeOptions` olarak bildirilmiş', () => {
    expect(seatalkPlugin.decodeOptions?.map((option) => option.id)).toEqual([
      'commandByteSource',
      'semanticDepth',
      'strictLength',
      'complementCheck',
    ]);
  });
});

describe('Sözleşme ve kapsam', () => {
  it('`canParse` DAİMA `false` — kendi örneklerinde bile', () => {
    expect(seatalkPlugin.exampleFrames.length).toBeGreaterThan(0);
    for (const example of seatalkPlugin.exampleFrames) {
      expect(seatalkParser.canParse(example.bytes), example.id).toBe(false);
    }
    expect(seatalkParser.canParse(Uint8Array.from([0x86, 0x11, 0x05, 0xfa]))).toBe(false);
    expect(seatalkParser.canParse(new Uint8Array(0))).toBe(false);
  });

  it('`build` sekmesi olmadığı için `encoder` YAZILMAMIŞTIR', () => {
    expect(seatalkPlugin.encoder).toBeUndefined();
  });

  it('örnek çerçevelerin `expectedValid` beyanı motorun sonucuyla tutar', () => {
    for (const example of seatalkPlugin.exampleFrames) {
      const result = seatalkParser.parse(example.bytes);
      const frame = expectFrame(result);
      expect(frame.valid, example.id).toBe(example.expectedValid ?? true);
    }
  });

  it('`ParsedFrame` DÜZDÜR ve alan offset/length BAYT cinsindendir', () => {
    const frame = expectFrame(parse([0x85, 0x56, 0x10, 0x42, 0x16, 0x20, 0x17, 0x00, 0xe8]));
    for (const entry of frame.fields) {
      expect(Object.hasOwn(entry, 'children'), entry.id).toBe(false);
      expect(entry.offset).toBeGreaterThanOrEqual(0);
      expect(entry.offset + entry.length).toBeLessThanOrEqual(9);
      expect(entry.rawBytes).toHaveLength(entry.length);
    }
  });

  it('boş girdi ve iptal edilmiş çözüm hata döndürür', () => {
    const empty = seatalkParser.parse(new Uint8Array(0));
    expect(empty.success).toBe(false);
    if (empty.success) throw new Error('unreachable');
    expect(empty.error.code).toBe('truncated-frame');

    const controller = new AbortController();
    controller.abort();
    const aborted = seatalkParser.parse(Uint8Array.from([0x86, 0x11, 0x05, 0xfa]), {
      signal: controller.signal,
    });
    expect(aborted.success).toBe(false);
    if (aborted.success) throw new Error('unreachable');
    expect(aborted.error.code).toBe('parser-timeout');
  });
});
