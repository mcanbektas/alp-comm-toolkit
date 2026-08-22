import { describe, expect, it } from 'vitest';

import { parseWebSocket, webSocketParser, webSocketPlugin } from './websocket';
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

const FIN = 0x80;
const MASK = 0x80;
const OPCODE_CONTINUATION = 0x0;
const OPCODE_TEXT = 0x1;
const OPCODE_BINARY = 0x2;
const OPCODE_CLOSE = 0x8;
const OPCODE_PING = 0x9;

function utf8(text: string): number[] {
  return Array.from(new TextEncoder().encode(text));
}

function maskedFrame(opcode: number, payload: readonly number[], key: readonly number[]): Uint8Array {
  const masked = payload.map((byte, index) => byte ^ (key[index % 4] ?? 0));
  return Uint8Array.from([FIN | opcode, MASK | payload.length, ...key, ...masked]);
}

describe('webSocketParser', () => {
  it('bayt 0’ı FIN / RSV / opcode olarak böler', () => {
    const { frame } = expectSuccess(parseWebSocket(Uint8Array.from([FIN | OPCODE_TEXT, 5, ...utf8('hello')])));

    expect(fieldById(frame, 'fin').rawValue).toBe(1);
    expect(fieldById(frame, 'opcode').physicalValue).toBe('Text');
    expect(fieldById(frame, 'payload').rawValue).toBe('hello');
    for (const id of ['fin', 'rsv1', 'rsv2', 'rsv3', 'opcode']) {
      expect(fieldById(frame, id).offset, id).toBe(0);
    }
  });

  it('yönü MASK bitinden türetir, tahmin etmez', () => {
    const server = expectSuccess(parseWebSocket(Uint8Array.from([FIN | OPCODE_TEXT, 2, 0x68, 0x69])));
    expect(fieldById(server.frame, 'direction').physicalValue).toBe('Server → Client');

    const client = expectSuccess(parseWebSocket(maskedFrame(OPCODE_TEXT, utf8('hi'), [1, 2, 3, 4])));
    expect(fieldById(client.frame, 'direction').physicalValue).toBe('Client → Server');
  });

  it('maskeli yükü XOR’la açar', () => {
    const key = [0x37, 0xfa, 0x21, 0x3d];
    const { frame } = expectSuccess(parseWebSocket(maskedFrame(OPCODE_TEXT, utf8('merhaba'), key)));

    expect(fieldById(frame, 'masking-key').rawValue).toBe('0x37fa213d');
    expect(fieldById(frame, 'payload').rawValue).toBe('merhaba');
    // Ham baytlar maskeli hâlini korur; açılan değer `rawValue`dadır.
    expect(fieldById(frame, 'payload').rawBytes[0]).not.toBe(utf8('merhaba')[0]);
  });

  it('126 uzunluk kodu 16 bitlik uzatmayı okur', () => {
    const payload = new Array<number>(200).fill(0xab);
    const { frame } = expectSuccess(
      parseWebSocket(Uint8Array.from([FIN | OPCODE_BINARY, 126, 0x00, 0xc8, ...payload])),
    );

    expect(fieldById(frame, 'extended-payload-length').rawValue).toBe(200);
    expect(fieldById(frame, 'payload').length).toBe(200);
    expect(errorCodes(frame)).toHaveLength(0);
  });

  it('127 uzunluk kodunun en anlamlı biti 1 ise reddeder', () => {
    const { frame } = expectSuccess(
      parseWebSocket(Uint8Array.from([FIN | OPCODE_BINARY, 127, 0x80, 0, 0, 0, 0, 0, 0, 1])),
    );

    expect(frame.valid).toBe(false);
    expect(errorCodes(frame)).toContain('value-out-of-range');
  });

  it('gereksiz uzun uzunluk biçimini uyarır', () => {
    // 5 baytlık yük 126 biçimiyle gönderilmiş: en kısası zorunludur (§5.2).
    const { frame } = expectSuccess(
      parseWebSocket(Uint8Array.from([FIN | OPCODE_TEXT, 126, 0x00, 0x05, ...utf8('hello')])),
    );

    expect(warningCodes(frame)).toContain('protocol.websocket.warning.nonMinimalLength');
  });

  it('kontrol çerçevesi 125 baytı aşamaz', () => {
    const { frame } = expectSuccess(
      parseWebSocket(Uint8Array.from([FIN | OPCODE_PING, 126, 0x00, 0x7e, ...new Array<number>(126).fill(0)])),
    );

    expect(frame.valid).toBe(false);
    expect(errorCodes(frame)).toContain('value-out-of-range');
  });

  it('kontrol çerçevesi parçalanamaz (FIN=0 hatadır)', () => {
    const { frame } = expectSuccess(parseWebSocket(Uint8Array.from([OPCODE_PING, 2, 0x01, 0x02])));

    expect(frame.valid).toBe(false);
    expect(errorCodes(frame)).toContain('value-out-of-range');
  });

  it('veri çerçevesinde FIN=0 hata değildir, birleştirme uyarısı verir', () => {
    const { frame } = expectSuccess(parseWebSocket(Uint8Array.from([OPCODE_TEXT, 4, ...utf8('part')])));

    expect(frame.valid).toBe(true);
    expect(fieldById(frame, 'fin').physicalValue).toBe('More fragments');
    expect(warningCodes(frame)).toContain('protocol.websocket.warning.fragmentReassemblyNeedsStream');
  });

  it('Continuation çerçevesinin yük tipini yorumlamaz', () => {
    const { frame } = expectSuccess(
      parseWebSocket(Uint8Array.from([FIN | OPCODE_CONTINUATION, 3, ...utf8('abc')])),
    );

    expect(fieldById(frame, 'opcode').physicalValue).toBe('Continuation');
    // Metin mi ikili mi olduğu İLK parçadaydı; burada ham gösterilir.
    expect(fieldById(frame, 'payload').rawValue).toBe('0x616263');
    expect(warningCodes(frame)).toContain('protocol.websocket.warning.continuationOpcodeUnknown');
  });

  it('Close yükünü durum kodu ve UTF-8 gerekçeye ayırır', () => {
    const { frame } = expectSuccess(
      parseWebSocket(Uint8Array.from([FIN | OPCODE_CLOSE, 5, 0x03, 0xe8, ...utf8('bye')])),
    );

    expect(fieldById(frame, 'close-status').rawValue).toBe(1000);
    expect(fieldById(frame, 'close-status').physicalValue).toBe('Normal Closure');
    expect(fieldById(frame, 'close-reason').rawValue).toBe('bye');
  });

  it('telde görünemeyecek Close durum kodunu uyarır', () => {
    // 1006 yerel kullanım içindir (§7.4.1).
    const { frame } = expectSuccess(parseWebSocket(Uint8Array.from([FIN | OPCODE_CLOSE, 2, 0x03, 0xee])));

    expect(fieldById(frame, 'close-status').valid).toBe(false);
    expect(warningCodes(frame)).toContain('protocol.websocket.warning.closeStatusReserved');
  });

  it('boş Close yükü geçerlidir, tek baytlık olan değildir', () => {
    const empty = expectSuccess(parseWebSocket(Uint8Array.from([FIN | OPCODE_CLOSE, 0])));
    expect(hasField(empty.frame, 'close-status')).toBe(false);
    expect(warningCodes(empty.frame)).not.toContain('protocol.websocket.warning.closePayloadTooShort');

    const short = expectSuccess(parseWebSocket(Uint8Array.from([FIN | OPCODE_CLOSE, 1, 0x03])));
    expect(warningCodes(short.frame)).toContain('protocol.websocket.warning.closePayloadTooShort');
  });

  it('Text yükü geçersiz UTF-8 ise ham gösterir ve uyarır', () => {
    // 0xC3 tek başına yarım bir UTF-8 dizisidir.
    const { frame } = expectSuccess(parseWebSocket(Uint8Array.from([FIN | OPCODE_TEXT, 2, 0xc3, 0x28])));

    expect(fieldById(frame, 'payload').valid).toBe(false);
    expect(warningCodes(frame)).toContain('protocol.websocket.warning.textNotValidUtf8');
  });

  it('RSV bitleri set ise uyarır', () => {
    const { frame } = expectSuccess(parseWebSocket(Uint8Array.from([FIN | 0x40 | OPCODE_TEXT, 2, 0x68, 0x69])));

    expect(fieldById(frame, 'rsv1').rawValue).toBe(1);
    expect(warningCodes(frame)).toContain('protocol.websocket.warning.rsvBitsSet');
  });

  it('ayrılmış opcode’u uyarır ama çözmeyi sürdürür', () => {
    const { frame } = expectSuccess(parseWebSocket(Uint8Array.from([FIN | 0x3, 2, 0x01, 0x02])));

    expect(fieldById(frame, 'opcode').valid).toBe(false);
    expect(warningCodes(frame)).toContain('protocol.websocket.warning.reservedOpcode');
  });

  it('yük eksikse truncated-frame basar', () => {
    const { frame } = expectSuccess(parseWebSocket(Uint8Array.from([FIN | OPCODE_TEXT, 10, 0x68, 0x69])));

    expect(frame.valid).toBe(false);
    expect(errorCodes(frame)).toContain('truncated-frame');
  });

  it('yük fazlaysa sonraki çerçeve sayıp uyarır', () => {
    const { frame } = expectSuccess(
      parseWebSocket(Uint8Array.from([FIN | OPCODE_TEXT, 2, 0x68, 0x69, FIN | OPCODE_PING, 0])),
    );

    expect(fieldById(frame, 'payload').rawValue).toBe('hi');
    expect(warningCodes(frame)).toContain('protocol.websocket.warning.payloadLongerThanFrame');
  });

  it('el sıkışma metnini çerçeve sanmaz, HTTP’ye yönlendirir', () => {
    const failure = expectFailure(
      parseWebSocket(new TextEncoder().encode('GET /ws HTTP/1.1\r\nUpgrade: websocket\r\n\r\n')),
    );

    expect(failure.error.code).toBe('start-delimiter-not-found');
    expect(failure.error.message).toBe('protocol.websocket.error.handshakeNotAFrame');
    expect(failure.recoverable).toBe(false);
  });

  it('maxFrameLength ve iptal edilmiş signal ayrı ayrı durdurur', () => {
    const bytes = Uint8Array.from([FIN | OPCODE_TEXT, 5, ...utf8('hello')]);
    expect(expectFailure(webSocketParser.parse(bytes, { maxFrameLength: 3 })).error.code).toBe('frame-too-long');

    const controller = new AbortController();
    controller.abort();
    expect(expectFailure(webSocketParser.parse(bytes, { signal: controller.signal })).error.code).toBe(
      'parser-timeout',
    );
  });

  it('canParse el sıkışmasını eler, opcode’a bakmaz', () => {
    expect(webSocketParser.canParse(Uint8Array.from([FIN | OPCODE_TEXT, 0]))).toBe(true);
    // Ayrılmış opcode ön elemede reddedilmez.
    expect(webSocketParser.canParse(Uint8Array.from([FIN | 0xb, 0]))).toBe(true);
    expect(webSocketParser.canParse(new TextEncoder().encode('GET /ws HTTP/1.1'))).toBe(false);
    expect(webSocketParser.canParse(Uint8Array.from([0x81]))).toBe(false);
  });
});

describe('webSocketPlugin', () => {
  it('örnekleri beyan ettikleri geçerlilikle çözülür', () => {
    for (const example of webSocketPlugin.exampleFrames) {
      const result = parseWebSocket(example.bytes);
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
    expect(webSocketPlugin.id).toBe('websocket');
    expect(webSocketPlugin.category).toBe('network-ethernet');
    expect(webSocketPlugin.parser).toBe(webSocketParser);
  });
});
