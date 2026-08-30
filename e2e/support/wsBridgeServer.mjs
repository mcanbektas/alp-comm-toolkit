/**
 * Playwright turu için asgari WebSocket köprüsü — gelen ikili çerçeveyi AYNEN
 * geri yollar (echo).
 *
 * ## Neden elle yazılmış bir sunucu
 *
 * Depoda `ws` paketi YOK ve tek bir tarayıcı turu için üretim bağımlılığı
 * eklemek pahalı. RFC 6455'in burada gereken kısmı dar: el sıkışma (SHA-1 +
 * base64) ve tek parçalı çerçevelerin çözümü/üretimi. Parçalı (fragmented)
 * çerçeve, uzantı ve 64 bit uzunluk BİLEREK yok — test verisi 125 baytın
 * altında ve köprü yalnız bu turda kullanılıyor.
 *
 * Kullanımı: `node e2e/support/wsBridgeServer.mjs [port]`
 */

import { createHash } from 'node:crypto';
import { createServer } from 'node:http';

/** RFC 6455'in sabit GUID'i; el sıkışma anahtarına eklenir. */
const WEBSOCKET_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

const OPCODE_TEXT = 0x1;
const OPCODE_BINARY = 0x2;
const OPCODE_CLOSE = 0x8;
const OPCODE_PING = 0x9;
const OPCODE_PONG = 0xa;

const FIN_BIT = 0x80;
const MASK_BIT = 0x80;
const OPCODE_MASK = 0x0f;
const LENGTH_MASK = 0x7f;
/** 126 ve 127 uzunluk alanı GENİŞLETİLMİŞ demektir; burada yalnız 126 (16 bit) destekli. */
const EXTENDED_16 = 126;
const MASK_LENGTH = 4;

const port = Number(process.argv[2] ?? 9099);

function acceptKey(key) {
  return createHash('sha1')
    .update(key + WEBSOCKET_GUID)
    .digest('base64');
}

/** Sunucu çerçeveleri MASKELENMEZ (RFC 6455 §5.1: yalnız istemci maskeler). */
function encodeFrame(opcode, payload) {
  const header =
    payload.length < EXTENDED_16
      ? Buffer.from([FIN_BIT | opcode, payload.length])
      : Buffer.from([FIN_BIT | opcode, EXTENDED_16, (payload.length >> 8) & 0xff, payload.length & 0xff]);
  return Buffer.concat([header, payload]);
}

/** Tamponun başındaki tek çerçeveyi çözer; eksikse `null` döner. */
function decodeFrame(buffer) {
  if (buffer.length < 2) return null;

  const opcode = buffer[0] & OPCODE_MASK;
  const masked = (buffer[1] & MASK_BIT) !== 0;
  let length = buffer[1] & LENGTH_MASK;
  let offset = 2;

  if (length === EXTENDED_16) {
    if (buffer.length < offset + 2) return null;
    length = buffer.readUInt16BE(offset);
    offset += 2;
  }

  let mask;
  if (masked) {
    if (buffer.length < offset + MASK_LENGTH) return null;
    mask = buffer.subarray(offset, offset + MASK_LENGTH);
    offset += MASK_LENGTH;
  }

  if (buffer.length < offset + length) return null;

  const payload = Buffer.from(buffer.subarray(offset, offset + length));
  if (mask !== undefined) {
    for (let index = 0; index < payload.length; index += 1) {
      payload[index] ^= mask[index % MASK_LENGTH];
    }
  }

  return { opcode, payload, rest: buffer.subarray(offset + length) };
}

const server = createServer((_request, response) => {
  // Playwright'ın `webServer` sağlık yoklaması düz HTTP yapar; 200 dönmezse
  // sunucu "hazır" sayılmaz ve tur hiç başlamaz.
  response.writeHead(200, { 'content-type': 'text/plain' });
  response.end('ws bridge up');
});

server.on('upgrade', (request, socket) => {
  const key = request.headers['sec-websocket-key'];
  if (typeof key !== 'string') {
    socket.destroy();
    return;
  }

  socket.write(
    [
      'HTTP/1.1 101 Switching Protocols',
      'Upgrade: websocket',
      'Connection: Upgrade',
      `Sec-WebSocket-Accept: ${acceptKey(key)}`,
      '\r\n',
    ].join('\r\n'),
  );

  let pending = Buffer.alloc(0);
  socket.on('data', (chunk) => {
    pending = Buffer.concat([pending, chunk]);

    for (;;) {
      const frame = decodeFrame(pending);
      if (frame === null) break;
      pending = Buffer.from(frame.rest);

      if (frame.opcode === OPCODE_CLOSE) {
        socket.end(encodeFrame(OPCODE_CLOSE, Buffer.alloc(0)));
        return;
      }
      if (frame.opcode === OPCODE_PING) {
        socket.write(encodeFrame(OPCODE_PONG, frame.payload));
        continue;
      }
      if (frame.opcode === OPCODE_BINARY || frame.opcode === OPCODE_TEXT) {
        // Yankı: gönderilen paket aynı baytlarla geri döner, böylece tur
        // yalnız bağlantıyı değil VERİ YOLUNU da ölçer.
        socket.write(encodeFrame(OPCODE_BINARY, frame.payload));
      }
    }
  });

  socket.on('error', () => {
    socket.destroy();
  });
});

server.listen(port, () => {
  process.stdout.write(`ws bridge listening on ${String(port)}\n`);
});
