/**
 * MQTT PUBLISH paketinin encoder'ı (spec §33'ün iki dönüşümünün HEDEF tarafı:
 * "Modbus register → MQTT topic" ve "BACnet property → MQTT").
 *
 * ## Girdi neden paketin tamamı değil, GÖVDESİ
 *
 * Modbus encoder'larıyla AYNI disiplin: kullanıcı/dönüştürücü GÖVDEYİ verir,
 * encoder ZARFI hesaplar. Buradaki gövde PUBLISH'in variable header'ı +
 * payload'ıdır — yani `topic length (2 bayt) + topic + payload`. Encoder'ın
 * eklediği tek şey Fixed Header'dır: paket tipi baytı ve **Remaining Length**.
 *
 * Remaining Length'i çağırana bırakmak, gövdeyle tutarsız bir uzunluk yazma
 * imkânı vermek olurdu; MQTT'de o alan yanlışsa akış bir sonraki pakette değil
 * ORTASINDA kayar (`mqtt.ts`in `truncated-frame` yolu). Hesaplanabilen bir
 * alanı kullanıcıya sormak sessiz bir hata kaynağıdır.
 *
 * Topic'i sabitleyip yalnız payload'ı almak da düşünülmedi: §33'ün dönüşümü
 * TAM OLARAK topic'i seçmekle ilgili — sabitlenen topic dönüşümü anlamsız
 * kılardı.
 *
 * ## Sabitlenen parametreler
 *
 * Tek parametreli `ProtocolEncoder` sözleşmesi (CLAUDE.md, kilitli karar)
 * bayrakları taşıyacak ikinci bir parametre bırakmıyor. Sabitlenenler:
 * **PUBLISH · DUP=0 · QoS=0 · RETAIN=0**. QoS 0 aynı zamanda gövdeyi de
 * belirler: Packet Identifier YALNIZ QoS ≥ 1'de vardır, bu yüzden gövde
 * topic'ten hemen sonra payload ile devam eder. Kısıt defterde ilan ediliyor
 * (`builder.encoder.fixed.mqtt`) ve ekranda uyarı olarak görünüyor.
 */

import { MQTT_VBI_MAX_VALUE, encodeVariableByteInteger } from './mqttVbi';

/**
 * PUBLISH · DUP=0 · QoS=0 · RETAIN=0. Üst nibble paket tipi (3), alt nibble
 * bayraklar. QoS 1 `0x32`, RETAIN `0x31` olurdu — ikisi de sözleşme açılmadan
 * verilemiyor.
 */
const PUBLISH_QOS0_HEADER = 0x30;

/** Topic Name'in uzunluğunu taşıyan iki baytlık ön ek (UTF-8 string prefix). */
const TOPIC_LENGTH_FIELD_SIZE = 2;

const BITS_PER_BYTE = 8;
const BYTE_MASK = 0xff;

/**
 * PUBLISH gövdesini Fixed Header ile paketler.
 *
 * Fırlatmak bilinçli: `ProtocolEncoder` sözleşmesinin "üretemedim" diyecek bir
 * dönüş değeri yok ve tüketici (Packet Builder / Test Automation) istisnayı
 * yakalayıp sorun listesine indiriyor. Kısa bir paket döndürmek, karşı tarafın
 * akışını kaydıracak baytı kabloya çıkarmak olurdu.
 */
export function encodeMqttPublishPacket(body: Uint8Array): Uint8Array {
  if (body.length < TOPIC_LENGTH_FIELD_SIZE) {
    throw new RangeError(
      `encodeMqttPublishPacket: gövde en az ${TOPIC_LENGTH_FIELD_SIZE} bayt olmalı (topic uzunluğu alanı)`,
    );
  }

  // `?? 0` dalı ölü — uzunluk yukarıda doğrulandı; `noUncheckedIndexedAccess` istiyor.
  const topicLength = ((body[0] ?? 0) << BITS_PER_BYTE) | (body[1] ?? 0);
  if (topicLength === 0) {
    // OASIS: PUBLISH'in Topic Name'i BOŞ OLAMAZ. Boş topic'li paket sözdizimsel
    // olarak çözülür ama broker onu reddeder — üretmemek daha dürüst.
    throw new RangeError('encodeMqttPublishPacket: PUBLISH topic adı boş olamaz');
  }
  if (TOPIC_LENGTH_FIELD_SIZE + topicLength > body.length) {
    throw new RangeError(
      `encodeMqttPublishPacket: topic uzunluğu ${topicLength}, gövdede yalnız ${body.length - TOPIC_LENGTH_FIELD_SIZE} bayt var`,
    );
  }
  if (body.length > MQTT_VBI_MAX_VALUE) {
    throw new RangeError(
      `encodeMqttPublishPacket: gövde ${body.length} bayt, Remaining Length üst sınırı ${MQTT_VBI_MAX_VALUE}`,
    );
  }

  const remainingLength = encodeVariableByteInteger(body.length);
  const packet = new Uint8Array(1 + remainingLength.length + body.length);
  packet[0] = PUBLISH_QOS0_HEADER & BYTE_MASK;
  packet.set(remainingLength, 1);
  packet.set(body, 1 + remainingLength.length);
  return packet;
}
