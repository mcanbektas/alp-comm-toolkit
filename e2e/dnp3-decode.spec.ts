import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { translations } from '../src/translations/all';

/**
 * Faz 10 dalga 5a'nın gerçek tarayıcı turu — DNP3.
 *
 * Kanıtladığı şeyler: kanonik sayfanın (industrial-automation/scada-utility/dnp3)
 * Hazır rozetiyle açıldığı; link-only çerçevenin, tek-segment Read Class 0
 * isteğinin, IIN'li Response'un, çok-segment ilk parçasının, header/blok CRC
 * hata yollarının ekranda gerçekten çıktığı. DNP3'ün mqtt/coap'ın aksine bir
 * alias sayfası YOK (katalog "Katalog yolları" tablosu) — bu yüzden alias
 * devralma testi burada YOK.
 */

const tr = translations.tr;

const CANONICAL_DECODE_PATH = '/comm/industrial-automation/scada-utility/dnp3?tab=decode';

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

test.describe('DNP3', () => {
  test('decode sekmesi Hazır rozetiyle açılır ve konsola hata basmaz', async ({ page }) => {
    const consoleErrors = await openDecodePanel(page, CANONICAL_DECODE_PATH);

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('DNP3');
    await expect(page.getByTestId('decode-panel')).toHaveAttribute('data-plugin-id', 'dnp3');
    await expect(page.getByText(tr['status.ready'], { exact: true })).toBeVisible();
    await expect(page.getByText(tr['protocol.plannedNotice'])).toHaveCount(0);

    expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
  });

  test('link-only örneği Link Function Code’u basar, gövde alanı yok', async ({ page }) => {
    await openDecodePanel(page, CANONICAL_DECODE_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('link-only-request-link-status');

    await expect(fieldRow(page, 'link-function-code').getByTestId('decode-field-physical')).toHaveText(
      'Request Link Status',
    );
    await expect(fieldRow(page, 'header-crc')).toHaveCount(1);
    await expect(fieldRow(page, 'block-crc-0')).toHaveCount(0);
    await expect(fieldRow(page, 'transport-fin')).toHaveCount(0);
    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
    await expectNoRawTranslationKeys(page);
  });

  test('tek segment Read Class 0 örneği object header’ı basar', async ({ page }) => {
    await openDecodePanel(page, CANONICAL_DECODE_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('single-segment-read-class0');

    await expect(fieldRow(page, 'application-function-code').getByTestId('decode-field-physical')).toHaveText(
      'Read',
    );
    await expect(fieldRow(page, 'object-group').getByTestId('decode-field-physical')).toHaveText(
      'Class Objects',
    );
    await expect(fieldRow(page, 'object-qualifier').getByTestId('decode-field-physical')).toHaveText(
      'No Range Field (All Objects)',
    );
    await expect(fieldRow(page, 'range-start')).toHaveCount(0);
    await expect(fieldRow(page, 'object-data')).toHaveCount(0);
    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
    await expectNoRawTranslationKeys(page);
  });

  test('Response + IIN örneği Need Time bitini ve object header’ı basar', async ({ page }) => {
    await openDecodePanel(page, CANONICAL_DECODE_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('response-with-iin');

    await expect(fieldRow(page, 'application-function-code').getByTestId('decode-field-physical')).toHaveText(
      'Response',
    );
    await expect(fieldRow(page, 'iin1-need-time').getByTestId('decode-field-raw')).toHaveText('0x1 (1)');
    await expect(fieldRow(page, 'object-group').getByTestId('decode-field-physical')).toHaveText(
      'Binary Input',
    );
    await expect(fieldRow(page, 'object-data')).toHaveCount(1);
    await expect(page.getByTestId('decode-frame-warning')).toContainText(
      tr['protocol.dnp3.warning.objectDataNeedsVariationDecode'],
    );
    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
    await expectNoRawTranslationKeys(page);
  });

  test('çok-segment ilk parça örneği uyarı basar, application katmanı çözülmez', async ({ page }) => {
    await openDecodePanel(page, CANONICAL_DECODE_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('multi-segment-first-segment');

    await expect(fieldRow(page, 'transport-fir').getByTestId('decode-field-raw')).toHaveText('0x1 (1)');
    await expect(fieldRow(page, 'transport-fin').getByTestId('decode-field-raw')).toHaveText('0x0 (0)');
    await expect(fieldRow(page, 'application-function-code')).toHaveCount(0);
    await expect(fieldRow(page, 'segment-data')).toHaveCount(1);
    await expect(page.getByTestId('decode-frame-warning')).toContainText(
      tr['protocol.dnp3.warning.multiSegmentSession'],
    );
    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
    await expectNoRawTranslationKeys(page);
  });

  test('header CRC hatası örneği crc-mismatch basar', async ({ page }) => {
    await openDecodePanel(page, CANONICAL_DECODE_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('header-crc-mismatch');

    const frameError = page.getByTestId('decode-frame-error');
    await expect(frameError).toHaveAttribute('data-error-code', 'crc-mismatch');
    await expect(fieldRow(page, 'link-function-code').getByTestId('decode-field-physical')).toHaveText(
      'Request Link Status',
    );
    await expectNoRawTranslationKeys(page);
  });

  test('blok CRC hatası örneği crc-mismatch basar, application katmanı yine çözülür', async ({ page }) => {
    await openDecodePanel(page, CANONICAL_DECODE_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('block-crc-mismatch');

    const frameError = page.getByTestId('decode-frame-error');
    await expect(frameError).toHaveAttribute('data-error-code', 'crc-mismatch');
    await expect(fieldRow(page, 'application-function-code').getByTestId('decode-field-physical')).toHaveText(
      'Read',
    );
    await expectNoRawTranslationKeys(page);
  });

  test('İngilizce dilde de çevrilmemiş anahtar basmaz', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('alp-comm-lang', 'en');
    });
    await page.goto(CANONICAL_DECODE_PATH);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('DNP3');
    await page.getByLabel(translations.en['decode.example.label']).selectOption('header-crc-mismatch');
    await expect(page.getByTestId('decode-frame-error')).toHaveAttribute('data-error-code', 'crc-mismatch');
    await expectNoRawTranslationKeys(page);
  });

  test('1440 ve 390 pikselde yatay taşma yok', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openDecodePanel(page, CANONICAL_DECODE_PATH);
    await page.getByLabel(tr['decode.example.label']).selectOption('response-with-iin');
    await expect(page.getByTestId('decode-field-table')).toBeVisible();
    const wide = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(wide, 'sayfa 1440px genişlikte yatayda taşıyor').toBeLessThanOrEqual(0);

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByTestId('decode-field-table')).toBeVisible();
    const narrow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(narrow, 'sayfa 390px genişlikte yatayda taşıyor').toBeLessThanOrEqual(0);
  });
});
