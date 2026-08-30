import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { translations } from '../src/translations/all';

/**
 * Faz 10 dalga 4b'nin gerçek tarayıcı turu — IPv4.
 *
 * Kanıtladığı şey: header checksum'ın (pseudo-header GEREKTİRMEDİĞİ için) TAM
 * PASS/FAIL doğrulandığı, IHL<5/Total Length<IHL·4 hatalarının ayrı ayrı
 * basıldığı ve Protocol'ün karar-1 tonunda (ICMP/TCP/UDP adlandırılır, payload
 * çözülmez) ekranda gerçekten göründüğü — ethernet-decode.spec.ts'in deseni.
 */

const tr = translations.tr;

const IPV4_PATH = '/comm/network-ethernet/internet-layer/ipv4?tab=decode';

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

test.describe('IPv4', () => {
  test('decode sekmesi Hazır rozetiyle açılır ve konsola hata basmaz', async ({ page }) => {
    const consoleErrors = await openDecodePanel(page, IPV4_PATH);

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('IPv4');
    await expect(page.getByTestId('decode-panel')).toHaveAttribute('data-plugin-id', 'ipv4');
    await expect(page.getByText(tr['status.ready'], { exact: true })).toBeVisible();
    await expect(page.getByText(tr['protocol.plannedNotice'])).toHaveCount(0);

    expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
  });

  test('klasik başlık örneği header checksum’ı PASS olarak basar', async ({ page }) => {
    await openDecodePanel(page, IPV4_PATH);

    await expect(fieldRow(page, 'source-address').getByTestId('decode-field-raw')).toHaveText(
      '172.16.10.99',
    );
    await expect(fieldRow(page, 'checksum').getByTestId('decode-field-physical')).toHaveText('Valid');
    await expect(fieldRow(page, 'protocol').getByTestId('decode-field-physical')).toHaveText('TCP');
    await expect(page.getByTestId('decode-frame-warning')).toContainText(
      tr['protocol.ipv4.warning.protocolHigherLayer'],
    );
    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
    await expectNoRawTranslationKeys(page);
  });

  test('bozuk header checksum örneği checksum-mismatch basar', async ({ page }) => {
    await openDecodePanel(page, IPV4_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('header-checksum-fail');

    const frameError = page.getByTestId('decode-frame-error');
    await expect(frameError).toHaveAttribute('data-error-code', 'checksum-mismatch');
    await expect(fieldRow(page, 'checksum').getByTestId('decode-field-validity')).toHaveText(
      tr['decode.status.invalid'],
    );
    await expectNoRawTranslationKeys(page);
  });

  test('IHL çok küçük örneği value-out-of-range basar, sabit alanlar yine görünür', async ({ page }) => {
    await openDecodePanel(page, IPV4_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('ihl-too-small');

    const frameError = page.getByTestId('decode-frame-error');
    await expect(frameError).toHaveAttribute('data-error-code', 'value-out-of-range');
    await expect(fieldRow(page, 'ttl')).toHaveCount(1);
    await expect(fieldRow(page, 'options')).toHaveCount(0);
    await expect(fieldRow(page, 'payload')).toHaveCount(0);
    await expectNoRawTranslationKeys(page);
  });

  test('tanınmayan Protocol alanı geçersiz işaretler, HATA değil UYARI basar', async ({ page }) => {
    await openDecodePanel(page, IPV4_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('unknown-protocol');

    await expect(fieldRow(page, 'protocol').getByTestId('decode-field-validity')).toHaveText(
      tr['decode.status.invalid'],
    );
    await expect(page.getByTestId('decode-frame-warning')).toContainText(
      tr['protocol.ipv4.warning.unknownProtocol'],
    );
    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
    await expectNoRawTranslationKeys(page);
  });

  test('İngilizce dilde de çevrilmemiş anahtar basmaz', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('alp-comm-lang', 'en');
    });
    await page.goto(IPV4_PATH);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('IPv4');
    await page.getByLabel(translations.en['decode.example.label']).selectOption('total-length-too-small');
    await expect(page.getByTestId('decode-frame-error')).toHaveAttribute(
      'data-error-code',
      'length-mismatch',
    );
    await expectNoRawTranslationKeys(page);
  });
});
