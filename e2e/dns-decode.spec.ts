import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { translations } from '../src/translations';

/**
 * Faz 10 dalga 12c'nin gerçek tarayıcı turu — DNS.
 *
 * Kanıtladığı şey: isim sıkıştırmasının (0xC00C pointer) gerçekten çözüldüğü,
 * RCODE'un adlandırıldığı ve kendi kendine işaret eden bir pointer'ın
 * parser'ı KİLİTLEMEDEN truncated-frame bastığı — icmp-decode.spec.ts'in deseni.
 */

const tr = translations.tr;

const DNS_PATH = '/comm/network-ethernet/addressing-discovery/dns?tab=decode';

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

test.describe('DNS', () => {
  test('decode sekmesi Hazır rozetiyle açılır ve konsola hata basmaz', async ({ page }) => {
    const consoleErrors = await openDecodePanel(page, DNS_PATH);

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('DNS');
    await expect(page.getByTestId('decode-panel')).toHaveAttribute('data-plugin-id', 'dns');
    await expect(page.getByText(tr['status.ready'], { exact: true })).toBeVisible();
    await expect(page.getByText(tr['protocol.plannedNotice'])).toHaveCount(0);

    expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
  });

  test('sıkıştırılmış yanıt örneği 0xC00C pointer’ını çözer', async ({ page }) => {
    await openDecodePanel(page, DNS_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('response-with-answer');

    await expect(fieldRow(page, 'answer-1-name').getByTestId('decode-field-raw')).toHaveText('example.com');
    await expect(fieldRow(page, 'answer-1-rdata').getByTestId('decode-field-raw')).toHaveText('93.184.216.34');
    await expect(fieldRow(page, 'flags-rcode').getByTestId('decode-field-physical')).toHaveText('NOERROR');
    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
    await expectNoRawTranslationKeys(page);
  });

  test('NXDOMAIN örneği RCODE’u adlandırır', async ({ page }) => {
    await openDecodePanel(page, DNS_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('nxdomain');

    await expect(fieldRow(page, 'flags-rcode').getByTestId('decode-field-physical')).toHaveText('NXDOMAIN');
    await expectNoRawTranslationKeys(page);
  });

  test('isim döngüsü örneği truncated-frame basar, sayfa çökmez', async ({ page }) => {
    await openDecodePanel(page, DNS_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('name-loop');

    const frameError = page.getByTestId('decode-frame-error');
    await expect(frameError).toHaveAttribute('data-error-code', 'truncated-frame');
    await expectNoRawTranslationKeys(page);
  });

  test('İngilizce dilde de çevrilmemiş anahtar basmaz', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('alp-comm-lang', 'en');
    });
    await page.goto(DNS_PATH);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('DNS');
    await page.getByLabel(translations.en['decode.example.label']).selectOption('cname-chain');
    await expect(fieldRow(page, 'answer-1-rdata').getByTestId('decode-field-raw')).toHaveText('example.com');
    await expectNoRawTranslationKeys(page);
  });
});
