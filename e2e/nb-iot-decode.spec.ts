import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { translations } from '../src/translations';

/**
 * Faz 10 dalga 9d'nin gerçek tarayıcı turu — NB-IoT.
 *
 * Kanıtladığı şey: `nbIotParser`in `lteModemAtParser`i İKİ KATMAN DERİN
 * çağırıp (karar 5: aliasOf DEĞİL, iç çağrı) zenginleştirdiği gerçekten
 * çalışıyor — AcT=9 eşleşmesi, PSM (T3412/T3324, FARKLI GPRS Timer 2/3
 * tabloları) ve eDRX (yalnız NB-S1) DecodePanel'de doğru satırda/uyarıyla
 * görünüyor.
 */

const tr = translations.tr;

const CANONICAL_DECODE_PATH = '/comm/wireless-iot/cellular-iot/nb-iot?tab=decode';

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
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('NB-IoT');
  await expect(page.getByTestId('decode-panel')).toHaveAttribute('data-plugin-id', 'nb-iot');
  await expect(page.getByText(tr['status.ready'], { exact: true })).toBeVisible();
  await expect(page.getByText(tr['protocol.plannedNotice'])).toHaveCount(0);
  expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
});

test('KARAR 5: AcT=9 NB-IoT olarak eşleşir, uyarı taşımaz', async ({ page }) => {
  await openDecodePanel(page);
  await selectExample(page, 'cereg-nb-iot');

  await expect(
    fieldRow(page, 'nb-iot-access-technology-match').getByTestId('decode-field-physical'),
  ).toContainText('NB-IoT');
  await expect(fieldWarning(page, 'nb-iot-access-technology-match')).toHaveCount(0);
  await expectNoRawTranslationKeys(page);
});

test('AcT=7: NB-IoT DEĞİL uyarısı basar (aynı CEREG yanıtı, farklı AcT)', async ({ page }) => {
  await openDecodePanel(page);
  await selectExample(page, 'cereg-not-nb-iot');

  await expect(
    fieldRow(page, 'nb-iot-access-technology-match').getByTestId('decode-field-physical'),
  ).toContainText('AcT=7');
  await expect(fieldWarning(page, 'nb-iot-access-technology-match')).toContainText(
    tr['protocol.nbIot.warning.accessTechnologyNotNbIot'],
  );
  await expectNoRawTranslationKeys(page);
});

test('PSM etkin: T3412 (GPRS Timer 3) ve T3324 (GPRS Timer 2) FARKLI tablolardan doğru saniyeye çevrilir', async ({
  page,
}) => {
  await openDecodePanel(page);
  await selectExample(page, 'cpsms-enabled');

  await expect(fieldRow(page, 'psm-mode').getByTestId('decode-field-physical')).toContainText('enabled');
  await expect(fieldRow(page, 'psm-periodic-tau').getByTestId('decode-field-raw')).toHaveText('00000100');
  await expect(fieldRow(page, 'psm-periodic-tau').getByTestId('decode-field-physical')).toContainText('2400');
  await expect(fieldRow(page, 'psm-active-time').getByTestId('decode-field-raw')).toHaveText('00001111');
  await expect(fieldRow(page, 'psm-active-time').getByTestId('decode-field-physical')).toContainText('30');
  await expectNoRawTranslationKeys(page);
});

test('PSM devre dışı: birim biti 111 olan zamanlayıcılar "deactivated" gösterir, saniye uydurmaz', async ({
  page,
}) => {
  await openDecodePanel(page);
  await selectExample(page, 'cpsms-deactivated');

  await expect(fieldRow(page, 'psm-periodic-tau').getByTestId('decode-field-physical')).toContainText(
    'deactivated',
  );
  await expect(fieldRow(page, 'psm-active-time').getByTestId('decode-field-physical')).toContainText(
    'deactivated',
  );
});

test('eDRX, NB-S1 modu: döngü kodu saniyeye çevrilir', async ({ page }) => {
  await openDecodePanel(page);
  await selectExample(page, 'cedrxs-nb-s1');

  await expect(fieldRow(page, 'edrx-act-type').getByTestId('decode-field-physical')).toContainText('NB-S1');
  await expect(fieldRow(page, 'edrx-requested-cycle').getByTestId('decode-field-physical')).toContainText(
    '40.96',
  );
  await expectNoRawTranslationKeys(page);
});

test('eDRX, WB-S1 modu: tablo doğrulanmadığı için saniyeye çevrilmez, uyarı basar', async ({ page }) => {
  await openDecodePanel(page);
  await selectExample(page, 'cedrxs-wb-s1-unsupported');

  await expect(fieldRow(page, 'edrx-requested-cycle').getByTestId('decode-field-raw')).toHaveText('1001');
  await expect(fieldWarning(page, 'edrx-requested-cycle')).toContainText(
    tr['protocol.nbIot.warning.edrxNotNbS1'],
  );
});

test('CEDRXRDP: istenen/atanan döngü çözülür, Paging Time Window ham kalır', async ({ page }) => {
  await openDecodePanel(page);
  await selectExample(page, 'cedrxrdp-full');

  await expect(fieldRow(page, 'edrx-requested-cycle').getByTestId('decode-field-physical')).toContainText(
    '20.48',
  );
  await expect(fieldRow(page, 'edrx-assigned-cycle').getByTestId('decode-field-physical')).toContainText(
    '5242.88',
  );
  await expect(fieldRow(page, 'edrx-paging-time-window').getByTestId('decode-field-raw')).toHaveText('0101');
  // Fiziksel değer hücresi her satırda RENDER edilir (boşsa yer tutucu basar) —
  // burada "saniyeye çevrilmedi" iddiası sayı İÇERMEMESİYLE kanıtlanır.
  await expect(fieldRow(page, 'edrx-paging-time-window').getByTestId('decode-field-physical')).not.toContainText(
    /\d/,
  );
  await expectNoRawTranslationKeys(page);
});

test('1440 ve 390 pikselde yatay taşma yok', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openDecodePanel(page);
  await selectExample(page, 'cedrxrdp-full');
  await expect(page.getByTestId('decode-field-table')).toBeVisible();
  const wide = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(wide, 'sayfa 1440px genişlikte yatayda taşıyor').toBeLessThanOrEqual(0);

  await page.setViewportSize({ width: 390, height: 844 });
  const narrow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(narrow, 'sayfa 390px genişlikte yatayda taşıyor').toBeLessThanOrEqual(0);
});
