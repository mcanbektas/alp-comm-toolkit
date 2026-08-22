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
 * Faz 10 dalga 12g'nin gerçek tarayıcı turu — RTP.
 *
 * Kanıtladığı şey: sabit Payload Type tablosunun (RFC 3551) codec adına
 * eşlendiği, dinamik/atanmamış PT için codec TAHMİN EDİLMEDİĞİ (yalnız
 * uyarı), Header Extension'ın profil+uzunluk+veri olarak okunduğu ve
 * dolgunun son baytı kendisi dâhil sayarak payload'dan ayrıştığı.
 */

const RTP_PATH = '/comm/network-ethernet/real-time-media/rtp?tab=decode';

test.describe('RTP', () => {
  test('decode sekmesi Hazır rozetiyle açılır ve konsola hata basmaz', async ({ page }) => {
    const consoleErrors = await openDecodePanel(page, RTP_PATH);

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('RTP');
    await expect(page.getByTestId('decode-panel')).toHaveAttribute('data-plugin-id', 'rtp');
    await expect(page.getByText(tr['status.ready'], { exact: true })).toBeVisible();
    await expect(page.getByText(tr['protocol.plannedNotice'])).toHaveCount(0);

    expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
  });

  test('bilinen Payload Type codec adına eşlenir', async ({ page }) => {
    await openDecodePanel(page, RTP_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('basic-audio');

    await expect(fieldRow(page, 'payload-type').getByTestId('decode-field-physical')).toHaveText(
      'PCMU (8000 Hz, mono)',
    );
    await expect(fieldRow(page, 'sequence-number').getByTestId('decode-field-raw')).toContainText('4660');
    await expect(fieldRow(page, 'ssrc').getByTestId('decode-field-raw')).toContainText('305419896');
    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
    await expectNoRawTranslationKeys(page);
  });

  test('dinamik Payload Type codec adı UYDURMAZ, yalnız uyarır', async ({ page }) => {
    await openDecodePanel(page, RTP_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('video-marker-csrc');

    await expect(fieldRow(page, 'payload-type').getByTestId('decode-field-physical')).toHaveText('—');
    // Alan uyarısı alanın kendi <tr>'i İÇİNDE değil hemen ardından gelen AYRI
    // bir <tr>'dedir — kökten `data-field-id` ile aranır.
    await expect(
      page.locator('[data-testid="decode-field-warning"][data-field-id="payload-type"]'),
    ).toBeVisible();
    await expect(fieldRow(page, 'marker').getByTestId('decode-field-physical')).toHaveText('Set');
    await expect(fieldRow(page, 'csrc-count').getByTestId('decode-field-raw')).toContainText('2');
    await expectNoRawTranslationKeys(page);
  });

  test('Header Extension profil + uzunluk + veri olarak okunur, dolgu payload’dan ayrışır', async ({ page }) => {
    await openDecodePanel(page, RTP_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('extension-and-padding');

    await expect(fieldRow(page, 'extension-profile').getByTestId('decode-field-raw')).toContainText('48862');
    await expect(fieldRow(page, 'extension-length').getByTestId('decode-field-raw')).toContainText('1');
    await expect(fieldRow(page, 'padding-bytes').getByTestId('decode-field-raw')).toContainText('3');
    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
    await expectNoRawTranslationKeys(page);
  });

  test('kalan alandan büyük dolgu sayısı hata basar', async ({ page }) => {
    await openDecodePanel(page, RTP_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('invalid-padding-count');

    await expect(page.getByTestId('decode-frame-error').first()).toHaveAttribute(
      'data-error-code',
      'value-out-of-range',
    );
    await expectNoRawTranslationKeys(page);
  });

  test('İngilizce dilde de çevrilmemiş anahtar basmaz', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('alp-comm-lang', 'en');
    });
    await page.goto(RTP_PATH);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('RTP');
    await page.getByLabel(translations.en['decode.example.label']).selectOption('basic-audio');
    await expect(fieldRow(page, 'payload-type').getByTestId('decode-field-physical')).toHaveText(
      'PCMU (8000 Hz, mono)',
    );
    await expectNoRawTranslationKeys(page);
  });
});
