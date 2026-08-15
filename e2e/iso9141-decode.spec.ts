import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { translations } from '../src/translations';

/**
 * Faz 10 dalga 2b'nin gerçek tarayıcı turu — ISO 9141-2.
 *
 * Kanıtladığı şey: brief-faz10-dalga2b.md'nin dış kaynakla (freediag
 * `diag_l2_iso9141.c`) çapraz doğrulanmış sabit header (0x68/0x6A, uyarılı-ama-
 * ham farklı değerde) + Source Address (ham, uyarısız) + veri (ham +
 * NeedsObdPage uyarısı) + checksum düzeni ekranda gerçekten çözülüyor.
 */

const tr = translations.tr;

const CANONICAL_DECODE_PATH = '/comm/automotive/legacy-diagnostics/iso-9141?tab=decode';

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

/** Alan seviyesindeki uyarı `<li>`'si field satırının KENDİSİ değil, ardından
 * gelen ayrı bir `<tr>` içinde durur (DecodePanel.tsx) — `data-field-id` ile
 * sayfa düzeyinde aranır, `fieldRow(...).getByTestId(...)` bulamaz. */
function fieldWarning(page: Page, fieldId: string): Locator {
  return page.locator(`[data-testid="decode-field-warning"][data-field-id="${fieldId}"]`);
}

async function expectNoRawTranslationKeys(page: Page): Promise<void> {
  for (const testId of ['decode-field-warning', 'decode-frame-warning', 'decode-frame-error']) {
    for (const metin of await page.getByTestId(testId).allTextContents()) {
      expect(metin.trim(), `${testId} çevrilmemiş anahtar basıyor`).not.toMatch(
        /^[a-z][a-zA-Z0-9]*(\.[a-zA-Z0-9]+)+$/,
      );
    }
  }
}

test('decode sekmesi Kısmi rozetiyle açılır ve konsola hata basmaz', async ({ page }) => {
  const consoleErrors = await openDecodePanel(page);

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('ISO 9141');
  await expect(page.getByTestId('decode-panel')).toHaveAttribute('data-plugin-id', 'iso-9141');
  await expect(page.getByText(tr['status.partial'], { exact: true })).toBeVisible();
  await expect(page.getByText(tr['protocol.plannedNotice'])).toHaveCount(0);

  expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
});

test('standart header: Format/Target/Source çözülür, veri ham kalıp OBD-II sayfasına yönlendirir', async ({
  page,
}) => {
  await openDecodePanel(page);

  await expect(page.locator('#decode-hex')).toHaveValue('68 6A F1 41 0C 1A F8 22');
  await expect(page.getByTestId('decode-byte-count')).toContainText('8');

  await expect(fieldRow(page, 'format').getByTestId('decode-field-raw')).toHaveText('0x68 (104)');
  await expect(fieldRow(page, 'format').getByTestId('decode-field-validity')).toHaveText(
    tr['decode.status.valid'],
  );
  await expect(fieldRow(page, 'target-address').getByTestId('decode-field-raw')).toHaveText(
    '0x6A (106)',
  );
  await expect(fieldRow(page, 'source-address').getByTestId('decode-field-raw')).toHaveText(
    '0xF1 (241)',
  );
  await expect(fieldWarning(page, 'data')).toContainText(
    tr['protocol.iso9141.warning.dataNeedsObdPage'],
  );
  await expect(fieldRow(page, 'checksum').getByTestId('decode-field-raw')).toHaveText(
    '0x22 (34)',
  );

  await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
  await expectNoRawTranslationKeys(page);
});

test('beklenmeyen Format baytı hata değil uyarı basar, ham gösterir', async ({ page }) => {
  await openDecodePanel(page);

  await page.getByLabel(tr['decode.example.label']).selectOption('unexpected-format-byte');

  await expect(fieldRow(page, 'format').getByTestId('decode-field-raw')).toHaveText('0x48 (72)');
  await expect(fieldRow(page, 'format').getByTestId('decode-field-validity')).toHaveText(
    tr['decode.status.invalid'],
  );
  // Bu örnekte veri de var, o yüzden dataNeedsObdPage uyarısı da basılır —
  // iki ayrı frame-warning satırından biri format uyarısını taşır.
  await expect(
    page
      .getByTestId('decode-frame-warning')
      .filter({ hasText: tr['protocol.iso9141.warning.unexpectedFormatByte'] }),
  ).toHaveCount(1);
  await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
  await expectNoRawTranslationKeys(page);
});

test('beklenmeyen Target Address hata değil uyarı basar, ham gösterir', async ({ page }) => {
  await openDecodePanel(page);

  await page.getByLabel(tr['decode.example.label']).selectOption('unexpected-target-address');

  await expect(fieldRow(page, 'target-address').getByTestId('decode-field-raw')).toHaveText(
    '0x48 (72)',
  );
  await expect(
    page
      .getByTestId('decode-frame-warning')
      .filter({ hasText: tr['protocol.iso9141.warning.unexpectedTargetAddress'] }),
  ).toHaveCount(1);
  await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
  await expectNoRawTranslationKeys(page);
});

test('veri baytı yoksa data alanı ve NeedsObdPage uyarısı üretilmez', async ({ page }) => {
  await openDecodePanel(page);

  await page.getByLabel(tr['decode.example.label']).selectOption('zero-data');

  await expect(fieldRow(page, 'data')).toHaveCount(0);
  await expect(page.getByTestId('decode-frame-warning')).toHaveCount(0);
  await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
});

test('bozuk checksum checksum-mismatch hatası basar', async ({ page }) => {
  await openDecodePanel(page);

  await page.getByLabel(tr['decode.example.label']).selectOption('checksum-mismatch');

  const frameError = page.getByTestId('decode-frame-error');
  await expect(frameError).toHaveCount(1);
  await expect(frameError).toHaveAttribute('data-error-code', 'checksum-mismatch');
  await expectNoRawTranslationKeys(page);
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
