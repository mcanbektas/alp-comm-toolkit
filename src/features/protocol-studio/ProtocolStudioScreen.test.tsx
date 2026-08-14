import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { RenderResult } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { LanguageProvider } from '@/app/providers/LanguageProvider';
import { useProtocolSchemaStore } from '@/app/store/protocolSchemaStore';
import { SPEC_SENSOR_PROTOCOL, SPEC_SENSOR_PROTOCOL_JSON } from '@/protocol-core/schemas/specFixture';

import { ProtocolStudioScreen } from './ProtocolStudioScreen';
import { resetDraftIdCounter } from './schemaDraft';

/**
 * Ekranın KENDİ metinleri (`studio.title`, `studio.help.*`, `studio.analyze.*`)
 * sözlüğe henüz eklenmedi; `t()` onlar için boş döner. Bu yüzden beklentiler
 * data-testid, id ve DEĞER üzerinden kurulur. Sözlükte hâlihazırda bulunan
 * metinler (taslak sorunları, hex hatası) doğrudan metinle doğrulanır — o
 * anahtarların çözülmesi zaten testin konusudur.
 */

/**
 * localStorage sahtesi. jsdom'unki test dosyası boyunca PAYLAŞILIR; store her
 * geçerli şemada yazdığı için bir testin çıktısı diğerinin açılışını
 * değiştirirdi (bkz. `useProtocolStudio.test.ts`).
 */
function createMemoryStorage(): Storage {
  const entries = new Map<string, string>();
  return {
    get length(): number {
      return entries.size;
    },
    clear(): void {
      entries.clear();
    },
    getItem(key: string): string | null {
      return entries.get(key) ?? null;
    },
    key(index: number): string | null {
      return Array.from(entries.keys())[index] ?? null;
    },
    removeItem(key: string): void {
      entries.delete(key);
    },
    setItem(key: string, value: string): void {
      entries.set(key, value);
    },
  };
}

const memoryStorage = createMemoryStorage();
Object.defineProperty(window, 'localStorage', {
  value: memoryStorage,
  configurable: true,
  writable: true,
});

/** İçe aktarma testleri için: spec fixture'ının yalnız adı değişmiş kopyası. */
const IMPORTED_SCHEMA_JSON = JSON.stringify({
  ...SPEC_SENSOR_PROTOCOL,
  name: 'Imported Protocol',
});

function renderScreen(): RenderResult {
  return render(
    <LanguageProvider>
      <ProtocolStudioScreen />
    </LanguageProvider>,
  );
}

/** `querySelector` `Element | null` döner; testin patlaması sessiz `null`dan iyidir. */
function requireElement(container: HTMLElement, selector: string): HTMLElement {
  const element = container.querySelector(selector);
  if (!(element instanceof HTMLElement)) {
    throw new Error(`Seçici bir HTML ögesine eşleşmedi: ${selector}`);
  }
  return element;
}

function firstMatch(pattern: RegExp, description: string): HTMLElement {
  const matches = screen.getAllByTestId(pattern);
  const first = matches[0];
  if (first === undefined) {
    throw new Error(`Alan listesi boş: ${description} yok.`);
  }
  return first;
}

function firstFieldButton(): HTMLElement {
  return firstMatch(/^field-select-/, 'seçilecek alan düğmesi');
}

function firstFieldNameCell(): HTMLElement {
  return firstMatch(/^field-name-/, 'alan adı hücresi');
}

beforeEach(() => {
  memoryStorage.clear();
  resetDraftIdCounter();
  // Store modül yüklenirken bir kez okunur; her test kendi başlangıcını kurar.
  useProtocolSchemaStore.setState({ schemaJson: SPEC_SENSOR_PROTOCOL_JSON });
});

describe('ProtocolStudioScreen — düzen', () => {
  it('renders all four panels of the studio layout', () => {
    renderScreen();

    // Sol: alan listesi (kendi çerçeve özetiyle), orta: bayt görüntüleyici,
    // sağ: alan özellikleri, alt: çıktı sekmeleri.
    expect(screen.getByTestId('studio-frame-summary')).toBeInTheDocument();
    expect(screen.getByTestId('frame-view-panel')).toBeInTheDocument();
    expect(screen.getByTestId('field-properties-panel')).toBeInTheDocument();
    expect(screen.getByTestId('studio-output-section')).toBeInTheDocument();
    expect(screen.getByTestId('output-tabpanel')).toBeInTheDocument();
  });

  it('opens with the stored schema in the header strip', () => {
    const { container } = renderScreen();

    expect(requireElement(container, '#studio-meta-name')).toHaveValue('ALP Sensor Protocol');
    expect(requireElement(container, '#studio-meta-version')).toHaveValue('1.0');
    expect(requireElement(container, '#studio-meta-framing')).toHaveValue('startEnd');
    // Taslak baytları ondalık metin olarak tutar: 0xAA → "170", 0x55 → "85".
    expect(requireElement(container, '#studio-meta-start-bytes')).toHaveValue('170');
    expect(requireElement(container, '#studio-meta-end-bytes')).toHaveValue('85');
    expect(requireElement(container, '#studio-meta-max-length')).toHaveValue(256);
  });

  it('publishes every generated artifact as an output tab', () => {
    renderScreen();

    // Çözümleme + doğrulama + altı üretici (§9.7).
    expect(screen.getAllByRole('tab')).toHaveLength(8);
  });
});

describe('ProtocolStudioScreen — üst bilgi düzenleme', () => {
  it('writes the protocol name into the draft', () => {
    const { container } = renderScreen();

    fireEvent.change(requireElement(container, '#studio-meta-name'), {
      target: { value: 'Renamed Protocol' },
    });

    expect(requireElement(container, '#studio-meta-name')).toHaveValue('Renamed Protocol');
    expect(screen.getByTestId('studio-frame-name')).toHaveTextContent('Renamed Protocol');
  });

  it('writes the framing type into the draft', () => {
    const { container } = renderScreen();

    fireEvent.change(requireElement(container, '#studio-meta-framing'), {
      target: { value: 'none' },
    });

    expect(screen.getByTestId('studio-frame-framing')).toHaveTextContent('Yok');
  });

  it('splits the framing byte list into separate bytes', () => {
    const { container } = renderScreen();

    fireEvent.change(requireElement(container, '#studio-meta-start-bytes'), {
      target: { value: '170 85' },
    });

    expect(screen.getByTestId('studio-frame-startBytes')).toHaveTextContent('170 85');
  });

  it('keeps the separator the user is still typing', () => {
    const { container } = renderScreen();

    // TUZAK: metin taslaktan yeniden kurulsaydı bu boşluk anında silinir ve
    // ikinci baytı yazmak imkânsız olurdu.
    fireEvent.change(requireElement(container, '#studio-meta-start-bytes'), {
      target: { value: '170 ' },
    });

    expect(requireElement(container, '#studio-meta-start-bytes')).toHaveValue('170 ');
  });

  it('reports a schema-level draft issue next to its own control', () => {
    const { container } = renderScreen();

    fireEvent.change(requireElement(container, '#studio-meta-max-length'), {
      target: { value: '' },
    });

    // Sözlükte bulunan bir anahtar: metniyle doğrulanabilir.
    expect(screen.getByText('Azami çerçeve uzunluğu zorunlu.')).toBeInTheDocument();
  });

  it('restores the spec fixture when the sample button is pressed', () => {
    const { container } = renderScreen();

    fireEvent.change(requireElement(container, '#studio-meta-name'), { target: { value: '' } });
    expect(screen.getByText('Protokol adı zorunlu.')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('studio-reset-fixture'));

    expect(requireElement(container, '#studio-meta-name')).toHaveValue('ALP Sensor Protocol');
    expect(screen.getByTestId('studio-frame-fieldCount')).toHaveTextContent('5');
  });
});

describe('ProtocolStudioScreen — alan seçimi', () => {
  it('fills the properties panel when a field is selected', () => {
    renderScreen();

    expect(screen.getByTestId('field-properties-empty')).toBeInTheDocument();

    fireEvent.click(firstFieldButton());

    expect(screen.queryByTestId('field-properties-empty')).toBeNull();
    expect(screen.getByTestId('field-props-id')).toHaveValue('address');
    expect(screen.getByTestId('field-props-name')).toHaveValue('Device Address');
  });

  it('routes property edits back into the selected field', () => {
    renderScreen();

    fireEvent.click(firstFieldButton());
    fireEvent.change(screen.getByTestId('field-props-name'), {
      target: { value: 'Slave Address' },
    });

    expect(screen.getByTestId('field-props-name')).toHaveValue('Slave Address');
    // Alan listesi de aynı taslağı okur: düzenleme tek kaynağa yazılmış demektir.
    // (Ad çıktı panelindeki çözümleme tablosunda da geçer; beklenti listeye bağlanır.)
    expect(firstFieldNameCell()).toHaveTextContent('Slave Address');
  });
});

describe('ProtocolStudioScreen — şema içe aktarma', () => {
  it('warns when the imported file is not a schema', async () => {
    renderScreen();

    const file = new File(['{ this is not json'], 'broken.json', { type: 'application/json' });
    fireEvent.change(screen.getByTestId('studio-import-schema'), { target: { files: [file] } });

    const alert = await screen.findByTestId('studio-import-error');
    expect(alert).toHaveTextContent('Dosya geçerli bir şema JSON dosyası değil.');
  });

  it('replaces the draft with the imported schema', async () => {
    const { container } = renderScreen();

    const file = new File([IMPORTED_SCHEMA_JSON], 'schema.json', { type: 'application/json' });
    fireEvent.change(screen.getByTestId('studio-import-schema'), { target: { files: [file] } });

    await waitFor(() => {
      expect(requireElement(container, '#studio-meta-name')).toHaveValue('Imported Protocol');
    });
    expect(screen.queryByTestId('studio-import-error')).toBeNull();
  });
});

describe('ProtocolStudioScreen — çözümleme düğmesi (§42/5)', () => {
  it('announces a successful parse', () => {
    renderScreen();

    fireEvent.click(screen.getByTestId('studio-analyze'));

    expect(screen.getByTestId('studio-analyze-announcement')).toHaveAttribute(
      'data-message-key',
      'studio.analyze.done',
    );
  });

  it('announces that the schema is not valid yet', () => {
    const { container } = renderScreen();

    fireEvent.change(requireElement(container, '#studio-meta-name'), { target: { value: '' } });
    fireEvent.click(screen.getByTestId('studio-analyze'));

    expect(screen.getByTestId('studio-analyze-announcement')).toHaveAttribute(
      'data-message-key',
      'studio.analyze.blocked',
    );
  });

  it('announces a failed parse', () => {
    const { container } = renderScreen();

    // Başlangıç baytı yok: çerçeve bulunamaz, ayrıştırma başarısız olur.
    fireEvent.change(requireElement(container, '#studio-frame-hex'), {
      target: { value: '01 02 03' },
    });
    fireEvent.click(screen.getByTestId('studio-analyze'));

    expect(screen.getByTestId('studio-analyze-announcement')).toHaveAttribute(
      'data-message-key',
      'studio.analyze.failed',
    );
  });

  it('announces that there is no sample frame to parse', () => {
    const { container } = renderScreen();

    fireEvent.change(requireElement(container, '#studio-frame-hex'), { target: { value: '' } });
    fireEvent.click(screen.getByTestId('studio-analyze'));

    expect(screen.getByTestId('studio-analyze-announcement')).toHaveAttribute(
      'data-message-key',
      'studio.analyze.empty',
    );
  });
});

describe('ProtocolStudioScreen — örnek çerçeve', () => {
  it('reports invalid hexadecimal input (§42)', () => {
    const { container } = renderScreen();

    fireEvent.change(requireElement(container, '#studio-frame-hex'), { target: { value: 'ZZ' } });

    // Aynı metin "yaygın hatalar" bölümünde de geçiyor (§42/11), beklenti panele bağlanır.
    const panel = within(screen.getByTestId('frame-view-panel'));
    expect(panel.getByRole('alert')).toHaveTextContent('Geçersiz onaltılık (hex) girdi');
  });
});

describe('ProtocolStudioScreen — §42 açıklama bölümleri', () => {
  it('renders every required explanatory section', () => {
    renderScreen();

    // 1, 2, 9, 10, 11 ve maddelerin ekranda nerede karşılandığı.
    expect(screen.getByTestId('studio-help-purpose')).toBeInTheDocument();
    expect(screen.getByTestId('studio-help-protocols')).toBeInTheDocument();
    expect(screen.getByTestId('studio-help-sections')).toBeInTheDocument();
    expect(screen.getByTestId('studio-help-interpretation')).toBeInTheDocument();
    expect(screen.getByTestId('studio-help-limitations')).toBeInTheDocument();
    expect(screen.getByTestId('studio-help-common-errors')).toBeInTheDocument();
  });

  it('lists the spec error texts among the common mistakes', () => {
    renderScreen();

    const commonErrors = screen.getByTestId('studio-help-common-errors');
    // §42'nin sabit metinleri sözlükte duruyor; ekran onları yeniden yazmaz.
    expect(commonErrors).toHaveTextContent('Geçersiz onaltılık (hex) girdi');
    expect(commonErrors).toHaveTextContent('Çerçeve uzunluğu, uzunluk alanıyla uyuşmuyor');
    expect(commonErrors).toHaveTextContent('CRC uyuşmuyor');
    expect(commonErrors).toHaveTextContent('Başlangıç baytı bulunamadı');
  });
});
