import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { translations } from '../src/translations';

/**
 * Faz 10 dalga 10e'nin gerçek tarayıcı turu — Custom Binary Protocol. Şema
 * `specFixture.ts`ten AYNEN alındı (unit seviyesinde zaten doğrulandı); bu
 * dosya motoru değil, `createSchemaParser`↔ekran bağlantısını sınar.
 */

const tr = translations.tr;
const CANONICAL_DECODE_PATH = '/comm/interfaces-framing/framing-stream-protocols/custom-binary-protocol?tab=decode';

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
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Custom Binary Protocol');
  await expect(page.getByTestId('decode-panel')).toHaveAttribute('data-plugin-id', 'custom-binary-protocol');
  await expect(page.getByText(tr['status.ready'], { exact: true })).toBeVisible();
  expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
});

test('sensor-data örneği: address/command/checksum PASS gösterir', async ({ page }) => {
  await openDecodePanel(page);
  await selectExample(page, 'sensor-data');
  await expect(fieldRow(page, 'address').getByTestId('decode-field-raw')).toHaveText('0x5 (5)');
  await expect(fieldRow(page, 'command').getByTestId('decode-field-physical')).toHaveText('Sensor Data');
  await expect(fieldRow(page, 'checksum').getByTestId('decode-field-physical')).toHaveText('valid');
});

test('checksum-mismatch örneği: checksum invalid gösterir', async ({ page }) => {
  await openDecodePanel(page);
  await selectExample(page, 'checksum-mismatch');
  await expect(fieldRow(page, 'checksum').getByTestId('decode-field-physical')).toHaveText('invalid');
});

test('1440 ve 390 pikselde yatay taşma yok', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openDecodePanel(page);
  await selectExample(page, 'sensor-data');
  await expect(page.getByTestId('decode-field-table')).toBeVisible();
  const wide = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(wide, 'sayfa 1440px genişlikte yatayda taşıyor').toBeLessThanOrEqual(0);

  await page.setViewportSize({ width: 390, height: 844 });
  const narrow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(narrow, 'sayfa 390px genişlikte yatayda taşıyor').toBeLessThanOrEqual(0);
});
