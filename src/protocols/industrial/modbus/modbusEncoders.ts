/**
 * Modbus'un ÜÇ taşıyıcısının encoder'ı — RTU · ASCII · TCP (spec §3.3, §7).
 *
 * ## Neden üçü tek dosyada ve neden AYNI girdi
 *
 * Modbus'ta değişen şey PDU değil ZARFTIR: aynı `01 03 00 00 00 02` gövdesi
 * RTU'da CRC'li, ASCII'de hex + LRC'li, TCP'de MBAP başlıklı gider. Üç
 * encoder'ın da girdisi bu yüzden AYNI: **adres/unit baytı + PDU**. Ayrı ayrı
 * girdi tipleri seçilseydi taşıyıcılar arası dönüşüm (spec §33'ün ilk sorusu)
 * her çift için ayrı bir uyarlama katmanı isterdi; ortak girdiyle bir
 * taşıyıcıdan çözülen gövde doğrudan öbürüne verilebiliyor.
 *
 * Girdi ADU'nun KENDİSİ DEĞİL, gövdesidir: çerçeve sınırlayıcıları (CRC, LRC,
 * `:`/CRLF, MBAP) burada HESAPLANIR. Kullanıcıdan gelen bir çerçeveyi olduğu
 * gibi sarmak, checksum'u iki kez yazmak olurdu.
 *
 * ## Neden `payload` ailesi
 *
 * `encoderCatalog.ts`in iki ailesinden `payload`: girdi `Uint8Array`, çıktı
 * çerçevelenmiş bayt. Packet Builder'da bu üçü birer ZARF olarak listelenir ve
 * şemadan üretilen çerçevenin üstüne biner.
 *
 * ## Sabitlenen parametre: TCP transaction ID
 *
 * `ProtocolEncoder<TMessage>` tek parametre alır (kilitli sözleşme), oysa MBAP
 * bir transaction ID taşır ve yanıt eşleştirmesi ZAMANA GÖRE DEĞİL ona göre
 * yapılır. Burada 0 yazılıyor ve bu kısıt defterde ilan ediliyor
 * (`builder.encoder.fixed.modbusTcp`) — gizlenmiş bir varsayılan, ekranda
 * görünmeyen bir yalan olurdu.
 */

import { bytesToHex } from '@/protocol-core/buffers/representation';
import { computeChecksum } from '@/protocol-core/checksums/algorithmCatalogue';
import { lrcChecksum } from '@/protocol-core/checksums/lrc';

/** Adres + function code: bir Modbus gövdesinin altına inemeyeceği taban. */
const MIN_BODY_LENGTH = 2;

/**
 * RTU ADU tavanı 256 bayttır (spec §3.3) ve CRC'nin iki baytı ona DAHİLDİR;
 * gövde bu yüzden 254'te durur.
 */
const RTU_CRC_LENGTH = 2;
const RTU_MAX_BODY_LENGTH = 256 - RTU_CRC_LENGTH;

/**
 * MBAP: transaction(2) + protocol(2) + length(2) + unit(1) = 7. Unit ID
 * gövdenin İLK BAYTI olduğu için burada yazılan ön ek 6 bayttır.
 */
const MBAP_PREFIX_LENGTH = 6;
/** Modbus'un protocol ID'si sabittir. */
const MODBUS_PROTOCOL_ID = 0;
/** Tek parametreli sözleşmenin sabitlediği değer; bkz. dosya başı. */
const FIXED_TRANSACTION_ID = 0;
/** `Length` alanı 16 bit; gövde bundan uzun olamaz. */
const MAX_TCP_BODY_LENGTH = 0xffff;

const COLON = 0x3a;
const CARRIAGE_RETURN = 0x0d;
const LINE_FEED = 0x0a;

const BYTE_MASK = 0xff;
const BITS_PER_BYTE = 8;

/**
 * Ortak ön koşul. Fırlatmak bilinçli: bu fonksiyonlar `ProtocolEncoder`
 * sözleşmesini gerçekler ve o sözleşme "üretemedim" diyecek bir dönüş değeri
 * TAŞIMAZ. Tüketici (Packet Builder / Test Automation) istisnayı yakalayıp
 * sorun listesine indiriyor; sessizce kısa bir çerçeve döndürmek kabloya
 * bozuk bayt çıkarırdı.
 */
function assertBody(body: Uint8Array, maximum: number, label: string): void {
  if (body.length < MIN_BODY_LENGTH) {
    throw new RangeError(`${label}: gövde en az ${MIN_BODY_LENGTH} bayt olmalı (adres + function code)`);
  }
  if (body.length > maximum) {
    throw new RangeError(`${label}: gövde ${body.length} bayt, üst sınır ${maximum}`);
  }
}

/**
 * RTU çerçevesi: gövde + CRC-16/MODBUS.
 *
 * CRC telde LOW bayt önce gider — veri alanları big-endian olsa da checksum
 * alanı little-endian'dır (`modbusRtu.ts` çözerken de öyle okuyor). Ters
 * yazmak hata VERMEDEN her çerçeveyi karşı tarafta geçersiz kılardı.
 */
export function encodeModbusRtuFrame(body: Uint8Array): Uint8Array {
  assertBody(body, RTU_MAX_BODY_LENGTH, 'encodeModbusRtuFrame');

  // Sabit algoritma verildiği için `undefined` dalı ölü; tip guard'ı olmadan derlenmez.
  const crc = Number(computeChecksum(body, 'CRC16_MODBUS') ?? 0n);

  const frame = new Uint8Array(body.length + RTU_CRC_LENGTH);
  frame.set(body, 0);
  frame[body.length] = crc & BYTE_MASK;
  frame[body.length + 1] = (crc >> BITS_PER_BYTE) & BYTE_MASK;
  return frame;
}

/**
 * ASCII çerçevesi: `:` + gövde ve LRC'nin BÜYÜK HARF hex'i + CR LF.
 *
 * LRC kapsamı LRC baytının kendisi hariç her şeydir; çözücü de öyle sayıyor.
 * Hex büyük harf: spec'in kendi tel örnekleri (`:010300000002FA`) öyle yazılı
 * ve çözücü küçük harfi de kabul etse bile ürettiğimiz çerçevenin spec'in
 * dizgesiyle BİREBİR aynı olması testte doğrudan karşılaştırılabilir kılıyor.
 */
export function encodeModbusAsciiFrame(body: Uint8Array): Uint8Array {
  // ASCII'de sınırlayıcı CRC değil tek baytlık LRC; tavan aynı 256 baytlık ADU.
  assertBody(body, RTU_MAX_BODY_LENGTH + 1, 'encodeModbusAsciiFrame');

  const withLrc = new Uint8Array(body.length + 1);
  withLrc.set(body, 0);
  withLrc[body.length] = lrcChecksum(body);

  const hex = bytesToHex(withLrc);
  const frame = new Uint8Array(1 + hex.length + 2);
  frame[0] = COLON;
  for (let index = 0; index < hex.length; index += 1) {
    frame[1 + index] = hex.charCodeAt(index);
  }
  frame[frame.length - 2] = CARRIAGE_RETURN;
  frame[frame.length - 1] = LINE_FEED;
  return frame;
}

/**
 * TCP çerçevesi: MBAP + PDU. **CRC YOKTUR** — bütünlük TCP/IP yığınına
 * bırakılır (`modbusTcp.ts` dosya başı).
 *
 * `Length` alanı KENDİSİNDEN SONRAKİ baytları sayar, yani Unit ID dahil
 * gövdenin tamamını. Gövdenin ilk baytı burada Unit ID'dir: RTU'daki adres
 * baytının TCP'deki karşılığı odur, ortak girdiyi mümkün kılan da bu.
 */
export function encodeModbusTcpFrame(body: Uint8Array): Uint8Array {
  assertBody(body, MAX_TCP_BODY_LENGTH, 'encodeModbusTcpFrame');

  const frame = new Uint8Array(MBAP_PREFIX_LENGTH + body.length);
  frame[0] = (FIXED_TRANSACTION_ID >> BITS_PER_BYTE) & BYTE_MASK;
  frame[1] = FIXED_TRANSACTION_ID & BYTE_MASK;
  frame[2] = (MODBUS_PROTOCOL_ID >> BITS_PER_BYTE) & BYTE_MASK;
  frame[3] = MODBUS_PROTOCOL_ID & BYTE_MASK;
  frame[4] = (body.length >> BITS_PER_BYTE) & BYTE_MASK;
  frame[5] = body.length & BYTE_MASK;
  frame.set(body, MBAP_PREFIX_LENGTH);
  return frame;
}
