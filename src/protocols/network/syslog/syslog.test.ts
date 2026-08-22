import { describe, expect, it } from 'vitest';

import { parseSyslog, syslogParser, syslogPlugin } from './syslog';
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

function message(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

describe('syslogParser', () => {
  it('PRI’yi Facility ve Severity’ye böler (spec örneği: 34 → 4 / 2)', () => {
    const { frame } = expectSuccess(parseSyslog(message('<34>1 2026-08-08T15:00:00Z device1 app 123 ID47 - Motor fault')));

    expect(fieldById(frame, 'pri').rawValue).toBe(34);
    expect(fieldById(frame, 'facility').rawValue).toBe(4);
    expect(fieldById(frame, 'facility').physicalValue).toBe('security/authorization messages');
    expect(fieldById(frame, 'severity').rawValue).toBe(2);
    expect(fieldById(frame, 'severity').physicalValue).toBe('Critical');
  });

  it('başlık alanlarını sırayla çözer ve mesajı ayırır', () => {
    const { frame } = expectSuccess(parseSyslog(message('<34>1 2026-08-08T15:00:00Z device1 app 123 ID47 - Motor fault')));

    expect(fieldById(frame, 'version').rawValue).toBe('1');
    expect(fieldById(frame, 'timestamp').rawValue).toBe('2026-08-08T15:00:00Z');
    expect(fieldById(frame, 'hostname').rawValue).toBe('device1');
    expect(fieldById(frame, 'app-name').rawValue).toBe('app');
    expect(fieldById(frame, 'proc-id').rawValue).toBe('123');
    expect(fieldById(frame, 'msg-id').rawValue).toBe('ID47');
    expect(fieldById(frame, 'msg').rawValue).toBe('Motor fault');
    expect(errorCodes(frame)).toHaveLength(0);
  });

  it('mesajın bayt ofseti gerçekten mesajın başlangıcını gösterir', () => {
    const text = '<34>1 2026-08-08T15:00:00Z device1 app 123 ID47 - Motor fault';
    const { frame } = expectSuccess(parseSyslog(message(text)));

    const msg = fieldById(frame, 'msg');
    expect(text.slice(msg.offset, msg.offset + msg.length)).toBe('Motor fault');
  });

  it('NILVALUE alanı "tire" diye basmaz', () => {
    const { frame } = expectSuccess(parseSyslog(message('<0>1 - - - - - - Emergency, no metadata')));

    const hostname = fieldById(frame, 'hostname');
    // İki değer sütunu da BOŞ kalır; anlamı uyarı taşır.
    expect(hostname.rawValue).toBeUndefined();
    expect(hostname.physicalValue).toBeUndefined();
    expect(hostname.warnings).toContain('protocol.syslog.warning.nilValue');
    expect(fieldById(frame, 'msg').rawValue).toBe('Emergency, no metadata');
  });

  it('structured data elemanını SD-ID ve parametrelere ayırır', () => {
    const { frame } = expectSuccess(
      parseSyslog(
        message('<165>1 2026-08-22T12:00:00.123Z gateway sensord 42 ID9 [temperature sensor="1" value="85.2"] Over limit'),
      ),
    );

    expect(fieldById(frame, 'sd-0-id').rawValue).toBe('temperature');
    expect(fieldById(frame, 'sd-0-param-0').rawValue).toBe('1');
    expect(fieldById(frame, 'sd-0-param-0').name).toBe('Structured Data 0 — sensor');
    expect(fieldById(frame, 'sd-0-param-1').rawValue).toBe('85.2');
    expect(fieldById(frame, 'msg').rawValue).toBe('Over limit');
  });

  it('PARAM-VALUE içindeki kaçırılmış `]` elemanı bölmez', () => {
    const { frame } = expectSuccess(
      parseSyslog(message('<13>1 2026-08-22T12:00:00Z host app - - [ex@32473 note="a\\]b" q="say \\"hi\\""] tail')),
    );

    expect(fieldById(frame, 'sd-0-id').rawValue).toBe('ex@32473');
    // Kaçış çözülür: `\]` → `]`, `\"` → `"`.
    expect(fieldById(frame, 'sd-0-param-0').rawValue).toBe('a]b');
    expect(fieldById(frame, 'sd-0-param-1').rawValue).toBe('say "hi"');
    // Naif bölme burada mesajı `b" q=...` diye keserdi.
    expect(fieldById(frame, 'msg').rawValue).toBe('tail');
  });

  it('birden çok SD-ELEMENT art arda çözülür', () => {
    const { frame } = expectSuccess(
      parseSyslog(message('<13>1 2026-08-22T12:00:00Z host app - - [a@1 x="1"][b@2 y="2"] son')),
    );

    expect(fieldById(frame, 'sd-0-id').rawValue).toBe('a@1');
    expect(fieldById(frame, 'sd-1-id').rawValue).toBe('b@2');
    expect(fieldById(frame, 'sd-1-param-0').rawValue).toBe('2');
    expect(fieldById(frame, 'msg').rawValue).toBe('son');
  });

  it('kapanmayan structured data truncated-frame basar, döngüye girmez', () => {
    const { frame } = expectSuccess(parseSyslog(message('<13>1 2026-08-22T12:00:00Z host app - - [a@1 x="1"')));

    expect(frame.valid).toBe(false);
    expect(errorCodes(frame)).toContain('truncated-frame');
  });

  it('BOM’lu mesajı UTF-8 çözer ve BOM’u ayrı alan yapar', () => {
    const bytes = Uint8Array.from([
      ...message('<14>1 2026-08-22T12:00:00Z host app - - '),
      0xef,
      0xbb,
      0xbf,
      ...message('Sıcaklık aşıldı'),
    ]);
    const { frame } = expectSuccess(parseSyslog(bytes));

    expect(fieldById(frame, 'msg-bom').physicalValue).toBe('UTF-8');
    expect(fieldById(frame, 'msg').rawValue).toBe('Sıcaklık aşıldı');
    expect(warningCodes(frame)).not.toContain('protocol.syslog.warning.msgWithoutBom');
  });

  it('BOM yoksa kodlamanın bilinmediğini uyarır', () => {
    const { frame } = expectSuccess(parseSyslog(message('<14>1 2026-08-22T12:00:00Z host app - - plain')));

    expect(fieldById(frame, 'msg').warnings).toContain('protocol.syslog.warning.msgWithoutBom');
    expect(hasField(frame, 'msg-bom')).toBe(false);
  });

  it('RFC 3164 mesajını 5424 şemasıyla ÇÖZMEZ, tanır ve uyarır', () => {
    const { frame } = expectSuccess(parseSyslog(message('<34>Oct 11 22:14:15 mymachine su: failed for lonvick')));

    expect(warningCodes(frame)).toContain('protocol.syslog.warning.legacyBsdFormat');
    expect(fieldById(frame, 'legacy-body').valid).toBe(false);
    // "VERSION=Oct" gibi bir alan ÜRETİLMEZ.
    expect(hasField(frame, 'version')).toBe(false);
    expect(hasField(frame, 'hostname')).toBe(false);
    // PRI yine de çözülür — eski biçimde de aynı yerdedir.
    expect(fieldById(frame, 'severity').physicalValue).toBe('Critical');
  });

  it('başta sıfırlı PRI reddedilir, `<0>` kabul edilir', () => {
    // RFC 5424 §6.2.1: PRIVAL başta sıfır taşımaz.
    expect(expectFailure(parseSyslog(message('<034>1 2026-08-22T12:00:00Z host app - - x'))).error.code).toBe(
      'invalid-hex-input',
    );
    // Tek istisna: `<0>` kendisi geçerlidir.
    expect(expectSuccess(parseSyslog(message('<0>1 - - - - - - x'))).frame.fields.length).toBeGreaterThan(0);
  });

  it('boş, üç basamağı aşan ve sayısal olmayan PRI reddedilir', () => {
    for (const text of ['<>1 - - - - - - x', '<1234>1 - - - - - - x', '<ab>1 - - - - - - x']) {
      expect(expectFailure(parseSyslog(message(text))).error.code, text).toBe('invalid-hex-input');
    }
  });

  it('191 üstü PRI uyarılır ama çözüm sürer', () => {
    // Azami `23 × 8 + 7 = 191`; 200 tanımsız bir facility verirdi.
    const { frame } = expectSuccess(parseSyslog(message('<200>1 2026-08-22T12:00:00Z host app - - x')));

    expect(fieldById(frame, 'pri').valid).toBe(false);
    expect(fieldById(frame, 'facility').physicalValue).toBeUndefined();
    expect(warningCodes(frame)).toContain('protocol.syslog.warning.priOutOfRange');
  });

  it('sürüm 1 dışındaki değeri uyarır', () => {
    const { frame } = expectSuccess(parseSyslog(message('<34>2 2026-08-22T12:00:00Z host app - - x')));

    expect(fieldById(frame, 'version').valid).toBe(false);
    expect(warningCodes(frame)).toContain('protocol.syslog.warning.unexpectedVersion');
  });

  it('RFC 3339 olmayan zaman damgasını uyarır', () => {
    const { frame } = expectSuccess(parseSyslog(message('<34>1 22/08/2026 host app - - x')));

    expect(warningCodes(frame)).toContain('protocol.syslog.warning.timestampNotRfc3339');
  });

  it('başlığı yarım kalan mesaj truncated-frame basar', () => {
    const { frame } = expectSuccess(parseSyslog(message('<34>1 2026-08-22T12:00:00Z host')));

    expect(frame.valid).toBe(false);
    expect(errorCodes(frame)).toContain('truncated-frame');
  });

  it('severity dashboard’ın çok-mesaj işi olduğunu bildirir', () => {
    const { frame } = expectSuccess(parseSyslog(message('<34>1 2026-08-22T12:00:00Z host app - - x')));

    expect(warningCodes(frame)).toContain('protocol.syslog.warning.severityDashboardNeedsStream');
  });

  it('`<` ile başlamayan girdiyi start-delimiter-not-found ile reddeder', () => {
    const failure = expectFailure(parseSyslog(message('34>1 test')));

    expect(failure.error.code).toBe('start-delimiter-not-found');
    expect(failure.recoverable).toBe(true);
  });

  it('maxFrameLength aşımını frame-too-long ile durdurur', () => {
    const failure = expectFailure(
      syslogParser.parse(message('<34>1 2026-08-22T12:00:00Z host app - - uzun mesaj'), { maxFrameLength: 10 }),
    );

    expect(failure.error.code).toBe('frame-too-long');
  });

  it('iptal edilmiş signal ile parser-timeout döner', () => {
    const controller = new AbortController();
    controller.abort();

    expect(
      expectFailure(syslogParser.parse(message('<34>1 - - - - - - x'), { signal: controller.signal })).error.code,
    ).toBe('parser-timeout');
  });

  it('canParse PRI kabuğuna bakar, değerine değil', () => {
    expect(syslogParser.canParse(message('<34>1 - - - - - - x'))).toBe(true);
    // 191 üstü ön elemede reddedilmez.
    expect(syslogParser.canParse(message('<200>1 - - - - - - x'))).toBe(true);
    expect(syslogParser.canParse(message('34>1 test'))).toBe(false);
    expect(syslogParser.canParse(message('<>1 test'))).toBe(false);
    expect(syslogParser.canParse(message('<12345>1 test'))).toBe(false);
  });
});

describe('syslogPlugin', () => {
  it('örnekleri beyan ettikleri geçerlilikle çözülür', () => {
    for (const example of syslogPlugin.exampleFrames) {
      const result = parseSyslog(example.bytes);
      if (example.expectedValid === false) {
        const invalid = !result.success || !result.frame.valid;
        expect(invalid, `${example.id} geçersiz olmalıydı`).toBe(true);
        continue;
      }
      const { frame } = expectSuccess(result);
      expect(frame.valid, `${example.id} geçerli olmalıydı`).toBe(true);
    }
  });

  it('plugin kimliği ve kategorisi katalogla aynı', () => {
    expect(syslogPlugin.id).toBe('syslog');
    expect(syslogPlugin.category).toBe('network-ethernet');
    expect(syslogPlugin.parser).toBe(syslogParser);
  });
});
