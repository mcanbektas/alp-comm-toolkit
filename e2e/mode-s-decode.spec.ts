import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { translations } from '../src/translations/all';

/**
 * Faz 10 dalga 15h'in gerçek tarayıcı turu — Mode S.
 *
 * Kanıtladığı şeyler: sayfa **Hazır** rozetiyle açılıyor; DF17'de **CRC PASS**
 * gerçekten GÖRÜNÜYOR; DF4'te *"doğrulanamadı"* uyarısı görünüyor ve CRC
 * PASS/FAIL göstergesi HİÇ BASILMIYOR; DF24'ün iki-bit istisnası alan adında ve
 * uyarıda görünüyor; bozuk bir DF17'de CRC FAIL basılıyor ama düzeltme adayı
 * ÜRETİLMİYOR.
 *
 * ── Devralınan DecodePanel tuzakları (12d/12e, 14c brifinde listelendi) ─────
 * • Alan uyarısı AYRI bir `<tr>`de basılır — `fieldRow(...).getByTestId(...)`
 *   BOŞ döner; kökten `[data-testid="decode-field-warning"][data-field-id=X]`.
 * • Çerçeve uyarısı birden çoksa `getByTestId('decode-frame-warning')`
 *   strict-mode ihlali verir — `.filter({ hasText })` şart.
 * • `success:false` `decode-parse-error` kartı basar, `decode-frame-error` DEĞİL.
 */

const tr = translations.tr;

const MODE_S_DECODE_PATH = '/comm/aerospace-uav/surveillance/mode-s?tab=decode';

async function openDecodePanel(page: Page): Promise<string[]> {
  const consoleErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => consoleErrors.push(error.message));

  await page.addInitScript(() => {
    window.localStorage.setItem('alp-comm-lang', 'tr');
  });

  await page.goto(MODE_S_DECODE_PATH);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByTestId('decode-panel')).toBeVisible();
  return consoleErrors;
}

function fieldRow(page: Page, fieldId: string): Locator {
  return page.locator(`[data-testid="decode-field-row"][data-field-id="${fieldId}"]`);
}

function fieldWarning(page: Page, fieldId: string, text?: string): Locator {
  const all = page.locator(`[data-testid="decode-field-warning"][data-field-id="${fieldId}"]`);
  return text === undefined ? all : all.filter({ hasText: text });
}

function frameWarning(page: Page, text: string): Locator {
  return page.locator('[data-testid="decode-frame-warning"]').filter({ hasText: text });
}

async function selectExample(page: Page, exampleId: string): Promise<void> {
  await page.getByLabel(tr['decode.example.label']).selectOption(exampleId);
}

test.describe('Mode-S', () => {
  test('decode sekmesi Hazır rozetiyle açılır ve konsola hata basmaz', async ({ page }) => {
    const consoleErrors = await openDecodePanel(page);

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Mode-S');
    await expect(page.getByTestId('decode-panel')).toHaveAttribute('data-plugin-id', 'mode-s');
    await expect(page.getByText(tr['status.ready'], { exact: true }).first()).toBeVisible();
    await expect(page.getByText(tr['protocol.plannedNotice'])).toHaveCount(0);

    expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
  });

  test('sayfa metni kapsamı SÖYLÜYOR — konteyner biçimleri ve düzeltme adayları', async ({
    page,
  }) => {
    await openDecodePanel(page);
    const summary = page.getByText(/Beast binary/);
    await expect(summary).toBeVisible();
    await expect(summary).toContainText('dump1090 JSON');
    await expect(summary).toContainText('out of scope');
    // [Karar 15h-1]: motor bu dalgada yazılmadı ve sayfa bunu "ileride" diyor.
    await expect(summary).toContainText('deliberately left for a later release');
  });

  test('DF17: CRC PASS GÖRÜNÜR ve ICAO adresi bit 9:32’den okunur', async ({ page }) => {
    await openDecodePanel(page);
    await selectExample(page, 'df17-identification');

    await expect(fieldRow(page, 'modes-downlink-format').getByTestId('decode-field-physical')).toContainText(
      'DF17',
    );
    const icaoRow = fieldRow(page, 'modes-icao-address');
    await expect(icaoRow).toBeVisible();
    await expect(icaoRow.getByTestId('decode-field-physical')).toHaveText('4840D6');

    // ASIL KANIT: doğrulanan CRC, kullanıcının gördüğü bir hücrede.
    await expect(fieldRow(page, 'modes-crc-check').getByTestId('decode-field-physical')).toHaveText(
      'CRC PASS',
    );
    await expect(fieldRow(page, 'modes-crc-check')).toHaveAttribute('data-valid', 'true');

    // ME alanı HAM kalır ve devrin ADS-B sayfasına olduğu SÖYLENİR.
    await expect(fieldRow(page, 'modes-me').getByTestId('decode-field-physical')).toHaveText(
      '202CC371C32CE0',
    );
    await expect(
      fieldWarning(page, 'modes-me', tr['protocol.modeS.field.messageExtendedSquitterHandoff']),
    ).toBeVisible();

    // AP sınıfının alanları BURADA YOK.
    await expect(fieldRow(page, 'modes-icao-recovered')).toHaveCount(0);
  });

  test('DF4: “doğrulanamadı” uyarısı görünür ve CRC PASS/FAIL alanı HİÇ BASILMAZ', async ({
    page,
  }) => {
    await openDecodePanel(page);
    await selectExample(page, 'df4-surveillance-altitude');

    // Çerçeve uyarısı: son 24 bit AP = CRC ⊕ ICAO, bu yüzden DOĞRULANAMADI.
    await expect(
      frameWarning(page, tr['protocol.modeS.warning.parityIsAddressXorCrc']),
    ).toBeVisible();
    await expect(
      frameWarning(page, tr['protocol.modeS.warning.icaoRecoveredNotVerified']),
    ).toBeVisible();

    // Alan uyarısı ayrı `<tr>`de — kökten aranır (devralınan tuzak).
    await expect(
      fieldWarning(page, 'modes-parity', tr['protocol.modeS.field.parityNotVerifiable']),
    ).toBeVisible();

    const recovered = fieldRow(page, 'modes-icao-recovered');
    await expect(recovered.getByTestId('decode-field-physical')).toHaveText('400940');
    await expect(
      fieldWarning(page, 'modes-icao-recovered', tr['protocol.modeS.field.icaoRecoveredNotVerified']),
    ).toBeVisible();

    // EN ÖNEMLİ NEGATİF KANIT: tek bir "CRC PASS" göstergesi YANLIŞ olurdu.
    await expect(fieldRow(page, 'modes-crc-check')).toHaveCount(0);
    await expect(page.getByText('CRC PASS', { exact: true })).toHaveCount(0);
    await expect(fieldRow(page, 'modes-icao-address')).toHaveCount(0);
  });

  test('DF17 bozulunca CRC FAIL basılır ama DÜZELTME ADAYI üretilmez', async ({ page }) => {
    await openDecodePanel(page);
    await selectExample(page, 'df17-crc-fail');

    await expect(fieldRow(page, 'modes-crc-check').getByTestId('decode-field-physical')).toContainText(
      'CRC FAIL',
    );
    await expect(fieldRow(page, 'modes-crc-check')).toHaveAttribute('data-valid', 'false');
    // `success:true`, `frame.valid:false` → `decode-frame-error` kartı (tuzak).
    await expect(page.getByTestId('decode-frame-error').first()).toBeVisible();
    await expect(page.getByTestId('decode-parse-error')).toHaveCount(0);
    // Düzeltilmiş bayt ÜRETİLMEZ — sahte kesinliğin kapısı kapalı.
    await expect(page.locator('[data-field-id*="correct"]')).toHaveCount(0);
  });

  test('DF24 iki-bit istisnası alan ADINDA ve uyarıda görünür', async ({ page }) => {
    await openDecodePanel(page);
    await selectExample(page, 'df24-comm-d');

    const dfRow = fieldRow(page, 'modes-downlink-format');
    await expect(dfRow).toContainText('bit 1:2');
    await expect(dfRow.getByTestId('decode-field-physical')).toContainText('DF24');
    await expect(
      frameWarning(page, tr['protocol.modeS.warning.downlinkFormat24TwoBitException']),
    ).toBeVisible();
    // DF24'te adres ÇIKARILMAZ ve CRC doğrulanmaz.
    await expect(fieldRow(page, 'modes-icao-recovered')).toHaveCount(0);
    await expect(fieldRow(page, 'modes-crc-check')).toHaveCount(0);
  });

  test('uzunluk ile DF çeliştiğinde çerçeve reddedilmez, uyarılır', async ({ page }) => {
    await openDecodePanel(page);
    await selectExample(page, 'length-mismatch');

    await expect(
      frameWarning(page, tr['protocol.modeS.warning.lengthDoesNotMatchDownlinkFormat']),
    ).toBeVisible();
    await expect(fieldRow(page, 'modes-crc-check')).toHaveCount(0);
    await expect(page.getByTestId('decode-parse-error')).toHaveCount(0);
  });

  test('ara uzunluk `decode-parse-error` kartı basar (frame-error DEĞİL)', async ({ page }) => {
    await openDecodePanel(page);
    await selectExample(page, 'invalid-length');

    const card = page.getByTestId('decode-parse-error');
    await expect(card).toBeVisible();
    await expect(page.getByTestId('decode-parse-error-message')).toContainText(
      tr['protocol.modeS.error.invalidLength'],
    );
    await expect(page.getByTestId('decode-field-row')).toHaveCount(0);
  });
});
