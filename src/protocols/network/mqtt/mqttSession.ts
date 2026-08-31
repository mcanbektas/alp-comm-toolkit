/**
 * MQTT OTURUM paketleri: CONNECT üretimi, CONNACK okuması, DISCONNECT sabiti ve
 * bir bayt akışından kontrol paketi toplayan birleştirici.
 *
 * Bu modül saf ve ağ bilmez — soketi kim açarsa açsın (bugün
 * `connection/websocket`) baytları buradan alır. Tarayıcıda MQTT'nin TEK
 * taşınabilir yolu WebSocket'tir: ham TCP soketi için bir tarayıcı API'si YOK,
 * UDP için de yok (bu yüzden `mqtt-sn` taşıması hiç denenmedi).
 *
 * ── NEDEN `mqttEncoders.ts`E EKLENMEDİ ──────────────────────────────────────
 * `mqttEncoders.ts`in ilan ettiği disiplin şudur: *çağıran GÖVDEYİ verir,
 * encoder ZARFI hesaplar* — ve oradaki tek fonksiyon `encoderCatalog.ts`e
 * `payload` rolüyle kayıtlı, yani Packet Builder'ın bir HEDEFİ. CONNECT bu
 * ikisinin de dışında: gövdesi kullanıcının yükü DEĞİL, oturumun kendi
 * alanlarıdır (istemci kimliği, keep alive, temiz oturum bayrağı). Aynı dosyaya
 * koymak hem o dosyanın yazılı disiplinini bozardı hem de Builder'da
 * kullanıcının anlamlı biçimde "kuramayacağı" bir paketi hedef olarak
 * listelerdi.
 *
 * ── NEDEN CONNACK'İ `mqtt.ts` PARSER'I OKUMUYOR ─────────────────────────────
 * `mqtt.ts`in kendi "KAPSAM DIŞI" listesi açıkça yazıyor: *"CONNACK Reason Code
 * / dönüş kodu tablosu ... bu turda YAZILMADI"*. Parser paket TİPİNİ adlandırır,
 * CONNACK'in variable header'ını ham `Body` bırakır. Oturumun ihtiyacı bir
 * GÖSTERİM alanı değil bir KARAR: broker kabul etti mi, etmediyse hangi kodla
 * reddetti. `ParseResult` bunu ifade edemez (bir çerçeve başarıyla çözülmüş
 * ama bağlantı reddedilmiş olabilir) ve her CONNACK için bir `ParsedFrame`
 * ayırmak, ekrana hiç basılmayacak bir gösterim nesnesi üretmek olurdu.
 *
 * ── SÜRÜM: 3.1.1 (Protocol Level 4), v5 DEĞİL ───────────────────────────────
 * Seçim serbest değil, `encodeMqttPublishPacket` belirliyor: o encoder 3.1.1
 * biçiminde bir PUBLISH yazıyor (Property Length baytı YOK). v5 CONNECT
 * göndermek, broker'ı aynı bağlantıda v5 biçimli PUBLISH beklemeye zorlar ve
 * ilk PUBLISH'te akış ORTASINDAN kayardı — MQTT'de uzunluk alanı yanlışsa hata
 * bir sonraki pakette değil o paketin ortasında çıkar (`mqttEncoders.ts` dosya
 * başı). Tek sürüm, ve o sürüm var olan encoder'ın konuştuğu sürüm.
 *
 * ── SABİTLENEN OTURUM PARAMETRELERİ ─────────────────────────────────────────
 * • **Kullanıcı adı/parola bayrakları 0 — YALNIZ ANONİM broker.** Bu depoda bir
 *   kimlik bilgisi deposu YOK ve CLAUDE.md *"Sırlar depoya girmez"* diyor. Bir
 *   parolayı `localStorage`a ya da §40 proje dosyasına yazmak yeni bir güvenlik
 *   yüzeyi açardı; o karar kullanıcınındır, sessizce alınamaz. Kısıt ekranda
 *   yazılı olarak GÖRÜNÜR — "neden bağlanamadım" sorusunu broker'ın return
 *   code 4/5'ine bırakmak, kısıtı hata gibi göstermek olurdu.
 *   (`wss://` ayrı bir konudur ve ÇALIŞIR: sunucu sertifikasını tarayıcı
 *   doğrular, bizim kodumuza bir sır girmez.)
 * • **Clean Session = 1.** Tek atımlık bir yayıncının broker'da oturum durumu
 *   bırakmaya hakkı yok; bırakırsa aynı istemci kimliğiyle açılan sonraki
 *   bağlantı devraldığı kuyruğu açıklayamaz.
 * • **Keep Alive = 0 (§3.1.2.10: mekanizma KAPALI).** Sıfırdan büyük bir değer
 *   istemciyi PINGREQ göndermeye MECBUR ederdi; bir bağlan-yayınla-kapat
 *   akışında PINGREQ gönderecek bir döngü yok ve söz verip tutmamak broker'ın
 *   bizi zaman aşımıyla düşürmesi demekti.
 *
 * ── WEBSOCKET ÇERÇEVESİ MQTT PAKETİ DEĞİLDİR ────────────────────────────────
 * OASIS MQTT 3.1.1 §6: *"A single WebSocket data frame can contain multiple or
 * partial MQTT Control Packets. The receiver MUST NOT assume that MQTT Control
 * Packets are aligned on WebSocket frame boundaries."* `onChunk`tan gelen bayt
 * bu yüzden doğrudan çözülemez, biriktirilir — `createMqttPacketAssembler`in
 * varlık sebebi budur. `protocol-core/streams/streamBuffer.ts` kullanılmadı:
 * o, `FramingMethod` sözleşmesine göre çalışır ve MQTT'nin çerçeve sınırı
 * "Fixed Header + VBI Remaining Length"tir, o listedeki yöntemlerden biri değil.
 *
 * **Bozuk akış LATCH'lenir, resenkronizasyon DENENMEZ.** MQTT'de sync sözcüğü
 * yoktur: Remaining Length bir kez yanlış okunduysa akıştaki bir sonraki baytın
 * paket başı olduğunu söyleyecek hiçbir kanıt kalmaz. Denemek, uydurma bir
 * hizalamayla CONNACK sanılan baytlar üretirdi.
 */

import { decodeVariableByteInteger, encodeVariableByteInteger } from './mqttVbi';

/**
 * `Sec-WebSocket-Protocol`. OASIS §6.0 ZORUNLU kılar: *"The Client MUST include
 * 'mqtt' in the list of WebSocket Sub Protocols it offers."* Gerçek broker'lar
 * (mosquitto, EMQX, HiveMQ) bunu göndermeyen istemciyi el sıkışmada reddeder.
 */
export const MQTT_WEBSOCKET_SUBPROTOCOL = 'mqtt';

/** Fixed Header'ın üst nibble'ı — `mqtt.ts`in `PACKET_TYPE_NAMES` tablosuyla aynı numaralandırma. */
export const MQTT_PACKET_TYPE_CONNACK = 2;

/** CONNECT · flags nibble 0 (§2.1.3'ün sabit tablosu, `mqtt.ts` de aynısını bekliyor). */
const CONNECT_HEADER = 0x10;

/** Protocol Name alanı: iki baytlık uzunluk (4) + `MQTT` ASCII'si. §3.1.2.1'de SABİTTİR. */
const PROTOCOL_NAME_BYTES = Uint8Array.from([0x00, 0x04, 0x4d, 0x51, 0x54, 0x54]);

/** §3.1.2.2 — MQTT 3.1.1'in Protocol Level'ı. v5 olsaydı 5 olurdu (dosya başı). */
const PROTOCOL_LEVEL_311 = 0x04;

/** §3.1.2.3 Connect Flags: yalnız Clean Session. Username/Password/Will bitleri 0. */
const CONNECT_FLAG_CLEAN_SESSION = 0x02;

/** DISCONNECT · Remaining Length 0 (§3.14). Nazik kapanış: broker Will mesajı yayınlamaz. */
export const MQTT_DISCONNECT_PACKET = Uint8Array.from([0xe0, 0x00]);

const BITS_PER_BYTE = 8;
const BYTE_MASK = 0xff;
const TWO_BYTE_LENGTH_FIELD_SIZE = 2;

/** UTF-8 string alanının iki baytlık uzunluk ön ekinin taşıyabileceği azami bayt (§1.5.3). */
const MQTT_STRING_MAX_BYTES = 0xffff;

/** Keep Alive iki baytlık işaretsiz saniyedir (§3.1.2.10). */
const KEEP_ALIVE_MAX_SECONDS = 0xffff;

/** CONNACK'in variable header'ı: Acknowledge Flags + Return Code (§3.2.2). */
const CONNACK_VARIABLE_HEADER_SIZE = 2;

/** §3.2.2.1 — Acknowledge Flags'in yalnız bit 0'ı tanımlı (Session Present). */
const CONNACK_SESSION_PRESENT_BIT = 0x01;

/** §3.2.2.3 — bağlantının kabul edildiğini söyleyen tek kod. */
const CONNACK_ACCEPTED = 0;

/**
 * Bu istemci yalnız CONNACK okur (SUBSCRIBE göndermediğimiz için broker bize
 * mesaj İTMEZ). Sekiz kilobayt cömert bir üst sınır; aşan bir akış bizim
 * yorumlayabileceğimiz bir şey değil ve sınırsız biriktirmek bozuk/kötü niyetli
 * bir karşı tarafa belleği doldurma imkânı verirdi.
 */
const DEFAULT_MAX_PACKET_LENGTH = 8192;

/**
 * OASIS MQTT 3.1.1 §3.2.2.3'ün Return Code tablosunun TAMAMI — altı kod, o
 * kadar. Metinler spec'in kendi İngilizce ifadeleridir: protokol terimidir,
 * çeviriye GİRMEZ (CLAUDE.md). Tabloda olmayan bir kod adlandırılmaz; ekran
 * sayıyı basar ve uydurma bir açıklama eklemez.
 */
export const MQTT_CONNACK_RETURN_CODES: ReadonlyMap<number, string> = new Map([
  [0, 'Connection Accepted'],
  [1, 'Connection Refused, unacceptable protocol version'],
  [2, 'Connection Refused, identifier rejected'],
  [3, 'Connection Refused, Server unavailable'],
  [4, 'Connection Refused, bad user name or password'],
  [5, 'Connection Refused, not authorized'],
]);

export interface MqttConnectOptions {
  /**
   * §3.1.3.1: 1-23 karakterlik `[0-9a-zA-Z]` dizgesini HER sunucu kabul etmek
   * ZORUNDA; daha uzunu ya da başka karakter içereni kabul etmek SEÇİMLİKTİR.
   * Bu yüzden burada uzunluk yalnız protokol sınırına (65535 bayt) karşı
   * denetlenir; kısıtlı sunucu reddederse cevap return code 2 olarak GELİR ve
   * ekranda görünür — kullanıcının yazdığı kimliği sessizce kırpmak, başka bir
   * istemci adıyla bağlanmak olurdu.
   */
  readonly clientId: string;
  /** Varsayılan 0 = mekanizma kapalı (dosya başı). */
  readonly keepAliveSeconds?: number;
}

/** Akıştan sökülmüş tek kontrol paketi. */
export interface MqttControlPacket {
  /** Fixed Header'ın üst nibble'ı. */
  readonly packetType: number;
  /** Fixed Header'ın alt nibble'ı. */
  readonly flags: number;
  /** Variable header + payload — yani Remaining Length'in saydığı baytlar. */
  readonly remaining: Uint8Array;
  /** Fixed Header dahil paketin tamamı. */
  readonly bytes: Uint8Array;
}

export interface MqttConnack {
  readonly sessionPresent: boolean;
  readonly returnCode: number;
  readonly accepted: boolean;
  /** `MQTT_CONNACK_RETURN_CODES`ten; tanınmayan kodda `undefined`. */
  readonly description: string | undefined;
}

/**
 * Okuma başarısızlığı METİN üretmez, SINIF üretir — `converterEngine.ts`in
 * "motor anahtar üretir" disiplininin bu modüldeki karşılığı. İki sınıf ayrı
 * tutuluyor çünkü çağıran farklı yorumluyor: yanlış paket tipi broker'ın
 * protokolü konuşmadığını, kısa paket ise CONNACK'in bozuk olduğunu söyler.
 */
export type MqttConnackReadResult =
  | { readonly ok: true; readonly connack: MqttConnack }
  | { readonly ok: false; readonly reason: 'wrong-packet-type' | 'too-short' };

export interface MqttPacketAssemblerOptions {
  readonly maxPacketLength?: number;
}

export interface MqttPacketAssembler {
  /** Biriktirir ve BU çağrıda tamamlanan paketleri döndürür. */
  push(chunk: Uint8Array): readonly MqttControlPacket[];
  /** Bir kez `true` olduysa akış artık okunamaz (dosya başı: resenkronizasyon yok). */
  readonly malformed: boolean;
}

/** İki baytlık uzunluk ön ekli UTF-8 alan (§1.5.3) yazar ve yazılan bayt sayısını döndürür. */
function writeLengthPrefixed(target: Uint8Array, offset: number, payload: Uint8Array): number {
  target[offset] = (payload.length >> BITS_PER_BYTE) & BYTE_MASK;
  target[offset + 1] = payload.length & BYTE_MASK;
  target.set(payload, offset + TWO_BYTE_LENGTH_FIELD_SIZE);
  return TWO_BYTE_LENGTH_FIELD_SIZE + payload.length;
}

/**
 * MQTT 3.1.1 CONNECT paketi üretir.
 *
 * Fırlatmak bilinçli ve `encodeMqttPublishPacket` ile aynı gerekçeye dayanır:
 * yarım ya da geçersiz bir CONNECT üretmek, karşı tarafın akışını kaydıracak
 * baytı kabloya çıkarmak olurdu. Çağıran istisnayı yakalayıp kullanıcıya
 * gösterir.
 */
export function encodeMqttConnectPacket(options: MqttConnectOptions): Uint8Array {
  const clientIdBytes = new TextEncoder().encode(options.clientId);
  if (clientIdBytes.length === 0) {
    // §3.1.3.1 sıfır uzunluklu kimliğe YALNIZ Clean Session = 1 ve sunucunun
    // kimlik ATAMAYI desteklemesi hâlinde izin verir. "Destekliyorsa" bir
    // varsayımdır; kimliği kullanıcıdan istemek, reddedilen bir bağlantıyı
    // açıklamaktan ucuzdur.
    throw new RangeError('encodeMqttConnectPacket: istemci kimliği boş olamaz');
  }
  if (clientIdBytes.length > MQTT_STRING_MAX_BYTES) {
    throw new RangeError(
      `encodeMqttConnectPacket: istemci kimliği ${clientIdBytes.length} bayt, üst sınır ${MQTT_STRING_MAX_BYTES}`,
    );
  }

  const keepAliveSeconds = options.keepAliveSeconds ?? 0;
  if (!Number.isInteger(keepAliveSeconds) || keepAliveSeconds < 0 || keepAliveSeconds > KEEP_ALIVE_MAX_SECONDS) {
    throw new RangeError(
      `encodeMqttConnectPacket: keep alive 0..${KEEP_ALIVE_MAX_SECONDS} aralığında tam sayı olmalı, alınan: ${String(keepAliveSeconds)}`,
    );
  }

  const bodyLength =
    PROTOCOL_NAME_BYTES.length + 1 + 1 + TWO_BYTE_LENGTH_FIELD_SIZE + TWO_BYTE_LENGTH_FIELD_SIZE + clientIdBytes.length;
  const body = new Uint8Array(bodyLength);

  let offset = 0;
  body.set(PROTOCOL_NAME_BYTES, offset);
  offset += PROTOCOL_NAME_BYTES.length;
  body[offset] = PROTOCOL_LEVEL_311;
  offset += 1;
  body[offset] = CONNECT_FLAG_CLEAN_SESSION;
  offset += 1;
  body[offset] = (keepAliveSeconds >> BITS_PER_BYTE) & BYTE_MASK;
  body[offset + 1] = keepAliveSeconds & BYTE_MASK;
  offset += TWO_BYTE_LENGTH_FIELD_SIZE;
  offset += writeLengthPrefixed(body, offset, clientIdBytes);

  const remainingLength = encodeVariableByteInteger(body.length);
  const packet = new Uint8Array(1 + remainingLength.length + body.length);
  packet[0] = CONNECT_HEADER;
  packet.set(remainingLength, 1);
  packet.set(body, 1 + remainingLength.length);
  return packet;
}

/**
 * CONNACK'in iki bilgi baytını okur.
 *
 * **Remaining Length 2'den BÜYÜK olduğunda paket reddedilmez.** 3.1.1'de o alan
 * tam olarak 2'dir, ama v5 CONNACK'i aynı iki baytın ardına bir Properties
 * bloğu ekler ve ilk iki baytın ANLAMI iki sürümde de aynıdır (Acknowledge
 * Flags + Reason/Return Code). Bir broker sürümü karıştırırsa bile kabul/ret
 * kararı doğru okunur; katı davranmak, okunabilen bir cevabı okunamaz saymak
 * olurdu.
 */
export function readMqttConnack(packet: MqttControlPacket): MqttConnackReadResult {
  if (packet.packetType !== MQTT_PACKET_TYPE_CONNACK) {
    return { ok: false, reason: 'wrong-packet-type' };
  }
  if (packet.remaining.length < CONNACK_VARIABLE_HEADER_SIZE) {
    return { ok: false, reason: 'too-short' };
  }

  // `?? 0` dalı ölü — uzunluk yukarıda doğrulandı; `noUncheckedIndexedAccess` istiyor.
  const acknowledgeFlags = packet.remaining[0] ?? 0;
  const returnCode = packet.remaining[1] ?? 0;

  return {
    ok: true,
    connack: {
      sessionPresent: (acknowledgeFlags & CONNACK_SESSION_PRESENT_BIT) !== 0,
      returnCode,
      accepted: returnCode === CONNACK_ACCEPTED,
      description: MQTT_CONNACK_RETURN_CODES.get(returnCode),
    },
  };
}

/**
 * WebSocket'ten gelen baytlardan MQTT kontrol paketleri söker (dosya başı:
 * çerçeve sınırı paket sınırı DEĞİLDİR).
 */
export function createMqttPacketAssembler(options: MqttPacketAssemblerOptions = {}): MqttPacketAssembler {
  const maxPacketLength = options.maxPacketLength ?? DEFAULT_MAX_PACKET_LENGTH;
  let buffer = new Uint8Array(0);
  let malformed = false;

  function append(chunk: Uint8Array): void {
    if (buffer.length === 0) {
      buffer = chunk.slice();
      return;
    }
    const merged = new Uint8Array(buffer.length + chunk.length);
    merged.set(buffer, 0);
    merged.set(chunk, buffer.length);
    buffer = merged;
  }

  return {
    get malformed(): boolean {
      return malformed;
    },

    push(chunk: Uint8Array): readonly MqttControlPacket[] {
      if (malformed) return [];
      append(chunk);

      const packets: MqttControlPacket[] = [];
      for (;;) {
        if (buffer.length < 2) break;

        const length = decodeVariableByteInteger(buffer, 1);
        if (!length.success) {
          // `truncated` = VBI daha bitmedi, sonraki chunk'ı bekle. `malformed`
          // = dört bayt tükendi ve devam biti hâlâ set: bu asla meşru olamaz.
          if (length.reason === 'malformed') malformed = true;
          break;
        }

        // `decodeVariableByteInteger` en çok dört bayt okuduğu için `value`
        // zaten `MQTT_VBI_MAX_VALUE`u aşamaz; buradaki sınır ONDAN DEĞİL, bu
        // istemcinin okuyabileceği paketten geliyor.
        const total = 1 + length.length + length.value;
        if (total > maxPacketLength) {
          malformed = true;
          break;
        }
        if (buffer.length < total) break;

        const first = buffer[0] ?? 0;
        packets.push({
          packetType: (first >> 4) & 0x0f,
          flags: first & 0x0f,
          // `slice` KOPYALAR: tüketici paketi saklayabilir ve `buffer` bir
          // sonraki `push`ta yeniden yazılır.
          remaining: buffer.slice(1 + length.length, total),
          bytes: buffer.slice(0, total),
        });
        buffer = buffer.slice(total);
      }

      if (malformed) buffer = new Uint8Array(0);
      return packets;
    },
  };
}
