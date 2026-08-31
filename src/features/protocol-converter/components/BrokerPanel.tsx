/**
 * Üretilen MQTT paketini kullanıcının verdiği broker'a yayınlayan bölüm.
 *
 * ── EKRANDA NEDEN BU KADAR ÇOK YAZI VAR ─────────────────────────────────────
 * CLAUDE.md *"kullanıcı verisi yerelde kalır"* diyor; bu bölüm o kuralın
 * BİLİNÇLİ ve SINIRLI istisnası (gerekçenin tamamı `mqttPublisher.ts` dosya
 * başında). İstisnanın koşullarından ikisi doğrudan burayı bağlıyor:
 * gönderim ancak açık bir tıklamayla başlar ve HEDEF, gönderim anında ekranda
 * yazılı durur. Bu yüzden her düğmenin yanında `topic → adres` basılıyor;
 * "nereye gittiğini bir yerlerde yazıyordu" demek yeterli değil.
 *
 * İki kısıt da yazılı: yalnız anonim broker (parola deposu yok) ve QoS 0'ın
 * onayı olmadığı. İkincisini yazmamak, protokolün vermediği bir teslim
 * garantisini ima etmek olurdu.
 *
 * Bileşen HESAP YAPMAZ (CLAUDE.md): oturumu `mqttPublisher.ts` yürütür, durumu
 * `useMqttPublish.ts` tutar, burada yalnız alanlar ve sonuç basılır.
 */

import type { ReactNode } from 'react';

import { useTranslation } from '@/app/providers/LanguageProvider';

import type { ConvertedPacket } from '../converterTypes';
import type { MqttPublishApi } from '../useMqttPublish';

const FIELD_CLASS = 'rounded-token-sm border border-line bg-surface px-2 py-1 text-sm text-text';
const LABEL_CLASS = 'flex flex-col gap-1 text-xs text-muted';
const BUTTON_CLASS =
  'rounded-token-sm border border-line bg-raised px-2 py-1 text-xs text-text hover:border-line-strong hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:text-muted';

interface BrokerPanelProps {
  readonly packets: readonly ConvertedPacket[];
  readonly publisher: MqttPublishApi;
}

export function BrokerPanel({ packets, publisher }: BrokerPanelProps): ReactNode {
  const { t } = useTranslation();
  // Adres boşken düğme kapalı: boş adrese "gönder" demek, kullanıcıya
  // açıklanamayacak bir hata üretmekten ibaret olurdu.
  const canPublish = !publisher.busy && publisher.brokerUrl.trim().length > 0 && publisher.clientId.trim().length > 0;

  return (
    <div className="flex flex-col gap-3">
      <p className="max-w-3xl text-sm text-muted" data-testid="converter-broker-intro">
        {t('converter.broker.intro')}
      </p>
      <p className="max-w-3xl text-xs text-muted" data-testid="converter-broker-limits">
        {t('converter.broker.limits')}
      </p>
      <p className="max-w-3xl text-xs text-muted" data-testid="converter-broker-qos0">
        {t('converter.broker.qos0')}
      </p>

      <div className="flex flex-wrap items-end gap-3">
        <label className={`${LABEL_CLASS} grow`} htmlFor="converter-broker-url">
          {t('converter.broker.url')}
          <input
            id="converter-broker-url"
            data-testid="converter-broker-url"
            className={`${FIELD_CLASS} font-mono`}
            value={publisher.brokerUrl}
            disabled={publisher.busy}
            onChange={(event) => {
              publisher.setBrokerUrl(event.target.value);
            }}
          />
        </label>

        <label className={LABEL_CLASS} htmlFor="converter-broker-client-id">
          {t('converter.broker.clientId')}
          <input
            id="converter-broker-client-id"
            data-testid="converter-broker-client-id"
            className={`${FIELD_CLASS} font-mono`}
            value={publisher.clientId}
            disabled={publisher.busy}
            onChange={(event) => {
              publisher.setClientId(event.target.value);
            }}
          />
        </label>
      </div>

      {packets.length === 0 ? (
        <p className="text-sm text-muted" data-testid="converter-broker-no-packet">
          {t('converter.broker.noPacket')}
        </p>
      ) : (
        <ul className="flex flex-col gap-2" data-testid="converter-broker-targets">
          {packets.map((packet) => (
            <li key={packet.mappingId} className="flex flex-wrap items-center gap-2">
              {/* Hedef GÖNDERİM ANINDA görünür: topic ve adres düğmenin yanında. */}
              <span className="font-mono text-xs text-text" data-testid={`converter-broker-target-${packet.mappingId}`}>
                {t('converter.broker.destination', { topic: packet.topic, url: publisher.brokerUrl })}
              </span>
              <button
                type="button"
                data-testid={`converter-broker-publish-${packet.mappingId}`}
                className={BUTTON_CLASS}
                disabled={!canPublish}
                onClick={() => {
                  // `void`: tıklama işleyicisi senkron, gönderim asenkron.
                  void publisher.publish(packet);
                }}
              >
                {t(publisher.busy ? 'converter.broker.publishing' : 'converter.broker.publish')}
              </button>
            </li>
          ))}
        </ul>
      )}

      {publisher.sent !== null ? (
        <p role="status" className="text-sm text-accent" data-testid="converter-broker-sent">
          {t('converter.broker.sent', {
            byteCount: publisher.sent.byteCount,
            topic: publisher.sent.topic,
            url: publisher.sent.url,
          })}
        </p>
      ) : null}

      {publisher.error !== null ? (
        <p role="alert" className="text-sm text-danger" data-testid="converter-broker-error">
          {/* Ayrıntı VERİDİR (broker'ın return code'u, soket mesajı): birebir basılır. */}
          {t(publisher.error.messageKey, { detail: publisher.error.detail })}
        </p>
      ) : null}
    </div>
  );
}
