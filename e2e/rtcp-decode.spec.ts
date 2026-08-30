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
 * Faz 10 dalga 12g'nin gerçek tarayıcı turu — RTCP.
 *
 * Kanıtladığı şey: compound paketin her alt paketinin kendi `length`
 * alanıyla çerçevelendiği (SR + SDES art arda tek çerçeve olarak okunur),
 * SR'nin rapor bloğunun (Fraction Lost yüzdesi dâhil) doğru çözüldüğü,
 * tanınmayan Packet Type'ın çerçeveyi GEÇERSİZ kılmadan yalnız uyardığı ve
 * `length` tampon dışına taştığında FATAL hata basıldığı.
 */

const RTCP_PATH = '/comm/network-ethernet/real-time-media/rtcp?tab=decode';

test.describe('RTCP', () => {
  test('decode sekmesi Hazır rozetiyle açılır ve konsola hata basmaz', async ({ page }) => {
    const consoleErrors = await openDecodePanel(page, RTCP_PATH);

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('RTCP');
    await expect(page.getByTestId('decode-panel')).toHaveAttribute('data-plugin-id', 'rtcp');
    await expect(page.getByText(tr['status.ready'], { exact: true })).toBeVisible();
    await expect(page.getByText(tr['protocol.plannedNotice'])).toHaveCount(0);

    expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
  });

  test('Sender Report SSRC ve rapor bloğu Fraction Lost yüzdesi doğru çözülür', async ({ page }) => {
    await openDecodePanel(page, RTCP_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('sr-with-one-report-block');

    await expect(fieldRow(page, 'common-packet-type-1').getByTestId('decode-field-physical')).toHaveText(
      'SR (Sender Report)',
    );
    await expect(fieldRow(page, 'report-ssrc-4').getByTestId('decode-field-raw')).toContainText('305419896');
    await expect(fieldRow(page, 'report-block-fraction-lost-28').getByTestId('decode-field-physical')).toHaveText(
      '0 %',
    );
    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
    await expectNoRawTranslationKeys(page);
  });

  test('compound RR + SDES tek çerçevede art arda çözülür', async ({ page }) => {
    await openDecodePanel(page, RTCP_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('compound-rr-sdes');

    await expect(fieldRow(page, 'common-packet-type-1').getByTestId('decode-field-physical')).toHaveText(
      'RR (Receiver Report)',
    );
    await expect(fieldRow(page, 'common-packet-type-9').getByTestId('decode-field-physical')).toHaveText(
      'SDES (Source Description)',
    );
    await expect(fieldRow(page, 'sdes-item-16').getByTestId('decode-field-physical')).toHaveText('a@b');
    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
    await expectNoRawTranslationKeys(page);
  });

  test('BYE sebep metnini çözer', async ({ page }) => {
    await openDecodePanel(page, RTCP_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('bye-with-reason');

    await expect(fieldRow(page, 'bye-reason-8').getByTestId('decode-field-physical')).toHaveText('bye');
    await expectNoRawTranslationKeys(page);
  });

  test('tanınmayan Packet Type çerçeveyi geçersiz kılmaz, yalnız uyarır', async ({ page }) => {
    await openDecodePanel(page, RTCP_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('unknown-packet-type');

    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
    await expect(page.getByTestId('decode-frame-warning').first()).toBeVisible();
    await expectNoRawTranslationKeys(page);
  });

  test('length tampon dışına taşarsa FATAL hata basar', async ({ page }) => {
    await openDecodePanel(page, RTCP_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('length-exceeds-buffer');

    await expect(page.getByTestId('decode-frame-error').first()).toHaveAttribute(
      'data-error-code',
      'truncated-frame',
    );
    await expectNoRawTranslationKeys(page);
  });

  test('İngilizce dilde de çevrilmemiş anahtar basmaz', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('alp-comm-lang', 'en');
    });
    await page.goto(RTCP_PATH);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('RTCP');
    await page.getByLabel(translations.en['decode.example.label']).selectOption('sr-with-one-report-block');
    await expect(fieldRow(page, 'common-packet-type-1').getByTestId('decode-field-physical')).toHaveText(
      'SR (Sender Report)',
    );
    await expectNoRawTranslationKeys(page);
  });
});
