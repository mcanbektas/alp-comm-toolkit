import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { translations } from '../src/translations';

/**
 * Faz 10 dalga 12c'nin gerçek tarayıcı turu — DHCP.
 *
 * Kanıtladığı şey: dar tutulan yedi option'ın (Subnet Mask/Router/DNS
 * Servers/Requested IP/Lease Time/Message Type/Server Identifier) okunur
 * gösterildiği, dar kümenin dışındaki bir Message Type değerinin HATA değil
 * UYARI bastığı ve bozuk Magic Cookie'nin gerçekten value-out-of-range
 * bastığı — icmp-decode.spec.ts'in deseni.
 */

const tr = translations.tr;

const DHCP_PATH = '/comm/network-ethernet/addressing-discovery/dhcp?tab=decode';

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

test.describe('DHCP', () => {
  test('decode sekmesi Hazır rozetiyle açılır ve konsola hata basmaz', async ({ page }) => {
    const consoleErrors = await openDecodePanel(page, DHCP_PATH);

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('DHCP');
    await expect(page.getByTestId('decode-panel')).toHaveAttribute('data-plugin-id', 'dhcp');
    await expect(page.getByText(tr['status.ready'], { exact: true })).toBeVisible();
    await expect(page.getByText(tr['protocol.plannedNotice'])).toHaveCount(0);

    expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
  });

  test('DHCPDISCOVER örneği op/chaddr/Message Type’ı çözer', async ({ page }) => {
    await openDecodePanel(page, DHCP_PATH);

    await expect(fieldRow(page, 'op').getByTestId('decode-field-physical')).toHaveText('BOOTREQUEST');
    await expect(fieldRow(page, 'chaddr').getByTestId('decode-field-raw')).toHaveText('00:11:22:33:44:55');
    await expect(fieldRow(page, 'option-53').getByTestId('decode-field-physical')).toHaveText('DHCPDISCOVER');
    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
    await expectNoRawTranslationKeys(page);
  });

  test('DHCPOFFER örneği Subnet Mask/Router/Lease Time seçeneklerini gösterir', async ({ page }) => {
    await openDecodePanel(page, DHCP_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('offer');

    await expect(fieldRow(page, 'yiaddr').getByTestId('decode-field-raw')).toHaveText('192.168.1.100');
    await expect(fieldRow(page, 'option-1').getByTestId('decode-field-raw')).toHaveText('255.255.255.0');
    await expect(fieldRow(page, 'option-51').getByTestId('decode-field-raw')).toHaveText('0xE10 (3600)');
    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
    await expectNoRawTranslationKeys(page);
  });

  test('tanınmayan Message Type geçersiz işaretler, HATA değil UYARI basar', async ({ page }) => {
    await openDecodePanel(page, DHCP_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('unknown-message-type');

    await expect(fieldRow(page, 'option-53').getByTestId('decode-field-validity')).toHaveText(
      tr['decode.status.invalid'],
    );
    await expect(page.getByTestId('decode-frame-warning')).toContainText(
      tr['protocol.dhcp.warning.unknownMessageType'],
    );
    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
    await expectNoRawTranslationKeys(page);
  });

  test('bozuk Magic Cookie örneği value-out-of-range basar', async ({ page }) => {
    await openDecodePanel(page, DHCP_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('bad-magic-cookie');

    const frameError = page.getByTestId('decode-frame-error');
    await expect(frameError).toHaveAttribute('data-error-code', 'value-out-of-range');
    await expectNoRawTranslationKeys(page);
  });

  test('İngilizce dilde de çevrilmemiş anahtar basmaz', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('alp-comm-lang', 'en');
    });
    await page.goto(DHCP_PATH);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('DHCP');
    await page.getByLabel(translations.en['decode.example.label']).selectOption('offer');
    await expect(fieldRow(page, 'option-53').getByTestId('decode-field-physical')).toHaveText('DHCPOFFER');
    await expectNoRawTranslationKeys(page);
  });
});
