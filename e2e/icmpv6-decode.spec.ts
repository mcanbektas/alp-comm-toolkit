import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { translations } from '../src/translations/all';

/**
 * Faz 10 dalga 12a'nın gerçek tarayıcı turu — ICMPv6.
 *
 * Kanıtladığı şey: checksum'ın (pseudo-header İSTEDİĞİ için, UDP emsali) ham +
 * uyarıyla basıldığı, Neighbor Discovery mesajlarının ADLANDIRILIP gövdesinin
 * ÇÖZÜLMEDİĞİ (dosya başı "ileride ayrı decoder modülleri" kararı) ve Packet
 * Too Big'in MTU alanının gerçekten göründüğü — ipv4-decode.spec.ts'in deseni.
 */

const tr = translations.tr;

const ICMPV6_PATH = '/comm/network-ethernet/internet-layer/icmpv6?tab=decode';

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

test.describe('ICMPv6', () => {
  test('decode sekmesi Hazır rozetiyle açılır ve konsola hata basmaz', async ({ page }) => {
    const consoleErrors = await openDecodePanel(page, ICMPV6_PATH);

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('ICMPv6');
    await expect(page.getByTestId('decode-panel')).toHaveAttribute('data-plugin-id', 'icmpv6');
    await expect(page.getByText(tr['status.ready'], { exact: true })).toBeVisible();
    await expect(page.getByText(tr['protocol.plannedNotice'])).toHaveCount(0);

    expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
  });

  test('Echo Request örneği Identifier/Sequence’ı çözer, checksum ham + pseudo-header uyarısı basar', async ({
    page,
  }) => {
    await openDecodePanel(page, ICMPV6_PATH);

    await expect(fieldRow(page, 'type').getByTestId('decode-field-physical')).toHaveText('Echo Request');
    await expect(fieldRow(page, 'identifier').getByTestId('decode-field-raw')).toHaveText('0x1 (1)');
    await expect(fieldRow(page, 'checksum').getByTestId('decode-field-validity')).toHaveText(
      tr['decode.status.valid'],
    );
    await expect(page.getByTestId('decode-frame-warning')).toContainText(
      tr['protocol.icmpv6.warning.checksumNeedsPseudoHeader'],
    );
    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
    await expectNoRawTranslationKeys(page);
  });

  test('Packet Too Big örneği MTU alanını çözer (Path MTU Discovery)', async ({ page }) => {
    await openDecodePanel(page, ICMPV6_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('packet-too-big');

    await expect(fieldRow(page, 'type').getByTestId('decode-field-physical')).toHaveText('Packet Too Big');
    await expect(fieldRow(page, 'mtu').getByTestId('decode-field-raw')).toHaveText('0x500 (1280)');
    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
    await expectNoRawTranslationKeys(page);
  });

  test('Router Solicitation adlandırılır ama gövdesi çözülmez, ertelendi uyarısı basar', async ({ page }) => {
    await openDecodePanel(page, ICMPV6_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('router-solicitation-deferred');

    await expect(fieldRow(page, 'type').getByTestId('decode-field-physical')).toHaveText(
      'Router Solicitation',
    );
    await expect(fieldRow(page, 'type').getByTestId('decode-field-validity')).toHaveText(
      tr['decode.status.valid'],
    );
    await expect(
      page.getByTestId('decode-frame-warning').filter({ hasText: tr['protocol.icmpv6.warning.neighborDiscoveryDeferred'] }),
    ).toHaveCount(1);
    await expect(fieldRow(page, 'message-body')).toHaveCount(1);
    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
    await expectNoRawTranslationKeys(page);
  });

  test('tanınmayan Type geçersiz işaretler, HATA değil UYARI basar', async ({ page }) => {
    await openDecodePanel(page, ICMPV6_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('unknown-type');

    await expect(fieldRow(page, 'type').getByTestId('decode-field-validity')).toHaveText(
      tr['decode.status.invalid'],
    );
    await expect(
      page.getByTestId('decode-frame-warning').filter({ hasText: tr['protocol.icmpv6.warning.unknownType'] }),
    ).toHaveCount(1);
    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
    await expectNoRawTranslationKeys(page);
  });

  test('İngilizce dilde de çevrilmemiş anahtar basmaz', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('alp-comm-lang', 'en');
    });
    await page.goto(ICMPV6_PATH);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('ICMPv6');
    await page.getByLabel(translations.en['decode.example.label']).selectOption('destination-unreachable-port');
    await expect(fieldRow(page, 'code').getByTestId('decode-field-physical')).toHaveText('Port Unreachable');
    await expectNoRawTranslationKeys(page);
  });
});
