import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { translations } from '../src/translations';

/**
 * Faz 10 dalga 15h'in gerçek tarayıcı turu — ADS-B 1090ES.
 * Bu, `aerospace-uav` domain'ini kapatan son tarayıcı turudur.
 *
 * Kanıtladığı şeyler: sayfa **Kısmi** rozetiyle açılıyor; **UAT kapsam-dışı**
 * notu hem sayfa metninde hem çerçeve uyarısında görünüyor; **CPR ham
 * basılıyor ve global pozisyon HİÇBİR YERDE yok**; çözülmeyen Type Code'un
 * payload'ı yakıştırılmıyor; bir DF20 Comm-B yanıtı REDDEDİLİYOR.
 *
 * ── Devralınan DecodePanel tuzakları (12d/12e, 14c brifinde listelendi) ─────
 * • Alan uyarısı AYRI bir `<tr>`de basılır — kökten aranır.
 * • Çerçeve uyarısı birden çoksa `.filter({ hasText })` şart.
 * • `success:false` `decode-parse-error` basar, `decode-frame-error` DEĞİL.
 */

const tr = translations.tr;

const ADS_B_DECODE_PATH = '/comm/aerospace-uav/surveillance/ads-b?tab=decode';

async function openDecodePanel(page: Page): Promise<string[]> {
  const consoleErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => consoleErrors.push(error.message));

  await page.addInitScript(() => {
    window.localStorage.setItem('alp-comm-lang', 'tr');
  });

  await page.goto(ADS_B_DECODE_PATH);
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

test.describe('ADS-B', () => {
  test('decode sekmesi KISMİ rozetiyle açılır ve konsola hata basmaz', async ({ page }) => {
    const consoleErrors = await openDecodePanel(page);

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('ADS-B');
    await expect(page.getByTestId('decode-panel')).toHaveAttribute('data-plugin-id', 'ads-b');
    await expect(page.getByText(tr['status.partial'], { exact: true }).first()).toBeVisible();
    await expect(page.getByText(tr['protocol.plannedNotice'])).toHaveCount(0);

    expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
  });

  test('UAT kapsam-dışı notu SAYFA METNİNDE görünür', async ({ page }) => {
    await openDecodePanel(page);
    // Tuzak: /978 MHz UAT/ hem sayfa özetinde hem çerçeve UYARISINDA geçiyor
    // ve strict-mode ihlali veriyor. Özet paragrafı kendi açılışıyla seçilir.
    const summary = page.getByText(/^Automatic Dependent Surveillance/);
    await expect(summary).toBeVisible();
    await expect(summary).toContainText('978 MHz UAT');
    await expect(summary).toContainText('out of scope');
    await expect(summary).toContainText('1090ES only');
    // CPR sınırının gerekçesi de sayfada yazılı.
    await expect(summary).toContainText('even/odd frame pair');
  });

  test('UAT kapsam-dışı uyarısı HER çerçevede basılır', async ({ page }) => {
    await openDecodePanel(page);
    await selectExample(page, 'identification-klm1023');
    await expect(frameWarning(page, tr['protocol.adsb.warning.uatOutOfScope'])).toBeVisible();
  });

  test('TC 4: callsign çözülür, kategori SAYI kalır, CRC PASS devralınır', async ({ page }) => {
    await openDecodePanel(page);
    await selectExample(page, 'identification-klm1023');

    await expect(fieldRow(page, 'adsb-type-code').getByTestId('decode-field-physical')).toContainText(
      'Aircraft identification',
    );
    await expect(fieldRow(page, 'adsb-callsign').getByTestId('decode-field-physical')).toHaveText(
      'KLM1023',
    );
    // Çerçeve alanları `modeS.ts`ten devralınır — kopya YOK.
    await expect(fieldRow(page, 'modes-icao-address').getByTestId('decode-field-physical')).toHaveText(
      '4840D6',
    );
    await expect(fieldRow(page, 'modes-crc-check').getByTestId('decode-field-physical')).toHaveText(
      'CRC PASS',
    );
    // Kategorinin METNİ revizyona bağlı — basılmaz, uyarılır.
    await expect(
      fieldWarning(page, 'adsb-aircraft-category', tr['protocol.adsb.field.categoryRequiresRevision']),
    ).toBeVisible();
  });

  test('CPR HAM basılır ve GLOBAL POZİSYON hiçbir yerde YOK', async ({ page }) => {
    await openDecodePanel(page);
    await selectExample(page, 'airborne-position-even');

    // Ham 17 bit GÖRÜNÜR…
    const latitude = fieldRow(page, 'adsb-cpr-latitude');
    const longitude = fieldRow(page, 'adsb-cpr-longitude');
    await expect(latitude).toContainText('raw 17 bit');
    await expect(latitude.getByTestId('decode-field-raw')).toContainText('93000');
    await expect(longitude.getByTestId('decode-field-raw')).toContainText('51372');

    // …ama fiziksel değer HÜCRESİ BOŞ: bir sayı basmak onu derece sanmaya davet.
    await expect(latitude.getByTestId('decode-field-physical')).toHaveText('—');
    await expect(longitude.getByTestId('decode-field-physical')).toHaveText('—');
    await expect(
      fieldWarning(page, 'adsb-cpr-latitude', tr['protocol.adsb.field.cprRawNotDegrees']),
    ).toBeVisible();
    await expect(
      frameWarning(page, tr['protocol.adsb.warning.cprNotConvertedToGlobalPosition']),
    ).toBeVisible();

    // CPR formatı ve irtifa çözülür — sınır CPR'da, çerçevenin tamamında değil.
    await expect(fieldRow(page, 'adsb-cpr-format').getByTestId('decode-field-physical')).toContainText(
      'Even',
    );
    await expect(fieldRow(page, 'adsb-altitude').getByTestId('decode-field-physical')).toContainText(
      '38000',
    );
    await expect(fieldRow(page, 'adsb-altitude').getByTestId('decode-field-physical')).toContainText(
      'ft',
    );

    // GLOBAL pozisyon üretilmedi: derece işareti taşıyan tek bir alan bile yok.
    await expect(page.locator('[data-testid="decode-field-row"]').filter({ hasText: '°' })).toHaveCount(
      0,
    );
  });

  test('Odd çerçeve seçilince de global pozisyon ÜRETİLMEZ — çift elde olsa bile', async ({
    page,
  }) => {
    await openDecodePanel(page);
    await selectExample(page, 'airborne-position-even');
    await expect(fieldRow(page, 'adsb-cpr-format').getByTestId('decode-field-physical')).toContainText(
      'Even',
    );
    await selectExample(page, 'airborne-position-odd');
    await expect(fieldRow(page, 'adsb-cpr-format').getByTestId('decode-field-physical')).toContainText(
      'Odd',
    );
    await expect(fieldRow(page, 'adsb-cpr-latitude').getByTestId('decode-field-physical')).toHaveText(
      '—',
    );
    await expect(
      frameWarning(page, tr['protocol.adsb.warning.cprNotConvertedToGlobalPosition']),
    ).toBeVisible();
  });

  test('TC 19: yer hızı ve hava hızı alt tipleri FARKLI alan tablosu üretir', async ({ page }) => {
    await openDecodePanel(page);
    await selectExample(page, 'velocity-ground-speed');
    await expect(fieldRow(page, 'adsb-ground-speed').getByTestId('decode-field-physical')).toContainText(
      '159.2',
    );
    await expect(fieldRow(page, 'adsb-track-angle').getByTestId('decode-field-physical')).toContainText(
      '182.88',
    );
    await expect(fieldRow(page, 'adsb-vertical-rate').getByTestId('decode-field-physical')).toContainText(
      '-832',
    );
    await expect(fieldRow(page, 'adsb-heading')).toHaveCount(0);

    await selectExample(page, 'velocity-airspeed');
    await expect(fieldRow(page, 'adsb-heading').getByTestId('decode-field-physical')).toContainText(
      '243.98',
    );
    await expect(fieldRow(page, 'adsb-airspeed-type').getByTestId('decode-field-physical')).toHaveText(
      'TAS',
    );
    // AYNI bitler, BAŞKA anlam: yer hızı alanları artık YOK.
    await expect(fieldRow(page, 'adsb-ground-speed')).toHaveCount(0);
  });

  test('çözülmeyen Type Code TANINIR ama payload YAKIŞTIRILMAZ', async ({ page }) => {
    await openDecodePanel(page);
    await selectExample(page, 'operation-status-not-decoded');

    await expect(fieldRow(page, 'adsb-type-code').getByTestId('decode-field-physical')).toHaveText(
      'Aircraft operation status',
    );
    await expect(
      fieldWarning(page, 'adsb-type-code', tr['protocol.adsb.field.typeCodeNotDecoded']),
    ).toBeVisible();
    await expect(frameWarning(page, tr['protocol.adsb.warning.typeCodeNotDecoded'])).toBeVisible();
    // ME HAM: hiçbir alt alan yok, ama ham ME `modeS.ts`ten geldiği için duruyor.
    await expect(fieldRow(page, 'adsb-callsign')).toHaveCount(0);
    await expect(fieldRow(page, 'adsb-cpr-latitude')).toHaveCount(0);
    await expect(fieldRow(page, 'modes-me')).toBeVisible();
  });

  test('DF20 Comm-B REDDEDİLİR — MB alanı ME gibi görünse de', async ({ page }) => {
    await openDecodePanel(page);
    await selectExample(page, 'not-extended-squitter');

    const card = page.getByTestId('decode-parse-error');
    await expect(card).toBeVisible();
    await expect(page.getByTestId('decode-parse-error-message')).toContainText(
      tr['protocol.adsb.error.notExtendedSquitter'],
    );
    await expect(page.getByTestId('decode-field-row')).toHaveCount(0);
  });

  test('CRC FAIL: ME yine çözülür ama çerçeve geçersiz ve uyarı KOŞULSUZ', async ({ page }) => {
    await openDecodePanel(page);
    await selectExample(page, 'crc-fail');

    await expect(fieldRow(page, 'modes-crc-check').getByTestId('decode-field-physical')).toContainText(
      'CRC FAIL',
    );
    await expect(
      frameWarning(page, tr['protocol.adsb.warning.messageDecodedOnFailedCrc']),
    ).toBeVisible();
    // Kısmi çözüm gösterilir (spec §47)…
    await expect(fieldRow(page, 'adsb-callsign')).toBeVisible();
    // …ama düzeltme adayı ÜRETİLMEZ.
    await expect(page.locator('[data-field-id*="correct"]')).toHaveCount(0);
  });
});
