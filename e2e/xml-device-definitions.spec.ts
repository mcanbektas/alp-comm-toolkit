import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { translations } from '../src/translations';

/**
 * `Definitions` sekmesindeki XML AYGIT TANIMI panelinin tarayıcı turu —
 * GSDML, IODD ve SCL aynı panelden açılıyor.
 *
 * Kanıtladığı şey: üç ayrı standart tek tabloya iniyor, IODD süreç verisi
 * gerçekten çözülüyor (bit ofsetinin yönü çevrilmiş olarak), ve bayt
 * yerleşimi OLMAYAN SCL kalemlerinde panel çözüm kutusu açmak yerine nedenini
 * yazıyor.
 */

const tr = translations.tr;

const PROFINET_PATH = '/comm/industrial-automation/industrial-ethernet/profinet?tab=definitions';
const IO_LINK_PATH = '/comm/industrial-automation/sensors-device-integration/io-link?tab=definitions';
const IEC_61850_PATH = '/comm/industrial-automation/scada-utility/iec-61850?tab=definitions';
/** Regresyon bekçisi: LIN `definitions: ['ldf']` taşır ve LDF motoru YOK. */
const NON_XML_PATH = '/comm/automotive/vehicle-network-protocols/lin?tab=definitions';

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

async function openXmlPanel(page: Page, path: string): Promise<string[]> {
  const consoleErrors = await openPage(page, path);
  await expect(page.getByTestId('xml-device-panel')).toBeVisible();
  return consoleErrors;
}

function row(page: Page, id: string): Locator {
  return page.locator(`[data-testid="xml-device-row"][data-item-id="${id}"]`);
}

async function selectItem(page: Page, id: string): Promise<void> {
  await page.getByLabel(tr['definition.xmlDevice.item.label'], { exact: true }).selectOption(id);
}

async function horizontalOverflow(page: Page): Promise<number> {
  return page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
}

test('PROFINET sayfası GSDML örneğiyle açılır ve konsola hata basmaz', async ({ page }) => {
  const consoleErrors = await openXmlPanel(page, PROFINET_PATH);

  await expect(page.getByTestId('xml-device-format')).toHaveText('GSDML');
  await expect(page.getByTestId('xml-device-device')).toHaveText('ALP IO Module 8DI');
  await expect(page.getByText(tr['protocol.plannedNotice'])).toHaveCount(0);
  expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
});

test('GSDML parametre kalemlerini metin listesinden çözülen adlarıyla basar', async ({ page }) => {
  await openXmlPanel(page, PROFINET_PATH);

  await expect(page.getByTestId('xml-device-row')).toHaveCount(2);
  await expect(row(page, '100/P1')).toContainText('Input filter time');
  await expect(row(page, '100/P1')).toContainText('Unsigned16');
  await expect(row(page, '100/P2')).toContainText('Measuring range');
});

test('IO-Link sayfası IODD örneğiyle açılır ve süreç verisini listeler', async ({ page }) => {
  const consoleErrors = await openXmlPanel(page, IO_LINK_PATH);

  await expect(page.getByTestId('xml-device-format')).toHaveText('IODD');
  await expect(page.getByTestId('xml-device-vendor')).toHaveText('ALP Comm Toolkit');
  await expect(page.getByTestId('xml-device-item-count')).toHaveText('4');
  await expect(row(page, 'ProcessDataIn.1')).toContainText('Process pressure');
  expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
});

test('IODD süreç verisini çözer: 04 D2 EC 01 → 1234 / −20 / true', async ({ page }) => {
  await openXmlPanel(page, IO_LINK_PATH);

  // Varsayılan seçim ilk çözülebilir kalem: basınç.
  await expect(page.getByTestId('xml-device-value')).toHaveText('1234');

  await selectItem(page, 'ProcessDataIn.2');
  await expect(page.getByTestId('xml-device-value')).toHaveText('-20');

  await selectItem(page, 'ProcessDataIn.3');
  await expect(page.getByTestId('xml-device-value')).toHaveText('true');
});

test('IODD parametresinde sözel karşılık basılır (0 → Standard)', async ({ page }) => {
  await openXmlPanel(page, IO_LINK_PATH);

  await selectItem(page, '64');
  await page.locator('#xml-device-hex').fill('00');
  await expect(page.getByTestId('xml-device-value')).toHaveText('Standard');
});

test('geçersiz hex hata basar', async ({ page }) => {
  await openXmlPanel(page, IO_LINK_PATH);

  await page.locator('#xml-device-hex').fill('04 ZZ');
  const hexError = page.getByTestId('xml-device-hex-error');
  await expect(hexError).toBeVisible();
  await expect(hexError).toHaveText(tr['decode.error.invalidHex']);
  await expect(page.getByTestId('xml-device-decoded')).toHaveCount(0);
});

test('IEC 61850 sayfası SCL örneğiyle açılır; çözüm kutusu AÇILMAZ', async ({ page }) => {
  const consoleErrors = await openXmlPanel(page, IEC_61850_PATH);

  await expect(page.getByTestId('xml-device-format')).toHaveText('SCL');
  await expect(page.getByTestId('xml-device-device')).toHaveText('ALP_BAY1');
  await expect(row(page, 'PROT/PTOC1.StrVal.setMag')).toContainText('1.20');

  // Bayt yerleşimi olmayan kalemde hex kutusu yerine gerekçe durur.
  await expect(page.getByTestId('xml-device-hex')).toHaveCount(0);
  await expect(page.getByTestId('xml-device-no-layout')).toBeVisible();
  expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
});

test('motoru olmayan biçimde panel AÇILMAZ, "planlandı" bildirimi durur', async ({ page }) => {
  await openPage(page, NON_XML_PATH);

  await expect(page.getByTestId('xml-device-panel')).toHaveCount(0);
  await expect(page.getByText(tr['protocol.plannedNotice'])).toBeVisible();
});

test('1440 ve 390 pikselde yatay taşma yok', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openXmlPanel(page, IO_LINK_PATH);
  await expect(page.getByTestId('xml-device-table')).toBeVisible();
  expect(await horizontalOverflow(page), 'sayfa 1440px genişlikte yatayda taşıyor').toBeLessThanOrEqual(0);

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByTestId('xml-device-table')).toBeVisible();
  expect(await horizontalOverflow(page), 'sayfa 390px genişlikte yatayda taşıyor').toBeLessThanOrEqual(0);
});
