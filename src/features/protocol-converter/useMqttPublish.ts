/**
 * Broker'a yayınlama ekranının durumu. Hesap YAPMAZ (CLAUDE.md mimari kuralı):
 * oturumu `mqttPublisher.ts` yürütür, burada yalnız adres/kimlik alanları,
 * "meşgul" bayrağı ve sonucun çeviri anahtarına indirgenmesi var.
 *
 * ── SOKET FABRİKASI DIŞA AÇIK ───────────────────────────────────────────────
 * `webSocketSource.ts`in `socketFactory` disipliniyle aynı gerekçe: jsdom'da
 * `WebSocket` yok ve ekran testinin bir tarayıcı sınıfını taklit etmesi
 * gerekmesin. Varsayılan gerçek kaynaktır, testler sahte `ByteSource` verir.
 *
 * ── GÖNDERİM YALNIZ AÇIK BİR EYLEMLE BAŞLAR ─────────────────────────────────
 * `publish` yalnız düğme tıklamasından çağrılır; burada `useEffect` yok, otomatik
 * yeniden deneme yok, zamanlayıcı yok. Bu, `mqttPublisher.ts` başlığındaki
 * "kullanıcı verisi yerelde kalır" istisnasının koşullarından biri.
 */

import { useCallback, useMemo, useState } from 'react';

import { createWebSocketSource } from '@/connection/websocket/webSocketSource';
import { MQTT_WEBSOCKET_SUBPROTOCOL } from '@/protocols/network/mqtt/mqttSession';

import { publishMqttPacket } from './mqttPublisher';

import type { ByteSource } from '@/connection/types';
import type { TranslationKey } from '@/translations';
import type { ConvertedPacket } from './converterTypes';
import type { MqttPublishFailure } from './mqttPublisher';

/**
 * Başlangıç adresi bir ÖNERİDİR, kurulu bir broker iddiası değil: mosquitto'nun
 * `websockets` dinleyicisi belgelerinde bu portla örneklenir. Broker'a göre
 * değişir (EMQX `8083/mqtt`), o yüzden alan düzenlenebilir. Depodaki öteki üç
 * ekranın `ws://localhost:8080` varsayılanı buraya UYMAZ: orası ham bayt
 * köprüsüdür, burası MQTT konuşan bir broker olmalı.
 */
const DEFAULT_BROKER_URL = 'ws://localhost:9001';

/**
 * §3.1.3.1: HER sunucunun kabul etmek ZORUNDA olduğu kimlik 1-23 karakter ve
 * yalnız `[0-9a-zA-Z]`. Tire bu kümenin DIŞINDA — `alp-comm` yazmak, kabulü
 * sunucunun seçimine bırakmak olurdu. Rastgele son ek, aynı broker'a bağlanan
 * iki sekmenin birbirini düşürmemesi için (MQTT'de aynı kimlik = önceki
 * bağlantı kapatılır); bir sır değil, bu yüzden `Math.random` yeterli.
 */
const CLIENT_ID_PREFIX = 'alpcomm';
const CLIENT_ID_SUFFIX_LENGTH = 8;

function generateClientId(): string {
  let suffix = '';
  while (suffix.length < CLIENT_ID_SUFFIX_LENGTH) {
    suffix += Math.floor(Math.random() * 16).toString(16);
  }
  return `${CLIENT_ID_PREFIX}${suffix}`;
}

/** Sürücünün ürettiği sınıf → çeviri anahtarı. Motor metin üretmez, ekran çevirir. */
const FAILURE_KEYS: Readonly<Record<MqttPublishFailure, TranslationKey>> = {
  'connect-failed': 'converter.broker.error.connectFailed',
  'connack-timeout': 'converter.broker.error.connackTimeout',
  'closed-early': 'converter.broker.error.closedEarly',
  'connack-malformed': 'converter.broker.error.connackMalformed',
  'connack-rejected': 'converter.broker.error.rejected',
  'write-failed': 'converter.broker.error.writeFailed',
};

/** Gönderim anında ekranda duran hedef — adres ve topic birlikte (bkz. `mqttPublisher.ts`). */
export interface MqttPublishTarget {
  readonly url: string;
  readonly topic: string;
  readonly byteCount: number;
}

export interface MqttPublishError {
  readonly messageKey: TranslationKey;
  /** Teknik ayrıntı; veridir, çeviriye girmez. Yoksa boş. */
  readonly detail: string;
}

export interface MqttPublishApi {
  readonly brokerUrl: string;
  readonly clientId: string;
  readonly busy: boolean;
  /** Son BAŞARILI gönderimin hedefi; henüz gönderilmediyse `null`. */
  readonly sent: MqttPublishTarget | null;
  readonly error: MqttPublishError | null;
  readonly setBrokerUrl: (url: string) => void;
  readonly setClientId: (clientId: string) => void;
  readonly publish: (packet: ConvertedPacket) => Promise<void>;
}

export interface MqttPublishOptions {
  /** Testler sahte kaynak enjekte eder; varsayılanı gerçek WebSocket kaynağı. */
  readonly createSource?: (url: string) => ByteSource;
  readonly timeoutMs?: number;
}

export function useMqttPublish(options: MqttPublishOptions = {}): MqttPublishApi {
  const [brokerUrl, setBrokerUrl] = useState(DEFAULT_BROKER_URL);
  // Kimlik bir KEZ üretilir: her render'da yenilenseydi kullanıcının elle
  // yazdığı kimlik de silinirdi.
  const [clientId, setClientId] = useState(generateClientId);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<MqttPublishTarget | null>(null);
  const [error, setError] = useState<MqttPublishError | null>(null);

  const createSource = options.createSource;
  const timeoutMs = options.timeoutMs;

  const makeSource = useMemo(
    () =>
      createSource ??
      ((url: string): ByteSource =>
        // Alt protokol ZORUNLU (OASIS §6): göndermeyen istemciyi gerçek
        // broker'lar el sıkışmada reddeder.
        createWebSocketSource(url, { protocols: MQTT_WEBSOCKET_SUBPROTOCOL })),
    [createSource],
  );

  const publish = useCallback(
    async (packet: ConvertedPacket): Promise<void> => {
      setBusy(true);
      setError(null);
      setSent(null);

      const outcome = await publishMqttPacket({
        source: makeSource(brokerUrl),
        clientId,
        packet: packet.bytes,
        ...(timeoutMs === undefined ? {} : { timeoutMs }),
      });

      if (outcome.ok) {
        setSent({ url: brokerUrl, topic: packet.topic, byteCount: packet.bytes.length });
      } else {
        const connack = outcome.connack;
        // Ret kodunun açıklaması OASIS'in kendi metnidir (protokol terimi);
        // tanınmayan kodda YALNIZ sayı basılır, açıklama uydurulmaz.
        const detail =
          connack === undefined
            ? (outcome.detail ?? '')
            : `${String(connack.returnCode)}${connack.description === undefined ? '' : ` — ${connack.description}`}`;
        setError({ messageKey: FAILURE_KEYS[outcome.failure], detail });
      }

      setBusy(false);
    },
    [brokerUrl, clientId, makeSource, timeoutMs],
  );

  return { brokerUrl, clientId, busy, sent, error, setBrokerUrl, setClientId, publish };
}
