import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { translations } from '../src/translations/all';

/**
 * `Definitions` sekmesindeki ÖZEL ŞEMA panelinin gerçek tarayıcı turu.
 *
 * Kanıtladığı şey: `custom-schema` taşıyan kayıtlarda panel gerçekten
 * indiriliyor, spec §9.6'nın şeması yüklü geliyor ve §43'ün doğrulanmış
 * çerçevesi (`AA 05 10 03 34 12 7F 4F 55`) alan alan çözülüyor — yani sekme
 * artık "planlandı" bildirimi değil, çalışan bir motor gösteriyor.
 *
 * Katalogda `custom-schema` 20 kayıt taşıyor; buradaki iki yol o kümenin iki
 * ayrı domain'inden seçildi, çünkü panelin protokole değil BİÇİME bağlandığını
 * göstermek gerekiyor.
 */

const tr = translations.tr;

const CUSTOM_BINARY_PATH =
  '/comm/interfaces-framing/framing-stream-protocols/custom-binary-protocol?tab=definitions';
const NMEA_PATH = '/comm/marine-navigation/nmea-family/nmea-0183?tab=definitions';
/** Regresyon bekçisi: LIN `definitions: ['ldf']` taşır ve LDF motoru YOK. */
const NON_SCHEMA_PATH = '/comm/automotive/vehicle-network-protocols/lin?tab=definitions';

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

async function openSchemaPanel(page: Page, path: string): Promise<string[]> {
  const consoleErrors = await openPage(page, path);
  await expect(page.getByTestId('schema-panel')).toBeVisible();
  return consoleErrors;
}

function fieldRow(page: Page, fieldId: string): Locator {
  return page.locator(`[data-testid="schema-field-row"][data-field-id="${fieldId}"]`);
}

function decodedRow(page: Page, fieldId: string): Locator {
  return page.locator(`[data-testid="schema-decoded-row"][data-field-id="${fieldId}"]`);
}

async function horizontalOverflow(page: Page): Promise<number> {
  return page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
}

test('definitions sekmesi şema paneliyle açılır ve konsola hata basmaz', async ({ page }) => {
  const consoleErrors = await openSchemaPanel(page, CUSTOM_BINARY_PATH);

  await expect(page.getByText(tr['protocol.plannedNotice'])).toHaveCount(0);
  await expect(page.getByTestId('schema-load-failed')).toHaveCount(0);

  expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
});

test('ekran BOŞ açılmaz: spec §9.6 şeması yüklü gelir ve özetini basar', async ({ page }) => {
  await openSchemaPanel(page, CUSTOM_BINARY_PATH);

  await expect(page.getByTestId('schema-sample-notice')).toBeVisible();
  await expect(page.getByTestId('schema-name')).toHaveText('ALP Sensor Protocol');
  await expect(page.getByTestId('schema-version')).toHaveText('1.0');
  await expect(page.getByTestId('schema-framing')).toHaveText('startEnd');
  await expect(page.getByTestId('schema-field-count')).toHaveText('5');
});

test('alan tablosu beş alanı tipi ve uzunluk kaynağıyla basar', async ({ page }) => {
  await openSchemaPanel(page, CUSTOM_BINARY_PATH);

  await expect(page.getByTestId('schema-field-row')).toHaveCount(5);
  await expect(fieldRow(page, 'address')).toContainText('Device Address');
  await expect(fieldRow(page, 'command')).toContainText('enum');
  // Uzunluğu başka alandan gelen alan: kaynağı hücrede görünür.
  await expect(fieldRow(page, 'payload')).toContainText('payloadLength');
  await expect(fieldRow(page, 'checksum')).toContainText('xor8');
});

test('spec §43 çerçevesini alan alan çözer (AA 05 10 03 34 12 7F 4F 55)', async ({ page }) => {
  await openSchemaPanel(page, CUSTOM_BINARY_PATH);

  await expect(decodedRow(page, 'address')).toContainText('5');
  // enum: ham 16, fiziksel karşılığı §9.6'nın sözlüğünden gelir.
  await expect(decodedRow(page, 'command')).toContainText('Sensor Data');
  await expect(decodedRow(page, 'payloadLength')).toContainText('3');
  await expect(decodedRow(page, 'payload')).toContainText('34 12 7F');
  await expect(page.getByTestId('schema-decode-error')).toHaveCount(0);
});

test('bozuk çerçevede motorun hatası basılır, panel çökmez', async ({ page }) => {
  await openSchemaPanel(page, CUSTOM_BINARY_PATH);

  // Checksum baytı bozuldu: 4F → 4E.
  await page.locator('#schema-decode-hex').fill('AA 05 10 03 34 12 7F 4E 55');
  await expect(page.getByTestId('schema-decode-error')).toBeVisible();
  await expect(page.getByTestId('schema-panel')).toBeVisible();
});

test('geçersiz hex hata basar', async ({ page }) => {
  await openSchemaPanel(page, CUSTOM_BINARY_PATH);

  await page.locator('#schema-decode-hex').fill('AA ZZ');
  const hexError = page.getByTestId('schema-hex-error');
  await expect(hexError).toBeVisible();
  await expect(hexError).toHaveText(tr['decode.error.invalidHex']);
  await expect(page.getByTestId('schema-decoded-table')).toHaveCount(0);
});

test('panel protokole değil BİÇİME bağlı: başka domain’de de açılır', async ({ page }) => {
  const consoleErrors = await openSchemaPanel(page, NMEA_PATH);

  await expect(page.getByText(tr['protocol.plannedNotice'])).toHaveCount(0);
  await expect(page.getByTestId('schema-field-count')).toHaveText('5');
  expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
});

test('motoru olmayan biçimde panel AÇILMAZ, "planlandı" bildirimi durur', async ({ page }) => {
  await openPage(page, NON_SCHEMA_PATH);

  await expect(page.getByTestId('schema-panel')).toHaveCount(0);
  await expect(page.getByText(tr['protocol.plannedNotice'])).toBeVisible();
});

test('1440 ve 390 pikselde yatay taşma yok', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openSchemaPanel(page, CUSTOM_BINARY_PATH);
  await expect(page.getByTestId('schema-field-table')).toBeVisible();
  expect(await horizontalOverflow(page), 'sayfa 1440px genişlikte yatayda taşıyor').toBeLessThanOrEqual(0);

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByTestId('schema-field-table')).toBeVisible();
  expect(await horizontalOverflow(page), 'sayfa 390px genişlikte yatayda taşıyor').toBeLessThanOrEqual(0);
});
