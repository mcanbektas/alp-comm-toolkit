import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { translations } from '../src/translations';

/**
 * Faz 10 dalga 9 madde 7'nin gerçek tarayıcı turu — Hayes Command Set (V.250
 * TEMEL sözdizimi, at-commands'ın üstünde). `at-commands-decode.spec.ts`teki
 * aynı desen: bu dosya motoru değil, motor↔ekran bağlantısını sınar.
 */

const tr = translations.tr;
const CANONICAL_DECODE_PATH =
  '/comm/interfaces-framing/framing-stream-protocols/hayes-command-set?tab=decode';

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

async function expectNoRawTranslationKeys(page: Page): Promise<void> {
  for (const testId of ['decode-field-warning', 'decode-frame-warning', 'decode-frame-error']) {
    for (const metin of await page.getByTestId(testId).allTextContents()) {
      expect(metin.trim(), `${testId} çevrilmemiş anahtar basıyor`).not.toMatch(/^[a-z][a-zA-Z0-9]*(\.[a-zA-Z0-9]+)+$/);
    }
  }
}

async function selectExample(page: Page, exampleId: string): Promise<void> {
  await page.locator('#decode-example').selectOption(exampleId);
}

test('decode sekmesi Hazır rozetiyle açılır, konsola hata basmaz', async ({ page }) => {
  const consoleErrors = await openDecodePanel(page);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Hayes Command Set');
  await expect(page.getByTestId('decode-panel')).toHaveAttribute('data-plugin-id', 'hayes-command-set');
  await expect(page.getByText(tr['status.ready'], { exact: true })).toBeVisible();
  await expect(page.getByText(tr['protocol.plannedNotice'])).toHaveCount(0);
  expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
});

test('zincirlenmiş temel komutlar: Z, E0, V1 ayrı alanlarda çözülür', async ({ page }) => {
  await openDecodePanel(page);
  await selectExample(page, 'chained-reset-echo-verbose');
  await expect(fieldRow(page, 'basic-command-0').getByTestId('decode-field-raw')).toHaveText('Z');
  await expect(fieldRow(page, 'basic-command-0').getByTestId('decode-field-physical')).toContainText('reset');
  await expect(fieldRow(page, 'basic-command-1').getByTestId('decode-field-raw')).toHaveText('E0');
  await expect(fieldRow(page, 'basic-command-2').getByTestId('decode-field-raw')).toHaveText('V1');
  await expectNoRawTranslationKeys(page);
});

test('dial + komut moduna dönüş: dial-string ve devam eden zincir ayrı alanlarda', async ({ page }) => {
  await openDecodePanel(page);
  await selectExample(page, 'dial-with-return');
  await expect(fieldRow(page, 'dial-0-string').getByTestId('decode-field-raw')).toHaveText('5551234567');
  await expect(fieldRow(page, 'dial-0-return-to-command-mode').getByTestId('decode-field-raw')).toHaveText(';');
  await expect(fieldRow(page, 'basic-command-1').getByTestId('decode-field-raw')).toHaveText('H0');
  await expect(fieldRow(page, 'basic-command-1').getByTestId('decode-field-physical')).toContainText('hang up');
});

test('ATA cevap komutu: parametresiz, physicalValue "answer"', async ({ page }) => {
  await openDecodePanel(page);
  await selectExample(page, 'answer');
  await expect(fieldRow(page, 'basic-command-0').getByTestId('decode-field-raw')).toHaveText('A');
  await expect(fieldRow(page, 'basic-command-0').getByTestId('decode-field-physical')).toContainText('answer');
});

test('KARAR: belgesiz H parametresi (H1) uyarı basar, anlam uydurulmaz', async ({ page }) => {
  await openDecodePanel(page);
  await selectExample(page, 'hook-undocumented-param');
  await expect(fieldRow(page, 'basic-command-0').getByTestId('decode-field-raw')).toHaveText('H1');
  await expect(page.getByTestId('decode-field-warning')).toHaveCount(1);
  await expect(page.getByTestId('decode-field-warning')).toContainText(
    tr['protocol.hayesCommandSet.warning.hookParameterUndocumented'],
  );
  await expectNoRawTranslationKeys(page);
});

test('bilinen S-register yazma (S0): isim + değer ayrı alanlarda, uyarı yok', async ({ page }) => {
  await openDecodePanel(page);
  await selectExample(page, 's-register-write-known');
  // Sayısal rawValue'lar DecodePanel'de hex(decimal) biçiminde basılır (bkz.
  // at-commands'ın +CME ERROR emsali: `0xA (10)`).
  await expect(fieldRow(page, 's-register-0-number').getByTestId('decode-field-raw')).toHaveText('0x0 (0)');
  await expect(fieldRow(page, 's-register-0-number').getByTestId('decode-field-physical')).toContainText(
    'auto-answer ring count',
  );
  await expect(fieldRow(page, 's-register-0-value').getByTestId('decode-field-raw')).toHaveText('0x2 (2)');
  await expect(page.getByTestId('decode-field-warning')).toHaveCount(0);
});

test('satıcı-özel register (S12): uyarı + 20ms/birim dönüşümü gösterilir', async ({ page }) => {
  await openDecodePanel(page);
  await selectExample(page, 's-register-write-vendor-only');
  await expect(fieldRow(page, 's-register-0-value').getByTestId('decode-field-physical')).toContainText('1000');
  await expect(fieldRow(page, 's-register-0-value').getByTestId('decode-field-physical')).toContainText('ms');
  await expect(page.getByTestId('decode-field-warning')).toHaveCount(1);
  await expect(page.getByTestId('decode-field-warning')).toContainText(
    tr['protocol.hayesCommandSet.warning.sRegisterVendorOnly'],
  );
});

test('S-register yanıt adayı: üç haneli bare metin işaretlenir, kesin denmez', async ({ page }) => {
  await openDecodePanel(page);
  await selectExample(page, 's-register-response-candidate');
  await expect(fieldRow(page, 's-register-response-candidate').getByTestId('decode-field-raw')).toHaveText(
    '0xD (13)',
  );
  await expect(page.getByTestId('decode-field-warning')).toHaveCount(1);
  await expect(page.getByTestId('decode-field-warning')).toContainText(
    tr['protocol.hayesCommandSet.warning.sRegisterResponseAmbiguous'],
  );
});

test('numerik result code (ATV0): at-commands\'tan miras, physicalValue "OK"', async ({ page }) => {
  await openDecodePanel(page);
  await selectExample(page, 'numeric-result-code');
  await expect(fieldRow(page, 'result-code').getByTestId('decode-field-raw')).toHaveText('0x0 (0)');
  await expect(fieldRow(page, 'result-code').getByTestId('decode-field-physical')).toContainText('OK');
});

test('1440 ve 390 pikselde yatay taşma yok', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openDecodePanel(page);
  await selectExample(page, 's-register-write-known');
  await expect(page.getByTestId('decode-field-table')).toBeVisible();
  const wide = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(wide, 'sayfa 1440px genişlikte yatayda taşıyor').toBeLessThanOrEqual(0);

  await page.setViewportSize({ width: 390, height: 844 });
  const narrow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(narrow, 'sayfa 390px genişlikte yatayda taşıyor').toBeLessThanOrEqual(0);
});
