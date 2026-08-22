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

/** Çerçeve uyarısı birden çok olabilir; strict-mode ihlali için süzülür. */

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
 * Faz 10 dalga 12f'nin gerçek tarayıcı turu — MQTT-SN.
 *
 * Kanıtladığı şey: uzunluk alanının MQTT'nin VBI'ı gibi okunmadığı, QoS 0b11'in
 * hata değil −1 olduğu ve kısa topic adının sayı değil metin basıldığı.
 */

const MQTT_SN_PATH = '/comm/network-ethernet/web-messaging/mqtt-sn?tab=decode';

test.describe('MQTT-SN', () => {
  test('decode sekmesi Hazır rozetiyle açılır ve konsola hata basmaz', async ({ page }) => {
    const consoleErrors = await openDecodePanel(page, MQTT_SN_PATH);

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('MQTT-SN');
    await expect(page.getByTestId('decode-panel')).toHaveAttribute('data-plugin-id', 'mqtt-sn');
    await expect(page.getByText(tr['status.ready'], { exact: true })).toBeVisible();
    await expect(page.getByText(tr['protocol.plannedNotice'])).toHaveCount(0);

    expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
  });

  test('PUBLISH topic id ve message id olarak çözülür', async ({ page }) => {
    await openDecodePanel(page, MQTT_SN_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('publish-qos1');

    await expect(fieldRow(page, 'message-type').getByTestId('decode-field-physical')).toHaveText('PUBLISH');
    await expect(fieldRow(page, 'topic-id').getByTestId('decode-field-physical')).toHaveText('0x0012');
    await expect(fieldRow(page, 'message-id').getByTestId('decode-field-raw')).toContainText('42');
    await expect(fieldRow(page, 'qos').getByTestId('decode-field-physical')).toHaveText('1');
    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
    await expectNoRawTranslationKeys(page);
  });

  test('QoS 0b11 hata değil −1 basar', async ({ page }) => {
    await openDecodePanel(page, MQTT_SN_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('publish-qos-minus-one');

    await expect(fieldRow(page, 'qos').getByTestId('decode-field-physical')).toHaveText('-1');
    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
    await expectNoRawTranslationKeys(page);
  });

  test('kısa topic adı sayı değil metin gösterilir', async ({ page }) => {
    await openDecodePanel(page, MQTT_SN_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('publish-short-topic');

    await expect(fieldRow(page, 'topic-id-type').getByTestId('decode-field-physical')).toHaveText('Short topic name');
    await expect(fieldRow(page, 'topic-id').getByTestId('decode-field-raw')).toHaveText('ab');
    await expectNoRawTranslationKeys(page);
  });

  test('REGISTER topic adı eşlemesini gösterir', async ({ page }) => {
    await openDecodePanel(page, MQTT_SN_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('register');

    await expect(fieldRow(page, 'topic-name').getByTestId('decode-field-raw')).toHaveText('room/temperature');
    await expectNoRawTranslationKeys(page);
  });

  test('üç baytlık uzunluk biçimi 268 okunur, VBI gibi 1 değil', async ({ page }) => {
    await openDecodePanel(page, MQTT_SN_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('extended-length');

    await expect(fieldRow(page, 'length').getByTestId('decode-field-raw')).toContainText('268');
    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
    await expectNoRawTranslationKeys(page);
  });

  test('kendi alanından küçük uzunluk çerçeve hatası basar', async ({ page }) => {
    await openDecodePanel(page, MQTT_SN_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('length-too-small');

    await expect(page.getByTestId('decode-frame-error').first()).toHaveAttribute(
      'data-error-code',
      'length-mismatch',
    );
    await expectNoRawTranslationKeys(page);
  });

  test('İngilizce dilde de çevrilmemiş anahtar basmaz', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('alp-comm-lang', 'en');
    });
    await page.goto(MQTT_SN_PATH);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('MQTT-SN');
    await page.getByLabel(translations.en['decode.example.label']).selectOption('advertise');
    await expect(fieldRow(page, 'gateway-id').getByTestId('decode-field-raw')).toContainText('7');
    await expectNoRawTranslationKeys(page);
  });
});
