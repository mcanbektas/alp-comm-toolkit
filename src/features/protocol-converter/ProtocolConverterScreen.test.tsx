import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';

import { LANGUAGE_STORAGE_KEY, LanguageProvider } from '@/app/providers/LanguageProvider';
import { useConverterHandoffStore } from '@/app/store/converterHandoffStore';
import { protocolRegistry } from '@/protocol-core/registry';
import { registerBuiltInProtocols } from '@/protocols';
import { translations } from '@/translations/all';

import { ProtocolConverterScreen } from './ProtocolConverterScreen';

const tr = translations.tr;

/**
 * Kayıt defteri uygulama açılışında dolar (`main.tsx`); jsdom'da o adım
 * koşmadığı için burada elle doldurulur. Sahte plugin YAZILMADI: ekranın
 * varsayılanı spec §33'ün Modbus örneği ve testin ölçtüğü şey tam olarak o
 * zincirin gerçek motorla çalışması.
 */
registerBuiltInProtocols(protocolRegistry);

/** `useNavigate` (Packet Builder'a gönder) bir `<Router>` bağlamı ister — `PacketBuilderScreen.test.tsx` ile aynı desen. */
function renderScreen(): void {
  render(
    <MemoryRouter>
      <LanguageProvider>
        <ProtocolConverterScreen />
      </LanguageProvider>
    </MemoryRouter>,
  );
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
});
