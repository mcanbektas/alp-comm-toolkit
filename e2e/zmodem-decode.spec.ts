import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { translations } from '../src/translations';

/**
 * Faz 10 dalga 10d/2'nin gerçek tarayıcı turu — ZMODEM. Çekirdek
 * (`zmodemCore.ts`) unit seviyesinde doğrulandı; bu dosya motoru değil,
 * header-form/ZRINIT-flags/ZFILE-subpacket/32-bit-CRC çözümünün motor↔ekran
 * bağlantısını sınar.
 */

const tr = translations.tr;
const CANONICAL_DECODE_PATH = '/comm/interfaces-framing/framing-stream-protocols/zmodem?tab=decode';

async function openDecodePanel(page: Page): Promise<string[]> {
  const consoleErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => consoleErrors.push(error.message));
  await page.addInitScript(() => {
    window.localStorage.setItem('alp-comm-lang', 'tr');
  });
  await page.goto(CANONICAL_DECODE_PATH);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByTestId('decode-panel')).toBeVisible();
  return consoleErrors;
}

function fieldRow(page: Page, fieldId: string): Locator {
  return page.locator(`[data-testid="decode-field-row"][data-field-id="${fieldId}"]`);
}

async function selectExample(page: Page, exampleId: string): Promise<void> {
  await page.locator('#decode-example').selectOption(exampleId);
}

test('decode sekmesi Hazır rozetiyle açılır, konsola hata basmaz', async ({ page }) => {
  const consoleErrors = await openDecodePanel(page);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('ZMODEM');
  await expect(page.getByTestId('decode-panel')).toHaveAttribute('data-plugin-id', 'zmodem');
  await expect(page.getByText(tr['status.ready'], { exact: true })).toBeVisible();
  await expect(page.getByText(tr['protocol.plannedNotice'])).toHaveCount(0);
  expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
});

test('ZRQINIT (HEX header): frame-type ve header-form doğru adlanır', async ({ page }) => {
  await openDecodePanel(page);
  await selectExample(page, 'zrqinit-hex');
  await expect(fieldRow(page, 'frame-type').getByTestId('decode-field-physical')).toHaveText('ZRQINIT');
  await expect(fieldRow(page, 'header-form').getByTestId('decode-field-physical')).toContainText('ZHEX');
  await expect(fieldRow(page, 'header-crc').getByTestId('decode-field-physical')).toContainText('PASS');
});

test('ZRINIT (binary16): capability bayrakları header-data alanında listelenir', async ({ page }) => {
  await openDecodePanel(page);
  await selectExample(page, 'zrinit-binary');
  const headerData = fieldRow(page, 'header-data').getByTestId('decode-field-physical');
  await expect(headerData).toContainText('CANFDX');
  await expect(headerData).toContainText('CANOVIO');
  await expect(headerData).toContainText('CANFC32');
  await expect(headerData).not.toContainText('CANBRK');
});

test('ZFILE + subpacket: filename ve filesize ayrı alanlara çözülür', async ({ page }) => {
  await openDecodePanel(page);
  await selectExample(page, 'zfile-with-subpacket');
  await expect(fieldRow(page, 'filename').getByTestId('decode-field-raw')).toHaveText('firmware.bin');
  await expect(fieldRow(page, 'filesize').getByTestId('decode-field-physical')).toContainText('32768');
  await expect(fieldRow(page, 'subpacket-terminator').getByTestId('decode-field-physical')).toContainText('ZCRCW');
  await expect(fieldRow(page, 'subpacket-crc').getByTestId('decode-field-physical')).toContainText('PASS');
});

test('ZDATA (binary32): Position alanı ve 32-bit CRC doğru çözülür', async ({ page }) => {
  await openDecodePanel(page);
  await selectExample(page, 'zdata-binary32');
  await expect(fieldRow(page, 'header-data').getByTestId('decode-field-physical')).toContainText('5242880');
  await expect(fieldRow(page, 'header-crc').getByTestId('decode-field-raw')).toHaveText(/^0x[0-9A-F]{8}$/);
  await expect(fieldRow(page, 'header-crc').getByTestId('decode-field-physical')).toContainText('PASS');
  await expect(fieldRow(page, 'subpacket-crc').getByTestId('decode-field-physical')).toContainText('PASS');
});

test('1440 ve 390 pikselde yatay taşma yok', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openDecodePanel(page);
  await selectExample(page, 'zfile-with-subpacket');
  await expect(page.getByTestId('decode-field-table')).toBeVisible();
  const wide = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(wide, 'sayfa 1440px genişlikte yatayda taşıyor').toBeLessThanOrEqual(0);

  await page.setViewportSize({ width: 390, height: 844 });
  const narrow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(narrow, 'sayfa 390px genişlikte yatayda taşıyor').toBeLessThanOrEqual(0);
});
