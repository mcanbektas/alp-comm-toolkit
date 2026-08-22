import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { translations } from '../src/translations';

/**
 * Faz 10 dalga 11e'nin gerçek tarayıcı turu — UART ve RS-232.
 *
 * Kanıtladığı şeyler: iki kanonik sayfanın da Hazır rozetiyle açıldığı; UART'ta
 * satır sonu alanının yalnız CR/LF/CRLF ile biten yakalamalarda göründüğü;
 * RS-232'de mark/space sütununun alan metnine eklendiği; örnek çerçeve
 * dropdown'ının ham çeviri anahtarı basmadığı (dalga 11c'de yalnız tarayıcı
 * turunun yakaladığı hata sınıfı); uzun RS-232 alan metninin 390 pikselde
 * yatay taşma yaratmadığı.
 */

const tr = translations.tr;

const UART_DECODE_PATH = '/comm/interfaces-framing/serial-interfaces/uart?tab=decode';
const RS232_DECODE_PATH = '/comm/interfaces-framing/serial-interfaces/rs-232?tab=decode';

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

test.describe('UART', () => {
  test('decode sekmesi Hazır rozetiyle açılır ve konsola hata basmaz', async ({ page }) => {
    const consoleErrors = await openDecodePanel(page, UART_DECODE_PATH);

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('UART');
    await expect(page.getByTestId('decode-panel')).toHaveAttribute('data-plugin-id', 'uart');
    await expect(page.getByText(tr['status.ready'], { exact: true })).toBeVisible();
    await expect(page.getByText(tr['protocol.plannedNotice'])).toHaveCount(0);

    expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
  });

  test('Hello + CRLF örneği beş karakter ve tek satır sonu alanı basar', async ({ page }) => {
    await openDecodePanel(page, UART_DECODE_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('hello-crlf');

    await expect(page.locator('[data-testid="decode-field-row"]')).toHaveCount(6);
    await expect(fieldRow(page, 'char0').getByTestId('decode-field-physical')).toHaveText(
      "0x48 'H' · 0 00010010 1",
    );
    await expect(fieldRow(page, 'lineEnding').getByTestId('decode-field-physical')).toHaveText(
      'CRLF (0x0D 0x0A)',
    );
  });

  test('satır sonu olmayan ikilik örnekte Satır Sonu alanı hiç görünmez', async ({ page }) => {
    await openDecodePanel(page, UART_DECODE_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('binary-payload');

    await expect(page.locator('[data-testid="decode-field-row"]')).toHaveCount(3);
    await expect(fieldRow(page, 'lineEnding')).toHaveCount(0);
  });

  test('spec bit görünümü örneği 0x53 hattını basar', async ({ page }) => {
    await openDecodePanel(page, UART_DECODE_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('bit-view');

    await expect(fieldRow(page, 'char0').getByTestId('decode-field-physical')).toHaveText(
      "0x53 'S' · 0 11001010 1",
    );
  });
});

test.describe('RS-232', () => {
  test('decode sekmesi Hazır rozetiyle açılır ve mark/space sütununu basar', async ({ page }) => {
    const consoleErrors = await openDecodePanel(page, RS232_DECODE_PATH);

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('RS-232');
    await expect(page.getByTestId('decode-panel')).toHaveAttribute('data-plugin-id', 'rs-232');
    await expect(page.getByText(tr['status.ready'], { exact: true })).toBeVisible();

    await page.getByLabel(tr['decode.example.label']).selectOption('spec-character');
    await expect(fieldRow(page, 'char0').getByTestId('decode-field-physical')).toHaveText(
      "0x41 'A' · 0 10000010 1 · SMSSSSSMSM",
    );

    expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
  });

  test('örnek çerçeve dropdown ham çeviri anahtarı basmaz', async ({ page }) => {
    await openDecodePanel(page, RS232_DECODE_PATH);

    const select = page.getByLabel(tr['decode.example.label']);
    await expect(select).toContainText(tr['protocol.rs232.example.specCharacter.name']);
    await expect(select).not.toContainText('protocol.rs232.example');
  });

  test('İngilizce dilde de çevrilmemiş anahtar basmaz', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('alp-comm-lang', 'en');
    });
    await page.goto(UART_DECODE_PATH);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('UART');

    const select = page.getByLabel(translations.en['decode.example.label']);
    await expect(select).toContainText(translations.en['protocol.uart.example.helloCrlf.name']);
    await expect(select).not.toContainText('protocol.uart.example');
  });

  test('1440 ve 390 pikselde yatay taşma yok (uzun mark/space sütunuyla)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openDecodePanel(page, RS232_DECODE_PATH);
    await page.getByLabel(tr['decode.example.label']).selectOption('two-characters');
    await expect(page.getByTestId('decode-field-table')).toBeVisible();
    const wide = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(wide, 'sayfa 1440px genişlikte yatayda taşıyor').toBeLessThanOrEqual(0);

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByTestId('decode-field-table')).toBeVisible();
    const narrow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(narrow, 'sayfa 390px genişlikte yatayda taşıyor').toBeLessThanOrEqual(0);
  });
});
