import { describe, expect, it } from 'vitest';

import {
  atCommandsParser,
  atCommandsPlugin,
  createAtCommandSession,
  createAtLineExtractor,
  parseAtCommandLine,
} from './atCommands';
import type { ParseFailure, ParseResult, ParseSuccess, ParsedField, ParsedFrame } from '@/protocol-core/types';

function expectSuccess(result: ParseResult): ParseSuccess {
  if (!result.success) {
    throw new Error(`expected success, got error "${result.error.code}"`);
  }
  return result;
}

function expectFailure(result: ParseResult): ParseFailure {
  if (result.success) {
    throw new Error('expected failure, got success');
  }
  return result;
}

function fieldById(frame: ParsedFrame, id: string): ParsedField {
  const field = frame.fields.find((candidate) => candidate.id === id);
  if (field === undefined) {
    throw new Error(`field "${id}" not found among [${frame.fields.map((f) => f.id).join(', ')}]`);
  }
  return field;
}

function ascii(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

describe('parseAtCommandLine — komut satırı sınıflandırma', () => {
  it('execute komutunu (parametresiz) çözer', () => {
    const frame = expectSuccess(parseAtCommandLine(ascii('AT+CSQ\r\n'))).frame;

    expect(fieldById(frame, 'kind').rawValue).toBe('command');
    expect(fieldById(frame, 'prefix').rawValue).toBe('AT');
    expect(fieldById(frame, 'command-name').rawValue).toBe('CSQ');
    expect(fieldById(frame, 'action').rawValue).toBe('execute');
  });

  it('read komutunu (`?`) çözer', () => {
    const frame = expectSuccess(parseAtCommandLine(ascii('AT+CREG?\r\n'))).frame;

    expect(fieldById(frame, 'command-name').rawValue).toBe('CREG');
    expect(fieldById(frame, 'action').rawValue).toBe('read');
  });

  it('test komutunu (`=?`) çözer', () => {
    const frame = expectSuccess(parseAtCommandLine(ascii('AT+CGDCONT=?\r\n'))).frame;

    expect(fieldById(frame, 'command-name').rawValue).toBe('CGDCONT');
    expect(fieldById(frame, 'action').rawValue).toBe('test');
  });

  it('set komutunu (`=<params>`) parametreleriyle çözer', () => {
    const frame = expectSuccess(parseAtCommandLine(ascii('AT+CMGF=1\r\n'))).frame;

    expect(fieldById(frame, 'command-name').rawValue).toBe('CMGF');
    expect(fieldById(frame, 'action').rawValue).toBe('set');
    expect(fieldById(frame, 'parameters').rawValue).toBe('1');
  });

  it('çıplak `AT`ı komut sayar, isim/aksiyon üretmez', () => {
    const frame = expectSuccess(parseAtCommandLine(ascii('AT\r\n'))).frame;

    expect(fieldById(frame, 'kind').rawValue).toBe('command');
    expect(fieldById(frame, 'body').rawValue).toBe('');
    expect(frame.fields.some((field) => field.id === 'command-name')).toBe(false);
  });

  it('temel sözdizimini (ATD/ATZ) HAM gövdeyle komut sayar, uydurmaz', () => {
    const frame = expectSuccess(parseAtCommandLine(ascii('ATD5551234567;\r\n'))).frame;

    expect(fieldById(frame, 'kind').rawValue).toBe('command');
    expect(fieldById(frame, 'body').rawValue).toBe('D5551234567;');
    expect(frame.fields.some((field) => field.id === 'command-name')).toBe(false);
  });

  it('karışık büyük/küçük harf önekte (`At`) uyarı verir ama geçerli kalır', () => {
    const result = expectSuccess(parseAtCommandLine(ascii('At+CSQ\r\n')));

    expect(result.frame.valid).toBe(true);
    expect(result.frame.warnings.map((warning) => warning.code)).toContain(
      'protocol.atCommands.warning.mixedCasePrefix',
    );
  });
});

describe('parseAtCommandLine — bilgi yanıtı (information)', () => {
  it('`+NAME: params` biçimini prefix/parameters olarak ayırır', () => {
    const frame = expectSuccess(parseAtCommandLine(ascii('+CSQ: 20,99\r\n'))).frame;

    expect(fieldById(frame, 'kind').rawValue).toBe('information');
    expect(fieldById(frame, 'prefix').rawValue).toBe('+CSQ');
    expect(fieldById(frame, 'parameters').rawValue).toBe('20,99');
  });

  it('parametresiz `+NAME` satırında yalnız prefix üretir', () => {
    const frame = expectSuccess(parseAtCommandLine(ascii('+CREG\r\n'))).frame;

    expect(fieldById(frame, 'prefix').rawValue).toBe('+CREG');
    expect(frame.fields.some((field) => field.id === 'parameters')).toBe(false);
  });
});

describe('parseAtCommandLine — final result code', () => {
  it.each(['OK', 'ERROR', 'RING', 'NO CARRIER', 'NO DIALTONE', 'NO ANSWER', 'BUSY'])(
    'çıplak "%s" kodunu final-result-code sayar',
    (code) => {
      const frame = expectSuccess(parseAtCommandLine(ascii(`${code}\r\n`))).frame;

      expect(fieldById(frame, 'kind').rawValue).toBe('final-result-code');
      expect(fieldById(frame, 'result-code').rawValue).toBe(code);
    },
  );

  it('`CONNECT` hız bilgisiyle gelirse sayısal connect-rate üretir', () => {
    const frame = expectSuccess(parseAtCommandLine(ascii('CONNECT 115200\r\n'))).frame;

    expect(fieldById(frame, 'result-code').rawValue).toBe('CONNECT');
    expect(fieldById(frame, 'connect-rate').rawValue).toBe(115200);
    expect(fieldById(frame, 'connect-rate').physicalValue).toBe(115200);
    expect(fieldById(frame, 'connect-rate').unit).toBe('bit/s');
  });

  it('çıplak `CONNECT` hız alanı üretmez', () => {
    const frame = expectSuccess(parseAtCommandLine(ascii('CONNECT\r\n'))).frame;

    expect(fieldById(frame, 'result-code').rawValue).toBe('CONNECT');
    expect(frame.fields.some((field) => field.id === 'connect-rate')).toBe(false);
  });

  it('`+CME ERROR: <sayı>` (AT+CMEE=1, numeric) kodu sayı olarak taşır', () => {
    const frame = expectSuccess(parseAtCommandLine(ascii('+CME ERROR: 10\r\n'))).frame;

    expect(fieldById(frame, 'kind').rawValue).toBe('final-result-code');
    expect(fieldById(frame, 'result-code').rawValue).toBe('+CME ERROR');
    expect(fieldById(frame, 'error-code').rawValue).toBe(10);
  });

  it('`+CME ERROR: <metin>` (AT+CMEE=2, verbose) kodu metin olarak taşır — SAYIYA ÇEVİRMEZ', () => {
    const frame = expectSuccess(parseAtCommandLine(ascii('+CME ERROR: SIM not inserted\r\n'))).frame;

    expect(fieldById(frame, 'error-code').rawValue).toBe('SIM not inserted');
  });

  it('`+CMS ERROR: <sayı>` kodunu ayrı bir alan adıyla taşır', () => {
    const frame = expectSuccess(parseAtCommandLine(ascii('+CMS ERROR: 500\r\n'))).frame;

    expect(fieldById(frame, 'result-code').rawValue).toBe('+CMS ERROR');
    expect(fieldById(frame, 'error-code').rawValue).toBe(500);
  });

  it('CME/CMS kod SAYISI bir anlam tablosuna bağlanmaz — yalnız yapı çözülür', () => {
    // TS 27.007 Annex'in ~250 kodluk tablosu bu dalganın kapsamı dışında
    // (obd.ts'in PID tablosu uyarısıyla aynı gerekçe). 10'un "SIM not
    // inserted" anlamına geldiğini iddia eden BAŞKA bir alan olmamalı.
    const frame = expectSuccess(parseAtCommandLine(ascii('+CME ERROR: 10\r\n'))).frame;

    expect(frame.fields.some((field) => field.id === 'error-meaning')).toBe(false);
  });
});

describe('parseAtCommandLine — prompt ve serbest metin', () => {
  it('`>` veri girişi promptunu ayrı bir kind olarak işaretler', () => {
    const frame = expectSuccess(parseAtCommandLine(ascii('>'))).frame;

    expect(fieldById(frame, 'kind').rawValue).toBe('prompt');
  });

  it('bilinen hiçbir kalıba uymayan satırı text sayar, hata üretmez', () => {
    const frame = expectSuccess(parseAtCommandLine(ascii('Quectel BG96\r\n'))).frame;

    expect(fieldById(frame, 'kind').rawValue).toBe('text');
    expect(fieldById(frame, 'text').rawValue).toBe('Quectel BG96');
    expect(frame.valid).toBe(true);
  });
});

describe('parseAtCommandLine — satır sonu ve ofset güvenliği', () => {
  it('yalnız `\\r`/`\\n` kırpılır, satır ortasındaki bayt ofsetleri bozulmaz', () => {
    const withCrlf = expectSuccess(parseAtCommandLine(ascii('AT+CSQ\r\n'))).frame;
    const withoutTerminator = expectSuccess(parseAtCommandLine(ascii('AT+CSQ'))).frame;

    expect(fieldById(withCrlf, 'command-name').offset).toBe(fieldById(withoutTerminator, 'command-name').offset);
  });

  it('yalnız `\\r` ile biten satırı da (V.250 S4=0) doğru çözer', () => {
    const frame = expectSuccess(parseAtCommandLine(ascii('OK\r'))).frame;

    expect(fieldById(frame, 'result-code').rawValue).toBe('OK');
  });
});

describe('parseAtCommandLine — hata yolları', () => {
  it('boş girdide truncated-frame döner', () => {
    expect(expectFailure(parseAtCommandLine(new Uint8Array(0))).error.code).toBe('truncated-frame');
  });

  it('maxFrameLength aşılınca frame-too-long döner', () => {
    const result = atCommandsParser.parse(ascii('AT+VERYLONGCOMMAND\r\n'), { maxFrameLength: 5 });
    expect(expectFailure(result).error.code).toBe('frame-too-long');
  });

  it('iptal edilmiş signal ile parser-timeout döner', () => {
    const controller = new AbortController();
    controller.abort();
    const result = atCommandsParser.parse(ascii('OK\r\n'), { signal: controller.signal });
    expect(expectFailure(result).error.code).toBe('parser-timeout');
  });

  it('canParse boş girdide false, dolu girdide true döner', () => {
    expect(atCommandsParser.canParse(new Uint8Array(0))).toBe(false);
    expect(atCommandsParser.canParse(ascii('OK'))).toBe(true);
  });
});

describe('createAtLineExtractor', () => {
  it('varsayılan `\\r\\n` ile bir satırı arabellekten keser', () => {
    const extractor = createAtLineExtractor();
    const buffer = ascii('OK\r\n+CSQ: 20,99\r\n');

    const first = extractor.extract(buffer, { maxFrameLength: 4096 });
    if (first.status !== 'complete') throw new Error(`beklenmedik durum: ${first.status}`);
    expect(new TextDecoder().decode(first.frame)).toBe('OK');
    expect(first.consumedBytes).toBe(4); // "OK\r\n"
  });

  it('SABİT `\\r\\n` varsaymaz — yalnız `\\r` (S4=0) terminatörüyle de çalışır', () => {
    // Brief tuzağı: bazı modemler yalnız CR kullanır, S3/S4 seçilebilirdir.
    const extractor = createAtLineExtractor([0x0d]);
    const buffer = ascii('OK\r+CSQ: 20,99\r');

    const first = extractor.extract(buffer, { maxFrameLength: 4096 });
    if (first.status !== 'complete') throw new Error(`beklenmedik durum: ${first.status}`);
    expect(new TextDecoder().decode(first.frame)).toBe('OK');
  });

  it('tamamlanmamış satırda incomplete döner', () => {
    const extractor = createAtLineExtractor();
    const result = extractor.extract(ascii('AT+CS'), { maxFrameLength: 4096 });
    expect(result.status).toBe('incomplete');
  });
});

describe('createAtCommandSession — IDLE→COMMAND_SENT→WAIT_RESPONSE→FINAL_RESULT', () => {
  it('idle başlar, sendCommand sonrası command-sent olur', () => {
    const session = createAtCommandSession();
    expect(session.state).toBe('idle');

    session.sendCommand('AT+CSQ');
    expect(session.state).toBe('command-sent');
  });

  it('echo tüketilir, yanıt satırına eklenmez; final result ile transaction biter', () => {
    const session = createAtCommandSession();
    const transactions: string[] = [];
    session.onTransaction((transaction) => {
      transactions.push(transaction.command);
      expect(transaction.responseLines).toHaveLength(1);
      expect(transaction.finalResult.fields.find((field) => field.id === 'result-code')?.rawValue).toBe('OK');
    });

    session.sendCommand('AT+CSQ');
    session.pushLine(ascii('AT+CSQ\r\n')); // echo
    expect(session.state).toBe('wait-response');
    session.pushLine(ascii('+CSQ: 20,99\r\n')); // yanıt
    session.pushLine(ascii('OK\r\n')); // final result

    expect(transactions).toEqual(['AT+CSQ']);
    expect(session.state).toBe('idle');
  });

  it('echo BASKILANMIŞSA (ATE0) ilk satır doğrudan yanıt sayılır', () => {
    const session = createAtCommandSession();
    let responseLineCount = -1;
    session.onTransaction((transaction) => {
      responseLineCount = transaction.responseLines.length;
    });

    session.sendCommand('AT+CSQ');
    // Echo YOK — ilk gelen satır doğrudan yanıt içeriği.
    session.pushLine(ascii('+CSQ: 20,99\r\n'));
    session.pushLine(ascii('OK\r\n'));

    expect(responseLineCount).toBe(1);
  });

  it('idle durumda gelen satır URC sayılır, transaction açmaz', () => {
    const session = createAtCommandSession();
    const urcs: string[] = [];
    const transactions: string[] = [];
    session.onUnsolicited((frame) => {
      const prefix = frame.fields.find((field) => field.id === 'prefix')?.rawValue;
      if (typeof prefix === 'string') urcs.push(prefix);
    });
    session.onTransaction((transaction) => transactions.push(transaction.command));

    session.pushLine(ascii('+CREG: 1\r\n'));

    expect(urcs).toEqual(['+CREG']);
    expect(transactions).toEqual([]);
    expect(session.state).toBe('idle');
  });

  it('prompt satırı onPrompt tetikler, wait-response durumunda kalır', () => {
    const session = createAtCommandSession();
    let promptSeen = false;
    session.onPrompt(() => {
      promptSeen = true;
    });

    session.sendCommand('AT+CMGS="+905551234567"');
    session.pushLine(ascii('AT+CMGS="+905551234567"\r\n'));
    session.pushLine(ascii('>'));

    expect(promptSeen).toBe(true);
    expect(session.state).toBe('wait-response');
  });

  it('ardışık iki komut ayrı transaction üretir, birbirine karışmaz', () => {
    const session = createAtCommandSession();
    const transactions: Array<{ command: string; lines: number }> = [];
    session.onTransaction((transaction) => {
      transactions.push({ command: transaction.command, lines: transaction.responseLines.length });
    });

    session.sendCommand('AT+CSQ');
    session.pushLine(ascii('AT+CSQ\r\n'));
    session.pushLine(ascii('+CSQ: 20,99\r\n'));
    session.pushLine(ascii('OK\r\n'));

    session.sendCommand('AT+CREG?');
    session.pushLine(ascii('AT+CREG?\r\n'));
    session.pushLine(ascii('+CREG: 0,1\r\n'));
    session.pushLine(ascii('OK\r\n'));

    expect(transactions).toEqual([
      { command: 'AT+CSQ', lines: 1 },
      { command: 'AT+CREG?', lines: 1 },
    ]);
  });

  it('transaction süresi sentAt/completedAt farkından hesaplanır', () => {
    const session = createAtCommandSession();
    let durationMs = -1;
    session.onTransaction((transaction) => {
      durationMs = transaction.durationMs;
    });

    session.sendCommand('AT+CSQ', 1000);
    session.pushLine(ascii('AT+CSQ\r\n'), 1005);
    session.pushLine(ascii('OK\r\n'), 1050);

    expect(durationMs).toBe(50);
  });

  it('reset bekleyen transaction’ı düşürür ve idle’a döner', () => {
    const session = createAtCommandSession();
    session.sendCommand('AT+CSQ');
    session.reset();

    expect(session.state).toBe('idle');
  });

  it('dinleyici aboneliği geri dönen fonksiyonla kaldırılabilir', () => {
    const session = createAtCommandSession();
    let callCount = 0;
    const unsubscribe = session.onTransaction(() => {
      callCount += 1;
    });
    unsubscribe();

    session.sendCommand('AT+CSQ');
    session.pushLine(ascii('OK\r\n'));

    expect(callCount).toBe(0);
  });
});

describe('atCommandsPlugin', () => {
  it('katalogdaki kimlik, kategori ve parser bağını taşır', () => {
    expect(atCommandsPlugin.id).toBe('at-commands');
    expect(atCommandsPlugin.category).toBe('interfaces-framing');
    expect(atCommandsPlugin.parser).toBe(atCommandsParser);
  });

  it('her örnek çözülür ve expectedValid ile eşleşir', () => {
    for (const example of atCommandsPlugin.exampleFrames) {
      const result = atCommandsParser.parse(example.bytes);
      if (!result.success) {
        throw new Error(`example "${example.id}" failed: ${result.error.code}`);
      }
      expect(result.frame.valid, `example "${example.id}"`).toBe(example.expectedValid ?? true);
    }
  });

  it('her örnek adı/açıklaması protocol.atCommands.example. önekli çeviri anahtarıdır', () => {
    for (const example of atCommandsPlugin.exampleFrames) {
      expect(example.name.startsWith('protocol.atCommands.example.'), example.id).toBe(true);
      expect(example.description?.startsWith('protocol.atCommands.example.'), example.id).toBe(true);
    }
  });

  it('örnekler beş AtLineKind değerinin tamamını kapsar', () => {
    // command / information / final-result-code / prompt / text.
    const ids = atCommandsPlugin.exampleFrames.map((example) => example.id);
    expect(ids).toContain('command-execute');
    expect(ids).toContain('information-response');
    expect(ids).toContain('final-result-ok');
    expect(ids).toContain('prompt');
    expect(ids).toContain('banner-text');
  });

  it('exampleFrames boş değildir (registry testinin genel kuralı)', () => {
    expect(atCommandsPlugin.exampleFrames.length).toBeGreaterThan(0);
  });
});
