import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { translations } from '../src/translations/all';

/**
 * Faz 9 dalga 3b'nin gerçek tarayıcı turu — `Definitions` sekmesindeki DBC paneli.
 *
 * Birim testler DBC motorunu saf TypeScript olarak koşturuyor; bu dosyanın
 * kanıtladığı şey kullanıcı `?tab=definitions` adresine gittiğinde motorun
 * GERÇEKTEN indirildiği, örnek tanımın ekranda çözüldüğü ve spec §17.4'ün
 * `Physical = Raw × Factor + Offset` formülünün ekrana yansıdığıdır.
 */

const tr = translations.tr;

const CAN_DEFINITIONS_PATH = '/comm/automotive/can-family/can-2-0a?tab=definitions';
/** Marine J1939 bir ALIAS kaydıdır ama `definitions: ['dbc', 'custom-schema']` taşır. */
const ALIAS_DEFINITIONS_PATH =
  '/comm/marine-navigation/marine-machinery/marine-j1939?tab=definitions';
/**
 * Regresyon bekçisi: LIN `definitions: ['ldf']` taşır — yani BAŞKA bir biçim.
 * LDF dalgasına kadar burası "motoru olmayan biçim" örneğiydi ve "planlandı"
 * bildirimini kanıtlardı; LDF motoru gelince katalogda motorsuz biçim KALMADI,
 * bekçi de "panel biçime göre SEÇİLİYOR mu" testine çevrildi. Tam gerekçe:
 * `e2e/ldf-definitions.spec.ts`. Erişilemez hâle gelen "planlandı" yedek dalı
 * `src/pages/ProtocolPage.test.tsx`te birim testiyle kapsanıyor.
 */
const NON_DBC_DEFINITIONS_PATH = '/comm/automotive/vehicle-network-protocols/lin?tab=definitions';

async function openPage(page: Page, path: string): Promise<string[]> {
  const consoleErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => consoleErrors.push(error.message));

  await page.addInitScript(() => {
    window.localStorage.setItem('alp-comm-lang', 'tr');
  });

  await page.goto(path);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  return consoleErrors;
}

async function openDbcPanel(page: Page, path: string): Promise<string[]> {
  const consoleErrors = await openPage(page, path);
  await expect(page.getByTestId('dbc-panel')).toBeVisible();
  return consoleErrors;
}

function signalRow(page: Page, name: string): Locator {
  return page.locator(`[data-testid="dbc-signal-row"][data-signal-name="${name}"]`);
}

function decodedRow(page: Page, name: string): Locator {
  return page.locator(`[data-testid="dbc-decoded-row"][data-signal-name="${name}"]`);
}

async function horizontalOverflow(page: Page): Promise<number> {
  return page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
}

/** Hiçbir uyarı satırı ham çeviri anahtarı basmamalı (dalga 1'de görülen kusur). */
async function expectNoRawTranslationKeys(page: Page): Promise<void> {
  for (const metin of await page.getByTestId('dbc-issue').allTextContents()) {
    expect(metin.trim(), 'dbc-issue çevrilmemiş anahtar basıyor').not.toMatch(
      /^[a-z][a-zA-Z0-9]*(\.[a-zA-Z0-9]+)+$/,
    );
  }
}

test('definitions sekmesi DBC paneliyle açılır ve konsola hata basmaz', async ({ page }) => {
  const consoleErrors = await openDbcPanel(page, CAN_DEFINITIONS_PATH);

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('CAN 2.0A');
  // Motoru olan sekmede "planlandı" bildirimi kalmamalı.
  await expect(page.getByText(tr['protocol.plannedNotice'])).toHaveCount(0);
  await expect(page.getByTestId('dbc-load-failed')).toHaveCount(0);

  expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
});

test('ekran BOŞ açılmaz: örnek tanım yüklü gelir ve özetini basar', async ({ page }) => {
  await openDbcPanel(page, CAN_DEFINITIONS_PATH);

  await expect(page.getByTestId('dbc-sample-notice')).toBeVisible();
  await expect(page.getByTestId('dbc-version')).toHaveText('1.0');
  await expect(page.getByTestId('dbc-message-count')).toHaveText('3');
  await expect(page.getByTestId('dbc-nodes')).toHaveText('Gateway, Engine, Dashboard');
  // Örnek dosya hiçbir uyarı üretmemeli.
  await expect(page.getByTestId('dbc-issue')).toHaveCount(0);
});

test('sinyal tablosu tanımı alan alan basar', async ({ page }) => {
  await openDbcPanel(page, CAN_DEFINITIONS_PATH);

  await expect(page.getByTestId('dbc-signal-row')).toHaveCount(3);
  const speed = signalRow(page, 'EngineSpeed');
  await expect(speed).toContainText('Intel @1');
  await expect(speed).toContainText('0.125 / 0');
  await expect(speed).toContainText('rpm');

  // İşaretli sinyal ve negatif offset görünür olmalı.
  await expect(signalRow(page, 'Torque')).toContainText(tr['common.yes']);
  await expect(signalRow(page, 'CoolantTemp')).toContainText('1 / -40');
  await expectNoRawTranslationKeys(page);
});

test('örnek çerçeve spec §17.4 formülüyle çözülür', async ({ page }) => {
  await openDbcPanel(page, CAN_DEFINITIONS_PATH);

  // E8 03 → 1000 ham; 1000 × 0.125 + 0 = 125 rpm.
  await expect(decodedRow(page, 'EngineSpeed').getByTestId('dbc-decoded-physical')).toHaveText(
    '125 rpm',
  );
  // 0x5A = 90 ham; 90 × 1 + (-40) = 50 degC.
  await expect(decodedRow(page, 'CoolantTemp').getByTestId('dbc-decoded-physical')).toHaveText(
    '50 degC',
  );
  await expect(decodedRow(page, 'Torque').getByTestId('dbc-decoded-physical')).toHaveText(
    '10000 Nm',
  );
});

test('VAL_ tablosundaki karşılık etiket sütununda görünür', async ({ page }) => {
  await openDbcPanel(page, CAN_DEFINITIONS_PATH);

  await page.locator('#dbc-sample-hex').fill('00 00 00 00 00 00 00 00');
  // CoolantTemp ham 0 → tabloda "Sensor error".
  await expect(decodedRow(page, 'CoolantTemp')).toContainText('Sensor error');
});

test('Motorola sinyali big-endian çözülür — Intel’den FARKLI değer', async ({ page }) => {
  await openDbcPanel(page, CAN_DEFINITIONS_PATH);

  // Extended mesaj: ResponseCode 7|16@0+ (Motorola).
  await page.getByLabel(tr['definition.dbc.message.label']).selectOption({ index: 1 });
  await expect(signalRow(page, 'ResponseCode')).toContainText('Motorola @0');

  await page.locator('#dbc-sample-hex').fill('12 34 00 00 00 00 00 00');
  // Big-endian: 0x1234 = 4660. Intel okunsaydı 0x3412 = 13330 çıkardı.
  await expect(decodedRow(page, 'ResponseCode').getByTestId('dbc-decoded-physical')).toHaveText(
    '4660',
  );
});

test('çoklama: anahtar değiştikçe AYNI bitler başka sinyal olarak çözülür', async ({ page }) => {
  await openDbcPanel(page, CAN_DEFINITIONS_PATH);

  await page.getByLabel(tr['definition.dbc.message.label']).selectOption({ index: 2 });
  await expect(signalRow(page, 'Selector')).toContainText('M');

  // Anahtar 0 → yalnız TempA.
  await page.locator('#dbc-sample-hex').fill('00 E8 03 00 00 00 00 00');
  await expect(page.getByTestId('dbc-decoded-row')).toHaveCount(2);
  await expect(decodedRow(page, 'TempA').getByTestId('dbc-decoded-physical')).toHaveText(
    '100 degC',
  );
  await expect(decodedRow(page, 'VoltB')).toHaveCount(0);

  // Anahtar 1 → AYNI baytlar, bu kez VoltB.
  await page.locator('#dbc-sample-hex').fill('01 E8 03 00 00 00 00 00');
  await expect(decodedRow(page, 'VoltB').getByTestId('dbc-decoded-physical')).toHaveText('1 V');
  await expect(decodedRow(page, 'TempA')).toHaveCount(0);
});

test('geçersiz hex hata basar ve çözümleme tablosunu kaldırır', async ({ page }) => {
  await openDbcPanel(page, CAN_DEFINITIONS_PATH);

  await page.locator('#dbc-sample-hex').fill('E8 ZZ 00');
  const hexError = page.getByTestId('dbc-hex-error');
  await expect(hexError).toBeVisible();
  await expect(hexError).toHaveText(tr['decode.error.invalidHex']);
  await expect(page.getByTestId('dbc-decoded-table')).toHaveCount(0);
  // Sinyal TANIMI tablosu kalır: tanım girdiye bağlı değil.
  await expect(page.getByTestId('dbc-signal-table')).toBeVisible();

  await page.locator('#dbc-sample-hex').fill('E8 03 5A 10 27 00 00 00');
  await expect(hexError).toHaveCount(0);
  await expect(page.getByTestId('dbc-decoded-row')).toHaveCount(3);
});

test('kısa çerçevede sığmayan sinyaller sessizce düşer', async ({ page }) => {
  await openDbcPanel(page, CAN_DEFINITIONS_PATH);

  await page.locator('#dbc-sample-hex').fill('E8 03');
  // DBC 8 bayt der, elde 2 bayt var: yalnız sığan sinyal çözülür.
  await expect(page.getByTestId('dbc-decoded-row')).toHaveCount(1);
  await expect(decodedRow(page, 'EngineSpeed')).toHaveCount(1);
});

test('dışa aktarma düğmesi etkin ve içe aktarma girdisi var', async ({ page }) => {
  await openDbcPanel(page, CAN_DEFINITIONS_PATH);

  await expect(page.getByTestId('dbc-import')).toBeVisible();
  await expect(page.getByTestId('dbc-export')).toBeEnabled();
});

test('alias sayfası da DBC panelini açar', async ({ page }) => {
  const consoleErrors = await openDbcPanel(page, ALIAS_DEFINITIONS_PATH);

  await expect(page.getByTestId('dbc-message-count')).toHaveText('3');
  await expect(page.getByText(tr['protocol.plannedNotice'])).toHaveCount(0);
  expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
});

test('LIN kaydında bu panel AÇILMAZ, kaydın KENDİ biçimi olan LDF paneli açılır', async ({ page }) => {
  await openPage(page, NON_DBC_DEFINITIONS_PATH);

  // Panel tanım biçimine bağlıdır, sekmenin varlığına değil: LIN yalnız
  // `ldf` sayıyor, o yüzden bu biçimin paneli açılmamalı ve LDF paneli açılmalı.
  await expect(page.getByTestId('dbc-panel')).toHaveCount(0);
  await expect(page.getByTestId('ldf-panel')).toBeVisible();
  await expect(page.getByText(tr['protocol.plannedNotice'])).toHaveCount(0);
});

test('1440 ve 390 pikselde yatay taşma yok', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openDbcPanel(page, CAN_DEFINITIONS_PATH);
  await expect(page.getByTestId('dbc-signal-table')).toBeVisible();
  expect(await horizontalOverflow(page), 'sayfa 1440px genişlikte yatayda taşıyor').toBeLessThanOrEqual(
    0,
  );

  // Sinyal tablosu `min-w-[48rem]` taşıyor: dar ekranda KENDİ kabında kaymalı.
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByTestId('dbc-signal-table')).toBeVisible();
  expect(await horizontalOverflow(page), 'sayfa 390px genişlikte yatayda taşıyor').toBeLessThanOrEqual(
    0,
  );
});
