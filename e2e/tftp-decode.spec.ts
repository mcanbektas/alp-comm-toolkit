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
 * Faz 10 dalga 12h'nin gerçek tarayıcı turu — TFTP.
 *
 * Kanıtladığı şey: RRQ'nun Filename+Mode'un ardından option extension
 * çiftlerini (RFC 2347) okuduğu, DATA'nın Final Block kararının 512 baytlık
 * klasik varsayıma dayandığı VE bunun için uyardığı, ve ERROR kodunun
 * RFC 1350 §5 tablosuna eşlendiği.
 */

const TFTP_PATH = '/comm/network-ethernet/file-terminal/tftp?tab=decode';

test.describe('TFTP', () => {
  test('decode sekmesi Hazır rozetiyle açılır ve konsola hata basmaz', async ({ page }) => {
    const consoleErrors = await openDecodePanel(page, TFTP_PATH);

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('TFTP');
    await expect(page.getByTestId('decode-panel')).toHaveAttribute('data-plugin-id', 'tftp');
    await expect(page.getByText(tr['status.ready'], { exact: true })).toBeVisible();
    await expect(page.getByText(tr['protocol.plannedNotice'])).toHaveCount(0);

    expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
  });

  test('RRQ Filename + Mode okunur', async ({ page }) => {
    await openDecodePanel(page, TFTP_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('read-request');

    await expect(fieldRow(page, 'opcode').getByTestId('decode-field-physical')).toHaveText(
      'RRQ (Read Request)',
    );
    await expect(fieldRow(page, 'filename').getByTestId('decode-field-physical')).toHaveText('firmware.bin');
    await expect(fieldRow(page, 'mode').getByTestId('decode-field-physical')).toHaveText('octet');
    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
    await expectNoRawTranslationKeys(page);
  });

  test('RRQ + blksize option extension çifti okunur', async ({ page }) => {
    await openDecodePanel(page, TFTP_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('read-request-with-options');

    await expect(fieldRow(page, 'option-name-17').getByTestId('decode-field-physical')).toHaveText('blksize');
    await expect(fieldRow(page, 'option-value-25').getByTestId('decode-field-physical')).toHaveText('1024');
    await expectNoRawTranslationKeys(page);
  });

  test('512 baytlık tam DATA bloğu "Continue" der ve uyarır', async ({ page }) => {
    await openDecodePanel(page, TFTP_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('data-continue');

    await expect(fieldRow(page, 'transfer-state').getByTestId('decode-field-physical')).toHaveText('Continue');
    await expect(
      page.locator('[data-testid="decode-field-warning"][data-field-id="transfer-state"]'),
    ).toBeVisible();
    await expectNoRawTranslationKeys(page);
  });

  test('512 baytın altındaki DATA bloğu kesin "Final Block" der, uyarmaz', async ({ page }) => {
    await openDecodePanel(page, TFTP_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('data-final-block');

    await expect(fieldRow(page, 'transfer-state').getByTestId('decode-field-physical')).toHaveText(
      'Final Block',
    );
    await expect(
      page.locator('[data-testid="decode-field-warning"][data-field-id="transfer-state"]'),
    ).toHaveCount(0);
    await expectNoRawTranslationKeys(page);
  });

  test('ERROR kodu RFC 1350 §5 tablosuna eşlenir', async ({ page }) => {
    await openDecodePanel(page, TFTP_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('error-file-not-found');

    await expect(fieldRow(page, 'error-code').getByTestId('decode-field-physical')).toHaveText(
      'File not found',
    );
    await expect(fieldRow(page, 'error-message').getByTestId('decode-field-physical')).toHaveText(
      'File not found',
    );
    await expectNoRawTranslationKeys(page);
  });

  test('İngilizce dilde de çevrilmemiş anahtar basmaz', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('alp-comm-lang', 'en');
    });
    await page.goto(TFTP_PATH);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('TFTP');
    await page.getByLabel(translations.en['decode.example.label']).selectOption('ack');
    await expect(fieldRow(page, 'opcode').getByTestId('decode-field-physical')).toHaveText('ACK');
    await expectNoRawTranslationKeys(page);
  });
});
