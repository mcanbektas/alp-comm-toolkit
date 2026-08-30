import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { translations } from '../src/translations/all';

/**
 * Faz 10 dalga 4c'nin gerçek tarayıcı turu — MQTT.
 *
 * Kanıtladığı şeyler: kanonik sayfanın (network-ethernet/web-messaging/mqtt)
 * Hazır rozetiyle açıldığı; CONNECT'in hem v3.1.1 hem v5 Properties'li mutlu
 * yollarının, PUBLISH QoS1'in, rezerve paket tipi/malformed VBI hata
 * yollarının ve sabit-flags uyarı yolunun ekranda gerçekten çıktığı; VE
 * `wireless-iot/iot-messaging/mqtt` alias sayfasının aynı motoru ve Hazır
 * rozetini kanonik kayıttan devraldığı (j1939-decode.spec.ts'in alias
 * deseninin aynısı, brief-faz10-dalga4.md satır ~125).
 */

const tr = translations.tr;

const CANONICAL_DECODE_PATH = '/comm/network-ethernet/web-messaging/mqtt?tab=decode';
const ALIAS_DECODE_PATH = '/comm/wireless-iot/iot-messaging/mqtt?tab=decode';

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

test.describe('MQTT', () => {
  test('decode sekmesi Hazır rozetiyle açılır ve konsola hata basmaz', async ({ page }) => {
    const consoleErrors = await openDecodePanel(page, CANONICAL_DECODE_PATH);

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('MQTT');
    await expect(page.getByTestId('decode-panel')).toHaveAttribute('data-plugin-id', 'mqtt');
    await expect(page.getByText(tr['status.ready'], { exact: true })).toBeVisible();
    await expect(page.getByText(tr['protocol.plannedNotice'])).toHaveCount(0);

    expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
  });

  test('CONNECT v3.1.1 örneği Protocol Level ve Client Identifier’ı basar', async ({ page }) => {
    await openDecodePanel(page, CANONICAL_DECODE_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('connect-v311');

    await expect(fieldRow(page, 'protocol-level').getByTestId('decode-field-raw')).toHaveText('0x4 (4)');
    await expect(fieldRow(page, 'protocol-level').getByTestId('decode-field-physical')).toHaveText(
      'MQTT 3.1.1',
    );
    await expect(fieldRow(page, 'client-identifier').getByTestId('decode-field-raw')).toContainText(
      'sensor-01',
    );
    await expect(fieldRow(page, 'properties-length')).toHaveCount(0);
    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
    await expectNoRawTranslationKeys(page);
  });

  test('CONNECT v5 örneği Properties’i alan alan basar (Session Expiry / Receive Maximum)', async ({
    page,
  }) => {
    await openDecodePanel(page, CANONICAL_DECODE_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('connect-v5-properties');

    await expect(fieldRow(page, 'protocol-level').getByTestId('decode-field-physical')).toHaveText(
      'MQTT 5.0',
    );
    await expect(fieldRow(page, 'properties-length').getByTestId('decode-field-raw')).toHaveText(
      '0x8 (8)',
    );
    const fieldTable = page.getByTestId('decode-field-table');
    await expect(fieldTable.getByText('Session Expiry Interval')).toBeVisible();
    await expect(fieldTable.getByText('Receive Maximum')).toBeVisible();
    await expect(fieldRow(page, 'client-identifier').getByTestId('decode-field-raw')).toContainText(
      'sensor-02',
    );
    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
    await expectNoRawTranslationKeys(page);
  });

  test('PUBLISH QoS1 örneği Packet Identifier’ı basar, checksum benzeri hata YOK', async ({ page }) => {
    await openDecodePanel(page, CANONICAL_DECODE_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('publish-qos1');

    await expect(fieldRow(page, 'topic-name').getByTestId('decode-field-raw')).toContainText('cmd/set');
    await expect(fieldRow(page, 'packet-identifier').getByTestId('decode-field-raw')).toHaveText(
      '0x1234 (4660)',
    );
    await expect(fieldRow(page, 'payload')).toHaveCount(1);
    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
    await expectNoRawTranslationKeys(page);
  });

  test('rezerve paket tipi örneği value-out-of-range basar ama Body yine gösterilir', async ({ page }) => {
    await openDecodePanel(page, CANONICAL_DECODE_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('reserved-packet-type');

    const frameError = page.getByTestId('decode-frame-error');
    await expect(frameError).toHaveAttribute('data-error-code', 'value-out-of-range');
    await expect(fieldRow(page, 'body')).toHaveCount(1);
    await expectNoRawTranslationKeys(page);
  });

  test('malformed Variable Byte Integer örneği kısmi çözümle hata basar', async ({ page }) => {
    await openDecodePanel(page, CANONICAL_DECODE_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('remaining-length-malformed');

    const frameError = page.getByTestId('decode-frame-error');
    await expect(frameError).toHaveAttribute('data-error-code', 'value-out-of-range');
    await expect(fieldRow(page, 'packet-type').getByTestId('decode-field-physical')).toHaveText('CONNECT');
    await expectNoRawTranslationKeys(page);
  });

  test('SUBSCRIBE sabit-flags ihlali örneği uyarı basar, hata basmaz', async ({ page }) => {
    await openDecodePanel(page, CANONICAL_DECODE_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('subscribe-fixed-flags-violation');

    await expect(page.getByTestId('decode-frame-warning')).toContainText(
      tr['protocol.mqtt.warning.fixedFlagsViolation'],
    );
    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
    await expectNoRawTranslationKeys(page);
  });

  test('İngilizce dilde de çevrilmemiş anahtar basmaz', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('alp-comm-lang', 'en');
    });
    await page.goto(CANONICAL_DECODE_PATH);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('MQTT');
    await page.getByLabel(translations.en['decode.example.label']).selectOption('reserved-packet-type');
    await expect(page.getByTestId('decode-frame-error')).toHaveAttribute(
      'data-error-code',
      'value-out-of-range',
    );
    await expectNoRawTranslationKeys(page);
  });

  test('wireless-iot alias sayfası aynı motoru ve Hazır rozetini devralır', async ({ page }) => {
    const consoleErrors = await openDecodePanel(page, ALIAS_DECODE_PATH);

    // Alias kaydın kendi pluginId'si yok; motor kanonik kayda inilerek bulunur.
    await expect(page.getByTestId('decode-panel')).toHaveAttribute('data-plugin-id', 'mqtt');
    await expect(page.getByText(tr['protocol.plannedNotice'])).toHaveCount(0);
    await expect(page.getByText(tr['status.ready'], { exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: tr['protocol.canonical'] })).toBeVisible();

    await page.getByLabel(tr['decode.example.label']).selectOption('connect-v311');
    await expect(fieldRow(page, 'client-identifier').getByTestId('decode-field-raw')).toContainText(
      'sensor-01',
    );

    expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
  });

  test('1440 ve 390 pikselde yatay taşma yok (v5 Properties tablosu dahil)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openDecodePanel(page, CANONICAL_DECODE_PATH);
    await page.getByLabel(tr['decode.example.label']).selectOption('connect-v5-properties');
    await expect(page.getByTestId('decode-field-table')).toBeVisible();
    const wide = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(wide, 'sayfa 1440px genişlikte yatayda taşıyor').toBeLessThanOrEqual(0);

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByTestId('decode-field-table')).toBeVisible();
    const narrow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(narrow, 'sayfa 390px genişlikte yatayda taşıyor').toBeLessThanOrEqual(0);
  });
});
