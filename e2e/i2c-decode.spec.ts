import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { translations } from '../src/translations/all';

/**
 * Faz 10 dalga 11c'nin gerçek tarayıcı turu — I²C.
 *
 * Kanıtladığı şeyler: kanonik sayfanın (interfaces-framing/peripheral-buses/
 * i2c) Hazır rozetiyle açıldığı; repeated-START'lı register-read örneğinde
 * Address/Register/Repeated Address/Data alanlarının doğru göründüğü;
 * register-write'ta Repeated Address alanının hiç basılmadığı; read-only'de
 * Register alanının hiç basılmadığı; bus-probe'ta yalnız Address göründüğü.
 */

const tr = translations.tr;

const CANONICAL_DECODE_PATH = '/comm/interfaces-framing/peripheral-buses/i2c?tab=decode';

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

test.describe('I²C', () => {
  test('decode sekmesi Hazır rozetiyle açılır ve konsola hata basmaz', async ({ page }) => {
    const consoleErrors = await openDecodePanel(page, CANONICAL_DECODE_PATH);

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('I²C');
    await expect(page.getByTestId('decode-panel')).toHaveAttribute('data-plugin-id', 'i2c');
    await expect(page.getByText(tr['status.ready'], { exact: true })).toBeVisible();
    await expect(page.getByText(tr['protocol.plannedNotice'])).toHaveCount(0);

    expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
  });

  test('Register okuma (repeated START) örneği Address+Register+Repeated Address+Data basar', async ({
    page,
  }) => {
    await openDecodePanel(page, CANONICAL_DECODE_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('register-read');

    const address = fieldRow(page, 'address');
    await expect(address.getByTestId('decode-field-physical')).toHaveText(
      'Write · 7-bit 0x68 (0xD0)',
    );
    await expect(fieldRow(page, 'register')).toHaveCount(1);

    const repeatedAddress = fieldRow(page, 'repeatedAddress');
    await expect(repeatedAddress.getByTestId('decode-field-physical')).toHaveText(
      'Read · 7-bit 0x68 (0xD1)',
    );
    await expect(fieldRow(page, 'data')).toHaveCount(1);

    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
  });

  test('Register yazma örneğinde Repeated Address alanı hiç görünmez', async ({ page }) => {
    await openDecodePanel(page, CANONICAL_DECODE_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('register-write');

    const address = fieldRow(page, 'address');
    await expect(address.getByTestId('decode-field-physical')).toHaveText(
      'Write · 7-bit 0x68 (0xD0)',
    );
    await expect(fieldRow(page, 'register')).toHaveCount(1);
    await expect(fieldRow(page, 'repeatedAddress')).toHaveCount(0);
    await expect(fieldRow(page, 'data')).toHaveCount(1);
  });

  test('read-only örneğinde Register alanı hiç görünmez', async ({ page }) => {
    await openDecodePanel(page, CANONICAL_DECODE_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('read-only');

    const address = fieldRow(page, 'address');
    await expect(address.getByTestId('decode-field-physical')).toHaveText(
      'Read · 7-bit 0x68 (0xD1)',
    );
    await expect(fieldRow(page, 'register')).toHaveCount(0);
    await expect(fieldRow(page, 'data')).toHaveCount(1);
  });

  test('bus-probe örneğinde yalnız Address alanı görünür', async ({ page }) => {
    await openDecodePanel(page, CANONICAL_DECODE_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('bus-probe');

    const address = fieldRow(page, 'address');
    await expect(address.getByTestId('decode-field-physical')).toHaveText(
      'Write · 7-bit 0x1E (0x3C)',
    );
    await expect(fieldRow(page, 'register')).toHaveCount(0);
    await expect(fieldRow(page, 'data')).toHaveCount(0);
  });

  test('İngilizce dilde de çevrilmemiş anahtar basmaz', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('alp-comm-lang', 'en');
    });
    await page.goto(CANONICAL_DECODE_PATH);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('I²C');
    await page.getByLabel(translations.en['decode.example.label']).selectOption('register-read');
    const address = fieldRow(page, 'address');
    await expect(address.getByTestId('decode-field-physical')).toHaveText(
      'Write · 7-bit 0x68 (0xD0)',
    );
  });

  test('1440 ve 390 pikselde yatay taşma yok', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openDecodePanel(page, CANONICAL_DECODE_PATH);
    await page.getByLabel(tr['decode.example.label']).selectOption('register-read');
    await expect(page.getByTestId('decode-field-table')).toBeVisible();
    const wide = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(wide, 'sayfa 1440px genişlikte yatayda taşıyor').toBeLessThanOrEqual(0);

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByTestId('decode-field-table')).toBeVisible();
    const narrow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(narrow, 'sayfa 390px genişlikte yatayda taşıyor').toBeLessThanOrEqual(0);
  });
});
