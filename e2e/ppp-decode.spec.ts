import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { translations } from '../src/translations';

/**
 * Faz 10 dalga 10b'nin gerçek tarayıcı turu — PPP. Çerçeveleme motoru
 * (Faz 6, HDLC-flag'in aynısı) doğrulandı; bu dosya motoru değil, motor↔ekran
 * bağlantısını ve Address/Control/Protocol/LCP çözümünü sınar.
 */

const tr = translations.tr;
const CANONICAL_DECODE_PATH = '/comm/interfaces-framing/framing-stream-protocols/ppp?tab=decode';

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
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('PPP');
  await expect(page.getByTestId('decode-panel')).toHaveAttribute('data-plugin-id', 'ppp');
  await expect(page.getByText(tr['status.ready'], { exact: true })).toBeVisible();
  await expect(page.getByText(tr['protocol.plannedNotice'])).toHaveCount(0);
  expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
});

test('LCP Configure-Request: Code/Identifier/Length ve MRU seçeneği çözülür', async ({ page }) => {
  await openDecodePanel(page);
  await selectExample(page, 'lcp-configure-request');
  await expect(fieldRow(page, 'address').getByTestId('decode-field-raw')).toHaveText('0xFF');
  await expect(fieldRow(page, 'protocol').getByTestId('decode-field-physical')).toHaveText('LCP (Link Control Protocol)');
  await expect(fieldRow(page, 'lcp-code').getByTestId('decode-field-raw')).toHaveText('0x1 (1)');
  await expect(fieldRow(page, 'lcp-code').getByTestId('decode-field-physical')).toHaveText('Configure-Request');
  await expect(fieldRow(page, 'lcp-option-0').getByTestId('decode-field-physical')).toHaveText('MRU = 1500 bytes');
});

test('ACFC + PFC: Address/Control yok, Protocol tek bayt sıkıştırılmış çözülür', async ({ page }) => {
  await openDecodePanel(page);
  await selectExample(page, 'compressed-fields');
  await expect(page.locator('[data-testid="decode-field-row"][data-field-id="address"]')).toHaveCount(0);
  await expect(fieldRow(page, 'protocol').getByTestId('decode-field-raw')).toHaveText('0x21');
  await expect(fieldRow(page, 'protocol').getByTestId('decode-field-physical')).toHaveText('IPv4');
  await expect(fieldRow(page, 'information').getByTestId('decode-field-raw')).toHaveText('45 00 00 14');
});

test('kaçışlı Information: 0x7E baytı escape-event alanında, payload doğru offsette', async ({ page }) => {
  await openDecodePanel(page);
  await selectExample(page, 'escaped-information');
  await expect(fieldRow(page, 'escape-event-0').getByTestId('decode-field-raw')).toHaveText('0x7D 0x5E');
  await expect(fieldRow(page, 'escape-event-0').getByTestId('decode-field-physical')).toContainText('0x7E');
  await expect(fieldRow(page, 'information').getByTestId('decode-field-raw')).toHaveText('01 7E 02');
});

test('1440 ve 390 pikselde yatay taşma yok', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openDecodePanel(page);
  await selectExample(page, 'lcp-configure-request');
  await expect(page.getByTestId('decode-field-table')).toBeVisible();
  const wide = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(wide, 'sayfa 1440px genişlikte yatayda taşıyor').toBeLessThanOrEqual(0);

  await page.setViewportSize({ width: 390, height: 844 });
  const narrow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(narrow, 'sayfa 390px genişlikte yatayda taşıyor').toBeLessThanOrEqual(0);
});
