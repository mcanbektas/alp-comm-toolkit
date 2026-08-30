import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { translations } from '../src/translations/all';

/**
 * Faz 10 dalga 18e'nin gerçek tarayıcı turu — RF Telemetry Custom Frame.
 * **Deponun SON kanonik kaydı; bu tur katalog borcunun kapandığı turdur.**
 *
 * Motor seviyesi dört dosyada doğrulandı (`lfsrWhitening.test.ts`,
 * `manchester.test.ts`, `rfTelemetry.test.ts`,
 * `rfTelemetryCanParseRegistry.test.ts`); bu dosya motoru değil motor↔ekran
 * bağlantısını sınar (desen `thread-decode.spec.ts`, 18d).
 *
 * Kaydın DOĞASI gereği burada sınanan şey ötekilerden farklı: bu bir protokol
 * değil bir PROFİL ÇALIŞTIRICISIDIR, yani asıl kanıt *"aynı baytlar, farklı
 * bildirim, farklı çözüm"*ün ekranda GERÇEKTEN olması. Dört örnek bunu dört
 * ayrı kanalla gösteriyor: dewhitening, Manchester, CRC algoritması ve
 * `Length` yorumu.
 */

const tr = translations.tr;
const DECODE_PATH = '/comm/wireless-iot/custom-rf/rf-telemetry-custom-frame?tab=decode';
const DEFINITIONS_PATH = '/comm/wireless-iot/custom-rf/rf-telemetry-custom-frame?tab=definitions';

/** Çeviri anahtarı GİBİ görünen metin ekrana sızmamalı (18d deseni). */
const RAW_TRANSLATION_KEY_PATTERN = /^[a-z][a-zA-Z0-9]*(\.[a-zA-Z][a-zA-Z0-9]*)+$/;

async function openPage(page: Page, path: string): Promise<string[]> {
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
  return consoleErrors;
}

async function openDecodePanel(page: Page): Promise<string[]> {
  const consoleErrors = await openPage(page, DECODE_PATH);
  await expect(page.getByTestId('decode-panel')).toBeVisible();
  return consoleErrors;
}

function fieldRow(page: Page, fieldId: string): Locator {
  return page.locator(`[data-testid="decode-field-row"][data-field-id="${fieldId}"]`);
}

async function selectExample(page: Page, exampleId: string): Promise<void> {
  await page.locator('#decode-example').selectOption(exampleId);
}

async function selectOption(page: Page, optionId: string, value: string): Promise<void> {
  await page.locator(`#decode-option-${optionId}`).selectOption(value);
}

test('decode sekmesi Kısmi rozetiyle açılır, konsola hata basmaz', async ({ page }) => {
  const consoleErrors = await openDecodePanel(page);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('RF Telemetry Custom Frame');
  await expect(page.getByTestId('decode-panel')).toHaveAttribute(
    'data-plugin-id',
    'rf-telemetry-custom-frame',
  );
  await expect(page.getByText(tr['status.partial'], { exact: true })).toBeVisible();
  await expect(page.getByText(tr['protocol.plannedNotice'])).toHaveCount(0);
  expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
});

test('örnek 1 — varsayılan profil: yedi alan, CRC PASS', async ({ page }) => {
  await openDecodePanel(page);
  await selectExample(page, 'default-profile');

  await expect(page.getByTestId('decode-field-row')).toHaveCount(7);
  await expect(fieldRow(page, 'deviceId').getByTestId('decode-field-raw')).toContainText('1');
  await expect(fieldRow(page, 'packetType').getByTestId('decode-field-raw')).toContainText('20');
  await expect(fieldRow(page, 'length').getByTestId('decode-field-raw')).toContainText('4');
  await expect(fieldRow(page, 'crc')).toHaveAttribute('data-valid', 'true');
  await expect(fieldRow(page, 'crc').getByTestId('decode-field-validity')).toHaveText(
    tr['decode.status.valid'],
  );
  // Ofsetler BAYT: önbelleme 0'dan, CRC 12'den başlar.
  await expect(fieldRow(page, 'preamble')).toContainText('0');
  await expect(fieldRow(page, 'crc')).toContainText('12');
});

test('örnek 2 — dewhitening kanalı: aynı baytlar, çözülemezken ÇÖZÜLÜR hâle gelir', async ({
  page,
}) => {
  await openDecodePanel(page);
  await selectExample(page, 'whitened');

  // Beyazlatma KAPALI: Length baytı 0x19 okunuyor ve çerçeveyi aşıyor.
  await expect(page.getByTestId('decode-parse-error')).toBeVisible();

  await selectOption(page, 'whitening', 'pn9');
  await expect(page.getByTestId('decode-parse-error')).toHaveCount(0);
  await expect(fieldRow(page, 'length').getByTestId('decode-field-raw')).toContainText('4');
  await expect(fieldRow(page, 'crc')).toHaveAttribute('data-valid', 'true');

  // Tohum da GERÇEK bir kanal: yanlış tohumda aynı tel yine çözülemez —
  // başka bir dizi çıkar, Length baytı yine anlamsızlaşır ve çözüm durur.
  await page.locator('#decode-option-whiteningSeed').fill('255');
  await expect(page.getByTestId('decode-parse-error')).toBeVisible();
  await expect(fieldRow(page, 'crc')).toHaveCount(0);
});

test('örnek 3 — Manchester: polarite seçilince çözülür, ofsetler TELE göre iki katına çıkar', async ({
  page,
}) => {
  await openDecodePanel(page);
  await selectExample(page, 'manchester');

  // Polarite yokken ham tel anlamsız: çözüm durur.
  await expect(page.getByTestId('decode-parse-error')).toBeVisible();

  await selectOption(page, 'manchesterPolarity', 'ieee802.3');
  await expect(page.getByTestId('decode-parse-error')).toHaveCount(0);
  await expect(fieldRow(page, 'crc')).toHaveAttribute('data-valid', 'true');
  // Her veri baytı iki tel baytıdır: önbelleme 6, CRC 4 bayt görünür ve CRC
  // 24'ten başlar. Bayt görüntüleyicideki vurgu bu sayılara dayanıyor.
  await expect(fieldRow(page, 'preamble')).toContainText('6');
  await expect(fieldRow(page, 'crc')).toContainText('24');

  // TERS polarite hat kodlaması düzeyinde hata VERMEZ; sonuç ancak
  // terslenmiş Length baytı çerçeveyi aşınca bozulur.
  await selectOption(page, 'manchesterPolarity', 'thomas');
  await expect(page.getByTestId('decode-parse-error')).toBeVisible();
});

test('örnek 7 — aynı gövde, farklı CRC algoritması: iki kanal birlikte PASS yapar', async ({
  page,
}) => {
  await openDecodePanel(page);
  await selectExample(page, 'modbus-crc');

  await expect(fieldRow(page, 'crc')).toHaveAttribute('data-valid', 'false');

  // Doğru algoritma, YANLIŞ bayt sırası: hâlâ FAIL.
  await selectOption(page, 'crcAlgorithm', 'CRC16_MODBUS');
  await expect(fieldRow(page, 'crc')).toHaveAttribute('data-valid', 'false');

  await selectOption(page, 'crcByteOrder', 'little');
  await expect(fieldRow(page, 'crc')).toHaveAttribute('data-valid', 'true');
});

test('örnek 8 — `Length` yorumu: AYNI baytlar iki farklı çerçeve', async ({ page }) => {
  await openDecodePanel(page);
  await selectExample(page, 'length-includes-crc');

  await expect(page.getByTestId('decode-parse-error')).toBeVisible();

  await selectOption(page, 'lengthFieldSemantics', 'includes-crc');
  await expect(page.getByTestId('decode-parse-error')).toHaveCount(0);
  await expect(fieldRow(page, 'crc')).toHaveAttribute('data-valid', 'true');
});

test('kayıt ON kanal bildirir ve hiçbiri ham çeviri anahtarı basmaz', async ({ page }) => {
  await openDecodePanel(page);
  await expect(page.getByTestId('decode-options').locator('select, input')).toHaveCount(10);

  await selectExample(page, 'crc-mismatch');
  const testIds = [
    'decode-field-physical',
    'decode-field-raw',
    'decode-frame-warning',
    'decode-field-warning',
    'decode-frame-error',
  ];
  for (const testId of testIds) {
    for (const text of await page.getByTestId(testId).allTextContents()) {
      const trimmed = text.trim();
      expect(
        RAW_TRANSLATION_KEY_PATTERN.test(trimmed),
        `ham çeviri anahtarı sızmış olabilir (${testId}): "${trimmed}"`,
      ).toBe(false);
    }
  }
});

test('`definitions` sekmesi ŞEMA PANELİNİ açar — `custom-schema` motoru bağlandı', async ({
  page,
}) => {
  const consoleErrors = await openPage(page, DEFINITIONS_PATH);

  // `[KARAR 18-7]` bu kaydı "panel yok" diye işaretlemişti; panel yazıldığı gün
  // beklenti de döndü. Şema paneli BİÇİME bağlıdır, protokole değil: bu kayıt
  // `custom-schema` bildirdiği için aynı panel burada da açılır.
  await expect(page.getByTestId('schema-panel')).toBeVisible();
  await expect(page.getByText(tr['protocol.plannedNotice'])).toHaveCount(0);
  // Sayfanın KENDİ rozeti yine "Kısmi"dir: tanım paneli kaydın çözümleme
  // olgunluğunu değiştirmez.
  await expect(page.getByText(tr['status.partial'], { exact: true })).toBeVisible();
  expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
});

test('1440 ve 390 pikselde yatay taşma yok', async ({ page }) => {
  await openDecodePanel(page);
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow, `${String(width)}px genişlikte yatay taşma`).toBeLessThanOrEqual(1);
  }
});
