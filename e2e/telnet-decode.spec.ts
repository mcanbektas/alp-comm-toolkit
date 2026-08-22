import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { translations } from '../src/translations';

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
 * Faz 10 dalga 12h'nin gerçek tarayıcı turu — Telnet.
 *
 * Kanıtladığı şey: düz metin ile IAC komutlarının tek geçişte ayrı alanlara
 * ayrıldığı, subnegotiation verisinin option kodu + ham veri olarak
 * gösterildiği, plaintext güvenlik uyarısının HER çözümde sabit bastığı ve
 * kapatılmamış bir subnegotiation'ın hata verdiği.
 */

const TELNET_PATH = '/comm/network-ethernet/file-terminal/telnet?tab=decode';

test.describe('Telnet', () => {
  test('decode sekmesi Hazır rozetiyle açılır ve konsola hata basmaz', async ({ page }) => {
    const consoleErrors = await openDecodePanel(page, TELNET_PATH);

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Telnet');
    await expect(page.getByTestId('decode-panel')).toHaveAttribute('data-plugin-id', 'telnet');
    await expect(page.getByText(tr['status.ready'], { exact: true })).toBeVisible();
    await expect(page.getByText(tr['protocol.plannedNotice'])).toHaveCount(0);

    expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
  });

  test('IAC DO ECHO tek komutun kendi anlamıyla gösterilir, ardından düz metin', async ({ page }) => {
    await openDecodePanel(page, TELNET_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('echo-negotiation');

    await expect(fieldRow(page, 'negotiation-0').getByTestId('decode-field-physical')).toHaveText(
      'Requests the peer to enable ECHO',
    );
    await expect(fieldRow(page, 'text-3').getByTestId('decode-field-physical')).toHaveText('login: ');
    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
    await expectNoRawTranslationKeys(page);
  });

  test('Terminal Type subnegotiation option kodu + ham veri olarak ayrışır', async ({ page }) => {
    await openDecodePanel(page, TELNET_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('terminal-type-subnegotiation');

    await expect(
      fieldRow(page, 'subnegotiation-option-3').getByTestId('decode-field-physical'),
    ).toHaveText('TERMINAL TYPE');
    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
    await expectNoRawTranslationKeys(page);
  });

  test('kaçışlı literal 0xFF komşu metin koşularından ayrı bir alan olarak görünür', async ({ page }) => {
    await openDecodePanel(page, TELNET_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('escaped-literal-ff');

    await expect(fieldRow(page, 'text-0').getByTestId('decode-field-physical')).toHaveText('A');
    await expect(fieldRow(page, 'escaped-ff-1').getByTestId('decode-field-raw')).toContainText('255');
    await expect(fieldRow(page, 'text-3').getByTestId('decode-field-physical')).toHaveText('B');
    await expectNoRawTranslationKeys(page);
  });

  test('kapatılmamış subnegotiation hata basar', async ({ page }) => {
    await openDecodePanel(page, TELNET_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('unterminated-subnegotiation');

    await expect(page.getByTestId('decode-frame-error').first()).toHaveAttribute(
      'data-error-code',
      'truncated-frame',
    );
    await expectNoRawTranslationKeys(page);
  });

  test('plaintext güvenlik uyarısı her çözümde sabit basılır', async ({ page }) => {
    await openDecodePanel(page, TELNET_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('echo-negotiation');

    await expect(page.getByTestId('decode-frame-warning').first()).toBeVisible();
    await expectNoRawTranslationKeys(page);
  });

  test('İngilizce dilde de çevrilmemiş anahtar basmaz', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('alp-comm-lang', 'en');
    });
    await page.goto(TELNET_PATH);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Telnet');
    await page.getByLabel(translations.en['decode.example.label']).selectOption('echo-negotiation');
    await expect(fieldRow(page, 'negotiation-0').getByTestId('decode-field-physical')).toHaveText(
      'Requests the peer to enable ECHO',
    );
    await expectNoRawTranslationKeys(page);
  });
});
