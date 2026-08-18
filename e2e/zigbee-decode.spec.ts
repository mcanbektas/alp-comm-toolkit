import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { translations } from '../src/translations';

/**
 * Faz 10 dalga 7c'nin gerçek tarayıcı turu — Zigbee.
 *
 * Kanıtladığı şey: brief-faz10-dalga7.md'nin dalga sonu kararı ("FCS bu
 * dalgada GERÇEKTEN doğrulanır — CRC16/KERMIT, anahtarsız", karar 7) ve
 * "NWK/APS security biti setse üst katmana İNME" kuralı ekranda gerçekten
 * görünüyor — MAC→NWK→APS→ZCL zinciri Temperature Measurement örneğinde
 * uçtan uca çözülür, şifreli/dar-kapsam-dışı durumlar ham+uyarılı gösterilir.
 * Bu protokolde alias sayfası YOK (tek kanonik kayıt).
 */

const tr = translations.tr;

const CANONICAL_DECODE_PATH = '/comm/wireless-iot/mesh-smart-home/zigbee?tab=decode';

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

async function selectExample(page: Page, exampleId: string): Promise<void> {
  await page.locator('#decode-example').selectOption(exampleId);
}

test('decode sekmesi Kısmi rozetiyle açılır, konsola hata basmaz', async ({ page }) => {
  const consoleErrors = await openDecodePanel(page);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Zigbee');
  await expect(page.getByTestId('decode-panel')).toHaveAttribute('data-plugin-id', 'zigbee');
  await expect(page.getByText(tr['status.partial'], { exact: true })).toBeVisible();
  await expect(page.getByText(tr['protocol.plannedNotice'])).toHaveCount(0);
  expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
});

test('Temperature Report: MAC→NWK→APS→ZCL zinciri uçtan uca çözülür', async ({ page }) => {
  await openDecodePanel(page);
  await selectExample(page, 'temperature-report');

  await expect(fieldRow(page, 'mac-frame-type').getByTestId('decode-field-physical')).toHaveText('Data');
  await expect(fieldRow(page, 'mac-fcs').getByTestId('decode-field-physical')).toHaveText('PASS');
  await expect(fieldRow(page, 'nwk-frame-type').getByTestId('decode-field-physical')).toHaveText('Data');
  await expect(fieldRow(page, 'aps-cluster-id').getByTestId('decode-field-raw')).toHaveText('0x0402');
  await expect(fieldRow(page, 'zcl-command-id').getByTestId('decode-field-physical')).toHaveText(
    'Report Attributes',
  );
  await expect(fieldRow(page, 'zcl-attr-1').getByTestId('decode-field-physical')).toContainText('2345');
  await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
  await expectNoRawTranslationKeys(page);
});

test('NWK Security etkin: payload şifreli ham gösterilir, APS hiç görünmez', async ({ page }) => {
  await openDecodePanel(page);
  await selectExample(page, 'nwk-encrypted');

  await expect(fieldRow(page, 'nwk-payload')).toBeVisible();
  await expect(fieldWarning(page, 'nwk-payload')).toContainText(tr['protocol.zigbee.warning.nwkEncrypted']);
  await expect(fieldRow(page, 'aps-frame-type')).toHaveCount(0);
  await expectNoRawTranslationKeys(page);
});

test('Cluster-specific komut: gövde ham + uyarı, MAC Command çerçevesi NWK’ya geçmez', async ({ page }) => {
  await openDecodePanel(page);
  await selectExample(page, 'cluster-specific-command');

  await expect(fieldRow(page, 'zcl-frame-type').getByTestId('decode-field-physical')).toHaveText(
    'Cluster-specific',
  );
  await expect(fieldRow(page, 'zcl-payload')).toBeVisible();
  await expect(fieldWarning(page, 'zcl-payload')).toContainText(
    tr['protocol.zigbee.warning.zclClusterSpecificNotDecoded'],
  );

  await selectExample(page, 'mac-command-frame');
  await expect(fieldRow(page, 'nwk-frame-type')).toHaveCount(0);
  await expect(fieldRow(page, 'mac-payload')).toBeVisible();
});

test('bozuk FCS FAIL basar, çerçeve geçersiz kılınır', async ({ page }) => {
  await openDecodePanel(page);
  await selectExample(page, 'fcs-mismatch');

  await expect(fieldRow(page, 'mac-fcs').getByTestId('decode-field-physical')).toHaveText('FAIL');
  await expect(page.getByTestId('decode-frame-error')).toHaveCount(1);
  await expect(page.getByTestId('decode-frame-error')).toHaveAttribute('data-error-code', 'crc-mismatch');
  await expectNoRawTranslationKeys(page);
});

test('eksik MAC adresleme truncated-frame hatası basar', async ({ page }) => {
  await openDecodePanel(page);
  await selectExample(page, 'truncated-mac-addressing');

  await expect(page.getByTestId('decode-frame-error')).toHaveCount(1);
  await expect(page.getByTestId('decode-frame-error')).toHaveAttribute('data-error-code', 'truncated-frame');
  await expectNoRawTranslationKeys(page);
});

test('1440 ve 390 pikselde yatay taşma yok', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openDecodePanel(page);
  await selectExample(page, 'temperature-report');
  await expect(page.getByTestId('decode-field-table')).toBeVisible();
  const wide = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(wide, 'sayfa 1440px genişlikte yatayda taşıyor').toBeLessThanOrEqual(0);

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByTestId('decode-field-table')).toBeVisible();
  const narrow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(narrow, 'sayfa 390px genişlikte yatayda taşıyor').toBeLessThanOrEqual(0);
});
