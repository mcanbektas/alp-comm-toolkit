import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { translations } from '../src/translations';

/**
 * Faz 10 dalga 10c'nin gerçek tarayıcı turu — SDLC. Çerçeveleme/FCS motor
 * seviyesinde (`hdlcCore.ts`, HDLC ile paylaşılan) doğrulandı; bu dosya
 * motoru değil, motor↔ekran bağlantısını ve Station Address yorumunu sınar.
 */

const tr = translations.tr;
const CANONICAL_DECODE_PATH = '/comm/interfaces-framing/framing-stream-protocols/sdlc?tab=decode';

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
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('SDLC');
  await expect(page.getByTestId('decode-panel')).toHaveAttribute('data-plugin-id', 'sdlc');
  await expect(page.getByText(tr['status.ready'], { exact: true })).toBeVisible();
  await expect(page.getByText(tr['protocol.plannedNotice'])).toHaveCount(0);
  expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
});

test('I-frame: Station Address + N(S)/N(R) çözülür, FCS PASS gösterir', async ({ page }) => {
  await openDecodePanel(page);
  await selectExample(page, 'i-frame');
  await expect(fieldRow(page, 'station-address').getByTestId('decode-field-raw')).toHaveText('0x04');
  await expect(fieldRow(page, 'send-sequence-number').getByTestId('decode-field-raw')).toHaveText('0x1 (1)');
  await expect(fieldRow(page, 'fcs').getByTestId('decode-field-physical')).toContainText('PASS');
});

test('yayın adresi (0xFF) All-Stations olarak adlanır', async ({ page }) => {
  await openDecodePanel(page);
  await selectExample(page, 'poll');
  await expect(fieldRow(page, 'station-address').getByTestId('decode-field-physical')).toHaveText('All-Stations (broadcast)');
  await expect(fieldRow(page, 'supervisory-type').getByTestId('decode-field-raw')).toHaveText('RR (Receive Ready)');
  await expect(fieldRow(page, 'poll-final').getByTestId('decode-field-raw')).toHaveText('0x1 (1)');
});

test('U-frame: yalnız format gösterilir, sıra numarası/S-tipi alanı yok', async ({ page }) => {
  await openDecodePanel(page);
  await selectExample(page, 'u-frame');
  await expect(fieldRow(page, 'control').getByTestId('decode-field-physical')).toHaveText('U-format');
  await expect(page.locator('[data-testid="decode-field-row"][data-field-id="send-sequence-number"]')).toHaveCount(0);
});

test('1440 ve 390 pikselde yatay taşma yok', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openDecodePanel(page);
  await selectExample(page, 'i-frame');
  await expect(page.getByTestId('decode-field-table')).toBeVisible();
  const wide = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(wide, 'sayfa 1440px genişlikte yatayda taşıyor').toBeLessThanOrEqual(0);

  await page.setViewportSize({ width: 390, height: 844 });
  const narrow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(narrow, 'sayfa 390px genişlikte yatayda taşıyor').toBeLessThanOrEqual(0);
});
