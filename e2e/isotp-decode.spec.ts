import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { translations } from '../src/translations/all';

/**
 * Faz 10 dalga 1'in gerçek tarayıcı turu — ISO-TP.
 *
 * Kanıtladığı şey: spec özet 04-otomotiv.md'nin metin içi örnekleri (SF `02 10 01`
 * → SF_DL 2; FF `10 14 …` → FF_DL 20) ekranda gerçekten o değerleri basıyor ve
 * çok çerçeveli oturum uyarısı FF/CF/FC'de görünüyor, SF'de görünmüyor.
 */

const tr = translations.tr;

const CANONICAL_DECODE_PATH = '/comm/automotive/diagnostics/iso-tp?tab=decode';
/** İlk örnek `single-frame`: SocketCAN struct, CAN ID 0x7A1 extended, PCI 02 10 01. */
const SINGLE_FRAME_HEX = 'A1 07 00 80 08 00 00 00 02 10 01 00 00 00 00 00';

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

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('ISO-TP');
  await expect(page.getByTestId('decode-panel')).toHaveAttribute('data-plugin-id', 'iso-tp');
  await expect(page.getByText(tr['status.ready'], { exact: true })).toBeVisible();
  await expect(page.getByText(tr['protocol.plannedNotice'])).toHaveCount(0);

  expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
});

test('Single Frame örneği spec’in metin içi değerini basar (SF_DL 2)', async ({ page }) => {
  await openDecodePanel(page);

  await expect(page.locator('#decode-hex')).toHaveValue(SINGLE_FRAME_HEX);
  await expect(fieldRow(page, 'pci-type').getByTestId('decode-field-physical')).toHaveText(
    'Single Frame',
  );
  await expect(fieldRow(page, 'sf-dl').getByTestId('decode-field-raw')).toHaveText('0x2 (2)');
  await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
});

test('First Frame örneği FF_DL 20’yi basar ve oturum uyarısı gösterir', async ({ page }) => {
  await openDecodePanel(page);

  await page.getByLabel(tr['decode.example.label']).selectOption('first-frame');

  await expect(fieldRow(page, 'pci-type').getByTestId('decode-field-physical')).toHaveText(
    'First Frame',
  );
  await expect(fieldRow(page, 'ff-dl').getByTestId('decode-field-raw')).toHaveText('0x14 (20)');
  await expect(page.getByTestId('decode-frame-warning')).toContainText(
    tr['protocol.isotp.warning.transportSession'],
  );
});

test('Flow Control örneği STmin’i HAM BAYT gösterir, birim eklemez', async ({ page }) => {
  await openDecodePanel(page);

  await page.getByLabel(tr['decode.example.label']).selectOption('flow-control-continue');

  await expect(fieldRow(page, 'flow-status').getByTestId('decode-field-physical')).toHaveText(
    'Continue To Send',
  );
  const stmin = fieldRow(page, 'separation-time');
  await expect(stmin.getByTestId('decode-field-raw')).toHaveText('0xA (10)');
  // Kasıtlı: kodlama tablosu yok, fiziksel sütun boş glif basar (ms/µs'ye çevrilmez).
  await expect(stmin.getByTestId('decode-field-physical')).toHaveText('—');
});

test('tanınmayan PCI tipi hatayı basar ama çerçeveyi yine gösterir', async ({ page }) => {
  await openDecodePanel(page);

  await page.getByLabel(tr['decode.example.label']).selectOption('unknown-pci-type-rejected');

  const frameError = page.getByTestId('decode-frame-error');
  await expect(frameError).toHaveCount(1);
  await expect(frameError).toHaveAttribute('data-error-code', 'value-out-of-range');
  await expect(fieldRow(page, 'data')).toHaveCount(1);
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
