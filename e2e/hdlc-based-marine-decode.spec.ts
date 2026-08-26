import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { translations } from '../src/translations';

/**
 * Faz 10 dalga 16a'nın gerçek tarayıcı turu — HDLC-Based Marine.
 * Çerçeveleme/FCS motor seviyesinde (`hdlcCore.ts`, `hdlc`/`sdlc` ile
 * PAYLAŞILAN çekirdek) doğrulandı; bu dosya motoru değil, motor↔ekran
 * bağlantısını, "(candidate)" etiketleme disiplinini ve
 * `controlFieldProfile` seçeneğinin I/S/U alanlarını gerçekten
 * BELİRLETTİĞİNİ sınar (`sdlc-decode.spec.ts`nin birebir izlediği desen;
 * decodeOptions select etkileşimi `flexray-decode.spec.ts`teki
 * `#decode-option-<id>` deseninin aynısı).
 */

const tr = translations.tr;
const CANONICAL_DECODE_PATH =
  '/comm/marine-navigation/legacy-proprietary-marine/hdlc-based-marine?tab=decode';

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

function fieldName(page: Page, fieldId: string): Locator {
  return fieldRow(page, fieldId).getByTestId('decode-field-select');
}

async function selectExample(page: Page, exampleId: string): Promise<void> {
  await page.locator('#decode-example').selectOption(exampleId);
}

test('decode sekmesi Hazır rozetiyle açılır, varsayılan örnek girdide, konsola hata basmaz', async ({
  page,
}) => {
  const consoleErrors = await openDecodePanel(page);

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('HDLC-Based Marine');
  await expect(page.getByTestId('decode-panel')).toHaveAttribute('data-plugin-id', 'hdlc-based-marine');
  await expect(page.getByTestId('decode-plugin-name')).toHaveText('HDLC-Based Marine');
  await expect(page.getByText(tr['status.ready'], { exact: true })).toBeVisible();
  await expect(page.getByText(tr['status.planned'], { exact: true })).toHaveCount(0);
  await expect(page.getByText(tr['protocol.plannedNotice'])).toHaveCount(0);

  // Spec'in kendi örneği ("unknown-marine-frame") ilk render'da girdide —
  // CRC baytları motorun kendisiyle hesaplandığı için ondalık basamak yerine
  // desenle sınanır (dosya başı, hdlcBasedMarine.ts).
  await expect(page.locator('#decode-hex')).toHaveValue(
    /^7E 12 03 18 04 20 10 33 88 [0-9A-F]{2} [0-9A-F]{2} 7E$/,
  );
  await expect(page.getByTestId('decode-field-table')).toBeVisible();

  expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
});

test('Address/Control/FCS "(candidate)" etiketiyle görünür, Information taşımaz, FCS PASS gösterir', async ({
  page,
}) => {
  await openDecodePanel(page);

  await expect(fieldName(page, 'address')).toHaveText('Address (candidate)');
  await expect(fieldRow(page, 'address').getByTestId('decode-field-raw')).toHaveText('0x12');

  await expect(fieldName(page, 'control')).toHaveText('Control (candidate)');
  await expect(fieldRow(page, 'control').getByTestId('decode-field-raw')).toHaveText('0x03');
  // Varsayılan profil raw-candidate — I/S/U alanı YOK.
  await expect(page.locator('[data-testid="decode-field-row"][data-field-id="poll-final"]')).toHaveCount(0);

  await expect(fieldName(page, 'information')).toHaveText('Information');
  await expect(fieldRow(page, 'information').getByTestId('decode-field-raw')).toHaveText(
    '18 04 20 10 33 88',
  );

  await expect(fieldName(page, 'fcs')).toHaveText('FCS (candidate)');
  await expect(fieldRow(page, 'fcs').getByTestId('decode-field-physical')).toContainText('PASS');
  await expect(fieldRow(page, 'fcs')).toHaveAttribute('data-valid', 'true');
});

test('controlFieldProfile "ISO 13239 modulo-8"e çevrilince I/S/U alanları BELİRİR', async ({ page }) => {
  await openDecodePanel(page);
  // Address=0xFF, Control=0x71 → S-format RR, P/F=1 (sdlc'nin 'poll' örneğiyle
  // aynı bayt deseni) — S-tipi bir alan kümesi göstermek için seçildi.
  await selectExample(page, 'poll-no-information');

  // Varsayılan (raw-candidate) profilde I/S/U alanı YOK.
  await expect(page.locator('[data-testid="decode-field-row"][data-field-id="poll-final"]')).toHaveCount(0);
  await expect(
    page.locator('[data-testid="decode-field-row"][data-field-id="supervisory-type"]'),
  ).toHaveCount(0);

  await expect(page.locator('#decode-option-controlFieldProfile')).toBeVisible();
  await page.locator('#decode-option-controlFieldProfile').selectOption('iso-13239-modulo8');

  await expect(fieldRow(page, 'control').getByTestId('decode-field-physical')).toHaveText('S-format');
  await expect(fieldRow(page, 'poll-final').getByTestId('decode-field-raw')).toHaveText('0x1 (1)');
  await expect(fieldRow(page, 'supervisory-type').getByTestId('decode-field-raw')).toHaveText(
    'RR (Receive Ready)',
  );
  await expect(fieldRow(page, 'receive-sequence-number').getByTestId('decode-field-raw')).toHaveText(
    '0x3 (3)',
  );
});

test('1440 ve 390 pikselde yatay taşma yok', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openDecodePanel(page);
  await expect(page.getByTestId('decode-field-table')).toBeVisible();
  const wide = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(wide, 'sayfa 1440px genişlikte yatayda taşıyor').toBeLessThanOrEqual(0);

  await page.setViewportSize({ width: 390, height: 844 });
  const narrow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(narrow, 'sayfa 390px genişlikte yatayda taşıyor').toBeLessThanOrEqual(0);
});
