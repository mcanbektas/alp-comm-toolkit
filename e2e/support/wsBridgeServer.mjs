/**
 * Playwright turu için asgari WebSocket köprüsü — gelen ikili çerçeveyi AYNEN
 * geri yollar (echo).
 *
 * ## Neden elle yazılmış bir sunucu
 *
 * Depoda `ws` paketi YOK ve tek bir tarayıcı turu için üretim bağımlılığı
 * eklemek pahalı. RFC 6455'in gereken dar kısmı `webSocketFraming.mjs`te
 * (el sıkışma + tek parçalı çerçeve); `mqttBrokerServer.mjs` de aynı modülü
 * kullanıyor, ikinci bir kopya YOK.
 *
 * İki kip:
 * - **Yankı** (varsayılan): gelen çerçeve aynen geri gider. Gönderim yolunu ölçer.
 * - **İtme**: `ws://host:port/?push=<hex>&interval=<ms>` ile bağlanıldığında o
 *   baytlar aralıklarla İTİLİR. Monitör gibi yalnız DİNLEYEN ekranlar aksi
 *   hâlde sınanamazdı: hattı besleyen bir karşı taraf gerekiyor.
 *
 * Kullanımı: `node e2e/support/wsBridgeServer.mjs [port]`
 */

import { createServer } from 'node:http';

import {
  OPCODE_BINARY,
  OPCODE_CLOSE,
  OPCODE_PING,
  OPCODE_PONG,
  OPCODE_TEXT,
  decodeFrame,
  encodeFrame,
  writeHandshake,
} from './webSocketFraming.mjs';

const port = Number(process.argv[2] ?? 9099);

const server = createServer((_request, response) => {
  // Playwright'ın `webServer` sağlık yoklaması düz HTTP yapar; 200 dönmezse
  // sunucu "hazır" sayılmaz ve tur hiç başlamaz.
  response.writeHead(200, { 'content-type': 'text/plain' });
  response.end('ws bridge up');
});

/** `?push=AA0510…&interval=100` — hex baytları ve itme aralığını okur. */
function pushOptions(url) {
  const query = new URL(url, 'http://localhost').searchParams;
  const hex = query.get('push');
  if (hex === null || hex.length === 0 || hex.length % 2 !== 0) return null;

  const bytes = Buffer.from(hex, 'hex');
  if (bytes.length === 0) return null;
  const interval = Number(query.get('interval') ?? '100');
  return { bytes, interval: Number.isFinite(interval) && interval > 0 ? interval : 100 };
}

server.on('upgrade', (request, socket) => {
  const key = request.headers['sec-websocket-key'];
  if (typeof key !== 'string') {
    socket.destroy();
    return;
  }

  writeHandshake(socket, key);

  const push = pushOptions(request.url ?? '/');
  const timer =
    push === null
      ? null
      : setInterval(() => {
          socket.write(encodeFrame(OPCODE_BINARY, push.bytes));
        }, push.interval);

  const stopPush = () => {
    if (timer !== null) clearInterval(timer);
  };
  socket.on('close', stopPush);

  let pending = Buffer.alloc(0);
  socket.on('data', (chunk) => {
    pending = Buffer.concat([pending, chunk]);

    for (;;) {
      const frame = decodeFrame(pending);
      if (frame === null) break;
      pending = Buffer.from(frame.rest);

      if (frame.opcode === OPCODE_CLOSE) {
        stopPush();
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
    stopPush();
    socket.destroy();
  });
});

server.listen(port, () => {
  process.stdout.write(`ws bridge listening on ${String(port)}\n`);
});
