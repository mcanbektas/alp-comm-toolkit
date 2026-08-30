import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { translations } from '../src/translations/all';

/**
 * Faz 10 dalga 11j'nin gerçek tarayıcı turu — USB.
 *
 * Kanıtladığı şeyler: kanonik sayfanın (interfaces-framing/host-network-
 * interfaces/usb) Hazır rozetiyle açıldığı; token örneğinde PID/Address/
 * Endpoint/CRC5 alanlarının doğru göründüğü; SOF'ta adres yerine Frame Number
 * basıldığı; SETUP yükünün Chapter 9 alanlarına açıldığı; tanımlayıcı
 * zincirinde spec özetinin kendi VID/PID'sinin ve iki endpoint'in göründüğü;
 * bozuk CRC16 örneğinde hata bandının çıktığı; `'live'` sekmesinin katalogdan
 * ÇIKARILDIĞI (11c'deki karar).
 */

const tr = translations.tr;

const CANONICAL_DECODE_PATH = '/comm/interfaces-framing/host-network-interfaces/usb?tab=decode';

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

test.describe('USB', () => {
  test('decode sekmesi Hazır rozetiyle açılır ve konsola hata basmaz', async ({ page }) => {
    const consoleErrors = await openDecodePanel(page, CANONICAL_DECODE_PATH);

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('USB');
    await expect(page.getByTestId('decode-panel')).toHaveAttribute('data-plugin-id', 'usb');
    await expect(page.getByText(tr['status.ready'], { exact: true })).toBeVisible();
    await expect(page.getByText(tr['protocol.plannedNotice'])).toHaveCount(0);

    expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
  });

  test('SETUP token örneği PID/Address/Endpoint/CRC5 basar', async ({ page }) => {
    await openDecodePanel(page, CANONICAL_DECODE_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('setup-token');

    await expect(fieldRow(page, 'pid').getByTestId('decode-field-physical')).toHaveText(
      'SETUP · 0b1101 · check OK',
    );
    await expect(fieldRow(page, 'address').getByTestId('decode-field-physical')).toHaveText(
      '0 · default address',
    );
    await expect(fieldRow(page, 'endpoint').getByTestId('decode-field-physical')).toHaveText('EP0');
    await expect(fieldRow(page, 'crc5')).toHaveCount(1);
    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
  });

  test('SOF örneğinde Address değil Frame Number görünür', async ({ page }) => {
    await openDecodePanel(page, CANONICAL_DECODE_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('sof');

    await expect(fieldRow(page, 'frameNumber').getByTestId('decode-field-physical')).toHaveText('100');
    await expect(fieldRow(page, 'address')).toHaveCount(0);
    await expect(fieldRow(page, 'endpoint')).toHaveCount(0);
  });

  test('SETUP yükü Chapter 9 alanlarına açılır', async ({ page }) => {
    await openDecodePanel(page, CANONICAL_DECODE_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('setup-data');

    await expect(fieldRow(page, 'bmRequestType').getByTestId('decode-field-physical')).toHaveText(
      '0x80 · Device-to-host · Standard · Device',
    );
    await expect(fieldRow(page, 'bRequest').getByTestId('decode-field-physical')).toHaveText(
      'GET_DESCRIPTOR (0x06)',
    );
    await expect(fieldRow(page, 'wValue').getByTestId('decode-field-physical')).toHaveText(
      '0x0100 · DEVICE #0',
    );
    await expect(fieldRow(page, 'wLength').getByTestId('decode-field-physical')).toHaveText('18 B');
  });

  test('cihaz tanımlayıcısında spec özetinin VID/PID değerleri görünür', async ({ page }) => {
    await openDecodePanel(page, CANONICAL_DECODE_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('device-descriptor');

    await expect(
      fieldRow(page, 'descriptor0.idVendor').getByTestId('decode-field-physical'),
    ).toHaveText('0x0483');
    await expect(
      fieldRow(page, 'descriptor0.idProduct').getByTestId('decode-field-physical'),
    ).toHaveText('0x5740');
    await expect(fieldRow(page, 'descriptor0.bcdUSB').getByTestId('decode-field-physical')).toHaveText(
      '2.00',
    );
  });

  test('configuration zincirinde iki endpoint ayrı ayrı görünür', async ({ page }) => {
    await openDecodePanel(page, CANONICAL_DECODE_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('configuration-descriptor');

    await expect(
      fieldRow(page, 'descriptor2.bEndpointAddress').getByTestId('decode-field-physical'),
    ).toHaveText('0x81 · EP1 IN');
    await expect(
      fieldRow(page, 'descriptor3.bEndpointAddress').getByTestId('decode-field-physical'),
    ).toHaveText('0x01 · EP1 OUT');
    await expect(
      fieldRow(page, 'descriptor0.bMaxPower').getByTestId('decode-field-physical'),
    ).toHaveText('100 mA');
  });

  test('bozuk CRC16 örneğinde hata bandı çıkar ve ham anahtar basılmaz', async ({ page }) => {
    await openDecodePanel(page, CANONICAL_DECODE_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('bad-crc16');

    const error = page.getByTestId('decode-frame-error');
    await expect(error).toHaveCount(1);
    await expect(error).toContainText(tr['protocol.usb.error.crc16Mismatch']);
    await expect(error).not.toContainText('protocol.usb.error');
  });

  test('ACK handshake tek alanla çözülür', async ({ page }) => {
    await openDecodePanel(page, CANONICAL_DECODE_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('ack');

    await expect(fieldRow(page, 'pid').getByTestId('decode-field-physical')).toHaveText(
      'ACK · 0b0010 · check OK',
    );
    await expect(fieldRow(page, 'crc16')).toHaveCount(0);
  });

  test("katalogda 'live' sekmesi yok (11c kararı)", async ({ page }) => {
    await openDecodePanel(page, CANONICAL_DECODE_PATH);
    await expect(page.getByRole('tab', { name: tr['tab.live'] })).toHaveCount(0);
  });

  test('İngilizce dilde de çevrilmemiş anahtar basmaz', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('alp-comm-lang', 'en');
    });
    await page.goto(CANONICAL_DECODE_PATH);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('USB');
    await page.getByLabel(translations.en['decode.example.label']).selectOption('setup-data');
    await expect(fieldRow(page, 'bRequest').getByTestId('decode-field-physical')).toHaveText(
      'GET_DESCRIPTOR (0x06)',
    );
  });

  test('1440 ve 390 pikselde yatay taşma yok', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openDecodePanel(page, CANONICAL_DECODE_PATH);
    await page.getByLabel(tr['decode.example.label']).selectOption('configuration-descriptor');
    await expect(page.getByTestId('decode-field-table')).toBeVisible();
    const wide = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(wide, 'sayfa 1440px genişlikte yatayda taşıyor').toBeLessThanOrEqual(0);

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByTestId('decode-field-table')).toBeVisible();
    const narrow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(narrow, 'sayfa 390px genişlikte yatayda taşıyor').toBeLessThanOrEqual(0);
  });
});
