import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { translations } from '../src/translations/all';

/**
 * Faz 10 dalga 10a'nın gerçek tarayıcı turu — COBS. Çerçeveleme motoru
 * (Faz 6) doğrulandı; bu dosya motoru değil, motor↔ekran bağlantısını sınar.
 */

const tr = translations.tr;
const CANONICAL_DECODE_PATH = '/comm/interfaces-framing/framing-stream-protocols/cobs?tab=decode';

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
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('COBS');
  await expect(page.getByTestId('decode-panel')).toHaveAttribute('data-plugin-id', 'cobs');
  await expect(page.getByText(tr['status.ready'], { exact: true })).toBeVisible();
  await expect(page.getByText(tr['protocol.plannedNotice'])).toHaveCount(0);
  expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
});

test('spec fixture: sıfır ortada, iki kod baytı doğru konumda', async ({ page }) => {
  await openDecodePanel(page);
  await selectExample(page, 'zero-in-middle');
  await expect(fieldRow(page, 'payload').getByTestId('decode-field-raw')).toHaveText('11 22 00 33');
  await expect(fieldRow(page, 'code-byte-0').getByTestId('decode-field-raw')).toHaveText('0x3 (3)');
  await expect(fieldRow(page, 'code-byte-0').getByTestId('decode-field-physical')).toContainText('zero restored after');
  await expect(fieldRow(page, 'code-byte-1').getByTestId('decode-field-raw')).toHaveText('0x2 (2)');
  await expect(fieldRow(page, 'delimiter').getByTestId('decode-field-raw')).toHaveText('0x00');
});

test('tek sıfır baytı en küçük girdiyi doğru çözer', async ({ page }) => {
  await openDecodePanel(page);
  await selectExample(page, 'single-zero');
  await expect(fieldRow(page, 'payload').getByTestId('decode-field-raw')).toHaveText('00');
  await expect(fieldRow(page, 'code-byte-0').getByTestId('decode-field-raw')).toHaveText('0x1 (1)');
});

test('sıfır içermeyen veri tek kod baytıyla kodlanır', async ({ page }) => {
  await openDecodePanel(page);
  await selectExample(page, 'no-zero-bytes');
  await expect(fieldRow(page, 'payload').getByTestId('decode-field-raw')).toHaveText('01 02 03');
  await expect(fieldRow(page, 'code-byte-0').getByTestId('decode-field-raw')).toHaveText('0x4 (4)');
  await expect(page.locator('[data-testid="decode-field-row"][data-field-id="code-byte-1"]')).toHaveCount(0);
});

test('1440 ve 390 pikselde yatay taşma yok', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openDecodePanel(page);
  await selectExample(page, 'zero-in-middle');
  await expect(page.getByTestId('decode-field-table')).toBeVisible();
  const wide = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(wide, 'sayfa 1440px genişlikte yatayda taşıyor').toBeLessThanOrEqual(0);

  await page.setViewportSize({ width: 390, height: 844 });
  const narrow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(narrow, 'sayfa 390px genişlikte yatayda taşıyor').toBeLessThanOrEqual(0);
});
