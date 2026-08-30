import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { translations } from '../src/translations/all';

/**
 * Faz 10 dalga 4d'nin gerçek tarayıcı turu — CoAP.
 *
 * Kanıtladığı şeyler: kanonik sayfanın (network-ethernet/web-messaging/coap)
 * Hazır rozetiyle açıldığı; GET isteğinin, 2.05 Content yanıtının, birden
 * fazla Uri-Path segmentinin, tanınmayan option (Observe) uyarı yolunun, TKL
 * 9-15/0xFF-sonrası-boş-payload/option-nibble-15 hata yollarının ekranda
 * gerçekten çıktığı; VE `wireless-iot/iot-messaging/coap` alias sayfasının
 * aynı motoru ve Hazır rozetini kanonik kayıttan devraldığı (mqtt-decode.
 * spec.ts'in alias deseninin aynısı, brief-faz10-dalga4.md).
 */

const tr = translations.tr;

const CANONICAL_DECODE_PATH = '/comm/network-ethernet/web-messaging/coap?tab=decode';
const ALIAS_DECODE_PATH = '/comm/wireless-iot/iot-messaging/coap?tab=decode';

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

test.describe('CoAP', () => {
  test('decode sekmesi Hazır rozetiyle açılır ve konsola hata basmaz', async ({ page }) => {
    const consoleErrors = await openDecodePanel(page, CANONICAL_DECODE_PATH);

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('CoAP');
    await expect(page.getByTestId('decode-panel')).toHaveAttribute('data-plugin-id', 'coap');
    await expect(page.getByText(tr['status.ready'], { exact: true })).toBeVisible();
    await expect(page.getByText(tr['protocol.plannedNotice'])).toHaveCount(0);

    expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
  });

  test('GET isteği örneği Version/Type/Code/Uri-Path’ı basar', async ({ page }) => {
    await openDecodePanel(page, CANONICAL_DECODE_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('get-request');

    await expect(fieldRow(page, 'type').getByTestId('decode-field-physical')).toHaveText('CON');
    await expect(fieldRow(page, 'code').getByTestId('decode-field-physical')).toHaveText('0.01');
    await expect(fieldRow(page, 'option-4').getByTestId('decode-field-raw')).toHaveText('0xB (11)');
    const fieldTable = page.getByTestId('decode-field-table');
    await expect(fieldTable.getByText('Uri-Path')).toBeVisible();
    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
    await expectNoRawTranslationKeys(page);
  });

  test('2.05 Content yanıtı örneği Content-Format ve Payload’ı basar', async ({ page }) => {
    await openDecodePanel(page, CANONICAL_DECODE_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('content-response');

    await expect(fieldRow(page, 'type').getByTestId('decode-field-physical')).toHaveText('ACK');
    await expect(fieldRow(page, 'code').getByTestId('decode-field-physical')).toHaveText('2.05');
    await expect(fieldRow(page, 'token')).toHaveCount(1);
    const fieldTable = page.getByTestId('decode-field-table');
    await expect(fieldTable.getByText('Content-Format')).toBeVisible();
    await expect(fieldRow(page, 'payload-marker')).toHaveCount(1);
    await expect(fieldRow(page, 'payload')).toHaveCount(1);
    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
    await expectNoRawTranslationKeys(page);
  });

  test('çoklu Uri-Path örneği kümülatif option numarasını (11) iki kez basar', async ({ page }) => {
    await openDecodePanel(page, CANONICAL_DECODE_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('multiple-uri-path');

    await expect(fieldRow(page, 'option-4').getByTestId('decode-field-raw')).toHaveText('0xB (11)');
    await expect(fieldRow(page, 'option-12').getByTestId('decode-field-raw')).toHaveText('0xB (11)');
    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
    await expectNoRawTranslationKeys(page);
  });

  test('tanınmayan option (Observe) örneği uyarı basar, hata basmaz', async ({ page }) => {
    await openDecodePanel(page, CANONICAL_DECODE_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('unrecognized-option');

    await expect(page.getByTestId('decode-frame-warning')).toContainText(
      tr['protocol.coap.warning.unknownOption'],
    );
    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
    await expectNoRawTranslationKeys(page);
  });

  test('Token Length rezerve (9-15) örneği value-out-of-range basar', async ({ page }) => {
    await openDecodePanel(page, CANONICAL_DECODE_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('token-length-reserved');

    const frameError = page.getByTestId('decode-frame-error');
    await expect(frameError).toHaveAttribute('data-error-code', 'value-out-of-range');
    await expect(fieldRow(page, 'code')).toHaveCount(1);
    await expect(fieldRow(page, 'token')).toHaveCount(0);
    await expectNoRawTranslationKeys(page);
  });

  test('0xFF sonrası boş payload örneği truncated-frame basar', async ({ page }) => {
    await openDecodePanel(page, CANONICAL_DECODE_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('payload-marker-empty');

    const frameError = page.getByTestId('decode-frame-error');
    await expect(frameError).toHaveAttribute('data-error-code', 'truncated-frame');
    await expectNoRawTranslationKeys(page);
  });

  test('option nibble 15 (marker dışı) örneği value-out-of-range basar', async ({ page }) => {
    await openDecodePanel(page, CANONICAL_DECODE_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('option-nibble-reserved');

    const frameError = page.getByTestId('decode-frame-error');
    await expect(frameError).toHaveAttribute('data-error-code', 'value-out-of-range');
    await expectNoRawTranslationKeys(page);
  });

  test('İngilizce dilde de çevrilmemiş anahtar basmaz', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('alp-comm-lang', 'en');
    });
    await page.goto(CANONICAL_DECODE_PATH);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('CoAP');
    await page.getByLabel(translations.en['decode.example.label']).selectOption('token-length-reserved');
    await expect(page.getByTestId('decode-frame-error')).toHaveAttribute(
      'data-error-code',
      'value-out-of-range',
    );
    await expectNoRawTranslationKeys(page);
  });

  test('wireless-iot alias sayfası aynı motoru ve Hazır rozetini devralır', async ({ page }) => {
    const consoleErrors = await openDecodePanel(page, ALIAS_DECODE_PATH);

    // Alias kaydın kendi pluginId'si yok; motor kanonik kayda inilerek bulunur.
    await expect(page.getByTestId('decode-panel')).toHaveAttribute('data-plugin-id', 'coap');
    await expect(page.getByText(tr['protocol.plannedNotice'])).toHaveCount(0);
    await expect(page.getByText(tr['status.ready'], { exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: tr['protocol.canonical'] })).toBeVisible();

    await page.getByLabel(tr['decode.example.label']).selectOption('get-request');
    await expect(fieldRow(page, 'code').getByTestId('decode-field-physical')).toHaveText('0.01');

    expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
  });

  test('1440 ve 390 pikselde yatay taşma yok', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openDecodePanel(page, CANONICAL_DECODE_PATH);
    await page.getByLabel(tr['decode.example.label']).selectOption('multiple-uri-path');
    await expect(page.getByTestId('decode-field-table')).toBeVisible();
    const wide = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(wide, 'sayfa 1440px genişlikte yatayda taşıyor').toBeLessThanOrEqual(0);

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByTestId('decode-field-table')).toBeVisible();
    const narrow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(narrow, 'sayfa 390px genişlikte yatayda taşıyor').toBeLessThanOrEqual(0);
  });
});
