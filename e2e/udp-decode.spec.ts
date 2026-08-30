import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { translations } from '../src/translations/all';

/**
 * Faz 10 dalga 4b'nin gerçek tarayıcı turu — UDP.
 *
 * Kanıtladığı şey: checksum'ın (pseudo-header olmadan doğrulanamadığı için)
 * her zaman ham + `checksumNeedsPseudoHeader` uyarısıyla basıldığı, mismatch'in
 * ASLA görünmediği ve IPv4'teki "0x0000 = kullanılmıyor" özel notunun ekranda
 * gerçekten çıktığı — ethernet-decode.spec.ts'in deseni.
 */

const tr = translations.tr;

const UDP_PATH = '/comm/network-ethernet/transport/udp?tab=decode';

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

test.describe('UDP', () => {
  test('decode sekmesi Hazır rozetiyle açılır ve konsola hata basmaz', async ({ page }) => {
    const consoleErrors = await openDecodePanel(page, UDP_PATH);

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('UDP');
    await expect(page.getByTestId('decode-panel')).toHaveAttribute('data-plugin-id', 'udp');
    await expect(page.getByText(tr['status.ready'], { exact: true })).toBeVisible();
    await expect(page.getByText(tr['protocol.plannedNotice'])).toHaveCount(0);

    expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
  });

  test('checksum ham gösterilir, pseudo-header uyarısı basar, mismatch YOK', async ({ page }) => {
    await openDecodePanel(page, UDP_PATH);

    await expect(fieldRow(page, 'source-port').getByTestId('decode-field-raw')).toHaveText('0x35 (53)');
    await expect(fieldRow(page, 'checksum').getByTestId('decode-field-validity')).toHaveText(
      tr['decode.status.valid'],
    );
    await expect(page.getByTestId('decode-frame-warning')).toContainText(
      tr['protocol.udp.warning.checksumNeedsPseudoHeader'],
    );
    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
    await expectNoRawTranslationKeys(page);
  });

  test('checksum 0x0000 örneği IPv4 "kullanılmıyor" notunu ekler', async ({ page }) => {
    await openDecodePanel(page, UDP_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('checksum-disabled-ipv4');

    // Bu örnek İKİ uyarı basar (pseudo-header + 0x0000 notu) — `.filter` ile
    // hedefi daralt, strict-mode ihlaline düşme (ethernet.ts FCS deseninin emsali).
    await expect(
      page
        .getByTestId('decode-frame-warning')
        .filter({ hasText: tr['protocol.udp.warning.checksumZeroMeansDisabledOverIpv4'] }),
    ).toHaveCount(1);
    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
    await expectNoRawTranslationKeys(page);
  });

  test('Length 8’den küçük örneği value-out-of-range basar', async ({ page }) => {
    await openDecodePanel(page, UDP_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('length-too-small');

    const frameError = page.getByTestId('decode-frame-error');
    await expect(frameError).toHaveAttribute('data-error-code', 'value-out-of-range');
    await expectNoRawTranslationKeys(page);
  });

  test('trailing bytes örneği ayrı bir alanda gösterilir, hata değil uyarı basar', async ({ page }) => {
    await openDecodePanel(page, UDP_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('trailing-bytes');

    await expect(fieldRow(page, 'trailing-data')).toHaveCount(1);
    // Bu örnek de İKİ uyarı basar (pseudo-header + trailing bytes) — aynı filtre deseni.
    await expect(
      page.getByTestId('decode-frame-warning').filter({ hasText: tr['protocol.udp.warning.trailingBytes'] }),
    ).toHaveCount(1);
    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
    await expectNoRawTranslationKeys(page);
  });

  test('İngilizce dilde de çevrilmemiş anahtar basmaz', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('alp-comm-lang', 'en');
    });
    await page.goto(UDP_PATH);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('UDP');
    await page.getByLabel(translations.en['decode.example.label']).selectOption('length-too-small');
    await expect(page.getByTestId('decode-frame-error')).toHaveAttribute(
      'data-error-code',
      'value-out-of-range',
    );
    await expectNoRawTranslationKeys(page);
  });
});
