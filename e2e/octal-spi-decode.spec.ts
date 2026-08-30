import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { translations } from '../src/translations/all';

/**
 * Faz 10 dalga 11b'nin gerçek tarayıcı turu — Octal SPI.
 *
 * Kanıtladığı şeyler: kanonik sayfanın Hazır rozetiyle açıldığı; flash-read
 * örneğinde Command+Address+Data alanlarının doğru göründüğü; adressiz
 * komutta Address/Data alanının hiç basılmadığı.
 */

const tr = translations.tr;

const CANONICAL_DECODE_PATH = '/comm/interfaces-framing/peripheral-buses/octal-spi?tab=decode';

async function openDecodePanel(page: Page, path: string): Promise<string[]> {
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
  await expect(page.getByTestId('decode-panel')).toBeVisible();
  return consoleErrors;
}

function fieldRow(page: Page, fieldId: string): Locator {
  return page.locator(`[data-testid="decode-field-row"][data-field-id="${fieldId}"]`);
}

test.describe('Octal SPI', () => {
  test('decode sekmesi Hazır rozetiyle açılır ve konsola hata basmaz', async ({ page }) => {
    const consoleErrors = await openDecodePanel(page, CANONICAL_DECODE_PATH);

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Octal SPI');
    await expect(page.getByTestId('decode-panel')).toHaveAttribute('data-plugin-id', 'octal-spi');
    await expect(page.getByText(tr['status.ready'], { exact: true })).toBeVisible();

    expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
  });

  test('flash-read örneği Command+Address+Data alanlarını doğru basar', async ({ page }) => {
    await openDecodePanel(page, CANONICAL_DECODE_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('flash-read');

    const command = fieldRow(page, 'command');
    await expect(command.getByTestId('decode-field-physical')).toHaveText('0x0C');

    await expect(fieldRow(page, 'address')).toHaveCount(1);
    await expect(fieldRow(page, 'data')).toHaveCount(1);
    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
  });

  test('command-only örneğinde Address ve Data alanı hiç görünmez', async ({ page }) => {
    await openDecodePanel(page, CANONICAL_DECODE_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('command-only');

    await expect(fieldRow(page, 'address')).toHaveCount(0);
    await expect(fieldRow(page, 'data')).toHaveCount(0);
  });

  test('1440 ve 390 pikselde yatay taşma yok', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openDecodePanel(page, CANONICAL_DECODE_PATH);
    await page.getByLabel(tr['decode.example.label']).selectOption('flash-read');
    await expect(page.getByTestId('decode-field-table')).toBeVisible();
    const wide = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(wide, 'sayfa 1440px genişlikte yatayda taşıyor').toBeLessThanOrEqual(0);

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByTestId('decode-field-table')).toBeVisible();
    const narrow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(narrow, 'sayfa 390px genişlikte yatayda taşıyor').toBeLessThanOrEqual(0);
  });
});
