import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { translations } from '../src/translations';

/**
 * Faz 10 dalga 15a'nın gerçek tarayıcı turu — DroneCAN.
 *
 * Kanıtladığı şey: `canFrame.ts`in SocketCAN konteynerinden gelen 29-bit CAN
 * ID'nin üç transfer tipine (message broadcast / anonymous message / service)
 * SNM-biti-önce sırasıyla ayrıldığı, tail byte'ın dört alana (SOT/EOT/Toggle/
 * Transfer ID) çözüldüğü ve multi-frame transferde transfer CRC'nin
 * "gösterildi, doğrulanmadı" uyarısıyla göründüğü — `can-decode.spec.ts` ve
 * `canopen-decode.spec.ts` birebir emsal.
 */

const tr = translations.tr;

const DECODE_PATH = '/comm/aerospace-uav/distributed-uav-networks/dronecan?tab=decode';

async function openDecodePanel(page: Page): Promise<string[]> {
  const consoleErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => consoleErrors.push(error.message));

  await page.addInitScript(() => {
    window.localStorage.setItem('alp-comm-lang', 'tr');
  });

  // `/comm/` öneki ZORUNLU: `vite.config.ts` base'i `/comm/` yapıyor.
  await page.goto(DECODE_PATH);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByTestId('decode-panel')).toBeVisible();
  return consoleErrors;
}

function fieldRow(page: Page, fieldId: string): Locator {
  return page.locator(`[data-testid="decode-field-row"][data-field-id="${fieldId}"]`);
}

/** Birden çok çerçeve uyarısı olduğunda strict-mode ihlalini önler (Devralınan tuzaklar). */
function frameWarning(page: Page, key: string): Locator {
  return page.getByTestId('decode-frame-warning').filter({ hasText: tr[key as keyof typeof tr] });
}

/** Hiçbir tanı satırı ham çeviri anahtarı basmamalı (dalga 1'de görülen kusur). */
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

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('DroneCAN (UAVCAN v0)');
  await expect(page.getByTestId('decode-panel')).toHaveAttribute('data-plugin-id', 'dronecan');
  await expect(page.getByText(tr['status.ready'], { exact: true })).toBeVisible();
  await expect(page.getByText(tr['protocol.plannedNotice'])).toHaveCount(0);

  expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
});

test('mesaj yayını örneği Priority/Message Type ID/Source Node ID’i çözer, spec tail byte örneği 0xC5 doğrulanır', async ({
  page,
}) => {
  await openDecodePanel(page);

  await expect(fieldRow(page, 'priority').getByTestId('decode-field-raw')).toHaveText('0x14 (20)');
  await expect(fieldRow(page, 'message-type-id').getByTestId('decode-field-raw')).toHaveText(
    '0x3E8 (1000)',
  );
  await expect(fieldRow(page, 'source-node-id').getByTestId('decode-field-raw')).toHaveText('0x2A (42)');
  await expect(fieldRow(page, 'service-not-message').getByTestId('decode-field-physical')).toHaveText(
    'Message',
  );
  await expect(fieldRow(page, 'transfer-type').getByTestId('decode-field-physical')).toHaveText(
    'Message Broadcast',
  );

  // Spec örneği: 0xC5 = 11000101 → SOT=1, EOT=1, Toggle=0, Transfer ID=5.
  await expect(fieldRow(page, 'tail-sot').getByTestId('decode-field-physical')).toHaveText('Set');
  await expect(fieldRow(page, 'tail-eot').getByTestId('decode-field-physical')).toHaveText('Set');
  await expect(fieldRow(page, 'tail-toggle').getByTestId('decode-field-physical')).toHaveText('Not set');
  await expect(fieldRow(page, 'tail-transfer-id').getByTestId('decode-field-raw')).toHaveText('0x5 (5)');

  // Single-frame'de transfer CRC alanı YOK.
  await expect(fieldRow(page, 'transfer-crc')).toHaveCount(0);
  await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
  await expectNoRawTranslationKeys(page);
});

test('anonim mesaj örneği Source Node ID=0 ve Discriminator’ı gösterir', async ({ page }) => {
  await openDecodePanel(page);

  await page.getByLabel(tr['decode.example.label']).selectOption('anonymous-message-single-frame');

  await expect(fieldRow(page, 'source-node-id').getByTestId('decode-field-raw')).toHaveText('0x0 (0)');
  await expect(fieldRow(page, 'source-node-id').getByTestId('decode-field-physical')).toHaveText(
    'Anonymous',
  );
  await expect(fieldRow(page, 'discriminator').getByTestId('decode-field-raw')).toHaveText(
    '0x1234 (4660)',
  );
  await expect(fieldRow(page, 'transfer-type').getByTestId('decode-field-physical')).toHaveText(
    'Anonymous Message',
  );
  await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
  await expectNoRawTranslationKeys(page);
});

test('servis isteği örneği Service Type ID/Destination Node ID’i ve Request yönünü çözer', async ({
  page,
}) => {
  await openDecodePanel(page);

  await page.getByLabel(tr['decode.example.label']).selectOption('service-request-single-frame');

  await expect(fieldRow(page, 'service-type-id').getByTestId('decode-field-raw')).toHaveText('0x1 (1)');
  await expect(fieldRow(page, 'request-not-response').getByTestId('decode-field-physical')).toHaveText(
    'Request',
  );
  await expect(fieldRow(page, 'destination-node-id').getByTestId('decode-field-raw')).toHaveText(
    '0x2A (42)',
  );
  await expect(fieldRow(page, 'service-not-message').getByTestId('decode-field-physical')).toHaveText(
    'Service',
  );
  await expect(fieldRow(page, 'transfer-type').getByTestId('decode-field-physical')).toHaveText(
    'Service Request',
  );
  await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
  await expectNoRawTranslationKeys(page);
});

test('multi-frame ilk çerçeve: transfer CRC "gösterildi, doğrulanmadı" uyarısıyla görünür', async ({
  page,
}) => {
  await openDecodePanel(page);

  await page.getByLabel(tr['decode.example.label']).selectOption('multi-frame-first');

  await expect(fieldRow(page, 'tail-sot').getByTestId('decode-field-physical')).toHaveText('Set');
  await expect(fieldRow(page, 'tail-eot').getByTestId('decode-field-physical')).toHaveText('Not set');

  const crcRow = fieldRow(page, 'transfer-crc');
  await expect(crcRow).toHaveCount(1);
  await expect(crcRow.getByTestId('decode-field-raw')).toHaveText('0x1234 (4660)');

  // Aynı çerçevede transferCrcNeedsDataTypeSignature VE dsdlRequiredForPayload
  // birlikte basılır — strict-mode ihlalini önlemek için `.filter` kullanılır
  // (Devralınan tuzaklar).
  await expect(
    frameWarning(page, 'protocol.dronecan.warning.transferCrcNeedsDataTypeSignature'),
  ).toHaveCount(1);
  await expect(frameWarning(page, 'protocol.dronecan.warning.dsdlRequiredForPayload')).toHaveCount(1);
  await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
  await expectNoRawTranslationKeys(page);
});

test('multi-frame ara/son çerçevede transfer CRC alanı YOK', async ({ page }) => {
  await openDecodePanel(page);

  await page.getByLabel(tr['decode.example.label']).selectOption('multi-frame-middle');
  await expect(fieldRow(page, 'transfer-crc')).toHaveCount(0);
  await expect(fieldRow(page, 'tail-toggle').getByTestId('decode-field-physical')).toHaveText('Set');

  await page.getByLabel(tr['decode.example.label']).selectOption('multi-frame-last');
  await expect(fieldRow(page, 'transfer-crc')).toHaveCount(0);
  await expect(fieldRow(page, 'tail-eot').getByTestId('decode-field-physical')).toHaveText('Set');
});

test('extended olmayan çerçeve hata basar ama CAN ID/DLC yine gösterilir', async ({ page }) => {
  await openDecodePanel(page);

  await page.getByLabel(tr['decode.example.label']).selectOption('not-extended-rejected');

  await expect(fieldRow(page, 'can-id').getByTestId('decode-field-physical')).toHaveText(
    'Base / 11-bit',
  );
  const frameError = page.getByTestId('decode-frame-error');
  await expect(frameError).toHaveCount(1);
  await expect(frameError).toHaveAttribute('data-error-code', 'value-out-of-range');
  // DroneCAN'e özgü hiçbir alan üretilmez.
  await expect(fieldRow(page, 'priority')).toHaveCount(0);
  await expect(fieldRow(page, 'tail-sot')).toHaveCount(0);
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
