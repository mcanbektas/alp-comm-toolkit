import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { translations } from '../src/translations';

/**
 * Faz 10 dalga 1'in gerçek tarayıcı turu — CANopen.
 *
 * Kanıtladığı şey: COB-ID'nin function code + Node-ID kırılımı ekranda gerçek
 * mesaj tiplerini (NMT/PDO/SDO) adlandırıyor ve spec'in verdiği iki örnek
 * (PDO 0x181 → `37 12 DC 05`, SDO Index 6040 Sub 00 Write `000F`) doğru
 * çözülüyor — payload EDS gerektirdiği için HAM kalıyor.
 */

const tr = translations.tr;

const CANONICAL_DECODE_PATH = '/comm/industrial-automation/cip-can-based/canopen?tab=decode';
/** İlk örnek `nmt-start-remote-node`: COB-ID 0x000, komut 0x01, hedef node 0x00. */
const NMT_HEX = '00 00 00 00 02 00 00 00 01 00 00 00 00 00 00 00';

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

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('CANopen');
  await expect(page.getByTestId('decode-panel')).toHaveAttribute('data-plugin-id', 'canopen');
  await expect(page.getByText(tr['status.ready'], { exact: true })).toBeVisible();
  await expect(page.getByText(tr['protocol.plannedNotice'])).toHaveCount(0);

  expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
});

test('NMT örneği function code’u adlandırır, komutu ham gösterir', async ({ page }) => {
  await openDecodePanel(page);

  await expect(page.locator('#decode-hex')).toHaveValue(NMT_HEX);
  await expect(fieldRow(page, 'function-code').getByTestId('decode-field-physical')).toHaveText(
    'NMT',
  );
  await expect(fieldRow(page, 'command').getByTestId('decode-field-raw')).toHaveText('0x1 (1)');
  await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
});

test('PDO örneği (spec özet 04:102) node’u tanır, veriyi HAM bırakır', async ({ page }) => {
  await openDecodePanel(page);

  await page.getByLabel(tr['decode.example.label']).selectOption('pdo-statusword-velocity');

  await expect(fieldRow(page, 'function-code').getByTestId('decode-field-physical')).toHaveText(
    'PDO1 (Tx)',
  );
  await expect(fieldRow(page, 'node-id').getByTestId('decode-field-raw')).toHaveText('0x1 (1)');
  await expect(fieldRow(page, 'data').getByTestId('decode-field-physical')).toHaveText('—');
  await expect(page.getByTestId('decode-frame-warning')).toContainText(
    tr['protocol.canopen.warning.pdoNeedsMapping'],
  );
});

test('SDO örneği (spec özet 03:87) Index 6040 Sub 00’ı çözer', async ({ page }) => {
  await openDecodePanel(page);

  await page.getByLabel(tr['decode.example.label']).selectOption('sdo-write-controlword');

  await expect(fieldRow(page, 'function-code').getByTestId('decode-field-physical')).toHaveText(
    'SDO (Rx)',
  );
  await expect(fieldRow(page, 'command-byte').getByTestId('decode-field-physical')).toHaveText(
    'Expedited',
  );
  await expect(fieldRow(page, 'index').getByTestId('decode-field-raw')).toHaveText(
    '0x6040 (24640)',
  );
  await expect(fieldRow(page, 'sub-index').getByTestId('decode-field-raw')).toHaveText('0x0 (0)');
  await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
});

test('ayrılmış function code hatayı basar ama çerçeveyi yine gösterir', async ({ page }) => {
  await openDecodePanel(page);

  await page.getByLabel(tr['decode.example.label']).selectOption('reserved-function-code-rejected');

  const frameError = page.getByTestId('decode-frame-error');
  await expect(frameError).toHaveCount(1);
  await expect(frameError).toHaveAttribute('data-error-code', 'value-out-of-range');
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
