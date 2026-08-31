import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { translations } from '../src/translations/all';

/**
 * Faz 10 dalga 1c'nin gerçek tarayıcı turu — `Definitions` sekmesindeki EDS
 * paneli.
 *
 * Kanıtladığı şey: kullanıcı `?tab=definitions` adresine gittiğinde EDS
 * motorunun GERÇEKTEN indirildiği ve dalga 1b'nin (CANopen) ham bıraktığı
 * içeriğin — Controlword yazma değeri, PDO'nun Statusword/Velocity ikilisi —
 * burada gerçekten çözüldüğüdür.
 */

const tr = translations.tr;

const CANONICAL_DEFINITIONS_PATH =
  '/comm/industrial-automation/cip-can-based/canopen?tab=definitions';
const ALIAS_DEFINITIONS_PATH =
  '/comm/automotive/vehicle-network-protocols/canopen?tab=definitions';
/**
 * Regresyon bekçisi: LIN `definitions: ['ldf']` taşır — yani BAŞKA bir biçim.
 * LDF dalgasına kadar burası "motoru olmayan biçim" örneğiydi ve "planlandı"
 * bildirimini kanıtlardı; LDF motoru gelince katalogda motorsuz biçim KALMADI,
 * bekçi de "panel biçime göre SEÇİLİYOR mu" testine çevrildi. Tam gerekçe:
 * `e2e/ldf-definitions.spec.ts`. Erişilemez hâle gelen "planlandı" yedek dalı
 * `src/pages/ProtocolPage.test.tsx`te birim testiyle kapsanıyor.
 */
const NON_EDS_DEFINITIONS_PATH = '/comm/automotive/vehicle-network-protocols/lin?tab=definitions';

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

async function openEdsPanel(page: Page, path: string): Promise<string[]> {
  const consoleErrors = await openPage(page, path);
  await expect(page.getByTestId('eds-panel')).toBeVisible();
  return consoleErrors;
}

function objectRow(page: Page, index: number, subIndex: string | undefined = undefined): Locator {
  return page.locator(`[data-testid="eds-object-row"][data-object-key="${String(index)}-${String(subIndex)}"]`);
}

async function horizontalOverflow(page: Page): Promise<number> {
  return page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
}

/** Hiçbir uyarı satırı ham çeviri anahtarı basmamalı (dalga 1'de görülen kusur). */
async function expectNoRawTranslationKeys(page: Page): Promise<void> {
  for (const metin of await page.getByTestId('eds-issue').allTextContents()) {
    expect(metin.trim(), 'eds-issue çevrilmemiş anahtar basıyor').not.toMatch(
      /^[a-z][a-zA-Z0-9]*(\.[a-zA-Z0-9]+)+$/,
    );
  }
}

test('definitions sekmesi EDS paneliyle açılır ve konsola hata basmaz', async ({ page }) => {
  const consoleErrors = await openEdsPanel(page, CANONICAL_DEFINITIONS_PATH);

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('CANopen');
  await expect(page.getByText(tr['protocol.plannedNotice'])).toHaveCount(0);
  await expect(page.getByTestId('eds-load-failed')).toHaveCount(0);

  expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
});

test('ekran BOŞ açılmaz: örnek tanım yüklü gelir ve özetini basar', async ({ page }) => {
  await openEdsPanel(page, CANONICAL_DEFINITIONS_PATH);

  await expect(page.getByTestId('eds-sample-notice')).toBeVisible();
  await expect(page.getByTestId('eds-file-name')).toHaveText('SAMPLE.eds');
  await expect(page.getByTestId('eds-vendor-product')).toHaveText('ALP Comm Toolkit / Sample Servo Drive');
  await expect(page.getByTestId('eds-object-count')).toHaveText('5');
  await expect(page.getByTestId('eds-issue')).toHaveCount(0);
});

test('Object Dictionary tablosu beş nesneyi alan alan basar', async ({ page }) => {
  await openEdsPanel(page, CANONICAL_DEFINITIONS_PATH);

  await expect(page.getByTestId('eds-object-row')).toHaveCount(5);
  await expect(objectRow(page, 0x1000)).toContainText('Device Type');
  await expect(objectRow(page, 0x1000)).toContainText('UNSIGNED32');
  await expect(objectRow(page, 0x6040)).toContainText('Controlword');
  await expect(objectRow(page, 0x6040)).toContainText(tr['common.yes']); // PDO Mapping
  await expectNoRawTranslationKeys(page);
});

test('Controlword yazma değerini çözer — dalga 1b’nin (CANopen) ham bıraktığı SDO verisi', async ({
  page,
}) => {
  await openEdsPanel(page, CANONICAL_DEFINITIONS_PATH);

  await page.getByLabel(tr['definition.eds.object.label']).selectOption('24640-undefined');
  await page.locator('#eds-decode-hex').fill('0F 00');

  const decoded = page.getByTestId('eds-decoded-value');
  await expect(decoded.getByTestId('eds-decoded-raw')).toHaveText('15');
  await expect(decoded).toContainText('UNSIGNED16');
});

test('PDO’nun Statusword/Velocity ikilisini çözer (spec özet 04:102: 37 12 DC 05)', async ({
  page,
}) => {
  await openEdsPanel(page, CANONICAL_DEFINITIONS_PATH);

  await page.getByLabel(tr['definition.eds.object.label']).selectOption('24641-undefined');
  await page.locator('#eds-decode-hex').fill('37 12');
  await expect(page.getByTestId('eds-decoded-raw')).toHaveText('4663'); // 0x1237

  await page.getByLabel(tr['definition.eds.object.label']).selectOption('24644-undefined');
  await page.locator('#eds-decode-hex').fill('DC 05');
  await expect(page.getByTestId('eds-decoded-raw')).toHaveText('1500');
});

test('geçersiz hex hata basar', async ({ page }) => {
  await openEdsPanel(page, CANONICAL_DEFINITIONS_PATH);

  await page.locator('#eds-decode-hex').fill('92 ZZ');
  const hexError = page.getByTestId('eds-hex-error');
  await expect(hexError).toBeVisible();
  await expect(hexError).toHaveText(tr['decode.error.invalidHex']);
  await expect(page.getByTestId('eds-decoded-value')).toHaveCount(0);
});

test('alias sayfası da EDS panelini açar', async ({ page }) => {
  const consoleErrors = await openEdsPanel(page, ALIAS_DEFINITIONS_PATH);

  await expect(page.getByTestId('eds-object-count')).toHaveText('5');
  await expect(page.getByText(tr['protocol.plannedNotice'])).toHaveCount(0);
  expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
});

test('LIN kaydında bu panel AÇILMAZ, kaydın KENDİ biçimi olan LDF paneli açılır', async ({ page }) => {
  await openPage(page, NON_EDS_DEFINITIONS_PATH);

  // Panel tanım biçimine bağlıdır, sekmenin varlığına değil: LIN yalnız
  // `ldf` sayıyor, o yüzden bu biçimin paneli açılmamalı ve LDF paneli açılmalı.
  await expect(page.getByTestId('eds-panel')).toHaveCount(0);
  await expect(page.getByTestId('dbc-panel')).toHaveCount(0);
  await expect(page.getByTestId('ldf-panel')).toBeVisible();
  await expect(page.getByText(tr['protocol.plannedNotice'])).toHaveCount(0);
});

test('1440 ve 390 pikselde yatay taşma yok', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openEdsPanel(page, CANONICAL_DEFINITIONS_PATH);
  await expect(page.getByTestId('eds-object-table')).toBeVisible();
  expect(await horizontalOverflow(page), 'sayfa 1440px genişlikte yatayda taşıyor').toBeLessThanOrEqual(0);

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByTestId('eds-object-table')).toBeVisible();
  expect(await horizontalOverflow(page), 'sayfa 390px genişlikte yatayda taşıyor').toBeLessThanOrEqual(0);
});
