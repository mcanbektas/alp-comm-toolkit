import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { translations } from '../src/translations';

/**
 * Faz 10 dalga 13g'nin gerçek tarayıcı turu — PROFIBUS DP.
 *
 * Kanıtladığı şeyler: kanonik sayfanın (industrial-automation/classic-fieldbus/
 * profibus-dp) **Hazır** rozetiyle açıldığı; beş telgraf sınıfının da (SC,
 * SD1, SD2, SD3, SD4) çözüldüğü; çerçeve kontrol baytının istek ve yanıtta
 * FARKLI kırıldığı; adres uzantısındaki DSAP/SSAP'ın adlandırıldığı; FCS'in
 * GERÇEKTEN doğrulandığı; ve uzunluk tekrarı tutmadığında gövdenin ALANLARA
 * BÖLÜNMEDİĞİ.
 *
 * DecodePanel tuzakları (önceki dalgalardan, tekrar düşülmedi):
 * - Alan uyarısı `fieldRow(...)`un İÇİNDE değil kökte AYRI `<tr>`de basılır.
 * - `success:false` → `decode-parse-error` kartı (`decode-frame-error` DEĞİL).
 * - `decode-field-raw` sayıyı `0x… (…)` biçiminde basar.
 */

const tr = translations.tr;

const DECODE_PATH = '/comm/industrial-automation/classic-fieldbus/profibus-dp?tab=decode';

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

/** Alan uyarısı kökten aranır — `fieldRow(...)`un İÇİNDE DEĞİL, ayrı bir `<tr>`de. */
function fieldWarning(page: Page, fieldId: string): Locator {
  return page.locator(`[data-testid="decode-field-warning"][data-field-id="${fieldId}"]`);
}

async function selectExample(page: Page, exampleId: string): Promise<void> {
  await page.getByLabel(tr['decode.example.label']).selectOption(exampleId);
}

async function expectNoRawTranslationKeys(page: Page): Promise<void> {
  for (const testId of ['decode-field-warning', 'decode-frame-warning', 'decode-frame-error']) {
    for (const text of await page.getByTestId(testId).allTextContents()) {
      expect(text.trim(), `${testId} çevrilmemiş anahtar basıyor`).not.toMatch(
        /^[a-z][a-zA-Z0-9]*(\.[a-zA-Z0-9]+)+$/,
      );
    }
  }
}

test.describe('PROFIBUS DP', () => {
  test('decode sekmesi Hazır rozetiyle açılır ve konsola hata basmaz', async ({ page }) => {
    const consoleErrors = await openDecodePanel(page, DECODE_PATH);

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('PROFIBUS DP');
    await expect(page.getByTestId('decode-panel')).toHaveAttribute('data-plugin-id', 'profibus-dp');
    await expect(page.getByText(tr['status.ready'], { exact: true })).toBeVisible();
    await expect(page.getByText(tr['protocol.plannedNotice'])).toHaveCount(0);

    expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
  });

  test('SD1 telgrafını bit bit çözer', async ({ page }) => {
    await openDecodePanel(page, DECODE_PATH);
    await selectExample(page, 'sd1-fdl-status-request');

    await expect(
      fieldRow(page, 'start-delimiter-0').getByTestId('decode-field-physical'),
    ).toHaveText('SD1 — no data unit');
    await expect(
      fieldRow(page, 'destination-address').getByTestId('decode-field-raw'),
    ).toHaveText('0x22 (34)');
    await expect(fieldRow(page, 'fc-function-3').getByTestId('decode-field-physical')).toHaveText(
      'Request FDL status',
    );
    await expect(fieldRow(page, 'fcs-4').getByTestId('decode-field-physical')).toHaveText(
      'Checksum OK',
    );
    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
  });

  test('çerçeve kontrol baytı istekte ve yanıtta FARKLI kırılır', async ({ page }) => {
    await openDecodePanel(page, DECODE_PATH);

    await selectExample(page, 'sd1-fdl-status-request');
    await expect(fieldRow(page, 'fc-fcb-3')).toHaveCount(1);
    await expect(fieldRow(page, 'fc-station-type-3')).toHaveCount(0);

    await selectExample(page, 'sd1-fdl-status-response');
    await expect(fieldRow(page, 'fc-fcb-3')).toHaveCount(0);
    await expect(
      fieldRow(page, 'fc-station-type-3').getByTestId('decode-field-physical'),
    ).toHaveText('Master, ready to enter token ring');
    await expect(fieldRow(page, 'fc-function-3').getByTestId('decode-field-physical')).toHaveText(
      'OK (positive acknowledgement)',
    );
  });

  test('adres uzantısındaki DSAP ve SSAP adlandırılır', async ({ page }) => {
    await openDecodePanel(page, DECODE_PATH);
    await selectExample(page, 'sd2-set-parameters');

    await expect(
      fieldRow(page, 'destination-address-extension-flag').getByTestId('decode-field-physical'),
    ).toHaveText('DAE/SAE present in data unit');
    await expect(fieldRow(page, 'DAE-7').getByTestId('decode-field-physical')).toHaveText(
      'Set Parameters',
    );
    await expect(fieldRow(page, 'SAE-8').getByTestId('decode-field-physical')).toHaveText(
      'Check Configuration (slave) / DP master MS0',
    );
    await expect(fieldWarning(page, 'data-unit-9')).toContainText(
      tr['protocol.profibusDp.warning.userDataNeedsGsd'],
    );
  });

  test('beş telgraf sınıfı da çözülür', async ({ page }) => {
    await openDecodePanel(page, DECODE_PATH);

    await selectExample(page, 'short-acknowledgement');
    await expect(
      fieldRow(page, 'start-delimiter-0').getByTestId('decode-field-physical'),
    ).toHaveText('SC — short acknowledgement');

    await selectExample(page, 'sd4-token');
    await expect(
      fieldRow(page, 'start-delimiter-0').getByTestId('decode-field-physical'),
    ).toHaveText('SD4 — token telegram');
    await expect(fieldRow(page, 'frame-control-3')).toHaveCount(0);

    await selectExample(page, 'sd3-fixed-data');
    await expect(fieldRow(page, 'length')).toHaveCount(0);
    await expect(fieldRow(page, 'data-unit-4')).toHaveCount(1);

    await selectExample(page, 'sd2-data-exchange');
    await expect(fieldRow(page, 'length').getByTestId('decode-field-raw')).toHaveText('0x7 (7)');
    await expect(fieldRow(page, 'length-repeat').getByTestId('decode-field-physical')).toHaveText(
      'Matches LE',
    );
  });

  test('FCS GERÇEKTEN doğrulanır: bir artırılan sağlama çerçeve hatası basar', async ({ page }) => {
    await openDecodePanel(page, DECODE_PATH);
    await selectExample(page, 'checksum-mismatch');

    const frameError = page.getByTestId('decode-frame-error');
    await expect(frameError).toHaveCount(1);
    await expect(frameError).toHaveAttribute('data-error-code', 'checksum-mismatch');
    await expect(fieldRow(page, 'fcs-11').getByTestId('decode-field-physical')).toContainText(
      'Expected',
    );
  });

  test('uzunluk tekrarı tutmazsa gövde ALANLARA BÖLÜNMEZ', async ({ page }) => {
    await openDecodePanel(page, DECODE_PATH);
    await selectExample(page, 'length-repeat-mismatch');

    await expect(
      page.getByTestId('decode-frame-error').filter({ hasText: 'LEr' }).first(),
    ).toBeVisible();
    await expect(fieldRow(page, 'destination-address')).toHaveCount(0);
    await expect(fieldRow(page, 'unparsed-4')).toHaveCount(1);
  });

  test('yayın adresi ve Global Control ayrı ayrı görünür', async ({ page }) => {
    await openDecodePanel(page, DECODE_PATH);
    await selectExample(page, 'sd2-global-control');

    await expect(
      fieldRow(page, 'destination-address').getByTestId('decode-field-physical'),
    ).toHaveText('127 (broadcast)');
    await expect(fieldRow(page, 'DAE-7').getByTestId('decode-field-physical')).toHaveText(
      'Global Control',
    );
  });

  test('tanınmayan sınırlayıcı decode-parse-error kartı basar (decode-frame-error DEĞİL)', async ({
    page,
  }) => {
    await openDecodePanel(page, DECODE_PATH);
    await page.getByLabel(tr['decode.hexInput.label']).fill('55 22 02 49 6D 16');

    await expect(page.getByTestId('decode-parse-error')).toHaveCount(1);
    await expect(page.getByTestId('decode-parse-error')).toHaveAttribute(
      'data-error-code',
      'start-delimiter-not-found',
    );
    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
  });

  test('İngilizce dilde de çevrilmemiş anahtar basmaz', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('alp-comm-lang', 'en');
    });
    await page.goto(DECODE_PATH);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('PROFIBUS DP');
    await expect(page.getByText(translations.en['status.ready'], { exact: true })).toBeVisible();

    await page
      .getByLabel(translations.en['decode.example.label'])
      .selectOption('sd2-set-parameters');
    await expectNoRawTranslationKeys(page);

    await page.getByLabel(translations.en['decode.example.label']).selectOption('checksum-mismatch');
    await expect(page.getByTestId('decode-frame-error')).toHaveAttribute(
      'data-error-code',
      'checksum-mismatch',
    );
    await expectNoRawTranslationKeys(page);
  });

  test('1440 ve 390 pikselde yatay taşma yok', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openDecodePanel(page, DECODE_PATH);
    await expect(page.getByTestId('decode-field-table')).toBeVisible();
    const wide = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(wide, 'sayfa 1440px genişlikte yatayda taşıyor').toBeLessThanOrEqual(0);

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByTestId('decode-field-table')).toBeVisible();
    const narrow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(narrow, 'sayfa 390px genişlikte yatayda taşıyor').toBeLessThanOrEqual(0);
  });
});
