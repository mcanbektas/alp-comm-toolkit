import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { translations } from '../src/translations/all';

/**
 * Faz 10 dalga 12a'nın gerçek tarayıcı turu — ICMP.
 *
 * Kanıtladığı şey: checksum'ın (pseudo-header GEREKTİRMEDİĞİ için) TAM PASS/FAIL
 * doğrulandığı, dar Type kümesinin dışındaki bir değerin HATA değil UYARI
 * bastığı ve Destination Unreachable'ın original datagram'ı gerçekten
 * gösterdiği — ipv4-decode.spec.ts'in deseni.
 */

const tr = translations.tr;

const ICMP_PATH = '/comm/network-ethernet/internet-layer/icmp?tab=decode';

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

test.describe('ICMP', () => {
  test('decode sekmesi Hazır rozetiyle açılır ve konsola hata basmaz', async ({ page }) => {
    const consoleErrors = await openDecodePanel(page, ICMP_PATH);

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('ICMP');
    await expect(page.getByTestId('decode-panel')).toHaveAttribute('data-plugin-id', 'icmp');
    await expect(page.getByText(tr['status.ready'], { exact: true })).toBeVisible();
    await expect(page.getByText(tr['protocol.plannedNotice'])).toHaveCount(0);

    expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
  });

  test('Echo Request örneği Identifier/Sequence’ı çözer, checksum PASS basar', async ({ page }) => {
    await openDecodePanel(page, ICMP_PATH);

    await expect(fieldRow(page, 'type').getByTestId('decode-field-physical')).toHaveText('Echo Request');
    await expect(fieldRow(page, 'identifier').getByTestId('decode-field-raw')).toHaveText('0x1 (1)');
    await expect(fieldRow(page, 'checksum').getByTestId('decode-field-physical')).toHaveText('Valid');
    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
    await expectNoRawTranslationKeys(page);
  });

  test('bozuk checksum örneği checksum-mismatch basar', async ({ page }) => {
    await openDecodePanel(page, ICMP_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('checksum-fail');

    const frameError = page.getByTestId('decode-frame-error');
    await expect(frameError).toHaveAttribute('data-error-code', 'checksum-mismatch');
    await expect(fieldRow(page, 'checksum').getByTestId('decode-field-validity')).toHaveText(
      tr['decode.status.invalid'],
    );
    await expectNoRawTranslationKeys(page);
  });

  test('Destination Unreachable — Port Unreachable original datagram’ı gösterir', async ({ page }) => {
    await openDecodePanel(page, ICMP_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('destination-unreachable-port');

    await expect(fieldRow(page, 'code').getByTestId('decode-field-physical')).toHaveText('Port Unreachable');
    await expect(fieldRow(page, 'original-datagram')).toHaveCount(1);
    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
    await expectNoRawTranslationKeys(page);
  });

  test('tanınmayan Type geçersiz işaretler, HATA değil UYARI basar', async ({ page }) => {
    await openDecodePanel(page, ICMP_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('unknown-type');

    await expect(fieldRow(page, 'type').getByTestId('decode-field-validity')).toHaveText(
      tr['decode.status.invalid'],
    );
    await expect(page.getByTestId('decode-frame-warning')).toContainText(
      tr['protocol.icmp.warning.unknownType'],
    );
    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
    await expectNoRawTranslationKeys(page);
  });

  test('İngilizce dilde de çevrilmemiş anahtar basmaz', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('alp-comm-lang', 'en');
    });
    await page.goto(ICMP_PATH);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('ICMP');
    await page.getByLabel(translations.en['decode.example.label']).selectOption('time-exceeded-ttl');
    await expect(fieldRow(page, 'code').getByTestId('decode-field-physical')).toHaveText(
      'TTL Exceeded in Transit',
    );
    await expectNoRawTranslationKeys(page);
  });
});
