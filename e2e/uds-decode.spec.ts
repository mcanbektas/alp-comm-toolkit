import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { translations } from '../src/translations';

/**
 * Faz 10 dalga 1'in gerçek tarayıcı turu — UDS.
 *
 * Kanıtladığı şey: spec özet 04-otomotiv.md'nin BİREBİR verdiği iki örnek
 * (`22 F1 90` → Read Data By Identifier; `7F 22 31` → NRC 0x31) ekranda
 * gerçekten o değerleri basıyor ve NRC tablosunun eksik olduğu uyarıyla söyleniyor.
 */

const tr = translations.tr;

const CANONICAL_DECODE_PATH = '/comm/automotive/diagnostics/uds?tab=decode';
/** İlk örnek `read-data-by-identifier-request`: spec özet 04:263. */
const READ_DID_HEX = '22 F1 90';

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

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('UDS');
  await expect(page.getByTestId('decode-panel')).toHaveAttribute('data-plugin-id', 'uds');
  await expect(page.getByText(tr['status.ready'], { exact: true })).toBeVisible();
  await expect(page.getByText(tr['protocol.plannedNotice'])).toHaveCount(0);

  expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
});

test('Read Data By Identifier örneği spec’in verdiği DID’i basar (spec özet 04:263)', async ({
  page,
}) => {
  await openDecodePanel(page);

  await expect(page.locator('#decode-hex')).toHaveValue(READ_DID_HEX);
  await expect(fieldRow(page, 'sid').getByTestId('decode-field-physical')).toHaveText(
    'Read Data By Identifier',
  );
  // Parametre baytları (DID 0xF190) isme bağlanmaz — satır var, ham içerik iddiası yok.
  await expect(fieldRow(page, 'parameters')).toHaveCount(1);
  await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
});

test('negatif yanıt örneği NRC 0x31’i basar ve veritabanı gerektiğini söyler (spec özet 04:265)', async ({
  page,
}) => {
  await openDecodePanel(page);

  await page.getByLabel(tr['decode.example.label']).selectOption('negative-response-request-out-of-range');

  await expect(fieldRow(page, 'response-code').getByTestId('decode-field-physical')).toHaveText(
    'Negative Response',
  );
  await expect(fieldRow(page, 'original-sid').getByTestId('decode-field-physical')).toHaveText(
    'Read Data By Identifier',
  );
  await expect(fieldRow(page, 'nrc').getByTestId('decode-field-raw')).toHaveText('0x31 (49)');
  await expect(page.getByTestId('decode-frame-warning')).toContainText(
    tr['protocol.uds.warning.nrcNeedsDatabase'],
  );
});

test('eksik NRC’li negatif yanıt truncated-frame basar', async ({ page }) => {
  await openDecodePanel(page);

  await page.getByLabel(tr['decode.example.label']).selectOption('negative-response-truncated');

  const frameError = page.getByTestId('decode-frame-error');
  await expect(frameError).toHaveCount(1);
  await expect(frameError).toHaveAttribute('data-error-code', 'truncated-frame');
  await expect(fieldRow(page, 'original-sid')).toHaveCount(1);
  await expect(fieldRow(page, 'nrc')).toHaveCount(0);
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
