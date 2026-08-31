/**
 * Playwright turu için asgari MQTT over WebSocket broker'ı.
 *
 * ## Neden elle yazılmış bir broker
 *
 * `wsBridgeServer.mjs`in gerekçesinin aynısı: depoda `ws` de `mosquitto` da
 * YOK ve tek bir tur için üretim bağımlılığı eklemek pahalı (o karar bir kez
 * verildi, burada da geçerli). RFC 6455'in gereken kısmı zaten
 * `webSocketFraming.mjs`te; buraya eklenen tek şey MQTT 3.1.1'in ÜÇ paketi:
 * CONNECT okunur, CONNACK yazılır, PUBLISH kaydedilir.
 *
 * ## Neden yankı köprüsü YETMEDİ
 *
 * `wsBridgeServer` gönderileni geri yollar; ekran "son yanıt" görür ama bu,
 * *"karşı taraf paketi ANLADI"* demek değildir. MQTT'de kanıt farklı bir
 * yerde: broker CONNECT'i ayrıştırıp CONNACK üretmek ZORUNDA, yoksa istemci
 * hiç PUBLISH göndermez. Yani yalnız bu köprüyle "düğme var" değil "baytlar
 * broker'a ULAŞTI ve okunabildi" ölçülebiliyor.
 *
 * Aldığı PUBLISH'leri `GET /published` altında JSON olarak açıyor: tur, ekranın
 * ne dediğine DEĞİL sunucunun ne aldığına bakabiliyor. İstemci kimliğine göre
 * süzülür (`?clientId=…`) — Playwright `fullyParallel` koşuyor ve paylaşılan
 * durum aksi hâlde testler arasında karışırdı.
 *
 * ## Bilerek yapılmayanlar
 *
 * Abonelik (SUBSCRIBE/SUBACK), QoS 1/2 ack zinciri, retained mesaj, will,
 * keep-alive zaman aşımı YOK. İstemci tarafı da bunların hiçbirini üretmiyor
 * (`mqttSession.ts`: QoS 0, temiz oturum, keep alive 0); üretmeyen bir
 * istemciye cevap veren bir sunucu yazmak, ölçülmeyen kod olurdu.
 *
 * Kullanımı: `node e2e/support/mqttBrokerServer.mjs [port]`
 */

import { createServer } from 'node:http';

import {
  OPCODE_BINARY,
  OPCODE_CLOSE,
  OPCODE_PING,
  OPCODE_PONG,
  decodeFrame,
  encodeFrame,
  writeHandshake,
} from './webSocketFraming.mjs';

/** OASIS §6.0 istemciden bunu ZORUNLU ister; sunmayan istemci reddedilir. */
const MQTT_SUBPROTOCOL = 'mqtt';

const PACKET_TYPE_CONNECT = 1;
const PACKET_TYPE_PUBLISH = 3;
const PACKET_TYPE_DISCONNECT = 14;

const CONNACK_HEADER = 0x20;

const port = Number(process.argv[2] ?? 9098);

/** Alınan PUBLISH'ler; `GET /published` bunları döner. */
const published = [];

/**
 * Fixed Header'ın Remaining Length'i (Variable Byte Integer). Eksikse `null`.
 * İstemcinin kendi çözücüsünün KOPYASI DEĞİL, bağımsız bir gerçekleme: aynı
 * kodu iki yerde kullansaydık test, encoder'ın kendisiyle uyumunu ölçerdi.
 */
function readRemainingLength(buffer, offset) {
  let value = 0;
  let multiplier = 1;
  for (let index = 0; index < 4; index += 1) {
    const byte = buffer[offset + index];
    if (byte === undefined) return null;
    value += (byte & 0x7f) * multiplier;
    if ((byte & 0x80) === 0) return { value, length: index + 1 };
    multiplier *= 128;
  }
  return null;
}

/** Tamponun başındaki tek MQTT kontrol paketini söker; eksikse `null`. */
function takePacket(buffer) {
  if (buffer.length < 2) return null;
  const length = readRemainingLength(buffer, 1);
  if (length === null) return null;

  const total = 1 + length.length + length.value;
  if (buffer.length < total) return null;

  return {
    packetType: (buffer[0] >> 4) & 0x0f,
    body: buffer.subarray(1 + length.length, total),
    bytes: Buffer.from(buffer.subarray(0, total)),
    rest: buffer.subarray(total),
  };
}

/** İki baytlık uzunluk ön ekli UTF-8 alan (MQTT §1.5.3). */
function readString(body, offset) {
  if (offset + 2 > body.length) return null;
  const length = body.readUInt16BE(offset);
  const end = offset + 2 + length;
  if (end > body.length) return null;
  return { value: body.subarray(offset + 2, end).toString('utf8'), end };
}

/**
 * CONNECT'in gövdesinden istemci kimliğini çıkarır. Protocol Name (2+4) +
 * Level (1) + Flags (1) + Keep Alive (2) = 10 bayt sabit ön ek.
 */
function readConnect(body) {
  const name = readString(body, 0);
  if (name === null) return null;
  const level = body[name.end];
  const flags = body[name.end + 1];
  const clientId = readString(body, name.end + 4);
  if (clientId === null) return null;
  return { protocolName: name.value, protocolLevel: level, connectFlags: flags, clientId: clientId.value };
}

/** PUBLISH gövdesi QoS 0'da: topic uzunluğu + topic + payload (Packet Identifier YOK). */
function readPublish(body) {
  const topic = readString(body, 0);
  if (topic === null) return null;
  return { topic: topic.value, payload: body.subarray(topic.end) };
}

const server = createServer((request, response) => {
  const url = new URL(request.url ?? '/', 'http://localhost');

  if (url.pathname === '/published') {
    const wanted = url.searchParams.get('clientId');
    const rows = wanted === null ? published : published.filter((row) => row.clientId === wanted);
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify(rows));
    return;
  }

  // Playwright'ın `webServer` sağlık yoklaması düz HTTP yapar; 200 dönmezse
  // sunucu "hazır" sayılmaz ve tur hiç başlamaz.
  response.writeHead(200, { 'content-type': 'text/plain' });
  response.end('mqtt broker stub up');
});

/** `?reject=5` — broker CONNECT'i bu dönüş koduyla REDDEDER (OASIS §3.2.2.3). */
function rejectCode(url) {
  const value = Number(new URL(url, 'http://localhost').searchParams.get('reject') ?? '');
  return Number.isInteger(value) && value > 0 && value < 256 ? value : 0;
}

server.on('upgrade', (request, socket) => {
  const key = request.headers['sec-websocket-key'];
  if (typeof key !== 'string') {
    socket.destroy();
    return;
  }

  // OASIS §6.0: alt protokolü sunmayan istemci gerçek broker'larda da
  // reddedilir. Burada da reddediliyor ki tur bu kuralı ÖLÇSÜN.
  const offered = String(request.headers['sec-websocket-protocol'] ?? '')
    .split(',')
    .map((entry) => entry.trim());
  if (!offered.includes(MQTT_SUBPROTOCOL)) {
    socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
    return;
  }

  writeHandshake(socket, key, MQTT_SUBPROTOCOL);

  const reject = rejectCode(request.url ?? '/');
  let clientId = null;
  let pending = Buffer.alloc(0);
  /**
   * MQTT tamponu WebSocket tamponundan AYRIDIR ve çerçeveler arasında YAŞAR:
   * OASIS §6 bir MQTT paketinin çerçeve sınırına hizalı olmadığını söylüyor,
   * yani yarım kalan paket bir sonraki çerçeveyle tamamlanabilmeli.
   */
  let mqttPending = Buffer.alloc(0);

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
      if (frame.opcode !== OPCODE_BINARY) {
        // OASIS §6: MQTT paketleri İKİLİ çerçevede taşınır; metin çerçevesi
        // gören taraf bağlantıyı kapatmak ZORUNDA.
        socket.destroy();
        return;
      }

      // Bir WebSocket çerçevesi birden çok (ya da yarım) MQTT paketi taşıyabilir.
      mqttPending = Buffer.concat([mqttPending, frame.payload]);
      for (;;) {
        const packet = takePacket(mqttPending);
        if (packet === null) break;
        mqttPending = Buffer.from(packet.rest);

        if (packet.packetType === PACKET_TYPE_CONNECT) {
          const connect = readConnect(packet.body);
          if (connect === null || connect.protocolName !== 'MQTT' || connect.protocolLevel !== 4) {
            // Return code 1 = "unacceptable protocol version".
            socket.write(encodeFrame(OPCODE_BINARY, Buffer.from([CONNACK_HEADER, 0x02, 0x00, 0x01])));
            socket.end();
            return;
          }
          clientId = connect.clientId;
          socket.write(encodeFrame(OPCODE_BINARY, Buffer.from([CONNACK_HEADER, 0x02, 0x00, reject])));
          if (reject !== 0) {
            socket.end();
            return;
          }
          continue;
        }

        if (packet.packetType === PACKET_TYPE_PUBLISH) {
          const publish = readPublish(packet.body);
          if (publish !== null) {
            published.push({
              clientId,
              topic: publish.topic,
              payload: publish.payload.toString('utf8'),
              packetHex: packet.bytes.toString('hex').toUpperCase(),
            });
          }
          continue;
        }

        if (packet.packetType === PACKET_TYPE_DISCONNECT) {
          socket.end(encodeFrame(OPCODE_CLOSE, Buffer.alloc(0)));
          return;
        }
      }
    }
  });

  socket.on('error', () => {
    socket.destroy();
  });
});

server.listen(port, () => {
  process.stdout.write(`mqtt broker stub listening on ${String(port)}\n`);
});
