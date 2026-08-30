import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { translations } from '../src/translations/all';

/**
 * Faz 10 dalga 13h'nin gerçek tarayıcı turu — HART.
 *
 * Kanıtladığı şeyler: kanonik sayfanın (industrial-automation/process-
 * instrumentation/hart) **Hazır** rozetiyle açıldığı (rozet ham `status`tan
 * değil `resolveStatus()`ten okunur — dalga 11 kuralı); checksum'ın GERÇEKTEN
 * XOR olarak doğrulandığı (bozuk checksum çerçeve hatası basar); kısa/uzun
 * adresin ve master tipi bayrağının çözüldüğü; Universal/Common Practice/
 * Device-Specific komut sınıflandırmasının UYDURMADAN gösterildiği; Response
 * Code'un iletişim hatası ile komuta özel durumu ayırdığı; Device Status'un
 * çoklu bayrak gösterdiği; burst çerçevesinin çıkarım uyarısı taşıdığı; ve
 * Data alanının komuta özel olduğu için ham kaldığı.
 *
 * DecodePanel tuzakları (önceki dalgalardan, tekrar düşülmedi):
 * - Alan uyarısı `fieldRow(...)`un İÇİNDE değil kökte AYRI `<tr>`de basılır.
 * - `success:false` → `decode-parse-error` kartı (`decode-frame-error` DEĞİL).
 * - `decode-field-raw` sayıyı `0x… (…)` biçiminde basar.
 */

const tr = translations.tr;

const DECODE_PATH = '/comm/industrial-automation/process-instrumentation/hart?tab=decode';

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

test.describe('HART', () => {
  test('decode sekmesi HAZIR rozetiyle açılır ve konsola hata basmaz', async ({ page }) => {
    const consoleErrors = await openDecodePanel(page, DECODE_PATH);

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('HART');
    await expect(page.getByTestId('decode-panel')).toHaveAttribute('data-plugin-id', 'hart');
    // Rozet ham `status`tan DEĞİL `resolveStatus()`ten gelir (dalga 11 kuralı).
    await expect(page.getByText(tr['status.ready'], { exact: true })).toBeVisible();
    await expect(page.getByText(tr['status.planned'], { exact: true })).toHaveCount(0);
    await expect(page.getByText(tr['status.partial'], { exact: true })).toHaveCount(0);
    await expect(page.getByText(tr['protocol.plannedNotice'])).toHaveCount(0);

    expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
  });

  test('preamble ve start delimiter çözülür, yön/biçim etikette görünür', async ({ page }) => {
    await openDecodePanel(page, DECODE_PATH);
    await selectExample(page, 'short-request-read-unique-identifier');

    await expect(fieldRow(page, 'preamble').getByTestId('decode-field-raw')).toHaveText('0x5 (5)');
    await expect(fieldRow(page, 'start-delimiter').getByTestId('decode-field-physical')).toContainText(
      'Master → Slave',
    );
    await expect(fieldRow(page, 'start-delimiter').getByTestId('decode-field-physical')).toContainText(
      'Short frame',
    );
    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
  });

  test('checksum GERÇEKTEN doğrulanır: doğrulanmış üç vektörden biri Hazır açılır, bozuk checksum çerçeve hatası basar', async ({
    page,
  }) => {
    await openDecodePanel(page, DECODE_PATH);

    // jszumigaj/hart frame_test.go'nun gerçek vektörü: checksum 0x02.
    await selectExample(page, 'short-request-read-unique-identifier');
    await expect(fieldRow(page, 'checksum').getByTestId('decode-field-raw')).toHaveText('0x2 (2)');
    await expect(fieldRow(page, 'checksum').getByTestId('decode-field-physical')).toHaveText('Checksum OK');
    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);

    await selectExample(page, 'checksum-mismatch');
    const frameError = page.getByTestId('decode-frame-error');
    await expect(frameError).toHaveCount(1);
    await expect(frameError).toHaveAttribute('data-error-code', 'checksum-mismatch');
    await expect(fieldRow(page, 'checksum').getByTestId('decode-field-physical')).toContainText('Expected');
  });

  test('kısa adres poll adresini, uzun adres üretici/tip/ID üçlüsünü ayırır', async ({ page }) => {
    await openDecodePanel(page, DECODE_PATH);

    await selectExample(page, 'short-request-read-unique-identifier');
    await expect(fieldRow(page, 'address-master-type').getByTestId('decode-field-physical')).toHaveText(
      'Secondary master',
    );
    await expect(fieldRow(page, 'address').getByTestId('decode-field-raw')).toHaveText('0x0 (0)');
    await expect(fieldRow(page, 'address-manufacturer-id')).toHaveCount(0);

    await selectExample(page, 'long-request-secondary-master');
    await expect(fieldRow(page, 'address-manufacturer-id').getByTestId('decode-field-raw')).toHaveText(
      '0x3C (60)',
    );
    await expect(fieldRow(page, 'address-device-type').getByTestId('decode-field-raw')).toHaveText('0x7B (123)');
    await expect(fieldRow(page, 'address-device-id')).toBeVisible();

    await selectExample(page, 'long-request-primary-master-write-polling-address');
    await expect(fieldRow(page, 'address-master-type').getByTestId('decode-field-physical')).toHaveText(
      'Primary master',
    );
  });

  test('komut sınıflandırması: isimli Universal, isimsiz Device-Specific UYDURULMAZ, ayrılmış aralık işaretlenir', async ({
    page,
  }) => {
    await openDecodePanel(page, DECODE_PATH);

    await selectExample(page, 'short-request-read-unique-identifier');
    await expect(fieldRow(page, 'command-class').getByTestId('decode-field-physical')).toHaveText('Universal');
    await expect(fieldRow(page, 'command').getByTestId('decode-field-physical')).toHaveText(
      'Read Unique Identifier',
    );

    await selectExample(page, 'device-specific-command');
    await expect(fieldRow(page, 'command-class').getByTestId('decode-field-physical')).toHaveText(
      'Device-Specific',
    );
    await expect(fieldRow(page, 'command').getByTestId('decode-field-physical')).toHaveText('0xC8');
    await expect(fieldWarning(page, 'command')).toContainText(
      tr['protocol.hart.warning.commandNotNamed'],
    );

    await selectExample(page, 'reserved-command-range');
    await expect(fieldRow(page, 'command-class').getByTestId('decode-field-physical')).toHaveText(
      'Reserved / undefined range',
    );
    await expect(fieldWarning(page, 'command-class')).toContainText(
      tr['protocol.hart.warning.commandRangeReserved'],
    );
  });

  test('Response Code iletişim hatası bayraklarını ve komuta özel durumu ayırır', async ({ page }) => {
    await openDecodePanel(page, DECODE_PATH);

    await selectExample(page, 'communications-error-response');
    await expect(fieldRow(page, 'response-code').getByTestId('decode-field-physical')).toHaveText(
      'Longitudinal parity error',
    );

    await selectExample(page, 'command-not-implemented-response');
    await expect(fieldRow(page, 'response-code').getByTestId('decode-field-physical')).toHaveText(
      'Command not implemented',
    );
  });

  test('Device Status birden çok bayrağı birlikte gösterir', async ({ page }) => {
    await openDecodePanel(page, DECODE_PATH);
    await selectExample(page, 'device-malfunction-status');

    const status = fieldRow(page, 'device-status').getByTestId('decode-field-physical');
    await expect(status).toContainText('Device malfunction');
    await expect(status).toContainText('Primary variable out of limits');
  });

  test('burst çerçevesi durum baytlarını yanıtla aynı varsayar ve bunu söyler', async ({ page }) => {
    await openDecodePanel(page, DECODE_PATH);
    await selectExample(page, 'burst-frame');

    await expect(fieldRow(page, 'start-delimiter').getByTestId('decode-field-physical')).toContainText('Burst');
    await expect(
      page
        .getByTestId('decode-frame-warning')
        .filter({ hasText: tr['protocol.hart.warning.burstStatusLayoutInferred'] }),
    ).toHaveCount(1);
  });

  test('Data alanı ham kalır ve komuta özel olduğunu söyler', async ({ page }) => {
    await openDecodePanel(page, DECODE_PATH);
    await selectExample(page, 'long-response-loop-current');

    await expect(fieldRow(page, 'data')).toBeVisible();
    await expect(fieldWarning(page, 'data')).toContainText(tr['protocol.hart.warning.dataIsCommandSpecific']);
  });

  test('sınırlayıcı bulunamayınca ve tanınmayınca decode-parse-error kartı basar (decode-frame-error DEĞİL)', async ({
    page,
  }) => {
    await openDecodePanel(page, DECODE_PATH);

    // Girdi baştan sona 0xFF: gerçek bir sınırlayıcıya hiç ulaşılamıyor.
    await page.getByLabel(tr['decode.hexInput.label']).fill('FF FF FF');
    await expect(page.getByTestId('decode-parse-error')).toHaveCount(1);
    await expect(page.getByTestId('decode-parse-error')).toHaveAttribute(
      'data-error-code',
      'truncated-frame',
    );
    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);

    // Preamble sonrası tanınmayan bayt.
    await page.getByLabel(tr['decode.hexInput.label']).fill('FF FF FF FF FF 55 00 00 00');
    await expect(page.getByTestId('decode-parse-error')).toHaveCount(1);
    await expect(page.getByTestId('decode-parse-error')).toHaveAttribute(
      'data-error-code',
      'start-delimiter-not-found',
    );
  });

  test('İngilizce dilde de çevrilmemiş anahtar basmaz', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('alp-comm-lang', 'en');
    });
    await page.goto(DECODE_PATH);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('HART');
    await expect(page.getByText(translations.en['status.ready'], { exact: true })).toBeVisible();

    await page
      .getByLabel(translations.en['decode.example.label'])
      .selectOption('device-malfunction-status');
    await expectNoRawTranslationKeys(page);

    await page.getByLabel(translations.en['decode.example.label']).selectOption('checksum-mismatch');
    await expect(page.getByTestId('decode-frame-error')).toHaveAttribute('data-error-code', 'checksum-mismatch');
    await expectNoRawTranslationKeys(page);

    await page.getByLabel(translations.en['decode.example.label']).selectOption('burst-frame');
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
    const narrow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(narrow, 'sayfa 390px genişlikte yatayda taşıyor').toBeLessThanOrEqual(0);
  });
});
