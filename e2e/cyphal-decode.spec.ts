import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { translations } from '../src/translations/all';

/**
 * Faz 10 dalga 15b'nin gerçek tarayıcı turu — Cyphal (UAVCAN v1).
 *
 * Kanıtladığı şey: kayıt **Kısmi** rozetiyle açılıyor (kapsam bilinçli olarak
 * Cyphal/CAN classic-only), resmî spec'in KENDİ örnek çerçeveleri alan alan
 * çözülüyor, `specVersion` seçeneği GERÇEKTEN alan yerleşimini değiştiriyor ve
 * CAN FD AÇIKÇA reddediliyor. `dronecan-decode.spec.ts` birebir emsal.
 */

const tr = translations.tr;

const DECODE_PATH = '/comm/aerospace-uav/distributed-uav-networks/cyphal?tab=decode';

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

test('decode sekmesi Kısmi rozetiyle açılır, iki decodeOption basar, konsola hata basmaz', async ({
  page,
}) => {
  const consoleErrors = await openDecodePanel(page);

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Cyphal');
  await expect(page.getByTestId('decode-panel')).toHaveAttribute('data-plugin-id', 'cyphal');
  // Rozet ham `status`tan DEĞİL `resolveStatus()`ten gelir (dalga 11 kuralı).
  await expect(page.getByText(tr['status.partial'], { exact: true })).toBeVisible();
  await expect(page.getByText(tr['status.planned'], { exact: true })).toHaveCount(0);
  await expect(page.getByText(tr['protocol.plannedNotice'])).toHaveCount(0);

  // Kapsam sınırı GÖRÜNÜR: transport tek şıklı, açıklaması UDP/Serial'ı kapsam
  // dışı ilan ediyor.
  await expect(page.locator('#decode-option-transport')).toBeVisible();
  await expect(page.locator('#decode-option-specVersion')).toBeVisible();

  expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
});

test('Heartbeat: spec örneği 0x107D552A subject 7509 / düğüm 42 olarak çözülür, Toggle=1', async ({
  page,
}) => {
  await openDecodePanel(page);

  await expect(fieldRow(page, 'priority').getByTestId('decode-field-raw')).toHaveText('0x4 (4)');
  await expect(fieldRow(page, 'priority').getByTestId('decode-field-physical')).toHaveText('Nominal');
  await expect(fieldRow(page, 'service-not-message').getByTestId('decode-field-physical')).toHaveText(
    'Message',
  );
  await expect(fieldRow(page, 'anonymous').getByTestId('decode-field-physical')).toHaveText('Regular');
  await expect(fieldRow(page, 'subject-id').getByTestId('decode-field-raw')).toHaveText('0x1D55 (7509)');
  await expect(fieldRow(page, 'source-node-id').getByTestId('decode-field-raw')).toHaveText('0x2A (42)');
  await expect(fieldRow(page, 'transfer-kind').getByTestId('decode-field-physical')).toHaveText(
    'Message',
  );

  // Cyphal İMZASI: transferin ilk çerçevesinde Toggle 1 (DroneCAN'de 0).
  await expect(fieldRow(page, 'tail-sot').getByTestId('decode-field-physical')).toHaveText('Set');
  await expect(fieldRow(page, 'tail-eot').getByTestId('decode-field-physical')).toHaveText('Set');
  await expect(fieldRow(page, 'tail-toggle').getByTestId('decode-field-physical')).toHaveText('Set');
  await expect(fieldRow(page, 'tail-transfer-id').getByTestId('decode-field-raw')).toHaveText('0x0 (0)');

  // Tek çerçeveli transferde transfer CRC HİÇ YOKTUR.
  await expect(fieldRow(page, 'transfer-crc')).toHaveCount(0);
  await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
  await expectNoRawTranslationKeys(page);
});

test('servis isteği: spec örneği 0x136B957B service 430 / 123 → 42 olarak çözülür', async ({
  page,
}) => {
  await openDecodePanel(page);

  await page.getByLabel(tr['decode.example.label']).selectOption('service-request');

  await expect(fieldRow(page, 'service-not-message').getByTestId('decode-field-physical')).toHaveText(
    'Service',
  );
  await expect(fieldRow(page, 'request-not-response').getByTestId('decode-field-physical')).toHaveText(
    'Request',
  );
  await expect(fieldRow(page, 'service-id').getByTestId('decode-field-raw')).toHaveText('0x1AE (430)');
  await expect(fieldRow(page, 'destination-node-id').getByTestId('decode-field-raw')).toHaveText(
    '0x2A (42)',
  );
  await expect(fieldRow(page, 'source-node-id').getByTestId('decode-field-raw')).toHaveText('0x7B (123)');
  // Payload yok: yalnız tail byte var.
  await expect(fieldRow(page, 'data')).toHaveCount(0);
  await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
  await expectNoRawTranslationKeys(page);
});

test('transfer CRC SON çerçevededir ve "gösterildi, doğrulanmadı" uyarısıyla görünür', async ({
  page,
}) => {
  await openDecodePanel(page);

  // İlk çerçevede CRC YOK (DroneCAN'in TERSİ).
  await page.getByLabel(tr['decode.example.label']).selectOption('service-response-first');
  await expect(fieldRow(page, 'transfer-crc')).toHaveCount(0);
  await expect(fieldRow(page, 'tail-eot').getByTestId('decode-field-physical')).toHaveText('Not set');

  // Son çerçevede VAR — spec örneğinde CRC iki çerçeveye BÖLÜNMÜŞ.
  await page.getByLabel(tr['decode.example.label']).selectOption('service-response-last');
  const crcRow = fieldRow(page, 'transfer-crc');
  await expect(crcRow).toHaveCount(1);
  await expect(crcRow.getByTestId('decode-field-raw')).toHaveText('0xE7 (231)');

  await expect(
    frameWarning(page, 'protocol.cyphal.warning.transferCrcNeedsFullTransfer'),
  ).toHaveCount(1);
  await expect(
    frameWarning(page, 'protocol.cyphal.warning.transferCrcSplitAcrossFrames'),
  ).toHaveCount(1);
  await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
  await expectNoRawTranslationKeys(page);
});

test('ilk çerçevede Toggle=0 → alan uyarısı DroneCAN’e yönlendirir (ayrı <tr>’den okunur)', async ({
  page,
}) => {
  await openDecodePanel(page);

  await page.getByLabel(tr['decode.example.label']).selectOption('dronecan-toggle-rejected');

  await expect(fieldRow(page, 'tail-toggle').getByTestId('decode-field-physical')).toHaveText(
    'Not set',
  );
  // Alan uyarısı AYRI bir <tr>'de basılır — kökten aranır (Devralınan tuzaklar).
  await expect(
    page.locator('[data-testid="decode-field-warning"][data-field-id="tail-toggle"]'),
  ).toHaveCount(1);
  await expect(frameWarning(page, 'protocol.cyphal.warning.toggleLooksLikeDroneCan')).toHaveCount(1);
  // Uyarı, HATA değil: çerçeve yine tam çözülür.
  await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
  await expectNoRawTranslationKeys(page);
});

test('specVersion GERÇEKTEN yorumu değiştirir: v1.0 reddeder, v1.1 16-bit subject-ID çözer', async ({
  page,
}) => {
  await openDecodePanel(page);

  await page.getByLabel(tr['decode.example.label']).selectOption('v11-experimental-message');

  // Varsayılan v1.0: spec "discard" kuralı hata olarak basılır (`success:false`
  // DEĞİL — `decode-parse-error` değil, `decode-frame-error` kartı).
  const frameError = page.getByTestId('decode-frame-error');
  await expect(frameError).toHaveCount(1);
  await expect(frameError).toHaveAttribute('data-error-code', 'unsupported-encoding');
  await expect(page.getByTestId('decode-parse-error')).toHaveCount(0);

  // v1.1'e geç: AYNI baytlar 16-bit subject-ID olarak çözülür.
  await page.locator('#decode-option-specVersion').selectOption('v1.1');
  await expect(fieldRow(page, 'subject-id').getByTestId('decode-field-raw')).toHaveText('0x2328 (9000)');
  await expect(fieldRow(page, 'version-discriminator').getByTestId('decode-field-physical')).toHaveText(
    'v1.1 · 16-bit Subject-ID',
  );
  // v1.1'de anonymous biti "reserved" olur — alan üretilmez.
  await expect(fieldRow(page, 'anonymous')).toHaveCount(0);
  await expect(frameWarning(page, 'protocol.cyphal.warning.experimentalSpecVersion')).toHaveCount(1);
  await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
  await expectNoRawTranslationKeys(page);
});

test('CAN FD kapsam DIŞI: `decode-parse-error` kartı basılır, alan tablosu üretilmez', async ({
  page,
}) => {
  await openDecodePanel(page);

  await page.getByLabel(tr['decode.example.label']).selectOption('can-fd-rejected');

  // `success:false` → `decode-parse-error` (Devralınan tuzaklar).
  await expect(page.getByTestId('decode-parse-error')).toHaveCount(1);
  await expect(fieldRow(page, 'can-id')).toHaveCount(0);
  await expectNoRawTranslationKeys(page);
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
