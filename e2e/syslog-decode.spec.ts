import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { translations } from '../src/translations/all';

/**
 * Faz 10 dalga 12e'nin gerçek tarayıcı turu — Syslog.
 *
 * Kanıtladığı şey: PRI'nin Facility/Severity'ye bölündüğü, kaçırılmış `]`in
 * elemanı bölmediği, NILVALUE'nun "tire" diye basılmadığı ve RFC 3164
 * mesajının 5424 şemasıyla ÇÖZÜLMEDİĞİ — dns-decode.spec.ts'in deseni.
 */

const tr = translations.tr;

const SYSLOG_PATH = '/comm/network-ethernet/time-management/syslog?tab=decode';

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

/** Alan uyarısı AYRI bir `<tr>`de basılır (DecodePanel.tsx:272). */
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

test.describe('Syslog', () => {
  test('decode sekmesi Hazır rozetiyle açılır ve konsola hata basmaz', async ({ page }) => {
    const consoleErrors = await openDecodePanel(page, SYSLOG_PATH);

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Syslog');
    await expect(page.getByTestId('decode-panel')).toHaveAttribute('data-plugin-id', 'syslog');
    await expect(page.getByText(tr['status.ready'], { exact: true })).toBeVisible();
    await expect(page.getByText(tr['protocol.plannedNotice'])).toHaveCount(0);

    expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
  });

  test('PRI 34 Facility 4 / Severity Critical olarak bölünür', async ({ page }) => {
    await openDecodePanel(page, SYSLOG_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('header-only');

    await expect(fieldRow(page, 'facility').getByTestId('decode-field-physical')).toHaveText(
      'security/authorization messages',
    );
    await expect(fieldRow(page, 'severity').getByTestId('decode-field-physical')).toHaveText('Critical');
    await expect(fieldRow(page, 'hostname').getByTestId('decode-field-raw')).toHaveText('device1');
    await expect(fieldRow(page, 'msg').getByTestId('decode-field-raw')).toHaveText('Motor fault');
    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
    await expectNoRawTranslationKeys(page);
  });

  test('structured data SD-ID ve parametrelere ayrılır', async ({ page }) => {
    await openDecodePanel(page, SYSLOG_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('structured-data');

    await expect(fieldRow(page, 'sd-0-id').getByTestId('decode-field-raw')).toHaveText('temperature');
    await expect(fieldRow(page, 'sd-0-param-1').getByTestId('decode-field-raw')).toHaveText('85.2');
    await expect(fieldRow(page, 'msg').getByTestId('decode-field-raw')).toHaveText('Over limit');
    await expectNoRawTranslationKeys(page);
  });

  test('kaçırılmış `]` elemanı bölmez, mesaj bütün kalır', async ({ page }) => {
    await openDecodePanel(page, SYSLOG_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('escaped-bracket');

    await expect(fieldRow(page, 'sd-0-id').getByTestId('decode-field-raw')).toHaveText('ex@32473');
    await expect(fieldRow(page, 'sd-0-param-0').getByTestId('decode-field-raw')).toHaveText('a]b');
    await expect(fieldRow(page, 'sd-0-param-1').getByTestId('decode-field-raw')).toHaveText('say "hi"');
    await expect(fieldRow(page, 'msg').getByTestId('decode-field-raw')).toHaveText('tail');
    await expectNoRawTranslationKeys(page);
  });

  test('NILVALUE alanı tire olarak basılmaz', async ({ page }) => {
    await openDecodePanel(page, SYSLOG_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('nil-values');

    await expect(fieldWarning(page, 'hostname')).toHaveText(tr['protocol.syslog.warning.nilValue']);
    // Ham sütunda `-` GÖRÜNMEMELİ; boş glif basılır.
    await expect(fieldRow(page, 'hostname').getByTestId('decode-field-raw')).not.toHaveText('-');
    await expect(fieldRow(page, 'msg').getByTestId('decode-field-raw')).toHaveText('Emergency, no metadata');
    await expectNoRawTranslationKeys(page);
  });

  test('BOM’lu mesaj UTF-8 olarak çözülür', async ({ page }) => {
    await openDecodePanel(page, SYSLOG_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('utf8-bom');

    await expect(fieldRow(page, 'msg-bom').getByTestId('decode-field-physical')).toHaveText('UTF-8');
    await expect(fieldRow(page, 'msg').getByTestId('decode-field-raw')).toHaveText('Sıcaklık aşıldı');
    await expectNoRawTranslationKeys(page);
  });

  test('RFC 3164 mesajı 5424 şemasıyla çözülmez, uyarıyla bildirilir', async ({ page }) => {
    await openDecodePanel(page, SYSLOG_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('legacy-bsd');

    // Çerçeve uyarısı birden çok: doğrudan eşleşeni süz.
    await expect(
      page.getByTestId('decode-frame-warning').filter({ hasText: tr['protocol.syslog.warning.legacyBsdFormat'] }),
    ).toHaveCount(1);
    // "VERSION=Oct" gibi bir alan üretilmemeli.
    await expect(fieldRow(page, 'version')).toHaveCount(0);
    await expect(fieldRow(page, 'legacy-body')).toBeVisible();
    await expectNoRawTranslationKeys(page);
  });

  test('başta sıfırlı PRI çözüm hatası kartı basar, sayfa çökmez', async ({ page }) => {
    await openDecodePanel(page, SYSLOG_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('leading-zero-pri');

    await expect(page.getByTestId('decode-parse-error')).toHaveAttribute('data-error-code', 'invalid-hex-input');
    await expectNoRawTranslationKeys(page);
  });

  test('İngilizce dilde de çevrilmemiş anahtar basmaz', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('alp-comm-lang', 'en');
    });
    await page.goto(SYSLOG_PATH);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Syslog');
    await page.getByLabel(translations.en['decode.example.label']).selectOption('structured-data');
    await expect(fieldRow(page, 'sd-0-id').getByTestId('decode-field-raw')).toHaveText('temperature');
    await expectNoRawTranslationKeys(page);
  });
});
