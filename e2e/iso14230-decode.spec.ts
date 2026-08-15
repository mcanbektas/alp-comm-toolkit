import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { translations } from '../src/translations';

/**
 * Faz 10 dalga 2b'nin gerçek tarayıcı turu — ISO 14230 (KWP2000).
 *
 * Kanıtladığı şey: brief-faz10-dalga2b.md'nin dış kaynakla (freediag
 * `diag_l2_iso14230.c`) çapraz doğrulanmış FMT baytı bit düzeni ekranda
 * gerçekten çözülüyor — adres kipinin dört değeri (No Address/Physical/
 * Functional/CARB-uyarı), uzunluğun iki taşınma yolu (FMT-içi/ayrı LEN
 * baytı), SID'in ham+serviceNeedsTable uyarısı ve checksum doğrulaması.
 */

const tr = translations.tr;

const CANONICAL_DECODE_PATH = '/comm/automotive/legacy-diagnostics/iso-14230?tab=decode';

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

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('ISO 14230 (KWP2000)');
  await expect(page.getByTestId('decode-panel')).toHaveAttribute('data-plugin-id', 'iso-14230');
  await expect(page.getByText(tr['status.partial'], { exact: true })).toBeVisible();
  await expect(page.getByText(tr['protocol.plannedNotice'])).toHaveCount(0);

  expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
});

test('fiziksel adresleme + FMT-içi uzunluk: Target/Source/SID alan alan çözülür', async ({
  page,
}) => {
  await openDecodePanel(page);

  await expect(page.locator('#decode-hex')).toHaveValue('83 10 F1 21 00 0C B1');
  await expect(page.getByTestId('decode-byte-count')).toContainText('7');

  await expect(fieldRow(page, 'fmt').getByTestId('decode-field-raw')).toHaveText('0x83 (131)');
  await expect(fieldRow(page, 'fmt').getByTestId('decode-field-physical')).toHaveText('Physical');
  await expect(fieldRow(page, 'target-address').getByTestId('decode-field-raw')).toHaveText(
    '0x10 (16)',
  );
  await expect(fieldRow(page, 'source-address').getByTestId('decode-field-raw')).toHaveText(
    '0xF1 (241)',
  );
  await expect(fieldRow(page, 'sid').getByTestId('decode-field-raw')).toHaveText('0x21 (33)');
  await expect(fieldWarning(page, 'sid')).toContainText(
    tr['protocol.iso14230.warning.serviceNeedsTable'],
  );
  await expect(fieldRow(page, 'checksum').getByTestId('decode-field-raw')).toHaveText(
    '0xB1 (177)',
  );
  await expect(fieldRow(page, 'length')).toHaveCount(0);

  await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
  await expectNoRawTranslationKeys(page);
});

test('fonksiyonel adresleme + ayrı LEN baytı: uzunluğun ikinci taşınma yolu', async ({ page }) => {
  await openDecodePanel(page);

  await page.getByLabel(tr['decode.example.label']).selectOption('functional-separate-length');

  await expect(fieldRow(page, 'fmt').getByTestId('decode-field-physical')).toHaveText('Functional');
  await expect(fieldRow(page, 'length').getByTestId('decode-field-raw')).toHaveText('0x4 (4)');
  await expect(fieldRow(page, 'sid').getByTestId('decode-field-raw')).toHaveText('0x14 (20)');
  await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
  await expectNoRawTranslationKeys(page);
});

test('adressiz kip (00): Target/Source üretilmez', async ({ page }) => {
  await openDecodePanel(page);

  await page.getByLabel(tr['decode.example.label']).selectOption('no-address');

  await expect(fieldRow(page, 'fmt').getByTestId('decode-field-physical')).toHaveText(
    'No Address',
  );
  await expect(fieldRow(page, 'target-address')).toHaveCount(0);
  await expect(fieldRow(page, 'source-address')).toHaveCount(0);
  await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
});

test('CARB kipi (01) hata değil uyarı basar', async ({ page }) => {
  await openDecodePanel(page);

  await page.getByLabel(tr['decode.example.label']).selectOption('carb-mode-warning');

  // CARB kipi hem FMT'nin bilinmeyen-adres-kipi uyarısını hem de SID'in her
  // zaman basılan serviceNeedsTable uyarısını birlikte üretir — iki ayrı satır.
  await expect(
    page
      .getByTestId('decode-frame-warning')
      .filter({ hasText: tr['protocol.iso14230.warning.unknownAddressMode'] }),
  ).toHaveCount(1);
  await expect(fieldRow(page, 'target-address')).toHaveCount(0);
  await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
  await expectNoRawTranslationKeys(page);
});

test('bozuk checksum checksum-mismatch hatası basar', async ({ page }) => {
  await openDecodePanel(page);

  await page.getByLabel(tr['decode.example.label']).selectOption('checksum-mismatch');

  const frameError = page.getByTestId('decode-frame-error');
  await expect(frameError).toHaveCount(1);
  await expect(frameError).toHaveAttribute('data-error-code', 'checksum-mismatch');
  await expectNoRawTranslationKeys(page);
});

test('Service ID/Checksum için yer kalmayan örnek truncated-frame basar, adres alanları görünür', async ({
  page,
}) => {
  await openDecodePanel(page);

  await page.getByLabel(tr['decode.example.label']).selectOption('service-data-truncated');

  const frameError = page.getByTestId('decode-frame-error');
  await expect(frameError).toHaveCount(1);
  await expect(frameError).toHaveAttribute('data-error-code', 'truncated-frame');
  await expect(fieldRow(page, 'target-address')).toHaveCount(1);
  await expect(fieldRow(page, 'sid')).toHaveCount(0);
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
