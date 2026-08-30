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
 * Faz 10 dalga 12h'nin gerçek tarayıcı turu — FTP.
 *
 * Kanıtladığı şey: yapıştırılan çok satırlık bir kontrol oturumunun HER
 * satırının kendi başına sınıflandırıldığı, PASS argümanının varsayılan
 * görünümde redakte edildiği, ve çok satırlı yanıtın '-'/' ' ayırıcısının
 * doğru okunduğu.
 */

const FTP_PATH = '/comm/network-ethernet/file-terminal/ftp?tab=decode';

test.describe('FTP', () => {
  test('decode sekmesi Hazır rozetiyle açılır ve konsola hata basmaz', async ({ page }) => {
    const consoleErrors = await openDecodePanel(page, FTP_PATH);

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('FTP');
    await expect(page.getByTestId('decode-panel')).toHaveAttribute('data-plugin-id', 'ftp');
    await expect(page.getByText(tr['status.ready'], { exact: true })).toBeVisible();
    await expect(page.getByText(tr['protocol.plannedNotice'])).toHaveCount(0);

    expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
  });

  test('oturumdaki her satır kendi başına sınıflandırılır, PASS redakte edilir', async ({ page }) => {
    await openDecodePanel(page, FTP_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('login-and-retrieve');

    await expect(fieldRow(page, 'response-code-0').getByTestId('decode-field-physical')).toHaveText(
      'Service ready for new user',
    );
    await expect(fieldRow(page, 'command-verb-84').getByTestId('decode-field-physical')).toHaveText(
      'Provide password',
    );
    await expect(fieldRow(page, 'command-argument-89').getByTestId('decode-field-physical')).toHaveText(
      '********',
    );
    await expect(fieldRow(page, 'command-verb-172').getByTestId('decode-field-physical')).toHaveText(
      'Retrieve (download) a file',
    );
    await expect(fieldRow(page, 'command-argument-177').getByTestId('decode-field-physical')).toHaveText(
      'firmware.bin',
    );
    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
    await expectNoRawTranslationKeys(page);
  });

  test('çok satırlı yanıtta devam/son satır ayırıcısı doğru okunur', async ({ page }) => {
    await openDecodePanel(page, FTP_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('multiline-response');

    await expect(fieldRow(page, 'response-multiline-0').getByTestId('decode-field-physical')).toHaveText(
      'Continues',
    );
    await expect(fieldRow(page, 'response-multiline-40').getByTestId('decode-field-physical')).toHaveText(
      'Final Line',
    );
    await expectNoRawTranslationKeys(page);
  });

  test('sınıflandırılamayan satır ham gösterilir, uyarı basmaz', async ({ page }) => {
    await openDecodePanel(page, FTP_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('unclassified-line');

    await expect(fieldRow(page, 'unclassified-line-0').getByTestId('decode-field-physical')).toHaveText(
      '12ab not a response or a command',
    );
    await expect(page.getByTestId('decode-field-warning')).toHaveCount(0);
    await expectNoRawTranslationKeys(page);
  });

  test('İngilizce dilde de çevrilmemiş anahtar basmaz', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('alp-comm-lang', 'en');
    });
    await page.goto(FTP_PATH);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('FTP');
    await page.getByLabel(translations.en['decode.example.label']).selectOption('login-and-retrieve');
    await expect(fieldRow(page, 'command-argument-89').getByTestId('decode-field-physical')).toHaveText(
      '********',
    );
    await expectNoRawTranslationKeys(page);
  });
});
