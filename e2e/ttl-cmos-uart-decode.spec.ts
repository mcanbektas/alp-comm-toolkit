import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { translations } from '../src/translations';

/**
 * Faz 10 dalga 11f'nin gerçek tarayıcı turu — TTL UART, CMOS UART ve bu iki
 * sayfanın asıl motoru olan logic seviyesi uyumluluk hesaplayıcısı.
 *
 * Kanıtladığı şeyler: iki sayfanın da Hazır rozetiyle açıldığı ve aynı
 * karakter hattını bastığı; hesaplayıcının spec'in kendi asimetrik örneğini
 * (A→B geçer, B→A geçmez) gerçekten ürettiği; girdi değişince sonucun
 * güncellendiği; hiçbir yerde ham çeviri anahtarı basılmadığı.
 */

const tr = translations.tr;

const TTL_DECODE_PATH = '/comm/interfaces-framing/serial-interfaces/ttl-uart?tab=decode';
const CMOS_DECODE_PATH = '/comm/interfaces-framing/serial-interfaces/cmos-uart?tab=decode';
const LOGIC_CALC_PATH = '/comm/calculators/logic-level-compat';

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

test.describe('TTL UART / CMOS UART', () => {
  test('TTL UART decode sekmesi Hazır rozetiyle açılır ve konsola hata basmaz', async ({
    page,
  }) => {
    const consoleErrors = await openDecodePanel(page, TTL_DECODE_PATH);

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('TTL UART');
    await expect(page.getByTestId('decode-panel')).toHaveAttribute('data-plugin-id', 'ttl-uart');
    await expect(page.getByText(tr['status.ready'], { exact: true })).toBeVisible();
    await expect(page.getByText(tr['protocol.plannedNotice'])).toHaveCount(0);

    await expect(page.locator('[data-testid="decode-field-row"]')).toHaveCount(4);
    await expect(fieldRow(page, 'char0').getByTestId('decode-field-physical')).toHaveText(
      "0x4F 'O' · 0 11110010 1",
    );

    expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
  });

  test('CMOS UART aynı hattı basar, örnek adları çevrilidir', async ({ page }) => {
    await openDecodePanel(page, CMOS_DECODE_PATH);

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('CMOS UART');
    await expect(page.getByTestId('decode-panel')).toHaveAttribute('data-plugin-id', 'cmos-uart');
    await expect(fieldRow(page, 'char0').getByTestId('decode-field-physical')).toHaveText(
      "0x4F 'O' · 0 11110010 1",
    );

    const select = page.getByLabel(tr['decode.example.label']);
    await expect(select).toContainText(tr['protocol.cmosUart.example.debugConsole.name']);
    await expect(select).not.toContainText('protocol.cmosUart.example');
  });

  test('TTL UART sayfasında satır sonu alanı hiç görünmez (UART sayfasının eki)', async ({
    page,
  }) => {
    await openDecodePanel(page, TTL_DECODE_PATH);
    await expect(fieldRow(page, 'lineEnding')).toHaveCount(0);
  });
});

test.describe('Logic seviyesi uyumluluk hesaplayıcısı', () => {
  test('spec asimetri örneğini üretir: A→B uyumlu, B→A değil', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('pageerror', (error) => consoleErrors.push(error.message));
    await page.addInitScript(() => {
      window.localStorage.setItem('alp-comm-lang', 'tr');
    });

    await page.goto(LOGIC_CALC_PATH);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      tr['calc.logicLevelCompat.name'],
    );

    // Varsayılanlar 3.3V ↔ 1.8V: A→B geçer, B→A geçmez (B VOH 1.8 < A VIH 2.0).
    await expect(page.getByText(tr['calc.logicLevel.pass'], { exact: true })).toHaveCount(1);
    await expect(page.getByText(tr['calc.logicLevel.warning'], { exact: true })).toHaveCount(1);
    await expect(page.getByText('calc.logicLevel')).toHaveCount(0);

    expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
  });

  test('B cihazının çıkışı yükseltilince iki yön de uyumlu olur', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('alp-comm-lang', 'tr');
    });
    await page.goto(LOGIC_CALC_PATH);

    await page.locator('#calc-logic-b-voh').fill('3.3');
    await expect(page.getByText(tr['calc.logicLevel.pass'], { exact: true })).toHaveCount(2);
    await expect(page.getByText(tr['calc.logicLevel.warning'], { exact: true })).toHaveCount(0);
  });

  test('mutlak maksimum girilince aşırı gerilim uyarısı çıkar', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('alp-comm-lang', 'tr');
    });
    await page.goto(LOGIC_CALC_PATH);

    await expect(page.getByText(tr['calc.logicLevel.overvoltage'])).toHaveCount(0);
    // A 3.0 V sürüyor; B'nin mutlak maksimumu 2.0 V ise seviyeler uyumlu olsa da zarar riski var.
    await page.locator('#calc-logic-b-absmax').fill('2.0');
    await expect(page.getByText(tr['calc.logicLevel.overvoltage'])).toHaveCount(1);
  });

  test('1440 ve 390 pikselde yatay taşma yok', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(LOGIC_CALC_PATH);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    const wide = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(wide, 'sayfa 1440px genişlikte yatayda taşıyor').toBeLessThanOrEqual(0);

    await page.setViewportSize({ width: 390, height: 844 });
    const narrow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(narrow, 'sayfa 390px genişlikte yatayda taşıyor').toBeLessThanOrEqual(0);
  });
});
