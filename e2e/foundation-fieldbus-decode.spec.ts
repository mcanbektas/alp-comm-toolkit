import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { translations } from '../src/translations';

/**
 * Faz 10 dalga 13g'nin gerçek tarayıcı turu — FOUNDATION Fieldbus (HSE).
 *
 * Kanıtladığı şeyler: kanonik sayfanın (industrial-automation/classic-fieldbus/
 * foundation-fieldbus) **Kısmi** rozetiyle açıldığı (rozet ham `status`tan
 * değil `resolveStatus()`ten okunur — dalga 11 kuralı); "yerleşim TEK
 * KAYNAKLI" ve "H1 çözülmüyor" uyarılarının HER çözümde göründüğü; 12 baytlık
 * FDA başlığının tam çözüldüğü; trailer'ın mesajın SONUNDAN okunduğu; gövdenin
 * TEK PARÇA ham kaldığı; tabloda olmayan servisin UYDURULMADIĞI.
 *
 * DecodePanel tuzakları (önceki dalgalardan, tekrar düşülmedi):
 * - Alan uyarısı `fieldRow(...)`un İÇİNDE değil kökte AYRI `<tr>`de basılır.
 * - `success:false` → `decode-parse-error` kartı (`decode-frame-error` DEĞİL).
 * - `decode-field-raw` sayıyı `0x… (…)` biçiminde basar.
 */

const tr = translations.tr;

const DECODE_PATH =
  '/comm/industrial-automation/classic-fieldbus/foundation-fieldbus?tab=decode';

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

test.describe('FOUNDATION Fieldbus', () => {
  test('decode sekmesi KISMİ rozetiyle açılır ve konsola hata basmaz', async ({ page }) => {
    const consoleErrors = await openDecodePanel(page, DECODE_PATH);

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('FOUNDATION Fieldbus');
    await expect(page.getByTestId('decode-panel')).toHaveAttribute(
      'data-plugin-id',
      'foundation-fieldbus',
    );
    // Rozet ham `status`tan DEĞİL `resolveStatus()`ten gelir (dalga 11 kuralı).
    await expect(page.getByText(tr['status.partial'], { exact: true })).toBeVisible();
    await expect(page.getByText(tr['status.planned'], { exact: true })).toHaveCount(0);
    await expect(page.getByText(tr['protocol.plannedNotice'])).toHaveCount(0);

    expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
  });

  test('her çözümde "tek kaynaklı yerleşim" ve "H1 çözülmüyor" uyarıları görünür', async ({
    page,
  }) => {
    await openDecodePanel(page, DECODE_PATH);
    await selectExample(page, 'fda-open-session-request');

    await expect(
      page
        .getByTestId('decode-frame-warning')
        .filter({ hasText: tr['protocol.foundationFieldbus.warning.layoutSingleSource'] }),
    ).toHaveCount(1);
    await expect(
      page
        .getByTestId('decode-frame-warning')
        .filter({ hasText: tr['protocol.foundationFieldbus.warning.h1NotDecoded'] }),
    ).toHaveCount(1);
  });

  test('12 baytlık FDA başlığını tam çözer', async ({ page }) => {
    await openDecodePanel(page, DECODE_PATH);
    await selectExample(page, 'fda-open-session-request');

    await expect(fieldRow(page, 'protocol-id').getByTestId('decode-field-physical')).toHaveText(
      'FDA Session Management',
    );
    await expect(fieldRow(page, 'message-type').getByTestId('decode-field-physical')).toHaveText(
      'Request Message',
    );
    await expect(
      fieldRow(page, 'service-confirmed-flag').getByTestId('decode-field-physical'),
    ).toHaveText('Confirmed service');
    await expect(fieldRow(page, 'service-id').getByTestId('decode-field-physical')).toHaveText(
      'FDA Open Session',
    );
    await expect(fieldRow(page, 'fda-address').getByTestId('decode-field-physical')).toHaveText(
      '0x00000001',
    );
    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
  });

  test('trailer mesajın SONUNDAN okunur, gövde TEK PARÇA ham kalır', async ({ page }) => {
    await openDecodePanel(page, DECODE_PATH);
    await selectExample(page, 'sm-identify-response');

    await expect(fieldRow(page, 'body-12')).toHaveCount(1);
    await expect(fieldWarning(page, 'body-12')).toContainText(
      tr['protocol.foundationFieldbus.warning.bodyRaw'],
    );
    await expect(
      fieldRow(page, 'trailer-message-number-20').getByTestId('decode-field-physical'),
    ).toHaveText('7');
    await expect(
      fieldRow(page, 'trailer-invoke-id-24').getByTestId('decode-field-physical'),
    ).toHaveText('1234');
  });

  test('seçenek bayrakları trailer boyunu belirler', async ({ page }) => {
    await openDecodePanel(page, DECODE_PATH);

    await selectExample(page, 'fms-information-report');
    await expect(fieldRow(page, 'trailer-time-stamp-16')).toHaveCount(1);
    await expect(fieldRow(page, 'trailer-message-number-16')).toHaveCount(0);

    await selectExample(page, 'lan-redundancy-diagnostic');
    await expect(
      fieldRow(page, 'trailer-extended-control-16').getByTestId('decode-field-physical'),
    ).toHaveText('0x0000ABCD');
    await expect(fieldRow(page, 'protocol-id').getByTestId('decode-field-physical')).toHaveText(
      'LAN Redundancy',
    );
  });

  test('onaylı/onaysız ayrımı servis adını değiştirir', async ({ page }) => {
    await openDecodePanel(page, DECODE_PATH);

    await selectExample(page, 'fms-read-request');
    await expect(fieldRow(page, 'service-id').getByTestId('decode-field-physical')).toHaveText(
      'FMS Read',
    );

    await selectExample(page, 'sm-device-annunciation');
    await expect(
      fieldRow(page, 'service-confirmed-flag').getByTestId('decode-field-physical'),
    ).toHaveText('Unconfirmed service');
    await expect(fieldRow(page, 'service-id').getByTestId('decode-field-physical')).toHaveText(
      'SM Device Annunciation',
    );
  });

  test('tabloda olmayan servis UYDURULMAZ', async ({ page }) => {
    await openDecodePanel(page, DECODE_PATH);
    await selectExample(page, 'unnamed-service');

    await expect(fieldRow(page, 'service-id').getByTestId('decode-field-physical')).toHaveText(
      '0x7E',
    );
    await expect(fieldWarning(page, 'service-id')).toContainText(
      tr['protocol.foundationFieldbus.warning.serviceNotNamed'],
    );
  });

  test('bildirilen uzunluk tutmazsa çerçeve hatası basılır', async ({ page }) => {
    await openDecodePanel(page, DECODE_PATH);
    await selectExample(page, 'message-length-mismatch');

    const frameError = page.getByTestId('decode-frame-error');
    await expect(frameError).toHaveCount(1);
    await expect(frameError).toHaveAttribute('data-error-code', 'length-mismatch');
    await expect(fieldRow(page, 'message-length').getByTestId('decode-field-physical')).toHaveText(
      '64 B',
    );
  });

  test('çok kısa girdi decode-parse-error kartı basar (decode-frame-error DEĞİL)', async ({
    page,
  }) => {
    await openDecodePanel(page, DECODE_PATH);
    await page.getByLabel(tr['decode.hexInput.label']).fill('01 00 08 83 00 00 00 01');

    await expect(page.getByTestId('decode-parse-error')).toHaveCount(1);
    await expect(page.getByTestId('decode-parse-error')).toHaveAttribute(
      'data-error-code',
      'truncated-frame',
    );
    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
  });

  test('İngilizce dilde de çevrilmemiş anahtar basmaz', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('alp-comm-lang', 'en');
    });
    await page.goto(DECODE_PATH);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('FOUNDATION Fieldbus');
    await expect(page.getByText(translations.en['status.partial'], { exact: true })).toBeVisible();

    await page
      .getByLabel(translations.en['decode.example.label'])
      .selectOption('sm-identify-response');
    await expectNoRawTranslationKeys(page);

    await page
      .getByLabel(translations.en['decode.example.label'])
      .selectOption('message-length-mismatch');
    await expect(page.getByTestId('decode-frame-error')).toHaveAttribute(
      'data-error-code',
      'length-mismatch',
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
