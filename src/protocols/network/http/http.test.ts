import { describe, expect, it } from 'vitest';

import { httpParser, httpPlugin, parseHttp } from './http';
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

describe('httpParser', () => {
  it('istek satırını metot / hedef / sürüm olarak çözer', () => {
    const { frame } = expectSuccess(
      parseHttp(message('GET /api/status HTTP/1.1\r\nHost: 192.168.1.20\r\n\r\n')),
    );

    expect(fieldById(frame, 'message-kind').physicalValue).toBe('Request');
    expect(fieldById(frame, 'method').rawValue).toBe('GET');
    expect(fieldById(frame, 'request-target').rawValue).toBe('/api/status');
    expect(fieldById(frame, 'http-version').rawValue).toBe('HTTP/1.1');
    expect(fieldById(frame, 'header-0-name').rawValue).toBe('Host');
    expect(fieldById(frame, 'header-0-value').rawValue).toBe('192.168.1.20');
    expect(errorCodes(frame)).toHaveLength(0);
  });

  it('durum satırını çözer ve kayıtlı reason phrase’i adlandırır', () => {
    const { frame } = expectSuccess(parseHttp(message('HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\n\r\n')));

    expect(fieldById(frame, 'message-kind').physicalValue).toBe('Response');
    expect(fieldById(frame, 'status-code').rawValue).toBe(404);
    expect(fieldById(frame, 'status-code').physicalValue).toBe('Not Found');
  });

  it('başlık değerinin bayt ofseti gerçekten değeri gösterir', () => {
    const text = 'GET / HTTP/1.1\r\nHost: gw.local\r\n\r\n';
    const { frame } = expectSuccess(parseHttp(message(text)));

    const value = fieldById(frame, 'header-0-value');
    expect(text.slice(value.offset, value.offset + value.length)).toBe('gw.local');
  });

  it('Content-Length ile gövdeyi keser', () => {
    const { frame } = expectSuccess(
      parseHttp(message('HTTP/1.1 200 OK\r\nContent-Length: 5\r\n\r\nhello')),
    );

    expect(fieldById(frame, 'body-framing').physicalValue).toBe('Content-Length');
    expect(fieldById(frame, 'body').rawValue).toBe('hello');
    expect(errorCodes(frame)).toHaveLength(0);
  });

  it('Content-Length gövdeden uzunsa truncated-frame basar', () => {
    const { frame } = expectSuccess(parseHttp(message('HTTP/1.1 200 OK\r\nContent-Length: 50\r\n\r\nhello')));

    expect(frame.valid).toBe(false);
    expect(errorCodes(frame)).toContain('truncated-frame');
  });

  it('Content-Length’ten uzun gövdeyi boru hattı sayıp uyarır', () => {
    const { frame } = expectSuccess(
      parseHttp(message('HTTP/1.1 200 OK\r\nContent-Length: 2\r\n\r\nhello')),
    );

    expect(fieldById(frame, 'body').rawValue).toBe('he');
    expect(warningCodes(frame)).toContain('protocol.http.warning.bodyLongerThanDeclared');
  });

  it('chunked gövdeyi çözer ve toplam uzunluğu türetir', () => {
    // Spec örneği: `4\r\nWiki\r\n5\r\npedia\r\n0\r\n\r\n` → 9 bayt "Wikipedia".
    const { frame } = expectSuccess(
      parseHttp(message('HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n\r\n4\r\nWiki\r\n5\r\npedia\r\n0\r\n\r\n')),
    );

    expect(fieldById(frame, 'body-framing').physicalValue).toBe('Transfer-Encoding: chunked');
    expect(fieldById(frame, 'chunk-0-data').rawValue).toBe('Wiki');
    expect(fieldById(frame, 'chunk-1-data').rawValue).toBe('pedia');
    expect(fieldById(frame, 'reassembled-body-length').physicalValue).toBe(9);
  });

  it('chunk boyutu ONALTILIK okunur', () => {
    // `10` = 16 bayt. Ondalık okuyan çözücü 10 bayt alır ve kayar.
    const { frame } = expectSuccess(
      parseHttp(message('HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n\r\n10\r\n0123456789abcdef\r\n0\r\n\r\n')),
    );

    expect(fieldById(frame, 'chunk-0-size').physicalValue).toBe(16);
    expect(fieldById(frame, 'chunk-0-data').rawValue).toBe('0123456789abcdef');
    expect(fieldById(frame, 'reassembled-body-length').physicalValue).toBe(16);
  });

  it('chunk-ext okunur ama yok sayılır', () => {
    const { frame } = expectSuccess(
      parseHttp(message('HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n\r\n4;name=v\r\nWiki\r\n0\r\n\r\n')),
    );

    expect(fieldById(frame, 'chunk-0-size').physicalValue).toBe(4);
    expect(fieldById(frame, 'chunk-0-data').rawValue).toBe('Wiki');
    expect(warningCodes(frame)).toContain('protocol.http.warning.chunkExtensionIgnored');
  });

  it('onaltılık olmayan chunk boyutunu invalid-hex-input ile reddeder', () => {
    const { frame } = expectSuccess(
      parseHttp(message('HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n\r\nzz\r\nWiki\r\n0\r\n\r\n')),
    );

    expect(frame.valid).toBe(false);
    expect(errorCodes(frame)).toContain('invalid-hex-input');
  });

  it('tampona sığmayan chunk boyutunda döngüye girmeden durur', () => {
    const { frame } = expectSuccess(
      parseHttp(message('HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n\r\nff\r\nkısa\r\n')),
    );

    expect(errorCodes(frame)).toContain('truncated-frame');
  });

  it('Content-Length + Transfer-Encoding birlikteyse smuggling hatası basar', () => {
    const { frame } = expectSuccess(
      parseHttp(
        message('POST /x HTTP/1.1\r\nHost: gw\r\nContent-Length: 6\r\nTransfer-Encoding: chunked\r\n\r\n0\r\n\r\n'),
      ),
    );

    expect(frame.valid).toBe(false);
    expect(errorCodes(frame)).toContain('length-mismatch');
    // Çerçeveleme yine de Transfer-Encoding'ten gelir (RFC 9112 §6.3).
    expect(fieldById(frame, 'body-framing').physicalValue).toBe('Transfer-Encoding: chunked');
  });

  it('çelişen çoklu Content-Length hata basar', () => {
    const { frame } = expectSuccess(
      parseHttp(message('POST /x HTTP/1.1\r\nContent-Length: 5\r\nContent-Length: 9\r\n\r\nhello')),
    );

    expect(frame.valid).toBe(false);
    expect(errorCodes(frame)).toContain('length-mismatch');
  });

  it('başlık adıyla iki nokta arasındaki boşluğu reddeder', () => {
    // RFC 9112 §5.1 — smuggling vektörü.
    const { frame } = expectSuccess(
      parseHttp(message('POST /x HTTP/1.1\r\nHost: gw\r\nContent-Length : 5\r\n\r\nhello')),
    );

    expect(frame.valid).toBe(false);
    expect(errorCodes(frame)).toContain('value-out-of-range');
    expect(fieldById(frame, 'header-1-name').valid).toBe(false);
  });

  it('204 yanıtı Content-Length yazsa bile gövdesizdir', () => {
    const { frame } = expectSuccess(parseHttp(message('HTTP/1.1 204 No Content\r\nContent-Length: 12\r\n\r\n')));

    expect(fieldById(frame, 'body-framing').physicalValue).toBe('No body');
    expect(hasField(frame, 'body')).toBe(false);
  });

  it('304 ve 1xx yanıtları da gövdesizdir', () => {
    for (const line of ['HTTP/1.1 304 Not Modified', 'HTTP/1.1 100 Continue']) {
      const { frame } = expectSuccess(parseHttp(message(`${line}\r\nContent-Length: 7\r\n\r\n`)));
      expect(fieldById(frame, 'body-framing').physicalValue, line).toBe('No body');
    }
  });

  it('HEAD yanıtı decodeOptions ile bildirilince gövdesiz sayılır', () => {
    const bytes = message('HTTP/1.1 200 OK\r\nContent-Length: 1234\r\n\r\n');

    // Bağlamsız: Content-Length gövde vaat eder ve eksik gövde hata basar.
    expect(errorCodes(expectSuccess(parseHttp(bytes)).frame)).toContain('truncated-frame');

    // İstek HEAD idiyse gövde YOKTUR — bu yanıttan çıkarılamaz.
    const withContext = expectSuccess(httpParser.parse(bytes, { options: { requestMethod: 'HEAD' } }));
    expect(fieldById(withContext.frame, 'body-framing').physicalValue).toBe('No body');
    expect(errorCodes(withContext.frame)).toHaveLength(0);
    expect(warningCodes(withContext.frame)).toContain('protocol.http.warning.headResponseAssumed');
  });

  it('çerçeveleme başlığı olmayan yanıt bağlantı kapanana kadar okunur', () => {
    const { frame } = expectSuccess(parseHttp(message('HTTP/1.1 200 OK\r\nServer: gw\r\n\r\ngövde')));

    expect(fieldById(frame, 'body-framing').physicalValue).toBe('Until connection close');
    expect(warningCodes(frame)).toContain('protocol.http.warning.bodyUntilClose');
  });

  it('çerçeveleme başlığı olmayan istek gövdesizdir', () => {
    const { frame } = expectSuccess(parseHttp(message('GET /x HTTP/1.1\r\nHost: gw\r\n\r\n')));

    expect(fieldById(frame, 'body-framing').physicalValue).toBe('No body');
  });

  it('HTTP/2 sürümünü tanır ama çözmez', () => {
    const { frame } = expectSuccess(parseHttp(message('GET / HTTP/2.0\r\nHost: gw\r\n\r\n')));

    expect(fieldById(frame, 'http-version').valid).toBe(false);
    expect(warningCodes(frame)).toContain('protocol.http.warning.binaryFramingVersion');
  });

  it('tanınmayan metodu uyarır ama hata basmaz', () => {
    const { frame } = expectSuccess(parseHttp(message('PROPFIND /x HTTP/1.1\r\nHost: gw\r\n\r\n')));

    expect(frame.valid).toBe(true);
    expect(warningCodes(frame)).toContain('protocol.http.warning.unknownMethod');
  });

  it('obs-fold satırını tanır ama birleştirmez', () => {
    const { frame } = expectSuccess(
      parseHttp(message('GET /x HTTP/1.1\r\nHost: gw\r\n devam\r\n\r\n')),
    );

    expect(warningCodes(frame)).toContain('protocol.http.warning.obsFold');
  });

  it('başlık sonlandırıcısı yoksa truncated-frame ile reddeder', () => {
    const failure = expectFailure(parseHttp(message('GET /x HTTP/1.1\r\nHost: gw\r\n')));

    expect(failure.error.code).toBe('truncated-frame');
    expect(failure.recoverable).toBe(true);
  });

  it('bozuk başlangıç satırını start-delimiter-not-found ile reddeder', () => {
    const failure = expectFailure(parseHttp(message('BOZUKSATIR\r\nHost: gw\r\n\r\n')));

    expect(failure.error.code).toBe('start-delimiter-not-found');
  });

  it('işlem eşleştirmesinin akış işi olduğunu bildirir', () => {
    const { frame } = expectSuccess(parseHttp(message('GET /x HTTP/1.1\r\nHost: gw\r\n\r\n')));

    expect(warningCodes(frame)).toContain('protocol.http.warning.transactionMatchingNeedsStream');
  });

  it('maxFrameLength ve iptal edilmiş signal ayrı ayrı durdurur', () => {
    const bytes = message('GET /x HTTP/1.1\r\nHost: gw\r\n\r\n');
    expect(expectFailure(httpParser.parse(bytes, { maxFrameLength: 5 })).error.code).toBe('frame-too-long');

    const controller = new AbortController();
    controller.abort();
    expect(expectFailure(httpParser.parse(bytes, { signal: controller.signal })).error.code).toBe('parser-timeout');
  });

  it('canParse başlangıç satırının kabuğuna bakar', () => {
    expect(httpParser.canParse(message('GET /x HTTP/1.1\r\nHost: gw\r\n\r\n'))).toBe(true);
    expect(httpParser.canParse(message('HTTP/1.1 200 OK\r\n\r\nxxxxxxxxxxx'))).toBe(true);
    expect(httpParser.canParse(message('ZZZZ /x HTTP/1.1\r\n\r\nxxxxxxxxxx'))).toBe(false);
    expect(httpParser.canParse(message('kısa'))).toBe(false);
  });
});

describe('httpPlugin', () => {
  it('örnekleri beyan ettikleri geçerlilikle çözülür', () => {
    for (const example of httpPlugin.exampleFrames) {
      const result = parseHttp(example.bytes);
      if (example.expectedValid === false) {
        const invalid = !result.success || !result.frame.valid;
        expect(invalid, `${example.id} geçersiz olmalıydı`).toBe(true);
        continue;
      }
      const { frame } = expectSuccess(result);
      expect(frame.valid, `${example.id} geçerli olmalıydı`).toBe(true);
    }
  });

  it('decodeOptions yalnız requestMethod sorar', () => {
    const options = httpPlugin.decodeOptions ?? [];
    expect(options).toHaveLength(1);
    expect(options[0]?.id).toBe('requestMethod');
    expect(options[0]?.defaultValue).toBe('unknown');
  });

  it('plugin kimliği ve kategorisi katalogla aynı', () => {
    expect(httpPlugin.id).toBe('http');
    expect(httpPlugin.category).toBe('network-ethernet');
    expect(httpPlugin.parser).toBe(httpParser);
  });
});
