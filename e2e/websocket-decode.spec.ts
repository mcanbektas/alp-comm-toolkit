import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { translations } from '../src/translations/all';

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
 * Faz 10 dalga 12f'nin gerçek tarayıcı turu — WebSocket.
 *
 * Kanıtladığı şey: maskeli yükün XOR'la açıldığı, yönün MASK bitinden
 * türetildiği, kontrol çerçevesinin 125 bayt sınırının denetlendiği ve el
 * sıkışma metninin çerçeve sanılmadığı.
 */

const WS_PATH = '/comm/network-ethernet/web-messaging/websocket?tab=decode';

test.describe('WebSocket', () => {
  test('decode sekmesi Hazır rozetiyle açılır ve konsola hata basmaz', async ({ page }) => {
    const consoleErrors = await openDecodePanel(page, WS_PATH);

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('WebSocket');
    await expect(page.getByTestId('decode-panel')).toHaveAttribute('data-plugin-id', 'websocket');
    await expect(page.getByText(tr['status.ready'], { exact: true })).toBeVisible();
    await expect(page.getByText(tr['protocol.plannedNotice'])).toHaveCount(0);

    expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
  });

  test('maskesiz sunucu çerçevesi yönü sunucu→istemci gösterir', async ({ page }) => {
    await openDecodePanel(page, WS_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('server-text');

    await expect(fieldRow(page, 'opcode').getByTestId('decode-field-physical')).toHaveText('Text');
    await expect(fieldRow(page, 'direction').getByTestId('decode-field-physical')).toHaveText('Server → Client');
    await expect(fieldRow(page, 'payload').getByTestId('decode-field-raw')).toHaveText('hello');
    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
    await expectNoRawTranslationKeys(page);
  });

  test('maskeli istemci çerçevesinin yükü XOR’la açılır', async ({ page }) => {
    await openDecodePanel(page, WS_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('client-masked-text');

    await expect(fieldRow(page, 'direction').getByTestId('decode-field-physical')).toHaveText('Client → Server');
    await expect(fieldRow(page, 'masking-key').getByTestId('decode-field-raw')).toHaveText('0x37fa213d');
    await expect(fieldRow(page, 'payload').getByTestId('decode-field-raw')).toHaveText('merhaba');
    await expectNoRawTranslationKeys(page);
  });

  test('Close çerçevesi durum kodu ve gerekçeye ayrılır', async ({ page }) => {
    await openDecodePanel(page, WS_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('close-normal');

    await expect(fieldRow(page, 'close-status').getByTestId('decode-field-physical')).toHaveText('Normal Closure');
    await expect(fieldRow(page, 'close-reason').getByTestId('decode-field-raw')).toHaveText('bye');
    await expectNoRawTranslationKeys(page);
  });

  test('16 bitlik uzunluk uzantısı okunur', async ({ page }) => {
    await openDecodePanel(page, WS_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('extended-length');

    await expect(fieldRow(page, 'extended-payload-length').getByTestId('decode-field-raw')).toContainText('200');
    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
    await expectNoRawTranslationKeys(page);
  });

  test('125 baytı aşan kontrol çerçevesi hata basar', async ({ page }) => {
    await openDecodePanel(page, WS_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('control-frame-too-long');

    await expect(page.getByTestId('decode-frame-error').first()).toHaveAttribute(
      'data-error-code',
      'value-out-of-range',
    );
    await expectNoRawTranslationKeys(page);
  });

  test('el sıkışma metni çerçeve sanılmaz, çözüm hatası kartı basar', async ({ page }) => {
    await openDecodePanel(page, WS_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('handshake-text');

    await expect(page.getByTestId('decode-parse-error')).toHaveAttribute(
      'data-error-code',
      'start-delimiter-not-found',
    );
    await expectNoRawTranslationKeys(page);
  });

  test('İngilizce dilde de çevrilmemiş anahtar basmaz', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('alp-comm-lang', 'en');
    });
    await page.goto(WS_PATH);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('WebSocket');
    await page.getByLabel(translations.en['decode.example.label']).selectOption('ping');
    await expect(fieldRow(page, 'opcode').getByTestId('decode-field-physical')).toHaveText('Ping');
    await expectNoRawTranslationKeys(page);
  });
});
