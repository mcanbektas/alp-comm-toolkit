import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { translations } from '../src/translations';

/**
 * Faz 10 dalga 9c'nin gerçek tarayıcı turu — LTE Modem AT.
 *
 * Kanıtladığı şey: `lteModemAtParser`in `atCommandsParser`i İÇERİDEN çağırıp
 * zenginleştirdiği (9b'nin motorunu bileşim yoluyla kullanma kararı) gerçekten
 * çalışıyor — DecodePanel'de HEX ofsetleri (LAC/hücre kimliği hex→ondalık,
 * CCLK'nin çeyrek-saat GOTCHA'sı) doğru hizada. CIMI/CGSN bare yanıtının
 * KASITLI belirsizliği de ekranda görünüyor.
 */

const tr = translations.tr;

const CANONICAL_DECODE_PATH = '/comm/wireless-iot/cellular-iot/lte-modem-at?tab=decode';

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

test('decode sekmesi Hazır rozetiyle açılır, konsola hata basmaz', async ({ page }) => {
  const consoleErrors = await openDecodePanel(page);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('LTE Modem AT');
  await expect(page.getByTestId('decode-panel')).toHaveAttribute('data-plugin-id', 'lte-modem-at');
  await expect(page.getByText(tr['status.ready'], { exact: true })).toBeVisible();
  await expect(page.getByText(tr['protocol.plannedNotice'])).toHaveCount(0);
  expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
});

test('CSQ: RSSI dBm’e çevrilir, BER bilinmiyor uyarısı basar', async ({ page }) => {
  await openDecodePanel(page);
  await selectExample(page, 'csq');

  await expect(fieldRow(page, 'csq-rssi').getByTestId('decode-field-physical')).toContainText('-73');
  await expect(fieldWarning(page, 'csq-ber')).toContainText(tr['protocol.lteModemAt.warning.csqUnknown']);
  await expectNoRawTranslationKeys(page);
});

test('CREG: LAC ve hücre kimliği hex’ten ondalığa DOĞRU ofsette çevrilir', async ({ page }) => {
  await openDecodePanel(page);
  await selectExample(page, 'creg-registered');

  await expect(fieldRow(page, 'lac').getByTestId('decode-field-raw')).toHaveText('1A2D');
  await expect(fieldRow(page, 'lac').getByTestId('decode-field-physical')).toHaveText('6701');
  await expect(fieldRow(page, 'cell-id').getByTestId('decode-field-physical')).toHaveText('107187');
  await expect(fieldRow(page, 'registration-status').getByTestId('decode-field-physical')).toContainText(
    'home network',
  );
  await expectNoRawTranslationKeys(page);
});

test('CEREG: alan adı TAC olur (CREG’in LAC’ından farklı), AcT=9 NB-IoT’ye işaret eder', async ({ page }) => {
  await openDecodePanel(page);
  await selectExample(page, 'cereg-emergency');

  await expect(fieldRow(page, 'tac')).toBeVisible();
  await expect(fieldRow(page, 'lac')).toHaveCount(0);
  await expect(fieldRow(page, 'access-technology').getByTestId('decode-field-physical')).toContainText('NB-S1');
});

test('KARAR: AcT ≥ 8 satıcı çakışma uyarısı basar', async ({ page }) => {
  await openDecodePanel(page);
  await selectExample(page, 'cops-numeric-act-collision');

  await expect(fieldWarning(page, 'access-technology')).toContainText(
    tr['protocol.lteModemAt.warning.accessTechnologyVendorCollision'],
  );
  await expect(fieldRow(page, 'cops-mcc').getByTestId('decode-field-raw')).toHaveText('901');
  await expect(fieldRow(page, 'cops-mnc').getByTestId('decode-field-raw')).toHaveText('70');
});

test('KARAR: CCLK saat dilimi ÇEYREK SAAT biriminde — "+08" iki saat demektir, dört değil', async ({ page }) => {
  await openDecodePanel(page);
  await selectExample(page, 'cclk');

  await expect(fieldRow(page, 'date').getByTestId('decode-field-physical')).toHaveText('2026-08-20');
  await expect(fieldRow(page, 'timezone-offset').getByTestId('decode-field-raw')).toHaveText('+08');
  await expect(fieldRow(page, 'timezone-offset').getByTestId('decode-field-physical')).toContainText('2');
  await expectNoRawTranslationKeys(page);
});

test('KARAR: CGSN prefiksli form KESİN IMEI, çıplak form BELİRSİZ kimlik sayılır', async ({ page }) => {
  await openDecodePanel(page);

  await selectExample(page, 'cgsn-prefixed');
  await expect(fieldRow(page, 'serial-number').getByTestId('decode-field-raw')).toHaveText('490154203237518');
  await expect(fieldWarning(page, 'serial-number')).toContainText(
    tr['protocol.lteModemAt.warning.sensitiveExportValue'],
  );

  await selectExample(page, 'cgsn-bare');
  await expect(fieldRow(page, 'numeric-identifier')).toBeVisible();
  await expect(fieldRow(page, 'serial-number')).toHaveCount(0);
  // Bare form İKİ uyarı taşır (belirsizlik + hassas-veri) — CIMI/CGSN
  // ayrımının kasıtlı olarak yapılmadığının kanıtı, ikisi de aranır.
  const bareWarnings = await fieldWarning(page, 'numeric-identifier').allTextContents();
  expect(bareWarnings.join(' ')).toContain(tr['protocol.lteModemAt.warning.bareIdentifierAmbiguous']);
  expect(bareWarnings.join(' ')).toContain(tr['protocol.lteModemAt.warning.sensitiveExportValue']);
});

test('CGDCONT: boş PDP adresi alan üretmeden atlanır', async ({ page }) => {
  await openDecodePanel(page);
  await selectExample(page, 'cgdcont-full');

  await expect(fieldRow(page, 'pdp-type').getByTestId('decode-field-raw')).toHaveText('IP');
  await expect(fieldRow(page, 'apn').getByTestId('decode-field-raw')).toHaveText('example.apn');
  await expect(fieldRow(page, 'pdp-address')).toHaveCount(0);
});

test('1440 ve 390 pikselde yatay taşma yok', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openDecodePanel(page);
  await selectExample(page, 'creg-registered');
  await expect(page.getByTestId('decode-field-table')).toBeVisible();
  const wide = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(wide, 'sayfa 1440px genişlikte yatayda taşıyor').toBeLessThanOrEqual(0);

  await page.setViewportSize({ width: 390, height: 844 });
  const narrow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(narrow, 'sayfa 390px genişlikte yatayda taşıyor').toBeLessThanOrEqual(0);
});
