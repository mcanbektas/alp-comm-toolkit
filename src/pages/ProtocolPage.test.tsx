import { render, screen } from '@testing-library/react';
import type { RenderResult } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';

import { LANGUAGE_STORAGE_KEY, LanguageProvider } from '@/app/providers/LanguageProvider';
import { registerBuiltInProtocols } from '@/protocols';
import { translations } from '@/translations';

import { ProtocolPage } from './ProtocolPage';

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
/** Motoru olmayan ama `decode` sekmesi olan kayıt. */
// Motoru OLMAYAN bir kayıt gerek. Zincir: uart (dalga 11e'de `ready` oldu) →
// microwire (dalga 11 #11'de `ready` oldu) → flexray. FlexRay seçildi çünkü
// interfaces-framing dalgası bitti, otomotiv ailesindeki bu kayıt kardeşi
// (`can`/`lin`) `ready` olduğu hâlde HENÜZ inşa edilmemiş tek üye — yani
// yakın bir dalgada `ready` olma sırası yok. O da bağlanınca başka bir
// planned kayda taşı (`status: 'planned'` olan 82 kayıttan `decode` sekmesi
// olan herhangi biri iş görür).
// `flexray` dalga 14e'de `ready` oldu ve motora bağlandı; bu test EKLENTİSİZ
// bir kayda ihtiyaç duyuyor. Automotive'in kalan `planned` kayıtları 14f-14h'de
// kapanacağı için fixture DOMAIN DIŞINA taşındı — aksi hâlde aynı test iki alt
// dalga sonra yine kırılırdı.
const PLANNED_PATH = 'marine-navigation/legacy-proprietary-marine/seatalk';

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

  it('keeps the planned notice and the placeholder frame when no plugin is bound', () => {
    renderAt(`/${PLANNED_PATH}?tab=decode`);

    expect(screen.getByText(translations.tr['protocol.plannedNotice'])).toBeInTheDocument();
    // Sabit örnek çerçeve YALNIZ bu dalda kalır.
    expect(screen.getByTestId('byte-viewer')).toHaveTextContent('AA 05 10 03 34 12 7F 4F 55');
    expect(screen.queryByTestId('decode-panel')).not.toBeInTheDocument();
  });

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
