import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { translations } from '../src/translations/all';

/**
 * Faz 10 dalga 12b'nin gerçek tarayıcı turu — LLDP.
 *
 * Kanıtladığı şey: Chassis ID/Port ID subtype'larının ve System Capabilities
 * bit alanlarının okunur çözüldüğü, End TLV eksikliğinin HATA değil UYARI
 * bastığı ve kesik bir TLV'nin gerçekten truncated-frame ürettiği —
 * icmp-decode.spec.ts'in deseni.
 */

const tr = translations.tr;

const LLDP_PATH = '/comm/network-ethernet/data-link/lldp?tab=decode';

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

test.describe('LLDP', () => {
  test('decode sekmesi Hazır rozetiyle açılır ve konsola hata basmaz', async ({ page }) => {
    const consoleErrors = await openDecodePanel(page, LLDP_PATH);

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('LLDP');
    await expect(page.getByTestId('decode-panel')).toHaveAttribute('data-plugin-id', 'lldp');
    await expect(page.getByText(tr['status.ready'], { exact: true })).toBeVisible();
    await expect(page.getByText(tr['protocol.plannedNotice'])).toHaveCount(0);

    expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
  });

  test('switch komşuluğu örneği Chassis/Port ID ve Capabilities’i çözer', async ({ page }) => {
    await openDecodePanel(page, LLDP_PATH);

    await expect(fieldRow(page, 'chassis-id-subtype').getByTestId('decode-field-physical')).toHaveText(
      'MAC Address',
    );
    await expect(fieldRow(page, 'chassis-id').getByTestId('decode-field-raw')).toHaveText(
      '00:1A:2B:3C:4D:5E',
    );
    await expect(fieldRow(page, 'ttl').getByTestId('decode-field-raw')).toHaveText('0x78 (120)');
    await expect(fieldRow(page, 'system-name').getByTestId('decode-field-raw')).toHaveText('switch01');
    await expect(fieldRow(page, 'system-capabilities').getByTestId('decode-field-physical')).toHaveText(
      'Bridge, Router',
    );
    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
    await expectNoRawTranslationKeys(page);
  });

  test('Management Address örneği IPv4 adresini çözer', async ({ page }) => {
    await openDecodePanel(page, LLDP_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('management-address-ipv4');

    await expect(fieldRow(page, 'management-address').getByTestId('decode-field-raw')).toHaveText(
      '192.168.1.1',
    );
    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
    await expectNoRawTranslationKeys(page);
  });

  test('End TLV eksikse HATA değil UYARI basar', async ({ page }) => {
    await openDecodePanel(page, LLDP_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('missing-end-tlv');

    await expect(
      page.getByTestId('decode-frame-warning').filter({ hasText: tr['protocol.lldp.warning.missingEndTlv'] }),
    ).toHaveCount(1);
    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
    await expectNoRawTranslationKeys(page);
  });

  test('kesik TLV örneği truncated-frame basar', async ({ page }) => {
    await openDecodePanel(page, LLDP_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('truncated-tlv');

    const frameError = page.getByTestId('decode-frame-error');
    await expect(frameError).toHaveAttribute('data-error-code', 'truncated-frame');
    await expectNoRawTranslationKeys(page);
  });

  test('İngilizce dilde de çevrilmemiş anahtar basmaz', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('alp-comm-lang', 'en');
    });
    await page.goto(LLDP_PATH);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('LLDP');
    await page.getByLabel(translations.en['decode.example.label']).selectOption('organizationally-specific');
    await expect(fieldRow(page, 'organizationally-specific-oui').getByTestId('decode-field-raw')).toHaveText(
      '00:80:C2',
    );
    await expectNoRawTranslationKeys(page);
  });
});
