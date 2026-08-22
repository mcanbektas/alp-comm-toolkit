import { describe, expect, it } from 'vitest';

import { ntpParser, ntpPlugin, parseNtp } from './ntp';
import {
  ntpDeltaMilliseconds,
  readNtpShortMilliseconds,
  readNtpTimestamp,
  readSignedByte,
} from './ntpTimestamp';
import type { ParseFailure, ParseResult, ParseSuccess, ParsedField, ParsedFrame } from '@/protocol-core/types';

function expectSuccess(result: ParseResult): ParseSuccess {
  if (!result.success) {
    throw new Error(`expected success, got error "${result.error.code}"`);
  }
  return result;
}

function expectFailure(result: ParseResult): ParseFailure {
  if (result.success) {
    throw new Error('expected failure, got a parsed frame');
  }
  return result;
}

function fieldById(frame: ParsedFrame, id: string): ParsedField {
  const found = frame.fields.find((field) => field.id === id);
  if (found === undefined) {
    throw new Error(`field "${id}" not found; got ${frame.fields.map((f) => f.id).join(', ')}`);
  }
  return found;
}

function hasField(frame: ParsedFrame, id: string): boolean {
  return frame.fields.some((field) => field.id === id);
}

function warningCodes(frame: ParsedFrame): string[] {
  return frame.warnings.map((warning) => warning.code);
}

function dword(value: number): number[] {
  return [(value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff];
}

interface NtpFrameInput {
  leap?: number;
  version?: number;
  mode?: number;
  stratum?: number;
  poll?: number;
  precision?: number;
  rootDelay?: number;
  rootDispersion?: number;
  referenceId?: readonly number[];
  referenceTimestamp?: readonly [number, number];
  originTimestamp?: readonly [number, number];
  receiveTimestamp?: readonly [number, number];
  transmitTimestamp?: readonly [number, number];
  trailing?: readonly number[];
}

/** 2026-08-22T12:00:00Z'nin NTP era-0 saniyesi. */
const SECONDS_2026 = 3_996_388_800;

function ntpBytes(input: NtpFrameInput = {}): Uint8Array {
  const stamp = (pair: readonly [number, number] | undefined): number[] =>
    pair === undefined ? [...dword(0), ...dword(0)] : [...dword(pair[0]), ...dword(pair[1])];

  return Uint8Array.from([
    (((input.leap ?? 0) & 0x03) << 6) | (((input.version ?? 4) & 0x07) << 3) | ((input.mode ?? 4) & 0x07),
    input.stratum ?? 2,
    (input.poll ?? 6) & 0xff,
    (input.precision ?? -23) & 0xff,
    ...dword(input.rootDelay ?? 0),
    ...dword(input.rootDispersion ?? 0),
    ...(input.referenceId ?? [192, 168, 1, 1]),
    ...stamp(input.referenceTimestamp),
    ...stamp(input.originTimestamp),
    ...stamp(input.receiveTimestamp),
    ...stamp(input.transmitTimestamp),
    ...(input.trailing ?? []),
  ]);
}

describe('ntpTimestamp', () => {
  it('64 biti saniye ve kesir olarak ayırır', () => {
    const bytes = Uint8Array.from([...dword(SECONDS_2026), ...dword(0x80000000)]);
    const parsed = readNtpTimestamp(bytes, 0);

    expect(parsed.seconds).toBe(SECONDS_2026);
    expect(parsed.fraction).toBe(0x80000000);
    expect(parsed.totalSeconds).toBeCloseTo(SECONDS_2026 + 0.5, 6);
    expect(parsed.raw).toBe((BigInt(SECONDS_2026) << 32n) | 0x80000000n);
    expect(parsed.iso).toBe('2026-08-22T12:00:00.500Z');
  });

  it('sıfır damgayı 1900 olarak DEĞİL, "ayarlanmamış" olarak çözer', () => {
    const parsed = readNtpTimestamp(new Uint8Array(8), 0);

    expect(parsed.unset).toBe(true);
    expect(parsed.iso).toBeUndefined();
    expect(parsed.unixMilliseconds).toBeUndefined();
  });

  it('MSB kuralına göre era ayırır — 2036 sonrası era 1 sayılır', () => {
    const era0 = readNtpTimestamp(Uint8Array.from([...dword(SECONDS_2026), ...dword(0)]), 0);
    // MSB temiz: era 1 penceresi (2036-02-07 sonrası).
    const era1 = readNtpTimestamp(Uint8Array.from([...dword(1000), ...dword(0)]), 0);

    expect(era0.era).toBe(0);
    expect(era1.era).toBe(1);
    // Era 1 tarihi 2036'nın ötesine düşmeli, 1900'ün başına değil.
    expect(era1.iso?.slice(0, 4)).toBe('2036');
  });

  it('farklı era damgaları arasında fark hesaplamayı reddeder', () => {
    const era0 = readNtpTimestamp(Uint8Array.from([...dword(SECONDS_2026), ...dword(0)]), 0);
    const era1 = readNtpTimestamp(Uint8Array.from([...dword(1000), ...dword(0)]), 0);

    expect(ntpDeltaMilliseconds(era0, era1)).toBeUndefined();
  });

  it('ayarlanmamış damgayla fark hesaplamaz', () => {
    const set = readNtpTimestamp(Uint8Array.from([...dword(SECONDS_2026), ...dword(0)]), 0);
    const unset = readNtpTimestamp(new Uint8Array(8), 0);

    expect(ntpDeltaMilliseconds(unset, set)).toBeUndefined();
    expect(ntpDeltaMilliseconds(set, unset)).toBeUndefined();
  });

  it('Precision alanını İŞARETLİ okur (0xE9 = -23, 233 değil)', () => {
    expect(readSignedByte(Uint8Array.from([0xe9]), 0)).toBe(-23);
    expect(readSignedByte(Uint8Array.from([0x06]), 0)).toBe(6);
  });

  it('NTP Short Format 16.16 sabit noktalıdır, tam sayı değil', () => {
    // 0x0001_0000 = 1.0 saniye = 1000 ms.
    expect(readNtpShortMilliseconds(Uint8Array.from([0x00, 0x01, 0x00, 0x00]), 0)).toBeCloseTo(1000, 6);
    // 0x0000_8000 = 0.5 saniye.
    expect(readNtpShortMilliseconds(Uint8Array.from([0x00, 0x00, 0x80, 0x00]), 0)).toBeCloseTo(500, 6);
  });
});

describe('ntpParser', () => {
  it('LI / VN / Mode üçünü de aynı baytı kapsayacak şekilde çözer', () => {
    const { frame } = expectSuccess(parseNtp(ntpBytes({ leap: 0, version: 4, mode: 4 })));

    const leap = fieldById(frame, 'leap-indicator');
    const version = fieldById(frame, 'version');
    const mode = fieldById(frame, 'mode');

    for (const field of [leap, version, mode]) {
      expect(field.offset).toBe(0);
      expect(field.length).toBe(1);
    }
    expect(leap.rawValue).toBe(0);
    expect(version.rawValue).toBe(4);
    expect(mode.rawValue).toBe(4);
    expect(mode.physicalValue).toBe('Server');
  });

  it('tanınmayan Mode değerini uyarır ama hata basmaz', () => {
    // Mode 7 = private/implementation-specific, adlandırılamaz.
    const { frame } = expectSuccess(parseNtp(ntpBytes({ mode: 7 })));

    expect(frame.valid).toBe(true);
    expect(fieldById(frame, 'mode').valid).toBe(false);
    expect(warningCodes(frame)).toContain('protocol.ntp.warning.unknownMode');
  });

  it('LI=3 alarm bayrağını uyarır', () => {
    const { frame } = expectSuccess(parseNtp(ntpBytes({ leap: 3 })));

    expect(fieldById(frame, 'leap-indicator').physicalValue).toBe('Unsynchronized (alarm)');
    expect(warningCodes(frame)).toContain('protocol.ntp.warning.leapAlarm');
  });

  it('Reference ID stratum 0 için kiss code, stratum 1 için ASCII kimlik okur', () => {
    // "RATE" — sunucu istemciyi yavaşlamaya zorluyor.
    const kiss = expectSuccess(parseNtp(ntpBytes({ stratum: 0, referenceId: [0x52, 0x41, 0x54, 0x45] })));
    expect(fieldById(kiss.frame, 'reference-id').physicalValue).toBe('RATE');
    expect(warningCodes(kiss.frame)).toContain('protocol.ntp.warning.kissOfDeath');

    // "GPS\0" — referans saat kimliği, adres DEĞİL.
    const gps = expectSuccess(parseNtp(ntpBytes({ stratum: 1, referenceId: [0x47, 0x50, 0x53, 0x00] })));
    expect(fieldById(gps.frame, 'reference-id').physicalValue).toBe('GPS');
    expect(warningCodes(gps.frame)).not.toContain('protocol.ntp.warning.referenceIdMayNotBeAddress');
  });

  it('stratum ≥2 Reference ID adres olarak gösterilir ama uyarıyla', () => {
    const { frame } = expectSuccess(parseNtp(ntpBytes({ stratum: 3, referenceId: [10, 0, 0, 1] })));

    expect(fieldById(frame, 'reference-id').physicalValue).toBe('10.0.0.1');
    // IPv6 kurulumunda bu bayt kümesi adres değil MD5 özeti öneki olur.
    expect(warningCodes(frame)).toContain('protocol.ntp.warning.referenceIdMayNotBeAddress');
  });

  it('stratum adlandırılır ama kalite yargısı üretilmez', () => {
    expect(fieldById(expectSuccess(parseNtp(ntpBytes({ stratum: 1 }))).frame, 'stratum').physicalValue).toBe(
      'Primary reference',
    );
    expect(fieldById(expectSuccess(parseNtp(ntpBytes({ stratum: 9 }))).frame, 'stratum').physicalValue).toBe(
      'Secondary reference',
    );

    const unsynchronized = expectSuccess(parseNtp(ntpBytes({ stratum: 16 })));
    expect(warningCodes(unsynchronized.frame)).toContain('protocol.ntp.warning.stratumUnsynchronized');

    const reserved = expectSuccess(parseNtp(ntpBytes({ stratum: 200 })));
    expect(fieldById(reserved.frame, 'stratum').valid).toBe(false);
    expect(warningCodes(reserved.frame)).toContain('protocol.ntp.warning.stratumReserved');
  });

  it('Poll ve Precision işaretli log2 saniye olarak çözülür', () => {
    const { frame } = expectSuccess(parseNtp(ntpBytes({ poll: 6, precision: -23 })));

    expect(fieldById(frame, 'poll').rawValue).toBe(6);
    expect(fieldById(frame, 'poll').physicalValue).toBe(64);
    expect(fieldById(frame, 'precision').rawValue).toBe(-23);
    expect(fieldById(frame, 'precision').physicalValue).toBe('2^-23 s');
  });

  it('Root Delay / Root Dispersion 16.16 sabit noktadan milisaniyeye çevrilir', () => {
    const { frame } = expectSuccess(parseNtp(ntpBytes({ rootDelay: 0x00008000, rootDispersion: 0x00010000 })));

    expect(fieldById(frame, 'root-delay').physicalValue).toBeCloseTo(500, 3);
    expect(fieldById(frame, 'root-dispersion').physicalValue).toBeCloseTo(1000, 3);
  });

  it('sunucu yanıtında T3 − T2 türetir ve δ/θ için T4 eksikliğini uyarır', () => {
    // T2 → T3 arası 2 ms (kesir farkı ≈ 0.002 × 2^32).
    const { frame } = expectSuccess(
      parseNtp(
        ntpBytes({
          mode: 4,
          receiveTimestamp: [SECONDS_2026, 0x80000000],
          transmitTimestamp: [SECONDS_2026, 0x80000000 + 8_589_935],
        }),
      ),
    );

    const derived = fieldById(frame, 'server-processing-time');
    expect(derived.physicalValue).toBeCloseTo(2, 3);
    expect(derived.unit).toBe('ms');
    expect(derived.offset).toBe(32);
    expect(derived.length).toBe(16);
    expect(warningCodes(frame)).toContain('protocol.ntp.warning.fourTimestampNeedsT4');
  });

  it('istemci isteğinde T3 − T2 türetmez', () => {
    // Mode 3 = client: T2/T3 sunucunun damgaları, istekte yok.
    const { frame } = expectSuccess(parseNtp(ntpBytes({ mode: 3, transmitTimestamp: [SECONDS_2026, 0] })));

    expect(hasField(frame, 'server-processing-time')).toBe(false);
    expect(warningCodes(frame)).not.toContain('protocol.ntp.warning.fourTimestampNeedsT4');
  });

  it('T3 < T2 olduğunda türetilmiş alanı geçersiz işaretler', () => {
    const { frame } = expectSuccess(
      parseNtp(
        ntpBytes({
          mode: 4,
          receiveTimestamp: [SECONDS_2026, 0x80000000],
          transmitTimestamp: [SECONDS_2026, 0x70000000],
        }),
      ),
    );

    expect(fieldById(frame, 'server-processing-time').valid).toBe(false);
    expect(warningCodes(frame)).toContain('protocol.ntp.warning.serverTimeNegative');
  });

  it('sıfır Origin damgasını "ayarlanmamış" diye işaretler', () => {
    const { frame } = expectSuccess(parseNtp(ntpBytes({ mode: 3 })));

    const origin = fieldById(frame, 'origin-timestamp');
    expect(origin.physicalValue).toBeUndefined();
    expect(origin.warnings).toContain('protocol.ntp.warning.timestampUnset');
  });

  it('MD5 authenticator uzantısını Key ID + özet olarak çözer', () => {
    const { frame } = expectSuccess(
      parseNtp(ntpBytes({ trailing: [...dword(7), ...new Array<number>(16).fill(0xab)] })),
    );

    expect(fieldById(frame, 'key-identifier').rawValue).toBe('0x00000007');
    const digest = fieldById(frame, 'message-digest');
    expect(digest.length).toBe(16);
    expect(digest.physicalValue).toBe('MD5 (128-bit)');
    expect(warningCodes(frame)).not.toContain('protocol.ntp.warning.unknownAuthenticator');
  });

  it('tanınmayan authenticator uzunluğunu uyarır ama çözmeyi sürdürür', () => {
    const { frame } = expectSuccess(parseNtp(ntpBytes({ trailing: [1, 2, 3, 4, 5, 6, 7] })));

    expect(frame.valid).toBe(true);
    expect(warningCodes(frame)).toContain('protocol.ntp.warning.unknownAuthenticator');
  });

  it('48 baytın altını truncated-frame ile reddeder', () => {
    const failure = expectFailure(parseNtp(new Uint8Array(20)));

    expect(failure.error.code).toBe('truncated-frame');
    expect(failure.recoverable).toBe(true);
  });

  it('maxFrameLength aşımını frame-too-long ile durdurur', () => {
    const failure = expectFailure(ntpParser.parse(ntpBytes({ trailing: new Array<number>(24).fill(0) }), { maxFrameLength: 48 }));

    expect(failure.error.code).toBe('frame-too-long');
    expect(failure.recoverable).toBe(false);
  });

  it('iptal edilmiş signal ile parser-timeout döner', () => {
    const controller = new AbortController();
    controller.abort();

    const failure = expectFailure(ntpParser.parse(ntpBytes(), { signal: controller.signal }));
    expect(failure.error.code).toBe('parser-timeout');
  });

  it('canParse yalnız sürüm alanına bakar, mode ve stratum yoklanmaz', () => {
    expect(ntpParser.canParse(ntpBytes({ version: 4 }))).toBe(true);
    expect(ntpParser.canParse(ntpBytes({ version: 3 }))).toBe(true);
    // Sürüm 0 ya da 5+ NTP değil.
    expect(ntpParser.canParse(ntpBytes({ version: 0 }))).toBe(false);
    expect(ntpParser.canParse(ntpBytes({ version: 7 }))).toBe(false);
    expect(ntpParser.canParse(new Uint8Array(10))).toBe(false);
  });

  it('sürüm 4 dışındaki NTPv3 çerçevesini uyarıyla çözer', () => {
    const { frame } = expectSuccess(parseNtp(ntpBytes({ version: 3 })));

    expect(frame.valid).toBe(true);
    expect(warningCodes(frame)).toContain('protocol.ntp.warning.unexpectedVersion');
  });
});

describe('ntpPlugin', () => {
  it('örnekleri beyan ettikleri geçerlilikle çözülür', () => {
    for (const example of ntpPlugin.exampleFrames) {
      const result = parseNtp(example.bytes);
      if (example.expectedValid === false) {
        // Kesilmiş örnek ya çözülemez ya da geçersiz çerçeve verir.
        const invalid = !result.success || !result.frame.valid;
        expect(invalid, `${example.id} geçersiz olmalıydı`).toBe(true);
        continue;
      }
      const { frame } = expectSuccess(result);
      expect(frame.valid, `${example.id} geçerli olmalıydı`).toBe(true);
    }
  });

  it('plugin kimliği ve kategorisi katalogla aynı', () => {
    expect(ntpPlugin.id).toBe('ntp');
    expect(ntpPlugin.category).toBe('network-ethernet');
    expect(ntpPlugin.parser).toBe(ntpParser);
  });
});
