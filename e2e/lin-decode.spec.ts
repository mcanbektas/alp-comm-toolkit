import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { translations } from '../src/translations/all';

/**
 * Faz 10 dalga 1d'nin gerçek tarayıcı turu — LIN.
 *
 * Kanıtladığı şey: spec'in verdiği PID parite formülü (P0/P1) ve LIN 2.1'den
 * dış kaynaklı checksum algoritması ekranda gerçekten çalışıyor, ve motor
 * checksum baytının klasik mi geliştirilmiş mi konvansiyonla eşleştiğini
 * TEK birini varsaymadan gösteriyor.
 */

const tr = translations.tr;

const CANONICAL_DECODE_PATH = '/comm/automotive/vehicle-network-protocols/lin?tab=decode';
/** İlk örnek `valid-classic-checksum`: Sync 55, PID C1 (ID 0x01), veri 12 34, checksum B9. */
const CLASSIC_HEX = '55 C1 12 34 B9';

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

test('decode sekmesi Hazır rozetiyle açılır ve konsola hata basmaz', async ({ page }) => {
  const consoleErrors = await openDecodePanel(page);

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('LIN');
  await expect(page.getByTestId('decode-panel')).toHaveAttribute('data-plugin-id', 'lin');
  await expect(page.getByText(tr['status.ready'], { exact: true })).toBeVisible();
  await expect(page.getByText(tr['protocol.plannedNotice'])).toHaveCount(0);

  expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
});

test('Classic checksum örneği ID/parite/checksum’u doğru basar', async ({ page }) => {
  await openDecodePanel(page);

  await expect(page.locator('#decode-hex')).toHaveValue(CLASSIC_HEX);
  await expect(fieldRow(page, 'id').getByTestId('decode-field-raw')).toHaveText('0x1 (1)');
  await expect(fieldRow(page, 'parity').getByTestId('decode-field-physical')).toHaveText('Valid');
  await expect(fieldRow(page, 'checksum').getByTestId('decode-field-physical')).toHaveText(
    'Classic',
  );
  await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
});

test('Enhanced checksum örneği farklı konvansiyonla eşleşir', async ({ page }) => {
  await openDecodePanel(page);

  await page.getByLabel(tr['decode.example.label']).selectOption('valid-enhanced-checksum');

  await expect(fieldRow(page, 'checksum').getByTestId('decode-field-physical')).toHaveText(
    'Enhanced',
  );
});

test('parite hatası uyarı basar ama hata BASMAZ', async ({ page }) => {
  await openDecodePanel(page);

  await page.getByLabel(tr['decode.example.label']).selectOption('parity-mismatch');

  await expect(fieldRow(page, 'parity')).toHaveAttribute('data-valid', 'false');
  await expect(page.getByTestId('decode-frame-warning')).toContainText(
    tr['protocol.lin.warning.parityMismatch'],
  );
  await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
});

test('checksum hatası hem klasikle hem geliştirilmişle eşleşmeyince hata basar', async ({
  page,
}) => {
  await openDecodePanel(page);

  await page.getByLabel(tr['decode.example.label']).selectOption('checksum-mismatch-rejected');

  const frameError = page.getByTestId('decode-frame-error');
  await expect(frameError).toHaveCount(1);
  await expect(frameError).toHaveAttribute('data-error-code', 'checksum-mismatch');
});

test('geçersiz Sync baytı hata basar ama PID/checksum yine çözülür', async ({ page }) => {
  await openDecodePanel(page);

  await page.getByLabel(tr['decode.example.label']).selectOption('invalid-sync-rejected');

  const frameError = page.getByTestId('decode-frame-error');
  await expect(frameError).toHaveCount(1);
  await expect(frameError).toHaveAttribute('data-error-code', 'start-delimiter-not-found');
  await expect(fieldRow(page, 'id').getByTestId('decode-field-raw')).toHaveText('0x1 (1)');
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
