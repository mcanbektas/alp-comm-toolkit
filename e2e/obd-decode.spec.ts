import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { translations } from '../src/translations';

/**
 * Faz 10 dalga 1'in gerçek tarayıcı turu — OBD-II.
 *
 * Kanıtladığı şey: sayfa `status: 'partial'` rozetiyle açılıyor (Kısmi, Hazır
 * DEĞİL) ve spec özet 04-otomotiv.md:295'in doğrulanmış RPM fixture'ı (`41 0C
 * 1A F8`) ekranda mod adını basıyor — PID/veri baytları isme BAĞLANMIYOR.
 */

const tr = translations.tr;

const CANONICAL_DECODE_PATH = '/comm/automotive/diagnostics/obd-ii?tab=decode';
/** İlk örnek `current-data-request`: Mode 01 + gösterim amaçlı PID baytı. */
const CURRENT_DATA_HEX = '01 0C';

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

function fieldRow(page: Page, fieldId: string) {
  return page.locator(`[data-testid="decode-field-row"][data-field-id="${fieldId}"]`);
}

test('decode sekmesi Kısmi rozetiyle açılır (Hazır DEĞİL) ve konsola hata basmaz', async ({
  page,
}) => {
  const consoleErrors = await openDecodePanel(page);

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('OBD-II');
  await expect(page.getByTestId('decode-panel')).toHaveAttribute('data-plugin-id', 'obd-ii');
  await expect(page.getByText(tr['status.partial'], { exact: true })).toBeVisible();
  await expect(page.getByText(tr['status.ready'], { exact: true })).toHaveCount(0);
  await expect(page.getByText(tr['protocol.plannedNotice'])).toHaveCount(0);

  expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
});

test('Mode 01 örneği modu adlandırır', async ({ page }) => {
  await openDecodePanel(page);

  await expect(page.locator('#decode-hex')).toHaveValue(CURRENT_DATA_HEX);
  await expect(fieldRow(page, 'mode').getByTestId('decode-field-physical')).toHaveText(
    'Current Data',
  );
  await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
});

test('Engine RPM yanıtı (spec özet 04:295) mod adını basar, PID/veriyi HAM bırakır', async ({
  page,
}) => {
  await openDecodePanel(page);

  await page.getByLabel(tr['decode.example.label']).selectOption('engine-rpm-response');

  await expect(fieldRow(page, 'mode').getByTestId('decode-field-raw')).toHaveText('0x41 (65)');
  await expect(fieldRow(page, 'mode').getByTestId('decode-field-physical')).toHaveText(
    'Current Data',
  );
  // PID (0x0C) ve RPM baytları (1A F8) isme/formüle BAĞLANMAZ — satır var, çözülmez.
  await expect(fieldRow(page, 'parameters')).toHaveCount(1);
  await expect(fieldRow(page, 'parameters').getByTestId('decode-field-physical')).toHaveText('—');
});

test('tanınmayan mod alanı geçersiz işaretler ve uyarıyı söyler', async ({ page }) => {
  await openDecodePanel(page);

  await page.getByLabel(tr['decode.example.label']).selectOption('unknown-mode');

  await expect(fieldRow(page, 'mode')).toHaveAttribute('data-valid', 'false');
  await expect(page.getByTestId('decode-frame-warning')).toContainText(
    tr['protocol.obd.warning.unknownMode'],
  );
});

test('1440 ve 390 pikselde yatay taşma yok', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openDecodePanel(page);
  await expect(page.getByTestId('decode-field-table')).toBeVisible();
  const wide = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(wide, 'sayfa 1440px genişlikte yatayda taşıyor').toBeLessThanOrEqual(0);

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByTestId('decode-field-table')).toBeVisible();
  const narrow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(narrow, 'sayfa 390px genişlikte yatayda taşıyor').toBeLessThanOrEqual(0);
});
