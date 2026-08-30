import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { translations } from '../src/translations/all';

/**
 * Faz 10 dalga 12d'nin gerçek tarayıcı turu — PTP.
 *
 * Kanıtladığı şey: messageType'ın baytın ALT yarısından okunduğu (Sync,
 * Announce değil), correctionField'in nanosaniyeye ölçeklendiği ve negatif
 * değerin negatif kaldığı, Clock Mode'un yalnız event mesajında üretildiği ve
 * TLV16 zincirinin adlandırıldığı — dns-decode.spec.ts'in deseni.
 */

const tr = translations.tr;

const PTP_PATH = '/comm/network-ethernet/time-management/ptp?tab=decode';

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

/** Alan uyarısı satırı, alanın KENDİ satırının içinde değil AYRI bir `<tr>`de
 * basılır (DecodePanel.tsx:272) — bu yüzden kök seviyeden aranır. */
function fieldWarning(page: Page, fieldId: string): Locator {
  return page.locator(`[data-testid="decode-field-warning"][data-field-id="${fieldId}"]`);
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

test.describe('PTP', () => {
  test('decode sekmesi Hazır rozetiyle açılır ve konsola hata basmaz', async ({ page }) => {
    const consoleErrors = await openDecodePanel(page, PTP_PATH);

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('PTP');
    await expect(page.getByTestId('decode-panel')).toHaveAttribute('data-plugin-id', 'ptp');
    await expect(page.getByText(tr['status.ready'], { exact: true })).toBeVisible();
    await expect(page.getByText(tr['protocol.plannedNotice'])).toHaveCount(0);

    expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
  });

  test('two-step Sync örneği Clock Mode üretir, damgayı "ayarlanmamış" işaretler', async ({ page }) => {
    await openDecodePanel(page, PTP_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('sync-two-step');

    await expect(fieldRow(page, 'message-type').getByTestId('decode-field-physical')).toHaveText('Sync');
    await expect(fieldRow(page, 'clock-mode').getByTestId('decode-field-physical')).toHaveText('Two-Step');
    await expect(fieldWarning(page, 'origin-timestamp')).toHaveText(tr['protocol.ptp.warning.timestampUnset']);
    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
    await expectNoRawTranslationKeys(page);
  });

  test('Follow_Up örneği asıl t1 damgasını ve ölçeklenmiş correctionField’i gösterir', async ({ page }) => {
    await openDecodePanel(page, PTP_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('follow-up');

    await expect(fieldRow(page, 'message-type').getByTestId('decode-field-physical')).toHaveText('Follow_Up');
    await expect(fieldRow(page, 'precise-origin-timestamp').getByTestId('decode-field-physical')).toContainText(
      '2026-08-22T12:00:00',
    );
    // Ham 64 bit değil, nanosaniyeye ölçeklenmiş değer.
    await expect(fieldRow(page, 'correction-field').getByTestId('decode-field-physical')).toContainText('1250.5');
    // Follow_Up event mesajı DEĞİL: Clock Mode üretilmez.
    await expect(fieldRow(page, 'clock-mode')).toHaveCount(0);
    await expectNoRawTranslationKeys(page);
  });

  test('Announce örneği BMCA veri kümesini çözer ama karar vermediğini söyler', async ({ page }) => {
    await openDecodePanel(page, PTP_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('announce');

    await expect(fieldRow(page, 'message-type').getByTestId('decode-field-physical')).toHaveText('Announce');
    await expect(fieldRow(page, 'grandmaster-clock-class').getByTestId('decode-field-physical')).toHaveText(
      'Primary reference, PTP timescale',
    );
    await expect(fieldRow(page, 'grandmaster-clock-accuracy').getByTestId('decode-field-physical')).toHaveText('100 ns');
    await expect(fieldRow(page, 'time-source').getByTestId('decode-field-physical')).toHaveText('GNSS');
    await expect(page.getByTestId('decode-frame-warning')).toContainText(
      tr['protocol.ptp.warning.bmcaNeedsMultipleAnnounce'],
    );
    await expectNoRawTranslationKeys(page);
  });

  test('negatif correctionField negatif kalır', async ({ page }) => {
    await openDecodePanel(page, PTP_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('delay-resp-negative-correction');

    await expect(fieldRow(page, 'correction-field').getByTestId('decode-field-physical')).toContainText('-500');
    await expect(fieldRow(page, 'requesting-port-identity-clock-identity').getByTestId('decode-field-raw')).toHaveText(
      '00:1b:19:ff:fe:00:00:02',
    );
    await expectNoRawTranslationKeys(page);
  });

  test('Signaling örneği TLV16 tipini adlandırır', async ({ page }) => {
    await openDecodePanel(page, PTP_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('signaling-with-tlv');

    await expect(fieldRow(page, 'tlv-0-type').getByTestId('decode-field-physical')).toHaveText(
      'REQUEST_UNICAST_TRANSMISSION',
    );
    await expect(fieldRow(page, 'tlv-0-length').getByTestId('decode-field-raw')).toContainText('6');
    await expectNoRawTranslationKeys(page);
  });

  test('gövdesi eksik Announce truncated-frame basar, sayfa çökmez', async ({ page }) => {
    await openDecodePanel(page, PTP_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('truncated-body');

    const frameError = page.getByTestId('decode-frame-error');
    await expect(frameError).toHaveAttribute('data-error-code', 'truncated-frame');
    await expectNoRawTranslationKeys(page);
  });

  test('İngilizce dilde de çevrilmemiş anahtar basmaz', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('alp-comm-lang', 'en');
    });
    await page.goto(PTP_PATH);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('PTP');
    await page.getByLabel(translations.en['decode.example.label']).selectOption('announce');
    await expect(fieldRow(page, 'time-source').getByTestId('decode-field-physical')).toHaveText('GNSS');
    await expectNoRawTranslationKeys(page);
  });
});
