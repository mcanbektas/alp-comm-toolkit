import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { translations } from '../src/translations/all';

/**
 * `Definitions` sekmesindeki ÜRETİCİ KAYIT HARİTASI panelinin tarayıcı turu.
 *
 * Kanıtladığı şey: `vendor-map` taşıyan kayıtlarda panel gerçekten indiriliyor,
 * örnek harita CSV'den okunuyor ve register baytları girdi tipine göre —
 * ölçekli tamsayı, bit ağacı, sözlüklü mod — çözülüyor.
 *
 * `vendor-map`in standart bir dosya biçimi yok; panelin sözleşmesi de bu yüzden
 * "kullanıcının tablosunu oku" üstüne kurulu. Tur, o sözleşmenin ekranda
 * gerçekten karşılandığını gösteriyor.
 */

const tr = translations.tr;

const MODBUS_PATH = '/comm/building-automation/modbus-building/modbus-rtu?tab=definitions';
const LLDP_PATH = '/comm/network-ethernet/data-link/lldp?tab=definitions';
/**
 * Regresyon bekçisi: LIN `definitions: ['ldf']` taşır — yani BAŞKA bir biçim.
 * LDF dalgasına kadar burası "motoru olmayan biçim" örneğiydi ve "planlandı"
 * bildirimini kanıtlardı; LDF motoru gelince katalogda motorsuz biçim KALMADI,
 * bekçi de "panel biçime göre SEÇİLİYOR mu" testine çevrildi. Tam gerekçe:
 * `e2e/ldf-definitions.spec.ts`. Erişilemez hâle gelen "planlandı" yedek dalı
 * `src/pages/ProtocolPage.test.tsx`te birim testiyle kapsanıyor.
 */
const NON_MAP_PATH = '/comm/automotive/vehicle-network-protocols/lin?tab=definitions';

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

async function openVendorMapPanel(page: Page, path: string): Promise<string[]> {
  const consoleErrors = await openPage(page, path);
  await expect(page.getByTestId('vendor-map-panel')).toBeVisible();
  return consoleErrors;
}

function row(page: Page, address: number): Locator {
  return page.locator(`[data-testid="vendor-map-row"][data-entry-key="holding-register:${String(address)}"]`);
}

async function selectEntry(page: Page, address: number): Promise<void> {
  await page
    .getByLabel(tr['definition.vendorMap.entry.label'])
    .selectOption(`holding-register:${String(address)}`);
}

async function horizontalOverflow(page: Page): Promise<number> {
  return page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
}

test('definitions sekmesi kayıt haritası paneliyle açılır ve konsola hata basmaz', async ({ page }) => {
  const consoleErrors = await openVendorMapPanel(page, MODBUS_PATH);

  await expect(page.getByText(tr['protocol.plannedNotice'])).toHaveCount(0);
  await expect(page.getByTestId('vendor-map-load-failed')).toHaveCount(0);
  expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
});

test('ekran BOŞ açılmaz: örnek harita CSV’den okunur ve özetini basar', async ({ page }) => {
  await openVendorMapPanel(page, MODBUS_PATH);

  await expect(page.getByTestId('vendor-map-sample-notice')).toBeVisible();
  await expect(page.getByTestId('vendor-map-device')).toHaveText('Örnek Enerji Ölçer');
  await expect(page.getByTestId('vendor-map-entry-count')).toHaveText('7');
  await expect(page.getByTestId('vendor-map-word-order')).toHaveText(
    tr['definition.vendorMap.wordOrder.highFirst'],
  );
  await expect(page.getByTestId('vendor-map-issue')).toHaveCount(0);
});

test('tablo adresi iki gösterimle ve adres uzayıyla basar', async ({ page }) => {
  await openVendorMapPanel(page, MODBUS_PATH);

  await expect(page.getByTestId('vendor-map-row')).toHaveCount(7);
  await expect(row(page, 40001)).toContainText('40001 (0x9C41)');
  await expect(row(page, 40001)).toContainText('Line Voltage');
  await expect(row(page, 40001)).toContainText(tr['definition.vendorMap.space.holdingRegister']);
  await expect(row(page, 40003)).toContainText('uint32');
});

test('ölçekli register’ı fiziksel değere çevirir (0x08FC ×0.1 = 230 V)', async ({ page }) => {
  await openVendorMapPanel(page, MODBUS_PATH);

  await expect(page.getByTestId('vendor-map-raw')).toHaveText('2300');
  await expect(page.getByTestId('vendor-map-physical')).toHaveText('230 V');
});

test('iki register’lık sayacı kelime sırasına göre okur (100000 Wh)', async ({ page }) => {
  await openVendorMapPanel(page, MODBUS_PATH);

  await selectEntry(page, 40003);
  await expect(page.getByTestId('vendor-map-raw')).toHaveText('100000');
});

test('durum register’ının bitlerini adlandırır — set olanlar işaretli', async ({ page }) => {
  await openVendorMapPanel(page, MODBUS_PATH);

  await selectEntry(page, 40007);
  const bits = page.getByTestId('vendor-map-bit');
  await expect(bits).toHaveCount(3);
  await expect(page.locator('[data-testid="vendor-map-bit"][data-bit="0"]')).toHaveAttribute(
    'data-value',
    'true',
  );
  await expect(page.locator('[data-testid="vendor-map-bit"][data-bit="1"]')).toHaveAttribute(
    'data-value',
    'false',
  );
  await expect(page.locator('[data-testid="vendor-map-bit"][data-bit="3"]')).toContainText('Overload');
});

test('sözlüklü girdide sayı yerine karşılığı basılır (1 → Run)', async ({ page }) => {
  await openVendorMapPanel(page, MODBUS_PATH);

  await selectEntry(page, 40008);
  await expect(page.getByTestId('vendor-map-raw')).toHaveText('1');
  await expect(page.getByTestId('vendor-map-physical')).toHaveText('Run');
});

test('bayt yetmiyorsa kaç bayt gerektiğini söyler', async ({ page }) => {
  await openVendorMapPanel(page, MODBUS_PATH);

  await selectEntry(page, 40003); // uint32 → 4 bayt ister
  await page.locator('#vendor-map-hex').fill('00 01');
  const error = page.getByTestId('vendor-map-decode-error');
  await expect(error).toBeVisible();
  await expect(error).toContainText('4');
  await expect(page.getByTestId('vendor-map-decoded')).toHaveCount(0);
});

test('geçersiz hex hata basar', async ({ page }) => {
  await openVendorMapPanel(page, MODBUS_PATH);

  await page.locator('#vendor-map-hex').fill('08 ZZ');
  const hexError = page.getByTestId('vendor-map-hex-error');
  await expect(hexError).toBeVisible();
  await expect(hexError).toHaveText(tr['decode.error.invalidHex']);
  await expect(page.getByTestId('vendor-map-decoded')).toHaveCount(0);
});

test('panel protokole değil BİÇİME bağlı: LLDP sayfasında da açılır', async ({ page }) => {
  const consoleErrors = await openVendorMapPanel(page, LLDP_PATH);

  await expect(page.getByTestId('vendor-map-entry-count')).toHaveText('7');
  await expect(page.getByText(tr['protocol.plannedNotice'])).toHaveCount(0);
  expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
});

test('LIN kaydında bu panel AÇILMAZ, kaydın KENDİ biçimi olan LDF paneli açılır', async ({ page }) => {
  await openPage(page, NON_MAP_PATH);

  // Panel tanım biçimine bağlıdır, sekmenin varlığına değil: LIN yalnız
  // `ldf` sayıyor, o yüzden bu biçimin paneli açılmamalı ve LDF paneli açılmalı.
  await expect(page.getByTestId('vendor-map-panel')).toHaveCount(0);
  await expect(page.getByTestId('ldf-panel')).toBeVisible();
  await expect(page.getByText(tr['protocol.plannedNotice'])).toHaveCount(0);
});

test('1440 ve 390 pikselde yatay taşma yok', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openVendorMapPanel(page, MODBUS_PATH);
  await expect(page.getByTestId('vendor-map-table')).toBeVisible();
  expect(await horizontalOverflow(page), 'sayfa 1440px genişlikte yatayda taşıyor').toBeLessThanOrEqual(0);

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByTestId('vendor-map-table')).toBeVisible();
  expect(await horizontalOverflow(page), 'sayfa 390px genişlikte yatayda taşıyor').toBeLessThanOrEqual(0);
});
