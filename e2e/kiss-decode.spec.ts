import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { translations } from '../src/translations/all';

/**
 * Faz 10 dalga 10b'nin gerçek tarayıcı turu — KISS. Çerçeveleme motoru
 * (Faz 6, SLIP'in aynısı) doğrulandı; bu dosya motoru değil, motor↔ekran
 * bağlantısını ve Type Indicator/payload çözümünü sınar.
 */

const tr = translations.tr;
const CANONICAL_DECODE_PATH = '/comm/interfaces-framing/framing-stream-protocols/kiss?tab=decode';

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
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('KISS');
  await expect(page.getByTestId('decode-panel')).toHaveAttribute('data-plugin-id', 'kiss');
  await expect(page.getByText(tr['status.ready'], { exact: true })).toBeVisible();
  await expect(page.getByText(tr['protocol.plannedNotice'])).toHaveCount(0);
  expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
});

test('Data Frame: Type Indicator port/komut olarak, payload AX.25 olarak ham gösterilir', async ({ page }) => {
  await openDecodePanel(page);
  await selectExample(page, 'data-frame');
  await expect(fieldRow(page, 'type-indicator').getByTestId('decode-field-raw')).toHaveText('0x00');
  await expect(fieldRow(page, 'type-indicator').getByTestId('decode-field-physical')).toHaveText('Port 0 — Data Frame');
  await expect(fieldRow(page, 'payload').getByTestId('decode-field-raw')).toHaveText('11 22 33');
  await expect(fieldRow(page, 'payload').getByTestId('decode-field-physical')).toContainText('AX.25');
});

test('TXDELAY komutu: parametre 10ms biriminden ms’ye çevrilir', async ({ page }) => {
  await openDecodePanel(page);
  await selectExample(page, 'txdelay-command');
  await expect(fieldRow(page, 'type-indicator').getByTestId('decode-field-physical')).toHaveText('Port 0 — TXDELAY');
  await expect(fieldRow(page, 'payload').getByTestId('decode-field-physical')).toHaveText('500 ms (raw value 50 × 10ms unit)');
});

test('kaçışlı Data Frame: FEND/FESC baytları ayrı escape-event alanlarında', async ({ page }) => {
  await openDecodePanel(page);
  await selectExample(page, 'escaped-data-frame');
  await expect(fieldRow(page, 'escape-event-0').getByTestId('decode-field-raw')).toHaveText('0xDB 0xDC');
  await expect(fieldRow(page, 'escape-event-0').getByTestId('decode-field-physical')).toContainText('0xC0');
  await expect(fieldRow(page, 'escape-event-1').getByTestId('decode-field-physical')).toContainText('0xDB');
  await expect(fieldRow(page, 'payload').getByTestId('decode-field-raw')).toHaveText('11 C0 22 DB 33');
});

test('1440 ve 390 pikselde yatay taşma yok', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openDecodePanel(page);
  await selectExample(page, 'escaped-data-frame');
  await expect(page.getByTestId('decode-field-table')).toBeVisible();
  const wide = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(wide, 'sayfa 1440px genişlikte yatayda taşıyor').toBeLessThanOrEqual(0);

  await page.setViewportSize({ width: 390, height: 844 });
  const narrow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(narrow, 'sayfa 390px genişlikte yatayda taşıyor').toBeLessThanOrEqual(0);
});
