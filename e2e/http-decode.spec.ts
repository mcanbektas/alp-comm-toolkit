import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { translations } from '../src/translations/all';

const tr = translations.tr;

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

/** Çerçeve uyarısı birden çok olabilir; strict-mode ihlali için süzülür. */
function frameWarning(page: Page, text: string): Locator {
  return page.getByTestId('decode-frame-warning').filter({ hasText: text });
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

/**
 * Faz 10 dalga 12f'nin gerçek tarayıcı turu — HTTP.
 *
 * Kanıtladığı şey: chunk boyutunun ONALTILIK okunduğu, Content-Length ile
 * Transfer-Encoding çakışmasının smuggling hatası bastığı, 204'ün gövdesiz
 * kaldığı ve HEAD `decodeOptions` şıkkının gerçekten panelden geçtiği.
 */

const HTTP_PATH = '/comm/network-ethernet/web-messaging/http?tab=decode';

test.describe('HTTP', () => {
  test('decode sekmesi Hazır rozetiyle açılır ve konsola hata basmaz', async ({ page }) => {
    const consoleErrors = await openDecodePanel(page, HTTP_PATH);

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('HTTP');
    await expect(page.getByTestId('decode-panel')).toHaveAttribute('data-plugin-id', 'http');
    await expect(page.getByText(tr['status.ready'], { exact: true })).toBeVisible();
    await expect(page.getByText(tr['protocol.plannedNotice'])).toHaveCount(0);

    expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
  });

  test('GET isteği metot / hedef / başlık olarak çözülür', async ({ page }) => {
    await openDecodePanel(page, HTTP_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('get-request');

    await expect(fieldRow(page, 'message-kind').getByTestId('decode-field-physical')).toHaveText('Request');
    await expect(fieldRow(page, 'method').getByTestId('decode-field-raw')).toHaveText('GET');
    await expect(fieldRow(page, 'request-target').getByTestId('decode-field-raw')).toHaveText('/api/status');
    await expect(fieldRow(page, 'header-0-value').getByTestId('decode-field-raw')).toHaveText('192.168.1.20');
    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
    await expectNoRawTranslationKeys(page);
  });

  test('chunked gövde birleştirilir', async ({ page }) => {
    await openDecodePanel(page, HTTP_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('chunked-response');

    await expect(fieldRow(page, 'body-framing').getByTestId('decode-field-physical')).toHaveText(
      'Transfer-Encoding: chunked',
    );
    await expect(fieldRow(page, 'chunk-0-data').getByTestId('decode-field-raw')).toHaveText('Wiki');
    await expect(fieldRow(page, 'chunk-1-data').getByTestId('decode-field-raw')).toHaveText('pedia');
    await expect(fieldRow(page, 'reassembled-body-length').getByTestId('decode-field-physical')).toHaveText('9 B');
    await expectNoRawTranslationKeys(page);
  });

  test('chunk boyutu onaltılık okunur — `10` 16 bayttır', async ({ page }) => {
    await openDecodePanel(page, HTTP_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('chunked-hex-size');

    await expect(fieldRow(page, 'chunk-0-size').getByTestId('decode-field-physical')).toHaveText('16 B');
    await expect(fieldRow(page, 'chunk-0-data').getByTestId('decode-field-raw')).toHaveText('0123456789abcdef');
    await expectNoRawTranslationKeys(page);
  });

  test('204 yanıtı Content-Length yazsa bile gövdesizdir', async ({ page }) => {
    await openDecodePanel(page, HTTP_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('no-content');

    await expect(fieldRow(page, 'body-framing').getByTestId('decode-field-physical')).toHaveText('No body');
    await expect(fieldRow(page, 'body')).toHaveCount(0);
    await expectNoRawTranslationKeys(page);
  });

  test('smuggling çakışması çerçeve hatası basar', async ({ page }) => {
    await openDecodePanel(page, HTTP_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('smuggling-conflict');

    await expect(page.getByTestId('decode-frame-error').first()).toHaveAttribute(
      'data-error-code',
      'length-mismatch',
    );
    await expectNoRawTranslationKeys(page);
  });

  test('başlık adındaki boşluk çerçeve hatası basar', async ({ page }) => {
    await openDecodePanel(page, HTTP_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('header-name-whitespace');

    await expect(page.getByTestId('decode-frame-error').first()).toHaveAttribute(
      'data-error-code',
      'value-out-of-range',
    );
    await expectNoRawTranslationKeys(page);
  });

  test('HEAD şıkkı seçilince yanıt gövdesiz sayılır', async ({ page }) => {
    await openDecodePanel(page, HTTP_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('json-response');
    await expect(fieldRow(page, 'body-framing').getByTestId('decode-field-physical')).toHaveText('Content-Length');

    // `decodeOptions` kanalı: panelden geçen tek soru.
    await page.getByLabel(tr['protocol.http.option.requestMethod']).selectOption('HEAD');

    await expect(fieldRow(page, 'body-framing').getByTestId('decode-field-physical')).toHaveText('No body');
    await expect(frameWarning(page, tr['protocol.http.warning.headResponseAssumed'])).toHaveCount(1);
    await expectNoRawTranslationKeys(page);
  });

  test('İngilizce dilde de çevrilmemiş anahtar basmaz', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('alp-comm-lang', 'en');
    });
    await page.goto(HTTP_PATH);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('HTTP');
    await page.getByLabel(translations.en['decode.example.label']).selectOption('chunked-response');
    await expect(fieldRow(page, 'chunk-0-data').getByTestId('decode-field-raw')).toHaveText('Wiki');
    await expectNoRawTranslationKeys(page);
  });
});
