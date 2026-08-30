import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { translations } from '../src/translations/all';

/**
 * Faz 10 dalga 4b'nin gerçek tarayıcı turu — TCP.
 *
 * Kanıtladığı şey: 8 bayrağın (Flag Panel) ayrı ayrı alan olarak göründüğü,
 * checksum'ın UDP'yle aynı şekilde ham + `checksumNeedsPseudoHeader` uyarısıyla
 * basıldığı ve Data Offset<5/eksik options hatalarının ekranda gerçekten
 * çıktığı — ethernet-decode.spec.ts'in deseni.
 */

const tr = translations.tr;

const TCP_PATH = '/comm/network-ethernet/transport/tcp?tab=decode';

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

test.describe('TCP', () => {
  test('decode sekmesi Hazır rozetiyle açılır ve konsola hata basmaz', async ({ page }) => {
    const consoleErrors = await openDecodePanel(page, TCP_PATH);

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('TCP');
    await expect(page.getByTestId('decode-panel')).toHaveAttribute('data-plugin-id', 'tcp');
    await expect(page.getByText(tr['status.ready'], { exact: true })).toBeVisible();
    await expect(page.getByText(tr['protocol.plannedNotice'])).toHaveCount(0);

    expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
  });

  test('SYN örneği yalnız SYN bayrağını basar, checksum ham + uyarı gösterir', async ({ page }) => {
    await openDecodePanel(page, TCP_PATH);

    await expect(fieldRow(page, 'flag-syn').getByTestId('decode-field-raw')).toHaveText('0x1 (1)');
    await expect(fieldRow(page, 'flag-ack').getByTestId('decode-field-raw')).toHaveText('0x0 (0)');
    await expect(fieldRow(page, 'flag-fin').getByTestId('decode-field-raw')).toHaveText('0x0 (0)');
    await expect(page.getByTestId('decode-frame-warning')).toContainText(
      tr['protocol.tcp.warning.checksumNeedsPseudoHeader'],
    );
    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
    await expectNoRawTranslationKeys(page);
  });

  test('PSH+ACK+options örneği hem bayrakları hem ham Options’ı basar', async ({ page }) => {
    await openDecodePanel(page, TCP_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('psh-ack-with-options');

    await expect(fieldRow(page, 'flag-psh').getByTestId('decode-field-raw')).toHaveText('0x1 (1)');
    await expect(fieldRow(page, 'flag-ack').getByTestId('decode-field-raw')).toHaveText('0x1 (1)');
    await expect(fieldRow(page, 'options')).toHaveCount(1);
    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
    await expectNoRawTranslationKeys(page);
  });

  test('Data Offset çok küçük örneği value-out-of-range basar', async ({ page }) => {
    await openDecodePanel(page, TCP_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('data-offset-too-small');

    const frameError = page.getByTestId('decode-frame-error');
    await expect(frameError).toHaveAttribute('data-error-code', 'value-out-of-range');
    await expect(fieldRow(page, 'window-size')).toHaveCount(1);
    await expect(fieldRow(page, 'options')).toHaveCount(0);
    await expectNoRawTranslationKeys(page);
  });

  test('eksik options örneği truncated-frame basar', async ({ page }) => {
    await openDecodePanel(page, TCP_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('truncated-options');

    const frameError = page.getByTestId('decode-frame-error');
    await expect(frameError).toHaveAttribute('data-error-code', 'truncated-frame');
    await expectNoRawTranslationKeys(page);
  });

  test('İngilizce dilde de çevrilmemiş anahtar basmaz', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('alp-comm-lang', 'en');
    });
    await page.goto(TCP_PATH);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('TCP');
    await page.getByLabel(translations.en['decode.example.label']).selectOption('data-offset-too-small');
    await expect(page.getByTestId('decode-frame-error')).toHaveAttribute(
      'data-error-code',
      'value-out-of-range',
    );
    await expectNoRawTranslationKeys(page);
  });

  test('1440 ve 390 pikselde yatay taşma yok (8 satırlık Flag Panel dahil)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openDecodePanel(page, TCP_PATH);
    await page.getByLabel(tr['decode.example.label']).selectOption('psh-ack-with-options');
    await expect(page.getByTestId('decode-field-table')).toBeVisible();
    const wide = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(wide, 'sayfa 1440px genişlikte yatayda taşıyor').toBeLessThanOrEqual(0);

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByTestId('decode-field-table')).toBeVisible();
    const narrow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(narrow, 'sayfa 390px genişlikte yatayda taşıyor').toBeLessThanOrEqual(0);
  });
});
