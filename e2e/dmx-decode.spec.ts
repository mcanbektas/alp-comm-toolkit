import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { translations } from '../src/translations/all';

/**
 * Faz 10 dalga 6a'nın gerçek tarayıcı turu — DMX512.
 *
 * Kanıtladığı şeyler: kanonik sayfanın (building-automation/lighting-networks/
 * dmx512) Hazır rozetiyle açıldığı — `building/` dizinini açan ilk motor;
 * standart lighting (Start Code 0x00) örneğinin spec'in kendi RGB fixture
 * değerlerini bastığı; tam 512 slotlu universe'da yalnız ilk 16 slotun ayrı
 * satır olduğu, kalanının tek özet alanda (`slot-data`) toplandığı — slot 17
 * ekranda AYRI SATIR OLARAK YOK; 512 slot tavanının aşılmasının hata değil
 * uyarı bastığı; tanınmayan Start Code'un ham + uyarıyla, tanınan alternatif
 * Start Code'un (0xCC RDM) adıyla göründüğü; 1 baytlık minimal çerçevenin
 * (yalnız Start Code, 0 slot) geçerli sayıldığı.
 *
 * DMX512'nin alias sayfası YOK (katalog "Katalog yolları" tablosu) — alias
 * devralma testi burada yok. BEKÇİ BORCU yok (brief), ekstra iş gerekmedi.
 */

const tr = translations.tr;

const CANONICAL_DECODE_PATH = '/comm/building-automation/lighting-networks/dmx512?tab=decode';

async function openDecodePanel(page: Page, path: string): Promise<string[]> {
  const consoleErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => consoleErrors.push(error.message));

  await page.addInitScript(() => {
    window.localStorage.setItem('alp-comm-lang', 'tr');
  });

  await page.goto(path);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByTestId('decode-panel')).toBeVisible();
  return consoleErrors;
}

function fieldRow(page: Page, fieldId: string): Locator {
  return page.locator(`[data-testid="decode-field-row"][data-field-id="${fieldId}"]`);
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

test.describe('DMX512', () => {
  test('decode sekmesi Hazır rozetiyle açılır ve konsola hata basmaz', async ({ page }) => {
    const consoleErrors = await openDecodePanel(page, CANONICAL_DECODE_PATH);

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('DMX512');
    await expect(page.getByTestId('decode-panel')).toHaveAttribute('data-plugin-id', 'dmx512');
    await expect(page.getByText(tr['status.ready'], { exact: true })).toBeVisible();
    await expect(page.getByText(tr['protocol.plannedNotice'])).toHaveCount(0);

    expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
  });

  test('standart lighting örneği spec’in kendi RGB fixture değerlerini basar', async ({ page }) => {
    await openDecodePanel(page, CANONICAL_DECODE_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('standard-lighting-basic');

    await expect(fieldRow(page, 'start-code').getByTestId('decode-field-physical')).toHaveText(
      'DMX Level Data (Standard Lighting)',
    );
    await expect(fieldRow(page, 'slot-1').getByTestId('decode-field-raw')).toHaveText('0xFF (255)');
    await expect(fieldRow(page, 'slot-2').getByTestId('decode-field-raw')).toHaveText('0x80 (128)');
    await expect(fieldRow(page, 'slot-3').getByTestId('decode-field-raw')).toHaveText('0x0 (0)');
    await expect(fieldRow(page, 'slot-4').getByTestId('decode-field-raw')).toHaveText('0xC8 (200)');
    await expect(fieldRow(page, 'slot-data')).toHaveCount(0);
    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
    await expectNoRawTranslationKeys(page);
  });

  test('tam 512 slotlu universe’da yalnız ilk 16 slot ayrı satırdır, kalanı özet alanda toplanır', async ({
    page,
  }) => {
    await openDecodePanel(page, CANONICAL_DECODE_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('full-512-slot-universe');

    await expect(fieldRow(page, 'slot-1')).toHaveCount(1);
    await expect(fieldRow(page, 'slot-16')).toHaveCount(1);
    // 512 satır DOM'a basılmıyor — slot 17 ve slot 512 AYRI SATIR olarak yok.
    await expect(fieldRow(page, 'slot-17')).toHaveCount(0);
    await expect(fieldRow(page, 'slot-512')).toHaveCount(0);
    await expect(fieldRow(page, 'slot-data').getByTestId('decode-field-select')).toHaveText(
      'Slots 17-512',
    );
    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
    await expect(page.getByTestId('decode-frame-warning')).toHaveCount(0);
    await expectNoRawTranslationKeys(page);
  });

  test('512 slot tavanının aşılması hata değil uyarı basar', async ({ page }) => {
    await openDecodePanel(page, CANONICAL_DECODE_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('oversized-slot-count');

    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
    await expect(page.getByTestId('decode-frame-warning')).toContainText(
      tr['protocol.dmx512.warning.slotCountExceedsMaximum'],
    );
    await expectNoRawTranslationKeys(page);
  });

  test('tanınmayan Start Code ham gösterilir ve uyarı basar', async ({ page }) => {
    await openDecodePanel(page, CANONICAL_DECODE_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('unrecognized-start-code');

    const startCode = fieldRow(page, 'start-code');
    await expect(startCode).toHaveAttribute('data-valid', 'false');
    await expect(startCode.getByTestId('decode-field-raw')).toHaveText('0x1 (1)');
    await expect(startCode.getByTestId('decode-field-physical')).toHaveText('—');
    await expect(page.getByTestId('decode-field-warning')).toContainText(
      tr['protocol.dmx512.warning.unrecognizedStartCode'],
    );
    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
    await expectNoRawTranslationKeys(page);
  });

  test('tanınan alternatif Start Code (0xCC RDM) adıyla gösterilir', async ({ page }) => {
    await openDecodePanel(page, CANONICAL_DECODE_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('recognized-alternate-start-code');

    const startCode = fieldRow(page, 'start-code');
    await expect(startCode).toHaveAttribute('data-valid', 'true');
    await expect(startCode.getByTestId('decode-field-physical')).toHaveText(
      'RDM (Remote Device Management)',
    );
    await expectNoRawTranslationKeys(page);
  });

  test('yalnız Start Code içeren minimal çerçevede slot alanı basılmaz', async ({ page }) => {
    await openDecodePanel(page, CANONICAL_DECODE_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('minimal-start-code-only');

    await expect(fieldRow(page, 'start-code')).toHaveCount(1);
    await expect(fieldRow(page, 'slot-1')).toHaveCount(0);
    await expect(fieldRow(page, 'slot-data')).toHaveCount(0);
    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
    await expectNoRawTranslationKeys(page);
  });

  test('İngilizce dilde de çevrilmemiş anahtar basmaz', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('alp-comm-lang', 'en');
    });
    await page.goto(CANONICAL_DECODE_PATH);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('DMX512');
    await page
      .getByLabel(translations.en['decode.example.label'])
      .selectOption('oversized-slot-count');
    await expect(page.getByTestId('decode-frame-warning')).toContainText(
      translations.en['protocol.dmx512.warning.slotCountExceedsMaximum'],
    );
    await expectNoRawTranslationKeys(page);
  });

  test('1440 ve 390 pikselde yatay taşma yok', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openDecodePanel(page, CANONICAL_DECODE_PATH);
    await page.getByLabel(tr['decode.example.label']).selectOption('full-512-slot-universe');
    await expect(page.getByTestId('decode-field-table')).toBeVisible();
    const wide = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(wide, 'sayfa 1440px genişlikte yatayda taşıyor').toBeLessThanOrEqual(0);

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByTestId('decode-field-table')).toBeVisible();
    const narrow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(narrow, 'sayfa 390px genişlikte yatayda taşıyor').toBeLessThanOrEqual(0);
  });
});
