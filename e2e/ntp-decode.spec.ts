import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { translations } from '../src/translations/all';

/**
 * Faz 10 dalga 12d'nin gerçek tarayıcı turu — NTP.
 *
 * Kanıtladığı şey: 64 bitlik damganın gerçekten tarihe çevrildiği, sıfır
 * damganın "1900" değil "ayarlanmamış" bastığı, Reference ID'nin stratum'a göre
 * üç ayrı okunduğu ve T3−T2 türetilmiş alanının ekranda göründüğü —
 * dns-decode.spec.ts'in deseni.
 */

const tr = translations.tr;

const NTP_PATH = '/comm/network-ethernet/time-management/ntp?tab=decode';

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

test.describe('NTP', () => {
  test('decode sekmesi Hazır rozetiyle açılır ve konsola hata basmaz', async ({ page }) => {
    const consoleErrors = await openDecodePanel(page, NTP_PATH);

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('NTP');
    await expect(page.getByTestId('decode-panel')).toHaveAttribute('data-plugin-id', 'ntp');
    await expect(page.getByText(tr['status.ready'], { exact: true })).toBeVisible();
    await expect(page.getByText(tr['protocol.plannedNotice'])).toHaveCount(0);

    expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
  });

  test('sunucu yanıtı örneği damgayı tarihe çevirir ve T3−T2 türetir', async ({ page }) => {
    await openDecodePanel(page, NTP_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('server-response');

    await expect(fieldRow(page, 'mode').getByTestId('decode-field-physical')).toHaveText('Server');
    await expect(fieldRow(page, 'stratum').getByTestId('decode-field-physical')).toHaveText('Secondary reference');
    await expect(fieldRow(page, 'transmit-timestamp').getByTestId('decode-field-physical')).toContainText('2026-08-22T12:00:00');
    // Tek çerçeveden çıkan tek zaman farkı; δ/θ basılmaz.
    await expect(fieldRow(page, 'server-processing-time')).toBeVisible();
    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
    await expectNoRawTranslationKeys(page);
  });

  test('istemci isteğinde sıfır damga "ayarlanmamış" uyarısı basar', async ({ page }) => {
    await openDecodePanel(page, NTP_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('client-request');

    await expect(fieldWarning(page, 'origin-timestamp')).toHaveText(tr['protocol.ntp.warning.timestampUnset']);
    // Türetilmiş alan istemci isteğinde ÜRETİLMEZ.
    await expect(fieldRow(page, 'server-processing-time')).toHaveCount(0);
    await expectNoRawTranslationKeys(page);
  });

  test('stratum 1 Reference ID ASCII kimlik, stratum 2 adres olarak okunur', async ({ page }) => {
    await openDecodePanel(page, NTP_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('stratum-1-gps');
    await expect(fieldRow(page, 'reference-id').getByTestId('decode-field-physical')).toHaveText('GPS');

    await page.getByLabel(tr['decode.example.label']).selectOption('server-response');
    await expect(fieldRow(page, 'reference-id').getByTestId('decode-field-physical')).toHaveText('192.168.1.1');
    await expectNoRawTranslationKeys(page);
  });

  test('Kiss-o’-Death örneği kiss code’u adlandırır ve alarmı uyarır', async ({ page }) => {
    await openDecodePanel(page, NTP_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('kiss-of-death');

    await expect(fieldRow(page, 'reference-id').getByTestId('decode-field-physical')).toHaveText('RATE');
    await expect(fieldRow(page, 'leap-indicator').getByTestId('decode-field-physical')).toHaveText(
      'Unsynchronized (alarm)',
    );
    await expectNoRawTranslationKeys(page);
  });

  test('kesilmiş örnek truncated-frame basar, sayfa çökmez', async ({ page }) => {
    await openDecodePanel(page, NTP_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('truncated');

    // 48 baytın altı `success: false` döner — çerçeve hatası değil, çözüm hatası
    // kartı basılır (DecodePanel.tsx:647).
    await expect(page.getByTestId('decode-parse-error')).toHaveAttribute('data-error-code', 'truncated-frame');
    await expectNoRawTranslationKeys(page);
  });

  test('İngilizce dilde de çevrilmemiş anahtar basmaz', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('alp-comm-lang', 'en');
    });
    await page.goto(NTP_PATH);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('NTP');
    await page.getByLabel(translations.en['decode.example.label']).selectOption('kiss-of-death');
    await expect(page.getByTestId('decode-field-row').first()).toBeVisible();
    await expectNoRawTranslationKeys(page);
  });
});
