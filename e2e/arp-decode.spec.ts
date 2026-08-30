import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { translations } from '../src/translations/all';

/**
 * Faz 10 dalga 12b'nin gerçek tarayıcı turu — ARP.
 *
 * Kanıtladığı şey: Hardware/Protocol adreslerinin Ethernet/IPv4 kombinasyonunda
 * okunur biçimlendirildiği, dar Operation kümesinin dışındaki bir değerin HATA
 * değil UYARI bastığı ve 64 baytlık Ethernet asgari çerçeve dolgusunun ayrı bir
 * Padding alanına düştüğü — icmp-decode.spec.ts'in deseni.
 */

const tr = translations.tr;

const ARP_PATH = '/comm/network-ethernet/data-link/arp?tab=decode';

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

test.describe('ARP', () => {
  test('decode sekmesi Hazır rozetiyle açılır ve konsola hata basmaz', async ({ page }) => {
    const consoleErrors = await openDecodePanel(page, ARP_PATH);

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('ARP');
    await expect(page.getByTestId('decode-panel')).toHaveAttribute('data-plugin-id', 'arp');
    await expect(page.getByText(tr['status.ready'], { exact: true })).toBeVisible();
    await expect(page.getByText(tr['protocol.plannedNotice'])).toHaveCount(0);

    expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
  });

  test('Request örneği MAC/dotted-decimal adresleri okunur gösterir', async ({ page }) => {
    await openDecodePanel(page, ARP_PATH);

    await expect(fieldRow(page, 'operation').getByTestId('decode-field-physical')).toHaveText('Request');
    await expect(fieldRow(page, 'sender-hardware-address').getByTestId('decode-field-raw')).toHaveText(
      '00:11:22:33:44:55',
    );
    await expect(fieldRow(page, 'sender-protocol-address').getByTestId('decode-field-raw')).toHaveText(
      '192.168.1.10',
    );
    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
    await expectNoRawTranslationKeys(page);
  });

  test('dolgulu örnek Padding alanını gösterir', async ({ page }) => {
    await openDecodePanel(page, ARP_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('padded');

    await expect(fieldRow(page, 'padding')).toHaveCount(1);
    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
    await expectNoRawTranslationKeys(page);
  });

  test('tanınmayan Operation geçersiz işaretler, HATA değil UYARI basar', async ({ page }) => {
    await openDecodePanel(page, ARP_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('unknown-operation');

    await expect(fieldRow(page, 'operation').getByTestId('decode-field-validity')).toHaveText(
      tr['decode.status.invalid'],
    );
    await expect(page.getByTestId('decode-frame-warning')).toContainText(
      tr['protocol.arp.warning.unknownOperation'],
    );
    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
    await expectNoRawTranslationKeys(page);
  });

  test('İngilizce dilde de çevrilmemiş anahtar basmaz', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('alp-comm-lang', 'en');
    });
    await page.goto(ARP_PATH);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('ARP');
    await page.getByLabel(translations.en['decode.example.label']).selectOption('reply');
    await expect(fieldRow(page, 'operation').getByTestId('decode-field-physical')).toHaveText('Reply');
    await expectNoRawTranslationKeys(page);
  });
});
