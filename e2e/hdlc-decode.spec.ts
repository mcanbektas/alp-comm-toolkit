import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { translations } from '../src/translations/all';

/**
 * Faz 10 dalga 10c'nin gerçek tarayıcı turu — HDLC. Çerçeveleme
 * (`hdlcCore.ts`, kaçışsız start/end delimiter) ve FCS (CRC16_X25) motor
 * seviyesinde doğrulandı; bu dosya motoru değil, motor↔ekran bağlantısını
 * ve I/S/U dallanmasını sınar.
 */

const tr = translations.tr;
const CANONICAL_DECODE_PATH = '/comm/interfaces-framing/framing-stream-protocols/hdlc?tab=decode';

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
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('HDLC');
  await expect(page.getByTestId('decode-panel')).toHaveAttribute('data-plugin-id', 'hdlc');
  await expect(page.getByText(tr['status.ready'], { exact: true })).toBeVisible();
  await expect(page.getByText(tr['protocol.plannedNotice'])).toHaveCount(0);
  expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
});

test('I-frame: N(S)/N(R)/Information çözülür, FCS PASS gösterir', async ({ page }) => {
  await openDecodePanel(page);
  await selectExample(page, 'i-frame');
  await expect(fieldRow(page, 'control').getByTestId('decode-field-physical')).toHaveText('I-format');
  await expect(fieldRow(page, 'send-sequence-number').getByTestId('decode-field-raw')).toHaveText('0x1 (1)');
  await expect(fieldRow(page, 'receive-sequence-number').getByTestId('decode-field-raw')).toHaveText('0x2 (2)');
  await expect(fieldRow(page, 'information').getByTestId('decode-field-raw')).toHaveText('AA BB');
  await expect(fieldRow(page, 'fcs').getByTestId('decode-field-physical')).toContainText('PASS');
});

test('S-frame: Supervisory Type adlanır, Information alanı yok', async ({ page }) => {
  await openDecodePanel(page);
  await selectExample(page, 's-frame');
  await expect(fieldRow(page, 'control').getByTestId('decode-field-physical')).toHaveText('S-format');
  await expect(fieldRow(page, 'supervisory-type').getByTestId('decode-field-raw')).toHaveText('RR (Receive Ready)');
  await expect(page.locator('[data-testid="decode-field-row"][data-field-id="information"]')).toHaveCount(0);
});

test('U-frame: yalnız format gösterilir, sıra numarası/S-tipi alanı yok', async ({ page }) => {
  await openDecodePanel(page);
  await selectExample(page, 'u-frame');
  await expect(fieldRow(page, 'control').getByTestId('decode-field-physical')).toHaveText('U-format');
  await expect(page.locator('[data-testid="decode-field-row"][data-field-id="send-sequence-number"]')).toHaveCount(0);
  await expect(page.locator('[data-testid="decode-field-row"][data-field-id="supervisory-type"]')).toHaveCount(0);
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
