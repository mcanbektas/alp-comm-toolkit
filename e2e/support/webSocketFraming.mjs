/**
 * RFC 6455'in tarayıcı turu için gereken DAR kısmı: el sıkışma anahtarı ve tek
 * parçalı çerçevelerin çözümü/üretimi.
 *
 * ## Neden ayrı bir dosya
 *
 * `wsBridgeServer.mjs` bu kodu tek başına taşıyordu. `mqttBrokerServer.mjs`
 * eklenince aynı yüz satırın ikinci kopyası çıkacaktı; iki kopya ayrışmanın
 * davetiyesidir (`canFrame.ts`in maskelerini encoder'a AÇMA gerekçesiyle aynı).
 * Kod değişmedi, yalnız yerini değiştirdi.
 *
 * ## Neden hâlâ elle yazılmış
 *
 * Depoda `ws` paketi YOK ve tarayıcı turu için üretim bağımlılığı eklemek
 * pahalı. Parçalı (fragmented) çerçeve, uzantı ve 64 bit uzunluk BİLEREK yok:
 * test verisi 125 baytın altında ve bu modül yalnız `e2e/support/`te kullanılıyor.
 */

import { createHash } from 'node:crypto';

/** RFC 6455'in sabit GUID'i; el sıkışma anahtarına eklenir. */
const WEBSOCKET_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

export const OPCODE_TEXT = 0x1;
export const OPCODE_BINARY = 0x2;
export const OPCODE_CLOSE = 0x8;
export const OPCODE_PING = 0x9;
export const OPCODE_PONG = 0xa;

const FIN_BIT = 0x80;
const MASK_BIT = 0x80;
const OPCODE_MASK = 0x0f;
const LENGTH_MASK = 0x7f;
/** 126 ve 127 uzunluk alanı GENİŞLETİLMİŞ demektir; burada yalnız 126 (16 bit) destekli. */
const EXTENDED_16 = 126;
const MASK_LENGTH = 4;

export function acceptKey(key) {
  return createHash('sha1')
    .update(key + WEBSOCKET_GUID)
    .digest('base64');
}

/** Sunucu çerçeveleri MASKELENMEZ (RFC 6455 §5.1: yalnız istemci maskeler). */
export function encodeFrame(opcode, payload) {
  const header =
    payload.length < EXTENDED_16
      ? Buffer.from([FIN_BIT | opcode, payload.length])
      : Buffer.from([FIN_BIT | opcode, EXTENDED_16, (payload.length >> 8) & 0xff, payload.length & 0xff]);
  return Buffer.concat([header, payload]);
}

/** Tamponun başındaki tek çerçeveyi çözer; eksikse `null` döner. */
export function decodeFrame(buffer) {
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

/**
 * 101 yanıtını yazar. `subprotocol` verilirse `Sec-WebSocket-Protocol` da
 * döner — MQTT over WebSocket bunu ZORUNLU kılar (OASIS §6).
 */
export function writeHandshake(socket, key, subprotocol) {
  const lines = [
    'HTTP/1.1 101 Switching Protocols',
    'Upgrade: websocket',
    'Connection: Upgrade',
    `Sec-WebSocket-Accept: ${acceptKey(key)}`,
  ];
  if (subprotocol !== undefined) lines.push(`Sec-WebSocket-Protocol: ${subprotocol}`);
  lines.push('\r\n');
  socket.write(lines.join('\r\n'));
}
