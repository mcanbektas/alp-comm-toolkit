import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';

import { LANGUAGE_STORAGE_KEY, LanguageProvider } from '@/app/providers/LanguageProvider';
import { useConverterHandoffStore } from '@/app/store/converterHandoffStore';
import { bytesToHex } from '@/protocol-core/buffers/representation';
import { protocolRegistry } from '@/protocol-core/registry';
import { registerBuiltInProtocols } from '@/protocols';
import { translations } from '@/translations/all';

import { ProtocolConverterScreen } from './ProtocolConverterScreen';

import type { ByteSource, ByteSourceHandlers } from '@/connection/types';
import type { MqttPublishOptions } from './useMqttPublish';

const tr = translations.tr;

/**
 * Kayıt defteri uygulama açılışında dolar (`main.tsx`); jsdom'da o adım
 * koşmadığı için burada elle doldurulur. Sahte plugin YAZILMADI: ekranın
 * varsayılanı spec §33'ün Modbus örneği ve testin ölçtüğü şey tam olarak o
 * zincirin gerçek motorla çalışması.
 */
registerBuiltInProtocols(protocolRegistry);

/** `useNavigate` (Packet Builder'a gönder) bir `<Router>` bağlamı ister — `PacketBuilderScreen.test.tsx` ile aynı desen. */
function renderScreen(publishOptions?: MqttPublishOptions): void {
  render(
    <MemoryRouter>
      <LanguageProvider>
        <ProtocolConverterScreen {...(publishOptions === undefined ? {} : { publishOptions })} />
      </LanguageProvider>
    </MemoryRouter>,
  );
}

/**
 * jsdom'da `WebSocket` YOK; ekranın broker dalını sınamak için sahte bir
 * `ByteSource` enjekte ediliyor (`useMqttPublish`in `createSource` kapısı).
 * Sahte broker CONNACK'i verilen dönüş koduyla yollar.
 */
function fakeBroker(returnCode: number): { readonly options: MqttPublishOptions; readonly written: Uint8Array[] } {
  const written: Uint8Array[] = [];
  const options: MqttPublishOptions = {
    timeoutMs: 50,
    createSource: (): ByteSource => {
      let handlers: ByteSourceHandlers | undefined;
      return {
        kind: 'websocket',
        canWrite: true,
        async start(given) {
          handlers = given;
          given.onStatus('connected');
          queueMicrotask(() => {
            given.onChunk(Uint8Array.from([0x20, 0x02, 0x00, returnCode]), 0);
          });
          return Promise.resolve();
        },
        async stop() {
          handlers = undefined;
          return Promise.resolve();
        },
        async write(bytes) {
          if (handlers === undefined) throw new Error('kapalı sokete yazıldı');
          written.push(bytes);
          return Promise.resolve();
        },
      };
    },
  };
  return { options, written };
}

/** Kaynak motoru LAZY iner; her iddia önce çerçevenin çözülmesini bekler. */
async function waitForParsedFrame(): Promise<void> {
  await waitFor(() => {
    expect(screen.getByTestId('converter-field-count')).toBeInTheDocument();
  });
}

describe('ProtocolConverterScreen', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, 'tr');
    useConverterHandoffStore.getState().clearPendingPacket();
  });

  it('boş açılmaz: spec §33 örneği hazır gelir ve gerçek paket üretir', async () => {
    renderScreen();
    await waitForParsedFrame();

    // Register 0 = 100, × 0.1 → 10.
    expect(screen.getByTestId('converter-value-mapping-1')).toHaveTextContent('10');
    expect(screen.getByTestId('converter-packets')).toHaveTextContent('sensors/temperature: 3017');
  });

  it('hedef biçimi JSON olunca metin çıktısı anahtarlanır', async () => {
    renderScreen();
    await waitForParsedFrame();

    fireEvent.change(screen.getByTestId('converter-destination'), { target: { value: 'json' } });

    expect(screen.getByTestId('converter-output-text')).toHaveTextContent('"sensors/temperature": 10');
    expect(screen.queryByTestId('converter-packets')).not.toBeInTheDocument();
  });

  it('dönüşüm değişince çarpan alanı da değişir', async () => {
    renderScreen();
    await waitForParsedFrame();

    fireEvent.change(screen.getByTestId('converter-mapping-1-transform'), { target: { value: 'none' } });

    expect(screen.queryByTestId('converter-mapping-1-factor')).not.toBeInTheDocument();
    expect(screen.getByTestId('converter-value-mapping-1')).toHaveTextContent('100');
  });

  it('okunamayan hex girdide çöker gibi davranmaz, uyarı basar', async () => {
    renderScreen();
    await waitForParsedFrame();

    fireEvent.change(screen.getByTestId('converter-hex'), { target: { value: 'ZZ' } });

    expect(screen.getByTestId('converter-parse-issue')).toHaveTextContent(tr['converter.parse.invalidHex']);
    // Eşleme tablosu yerinde kalır: kullanıcı yazdığı eşlemeyi kaybetmemeli.
    expect(screen.getByTestId('converter-mapping-1-destination')).toHaveValue('sensors/temperature');
  });

  /** Çıktı üretilmediğinde nedeni SAKLANMAZ; sorun listesi yine basılır. */
  it('alanı olmayan eşlemede boş çıktı değil, gerekçe gösterilir', async () => {
    renderScreen();
    await waitForParsedFrame();

    fireEvent.change(screen.getByTestId('converter-mapping-1-source'), { target: { value: '' } });

    expect(screen.getByTestId('converter-output-empty')).toBeInTheDocument();
    // Yer tutucusuz gövde: alan kimliği boş olduğunda `{detail}` da boştur.
    expect(screen.getByTestId('converter-issues')).toHaveTextContent(
      tr['converter.issue.unknownField'].replace('{detail}', '').trim(),
    );
  });

  it('eşleme eklenip kaldırılabilir', async () => {
    renderScreen();
    await waitForParsedFrame();

    fireEvent.click(screen.getByTestId('converter-add-mapping'));
    expect(screen.getByTestId('converter-mapping-2-source')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('converter-mapping-2-remove'));
    expect(screen.queryByTestId('converter-mapping-2-source')).not.toBeInTheDocument();
  });

  it('"Packet Builder\'a gönder" paketi handoff store\'a hex+etiketiyle bırakır', async () => {
    renderScreen();
    await waitForParsedFrame();

    fireEvent.click(screen.getByTestId('converter-send-to-builder-mapping-1'));

    const state = useConverterHandoffStore.getState();
    expect(state.pendingHex).toBe('3017001373656E736F72732F74656D70657261747572653130');
    expect(state.pendingLabel).toBe('sensors/temperature');
  });
  /**
   * Bölüm YALNIZ paket üreten hedefte basılır: JSON metin üretir, gönderilecek
   * bir MQTT paketi yoktur ve adres kutusu boş bir vaat olurdu.
   */
  it('broker bölümü yalnız mqtt-publish hedefinde görünür', async () => {
    renderScreen();
    await waitForParsedFrame();

    expect(screen.getByTestId('converter-broker-section')).toBeInTheDocument();

    fireEvent.change(screen.getByTestId('converter-destination'), { target: { value: 'json' } });
    expect(screen.queryByTestId('converter-broker-section')).not.toBeInTheDocument();
  });

  /** Hedef GÖNDERİM ANINDA ekranda olmalı: topic ve adres düğmenin yanında. */
  it('hedef adres ile topic düğmenin yanında yazılı durur ve adres değişince güncellenir', async () => {
    renderScreen();
    await waitForParsedFrame();

    fireEvent.change(screen.getByTestId('converter-broker-url'), { target: { value: 'ws://broker.example:9001' } });

    expect(screen.getByTestId('converter-broker-target-mapping-1')).toHaveTextContent(
      'sensors/temperature → ws://broker.example:9001',
    );
  });

  it('yayınla düğmesi gerçek CONNECT + PUBLISH + DISCONNECT baytlarını sokete yazar', async () => {
    const broker = fakeBroker(0);
    renderScreen(broker.options);
    await waitForParsedFrame();

    fireEvent.change(screen.getByTestId('converter-broker-url'), { target: { value: 'ws://broker.example:9001' } });
    fireEvent.click(screen.getByTestId('converter-broker-publish-mapping-1'));

    await waitFor(() => {
      expect(screen.getByTestId('converter-broker-sent')).toBeInTheDocument();
    });

    // Sonuç satırı hedefi TEKRAR yazar: ne gönderildiği ve nereye.
    expect(screen.getByTestId('converter-broker-sent')).toHaveTextContent('sensors/temperature');
    expect(screen.getByTestId('converter-broker-sent')).toHaveTextContent('ws://broker.example:9001');

    expect(broker.written).toHaveLength(3);
    // Ortadaki paket ekranda basılan hex'in AYNISI: baytları `mqtt` encoder'ı yazdı.
    expect(bytesToHex(broker.written[1] ?? new Uint8Array(0))).toBe(
      '3017001373656E736F72732F74656D70657261747572653130',
    );
    // Son paket DISCONNECT: oturum nazikçe kapatılıyor.
    expect(broker.written[2]).toEqual(Uint8Array.from([0xe0, 0x00]));
  });

  /** Reddi sessizce yutmak, gönderilmemiş bir paketi gönderilmiş göstermek olurdu. */
  it('broker reddedince dönüş kodu ve OASIS metni gösterilir, "gönderildi" yazılmaz', async () => {
    const broker = fakeBroker(5);
    renderScreen(broker.options);
    await waitForParsedFrame();

    fireEvent.click(screen.getByTestId('converter-broker-publish-mapping-1'));

    await waitFor(() => {
      expect(screen.getByTestId('converter-broker-error')).toBeInTheDocument();
    });

    expect(screen.getByTestId('converter-broker-error')).toHaveTextContent('Connection Refused, not authorized');
    expect(screen.queryByTestId('converter-broker-sent')).not.toBeInTheDocument();
    // Reddedilen oturuma PUBLISH yazılmaz: yalnız CONNECT çıkmış olmalı.
    expect(broker.written).toHaveLength(1);
  });
});
