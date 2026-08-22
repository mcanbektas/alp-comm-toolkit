import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { translations } from '../src/translations';

/**
 * Faz 10 dalga 11d'nin gerçek tarayıcı turu — RS-485 ve RS-422.
 *
 * Kanıtladığı şeyler: iki kanonik sayfanın da (interfaces-framing/
 * serial-interfaces/rs-485 ve /rs-422) Hazır rozetiyle açıldığı; UART karakter
 * hattı görünümünün alan tablosunda doğru bastığı; RS-485'in echo örneğinde
 * Echo alanlarının VE frame uyarısının göründüğü, Modbus örneğinde
 * görünmediği; örnek çerçeve dropdown'ının ham çeviri anahtarı basmadığı
 * (dalga 11c'de yalnız tarayıcı turunun yakaladığı hata sınıfı).
 */

const tr = translations.tr;

const RS485_DECODE_PATH = '/comm/interfaces-framing/serial-interfaces/rs-485?tab=decode';
const RS422_DECODE_PATH = '/comm/interfaces-framing/serial-interfaces/rs-422?tab=decode';

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

test.describe('RS-485', () => {
  test('decode sekmesi Hazır rozetiyle açılır ve konsola hata basmaz', async ({ page }) => {
    const consoleErrors = await openDecodePanel(page, RS485_DECODE_PATH);

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('RS-485');
    await expect(page.getByTestId('decode-panel')).toHaveAttribute('data-plugin-id', 'rs-485');
    await expect(page.getByText(tr['status.ready'], { exact: true })).toBeVisible();
    await expect(page.getByText(tr['protocol.plannedNotice'])).toHaveCount(0);

    expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
  });

  test('Modbus RTU örneği sekiz karakteri hat görünümüyle basar, uyarı yok', async ({ page }) => {
    await openDecodePanel(page, RS485_DECODE_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('modbus-rtu-frame');

    await expect(page.locator('[data-testid="decode-field-row"]')).toHaveCount(8);
    await expect(fieldRow(page, 'char0').getByTestId('decode-field-physical')).toHaveText(
      '0x01 · 0 10000000 1',
    );
    await expect(fieldRow(page, 'char7').getByTestId('decode-field-physical')).toHaveText(
      '0x0B · 0 11010000 1',
    );
    await expect(fieldRow(page, 'echochar0')).toHaveCount(0);
    await expect(page.getByTestId('decode-frame-warning')).toHaveCount(0);
    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
  });

  test('echo örneğinde Echo alanları ve frame uyarısı görünür', async ({ page }) => {
    await openDecodePanel(page, RS485_DECODE_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('half-duplex-echo');

    await expect(page.locator('[data-testid="decode-field-row"]')).toHaveCount(16);
    await expect(fieldRow(page, 'echochar0')).toHaveCount(1);
    await expect(fieldRow(page, 'echochar7')).toHaveCount(1);

    // Ham çeviri anahtarı ('protocol.rs485.warning.echoSuspected') da "echo"
    // içerir — bu yüzden anahtar değil, çevrilmiş METİN aranıyor (dalga 11c'de
    // yalnız tarayıcı turunun yakaladığı hata sınıfının otomatik bekçisi).
    const warning = page.getByTestId('decode-frame-warning');
    await expect(warning).toHaveCount(1);
    await expect(warning).toContainText(tr['protocol.rs485.warning.echoSuspected']);
    await expect(warning).not.toContainText('protocol.rs485.warning');
    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
  });

  test('örnek çerçeve dropdown ham çeviri anahtarı basmaz', async ({ page }) => {
    await openDecodePanel(page, RS485_DECODE_PATH);

    const select = page.getByLabel(tr['decode.example.label']);
    await expect(select).toContainText(tr['protocol.rs485.example.modbusRtu.name']);
    await expect(select).not.toContainText('protocol.rs485.example');
  });
});

test.describe('RS-422', () => {
  test('decode sekmesi Hazır rozetiyle açılır ve tek karakteri hat görünümüne açar', async ({
    page,
  }) => {
    const consoleErrors = await openDecodePanel(page, RS422_DECODE_PATH);

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('RS-422');
    await expect(page.getByTestId('decode-panel')).toHaveAttribute('data-plugin-id', 'rs-422');
    await expect(page.getByText(tr['status.ready'], { exact: true })).toBeVisible();

    await page.getByLabel(tr['decode.example.label']).selectOption('single-character');
    await expect(fieldRow(page, 'char0').getByTestId('decode-field-physical')).toHaveText(
      "0x41 'A' · 0 10000010 1",
    );

    expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
  });

  test('çok karakterli örnekte kontrol baytlarında ASCII sütunu boş kalır', async ({ page }) => {
    await openDecodePanel(page, RS422_DECODE_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('multi-character');

    await expect(page.locator('[data-testid="decode-field-row"]')).toHaveCount(4);
    await expect(fieldRow(page, 'char0').getByTestId('decode-field-physical')).toHaveText(
      "0x4F 'O' · 0 11110010 1",
    );
    await expect(fieldRow(page, 'char2').getByTestId('decode-field-physical')).toHaveText(
      '0x0D · 0 10110000 1',
    );
  });

  test('İngilizce dilde de çevrilmemiş anahtar basmaz', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('alp-comm-lang', 'en');
    });
    await page.goto(RS422_DECODE_PATH);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('RS-422');

    const select = page.getByLabel(translations.en['decode.example.label']);
    await expect(select).toContainText(translations.en['protocol.rs422.example.singleCharacter.name']);
    await expect(select).not.toContainText('protocol.rs422.example');
  });

  test('1440 ve 390 pikselde yatay taşma yok', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openDecodePanel(page, RS422_DECODE_PATH);
    await page.getByLabel(tr['decode.example.label']).selectOption('multi-character');
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
