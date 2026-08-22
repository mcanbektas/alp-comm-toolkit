import { describe, expect, it } from 'vitest';

import { CORRECTION_FIELD_SCALE, parsePtp, ptpParser, ptpPlugin } from './ptp';
import {
  formatClockIdentity,
  ptpTotalNanoseconds,
  readCorrectionFieldNanoseconds,
  readPtpTimestamp,
} from './ptpTimestamp';
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

function errorCodes(frame: ParsedFrame): string[] {
  return frame.errors.map((error) => error.code);
}

const MESSAGE_TYPE_SYNC = 0x0;
const MESSAGE_TYPE_DELAY_REQ = 0x1;
const MESSAGE_TYPE_PDELAY_RESP = 0x3;
const MESSAGE_TYPE_FOLLOW_UP = 0x8;
const MESSAGE_TYPE_DELAY_RESP = 0x9;
const MESSAGE_TYPE_ANNOUNCE = 0xb;
const MESSAGE_TYPE_SIGNALING = 0xc;

const CLOCK_IDENTITY = [0x00, 0x1b, 0x19, 0xff, 0xfe, 0x00, 0x00, 0x01];
/** 2026-08-22T12:00:00 TAI. */
const SECONDS_2026 = 1_787_400_000;

function word(value: number): number[] {
  return [(value >>> 8) & 0xff, value & 0xff];
}

function correctionBytes(scaledNanoseconds: number): number[] {
  let remaining = BigInt(scaledNanoseconds);
  if (remaining < 0n) remaining += 1n << 64n;
  const out: number[] = new Array<number>(8).fill(0);
  for (let index = 7; index >= 0; index -= 1) {
    out[index] = Number(remaining & 0xffn);
    remaining >>= 8n;
  }
  return out;
}

function timestampBytes(seconds: number, nanoseconds: number): number[] {
  const high = Math.floor(seconds / 2 ** 32);
  const low = seconds >>> 0;
  return [
    ...word(high),
    (low >>> 24) & 0xff,
    (low >>> 16) & 0xff,
    (low >>> 8) & 0xff,
    low & 0xff,
    (nanoseconds >>> 24) & 0xff,
    (nanoseconds >>> 16) & 0xff,
    (nanoseconds >>> 8) & 0xff,
    nanoseconds & 0xff,
  ];
}

interface PtpHeaderInput {
  messageType?: number;
  majorSdoId?: number;
  versionPtp?: number;
  minorVersionPtp?: number;
  messageLength?: number;
  domainNumber?: number;
  flags?: readonly [number, number];
  correctionScaledNs?: number;
  clockIdentity?: readonly number[];
  portNumber?: number;
  sequenceId?: number;
  controlField?: number;
  logMessageInterval?: number;
}

function ptpHeader(input: PtpHeaderInput = {}): number[] {
  return [
    (((input.majorSdoId ?? 0) & 0x0f) << 4) | ((input.messageType ?? MESSAGE_TYPE_SYNC) & 0x0f),
    (((input.minorVersionPtp ?? 0) & 0x0f) << 4) | ((input.versionPtp ?? 2) & 0x0f),
    ...word(input.messageLength ?? 44),
    input.domainNumber ?? 0,
    0x00,
    input.flags?.[0] ?? 0x00,
    input.flags?.[1] ?? 0x00,
    ...correctionBytes(input.correctionScaledNs ?? 0),
    0x00,
    0x00,
    0x00,
    0x00,
    ...(input.clockIdentity ?? CLOCK_IDENTITY),
    ...word(input.portNumber ?? 1),
    ...word(input.sequenceId ?? 1),
    input.controlField ?? 0x00,
    (input.logMessageInterval ?? 0) & 0xff,
  ];
}

/** Announce gövdesi (30 bayt) — BMCA veri kümesi. */
function announceBody(overrides: { clockClass?: number; clockAccuracy?: number; timeSource?: number } = {}): number[] {
  return [
    ...timestampBytes(0, 0),
    ...word(37), // currentUtcOffset
    0x00, // reserved
    128, // grandmasterPriority1
    overrides.clockClass ?? 6,
    overrides.clockAccuracy ?? 0x21,
    ...word(0x0080), // offsetScaledLogVariance
    128, // grandmasterPriority2
    ...CLOCK_IDENTITY,
    ...word(0), // stepsRemoved
    overrides.timeSource ?? 0x20,
  ];
}

describe('ptpTimestamp', () => {
  it('80 biti 48 bit saniye + 32 bit nanosaniye olarak ayırır', () => {
    const parsed = readPtpTimestamp(Uint8Array.from(timestampBytes(SECONDS_2026, 123_456_789)), 0);

    expect(parsed.seconds).toBe(SECONDS_2026);
    expect(parsed.nanoseconds).toBe(123_456_789);
    expect(parsed.nanosecondsOutOfRange).toBe(false);
    expect(parsed.taiIso).toBe('2026-08-22T12:00:00.123Z');
  });

  it('48 bitlik saniye alanının üst 16 bitini kaybetmez', () => {
    // 2^32'nin üstünde bir saniye: `high << 32` sıfır verirdi.
    const seconds = 2 ** 32 + 5;
    const parsed = readPtpTimestamp(Uint8Array.from(timestampBytes(seconds, 0)), 0);

    expect(parsed.seconds).toBe(seconds);
  });

  it('sıfır damgayı "taşınmamış" olarak çözer', () => {
    const parsed = readPtpTimestamp(new Uint8Array(10), 0);

    expect(parsed.unset).toBe(true);
    expect(parsed.taiIso).toBeUndefined();
    expect(ptpTotalNanoseconds(parsed)).toBeUndefined();
  });

  it('bir saniyeyi aşan nanosaniye alanını işaretler', () => {
    const parsed = readPtpTimestamp(Uint8Array.from(timestampBytes(SECONDS_2026, 1_500_000_000)), 0);

    expect(parsed.nanosecondsOutOfRange).toBe(true);
  });

  it('correctionField nanosaniye × 2^16 ölçeğinden çözülür', () => {
    // 1250.5 ns × 65536 = 81 952 768.
    expect(readCorrectionFieldNanoseconds(Uint8Array.from(correctionBytes(1250.5 * CORRECTION_FIELD_SCALE)), 0)).toBeCloseTo(
      1250.5,
      6,
    );
  });

  it('correctionField İŞARETLİDİR — negatif düzeltme astronomik sayıya dönüşmez', () => {
    const value = readCorrectionFieldNanoseconds(Uint8Array.from(correctionBytes(-500 * CORRECTION_FIELD_SCALE)), 0);

    expect(value).toBeCloseTo(-500, 6);
    expect(value).toBeLessThan(0);
  });

  it('clockIdentity iki nokta üst üsteli onaltılık verir, MAC uydurmaz', () => {
    expect(formatClockIdentity(Uint8Array.from(CLOCK_IDENTITY))).toBe('00:1b:19:ff:fe:00:00:01');
  });
});

describe('ptpParser', () => {
  it('messageType baytın ALT yarısıdır, majorSdoId üst yarısı', () => {
    // 0xB0 üst yarıda: majorSdoId=0x0B, messageType=0x0 (Sync). Ters okunursa
    // bu çerçeve Announce sanılırdı.
    const bytes = Uint8Array.from([
      ...ptpHeader({ messageType: MESSAGE_TYPE_SYNC, majorSdoId: 0x0b }),
      ...timestampBytes(0, 0),
    ]);
    const { frame } = expectSuccess(parsePtp(bytes));

    expect(fieldById(frame, 'message-type').rawValue).toBe(0x0);
    expect(fieldById(frame, 'message-type').physicalValue).toBe('Sync');
    expect(fieldById(frame, 'major-sdo-id').rawValue).toBe(0x0b);
  });

  it('versionPTP baytın ALT yarısıdır, minorVersionPTP üst yarısı', () => {
    const bytes = Uint8Array.from([
      ...ptpHeader({ versionPtp: 2, minorVersionPtp: 1 }),
      ...timestampBytes(0, 0),
    ]);
    const { frame } = expectSuccess(parsePtp(bytes));

    expect(fieldById(frame, 'version-ptp').rawValue).toBe(2);
    expect(fieldById(frame, 'minor-version-ptp').rawValue).toBe(1);
    expect(warningCodes(frame)).not.toContain('protocol.ptp.warning.unexpectedVersion');
  });

  it('PTPv1 çerçevesini geçersiz sürüm olarak işaretler', () => {
    const bytes = Uint8Array.from([...ptpHeader({ versionPtp: 1 }), ...timestampBytes(0, 0)]);
    const { frame } = expectSuccess(parsePtp(bytes));

    expect(fieldById(frame, 'version-ptp').valid).toBe(false);
    expect(warningCodes(frame)).toContain('protocol.ptp.warning.unexpectedVersion');
  });

  it('flagField iki baytı AYRI anlam kümesi olarak listeler', () => {
    // Bayt 0: twoStep + unicast · Bayt 1: ptpTimescale + timeTraceable.
    const bytes = Uint8Array.from([
      ...ptpHeader({ messageType: MESSAGE_TYPE_SYNC, flags: [0x02 | 0x04, 0x08 | 0x10] }),
      ...timestampBytes(0, 0),
    ]);
    const { frame } = expectSuccess(parsePtp(bytes));

    expect(fieldById(frame, 'flags').physicalValue).toBe(
      'twoStepFlag, unicastFlag | ptpTimescale, timeTraceable',
    );
  });

  it('Clock Mode yalnız Sync ve Pdelay_Resp için türetilir', () => {
    const sync = expectSuccess(
      parsePtp(Uint8Array.from([...ptpHeader({ messageType: MESSAGE_TYPE_SYNC, flags: [0x02, 0x00] }), ...timestampBytes(0, 0)])),
    );
    expect(fieldById(sync.frame, 'clock-mode').physicalValue).toBe('Two-Step');

    const oneStep = expectSuccess(
      parsePtp(
        Uint8Array.from([
          ...ptpHeader({ messageType: MESSAGE_TYPE_SYNC, flags: [0x00, 0x00] }),
          ...timestampBytes(SECONDS_2026, 0),
        ]),
      ),
    );
    expect(fieldById(oneStep.frame, 'clock-mode').physicalValue).toBe('One-Step');

    const pdelayResp = expectSuccess(
      parsePtp(
        Uint8Array.from([
          ...ptpHeader({ messageType: MESSAGE_TYPE_PDELAY_RESP, messageLength: 54, flags: [0x02, 0x00] }),
          ...timestampBytes(SECONDS_2026, 0),
          ...CLOCK_IDENTITY,
          ...word(1),
        ]),
      ),
    );
    expect(fieldById(pdelayResp.frame, 'clock-mode').physicalValue).toBe('Two-Step');
  });

  it('general mesajda set edilmiş twoStepFlag "Two-Step" diye yorumlanmaz', () => {
    // Follow_Up'ta bayrağın davranışı TANIMSIZDIR (§13.3.2.6).
    const bytes = Uint8Array.from([
      ...ptpHeader({ messageType: MESSAGE_TYPE_FOLLOW_UP, controlField: 0x02, flags: [0x02, 0x00] }),
      ...timestampBytes(SECONDS_2026, 0),
    ]);
    const { frame } = expectSuccess(parsePtp(bytes));

    expect(hasField(frame, 'clock-mode')).toBe(false);
    expect(warningCodes(frame)).toContain('protocol.ptp.warning.twoStepIgnored');
  });

  it('correctionField nanosaniyeye ölçeklenir, ham 64 bit basılmaz', () => {
    const bytes = Uint8Array.from([
      ...ptpHeader({ messageType: MESSAGE_TYPE_FOLLOW_UP, controlField: 0x02, correctionScaledNs: 1250.5 * CORRECTION_FIELD_SCALE }),
      ...timestampBytes(SECONDS_2026, 0),
    ]);
    const { frame } = expectSuccess(parsePtp(bytes));

    const correction = fieldById(frame, 'correction-field');
    expect(correction.physicalValue).toBeCloseTo(1250.5, 3);
    expect(correction.unit).toBe('ns');
  });

  it('two-step Sync damgası sıfırsa "taşınmamış" işaretlenir, asıl t1 Follow_Up’tadır', () => {
    const sync = expectSuccess(
      parsePtp(Uint8Array.from([...ptpHeader({ messageType: MESSAGE_TYPE_SYNC, flags: [0x02, 0x00] }), ...timestampBytes(0, 0)])),
    );
    expect(fieldById(sync.frame, 'origin-timestamp').warnings).toContain('protocol.ptp.warning.timestampUnset');

    const followUp = expectSuccess(
      parsePtp(
        Uint8Array.from([
          ...ptpHeader({ messageType: MESSAGE_TYPE_FOLLOW_UP, controlField: 0x02 }),
          ...timestampBytes(SECONDS_2026, 500_000_000),
        ]),
      ),
    );
    const precise = fieldById(followUp.frame, 'precise-origin-timestamp');
    expect(precise.physicalValue).toBe('2026-08-22T12:00:00.500Z');
    // TAI ölçeği: UTC'ye çevirmek Announce'un currentUtcOffset'ini ister.
    expect(precise.warnings).toContain('protocol.ptp.warning.timestampTai');
  });

  it('Delay_Resp gövdesinde t4 damgası ve requesting port identity çözülür', () => {
    const bytes = Uint8Array.from([
      ...ptpHeader({ messageType: MESSAGE_TYPE_DELAY_RESP, messageLength: 54, controlField: 0x03 }),
      ...timestampBytes(SECONDS_2026, 250_000_000),
      0x00,
      0x1b,
      0x19,
      0xff,
      0xfe,
      0x00,
      0x00,
      0x02,
      ...word(3),
    ]);
    const { frame } = expectSuccess(parsePtp(bytes));

    expect(fieldById(frame, 'receive-timestamp').physicalValue).toBe('2026-08-22T12:00:00.250Z');
    expect(fieldById(frame, 'requesting-port-identity-clock-identity').rawValue).toBe('00:1b:19:ff:fe:00:00:02');
    expect(fieldById(frame, 'requesting-port-identity-port-number').rawValue).toBe(3);
    // Gecikme dört ayrı mesajın işi (dosya başı).
    expect(warningCodes(frame)).toContain('protocol.ptp.warning.pathDelayNeedsExchange');
  });

  it('Announce BMCA veri kümesini alan alan çözer ama karar vermez', () => {
    const bytes = Uint8Array.from([
      ...ptpHeader({ messageType: MESSAGE_TYPE_ANNOUNCE, messageLength: 64, controlField: 0x05, logMessageInterval: 1 }),
      ...announceBody(),
    ]);
    const { frame } = expectSuccess(parsePtp(bytes));

    expect(fieldById(frame, 'current-utc-offset').rawValue).toBe(37);
    expect(fieldById(frame, 'grandmaster-priority1').rawValue).toBe(128);
    expect(fieldById(frame, 'grandmaster-clock-class').physicalValue).toBe('Primary reference, PTP timescale');
    expect(fieldById(frame, 'grandmaster-clock-accuracy').physicalValue).toBe('100 ns');
    expect(fieldById(frame, 'grandmaster-offset-scaled-log-variance').rawValue).toBe(0x0080);
    expect(fieldById(frame, 'grandmaster-priority2').rawValue).toBe(128);
    expect(fieldById(frame, 'grandmaster-identity').rawValue).toBe('00:1b:19:ff:fe:00:00:01');
    expect(fieldById(frame, 'steps-removed').rawValue).toBe(0);
    expect(fieldById(frame, 'time-source').physicalValue).toBe('GNSS');
    // Altı veri çözüldü ama "Selected Grandmaster" tek Announce'la belirlenemez.
    expect(warningCodes(frame)).toContain('protocol.ptp.warning.bmcaNeedsMultipleAnnounce');
  });

  it('Announce alanlarının offsetleri reserved baytı atlar', () => {
    const bytes = Uint8Array.from([
      ...ptpHeader({ messageType: MESSAGE_TYPE_ANNOUNCE, messageLength: 64, controlField: 0x05 }),
      ...announceBody(),
    ]);
    const { frame } = expectSuccess(parsePtp(bytes));

    // 34 (başlık) + 10 (damga) + 2 (utcOffset) + 1 (reserved) = 47.
    expect(fieldById(frame, 'grandmaster-priority1').offset).toBe(47);
    expect(fieldById(frame, 'grandmaster-clock-class').offset).toBe(48);
    expect(fieldById(frame, 'time-source').offset).toBe(63);
  });

  it('tanınmayan clockClass / clockAccuracy / timeSource değerlerini uyarır', () => {
    const bytes = Uint8Array.from([
      ...ptpHeader({ messageType: MESSAGE_TYPE_ANNOUNCE, messageLength: 64, controlField: 0x05 }),
      ...announceBody({ clockClass: 99, clockAccuracy: 0x11, timeSource: 0x77 }),
    ]);
    const { frame } = expectSuccess(parsePtp(bytes));

    expect(warningCodes(frame)).toContain('protocol.ptp.warning.unknownClockClass');
    expect(warningCodes(frame)).toContain('protocol.ptp.warning.unknownClockAccuracy');
    expect(warningCodes(frame)).toContain('protocol.ptp.warning.unknownTimeSource');
  });

  it('TLV16 zincirini yürür ve tipi adlandırır, gövdeyi ham bırakır', () => {
    const bytes = Uint8Array.from([
      ...ptpHeader({ messageType: MESSAGE_TYPE_SIGNALING, messageLength: 54, controlField: 0x05 }),
      ...new Array<number>(10).fill(0xff), // targetPortIdentity
      ...word(0x0004), // REQUEST_UNICAST_TRANSMISSION
      ...word(6),
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x3c,
    ]);
    const { frame } = expectSuccess(parsePtp(bytes));

    expect(fieldById(frame, 'tlv-0-type').physicalValue).toBe('REQUEST_UNICAST_TRANSMISSION');
    expect(fieldById(frame, 'tlv-0-length').rawValue).toBe(6);
    // Gövde çözülmez, ham gösterilir (dosya başı: PATH_TRACE/L1_SYNC ayrı iş).
    expect(fieldById(frame, 'tlv-0-value').length).toBe(6);
    expect(fieldById(frame, 'tlv-0-value').physicalValue).toBeUndefined();
  });

  it('birden çok TLV art arda yürünür', () => {
    const bytes = Uint8Array.from([
      ...ptpHeader({ messageType: MESSAGE_TYPE_SIGNALING, messageLength: 56, controlField: 0x05 }),
      ...new Array<number>(10).fill(0xff),
      ...word(0x0008), // PATH_TRACE
      ...word(8),
      ...CLOCK_IDENTITY,
      ...word(0x8001), // L1_SYNC
      ...word(2),
      0x00,
      0x00,
    ]);
    const { frame } = expectSuccess(parsePtp(bytes));

    expect(fieldById(frame, 'tlv-0-type').physicalValue).toBe('PATH_TRACE');
    expect(fieldById(frame, 'tlv-1-type').physicalValue).toBe('L1_SYNC');
  });

  it('tek sayılı TLV lengthField değerini uyarır', () => {
    const bytes = Uint8Array.from([
      ...ptpHeader({ messageType: MESSAGE_TYPE_SIGNALING, messageLength: 51, controlField: 0x05 }),
      ...new Array<number>(10).fill(0xff),
      ...word(0x0008),
      ...word(3), // §14.1.1: ÇİFT olmak zorunda
      0x00,
      0x00,
      0x00,
    ]);
    const { frame } = expectSuccess(parsePtp(bytes));

    expect(fieldById(frame, 'tlv-0-length').valid).toBe(false);
    expect(warningCodes(frame)).toContain('protocol.ptp.warning.tlvOddLength');
  });

  it('gövdeye sığmayan TLV uzunluğunda döngüye girmeden durur', () => {
    const bytes = Uint8Array.from([
      ...ptpHeader({ messageType: MESSAGE_TYPE_SIGNALING, messageLength: 52, controlField: 0x05 }),
      ...new Array<number>(10).fill(0xff),
      ...word(0x0008),
      ...word(500), // tamponda 4 bayt var, 500 iddia ediliyor
      0x00,
      0x00,
      0x00,
      0x00,
    ]);
    const { frame } = expectSuccess(parsePtp(bytes));

    expect(warningCodes(frame)).toContain('protocol.ptp.warning.tlvTruncated');
  });

  it('lengthField sıfır olan TLV sonsuz döngü üretmez', () => {
    const bytes = Uint8Array.from([
      ...ptpHeader({ messageType: MESSAGE_TYPE_SIGNALING, messageLength: 52, controlField: 0x05 }),
      ...new Array<number>(10).fill(0xff),
      ...word(0x0008),
      ...word(0),
      ...word(0x0008),
      ...word(0),
    ]);
    const { frame } = expectSuccess(parsePtp(bytes));

    expect(fieldById(frame, 'tlv-1-type').physicalValue).toBe('PATH_TRACE');
    expect(hasField(frame, 'tlv-2-type')).toBe(false);
  });

  it('messageType ile çelişen legacy controlField değerini uyarır', () => {
    const bytes = Uint8Array.from([
      ...ptpHeader({ messageType: MESSAGE_TYPE_DELAY_REQ, controlField: 0x00 }), // 0x01 beklenir
      ...timestampBytes(SECONDS_2026, 0),
    ]);
    const { frame } = expectSuccess(parsePtp(bytes));

    expect(warningCodes(frame)).toContain('protocol.ptp.warning.controlFieldMismatch');
  });

  it('messageLength ile gerçek uzunluk uyuşmazlığını uyarır, hata basmaz', () => {
    const bytes = Uint8Array.from([
      ...ptpHeader({ messageType: MESSAGE_TYPE_SYNC, messageLength: 44 }),
      ...timestampBytes(SECONDS_2026, 0),
      ...new Array<number>(20).fill(0x00), // Ethernet asgari çerçeve dolgusu
    ]);
    const { frame } = expectSuccess(parsePtp(bytes));

    expect(fieldById(frame, 'message-length').valid).toBe(false);
    expect(warningCodes(frame)).toContain('protocol.ptp.warning.messageLengthMismatch');
    expect(errorCodes(frame)).toHaveLength(0);
  });

  it('gövdesi eksik mesajı truncated-frame hatasıyla işaretler', () => {
    const { frame } = expectSuccess(
      parsePtp(Uint8Array.from(ptpHeader({ messageType: MESSAGE_TYPE_ANNOUNCE, messageLength: 64, controlField: 0x05 }))),
    );

    expect(frame.valid).toBe(false);
    expect(errorCodes(frame)).toContain('truncated-frame');
  });

  it('tanınmayan messageType gövdesini uydurmadan ham gösterir', () => {
    const bytes = Uint8Array.from([...ptpHeader({ messageType: 0x6, messageLength: 40 }), 1, 2, 3, 4, 5, 6]);
    const { frame } = expectSuccess(parsePtp(bytes));

    expect(warningCodes(frame)).toContain('protocol.ptp.warning.unknownMessageType');
    expect(fieldById(frame, 'unparsed-body').length).toBe(6);
  });

  it('logMessageInterval işaretli log2 saniyedir', () => {
    const bytes = Uint8Array.from([
      ...ptpHeader({ messageType: MESSAGE_TYPE_SYNC, logMessageInterval: -3 }),
      ...timestampBytes(SECONDS_2026, 0),
    ]);
    const { frame } = expectSuccess(parsePtp(bytes));

    expect(fieldById(frame, 'log-message-interval').rawValue).toBe(-3);
    expect(fieldById(frame, 'log-message-interval').physicalValue).toBe('2^-3 s');
  });

  it('34 baytın altını truncated-frame ile reddeder', () => {
    const failure = expectFailure(parsePtp(new Uint8Array(20)));

    expect(failure.error.code).toBe('truncated-frame');
    expect(failure.recoverable).toBe(true);
  });

  it('maxFrameLength aşımını frame-too-long ile durdurur', () => {
    const bytes = Uint8Array.from([...ptpHeader(), ...timestampBytes(SECONDS_2026, 0)]);
    const failure = expectFailure(ptpParser.parse(bytes, { maxFrameLength: 40 }));

    expect(failure.error.code).toBe('frame-too-long');
    expect(failure.recoverable).toBe(false);
  });

  it('iptal edilmiş signal ile parser-timeout döner', () => {
    const controller = new AbortController();
    controller.abort();

    const bytes = Uint8Array.from([...ptpHeader(), ...timestampBytes(SECONDS_2026, 0)]);
    const failure = expectFailure(ptpParser.parse(bytes, { signal: controller.signal }));
    expect(failure.error.code).toBe('parser-timeout');
  });

  it('canParse versionPTP alt yarısına bakar, messageType yoklanmaz', () => {
    expect(ptpParser.canParse(Uint8Array.from([...ptpHeader({ versionPtp: 2 }), ...timestampBytes(0, 0)]))).toBe(true);
    // Tanınmayan messageType ön elemede reddedilmez.
    expect(
      ptpParser.canParse(Uint8Array.from([...ptpHeader({ versionPtp: 2, messageType: 0x6 }), ...timestampBytes(0, 0)])),
    ).toBe(true);
    expect(ptpParser.canParse(Uint8Array.from([...ptpHeader({ versionPtp: 1 }), ...timestampBytes(0, 0)]))).toBe(false);
    expect(ptpParser.canParse(new Uint8Array(10))).toBe(false);
  });
});

describe('ptpPlugin', () => {
  it('örnekleri beyan ettikleri geçerlilikle çözülür', () => {
    for (const example of ptpPlugin.exampleFrames) {
      const result = parsePtp(example.bytes);
      if (example.expectedValid === false) {
        const invalid = !result.success || !result.frame.valid;
        expect(invalid, `${example.id} geçersiz olmalıydı`).toBe(true);
        continue;
      }
      const { frame } = expectSuccess(result);
      expect(frame.valid, `${example.id} geçerli olmalıydı`).toBe(true);
    }
  });

  it('örneklerin messageLength alanı gerçek uzunlukla tutarlı', () => {
    for (const example of ptpPlugin.exampleFrames) {
      if (example.expectedValid === false) continue;
      const { frame } = expectSuccess(parsePtp(example.bytes));
      expect(
        warningCodes(frame),
        `${example.id} messageLength uyuşmazlığı basıyor`,
      ).not.toContain('protocol.ptp.warning.messageLengthMismatch');
    }
  });

  it('plugin kimliği ve kategorisi katalogla aynı', () => {
    expect(ptpPlugin.id).toBe('ptp');
    expect(ptpPlugin.category).toBe('network-ethernet');
    expect(ptpPlugin.parser).toBe(ptpParser);
  });
});
