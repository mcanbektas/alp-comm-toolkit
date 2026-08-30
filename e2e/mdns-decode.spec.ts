import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { translations } from '../src/translations/all';

/**
 * Faz 10 dalga 12c'nin gerçek tarayıcı turu — mDNS.
 *
 * Kanıtladığı şey: CLASS alanının üst bitinin (RFC 6762) soruda "unicast
 * response requested", yanıtta "cache flush" olarak AYRI birer alanla
 * gösterildiği ve standart DNS'ten farkın yalnız bu bit olduğu —
 * icmp-decode.spec.ts'in deseni.
 */

const tr = translations.tr;

const MDNS_PATH = '/comm/network-ethernet/addressing-discovery/mdns?tab=decode';

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

test.describe('mDNS', () => {
  test('decode sekmesi Hazır rozetiyle açılır ve konsola hata basmaz', async ({ page }) => {
    const consoleErrors = await openDecodePanel(page, MDNS_PATH);

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('mDNS');
    await expect(page.getByTestId('decode-panel')).toHaveAttribute('data-plugin-id', 'mdns');
    await expect(page.getByText(tr['status.ready'], { exact: true })).toBeVisible();
    await expect(page.getByText(tr['protocol.plannedNotice'])).toHaveCount(0);

    expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
  });

  test('query-local örneği device.local sorgusunu çözer', async ({ page }) => {
    await openDecodePanel(page, MDNS_PATH);

    await expect(fieldRow(page, 'question-1-name').getByTestId('decode-field-raw')).toHaveText('device.local');
    await expect(fieldRow(page, 'question-1-type').getByTestId('decode-field-physical')).toHaveText('A');
    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
    await expectNoRawTranslationKeys(page);
  });

  test('unicast-response-requested örneği QU bitini gösterir', async ({ page }) => {
    await openDecodePanel(page, MDNS_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('unicast-response-requested');

    await expect(fieldRow(page, 'question-1-unicast-response').getByTestId('decode-field-raw')).toHaveText(
      '0x1 (1)',
    );
    await expectNoRawTranslationKeys(page);
  });

  test('response-cache-flush örneği cache-flush bitini gösterir', async ({ page }) => {
    await openDecodePanel(page, MDNS_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('response-cache-flush');

    await expect(fieldRow(page, 'answer-1-cache-flush').getByTestId('decode-field-raw')).toHaveText('0x1 (1)');
    await expect(fieldRow(page, 'answer-1-rdata').getByTestId('decode-field-raw')).toHaveText('192.168.1.50');
    await expectNoRawTranslationKeys(page);
  });

  test('İngilizce dilde de çevrilmemiş anahtar basmaz', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('alp-comm-lang', 'en');
    });
    await page.goto(MDNS_PATH);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('mDNS');
    await page.getByLabel(translations.en['decode.example.label']).selectOption('query-with-answer-compressed');
    await expect(fieldRow(page, 'answer-1-name').getByTestId('decode-field-raw')).toHaveText('device.local');
    await expectNoRawTranslationKeys(page);
  });
});
