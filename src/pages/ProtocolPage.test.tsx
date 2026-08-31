import { render, screen } from '@testing-library/react';
import type { RenderResult } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';

import { allEntries } from '@/app/catalog';
import { DEFINITION_FORMATS } from '@/app/catalog/types';
import { LANGUAGE_STORAGE_KEY, LanguageProvider } from '@/app/providers/LanguageProvider';
import { registerBuiltInProtocols } from '@/protocols';
import { translations } from '@/translations/all';

import { hasDefinitionPanel, ProtocolPage, resolveDefinitionPanel } from './ProtocolPage';

/**
 * Sayfa GERÇEK katalogla ve GERÇEK kayıt defteriyle koşuyor: sınanan şey tam da
 * "katalogdaki `pluginId` motoru ekrana getiriyor mu" zinciri. Kataloğu ya da
 * defteri sahtelemek o zincirin kendisini taklit etmek olurdu.
 *
 * `registerBuiltInProtocols` normalde `main.tsx`te bir kez koşar; test ağacı
 * oradan geçmediği için burada elle çağrılıyor.
 */
registerBuiltInProtocols();

/** Motoru olan kayıt (katalogda `pluginId: 'modbus-rtu'`). */
const PLUGGED_PATH = 'industrial-automation/modbus/modbus-rtu';
/**
 * Motoru OLMAYAN kayıt KATALOGDAN TÜRETİLİR — elle taşınmaz.
 * Bu fixture dört kez elle taşındı (uart → microwire → flexray → seatalk) ve her
 * seferinde bir sonraki dalga onu da bağladı. `e2e/modbus-decode.spec.ts`in
 * (dalga 15b) yapısal çözümünün aynısı: motoru olmayan, alias olmayan,
 * `decode` sekmesi olan ilk `planned` kayıt. Hiç kalmazsa test AÇIKÇA atlanır,
 * sessizce yeşil kalmaz.
 */
const plannedEntry = allEntries().find(
  (entry) =>
    entry.protocol.status === 'planned' &&
    entry.protocol.aliasOf === undefined &&
    entry.protocol.pluginId === undefined &&
    entry.protocol.tabs.includes('decode'),
);
const PLANNED_PATH = plannedEntry?.path;

function renderAt(path: string): RenderResult {
  return render(
    <LanguageProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path=":domainId/:familyId/:protocolId" element={<ProtocolPage />} />
        </Routes>
      </MemoryRouter>
    </LanguageProvider>,
  );
}

beforeEach(() => {
  window.localStorage.clear();
  window.localStorage.setItem(LANGUAGE_STORAGE_KEY, 'tr');
});

describe('ProtocolPage decode tab', () => {
  it('mounts the decode panel and drops the planned notice when a plugin is bound', async () => {
    renderAt(`/${PLUGGED_PATH}?tab=decode`);

    // Panel tembel yüklenir, motoru da öyle: ilk kare Suspense fallback'idir.
    expect(await screen.findByTestId('decode-panel')).toBeInTheDocument();
    expect(screen.getByTestId('decode-plugin-name')).toHaveTextContent('Modbus RTU');
    expect(screen.queryByText(translations.tr['protocol.plannedNotice'])).not.toBeInTheDocument();
  });

  it('decodes the spec §43 reference frame end to end', async () => {
    renderAt(`/${PLUGGED_PATH}?tab=decode`);
    await screen.findByTestId('decode-panel');

    // 01 03 00 00 00 02 C4 0B — CLAUDE.md'deki doğrulanmış Modbus RTU fixture'ı.
    expect(screen.getByRole('textbox')).toHaveValue('01 03 00 00 00 02 C4 0B');
    expect(screen.getByTestId('decode-field-table')).toBeInTheDocument();
    expect(screen.getAllByTestId('decode-field-row').length).toBeGreaterThan(0);
  });

  it.skipIf(PLANNED_PATH === undefined)(
    'keeps the planned notice and the placeholder frame when no plugin is bound',
    () => {
      renderAt(`/${PLANNED_PATH as string}?tab=decode`);

      expect(screen.getByText(translations.tr['protocol.plannedNotice'])).toBeInTheDocument();
      // Sabit örnek çerçeve YALNIZ bu dalda kalır.
      expect(screen.getByTestId('byte-viewer')).toHaveTextContent('AA 05 10 03 34 12 7F 4F 55');
      expect(screen.queryByTestId('decode-panel')).not.toBeInTheDocument();
    },
  );

  it('leaves the other tabs of a plugged protocol untouched', () => {
    renderAt(`/${PLUGGED_PATH}?tab=timing`);

    expect(screen.getByText(translations.tr['protocol.plannedNotice'])).toBeInTheDocument();
    expect(screen.queryByTestId('decode-panel')).not.toBeInTheDocument();
    expect(screen.queryByTestId('byte-viewer')).not.toBeInTheDocument();
  });
});

/** `calculatorIds` taşıyan tek kayıt (karar 6, VERİLDİ: b). */
const CALCULATOR_LINKED_PATH = 'wireless-iot/lora-lpwan/lora';

describe('ProtocolPage calculator links', () => {
  it('links to the tools in calculatorIds from the timing tab', () => {
    renderAt(`/${CALCULATOR_LINKED_PATH}?tab=timing`);

    expect(screen.getByText(translations.tr['protocol.relatedCalculators'])).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: translations.tr['calc.loraAirtime.name'] }),
    ).toHaveAttribute('href', '/calculators/lora-airtime');
    expect(
      screen.getByRole('link', { name: translations.tr['calc.loraLinkBudget.name'] }),
    ).toHaveAttribute('href', '/calculators/lora-link-budget');
    expect(
      screen.getByRole('link', { name: translations.tr['calc.loraBattery.name'] }),
    ).toHaveAttribute('href', '/calculators/lora-battery');
  });

  it('keeps other tabs free of calculator links', () => {
    renderAt(`/${CALCULATOR_LINKED_PATH}?tab=diagnostics`);

    expect(screen.queryByText(translations.tr['protocol.relatedCalculators'])).not.toBeInTheDocument();
  });

  it('shows no calculator links for a protocol without calculatorIds', () => {
    renderAt(`/${PLUGGED_PATH}?tab=timing`);

    expect(screen.queryByText(translations.tr['protocol.relatedCalculators'])).not.toBeInTheDocument();
  });
});

/** Dashboard'un tek kullanıcısı (Faz 10 dalga 9, karar 6'yla aynı sınıf iş). */
const CELLULAR_DASHBOARD_PATH = 'wireless-iot/cellular-iot/lte-modem-at';

describe('ProtocolPage cellular initialization dashboard', () => {
  it('mounts the dashboard and drops the planned notice on the data tab', async () => {
    renderAt(`/${CELLULAR_DASHBOARD_PATH}?tab=data`);

    expect(await screen.findByTestId('cellular-dashboard')).toBeInTheDocument();
    expect(screen.getByTestId('cellular-dashboard-summary')).toBeInTheDocument();
    expect(screen.queryByText(translations.tr['protocol.plannedNotice'])).not.toBeInTheDocument();
  });

  it('leaves other tabs of the same protocol on the planned path', () => {
    renderAt(`/${CELLULAR_DASHBOARD_PATH}?tab=diagnostics`);

    expect(screen.getByText(translations.tr['protocol.plannedNotice'])).toBeInTheDocument();
    expect(screen.queryByTestId('cellular-dashboard')).not.toBeInTheDocument();
  });

  it('shows no dashboard on the data tab of a different plugged protocol', () => {
    renderAt(`/${PLUGGED_PATH}?tab=data`);

    expect(screen.getByText(translations.tr['protocol.plannedNotice'])).toBeInTheDocument();
    expect(screen.queryByTestId('cellular-dashboard')).not.toBeInTheDocument();
  });
});


/**
 * ── LDF DALGASININ YAPISAL SONUCU ───────────────────────────────────────────
 * `ldf` panelinin gelmesiyle `DefinitionFormat`ın ON İKİ üyesinin de karşılığı
 * oldu; yani `definitions` sekmesinin "planlandı" yedek dalına GERÇEK katalog
 * verisiyle ARTIK ULAŞILAMIYOR. Dokuz e2e tanım turunun "motoru olmayan
 * biçimde panel açılmaz" bekçisi bu yüzden anlamını yitirdi ve "panel biçime
 * göre SEÇİLİYOR mu" testine çevrildi (bkz. `e2e/ldf-definitions.spec.ts`).
 *
 * Yedek dal KODDA DURUYOR ve kapsanmalı. E2E ile kapsanamayacağı için buraya
 * İKİ birim testi kondu; ikisi de KATALOĞU SAHTELEMİYOR — dosyanın kendi giriş
 * notundaki "kataloğu taklit etmek zinciri taklit etmek olur" kuralı geçerli:
 *
 *   1. **Kapsam DEĞİŞMEZİ** — kataloğun kullandığı her biçimin paneli var mı.
 *      Bu, dokuz e2e bekçisinin toplamından GÜÇLÜ: tek bir seçilmiş kaydı
 *      değil, `DEFINITION_FORMATS`ın hepsini ve `definitions` sekmesi taşıyan
 *      44 kaydın hepsini ölçüyor. Yeni bir biçim panelsiz eklenirse KIRILIR.
 *   2. **Çözüm MANTIĞI** — `resolveDefinitionPanel` saf bir işlev olarak
 *      `undefined` dönebiliyor mu. Yedek dalın kapısı budur; sahte bir katalog
 *      kaydı uydurmadan doğrudan sınanıyor.
 */
describe('ProtocolPage definition panel resolution', () => {
  it('covers every definition format the catalog actually uses', () => {
    const used = new Set(
      allEntries().flatMap((entry) => entry.protocol.definitions ?? []),
    );
    expect(used.size).toBeGreaterThan(0);

    const uncovered = [...used].filter((format) => !hasDefinitionPanel(format));
    expect(uncovered, `panelsiz biçim(ler): ${uncovered.join(', ')}`).toEqual([]);
  });

  it('covers every declared definition format, not only the used ones', () => {
    // LDF dalgasından itibaren bu daha güçlü iddia da tutuyor. Tutmadığı gün
    // yedek dal yeniden erişilebilir demektir ve e2e bekçisi geri gelebilir.
    const uncovered = DEFINITION_FORMATS.filter((format) => !hasDefinitionPanel(format));
    expect(uncovered, `panelsiz biçim(ler): ${uncovered.join(', ')}`).toEqual([]);
  });

  it('leaves no record with a definitions tab but an empty format list', () => {
    // `protocol.definitions` opsiyoneldir; boş bırakılan bir kayıt da yedek
    // dala düşerdi. Bugün böyle bir kayıt YOK — değişirse burada görülür.
    const empty = allEntries().filter(
      (entry) =>
        entry.protocol.tabs.includes('definitions') &&
        (entry.protocol.definitions === undefined || entry.protocol.definitions.length === 0),
    );
    expect(empty.map((entry) => entry.path)).toEqual([]);
  });

  it('returns undefined for an empty or absent format list — the planned branch gate', () => {
    expect(resolveDefinitionPanel(undefined)).toBeUndefined();
    expect(resolveDefinitionPanel([])).toBeUndefined();
  });

  it('picks the FIRST format that has a panel', () => {
    // `marine-j1939`in `['dbc', 'custom-schema']`ı gibi çok biçimli kayıtlar.
    const first = resolveDefinitionPanel(['dbc', 'custom-schema']);
    const dbcOnly = resolveDefinitionPanel(['dbc']);
    expect(first).toBe(dbcOnly);
    expect(first).not.toBe(resolveDefinitionPanel(['custom-schema']));
  });

  it('mounts the LDF panel on the LIN definitions tab', async () => {
    renderAt('/automotive/vehicle-network-protocols/lin?tab=definitions');

    expect(await screen.findByTestId('ldf-panel')).toBeInTheDocument();
    expect(screen.queryByText(translations.tr['protocol.plannedNotice'])).not.toBeInTheDocument();
  });
});
