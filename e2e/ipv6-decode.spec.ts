import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { translations } from '../src/translations';

/**
 * Faz 10 dalga 4b'nin gerçek tarayıcı turu — IPv6.
 *
 * Kanıtladığı şey: Next Header zincirinin (bilinen uzantı başlığında atla,
 * bilinmeyende dur) ve "checksum alanı yok, N/A" bilgisinin ekranda gerçekten
 * göründüğü — ethernet-decode.spec.ts'in deseni.
 */

const tr = translations.tr;

const IPV6_PATH = '/comm/network-ethernet/internet-layer/ipv6?tab=decode';

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

test.describe('IPv6', () => {
  test('decode sekmesi Hazır rozetiyle açılır ve konsola hata basmaz', async ({ page }) => {
    const consoleErrors = await openDecodePanel(page, IPV6_PATH);

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('IPv6');
    await expect(page.getByTestId('decode-panel')).toHaveAttribute('data-plugin-id', 'ipv6');
    await expect(page.getByText(tr['status.ready'], { exact: true })).toBeVisible();
    await expect(page.getByText(tr['protocol.plannedNotice'])).toHaveCount(0);

    expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
  });

  test('uzantı başlıksız örnekte Next Header TCP adlandırılır ve N/A checksum gösterilir', async ({
    page,
  }) => {
    await openDecodePanel(page, IPV6_PATH);

    await expect(fieldRow(page, 'next-header').getByTestId('decode-field-physical')).toHaveText('TCP');
    await expect(fieldRow(page, 'checksum').getByTestId('decode-field-physical')).toHaveText('N/A');
    await expect(fieldRow(page, 'source-address').getByTestId('decode-field-raw')).toHaveText(
      '2001:db8:0:0:0:0:0:1',
    );
    await expect(page.getByTestId('decode-frame-warning')).toContainText(
      tr['protocol.ipv6.warning.nextHeaderHigherLayer'],
    );
    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
    await expectNoRawTranslationKeys(page);
  });

  test('Hop-by-Hop → UDP zinciri uzantı başlığını atlar ve terminali adlandırır', async ({ page }) => {
    await openDecodePanel(page, IPV6_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('hop-by-hop-then-udp');

    await expect(fieldRow(page, 'next-header').getByTestId('decode-field-physical')).toHaveText(
      'Hop-by-Hop Options',
    );
    await expect(fieldRow(page, 'ext-header-1').getByTestId('decode-field-physical')).toHaveText('UDP');
    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
    await expectNoRawTranslationKeys(page);
  });

  test('tanınmayan Next Header zinciri hiç başlatmaz, HATA değil UYARI basar', async ({ page }) => {
    await openDecodePanel(page, IPV6_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('unknown-next-header');

    await expect(fieldRow(page, 'next-header').getByTestId('decode-field-validity')).toHaveText(
      tr['decode.status.invalid'],
    );
    await expect(page.getByTestId('decode-frame-warning')).toContainText(
      tr['protocol.ipv6.warning.unknownNextHeader'],
    );
    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
    await expectNoRawTranslationKeys(page);
  });

  test('eksik uzantı başlığı truncated-frame basar', async ({ page }) => {
    await openDecodePanel(page, IPV6_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('truncated-extension-header');

    const frameError = page.getByTestId('decode-frame-error');
    await expect(frameError).toHaveAttribute('data-error-code', 'truncated-frame');
    await expect(fieldRow(page, 'source-address')).toHaveCount(1);
    await expectNoRawTranslationKeys(page);
  });

  test('İngilizce dilde de çevrilmemiş anahtar basmaz', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('alp-comm-lang', 'en');
    });
    await page.goto(IPV6_PATH);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('IPv6');
    await page.getByLabel(translations.en['decode.example.label']).selectOption('unknown-next-header');
    await expect(page.getByTestId('decode-frame-warning')).toContainText(
      translations.en['protocol.ipv6.warning.unknownNextHeader'],
    );
    await expectNoRawTranslationKeys(page);
  });
});
