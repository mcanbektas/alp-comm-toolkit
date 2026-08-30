import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { translations } from '../src/translations/all';

/**
 * `Definitions` sekmesindeki DSDL panelinin tarayıcı turu.
 *
 * Kanıtladığı şey: katalog kaydının "DSDL alanları bit-packed'dir ve byte
 * hizası garanti değildir" notu artık ekranda karşılığını buluyor — bayt
 * hizasına oturmayan iki `uint4` ayrı ayrı çözülüyor ve konumu telin
 * içeriğine bağlı alanlarda panel çözüm kutusu açmıyor.
 */

const tr = translations.tr;

const DRONECAN_PATH = '/comm/aerospace-uav/distributed-uav-networks/dronecan?tab=definitions';
const CYPHAL_PATH = '/comm/aerospace-uav/distributed-uav-networks/cyphal?tab=definitions';
/** Regresyon bekçisi: LIN `definitions: ['ldf']` taşır ve LDF motoru YOK. */
const NON_DSDL_PATH = '/comm/automotive/vehicle-network-protocols/lin?tab=definitions';

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

async function openDsdlPanel(page: Page, path: string): Promise<string[]> {
  const consoleErrors = await openPage(page, path);
  await expect(page.getByTestId('dsdl-panel')).toBeVisible();
  return consoleErrors;
}

function fieldRow(page: Page, name: string): Locator {
  return page.locator(`[data-testid="dsdl-field-row"][data-field="${name}"]`);
}

/** Seçim kimliği `bölüm:sıra:ad` — ayrıştırıcının verdiği sırayla. */
async function selectField(page: Page, key: string): Promise<void> {
  await page.getByLabel(tr['definition.dsdl.field.label'], { exact: true }).selectOption(key);
}

async function horizontalOverflow(page: Page): Promise<number> {
  return page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
}

test('definitions sekmesi DSDL paneliyle açılır ve konsola hata basmaz', async ({ page }) => {
  const consoleErrors = await openDsdlPanel(page, DRONECAN_PATH);

  await expect(page.getByText(tr['protocol.plannedNotice'])).toHaveCount(0);
  await expect(page.getByTestId('dsdl-load-failed')).toHaveCount(0);
  expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
});

test('ekran BOŞ açılmaz: örnek tanım yüklü gelir', async ({ page }) => {
  await openDsdlPanel(page, DRONECAN_PATH);

  await expect(page.getByTestId('dsdl-sample-notice')).toBeVisible();
  await expect(page.getByTestId('dsdl-kind')).toHaveText(tr['definition.dsdl.kind.message']);
  await expect(page.getByTestId('dsdl-field-count')).toHaveText('8');
  await expect(page.getByTestId('dsdl-directive')).toHaveText('@sealed');
});

test('alan tablosu bit yerleşimini gösterir; void dolgusu ADSIZ görünür', async ({ page }) => {
  await openDsdlPanel(page, DRONECAN_PATH);

  await expect(fieldRow(page, 'sequence')).toContainText('0+16 bit');
  // Bayt hizasına oturmayan iki dörtlük.
  await expect(fieldRow(page, 'mode')).toContainText('16+4 bit');
  await expect(fieldRow(page, 'health')).toContainText('20+4 bit');
  await expect(fieldRow(page, 'void')).toContainText('73+7 bit');
});

test('sabitler alanlardan ayrı listelenir', async ({ page }) => {
  await openDsdlPanel(page, DRONECAN_PATH);

  const constants = page.getByTestId('dsdl-constant');
  await expect(constants).toHaveCount(2);
  await expect(constants.first()).toHaveText('MODE_STANDBY = 0');
});

test('bit-packed alanları çözer: 1234 / 1 / 2 / 300 / 50 / true', async ({ page }) => {
  await openDsdlPanel(page, DRONECAN_PATH);

  // Varsayılan seçim ilk çözülebilir alan.
  await expect(page.getByTestId('dsdl-value')).toHaveText('1234');

  await selectField(page, '0:1:mode');
  await expect(page.getByTestId('dsdl-value')).toHaveText('1');

  await selectField(page, '0:2:health');
  await expect(page.getByTestId('dsdl-value')).toHaveText('2');

  await selectField(page, '0:3:temperature_deci');
  await expect(page.getByTestId('dsdl-value')).toHaveText('300');

  await selectField(page, '0:4:voltage');
  await expect(page.getByTestId('dsdl-value')).toHaveText('50');

  await selectField(page, '0:5:armed');
  await expect(page.getByTestId('dsdl-value')).toHaveText('true');
});

test('konumu telin içeriğine bağlı alanda çözüm kutusu AÇILMAZ', async ({ page }) => {
  await openDsdlPanel(page, DRONECAN_PATH);

  await selectField(page, '0:7:payload');
  await expect(page.getByTestId('dsdl-hex')).toHaveCount(0);
  await expect(page.getByTestId('dsdl-no-layout')).toBeVisible();
});

test('geçersiz hex hata basar', async ({ page }) => {
  await openDsdlPanel(page, DRONECAN_PATH);

  await page.locator('#dsdl-hex').fill('D2 ZZ');
  const hexError = page.getByTestId('dsdl-hex-error');
  await expect(hexError).toBeVisible();
  await expect(hexError).toHaveText(tr['decode.error.invalidHex']);
  await expect(page.getByTestId('dsdl-decoded')).toHaveCount(0);
});

test('Cyphal sayfasında da aynı panel açılır', async ({ page }) => {
  const consoleErrors = await openDsdlPanel(page, CYPHAL_PATH);

  await expect(page.getByTestId('dsdl-field-count')).toHaveText('8');
  await expect(page.getByText(tr['protocol.plannedNotice'])).toHaveCount(0);
  expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
});

test('motoru olmayan biçimde panel AÇILMAZ, "planlandı" bildirimi durur', async ({ page }) => {
  await openPage(page, NON_DSDL_PATH);

  await expect(page.getByTestId('dsdl-panel')).toHaveCount(0);
  await expect(page.getByText(tr['protocol.plannedNotice'])).toBeVisible();
});

test('1440 ve 390 pikselde yatay taşma yok', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openDsdlPanel(page, DRONECAN_PATH);
  await expect(page.getByTestId('dsdl-field-table')).toBeVisible();
  expect(await horizontalOverflow(page), 'sayfa 1440px genişlikte yatayda taşıyor').toBeLessThanOrEqual(0);

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByTestId('dsdl-field-table')).toBeVisible();
  expect(await horizontalOverflow(page), 'sayfa 390px genişlikte yatayda taşıyor').toBeLessThanOrEqual(0);
});
