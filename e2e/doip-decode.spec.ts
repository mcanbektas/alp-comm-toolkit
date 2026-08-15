import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { translations } from '../src/translations';

/**
 * Faz 10 dalga 2a'nın gerçek tarayıcı turu — DoIP.
 *
 * Kanıtladığı şey: brief-faz10-dalga2a.md'nin dış kaynakla (Wireshark
 * packet-doip.c / python-doipclient / scapy) çapraz doğrulanmış payload tipi
 * tablosu ekranda gerçekten alan alan çözülüyor — Vehicle Announcement'ın
 * VIN/EID/GID'i, Routing Activation'ın Activation Type/Response Code'u,
 * Diagnostic Message'ın UDS gövdesini HAM bırakıp UDS sayfasına yönlendirmesi.
 */

const tr = translations.tr;

const CANONICAL_DECODE_PATH = '/comm/automotive/diagnostics/doip?tab=decode';

/** İlk örnek `vehicle-announcement`: header(8) + VIN(17)+LA(2)+EID(6)+GID(6)+FA(1). */
const VEHICLE_ANNOUNCEMENT_HEX =
  '02 FD 00 04 00 00 00 20 57 56 57 5A 5A 5A 31 4A 5A 58 57 30 30 30 30 30 31 0E 80 00 01 02 03 04 05 AA BB CC DD EE FF 00';

async function openDecodePanel(page: Page): Promise<string[]> {
  const consoleErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => consoleErrors.push(error.message));

  await page.addInitScript(() => {
    window.localStorage.setItem('alp-comm-lang', 'tr');
  });

  await page.goto(CANONICAL_DECODE_PATH);
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

test('decode sekmesi Hazır rozetiyle açılır ve konsola hata basmaz', async ({ page }) => {
  const consoleErrors = await openDecodePanel(page);

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('DoIP');
  await expect(page.getByTestId('decode-panel')).toHaveAttribute('data-plugin-id', 'doip');
  await expect(page.getByText(tr['status.ready'], { exact: true })).toBeVisible();
  await expect(page.getByText(tr['protocol.plannedNotice'])).toHaveCount(0);

  expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
});

test('Vehicle Announcement örneği VIN/Logical Address/EID/GID/Further Action’ı ayrı ayrı basar', async ({
  page,
}) => {
  await openDecodePanel(page);

  await expect(page.locator('#decode-hex')).toHaveValue(VEHICLE_ANNOUNCEMENT_HEX);
  await expect(page.getByTestId('decode-byte-count')).toContainText('40');

  await expect(fieldRow(page, 'vin').getByTestId('decode-field-raw')).toHaveText(
    'WVWZZZ1JZXW000001',
  );
  await expect(fieldRow(page, 'logical-address').getByTestId('decode-field-raw')).toHaveText(
    '0xE80 (3712)',
  );
  await expect(fieldRow(page, 'eid').getByTestId('decode-field-raw')).toHaveText(
    '00:01:02:03:04:05',
  );
  await expect(fieldRow(page, 'gid').getByTestId('decode-field-raw')).toHaveText(
    'AA:BB:CC:DD:EE:FF',
  );
  await expect(fieldRow(page, 'further-action').getByTestId('decode-field-physical')).toHaveText(
    'No Further Action Required',
  );
  await expect(fieldRow(page, 'sync-status')).toHaveCount(0);

  await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
  await expectNoRawTranslationKeys(page);
});

test('Routing Activation örnekleri Activation Type ve Response Code’u adlandırır', async ({
  page,
}) => {
  await openDecodePanel(page);

  await page.getByLabel(tr['decode.example.label']).selectOption('routing-activation-request');
  await expect(fieldRow(page, 'source-address').getByTestId('decode-field-raw')).toHaveText(
    '0xE00 (3584)',
  );
  await expect(fieldRow(page, 'activation-type').getByTestId('decode-field-physical')).toHaveText(
    'Default',
  );
  await expect(fieldRow(page, 'reserved-oem')).toHaveCount(0);

  await page.getByLabel(tr['decode.example.label']).selectOption('routing-activation-response');
  await expect(
    fieldRow(page, 'tester-logical-address').getByTestId('decode-field-raw'),
  ).toHaveText('0xE00 (3584)');
  await expect(
    fieldRow(page, 'entity-logical-address').getByTestId('decode-field-raw'),
  ).toHaveText('0x1001 (4097)');
  await expect(fieldRow(page, 'response-code').getByTestId('decode-field-physical')).toHaveText(
    'Activated',
  );
  await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
  await expectNoRawTranslationKeys(page);
});

test('Diagnostic Message SA/TA’yı çözer, UDS gövdesini ham bırakıp UDS sayfasına yönlendirir', async ({
  page,
}) => {
  await openDecodePanel(page);

  await page.getByLabel(tr['decode.example.label']).selectOption('diagnostic-message');

  await expect(fieldRow(page, 'source-address').getByTestId('decode-field-raw')).toHaveText(
    '0xE00 (3584)',
  );
  await expect(fieldRow(page, 'target-address').getByTestId('decode-field-raw')).toHaveText(
    '0x1001 (4097)',
  );
  await expect(fieldRow(page, 'uds-payload')).toHaveCount(1);
  await expect(page.getByTestId('decode-frame-warning')).toContainText(
    tr['protocol.doip.warning.udsPayloadNeedsUdsPage'],
  );
  await expectNoRawTranslationKeys(page);
});

test('Generic NACK örneği kodu adlandırır', async ({ page }) => {
  await openDecodePanel(page);

  await page.getByLabel(tr['decode.example.label']).selectOption('generic-nack');

  await expect(fieldRow(page, 'nack-code').getByTestId('decode-field-raw')).toHaveText('0x2 (2)');
  await expect(fieldRow(page, 'nack-code').getByTestId('decode-field-physical')).toHaveText(
    'Message Too Large',
  );
});

test('Alive Check Request/Response boş ve tek alanlı payload’ı doğru gösterir', async ({
  page,
}) => {
  await openDecodePanel(page);

  await page.getByLabel(tr['decode.example.label']).selectOption('alive-check-request');
  await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
  await expect(fieldRow(page, 'trailing-data')).toHaveCount(0);

  await page.getByLabel(tr['decode.example.label']).selectOption('alive-check-response');
  await expect(fieldRow(page, 'source-address').getByTestId('decode-field-raw')).toHaveText(
    '0xE00 (3584)',
  );
});

test('eksik Routing Activation Response truncated-frame basar ama önceki alan yine görünür', async ({
  page,
}) => {
  await openDecodePanel(page);

  await page
    .getByLabel(tr['decode.example.label'])
    .selectOption('routing-activation-response-truncated');

  const frameError = page.getByTestId('decode-frame-error');
  await expect(frameError).toHaveCount(1);
  await expect(frameError).toHaveAttribute('data-error-code', 'truncated-frame');
  await expect(fieldRow(page, 'tester-logical-address')).toHaveCount(1);
  await expect(fieldRow(page, 'entity-logical-address')).toHaveCount(0);
  await expectNoRawTranslationKeys(page);
});

test('1440 ve 390 pikselde yatay taşma yok', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openDecodePanel(page);
  await expect(page.getByTestId('decode-field-table')).toBeVisible();
  const wide = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(wide, 'sayfa 1440px genişlikte yatayda taşıyor').toBeLessThanOrEqual(0);

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByTestId('decode-field-table')).toBeVisible();
  const narrow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(narrow, 'sayfa 390px genişlikte yatayda taşıyor').toBeLessThanOrEqual(0);
});
