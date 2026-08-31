/**
 * Bir `ByteSource` üstünde MQTT bağlan-yayınla-kapat oturumunu yürüten sürücü.
 *
 * `features/test-automation/byteSourceIo.ts` ile AYNI katman kararı: protokol
 * bilgisi `protocols/`te saf durur (`mqttSession.ts` CONNECT'i yazar, CONNACK'i
 * okur), taşımayı SÜRMEK feature'ın işidir. Ters kurmak — sürücüyü
 * `protocols/network/mqtt/`e koymak — `protocols/`ü `connection/`e bağımlı
 * kılardı; bugün depoda böyle bir bağımlılık YOK ve tek bir ekran için açmaya
 * değmez.
 *
 * Modül React bilmez ve DOM'a dokunmaz: soket dışarıdan verilir, bu yüzden
 * birim testi sahte bir `ByteSource` ile koşar (CLAUDE.md: hesap bileşenin
 * içine yazılmaz).
 *
 * ── KULLANICI VERİSİ YERELDE KALIR KURALININ BİLİNÇLİ İSTİSNASI ─────────────
 * CLAUDE.md diyor ki: *"Seri port mesajları, CAN logları, protokol tanımları,
 * ağ paketleri ve şifreleme anahtarları sunucuya gönderilmez."* Bu modül tam
 * olarak bir ağ paketini bir sunucuya gönderir. İstisna kaldırma değil,
 * SINIRLANDIRMADIR ve kuralın koruduğu şeyle çelişmez:
 *
 * • Kuralın yasakladığı şey **bizim seçtiğimiz** bir sunucuya **arka planda**
 *   telemetri/analiz göndermektir. Burada adresi KULLANICI yazar, hedef onun
 *   kendi broker'ıdır ve gönderim ancak açık bir tıklamayla başlar.
 * • Aynı kategorideki emsal zaten var: `connection/websocket` kullanıcının
 *   verdiği adrese bağlanıp `write()` ile bayt gönderiyor (Packet Builder,
 *   Test Automation). Yeni olan tek şey, gönderilen baytın MQTT paketi olması.
 * • Otomatik gönderim YOK: burada tekrar/zamanlayıcı/yeniden deneme yoktur,
 *   `publishMqttPacket` bir çağrıda bir paket gönderir ve soketi kapatır.
 *   Ekran da hedefi (adres + topic) gönderim anında YAZILI gösterir.
 *
 * Depoda bir yere kaydedilen tek şey adres ve istemci kimliğidir — ikisi de
 * ekran durumunda, oturum boyunca; kimlik bilgisi ne alınır ne saklanır
 * (`mqttSession.ts`: yalnız anonim broker).
 *
 * ── QoS 0'IN DÜRÜST SINIRI ──────────────────────────────────────────────────
 * `encodeMqttPublishPacket` QoS 0 üretir ve QoS 0'ın ONAYI YOKTUR (PUBACK
 * yalnız QoS ≥ 1'de vardır). Bu sürücünün kanıtlayabileceği en fazla şey
 * şudur: broker CONNECT'i CONNACK ile KABUL ETTİ ve PUBLISH baytları AÇIK bir
 * sokete yazıldı. "Broker mesajı aldı/işledi" bu yoldan BİLİNEMEZ ve sonuç
 * `sent` diye adlandırılıyor (`delivered` değil) — teslim demek, protokolün
 * vermediği bir garantiyi uydurmak olurdu.
 *
 * QoS ≥ 1'e çıkmak yalnız bir bayrak meselesi değil: Packet Identifier ve bir
 * ack durum makinesi ister, tek atımlık `ProtocolEncoder.encode` sözleşmesi de
 * bunu ifade edemez (`mqttEncoders.ts`in `fixedParametersKey` kısıtı).
 *
 * ── UDP KAPSAM DIŞI, VE BU KALICI BİR SINIR ─────────────────────────────────
 * Tarayıcıda ham soket API'si yoktur; `mqtt-sn`in UDP taşıması bu uygulamadan
 * ULAŞILAMAZ. "İleride" diye bir dal bırakılmadı: gelmeyecek bir yol için stub
 * koymak, okuyanı yanlış bilgilendirmek olurdu.
 */

import {
  MQTT_DISCONNECT_PACKET,
  MQTT_PACKET_TYPE_CONNACK,
  createMqttPacketAssembler,
  encodeMqttConnectPacket,
  readMqttConnack,
} from '@/protocols/network/mqtt/mqttSession';

import type { ByteSource, ByteSourceHandlers, ConnectionError } from '@/connection/types';
import type { MqttConnack } from '@/protocols/network/mqtt/mqttSession';

/**
 * El sıkışma + CONNACK için varsayılan üst süre. WebSocket açılışı (TCP + TLS +
 * HTTP upgrade) uzak bir broker'da saniyeleri bulabilir; beş saniye onu
 * karşılar ama ulaşılamayan bir adreste kullanıcıyı süresiz bekletmez.
 * `webSocketSource` kendi başına ZAMAN AŞIMI ÜRETMEZ — tarayıcının soket
 * zaman aşımı dakikalar sürebilir, o yüzden süreyi burada tutuyoruz.
 */
const DEFAULT_TIMEOUT_MS = 5000;

/**
 * Başarısızlık METİN değil SINIF üretir (`converterEngine.ts`in "motor anahtar
 * üretir" disiplini). Sınıflar ayrı, çünkü kullanıcı için farklı şeyler
 * söylüyorlar: adres yanlış mı, broker sessiz mi, broker bizi reddetti mi.
 */
export type MqttPublishFailure =
  /** Soket hiç açılmadı: adres, ağ ya da el sıkışma (alt protokol reddi dahil). */
  | 'connect-failed'
  /** Soket açıldı ama CONNACK süresinde gelmedi. */
  | 'connack-timeout'
  /** Broker CONNECT'ten önce/sonra hattı kapattı — cevap yerine sessizlik. */
  | 'closed-early'
  /** Cevap geldi ama CONNACK değil ya da okunamayacak kadar kısa. */
  | 'connack-malformed'
  /** Broker açıkça reddetti; `returnCode` OASIS §3.2.2.3'ün kodudur. */
  | 'connack-rejected'
  /** Sokete yazılamadı (bağlantı yazma sırasında düştü). */
  | 'write-failed';

export type MqttPublishOutcome =
  | { readonly ok: true; readonly sessionPresent: boolean }
  | {
      readonly ok: false;
      readonly failure: MqttPublishFailure;
      /** Teknik ayrıntı — veridir, çeviriye girmez; ekranda birebir basılır. */
      readonly detail?: string;
      /** Yalnız `connack-rejected`ta dolu. */
      readonly connack?: MqttConnack;
    };

export interface MqttPublishOptions {
  /** Açılmamış kaynak; sürücü `start()` eder ve İŞİ BİTİNCE `stop()` eder. */
  readonly source: ByteSource;
  readonly clientId: string;
  /** `encodeMqttPublishPacket`in ürettiği hazır PUBLISH paketi. */
  readonly packet: Uint8Array;
  readonly timeoutMs?: number;
}

/** Sürücünün beklediği olaylar; hepsi `ByteSourceHandlers`tan doğuyor. */
type SessionEvent =
  | { readonly kind: 'connected' }
  | { readonly kind: 'closed' }
  | { readonly kind: 'error'; readonly error: ConnectionError }
  | { readonly kind: 'malformed' }
  | { readonly kind: 'connack'; readonly connack: MqttConnack }
  | { readonly kind: 'connack-unreadable'; readonly reason: string };

function describe(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}

/**
 * Bağlan → CONNECT → CONNACK → PUBLISH → DISCONNECT → kapat.
 *
 * Her çıkış yolu soketi kapatır: yarım kalmış bir oturum broker'da açık bir
 * bağlantı bırakırdı ve kullanıcı bunu ekrandan göremezdi.
 */
export async function publishMqttPacket(options: MqttPublishOptions): Promise<MqttPublishOutcome> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const assembler = createMqttPacketAssembler();

  /**
   * Tek yuvalı bekleyici + kuyruk. Kuyruk ŞART: `webSocketSource.start()`
   * geçersiz adreste `onError`ı SENKRON çağırır — yani biz beklemeye
   * geçmeden önce. Kuyruk olmasaydı o olay düşer ve sürücü zaman aşımına
   * kadar boşuna beklerdi.
   */
  const queue: SessionEvent[] = [];
  let waiting: ((event: SessionEvent) => void) | undefined;

  function emit(event: SessionEvent): void {
    const resolve = waiting;
    if (resolve === undefined) {
      queue.push(event);
      return;
    }
    waiting = undefined;
    resolve(event);
  }

  /** Sıradaki olay ya da süre dolduysa `undefined`. */
  function nextEvent(): Promise<SessionEvent | undefined> {
    const queued = queue.shift();
    if (queued !== undefined) return Promise.resolve(queued);

    return new Promise<SessionEvent | undefined>((resolve) => {
      const timer = setTimeout(() => {
        waiting = undefined;
        resolve(undefined);
      }, timeoutMs);
      waiting = (event) => {
        clearTimeout(timer);
        resolve(event);
      };
    });
  }

  const handlers: ByteSourceHandlers = {
    onChunk(chunk) {
      const packets = assembler.push(chunk);
      if (assembler.malformed) {
        emit({ kind: 'connack-unreadable', reason: 'malformed stream' });
        return;
      }
      for (const packet of packets) {
        if (packet.packetType !== MQTT_PACKET_TYPE_CONNACK) {
          // Bu istemci SUBSCRIBE etmiyor; CONNACK dışı bir paket beklenmiyor
          // ama gelmesi hata değil (broker PINGRESP/DISCONNECT yollayabilir).
          continue;
        }
        const read = readMqttConnack(packet);
        emit(read.ok ? { kind: 'connack', connack: read.connack } : { kind: 'connack-unreadable', reason: read.reason });
        return;
      }
    },
    onStatus(status) {
      if (status === 'connected') emit({ kind: 'connected' });
      // `'idle'` = karşı taraf kapattı (`webSocketSource`: hattın bitmesi hata
      // değildir). Oturumun ORTASINDA ise beklediğimiz cevap gelmeyecek demek.
      else if (status === 'idle') emit({ kind: 'closed' });
    },
    onError(error) {
      emit({ kind: 'error', error });
    },
  };

  async function finish(outcome: MqttPublishOutcome): Promise<MqttPublishOutcome> {
    try {
      await options.source.stop();
    } catch {
      // `stop()` yeniden çağrılabilir ve kapalı soketi kapatmak önemsiz
      // (`webSocketSource` sözleşmesi); kapanış hatası sonucu değiştirmez.
    }
    return outcome;
  }

  let connectPacket: Uint8Array;
  try {
    connectPacket = encodeMqttConnectPacket({ clientId: options.clientId });
  } catch (cause) {
    // Kaynak henüz başlatılmadı; kapatacak bir şey yok.
    return { ok: false, failure: 'connect-failed', detail: describe(cause) };
  }

  try {
    await options.source.start(handlers);
  } catch (cause) {
    return finish({ ok: false, failure: 'connect-failed', detail: describe(cause) });
  }

  /**
   * `start()` soketi AÇMAZ, açılışı BAŞLATIR; "bağlandı"yı `onopen` yazar
   * (`webSocketSource.ts`, Packet Builder'ın da uyduğu kural). Burada
   * beklemeden CONNECT yazmak, el sıkışma sürerken `write()` çağırmak olurdu
   * ve o çağrı "WebSocket bağlı değil" diye fırlardı.
   */
  for (;;) {
    const event = await nextEvent();
    if (event === undefined) {
      return finish({ ok: false, failure: 'connect-failed', detail: `${String(timeoutMs)} ms` });
    }
    if (event.kind === 'connected') break;
    if (event.kind === 'error') {
      return finish({ ok: false, failure: 'connect-failed', detail: event.error.message });
    }
    if (event.kind === 'closed') {
      return finish({ ok: false, failure: 'closed-early' });
    }
    // CONNACK'in bağlanmadan gelmesi mümkün değil; öteki olaylar yok sayılır.
  }

  try {
    await options.source.write(connectPacket);
  } catch (cause) {
    return finish({ ok: false, failure: 'write-failed', detail: describe(cause) });
  }

  let connack: MqttConnack;
  for (;;) {
    const event = await nextEvent();
    if (event === undefined) {
      return finish({ ok: false, failure: 'connack-timeout' });
    }
    if (event.kind === 'connack') {
      connack = event.connack;
      break;
    }
    if (event.kind === 'connack-unreadable') {
      return finish({ ok: false, failure: 'connack-malformed', detail: event.reason });
    }
    if (event.kind === 'error') {
      return finish({ ok: false, failure: 'connect-failed', detail: event.error.message });
    }
    if (event.kind === 'closed') {
      // Broker'ların bir kısmı reddi CONNACK yerine sessiz kapanışla bildirir;
      // "reddedildi" demek uydurma olurdu, "cevap vermeden kapattı" demek değil.
      return finish({ ok: false, failure: 'closed-early' });
    }
  }

  if (!connack.accepted) {
    return finish({ ok: false, failure: 'connack-rejected', connack });
  }

  try {
    await options.source.write(options.packet);
    // DISCONNECT nazik kapanıştır: broker Will mesajı yayınlamaz ve bağlantıyı
    // "koptu" diye günlüğe yazmaz. Sokete yazılan son bayt bu.
    await options.source.write(MQTT_DISCONNECT_PACKET);
  } catch (cause) {
    return finish({ ok: false, failure: 'write-failed', detail: describe(cause) });
  }

  return finish({ ok: true, sessionPresent: connack.sessionPresent });
}
