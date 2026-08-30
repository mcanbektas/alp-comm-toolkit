import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { translations } from '../src/translations/all';

/**
 * Faz 10 dalga 10d'nin gerçek tarayıcı turu — YMODEM. Blok yapısı XMODEM ile
 * paylaşılan çekirdekten (`xmodemCore.ts`) geliyor, motor seviyesinde
 * doğrulandı; bu dosya motoru değil, Block 0 metadata çözümünü ve
 * motor↔ekran bağlantısını sınar.
 */

const tr = translations.tr;
const CANONICAL_DECODE_PATH = '/comm/interfaces-framing/framing-stream-protocols/ymodem?tab=decode';

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
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('YMODEM');
  await expect(page.getByTestId('decode-panel')).toHaveAttribute('data-plugin-id', 'ymodem');
  await expect(page.getByText(tr['status.ready'], { exact: true })).toBeVisible();
  await expect(page.getByText(tr['protocol.plannedNotice'])).toHaveCount(0);
  expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
});

test('Block 0: dosya adı + boyutu çözülür', async ({ page }) => {
  await openDecodePanel(page);
  await selectExample(page, 'block-zero-metadata');
  await expect(fieldRow(page, 'block-number').getByTestId('decode-field-physical')).toHaveText('Block 0 — batch metadata');
  await expect(fieldRow(page, 'filename').getByTestId('decode-field-raw')).toHaveText('firmware.bin');
  await expect(fieldRow(page, 'filesize').getByTestId('decode-field-physical')).toContainText('32768');
});

test('boş dosya adı batch terminatörü olarak adlanır', async ({ page }) => {
  await openDecodePanel(page);
  await selectExample(page, 'batch-terminator');
  await expect(fieldRow(page, 'batch-terminator').getByTestId('decode-field-physical')).toContainText('end of batch');
  await expect(page.locator('[data-testid="decode-field-row"][data-field-id="filename"]')).toHaveCount(0);
});

test('normal veri bloğu (Block 1) XMODEM ile aynı şekilde çözülür', async ({ page }) => {
  await openDecodePanel(page);
  await selectExample(page, 'data-block');
  await expect(fieldRow(page, 'data').getByTestId('decode-field-physical')).toHaveText('128 bytes');
  await expect(page.locator('[data-testid="decode-field-row"][data-field-id="filename"]')).toHaveCount(0);
});

test('1440 ve 390 pikselde yatay taşma yok', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openDecodePanel(page);
  await selectExample(page, 'block-zero-metadata');
  await expect(page.getByTestId('decode-field-table')).toBeVisible();
  const wide = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(wide, 'sayfa 1440px genişlikte yatayda taşıyor').toBeLessThanOrEqual(0);

  await page.setViewportSize({ width: 390, height: 844 });
  const narrow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(narrow, 'sayfa 390px genişlikte yatayda taşıyor').toBeLessThanOrEqual(0);
});
