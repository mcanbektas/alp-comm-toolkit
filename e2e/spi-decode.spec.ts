import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { translations } from '../src/translations/all';

/**
 * Faz 10 dalga 11b'nin gerçek tarayıcı turu — SPI.
 *
 * Kanıtladığı şeyler: kanonik sayfanın (interfaces-framing/peripheral-buses/
 * spi) Hazır rozetiyle açıldığı; okuma komutunda Command+Dummy+Data
 * alanlarının doğru göründüğü; yazma komutunda Dummy alanının hiç
 * basılmadığı; yalnız komut baytında Data alanının hiç görünmediği.
 */

const tr = translations.tr;

const CANONICAL_DECODE_PATH = '/comm/interfaces-framing/peripheral-buses/spi?tab=decode';

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

test.describe('SPI', () => {
  test('decode sekmesi Hazır rozetiyle açılır ve konsola hata basmaz', async ({ page }) => {
    const consoleErrors = await openDecodePanel(page, CANONICAL_DECODE_PATH);

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('SPI');
    await expect(page.getByTestId('decode-panel')).toHaveAttribute('data-plugin-id', 'spi');
    await expect(page.getByText(tr['status.ready'], { exact: true })).toBeVisible();
    await expect(page.getByText(tr['protocol.plannedNotice'])).toHaveCount(0);

    expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
  });

  test('Register okuma örneği Command+Dummy+Data alanlarını doğru basar', async ({ page }) => {
    await openDecodePanel(page, CANONICAL_DECODE_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('register-read');

    const command = fieldRow(page, 'command');
    await expect(command.getByTestId('decode-field-physical')).toHaveText('Read · Register 0x75');

    await expect(fieldRow(page, 'dummy')).toHaveCount(1);
    // Data alanı çok baytlı (rawBytes) — ham değer sütunu tek sayıya
    // indirgenmediği için "—" gösterir (onewire.ts'nin serialNumber emsali),
    // gerçek bayt içeriği hex viewer'da görünür; burada yalnız alanın var
    // olduğunu doğruluyoruz.
    await expect(fieldRow(page, 'data')).toHaveCount(1);

    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
  });

  test('Register yazma örneğinde Dummy alanı hiç görünmez', async ({ page }) => {
    await openDecodePanel(page, CANONICAL_DECODE_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('register-write');

    const command = fieldRow(page, 'command');
    await expect(command.getByTestId('decode-field-physical')).toHaveText('Write · Register 0x75');
    await expect(fieldRow(page, 'dummy')).toHaveCount(0);
    await expect(fieldRow(page, 'data')).toHaveCount(1);
  });

  test('İngilizce dilde de çevrilmemiş anahtar basmaz', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('alp-comm-lang', 'en');
    });
    await page.goto(CANONICAL_DECODE_PATH);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('SPI');
    await page.getByLabel(translations.en['decode.example.label']).selectOption('register-read');
    const command = fieldRow(page, 'command');
    await expect(command.getByTestId('decode-field-physical')).toHaveText('Read · Register 0x75');
  });

  test('1440 ve 390 pikselde yatay taşma yok', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openDecodePanel(page, CANONICAL_DECODE_PATH);
    await page.getByLabel(tr['decode.example.label']).selectOption('multi-byte-read');
    await expect(page.getByTestId('decode-field-table')).toBeVisible();
    const wide = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(wide, 'sayfa 1440px genişlikte yatayda taşıyor').toBeLessThanOrEqual(0);

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByTestId('decode-field-table')).toBeVisible();
    const narrow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(narrow, 'sayfa 390px genişlikte yatayda taşıyor').toBeLessThanOrEqual(0);
  });
});
