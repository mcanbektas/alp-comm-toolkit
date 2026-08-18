import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { translations } from '../src/translations';

/**
 * Faz 10 dalga 7a'nın gerçek tarayıcı turu — BLE Advertisement.
 *
 * Kanıtladığı şey: brief-faz10-dalga7.md'nin karar 4a'sı (girdi advertising-
 * channel PDU: Header + AdvA + AD zinciri, CRC girdide yok) ekranda gerçekten
 * çözülüyor — dar AD Type kümesi (Flags/Local Name/Manufacturer Specific/…)
 * semantik gösterilir, dar kapsam dışı AD Type ve AD taşımayan PDU tipleri
 * (SCAN_REQ vb.) ham + uyarıyla, off-by-one/taşma koruması hatayla basılır.
 * Bu protokolde alias sayfası YOK (tek kanonik kayıt) — alias-devralma testi
 * gerekmez.
 */

const tr = translations.tr;

const CANONICAL_DECODE_PATH = '/comm/wireless-iot/bluetooth-le/ble-advertisement?tab=decode';

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

test('decode sekmesi açılır, planned bildirimi basmaz, konsola hata basmaz', async ({ page }) => {
  const consoleErrors = await openDecodePanel(page);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('BLE Advertisement');
  await expect(page.getByTestId('decode-panel')).toHaveAttribute('data-plugin-id', 'ble-advertisement');
  await expect(page.getByText(tr['protocol.plannedNotice'])).toHaveCount(0);
  expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
});

test('Flags örneği: PDU Header + AdvA + AD alan alan çözülür', async ({ page }) => {
  await openDecodePanel(page);
  await selectExample(page, 'flags');

  await expect(fieldRow(page, 'pdu-type').getByTestId('decode-field-physical')).toHaveText('ADV_IND');
  await expect(fieldRow(page, 'tx-add').getByTestId('decode-field-physical')).toHaveText('Public');
  // Wire LE `FF EE DD CC BB AA` (EXAMPLE_ADV_A) → ekranda TERS (dosya başı gösterim notu).
  await expect(fieldRow(page, 'adv-a').getByTestId('decode-field-raw')).toHaveText('AA:BB:CC:DD:EE:FF');
  await expect(fieldRow(page, 'ad-1').getByTestId('decode-field-physical')).toContainText(
    'BR/EDR Not Supported',
  );
  await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
  await expectNoRawTranslationKeys(page);
});

test('Manufacturer Specific örneği: Company ID Apple olarak isimlendirilir', async ({ page }) => {
  await openDecodePanel(page);
  await selectExample(page, 'manufacturer-specific');

  await expect(fieldRow(page, 'ad-1').getByTestId('decode-field-physical')).toHaveText('Apple, Inc.');
  await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
});

test('bilinmeyen PDU Type uyarı basar ama çerçeve valid kalır', async ({ page }) => {
  await openDecodePanel(page);
  await selectExample(page, 'unknown-pdu-type');

  await expect(fieldRow(page, 'pdu-type').getByTestId('decode-field-validity')).toHaveText(
    tr['decode.status.invalid'],
  );
  await expect(fieldWarning(page, 'pdu-type')).toContainText(
    tr['protocol.bleAdvertisement.warning.unknownPduType'],
  );
  await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
  await expectNoRawTranslationKeys(page);
});

test('eksik AD Structure truncated-frame hatası basar', async ({ page }) => {
  await openDecodePanel(page);
  await selectExample(page, 'truncated-ad-structure');

  await expect(page.getByTestId('decode-frame-error')).toHaveCount(1);
  await expect(page.getByTestId('decode-frame-error')).toHaveAttribute('data-error-code', 'truncated-frame');
  await expectNoRawTranslationKeys(page);
});

test('AD taşımayan PDU tipinde (SCAN_REQ) payload ham + uyarıyla gösterilir', async ({ page }) => {
  await openDecodePanel(page);
  // SCAN_REQ = PDU Type 0x03, ScanA(6B)+AdvA(6B) — bu dalgada payload şeması çözülmez.
  await page.locator('#decode-hex').fill('03 0C 01 02 03 04 05 06 07 08 09 0A 0B 0C');

  await expect(fieldRow(page, 'pdu-type').getByTestId('decode-field-physical')).toHaveText('SCAN_REQ');
  await expect(fieldRow(page, 'adv-a')).toHaveCount(0);
  await expect(fieldRow(page, 'payload')).toHaveCount(1);
  await expect(fieldWarning(page, 'payload')).toContainText(
    tr['protocol.bleAdvertisement.warning.payloadSchemaNotDecoded'],
  );
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
